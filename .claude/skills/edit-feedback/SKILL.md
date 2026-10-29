---
name: edit-feedback
description: Turn review notes on an edit into permanent studio rules, and judge drafts against the house style before the user sees them. Use whenever the user gives a note on a draft ("I can't read that caption", "that sound effect is cheap", "too slow here"), asks to review or score a render, or says "add this to the skill" / "never do that again".
---

# Edit feedback and judging

The studio gets better only if no note has to be given twice. Every note becomes a
fix in this edit AND a rule, check, or script change that the next edit inherits.

## When the user gives a note

1. Restate the note as a concrete defect with a timestamp ("caption at 0:07 is white
   on a white web page").
2. Fix it in the current project, re-render the affected range, and show the frame
   or clip that proves the fix.
3. Make it permanent. Pick the narrowest home that will be read next time:
   - A measurable style choice: `docs/HOUSE-STYLE.md` (the right format section).
   - A step the agent must take: the relevant skill's SKILL.md (`short-form-edit`,
     `edit-video`, `cut-mistakes`, `cut-silences`, ...).
   - Something a script can catch: add a check to a validator or `scripts/preflight.mjs`.
4. Add a row to the "Notes that became rules" table in `docs/HOUSE-STYLE.md`:
   date, the note in the user's words, and what the studio now does.
5. After editing any skill under `.claude/skills/`, run `npm run sync:skills`.

Ask before changing a rule the user set earlier. If a new note contradicts an old
rule, show both and let the user choose.

## Judging a draft (before the user sees it)

Run the checks in `docs/EDITING-PLAYBOOK.md` "Checking the edit", then judge the
draft against `docs/HOUSE-STYLE.md` with this rubric. Report pass/fail with
evidence (frame path or timestamp), not a 1 to 10 score.

| Check | Pass when |
| --- | --- |
| Hook | The first 3 s name the tool, person, or claim; speech starts within the house-style limit. |
| Pacing | Shot lengths and pauses sit inside the house-style ranges. |
| Layout mix | Layout shares and the speaker's longest absence match the house style. |
| Captions | Readable on every frame, never over the mouth, chunking and colour per house style. |
| B-roll | Every shot moves, matches the word it illustrates, and no scene repeats. |
| Sound | Music sits under the voice by the house-style gap; effects follow visible actions. |
| Words whole | Re-transcribed render matches the raw at every cut. |
| Truth | No invented numbers, results, quotes, or CTAs. |
| Brand | Colours, fonts, and logo usage match `assets/brand-tokens.css` and the brand DESIGN.md. |

Then run a persona pass: for two or three target viewers named in the house style,
say where each would stop watching and why. Treat it as a list of candidates to
verify on real frames, not as findings.

Record each failed check that the user agrees with as a rule (step 3 above), so the
judge grows with the studio.
