"""Replace the old catalog writing contracts with explicit phrase blueprints."""
import copy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];path=ROOT/"game-music-composer/data/catalog-contracts-r03.json"
# One independently specified eight-note subject per catalog slot. Scale degrees, not MIDI.
SUBJECTS=[
"0 2 4 3 1 2 5 4;4 5 7 6 4 2 3 1;0 0 3 2 4 3 1 2;2 4 5 3 1 0 2 4;4 7 6 4 5 3 2 4;0 1 4 2 1 3 2 0;5 4 1 2 4 3 0 1;0 3 2 6 5 3 1 2;2 1 4 3 0 2 1 -1;4 2 0 1 3 2 4 7",
"0 0 4 3 0 2 1 0;0 4 5 4 1 0 3 2;2 4 2 5 3 4 1 2;0 2 3 0 4 3 1 0;0 -1 0 3 2 0 1 4;4 6 7 4 2 3 5 4;0 1 0 4 3 1 2 0;2 4 5 7 6 4 3 2;0 3 4 0 2 1 -1 0;4 3 0 2 5 4 1 0",
"0 1 0 -1 3 2 1 0;0 3 1 0 -1 1 2 0;0 1 4 1 2 -1 0 1;0 2 5 4 1 3 6 2;4 1 2 0 3 1 -1 0;2 0 1 4 3 0 -1 1;0 1 0 2 1 4 3 1;4 2 1 3 0 1 -1 0;0 -2 1 0 3 -1 2 0;0 4 1 5 2 3 0 1",
"2 4 3 1 0 2 1 0;0 2 4 2 5 4 3 1;4 2 3 5 4 1 2 0;0 4 2 3 5 4 1 2;2 1 4 3 5 2 1 0;4 3 1 0 2 4 3 2;0 2 5 4 3 5 2 1;0 0 2 4 3 1 4 2;2 4 6 5 3 2 1 3;4 5 4 2 0 1 3 2",
"4 3 1 2 0 -1 1 0;0 2 3 5 4 2 1 3;2 4 3 0 1 3 2 0;4 2 5 3 2 1 4 3;5 3 2 0 1 -1 0 2;2 1 0 3 2 4 1 0;0 -1 2 1 3 0 -2 0;0 3 4 2 5 4 2 1;3 1 4 2 0 2 -1 1;4 5 3 2 4 2 1 0",
"2 3 1 4 2 0 -1 1;0 2 1 3 2 4 3 5;4 2 5 3 1 2 0 4;0 3 1 4 2 5 1 0;2 0 3 1 4 2 1 0;0 2 1 -1 3 2 4 1;0 4 2 1 3 0 2 -1;4 6 3 5 2 4 1 3;0 1 3 2 4 1 0 -1;2 5 1 4 0 3 2 1",
"0 2 1 4 3 2 0 1;4 5 2 4 1 3 2 0;0 4 3 5 2 4 1 0;2 4 7 5 3 4 2 1;0 1 3 0 4 2 1 -1;4 2 5 4 6 3 2 1;0 3 2 4 1 2 3 0;0 -1 3 2 4 1 0 2;2 5 4 1 3 0 2 4;0 4 2 6 3 5 1 2",
"0 4 2 5 4 7 3 2;0 0 3 0 4 1 0 2;2 0 4 1 5 3 2 4;4 6 5 2 3 1 4 2;0 3 5 2 4 1 2 0;0 2 0 4 3 0 5 2;0 2 4 1 3 5 2 0;4 0 3 2 5 1 4 2;2 4 3 6 5 2 0 1;0 1 4 0 3 2 5 1",
"2 4 1 3 5 2 0 1;4 3 5 2 4 1 3 0;0 2 4 6 5 3 4 2;0 2 0 3 4 1 2 0;2 4 3 5 1 2 4 0;4 2 6 3 5 1 2 0;0 2 1 4 2 5 3 0;0 3 2 0 4 1 3 2;4 2 4 5 3 1 2 0;0 1 4 3 2 5 1 0",
"0 1 2 4 3 2 1 -1;0 4 3 2 1 2 0 -1;2 4 5 3 4 1 2 0;0 0 4 2 3 1 2 0;0 2 3 1 4 2 5 3;4 3 2 5 1 3 0 2;2 5 4 6 3 4 1 2;0 2 1 4 2 5 3 1;0 1 3 5 2 4 1 0;0 4 5 2 3 6 4 2"]
GRAMMARS=[
"jig arp funk waltz arp tango field chorale arp jig",
"drive drive breaks tango techno drive breaks techno drive breaks",
"field chorale minimal field field chorale breaks waltz field minimal",
"waltz jig funk chorale tango waltz jig funk bossa ska",
"chorale arp waltz arp chorale arp chorale drive field arp",
"swing minimal arp minimal invention funk minimal field drive minimal",
"chorale jig chorale arp tango jig chorale drive arp chorale",
"drive techno breaks field funk techno minimal breaks arp techno",
"swing swing walking funk funk bossa ska dub ska tango",
"invention invention waltz drive minimal chorale arp invention field chorale"]
HARMONIES=[['I','vi','IV','V'],['i','bVI','iv','V'],['i','bII','i','V'],['I','IV','ii','V'],['i','iv','bVI','V'],['i','iv','iiø7','V7'],['I','IV','vi','V'],['i','bVI','bVII','V'],['ii7','V7','Imaj7','VI7'],['I','vi','ii','V']]
RHYTHMS={"jig":[[0,1/6,.5,2/3],[0,1/3,.5,5/6]],"waltz":[[0,1/3,.5,2/3],[0,.5,2/3,5/6]],"swing":[[0,1/6,.5,2/3],[1/6,1/3,.666,.833]],"bossa":[[0,.375,.5,.75],[.125,.375,.625,.75]],"tango":[[0,.375,.5,.75],[0,.25,.625,.75]],"field":[[0,.625],[.25,.70]],"chorale":[[0,.5],[0,.375,.625]],"minimal":[[0,.25,.5,.625],[.125,.375,.5,.75]],"invention":[[0,.25,.5,.75],[0,.125,.375,.625]],"funk":[[0,.1875,.5,.6875],[.125,.375,.625,.8125]],"breaks":[[0,.1875,.375,.75],[.125,.4375,.625,.8125]],"techno":[[0,.25,.5,.75],[.125,.375,.5,.875]],"drive":[[0,.25,.375,.75],[0,.375,.625,.75]],"arp":[[0,.25,.5,.75],[0,.375,.5,.75]],"dub":[[0,.375,.625],[.125,.5,.75]],"ska":[[.125,.375,.625,.875],[0,.375,.625,.875]],"walking":[[0,.1667,.5,.6667],[0,.3333,.5,.8333]]}

def main():
    doc=json.loads(path.read_text());backup=ROOT/".scratch/contracts-before-phrase-writing.json"
    if not backup.exists():backup.write_text(json.dumps(doc),encoding="utf-8")
    for n,r in enumerate(doc["contracts"]):
        c,j=divmod(n,10);s=r["native_engine_contract"];before=copy.deepcopy(s);g=GRAMMARS[c].split()[j]
        cell=list(map(int,SUBJECTS[c].split(";")[j].split()))
        # A related answer changes direction and destination; it does not merely invert A.
        answer=[cell[4],cell[5],cell[7],cell[6],cell[2]+1,cell[3],1,0]
        palette="circuit" if c in (1,7) else "velvet" if c in (2,5,8) else "factory"
        lead=s["lead"]
        if lead in ("ocarina","pulse25","pulse50") and c not in (1,7):lead="flute" if c==0 else "piano"
        harmony="guitar" if g in ("jig","bossa","tango","ska") else "harpsichord" if g=="invention" else "piano" if g not in ("field","chorale") else "strings"
        bass="synth_bass" if palette=="circuit" else "bass"
        if c==8 and j==4:lead="vibes"
        spans=[4,4,4,4] if j%3==0 else [4,4,6,4] if j%3==1 else [3,3,4,4]
        s["bars"]=sum(spans);s["budget"]=12
        # Preserve scene names and stable links, discard all previously written notes.
        if g=="jig":s["meter"]="6/8"
        elif g=="waltz":s["meter"]="3/4"
        elif g in ("funk","swing","bossa","dub","ska","techno","breaks","walking"):s["meter"]="4/4"
        s["bpm"]=max(58,min(168,s["bpm"]-4+(j%3)*3))
        major=c in (0,3,6,9) and j not in (5,7,8)
        if c==8:s["mode"]="major" if j in (1,5,8) else "dorian"
        elif c not in (2,5,7):s["mode"]="major" if major else "minor"
        progression=HARMONIES[c]
        if c in (0,3,6,9) and not major:progression=['i','bVI','iv','V']
        if c==8 and j>=3:progression=['i7','iv7','bVII','V7'] if s['mode']!='major' else ['Imaj7','vi7','ii7','V7']
        s["lead"]=lead;s["form"]=[{"name":name,"bars":bars,"function":purpose,"intensity":intensity} for name,bars,purpose,intensity in zip(['A','A2','B','A3'],spans,['State the subject; leave its question open.','Answer and extend the subject.','Change foreground rhythm and harmonic destination.','Return to the subject with a settled cadence.'],[.56,.67,.48,.58])]
        s['phrases']=[{'bars':b,'kind':'consequent' if i%2 else 'antecedent','closing':bool(i%2)} for i,b in enumerate(spans)]
        s["comp"]=g;s["comp_b"]=g+"_reduced";s["architecture"]="period"
        s["notes"]=r["musical_direction"]+" A written subject returns after a separate answer; "+g+" accompaniment leaves the phrase endings open."
        s["writing"]={"version":"1.0.0","degrees":cell,"answer":answer,"rhythm":RHYTHMS[g],"grammar":g,"roles":[lead,harmony,bass],"harmony":progression,"contrast_harmony":['iv','i','bVI','V'] if s['mode'] in ('minor','dorian','phrygian','harmonic_minor') else ['vi','ii','IV','V'],"bass_onsets":[0,.375,.625] if j%2 else [0,.1875,.5,.8125],"percussion":g not in ('chorale','field','invention','arp','minimal'),"palette":palette,"answer_role":"flute" if lead!='flute' and c in (0,3,6) else None}
        if c==9 and j==4:s['writing']['phase_step']=1/24
        s['loop_strategy']='The last phrase settles on the home harmony; its foreground releases before the next opening attack.'
        # Tonic at the final return; the preceding bar keeps dominant motion.
        start=sum(spans[:-1]);s['writing']['return_harmony']=['I' if s['mode']=='major' else 'i']
        s["role_rests"]=[{"start_bar":sum(spans[:k+1])-.25,"end_bar":sum(spans[:k+1]),"roles":["lead","comp","arp","support","counter"],"purpose":"Written breathing space at the cadence."} for k in range(4)]
        r.update(revision="phrase-blueprints-1",status="implemented; listening pending",protected_identity={"title":s['title'],"stable_link":r['id'],"scope":"Scene identity only; all written music replaced."})
        r['changes']={k:{'before':before.get(k),'after':s[k]} for k in ('writing','bars','form','phrases','role_rests','comp','comp_b','lead','mode','bpm','budget')}
        r['listening_checks']=['Can the subject be recalled after one loop?','Does the answer change direction without sounding unrelated?','Are rests and bass motion audible without pads?','Does the assigned palette serve this scene?']
    doc.update(version="2.0.0",revision="phrase-blueprints-1")
    path.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
if __name__=="__main__":main()
