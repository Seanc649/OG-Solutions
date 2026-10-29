---
name: study-reference
description: Build or refresh the Obsidian house style from proven videos. Measures a folder of top-performing (golden) reels or long-form videos frame by frame (cuts, shot lengths, layouts, speech pacing, loudness), looks at contact sheets, and writes the pattern bank into docs/HOUSE-STYLE.md so every later edit copies what already worked. Use when the user supplies reference or best-performing videos, says "study these", "learn my style", "match this editor", or before the first edit for a new brand or format.
---

# Study reference videos

Start from proven work, not from what the model assumes looks good. The edit skills
copy the numbers and rules in `docs/HOUSE-STYLE.md`; this skill is how those numbers
get there. It is the golden data set that later edits are judged against.

## Inputs

- A folder of finished videos that performed well, all in one format (for example
  9:16 reels, or 16:9 long-form). Do not mix formats in one study; run one per format.
- Optional: a word-level transcript beside each video as `<name>.json`
  (`words[{text,start,end}]`) for pacing numbers. Reuse existing transcripts; ask
  before paying to transcribe.
- Ten or more videos give stable medians. Note the count when there are fewer.

Keep reference media in `raw-media/` or a video project's `assets/`; both are gitignored.
Never commit someone else's videos.

## Steps

1. **Measure.**

   ```sh
   node .agents/skills/study-reference/scripts/study-references.mjs raw-media/references --out tmp/study-<format>
   ```

   Writes contact sheets and `stats.json` per video, plus `patterns.json` and
   `patterns.md` across the set. `--fps 2` sets how many sheet tiles per second;
   raise it to 4 to 6 for very fast reels. `--cut 30` is the hard-cut threshold;
   lower it if soft cuts are missed, raise it if camera moves register as cuts.

2. **Look.** Open every contact sheet with the image reader. The numbers cannot see
   these; record each one per video, then tally across the set:
   - Layouts used and their share: speaker full frame, split (B-roll top, speaker
     bottom), full-screen B-roll, screen recording with face cam, punch-in.
   - How long the speaker is off screen at most.
   - Captions: words per chunk, font feel, case, box or bare, colour accents,
     position by layout.
   - B-roll kinds: real footage, screen recordings, UI mocks, AI video, stills.
   - Motion graphics: cards, logos, highlights, zooms; how they enter and leave.
   - First frame and last frame; hook shape; CTA shape.

3. **Listen.** From `stats.json` audio fields and spot checks: speech start, music
   level under voice, where sound effects land (onsets in the motion-showreel
   `analyze-reference.mjs` report help), and final loudness.

4. **Write the pattern bank.** Update the section for this format in
   `docs/HOUSE-STYLE.md`: paste the `patterns.md` table, then the observed rules from
   steps 2 and 3, each with its share or range. Mark which numbers are measured and
   which are judgement. Replace the borrowed baseline for anything you measured.

5. **Show the user** the table and the five strongest patterns, and ask which ones
   are deliberate. Patterns they reject become "do not copy" notes.

## Rules

- Measure, then describe. Never write a number into the house style that was not
  measured or approved by the user.
- A pattern seen once is an observation, not a rule. Rules need most of the set.
- Re-run this study when the user adds new top performers; keep the date and video
  count in the house style so drift is visible.
- Check that cut times are believable on the sheets: a cross-fade or fast camera move
  can read as a cut. Correct the count by hand if needed and say so.
