# Neo-SPC Composer Studio

A static, local-friendly showcase for the Neo-SPC composition skill.

The first screen starts with sound. From there you can:

- hear 100 complete game-music cues with Factory Neo-16, Original Mono, Chip Core or mastered audio;
- load `composition.json` or `catalog.json` from the skill and compare the same notes across all three live banks;
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

Local score imports stay in the current browser session. The app accepts up to 5 MB per file, 24 local scores and 30,000 local events. Imported scores use Live score playback because the JSON has no mastered audio asset. Use `neospc.py export-midi` or `neospc.py render` from the score project for those files.

## Checks

```bash
python scripts/audit_showcase.py
node --check app.js
```

The static audit checks markup links, JavaScript element hooks, all 100 lazy cue files, 300 cue media files, the three-bank contract, local import guards, bank previews, downloads and key access styles.

## Skill and bank

- `downloads/game-music-composer.zip` contains the full skill.
- `FACTORY-BANK-INTEGRATION.md` covers bank layout, license and use.
- The Factory Bank uses original CC0 material and contains no extracted game samples.
