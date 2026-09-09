# Game Music Composer

Original game music with inspectable composition, role-aware performance and a portable workflow.

The Studio contains 140 instrumental cues in 14 categories. The original hundred use explicit Phrase Studio subjects and answers. Ten new Bachatas, ten Trip hop cues, ten Traps and ten Reggaeton cues add dedicated writing rules, bass patterns and percussion. MIDI, audio and source downloads cover the full catalog. Symbolic review is diagnostic; human listening remains pending.

- `game-music-composer/`: installed skill, native Python CLI, optional render path, and Ensemble Atelier viewer assets.
- `game-music-composer-showcase/`: integrated studio with the original piano roll, live banks, Atelier creation, instrument surfaces and native editing.
- `game-music-composer-maintainer/`: historical rebuild and corpus tooling, outside the installed package.
- `docs/composer-director/`: audit, research, architecture and staged implementation backlog.

## Ensemble Atelier — R03

Open [Composer Studio](game-music-composer-showcase/index.html) for the complete browser workflow. Its original piano roll now shares one native score and transport with all five Atelier idea engines. Create, edit, shape performance, play individual instruments, undo, restore the source, and export native JSON or a WAV using the chosen live bank. The charcoal and amber studio also retains the 140-cue catalog, recipe editor, 54-patch browser and score review. See the [studio guide](game-music-composer-showcase/README.md) for session limits and distribution updates.

This branch now changes the installed skill, not only external prototypes. It adds a standalone score viewer, a conservative performance-refinement helper, five independent composition experiments, detailed SVG instruments and tests. The original CLI remains available; the new helpers do not replace its composing or rendering engines.

```bash
# From repository root: produce five complete offline HTMLs and a launcher.
python tools/build_ensemble_atelier.py
```

Open `.scratch/ensemble-atelier/index.html`. The standalone files are also under `ideas/I001` through `I005`. Node is only needed for optional developer tests, not for opening or building the HTMLs. Start audio explicitly and at a low volume.

```bash
# From the installed game-music-composer directory:
python scripts/visualize_score.py --input ../cue/composition.json --output ../cue/atelier.html
python scripts/refine_performance.py ../cue/catalog.json ../cue/catalog-performed.json --profile chamber --amount 0.5
python scripts/neospc.py validate ../cue/catalog-performed.json --strict
```

The viewer uses original synthetic preview timbres, not native/Factory Bank samples. The refinement preserves written pitches, onsets and durations while changing performed fields. It does not rewrite melody, harmony or form. Both tools refuse to overwrite existing output.

Start with [R03 changes and status](docs/composer-director/ROUND-03.md), [validation limits](docs/composer-director/VALIDATION-R03.md), or the installed [SKILL.md](game-music-composer/SKILL.md).

The Windows integration record includes package relocation, the native compose/refine/MIDI/render path, and a score viewer opened from disk. It also records fixes for circular timing, edited-note duration, audio preparation, the cycle selector, and package inventory checks. See the current section of the [validation record](docs/composer-director/VALIDATION-R03.md).

## Developer checks

```bash
# Build once; use a new output directory for subsequent builds.
python tools/build_ensemble_atelier.py
node --test tests/ensemble-atelier/music.test.cjs
python -m unittest discover -s game-music-composer/scripts/tests -p test_visualize_score.py -v
python -m unittest discover -s game-music-composer/scripts/tests -p test_refine_performance.py -v
```

The Node test reads the default `.scratch/ensemble-atelier` unless `GMC_LAB_DIR` is set. Browser runners in `tests/ensemble-atelier/` additionally require Playwright and Chromium; see their README. Generated work stays outside the tracked package.

Canonical release checks, from `game-music-composer/`:

```bash
python scripts/neospc.py doctor --strict
python -m unittest discover -s scripts/tests -v
python scripts/package_skill.py --smoke
python scripts/release_gate.py --check-tree
```

The package cache-exclusion/idempotency fixes are carried forward selectively from closed PR #1. Full native release and audio validation still require a complete checkout and assets; local extension tests are not a substitute. The existing native stale-render-cache and MIDI issues remain in the backlog.

The repository and installed package include CC0-1.0 in `LICENSE`. No external fonts, recordings, model-generated images or paid APIs are required for Atelier.
