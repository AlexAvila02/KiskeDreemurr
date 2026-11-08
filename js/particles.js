/**
 * Sistema de Partículas y Efectos Visuales
 * Partículas de ambiente (esporas/polvo brillante), impactos, estela de espada y saltos.
 */
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.ambientMotes = [];
    this.initAmbientMotes(60);
  }

  initAmbientMotes(count) {
    for (let i = 0; i < count; i++) {
      this.ambientMotes.push({
        x: Math.random() * 2000,
        y: Math.random() * 800,
        size: Math.random() * 2.2 + 0.8,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: -Math.random() * 0.3 - 0.1,
        alpha: Math.random() * 0.6 + 0.2,
        pulseSpeed: Math.random() * 0.03 + 0.01,
        baseAlpha: Math.random() * 0.5 + 0.2
      });
    }
  }

  // Polvo al saltar o aterrizar
  createDust(x, y, count = 6, color = '#627c9e') {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2,
        radius: Math.random() * 3 + 2,
        color: color,
        alpha: 0.8,
        decay: 0.04,
        gravity: 0.05
      });
    }
  }

  // Destello de doble salto
  createDoubleJumpSparks(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * (Math.random() * 3 + 2),
        vy: Math.sin(angle) * (Math.random() * 2 + 1),
        radius: Math.random() * 2.5 + 1.5,
        color: '#b6dcff',
        alpha: 1.0,
        decay: 0.035,
        gravity: 0.02
      });
    }
  }

  // Chispas de impacto al golpear enemigos
  createHitImpact(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        radius: Math.random() * 3.5 + 1.5,
        color: Math.random() > 0.4 ? '#ffffff' : '#88c2ff',
        alpha: 1.0,
        decay: 0.05,
        gravity: 0.15
      });
    }
  }

  // Fragmentos de roca al romperse o impactar
  createDebrisFragments(x, y) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 1,
        radius: Math.random() * 4 + 2,
        color: '#49576b',
        alpha: 0.9,
        decay: 0.03,
        gravity: 0.25
      });
    }
  }

  update() {
    // Actualizar partículas dinámicas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.gravity) p.vy += p.gravity;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Actualizar motas ambientales
    for (const m of this.ambientMotes) {
      m.x += m.speedX;
      m.y += m.speedY;
      m.alpha = m.baseAlpha + Math.sin(Date.now() * m.pulseSpeed * 0.005) * 0.2;

      if (m.y < -20) m.y = 820;
      if (m.x < -20) m.x = 2020;
      if (m.x > 2020) m.x = -20;
    }
  }

  render(ctx, camera) {
    ctx.save();

    // Dibujar motas ambientales en el fondo
    for (const m of this.ambientMotes) {
      const screenX = m.x - camera.x * 0.4;
      const screenY = m.y - camera.y * 0.4;

      ctx.fillStyle = `rgba(160, 205, 255, ${Math.max(0, m.alpha)})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dibujar partículas de eventos en el plano de juego
    for (const p of this.particles) {
      const screenX = p.x - camera.x;
      const screenY = p.y - camera.y;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

window.particleSystem = new ParticleSystem();
