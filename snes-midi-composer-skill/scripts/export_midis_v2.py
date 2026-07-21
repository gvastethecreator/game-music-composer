#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,math,collections
from pathlib import Path
import mido
PPQ=480
DRUM_MAP={'kick':36,'snare':38,'hat':42,'open_hat':46,'tom':45,'wood':76,'shaker':82,'rim':37,'ride':51,'impact':41,'brush':40,'clap':39}
PROGRAMS={'bass':33,'sub':38,'strings':48,'violin':40,'cello':42,'choir':52,'organ':19,'accordion':21,'piano':0,'harpsichord':6,'vibe':11,'bell':14,'harp':46,'guitar':24,'muted_guitar':28,'distorted_guitar':30,'clav':7,'flute':73,'ocarina':79,'reed':65,'wind':73,'brass':61,'muted_brass':59,'pulse':80,'synth':81,'pad':88,'drone':89,'texture':96,'pizz':45,'mallet':12,'keys':0,'pluck':46}
def safe(v):return str(v).encode('latin-1','replace').decode('latin-1')
def parse_meter(x):
 try:a,b=x.split('/');return int(a),int(b)
 except:return 4,4
def section_expression(style):
 out=[]
 for i,f in enumerate(style.get('form') or []):
  name=str(f.get('name','')).lower();value=[88,100,108,103,96][min(i,4)]
  if any(k in name for k in ('climax','full','stretto','return','a3')):value=116
  elif any(k in name for k in ('intro','breath','opening')):value=86
  elif any(k in name for k in ('outro','coda','release')):value=94
  out.append((round(f.get('start_bar',0)*style['barLength']*PPQ),value))
 return out or [(0,100)]
def export(style,outdir):
 mid=mido.MidiFile(type=1,ticks_per_beat=PPQ);meta=mido.MidiTrack();mid.tracks.append(meta)
 meta.append(mido.MetaMessage('track_name',name=safe(style['title']),time=0));meta.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(style['bpm']),time=0));num,den=parse_meter(style['meter']);meta.append(mido.MetaMessage('time_signature',numerator=num,denominator=den,time=0));meta.append(mido.MetaMessage('text',text=safe(f"Neo-SPC mix=2.1 category={style['category']} target_lufs={style['mix_v2']['target_lufs']} quality={style['composition_quality']['status']}"),time=0))
 lanes=collections.defaultdict(list)
 for e in style['events']:lanes[e['inst']].append(e)
 melodic=[0,1,2,3,4,5,6,7,8,10,11,12,13,14,15];ci=0
 for inst,events in sorted(lanes.items()):
  is_drum=all(e['kind']=='drum' for e in events);ch=9 if is_drum else melodic[ci%len(melodic)];ci+=0 if is_drum else 1
  tr=mido.MidiTrack();mid.tracks.append(tr);tr.append(mido.MetaMessage('track_name',name=safe(inst),time=0));info=style.get('instrument_map',{}).get(inst,{});tm=style.get('track_mix',{}).get(inst,{})
  if not is_drum:tr.append(mido.Message('program_change',program=PROGRAMS.get(inst,PROGRAMS.get(info.get('family',''),0)),channel=ch,time=0))
  tr.append(mido.Message('control_change',control=7,value=int(tm.get('cc7_volume',90)),channel=ch,time=0));tr.append(mido.Message('control_change',control=10,value=int(tm.get('cc10_pan',64)),channel=ch,time=0));tr.append(mido.Message('control_change',control=91,value=int(tm.get('cc91_reverb',20)),channel=ch,time=0))
  msgs=[]
  for tick,val in section_expression(style):msgs.append((tick,-2,mido.Message('control_change',control=11,value=max(1,min(127,val)),channel=ch,time=0)))
  for e in events:
   start=float(e.get('performance_beat',e['beat']));dur=float(e.get('performance_duration',e.get('duration',.15 if e['kind']=='drum' else .3)));end=start+max(.04,dur);note=DRUM_MAP.get(inst,60) if e['kind']=='drum' else int(max(0,min(127,e['midi'])));vel=int(max(1,min(127,e.get('velocity',80))))
   msgs.append((round(start*PPQ),0,mido.Message('note_on',note=note,velocity=vel,channel=ch,time=0)));msgs.append((round(end*PPQ),1,mido.Message('note_off',note=note,velocity=max(0,min(127,round(vel*.35))),channel=ch,time=0)))
  msgs.sort(key=lambda x:(x[0],x[1]));last=0
  for tick,_,msg in msgs:msg.time=max(0,tick-last);tr.append(msg);last=tick
 outdir.mkdir(parents=True,exist_ok=True);path=outdir/f"{style['id']}.mid";mid.save(path);return {'id':style['id'],'tracks':len(mid.tracks),'bytes':path.stat().st_size,'velocity_min':min(e.get('velocity',80) for e in events),'velocity_max':max(e.get('velocity',80) for e in events)}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('catalog',type=Path);ap.add_argument('outdir',type=Path);args=ap.parse_args();d=json.loads(args.catalog.read_text());r=[export(s,args.outdir) for s in d['styles']];(args.outdir/'midi-report.json').write_text(json.dumps(r,indent=2));print('exported',len(r))
if __name__=='__main__':main()
