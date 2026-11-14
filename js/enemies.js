/**
 * Entidades Enemigas y Objetos Interactivos Arrojables
 */

// Paleta del bioma actual (colores de enemigos acordes a cada zona)
function getEnemyPalette() {
  const g = window.gameInstance;
  return (g && g.world && g.world.getCurrentBiome && g.world.getCurrentBiome().enemyPalette) || null;
}

// Utilidades de física y línea de visión compartidas por enemigos y objetos
function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Comprueba si el segmento (x1,y1)->(x2,y2) intersecta un rectángulo (rx,ry,rw,rh)
function segmentIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  // Slab method (Liang-Barsky)
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - rx, rx + rw - x1, y1 - ry, ry + rh - y1];

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-8) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

// Verifica si hay línea de visión despejada entre dos puntos respecto a las plataformas
function hasLineOfSight(world, x1, y1, x2, y2) {
  const plats = world.getPlatforms();
  for (const plat of plats) {
    if (segmentIntersectsRect(x1, y1, x2, y2, plat.x, plat.y, plat.w, plat.h)) {
      return false;
    }
  }
  return true;
}

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
    // Animación (solo visual)
    this.rot = 0;
    this.spawnPop = 1;        // aparece con un pequeño rebote
    this.carryLag = 0;        // retraso al seguir a Ruben (follow-through)
    this.trail = [];          // estela al ser lanzada
  }

  update(world, player, enemies) {
    if (!this.active) return;
    if (this.spawnPop > 0) this.spawnPop = Math.max(0, this.spawnPop - 0.06);

    if (this.isCarried) {
      // Posición sobre la cabeza del jugador (con un leve retraso y rebote al caminar)
      const targetX = player.x + player.width / 2 - this.width / 2;
      this.carryLag += ((targetX - this.x) - this.carryLag) * 0.35;
      this.x = targetX;
      const bob = player.walkPhase ? Math.abs(Math.sin(player.walkPhase)) * 2 : 0;
      this.y = player.y - this.height - 4 - bob;
      this.rot += (-this.carryLag * 0.04 - this.rot) * 0.25;
      return;
    }

    if (this.isThrown) {
      this.vy += 0.35; // Gravedad
      this.x += this.vx;
      this.y += this.vy;
      this.rot += this.vx * 0.045; // gira en el aire
      // Estela: al llenarse se recicla el punto más viejo (sin basura por cuadro)
      const tp = this.trail.length >= 7 ? this.trail.shift() : { x: 0, y: 0 };
      tp.x = this.x + this.width / 2; tp.y = this.y + this.height / 2;
      this.trail.push(tp);

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
          if (window.gameInstance && window.gameInstance.hitStop) window.gameInstance.hitStop(5);
          this.shatter();
          return;
        }
      }

      // Colisión con muros quebradizos ("defensa con ingenio")
      if (world.checkBreakableImpact && world.checkBreakableImpact({ x: this.x, y: this.y, w: this.width, h: this.height })) {
        this.shatter();
        return;
      }

      // Colisión con suelo / plataformas / paredes
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
      // Física suave en el suelo (por ejemplo cuando lo suelta un enemigo volador al morir)
      const prevBottom = this.y + this.height;
      this.vy = Math.min(10, this.vy + 0.35);
      this.x += this.vx;
      this.vx *= 0.85;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;

      const room = world.getCurrentRoom();
      const plats = world.getPlatforms();

      // Colisión horizontal para que no atraviese muros al caer
      for (const plat of plats) {
        if (aabbOverlap(this.x, this.y, this.width, this.height, plat.x, plat.y, plat.w, plat.h)) {
          if (this.vx > 0) this.x = plat.x - this.width;
          else if (this.vx < 0) this.x = plat.x + plat.w;
          this.vx = 0;
        }
      }
      if (room) {
        if (this.x < 0) { this.x = 0; this.vx = 0; }
        if (this.x + this.width > room.width) { this.x = room.width - this.width; this.vx = 0; }
      }

      this.y += this.vy;
      this.rot *= 0.8;
      this.isGrounded = false;

      for (const plat of plats) {
        if (
          this.x < plat.x + plat.w &&
          this.x + this.width > plat.x &&
          this.y + this.height >= plat.y &&
          prevBottom <= plat.y + 16 &&
          this.vy >= 0
        ) {
          const impact = this.vy;
          this.y = plat.y - this.height;
          if (impact > 3.2) {
            // Cae con fuerza: rebota una vez, gira un poco y levanta polvo
            this.vy = -impact * 0.28;
            this.rot = (this.vx >= 0 ? 1 : -1) * 0.35;
            if (window.particleSystem) window.particleSystem.createDust(this.x + this.width / 2, plat.y, 3);
          } else {
            this.vy = 0;
            this.isGrounded = true;
          }
          break;
        }
      }

      if (this.y > 1000) {
        this.active = false;
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
    const cx = sx + this.width / 2;
    const cy = sy + this.height / 2;
    const now = Date.now();

    // Estela de movimiento al volar
    if (this.isThrown && this.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < this.trail.length; i++) {
        const k = i / this.trail.length;
        ctx.strokeStyle = `rgba(255, 240, 210, ${k * 0.35})`;
        ctx.lineWidth = k * 9;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x - camera.x, this.trail[i - 1].y - camera.y);
        ctx.lineTo(this.trail[i].x - camera.x, this.trail[i].y - camera.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    // Brillo pulsante si está en el suelo para indicar que se puede recoger
    if (!this.isThrown && !this.isCarried) {
      ctx.shadowColor = '#ffe9a8';
      ctx.shadowBlur = 6 + (Math.sin(now * 0.005) + 1) * 5;
    }

    // Rebote de aparición (escala elástica)
    const pop = this.spawnPop > 0 ? 1 + Math.sin(this.spawnPop * Math.PI) * 0.35 : 1;
    ctx.translate(cx, cy);
    ctx.rotate(this.rot);
    ctx.scale(pop, pop);
    ctx.translate(-cx, -cy);

    ctx.fillStyle = '#8c7b66';
    ctx.strokeStyle = '#3a2416';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    // Forma irregular de roca/escombro
    ctx.beginPath();
    ctx.moveTo(sx + 4, sy);
    ctx.lineTo(sx + this.width - 2, sy + 3);
    ctx.lineTo(sx + this.width, sy + this.height - 2);
    ctx.lineTo(sx + 3, sy + this.height);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Sombreado inferior y brillo de luz en la piedra
    ctx.fillStyle = 'rgba(58, 36, 22, 0.25)';
    ctx.beginPath();
    ctx.moveTo(sx + this.width, sy + this.height - 2);
    ctx.lineTo(sx + 3, sy + this.height);
    ctx.lineTo(sx + 5, sy + this.height - 5);
    ctx.lineTo(sx + this.width - 2, sy + this.height - 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d8ccb8';
    ctx.beginPath();
    ctx.arc(sx + this.width / 2 - 2, sy + this.height / 2 - 2, 2.5, 0, Math.PI * 2);
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
    this.chaseSpeed = 2.05;
    this.facing = 1; // 1 = derecha, -1 = izquierda
    this.hp = 30;
    this.maxHp = 30;
    this.alive = true;
    this.hitCooldown = 0;
    this.knockbackVx = 0;
    this.vy = 0;
    this.gravity = 0.45;
    this.maxFallSpeed = 10;
    this.isGrounded = false;
    this.turnCooldown = 0;
    this.alert = 0;
    this.isChasing = false;
    // Animación (solo visual)
    this.animT = Math.random() * 10;
    this.sx = 1; this.vsx = 0;   // resorte de aplastamiento (giros y golpes)
    this.dyingTimer = 0;         // animación de derrota tras morir
    this.DYING_FRAMES = 26;
    this.edgeWait = 0;           // cuadros esperando al borde de un precipicio
  }

  takeDamage(amount, knockback = 0) {
    if (this.hitCooldown > 0 || !this.alive) return;
    this.hp -= amount;
    this.hitCooldown = 15;
    this.knockbackVx = knockback;
    this.vy = -2.6; // pequeño salto reactivo al recibir un golpe
    this.isGrounded = false;
    this.sx = 0.7; this.vsx = 0;
    window.soundManager.playHit();
    window.particleSystem.createHitImpact(this.x + this.width / 2, this.y + this.height / 2, 10);
    if (window.gameInstance) window.gameInstance.triggerScreenShake(5, 100);

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.alive = false;
    this.dyingTimer = this.DYING_FRAMES;
    window.particleSystem.createDust(this.x + this.width / 2, this.y + this.height / 2, 12, '#c98a3a');
    // Suelta un escombro arrojable al morir
    if (window.gameInstance && window.gameInstance.debrisItems) {
      const drop = new ThrowableDebris(this.x + 8, this.y - 4);
      drop.vy = -2.2;
      window.gameInstance.debrisItems.push(drop);
    }
  }

  // Verifica si hay suelo firme un paso más adelante para no caer en precipicios ni salirse de plataformas
  hasGroundAhead(world, dir) {
    const probeX = dir > 0 ? (this.x + this.width + 3) : (this.x - 3);
    const probeY = this.y + this.height + 4;
    for (const plat of world.getPlatforms()) {
      if (plat.type === 'ceiling' || plat.type === 'wall' || plat.type === 'locked-door') continue;
      if (
        probeX >= plat.x &&
        probeX <= plat.x + plat.w &&
        probeY >= plat.y &&
        probeY <= plat.y + plat.h + 10
      ) {
        return true;
      }
    }
    return false;
  }

  turnAround() {
    if (this.turnCooldown > 0) return;
    this.facing *= -1;
    this.turnCooldown = 12;
    this.sx = 0.82;
    this.vsx = 0;
  }

  update(world, player) {
    // Resorte de squash & stretch
    this.vsx = (this.vsx + (1 - this.sx) * 0.3) * 0.7;
    this.sx += this.vsx;

    if (!this.alive) {
      if (this.dyingTimer > 0) {
        this.dyingTimer--;
        if (this.dyingTimer === 0) {
          window.particleSystem.createDust(this.x + this.width / 2, this.y + this.height / 2, 8, '#e8d2a6');
        }
      }
      return;
    }

    if (this.hitCooldown > 0) this.hitCooldown--;
    if (this.turnCooldown > 0) this.turnCooldown--;
    if (this.alert > 0) this.alert--;

    const room = world.getCurrentRoom();
    const plats = world.getPlatforms();

    // 1. Detectar si Ruben está cerca y en la misma plataforma/altura con visión directa
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const dx = px - cx;
    const dy = py - cy;

    const canSeePlayer =
      !player.dead &&
      Math.abs(dx) < 210 &&
      Math.abs(dy) < 48 &&
      Math.abs(px - this.startX) < this.patrolDistance + 90 &&
      hasLineOfSight(world, cx, cy, px, py);

    if (canSeePlayer) {
      if (!this.isChasing) {
        this.isChasing = true;
        this.alert = 32;
        // Anticipación: da un respingo de sorpresa antes de cargar
        this.sx = 0.8; this.vsx = 0;
        if (this.isGrounded) { this.vy = -3; this.isGrounded = false; }
      }
      const desiredFacing = Math.sign(dx);
      if (desiredFacing !== 0 && desiredFacing !== this.facing && this.turnCooldown === 0 && Math.abs(dx) > 12) {
        this.facing = desiredFacing;
        this.turnCooldown = 14;
        this.sx = 0.85; this.vsx = 0;
      }
    } else {
      this.isChasing = false;
    }

    // 2. Movimiento horizontal (knockback o patrullaje/embestida)
    let moveVx = 0;
    if (Math.abs(this.knockbackVx) > 0.1) {
      moveVx = this.knockbackVx;
      this.knockbackVx *= 0.82;
      if (Math.abs(this.knockbackVx) <= 0.1) this.knockbackVx = 0;
    } else {
      let currentSpeed = this.isChasing ? this.chaseSpeed : this.speed;
      // Durante el respingo de sorpresa se queda en el lugar
      if (this.isChasing && this.alert > 20) currentSpeed = 0;

      // Antes de avanzar, comprobar si hay precipicio adelante
      const atEdge = this.isGrounded && !this.hasGroundAhead(world, this.facing);
      if (atEdge && this.isChasing && Math.sign(dx) === this.facing) {
        // Ruben está del otro lado del precipicio: lo espera en el borde, impaciente
        // (antes se daba vuelta y volvía cada pocos cuadros, temblando en el borde)
        currentSpeed = 0;
        if (this.edgeWait++ % 34 === 0) { this.sx = 0.86; this.vsx = 0; }
      } else if (atEdge) {
        this.edgeWait = 0;
        this.turnAround();
        // Reanclar el centro de patrulla para no quedar atrapado contra un borde
        this.startX = this.x + this.facing * Math.min(60, this.patrolDistance * 0.5);
      } else if (!this.isChasing) {
        // Solo voltear si se aleja más allá de su distancia de patrulla Y sigue caminando hacia afuera
        const offset = this.x - this.startX;
        if ((offset > this.patrolDistance && this.facing > 0) || (offset < -this.patrolDistance && this.facing < 0)) {
          this.turnAround();
        }
      }

      moveVx = currentSpeed * this.facing;
      this.animT += currentSpeed > 0 ? currentSpeed * 0.22 : 0.05;
    }

    // Aplicar desplazamiento X y resolver colisiones con muros/plataformas
    this.x += moveVx;
    let hitWall = false;
    for (const plat of plats) {
      if (aabbOverlap(this.x, this.y, this.width, this.height, plat.x, plat.y, plat.w, plat.h)) {
        if (moveVx > 0) {
          this.x = plat.x - this.width;
          hitWall = true;
        } else if (moveVx < 0) {
          this.x = plat.x + plat.w;
          hitWall = true;
        }
      }
    }

    // Límites de la sala
    if (room) {
      if (this.x < 0) {
        this.x = 0;
        hitWall = true;
      } else if (this.x + this.width > room.width) {
        this.x = room.width - this.width;
        hitWall = true;
      }
    }

    if (hitWall) {
      if (Math.abs(this.knockbackVx) > 0.1) {
        this.knockbackVx = 0;
      } else {
        this.turnAround();
        this.startX = this.x + this.facing * Math.min(60, this.patrolDistance * 0.5);
      }
    }

    // 3. Gravedad y colisiones verticales (suelo y techo)
    this.vy = Math.min(this.maxFallSpeed, this.vy + this.gravity);
    this.y += this.vy;
    this.isGrounded = false;

    for (const plat of plats) {
      if (aabbOverlap(this.x, this.y, this.width, this.height, plat.x, plat.y, plat.w, plat.h)) {
        if (this.vy > 0) {
          // Aterrizaje con peso: se aplasta y levanta polvo según la caída
          if (this.vy > 4.5) {
            this.sx = 1.22; this.vsx = 0;
            window.particleSystem.createDust(this.x + this.width / 2, plat.y, 4);
          }
          this.y = plat.y - this.height;
          this.vy = 0;
          this.isGrounded = true;
        } else if (this.vy < 0) {
          this.y = plat.y + plat.h;
          this.vy = 0;
        }
      }
    }

    // Si por algún motivo cae al vacío, muere limpiamente
    if (room && this.y > room.height + 60) {
      this.alive = false;
      this.dyingTimer = 0;
      return;
    }

    // 4. Colisión dañina con el jugador
    if (aabbOverlap(this.x, this.y, this.width, this.height, player.x, player.y, player.width, player.height)) {
      const knockDir = Math.sign((player.x + player.width / 2) - (this.x + this.width / 2)) || this.facing;
      player.takeDamage(1, knockDir * 6);
    }
  }

  render(ctx, camera) {
    if (!this.alive && this.dyingTimer <= 0) return;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    const cx = sx + this.width / 2;
    const baseY = sy + this.height;
    const f = this.facing;
    const pal = getEnemyPalette();
    const flash = this.hitCooldown > 9; // destello blanco en los primeros cuadros del golpe
    const OUT = '#3a2416';
    const SHELL = flash ? '#fff8ec' : ((pal && pal.crawlerFill) || '#c98a3a');

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Derrota: queda patas arriba, salta y se desvanece
    let dyingK = 0;
    if (!this.alive) {
      dyingK = 1 - this.dyingTimer / this.DYING_FRAMES; // 0 -> 1
      ctx.globalAlpha = Math.max(0, 1 - Math.pow(dyingK, 2));
      const hop = Math.sin(Math.min(1, dyingK * 1.6) * Math.PI) * 14;
      ctx.translate(0, -hop);
      // Se da vuelta (patas arriba) girando sobre su centro
      const ccy = sy + this.height / 2;
      ctx.translate(cx, ccy);
      ctx.rotate(Math.PI * Math.min(1, dyingK * 2.2) * f);
      ctx.translate(-cx, -ccy);
    }

    // Sombra de contacto
    ctx.fillStyle = 'rgba(40, 22, 10, 0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 1, this.width * 0.45 * this.sx, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Squash & stretch desde la base + leve balanceo al caminar
    const walkBob = this.alive ? Math.abs(Math.sin(this.animT)) * 1.4 : 0;
    const sy2 = 1 / this.sx;
    ctx.translate(cx, baseY);
    ctx.scale(this.sx, sy2);
    ctx.rotate(this.alive ? Math.sin(this.animT) * 0.04 : 0);
    ctx.translate(-cx, -baseY - walkBob);

    // Patitas (3 por lado visibles, en trípode alternado)
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const lx = sx + 8 + i * 9;
      const ph = this.animT * 2 + i * 2.1;
      const swing = this.alive ? Math.sin(ph) * 3 : Math.sin(Date.now() * 0.03 + i) * 3; // pataleo al morir
      const lift = this.alive ? Math.max(0, Math.cos(ph)) * 2 : 0;
      ctx.beginPath();
      ctx.moveTo(lx, sy + this.height - 5);
      ctx.quadraticCurveTo(lx + swing * 0.5 + f * 2, sy + this.height - 1 - lift, lx + swing + f * 2, sy + this.height + 2 + walkBob - lift);
      ctx.stroke();
    }

    // Caparazón redondeado según bioma, contorno de tinta marrón
    ctx.fillStyle = SHELL;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, sy + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Brillo del caparazón (barniz de animación clásica)
    if (!flash) {
      ctx.fillStyle = 'rgba(255, 245, 220, 0.35)';
      ctx.beginPath();
      ctx.ellipse(cx - f * 5, sy + 6, 7, 3, -0.3 * f, 0, Math.PI * 2);
      ctx.fill();
    }

    // Línea del caparazón y ojo de cartoon (blanco con pupila)
    ctx.beginPath();
    ctx.moveTo(cx, sy + 2);
    ctx.lineTo(cx, sy + this.height - 2);
    ctx.stroke();
    const eyeOffsetX = f === 1 ? this.width * 0.78 : this.width * 0.22;
    const ey = sy + this.height / 2 - 3;
    const blink = this.alive && ((Date.now() * 0.001 + this.startX * 0.01) % 4) < 0.12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx + eyeOffsetX, ey, 4, 0, Math.PI * 2);
    ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
    if (!this.alive) {
      // Ojo en espiral / cruz al ser derrotado
      ctx.beginPath();
      ctx.moveTo(sx + eyeOffsetX - 2, ey - 2); ctx.lineTo(sx + eyeOffsetX + 2, ey + 2);
      ctx.moveTo(sx + eyeOffsetX + 2, ey - 2); ctx.lineTo(sx + eyeOffsetX - 2, ey + 2);
      ctx.stroke();
    } else if (blink) {
      ctx.beginPath();
      ctx.moveTo(sx + eyeOffsetX - 3, ey); ctx.lineTo(sx + eyeOffsetX + 3, ey);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#2b1a10';
      ctx.beginPath();
      ctx.arc(sx + eyeOffsetX + f * 1.2, ey + 0.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Antenas que se mecen con el paso
    ctx.lineWidth = 1.5;
    const antX = sx + eyeOffsetX;
    for (const k of [0, 1]) {
      const sway = Math.sin(this.animT * 1.5 + k) * 2;
      ctx.beginPath();
      ctx.moveTo(antX - f * 2 + k * f * 3, sy + 3);
      ctx.quadraticCurveTo(antX + f * 4 + k * f * 2, sy - 5, antX + f * 7 + sway + k * f * 2, sy - 6 + k * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Señal de alerta "!" cuando el escarabajo detecta a Ruben y carga
    if (this.alive && this.alert > 0) {
      const k = 1 - this.alert / 32;
      const pop = k < 0.25 ? Math.sin((k / 0.25) * Math.PI * 0.5) * 1.2 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.alert / 10);
      ctx.translate(cx, sy - 10);
      ctx.scale(pop, pop);
      ctx.font = '800 14px Cinzel, Georgia, serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#3a2416';
      ctx.fillStyle = '#ffe28a';
      ctx.strokeText('!', 0, 0);
      ctx.fillText('!', 0, 0);
      ctx.restore();
    }
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
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 1.65;
    this.returnSpeed = 1.25;
    this.detectionRadius = 250;
    this.leashRadius = 380; // distancia máxima que se aleja de su nido antes de regresar
    this.vx = 0;
    this.vy = 0;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    // Animación (solo visual)
    this.flapT = Math.random() * 10;
    this.tilt = 0;
    this.prevX = x;
    this.lookX = 1;
    this.dyingTimer = 0;
    this.DYING_FRAMES = 28;
    this.alert = 0;   // "¡!" breve al detectar a Ruben
    this.wasChasing = false;
    this.loseSightTimer = 0; // memoria breve tras perder de vista a Ruben
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
    this.dyingTimer = this.DYING_FRAMES;
    window.particleSystem.createDust(this.x + this.width / 2, this.y + this.height / 2, 10, '#e8c882');
    if (window.gameInstance && window.gameInstance.debrisItems) {
      const drop = new ThrowableDebris(this.x + 6, this.y);
      drop.vy = -1.5;
      window.gameInstance.debrisItems.push(drop);
    }
  }

  // Movimiento con resolución de colisiones por ejes (permite deslizarse por paredes y techos sin atravesarlos)
  moveWithCollisions(world, dx, dy) {
    const plats = world.getPlatforms();
    const room = world.getCurrentRoom();

    // Eje X
    this.x += dx;
    for (const plat of plats) {
      if (aabbOverlap(this.x, this.y, this.width, this.height, plat.x, plat.y, plat.w, plat.h)) {
        if (dx > 0) {
          this.x = plat.x - this.width;
        } else if (dx < 0) {
          this.x = plat.x + plat.w;
        }
        this.vx = 0;
        this.knockbackVx = 0;
      }
    }
    if (room) {
      if (this.x < 4) { this.x = 4; this.vx = 0; }
      if (this.x + this.width > room.width - 4) { this.x = room.width - 4 - this.width; this.vx = 0; }
    }

    // Eje Y
    this.y += dy;
    for (const plat of plats) {
      if (aabbOverlap(this.x, this.y, this.width, this.height, plat.x, plat.y, plat.w, plat.h)) {
        if (dy > 0) {
          this.y = plat.y - this.height;
        } else if (dy < 0) {
          this.y = plat.y + plat.h;
        }
        this.vy = 0;
        this.knockbackVy = 0;
      }
    }
    if (room) {
      if (this.y < 22) { this.y = 22; this.vy = 0; }
      if (this.y + this.height > room.height - 4) { this.y = room.height - 4 - this.height; this.vy = 0; }
    }
  }

  update(world, player) {
    if (!this.alive) {
      if (this.dyingTimer > 0) {
        this.dyingTimer--;
        this.moveWithCollisions(world, Math.sin(this.dyingTimer * 0.5) * 1.5, 1.4);
      }
      return;
    }

    if (this.hitCooldown > 0) this.hitCooldown--;
    if (this.alert > 0) this.alert--;

    let chasing = false;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;

    if (Math.abs(this.knockbackVx) > 0.1 || Math.abs(this.knockbackVy) > 0.1) {
      this.moveWithCollisions(world, this.knockbackVx, this.knockbackVy);
      this.knockbackVx *= 0.85;
      this.knockbackVy *= 0.85;
      if (Math.abs(this.knockbackVx) <= 0.1) this.knockbackVx = 0;
      if (Math.abs(this.knockbackVy) <= 0.1) this.knockbackVy = 0;
    } else {
      const dx = px - cx;
      const dy = py - cy;
      const distToPlayer = Math.hypot(dx, dy);
      const distFromOrigin = Math.hypot(cx - this.originX, cy - this.originY);

      // Comprobar si Ruben está a la vista y dentro del rango
      const hasSight =
        !player.dead &&
        distToPlayer < this.detectionRadius &&
        distFromOrigin < this.leashRadius &&
        hasLineOfSight(world, cx, cy, px, py);

      if (hasSight) {
        this.loseSightTimer = 35; // mantiene persecución unos instantes aunque cruce un borde pequeño
      } else if (this.loseSightTimer > 0) {
        this.loseSightTimer--;
      }

      if ((hasSight || this.loseSightTimer > 0) && !player.dead && distToPlayer > 0.5 && distFromOrigin < this.leashRadius) {
        // Perseguir suavemente con inercia (sin teletransportación jamás)
        const targetVx = (dx / distToPlayer) * this.speed;
        const targetVy = (dy / distToPlayer) * this.speed + Math.sin(this.flapT * 0.5) * 0.25;
        this.vx += (targetVx - this.vx) * 0.18;
        this.vy += (targetVy - this.vy) * 0.18;
        this.moveWithCollisions(world, this.vx, this.vy);
        chasing = true;
        this.lookX = Math.sign(dx) || this.lookX;
      } else {
        // Regresar de forma continua y suave hacia su posición de patrulla (en figura de 8 / onda suave)
        this.angle += 0.035;
        const patrolTargetX = this.originX + Math.sin(this.angle * 0.7) * 22;
        const patrolTargetY = this.originY + Math.sin(this.angle * 1.4) * 14;
        const toOrigX = patrolTargetX - this.x;
        const toOrigY = patrolTargetY - this.y;
        const distOrig = Math.hypot(toOrigX, toOrigY);

        let targetVx = 0;
        let targetVy = 0;
        if (distOrig > 1.5) {
          const spd = Math.min(this.returnSpeed, distOrig * 0.08);
          targetVx = (toOrigX / distOrig) * spd;
          targetVy = (toOrigY / distOrig) * spd;
        }
        this.vx += (targetVx - this.vx) * 0.15;
        this.vy += (targetVy - this.vy) * 0.15;
        this.moveWithCollisions(world, this.vx, this.vy);
        if (Math.abs(this.vx) > 0.15) {
          this.lookX = Math.sign(this.vx);
        }
      }
    }

    if (chasing && !this.wasChasing) this.alert = 40;
    this.wasChasing = chasing;

    // Inclinación según la velocidad horizontal real y aleteo más rápido al perseguir
    const realVx = this.x - this.prevX;
    this.prevX = this.x;
    this.tilt += (realVx * 0.18 - this.tilt) * 0.15;
    this.flapT += chasing ? 0.42 : 0.28;

    // Colisión dañina con el jugador
    if (aabbOverlap(this.x, this.y, this.width, this.height, player.x, player.y, player.width, player.height)) {
      const knockDir = Math.sign((player.x + player.width / 2) - (this.x + this.width / 2)) || 1;
      player.takeDamage(1, knockDir * 6);
      // Pequeño rebote hacia atrás tras picar a Ruben para no quedarse pegada encima de él
      this.knockbackVx = -knockDir * 2.4;
      this.knockbackVy = -1.8;
    }
  }

  render(ctx, camera) {
    if (!this.alive && this.dyingTimer <= 0) return;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    const cx = sx + this.width / 2;
    const cy = sy + this.height / 2;
    const pal = getEnemyPalette();
    const flash = this.hitCooldown > 9;
    const OUT = '#3a2416';

    ctx.save();
    ctx.lineJoin = 'round';
    if (!this.alive) {
      const k = 1 - this.dyingTimer / this.DYING_FRAMES;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
    }

    // Aleteo: las alas se pliegan (escala vertical) en vez de solo desplazarse
    const flap = this.alive ? Math.sin(this.flapT) : Math.sin(this.flapT + this.dyingTimer) * 0.3;
    const wingScale = 0.35 + (flap + 1) * 0.35;  // 0.35 .. 1.05
    const bodyBob = -flap * 1.5;                  // el cuerpo sube cuando las alas bajan

    ctx.translate(cx, cy + bodyBob);
    ctx.rotate(this.alive ? this.tilt : this.dyingTimer * 0.3);
    // Golpe: se aplasta y vuelve con un rebote (squash & stretch)
    if (this.alive && this.hitCooldown > 0) {
      const hk = this.hitCooldown / 15, wob = Math.sin(hk * Math.PI * 2.5) * hk;
      ctx.scale(1 + wob * 0.28, 1 - wob * 0.24);
    }
    ctx.translate(-cx, -cy);

    // Alas etéreas y cuerpo acordes a la zona
    ctx.fillStyle = flash ? '#fff8ec' : ((pal && pal.mothWing) || 'rgba(232, 200, 130, 0.75)');
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.2;
    for (const k of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + k * 3, cy - 2);
      ctx.scale(1, wingScale);
      ctx.rotate(k * (0.4 + flap * 0.15));
      // Ala superior
      ctx.beginPath();
      ctx.ellipse(k * 10, -6, 12, 6.5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Ala inferior más pequeña
      ctx.beginPath();
      ctx.ellipse(k * 7, 3, 7, 4.5, k * 0.5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Mancha decorativa del ala
      ctx.fillStyle = 'rgba(58, 36, 22, 0.25)';
      ctx.beginPath();
      ctx.arc(k * 12, -6, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = flash ? '#fff8ec' : ((pal && pal.mothWing) || 'rgba(232, 200, 130, 0.75)');
    }

    // Cuerpo peludo
    ctx.fillStyle = flash ? '#fff8ec' : ((pal && pal.mothBody) || '#8a5a2b');
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 9, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Antenas plumosas
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    for (const k of [-1, 1]) {
      const sway = Math.sin(this.flapT * 0.5 + k) * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + k * 3, cy - 9);
      ctx.quadraticCurveTo(cx + k * 6, cy - 16, cx + k * 9 + sway, cy - 17);
      ctx.stroke();
    }

    // Ojos grandes de cartoon que siguen a Ruben
    const look = this.lookX * 0.8;
    if (!this.alive) {
      ctx.strokeStyle = '#2b1a10';
      ctx.lineWidth = 1.2;
      for (const k of [-1, 1]) {
        const ex = cx + k * 3.5;
        ctx.beginPath();
        ctx.moveTo(ex - 1.5, cy - 2.5); ctx.lineTo(ex + 1.5, cy + 0.5);
        ctx.moveTo(ex + 1.5, cy - 2.5); ctx.lineTo(ex - 1.5, cy + 0.5);
        ctx.stroke();
      }
    } else if (((Date.now() * 0.001 + this.originX * 0.013) % 3.4) < 0.11) {
      // Parpadeo
      ctx.strokeStyle = '#2b1a10';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 5.5, cy - 1); ctx.lineTo(cx - 1.5, cy - 1);
      ctx.moveTo(cx + 1.5, cy - 1); ctx.lineTo(cx + 5.5, cy - 1);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 3.5, cy - 1, 2.8, 0, Math.PI * 2);
      ctx.arc(cx + 3.5, cy - 1, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b1a10';
      ctx.beginPath();
      ctx.arc(cx - 3.5 + look, cy - 0.6, 1.6, 0, Math.PI * 2);
      ctx.arc(cx + 3.5 + look, cy - 0.6, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Señal de alerta "!" al detectar a Ruben (aparece con rebote y se desvanece)
    if (this.alive && this.alert > 0) {
      const k = 1 - this.alert / 40;
      const pop = k < 0.2 ? Math.sin((k / 0.2) * Math.PI * 0.5) * 1.25 : 1 + (0.25 * Math.max(0, 0.3 - k));
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.alert / 12);
      ctx.translate(cx, sy - 14);
      ctx.scale(pop, pop);
      ctx.font = '800 16px Cinzel, Georgia, serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#3a2416';
      ctx.fillStyle = '#ffe28a';
      ctx.strokeText('!', 0, 0);
      ctx.fillText('!', 0, 0);
      ctx.restore();
    }
  }
}
