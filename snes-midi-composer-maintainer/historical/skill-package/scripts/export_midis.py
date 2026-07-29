#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, math
from pathlib import Path
from collections import defaultdict
import mido

PPQ=480

def safe_text(value):
    return str(value).encode('latin-1','replace').decode('latin-1')
DRUM_MAP={'kick':36,'snare':38,'hat':42,'open_hat':46,'tom':45,'wood':76,'shaker':82,'rim':37,'ride':51,'impact':41,'brush':40,'clap':39}
PROGRAMS={
'bass':33,'sub':38,'strings':48,'violin':40,'cello':42,'choir':52,'organ':19,'accordion':21,'piano':0,'harpsichord':6,
'vibe':11,'bell':14,'harp':46,'guitar':24,'muted_guitar':28,'distorted_guitar':30,'clav':7,'flute':73,'ocarina':79,'reed':65,
'brass':61,'muted_brass':59,'pulse':80,'saw':81,'synth':81,'pad':88,'drone':89,'texture':96,'pizz':45,'mallet':12
}

def parse_meter(text):
    try:
        a,b=text.split('/');return int(a),int(b)
    except Exception:return 4,4

def family(inst,info):
    return info.get('family') or inst

def export_style(style,outdir:Path):
    outdir.mkdir(parents=True,exist_ok=True)
    mid=mido.MidiFile(type=1,ticks_per_beat=PPQ)
    meta=mido.MidiTrack();mid.tracks.append(meta)
    meta.append(mido.MetaMessage('track_name',name=safe_text(style['title']),time=0))
    meta.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(style['bpm']),time=0))
    num,den=parse_meter(style.get('meter','4/4'))
    meta.append(mido.MetaMessage('time_signature',numerator=num,denominator=den,time=0))
    meta.append(mido.MetaMessage('text',text=safe_text(f"NeoSPC category={style['category']} voice_budget={style['voice_budget']} measured_peak={style['measured_peak_voices']}"),time=0))
    lanes=defaultdict(list)
    for ev in style['events']:
        lanes[ev['inst']].append(ev)
    melodic_channels=[0,1,2,3,4,5,6,7,8,10,11,12,13,14,15]
    ci=0
    for inst,events in sorted(lanes.items()):
        is_drum=all(e['kind']=='drum' for e in events)
        ch=9 if is_drum else melodic_channels[ci%len(melodic_channels)]
        if not is_drum:ci+=1
        tr=mido.MidiTrack();mid.tracks.append(tr)
        tr.append(mido.MetaMessage('track_name',name=safe_text(inst),time=0))
        info=style.get('instrument_map',{}).get(inst,{})
        if not is_drum:
            fam=family(inst,info); program=PROGRAMS.get(inst,PROGRAMS.get(fam,0));tr.append(mido.Message('program_change',program=program,channel=ch,time=0))
        msgs=[]
        for ev in events:
            start=float(ev.get('performance_beat',ev.get('beat',0)))
            dur=float(ev.get('performance_duration',ev.get('duration',.15 if ev['kind']=='drum' else .3)))
            end=start+max(.04,dur)
            if ev['kind']=='drum': note=DRUM_MAP.get(inst,DRUM_MAP.get(family(inst,info),60))
            else: note=int(max(0,min(127,ev['midi'])))
            vel=round(127*min(1,max(.05, ev.get('gain',.05)*10*ev.get('accent',1)*ev.get('performance_gain',1))))
            msgs.append((round(start*PPQ),0,mido.Message('note_on',note=note,velocity=max(1,min(127,vel)),channel=ch,time=0)))
            msgs.append((round(end*PPQ),1,mido.Message('note_off',note=note,velocity=0,channel=ch,time=0)))
        msgs.sort(key=lambda x:(x[0],x[1]))
        last=0
        for tick,_,msg in msgs:
            msg.time=max(0,tick-last);tr.append(msg);last=tick
    path=outdir/f"{style['id']}.mid";mid.save(path)
    return {'id':style['id'],'tracks':len(mid.tracks),'bytes':path.stat().st_size}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('catalog',type=Path);ap.add_argument('outdir',type=Path);args=ap.parse_args()
    catalog=json.loads(args.catalog.read_text());reports=[export_style(s,args.outdir) for s in catalog['styles']]
    (args.outdir/'midi-report.json').write_text(json.dumps(reports,indent=2));print('exported',len(reports))
if __name__=='__main__':main()
