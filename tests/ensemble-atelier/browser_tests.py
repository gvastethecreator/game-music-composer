import os
"""Offline browser proof. File navigation was blocked by host policy; uses set_content.
No network or autoplay-policy overrides. Requires Playwright + system Chromium.
Artifacts stay within this Brainstormer session, not the production repository.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json, struct, time, os
B=Path(os.environ.get('GMC_LAB_DIR', '.scratch/ensemble-atelier')).resolve();OUT=B/'qa/results';OUT.mkdir(exist_ok=True)
SCREENSHOTS=Path('.scratch/screenshots/ensemble-atelier');SCREENSHOTS.mkdir(parents=True,exist_ok=True)
report={'date':'2026-09-08','loading':'Standalone HTML via page.set_content; file:// blocked by environment policy in initial probe','audio':'Web Audio started by explicit button interactions; no autoplay-policy override','checks':[],'pages':{},'audio_metrics':{},'external_requests':[],'errors':[]}
def check(name,value):
 report['checks'].append({'name':name,'pass':bool(value)});print(name, bool(value),flush=True)
 if not value:raise AssertionError(name)
def change(page,selector,value):
 page.locator(selector).evaluate('(el,value)=>{el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}',str(value))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 report['browser']=browser.version
 for id in ([os.environ['GMC_TEST_ID']] if os.environ.get('GMC_TEST_ID') else ['I001','I002','I003','I004','I005']):
  page=browser.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1,accept_downloads=True)
  errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('https:','http:')) else None)
  page.route('https://**',lambda r:r.abort());page.route('http://**',lambda r:r.abort())
  page.set_content((B/'ideas'/id/'prototype.html').read_text(),wait_until='load');page.wait_for_timeout(120)
  check(id+' loaded',page.evaluate('!!window.LAB && LAB.score.events.length>0'))
  base=page.evaluate('LAB.signature()')
  check(id+' desktop overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check(id+' card count',page.evaluate('document.querySelectorAll(".instrument").length===LAB.score.tracks.length'))
  # Every score pitch has a real keyed target somewhere on its own instrument (including chromatic rail).
  check(id+' all played pitches represented',page.evaluate('''()=>LAB.score.events.every(e=>{const c=LAB.stage.cards.get(e.track);return !!c.querySelector(`[data-note="${e.midi}"]`);})'''))
  page.locator('#play').click();page.wait_for_function('LAB.transport.playing',timeout=60000);page.wait_for_timeout(1400)
  check(id+' sound clock running',page.evaluate("LAB.sound.ctx.state==='running' && LAB.transport.playing"))
  check(id+' events scheduled',page.evaluate('LAB.transport.scheduled.length>0'))
  page.screenshot(path=str(SCREENSHOTS/(id+'-desktop.png')),full_page=True)
  page.locator('#stop').click();page.wait_for_timeout(80)
  check(id+' stop cleanup',page.evaluate('!LAB.transport.playing && LAB.transport.timer===null && LAB.sound.voices.size===0'))
  # A physical SVG hit, not just JS invocation; label layers must not intercept it.
  key=page.locator('.instrument').first.locator('[data-note]').first
  key.click(force=True);page.wait_for_timeout(100)
  check(id+' virtual key emits sound',page.evaluate('LAB.sound.previewCount===1'))
  check(id+' actual note lit',page.locator('.lit').count()>0)
  page.wait_for_timeout(620)
  page.locator('.instrument').first.locator('.solo').click()
  check(id+' solo',page.evaluate('!!LAB.transport.solo'))
  page.locator('.instrument').first.locator('.solo').click()
  page.locator('.instrument').first.locator('.mute').click()
  check(id+' mute',page.evaluate('LAB.transport.muted.size===1'))
  page.locator('.instrument').first.locator('.mute').click()
  if id=='I001':
   change(page,'#patch','kalimba');count=page.locator('.instrument').count();page.locator('#add-instrument').click()
   check(id+' add virtual instrument',page.locator('.instrument').count()==count+1)
   page.locator('#capture').click();old=page.evaluate('LAB.score.events.length')
   page.locator('.instrument').last.locator('[data-note]').first.click(force=True);page.wait_for_timeout(100)
   check(id+' captured note in score',page.evaluate('LAB.score.events.length')==old+1)
   check(id+' captured cursor',page.evaluate('LAB.params.cursor===.5'))
   page.locator('#capture').click()
   # Use hit geometry to click a real piano-roll event and modify it.
   page.locator('#roll').scroll_into_view_if_needed();g=page.evaluate('({x:LAB.roll.hit[0].x+1,y:LAB.roll.hit[0].y+1})');box=page.locator('#roll').bounding_box()
   page.mouse.click(box['x']+g['x'],box['y']+g['y']);check(id+' roll inspector',page.locator('#editor').is_visible())
   old_signature=page.evaluate('LAB.signature()');current=int(page.locator('#note-midi').input_value());page.locator('#note-midi').fill(str(current+1));page.locator('#apply-note').click()
   check(id+' edit changes score',page.evaluate('LAB.signature()')!=old_signature)
   edited_signature=page.evaluate('LAB.signature()');page.locator('#note-beat').fill('0');page.locator('#note-duration').fill('30');page.locator('#apply-note').click()
   check(id+' overlong edit preserves score',page.evaluate('LAB.signature()')==edited_signature and '14 segundos' in page.locator('#status').inner_text())
   page.locator('#undo').click();check(id+' undo restores score',page.evaluate('LAB.signature()')==old_signature)
   native={'id':'canonical_fixture','title':'<img src=x onerror=alert(1)>','bpm':96,'beats':16,'barLength':4,'events':[{'kind':'note','inst':'flute','role':'lead','midi':67,'beat':0,'duration':1,'velocity':90},{'kind':'drum','inst':'kick','role':'kick','beat':1,'velocity':100}], 'instrument_map':{'flute':{'family':'wind','label':'<b>flauta</b>'}}}
   page.locator('#file-import').set_input_files({'name':'canonical-fixture.json','mimeType':'application/json','buffer':json.dumps(native).encode()});page.wait_for_timeout(100)
   check(id+' canonical score import',page.evaluate('LAB.score.origin==="imported-symbolic-score" && LAB.score.events.length===2'))
   check(id+' hostile labels are text',page.locator('#score-title img').count()==0 and page.locator('.instrument-name b').count()==0)
   count=page.evaluate('LAB.score.events.length');page.locator('#file-import').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{bad'});page.wait_for_timeout(70)
   check(id+' bad import retains state',page.evaluate('LAB.score.events.length')==count and 'No se importó' in page.locator('#status').inner_text())
  elif id=='I002':
   original=page.evaluate('LAB.signature()');pocket=page.evaluate('MusicLab.performanceSignature(LAB.score)')
   page.locator('[data-value="grid"]').click();grid=page.evaluate('MusicLab.performanceSignature(LAB.score)')
   check(id+' same score grid',page.evaluate('LAB.signature()')==original)
   check(id+' grid differs in performance',grid!=pocket)
   page.locator('[data-value="jitter"]').click();check(id+' jitter differs',page.evaluate('MusicLab.performanceSignature(LAB.score)')!=grid)
   page.locator('[data-value="pocket"]').click();change(page,'#lead-delay',35)
   check(id+' role delay affects performance',page.evaluate('MusicLab.performanceSignature(LAB.score)')!=pocket)
   check(id+' role delay preserves score',page.evaluate('LAB.signature()')==original)
  elif id=='I003':
   page.locator('[data-value="asymmetric"]').click();check(id+' asymmetric phrase',page.evaluate('JSON.stringify(LAB.score.sections.map(s=>s.end-s.start))==="[12,8,12]"'))
   before=page.evaluate('LAB.signature()');page.locator('#variation').click();check(id+' development variation works',page.evaluate('LAB.signature()')!=before)
   page.locator('[data-value="tiled"]').click();check(id+' inactive variation is disabled',page.locator('#variation').is_disabled())
   tiled=page.evaluate('LAB.score.events.length');page.locator('[data-value="breath"]').click();check(id+' breath removes density',page.evaluate('LAB.score.events.length')<tiled)
  elif id=='I004':
   all_signatures=[]
   for genre in ['neo','dub','garage','footwork','interlock','minimal','bossa','tango','ambient','broken']:
    page.select_option('#genre',genre);all_signatures.append(page.evaluate('LAB.signature()'))
    check(id+' grammar '+genre,page.evaluate('LAB.score.events.length>0 && LAB.score.events.every(e=>Number.isFinite(e.midi))'))
   check(id+' ten concrete scores',len(set(all_signatures))==10)
   page.select_option('#genre','dub');before=page.evaluate('LAB.signature()');page.select_option('#melody-genre','ambient')
   check(id+' cross grammar changes score',page.evaluate('LAB.signature()')!=before)
  else:
   spacing=page.locator('#spacing').input_value();page.select_option('#spacing','0.25')
   shorter=page.evaluate('LAB.score.cycles.spacing===.25 && LAB.score.beats===12');page.locator('#reset').click()
   check(id+' step duration and reset stay in sync',spacing=='0.5' and shorter and page.locator('#spacing').input_value()=='0.5' and page.evaluate('LAB.signature()')==base)
   check(id+' closure 48 steps',page.evaluate('LAB.score.cycles.commonSteps===48'))
   page.locator('[data-value="hocket"]').click();check(id+' hocket exclusive onsets',page.evaluate('new Set(LAB.score.events.map(e=>e.beat)).size===LAB.score.events.length'))
   change(page,'#rotation-0',4);check(id+' rotation changes score',page.evaluate('LAB.signature()')!=base)
   signature=page.evaluate('LAB.signature()');change(page,'#period-0',17)
   check(id+' rejects unsafe LCM without mutation',page.evaluate('LAB.signature()')==signature and 'MCM' in page.locator('#status').inner_text())
   page.locator('[data-value="additive"]').click();check(id+' additive mode',page.evaluate('LAB.score.cycles.method==="additive"'))
  page.locator('#reset').click();check(id+' reset exact signature',page.evaluate('LAB.signature()')==base)
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
  check(id+' mobile overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  page.screenshot(path=str(SCREENSHOTS/(id+'-mobile.png')),full_page=True)
  page.emulate_media(reduced_motion='reduce');check(id+' reduced motion retains controls',page.locator('#play').count()==1)
  page.set_viewport_size({'width':1440,'height':1050})
  with page.expect_download() as d:page.locator('#json').click()
  dest=OUT/(id+'-session.json');d.value.save_as(dest);session=json.loads(dest.read_text())
  check(id+' export JSON',session['kind']=='gmc-brainstorm-session' and session['production_ready'] is False and session['score']['events'])
  # Render actual engine path offline and inspect it; instrument family tests run separately.
  metrics=page.evaluate('''async()=>{const b=await LAB.sound.render(LAB.score);window.TEST_BUFFER=b;let peak=0,energy=0,finite=true,clipped=0;for(let c=0;c<b.numberOfChannels;c++)for(const v of b.getChannelData(c)){if(!Number.isFinite(v))finite=false;peak=Math.max(peak,Math.abs(v));energy+=v*v;if(Math.abs(v)>=1)clipped++;}return{frames:b.length,channels:b.numberOfChannels,sampleRate:b.sampleRate,seconds:b.duration,peak,rms:Math.sqrt(energy/(b.length*b.numberOfChannels)),finite,clipped};}''')
  report['audio_metrics'][id]=metrics
  check(id+' rendered real non-silent audio',metrics['finite'] and metrics['rms']>1e-5 and metrics['clipped']==0)
  # Save the already rendered buffer as a real WAV download (avoids rendering twice).
  with page.expect_download() as d:page.evaluate('''()=>{const u=URL.createObjectURL(SynthLab.wav(TEST_BUFFER)),a=document.createElement('a');a.href=u;a.download='preview.wav';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}''')
  dest=OUT/(id+'-preview.wav');d.value.save_as(dest)
  check(id+' WAV header',dest.read_bytes()[:4]==b'RIFF' and dest.read_bytes()[8:12]==b'WAVE')
  check(id+' no JS errors',not errors);check(id+' offline',not requests)
  report['pages'][id]={'errors':errors,'requests':requests,'screenshot':str(SCREENSHOTS/(id+'-desktop.png'))}
  report['external_requests'].extend(requests);report['errors'].extend(errors)
  page.close()
  print(id,'PASS',metrics,flush=True)
 # Exercise every registry instrument through its generated SVG, on a fixture surface.
 page=browser.new_page(viewport={'width':1000,'height':800})
 page.set_content((B/'ideas/I001/prototype.html').read_text());
 coverage=page.evaluate('''()=>{const result=[];for(const p of Object.values(MusicLab.INST)){const t=MusicLab.track('test',p.id,'lead'),s=MusicLab.makeScore('fixture',[t]),n=p.drum?p.midi:Math.round((p.range[0]+p.range[1])/2);MusicLab.add(s,'test',0,.5,n);MusicLab.finish(s);LAB.stage.build(s,'test');LAB.stage.update(s.events,1);const c=LAB.stage.cards.get('test');result.push({patch:p.id,surface:p.surface,control:!!c.querySelector(`[data-note="${n}"]`),lit:c.querySelectorAll('.lit').length>0,note:c.querySelector('.readout strong').textContent});}return result;}''')
 check('registry all 59 instruments have keyed active surface',len(coverage)==59 and all(x['control'] and x['lit'] for x in coverage));report['registry_coverage']=coverage
 page.close();browser.close()
report['passed']=sum(c['pass'] for c in report['checks']);report['total']=len(report['checks'])
(OUT/('browser-report-'+os.environ.get('GMC_TEST_ID','all')+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS',report['passed'],'/',report['total'])
