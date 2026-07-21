from __future__ import annotations
import json, math, copy, hashlib
from pathlib import Path
SRC=Path('/mnt/data/neospc_work/source_v21/neospc100-v2.1.json')
OUT=Path('/mnt/data/neospc_work/neospc100-v2.2.json')
MANIFEST=json.load(open('/mnt/data/neospc_work/sample_bank_v32/sample-bank.json'))
SAMPLES={s['id']:s for s in MANIFEST['samples']}

SAMPLE_LABELS={
 'upright_bass_v2_A2':('Upright Bass II','bass'),
 'electric_finger_bass_A2':('Finger Bass','bass'),
 'picked_bass_A2':('Picked Bass','bass'),
 'analog_bass_A2':('Analog Bass','bass'),
 'sub_bass_C2':('Sub Bass','bass'),
 'bowed_contrabass_A1':('Bowed Contrabass','bass'),
 'kick_punch':('Punch Kick','drum'),
 'snare_body':('Body Snare','drum'),
}
INST_TRIMS={
 'horn':-5.0,'brass':-3.8,'trumpet':-5.2,'trombone':-3.5,'muted_brass':-2.8,
 'synth_lead':-4.2,'pulse25':-2.6,'pulse50':-3.0,'bell':-3.5,'impact':-2.0,
 'choir_a':-1.5,'choir_b':-1.8,'choir_s':-2.4,'choir_t':-1.8,
 'kick':2.4,'snare':2.8,'tom':1.7,'ride':.8,'hat':.8,'shaker':.5,
 'bass':1.2,'sub':.8,'contrabass':.8,'slap_bass':.5,
}
DRUM_VEL_BOOST={'kick':9,'snare':10,'tom':7,'rim':5,'hat':4,'ride':3,'shaker':3,'brush':3,'wood':3}
FAST_ROLES={'arp','motor','ostinato','pulse'}

def set_sample(info,sid):
    meta=SAMPLES[sid]
    info['sample']=sid; info['file']=Path(meta['file']).name; info['root_midi']=meta['root_midi']
    if sid in SAMPLE_LABELS: info['label']=SAMPLE_LABELS[sid][0]; info['family']=SAMPLE_LABELS[sid][1]

def choose_bass_sample(style,inst,events):
    cat=style['category']; sub=str(style.get('subcategory','')).lower(); bpm=style['bpm']
    if inst=='sub': return 'sub_bass_C2'
    if inst=='slap_bass': return 'slap_bass_A2'
    if inst=='contrabass': return 'bowed_contrabass_A1'
    if cat=='electronic': return 'analog_bass_A2'
    if cat=='action': return 'picked_bass_A2'
    if cat=='urban':
        if any(k in sub for k in ('jazz','swing','bebop','tango')): return 'upright_bass_v2_A2'
        return 'electric_finger_bass_A2'
    if cat=='towns': return 'electric_finger_bass_A2'
    if cat in ('classical','fantasy'):
        # long notes benefit from bow; short notes use acoustic pluck.
        durations=[float(e.get('performance_duration',e.get('duration',.3))) for e in events]
        return 'bowed_contrabass_A1' if durations and sum(durations)/len(durations)>.9 else 'upright_bass_v2_A2'
    if cat=='horror': return 'sub_bass_C2' if bpm<90 else 'upright_bass_v2_A2'
    if cat=='mystery': return 'analog_bass_A2' if any(k in sub for k in ('science','time','signal')) else 'upright_bass_v2_A2'
    if cat=='emotion': return 'upright_bass_v2_A2'
    return 'upright_bass_v2_A2'

def stable_fraction(*parts):
    h=hashlib.sha1('|'.join(map(str,parts)).encode()).digest()
    return int.from_bytes(h[:4],'big')/2**32

def enrich_fast(style):
    if style['bpm'] < 140: return {'split_notes':0,'ghost_drums':0,'fills':0}
    density=len(style['events'])/max(1,style['beats'])
    # Very dense pieces need articulation, not more notes.
    split_prob=.34 if density<7.0 else .16
    out=[]; split=0
    for e in style['events']:
        role=e.get('role','support'); dur=float(e.get('duration',0) or 0)
        frac=stable_fraction(style['id'],e.get('inst'),e.get('beat'),e.get('midi'),role)
        if e['kind']=='note' and role in FAST_ROLES and dur>=.48 and frac<split_prob:
            pieces=4 if dur>=1.15 and style['bpm']>=165 and frac<split_prob*.35 else 2
            step=min(.25,dur/pieces)
            for j in range(pieces):
                n=copy.deepcopy(e); n['beat']=round(float(e['beat'])+j*step,5)
                if 'performance_beat' in n:n['performance_beat']=round(float(e['performance_beat'])+j*step,5)
                n['duration']=round(step*.70,5); n['performance_duration']=round(step*(.58 if j%2 else .66),5)
                v=int(n.get('velocity',70)); n['velocity']=max(24,min(124,round(v*(1.0 if j==0 else .78 if j%2 else .88))))
                n['velocity_norm']=round(n['velocity']/127,4); n['velocity_gain']=round(float(n.get('velocity_gain',1))*(1 if j==0 else .82),4)
                n['detail_pass']='ratchet' if pieces==4 else 'retrigger'
                out.append(n)
            split+=pieces-1
        else: out.append(e)
    style['events']=out
    # Add selective ghost hats/shakers in high-energy categories.
    ghost=0
    if style['category'] in ('action','electronic','urban'):
        drum_inst='hat' if 'hat' in style['instrument_map'] else 'shaker' if 'shaker' in style['instrument_map'] else None
        if drum_inst:
            occupied=[float(e['beat']) for e in style['events'] if e['inst']==drum_inst]
            candidates=[]
            subdivision=.25 if style['bpm']>=165 else .5
            b=0.0
            while b<style['beats']:
                if all(abs(b-x)>.075 for x in occupied) and stable_fraction(style['id'],'ghost',round(b,3))<(.20 if subdivision==.25 else .13): candidates.append(b)
                b+=subdivision
            for b in candidates[:max(4,int(style['bars']*.9))]:
                style['events'].append({'kind':'drum','inst':drum_inst,'beat':round(b,5),'gain':.013,'pan':.18 if int(b*4)%2 else -.18,'send':.03,'role':drum_inst,'accent':.42,'performance_beat':round(b+.006,5),'performance_gain':.72,'performance_pan':.18 if int(b*4)%2 else -.18,'performance_duration':.08,'velocity':43 if drum_inst=='hat' else 39,'velocity_norm':.3386,'velocity_gain':.62,'detail_pass':'ghost_subdivision'})
                ghost+=1
    # Add restrained phrase-end fills using available drums.
    fills=0
    fillinst='tom' if 'tom' in style['instrument_map'] else 'snare' if 'snare' in style['instrument_map'] else None
    if fillinst and style['category'] in ('action','electronic','urban'):
        ends=[]
        for f in style.get('form',[]):
            end=(float(f.get('start_bar',0))+float(f.get('bars',0)))*style['barLength']
            if 0<end<style['beats']-.1:ends.append(end)
        for end in ends:
            if stable_fraction(style['id'],'fill',end)>.72:continue
            for off,vel,pan in [(-.50,62,-.18),(-.25,76,.14),(-.125,88,.28)]:
                b=end+off
                style['events'].append({'kind':'drum','inst':fillinst,'beat':round(b,5),'gain':.023,'pan':pan,'send':.06,'role':fillinst,'accent':vel/80,'performance_beat':round(b+(off%0.25)*.01,5),'performance_gain':.85,'performance_pan':pan,'performance_duration':.10,'velocity':vel,'velocity_norm':round(vel/127,4),'velocity_gain':round((vel/82)**1.1,4),'detail_pass':'phrase_fill'})
                fills+=1
    style['events'].sort(key=lambda e:(float(e.get('performance_beat',e['beat'])),e['inst'],e.get('midi',-1)))
    return {'split_notes':split,'ghost_drums':ghost,'fills':fills}

def main():
    d=json.load(open(SRC)); report=[]
    for style in d['styles']:
        byinst={}
        for e in style['events']:byinst.setdefault(e['inst'],[]).append(e)
        for inst,info in style['instrument_map'].items():
            if inst in ('bass','sub','contrabass','slap_bass'):
                set_sample(info,choose_bass_sample(style,inst,byinst.get(inst,[])))
            elif inst=='kick' and style['category'] in ('action','electronic','urban'):
                set_sample(info,'kick_punch')
            elif inst=='snare' and style['category'] in ('action','electronic','urban'):
                set_sample(info,'snare_body')
            info['mix_trim_db']=INST_TRIMS.get(inst,0.0)
        for e in style['events']:
            inst=e['inst']; boost=DRUM_VEL_BOOST.get(inst,0)
            if boost:
                e['velocity']=max(1,min(127,int(e.get('velocity',72)+boost)))
                e['velocity_norm']=round(e['velocity']/127,4)
                e['velocity_gain']=round(float(e.get('velocity_gain',1))*10**((boost*.06)/20),4)
            if inst in ('horn','brass','trumpet','trombone','synth_lead','pulse25','pulse50'):
                e['velocity']=max(1,min(127,int(e.get('velocity',78)-3)))
                e['velocity_norm']=round(e['velocity']/127,4)
        detail=enrich_fast(style)
        style['mix_v3']={
            'version':'2.2','target_lufs':style['mix_v2']['target_lufs'],'true_peak_dbfs':-1.0,
            'master_default_db':-3.0,'ceiling_default_dbfs':-1.0,'bpm_rate_range':[.60,1.50],
            'bass_family_assignment':True,'instrument_specific_trims':True,'parallel_drum_bus':True,
            'lead_priority_automation':True,'kick_bass_duck_db':1.4 if style['category'] in ('action','electronic','urban') else .5,
            'fast_detail_pass':detail,
        }
        style['harness_defaults']={
            'density':round(min(1,len(style['events'])/max(1,style['beats']*8)),3),
            'timing_depth':.26 if style['category'] in ('urban','towns','emotion') else .15,
            'dynamics_depth':.42 if style['category'] in ('classical','emotion','urban') else .30,
            'articulation':.52,'pattern_bias':.50,'morphing':.24,
            'progression_source':'composition chord_plan','tempo_center_bpm':style['bpm']
        }
        report.append({'id':style['id'],'bpm':style['bpm'],**detail})
    d['version']='3.2.0';d['project']='Neo-SPC 100 / Performance Workstation Pass'
    d['sample_bank_version']='1.1.0';d['mix_engine']={'version':'2.2','features':['dedicated bass families','instrument-specific source trims','parallel drum presence','native playback controls','velocity-separated MIDI expression','fast-tempo detail pass']}
    OUT.write_text(json.dumps(d,indent=2))
    Path('/mnt/data/neospc_work/fast-detail-report-v2.2.json').write_text(json.dumps(report,indent=2))
    print(OUT,OUT.stat().st_size,'detail additions',sum(x['split_notes']+x['ghost_drums']+x['fills'] for x in report))
if __name__=='__main__':main()
