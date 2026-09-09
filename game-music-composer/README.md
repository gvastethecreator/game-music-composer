# Game Music Composer

A reusable skill for writing expressive, loop-ready SNES-style game music. It turns a concrete scene brief into a composition plan, full recipe, score data, Type-1 MIDI and optional rendered previews.

## Start here

Run these commands from this folder:

```bash
python scripts/neospc.py doctor --strict
python scripts/neospc.py init ../ash-crown --title "Ash Crown" --category action --game-function "boss entrance" --game-context boss --mood dread --meter 7/8 --voices 16 --bars 16
python scripts/neospc.py validate ../ash-crown/composition-plan.json ../ash-crown/generation-harness.json --strict
python scripts/neospc.py compose ../ash-crown
python scripts/neospc.py export-midi ../ash-crown/catalog.json ../ash-crown/midi
```

The generated plan holds the game need, emotional change, form, loop strategy, voice budget and quality gates. The generated harness holds all 15 composition and production control groups. `compose` turns those sources into a deterministic score and a ready-to-check one-cue catalog.

Read `SKILL.md` for the full writing path. Keep `composition-plan.json`, the harness and score JSON as the project source files.

## Inspect and refine a score

```bash
python scripts/visualize_score.py --input ../ash-crown/composition.json --output ../ash-crown/atelier.html
python scripts/refine_performance.py ../ash-crown/catalog.json ../ash-crown/catalog-performed.json --profile chamber --amount 0.5
python scripts/neospc.py validate ../ash-crown/catalog-performed.json --strict
python scripts/neospc.py render ../ash-crown/catalog-performed.json ../ash-crown/audio-performed-new
```

The standalone HTML provides playable instruments, a piano roll, and session JSON and sketch WAV exports. Its synthetic voices do not use the native sample bank. To explore without a score, use `--demo instrumentarium`, `pocket`, `conversation`, `atlas`, or `cycles` instead of `--input`.

Refinement changes performed timing, gate and velocity while preserving the written notes. The profiles are `chamber`, `pocket`, and `ritual`; start each revision from the original catalog. Both helpers refuse existing output files. Use a new native render directory for each revision because the existing renderer reuses audio by file existence. See [Ensemble Atelier](references/49-ensemble-atelier.md) for limits and [the canonical workflow](references/canonical-compose-workflow.md) for delivery checks.

## Command surface

- `doctor`: checks bundled JSON, schemas, templates, scripts, 100-cue benchmark and 50-patch bank.
- `init`: creates a valid plan and recipe from a brief.
- `compose`: writes `composition.json` and `catalog.json` from the plan, harness and seed.
- `validate`: checks plans, recipes, cues and catalogs with exact JSON paths.
- `review`: applies the bundled, repeatable score rubric to a catalog.
- `export-midi`: writes Type-1 MIDI and an export audit. It has a standard-library fallback.
- `audit-bank`: checks patch names, role coverage and playable ranges.
- `render`: writes WAV, OGG and MP3 previews when NumPy, SoundFile and FFmpeg are present.

## Proof and samples

The full catalog is rebuilt from `data/catalog-contracts-r03.json`. Its 100 contracts preserve cue identity while defining phrase spans, harmonic holds, contrasting accompaniment, written role rests and section intensity. The native corpus generator consumes these fields; they are not browser-only annotations. `generate_neospc100_v3.py --output ../catalog-base` writes the base scores. The repository's `tools/regenerate_catalog.py` adds current bank assignments, performance, review and publication checks. Source downloads contain all seeded contracts and scores.

The regenerated corpus contains 74 symbolically approved cues and 26 marked for revision. This is not a listening approval. Seven MIDI files need a player or DAW that honors MIDI Port metadata because they use more than 15 melodic instruments. Every melodic lane has a unique port/channel pair; the optional `mido` writer and bundled writer use the same routing.

`data/neospc100-benchmark-v4.1.json` is a 100-cue test corpus and structure reference. It is not a phrase source. `resources/original-sample-bank/` and the Factory Bank hold original or cleared sample material; see `LICENSE-NOTES.md` and `SOURCES.md`.

The runtime package contains only the current v4.1 corpus and canonical tools. Historical v3/legacy rebuild material is kept separately for maintainers and is not required to use the skill.

Run focused checks with:

```bash
python -m unittest discover -s scripts/tests -v
python scripts/package_skill.py --smoke
python scripts/release_gate.py
```

`render` is optional. Install the pinned local dependencies with `python -m pip install -r requirements-render.txt` and make `ffmpeg` available on `PATH` before requesting WAV, OGG or MP3 output.
