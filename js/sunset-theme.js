/**
 * Tema del Atardecer (Claude) — melodía original para las praderas.
 *
 * Vals lento en Sol mayor (3/4, ~80 bpm, 16 compases ≈ 36 s). Suena dos
 * vueltas cuando Ruben está en una sala de bioma 'pradera', descansa un rato
 * y vuelve a empezar. Se apaga con un fundido al salir de las praderas, al
 * entrar a la Laguna o al ocultar la pestaña.
 *
 * Es una composición propia, sintetizada con Web Audio: no usa archivos ni
 * melodías de otros juegos. Usa el AudioContext de window.soundManager y no
 * modifica js/audio.js (zona de Gemini); los arpegios sueltos de la pradera
 * siguen sonando debajo y comparten la tonalidad.
 *
 * API de prueba: window.SunsetTheme.start() / .stop() / .isPlaying()
 */
(function () {
  'use strict';

  const BEAT = 0.75;            // segundos por tiempo (80 bpm)
  const BAR = BEAT * 3;         // compás de 3/4
  const PASSES = 2;             // vueltas seguidas antes de descansar
  const REST_SEC = 40;          // silencio entre tandas
  const FADE_OUT = 2.5;
  const MASTER_LEVEL = 0.9;

  // Acordes por compás: [bajo, notas del arpegio] en MIDI.
  // G  Em  C  D | Bm  Em  Am  D | G  B7  Em  C | Am  D  G/D  G
  const CHORDS = [
    [43, [55, 59, 62]], [40, [55, 59, 64]], [48, [55, 60, 64]], [50, [54, 57, 62]],
    [47, [54, 59, 62]], [40, [55, 59, 64]], [45, [57, 60, 64]], [50, [54, 57, 62]],
    [43, [55, 59, 62]], [47, [54, 59, 63]], [40, [55, 59, 64]], [48, [55, 60, 64]],
    [45, [57, 60, 64]], [50, [54, 57, 60]], [38, [55, 59, 62]], [43, [55, 59, 62]]
  ];

  // Melodía: por compás, pares [nota MIDI, duración en tiempos].
  const MELODY = [
    [[74, 2], [71, 1]],
    [[67, 1], [69, 1], [71, 1]],
    [[72, 2], [76, 1]],
    [[74, 3]],
    [[74, 2], [71, 1]],
    [[76, 1], [74, 1], [71, 1]],
    [[72, 1], [71, 1], [69, 1]],
    [[69, 3]],
    [[74, 2], [79, 1]],
    [[78, 2], [75, 1]],
    [[76, 2], [71, 1]],
    [[72, 1], [76, 1], [79, 1]],
    [[76, 2], [72, 1]],
    [[74, 1], [72, 1], [69, 1]],
    [[71, 2], [69, 1]],
    [[67, 3]]
  ];

  const LOOP_SEC = CHORDS.length * BAR;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let gain = null;          // ganancia de la tanda que suena ahora
  let playing = false;
  let nextTimer = null;     // fin de la tanda → descanso → otra tanda
  let wantBiome = false;    // Ruben está en las praderas
  let checkClock = 0;

  function ctxOk() {
    const sm = window.soundManager;
    return sm && sm.ctx && sm.initialized && !sm.isMuted ? sm.ctx : null;
  }

  // ── Voces ──────────────────────────────────────────────────────────────
  function lead(ctx, out, t, midi, dur, level, octaveUp) {
    const f = hz(midi) * (octaveUp ? 2 : 1);
    const len = dur * BEAT;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = octaveUp ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(f, t);

    // vibrato suave que entra tarde en las notas largas, como una flauta
    if (len > BEAT * 1.5) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.setValueAtTime(5.2, t);
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(f * 0.006, t + len * 0.6);
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + len + 0.6);
    }

    g.gain.setValueAtTime(0.00001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.07);
    g.gain.exponentialRampToValueAtTime(level * 0.55, t + Math.min(len, 0.9));
    g.gain.setValueAtTime(level * 0.55, t + len * 0.92);
    g.gain.exponentialRampToValueAtTime(0.00001, t + len + 0.5);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + len + 0.55);
  }

  function pluck(ctx, out, t, midi, level, decay) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz(midi), t);
    g.gain.setValueAtTime(0.00001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.00001, t + decay);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  function scheduleLoop(ctx, out, t0, pass) {
    for (let b = 0; b < CHORDS.length; b++) {
      const tb = t0 + b * BAR;
      const bass = CHORDS[b][0];
      const arp = CHORDS[b][1];
      pluck(ctx, out, tb, bass, 0.055, BAR * 0.95);                 // bajo en el 1
      pluck(ctx, out, tb + BEAT, arp[1], 0.02, 1.2);                // "um-pa-pa"
      pluck(ctx, out, tb + BEAT, arp[2], 0.016, 1.2);
      pluck(ctx, out, tb + BEAT * 2, arp[0], 0.018, 1.2);
      pluck(ctx, out, tb + BEAT * 2, arp[2], 0.014, 1.2);

      let beat = 0;
      const notes = MELODY[b];
      for (let n = 0; n < notes.length; n++) {
        const tn = tb + beat * BEAT;
        lead(ctx, out, tn, notes[n][0], notes[n][1], 0.042, false);
        // segunda vuelta: un brillo de campanita una octava arriba
        if (pass === 1) lead(ctx, out, tn, notes[n][0], notes[n][1], 0.012, true);
        beat += notes[n][1];
      }
    }
  }

  // ── Control ────────────────────────────────────────────────────────────
  function start() {
    const ctx = ctxOk();
    if (!ctx || playing) return false;
    playing = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, ctx.currentTime);
    gain = ctx.createGain();
    const t0 = ctx.currentTime + 0.15;
    gain.gain.setValueAtTime(0.00001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(MASTER_LEVEL, t0 + 1.2);
    filter.connect(gain);
    gain.connect(ctx.destination);

    for (let p = 0; p < PASSES; p++) scheduleLoop(ctx, filter, t0 + p * LOOP_SEC, p);

    const myGain = gain;
    clearTimeout(nextTimer);
    nextTimer = setTimeout(() => {
      // terminó la tanda: soltar los nodos y descansar antes de la próxima
      if (gain === myGain) { try { myGain.disconnect(); } catch (_) {} gain = null; playing = false; }
      nextTimer = setTimeout(() => { nextTimer = null; if (wantBiome) start(); }, REST_SEC * 1000);
    }, (PASSES * LOOP_SEC + 1.5) * 1000);
    return true;
  }

  function stop() {
    clearTimeout(nextTimer);
    nextTimer = null;
    playing = false;
    const old = gain;
    gain = null;
    const ctx = window.soundManager && window.soundManager.ctx;
    if (!old || !ctx) return;
    const now = ctx.currentTime;
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(Math.max(0.00001, old.gain.value), now);
    old.gain.linearRampToValueAtTime(0.00001, now + FADE_OUT);
    setTimeout(() => { try { old.disconnect(); } catch (_) {} }, (FADE_OUT + 0.2) * 1000);
  }

  function inPradera(game) {
    const w = game && game.world;
    const room = w && typeof w.getCurrentRoom === 'function' ? w.getCurrentRoom() : null;
    const sm = window.soundManager;
    return !!(room && room.biome === 'pradera' && !(sm && sm.isLagunaActive));
  }

  window.SunsetTheme = { start, stop, isPlaying: () => playing };

  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });

  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    const H = window.GameHooks;
    H.onRoomLoad.push((g) => {
      wantBiome = inPradera(g);
      if (!wantBiome && (playing || nextTimer)) stop();
    });
    // Medio segundo de chequeo: arranca cuando el audio ya está desbloqueado
    // (primer toque/tecla) y el juego corre; no espera al cambio de sala.
    H.onAfterUpdate.push((g, running) => {
      if (++checkClock < 30) return;
      checkClock = 0;
      wantBiome = inPradera(g);
      if (!wantBiome) { if (playing || nextTimer) stop(); return; }
      if (running && !playing && !nextTimer && !document.hidden) start();
    });
    H.onRestartGame.push(() => stop());
  });
})();
