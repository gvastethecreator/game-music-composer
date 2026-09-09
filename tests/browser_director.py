from pathlib import Path
import json
import argparse
import shutil
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description='Optional Playwright checks of the bundled Director document; not a hosted-site test.')
parser.add_argument('--out-dir',required=True,type=Path)
parser.add_argument('--chromium',default=shutil.which('chromium'))
args=parser.parse_args()
args.out_dir.mkdir(parents=True,exist_ok=False)
root=Path(__file__).resolve().parents[1]/'labs'/'composer-director'
result={'document_loading':'Bundled source via page.set_content; file/http navigation not exercised', 'browser':'Chromium','checks':{},'errors':[],'external_requests':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--autoplay-policy=no-user-gesture-required'])
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    page.on('pageerror',lambda e:result['errors'].append(str(e)))
    page.on('request',lambda r:result['external_requests'].append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith('http://127.0.0.1:') else None)
    page.set_content((root/'index.html').read_text(encoding='utf-8').replace('<script src="director.js"></script>', '<script>'+(root/'director.js').read_text(encoding='utf-8')+'</script>'))
    result['checks']['theme_count']=page.locator('[data-theme]').count()==3
    result['checks']['state_count']=page.locator('[data-state]').count()==4
    result['checks']['desktop_no_overflow']=page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#play').click();page.wait_for_timeout(200)
    result['checks']['audio_running']=page.evaluate("context && context.state==='running' && playing")
    page.locator('[data-state="battle"]').click();page.wait_for_timeout(2700)
    result['checks']['state_scheduled']=page.evaluate("scheduledVersion===selectedVersion && options.state==='battle'")
    page.locator('#stop').click();page.wait_for_timeout(200)
    result['checks']['stop_cleans_voices']=page.evaluate('!playing && timer===null && voices.size===0')
    page.locator('#lock').click()
    result['checks']['selection_lock']=page.locator('[data-theme]:disabled').count()==3
    page.locator('#vary').click()
    result['checks']['scoped_revision']=('conservados respecto a B=1: sí' in page.locator('#evidence').inner_text())
    with page.expect_download() as d:
        page.locator('#export').click()
    artifact=args.out_dir/'director-session-example.json';d.value.save_as(artifact)
    session=json.loads(artifact.read_text(encoding='utf-8'))
    result['checks']['export_valid']=session['kind']=='composer-director-session' and session['production_ready'] is False
    page.screenshot(path=str(args.out_dir/'director-desktop.png'),full_page=True)
    # Offline render measures actual Web Audio signal, not human listening quality.
    result['offline_audio']=page.evaluate('''async()=>{
      const c=new OfflineAudioContext(2,48000*8,48000),g=c.createGain();g.gain.value=.3;g.connect(c.destination);
      const s=ComposerDirector.reduction(ComposerDirector.compose({theme:'pilgrim',state:'explore',answerSeed:0}));
      for(const e of s.events.filter(e=>e.beat<12)){
        const o=c.createOscillator(),a=c.createGain(),t=e.beat*.625,d=e.duration*.625;
        o.type=e.role==='lead'?'triangle':'sine';o.frequency.value=440*Math.pow(2,(e.midi-69)/12);
        a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(e.amplitude,t+.012);a.gain.setValueAtTime(e.amplitude,t+Math.max(.015,d-.025));a.gain.linearRampToValueAtTime(0,t+d+.035);
        o.connect(a);a.connect(g);o.start(t);o.stop(t+d+.04);
      }
      const b=await c.startRendering(),x=b.getChannelData(0);let peak=0,energy=0,finite=true;
      for(const v of x){if(!Number.isFinite(v))finite=false;peak=Math.max(peak,Math.abs(v));energy+=v*v;}
      return {frames:b.length,sample_rate:b.sampleRate,peak,rms:Math.sqrt(energy/x.length),finite,scope:'8s synthetic reduction only; not Neo-SPC or full master'};
    }''')
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(args.out_dir/'director-mobile.png'),full_page=True)
    result['checks']['mobile_no_overflow']=page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    # Reduced motion renders the same controls and does not require animation.
    page.emulate_media(reduced_motion='reduce')
    result['checks']['reduced_motion_controls']=page.locator('#play').is_visible()
    browser.close()
(args.out_dir/'director-browser-checks.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
assert all(result['checks'].values()) and not result['errors'] and not result['external_requests']
assert result['offline_audio']['finite'] and 0<result['offline_audio']['rms']<.5
