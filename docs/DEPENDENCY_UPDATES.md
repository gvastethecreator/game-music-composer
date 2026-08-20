# Dependency review — 2026-08-12

- Root runtime is Python and has no Node/Bun package graph; pnpm migration is not applicable.
- Optional render dependencies are now pinned to current PyPI releases in
  `game-music-composer/requirements-render.txt`: NumPy 2.5.2, SoundFile 0.14.0,
  pyloudnorm 0.2.0, and SciPy 1.18.0.
- The canonical JSON/MIDI path remains standard-library-only. FFmpeg remains an external executable.

Upstream release-note sources reviewed:

- [NumPy release notes](https://numpy.org/doc/stable/release.html)
- [SciPy release notes](https://docs.scipy.org/doc/scipy/release.html)
- [SoundFile releases](https://github.com/bastibe/python-soundfile/releases)
- [pyloudnorm releases](https://github.com/csteinmetz1/pyloudnorm/releases)
