'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../../game-music-composer/resources/ensemble-atelier/music.js');
const S=require('../../game-music-composer-showcase/studio-score.js');
const root=path.resolve(__dirname,'../../game-music-composer-showcase');
const sandbox={window:{}};
for(const file of ['data/cues/fernway_crossing.js','atelier/instruments.js','data/factory-bank.js','data/sample-bank.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox);
const native=JSON.parse(JSON.stringify(sandbox.window.NEOSPC_CUES.fernway_crossing));
test('Native editor retains wrapped timing, sample metadata and unedited events',()=>{
  const fixture=JSON.parse(JSON.stringify(native)),i=fixture.events.findIndex(e=>e.kind==='note');
  assert.ok(i>=0);
  const e=fixture.events[i];Object.assign(e,{beat:0,performance_beat:fixture.beats-.01,start_offset_ms:-.01*60000/fixture.bpm});
  const original=JSON.stringify(fixture);
  const edited=S.edit(fixture,i,{midi:e.midi+1,beat:1,duration:e.duration,velocity:e.velocity});
  assert.equal(JSON.stringify(fixture),original);assert.deepEqual(edited.instrument_map,fixture.instrument_map);
  assert.ok(Math.abs(edited.events[i].performance_beat-(1+e.performance_beat-fixture.beats))<1e-6);
  assert.equal(edited.events[i].sample_offset_ms,e.sample_offset_ms);assert.equal(edited.events[i].tuning_cents,e.tuning_cents);
  assert.deepEqual(edited.events.filter((_,index)=>index!==i),fixture.events.filter((_,index)=>index!==i));
  assert.equal(edited.source_type,'local_import');assert.equal(edited.professor_review_final,undefined);
  assert.throws(()=>S.edit(fixture,i,{midi:60,beat:0,duration:NaN,velocity:100}));
});
test('All generator families map to real embedded Factory and Original samples',()=>{
  const scores=[...['chamber','jazz','ritual'].map(M.studioScore),M.pocketScore(),...['dialogue','asymmetric','breath','tiled'].map(mode=>M.phraseScore({mode})),...Object.keys(M.GENRES).map(genre=>M.genreScore({genre})),...['interlock','hocket','additive'].map(method=>M.cycleScore({method}))];
  for(const score of scores){const n=S.generated(score,sandbox.window.STUDIO_INSTRUMENTS,'test_sketch',{id:'adventure',label:'Adventure'});assert.equal(n.events.length,score.events.length);assert.ok(Array.isArray(n.form)&&n.form.length>=2);assert.ok(n.measured_peak_voices>0&&n.measured_peak_voices<=n.voice_budget);
    for(const info of Object.values(n.instrument_map)){assert.ok(sandbox.window.NEOSPC_FACTORY_BANK.patches[info.factory_patch],info.factory_patch);assert.ok(sandbox.window.NEOSPC_SAMPLE_BANK.samples[info.file],info.file);}
    assert.deepEqual(S.fromNative(n).events.map(e=>[e.midi,e.beat]),score.events.map(e=>[e.midi,e.beat]));
  }
});
test('Performance edits preserve written notes and native metadata',()=>{
  const changed=S.perform(native,M.applyPerformance(S.fromNative(native),'pocket',.65));
  assert.deepEqual(changed.events.map(e=>[e.inst,e.midi,e.beat,e.duration]),native.events.map(e=>[e.inst,e.midi,e.beat,e.duration]));
  assert.deepEqual(changed.instrument_map,native.instrument_map);assert.notDeepEqual(changed.events,native.events);
  assert.ok(changed.events.every(e=>Number.isFinite(e.velocity_gain)&&e.performance_beat>=0&&e.performance_beat<native.beats));
});
test('Studio shared modules are exact canonical publications',()=>{
  for(const file of ['music.js','visuals.js','atelier.js'])assert.equal(fs.readFileSync(path.join(root,'atelier',file),'utf8'),fs.readFileSync(path.resolve(__dirname,'../../game-music-composer/resources/ensemble-atelier',file),'utf8'));
});
