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

    this.init();
  }

  init() {
    window.gameInstance = this;

    // Cargar sala inicial
    this.loadRoom(0);
    this.setupInputs();
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

    // Instanciar enemigos y objetos de la sala
    this.enemies = room.spawnEnemies ? room.spawnEnemies() : [];
    this.debrisItems = room.spawnDebris ? room.spawnDebris() : [];

    // Actualizar HUD
    this.zoneTag.textContent = room.name;
    this.renderMiniMap();
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (!this.isPlaying) return;

      // Salto
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        if (!this.dialogBox.classList.contains('hidden')) {
          this.closeDialog();
        } else {
          this.player.jump();
        }
      }

      // Ataque (J o Z)
      if (e.code === 'KeyJ' || e.code === 'KeyZ') {
        this.player.attack(this.enemies);
      }

      // Agarrar / Lanzar escombro (K o X)
      if (e.code === 'KeyK' || e.code === 'KeyX') {
        this.player.interactOrThrow(this.debrisItems);
      }

      // Interactuar (E)
      if (e.code === 'KeyE') {
        if (!this.dialogBox.classList.contains('hidden')) {
          this.closeDialog();
        } else {
          this.checkInteractions();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Controles táctiles / de ratón en el canvas
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.isPlaying) return;
      if (e.button === 0) {
        // Clic izquierdo: Ataque
        this.player.attack(this.enemies);
      } else if (e.button === 2) {
        // Clic derecho: Agarrar / Lanzar
        e.preventDefault();
        this.player.interactOrThrow(this.debrisItems);
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
      const doorCenterX = room.door.x + room.door.width / 2;
      const doorCenterY = room.door.y + room.door.height / 2;
      if (Math.hypot(px - doorCenterX, py - doorCenterY) < 70) {
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
      this.carryIndicator.style.borderColor = '#8ec3ff';
    } else {
      this.carryText.textContent = 'Vacío';
      this.carryIndicator.style.borderColor = 'rgba(100, 150, 210, 0.3)';
    }
  }

  renderMiniMap() {
    this.miniMap.innerHTML = '';
    // Representación de las 4 habitaciones (grid 2x2 o fila)
    for (let i = 0; i < 4; i++) {
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
        break;
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

    const room = this.world.getCurrentRoom();

    // Actualizar Ruben
    this.player.update(this.world, this.keys);

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
      this.screenShakeTime -= dt;
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
  }

  renderLighting() {
    const rx = this.player.x + this.player.width / 2 - this.camera.x;
    const ry = this.player.y + this.player.height / 2 - this.camera.y;

    this.ctx.save();
    // Viñeta y halo de luz mística
    const lightGrad = this.ctx.createRadialGradient(rx, ry, 30, rx, ry, 340);
    lightGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    lightGrad.addColorStop(0.7, 'rgba(4, 7, 14, 0.45)');
    lightGrad.addColorStop(1, 'rgba(2, 4, 8, 0.85)');

    this.ctx.fillStyle = lightGrad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  gameLoop(currentTime) {
    if (!this.lastTime) this.lastTime = currentTime;
    const dt = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((ts) => this.gameLoop(ts));
  }
}

// Iniciar cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
