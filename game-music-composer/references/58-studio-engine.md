# Studio engine

The studio engine is the synthesis songwriter behind Composer Studio's **Create** view. It is a port of the UMBRA 8 music core by the same author: ten tracks (kick, snare, hi-hat, open hat, percussion, bass, chords, pad, arpeggio, melody), 32 style presets, 19 scales, 119 progressions, 44 arpeggio and 28 chop templates, 65 synthesized timbres, channel strips (drive, EQ, chorus, phaser, tremolo, auto-pan, sends), a parallel drum bus, reverb, stereo delay, kick ducking and a master finish.

Source: `resources/studio-engine/core.js` (engine), `native-bridge.js` (engine song ↔ native score) and `labels-en.js` (English names). The browser studio publishes exact copies; `tools/sync_studio.py` copies them.

## When to use it

Use it for fast, finished-sounding loops and sketches in electronic, lo-fi, jazz, dub, ambient and dance styles, and to hear any native score through synthesis instead of the sample banks. Use the native `init`/`compose` path when the brief needs a written blueprint, odd meters, a phrase contract or a symbolic review.

The engine writes 4/4 phrases of 1–64 bars. Its composer is rule-based: seeded motifs, chord tones on strong beats, a bass that follows the harmony and the kick, and genre grooves. Treat its output as a sketch until someone listens.

## Commands

Composition, MIDI and import run the engine's JavaScript with Node.js 18 or later. `create-render` needs Web Audio, so it runs the same engine offline in local headless Chromium through Playwright for Python (`pip install playwright`, then `playwright install chromium`). `doctor` reports both.

```bash
python scripts/neospc.py create ../dusk --preset lofi --seed DUSK
python scripts/neospc.py create ../dusk --preset lofi --seed DUSK --variation V1 --force
python scripts/neospc.py create-render ../dusk/project.json ../dusk/engine.wav
python scripts/neospc.py render ../dusk/catalog.json ../dusk/render
python scripts/neospc.py create-import ../my-cue/composition.json ../my-cue/engine-project.json
```

`create` writes:

- `project.json`: the engine project (`schema: umbra-project`, version 8). Open it in Create with *Export → Open project JSON*.
- `composition.json` and `catalog.json`: the native score. Every engine note becomes an event; the written beat sits on a 1/48-beat grid and `performance_beat` keeps the played timing. Timbres map to the closest sampled studio instrument; track volume and send travel as `track_mix`. Songs above 32 simultaneous notes are refused with a reason.
- `engine.mid`: the engine's own MIDI (ten named tracks, program changes, drums on channel 10).

The same preset and seed give the same song. `--variation SEED` applies one seeded variation of rhythm and melody. `--bars` and `--form loop|journey` change the phrase.

`create-render` writes `<name>.receipt.json` (engine version, project and output SHA-256, settings, sample peak and RMS) and `create-game` writes `receipt.json`. They report sample peak and RMS, not LUFS or true peak. `render` on the catalog plays the same notes through the sample banks and writes the usual receipts.

`create-import` keeps a native score's notes and played timing as baked engine clips. Each instrument joins an engine track by role, with the closest synthesized timbre. Odd lengths (7/8, 5/4, 20 bars) are fitted to an allowed phrase and the tempo is scaled so the loop keeps its real duration; integer BPM rounding can move it by under 1%.

## Game music

A project can carry game states (`state.gmc.game`): each keeps every note and sets a level per track (vertical layering, 0–150%) and the energy, tension, space and movement macros. Defaults: Explore, Tension, Combat and Calm. Switches wait for the next beat, bar or phrase line.

```bash
python scripts/neospc.py create ../run --preset dnb --seed RUN --game-states
python scripts/neospc.py create-game ../run/project.json ../run/game
```

The package holds `manifest.json` (`format: gmc.game-music`), `states/<id>.wav` (one seamless loop per state, all with the same length and phase), `project.json` and `gmc-music-director.js`. In Create (Studio mode) the Game music panel edits states, auditions switches while playing and exports the same package as a ZIP.

Web runtime:

```js
const director = new GMCMusicDirector({ baseUrl: 'music/run/' });
await director.load();
director.start('explore');                         // after a user gesture
director.setState('combat');                       // next bar line
director.setState('calm', { quantize: 'phrase', fade: 1.5 });
```

Godot 4: add one `AudioStreamPlayer` per state on its own bus, load each WAV with loop mode enabled, call `play()` on all of them in the same frame, and at the next bar (`60.0 / bpm * 4` seconds from the start) tween the old bus volume to silence and the new one to 0 dB. Unity and FMOD follow the same idea: synchronized loops, gain changes on the quantize line. This is layer switching of one song, not branching composition; write a new song for a new area.

## Verification

`tests/rebuild/engine_golden.test.cjs` (repository) replays 193 scenarios against signatures recorded from the original UMBRA 8 bundle. `tests/rebuild/engine_audio_browser.py` compares offline render levels. These checks prove the port, not the music; listening stays with a person.
