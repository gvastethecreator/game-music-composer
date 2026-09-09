#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,math,subprocess,collections,os
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor,as_completed
import numpy as np,soundfile as sf,pyloudnorm as pyln
from scipy.signal import butter,sosfiltfilt,resample_poly
from fractions import Fraction
from scipy.ndimage import uniform_filter1d

SR=32000
SAMPLES=None;METAS=None;CAL=None;NOTE_CACHE=None;DRUM_CACHE=None
PALETTES=None;FACTORY_DIR=None
LEVELS=json.loads((Path(__file__).resolve().parents[1]/'data/soundbank-levels.json').read_text())['gain_db']
BUS_ORDER=['lead','bass','drums','rhythm','harmony','atmosphere','fx']
ROLE_BUS={'lead':'lead','counter':'lead','riff':'lead','bass':'bass','kick':'drums','snare':'drums','hat':'drums','tom':'drums','wood':'drums','ride':'drums','shaker':'drums','brush':'drums','rim':'drums','impact':'fx','comp':'harmony','arp':'rhythm','motor':'rhythm','ostinato':'rhythm','pad':'atmosphere','support':'harmony','ensemble':'atmosphere','pulse':'rhythm','texture':'atmosphere'}
ROLE_AMP={'lead':.245,'counter':.18,'riff':.235,'bass':.285,'kick':.52,'snare':.43,'hat':.20,'tom':.36,'wood':.27,'ride':.17,'shaker':.16,'brush':.16,'rim':.22,'impact':.31,'comp':.155,'arp':.15,'motor':.17,'ostinato':.18,'pad':.105,'support':.145,'ensemble':.082,'pulse':.15,'texture':.07}
BUS_TARGET={'lead':-23.0,'bass':-21.8,'drums':-19.3,'rhythm':-24.8,'harmony':-26.7,'atmosphere':-29.0,'fx':-25.8}
BUS_EQ={'lead':(105,10500),'bass':(24,3400),'drums':(22,13800),'rhythm':(115,9400),'harmony':(155,8000),'atmosphere':(190,7200),'fx':(70,10500)}
BUS_COMP={'lead':(-22,1.8),'bass':(-23,2.2),'drums':(-22,4.2),'rhythm':(-24,1.8),'harmony':(-26,1.65),'atmosphere':(-28,1.45),'fx':(-22,2.2)}
BUS_SEND={'lead':.18,'bass':.035,'drums':.06,'rhythm':.11,'harmony':.16,'atmosphere':.24,'fx':.20}
CATEGORY_ADJUST={
 'action':{'drums':1.8,'bass':.9,'harmony':-1.2,'atmosphere':-1.8},'electronic':{'drums':1.7,'bass':1.0,'rhythm':.6,'atmosphere':-1.2},
 'urban':{'rhythm':.5,'bass':.7,'drums':1.4},'classical':{'drums':-2.5,'harmony':.8,'atmosphere':1.2},
 'horror':{'drums':-1.5,'atmosphere':1.5,'fx':1.0},'emotion':{'drums':-2,'harmony':.4,'atmosphere':.8},
 'towns':{'drums':-.5,'rhythm':.4},'fantasy':{'harmony':.4,'atmosphere':.7},'adventure':{'rhythm':.3},'mystery':{'drums':-1,'atmosphere':.6}
}

def dbamp(db):return 10**(db/20)
def clamp(x,a,b):return max(a,min(b,x))
def resample_rate(x,rate):
 if abs(rate-1)<1e-7:return x.copy()
 n=max(1,int(len(x)/rate));ratio=Fraction(1/float(rate)).limit_denominator(512)
 y=resample_poly(x,ratio.numerator,ratio.denominator)
 return np.pad(y,(0,max(0,n-len(y))))[:n].astype(np.float32)
def envelope(n,attack,release,sustain=.98):
 y=np.ones(n,dtype=np.float32)*sustain;a=min(n,max(1,int(attack*SR)));r=min(n,max(1,int(release*SR)))
 y[:a]=np.linspace(0,sustain,a,endpoint=False)
 if r<n:y[-r:]*=np.linspace(1,0,r)
 else:y*=np.linspace(1,0,n)
 return y
def pan_stereo(x,pan):
 p=clamp(float(pan),-1,1);l=math.cos((p+1)*math.pi/4);r=math.sin((p+1)*math.pi/4)
 return np.stack([x*l,x*r],axis=1).astype(np.float32)
def circular_filter(x,hp=None,lp=None):
 if not hp and not lp:return x
 nyq=SR/2
 if hp and lp:sos=butter(2,[max(10,hp)/nyq,min(nyq-20,lp)/nyq],btype='band',output='sos')
 elif hp:sos=butter(2,max(10,hp)/nyq,btype='highpass',output='sos')
 else:sos=butter(2,min(nyq-20,lp)/nyq,btype='lowpass',output='sos')
 pad=min(len(x)//4,4096)
 if pad<32:return x
 xx=np.concatenate([x[-pad:],x,x[:pad]],axis=0)
 yy=sosfiltfilt(sos,xx,axis=0,padlen=0)
 return yy[pad:pad+len(x)].astype(np.float32)
def compressor(x,threshold_db,ratio):
 mono=np.max(np.abs(x),axis=1)
 env=np.sqrt(uniform_filter1d(mono*mono,size=max(8,int(.025*SR)),mode='wrap')+1e-12)
 level=20*np.log10(env+1e-9);over=np.maximum(0,level-threshold_db);gr=-over*(1-1/ratio)
 gr=uniform_filter1d(gr,size=max(8,int(.018*SR)),mode='wrap')
 return (x*dbamp(gr)[:,None]).astype(np.float32)
def active_level_db(x):
 mono=np.sqrt(np.mean(x*x,axis=1)+1e-12)
 env=np.sqrt(uniform_filter1d(mono*mono,size=max(8,int(.12*SR)),mode='wrap')+1e-12)
 db=20*np.log10(env+1e-9);mx=float(np.max(db));active=db[db>mx-34]
 return float(np.percentile(active,62)) if len(active) else -90.0
def width(x,amount):
 mid=(x[:,0]+x[:,1])*.5;side=(x[:,0]-x[:,1])*.5*amount
 return np.stack([mid+side,mid-side],axis=1).astype(np.float32)
def sidechain_gain(source,max_duck_db):
 mono=np.sqrt(np.mean(source*source,axis=1)+1e-12)
 env=np.sqrt(uniform_filter1d(mono*mono,size=max(8,int(.08*SR)),mode='wrap')+1e-12)
 p=np.percentile(env,92) if np.any(env) else 1
 norm=np.clip(env/(p+1e-9),0,1)
 return dbamp(-max_duck_db*norm).astype(np.float32)
def make_trigger_env(n,starts,decay=.09):
 env=np.zeros(n,dtype=np.float32);length=max(1,int(decay*SR));curve=np.exp(-np.arange(length)/(SR*decay*.32)).astype(np.float32)
 for pos in starts:
  end=pos+length
  if end<=n:env[pos:end]=np.maximum(env[pos:end],curve)
  else:
   a=n-pos;env[pos:]=np.maximum(env[pos:],curve[:a]);env[:end-n]=np.maximum(env[:end-n],curve[a:])
 return env

def load_samples(sample_dir,cal_path):
 manifest=json.loads((Path(sample_dir)/'sample-bank.json').read_text());metas={m['id']:m for m in manifest['samples']};cal=json.loads(Path(cal_path).read_text())['samples'];samples={}
 for sid,meta in metas.items():
  x,sr=sf.read(Path(sample_dir)/Path(meta['file']).name,dtype='float32');x=x.mean(axis=1) if x.ndim>1 else x
  if sr!=SR:raise RuntimeError((sid,sr))
  x=x*dbamp(LEVELS[Path(meta['file']).name]);samples[sid]=x.astype(np.float32)
 return samples,metas,cal

def init_worker(sample_dir,cal_path,factory_dir=None):
 global SAMPLES,METAS,CAL,NOTE_CACHE,DRUM_CACHE,PALETTES,FACTORY_DIR
 FACTORY_DIR=Path(factory_dir) if factory_dir else None
 if FACTORY_DIR:
  factory=json.loads((FACTORY_DIR/"factory-bank-manifest.json").read_text())
  PALETTES={"factory":{"patches":{p["id"]:p for p in factory["patches"]}}}
  PALETTES.update(json.loads((FACTORY_DIR/"data/studio-palettes.js").read_text().split("=",1)[1].rstrip(";\n")))
 SAMPLES,METAS,CAL=load_samples(sample_dir,cal_path);NOTE_CACHE={};DRUM_CACHE={}

def palette_sample(style, info, event):
 palette=style.get("sound_palette","factory")
 patch=PALETTES[palette]["patches"][info["factory_patch"]]
 regions=patch["profiles"]["neo16"]["regions"]
 midi=patch.get("note",info["root_midi"]) if event["kind"]=="drum" or patch["type"] in ("drum","fx") else event["midi"]
 velocity=max(1,min(127,round(event.get("velocity",event.get("velocity_norm",.66)*127))))
 matches=[r for r in regions if r["lokey"]<=midi<=r["hikey"] and r["lovel"]<=velocity<=r["hivel"]]
 if not matches:matches=[r for r in regions if r["lokey"]<=midi<=r["hikey"]]
 if not matches:matches=[min(regions,key=lambda r:abs(r["root"]-midi))]
 count=max(r.get("rr_count",1) for r in matches)
 rr=int(abs(math.floor(event.get("performance_beat",event["beat"])*97+midi*13+velocity*3+.5)))%count+1
 region=next((r for r in matches if r.get("rr",1)==rr),matches[0]);sid=region["file"]
 if sid not in SAMPLES:
  y,rate=sf.read(FACTORY_DIR/sid,dtype="float32");assert rate==SR
  SAMPLES[sid]=y*dbamp(LEVELS[sid]);METAS[sid]={"root_midi":region["root"],"loop":region.get("loop")}
 return sid,METAS[sid],SAMPLES[sid]

def make_note(src,meta,midi,duration,attack,release,cents=0):
 rate=2**(((midi+cents/100)-meta['root_midi'])/12);loop=meta.get('loop');target=max(1,int((duration+release)*SR))
 if loop:
  ls=int(loop['start_sec']*SR);le=int(loop['end_sec']*SR);atk=resample_rate(src[:ls],rate);lp=resample_rate(src[ls:le],rate)
  if len(lp)<2:lp=resample_rate(src,rate)
  needed=max(0,target-len(atk));reps=math.ceil(needed/max(1,len(lp)));y=np.concatenate([atk,np.tile(lp,reps)])[:target]
 else:
  y=resample_rate(src,rate);y=np.pad(y,(0,max(0,target-len(y))))[:target]
 return (y*envelope(len(y),attack,release)).astype(np.float32)

def bus_for(ev):return ROLE_BUS.get(ev.get('role','support'),'harmony')
def put_circular(dst,src,start):
 n=len(dst);remaining=src;pos=start
 while len(remaining):
  take=min(len(remaining),n-pos);dst[pos:pos+take]+=remaining[:take];remaining=remaining[take:];pos=0

def render_style(style,outdir):
 global SAMPLES,METAS,NOTE_CACHE,DRUM_CACHE
 beat_sec=60/style['bpm'];n=int(style['beats']*beat_sec*SR);out=Path(outdir);out.mkdir(parents=True,exist_ok=True);wav=out/f"{style['id']}.wav";ogg=out/f"{style['id']}.ogg";mp3=out/f"{style['id']}.mp3"
 if ogg.exists() and mp3.exists():
  audio,sr=sf.read(ogg,dtype='float32',always_2d=True);meter=pyln.Meter(sr);lufs=float(meter.integrated_loudness(audio));peak=float(np.max(np.abs(audio))) or 1e-9;mono=audio.mean(axis=1);win=max(1,int(.4*sr));hop=max(1,int(.1*sr));vals=[20*math.log10(math.sqrt(float(np.mean(mono[i:i+win]**2))+1e-12)+1e-12) for i in range(0,max(1,len(mono)-win),hop)];dyn=float(np.percentile(vals,95)-np.percentile(vals,10)) if vals else 0
  return {'id':style['id'],'category':style['category'],'target_lufs':style.get('mix_v3',style.get('mix_v2',{})).get('target_lufs',-16),'integrated_lufs':round(lufs,3),'peak_dbfs':round(20*math.log10(peak+1e-12),3),'short_term_range_db':round(dyn,3),'quality_status':style.get('composition_quality',{}).get('status'),'events':len(style['events']),'skipped':True}
 buses={b:np.zeros((n,2),np.float32) for b in BUS_ORDER};kick_starts=[]
 for ev in style['events']:
  info=style['instrument_map'][ev['inst']]
  if PALETTES:sid,meta,src=palette_sample(style,info,ev)
  else:sid=info['sample'];meta=METAS[sid];src=SAMPLES[sid]
  role=ev.get('role','support');bus=bus_for(ev)
  start_beat=float(ev.get('performance_beat',ev['beat']));start=int(start_beat*beat_sec*SR)%n;cutoff=int(ev.get('brightness_cutoff') or 0)
  if ev['kind']=='drum':
   offset=int(max(0,ev.get('sample_offset_ms',0))*SR/1000);cents=round(float(ev.get('tuning_cents',0))/2.5)*2.5;key=(sid,offset,cents,cutoff);y=DRUM_CACHE.get(key)
   if y is None:
    y=src[offset:].copy();y*=envelope(len(y),.001,min(.30,len(y)/SR*.66));
    if cents:y=resample_rate(y,2**(cents/1200))
    if cutoff:y=circular_filter(y[:,None].repeat(2,axis=1),None,cutoff)[:,0]
    if len(DRUM_CACHE)<1600:DRUM_CACHE[key]=y
   if role=='kick':kick_starts.append(start)
  else:
   dur=float(ev.get('performance_duration',ev.get('duration',.25)))*beat_sec;fam=info.get('family','')
   attack=float(ev.get('attack',.012 if not meta.get('loop') else (.09 if fam in ('strings','choir','texture') else .025)));release=float(ev.get('release',.16 if not meta.get('loop') else (.50 if fam in ('strings','choir','texture') else .22)))
   cents=round(float(ev.get('tuning_cents',0))/2.5)*2.5;depth=round(float(ev.get('performance_vibrato_depth',ev.get('vibrato',0)) or 0),1);delay=round(float(ev.get('vibrato_delay_ms',140))/20)*20;dur_q=round(dur/0.04)*0.04;attack_q=round(attack/0.01)*0.01;release_q=round(release/0.04)*0.04;key=(sid,int(ev['midi']),dur_q,attack_q,release_q,cents,depth,delay,cutoff)
   y=NOTE_CACHE.get(key)
   if y is None:
    y=make_note(src,meta,ev['midi'],dur_q,attack_q,release_q,cents)
    if depth:
     t=np.arange(len(y),dtype=np.float32)/SR;fade=np.clip((t-delay/1000)/.18,0,1);y*=1+.025*depth*fade*np.sin(2*np.pi*5.1*t)
    if cutoff:y=circular_filter(y[:,None].repeat(2,axis=1),None,cutoff)[:,0]
    if len(NOTE_CACHE)<12000:NOTE_CACHE[key]=y
  source_trim=dbamp(float(info.get('mix_trim_db',0.0)));amp=ROLE_AMP.get(role,.15)*float(ev.get('velocity_gain',1))*source_trim;st=pan_stereo(y*amp,float(ev.get('performance_pan',ev.get('pan',0))));put_circular(buses[bus],st,start)
 # process buses
 adjusted={};cat_adj=CATEGORY_ADJUST.get(style['category'],{})
 for b,x in buses.items():
  if not np.any(x):adjusted[b]=x;continue
  hp,lp=BUS_EQ[b];x=circular_filter(x,hp,lp);x=compressor(x,*BUS_COMP[b]);level=active_level_db(x);target=BUS_TARGET[b]+cat_adj.get(b,0);trim=clamp(target-level,-11,8);x*=dbamp(trim)
  if b=='bass':
   mono=np.mean(x,axis=1);x=np.stack([mono,mono],axis=1)
   low=circular_filter(x,None,180);x=np.tanh((x+low*.22)*1.08)/1.08
  elif b=='drums':
   # Parallel compressed body plus a restrained high-frequency transient layer.
   parallel=compressor(x,-27,6.0)
   transient=circular_filter(x,950,13800)
   x=x+parallel*.30+transient*.16
  elif b in ('harmony','atmosphere'):x=width(x,1.14 if b=='harmony' else 1.24)
  elif b=='lead':x=width(x,.84)
  adjusted[b]=x.astype(np.float32)
 # priority automation
 leadg=sidechain_gain(adjusted['lead'],style.get('mix_v3',style.get('mix_v2',{})).get('lead_duck_db',1.8)) if np.any(adjusted['lead']) else np.ones(n,np.float32)
 for b,scale in (('harmony',1.0),('rhythm',.55),('atmosphere',.7)):
  # convert gain to less aggressive for secondary buses
  adjusted[b]*=(1-(1-leadg)*scale)[:,None]
 if kick_starts and np.any(adjusted['bass']):
  env=make_trigger_env(n,kick_starts);duck=style.get('mix_v3',style.get('mix_v2',{})).get('kick_bass_duck_db',1.0);adjusted['bass']*=dbamp(-duck*env)[:,None]
 # wet from processed stems
 wet=np.zeros((n,2),np.float32)
 for b,x in adjusted.items():wet+=x*BUS_SEND[b]
 wet=circular_filter(wet,180,7200);delay=max(1,int(style.get('mix',{}).get('echo_time',.22)*SR));fb=float(style.get('mix',{}).get('echo_feedback',.18));space=.75 if style['category'] in ('action','electronic') else 1.0
 echo=np.zeros_like(wet)
 for tap,amp in ((1,.72),(2,fb*.65),(3,fb*fb*.45)):echo+=np.stack([np.roll(wet[:,1],delay*tap),np.roll(wet[:,0],delay*tap)],axis=1)*amp*space
 mix=sum(adjusted.values())+echo
 del buses,adjusted,wet,echo
 mix=circular_filter(mix,24,14500);mix-=np.mean(mix,axis=0,keepdims=True);mix=np.tanh(mix*.92)/.92
 meter=pyln.Meter(SR);lufs=float(meter.integrated_loudness(mix));target=float(style.get('mix_v3',style.get('mix_v2',{})).get('target_lufs',-16));mix*=dbamp(target-lufs)
 # peak guard with conservative intersample margin
 peak=float(np.max(np.abs(mix))) or 1;ceiling=dbamp(float(style.get('mix_v3',style.get('mix_v2',{})).get('true_peak_dbfs',-1.0))-.25)
 if peak>ceiling:mix*=ceiling/peak
 final_lufs=float(meter.integrated_loudness(mix));peak=float(np.max(np.abs(mix)))
 mono=mix.mean(axis=1);win=max(1,int(.4*SR));hop=max(1,int(.1*SR));vals=[]
 for i in range(0,max(1,n-win),hop):vals.append(20*math.log10(math.sqrt(float(np.mean(mono[i:i+win]**2))+1e-12)+1e-12))
 dyn=float(np.percentile(vals,95)-np.percentile(vals,10)) if vals else 0
 sf.write(wav,mix.astype(np.float32),SR,subtype='PCM_16');subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-c:a','libvorbis','-q:a','5',str(ogg)],check=True);subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-c:a','libmp3lame','-q:a','4',str(mp3)],check=True);wav.unlink(missing_ok=True)
 return {'id':style['id'],'category':style['category'],'target_lufs':target,'integrated_lufs':round(final_lufs,3),'peak_dbfs':round(20*math.log10(peak+1e-12),3),'short_term_range_db':round(dyn,3),'quality_status':style.get('composition_quality',{}).get('status'),'events':len(style['events']),'sound_palette':style.get('sound_palette','factory') if PALETTES else 'original','sample_backend':'multisample' if PALETTES else 'compact'}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('catalog',type=Path);ap.add_argument('sample_dir',type=Path);ap.add_argument('calibration',type=Path);ap.add_argument('outdir',type=Path);ap.add_argument('--workers',type=int,default=4);ap.add_argument('--factory-dir',type=Path);args=ap.parse_args();cat=json.loads(args.catalog.read_text());args.outdir.mkdir(parents=True,exist_ok=True);reports=[]
 with ProcessPoolExecutor(max_workers=args.workers,initializer=init_worker,initargs=(str(args.sample_dir),str(args.calibration),str(args.factory_dir) if args.factory_dir else None)) as ex:
  futs={ex.submit(render_style,s,args.outdir):s['id'] for s in cat['styles']}
  for fut in as_completed(futs):
   r=fut.result();reports.append(r);print(r['id'],r['integrated_lufs'],r['peak_dbfs'],flush=True)
 reports.sort(key=lambda x:x['id']);(args.outdir/'mix-report.json').write_text(json.dumps(reports,indent=2))
if __name__=='__main__':main()
