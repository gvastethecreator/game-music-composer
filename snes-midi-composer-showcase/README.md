# Neo-SPC Composer Studio

A static, local-friendly showcase for the Neo-SPC composition skill.

The first screen starts with sound. From there you can:

- hear 100 complete game-music cues with Factory Live or mastered audio;
- inspect form, harmony, voices, notes and patch routing;
- shape and export a 15-part composition recipe;
- browse and audition 50 original Factory Bank patches;
- read a repeatable score review and download MIDI, source data or the full skill.

## Run locally

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. Direct `file://` use remains supported for the core static flow.

The app has no build step. It loads the cue index first, then fetches full cue data and the large sample bank only when playback or bank use needs them.

## Checks

```bash
python scripts/audit_showcase.py
node --check app.js
```

The static audit checks markup links, JavaScript element hooks, all 100 lazy cue files, 300 cue media files, bank previews, downloads and key access styles.

## Skill and bank

- `downloads/neospc-music-composer.zip` contains the full skill.
- `FACTORY-BANK-INTEGRATION.md` covers bank layout, license and use.
- The Factory Bank uses original CC0 material and contains no extracted game samples.
