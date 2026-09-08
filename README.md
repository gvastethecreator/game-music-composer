# Game Music Composer

Original game music with inspectable composition, role-aware performance and a portable workflow.

- `game-music-composer/`: installed skill, native Python CLI, optional render path, and Ensemble Atelier viewer assets.
- `game-music-composer-showcase/`: existing static showcase, unchanged by the Atelier increment.
- `game-music-composer-maintainer/`: historical rebuild and corpus tooling, outside the installed package.
- `docs/composer-director/`: audit, research, architecture and staged implementation backlog.

## Ensemble Atelier — R03

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
