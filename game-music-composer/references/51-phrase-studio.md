# Phrase Studio

The previous corpus used a shared motif generator and automatic ensemble layers. Its symbolic scores did not establish listening quality. This revision replaces the written material with 100 explicit subjects and answers, three-role reductions, nearest-inversion voice leading, phrase-end rests, and 17 finite accompaniment grammars. Scene names remain stable; the notes, arrangements and exports are replaced.

## Write a cue

Run the normal `neospc.py init` workflow. Add `score-blueprint.json` to that project before `neospc.py compose`. It contains:

```json
{
  "degrees": [0, 2, 4, 3, 1, 2, 5, 4],
  "answer": [1, 2, 4, 5, 3, 2, 1, 0],
  "rhythm": [[0, 0.25, 0.5, 0.75], [0, 0.375, 0.5, 0.75]],
  "grammar": "arp",
  "roles": ["flute", "harp", "bass"],
  "harmony": ["I", "vi", "IV", "V"],
  "contrast_harmony": ["vi", "ii", "IV", "V"],
  "bass_onsets": [0, 0.375, 0.625],
  "percussion": false,
  "palette": "factory"
}
```

Degrees index the plan's scale. Each subject has eight degrees, split into two bars. Rhythm positions are increasing fractions of one bar. Phrase ends resolve onto the planned harmony and leave a breath. The answer is independently written; do not generate it merely by inverting every interval. Roles are lead, harmony, bass. An optional `answer_role` fills the final melodic gap with two notes. Use plan section `B` for contrasting material.

Shared grammars: jig, waltz, swing, walking, bossa, tango, field, chorale, minimal, invention, funk, breaks, techno, drive, arp, dub, ska. The `bachata`, `trip_hop`, `trap` and `reggaeton` grammars use the additional contracts and dedicated rhythm writer in [52-genre-expansion.md](52-genre-expansion.md). These are bounded sketch grammars, not certification of traditional style, strict fugue, process music or atonal syntax. Use authored notes and specialist review when those claims matter. The plan/harness path remains available without a blueprint, and browser generators remain separate experiments.

## Sound and export

`tools/build_studio_palettes.py OUTPUT` builds the base 50 patches per production palette. `tools/add_genre_patches.py GENRE_OUTPUT --base OUTPUT` adds requinto, segunda, bongo and guira, bringing each palette to 54 patches and 648 regions. Chamber uses a pinned subset of VSCO 2 CE recordings (CC0) plus synthesis. Velvet and Circuit use separate excitation and decay algorithms. Source hashes, root notes and URLs accompany the build. Do not describe the recorded portion as our own recordings. The portable compact bank is a reduced projection; production multisamples live with the studio distribution.

For native masters use `render_mix_v4.py CATALOG COMPACT_BANK CALIBRATION OUTPUT --factory-dir PALETTE_BUILD`. Omitting that flag selects the compact renderer; it is not the production palette. Studio cue changes select the declared palette; manually changing banks auditions the same score with another palette. WAV export uses the selected live engine. Browser effects and native mastering are different, even with identical source-region selection.

## Review

Check the written reduction before layers. Listen to opening, answer, contrast and loop seam at matched volume. Reject a subject that only makes sense under reverb. Do not fill a voice ceiling. Inspect similar pitch contours and onset patterns across the corpus, but permit meaningful recurrence within a piece. Symbolic legality, export integrity and human artistic approval are separate results.
