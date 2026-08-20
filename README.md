# Game Music Composer

- `game-music-composer/` is the portable, Skills-CLI distributable runtime.
- `game-music-composer-showcase/` is the static demonstration site.
- `game-music-composer-maintainer/` preserves historical rebuild tooling and corpus material outside the installed skill package.

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
