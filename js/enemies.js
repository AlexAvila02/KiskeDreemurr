/**
 * Entidades Enemigas y Objetos Interactivos Arrojables
 */

// Objeto o Escombro Arrojable
class ThrowableDebris {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 18;
    this.height = 16;
    this.vx = 0;
    this.vy = 0;
    this.isCarried = false;
    this.isThrown = false;
    this.isGrounded = true;
    this.damage = 25;
    this.active = true;
  }

  update(world, player, enemies) {
    if (!this.active) return;

    if (this.isCarried) {
      // Posición sobre la cabeza del jugador
      this.x = player.x + player.width / 2 - this.width / 2;
      this.y = player.y - this.height - 4;
      return;
    }

    if (this.isThrown) {
      this.vy += 0.35; // Gravedad
      this.x += this.vx;
      this.y += this.vy;

      // Colisión con enemigos
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        if (
          this.x < enemy.x + enemy.width &&
          this.x + this.width > enemy.x &&
          this.y < enemy.y + enemy.height &&
          this.y + this.height > enemy.y
        ) {
          enemy.takeDamage(this.damage, Math.sign(this.vx) * 6);
          this.shatter();
          return;
        }
      }

      // Colisión con muros quebradizos ("defensa con ingenio")
      if (world.checkBreakableImpact && world.checkBreakableImpact({ x: this.x, y: this.y, w: this.width, h: this.height })) {
        this.shatter();
        return;
      }

      // Colisión con suelo / plataformas
      for (const plat of world.getPlatforms()) {
        if (
          this.x < plat.x + plat.w &&
          this.x + this.width > plat.x &&
          this.y + this.height >= plat.y &&
          this.y < plat.y + plat.h
        ) {
          this.shatter();
          return;
        }
      }

      // Caída al vacío
      if (this.y > 1000) {
        this.active = false;
      }
    } else {
      // Gravedad leve si está en el suelo
      this.vy += 0.3;
      this.y += this.vy;

      for (const plat of world.getPlatforms()) {
        if (
          this.x < plat.x + plat.w &&
          this.x + this.width > plat.x &&
          this.y + this.height >= plat.y &&
          this.y + this.height <= plat.y + 15 &&
          this.vy >= 0
        ) {
          this.y = plat.y - this.height;
          this.vy = 0;
          this.isGrounded = true;
          break;
        }
      }
    }
  }

  shatter() {
    this.active = false;
    window.soundManager.playHit();
    window.particleSystem.createDebrisFragments(this.x + this.width / 2, this.y + this.height / 2);
    if (window.gameInstance) window.gameInstance.triggerScreenShake(6, 120);
  }

  render(ctx, camera) {
    if (!this.active) return;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;

    ctx.save();
    // Brillo sutil si no está arrojado para indicar que se puede recoger
    if (!this.isThrown && !this.isCarried) {
      ctx.shadowColor = '#ffe9a8';
      ctx.shadowBlur = 8;
    }

    ctx.fillStyle = '#8c7b66';
    ctx.strokeStyle = '#3a2416';
    ctx.lineWidth = 1.5;

    // Forma irregular de roca/escombro
    ctx.beginPath();
    ctx.moveTo(sx + 4, sy);
    ctx.lineTo(sx + this.width - 2, sy + 3);
    ctx.lineTo(sx + this.width, sy + this.height - 2);
    ctx.lineTo(sx + 3, sy + this.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Brillo de luz en la piedra
    ctx.fillStyle = '#d8ccb8';
    ctx.beginPath();
    ctx.arc(sx + this.width / 2, sy + this.height / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Enemigo Terrestre: Escarabajo de Pradera (tonos ocre del pasto seco)
class CrawlerEnemy {
  constructor(x, y, patrolDistance = 140) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.width = 34;
    this.height = 24;
    this.patrolDistance = patrolDistance;
    this.speed = 1.2;
    this.facing = 1; // 1 = derecha, -1 = izquierda
    this.hp = 30;
    this.maxHp = 30;
    this.alive = true;
    this.hitCooldown = 0;
    this.knockbackVx = 0;
  }

  takeDamage(amount, knockback = 0) {
    if (this.hitCooldown > 0 || !this.alive) return;
    this.hp -= amount;
    this.hitCooldown = 15;
    this.knockbackVx = knockback;
    window.soundManager.playHit();
    window.particleSystem.createHitImpact(this.x + this.width / 2, this.y + this.height / 2, 10);
    if (window.gameInstance) window.gameInstance.triggerScreenShake(5, 100);

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.alive = false;
    window.particleSystem.createDust(this.x + this.width / 2, this.y + this.height / 2, 12, '#c98a3a');
    // Suelta un escombro arrojable al morir
    if (window.gameInstance && window.gameInstance.debrisItems) {
      window.gameInstance.debrisItems.push(new ThrowableDebris(this.x + 8, this.y - 4));
    }
  }

  update(world, player) {
    if (!this.alive) return;

    if (this.hitCooldown > 0) this.hitCooldown--;

    if (Math.abs(this.knockbackVx) > 0.1) {
      this.x += this.knockbackVx;
      this.knockbackVx *= 0.85;
    } else {
      // Patrullaje
      this.x += this.speed * this.facing;
      if (Math.abs(this.x - this.startX) > this.patrolDistance) {
        this.facing *= -1;
      }
    }

    // Colisión dañina con el jugador
    if (
      this.x < player.x + player.width &&
      this.x + this.width > player.x &&
      this.y < player.y + player.height &&
      this.y + this.height > player.y
    ) {
      player.takeDamage(1, this.facing * 6);
    }
  }

  render(ctx, camera) {
    if (!this.alive) return;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;

    ctx.save();
    if (this.hitCooldown > 0) {
      ctx.filter = 'brightness(2.5)';
    }

    // Caparazón redondeado según bioma, contorno de tinta marrón
    const pal = (window.gameInstance && window.gameInstance.world && window.gameInstance.world.getCurrentBiome && window.gameInstance.world.getCurrentBiome().enemyPalette) || null;
    ctx.fillStyle = (pal && pal.crawlerFill) || '#c98a3a';
    ctx.strokeStyle = '#3a2416';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(sx + this.width / 2, sy + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Línea del caparazón y ojo de cartoon (blanco con pupila)
    ctx.beginPath();
    ctx.moveTo(sx + this.width / 2, sy + 2);
    ctx.lineTo(sx + this.width / 2, sy + this.height - 2);
    ctx.stroke();
    const eyeOffsetX = this.facing === 1 ? this.width * 0.78 : this.width * 0.22;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx + eyeOffsetX, sy + this.height / 2 - 3, 4, 0, Math.PI * 2);
    ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath();
    ctx.arc(sx + eyeOffsetX + this.facing * 1.2, sy + this.height / 2 - 2.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Enemigo Volador: Polilla de Trigo (tonos dorados de pradera)
class FlyingShadeEnemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.originX = x;
    this.originY = y;
    this.width = 30;
    this.height = 26;
    this.hp = 20;
    this.alive = true;
    this.hitCooldown = 0;
    this.angle = 0;
    this.speed = 1.6;
    this.detectionRadius = 240;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
  }

  takeDamage(amount, knockback = 0) {
    if (this.hitCooldown > 0 || !this.alive) return;
    this.hp -= amount;
    this.hitCooldown = 15;
    this.knockbackVx = knockback;
    this.knockbackVy = -3;
    window.soundManager.playHit();
    window.particleSystem.createHitImpact(this.x + this.width / 2, this.y + this.height / 2, 8);
    if (window.gameInstance) window.gameInstance.triggerScreenShake(4, 90);

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.alive = false;
    window.particleSystem.createDust(this.x + this.width / 2, this.y + this.height / 2, 10, '#e8c882');
    if (window.gameInstance && window.gameInstance.debrisItems) {
      window.gameInstance.debrisItems.push(new ThrowableDebris(this.x + 6, this.y));
    }
  }

  update(world, player) {
    if (!this.alive) return;

    if (this.hitCooldown > 0) this.hitCooldown--;

    if (Math.abs(this.knockbackVx) > 0.1 || Math.abs(this.knockbackVy) > 0.1) {
      this.x += this.knockbackVx;
      this.y += this.knockbackVy;
      this.knockbackVx *= 0.88;
      this.knockbackVy *= 0.88;
    } else {
      const dx = (player.x + player.width / 2) - (this.x + this.width / 2);
      const dy = (player.y + player.height / 2) - (this.y + this.height / 2);
      const dist = Math.hypot(dx, dy);

      if (dist > 0.5 && dist < this.detectionRadius) {
        // Acechar y descender lentamente hacia Ruben
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
      } else {
        // Flotación suave en su punto de origen
        this.angle += 0.04;
        this.y = this.originY + Math.sin(this.angle) * 16;
      }
    }

    // Colisión dañina con el jugador
    if (
      this.x < player.x + player.width &&
      this.x + this.width > player.x &&
      this.y < player.y + player.height &&
      this.y + this.height > player.y
    ) {
      player.takeDamage(1, (Math.sign(player.x - this.x) || 1) * 6);
    }
  }

  render(ctx, camera) {
    if (!this.alive) return;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;

    ctx.save();
    if (this.hitCooldown > 0) ctx.filter = 'brightness(2.5)';

    // Alas etéreas y cuerpo acordes a la zona
    const pal = (window.gameInstance && window.gameInstance.world && window.gameInstance.world.getCurrentBiome && window.gameInstance.world.getCurrentBiome().enemyPalette) || null;
    const wingFlap = Math.sin(Date.now() * 0.015) * 8;
    ctx.fillStyle = (pal && pal.mothWing) || 'rgba(232, 200, 130, 0.75)';
    ctx.strokeStyle = '#3a2416';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy + 6 - wingFlap, 12, 6, -0.4, 0, Math.PI * 2);
    ctx.ellipse(sx + this.width - 6, sy + 6 - wingFlap, 12, 6, 0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Cuerpo peludo
    ctx.fillStyle = (pal && pal.mothBody) || '#8a5a2b';
    ctx.strokeStyle = '#3a2416';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx + this.width / 2, sy + this.height / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ojos grandes de cartoon
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath();
    ctx.arc(sx + this.width / 2 - 3, sy + this.height / 2 - 1, 2, 0, Math.PI * 2);
    ctx.arc(sx + this.width / 2 + 3, sy + this.height / 2 - 1, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
