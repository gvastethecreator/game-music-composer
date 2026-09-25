#!/usr/bin/env node
'use strict';
// Command-line access to the studio engine (the same code the browser Create view runs).
// Requires Node.js 18 or later. No network access and no npm packages.
//
//   node studio_engine.cjs presets
//   node studio_engine.cjs compose --preset lofi --seed DUSK --instruments inst.json \
//        --project project.json --native composition.json --id my_cue --title "My cue" \
//        --category lofi --category-label "Lo-fi" [--variation SEED] [--bars 8] [--form loop|journey]
//   node studio_engine.cjs midi project.json out.mid [--loops 1]
//   node studio_engine.cjs import composition.json project.json [--seed CATALOG]
const fs = require('node:fs'), path = require('node:path');
const ENGINE = path.resolve(__dirname, '../resources/studio-engine');
const E = require(path.join(ENGINE, 'core.js'));
const B = require(path.join(ENGINE, 'native-bridge.js'));
const L = require(path.join(ENGINE, 'labels-en.js'));

function args(list) {
  const out = { _: [] };
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith('--')) out[list[i].slice(2)] = list[i + 1] !== undefined && !list[i + 1].startsWith('--') ? list[++i] : true;
    else out._.push(list[i]);
  }
  return out;
}
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
function fail(message) { process.stderr.write(message + '\n'); process.exit(2); }

function compose(a) {
  if (!a.preset || !E.data.presets.some(p => p.id === a.preset)) fail('Unknown or missing --preset. Run: node studio_engine.cjs presets');
  E.session.replace(E.compose(String(a.seed || 'GMC'), a.preset));
  if (a.bars) E.session.setHarmony('bars', Number(a.bars));
  if (a.form) E.session.setHarmony('structure', a.form);
  if (a.variation) E.session.applyCandidate(E.session.randomCandidate({}, String(a.variation), 'variation'));
  const s = E.session.state;
  if (a.project) writeJson(a.project, E.project(s));
  if (a.native) {
    if (!a.instruments) fail('--native needs --instruments (studio instrument map JSON).');
    const trackName = id => L.name('tracks', id), soundName = id => L.name('sounds', id);
    const native = B.toNative(E, s, {
      instruments: readJson(a.instruments), category: { id: a.category || 'electronic', label: a['category-label'] || a.category || 'Electronic' },
      id: a.id || ('engine_' + s.seed).toLowerCase().replace(/[^a-z0-9_]/g, '_'), title: a.title || L.name('presets', s.preset) + ' · ' + s.seed,
      labels: tr => trackName(tr.id) + ' · ' + soundName(tr.sound),
    });
    native.engine_project = path.basename(a.project || '');
    writeJson(a.native, native);
  }
  const summary = { preset: s.preset, genre: s.genre, seed: s.seed, bpm: s.bpm, key: s.root, scale: s.scale, bars: E.totalBars(s), seconds: +E.totalSeconds(s).toFixed(2), tracks: s.tracks.filter(t => E.audible(t, s)).map(t => ({ id: t.id, sound: t.sound, volume: t.volume })) };
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

async function midi(a) {
  const [input, output] = a._;
  if (!input || !output) fail('Usage: midi project.json out.mid [--loops 1]');
  const state = E.validateProject(readJson(input));
  const blob = E.midi(state, Math.max(1, Math.min(16, Number(a.loops || 1))));
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, Buffer.from(await blob.arrayBuffer()));
  process.stdout.write(output + '\n');
}

function importNative(a) {
  const [input, output] = a._;
  if (!input || !output) fail('Usage: import composition.json project.json');
  const native = readJson(input);
  const style = Array.isArray(native.styles) ? native.styles[0] : native;
  writeJson(output, E.project(B.fromNative(E, style, { seed: String(a.seed || style.id || 'CATALOG').slice(0, 64) })));
  process.stdout.write(output + '\n');
}

async function main() {
  const [command, ...rest] = process.argv.slice(2), a = args(rest);
  if (command === 'presets') process.stdout.write(JSON.stringify(E.data.presets.map(p => ({ id: p.id, genre: p.genre, name: L.name('presets', p.id), genreName: L.name('genres', p.genre), bpm: p.bpm })), null, 2) + '\n');
  else if (command === 'compose') compose(a);
  else if (command === 'midi') await midi(a);
  else if (command === 'import') importNative(a);
  else if (command === 'version') process.stdout.write(E.version + '\n');
  else fail('Commands: presets, compose, midi, import, version');
}
main().catch(err => fail(L.message(err.message || String(err))));
