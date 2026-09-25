'use strict';
// Engine -> native score bridge and English label coverage for the Create view.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const showcase = path.resolve(__dirname, '../../game-music-composer-showcase');
const E = require(path.join(showcase, 'engine/core.js'));
const B = require(path.join(showcase, 'engine/native-bridge.js'));
const L = require(path.join(showcase, 'engine/labels-en.js'));
const sandbox = { window: {} };
for (const file of ['atelier/instruments.js', 'data/catalog.js']) vm.runInNewContext(fs.readFileSync(path.join(showcase, file), 'utf8'), sandbox);
const instruments = sandbox.window.STUDIO_INSTRUMENTS, categories = sandbox.window.NEOSPC_CATALOG.categories;

test('Every preset converts to a valid native score for the sample banks', () => {
  for (const preset of E.data.presets) {
    const s = E.compose('BRIDGE', preset.id);
    const category = categories.find(c => c.id === L.labels.genreCategory[s.genre]);
    assert.ok(category, 'category for ' + s.genre);
    const n = B.toNative(E, s, { instruments, category, id: 'create_test', title: 't' });
    assert.ok(n.events.length > 0 && n.measured_peak_voices <= n.voice_budget, preset.id);
    assert.ok(Array.isArray(n.form) && n.form.length >= 2);
    for (const e of n.events) {
      assert.ok(n.instrument_map[e.inst], e.inst);
      assert.ok(e.beat >= 0 && e.beat < n.beats && e.performance_beat >= 0 && e.performance_beat < n.beats);
      assert.ok(Number.isInteger(e.velocity) && e.velocity >= 1 && e.velocity <= 127);
      assert.ok(Math.abs(e.beat * 48 - Math.round(e.beat * 48)) < 1e-9, 'written beat on the 1/48 grid');
    }
    for (const [inst, info] of Object.entries(n.instrument_map)) {
      assert.ok(info.file.endsWith('.wav') && info.factory_patch, inst);
      assert.equal(n.track_mix[inst].gain, s.tracks.find(t => (t.id === 'open' ? 'open_hat' : t.id) === inst).volume);
    }
  }
});

test('Muted tracks are left out and an all-muted song is refused', () => {
  const s = E.compose('MUTE', 'lofi');
  s.tracks.find(t => t.id === 'kick').mute = true;
  const n = B.toNative(E, s, { instruments, category: categories[0], id: 'x', title: 'x' });
  assert.ok(!n.instrument_map.kick && n.events.every(e => e.inst !== 'kick'));
  for (const t of s.tracks) t.mute = true;
  assert.throws(() => B.toNative(E, s, { instruments, category: categories[0], id: 'x', title: 'x' }), /muted or empty/);
});

test('Every sound maps to a sampled instrument and every engine name has an English label', () => {
  for (const id of Object.keys(E.data.sounds)) {
    assert.ok(instruments[B.SOUND_TO_PATCH[id]], 'patch for ' + id);
    assert.ok(L.labels.sounds[id], 'label for ' + id);
  }
  for (const p of E.data.presets) assert.ok(L.labels.presets[p.id], p.id);
  for (const g of Object.keys(E.data.genreNames)) assert.ok(L.labels.genres[g] && L.labels.genreCategory[g], g);
  for (const s of Object.keys(E.data.scaleDefs)) assert.ok(L.labels.scales[s], s);
  for (const [k, v] of Object.entries(E.data.progressions)) if (!v.meta) assert.ok(L.labels.progressions[k], k);
  for (const g of new Set([...Object.values(E.data.arpLibrary), ...Object.values(E.data.chopLibrary)].map(t => t.group))) assert.ok(L.labels.templateGroups[g], g);
});

test('Generated names and engine messages are translated', () => {
  assert.equal(L.songName('Silencio de neón'), 'Silence of neon');
  assert.equal(L.message('Versión C guardada. La sesión sigue intacta.'), 'Idea C saved. The session is unchanged.');
  assert.equal(L.message('Unknown text'), 'Unknown text');
});

test('Every catalog cue opens in the engine with all of its notes and its length', () => {
  const cues = { window: {} };
  for (const f of fs.readdirSync(path.join(showcase, 'data/cues'))) vm.runInNewContext(fs.readFileSync(path.join(showcase, 'data/cues', f), 'utf8'), cues);
  const list = Object.values(cues.window.NEOSPC_CUES);
  assert.equal(list.length, 240);
  for (const cue of list) {
    const s = B.fromNative(E, cue);
    let notes = 0;
    for (let i = 0; i < E.totalBars(s) * 16; i++) for (const e of E.scoreEvents(i, s)) notes += e.n.length;
    assert.equal(notes, cue.events.length, cue.id);
    const seconds = E.totalSeconds(s), original = cue.beats * 60 / cue.bpm;
    assert.ok(Math.abs(seconds - original) / original < .01, cue.id + ' loop length');
  }
});
