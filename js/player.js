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

    // Estado de animación (solo visual: no afecta física ni hitboxes)
    this.anim = {
      sy: 1, vsy: 0,        // resorte de squash & stretch vertical (sx = 1/sy conserva el volumen)
      sx: 1, vsx: 0,        // resorte horizontal (giros y golpes)
      lean: 0,              // inclinación del cuerpo según la velocidad
      flip: 0,              // voltereta del doble salto (1 -> 0)
      hurtFlash: 0,         // cuadros de destello blanco al recibir daño
      swingDir: 1,          // alterna el sentido del tajo (combo arriba/abajo)
      lunge: 0,             // pequeño avance del cuerpo al atacar
      runDust: 0,           // temporizador de bocanadas de polvo al correr
      lastFacing: 1,
      fallSpeed: 0,         // velocidad de caída previa al aterrizaje
      deathVy: 0, deathY: 0, deathRot: 0
    };

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
      // Estirón de despegue (el resorte vuelve solo a la forma normal)
      this.anim.sy = 1.28; this.anim.vsy = 0;
      window.soundManager.playJump();
      window.particleSystem.createDust(this.x + this.width / 2, this.y + this.height, 8);
    } else if (this.canDoubleJump) {
      this.vy = this.doubleJumpForce;
      this.canDoubleJump = false;
      this.hasUsedDoubleJump = true;
      // Voltereta completa en el aire + estirón
      this.anim.flip = 1;
      this.anim.sy = 1.2; this.anim.vsy = 0;
      window.soundManager.playDoubleJump();
      window.particleSystem.createDoubleJumpSparks(this.x + this.width / 2, this.y + this.height);
      if (window.gameInstance) window.gameInstance.triggerScreenShake(2, 60);
    }
  }

  attack(enemies, aim = {}) {
    if (this.attackCooldown > 0 || this.isAttacking || this.dead) return;

    // Dirección del tajo: adelante, arriba, abajo (solo en el aire) o diagonales.
    // aimAng está en el marco de Ruben: 0 = adelante, -90° = arriba, +90° = abajo.
    if (aim.right) this.facing = 1;
    if (aim.left) this.facing = -1;
    const horiz = !!(aim.left || aim.right);
    let vert = 0;
    if (aim.up) vert = -1;
    else if (aim.down && !this.isGrounded) vert = 1;
    else if (aim.down && horiz) vert = 1;   // en el suelo: abajo-adelante (barrido bajo)
    if (vert === 0) this.attackAim = 0;
    else if (horiz) this.attackAim = vert * Math.PI / 4;
    else this.attackAim = vert * Math.PI / 2;
    const dirX = this.facing * Math.cos(this.attackAim);
    const dirY = Math.sin(this.attackAim);
    this.isAttacking = true;
    this.attackTimer = this.attackDuration;
    this.attackCooldown = 18;
    // Cada tajo alterna el sentido (combo) y da un pequeño impulso visual
    this.anim.swingDir *= -1;
    this.anim.lunge = 1;
    this.anim.sx = 1.12; this.anim.vsx = 0;
    window.soundManager.playSlash();
    let connected = false;

    // Actualizar hitbox de ataque según la dirección
    // Caja de golpe centrada a ~32 px del cuerpo en la dirección del tajo
    const vertical = Math.abs(dirY) > 0.9;
    this.attackBox.w = vertical ? 50 : 46;
    this.attackBox.h = vertical ? 46 : 42;
    const bcx = this.x + this.width / 2 + dirX * 34;
    const bcy = this.y + this.height / 2 + dirY * 36;
    this.attackBox.x = bcx - this.attackBox.w / 2;
    this.attackBox.y = bcy - this.attackBox.h / 2;

    // Comprobar colisión con enemigos
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (
        this.attackBox.x < enemy.x + enemy.width &&
        this.attackBox.x + this.attackBox.w > enemy.x &&
        this.attackBox.y < enemy.y + enemy.height &&
        this.attackBox.y + this.attackBox.h > enemy.y
      ) {
        enemy.takeDamage(15, (dirX || this.facing * 0.5) * 8);
        // Chispas en el punto de contacto
        const hx = Math.max(enemy.x, Math.min(enemy.x + enemy.width, this.x + this.width / 2 + dirX * 16));
        const hy = Math.max(enemy.y, Math.min(enemy.y + enemy.height, this.y + this.height / 2 + dirY * 16));
        window.particleSystem.createSlashSparks(hx, hy, this.facing);
        connected = true;
      }
    }
    if (connected) {
      if (dirY > 0.5 && !this.isGrounded) {
        // Pogo: el tajo hacia abajo rebota a Ruben y le devuelve el doble salto
        this.vy = -8.6;
        this.canDoubleJump = true;
        this.hasUsedDoubleJump = false;
        this.coyoteTime = 0;
      } else if (Math.abs(dirX) > 0.5) {
        // Retroceso sutil al golpear de frente
        this.vx = -this.facing * 2.5;
      }
    }

    // "Hit-stop": congelar unos cuadros al conectar le da peso al golpe
    if (connected && window.gameInstance && window.gameInstance.hitStop) {
      window.gameInstance.hitStop(5);
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
          const grabKey = (window.gameInstance.controlsManager && window.gameInstance.controlsManager.getPrimaryDisplayKey('grab')) || 'K';
          window.gameInstance.showNotification(`¡Objeto recogido! Presiona ${grabKey} para lanzarlo`);
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
    // Destello blanco + aplastamiento por el impacto
    this.anim.hurtFlash = 7;
    this.anim.sx = 0.78; this.anim.vsx = 0;
    if (window.gameInstance) {
      window.gameInstance.damageFlash = 1;
      if (window.gameInstance.hitStop) window.gameInstance.hitStop(4);
    }
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

  update(world, keys, controlsManager = null) {
    // Control horizontal fluido según configuración de teclas o valor por defecto
    let moveDir = 0;
    const isRight = controlsManager
      ? controlsManager.isActive('moveRight', keys)
      : (keys['ArrowRight'] || keys['KeyD'] || keys['PadRight']);
    const isLeft = controlsManager
      ? controlsManager.isActive('moveLeft', keys)
      : (keys['ArrowLeft'] || keys['KeyA'] || keys['PadLeft']);

    if (isRight) moveDir += 1;
    if (isLeft) moveDir -= 1;

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
    const impactVy = this.vy; // velocidad justo antes de tocar el suelo
    this.y += this.vy;
    this.handleVerticalCollisions(world);

    // Lógica de aterrizaje y coyote time
    if (!wasGrounded && this.isGrounded) {
      // Impacto proporcional a la velocidad de caída
      const impact = Math.min(1, Math.max(0, impactVy) / this.maxFallSpeed);
      window.particleSystem.createDust(this.x + this.width / 2, this.y + this.height, 4 + Math.round(impact * 8));
      if (impact > 0.75) {
        window.particleSystem.createShockwave(this.x + this.width / 2, this.y + this.height, 26, 'rgba(255, 236, 196, 0.8)', 2.5);
      }
      this.anim.sy = 1 - (0.12 + impact * 0.26); this.anim.vsy = 0;
      this.anim.flip = 0;
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

    // Animación procedural (resortes, inclinación, polvo)
    this.updateAnimation(moveDir);
  }

  // Resortes amortiguados: dan un rebote orgánico en lugar de cambios bruscos
  updateAnimation(moveDir) {
    const a = this.anim;
    const K = 0.3, DAMP = 0.68;
    a.vsy = (a.vsy + (1 - a.sy) * K) * DAMP;
    a.sy += a.vsy;
    a.vsx = (a.vsx + (1 - a.sx) * K) * DAMP;
    a.sx += a.vsx;

    // Giro: pequeño aplastamiento horizontal al cambiar de dirección + derrape
    if (this.facing !== a.lastFacing) {
      a.sx = 0.8; a.vsx = 0;
      if (this.isGrounded && Math.abs(this.vx) > 1.5) {
        window.particleSystem.createRunPuff(this.x + this.width / 2, this.y + this.height, this.facing, 4);
      }
      a.lastFacing = this.facing;
    }

    // Inclinación hacia donde corre (y hacia atrás al frenar)
    let leanTarget = (this.vx / this.speed) * 0.13;
    if (!this.isGrounded) leanTarget *= 0.6;
    if (moveDir === 0 && this.isGrounded) leanTarget = -(this.vx / this.speed) * 0.08;
    a.lean += (leanTarget - a.lean) * 0.2;

    // Voltereta del doble salto
    if (a.flip > 0) a.flip = Math.max(0, a.flip - 1 / 24);
    if (a.lunge > 0) a.lunge = Math.max(0, a.lunge - 1 / 10);
    if (a.hurtFlash > 0) a.hurtFlash--;

    // Bocanadas de polvo al correr, sincronizadas con los pasos
    if (this.isGrounded && Math.abs(this.vx) > 2.5) {
      a.runDust -= Math.abs(this.vx) * 0.11;
      if (a.runDust <= 0) {
        a.runDust = Math.PI; // un paso por medio ciclo de caminata
        window.particleSystem.createRunPuff(this.x + this.width / 2 - this.facing * 6, this.y + this.height, -this.facing, 1);
      }
    } else {
      a.runDust = 0;
    }
  }

  // Animación de derrota estilo cartoon: salta, gira y cae fuera de cuadro
  updateDeath() {
    const a = this.anim;
    a.deathVy += 0.42;
    a.deathY += a.deathVy;
    a.deathRot += 0.16 * this.facing;
  }

  startDeath() {
    const a = this.anim;
    a.deathVy = -7.5;
    a.deathY = 0;
    a.deathRot = 0;
    a.hurtFlash = 8;
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
    const a = this.anim;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    const cx = sx + this.width / 2;
    const feetY = sy + this.height;
    const t = Date.now() * 0.001;
    const f = this.facing;
    const flash = a.hurtFlash > 0 && Math.floor(a.hurtFlash / 2) % 2 === 0;
    const idle = this.isGrounded && Math.abs(this.vx) < 0.3 && !this.isAttacking;

    // Squash & stretch: resorte (aterrizaje/salto/golpe) + estirón por velocidad vertical
    let stretchY = a.sy;
    if (!this.isGrounded && !this.dead) stretchY *= 1 + Math.min(0.12, Math.abs(this.vy) * 0.011);
    if (idle) stretchY *= 1 + Math.sin(t * 2.6) * 0.018; // respiración en reposo
    const scaleY = stretchY * (1 + (1 - a.sx) * 0.5);
    const scaleX = a.sx / stretchY;

    // Balanceo al caminar: el cuerpo rebota dos veces por ciclo
    const bob = this.walkPhase ? -Math.abs(Math.sin(this.walkPhase)) * 2.5 : 0;
    // Pequeño avance del cuerpo al lanzar el tajo
    const lungeX = f * Math.sin(a.lunge * Math.PI) * 3;

    const OUT = '#3a2416';      // contorno marrón cálido (tinta de animación)
    const W = '#fff8ec';        // color del destello de daño
    const SKIN = flash ? W : '#f2c79b';
    const HAIR = flash ? W : '#b5562b';     // pelo cobrizo
    const TUNIC = flash ? W : '#3f7d5a';    // túnica verde bosque
    const SCARF = flash ? W : '#d9a634';    // bufanda mostaza (el color de la familia)
    const BOOT = flash ? W : '#6b3f22';

    // Sombra de contacto en el suelo (se encoge al aplastarse/estirarse)
    if (this.isGrounded && !this.dead) {
      ctx.save();
      ctx.fillStyle = 'rgba(40, 22, 10, 0.22)';
      ctx.beginPath();
      ctx.ellipse(cx + lungeX, feetY + 1, 11 * scaleX, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    if (!flash && !this.dead && this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUT;

    // Derrota: Ruben salta y gira hacia afuera del cuadro
    if (this.dead) {
      const pcx = cx, pcy = sy + this.height / 2 + a.deathY;
      ctx.translate(0, a.deathY);
      ctx.translate(pcx, pcy - a.deathY);
      ctx.rotate(a.deathRot);
      ctx.translate(-pcx, -(pcy - a.deathY));
    }

    // Escalado desde los pies (squash & stretch) + inclinación + avance del tajo
    ctx.translate(cx + lungeX, feetY);
    ctx.rotate(a.lean);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-cx, -feetY);

    // Voltereta del doble salto alrededor del centro del cuerpo (con aceleración y frenado)
    if (a.flip > 0) {
      const p = 1 - a.flip;
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const pcy = sy + this.height / 2;
      ctx.translate(cx, pcy);
      ctx.rotate(e * Math.PI * 2 * f);
      ctx.translate(-cx, -pcy);
    }

    // 1. Cola de la bufanda (cinta que se afina)
    {
      const P = this.capePoints.map(p => ({ x: p.x - camera.x - lungeX, y: p.y - camera.y + bob }));
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
    //    En el aire: recogidas al subir, abiertas al caer.
    ctx.fillStyle = BOOT;
    const rising = this.vy < -1;
    for (const k of [-1, 1]) {
      const ph = this.walkPhase + (k === 1 ? 0 : Math.PI);
      const stepX = this.walkPhase ? Math.cos(ph) * 4.5 * f : 0;
      const lift = this.walkPhase ? Math.max(0, Math.sin(ph)) * 3.5 : 0;
      const airTuck = this.isGrounded ? 0 : (rising ? 4 : 1);
      const airSpread = this.isGrounded || rising ? 0 : k * 1.5;
      const footAng = this.walkPhase ? -Math.sin(ph) * 0.25 * f : 0; // la punta acompaña el paso
      ctx.beginPath();
      ctx.ellipse(cx + k * 4 + stepX + airSpread + f * 0.8, feetY - 3 - lift - airTuck, 5, 3.5, footAng, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // Todo lo de arriba de las piernas rebota con el paso
    ctx.translate(0, bob);

    // 3. Cuerpo: túnica en forma de pera con cinturón (el ruedo flamea al moverse)
    const hemSwing = Math.sin(this.walkPhase * 2) * 1.2 - (this.vx / this.speed) * 1.5;
    ctx.fillStyle = TUNIC;
    ctx.beginPath();
    ctx.moveTo(cx - 6, sy + 17);
    ctx.quadraticCurveTo(cx - 12 + hemSwing, feetY - 4, cx - 9 + hemSwing, feetY - 5);
    ctx.lineTo(cx + 9 + hemSwing, feetY - 5);
    ctx.quadraticCurveTo(cx + 12 + hemSwing, feetY - 4, cx + 6, sy + 17);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = BOOT;
    ctx.fillRect(cx - 10, sy + 28, 20, 3);

    // Morral con las notas de Angelo (se mece con el paso)
    const bagSwing = Math.sin(this.walkPhase + 0.6) * 1.2;
    ctx.fillStyle = flash ? W : '#c08a4e';
    ctx.beginPath();
    ctx.roundRect(cx - f * 9 - 4 - f * bagSwing * 0.5, sy + 24 + Math.abs(bagSwing) * 0.4, 8, 7, 2);
    ctx.fill(); ctx.stroke();

    // 4. Brazo y espada. Al atacar, la espada barre por delante (alternando arriba/abajo).
    const shoulderX = cx + f * 6, shoulderY = sy + 21;
    const UP = -1.9, DOWN = 1.1;
    let swordAng; // ángulo de la hoja (0 = hacia adelante)
    if (this.isAttacking) {
      const p = 1 - this.attackTimer / this.attackDuration;
      const e = 1 - Math.pow(1 - p, 4); // arranque explosivo, frenada suave
      const from = a.swingDir === 1 ? UP : DOWN;
      const to = a.swingDir === 1 ? DOWN : UP;
      swordAng = from + (to - from) * e + (this.attackAim || 0);
    } else {
      // Reposo: la espada respira y acompaña el paso
      swordAng = -1.25 + Math.sin(this.walkPhase) * 0.15 + (idle ? Math.sin(t * 2.6) * 0.04 : 0);
    }
    const hx = shoulderX + f * Math.cos(swordAng * 0.5) * 5;
    const hy = shoulderY + Math.sin(swordAng * 0.5) * 5 + 2;
    // Hoja
    ctx.strokeStyle = flash ? W : '#e4e9ee';
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
    ctx.strokeStyle = flash ? W : '#8a5a2b';
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

    // 6. Cabeza redonda grande (proporciones de cartoon). Se retrasa un poco
    //    respecto del cuerpo ("follow-through") para que el movimiento se sienta vivo.
    const headLag = -a.lean * 6;
    const headY = sy + 7 + (idle ? Math.sin(t * 2.6 - 0.5) * 0.4 : 0);
    const hcx = cx + headLag;
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.ellipse(hcx, headY, 10, 10.5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Pelo cobrizo despeinado con mechón al frente (el mechón rebota con el movimiento)
    const tuft = Math.sin(t * 9) * (Math.abs(this.vx) / this.speed) * 1.2 + Math.max(-2, Math.min(2, this.vy * 0.25));
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(hcx - 10, headY - 1);
    ctx.quadraticCurveTo(hcx - 9, headY - 13, hcx + 1, headY - 11);
    ctx.quadraticCurveTo(hcx + 6 * f + 6, headY - 16 - tuft, hcx + f * 5, headY - 7);
    ctx.quadraticCurveTo(hcx + 10, headY - 6, hcx + 10, headY - 1);
    ctx.quadraticCurveTo(hcx, headY - 6, hcx - 10, headY - 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Ojos grandes y expresivos con brillo (parpadeo natural cada ~3 s)
    const blink = (t % 3.4) < 0.11;
    const hurt = a.hurtFlash > 0 || (this.invulnerableTimer > 40 && !this.dead);
    const ex = hcx + f * 3;
    const lookY = Math.max(-1, Math.min(1.2, this.vy * 0.15)); // mira hacia donde va
    for (const k of [-1, 1]) {
      const exx = ex + k * 3.5;
      if (this.dead) {
        // Ojos en cruz de cartoon
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(exx - 2, headY - 1); ctx.lineTo(exx + 2, headY + 3);
        ctx.moveTo(exx + 2, headY - 1); ctx.lineTo(exx - 2, headY + 3);
        ctx.stroke();
        ctx.lineWidth = 2;
      } else if (hurt) {
        // Ojos apretados por el golpe ( > < )
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(exx - 2 * k, headY - 1); ctx.lineTo(exx + 2 * k, headY + 1); ctx.lineTo(exx - 2 * k, headY + 3);
        ctx.stroke();
        ctx.lineWidth = 2;
      } else if (blink) {
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
        ctx.arc(exx + f * 0.8, headY + 1.5 + lookY, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(exx + f * 0.8 + 0.6, headY + 0.8 + lookY, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Mejillas y boca (sonrisa decidida / grito al atacar / mueca al recibir daño)
    ctx.fillStyle = 'rgba(224, 120, 100, 0.45)';
    ctx.beginPath();
    ctx.arc(ex - 6, headY + 5, 2, 0, Math.PI * 2);
    ctx.arc(ex + 6, headY + 5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.3;
    if (this.isAttacking || hurt || this.dead) {
      ctx.fillStyle = '#5a2418';
      ctx.beginPath();
      ctx.ellipse(ex + f, headY + 6, 1.8, this.isAttacking ? 2.2 : 1.4, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(ex + f, headY + 5, 2.2, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    ctx.restore();

    // 7. Estela del corte ("smear"): media luna que se afina hacia la cola
    if (this.isAttacking && !this.dead) this.renderSlashTrail(ctx, cx + lungeX, sy + 21 + bob);
  }

  // Estela del tajo: la cabeza sigue a la espada y la cola la persigue con retraso,
  // así el arco crece rápido y luego se cierra (como un "smear" de animación clásica).
  renderSlashTrail(ctx, bodyX, oyBase) {
    const a = this.anim;
    const f = this.facing;
    const p = 1 - this.attackTimer / this.attackDuration;
    const ease = (v) => 1 - Math.pow(1 - Math.max(0, Math.min(1, v)), 4);
    const UP = -1.9, DOWN = 1.1;
    const from = a.swingDir === 1 ? UP : DOWN;
    const to = a.swingDir === 1 ? DOWN : UP;
    const aimA = this.attackAim || 0;
    const head = from + (to - from) * ease(p) + aimA;
    const tail = from + (to - from) * ease((p - 0.3) / 0.7) + aimA;
    if (Math.abs(head - tail) < 0.05) return;

    const ox = bodyX + f * 8 * Math.cos(aimA);
    const oy = oyBase + 8 * Math.sin(aimA);
    const R = 31;
    const N = 14;
    const outer = [], inner = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N;                       // 0 = cola, 1 = cabeza
      const ang = tail + (head - tail) * k;
      const thick = 2 + 9 * Math.sin(k * Math.PI * 0.5); // más grueso cerca de la hoja
      outer.push([ox + f * Math.cos(ang) * R, oy + Math.sin(ang) * R]);
      inner.push([ox + f * 4 * Math.cos(aimA) + f * Math.cos(ang) * (R - thick), oy + 4 * Math.sin(aimA) + Math.sin(ang) * (R - thick)]);
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, 1.5 - p * 1.3));
    const grad = ctx.createLinearGradient(outer[0][0], outer[0][1], outer[N][0], outer[N][1]);
    grad.addColorStop(0, 'rgba(255, 214, 120, 0)');
    grad.addColorStop(0.55, 'rgba(255, 236, 190, 0.65)');
    grad.addColorStop(1, 'rgba(255, 252, 240, 0.98)');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#ffcf6b';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(outer[0][0], outer[0][1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(outer[i][0], outer[i][1]);
    for (let i = N; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
    ctx.closePath();
    ctx.fill();
    // Filo brillante en el borde exterior
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 250, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const start = Math.floor(N * 0.45);
    ctx.moveTo(outer[start][0], outer[start][1]);
    for (let i = start + 1; i <= N; i++) ctx.lineTo(outer[i][0], outer[i][1]);
    ctx.stroke();
    ctx.restore();
  }
}
