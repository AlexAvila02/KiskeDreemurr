/**
 * Recuerdos de Ruben - Ruben: En Busca de Angelo (Claude)
 *
 * Lore (docs/LORE.md → "Elementos, recuerdos y maestros"): Ruben perdió la memoria. Cada vez
 * que aprende un elemento (por una carta de Angelo o con un maestro) recupera un pedazo de
 * su pasado, y es ese recuerdo el que le devuelve el poder.
 *
 * Cuando un poder pasa a estar aprendido y su recuerdo todavía no se vio, se espera a que se
 * cierre el texto abierto (la carta, el maestro) y se muestra el recuerdo: viñeta sepia en la
 * pantalla y dos o tres líneas en el cuadro de diálogo, que avanzan solas. NO bloquea el
 * juego (Ruben se sigue moviendo, igual que en la escena de las macetas).
 *
 * Para sumar un elemento nuevo: una entrada en MEMORIES con `learned()` y `lines`.
 * Guardado: localStorage 'ruben_recuerdos_v1' (ids ya vistos). "Reiniciar juego" lo borra.
 *
 * API: window.Memories.seen(id) · .isPlaying() · .replay(id)
 * Hooks: onBeforeUpdate · onKeepDialog · onRestartGame · onRenderWorld (ver MAPA.md).
 */
(function () {
  'use strict';

  const SAVE_KEY = 'ruben_recuerdos_v1';
  const CHECK_EVERY = 30;      // cada cuántos cuadros se mira si hay un poder recién aprendido
  const LINE_FRAMES = 330;     // lo que queda cada línea en pantalla una vez escrita (5,5 s)

  const MEMORIES = [
    {
      id: 'wind',
      title: 'Recuerdo del Viento',
      learned: () => !!(window.WindPull && window.WindPull.isUnlocked && window.WindPull.isUnlocked()),
      lines: [
        'El papel azul tiembla entre los dedos de Ruben... y algo vuelve. Un patio del castillo, una tarde sin nubes. Angelo, más joven, agita la mano frente a su cara.',
        '«¿Lo sentís? Ya lo estás moviendo. El aire nos rodea a todos, Ruben: por eso es el primero que se aprende. Ahora no lo empujes... llamalo.»',
        'Ruben recuerda cómo se llama al viento. Todavía le faltan pedazos: ¿por qué había olvidado todo esto?'
      ]
    },
    {
      id: 'water',
      title: 'Recuerdo del Agua',
      learned: () => !!(window.WaterControl && window.WaterControl.isLearned && window.WaterControl.isLearned()),
      lines: [
        'El agua sube a su mano y, con ella, otro recuerdo. La orilla de un río. Angelo lo salpica y se ríe; Ruben, muy chico, tiene miedo de mojarse.',
        '«Dicen los sabios que la vida vino del agua, hermanito. No se la empuja: se la invita. Algún día vas a tener que acordarte de esto... por si yo no estoy.»',
        'Ruben recuerda cómo se invita al agua. ¿Angelo ya sabía que iba a irse?'
      ]
    }
  ];

  const cs = { __memory: true };   // marcador de g.activeNote mientras se muestra un recuerdo
  const st = { cur: null, line: 0, t: 0, fade: 0, checkT: 0, grad: null, gradW: 0, gradH: 0 };
  let seen = {};
  try { seen = JSON.parse(window.localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { seen = {}; }

  function persist() {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(seen)); } catch (e) { /* sin guardado */ }
  }

  function showLine(g) {
    g.activeNote = cs;
    g.showDialog('✦ ' + st.cur.title, st.cur.lines[st.line], true);
    if (g.dialogText) g.dialogText.style.fontStyle = 'italic';
    st.t = 0;
  }

  function chime() {
    const sk = window.SoundKit;
    if (!sk || !sk.tone) return;
    try {
      sk.tone({ freq: 523, freqTo: 784, sweep: 0.5, gain: 0.07, release: 0.9, stopAt: 1 });
      sk.tone({ freq: 784, freqTo: 1046, sweep: 0.7, gain: 0.04, release: 1.2, stopAt: 1.3 });
    } catch (e) { /* */ }
  }

  function start(g, m) {
    st.cur = m;
    st.line = 0;
    seen[m.id] = true;
    persist();
    chime();
    showLine(g);
  }

  function finish(g) {
    if (g.activeNote === cs) { g.activeNote = null; g.hideDialog(); }
    if (g.dialogText) g.dialogText.style.fontStyle = '';
    st.cur = null;
  }

  function step(g) {
    // La viñeta entra y sale suave
    st.fade += ((st.cur ? 1 : 0) - st.fade) * 0.05;
    if (st.fade < 0.005) st.fade = 0;

    if (!st.cur) {
      if (--st.checkT > 0) return;
      st.checkT = CHECK_EVERY;
      // Espera a que no haya otro texto abierto (la carta o el maestro que lo enseñó)
      if (g.activeNote || !g.player || g.player.dead || !g.isPlaying) return;
      for (const m of MEMORIES) {
        if (!seen[m.id] && m.learned()) { start(g, m); return; }
      }
      return;
    }

    if (g.activeNote !== cs) {
      // Otro texto tomó el cuadro (una nota, un NPC): se espera. Si quedó vacío
      // (cambio de sala), la línea vuelve a mostrarse.
      if (g.dialogText) g.dialogText.style.fontStyle = '';
      if (!g.activeNote && !g.player.dead) showLine(g);
      return;
    }
    if (g.dialogTyping) return;
    if (++st.t < LINE_FRAMES) return;
    st.line++;
    if (st.line >= st.cur.lines.length) finish(g);
    else showLine(g);
  }

  // Viñeta sepia sobre toda la pantalla (el degradado se arma una sola vez por tamaño)
  function render(ctx) {
    if (st.fade <= 0) return;
    const w = ctx.canvas.width, h = ctx.canvas.height;
    if (!st.grad || st.gradW !== w || st.gradH !== h) {
      st.gradW = w; st.gradH = h;
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(255, 236, 190, 0.05)');
      g.addColorStop(0.6, 'rgba(214, 160, 90, 0.3)');
      g.addColorStop(1, 'rgba(92, 54, 26, 0.72)');
      st.grad = g;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = st.fade;
    ctx.fillStyle = st.grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  window.Memories = {
    seen: (id) => !!seen[id],
    isPlaying: () => !!st.cur,
    // Volver a ver un recuerdo (se mostrará cuando no haya otro texto abierto)
    replay: (id) => { delete seen[id]; st.checkT = 0; }
  };

  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push(() => {
    try {
      const H = window.GameHooks;
      H.onBeforeUpdate.push((g, running) => {
        if (!running) return;
        try { step(g); } catch (e) { console.error('[Recuerdos]', e); }
      });
      H.onKeepDialog.push((g) => g.activeNote === cs);
      H.onRestartGame.push((g) => {
        seen = {};
        try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ }
        if (st.cur) finish(g);
        st.fade = 0;
      });
      H.onRenderWorld.push((g, ctx) => {
        try { render(ctx); } catch (e) { console.error('[Recuerdos]', e); }
      });
    } catch (e) { console.error('[Recuerdos] no se pudo iniciar:', e); }
  });
})();
