# Studio Multisample integration

Studio Multisample v2 is the default semantic instrument source for Game Music Composer live rendering. Patch IDs and the `neo16` profile identifier remain score-format identifiers.

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

- `neo16`: 608 mono regions at 32 kHz across 50 patches, all declared root registers, two velocity layers and two alternate attacks. Nyquist-limited synthesis and baked sustain crossfades; no intentional bit reduction.
- `neo32`: one representative mono 44.1 kHz preview per patch. It is explicitly preview-only, not a complete second multisample bank.

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

The showcase keeps metadata separate from 50 local per-patch sample scripts. Each needed script embeds WAV data URIs; playback works from `file://` without fetch or CORS. Failed loads can be retried. The 44.1 kHz previews use the same synthesis function.

`scripts/synthesize_soundbanks.py` generates original tonal partials, body resonances, velocity-dependent excitation, ensemble beating and percussion modes at twice the output rate before lowpass resampling. `tools/build_soundbanks.py build <fresh-directory>` in the repository builds and verifies the banks; `publish` installs them. Studio Compact retains 46 source identities and is recalibrated from measured audio. The native renderer uses filtered polyphase pitch resampling. Hardware BRR budgets remain projections, not validated playback hardware.
