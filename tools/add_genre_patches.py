"""Add four synthesized genre instruments without replacing the existing banks."""
import argparse,copy,json,shutil,sys
from pathlib import Path
import numpy as np,soundfile as sf
from scipy.signal import butter,sosfilt
import build_soundbanks as b
sys.path.insert(0,str(b.SKILL/'scripts'))
from synthesize_soundbanks import synthesize
from studio_timbres import render as colored,finish

def make(patch,root,velocity,rr,sr,palette):
    if patch.startswith('guitar.'):
        source='guitar.nylon' if patch.endswith('requinto') else 'guitar.muted'
        return synthesize(source,root,velocity,rr,sr,False) if palette=='factory' else colored(source,root,velocity,rr,sr,False,palette)
    rng=np.random.default_rng(root*101+velocity*7+rr);t=np.arange(round(sr*.8))/sr
    if patch=='drums.bongo':
        f=190+rr*.6;x=np.sin(2*np.pi*(f*t+35*(1-np.exp(-t*25))/25))*np.exp(-t*17)
        x+=.27*np.sin(2*np.pi*f*1.59*t)*np.exp(-t*35)+.08*rng.normal(0,1,len(t))*np.exp(-t*90)
    else:
        noise=rng.normal(0,1,len(t));x=sosfilt(butter(2,[1700,11000],btype='bandpass',fs=sr,output='sos'),noise)
        # Closely spaced scrape ridges, a longer forward stroke and a soft release.
        teeth=.40+.60*np.maximum(0,np.sin(2*np.pi*(95+rr*8)*t))**3
        x*=teeth*(1-np.exp(-t*200))*np.exp(-t*(18 if velocity<80 else 10))
    x*=np.minimum(1,t/.001)
    return finish(x,sr,False)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('output',type=Path);ap.add_argument('--base',type=Path,required=True);a=ap.parse_args();out=a.output.resolve();out.mkdir(exist_ok=False)
    base=a.base.resolve()
    # Render sources are copied into a new, complete bank directory.
    for folder in ('samples','velvet','circuit'):shutil.copytree(base/folder,out/folder)
    (out/'data/banks').mkdir(parents=True)
    factory=b.read(base/'factory-bank-manifest.json')
    data=json.loads((base/'data/factory-bank.js').read_text().split('=',1)[1].rstrip(';\n'))
    banks=json.loads((base/'data/studio-palettes.js').read_text().split('=',1)[1].rstrip(';\n'))
    previews=json.loads((base/'data/factory-bank-previews.js').read_text().split('=',1)[1].rstrip(';\n'))
    definitions=[('guitar.requinto','Requinto Guitar','pluck',[48,60,72,84],[40,88]),('guitar.segunda','Muted Rhythm Guitar','pluck',[45,57,69,81],[38,86]),('drums.bongo','Bongo','drum',[60],[60,60]),('drums.guira','Guira Scrape','drum',[82],[82,82])]
    allbanks={'factory':data,**banks};added=[]
    for ident,label,family,roots,ran in definitions:
        if ident in data['patches']:raise ValueError('Use the base palette build without genre additions: '+ident)
        patch={'id':ident,'label':label,'family':family,'type':'drum' if family=='drum' else 'tonal','tags':['genre-expansion','synthesized'],'range':ran,'roots':roots,'note':roots[0],'loop':False,'rr':2,'source_kind':'synthesized','profiles':{}}
        for palette,bank in allbanks.items():
            regions=[];chunk={};chunk_name='data/banks/'+('' if palette=='factory' else palette+'_')+ident.replace('.','_')+'.js'
            for i,root in enumerate(roots):
                for vel,lo,hi in ((54,1,79),(108,80,127)):
                    for rr in (1,2):
                        name=('' if palette=='factory' else palette+'/')+'samples/'+ident.replace('.','_')+f'/m{root}_v{vel}_rr{rr}.wav';path=out/name;path.parent.mkdir(parents=True,exist_ok=True)
                        y,loop=make(ident,root,vel,rr,32000,palette);assert np.isfinite(y).all() and 0<np.max(np.abs(y))<.9
                        sf.write(path,y,32000,subtype='PCM_16')
                        regions.append({'file':name,'root':root,'lokey':ran[0] if i==0 else (roots[i-1]+root)//2+1,'hikey':ran[1] if i==len(roots)-1 else (root+roots[i+1])//2,'lovel':lo,'hivel':hi,'rr':rr,'rr_count':2,'loop':None})
                        chunk[name]=b.embedded(path);bank['sample_sources'][name]=chunk_name
            current=copy.deepcopy(patch);current['profiles']={'neo16':{'regions':regions}};bank['patches'][ident]=current
            var='NEOSPC_FACTORY_BANK' if palette=='factory' else 'NEOSPC_PALETTES.'+palette
            (out/chunk_name).write_text('Object.assign(window.'+var+'.samples,'+json.dumps(chunk,separators=(',',':'))+');\n',encoding='utf-8',newline='\n')
        preview='assets/bank-preview/neo32/'+ident.replace('.','_')+'.wav';path=out/preview;path.parent.mkdir(parents=True,exist_ok=True)
        root=roots[len(roots)//2];y,_=make(ident,root,108,1,44100,'factory');sf.write(path,y,44100,subtype='PCM_24')
        previews[ident]={'file':preview,'root':root,'velocity':108}
        patch=copy.deepcopy(data['patches'][ident]);patch['profiles']['neo32']={'preview_only':True,'regions':[{'file':preview,'root':root,'lokey':root,'hikey':root,'lovel':108,'hivel':108,'rr':1,'rr_count':1,'loop':None}]}
        data['patches'][ident]=copy.deepcopy(patch);factory['patches'].append(patch);added.append(ident)
    for bank in allbanks.values():bank['stats']={'patches':len(bank['patches']),'embedded_samples':len(bank['sample_sources'])}
    factory['version']='3.1.0';data['version']='3.1.0'
    b.write(out/'factory-bank-manifest.json',factory);b.js(out/'data/factory-bank.js','NEOSPC_FACTORY_BANK',data);b.js(out/'data/studio-palettes.js','NEOSPC_PALETTES',banks);b.js(out/'data/factory-bank-previews.js','NEOSPC_FACTORY_PREVIEWS',previews)
    b.write(out/'addition-receipt.json',{'patches':added,'sources':{'tool':b.sha(Path(__file__)),'synthesis':b.sha(b.SKILL/'scripts/synthesize_soundbanks.py'),'palettes':b.sha(b.SKILL/'scripts/studio_timbres.py')},'new_files':{p.relative_to(out).as_posix():b.sha(p) for folder in ('data','assets') for p in (out/folder).rglob('*') if p.is_file()}})
    print('Prepared four patches across three palettes',flush=True)
if __name__=='__main__':main()
