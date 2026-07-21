# Sources and technical references

## SNES audio architecture

- SNESdev Wiki — S-DSP registers and voice behavior: https://snes.nesdev.org/wiki/S-DSP_registers
- SNESdev Wiki — S-SMP overview: https://snes.nesdev.org/wiki/S-SMP
- SNESdev Wiki — BRR samples: https://snes.nesdev.org/wiki/BRR_samples

## Browser audio

- W3C Web Audio API Recommendation: https://www.w3.org/TR/webaudio/
- MDN AudioWorklet: https://developer.mozilla.org/docs/Web/API/AudioWorklet

## MIDI

- MIDI Association — MIDI 2.0: https://midi.org/midi-2-0

## Trackers and expanded retro workflows

- Furnace Tracker documentation/repository: https://github.com/tildearrow/furnace

## Structured and multitrack generation research

- MusicFrameworks: hierarchical structure for music generation, ICLR 2024.
- Structure-informed music generation research using section and phrase hierarchy.
- Recent multitrack arrangement research using explicit track and orchestration representations.

These sources inform architecture and methodology. The benchmark does not contain extracted melodies or samples from commercial SNES games.

## Workstation pattern and performance workflows

- Image-Line FL Studio manual — Riff Machine: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_riff.htm
- Image-Line FL Studio manual — Piano roll tools: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_menu.htm
- Image-Line FL Studio manual — Arpeggiator: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_arpeggiate.htm
- Image-Line FL Studio manual — Randomizer: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_random.htm
- Image-Line FL Studio manual — Note properties: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll.htm
- Image-Line FL Studio manual — Mixer and routing: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/mixer.htm
- Image-Line FL Studio manual — Levels and mixing: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/mixer_levelsandmixing.htm
- Image-Line FL Studio manual — Fruity Limiter: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/plugins/Fruity%20Limiter.htm

## Symbolic music representation and evaluation

- MusPy: A Toolkit for Symbolic Music Generation — arXiv: https://arxiv.org/abs/2008.01951
- musicaiz: A Python Library for Symbolic Music Generation, Analysis and Visualization — arXiv: https://arxiv.org/abs/2209.07984
- MusicFrameworks: hierarchical music structure — ICLR 2024 proceedings.
- Open Music Theory — jazz voicings: https://viva.pressbooks.pub/openmusictheory/chapter/jazz-voicings/
- Open Music Theory — chord-scale theory: https://viva.pressbooks.pub/openmusictheory/chapter/chord-scale-theory/
- Open Music Theory — modal schemas: https://viva.pressbooks.pub/openmusictheory/chapter/modal-schemas/

The workstation references were used to identify useful separations between harmony, progression, arpeggiation, note properties, groove, routing and master controls. Neo-SPC implements an original data model and interface rather than copying application code, presets or proprietary assets.
