"""Studio palettes: recorded chamber sources, magnetic keys, and circuit synthesis.
Recordings are supplied explicitly by the bank builder; this module never downloads.
"""
import numpy as np
from scipy.signal import resample_poly, butter, sosfilt
from fractions import Fraction
from synthesize_soundbanks import synthesize as original

VERSION = "3.0.0"

def finish(x, sr, looped):
    x=np.asarray(x,dtype=np.float64);x-=x.mean()
    if looped:
        start,end,fade=[round(sr*s) for s in (.7,2.3,.18)]
        x=np.pad(x,(0,max(0,end+int(sr*.3)-len(x))))
        w=.5-.5*np.cos(np.linspace(0,np.pi,fade))
        x[end-fade:end]=x[end-fade:end]*(1-w)+x[start-fade:start]*w
        loop={"start_sec":.7,"end_sec":2.3}
    else: loop=None
    x[:32]*=np.linspace(0,1,32);x[-int(sr*.025):]*=np.linspace(1,0,int(sr*.025))**2
    peak=max(np.max(np.abs(x)),1e-8);active=x[np.abs(x)>peak*.04]
    rms=np.sqrt(np.mean(active**2)) if len(active) else 1
    x*=min(.18/max(rms,1e-8),.87/peak)
    return x.astype(np.float32),loop

def render(patch,midi,velocity,variation,sr,looped,palette="chamber",recording=None):
    if palette=="chamber" and recording is not None:
        source,source_sr,root=recording
        rate=Fraction(sr/source_sr*2**((root-midi)/12)).limit_denominator(2048)
        x=resample_poly(source,rate.numerator,rate.denominator)
        # Keep the recorded attack; trim only the measured leading silence.
        active=np.flatnonzero(np.abs(x)>np.max(np.abs(x))*.008)
        if len(active):x=x[max(0,active[0]-int(sr*.004)):]
        seconds=2.6 if looped else 4.8
        x=np.pad(x[:int(sr*seconds)],(0,max(0,int(sr*seconds)-len(x))))
        return finish(x,sr,looped)
    if palette=="chamber":return original(patch,midi,velocity,variation,sr,looped)
    # Each palette has a separate excitation and decay, not a master EQ preset.
    drum=patch.startswith("drums.");v=velocity/127;f=440*2**((midi-69)/12)
    if drum:
        x,_=original(patch,midi,velocity,variation,sr,looped)
        if palette=="velvet":
            x=sosfilt(butter(2,5200,fs=sr,output="sos"),x)*np.exp(-np.arange(len(x))/sr*1.8)
        else:x=np.tanh(x*(1.4+v))*.7
        return finish(x,sr,looped)
    t=np.arange(int(sr*(2.6 if looped else 4.8)))/sr
    bass=patch.startswith("bass.");pad=any(k in patch for k in ("strings","choir","texture","pad"))
    if palette=="velvet":
        # Tine + reed pair. Inharmonic attack falls away into a warm fundamental.
        depth=(.6+2.8*v)*np.exp(-t*(3.2 if bass else 2.1))
        x=np.sin(2*np.pi*f*t+depth*np.sin(2*np.pi*f*(1 if bass else 2.002)*t))
        x+=.18*np.sin(2*np.pi*f*1.0018*t+.3)+.075*v*np.sin(2*np.pi*f*7.01*t)*np.exp(-t*8)
        x*=np.exp(-t*(.7 if bass else .35)) if not pad else (1-np.exp(-t*6))
        # Very slow, shallow wow; no uncontrolled detune or huge reverb.
        pos=np.arange(len(t))+.00025*sr*np.sin(2*np.pi*.65*t)
        x=np.interp(pos,np.arange(len(x)),x)
    else:
        # Band-limited dual oscillator with an envelope that closes the spectrum.
        x=np.zeros(len(t));cut=(3+18*v)*np.exp(-t*(2.8 if bass else 1.6))+1.4
        for h in range(1,min(60,int(sr*.43/f))+1):
            weight=np.exp(-h/cut)/h
            if not bass:weight*=np.sin(np.pi*h*.37)
            x+=weight*(np.sin(2*np.pi*f*h*t)+.32*np.sin(2*np.pi*f*h*1.002*t+.4))
        if bass:x+=.3*np.sin(2*np.pi*f*t)
        x=np.tanh(x*1.7)
        if not pad:x*=np.exp(-t*(2.6 if bass else 1.1))
        else:x*=1-np.exp(-t*5)
    x*=np.minimum(1,t/(.09 if pad else .004))
    # Alternate attacks remain deterministic but have distinct phase transients.
    x+=.003*np.sin(2*np.pi*f*(3+.003*variation)*t+variation)*np.exp(-t*35)
    return finish(x,sr,looped)
