from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR=32000
OUT=Path('/mnt/data/neospc_work/sample_bank_v32')
SRC=Path('/mnt/data/neospc_work/sample_source/snes-midi-composer-showcase-v0.6/assets/samples')
OUT.mkdir(parents=True,exist_ok=True)
for p in SRC.glob('*.wav'):
    data,sr=sf.read(p,dtype='float32')
    sf.write(OUT/p.name,data,sr,subtype='PCM_16')

def norm(x,peak=.92):
    x=np.asarray(x,dtype=np.float64)
    x-=np.mean(x)
    m=np.max(np.abs(x)) or 1
    return (x/m*peak).astype(np.float32)

def lowpass(x,cut,hz=SR,order=3):
    sos=butter(order,min(.99,cut/(hz/2)),btype='low',output='sos')
    return sosfilt(sos,x)

def highpass(x,cut,hz=SR,order=2):
    sos=butter(order,max(.001,cut/(hz/2)),btype='high',output='sos')
    return sosfilt(sos,x)

def karplus(freq,dur,decay=.997,damping=.42,seed=1):
    rng=np.random.default_rng(seed)
    n=int(dur*SR); delay=max(2,int(SR/freq)); buf=rng.uniform(-1,1,delay)
    # low-pass the excitation for a rounder string
    buf=lowpass(buf,4200,SR,2)
    out=np.zeros(n,dtype=np.float64)
    idx=0; prev=0.0
    for i in range(n):
        v=buf[idx]
        nxt=(v*(1-damping)+prev*damping)*decay
        out[i]=v
        buf[idx]=nxt
        prev=v
        idx=(idx+1)%delay
    return out

def save(name,x):
    sf.write(OUT/name,norm(x),SR,subtype='PCM_16')

# 1) Upright bass: plucked string body, woody transient, realistic decay.
f=110.0 # A2
T=3.2; t=np.arange(int(T*SR))/SR
string=karplus(f,T,decay=.9986,damping=.55,seed=31)
body=.65*np.sin(2*np.pi*f*t)+.20*np.sin(2*np.pi*2*f*t+.3)+.09*np.sin(2*np.pi*3*f*t+.7)
body*=np.exp(-t*2.1)
attack=highpass(np.random.default_rng(8).normal(0,1,len(t)),700)*np.exp(-t*70)*.14
finger=np.sin(2*np.pi*820*t)*np.exp(-t*45)*.035
x=.72*lowpass(string,3200)+body+attack+finger
x*=np.exp(-t*.72)
save('upright_bass_v2_A2.wav',x)

# 2) Electric finger bass: fundamental-forward with finger transient and mild amp saturation.
partials=np.zeros_like(t)
for h,a in [(1,1.0),(2,.38),(3,.20),(4,.11),(5,.07),(6,.04)]:
    partials += a*np.sin(2*np.pi*f*h*t + h*.17)*np.exp(-t*(.55+h*.26))
pluck=np.random.default_rng(12).normal(0,1,len(t)); pluck=highpass(pluck,900)*np.exp(-t*65)*.10
finger=np.sin(2*np.pi*1350*t)*np.exp(-t*52)*.022
x=np.tanh((partials+pluck+finger)*1.25)
x=lowpass(x,4200); x*=np.exp(-t*.34)
save('electric_finger_bass_A2.wav',x)

# 3) Picked bass for rock/action.
partials=np.zeros_like(t)
for h,a in [(1,1.0),(2,.50),(3,.30),(4,.20),(5,.13),(6,.09),(7,.06),(8,.04)]:
    partials += a*np.sin(2*np.pi*f*h*t + .13*h)*np.exp(-t*(.65+h*.18))
pick=highpass(np.random.default_rng(21).normal(0,1,len(t)),1800)*np.exp(-t*90)*.18
click=np.sin(2*np.pi*2300*t)*np.exp(-t*85)*.045
x=np.tanh((partials+pick+click)*1.18); x=lowpass(x,5800); x*=np.exp(-t*.28)
save('picked_bass_A2.wav',x)

# 4) Analog synth bass, loopable.
T=3.0;t2=np.arange(int(T*SR))/SR; f2=110
saw=np.zeros_like(t2)
for h in range(1,18): saw += ((-1)**(h+1))/h*np.sin(2*np.pi*f2*h*t2)
sq=np.sign(np.sin(2*np.pi*f2*t2))
env_filter=.35+.65*np.exp(-t2*4.5)
x=(.58*saw+.20*sq+.32*np.sin(2*np.pi*f2*t2))*env_filter
x=np.tanh(x*1.1); x=lowpass(x,2800); x*=.92
# gentle attack, steady sustain
x*=np.minimum(1,t2/.018)
save('analog_bass_A2.wav',x)

# 5) Sub bass C2, loopable and centered.
T=3.0;t3=np.arange(int(T*SR))/SR; f3=65.406
x=.92*np.sin(2*np.pi*f3*t3)+.18*np.sin(2*np.pi*2*f3*t3)+.055*np.sin(2*np.pi*3*f3*t3)
x=np.tanh(x*1.2); x*=np.minimum(1,t3/.025)
save('sub_bass_C2.wav',x)

# 6) Bowed contrabass A1, loopable with slow bow noise.
T=3.5;t4=np.arange(int(T*SR))/SR; f4=55
vib=1+.0022*np.sin(2*np.pi*4.6*t4)
phase=2*np.pi*f4*np.cumsum(vib)/SR
x=np.zeros_like(t4)
for h,a in [(1,1),(2,.43),(3,.26),(4,.14),(5,.09),(6,.055),(7,.035)]: x+=a*np.sin(h*phase+.11*h)
bow=lowpass(np.random.default_rng(42).normal(0,1,len(t4)),2800)*.05
x=lowpass(x+bow,3600); x*=np.minimum(1,t4/.20); x*=.95
save('bowed_contrabass_A1.wav',x)

# 7) Punchier kick.
T=.62;tk=np.arange(int(T*SR))/SR
fstart,fend=145,46
phase=2*np.pi*(fend*tk+(fstart-fend)*(1-np.exp(-tk*22))/22)
tone=np.sin(phase)*np.exp(-tk*8.8)
sub=np.sin(2*np.pi*48*tk)*np.exp(-tk*7.0)*.32
click=highpass(np.random.default_rng(5).normal(0,1,len(tk)),2500)*np.exp(-tk*110)*.16
x=np.tanh((tone+sub+click)*1.3)
save('kick_punch.wav',x)

# 8) Snare with body and controlled brightness.
T=.55;ts=np.arange(int(T*SR))/SR
rng=np.random.default_rng(9); noise=rng.normal(0,1,len(ts)); noise=highpass(noise,900); noise=lowpass(noise,10500)
noise*=np.exp(-ts*12.5)
body=(np.sin(2*np.pi*185*ts)+.45*np.sin(2*np.pi*335*ts+.4))*np.exp(-ts*16)
crack=highpass(rng.normal(0,1,len(ts)),4200)*np.exp(-ts*55)*.22
x=np.tanh((.72*noise+.55*body+crack)*1.15)
save('snare_body.wav',x)

# Extend manifest.
manifest=json.loads((SRC/'sample-bank.json').read_text())
ids={s['id'] for s in manifest['samples']}
def add(id,file,root,category,traits,notes,loop=None):
    if id in ids:return
    entry={'id':id,'file':f'resources/original-sample-bank/{file}','root_midi':root,'sample_rate':SR,'source_rate_emulation':22050,'category':category,'traits':traits,'notes':notes,'license':'CC0-1.0 / generated by code in this package'}
    if loop:entry['loop']=loop
    entry['bytes_pcm']=(OUT/file).stat().st_size
    manifest['samples'].append(entry);ids.add(id)
add('upright_bass_v2_A2','upright_bass_v2_A2.wav',45,'pitched',['woody','plucked','round','acoustic'],'Jazz, folk and orchestral pizzicato bass; avoid very high register.')
add('electric_finger_bass_A2','electric_finger_bass_A2.wav',45,'pitched',['electric','warm','fingered','focused'],'Town, funk, bossa and pop bass; strong MIDI 31-57.')
add('picked_bass_A2','picked_bass_A2.wav',45,'pitched',['picked','bright','rock','defined'],'Action and rock bass; leave room around 1-3 kHz for lead.')
add('analog_bass_A2','analog_bass_A2.wav',45,'pitched',['analog','rounded','synth','punchy'],'Electronic and sci-fi bass.',{'start_sec':.42,'end_sec':2.35})
add('sub_bass_C2','sub_bass_C2.wav',36,'pitched',['sub','sine','deep','clean'],'Sub bass. Keep mono and generally below MIDI 50.',{'start_sec':.35,'end_sec':2.4})
add('bowed_contrabass_A1','bowed_contrabass_A1.wav',33,'pitched',['bowed','dark','orchestral','sustained'],'Classical, horror and fantasy low sustain.',{'start_sec':.62,'end_sec':2.75})
add('kick_punch','kick_punch.wav',36,'percussion',['punchy','deep','defined'],'Primary kick for action/electronic/urban.')
add('snare_body','snare_body.wav',38,'percussion',['body','crack','controlled'],'Primary snare with stronger mid-body.')
manifest['version']='1.1.0'
manifest['rendering_note']='Original procedural bank expanded with dedicated bass and drum families for Neo-SPC v2.2.'
(OUT/'sample-bank.json').write_text(json.dumps(manifest,indent=2))
print('generated',len(manifest['samples']),'samples at',OUT)
