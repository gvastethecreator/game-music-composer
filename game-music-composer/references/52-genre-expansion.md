# Groove genre packs

The Studio has ten instrumental cues in each of 14 groove categories, in addition to the hundred Phrase Studio scene scores. Authored contracts live in `data/genre-expansion-contracts.json`. `genre_composer.py` uses the shared subject and harmony planner, then writes each genre's bass, accompaniment and percussion through a grammar dispatch table. These are finite instrumental arrangements, not vocal songs or a claim to cover a tradition.

## Start a new project

```bash
python scripts/neospc.py init ../salsa --title "Patio Clave" --category salsa --bpm 104 --meter 4/4 --key D --mode dorian --voices 12 --seed 4
python scripts/neospc.py compose ../salsa
```

Category IDs, in order: `salsa`, `cumbia`, `bachata`, `bossa_nova`, `tango`, `funk`, `house`, `dnb`, `synthwave`, `lofi`, `trap`, `trip_hop`, `metal`, `reggaeton`. Init creates `score-blueprint.json` as well as the plan and harness. The seed selects one of ten starting blueprints. Edit its subject, answer, harmonic destinations, rhythm, bass pattern and breakdown bars to write another piece. Changing the seed alone is not a new musical idea. All of these grammars require 4/4 except `metal`, which also accepts 7/8.

## Writing rules

| Category | Foreground and harmony | Bass and percussion |
|---|---|---|
| Salsa | Piano montuno offbeats; brass or wind answers the subject | Tumbao bass, 2–3 clave on wood, conga toms, campana on closings. No requinto/güira |
| Cumbia | Accordion or clarinet lead; slower than salsa | Bass on 1 and the counterbeat; güira/guacharaca scraper; 2/4 feel inside a 4/4 bar |
| Bachata | Requinto subject and short responses; two-note muted segunda voicings | Syncopated electric bass, two bongo pitches, scraper strokes and phrase-end fills |
| Bossa nova | Soft guitar or piano; partido alto cell | Split bass, rim clicks. Not the urban rooftop scene grammar |
| Tango | Accordion as bandoneón stand-in; marked phrases | Habanera bass, marked kicks. Not the retired underpass tango cue |
| Funk | Sixteenth guitar or clav; horn or synth stabs | Slap bass, snare on 2 and 4. Not a single factory hook |
| House | Ostinato synth or keys over four-on-floor | Offbeat hats, repeating kick. Distinct from Phrase Studio `techno` |
| Drum & bass | Fast break writing; separate sub | Snare on the double-time backbeat. Not a clone of the hangar/chase scene cues |
| Synthwave | Pulse lead, pads, octave bass | Gated box on 1 and 3. Not a clone of Signal Transit |
| Lo-fi | Dusty piano or mallet; irregular hats | Light swing, dirty hop. Distinct from cinematic trip hop |
| Trap | A short hook with quiet upper-register support and breakdown space | Pitched sub-bass, half-time snare on beat three, eighth-note hats with tapered triplet or 32nd-note rolls |
| Trip hop | Sparse keys, mallets or reed; sustained harmony stops before a chord change | Deep bass, slow broken kick patterns, delayed backbeats, swung hats and ghost notes |
| Metal | Palm-mute guitar riff (`dist_guitar_*`); bass in unison | Double kick or backbeat by cue; some cues 7/8 |
| Reggaeton | Short plucks or keyboard phrases, syncopated accompaniment | Dembow cells with kick on beats one and three, snare anticipations, bass gaps, fills and returns |

Each pack varies subject, answer, key, tempo, section lengths, lead and `variant`. Repeating the groove is legal; copying the hook is not. Factory patches stand in for roles (piano, accordion, slap, distortion guitar, synth). New samples appear only when a role cannot be faked. Do not claim live recordings.

Phrase Studio still owns the 100 game-function cues. Urban/electronic scene ids that used to share funk, bossa, tango, synthwave or DnB grooves were rewritten so the dedicated packs are not clones.

## Sources and listening checks

Method citations for these grooves are listed under Genre rhythm method in [SOURCES.md](../SOURCES.md). Those sources informed arrangement rules; no recordings, loops or melodies were copied. Listen for groove recognition, a clear foreground, bass/drum balance and an intentional loop seam. Automated note, routing, peak and file checks do not establish artistic quality. Human listening remains pending until it happens.
