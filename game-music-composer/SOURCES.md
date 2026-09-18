# Sources

## SNES audio architecture

- SNESdev Wiki — S-DSP registers: https://snes.nesdev.org/wiki/S-DSP_registers
- SNESdev Wiki — S-SMP: https://snes.nesdev.org/wiki/S-SMP
- SNESdev Wiki — BRR samples: https://snes.nesdev.org/wiki/BRR_samples

## NES audio

- NESdev Wiki — APU: https://www.nesdev.org/wiki/APU
- VGM 1.61 NES APU clock field: https://vgmrips.net/wiki/VGM_Specification

## SoundFont adapters (not packaged banks)

- FluidSynth: https://github.com/FluidSynth/fluidsynth
- SpessaSynth (optional Studio preview; copy locally, no CDN; not vendored in the skill ZIP): https://github.com/spessasus/SpessaSynth
- SoundFont 2 RIFF pdta/phdr: operator-supplied `.sf2` only. This skill does not redistribute private, commercial or game SoundFonts.

## Browser audio

- W3C Web Audio API: https://www.w3.org/TR/webaudio/
- MDN AudioWorklet: https://developer.mozilla.org/docs/Web/API/AudioWorklet

## MIDI

- MIDI Association — MIDI 2.0: https://midi.org/midi-2-0

## Trackers and expanded retro workflows

- Furnace Tracker: https://github.com/tildearrow/furnace

## Structured and multitrack generation research

- MusicFrameworks: hierarchical structure for music generation, ICLR 2024.
- Structure-informed generation via section and phrase hierarchy.
- Multitrack arrangement with explicit track and orchestration representations.

Sources inform architecture. Benchmark: no extracted commercial SNES melodies or samples.

## Arrangement-spec method

- jtydhr88/music-composition-skills: https://github.com/jtydhr88/music-composition-skills
- MIT covers the six-layer architecture, ARR-SPEC schema/template, backend honors format (`exact` / `hint` / `none`), numbered principles and checklists.
- NOTICE: book quotations (Adler, Schoenberg, Yang and others), translations, engraved examples, Cambridge-MT measured tables, and named song-generation backends are not relicensed. This skill uses the checklist method only. It does not vendor the 29 Chinese skill bodies, the Suno/YuE2 compile path, or quoted textbook passages.

## Workstation pattern and performance workflows

- FL Studio — Riff Machine: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_riff.htm
- FL Studio — Piano roll tools: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_menu.htm
- FL Studio — Arpeggiator: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_arpeggiate.htm
- FL Studio — Randomizer: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_random.htm
- FL Studio — Note properties: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll.htm
- FL Studio — Mixer and routing: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/mixer.htm
- FL Studio — Levels and mixing: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/mixer_levelsandmixing.htm
- FL Studio — Fruity Limiter: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Fruity%20Limiter.htm

## Symbolic music representation and evaluation

- MusPy: A Toolkit for Symbolic Music Generation — arXiv: https://arxiv.org/abs/2008.01951
- musicaiz: A Python Library for Symbolic Music Generation, Analysis and Visualization — arXiv: https://arxiv.org/abs/2209.07984
- MusicFrameworks: hierarchical music structure — ICLR 2024 proceedings.
- Open Music Theory — jazz voicings: https://viva.pressbooks.pub/openmusictheory/chapter/jazz-voicings/
- Open Music Theory — chord-scale theory: https://viva.pressbooks.pub/openmusictheory/chapter/chord-scale-theory/
- Open Music Theory — modal schemas: https://viva.pressbooks.pub/openmusictheory/chapter/modal-schemas/

Workstation refs mark separations: harmony, progression, arpeggiation, note properties, groove, routing, master controls. Neo-SPC: original data model and interface; no copied application code, presets or proprietary assets.

## Recorded Chamber sources

VSCO 2 Community Edition, Versilian Studios / Sam Gossner: https://versilian-studios.com/vsco-community/ . CC0-1.0. Pinned repository revision: 440300901dfe9275fd84e0b7763af1f8443ae62e. See data/soundbank-provenance.json for the 103 selected recordings, their declared roots and SHA-256 hashes. Fifteen Chamber patch definitions use this subset; repeated mapped zones do not imply independent recorded takes.

## Genre rhythm method

These pages informed groove rules in `genre_composer.py`. No recordings, loops or melodies were copied. Do not read the packs as certified tradition.

- Salsa 2–3 clave: https://en.wikipedia.org/wiki/Clave_(rhythm)
- Cumbia pulse and scraper: https://en.wikipedia.org/wiki/Cumbia
- Guitar roles and Dominican bachata background: https://www.iasorecords.com/music/what-is-bachata
- Bossa nova rhythm: https://en.wikipedia.org/wiki/Bossa_nova
- Habanera bass (tango): https://en.wikipedia.org/wiki/Habanera_(music)
- Funk sixteenth guitar and backbeat: https://en.wikipedia.org/wiki/Funk
- House four-on-the-floor: https://en.wikipedia.org/wiki/House_music
- Drum and bass break and sub: https://en.wikipedia.org/wiki/Drum_and_bass
- Synthwave gated drums and analog bass: https://en.wikipedia.org/wiki/Synthwave
- Lo-fi hop feel: https://en.wikipedia.org/wiki/Lo-fi_music
- Half-time backbeat, 808 bass and hat-roll vocabulary: https://blog.native-instruments.com/how-to-make-a-trap-beat/
- Trip hop's played and rearranged drum approach: https://brianfunk.com/blog/trip-hop-drums
- Metal riff, palm mute and double kick: https://en.wikipedia.org/wiki/Heavy_metal_music
- Dembow, rhythmic variation and production history: https://daily.redbullmusicacademy.com/2013/07/dembow-a-loop-history/
