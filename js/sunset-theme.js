/**
 * Tema del Atardecer (Claude) — melodía original para las praderas.
 *
 * Shuffle animado estilo años 50 en Sol mayor (4/4 con corcheas swing,
 * 116 bpm). Forma: intro de 2 compases + A A' B A' (32 compases, ≈ 70 s).
 * La A usa la progresión "doo-wop" (Sol – Mi m – Do – Re) con un estribillo
 * que se repite; la B sube a Do – Sol – La7 – Re7 y vuelve al estribillo.
 * Instrumentos: melodía + segunda voz en armonía (siempre una nota del
 * acorde por debajo), bajo saltarín con nota de paso, acordes a contratiempo
 * y batería con escobillas (bombo, caja y platillo con swing).
 *
 * Suena cuando Ruben está en una sala de bioma 'pradera', descansa un rato y
 * vuelve a empezar. Se apaga con un fundido al salir de las praderas, al
 * entrar a la Laguna o al ocultar la pestaña.
 *
 * Composición propia, sintetizada con Web Audio: no usa archivos ni
 * melodías de otros juegos. Usa el AudioContext de window.soundManager y no
 * modifica js/audio.js (zona de Gemini).
 *
 * API de prueba: window.SunsetTheme.start() / .stop() / .isPlaying()
 */
(function () {
  'use strict';

  const BEAT = 60 / 116;        // segundos por negra
  const BAR = BEAT * 4;
  const SWING = 2 / 3;          // la corchea de contratiempo cae en el tercio del tresillo
  const REST_SEC = 30;          // silencio entre tandas
  const FADE_OUT = 2.5;
  const MASTER_LEVEL = 0.9;

  // Acordes: bajo (MIDI) + clases de altura (0 = Do).
  const CH = {
    G:  { root: 43, pcs: [7, 11, 2] },
    Em: { root: 40, pcs: [4, 7, 11] },
    C:  { root: 48, pcs: [0, 4, 7] },
    D:  { root: 50, pcs: [2, 6, 9] },
    A7: { root: 45, pcs: [9, 1, 4, 7] },
    D7: { root: 50, pcs: [2, 6, 9, 0] }
  };

  // Melodía: por compás, pares [nota MIDI | null = silencio, corcheas]. Suman 8.
  const HOOK_1_7 = [
    ['G',  [[71, 1], [74, 1], [79, 3], [78, 1], [79, 2]]],
    ['Em', [[76, 1], [74, 1], [71, 2], [67, 4]]],
    ['C',  [[72, 1], [76, 1], [79, 3], [76, 1], [79, 2]]],
    ['D',  [[78, 2], [76, 2], [74, 4]]],
    ['G',  [[71, 1], [74, 1], [79, 3], [78, 1], [79, 2]]],
    ['Em', [[76, 1], [74, 1], [71, 2], [67, 2], [69, 2]]],
    ['C',  [[72, 2], [71, 2], [69, 2], [67, 2]]]
  ];
  const A1 = HOOK_1_7.concat([['D', [[69, 2], [66, 2], [62, 2], [null, 2]]]]);
  const A2 = HOOK_1_7.concat([['G', [[71, 2], [67, 4], [null, 2]]]]);
  const B = [
    ['C',  [[76, 2], [76, 1], [76, 1], [79, 2], [76, 2]]],
    ['C',  [[72, 4], [null, 2], [72, 1], [74, 1]]],
    ['G',  [[74, 2], [74, 1], [74, 1], [79, 2], [74, 2]]],
    ['G',  [[71, 4], [null, 2], [71, 1], [73, 1]]],
    ['A7', [[76, 2], [73, 1], [76, 1], [79, 2], [76, 2]]],
    ['A7', [[73, 2], [69, 2], [null, 2], [69, 1], [72, 1]]],
    ['D7', [[74, 2], [78, 2], [81, 3], [78, 1]]],
    ['D7', [[74, 2], [72, 2], [69, 2], [66, 2]]]
  ];
  const INTRO = [['G', [[null, 8]]], ['D7', [[null, 6], [71, 1], [74, 1]]]];
  const SONG = INTRO.concat(A1, A2, B, A2);
  const SONG_SEC = SONG.length * BAR;

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // instante (en tiempos) de la corchea i dentro del compás, con swing
  const eighthAt = (i) => Math.floor(i / 2) + (i % 2 ? SWING : 0);

  // nota del acorde más aguda que quede al menos una tercera menor por debajo
  function harmonyBelow(midi, pcs) {
    for (let m = midi - 3; m > midi - 12; m--) {
      if (pcs.indexOf(((m % 12) + 12) % 12) !== -1) return m;
    }
    return midi - 5;
  }

  let gain = null;          // ganancia de la tanda que suena ahora
  let playing = false;
  let nextTimer = null;     // fin de la tanda → descanso → otra tanda
  let wantBiome = false;    // Ruben está en las praderas
  let checkClock = 0;

  function ctxOk() {
    const sm = window.soundManager;
    return sm && sm.ctx && sm.initialized && !sm.isMuted ? sm.ctx : null;
  }

  function makeNoise(ctx) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── Instrumentos ───────────────────────────────────────────────────────
  function tone(ctx, out, t, midi, len, type, level, attack, release) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz(midi), t);
    g.gain.setValueAtTime(0.00001, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.setValueAtTime(level * 0.8, t + Math.max(attack, len * 0.85));
    g.gain.exponentialRampToValueAtTime(0.00001, t + len + release);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + len + release + 0.05);
  }

  function kick(ctx, out, t, level) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.00001, t + 0.22);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  function noiseHit(ctx, out, noise, t, filterType, freq, level, decay) {
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t);
    // arrancar en silencio: con la ganancia por defecto (1) el primer cuadro
    // del ruido salía entero y hacía un chasquido
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.00001, t + decay);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random() * 0.3);
    src.stop(t + decay + 0.02);
  }

  function scheduleSong(ctx, mel, band, drums, t0) {
    const noise = makeNoise(ctx);
    for (let b = 0; b < SONG.length; b++) {
      const tb = t0 + b * BAR;
      const chord = CH[SONG[b][0]];
      const nextChord = CH[(SONG[b + 1] || SONG[0])[0]];
      const isIntro = b < INTRO.length;

      // batería: bombo en 1 y 3, caja de escobilla en 2 y 4, platillo con swing
      for (let beat = 0; beat < 4; beat++) {
        const tq = tb + beat * BEAT;
        if (beat % 2 === 0) kick(ctx, drums, tq, 0.09);
        else noiseHit(ctx, drums, noise, tq, 'bandpass', 2200, 0.05, 0.16);
        noiseHit(ctx, drums, noise, tq, 'highpass', 7500, 0.016, 0.05);
        noiseHit(ctx, drums, noise, tq + SWING * BEAT, 'highpass', 7500, 0.026, 0.07);
      }

      // bajo saltarín: tónica en 1, quinta en 3, nota de paso al acorde siguiente
      tone(ctx, band, tb, chord.root, BEAT * 0.8, 'triangle', 0.11, 0.01, 0.08);
      tone(ctx, band, tb + 2 * BEAT, chord.root + 7, BEAT * 0.8, 'triangle', 0.1, 0.01, 0.08);
      tone(ctx, band, tb + 3 * BEAT, chord.root + 5, BEAT * 0.4, 'triangle', 0.08, 0.01, 0.05);
      tone(ctx, band, tb + (3 + SWING) * BEAT, nextChord.root - 1, BEAT * 0.3, 'triangle', 0.08, 0.01, 0.05);

      // acordes a contratiempo ("chuck") en 2 y 4, voces entre Sol3 y Sol4
      for (let beat = 1; beat < 4; beat += 2) {
        const tq = tb + beat * BEAT;
        for (let k = 0; k < 3; k++) {
          const pc = chord.pcs[k + (chord.pcs.length > 3 && k === 2 ? 1 : 0)];
          let m = 55 + ((pc - 7 + 12) % 12);
          tone(ctx, band, tq, m, BEAT * 0.22, 'square', 0.012, 0.005, 0.12);
        }
      }

      // melodía + segunda voz
      let i = 0;
      const notes = SONG[b][1];
      for (let n = 0; n < notes.length; n++) {
        const midi = notes[n][0];
        const len8 = notes[n][1];
        const ts = tb + eighthAt(i) * BEAT;
        const te = tb + eighthAt(i + len8) * BEAT;
        i += len8;
        if (midi === null) continue;
        const len = Math.max(0.08, (te - ts) * 0.88);
        tone(ctx, mel, ts, midi, len, 'square', 0.022, 0.012, 0.12);
        tone(ctx, mel, ts, midi + 12, len, 'sine', 0.008, 0.01, 0.2);          // brillo
        if (!isIntro) tone(ctx, mel, ts, harmonyBelow(midi, chord.pcs), len, 'triangle', 0.03, 0.015, 0.12);
      }
    }
  }

  // ── Control ────────────────────────────────────────────────────────────
  function start() {
    const ctx = ctxOk();
    if (!ctx || playing) return false;
    playing = true;

    const now = ctx.currentTime;
    gain = ctx.createGain();
    gain.gain.setValueAtTime(0.00001, now);
    gain.gain.linearRampToValueAtTime(MASTER_LEVEL, now + 0.8);
    gain.connect(ctx.destination);

    const mel = ctx.createBiquadFilter();       // melodía cálida, tipo clarinete
    mel.type = 'lowpass';
    mel.frequency.setValueAtTime(2400, now);
    mel.connect(gain);
    const band = ctx.createBiquadFilter();      // bajo y acordes
    band.type = 'lowpass';
    band.frequency.setValueAtTime(1600, now);
    band.connect(gain);
    const drums = ctx.createGain();
    drums.gain.setValueAtTime(1, now);
    drums.connect(gain);

    scheduleSong(ctx, mel, band, drums, now + 0.15);

    const myGain = gain;
    clearTimeout(nextTimer);
    nextTimer = setTimeout(() => {
      // terminó la tanda: soltar los nodos y descansar antes de la próxima
      if (gain === myGain) { try { myGain.disconnect(); } catch (_) {} gain = null; playing = false; }
      nextTimer = setTimeout(() => { nextTimer = null; if (wantBiome) start(); }, REST_SEC * 1000);
    }, (SONG_SEC + 1.5) * 1000);
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
