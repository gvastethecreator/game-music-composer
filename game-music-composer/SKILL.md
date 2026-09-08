---
name: game-music-composer
description: "Compose, arrange, inspect and refine original game music. Neo-SPC scores, MIDI and audio; playable instrument viewers, phrase/role performance, genre research and independent composition labs. Use for memorable motifs, loops, soundtrack direction and $game-music-composer."
---

# Game Music Composer

Compose original music with a recognizable identity, purposeful form, instrumental roles and useful loops. Preserve a good idea while revising a named dimension. Clear writing comes before density, humanization or mastering.

Run commands from this skill directory and keep generated projects outside it. All JSON, MIDI and viewer helpers use Python's standard library; native audio rendering needs the optional extras and FFmpeg. The browser viewer needs Web Audio and Workers, not an API, account or Node installation.

## Capabilities: distinguish production from exploration

| Path | Implemented | Do not claim |
|---|---|---|
| `scripts/neospc.py` | Existing init/compose/validate/review/audit-bank/export-midi/render. One 8–32-bar cue per seed, 8/12/16/24/32 voice profiles. | General ambient-process engine, arbitrary localized recompose, or fully wired harness controls. |
| `scripts/visualize_score.py` | Standalone instrument + piano-roll viewer from a composition/catalog; five independent demo generators. | Native/Factory Bank audio parity, physical fingering, DAW editing or production stems. |
| `scripts/refine_performance.py` | Opt-in phrase/role timing, gate and velocity changes on native composition/catalog JSON; written event structure preserved and hashed. | New melody/harmony/form, universal humanization, authenticity or automatic artistic approval. |

Full canonical composing, bank assignment, mix and export procedure: read [canonical-compose-workflow.md](references/canonical-compose-workflow.md) when composing or delivering. Its original ambient/variation limitations refer to the native engine, not to the separate browser experiments. Viewer and interpretation details: [49-ensemble-atelier.md](references/49-ensemble-atelier.md). Research and anti-rigidity method: [50-composition-direction.md](references/50-composition-direction.md).

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

Inspect the plan before composing. A scale, BPM and arpeggiator are not a sufficient brief. Specify phrase purpose, cadence, bass behavior, groove, silence, section functions and return. Follow macroform → phrase → rhythm/rests → structural pitches → bass/harmony → counterlines → performance → mix.

Use voice budgets as ceilings, never constant fill targets. A 32-voice score does not imply 32 MIDI channels. Prefer fewer independent roles over unison padding. Preserve intentional dissonance, pedal and recurrence rather than optimizing every note to a heuristic.

## Make the score visible and playable

```bash
python scripts/visualize_score.py --input ../my-cue/composition.json --output ../my-cue/atelier.html
python scripts/visualize_score.py --input ../my-cue/catalog.json --cue-index 0 --output ../my-cue/catalog-preview.html
```

Every track receives an instrument surface, exact note pads, mute/solo, attack history and piano-roll events. The enlarged view improves inspection. The illustration is schematic: breath/valve/bow motion is explanatory, not physically valid fingering. Track VEL displays note velocity; the separate master scope reads actual synthetic audio samples. Never present either as measured LUFS/true peak.

The HTML re-synthesizes original sketch timbres. It does not carry samples, CC/bus routing or all Neo-SPC performance data; import reports state losses/fallbacks. Browser session JSON is not a canonical Neo-SPC composition. Keep the original file authoritative. A screenshot or passing browser test is not a listening approval.

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
```

Use a NEW native-render output directory for each revision: the existing renderer can reuse stale OGG/MP3 by file existence. Its source bank is not made equivalent to Factory Live by a `factory_patch` label. MIDI channel/retrigger limitations also remain tracked. Do not call those production defects solved by this viewer/refinement increment.

Required delivery: concrete plan, harness, canonical score/catalog, exact engine/seed/backend, Type-1 MIDI when valid, WAV/OGG/MP3 when available, symbolic and bank reports, provenance/licensing, and optionally the HTML viewer plus refinement report. Name blocked formats/dependencies and exact retry commands. Keep approval false until supported; distinguish technical validation, independent listening and game integration.

Compare the same fixtures with fresh outputs and level-controlled listening. Keep failures, intentional repetitions and genre exceptions visible. A single 0–100 symbolic score is diagnostic, not a composer, originality certificate or listener preference.
