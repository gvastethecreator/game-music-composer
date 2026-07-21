import json, math, pathlib, collections, statistics, hashlib
P=pathlib.Path('/mnt/data/neospc_skill_work/snes-midi-composer-skill-v2.0/data/neospc100-benchmark.json')
d=json.load(open(P))

def entropy(vals):
 c=collections.Counter(vals); n=sum(c.values())
 if n<=1:return 0.0
 h=-sum((v/n)*math.log2(v/n) for v in c.values())
 return h/math.log2(max(2,len(c)))

def bar_sigs(events,barlen,bars,roles=None):
 out=[]
 for b in range(bars):
  start=b*barlen; end=start+barlen; pts=[]
  for e in events:
   if roles and e.get('role') not in roles:continue
   beat=float(e.get('performance_beat',e['beat']))
   if start<=beat<end: pts.append(round((beat-start)/barlen,3))
  out.append(tuple(sorted(pts)))
 return out

def density_by_bar(events,barlen,bars,roles=None):
 vals=[]
 for b in range(bars):
  start=b*barlen;end=start+barlen
  vals.append(sum(1 for e in events if (not roles or e.get('role') in roles) and start<=float(e.get('performance_beat',e['beat']))<end))
 return vals

def melody_events(s):
 es=[e for e in s['events'] if e['kind']=='note' and e.get('role') in ('lead','counter','riff')]
 if not es: es=[e for e in s['events'] if e['kind']=='note' and e.get('role') not in ('bass','pad','ensemble','comp','arp','motor','ostinato')]
 return sorted(es,key=lambda e:float(e.get('performance_beat',e['beat'])))

def quality(s):
 ev=s['events']; bars=s['bars']; bl=s['barLength']; mel=melody_events(s)
 lead_sigs=bar_sigs(ev,bl,bars,{'lead','counter','riff'})
 all_sigs=bar_sigs(ev,bl,bars,None)
 comp_sigs=bar_sigs(ev,bl,bars,{'comp','arp','motor','ostinato','pad','support'})
 lead_unique=len(set(lead_sigs))/max(1,bars)
 all_unique=len(set(all_sigs))/max(1,bars)
 comp_unique=len(set(comp_sigs))/max(1,bars)
 adjacent=sum(a==b for a,b in zip(all_sigs,all_sigs[1:]))/max(1,bars-1)
 dens=density_by_bar(ev,bl,bars)
 density_cv=statistics.pstdev(dens)/(statistics.mean(dens)+1e-9) if len(dens)>1 else 0
 pitches=[e['midi'] for e in mel]
 intervals=[b-a for a,b in zip(pitches,pitches[1:])]
 int_entropy=entropy([max(-12,min(12,i)) for i in intervals]) if intervals else 0
 step_ratio=sum(abs(i)<=2 for i in intervals)/max(1,len(intervals))
 huge_ratio=sum(abs(i)>12 for i in intervals)/max(1,len(intervals))
 repeat_ratio=sum(i==0 for i in intervals)/max(1,len(intervals))
 range_semitones=(max(pitches)-min(pitches)) if pitches else 0
 # phrase gap ratio: lead gaps > .35 beats
 beats=[float(e.get('performance_beat',e['beat'])) for e in mel]
 durs=[float(e.get('performance_duration',e.get('duration',.2))) for e in mel]
 gaps=[beats[i+1]-(beats[i]+durs[i]) for i in range(len(beats)-1)]
 breath=sum(g>.3 for g in gaps)/max(1,len(gaps)) if gaps else 0
 # section contrast via density means
 section_means=[]
 for f in s.get('form',[]):
  sb=f.get('start_bar',0); nb=f.get('bars',1); section_means.append(statistics.mean(dens[sb:sb+nb] or [0]))
 section_contrast=(max(section_means)-min(section_means))/(statistics.mean(section_means)+1e-9) if len(section_means)>1 else 0
 # collisions: same onset/pitch across different inst (exact doubling, not always bad)
 onset_pitch=collections.defaultdict(set)
 for e in ev:
  if e['kind']=='note': onset_pitch[(round(float(e.get('performance_beat',e['beat'])),3),e['midi'])].add(e['inst'])
 doubling=sum(len(v)-1 for v in onset_pitch.values() if len(v)>1)/max(1,len(ev))
 # Category-aware desired ranges
 cat=s['category']; tags=set(s.get('tags',[])); motorish=cat in ('action','electronic') or any(t in tags for t in ('techno','dnb','minimalism','process','chase','battle'))
 desired_unique=.22 if motorish else .38
 rhythm_score=min(1,all_unique/max(.01,desired_unique))*25
 if adjacent>.7 and not motorish: rhythm_score-=12*(adjacent-.7)/.3
 phrase_score=0
 phrase_score += min(1,int_entropy/.65)*8
 phrase_score += max(0,1-huge_ratio/.14)*5
 phrase_score += max(0,1-repeat_ratio/.42)*3
 phrase_score += min(1,breath/(.08 if cat in ('emotion','adventure','urban','classical') else .04))*5
 phrase_score += 4 if 7<=range_semitones<=26 else 2 if 4<=range_semitones<=34 else 0
 texture_score=min(1,comp_unique/(.18 if motorish else .28))*12 + min(1,density_cv/(.14 if motorish else .22))*8
 contrast_score=min(1,section_contrast/(.18 if motorish else .28))*12
 identity_score=min(1,lead_unique/(.18 if motorish else .32))*8
 penalty=max(0,doubling-.08)*40
 score=max(0,min(100,rhythm_score+phrase_score+texture_score+contrast_score+identity_score-penalty))
 reasons=[]
 if all_unique<desired_unique: reasons.append('low_bar_topology_diversity')
 if adjacent>.7 and not motorish: reasons.append('excess_adjacent_repetition')
 if density_cv<(.1 if motorish else .16): reasons.append('flat_density_curve')
 if section_contrast<(.12 if motorish else .2): reasons.append('weak_section_contrast')
 if int_entropy<.4: reasons.append('low_interval_variety')
 if breath<.04 and cat in ('emotion','adventure','urban','classical'): reasons.append('insufficient_phrase_breathing')
 if doubling>.15: reasons.append('excess_exact_doubling')
 return {'id':s['id'],'title':s['title'],'category':cat,'score':round(score,2),'status':'curated' if score>=78 else 'review' if score>=65 else 'rebuild','metrics':{'bar_topology_unique':round(all_unique,3),'lead_topology_unique':round(lead_unique,3),'comp_topology_unique':round(comp_unique,3),'adjacent_repetition':round(adjacent,3),'density_cv':round(density_cv,3),'section_contrast':round(section_contrast,3),'interval_entropy':round(int_entropy,3),'step_ratio':round(step_ratio,3),'huge_leap_ratio':round(huge_ratio,3),'breath_ratio':round(breath,3),'exact_doubling_ratio':round(doubling,3)},'reasons':reasons}

reports=[quality(s) for s in d['styles']]
reports.sort(key=lambda x:x['score'])
summary={'counts':collections.Counter(r['status'] for r in reports),'mean_score':statistics.mean(r['score'] for r in reports),'lowest':reports[:20],'highest':reports[-10:]}
out={'version':'2.1','summary':{'counts':dict(summary['counts']),'mean_score':round(summary['mean_score'],2)},'tracks':reports}
pathlib.Path('/mnt/data/composition-quality-baseline.json').write_text(json.dumps(out,indent=2))
print(out['summary'])
for r in reports[:25]:print(r['score'],r['status'],r['id'],','.join(r['reasons']))
