/**
 * Notas de Angelo: cartel "↑ Leer" - Ruben: En Busca de Angelo (Claude)
 *
 * Las notas (`room.tablets`) NO se abren solas: al pararse sobre una aparece el cartel
 * "↑ Leer" y SOLO con ARRIBA (W/↑, stick o cruceta) se abre el texto. Alejarse lo cierra
 * (main.js). Al abrirse se asigna game.activeNote = nota, que es lo que usan el Diario
 * (notas leídas) y el desbloqueo de "Jalar el Aire" (wind-pull.js).
 * Usa la burbuja de npcs.js (window.NPCs.drawBubble).
 * Hooks: onBeforeUpdate · onBeforeRoomLoad · onRenderWorld (ver MAPA.md).
 */
(function () {
  'use strict';

  const clock = { t: 0 };

  // ---------------- notas de Angelo: cartel "↑ Leer" ----------------
  // Al pararse sobre una nota aparece el cartel; SOLO con ARRIBA (W/↑, stick o cruceta)
  // se abre el texto (nunca se abre sola ni con Interactuar). Alejarse lo cierra. Al abrirse se asigna
  // game.activeNote = nota, que es lo que usan el Diario (notas leídas) y el desbloqueo
  // de "Jalar el Aire".
  const notes = { near: null, prevUp: false };

  function findNearTablet(g) {
    const room = g.world && g.world.getCurrentRoom();
    if (!room || !room.tablets || g.player.dead) return null;
    const px = g.player.x + g.player.width / 2;
    const py = g.player.y + g.player.height / 2;
    for (const tab of room.tablets) {
      if (Math.abs(px - (tab.x + 11)) < 38 && Math.abs(py - (tab.y + 17)) < 46) return tab;
    }
    return null;
  }

  function readNote(g, tab) {
    if (g.activeNote === tab) {
      // Ya abierta: un toque completa el texto que se está escribiendo
      if (g.dialogTyping && g.finishTyping) g.finishTyping();
      return;
    }
    g.activeNote = tab;
    g.showDialog(tab.speaker, tab.text, true);
  }

  function notesStep(g) {
    notes.near = findNearTablet(g);
    const cm = g.controlsManager;
    const up = !!((cm && cm.isActive && cm.isActive('aimUp', g.keys)) || g.keys.PadUp ||
      (!cm && (g.keys.KeyW || g.keys.ArrowUp)));
    if (up && !notes.prevUp && notes.near && g.deathTimer <= 0) readNote(g, notes.near);
    notes.prevUp = up;
  }

  function notesRender(g, ctx, cam) {
    const tab = notes.near;
    if (!tab || g.activeNote === tab || !g.isPlaying) return;
    window.NPCs.drawBubble(ctx, '↑ Leer', tab.x + 11 - cam.x, tab.y - cam.y - 36 + Math.sin(clock.t * 0.08) * 2);
  }

  function install() {
    const H = window.GameHooks;
    H.onBeforeUpdate.push((game, running) => {
      if (!running) return;
      clock.t++;
      notesStep(game);
    });
    H.onBeforeRoomLoad.push(() => { notes.near = null; });
    H.onRenderWorld.push((game, ctx, cam) => {
      try { notesRender(game, ctx, cam); } catch (e) { console.error('[Notas]', e); }
    });
  }

  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Notas] no se pudo iniciar:', e); }
  });
})();
