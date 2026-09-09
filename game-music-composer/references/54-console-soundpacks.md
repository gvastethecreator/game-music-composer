# Mega Drive and SNES soundpacks

These are two separate original soundpacks. Their native files drive the emulated hardware through FFmpeg's libgme demuxer. They are not the generic Chip Core oscillator bank. No game ROM, ripped soundtrack or commercial sample set is included.

| Pack | Native path | Original material |
|---|---|---|
| Mega Drive | VGM 1.50 register stream, NTSC YM2612 at 7,670,454 Hz and PSG at 3,579,545 Hz | 12 four-operator FM patches, PSG square tone and noise |
| SNES | SPC700 program, 64 KiB RAM image and S-DSP registers | 12 compact periodic BRR instruments and four BRR percussion samples, DSP ADSR, Gaussian interpolation and echo |

The native Mega Drive writer allocates at most six FM voices, three PSG tones and one noise voice. This pack does not use the DAC channel, FM channel-3 special mode or register macros for pitch bends. The native SNES writer allocates eight DSP voices, reserves sample and echo RAM, and rejects an oversized driver or sample set. Voice overflow is an error; the writer never silently drops notes. Retriggering a voice cuts its previous release. Leave space in the arrangement if that tail matters.

## Fidelity boundary

These files use actual emulation, but **bit-exact equivalence to physical hardware has not been established**. The installed FFmpeg/libgme version determines the emulator core and resampling. Mega Drive analogue output varies between board revisions. SNES has no universal factory instrument set: games upload their own BRR samples. These are newly authored instruments, not a particular game's bank.

The SNES driver schedules timer waits at 1 ms resolution plus SPC700 instruction overhead. It uses filter-zero BRR compression, which is legal BRR with a deliberately compact, grainy character; it is not an optimized predictive encoder. Tonal source periods adapt to the requested register, and the DSP applies its own pitch and envelope processing. The included demo enables a 32 ms hardware echo with a three-tap FIR. Preview samples are rendered dry.

## Native use

Requires Python, NumPy and FFmpeg built with `libgme`. No emulator executable is redistributed. From the installed skill:

```bash
python scripts/console_soundpack.py megadrive ../drive-demo.vgm --wav
python scripts/console_soundpack.py snes ../snes-demo.spc --wav
```

The standalone soundpack ZIP contains the same script at its root, so omit `scripts/` when running it there. Pass `--notes NOTES.json` to use your own arrangement and `--dry` to disable SNES echo. Outputs must be new paths. The JSON is an array of notes:

```json
[{"preset":"electric_keys","midi":60,"time":0,"duration":0.75,"velocity":96}]
```

For SNES use a preset such as `piano`, `harp`, `strings` or `picked_bass`. The script's `FM` and `SNES` dictionaries expose every patch and its parameters; the ZIP also includes `presets.json`, an editable demo score, its native file and a WAV. Both ZIPs include their dry WAV multisamples and SFZ maps for samplers; those use modern sampler polyphony and measured per-region level trims. Raw WAV captures retain their source levels. SNES also includes `.brr` sources and their root/loop directory. Samples and register patches are original CC0 material; project source follows the repository license. FFmpeg/libgme has its own license and is an external runtime dependency.

## Studio integration

The **Mega Drive · sampled** and **SNES · sampled** menus are emulator-derived multisample previews. Both map the existing 54 score roles onto their explicitly named console presets, with two velocity layers and octave roots. The mapped roles are not 54 unique console patches. Repeated attacks are deterministic. Each preview captures 1.7 seconds of key-down plus release; it has no artificial sustain loop.

Studio's Web Audio mixer, pitch shifting, effects, polyphony and WAV export remain the modern preview path. They do not run a console emulator or enforce its voice budget. Use the VGM/SPC files and native writer for console-constrained playback. Existing catalog notes and mastered recordings are unchanged. The Soundbank page provides dry live previews, native demo audio and both downloads.

The repository builder is `tools/build_console_banks.py build NEW_DIRECTORY`; `publish NEW_DIRECTORY` checks source and artifact hashes before adding the two palettes. Keep generated raw samples outside the skill. Native multisample rendering can use that build directory through `neospc.py render --factory-dir` with `sound_palette` set to `megadrive` or `snes`; this is still the modern sample renderer, not the native chip writer.

## Sources and verification

- [YM2612 register reference and Sega technical manual transcription](https://www.smspower.org/maxim/Documents/YM2612)
- [VGM file format](https://www.smspower.org/Music/VGMFileFormat)
- [Game Music Emu source and supported formats](https://github.com/libgme/game-music-emu)
- [S-DSP registers](https://snes.nesdev.org/wiki/S-DSP_registers)
- [BRR samples](https://snes.nesdev.org/wiki/BRR_samples)

Verify native files with a real decoder, signal and duration checks, voice-overflow rejection and browser playback/export. Keep physical-hardware comparison and listener preference pending until those comparisons happen.
