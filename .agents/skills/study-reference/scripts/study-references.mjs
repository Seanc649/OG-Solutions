#!/usr/bin/env node
// Measure a folder of proven ("golden") videos and write a pattern bank.
//
// Usage: node study-references.mjs <video-or-folder> [more ...] --out <dir> [--fps 2] [--cut 30]
//
// For each video, writes <out>/<name>/:
//   sheet_NN.png   4x4 contact sheets, --fps tiles per second, for the agent to look at
//   stats.json     cuts, shot lengths, first cut, speech start, pauses, loudness, layout hints
// And across all videos:
//   <out>/patterns.json   per-video stats plus medians across the set
//   <out>/patterns.md     the same numbers as a readable table, to copy into docs/HOUSE-STYLE.md
//
// A word-level transcript beside a video (<name>.json, ElevenLabs/normalized shape with
// words[{text,start,end}]) adds words per second and gap statistics.
// Needs ffmpeg and ffprobe on PATH.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const OUT = opt('out');
const FPS = Number(opt('fps', 2));
const CUT = Number(opt('cut', 30));
const inputs = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!OUT || !inputs.length) {
  console.error('Usage: node study-references.mjs <video-or-folder> [more ...] --out <dir> [--fps 2] [--cut 30]');
  process.exit(1);
}
const VIDEO = /\.(mp4|mov|mkv|webm|m4v)$/i;
const videos = inputs.flatMap(p => statSync(p).isDirectory()
  ? readdirSync(p).filter(f => VIDEO.test(f)).sort().map(f => join(p, f))
  : [p]);
if (!videos.length) { console.error('No videos found.'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${String(r.stderr).slice(0, 400)}`);
  return r;
};
const round = (v, d = 2) => v == null || Number.isNaN(v) ? null : Number(v.toFixed(d));
const quantile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};

function probe(video) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', video]);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find(s => s.codec_type === 'video');
  const [n, d] = v.r_frame_rate.split('/').map(Number);
  return { width: v.width, height: v.height, fps: n / (d || 1), duration: Number(j.format.duration), hasAudio: j.streams.some(s => s.codec_type === 'audio') };
}

// Hard cuts from mean absolute luminance difference between frames, plus where the
// picture changes (top half vs bottom half), which hints at split vs full layouts.
function measureCuts(video, fps) {
  const W = 64, H = 36, F = W * H;
  const gray = run('ffmpeg', ['-v', 'error', '-i', video, '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-']).stdout;
  const n = Math.floor(gray.length / F);
  const cuts = [];
  const topOnly = [], bottomOnly = [];
  let prevHigh = false;
  for (let f = 1; f < n; f++) {
    let d = 0, top = 0, bottom = 0;
    for (let i = 0; i < F; i++) {
      const delta = Math.abs(gray[f * F + i] - gray[(f - 1) * F + i]);
      d += delta;
      if (i < F / 2) top += delta; else bottom += delta;
    }
    d /= F; top /= F / 2; bottom /= F / 2;
    const high = d > CUT || top > CUT * 1.6 || bottom > CUT * 1.6;
    if (high && !prevHigh) {
      const t = f / fps;
      cuts.push(t);
      // A change confined to one half suggests a split layout swapping its B-roll panel.
      if (top > CUT * 1.6 && bottom < CUT / 3) topOnly.push(t);
      if (bottom > CUT * 1.6 && top < CUT / 3) bottomOnly.push(t);
    }
    prevHigh = high;
  }
  return { cuts, topOnly, bottomOnly, frames: n };
}

// Speech/silence from ffmpeg silencedetect, on the full mix.
function measureSilence(video) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', video, '-af', 'silencedetect=noise=-35dB:d=0.15', '-f', 'null', '-'], { maxBuffer: 1 << 30 });
  const text = String(r.stderr);
  const starts = [...text.matchAll(/silence_start: ([\d.]+)/g)].map(m => Number(m[1]));
  const ends = [...text.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map(m => ({ end: Number(m[1]), dur: Number(m[2]) }));
  return { starts, ends };
}

function measureLoudness(video) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { maxBuffer: 1 << 30 });
  const text = String(r.stderr);
  const summary = text.slice(text.lastIndexOf('Summary:'));
  const num = re => { const m = summary.match(re); return m ? Number(m[1]) : null; };
  return { lufs: num(/I:\s+(-?[\d.]+) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}

function transcriptStats(video) {
  const path = join(video.slice(0, -extname(video).length) + '.json');
  if (!existsSync(path)) return null;
  const words = (JSON.parse(readFileSync(path, 'utf8')).words || []).filter(w => (w.type ?? 'word') === 'word');
  if (words.length < 2) return null;
  const gaps = words.slice(1).map((w, i) => Math.max(0, w.start - words[i].end));
  const span = words.at(-1).end - words[0].start;
  return {
    words: words.length,
    wordsPerSecond: round(words.length / span),
    firstWordAt: round(words[0].start),
    gapMedian: round(quantile(gaps, 0.5), 3),
    gapP90: round(quantile(gaps, 0.9), 3),
    pausesOver200ms: gaps.filter(g => g > 0.2).length,
  };
}

const perVideo = [];
for (const video of videos) {
  const name = basename(video, extname(video)).replace(/[^\w.-]+/g, '-');
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  console.log(`Studying ${video}`);
  const info = probe(video);
  run('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `fps=${FPS},scale=${info.height > info.width ? '270:480' : '480:270'},tile=layout=4x4`, join(dir, 'sheet_%02d.png')]);
  const { cuts, topOnly, bottomOnly } = measureCuts(video, info.fps);
  const bounds = [0, ...cuts, info.duration];
  const shots = bounds.slice(1).map((t, i) => t - bounds[i]).filter(s => s > 0.04);
  const silence = info.hasAudio ? measureSilence(video) : null;
  const loud = info.hasAudio ? measureLoudness(video) : null;
  const firstSilenceEnd = silence?.ends.find(e => e.end - e.dur < 0.05);
  const stats = {
    file: video,
    width: info.width, height: info.height, fps: round(info.fps), duration: round(info.duration),
    orientation: info.height > info.width ? 'vertical' : 'horizontal',
    cuts: cuts.map(c => round(c, 3)),
    cutsPerMinute: round(cuts.length / (info.duration / 60), 1),
    shotMedian: round(quantile(shots, 0.5)),
    shotP90: round(quantile(shots, 0.9)),
    shotMax: round(Math.max(...shots)),
    firstCutAt: cuts.length ? round(cuts[0]) : null,
    splitPanelSwaps: { topOnly: topOnly.length, bottomOnly: bottomOnly.length },
    audio: info.hasAudio ? {
      speechStartsAt: round(firstSilenceEnd ? firstSilenceEnd.end : 0),
      pausesOver150ms: silence.ends.length,
      lufs: loud.lufs, lra: loud.lra, truePeak: loud.truePeak,
    } : null,
    transcript: transcriptStats(video),
    sheets: readdirSync(dir).filter(f => f.startsWith('sheet_')).length,
    sheetSecondsPerTile: round(1 / FPS, 3),
  };
  writeFileSync(join(dir, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');
  perVideo.push(stats);
}

const med = pick => round(quantile(perVideo.map(pick).filter(v => v != null), 0.5));
const summary = {
  videos: perVideo.length,
  duration: med(s => s.duration),
  cutsPerMinute: med(s => s.cutsPerMinute),
  shotMedian: med(s => s.shotMedian),
  shotP90: med(s => s.shotP90),
  shotMax: med(s => s.shotMax),
  firstCutAt: med(s => s.firstCutAt),
  speechStartsAt: med(s => s.audio?.speechStartsAt),
  lufs: med(s => s.audio?.lufs),
  truePeak: med(s => s.audio?.truePeak),
  wordsPerSecond: med(s => s.transcript?.wordsPerSecond),
  gapMedian: med(s => s.transcript?.gapMedian),
  gapP90: med(s => s.transcript?.gapP90),
};
writeFileSync(join(OUT, 'patterns.json'), JSON.stringify({ summary, videos: perVideo }, null, 2) + '\n');

const rows = [
  ['Videos studied', summary.videos, ''],
  ['Length (s)', summary.duration, ''],
  ['Cuts per minute', summary.cutsPerMinute, 'Hard cuts, picture only'],
  ['Shot length median (s)', summary.shotMedian, ''],
  ['Shot length p90 (s)', summary.shotP90, ''],
  ['Longest shot (s)', summary.shotMax, 'Median of each video\'s longest shot'],
  ['First cut at (s)', summary.firstCutAt, ''],
  ['Speech starts at (s)', summary.speechStartsAt, 'From silence detection'],
  ['Words per second', summary.wordsPerSecond, 'Needs transcripts beside videos'],
  ['Gap between words, median (s)', summary.gapMedian, 'Needs transcripts'],
  ['Gap between words, p90 (s)', summary.gapP90, 'Needs transcripts'],
  ['Integrated loudness (LUFS)', summary.lufs, ''],
  ['True peak (dBFS)', summary.truePeak, ''],
];
const md = [
  `# Pattern bank: ${summary.videos} reference videos`,
  '',
  'Medians across the set. Per-video numbers are in patterns.json; contact sheets are in each video\'s folder.',
  '',
  '| Measure | Value | Note |',
  '| --- | --- | --- |',
  ...rows.map(([k, v, n]) => `| ${k} | ${v ?? 'n/a'} | ${n} |`),
  '',
  '| Video | Length | Cuts/min | Shot median | First cut | LUFS |',
  '| --- | --- | --- | --- | --- | --- |',
  ...perVideo.map(s => `| ${basename(s.file)} | ${s.duration} | ${s.cutsPerMinute} | ${s.shotMedian} | ${s.firstCutAt ?? 'n/a'} | ${s.audio?.lufs ?? 'n/a'} |`),
  '',
];
writeFileSync(join(OUT, 'patterns.md'), md.join('\n'));
console.log(md.join('\n'));
