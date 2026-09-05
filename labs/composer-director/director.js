/* Original, deliberately small musical sketch engine. Not the Neo-SPC renderer.
 * Browser global + CommonJS export keep the lab offline and dependency-free. */
(function (root) {
  'use strict';
  const THEMES = {
    pilgrim: { name: 'El peregrino', premise: 'Una llamada que sigue siendo reconocible al volver herida.',
      scale: [0, 2, 3, 5, 7, 9, 10], degrees: [0, 4, 3, 1, 2], starts: [0, 1, 2.5, 4, 5.5],
      lengths: [.7, 1.1, 1, .8, 1.5], progression: [0, 5, 3, 4], wave: 'triangle' },
    machine: { name: 'La máquina', premise: 'Un gesto corto, asimétrico y obstinado, no una melodía larga.',
      scale: [0, 1, 3, 5, 7, 8, 10], degrees: [0, 1, 0, 4, 2, 1], starts: [0, .5, 1.5, 3, 4.5, 6],
      lengths: [.3, .3, .6, .5, .7, .8], progression: [0, 1, 0, 6], wave: 'square' },
    lantern: { name: 'La linterna', premise: 'Un salto luminoso y una respuesta con espacio para respirar.',
      scale: [0, 2, 4, 6, 7, 9, 11], degrees: [0, 4, 5, 2, 1], starts: [.5, 2, 3.5, 5, 6.5],
      lengths: [1, .8, .9, 1, .9], progression: [0, 3, 1, 4], wave: 'sine' }
  };
  const STATES = {
    explore: 'Exploración', danger: 'Peligro', battle: 'Combate', grief: 'Duelo'
  };
  const ROLES = ['lead', 'bass', 'harmony', 'pulse'];
  const clone = value => JSON.parse(JSON.stringify(value));
  function validate(options) {
    if (!options || !Object.hasOwn(THEMES, options.theme) || !Object.hasOwn(STATES, options.state))
      throw new Error('Tema o estado desconocido');
    if (!Number.isInteger(options.answerSeed) || options.answerSeed < 0 || options.answerSeed > 2147483647)
      throw new Error('La semilla B debe ser un entero entre 0 y 2147483647');
  }
  function pitch(scale, degree, rootMidi = 62) {
    const octave = Math.floor(degree / scale.length);
    return rootMidi + 12 * octave + scale[((degree % scale.length) + scale.length) % scale.length];
  }
  function nearestVoicing(scale, degree, previous) {
    const pcs = [0, 2, 4].map(x => pitch(scale, degree + x) % 12);
    const pool = Array.from({ length: 25 }, (_, i) => i + 48).filter(n => pcs.includes(n % 12));
    let best = null, cost = Infinity;
    for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++)
      for (let c = b + 1; c < pool.length; c++) {
        const chord = [pool[a], pool[b], pool[c]];
        if (new Set(chord.map(n => n % 12)).size !== 3) continue;
        const movement = chord.reduce((sum, n, i) => sum + Math.abs(n - previous[i]), 0);
        if (movement < cost) { cost = movement; best = chord; }
      }
    if (!best) throw new Error('No se encontró una disposición válida');
    return best;
  }
  function compose(options) {
    validate(options);
    const { theme, state, answerSeed } = options, t = THEMES[theme];
    const events = [], scale = t.scale.slice();
    if (state === 'grief') { scale[2] = 3; scale[5] = 8; scale[6] = 10; }
    if (state === 'danger') scale[1] = 1;
    const add = (role, beat, duration, midi, amplitude, section) => {
      if (beat >= 32) return;
      events.push({ role, beat, duration: Math.min(duration, 32 - beat), midi, amplitude, section });
    };
    // Four two-bar functions. Statement and return never depend on answerSeed.
    for (let section = 0; section < 4; section++) {
      const offset = section * 8, answer = section === 2;
      const indices = answer ? [2, 3, 1, 0] : t.degrees.map((_, i) => i);
      indices.forEach((index, j) => {
        let degree = t.degrees[index], start = answer ? [0, 1.5, 3.5, 6][j] : t.starts[j];
        let length = answer ? [1, 1, 1.5, 1.1][j] : t.lengths[j];
        // Five bounded answer shapes; not a promise of limitless unique music.
        if (answer && j < 3) degree += ((answerSeed + j) % 5) - 2;
        if (answer && j === 3) degree = 0;
        if (section === 1 && j === indices.length - 1) degree = 4;
        if (state === 'grief') { start *= 1.25; length *= 1.6; }
        if (start + length > 7.8) length = Math.max(.15, 7.8 - start);
        if (start >= 7.8) return;
        add('lead', offset + start, length, pitch(scale, degree, state === 'grief' ? 50 : 62),
          state === 'battle' ? .15 : .13, ['A', 'A-prime', 'B', 'A-return'][section]);
      });
    }
    let previous = [50, 57, 62];
    for (let bar = 0; bar < 8; bar++) {
      const degree = state === 'danger' ? 0 : t.progression[Math.floor(bar / 2)];
      const bass = pitch(scale, degree, 38), offset = bar * 4;
      const chord = nearestVoicing(scale, degree, previous); previous = chord;
      if (state === 'battle') {
        for (let i = 0; i < 8; i++) add('bass', offset + i * .5, .32, bass + (i % 4 === 3 ? 12 : 0), .11, 'foundation');
      } else {
        add('bass', offset, state === 'grief' ? 3.7 : 1.7, bass, .1, 'foundation');
        if (state !== 'grief') add('bass', offset + 2.5, .9, bass, .08, 'foundation');
      }
      chord.forEach((note, i) => add('harmony', offset + i * .02, state === 'battle' ? 1.3 : 3.65, note, .027, 'harmony'));
      if (state !== 'grief') {
        const hits = state === 'battle' ? [0, 1, 1.5, 2, 3, 3.5] : state === 'danger' ? [0, 1.5, 3] : [0];
        hits.forEach((hit, i) => add('pulse', offset + hit, .09, i % 2 ? 76 : 38, .035, 'pulse'));
      }
    }
    events.sort((a, b) => a.beat - b.beat || a.role.localeCompare(b.role) || a.midi - b.midi);
    return { schema_version: 1, backend: 'director-sketch-oscillators-v1', production_ready: false,
      theme, state, answerSeed, meter: '4/4', beats: 32, bars: 8,
      motif: { degrees: t.degrees.slice(), onsets: t.starts.slice(), scope: 'identity in scale degrees, not exact pitch under modal changes' },
      events, limitations: ['Original synthetic sketches, not Neo-SPC audio', 'No loudness-matched blind comparison',
        'Fixed 4/4 and eight bars', 'Five B variants', 'No game-engine, Factory Bank, stem or MIDI export'] };
  }
  function reduction(score) {
    return { ...clone(score), events: score.events.filter(e => e.role === 'lead' || e.role === 'bass').map(clone) };
  }
  function sectionSignature(score, section) {
    return JSON.stringify(score.events.filter(e => e.section === section));
  }
  function session(options) {
    validate(options);
    if (!Number.isFinite(options.bpm) || options.bpm < 60 || options.bpm > 160) throw new Error('Tempo inválido');
    return { schema_version: 1, kind: 'composer-director-session', backend: 'director-sketch-oscillators-v1',
      production_ready: false, options: { theme: options.theme, state: options.state, answerSeed: options.answerSeed, bpm: options.bpm },
      locks: { statement_A: true, return_A: true }, allowed_revision: ['section_B.lead'],
      audit: { human_listening: 'pending', engine_integration: 'not_implemented' },
      handoff: 'Usar como intención y boceto, no como catálogo Neo-SPC. Conservar motivo A y retorno; revisar únicamente B. Verificar reducción, registro, voz, seam y renderer antes de aprobar.',
      score: compose(options) };
  }
  const api = { THEMES, STATES, ROLES, pitch, nearestVoicing, compose, reduction, sectionSignature, session };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ComposerDirector = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
