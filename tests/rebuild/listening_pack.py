"""Build a blind listening pack: for each fixture, three versions with shuffled labels.

  A  catalog cue through the Studio sample banks (Studio WAV export, cue palette)
  B  the same notes through the synthesis engine (Studio -> Open in Create -> WAV)
  C  a new Create song in the closest engine style (fixed seed)

Level matching: RMS to -20 dBFS with peaks kept under -1 dBFS (declared method; not
LUFS). Writes .scratch/listening/<fixture>/{X,Y,Z}.wav, index.html (player + answer
sheet) and key.json (the answers; open it only after listening).
"""
import array
import json
import math
import random
import sys
import wave
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
URL = (ROOT / 'game-music-composer-showcase/index.html').as_uri()
OUT = ROOT / '.scratch/listening'
FIXTURES = [
    ('lofi_00_dust_piano', 'lofi'), ('dnb_00_fast_break', 'liquid'), ('synthwave_00_gated_box', 'synthwave'),
    ('house_00_four_on_floor', 'micro'), ('bossa_nova_00_partido_alto', 'bossa'), ('trap_chrome_staircase', 'trap'),
]
TARGET_RMS, PEAK_CEILING = 10 ** (-20 / 20), 10 ** (-1 / 20)


def level_match(src: Path, dst: Path) -> dict:
    with wave.open(str(src)) as w:
        channels, width, rate = w.getnchannels(), w.getsampwidth(), w.getframerate()
        frames = w.readframes(w.getnframes())
    assert width == 2, 'expected 16-bit PCM'
    data = array.array('h', frames)
    rms = math.sqrt(sum(x * x for x in data) / max(1, len(data))) / 32768
    peak = max(abs(x) for x in data) / 32768 if data else 0
    gain = min(TARGET_RMS / rms if rms else 1, PEAK_CEILING / peak if peak else 1)
    out = array.array('h', (max(-32768, min(32767, round(x * gain))) for x in data))
    with wave.open(str(dst), 'wb') as w:
        w.setnchannels(channels); w.setsampwidth(2); w.setframerate(rate); w.writeframes(out.tobytes())
    return {'rmsIn': round(rms, 5), 'peakIn': round(peak, 5), 'gainDb': round(20 * math.log10(gain), 2), 'seconds': round(len(data) / channels / rate, 2)}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rng = random.Random(20260925)
    key, rows = {}, []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        page = context.new_page()
        cues = sorted(f.stem for f in (ROOT / 'game-music-composer-showcase/data/cues').glob('*.js'))
        for fixture, preset in FIXTURES:
            cue = next(c for c in cues if c.startswith(fixture))
            folder = OUT / cue
            folder.mkdir(exist_ok=True)
            raw = {}
            page.goto(URL + f'?cue={cue}&view=workstation')
            page.wait_for_function('document.querySelector("#studioOpenCreate") && window.GMCCreate && document.querySelector("#trackTitle").textContent.length>0')
            page.wait_for_timeout(2500)
            with page.expect_download(timeout=240000) as d:
                page.get_by_role('button', name='WAV ↓').click()
            raw['A'] = folder / 'raw_A.wav'; d.value.save_as(raw['A'])
            page.locator('#studioOpenCreate').click()
            page.wait_for_function('document.body.dataset.view==="create"')
            page.locator('.create-export summary').click()
            with page.expect_download(timeout=240000) as d:
                page.locator('#createExportWav').click()
            raw['B'] = folder / 'raw_B.wav'; d.value.save_as(raw['B'])
            page.evaluate(f"GMCEngine.session.replace(GMCEngine.compose('LISTEN-{preset.upper()}', '{preset}'))")
            page.wait_for_timeout(300)
            page.locator('.create-export summary').click()
            with page.expect_download(timeout=240000) as d:
                page.locator('#createExportWav').click()
            raw['C'] = folder / 'raw_C.wav'; d.value.save_as(raw['C'])
            labels = ['X', 'Y', 'Z']; rng.shuffle(labels)
            key[cue] = {}
            for version, label in zip('ABC', labels):
                measures = level_match(raw[version], folder / f'{label}.wav')
                key[cue][label] = {'version': version, **measures}
                raw[version].unlink()
            rows.append(cue)
            print(cue, 'done')
        browser.close()
    (OUT / 'key.json').write_text(json.dumps({'versions': {'A': 'catalog cue, Studio sample banks', 'B': 'same notes, synthesis engine', 'C': 'new Create song, closest style'}, 'method': 'RMS to -20 dBFS, peak under -1 dBFS', 'fixtures': key}, indent=1), encoding='utf-8')
    page_rows = '\n'.join(f'<section><h2>{i + 1}. {cue}</h2>' + ''.join(f'<div class="v"><b>{l}</b><audio controls preload="none" src="{cue}/{l}.wav"></audio></div>' for l in 'XYZ') +
                          f'<label>Prefer <select name="{cue}.prefer"><option></option><option>X</option><option>Y</option><option>Z</option><option>no preference</option></select></label>'
                          f'<label>Why <input name="{cue}.why" size="60"></label></section>' for i, cue in enumerate(rows))
    (OUT / 'index.html').write_text(f"""<!doctype html><meta charset="utf-8"><title>Blind listening</title>
<style>body{{font:15px system-ui;background:#111;color:#eee;max-width:900px;margin:24px auto;padding:0 16px}}section{{border:1px solid #333;border-radius:8px;padding:12px;margin:12px 0}}.v{{display:flex;gap:10px;align-items:center;margin:6px 0}}label{{display:block;margin-top:8px}}input,select{{background:#000;color:#eee;border:1px solid #444;padding:4px}}</style>
<h1>Blind listening</h1><p>Each fixture has three versions at matched RMS level, in random order. Listen at a fixed volume, more than once, in any order. Choose one or “no preference” and say why: identity, groove, harmony, timbre, mix or fit for a game. Do not open key.json until you finish.</p>
<form id="f">{page_rows}<p><button type="button" id="save">Download my answers</button></p></form>
<script>document.getElementById('save').onclick=()=>{{const data=Object.fromEntries(new FormData(document.getElementById('f')));data.date=new Date().toISOString();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{{type:'application/json'}}));a.download='listening-answers.json';a.click();}};</script>""", encoding='utf-8')
    print('Pack:', OUT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
