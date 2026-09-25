# Game Music Composer

Write inspectable instrumental game music, then hear it in a browser studio.

Composer Studio is a static playground. **Create** writes and plays new songs with a synthesis engine (32 styles, ten tracks, arpeggiator, mixer and effects). **Studio** holds 240 catalog cues with a piano roll, live soundbanks and a generation recipe you can export. The installed skill is a Python CLI that composes, reviews, writes MIDI, and renders audio; its `create` command runs the same synthesis engine through Node.js. No server or API key is required.

## Quick start

Play the studio in the browser:

- Live: [Composer Studio on GitHub Pages](https://gvastethecreator.github.io/game-music-composer/)
- Local:

```bash
python -m http.server 8000 --directory game-music-composer-showcase
```

Open `http://localhost:8000`.

Use the installed skill from `game-music-composer/`:

```bash
python scripts/neospc.py doctor --strict
```

## Documentation

- [Composer Studio guide](game-music-composer-showcase/README.md)
- [Playground and GitHub Pages](docs/playground.md)
- [Installed skill](game-music-composer/SKILL.md)

## Status

- Symbolic score review is diagnostic. Human listening is still pending.
- Native render cache and MIDI channel wrap remain known engine limits.
- License: [CC0-1.0](LICENSE)
