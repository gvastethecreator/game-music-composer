"""Create view flows through real controls in Chromium.

Covers first load without notices, play/pause on the audio clock, New song with
the previous song kept as an idea, Variation, Chaos, undo, idea bank load/store,
mute, Studio mode panels, MIDI and WAV downloads, Open in Studio, keyboard
transport and a narrow layout. Screenshots go to .scratch/screenshots/create.
"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
URL = (ROOT / 'game-music-composer-showcase/index.html').as_uri()
OUT = ROOT / '.scratch/screenshots/create'
OUT.mkdir(parents=True, exist_ok=True)
checks = []


def check(name, condition):
    checks.append(name)
    assert condition, name


def settle(page, js, timeout=5000):
    try:
        page.wait_for_function(js, timeout=timeout)
        return True
    except Exception:
        return False


def state(page, expr):
    return page.evaluate(f'GMCEngine.session.state.{expr}')


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.goto(URL)
        page.wait_for_function('window.GMCEngine && document.querySelectorAll("#createTracks .create-track").length===10')
        check('Create is the first view for a new visitor', page.evaluate('document.body.dataset.view') == 'create')
        check('No notice on first load', page.locator('#appNotice').is_hidden())
        check('Ten tracks with English names', page.locator('#createTracks .create-track-name span').all_text_contents()[:3] == ['Kick', 'Snare', 'Hi-hat'])
        check('Chord cards show the progression', page.locator('#createChords .create-chord').count() == len(state(page, 'degrees')))
        page.screenshot(path=str(OUT / 'essential.png'))

        page.locator('#createPlay').click()
        page.wait_for_function('GMCEngine.player.playing && GMCEngine.player.step>=4')
        check('Play schedules steps on the audio clock', page.locator('#createPlay').text_content() == 'Pause')
        preset = state(page, 'preset')
        page.locator('#createNewSong').click()
        page.wait_for_function(f'GMCEngine.session.state.preset!=={json.dumps(preset)}')
        check('New song keeps playing', page.evaluate('GMCEngine.player.playing'))
        check('New song keeps the previous song as an idea', settle(page, 'document.querySelectorAll("#createBank .create-slot.filled").length===1'))
        check('Generated names are shown in English', 'Antes' not in page.locator('#createBank').text_content())
        before = state(page, 'patterns')
        page.locator('#createVariation').click()
        page.locator('#createChaosMode').select_option('mutate')
        page.locator('#createChaos').click()
        page.wait_for_timeout(200)
        page.locator('#createUndo').click()
        page.locator('#createUndo').click()
        check('Two undos return to the new song', state(page, 'patterns') == before)
        page.locator('#createPlay').click()
        check('Pause stops the player', not page.evaluate('GMCEngine.player.playing'))

        page.locator('#createBank .create-slot:not(.filled) .create-slot-main').first.click()
        check('Empty idea slot stores the song', settle(page, 'document.querySelectorAll("#createBank .create-slot.filled").length===2'))
        page.locator('[data-track="kick"] .create-flag').first.click()
        check('Mute changes only the mix flag', state(page, 'tracks[0].mute') is True)
        page.keyboard.press('Control+z')
        check('Ctrl+Z undoes the mute', state(page, 'tracks[0].mute') is False)

        page.locator('#createStudio').click()
        check('Studio mode shows the inspector', settle(page, 'document.querySelector("#createInspector").offsetParent!==null'))
        check('Studio mode shows song shape and master', page.locator('#createShape .create-group').count() >= 4)
        page.locator('[data-track="lead"] .create-track-name').click()
        check('Inspector follows the selected track', settle(page, 'document.querySelector("#createInspector .create-panel-head strong")?.textContent==="Melody"'))
        page.locator('#createInspector select').nth(3).select_option('arp')
        check('Performance mode reaches the engine', state(page, 'tracks[9].performance.mode') == 'arp')
        page.screenshot(path=str(OUT / 'studio.png'), full_page=True)

        page.locator('.create-export summary').click()
        with page.expect_download() as midi:
            page.locator('#createExportMidi').click()
        check('MIDI download', midi.value.suggested_filename.endswith('.mid'))
        check('Export menu closes after a choice', not page.evaluate('document.querySelector(".create-export").open'))
        page.locator('.create-export summary').click()
        with page.expect_download(timeout=180000) as wav:
            page.locator('#createExportWav').click()
        size = Path(wav.value.path()).stat().st_size
        check('WAV download has audio data', size > 500000)

        page.locator('.create-export summary').click()
        page.locator('#createOpenStudio').click()
        page.wait_for_function('document.body.dataset.view==="workstation" && window.testStudio===undefined || document.body.dataset.view==="workstation"')
        page.wait_for_timeout(1500)
        check('Open in Studio lands on the Studio view', page.evaluate('document.body.dataset.view') == 'workstation')
        check('The song is a local Studio score', 'LOCAL' in page.locator('#trackKicker').text_content().upper())
        page.locator('#tab-create').click()
        check('Returning to Create keeps the song', page.locator('#createTracks .create-track').count() == 10)

        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(300)
        overflow = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        page.screenshot(path=str(OUT / 'narrow.png'), full_page=True)
        check('Narrow layout has no horizontal scroll', overflow <= 1)
        check('No browser errors', not errors)
        print(json.dumps({'checks': len(checks), 'passed': checks, 'wavBytes': size, 'errors': errors}, indent=1))
        browser.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
