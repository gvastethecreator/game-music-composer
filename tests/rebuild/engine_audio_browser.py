"""Render the engine offline in Chromium and compare level metrics with UMBRA 8.

Chromium's offline renderer is not bit-deterministic between identical runs
(about 1e-5 relative RMS), so the check uses a 1e-3 tolerance on RMS and 3e-3 on
peak. It also rejects page errors and non-finite samples.
"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / 'game-music-composer-showcase/engine/core.js'
GOLDEN = json.loads((Path(__file__).parent / 'fixtures/umbra8-audio.json').read_text())['cases']
PROBE = """async ([seed, preset]) => {
  const s = GMCEngine.compose(seed, preset);
  const r = await GMCEngine.renderOffline(s, {loops: 1, tail: 'tail', sampleRate: 44100});
  const L = r.buffer.getChannelData(0), R = r.buffer.getChannelData(1);
  let sum = 0, peak = 0, bad = 0;
  for (let i = r.start; i < r.start + r.frames; i++) for (const x of [L[i], R[i]]) {
    if (!Number.isFinite(x)) { bad++; continue; }
    sum += x * x; peak = Math.max(peak, Math.abs(x));
  }
  return {frames: r.frames, rms: Math.sqrt(sum / (2 * r.frames)), peak, bad};
}"""


def main():
    failures, rows = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.set_content('<!doctype html><title>engine audio</title>')
        page.add_script_tag(path=str(ENGINE))
        for case, ref in GOLDEN.items():
            preset, seed = case.split('/')
            got = page.evaluate(PROBE, [seed, preset])
            rel = abs(got['rms'] - ref['rms']) / ref['rms']
            rows.append({'case': case, 'rmsRelDiff': rel, 'peakDiff': abs(got['peak'] - ref['peak']), **got})
            if got['frames'] != ref['frames'] or got['bad'] or rel > 1e-3 or abs(got['peak'] - ref['peak']) > 3e-3:
                failures.append(case)
        browser.close()
    failures += [f'page error: {e}' for e in errors]
    print(json.dumps({'rows': rows, 'failures': failures}, indent=1))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
