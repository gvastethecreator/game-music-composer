#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,re,unicodedata
from collections import defaultdict
from pathlib import Path
from mido import MidiFile,MidiTrack,Message,MetaMessage,bpm2tempo

PROGRAMS={'piano':0,'prepared_piano':1,'harpsichord':6,'vibes':11,'organ':16,'accordion':21,'guitar':24,'dist_guitar':29,'bass':32,'synth_bass':38,'triangle_bass':38,'strings':48,'choir':52,'brass':61,'muted_brass':59,'flute':73,'ocarina':79,'pulse25':80,'pulse50':81,'pizz':45,'drone':91,'harp':46}
DRUMS={'kick':36,'snare':38,'rim':37,'tom':45,'hat':42,'open_hat':46,'shaker':82,'ride':51,'brush':38,'wood':76,'impact':57}

def safe(v):return unicodedata.normalize('NFKD',str(v)).encode('latin-1','ignore').decode('latin-1')
def meter(v):
 m=re.search(r'(\d+)\s*/\s*(\d+)',v or '');return (int(m.group(1)),int(m.group(2))) if m else (4,4)
def add(track,events,end):
 events.sort(key=lambda x:(x[0],x[1]));last=0
 for tick,_,msg in events:msg.time=max(0,tick-last);track.append(msg);last=tick
 track.append(MetaMessage('end_of_track',time=max(0,end-last)))
def export(style,out,ppq=960):
 mf=MidiFile(type=1,ticks_per_beat=ppq);end=round(style['beats']*ppq);c=MidiTrack();mf.tracks.append(c);num,den=meter(style.get('meter'))
 c.append(MetaMessage('track_name',name=safe(style['title']+' | expressive conductor'),time=0));c.append(MetaMessage('set_tempo',tempo=bpm2tempo(style['bpm']),time=0));c.append(MetaMessage('time_signature',numerator=num,denominator=den,time=0));c.append(MetaMessage('marker',text='[LOOP_START]',time=0));cur=0
 for sec in style.get('form',[]):
  t=round(sec['start']*ppq);c.append(MetaMessage('marker',text=safe('[SECTION] '+sec['name']),time=max(0,t-cur)));cur=t
 c.append(MetaMessage('marker',text='[LOOP_END]',time=max(0,end-cur)));c.append(MetaMessage('end_of_track',time=0))
 groups=defaultdict(list)
 for e in style['events']:
  if e.get('performance_mute'):continue
  key=e['inst']+(' | layer' if e.get('_layer') else '')
  groups[key].append(e)
 melodic=[k for k,v in groups.items() if any(e['kind']=='note' for e in v)];channels=[0,1,2,3,4,5,6,7,8,10,11,12,13,14,15];chmap={k:channels[i%len(channels)] for i,k in enumerate(melodic)}
 for name,source in groups.items():
  isdr=all(e['kind']=='drum' for e in source);ch=9 if isdr else chmap[name];tr=MidiTrack();mf.tracks.append(tr);timed=[(0,0,MetaMessage('track_name',name=safe(name),time=0))]
  baseinst=source[0]['inst']
  if not isdr:timed.append((0,1,Message('program_change',channel=ch,program=PROGRAMS.get(baseinst,80),time=0)))
  for e in source:
   b=float(e.get('performance_beat',e['beat']));dur=float(e.get('performance_duration',e.get('duration',.12 if isdr else .25)));start=round(b*ppq);stop=max(start+1,round((b+dur)*ppq));note=DRUMS.get(baseinst,38) if isdr else int(e.get('midi',60));vel=max(1,min(127,round(float(e.get('gain',.06))*float(e.get('accent',1))*float(e.get('performance_gain',1))*1050)))
   timed.append((start,10,Message('note_on',channel=ch,note=note,velocity=vel,time=0)));timed.append((stop,5,Message('note_off',channel=ch,note=note,velocity=0,time=0)))
  add(tr,timed,end)
 out.parent.mkdir(parents=True,exist_ok=True);mf.save(out)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('catalog',type=Path);ap.add_argument('outdir',type=Path);args=ap.parse_args();d=json.loads(args.catalog.read_text())
 for s in d['styles']:export(s,args.outdir/f"{s['id']}.mid")
 print('generated',len(d['styles']),d['mode'])
if __name__=='__main__':main()
