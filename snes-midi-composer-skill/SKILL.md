---
name: neospc-music-composer
description: "Compose, arrange, review, render, and export original SNES-inspired game music. Use for game-cue briefs, loop-ready scores, MIDI, soundbank planning, or composition audits."
---

# Neo-SPC Music Composer

Create original game music with clear roles, short sample identities, memorable motifs and useful loop behavior. Choose a voice ceiling from 8 to 32. Use `legacy_8` for hardware-style limits. Use the expanded profiles for modern browser and production work.

Run commands from this skill directory. Keep generated project files outside the skill folder.

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

3. Review every descriptive field in `composition-plan.json` and edit any wording that misses the scene. Keep every quality gate `false` until evidence supports it.

4. Tune `generation-harness.json` only after the plan states the scene, emotional change, form, motif, bass behavior, groove, silence budget and loop strategy.

5. Validate both files before writing notes:

```bash
python scripts/neospc.py validate ./my-cue/composition-plan.json ./my-cue/generation-harness.json --strict
```

6. Create the first complete score draft:

```bash
python scripts/neospc.py compose ./my-cue
python scripts/neospc.py validate ./my-cue/composition.json ./my-cue/catalog.json --strict
```

`compose` uses the plan, all harness controls and the declared seed. It writes a single composition plus a one-cue catalog for the review, bank, MIDI and render commands. It refuses to replace either output unless you pass `--force`. Treat the result as a scored draft: inspect the reduction, form, ranges, density and loop before approval.

## Route the request

- **Compose an original cue:** follow the complete workflow below.
- **Arrange supplied material:** preserve the requested identity, declare every changed dimension, then re-run range, voice, loop and expression checks.
- **Audit existing JSON or MIDI:** diagnose composition, performance and production separately. Do not rewrite unless the user asks.
- **Target strict hardware character:** choose `legacy_8`, keep the measured peak at eight, limit samples and effects, and label the result hardware-inspired unless an SPC toolchain proves stricter claims.
- **Create an expanded web cue:** prefer `expanded_16`; add voices only when each one has a section or phrase function.
- **Build or test a corpus:** use seeded harness files, preserve inputs and outputs, and compare every revision on the same fixtures.

## Compose in this order

### 1. Write the contract

Declare:

- game function and scene;
- category, subgenre and emotional change;
- meter, tempo center and phrase grid;
- scale or pitch collection;
- harmonic language and cadence plan;
- formal sections and loop seam;
- rhythmic identity and silence budget;
- bass family and behavior;
- voice ceiling and role architecture;
- timbre palette and render target.

Reject a brief that consists only of a scale, tempo and arpeggiator.

### 2. Prove the core reduction

Write and inspect these roles first:

1. identity gesture or melody;
2. bass or harmonic foundation;
3. essential harmony or counterpoint;
4. core rhythmic identity.

The reduction must work without pads, ensemble doubling, reverb, chorus or limiting.

### 3. Choose a voice architecture

Read `data/voice-architecture-profiles.json`.

- `legacy_8`: sparse hardware-style writing.
- `compact_12`: chamber and intimate cues.
- `expanded_16`: default for most work.
- `ensemble_24`: layered action, choir or orchestra.
- `symphonic_32`: dense counterpoint and rare climaxes.

Treat the budget as a ceiling. State the job of every extra voice.

### 4. Build hierarchy before detail

Use this sequence:

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

Read these sources only when the current step needs them:

- harmony: `data/scale-library.json` and `data/chord-progression-library.json`;
- patterns: `data/pattern-preset-library.json`;
- category behavior: `data/category-benchmark-contracts.json`;
- fast cues: `data/fast-tempo-detail-rules.json`;
- full controls: `data/generation-harness-v3.json`.

Use seeded values as constraints. Preserve phrase purpose, harmonic targets and genre identity across variants.

### 5. Assign instruments by role

Read:

- `data/factory-bank-manifest.json`;
- `data/factory-bank-role-map.json`;
- `data/voice-budget-modes.json`;
- `references/48-factory-bank-integration.md`.

Choose patches by role, register, velocity response, articulation and era profile. Use `neo16` for browser playback and `neo32` for expanded renders. Declare the assignment before rendering.

Use a bass family that fits the cue:

- upright for jazz, folk and intimate adventure;
- electric finger for towns, soul and funk;
- picked for rock, combat and hard rhythmic work;
- analog for electronic and science fiction;
- sub for pressure, horror and selected electronic cues;
- bowed contrabass for tragic, sacred and orchestral writing.

Keep notes inside patch ranges. Use multisample zones and velocity layers when the bank provides them.

### 6. Humanize musical behavior

Apply correlated phrase and role behavior:

- phrase push and cadence relaxation;
- role-specific timing placement;
- velocity arcs and repeated-note variation;
- breathing gaps;
- alternating articulation;
- chord staggering and strum direction;
- selective detune for ensembles;
- instrument-specific vibrato and release;
- ghost notes that support the groove.

At fast tempos, add detail to selected motors, percussion and phrase endings. Keep rests and velocity order. Avoid raising the note rate of every track.

### 7. Mix by function

Use this order:

1. calibrate sources;
2. route `lead`, `bass`, `drums`, `rhythm`, `harmony`, `atmosphere` and `fx`;
3. apply instrument trim;
4. shape each bus;
5. protect foreground priority;
6. leave kick and bass space where needed;
7. measure loudness and peak headroom;
8. apply the output ceiling.

Read `data/instrument-calibration.json`, `data/mix-bus-profiles.json` and `data/mix-audit-v2.2.json`.

Keep MIDI duties separate:

- CC7: track balance;
- velocity: attack weight and articulation;
- CC11: phrase and section expression;
- CC10: pan;
- CC91: spatial send.

## Validate and export

`compose` creates `catalog.json` with the new cue under `styles`. Add other complete compositions to that array when you need a batch. Each composition must match `schemas/neospc-composition.schema.json` and declare form, chords, events and instruments.

Run the gates in this order:

```bash
python scripts/neospc.py validate ./my-cue/catalog.json --kind catalog --strict
python scripts/neospc.py review ./my-cue/catalog.json ./my-cue/review.json
python scripts/neospc.py audit-bank ./my-cue/catalog.json --output ./my-cue/bank-audit.json
python scripts/neospc.py export-midi ./my-cue/catalog.json ./my-cue/midi
python scripts/neospc.py render ./my-cue/catalog.json ./my-cue/audio
```

`review` runs a deterministic symbolic rubric. It checks score structure, phrase behavior, genre signals, orchestration and expression. It does not provide human judgment or a fresh independent review. Use a separate reviewer when the user needs independent artistic judgment.

`render` needs `numpy`, `soundfile`, `pyloudnorm`, `scipy` and an available FFmpeg command. Install the Python extras with `python -m pip install -r requirements-render.txt`. The other canonical commands use the Python standard library. If render dependencies are missing, deliver valid JSON and MIDI, name the blocked audio formats and give the exact retry command.

Preserve every review report. Revise only the dimensions named by the report. Re-run validation and review after each revision. Keep `approved`, `revise` and `rebuild` labels honest.

## Required output

For a complete cue, deliver:

- composition plan;
- full harness instance;
- semantic composition JSON;
- Type-1 MIDI;
- WAV or OGG preview plus MP3 browser fallback when rendering is available;
- symbolic review report;
- Factory Bank assignment audit;
- sample provenance and license note.

Treat JSON as the main source. MIDI cannot retain every sample, envelope, role, bus and performance detail.

## Final checks

Audit composition and production separately.

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
- novelty against the benchmark without copying it.

Production:

- source calibration and provenance;
- bus routing, masking and foreground order;
- loudness and peak ceiling;
- MIDI velocity range and expression data;
- missing or corrupt assets;
- playable Factory Bank ranges.

Reject generic bass substitution, uniform gain, constant arpeggiation, copied benchmark phrases, identical doubled voices, permanent maximum density, accidental chromatic notes and mixes that rely on mastering to hide a weak reduction.

Use `data/neospc100-benchmark-v4.1.json` only as an evaluation corpus and worked structure reference. Never use it as a phrase source.
