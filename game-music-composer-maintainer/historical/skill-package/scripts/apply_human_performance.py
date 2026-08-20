#!/usr/bin/env python3
from __future__ import annotations
import argparse, copy, hashlib, json, math, random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'examples/reviewed-showcase/demo-compositions.json'
PROFILES = ROOT / 'data/expressive-performance-profiles.json'
OUTDIR = ROOT / 'examples/humanized-showcase'

DRUMS = {'kick','snare','hat','open_hat','tom','rim','wood','shaker','brush','ride','impact'}
SUSTAIN_ENSEMBLES = {'strings','choir','drone'}
WINDS = {'flute','ocarina','muted_brass','brass'}
ELECTRONIC = {'pulse25','pulse50'}
KEYBOARDS = {'piano','harpsichord','vibes'}
PLUCKED = {'guitar','harp','pizz','accordion'}
BASSES = {'bass','synth_bass','triangle_bass'}

ROLE_PRIORITY = {
    'lead':100,'upper_voice':98,'lower_voice':96,'bass':92,'kick':90,'snare':88,
    'guide_tones':78,'counterline':76,'answer':74,'comp':65,'support':62,
    'pulse':58,'texture':45,'punctuation':44,'subdivision':38,'formal_marker':36
}


def seed_for(*parts: object) -> int:
    raw='|'.join(map(str,parts)).encode('utf-8')
    return int.from_bytes(hashlib.sha256(raw).digest()[:8],'big')


def role_of(ev: dict) -> str:
    if ev.get('role'): return str(ev['role'])
    inst=ev['inst']
    if inst in BASSES: return 'bass'
    if inst in DRUMS: return inst
    if inst in WINDS or inst in ELECTRONIC: return 'lead'
    if inst in KEYBOARDS or inst in PLUCKED: return 'comp'
    if inst in SUSTAIN_ENSEMBLES: return 'support'
    return 'texture'


def section_index(style: dict, beat: float) -> int:
    for i,section in enumerate(style.get('form',[])):
        if section['start'] <= beat < section['start']+section['length']:
            return i
    return max(0,len(style.get('form',[]))-1)


def section_curve_value(index: int, count: int) -> float:
    curve=[.92,1.0,1.08,.96,1.04,.94]
    if count<=1: return 1.0
    return curve[index % len(curve)]


def smooth_noise(style_id: str, beat: float, bar_length: float, magnitude_ms: float) -> float:
    if magnitude_ms <= 0: return 0.0
    bar=math.floor(beat/bar_length)
    phase=(beat/bar_length)-bar
    def point(i:int)->float:
        rng=random.Random(seed_for(style_id,'bar_noise',i))
        return rng.uniform(-magnitude_ms,magnitude_ms)
    a,b=point(bar),point(bar+1)
    eased=phase*phase*(3-2*phase)
    return a+(b-a)*eased


def timing_offset_ms(style: dict, ev: dict, profile: dict) -> float:
    beat=float(ev['beat']); phrase_len=max(style.get('barLength',4)*2,1.0)
    p=(beat%phrase_len)/phrase_len
    # Push through the first half, relax into the phrase ending, and return to zero at boundaries.
    rubato=-profile.get('rubato_ms',0)*math.sin(2*math.pi*p)
    role=role_of(ev); inst=ev['inst']
    role_offset=profile.get('lead_delay_ms',0) if role in ('lead','upper_voice','lower_voice','answer') else profile.get('support_delay_ms',0)
    if role=='bass' or inst in BASSES: role_offset=profile.get('bass_delay_ms',0)
    if inst=='snare' or role=='snare': role_offset=profile.get('snare_delay_ms',6)
    if inst=='kick': role_offset=0
    if inst in ('hat','open_hat','shaker'): role_offset += -1.5
    noise=smooth_noise(style['id'],beat,style.get('barLength',4),profile.get('timing_noise_ms',0))
    return rubato+role_offset+noise


def dynamic_scale(style: dict, ev: dict, profile: dict, repeat_index: int) -> float:
    beat=float(ev['beat']); phrase_len=max(style.get('barLength',4)*2,1.0)
    p=(beat%phrase_len)/phrase_len
    phrase=1-profile.get('dynamic_arc',.1)*.45 + profile.get('dynamic_arc',.1)*math.sin(math.pi*p)
    sec=section_curve_value(section_index(style,beat),len(style.get('form',[])))
    role=role_of(ev)
    role_scale=1.0
    if role in ('lead','upper_voice','lower_voice'): role_scale=1.03
    elif role in ('texture','support'): role_scale=.94
    elif role in ('subdivision','hat','shaker','brush'): role_scale=.88
    # Repeated notes alternate subtly rather than receiving white-noise velocity.
    repeat=(-1 if repeat_index%2 else 1)*.025
    rng=random.Random(seed_for(style['id'],'gain',ev.get('_index',0)))
    local=rng.uniform(-.025,.025)
    return max(.62,min(1.28,phrase*sec*role_scale*(1+repeat+local)))


def duration_scale(style: dict, ev: dict, repeat_index: int) -> float:
    role=role_of(ev); beat=float(ev['beat']); phrase_len=max(style.get('barLength',4)*2,1.0)
    p=(beat%phrase_len)/phrase_len
    base=1.0
    if role in ('lead','upper_voice','lower_voice','answer'):
        base=.9 + .22*(p**3)  # tenuto toward phrase end
    elif role=='bass': base=.88 if style['id'] in ('rainline48','quay48','market48') else .94
    elif role in ('comp','guide_tones','pulse'): base=.84 + (.08 if repeat_index%2 else 0)
    elif ev['inst'] in ('strings','choir','drone'): base=1.04
    elif ev['inst'] in DRUMS: base=1.0
    rng=random.Random(seed_for(style['id'],'duration',ev.get('_index',0)))
    return max(.55,min(1.25,base+rng.uniform(-.045,.045)))


def should_dropout(style: dict, ev: dict, profile: dict) -> bool:
    role=role_of(ev)
    if role in ('lead','upper_voice','lower_voice','bass','kick','snare') or ev.get('accent',1)>=.9:
        return False
    if ev['kind']=='drum' and ev['inst'] not in ('hat','shaker','brush','wood','rim'):
        return False
    rate=profile.get('dropout_rate',0)
    if rate<=0: return False
    rng=random.Random(seed_for(style['id'],'dropout',ev.get('_index',0)))
    return rng.random()<rate


def group_chord_asynchrony(style: dict, events: list[dict]) -> None:
    groups={}
    for ev in events:
        if ev.get('performance_mute') or ev['kind']!='note' or ev['inst'] not in KEYBOARDS|PLUCKED:
            continue
        # Existing deliberate strums are kept; only near-simultaneous stacks are shaped.
        key=(ev['inst'],round(float(ev['beat'])*16)/16)
        groups.setdefault(key,[]).append(ev)
    for (inst,beat),notes in groups.items():
        if len(notes)<2: continue
        notes.sort(key=lambda e:e.get('midi',60),reverse=(int(beat/style.get('barLength',4))%2==1))
        spread={'piano':14,'harpsichord':8,'vibes':11,'guitar':22,'harp':13,'pizz':9,'accordion':12}.get(inst,9)
        center=(len(notes)-1)/2
        for i,ev in enumerate(notes):
            ev['start_offset_ms']=ev.get('start_offset_ms',0)+(i-center)*spread
            # Bass chord tones receive more weight than ornamental upper tones.
            ev['performance_gain']=ev.get('performance_gain',1)*(1.05-.055*i)


def add_expanded_layers(style: dict, events: list[dict], profile: dict) -> list[dict]:
    out=list(events); strength=profile.get('ensemble_strength',0)
    for ev in events:
        if ev.get('performance_mute') or ev['kind']!='note': continue
        inst=ev['inst']; dur=float(ev.get('performance_duration',ev.get('duration',.25)))
        accent=float(ev.get('accent',1)); sec=section_index(style,float(ev['beat']))
        section_peak=(sec==max(0,len(style.get('form',[]))-2))
        rng=random.Random(seed_for(style['id'],'ensemble',ev.get('_index',0)))
        layers=[]
        if inst in SUSTAIN_ENSEMBLES and dur>=.7 and strength>.25:
            layers=[(-rng.uniform(3,8),rng.uniform(7,15),rng.uniform(.22,.34),-rng.uniform(.12,.24)),
                    (rng.uniform(3,8),rng.uniform(12,23),rng.uniform(.18,.29),rng.uniform(.12,.26))]
        elif inst in WINDS and dur>=.6 and accent>=.76 and strength>.25 and (section_peak or rng.random()<.42):
            layers=[(-rng.uniform(4,9),rng.uniform(8,18),rng.uniform(.14,.23),-math.copysign(rng.uniform(.08,.18),ev.get('pan',0) or 1))]
        elif inst in ELECTRONIC and dur>=.35 and strength>.35 and (accent>=.8 or section_peak):
            layers=[(rng.uniform(-6,6),rng.uniform(2,7),rng.uniform(.17,.27),math.copysign(rng.uniform(.08,.17),-(ev.get('pan',0) or 1)))]
        elif inst=='brass' and dur>=.45 and accent>=.95:
            layers=[(rng.uniform(-5,5),rng.uniform(5,12),rng.uniform(.18,.28),math.copysign(.13,-(ev.get('pan',0) or 1)))]
        for li,(cents,delay,gain,panoff) in enumerate(layers):
            dup=copy.deepcopy(ev)
            dup['_layer']=f'ensemble_{li+1}'
            dup['layer_type']='ensemble'
            dup['tuning_cents']=dup.get('tuning_cents',0)+cents
            dup['start_offset_ms']=dup.get('start_offset_ms',0)+delay
            dup['performance_gain']=dup.get('performance_gain',1)*gain*strength
            dup['performance_pan']=max(-1,min(1,dup.get('performance_pan',dup.get('pan',0))+panoff))
            dup['attack_scale']=rng.uniform(.9,1.16)
            out.append(dup)
    return out


def priority(ev:dict)->int:
    return ROLE_PRIORITY.get(role_of(ev),50)+(8 if ev.get('accent',1)>=.9 else 0)-(18 if ev.get('_layer') else 0)


def enforce_voice_limit(style:dict, events:list[dict], limit:int)->tuple[list[dict],int]:
    kept=[]; active=[]; dropped=0
    sorted_events=sorted(events,key=lambda e:(float(e.get('performance_beat',e['beat'])), -priority(e)))
    for ev in sorted_events:
        if ev.get('performance_mute'): continue
        start=float(ev.get('performance_beat',ev['beat']))
        dur=float(ev.get('performance_duration',ev.get('duration',.14 if ev['kind']=='drum' else .25)))
        end=start+max(.04,dur)
        active=[a for a in active if a[0]>start+1e-6]
        if len(active)>=limit:
            # Replace the lowest-priority sounding event only when the newcomer matters more.
            low=min(active,key=lambda x:x[1])
            if priority(ev)>low[1]+4:
                low[2]['performance_duration']=max(.035,start-float(low[2].get('performance_beat',low[2]['beat']))-.01)
                active.remove(low)
            else:
                ev['performance_mute']=True; dropped+=1; continue
        kept.append(ev); active.append((end,priority(ev),ev))
    return kept,dropped


def humanize_style(style:dict,profile:dict,mode:str)->dict:
    s=copy.deepcopy(style); events=[]; repeat_counts={}
    bpm=float(s['bpm']); ms_to_beats=bpm/60000
    for idx,source in enumerate(s['events']):
        ev=copy.deepcopy(source); ev['_index']=idx
        key=(ev['inst'],ev.get('midi'),round(float(ev['beat'])%s.get('barLength',4),3))
        rep=repeat_counts.get(key,0); repeat_counts[key]=rep+1
        off_ms=timing_offset_ms(s,ev,profile)
        ev['start_offset_ms']=off_ms
        ev['performance_beat']=(float(ev['beat'])+off_ms*ms_to_beats)%float(s['beats'])
        ev['performance_gain']=dynamic_scale(s,ev,profile,rep)
        ev['duration_scale']=duration_scale(s,ev,rep)
        if ev['kind']=='note':
            ev['performance_duration']=max(.04,float(ev.get('duration',.25))*ev['duration_scale'])
            # delayed vibrato and slight timbre variation are renderer-level attributes.
            if ev.get('vibrato') or (role_of(ev) in ('lead','upper_voice') and ev['performance_duration']>=.7):
                rng=random.Random(seed_for(s['id'],'vibrato',idx))
                ev['performance_vibrato_depth']=max(.01,float(ev.get('vibrato',.08))*rng.uniform(.8,1.2))
                ev['vibrato_delay_ms']=rng.uniform(90,240)
            ev['tuning_cents']=random.Random(seed_for(s['id'],'tuning',idx)).uniform(-1.8,1.8)
        else:
            rng=random.Random(seed_for(s['id'],'drum',idx))
            ev['tuning_cents']=rng.uniform(-7,7)
            ev['sample_offset_ms']=rng.uniform(0,4)
        ev['performance_pan']=max(-1,min(1,float(ev.get('pan',0))+random.Random(seed_for(s['id'],'pan',idx)).uniform(-.025,.025)))
        ev['performance_mute']=should_dropout(s,ev,profile)
        events.append(ev)
    group_chord_asynchrony(s,events)
    if mode=='expanded_web': events=add_expanded_layers(s,events,profile)
    limit=7 if mode=='strict_hardware' else 16
    events,dropped=enforce_voice_limit(s,events,limit)
    s['events']=events
    s['performance']={
        'mode':mode,
        'profile':profile,
        'humanization_seed':seed_for(s['id'],'humanization')%(2**31),
        'timing_is_correlated':True,
        'independent_random_jitter':False,
        'voice_limit':limit,
        'voice_limiter_dropped_events':dropped,
        'core_event_count':len(style['events']),
        'render_event_count':len(events),
        'ensemble_layer_count':sum(1 for e in events if e.get('_layer')),
    }
    return s


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--source',type=Path,default=SRC)
    ap.add_argument('--output-dir',type=Path,default=OUTDIR)
    args=ap.parse_args()
    catalog=json.loads(args.source.read_text(encoding='utf-8'))
    cfg=json.loads(PROFILES.read_text(encoding='utf-8'))
    strict=[]; expanded=[]
    for style in catalog['styles']:
        pid=cfg['style_profile_map'][style['id']]; profile=cfg['profiles'][pid]
        strict.append(humanize_style(style,profile,'strict_hardware'))
        expanded.append(humanize_style(style,profile,'expanded_web'))
    args.output_dir.mkdir(parents=True,exist_ok=True)
    (args.output_dir/'catalog-strict.json').write_text(json.dumps({'version':'1.0.0','mode':'strict_hardware','styles':strict},indent=2),encoding='utf-8')
    (args.output_dir/'catalog-expanded.json').write_text(json.dumps({'version':'1.0.0','mode':'expanded_web','styles':expanded},indent=2),encoding='utf-8')
    print('strict',sum(len(s['events']) for s in strict),'expanded',sum(len(s['events']) for s in expanded))

if __name__=='__main__': main()
