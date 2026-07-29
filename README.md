# Neo-SPC Music Composer

- `snes-midi-composer-skill/` is the portable, Skills-CLI distributable runtime.
- `snes-midi-composer-showcase/` is the static demonstration site.
- `snes-midi-composer-maintainer/` preserves historical rebuild tooling and corpus material outside the installed skill package.

Run release checks from `snes-midi-composer-skill/`:

```bash
python scripts/neospc.py doctor --strict
python -m unittest discover -s scripts/tests -v
python scripts/package_skill.py --smoke
python scripts/release_gate.py
```

The repository and the distributed skill both include the full CC0-1.0 legal code in `LICENSE`.
