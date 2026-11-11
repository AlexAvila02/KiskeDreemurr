/**
 * Kit de sonidos sintetizados (ruido y tonos) - Ruben: En Busca de Angelo (Claude)
 *
 * Piezas compartidas para los efectos que se arman con ruido filtrado o un oscilador
 * (agua, brisa, viento, macetas). Usa el AudioContext de window.soundManager (audio.js) y
 * respeta el silencio del juego. Los ruidos se generan una sola vez (2 s, en caché).
 *
 * API: window.SoundKit
 *   .ctx()                         AudioContext si hay sonido (no silenciado), si no null
 *   .noise(ctx, kind)              buffer de ruido: 'white' (puntas con fundido), 'pink'
 *                                  (suave, para brisa) o 'brown' (grave, para viento)
 *   .loop(kind, { type, freq, Q, lfoFreq, lfoDepth })
 *                                  bucle ruido → filtro → volumen (arranca en 0). Devuelve
 *                                  { setLevel(v, tc), setFreq(hz, tc), stop(tc, after) } o null
 *   .noiseHit(kind, { type, freq, freqTo, sweep, Q, peak, attack, release, stopAt, randomStart })
 *                                  golpe de ruido filtrado con envolvente (salpicadura, ráfaga)
 *   .tone({ type, freq, freqTo, sweep, gain, release, floor, stopAt, delay })
 *                                  tono con barrido de frecuencia y caída (bloop, campana, golpe)
 */
(function () {
  'use strict';

  const buffers = {};

  function ctx() {
    const sm = window.soundManager;
    return sm && sm.ctx && !sm.isMuted ? sm.ctx : null;
  }

  function noise(c, kind) {
    if (buffers[kind]) return buffers[kind];
    const len = c.sampleRate * 2;
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    let fade = 0;
    if (kind === 'pink') {
      // Ruido "rosado" suave: tres filtros de un polo sumados
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
        d[i] = (b0 + b1 + b2) * 0.9;
      }
      fade = 2000;
    } else if (kind === 'brown') {
      // Ruido grave ("marrón"): paseo aleatorio amortiguado
      let last = 0;
      for (let i = 0; i < len; i++) { last = last * 0.96 + (Math.random() * 2 - 1) * 0.04; d[i] = last * 6; }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      fade = 1500;
    }
    // Fundido en las puntas para que el bucle no haga "clic"
    for (let i = 0; i < fade; i++) { const k = i / fade; d[i] *= k; d[len - 1 - i] *= k; }
    buffers[kind] = b;
    return b;
  }

  function loop(kind, opts) {
    const c = ctx();
    if (!c) return null;
    try {
      const src = c.createBufferSource();
      src.buffer = noise(c, kind);
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = opts.type || 'lowpass';
      filter.frequency.value = opts.freq || 500;
      filter.Q.value = opts.Q !== undefined ? opts.Q : 0.7;
      let lfo = null;
      if (opts.lfoFreq) {
        lfo = c.createOscillator();
        lfo.frequency.value = opts.lfoFreq;
        const lfoG = c.createGain();
        lfoG.gain.value = opts.lfoDepth || 0;
        lfo.connect(lfoG); lfoG.connect(filter.frequency);
      }
      const gain = c.createGain();
      gain.gain.value = 0;
      src.connect(filter); filter.connect(gain); gain.connect(c.destination);
      src.start();
      if (lfo) lfo.start();
      return {
        setLevel(v, tc) { gain.gain.setTargetAtTime(v, c.currentTime, tc); },
        setFreq(hz, tc) { filter.frequency.setTargetAtTime(hz, c.currentTime, tc); },
        stop(tc, after) {
          try {
            gain.gain.setTargetAtTime(0, c.currentTime, tc);
            src.stop(c.currentTime + after);
            if (lfo) lfo.stop(c.currentTime + after);
          } catch (e) { /* */ }
        }
      };
    } catch (e) { return null; }
  }

  function noiseHit(kind, o) {
    const c = ctx(); if (!c) return;
    try {
      const now = c.currentTime;
      const src = c.createBufferSource(); src.buffer = noise(c, kind);
      const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.Q !== undefined ? o.Q : 0.7;
      if (o.freqTo) { f.frequency.setValueAtTime(o.freq, now); f.frequency.exponentialRampToValueAtTime(o.freqTo, now + o.sweep); }
      else f.frequency.value = o.freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(o.peak, now + o.attack);
      g.gain.exponentialRampToValueAtTime(0.0008, now + o.release);
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(now, o.randomStart ? Math.random() : 0); src.stop(now + o.stopAt);
    } catch (e) { /* */ }
  }

  function tone(o) {
    const c = ctx(); if (!c) return;
    try {
      const now = c.currentTime + (o.delay || 0);
      const osc = c.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, now);
      if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(o.freqTo, now + o.sweep);
      const g = c.createGain();
      g.gain.setValueAtTime(o.gain, now);
      g.gain.exponentialRampToValueAtTime(o.floor || 0.0008, now + o.release);
      osc.connect(g); g.connect(c.destination);
      osc.start(now); osc.stop(now + o.stopAt);
    } catch (e) { /* */ }
  }

  window.SoundKit = { ctx, noise, loop, noiseHit, tone };
})();
