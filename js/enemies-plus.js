/**
 * Enemigos nuevos - Ruben: En Busca de Angelo (Claude)
 *
 *  WaspEnemy (avispa):     vuela como la polilla, pero se queda a distancia, se prepara
 *                          (tiembla, curva el aguijón y zumba) y se lanza en un DASH recto
 *                          hacia Ruben. Si choca con una pared queda mareada. Golpe del dash: 5.
 *  ScorpionEnemy (alacrán): patrulla el suelo como el escarabajo, lento; cuando Ruben está
 *                          delante levanta la cola y PICA. La picadura (3) ENVENENA.
 *  window.Poison:          veneno de Ruben: 1 de vida por segundo durante ~4,5 s (no mata:
 *                          deja a Ruben en 1), burbujas verdes y barra de vida verde.
 *                          Beber una poción (R / LB) lo cura. Morir o reiniciar lo cura.
 *    .apply(target, frames?)  .cure(target)  .isPoisoned(target)
 *
 * Las dos clases heredan de FlyingShadeEnemy / CrawlerEnemy (enemies.js), así el viento,
 * el agua, los pilares de tierra, el diario y el multijugador las tratan igual que a las
 * originales. Para colocarlas: `new WaspEnemy(x, y)` y `new ScorpionEnemy(x, y, patrulla)`
 * (y = techo de la plataforma − 22) en `spawnEnemies` de cualquier sala.
 */

// ---------------------------------------------------------------------------------- Avispa
class WaspEnemy extends FlyingShadeEnemy {
  constructor(x, y) {
    super(x, y);
    this.width = 28;
    this.height = 24;
    this.hp = 24;
    this.maxHp = 24;
    this.speed = 1.9;
    this.returnSpeed = 1.4;
    this.detectionRadius = 290;
    this.leashRadius = 420;
    this.state = 'hover';      // hover · windup · dash · recover · dizzy
    this.stateT = 0;
    this.dashCd = 50;
    this.dashVx = 0;
    this.dashVy = 0;
    this.aimA = 0;             // ángulo del dash (se fija al final de la preparación)
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.curl = 0;             // 0 = abdomen recto · 1 = aguijón apuntando adelante
    this.stretch = 1;          // estiramiento a lo largo del dash
    // Estela del dash: anillo fijo de 6 posiciones (sin basura por cuadro)
    this.trailX = new Float32Array(6);
    this.trailY = new Float32Array(6);
    this.trailN = 0;
    this.trailI = 0;
  }

  takeDamage(amount, knockback = 0) {
    const was = this.hitCooldown;
    super.takeDamage(amount, knockback);
    // Un golpe corta la preparación o el dash
    if (this.alive && was <= 0 && this.hitCooldown > 0 && (this.state === 'windup' || this.state === 'dash')) {
      this.setState('recover', 30);
    }
  }

  setState(s, t) {
    this.state = s;
    this.stateT = t;
  }

  pushTrail() {
    this.trailX[this.trailI] = this.x + this.width / 2;
    this.trailY[this.trailI] = this.y + this.height / 2;
    this.trailI = (this.trailI + 1) % 6;
    if (this.trailN < 6) this.trailN++;
  }

  update(world, player) {
    if (!this.alive) {
      if (this.dyingTimer > 0) {
        this.dyingTimer--;
        this.moveWithCollisions(world, Math.sin(this.dyingTimer * 0.5) * 1.5, 1.6);
      }
      return;
    }
    if (this.hitCooldown > 0) this.hitCooldown--;
    if (this.alert > 0) this.alert--;
    if (this.dashCd > 0) this.dashCd--;
    if (this.state !== 'dash' && this.trailN > 0 && (this.flapT * 10 | 0) % 2 === 0) this.trailN--;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const dx = px - cx, dy = py - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const fromOrigin = Math.hypot(cx - this.originX, cy - this.originY);
    let chasing = false;

    if (Math.abs(this.knockbackVx) > 0.1 || Math.abs(this.knockbackVy) > 0.1) {
      this.moveWithCollisions(world, this.knockbackVx, this.knockbackVy);
      this.knockbackVx *= 0.85;
      this.knockbackVy *= 0.85;
      if (Math.abs(this.knockbackVx) <= 0.1) this.knockbackVx = 0;
      if (Math.abs(this.knockbackVy) <= 0.1) this.knockbackVy = 0;
    } else if (this.state === 'windup') {
      // Anticipación: frena, retrocede un poco y tiembla; apunta hasta los últimos cuadros
      chasing = true;
      if (this.stateT > 8) this.aimA = Math.atan2(dy, dx);
      this.vx = this.vx * 0.8 - Math.cos(this.aimA) * 0.12;
      this.vy = this.vy * 0.8 - Math.sin(this.aimA) * 0.12;
      this.moveWithCollisions(world, this.vx + Math.sin(this.stateT * 2.3) * 0.9, this.vy);
      this.lookX = Math.cos(this.aimA) >= 0 ? 1 : -1;
      this.curl += (1 - this.curl) * 0.2;
      if (--this.stateT <= 0) {
        this.setState('dash', 22);
        this.dashVx = Math.cos(this.aimA) * 8.6;
        this.dashVy = Math.sin(this.aimA) * 8.6;
        this.trailN = 0;
        WaspEnemy.sfxDash();
        if (window.particleSystem) window.particleSystem.createDust(cx, cy, 5, '#fff2b8');
      }
    } else if (this.state === 'dash') {
      chasing = true;
      const ox = this.x, oy = this.y;
      this.moveWithCollisions(world, this.dashVx, this.dashVy);
      this.pushTrail();
      this.stretch += (1.45 - this.stretch) * 0.4;
      const moved = Math.abs(this.x - ox) + Math.abs(this.y - oy);
      if (moved < (Math.abs(this.dashVx) + Math.abs(this.dashVy)) * 0.45) {
        // ¡Contra la pared! Queda mareada (momento ideal para pegarle)
        this.setState('dizzy', 70);
        this.knockbackVx = -this.dashVx * 0.35;
        this.knockbackVy = -this.dashVy * 0.35 - 1;
        if (window.soundManager) window.soundManager.playHit();
        if (window.particleSystem) window.particleSystem.createHitImpact(cx, cy, 8);
        if (window.gameInstance) window.gameInstance.triggerScreenShake(3, 90);
      } else if (--this.stateT <= 0) {
        this.vx = this.dashVx * 0.3;
        this.vy = this.dashVy * 0.3;
        this.setState('recover', 38);
      }
    } else if (this.state === 'recover' || this.state === 'dizzy') {
      // Frena y sube despacio; mareada baja flotando con estrellitas
      const dizzy = this.state === 'dizzy';
      this.vx *= 0.9;
      this.vy = this.vy * 0.9 + (dizzy ? 0.05 : -0.04);
      this.moveWithCollisions(world, this.vx, this.vy);
      if (--this.stateT <= 0) {
        this.setState('hover', 0);
        this.dashCd = 70 + Math.random() * 50;
      }
    } else {
      // hover: se acerca, pero se queda a un costado y por encima, rondando
      const sees = !player.dead && dist < this.detectionRadius && fromOrigin < this.leashRadius &&
        hasLineOfSight(world, cx, cy, px, py);
      if (sees) this.loseSightTimer = 40;
      else if (this.loseSightTimer > 0) this.loseSightTimer--;

      if ((sees || this.loseSightTimer > 0) && !player.dead && fromOrigin < this.leashRadius) {
        chasing = true;
        if (Math.abs(dx) > 40) this.side = dx > 0 ? -1 : 1;
        const tx = px + this.side * 120 - cx;
        const ty = py - 70 + Math.sin(this.flapT * 0.12) * 18 - cy;
        const td = Math.hypot(tx, ty) || 1;
        const spd = Math.min(this.speed, td * 0.06);
        this.vx += ((tx / td) * spd - this.vx) * 0.14;
        this.vy += ((ty / td) * spd - this.vy) * 0.14;
        this.moveWithCollisions(world, this.vx, this.vy);
        this.lookX = Math.sign(dx) || this.lookX;
        if (sees && this.dashCd <= 0 && dist < 240) {
          this.setState('windup', 34);
          this.aimA = Math.atan2(dy, dx);
          this.alert = 40;
          WaspEnemy.sfxWindup();
        }
      } else {
        this.angle += 0.04;
        const tx = this.originX + Math.sin(this.angle * 0.8) * 30 - this.x;
        const ty = this.originY + Math.sin(this.angle * 1.6) * 12 - this.y;
        const td = Math.hypot(tx, ty);
        let tvx = 0, tvy = 0;
        if (td > 1.5) {
          const spd = Math.min(this.returnSpeed, td * 0.08);
          tvx = (tx / td) * spd; tvy = (ty / td) * spd;
        }
        this.vx += (tvx - this.vx) * 0.15;
        this.vy += (tvy - this.vy) * 0.15;
        this.moveWithCollisions(world, this.vx, this.vy);
        if (Math.abs(this.vx) > 0.15) this.lookX = Math.sign(this.vx);
      }
    }

    if (this.state !== 'windup') this.curl += ((this.state === 'dash' ? 1 : 0) - this.curl) * 0.15;
    if (this.state !== 'dash') this.stretch += (1 - this.stretch) * 0.2;
    if (chasing && !this.wasChasing && this.state === 'hover') this.alert = 30;
    this.wasChasing = chasing;

    const realVx = this.x - this.prevX;
    this.prevX = this.x;
    this.tilt += ((this.state === 'dash' ? 0 : realVx * 0.16) - this.tilt) * 0.2;
    this.flapT += this.state === 'windup' || this.state === 'dash' ? 0.95 : 0.7;

    // Contacto con Ruben: el dash duele más y la avispa rebota
    if (aabbOverlap(this.x, this.y, this.width, this.height, player.x, player.y, player.width, player.height)) {
      const knockDir = Math.sign(px - cx) || this.lookX || 1;
      const dashing = this.state === 'dash';
      player.takeDamage(dashing ? 5 : 3, knockDir * (dashing ? 8 : 6));
      this.knockbackVx = -knockDir * 3;
      this.knockbackVy = -2.2;
      if (dashing) this.setState('recover', 40);
    }
  }

  render(ctx, camera) {
    if (!this.alive && this.dyingTimer <= 0) return;
    const OUT = '#3a2416';
    const flash = this.hitCooldown > 9;
    const camX = camera.x, camY = camera.y;
    const cx = this.x + this.width / 2 - camX;
    const cy = this.y + this.height / 2 - camY;
    const f = this.lookX || 1;
    const now = Date.now();

    // Estela del dash (siluetas amarillas que se desvanecen)
    if (this.trailN > 1) {
      ctx.save();
      for (let i = 0; i < this.trailN; i++) {
        const idx = (this.trailI - 1 - i + 12) % 6;
        const k = 1 - i / this.trailN;
        ctx.globalAlpha = k * 0.32;
        ctx.fillStyle = '#ffd84a';
        ctx.beginPath();
        ctx.ellipse(this.trailX[idx] - camX, this.trailY[idx] - camY, 11 * k + 3, 7 * k + 2, this.aimA, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (!this.alive) {
      const k = 1 - this.dyingTimer / this.DYING_FRAMES;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
    }

    const shake = this.state === 'windup' ? Math.sin(now * 0.09) * 1.6 : 0;
    const bob = this.state === 'dash' ? 0 : Math.sin(this.flapT * 0.35) * 1.6;
    ctx.translate(cx + shake, cy + bob);
    // Orientación: en la preparación y el dash mira hacia donde se lanza
    let rot = this.alive ? this.tilt : this.dyingTimer * 0.35;
    if (this.alive && (this.state === 'windup' || this.state === 'dash')) {
      rot = f > 0 ? this.aimA : this.aimA - Math.PI;
      rot = Math.max(-1.1, Math.min(1.1, rot));
    }
    ctx.rotate(rot);
    ctx.scale(f * this.stretch, 1 / Math.sqrt(this.stretch));
    if (this.alive && this.hitCooldown > 0) {
      const hk = this.hitCooldown / 15, wob = Math.sin(hk * Math.PI * 2.5) * hk;
      ctx.scale(1 + wob * 0.28, 1 - wob * 0.24);
    }
    // Desde acá: +x = adelante (cabeza), origen = tórax

    const BODY = flash ? '#fff8ec' : '#f4c23a';
    const STRIPE = flash ? '#fff8ec' : '#4a2c18';

    // Alas de atrás (borrón rápido)
    const flap = Math.sin(this.flapT);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.7)';
    for (let w = 0; w < 2; w++) {
      const a = -0.9 - flap * 0.55 - w * 0.25;
      ctx.save();
      ctx.translate(-1, -5);
      ctx.rotate(a);
      ctx.fillStyle = w === 0 ? 'rgba(236, 248, 255, 0.55)' : 'rgba(220, 238, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, -9, 4.5, 10, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // Patitas colgando
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      const lx = -3 + i * 4;
      const sw = Math.sin(this.flapT * 0.3 + i) * 1.5;
      ctx.beginPath();
      ctx.moveTo(lx, 4);
      ctx.quadraticCurveTo(lx - 2 + sw, 8, lx - 3 + sw, 11);
      ctx.stroke();
    }

    // Abdomen rayado (se curva hacia adelante para picar)
    ctx.save();
    ctx.translate(-5, 1);
    ctx.rotate(0.35 + this.curl * 1.05);
    ctx.fillStyle = BODY;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(-8, 0, 9.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = STRIPE;
    ctx.fillRect(-7, -8, 3, 16);
    ctx.fillRect(-13, -8, 3, 16);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(-8, 0, 9.5, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Aguijón
    ctx.fillStyle = this.state === 'windup' && (now >> 6) % 2 ? '#fff6c8' : '#2b1a10';
    ctx.beginPath();
    ctx.moveTo(-17, -1.8);
    ctx.lineTo(-23, 0);
    ctx.lineTo(-17, 1.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Tórax
    ctx.fillStyle = BODY;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Ala de adelante
    ctx.save();
    ctx.translate(1, -5);
    ctx.rotate(-0.6 - flap * 0.6);
    ctx.fillStyle = 'rgba(244, 252, 255, 0.6)';
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.75)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, -9, 4.5, 10, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Cabeza con ojo grande y ceño fruncido
    ctx.fillStyle = BODY;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(9, -1, 5.5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Antenas
    ctx.lineWidth = 1.2;
    const ant = Math.sin(this.flapT * 0.25) * 1.5;
    ctx.beginPath();
    ctx.moveTo(10, -6);
    ctx.quadraticCurveTo(12, -11, 16 + ant, -12);
    ctx.moveTo(8, -6);
    ctx.quadraticCurveTo(8, -12, 11 + ant, -14);
    ctx.stroke();
    if (!this.alive || this.state === 'dizzy') {
      // Ojo en espiral / cruz
      ctx.strokeStyle = '#2b1a10';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(9, -3.5); ctx.lineTo(12.5, 0);
      ctx.moveTo(12.5, -3.5); ctx.lineTo(9, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(11, -1.5, 2.8, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#2b1a10';
      ctx.beginPath();
      ctx.arc(12, -1.2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Ceño (más bajo cuando se prepara)
      const brow = this.state === 'windup' || this.state === 'dash' ? 1.2 : 0;
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(8.5, -5.2 + brow * 0.3);
      ctx.lineTo(14, -3.6 + brow);
      ctx.stroke();
    }
    ctx.restore();

    // Estrellitas de mareo
    if (this.alive && this.state === 'dizzy') {
      ctx.save();
      ctx.fillStyle = '#ffe28a';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const a = now * 0.006 + i * 2.094;
        const sx = cx + Math.cos(a) * 13, sy = cy - 16 + Math.sin(a) * 4;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 1.4 : 3.4, aa = k * Math.PI / 5 - Math.PI / 2;
          if (k) ctx.lineTo(sx + Math.cos(aa) * r, sy + Math.sin(aa) * r);
          else ctx.moveTo(sx + Math.cos(aa) * r, sy + Math.sin(aa) * r);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    // "!" al detectar / prepararse
    if (this.alive && this.alert > 0) {
      const k = 1 - this.alert / 40;
      const pop = k < 0.2 ? Math.sin((k / 0.2) * Math.PI * 0.5) * 1.25 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.alert / 12);
      ctx.translate(cx, cy - 22);
      ctx.scale(pop, pop);
      ctx.font = '800 16px Cinzel, Georgia, serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUT;
      ctx.fillStyle = this.state === 'windup' ? '#ff9a5a' : '#ffe28a';
      ctx.strokeText('!', 0, 0);
      ctx.fillText('!', 0, 0);
      ctx.restore();
    }
  }

  // Zumbido que sube (preparación) y "zip" del dash
  static sfxWindup() {
    const SK = window.SoundKit;
    if (!SK) return;
    SK.tone({ type: 'sawtooth', freq: 180, freqTo: 420, sweep: 0.5, gain: 0.035, release: 0.55, stopAt: 0.6 });
  }
  static sfxDash() {
    const SK = window.SoundKit;
    if (!SK) return;
    SK.tone({ type: 'square', freq: 520, freqTo: 140, sweep: 0.22, gain: 0.04, release: 0.25, stopAt: 0.3 });
    SK.noiseHit('white', { type: 'bandpass', freq: 2400, freqTo: 900, sweep: 0.2, Q: 1.2, peak: 0.08, attack: 0.01, release: 0.2, stopAt: 0.3 });
  }
}

// --------------------------------------------------------------------------------- Alacrán
class ScorpionEnemy extends CrawlerEnemy {
  constructor(x, y, patrolDistance = 120) {
    super(x, y, patrolDistance);
    this.width = 40;
    this.height = 22;
    this.hp = 40;
    this.maxHp = 40;
    this.speed = 0.75;
    this.chaseSpeed = 1.45;
    this.state = 'walk';       // walk · windup · strike · recover
    this.stateT = 0;
    this.strikeCd = 30;
    this.tailK = 0;            // 0 = cola en reposo · 1 = cola armada atrás
    this.strikeK = 0;          // 0..1 la cola se dispara hacia adelante
    this.stung = false;
    this.claw = 0;             // apertura de pinzas
    // Articulaciones de la cola en coordenadas del mundo (6 puntos, sin basura)
    this.tail = new Float32Array(12);
  }

  takeDamage(amount, knockback = 0) {
    const was = this.hitCooldown;
    super.takeDamage(amount, knockback);
    // Pegarle mientras arma la cola la interrumpe
    if (this.alive && was <= 0 && this.hitCooldown > 0 && this.state === 'windup') {
      this.state = 'recover';
      this.stateT = 24;
      this.strikeCd = 50;
    }
  }

  // Calcula las articulaciones de la cola según la pose actual
  computeTail() {
    const f = this.facing;
    // Interpolación: reposo → armada (b −2.6, c 0.42) → golpe (b −0.9, c 0.3, cola estirada)
    let b = -2.25 + (-2.6 + 2.25) * this.tailK;
    let c = 0.5 + (0.42 - 0.5) * this.tailK;
    b += (-0.9 - b) * this.strikeK;
    c += (0.3 - c) * this.strikeK;
    const stretch = 1 + 0.35 * this.strikeK;
    if (this.alive) b += Math.sin(this.animT * 0.8) * 0.05 * (1 - this.tailK);
    let x = this.x + this.width / 2 - f * (this.width * 0.42);
    let y = this.y + this.height * 0.45;
    const t = this.tail;
    t[0] = x; t[1] = y;
    for (let i = 1; i < 6; i++) {
      const a = b + c * (i - 1);
      const len = (i === 5 ? 7 : 9) * stretch;
      x += Math.cos(a) * len * f;
      y += Math.sin(a) * len;
      t[i * 2] = x; t[i * 2 + 1] = y;
    }
  }

  update(world, player) {
    if (!this.alive) { super.update(world, player); return; }
    if (this.strikeCd > 0) this.strikeCd--;

    if (this.state === 'walk') {
      super.update(world, player);
      if (!this.alive) return;
      this.tailK += (0 - this.tailK) * 0.15;
      this.strikeK += (0 - this.strikeK) * 0.2;
      this.claw += ((this.isChasing ? 1 : 0.3) - this.claw) * 0.1;
      // ¿Ruben está delante, al alcance de la cola?
      const front = this.facing > 0 ? player.x - (this.x + this.width) : this.x - (player.x + player.width);
      const dy = (player.y + player.height) - (this.y + this.height);
      if (!player.dead && this.strikeCd <= 0 && this.isGrounded && Math.abs(this.knockbackVx) < 0.1 &&
          front > -18 && front < 34 && dy > -70 && dy < 20 &&
          hasLineOfSight(world, this.x + this.width / 2, this.y + 4, player.x + player.width / 2, player.y + player.height / 2)) {
        this.state = 'windup';
        this.stateT = 26;
        this.alert = 26;
        this.sx = 0.86; this.vsx = 0;
        ScorpionEnemy.sfxRattle();
      }
    } else {
      // Quieto mientras pica: el motor del escarabajo sigue resolviendo gravedad y golpes
      const s = this.speed, cs = this.chaseSpeed;
      const lockFacing = this.facing;
      this.speed = 0; this.chaseSpeed = 0;
      super.update(world, player);
      this.speed = s; this.chaseSpeed = cs;
      if (!this.alive) return;
      if (this.state !== 'windup') this.facing = lockFacing;
      this.stateT--;
      if (this.state === 'windup') {
        this.tailK += (1 - this.tailK) * 0.2;
        this.claw += (1.3 - this.claw) * 0.2;
        if (this.stateT <= 0) {
          this.state = 'strike';
          this.stateT = 14;
          this.stung = false;
          ScorpionEnemy.sfxStrike();
        }
      } else if (this.state === 'strike') {
        this.strikeK += (1 - this.strikeK) * 0.55;
        this.computeTail();
        // La punta de la cola (y un poco delante) es la zona que pica
        const tx = this.tail[10], ty = this.tail[11];
        if (!this.stung && this.strikeK > 0.5 &&
            aabbOverlap(tx - 17, ty - 14, 34, 30, player.x, player.y, player.width, player.height)) {
          this.stung = true;
          const hp0 = player.hp;
          player.takeDamage(3, this.facing * 5);
          if (player.hp < hp0 && window.Poison) window.Poison.apply(player);
          if (window.particleSystem) window.particleSystem.createDust(tx, ty, 6, '#9be05a');
        }
        if (this.stateT <= 0) {
          this.state = 'recover';
          this.stateT = 30;
          this.strikeCd = 75;
        }
      } else {
        this.strikeK += (0 - this.strikeK) * 0.12;
        this.tailK += (0 - this.tailK) * 0.12;
        if (this.stateT <= 0) this.state = 'walk';
      }
    }
    this.computeTail();
  }

  static palette() {
    const g = window.gameInstance;
    const b = g && g.world && g.world.getCurrentRoom && g.world.getCurrentRoom();
    switch (b && b.biome) {
      case 'bosque': return '#7b6433';
      case 'montana': return '#9a6c48';
      case 'castillo': return '#843a2c';
      default: return '#c7843a';
    }
  }

  render(ctx, camera) {
    if (!this.alive && this.dyingTimer <= 0) return;
    if (!this.alive || this.tail[0] === 0) this.computeTail();
    const OUT = '#3a2416';
    const flash = this.hitCooldown > 9;
    const SHELL = flash ? '#fff8ec' : ScorpionEnemy.palette();
    const f = this.facing;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    const cx = sx + this.width / 2;
    const baseY = sy + this.height;
    const now = Date.now();

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Derrota: patas arriba, salta y se desvanece (como el escarabajo)
    if (!this.alive) {
      const dk = 1 - this.dyingTimer / this.DYING_FRAMES;
      ctx.globalAlpha = Math.max(0, 1 - dk * dk);
      ctx.translate(0, -Math.sin(Math.min(1, dk * 1.6) * Math.PI) * 14);
      const ccy = sy + this.height / 2;
      ctx.translate(cx, ccy);
      ctx.rotate(Math.PI * Math.min(1, dk * 2.2) * f);
      ctx.translate(-cx, -ccy);
    }

    // Sombra
    ctx.fillStyle = 'rgba(40, 22, 10, 0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 1, this.width * 0.5 * this.sx, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Squash & stretch desde la base
    const walkBob = this.alive ? Math.abs(Math.sin(this.animT)) * 1 : 0;
    ctx.translate(cx, baseY);
    ctx.scale(this.sx, 1 / this.sx);
    ctx.translate(-cx, -baseY - walkBob);

    // Patas: 4 por lado (se ven como 4 arqueadas)
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
      const lx = cx - f * 10 + f * i * 6;
      const ph = this.animT * 2 + i * 1.7;
      const swing = this.alive ? Math.sin(ph) * 2.5 : Math.sin(now * 0.03 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(lx, baseY - 8);
      ctx.quadraticCurveTo(lx - f * 4 + swing * 0.5, baseY - 12, lx - f * 6 + swing, baseY + 1 + walkBob);
      ctx.stroke();
    }

    // Cola (segmentos de bolitas) — se dibuja detrás del cuerpo
    const t = this.tail;
    const ox = camera.x, oy = camera.y + walkBob;
    // Unión entre segmentos (al estirarse para picar no quedan bolitas sueltas)
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? SHELL : OUT;
      ctx.lineWidth = pass ? 4.5 : 7.5;
      ctx.beginPath();
      ctx.moveTo(t[0] - ox, t[1] - oy);
      for (let i = 1; i < 5; i++) ctx.lineTo(t[i * 2] - ox, t[i * 2 + 1] - oy);
      ctx.stroke();
    }
    ctx.fillStyle = SHELL;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.6;
    for (let i = 1; i < 5; i++) {
      const r = 5.2 - i * 0.45;
      ctx.beginPath();
      ctx.arc(t[i * 2] - ox, t[i * 2 + 1] - oy, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    // Aguijón: bulbo + púa (brilla verde veneno al armarse)
    const bx = t[8] - ox, by = t[9] - oy, tx = t[10] - ox, ty = t[11] - oy;
    const glow = this.state === 'windup' || this.state === 'strike';
    if (glow && this.alive) {
      ctx.save();
      ctx.fillStyle = 'rgba(160, 230, 90, 0.35)';
      ctx.beginPath();
      ctx.arc(tx, ty, 7 + Math.sin(now * 0.03) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = flash ? '#fff8ec' : (glow ? '#a8dd5c' : '#7fa83e');
    ctx.beginPath();
    ctx.ellipse((bx + tx) / 2, (by + ty) / 2, 4.6, 3.6, Math.atan2(ty - by, tx - bx), 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    const ang = Math.atan2(ty - by, tx - bx);
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath();
    ctx.moveTo(tx + Math.cos(ang + 1.2) * 2.4, ty + Math.sin(ang + 1.2) * 2.4);
    ctx.lineTo(tx + Math.cos(ang + 0.5) * 7, ty + Math.sin(ang + 0.5) * 7);
    ctx.lineTo(tx + Math.cos(ang - 0.6) * 2.4, ty + Math.sin(ang - 0.6) * 2.4);
    ctx.closePath();
    ctx.fill();

    // Cuerpo: abdomen segmentado + cefalotórax
    ctx.fillStyle = SHELL;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx - f * 5, baseY - 10, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.3;
    for (let k = 0; k < 3; k++) {
      const lx = cx - f * (12 - k * 5);
      ctx.beginPath();
      ctx.moveTo(lx, baseY - 17);
      ctx.quadraticCurveTo(lx + f * 1.5, baseY - 10, lx, baseY - 3);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx + f * 9, baseY - 9, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (!flash) {
      ctx.fillStyle = 'rgba(255, 245, 220, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cx - f * 7, baseY - 15, 6, 2.2, -0.2 * f, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pinzas (se abren y cierran; bien abiertas al armar la cola)
    const open = 0.25 + this.claw * 0.35 + (this.alive ? Math.sin(now * 0.012 + this.startX) * 0.08 : 0);
    for (let k = 0; k < 2; k++) {
      const py = baseY - 8 + k * 4;
      const ax = cx + f * 14, hx = cx + f * 24;
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, py);
      ctx.quadraticCurveTo(cx + f * 20, py - 4, hx, py - 2);
      ctx.stroke();
      ctx.fillStyle = SHELL;
      ctx.lineWidth = 1.5;
      ctx.save();
      ctx.translate(hx, py - 2);
      ctx.scale(f, 1);
      ctx.beginPath();
      ctx.ellipse(2, 0, 4.5, 3.4, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Dedos de la pinza
      ctx.beginPath();
      ctx.moveTo(5, -1);
      ctx.quadraticCurveTo(9, -2 - open * 6, 11, -1 - open * 3);
      ctx.moveTo(5, 1);
      ctx.quadraticCurveTo(9, 2 + open * 5, 11, 1 + open * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Ojitos de cartoon con ceño
    const ex = cx + f * 11, ey = baseY - 13;
    if (!this.alive) {
      ctx.strokeStyle = '#2b1a10';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2);
      ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.1;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(ex - f * 3.5 + f * k * 5, ey, 2.6, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#2b1a10';
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(ex - f * 3.5 + f * k * 5 + f * 0.9, ey + 0.4, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (this.state !== 'walk' || this.isChasing) {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ex - f * 6, ey - 4.5);
        ctx.lineTo(ex + f * 4, ey - 2.4);
        ctx.stroke();
      }
    }
    ctx.restore();

    // "!" al armar la cola
    if (this.alive && this.alert > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.alert / 8);
      ctx.font = '800 14px Cinzel, Georgia, serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUT;
      ctx.fillStyle = this.state === 'windup' ? '#b6f070' : '#ffe28a';
      ctx.strokeText('!', cx, sy - 14);
      ctx.fillText('!', cx, sy - 14);
      ctx.restore();
    }
  }

  static sfxRattle() {
    const SK = window.SoundKit;
    if (!SK) return;
    // Cascabeleo seco: tres chasquidos cortos (noiseHit no tiene retardo, tone sí)
    for (let i = 0; i < 3; i++) {
      SK.tone({ type: 'square', freq: 1900 - i * 150, gain: 0.025, release: 0.035, stopAt: 0.05, delay: i * 0.07 });
    }
  }
  static sfxStrike() {
    const SK = window.SoundKit;
    if (!SK) return;
    SK.tone({ type: 'triangle', freq: 900, freqTo: 220, sweep: 0.12, gain: 0.06, release: 0.16, stopAt: 0.2 });
  }
}

window.WaspEnemy = WaspEnemy;
window.ScorpionEnemy = ScorpionEnemy;

// ----------------------------------------------------------------------------------- Veneno
(function () {
  'use strict';

  const DURATION = 270;   // ~4,5 s
  const TICK = 60;        // 1 de vida por segundo
  let hintShown = false;
  let wasPoisoned = false;

  function apply(target, frames) {
    if (!target || target.dead) return;
    const already = target._poison > 0;
    target._poison = Math.max(target._poison || 0, frames || DURATION);
    if (!already) target._poisonT = 0;
    const g = window.gameInstance;
    if (g && target === g.player) {
      if (window.particleSystem) window.particleSystem.createDust(target.x + target.width / 2, target.y + 10, 8, '#9be05a');
      if (!hintShown && g.showNotification) {
        hintShown = true;
        const k = (g.controlsManager && g.controlsManager.getPrimaryDisplayKey && g.controlsManager.getPrimaryDisplayKey('potion')) || 'R';
        g.showNotification(`¡Veneno! Una poción (${k}) lo cura`);
      }
    }
  }

  function cure(target) {
    if (target) { target._poison = 0; target._poisonT = 0; }
  }

  function isPoisoned(target) {
    return !!(target && target._poison > 0);
  }

  function setHud(game, on) {
    if (game && game.healthBar && game.healthBar.classList) game.healthBar.classList.toggle('hp-poison', on);
  }

  function update(game, running) {
    if (!running) return;
    const p = game.player;
    if (!p) return;
    if (p._poison > 0) {
      // Morir o beber una poción lo cura
      if (p.dead || p.hp <= 0 || (window.Potions && window.Potions.activeEffects() > 0)) {
        if (!p.dead && window.particleSystem) window.particleSystem.createDoubleJumpSparks(p.x + p.width / 2, p.y + p.height / 2);
        cure(p);
      } else {
        p._poison--;
        p._poisonT = (p._poisonT || 0) + 1;
        if (p._poisonT % TICK === 0 && p.hp > 1) {
          p.hp -= 1;
          if (p.anim) p.anim.hurtFlash = 3;
          if (window.SoundKit) window.SoundKit.tone({ type: 'sine', freq: 260, freqTo: 150, sweep: 0.15, gain: 0.04, release: 0.18, stopAt: 0.22 });
          game.updateHUD();
        }
        // Burbujitas verdes que suben
        if (window.particleSystem && p._poisonT % 9 === 0) {
          window.particleSystem.createDust(p.x + p.width * (0.25 + Math.random() * 0.5), p.y + p.height * 0.3, 1, Math.random() < 0.5 ? '#9be05a' : '#c6f08a');
        }
      }
    }
    const on = p._poison > 0;
    if (on !== wasPoisoned) { wasPoisoned = on; setHud(game, on); }
  }

  // Tinte verde sobre Ruben mientras está envenenado
  function render(game, ctx, cam) {
    const p = game.player;
    if (!p || !(p._poison > 0) || p.dead) return;
    const k = Math.min(1, p._poison / 40) * (0.5 + 0.5 * Math.sin((p._poisonT || 0) * 0.15));
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.14 * k;
    ctx.fillStyle = '#7fd04a';
    ctx.beginPath();
    ctx.ellipse(p.x + p.width / 2 - cam.x, p.y + p.height / 2 - cam.y, p.width * 0.75, p.height * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function injectCss() {
    if (document.getElementById('poison-css')) return;
    const st = document.createElement('style');
    st.id = 'poison-css';
    st.textContent =
      '.health-bar.hp-poison .hp-fill{background:linear-gradient(180deg,#c6f08a 0%,#6fb83a 60%,#3d7a1f 100%);}' +
      '.health-bar.hp-poison .hp-track{box-shadow:0 0 0 2px rgba(130,210,80,.55),0 0 10px rgba(130,210,80,.45);}';
    document.head.appendChild(st);
  }

  window.Poison = { apply, cure, isPoisoned };

  const H = window.GameHooks = window.GameHooks || {};
  (H.onInit = H.onInit || []).push((game) => {
    injectCss();
    (H.onAfterUpdate = H.onAfterUpdate || []).push(update);
    (H.onRenderWorld = H.onRenderWorld || []).push(render);
    (H.onRestartGame = H.onRestartGame || []).push((g) => { cure(g.player); setHud(g, false); wasPoisoned = false; });
  });
})();
