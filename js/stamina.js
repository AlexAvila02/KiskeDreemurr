/**
 * Energía elemental (barra azul) y cansancio de Ruben - Ruben: En Busca de Angelo (Claude)
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
 * Cansancio (lo dibuja player.js con player.fatigue):
 *   - Gastado el 50 %: respira más rápido y suda (hasta que la barra vuelve a pasar el 50 %).
 *   - Gastado el 77 % con un poder activo: se arrodilla, se apoya en la espada y sostiene el
 *     poder con una sola mano; respira aún más rápido. No camina ni salta mientras tanto.
 *   - Gastado el 100 %: el poder se corta solo, cae de rodillas con las dos manos en el suelo
 *     y la cabeza gacha, jadeando fuerte. A los 5 segundos se repone y se levanta.
 *
 * Integración: GameHooks onAfterUpdate / onFreezeInput / onAction / onRestartGame. Los poderes
 * consultan window.Stamina.canUse() en su condición de activación. Sin basura por cuadro.
 *
 * API: window.Stamina.canUse() · .getRatio() · .refill() · .isCollapsed()
 */
(function () {
  'use strict';

  const MAX = 60 * 60;     // cuadros de uso a fondo (1 minuto a 60 cuadros por segundo)
  const UNLOCK_AT = 0.2;   // tras agotarse, los poderes vuelven cuando la barra llega a este nivel
  const CHECK_EVERY = 30;  // cada cuántos cuadros se revisa si ya hay poderes aprendidos
  const TIRED_AT = 0.5;    // queda la mitad: cansado (respira rápido y suda)
  const KNEEL_AT = 0.23;   // gastado el 77 %: se arrodilla si sigue usando el poder
  const COLLAPSE_FRAMES = 5 * 60;  // agotado: 5 segundos en el suelo

  let value = MAX;
  let locked = false;      // agotada: no se puede reactivar hasta llenarla un poco (evita parpadeos)
  let shown = false;
  let checkT = 0;
  let lastPermille = -1;
  let bar = null;
  let fill = null;
  let collapseT = 0;       // cuadros que le quedan en el suelo
  let sweatT = 0;
  let lastCycle = 0;

  // Estado visual del cansancio (player.fatigue): valores suavizados 0..1 y fase de respiración
  const fatigue = { tired: 0, kneel: 0, collapse: 0, breath: 0 };
  const fxOpts = { vx: 0, vy: 0, dir: 1, angle: 0, scale: 1, color: '#f2d29b', duration: 24, extra: 0 };

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

  function resetFatigue() {
    collapseT = 0;
    fatigue.tired = fatigue.kneel = fatigue.collapse = 0;
  }

  // Jadeo: ruido rosado corto y suave al exhalar
  function breathSound(strength) {
    const sk = window.SoundKit;
    if (!sk) return;
    sk.noiseHit('pink', {
      type: 'bandpass', freq: 1300, freqTo: 650, sweep: 0.32, Q: 0.9,
      peak: 0.02 + 0.06 * strength, attack: 0.05, release: 0.34, stopAt: 0.4, randomStart: true
    });
  }

  function fatigueStep(g, using) {
    const p = g.player;
    if (!p || p.dead || !shown) { resetFatigue(); if (p) p.fatigue = fatigue; return; }
    p.fatigue = fatigue;
    const ratio = value / MAX;
    const grounded = p.isGrounded;
    if (collapseT > 0 && grounded) collapseT--;

    const tTired = ratio <= TIRED_AT || collapseT > 0 ? 1 : 0;
    const tCollapse = collapseT > 0 && grounded ? 1 : 0;
    const tKneel = grounded && (tCollapse || (using && ratio <= KNEEL_AT)) ? 1 : 0;
    fatigue.tired += (tTired - fatigue.tired) * 0.04;
    fatigue.kneel += (tKneel - fatigue.kneel) * (tKneel ? 0.12 : 0.07);
    fatigue.collapse += (tCollapse - fatigue.collapse) * (tCollapse ? 0.1 : 0.05);
    if (fatigue.tired < 0.005) fatigue.tired = 0;
    if (fatigue.kneel < 0.005) fatigue.kneel = 0;
    if (fatigue.collapse < 0.005) fatigue.collapse = 0;

    // Respiración: reposo ~0.4 por segundo; cansado más rápido; de rodillas aún más;
    // en el suelo jadea hondo (un poco más lento pero mucho más fuerte, ver player.js)
    const rate = 0.42 + 0.75 * fatigue.tired + 0.75 * fatigue.kneel - 0.25 * fatigue.collapse;
    fatigue.breath += rate * Math.PI * 2 / 60;
    if (fatigue.breath > 1e6) fatigue.breath = 0;

    // Cada exhalación (con cansancio): jadeo y bocanada de aire
    const cycle = Math.floor(fatigue.breath / (Math.PI * 2));
    if (cycle !== lastCycle) {
      lastCycle = cycle;
      const strength = Math.max(fatigue.kneel * 0.7, fatigue.collapse);
      if (fatigue.tired > 0.5) breathSound(strength);
      if (strength > 0.4 && window.particleSystem) {
        const f = p.facing || 1;
        window.particleSystem.createDust(p.x + p.width / 2 + f * (12 + 3 * fatigue.collapse),
          p.y + 13 + 7 * fatigue.kneel + 5 * fatigue.collapse, 2, '#f4f8ff');
      }
    }

    // Gotas de sudor que saltan de la frente
    if (fatigue.tired > 0.5) {
      const every = Math.round(46 - 18 * fatigue.kneel - 8 * fatigue.collapse);
      if (++sweatT >= every) {
        sweatT = 0;
        const AS = window.AnimSystem;
        if (AS && AS.spawnFX) {
          const f = p.facing || 1;
          const side = Math.random() < 0.65 ? -f : f;
          fxOpts.vx = side * (0.55 + Math.random() * 0.4);
          fxOpts.vy = -1.6 - Math.random() * 0.5;
          fxOpts.dir = side;
          try {
            AS.spawnFX('effort-sweat-drop', p.x + p.width / 2 + side * 7 + f * 2 * fatigue.collapse,
              p.y + 4 + 7 * fatigue.kneel + 5 * fatigue.collapse, fxOpts);
          } catch (e) { /* */ }
        }
      }
    } else {
      sweatT = 0;
    }
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
    if (!shown) { fatigueStep(g, false); return; }

    const using = powerInUse();
    if (using) {
      if (value > 0) {
        value--;
        if (value === 0) {
          locked = true;
          collapseT = COLLAPSE_FRAMES;   // agotado: cae al suelo (el poder se suelta solo)
          if (g.showNotification) g.showNotification('Ruben está agotado: espera a que la barra azul se llene');
        }
      }
    } else if (value < MAX) {
      value++;
    }
    if (locked && value >= MAX * UNLOCK_AT) locked = false;
    fatigueStep(g, using);
    draw();
  }

  // De rodillas sosteniendo el poder o tirado en el suelo: no camina
  function frozen(g) {
    return collapseT > 0 || fatigue.collapse > 0.25 || (fatigue.kneel > 0.5 && powerInUse());
  }

  window.Stamina = {
    canUse: () => !locked && value > 0 && collapseT === 0,
    getRatio: () => value / MAX,
    isCollapsed: () => collapseT > 0,
    refill: () => { value = MAX; locked = false; resetFatigue(); draw(); }
  };

  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try {
      buildBar();
      draw();
      const H = window.GameHooks;
      H.onAfterUpdate.push((g, running) => {
        if (!running) return;
        try { step(g); } catch (e) { console.error('[Energía]', e); }
      });
      H.onFreezeInput.push((g) => frozen(g));
      H.onAction.push((g, action) => {
        if (!frozen(g)) return false;
        return action === 'jump' || action === 'attack' || action === 'grab' ||
          (action === 'interact' && collapseT > 0);
      });
      H.onRestartGame.push(() => {
        window.Stamina.refill();
        checkT = 0;
      });
    } catch (e) { console.error('[Energía] no se pudo iniciar:', e); }
  });
})();
