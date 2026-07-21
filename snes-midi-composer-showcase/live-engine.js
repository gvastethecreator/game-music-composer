(() => {
  'use strict';

  const ROLE_AMP = {
    lead: .245, counter: .18, riff: .235, bass: .285,
    kick: .52, snare: .43, hat: .20, tom: .36, wood: .27, ride: .17,
    shaker: .16, brush: .16, rim: .22, impact: .31,
    comp: .155, arp: .15, motor: .17, ostinato: .18, pad: .105,
    support: .145, ensemble: .082, pulse: .15, texture: .07
  };
  const DRUM_ROLES = new Set(['kick','snare','hat','tom','wood','ride','shaker','brush','rim','impact']);
  const SUSTAIN_FAMILIES = new Set(['strings','choir','texture','wind','brass']);
  const dbToGain = db => Math.pow(10, db / 20);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function dataUriToArrayBuffer(uri) {
    const base64 = uri.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  class NeoSpcLiveEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.limiter = null;
      this.delay = null;
      this.feedback = null;
      this.delayFilter = null;
      this.analyserL = null;
      this.analyserR = null;
      this.style = null;
      this.buffers = new Map();
      this.instrumentNodes = new Map();
      this.instrumentVolumes = new Map();
      this.sources = new Set();
      this.playing = false;
      this.offsetBeat = 0;
      this.startTime = 0;
      this.lastScheduledBeat = 0;
      this.timer = 0;
      this.tempoPct = 100;
      this.transpose = 0;
      this.masterDb = -3;
      this.ceilingDb = -1;
      this.lookAheadSeconds = .24;
      this.schedulerIntervalMs = 42;
      this.onReadyState = null;
    }

    async ensureContext() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        return this.ctx;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio is not available in this browser.');
      const ctx = new AC({ latencyHint: 'interactive' });
      const master = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = .003;
      limiter.release.value = .11;
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = .22;
      const feedback = ctx.createGain();
      feedback.gain.value = .16;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 6200;
      delay.connect(delayFilter);
      delayFilter.connect(feedback);
      feedback.connect(delay);
      delayFilter.connect(master);
      const splitter = ctx.createChannelSplitter(2);
      const analyserL = ctx.createAnalyser();
      const analyserR = ctx.createAnalyser();
      analyserL.fftSize = analyserR.fftSize = 512;
      analyserL.smoothingTimeConstant = analyserR.smoothingTimeConstant = .72;
      master.connect(limiter);
      limiter.connect(ctx.destination);
      limiter.connect(splitter);
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);
      this.ctx = ctx;
      this.master = master;
      this.limiter = limiter;
      this.delay = delay;
      this.feedback = feedback;
      this.delayFilter = delayFilter;
      this.analyserL = analyserL;
      this.analyserR = analyserR;
      this.applyMaster();
      this.applyCeiling();
      await ctx.resume();
      return ctx;
    }

    factoryPatch(info) {
      return info?.factory_patch ? window.NEOSPC_FACTORY_BANK?.patches?.[info.factory_patch] : null;
    }

    resolveFactoryRegion(info, event) {
      const patch = this.factoryPatch(info);
      if (!patch) return null;
      const profileName = info.factory_profile || window.NEOSPC_FACTORY_BANK?.embedded_profile || 'neo16';
      const regions = patch.profiles?.[profileName]?.regions || [];
      if (!regions.length) return null;
      const midi = event.kind === 'drum' || patch.type === 'drum' || patch.type === 'fx'
        ? Number(patch.note ?? info.root_midi ?? event.midi ?? 60)
        : Number(event.midi ?? info.root_midi ?? 60);
      const velocity = clamp(Math.round(Number(event.velocity ?? ((event.velocity_norm || .66) * 127))), 1, 127);
      let matches = regions.filter(r => midi >= Number(r.lokey ?? midi) && midi <= Number(r.hikey ?? midi) && velocity >= Number(r.lovel ?? 1) && velocity <= Number(r.hivel ?? 127));
      if (!matches.length) matches = regions.filter(r => midi >= Number(r.lokey ?? midi) && midi <= Number(r.hikey ?? midi));
      if (!matches.length) {
        matches = [...regions].sort((a,b) => Math.abs(midi - Number(a.root ?? midi)) - Math.abs(midi - Number(b.root ?? midi))).slice(0,1);
      }
      const rrCount = Math.max(...matches.map(r => Number(r.rr_count || 1)), 1);
      const seed = Math.abs(Math.round((Number(event.performance_beat ?? event.beat ?? 0) * 97) + midi * 13 + velocity * 3));
      const rr = (seed % rrCount) + 1;
      return matches.find(r => Number(r.rr || 1) === rr) || matches[0] || null;
    }

    resolveSample(info, event) {
      const region = this.resolveFactoryRegion(info, event);
      if (region) return { source: 'factory', file: region.file, root: Number(region.root ?? info.root_midi ?? 60), loop: region.loop, region };
      if (!info?.file) return null;
      const legacy = window.NEOSPC_SAMPLE_BANK?.samples?.[info.file];
      if (!legacy) return null;
      return { source: 'legacy', file: info.file, root: Number(info.root_midi ?? legacy.root_midi ?? 60), loop: legacy.loop, legacy };
    }

    async decodeFile(file) {
      if (this.buffers.has(file)) return this.buffers.get(file);
      const factoryData = window.NEOSPC_FACTORY_BANK?.samples?.[file];
      const legacy = window.NEOSPC_SAMPLE_BANK?.samples?.[file];
      const uri = factoryData || legacy?.data;
      if (!uri) throw new Error(`Missing embedded sample: ${file}`);
      const ctx = await this.ensureContext();
      const buffer = await ctx.decodeAudioData(dataUriToArrayBuffer(uri).slice(0));
      this.buffers.set(file, buffer);
      return buffer;
    }

    async prepareStyle(style) {
      await this.ensureContext();
      const uniqueFiles = [...new Set(style.events.map(event => this.resolveSample(style.instrument_map?.[event.inst], event)?.file).filter(Boolean))];
      if (typeof this.onReadyState === 'function') this.onReadyState(`LOADING ${uniqueFiles.length} FACTORY SAMPLES`);
      await Promise.all(uniqueFiles.map(file => this.decodeFile(file)));
      if (this.style !== style) this.setStyle(style);
      if (typeof this.onReadyState === 'function') this.onReadyState('FACTORY BANK READY');
    }

    setStyle(style) {
      const wasPlaying = this.playing;
      const beat = this.getBeat();
      this.pause(false);
      this.style = style;
      this.offsetBeat = 0;
      this.instrumentNodes.forEach(node => { try { node.disconnect(); } catch (_) {} });
      this.instrumentNodes.clear();
      if (this.ctx && style) {
        for (const inst of new Set(style.events.map(e => e.inst))) this.ensureInstrumentNode(inst);
      }
      if (wasPlaying) this.play(beat % style.beats);
    }

    ensureInstrumentNode(inst) {
      if (this.instrumentNodes.has(inst)) return this.instrumentNodes.get(inst);
      if (!this.ctx) return null;
      const node = this.ctx.createGain();
      const value = this.instrumentVolumes.has(inst) ? this.instrumentVolumes.get(inst) : 1;
      node.gain.value = Math.pow(value, 1.35);
      node.connect(this.master);
      this.instrumentNodes.set(inst, node);
      return node;
    }

    setInstrumentVolume(inst, percent) {
      const value = clamp(Number(percent) / 100, 0, 1);
      this.instrumentVolumes.set(inst, value);
      const node = this.ensureInstrumentNode(inst);
      if (node && this.ctx) node.gain.setTargetAtTime(Math.pow(value, 1.35), this.ctx.currentTime, .018);
    }

    getInstrumentVolume(inst) {
      return Math.round((this.instrumentVolumes.has(inst) ? this.instrumentVolumes.get(inst) : 1) * 100);
    }

    resetInstrumentVolumes(style = this.style) {
      if (!style) return;
      for (const inst of new Set(style.events.map(e => e.inst))) this.setInstrumentVolume(inst, 100);
    }

    setTempo(percent) {
      const beat = this.getBeat();
      const resume = this.playing;
      this.tempoPct = clamp(Number(percent), 40, 220);
      if (resume) {
        this.pause(false);
        this.play(beat);
      }
    }

    setTranspose(semitones) {
      const beat = this.getBeat();
      const resume = this.playing;
      this.transpose = clamp(Math.round(Number(semitones)), -12, 12);
      if (resume) {
        this.pause(false);
        this.play(beat);
      }
    }

    setMasterDb(db) {
      this.masterDb = Number(db);
      this.applyMaster();
    }

    setCeilingDb(db) {
      this.ceilingDb = Number(db);
      this.applyCeiling();
    }

    applyMaster() {
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(dbToGain(this.masterDb), this.ctx.currentTime, .015);
    }

    applyCeiling() {
      if (this.limiter && this.ctx) this.limiter.threshold.setTargetAtTime(this.ceilingDb, this.ctx.currentTime, .02);
    }

    beatsPerSecond() {
      return ((this.style?.bpm || 120) * (this.tempoPct / 100)) / 60;
    }

    getDuration() {
      return this.style ? this.style.beats / this.beatsPerSecond() : 0;
    }

    getBeat() {
      if (!this.style) return 0;
      if (!this.playing || !this.ctx) return ((this.offsetBeat % this.style.beats) + this.style.beats) % this.style.beats;
      const absolute = this.offsetBeat + (this.ctx.currentTime - this.startTime) * this.beatsPerSecond();
      return ((absolute % this.style.beats) + this.style.beats) % this.style.beats;
    }

    getElapsed() {
      return this.getBeat() / this.beatsPerSecond();
    }

    isPlaying() { return this.playing; }

    async play(startBeat = this.offsetBeat) {
      if (!this.style) return;
      await this.prepareStyle(this.style);
      if (this.playing) return;
      await this.ctx.resume();
      this.offsetBeat = ((Number(startBeat) % this.style.beats) + this.style.beats) % this.style.beats;
      this.startTime = this.ctx.currentTime;
      this.lastScheduledBeat = this.offsetBeat - .03;
      this.playing = true;
      this.scheduler();
      this.timer = window.setInterval(() => this.scheduler(), this.schedulerIntervalMs);
    }

    pause(preserveBeat = true) {
      if (preserveBeat && this.style) this.offsetBeat = this.getBeat();
      this.playing = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = 0;
      for (const source of this.sources) {
        try { source.stop(); } catch (_) {}
      }
      this.sources.clear();
    }

    seekBeat(beat) {
      const resume = this.playing;
      this.pause(false);
      this.offsetBeat = this.style ? ((Number(beat) % this.style.beats) + this.style.beats) % this.style.beats : 0;
      if (resume) this.play(this.offsetBeat);
    }

    scheduler() {
      if (!this.playing || !this.style || !this.ctx) return;
      const bps = this.beatsPerSecond();
      const currentAbs = this.offsetBeat + (this.ctx.currentTime - this.startTime) * bps;
      const horizon = currentAbs + this.lookAheadSeconds * bps;
      const from = Math.max(this.lastScheduledBeat, currentAbs - .01);
      const n = this.style.beats;
      const firstLoop = Math.floor(from / n) - 1;
      const lastLoop = Math.floor(horizon / n) + 1;
      for (let loop = firstLoop; loop <= lastLoop; loop++) {
        const loopBase = loop * n;
        for (const event of this.style.events) {
          const eventBeat = Number(event.performance_beat ?? event.beat ?? 0);
          const absoluteBeat = loopBase + eventBeat;
          if (absoluteBeat <= from + 1e-5 || absoluteBeat > horizon + 1e-5) continue;
          this.scheduleEvent(event, absoluteBeat, currentAbs);
        }
      }
      this.lastScheduledBeat = horizon;
    }

    scheduleEvent(event, absoluteBeat, currentAbs) {
      const info = this.style.instrument_map[event.inst];
      if (!info) return;
      const resolved = this.resolveSample(info, event);
      if (!resolved) return;
      const buffer = this.buffers.get(resolved.file);
      if (!buffer) return;
      const legacy = resolved.source === 'legacy' ? window.NEOSPC_SAMPLE_BANK?.samples?.[resolved.file] : null;
      const bps = this.beatsPerSecond();
      const when = Math.max(this.ctx.currentTime + .003, this.ctx.currentTime + (absoluteBeat - currentAbs) / bps);
      const durationBeats = event.kind === 'drum' ? .16 : Math.max(.035, Number(event.performance_duration ?? event.duration ?? .2));
      const durationSeconds = durationBeats / bps;
      const family = info.family || '';
      const role = event.role || (event.kind === 'drum' ? event.inst : 'support');
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const transpose = event.kind === 'drum' || family === 'drum' ? 0 : this.transpose;
      const cents = Number(event.tuning_cents || 0);
      const midi = Number(event.midi ?? resolved.root ?? info.root_midi ?? 60);
      source.playbackRate.value = Math.pow(2, ((midi + transpose - Number(resolved.root ?? info.root_midi ?? 60)) + cents / 100) / 12);
      const loop = resolved.loop;
      if (event.kind !== 'drum' && loop && durationSeconds > .22) {
        source.loop = true;
        const sampleRate = Number(window.NEOSPC_FACTORY_BANK?.profiles?.neo16?.sample_rate || 32000);
        source.loopStart = Number(loop.start_sec ?? (loop.start != null ? loop.start / sampleRate : 0));
        source.loopEnd = Math.min(buffer.duration, Number(loop.end_sec ?? (loop.end != null ? loop.end / sampleRate : buffer.duration)));
      }
      const noteGain = this.ctx.createGain();
      const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      const instNode = this.ensureInstrumentNode(event.inst);
      const calibration = Number(legacy?.linear_gain || 1);
      const sourceTrim = dbToGain(Number(info.mix_trim_db || 0));
      const velocityGain = Number(event.velocity_gain || 1);
      const amp = clamp((ROLE_AMP[role] || .15) * velocityGain * sourceTrim * calibration, 0, 1.2);
      const attack = Number(event.attack ?? (event.kind === 'drum' ? .001 : (SUSTAIN_FAMILIES.has(family) ? .065 : .012)));
      const release = Number(event.release ?? (event.kind === 'drum' ? .12 : (SUSTAIN_FAMILIES.has(family) ? .34 : .16)));
      noteGain.gain.setValueAtTime(.0001, when);
      noteGain.gain.linearRampToValueAtTime(Math.max(.0001, amp), when + Math.min(attack, durationSeconds * .45));
      const releaseStart = Math.max(when + .005, when + durationSeconds - Math.min(release, durationSeconds * .45));
      noteGain.gain.setValueAtTime(Math.max(.0001, amp), releaseStart);
      noteGain.gain.exponentialRampToValueAtTime(.0001, when + durationSeconds + release);
      if (pan) {
        pan.pan.value = clamp(Number(event.performance_pan ?? event.pan ?? 0), -1, 1);
        source.connect(noteGain);
        noteGain.connect(pan);
        pan.connect(instNode);
        const send = clamp(Number(event.send || 0), 0, .45);
        if (send > .001) {
          const sendGain = this.ctx.createGain();
          sendGain.gain.value = send * .45;
          pan.connect(sendGain);
          sendGain.connect(this.delay);
        }
      } else {
        source.connect(noteGain);
        noteGain.connect(instNode);
      }
      source.onended = () => this.sources.delete(source);
      this.sources.add(source);
      const offsetSeconds = Math.max(0, Number(event.sample_offset_ms || 0) / 1000);
      try { source.start(when, Math.min(offsetSeconds, Math.max(0, buffer.duration - .01))); }
      catch (_) { source.start(when); }
      source.stop(when + durationSeconds + release + .05);
    }

    destroy() {
      this.pause(false);
      if (this.ctx) this.ctx.close();
      this.ctx = null;
    }
  }

  window.NeoSpcLiveEngine = NeoSpcLiveEngine;
})();
