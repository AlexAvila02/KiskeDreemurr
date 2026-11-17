/**
 * Energía elemental (barra azul) y cansancio de Ruben - Ruben: En Busca de Angelo (Claude)
 *
 * Los poderes elementales (Jalar/Soplar el Aire, Dominio del Agua) comparten una sola barra:
 *   - Al principio, llena = 1 minuto de uso normal (3600 cuadros a 60 por segundo).
 *   - Mientras un poder está activo la barra se vacía según la INTENSIDAD: un viento suave
 *     gasta menos de la mitad; un viento a toda potencia (que barre la sala) gasta un 55 % más.
 *   - Ruben se ACOSTUMBRA: cada vez que gasta energía, la capacidad de la barra crece un poco
 *     (hasta el doble) y la barra se alarga en el HUD. Se guarda en 'ruben_energia_v1'.
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
 * API: window.Stamina.canUse() · .getRatio() · .getCapacity() · .refill() · .isCollapsed()
 */
(function () {
  'use strict';

  const BASE = 60 * 60;    // capacidad inicial: 1 minuto de uso normal a 60 cuadros por segundo
  const CAP_MAX = BASE * 2;   // con práctica la barra llega al doble
  const GROW = 1 / 12;     // capacidad que se gana por cada unidad de energía gastada
  const CAP_KEY = 'ruben_energia_v1';
  const BAR_PX = 180;      // ancho de la barra con la capacidad inicial
  const UNLOCK_AT = 0.2;   // tras agotarse, los poderes vuelven cuando la barra llega a este nivel
  const CHECK_EVERY = 30;  // cada cuántos cuadros se revisa si ya hay poderes aprendidos
  const TIRED_AT = 0.5;    // queda la mitad: cansado (respira rápido y suda)
  const KNEEL_AT = 0.23;   // gastado el 77 %: se arrodilla si sigue usando el poder
  const COLLAPSE_FRAMES = 5 * 60;  // agotado: 5 segundos en el suelo

  let cap = BASE;          // capacidad actual (crece con el uso)
  try { cap = Math.max(BASE, Math.min(CAP_MAX, parseFloat(window.localStorage.getItem(CAP_KEY)) || BASE)); } catch (e) { cap = BASE; }
  let capSaved = cap;
  let lastBarPx = -1;
  let wasUsing = false;
  let value = cap;
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

  // Ritmo de gasto de este cuadro (0 = ningún poder activo). El viento gasta según su
  // potencia (0..1, crece al mantenerlo); el agua (orbe o esfera guiada), ritmo normal.
  function drainRate() {
    let rate = 0;
    const wp = window.WindPull;
    if (wp && wp.isActive && wp.isActive()) rate = 0.45 + 1.1 * (wp.getPower ? wp.getPower() : 0.5);
    const wc = window.WaterControl;
    if (wc && ((wc.isHolding && wc.isHolding()) || (wc.isGuiding && wc.isGuiding())) && rate < 1) rate = 1;
    return rate;
  }
  function powerInUse() { return drainRate() > 0; }

  function saveCap() {
    if (cap === capSaved) return;
    capSaved = cap;
    try { window.localStorage.setItem(CAP_KEY, String(Math.round(cap))); } catch (e) { /* sin guardado */ }
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
    const px = Math.round(BAR_PX * cap / BASE);
    if (px !== lastBarPx) { lastBarPx = px; bar.style.width = px + 'px'; }
    const permille = Math.round(value / cap * 1000);
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
    const ratio = value / cap;
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

    const rate = drainRate();
    const using = rate > 0;
    if (using) {
      if (value > 0) {
        value -= rate;
        // Acostumbrarse: gastar energía agranda la barra (aviso cada 10 % ganado)
        if (cap < CAP_MAX) {
          const before = Math.floor(cap / BASE * 10);
          cap = Math.min(CAP_MAX, cap + rate * GROW);
          if (Math.floor(cap / BASE * 10) > before && g.showNotification) {
            g.showNotification(cap >= CAP_MAX ? '✦ La energía elemental de Ruben llegó a su máximo'
              : 'Ruben se acostumbra al esfuerzo: su energía elemental creció');
          }
        }
        if (value <= 0) {
          value = 0;
          locked = true;
          collapseT = COLLAPSE_FRAMES;   // agotado: cae al suelo (el poder se suelta solo)
          if (g.showNotification) g.showNotification('Ruben está agotado: espera a que la barra azul se llene');
        }
      }
    } else if (value < cap) {
      value = Math.min(cap, value + 1);
    }
    if (wasUsing && !using) saveCap();
    wasUsing = using;
    if (locked && value >= cap * UNLOCK_AT) locked = false;
    fatigueStep(g, using);
    draw();
  }

  // De rodillas sosteniendo el poder o tirado en el suelo: no camina
  function frozen(g) {
    return collapseT > 0 || fatigue.collapse > 0.25 || (fatigue.kneel > 0.5 && powerInUse());
  }

  window.Stamina = {
    canUse: () => !locked && value > 0 && collapseT === 0,
    getRatio: () => value / cap,
    getCapacity: () => cap / BASE,   // 1 = inicial … 2 = máximo
    isCollapsed: () => collapseT > 0,
    refill: () => { value = cap; locked = false; resetFatigue(); draw(); }
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
        cap = BASE; capSaved = BASE;
        try { window.localStorage.removeItem(CAP_KEY); } catch (e) { /* */ }
        window.Stamina.refill();
        checkT = 0;
      });
    } catch (e) { console.error('[Energía] no se pudo iniciar:', e); }
  });
})();
