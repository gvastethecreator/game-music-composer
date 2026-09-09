#!/usr/bin/env python3
"""Recompose the 100 native cue contracts, then publish verified fresh exports."""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
from pathlib import Path
import shutil
import sys
import zipfile
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
SKILL=ROOT/'game-music-composer'
STUDIO=ROOT/'game-music-composer-showcase'
sys.path.insert(0,str(SKILL/'scripts'))
import generate_neospc100_v3 as engine
import compose_from_plan as composer
import refine_performance as performance
import professor_review as professor
import neospc

def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8',newline='\n')
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def file_hash(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def reviews(styles):
    tracks=[professor.review(s,siblings=styles) for s in styles]
    return {'version':'3.0.0','reviewer':'Neo-SPC Symbolic Review','method':'Deterministic symbolic review; human listening and mastering approval excluded','summary':dict(Counter(t['status'] for t in tracks)),'average_score':round(sum(t['score'] for t in tracks)/len(tracks),2),'tracks':tracks}

def prepare(output,seed):
    output.mkdir(parents=True,exist_ok=False)
    old=read(SKILL/'data/neospc100-benchmark-v4.1.json')
    source={s['id']:s for s in old['styles']}
    contracts=engine.load_catalog_contracts()
    if len(contracts)!=100 or set(source)!={r['id'] for r in contracts}:raise ValueError('The 100 cue contracts must match the catalog identities.')
    write(output/'previous-catalog.json',old)
    # Preserve the complete current distribution, including the integrated UI.
    with zipfile.ZipFile(output/'previous-studio.zip','w',zipfile.ZIP_STORED) as archive:
        for path in sorted(STUDIO.rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts:archive.write(path,path.relative_to(STUDIO).as_posix())
    inputs=[];raw=[];finished=[];evidence=[]
    source_hashes={name:file_hash(SKILL/name) for name in ['SKILL.md','data/catalog-contracts-r03.json','scripts/generate_neospc100_v3.py','scripts/phrase_composer.py','scripts/studio_timbres.py','scripts/compose_from_plan.py','scripts/refine_performance.py','scripts/professor_review.py','scripts/render_mix_v4.py','scripts/export_midis_v4.py']}
    for number,contract in enumerate(contracts):
        record=copy.deepcopy(contract);spec=record['native_engine_contract'];cue_id=record['id'];category=record['category'];label=record['category_label'];previous=source[cue_id]
        cue_seed=int.from_bytes(hashlib.sha256(f'{seed}:{cue_id}'.encode()).digest()[:4],'big') & 0x7fffffff
        spec['seed']=cue_seed
        profile=record['performance']['profile'];amount=record['performance']['amount'];record['performance']['seed']=cue_seed
        record['source_structure_sha256']=performance.structural_hash(previous)
        inputs.append(record);write(output/'projects'/cue_id/'composition-contract.json',record)
        style=engine.compose(spec,category,label)
        # Leave one voice of arrangement headroom before role timing is refined.
        removed=composer.enforce_voice_budget(style,max(7,spec['budget']-1))
        composer.apply_factory_assignments(style)
        for inst,info in style['instrument_map'].items():
            if 'writing' not in spec and inst in previous['instrument_map'] and 'mix_trim_db' in previous['instrument_map'][inst]:info['mix_trim_db']=previous['instrument_map'][inst]['mix_trim_db']
        style['source_type']='generated_catalog'
        style['generation_epoch']='studio-phrase-rebuild-1'
        style['generation']={'workflow':'score-blueprint+performance','engine':'phrase-composer-1','seed':cue_seed,'contract_sha256':digest(record),'skill_sources':source_hashes,'architecture':spec['architecture'],'arrangement_events_trimmed':removed}
        for key in ['mix_v2','mix_v3']:
            if 'writing' not in spec and key in previous:style[key]=copy.deepcopy(previous[key])
        raw.append(copy.deepcopy(style))
        style['composition_contract']={k:copy.deepcopy(record[k]) for k in ['revision','game_function','protected_identity','musical_direction','listening_checks']}
        result=performance.refine_style(style,profile=profile,amount=amount,seed=cue_seed)
        issues=neospc.validate_composition(result)
        if issues:raise ValueError(f'{cue_id}: {issues}')
        changed=performance.structural_hash(result)!=record['source_structure_sha256']
        if not changed:raise ValueError(f'{cue_id}: written score was not regenerated')
        finished.append(result);write(output/'projects'/cue_id/'composition.json',result)
        evidence.append({'id':cue_id,'seed':cue_seed,'previous_events':len(previous['events']),'events':len(result['events']),'written_score_changed':changed,'contract_revision':record['revision'],'contract_changes':list(record['changes']),'written_rests':result['arrangement_rests'],'performance_profile':profile,'peak':result['measured_peak_voices'],'budget':result['voice_budget']})
        if (number+1)%10==0:print(f'Composed {number+1}/100',flush=True)
    first=reviews(raw);final=reviews(finished)
    before={t['id']:t for t in first['tracks']};after={t['id']:t for t in final['tracks']}
    for style in finished:
        review=after[style['id']]
        style['professor_review_pass1']=before[style['id']];style['professor_review_final']=review
        style['composition_quality']={'status':{'approved':'curated','revise':'review','rebuild':'rebuild'}[review['status']],'score':review['score'],'reasons':review['critique'],'method':'symbolic; human listening pending'}
        write(output/'projects'/style['id']/'composition.json',style)
    catalog={key:copy.deepcopy(value) for key,value in old.items() if key in {'voice_model','categories'}}
    catalog.update(version='6.0.0-phrase-studio',project='Game Music Composer / Phrase Studio',styles=finished,regeneration={'seed':seed,'skill_sources':source_hashes,'all_written_scores_changed':True,'human_listening':'pending'})
    write(output/'catalog.json',catalog);write(output/'review-composed.json',first);write(output/'review-performed.json',final)
    write(output/'inputs.json',{'seed':seed,'skill_sources':source_hashes,'contracts':inputs})
    write(output/'regeneration-report.json',{'count':100,'contracts_revised':100,'written_scores_changed':100,'events':sum(len(s['events']) for s in finished),'review':final['summary'],'cues':evidence})
    print(json.dumps({'count':100,'events':sum(len(s['events']) for s in finished),'review':final['summary'],'average':final['average_score']}),flush=True)

def publish(output):
    catalog=read(output/'catalog.json');ids={s['id'] for s in catalog['styles']}
    old=read(output/'previous-catalog.json');previous={s['id']:s for s in old['styles']}
    if len(ids)!=100 or ids!=set(previous):raise ValueError('Catalog identities changed.')
    if neospc.validate_catalog(catalog):raise ValueError('Catalog validation failed.')
    reports=read(output/'audio/mix-report.json')
    if {r['id'] for r in reports}!=ids or any(r.get('skipped') for r in reports):raise ValueError('All 100 renders must be fresh.')
    if not (output/'verification.json').is_file() or not read(output/'verification.json').get('passed'):raise ValueError('Run artifact verification before publishing.')
    for cue_id in ids:
        for folder,ext in [('audio','ogg'),('audio','mp3'),('midi','mid')]:
            path=output/folder/f'{cue_id}.{ext}'
            if not path.is_file() or not path.stat().st_size:raise ValueError(f'Missing {path}')
            if file_hash(path)==file_hash(STUDIO/'assets'/folder/path.name):raise ValueError(f'Unchanged export {path.name}')
    # All replacement artifacts are complete before touching the shared distribution.
    # Generated event data stays compact so the portable package retains its size budget.
    (SKILL/'data/neospc100-benchmark-v4.1.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    for folder in ['audio','midi']:
        for path in (output/folder).iterdir():
            if path.is_file() and path.suffix in {'.ogg','.mp3','.mid','.json'}:shutil.copyfile(path,STUDIO/'assets'/folder/path.name)
    review_path=STUDIO/'data/reviews.js';bundle=json.loads(review_path.read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
    bundle['pass1']=read(output/'review-composed.json');bundle['final']=read(output/'review-performed.json')
    review_path.write_text('window.NEOSPC_REVIEWS='+json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8',newline='\n')
    with zipfile.ZipFile(STUDIO/'downloads/neospc100-midis-v4.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for path in sorted((output/'midi').iterdir()):archive.write(path,'midi/'+path.name)
    with zipfile.ZipFile(STUDIO/'downloads/neospc100-source-v4.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for name in ['catalog.json','inputs.json','review-composed.json','review-performed.json','regeneration-report.json','bank-audit.json','verification.json','verification.md']:
            archive.write(output/name,name)
        for path in sorted((output/'projects').rglob('*.json')):archive.write(path,path.relative_to(output).as_posix())
        for name in ['LICENSE','LICENSE-NOTES.md']:archive.write(SKILL/name,name)
        archive.write(output/'audio/mix-report.json','audio/mix-report.json')
        archive.write(output/'diversity-audit.json','diversity-audit.json')
        for name in ['scripts/generate_neospc100_v3.py','scripts/phrase_composer.py','scripts/studio_timbres.py','scripts/refine_performance.py','scripts/compose_from_plan.py','scripts/professor_review.py','scripts/render_mix_v4.py','scripts/export_midis_v4.py','scripts/midi_compat.py','scripts/synthesize_soundbanks.py','data/catalog-contracts-r03.json','data/soundbank-provenance.json','data/instrument-calibration.json','data/factory-bank-manifest.json','resources/original-sample-bank/sample-bank.json']:
            archive.write(SKILL/name,'generation/'+name)
        for name in ['build_soundbanks.py','build_studio_palettes.py','write_studio_blueprints.py','regenerate_catalog.py','verify_regenerated_catalog.py']:
            archive.write(ROOT/'tools'/name,'tools/'+name)

    print('Published 100 scores, 200 audio files, 100 MIDI files and both source archives.')

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=['prepare','publish']);parser.add_argument('output',type=Path);parser.add_argument('--seed',type=int,default=20260908);args=parser.parse_args()
    if args.phase=='prepare':prepare(args.output.resolve(),args.seed)
    else:publish(args.output.resolve())

if __name__=='__main__':main()
