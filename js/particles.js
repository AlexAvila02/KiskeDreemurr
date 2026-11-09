/**
 * Sistema de Partículas y Efectos Visuales
 * Polen dorado de pradera, hojas/luciérnagas de bosque, nieve de montaña y polvo cálido de animación.
 * Implementación con Object Pooling estricto (cero Garbage Collector en el Game Loop).
 *
 * Tipos de partícula:
 *  - 'dot'   : bolita que se encoge al desvanecerse (polvo, fragmentos).
 *  - 'spark' : trazo luminoso orientado según su velocidad (chispas de impacto / corte).
 *  - 'ring'  : onda de choque que se expande y se afina (aterrizajes fuertes, golpes).
 */
class ParticleSystem {
  constructor() {
    this.MAX_PARTICLES = 420;
    this.pool = new Array(this.MAX_PARTICLES);

    // Pre-alojar todas las instancias de partícula en el constructor para evitar GC
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      this.pool[i] = this._makeParticle();
    }

    this.activeCount = 0;
    this.particles = this.pool; // Referencia compatible para scripts externos
    this.ambientMotes = [];
    this.currentBiome = 'pradera';
    this.initAmbientMotes(55);
  }

  _makeParticle() {
    return {
        type: 'dot',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 2,
        maxRadius: 0,
        width: 1,
        length: 0,
        color: '#ffffff',
        alpha: 0,
        decay: 0.05,
        gravity: 0,
        drag: 0.96,
        square: false,
        rot: 0,
        spin: 0,
        life: 0
      };
  }

  /** Apaga todas las partículas activas (al cambiar de sala) sin destruir el pool. */
  clear() {
    this.activeCount = 0;
    this._repairPool();
  }

  /**
   * Si algún script vació o recortó `particles` (p. ej. `particles.length = 0`),
   * vuelve a llenar el pool para que nunca haya huecos `undefined`.
   */
  _repairPool() {
    const pool = this.pool;
    if (pool.length === this.MAX_PARTICLES && pool[this.MAX_PARTICLES - 1]) return;
    const kept = pool.length;
    if (kept < this.activeCount) this.activeCount = kept;
    pool.length = this.MAX_PARTICLES;
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      if (!pool[i]) pool[i] = this._makeParticle();
    }
    if (this.activeCount > this.MAX_PARTICLES) this.activeCount = this.MAX_PARTICLES;
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

  // Obtiene una partícula reciclada del pool sin instanciar objetos nuevos
  acquire() {
    if (this.pool.length !== this.MAX_PARTICLES) this._repairPool();
    let p;
    if (this.activeCount < this.MAX_PARTICLES) {
      p = this.pool[this.activeCount];
      this.activeCount++;
    } else {
      // Si el pool está lleno, reutiliza la más antigua (índice 0) con swap O(1)
      p = this.pool[0];
      this.pool[0] = this.pool[this.MAX_PARTICLES - 1];
      this.pool[this.MAX_PARTICLES - 1] = p;
    }

    // Reinicializar propiedades por defecto
    p.type = 'dot';
    p.x = 0;
    p.y = 0;
    p.vx = 0;
    p.vy = 0;
    p.radius = 2;
    p.maxRadius = 0;
    p.width = 1;
    p.length = 0;
    p.color = '#ffffff';
    p.alpha = 1;
    p.decay = 0.05;
    p.gravity = 0;
    p.drag = 0.96;
    p.square = false;
    p.rot = 0;
    p.spin = 0;
    p.life = 1;

    return p;
  }

  // Agrega una partícula copiando valores al pool (compatibilidad con scripts externos)
  push(p) {
    const target = this.acquire();
    target.type = p.type || 'dot';
    target.x = p.x ?? 0;
    target.y = p.y ?? 0;
    target.vx = p.vx ?? 0;
    target.vy = p.vy ?? 0;
    target.radius = p.radius ?? 2;
    target.maxRadius = p.maxRadius ?? 0;
    target.width = p.width ?? 1;
    target.length = p.length ?? 0;
    target.color = p.color || '#ffffff';
    target.alpha = p.alpha ?? 1;
    target.decay = p.decay ?? 0.05;
    target.gravity = p.gravity ?? 0;
    target.drag = p.drag ?? 0.96;
    target.square = !!p.square;
    target.rot = p.rot ?? 0;
    target.spin = p.spin ?? 0;
    target.life = p.life ?? 1;
    return target;
  }

  // Polvo cálido de camino al saltar o aterrizar
  createDust(x, y, count = 6, color = '#c9a679') {
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      p.type = 'dot';
      p.x = x + (Math.random() - 0.5) * 16;
      p.y = y - Math.random() * 2;
      p.vx = (Math.random() - 0.5) * 3.2;
      p.vy = -Math.random() * 1.6 - 0.2;
      p.radius = Math.random() * 3.2 + 2.2;
      p.color = color;
      p.alpha = 0.85;
      p.decay = 0.03 + Math.random() * 0.015;
      p.gravity = -0.015; // el polvo flota y sube levemente
      p.drag = 0.92;
    }
  }

  // Bocanada de polvo lateral al correr / derrapar (dir = hacia dónde sale)
  createRunPuff(x, y, dir = -1, count = 2, color = '#d6b88c') {
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      p.type = 'dot';
      p.x = x + (Math.random() - 0.5) * 4;
      p.y = y - Math.random() * 3;
      p.vx = dir * (Math.random() * 1.4 + 0.6);
      p.vy = -Math.random() * 0.8 - 0.2;
      p.radius = Math.random() * 2.2 + 1.6;
      p.color = color;
      p.alpha = 0.7;
      p.decay = 0.045;
      p.gravity = -0.02;
      p.drag = 0.9;
    }
  }

  // Destello dorado de doble salto (anillo + chispas radiales)
  createDoubleJumpSparks(x, y) {
    this.createShockwave(x, y, 26, '#ffe9a8', 3);
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 / 14) * i + Math.random() * 0.2;
      const spd = Math.random() * 2.5 + 2.5;
      const p = this.acquire();
      p.type = i % 2 === 0 ? 'spark' : 'dot';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd * 0.7 + 0.6;
      p.radius = Math.random() * 2.4 + 1.4;
      p.length = 7;
      p.color = i % 2 === 0 ? '#ffe484' : '#fff6d6';
      p.alpha = 1.0;
      p.decay = 0.04;
      p.gravity = 0.03;
      p.drag = 0.9;
    }
  }

  // Chispas cálidas de impacto al golpear (trazos luminosos + bolitas)
  createHitImpact(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * 5 + 2.5;
      const isSpark = Math.random() > 0.35;
      const p = this.acquire();
      p.type = isSpark ? 'spark' : 'dot';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.radius = Math.random() * 2.6 + 1.4;
      p.length = 9 + Math.random() * 6;
      p.color = Math.random() > 0.4 ? '#fff8e0' : '#f0b94a';
      p.alpha = 1.0;
      p.decay = 0.05 + Math.random() * 0.02;
      p.gravity = 0.12;
      p.drag = 0.88;
    }
    this.createShockwave(x, y, 22, '#fff1c9', 2.5);
  }

  // Chispas direccionales del filo de la espada al conectar un golpe
  createSlashSparks(x, y, dir = 1) {
    for (let i = 0; i < 9; i++) {
      const ang = (Math.random() - 0.5) * 1.3;
      const spd = Math.random() * 6 + 4;
      const p = this.acquire();
      p.type = 'spark';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd * dir;
      p.vy = Math.sin(ang) * spd - 1;
      p.radius = 1.6;
      p.length = 12 + Math.random() * 8;
      p.color = i % 3 === 0 ? '#ffd36b' : '#fffbea';
      p.alpha = 1.0;
      p.decay = 0.07;
      p.gravity = 0.18;
      p.drag = 0.86;
    }
  }

  // Onda de choque circular (aterrizajes fuertes, impactos)
  createShockwave(x, y, maxRadius = 30, color = '#fff1c9', width = 3) {
    const p = this.acquire();
    p.type = 'ring';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.radius = 2;
    p.maxRadius = maxRadius;
    p.width = width;
    p.color = color;
    p.alpha = 0.9;
    p.decay = 0.07;
    p.gravity = 0;
    p.drag = 1;
  }

  // Fragmentos de roca ocre al romperse o impactar
  createDebrisFragments(x, y) {
    for (let i = 0; i < 10; i++) {
      const p = this.acquire();
      p.type = 'dot';
      p.x = x;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 6.5;
      p.vy = -Math.random() * 5 - 1.5;
      p.radius = Math.random() * 3.6 + 1.8;
      p.color = i % 2 === 0 ? '#8c7b66' : '#5c4632';
      p.alpha = 1.0;
      p.decay = 0.022;
      p.gravity = 0.3;
      p.drag = 0.98;
      p.square = true;
      p.rot = Math.random() * Math.PI;
      p.spin = (Math.random() - 0.5) * 0.4;
    }
    this.createDust(x, y, 6, '#b49a7a');
  }

  update() {
    if (this.pool.length !== this.MAX_PARTICLES) this._repairPool();
    // Actualizar partículas dinámicas activas del pool
    for (let i = this.activeCount - 1; i >= 0; i--) {
      const p = this.pool[i];
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

      // Swap-and-pop O(1) cuando expira la partícula (cero GC, cero splice)
      if (p.alpha <= 0) {
        const lastIdx = this.activeCount - 1;
        if (i !== lastIdx) {
          const temp = this.pool[i];
          this.pool[i] = this.pool[lastIdx];
          this.pool[lastIdx] = temp;
        }
        this.activeCount--;
      }
    }

    // Actualizar motas ambientales según el bioma
    const isSnow = this.currentBiome === 'montana';
    const now = Date.now();
    const motesCount = this.ambientMotes.length;
    for (let i = 0; i < motesCount; i++) {
      const m = this.ambientMotes[i];
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
    const motesCount = this.ambientMotes.length;
    for (let i = 0; i < motesCount; i++) {
      const m = this.ambientMotes[i];
      const screenX = m.x - camera.x * 0.4;
      const screenY = m.y - camera.y * 0.4;

      ctx.fillStyle = `rgba(${moteRGB}, ${Math.max(0, m.alpha)})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dibujar partículas de eventos en el plano de juego (únicamente las activas)
    ctx.lineCap = 'round';
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.pool[i];
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
