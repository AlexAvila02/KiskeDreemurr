/**
 * ============================================================================
 * CodeArtEngine - Motor Procedural de Fondos y Arte Visual mediante Código
 * ============================================================================
 * Herramienta para agentes y desarrolladores que genera paisajes, fondos
 * atmosféricos, siluetas orgánicas y elementos de arte mediante Canvas 2D
 * con estética de animación tradicional y libros de cuentos (estilo años 50).
 *
 * Características:
 *  - Ruido determinista 1D/2D y Movimiento Browniano Fraccionario (FBM).
 *  - Bóveda celeste con gradientes multi-stop y halo solar/lunar.
 *  - Rayos crepusculares volumétricos (God Rays).
 *  - Cordilleras de montaña con relieve procedural y capas de nieve.
 *  - Colinas onduladas con contornos de tinta cálida (#3a2416).
 *  - Árboles orgánicos, bosques densos y vegetación reactiva al viento.
 *  - Arquitectura clásica (torres en ruinas con almenas, molinos de viento).
 *  - Textura pictórica de grano de papel / pergamino y viñeta suave.
 *
 * Sin dependencias externas. 100% compatible con HTML5 Canvas y Web Audio API.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CodeArt = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const INK_DEFAULT = '#3a2416'; // Tinta marrón cálida clásica de los años 50

  // --------------------------------------------------------------------------
  // 1. Matemáticas y Ruido Determinista
  // --------------------------------------------------------------------------

  /**
   * Generador Pseudo-Aleatorio Mulberry32 (determinista con semilla)
   */
  function createRng(seed = 12345) {
    let s = (seed | 0) || 12345;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Ruido 1D continuo con interpolación suave cosenoidal
   */
  function noise1D(x, seed = 42) {
    const i = Math.floor(x);
    const f = x - i;
    const fCosine = (1 - Math.cos(f * Math.PI)) * 0.5;

    const hash = (n) => {
      const s = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };

    const a = hash(i);
    const b = hash(i + 1);
    return a * (1 - fCosine) + b * fCosine;
  }

  /**
   * Movimiento Browniano Fraccionario (FBM) de varias octavas
   */
  function fbm1D(x, octaves = 4, persistence = 0.5, seed = 42) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for (let o = 0; o < octaves; o++) {
      total += noise1D(x * frequency, seed + o * 101) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxValue;
  }

  // --------------------------------------------------------------------------
  // 2. Cielo, Atmósfera e Iluminación
  // --------------------------------------------------------------------------

  /**
   * Dibuja la bóveda celeste en gradiente vertical con halo celestial
   */
  function drawSky(ctx, width, height, skyStops, celestial = null) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    for (let i = 0; i < skyStops.length; i++) {
      grad.addColorStop(skyStops[i][0], skyStops[i][1]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    if (celestial) {
      const cx = celestial.x || width * 0.75;
      const cy = celestial.y || height * 0.45;
      const r = celestial.radius || 40;
      const glowR = celestial.glowRadius || 120;
      const coreColor = celestial.coreColor || 'rgba(255, 245, 210, 0.95)';
      const glowColor = celestial.glowColor || 'rgba(245, 185, 95, 0.4)';

      // Halo difuso
      const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, glowR);
      halo.addColorStop(0, coreColor);
      halo.addColorStop(0.35, glowColor);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Disco sólido si se especifica
      if (celestial.solid) {
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Dibuja haces de luz o rayos crepusculares (God Rays)
   */
  function drawGodRays(ctx, sourceX, sourceY, options = {}) {
    const numRays = options.count || 7;
    const length = options.length || 700;
    const baseAngle = options.angle || 0.65;
    const spread = options.spread || 0.8;
    const color = options.color || 'rgba(255, 235, 175, 0.08)';

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < numRays; i++) {
      const t = i / (numRays - 1 || 1);
      const angle = baseAngle - spread * 0.5 + t * spread + Math.sin(i * 2.3) * 0.04;
      const rayWidth = (0.04 + Math.sin(i * 1.7) * 0.02) * (options.widthFactor || 1);

      const grad = ctx.createRadialGradient(sourceX, sourceY, 30, sourceX, sourceY, length);
      grad.addColorStop(0, color);
      grad.addColorStop(0.5, color.replace(/[\d\.]+\)$/, '0.04)'));
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(sourceX, sourceY);
      ctx.lineTo(
        sourceX + Math.cos(angle - rayWidth) * length,
        sourceY + Math.sin(angle - rayWidth) * length
      );
      ctx.lineTo(
        sourceX + Math.cos(angle + rayWidth) * length,
        sourceY + Math.sin(angle + rayWidth) * length
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Dibuja nubes flotantes estilizadas de bordes suaves
   */
  function drawClouds(ctx, clouds, cameraX, speedFactor = 0.05, time = 0) {
    ctx.save();
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const cx = ((c.x - cameraX * speedFactor + time * (c.drift || 10)) % 1400 + 1400) % 1400 - 200;
      const cy = c.y;
      const scale = c.scale || 1;

      ctx.fillStyle = c.color || 'rgba(255, 248, 235, 0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, 28 * scale, 0, Math.PI * 2);
      ctx.arc(cx + 32 * scale, cy - 8 * scale, 36 * scale, 0, Math.PI * 2);
      ctx.arc(cx + 72 * scale, cy - 4 * scale, 30 * scale, 0, Math.PI * 2);
      ctx.arc(cx + 104 * scale, cy, 24 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 3. Montañas y Relieves Lejanos
  // --------------------------------------------------------------------------

  /**
   * Dibuja una cordillera montañosa con relieve fractal FBM y sombra lateral
   */
  function drawMountainRange(ctx, yBase, peakHeight, width, cameraX, parallax, options = {}) {
    const fillColor = options.fillColor || '#43343d';
    const strokeColor = options.strokeColor || INK_DEFAULT;
    const seed = options.seed || 101;
    const step = options.step || 25;
    const snowCap = options.snowCap || false;
    const snowColor = options.snowColor || '#e8eff7';

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = options.lineWidth || 2;

    const points = [];
    const worldOffset = cameraX * parallax;

    for (let x = -step; x <= width + step * 2; x += step) {
      const worldX = x + worldOffset;
      const noise = fbm1D(worldX * 0.0028, 4, 0.52, seed);
      const y = yBase - noise * peakHeight;
      points.push({ x, y, noise });
    }

    // Cuerpo principal de la montaña
    ctx.beginPath();
    ctx.moveTo(points[0].x, yBase + 180);
    for (let i = 0; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, yBase + 180);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Capas de nieve opcionales en los picos más altos
    if (snowCap) {
      ctx.fillStyle = snowColor;
      for (let i = 1; i < points.length - 1; i++) {
        const pt = points[i];
        if (pt.noise > 0.65) {
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x - 12, pt.y + 18);
          ctx.lineTo(pt.x, pt.y + 12);
          ctx.lineTo(pt.x + 12, pt.y + 18);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  /**
   * Dibuja colinas redondeadas y suaves estilo ilustración años 50
   */
  function drawRollingHills(ctx, yBase, amplitude, width, cameraX, parallax, options = {}) {
    const fillColor = options.fillColor || '#4b382a';
    const strokeColor = options.strokeColor || INK_DEFAULT;
    const segmentWidth = options.segmentWidth || 180;
    const lineWidth = options.lineWidth || 2.2;

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;

    const offsetX = -(cameraX * parallax) % segmentWidth;

    ctx.beginPath();
    ctx.moveTo(-segmentWidth, yBase + 250);

    for (let x = offsetX - segmentWidth * 2; x < width + segmentWidth * 2; x += segmentWidth) {
      const midX = x + segmentWidth * 0.5;
      const midY = yBase - amplitude;
      const endX = x + segmentWidth;
      const endY = yBase;
      ctx.quadraticCurveTo(midX, midY, endX, endY);
    }

    ctx.lineTo(width + segmentWidth * 2, yBase + 250);
    ctx.lineTo(-segmentWidth * 2, yBase + 250);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 4. Vegetación y Follaje Orgánico
  // --------------------------------------------------------------------------

  /**
   * Dibuja un árbol de estilo animación clásica con tronco orgánico y racimos de follaje
   */
  function drawStylizedTree(ctx, x, y, options = {}) {
    const trunkH = options.height || 95;
    const radius = options.radius || 46;
    const ink = options.ink || INK_DEFAULT;
    const trunkColor = options.trunkColor || '#5a412e';
    const leafDark = options.leafDark || '#26422b';
    const leafMid = options.leafMid || '#406e46';
    const leafLight = options.leafLight || '#669c5e';

    ctx.save();

    // Tronco con raíces ensanchadas y curvatura
    ctx.fillStyle = trunkColor;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 9, y);
    ctx.quadraticCurveTo(x - 5, y - trunkH * 0.45, x - 4, y - trunkH);
    ctx.lineTo(x + 4, y - trunkH);
    ctx.quadraticCurveTo(x + 5, y - trunkH * 0.45, x + 9, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Racimos de follaje con volumen
    const cy = y - trunkH;
    const clusters = [
      { dx: 0, dy: -radius * 0.45, r: radius * 0.78 },
      { dx: -radius * 0.52, dy: 0, r: radius * 0.62 },
      { dx: radius * 0.52, dy: 0, r: radius * 0.62 },
      { dx: -radius * 0.28, dy: radius * 0.22, r: radius * 0.52 },
      { dx: radius * 0.28, dy: radius * 0.22, r: radius * 0.52 },
      { dx: 0, dy: radius * 0.05, r: radius * 0.58 }
    ];

    // 1. Capa de sombra
    ctx.fillStyle = leafDark;
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      ctx.beginPath();
      ctx.arc(x + c.dx, cy + c.dy + 4, c.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Capa media con contorno de tinta
    ctx.fillStyle = leafMid;
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      ctx.beginPath();
      ctx.arc(x + c.dx, cy + c.dy, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 3. Capa de realce luminoso
    ctx.fillStyle = leafLight;
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      ctx.beginPath();
      ctx.arc(x + c.dx - c.r * 0.2, cy + c.dy - c.r * 0.24, c.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Dibuja un telón de fondo de bosque denso en paralaje
   */
  function drawForestBackdrop(ctx, yBase, width, cameraX, parallax, options = {}) {
    const spacing = options.spacing || 110;
    const fillColor = options.fillColor || 'rgba(24, 45, 34, 0.7)';
    const count = Math.ceil(width / spacing) + 3;
    const offsetX = -(cameraX * parallax) % spacing;

    ctx.save();
    ctx.fillStyle = fillColor;

    for (let i = -1; i < count; i++) {
      const tx = offsetX + i * spacing;
      const th = 220 + ((i * 37) % 60);
      const tw = 22 + ((i * 13) % 10);
      // Tronco alto
      ctx.fillRect(tx, yBase - th, tw, th);
      // Copa estilizada
      ctx.beginPath();
      ctx.arc(tx + tw * 0.5, yBase - th, 45 + ((i * 17) % 15), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Dibuja mechones de hierba y briznas mecidas por el viento
   */
  function drawGrassTufts(ctx, x, y, width, windWave, options = {}) {
    const step = options.step || 12;
    const bladeColor = options.bladeColor || '#a5b84d';
    const bladeH = options.bladeHeight || 6;

    ctx.save();
    ctx.strokeStyle = bladeColor;
    ctx.lineWidth = options.lineWidth || 1.8;
    ctx.beginPath();

    for (let gx = x + 4; gx < x + width - 4; gx += step) {
      const localWind = windWave + Math.sin(gx * 0.05) * 1.5;
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + localWind, y - bladeH);
    }
    ctx.stroke();
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 5. Arquitectura y Estructuras Procedurales
  // --------------------------------------------------------------------------

  /**
   * Dibuja una torre medieval en ruinas con almenas y ventana ojival
   */
  function drawRuinedTower(ctx, x, y, options = {}) {
    const w = options.width || 68;
    const h = options.height || 170;
    const stoneColor = options.stoneColor || '#614f41';
    const stoneShadow = options.stoneShadow || '#3e3127';
    const ink = options.ink || INK_DEFAULT;

    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;

    // Cuerpo de la torre con gradiente de volumen
    const grad = ctx.createLinearGradient(x - w * 0.5, y - h, x + w * 0.5, y);
    grad.addColorStop(0, stoneColor);
    grad.addColorStop(1, stoneShadow);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.lineTo(x - w * 0.44, y - h);
    ctx.lineTo(x + w * 0.44, y - h);
    ctx.lineTo(x + w * 0.5, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Almenas superiores desgastadas
    ctx.fillStyle = stoneColor;
    const crenW = w * 0.2;
    for (let i = 0; i < 4; i++) {
      if (i === 2 && options.broken) continue; // Almena destruida
      const cx = x - w * 0.46 + i * (crenW * 1.25);
      ctx.fillRect(cx, y - h - 14, crenW * 0.8, 14);
      ctx.strokeRect(cx, y - h - 14, crenW * 0.8, 14);
    }

    // Ventana ojival oscura
    const winY = y - h * 0.6;
    ctx.fillStyle = '#1c1511';
    ctx.beginPath();
    ctx.arc(x, winY, 8, Math.PI, 0);
    ctx.lineTo(x + 8, winY + 22);
    ctx.lineTo(x - 8, winY + 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Grietas y enredadera opcional
    if (options.vines) {
      ctx.strokeStyle = '#3e5c33';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.35, y);
      ctx.quadraticCurveTo(x - w * 0.2, y - h * 0.3, x - w * 0.3, y - h * 0.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Dibuja un molino de viento tradicional con aspas animadas
   */
  function drawWindmill(ctx, x, y, rotationAngle = 0, options = {}) {
    const ink = options.ink || INK_DEFAULT;
    const wallColor = options.wallColor || '#5c432d';
    const roofColor = options.roofColor || '#8c412b';
    const sailColor = options.sailColor || '#e8d2a6';

    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;

    // Cuerpo cónico
    ctx.fillStyle = wallColor;
    ctx.beginPath();
    ctx.moveTo(x - 28, y);
    ctx.lineTo(x - 18, y - 95);
    ctx.lineTo(x + 18, y - 95);
    ctx.lineTo(x + 28, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tejado cónico
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(x - 24, y - 95);
    ctx.lineTo(x, y - 124);
    ctx.lineTo(x + 24, y - 95);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Aspas giratorias con eje
    ctx.translate(x, y - 82);
    ctx.rotate(rotationAngle);
    ctx.fillStyle = sailColor;

    for (let a = 0; a < 4; a++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-3, 0, 6, 56);
      ctx.strokeRect(-3, 0, 6, 56);

      // Travesaños decorativos en las aspas
      ctx.beginPath();
      for (let s = 14; s <= 50; s += 12) {
        ctx.moveTo(-7, s);
        ctx.lineTo(7, s);
      }
      ctx.stroke();
    }

    // Tuerca central
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 6. Post-Procesado Pictórico y Filtros Atmosféricos
  // --------------------------------------------------------------------------

  /**
   * Dibuja una viñeta radial suave para encuadre cinematográfico
   */
  function drawVignette(ctx, width, height, options = {}) {
    const tint = options.tint || 'rgba(38, 20, 10, 0.28)';
    const radius = Math.max(width, height) * (options.coverage || 0.72);

    ctx.save();
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      radius * 0.35,
      width * 0.5,
      height * 0.5,
      radius
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, tint);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  /**
   * Genera o aplica textura pictórica de papel/pergamino
   */
  let _parchmentCanvas = null;
  function drawParchmentTexture(ctx, width, height, alpha = 0.035) {
    if (alpha <= 0) return;
    if (!_parchmentCanvas && typeof document !== 'undefined') {
      const pc = document.createElement('canvas');
      pc.width = 256;
      pc.height = 256;
      const pctx = pc.getContext('2d');
      const img = pctx.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + ((Math.random() * 60) | 0) - 30;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      pctx.putImageData(img, 0, 0);
      _parchmentCanvas = pc;
    }

    if (_parchmentCanvas) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = alpha;
      const pat = ctx.createPattern(_parchmentCanvas, 'repeat');
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // 7. Renderizador Maestro de Biomas
  // --------------------------------------------------------------------------

  const PRESETS = {
    pradera: {
      skyStops: [
        [0, '#2c1d33'],
        [0.35, '#6e3746'],
        [0.72, '#c86d49'],
        [1, '#e8b96a']
      ],
      celestial: { x: 740, y: 240, radius: 45, glowRadius: 130, coreColor: 'rgba(255, 245, 200, 0.9)', glowColor: 'rgba(245, 185, 95, 0.38)' },
      godRays: true,
      farMountain: { yBase: 470, peak: 190, color: 'rgba(78, 44, 52, 0.65)' },
      midHills: { yBase: 465, amp: 45, color: '#4b382a', stroke: '#3a2416' },
      treePalette: { trunkColor: '#5a412e', leafDark: '#2b442b', leafMid: '#587a38', leafLight: '#8da64c' }
    },
    bosque: {
      skyStops: [
        [0, '#11221e'],
        [0.45, '#1e382f'],
        [0.8, '#325443'],
        [1, '#5d7d5d']
      ],
      celestial: { x: 320, y: 160, radius: 36, glowRadius: 100, coreColor: 'rgba(220, 245, 220, 0.65)', glowColor: 'rgba(140, 210, 160, 0.22)' },
      godRays: true,
      godRaysColor: 'rgba(180, 240, 200, 0.07)',
      farMountain: { yBase: 470, peak: 140, color: 'rgba(20, 42, 33, 0.72)' },
      midHills: { yBase: 465, amp: 38, color: '#243b2c', stroke: '#17261c' },
      treePalette: { trunkColor: '#3c3024', leafDark: '#183421', leafMid: '#2e5839', leafLight: '#4e855c' }
    },
    montana: {
      skyStops: [
        [0, '#1c2838'],
        [0.45, '#3b526b'],
        [0.8, '#6e8ba6'],
        [1, '#b8cde0']
      ],
      celestial: { x: 780, y: 170, radius: 42, glowRadius: 120, coreColor: 'rgba(255, 255, 255, 0.85)', glowColor: 'rgba(200, 225, 245, 0.35)' },
      godRays: false,
      farMountain: { yBase: 470, peak: 240, color: 'rgba(46, 62, 82, 0.68)', snowCap: true },
      midHills: { yBase: 465, amp: 55, color: '#465669', stroke: '#253140' },
      treePalette: { trunkColor: '#3e4854', leafDark: '#33414f', leafMid: '#586b7d', leafLight: '#94a7ba' }
    },
    castillo: {
      skyStops: [
        [0, '#1a1024'],
        [0.4, '#381f3d'],
        [0.75, '#683652'],
        [1, '#9e5b66']
      ],
      celestial: { x: 680, y: 200, radius: 40, glowRadius: 110, coreColor: 'rgba(255, 220, 180, 0.75)', glowColor: 'rgba(210, 130, 110, 0.3)' },
      godRays: true,
      farMountain: { yBase: 470, peak: 170, color: 'rgba(48, 28, 48, 0.7)' },
      midHills: { yBase: 465, amp: 40, color: '#3e3044', stroke: '#281d2c' },
      treePalette: { trunkColor: '#42333b', leafDark: '#3b2233', leafMid: '#633c52', leafLight: '#91596e' }
    }
  };

  /**
   * Renderizado completo de fondo para cualquier bioma
   */
  function renderBiomeBackground(ctx, biomeKey, camera, width = 960, height = 540, time = 0, options = {}) {
    const preset = PRESETS[biomeKey] || PRESETS.pradera;

    // 1. Cielo
    const celestial = preset.celestial
      ? { ...preset.celestial, x: preset.celestial.x - camera.x * 0.03 }
      : null;
    drawSky(ctx, width, height, preset.skyStops, celestial);

    // 2. Rayos crepusculares si el bioma los incluye
    if (preset.godRays && celestial) {
      drawGodRays(ctx, celestial.x, celestial.y, {
        color: preset.godRaysColor || 'rgba(255, 235, 175, 0.08)'
      });
    }

    // 3. Montañas fractales lejanas
    if (preset.farMountain) {
      drawMountainRange(
        ctx,
        preset.farMountain.yBase,
        preset.farMountain.peak,
        width,
        camera.x,
        0.08,
        {
          fillColor: preset.farMountain.color,
          snowCap: preset.farMountain.snowCap || false
        }
      );
    }

    // 4. Elementos específicos de bosque o colinas intermedias
    if (biomeKey === 'bosque') {
      drawForestBackdrop(ctx, 470, width, camera.x, 0.18, {
        fillColor: 'rgba(25, 48, 36, 0.82)'
      });
    }

    // 5. Colinas rodantes en plano medio
    if (preset.midHills) {
      drawRollingHills(ctx, preset.midHills.yBase, preset.midHills.amp, width, camera.x, 0.25, {
        fillColor: preset.midHills.color,
        strokeColor: preset.midHills.stroke
      });
    }

    // 6. Molino de viento si la sala lo solicita
    if (options.hasWindmill) {
      const mx = 930 - camera.x;
      const my = 160 - (camera.y || 0);
      drawWindmill(ctx, mx, my, time * 0.0007);
    }

    // 7. Torre en ruinas si se solicita
    if (options.hasTower) {
      const tx = 680 - camera.x * 0.45;
      const ty = 430 - (camera.y || 0) * 0.45;
      drawRuinedTower(ctx, tx, ty, { vines: true, broken: true });
    }

    // 8. Viñeta y textura de papel
    drawVignette(ctx, width, height);
    drawParchmentTexture(ctx, width, height, 0.035);
  }

  // --------------------------------------------------------------------------
  // Exportar API Pública
  // --------------------------------------------------------------------------
  return {
    PRESETS,
    createRng,
    noise1D,
    fbm1D,
    drawSky,
    drawGodRays,
    drawClouds,
    drawMountainRange,
    drawRollingHills,
    drawStylizedTree,
    drawForestBackdrop,
    drawGrassTufts,
    drawRuinedTower,
    drawWindmill,
    drawVignette,
    drawParchmentTexture,
    renderBiomeBackground
  };
});
