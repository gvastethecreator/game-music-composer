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
  // Drum playback policy. oneShot plays the sample body; gated follows the written
  // duration; legacy keeps the historical 0.16-beat gate for compatibility renders.
  const PLAYBACK_MODES = new Set(['oneShot', 'gated', 'legacy']);
  const LEGACY_DRUM_BEATS = .16;
  const ONE_SHOT_MAX_SECONDS = 6;
  // Closed hats cut ringing open hats in the same group; open hats never cut closed ones.
  const DEFAULT_CHOKE = { hat: ['hats', true], closed_hat: ['hats', true], open_hat: ['hats', false], open: ['hats', false] };
  // Historical native send law: sample voices scale event.send by .45 (cap .45),
  // chip voices by .22 (cap .3). Track sends use the same law.
  const SEND_LAW = { sample: [.45, .45], chip: [.22, .3] };
  const BANK_ALIASES = {chamber:'factory'};
  const BANK_MODES = new Set(['factory','chamber','original','chip','velvet','circuit','timber','prism','voltage','megadrive','snes']);
  const resolveBankMode = mode => BANK_ALIASES[mode] || mode;
  const factoryChunks = new Map();

  function loadFactorySamples(file) {
    const chunk = [window.NEOSPC_FACTORY_BANK, ...Object.values(window.NEOSPC_PALETTES || {})].map(bank => bank?.sample_sources?.[file]).find(Boolean);
    if (!chunk) return Promise.resolve();
    if (!factoryChunks.has(chunk)) {
      const pending = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL(chunk, document.baseURI).href;
        script.onload = () => { script.remove(); resolve(); };
        script.onerror = () => { script.remove(); reject(new Error(`Cannot load soundbank: ${chunk}`)); };
        document.head.append(script);
      }).catch(error => { factoryChunks.delete(chunk); throw error; });
      factoryChunks.set(chunk, pending);
    }
    return factoryChunks.get(chunk);
  }
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
      this.instrumentSends = new Map();
      this.instrumentVolumes = new Map();
      this.chokeVoices = new Map();
      this.drumPolicy = 'oneShot';
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
      this.bankMode = 'factory'; // Chamber production bank
      this.noiseBuffer = null;
      this.lookAheadSeconds = .24;
      this.schedulerIntervalMs = 42;
      this.onReadyState = null;
      this.playRequest = 0;
    }

    async ensureContext() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        return this.ctx;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio is not available in this browser.');
      const ctx = new AC({ latencyHint: 'interactive' });
      this.createGraph(ctx);
      await ctx.resume();
      return ctx;
    }

    createGraph(ctx) {
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
      this.applyMixRecipe(this.style);
    }

    applyMixRecipe(style) {
      if (!this.delay || !this.feedback) return;
      const mix = style?.mix || {};
      const echo = Number(mix.echo_time);
      const feedback = Number(mix.echo_feedback);
      this.delay.delayTime.value = Number.isFinite(echo) ? clamp(echo, .02, 1.4) : .22;
      this.feedback.gain.value = Number.isFinite(feedback) ? clamp(feedback, 0, .8) : .16;
    }

    factoryPatch(info) {
      const bank = window.NEOSPC_PALETTES?.[this.bankMode] || window.NEOSPC_FACTORY_BANK;
      return info?.factory_patch ? bank?.patches?.[info.factory_patch] : null;
    }

    resolveFactoryRegion(info, event) {
      const patch = this.factoryPatch(info);
      if (!patch) return null;
      const profileName = info.factory_profile || window.NEOSPC_FACTORY_BANK?.embedded_profile || 'neo16';
      const regions = patch.profiles?.[profileName]?.regions || [];
      if (!regions.length) return null;
      const midi = event.kind === 'drum' || patch.type === 'drum' || patch.type === 'fx'
        ? Number(patch.note ?? info.root_midi ?? event.midi ?? 60)
        : Number(event.midi ?? info.root_midi ?? 60) + this.transpose;
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
      if (this.bankMode === 'chip') return null;
      if (this.bankMode !== 'original') {
        const region = this.resolveFactoryRegion(info, event);
        if (region) return { source: 'factory', file: region.file, root: Number(region.root ?? info.root_midi ?? 60), loop: region.loop, region };
      }
      if (!info?.file) return null;
      const legacy = window.NEOSPC_SAMPLE_BANK?.samples?.[info.file];
      if (!legacy) return null;
      return { source: 'legacy', file: info.file, root: Number(info.root_midi ?? legacy.root_midi ?? 60), loop: legacy.loop, legacy };
    }

    sampleGain(file) {
      const gain = window.NEOSPC_LEVELS?.gain_db?.[file];
      if (!Number.isFinite(gain)) throw new Error(`Missing level calibration: ${file}`);
      return dbToGain(gain);
    }

    async decodeFile(file) {
      if (this.buffers.has(file)) return this.buffers.get(file);
      await loadFactorySamples(file);
      const factoryData = [window.NEOSPC_FACTORY_BANK, ...Object.values(window.NEOSPC_PALETTES || {})].map(bank => bank?.samples?.[file]).find(Boolean);
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
      if (this.bankMode === 'chip') {
        if (typeof this.onReadyState === 'function') this.onReadyState('CHIP CORE READY');
        return;
      }
      const uniqueFiles = [...new Set(style.events.map(event => this.resolveSample(style.instrument_map?.[event.inst], event)?.file).filter(Boolean))];
      const label = ({factory:'Chamber',original:'Compact',velvet:'Velvet',circuit:'Circuit',timber:'Timber',prism:'Prism',voltage:'Voltage',megadrive:'Mega Drive · sampled',snes:'SNES · sampled'})[this.bankMode].toUpperCase();
      if (typeof this.onReadyState === 'function') this.onReadyState(`LOADING ${uniqueFiles.length} ${label} SAMPLES`);
      await Promise.all(uniqueFiles.map(file => this.decodeFile(file)));
      this.validateOffsets(style);
      if (typeof this.onReadyState === 'function') this.onReadyState(`${label} BANK READY`);
    }

    // Sample offsets past the buffer are rejected before playback instead of replaying from zero.
    validateOffsets(style) {
      for (const event of style.events) {
        const offset = Number(event.sample_offset_ms || 0);
        const resolved = this.resolveSample(style.instrument_map?.[event.inst], event);
        const buffer = resolved && this.buffers.get(resolved.file);
        if (buffer && (!Number.isFinite(offset) || offset < 0 || offset / 1000 >= buffer.duration)) throw new Error(`Sample offset outside ${resolved.file}: ${event.sample_offset_ms} ms`);
      }
    }

    setBankMode(mode) {
      if (!BANK_MODES.has(mode)) throw new Error(`Unknown soundbank mode: ${mode}`);
      mode = resolveBankMode(mode);
      if (mode === this.bankMode) return;
      const beat = this.getBeat();
      const resume = this.playing;
      this.pause(false);
      this.bankMode = mode;
      this.offsetBeat = beat;
      if (resume) this.play(beat);
    }

    getBankMode() { return this.bankMode; }

    setStyle(style) {
      if (this.style === style) {
        this.applyMixRecipe(style);
        return;
      }
      const wasPlaying = this.playing;
      const beat = this.getBeat();
      this.pause(false);
      this.style = style;
      this.offsetBeat = 0;
      this.instrumentNodes.forEach(node => { try { node.disconnect(); } catch (_) {} });
      this.instrumentSends.forEach(node => { try { node.disconnect(); } catch (_) {} });
      this.instrumentNodes.clear();
      this.instrumentSends.clear();
      if (this.ctx && style) {
        for (const inst of new Set(style.events.map(e => e.inst))) this.ensureInstrumentNode(inst);
      }
      this.applyMixRecipe(style);
      if (wasPlaying) this.play(beat % style.beats);
    }

    // Authored track mix from the score: linear gain (neutral 1, 0 is silence) and an
    // optional track send. It is independent of note velocity and sample-layer choice.
    trackMix(inst) {
      const mix = this.style?.track_mix?.[inst] || {};
      const gain = Number(mix.gain);
      const send = Number(mix.send);
      return { gain: Number.isFinite(gain) ? clamp(gain, 0, 4) : 1, send: Number.isFinite(send) ? clamp(send, 0, 1) : null };
    }

    channelGain(inst) {
      const fader = this.instrumentVolumes.has(inst) ? this.instrumentVolumes.get(inst) : 1;
      return Math.pow(fader, 1.35) * this.trackMix(inst).gain;
    }

    ensureInstrumentNode(inst) {
      if (this.instrumentNodes.has(inst)) return this.instrumentNodes.get(inst);
      if (!this.ctx) return null;
      const node = this.ctx.createGain();
      const send = this.ctx.createGain();
      node.gain.value = send.gain.value = this.channelGain(inst);
      node.connect(this.master);
      // Post-fader send bus: fader, authored gain and mute reach the echo return too.
      send.connect(this.delay);
      this.instrumentNodes.set(inst, node);
      this.instrumentSends.set(inst, send);
      return node;
    }

    setInstrumentVolume(inst, percent) {
      const value = clamp(Number(percent) / 100, 0, 1);
      this.instrumentVolumes.set(inst, value);
      const node = this.ensureInstrumentNode(inst);
      if (!node || !this.ctx) return;
      const gain = this.channelGain(inst);
      node.gain.setTargetAtTime(gain, this.ctx.currentTime, .018);
      this.instrumentSends.get(inst).gain.setTargetAtTime(gain, this.ctx.currentTime, .018);
    }

    setDrumPolicy(policy) {
      if (!['oneShot', 'legacy'].includes(policy)) throw new Error(`Unknown drum policy: ${policy}`);
      this.drumPolicy = policy;
    }

    playbackMode(info, event) {
      const declared = event.playback ?? info.playback;
      if (declared !== undefined) {
        if (!PLAYBACK_MODES.has(declared)) throw new Error(`Unknown playback mode: ${declared}`);
        return declared;
      }
      return event.kind === 'drum' ? this.drumPolicy : 'gated';
    }

    chokeRule(info, event) {
      const group = event.choke_group ?? info.choke_group;
      if (group !== undefined) return group ? [group, Boolean(event.chokes ?? info.chokes)] : null;
      return event.kind === 'drum' ? DEFAULT_CHOKE[event.inst] || null : null;
    }

    // A closing voice cuts earlier ringing voices of its group at its own start time.
    // Voices that start at the same instant survive, so the order of the array is irrelevant.
    applyChoke(rule, when, voice) {
      if (!rule) return;
      const [group, closes] = rule;
      let voices = this.chokeVoices.get(group);
      if (!voices) this.chokeVoices.set(group, voices = new Set());
      if (closes) {
        for (const old of voices) {
          if (old.closes || old.when >= when || old.end <= when) continue;
          const g = old.gain.gain;
          if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(when);
          else { g.cancelScheduledValues(when); g.setValueAtTime(old.amp, when); }
          g.setTargetAtTime(.0001, when, .006);
          try { old.source.stop(when + .05); } catch (_) {}
          old.end = when + .05;
        }
      }
      for (const old of voices) if (old.end <= when) voices.delete(old);
      voices.add({ ...voice, closes });
    }

    connectVoice(event, noteGain, branch) {
      const [factor, cap] = SEND_LAW[branch];
      const instNode = this.ensureInstrumentNode(event.inst);
      const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      const out = pan || noteGain;
      if (pan) {
        pan.pan.value = clamp(Number(event.performance_pan ?? event.pan ?? 0), -1, 1);
        noteGain.connect(pan);
      }
      out.connect(instNode);
      // Event send overrides the track send; neither means a dry voice.
      const send = clamp(Number(event.send ?? this.trackMix(event.inst).send ?? 0), 0, cap);
      if (send > .001) {
        const sendGain = this.ctx.createGain();
        sendGain.gain.value = send * factor;
        out.connect(sendGain);
        sendGain.connect(this.instrumentSends.get(event.inst));
      }
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
      if (!this.style || this.playing) return;
      const style = this.style, request = ++this.playRequest;
      await this.prepareStyle(style);
      if (request !== this.playRequest || this.style !== style) return;
      await this.ctx.resume();
      if (request !== this.playRequest || this.style !== style) return;
      this.offsetBeat = ((Number(startBeat) % this.style.beats) + this.style.beats) % this.style.beats;
      this.startTime = this.ctx.currentTime;
      this.lastScheduledBeat = this.offsetBeat - .03;
      this.playing = true;
      this.scheduler();
      this.timer = window.setInterval(() => this.scheduler(), this.schedulerIntervalMs);
    }

    pause(preserveBeat = true) {
      this.playRequest++;
      if (preserveBeat && this.style) this.offsetBeat = this.getBeat();
      this.playing = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = 0;
      for (const source of this.sources) {
        try { source.stop(); } catch (_) {}
      }
      this.sources.clear();
      this.chokeVoices.clear();
    }

    async renderWav(style = this.style, settings = this) {
      if (!style) throw new Error('Load a score first.');
      const renderer = new NeoSpcLiveEngine();
      renderer.style = JSON.parse(JSON.stringify(style));
      for (const key of ['bankMode', 'tempoPct', 'transpose', 'masterDb', 'ceilingDb']) renderer[key] = settings[key];
      renderer.drumPolicy = settings.drumPolicy || this.drumPolicy;
      renderer.instrumentVolumes = new Map(settings.instrumentVolumes);
      const seconds = renderer.getDuration(), sampleRate = 32000, length = Math.round(seconds * sampleRate);
      if (seconds > 120) throw new Error('Browser WAV export supports loops up to 2 minutes. Export longer scores with the skill.');
      if (renderer.bankMode !== 'chip') {
        const files = [...new Set(style.events.map(e => renderer.resolveSample(style.instrument_map[e.inst], e)?.file).filter(Boolean))];
        await Promise.all(files.map(async file => renderer.buffers.set(file, await this.decodeFile(file))));
        renderer.validateOffsets(renderer.style);
      }
      const ctx = new OfflineAudioContext(2, length * 2, sampleRate);
      renderer.createGraph(ctx);
      // A warm-up loop carries sample releases and echo across the exported seam.
      for (let loop = 0; loop < 2; loop++) for (const event of renderer.style.events) renderer.scheduleEvent(event, loop * style.beats + Number(event.performance_beat ?? event.beat), 0);
      const audio = await ctx.startRendering(), bytes = new ArrayBuffer(44 + length * 4), view = new DataView(bytes);
      const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
      text(0, 'RIFF');view.setUint32(4, bytes.byteLength - 8, true);text(8, 'WAVE');text(12, 'fmt ');view.setUint32(16, 16, true);view.setUint16(20, 1, true);view.setUint16(22, 2, true);view.setUint32(24, sampleRate, true);view.setUint32(28, sampleRate * 4, true);view.setUint16(32, 4, true);view.setUint16(34, 16, true);text(36, 'data');view.setUint32(40, length * 4, true);
      const channels = [audio.getChannelData(0), audio.getChannelData(1)];
      for (let i = 0; i < length; i++) for (let c = 0; c < 2; c++) view.setInt16(44 + i * 4 + c * 2, Math.round(clamp(channels[c][length + i], -1, 1) * 32767), true);
      return new Blob([bytes], { type: 'audio/wav' });
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
      if (this.bankMode === 'chip') {
        this.scheduleChipEvent(event, info, absoluteBeat, currentAbs);
        return;
      }
      const resolved = this.resolveSample(info, event);
      if (!resolved) return;
      const buffer = this.buffers.get(resolved.file);
      if (!buffer) return;
      const bps = this.beatsPerSecond();
      const when = Math.max(this.ctx.currentTime + .003, this.ctx.currentTime + (absoluteBeat - currentAbs) / bps);
      const mode = this.playbackMode(info, event);
      const family = info.family || '';
      const role = event.role || (event.kind === 'drum' ? event.inst : 'support');
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const transpose = event.kind === 'drum' || family === 'drum' ? 0 : this.transpose;
      const cents = Number(event.tuning_cents || 0);
      const midi = Number(event.kind === 'drum' ? (resolved.root ?? info.root_midi ?? 60) : (event.midi ?? resolved.root ?? info.root_midi ?? 60));
      const rate = Math.pow(2, ((midi + transpose - Number(resolved.root ?? info.root_midi ?? 60)) + cents / 100) / 12);
      source.playbackRate.value = rate;
      const offsetSeconds = Number(event.sample_offset_ms || 0) / 1000; // validated by prepareStyle
      // A one-shot keeps its natural body: buffer length after the offset, at the played rate.
      const body = (buffer.duration - offsetSeconds) / rate;
      const durationSeconds = mode === 'oneShot' ? Math.min(body, ONE_SHOT_MAX_SECONDS)
        : (mode === 'legacy' ? LEGACY_DRUM_BEATS : Math.max(.035, Number(event.performance_duration ?? event.duration ?? .2))) / bps;
      const loop = resolved.loop;
      if (mode === 'gated' && loop && durationSeconds > .22) {
        source.loop = true;
        const sampleRate = Number(window.NEOSPC_FACTORY_BANK?.profiles?.neo16?.sample_rate || 32000);
        source.loopStart = Number(loop.start_sec ?? (loop.start != null ? loop.start / sampleRate : 0));
        source.loopEnd = Math.min(buffer.duration, Number(loop.end_sec ?? (loop.end != null ? loop.end / sampleRate : buffer.duration)));
      }
      const noteGain = this.ctx.createGain();
      const calibration = this.sampleGain(resolved.file);
      const sourceTrim = dbToGain(Number(info.mix_trim_db || 0));
      const velocityGain = Number(event.velocity_gain || 1);
      const amp = Math.max(.0001, clamp((ROLE_AMP[role] || .15) * velocityGain * sourceTrim, 0, 1.2) * calibration);
      const attack = Number(event.attack ?? (event.kind === 'drum' ? .001 : (SUSTAIN_FAMILIES.has(family) ? .065 : .012)));
      noteGain.gain.setValueAtTime(.0001, when);
      noteGain.gain.linearRampToValueAtTime(amp, when + Math.min(attack, durationSeconds * .45));
      let end;
      if (mode === 'oneShot') {
        // Only a short edge fade at the natural end (or the safety cap) to avoid a click.
        const fade = Math.min(.012, durationSeconds * .2);
        noteGain.gain.setValueAtTime(amp, when + durationSeconds - fade);
        noteGain.gain.exponentialRampToValueAtTime(.0001, when + durationSeconds);
        end = when + durationSeconds + .005;
      } else {
        const release = Number(event.release ?? (event.kind === 'drum' ? .12 : (SUSTAIN_FAMILIES.has(family) ? .34 : .16)));
        const releaseStart = Math.max(when + .005, when + durationSeconds - Math.min(release, durationSeconds * .45));
        noteGain.gain.setValueAtTime(amp, releaseStart);
        noteGain.gain.exponentialRampToValueAtTime(.0001, when + durationSeconds + release);
        end = when + durationSeconds + release + .05;
      }
      source.connect(noteGain);
      this.connectVoice(event, noteGain, 'sample');
      this.applyChoke(this.chokeRule(info, event), when, { when, end, amp, gain: noteGain, source });
      source.onended = () => this.sources.delete(source);
      this.sources.add(source);
      source.start(when, offsetSeconds);
      source.stop(end);
    }

    getNoiseBuffer() {
      if (this.noiseBuffer) return this.noiseBuffer;
      const length = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 0x7f4a7c15;
      for (let i = 0; i < length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = (seed / 0xffffffff) * 2 - 1;
      }
      this.noiseBuffer = buffer;
      return buffer;
    }

    scheduleChipEvent(event, info, absoluteBeat, currentAbs) {
      const bps = this.beatsPerSecond();
      const when = Math.max(this.ctx.currentTime + .003, this.ctx.currentTime + (absoluteBeat - currentAbs) / bps);
      const role = event.role || (event.kind === 'drum' ? event.inst : 'support');
      const family = info.family || '';
      const isDrum = event.kind === 'drum' || family === 'drum';
      // Chip drums are synthesized one-shots with fixed shapes; tonal chip voices follow the gate.
      const durationBeats = isDrum ? LEGACY_DRUM_BEATS : Math.max(.035, Number(event.performance_duration ?? event.duration ?? .2));
      const baseDuration = durationBeats / bps;
      const velocityGain = Number(event.velocity_gain || 1) * Number(event.performance_gain || 1);
      const amp = clamp((ROLE_AMP[role] || .15) * velocityGain * (isDrum ? .55 : .48), .004, .34) * dbToGain(window.NEOSPC_LEVELS.chip_gain_db);
      const noteGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      let source;
      let release = isDrum ? .08 : (SUSTAIN_FAMILIES.has(family) ? .22 : .1);
      let duration = baseDuration;

      if (isDrum && !['kick','tom','impact'].includes(event.inst)) {
        source = this.ctx.createBufferSource();
        source.buffer = this.getNoiseBuffer();
        const noiseShape = {
          snare: ['bandpass', 1800, .14], hat: ['highpass', 6500, .045], open_hat: ['highpass', 5200, .18],
          shaker: ['highpass', 4800, .09], ride: ['highpass', 7200, .22], brush: ['bandpass', 2600, .2],
          rim: ['bandpass', 3400, .04], wood: ['bandpass', 1200, .055],
        }[event.inst] || ['highpass', 4200, .08];
        filter.type = noiseShape[0];
        filter.frequency.value = noiseShape[1];
        filter.Q.value = event.inst === 'rim' || event.inst === 'wood' ? 7 : 1.1;
        duration = noiseShape[2];
        release = .025;
      } else {
        source = this.ctx.createOscillator();
        const midi = Number(event.midi ?? info.root_midi ?? (event.inst === 'kick' ? 36 : 48));
        if (isDrum) {
          const drumHz = event.inst === 'kick' ? [118, 46] : event.inst === 'impact' ? [72, 31] : [165, 72];
          source.type = 'sine';
          source.frequency.setValueAtTime(drumHz[0], when);
          source.frequency.exponentialRampToValueAtTime(drumHz[1], when + (event.inst === 'impact' ? .23 : .1));
          filter.type = 'lowpass';
          filter.frequency.value = event.inst === 'impact' ? 520 : 900;
          duration = event.inst === 'impact' ? .28 : .16;
          release = .08;
        } else {
          const transpose = this.transpose;
          const cents = Number(event.tuning_cents || 0);
          const hz = 440 * Math.pow(2, ((midi + transpose - 69) + cents / 100) / 12);
          source.type = family === 'bass' ? 'triangle' : ['lead','riff','pulse'].includes(role) ? 'square' : SUSTAIN_FAMILIES.has(family) ? 'sawtooth' : 'triangle';
          source.frequency.value = hz;
          source.detune.value += source.type === 'sawtooth' ? -3 : 0;
          filter.type = 'lowpass';
          filter.frequency.value = family === 'bass' ? 1100 : SUSTAIN_FAMILIES.has(family) ? 2800 : 4600;
          filter.Q.value = source.type === 'square' ? 1.4 : .55;
        }
      }

      const attack = isDrum ? .001 : Number(event.attack ?? (SUSTAIN_FAMILIES.has(family) ? .045 : .008));
      noteGain.gain.setValueAtTime(.0001, when);
      noteGain.gain.linearRampToValueAtTime(amp, when + Math.min(attack, duration * .4));
      const releaseStart = Math.max(when + .004, when + duration - Math.min(release, duration * .4));
      noteGain.gain.setValueAtTime(amp, releaseStart);
      noteGain.gain.exponentialRampToValueAtTime(.0001, when + duration + release);
      source.connect(filter);
      filter.connect(noteGain);
      this.connectVoice(event, noteGain, 'chip');
      this.applyChoke(this.chokeRule(info, event), when, { when, end: when + duration + release + .03, amp, gain: noteGain, source });
      source.onended = () => this.sources.delete(source);
      this.sources.add(source);
      source.start(when);
      source.stop(when + duration + release + .03);
    }

    destroy() {
      this.pause(false);
      if (this.ctx) this.ctx.close();
      this.ctx = null;
      this.instrumentNodes.clear();
      this.instrumentSends.clear();
      this.noiseBuffer = null;
    }
  }

  window.NeoSpcLiveEngine = NeoSpcLiveEngine;
})();
