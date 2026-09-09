# Bachata, trip hop, trap and reggaeton

The Studio has ten instrumental cues in each of these four categories, in addition to the original hundred. Their authored contracts live in `data/genre-expansion-contracts.json`. `genre_composer.py` uses the shared subject and harmony planner, then writes each genre's bass, accompaniment and percussion. These are finite instrumental arrangements, not vocal songs or a claim to cover an entire tradition.

## Start a new project

```bash
python scripts/neospc.py init ../bachata --title "Patio at Night" --category bachata --bpm 122 --meter 4/4 --key D --mode aeolian --voices 12 --seed 4
python scripts/neospc.py compose ../bachata
```

The category IDs are `bachata`, `trip_hop`, `trap` and `reggaeton`. Init creates `score-blueprint.json` as well as the plan and harness. The seed selects one of ten starting blueprints. Edit its subject, answer, harmonic destinations, rhythm, bass pattern and breakdown bars to write another piece. Changing the seed alone is not a new musical idea. These four grammars require 4/4.

## Writing rules

| Category | Foreground and harmony | Bass and percussion |
|---|---|---|
| Bachata | Requinto subject and short responses; two-note muted segunda voicings | Syncopated electric bass, two bongo pitches, scraper strokes and phrase-end fills |
| Trip hop | Sparse keys, mallets or reed; sustained harmony stops before a chord change | Deep bass, slow broken kick patterns, delayed backbeats, swung hats and ghost notes |
| Trap | A short hook with quiet upper-register support and breakdown space | Pitched sub-bass, half-time snare on beat three, eighth-note hats with tapered triplet or 32nd-note rolls |
| Reggaeton | Short plucks or keyboard phrases, syncopated accompaniment | Dembow cells with kick on beats one and three, snare anticipations, bass gaps, fills and returns |

The forty contracts vary subjects, answers, harmony, key, tempo, phrase rhythm, section lengths, lead instruments and groove variants. Repetition inside a groove is intentional. Check the answer and return as well as the opening before accepting a cue.

The new requinto, segunda, bongo and guira patches are original synthesis. They have two intensity layers and two alternate attacks, in Chamber, Velvet and Circuit. The scraper is a noise model; these patches are not instrument recordings. MIDI preserves the two GM bongo keys, while audio tuning uses explicit cents independently of those keys. Production masters use the same patch regions as live playback.

## Sources and listening checks

- Guitar roles and Dominican bachata background: [iASO Records / David C. Wayne](https://www.iasorecords.com/music/what-is-bachata).
- Half-time backbeat, 808 bass and hat-roll vocabulary: [Native Instruments / Tim Cant](https://blog.native-instruments.com/how-to-make-a-trap-beat/).
- Trip hop's played and rearranged drum approach: [Brian Funk](https://brianfunk.com/blog/trip-hop-drums).
- Dembow, rhythmic variation and production history: [Wayne Marshall / Red Bull Music Academy](https://daily.redbullmusicacademy.com/2013/07/dembow-a-loop-history/).

These sources informed arrangement rules; no recordings, loops or melodies were copied. Listen for groove recognition, clear foreground, bass/drum balance and an intentional loop seam. Automated note, routing, peak and file checks do not establish artistic quality. Human listening remains pending until it happens.
