# Rebuild decisions

Decisions taken while integrating the UMBRA 8 musical engine into Game Music Composer. The private handoff package lives outside Git (`GMC-Rebuild-Handoff-v1/`, ignored).

## ADR-00 · Scope and order (2026-09-24)

The owner listened to UMBRA 8 and judged it clearly superior to the current Create output. The goal is the full handoff plus three review additions:

1. Say which output is being fixed. The browser Create path and the native catalog are different engines; both get work, in that order.
2. Ship audible fixes first (P0 mix/drum policy), then the composition and synthesis engine, then UI, game runtime and export.
3. Listening with the owner decides later phases. Symbolic checks never stand in for it.

Work happens on the local branch `rebuild/umbra-integration`, one commit per phase. No push or PR without an explicit request.

## ADR-01 · Port UMBRA's engine as GMC modules, verified against the original

UMBRA's music core (theory, generator, arpeggiator, performance, synthesis, mix, transport, export) is ported into GMC-owned classic scripts that load over `file://` and in Node. Its layered monkey patches are flattened into final functions.

Fidelity is proven, not asserted:

- Event golden files: the original UMBRA 8 bundle runs headless in Node (inert DOM stubs) and writes `scoreEvents` signatures for every preset and several seeds. The port must match them exactly.
- Audio: the same project is rendered offline by the original and by the port in one browser; buffers are compared.

The WORKBENCH shell and vendors are not copied (`UNLICENSED`). GMC gets its own controls.

## ADR-02 · One event compiler, two runtimes

The JavaScript compiler is the single source of musical decisions for the browser. The Python skill gets a direct port of the same compiler, held to the same golden files, so the CLI keeps working without a browser.

## ADR-03 · P0 live-engine policy

- `track_mix[inst] = {gain, send}` carries authored balance. Gain is linear, neutral 1, and 0 is silence. The channel gain is `fader^1.35 × gain`; velocity and sample-layer choice never change.
- Sends are post-fader. Precedence: event `send` → track `send` → dry. The historical law is kept: sample voices `send × .45` (cap .45), chip voices `send × .22` (cap .3).
- Drum playback: `oneShot` by default (the sample body after offset and rate, capped at 6 s, 12 ms edge fade). `gated` follows written length. `legacy` keeps the 0.16-beat gate and is selectable per event, per instrument (`playback`) or engine-wide (`setDrumPolicy('legacy')`).
- Chokes: closed hats (`hat`, `closed_hat`) cut earlier open hats (`open_hat`, `open`) in group `hats` at the closing hit. Voices that start at the same instant survive. `choke_group`/`chokes` override the default.
- Sample offsets past the buffer fail before playback instead of replaying from zero.
- Atelier sketches keep their D-tonic convention; the bridge labels it `key_source: "atelier-default"` and records the generator.

## ADR-04 · How the engine was ported (2026-09-25)

`game-music-composer-showcase/engine/core.js` holds UMBRA 8's music core: dictionaries, composer, harmony parser and library, arpeggiator and chop templates, performance timeline, clips and sections, macros and automation, Random/Chaos candidates, project validation and migration (UMBRA v1–v8), synthesis, offline render, WAV, MIDI and session ZIP.

- Source: the UMBRA 8 bundle built from the private handoff (`umbra8-source/build.py`, so its verified text patches are included). Top-level blocks were selected by rule: UI, DOM, WORKBENCH, canvas and shell code stay out. The rest runs unchanged inside one closure with no globals.
- UMBRA's own UI calls (toast, render, persist, undo) became host hooks. Undo keeps UMBRA's limits (32 states, 32 MB).
- Layer chains (`x=function(){...xBefore(...)}`) are now private to the closure. They are flattened only when a change touches them, with the golden tests as the safety net. Rewriting 250 KB of verified code by hand now would add risk without changing a note.
- The player is GMC's own, following UMBRA's scheduler: AudioContext clock, 25 ms timer, 0.16 s lookahead, per-step automation.
- Verification: `tests/rebuild/engine_golden.test.cjs` replays 193 scenarios and compares them with the reference signatures in `tests/rebuild/fixtures/umbra8-golden.json`. `tests/rebuild/engine_audio_browser.py` renders six presets offline in Chromium and compares level metrics.
- Labels and messages are still UMBRA's Spanish text. The GMC UI maps what it shows.

## ADR-05 · Create is the first view (2026-09-25)

- A new **Create** tab opens first for new visitors; a shared `?cue=` link still opens Studio, and saved preferences win. Create runs on `GMCEngine` with its own player; Studio keeps the sample-bank engine. The two never play at once.
- Essential shows the short path: style, play, New song, Variation, Chaos, idea slots A–D, tracks (mute, solo, lock, regenerate, timbre, level), harmony and a score view of every track. Studio adds the track inspector, performance templates, composition, master, macros and song building.
- New song stores the previous song in a free idea slot (UMBRA's behaviour); the notice says which one.
- **Open in Studio** converts the engine song through `engine/native-bridge.js`: every scoreEvents() note becomes a native event (written beat on a 1/48 grid, exact played beat in `performance_beat`), each timbre maps to the closest sampled studio instrument, track volume and send travel as `track_mix`. Songs above 32 simultaneous notes are refused with a reason.
- Engine labels, generated names and messages are Spanish in the core. `engine/labels-en.js` translates what the view shows; the verified core is untouched.
