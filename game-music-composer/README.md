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

Refinement changes performed timing, gate and velocity while preserving the written notes. The profiles are `chamber`, `pocket`, and `ritual`; start each revision from the original catalog. Both helpers refuse existing output files. Use a new render directory to preserve each revision; renderer cache reuse requires matching fingerprints and required outputs, not file existence alone. See [Ensemble Atelier](references/49-ensemble-atelier.md) for limits and [sound backends](references/57-sound-backends.md) for receipts and output formats.

## Command surface

- `doctor`: checks bundled JSON, schemas, templates, scripts, benchmark and bank; reports their current counts.
- `init`: creates a valid plan and recipe from a brief.
- `compose`: writes `composition.json` and `catalog.json` from the plan, harness and seed.
- `validate`: checks plans, recipes, cues and catalogs with exact JSON paths.
- `review`: applies a heuristic symbolic rubric to a catalog. `plan_compliance` checks declarations and score proxies; it does not verify plan execution. The attached backend registry is guidance, not a backend test. Optional `--plan`.
- `export-midi`: writes Type-1 MIDI and an export audit. It has a standard-library fallback.
- `audit-bank`: reports mapped patch IDs and range warnings; it does not certify role fit or playback.
- `render`: exports backend audio and receipts when its optional dependencies are available; see [sound backends](references/57-sound-backends.md).

## Proof and samples

Scene contracts live in `data/catalog-contracts-r03.json`; groove contracts live in `data/genre-expansion-contracts.json`. They define subjects, answers, phrase spans, harmony, role rests and section intensity. For a source-repository catalog rebuild, inspect `tools/rebuild_full_catalog.py`, which combines both sets. The older `tools/regenerate_catalog.py` entry point requires a scene-only catalog and does not accept the current combined corpus. These tools are outside the portable skill; use `init` and `compose` for an individual cue.

Use the review and export audit for the catalog revision being delivered; historical approval and multi-port counts are not current evidence. Symbolic approval is not listening approval. Scores with more than 15 melodic instruments need a player or DAW that honors MIDI Port metadata. Every melodic lane has a unique port/channel pair; the optional `mido` writer and bundled writer use the same routing.

`data/neospc100-benchmark-v4.1.json` retains its historical filename and contains the current test corpus. It is not a phrase source. `resources/original-sample-bank/` and the Factory Bank hold original or cleared sample material; see `LICENSE-NOTES.md` and `SOURCES.md`.

Historical v3/legacy rebuild material is kept separately for maintainers and is not required to use the skill.

For package maintenance, choose the affected checks. Packaging with `--smoke` runs the unit suite again after extraction; it writes the manifest and ZIP.

```bash
python -m unittest discover -s scripts/tests -v
python scripts/package_skill.py --smoke
python scripts/release_gate.py
```

`render` is optional. Install the pinned local dependencies with `python -m pip install -r requirements-render.txt` and make `ffmpeg` available on `PATH` before requesting WAV, OGG or MP3 output.
