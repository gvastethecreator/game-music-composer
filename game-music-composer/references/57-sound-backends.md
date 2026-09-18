# Sound backends, plans and receipts

Canonical JSON is the score. MIDI, compact/multisample WAV, FluidSynth, Studio preview and console VGM/SPC are adapters. Instrument names only suggest a role. Every substitution is written into a sound plan and a render receipt.

Do not convert MIDI into the internal score. Do not invent a loop on unlooped percussion. A missing bank is an error unless `--allow-fallback` is explicit; then the receipt records the fallback. Human listening stays pending.

## Sound plan

`scripts/sound_plan.py` plus `data/bank-registry.schema.json` and `data/bank-registry.template.json`.

Each bank record lists id, name, hash, format, engine, provenance, license, redistribution, presets (bank/program, range, percussion) and known losses (loops, layers, CC, articulations).

A resolved plan per track records:

- musical role;
- timbral source (bank + preset);
- interpretation (gate/CC);
- constraints (Neo-SPC vs console voices). An SF2 never enters an SPC.

```bash
python scripts/neospc.py inspect-bank PATH.sf2
python scripts/neospc.py sound-plan CATALOG.json --sf2 PATH.sf2 --map MAP.json --output sound-plan.json
python scripts/neospc.py render CATALOG.json OUT --backend soundfont --bank PATH.sf2 --sound-plan sound-plan.json
```

`--map` is explicit `inst -> {bank, program}`. Do not assume General MIDI. Percussion uses channel 10 only when the inspected preset is bank 128. Other kits stay on melodic channels.

`data/backend-honors.json` scores the `soundfont` backend as hint for roster/energy and none for LUFS, buses and MIDI ports.

Packaging skips `.sf2`, `.sf3`, `.dls`, `private-banks/` and `spessasynth/`. Never ship William Kage banks, game rips or operator SoundFonts.

## Receipts and cache (stage 0)

`render_mix_v4.py` and `render_soundfont.py` hash score + map + effective bank + engine/version + effects + sample rate. Skip only when `{id}.receipt.json` matches that fingerprint and the required audio files exist. Changing the bank invalidates audio.

Each cue writes `{id}.receipt.json`. The batch writes `render-receipt.json` with backend, bank id, skipped vs regenerated, fallback text and `listening_approval: pending`. Approval is never inferred.

Console output reports role collapse: 54 score roles onto N inspected presets.

## FluidSynth (stage 1)

Optional. Doctor lists FluidSynth as an extra, not a skill error. Missing binary: tests skip with a message.

Dry render:

```text
fluidsynth -ni -F wav -r 32000 -R 0 -C 0 BANK.sf2 CUE.mid
```

Keep the MIDI that fed that WAV beside it. Chorus and reverb stay off in dry tests. Do not chain a second mix unless a later decision says so.

Same SF2 through FluidSynth and SpessaSynth is not the same PCM. The receipt records backend, version, sample rate and effects.

Node is not a Python-core dependency. libOPNMIDI is not integrated; Mega Drive still uses the VGM writer in `console_soundpack.py`.

Tests generate a tiny legal SF2 (looped sine bank 0/program 0, unlooped noise bank 128/program 0). They never load a commercial or game SoundFont.

## Studio preview (stage 2)

Atelier default remains compact `voiceSamples`. Opt in to `soundfont` with a local File-API SF2.

SpessaSynth is not vendored in the skill ZIP. Copy it next to the generated HTML as `spessasynth/` (no CDN). Without the library the compact palettes stay active and the UI says so.

Catalog masters, Chamber, Velvet, Circuit, Timber, Prism and Voltage do not swap when the live preview engine changes. Sketch WAV export stays on the compact engine.

Compare the same cue at comparable LUFS: compact, `--factory-dir` Chamber, local SF2. Judge attack, sustain, register, articulation and fit. Do not add more oscillator palettes. Production Neo-SPC remains Chamber CC0 plus existing original synthesis.

1.7 s console captures in Studio have no sustain loop. Do not present them as hardware sustain. Long notes in the sample renderer pad with silence unless a loop is declared.

## Console writers (stage 3)

`scripts/console_soundpack.py` (the GitHub `tools/build_console_banks.py` builder is not in the portable skill).

| Console | Native file | Voices | Notes |
|---|---|---|---|
| Mega Drive | VGM | 6 FM + 3 PSG tone + noise | Patches from `data/megadrive-fm-presets.json`. No DAC, no pitch macros. `--fm-json` reloads the table. |
| SNES | SPC | 8 DSP | Synthetic BRR or `--brr-dir` with `directory.json` + `.brr`. `--brr-filter 0` remains the implemented encoder. RAM overflow is an error. An SF2 never enters an SPC. |
| NES | VGM 1.61 | 2 pulse + triangle + noise | `data/nes-2a03-macros.json`. DMC absent. Overflow is an error. Not a SoundFont labelled NES original. |

WAV via FFmpeg/libgme when present; otherwise tests validate the stream bytes.

```bash
python scripts/console_soundpack.py nes ../nes-demo.vgm
python scripts/console_soundpack.py snes ../snes-demo.spc --brr-dir ../my-brr --brr-filter 0
python scripts/console_soundpack.py megadrive ../md-demo.vgm --fm-json data/megadrive-fm-presets.json
```

## Comparison checklist

Same cue, named backend, named bank hash, receipt present:

1. compact original bank;
2. Chamber via `--factory-dir`;
3. local SF2 via FluidSynth (dry);
4. optional Studio live SF2 (not a master).

Keep listening pending until a person listens.
