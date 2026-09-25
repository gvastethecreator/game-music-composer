# Rebuild decisions

Decisions taken while integrating the UMBRA 8 musical engine into Game Music Composer. The private handoff package lives outside Git (`GMC-Rebuild-Handoff-v1/`, ignored).

## ADR-00 · Scope and order (2026-09-24)

The owner listened to UMBRA 8 and judged it clearly superior to the current Create output. The goal is the full handoff plus three review additions:

1. Say which output is being fixed. The browser Create path and the native catalog are different engines; both get work, in that order.
2. Ship audible fixes first (P0 mix/drum policy), then the composition and synthesis engine, then UI, game runtime and export.
3. Listening with the owner decides later phases. Symbolic checks never stand in for it.

Work happens on the local branch `rebuild/umbra-integration`, one commit per phase. No push or PR without an explicit request.

## ADR-01 · Port UMBRA's engine as GMC modules, verified against the original

UMBRA's music core (theory, generator, arpeggiator, performance, synthesis, mix, transport, export) is ported into GMC-owned classic scripts that load over `file://` and in Node. Its layered monkey patches are flattened into final functions.

Fidelity is proven, not asserted:

- Event golden files: the original UMBRA 8 bundle runs headless in Node (inert DOM stubs) and writes `scoreEvents` signatures for every preset and several seeds. The port must match them exactly.
- Audio: the same project is rendered offline by the original and by the port in one browser; buffers are compared.

The WORKBENCH shell and vendors are not copied (`UNLICENSED`). GMC gets its own controls.

## ADR-02 · One event compiler, two runtimes

The JavaScript compiler is the single source of musical decisions for the browser. The Python skill gets a direct port of the same compiler, held to the same golden files, so the CLI keeps working without a browser.

## ADR-03 · P0 live-engine policy

- `track_mix[inst] = {gain, send}` carries authored balance. Gain is linear, neutral 1, and 0 is silence. The channel gain is `fader^1.35 × gain`; velocity and sample-layer choice never change.
- Sends are post-fader. Precedence: event `send` → track `send` → dry. The historical law is kept: sample voices `send × .45` (cap .45), chip voices `send × .22` (cap .3).
- Drum playback: `oneShot` by default (the sample body after offset and rate, capped at 6 s, 12 ms edge fade). `gated` follows written length. `legacy` keeps the 0.16-beat gate and is selectable per event, per instrument (`playback`) or engine-wide (`setDrumPolicy('legacy')`).
- Chokes: closed hats (`hat`, `closed_hat`) cut earlier open hats (`open_hat`, `open`) in group `hats` at the closing hit. Voices that start at the same instant survive. `choke_group`/`chokes` override the default.
- Sample offsets past the buffer fail before playback instead of replaying from zero.
- Atelier sketches keep their D-tonic convention; the bridge labels it `key_source: "atelier-default"` and records the generator.
