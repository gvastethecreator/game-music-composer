# Soundbank level matching

Studio and the native multisample renderer share `data/soundbank-levels.json`. The portable page loads its generated JavaScript copy. The table covers all 8,604 delivered sample files across Chamber, Velvet, Circuit, Timber, Prism, Voltage, Mega Drive, SNES and Compact. It changes playback gain, not the waveforms or written score.

Each root uses a K-weighted 400 ms onset measurement with a high-velocity reference. Its soft layers and alternate attacks receive the same gain, preserving their amplitude differences. The reference target is -18 LUFS. This is a note-calibration reference, not a complete track mastering target. A sample-peak limit of 0.8 can prevent a sparse transient from reaching that target; no compressor flattens it to force a match. Instrument role gains, arrangement density, velocity and user faders still affect the resulting mix.

Chip Core receives a separate -8 dB trim derived from rendered C4 comparisons. Representative 44.1 kHz auditions have their own measured trims and follow the current master setting. Native console demo players receive downward integrated-loudness trims. The native VGM/SPC register programs remain unchanged. Console SFZ files include the same sample trims as Studio; raw WAV captures retain their source levels.

Rebuild the table after changing any sample source or its root/velocity mapping:

```bash
python tools/calibrate_studio_levels.py
```

This is a repository tool using NumPy, SoundFile and pyloudnorm. Repackage the skill and synchronize Studio after generation. For console downloads, run `tools/build_console_banks.py pack BUILD_DIRECTORY` again to publish current SFZ gains. Do not normalize velocity layers independently, apply both legacy gain and the new trim, or add gain to the master to compensate for a single quiet patch.

Compare actual exported notes and an arranged cue. Signal checks do not prove equal subjective loudness for every articulation or equal artistic quality. The same file gain must reach native playback, live playback, patch audition and WAV export. Mixer dB labels show the user's relative track gain; 0 dB leaves the calibrated patch at its intended role level.
