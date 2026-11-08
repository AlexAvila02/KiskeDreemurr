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
        icon: '←',
        defaultKeys: ['KeyA', 'ArrowLeft']
      },
      {
        id: 'moveRight',
        name: 'Mover Derecha',
        icon: '→',
        defaultKeys: ['KeyD', 'ArrowRight']
      },
      {
        id: 'jump',
        name: 'Saltar / Doble Salto',
        icon: '🦘',
        defaultKeys: ['Space', 'KeyX']
      },
      {
        id: 'aimUp',
        name: 'Apuntar Arriba (mantener + atacar)',
        icon: '↑',
        defaultKeys: ['KeyW', 'ArrowUp']
      },
      {
        id: 'aimDown',
        name: 'Apuntar Abajo (mantener + atacar)',
        icon: '↓',
        defaultKeys: ['KeyS', 'ArrowDown']
      },
      {
        id: 'attack',
        name: 'Atacar (Espada)',
        icon: '⚔️',
        defaultKeys: ['KeyJ', 'KeyZ']
      },
      {
        id: 'grab',
        name: 'Agarrar / Lanzar',
        icon: '🪨',
        defaultKeys: ['KeyK', 'KeyC']
      },
      {
        id: 'interact',
        name: 'Interactuar / Leer / Abrir',
        icon: '📜',
        defaultKeys: ['KeyE', 'Enter']
      }
    ];

    // Mapeo actual: { [actionId]: [key1, key2] }
    this.bindings = {};

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
   * Devuelve un texto con las teclas asignadas a una acción (ej: "A / ←")
   */
  getDisplayKeysText(actionId) {
    const keys = this.bindings[actionId] || [];
    const names = keys.filter(k => !!k).map(k => this.formatKeyName(k));
    return names.length > 0 ? names.join(' / ') : 'Sin asignar';
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

      const { actionId, slotIndex } = this.listeningSlot;

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

    this.listeningSlot = { actionId, slotIndex, buttonElement };
    buttonElement.classList.add('listening');
    buttonElement.textContent = 'Pulsa tecla...';
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
  }

  /**
   * Actualiza dinámicamente la guía de controles de la pantalla de inicio y el HUD
   */
  updateControlsGuideUI() {
    const guide = document.querySelector('.controls-guide');
    if (guide) {
      const leftRight = `${this.getDisplayKeysText('moveLeft')} / ${this.getDisplayKeysText('moveRight')}`;
      const jump = this.getDisplayKeysText('jump');
      const attack = this.getDisplayKeysText('attack');
      const grab = this.getDisplayKeysText('grab');
      const interact = this.getDisplayKeysText('interact');

      guide.innerHTML = `
        <div class="control-key"><span>${leftRight}</span> Moverse</div>
        <div class="control-key"><span>${jump}</span> Saltar & Doble Salto</div>
        <div class="control-key"><span>${attack} / Clic Izq</span> Golpear (Ataque)</div>
        <div class="control-key"><span>${grab} / Clic Der</span> Agarrar / Lanzar Objeto</div>
        <div class="control-key"><span>${interact}</span> Interactuar / Leer / Abrir Puertas</div>
        <div class="control-key">🎮 <span>Stick / Cruceta</span> Moverse · <span>A</span> Saltar · <span>X</span> Atacar · <span>B</span> Agarrar · <span>Y</span> Leer/Abrir</div>
      `;
    }

    // Actualizar pista en el diálogo de notas
    const dialogHint = document.querySelector('.dialog-hint');
    if (dialogHint) {
      const interactKey = this.getPrimaryDisplayKey('interact');
      const jumpKey = this.getPrimaryDisplayKey('jump');
      dialogHint.textContent = `[Presiona ${interactKey} o ${jumpKey} para cerrar]`;
    }
  }
}
