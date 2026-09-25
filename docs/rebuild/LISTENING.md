# Listening protocol

Tests prove the port and the plumbing. Only listening decides whether the music is better. This protocol separates **composition** from **sound** so a preference can be traced to its cause.

## Build the pack

```bash
python tests/rebuild/listening_pack.py
```

It writes `.scratch/listening/` (not versioned; about 60 MB):

| Version | What it is | Isolates |
|---|---|---|
| A | Catalog cue through the Studio sample banks (Studio WAV export, the cue's palette) | today's catalog sound |
| B | The same notes through the synthesis engine (Open in Create → WAV) | sound and mix, composition held equal |
| C | A new Create song in the closest engine style, fixed seed | the engine's own composition and sound |

Six fixtures: lo-fi, drum & bass, synthwave, house, bossa nova, trap. Every file is level-matched to −20 dBFS RMS with peaks under −1 dBFS. This is an RMS method, not LUFS; it removes the "louder sounds better" bias, not every loudness difference. Labels X/Y/Z are shuffled per fixture; `key.json` holds the answers and the applied gain.

Observed while building the pack (2026-09-25): Studio sample-bank exports needed +7 to +17 dB to reach the target RMS; engine renders needed −0.3 to +10 dB. The catalog's sample path renders much quieter than the engine before matching.

## Listen

1. Open `.scratch/listening/index.html` in a browser. Use headphones or monitors at one fixed volume.
2. For each fixture, play X, Y and Z more than once, in any order.
3. Choose one version or "no preference", and say why: melodic identity, groove, harmony, timbre, mix or fit for a game scene.
4. Download the answers. Only then open `key.json`.

## Read the answers

- B preferred over A on the same notes → the gain comes from synthesis and mix. Moving catalog cues through the engine (Open in Create, `create-import`) is worth it.
- C preferred over B → the gain comes from the engine's composition as well.
- A preferred → the sample banks suit that style better; keep them for it.
- Record ties, fatigue and styles outside your taste. One listener is a personal decision, not general superiority.

Save the result as `docs/rebuild/listening-results.json` with the date, listener, device and answers. Until then, listening stays `pending_human` in `DELIVERY.json`.
