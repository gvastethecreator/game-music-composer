#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, math, statistics, collections
from pathlib import Path

MODES={
 'major':[0,2,4,5,7,9,11], 'minor':[0,2,3,5,7,8,10], 'dorian':[0,2,3,5,7,9,10],
 'phrygian':[0,1,3,5,7,8,10], 'lydian':[0,2,4,6,7,9,11], 'mixolydian':[0,2,4,5,7,9,10],
 'harmonic_minor':[0,2,3,5,7,8,11], 'melodic_minor':[0,2,3,5,7,9,11],
 'whole_tone':[0,2,4,6,8,10], 'octatonic':[0,2,3,5,6,8,9,11], 'pentatonic_major':[0,2,4,7,9], 'pentatonic_minor':[0,3,5,7,10]
}
PCS={'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
MELODIC_ROLES={'lead','counter','riff'}
STRUCTURAL_ROLES={'lead','counter','riff','bass'}
SUPPORT_ROLES={'comp','arp','motor','ostinato','pad','support','ensemble','pulse','texture'}
DRUM_ROLES={'kick','snare','hat','tom','wood','ride','shaker','brush','rim','impact'}


def clamp(v,a,b): return max(a,min(b,v))
def safe_mean(vals,default=0): return statistics.mean(vals) if vals else default
def norm_score(value,lo,hi): return clamp((value-lo)/(hi-lo)*10 if hi!=lo else 5,0,10)
def onset(e): return float(e.get('performance_beat',e.get('beat',0)))
def dur(e): return float(e.get('performance_duration',e.get('duration',.15 if e.get('kind')=='drum' else .3)))
def role(e): return e.get('role','support')

def chord_for(style,beat):
    if not style.get('chord_plan'): return None
    bar=int((beat%style['beats'])/style['barLength'])
    return style['chord_plan'][min(bar,len(style['chord_plan'])-1)]

def scale_pcs(style):
    root=PCS.get(style.get('key','C'),0)
    return {(root+x)%12 for x in MODES.get(style.get('mode','major'),MODES['major'])}

def polyphony_profile(style,step=.25):
    n=max(1,int(math.ceil(style['beats']/step))); vals=[]
    for i in range(n):
        b=i*step
        vals.append(sum(1 for e in style['events'] if e.get('kind')=='note' and ((onset(e)<=b<onset(e)+dur(e)) or (onset(e)+dur(e)>style['beats'] and b<onset(e)+dur(e)-style['beats']))))
    return vals

def topology_by_bar(style,roles=None):
    bl=style['barLength']; bars=max(1,int(math.ceil(style['beats']/bl))); out=[]
    for b in range(bars):
        sig=[]
        for e in style['events']:
            if roles and role(e) not in roles: continue
            eb=onset(e)
            if int(eb/bl)!=b: continue
            sig.append((role(e),round((eb%bl)/bl,3),round(dur(e)/bl,3)))
        out.append(tuple(sorted(sig)))
    return out

def section_densities(style):
    out=[]
    forms=style.get('form') or [{'name':'all','start_bar':0,'bars':style.get('bars',1)}]
    for f in forms:
        st=float(f.get('start_bar',0))*style['barLength']; en=st+float(f.get('bars',1))*style['barLength']
        count=sum(1 for e in style['events'] if st<=onset(e)<en)
        out.append(count/max(.01,en-st))
    return out

def melodic_metrics(style):
    notes=sorted([e for e in style['events'] if e.get('kind')=='note' and role(e) in MELODIC_ROLES],key=onset)
    lead=sorted([e for e in notes if role(e)=='lead'],key=onset)
    if len(lead)<2:return {'notes':len(lead),'leap_ratio':1,'repeat_ratio':1,'range':0,'rests':0,'direction_changes':0,'phrase_variety':0}
    intervals=[lead[i+1]['midi']-lead[i]['midi'] for i in range(len(lead)-1)]
    leap_ratio=sum(abs(x)>7 for x in intervals)/len(intervals)
    repeat_ratio=sum(x==0 for x in intervals)/len(intervals)
    dirs=[1 if x>0 else -1 if x<0 else 0 for x in intervals]
    direction_changes=sum(dirs[i] and dirs[i-1] and dirs[i]!=dirs[i-1] for i in range(1,len(dirs)))/max(1,len(dirs)-1)
    gaps=[max(0,onset(lead[i+1])-(onset(lead[i])+dur(lead[i]))) for i in range(len(lead)-1)]
    rests=sum(g>.18 for g in gaps)/max(1,len(gaps))
    phrase_sigs=[];bl=style['barLength']
    for start in range(0,int(math.ceil(style['beats']/bl)),2):
        sig=[(round((onset(e)-start*bl)/bl,2),e['midi']%12,round(dur(e)/bl,2)) for e in lead if start*bl<=onset(e)<(start+2)*bl]
        if sig: phrase_sigs.append(tuple(sig))
    phrase_variety=len(set(phrase_sigs))/max(1,len(phrase_sigs))
    return {'notes':len(lead),'leap_ratio':leap_ratio,'repeat_ratio':repeat_ratio,'range':max(e['midi'] for e in lead)-min(e['midi'] for e in lead),'rests':rests,'direction_changes':direction_changes,'phrase_variety':phrase_variety}

def harmonic_metrics(style):
    scale=scale_pcs(style); total=strong=strong_fit=scale_fit=weak_nonchord=0
    for e in style['events']:
        if e.get('kind')!='note': continue
        total+=1; pc=e['midi']%12; b=onset(e); c=chord_for(style,b)
        if pc in scale: scale_fit+=1
        pos=b%style['barLength']; is_strong=pos<.08 or abs(pos-style['barLength']/2)<.08
        if is_strong and role(e) in STRUCTURAL_ROLES:
            strong+=1
            if not c or pc in set(c.get('pcs',[])):strong_fit+=1
        elif c and pc not in set(c.get('pcs',[])) and role(e) in STRUCTURAL_ROLES: weak_nonchord+=1
    return {'scale_fit':scale_fit/max(1,total),'strong_chord_fit':strong_fit/max(1,strong),'weak_nonchord_ratio':weak_nonchord/max(1,total)}

def orchestration_metrics(style):
    events=style['events']; byrole=collections.Counter(role(e) for e in events); byinst=collections.Counter(e['inst'] for e in events)
    prof=polyphony_profile(style); maxp=max(prof or [0]); meanp=safe_mean(prof); saturation=sum(v>=max(8,style.get('voice_budget',16)*.72) for v in prof)/max(1,len(prof))
    support=sum(byrole[r] for r in SUPPORT_ROLES); lead=sum(byrole[r] for r in MELODIC_ROLES); drums=sum(byrole[r] for r in DRUM_ROLES)
    register=[]
    for inst in byinst:
        ns=[e['midi'] for e in events if e.get('kind')=='note' and e['inst']==inst]
        if ns: register.append((inst,min(ns),max(ns)))
    collisions=0
    for i,a in enumerate(register):
        for b in register[i+1:]:
            overlap=max(0,min(a[2],b[2])-max(a[1],b[1]))
            if overlap>8: collisions+=1
    return {'instrument_count':len(byinst),'max_polyphony':maxp,'mean_polyphony':meanp,'saturation_ratio':saturation,'support_to_lead':support/max(1,lead),'drum_ratio':drums/max(1,len(events)),'register_collisions':collisions}

def expressive_metrics(style):
    events=style['events']; gains=[float(e.get('performance_gain',1)) for e in events]; offsets=[float(e.get('start_offset_ms',0)) for e in events]; durs=[dur(e) for e in events if e.get('kind')=='note']; velocities=[int(e.get('velocity',0)) for e in events if e.get('velocity')]
    return {'gain_std':statistics.pstdev(gains) if len(gains)>1 else 0,'timing_std_ms':statistics.pstdev(offsets) if len(offsets)>1 else 0,'duration_cv':statistics.pstdev(durs)/max(.001,safe_mean(durs,1)) if len(durs)>1 else 0,'velocity_std':statistics.pstdev(velocities) if len(velocities)>1 else 0}

def idiom_score(style,top_unique,mel,orch):
    cat=style['category']; sub=str(style.get('subcategory','')).lower(); score=6.5; reasons=[]
    has=lambda inst:any(e['inst']==inst for e in style['events'])
    if cat in ('action','electronic'):
        if orch['drum_ratio']>.10:score+=1
        else:reasons.append('rhythmic engine lacks sufficient drum articulation')
        if top_unique>.35:score+=.7
    if cat=='urban':
        if has('bass') or has('slap_bass'):score+=.5
        if mel['rests']>.12:score+=.5
        if 'jazz' in sub and not (has('ride') or has('brush')):score-=1;reasons.append('jazz identity lacks ride/brush behavior')
    if cat=='classical':
        if orch['instrument_count']>=4:score+=.6
        if orch['drum_ratio']<.08:score+=.4
    if cat=='horror':
        if mel['rests']>.18:score+=.6
        if orch['saturation_ratio']<.25:score+=.4
    if cat in ('emotion','mystery'):
        if mel['rests']>.16:score+=.5
        if top_unique>.42:score+=.4
    if cat in ('towns','adventure','fantasy'):
        if mel['phrase_variety']>.45:score+=.5
        if orch['support_to_lead']<8:score+=.3
    return clamp(score,0,10),reasons

def review(style):
    mel=melodic_metrics(style); harm=harmonic_metrics(style); orch=orchestration_metrics(style); expr=expressive_metrics(style)
    tops=topology_by_bar(style); top_unique=len(set(tops))/max(1,len(tops)); adjacent=sum(tops[i]==tops[i-1] for i in range(1,len(tops)))/max(1,len(tops)-1)
    dens=section_densities(style); contrast=(max(dens)-min(dens))/max(.1,safe_mean(dens,1)) if len(dens)>1 else 0
    scores={}
    scores['melodic_coherence']=clamp(10 - mel['leap_ratio']*11 - max(0,mel['repeat_ratio']-.28)*9 + mel['direction_changes']*2 + mel['rests']*1.5,0,10)
    scores['harmonic_logic']=clamp(harm['strong_chord_fit']*7 + harm['scale_fit']*3 - harm['weak_nonchord_ratio']*4,0,10)
    scores['phrase_and_form']=clamp(3 + mel['phrase_variety']*3 + min(1,contrast)*3 + mel['rests']*2 - adjacent*2,0,10)
    scores['rhythm_and_groove']=clamp(2.5 + top_unique*5 + (1-adjacent)*2.5,0,10)
    scores['counterpoint_voice_leading']=clamp(8.5 - orch['register_collisions']*.28 - mel['leap_ratio']*3,0,10)
    scores['orchestration']=clamp(7.5 + min(1,orch['instrument_count']/8)*2 - orch['saturation_ratio']*4 - max(0,orch['support_to_lead']-9)*.15,0,10)
    scores['expression']=clamp(3.5 + min(expr['gain_std']/.12,1)*2 + min(expr['timing_std_ms']/12,1)*2 + min(expr['duration_cv']/.45,1)*1.5 + min(expr['velocity_std']/16,1)*1,0,10)
    idiom,idiom_reasons=idiom_score(style,top_unique,mel,orch);scores['idiomatic_character']=idiom
    scores['loop_design']=clamp(6.5 + (1 if style.get('musical_direction',{}).get('loop_strategy') else 0) + (1 if style.get('chord_plan') else 0) - (1.2 if adjacent>.75 else 0),0,10)
    scores['identity']=clamp(4 + mel['phrase_variety']*2 + top_unique*2 + min(1,orch['instrument_count']/8)*2,0,10)
    weights={'melodic_coherence':1.3,'harmonic_logic':1.4,'phrase_and_form':1.25,'rhythm_and_groove':1.1,'counterpoint_voice_leading':.9,'orchestration':1,'expression':.75,'idiomatic_character':1.05,'loop_design':.65,'identity':.9}
    weighted=sum(scores[k]*weights[k] for k in scores)/sum(weights.values())
    actions=[];critic=[]
    if scores['harmonic_logic']<7.6:actions.append('repair_structural_harmony');critic.append('Structural notes do not consistently clarify the active harmony.')
    if scores['melodic_coherence']<7.2:actions.append('reshape_melodic_line');critic.append('The melodic line needs fewer arbitrary leaps and clearer destination tones.')
    if scores['phrase_and_form']<7.2:actions.append('strengthen_phrase_architecture');critic.append('Phrases do not yet create enough question, consequence, breath and arrival.')
    if scores['rhythm_and_groove']<7.0:actions.append('vary_rhythmic_topology');critic.append('The rhythmic surface repeats too literally across bars.')
    if scores['orchestration']<7.1:actions.append('rebalance_orchestration');critic.append('The arrangement needs clearer foreground/background hierarchy and more intentional density.')
    if scores['expression']<6.8:actions.append('deepen_expression');critic.append('Timing, dynamics and articulation remain too uniform.')
    if scores['idiomatic_character']<7:actions.append('reinforce_genre_idiom');critic.extend(idiom_reasons or ['The musical behavior is not yet specific enough to its declared style.'])
    status='approved' if weighted>=8.0 and not actions else 'revise' if weighted>=6.7 else 'rebuild'
    return {
      'id':style['id'],'title':style['title'],'category':style['category'],'status':status,'score':round(weighted*10,1),
      'dimension_scores':{k:round(v,2) for k,v in scores.items()},'metrics':{'melody':mel,'harmony':harm,'orchestration':orch,'expression':expr,'topology_unique_ratio':round(top_unique,4),'adjacent_repeat_ratio':round(adjacent,4),'section_density_contrast':round(contrast,4)},
      'critique':critic or ['The composition is coherent; revisions should focus on refinement rather than repair.'],'required_actions':actions
    }

def main():
    ap=argparse.ArgumentParser();ap.add_argument('catalog',type=Path);ap.add_argument('output',type=Path);args=ap.parse_args()
    d=json.loads(args.catalog.read_text());tracks=[review(s) for s in d['styles']]
    summary=collections.Counter(t['status'] for t in tracks)
    out={'version':'3.0.0','reviewer':'Independent Music Professor Pass','method':'symbolic score critique independent from renderer and mix','summary':dict(summary),'average_score':round(safe_mean([t['score'] for t in tracks]),2),'tracks':tracks}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(out,indent=2));print(json.dumps({'summary':dict(summary),'average':out['average_score']},indent=2))
if __name__=='__main__':main()
