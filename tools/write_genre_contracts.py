"""Write forty original instrumental blueprints for four new Studio categories."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'game-music-composer/data'
NAMES={
'bachata':['Balcon de Sal','Carta sin Sello','Dos Pasos Tarde','Jazmin de Patio','La Ultima Guagua','Luna en el Malecon','Madera y Miel','Promesa de Abril','Sombra de Almendro','Vuelve Despacio'],
 'trip_hop':['Static at Dawn','Glass Elevator','Undertow Radio','Blue Hour Motel','Paper Satellites','Velvet Underpass','Slow Exit','Rain on Tape','Faded Coordinates','Afterimage Hotel'],
 'trap':['Chrome Staircase','Midnight Inventory','Cold Orbit','Quartz Teeth','Low Battery Crown','Smoke Arithmetic','Ghost Freight','Basement Constellation','No Signal Halo','Ash on Satin'],
 'reggaeton':['Faro de Neon','Cruce de Miradas','Marea de Asfalto','Patio Encendido','Sal en la Pista','Semaforo Azul','Calle de Cristal','Puerta del Sur','Noche sin Prisa','Pulso de Arena']}
LABELS={'bachata':'Bachata','trip_hop':'Trip hop','trap':'Trap','reggaeton':'Reguetón'}
SUBS={
 'bachata':['Guitar conversation','Minor serenade','Bright street dance','Quiet courtyard','Driving requinto','Open-air romance','Muted guitar pocket','Major-key return','Sparse bolero color','Mambo lift'],
 'trip_hop':['Dusty keys','Noir vibraphone','Dub-weight bass','Sparse cinematic beat','Suspended harmony','Muted guitar haze','Broken beat','Warm tape piano','Floating reed','Half-lit organ'],
 'trap':['Bell hook','Dark piano','Minimal sub-bass','Tight synth stabs','Wide pad space','Triplet hat pocket','Picked motif','Low-register keys','Glass counterline','Sparse melodic trap'],
 'reggaeton':['Bright pluck','Minor guitar','Club dembow','Percussion dialogue','Warm melodic hook','Sparse night groove','Synth response','Muted-key pocket','Slow dembow','Open-air lift']}
CELLS={
'bachata':['0 2 4 5 4 2 3 1','2 4 3 1 0 2 1 -1','4 5 7 4 2 3 1 2','0 3 2 4 1 2 0 1','2 2 4 3 5 4 1 0','4 2 1 3 2 0 1 4','0 2 1 4 3 5 2 1','2 4 6 5 3 4 2 0','4 1 3 2 0 1 -1 2','0 4 3 5 4 6 2 1'],
 'trip_hop':['2 0 3 1 4 2 1 -1','4 1 2 0 3 2 -1 1','0 3 1 4 2 0 1 -1','2 5 3 4 1 2 0 1','4 6 3 5 2 4 1 0','0 2 4 1 3 0 2 -1','3 1 4 2 5 0 2 1','2 4 1 3 0 2 -1 0','4 2 5 1 3 2 0 1','0 1 3 2 4 1 2 0'],
 'trap':['0 4 2 1 5 3 2 0','2 0 4 1 3 5 1 0','0 0 3 1 4 2 1 -1','4 2 0 3 1 4 2 5','2 5 3 1 4 0 2 1','0 3 4 2 1 5 3 0','4 1 2 5 3 0 1 2','0 2 1 3 0 4 2 -1','2 4 6 3 5 1 2 0','4 3 1 0 2 1 5 2'],
 'reggaeton':['0 2 4 2 5 3 1 0','2 1 4 3 5 2 0 1','4 2 0 3 2 5 1 2','0 3 2 1 4 2 5 3','2 4 5 3 1 2 4 0','0 1 3 2 4 0 2 1','4 5 2 4 1 3 2 0','2 0 4 1 3 2 5 1','4 2 1 3 0 2 1 -1','0 4 2 5 3 1 4 2']}
ANSWERS=['5 4 2 3 1 2 1 0','3 2 4 1 2 0 -1 0','7 5 4 2 3 1 2 0','4 3 1 2 0 1 2 0','5 3 4 2 1 3 1 0','3 4 2 1 0 2 1 0','4 2 5 3 1 2 0 1','6 5 3 4 2 1 3 0','3 1 4 2 0 2 1 0','5 4 6 3 2 4 1 0']
TEMPOS={'bachata':[122,116,132,108,136,120,126,130,112,140],'trip_hop':[76,82,70,88,74,80,92,72,84,78],'trap':[138,144,132,152,140,146,156,134,148,142],'reggaeton':[94,88,102,98,92,86,100,96,84,104]}
PROGS=[['i','bVI','bVII','V'],['i','iv','bVI','V7'],['I','vi','IV','V'],['i7','iv7','bVImaj7','V7'],['i','bVII','iv','V'],['Imaj7','vi7','ii7','V7'],['i','bVI','iv','V'],['I','IV','ii','V'],['i7','bVImaj7','iv7','V7'],['i','iv','bVII','V']]
RHYTHMS={
'bachata':[[[0,.125,.375,.625,.75,.875],[0,.25,.375,.625,.875]],[[.125,.25,.5,.75],[0,.125,.375,.625,.75]],[[0,.25,.5,.625,.875],[.125,.375,.5,.75]]],
 'trip_hop':[[[0,.375,.6875],[.125,.5,.75]],[[.125,.4375],[0,.375,.625]],[[0,.25,.625],[.1875,.5,.8125]]],
 'trap':[[[0,.375],[.125,.5,.875]],[[0,.25,.625],[.375,.75]],[[.125,.5],[0,.375,.8125]]],
 'reggaeton':[[[0,.1875,.375,.75],[.125,.375,.625,.875]],[[.125,.375,.5,.75],[0,.1875,.625,.75]],[[0,.25,.4375,.75],[.1875,.375,.6875]]]}

def main():
    records=[]
    import re
    for genre,label in LABELS.items():
        for i,title in enumerate(NAMES[genre]):
            ident=genre+'_'+re.sub('[^a-z0-9]+','_',title.lower()).strip('_');major=i in (2,5,7);mode='major' if major else 'minor'
            lead={'bachata':'guitar','trip_hop':['piano','vibes','muted_guitar','strings','bell','muted_guitar','clav','piano','reed','organ'][i],'trap':['bell','piano','synth_lead','pulse25','synth_pad','bell','muted_guitar','piano','vibes','harp'][i],'reggaeton':['synth_lead','guitar','pulse25','clav','vibes','piano','pulse50','muted_guitar','bell','harp'][i]}[genre]
            harmony='muted_guitar' if genre=='bachata' else 'piano' if genre=='trip_hop' else 'synth_pad' if genre=='trap' else ('guitar' if lead!='guitar' else 'clav')
            bass='sub' if genre=='trap' else 'bass' if genre=='bachata' else 'synth_bass'
            palette='factory' if genre in ('bachata','trap') else 'velvet' if genre=='trip_hop' else ('circuit' if i in (2,6) else 'factory')
            spans=[4,4,4,4] if i%3==0 else [4,8,4,4] if i%3==1 else [4,4,4,8]
            if i==9:spans=[4,8,8,4]
            bars=sum(spans);drop=[sum(spans[:2])+j for j in (0,2)]
            basspatterns={'bachata':[[0,1.5,2.5,3.5],[0,1,2.5,3.5],[0,1.5,3,3.5]],'trip_hop':[[0,1.75,3.25],[0,.75,2.5],[.0,2.25,3.5]],'trap':[[0,1.5,3.5],[0,.75,2.75,3.5],[0,1.75,3.25]],'reggaeton':[[0,1.5,2,3.5],[0,.75,2.5,3.5],[0,1.5,2.75]]}
            kickpatterns={'bachata':[[]]*3,'trip_hop':[[0,1.75,2.5],[0,.75,2.75],[0,2,3.5]],'trap':[[0,1.5,3.5],[0,.75,2.75],[0,1.75,3.25]],'reggaeton':[[0,2],[0,1.75,2],[0,2,3.75]]}
            progression=PROGS[i]
            writing={'version':'genres-1','grammar':genre,'variant':i,'degrees':list(map(int,CELLS[genre][i].split())),'answer':list(map(int,ANSWERS[(i+(0 if genre=='bachata' else 3))%10].split())),'rhythm':RHYTHMS[genre][i%3],'roles':[lead,harmony,bass],'harmony':progression,'contrast_harmony':['vi','ii','IV','V'] if major else ['iv','bVI','iiø7','V7'],'bass_onsets':[0,.375,.625],'bass_pattern':basspatterns[genre][i%3],'comp_pattern':([.5,1,1.5,2.5,3,3.5] if i%2 else [.5,1.5,2,2.5,3.5]) if genre=='bachata' else ([.75,2.5,3.5] if i%2 else [0,1.5,2.75]),'kick_pattern':kickpatterns[genre][i%3],'percussion':True,'palette':palette,'swing':(.12+.015*i) if genre=='trip_hop' else 0,'drop_bars':drop}
            note=f"{SUBS[genre][i]}. State the original hook, develop its answer, thin the middle section and bring the groove back with a clear last phrase."
            spec={'slug':ident,'title':title,'subcategory':SUBS[genre][i],'bpm':TEMPOS[genre][i],'meter':'4/4','bars':bars,'key':['D','A','G','C','E','F','B','Bb','F#','Eb'][i],'mode':mode,'budget':12,'prog':'journey','motif':'rising_fourth','motif_answer':'step_answer','lead':lead,'secondary':None,'comp':genre,'comp_b':genre+'_breakdown','bass':'pedal','drums':genre,'architecture':'period','energy':.48 if genre=='trip_hop' else .68,'tension':.35 if major else .58,'tags':[genre,SUBS[genre][i].lower()],'notes':note,'form':[{'name':n,'bars':b,'function':f,'intensity':a} for n,b,f,a in zip(['A','A2','B','A3'],spans,['Introduce the hook and pocket.','Answer and build the groove.','Leave foreground space in a breakdown.','Return with a phrase-end fill.'],[.54,.72,.38,.68])],'phrases':[{'bars':b,'kind':'consequent' if n%2 else 'antecedent','closing':bool(n%2)} for n,b in enumerate(spans)],'role_rests':[{'start_bar':sum(spans)-.0625,'end_bar':sum(spans),'roles':['lead','comp','support'],'purpose':'Release the final foreground before the loop.'}],'loop_strategy':'The last phrase returns to the home chord and leaves a short foreground release.','writing':writing}
            overrides={bass:'bass.sub_sine' if genre=='trap' else 'bass.electric_finger' if genre=='bachata' else 'bass.analog_round'}
            if genre=='bachata':overrides.update(guitar='guitar.requinto',muted_guitar='guitar.segunda',tom='drums.bongo',shaker='drums.guira')
            records.append({'id':ident,'category':genre,'category_label':label,'revision':'genre-expansion-1','game_function':SUBS[genre][i],'musical_direction':note,'status':'written; listening pending','native_engine_contract':spec,'patch_overrides':overrides,'listening_checks':['Recognizable genre rhythm','Distinct hook and answer','Bass and drums leave room for each other','Loop and breakdown feel intentional']})
    (DATA/'genre-expansion-contracts.json').write_text(json.dumps({'version':'1.0.0','categories':list(LABELS),'contracts':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('Wrote forty genre blueprints')
if __name__=='__main__':main()
