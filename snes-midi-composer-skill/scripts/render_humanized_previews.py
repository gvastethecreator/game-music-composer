#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, math, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT=Path(__file__).resolve().parents[1]
BANK=ROOT/'resources/original-sample-bank/sample-bank.json'
SR=32000

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
    alpha=math.exp(-2*math.pi*max(200,cutoff)/SR); y=np.empty_like(x); prev=0.0
    for i,v in enumerate(x): prev=(1-alpha)*v+alpha*prev;y[i]=prev
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

def render(style,samples,metas):
    beat_sec=60/style['bpm'];n=int(style['beats']*beat_sec*SR);dry=np.zeros((n,2),dtype=np.float64);wet=np.zeros((n,2),dtype=np.float64)
    for ev in style['events']:
        if ev.get('performance_mute'):continue
        info=style['instrument_map'][ev['inst']];sid=info['sample'];meta=metas[sid];src=samples[sid]
        start_beat=float(ev.get('performance_beat',ev['beat']));start=int(start_beat*beat_sec*SR)%n
        if ev['kind']=='drum':
            offset=int(max(0,ev.get('sample_offset_ms',0))*SR/1000);y=src[offset:].copy();dur=len(y)/SR;attack=.001;release=min(.3,dur*.6);y=y*envelope(len(y),attack,release)
            if ev.get('tuning_cents'): y=resample_rate(y,2**(ev['tuning_cents']/1200))
        else:
            dur=float(ev.get('performance_duration',ev.get('duration',.25)))*beat_sec
            attack=ev.get('attack',.012 if not meta.get('loop') else (.08 if ev['inst'] in ('strings','choir','drone') else .025))*ev.get('attack_scale',1)
            release=ev.get('release',.18 if not meta.get('loop') else (.5 if ev['inst'] in ('strings','choir','drone') else .22))
            y=make_note(src,meta,ev['midi'],dur,attack,release,ev.get('tuning_cents',0))
            depth=ev.get('performance_vibrato_depth',0)
            if depth:
                t=np.arange(len(y))/SR;delay=ev.get('vibrato_delay_ms',120)/1000;fade=np.clip((t-delay)/.18,0,1);y*=1+.035*depth*fade*np.sin(2*np.pi*5.1*t)
        if ev.get('brightness_cutoff'):y=lowpass(y,ev['brightness_cutoff'])
        gain=ev.get('gain',.05)*ev.get('accent',1)*ev.get('performance_gain',1)
        pan=ev.get('performance_pan',ev.get('pan',0));stereo=pan_stereo(y*gain,pan)
        remaining=stereo;pos=start
        while len(remaining):
            take=min(len(remaining),n-pos);dry[pos:pos+take]+=remaining[:take];wet[pos:pos+take]+=remaining[:take]*ev.get('send',.08);remaining=remaining[take:];pos=0
    mix=style.get('mix',{});delay=max(1,int(mix.get('echo_time',.22)*SR));fb=mix.get('echo_feedback',.2)
    for tap,amp in ((1,1),(2,fb),(3,fb*fb*.7)):
        shift=(delay*tap)%n;dry[:,0]+=np.roll(wet[:,1],shift)*amp;dry[:,1]+=np.roll(wet[:,0],shift)*amp
    drive=mix.get('drive',0)
    if drive:dry=np.tanh(dry*(1+drive*4))/(1+drive*.7)
    dry-=np.mean(dry,axis=0,keepdims=True);peak=np.max(np.abs(dry)) or 1;dry=np.tanh(dry*(1.12/peak))
    rms=float(np.sqrt(np.mean(dry**2))) or 1e-9;target=10**(mix.get('preview_rms_db',-15)/20);gain=min(target/rms,.9/(np.max(np.abs(dry)) or 1));dry*=gain
    return dry.astype(np.float32)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('catalog',type=Path);ap.add_argument('outdir',type=Path);args=ap.parse_args();args.outdir.mkdir(parents=True,exist_ok=True)
    catalog=json.loads(args.catalog.read_text());manifest=json.loads(BANK.read_text());metas={x['id']:x for x in manifest['samples']};samples={}
    for sid,meta in metas.items():
        x,sr=sf.read(ROOT/meta['file'],dtype='float32');x=x.mean(axis=1) if x.ndim>1 else x
        if sr!=SR:
            raise RuntimeError((sid,sr))
        samples[sid]=x
    report=[]
    for style in catalog['styles']:
        audio=render(style,samples,metas);wav=args.outdir/f"{style['id']}.wav";ogg=args.outdir/f"{style['id']}.ogg";mp3=args.outdir/f"{style['id']}.mp3"
        sf.write(wav,audio,SR,subtype='PCM_16');subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-c:a','libvorbis','-q:a','5',str(ogg)],check=True);subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-c:a','libmp3lame','-q:a','4',str(mp3)],check=True)
        report.append({'id':style['id'],'mode':catalog['mode'],'seconds':round(len(audio)/SR,3),'events':len(style['events']),'ensemble_layers':style.get('performance',{}).get('ensemble_layer_count',0),'peak':float(np.max(np.abs(audio)))})
        print(catalog['mode'],style['id'],report[-1])
    (args.outdir/'render-report.json').write_text(json.dumps(report,indent=2))
if __name__=='__main__':main()
