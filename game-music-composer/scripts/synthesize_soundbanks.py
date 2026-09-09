#!/usr/bin/env python3
"""Deterministic original instrument synthesis. No recordings or model downloads.

Studio v2 uses Nyquist-limited partials, register-dependent spectra, body modes,
velocity-dependent excitation, independent ensemble oscillators and baked loops.
The same generator supplies compact WAVs, multisamples and 44.1 kHz previews.
"""
from __future__ import annotations
import hashlib
import numpy as np
from scipy.signal import butter, sosfilt, resample_poly

VERSION = '2.0.0'

ORIGINAL_PATCHES = {
 'wood_flute_A4':'winds.flute','ocarina_A4':'winds.ocarina','dark_reed_A3':'winds.oboe',
 'snes_brass_A3':'brass.ensemble','string_ensemble_A3':'strings.soft','choir_ah_A3':'choir.ah',
 'low_drone_A3':'texture.dark_drone','small_organ_A3':'keys.organ','accordion_A3':'keys.accordion',
 'pulse25_A3':'chip.pulse25','pulse50_A3':'chip.pulse50','triangle_bass_A3':'bass.triangle',
 'harp_A4':'plucks.harp','pizz_string_A3':'strings.pizzicato','small_piano_A4':'keys.lofi_piano',
 'harpsichord_A4':'keys.harpsichord','vibraphone_A4':'mallets.vibraphone','ritual_bell_A4':'synth.fm_bell',
 'muted_guitar_A3':'guitar.muted','distorted_guitar_A2':'guitar.distorted','upright_bass_A2':'bass.upright_pluck',
 'synth_bass_A2':'bass.fm','clav_A4':'keys.clav','muted_brass_A3':'brass.muted',
 'nylon_guitar_A3':'guitar.nylon','slap_bass_A2':'bass.slap','prepared_piano_A3':'keys.prepared',
 'kick_deep':'drums.kick_deep','snare_crisp':'drums.snare_crack','hat_short':'drums.hat_closed',
 'hat_open':'drums.hat_open','frame_tom':'drums.tom_low','wood_block':'drums.wood',
 'rim_click':'drums.rim','shaker_soft':'drums.shaker','ride_dark':'drums.ride',
 'impact_low':'drums.impact','brush_swirl':'drums.brush','upright_bass_v2_A2':'bass.upright_soft',
 'electric_finger_bass_A2':'bass.electric_finger','picked_bass_A2':'bass.electric_pick',
 'analog_bass_A2':'bass.analog_round','sub_bass_C2':'bass.sub_sine','bowed_contrabass_A1':'bass.bowed_contrabass',
 'kick_punch':'drums.kick_punch','snare_body':'drums.snare_body',
}


def synthesize(patch: str, midi: int, velocity: int = 100, variation: int = 1,
               sample_rate: int = 32000, looped: bool = False):
    """Return mono float32 samples and optional loop positions in seconds."""
    # Oversample excitation and nonlinear stages, then apply a polyphase lowpass.
    sr = sample_rate * 2
    v = np.clip(velocity / 127, .05, 1)
    seed = int.from_bytes(hashlib.sha256(f'{VERSION}:{patch}:{midi}:{velocity}:{variation}'.encode()).digest()[:8], 'little')
    rng = np.random.default_rng(seed)
    drum = patch.startswith('drums.')
    seconds = 2.6 if looped else (1.7 if drum else 3.4)
    t = np.arange(round(seconds * sr)) / sr
    f = 440 * 2 ** ((midi - 69) / 12)
    noise = rng.normal(0, 1, len(t))
    x = np.zeros(len(t))
    attack = .004
    limit = sample_rate * .43

    def filt(y, hz, kind='lowpass'):
        return sosfilt(butter(2, min(hz, sr * .45), btype=kind, fs=sr, output='sos'), y)

    def modes(frequencies, weights, decays):
        out = np.zeros(len(t))
        for hz, weight, decay in zip(frequencies, weights, decays):
            if hz < limit:
                out += weight * np.sin(2 * np.pi * hz * t + rng.uniform(-.12, .12)) * np.exp(-t * decay)
        return out

    if drum:
        if 'kick' in patch or 'impact' in patch:
            base = 43 if 'deep' in patch else 51
            ph = 2*np.pi*(base*t+(75+45*v)*(1-np.exp(-t*32))/32)
            x = np.sin(ph)*np.exp(-t*(7 if 'deep' in patch else 10))
            x += .22*np.sin(2*np.pi*base*.5*t)*np.exp(-t*6)
            x += .06*v*filt(noise, 2200, 'highpass')*np.exp(-t*140)
            if 'impact' in patch: x += .35*filt(noise, 1700)*np.exp(-t*4)
        elif 'snare' in patch or 'brush' in patch:
            wire = filt(filt(noise, 800, 'highpass'), 7800+4000*v)
            wire *= (1-np.exp(-t*650))*np.exp(-t*(7 if 'brush' in patch else 15))
            x = (.37+.2*v)*wire + modes([179, 331, 427], [.6,.26,.11], [24,32,41])
            if 'crack' in patch: x += .2*filt(noise, 4500, 'highpass')*np.exp(-t*80)
        elif 'tom' in patch:
            base = 110 if 'low' in patch else 168
            x = modes([base,base*1.59,base*2.14], [1,.32,.16], [7,15,21])
            x += .08*filt(noise, 3400)*np.exp(-t*70)
        elif 'hat' in patch or 'ride' in patch:
            decay = 4 if ('open' in patch or 'ride' in patch) else 33
            freqs = np.array([312,471,731,1093,1619,2381,3517,5087,7213,10301])
            x = modes(freqs, np.linspace(.08,.025,len(freqs)), np.linspace(decay,decay*3,len(freqs)))
            x += .32*filt(noise, 5400, 'highpass')*np.exp(-t*decay*1.6)
            if 'ride' in patch: x += modes([1739,3291,5219], [.22,.13,.06], [3,5,9])
        elif 'wood' in patch or 'rim' in patch:
            x = modes([790,1268,2351], [1,.45,.19], [45,70,110]) + .1*noise*np.exp(-t*180)
        else:
            x = filt(noise, 4200, 'highpass') * np.exp(-t*24)*(1-np.exp(-t*250))
        attack = .0008
    elif any(k in patch for k in ['piano','harpsichord','prepared','clav','guitar','harp','pizzicato','upright','electric_','slap']) and 'electric_piano' != patch.split('.')[-1]:
        piano = 'piano' in patch or 'prepared' in patch
        bass = patch.startswith('bass.')
        pluck = .19 if piano else (.22 if bass else .13)
        decay = .45 if piano else (1.0 if bass else .9)
        if any(k in patch for k in ['muted','clav','pizzicato']): decay = 4
        stiffness = .00009*(1+max(0,midi-60)/30) if piano else .000018
        for h in range(1, min(46, int(limit/f))+1):
            hz = f*h*np.sqrt(1+stiffness*h*h)
            if hz >= limit: break
            weight = (1 if h == 1 else abs(np.sin(np.pi*h*pluck))) / h**(1.05 if piano else 1.3)
            weight *= np.exp(-h/(5+22*v))
            env = np.exp(-t*(decay+h*(.10 if piano else .23)))
            # Piano unison strings beat slowly; no artificial sub-octave.
            partial = np.sin(2*np.pi*hz*t+rng.uniform(-.08,.08))
            if piano: partial = .72*partial+.28*np.sin(2*np.pi*hz*1.0008*t+.17)
            x += weight*partial*env
        body = [95,207,413] if bass else ([125,277,538] if piano else [103,219,437])
        x += modes(body, [.07,.05,.026], [20,26,40])
        x += .026*v*filt(noise, 1800+v*4500)*np.exp(-t*120)
        if 'prepared' in patch: x += modes([f*2.71,f*5.41], [.17,.07], [7,12])
        if 'distorted' in patch: x = np.tanh(x*(2+v*2))*.65
        if 'slap' in patch: x += .065*filt(noise, 1900, 'highpass')*np.exp(-t*80)
    elif 'electric_piano' in patch or patch == 'bass.fm':
        mod = (1+3*v)*np.exp(-t*3.8)+.12
        x = np.sin(2*np.pi*f*t+mod*np.sin(2*np.pi*f*2*t))*np.exp(-t*.8)
        x += .11*np.sin(2*np.pi*f*7.01*t)*np.exp(-t*9)
    elif any(k in patch for k in ['mallets','dulcimer','fm_bell','shimmer']):
        ratios = [1,4,10,18.4] if 'vibraphone' in patch else [1,2.756,5.404,8.933,13.35]
        x = modes([f*h for h in ratios], [1,.28*v,.16*v,.08,.03], [.7,2.1,3.8,6,10])
        if 'vibraphone' in patch: x *= .92+.08*np.cos(2*np.pi*5.2*t)
        x += .015*filt(noise, 4000)*np.exp(-t*150)
    elif patch.startswith('winds.'):
        attack = .025 if 'ocarina' in patch else .043
        vibrato = .0018*np.sin(2*np.pi*(4.8+.2*variation)*t)*np.clip((t-.18)/.24,0,1)
        phase = 2*np.pi*f*np.cumsum(1+vibrato)/sr
        for h in range(1,min(30,int(limit/f))+1):
            if 'flute' in patch: weight = np.exp(-(h-1)*1.4)*(1+.15*v*h)
            elif 'ocarina' in patch: weight = np.exp(-(h-1)*2.3)
            elif 'clarinet' in patch: weight = (1 if h%2 else .10)/h**1.15*np.exp(-h/16)
            else: weight = (1+.8*np.exp(-((f*h-1500)/800)**2))/h**1.1*np.exp(-h/(6+v*9))
            x += weight*np.sin(h*phase+.05*h)
        x += .025*filt(filt(noise,700,'highpass'),4200)*(1+.8*np.exp(-t*15))
        x *= .97+.03*np.sin(2*np.pi*.9*t)
    elif patch.startswith('strings.') or 'bowed' in patch or patch.startswith('choir.'):
        choir = patch.startswith('choir.')
        attack = .14 if choir else .095
        voices = 4 if any(k in patch for k in ['soft','bright','choir','tremolo']) else 2
        for voice in range(voices):
            detune = (voice-(voices-1)/2)*2.7
            vibrato = .002*np.sin(2*np.pi*(4.6+voice*.27)*t+voice)*np.clip(t/.35,0,1)
            phase = 2*np.pi*f*2**(detune/1200)*np.cumsum(1+vibrato)/sr
            for h in range(1,min(42,int(limit/f))+1):
                hz = f*h
                if choir:
                    formants = [730,1090,2440] if '.ah' in patch else [340,800,2240]
                    weight = (.045+sum(a*np.exp(-((hz-c)/bw)**2) for a,c,bw in zip([1,.65,.16],formants,[130,190,320])))/h**.8
                else:
                    body = .35+.9*np.exp(-((hz-480)/280)**2)+.7*np.exp(-((hz-2300)/1500)**2)
                    weight = body/h**(1.10 if 'bright' in patch else 1.35)*np.exp(-h/(12+15*v))
                x += weight*np.sin(h*phase+.14*h+voice*.51)/voices
        x += .012*filt(noise,2600)*(1+.3*np.sin(t*17))
        if 'tremolo' in patch: x *= .70+.30*np.sin(2*np.pi*7*t)**2
    elif patch.startswith('brass.'):
        horn = 'horn' in patch
        attack = .072 if horn else .032
        bright = 4+12*v
        phase = 2*np.pi*f*(t-.0012*(1-np.exp(-t*22)))
        for h in range(1,min(40,int(limit/f))+1):
            edge = np.exp(-h/(bright*(.35+.65*(1-np.exp(-t*22)))))
            weight = edge/h**(1.65 if horn else 1.03)
            if 'muted' in patch: weight *= .18+1.8*np.exp(-((h*f-1700)/950)**2)
            x += weight*np.sin(h*phase+.08*h)
            if 'ensemble' in patch: x += .24*weight*np.sin(h*phase*1.0021+.4)
        x += .014*filt(noise,3300)*np.exp(-t*30)
    else:
        attack = .16 if ('pad' in patch or 'drone' in patch) else .012
        for h in range(1,min(45,int(limit/f))+1):
            if 'sub' in patch: weight = {1:1,2:.1,3:.025}.get(h,0)
            elif 'triangle' in patch: weight = (-1)**((h-1)//2)/h**2 if h%2 else 0
            elif 'pulse' in patch: weight = 2*np.sin(np.pi*h*(.25 if '25' in patch else .5))/(np.pi*h)
            elif 'organ' in patch: weight = {1:1,2:.55,3:.4,4:.17,6:.09,8:.04}.get(h,0)
            elif 'accordion' in patch: weight = (1 if h%2 else .4)/h**1.4
            else: weight = np.exp(-h/(3+9*v))/h
            phase = 2*np.pi*f*h*t
            x += weight*np.sin(phase)
            if any(k in patch for k in ['pad','drone','accordion']): x += .28*weight*np.sin(phase*1.0016+.3)
        if 'wind' in patch: x = filt(noise,1600)*(.4+.15*np.sin(t*2.3))
        if 'resonant' in patch: x += .22*np.sin(2*np.pi*f*3*t)*np.exp(-t*3)

    attack *= .94+.12*rng.random()
    x *= np.minimum(1,t/attack)
    x = filt(x, min(limit, 13000))
    x = resample_poly(x,1,2).astype(np.float64)
    x -= np.mean(x)
    loop = None
    if looped:
        start, end, fade = [round(z*sample_rate) for z in [.70,2.30,.18]]
        # The end approaches the samples immediately before loopStart. The
        # wrapped next sample is therefore the original waveform continuation.
        w = .5-.5*np.cos(np.linspace(0,np.pi,fade))
        x[end-fade:end] = x[end-fade:end]*(1-w)+x[start-fade:start]*w
        loop = {'start_sec':start/sample_rate,'end_sec':end/sample_rate}
    fade = round(.025*sample_rate)
    x[:min(32,len(x))] *= np.linspace(0,1,min(32,len(x)))
    x[-fade:] *= np.linspace(1,0,fade)**2
    active = x[np.abs(x)>max(np.max(np.abs(x))*.04,1e-8)]
    rms = np.sqrt(np.mean(active**2)) if len(active) else 1
    target = (.24 if drum else .20)*(.82+.18*v)
    x *= min(target/max(rms,1e-9), .88/max(np.max(np.abs(x)),1e-9))
    return x.astype(np.float32), loop
