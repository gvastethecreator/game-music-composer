from __future__ import annotations
import json, math, statistics, collections, pathlib, copy
SRC=pathlib.Path('/mnt/data/neospc_skill_work/snes-midi-composer-skill-v2.0/data/neospc100-benchmark.json')
QUALITY=pathlib.Path('/mnt/data/composition-quality-baseline.json')
OUT=pathlib.Path('/mnt/data/neospc_v21_build/neospc100-v2.1.json')

ROLE_BASE_VELOCITY={
 'lead':88,'counter':78,'riff':86,'bass':82,'kick':102,'snare':94,'hat':60,'tom':88,'wood':76,'ride':64,'shaker':58,'brush':54,'rim':72,'impact':106,
 'comp':68,'arp':64,'motor':72,'ostinato':74,'pad':52,'support':62,'ensemble':48,'pulse':70,'texture':44
}
ROLE_RANGES={
 'lead':(55,116),'counter':(48,105),'riff':(62,118),'bass':(55,112),'kick':(78,124),'snare':(64,120),'hat':(32,86),'tom':(58,116),'wood':(45,98),'ride':(38,88),'shaker':(30,78),'brush':(28,72),'rim':(42,100),'impact':(85,127),
 'comp':(38,92),'arp':(36,88),'motor':(44,98),'ostinato':(45,100),'pad':(28,76),'support':(34,84),'ensemble':(24,70),'pulse':(42,98),'texture':(20,66)
}
ROLE_TRACK_VOLUME={'lead':106,'counter':92,'riff':102,'bass':100,'kick':108,'snare':102,'hat':80,'tom':96,'wood':86,'ride':80,'shaker':76,'brush':72,'rim':84,'impact':110,'comp':86,'arp':84,'motor':88,'ostinato':90,'pad':72,'support':82,'ensemble':68,'pulse':86,'texture':62}
FAMILY_CC_TRIM={'brass':-5,'synth':-5,'wind':0,'strings':-1,'choir':-3,'keys':0,'guitar':1,'pluck':3,'mallet':-1,'bass':0,'drum':0,'texture':-5}
CATEGORY_TARGET_LUFS={'adventure':-16.0,'action':-14.8,'horror':-17.0,'towns':-16.0,'emotion':-17.0,'mystery':-16.5,'fantasy':-16.2,'electronic':-14.8,'urban':-15.5,'classical':-17.0}
CATEGORY_DUCK={'adventure':2.0,'action':1.6,'horror':1.2,'towns':1.8,'emotion':2.3,'mystery':1.7,'fantasy':2.0,'electronic':1.2,'urban':1.5,'classical':2.2}


def clamp(x,a,b):return max(a,min(b,x))
def strength(e):return max(1e-6,float(e.get('gain',.01))*float(e.get('accent',1))*float(e.get('performance_gain',1)))
def metric_accent(beat,barlen,meter):
 pos=(beat%barlen)
 if pos<.05:return 8
 if meter in ('4/4','12/8') and abs(pos-barlen/2)<.06:return 3
 if meter=='3/4' and abs(pos-1)<.06:return 1
 if '/8' in meter and abs((pos*2)-round(pos*2))<.04:return -1
 return -3

def section_factor(style,bar):
 forms=style.get('form') or []
 idx=0
 for i,f in enumerate(forms):
  st=f.get('start_bar',0); en=st+f.get('bars',1)
  if st<=bar<en: idx=i; name=str(f.get('name','')).lower(); break
 else:name=''
 if any(k in name for k in ('climax','boss','full','return','a3','seal','stretto')):return 7
 if any(k in name for k in ('intro','breath','opening','a')) and idx==0:return -4
 if any(k in name for k in ('bridge','episode','b')):return 2
 if any(k in name for k in ('outro','coda','release')):return -2
 # arc across sections
 return [-3,1,4,2,0][min(idx,4)]

def phrase_factor(beat,barlen):
 # 4-bar phrase: grow, arrive, release
 p=(beat%(barlen*4))/(barlen*4)
 return 5*math.sin(math.pi*p) - (3 if p>.90 else 0)

def repeated_variation(events):
 # alternating accents for immediate repetitions by instrument/pitch
 last={}; out={}
 for i,e in enumerate(sorted(enumerate(events),key=lambda z:(float(z[1].get('performance_beat',z[1]['beat'])),z[0]))):
  oi,ev=e; key=(ev['inst'],ev.get('midi'))
  b=float(ev.get('performance_beat',ev['beat']))
  if key in last and b-last[key][0] < 1.1: out[oi]= -3 if last[key][1]%2==0 else 1
  else: out[oi]=0
  count=last.get(key,(0,-1))[1]+1; last[key]=(b,count)
 return out

def add_velocities(style,role_medians):
 events=style['events']; reps=repeated_variation(events)
 # chord grouping for voice balance
 groups=collections.defaultdict(list)
 for i,e in enumerate(events):
  if e['kind']=='note': groups[(e['inst'],round(float(e.get('performance_beat',e['beat']))*32)/32)].append((i,e))
 chord_adj={}
 for g in groups.values():
  if len(g)<2:continue
  g.sort(key=lambda z:z[1]['midi'])
  for j,(i,e) in enumerate(g):
   chord_adj[i]=4 if j==len(g)-1 else 1 if j==0 else -4
 for i,e in enumerate(events):
  role=e.get('role','support'); fam=style.get('instrument_map',{}).get(e['inst'],{}).get('family','')
  base=ROLE_BASE_VELOCITY.get(role,66); lo,hi=ROLE_RANGES.get(role,(35,100))
  s=strength(e); med=role_medians.get(role,s); expr_db=clamp(20*math.log10(s/max(med,1e-6)),-7,7)
  beat=float(e.get('performance_beat',e['beat'])); bar=int((beat%style['beats'])/style['barLength'])
  v=base + expr_db*1.6 + metric_accent(beat,style['barLength'],style['meter']) + section_factor(style,bar) + phrase_factor(beat,style['barLength']) + reps.get(i,0) + chord_adj.get(i,0)
  # drums have deliberate ghosts/offbeats
  if role in ('hat','shaker','ride','brush'):
   pos=(beat%style['barLength']); v += -7 if abs(pos-round(pos))>.08 else 1
  if role=='snare' and abs((beat%style['barLength'])-style['barLength']/2)<.1:v+=5
  if e.get('accent',1)>1.02:v+=5
  if e.get('accent',1)<.75:v-=6
  velocity=int(round(clamp(v,lo,hi)))
  e['velocity']=velocity
  e['velocity_norm']=round(velocity/127,4)
  # audio expression: decouple from track balance; curve depends family
  gamma=1.35 if fam in ('keys','guitar','pluck','mallet','drum') else .75
  e['velocity_gain']=round((velocity/max(1,base))**gamma,4)
 # track mix controls
 lanes=collections.defaultdict(list)
 for e in events:lanes[e['inst']].append(e)
 track_mix={}
 for inst,es in lanes.items():
  role=collections.Counter(e.get('role','support') for e in es).most_common(1)[0][0]
  fam=style.get('instrument_map',{}).get(inst,{}).get('family','')
  vol=int(clamp(ROLE_TRACK_VOLUME.get(role,84)+FAMILY_CC_TRIM.get(fam,0),35,118))
  pans=[float(e.get('performance_pan',e.get('pan',0))) for e in es]
  sends=[float(e.get('send',.08)) for e in es]
  track_mix[inst]={'role':role,'family':fam,'cc7_volume':vol,'cc10_pan':int(round(clamp((statistics.mean(pans)+1)*63.5,0,127))),'cc91_reverb':int(round(clamp(statistics.mean(sends)*100,0,90)))}
 style['track_mix']=track_mix
 style['mix_v2']={
  'version':'2.1','target_lufs':CATEGORY_TARGET_LUFS[style['category']],'true_peak_dbfs':-1.0,
  'lead_duck_db':CATEGORY_DUCK[style['category']],
  'kick_bass_duck_db':1.8 if style['category'] in ('action','electronic','urban') else .7,
  'bus_architecture':['lead','bass','drums','rhythm','harmony','atmosphere','fx'],
  'source_calibration':True,'bus_compression':True,'frequency_separation':True,'polyphony_compensation':True
 }

def main():
 d=json.load(open(SRC)); quality={x['id']:x for x in json.load(open(QUALITY))['tracks']}
 roles=collections.defaultdict(list)
 for s in d['styles']:
  for e in s['events']:roles[e.get('role','support')].append(strength(e))
 med={r:statistics.median(v) for r,v in roles.items()}
 for s in d['styles']:
  add_velocities(s,med)
  q=quality.get(s['id'],{'score':70,'status':'review','reasons':[]})
  s['composition_quality']={'score':q['score'],'status':q['status'],'reasons':q['reasons']}
 d['version']='3.1.0'; d['project']='Neo-SPC 100 / Mix & Expression Pass';
 d['mix_engine']={'version':'2.1','mastering':'ITU-R BS.1770 loudness measurement; category targets -14.8 to -17 LUFS','midi':'CC7 track balance + note velocity + CC11 section expression','quality_gate':'curated/review/rebuild symbolic triage'}
 OUT.write_text(json.dumps(d,indent=2));print(OUT,OUT.stat().st_size)
if __name__=='__main__':main()
