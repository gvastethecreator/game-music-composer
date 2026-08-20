# Neo-SPC Factory Bank integration

Factory Bank: default semantic instrument source for Neo-SPC live rendering.

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

- `neo16`: compact mono multisamples, two velocity layers, retro processing; local web playback and BRR projection.
- `neo32`: more zones, velocity layers, round robins and selective stereo; expanded web or offline rendering.

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

Showcase embeds the complete Neo-16 region set as data URIs, so multisample playback works from `file://` without fetch or CORS. Neo-32: full downloadable bank plus audition previews.
