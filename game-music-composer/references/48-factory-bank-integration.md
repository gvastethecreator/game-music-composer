# Studio Multisample integration

The current Chamber bank combines cleared recordings and original synthesis. Read `data/factory-bank-manifest.json` for patch ranges, roots, velocity layers, alternate attacks and source kind. Patch IDs and the `neo16` profile identifier remain score-format identifiers.

## Separation of concerns

Event: musical role + instrument assignment. Renderer resolves via:

```text
role + register + velocity + articulation + era profile
                              ↓
                         patch id
                              ↓
             key zone + velocity layer + round robin
                              ↓
                         sample region
```

Never pick a sample only because its label resembles an instrument. Check register, attack, sustain, dynamic layer, arrangement role.

## Profiles

- `neo16`: the complete 32 kHz multisample map declared in the manifest. Use each region's loop declaration; do not assume every patch sustains.
- `neo32`: one representative 44.1 kHz audition per patch, explicitly preview-only. It is not a complete second bank or a production render profile.

Profile changes render resolution and sample detail, not scale, harmony, form.

## Mandatory patch selection data

Declare:

- `patch_id`;
- `profile`;
- `role`;
- intended register;
- velocity range;
- articulation;
- gain trim;
- pan policy;
- fallback patch;
- reason for selection.

## Review gates

Reject when:

- part sits outside the patch's documented range;
- one root sample stretched too far for the selected profile;
- a soft layer used for an aggressive foreground role;
- a transient patch is expected to sustain without a loop;
- a stereo ensemble is stacked until the image becomes unstable;
- a patch's semantic character contradicts the scene;
- the selected patch masks the lead or rhythm section;
- a generic low key or piano patch is used as bass.

## Local playback

Production samples live with the Studio distribution, outside the portable skill. See [51-phrase-studio.md](51-phrase-studio.md) and [53-resonant-soundbanks.md](53-resonant-soundbanks.md) for builders and palette-specific storage. The compact bank is a separate reduced projection; do not infer production parity from its patch labels.

`scripts/synthesize_soundbanks.py` remains an original-synthesis helper; it is not the source of the recorded Chamber instruments. Use the current palette builders from the source repository root when rebuilding production banks. Recalibrate after changing source audio. Hardware BRR budgets remain projections, not validated playback hardware.
