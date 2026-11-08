/**
 * Sistema de Partículas y Efectos Visuales
 * Polen dorado de pradera, hojas/luciérnagas de bosque, nieve de montaña y polvo cálido de animación.
 *
 * Tipos de partícula:
 *  - 'dot'   : bolita que se encoge al desvanecerse (polvo, fragmentos).
 *  - 'spark' : trazo luminoso orientado según su velocidad (chispas de impacto / corte).
 *  - 'ring'  : onda de choque que se expande y se afina (aterrizajes fuertes, golpes).
 */
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.ambientMotes = [];
    this.currentBiome = 'pradera';
    this.MAX_PARTICLES = 420;
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
        baseAlpha: Math.random() * 0.45 + 0.2,
        drift: Math.random() * Math.PI * 2 // fase del vaivén lateral
      });
    }
  }

  // Agrega una partícula respetando el límite (evita caídas de rendimiento)
  push(p) {
    if (this.particles.length >= this.MAX_PARTICLES) this.particles.shift();
    p.life = 1;
    p.drag = p.drag ?? 0.96;
    p.type = p.type || 'dot';
    this.particles.push(p);
  }

  // Polvo cálido de camino al saltar o aterrizar
  createDust(x, y, count = 6, color = '#c9a679') {
    for (let i = 0; i < count; i++) {
      this.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y - Math.random() * 2,
        vx: (Math.random() - 0.5) * 3.2,
        vy: -Math.random() * 1.6 - 0.2,
        radius: Math.random() * 3.2 + 2.2,
        color: color,
        alpha: 0.85,
        decay: 0.03 + Math.random() * 0.015,
        gravity: -0.015, // el polvo flota y sube levemente
        drag: 0.92
      });
    }
  }

  // Bocanada de polvo lateral al correr / derrapar (dir = hacia dónde sale)
  createRunPuff(x, y, dir = -1, count = 2, color = '#d6b88c') {
    for (let i = 0; i < count; i++) {
      this.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y - Math.random() * 3,
        vx: dir * (Math.random() * 1.4 + 0.6),
        vy: -Math.random() * 0.8 - 0.2,
        radius: Math.random() * 2.2 + 1.6,
        color,
        alpha: 0.7,
        decay: 0.045,
        gravity: -0.02,
        drag: 0.9
      });
    }
  }

  // Destello dorado de doble salto (anillo + chispas radiales)
  createDoubleJumpSparks(x, y) {
    this.createShockwave(x, y, 26, '#ffe9a8', 3);
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 / 14) * i + Math.random() * 0.2;
      const spd = Math.random() * 2.5 + 2.5;
      this.push({
        type: i % 2 === 0 ? 'spark' : 'dot',
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd * 0.7 + 0.6,
        radius: Math.random() * 2.4 + 1.4,
        length: 7,
        color: i % 2 === 0 ? '#ffe484' : '#fff6d6',
        alpha: 1.0,
        decay: 0.04,
        gravity: 0.03,
        drag: 0.9
      });
    }
  }

  // Chispas cálidas de impacto al golpear (trazos luminosos + bolitas)
  createHitImpact(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * 5 + 2.5;
      const isSpark = Math.random() > 0.35;
      this.push({
        type: isSpark ? 'spark' : 'dot',
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: Math.random() * 2.6 + 1.4,
        length: 9 + Math.random() * 6,
        color: Math.random() > 0.4 ? '#fff8e0' : '#f0b94a',
        alpha: 1.0,
        decay: 0.05 + Math.random() * 0.02,
        gravity: 0.12,
        drag: 0.88
      });
    }
    this.createShockwave(x, y, 22, '#fff1c9', 2.5);
  }

  // Chispas direccionales del filo de la espada al conectar un golpe
  createSlashSparks(x, y, dir = 1) {
    for (let i = 0; i < 9; i++) {
      const ang = (Math.random() - 0.5) * 1.3;
      const spd = Math.random() * 6 + 4;
      this.push({
        type: 'spark',
        x, y,
        vx: Math.cos(ang) * spd * dir,
        vy: Math.sin(ang) * spd - 1,
        radius: 1.6,
        length: 12 + Math.random() * 8,
        color: i % 3 === 0 ? '#ffd36b' : '#fffbea',
        alpha: 1,
        decay: 0.07,
        gravity: 0.18,
        drag: 0.86
      });
    }
  }

  // Onda de choque circular (aterrizajes fuertes, impactos)
  createShockwave(x, y, maxRadius = 30, color = '#fff1c9', width = 3) {
    this.push({
      type: 'ring',
      x, y, vx: 0, vy: 0,
      radius: 2,
      maxRadius,
      width,
      color,
      alpha: 0.9,
      decay: 0.07,
      gravity: 0,
      drag: 1
    });
  }

  // Fragmentos de roca ocre al romperse o impactar
  createDebrisFragments(x, y) {
    for (let i = 0; i < 10; i++) {
      this.push({
        x, y,
        vx: (Math.random() - 0.5) * 6.5,
        vy: -Math.random() * 5 - 1.5,
        radius: Math.random() * 3.6 + 1.8,
        color: i % 2 === 0 ? '#8c7b66' : '#5c4632',
        alpha: 1,
        decay: 0.022,
        gravity: 0.3,
        drag: 0.98,
        square: true,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.4
      });
    }
    this.createDust(x, y, 6, '#b49a7a');
  }

  update() {
    // Actualizar partículas dinámicas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vx *= p.drag;
      p.vy *= p.drag;
      if (p.gravity) p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      if (p.spin) p.rot += p.spin;
      if (p.type === 'ring') {
        // Expansión con frenado (ease-out)
        p.radius += (p.maxRadius - p.radius) * 0.22;
      }
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Actualizar motas ambientales según el bioma
    const isSnow = this.currentBiome === 'montana';
    const now = Date.now();
    for (const m of this.ambientMotes) {
      m.drift += 0.012;
      m.x += (isSnow ? m.speedX - 0.6 : m.speedX) + Math.sin(m.drift) * 0.18;
      m.y += isSnow ? Math.abs(m.speedY) * 2.2 : m.speedY;
      m.alpha = m.baseAlpha + Math.sin(now * m.pulseSpeed * 0.005) * 0.2;

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
    ctx.lineCap = 'round';
    for (const p of this.particles) {
      const screenX = p.x - camera.x;
      const screenY = p.y - camera.y;
      const a = Math.max(0, Math.min(1, p.alpha));
      ctx.globalAlpha = a;

      if (p.type === 'spark') {
        // Trazo luminoso en dirección de la velocidad (se acorta al apagarse)
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const len = p.length * (0.35 + 0.65 * a);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.radius * (0.6 + 0.4 * a);
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX - (p.vx / sp) * len, screenY - (p.vy / sp) * len);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width * a + 0.3;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, p.radius, p.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Bolita que se encoge suavemente mientras se desvanece
        const r = p.radius * (0.35 + 0.65 * a);
        ctx.fillStyle = p.color;
        if (p.square) {
          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.rotate(p.rot || 0);
          ctx.fillRect(-r, -r, r * 2, r * 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }
}

window.particleSystem = new ParticleSystem();
