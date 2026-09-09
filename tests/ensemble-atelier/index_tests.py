import os
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
B=Path(os.environ.get('GMC_LAB_DIR', '.scratch/ensemble-atelier')).resolve();checks=[];errors=[];requests=[]
SCREENSHOTS=Path('.scratch/screenshots/ensemble-atelier');SCREENSHOTS.mkdir(parents=True,exist_ok=True)
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
 assert value,name
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1050},accept_downloads=True)
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('https:','http:')) else None)
 page.set_content((B/'index.html').read_text());page.wait_for_timeout(100)
 check('five distinct entrypoints',page.locator('[data-open]').count()==5)
 check('desktop index without overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 page.screenshot(path=str(SCREENSHOTS/'index-desktop.png'),full_page=True)
 for id in ['I001','I002','I003','I004','I005']:
  page.locator('[data-open="'+id+'"]').click();f=page.frame_locator('#frame');f.locator('#play').wait_for();
  check(id+' embedded document is ready',f.locator('body').evaluate('!!window.LAB && LAB.score.events.length>0'))
  f.locator('#play').click();page.wait_for_function("document.getElementById('frame').contentWindow.LAB?.transport.playing",timeout=60000);page.wait_for_timeout(150)
  check(id+' embedded audio started by click',f.locator('body').evaluate('LAB.transport.playing && LAB.sound.ctx.state==="running"'))
  if id=='I001':
   f.locator('.mute').first.click();f.locator('#reset').click();check('reset also clears mute and solo',f.locator('body').evaluate('LAB.transport.muted.size===0 && LAB.transport.solo===null'))
  page.locator('#close').click();check(id+' close removes old document',page.locator('#frame').get_attribute('srcdoc')=='')
 with page.expect_download() as d:page.locator('[data-file="I003"]').click()
 target=B/'qa/results/index-saved-I003.html';d.value.save_as(target)
 check('standalone download equals source',target.read_text()==(B/'ideas/I003/prototype.html').read_text());target.unlink()
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(80)
 check('mobile index without overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 page.screenshot(path=str(SCREENSHOTS/'index-mobile.png'),full_page=True)
 check('no javascript errors',not errors);check('no network requests',not requests)
 b.close()
result={'loading':'set_content; embedded prototypes via srcdoc','checks':checks,'passed':sum(x['pass'] for x in checks),'errors':errors,'requests':requests}
(B/'qa/results/index-report.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS',len(checks),'checks')
