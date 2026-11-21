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
 * Con mando se ignora el ratón: si se tocó el mando (botón o stick) hace menos de
 * PAD_GRACE_MS, mover el ratón no le roba el apuntado. Un clic real sí vuelve al ratón.
 *
 * API: window.Aim
 *   .source()                 'mouse' | 'stick' | 'none'
 *   .isStickHeld()            el stick derecho está inclinado ahora
 *   .forgetStale(keepIdleStick)  si el ratón está quieto hace > 3 s, o el stick suelto
 *                              (salvo keepIdleStick), la fuente pasa a 'none'
 *   .usingPad()               lo último que se usó fue el mando (el tajo no mira al ratón)
 *   .mouseAngle(game, x, y)   ángulo hacia el ratón aunque la fuente activa sea otra (tajo con clic)
 *   .mousePoint(game)        punto del mundo bajo el ratón (si la fuente es el ratón) o null
 *   .target(game, x, y)       ángulo (rad, mundo) desde (x, y) hacia donde apunta el jugador,
 *                              o null si no hay dirección clara este cuadro
 * Hooks: onInit (escucha el ratón) · onBeforeUpdate (lee el stick, antes que las habilidades).
 */
(function () {
  'use strict';

  const STICK_DEAD = 0.35;
  const MOUSE_FRESH_MS = 3000;
  const PAD_GRACE_MS = 2000;
  const mp = { x: 0, y: 0 };
  const a = { source: 'none', mouseX: 0, mouseY: 0, mouseT: -1e9, padT: -1e9, stickHeld: false, stickAngle: 0 };

  // ¿El mando se está usando este cuadro? (cualquier botón o un stick inclinado)
  function padActive(pad) {
    for (let i = 0; i < pad.buttons.length; i++) if (pad.buttons[i] && pad.buttons[i].pressed) return true;
    for (let i = 0; i < Math.min(4, pad.axes.length); i++) if (Math.abs(pad.axes[i] || 0) > STICK_DEAD) return true;
    return false;
  }

  function readStick(game) {
    const pad = game.getPad ? game.getPad() : null;
    if (!pad || !pad.axes || pad.axes.length < 4) { a.stickHeld = false; return; }
    if (pad.buttons && padActive(pad)) {
      a.padT = performance.now();
      if (a.source === 'mouse') a.source = 'none';   // jugando con mando: el ratón deja de apuntar
    }
    const ax = pad.axes[2] || 0, ay = pad.axes[3] || 0;
    a.stickHeld = ax * ax + ay * ay > STICK_DEAD * STICK_DEAD;
    if (a.stickHeld) { a.source = 'stick'; a.stickAngle = Math.atan2(ay, ax); }
  }

  window.Aim = {
    source: () => a.source,
    isStickHeld: () => a.stickHeld,
    usingPad: () => a.padT > a.mouseT,
    forgetStale(keepIdleStick = false) {
      if (a.source === 'mouse' && performance.now() - a.mouseT > MOUSE_FRESH_MS) a.source = 'none';
      if (a.source === 'stick' && !a.stickHeld && !keepIdleStick) a.source = 'none';
    },
    // Ángulo (rad, mundo) desde (x, y) hacia la última posición del ratón, sin importar
    // la fuente activa (lo usa el tajo de Ruben al hacer clic). null si está encima.
    mouseAngle(game, x, y) {
      if (a.mouseT < 0) return null;
      const cam = game.camera || { x: 0, y: 0 };
      const dx = a.mouseX + cam.x - x, dy = a.mouseY + cam.y - y;
      return dx * dx + dy * dy < 36 ? null : Math.atan2(dy, dx);
    },
    // Punto del mundo bajo el ratón (objeto reutilizado) si la fuente activa es el ratón; si no, null
    mousePoint(game) {
      if (a.source !== 'mouse') return null;
      const cam = game.camera || { x: 0, y: 0 };
      mp.x = a.mouseX + cam.x; mp.y = a.mouseY + cam.y;
      return mp;
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
      const track = (e, isClick) => {
        // Movimiento del ratón mientras se juega con mando: se ignora (el clic no)
        if (!isClick && performance.now() - a.padT < PAD_GRACE_MS) return;
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        a.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
        a.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
        a.mouseT = performance.now();
        a.source = 'mouse';
      };
      canvas.addEventListener('mousemove', (e) => track(e, false));
      // pointerdown llega antes que el mousedown de main.js: el clic apunta donde está el ratón
      canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') track(e, true); });
    }
  });
})();
