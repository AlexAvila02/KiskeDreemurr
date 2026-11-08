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
    this.activeInteraction = null;

    // Paso fijo de simulación (60 actualizaciones/seg en cualquier monitor)
    this.STEP = 1000 / 60;
    this.accumulator = 0;
    this.respawnPoint = { x: 80, y: 410 };
    this.deathTimer = 0;      // cuadros restantes de la animación de muerte
    this.DEATH_FRAMES = 75;

    this.init();
  }

  init() {
    window.gameInstance = this;

    // Cargar sala inicial
    this.loadRoom(0);
    this.setupInputs();
    this.setupGamepad();
    this.updateHUD();
    this.renderMiniMap();

    // Botón de Inicio
    this.btnStart.addEventListener('click', () => {
      window.soundManager.init();
      this.overlayScreen.classList.add('hidden');
      this.isPlaying = true;
      this.showNotification("Seguí las notas de Angelo...");
    });

    // Arrancar el ciclo de render
    requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  loadRoom(index, spawnX = null, spawnY = null) {
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
    this.camera.x = Math.max(0, Math.min(room.width - this.canvas.width, this.player.x - this.canvas.width / 2));
    this.camera.y = Math.max(0, Math.min(room.height - this.canvas.height, this.player.y - this.canvas.height / 2));

    // Instanciar enemigos y objetos de la sala
    this.enemies = room.spawnEnemies ? room.spawnEnemies() : [];
    this.debrisItems = room.spawnDebris ? room.spawnDebris() : [];
    // Si Ruben llevaba una piedra, la lleva consigo a la nueva sala
    if (this.player.carriedItem) this.debrisItems.push(this.player.carriedItem);
    window.particleSystem.particles && (window.particleSystem.particles.length = 0);
    if (window.particleSystem.setBiome) window.particleSystem.setBiome(room.biome || 'pradera');
    if (window.soundManager.setBiomeAmbience) window.soundManager.setBiomeAmbience(room.biome || 'pradera');

    // Actualizar HUD
    this.zoneTag.textContent = room.name;
    this.renderMiniMap();
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;

      if (!this.isPlaying) return;
      // Mantener apretada una tecla no repite saltos/ataques
      if (e.repeat) return;

      if (['Space', 'KeyW', 'ArrowUp', 'KeyX'].includes(e.code)) this.doAction('jump');
      if (e.code === 'KeyJ' || e.code === 'KeyZ') this.doAction('attack');
      if (e.code === 'KeyK') this.doAction('grab');
      if (e.code === 'KeyE') this.doAction('interact');
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Si la ventana pierde el foco, soltar todas las teclas (evita que Ruben siga caminando solo)
    window.addEventListener('blur', () => { this.keys = {}; });

    // Controles táctiles / de ratón en el canvas
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.doAction('attack');          // Clic izquierdo: atacar
      else if (e.button === 2) { e.preventDefault(); this.doAction('grab'); } // Clic derecho: agarrar/lanzar
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Acción del jugador (la usan teclado, mouse y mando)
  doAction(action) {
    if (!this.isPlaying || this.deathTimer > 0) return;
    const dialogOpen = !this.dialogBox.classList.contains('hidden');

    // Con una nota abierta, saltar o interactuar la cierra; lo demás se ignora
    if (dialogOpen) {
      if (action === 'jump' || action === 'interact') this.closeDialog();
      return;
    }

    if (action === 'jump') this.player.jump();
    else if (action === 'attack') this.player.attack(this.enemies);
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
      this.showNotification('🎮 Mando conectado');
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
    const pads = navigator.getGamepads();
    if (this.padIndex !== null && pads[this.padIndex]) return pads[this.padIndex];
    // Algunos navegadores no avisan la conexión hasta tocar un botón: buscar cualquiera
    for (const p of pads) if (p && p.connected) { this.padIndex = p.index; return p; }
    return null;
  }

  pollGamepad() {
    const pad = this.getPad();
    if (!pad) return;

    const pressed = pad.buttons.map(b => b && (b.pressed || b.value > 0.5));
    const justPressed = (i) => pressed[i] && !this.padPrev[i];

    // Movimiento: stick izquierdo con zona muerta, o cruceta
    const ax = pad.axes[0] || 0;
    const DEAD = 0.35;
    this.keys['PadLeft'] = ax < -DEAD || !!pressed[14];
    this.keys['PadRight'] = ax > DEAD || !!pressed[15];

    // Pantalla de inicio: A o Start comienzan
    if (!this.isPlaying) {
      if (justPressed(0) || justPressed(9)) this.btnStart.click();
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

  checkInteractions() {
    const room = this.world.getCurrentRoom();
    const px = this.player.x + this.player.width / 2;
    const py = this.player.y + this.player.height / 2;

    // 1. Revisar notas de Angelo
    for (const tab of room.tablets) {
      if (Math.hypot(px - (tab.x + 11), py - (tab.y + 17)) < 55) {
        this.showDialog(tab.speaker, tab.text);
        return;
      }
    }

    // 2. Revisar puerta sellada
    if (room.door && room.door.isLocked) {
      // Distancia al rectángulo de la puerta (no a su centro: la puerta es muy alta)
      const d = room.door;
      const nx = Math.max(d.x, Math.min(px, d.x + d.width));
      const ny = Math.max(d.y, Math.min(py, d.y + d.height));
      if (Math.hypot(px - nx, py - ny) < 50) {
        if (this.player.keys >= room.door.requiredKeys) {
          room.door.isLocked = false;
          window.soundManager.playDoorUnlock();
          this.triggerScreenShake(8, 250);
          this.showNotification("¡El Portón Norte se abrió!");
        } else {
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
    if (cause !== 'fall') {
      window.particleSystem.createHitImpact(p.x + p.width / 2, p.y + p.height / 2, 24);
      window.particleSystem.createDust(p.x + p.width / 2, p.y + p.height / 2, 16, '#d9a634');
    }
    window.soundManager.playHit();
    this.triggerScreenShake(9, 300);
    this.updateHUD();
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
    const rp = this.respawnPoint;
    this.loadRoom(this.world.currentRoomIndex, rp.x, rp.y);
    this.showNotification(this.deathCause === 'fall' ? 'Ruben cayó al vacío... vuelve a intentarlo' : 'Ruben vuelve a levantarse...');
    this.updateHUD();
  }

  showDialog(speaker, text) {
    this.dialogSpeaker.textContent = speaker;
    this.dialogText.textContent = text;
    this.dialogBox.classList.remove('hidden');
    window.soundManager.playPickup();
  }

  closeDialog() {
    this.dialogBox.classList.add('hidden');
  }

  showNotification(msg) {
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notification.textContent = msg;
    this.notification.classList.remove('hidden');
    this.notificationTimer = setTimeout(() => {
      this.notification.classList.add('hidden');
    }, 3200);
  }

  triggerScreenShake(intensity = 6, durationMs = 150) {
    this.screenShakeIntensity = intensity;
    this.screenShakeTime = durationMs;
    this.rumble(intensity / 10, durationMs);
  }

  updateHUD() {
    // Máscaras de salud
    this.healthBar.innerHTML = '';
    for (let i = 0; i < this.player.maxHp; i++) {
      const mask = document.createElement('div');
      mask.className = 'mask-node' + (i < this.player.hp ? ' active' : '');
      this.healthBar.appendChild(mask);
    }

    // Llaves
    this.keyCount.textContent = `${this.player.keys}/1`;

    // Objeto agarrado
    if (this.player.carriedItem) {
      this.carryText.textContent = 'Roca Lista';
      this.carryIndicator.style.borderColor = '#f0bf4c';
    } else {
      this.carryText.textContent = 'Vacío';
      this.carryIndicator.style.borderColor = '#8a623e';
    }
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
    const room = this.world.getCurrentRoom();
    const px = this.player.x + this.player.width / 2;
    const py = this.player.y + this.player.height / 2;

    for (const exit of room.exits) {
      if (
        px >= exit.x &&
        px <= exit.x + exit.w &&
        py >= exit.y &&
        py <= exit.y + exit.h
      ) {
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

  update(dt) {
    if (!this.isPlaying) return;
    // El mundo se congela mientras se lee una nota
    if (!this.dialogBox.classList.contains('hidden')) return;

    // Animación de muerte: el mundo sigue de fondo, Ruben no se controla
    if (this.deathTimer > 0) {
      this.deathTimer--;
      window.particleSystem.update();
      if (this.deathTimer === 0) this.restartRoom();
      return;
    }

    const room = this.world.getCurrentRoom();

    // Actualizar Ruben
    this.player.update(this.world, this.keys);

    // Caída al vacío = muerte
    if (this.player.y > room.height + 20) {
      this.killPlayer('fall');
      return;
    }

    // Actualizar Enemigos
    for (const enemy of this.enemies) {
      enemy.update(this.world, this.player);
    }

    // Actualizar Escombros Arrojables
    for (const item of this.debrisItems) {
      item.update(this.world, this.player, this.enemies);
    }

    // Actualizar Partículas
    window.particleSystem.update();

    // Comprobar transiciones de sala y llaves
    this.checkRoomExits();

    // Suavizado de Cámara centrado en Ruben
    const targetCamX = this.player.x + this.player.width / 2 - this.canvas.width / 2;
    const targetCamY = this.player.y + this.player.height / 2 - this.canvas.height / 2;

    this.camera.x += (targetCamX - this.camera.x) * 0.1;
    this.camera.y += (targetCamY - this.camera.y) * 0.1;

    // Límites de la cámara dentro de la sala
    this.camera.x = Math.max(0, Math.min(room.width - this.canvas.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(room.height - this.canvas.height, this.camera.y));

    // Vibración de pantalla (Screen Shake)
    if (this.screenShakeTime > 0) {
      this.screenShakeTime -= this.STEP;
      const shakeOffsetX = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
      const shakeOffsetY = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
      this.camera.x += shakeOffsetX;
      this.camera.y += shakeOffsetY;
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Renderizar Mundo y Plataformas
    this.world.render(this.ctx, this.camera);

    // 2. Renderizar Partículas de Fondo
    window.particleSystem.render(this.ctx, this.camera);

    // 3. Renderizar Escombros
    for (const item of this.debrisItems) {
      item.render(this.ctx, this.camera);
    }

    // 4. Renderizar Enemigos
    for (const enemy of this.enemies) {
      enemy.render(this.ctx, this.camera);
    }

    // 5. Renderizar al Protagonista Ruben
    this.player.render(this.ctx, this.camera);

    // 6. Efecto de Iluminación Ambiental (Luz tenue alrededor de Ruben)
    this.renderLighting();

    // 7. Fundido a negro al morir
    if (this.deathTimer > 0) {
      const k = 1 - this.deathTimer / this.DEATH_FRAMES; // 0 -> 1
      const alpha = Math.min(1, k * 1.6);
      this.ctx.save();
      this.ctx.fillStyle = `rgba(10, 6, 4, ${alpha})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalAlpha = Math.min(1, k * 2.5);
      this.ctx.fillStyle = '#f2d29b';
      this.ctx.font = '600 34px Cinzel, Georgia, serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(this.deathCause === 'fall' ? 'Ruben cayó...' : 'Ruben cayó en combate...', this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.restore();
    }
  }

  renderLighting() {
    const rx = this.player.x + this.player.width / 2 - this.camera.x;
    const ry = this.player.y + this.player.height / 2 - this.camera.y;
    const biome = this.world.getCurrentBiome ? this.world.getCurrentBiome() : null;
    const edgeTint = (biome && biome.vignetteTint) || 'rgba(48, 26, 12, 0.24)';

    this.ctx.save();
    // Viñeta cálida y muy suave de película animada clásica (sin oscurecer el paisaje exterior)
    const lightGrad = this.ctx.createRadialGradient(rx, ry, 140, this.canvas.width / 2, this.canvas.height / 2, 560);
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

    this.pollGamepad();
    this.accumulator += dt;
    while (this.accumulator >= this.STEP) {
      this.update(this.STEP);
      this.accumulator -= this.STEP;
    }
    this.render();

    requestAnimationFrame((ts) => this.gameLoop(ts));
  }
}

// Iniciar cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
