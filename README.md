# Game Music Composer

- `game-music-composer/` is the portable, Skills-CLI distributable runtime.
- `game-music-composer-showcase/` is the static demonstration site.
- `game-music-composer-maintainer/` preserves historical rebuild tooling and corpus material outside the installed skill package.

## Composer Director — experimental development track

Explore the [evidence-led composition audit and implementation plan](docs/composer-director/README.md),
including a [playable, offline musical sketch lab](labs/composer-director/index.html) and a
compose-stage control probe. The lab demonstrates theme selection, gameplay-state variations
and a protected A / editable B workflow. It is not the Neo-SPC renderer or an installed skill upgrade.
Production fixes and integrations are explicitly tracked in the backlog rather than claimed complete.

```bash
python -m unittest discover -s tests -p "test_*.py" -v
node --test tests/test_director.cjs
```

Node is only needed for the optional lab tests, not for the portable runtime or browser playback.

## Portable runtime

Run release checks from `game-music-composer/`:

```bash
python scripts/neospc.py doctor --strict
python -m unittest discover -s scripts/tests -v
python scripts/package_skill.py --smoke
python scripts/release_gate.py
```

The root repository has no Node/Bun package graph. The runtime is Python; optional render extras
are pinned in `game-music-composer/requirements-render.txt` and are not needed for the JSON
and MIDI gates.

The repository and the distributed skill both include the full CC0-1.0 legal code in `LICENSE`.
