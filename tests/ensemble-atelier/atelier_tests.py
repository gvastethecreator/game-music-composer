import os
"""Focused R03 browser regression checks; uses local bundled source, no live network."""
from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
B=Path(os.environ.get('GMC_LAB_DIR', '.scratch/ensemble-atelier')).resolve();OUT=B/'qa/results';OUT.mkdir(exist_ok=True)
checks=[];errors=[];requests=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)});print(name,bool(value),flush=True);assert value,name
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1536,'height':1100});page.set_default_timeout(7000)
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
 page.set_content((B/'ideas/I001/prototype.html').read_text());page.wait_for_timeout(150)
 check('13 surface types / 59 instrument identities',page.evaluate('new Set(Object.values(MusicLab.INST).map(p=>p.surface)).size===13 && Object.keys(MusicLab.INST).length===59'))
 check('each card has expanded instrument action',page.locator('.atelier-instrument .expand').count()==page.evaluate('LAB.score.tracks.length'))
 check('real analyser output separate from VEL',page.locator('.master-scope canvas').count()==1 and 'VEL' in page.locator('.atelier-instrument footer').first.inner_text())
 page.locator('#view-labels').click();check('note pads can be hidden',page.locator('#instruments').evaluate("e=>e.classList.contains('hide-pads')"));page.locator('#view-labels').click()
 # Cancel during the worker preparation phase, not only during playback.
 page.locator('#play').click();page.wait_for_timeout(70);page.locator('#stop').click();page.wait_for_timeout(300)
 check('preparation cancellation prevents stale playback',page.evaluate('!LAB.transport.playing && !LAB.transport.starting && LAB.sound.prepareCancel===null'))
 page.locator('#play').click();page.wait_for_function('LAB.transport.playing',timeout=60000);page.wait_for_timeout(400)
 check('play starts after preparation',page.evaluate('LAB.sound.ctx.state==="running" && LAB.sound.cache.size>0 && LAB.transport.playing'))
 check('output timestamp does not run ahead of audio clock',page.evaluate('LAB.sound.displayTime()>=0 && LAB.sound.displayTime()<=LAB.sound.ctx.currentTime+.01'))
 check('actual audio sample waveform nonzero',page.evaluate('(()=>{let a=new Float32Array(LAB.sound.analyser.fftSize);LAB.sound.analyser.getFloatTimeDomainData(a);return a.some(x=>Math.abs(x)>.00001)})()'))
 page.locator('.expand').first.click();check('focus uses a modal dialog',page.evaluate('LAB.stage.dialog.open'))
 check('focus has large touch note targets',page.locator('.focus-body .note-pad').first.evaluate('e=>e.getBoundingClientRect().width>=44 && e.getBoundingClientRect().height>=44'))
 # Focus screenshot captured separately to avoid timing-heavy image work in checks.
 page.keyboard.press('Escape');check('Escape closes focus without stopping music',page.evaluate('!LAB.stage.dialog.open && LAB.transport.playing'))
 page.locator('#view-motion').click();check('motion can be disabled explicitly',page.evaluate('LAB.stage.reduced'))
 page.emulate_media(reduced_motion='reduce');page.locator('#view-motion').click();check('OS reduced motion wins over visual toggle',page.evaluate('LAB.stage.reduced'))
 page.emulate_media(reduced_motion='no-preference');page.wait_for_timeout(100)
 page.evaluate('LAB.stop()');page.wait_for_timeout(200);check('stop clears audio timer and active keys',page.evaluate('!LAB.transport.playing && LAB.transport.timer===null && LAB.sound.voices.size===0 && !document.querySelector(".atelier-instrument .lit")'))
 # Replay uses prepared voices without spending seconds on the main thread.
 page.locator('#play').click();page.wait_for_function('LAB.transport.playing',timeout=10000);check('cached replay works',page.evaluate('LAB.transport.playing'));page.locator('#stop').click()
 # Play every family at a comfortably sized actual note control.
 for surface in ['keys','fret','bow','harp','wind','brass','choir','bellows','mallet','bells','tines','synth','drum']:
  result=page.evaluate('''surface=>{const p=Object.values(MusicLab.INST).find(x=>x.surface===surface),n=p.drum?p.midi:Math.floor((p.range[0]+p.range[1])/2);const t=MusicLab.track('solo',p.id,'lead'),s=MusicLab.makeScore('Focus '+p.label,[t]);MusicLab.add(s,'solo',0,.5,n);MusicLab.finish(s);LAB.stage.build(s,'solo');LAB.stage.focus('solo');LAB.stage.update(s.events,1);return{lit:!!LAB.stage.dialog.querySelector('.lit'),svg:!!LAB.stage.dialog.querySelector('svg'),note:n,patch:p.id};}''',surface)
  check('focus '+surface+' displays actual note',result['lit'] and result['svg'])
  # Visual snapshots of these surfaces are stored by the separate smoke run.
  page.keyboard.press('Escape')
 page.evaluate('LAB.reset()');page.set_viewport_size({'width':390,'height':844});page.evaluate('LAB.stage.focus(LAB.score.tracks[0].id)')
 check('mobile focus stays within viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth && LAB.stage.dialog.getBoundingClientRect().width<=innerWidth'))
 page.keyboard.press('Escape')
 check('no observed JS errors',not errors);check('no observed external requests',not requests)
 browser.close()
report={'date':'2026-09-08','loading':'set_content; no autoplay override','checks':checks,'errors':errors,'external_requests':requests,'passed':len(checks),'total':len(checks)}
(OUT/'atelier-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('PASS',len(checks))
