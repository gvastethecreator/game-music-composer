'use strict';
// The GMC engine must reproduce the UMBRA 8 reference exactly: every scoreEvents()
// row (onset, pitches, velocity, duration, offset, strum, hash) for 32 presets x 3
// seeds, journey form, 44 arpeggio and 28 chop templates, classic arp modes, clips
// with conditions, bake/transform, song sections, macros and automation, harmony
// parsing, Random/Chaos candidates, project import and MIDI size.
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { portAdapter, run } = require('./umbra-scenarios.cjs');
const golden = require('./fixtures/umbra8-golden.json').cases;

test('Engine matches the UMBRA 8 reference in every scenario', () => {
  const actual = run(portAdapter(path.resolve(__dirname, '../../game-music-composer-showcase/engine/core.js')));
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(golden).sort());
  const mismatches = Object.keys(golden).filter(name => JSON.stringify(actual[name]) !== JSON.stringify(golden[name]));
  assert.deepEqual(mismatches, []);
  assert.ok(Object.keys(golden).length >= 190);
});
