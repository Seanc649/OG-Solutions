# Obsidian Studio

The AI video-editing studio for Obsidian Global Solutions. You record yourself
talking and hand over the file; Claude Code cuts it, captions it, finds the B-roll,
builds the motion graphics, mixes music and sound effects, checks its own work, and
renders the video. No editing app.

It is built on Nate Herk's open-source [Herk Edit Kit](https://github.com/nateherkai/herk-edit-kit)
(the workflow he walks through on Matt Wolfe's "Show Me Your Workflow") and
[HyperFrames](https://github.com/heygen-com/hyperframes), with Obsidian additions:
a tool that learns the house style from your own best videos, and a feedback loop
that turns every review note into a permanent rule. Branding is placeholder until
the brand kit is added.

## How it works

1. **Learn the style from proven videos.** Give it your best-performing reels or
   videos. The `study-reference` skill measures them frame by frame (cuts per minute,
   shot lengths, layouts, pauses, loudness), looks at contact sheets, and writes the
   patterns into [docs/HOUSE-STYLE.md](docs/HOUSE-STYLE.md). Until then it uses Nate's
   measured style from 27 top reels as the baseline.
2. **Record and hand over the file.** Mistakes and retakes are fine.
3. **Transcribe** with word-level timestamps (ElevenLabs Scribe by default; Whisper works).
4. **Cut** retakes, stutters, and dead air, between phrases only and after each word
   fully decays on the waveform, so words are never clipped.
5. **Plan the story:** hook, proof, items, payoff, CTA.
6. **Build the edit** in HyperFrames: three short-form scenes (B-roll on top with you
   below, full B-roll, full-screen you), or long-form screen plus face cam that
   switches to full face cam when the screen goes still. Motion graphics and captions
   land on the exact spoken word. B-roll comes from real footage, screen recordings,
   or AI video (Kie.ai or the Higgsfield connector, with approval before any spend).
7. **Mix** voice, music, and sound effects.
8. **Judge and render.** The `edit-feedback` skill checks the draft against the house
   style before you see it.
9. **Give notes in plain words.** Each one is fixed and written into the studio as a
   rule, so you never give the same note twice.

## Install

Install Node.js **22 or newer**, Git, FFmpeg (with ffprobe), and Chrome or Chromium.
Then:

```sh
npm ci
npm run setup
npm test
```

Setup checks the tools and creates `.env` if it is missing. Add only the keys you
use: `ELEVENLABS_API_KEY` for transcription, `KIE_API_KEY` for AI video if not
using Higgsfield. See [tools and API keys](docs/TOOLS-AND-API-KEYS.md).

Check that rendering works:

```sh
npm run demo
cd video-projects/demo
npx hyperframes preview
```

## Use it

Open this folder in Claude Code and say one of these.

**Teach it the style (do this first, once you have proven videos):**

> Use study-reference on the reels in raw-media/references/reels and update the house style.

**Edit a reel or Short:**

> Use short-form-edit to turn my recording at [path] into a 9:16 reel. Strong hook,
> tighten mistakes, captions, moving B-roll, and sound design. Draft for review.

**Edit a long-form YouTube video:**

> Use edit-video on my face cam at [path] and screen recording at [path]. Cut dead
> air and retakes, show me the proposed mistake cuts, and flag anything a viewer
> won't follow.

**Give a note:**

> The caption at 0:07 is unreadable. Fix it and add it to the studio so it never happens again.

Other skills: `cut-silences`, `cut-mistakes`, `video-storytelling`, `motion-showreel`
(brand reels cut to music), `make-a-video` (motion graphics from a brief),
`website-to-hyperframes`, `style-library`.

## Where things live

| What | Where |
| --- | --- |
| Obsidian house style and rules from notes | [docs/HOUSE-STYLE.md](docs/HOUSE-STYLE.md) |
| Baseline style, B-roll, caption, and sound rules | [docs/EDITING-PLAYBOOK.md](docs/EDITING-PLAYBOOK.md) |
| Step-by-step workflow and prompts | [docs/WORKFLOW.md](docs/WORKFLOW.md), [docs/PROMPTS.md](docs/PROMPTS.md) |
| Short-form details and validators | [docs/SHORT-FORM.md](docs/SHORT-FORM.md) |
| Brand colours and fonts (placeholder) | [assets/brand-tokens.css](assets/brand-tokens.css) |
| Motion-graphics cards (406 drafts) | [style-library/](style-library/GUIDE.md) |
| Scene templates | [style-templates/](style-templates/README.md) |
| Agent instructions | [CLAUDE.md](CLAUDE.md) |
| Licences and credits | [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |

Your footage, transcripts, and renders stay local: `video-projects/` and `raw-media/`
are gitignored.

## Still to add

- The Obsidian brand kit: logo, colours, fonts, a brand DESIGN.md, and a caption style.
- Obsidian's sound kit: music beds and sound effects you like, with notes on when to
  use each (Nate calls his the "Herk kit").
- A set of proven videos to study, so the house style is Obsidian's, not borrowed.
