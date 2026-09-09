"""Original, family-specific modal, FM and subtractive multisample synthesis.

Timber models excitation, independently damped partials and body resonances.
Prism uses separate FM algorithms for struck, plucked and sustained voices.
Voltage uses band-limited oscillators, dynamic spectra and oversampled drive.
These are designed synthetic instruments, not sampled acoustic performances.
"""
import hashlib
import numpy as np
from scipy.signal import butter, sosfilt, iirpeak, lfilter, resample_poly

VERSION='1.0.0'
PALETTES={'timber':'Timber', 'prism':'Prism', 'voltage':'Voltage'}

def family(p):
    if p.startswith('drums.'):return 'percussion'
    if p.startswith(('texture.wind','fx.')):return 'noise'
    if p.startswith('bass.'):return 'bass'
    if p.startswith(('guitar.','plucks.')) or p=='strings.pizzicato':return 'pluck'
    if p.startswith(('keys.','mallets.')) or p=='synth.fm_bell':return 'struck'
    if p.startswith('winds.'):return 'wind'
    if p.startswith('brass.'):return 'brass'
    if p.startswith('choir.'):return 'choir'
    if p.startswith('strings.'):return 'bowed'
    return 'synth'

def filtered(x, cutoff, sr, kind='lowpass'):
    return sosfilt(butter(2,cutoff,fs=sr,btype=kind,output='sos'),x)

def finish(x,sr,looped):
    x=np.asarray(x,dtype=np.float64);x-=np.mean(x)
    loop=None
    if looped:
        start,end,fade=[round(sr*t) for t in (.8,2.6,.20)]
        w=.5-.5*np.cos(np.linspace(0,np.pi,fade))
        x[end-fade:end]=(1-w)*x[end-fade:end]+w*x[start-fade:start]
        loop={'start_sec':start/sr,'end_sec':end/sr}
    n=min(len(x)//2,round(sr*.002));x[:n]*=np.linspace(0,1,n)
    n=min(len(x)//2,round(sr*.055));x[-n:]*=np.linspace(1,0,n)**2
    peak=float(np.max(np.abs(x)));active=x[np.abs(x)>peak*.025]
    rms=float(np.sqrt(np.mean(active**2))) if len(active) else 0
    if not np.isfinite(x).all() or rms<1e-8:raise ValueError('Invalid synthesized signal')
    x*=min(.17/rms,.80/max(peak,1e-8))
    return x.astype(np.float32),loop

def percussion(p,t,v,rng,palette,sr):
    noise=rng.normal(0,1,len(t));tone=1 if palette=='timber' else 1.15 if palette=='prism' else .88
    if 'kick' in p:
        f=(47 if 'deep' in p else 62)*tone
        phase=2*np.pi*(f*t+(75+80*v)*(1-np.exp(-t*44))/44)
        x=np.sin(phase)*np.exp(-t*(6 if 'deep' in p else 12))
        x+=.14*v*filtered(noise,3500,sr)*np.exp(-t*220)
        x+=.15*np.sin(2*phase)*np.exp(-t*32)
    elif any(k in p for k in ('tom','bongo','rim')):
        f=(205 if 'bongo' in p else 420 if 'rim' in p else 108 if 'low' in p else 163)*tone
        ratios=(1,1.593,2.136,2.296,2.65)
        x=sum((.66**i)*np.sin(2*np.pi*f*r*t+.1*i)*np.exp(-t*(12+i*8)*(3 if 'rim' in p else 1)) for i,r in enumerate(ratios))
        x+=.11*v*filtered(noise,3800,sr)*np.exp(-t*110)
    elif 'snare' in p:
        body=sum(a*np.sin(2*np.pi*f*t)*np.exp(-t*d) for a,f,d in [(1,178*tone,22),(.55,331*tone,32),(.23,472*tone,48)])
        wires=filtered(noise,1800,sr,'highpass')*(1-np.exp(-t*1200))*np.exp(-t*(16 if 'body' in p else 23))
        x=.65*body+(.27+.48*v)*wires
    else:
        open_hat='open' in p;guira='guira' in p;shaker='shaker' in p or guira
        metal=sum(np.sin(2*np.pi*f*t+rng.uniform(-np.pi,np.pi)) for f in (3111,4229,5573,6833,8191,9733) if f<sr*.44)
        x=filtered(.28*metal+noise*(.8 if shaker else .32),2400 if shaker else 4600,sr,'highpass')
        x*=np.exp(-t*(7 if open_hat else 18 if guira else 38 if shaker else 58))
        if guira:x*=.35+.65*np.maximum(0,np.sin(2*np.pi*(83+27*v)*t))**4
    if palette=='prism':x+=.13*np.sin(2*np.pi*713*t+2.2*np.sin(2*np.pi*1093*t))*np.exp(-t*35)
    if palette=='voltage':x=np.tanh(x*(1.15+v))
    return x

def modal(p,f,t,v,rng,sr):
    fam=family(p);piano='piano' in p and 'electric' not in p
    metal=any(k in p for k in ('vibraphone','music_box','dulcimer','fm_bell'))
    muted=any(k in p for k in ('segunda','pizzicato','soft'))
    stiffness=.00009 if piano else .000025 if 'electric' in p else .000012
    position=(.10 if 'pick' in p or 'harpsichord' in p else .22)+rng.uniform(-.012,.012)
    decay=(1.1 if fam=='bass' else 1.8 if piano else 1.25)*(0.35 if muted else 1)
    count=min(36,int(sr*.43/f));x=np.zeros(len(t))
    for h in range(1,count+1):
        ratio=h*np.sqrt((1+stiffness*h*h)/(1+stiffness))
        if metal:ratio=[1,2.756,5.404,8.933,13.344,18.646][(h-1)%6]+19*((h-1)//6)
        if f*ratio>=sr*.43:continue
        shape=np.sin(np.pi*h*position)/(h**(1.15 if fam=='pluck' else 1.4))
        brightness=np.exp(-h/(1.2+22*v**3))
        damping=np.exp(-t*(1/decay+.035*h**1.6/(.35+v)))
        partial=np.sin(2*np.pi*f*ratio*t+rng.uniform(-.025,.025))*damping
        if piano:partial+=.32*np.sin(2*np.pi*f*ratio*1.0007*t+.08)*damping
        x+=shape*brightness*partial
    x*=1-np.exp(-t*(850 if not piano else 500))
    contact=filtered(rng.normal(0,1,len(t)),1800+4000*v,sr)*np.exp(-t*(170 if fam=='pluck' else 280))
    x+=contact*.017*v
    # A small parallel body response, separate from the vibrating string.
    for hz,gain,q in ((105,.13,3),(215,.10,5),(430,.06,7)) if fam in ('pluck','bass') else ((320,.05,5),(1100,.03,8)):
        b,a=iirpeak(hz,q,fs=sr);x+=gain*lfilter(b,a,x)
    return x

def sustained(p,f,t,v,rng,sr):
    fam=family(p);x=np.zeros(len(t));phase=2*np.pi*f*t
    vib=(1-np.exp(-np.maximum(0,t-.18)*5))*.0025*np.sin(2*np.pi*(4.7+rng.uniform(-.15,.15))*t)
    phase+=2*np.pi*f*np.cumsum(vib)/sr
    if fam=='choir':formants=[(780,150),(1150,190),(2800,300)] if p.endswith('ah') else [(350,110),(850,150),(2300,300)]
    else:formants=[(650,500),(1800,950)]
    for h in range(1,min(44,int(sr*.43/f))+1):
        if fam=='wind':
            amp=(1/h**1.7 if 'oboe' in p else (1/h if h%2 else .08/h) if 'clarinet' in p else 1/h**3.2)
        elif fam=='choir':amp=(.045+sum(np.exp(-.5*((h*f-c)/w)**2) for c,w in formants))/h
        elif fam=='brass':amp=np.exp(-h/(2+13*v*(1-np.exp(-t*12))))/h**.65
        else:amp=np.exp(-h/(5+14*v))/h
        part=np.sin(h*phase+.035*h)
        if fam=='bowed' and p not in ('strings.cello','bass.bowed_contrabass'):
            part=(part+.45*np.sin(h*phase*1.0012+.4)+.40*np.sin(h*phase*.9988-.5))/1.8
        x+=amp*part
    attack=.07 if fam in ('bowed','choir') else .025 if fam=='brass' else .018
    x*=(1-np.exp(-t/attack))*(.86+.14*np.exp(-t*2))
    breath=filtered(rng.normal(0,1,len(t)),[800,5000],sr,'bandpass')
    x+=breath*(.012 if fam=='wind' else .004)*(1-np.exp(-t*50))
    if 'tremolo' in p:x*=.78+.22*np.sin(2*np.pi*7*t)
    return x

def fm(p,f,t,v,rng,sr):
    fam=family(p);sustain=fam in ('wind','brass','choir','bowed','synth')
    ratio=1 if fam=='bass' else 2 if 'electric' in p else 3 if fam=='pluck' else 2.756 if any(k in p for k in ('box','bell','vibraphone')) else 1.001
    index=(.25+3.6*v*v)*((.25+.75*np.exp(-t*4)) if sustain else np.exp(-t*(4 if fam=='bass' else 2.8)))
    phase=2*np.pi*f*t
    mod=np.sin(ratio*phase+.24*v*np.exp(-t*9)*np.sin(phase*3.997))
    x=np.sin(phase+index*mod)
    x+=.22*np.sin(phase*2+(.2+v)*np.exp(-t*6)*np.sin(phase*3.002))
    if sustain:x*=(1-np.exp(-t*(10 if fam in ('choir','bowed') else 60)))*(.86+.14*np.sin(2*np.pi*.37*t+.2))
    else:x*=np.exp(-t*(3.8 if 'segunda' in p else 1.5 if fam=='bass' else .95))*(1-np.exp(-t*650))
    return x

def voltage(p,f,t,v,rng,sr):
    fam=family(p);sustained_voice=fam in ('wind','brass','choir','bowed','synth') or 'analog' in p
    pulse=.25 if '25' in p else .5 if '50' in p else .34 if fam=='pluck' else None
    x=np.zeros(len(t));phase=2*np.pi*f*t
    cutoff=(2+22*v*v)*np.exp(-t*(3.8 if fam=='bass' else 2.3))+(2.2 if fam=='bass' else 4)
    for h in range(1,min(48,int(sr*.43/f))+1):
        amp=np.exp(-(h/cutoff)**2)/h
        if pulse is not None:amp*=np.sin(np.pi*h*pulse)
        x+=amp*(np.sin(h*phase)+(.16 if fam=='bass' else .34)*np.sin(h*phase*1.0016+.24))
    if fam=='bass':x+=.55*np.sin(phase)
    x=np.tanh(x*(1.15+.7*v))
    x*=(1-np.exp(-t*(14 if fam in ('choir','bowed') else 400)))
    if not sustained_voice:x*=np.exp(-t*(4.5 if 'segunda' in p else 1.25))
    return x

def render(patch,midi,velocity,variation,sr=32000,looped=False,palette='timber'):
    if palette not in PALETTES:raise ValueError('Unknown synthesis palette: '+palette)
    seed=int.from_bytes(hashlib.sha256(f'{palette}:{patch}:{midi}:{velocity}:{variation}'.encode()).digest()[:8],'big')
    rng=np.random.default_rng(seed);fam=family(patch)
    internal_sr=sr*2;seconds=.9 if fam=='percussion' else 2.9 if looped else 3.6
    t=np.arange(round(seconds*internal_sr))/internal_sr;v=velocity/127;f=440*2**((midi-69)/12)
    f*=2**(rng.uniform(-.7,.7)/1200)
    if fam=='percussion':x=percussion(patch,t,v,rng,palette,internal_sr)
    elif fam=='noise':
        x=filtered(rng.normal(0,1,len(t)),[400,5500] if palette=='prism' else [100,2200],internal_sr,'bandpass')
        x*=np.sin(np.pi*t/seconds)**2*(.7+.3*np.sin(2*np.pi*.9*t))
    elif patch=='bass.sub_sine':
        x=np.sin(2*np.pi*f*t)+(.03 if palette=='timber' else .12 if palette=='prism' else .2)*np.sin(4*np.pi*f*t)*np.exp(-t*2)
        x*=1-np.exp(-t*160)
    elif palette=='prism':x=fm(patch,f,t,v,rng,internal_sr)
    elif palette=='voltage':x=voltage(patch,f,t,v,rng,internal_sr)
    elif fam in ('pluck','struck') or (fam=='bass' and not looped):x=modal(patch,f,t,v,rng,internal_sr)
    elif fam=='bass' and 'bowed' not in patch:x=voltage(patch,f,t,v*.7,rng,internal_sr)
    else:x=sustained(patch,f,t,v,rng,internal_sr)
    return finish(resample_poly(x,1,2),sr,looped)

if __name__=='__main__':
    import argparse,json
    from pathlib import Path
    import soundfile as sf
    manifest=json.loads((Path(__file__).resolve().parents[1]/'data/factory-bank-manifest.json').read_text(encoding='utf-8'))
    patches={p['id']:p for p in manifest['patches']}
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--palette',choices=PALETTES,required=True);parser.add_argument('--patch',choices=patches,required=True)
    parser.add_argument('--midi',type=int);parser.add_argument('--velocity',type=int,default=96);parser.add_argument('--variation',type=int,choices=(1,2),default=1)
    parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();patch=patches[args.patch]
    if args.output.exists() or args.output.with_suffix('.json').exists():parser.error('Output exists; choose a new path.')
    roots=patch.get('roots') or [patch.get('note',60)];midi=args.midi if args.midi is not None else roots[len(roots)//2]
    if not 1<=args.velocity<=127 or not 0<=midi<=127:parser.error('MIDI must be 0..127 and velocity 1..127.')
    x,loop=render(args.patch,midi,args.velocity,args.variation,32000,bool(patch.get('loop')),args.palette)
    args.output.parent.mkdir(parents=True,exist_ok=True);sf.write(args.output,x,32000,subtype='PCM_16')
    args.output.with_suffix('.json').write_text(json.dumps({'palette':args.palette,'patch':args.patch,'root':midi,'velocity':args.velocity,'variation':args.variation,'loop':loop,'sample_rate':32000,'generator':VERSION,'license':'CC0-1.0'},indent=2)+'\n',encoding='utf-8')
    print('Created',args.output)
