"""Original YM2612/PSG register patches and BRR instruments; render through libgme.

This writes native VGM/SPC programs. It does not emulate either chip in Python.
FFmpeg must include the libgme demuxer. See references/54-console-soundpacks.md.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import numpy as np

VERSION = '1.0.0'
FM_CLOCK = 7670454
PSG_CLOCK = 3579545
# Algorithm, feedback, multipliers, levels, attack, decay, sustain level.
# Operators are stored in register order (1, 3, 2, 4).
FM = {
    'fm_bass': (0,5,[1,1,1,1],[28,32,22,0],31,12,5),
    'rubber_bass': (2,6,[1,2,1,1],[26,40,30,0],31,16,6),
    'electric_keys': (4,2,[1,1,14,1],[25,0,43,8],31,10,5),
    'glass_bell': (4,1,[3,1,7,2],[26,0,31,10],31,8,7),
    'steel_pluck': (3,3,[1,3,2,1],[34,38,26,0],31,15,7),
    'brass': (5,5,[1,1,1,1],[30,4,8,12],22,8,2),
    'string_pad': (6,4,[1,1,2,1],[36,10,18,6],16,5,2),
    'organ': (7,0,[1,2,4,3],[6,18,27,23],31,0,0),
    'reed': (0,3,[1,2,1,1],[43,37,35,0],24,6,2),
    'solo_lead': (4,6,[1,1,2,1],[28,0,36,10],31,5,2),
    'fm_kick': (4,0,[1,1,2,1],[38,0,50,15],31,24,10),
    'fm_tom': (4,2,[1,1,3,1],[32,0,44,12],31,20,9),
}
SNES = {
    'round_bass': ([1,.22,.08],0x8f,0xa8),
    'picked_bass': ([1,.48,.25,.13,.06],0x8f,0x88),
    'harp': ([1,.42,.23,.10,.05],0x8f,0x6a),
    'bell': ([1,.10,.38,0,.19,0,.08],0x8f,0x4b),
    'piano': ([1,.57,.28,.14,.08,.03],0x8f,0x89),
    'flute': ([1,.06,.14,.02],0x8b,0xc5),
    'oboe': ([1,.14,.54,.06,.22,.02,.09],0x8c,0xc5),
    'strings': ([1,.46,.29,.19,.13,.08,.05,.03],0x88,0xc5),
    'brass': ([1,.65,.42,.28,.15,.08],0x8c,0xa6),
    'choir': ([1,.1,.28,.35,.18,.06],0x89,0xc5),
    'organ': ([1,.50,.24,.35,.08,.12],0x8f,0xe0),
    'pulse': ([1,0,.33,0,.20,0,.14],0x8f,0xa5),
    'kick': ([],0x8f,0x00), 'snare': ([],0x8f,0x00),
    'hat': ([],0x8f,0x00), 'tom': ([],0x8f,0x00),
}

def load_fm_presets(path):
    data=json.loads(Path(path).read_text(encoding='utf-8'))
    out={}
    for name,row in (data.get('presets') or {}).items():
        out[name]=(int(row['alg']),int(row['fb']),list(row['mults']),list(row['levels']),int(row['attack']),int(row['decay']),int(row['sustain']))
    if not out:raise ValueError('FM JSON has no presets')
    return out

_FM_JSON=Path(__file__).resolve().parents[1]/'data'/'megadrive-fm-presets.json'
if _FM_JSON.is_file():
    FM=load_fm_presets(_FM_JSON)

_NES_JSON=Path(__file__).resolve().parents[1]/'data'/'nes-2a03-macros.json'
NES_MACROS=json.loads(_NES_JSON.read_text(encoding='utf-8')) if _NES_JSON.is_file() else {}
PULSE_DUTY=int(((NES_MACROS.get('presets') or {}).get('pulse') or {}).get('duty', 2)) & 3

def preset_for(patch, console):
    if console == 'nes':
        if any(x in patch for x in ('hat','snare','noise','kick','shaker','rim','ride','wood','impact','brush')): return 'noise'
        if any(x in patch for x in ('bass','sub','triangle','contrabass')): return 'triangle'
        return 'pulse'
    if console == 'megadrive':
        if any(x in patch for x in ('hat','snare','noise','scraper','guira','shaker','rim')): return 'psg_noise'
        if 'pulse' in patch: return 'psg_square'
        if 'kick' in patch: return 'fm_kick'
        if any(x in patch for x in ('tom','bongo','timpani')): return 'fm_tom'
        if 'bass' in patch: return 'rubber_bass' if any(x in patch for x in ('slap','pick','resonant')) else 'fm_bass'
        if any(x in patch for x in ('bell','box','vibra','celesta')): return 'glass_bell'
        if any(x in patch for x in ('guitar','harp','dulcimer')): return 'steel_pluck'
        if 'organ' in patch: return 'organ'
        if any(x in patch for x in ('keys','piano')): return 'electric_keys'
        if any(x in patch for x in ('brass','horn','trumpet','trombone')): return 'brass'
        if any(x in patch for x in ('string','violin','viola','cello','choir','pad')): return 'string_pad'
        if any(x in patch for x in ('flute','oboe','clarinet','wind')): return 'reed'
        return 'solo_lead'
    if 'kick' in patch: return 'kick'
    if any(x in patch for x in ('snare','rim')): return 'snare'
    if any(x in patch for x in ('hat','noise','scraper','guira','shaker')): return 'hat'
    if any(x in patch for x in ('tom','bongo','timpani')): return 'tom'
    if 'bass' in patch: return 'picked_bass' if any(x in patch for x in ('pluck','pick','slap')) else 'round_bass'
    if any(x in patch for x in ('bell','box','vibra','celesta')): return 'bell'
    if any(x in patch for x in ('harp','guitar','dulcimer')): return 'harp'
    if 'organ' in patch: return 'organ'
    if any(x in patch for x in ('keys','piano')): return 'piano'
    if 'choir' in patch: return 'choir'
    if any(x in patch for x in ('brass','horn','trumpet','trombone')): return 'brass'
    if 'flute' in patch: return 'flute'
    if any(x in patch for x in ('oboe','clarinet','wind')): return 'oboe'
    if any(x in patch for x in ('string','violin','viola','cello','pad')): return 'strings'
    return 'pulse'

def timeline(notes, console):
    """Allocate actual hardware voices; reject overflow instead of dropping notes."""
    if console=='nes':
        free={'pulse':[0.0]*2,'triangle':[0.0],'noise':[0.0]}
        allowed={'pulse','triangle','noise'}
    elif console=='megadrive':
        free={'fm':[0.0]*6,'tone':[0.0]*3,'noise':[0.0]}
        allowed=set(FM)|{'psg_square','psg_noise'}
    else:
        free={'dsp':[0.0]*8}
        allowed=set(SNES)
    events=[]
    for n in sorted(notes,key=lambda x:x['time']):
        n=dict(n);p=n['preset'];start=float(n['time']);duration=float(n['duration'])
        if not math.isfinite(start+duration) or start<0 or duration<=0 or not 0<=n['midi']<=127 or not 1<=n.get('velocity',96)<=127:
            raise ValueError('Invalid note time, duration, MIDI or velocity')
        if p not in allowed: raise ValueError('Unknown console preset: '+p)
        if console=='nes':
            group='pulse' if p=='pulse' else 'triangle' if p=='triangle' else 'noise'
        elif console=='megadrive':
            group=('tone' if p=='psg_square' else 'noise' if p=='psg_noise' else 'fm')
        else:
            group='dsp'
        channel=next((i for i,t in enumerate(free[group]) if t<=start+1e-8),None)
        if channel is None: raise ValueError(f'{console}: {group} voice budget exceeded at {start:.4f}s; arrange fewer simultaneous notes')
        free[group][channel]=start+duration
        n.update(group=group,channel=channel)
        events.extend([(start,1,n),(start+duration,0,n)])
    return sorted(events,key=lambda e:(e[0],e[1]))

def vgm(notes):
    stream=bytearray();clock=0
    def reg(port,address,value): stream.extend((0x52+port,address,value&255))
    def psg(value): stream.extend((0x50,value&255))
    def wait(n):
        while n: k=min(n,65535);stream.extend((0x61,k&255,k>>8));n-=k
    reg(0,0x22,0);reg(0,0x27,0);reg(0,0x2b,0)
    for ch in range(4):psg(0x9f+ch*32)
    for time,on,n in timeline(notes,'megadrive'):
        target=round(time*44100);wait(target-clock);clock=target
        ch=n['channel'];p=n['preset'];velocity=n.get('velocity',96)
        if n['group']=='fm':
            port=ch//3;c=ch%3;key=c+(4 if port else 0)
            reg(0,0x28,key)
            if not on:continue
            alg,fb,mults,levels,attack,decay,sustain=FM[p]
            carriers={0:{3},1:{3},2:{3},3:{3},4:{2,3},5:{1,2,3},6:{1,2,3},7:{0,1,2,3}}[alg]
            for op in range(4):
                offset=c+op*4
                tl=min(127,levels[op]+round((127-velocity)*(0.30 if op in carriers else .13)))
                for address,value in ((0x30,mults[op]),(0x40,tl),(0x50,attack),(0x60,decay),(0x70,0 if sustain<3 else 4),(0x80,(sustain<<4)|8),(0x90,0)):
                    reg(port,address+offset,value)
            reg(port,0xb0+c,alg+(fb<<3));reg(port,0xb4+c,0xc0)
            hz=440*2**((n['midi']-69)/12);block=0;fnum=hz*144*2**21/FM_CLOCK
            while fnum>2047 and block<7:fnum/=2;block+=1
            if fnum>2047:raise ValueError('YM2612 pitch out of range')
            fnum=round(fnum);reg(port,0xa4+c,(block<<3)|(fnum>>8));reg(port,0xa0+c,fnum)
            reg(0,0x28,0xf0|key)
        else:
            channel=3 if n['group']=='noise' else ch
            if on:
                if channel==3:psg(0xe4)
                else:
                    period=round(PSG_CLOCK/(32*440*2**((n['midi']-69)/12)))
                    if not 1<=period<=1023:raise ValueError('PSG tone out of range')
                    psg(0x80+channel*32+(period&15));psg(period>>4)
            psg(0x90+channel*32+(min(14,round((127-velocity)/10)+3) if on else 15))
    wait(44100);clock+=44100;stream.append(0x66)
    header=bytearray(0x100);header[:4]=b'Vgm '
    for offset,value in ((4,len(header)+len(stream)-4),(8,0x150),(0xc,PSG_CLOCK),(0x18,clock),(0x24,60),(0x2c,FM_CLOCK),(0x34,0xcc)):
        struct.pack_into('<I',header,offset,value)
    struct.pack_into('<H',header,0x28,9);header[0x2a]=16
    return bytes(header+stream)

NES_CLOCK=1789773

def nes_timer(midi, triangle=False):
    freq=440*2**((midi-69)/12)
    timer=round(NES_CLOCK/((32 if triangle else 16)*freq)-1)
    if not 8<=timer<=0x7ff:raise ValueError('2A03 pitch out of range')
    return timer

def nes_vgm(notes):
    stream=bytearray();clock=0
    def apu(reg,value): stream.extend((0xb4,reg&255,value&255))
    def wait(n):
        while n: k=min(n,65535);stream.extend((0x61,k&255,k>>8));n-=k
    apu(0x17,0x40);apu(0x15,0x0f)
    for time,on,n in timeline(notes,'nes'):
        target=round(time*44100);wait(target-clock);clock=target
        velocity=n.get('velocity',96);vol=min(15,max(1,round(velocity/8)))
        if n['group']=='pulse':
            base=0 if n['channel']==0 else 4
            if on:
                timer=nes_timer(n['midi'])
                apu(base,(PULSE_DUTY<<6)|0x30|vol);apu(base+1,0x08);apu(base+2,timer&255);apu(base+3,timer>>8)
            else:
                apu(base,0x30)
        elif n['group']=='triangle':
            if on:
                timer=nes_timer(n['midi'],True)
                apu(8,0x81);apu(0x0a,timer&255);apu(0x0b,timer>>8)
            else:
                apu(8,0x80)
        else:
            if on:
                period=min(15,max(0,15-(n['midi']//8)))
                apu(0x0c,0x30|vol);apu(0x0e,period);apu(0x0f,0x08)
            else:
                apu(0x0c,0x30)
    wait(44100);clock+=44100;stream.append(0x66)
    header=bytearray(0x100);header[:4]=b'Vgm '
    for offset,value in ((4,len(header)+len(stream)-4),(8,0x161),(0x18,clock),(0x24,60),(0x34,0xcc),(0x84,NES_CLOCK)):
        struct.pack_into('<I',header,offset,value)
    return bytes(header+stream)

def brr_source(preset, highest_midi=72):
    harmonics,_,_=SNES[preset]
    if harmonics:
        # Choose a power-of-two period whose DSP pitch can reach this register.
        period=128
        while 440*2**((highest_midi-69)/12)/(32000/period)>=3.99:period//=2
        if period<16:raise ValueError('BRR source register exceeds this pack range')
        t=np.arange(period)/period
        x=sum(a*np.sin(2*np.pi*(i+1)*t) for i,a in enumerate(harmonics) if i+1<period/2)
        x=x/max(abs(x))*.72
        return x,32000/period,True
    t=np.arange(6400)/32000;rng=np.random.default_rng(104+list(SNES).index(preset))
    if preset=='kick':x=np.sin(2*np.pi*(52*t+7*(1-np.exp(-t*40))))*np.exp(-t*24)
    elif preset=='tom':x=(np.sin(2*np.pi*155*t)+.2*np.sin(2*np.pi*243*t))*np.exp(-t*19)
    elif preset=='snare':x=(rng.normal(0,.45,len(t))+.3*np.sin(2*np.pi*185*t))*np.exp(-t*27)
    else:
        noise=rng.normal(0,1,len(t));x=np.diff(noise,prepend=noise[0])*np.exp(-t*62)
    x*=np.minimum(1,t*4000);return x/max(abs(x))*.72,261.625565,False

def encode_brr(samples,loop,filter_id=0):
    """Filter-zero BRR: independently quantized blocks without predictor drift."""
    if int(filter_id)!=0:
        raise ValueError('Only filter-zero BRR is implemented; pass --brr-filter 0')
    pcm=np.rint(np.asarray(samples)*32767).astype(np.int32)
    pcm=np.pad(pcm,(0,(-len(pcm))%16));out=bytearray()
    for i in range(0,len(pcm),16):
        block=pcm[i:i+16];shift=0
        while shift<12 and np.max(np.abs(block))>7*(1<<shift):shift+=1
        q=np.clip(np.rint(block/(1<<shift)),-8,7).astype(int)&15
        end=i+16==len(pcm);out.append((shift<<4)|(3 if loop else 1) if end else shift<<4)
        out.extend(int((q[j]<<4)|q[j+1]) for j in range(0,16,2))
    return bytes(out)

def load_brr_directory(path):
    folder=Path(path)
    index_path=folder/'directory.json' if folder.is_dir() else folder
    index=json.loads(index_path.read_text(encoding='utf-8'))
    root=index_path.parent
    bank={}
    for name,row in index.items():
        raw=(root/row['file']).read_bytes()
        bank[name]={
            'bytes':raw,
            'root_hz':float(row.get('root_hz',261.625565)),
            'loop':bool(row.get('loop',False)),
            'adsr1':int(row.get('adsr1', SNES[name][1] if name in SNES else 0x8f)),
            'adsr2':int(row.get('adsr2', SNES[name][2] if name in SNES else 0x89)),
        }
        if name not in SNES:
            SNES[name]=([],bank[name]['adsr1'],bank[name]['adsr2'])
    return bank

def spc(notes,echo=True,brr_bank=None,brr_filter=0):
    events=timeline(notes,'snes');ram=bytearray(65536);dsp=bytearray(128)
    directory=0x200;sample_at=0x8000;preset_data={}
    for idx,p in enumerate(sorted({n['preset'] for n in notes})):
        if brr_bank and p in brr_bank:
            rec=brr_bank[p];raw=rec['bytes'];root=rec['root_hz']
            SNES[p]= (SNES[p][0] if p in SNES else [], rec.get('adsr1',0x8f), rec.get('adsr2',0x89))
        else:
            x,root,loop=brr_source(p,max(n['midi'] for n in notes if n['preset']==p));raw=encode_brr(x,loop,brr_filter)
        if sample_at+len(raw)>0xe000:raise ValueError('BRR data exceeds reserved sample RAM')
        struct.pack_into('<HH',ram,directory+idx*4,sample_at,sample_at)
        ram[sample_at:sample_at+len(raw)]=raw;preset_data[p]=(idx,root);sample_at+=len(raw)
    dsp[0x0c]=dsp[0x1c]=40;dsp[0x5d]=2;dsp[0x6c]=0 if echo else 0x20
    if echo:
        dsp[0x2c]=dsp[0x3c]=12;dsp[0x0d]=32;dsp[0x6d]=0xe0;dsp[0x7d]=2
        dsp[0x0f]=96;dsp[0x1f]=24;dsp[0x2f]=8;dsp[0x4d]=255
    # Original unrolled SPC700 driver: DSP writes and timer-0 waits at 1 kHz.
    # MOV dp,#imm (8F imm dp), MOV A,dp (E4 dp), BEQ rel (F0), JMP abs (5F).
    program=bytearray((0x8f,0,0xf1,0x8f,8,0xfa,0x8f,1,0xf1));frame=0
    def write(reg,val):program.extend((0x8f,reg,0xf2,0x8f,val&255,0xf3))
    def wait(ticks):
        while ticks:
            count=min(ticks,255)
            # MOV Y,#count; poll timer; BEQ poll; DEC Y; BNE poll.
            program.extend((0x8d,count,0xe4,0xfd,0xf0,0xfc,0xdc,0xd0,0xf9));ticks-=count
    write(0x5c,0);off_mask=0
    for time,on,n in events:
        target=round(time*1000);wait(target-frame);frame=target
        ch=n['channel'];mask=1<<ch
        if not on:
            off_mask|=mask;write(0x5c,off_mask);continue
        idx,root=preset_data[n['preset']];_,adsr1,adsr2=SNES[n['preset']]
        pitch=round(4096*(440*2**((n['midi']-69)/12))/root)
        if not 1<=pitch<=0x3fff:raise ValueError('S-DSP pitch out of range')
        if off_mask&mask:wait(1)
        off_mask&=~mask;write(0x5c,off_mask)
        volume=round(n.get('velocity',96)*.55)
        for r,v in ((0,volume),(1,volume),(2,pitch&255),(3,pitch>>8),(4,idx),(5,adsr1),(6,adsr2),(7,127)):
            write(ch*16+r,v)
        write(0x4c,mask)
    write(0x5c,255);address=0x400+len(program);program.extend((0x5f,address&255,address>>8))
    if 0x400+len(program)>0x8000:raise ValueError('SPC driver exceeds code RAM; split this arrangement')
    ram[0x400:0x400+len(program)]=program;ram[0xf1]=0;ram[0xfa]=8
    header=bytearray(256);tag=b'SNES-SPC700 Sound File Data v0.30';header[:len(tag)]=tag
    header[0x21:0x25]=bytes((0x1a,0x1a,0x1b,30));struct.pack_into('<H',header,0x25,0x400);header[0x2b]=0xef
    return bytes(header+ram+dsp+bytearray(128))

def render_native(path,output,seconds):
    command=['ffmpeg','-v','error','-nostdin','-n','-f','libgme','-sample_rate','32000','-i',str(path),'-t',str(seconds),'-c:a','pcm_s16le',str(output)]
    result=subprocess.run(command,capture_output=True,text=True)
    if result.returncode:raise RuntimeError('FFmpeg libgme render failed: '+result.stderr[-2000:])

def demo(console):
    notes=[]
    def add(p,m,t,d,v=96):notes.append(dict(preset=p,midi=m,time=t,duration=d,velocity=v))
    melody=[72,75,79,82,79,77,75,70,72,79,84,82,79,75,77,79]
    for i,m in enumerate(melody):
        add('solo_lead' if console=='megadrive' else 'flute',m,i*.25,.19,92+(i%3)*8)
        if i%2==0:add('fm_bass' if console=='megadrive' else 'picked_bass',36 if i<8 else 41,i*.25,.40,108)
        add('psg_noise' if console=='megadrive' else 'hat',60,i*.25,.045,70)
        if i%4==0:
            for m2 in ([60,63,67] if i<8 else [65,68,72]):add('electric_keys' if console=='megadrive' else 'strings',m2,i*.25,.75,76)
    if console=='megadrive':
        for i in range(8):add('psg_square',84+(i%2)*3,i*.5+.125,.09,70)
    if console=='nes':
        notes=[dict(preset='pulse',midi=60,time=0,duration=.5,velocity=96),
               dict(preset='triangle',midi=48,time=0,duration=.5,velocity=80),
               dict(preset='noise',midi=40,time=.25,duration=.2,velocity=70)]
    return notes

def write_native(console,notes,output,echo=True,brr_bank=None,brr_filter=0):
    if console=='megadrive':return vgm(notes)
    if console=='nes':return nes_vgm(notes)
    return spc(notes,echo,brr_bank=brr_bank,brr_filter=brr_filter)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('console',choices=('megadrive','snes','nes'))
    parser.add_argument('output',type=Path);parser.add_argument('--notes',type=Path,help='JSON array: preset, midi, time/duration seconds, velocity')
    parser.add_argument('--wav',action='store_true');parser.add_argument('--dry',action='store_true')
    parser.add_argument('--fm-json',type=Path,help='Editable YM2612 patch table (alg, fb, ops). Does not add DAC or pitch macros.')
    parser.add_argument('--brr-dir',type=Path,help='External BRR directory.json plus .brr files. An SF2 never enters an SPC.')
    parser.add_argument('--brr-filter',type=int,default=0,help='BRR filter id. Filter zero remains the implemented option.')
    args=parser.parse_args();
    if args.fm_json:
        global FM;FM=load_fm_presets(args.fm_json)
    brr_bank=load_brr_directory(args.brr_dir) if args.brr_dir else None
    notes=json.loads(args.notes.read_text()) if args.notes else demo(args.console)
    if not notes:parser.error('At least one note is required')
    expected='.spc' if args.console=='snes' else '.vgm'
    if args.output.suffix.lower()!=expected:parser.error('Output must end in '+expected)
    outputs=[args.output,args.output.with_suffix('.json')]+([args.output.with_suffix('.wav')] if args.wav else [])
    if any(p.exists() for p in outputs):parser.error('Output exists; choose a new path')
    data=write_native(args.console,notes,args.output,not args.dry,brr_bank,args.brr_filter)
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_bytes(data)
    args.output.with_suffix('.json').write_text(json.dumps({'version':VERSION,'console':args.console,'notes':notes,'sha256':hashlib.sha256(data).hexdigest(),'source':'Original register patches / BRR samples','physical_hardware_comparison':'pending','dmc':None if args.console=='nes' else 'n/a'},indent=2)+'\n')
    if args.wav:render_native(args.output,args.output.with_suffix('.wav'),max(n['time']+n['duration'] for n in notes)+1)
    print('Created',args.output)

if __name__=='__main__':main()
