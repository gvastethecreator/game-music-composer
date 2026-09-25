"""Create song sections and automation lanes through real controls in Chromium."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
URL = (ROOT / 'game-music-composer-showcase/index.html').as_uri() + '?view=create'


def lane_click(page, fx, fy, double=False):
    page.locator('#createLane').scroll_into_view_if_needed()
    box = page.locator('#createLane').bounding_box()
    x, y = box['x'] + box['width'] * fx, box['y'] + box['height'] * fy
    (page.mouse.dblclick if double else page.mouse.click)(x, y)
    page.wait_for_timeout(300)


def main():
    out, errors = {}, []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)
        page.wait_for_function('document.querySelectorAll("#createTracks .create-track").length===10')
        page.click('#createStudio')
        page.click('text=Build song')
        page.wait_for_function('document.querySelectorAll(".create-section").length===6')
        out['names'] = page.eval_on_selector_all('.create-section input', 'els=>els.map(e=>e.value)')
        page.locator('.create-section').nth(2).locator('button').first.click()
        page.wait_for_timeout(300)
        out['selected'] = page.evaluate('GMCEngine.session.state.studio.selectedSection===GMCEngine.session.state.studio.sections[2].id')
        page.locator('.create-section').nth(2).locator('select').nth(1).select_option('2')
        page.wait_for_timeout(300)
        out['repeat'] = page.evaluate('GMCEngine.session.state.studio.sections[2].repeat')
        page.locator('.create-section').nth(5).locator('.create-flag').click()
        page.wait_for_timeout(300)
        out['sections'] = page.evaluate('GMCEngine.session.state.studio.sections.length')
        page.select_option('select[aria-label="Automation target"]', 'master.cutoff')
        page.wait_for_selector('#createLane')
        start = len(page.evaluate('GMCEngine.session.state.studio.automation[0].points'))
        for fx, fy in ((.1, .8), (.5, .2), (.9, .6)):
            lane_click(page, fx, fy)
        out['added'] = len(page.evaluate('GMCEngine.session.state.studio.automation[0].points')) - start
        lane_click(page, .1, .8, double=True)
        out['removed'] = out['added'] + start - len(page.evaluate('GMCEngine.session.state.studio.automation[0].points'))
        page.click('#createPlay')
        page.wait_for_function('GMCEngine.player.playing && GMCEngine.player.step>=8')
        page.click('#createPlay')
        browser.close()
    print(json.dumps({**out, 'errors': errors}, indent=1, ensure_ascii=False))
    checks = {
        'song has six named sections in English': out['names'] == ['Intro', 'Theme A', 'Variation A′', 'Break', 'Theme B', 'Ending'],
        'edit selects a section': out['selected'],
        'repeat is stored': out['repeat'] == 2,
        'a section can be removed': out['sections'] == 5,
        'clicks add automation points': out['added'] == 3,
        'double-click removes a point': out['removed'] == 1,
        'no browser errors': not errors,
    }
    failed = [k for k, v in checks.items() if not v]
    print('failed:', failed)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
