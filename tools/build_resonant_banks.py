"""Build three complete synthesis palettes and publish only verified files."""
import argparse,copy,json,sys,shutil,io,base64
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor,ThreadPoolExecutor
import numpy as np,soundfile as sf
import build_soundbanks as b
sys.path.insert(0,str(b.SKILL/'scripts'))
import resonant_timbres as synth

def assigned(path):return json.loads(path.read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))

def lossless_uri(path):
    x,sr=sf.read(path,dtype='int16');buffer=io.BytesIO()
    sf.write(buffer,x,sr,format='FLAC',subtype='PCM_16')
    decoded,decoded_sr=sf.read(io.BytesIO(buffer.getvalue()),dtype='int16')
    assert decoded_sr==sr and np.array_equal(x,decoded),'Lossless encoding changed PCM'
    return 'data:audio/flac;base64,'+base64.b64encode(buffer.getvalue()).decode('ascii')

def build_patch(job):
    out,palette,patch=job;out=Path(out);ident=patch['id'];drum=patch['type'] in ('drum','fx');looped=bool(patch.get('loop'))
    if drum:roots=[patch.get('note',60)];lo=hi=roots[0]
    else:
        lo,hi=patch['range'];roots=list(range(lo,hi+1,6))
        if roots[-1]!=hi:roots.append(hi)
    regions=[];chunk={};metrics=[]
    for i,root in enumerate(roots):
        for vel,vlo,vhi in ((42,1,57),(79,58,96),(115,97,127)):
            for rr in (1,2):
                file=f'{palette}/samples/{ident.replace(".","_")}/m{root}_v{vel}_rr{rr}.wav';dest=out/file;dest.parent.mkdir(parents=True,exist_ok=True)
                y,loop=synth.render(ident,root,vel,rr,32000,looped,palette)
                assert np.isfinite(y).all() and 1e-4<float(np.max(np.abs(y)))<.81
                if loop:
                    a,z=[round(loop[k]*32000) for k in ('start_sec','end_sec')]
                    assert abs(float(y[z-1]-y[a-1]))<1e-6,(ident,'loop boundary')
                sf.write(dest,y,32000,subtype='PCM_16');chunk[file]=lossless_uri(dest)
                regions.append({'file':file,'root':root,'lokey':lo if i==0 else (roots[i-1]+root)//2+1,'hikey':hi if i==len(roots)-1 else (root+roots[i+1])//2,'lovel':vlo,'hivel':vhi,'rr':rr,'rr_count':2,'loop':loop})
                metrics.append({'file':file,'sha256':b.sha(dest),'peak':float(np.max(np.abs(y)))})
    patch.update(roots=roots,source_kind='synthesized',tags=[palette,synth.family(ident),'three intensity layers','two attacks'],profiles={'neo16':{'regions':regions}})
    name='data/banks/'+palette+'_'+ident.replace('.','_')+'.js'
    (out/name).write_text('Object.assign(window.NEOSPC_PALETTES.'+palette+'.samples,'+json.dumps(chunk,separators=(',',':'))+');\n',encoding='utf-8',newline='\n')
    return palette,patch,name,metrics

def build(out,workers):
    out.mkdir(parents=True,exist_ok=False);(out/'data/banks').mkdir(parents=True)
    factory=assigned(b.STUDIO/'data/factory-bank.js');banks=assigned(b.STUDIO/'data/studio-palettes.js')
    b.write(out/'factory-bank-manifest.json',b.read(b.SKILL/'data/factory-bank-manifest.json'))
    previous=b.STUDIO/'data/studio-palettes.js';shutil.copyfile(previous,out/'previous-studio-palettes.js')
    for palette,label in synth.PALETTES.items():
        if palette in banks:raise ValueError('Palette already exists: '+palette)
        banks[palette]={'name':label,'version':synth.VERSION,'origin':'Original CC0 synthesis: resonant_timbres.py','embedded_profile':'neo16','profiles':copy.deepcopy(factory['profiles']),'patches':{},'samples':{},'sample_sources':{}}
    jobs=[(str(out),palette,copy.deepcopy(patch)) for palette in synth.PALETTES for patch in factory['patches'].values()];allmetrics=[]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for i,(palette,patch,chunk,metrics) in enumerate(pool.map(build_patch,jobs)):
            bank=banks[palette];bank['patches'][patch['id']]=patch
            bank['sample_sources'].update({r['file']:chunk for r in patch['profiles']['neo16']['regions']});allmetrics+=metrics
            if (i+1)%9==0:print(f'Built {i+1}/{len(jobs)} patches',flush=True)
    for palette in synth.PALETTES:
        bank=banks[palette];bank['stats']={'patches':len(bank['patches']),'embedded_samples':len(bank['sample_sources'])}
    b.js(out/'data/studio-palettes.js','NEOSPC_PALETTES',banks)
    receipt={'passed':True,'version':synth.VERSION,'palettes':list(synth.PALETTES),'generator_sha256':b.sha(b.SKILL/'scripts/resonant_timbres.py'),'builder_sha256':b.sha(Path(__file__)),'previous_metadata_sha256':b.sha(previous),'samples':allmetrics,'files':{p.relative_to(out).as_posix():b.sha(p) for p in (out/'data').rglob('*.js')}}
    b.write(out/'verification.json',receipt);print('Verified',len(allmetrics),'regions',flush=True)

def publish(out):
    proof=b.read(out/'verification.json');assert proof['passed']
    assert b.sha(b.SKILL/'scripts/resonant_timbres.py')==proof['generator_sha256']
    assert b.sha(b.STUDIO/'data/studio-palettes.js')==proof['previous_metadata_sha256'],'Palette metadata changed since build'
    for file,digest in proof['files'].items():assert b.sha(out/file)==digest,file
    for file in proof['files']:
        dest=b.STUDIO/file;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(out/file,dest)
    print('Published Timber, Prism and Voltage. Existing palette samples and catalog unchanged.')

def refine_modal(out,workers):
    proof=b.read(out/'verification.json');banks=assigned(out/'data/studio-palettes.js')
    bank=banks['timber'];patches=[p for p in bank['patches'].values() if synth.family(p['id']) in ('pluck','struck') or (synth.family(p['id'])=='bass' and not p.get('loop'))]
    changed={p['id'].replace('.','_') for p in patches}
    proof['samples']=[m for m in proof['samples'] if not (m['file'].startswith('timber/') and m['file'].split('/')[2] in changed)]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for i,(palette,patch,chunk,metrics) in enumerate(pool.map(build_patch,[(str(out),'timber',copy.deepcopy(p)) for p in patches])):
            bank['patches'][patch['id']]=patch;proof['samples']+=metrics
            print(f'Refined modal dynamics {i+1}/{len(patches)}',flush=True)
    b.js(out/'data/studio-palettes.js','NEOSPC_PALETTES',banks)
    proof.update(generator_sha256=b.sha(b.SKILL/'scripts/resonant_timbres.py'),builder_sha256=b.sha(Path(__file__)))
    proof['files']={p.relative_to(out).as_posix():b.sha(p) for p in (out/'data').rglob('*.js')}
    b.write(out/'verification.json',proof)

def pack(out):
    """Losslessly compact an existing build without recomputing its instruments."""
    proof=b.read(out/'verification.json');banks=assigned(out/'data/studio-palettes.js')
    def one(chunk):
        path=out/chunk;text=path.read_text();prefix,payload=text.split(',{',1)
        values=json.loads('{'+payload.rsplit(');',1)[0])
        values={name:lossless_uri(out/name) for name in values}
        path.write_text(prefix+','+json.dumps(values,separators=(',',':'))+');\n',encoding='utf-8',newline='\n')
        return path.stat().st_size
    chunks=sorted({chunk for palette in proof['palettes'] for chunk in banks[palette]['sample_sources'].values()})
    before=sum((out/c).stat().st_size for c in chunks)
    with ThreadPoolExecutor(max_workers=3) as pool:after=sum(pool.map(one,chunks))
    proof.update(browser_encoding='FLAC / lossless PCM16',pcm_roundtrip_verified=True,builder_sha256=b.sha(Path(__file__)),uncompressed_chunk_bytes=before,compressed_chunk_bytes=after)
    proof['files']={p.relative_to(out).as_posix():b.sha(p) for p in (out/'data').rglob('*.js')}
    b.write(out/'verification.json',proof);print('Lossless chunks:',before,'->',after,flush=True)

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('phase',choices=['build','refine-modal','pack','publish']);ap.add_argument('output',type=Path);ap.add_argument('--workers',type=int,default=3);a=ap.parse_args()
    if a.phase=='build':build(a.output.resolve(),a.workers)
    elif a.phase=='refine-modal':refine_modal(a.output.resolve(),a.workers)
    elif a.phase=='pack':pack(a.output.resolve())
    else:publish(a.output.resolve())
