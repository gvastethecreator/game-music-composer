#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, math, subprocess, os
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
import numpy as np
import soundfile as sf

SR=32000
SAMPLE_DIR=Path('/mnt/data/neospc_work/sample_source/snes-midi-composer-showcase-v0.6/assets/samples')
MANIFEST=json.loads((SAMPLE_DIR/'sample-bank.json').read_text())
METAS={x['id']:x for x in MANIFEST['samples']}
SAMPLES=None
NOTE_CACHE=None
DRUM_CACHE=None


def resample_rate(x,rate):
    if abs(rate-1)<1e-7:return x.copy()
    n=max(1,int(len(x)/rate));idx=np.arange(n)*rate
    return np.interp(idx,np.arange(len(x)),x).astype(np.float32)

def envelope(n,attack,release,sustain=.98):
    y=np.ones(n,dtype=np.float32)*sustain;a=min(n,max(1,int(attack*SR)));r=min(n,max(1,int(release*SR)))
    y[:a]=np.linspace(0,sustain,a,endpoint=False)
    if r<n:y[-r:]*=np.linspace(1,0,r)
    else:y*=np.linspace(1,0,n)
    return y

def lowpass(x,cutoff):
    if not cutoff or cutoff>=15000:return x
    # vector-friendly one-pole filter loop
    alpha=math.exp(-2*math.pi*max(180,cutoff)/SR);y=np.empty_like(x);prev=0.0
    for i,v in enumerate(x):prev=(1-alpha)*v+alpha*prev;y[i]=prev
    return y

def make_note(sample,meta,midi,duration,attack,release,cents=0):
    rate=2**(((midi+cents/100)-meta['root_midi'])/12);loop=meta.get('loop');target=max(1,int((duration+release)*SR))
    if loop:
        ls=int(loop['start_sec']*SR);le=int(loop['end_sec']*SR);atk=resample_rate(sample[:ls],rate);lp=resample_rate(sample[ls:le],rate)
        if len(lp)<2:lp=resample_rate(sample,rate)
        needed=max(0,target-len(atk));reps=math.ceil(needed/max(1,len(lp)));y=np.concatenate([atk,np.tile(lp,reps)])[:target]
    else:
        y=resample_rate(sample,rate);y=np.pad(y,(0,max(0,target-len(y))))[:target]
    return y*envelope(len(y),attack,release)

def pan_stereo(x,pan):
    p=max(-1,min(1,float(pan)));l=math.cos((p+1)*math.pi/4);r=math.sin((p+1)*math.pi/4)
    return np.stack([x*l,x*r],axis=1)

def load_samples():
    samples={}
    for sid,meta in METAS.items():
        x,sr=sf.read(SAMPLE_DIR/(Path(meta['file']).name),dtype='float32');x=x.mean(axis=1) if x.ndim>1 else x
        if sr!=SR: raise RuntimeError((sid,sr))
        samples[sid]=x
    return samples

def init_worker():
    global SAMPLES, NOTE_CACHE, DRUM_CACHE
    SAMPLES=load_samples()
    NOTE_CACHE={}
    DRUM_CACHE={}

def render_style(style,outdir):
    global SAMPLES, NOTE_CACHE, DRUM_CACHE
    samples=SAMPLES if SAMPLES is not None else load_samples(); beat_sec=60/style['bpm'];n=int(style['beats']*beat_sec*SR)
    dry=np.zeros((n,2),dtype=np.float32);wet=np.zeros((n,2),dtype=np.float32)
    for ev in style['events']:
        info=style['instrument_map'][ev['inst']];sid=info['sample'];meta=METAS[sid];src=samples[sid]
        start_beat=float(ev.get('performance_beat',ev['beat']));start=int(start_beat*beat_sec*SR)%n
        cutoff=int(ev.get('brightness_cutoff') or 0)
        if ev['kind']=='drum':
            offset=int(max(0,ev.get('sample_offset_ms',0))*SR/1000)
            cents=round(float(ev.get('tuning_cents',0)),1)
            dkey=(sid,offset,cents,cutoff)
            y=DRUM_CACHE.get(dkey) if DRUM_CACHE is not None else None
            if y is None:
                y=src[offset:].copy();dur=len(y)/SR;attack=.001;release=min(.28,dur*.62);y=y*envelope(len(y),attack,release)
                if cents:y=resample_rate(y,2**(cents/1200))
                if cutoff:y=lowpass(y,cutoff)
                y=y.astype(np.float32)
                if DRUM_CACHE is not None: DRUM_CACHE[dkey]=y
        else:
            dur=float(ev.get('performance_duration',ev.get('duration',.25)))*beat_sec
            fam=info.get('family','')
            attack=float(ev.get('attack',.012 if not meta.get('loop') else (.09 if fam in ('strings','choir','texture') else .025)))
            release=float(ev.get('release',.16 if not meta.get('loop') else (.5 if fam in ('strings','choir','texture') else .22)))
            cents=round(float(ev.get('tuning_cents',0)),1)
            depth=round(float(ev.get('performance_vibrato_depth',ev.get('vibrato',0)) or 0),3)
            delay=round(float(ev.get('vibrato_delay_ms',140)),1)
            nkey=(sid,int(ev['midi']),round(dur,4),round(attack,4),round(release,4),cents,depth,delay,cutoff)
            y=NOTE_CACHE.get(nkey) if NOTE_CACHE is not None else None
            if y is None:
                y=make_note(src,meta,ev['midi'],dur,attack,release,cents)
                if depth:
                    t=np.arange(len(y),dtype=np.float32)/SR;delay_sec=delay/1000;fade=np.clip((t-delay_sec)/.18,0,1);y*=1+.03*depth*fade*np.sin(2*np.pi*5.1*t)
                if cutoff:y=lowpass(y,cutoff)
                y=y.astype(np.float32)
                if NOTE_CACHE is not None and len(NOTE_CACHE)<30000: NOTE_CACHE[nkey]=y
        gain=ev.get('gain',.05)*ev.get('accent',1)*ev.get('performance_gain',1)
        stereo=pan_stereo(y*gain,ev.get('performance_pan',ev.get('pan',0)))
        remaining=stereo;pos=start
        while len(remaining):
            take=min(len(remaining),n-pos);dry[pos:pos+take]+=remaining[:take];wet[pos:pos+take]+=remaining[:take]*ev.get('send',.08);remaining=remaining[take:];pos=0
    mix=style.get('mix',{});delay=max(1,int(mix.get('echo_time',.22)*SR));fb=mix.get('echo_feedback',.2)
    for tap,amp in ((1,1),(2,fb),(3,fb*fb*.65)):
        shift=(delay*tap)%n;dry[:,0]+=np.roll(wet[:,1],shift)*amp;dry[:,1]+=np.roll(wet[:,0],shift)*amp
    drive=mix.get('drive',0)
    if drive:dry=np.tanh(dry*(1+drive*4))/(1+drive*.7)
    dry-=np.mean(dry,axis=0,keepdims=True);peak=np.max(np.abs(dry)) or 1;dry=np.tanh(dry*(1.08/peak))
    rms=float(np.sqrt(np.mean(dry**2))) or 1e-9;target=10**(mix.get('preview_rms_db',-15)/20);gain=min(target/rms,.92/(np.max(np.abs(dry)) or 1));dry*=gain
    audio=dry.astype(np.float32)
    outdir=Path(outdir);outdir.mkdir(parents=True,exist_ok=True)
    wav=outdir/f"{style['id']}.wav";ogg=outdir/f"{style['id']}.ogg";mp3=outdir/f"{style['id']}.mp3"
    if ogg.exists() and mp3.exists():
        return {'id':style['id'],'seconds':round(n/SR,3),'events':len(style['events']),'peak_voices':style['measured_peak_voices'],'ogg_bytes':ogg.stat().st_size,'mp3_bytes':mp3.stat().st_size,'audio_peak':None,'rms':None,'skipped':True}
    sf.write(wav,audio,SR,subtype='PCM_16')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-c:a','libvorbis','-q:a','4',str(ogg)],check=True)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-c:a','libmp3lame','-q:a','5',str(mp3)],check=True)
    wav.unlink(missing_ok=True)
    return {'id':style['id'],'seconds':round(n/SR,3),'events':len(style['events']),'peak_voices':style['measured_peak_voices'],'ogg_bytes':ogg.stat().st_size,'mp3_bytes':mp3.stat().st_size,'audio_peak':float(np.max(np.abs(audio))),'rms':float(np.sqrt(np.mean(audio**2)))}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('catalog',type=Path);ap.add_argument('outdir',type=Path);ap.add_argument('--workers',type=int,default=4);args=ap.parse_args()
    catalog=json.loads(args.catalog.read_text());args.outdir.mkdir(parents=True,exist_ok=True)
    reports=[]
    with ProcessPoolExecutor(max_workers=args.workers, initializer=init_worker) as ex:
        futs={ex.submit(render_style,s,args.outdir):s['id'] for s in catalog['styles']}
        for fut in as_completed(futs):
            r=fut.result();reports.append(r);print(r['id'],r['seconds'],'sec',r['events'],'events')
    reports.sort(key=lambda x:x['id']);(args.outdir/'render-report.json').write_text(json.dumps(reports,indent=2))

if __name__=='__main__':main()
