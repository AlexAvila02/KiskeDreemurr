/**
 * Clase Ruben - El Protagonista
 * Manejo de física fluida, doble salto, combate cuerpo a cuerpo y agarre/lanzamiento de escombros.
 */
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 24;
    this.height = 38;

    // Físicas y movimiento
    this.vx = 0;
    this.vy = 0;
    this.speed = 4.8;
    this.acceleration = 0.55;
    this.friction = 0.82;
    this.gravity = 0.48;
    this.maxFallSpeed = 12;

    // Habilidades de Salto
    this.jumpForce = -9.6;
    this.doubleJumpForce = -9.2;
    this.isGrounded = false;
    this.canDoubleJump = true;
    this.hasUsedDoubleJump = false;
    this.coyoteTime = 0;
    this.squashTimer = 0;

    // Estado y dirección
    this.facing = 1; // 1 = derecha, -1 = izquierda
    this.hp = 5;
    this.maxHp = 5;
    this.invulnerableTimer = 0;

    // Mecánica de Ataque (Espada)
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackDuration = 12;
    this.attackCooldown = 0;
    this.attackBox = { x: 0, y: 0, w: 46, h: 42 };

    // Mecánica de Agarre / Lanzamiento
    this.carriedItem = null;

    // Inventario de habilidades y llaves
    this.keys = 0;

    // Animación de capa
    this.capePoints = [
      { x: this.x, y: this.y + 16 },
      { x: this.x, y: this.y + 26 },
      { x: this.x, y: this.y + 36 }
    ];
  }

  jump() {
    if (this.isGrounded || this.coyoteTime > 0) {
      this.vy = this.jumpForce;
      this.isGrounded = false;
      this.coyoteTime = 0;
      this.canDoubleJump = true;
      window.soundManager.playJump();
      window.particleSystem.createDust(this.x + this.width / 2, this.y + this.height, 8);
    } else if (this.canDoubleJump) {
      this.vy = this.doubleJumpForce;
      this.canDoubleJump = false;
      this.hasUsedDoubleJump = true;
      window.soundManager.playDoubleJump();
      window.particleSystem.createDoubleJumpSparks(this.x + this.width / 2, this.y + this.height);
      if (window.gameInstance) window.gameInstance.triggerScreenShake(2, 60);
    }
  }

  attack(enemies) {
    if (this.attackCooldown > 0 || this.isAttacking) return;
    this.isAttacking = true;
    this.attackTimer = this.attackDuration;
    this.attackCooldown = 18;
    window.soundManager.playSlash();

    // Actualizar hitbox de ataque según la dirección
    this.attackBox.x = this.facing === 1 ? this.x + this.width : this.x - this.attackBox.w;
    this.attackBox.y = this.y - 2;

    // Comprobar colisión con enemigos
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (
        this.attackBox.x < enemy.x + enemy.width &&
        this.attackBox.x + this.attackBox.w > enemy.x &&
        this.attackBox.y < enemy.y + enemy.height &&
        this.attackBox.y + this.attackBox.h > enemy.y
      ) {
        enemy.takeDamage(15, this.facing * 8);
        // Retroceso sutil para Ruben (pogo/recoil)
        this.vx = -this.facing * 2.5;
      }
    }
  }

  interactOrThrow(debrisList) {
    // Si ya tiene un objeto agarrado -> Lanzarlo
    if (this.carriedItem) {
      this.carriedItem.isCarried = false;
      this.carriedItem.isThrown = true;
      this.carriedItem.vx = this.facing * 10;
      this.carriedItem.vy = -3.8;
      window.soundManager.playThrow();
      this.carriedItem = null;
      if (window.gameInstance) window.gameInstance.updateHUD();
      return;
    }

    // Si no tiene objeto -> Buscar escombro cercano en el suelo para levantarlo
    const pickupRadius = 45;
    for (const item of debrisList) {
      if (!item.active || item.isCarried || item.isThrown) continue;
      const dist = Math.hypot(
        (this.x + this.width / 2) - (item.x + item.width / 2),
        (this.y + this.height / 2) - (item.y + item.height / 2)
      );

      if (dist < pickupRadius) {
        item.isCarried = true;
        this.carriedItem = item;
        window.soundManager.playPickup();
        if (window.gameInstance) {
          window.gameInstance.showNotification("¡Objeto recogido! Presiona K para lanzarlo");
          window.gameInstance.updateHUD();
        }
        break;
      }
    }
  }

  takeDamage(amount, knockback = 0) {
    if (this.invulnerableTimer > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnerableTimer = 55;
    this.vx = knockback;
    this.vy = -4.5;
    window.soundManager.playHit();
    window.particleSystem.createHitImpact(this.x + this.width / 2, this.y + this.height / 2, 14);
    if (window.gameInstance) {
      window.gameInstance.triggerScreenShake(7, 180);
      window.gameInstance.updateHUD();
    }

    if (this.hp <= 0) {
      this.respawn();
    }
  }

  respawn() {
    this.hp = this.maxHp;
    this.x = 80;
    this.y = 350;
    this.vx = 0;
    this.vy = 0;
    if (this.carriedItem) {
      this.carriedItem.active = false;
      this.carriedItem = null;
    }
    if (window.gameInstance) {
      window.gameInstance.showNotification("Ruben vuelve a levantarse...");
      window.gameInstance.updateHUD();
    }
  }

  update(world, keys) {
    // Control horizontal
    let moveDir = 0;
    if (keys['ArrowRight'] || keys['KeyD']) moveDir += 1;
    if (keys['ArrowLeft'] || keys['KeyA']) moveDir -= 1;

    if (moveDir !== 0) {
      this.vx += moveDir * this.acceleration;
      if (Math.abs(this.vx) > this.speed) {
        this.vx = Math.sign(this.vx) * this.speed;
      }
      this.facing = moveDir;
    } else {
      this.vx *= this.friction;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    // Temporizadores
    if (this.invulnerableTimer > 0) this.invulnerableTimer--;
    if (this.squashTimer > 0) this.squashTimer--;
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.attackTimer > 0) {
      this.attackTimer--;
      if (this.attackTimer === 0) this.isAttacking = false;
    }

    // Gravedad
    this.vy += this.gravity;
    if (this.vy > this.maxFallSpeed) this.vy = this.maxFallSpeed;

    // Desplazamiento X y colisiones
    this.x += this.vx;
    this.handleHorizontalCollisions(world);

    // Desplazamiento Y y colisiones
    const wasGrounded = this.isGrounded;
    this.y += this.vy;
    this.handleVerticalCollisions(world);

    // Lógica de aterrizaje y coyote time
    if (!wasGrounded && this.isGrounded) {
      window.particleSystem.createDust(this.x + this.width / 2, this.y + this.height, 5);
      this.squashTimer = 6;
      this.canDoubleJump = true;
      this.hasUsedDoubleJump = false;
    }

    if (wasGrounded && !this.isGrounded) {
      this.coyoteTime = 6;
    } else if (this.coyoteTime > 0) {
      this.coyoteTime--;
    }

    // Actualizar física de la capa de Ruben
    this.updateCapePhysics();
  }

  handleHorizontalCollisions(world) {
    for (const plat of world.getPlatforms()) {
      if (
        this.x < plat.x + plat.w &&
        this.x + this.width > plat.x &&
        this.y < plat.y + plat.h &&
        this.y + this.height > plat.y
      ) {
        if (this.vx > 0) {
          this.x = plat.x - this.width;
        } else if (this.vx < 0) {
          this.x = plat.x + plat.w;
        }
        this.vx = 0;
      }
    }
  }

  handleVerticalCollisions(world) {
    this.isGrounded = false;
    for (const plat of world.getPlatforms()) {
      if (
        this.x < plat.x + plat.w &&
        this.x + this.width > plat.x &&
        this.y < plat.y + plat.h &&
        this.y + this.height > plat.y
      ) {
        if (this.vy > 0) {
          this.y = plat.y - this.height;
          this.vy = 0;
          this.isGrounded = true;
        } else if (this.vy < 0) {
          this.y = plat.y + plat.h;
          this.vy = 0;
        }
      }
    }
  }

  updateCapePhysics() {
    const anchorX = this.x + this.width / 2 - this.facing * 4;
    const anchorY = this.y + 14;

    this.capePoints[0].x = anchorX;
    this.capePoints[0].y = anchorY;

    for (let i = 1; i < this.capePoints.length; i++) {
      const prev = this.capePoints[i - 1];
      const cur = this.capePoints[i];

      const targetX = prev.x - this.facing * (this.vx * 1.5 + 4);
      const targetY = prev.y + 10 - this.vy * 0.4;

      cur.x += (targetX - cur.x) * 0.35;
      cur.y += (targetY - cur.y) * 0.35;
    }
  }

  render(ctx, camera) {
    // Diseño original de Ruben: joven viajero del reino caído, estilo animación
    // a mano tipo años 50 (formas redondas, contorno cálido, squash & stretch).
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    const cx = sx + this.width / 2;
    const feetY = sy + this.height;
    const t = Date.now() * 0.001;
    const f = this.facing;

    // Squash & stretch: estira al subir/caer, aplasta al aterrizar
    let stretch = 1 + Math.max(-0.12, Math.min(0.15, -this.vy * 0.015));
    if (this.squashTimer > 0) stretch = 1 - this.squashTimer * 0.025;
    const squash = 1 / stretch;

    const OUT = '#3a2416';      // contorno marrón cálido (tinta de animación)
    const SKIN = '#f2c79b';
    const HAIR = '#b5562b';     // pelo cobrizo
    const TUNIC = '#3f7d5a';    // túnica verde bosque
    const SCARF = '#d9a634';    // bufanda mostaza (el color de la familia)
    const BOOT = '#6b3f22';

    ctx.save();
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUT;

    // Escalado desde los pies para el squash & stretch
    ctx.translate(cx, feetY);
    ctx.scale(squash, stretch);
    ctx.translate(-cx, -feetY);

    // 1. Cola de la bufanda (usa la física de capa existente)
    ctx.fillStyle = SCARF;
    ctx.beginPath();
    ctx.moveTo(this.capePoints[0].x - camera.x, this.capePoints[0].y - camera.y - 2);
    ctx.quadraticCurveTo(
      this.capePoints[1].x - camera.x, this.capePoints[1].y - camera.y - 6,
      this.capePoints[2].x - camera.x, this.capePoints[2].y - camera.y - 10 + Math.sin(t * 8) * 2
    );
    ctx.lineTo(this.capePoints[2].x - camera.x, this.capePoints[2].y - camera.y - 4);
    ctx.quadraticCurveTo(
      this.capePoints[1].x - camera.x, this.capePoints[1].y - camera.y,
      this.capePoints[0].x - camera.x, this.capePoints[0].y - camera.y + 4
    );
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // 2. Piernas y botas (caminata con balanceo)
    const walk = this.isGrounded && Math.abs(this.vx) > 0.5 ? Math.sin(t * 16) * 4 : 0;
    ctx.fillStyle = BOOT;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + k * 5 + walk * k, feetY - 3, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // 3. Cuerpo: túnica en forma de pera con cinturón
    ctx.fillStyle = TUNIC;
    ctx.beginPath();
    ctx.moveTo(cx - 6, sy + 17);
    ctx.quadraticCurveTo(cx - 12, feetY - 4, cx - 9, feetY - 5);
    ctx.lineTo(cx + 9, feetY - 5);
    ctx.quadraticCurveTo(cx + 12, feetY - 4, cx + 6, sy + 17);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = BOOT;
    ctx.fillRect(cx - 10, sy + 28, 20, 3);

    // Morral con las notas de Angelo
    ctx.fillStyle = '#c08a4e';
    ctx.beginPath();
    ctx.roundRect(cx - f * 9 - 4, sy + 24, 8, 7, 2);
    ctx.fill(); ctx.stroke();

    // 4. Brazo que sostiene la espada
    const armX = cx + f * 8;
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.arc(armX, sy + 24, 3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (!this.isAttacking) {
      ctx.strokeStyle = '#cfd6dd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(armX, sy + 24);
      ctx.lineTo(armX + f * 4, sy + 12);
      ctx.stroke();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
    }

    // 5. Nudo de la bufanda al cuello
    ctx.fillStyle = SCARF;
    ctx.beginPath();
    ctx.ellipse(cx, sy + 17, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // 6. Cabeza redonda grande (proporciones de cartoon)
    const headY = sy + 7;
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.ellipse(cx, headY, 10, 10.5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Pelo cobrizo despeinado con mechón al frente
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(cx - 10, headY - 1);
    ctx.quadraticCurveTo(cx - 9, headY - 13, cx + 1, headY - 11);
    ctx.quadraticCurveTo(cx + 6 * f + 6, headY - 16, cx + f * 5, headY - 7);
    ctx.quadraticCurveTo(cx + 10, headY - 6, cx + 10, headY - 1);
    ctx.quadraticCurveTo(cx, headY - 6, cx - 10, headY - 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Ojos grandes y expresivos con brillo (parpadeo ocasional)
    const blink = (Math.floor(t * 10) % 40) === 0;
    const ex = cx + f * 3;
    for (const k of [-1, 1]) {
      const exx = ex + k * 3.5;
      if (blink) {
        ctx.beginPath();
        ctx.moveTo(exx - 2, headY + 1); ctx.lineTo(exx + 2, headY + 1);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(exx, headY + 1, 2.6, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1; ctx.stroke(); ctx.lineWidth = 2;
        ctx.fillStyle = '#2b1a10';
        ctx.beginPath();
        ctx.arc(exx + f * 0.8, headY + 1.5, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(exx + f * 0.8 + 0.6, headY + 0.8, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Mejillas y sonrisa decidida
    ctx.fillStyle = 'rgba(224, 120, 100, 0.45)';
    ctx.beginPath();
    ctx.arc(ex - 6, headY + 5, 2, 0, Math.PI * 2);
    ctx.arc(ex + 6, headY + 5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(ex + f, headY + 5, 2.2, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();

    // 7. Arco del ataque: pincelada cálida en lugar del corte azul
    if (this.isAttacking) {
      const p = 1 - this.attackTimer / this.attackDuration;
      const ax = sx + (f === 1 ? this.width + 4 : -4);
      const ay = sy + this.height / 2;
      ctx.save();
      ctx.globalAlpha = 1 - p * 0.6;
      ctx.strokeStyle = '#fff4d6';
      ctx.shadowColor = '#ffcf6b';
      ctx.shadowBlur = 10;
      ctx.lineCap = 'round';
      ctx.lineWidth = 5 - p * 3;
      const a0 = f === 1 ? -Math.PI * 0.45 : Math.PI * 0.45;
      const a1 = f === 1 ? Math.PI * 0.45 : Math.PI * 1.45;
      ctx.beginPath();
      ctx.arc(ax, ay, 30, a0, a1, f !== 1);
      ctx.stroke();
      ctx.restore();
    }
  }
}
