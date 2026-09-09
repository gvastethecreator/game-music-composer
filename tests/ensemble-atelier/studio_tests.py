"""Exercise the shared native studio through its real browser controls."""
import json
import os
import sys
from pathlib import Path
import wave
import array
import hashlib
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.scratch/screenshots/studio-integration'
OUT.mkdir(parents=True, exist_ok=True)
URL = (ROOT / 'game-music-composer-showcase/index.html').as_uri()
HOOK = """for(const [name,key] of [['NeoSpcLiveEngine','testEngine'],['StudioAtelier','testStudio']])Object.defineProperty(window,name,{configurable:true,set(value){Object.defineProperty(window,name,{configurable:true,writable:true,value:new Proxy(value,{construct(target,args){const object=Reflect.construct(target,args);if(!window[key])window[key]=object;return object;}})});}});"""

def settled(page):
    page.wait_for_function('window.testStudio?.native && !testStudio.busy && !document.querySelector("#playButton").disabled')


def check_mix_layout(page,check):
    import numpy as np, soundfile as sf, pyloudnorm as pyln
    out=ROOT/'.scratch/mix-layout-repair'
    page.goto(URL+'?cue=bachata_carta_sin_sello&bank=snes&view=workstation');settled(page)
    original=page.evaluate('testStudio.native.events')
    results=[]
    for patch in ('keys.electric_piano','bass.electric_finger','guitar.requinto'):
        for bank in ('factory','velvet','circuit','timber','prism','voltage','megadrive','snes','original','chip'):
            waves=page.evaluate("""async({patch,bank})=>{
                const info={...STUDIO_INSTRUMENTS.piano,factory_patch:patch,family:patch.startsWith('bass')?'bass':'keys',mix_trim_db:0};
                const style={...testStudio.native,beats:2,bpm:120,instrument_map:{piano:info},events:[{inst:'piano',kind:'note',role:'lead',beat:0,duration:1.5,midi:60,velocity:115,velocity_gain:1,attack:.005,release:.04,send:0,pan:0}]};
                const settings={bankMode:bank,tempoPct:100,transpose:0,masterDb:-3,ceilingDb:-1,instrumentVolumes:new Map()};
                const original=NeoSpcLiveEngine.prototype.sampleGain,output=[];
                try{for(const calibrated of [false,true]){
                    NeoSpcLiveEngine.prototype.sampleGain=calibrated?original:()=>1;
                    const blob=await testEngine.renderWav(style,settings),data=new Int16Array(await blob.arrayBuffer(),44);
                    output.push(Array.from({length:12800},(_,i)=>data[i*2]/32768));
                }}finally{NeoSpcLiveEngine.prototype.sampleGain=original}return output;
            }""",{'patch':patch,'bank':bank})
            before,after=[float(pyln.Meter(32000,block_size=.2).integrated_loudness(np.asarray(x))) for x in waves]
            check(patch+' '+bank+' calibrated export is finite and unclipped',np.isfinite(after) and .001<max(map(abs,waves[1]))<.99)
            results.append({'patch':patch,'bank':bank,'before':before,'after':after})
    (out/'browser-levels.json').write_text(json.dumps(results,indent=2)+'\n')
    for patch in ('keys.electric_piano','bass.electric_finger','guitar.requinto'):
        subset=[r for r in results if r['patch']==patch and r['bank'] not in ('original','chip')]
        before=np.ptp([r['before'] for r in subset]);after=np.ptp([r['after'] for r in subset])
        print(patch,'bank spread',round(float(before),2),'to',round(float(after),2),'dB',flush=True)
        check(patch+' reduces the cross-bank level spread',after<before and after<5)
        all_levels=[r['after'] for r in results if r['patch']==patch]
        check(patch+' keeps all ten modes within 4 dB',np.ptp(all_levels)<4)
    check('Calibration preserves every written event',page.evaluate('testStudio.native.events')==original)
    for width,height in [(1440,900),(1024,768),(390,844)]:
        page.set_viewport_size({'width':width,'height':height});page.locator('#tab-workstation').click();page.locator('#dock-tab-mixer').click()
        check(str(width)+' has no page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        if width>800:
            check(str(width)+' mixer controls fit vertically',page.locator('.instrument-row input').evaluate_all('(xs)=>xs.every(x=>{let r=x.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})'))
            check(str(width)+' all five mixer strips fit horizontally',page.locator('.instrument-row').evaluate_all('(xs)=>xs.every(x=>{let r=x.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})'))
        page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/f'final-mixer-{width}.png'))
        page.locator('#dock-tab-instruments').click();page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/f'final-studio-{width}.png'))
        page.locator('#tab-soundbank').click();page.wait_for_selector('.bank-patch-row')
        check(str(width)+' bank controls do not overflow page',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.locator('#bankPaletteSelect').select_option('prism');check(str(width)+' palette selector updates the actual engine',page.evaluate("testEngine.bankMode==='prism'"));page.locator('#bankPaletteSelect').select_option('snes')
        if width>800:check(str(width)+' patch browser owns the first screen',page.locator('#bankTitle').bounding_box()['y']<400)
        page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/f'final-bank-{width}.png'))
    page.set_viewport_size({'width':1440,'height':900});page.locator('#tab-workstation').click()
    page.locator('#searchInput').fill('missing-cue-314159');check('Empty library retains recovery',page.locator('#clearTrackFilters').is_visible());page.locator('#clearTrackFilters').click()
    page.locator('#soundbankMode').select_option('snes');page.locator('#playButton').click();page.wait_for_function('testEngine.playing')
    page.wait_for_function('()=>{const a=new Float32Array(512);testEngine.analyserL.getFloatTimeDomainData(a);return a.some(x=>Math.abs(x)>.001)}')
    check('Calibrated real score plays',page.evaluate('testEngine.playing'));page.locator('#stopButton').click()
    page.goto(URL+'?cue=reggaeton_patio_encendido&bank=timber&view=workstation');settled(page);page.set_viewport_size({'width':1024,'height':768});page.locator('#dock-tab-mixer').click()
    page.locator('.instrument-activity').evaluate('(e)=>e.scrollLeft=e.scrollWidth')
    check('Dense eight-part mixer keeps its last fader reachable',page.locator('.instrument-row input').last.evaluate('(e)=>{let r=e.getBoundingClientRect();return r.right<=innerWidth && r.bottom<=innerHeight}'))
    page.screenshot(path=str(out/'final-dense-mixer-1024.png'))

def check_resonant_banks(page,check,palettes=("timber","prism","voltage")):
    page.goto(URL+'?cue=bachata_carta_sin_sello&bank=timber&view=workstation');settled(page)
    page.evaluate("localStorage.setItem('neospc-studio-prefs',JSON.stringify({mode:'mastered'}))")
    page.reload();settled(page)
    check('An explicit bank link overrides a saved mastered-audio mode',page.locator('#playbackMode').input_value()=='live')
    original=page.evaluate('testStudio.native.events');hashes=[]
    for palette in palettes:
        page.locator('#soundbankMode').select_option(palette)
        page.locator('#playButton').click();page.wait_for_function('testEngine.playing')
        peak=page.evaluate('''async()=>{let peak=0;const end=performance.now()+1500;while(performance.now()<end){const a=new Float32Array(512);testEngine.analyserL.getFloatTimeDomainData(a);for(const v of a)peak=Math.max(peak,Math.abs(v));await new Promise(requestAnimationFrame)}return peak}''')
        check(palette+f' produces unclipped live output (peak {peak:.6f})',.002<peak<1)
        paths=page.evaluate('testStudio.native.events.map(e=>testEngine.resolveSample(testStudio.native.instrument_map[e.inst],e).file)')
        check(palette+' resolves every event through its own samples',all(p.startswith(palette+'/') for p in paths))
        check(palette+' preserves the written composition',page.evaluate('testStudio.native.events')==original)
        page.locator('#stopButton').click()
        with page.expect_download(timeout=120000) as download:page.locator('#studioWav').click()
        wav_path=OUT/(palette+'-export.wav');download.value.save_as(wav_path);settled(page)
        with wave.open(str(wav_path),'rb') as wav:
            samples=array.array('h',wav.readframes(wav.getnframes()))
            check(palette+' exports non-silent stereo WAV',wav.getnchannels()==2 and wav.getframerate()==32000 and 100<max(map(abs,samples))<32767)
        hashes.append(hashlib.sha256(wav_path.read_bytes()).hexdigest())
        page.locator('#tab-soundbank').click();page.wait_for_selector('.bank-patch-row')
        check(palette+' exposes 54 playable patches',page.locator('.bank-patch-row').count()==54)
        check(palette+' inspector follows the selected bank',page.locator('#bankRegionTable').inner_text().find('_v52.' if palette in ('megadrive','snes') else '_v42_')>=0)
        check(palette+' does not play a different bank as its high-rate preview',page.locator('[data-bank-profile="neo32"]').is_disabled())
        if palette in ('megadrive','snes'):
            page.locator('.bank-palette-overview > summary').click() if not page.locator('.bank-palette-overview').evaluate('(e)=>e.open') else None
            audio=page.locator(f'[data-soundbank-card="{palette}"] audio')
            audio.evaluate('(a)=>a.play()');page.wait_for_function('(name)=>{const a=document.querySelector(`[data-soundbank-card="${name}"] audio`);return !a.paused && a.currentTime>0.1}',arg=palette)
            check(palette+' native emulator demo plays',audio.evaluate('(a)=>a.duration>4 && a.duration<6'))
            page.locator('#tab-workstation').click();page.locator('#playButton').click();page.wait_for_function('testEngine.playing')
            check(palette+' Studio playback pauses the native demo',audio.evaluate('(a)=>a.paused'))
            page.locator('#stopButton').click();page.locator('#tab-soundbank').click()
            with page.expect_download() as download:page.locator(f'a[href="downloads/{palette}-soundpack.zip"]').click()
            path=OUT/(palette+'-soundpack.zip');download.value.save_as(path)
            import zipfile
            with zipfile.ZipFile(path) as archive:
                check(palette+' downloads native source and playable file','console_soundpack.py' in archive.namelist() and ('demo.vgm' if palette=='megadrive' else 'demo.spc') in archive.namelist())
            page.screenshot(path=str(OUT/(palette+'-bank.png')),full_page=True)
        elif palette=='timber':page.screenshot(path=str(OUT/'timber-bank.png'),full_page=True)
        page.locator('#tab-workstation').click()
    check('Selected banks produce distinct exports',len(set(hashes))==len(palettes))
    page.locator('#soundbankMode').select_option('factory');page.locator('#tab-soundbank').click()
    check('Chamber retains its representative preview',page.locator('[data-bank-profile="neo32"]').is_enabled())
    page.locator('#tab-workstation').click()
    page.locator('#soundbankMode').select_option('timber');page.locator('#playButton').click();page.wait_for_function('testEngine.playing')
    page.screenshot(path=str(OUT/'timber-playing.png'));page.locator('#stopButton').click()

def check_genre_collections(page,check):
    for genre,palette in [('bachata','factory'),('trip_hop','velvet'),('trap','factory'),('reggaeton','factory')]:
        page.goto(URL+'?cue='+{'bachata':'bachata_balcon_de_sal','trip_hop':'trip_hop_static_at_dawn','trap':'trap_chrome_staircase','reggaeton':'reggaeton_faro_de_neon'}[genre]+'&catalog=four-genres-1&view=workstation');settled(page)
        page.locator('.category-picker summary').click()
        page.locator(f'#categoryTabs button[data-id="{genre}"]').click();settled(page)
        check(genre+' has ten selectable cues',page.locator('#trackList .track-row').count()==10)
        check(genre+' selects its production palette',page.locator('#soundbankMode').input_value()==palette)
        check(genre+' uses the dedicated native writer',page.evaluate('testStudio.native.writing_evidence.grammar')==genre)
        page.locator('.category-picker summary').click()
        page.locator('#playButton').click();page.wait_for_function('testEngine.playing')
        peak=page.evaluate('''async()=>{let peak=0;const until=performance.now()+1600;while(performance.now()<until){const a=new Float32Array(512);testEngine.analyserL.getFloatTimeDomainData(a);for(const v of a)peak=Math.max(peak,Math.abs(v));await new Promise(requestAnimationFrame)}return peak}''')
        check(genre+' plays non-silent audio without clipping',.002<peak<1)
        if genre=='bachata':
            rate=page.evaluate('''()=>{const e=testStudio.native.events.find(e=>e.inst==='tom'&&e.midi===61);testEngine.scheduleEvent(e,0,0);return [...testEngine.sources].at(-1).playbackRate.value}''')
            check('GM bongo key does not transpose sample playback',abs(rate-1)<1e-6)
            page.screenshot(path=str(OUT/'bachata-playing.png'))
        page.locator('#stopButton').click()
        page.locator('#tab-recipe').click()
        check(genre+' is offered in native recipe controls',page.locator('#harnessPanel select[aria-label=category] option[value="'+genre+'"]').count()==1)
    check('Full library has fourteen categories and 140 cues',page.evaluate('NEOSPC_CATALOG.styles.length===140 && NEOSPC_CATALOG.categories.length===14'))

def main():
    checks=[]
    def check(name, condition):
        assert condition, name
        checks.append(name)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE',r'C:\Program Files\Google\Chrome\Application\chrome.exe'),headless=True)
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        context.add_init_script(HOOK)
        page=context.new_page();errors=[];remote=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:remote.append(r.url) if r.url.startswith(('https:','http:')) else None)
        if '--mix-layout' in sys.argv:
            check_mix_layout(page,check)
            check('No browser exceptions',not errors);check('No network requests',not remote)
            result={'checks':len(checks),'passed':checks,'errors':errors,'browser':browser.version}
            (ROOT/'.scratch/mix-layout-repair/browser-results.json').write_text(json.dumps(result,indent=2)+'\n')
            print(json.dumps(result,indent=2));browser.close();return
        if '--banks-only' in sys.argv or '--consoles-only' in sys.argv:
            check_resonant_banks(page,check,('megadrive','snes') if '--consoles-only' in sys.argv else ('timber','prism','voltage'))
            check('No browser exceptions',not errors);check('No network requests',not remote)
            result={'checks':len(checks),'passed':checks,'errors':errors,'browser':browser.version}
            (OUT/('console-bank-results.json' if '--consoles-only' in sys.argv else 'resonant-bank-results.json')).write_text(json.dumps(result,indent=2),encoding='utf-8')
            print(json.dumps(result,indent=2));browser.close();return
        if '--genres-only' in sys.argv:
            check_genre_collections(page,check)
            check('No browser exceptions',not errors);check('Offline page makes no remote requests',not remote)
            result={'checks':len(checks),'passed':checks,'errors':errors,'remote_requests':remote,'browser':browser.version}
            (OUT/'genre-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
            print(json.dumps(result,indent=2));browser.close();return
        page.goto(URL);settled(page)
        original=page.evaluate('testStudio.native')
        check('Original catalog and instrument surfaces',page.locator('#studioInstruments .instrument').count()==len(original['instrument_map']))
        check('Piano roll appears within initial desktop viewport',page.locator('#pianoRoll').bounding_box()['y']<700)
        check('Instruments are the initial dock panel',page.locator('#dock-instruments').is_visible() and page.locator('#dock-mixer').is_hidden())
        page.locator('#dock-tab-instruments').focus();page.keyboard.press('ArrowRight')
        check('Keyboard switches to the mixer',page.locator('#resetInstruments').is_visible() and page.locator('#dock-tab-mixer').get_attribute('aria-selected')=='true')
        page.keyboard.press('ArrowRight')
        check('Score notes stay available in the dock',page.locator('#trackDescription').is_visible())
        page.keyboard.press('Home')
        check('Keyboard returns to instrument dock',page.locator('#dock-instruments').is_visible())
        page.locator('.file-menu > summary').click()
        check('Current master is available in Files',page.locator('#audioDownloadLink').is_visible())
        page.keyboard.press('Escape')
        check('Escape closes file menu and restores focus',not page.locator('.file-menu').evaluate('(e)=>e.open') and page.evaluate("document.activeElement.matches('.file-menu > summary')"))
        page.locator('#searchInput').fill('no-such-cue-293847')
        check('Empty catalog offers recovery',page.locator('#trackEmpty').is_visible())
        page.locator('#clearTrackFilters').click()
        check('Clear filters restores the catalog',page.locator('.track-row').count()>0)
        page.screenshot(path=str(OUT/'studio-after.png'),full_page=True)
        # Select the same native event in the canvas, then edit through keyboard-accessible fields.
        position=page.evaluate("""()=>{const s=testStudio.native,e=s.events.find(e=>e.kind==='note'&&(e.performance_beat??e.beat)<4),p=s.events.map(e=>e.midi??s.instrument_map[e.inst].root_midi),lo=Math.max(20,Math.min(...p)-3),hi=Math.min(108,Math.max(...p)+3),rect=document.querySelector('#pianoRoll').getBoundingClientRect();return {x:rect.x+rect.width*.39+(e.performance_beat??e.beat)*rect.width/16+3,y:rect.y+28+(hi-e.midi)/Math.max(12,hi-lo)*(rect.height-28-34)};}""")
        page.mouse.click(position['x'],position['y'])
        check('Canvas selection reaches the native editor',page.evaluate('testStudio.note!==null'))
        index=page.evaluate('testStudio.note');old=page.evaluate('testStudio.native.events[testStudio.note].midi')
        page.locator('#studioPitch').fill(str(old+1));page.locator('#studioApplyEdit').click();settled(page)
        changed=page.evaluate('testStudio.native')
        check('Native edit preserves bank and source fields',changed['events'][index]['midi']==old+1 and changed['instrument_map']==original['instrument_map'])
        check('Edited cue is no longer presented as a reviewed master',page.locator('#playbackMode option[value=mastered]').is_disabled() and page.locator('#audioDownloadLink').evaluate('(e)=>e.hidden') and page.locator('.track-row.active .quality-local').count()==1)
        with page.expect_download() as download:page.locator('#studioExport').click()
        json_path=OUT/'edited-score.json';download.value.save_as(json_path)
        exported=json.loads(json_path.read_text())
        check('Export has current events and a reusable draft identity',exported['events']==changed['events'] and exported['id']!=original['id'])
        page.locator('#studioUndo').click();settled(page)
        check('Undo restores the exact catalog score',page.evaluate('testStudio.native')==original)
        page.locator('#studioPerformanceToggle').click();page.locator('#studioApplyPerformance').click();settled(page)
        perf=page.evaluate('testStudio.native')
        check('Performance preserves written notes',[(e.get('midi'),e['beat'],e.get('duration')) for e in perf['events']]==[(e.get('midi'),e['beat'],e.get('duration')) for e in original['events']])
        check('Performance changes actual playback fields',perf['events']!=original['events'])
        page.locator('#studioRestore').click();settled(page)
        check('Restore source recovers full native metadata',page.evaluate('testStudio.native')==original)
        page.locator('#studioPerformanceToggle').click()
        # Audition all production palettes and preview banks, measuring the real post-master output.
        levels={}
        for bank in ['factory','velvet','circuit','original','chip']:
            page.locator('#soundbankMode').select_option(bank);page.locator('#playButton').click()
            page.wait_for_function('testEngine.playing')
            page.wait_for_function("()=>{const v=new Float32Array(512);testEngine.analyserL.getFloatTimeDomainData(v);return v.some(x=>Math.abs(x)>1e-5)}")
            levels[bank]=page.evaluate('()=>{const v=new Float32Array(512);testEngine.analyserL.getFloatTimeDomainData(v);return Math.max(...v.map(Math.abs))}')
            page.locator('#pauseButton').click()
        check('Five live banks produce audio',all(v>0 for v in levels.values()))
        beat=page.evaluate('testEngine.getBeat()');page.wait_for_timeout(80)
        check('Paused roll keeps transport position',abs(page.evaluate('testEngine.getBeat()')-beat)<.001 and beat>0)
        page.locator('#view-focus').click();check('Instrument focus opens with keyboard close control',page.locator('dialog[open]').count()==1)
        page.keyboard.press('Escape');check('Focus closes and returns to trigger',page.locator('dialog[open]').count()==0 and page.evaluate('document.activeElement.id')=='view-focus')
        # Stop must cancel a start that is still preparing samples.
        page.evaluate('()=>{testEngine.savedPrepare=testEngine.prepareStyle;testEngine.prepareStyle=async function(s){await new Promise(r=>setTimeout(r,250));return this.savedPrepare(s)}}')
        page.locator('#playButton').click();page.locator('#stopButton').click();page.wait_for_timeout(400)
        check('Stop cancels pending audio preparation',not page.evaluate('testEngine.playing'))
        page.evaluate('()=>{testEngine.prepareStyle=testEngine.savedPrepare}')
        # Each generator feeds the same roll, engine and catalog, without an iframe.
        page.locator('#studioCreateToggle').click()
        for kind in ['instrumentarium','pocket','conversation','atlas','cycles']:
            page.locator('#studioGenerator').select_option(kind)
            if kind=='instrumentarium':page.locator('#studioVariant').select_option('jazz')
            if kind=='atlas':page.locator('#studioVariant').select_option('dub')
            if kind=='cycles':page.locator('#studioVariant').select_option('hocket')
            page.locator('#studioCreate').click();settled(page)
            check('Shared native creation: '+kind,page.evaluate('testStudio.native.id.startsWith("atelier_") && testStudio.native===testEngine.style && testStudio.score.events.length===testStudio.native.events.length'))
        page.locator('#studioPeriod1').fill('0');before=page.evaluate('testStudio.native.id');page.locator('#studioCreate').click();settled(page)
        check('Invalid cycle keeps the current score',page.evaluate('testStudio.native.id')==before and page.locator('#studioStatus').get_attribute('data-error')=='true')
        page.locator('#studioPeriod1').fill('8');page.locator('#studioCreateToggle').click()
        # Factory samples, not the lab synthesizer, are used for both live and offline output.
        page.locator('#soundbankMode').select_option('factory');page.locator('#playButton').click();page.wait_for_function('testEngine.playing')
        page.wait_for_function("()=>{const v=new Float32Array(512);testEngine.analyserL.getFloatTimeDomainData(v);return v.some(x=>Math.abs(x)>1e-5)}")
        page.locator('#stopButton').click()
        with page.expect_download(timeout=120000) as download:page.locator('#studioWav').click()
        wav_path=OUT/'studio-factory.wav';download.value.save_as(wav_path);settled(page)
        with wave.open(str(wav_path),'rb') as wav:
            samples=array.array('h',wav.readframes(wav.getnframes()))
            check('Factory WAV is real non-silent stereo audio',wav.getnchannels()==2 and wav.getframerate()==32000 and max(map(abs,samples))>100)
        # A draft survives source navigation and native JSON can reopen in a fresh session.
        page.locator('#compositionFileInput').set_input_files(str(json_path));settled(page)
        page.wait_for_function('testStudio.native.id.endsWith("_draft")')
        check('Native JSON import preserves the edited event stream',page.evaluate('testStudio.native.events')==exported['events'])
        page.locator('#tab-recipe').click();check('Recipe editor remains available',page.locator('#harnessJson').is_visible())
        recipe=json.loads(page.locator('#harnessJson').inner_text())
        check('Recipe controls match the current exported configuration',float(page.locator('#harnessPanel input[aria-label=energy]').input_value())==recipe['brief']['energy'] and page.locator('#harnessPanel select[aria-label=category]').input_value()==recipe['brief']['category'])
        page.locator('#tab-soundbank').click();page.wait_for_selector('.bank-patch-row');check('Complete bank browser',page.locator('.bank-patch-row').count()==len(json.loads((ROOT/'game-music-composer/data/factory-bank-manifest.json').read_text())['patches']))
        page.locator('#tab-review').click();check('Local draft review is explicit', 'local' in page.locator('#view-review').inner_text().lower())
        page.locator('#tab-workstation').click();page.evaluate('scrollTo(0,0)')
        check('Desktop has no page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.screenshot(path=str(OUT/'studio-draft.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(150)
        check('Narrow layout has no horizontal page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.screenshot(path=str(OUT/'studio-mobile.png'),full_page=True)
        page.set_viewport_size({'width':1440,'height':1000})
        check_genre_collections(page,check)
        check('No browser exceptions',not errors);check('Offline page makes no remote requests',not remote)
        result={'checks':len(checks),'passed':checks,'audio_peaks':levels,'errors':errors,'remote_requests':remote,'browser':browser.version}
        (OUT/'browser-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        print(json.dumps(result,indent=2));browser.close()

if __name__=='__main__':main()
