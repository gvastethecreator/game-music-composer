# Neo-SPC Music Composer

A reusable skill for writing expressive, loop-ready SNES-style game music. It turns a concrete scene brief into a composition plan, full recipe, score data, Type-1 MIDI and optional rendered previews.

## Start here

Run these commands from this folder:

```bash
python scripts/neospc.py doctor --strict
python scripts/neospc.py init work/ash-crown --title "Ash Crown" --category action --game-function "boss entrance" --game-context boss --mood dread --meter 7/8 --voices 16 --bars 16
python scripts/neospc.py validate work/ash-crown/composition-plan.json work/ash-crown/generation-harness.json --strict
```

The generated plan holds the game need, emotional change, form, loop strategy, voice budget and quality gates. The generated harness holds all 15 composition and production control groups.

Read `SKILL.md` for the full writing path. Keep `composition-plan.json`, the harness and score JSON as the project source files.

## Command surface

- `doctor`: checks bundled JSON, schemas, templates, scripts, 100-cue benchmark and 50-patch bank.
- `init`: creates a valid plan and recipe from a brief.
- `validate`: checks plans, recipes, cues and catalogs with exact JSON paths.
- `review`: applies the bundled, repeatable score rubric to a catalog.
- `export-midi`: writes Type-1 MIDI and an export audit. It has a standard-library fallback.
- `audit-bank`: checks patch names, role coverage and playable ranges.
- `render`: writes WAV, OGG and MP3 previews when NumPy, SoundFile and FFmpeg are present.

## Proof and samples

`data/neospc100-benchmark-v4.1.json` is a 100-cue test corpus and structure reference. It is not a phrase source. `data/snes-original-samples/` and the Factory Bank hold original or cleared sample material; see `LICENSE-NOTES.md` and `SOURCES.md`.

Run focused checks with:

```bash
python -m unittest discover -s scripts/tests -v
python scripts/package_skill.py
```
