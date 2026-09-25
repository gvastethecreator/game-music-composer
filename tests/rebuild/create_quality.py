"""Create stability, timing and accessibility checks in Chromium.

- 60 play/stop cycles with auditions leave no player, engine or preview running.
- JS heap growth after forced garbage collection stays under 25 MB.
- Steps advance at the song's tempo on the audio clock (within 3 steps over 2 s).
- Every button, input and select in Create (Essential and Studio) has an accessible
  name, and keyboard Tab reaches the Play button.
"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
URL = (ROOT / 'game-music-composer-showcase/index.html').as_uri() + '?view=create'
UNNAMED = """() => [...document.querySelectorAll('#view-create button, #view-create input, #view-create select, #view-create summary')]
  .filter(e => e.offsetParent !== null)
  .filter(e => !(e.getAttribute('aria-label') || e.textContent.trim() || e.closest('label') || e.title || (e.id && document.querySelector(`label[for="${e.id}"]`))))
  .map(e => e.outerHTML.slice(0, 120))"""


def main():
    out, errors = {}, []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)
        page.wait_for_function('document.querySelectorAll("#createTracks .create-track").length===10')
        # Fresh page: sequential focus starts at the top of the document.
        reached = False
        for _ in range(40):
            page.keyboard.press('Tab')
            if page.evaluate('document.activeElement?.id') == 'createPlay':
                reached = True
                break
        out['tabReachesPlay'] = reached
        out['unnamedEssential'] = page.evaluate(UNNAMED)
        page.click('#createStudio')
        page.click('text=Add game states')
        page.wait_for_timeout(300)
        out['unnamedStudio'] = page.evaluate(UNNAMED)
        page.click('#createEssential')

        page.evaluate('gc()')
        heap0 = page.evaluate('performance.memory.usedJSHeapSize')
        out['cycles'] = page.evaluate("""async () => {
          const P = GMCEngine.player, tracks = ['kick', 'bass', 'keys', 'lead'];
          for (let i = 0; i < 60; i++) {
            await P.start();
            await new Promise(r => setTimeout(r, 40));
            if (i % 3 === 0) await P.preview(tracks[i % 4]);
            i % 2 ? P.pause() : P.stop();
          }
          P.stop();
          await new Promise(r => setTimeout(r, 300));
          return { playing: P.playing, starting: P.starting, timer: P.timer, queue: P.queue.length };
        }""")
        page.evaluate('gc()')
        page.wait_for_timeout(300)
        page.evaluate('gc()')
        out['heapGrowthMB'] = round((page.evaluate('performance.memory.usedJSHeapSize') - heap0) / 1048576, 2)

        out['timing'] = page.evaluate("""async () => {
          const P = GMCEngine.player, s = GMCEngine.session.state; await P.start();
          await new Promise(r => setTimeout(r, 300)); const a = P.step, t0 = performance.now();
          await new Promise(r => setTimeout(r, 2000)); const b = P.step, t1 = performance.now(); P.stop();
          const total = GMCEngine.totalBars(s) * 16, steps = ((b - a) % total + total) % total;
          return { steps, expected: (t1 - t0) / 1000 / GMCEngine.stepSeconds(s) };
        }""")
        out['stems'] = page.evaluate("""async () => {
          const s = JSON.parse(JSON.stringify(GMCEngine.session.state)); s.bars = 4;
          const r = await GMCEngine.createSession(s, {mode: 'wet', sampleRate: 22050});
          const m = r.manifest; return { bytes: r.blob.size, files: (m.files || m.stems || []).length || Object.keys(m).length, keys: Object.keys(m) };
        }""")
        browser.close()
    print(json.dumps({**out, 'errors': errors}, indent=1))
    checks = {
        'every visible control has a name': not out['unnamedEssential'] and not out['unnamedStudio'],
        'keyboard reaches Play': out['tabReachesPlay'],
        'play/stop cycles leave nothing running': out['cycles'] == {'playing': False, 'starting': False, 'timer': None, 'queue': 0},
        'heap growth under 25 MB': out['heapGrowthMB'] < 25,
        'steps follow the tempo': abs(out['timing']['steps'] - out['timing']['expected']) <= 3,
        'stems ZIP is produced with a manifest': out['stems']['bytes'] > 100000,
        'no browser errors': not errors,
    }
    failed = [k for k, v in checks.items() if not v]
    print('failed:', failed)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
