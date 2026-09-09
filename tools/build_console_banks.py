"""Build emulator-derived Studio previews and native console soundpacks."""
import argparse,base64,copy,io,json,shutil,sys,zipfile,subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np,soundfile as sf
import build_soundbanks as b
sys.path.insert(0,str(b.SKILL/'scripts'))
import console_soundpack as c

def assigned(path):return json.loads(path.read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))

def sample(job):
    out,console,preset,root,vel=job
    folder=out/console/'samples'/preset;folder.mkdir(parents=True,exist_ok=True)
    stem=folder/f'm{root}_v{vel}';native=stem.with_suffix('.vgm' if console=='megadrive' else '.spc');wav=stem.with_suffix('.wav')
    notes=[dict(preset=preset,midi=root,time=0,duration=1.7,velocity=vel)]
    native.write_bytes(c.vgm(notes) if console=='megadrive' else c.spc(notes,False));c.render_native(native,wav,2.7)
    x,sr=sf.read(wav);x=x.mean(axis=1);peak=float(np.max(np.abs(x)))
    if not 1e-5<peak<.98:raise ValueError((str(wav),'silent or clipped',peak))
    # A fixed per-console gain retains native velocity and envelope differences.
    x*=1.6 if console=='megadrive' else 2
    if max(abs(x))>=.98:raise ValueError((str(wav),'preview gain clips'))
    sf.write(wav,x,sr,subtype='PCM_16');pcm,_=sf.read(wav,dtype='int16');encoded=io.BytesIO()
    sf.write(encoded,pcm,sr,format='FLAC',subtype='PCM_16');decoded,_=sf.read(io.BytesIO(encoded.getvalue()),dtype='int16');assert np.array_equal(pcm,decoded)
    rel=wav.relative_to(out).as_posix()
    return rel,'data:audio/flac;base64,'+base64.b64encode(encoded.getvalue()).decode(),{'file':rel,'sha256':b.sha(wav),'native_sha256':b.sha(native),'peak':peak,'preset':preset,'root':root,'velocity':vel}

def build(out,workers,replace=False):
    out.mkdir(parents=True,exist_ok=False);(out/'data/banks').mkdir(parents=True)
    factory=assigned(b.STUDIO/'data/factory-bank.js');banks=assigned(b.STUDIO/'data/studio-palettes.js')
    existing=b.STUDIO/'data/studio-palettes.js';baseline={'catalog':b.sha(b.SKILL/'data/neospc100-benchmark-v4.1.json'),'previous_metadata':b.sha(existing),'previous_chunks':{p.name:b.sha(p) for p in (b.STUDIO/'data/banks').glob('*.js')}}
    b.write(out/'baseline.json',baseline)
    jobs=set();specs={}
    for console in ('megadrive','snes'):
        if console in banks:
            if not replace:raise ValueError('Console palette already exists; use --replace for a verified rebuild')
            del banks[console]
        specs[console]={}
        for ident,patch in factory['patches'].items():
            preset=c.preset_for(ident,console);drum=patch['type'] in ('drum','fx')
            lo,hi=patch.get('range',[patch.get('note',60)]*2) if not drum else [patch.get('note',60)]*2
            # PSG has no bass register below ~109 Hz; reinterpret low roles up an octave.
            roots=[60] if preset=='psg_noise' or drum else [r for r in (36,48,60,72,84,96) if lo-6<=r<=hi+6]
            if preset=='psg_square':roots=[r for r in roots if r>=48]
            if not roots:roots=[60]
            specs[console][ident]=(preset,roots,lo,hi)
            for root in roots:
                for vel in (52,104):jobs.add((out,console,preset,root,vel))
    samples={};metrics=[]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for i,(rel,uri,metric) in enumerate(pool.map(sample,sorted(jobs,key=str))):
            samples[rel]=uri;metrics.append(metric)
            if (i+1)%30==0:print(f'Emulated {i+1}/{len(jobs)} source notes',flush=True)
    for console,label in (('megadrive','Mega Drive'),('snes','SNES')):
        bank={'name':label+' · sampled','version':c.VERSION,'origin':'Original chip patches rendered by FFmpeg/libgme; Studio playback is a sample preview. Native VGM/SPC enforces console voices.','embedded_profile':'neo16','profiles':copy.deepcopy(factory['profiles']),'patches':{},'samples':{},'sample_sources':{}}
        for preset in sorted({s[0] for s in specs[console].values()}):
            chunk=f'data/banks/{console}_{preset}.js';data={k:v for k,v in samples.items() if k.startswith(console+'/samples/'+preset+'/')}
            (out/chunk).write_text(f'Object.assign(window.NEOSPC_PALETTES.{console}.samples,'+json.dumps(data,separators=(',',':'))+');\n',encoding='utf-8',newline='\n')
            bank['sample_sources'].update({key:chunk for key in data})
        for ident,(preset,roots,lo,hi) in specs[console].items():
            patch=copy.deepcopy(factory['patches'][ident]);regions=[]
            for i,root in enumerate(roots):
                for vel,vlo,vhi in ((52,1,77),(104,78,127)):
                    regions.append({'file':f'{console}/samples/{preset}/m{root}_v{vel}.wav','root':root,'lokey':lo if i==0 else (roots[i-1]+root)//2+1,'hikey':hi if i==len(roots)-1 else (root+roots[i+1])//2,'lovel':vlo,'hivel':vhi,'rr':1,'rr_count':1,'loop':None})
            patch.update(label=preset.replace('_',' ').title(),roots=roots,loop=None,source_kind='emulated',tags=[console,preset,'emulator-derived sample preview'],profiles={'neo16':{'regions':regions}})
            bank['patches'][ident]=patch
        bank['stats']={'patches':54,'unique_presets':len({x[0] for x in specs[console].values()}),'embedded_samples':len(bank['sample_sources'])};banks[console]=bank
        pack=out/console/'pack';pack.mkdir()
        shutil.copyfile(b.SKILL/'scripts/console_soundpack.py',pack/'console_soundpack.py')
        b.write(pack/'presets.json',c.FM if console=='megadrive' else c.SNES)
        b.write(pack/'demo-notes.json',c.demo(console))
        native=pack/('demo.vgm' if console=='megadrive' else 'demo.spc');native.write_bytes(c.vgm(c.demo(console)) if console=='megadrive' else c.spc(c.demo(console)))
        c.render_native(native,pack/'demo.wav',5.1)
        if console=='snes':
            (pack/'brr').mkdir()
            for preset in c.SNES:
                x,root,loop=c.brr_source(preset,84);(pack/'brr'/f'{preset}.brr').write_bytes(c.encode_brr(x,loop))
            b.write(pack/'brr'/'directory.json',{p:{'root_hz':c.brr_source(p,84)[1],'loop':c.brr_source(p,84)[2]} for p in c.SNES})
        shutil.copyfile(b.SKILL/'references/54-console-soundpacks.md',pack/'README.md')
    b.js(out/'data/studio-palettes.js','NEOSPC_PALETTES',banks)
    b.write(out/'factory-bank-manifest.json',b.read(b.SKILL/'data/factory-bank-manifest.json'))
    b.write(out/'verification.json',{'passed':True,'source_sha256':b.sha(b.SKILL/'scripts/console_soundpack.py'),'samples':metrics,'files':{p.relative_to(out).as_posix():b.sha(p) for p in (out/'data').rglob('*.js')},'ffmpeg':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],'physical_hardware_comparison':'pending'})
    pack(out)
    print('Built',len(metrics),'source samples',flush=True)


def pack(out):
    metrics=b.read(out/'verification.json')['samples']
    levels=b.read(b.SKILL/'data/soundbank-levels.json')['gain_db']
    for console in ('megadrive','snes'):
        folder=out/console/'pack'
        shutil.copyfile(b.SKILL/'references/54-console-soundpacks.md',folder/'README.md')
        with zipfile.ZipFile(out/f'{console}-soundpack.zip','w',zipfile.ZIP_DEFLATED) as archive:
            for path in folder.rglob('*'):
                if path.is_file():archive.write(path,path.relative_to(folder))
            for path in (out/console/'samples').rglob('*.wav'):
                archive.write(path,path.relative_to(out/console))
            presets=sorted({m['preset'] for m in metrics if m['file'].startswith(console+'/')})
            for preset in presets:
                roots=sorted({m['root'] for m in metrics if m['file'].startswith(console+'/samples/'+preset+'/')})
                lines=['// Emulator-derived dry preview; native voice limits do not apply in SFZ.','<group> ampeg_release=0.08']
                for i,root in enumerate(roots):
                    for vel,low,high in ((52,1,77),(104,78,127)):
                        lines.append(f'<region> sample=samples/{preset}/m{root}_v{vel}.wav pitch_keycenter={root} lokey={0 if i==0 else (roots[i-1]+root)//2+1} hikey={127 if i==len(roots)-1 else (root+roots[i+1])//2} lovel={low} hivel={high} volume={levels[f"{console}/samples/{preset}/m{root}_v{vel}.wav"]}')
                archive.writestr(preset+'.sfz','\n'.join(lines)+'\n')
    print('Packed native files, WAV multisamples and SFZ maps')

def publish(out):
    receipt=b.read(out/'verification.json');baseline=b.read(out/'baseline.json')
    assert receipt['passed'] and receipt['source_sha256']==b.sha(b.SKILL/'scripts/console_soundpack.py')
    assert baseline['previous_metadata']==b.sha(b.STUDIO/'data/studio-palettes.js')
    for rel,digest in receipt['files'].items():assert digest==b.sha(out/rel)
    for rel in receipt['files']:shutil.copyfile(out/rel,b.STUDIO/rel)
    target=b.STUDIO/'assets/console-packs';target.mkdir(exist_ok=True)
    for console in ('megadrive','snes'):
        shutil.copyfile(out/f'{console}-soundpack.zip',b.STUDIO/'downloads'/f'{console}-soundpack.zip')
        shutil.copyfile(out/console/'pack/demo.wav',target/f'{console}-demo.wav')
    print('Published both console previews and native soundpacks')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('phase',choices=('build','pack','publish'));p.add_argument('output',type=Path);p.add_argument('--workers',type=int,default=4);p.add_argument('--replace',action='store_true');a=p.parse_args()
    build(a.output,a.workers,a.replace) if a.phase=='build' else pack(a.output) if a.phase=='pack' else publish(a.output)
