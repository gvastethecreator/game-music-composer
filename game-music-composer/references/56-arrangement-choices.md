# Arrangement choices the plan can fail

Write these decisions into `composition-plan.json` before `compose`. Review can fail them. They do not generate audio. Phrase Studio, `neospc.py`, banks, loops and viewers stay the execution path.

Method adapted from [jtydhr88/music-composition-skills](https://github.com/jtydhr88/music-composition-skills): fail-able arrangement fields, spec lint versus rigidity tells as two numbers, backend `honors`. MIT covers that architecture and those checklists. Book quotations, translations, measured Cambridge-MT tables and named song backends are **not** relicensed; see that repo's `NOTICE`. Do not copy Chinese skill bodies, Suno/YuE2 compile steps, or textbook passages into this skill.

## Fields

| Field | Fail when | Cue/loop default |
|---|---|---|
| `energy_curve` | Values never descend, and no exemption | One drop (B thinner, return quieter, stinger gap). Short loop / drone / continuous combat: name the exemption |
| `subtraction_events` | Nothing is removed | ≥1 drop (drums, pad, motor). `silence_budget` prose is not a substitute |
| `roster[].entry` / `exit` | Every role runs start→end | ≥1 exit before the last section. Maps to the voice ceiling: a role that never rests is fill |
| `form[].development` | `new` is half or more of the sections | Closed set below. Phrase Studio: A `repeat`, A2 `vary`, B `fragment` or `new`, A3 `recap` |
| `arrangement_hook` | Cue is correct but has no non-lead memory | Riff, rhythmic cell, percussion hit. Not a sung hook |

`development` values: `repeat`, `sequence`, `extend`, `contract`, `fragment`, `vary`, `augment`, `counterpoint`, `new`, `recap`.

`arrangement_exemptions`: `short_loop`, `drone`, `continuous_combat`. Use one when a descent, exit or 8-bar break would fight the game function. Do not use them to skip a choice the cue can still make.

Do not require every section to avoid multiples of 8, or a 3:30 duration. Game default is 8-bar (or 4+4) phrases; **break that grid once with a motive** (shorter A2, 6-bar B, 2-bar tag). Do not treat random onset jitter as groove; systematic placement lives in `refine_performance.py`.

## Quality gates

These stay `false` until evidence exists. They are separate from symbolic legality:

- `energy_curve_has_descent_or_exemption`
- `has_subtraction_event`
- `a_role_exits_before_end`
- `arrangement_hook_is_hummable`
- `new_material_is_not_majority`

## Two numbers, not one

`neospc.py review` reports **plan compliance** (did the score honor the declared curve, rest, roster, development, hook?) and **rigidity tells** (enumerable machine defaults) separately from legality and identity. Do not merge them into the 0–100 diagnostic.

Tells checked here, without vocal items: all sections 8-bar multiples with no motive break (1); energy never descends (2); roster never changes (3); no non-vocal hook (6); every onset locked to the grid with no systematic placement (8). Tells 4–5, 7, 9–14 stay out of this skill.

High compliance with many tells means the **plan** itself is rigid. Low compliance with few tells means the backend improvised; the result may still need a rewritten plan to be reproducible.

## Honors

Read `data/backend-honors.json`. Values: `exact` (score it), `hint` (score at reduced trust), `none` (exclude; never score as zero).

| Backend | Do not score as if it were native render |
|---|---|
| native | Mix buses are not MIDI Port metadata |
| atelier | No LUFS / true peak; synthetic sketch timbres |
| console | Emulator preview is not hardware identity |
| midi | Type-1 has channels/ports, not mix buses |

Texture: if a band is crowded, remove notes or a role. Do not ask the mix to hide a full roster. Cinematic writing is designed layers, not louder tutti.
