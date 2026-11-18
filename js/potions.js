/**
 * Pociones de regeneración - Ruben: En Busca de Angelo (Claude)
 *
 * Ruben empieza cada partida con 5 pociones. Beber una (acción "potion": R / H, o LB en
 * el mando) da +1 de vida cada 7 s durante ~1 minuto (8 curaciones, +8 en total).
 * Varias pociones bebidas se acumulan: cada una lleva su propio reloj.
 *
 * El reloj cuenta cuadros de lógica (60 por segundo), así que se detiene en pausa.
 * Al morir se pierden los efectos activos (no las pociones que quedan).
 *
 * Hooks: onInit · onAction · onAfterUpdate · onRestartGame (ver MAPA.md).
 * API: window.Potions = { count, restore(n), drink(), activeEffects() }
 * La partida guardada (js/save-game.js) guarda y restaura `count`.
 */
(function () {
  'use strict';

  const START_COUNT = 5;
  const HEAL_AMOUNT = 1;
  const TICK_FRAMES = 7 * 60;    // cada 7 s
  const TICKS = 8;               // 8 × 7 s = 56 s (~1 minuto)

  const state = { count: START_COUNT, effects: [] };
  let els = null;
  let frame = 0;

  function hud(game) {
    if (!els) {
      els = {
        slot: document.getElementById('potion-indicator'),
        count: document.getElementById('potion-count'),
        key: document.getElementById('potion-key')
      };
    }
    if (els.count) els.count.textContent = String(state.count);
    if (els.key) {
      const cm = game && game.controlsManager;
      const k = cm && cm.getPrimaryDisplayKey ? cm.getPrimaryDisplayKey('potion') : 'R';
      els.key.textContent = k || 'R';
    }
    const active = state.effects.length > 0;
    if (els.slot) {
      els.slot.classList.toggle('is-active', active);
      els.slot.classList.toggle('is-empty', state.count <= 0);
      if (active) {
        // Segundos que faltan para que termine el efecto más largo
        let left = 0;
        for (const e of state.effects) left = Math.max(left, TICKS * TICK_FRAMES - e.t);
        els.slot.title = `Regenerando · quedan ${Math.ceil(left / 60)} s`;
      } else {
        els.slot.title = 'Pociones de regeneración (+1 de vida cada 7 s durante 1 min)';
      }
    }
    if (game && game.healthBar) game.healthBar.classList.toggle('hp-regen', active);
  }

  function drink(game) {
    const p = game.player;
    if (!p || p.dead || game.deathTimer > 0) return;
    if (state.count <= 0) {
      game.showNotification('No te quedan pociones');
      if (els && els.slot && game.retriggerClass) game.retriggerClass(els.slot, 'slot-shake');
      return;
    }
    state.count--;
    state.effects.push({ t: 0, ticks: 0 });
    if (window.soundManager && window.soundManager.playPickup) window.soundManager.playPickup();
    if (window.particleSystem) {
      window.particleSystem.createDust(p.x + p.width / 2, p.y + p.height / 2, 14, '#7fe08a');
    }
    if (els && els.slot && game.retriggerClass) game.retriggerClass(els.slot, 'slot-pulse');
    game.showNotification(`Poción de regeneración · +${HEAL_AMOUNT} de vida cada 7 s durante 1 min (quedan ${state.count})`);
    hud(game);
  }

  function update(game, running) {
    if (!running || !state.effects.length) return;
    frame++;
    const p = game.player;
    if (!p) return;
    if (p.dead || game.deathTimer > 0) { state.effects.length = 0; hud(game); return; }

    let healed = 0;
    for (let i = state.effects.length - 1; i >= 0; i--) {
      const e = state.effects[i];
      e.t++;
      if (e.t % TICK_FRAMES === 0) {
        e.ticks++;
        healed += HEAL_AMOUNT;
        if (e.ticks >= TICKS) state.effects.splice(i, 1);
      }
    }

    // Brillo verde suave que sube mientras dura el efecto
    if (window.particleSystem && frame % 24 === 0 && Math.random() < 0.8) {
      window.particleSystem.createDust(p.x + p.width / 2, p.y + p.height * 0.4, 2, '#9cf0a4');
    }

    if (healed > 0) {
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + healed);
      if (p.hp > before && window.particleSystem) {
        window.particleSystem.createDoubleJumpSparks(p.x + p.width / 2, p.y + p.height / 2);
      }
      game.updateHUD();
      hud(game);
    } else if (frame % 30 === 0) {
      hud(game);   // refresca los segundos restantes del tooltip
    }
  }

  function restore(n) {
    state.count = (typeof n === 'number' && n >= 0) ? Math.floor(n) : START_COUNT;
    state.effects.length = 0;
    hud(window.gameInstance);
  }

  window.Potions = {
    get count() { return state.count; },
    restore,
    drink: () => window.gameInstance && drink(window.gameInstance),
    activeEffects: () => state.effects.length
  };

  const H = window.GameHooks = window.GameHooks || {};
  (H.onInit = H.onInit || []).push((game) => {
    (H.onAction = H.onAction || []).push((g, action) => {
      if (action !== 'potion') return false;
      drink(g);
      return true;
    });
    (H.onAfterUpdate = H.onAfterUpdate || []).push(update);
    (H.onRestartGame = H.onRestartGame || []).push(() => restore(START_COUNT));
    hud(game);
  });
})();
