#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,math,collections
from pathlib import Path
try:
    import mido
except ImportError:
    import midi_compat as mido
PPQ=480
DRUM_MAP={'kick':36,'snare':38,'hat':42,'open_hat':46,'tom':45,'wood':76,'shaker':82,'rim':37,'ride':51,'impact':41,'brush':40,'clap':39}
PROGRAMS={'bass':33,'sub':38,'contrabass':43,'slap_bass':36,'strings':48,'violin1':40,'violin2':40,'viola':41,'cello':42,'choir_a':52,'choir_b':52,'choir_s':53,'choir_t':52,'organ':19,'accordion':21,'piano':0,'harpsichord':6,'vibes':11,'bell':14,'harp':46,'guitar':24,'muted_guitar':28,'dist_guitar_l':30,'dist_guitar_r':30,'clav':7,'flute':73,'piccolo':72,'ocarina':79,'reed':65,'clarinet':71,'bassoon':70,'horn':60,'trumpet':56,'trombone':57,'brass':61,'muted_brass':59,'pulse25':80,'pulse50':80,'synth_lead':81,'synth_pad':88,'drone':89,'prepared_piano':2,'pizz':45}
ROLE_CC7={'lead':101,'counter':88,'riff':96,'bass':96,'kick':112,'snare':108,'hat':88,'tom':102,'wood':90,'ride':86,'shaker':82,'brush':78,'rim':92,'impact':100,'comp':82,'arp':80,'motor':86,'ostinato':88,'pad':68,'support':78,'ensemble':64,'pulse':82,'texture':58}
INST_CC7={'horn':-10,'brass':-8,'trumpet':-11,'trombone':-7,'muted_brass':-6,'synth_lead':-9,'pulse25':-6,'pulse50':-7,'bell':-8,'kick':7,'snare':8,'tom':5,'bass':3,'sub':2}
def clamp(x,a,b):return max(a,min(b,x))
def safe(v):return str(v).encode('latin-1','replace').decode('latin-1')
def parse_meter(x):
 try:a,b=x.split('/');return int(a),int(b)
 except:return 4,4

def form_at(style,beat):
 bar=beat/style['barLength']; forms=style.get('form') or []
 for i,f in enumerate(forms):
  st=float(f.get('start_bar',0));en=st+float(f.get('bars',1))
  if st<=bar<en:return i,str(f.get('name','')).lower(),(bar-st)/max(.001,en-st)
 return 0,'',0

def expression_value(style,beat,role):
 i,name,p=form_at(style,beat)
 section=96
 if any(k in name for k in ('intro','opening','breath')):section=82
 elif any(k in name for k in ('climax','full','stretto','boss','return','a3','seal')):section=116
 elif any(k in name for k in ('bridge','episode','b')):section=101
 elif any(k in name for k in ('outro','release','coda')):section=90
 forms=style.get('form') or []
 if i<len(forms) and 'intensity' in forms[i]:section=round(70+40*float(forms[i]['intensity']))
 phrase=(beat%(style['barLength']*4))/(style['barLength']*4)
 arc=7*math.sin(math.pi*phrase)-3*(phrase>.9)
 role_adj={'lead':3,'counter':0,'riff':2,'bass':0,'kick':4,'snare':3,'pad':-5,'ensemble':-6,'texture':-8,'support':-3,'arp':-2}.get(role,0)
 return int(clamp(round(section+arc+role_adj),28,124))

def _plan_for(style,sound_plan):
 if not sound_plan:return None
 if sound_plan.get('tracks'):return sound_plan
 cues=sound_plan.get('cues') or []
 for cue in cues:
  if cue.get('score_id')==style.get('id'):return cue
 return cues[0] if cues else None

def _source(plan,inst):
 if not plan:return None
 for row in plan.get('tracks') or []:
  if row.get('inst')==inst:return row.get('source')
 return None

def _kit_channel(source,events):
 if source:
  bank=int(source.get('bank') or 0)
  if source.get('percussion') and bank==128:return True
  return False
 return all(e['kind']=='drum' for e in events)

def export(style,outdir,sound_plan=None,adapt_ports=False):
 mid=mido.MidiFile(type=1,ticks_per_beat=PPQ); meta=mido.MidiTrack();mid.tracks.append(meta)
 meta.append(mido.MetaMessage('track_name',name=safe(style['title']),time=0));meta.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(style['bpm']),time=0));num,den=parse_meter(style['meter']);meta.append(mido.MetaMessage('time_signature',numerator=num,denominator=den,time=0));meta.append(mido.MetaMessage('text',text=safe(f"Neo-SPC v2.2 category={style['category']} bpm_center={style['bpm']} sample_bank=1.1"),time=0))
 lanes=collections.defaultdict(list)
 for e in style['events']:lanes[e['inst']].append(e)
 plan=_plan_for(style,sound_plan)
 melodic=[0,1,2,3,4,5,6,7,8,10,11,12,13,14,15]
 melodic_names=[inst for inst,events in sorted(lanes.items()) if not _kit_channel(_source(plan,inst),events)]
 if len(melodic_names)>len(melodic) and not adapt_ports and plan:
  raise ValueError('multi-port MIDI: more than 15 melodic lanes; pass --adapt-ports to collapse onto one port or split the score')
 if adapt_ports and len(melodic_names)>len(melodic):
  raise ValueError('cannot adapt MIDI ports: more than 15 melodic lanes on one port')
 ci=0;report=[]
 for inst,events in sorted(lanes.items()):
  source=_source(plan,inst)
  is_drum=_kit_channel(source,events)
  if is_drum:
   port,ch=0,9
  else:
   port=0 if adapt_ports else ci//len(melodic)
   ch=melodic[ci%len(melodic)];ci+=1
  if port and plan and not adapt_ports:
   raise ValueError(f'multi-port MIDI: {inst} assigned port {port}; pass --adapt-ports to collapse onto one port or split the score')
  role=collections.Counter(e.get('role','support') for e in events).most_common(1)[0][0]
  info=style.get('instrument_map',{}).get(inst,{})
  tr=mido.MidiTrack();mid.tracks.append(tr);tr.append(mido.MetaMessage('track_name',name=safe(f"{inst} [{role}]"),time=0))
  tr.append(mido.MetaMessage('midi_port',port=port,time=0))
  program=PROGRAMS.get(inst,PROGRAMS.get(info.get('family',''),0));bank_msb=0;bank_lsb=0
  if source:
   bank=int(source.get('bank') or 0);program=int(source.get('program') or 0)
   bank_msb=0 if bank>=128 else bank
   tr.append(mido.Message('control_change',control=0,value=bank_msb,channel=ch,time=0))
   tr.append(mido.Message('control_change',control=32,value=bank_lsb,channel=ch,time=0))
   tr.append(mido.Message('program_change',program=program,channel=ch,time=0))
  elif not is_drum:
   tr.append(mido.Message('program_change',program=program,channel=ch,time=0))
  base=ROLE_CC7.get(role,82)+INST_CC7.get(inst,0)
  tm=style.get('track_mix',{}).get(inst,{})
  cc7=int(clamp(round(base*.68+int(tm.get('cc7_volume',base))*.32),28,118))
  tr.append(mido.Message('control_change',control=7,value=cc7,channel=ch,time=0));tr.append(mido.Message('control_change',control=10,value=int(tm.get('cc10_pan',64)),channel=ch,time=0));tr.append(mido.Message('control_change',control=91,value=int(tm.get('cc91_reverb',18)),channel=ch,time=0))
  msgs=[]
  step=max(.5,style['barLength']/2)
  b=0.0
  while b<style['beats']+.001:
   msgs.append((round(b*PPQ),-3,mido.Message('control_change',control=11,value=expression_value(style,b,role),channel=ch,time=0)));b+=step
  velocities=[]
  for e in events:
   start=float(e.get('performance_beat',e['beat']));dur=float(e.get('performance_duration',e.get('duration',.15 if e['kind']=='drum' else .3)));end=start+max(.035,dur)
   note=int(e.get('midi',DRUM_MAP.get(inst,60))) if e['kind']=='drum' else int(clamp(e['midi'],0,127));vel=int(clamp(e.get('velocity',80),1,127));velocities.append(vel)
   rel=int(clamp(round(vel*(.22 if e.get('role') in ('pad','ensemble','texture') else .38)),1,100))
   msgs.append((round(start*PPQ),0,mido.Message('note_on',note=note,velocity=vel,channel=ch,time=0)));msgs.append((round(end*PPQ),-1,mido.Message('note_off',note=note,velocity=rel,channel=ch,time=0)))
  msgs.sort(key=lambda x:(x[0],x[1]));last=0
  for tick,_,msg in msgs:msg.time=max(0,tick-last);tr.append(msg);last=tick
  report.append({'inst':inst,'role':role,'port':port,'channel':ch,'bank':bank_msb,'program':program if source or not is_drum else None,'cc7':cc7,'velocity_min':min(velocities),'velocity_max':max(velocities),'velocity_mean':round(sum(velocities)/len(velocities),2)})
 outdir.mkdir(parents=True,exist_ok=True);path=outdir/f"{style['id']}.mid";mid.save(path)
 return {'id':style['id'],'tracks':len(mid.tracks),'bytes':path.stat().st_size,'lanes':report}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('catalog',type=Path);ap.add_argument('outdir',type=Path)
 ap.add_argument('--sound-plan',type=Path);ap.add_argument('--adapt-ports',action='store_true')
 args=ap.parse_args();d=json.loads(args.catalog.read_text())
 plan=json.loads(args.sound_plan.read_text()) if args.sound_plan else None
 r=[export(s,args.outdir,sound_plan=plan,adapt_ports=args.adapt_ports) for s in d['styles']]
 (args.outdir/'midi-report.json').write_text(json.dumps(r,indent=2));print('exported',len(r))
if __name__=='__main__':main()
