# Studio soundbanks

The Studio offers six multisample palettes plus two compact previews over the same score. Choose a bank in the transport or on the Soundbank tab. A bank choice switches playback to Live score; the catalog masters remain a separate source.

- **Timber:** modal strings, body resonance, wind spectra and membrane percussion.
- **Prism:** nested FM, electric keys, struck tones and rounded bass.
- **Voltage:** band-limited oscillators, moving spectra and oversampled drive.
- **Chamber:** pinned CC0 chamber recordings and original synthesis.
- **Velvet:** tine/reed synthesis with tape motion.
- **Circuit:** dual-oscillator synthesis.
- **Compact** and **Chip Core:** separate lightweight previews.

The three new palettes each have 54 patch identities and 2,130 regions. Chamber, Velvet and Circuit each have 54 patches and 648 regions. A region is a register, intensity and alternate-attack choice, not a count of unique recorded performances.

## Runtime and export

The index loads metadata from data/factory-bank.js and data/studio-palettes.js. Sample chunks under data/banks load only when needed. New chunks contain lossless FLAC; prior chunks retain their source encoding. Playback works from disk without a server or remote request.

Each instrument's factory_patch resolves against the selected palette. The engine chooses its key zone, velocity layer and alternate attack. Sustained notes use explicit loop points. Studio WAV export uses the selected live palette and mix. Existing mastered recordings retain their original palettes.

The inspector shows the selected palette's 54 patches, search, family filters, roots, intensity layers, alternate attacks and audition keys. The representative 44.1 kHz preview belongs to Chamber and is disabled for other palettes. Use Multisample for those palettes.

The native skill includes resonant_timbres.py for individual patch synthesis. In the repository, tools/build_resonant_banks.py creates a fresh complete candidate and verifies its samples. Its publish phase checks source and artifact hashes before installing new chunks. Raw native build samples stay in the chosen build directory; the portable skill ZIP contains the generator rather than thousands of bank samples. See the installed reference 53-resonant-soundbanks.md for commands and synthesis limits.

These new banks are original CC0 synthesis, not acoustic recordings. Signal checks do not establish listener preference.

## Console soundpacks

Mega Drive and SNES add two emulator-derived sample previews, for ten live menu choices in total. They map 54 score roles onto named console presets and share 224 dry source samples. The Soundbank page includes native emulator demo audio and [Mega Drive](downloads/megadrive-soundpack.zip) / [SNES](downloads/snes-soundpack.zip) downloads with original patches, an editable score, generator, native VGM/SPC and WAV. SNES also includes BRR sources. Studio playback/export uses its modern sample mixer; use the native files for hardware voice limits. Physical-console equivalence and listener preference remain unverified. See the console soundpack reference in the bundled skill.

## Playback level calibration

All 8,604 source samples now use a shared K-weighted root calibration, preserving velocity layers and alternate attacks. Studio live playback, patch audition and WAV export use the same gains as native multisample renders. The browser loads data/soundbank-levels.js; the skill carries data/soundbank-levels.json. Regenerate with tools/calibrate_studio_levels.py after sample changes. Mixer labels report relative dB. Source recordings, raw console WAVs, VGM/SPC programs and the 140 existing mastered recordings are preserved.
