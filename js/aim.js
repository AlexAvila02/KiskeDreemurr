/**
 * Apuntado compartido (ratón / stick derecho) - Ruben: En Busca de Angelo (Claude)
 *
 * Un solo lugar escucha el ratón sobre el canvas y lee el stick derecho del mando.
 * Lo usan las habilidades que apuntan (wind-pull.js, water-power.js); cada una conserva
 * su propio ángulo y suavizado, y le pide a Aim hacia dónde apunta el jugador.
 *
 * Fuente activa: gana la última que se usó.
 *   'mouse' → se movió el ratón sobre el canvas
 *   'stick' → se inclinó el stick derecho (ejes 2/3, zona muerta 0.35)
 *   'none'  → ninguna (cada habilidad decide: adelante, teclas, etc.)
 *
 * API: window.Aim
 *   .source()                 'mouse' | 'stick' | 'none'
 *   .isStickHeld()            el stick derecho está inclinado ahora
 *   .forgetStale(keepIdleStick)  si el ratón está quieto hace > 3 s, o el stick suelto
 *                              (salvo keepIdleStick), la fuente pasa a 'none'
 *   .target(game, x, y)       ángulo (rad, mundo) desde (x, y) hacia donde apunta el jugador,
 *                              o null si no hay dirección clara este cuadro
 * Hooks: onInit (escucha el ratón) · onBeforeUpdate (lee el stick, antes que las habilidades).
 */
(function () {
  'use strict';

  const STICK_DEAD = 0.35;
  const MOUSE_FRESH_MS = 3000;
  const a = { source: 'none', mouseX: 0, mouseY: 0, mouseT: -1e9, stickHeld: false, stickAngle: 0 };

  function readStick(game) {
    const pad = game.getPad ? game.getPad() : null;
    if (!pad || !pad.axes || pad.axes.length < 4) { a.stickHeld = false; return; }
    const ax = pad.axes[2] || 0, ay = pad.axes[3] || 0;
    a.stickHeld = ax * ax + ay * ay > STICK_DEAD * STICK_DEAD;
    if (a.stickHeld) { a.source = 'stick'; a.stickAngle = Math.atan2(ay, ax); }
  }

  window.Aim = {
    source: () => a.source,
    isStickHeld: () => a.stickHeld,
    forgetStale(keepIdleStick = false) {
      if (a.source === 'mouse' && performance.now() - a.mouseT > MOUSE_FRESH_MS) a.source = 'none';
      if (a.source === 'stick' && !a.stickHeld && !keepIdleStick) a.source = 'none';
    },
    target(game, x, y) {
      if (a.source === 'stick') return a.stickHeld ? a.stickAngle : null;
      if (a.source === 'mouse') {
        const cam = game.camera || { x: 0, y: 0 };
        const dx = a.mouseX + cam.x - x, dy = a.mouseY + cam.y - y;
        return dx * dx + dy * dy < 36 ? null : Math.atan2(dy, dx);
      }
      return null;
    }
  };

  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    // El stick se lee una vez por cuadro, antes que las habilidades
    window.GameHooks.onBeforeUpdate.push((g, running) => { if (running) readStick(g); });
    // Ratón: posición en píxeles del canvas (corrige el escalado por CSS)
    const canvas = game.canvas;
    if (canvas) {
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        a.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
        a.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
        a.mouseT = performance.now();
        a.source = 'mouse';
      });
    }
  });
})();
