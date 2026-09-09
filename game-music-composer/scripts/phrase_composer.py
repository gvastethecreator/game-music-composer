"""Phrase-first writing from explicit score blueprints, without ensemble filling.
The contract owns every pitch cell, groove, harmony destination and role.
This is a finite writing grammar, not a model of an entire musical tradition.
"""
from itertools import product
import generate_neospc100_v3 as core
VERSION="1.0.0"

def fit(note,lane):
    lo,hi=core.INSTRUMENTS[lane][3]
    candidates=[note+12*k for k in range(-8,9) if lo<=note+12*k<=hi]
    if not candidates:raise ValueError((lane,note,"unplayable pitch class"))
    return min(candidates,key=lambda n:abs(n-note))

def compose(spec,category,label):
    w=spec["writing"]
    required={"degrees","answer","rhythm","grammar","roles","harmony","contrast_harmony","bass_onsets","percussion","palette"}
    if required-set(w):raise ValueError("Incomplete score blueprint: "+str(sorted(required-set(w))))
    grammars={"jig","waltz","swing","walking","bossa","tango","field","chorale","minimal","invention","funk","breaks","techno","drive","arp","dub","ska"}
    if w["grammar"] not in grammars:raise ValueError("Unknown writing grammar")
    if any(len(w[k])!=8 or any(not isinstance(n,int) for n in w[k]) for k in ("degrees","answer")):raise ValueError("Write eight integer scale degrees for subject and answer")
    if len(w["roles"])!=3 or any(lane not in core.INSTRUMENTS for lane in w["roles"]):raise ValueError("Declare three supported instrument roles")
    if not w["rhythm"] or any(not row or row!=sorted(set(row)) or any(not 0<=x<1 for x in row) for row in w["rhythm"]):raise ValueError("Rhythm onsets must increase within one bar")
    bl=core.METERS[spec["meter"]];total=bl*spec["bars"]
    scale=core.MODES[spec["mode"]];tonic=core.NOTE_PC[spec["key"]]
    degree=lambda d:tonic+scale[d%len(scale)]+12*(d//len(scale))
    lead,harmony,bass=w["roles"];cell=w["degrees"];answer=w["answer"]
    rhythm=w["rhythm"];grammar=w["grammar"];events=[];sections=core.form_sections(spec)
    chords=[];previous=None
    # A chord is a destination and voicing, not a fresh random stack each bar.
    for section in sections:
        progression=w["contrast_harmony"] if section["name"]=="B" else w["harmony"]
        for j in range(section["bars"]):
            index=min(len(progression)-1,int(j*len(progression)/section["bars"]))
            symbol=progression[index]
            if section is sections[-1] and j==section["bars"]-1:symbol="I" if spec["mode"] in ("major","lydian","mixolydian","pentatonic_major") else "i"
            chord=core.parse_chord(symbol,tonic)
            chords.append(chord)
    def note(lane,pitch,beat,dur,role,vel=82,pan=0):
        if beat>=total or dur<=0:return
        pitch=fit(pitch,lane)
        e=core.event_note(lane,pitch,beat,min(dur,total-beat),.048 if role=="lead" else .026,pan,.08,role,velocity=vel,velocity_norm=vel/127,velocity_gain=(vel/100)**1.35)
        e["attack"]=.045 if core.INSTRUMENTS[lane][4] in ("wind","strings","brass") else .004
        e["release"]=.12 if grammar in ("drive","breaks","funk","techno") else .23
        events.append(e)
    def drum(lane,beat,vel=80):
        if beat<total:events.append(core.event_drum(lane,beat,.045, .22 if lane=="hat" else 0, .035,velocity=vel,velocity_norm=vel/127,velocity_gain=(vel/100)**1.35))
    phrase_evidence=[]
    for si,section in enumerate(sections):
        start=section["start_bar"];bars=section["bars"];contrast=section["name"]=="B"
        material=answer if contrast else cell
        # The final return preserves its opening but broadens its last gesture.
        for j in range(bars):
            bar=start+j;offset=bar*bl;chord=chords[bar];pcs=chord["pcs"]
            closing=j==bars-1;response=j%4>=2
            center=72 if core.INSTRUMENTS[lead][3][1]>=80 else 60
            if core.INSTRUMENTS[lead][4]=="bass":center=36
            while center+max(degree(d) for d in material)>core.INSTRUMENTS[lead][3][1]:center-=12
            degrees=material[(j%2)*4:(j%2)*4+4]
            if len(degrees)<4:degrees=material[:4]
            # Continuing bars sequence only the middle of the phrase; returns stay recognizable.
            shift=1 if response and not closing and si==1 else 0
            positions=rhythm[j%len(rhythm)]
            for k,pos in enumerate(positions):
                if closing and pos>.48:continue
                d=degrees[k%len(degrees)]+shift
                if closing:d=0 if si==len(sections)-1 else (4 if si==0 else 2)
                pitch=center+degree(d)
                # Phrase arrivals resolve to the planned chord. Passing notes keep their contour.
                if k==0 or closing:
                    opts=[n for n in range(pitch-4,pitch+5) if n%12 in pcs]
                    pitch=min(opts,key=lambda n:abs(n-pitch))
                end=positions[k+1] if k+1<len(positions) else (.82 if not closing else .73)
                duration=max(.12,(end-pos)*bl*((.94 if k==0 else .72) if grammar not in ("chorale","field") else .97))
                if closing:duration=bl*.52
                note(lead,pitch,offset+pos*bl,duration,"lead",int(65+18*(1-abs(j/max(1,bars-1)*2-1))+9*(k==0)+8*(si==1)-5*closing))
                if closing:break
            # Sparse answer in a real melodic gap, never continuously doubling.
            if closing and w.get("answer_role"):
                lane=w["answer_role"]
                for k,d in enumerate(material[-2:]):note(lane,60+degree(d),offset+bl*(.76+k*.11),bl*.09,"counter",63, .23)
            root=36+chord["root_pc"]
            if grammar in ("swing","walking"):
                nextroot=36+chords[(bar+1)%len(chords)]["root_pc"]
                pitches=[root,root+4 if (root+4)%12 in pcs else root+3,root+7,nextroot-1]
                for k,p in enumerate(pitches):note(bass,p,offset+k*bl/4,bl*.21,"bass",77+(k%2)*4,-.04)
            elif grammar in ("funk","breaks","tango"):
                for k,pos in enumerate(w["bass_onsets"]):note(bass,root+(7 if k%3==2 else 0),offset+pos*bl,bl*.115,"bass",88 if k==0 else 73)
            elif grammar=="dub":
                for k,pos in enumerate((.0,.375,.625)):note(bass,root+(7 if k==1 else 0),offset+pos*bl,bl*.21,"bass",84)
            elif grammar=="field":
                if j%2==0:note(bass,root,offset,min(bl*1.7,(bars-j)*bl-.2),"bass",63)
            else:
                for k,pos in enumerate((0,.5) if grammar not in ("chorale","minimal") else (0,)):
                    note(bass,root+(7 if k else 0),offset+pos*bl,bl*(.40 if k else .43),"bass",78-7*k)
            if (si==0 and j==0) or (contrast and j%2==1):continue
            # Choose nearest legal inversion to the previous voicing. Keep below the melody.
            chordpcs=sorted(pcs);candidates=[]
            for combo in product(*[[n for n in range(48,72) if n%12==pc] for pc in chordpcs[:3]]):
                v=sorted(combo)
                if len(set(v))==3 and v[-1]-v[0]<=16:candidates.append(v)
            target=previous or [52,57,64]
            voiced=min(candidates,key=lambda v:sum(abs(a-b) for a,b in zip(v,target))) if candidates else [48+pc for pc in chordpcs[:3]]
            previous=voiced
            if grammar in ("waltz","jig"):
                positions=(1/3,2/3) if grammar=="waltz" else (0,.5)
                for pos in positions:
                    for pitch in voiced[1:]:note(harmony,pitch,offset+pos*bl,bl*.20,"comp",65,-.24)
            elif grammar in ("arp","minimal","invention"):
                pattern=(0,2,1,2) if grammar=="arp" else (0,1,2,1,0,2)
                for k,index in enumerate(pattern):
                    if contrast and k%2:continue
                    note(harmony,voiced[index],offset+((k*bl/len(pattern)+(bar%4)*bl*w.get("phase_step",0)) % bl if w.get("phase_step") else k*bl/len(pattern)),bl/len(pattern)*.78,"arp",64+8*(k==0),-.22)
            elif grammar in ("funk","dub","ska","bossa","swing","tango","techno","breaks","drive"):
                patterns={"funk":(.1875,.625,.875),"dub":(.25,.75),"ska":(.125,.375,.625,.875),"bossa":(0,.375,.625),"swing":(.333,.75),"tango":(0,.375,.75),"techno":(.25,.75),"breaks":(.375,.875),"drive":(0,.375,.625)}
                for pos in patterns[grammar]:
                    if closing and pos>.5:continue
                    for pitch in voiced:note(harmony,pitch,offset+pos*bl,bl*.10,"comp",67,-.22)
            else:
                if j%2==0 or chords[bar]["symbol"]!=chords[bar-1]["symbol"]:
                    for pitch in voiced:note(harmony,pitch,offset,bl*.80,"support",59,-.2)
            if w["percussion"] and not (closing and si in (0,len(sections)-1)):
                if grammar in ("techno","ska"):
                    for pos in (0,.25,.5,.75):drum("kick",offset+pos*bl,88)
                elif grammar in ("breaks","funk"):
                    for pos in (0,.375,.6875):drum("kick",offset+pos*bl,88 if pos==0 else 71)
                elif grammar not in ("field","chorale"):drum("kick",offset,75)
                for pos in ((1/3,2/3) if grammar=="waltz" else (.5,) if grammar in ("dub","jig") else (.25,.75)):
                    drum("rim" if grammar in ("bossa","jig","waltz","swing") else "snare",offset+pos*bl,68 if contrast else 79)
                subdiv=12 if grammar=="swing" else 6 if grammar in ("waltz","jig") else 8
                for k in range(subdiv):
                    if grammar=="swing" and k%3==1:continue
                    drum("shaker" if grammar in ("bossa","jig") else "hat",offset+k*bl/subdiv,49+16*(k%2))
        phrase_evidence.append({"section":section["name"],"material":"answer" if contrast else "identity","cadence_bar":start+bars-1,"foreground_rest_fraction":.27})
    rests=core.apply_written_rests(events,spec,bl)
    events.sort(key=lambda e:(e["beat"],e.get("midi",0)))
    used=list(dict.fromkeys(e["inst"] for e in events));imap={x:{"sample":core.INSTRUMENTS[x][0].replace(".wav",""),"file":core.INSTRUMENTS[x][0],"root_midi":core.INSTRUMENTS[x][1],"label":x.replace("_"," ").title(),"color":core.INSTRUMENTS[x][2],"family":core.INSTRUMENTS[x][4]} for x in used}
    return {"id":spec["slug"],"title":spec["title"],"category":category,"category_label":label,"subcategory":spec["subcategory"],"kicker":label.upper(),"description":spec["notes"],"bpm":spec["bpm"],"beats":total,"bars":spec["bars"],"meter":spec["meter"],"barLength":bl,"key":spec["key"],"mode":spec["mode"],"voice_budget":spec["budget"],"measured_peak_voices":core.peak_polyphony(events,total),"form":sections,"chord_plan":[{"bar":i,"symbol":c["symbol"],"root_pc":c["root_pc"],"pcs":sorted(c["pcs"])} for i,c in enumerate(chords)],"events":events,"instrument_map":imap,"tags":spec["tags"],"dna":{"form":" ".join(s["name"] for s in sections),"motif":"written eight-note subject","texture":spec["comp"].replace("_"," "),"texture_b":spec["comp_b"].replace("_"," "),"bass":grammar,"drums":grammar if w["percussion"] else "none"},"musical_direction":{"thesis":spec["notes"],"loop_strategy":spec["loop_strategy"]},"arrangement_rests":rests,"writing_evidence":{"engine":VERSION,"phrases":phrase_evidence,"grammar":grammar,"roles":w["roles"],"cell":cell,"answer":answer},"sound_palette":w["palette"],"metrics":{"energy":spec["energy"],"tension":spec["tension"]},"mix":{"echo_time":.19,"echo_feedback":.10,"drive":0},"mix_v3":{"target_lufs":-17,"true_peak_dbfs":-1.4,"lead_duck_db":.8,"kick_bass_duck_db":.6}}
