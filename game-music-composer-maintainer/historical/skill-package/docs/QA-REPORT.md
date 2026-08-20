# QA Report — Neo-SPC Music Composer

Date: 2026-07-21
Status: PASS for the packaged skill and deterministic command path

## Automated proof

| Check | Result | Evidence |
|---|---|---|
| Official skill validator | PASS | `quick_validate.py` reports `Skill is valid!` |
| `doctor --strict` | PASS | 0 errors, 0 warnings; 100 cues, 50 patches, 15 harness sections |
| Focused unit suite | PASS | 5 tests in 24.605 seconds |
| Project init | PASS | Writes a plan and recipe; replacement requires `--force` |
| Validation errors | PASS | Reports exact JSON paths for bad fields |
| Review, MIDI and bank seam | PASS | One-cue catalog; review JSON, MIDI header, MIDI audit and bank audit checked |
| MIDI fallback | PASS | Type-1 MIDI works without `mido` |
| Package repeatability | PASS | Two builds have the same file count and SHA-256; cache files stay out |

## Fresh-agent test

A new agent followed `doctor → init → complete fields → validate` for a 16-bar, 7/8 boss entrance named `Ash Crown`.

The first pass found three CLI gaps: free-text-looking enum options, no separate game-function argument and a next-step line that named only the plan. The CLI now shows the allowed context and mood values, accepts `--game-function`, and prints a strict validation command for both generated files.

The new agent repeated the flow after those changes. `init` and joint strict validation passed with 0 errors and 0 warnings. The files retained the title, action category, `boss entrance` function, 7/8 meter, 16 voices and 16 bars.

## Claim limits

- `review` applies a repeatable symbolic score rubric. Fresh artistic judgment still needs a separate reviewer.
- The focused test renders no full audio corpus. `render` checks its Python needs and routes the existing render system; a full 100-cue render remains outside this change.
- Musical quality still needs listening checks for each new cue. Schema and score checks cannot prove taste, mix translation or emotional fit.
