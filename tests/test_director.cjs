'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const D = require('../labs/composer-director/director.js');
for (const theme of Object.keys(D.THEMES)) for (const state of Object.keys(D.STATES)) {
  test(`${theme}/${state}: finite bounded events, repeatability and scoped revision`, () => {
    const input = {theme, state, answerSeed: 0};
    const a = D.compose(input), b = D.compose({...input, answerSeed: 1});
    assert.deepEqual(a, D.compose(input));
    assert.ok(a.events.length > 0);
    for (const e of a.events) {
      for (const k of ['beat','duration','midi','amplitude']) assert.ok(Number.isFinite(e[k]));
      assert.ok(e.beat >= 0 && e.duration > 0 && e.beat + e.duration <= 32);
      assert.ok(Number.isInteger(e.midi) && e.midi >= 24 && e.midi <= 96);
    }
    assert.deepEqual(a.events.filter(e=>e.section!=='B'), b.events.filter(e=>e.section!=='B'));
    assert.notEqual(D.sectionSignature(a,'B'), D.sectionSignature(b,'B'));
    assert.ok(D.reduction(a).events.every(e=>['lead','bass'].includes(e.role)));
    assert.equal(a.production_ready,false);
    assert.deepEqual(input,{theme,state,answerSeed:0});
  });
}
test('The three directions have distinct rhythmic/melodic identities',()=>{
 const identities=Object.keys(D.THEMES).map(theme=>JSON.stringify(D.compose({theme,state:'explore',answerSeed:0}).motif));
 assert.equal(new Set(identities).size,3);
});
test('Five documented B variants; preserved material is exactly equal',()=>{
 const versions=Array.from({length:5},(_,answerSeed)=>D.compose({theme:'pilgrim',state:'explore',answerSeed}));
 assert.equal(new Set(versions.map(s=>D.sectionSignature(s,'B'))).size,5);
 assert.equal(new Set(versions.map(s=>D.sectionSignature(s,'A'))).size,1);
});
test('Battle changes note topology and grief removes synthetic pulse',()=>{
 const make=state=>D.compose({theme:'pilgrim',state,answerSeed:0});
 assert.ok(make('battle').events.filter(e=>e.role==='bass').length>make('explore').events.filter(e=>e.role==='bass').length);
 assert.equal(make('grief').events.filter(e=>e.role==='pulse').length,0);
});
test('Negative scale degrees keep correct octave arithmetic',()=>{
 assert.equal(D.pitch([0,2,3,5,7,9,10],-1,62),60);
});
test('Voice leading keeps one of each chord pitch class in a bounded register',()=>{
 const scale=D.THEMES.pilgrim.scale, chord=D.nearestVoicing(scale,4,[50,57,62]);
 assert.equal(new Set(chord.map(n=>n%12)).size,3);
 assert.ok(chord.every(n=>n>=48 && n<=72));
 assert.deepEqual(chord.slice().sort((a,b)=>a-b),chord);
});
test('Reject unknown theme/state, unsafe seed, non-finite tempo',()=>{
 for(const input of [{theme:'__proto__',state:'explore',answerSeed:0},{theme:'pilgrim',state:'unknown',answerSeed:0},
 {theme:'pilgrim',state:'explore',answerSeed:NaN},{theme:'pilgrim',state:'explore',answerSeed:-1}]) assert.throws(()=>D.compose(input));
 assert.throws(()=>D.session({theme:'pilgrim',state:'explore',answerSeed:0,bpm:Infinity}));
});
test('Session is JSON-serializable, scoped and never auto-approved',()=>{
 const data=JSON.parse(JSON.stringify(D.session({theme:'pilgrim',state:'explore',answerSeed:0,bpm:96})));
 assert.equal(data.audit.human_listening,'pending');
 assert.deepEqual(data.allowed_revision,['section_B.lead']);
 assert.equal(data.production_ready,false);
});
test('Inline application script parses without running browser APIs',()=>{
 const html=fs.readFileSync(require.resolve('../labs/composer-director/index.html'),'utf8');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);new vm.Script(scripts[0][1]);
 assert.ok(!/https?:\/\//.test(html.replace('http://www.w3.org/2000/svg','')));
});
