"""Four explicit instrumental writing grammars for the Studio genre expansion.
No source songs or sampled drum breaks are used. Percussion is synthesized.
"""
import copy,math
import generate_neospc100_v3 as core
VERSION="1.0.0"
GENRES={"bachata","trip_hop","trap","reggaeton"}

def compose(spec,category,label):
    from phrase_composer import compose as phrase,fit
    w=spec["writing"];genre=w["grammar"]
    if genre not in GENRES:raise ValueError("Unsupported genre grammar")
    if spec['meter']!='4/4':raise ValueError('These genre blueprints use a four-quarter bar')
    # The explicit subject and harmony planner are shared; every accompaniment is replaced.
    reduction=copy.deepcopy(spec);reduction['writing']['grammar']='arp';reduction['writing']['percussion']=False
    reduction['writing']['answer_role']=None
    score=phrase(reduction,category,label)
    lead,harmony,bass=w['roles'];events=[e for e in score['events'] if e['role']=='lead']
    bl=4;total=score['beats'];v=w['variant'];chords=score['chord_plan'];sections=score['form'];bps=spec['bpm']/60
    swing=w.get('swing',0);bass_steps=w['bass_pattern'];harmony_steps=w['comp_pattern'];kicks=w['kick_pattern']
    def place(beat,lane):
        barpos=beat%4
        if genre=='trip_hop' and abs(barpos*2-round(barpos*2))<1e-5 and round(barpos*2)%2:
            beat+=swing*.5
        delay_ms=16 if genre=='trip_hop' and lane in ('snare','rim') else -3 if genre=='bachata' and lane==harmony else 0
        return round(max(0,min(total-.002,beat+delay_ms*bps/1000)),5)
    def note(lane,pitch,beat,dur,role,vel=80,pan=0):
        if beat>=total:return
        pitch=fit(pitch,lane);dur=min(dur,total-beat)
        event=core.event_note(lane,pitch,beat,dur,.05 if role=='lead' else .028,pan,.08,role,velocity=vel)
        event.update(velocity_norm=round(vel/127,4),velocity_gain=round((vel/100)**1.3,4),performance_beat=place(beat,lane),performance_duration=round(dur*.93,5),attack=.004,release=.10 if genre in ('trap','reggaeton') else .16)
        events.append(event);return event
    def drum(lane,beat,vel=80,pan=0,midi=None,cents=0):
        if beat>=total:return
        event=core.event_drum(lane,beat,.047,pan,.025,velocity=vel)
        event.update(velocity_norm=round(vel/127,4),velocity_gain=round((vel/100)**1.3,4),performance_beat=place(beat,lane))
        if midi is not None:event['midi']=midi
        if cents:event['tuning_cents']=cents
        events.append(event)
    for e in events:
        e['performance_beat']=place(e['beat'],lead)
        e['velocity']=max(55,e['velocity']-(7 if genre=='trip_hop' else 0))
        e['velocity_gain']=round((e['velocity']/100)**1.3,4)
    # A hook stays recognizable while verses/breaks make foreground room.
    drop_bars=set(w['drop_bars'])
    events[:]=[e for e in events if int(e['beat']//4) not in drop_bars]
    for sec in sections:
        start=sec['start_bar'];length=sec['bars'];contrast=sec['name']=='B'
        for j in range(length):
            bar=start+j;off=bar*4;closing=j==length-1;root=chords[bar]['root_pc'];pcs=chords[bar]['pcs'];thin=bar in drop_bars or (contrast and j%2==1)
            # Open voicings keep bass separate; seventh colors are intentional in trip hop.
            center=56 if genre!='bachata' else 60
            voiced=sorted(min((n for n in range(center-7,center+13) if n%12==pc),key=lambda n:abs(n-center)) for pc in pcs)
            if len(voiced)>3 and genre!='trip_hop':voiced=voiced[:3]
            if genre=='bachata':
                for k,pos in enumerate(harmony_steps):
                    if thin and k%2:continue
                    pitches=voiced[-2:] if k%2 else voiced[:2]
                    for st,pitch in enumerate(pitches):note(harmony,pitch,off+pos+st*.018,.20,'comp',62+9*(k%2),-.25)
                for k,pos in enumerate(bass_steps):
                    next_pos=bass_steps[k+1] if k+1<len(bass_steps) else 4
                    note(bass,36+root+(7 if k==1 else 0),off+pos,min(.75,next_pos-pos-.04),'bass',83 if k==0 else 76)
                # Two bongo pitches and a synthetic scraper; no four-on-floor kick.
                for k,pos in enumerate((0,.5,1,1.5,2,2.5,3,3.5)):
                    if thin and k%2:continue
                    low=k in (3,7);drum('tom',off+pos,72 if low else 51+(k%3)*6,.16,61 if low else 60,0 if low else 500)
                    drum('shaker',off+pos,61 if k%2==0 else 43,-.30)
                if not thin and closing:
                    for k in range(3):drum('tom',off+3.5+k/6,68+k*5,.16,60,500)
            elif genre=='trip_hop':
                if j%2==0 or chords[bar]['symbol']!=chords[bar-1]['symbol']:
                    hold=5.9 if not closing and bar+1<len(chords) and chords[bar+1]['symbol']==chords[bar]['symbol'] else 3.65
                    for pitch in voiced:note(harmony,pitch,off+.125,hold,'support',61,-.28)
                for k,pos in enumerate(bass_steps):note(bass,36+root+(7 if k%3==2 else 0),off+pos,1.1 if k==0 else .55,'bass',87-6*(k%2))
                if not thin:
                    for pos in kicks:drum('kick',off+pos,91 if pos==0 else 73)
                    for pos in (1,3):drum('snare',off+pos,87 if pos==3 else 80)
                    if bar%2:drum('snare',off+2.75,36)
                    for k in range(8):
                        if (k+v)%8==6:continue
                        drum('hat',off+k*.5,52 if k%2==0 else 37,.22)
                    if closing:drum('open_hat',off+3.5,47,.18)
            elif genre=='trap':
                if j%2==0:
                    for pitch in voiced[-2:]:note(harmony,pitch+12,off+.25,2.5,'support',51,-.25)
                for k,pos in enumerate(bass_steps):
                    next_pos=bass_steps[k+1] if k+1<len(bass_steps) else 4
                    pitch=24+root+(12 if closing and k==len(bass_steps)-1 else 0)
                    note(bass,pitch,off+pos,max(.1,next_pos-pos-.08),'bass',96-8*(k%2))
                if not thin:
                    for pos in kicks:drum('kick',off+pos,96 if pos==0 else 81)
                    drum('snare',off+2,94) # half-time backbeat at beat three
                    for k in range(8):
                        if k==7 and bar%2:continue
                        drum('hat',off+k*.5,54 if k%2==0 else 39,.18)
                    if bar%2:
                        division=3 if v%2 else 4
                        for k in range(division):drum('hat',off+3.5+k*.5/division,64-k*6,(-.12 if k%2 else .18))
                    if closing:drum('open_hat',off+1.5,61,-.13)
            else:
                for k,pos in enumerate(harmony_steps):
                    if thin and k>0:continue
                    for pitch in voiced[-2:]:note(harmony,pitch,off+pos,.25 if not contrast else .48,'comp',65,-.24)
                for k,pos in enumerate(bass_steps):note(bass,36+root+(7 if v%3==1 and k==2 else 0),off+pos,.65 if k==0 else .35,'bass',91-k*3)
                if not thin:
                    for pos in kicks:drum('kick',off+pos,95 if pos in (0,2) else 72)
                    # Two-beat dembow cells: kick on pulse, snare anticipates and answers.
                    for pos in (.75,1.5,2.75,3.5):drum('snare',off+pos,84 if pos%2==1.5 else 77)
                    for k in range(8):drum('hat',off+k*.5,47 if k%2 else 58,.20)
                    if v%2:drum('rim',off+3.75,52,-.18)
                    if closing and v%3==0:
                        for pos in (3.5,3.75):drum('tom',off+pos,64,.25)
    # Requinto responses use the authored answer and short diatonic ornaments.
    if genre=='bachata':
        scale=core.MODES[spec['mode']];tonic=core.NOTE_PC[spec['key']]
        for sec in sections:
            bar=sec['start_bar']+sec['bars']-1
            for k,d in enumerate(w['answer'][-4:]):
                pitch=60+tonic+scale[d%len(scale)]+12*(d//len(scale))
                note(lead,pitch,bar*4+2+k*.375,.28,'lead',76+k*3,.15)
    for e in events:
        if e['kind']=='note':
            e['duration']=min(e['duration'],total-e['beat'])
            if 'performance_duration' in e:e['performance_duration']=min(e['performance_duration'],total-e.get('performance_beat',e['beat']))
    events.sort(key=lambda e:(e['beat'],e.get('midi',0)))
    score['events']=events;score['arrangement_rests']=core.apply_written_rests(events,spec,4)
    for e in events:
        if e['kind']=='note' and 'performance_duration' in e:
            e['performance_duration']=min(e['performance_duration'],e['duration'],total-e.get('performance_beat',e['beat']))
    used=list(dict.fromkeys(e['inst'] for e in events))
    score['instrument_map']={x:{'sample':core.INSTRUMENTS[x][0].replace('.wav',''),'file':core.INSTRUMENTS[x][0],'root_midi':core.INSTRUMENTS[x][1],'label':x.replace('_',' ').title(),'color':core.INSTRUMENTS[x][2],'family':core.INSTRUMENTS[x][4]} for x in used}
    if genre=='bachata':
        score['instrument_map']['guitar']['label']='Requinto · synth'
        score['instrument_map']['muted_guitar']['label']='Segunda · synth'
        score['instrument_map']['tom']['label']='Bongos · synth'
        score['instrument_map']['shaker']['label']='Scraper · synth'
    score['writing_evidence'].update(engine='genre-composer-'+VERSION,grammar=genre,drop_bars=sorted(drop_bars),variant=v,swing=swing)
    score['dna'].update(texture=genre,texture_b=genre+' breakdown',bass=genre+' bass',drums=genre+' percussion')
    score['measured_peak_voices']=core.peak_polyphony(events,total)
    score['mix_v3'].update(target_lufs=-17 if genre in ('bachata','trip_hop') else -16,lead_duck_db=.7,kick_bass_duck_db=1.2)
    score['mix'].update(echo_time=.28 if genre=='trip_hop' else .16,echo_feedback=.22 if genre=='trip_hop' else .10)
    return score
