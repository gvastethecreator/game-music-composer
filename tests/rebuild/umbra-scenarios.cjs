'use strict';
// Deterministic scenario list shared with the UMBRA 8 reference run. Each case returns
// event-count + SHA-256 prefix of every scoreEvents() row, or a state signature.
// seedRandom IDs come from a shared counter so clip and section IDs are reproducible.
const crypto = require('node:crypto');

function portAdapter(file) {
  const E = require(file);
  let counter = 0;
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  Object.defineProperty(globalThis.crypto, 'getRandomValues', { configurable: true, value: a => { if (a instanceof Uint32Array && a.length === 1) { a[0] = ++counter; return a; } return real(a); } });
  return {
    name: 'port',
    reset() { counter = 0; },
    get: name => E.debug.get(name),
    setState(s) { const D = E.debug.get; D('setState')(s); D('scoreMemo7').clear(); D('ui').undo = []; D('ui').redo = []; },
    getState: () => E.debug.get('state'),
    select(id) { E.debug.get('ui').selected = id; E.debug.get('ui7').selection = new Set(); },
    compose: (seed, preset) => E.compose(seed, preset),
  };
}

const PRESETS = ['nocturne','dub','micro','bossa','ambient','garage','electro','broken','soul','ritual','cinema','chip','techno','dubtechno','minimal','melodic','trance','dnb','jungle','liquid','halftime','trap','lofi','synthwave','disco','funk','jazz','afro','reggaeton','footwork','idm','breakbeat'];
const clone = o => JSON.parse(JSON.stringify(o));

function signature(X, s) {
  const scoreEvents = X.get('scoreEvents'), totalBars = X.get('totalBars');
  const rows = [];
  for (let i = 0; i < totalBars(s) * 16; i++) for (const e of scoreEvents(i, s)) rows.push([i, e.id, e.n, e.v, e.d, e.offset, e.strum, e.hash]);
  const text = JSON.stringify(rows);
  return { count: rows.length, sha: crypto.createHash('sha256').update(text).digest('hex').slice(0, 24) };
}
const stateSig = s => crypto.createHash('sha256').update(JSON.stringify(s)).digest('hex').slice(0, 24);

function run(X) {
  const out = {};
  const put = (name, fn) => { X.reset(); try { out[name] = fn(); } catch (err) { out[name] = { error: String(err.message).slice(0, 160) }; } };
  for (const p of PRESETS) for (const seed of ['A1', 'ORBITA', 'Z-9']) put(`compose/${p}/${seed}`, () => signature(X, X.compose(seed, p)));
  for (const p of ['nocturne','techno','ambient','jazz','dnb','trap']) put(`journey/${p}`, () => { const s = X.compose('JOURNEY', p); s.structure = 'journey'; return signature(X, s); });
  // Performance templates on melodic tracks.
  const arpIds = Object.keys(X.get('ARP_LIBRARY')), chopIds = Object.keys(X.get('CHOP_LIBRARY'));
  arpIds.forEach((id, i) => put(`arp/${id}`, () => { const s = X.compose('ARP' + i, PRESETS[i % 32]); const tr = s.tracks.find(t => t.id === ['keys', 'arp', 'lead', 'pad'][i % 4]); tr.performance.mode = 'arp'; tr.performance.arpPreset = id; tr.arp.enabled = true; tr.performance.morph = (i * 7) % 60; tr.performance.bias = 70 + (i % 4) * 10; tr.performance.reverse = i % 5 === 0; tr.performance.holdBass = i % 3 === 0; return signature(X, s); }));
  chopIds.forEach((id, i) => put(`chop/${id}`, () => { const s = X.compose('CHOP' + i, PRESETS[(i * 3) % 32]); const tr = s.tracks.find(t => t.id === ['keys', 'pad', 'arp'][i % 3]); tr.performance.mode = i % 4 === 0 ? 'hybrid' : 'chop'; tr.performance.chopPreset = id; tr.performance.source = i % 2 ? 'notes' : 'chord'; tr.performance.skew = (i % 5) * 20 - 40; tr.performance.subcycles = 1 + (i % 2); tr.arp.enabled = tr.performance.mode === 'hybrid'; return signature(X, s); }));
  put('arp/classic-modes', () => { const s = X.compose('MODES', 'melodic'); const modes = ['up','down','updown','downup','converge','diverge','thirds','pinky','thumb','random','walk','chord']; const rates = ['4','8','16','32','8t','16t','8d']; s.tracks.filter(t => ['keys','pad','arp','lead','bass'].includes(t.id)).forEach((t, k) => { Object.assign(t.arp, { enabled: true, mode: modes[k * 2], rate: rates[k], ratchet: 1 + k % 3, octaves: 1 + k % 3, reset: ['chord','bar','free'][k % 3] }); }); return signature(X, s); });
  // Independent clips with conditions, ratchets and flams.
  put('clips/conditions', () => {
    const s = X.compose('CLIPS', 'micro'); X.setState(s); X.select('snare');
    const c = X.get('ensureClip7')('snare'); const make = X.get('makeNote7');
    c.notes = [make({ id: 'a', t: 4, p: 38, d: 1, v: .8, every: 2, phase: 1 }), make({ id: 'b', t: 12, p: 38, d: 1, v: .7, prob: .5 }), make({ id: 'c', t: 20, p: 38, d: 2, v: .9, ratchet: 3, flam: 30 }), make({ id: 'd', t: 30, p: 38, d: 1, v: .6, fill: true })];
    X.get('syncProjection7')('snare');
    X.select('keys'); const k = X.get('ensureClip7')('keys'); k.notes = k.notes.map((n, i) => ({ ...n, t: n.t + (i % 3) * .125, v: Math.min(1, n.v * (1 + (i % 4) * .1)) })); X.get('syncProjection7')('keys');
    const st = X.getState(); st.studio.fill = false; return signature(X, st);
  });
  put('clips/bake-transform', () => {
    const s = X.compose('BAKE', 'lofi'); const arp = s.tracks.find(t => t.id === 'arp'); arp.performance.mode = 'arp'; arp.performance.arpPreset = 'umbra_helix'; arp.arp.enabled = true; X.setState(s);
    X.select('arp'); X.get('bake7')('arp');
    X.select('lead'); for (const kind of ['pitches', 'rhythm', 'articulation', 'invert', 'answer', 'transition']) X.get('transform7')(kind, { selection: false });
    const st = X.getState(); return { events: signature(X, st), clipCount: Object.keys(st.studio.clips).length };
  });
  put('song/structure', () => { const s = X.compose('SONG', 'synthwave'); X.setState(s); X.get('structureSong7')(); const st = X.getState(); return { events: signature(X, st), sections: st.studio.sections.map(x => [x.name, x.bars]) }; });
  put('macros/automation', () => {
    const s = X.compose('MACRO', 'trance'); X.setState(s); const st = X.get('studio7')(s);
    st.macros = { energy: 80, tension: 35, space: 60, movement: 25 };
    const lane = X.get('ensureLane7')('macro.tension'); lane.points = [{ t: 0, v: .1 }, { t: 64, v: .9 }, { t: 127, v: .3 }];
    const vol = X.get('ensureLane7')('lead.volume'); vol.points = [{ t: 0, v: .2 }, { t: 100, v: .8 }]; return signature(X, X.getState());
  });
  put('harmony/rework', () => { const s = X.compose('HARM', 'soul'); X.setState(s); X.get('reworkHarmony')(); return signature(X, X.getState()); });
  put('harmony/parse', () => { const specs = X.get('parseProgression')('ii7 | V7>ii | Imaj9/III | bVII9 | iv6 | V7alt'); X.setState(X.compose('PARSE', 'jazz')); X.get('commitHarmony')(specs); return { specs: stateSig(specs), events: signature(X, X.getState()) }; });
  // Random and chaos candidates.
  for (const kind of ['variation', 'song']) for (const seed of ['R1', 'R2', 'R3']) put(`random/${kind}/${seed}`, () => {
    const before = X.compose('BASE-' + seed, PRESETS[seed.charCodeAt(1) % 32]); X.setState(before);
    const cfg = { ...X.get('randomDefaults')(), amount: 55, groups: { rhythm: true, melody: true, sound: true, performance: true, harmony: true, tempo: true, groove: true, masterFX: true, trackFX: true, mix: true } };
    const c = X.get('makeRandomCandidate')(before, cfg, seed, kind, 'keys');
    return { state: stateSig(c.state), events: signature(X, c.state) };
  });
  for (const mode of ['mutate', 'reinvent', 'fracture']) put(`chaos/${mode}`, () => { const before = X.compose('CHAOS', 'idm'); X.setState(before); const c = X.get('makeChaosCandidate5')(before, { ...X.get('chaosDefaults5')(), mode }, 'CAOS-' + mode); return { state: stateSig(c.state), events: signature(X, c.state) }; });
  put('project/roundtrip', () => { const s = X.compose('RT', 'afro'); const v = X.get('validateProject')({ schema: 'umbra-project', version: 8, state: clone(s) }); return stateSig(v); });
  put('project/v6-import', () => { const s = X.compose('V6', 'dub'); const legacy = clone(s); delete legacy.studio; delete legacy.sound8; delete legacy.visual; delete legacy.chaosRecord; for (const t of legacy.tracks) { delete t.expression; } const v = X.get('validateProject')({ schema: 'umbra-project', version: 6, state: legacy }); return { state: stateSig(v), events: signature(X, v) }; });
  put('midi/file', () => { const s = X.compose('MIDI', 'garage'); X.setState(s); return X.get('midiFile')(s, 1).size; });
  return out;
}
module.exports = { portAdapter, run };
