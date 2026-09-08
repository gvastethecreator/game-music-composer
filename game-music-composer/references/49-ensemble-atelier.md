# Ensemble Atelier — usage and truth contract

Added 2026-09-08. This is an opt-in portable skill extension, not a replacement renderer.

## Commands and outputs

Run from the installed `game-music-composer/` directory:

```bash
python scripts/visualize_score.py --input ../cue/composition.json --output ../cue/atelier.html
python scripts/visualize_score.py --input ../cue/catalog.json --cue-index 1 --output ../cue/second-cue.html
python scripts/visualize_score.py --demo conversation --output ../labs/conversation.html
python scripts/refine_performance.py ../cue/catalog.json ../cue/catalog-performed.json --profile pocket --amount 0.45
```

Files are created exclusively. Existing files, including input and prior evidence, are not overwritten. All resource paths are relative to the Python helper, so the installed folder can move. No Node or rendering extras are needed to generate HTML. The browser performs original synthetic preview and WAV export locally. Workers must be permitted; a restrictive host can block them with an explicit error.

## Instrument experience

59 selectable identities: 56 aliases representing the original instrument inventory and three additions (electric piano, kalimba and metallophone). They share 13 types of SVG surface. This does not mean 59 sampled acoustic instruments. The view includes keys, plucked/fretted strings, bowed strings, winds, brass, choir, bellows, mallets, harp, tines, bells, synths and percussion.

Bodies now use original procedural geometry, material gradients, hardware, subtle shadows and distinct silhouettes. There are no downloaded images, fonts or model-generated assets. Decorative synth knobs are illustration, not hidden parameter controls.

The sound, lighted pitch and roll use the same event data. Native output timestamps inform display time when available; fallback is the AudioContext clock. No physical audio/visual latency guarantee is made for every device. Bow, mallet, valve and bellows motion illustrate activity, not anatomical performance. Exact pitches remain available on named pads even when the body cannot show every note. Fretted diagrams select one representative position, not a validated fingering.

Each track has an enlarged native dialog with keyboard-accessible note buttons, mute/solo and attack history. Escape closes the dialog without stopping the score; outside the dialog it stops audio. Reduced-motion preferences override animation. Normal miniature targets are smaller than enlarged targets: there is no claim of whole-app WCAG certification.

Track VEL = active event velocity. Attack trail = actual event activations over three seconds. Master waveform and dBFS indicator = samples from an AnalyserNode after the synthetic master gain. The indicator is neither a certified peak meter nor LUFS/true-peak analysis. Silence is not replaced with decorative activity.

## Audio preparation and safety

The previous live path could block the main thread while synthesizing its first chord. This path prepares unique voices in a local Worker before starting the clock, exposes progress, supports cancellation and caches the result. A conservative 64 MiB estimate rejects oversized preparations rather than truncating the source. Scheduling uses lookahead; a substantially overdue clock stops rather than firing a burst of late notes. Hiding the document or leaving it stops playback.

Live and offline paths share the same voice function. Timbres are compact additive/FM/noise models with role balance. WAV is stereo PCM16 at 32 kHz, one turn plus 0.7 seconds of tail; the export limits are 150 seconds and 6,000 events. It is not a seam-certified loop, stem pack or mastered production asset. The DSP compressor and synthesis are not native-renderer parity.

## Import boundaries

The Python helper accepts one composition, a selected catalog cue, or a browser session. It rejects more than 25 MiB and conservatively limits the embedded selection to 12,000 events. The browser file import separately accepts up to 18,000 events, 80 tracks, 512 beats and 30–260 BPM. A synthesized note may not exceed 14 seconds. These are viewer protection limits, not revisions to the native composition schema.

Unknown instruments get an explicit synthetic fallback. Native sample choices, velocity layers, CC, buses, sample offsets and every articulation are not reproduced. Durations are bounded to the viewing window and that loss is declared. Input paths are never followed from JSON to load arbitrary assets. JSON is embedded as escaped data; title strings cannot close a script element.

The original score remains authoritative. Edits and WAV exports in the viewer are exploratory. The session format `gmc-brainstorm-session` is not a native catalog, a General MIDI file or a DAW project. Reset restores the originally embedded score when supplied.

## Native performance refinement

`refine_performance.py` preserves written kind/inst/role/midi/beat/duration, makes a deep copy, and records the sorted event hash. Timing gestures are stable per instrument and four-bar phrase; chord members agree. The amount blends existing performance toward the selected target. Amount zero retains the original object contents. Profiles are not automatic genre labels; ritual deliberately keeps a quantized target.

The helper bounds target onset shifts by 25 ms and a fraction of the instrument's minimum written onset gap, records boundary adjustments, adjusts gate and velocity fields, and checks exact symbolic overlaps under the legacy drum proxy. It refuses a resulting voice overflow without removing notes. It rejects applying itself twice; compare candidate amounts from the original, not a cumulatively degraded copy.

The native renderer/exporters were not replaced. A successful hash test proves preservation, not artistic preference or audio parity. Re-run canonical validation, symbolic review, bank audit, MIDI checks and fresh-directory native render before declaring a production improvement.
