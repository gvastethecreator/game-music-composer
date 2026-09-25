---
name: game-music-composer
description: "Compose, arrange, inspect and refine original game music. Neo-SPC scores, MIDI and audio; playable instrument viewers, phrase/role performance, genre research and independent composition labs. Use for memorable motifs, loops, soundtrack direction and $game-music-composer."
---

# Game Music Composer

Compose original music with a recognizable identity, purposeful form, instrumental roles and useful loops. Preserve a good idea while revising a named dimension. Clear writing comes before density, humanization or mastering.

Run commands from this skill directory and keep generated projects outside it. All JSON, MIDI and viewer helpers use Python's standard library; native audio rendering needs the optional extras and FFmpeg. The browser viewer needs Web Audio and Workers, not an API, account or Node installation.

## Phrase Studio writing and sound palettes

For a fresh composition, prefer a written `score-blueprint.json` beside the plan and harness. `neospc.py compose` consumes it through `phrase_composer.py` or the category-specific `genre_composer.py`. Read `references/51-phrase-studio.md` for the shared contract. The Studio has 240 cues in 24 categories: 100 Phrase Studio scene scores plus 14 groove packs of ten. Category order is genre-first; `init` defaults to `salsa`. Init writes an editable blueprint for every groove category; read `references/52-genre-expansion.md` for writing rules. Scene categories stay game-function cues, not extra dance packs.

Do not present a seed change, phrase-length shuffle, symbolic score, or new soundbank as proof of better music. Write the subject and its answer first. Compare a sparse reduction, a groove-led version, and a contrasting response before expanding a corpus. Use the same level and palette for comparisons. Retain human listening as pending until someone actually listens.

Studio has six production palettes: Chamber (CC0 recorded instruments plus original synthesis), Velvet (tines and tape), Circuit (dual oscillators), Timber (modal bodies and excitation), Prism (FM) and Voltage (band-limited subtractive synthesis). Read [53-resonant-soundbanks.md](references/53-resonant-soundbanks.md) for the new models, individual-patch CLI and native render setup. The catalog declares its palette; live playback and native masters select the same multisample regions. Effects and mastering still differ between backends. Compact and Chip remain separate previews. Credits and pinned recording sources are in `data/soundbank-provenance.json`.

For console soundpacks, read [54-console-soundpacks.md](references/54-console-soundpacks.md). `scripts/console_soundpack.py` writes original YM2612/PSG VGM, SPC700/S-DSP SPC and NES 2A03 VGM, with strict voice budgets. FFmpeg/libgme rendering is optional. Mega Drive and SNES in Studio are emulator-derived sample previews (1.7 s, no sustain loop). Never describe Studio mixing as chip emulation or claim physical-hardware equivalence without a measured comparison.

Sound plans, receipts, local SF2 and FluidSynth: [57-sound-backends.md](references/57-sound-backends.md). Canonical JSON stays the score. MIDI, WAV, SF2 and console files are adapters. Missing banks error unless `--allow-fallback`. Do not package operator or game SoundFonts.

Use [55-level-matching.md](references/55-level-matching.md) when editing banks or mix levels. Live playback, native multisample renders and auditions share measured source trims; preserve velocity relationships and regenerate calibration after changing samples.

## Capabilities: distinguish production from exploration

| Path | Implemented | Do not claim |
|---|---|---|
| `scripts/neospc.py` | init/compose/validate/review/audit-bank/inspect-bank/sound-plan/export-midi/render. One 8–32-bar cue per seed, 8/12/16/24/32 voice profiles. Render `--backend compact`, `multisample` or `soundfont` writes receipts. | General ambient-process engine, MIDI-as-canonical-score, or silent compact fallback when a bank is missing. |
| `scripts/visualize_score.py` | Standalone instrument + piano-roll viewer from a composition/catalog; five independent demo generators. Opt-in local SF2 preview; compact palettes remain default. | Native/Factory Bank audio parity, CDN SoundFonts, physical fingering, DAW editing or production stems. |
| `neospc.py create` · studio engine | Synthesis songs from 32 style presets (Create view engine): project, native score, catalog and MIDI; `create-render` synthesized WAV via local Chromium; `create-import` hears a native score through synthesis. Needs Node.js 18+ ([58-studio-engine.md](references/58-studio-engine.md)). | Odd meters, written blueprints, symbolic review, LUFS or listening approval. |
| `scripts/refine_performance.py` | Opt-in phrase/role timing, gate and velocity changes on native composition/catalog JSON; written event structure preserved and hashed. | New melody/harmony/form, universal humanization, authenticity or automatic artistic approval. |

Full canonical composing, bank assignment, mix and export procedure: read [canonical-compose-workflow.md](references/canonical-compose-workflow.md) when composing or delivering. Sound adapters: [57-sound-backends.md](references/57-sound-backends.md). Its original ambient/variation limitations refer to the native engine, not to the separate browser experiments. Viewer and interpretation details: [49-ensemble-atelier.md](references/49-ensemble-atelier.md). Research and anti-rigidity method: [50-composition-direction.md](references/50-composition-direction.md). Arrangement fields review can fail (energy drop, subtraction, roster exit, development, non-vocal hook): [56-arrangement-choices.md](references/56-arrangement-choices.md).

## Studio engine songs

For quick finished-sounding loops, or to hear a native score through synthesis instead of the sample banks, use the studio engine: `python scripts/neospc.py create ../dusk --preset lofi --seed DUSK`. It writes the engine project, a validated native score and catalog, and MIDI. Read [58-studio-engine.md](references/58-studio-engine.md) for presets, variation, rendering, import and limits (4/4 phrases, rule-based composer).

## Begin with musical decisions

Clarify game function, foreground versus background, emotional change, intended repetition, dialogue/SFX space and target backend. Ask only when the answer changes the music or delivery. Record assumptions; do not block exploration on plugin choices.

An open-ended request starts with three genuinely different reductions when practical. Change at least two structural dimensions: rhythmic cell, intervals/contour, phrase syntax, harmonic behavior or silence. Three seeds, keys or timbres alone are not three directions. Never borrow benchmark phrases or copyrighted recordings as original work.

After selection, record the protected core: notes/degrees, rhythm, accents, breath, anchor and destination. State which representation is locked; preserving scale-degree contour is not preserving absolute pitches. Revising one region does not authorize regenerating another. Current native compose has no universal lock/revise transaction; use explicit score edits and compare protected events.

## Native workflow

```bash
python scripts/neospc.py doctor --strict
python scripts/neospc.py init ../my-cue --title "Glass Harbor" --category mystery --game-context puzzle --mood mysterious --bpm 88 --meter 5/4 --key D --mode dorian --voices 12 --bars 16
python scripts/neospc.py validate ../my-cue/composition-plan.json ../my-cue/generation-harness.json --strict
python scripts/neospc.py compose ../my-cue
python scripts/neospc.py validate ../my-cue/composition.json ../my-cue/catalog.json --strict
```

Inspect the plan before composing. A scale, BPM and arpeggiator are not a sufficient brief. Specify phrase purpose, cadence, bass behavior, groove, silence, section functions, return, energy curve, one subtraction, roster entry/exit and a non-vocal hook. Follow macroform → phrase → rhythm/rests → structural pitches → bass/harmony → counterlines → performance → mix.

Use voice budgets as ceilings, never constant fill targets. A 32-voice score does not imply 32 MIDI channels. Prefer fewer independent roles over unison padding. Preserve intentional dissonance, pedal and recurrence rather than optimizing every note to a heuristic.

## Make the score visible and playable

```bash
python scripts/visualize_score.py --input ../my-cue/composition.json --output ../my-cue/atelier.html
python scripts/visualize_score.py --input ../my-cue/catalog.json --cue-index 0 --output ../my-cue/catalog-preview.html
```

Every track receives an instrument surface, exact note pads, mute/solo, attack history and piano-roll events. The enlarged view improves inspection. The illustration is schematic: breath/valve/bow motion is explanatory, not physically valid fingering. Track VEL displays note velocity; the separate master scope reads actual synthetic audio samples. Never present either as measured LUFS/true peak.

The HTML re-synthesizes original sketch timbres by default. An optional local SF2 uses File API plus a SpessaSynth copy next to the HTML (no CDN). Compact palettes and catalog masters stay intact when that preview is on. Import reports state losses/fallbacks. Browser session JSON is not a canonical Neo-SPC composition. Keep the original file authoritative. A screenshot or passing browser test is not a listening approval.

## Diagnose rigidity at the correct layer

First hear reduction, then arrangement, then game context. Separate repeated phrase topology, continuous accompaniment, inappropriate harmonic rhythm, identical entries and lifeless articulation. Do not fix weak composition by adding random timing errors or more notes.

Use the five optional experiments separately:

```bash
python scripts/visualize_score.py --demo instrumentarium --output ../labs/instrumentarium.html
python scripts/visualize_score.py --demo pocket --output ../labs/pocket.html
python scripts/visualize_score.py --demo conversation --output ../labs/conversation.html
python scripts/visualize_score.py --demo atlas --output ../labs/atlas.html
python scripts/visualize_score.py --demo cycles --output ../labs/cycles.html
```

Pocket compares identical written material. Conversation changes phrase/turn-taking and real rests. Atlas changes rhythm, accompaniment and melodic grammar independently. Cycles uses a verified common return period. These generators are implemented in browser code; they do not silently extend `neospc compose`. Explore/review does not imply user approval to alter production defaults.

## Refine interpretation without changing the written score

```bash
python scripts/refine_performance.py ../my-cue/catalog.json ../my-cue/catalog-performed.json --profile chamber --amount 0.5 --seed 2207
python scripts/neospc.py validate ../my-cue/catalog-performed.json --strict
python scripts/visualize_score.py --input ../my-cue/catalog-performed.json --output ../my-cue/performed-preview.html
```

Profiles are `chamber`, `pocket`, `ritual`: conservative design hypotheses, not simulations of all musicians. Always start from the original; cumulative refinement is rejected. `--amount 0` is a no-op. The report records a structural hash, boundary adjustments and pending listening. Overflow is an error, never silent deletion. Symbolic polyphony uses the existing .12-beat drum approximation and excludes release/sample tails.

This changes actual native performance fields, not just descriptive metadata. Validate/review the output and audition the real backend before approval. Do not substitute the synthetic preview for native render evidence.

## Review and deliver honestly

```bash
python scripts/neospc.py review ../my-cue/catalog-performed.json ../my-cue/review-performed.json
python scripts/neospc.py audit-bank ../my-cue/catalog-performed.json --output ../my-cue/bank-audit.json
python scripts/neospc.py export-midi ../my-cue/catalog-performed.json ../my-cue/midi-performed
python scripts/neospc.py render ../my-cue/catalog-performed.json ../my-cue/audio-performed-new
python scripts/neospc.py inspect-bank ../local-bank.sf2
python scripts/neospc.py sound-plan ../my-cue/catalog-performed.json --sf2 ../local-bank.sf2 --map ../my-cue/sf2-map.json --output ../my-cue/sound-plan.json
python scripts/neospc.py render ../my-cue/catalog-performed.json ../my-cue/audio-sf2 --backend soundfont --bank ../local-bank.sf2 --sound-plan ../my-cue/sound-plan.json
```

Review reports legality, identity, plan compliance and rigidity tells as separate numbers. Do not merge them. Score a backend only for fields it honors (`data/backend-honors.json`): Ensemble Atelier is not scored on LUFS; Type-1 MIDI is not scored on mix buses. Pass `--plan` when the catalog sits away from `composition-plan.json`.

Reuse audio only when `{id}.receipt.json` matches the content fingerprint (score, map, bank hash, engine, effects, sample rate). A changed bank regenerates. Missing Factory/SF2 paths error unless `--allow-fallback`, which is written on the receipt. A `factory_patch` label does not make compact samples equal Chamber. MIDI channel/retrigger limits remain. Do not treat viewer/SF2 preview as native render evidence.

Required delivery: concrete plan, harness, canonical score/catalog, exact engine/seed/backend, Type-1 MIDI when valid, WAV/OGG/MP3 when available, symbolic and bank reports, provenance/licensing, and optionally the HTML viewer plus refinement report. Name blocked formats/dependencies and exact retry commands. Keep approval false until supported; distinguish technical validation, independent listening and game integration.

Compare the same fixtures with fresh outputs and level-controlled listening. Keep failures, intentional repetitions and genre exceptions visible. A single 0–100 symbolic score is diagnostic, not a composer, originality certificate or listener preference. Plan compliance and rigidity-tell counts stay beside it; do not merge the three.
