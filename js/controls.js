/**
 * Gestor de Controles y Reasignación de Teclas - Ruben: En Busca de Angelo
 * Permite personalizar teclas, guardar configuración en localStorage y actualizar la interfaz.
 */

class ControlsManager {
  constructor(game) {
    this.game = game;
    this.storageKey = 'ruben_game_controls_v2'; // v2: W/S apuntan, X salta

    // Acciones del juego con sus descripciones y teclas por defecto (Principal y Alternativa)
    this.actions = [
      {
        id: 'moveLeft',
        name: 'Mover Izquierda',
        icon: (window.UIIcons ? UIIcons.svg('arrow-left') : '←'),
        defaultKeys: ['KeyA', 'ArrowLeft']
      },
      {
        id: 'moveRight',
        name: 'Mover Derecha',
        icon: (window.UIIcons ? UIIcons.svg('arrow-right') : '→'),
        defaultKeys: ['KeyD', 'ArrowRight']
      },
      {
        id: 'jump',
        name: 'Saltar (mantener = más alto)',
        icon: (window.UIIcons ? UIIcons.svg('jump') : ''),
        defaultKeys: ['Space', 'KeyX']
      },
      {
        id: 'aimUp',
        name: 'Apuntar Arriba (mantener + atacar)',
        icon: (window.UIIcons ? UIIcons.svg('arrow-up') : '↑'),
        defaultKeys: ['KeyW', 'ArrowUp']
      },
      {
        id: 'aimDown',
        name: 'Apuntar Abajo (mantener + atacar)',
        icon: (window.UIIcons ? UIIcons.svg('arrow-down') : '↓'),
        defaultKeys: ['KeyS', 'ArrowDown']
      },
      {
        id: 'attack',
        name: 'Atacar (Espada)',
        icon: (window.UIIcons ? UIIcons.svg('sword') : ''),
        defaultKeys: ['KeyJ', 'KeyZ']
      },
      {
        id: 'grab',
        name: 'Agarrar / Lanzar',
        icon: (window.UIIcons ? UIIcons.svg('grab') : ''),
        defaultKeys: ['KeyK', 'KeyC']
      },
      {
        id: 'windPull',
        name: 'Viento (con Arriba/Abajo) / Agua (sola)',
        icon: (window.UIIcons ? UIIcons.svg('wind') : ''),
        defaultKeys: ['KeyF', 'ShiftLeft']
      },
      {
        id: 'waterGuide',
        name: 'Esfera guiada (tras mejorar el agua)',
        icon: (window.UIIcons ? UIIcons.svg('water') : ''),
        defaultKeys: ['KeyG', null]
      },
      {
        id: 'earth',
        name: 'Tierra: levantar un pilar de roca (apuntá con el ratón)',
        icon: (window.UIIcons ? UIIcons.svg('earth') : ''),
        defaultKeys: ['KeyQ', 'KeyV']
      },
      {
        id: 'potion',
        name: 'Beber Poción de Regeneración',
        icon: (window.UIIcons ? UIIcons.svg('potion') : ''),
        defaultKeys: ['KeyR', 'KeyH']
      },
      {
        id: 'interact',
        name: 'Interactuar / Hablar / Abrir',
        icon: (window.UIIcons ? UIIcons.svg('scroll') : ''),
        defaultKeys: ['KeyE', 'Enter']
      }
    ];

    // Mapeo actual: { [actionId]: [key1, key2] }
    this.bindings = {};

    // Botones del mando (reasignables): { [índiceBotón]: actionId }
    // Índices del mapeo estándar: 0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 7 RT
    this.padStorageKey = 'ruben_game_pad_v1';
    this.defaultPadMap = { 0: 'jump', 2: 'attack', 5: 'attack', 7: 'earth', 1: 'grab', 4: 'potion', 3: 'interact' };
    // Botones que otros módulos leen directo (L2 aire/agua, Select diario, Start pausa,
    // L3 esfera, R3 mapa, cruceta): no se pueden asignar en mandos estándar
    this.PAD_RESERVED = [6, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    this.PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', '↑', '↓', '←', '→', 'Guía'];
    this.padMap = {};

    // Estado del reasignador en UI
    this.listeningSlot = null; // { actionId, slotIndex, buttonElement }

    // Referencias a elementos del DOM
    this.modal = null;
    this.listContainer = null;

    this.init();
  }

  /**
   * Inicializa las asignaciones desde localStorage o valores por defecto
   */
  init() {
    this.loadBindings();
    this.loadPadMap();
    this.cacheDOMElements();
    this.setupModalEvents();
    this.updateControlsGuideUI();
  }

  /**
   * Obtiene la copia de los controles por defecto
   */
  getDefaultBindings() {
    const defaults = {};
    for (const act of this.actions) {
      defaults[act.id] = [...act.defaultKeys];
    }
    return defaults;
  }

  /**
   * Carga las asignaciones desde almacenamiento local
   */
  loadBindings() {
    const defaults = this.getDefaultBindings();
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.bindings = {};
        for (const act of this.actions) {
          if (Array.isArray(parsed[act.id]) && parsed[act.id].length > 0) {
            // Asegurar que siempre haya 2 ranuras (pueden ser null si se vaciaron)
            this.bindings[act.id] = [
              parsed[act.id][0] || null,
              parsed[act.id][1] || null
            ];
          } else {
            this.bindings[act.id] = [...defaults[act.id]];
          }
        }
        return;
      }
    } catch (e) {
      console.warn("No se pudo leer localStorage para los controles:", e);
    }
    this.bindings = defaults;
  }

  /** Carga los botones del mando guardados (o los de fábrica) */
  loadPadMap() {
    this.padMap = Object.assign({}, this.defaultPadMap);
    try {
      const saved = JSON.parse(localStorage.getItem(this.padStorageKey) || 'null');
      if (saved && typeof saved === 'object') {
        const map = {};
        for (const k in saved) {
          if (/^\d+$/.test(k) && this.padActionIds().includes(saved[k])) map[k] = saved[k];
        }
        if (Object.keys(map).length) this.padMap = map;
      }
    } catch (e) { /* sin localStorage: valores de fábrica */ }
  }

  savePadMap() {
    try { localStorage.setItem(this.padStorageKey, JSON.stringify(this.padMap)); } catch (e) { /* nada */ }
  }

  /** Acciones que se pueden poner en un botón del mando */
  padActionIds() {
    return ['jump', 'attack', 'grab', 'interact', 'potion', 'earth'];
  }

  /** { [índiceBotón]: actionId } que usa main.js al leer el mando */
  getPadMap() {
    return this.padMap;
  }

  /** Nombre de un botón del mando (A, LB...) o "Botón N" en mandos no estándar */
  padButtonName(i) {
    const pad = this.game && this.game.getPad ? this.game.getPad() : null;
    if (pad && pad.mapping !== 'standard') return 'Botón ' + (Number(i) + 1);
    return this.PAD_NAMES[i] || ('Botón ' + (Number(i) + 1));
  }

  /** Botones asignados a una acción, en texto ("X · RB") */
  getPadDisplay(actionId) {
    return Object.keys(this.padMap)
      .filter(k => this.padMap[k] === actionId)
      .sort((a, b) => a - b)
      .map(k => this.padButtonName(k))
      .join(' · ');
  }

  /**
   * Asigna un botón del mando a una acción. Si el botón era de otra acción, esa
   * acción se queda con el botón que tenía esta (intercambio).
   * @returns {boolean} false si el botón está reservado
   */
  setPadBinding(actionId, button) {
    const pad = this.game && this.game.getPad ? this.game.getPad() : null;
    const standard = !pad || pad.mapping === 'standard';
    button = Number(button);
    if (standard ? this.PAD_RESERVED.includes(button) : button === 9) return false;
    const mine = Object.keys(this.padMap).filter(k => this.padMap[k] === actionId).map(Number);
    const other = this.padMap[button];
    for (const k of mine) delete this.padMap[k];
    if (other && other !== actionId) {
      const free = mine.find(k => k !== button);
      if (free !== undefined) this.padMap[free] = other;
    }
    this.padMap[button] = actionId;
    this.savePadMap();
    return true;
  }

  /** Con el menú esperando un botón del mando: asigna el botón pulsado */
  capturePadButton(button) {
    const slot = this.listeningSlot;
    if (!slot || !slot.pad) return;
    if (!this.setPadBinding(slot.actionId, button)) {
      if (this.game && this.game.showNotification) {
        this.game.showNotification(this.padButtonName(button) + ' ya tiene un uso fijo: elegí otro botón');
      }
      if (window.soundManager && window.soundManager.playHit) window.soundManager.playHit();
      return;
    }
    if (window.soundManager && window.soundManager.playPickup) window.soundManager.playPickup();
    this.stopListening();
  }

  /** true si el menú espera un botón del mando (no una tecla) */
  isListeningPad() {
    return !!(this.listeningSlot && this.listeningSlot.pad);
  }

  /**
   * Guarda las asignaciones actuales en localStorage
   */
  saveBindings() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.bindings));
    } catch (e) {
      console.warn("No se pudo guardar la configuración de controles:", e);
    }
    this.updateControlsGuideUI();
  }

  /**
   * Restablece los controles a la configuración original de fábrica
   */
  resetToDefaults() {
    this.bindings = this.getDefaultBindings();
    this.saveBindings();
    this.padMap = Object.assign({}, this.defaultPadMap);
    this.savePadMap();
    this.renderUI();
    if (window.soundManager && window.soundManager.playDoorUnlock) {
      window.soundManager.playDoorUnlock();
    }
    if (this.game && this.game.showNotification) {
      this.game.showNotification("Controles restablecidos por defecto");
    }
  }

  /**
   * Comprueba si una acción continua (como moverse a la izquierda o derecha) está activa
   */
  isActive(actionId, activeKeys) {
    if (!activeKeys) return false;
    const keys = this.bindings[actionId];
    if (keys) {
      for (const code of keys) {
        if (code && activeKeys[code]) return true;
      }
    }
    // Soporte nativo adicional para mandos
    if (actionId === 'moveLeft' && activeKeys['PadLeft']) return true;
    if (actionId === 'moveRight' && activeKeys['PadRight']) return true;
    if (actionId === 'aimUp' && activeKeys['PadUp']) return true;
    if (actionId === 'aimDown' && activeKeys['PadDown']) return true;
    if (actionId === 'windPull' && activeKeys['PadL2']) return true;
    return false;
  }

  /**
   * Devuelve la acción asignada a una tecla específica al presionarla
   */
  getActionForKey(keyCode) {
    for (const actionId in this.bindings) {
      const keys = this.bindings[actionId];
      if (keys && keys.includes(keyCode)) {
        return actionId;
      }
    }
    return null;
  }

  /**
   * Indica si una tecla debe cancelar el scroll del navegador
   */
  shouldPreventDefault(keyCode) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(keyCode)) {
      return true;
    }
    // Si la tecla está asignada a alguna acción de juego, prevenir comportamiento del navegador
    return this.getActionForKey(keyCode) !== null;
  }

  /**
   * Formatea el código de la tecla de forma legible en español
   */
  formatKeyName(keyCode) {
    if (!keyCode) return '---';

    const specialNames = {
      'Space': 'Espacio',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'Enter': 'Intro',
      'NumpadEnter': 'Num Intro',
      'ShiftLeft': 'Shift Izq',
      'ShiftRight': 'Shift Der',
      'ControlLeft': 'Ctrl Izq',
      'ControlRight': 'Ctrl Der',
      'AltLeft': 'Alt Izq',
      'AltRight': 'Alt Der',
      'Backspace': 'Borrar',
      'Delete': 'Supr',
      'Tab': 'Tab',
      'Escape': 'Esc',
      'CapsLock': 'Bloq Mayús',
      'Minus': '-',
      'Equal': '=',
      'BracketLeft': '[',
      'BracketRight': ']',
      'Semicolon': ';',
      'Quote': '\'',
      'Backquote': '`',
      'Backslash': '\\',
      'Comma': ',',
      'Period': '.',
      'Slash': '/'
    };

    if (specialNames[keyCode]) return specialNames[keyCode];

    if (keyCode.startsWith('Key')) {
      return keyCode.replace('Key', '');
    }

    if (keyCode.startsWith('Digit')) {
      return keyCode.replace('Digit', '');
    }

    if (keyCode.startsWith('Numpad')) {
      return 'Num ' + keyCode.replace('Numpad', '');
    }

    return keyCode;
  }

  /**
   * Obtiene el nombre formateado de la tecla principal para notificaciones o pistas
   */
  getPrimaryDisplayKey(actionId) {
    const keys = this.bindings[actionId];
    if (keys && keys[0]) {
      return this.formatKeyName(keys[0]);
    }
    if (keys && keys[1]) {
      return this.formatKeyName(keys[1]);
    }
    return '?';
  }

  /**
   * Reasigna una ranura de tecla asegurando que no haya colisiones duplicadas
   */
  setBinding(actionId, slotIndex, newKey) {
    if (!this.bindings[actionId]) {
      this.bindings[actionId] = [null, null];
    }

    // Si la nueva tecla no es nula, verificar si ya estaba en uso en otra acción
    if (newKey) {
      for (const act of this.actions) {
        const actKeys = this.bindings[act.id];
        if (!actKeys) continue;
        for (let i = 0; i < actKeys.length; i++) {
          if (actKeys[i] === newKey) {
            // Vaciar la ranura anterior para evitar conflictos
            actKeys[i] = null;
          }
        }
      }
    }

    this.bindings[actionId][slotIndex] = newKey;
    this.saveBindings();
  }

  /**
   * Enlaza elementos del DOM
   */
  cacheDOMElements() {
    this.modal = document.getElementById('controls-modal');
    this.listContainer = document.getElementById('controls-list');
  }

  /**
   * Configura los eventos del modal de controles
   */
  setupModalEvents() {
    const btnClose = document.getElementById('btn-close-controls');
    const btnSave = document.getElementById('btn-save-controls');
    const btnReset = document.getElementById('btn-reset-controls');

    if (btnClose) {
      btnClose.addEventListener('click', () => this.closeModal());
    }
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        this.saveBindings();
        this.closeModal();
        if (window.soundManager && window.soundManager.playPickup) {
          window.soundManager.playPickup();
        }
      });
    }
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.resetToDefaults();
      });
    }

    // Escucha global de teclado mientras se está reasignando una tecla
    window.addEventListener('keydown', (e) => {
      if (!this.listeningSlot) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const { actionId, slotIndex } = this.listeningSlot;

      // Esperando un botón del mando: el teclado solo puede cancelar (Esc)
      if (this.listeningSlot.pad) {
        if (e.code === 'Escape') this.stopListening();
        return;
      }

      // Escape cancela la reasignación sin alterar nada
      if (e.code === 'Escape') {
        this.stopListening();
        return;
      }

      // Backspace o Delete eliminan la asignación de esa ranura
      if (e.code === 'Backspace' || e.code === 'Delete') {
        this.setBinding(actionId, slotIndex, null);
        if (window.soundManager && window.soundManager.playHit) {
          window.soundManager.playHit();
        }
        this.stopListening();
        this.renderUI();
        return;
      }

      // Asignar la nueva tecla
      this.setBinding(actionId, slotIndex, e.code);
      if (window.soundManager && window.soundManager.playPickup) {
        window.soundManager.playPickup();
      }
      this.stopListening();
      this.renderUI();
    }, true);
  }

  /**
   * Comienza a escuchar la siguiente pulsación de tecla para una ranura
   */
  startListening(actionId, slotIndex, buttonElement) {
    // Si ya estábamos escuchando otra ranura, cancelarla antes
    if (this.listeningSlot) {
      this.stopListening();
    }

    const pad = slotIndex === 'pad';
    this.listeningSlot = { actionId, slotIndex, buttonElement, pad };
    buttonElement.classList.add('listening');
    buttonElement.textContent = pad ? 'Pulsa botón...' : 'Pulsa tecla...';
    if (window.soundManager && window.soundManager.playJump) {
      window.soundManager.playJump();
    }
  }

  /**
   * Detiene el modo de escucha
   */
  stopListening() {
    if (this.listeningSlot && this.listeningSlot.buttonElement) {
      this.listeningSlot.buttonElement.classList.remove('listening');
    }
    this.listeningSlot = null;
    this.renderUI();
  }

  /**
   * Comprueba si el gestor está a la espera de una tecla
   */
  isListening() {
    return this.listeningSlot !== null;
  }

  /**
   * Comprueba si el modal de controles está abierto
   */
  isModalOpen() {
    return this.modal && !this.modal.classList.contains('hidden');
  }

  /**
   * Abre el modal de configuración de controles
   */
  openModal() {
    if (!this.modal) this.cacheDOMElements();
    if (!this.modal) return;

    this.stopListening();
    this.renderUI();
    this.modal.classList.remove('hidden');

    if (window.soundManager && window.soundManager.playPickup) {
      window.soundManager.playPickup();
    }
  }

  /**
   * Cierra el modal de configuración de controles
   */
  closeModal() {
    if (!this.modal) return;
    this.stopListening();
    this.modal.classList.add('hidden');

    // Si el juego está en pausa, mantener o volver a mostrar la ventana de pausa
    if (this.game && this.game.isPaused && this.game.pauseModal) {
      this.game.pauseModal.classList.remove('hidden');
    }
  }

  /**
   * Renderiza la tabla y ranuras interactivas de reasignación
   */
  renderUI() {
    if (!this.listContainer) this.cacheDOMElements();
    if (!this.listContainer) return;

    // Preservar desplazamiento y foco al reconstruir la lista
    const prevScroll = this.listContainer.scrollTop;
    const nav = this.game && this.game.menuNav;
    const hadPadFocus = !!(nav && nav.focused && this.listContainer.contains(nav.focused));
    const hadDomFocus = !!(document.activeElement && this.listContainer.contains(document.activeElement));
    const focusedBtn = (hadPadFocus ? nav.focused : null) || (hadDomFocus ? document.activeElement : null);
    let focusAction = focusedBtn && focusedBtn.dataset ? focusedBtn.dataset.action : null;
    let focusSlot = focusedBtn && focusedBtn.dataset ? focusedBtn.dataset.slot : null;
    if (!focusAction && this.listeningSlot) {
      focusAction = this.listeningSlot.actionId;
      focusSlot = String(this.listeningSlot.slotIndex);
    }

    this.listContainer.innerHTML = '';

    for (const act of this.actions) {
      const row = document.createElement('div');
      row.className = 'control-row';

      // Etiqueta de la acción con su icono temático
      const labelDiv = document.createElement('div');
      labelDiv.className = 'control-label';
      labelDiv.innerHTML = `<span class="action-icon">${act.icon}</span><span class="action-name">${act.name}</span>`;
      row.appendChild(labelDiv);

      // Contenedor de botones para Ranura 1 y Ranura 2
      const slotsDiv = document.createElement('div');
      slotsDiv.className = 'control-slots';

      const keys = this.bindings[act.id] || [null, null];

      for (let slotIdx = 0; slotIdx < 2; slotIdx++) {
        const keyBtn = document.createElement('button');
        keyBtn.type = 'button';
        keyBtn.className = 'btn-key-slot';
        keyBtn.dataset.action = act.id;
        keyBtn.dataset.slot = String(slotIdx);

        const currentKey = keys[slotIdx];
        keyBtn.textContent = this.formatKeyName(currentKey);

        if (!currentKey) {
          keyBtn.classList.add('empty');
        }

        // Si esta ranura específica es la que está escuchando
        if (
          this.listeningSlot &&
          this.listeningSlot.actionId === act.id &&
          this.listeningSlot.slotIndex === slotIdx
        ) {
          keyBtn.classList.add('listening');
          keyBtn.textContent = 'Pulsa tecla...';
        }

        keyBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.startListening(act.id, slotIdx, keyBtn);
        });

        slotsDiv.appendChild(keyBtn);
      }

      row.appendChild(slotsDiv);
      this.listContainer.appendChild(row);
    }

    this.renderMousePadRows();

    this.listContainer.scrollTop = prevScroll;
    if (focusAction) {
      const btn = this.listContainer.querySelector(`.btn-key-slot[data-action="${focusAction}"][data-slot="${focusSlot}"]`);
      if (btn) {
        if (hadPadFocus && nav) nav.setFocus(btn, false);
        else if (hadDomFocus) btn.focus({ preventScroll: true });
      }
    }
  }

  /**
   * Ratón y mando: mismas filas que el resto de la lista (fijas, no se reasignan)
   */
  renderMousePadRows() {
    const icon = (n) => (window.UIIcons ? window.UIIcons.svg(n) : '');
    const head = document.createElement('div');
    head.className = 'controls-table-header controls-subheader';
    head.innerHTML = '<span>Ratón y mando</span><div class="slot-titles"><span>Ratón</span><span>Mando</span></div>';
    this.listContainer.appendChild(head);

    const rows = [
      ['arrow-right', 'Moverse', null, 'Stick / Cruceta'],
      ['jump', 'Saltar', null, null, 'jump'],
      ['sword', 'Golpear (Ataque)', 'Clic Izquierdo', null, 'attack'],
      ['grab', 'Agarrar / Lanzar Objeto', 'Clic Derecho', null, 'grab'],
      ['potion', 'Beber Poción de Regeneración', null, null, 'potion'],
      ['scroll', 'Interactuar / Hablar / Abrir', null, null, 'interact'],
      ['scroll', 'Leer nota de Angelo', 'Arriba (↑ / W)', 'Stick / Cruceta arriba'],
      ['wind', 'Jalar / Soplar el Aire', null, 'Abajo/Arriba + L2'],
      ['wind', 'Apuntar el aire', 'Mover el ratón', 'Stick derecho'],
      ['water', 'Dominio del Agua (cerca del agua)', 'Apuntar: ratón', 'L2 · stick der.'],
      ['water', 'Esfera guiada (tras mejorar)', null, 'L3 · stick izq.'],
      ['earth', 'Tierra: pilar de roca (antes de aprenderla, ataca) · apuntá con el stick der.', 'Apuntar: ratón', null, 'earth'],
      ['book', 'Mapa del Reino', 'M (teclado)', 'R3'],
      ['book', 'Diario de Ruben', 'I / Tab (teclado)', 'Select'],
      ['gear', 'Pausa', 'Esc (teclado)', 'Start'],
      ['gamepad', 'En menús: elegir / volver', 'Clic', 'A (✕) / B (○)']
    ];
    for (const [ic, name, mouse, pad, padAction] of rows) {
      const row = document.createElement('div');
      row.className = 'control-row control-row-fixed';
      const labelDiv = document.createElement('div');
      labelDiv.className = 'control-label';
      labelDiv.innerHTML = `<span class="action-icon">${icon(ic)}</span><span class="action-name"></span>`;
      labelDiv.querySelector('.action-name').textContent = name;
      row.appendChild(labelDiv);
      const slotsDiv = document.createElement('div');
      slotsDiv.className = 'control-slots';
      for (const val of [mouse, pad]) {
        const slot = document.createElement('div');
        slot.className = 'btn-key-slot fixed' + (val ? '' : ' empty');
        slot.textContent = val || '—';
        slot.title = val || '';
        slotsDiv.appendChild(slot);
      }
      if (padAction) {
        // Botón del mando reasignable: elegilo (clic o A) y pulsá el botón nuevo en el mando
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-key-slot pad-slot';
        btn.dataset.action = padAction;
        btn.dataset.slot = 'pad';
        const txt = this.getPadDisplay(padAction);
        btn.textContent = txt || '---';
        btn.title = 'Elegilo y pulsá un botón del mando para cambiarlo';
        if (!txt) btn.classList.add('empty');
        if (this.listeningSlot && this.listeningSlot.pad && this.listeningSlot.actionId === padAction) {
          btn.classList.add('listening');
          btn.textContent = 'Pulsa botón...';
        }
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.startListening(padAction, 'pad', btn);
        });
        slotsDiv.replaceChild(btn, slotsDiv.lastChild);
      }
      row.appendChild(slotsDiv);
      this.listContainer.appendChild(row);
    }
  }

  /**
   * Actualiza la pista del cuadro de diálogo con las teclas asignadas
   */
  updateControlsGuideUI() {
    // Actualizar pista en el diálogo de notas
    const dialogHint = document.querySelector('.dialog-hint');
    if (dialogHint) {
      dialogHint.textContent = '[Acercate para interactuar · Alejate para cerrar]';
    }
  }
}
