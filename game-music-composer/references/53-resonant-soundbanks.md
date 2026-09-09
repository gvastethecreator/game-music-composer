# Resonant synthesis banks

Timber, Prism and Voltage add three complete palettes. Each covers the same 54 patch IDs as Chamber, with 2,130 regions: roots at most six semitones apart, three intensity layers and two deterministic alternate attacks. They work with the existing 140 scores. Selecting a live palette does not replace the catalog's mastered recordings.

| Palette | Synthesis | Useful starting material |
|---|---|---|
| Timber | Independently damped string partials, pluck/hammer excitation, body resonances, wind spectra, vocal formants and membrane percussion | Requinto, rhythm guitar, acoustic bass, keys and chamber arrangements |
| Prism | Nested FM operators, velocity-dependent modulation and separate struck, plucked, bass and sustained envelopes | Electric keys, bell motifs, melodic beats and glass textures |
| Voltage | Band-limited harmonic oscillators, pulse widths, evolving spectra, controlled detune and oversampled drive | Electronic bass, leads, chords and punchy percussion |

These are original synthetic instruments. They do not contain new recordings and are not physical replicas of particular instruments. Timber uses modal and source-filter approximations, not a full nonlinear instrument simulation. Prism and Voltage deliberately reinterpret acoustic patch roles as electronic timbres.

## Use and compare

In Studio, select Timber, Prism or Voltage in the soundbank menu. This switches to live playback. The patch browser follows the selected palette and shows its register, intensity and alternate-attack map. The 44.1 kHz Chamber preview is disabled for other palettes rather than playing a different source. WAV export uses the selected palette.

For a native master, set `sound_palette` to the desired bank in the score and use a complete build directory:

```bash
python scripts/neospc.py render CATALOG OUTPUT --factory-dir BANK_BUILD --workers 3
```

The repository builder is `tools/build_resonant_banks.py build NEW_OUTPUT --workers 3`. It requires the existing Studio metadata and the optional native audio dependencies. It preserves existing sample chunks. `publish NEW_OUTPUT` checks the receipt and installs only the new chunks and updated palette metadata. The installed skill includes `scripts/resonant_timbres.py`, so an individual patch can also be generated independently:

```bash
python scripts/resonant_timbres.py --palette timber --patch guitar.requinto --midi 60 --velocity 96 --output ../requinto.wav
```

The synthesis runs internally at twice the delivery rate, then applies a polyphase low-pass decimator. Live sample data uses lossless FLAC in lazy JavaScript chunks; native build samples use PCM16 WAV. The lossless encoder checks every decoded sample against its PCM source. Sustained loops use a matched overlap and are checked for boundary continuity. The browser decodes the embedded audio locally; playback uses no external synthesis service or network request.

Compare the same passage at matched integrated loudness. Also audition a dry patch, soft and hard notes, repeated attacks, a sustained note and the loop transition. Signal integrity, tonal differences and successful export do not prove that a listener prefers the result. Keep artistic approval separate.

## Design references

The modal approach follows the separation of excitation and resonant modes described by [Julius O. Smith, Modal Expansion](https://dsprelated.com/freebooks/pasp/Modal_Expansion.html). Velocity-dependent excitation and frequency-dependent decay are informed by his [Electric Guitars](https://dsprelated.com/freebooks/pasp/Electric_Guitars.html) chapter. The code and waveforms here are original implementations; no source recordings were copied.
