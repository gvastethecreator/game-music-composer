# Neo-SPC Factory Bank integration

The Factory Bank is the default semantic instrument source for Neo-SPC live rendering.

## Separation of concerns

A composition event declares a musical role and an instrument assignment. The renderer resolves that assignment through:

```text
role + register + velocity + articulation + era profile
                              ↓
                         patch id
                              ↓
             key zone + velocity layer + round robin
                              ↓
                         sample region
```

Never choose a sample only because its label resembles an instrument name. Check register, attack, sustain behavior, dynamic layer and role in the arrangement.

## Profiles

- `neo16`: compact mono multisamples, two velocity layers, retro processing, suitable for local web playback and BRR projection.
- `neo32`: more zones, velocity layers, round robins and selective stereo, suitable for expanded web or offline rendering.

The profile changes the rendering resolution and sample detail. It does not alter the composition's scale, harmony or form.

## Mandatory patch selection data

Each instrument assignment should declare:

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

Reject an assignment when:

- the part sits outside the patch's documented range;
- one root sample is stretched too far for the selected profile;
- a soft layer is used for an aggressive foreground role;
- a transient patch is expected to sustain without a loop;
- a stereo ensemble is stacked repeatedly until the image becomes unstable;
- a patch's semantic character contradicts the scene;
- the selected patch masks the lead or rhythm section;
- a generic low key or piano patch is used as bass.

## Local playback

The showcase embeds the complete Neo-16 region set as data URIs. This allows multisample playback when the site is opened from `file://` without fetch or CORS restrictions. Neo-32 remains available as the full downloadable bank and representative audition previews.
