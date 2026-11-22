/**
 * Navegación de Menús con Mando - Ruben: En Busca de Angelo
 *
 * Permite recorrer con el mando la pantalla de inicio, el menú de pausa y el
 * menú de controles:
 *   Stick izquierdo / Cruceta  → mover la selección (navegación espacial)
 *   A / ✕                      → elegir el botón seleccionado
 *   B / ○                      → volver / cerrar
 *   Start                      → elegir (inicio) · continuar (pausa) · cerrar (controles)
 *
 * Se engancha solo vía window.GameHooks.onInit; main.js le delega el mando
 * mientras haya un menú visible (game.menuNav.handlePad).
 */

class MenuNavigator {
  constructor(game) {
    this.game = game;
    this.activeId = null;      // id del contenedor del menú activo
    this.focused = null;       // botón resaltado actualmente
    this.lastFocus = {};       // último botón usado en cada menú
    this.heldDir = null;       // dirección mantenida (para auto-repetición)
    this.nextRepeat = 0;

    this.REPEAT_DELAY = 380;   // ms antes de empezar a repetir
    this.REPEAT_RATE = 140;    // ms entre repeticiones

    // Botón resaltado por defecto al abrir cada menú
    this.defaults = {
      'controls-modal': 'btn-save-controls',
      'pause-modal': 'btn-pause-resume',
      'overlay-screen': 'btn-start',
      'mp-modal': 'mp-host'
    };

    // Si se vuelve a usar el ratón, quitar el resaltado del mando
    window.addEventListener('mousemove', () => this.clearHighlight(), { passive: true });
  }

  isVisible(el) {
    return !!el && !el.classList.contains('hidden');
  }

  /** Devuelve el contenedor del menú que está al frente, o null si se está jugando */
  getActiveMenu() {
    const order = ['mp-modal', 'controls-modal', 'pause-modal', 'overlay-screen'];
    for (const id of order) {
      const el = document.getElementById(id);
      if (this.isVisible(el)) return el;
    }
    return null;
  }

  /** Botones navegables y visibles dentro de un menú */
  getItems(container) {
    return Array.from(container.querySelectorAll('button'))
      .filter(b => !b.disabled && b.offsetParent !== null && b.getClientRects().length > 0);
  }

  setFocus(btn, sound = true) {
    if (!btn) return;
    if (this.focused && this.focused !== btn) this.focused.classList.remove('pad-focus');
    const changed = this.focused !== btn;
    this.focused = btn;
    btn.classList.add('pad-focus');
    try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); }
    // Mantener visible dentro de listas con scroll (menú de controles)
    if (btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest' });
    if (this.activeId) this.lastFocus[this.activeId] = btn;
    if (changed && sound && window.soundManager && window.soundManager.playJump) {
      try { window.soundManager.playJump(); } catch (e) { /* sin audio */ }
    }
  }

  clearHighlight() {
    if (this.focused) this.focused.classList.remove('pad-focus');
  }

  /** Coloca la selección inicial al entrar a un menú (o si el botón desapareció) */
  ensureFocus(container) {
    const items = this.getItems(container);
    if (items.length === 0) return;
    if (this.focused && this.focused.isConnected && items.includes(this.focused)) {
      this.focused.classList.add('pad-focus');
      return;
    }
    const remembered = this.lastFocus[container.id];
    if (remembered && remembered.isConnected && items.includes(remembered)) {
      this.setFocus(remembered, false);
      return;
    }
    const def = document.getElementById(this.defaults[container.id]);
    this.setFocus(def && items.includes(def) ? def : items[0], false);
  }

  /** Busca el botón más cercano en una dirección (navegación espacial) */
  move(container, dir) {
    const items = this.getItems(container);
    if (items.length === 0) return;
    if (!this.focused || !items.includes(this.focused)) {
      this.ensureFocus(container);
      return;
    }

    const center = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const c0 = center(this.focused);
    const vertical = dir === 'up' || dir === 'down';
    const sign = (dir === 'up' || dir === 'left') ? -1 : 1;

    const findBest = (pool) => {
      let candidate = null, bestScore = Infinity;
      for (const el of pool) {
        if (el === this.focused) continue;
        const c = center(el);
        const main = (vertical ? c.y - c0.y : c.x - c0.x) * sign;
        const cross = Math.abs(vertical ? c.x - c0.x : c.y - c0.y);
        if (main <= 4) continue; // no está en esa dirección
        const score = main + cross * 2.5;
        if (score < bestScore) { bestScore = score; candidate = el; }
      }
      return candidate;
    };

    let best = null;
    const list = container.id === 'controls-modal' ? document.getElementById('controls-list') : null;
    if (list && vertical && list.contains(this.focused)) {
      // Priorizar botones dentro de #controls-list antes de saltar a los botones externos
      const listItems = items.filter(el => list.contains(el));
      best = findBest(listItems);
      if (!best && dir === 'down' && list.scrollTop + list.clientHeight < list.scrollHeight - 4) {
        // Desplazar hacia abajo para mostrar la sección fija "Ratón y mando" antes de salir de la lista
        list.scrollTop = Math.min(list.scrollHeight, list.scrollTop + 72);
        return;
      }
    }

    if (!best) best = findBest(items);

    // Sin destino: arriba/abajo dan la vuelta al otro extremo del menú
    if (!best && vertical) {
      let farScore = -Infinity;
      for (const el of items) {
        if (el === this.focused) continue;
        const c = center(el);
        const main = (c.y - c0.y) * -sign; // lo más lejos en sentido contrario
        const cross = Math.abs(c.x - c0.x);
        const score = main - cross * 0.5;
        if (main > 4 && score > farScore) { farScore = score; best = el; }
      }
    }

    if (best) this.setFocus(best);
  }

  readDirection() {
    const k = this.game.keys || {};
    if (k['PadUp']) return 'up';
    if (k['PadDown']) return 'down';
    if (k['PadLeft']) return 'left';
    if (k['PadRight']) return 'right';
    return null;
  }

  /**
   * Procesa el mando mientras hay un menú visible.
   * @returns {boolean} true si había un menú y el mando quedó consumido por él.
   */
  handlePad(pressed, prev) {
    const container = this.getActiveMenu();
    const id = container ? container.id : null;

    if (id !== this.activeId) {
      // Cambió el menú: soltar la selección anterior
      this.clearHighlight();
      if (!container && document.activeElement && document.activeElement.blur) {
        const ae = document.activeElement;
        if (ae.closest && ae.closest('#overlay-screen, #pause-modal, #controls-modal, #mp-modal, #journal-modal, #map-modal')) ae.blur();
      }
      this.focused = null;
      this.activeId = id;
      this.heldDir = this.readDirection(); // no mover por una dirección que ya venía apretada
      this.nextRepeat = performance.now() + this.REPEAT_DELAY;
    }
    if (!container) return false;

    const just = (i) => pressed[i] && !prev[i];
    const cm = this.game.controlsManager;

    // Esperando un botón del mando: el primero que se pulse se asigna (Start cancela)
    if (cm && cm.isListeningPad && cm.isListeningPad()) {
      if (just(9)) { cm.stopListening(); return true; }
      for (let i = 0; i < pressed.length; i++) {
        if (just(i)) { cm.capturePadButton(i); break; }
      }
      return true;
    }

    // Esperando una tecla para reasignar: B o Start cancelan
    if (cm && cm.isListening && cm.isListening()) {
      if (just(1) || just(9)) cm.stopListening();
      return true;
    }

    this.ensureFocus(container);

    // Movimiento con auto-repetición al mantener la dirección
    const dir = this.readDirection();
    const now = performance.now();
    if (dir && dir !== this.heldDir) {
      this.move(container, dir);
      this.nextRepeat = now + this.REPEAT_DELAY;
    } else if (dir && now >= this.nextRepeat) {
      this.move(container, dir);
      this.nextRepeat = now + this.REPEAT_RATE;
    }
    this.heldDir = dir;

    // A: elegir
    if (just(0)) {
      if (this.focused) {
        if (window.soundManager && window.soundManager.init) window.soundManager.init();
        this.focused.click();
      }
      return true;
    }

    // B: volver
    if (just(1)) {
      if (id === 'controls-modal' && cm) cm.closeModal();
      else if (id === 'pause-modal') this.game.togglePause(false);
      else if (id === 'mp-modal' && window.Multiplayer && window.Multiplayer.close) window.Multiplayer.close();
      return true;
    }

    // Start
    if (just(9)) {
      if (id === 'controls-modal' && cm) cm.closeModal();
      else if (id === 'pause-modal') this.game.togglePause(false);
      else if (id === 'mp-modal' && window.Multiplayer && window.Multiplayer.close) window.Multiplayer.close();
      else if (this.focused) {
        if (window.soundManager && window.soundManager.init) window.soundManager.init();
        this.focused.click();
      }
      return true;
    }

    return true;
  }
}

window.MenuNavigator = MenuNavigator;
window.GameHooks = window.GameHooks || { onInit: [], onRoomLoad: [], onUpdate: [], onRenderWorld: [], onAction: [] };
window.GameHooks.onInit = window.GameHooks.onInit || [];
window.GameHooks.onInit.push((game) => {
  game.menuNav = new MenuNavigator(game);
});
