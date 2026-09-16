# Composer Studio playground

Composer Studio is a static site. It needs no build step, no backend, and no secrets. GitHub Pages can host the full playground at `https://gvastethecreator.github.io/game-music-composer/`.

## Local preview

From the repository root:

```bash
python -m http.server 8000 --directory game-music-composer-showcase
```

Open `http://localhost:8000`. Relative asset URLs also work if you open `game-music-composer-showcase/index.html` from disk, with the same Factory Bank limits documented in the [studio guide](../game-music-composer-showcase/README.md).

## GitHub Pages

The workflow `.github/workflows/github-pages.yml` uploads `game-music-composer-showcase/` on each push to `main` that touches that tree. The site uses relative URLs, so it works at `/game-music-composer/`.

The published tree includes live sample banks. Expect a large artifact (about 1.2 GB). Downloads stay next to the app (`downloads/`).

After you change shared Atelier modules or the generation harness:

```bash
python tools/publish_studio_recipes.py
python tools/sync_studio.py
```

`publish_studio_recipes.py` copies harness 3.0.0, scale/chord/pattern libraries, and mix-bus profiles into the studio. `sync_studio.py` also runs that publish step, then copies Atelier modules and refreshes `MANIFEST.sha256`.

## Limits

- Live playback applies each cue's stored mix echo. Mastered MP3/OGG files are the native render, not a live re-mix.
- Symbolic review is diagnostic. Human listening is still pending.
- Native render cache and MIDI channel wrap remain known engine limits. They do not block the browser studio.
