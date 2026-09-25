# Game Music Composer

A static, local-friendly showcase for the Game Music Composer skill.

The catalog contains 240 instrumental cues across 24 categories: 100 Phrase Studio scene scores and 14 groove packs of ten. Each new collection has authored subjects, answers, harmony and genre-specific bass and percussion. Timber, Prism and Voltage add new synthesis models alongside Chamber, Velvet and Circuit. Live playback and native masters resolve the same multisample regions; mastering effects differ. Symbolic review is diagnostic. Human artistic approval remains pending.

The first screen starts with sound. From there you can:

- create new songs in **Create** with the synthesis engine: pick a style, play, ask for a new song, a variation or a chaos transformation, keep ideas in slots A–D, and shape tracks, harmony, notes, mix and song sections;
- open any catalog cue in Create to hear its notes through the synthesis engine, or open a Create song in Studio to hear it through the sampled banks;
- hear 240 instrumental cues with Chamber, Velvet, Circuit, Compact, Chip or mastered audio;
- load `composition.json` or `catalog.json` from the skill and compare the same notes across all eight live banks;
- inspect form, harmony, voices, notes and patch routing;
- create ensemble, pocket, phrase, genre and cycle sketches directly beside the piano roll;
- select and edit native notes, apply performance, undo changes and restore the source cue;
- play the SVG instruments, mute or solo tracks, and open an instrument focus view;
- export the current native JSON or a stereo WAV with the selected live bank and mixer settings;
- shape and export a 15-part composition recipe;
- browse and audition 54 Factory Bank patches;
- read a repeatable score review and download MIDI, source data or the full skill.

## Create

Create is the first view for new visitors. It runs `engine/core.js`, a port of the UMBRA 8 music core published from `game-music-composer/resources/studio-engine/` by `tools/sync_studio.py`. Essential mode keeps the short path; Studio mode adds the track inspector, arpeggio/chop performance, note editing, composition, master, macros and song building. Songs save in the browser; export a project JSON to keep them. Exports: WAV, MIDI, project JSON and stems (ZIP). Create and Studio never play at the same time.

## Run locally

The published playground is [Composer Studio on GitHub Pages](https://gvastethecreator.github.io/game-music-composer/). See [docs/playground.md](../docs/playground.md) for the deploy path.

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. Direct `file://` use remains supported for the core static flow.

The published app runs without a build step. It loads the cue index first, then loads full cue data and the sample scripts for each required patch only when playback or bank use needs them. The integrated Atelier uses the same native events, transport and eight live banks as the original piano roll. Standalone Atelier HTML files remain a separate portable option with their synthetic preview engine.

Local score imports and edits stay in the current browser session. Export JSON before closing the page. The app accepts native compositions, catalogs and Atelier sessions, up to 5 MB per file, 24 local scores and 30,000 local events. Edited cues are marked as local drafts; their original review and mastered recording are not attached to the changed notes. Undo keeps up to 24 revisions per score, and Restore source recovers the loaded original.

JSON exports keep native score fields and sample routing. Tempo and pitch sliders remain audition settings. WAV export includes those settings, track levels and the selected bank; it renders stereo PCM at 32 kHz with a warm-up loop for releases and echo. Browser WAV export supports loops up to two minutes. Use `neospc.py export-midi` or `neospc.py render` for the native production workflow. A browser draft is not a reviewed or mastered delivery.

## Update the portable distribution

The genre expansion preserves the base hundred cues and adds forty scores with 80 audio files and 40 MIDI files. Its current source is `data/genre-expansion-contracts.json`; the installed skill explains native project creation in `references/52-genre-expansion.md`.

`tools/extend_catalog.py` has prepare, verify and publish phases. It accepts a complete palette build produced by `tools/add_genre_patches.py GENRE_BANKS --base BASE_PALETTES`. Prepare snapshots the original catalog, archives and export hashes, and refuses existing cue IDs. It is an append operation for the base hundred-cue distribution, not an overwrite command for the expanded library.

```bash
python tools/extend_catalog.py prepare OUTPUT --banks GENRE_BANKS
python game-music-composer/scripts/neospc.py audit-bank OUTPUT/render-catalog.json --manifest GENRE_BANKS/factory-bank-manifest.json --output OUTPUT/bank-audit.json
python game-music-composer/scripts/export_midis_v4.py OUTPUT/render-catalog.json OUTPUT/midi
python game-music-composer/scripts/render_mix_v4.py OUTPUT/render-catalog.json game-music-composer/resources/original-sample-bank game-music-composer/data/instrument-calibration.json OUTPUT/audio --factory-dir GENRE_BANKS --workers 3
python tools/extend_catalog.py verify OUTPUT --banks GENRE_BANKS
python tools/extend_catalog.py publish OUTPUT --banks GENRE_BANKS
python game-music-composer-showcase/scripts/split_catalog.py
```

Verification requires all 120 new exports and unchanged hashes for the previous 300. The MIDI pack contains 140 files. The source pack contains all 140 contracts and scores, with prior release evidence under `history/`. Existing download paths retain their names; the catalog declares `6.1.0-four-genres`. The former `regenerate_catalog.py` tool targets the original hundred-cue replacement and is not the expanded catalog publisher.

From the repository root, after changing shared Atelier modules:

```bash
python game-music-composer/scripts/package_skill.py
python tools/sync_studio.py
```

`atelier/{music,visuals,atelier}.js` are exact copies of the canonical skill resources. Do not edit those copies. The sync also publishes the 59 explicit instrument assignments, the current skill ZIP and `MANIFEST.sha256`. New Atelier timbres use named Factory patches and existing Original Mono samples; the bank inspector shows the actual assignment.

## Checks

```bash
python scripts/audit_showcase.py
node --check app.js
```

From the repository root, `node --test tests/ensemble-atelier/studio.test.cjs` checks the native bridge and shared assets. `python tests/ensemble-atelier/studio_tests.py` exercises the integrated browser flow with Playwright and Chrome (`CHROMIUM_EXECUTABLE` can select its executable).

The static audit checks markup links, JavaScript element hooks, all 140 lazy cue files, 420 cue media files, the eight-bank contract, local import guards, bank previews, downloads and key access styles.

## Skill and bank

- `downloads/game-music-composer.zip` contains the full skill.
- `FACTORY-BANK-INTEGRATION.md` covers bank layout, license and use.
- Chamber includes CC0 VSCO 2 CE recordings by Versilian Studios and original synthesis. Source URLs and hashes are bundled in the skill’s soundbank-provenance.json. There are no extracted game samples.

## Studio instruments and production palettes

The shared SVG instruments follow a generated vector-style reference in `docs/design/instrument-vector-reference.png` at the repository root. The 13 families have separate note-driven mechanisms, a shared focus state and reduced motion. The piano roll uses screen-sized drawing coordinates and pixel-ratio-aware backing resolution so note labels remain readable.

Each of the original three production palettes contains 54 patches and 648 regions. Timber, Prism and Voltage each add 54 patches and 2,130 regions, with three intensity layers, two alternate attacks and at most six semitones between roots. Chamber draws on 103 pinned CC0 recordings for its acoustic subset; other patches are synthesized. Velvet uses tine/reed excitation and tape motion. Circuit uses dual oscillators and closing spectral envelopes. Compact and Chip remain separate previews. The expansion adds forty scores, eighty masters and forty MIDI exports while retaining the previous hundred. The WAV export uses the selected live palette.

The genre bank builder adds synthesized requinto, muted rhythm guitar, bongo and guira to all three production palettes. Its receipt lists source hashes and each new embedded file. The `neo32` profile is a representative preview, not another complete multisample bank.

### Workspace and current recipes

The studio places the piano roll beside the cue library. Playback settings open from the transport. Instruments, mixer levels and score notes share the keyboard-accessible lower dock. Instrument note pads can be shown with **Note pads**.

The original hundred use `phrase-blueprints-1`; the four additions use `genre-expansion-1`. Review results shown in the app are symbolic checks. Listening approval remains pending.

### Carbon workspace

The desktop studio keeps its library on the left and the piano roll above a dock. Use the dock tabs for instruments, mixer and score notes; arrow keys move between tabs. Files contains the existing downloads. On narrow screens the score stays first and the library moves below it. The score renderer and audio engine are unchanged.

The Chamber subset currently covers 15 of the 54 patch definitions with recorded material. Some zones share a recording when the source has no second take; the manifest region count is not a count of unique recorded performances. The other Chamber patches and all Velvet/Circuit patches use synthesis.


## New synthesis palettes

Timber models plucks, struck partials and acoustic bodies; Prism uses nested FM; Voltage uses band-limited oscillators and oversampled drive. All three are original synthesis. Their lossless FLAC chunks load on demand. The patch inspector follows the selected palette. High-rate Chamber previews are unavailable for other palettes, so an audition cannot silently use the wrong source.

The 140 written scores and existing catalog masters are unchanged. Choose a new live palette to hear it, or export WAV with that palette. Native rendering accepts --factory-dir through neospc.py. The canonical skill reference 53-resonant-soundbanks.md documents the build and individual-patch CLI.

## Console soundpacks

Mega Drive and SNES add two emulator-derived sample previews, for ten live menu choices in total. They map 54 score roles onto named console presets and share 224 dry source samples. The Soundbank page includes native emulator demo audio and [Mega Drive](downloads/megadrive-soundpack.zip) / [SNES](downloads/snes-soundpack.zip) downloads with original patches, an editable score, generator, native VGM/SPC and WAV. SNES also includes BRR sources. Studio playback/export uses its modern sample mixer; use the native files for hardware voice limits. Physical-console equivalence and listener preference remain unverified. See the console soundpack reference in the bundled skill.
