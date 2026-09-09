"""Measure delivered sample loudness and publish shared, velocity-preserving trims."""
import base64,io,json,math,sys
from pathlib import Path
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
ROOT=Path(__file__).resolve().parents[1]
STUDIO=ROOT/'game-music-composer-showcase'
SKILL=ROOT/'game-music-composer'
TARGET=-18.0
def assigned(path):return json.loads(path.read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
def measure(uri):
    x,sr=sf.read(io.BytesIO(base64.b64decode(uri.split(',',1)[1])),always_2d=True)
    peak=float(np.max(abs(x)))
    active=np.flatnonzero(np.max(abs(x),axis=1)>peak*.02)
    start=min(int(active[0]) if len(active) else 0,int(sr*.1))
    note=x[start:start+int(sr*.4)]
    note=np.pad(note,((0,max(0,int(sr*.4)-len(note))),(0,0)))
    loudness=float(pyln.Meter(sr,block_size=.2).integrated_loudness(note))
    if not math.isfinite(loudness) or peak<1e-6:raise ValueError('Silent sample in playable bank')
    return loudness,peak
def main():
    banks={'factory':assigned(STUDIO/'data/factory-bank.js'),**assigned(STUDIO/'data/studio-palettes.js')}
    measurements={};groups=[]
    for bank_id,bank in banks.items():
        for chunk in sorted(set(bank['sample_sources'].values())):
            source=(STUDIO/chunk).read_text(encoding='utf-8')
            data=json.loads(source.split(',',1)[1].strip().removesuffix(');'))
            for file,uri in data.items():measurements[file]=measure(uri)
        for patch in bank['patches'].values():
            regions=patch['profiles']['neo16']['regions']
            for root in sorted({r['root'] for r in regions}):
                same=[r for r in regions if r['root']==root]
                top=max(r.get('lovel',1) for r in same)
                reference=sorted({r['file'] for r in same if r.get('lovel',1)==top})
                groups.append((bank_id,patch['id'],root,sorted({r['file'] for r in same}),reference))
        print('Measured',bank_id,flush=True)
    legacy=assigned(STUDIO/'data/sample-bank.js')
    for file,meta in legacy['samples'].items():
        measurements[file]=measure(meta['data']);groups.append(('original',file,meta.get('root_midi',60),[file],[file]))
    gains={};proof=[]
    for bank,patch,root,files,refs in groups:
        energy=np.mean([10**(measurements[f][0]/10) for f in refs]);level=10*math.log10(energy)
        # One gain for all velocities and alternate attacks at this root.
        # Reserve raw sample headroom without a limiter altering the waveform.
        headroom=20*math.log10(.80/max(measurements[f][1] for f in files))
        gain=round(min(TARGET-level,headroom),4)
        for file in files:
            if file in gains and abs(gains[file]-gain)>.001:raise ValueError('Conflicting shared sample calibration: '+file)
            gains[file]=gain
        proof.append(dict(bank=bank,patch=patch,root=root,before_lufs=level,after_lufs=level+gain,gain_db=gain,headroom_limited=gain<TARGET-level-.01))
    result={'version':1,'target_lufs':TARGET,'chip_gain_db':-8.0,'window_seconds':.4,'method':'K-weighted note onset; high velocity reference; shared root trim preserves velocity and round robin dynamics','gain_db':gains}
    previews={}
    for meta in assigned(STUDIO/'data/factory-bank-previews.js').values():
        file=meta['file'];uri='data:audio/wav;base64,'+base64.b64encode((STUDIO/file).read_bytes()).decode()
        level,peak=measure(uri);previews[file]=round(min(TARGET-level,20*math.log10(.8/peak)),4)
    result['preview_gain_db']=previews
    demos={}
    for file in sorted((STUDIO/'assets/console-packs').glob('*.wav')):
        x,sr=sf.read(file,always_2d=True);level=pyln.Meter(sr).integrated_loudness(x)
        demos[file.relative_to(STUDIO).as_posix()]=round(min(0,-24-level),4)
    result['demo_gain_db']=demos
    target=SKILL/'data/soundbank-levels.json';target.write_text(json.dumps(result,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    (STUDIO/'data/soundbank-levels.js').write_text('window.NEOSPC_LEVELS='+json.dumps(result,separators=(',',':'))+';\n',encoding='utf-8',newline='\n')
    out=ROOT/'.scratch/mix-layout-repair';out.mkdir(exist_ok=True)
    (out/'calibration.json').write_text(json.dumps({'samples':len(gains),'groups':proof},indent=2)+'\n')
    for bank in [*banks,'original']:
        rows=[r for r in proof if r['bank']==bank]
        print(bank,'median before/after',*[round(float(np.median([r[k] for r in rows])),2) for k in ('before_lufs','after_lufs')],'limited',sum(r['headroom_limited'] for r in rows),flush=True)
if __name__=='__main__':main()
