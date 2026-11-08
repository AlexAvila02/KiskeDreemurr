/**
 * Sistema de Partículas y Efectos Visuales
 * Polen dorado de pradera, hojas/luciérnagas de bosque, nieve de montaña y polvo cálido de animación.
 */
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.ambientMotes = [];
    this.currentBiome = 'pradera';
    this.initAmbientMotes(55);
  }

  setBiome(biome = 'pradera') {
    this.currentBiome = biome;
  }

  initAmbientMotes(count) {
    this.ambientMotes = [];
    for (let i = 0; i < count; i++) {
      this.ambientMotes.push({
        x: Math.random() * 2000,
        y: Math.random() * 800,
        size: Math.random() * 2.4 + 1.0,
        speedX: (Math.random() - 0.3) * 0.45,
        speedY: -Math.random() * 0.25 - 0.05,
        alpha: Math.random() * 0.55 + 0.2,
        pulseSpeed: Math.random() * 0.03 + 0.01,
        baseAlpha: Math.random() * 0.45 + 0.2
      });
    }
  }

  // Polvo cálido de camino al saltar o aterrizar
  createDust(x, y, count = 6, color = '#c9a679') {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2,
        radius: Math.random() * 3.2 + 2,
        color: color,
        alpha: 0.85,
        decay: 0.04,
        gravity: 0.05
      });
    }
  }

  // Destello dorado de doble salto
  createDoubleJumpSparks(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * (Math.random() * 3 + 2),
        vy: Math.sin(angle) * (Math.random() * 2 + 1),
        radius: Math.random() * 2.8 + 1.5,
        color: i % 2 === 0 ? '#ffe484' : '#fff6d6',
        alpha: 1.0,
        decay: 0.035,
        gravity: 0.02
      });
    }
  }

  // Chispas cálidas de impacto al golpear enemigos
  createHitImpact(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        radius: Math.random() * 3.5 + 1.5,
        color: Math.random() > 0.4 ? '#fff8e0' : '#f0b94a',
        alpha: 1.0,
        decay: 0.05,
        gravity: 0.15
      });
    }
  }

  // Fragmentos de roca ocre al romperse o impactar
  createDebrisFragments(x, y) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 1,
        radius: Math.random() * 4 + 2,
        color: i % 2 === 0 ? '#8c7b66' : '#5c4632',
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

    // Actualizar motas ambientales según el bioma
    const isSnow = this.currentBiome === 'montana';
    for (const m of this.ambientMotes) {
      m.x += isSnow ? m.speedX - 0.6 : m.speedX;
      m.y += isSnow ? Math.abs(m.speedY) * 2.2 : m.speedY;
      m.alpha = m.baseAlpha + Math.sin(Date.now() * m.pulseSpeed * 0.005) * 0.2;

      if (m.y < -20) m.y = 820;
      if (m.y > 820) m.y = -20;
      if (m.x < -20) m.x = 2020;
      if (m.x > 2020) m.x = -20;
    }
  }

  render(ctx, camera) {
    ctx.save();

    // Color de motas ambientales según la zona (ver docs/LORE.md)
    let moteRGB = '255, 232, 160'; // Pradera: polen dorado al atardecer
    if (this.currentBiome === 'bosque') moteRGB = '195, 238, 155';   // Bosque: luciérnagas/esporas verdes
    else if (this.currentBiome === 'montana') moteRGB = '235, 245, 255'; // Montaña: nieve fría
    else if (this.currentBiome === 'castillo') moteRGB = '240, 195, 130'; // Castillo: polvo dorado antiguo

    // Dibujar motas ambientales en el fondo
    for (const m of this.ambientMotes) {
      const screenX = m.x - camera.x * 0.4;
      const screenY = m.y - camera.y * 0.4;

      ctx.fillStyle = `rgba(${moteRGB}, ${Math.max(0, m.alpha)})`;
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
