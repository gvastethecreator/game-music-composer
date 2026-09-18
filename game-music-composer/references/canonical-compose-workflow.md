---
name: game-music-composer
description: "SNES game music: compose, arrange, review, render, export; 16-bit cues, loop-ready scores, MIDI, soundbank planning, composition audits, $game-music-composer."
---

# Game Music Composer

Original game music: clear roles, short sample IDs, memorable motifs, useful loops. Voice ceiling 8–32. `legacy_8` for hardware-style limits; expanded profiles for browser/production.

Engine CLI: `neospc.py`. One 8–32 bar loop-ready cue per seed. Ambient fields, polyrhythmic processes, variation banks are unwired; say so if asked, then write a strong short identity unless they only want a plan.

Run commands from this skill directory; keep generated files outside.

## Start with a real brief

1. Check the bundled system:

```bash
python scripts/neospc.py doctor --strict
```

2. Create a composition plan and full harness:

```bash
python scripts/neospc.py init ./my-cue \
  --title "Glass Harbor" \
  --category mystery \
  --game-context puzzle \
  --mood mysterious \
  --bpm 88 \
  --meter 5/4 \
  --key D \
  --mode dorian \
  --voices 12 \
  --bars 16
```

3. Review descriptive fields in `composition-plan.json`; edit wording that misses the scene. Quality gates stay `false` until evidence supports them.

4. Tune `generation-harness.json` only after the plan states scene, emotional change, form, motif, bass behavior, groove, silence budget, loop strategy.

5. Validate both files before writing notes:

```bash
python scripts/neospc.py validate ./my-cue/composition-plan.json ./my-cue/generation-harness.json --strict
```

6. Write the first complete score draft:

```bash
python scripts/neospc.py compose ./my-cue
python scripts/neospc.py validate ./my-cue/composition.json ./my-cue/catalog.json --strict
```

`compose` uses plan, harness and declared seed. Writes one composition plus one-cue catalog for review, bank, MIDI, render. Won't replace either output without `--force`. Inspect reduction, form, ranges, density, loop before approval.

## Route the request

- **Compose an original cue:** workflow below.
- **Arrange supplied material:** keep requested identity; declare every changed dimension; re-run range, voice, loop, expression checks.
- **Audit existing JSON or MIDI:** diagnose composition, performance, production separately. Rewrite only if asked.
- **Target strict hardware character:** `legacy_8`; measured peak eight; limit samples and effects; label hardware-inspired unless an SPC toolchain proves stricter claims.
- **Create an expanded web cue:** prefer `expanded_16`; add voices only when each has a section or phrase function.
- **Build or test a corpus:** seeded harness files; preserve inputs/outputs; compare every revision on the same fixtures.

## Compose in this order

### 1. Write the contract

Declare:

- game function and scene;
- category, subgenre and emotional change;
- meter, tempo center and phrase grid;
- scale or pitch collection;
- harmonic language and cadence plan;
- formal sections, loop seam and one development operation per section;
- rhythmic identity and silence budget;
- energy curve with a descent, or a named loop/drone/combat exemption;
- at least one subtraction event;
- roster entry/exit, with one role leaving before the end;
- a non-vocal arrangement hook;
- bass family and behavior;
- voice ceiling and role architecture;
- timbre palette and render target.

Read [56-arrangement-choices.md](56-arrangement-choices.md) when filling those fail-able arrangement fields. Quality gates stay `false` until evidence exists.

Reject a brief that is only scale, tempo, arpeggiator.

### 2. Prove the core reduction

Inspect first:

1. identity gesture or melody;
2. bass or harmonic foundation;
3. essential harmony or counterpoint;
4. core rhythmic identity.

Reduction must work without pads, ensemble doubling, reverb, chorus, limiting.

### 3. Choose a voice architecture

Read `data/voice-architecture-profiles.json`.

- `legacy_8`: sparse hardware-style writing.
- `compact_12`: chamber and intimate cues.
- `expanded_16`: default for most work.
- `ensemble_24`: layered action, choir or orchestra.
- `symphonic_32`: dense counterpoint and rare climaxes.

Budget is a ceiling. State every extra voice's job.

### 4. Build hierarchy before detail

Sequence:

```text
macroform
→ section purpose
→ phrase and cadence
→ rhythm and rests
→ structural melody notes
→ bass direction
→ harmony and voice leading
→ counterlines and texture states
→ expressive performance
→ mix and master
```

Read when the current step needs them:

- harmony: `data/scale-library.json` and `data/chord-progression-library.json`;
- patterns: `data/pattern-preset-library.json`;
- category behavior: `data/category-benchmark-contracts.json`;
- fast cues: `data/fast-tempo-detail-rules.json`;
- full controls: `data/generation-harness-v3.json`.

Seeded values are constraints: keep phrase purpose, harmonic targets, genre identity across variants.

`period`: antecedent/consequent — same idea, weak cadence, tonic close. `sentence`: 2+2+4 — idea, sequenced idea, continuation. Motif skeleton stays on home pitch class; only passing tones follow the chord. Contrast: related answer motif + different accompaniment, not an inversion of the same cell. Harness melody knobs (`contour`, `tessitura`, `range_semitones`, `max_leap`, `rest_ratio`) reach the writing engine. Review splits legality, identity, plan compliance and rigidity tells: tiling the same cell or sitting too close to another catalog cue fails identity even if writing is legal. Compliance and tell counts stay separate from that diagnostic score.

### 5. Assign instruments by role

Read:

- `data/factory-bank-manifest.json`;
- `data/factory-bank-role-map.json`;
- `data/voice-budget-modes.json`;
- `references/48-factory-bank-integration.md`.

Patches by role, register, velocity response, articulation, era profile. `neo16` for browser playback; `neo32` for expanded renders. Declare assignment before rendering.

Bass:

- upright: jazz, folk, intimate adventure;
- electric finger: towns, soul, funk;
- picked: rock, combat, hard rhythmic work;
- analog: electronic, science fiction;
- sub: pressure, horror, selected electronic cues;
- bowed contrabass: tragic, sacred, orchestral writing.

Notes stay inside patch ranges; use bank multisample zones and velocity layers when provided.

### 6. Humanize musical behavior

Phrase and role behavior:

- phrase push and cadence relaxation;
- role-specific timing placement;
- velocity arcs and repeated-note variation;
- breathing gaps;
- alternating articulation;
- chord staggering and strum direction;
- selective detune for ensembles;
- instrument-specific vibrato and release;
- ghost notes that support the groove.

Fast tempos: add detail to selected motors, percussion and phrase endings. Keep rests and velocity order; do not raise every track's note rate.

### 7. Mix by function

Order:

1. calibrate sources;
2. route `lead`, `bass`, `drums`, `rhythm`, `harmony`, `atmosphere` and `fx`;
3. apply instrument trim;
4. shape each bus;
5. protect foreground priority;
6. leave kick and bass space where needed;
7. measure loudness and peak headroom;
8. apply the output ceiling.

Read `data/instrument-calibration.json`, `data/mix-bus-profiles.json` and `data/mix-audit-v2.2.json`.

MIDI duties:

- CC7: track balance;
- velocity: attack weight and articulation;
- CC11: phrase and section expression;
- CC10: pan;
- CC91: spatial send.

## Validate and export

`compose` writes `catalog.json` with the new cue under `styles`. Add other complete compositions to batch. Each must match `schemas/neospc-composition.schema.json` and declare form, chords, events, instruments.

Gates:

```bash
python scripts/neospc.py validate ./my-cue/catalog.json --kind catalog --strict
python scripts/neospc.py review ./my-cue/catalog.json ./my-cue/review.json
python scripts/neospc.py audit-bank ./my-cue/catalog.json --output ./my-cue/bank-audit.json
python scripts/neospc.py export-midi ./my-cue/catalog.json ./my-cue/midi
python scripts/neospc.py render ./my-cue/catalog.json ./my-cue/audio
python scripts/neospc.py render ./my-cue/catalog.json ./my-cue/audio-sf2 --backend soundfont --bank ./local.sf2
```

`review`: deterministic symbolic rubric — score structure, phrase behavior, genre signals, orchestration, expression. Not human judgment or independent artistic review; use a separate reviewer.

Compact/multisample `render` needs `numpy`, `soundfile`, `pyloudnorm`, `scipy`, FFmpeg. SoundFont render needs FluidSynth on PATH (`-R 0 -C 0`). Install extras: `python -m pip install -r requirements-render.txt`. Other commands use the stdlib. Missing render deps: valid JSON and MIDI, name blocked audio formats, give the exact retry command. Each render writes receipts; skip only on fingerprint match. Read [57-sound-backends.md](57-sound-backends.md).

Keep every review report. Revise only named dimensions; re-run validation and review after each revision. Keep `approved`, `revise`, `rebuild` labels honest.

## Required output

Complete cue:

- composition plan;
- full harness instance;
- semantic composition JSON;
- Type-1 MIDI;
- WAV/OGG preview plus MP3 browser fallback when rendering is available;
- symbolic review report;
- Factory Bank assignment audit;
- sample provenance and license note.

JSON is the main source; MIDI cannot retain every sample, envelope, role, bus, performance detail. Export with `--sound-plan` writes bank MSB/LSB and program from the inspected map. Multi-port scores need `--adapt-ports` or a split. Percussion uses channel 10 only for bank 128 kits.

## Final checks

Composition:

- harmonic intent and pitch legality;
- melodic continuity and motif change;
- voice leading and role independence;
- rhythmic purpose and repetition;
- category identity;
- form and section contrast;
- instrumental range;
- measured voice peak;
- loop seam;
- novelty vs the benchmark without copying it.

Production:

- source calibration and provenance;
- bus routing, masking and foreground order;
- loudness and peak ceiling;
- MIDI velocity range and expression data;
- missing or corrupt assets;
- playable Factory Bank ranges.

Reject generic bass substitution, uniform gain, constant arpeggiation, copied benchmark phrases, identical doubled voices, permanent max density, accidental chromatic notes, mixes that hide a weak reduction via mastering.

Use `data/neospc100-benchmark-v4.1.json` only as an evaluation corpus and structure reference — never as a phrase source.

The full-catalog rebuild uses the 100 authored inputs in `data/catalog-contracts-r03.json`. Each input declares its game function, protected motif seed, phrase spans, A/B texture, harmonic hold, section intensity, written role rests and return. The corpus engine consumes these controls before performance refinement. This path does not claim to execute every field of the general plan/harness interface. In the source delivery, each cue has a complete seeded `composition-contract.json` and native `composition.json`, with both symbolic reviews and source hashes. The original benchmark event arrays are not used as phrase material.

Native MIDI assigns each melodic lane a unique port/channel pair. Scores with more than 15 melodic instruments need a player that honors MIDI Port metadata; a single-port hardware synth cannot reproduce every part simultaneously. Section expression uses declared intensity when present, including quieter returns. Coincident note-offs precede retriggers. These guarantees do not establish acoustic parity between General MIDI playback and the sample renderer.
