# Factory Bank integration

Neo-SPC Workstation v4.1 uses the Neo-SPC Factory Bank for the default **Factory Live** playback mode.

## Runtime model

- The complete Neo-16 profile is embedded in `data/factory-bank.js` as 176 WAV regions.
- Each composition instrument resolves to a semantic `factory_patch` when a compatible patch exists.
- The live engine chooses a key zone and velocity layer for each event.
- Patch loops are read from the bank manifest and converted from sample positions at runtime.
- Unmapped specialist colors use the previous compatibility bank instead of failing silently.
- The existing mastered previews remain available as an A/B reference.

## Soundbank tab

The Factory Bank view provides:

- search and family filters;
- Neo-16 / Neo-32 metadata comparison;
- patch range, roots, tags and region maps;
- velocity-sensitive audition buttons;
- representative Neo-32 previews;
- routing coverage for the currently selected cue;
- direct downloads of the full, Neo-16 and Neo-32 bank packages.

## Local use

Neo-16 audition and Factory Live work when `index.html` is opened directly from disk because the samples are embedded. Neo-32 representative previews are regular WAV files and may depend on the browser's local-file policy. GitHub Pages or a local HTTP server is recommended for the complete experience.
