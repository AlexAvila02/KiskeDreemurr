/**
 * Motor Principal del Juego - Ruben: En Busca de Angelo
 * Manejo del bucle de animación, eventos de entrada, cámara fluida, HUD e interacciones.
 */

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Instancias de juego
    this.world = new World();
    this.player = new Player(80, 410);
    this.enemies = [];
    this.debrisItems = [];

    // Cámara con suavizado
    this.camera = { x: 0, y: 0 };
    this.screenShakeTime = 0;
    this.screenShakeIntensity = 0;

    // Entradas
    this.keys = {};
    this.visitedRooms = new Set([0]);

    // UI Elements
    this.healthBar = document.getElementById('health-bar');
    this.keyCount = document.getElementById('key-count');
    this.carryText = document.getElementById('carry-text');
    this.carryIndicator = document.getElementById('carry-indicator');
    this.zoneTag = document.getElementById('zone-tag');
    this.miniMap = document.getElementById('mini-map');
    this.dialogBox = document.getElementById('dialog-box');
    this.dialogSpeaker = document.getElementById('dialog-speaker');
    this.dialogText = document.getElementById('dialog-text');
    this.overlayScreen = document.getElementById('overlay-screen');
    this.btnStart = document.getElementById('btn-start');
    this.notification = document.getElementById('notification');
    this.notificationTimer = null;

    this.isPlaying = false;
    this.isPaused = false;
    this.activeInteraction = null;

    // Elementos de Pausa y Configuración de Controles
    this.pauseModal = document.getElementById('pause-modal');
    this.btnHudPause = document.getElementById('btn-hud-pause');
    this.btnOpenControls = document.getElementById('btn-open-controls-menu');
    this.btnPauseResume = document.getElementById('btn-pause-resume');
    this.btnPauseControls = document.getElementById('btn-pause-controls');
    this.btnPauseRestart = document.getElementById('btn-pause-restart');
    this.btnPauseMenu = document.getElementById('btn-pause-menu');
    this.btnPauseNewGame = document.getElementById('btn-pause-newgame');

    // Gestor de Controles Personalizados
    this.controlsManager = new ControlsManager(this);

    // Paso fijo de simulación (60 actualizaciones/seg en cualquier monitor)
    this.STEP = 1000 / 60;
    this.accumulator = 0;
    this.respawnPoint = { x: 80, y: 410 };
    this.deathTimer = 0;      // cuadros restantes de la animación de muerte
    this.DEATH_FRAMES = 75;

    // Pulido de animación / "game feel"
    this.hitStopFrames = 0;               // congelamiento breve al conectar golpes
    this.shake = { x: 0, y: 0 };          // desplazamiento de vibración (no altera la cámara real)
    this.screenShakeDuration = 1;
    this.camLook = 0;                     // anticipación de cámara hacia donde mira Ruben
    this.irisOpen = 0;                    // transición circular de apertura (1 -> 0)
    this.IRIS_FRAMES = 34;
    this.damageFlash = 0;                 // viñeta roja al recibir daño
    this.typeInterval = null;             // efecto máquina de escribir en las notas
    this.dialogTyping = false;

    this.init();
  }

  // Nombres de todos los GameHooks (arreglos de funciones). Contrato:
  //  onInit(game)                                  una vez, al crear el juego
  //  onBeforeUpdate(game, running)                 cada cuadro, antes de la lógica (también en pausa)
  //  onAfterUpdate(game, running)                  cada cuadro, después de la lógica (también en pausa)
  //  onUpdate(game, dt)                            (antiguo) cada cuadro, después de onAfterUpdate
  //  onAction(game, action) → true                 consume la acción (no llega a main ni a los demás)
  //  onBeforeRoomLoad(game, index, sx, sy)         antes de cambiar de sala
  //  onRoomLoad(game, room, index, prevIndex, sx, sy)  después de cambiar de sala
  //  onFreezeInput(game) → true                    Ruben no recibe teclas este cuadro
  //  onAfterPlayerUpdate(game)                     después de mover a Ruben (antes de salidas)
  //  onBlockExits(game) → true                     no revisar salidas de sala este cuadro
  //  onKeepDialog(game) → true                     no cerrar el diálogo abierto por distancia
  //  onBeforeTogglePause(game, force) → true       consume la pausa (p. ej. cerrar el Diario)
  //  onPlayerHurt(game, amount)                    Ruben recibió daño (player.takeDamage)
  //  onRestartGame(game)                           "Reiniciar juego": borrar progreso propio
  //  onRenderWorld(game, ctx, cam) · onRenderHUD   dibujo
  static get NO_KEYS() { return Game._noKeys || (Game._noKeys = Object.freeze({})); }

  static get HOOK_NAMES() {
    return ['onInit', 'onBeforeUpdate', 'onAfterUpdate', 'onUpdate', 'onAction', 'onBeforeRoomLoad',
      'onRoomLoad', 'onFreezeInput', 'onAfterPlayerUpdate', 'onBlockExits', 'onKeepDialog',
      'onBeforeTogglePause', 'onPlayerHurt', 'onRestartGame', 'onRenderWorld', 'onRenderHUD',
      'onEnemyTarget'];
  }

  // A quién persigue/ataca un enemigo este cuadro: el primer hook onEnemyTarget que devuelva
  // un objeto con { x, y, width, height, takeDamage } (multijugador: el jugador más cercano)
  enemyTarget(enemy) {
    const list = window.GameHooks && window.GameHooks.onEnemyTarget;
    if (list && list.length) {
      for (let i = 0; i < list.length; i++) {
        try { const t = list[i](this, enemy); if (t) return t; } catch (e) { console.error('[GameHooks.onEnemyTarget]', e); }
      }
    }
    return this.player;
  }

  // Llama a todos los hooks `name` (un error en uno no frena a los demás)
  runHooks(name, ...args) {
    const list = window.GameHooks && window.GameHooks[name];
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try { list[i](this, ...args); } catch (e) { console.error(`[GameHooks.${name}]`, e); }
    }
  }
  // Como runHooks, pero se detiene en el primero que devuelve true (y devuelve true)
  runHooksUntil(name, ...args) {
    const list = window.GameHooks && window.GameHooks[name];
    if (!list) return false;
    for (let i = 0; i < list.length; i++) {
      try { if (list[i](this, ...args) === true) return true; } catch (e) { console.error(`[GameHooks.${name}]`, e); }
    }
    return false;
  }

  init() {
    window.gameInstance = this;

    // Hooks globales: los módulos (js/*.js) se enganchan acá en vez de reemplazar funciones
    // del juego. Lista completa y contrato de cada uno: ver MAPA.md → "GameHooks".
    window.GameHooks = window.GameHooks || {};
    for (const name of Game.HOOK_NAMES) {
      if (!Array.isArray(window.GameHooks[name])) window.GameHooks[name] = [];
    }

    // Cargar sala inicial
    this.loadRoom(0);
    this.setupInputs();
    this.setupGamepad();
    this.updateHUD();
    this.renderMiniMap();

    for (const fn of window.GameHooks.onInit) {
      try { fn(this); } catch (e) { console.error(e); }
    }

    // Botón de Inicio
    this.btnStart.addEventListener('click', () => {
      window.soundManager.init();
      this.overlayScreen.classList.add('hidden');
      this.isPlaying = true;
      this.irisOpen = 1; // apertura en iris al comenzar
      this.showNotification("Seguí las notas de Angelo...");
    });

    // Botón de Modificar Controles desde la Pantalla de Inicio
    if (this.btnOpenControls) {
      this.btnOpenControls.addEventListener('click', () => {
        window.soundManager.init();
        this.controlsManager.openModal();
      });
    }

    // Botón de Pausa en el HUD
    if (this.btnHudPause) {
      this.btnHudPause.addEventListener('click', () => {
        this.togglePause();
      });
    }

    // Botones del Menú de Pausa
    if (this.btnPauseResume) {
      this.btnPauseResume.addEventListener('click', () => {
        this.togglePause(false);
      });
    }

    if (this.btnPauseControls) {
      this.btnPauseControls.addEventListener('click', () => {
        if (this.pauseModal) this.pauseModal.classList.add('hidden');
        this.controlsManager.openModal();
      });
    }

    if (this.btnPauseRestart) {
      this.btnPauseRestart.addEventListener('click', () => {
        this.togglePause(false);
        this.restartRoom();
      });
    }

    // Reiniciar juego: pide confirmación (segundo clic / segundo A) porque borra todo el progreso
    if (this.btnPauseNewGame) {
      const label = this.btnPauseNewGame.querySelector('.btn-label') || this.btnPauseNewGame;
      const disarm = () => {
        this.newGameArmedUntil = 0;
        this.btnPauseNewGame.classList.remove('btn-confirm');
        label.textContent = 'REINICIAR JUEGO';
      };
      this.btnPauseNewGame.addEventListener('click', () => {
        if (Date.now() < (this.newGameArmedUntil || 0)) {
          disarm();
          this.togglePause(false);
          this.restartGame();
          return;
        }
        this.newGameArmedUntil = Date.now() + 4000;
        this.btnPauseNewGame.classList.add('btn-confirm');
        label.textContent = '¿SEGURO? SE BORRA TODO';
        clearTimeout(this.newGameDisarmTimer);
        this.newGameDisarmTimer = setTimeout(disarm, 4000);
      });
      this.disarmNewGame = disarm;
    }

    if (this.btnPauseMenu) {
      this.btnPauseMenu.addEventListener('click', () => {
        this.togglePause(false);
        this.isPlaying = false;
        this.overlayScreen.classList.remove('hidden');
      });
    }

    // Arrancar el ciclo de render
    requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  loadRoom(index, spawnX = null, spawnY = null) {
    const prevIndex = this.world.currentRoomIndex;
    this.runHooks('onBeforeRoomLoad', index, spawnX, spawnY);
    this.loadRoomCore(index, spawnX, spawnY);
    this.runHooks('onRoomLoad', this.world.getCurrentRoom(), index, prevIndex, spawnX, spawnY);
  }

  loadRoomCore(index, spawnX, spawnY) {
    this.world.currentRoomIndex = index;
    this.visitedRooms.add(index);
    const room = this.world.getCurrentRoom();

    if (spawnX !== null && spawnY !== null) {
      this.player.x = spawnX;
      this.player.y = spawnY;
      this.player.vx = 0;
      this.player.vy = 0;
    }
    // Ruben reaparece donde entró a esta sala
    this.respawnPoint = { x: this.player.x, y: this.player.y };
    // Cámara directo a Ruben (sin barrido desde la sala anterior)
    this.camLook = this.player.facing * 40;
    this.camera.x = Math.max(0, Math.min(room.width - this.canvas.width, this.player.x + this.camLook - this.canvas.width / 2));
    this.camera.y = Math.max(0, Math.min(room.height - this.canvas.height, this.player.y - this.canvas.height / 2));
    // Transición de iris (estilo cortometraje clásico) al entrar a la sala
    if (this.isPlaying) this.irisOpen = 1;

    // Instanciar enemigos y objetos de la sala
    this.enemies = room.spawnEnemies ? room.spawnEnemies() : [];
    this.debrisItems = room.spawnDebris ? room.spawnDebris() : [];
    this.activeNote = null;
    if (this.dialogBox) this.hideDialog();
    // Si Ruben llevaba una piedra, la lleva consigo a la nueva sala
    if (this.player.carriedItem) this.debrisItems.push(this.player.carriedItem);
    // Apagar partículas de la sala anterior sin vaciar el pool (vaciarlo crasheaba el juego)
    if (window.particleSystem.clear) window.particleSystem.clear();
    else if (window.particleSystem.particles) window.particleSystem.particles.length = 0;
    if (window.particleSystem.setBiome) window.particleSystem.setBiome(room.biome || 'pradera');
    if (window.soundManager.setBiomeAmbience) window.soundManager.setBiomeAmbience(room.biome || 'pradera');

    // Actualizar HUD
    this.zoneTag.textContent = room.name;
    this.retriggerClass(this.zoneTag, 'zone-reveal');
    this.renderMiniMap();
  }

  // Reinicia una animación CSS quitando y volviendo a poner la clase
  retriggerClass(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // fuerza reflow para que la animación arranque de nuevo
    el.classList.add(cls);
  }

  // Congela la simulación unos cuadros para dar peso a los impactos
  hitStop(frames = 4) {
    this.hitStopFrames = Math.max(this.hitStopFrames, frames);
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      // Si el gestor de controles está esperando una tecla para reasignar, no procesar el juego
      if (this.controlsManager && this.controlsManager.isListening()) {
        return;
      }

      // Tecla Escape para pausar o cerrar ventanas
      if (e.code === 'Escape') {
        if (this.controlsManager && this.controlsManager.isModalOpen()) {
          this.controlsManager.closeModal();
          return;
        }
        if (this.isPlaying) {
          this.togglePause();
          return;
        }
      }

      // Prevenir scroll en el navegador para teclas de control
      const prevent = this.controlsManager
        ? this.controlsManager.shouldPreventDefault(e.code)
        : ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code);
      if (prevent) e.preventDefault();

      this.keys[e.code] = true;

      // Pantalla de inicio: ENTER comienza (si no está abierto el menú de controles)
      if (!this.isPlaying && e.code === 'Enter' && !e.repeat) {
        const modalOpen = this.controlsManager && this.controlsManager.isModalOpen && this.controlsManager.isModalOpen();
        if (!modalOpen && !this.overlayScreen.classList.contains('hidden')) { e.preventDefault(); this.btnStart.click(); }
        return;
      }

      if (!this.isPlaying || this.isPaused) return;
      // Mantener apretada una tecla no repite saltos/ataques
      if (e.repeat) return;

      // Obtener acción correspondiente según la personalización de controles
      const action = this.controlsManager ? this.controlsManager.getActionForKey(e.code) : null;
      if (action) {
        this.doAction(action);
      } else {
        // Respaldo directo en caso de no haberse cargado el gestor
        if (['Space', 'KeyX'].includes(e.code)) this.doAction('jump');
        if (e.code === 'KeyJ' || e.code === 'KeyZ') this.doAction('attack');
        if (e.code === 'KeyK') this.doAction('grab');
        if (e.code === 'KeyE') this.doAction('interact');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Si la ventana pierde el foco, soltar todas las teclas (evita que Ruben siga caminando solo)
    window.addEventListener('blur', () => { this.keys = {}; });

    // Controles táctiles / de ratón en el canvas
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.isPaused) return;
      if (e.button === 0) this.doAction('attack');          // Clic izquierdo: atacar
      else if (e.button === 2) { e.preventDefault(); this.doAction('grab'); } // Clic derecho: agarrar/lanzar
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Alterna o fuerza el estado de pausa del juego
  togglePause(forceState = null) {
    if (!this.isPlaying || this.deathTimer > 0) return;
    if (this.runHooksUntil('onBeforeTogglePause', forceState)) return;

    if (forceState !== null) {
      this.isPaused = forceState;
    } else {
      this.isPaused = !this.isPaused;
    }

    if (this.disarmNewGame) this.disarmNewGame();
    if (this.isPaused) {
      if (this.pauseModal) this.pauseModal.classList.remove('hidden');
    } else {
      if (this.pauseModal) this.pauseModal.classList.add('hidden');
      if (this.controlsManager && this.controlsManager.isModalOpen()) {
        this.controlsManager.closeModal();
      }
    }
  }

  // Dirección en la que Ruben apunta al atacar (teclado o mando)
  getAim() {
    const cm = this.controlsManager;
    const k = this.keys;
    const on = (id, fallback) => cm ? cm.isActive(id, k) : fallback.some(c => k[c]);
    return {
      up: on('aimUp', ['KeyW', 'ArrowUp', 'PadUp']),
      down: on('aimDown', ['KeyS', 'ArrowDown', 'PadDown']),
      left: on('moveLeft', ['KeyA', 'ArrowLeft', 'PadLeft']),
      right: on('moveRight', ['KeyD', 'ArrowRight', 'PadRight'])
    };
  }

  // Acción del jugador (la usan teclado, mouse y mando)
  doAction(action) {
    if (!this.isPlaying || this.isPaused || this.deathTimer > 0) return;
    // Los módulos pueden consumir la acción (viento plantado, nado, NPC, esfera guiada...)
    if (this.runHooksUntil('onAction', action)) return;
    const dialogOpen = !this.dialogBox.classList.contains('hidden');

    // Con una nota abierta, saltar o interactuar la cierra; lo demás se ignora
    // Una nota visible no bloquea nada: se abre y se cierra sola por cercanía.
    // Solo "interactuar" sobre una nota que se está escribiendo la muestra completa.
    if (dialogOpen && action === 'interact' && this.dialogTyping) {
      this.finishTyping();
      return;
    }

    if (action === 'jump') this.player.jump();
    else if (action === 'attack') this.player.attack(this.enemies, this.getAim());
    else if (action === 'grab') this.player.interactOrThrow(this.debrisItems);
    else if (action === 'interact') this.checkInteractions();
  }

  // ===== Mando (Gamepad API, mapeo estándar Xbox / PlayStation) =====
  // A/✕ = saltar · X/□ = atacar · B/○ = agarrar/lanzar · Y/△ = leer/abrir
  // RB/R1 = atacar · LB/L1 = agarrar · Start = comenzar · stick izq. o cruceta = moverse
  setupGamepad() {
    this.padPrev = [];
    this.padIndex = null;
    this.PAD_BUTTONS = { 0: 'jump', 2: 'attack', 5: 'attack', 7: 'attack', 1: 'grab', 4: 'grab', 3: 'interact' };

    window.addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
      this.padPrev = [];
      this.showNotification('Mando conectado');
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index === this.padIndex) {
        this.padIndex = null;
        this.keys['PadLeft'] = this.keys['PadRight'] = false;
        this.showNotification('Mando desconectado');
      }
    });
  }

  getPad() {
    if (!navigator.getGamepads) return null;
    let pads;
    try { pads = navigator.getGamepads(); } catch (e) { return null; }
    if (!pads) return null;
    if (this.padIndex !== null && pads[this.padIndex] && pads[this.padIndex].connected) return pads[this.padIndex];
    // Algunos navegadores no avisan la conexión hasta tocar un botón: buscar cualquiera
    for (const p of pads) if (p && p.connected) { this.padIndex = p.index; this.padPrev = []; return p; }
    return null;
  }

  // Indicador en pantalla: muestra si hay mando y si el navegador lo reconoce como estándar
  updatePadBadge(pad) {
    if (!this.padBadge) {
      this.padBadge = document.createElement('div');
      this.padBadge.style.cssText = 'position:absolute;left:50%;bottom:10px;transform:translateX(-50%);' +
        'font:600 12px Outfit,sans-serif;padding:4px 10px;border-radius:12px;pointer-events:none;' +
        'background:rgba(58,36,22,.75);color:#f9efd8;transition:opacity .6s;z-index:50';
      const host = document.getElementById('game-container') || document.body;
      host.appendChild(this.padBadge);
    }
    const id = pad ? (pad.id || 'mando') + '|' + pad.mapping : '';
    if (id === this.padBadgeId) return;
    this.padBadgeId = id;
    if (!pad) {
      this.padBadge.style.opacity = '0';
      return;
    }
    const name = String(pad.id || '').replace(/\(.*?\)/g, '').trim().slice(0, 40) || 'Mando';
    this.padBadge.textContent = name + (pad.mapping === 'standard' ? '' : ' · modo compatibilidad');
    if (window.UIIcons) this.padBadge.insertAdjacentHTML('afterbegin', UIIcons.svg('gamepad', 'ui-inline') + ' ');
    this.padBadge.style.opacity = '1';
    clearTimeout(this.padBadgeTimer);
    this.padBadgeTimer = setTimeout(() => { if (this.padBadge) this.padBadge.style.opacity = '0'; }, 4000);
    console.log('[Mando]', pad.id || '(sin nombre)', 'mapping=' + (pad.mapping || 'no estándar'), 'botones=' + pad.buttons.length, 'ejes=' + pad.axes.length);
  }

  pollGamepad() {
    const pad = this.getPad();
    this.updatePadBadge(pad);
    if (!pad) {
      if (this.keys['PadLeft'] || this.keys['PadRight'] || this.keys['PadUp'] || this.keys['PadDown']) {
        this.keys['PadLeft'] = this.keys['PadRight'] = this.keys['PadUp'] = this.keys['PadDown'] = false;
      }
      return;
    }

    const pressed = Array.from(pad.buttons, b => !!b && (b.pressed || b.value > 0.5));
    const justPressed = (i) => pressed[i] && !this.padPrev[i];
    const anyJust = pressed.some((v, i) => v && !this.padPrev[i]);

    // Movimiento: stick izquierdo con zona muerta, o cruceta
    const DEAD = 0.35;
    const ax = pad.axes[0] || 0;
    let left = ax < -DEAD || !!pressed[14];
    let right = ax > DEAD || !!pressed[15];

    // Mandos NO estándar (genéricos, algunos de PlayStation): la cruceta suele venir
    // como ejes 6/7 o como un "hat" en el eje 9
    if (pad.mapping !== 'standard') {
      const a6 = pad.axes[6], a9 = pad.axes[9];
      if (a6 !== undefined) { if (a6 < -0.5) left = true; if (a6 > 0.5) right = true; }
      if (a9 !== undefined && a9 >= -1.01 && a9 <= 1.01) {
        if (a9 > 0.3) left = true;                    // izquierda, abajo-izq, arriba-izq
        if (a9 < -0.2 && a9 > -0.9) right = true;     // derecha y diagonales derechas
      }
    }
    this.keys['PadLeft'] = left;
    this.keys['PadRight'] = right;

    // Apuntar arriba/abajo: stick izquierdo vertical o cruceta
    const ay = pad.axes[1] || 0;
    let up = ay < -0.5 || !!pressed[12];
    let down = ay > 0.5 || !!pressed[13];
    if (pad.mapping !== 'standard') {
      const a7 = pad.axes[7], a9 = pad.axes[9];
      if (a7 !== undefined) { if (a7 < -0.5) up = true; if (a7 > 0.5) down = true; }
      if (a9 !== undefined && a9 >= -1.01 && a9 <= 1.01) {
        if (a9 < -0.6 || a9 > 0.9) up = true;          // arriba y diagonales de arriba
        if (a9 > -0.3 && a9 < 0.6) down = true;        // abajo y diagonales de abajo
      }
    }
    this.keys['PadUp'] = up;
    this.keys['PadDown'] = down;

    const modalOpen = this.controlsManager && this.controlsManager.isModalOpen && this.controlsManager.isModalOpen();

    // Menús (inicio, pausa, controles): navegación con stick/cruceta, A elige, B vuelve (js/menu-nav.js)
    if (this.menuNav && this.menuNav.handlePad(pressed, this.padPrev)) {
      // el menú consumió el mando
    } else if (modalOpen) {
      // Con el menú de controles abierto, B o Start lo cierran
      if (justPressed(1) || justPressed(9)) {
        this.controlsManager.closeModal();
        if (this.isPaused && this.pauseModal) this.pauseModal.classList.remove('hidden');
      }
    } else if (!this.isPlaying) {
      // Pantalla de inicio: cualquier botón comienza
      if (anyJust) this.btnStart.click();
    } else if (this.isPaused) {
      if (justPressed(0) || justPressed(9) || justPressed(1)) this.togglePause(false);
    } else if (justPressed(9) || justPressed(8)) {
      // Start (o Select) pausa
      this.togglePause();
    } else {
      for (const i in this.PAD_BUTTONS) {
        if (justPressed(+i)) this.doAction(this.PAD_BUTTONS[i]);
      }
    }
    this.padPrev = pressed;
  }

  // Vibración del mando (si el mando y el navegador la soportan)
  rumble(strength = 0.5, durationMs = 150) {
    const pad = this.getPad();
    const act = pad && pad.vibrationActuator;
    if (!act || !act.playEffect) return;
    try {
      act.playEffect('dual-rumble', {
        duration: durationMs,
        strongMagnitude: Math.min(1, strength),
        weakMagnitude: Math.min(1, strength * 0.6)
      });
    } catch (e) { /* sin vibración */ }
  }

  // Oculta la nota de Angelo al alejarse. Ya NO se abre sola al pasar por encima
  // (pedido del usuario, 9/11): se abre con ARRIBA desde js/npcs.js (cartel "↑ Leer").
  updateNearbyNote() {
    // Un módulo puede mantener su diálogo abierto (NPC hablando, escena del maestro...)
    if (this.activeNote && this.runHooksUntil('onKeepDialog')) return;
    const room = this.world.getCurrentRoom();
    const px = this.player.x + this.player.width / 2;
    const py = this.player.y + this.player.height / 2;

    let near = null;
    if (!this.player.dead) {
      for (const tab of room.tablets || []) {
        if (Math.abs(px - (tab.x + 11)) < 38 && Math.abs(py - (tab.y + 17)) < 46) { near = tab; break; }
      }
    }

    if (near) {
      // Cerca de una nota: si está abierta se mantiene; si no, solo se ve el cartel.
      // Si había otro texto abierto (otra nota, un NPC), se cierra.
      if (this.activeNote && this.activeNote !== near && this.activeNote !== room.door) {
        this.activeNote = null;
        this.hideDialog();
      }
      return;
    }

    // El mensaje del portón también se cierra solo al alejarse
    if (this.activeNote && this.activeNote === room.door) {
      const d = room.door;
      const nx = Math.max(d.x, Math.min(px, d.x + d.width));
      const ny = Math.max(d.y, Math.min(py, d.y + d.height));
      if (Math.hypot(px - nx, py - ny) < 90) return;
    }

    if (this.activeNote) {
      this.activeNote = null;
      this.hideDialog();
    }
  }

  hideDialog() {
    if (this.typeInterval) clearInterval(this.typeInterval);
    this.dialogTyping = false;
    this.dialogBox.classList.add('hidden');
    this.placeNotification();
  }

  // Diálogo y aviso ocupan el mismo lugar (arriba al centro). Si hay un diálogo abierto,
  // el aviso baja a la parte inferior para que no se encimen.
  placeNotification() {
    if (!this.notification) return;
    const dialogOpen = !!this.dialogBox && !this.dialogBox.classList.contains('hidden');
    this.notification.classList.toggle('notif-low', dialogOpen);
  }

  checkInteractions() {
    const room = this.world.getCurrentRoom();
    const px = this.player.x + this.player.width / 2;
    const py = this.player.y + this.player.height / 2;

    // 1. Revisar notas de Angelo
    // (Las notas de Angelo se abren con ARRIBA: ver js/npcs.js)

    // 2. Revisar puerta sellada
    if (room.door && room.door.isLocked) {
      // Distancia al rectángulo de la puerta (no a su centro: la puerta es muy alta)
      const d = room.door;
      const nx = Math.max(d.x, Math.min(px, d.x + d.width));
      const ny = Math.max(d.y, Math.min(py, d.y + d.height));
      if (Math.hypot(px - nx, py - ny) < 50) {
        if (this.player.keys >= room.door.requiredKeys) {
          room.door.isLocked = false;
          room.door.openedAt = Date.now(); // dispara la animación de apertura (js/world.js)
          window.soundManager.playDoorUnlock();
          this.triggerScreenShake(8, 250);
          this.showNotification("¡El Portón Norte se abrió!");
        } else {
          this.activeNote = room.door;
          this.showDialog(
            "Portón Cerrado",
            "El Portón Norte está trabado con candado. Angelo dejó la llave en lo alto del molino."
          );
        }
        return;
      }
    }
  }

  // Ruben muere (por vida en 0 o por caer al vacío)
  killPlayer(cause = 'hit') {
    if (this.deathTimer > 0) return;
    const p = this.player;
    p.dead = true;
    p.hp = 0;
    this.deathTimer = this.DEATH_FRAMES;
    this.deathCause = cause;
    if (p.startDeath) p.startDeath();
    // Punto central de la transición de cierre (donde cayó Ruben, dentro de pantalla)
    this.deathFocus = {
      x: Math.max(40, Math.min(this.canvas.width - 40, p.x + p.width / 2 - this.camera.x)),
      y: Math.max(40, Math.min(this.canvas.height - 40, p.y + p.height / 2 - this.camera.y))
    };
    if (cause !== 'fall') {
      window.particleSystem.createHitImpact(p.x + p.width / 2, p.y + p.height / 2, 24);
      window.particleSystem.createDust(p.x + p.width / 2, p.y + p.height / 2, 16, '#d9a634');
    }
    window.soundManager.playHit();
    this.triggerScreenShake(9, 300);
    this.updateHUD();
  }

  // Reinicia la partida completa: mundo nuevo (llave, portón y muros como al principio),
  // Ruben en la primera sala y GameHooks.onRestartGame para que los módulos borren su progreso
  restartGame() {
    // Mundo nuevo: World.registerRoom copia la configuración de cada sala, así que muros,
    // objetos, campanas, NPC, etc. vuelven solos a como estaban al principio
    this.world = new World();
    const p = this.player;
    if (p.carriedItem) { p.carriedItem.isCarried = false; p.carriedItem = null; }
    p.keys = 0;
    p.dead = false;
    p.vx = 0;
    p.vy = 0;
    p.facing = 1;
    p.isAttacking = false;
    p.attackTimer = 0;
    p.attackCooldown = 0;
    p.invulnerableTimer = 60;
    this.deathTimer = 0;
    this.hitStopFrames = 0;
    this.deathCause = null;
    this.visitedRooms = new Set();
    this.runHooks('onRestartGame');
    p.hp = p.maxHp;
    this.loadRoom(0, 80, 410);
    this.irisOpen = 1;
    this.updateHUD();
    this.showNotification('Nueva partida · Seguí las notas de Angelo...');
  }

  // Reinicia la sala actual: enemigos y piedras vuelven a su lugar, Ruben con vida completa
  restartRoom() {
    const p = this.player;
    if (p.carriedItem) { p.carriedItem.isCarried = false; p.carriedItem = null; }
    p.dead = false;
    p.hp = p.maxHp;
    p.invulnerableTimer = 60;
    p.isAttacking = false;
    p.attackTimer = 0;
    p.vx = 0;
    p.vy = 0;   // (antes reaparecía con la velocidad de la caída que lo mató)
    p.jumpBuffer = 0;
    const rp = this.respawnPoint;
    this.loadRoom(this.world.currentRoomIndex, rp.x, rp.y);
    this.showNotification(this.deathCause === 'fall' ? 'Ruben cayó al vacío... vuelve a intentarlo' : 'Ruben vuelve a levantarse...');
    this.updateHUD();
  }

  showDialog(speaker, text, auto = false) {
    this.dialogSpeaker.textContent = speaker;
    this.dialogBox.classList.remove('hidden', 'typed');
    this.dialogBox.classList.toggle('auto', !!auto);
    this.placeNotification(); // el aviso (si sigue en pantalla) se mueve abajo, no se encima
    this.retriggerClass(this.dialogBox, 'dialog-pop');
    window.soundManager.playPickup();

    // Efecto máquina de escribir: el texto restante queda invisible para que
    // el cuadro tenga su tamaño final desde el principio (sin saltos de diseño).
    if (this.typeInterval) clearInterval(this.typeInterval);
    this.dialogFullText = text;
    this.dialogText.innerHTML = '';
    const shown = document.createElement('span');
    const ghost = document.createElement('span');
    ghost.className = 'dialog-ghost';
    ghost.textContent = text;
    this.dialogText.append(shown, ghost);
    this.dialogTyping = true;
    let i = 0;
    this.typeInterval = setInterval(() => {
      i = Math.min(text.length, i + 2);
      shown.textContent = text.slice(0, i);
      ghost.textContent = text.slice(i);
      if (i >= text.length) this.finishTyping();
    }, 24);
  }

  // Completa el texto de la nota de inmediato
  finishTyping() {
    if (this.typeInterval) clearInterval(this.typeInterval);
    this.typeInterval = null;
    this.dialogTyping = false;
    this.dialogText.textContent = this.dialogFullText || this.dialogText.textContent;
    this.dialogBox.classList.add('typed');
  }

  showNotification(msg) {
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notification.textContent = msg;
    this.placeNotification();
    this.notification.classList.remove('hidden');
    this.retriggerClass(this.notification, 'notify-pop');
    this.notificationTimer = setTimeout(() => {
      this.notification.classList.add('hidden');
    }, 3200);
  }

  triggerScreenShake(intensity = 6, durationMs = 150) {
    // No pisar una vibración más fuerte que todavía está en curso
    if (this.screenShakeTime > 0 && intensity < this.screenShakeIntensity * (this.screenShakeTime / this.screenShakeDuration)) return;
    this.screenShakeIntensity = intensity;
    this.screenShakeTime = durationMs;
    this.screenShakeDuration = durationMs;
    this.rumble(intensity / 10, durationMs);
  }

  // Vibración con caída cuadrática (fuerte al inicio, se apaga suave)
  updateShake() {
    if (this.screenShakeTime > 0) {
      this.screenShakeTime -= this.STEP;
      const k = Math.max(0, this.screenShakeTime / this.screenShakeDuration);
      const amp = this.screenShakeIntensity * k * k;
      this.shake.x = (Math.random() - 0.5) * 2 * amp;
      this.shake.y = (Math.random() - 0.5) * 2 * amp;
    } else {
      this.shake.x = this.shake.y = 0;
    }
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - 0.05);
  }

  updateHUD() {
    // Corazones de salud: se actualizan en el lugar para poder animar pérdidas y curaciones
    const maxHp = this.player.maxHp, hp = this.player.hp;
    if (this.healthBar.children.length !== maxHp) {
      this.healthBar.innerHTML = '';
      for (let i = 0; i < maxHp; i++) {
        const mask = document.createElement('div');
        mask.className = 'mask-node' + (i < hp ? ' active' : '');
        this.healthBar.appendChild(mask);
      }
    } else {
      let gainedIndex = 0;
      Array.from(this.healthBar.children).forEach((node, i) => {
        const active = i < hp;
        const was = node.classList.contains('active');
        if (was && !active) {
          node.classList.remove('active', 'gained');
          this.retriggerClass(node, 'lost');
        } else if (!was && active) {
          node.classList.remove('lost');
          node.classList.add('active');
          node.style.animationDelay = `${gainedIndex++ * 70}ms`; // se rellenan en cascada
          this.retriggerClass(node, 'gained');
        }
      });
    }

    // Llaves (pulso al conseguir una nueva)
    if (this.lastKeyCount !== undefined && this.player.keys > this.lastKeyCount) {
      this.retriggerClass(this.keyCount.parentElement, 'slot-pulse');
    }
    this.lastKeyCount = this.player.keys;
    this.keyCount.textContent = `${this.player.keys}/1`;

    // Objeto agarrado
    const carrying = !!this.player.carriedItem;
    if (carrying !== this.lastCarrying) {
      this.carryIndicator.classList.toggle('is-active', carrying);
      if (carrying) this.retriggerClass(this.carryIndicator, 'slot-pulse');
      this.lastCarrying = carrying;
    }
    this.carryText.textContent = carrying ? 'Roca Lista' : 'Vacío';
  }

  renderMiniMap() {
    this.miniMap.innerHTML = '';
    const totalRooms = Math.max(4, this.world.rooms.length);
    for (let i = 0; i < totalRooms; i++) {
      if (!this.world.rooms[i]) continue;
      const cell = document.createElement('div');
      cell.className = 'map-cell';
      if (this.visitedRooms.has(i)) cell.classList.add('visited');
      if (this.world.currentRoomIndex === i) cell.classList.add('current');
      this.miniMap.appendChild(cell);
    }
  }

  checkRoomExits() {
    if (this.runHooksUntil('onBlockExits')) return;
    const room = this.world.getCurrentRoom();
    const px = this.player.x + this.player.width / 2;
    const py = this.player.y + this.player.height / 2;

    for (const exit of room.exits) {
      // Las salidas pegadas al borde izquierdo/derecho funcionan a cualquier altura:
      // si Ruben cruza el borde saltando, igual cambia de sala (antes pasaba por
      // encima de la zona, salía del mapa y "caía al vacío").
      const EDGE = 8;
      const leftEdge = exit.x <= EDGE;
      const rightEdge = exit.x + exit.w >= room.width - EDGE;
      let inside;
      if (leftEdge) inside = px <= exit.x + exit.w && py <= exit.y + exit.h;
      else if (rightEdge) inside = px >= exit.x && py <= exit.y + exit.h;
      else inside = px >= exit.x && px <= exit.x + exit.w && py >= exit.y && py <= exit.y + exit.h;
      if (inside) {
        this.loadRoom(exit.targetRoom, exit.targetX, exit.targetY);
        return;
      }
    }

    // Verificar recolección de Llave
    if (room.keyItem && !room.keyItem.collected) {
      if (Math.hypot(px - (room.keyItem.x + 10), py - (room.keyItem.y + 10)) < 30) {
        room.keyItem.collected = true;
        this.player.keys++;
        window.soundManager.playPickup();
        window.particleSystem.createDoubleJumpSparks(room.keyItem.x, room.keyItem.y);
        this.showNotification("¡Encontraste la llave que dejó Angelo!");
        this.updateHUD();
      }
    }
  }

  // Cuadro de lógica: hooks antes/después (también en pausa, para sonidos ambiente) y la
  // lógica del juego solo si está corriendo
  update(dt) {
    const running = this.isPlaying && !this.isPaused;
    this.runHooks('onBeforeUpdate', running);
    if (running) this.updateCore(dt);
    this.runHooks('onAfterUpdate', running);
    this.runHooks('onUpdate', dt);
  }

  updateCore(dt) {
    if (this.irisOpen > 0) this.irisOpen = Math.max(0, this.irisOpen - 1 / this.IRIS_FRAMES);
    // El mundo se congela mientras se lee una nota
    // (Las notas ya no pausan el juego: se leen mientras Ruben sigue moviéndose)

    // Animación de muerte: el mundo sigue de fondo, Ruben no se controla
    if (this.deathTimer > 0) {
      this.deathTimer--;
      if (this.player.updateDeath) this.player.updateDeath();
      window.particleSystem.update();
      this.updateShake();
      if (this.deathTimer === 0) this.restartRoom();
      return;
    }

    // Hit-stop: todo se detiene un instante (la vibración sigue para vender el golpe)
    if (this.hitStopFrames > 0) {
      this.hitStopFrames--;
      this.updateShake();
      return;
    }

    const room = this.world.getCurrentRoom();

    // Actualizar Ruben pasando el gestor de controles para movimiento dinámico.
    // Un módulo puede congelar sus teclas (viento, esfera guiada, animación de llegada).
    const frozen = this.runHooksUntil('onFreezeInput');
    this.player.update(this.world, frozen ? Game.NO_KEYS : this.keys, this.controlsManager);
    this.runHooks('onAfterPlayerUpdate');

    // Ruben no puede salir del mapa por los costados (solo por las salidas)
    const p = this.player;
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x + p.width > room.width) { p.x = room.width - p.width; p.vx = 0; }

    // Notas de Angelo por cercanía
    this.updateNearbyNote();

    // Las salidas se revisan antes que la caída, para no morir al cruzar un borde
    const roomBefore = this.world.currentRoomIndex;
    this.checkRoomExits();
    if (this.world.currentRoomIndex !== roomBefore) return;

    // Caída al vacío = muerte
    if (this.player.y > room.height + 20) {
      this.killPlayer('fall');
      return;
    }

    // Actualizar Enemigos
    for (const enemy of this.enemies) {
      enemy.update(this.world, this.enemyTarget(enemy));
    }

    // Actualizar Escombros Arrojables
    for (const item of this.debrisItems) {
      item.update(this.world, this.player, this.enemies);
    }

    // Actualizar Partículas
    window.particleSystem.update();

    // Si Ruben murió en este cuadro (golpe de un enemigo), no cambiar de sala:
    // tiene que reaparecer en la sala donde murió
    if (this.deathTimer > 0) return;

    // Punto de reaparición después de cruzar un portón abierto: si muere del otro
    // lado, reaparece pasando la puerta y no al principio de la sala
    const door = room.door;
    if (door && !door.isLocked && this.player.isGrounded && !this.player.dead) {
      const pcx = this.player.x + this.player.width / 2;
      const past = door.x + door.width;
      const rp = this.respawnPoint;
      if (rp.x < door.x && pcx > past + 40) {
        this.respawnPoint = { x: past + 24, y: this.player.y };
      } else if (rp.x > past && pcx < door.x - 40) {
        this.respawnPoint = { x: door.x - 24 - this.player.width, y: this.player.y };
      }
    }

    // Comprobar transiciones de sala y llaves
    this.checkRoomExits();

    // Suavizado de Cámara centrado en Ruben, con anticipación hacia donde mira/corre
    const lookTarget = this.player.facing * 40 + this.player.vx * 6;
    this.camLook += (lookTarget - this.camLook) * 0.035;
    const fallLook = Math.max(0, this.player.vy - 4) * 8; // mira hacia abajo en caídas largas
    const targetCamX = this.player.x + this.player.width / 2 + this.camLook - this.canvas.width / 2;
    const targetCamY = this.player.y + this.player.height / 2 + fallLook - this.canvas.height / 2;

    this.camera.x += (targetCamX - this.camera.x) * 0.1;
    this.camera.y += (targetCamY - this.camera.y) * 0.1;

    // Límites de la cámara dentro de la sala
    this.camera.x = Math.max(0, Math.min(room.width - this.canvas.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(room.height - this.canvas.height, this.camera.y));

    // Vibración de pantalla (Screen Shake): se aplica al dibujar, sin desplazar la cámara real
    this.updateShake();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Cámara de dibujo = cámara real + vibración
    const cam = { x: this.camera.x + this.shake.x, y: this.camera.y + this.shake.y };

    // 1. Renderizar Mundo y Plataformas
    this.world.render(ctx, cam);


    // 2. Renderizar Partículas de Fondo
    window.particleSystem.render(ctx, cam);

    // 3. Renderizar Escombros
    for (const item of this.debrisItems) {
      item.render(ctx, cam);
    }

    // 4. Renderizar Enemigos
    for (const enemy of this.enemies) {
      enemy.render(ctx, cam);
    }

    // 5. Renderizar al Protagonista Ruben
    this.player.render(ctx, cam);

    // 5b. Hooks de dibujo de otros módulos + luz del momento del día (atardecer → noche)
    for (const fn of (window.GameHooks && window.GameHooks.onRenderWorld) || []) {
      try { fn(this, ctx, cam); } catch (e) { console.error(e); }
    }
    if (window.CodeArt && CodeArt.renderTimeOfDayTint) CodeArt.renderTimeOfDayTint(ctx, this.canvas.width, this.canvas.height);

    // 6. Efecto de Iluminación Ambiental (Luz tenue alrededor de Ruben)
    this.renderLighting();

    // 6b. Viñeta roja breve al recibir daño
    if (this.damageFlash > 0) {
      const W = this.canvas.width, H = this.canvas.height;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.65);
      g.addColorStop(0, 'rgba(160, 30, 20, 0)');
      g.addColorStop(1, `rgba(160, 30, 20, ${0.45 * this.damageFlash})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // 7. Apertura en iris al entrar a una sala
    if (this.irisOpen > 0 && this.deathTimer <= 0) {
      const p = 1 - this.irisOpen;
      const e = 1 - Math.pow(1 - p, 3);
      const fx = this.player.x + this.player.width / 2 - this.camera.x;
      const fy = this.player.y + this.player.height / 2 - this.camera.y;
      this.renderIris(fx, fy, e * Math.hypot(this.canvas.width, this.canvas.height));
    }

    // 8. Derrota: Ruben sale despedido, el iris se cierra sobre él y aparece el texto
    if (this.deathTimer > 0) {
      const k = 1 - this.deathTimer / this.DEATH_FRAMES; // 0 -> 1
      const focus = this.deathFocus || { x: this.canvas.width / 2, y: this.canvas.height / 2 };
      const closeK = Math.max(0, Math.min(1, (k - 0.2) / 0.45));
      const ease = closeK * closeK * (3 - 2 * closeK); // smoothstep
      const maxR = Math.hypot(this.canvas.width, this.canvas.height);
      this.renderIris(focus.x, focus.y, (1 - ease) * maxR);

      const textK = Math.max(0, Math.min(1, (k - 0.55) / 0.3));
      if (textK > 0) {
        const pop = 0.85 + 0.15 * (1 - Math.pow(1 - textK, 3));
        ctx.save();
        ctx.globalAlpha = textK;
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(pop, pop);
        ctx.font = '600 34px Cinzel, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#3a2416';
        const msg = this.deathCause === 'fall' ? 'Ruben cayó...' : 'Ruben cayó en combate...';
        ctx.strokeText(msg, 0, 0);
        ctx.fillStyle = '#f2d29b';
        ctx.fillText(msg, 0, 0);
        // Filete ornamental bajo el texto
        const lw = 140 * textK;
        ctx.strokeStyle = 'rgba(217, 166, 52, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-lw, 30); ctx.lineTo(lw, 30);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Cortinilla circular estilo cortometraje clásico: todo negro salvo un círculo
  renderIris(cx, cy, radius) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.save();
    ctx.fillStyle = '#120b07';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    if (radius > 0.5) ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    if (radius > 0.5 && radius < Math.hypot(W, H)) {
      // Borde de tinta del iris
      ctx.strokeStyle = '#3a2416';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderLighting() {
    const biome = this.world.getCurrentBiome ? this.world.getCurrentBiome() : null;
    const edgeTint = (biome && biome.vignetteTint) || 'rgba(48, 26, 12, 0.24)';

    this.ctx.save();
    // Viñeta cálida y muy suave de película animada clásica (sin oscurecer el paisaje exterior)
    // Círculos concéntricos en el centro de la pantalla: la viñeta queda pareja.
    // (Antes un círculo seguía a Ruben y el otro estaba fijo; al ir a la izquierda
    // se desfasaban y oscurecían la imagen.)
    const cxv = this.canvas.width / 2, cyv = this.canvas.height / 2;
    const lightGrad = this.ctx.createRadialGradient(cxv, cyv, 220, cxv, cyv, 600);
    lightGrad.addColorStop(0, 'rgba(255, 235, 190, 0)');
    lightGrad.addColorStop(0.75, 'rgba(40, 22, 10, 0.08)');
    lightGrad.addColorStop(1, edgeTint);

    this.ctx.fillStyle = lightGrad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  gameLoop(currentTime) {
    if (!this.lastTime) this.lastTime = currentTime;
    // Limitar dt para que una pestaña en segundo plano no provoque un salto enorme
    const dt = Math.min(250, currentTime - this.lastTime);
    this.lastTime = currentTime;

    // El siguiente cuadro se pide antes de simular: si un cuadro falla, el juego sigue
    // (antes un error en update/render dejaba la pantalla congelada para siempre)
    requestAnimationFrame((ts) => this.gameLoop(ts));

    try { this.pollGamepad(); } catch (e) { console.warn('[Mando] error:', e); }
    this.accumulator += dt;
    try {
      while (this.accumulator >= this.STEP) {
        this.accumulator -= this.STEP;
        this.update(this.STEP);
      }
      this.render();
    } catch (e) {
      this.accumulator = 0;
      // Un aviso por segundo como mucho (no inundar la consola)
      if (!this.loopErrorAt || currentTime - this.loopErrorAt > 1000) {
        this.loopErrorAt = currentTime;
        console.error('[Juego] error en el cuadro:', e);
      }
    }
  }
}

// Iniciar cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
