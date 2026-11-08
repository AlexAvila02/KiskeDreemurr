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
    this.walkPhase = 0;   // ciclo de caminata (avanza con la velocidad)
    this.dead = false;

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
    if (this.attackCooldown > 0 || this.isAttacking || this.dead) return;
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
    if (this.invulnerableTimer > 0 || this.dead) return;
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
      if (window.gameInstance) window.gameInstance.killPlayer();
      else this.respawn();
    }
  }

  // fullHeal=true al morir; false al caer al vacío (solo se reubica)
  respawn(fullHeal = true) {
    const rp = (window.gameInstance && window.gameInstance.respawnPoint) || { x: 80, y: 410 };
    if (fullHeal) this.hp = this.maxHp;
    this.x = rp.x;
    this.y = rp.y;
    this.vx = 0;
    this.vy = 0;
    this.invulnerableTimer = 60;
    if (this.carriedItem) {
      this.carriedItem.active = false;
      this.carriedItem = null;
    }
    if (window.gameInstance) {
      window.gameInstance.showNotification(fullHeal ? "Ruben vuelve a levantarse..." : "¡Cuidado con el barranco!");
      window.gameInstance.updateHUD();
    }
  }

  update(world, keys) {
    // Control horizontal
    let moveDir = 0;
    if (keys['ArrowRight'] || keys['KeyD'] || keys['PadRight']) moveDir += 1;
    if (keys['ArrowLeft'] || keys['KeyA'] || keys['PadLeft']) moveDir -= 1;

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

    // Ciclo de caminata ligado a la velocidad real (no al reloj)
    if (this.isGrounded && Math.abs(this.vx) > 0.4) {
      this.walkPhase += Math.abs(this.vx) * 0.11;
    } else {
      this.walkPhase = 0;
    }

    // Actualizar física de la bufanda
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
    // Bufanda: segmentos de largo fijo. El ángulo depende de la velocidad
    // (cuelga quieta, flamea hacia atrás al correr, sube al caer).
    const SEG = 8;
    const anchor = this.capePoints[0];
    anchor.x = this.x + this.width / 2 - this.facing * 3;
    anchor.y = this.y + 17;

    const speed = Math.min(1, Math.abs(this.vx) / this.speed);
    const back = -this.facing;
    const t = Date.now() * 0.008;
    for (let i = 1; i < this.capePoints.length; i++) {
      const prev = this.capePoints[i - 1];
      const cur = this.capePoints[i];
      // 0 rad = horizontal hacia atrás; PI/2 = colgando
      let ang = Math.PI / 2 * (1 - speed * 0.85) + this.vy * 0.06;
      ang += Math.sin(t + i * 1.3) * (0.12 + speed * 0.18);
      ang = Math.max(-0.6, Math.min(Math.PI / 2 + 0.2, ang));
      const tx = prev.x + back * Math.cos(ang) * SEG;
      const ty = prev.y + Math.sin(ang) * SEG;
      cur.x += (tx - cur.x) * 0.5;
      cur.y += (ty - cur.y) * 0.5;
      // Mantener el largo exacto del segmento
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      const d = Math.hypot(dx, dy) || 1;
      cur.x = prev.x + dx / d * SEG;
      cur.y = prev.y + dy / d * SEG;
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
    if (this.dead) return;
    let stretch = 1 + Math.max(-0.08, Math.min(0.1, -this.vy * 0.01));
    if (this.isGrounded) stretch = 1;
    if (this.squashTimer > 0) stretch = 1 - this.squashTimer * 0.02;
    const squash = 1 / stretch;
    // Balanceo al caminar: el cuerpo rebota dos veces por ciclo
    const bob = this.walkPhase ? -Math.abs(Math.sin(this.walkPhase)) * 2.5 : 0;

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

    // 1. Cola de la bufanda (cinta que se afina)
    {
      const P = this.capePoints.map(p => ({ x: p.x - camera.x, y: p.y - camera.y + bob }));
      ctx.fillStyle = SCARF;
      ctx.beginPath();
      ctx.moveTo(P[0].x, P[0].y - 3);
      ctx.quadraticCurveTo(P[1].x, P[1].y - 2.5, P[2].x, P[2].y - 1);
      ctx.lineTo(P[2].x, P[2].y + 1.5);
      ctx.quadraticCurveTo(P[1].x, P[1].y + 2.5, P[0].x, P[0].y + 3);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // 2. Piernas y botas: paso alternado (un pie adelante y levantado)
    ctx.fillStyle = BOOT;
    for (const k of [-1, 1]) {
      const ph = this.walkPhase + (k === 1 ? 0 : Math.PI);
      const stepX = this.walkPhase ? Math.cos(ph) * 4 * f : 0;
      const lift = this.walkPhase ? Math.max(0, Math.sin(ph)) * 3 : 0;
      const airTuck = this.isGrounded ? 0 : 2;
      ctx.beginPath();
      ctx.ellipse(cx + k * 4 + stepX, feetY - 3 - lift - airTuck, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // Todo lo de arriba de las piernas rebota con el paso
    ctx.translate(0, bob);

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

    // 4. Brazo y espada. Al atacar, la espada barre de arriba hacia abajo por delante.
    const shoulderX = cx + f * 6, shoulderY = sy + 21;
    let swordAng; // ángulo de la hoja (0 = hacia adelante)
    if (this.isAttacking) {
      const p = 1 - this.attackTimer / this.attackDuration;
      const e = 1 - Math.pow(1 - p, 3); // arranque rápido, frenada suave
      swordAng = -1.9 + e * 3.0;
    } else {
      swordAng = -1.25 + Math.sin(this.walkPhase) * 0.15;
    }
    const hx = shoulderX + f * Math.cos(swordAng * 0.5) * 5;
    const hy = shoulderY + Math.sin(swordAng * 0.5) * 5 + 2;
    // Hoja
    ctx.strokeStyle = '#e4e9ee';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + f * Math.cos(swordAng) * 15, hy + Math.sin(swordAng) * 15);
    ctx.stroke();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Guarda
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#8a5a2b';
    const gx = -Math.sin(swordAng) * 3, gy = Math.cos(swordAng) * 3;
    ctx.beginPath();
    ctx.moveTo(hx - f * gx, hy - gy);
    ctx.lineTo(hx + f * gx, hy + gy);
    ctx.stroke();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    // Mano
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.arc(hx, hy, 3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

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

    // 7. Estela del corte: media luna delante de Ruben que sigue a la espada
    if (this.isAttacking) {
      const p = 1 - this.attackTimer / this.attackDuration;
      const e = 1 - Math.pow(1 - p, 3);
      const ox = sx + this.width / 2 + f * 8;
      const oy = sy + 21;
      const a0 = -1.9, a1 = -1.9 + e * 3.0;
      const R = 30;
      const toAng = a => (f === 1 ? a : Math.PI - a);
      ctx.save();
      ctx.globalAlpha = Math.min(1, 1.6 - p * 1.4);
      ctx.fillStyle = 'rgba(255, 244, 214, 0.9)';
      ctx.shadowColor = '#ffcf6b';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(ox, oy, R, toAng(a0), toAng(a1), f !== 1);
      ctx.arc(ox + f * 5, oy, R - 9, toAng(a1), toAng(a0), f === 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
