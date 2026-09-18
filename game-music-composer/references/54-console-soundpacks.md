# Mega Drive, SNES and NES soundpacks

These are separate original soundpacks. Their native files drive emulated hardware through FFmpeg's libgme demuxer when that extra is present. They are not the generic Chip Core oscillator bank. No game ROM, ripped soundtrack or commercial sample set is included. An SF2 never enters an SPC.

| Pack | Native path | Original material |
|---|---|---|
| Mega Drive | VGM 1.50 register stream, NTSC YM2612 at 7,670,454 Hz and PSG at 3,579,545 Hz | 12 four-operator FM patches from `data/megadrive-fm-presets.json`, PSG square tone and noise |
| SNES | SPC700 program, 64 KiB RAM image and S-DSP registers | 12 compact periodic BRR instruments and four BRR percussion samples, or `--brr-dir` externals |
| NES | VGM 1.61, 2A03 clock 1,789,773 Hz | Two pulse, triangle, noise. DMC absent. Macros in `data/nes-2a03-macros.json` |

The native Mega Drive writer allocates at most six FM voices, three PSG tones and one noise voice. This pack does not use the DAC channel, FM channel-3 special mode or register macros for pitch bends. libOPNMIDI is not integrated; it would not cover PSG/DAC or a strict profile. The native SNES writer allocates eight DSP voices, reserves sample and echo RAM, and rejects an oversized driver or sample set. The NES writer allocates two pulse, one triangle and one noise voice. Voice overflow is an error; the writer never silently drops notes. Retriggering a voice cuts its previous release. Leave space in the arrangement if that tail matters.

## Fidelity boundary

These files use actual emulation, but **bit-exact equivalence to physical hardware has not been established**. The installed FFmpeg/libgme version determines the emulator core and resampling. Mega Drive analogue output varies between board revisions. SNES has no universal factory instrument set: games upload their own BRR samples. These are newly authored instruments, not a particular game's bank.

The SNES driver schedules timer waits at 1 ms resolution plus SPC700 instruction overhead. Filter-zero BRR (`--brr-filter 0`) remains the implemented encoder: legal BRR with a compact, grainy character, not an optimized predictor. Pass a directory of `.brr` files plus `directory.json` (`root_hz`, loop, ADSR) to skip the synthetic sources. Tonal source periods adapt to the requested register, and the DSP applies its own pitch and envelope processing. The included demo enables a 32 ms hardware echo with a three-tap FIR. Preview samples are rendered dry. Studio captures of 1.7 s have no sustain loop; do not present them as hardware sustain.

## Native use

Requires Python, NumPy and FFmpeg built with `libgme`. No emulator executable is redistributed. From the installed skill:

```bash
python scripts/console_soundpack.py megadrive ../drive-demo.vgm --wav --fm-json data/megadrive-fm-presets.json
python scripts/console_soundpack.py snes ../snes-demo.spc --wav --brr-filter 0
python scripts/console_soundpack.py nes ../nes-demo.vgm
```

The standalone soundpack ZIP contains the same script at its root, so omit `scripts/` when running it there. Pass `--notes NOTES.json` to use your own arrangement, `--dry` to disable SNES echo, `--brr-dir` for external BRR, and `--fm-json` for an editable YM2612 table. Outputs must be new paths. The JSON is an array of notes:

```json
[{"preset":"electric_keys","midi":60,"time":0,"duration":0.75,"velocity":96}]
```

For SNES use a preset such as `piano`, `harp`, `strings` or `picked_bass`. For NES use `pulse`, `triangle` or `noise`. The script loads Mega Drive patches from `data/megadrive-fm-presets.json` when present. The ZIP also includes `presets.json`, an editable demo score, its native file and a WAV. Sampler ZIPs use modern polyphony and measured per-region trims; they are not chip voice budgets. Raw WAV captures retain their source levels. SNES also includes `.brr` sources and their root/loop directory. Samples and register patches are original CC0 material; project source follows the repository license. FFmpeg/libgme has its own license and is an external runtime dependency. Without libgme the test suite still validates VGM/SPC bytes.

## Studio integration

The **Mega Drive · sampled** and **SNES · sampled** menus are emulator-derived multisample previews. Both map the existing 54 score roles onto their explicitly named console presets, with two velocity layers and octave roots. The mapped roles are not 54 unique console patches. Repeated attacks are deterministic. Each preview captures 1.7 seconds of key-down plus release; it has no artificial sustain loop. Do not present those captures as hardware sustain. NES has no sampled Studio palette in this skill; use the VGM writer.

Studio's Web Audio mixer, pitch shifting, effects, polyphony and WAV export remain the modern preview path. They do not run a console emulator or enforce its voice budget. Use the VGM/SPC files and native writer for console-constrained playback. Existing catalog notes and mastered recordings are unchanged. The Soundbank page provides dry live previews, native demo audio and both downloads.

The repository builder is `tools/build_console_banks.py build NEW_DIRECTORY`; `publish NEW_DIRECTORY` checks source and artifact hashes before adding the two palettes. Keep generated raw samples outside the skill. Native multisample rendering can use that build directory through `neospc.py render --factory-dir` with `sound_palette` set to `megadrive` or `snes`; this is still the modern sample renderer, not the native chip writer.

## Sources and verification

- [YM2612 register reference and Sega technical manual transcription](https://www.smspower.org/maxim/Documents/YM2612)
- [VGM file format](https://www.smspower.org/Music/VGMFileFormat)
- [Game Music Emu source and supported formats](https://github.com/libgme/game-music-emu)
- [S-DSP registers](https://snes.nesdev.org/wiki/S-DSP_registers)
- [BRR samples](https://snes.nesdev.org/wiki/BRR_samples)
- [NES APU](https://www.nesdev.org/wiki/APU)
- Sound backends, receipts and SF2: [57-sound-backends.md](57-sound-backends.md)

Verify native files with a real decoder, signal and duration checks, voice-overflow rejection and browser playback/export. Keep physical-hardware comparison and listener preference pending until those comparisons happen.
