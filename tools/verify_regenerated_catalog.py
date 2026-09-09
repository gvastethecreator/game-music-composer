#!/usr/bin/env python3
"""Verify every regenerated cue and exported MIDI/audio artifact before publication."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import numpy as np
import soundfile as sf

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'game-music-composer/scripts'))
import mido
import neospc
import refine_performance as performance

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path);args=parser.parse_args();out=args.output
    catalog=json.loads((out/'catalog.json').read_text(encoding='utf-8'));old=json.loads((out/'previous-catalog.json').read_text(encoding='utf-8'));previous={s['id']:s for s in old['styles']}
    assert len(catalog['styles'])==100 and len(previous)==100
    assert not neospc.validate_catalog(catalog)
    bank=json.loads((out/'bank-audit.json').read_text());assert bank['errors']==0 and bank['warnings']==0 and bank['coverage']==1,bank
    mix=json.loads((out/'audio/mix-report.json').read_text());assert len(mix)==100 and not any(r.get('skipped') for r in mix)
    assert all(r.get('sample_backend')=='multisample' and r.get('sound_palette')==next(s['sound_palette'] for s in catalog['styles'] if s['id']==r['id']) for r in mix)
    inputs=json.loads((out/'inputs.json').read_text());contracts={r['id']:r for r in inputs['contracts']}
    assert len(contracts)==100 and set(contracts)==set(previous)
    for name,digest in inputs['skill_sources'].items():
        if name=='scripts/export_midis_v4.py':continue # Export has its own source receipt below; it does not compose notes.
        assert sha(ROOT/'game-music-composer'/name)==digest,('Source changed since composition',name)
    records=[]
    for index,s in enumerate(catalog['styles']):
        ident=s['id'];original=previous[ident]
        assert all(s[k]==original[k] for k in ['title','category']),ident
        assert s['writing_evidence']['engine']=='1.0.0' and s['sound_palette'] in ('factory','velvet','circuit'),ident
        assert performance.structural_hash(s)!=performance.structural_hash(original),ident
        contract=contracts[ident];spec=contract['native_engine_contract']
        assert contract['revision']=='phrase-blueprints-1' and len(contract['changes'])>=8,ident
        assert all(s[k]==spec[k] for k in ('bpm','meter','key','mode','bars')),ident
        assert s['writing_evidence']['cell']==spec['writing']['degrees'] and s['writing_evidence']['answer']==spec['writing']['answer'],ident
        assert s['dna']['texture']==spec['comp'].replace('_',' ') and s['dna']['texture_b']==spec['comp_b'].replace('_',' '),ident
        # Phrase-first writing can leave the silence directly, with nothing to cut.
        # The event-window assertions below prove the observable rest.
        assert s['arrangement_rests']['declared_windows']==len(spec['role_rests'])>0,ident
        assert [(f['name'],f['bars']) for f in s['form']]==[(f['name'],f['bars']) for f in spec['form']],ident
        for rest in spec['role_rests']:
            start=rest['start_bar']*s['barLength'];end=rest['end_bar']*s['barLength']
            for event in s['events']:
                if event.get('role') not in rest['roles']:continue
                assert not start<=event['beat']<end,(ident,'rest onset',event)
                if event['kind']=='note':assert not (event['beat']<start-1e-5 and event['beat']+event['duration']>start+1e-5),(ident,'rest crossing',event)
        expected=s['beats']*60/s['bpm'];files=[]
        for ext in ['ogg','mp3']:
            path=out/'audio'/f'{ident}.{ext}';samples,rate=sf.read(path,always_2d=True,dtype='float32')
            assert rate==32000 and samples.shape[1]==2 and np.isfinite(samples).all(),str(path)
            peak=float(np.max(np.abs(samples)));rms=float(np.sqrt(np.mean(samples.astype(np.float64)**2)))
            assert peak>1e-4 and rms>1e-5 and peak<1, (ident,ext,peak,rms)
            seconds=len(samples)/rate;assert abs(seconds-expected)<.15,(ident,seconds,expected)
            h=sha(path);assert h!=sha(ROOT/'game-music-composer-showcase/assets/audio'/path.name),str(path)
            files.append({'file':f'audio/{path.name}','sha256':h,'seconds':round(seconds,4),'peak_dbfs':round(20*np.log10(peak),3),'rms_dbfs':round(20*np.log10(rms),3)})
        path=out/'midi'/f'{ident}.mid'
        # The bundled MIDI implementation is a writer; use the installed reader for artifact inspection.
        parsed=mido.MidiFile(path);notes=[m for track in parsed.tracks for m in track if m.type=='note_on' and m.velocity>0]
        assert len(notes)==len(s['events']),(ident,len(notes),len(s['events']))
        assert parsed.type==1 and all(0<=m.channel<=15 for track in parsed.tracks for m in track if hasattr(m,'channel'))
        routed=set()
        for track in parsed.tracks:
            ports=[m.port for m in track if m.type=='midi_port']
            programs=[m for m in track if m.type=='program_change']
            if programs:
                assert len(ports)==1 and len(programs)==1,(ident,'MIDI routing')
                route=(ports[0],programs[0].channel)
                assert route not in routed,(ident,'MIDI channel collision',route)
                routed.add(route)
        h=sha(path);assert h!=sha(ROOT/'game-music-composer-showcase/assets/midi'/path.name)
        files.append({'file':f'midi/{path.name}','sha256':h,'note_on_count':len(notes)})
        records.append({'id':ident,'structure_sha256':performance.structural_hash(s),'files':files})
        if (index+1)%10==0:print(f'Verified {index+1}/100',flush=True)
    result={'passed':True,'cues':100,'contracts_revised':100,'contract_form_textures_and_written_rests_verified':True,'fresh_audio_files':200,'fresh_midi_files':100,'written_scores_changed':100,'all_audio_finite_non_silent':True,'all_midi_note_counts_match':True,'human_listening':'pending','records':records}
    result['export_sources']={name:sha(ROOT/'game-music-composer'/name) for name in ['scripts/export_midis_v4.py','scripts/midi_compat.py','scripts/render_mix_v4.py']}
    result['all_midi_melodic_routes_unique']=True
    (out/'verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    (out/'verification.md').write_text('# Regenerated catalog verification\n\n100 written scores changed. All 200 audio files and 100 MIDI files have fresh hashes. Audio is finite, non-silent stereo at 32 kHz with the expected cue duration. MIDI note counts match native events. Bank routing has full coverage and no findings. Human listening remains pending. See verification.json for per-file hashes and measurements.\n',encoding='utf-8')
    print('PASS: 100 scores, 200 audio files, 100 MIDI files.')
if __name__=='__main__':main()
