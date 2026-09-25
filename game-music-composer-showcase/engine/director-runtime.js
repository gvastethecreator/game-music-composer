/* GMC game-music runtime. Plays a package exported from Composer Studio Create
   (manifest.json + one seamless loop per game state) and crossfades between states
   on the next beat, bar or phrase line. Web Audio only; no dependencies, no network
   beyond loading the package files you point it at.

   const director = new GMCMusicDirector({ baseUrl: 'music/dusk/' });
   await director.load();
   director.start('explore');           // after a user gesture (autoplay policy)
   director.setState('combat');         // switches on the next bar line
   director.setState('calm', { quantize: 'phrase', fade: 1.5 });
*/
(function gmcDirectorRuntime(root) {
  'use strict';
  class GMCMusicDirector {
    constructor({ context = null, baseUrl = '', manifest = null, fade = 0.12, output = null } = {}) {
      this.context = context;
      this.baseUrl = baseUrl;
      this.manifest = manifest;
      this.fade = fade;
      this.output = output;
      this.buffers = new Map();
      this.voices = new Map();
      this.current = null;
      this.pending = null;
      this.startTime = 0;
      this.onChange = null;
    }

    async load(fetcher = (url) => fetch(url)) {
      if (!this.context) {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) throw new Error('Web Audio is not available.');
        this.context = new AC();
      }
      if (!this.manifest) this.manifest = await (await fetcher(this.baseUrl + 'manifest.json')).json();
      if (this.manifest.format !== 'gmc.game-music') throw new Error('Not a GMC game-music manifest.');
      await Promise.all(this.manifest.states.map(async (state) => {
        const data = await (await fetcher(this.baseUrl + state.file)).arrayBuffer();
        this.buffers.set(state.id, await this.context.decodeAudioData(data));
      }));
      return this.manifest;
    }

    // Every loop starts together so all states stay in phase; only gains change.
    start(stateId = this.manifest.initialState, when = this.context.currentTime + 0.05) {
      this.stop(0);
      const out = this.output || this.context.destination;
      this.startTime = when;
      for (const state of this.manifest.states) {
        const source = this.context.createBufferSource(), gain = this.context.createGain();
        source.buffer = this.buffers.get(state.id);
        source.loop = true;
        gain.gain.value = state.id === stateId ? 1 : 0;
        source.connect(gain).connect(out);
        source.start(when);
        this.voices.set(state.id, { source, gain });
      }
      this.current = stateId;
      this.onChange?.(this.current, null);
    }

    period(quantize) {
      const beat = 60 / this.manifest.bpm;
      return quantize === 'beat' ? beat : quantize === 'phrase' ? this.manifest.loopSeconds : beat * (this.manifest.beatsPerBar || 4);
    }

    // Returns the audio time of the switch.
    setState(stateId, { quantize = this.manifest.transition?.quantize || 'bar', fade = this.fade } = {}) {
      if (!this.voices.has(stateId)) throw new Error('Unknown state: ' + stateId);
      if (stateId === this.current && !this.pending) return this.context.currentTime;
      const now = this.context.currentTime + 0.02, span = this.period(quantize);
      const at = this.startTime + Math.ceil(Math.max(0, now - this.startTime) / span) * span;
      for (const [id, voice] of this.voices) {
        const g = voice.gain.gain, target = id === stateId ? 1 : 0;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.setValueAtTime(g.value, at);
        g.linearRampToValueAtTime(target, at + Math.max(0.005, fade));
      }
      this.pending = { id: stateId, at };
      this.onChange?.(this.current, stateId);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.current = stateId; this.pending = null; this.onChange?.(this.current, null); }, Math.max(0, (at - this.context.currentTime) * 1000));
      return at;
    }

    stop(fade = this.fade) {
      clearTimeout(this.timer);
      const now = this.context?.currentTime ?? 0;
      for (const { source, gain } of this.voices.values()) {
        try { gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(gain.gain.value, now); gain.gain.linearRampToValueAtTime(0, now + fade); source.stop(now + fade + 0.01); } catch (_) {}
      }
      this.voices.clear();
      this.current = null;
      this.pending = null;
    }

    get position() {
      if (!this.voices.size) return 0;
      return ((this.context.currentTime - this.startTime) % this.manifest.loopSeconds + this.manifest.loopSeconds) % this.manifest.loopSeconds;
    }
  }
  // Self-contained source, so Create can ship the runtime inside a game package.
  GMCMusicDirector.source = '(' + gmcDirectorRuntime.toString() + ')(globalThis);\n';
  if (typeof module !== 'undefined' && module.exports) module.exports = GMCMusicDirector;
  else root.GMCMusicDirector = GMCMusicDirector;
})(globalThis);
