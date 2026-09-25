"""Game music in Create: states, bar-quantized switches, package export and the runtime."""
import base64
import json
import sys
import zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
url = (ROOT / 'game-music-composer-showcase/index.html').as_uri() + '?view=create'
out = {}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); ctx=b.new_context(viewport={'width':1440,'height':1000},accept_downloads=True); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(url); pg.wait_for_function('document.querySelectorAll("#createTracks .create-track").length===10')
    pg.click('#createStudio'); pg.click('text=Add game states'); pg.wait_for_function('document.querySelectorAll("[data-game-state]").length===5')
    pg.click('#createPlay'); pg.wait_for_function('GMCEngine.player.playing && GMCEngine.player.step>=2')
    pg.click('[data-game-state="combat"]')
    out['pending']=pg.evaluate('GMCEngine.director.pending?.id')
    pg.wait_for_function('GMCEngine.director.active==="combat"',timeout=15000)
    out['switched_at_bar']=pg.evaluate('GMCEngine.player.step')
    out['chip_active']=pg.evaluate('document.querySelector("[data-game-state=combat]").classList.contains("active")')
    pg.click('#createPlay')
    with pg.expect_download(timeout=240000) as d:
        pg.click('text=Export game package')
    zp=d.value.path(); z=zipfile.ZipFile(zp); names=z.namelist(); out['zip']=names
    man=json.loads(z.read('manifest.json')); out['manifest']={k:man[k] for k in ('bpm','bars','loopSeconds','initialState')}
    sizes={n:len(z.read(n)) for n in names if n.endswith('.wav')}; out['wav_sizes']=sizes
    files={n:base64.b64encode(z.read(n)).decode() for n in names if n.endswith('.wav')}
    rt=z.read('gmc-music-director.js').decode()
    page2=ctx.new_page(); page2.set_content('<!doctype html><title>runtime</title>'); page2.add_script_tag(content=rt)
    res=page2.evaluate("""async ([man,files])=>{const fetcher=async u=>({json:async()=>man,arrayBuffer:async()=>Uint8Array.from(atob(files[u]),c=>c.charCodeAt(0)).buffer});const d=new GMCMusicDirector({manifest:man});await d.load(fetcher);d.start('explore');await new Promise(r=>setTimeout(r,300));const at=d.setState('combat');const bar=240/man.bpm;return {loaded:[...d.buffers.keys()],at:at-d.startTime,bar,aligned:Math.abs(((at-d.startTime)/bar)-Math.round((at-d.startTime)/bar))<1e-6,pending:d.pending?.id};}""",[man,files])
    out['runtime']=res
    out['errors']=errs
    b.close()
print(json.dumps(out, indent=1))
checks = {
    'switch waits for the next bar': out['pending'] == 'combat' and out['chip_active'],
    'package has manifest, project, runtime and one loop per state': {'manifest.json', 'project.json', 'gmc-music-director.js', 'README.txt'} <= set(out['zip']) and len(out['wav_sizes']) == 4,
    'all state loops have the same length': len(set(out['wav_sizes'].values())) == 1,
    'runtime loads every state': sorted(out['runtime']['loaded']) == ['calm', 'combat', 'explore', 'tension'],
    'runtime switches on a bar line': out['runtime']['aligned'] and out['runtime']['pending'] == 'combat',
    'no browser errors': not out['errors'],
}
failed = [k for k, v in checks.items() if not v]
print('failed:', failed)
sys.exit(1 if failed else 0)
