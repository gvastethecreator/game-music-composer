#!/usr/bin/env python3
from __future__ import annotations
import argparse
import json, math, random, hashlib, itertools
from pathlib import Path
from collections import defaultdict

NOTE_PC={'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
MODES={
 'major':[0,2,4,5,7,9,11], 'minor':[0,2,3,5,7,8,10], 'dorian':[0,2,3,5,7,9,10],
 'phrygian':[0,1,3,5,7,8,10], 'lydian':[0,2,4,6,7,9,11], 'mixolydian':[0,2,4,5,7,9,10],
 'harmonic_minor':[0,2,3,5,7,8,11], 'melodic_minor':[0,2,3,5,7,9,11],
 'whole_tone':[0,2,4,6,8,10], 'octatonic':[0,2,3,5,6,8,9,11], 'pentatonic_major':[0,2,4,7,9],
 'pentatonic_minor':[0,3,5,7,10]
}
ROMAN_DEG={'I':0,'II':2,'III':4,'IV':5,'V':7,'VI':9,'VII':11}

# Expanded aliases. Multiple aliases may intentionally map to the same compact sample source,
# while retaining independent role, pan, register and performance behavior.
INSTRUMENTS={
 'flute':('wood_flute_A4.wav',69,'#62e9ff',(60,88),'wind'), 'piccolo':('wood_flute_A4.wav',69,'#9ff7ff',(72,96),'wind'),
 'ocarina':('ocarina_A4.wav',69,'#76efbf',(60,84),'wind'), 'reed':('dark_reed_A3.wav',57,'#d5a1ff',(52,77),'wind'),
 'bassoon':('dark_reed_A3.wav',57,'#a889c8',(38,65),'wind'), 'clarinet':('dark_reed_A3.wav',57,'#c4a1ed',(55,82),'wind'),
 'muted_brass':('muted_brass_A3.wav',57,'#d39b72',(48,78),'brass'), 'horn':('muted_brass_A3.wav',57,'#dba66c',(45,75),'brass'), 'trumpet':('snes_brass_A3.wav',57,'#ffd15a',(55,84),'brass'),
 'trombone':('snes_brass_A3.wav',57,'#e8a34f',(40,68),'brass'), 'brass':('snes_brass_A3.wav',57,'#ffbf55',(48,82),'brass'),
 'violin1':('string_ensemble_A3.wav',57,'#c2a4ff',(60,92),'strings'), 'violin2':('string_ensemble_A3.wav',57,'#aa8fff',(55,86),'strings'),
 'viola':('string_ensemble_A3.wav',57,'#917ce0',(48,77),'strings'), 'cello':('string_ensemble_A3.wav',57,'#7869bd',(36,65),'strings'),
 'contrabass':('upright_bass_A2.wav',45,'#bb7048',(28,52),'bass'), 'strings':('string_ensemble_A3.wav',57,'#a889ff',(45,88),'strings'),
 'choir_s':('choir_ah_A3.wav',57,'#ffb3e6',(60,88),'choir'), 'choir_a':('choir_ah_A3.wav',57,'#ef90d8',(55,80),'choir'),
 'choir_t':('choir_ah_A3.wav',57,'#d678bd',(45,72),'choir'), 'choir_b':('choir_ah_A3.wav',57,'#af5c98',(35,60),'choir'),
 'drone':('low_drone_A3.wav',57,'#716a9f',(28,67),'texture'), 'organ':('small_organ_A3.wav',57,'#cbb0ff',(36,84),'keys'),
 'accordion':('accordion_A3.wav',57,'#ffc46d',(45,82),'keys'), 'harp':('harp_A4.wav',69,'#6ed9ff',(48,96),'pluck'),
 'pizz':('pizz_string_A3.wav',57,'#9adf78',(43,84),'pluck'), 'piano':('small_piano_A4.wav',69,'#eadbc2',(36,96),'keys'),
 'prepared_piano':('prepared_piano_A3.wav',57,'#bd9ed7',(40,86),'keys'), 'harpsichord':('harpsichord_A4.wav',69,'#e4c46e',(45,92),'keys'),
 'vibes':('vibraphone_A4.wav',69,'#a5f3ef',(48,92),'mallet'), 'bell':('ritual_bell_A4.wav',69,'#ff8edb',(55,96),'mallet'),
 'guitar':('nylon_guitar_A3.wav',57,'#ffad82',(40,84),'guitar'), 'muted_guitar':('muted_guitar_A3.wav',57,'#e58e6d',(38,78),'guitar'),
 'dist_guitar_l':('distorted_guitar_A2.wav',45,'#ff5f6e',(34,76),'guitar'), 'dist_guitar_r':('distorted_guitar_A2.wav',45,'#ff7b72',(34,76),'guitar'),
 'bass':('upright_bass_A2.wav',45,'#f49a5d',(28,60),'bass'), 'synth_bass':('synth_bass_A2.wav',45,'#ff7043',(24,60),'bass'),
 'slap_bass':('slap_bass_A2.wav',45,'#ffbd59',(28,64),'bass'), 'triangle_bass':('triangle_bass_A3.wav',57,'#ef9d50',(24,60),'bass'),
 'clav':('clav_A4.wav',69,'#79ef93',(45,84),'keys'), 'pulse25':('pulse25_A3.wav',57,'#ff67cf',(42,92),'synth'),
 'pulse50':('pulse50_A3.wav',57,'#bb8cff',(36,88),'synth'), 'synth_pad':('string_ensemble_A3.wav',57,'#8b86d8',(40,88),'synth'),
 'synth_lead':('pulse25_A3.wav',57,'#ff5bbd',(48,92),'synth'), 'sub':('triangle_bass_A3.wav',57,'#e48143',(24,55),'bass'),
 'kick':('kick_deep.wav',36,'#ff4f61',(0,127),'drum'), 'snare':('snare_crisp.wav',38,'#ff8b68',(0,127),'drum'),
 'hat':('hat_short.wav',42,'#dfeaf0',(0,127),'drum'), 'open_hat':('hat_open.wav',46,'#b9d9e6',(0,127),'drum'),
 'tom':('frame_tom.wav',47,'#ff7468',(0,127),'drum'), 'wood':('wood_block.wav',76,'#b99366',(0,127),'drum'),
 'rim':('rim_click.wav',37,'#ffa46b',(0,127),'drum'), 'shaker':('shaker_soft.wav',82,'#d8f27c',(0,127),'drum'),
 'ride':('ride_dark.wav',51,'#c8e7ff',(0,127),'drum'), 'impact':('impact_low.wav',30,'#ff457d',(0,127),'drum'),
 'brush':('brush_swirl.wav',84,'#bfc2c9',(0,127),'drum')
}
DRUMS={'kick','snare','hat','open_hat','tom','wood','rim','shaker','ride','impact','brush'}

CATEGORY_DEFS = [
 ('adventure','Adventure & Exploration'), ('action','Action & Combat'), ('horror','Horror & Suspense'),
 ('towns','Towns & Social'), ('emotion','Emotion & Narrative'), ('mystery','Mystery & Puzzle'),
 ('fantasy','Fantasy & Sacred'), ('electronic','Electronic & Sci-Fi'), ('urban','Jazz, Funk & Urban'),
 ('classical','Classical & Experimental')
]

METERS={'4/4':4.0,'3/4':3.0,'6/8':3.0,'9/8':4.5,'12/8':6.0,'5/4':5.0,'7/8':3.5,'5/8':2.5,'7/4':7.0}

MOTIFS={
 'rising_fourth':([0,3,4,2,1],[0,.75,1.5,2.25,3.0],[.55,.45,.55,.45,.85]),
 'falling_third':([4,2,1,0,2],[0,.5,1.25,2.0,3.0],[.35,.5,.45,.65,.8]),
 'arch':([0,2,4,5,4,2,1],[0,.5,1.0,1.75,2.5,3.0,3.5],[.35,.35,.55,.45,.35,.35,.8]),
 'step_answer':([0,1,2,1,0,-1,0],[0,.75,1.25,2,2.75,3.25,3.5],[.5,.35,.5,.35,.45,.3,.75]),
 'heroic':([0,4,2,5,4,2,0],[0,.75,1.5,2.0,2.75,3.25,3.75],[.55,.45,.35,.5,.35,.4,.9]),
 'sigh':([4,3,2,0,1,0],[0,.75,1.5,2.5,3.0,3.5],[.55,.45,.55,.6,.35,.85]),
 'chromatic_warning':([0,1,0,-1,2,1],[0,1.0,1.5,2.5,3.0,3.5],[.7,.3,.35,.55,.35,.8]),
 'sync_hook':([0,2,4,2,5,4,2,0],[0,.375,.875,1.5,2.0,2.375,3.0,3.5],[.25,.3,.4,.3,.25,.35,.3,.75]),
 'waltz_line':([0,2,4,3,1,0],[0,.75,1.5,2.25,3.0,4.5],[.5,.45,.55,.5,.45,.9]),
 'modal_call':([0,3,1,4,2,1,0],[0,.75,1.5,2.25,3.0,3.75,4.5],[.5,.4,.5,.4,.55,.4,.9]),
 'noir':([0,2,1,4,3,1,0],[0,.67,1.5,2.0,2.67,3.33,4.0],[.38,.42,.35,.55,.38,.45,.9]),
 'mechanical':([0,2,1,3,2,4,1,0],[0,.5,1,1.5,2,2.5,3,3.5],[.3,.3,.3,.3,.3,.3,.3,.6]),
 'chant':([0,0,2,1,0,-1,0],[0,1,2,3,4,5,5.5],[.75,.65,.75,.65,.75,.4,.9]),
 'floating':([0,4,3,5,2,4,0],[0,1.25,2.25,3.75,5.0,6.0,7.0],[.85,.55,.75,.5,.65,.55,1.1]),
 'fugue_subject':([0,1,3,2,4,1,0,2],[0,.5,1,1.5,2,2.75,3.25,3.75],[.4,.4,.55,.4,.6,.35,.35,.75]),
 'minimal_cell':([0,2,1,4],[0,.75,1.5,2.25],[.42,.42,.42,.42]),
 'pentatonic':([0,1,3,2,4,3,1,0],[0,.5,1.0,1.75,2.25,2.75,3.25,3.75],[.35,.35,.5,.35,.4,.35,.4,.8]),
 'tango':([0,3,2,5,4,1,0],[0,.75,1.5,2,2.5,3.25,3.75],[.45,.35,.5,.35,.4,.4,.8]),
 'bebop':([0,2,4,3,5,6,4,2,1,0],[0,.33,.67,1.0,1.33,1.67,2.0,2.33,2.67,3.0],[.25,.25,.25,.25,.25,.25,.25,.25,.25,.7]),
 'lament':([5,4,2,3,1,0],[0,1,1.75,2.75,3.5,4.5],[.7,.45,.6,.45,.6,1.0])
}

PROGRESSIONS={
 'home':['I','V','vi','IV','I','ii','V','I'], 'journey':['I','IV','vi','V','ii','IV','V','I'],
 'minor_drive':['i','bVI','bVII','i','iv','bVI','V','i'], 'dorian':['i','IV','i','bVII','i','IV','bVII','i'],
 'phrygian':['i','bII','i','bVII','i','bII','iv','i'], 'lydian':['I','II','I','V','I','II','IV','I'],
 'mixolydian':['I','bVII','IV','I','vi','bVII','IV','I'], 'noir':['i6','iv7','bIImaj7','V7','i6','bVImaj7','iiø7','V7'],
 'bossa':['Imaj7','vi7','ii7','V7','iii7','VI7','ii7','V7'], 'jazz_turn':['Imaj7','VI7','ii7','V7','iii7','VI7','ii7','V7'],
 'sacred':['I','IV','I','V','vi','IV','V','I'], 'lament':['i','bVII','bVI','V','i','iv','bII','V'],
 'heroic':['I','V','vi','IV','ii','IV','V','I'], 'uncanny':['i','bVI','iv','bII','i','bIII','V','i'],
 'minimal':['i','bVII','i','IV','i','bVII','IV','i'], 'whole':['I','II','III','II','IV','III','II','I'],
 'tango':['i','V7','i','iv','bVI','V7','i','V7'], 'reggae':['I','V','vi','IV','I','bVII','IV','I'],
 'funk':['i7','i7','IV7','i7','bVII7','IV7','i7','V7'], 'baroque':['i','iv','V','i','bVI','iiø7','V','i']
}

# 100 track specifications. The arrangement engine uses these as compositional contracts rather than random prompts.
def S(slug,title,subcategory,bpm,meter,bars,key,mode,budget,prog,motif,lead,comp,bass,drums,form='A A2 B A3',secondary=None,energy=.5,tension=.3,tags=(),notes=''):
    return dict(slug=slug,title=title,subcategory=subcategory,bpm=bpm,meter=meter,bars=bars,key=key,mode=mode,budget=budget,prog=prog,motif=motif,lead=lead,secondary=secondary,comp=comp,bass=bass,drums=drums,form=form,energy=energy,tension=tension,tags=list(tags),notes=notes)

SPECS={
'adventure':[
 S('fernway_crossing','Fernway Crossing','Pastoral Overworld',98,'6/8',16,'G','major',12,'journey','rising_fourth','ocarina','harp_broken','root_fifth','folk_light',secondary='flute',energy=.52,tags=('pastoral','folk')),
 S('summit_lines','Summit Lines','Mountain Ascent',116,'7/8',16,'D','mixolydian',16,'mixolydian','heroic','flute','pizz_ostinato','melodic','martial_light',secondary='horn',energy=.72,tags=('mountain','odd-meter')),
 S('emerald_canopy','Emerald Canopy','Jungle Exploration',104,'9/8',16,'A','dorian',16,'dorian','modal_call','flute','marimba_like','pedal_walk','tribal',secondary='ocarina',energy=.58,tags=('jungle','modal')),
 S('wake_of_amber','Wake of Amber','Sea Voyage',92,'6/8',20,'E','mixolydian',20,'mixolydian','floating','flute','harp_wave','root_fifth','sea',secondary='strings',energy=.48,tags=('ocean','travel')),
 S('isles_above','Isles Above','Sky Islands',110,'4/4',16,'C','lydian',20,'lydian','arch','flute','pulse_sparse','pedal_walk','air',secondary='trumpet',energy=.63,tags=('sky','lydian')),
 S('saffron_miles','Saffron Miles','Desert Caravan',106,'5/4',16,'D','phrygian',16,'phrygian','modal_call','reed','guitar_pattern','melodic','frame',secondary='flute',energy=.57,tension=.35,tags=('desert','caravan')),
 S('under_ice_lantern','Under-Ice Lantern','Frozen Cavern',76,'4/4',18,'F#','dorian',18,'dorian','floating','vibes','harp_sparse','pedal','ambient_sparse',secondary='flute',energy=.3,tags=('ice','cavern')),
 S('archive_of_roots','Archive of Roots','Ancient Ruins',84,'5/4',16,'C','minor',18,'lament','chant','reed','organ_pedal','pedal_walk','ritual_light',secondary='choir_a',energy=.38,tension=.5,tags=('ruins','ancient')),
 S('river_below','River Below','Underground River',88,'12/8',12,'Bb','dorian',16,'dorian','floating','flute','harp_wave','melodic','water',secondary='vibes',energy=.4,tags=('underground','water')),
 S('lanterns_homeward','Lanterns Homeward','Homecoming Journey',102,'6/8',20,'E','major',24,'home','rising_fourth','flute','orchestral_broken','melodic','orchestral_light',secondary='horn',energy=.68,tags=('homecoming','orchestral')),
],
'action':[
 S('iron_pulse','Iron Pulse','Standard Battle',154,'4/4',16,'E','minor',16,'minor_drive','sync_hook','synth_lead','guitar_riff','ostinato','rock',secondary='brass',energy=.9,tension=.72,tags=('battle','rock')),
 S('crown_breaker','Crown Breaker','Boss Battle',132,'12/8',12,'D','harmonic_minor',32,'baroque','heroic','brass','orchestral_tremolo','pedal_walk','boss',secondary='choir_s',energy=.96,tension=.88,tags=('boss','orchestral')),
 S('redline_pursuit','Redline Pursuit','Chase',176,'4/4',16,'F#','minor',18,'minor_drive','sync_hook','pulse25','breakbeat_pulse','ostinato','dnb',secondary='dist_guitar_l',energy=.97,tension=.82,tags=('chase','dnb')),
 S('two_blades','Two Blades','Martial Duel',124,'7/8',16,'A','dorian',14,'dorian','tango','reed','pizz_stabs','melodic','duel',secondary='horn',energy=.72,tension=.68,tags=('duel','martial')),
 S('slag_foundry','Slag Foundry','Industrial Assault',148,'5/4',16,'C','minor',20,'minor_drive','mechanical','dist_guitar_l','industrial_riff','ostinato','industrial',secondary='dist_guitar_r',energy=.94,tension=.78,tags=('industrial','assault')),
 S('cloud_lancers','Cloud Lancers','Aerial Combat',162,'6/8',16,'G','minor',20,'minor_drive','heroic','trumpet','strings_motor','melodic','air_combat',secondary='flute',energy=.91,tension=.68,tags=('aerial','combat')),
 S('last_heart','Last Heart','Desperate Survival',138,'4/4',18,'D','phrygian',14,'phrygian','chromatic_warning','reed','pulse_sparse','pedal_walk','survival',secondary='brass',energy=.82,tension=.94,tags=('survival','desperate')),
 S('victory_lap_zero','Victory Lap Zero','Arcade Sprint',188,'4/4',16,'C','mixolydian',16,'mixolydian','pentatonic','pulse50','chiptune_motor','melodic','arcade',secondary='brass',energy=.99,tension=.42,tags=('arcade','sprint')),
 S('walls_of_bronze','Walls of Bronze','Siege',110,'3/4',16,'G','minor',28,'heroic','heroic','brass','orchestral_march','pedal_walk','siege',secondary='choir_t',energy=.84,tension=.76,tags=('siege','march')),
 S('vector_arena','Vector Arena','Cyber Combat',168,'7/8',16,'B','dorian',20,'dorian','sync_hook','synth_lead','electro_stabs','synth_ostinato','electro_battle',secondary='pulse50',energy=.96,tension=.7,tags=('cyber','arena')),
],
'horror':[
 S('footsteps_in_plaster','Footsteps in Plaster','Stalking',68,'5/4',16,'E','phrygian',12,'phrygian','chromatic_warning','reed','silence_punctures','pedal','stalking',energy=.18,tension=.9,tags=('stalking','minimal')),
 S('salt_circle','Salt Circle','Occult Ritual',76,'12/8',12,'D','minor',24,'lament','chant','choir_t','ritual_drones','pedal','ritual',secondary='choir_b',energy=.36,tension=.82,tags=('ritual','occult')),
 S('under_the_skin','Under the Skin','Body Horror',82,'7/8',16,'C#','phrygian',16,'phrygian','chromatic_warning','bassoon','prepared_pulses','chromatic_pedal','body_horror',secondary='prepared_piano',energy=.42,tension=.93,tags=('body-horror','organic')),
 S('stars_without_distance','Stars Without Distance','Cosmic Horror',54,'4/4',20,'F','whole_tone',24,'whole','floating','choir_s','cluster_fields','pedal','cosmic',secondary='drone',energy=.16,tension=.88,tags=('cosmic','void')),
 S('the_room_remembers','The Room Remembers','Psychological Horror',64,'3/4',18,'A','minor',12,'uncanny','sigh','piano','broken_memory','pedal_walk','none',secondary='strings',energy=.2,tension=.78,tags=('psychological','memory')),
 S('lamp_behind_the_door','Lamp Behind the Door','Unsafe Safe Room',72,'4/4',16,'Eb','major',12,'home','sigh','piano','sparse_chords','root_fifth','none',secondary='reed',energy=.18,tension=.48,tags=('safe-room','uneasy')),
 S('dont_look_back','Don’t Look Back','Panic Chase',190,'5/8',20,'F#','minor',16,'minor_drive','mechanical','pulse25','panic_ostinato','synth_ostinato','panic',secondary='prepared_piano',energy=1.0,tension=.98,tags=('panic','chase')),
 S('music_box_teeth','Music Box Teeth','Haunted Childhood',86,'3/4',16,'C','minor',14,'uncanny','waltz_line','bell','damaged_waltz','pedal_walk','toy',secondary='accordion',energy=.28,tension=.76,tags=('uncanny','childhood')),
 S('beneath_the_well','Beneath the Well','Subterranean Dread',58,'9/8',16,'D','phrygian',18,'phrygian','chant','bassoon','low_fields','pedal','cave',secondary='choir_b',energy=.2,tension=.9,tags=('subterranean','dread')),
 S('the_shape_in_full','The Shape in Full','Revelation',96,'4/4',16,'G','octatonic',28,'uncanny','arch','brass','reveal_clusters','pedal_walk','revelation',secondary='choir_s',energy=.66,tension=.96,tags=('reveal','monster')),
],
'towns':[
 S('morning_bread','Morning Bread','Village Morning',96,'6/8',16,'G','major',12,'home','pentatonic','ocarina','guitar_pattern','root_fifth','folk_light',secondary='flute',energy=.42,tags=('village','morning')),
 S('three_mugs_later','Three Mugs Later','Port Tavern',118,'6/8',16,'D','mixolydian',14,'mixolydian','step_answer','accordion','guitar_strum','melodic','tavern',secondary='reed',energy=.68,tags=('tavern','port')),
 S('paper_lantern_row','Paper Lantern Row','Night Market',112,'4/4',16,'A','pentatonic_major',16,'home','pentatonic','flute','pizz_ostinato','syncopated','market',secondary='vibes',energy=.62,tags=('market','night')),
 S('white_stone_capital','White-Stone Capital','Royal City',104,'3/4',16,'C','major',24,'sacred','heroic','horn','orchestral_waltz','melodic','city_march',secondary='flute',energy=.56,tags=('royal','city')),
 S('copper_saffron','Copper & Saffron','Desert Bazaar',122,'7/8',16,'E','phrygian',16,'phrygian','modal_call','reed','guitar_pattern','syncopated','bazaar',secondary='accordion',energy=.65,tags=('bazaar','desert')),
 S('the_blue_stove','The Blue Stove','Snow Inn',78,'3/4',16,'F','major',12,'home','sigh','piano','sparse_chords','root_fifth','brush_waltz',secondary='flute',energy=.25,tags=('inn','snow')),
 S('painted_wheels','Painted Wheels','Carnival',136,'6/8',16,'Bb','major',18,'home','waltz_line','accordion','circus_broken','melodic','carnival',secondary='trumpet',energy=.82,tags=('carnival','festival')),
 S('shift_change','Shift Change','Workshop District',126,'5/4',16,'C','mixolydian',16,'mixolydian','mechanical','clav','mechanical_comp','syncopated','workshop',secondary='pizz',energy=.72,tags=('workshop','district')),
 S('tables_by_the_tide','Tables by the Tide','Seaside Café',92,'4/4',16,'E','major',14,'bossa','sigh','guitar','bossa_comp','melodic','bossa',secondary='vibes',energy=.38,tags=('cafe','seaside')),
 S('all_bells_open','All Bells Open','Festival Day',132,'12/8',12,'D','mixolydian',24,'mixolydian','heroic','flute','festival_layers','melodic','festival',secondary='trumpet',energy=.88,tags=('festival','celebration')),
],
'emotion':[
 S('empty_chair','Empty Chair','Grief',62,'4/4',18,'D','minor',12,'lament','lament','piano','sparse_chords','descending','none',secondary='cello',energy=.15,tension=.42,tags=('grief','piano')),
 S('first_light_after','First Light After','Hope',84,'6/8',16,'A','major',18,'home','rising_fourth','flute','strings_swell','melodic','none',secondary='horn',energy=.42,tags=('hope','recovery')),
 S('postcard_in_june','Postcard in June','Bittersweet Memory',76,'3/4',16,'F','major',14,'home','falling_third','piano','memory_arpeggio','melodic','brush_waltz',secondary='violin1',energy=.28,tags=('memory','bittersweet')),
 S('at_the_station','At the Station','Reunion',92,'4/4',16,'C','major',20,'home','arch','flute','orchestral_broken','melodic','none',secondary='strings',energy=.55,tags=('reunion','warm')),
 S('last_boat_west','Last Boat West','Farewell',70,'6/8',20,'E','minor',16,'lament','falling_third','reed','harp_sparse','descending','sea',secondary='cello',energy=.22,tension=.38,tags=('farewell','ocean')),
 S('hands_in_winter','Hands in Winter','Tenderness',68,'4/4',16,'Bb','major',12,'home','sigh','piano','sparse_chords','root_fifth','none',secondary='flute',energy=.18,tags=('tender','intimate')),
 S('flags_in_mud','Flags in Mud','Defeat',58,'3/4',16,'G','minor',20,'lament','lament','horn','low_strings','descending','funeral',secondary='choir_t',energy=.25,tension=.66,tags=('defeat','solemn')),
 S('stand_again','Stand Again','Resolve',106,'4/4',16,'D','dorian',20,'dorian','heroic','horn','strings_motor','melodic','martial_light',secondary='trumpet',energy=.7,tags=('resolve','determined')),
 S('name_on_the_glass','Name on the Glass','Recalled Mystery',74,'5/4',16,'A','minor',14,'uncanny','noir','vibes','sparse_chords','pedal_walk','none',secondary='reed',energy=.25,tension=.52,tags=('memory','mystery')),
 S('road_after_credits','Road After Credits','Epilogue',88,'6/8',20,'G','major',24,'home','arch','flute','strings_swell','melodic','orchestral_light',secondary='horn',energy=.48,tags=('epilogue','homecoming')),
],
'mystery':[
 S('ink_under_rain','Ink Under Rain','Detective Noir',88,'4/4',16,'C','melodic_minor',16,'noir','noir','reed','jazz_shells','walking','brush_jazz',secondary='vibes',energy=.36,tension=.58,tags=('noir','jazz')),
 S('gear_seven','Gear Seven','Clockwork Puzzle',112,'7/8',16,'D','minor',14,'baroque','mechanical','harpsichord','counter_ostinato','pedal_walk','clockwork',secondary='pizz',energy=.52,tension=.46,tags=('clockwork','puzzle')),
 S('catalogue_of_mirrors','Catalogue of Mirrors','Arcane Library',72,'5/4',16,'F','lydian',18,'lydian','floating','vibes','organ_pedal','pedal','none',secondary='flute',energy=.24,tension=.36,tags=('library','arcane')),
 S('clean_room_signal','Clean Room Signal','Science Lab',108,'4/4',16,'A','lydian',16,'lydian','minimal_cell','pulse25','minimal_pulse','synth_ostinato','electronic_light',secondary='vibes',energy=.48,tension=.32,tags=('science','lab')),
 S('four_doors_one_key','Four Doors, One Key','Logic Temple',96,'5/8',20,'E','dorian',14,'dorian','mechanical','pizz','pattern_shifts','pedal_walk','wood_puzzle',secondary='flute',energy=.47,tension=.44,tags=('logic','temple')),
 S('velvet_entry','Velvet Entry','Stealth Infiltration',82,'4/4',16,'F#','minor',12,'minor_drive','noir','muted_guitar','stealth_pulse','pedal','stealth',secondary='reed',energy=.3,tension=.7,tags=('stealth','infiltration')),
 S('stone_answers','Stone Answers','Ancient Mechanism',90,'9/8',16,'C','dorian',18,'dorian','modal_call','bassoon','ritual_ostinato','pedal_walk','mechanism',secondary='bell',energy=.42,tension=.48,tags=('ancient','mechanism')),
 S('rooms_that_fold','Rooms That Fold','Dream Puzzle',66,'3/4',18,'Eb','whole_tone',16,'whole','floating','vibes','floating_chords','pedal','none',secondary='flute',energy=.2,tension=.45,tags=('dream','puzzle')),
 S('redacted_pages','Redacted Pages','Conspiracy',98,'4/4',16,'D','minor',18,'noir','chromatic_warning','reed','jazz_shells','walking','tight_jazz',secondary='muted_brass',energy=.52,tension=.72,tags=('conspiracy','noir')),
 S('minute_hand_zero','Minute Hand Zero','Time Fracture',126,'7/8',16,'B','octatonic',20,'uncanny','mechanical','pulse50','fracture_patterns','synth_ostinato','glitch',secondary='prepared_piano',energy=.7,tension=.8,tags=('time','fracture')),
],
'fantasy':[
 S('arches_of_mercy','Arches of Mercy','Cathedral',72,'4/4',20,'C','major',32,'sacred','chant','choir_s','chorale','pedal','sacred',secondary='organ',energy=.4,tags=('cathedral','sacred')),
 S('moss_crown_dance','Moss-Crown Dance','Forest Spirits',104,'9/8',16,'G','dorian',18,'dorian','pentatonic','flute','harp_wave','melodic','folk_light',secondary='pizz',energy=.54,tags=('forest','spirits')),
 S('sleeping_dragon_court','Sleeping Dragon Court','Dragon Sanctuary',84,'12/8',12,'D','minor',28,'lament','heroic','horn','orchestral_swell','pedal_walk','ritual_light',secondary='choir_b',energy=.48,tension=.56,tags=('dragon','sanctuary')),
 S('palace_of_low_stars','Palace of Low Stars','Celestial Palace',96,'4/4',16,'F','lydian',24,'lydian','floating','vibes','celestial_arps','melodic','none',secondary='choir_s',energy=.45,tags=('celestial','palace')),
 S('thirteen_candles','Thirteen Candles','Witch Coven',92,'5/4',16,'A','dorian',20,'dorian','chant','reed','ritual_ostinato','pedal_walk','ritual',secondary='choir_a',energy=.45,tension=.65,tags=('witch','coven')),
 S('court_of_thistledown','Court of Thistledown','Fairy Court',128,'6/8',16,'D','major',20,'home','step_answer','piccolo','pizz_ostinato','melodic','fairy',secondary='pizz',energy=.72,tags=('fairy','court')),
 S('pilgrims_of_gold','Pilgrims of Gold','Holy Pilgrimage',88,'3/4',20,'G','mixolydian',28,'sacred','chant','choir_t','processional','pedal_walk','procession',secondary='horn',energy=.55,tags=('pilgrimage','sacred')),
 S('black_banner_kingdom','Black-Banner Kingdom','Dark Kingdom',104,'4/4',16,'Eb','harmonic_minor',28,'baroque','heroic','brass','dark_orchestra','pedal_walk','martial_dark',secondary='choir_b',energy=.76,tension=.72,tags=('dark-kingdom','royal')),
 S('four_element_shrine','Four-Element Shrine','Elemental Shrine',108,'7/8',16,'C','dorian',24,'dorian','modal_call','flute','elemental_layers','melodic','elemental',secondary='vibes',energy=.62,tags=('elemental','shrine')),
 S('the_oracle_opens','The Oracle Opens','Prophecy',68,'12/8',12,'E','minor',32,'lament','floating','choir_s','prophecy_fields','pedal','sacred',secondary='brass',energy=.5,tension=.68,tags=('oracle','prophecy')),
],
'electronic':[
 S('night_rail_88','Night Rail 88','Synthwave Transit',118,'4/4',16,'C','minor',16,'minor_drive','sync_hook','synth_lead','synth_arp','synth_ostinato','synthwave',secondary='pulse50',energy=.72,tags=('synthwave','transit')),
 S('concrete_frequency','Concrete Frequency','Techno Factory',132,'4/4',16,'F','dorian',18,'funk','minimal_cell','pulse25','techno_stabs','synth_ostinato','techno',secondary='clav',energy=.84,tags=('techno','factory')),
 S('escape_velocity_red','Escape Velocity Red','Drum & Bass Escape',176,'4/4',16,'D','minor',20,'minor_drive','sync_hook','synth_lead','dnb_pads','synth_ostinato','dnb',secondary='pulse50',energy=.97,tension=.82,tags=('dnb','escape')),
 S('quiet_orbit','Quiet Orbit','Space Ambient',62,'4/4',20,'A','lydian',24,'lydian','minimal_cell','vibes','space_fields','pedal','none',secondary='choir_s',energy=.15,tags=('space','ambient')),
 S('rain_neon_block','Rain / Neon / Block','Cyberpunk City',106,'4/4',16,'E','minor',20,'noir','noir','reed','electro_noir','walking','electro_jazz',secondary='synth_lead',energy=.58,tension=.58,tags=('cyberpunk','city')),
 S('hangar_nine','Hangar Nine','Mech Hangar',120,'5/4',16,'B','mixolydian',20,'mixolydian','mechanical','clav','industrial_riff','syncopated','industrial',secondary='brass',energy=.7,tags=('mech','hangar')),
 S('language_from_outside','Language from Outside','Alien Signal',74,'7/8',16,'C#','octatonic',18,'uncanny','floating','prepared_piano','signal_pulses','pedal','glitch_sparse',secondary='pulse25',energy=.3,tension=.7,tags=('alien','signal')),
 S('orbital_knives','Orbital Knives','Orbital Battle',164,'12/8',12,'G','minor',24,'minor_drive','heroic','synth_lead','orchestral_synth','synth_ostinato','space_battle',secondary='brass',energy=.94,tension=.72,tags=('orbital','battle')),
 S('soft_reset_dream','Soft Reset Dream','Digital Dream',80,'6/8',16,'F#','lydian',18,'lydian','floating','pulse50','dream_arps','pedal_walk','none',secondary='vibes',energy=.28,tags=('digital','dream')),
 S('core_temperature','Core Temperature','Reactor Meltdown',150,'7/8',16,'E','phrygian',24,'phrygian','mechanical','dist_guitar_l','meltdown_layers','synth_ostinato','meltdown',secondary='pulse25',energy=1.0,tension=.96,tags=('reactor','meltdown')),
],
'urban':[
 S('cigarette_geometry','Cigarette Geometry','Jazz Noir',86,'4/4',16,'Eb','melodic_minor',16,'jazz_turn','falling_third','muted_brass','swing_comp','walking','brush_jazz',secondary='vibes',energy=.38,tension=.55,tags=('jazz','noir')),
 S('swing_room_three','Swing Room Three','Swing Club',132,'4/4',16,'F','major',18,'jazz_turn','arch','trumpet','swing_comp','walking','swing',secondary='reed',energy=.68,tags=('swing','club')),
 S('stairs_two_at_once','Stairs Two at Once','Bebop Chase',184,'4/4',16,'Bb','major',16,'jazz_turn','bebop','reed','bebop_comp','walking','bebop',secondary='trumpet',energy=.9,tags=('bebop','chase')),
 S('assembly_line_soul','Assembly Line Soul','Funk Factory',112,'4/4',16,'E','dorian',18,'funk','sync_hook','clav','funk_comp','slap','funk',secondary='brass',energy=.82,tags=('funk','factory')),
 S('amber_booth','Amber Booth','Soul Lounge',72,'6/8',16,'Ab','major',16,'home','noir','reed','soul_chords','melodic','slow_groove',secondary='organ',energy=.32,tags=('soul','lounge')),
 S('roof_tiles_after_rain','Roof Tiles After Rain','Bossa Rooftop',92,'4/4',16,'D','major',14,'bossa','step_answer','flute','jazz_shells','melodic','bossa',secondary='vibes',energy=.38,tags=('bossa','rooftop')),
 S('green_harbor','Green Harbor','Reggae Harbor',82,'4/4',16,'G','mixolydian',14,'reggae','pentatonic','organ','reggae_skank','melodic','one_drop',secondary='flute',energy=.5,tags=('reggae','harbor')),
 S('echo_alley','Echo Alley','Dub Alley',74,'4/4',16,'D','minor',16,'reggae','floating','organ','dub_space','melodic','dub',secondary='reed',energy=.32,tags=('dub','alley')),
 S('saturday_horns','Saturday Horns','Ska Festival',154,'4/4',16,'C','major',18,'home','heroic','trumpet','ska_skank','melodic','ska',secondary='trombone',energy=.94,tags=('ska','festival')),
 S('underpass_tango','Underpass Tango','Tango Undercity',118,'4/4',16,'A','harmonic_minor',18,'tango','tango','accordion','tango_comp','melodic','tango',secondary='violin1',energy=.68,tension=.62,tags=('tango','undercity')),
],
'classical':[
 S('invention_in_copper','Invention in Copper','Baroque Invention',112,'4/4',16,'D','minor',16,'baroque','fugue_subject','harpsichord','two_voice_counterpoint','pedal_walk','none',secondary='pizz',energy=.5,tags=('baroque','invention')),
 S('fugue_of_small_machines','Fugue of Small Machines','Four-Part Fugue',104,'4/4',20,'G','minor',28,'baroque','fugue_subject','harpsichord','four_voice_fugue','pedal_walk','none',secondary='strings',energy=.64,tension=.5,tags=('fugue','counterpoint')),
 S('winter_gallery','Winter Gallery','Classical Waltz',84,'3/4',20,'Eb','major',20,'home','waltz_line','violin1','orchestral_waltz','melodic','waltz',secondary='flute',energy=.4,tags=('waltz','chamber')),
 S('marble_steps','Marble Steps','Ceremonial March',108,'4/4',16,'C','major',28,'heroic','heroic','trumpet','orchestral_march','pedal_walk','march',secondary='horn',energy=.7,tags=('march','ceremonial')),
 S('phase_garden','Phase Garden','Minimal Process',126,'5/4',20,'E','dorian',16,'minimal','minimal_cell','piano','minimal_phase','pedal','minimal',secondary='vibes',energy=.44,tags=('minimalism','process')),
 S('quartet_at_dusk','Quartet at Dusk','String Quartet',72,'4/4',20,'A','minor',24,'lament','sigh','violin1','string_quartet','melodic','none',secondary='cello',energy=.3,tags=('quartet','chamber')),
 S('water_without_edges','Water Without Edges','Impressionist Water',68,'9/8',16,'Db','lydian',24,'lydian','floating','piano','impressionist','pedal_walk','none',secondary='flute',energy=.22,tags=('impressionist','water')),
 S('allegro_for_a_tyrant','Allegro for a Tyrant','Neoclassical Boss',148,'7/8',16,'C','harmonic_minor',32,'baroque','heroic','violin1','neoclassical_motor','pedal_walk','boss',secondary='brass',energy=.96,tension=.86,tags=('neoclassical','boss')),
 S('angles_in_the_dark','Angles in the Dark','Atonal Suspense',76,'5/4',16,'C','octatonic',20,'uncanny','chromatic_warning','prepared_piano','atonal_cells','pedal','none',secondary='strings',energy=.28,tension=.88,tags=('atonal','suspense')),
 S('overture_for_new_worlds','Overture for New Worlds','Expanded Orchestral Overture',96,'12/8',16,'D','major',32,'heroic','heroic','trumpet','full_orchestra','melodic','orchestral',secondary='flute',energy=.82,tags=('overture','orchestral')),
]
}


GENERATION_SALT='neospc-v4-professor-rebuild-2026-07'
def seed_for(*parts):
    return int.from_bytes(hashlib.sha256((GENERATION_SALT+'|'+('|'.join(map(str,parts)))).encode()).digest()[:8],'big')

def pitch(name:str)->int:
    if len(name)>=3 and name[1] in '#b': key=name[:2]; octave=int(name[2:])
    else: key=name[0]; octave=int(name[1:])
    return 12*(octave+1)+NOTE_PC[key]

def event_note(lane,midi,beat,dur,gain=.05,pan=0,send=.1,role='lead',accent=1.0,**kw):
    lo,hi=INSTRUMENTS[lane][3]
    midi=max(lo,min(hi,int(round(midi))))
    ev={'kind':'note','inst':lane,'midi':midi,'beat':round(float(beat),4),'duration':round(max(.04,float(dur)),4),'gain':round(float(gain),4),'pan':round(float(pan),3),'send':round(float(send),3),'role':role,'accent':round(float(accent),3)}
    ev.update(kw); return ev

def event_drum(lane,beat,gain=.04,pan=0,send=.04,accent=1.0,**kw):
    ev={'kind':'drum','inst':lane,'beat':round(float(beat),4),'gain':round(float(gain),4),'pan':round(float(pan),3),'send':round(float(send),3),'role':lane,'accent':round(float(accent),3)}
    ev.update(kw); return ev

def parse_chord(symbol,key_pc,base_octave=3):
    raw=symbol
    flat=0
    while symbol.startswith('b'):
        flat-=1; symbol=symbol[1:]
    while symbol.startswith('#'):
        flat+=1; symbol=symbol[1:]
    roman=''
    for ch in symbol:
        if ch.upper() in 'IV': roman+=ch
        else: break
    roman_up=roman.upper()
    root_pc=(key_pc+ROMAN_DEG.get(roman_up,0)+flat)%12
    suffix=symbol[len(roman):]
    lower=roman.islower()
    if 'ø' in suffix: intervals=[0,3,6,10]
    elif 'dim' in suffix or '°' in suffix: intervals=[0,3,6]
    elif 'sus2' in suffix: intervals=[0,2,7]
    elif 'sus4' in suffix: intervals=[0,5,7]
    elif lower: intervals=[0,3,7]
    else: intervals=[0,4,7]
    if 'maj7' in suffix: intervals.append(11)
    elif '7' in suffix: intervals.append(10)
    if '6' in suffix and 9 not in intervals: intervals.append(9)
    if '9' in suffix and 14 not in intervals: intervals.append(14)
    root=12*(base_octave+1)+root_pc
    return {'symbol':raw,'root_pc':root_pc,'root':root,'pcs':{(root_pc+i)%12 for i in intervals},'notes':[root+i for i in intervals]}

def scale_pcs(spec):
    root=NOTE_PC[spec['key']]
    return [(root+i)%12 for i in MODES[spec['mode']]]

def scale_midis(spec,low=36,high=96):
    pcs=set(scale_pcs(spec)); return [m for m in range(low,high+1) if m%12 in pcs]

def nearest_allowed(target,allowed,prefer=None):
    opts=sorted(allowed,key=lambda x:(abs(x-target),x))
    if not opts:return int(round(target))
    bestdist=abs(opts[0]-target); ties=[x for x in opts if abs(x-target)==bestdist]
    if prefer=='down':return min(ties)
    if prefer=='up':return max(ties)
    return ties[len(ties)//2]

def form_sections(spec):
    bars=spec['bars']; declared=spec['form']
    if isinstance(declared,list):
        out=[];pos=0
        for section in declared:
            length=int(section['bars']); item={'name':section['name'],'start_bar':pos,'bars':length}
            if section.get('function'):item['function']=section['function']
            out.append(item);pos+=length
        return out
    labels=declared.split()
    count=len(labels); base=bars//count; rem=bars%count; out=[]; pos=0
    for i,l in enumerate(labels):
        length=base+(1 if i<rem else 0);out.append({'name':l,'start_bar':pos,'bars':length});pos+=length
    return out

def chord_plan(spec):
    prog=PROGRESSIONS[spec['prog']]
    key_pc=NOTE_PC[spec['key']]
    chords=[]
    for b in range(spec['bars']): chords.append(parse_chord(prog[b%len(prog)],key_pc,3))
    return chords

def motif_events(spec,bar_len,chords,sections):
    ints,offs,durs=MOTIFS[spec['motif']]
    scale=scale_midis(spec,36,96); scale_pcl=set(scale_pcs(spec))
    lead=spec['lead']; secondary=spec.get('secondary')
    lo,hi=INSTRUMENTS[lead][3]; center=(lo+hi)//2
    events=[]
    section_map={}
    for si,s in enumerate(sections):
        for b in range(s['start_bar'],s['start_bar']+s['bars']):section_map[b]=si
    phrase_bars=2
    for pstart in range(0,spec['bars'],phrase_bars):
        si=section_map.get(pstart,0); section=sections[si]
        lane=lead if not secondary or si%3!=1 else secondary
        llo,lhi=INSTRUMENTS[lane][3]
        phrase_center=max(llo+5,min(lhi-6,center + [0,2,5,-1,7][si%5]))
        transform=si%5
        base_scale_index=min(range(len(scale)),key=lambda i:abs(scale[i]-phrase_center))
        phrase_span=bar_len*phrase_bars
        for j,(iv,off,dur) in enumerate(zip(ints,offs,durs)):
            local=off
            if max(offs) > phrase_span-.2:
                local=off*(phrase_span-.35)/max(offs)
            idx=iv
            if transform==1: idx=iv+1
            elif transform==2: idx=-iv+3
            elif transform==3 and j%2: idx=iv-1
            elif transform==4: idx=iv+(1 if j>=len(ints)//2 else 0)
            target_index=max(0,min(len(scale)-1,base_scale_index+idx))
            target=scale[target_index]
            beat=pstart*bar_len+local
            bar=min(spec['bars']-1,int(beat/bar_len)); rel=beat-bar*bar_len
            chord=chords[bar]
            strong = abs(rel-0)<.12 or abs(rel-bar_len/2)<.12
            allowed=[m for m in range(llo,lhi+1) if m%12 in (chord['pcs'] if strong else scale_pcl)]
            note=nearest_allowed(target,allowed,'up' if j<len(ints)//2 else 'down')
            accent=1.0 if j==0 else .9 if strong else .76
            events.append(event_note(lane,note,beat,min(dur,phrase_span-local-.04),.045 if lane not in ('trumpet','brass') else .038,.15,.16,'lead',accent,vibrato=.12 if dur>.55 and lane in ('flute','ocarina','reed','violin1') else 0,phrase=si))
        # phrase cadence / breath; a structural chord tone on final half-beat
        endbeat=min(spec['bars']*bar_len-.25,(pstart+phrase_bars)*bar_len-.4)
        c=chords[min(spec['bars']-1,int(endbeat/bar_len))]
        allowed=[m for m in range(llo,lhi+1) if m%12 in c['pcs']]
        cadence=nearest_allowed(phrase_center-2 if si%2 else phrase_center,allowed,'down')
        events.append(event_note(lane,cadence,endbeat,.32,.044,.15,.16,'lead',1.0,phrase=si,cadence=True))
    return events

def add_bass(events,spec,bar_len,chords):
    style=spec['bass']; lane='sub' if style in ('synth_ostinato','chromatic_pedal') else 'slap_bass' if style=='slap' else 'bass'
    if spec['subcategory'] in ('Boss Battle','Siege','Expanded Orchestral Overture','Four-Part Fugue'): lane='contrabass'
    lo,hi=INSTRUMENTS[lane][3]
    for b,c in enumerate(chords):
        t=b*bar_len; root=nearest_allowed(c['root']-12,[m for m in range(lo,hi+1) if m%12==c['root_pc']],'down')
        fifth_pc=(c['root_pc']+7)%12; fifth=nearest_allowed(root+7,[m for m in range(lo,hi+1) if m%12==fifth_pc])
        nextc=chords[(b+1)%len(chords)]; nextroot=nearest_allowed(nextc['root']-12,[m for m in range(lo,hi+1) if m%12==nextc['root_pc']])
        if style in ('pedal','chromatic_pedal'):
            events.append(event_note(lane,root,t,bar_len*.88,.045,-.08,.03,'bass',1))
            if style=='chromatic_pedal' and b%2: events.append(event_note(lane,root+1,t+bar_len*.65,bar_len*.18,.026,-.08,.03,'bass',.55))
        elif style in ('root_fifth','pedal_walk'):
            events.append(event_note(lane,root,t,bar_len*.43,.044,-.08,.025,'bass',1));events.append(event_note(lane,fifth,t+bar_len*.5,bar_len*.38,.038,-.08,.025,'bass',.78))
        elif style in ('walking','melodic','descending'):
            steps=4 if bar_len>=4 else 3
            candidates=scale_midis(spec,lo,hi)
            for i in range(steps):
                frac=i/steps; target=root+(nextroot-root)*frac
                if style=='descending':target=root-i*2
                n=nearest_allowed(target,candidates,'down' if style=='descending' else None)
                events.append(event_note(lane,n,t+i*bar_len/steps,bar_len/steps*.78,.036,-.08,.025,'bass',1 if i==0 else .72))
        elif style in ('syncopated','slap'):
            pattern=[(0,.34,1),(.75,.2,.72),(1.5,.3,.82),(2.5,.23,.68),(3.25,.38,.9)]
            for i,(off,dur,acc) in enumerate(pattern):
                if off>=bar_len:continue
                n=root if i%3!=1 else fifth
                events.append(event_note(lane,n,t+off,min(dur,bar_len-off-.02),.039 if style!='slap' else .043,-.06,.02,'bass',acc))
        elif style in ('ostinato','synth_ostinato'):
            for i,off in enumerate([0,.5,1.25,2,2.75,3.5]):
                if off>=bar_len:continue
                n=[root,root,fifth,root,root+12,fifth][i]
                events.append(event_note(lane,n,t+off,min(.32,bar_len-off-.02),.037,-.06,.02,'bass',1 if off==0 else .7))
        else:
            events.append(event_note(lane,root,t,bar_len*.8,.042,-.08,.025,'bass',1))

def chord_voicing(c,lane,register=4,count=3,spread=False):
    lo,hi=INSTRUMENTS[lane][3]; base=12*(register+1)+c['root_pc']; pcs=list(c['pcs']); notes=[]
    for pc in sorted(pcs,key=lambda p:(p-c['root_pc'])%12):
        n=base+((pc-c['root_pc'])%12)
        while n<lo:n+=12
        while n>hi:n-=12
        notes.append(n)
    notes=sorted(set(notes))
    if spread and len(notes)>=3:notes[-1]+=12
    return [max(lo,min(hi,n)) for n in notes[:count]]

def add_chord(events,lane,notes,beat,dur,gain=.015,pan=.0,send=.12,role='support',strum=0):
    center=(len(notes)-1)/2
    for i,n in enumerate(notes):events.append(event_note(lane,n,beat+i*strum,dur,gain,pan+(i-center)*.08,send,role,1 if i==0 else .82))

def add_accompaniment(events,spec,bar_len,chords):
    comp=spec['comp']; budget=spec['budget']
    for b,c in enumerate(chords):
        t=b*bar_len
        if comp in ('harp_broken','orchestral_broken','harp_wave','celestial_arps','dream_arps'):
            lane='harp'; notes=chord_voicing(c,lane,4,4,True); pattern=[0,1,2,1,3,2]
            steps=6 if bar_len>=3 else 4
            for i in range(steps):
                off=i*bar_len/steps; idx=pattern[(i+b)%len(pattern)]%len(notes)
                if comp=='harp_sparse' and i%2:continue
                events.append(event_note(lane,notes[idx],t+off,bar_len/steps*.5,.018,-.14+.28*(i%2),.17,'arp',1 if i==0 else .64))
        elif comp in ('pizz_ostinato','counter_ostinato','ritual_ostinato','pattern_shifts'):
            lane='pizz';notes=chord_voicing(c,lane,3,3); offs=[0,.75,1.5,2.25,3.0,3.75]
            rot=b%3
            for i,off in enumerate(offs):
                if off>=bar_len:continue
                idx=(i+rot)%len(notes);events.append(event_note(lane,notes[idx],t+off,min(.24,bar_len-off-.02),.022,.18 if i%2 else -.18,.09,'ostinato',1 if off==0 else .68))
        elif comp in ('guitar_pattern','guitar_strum','bossa_comp','reggae_skank','ska_skank','tango_comp'):
            lane='guitar';notes=chord_voicing(c,lane,3,4)
            if comp=='bossa_comp': offs=[.5,1.5,2.25,3.25];durs=[.28,.45,.28,.42]
            elif comp in ('reggae_skank','ska_skank'): offs=[.5,1.5,2.5,3.5];durs=[.18]*4
            elif comp=='tango_comp':offs=[0,1.5,2.0,3.25];durs=[.28,.25,.35,.3]
            else:offs=[0,1.5,2.5,3.25];durs=[.35,.25,.3,.3]
            for j,off in enumerate(offs):
                if off>=bar_len:continue
                add_chord(events,lane,notes,t+off,min(durs[j],bar_len-off-.02),.011,.0,.08,'comp',strum=.012*(-1 if (b+j)%2 else 1))
        elif comp in ('jazz_shells','swing_comp','bebop_comp','soul_chords','electro_noir'):
            lane='piano' if comp not in ('electro_noir',) else 'vibes';notes=chord_voicing(c,lane,4,4,True)
            offs=[0,2.5] if bar_len>=4 else [0,bar_len*.55]
            if comp in ('swing_comp','bebop_comp'):offs=[.67,2.0,3.33]
            for j,off in enumerate(offs):
                if off>=bar_len:continue
                add_chord(events,lane,notes[-3:],t+off,min(.5,bar_len-off-.03),.012,.08,.12,'comp',strum=.008)
        elif comp in ('orchestral_tremolo','strings_motor','orchestral_swell','dark_orchestra','full_orchestra','neoclassical_motor','orchestral_march','orchestral_waltz'):
            # Core string choir with dynamic activation according to voice budget.
            lanes=['cello','viola','violin2','violin1']; regs=[2,3,4,5]
            for lane,reg in zip(lanes,regs):
                notes=chord_voicing(c,lane,reg,1); n=notes[0]
                if comp in ('orchestral_tremolo','strings_motor','neoclassical_motor'):
                    for off in [0,.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5]:
                        if off>=bar_len:continue
                        events.append(event_note(lane,n,t+off,min(.35,bar_len-off-.02),.012,-.25+.16*lanes.index(lane),.09,'motor',1 if off==0 else .64))
                else:
                    events.append(event_note(lane,n,t,bar_len*.92,.013,-.28+.18*lanes.index(lane),.14,'support',1,attack=.08,release=.3))
            if budget>=24 and comp in ('full_orchestra','dark_orchestra','orchestral_swell'):
                hornnotes=chord_voicing(c,'horn',3,2);add_chord(events,'horn',hornnotes,t,bar_len*.82,.011,.05,.12,'support')
        elif comp in ('chorale','processional','prophecy_fields','cluster_fields','reveal_clusters','ritual_drones','low_fields','space_fields'):
            lanes=['choir_b','choir_t','choir_a','choir_s'] if spec['budget']>=24 else ['choir_t','choir_a']
            for i,lane in enumerate(lanes):
                notes=chord_voicing(c,lane,2+i,1);events.append(event_note(lane,notes[0],t,bar_len*.93,.009,-.24+i*.16,.26,'pad',1,attack=.18,release=.6))
            if comp in ('cluster_fields','reveal_clusters') and b%2:events.append(event_note('drone',c['root']+1,t+bar_len*.25,bar_len*.55,.008,.1,.3,'texture',.55,attack=.2,release=.7))
        elif comp in ('minimal_phase','minimal_pulse','techno_stabs','electro_stabs','synth_arp','breakbeat_pulse','panic_ostinato','fracture_patterns','signal_pulses','meltdown_layers'):
            lane='pulse25' if comp not in ('techno_stabs','electro_stabs') else 'clav';notes=chord_voicing(c,lane,3,4)
            patterns={
             'minimal_phase':[0,.75,1.5,2.25,3.25,4.0], 'minimal_pulse':[0,1.25,2.5,3.25], 'techno_stabs':[.5,1.5,2.5,3.5],
             'electro_stabs':[0,.75,2,2.75], 'synth_arp':[0,.5,1,1.5,2,2.5,3,3.5], 'breakbeat_pulse':[0,.75,1.75,2.5,3.25],
             'panic_ostinato':[0,.375,.75,1.125,1.5,1.875,2.25], 'fracture_patterns':[0,.5,1.25,2,2.5,3.25],
             'signal_pulses':[0,1.5,2.25,3.75], 'meltdown_layers':[0,.5,1,1.75,2.25,3,3.5]
            }
            for i,off in enumerate(patterns.get(comp,[0,1,2,3])):
                if off>=bar_len:continue
                events.append(event_note(lane,notes[(i+b)%len(notes)],t+off,min(.22,bar_len-off-.02),.017,-.18+.36*(i%2),.08,'pulse',1 if i==0 else .65))
        elif comp in ('two_voice_counterpoint','four_voice_fugue','string_quartet'):
            # Dedicated counterpoint is added separately after melody; here only bass/cadential support.
            pass
        elif comp in ('sparse_chords','memory_arpeggio','broken_memory','floating_chords','impressionist','damaged_waltz'):
            lane='piano';notes=chord_voicing(c,lane,3,4,True)
            if comp in ('memory_arpeggio','broken_memory'):offs=[0,1,2.5,3.25]
            elif comp=='damaged_waltz':offs=[0,1,2] if b%2==0 else [0,2]
            else:offs=[0,bar_len*.6]
            for j,off in enumerate(offs):
                if off>=bar_len:continue
                if comp in ('sparse_chords','floating_chords','impressionist'):
                    add_chord(events,lane,notes[:3],t+off,min(bar_len*.32,bar_len-off-.02),.01,.0,.18,'comp',strum=.018)
                else:
                    events.append(event_note(lane,notes[(j+b)%len(notes)],t+off,min(.45,bar_len-off-.02),.019,.0,.16,'arp',1 if j==0 else .68))
        elif comp in ('funk_comp','mechanical_comp'):
            lane='clav';notes=chord_voicing(c,lane,3,3);offs=[0,.75,1.5,2.25,3.0,3.5]
            for j,off in enumerate(offs):
                if off>=bar_len:continue
                add_chord(events,lane,notes,t+off,min(.18,bar_len-off-.02),.009,.08,.04,'comp',strum=.003)
        elif comp in ('industrial_riff','guitar_riff'):
            lane='dist_guitar_l';notes=chord_voicing(c,lane,2,3);offs=[0,.5,1.25,2,2.75,3.25]
            for j,off in enumerate(offs):
                if off>=bar_len:continue
                n=notes[j%len(notes)];events.append(event_note(lane,n,t+off,min(.3,bar_len-off-.02),.029,-.22,.035,'riff',1 if off==0 else .72))
            if spec['budget']>=20:
                for j,off in enumerate(offs):
                    if off>=bar_len:continue
                    events.append(event_note('dist_guitar_r',notes[j%len(notes)]+(12 if j%3==2 else 0),t+off+.012,min(.3,bar_len-off-.02),.021,.22,.035,'riff',.68,tuning_cents=4))
        else:
            lane='strings';notes=chord_voicing(c,lane,3,3);add_chord(events,lane,notes,t,bar_len*.9,.011,0,.14,'support')

def add_counterpoint(events,spec,bar_len,chords,melody):
    comp=spec['comp']
    if comp not in ('two_voice_counterpoint','four_voice_fugue','string_quartet'):return
    source=[e for e in melody if e['kind']=='note']
    if not source:return
    if comp=='two_voice_counterpoint':
        for i,e in enumerate(source):
            if i%2:continue
            beat=(e['beat']+bar_len*2)%(spec['bars']*bar_len); interval=-7 if i%4 else -5
            events.append(event_note('harpsichord',e['midi']+interval,beat,e['duration']*.9,.022,-.18,.08,'counter',.8))
    elif comp=='four_voice_fugue':
        entries=[('violin1',0,0),('violin2',bar_len*2,-7),('viola',bar_len*4,-12),('cello',bar_len*6,-19)]
        base=source[:min(16,len(source))]
        for lane,delay,trans in entries:
            for e in base:
                beat=e['beat']+delay
                if beat>=spec['bars']*bar_len:continue
                events.append(event_note(lane,e['midi']+trans,beat,e['duration']*.9,.018,[-.26,-.08,.09,.25][entries.index((lane,delay,trans))],.12,'counter',.78))
    else: # string quartet
        # Use melody as violin I; add slower contrary-motion parts derived from chord tones.
        for b,c in enumerate(chords):
            t=b*bar_len
            for lane,reg,idx,pan in [('violin2',4,1,-.08),('viola',3,1,.08),('cello',2,0,.22)]:
                notes=chord_voicing(c,lane,reg,3);n=notes[min(idx,len(notes)-1)]
                events.append(event_note(lane,n,t,bar_len*.88,.014,pan,.12,'counter',.82,attack=.06,release=.28))

def add_pad_layers(events,spec,bar_len,chords):
    budget=spec['budget'];
    if budget<12:return
    # Do not fill every track. Extra voices enter in later half and only for selected categories.
    category=spec['category']; start_bar=spec['bars']//2
    if category in ('action','fantasy','classical','emotion','adventure'):
        lanes=['viola','violin2'] if budget<20 else ['cello','viola','violin2','violin1']
        for b in range(start_bar,spec['bars']):
            c=chords[b];t=b*bar_len
            for i,lane in enumerate(lanes):
                notes=chord_voicing(c,lane,2+i,1);events.append(event_note(lane,notes[0],t,bar_len*.9,.0075,-.25+i*(.5/max(1,len(lanes)-1)),.16,'pad',.7,attack=.11,release=.4))
    if budget>=24 and category in ('fantasy','classical','action'):
        choir=['choir_b','choir_t','choir_a','choir_s']
        for b in range(int(spec['bars']*.7),spec['bars']):
            c=chords[b];t=b*bar_len
            for i,lane in enumerate(choir):
                n=chord_voicing(c,lane,2+i,1)[0];events.append(event_note(lane,n,t,bar_len*.88,.0055,-.3+i*.2,.24,'ensemble',.62,attack=.2,release=.6))

def add_expanded_ensemble(events,spec,bar_len,chords):
    budget=spec['budget']
    if budget<24:return
    # Concentrated climax orchestration. Extra voices are functional and temporary.
    start=max(0,spec['bars']-3)
    category=spec['category']
    for b in range(start,spec['bars']):
        c=chords[b];t=b*bar_len
        if category in ('electronic',):
            layers=[('synth_pad',3,0,-.28),('synth_pad',4,1,-.1),('pulse50',4,2,.12),('pulse25',5,1,.28)]
        elif category in ('horror',):
            layers=[('drone',2,0,-.2),('choir_b',2,0,-.12),('choir_t',3,1,.02),('choir_a',4,2,.16),('strings',4,1,.28)]
        else:
            layers=[('contrabass',1,0,-.32),('cello',2,0,-.24),('viola',3,1,-.12),('violin2',4,1,.02),('violin1',5,2,.16),('horn',3,1,.26)]
        if budget>=28:
            layers += [('flute',5,2,-.18),('clarinet',4,1,.18),('trumpet',4,2,.32)] if category not in ('horror','electronic') else [('synth_pad',5,2,.32),('pulse50',4,0,-.32),('vibes',5,1,.2)]
        if budget>=32:
            layers += [('choir_b',2,0,-.34),('choir_t',3,1,-.16),('choir_a',4,2,.08),('choir_s',5,2,.3),('organ',3,0,0)] if category not in ('electronic',) else [('synth_pad',3,0,-.4),('synth_pad',4,1,-.2),('pulse25',5,2,.0),('pulse50',5,1,.25),('vibes',5,2,.4)]
        for li,(lane,reg,idx,pan) in enumerate(layers):
            notes=chord_voicing(c,lane,reg,3,spread=li%3==0)
            n=notes[min(idx,len(notes)-1)]
            events.append(event_note(lane,n,t,bar_len*.86,.0058 if INSTRUMENTS[lane][4] in ('choir','strings','texture') else .0075,pan,.18,'ensemble',.62,attack=.12 if INSTRUMENTS[lane][4] in ('strings','choir') else .035,release=.45))
        # Two-note upper divisi on the final bar for maximal profiles.
        if budget>=32 and b==spec['bars']-1:
            for lane,pan in [('violin1',-.12),('violin1',.12),('choir_s',-.22),('choir_s',.22)]:
                notes=chord_voicing(c,lane,5,3,True)
                for n in notes[-2:]:events.append(event_note(lane,n,t+bar_len*.25,bar_len*.55,.0048,pan,.22,'ensemble',.55,attack=.16,release=.55,tuning_cents=(-4 if pan<0 else 4)))

def add_drums(events,spec,bar_len):
    d=spec['drums']
    for b in range(spec['bars']):
        t=b*bar_len
        def hit(inst,off,g=.035,pan=0,acc=1):
            if off<bar_len:events.append(event_drum(inst,t+off,g,pan,.035,acc))
        if d in ('none',):continue
        if d in ('folk_light','sea','water','air','orchestral_light','fairy'):
            hit('wood',0,.026,-.15,1);hit('shaker',bar_len*.5,.014,.24,.55)
            if b%4==3:hit('tom',bar_len-.35,.03,.15,.8)
        elif d in ('martial_light','duel','march','city_march','procession'):
            hit('snare',0,.03,-.05,.8);hit('snare',bar_len*.5,.035,.08,1);hit('tom',bar_len-.4,.028,.15,.65)
        elif d in ('rock','boss','industrial','air_combat','siege','martial_dark','space_battle','orchestral'):
            for off in [0,bar_len*.5]:hit('kick',off,.048,0,1)
            hit('snare',bar_len*.25,.041,.06,.88);hit('snare',bar_len*.75,.045,.06,1)
            for i in range(max(2,int(bar_len*2))):hit('hat',i*.5,.011,.2,.42 if i%2 else .58)
            if b%4==3:hit('impact',bar_len-.25,.045,0,.9)
        elif d in ('dnb','panic'):
            for off in [0,1.5,2.75]:hit('kick',off,.046,0,1)
            for off in [1,3]:hit('snare',off,.043,.06,1)
            for i in range(int(bar_len*4)):hit('hat',i*.25,.009,.22,.34 if i%2 else .48)
        elif d in ('tribal','frame','ritual','ritual_light','cave','elemental','mechanism'):
            hit('tom',0,.038,-.18,1);hit('tom',bar_len*.4,.03,.18,.72);hit('wood',bar_len*.7,.022,.1,.58)
        elif d in ('stalking','body_horror','cosmic','glitch_sparse'):
            if b%2==0:hit('impact',0,.026,-.08,.7)
            if b%3==1:hit('wood',bar_len*.72,.018,.22,.45)
        elif d in ('toy','brush_waltz','waltz'):
            hit('brush',0,.014,-.1,.55);hit('rim',bar_len/3,.018,.12,.65);hit('rim',2*bar_len/3,.017,.12,.58)
        elif d in ('market','festival','carnival','bazaar','tavern'):
            hit('wood',0,.025,-.12,1);hit('shaker',bar_len*.33,.014,.22,.55);hit('shaker',bar_len*.66,.016,.22,.65)
            if b%2:hit('tom',bar_len-.25,.026,.1,.7)
        elif d in ('bossa',):
            hit('kick',0,.022,-.05,.7);hit('rim',1,.025,.1,.85);hit('brush',2.5,.013,-.1,.48);hit('shaker',3,.012,.22,.45)
        elif d in ('brush_jazz','tight_jazz','slow_groove','swing','bebop'):
            for off in [0,1,2,3]:hit('ride',off,.012,.18,.45 if off%2==0 else .58)
            hit('brush',1,.018,-.12,.56);hit('brush',3,.02,-.12,.68)
            if d=='bebop':hit('snare',2.67,.018,.12,.45)
        elif d in ('funk',):
            hit('kick',0,.043,0,1);hit('snare',1,.038,.08,.9);hit('kick',2.5,.034,0,.7);hit('snare',3,.043,.08,1)
            for i in range(8):hit('hat',i*.5,.01,.22,.35 if i%2 else .52)
        elif d in ('one_drop','dub'):
            hit('rim',1,.022,.1,.65);hit('kick',2,.034,0,.85);hit('snare',2,.026,.08,.7);hit('hat',3.5,.01,.22,.4)
        elif d in ('ska',):
            hit('kick',0,.04,0,1);hit('snare',1,.038,.08,.9);hit('kick',2,.038,0,.86);hit('snare',3,.042,.08,1)
            for i in range(8):hit('hat',i*.5,.01,.2,.4)
        elif d in ('tango',):
            hit('kick',0,.033,0,.85);hit('rim',1.5,.024,.1,.7);hit('kick',2,.029,0,.68);hit('rim',3.25,.028,.1,.85)
        elif d in ('techno','synthwave','electro_battle','electronic_light'):
            for off in [0,1,2,3]:hit('kick',off,.044,0,1)
            hit('snare',1,.032,.07,.72);hit('snare',3,.039,.07,.9)
            for i in range(8):hit('hat',i*.5,.009,.22,.35 if i%2==0 else .45)
        elif d in ('electro_jazz','glitch'):
            hit('kick',0,.037,0,.85);hit('snare',1.5,.034,.08,.8);hit('kick',2.75,.031,0,.65);hit('hat',3.5,.01,.22,.4)
        elif d in ('meltdown',):
            for off in [0,.75,1.5,2.25,3]:hit('kick',off,.043,0,1 if off==0 else .65)
            hit('snare',1,.04,.08,.9);hit('snare',3,.045,.08,1)
        elif d in ('minimal',):
            hit('wood',0,.018,-.1,.55);hit('rim',bar_len*.6,.015,.15,.45)
        elif d in ('funeral','sacred'):
            hit('tom',0,.026,-.12,.65);hit('impact',bar_len-.2,.022,.12,.45)

def humanize(events,spec,bar_len):
    rng=random.Random(seed_for('human',spec['slug'],spec.get('seed','')))
    total=spec['bars']*bar_len
    for i,e in enumerate(events):
        beat=e['beat']; phrase=(beat%(bar_len*2))/(bar_len*2)
        role=e.get('role',''); family=INSTRUMENTS[e['inst']][4]
        # Phrase-correlated timing rather than independent random jitter.
        rubato=0
        if spec['category'] in ('emotion','horror','classical','fantasy'):rubato=-8*math.sin(2*math.pi*phrase)
        elif spec['category'] in ('urban','towns','adventure'):rubato=-4*math.sin(2*math.pi*phrase)
        placement=0
        if role=='lead':placement=1.5
        elif role in ('pad','ensemble'):placement=7
        elif role=='bass':placement=-1.5 if spec['category'] in ('urban','action') else 1
        if e['inst'] in ('snare','rim','brush'):placement+=5
        if e['inst']=='kick':placement=0
        bar=int(beat/bar_len); local_rng=random.Random(seed_for(spec['slug'],spec.get('seed',''),bar,i%7)); noise=local_rng.uniform(-3.5,3.5)
        if spec['category'] in ('electronic','action') and spec['drums'] not in ('brush_jazz','bossa'):noise*=.45
        offset_ms=rubato+placement+noise
        e['start_offset_ms']=round(offset_ms,3);e['performance_beat']=round((beat+offset_ms*spec['bpm']/60000)%total,5)
        section_index=min(3,int((beat/total)*4));section_curve=[.9,1.0,1.08,.96][section_index]
        phr_curve=.9+.16*math.sin(math.pi*phrase)
        role_curve=1.05 if role=='lead' else .94 if role in ('pad','support','ensemble') else 1
        e['performance_gain']=round(max(.62,min(1.35,section_curve*phr_curve*role_curve*(1+rng.uniform(-.035,.035)))),4)
        e['performance_pan']=round(max(-1,min(1,e.get('pan',0)+rng.uniform(-.018,.018))),4)
        if e['kind']=='note':
            dur=e['duration'];dscale=.91+.1*(phrase**2)
            if family in ('strings','choir','texture'):dscale=1.04
            e['performance_duration']=round(max(.04,dur*dscale),4)
            e['tuning_cents']=round(rng.uniform(-1.8,1.8),3)
            if family in ('wind','strings') and dur>.55:
                e['performance_vibrato_depth']=round(rng.uniform(.05,.14),3);e['vibrato_delay_ms']=round(rng.uniform(120,240),2)
        else:
            e['tuning_cents']=round(rng.uniform(-4,4),3);e['sample_offset_ms']=round(max(0,rng.gauss(1,1)),3)
    # Stagger block instruments.
    groups=defaultdict(list)
    for e in events:
        if e['kind']=='note' and INSTRUMENTS[e['inst']][4] in ('keys','guitar','pluck','mallet'):
            groups[(e['inst'],round(e['beat']*16)/16)].append(e)
    for (inst,_),grp in groups.items():
        if len(grp)<2:continue
        grp.sort(key=lambda x:x['midi']);spread={'guitar':18,'piano':14,'harp':9,'harpsichord':7,'accordion':12}.get(inst,8);center=(len(grp)-1)/2
        for i,e in enumerate(grp):
            e['start_offset_ms']=round(e.get('start_offset_ms',0)+(i-center)*spread,3);e['performance_beat']=round((e['beat']+e['start_offset_ms']*spec['bpm']/60000)%total,5)

def apply_velocity_expression(events,spec,bar_len):
    """Give every exported lane deterministic, role-aware MIDI dynamics."""
    role_base={
      'lead':92,'counter':80,'riff':88,'bass':84,'kick':108,'snare':100,'hat':61,'tom':90,
      'wood':78,'ride':66,'shaker':58,'brush':55,'rim':74,'impact':112,'comp':70,'arp':68,
      'motor':74,'ostinato':76,'pad':54,'support':64,'ensemble':50,'pulse':72,'texture':46,
    }
    role_limits={
      'lead':(54,118),'counter':(46,108),'riff':(58,120),'bass':(52,114),'kick':(80,124),
      'snare':(62,121),'hat':(30,88),'tom':(54,116),'pad':(26,78),'support':(32,88),
      'ensemble':(24,74),'texture':(20,70),
    }
    total=max(.001,spec['bars']*bar_len)
    for i,e in enumerate(events):
        role=e.get('role','support');base=role_base.get(role,68);lo,hi=role_limits.get(role,(30,112))
        beat=float(e.get('performance_beat',e['beat']));position=beat%bar_len
        accent=max(.35,min(1.2,float(e.get('accent',1))))
        performance=max(.62,min(1.35,float(e.get('performance_gain',1))))
        phrase=.9+.12*math.sin(math.pi*((beat%(bar_len*4))/(bar_len*4)))
        section=.92+.12*min(1,beat/total)
        metric=1.08 if position<.06 else 1.025 if abs(position-bar_len/2)<.06 else .96
        repeat=((-1,1,0)[i%3])/base
        velocity=round(base*(.66+.34*accent)*(.78+.22*performance)*phrase*section*metric*(1+repeat))
        velocity=int(max(lo,min(hi,velocity)))
        e['velocity']=velocity;e['velocity_norm']=round(velocity/127,4);e['velocity_gain']=round(velocity/max(1,base),4)

def peak_polyphony(events,total_beats):
    points=[]
    for e in events:
        start=e.get('performance_beat',e['beat']);dur=.12 if e['kind']=='drum' else e.get('performance_duration',e.get('duration',.2))
        end=start+dur
        if end<=total_beats:points.extend([(start,1),(end,-1)])
        else:points.extend([(start,1),(total_beats,-1),(0,1),(end-total_beats,-1)])
    points.sort(key=lambda x:(x[0],x[1]));cur=peak=0
    for _,d in points:cur+=d;peak=max(peak,cur)
    return peak

def compose(spec,category,label):
    spec=dict(spec);spec['category']=category;spec['category_label']=label
    bar_len=METERS[spec['meter']];total=bar_len*spec['bars'];chords=chord_plan(spec);sections=form_sections(spec);events=[]
    melody=motif_events(spec,bar_len,chords,sections);events.extend(melody)
    add_bass(events,spec,bar_len,chords);add_accompaniment(events,spec,bar_len,chords);add_counterpoint(events,spec,bar_len,chords,melody);add_pad_layers(events,spec,bar_len,chords);add_expanded_ensemble(events,spec,bar_len,chords);add_drums(events,spec,bar_len);humanize(events,spec,bar_len);apply_velocity_expression(events,spec,bar_len)
    # Ensure budget is a declared target, not a constant fill requirement. The actual peak may be lower.
    peak=peak_polyphony(events,total)
    if peak>32:
        # Drop the quietest ensemble/pad events until the benchmark maximum is respected.
        removable=sorted([e for e in events if e.get('role') in ('ensemble','pad','support')],key=lambda e:e['gain']*e.get('performance_gain',1))
        while peak>32 and removable:
            events.remove(removable.pop(0));peak=peak_polyphony(events,total)
    used=[]
    for e in events:
        if e['inst'] not in used:used.append(e['inst'])
    imap={x:{'sample':INSTRUMENTS[x][0].replace('.wav',''),'file':INSTRUMENTS[x][0],'root_midi':INSTRUMENTS[x][1],'label':x.replace('_',' ').title(),'color':INSTRUMENTS[x][2],'family':INSTRUMENTS[x][4]} for x in used}
    chord_data=[{'bar':i,'symbol':c['symbol'],'root_pc':c['root_pc'],'pcs':sorted(c['pcs'])} for i,c in enumerate(chords)]
    return {
      'id':spec['slug'],'title':spec['title'],'category':category,'category_label':label,'subcategory':spec['subcategory'],
      'kicker':f"{label.upper()} · {spec['meter']}",'description':f"{spec['subcategory']} study using {spec['mode'].replace('_',' ')} harmony, {spec['comp'].replace('_',' ')} texture and a {spec['budget']}-voice target architecture.",
      'bpm':spec['bpm'],'beats':round(total,3),'bars':spec['bars'],'meter':spec['meter'],'barLength':bar_len,'key':spec['key'],'mode':spec['mode'],
      'voice_budget':spec['budget'],'measured_peak_voices':peak,'form':sections,'chord_plan':chord_data,'events':sorted(events,key=lambda e:(e.get('performance_beat',e['beat']),e.get('midi',0))),
      'instrument_map':imap,'tags':list(spec['tags'])+[spec['subcategory'].lower().replace(' ','-')],
      'dna':{'form':' '.join(section['name'] for section in spec['form']) if isinstance(spec['form'],list) else spec['form'],'motif':spec['motif'].replace('_',' '),'texture':spec['comp'].replace('_',' '),'bass':spec['bass'].replace('_',' '),'drums':spec['drums'].replace('_',' ')},
      'musical_direction':{'thesis':spec['notes'] or f"A distinct {spec['subcategory'].lower()} identity with controlled density and section-level role changes.", 'loop_strategy':'Final cadence and pickup are designed around the first harmony rather than a hard audio cut.'},
      'metrics':{'energy':spec['energy'],'tension':spec['tension']},
      'mix':{'echo_time':.18 if category in ('action','electronic') else .28 if category in ('horror','fantasy','classical') else .22,'echo_feedback':.14 if category in ('action','electronic') else .22,'preview_rms_db':-14.5 if spec['energy']>.75 else -15.5,'drive':.08 if category=='action' else .03 if category=='electronic' else 0}
    }

def topology_signature(style):
    bl=style['barLength'];sig=[]
    for e in style['events']:
        pos=round((e['beat']%bl)/bl,3);sig.append((e['role'],pos))
    return tuple(sorted(set(sig)))

def melody_signature(style):
    notes=[e for e in style['events'] if e['kind']=='note' and e.get('role')=='lead']
    notes=sorted(notes,key=lambda e:e['beat'])[:20]
    if len(notes)<2:return ()
    return tuple(notes[i+1]['midi']-notes[i]['midi'] for i in range(len(notes)-1))

def audit(styles):
    report={'track_count':len(styles),'category_counts':{},'voice_budget_distribution':{},'meter_distribution':{},'errors':[],'warnings':[]}
    for c,_ in CATEGORY_DEFS:report['category_counts'][c]=sum(1 for s in styles if s['category']==c)
    for s in styles:
        report['voice_budget_distribution'][str(s['voice_budget'])]=report['voice_budget_distribution'].get(str(s['voice_budget']),0)+1
        report['meter_distribution'][s['meter']]=report['meter_distribution'].get(s['meter'],0)+1
        if s['measured_peak_voices']>32:report['errors'].append(f"{s['id']}: peak {s['measured_peak_voices']}")
        if len(s['events'])<35:report['warnings'].append(f"{s['id']}: sparse event count")
        if not any(e.get('role')=='lead' for e in s['events']):report['errors'].append(f"{s['id']}: no lead")
    if any(v!=10 for v in report['category_counts'].values()):report['errors'].append('category count mismatch')
    # exact duplicate checks
    ms=defaultdict(list);ts=defaultdict(list)
    for s in styles:ms[melody_signature(s)].append(s['id']);ts[topology_signature(s)].append(s['id'])
    report['exact_melody_duplicate_groups']=[v for k,v in ms.items() if k and len(v)>1]
    report['exact_topology_duplicate_groups']=[v for k,v in ts.items() if k and len(v)>1]
    if report['exact_melody_duplicate_groups']:report['warnings'].append('exact melody signatures detected')
    report['status']='PASS' if not report['errors'] else 'FAIL'
    report['total_events']=sum(len(s['events']) for s in styles)
    report['max_measured_peak']=max(s['measured_peak_voices'] for s in styles)
    report['avg_measured_peak']=round(sum(s['measured_peak_voices'] for s in styles)/len(styles),2)
    return report

def main(argv=None):
    parser = argparse.ArgumentParser(description='Rebuild the deterministic Neo-SPC v4 benchmark into an explicit output directory.')
    parser.add_argument('--output', type=Path, required=True, help='Directory that receives neospc100.json and qa-symbolic.json.')
    args = parser.parse_args(argv)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    styles=[]
    for category,label in CATEGORY_DEFS:
        for spec in SPECS[category]:styles.append(compose(spec,category,label))
    report=audit(styles)
    catalog={'version':'4.0.0-base','project':'Neo-SPC 100 / Full Rebuild Base','voice_model':{'recommended':16,'profiles':[8,12,16,24,32],'benchmark_max':32,'hard_hardware_limit_removed':True},'categories':[{'id':c,'label':l,'count':10} for c,l in CATEGORY_DEFS],'styles':styles}
    (output/'neospc100.json').write_text(json.dumps(catalog,indent=2))
    (output/'qa-symbolic.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
