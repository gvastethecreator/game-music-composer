# Neo-SPC Composer Studio v4.1

A static evolved-retro music workstation containing:

- 100 reviewed compositions;
- Factory Live multisample playback;
- the Neo-SPC Factory Bank browser;
- mastered A/B previews;
- per-instrument volume controls;
- global tempo and transposition;
- animated piano roll;
- full Recipe Builder;
- independent Professor Review;
- MIDI, audio, skill and soundbank downloads.

## Run locally

Extract the ZIP before opening `index.html`.

Factory Live and the embedded Neo-16 bank work from `file://`. For the most consistent browser behavior, run a local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

The project is static and has no build step. Upload the folder contents to a repository and publish the repository root through GitHub Pages.

## Soundbank

See `FACTORY-BANK-INTEGRATION.md`. The complete bank remains CC0-1.0 and contains no extracted game samples.


## Lite package

This package omits the duplicate full-bank ZIP and the duplicate audio-pack ZIP. Factory Live, all 100 browser previews and the embedded Neo-16 bank remain functional. Download the standalone Factory Bank separately when the complete SFZ/WAV library is needed.
