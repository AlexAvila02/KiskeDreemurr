/**
 * Ambientes de sala: brisa - Ruben: En Busca de Angelo (Claude)
 *
 * Una sala con `ambience: 'breeze'` tiene una brisa leve: corrientes de aire finas y
 * pétalos/briznas que cruzan la pantalla, más un susurro de viento con ráfagas suaves.
 * El sonido sigue en pausa / Diario (es la sala donde está Ruben) y se apaga en el menú.
 *
 * API: window.Ambience.getBreeze() → { level (0..1), gust } (props.js inclina el humo)
 * Hooks: onBeforeUpdate · onRenderWorld (ver MAPA.md). Pools fijos: sin basura por cuadro.
 */
(function () {
  'use strict';

  const OUT = '#3a2416';

  // ---------------- brisa ambiental (room.ambience === 'breeze') ----------------
  // Corrientes de aire finas y pétalos/briznas que cruzan la pantalla de izquierda a
  // derecha, más un susurro de viento con ráfagas suaves. Pools fijos (sin basura).
  const breeze = { level: 0, gust: 0, t: 0 };
  const BREEZE_STREAKS = [];
  for (let i = 0; i < 16; i++) {
    BREEZE_STREAKS.push({ x: Math.random() * 1100, y: 60 + Math.random() * 400, sp: 0.6 + Math.random() * 0.7, len: 26 + Math.random() * 40, ph: Math.random() * 6.28, par: 0.4 + Math.random() * 0.5 });
  }
  const BREEZE_BITS = [];
  for (let i = 0; i < 10; i++) {
    BREEZE_BITS.push({ x: Math.random() * 1100, y: 120 + Math.random() * 340, sp: 0.8 + Math.random() * 0.8, rot: Math.random() * 6.28, c: i % 3, ph: Math.random() * 6.28 });
  }
  const BREEZE_COLS = ['#f2d29b', '#e2705a', '#a5b84d'];
  // Sonido: ruido rosado → lowpass que sigue a la ráfaga (sound-kit.js)
  let bLoop = null;
  function breezeStart() {
    if (bLoop) return;
    bLoop = window.SoundKit.loop('pink', { type: 'lowpass', freq: 500, Q: 0.7 });
  }
  function breezeStop() {
    if (!bLoop) return;
    bLoop.stop(0.25, 1.2);
    bLoop = null;
  }

  // running = juego activo. En pausa / Diario el sonido sigue (con sus ráfagas) porque
  // sigue siendo la sala donde está Ruben; solo se congelan las corrientes y pétalos.
  // Al volver al menú principal (isPlaying = false) se apaga.
  function breezeStep(g, running) {
    if (!g.isPlaying) { breeze.level = 0; breezeStop(); return; }
    const room = g.world && g.world.getCurrentRoom();
    const want = room && room.ambience === 'breeze' && !g.player.dead;
    // Entra y sale con fundido (~1 s)
    breeze.level += ((want ? 1 : 0) - breeze.level) * 0.03;
    if (breeze.level < 0.005 && !want) breeze.level = 0;
    breeze.t++;
    // Ráfagas: suma de senos lentos (nunca se apaga del todo: brisa leve y constante)
    const t = breeze.t;
    breeze.gust = 0.45 + 0.3 * Math.sin(t * 0.011) + 0.15 * Math.sin(t * 0.027 + 1.3) + 0.1 * Math.sin(t * 0.063 + 0.5);
    if (breeze.level > 0.01) breezeStart(); else breezeStop();
    if (bLoop) {
      if (!window.SoundKit.ctx()) { breezeStop(); return; }   // se silenció el juego
      bLoop.setLevel(0.055 * breeze.level * (0.5 + breeze.gust), 0.3);
      bLoop.setFreq(320 + breeze.gust * 520, 0.4);
    }
    if (!running) return; // en pausa: suena, pero no se mueve nada en pantalla
    // Avance de corrientes y briznas (en pantalla, con un poco de paralaje)
    const push = 0.6 + breeze.gust * 1.6;
    for (const s of BREEZE_STREAKS) {
      s.x += s.sp * push;
      if (s.x > 1080) { s.x = -80 - Math.random() * 120; s.y = 60 + Math.random() * 400; }
    }
    for (const b of BREEZE_BITS) {
      b.x += b.sp * push * 1.2;
      b.y += Math.sin(t * 0.03 + b.ph) * 0.35;
      b.rot += 0.04 + breeze.gust * 0.06;
      if (b.x > 1080) { b.x = -40 - Math.random() * 200; b.y = 120 + Math.random() * 340; }
    }
  }

  function breezeRender(g, ctx, cam) {
    const lv = breeze.level;
    if (lv <= 0.01) return;
    const t = breeze.t;
    ctx.save();
    ctx.lineCap = 'round';
    // Corrientes: trazos finos y ondulados, casi transparentes
    ctx.strokeStyle = '#fff6e4';
    for (const s of BREEZE_STREAKS) {
      const x = s.x;                                // corren en coordenadas de pantalla
      const y = s.y + Math.sin(t * 0.02 + s.ph) * 6;
      const a = lv * (0.17 + breeze.gust * 0.22) * Math.sin(Math.min(1, Math.max(0, (x + 80) / 1160)) * Math.PI);
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      ctx.lineWidth = 1.2 + s.par;
      const L = s.len * (0.7 + breeze.gust * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + L * 0.3, y - 4, x + L * 0.6, y + 4, x + L, y - 1);
      ctx.stroke();
    }
    // Briznas y pétalos que vuelan
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 0.8;
    for (const b of BREEZE_BITS) {
      ctx.globalAlpha = lv * 0.85;
      ctx.fillStyle = BREEZE_COLS[b.c];
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 3.2, 1.5, b.rot, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function install() {
    const H = window.GameHooks;
    H.onBeforeUpdate.push((game, running) => breezeStep(game, running));   // sigue sonando en pausa
    // La brisa va por delante de todo (aire entre la cámara y la escena)
    H.onRenderWorld.push((game, ctx, cam) => {
      try { breezeRender(game, ctx, cam); } catch (e) { console.error('[Brisa]', e); }
    });
  }

  window.Ambience = { getBreeze: () => breeze };
  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Brisa] no se pudo iniciar:', e); }
  });
})();
