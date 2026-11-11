/**
 * Energía elemental (barra azul) - Ruben: En Busca de Angelo (Claude)
 *
 * Los poderes elementales (Jalar/Soplar el Aire, Dominio del Agua) comparten una sola barra:
 *   - Llena = 1 minuto de uso a fondo (3600 cuadros a 60 por segundo).
 *   - Mientras un poder está activo la barra se vacía al ritmo de uso.
 *   - Al soltar todos los poderes la barra se vuelve a llenar, al mismo ritmo: lo que se usó
 *     es lo que tarda en volver.
 *   - Mientras un poder está activo la barra no se llena.
 *   - Sin energía no se puede activar ningún poder, y el que está activo se suelta. Al agotarse
 *     la barra queda bloqueada hasta llenarse un 20 % (así no parpadea ni suelta a los insectos).
 *   - Se muestra (debajo de los corazones) desde que se aprende el primer poder.
 *
 * Integración (sin editar main.js): envuelve game.update. Corre después del update del juego
 * y antes de los postUpdate de wind-pull.js / water.js. Los poderes consultan
 * window.Stamina.canUse() en su condición de activación. Sin basura por cuadro.
 *
 * API: window.Stamina.canUse() · .getRatio() · .refill()
 */
(function () {
  'use strict';

  const MAX = 60 * 60;     // cuadros de uso a fondo (1 minuto a 60 cuadros por segundo)
  const UNLOCK_AT = 0.2;   // tras agotarse, los poderes vuelven cuando la barra llega a este nivel
  const CHECK_EVERY = 30;  // cada cuántos cuadros se revisa si ya hay poderes aprendidos

  let value = MAX;
  let locked = false;      // agotada: no se puede reactivar hasta llenarla un poco (evita parpadeos)
  let shown = false;
  let checkT = 0;
  let lastPermille = -1;
  let bar = null;
  let fill = null;

  function powerInUse() {
    const wp = window.WindPull;
    if (wp && wp.isActive && wp.isActive()) return true;
    const wc = window.WaterControl;
    if (wc && wc.isHolding && wc.isHolding()) return true;
    return false;
  }

  function anyPowerLearned() {
    const wp = window.WindPull;
    const wc = window.WaterControl;
    return !!((wp && wp.isUnlocked && wp.isUnlocked()) || (wc && wc.isLearned && wc.isLearned()));
  }

  function buildBar() {
    const health = document.getElementById('health-bar');
    const hud = document.querySelector('.hud-top-left');
    if (!health && !hud) return;
    bar = document.createElement('div');
    bar.id = 'stamina-bar';
    bar.className = 'stamina-bar';
    bar.title = 'Energía de los poderes elementales';
    fill = document.createElement('div');
    fill.className = 'stamina-fill';
    bar.appendChild(fill);
    bar.style.display = 'none';
    if (health && health.parentNode) health.insertAdjacentElement('afterend', bar);
    else hud.appendChild(bar);
  }

  function draw() {
    if (!fill) return;
    const permille = Math.round(value / MAX * 1000);
    if (permille === lastPermille) return;
    lastPermille = permille;
    fill.style.width = (permille / 10) + '%';
    bar.classList.toggle('is-empty', value <= 0);
  }

  function step(g) {
    if (--checkT <= 0) {
      checkT = CHECK_EVERY;
      const want = anyPowerLearned();
      if (want !== shown) {
        shown = want;
        if (bar) bar.style.display = shown ? '' : 'none';
      }
    }
    if (!shown) return;

    if (powerInUse()) {
      if (value > 0) {
        value--;
        if (value === 0) {
          locked = true;
          if (g.showNotification) g.showNotification('La energía elemental se agotó: espera a que la barra azul se llene');
        }
      }
    } else if (value < MAX) {
      value++;
    }
    if (locked && value >= MAX * UNLOCK_AT) locked = false;
    draw();
  }

  function install(g) {
    buildBar();
    const origUpdate = g.update.bind(g);
    g.update = (dt) => {
      origUpdate(dt);
      if (g.isPlaying && !g.isPaused) {
        try { step(g); } catch (e) { console.error('[Energía]', e); }
      }
    };
    draw();
  }

  window.Stamina = {
    canUse: () => !locked && value > 0,
    getRatio: () => value / MAX,
    refill: () => { value = MAX; locked = false; draw(); }
  };

  window.GameHooks = window.GameHooks || { onInit: [], onRoomLoad: [], onUpdate: [], onRenderWorld: [], onAction: [] };
  window.GameHooks.onInit = window.GameHooks.onInit || [];
  window.GameHooks.onRestartGame = window.GameHooks.onRestartGame || [];
  window.GameHooks.onRestartGame.push(() => {
    window.Stamina.refill();
    checkT = 0;
  });
  window.GameHooks.onInit.push((game) => {
    try { install(game); } catch (e) { console.error('[Energía] no se pudo iniciar:', e); }
  });
})();
