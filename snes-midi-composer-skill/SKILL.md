---
name: neospc-music-composer
description: Compose, arrange, humanize, mix, audit and export evolved-SNES music with semantic JSON, expressive MIDI, sample-based rendering, the Neo-SPC Factory Bank, a deterministic generation harness and role-based voice architectures from 8 to 32 voices.
version: 3.1.0
---

# Neo-SPC Music Composer

Use this skill to create original game music that preserves the economical, sample-based clarity of SNES writing while allowing modern polyphony, expressive MIDI and a more capable production pipeline.

Neo-SPC is an **evolved retro system**, not strict SPC emulation. It keeps concise samples, memorable motifs, loop-aware form and readable instrumental roles, but permits 8–32 voices, richer ensembles, modern mix buses and browser playback.

## Non-negotiable workflow

### 1. Write a composition contract

Declare before generating notes:

- game function and scene;
- category, subgenre and emotional thesis;
- meter, tempo center and phrase grid;
- scale or pitch collection;
- harmonic language and progression plan;
- formal architecture;
- rhythmic identity and silence budget;
- bass family and behavior;
- voice architecture;
- timbre palette;
- loop strategy.

Never start with an arbitrary scale plus an arpeggiator.

### 2. Build the core reduction

The cue must first work with:

1. identity gesture or melody;
2. bass or harmonic foundation;
3. essential harmony or counterpoint;
4. core rhythmic identity.

Do not use ensemble layers, chorus, reverb or loud mastering to hide a weak reduction.

### 3. Choose a voice architecture

Read `data/voice-architecture-profiles.json`.

- `legacy_8`: strict, sparse and hardware-aware.
- `compact_12`: chamber-sized retro ensemble.
- `expanded_16`: recommended default.
- `ensemble_24`: layered action, choir, orchestra or electronic arrangement.
- `symphonic_32`: exceptional dense counterpoint, orchestra or climax.

A budget is a ceiling, not a target. Additional voices must have a formal function.

### 4. Compose hierarchically

Use this order:

```text
macroform
→ section function
→ phrase function and cadence
→ rhythmic skeleton and rests
→ structural melody notes
→ bass direction
→ harmony and voice leading
→ counterlines and texture states
→ expressive performance
→ mix and master
```

### 5. Use the deterministic generation harness

Load:

- `data/generation-harness.json`
- `data/scale-library.json`
- `data/chord-progression-library.json`
- `data/pattern-preset-library.json`
- `schemas/generation-harness.schema.json`

The harness contains:

- 60 scales and pitch collections;
- 142 categorized progression recipes;
- 87 pattern/performance presets;
- controls for harmony, arp, bassline, humanization, chop, mix and transport.

Harness controls are **constraints**, not a substitute for composition. Seeded variation must preserve phrase function, harmonic targets and genre identity. Avoid unbounded randomization.

### 6. Select a real bass family

Do not route every low part to one generic sample. Use semantic routing:

- upright bass: jazz, folk, intimate adventure and narrative music;
- electric finger bass: towns, soul, funk and warm social cues;
- picked bass: rock, combat and aggressive rhythmic writing;
- analog bass: electronic and sci-fi;
- sub bass: horror, pressure and selected electronic cues;
- bowed contrabass: classical, sacred, tragic and sustained orchestral writing.

Check `data/mix-bus-profiles.json` and `resources/original-sample-bank/sample-bank.json`.

### 7. Resolve instruments through the Factory Bank

Load:

- `data/factory-bank-manifest.json`;
- `data/factory-bank-role-map.json`;
- `schemas/soundbank-plan.schema.json`;
- `references/48-factory-bank-integration.md`.

Choose patches by role, register, velocity response, articulation and era profile. `neo16` is the default web/live profile; `neo32` is the expanded render profile. The composition must declare a soundbank plan before rendering.

Do not use a patch outside its documented range without an explicit reason. Use multisample zones and velocity layers rather than stretching a single root across the complete instrument range.

### 8. Humanize by phrase and role

Humanization is correlated musical behavior, not independent jitter.

Use:

- phrase push and cadential relaxation;
- role-specific timing placement;
- velocity arcs;
- breathing gaps;
- alternating articulation;
- chord staggering and strum direction;
- selective ensemble detune;
- instrument-specific vibrato and release;
- ghost notes that support, rather than obscure, the groove.

### 9. Enrich fast-tempo cues selectively

Load `data/fast-tempo-detail-rules.json`.

Above 140 BPM, add detail only to roles that can carry it:

- arp, motor, ostinato or pulse;
- hats, shaker, tom or snare;
- phrase-end fills;
- occasional retriggers and ratchets.

Do not double the note density of every track. Rapid material needs velocity hierarchy, rests and sectional contrast.

### 10. Mix by function, not raw event gain

Mandatory order:

1. calibrate source samples;
2. route events to `lead`, `bass`, `drums`, `rhythm`, `harmony`, `atmosphere` or `fx`;
3. apply instrument-specific trim;
4. EQ and compress each bus separately;
5. protect foreground priority;
6. open kick/bass space where appropriate;
7. measure loudness and peak headroom;
8. apply the master ceiling.

Load:

- `data/instrument-calibration.json`
- `data/mix-bus-profiles.json`
- `data/mix-audit-v2.2.json`

Important fixes in Mix v3:

- horn, brass, trumpet, synth lead, pulse and bell receive negative trims;
- drums receive stronger bus targets and parallel body/transient support;
- bass receives low-frequency reinforcement and category-aware samples;
- pads and harmony yield gently to the lead;
- master monitor level and output ceiling remain separate controls.

### 11. Export expressive MIDI

Separate responsibilities:

- **CC7**: track balance;
- **velocity**: attack weight and articulation;
- **CC11**: phrase/section expression;
- **CC10**: pan;
- **CC91**: spatial send.

Velocity must consider role, meter, phrase, cadence, repeated notes, ghost-note status and instrument response. It must not be a direct copy of audio gain.

### 12. Audit composition and production separately

Composition checks:

- harmonic legality;
- melodic continuity;
- voice leading;
- rhythmic purpose and repetition limits;
- genre identity;
- form and sectional contrast;
- pairwise novelty;
- instrumental range and semantic fit;
- loop seam.

Production checks:

- sample calibration;
- bus routing;
- masking and priority;
- loudness and peak ceiling;
- MIDI velocity range and expression data;
- missing/corrupt assets.

A technical pass does not certify artistic quality. Keep `curated`, `review` and `rebuild` states honest.

## Required deliverables

Minimum package:

- semantic composition JSON;
- Type-1 MIDI;
- OGG/WAV preview;
- MP3 browser fallback;
- mix and MIDI audit;
- sample provenance manifest;
- optional static Web Audio showcase.

MIDI is not the complete source of truth. Sample identity, fine tuning, envelopes, role metadata, bus routing and some performance data remain in JSON.

## Anti-patterns

Reject:

- low piano used as a generic bass;
- all instruments sharing the same raw gain;
- horns or synths winning because their samples are intrinsically louder;
- drums mixed as background decoration in rhythm-driven music;
- velocity copied directly from gain;
- constant arpeggiation used as arrangement;
- fast notes added indiscriminately to all roles;
- the same root–fifth bassline across unrelated genres;
- identical timing/velocity/pan on doubled voices;
- 24–32 voices active permanently without formal reason;
- a cue that only works after reverb, chorus or limiting;
- chromatic notes introduced accidentally by pattern transposition.

## Benchmark

`data/neospc100-benchmark.json` contains 100 studies across ten categories. Use it as a test corpus for system evaluation, never as a phrase library to copy.

---

## V3: full harness and independent professor review

Before rendering any final cue:

1. Create a complete harness instance using `data/generation-harness-v3.json`.
2. Generate a core reduction that remains coherent without pads, effects or mastering.
3. Generate the full arrangement and expressive performance.
4. Run `scripts/professor_review.py` on the symbolic catalog.
5. Apply `scripts/apply_professor_revisions.py` only to the prescribed dimensions.
6. Run the review again. Preserve both reports.
7. Do not label a cue approved when the final score is below the configured review threshold.
8. Render, export MIDI, and perform mix QC only after the compositional gate.

The review must remain independent from loudness, sample quality and visual presentation. A polished renderer may not promote a weak composition.
