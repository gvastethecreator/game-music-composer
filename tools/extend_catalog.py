"""Compose, verify and append the four authored genre collections to the Studio."""
import argparse, copy, hashlib, json, shutil, sys, zipfile
from collections import Counter
from pathlib import Path
import regenerate_catalog as r

ROOT,SKILL,STUDIO=r.ROOT,r.SKILL,r.STUDIO
GENRES={'bachata','trip_hop','trap','reggaeton'}
SOURCES=['scripts/genre_composer.py','scripts/phrase_composer.py','scripts/generate_neospc100_v3.py','data/genre-expansion-contracts.json','scripts/render_mix_v4.py','scripts/export_midis_v4.py']

def compact(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n',encoding='utf-8',newline='\n')

def js_read(path):return json.loads(path.read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))

def genre_checks(s):
    events=s['events'];genre=s['category']
    def onsets(inst,bar=0):return {round(e['beat']-bar*4,4) for e in events if e['inst']==inst and bar*4<=e['beat']<(bar+1)*4}
    if genre=='bachata':
        assert {60,61}=={e['midi'] for e in events if e['inst']=='tom'}
        assert not any(e['inst']=='kick' for e in events)
        assert s['instrument_map']['guitar']['factory_patch']=='guitar.requinto'
    elif genre=='trip_hop':
        hats=[e for e in events if e['inst']=='hat' and e['beat']%1==.5]
        assert hats and all(e['performance_beat']>e['beat']+.04 for e in hats)
        assert {1,3}<=onsets('snare')
    elif genre=='trap':
        assert onsets('snare')=={2}
        assert len([x for x in onsets('hat',1) if x>=3.5])>=3
        assert s['instrument_map']['sub']['factory_patch']=='bass.sub_sine'
    elif genre=='reggaeton':
        assert onsets('snare')=={.75,1.5,2.75,3.5}
        assert {0,2}<=onsets('kick')
    for bar in s['writing_evidence']['drop_bars']:
        assert not any(e.get('role')=='lead' and bar*4<=e['beat']<(bar+1)*4 for e in events)

def prepare(out,banks):
    out.mkdir(parents=True,exist_ok=False)
    old=r.read(SKILL/'data/neospc100-benchmark-v4.1.json')
    records=r.read(SKILL/'data/genre-expansion-contracts.json')['contracts']
    assert Counter(x['category'] for x in records)=={g:10 for g in GENRES}
    assert {x['id'] for x in records}.isdisjoint(s['id'] for s in old['styles'])
    r.write(out/'previous-catalog.json',old)
    for name in ('neospc100-source-v4.zip','neospc100-midis-v4.zip'):
        shutil.copyfile(STUDIO/'downloads'/name,out/('previous-'+name))
    r.write(out/'previous-artifacts.json',{f'{folder}/{s["id"]}.{ext}':r.file_hash(STUDIO/'assets'/folder/f'{s["id"]}.{ext}') for s in old['styles'] for folder,ext in [('audio','mp3'),('audio','ogg'),('midi','mid')]})
    for name in ('factory-bank.js','studio-palettes.js','factory-bank-previews.js','reviews.js'):
        shutil.copyfile(STUDIO/'data'/name,out/('previous-'+name))
    shutil.copyfile(SKILL/'data/factory-bank-manifest.json',out/'previous-bank-manifest.json')
    manifest=r.read(banks/'factory-bank-manifest.json');patches={p['id']:p for p in manifest['patches']}
    sources={name:r.file_hash(SKILL/name) for name in SOURCES};styles=[]
    for index,record in enumerate(records):
        spec=record['native_engine_contract'];s=r.engine.compose(spec,record['category'],record['category_label'])
        assert not r.composer.first_overflow(s['events'],s['beats'],spec['budget']),(s['id'],'voice overflow')
        r.composer.apply_factory_assignments(s)
        for inst,patch in record['patch_overrides'].items():
            if inst in s['instrument_map']:s['instrument_map'][inst].update(factory_patch=patch,factory_label=patches[patch]['label'],factory_profile='neo16',factory_source='genre_blueprint')
        s['source_type']='generated_catalog';s['generation_epoch']='four-genres-1'
        s['generation']={'workflow':'authored-genre-blueprint','engine':s['writing_evidence']['engine'],'contract_sha256':r.digest(record),'skill_sources':sources}
        s['composition_contract']={k:copy.deepcopy(record[k]) for k in ('revision','game_function','musical_direction','listening_checks')}
        assert not r.neospc.validate_composition(s),(s['id'],r.neospc.validate_composition(s))
        genre_checks(s);styles.append(s)
        r.write(out/'projects'/s['id']/'composition-contract.json',record)
        if (index+1)%10==0:print(f'Composed {index+1}/40',flush=True)
    review=r.reviews(styles);reviews={t['id']:t for t in review['tracks']}
    for s in styles:
        t=reviews[s['id']];s['professor_review_pass1']=t;s['professor_review_final']=t
        s['composition_quality']={'status':{'approved':'curated','revise':'review','rebuild':'rebuild'}[t['status']],'score':t['score'],'reasons':t['critique'],'method':'symbolic; human listening pending'}
        r.write(out/'projects'/s['id']/'composition.json',s)
    catalog=copy.deepcopy(old);catalog['styles']+=styles
    catalog['categories'] += [{'id':g,'label':next(x['category_label'] for x in records if x['category']==g),'count':10} for g in ('bachata','trip_hop','trap','reggaeton')]
    catalog['version']='6.1.0-four-genres';catalog['project']='Game Music Composer / Studio'
    catalog['expansion']={'revision':'four-genres-1','added':40,'preserved':len(old['styles']),'human_listening':'pending','skill_sources':sources}
    r.write(out/'inputs.json',{'skill_sources':sources,'contracts':records})
    compact(out/'catalog.json',catalog)
    compact(out/'render-catalog.json',{**catalog,'styles':styles,'categories':catalog['categories'][-4:]})
    r.write(out/'review.json',review);r.write(out/'diversity-audit.json',r.engine.audit(catalog['styles']))
    print(f'Prepared {len(styles)} additions / {len(catalog["styles"])} total / {sum(len(s["events"]) for s in styles)} new events',flush=True)

def verify(out,banks):
    import numpy as np,soundfile as sf,mido
    catalog=r.read(out/'catalog.json');old=r.read(out/'previous-catalog.json');new=r.read(out/'render-catalog.json')['styles']
    assert len(catalog['styles'])==140 and len(catalog['categories'])==14
    assert Counter(s['category'] for s in catalog['styles'])=={c['id']:10 for c in catalog['categories']}
    assert catalog['styles'][:len(old['styles'])]==old['styles']
    assert not r.neospc.validate_catalog(catalog)
    for name,digest in r.read(out/'previous-artifacts.json').items():assert r.file_hash(STUDIO/'assets'/name)==digest,('Existing export changed',name)
    for name,digest in r.read(out/'inputs.json')['skill_sources'].items():assert r.file_hash(SKILL/name)==digest,('Source changed since composition',name)
    audit=r.read(out/'bank-audit.json');assert audit['errors']==audit['warnings']==0 and audit['coverage']==1,audit
    mix=r.read(out/'audio/mix-report.json');assert {t['id'] for t in mix}=={s['id'] for s in new} and not any(t.get('skipped') for t in mix)
    assert all(t.get('sample_backend')=='multisample' for t in mix)
    assert len({r.engine.melody_signature(s) for s in new})==40,'Duplicate melody signature'
    files={};measurements=[]
    for s in new:
        genre_checks(s);ident=s['id'];seconds=s['beats']*60/s['bpm']
        for ext in ('ogg','mp3'):
            path=out/'audio'/f'{ident}.{ext}';y,sr=sf.read(path,always_2d=True,dtype='float32')
            assert sr==32000 and y.shape[1]==2 and np.isfinite(y).all()
            peak=float(np.max(np.abs(y)));rms=float(np.sqrt(np.mean(y.astype(np.float64)**2)))
            assert 1e-4<peak<1 and rms>1e-5 and abs(len(y)/sr-seconds)<.15,(ident,peak,rms)
            files['audio/'+path.name]=r.file_hash(path);measurements.append({'id':ident,'format':ext,'seconds':len(y)/sr,'peak':peak,'rms':rms})
        path=out/'midi'/f'{ident}.mid';mid=mido.MidiFile(path)
        notes=[m for tr in mid.tracks for m in tr if m.type=='note_on' and m.velocity>0]
        assert mid.type==1 and len(notes)==len(s['events']),(ident,len(notes),len(s['events']))
        if s['category']=='bachata':assert {60,61} <= {m.note for m in notes if m.channel==9}
        files['midi/'+path.name]=r.file_hash(path)
    receipt=r.read(banks/'addition-receipt.json')
    for name,digest in receipt['new_files'].items():assert r.file_hash(banks/name)==digest,name
    result={'passed':True,'added_cues':40,'preserved_cues':100,'catalog_cues':140,'categories':14,'new_files':files,'genre_rhythms_and_breakdowns_checked':True,'human_listening':'pending','measurements':measurements}
    r.write(out/'verification.json',result)
    print('PASS: 40 additions, 80 audio files, 40 MIDI files; existing 100 cues and 300 exports unchanged.',flush=True)

def publish(out,banks):
    proof=r.read(out/'verification.json');assert proof['passed']
    if r.read(SKILL/'data/neospc100-benchmark-v4.1.json') != r.read(out/'previous-catalog.json'):
        raise ValueError('The base catalog changed or this expansion is already published.')
    for name,digest in proof['new_files'].items():assert r.file_hash(out/name)==digest,name
    for name,digest in r.read(out/'previous-artifacts.json').items():assert r.file_hash(STUDIO/'assets'/name)==digest,name
    for name,digest in r.read(out/'inputs.json')['skill_sources'].items():assert r.file_hash(SKILL/name)==digest,name
    receipt=r.read(banks/'addition-receipt.json')
    for name,digest in receipt['new_files'].items():
        assert r.file_hash(banks/name)==digest,name
        target=STUDIO/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(banks/name,target)
    shutil.copyfile(banks/'factory-bank-manifest.json',SKILL/'data/factory-bank-manifest.json')
    for name in proof['new_files']:shutil.copyfile(out/name,STUDIO/'assets'/name)
    catalog=r.read(out/'catalog.json');compact(SKILL/'data/neospc100-benchmark-v4.1.json',catalog)
    review=js_read(out/'previous-reviews.js');addition=r.read(out/'review.json')
    for phase in ('pass1','final'):
        review[phase]['tracks']+=addition['tracks'];tracks=review[phase]['tracks']
        review[phase]['summary']=dict(Counter(t['status'] for t in tracks));review[phase]['average_score']=round(sum(t['score'] for t in tracks)/len(tracks),2)
    (STUDIO/'data/reviews.js').write_text('window.NEOSPC_REVIEWS='+json.dumps(review,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8',newline='\n')
    for folder,report in [('audio','mix-report.json'),('midi','midi-report.json')]:
        path=STUDIO/'assets'/folder/report;old_reports=r.read(path)
        r.write(path,old_reports+r.read(out/folder/report))
    with zipfile.ZipFile(STUDIO/'downloads/neospc100-midis-v4.zip','w',zipfile.ZIP_DEFLATED) as z:
        for s in catalog['styles']:z.write(STUDIO/'assets/midi'/f'{s["id"]}.mid',f'midi/{s["id"]}.mid')
        z.write(STUDIO/'assets/midi/midi-report.json','midi/midi-report.json')
    replacements={'catalog.json','inputs.json','review-composed.json','review-performed.json','diversity-audit.json','bank-audit.json','verification.json','verification.md','regeneration-report.json'}
    with zipfile.ZipFile(out/'previous-neospc100-source-v4.zip') as old,zipfile.ZipFile(STUDIO/'downloads/neospc100-source-v4.zip','w',zipfile.ZIP_DEFLATED) as z:
        old_inputs=json.loads(old.read('inputs.json'));old_inputs['contracts']+=r.read(out/'inputs.json')['contracts'];old_inputs['expansion']=r.read(out/'inputs.json')['skill_sources']
        for item in old.infolist():
            name=item.filename
            if name.startswith(('generation/','tools/')):continue
            if name in replacements or name=='audio/mix-report.json':name='history/phrase-studio-1/'+name
            z.writestr(name,old.read(item))
        for name,value in [('catalog.json',catalog),('inputs.json',old_inputs),('review-composed.json',review['pass1']),('review-performed.json',review['final'])]:z.writestr(name,json.dumps(value,ensure_ascii=False,separators=(',',':')))
        for name in ('verification.json','diversity-audit.json','bank-audit.json'):z.write(out/name,name)
        z.write(STUDIO/'assets/audio/mix-report.json','audio/mix-report.json')
        for p in (out/'projects').rglob('*.json'):z.write(p,p.relative_to(out).as_posix())
        for name in SOURCES+['scripts/compose_from_plan.py','scripts/studio_timbres.py','scripts/refine_performance.py','scripts/professor_review.py','scripts/midi_compat.py','scripts/synthesize_soundbanks.py','data/catalog-contracts-r03.json','data/factory-bank-manifest.json','data/soundbank-provenance.json','data/instrument-calibration.json','resources/original-sample-bank/sample-bank.json']:z.write(SKILL/name,'generation/'+name)
        for name in ('extend_catalog.py','add_genre_patches.py','write_genre_contracts.py','regenerate_catalog.py','build_soundbanks.py','build_studio_palettes.py','write_studio_blueprints.py'):z.write(ROOT/'tools'/name,'tools/'+name)
        z.writestr('README.txt','140 instrumental cues. The first 100 retain the Phrase Studio release; 40 new genre cues are verified in verification.json. Historical verification is under history/. All scores have symbolic review; human listening remains pending.\n')
    print('Published 140-cue catalog, forty new exports, four patches and both archives.',flush=True)

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('phase',choices=['prepare','verify','publish']);ap.add_argument('output',type=Path);ap.add_argument('--banks',type=Path,required=True);a=ap.parse_args()
    globals()[a.phase](a.output.resolve(),a.banks.resolve())
