'use strict';
// Game music model: validation, derived states and persistence across edits.
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const E = require(path.resolve(__dirname, '../../game-music-composer/resources/studio-engine/core.js'));

const withGame = (seed = 'GAME', preset = 'trance') => { const s = E.compose(seed, preset); s.gmc = { game: E.game.defaults() }; return E.validateProject(E.project(s)); };

test('Game states survive project validation and keep every written note', () => {
  const s = withGame();
  assert.deepEqual(s.gmc.game.states.map(x => x.id), ['explore', 'tension', 'combat', 'calm']);
  const calm = E.game.state(s, 'calm');
  assert.equal(calm.tracks.find(t => t.id === 'kick').volume, 0, 'calm drops the kick');
  assert.deepEqual(calm.patterns, s.patterns, 'written notes are shared by all states');
  assert.deepEqual(calm.studio.macros, s.gmc.game.states[3].macros);
  const count = x => { let n = 0; for (let i = 0; i < E.totalBars(x) * 16; i++) n += E.scoreEvents(i, x).length; return n; };
  assert.ok(count(calm) < count(s), 'silent layers are not scheduled');
});

test('Invalid game data is rejected with a reason', () => {
  for (const bad of [{ states: [] }, { states: [{ id: 'Bad Id', name: 'x' }] }, { states: [{ id: 'a', name: 'A', levels: { kick: 3 } }] }, { states: [{ id: 'a', name: 'A' }], transition: { quantize: 'never' } }])
    assert.throws(() => E.game.validate(bad), /Invalid game music/);
});

test('Game states stay with the session through variations, undo and idea loads', () => {
  E.session.replace(withGame('KEEP', 'lofi'));
  E.session.applyCandidate(E.session.randomCandidate({}, 'V1', 'variation'));
  assert.ok(E.session.state.gmc?.game, 'kept through a variation');
  E.session.applyCandidate(E.session.randomCandidate({ genre: 'auto' }, 'S1', 'song'));
  assert.ok(E.session.state.gmc?.game, 'kept through a new song');
  E.session.ops.storeBank('B');
  E.session.ops.loadBank('A');
  assert.ok(E.session.state.gmc?.game, 'kept through an idea load');
  E.session.undo();
  assert.ok(E.session.state.gmc?.game, 'kept through undo');
});
