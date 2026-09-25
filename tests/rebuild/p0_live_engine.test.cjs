'use strict';
// P0 regressions against the real live engine and bridge: authored gain, post-fader
// sends, drum playback policy, chokes and offset validation. A recording fake
// AudioContext observes the graph and AudioParam schedules; no sound is produced.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const showcase = path.resolve(__dirname, '../../game-music-composer-showcase');

class Param {
  constructor(value = 0) { this.value = value; this.calls = []; }
  setValueAtTime(v, t) { this.calls.push(['set', v, t]); this.value = v; }
  linearRampToValueAtTime(v, t) { this.calls.push(['lin', v, t]); }
  exponentialRampToValueAtTime(v, t) { this.calls.push(['exp', v, t]); }
  setTargetAtTime(v, t, c) { this.calls.push(['target', v, t, c]); this.value = v; }
  cancelScheduledValues(t) { this.calls.push(['cancel', t]); }
  cancelAndHoldAtTime(t) { this.calls.push(['hold', t]); }
}
class Node {
  constructor(ctx, type) { this.ctx = ctx; this.type = type; this.outputs = []; ctx.nodes.push(this); }
  connect(dest) { this.outputs.push(dest); return dest; }
  disconnect() { this.outputs = []; }
}
class FakeContext {
  constructor() { this.currentTime = 0; this.sampleRate = 32000; this.state = 'running'; this.nodes = []; this.destination = new Node(this, 'destination'); }
  createGain() { const n = new Node(this, 'gain'); n.gain = new Param(1); return n; }
  createDynamicsCompressor() { const n = new Node(this, 'comp'); for (const k of ['knee', 'ratio', 'attack', 'release', 'threshold']) n[k] = new Param(); return n; }
  createDelay() { const n = new Node(this, 'delay'); n.delayTime = new Param(); return n; }
  createBiquadFilter() { const n = new Node(this, 'filter'); n.frequency = new Param(); n.Q = new Param(); return n; }
  createChannelSplitter() { return new Node(this, 'splitter'); }
  createAnalyser() { return new Node(this, 'analyser'); }
  createStereoPanner() { const n = new Node(this, 'pan'); n.pan = new Param(); return n; }
  createOscillator() { const n = new Node(this, 'osc'); n.frequency = new Param(); n.detune = new Param(); n.start = t => { n.started = t; }; n.stop = t => { n.stopped = t; }; return n; }
  createBufferSource() { const n = new Node(this, 'source'); n.playbackRate = new Param(1); n.start = (t, o) => { n.started = t; n.offset = o; }; n.stop = t => { n.stopped = t; }; return n; }
  async resume() {}
}

const sandbox = { window: {}, document: {}, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(showcase, 'live-engine.js'), 'utf8'), sandbox);
const Engine = sandbox.window.NeoSpcLiveEngine;
const S = require(path.join(showcase, 'studio-score.js'));

const reachable = (from, target, seen = new Set()) => from === target || (!seen.has(from) && (seen.add(from), from.outputs.some(n => reachable(n, target, seen))));

function engineFor(style, patchExtra = {}) {
  sandbox.window.NEOSPC_LEVELS = { gain_db: { 'kick.wav': 0, 'hat.wav': 0, 'open.wav': 0, 'lead.wav': 0 }, chip_gain_db: 0 };
  sandbox.window.NEOSPC_SAMPLE_BANK = { samples: {} };
  sandbox.window.NEOSPC_FACTORY_BANK = { embedded_profile: 'neo16', patches: {
    'drums.kick': { type: 'drum', note: 36, profiles: { neo16: { regions: [{ file: 'kick.wav', root: 36 }] } }, ...patchExtra },
    'drums.hat': { type: 'drum', note: 42, profiles: { neo16: { regions: [{ file: 'hat.wav', root: 42 }] } } },
    'drums.open': { type: 'drum', note: 46, profiles: { neo16: { regions: [{ file: 'open.wav', root: 46 }] } } },
    'lead.sine': { profiles: { neo16: { regions: [{ file: 'lead.wav', root: 60, lovel: 1, hivel: 64 }, { file: 'lead.wav', root: 60, lovel: 65, hivel: 127 }] } } },
  } };
  const engine = new Engine();
  const ctx = new FakeContext();
  engine.createGraph(ctx);
  engine.setStyle(style);
  for (const [file, duration] of [['kick.wav', .9], ['hat.wav', .12], ['open.wav', 1.6], ['lead.wav', 2]]) engine.buffers.set(file, { duration });
  return { engine, ctx };
}
const baseStyle = (events, extra = {}) => ({ bpm: 120, beats: 8, instrument_map: {
  kick: { factory_patch: 'drums.kick', family: 'drum' }, hat: { factory_patch: 'drums.hat', family: 'drum' },
  open_hat: { factory_patch: 'drums.open', family: 'drum' }, lead: { factory_patch: 'lead.sine', family: 'lead' },
}, events, ...extra });
const lastSource = ctx => ctx.nodes.filter(n => n.type === 'source').at(-1);

test('Authored track gain 0/.1/.9 scales the channel without touching velocity or layer', () => {
  const gains = [];
  for (const gain of [0, .1, .9]) {
    const event = { kind: 'note', inst: 'lead', midi: 60, beat: 0, duration: 1, velocity: 100 };
    const { engine } = engineFor(baseStyle([event], { track_mix: { lead: { gain } } }));
    const region = engine.resolveFactoryRegion(engine.style.instrument_map.lead, event);
    assert.equal(region.lovel, 65, 'velocity 100 keeps the upper layer');
    engine.scheduleEvent(event, 0, 0);
    gains.push(engine.instrumentNodes.get('lead').gain.value);
    assert.equal(event.velocity, 100);
  }
  assert.deepEqual(gains, [0, .1, .9]);
  const { engine } = engineFor(baseStyle([], { track_mix: { lead: { gain: .5 } } }));
  engine.ensureInstrumentNode('lead');
  engine.setInstrumentVolume('lead', 50);
  assert.ok(Math.abs(engine.instrumentNodes.get('lead').gain.value - Math.pow(.5, 1.35) * .5) < 1e-12, 'fader and authored gain multiply');
});

test('Sends: none is dry, event overrides track, and the send bus is post-fader', () => {
  const dry = engineFor(baseStyle([]));
  dry.engine.scheduleEvent({ kind: 'note', inst: 'lead', midi: 60, beat: 0, duration: 1, velocity: 90 }, 0, 0);
  const sendBus = dry.engine.instrumentSends.get('lead');
  assert.ok(!dry.ctx.nodes.some(n => n.type === 'gain' && n !== sendBus && n.outputs.includes(sendBus)), 'no send without intent');

  const wet = engineFor(baseStyle([], { track_mix: { lead: { gain: 1, send: .2 } } }));
  wet.engine.scheduleEvent({ kind: 'note', inst: 'lead', midi: 60, beat: 0, duration: 1, velocity: 90 }, 0, 0);
  wet.engine.scheduleEvent({ kind: 'note', inst: 'lead', midi: 62, beat: 1, duration: 1, velocity: 90, send: .4 }, 1, 0);
  const bus = wet.engine.instrumentSends.get('lead');
  const feeds = wet.ctx.nodes.filter(n => n.type === 'gain' && n.outputs.includes(bus)).map(n => +n.gain.value.toFixed(4));
  assert.deepEqual(feeds, [+(.2 * .45).toFixed(4), +(.4 * .45).toFixed(4)]);
  assert.ok(reachable(bus, wet.engine.delay), 'send bus feeds the echo return');
  wet.engine.setInstrumentVolume('lead', 0);
  assert.equal(bus.gain.value, 0, 'fader at zero silences the post-fader send');
  assert.equal(wet.engine.instrumentNodes.get('lead').gain.value, 0);
});

test('Drum playback: oneShot ignores written length, gated follows it, legacy keeps 0.16 beats', () => {
  const stops = mode => [.04, 1, 4].map(duration => {
    const { engine, ctx } = engineFor(baseStyle([]));
    if (mode === 'legacy') engine.setDrumPolicy('legacy');
    const event = { kind: 'drum', inst: 'kick', beat: 0, duration, velocity: 110, ...(mode === 'gated' ? { playback: 'gated' } : {}) };
    engine.scheduleEvent(event, 0, 0);
    return +lastSource(ctx).stopped.toFixed(6);
  });
  const oneShot = stops('oneShot');
  assert.equal(new Set(oneShot).size, 1);
  assert.ok(Math.abs(oneShot[0] - (.003 + .9 + .005)) < 1e-6, 'natural body of the 0.9 s sample');
  const gated = stops('gated');
  assert.equal(new Set(gated).size, 3);
  assert.ok(gated[0] < gated[1] && gated[1] < gated[2]);
  const legacy = stops('legacy');
  assert.equal(new Set(legacy).size, 1);
  assert.ok(Math.abs(legacy[0] - (.003 + .16 / 2 + .12 + .05)) < 1e-6);

  const { engine, ctx } = engineFor(baseStyle([]));
  engine.scheduleEvent({ kind: 'drum', inst: 'kick', beat: 0, velocity: 110, sample_offset_ms: 300 }, 0, 0);
  assert.ok(Math.abs(lastSource(ctx).stopped - (.003 + .6 + .005)) < 1e-6, 'offset shortens the body');
  assert.throws(() => engine.playbackMode({}, { kind: 'drum', playback: 'forever' }));
});

test('Closed hat chokes an earlier open hat at its own start; simultaneous opens survive', () => {
  const { engine, ctx } = engineFor(baseStyle([]));
  engine.scheduleEvent({ kind: 'drum', inst: 'open_hat', beat: 0, velocity: 100 }, 0, 0);
  const open = lastSource(ctx), openGain = open.outputs[0];
  engine.scheduleEvent({ kind: 'drum', inst: 'open_hat', beat: 1, velocity: 100 }, 1, 0);
  const sameTime = lastSource(ctx);
  engine.scheduleEvent({ kind: 'drum', inst: 'hat', beat: 1, velocity: 100 }, 1, 0);
  const at = .5;
  assert.ok(Math.abs(open.stopped - (at + .05)) < 1e-6, 'earlier open hat stops just after the closed hit');
  assert.ok(openGain.gain.calls.some(c => c[0] === 'hold' && Math.abs(c[1] - at) < 1e-6));
  assert.ok(sameTime.stopped > at + 1, 'open hat starting with the closed hit keeps ringing');
  engine.scheduleEvent({ kind: 'drum', inst: 'open_hat', beat: 2, velocity: 100 }, 2, 0);
  const late = lastSource(ctx);
  engine.scheduleEvent({ kind: 'drum', inst: 'kick', beat: 2.1, velocity: 100 }, 2.1, 0);
  assert.ok(late.stopped > 2, 'other drums never choke hats');
});

test('Sample offsets past the buffer are rejected before playback', () => {
  const { engine } = engineFor(baseStyle([{ kind: 'drum', inst: 'hat', beat: 0, sample_offset_ms: 500 }]));
  assert.throws(() => engine.validateOffsets(engine.style), /Sample offset outside hat\.wav/);
});

test('Atelier bridge carries authored gain and send as track_mix, keeping zero', () => {
  const score = { title: 't', bpm: 100, beats: 4, bars: 1, barLength: 4, meter: '4/4', sections: [],
    tracks: [{ id: 'a', patch: 'p', role: 'lead', volume: 0, pan: 0 }, { id: 'b', patch: 'p', role: 'bass', volume: .35, send: .2, pan: 0 }],
    events: [{ track: 'a', midi: 60, beat: 0, duration: 1, velocity: .7 }, { track: 'b', midi: 40, beat: 1, duration: 1, velocity: .7 }] };
  const native = S.generated(score, { p: { family: 'keys', factory_patch: 'x', file: 'x.wav' } }, 'id', { id: 'adventure', label: 'Adventure' });
  assert.deepEqual(native.track_mix, { a: { gain: 0 }, b: { gain: .35, send: .2 } });
  assert.deepEqual(native.events.map(e => e.velocity), [89, 89], 'velocity is independent of track gain');
  assert.deepEqual(S.draft(native).track_mix, native.track_mix);
  assert.equal(native.key_source, 'atelier-default');
});
