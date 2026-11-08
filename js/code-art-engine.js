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

  // --------------------------------------------------------------------------
  // 7b. Viaje del Atardecer a la Noche (montañas, río hacia el sol, estrellas)
  // --------------------------------------------------------------------------

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function rgba(c, a = 1) {
    return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smoothstep(a, b, v) { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }

  // Fotogramas clave del cielo: t = 0 atardecer dorado → t = 1 noche estrellada
  const SKY_KEYS = [
    { t: 0.00, top: '#56508f', mid: '#e98f5e', hor: '#ffd98c', sun: '#fff3c4', land: '#5b4436' },
    { t: 0.25, top: '#3b2f6c', mid: '#db6658', hor: '#ffb25c', sun: '#ffd27a', land: '#4a3133' },
    { t: 0.50, top: '#251f50', mid: '#8f4068', hor: '#f27c4c', sun: '#ff7a3d', land: '#33243a' },
    { t: 0.68, top: '#18193d', mid: '#522f66', hor: '#c95663', sun: '#ff5232', land: '#251c36' },
    { t: 0.84, top: '#0e132c', mid: '#26244d', hor: '#663f66', sun: '#e04838', land: '#18162c' },
    { t: 1.00, top: '#060917', mid: '#111939', hor: '#283058', sun: '#ff6a3a', land: '#101327' }
  ].map(k => ({ t: k.t, top: hexToRgb(k.top), mid: hexToRgb(k.mid), hor: hexToRgb(k.hor), sun: hexToRgb(k.sun), land: hexToRgb(k.land) }));

  function skyAt(t) {
    t = clamp01(t);
    let i = 0;
    while (i < SKY_KEYS.length - 2 && t > SKY_KEYS[i + 1].t) i++;
    const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
    const f = smoothstep(0, 1, (t - a.t) / (b.t - a.t));
    return {
      top: mixRgb(a.top, b.top, f), mid: mixRgb(a.mid, b.mid, f), hor: mixRgb(a.hor, b.hor, f),
      sun: mixRgb(a.sun, b.sun, f), land: mixRgb(a.land, b.land, f)
    };
  }

  // Estrellas fijas con profundidad de paralaje (lejanas, medias y brillantes cercanas)
  const STARS = (() => {
    const rng = createRng(777);
    const list = [];
    for (let i = 0; i < 230; i++) {
      const depth = rng(); // 0 = fondo profundo, 1 = estrella brillante más cercana
      list.push({
        x: rng() * 1400,
        y: Math.pow(rng(), 1.5) * 330,
        r: depth > 0.9 ? 1.85 : 0.55 + depth * 0.95,
        tw: rng() * 6.28,
        sp: 0.8 + rng() * 2.2,
        par: 0.008 + depth * 0.024
      });
    }
    return list;
  })();

  // Bandadas de aves regresando al nido en distintos planos de profundidad
  const FLOCKS = [
    { x0: 1120, y0: 112, vx: -0.025, vy: -0.002, count: 5, span: 18, scale: 1.05, par: 0.055, parY: 0.025, seed: 1 },
    { x0: 1480, y0: 162, vx: -0.018, vy: -0.001, count: 4, span: 13, scale: 0.78, par: 0.032, parY: 0.015, seed: 2 },
    { x0: 780,  y0: 138, vx: -0.021, vy: -0.0015, count: 3, span: 15, scale: 0.88, par: 0.044, parY: 0.02, seed: 3 }
  ];

  // Luciérnagas de fondo con capas de profundidad sobre la ribera y las colinas
  const AMBIENT_FIREFLIES = (() => {
    const rng = createRng(919);
    const list = [];
    for (let i = 0; i < 30; i++) {
      const depth = rng(); // 0 = lejana sobre el valle, 1 = cercana a las colinas
      list.push({
        x: rng() * 1400,
        y: 320 + rng() * 180,
        phase: rng() * 6.283,
        speed: 0.0018 + rng() * 0.0024,
        driftX: 10 + depth * 24,
        driftY: 5 + depth * 12,
        size: 1.1 + depth * 1.6,
        par: 0.16 + depth * 0.24,
        parY: 0.06 + depth * 0.12
      });
    }
    return list;
  })();

  const NIGHT_INK = hexToRgb('#0b0d1e');
  const DEFAULT_CYCLE_DURATION_MS = 180000; // 3 minutos de tiempo real de atardecer a noche cerrada
  const ROOM_WORLD_STRIDE = 820;            // desplazamiento continuo de mundo entre salas para paralaje sin cortes
  const journey = {
    elapsedMs: 0,
    lastTick: null,
    wasPlaying: false,
    shown: 0,
    durationMs: DEFAULT_CYCLE_DURATION_MS,
    loop: false, // false: se asienta en la noche estrellada; true: ciclo continuo
    camX: null,
    camY: null,
    velX: 0,
    velY: 0
  };

  /**
   * Calcula coordenadas de cámara continuas y suavizadas (X e Y) a través de todo el mundo,
   * evitando saltos bruscos del paisaje al cruzar de una sala a otra y añadiendo paralaje vertical
   * cuando Ruben salta o escala hacia zonas altas (como el Altozano del Molino).
   */
  function getSmoothParallaxCamera(camera, width, height) {
    const g = typeof window !== 'undefined' ? window.gameInstance : null;
    let targetX = (camera && camera.x) || 0;
    let targetY = (camera && camera.y) || 0;

    if (g && g.world) {
      const roomIdx = g.world.currentRoomIndex || 0;
      // La sala 2 (Altozano del Molino) está arriba de la sala 1
      const worldRoomX = roomIdx === 2 ? 1.35 : roomIdx;
      const worldRoomY = roomIdx === 2 ? -180 : 0;
      targetX += worldRoomX * ROOM_WORLD_STRIDE;
      targetY += worldRoomY;

      if (g.player) {
        // Sutil respuesta vertical a la altura de Ruben dentro de la sala (saltos / plataformas altas)
        const relY = ((g.player.y || 410) - 410) * 0.32;
        targetY += relY;
      }
    }

    if (journey.camX === null) {
      journey.camX = targetX;
      journey.camY = targetY;
    }

    const dx = targetX - journey.camX;
    const dy = targetY - journey.camY;
    // Si la distancia es razonable (misma sala o transición normal), interpolar con inercia sedosa
    if (Math.abs(dx) < 2400) {
      journey.camX += dx * 0.14;
      journey.camY += dy * 0.12;
      journey.velX = journey.velX * 0.82 + dx * 0.18;
      journey.velY = journey.velY * 0.82 + dy * 0.18;
    } else {
      journey.camX = targetX;
      journey.camY = targetY;
      journey.velX = 0;
      journey.velY = 0;
    }

    return {
      x: journey.camX,
      y: journey.camY,
      vx: journey.velX,
      vy: journey.velY
    };
  }

  /**
   * Progreso del atardecer basado en el tiempo real transcurrido (0..1).
   * Avanza de forma orgánica y constante cada segundo sin depender de cuánto
   * camine o retroceda el jugador, pausándose únicamente si la partida está en pausa.
   */
  function getJourneyProgress(options = {}, time = Date.now()) {
    if (typeof options.progress === 'number') return clamp01(options.progress);
    if (typeof window !== 'undefined' && typeof window.SKY_PROGRESS === 'number') return clamp01(window.SKY_PROGRESS);

    const now = typeof time === 'number' ? time : Date.now();
    if (journey.lastTick === null) journey.lastTick = now;
    const dt = Math.max(0, Math.min(250, now - journey.lastTick));
    journey.lastTick = now;

    const g = typeof window !== 'undefined' ? window.gameInstance : null;
    const isPlaying = g ? Boolean(g.isPlaying) : true;
    const isPaused = g ? Boolean(g.isPaused) : false;

    // Al comenzar una partida nueva desde el menú principal, iniciar el atardecer fresco
    if (isPlaying && !journey.wasPlaying) {
      journey.elapsedMs = 0;
      journey.shown = 0;
    }
    journey.wasPlaying = isPlaying;

    const duration = (typeof options.durationMs === 'number' && options.durationMs > 1000)
      ? options.durationMs
      : (typeof window !== 'undefined' && typeof window.SKY_DURATION_MS === 'number' ? window.SKY_DURATION_MS : journey.durationMs);

    if (!isPaused) {
      // En la pantalla de título avanza suavemente a menor velocidad para dar vida al fondo
      const rate = isPlaying ? 1.0 : 0.35;
      journey.elapsedMs += dt * rate;
    }

    let raw;
    const shouldLoop = options.loop !== undefined ? options.loop : (typeof window !== 'undefined' && window.SKY_LOOP !== undefined ? window.SKY_LOOP : journey.loop);
    if (shouldLoop) {
      const cyclePos = (journey.elapsedMs % (duration * 2)) / duration;
      raw = cyclePos <= 1 ? cyclePos : 2 - cyclePos;
    } else {
      raw = clamp01(journey.elapsedMs / duration);
    }

    // Curva orgánica: disfruta de la hora dorada y el crepúsculo con suavidad cinematográfica
    const easedTarget = raw * 0.45 + smoothstep(0, 1, raw) * 0.55;
    journey.shown += (easedTarget - journey.shown) * 0.08;
    return clamp01(journey.shown);
  }

  // Altura de una cordillera con un valle abierto alrededor del río
  function ridgeY(x, layer, valleyX) {
    const n = fbm1D((x + layer.offset) * layer.freq, 4, 0.5, layer.seed);
    const sharp = Math.pow(n, 1.35);
    const dist = Math.abs(x - valleyX);
    const mask = layer.valleyMin + (1 - layer.valleyMin) * smoothstep(layer.valleyW * 0.25, layer.valleyW, dist);
    return layer.base - sharp * layer.peak * mask;
  }

  function renderSunsetJourney(ctx, biomeKey, camera, width, height, time, options) {
    const t = getJourneyProgress(options, time);
    const sky = skyAt(t);
    const night = smoothstep(0.5, 0.92, t);
    const dusk = smoothstep(0.08, 0.45, t) * (1 - smoothstep(0.62, 0.85, t));
    const camX = camera.x || 0;
    const HOR = 330;                           // línea del horizonte
    const valleyBase = width * 0.5 + 40;       // dónde se abre el valle del río

    // ---- 1. Cielo
    const g = ctx.createLinearGradient(0, 0, 0, HOR + 10);
    g.addColorStop(0, rgba(sky.top));
    g.addColorStop(0.55, rgba(sky.mid));
    g.addColorStop(1, rgba(sky.hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // ---- 2. Estrellas, vía láctea y estrellas fugaces
    if (night > 0.01) {
      ctx.save();
      // Vía láctea tenue
      ctx.globalAlpha = night * 0.22;
      const mw = ctx.createLinearGradient(0, 40, width, 260);
      mw.addColorStop(0, 'rgba(180,190,255,0)');
      mw.addColorStop(0.5, 'rgba(200,205,255,0.55)');
      mw.addColorStop(1, 'rgba(180,190,255,0)');
      ctx.fillStyle = mw;
      ctx.beginPath();
      ctx.moveTo(0, 210); ctx.quadraticCurveTo(width * 0.5, 40, width, 60);
      ctx.lineTo(width, 130); ctx.quadraticCurveTo(width * 0.5, 120, 0, 290);
      ctx.fill();
      ctx.globalAlpha = 1;

      for (const s of STARS) {
        const sx = ((s.x - camX * 0.02) % 1400 + 1400) % 1400 - 220;
        if (sx < -4 || sx > width + 4) continue;
        const fadeH = 1 - smoothstep(HOR - 120, HOR, s.y);   // menos estrellas cerca del horizonte
        const tw = 0.55 + 0.45 * Math.sin(time * 0.001 * s.sp + s.tw);
        const a = night * fadeH * tw;
        if (a < 0.03) continue;
        ctx.fillStyle = `rgba(255, 248, 230, ${a})`;
        if (s.r > 1.5) {
          ctx.beginPath(); ctx.arc(sx, s.y, s.r, 0, 6.283); ctx.fill();
          ctx.fillStyle = `rgba(255, 248, 230, ${a * 0.35})`;
          ctx.fillRect(sx - 5, s.y - 0.5, 10, 1); ctx.fillRect(sx - 0.5, s.y - 5, 1, 10);
        } else {
          ctx.fillRect(sx - s.r * 0.5, s.y - s.r * 0.5, s.r * 1.4, s.r * 1.4);
        }
      }

      // Estrella fugaz cada ~7 s
      const period = 7000, ph = (time % period) / period;
      if (night > 0.6 && ph < 0.12) {
        const k = Math.floor(time / period);
        const r = createRng(k + 9)();
        const p = ph / 0.12;
        const x0 = 150 + r * 600, y0 = 40 + r * 80;
        const hx = x0 + p * 220, hy = y0 + p * 90;
        const tail = ctx.createLinearGradient(hx - 90, hy - 37, hx, hy);
        tail.addColorStop(0, 'rgba(255,255,255,0)');
        tail.addColorStop(1, `rgba(255,250,235,${(1 - p) * night})`);
        ctx.strokeStyle = tail; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(hx - 90, hy - 37); ctx.lineTo(hx, hy); ctx.stroke();
      }
      ctx.restore();
    }

    // ---- 3. Sol que desciende hacia el valle / luna que aparece
    const valleyFar = valleyBase - camX * 0.04;
    const sunT = smoothstep(0, 0.72, t);
    const sunX = valleyFar + Math.sin(sunT * 1.4) * 18;
    const sunY = 128 + sunT * (HOR + 68 - 128);
    const sunBreath = Math.sin(time * 0.0022) * 1.5;
    const sunR = 44 + sunT * 12 + sunBreath * 0.4;
    const sunVisible = sunY - sunR < HOR + 35;
    if (sunVisible) {
      ctx.save();
      const glowR = 270 + sunT * 140 + sunBreath * 8;
      const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.45, sunX, sunY, glowR);
      halo.addColorStop(0, rgba(sky.sun, 0.82 * (1 - night)));
      halo.addColorStop(0.28, rgba(sky.hor, 0.42 * (1 - night)));
      halo.addColorStop(1, rgba(sky.hor, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, HOR + 40);

      // Rayos crepusculares volumétricos (God Rays) emergiendo del sol hacia el cielo
      const rayAlpha = (1 - smoothstep(0.58, 0.76, t)) * 0.11;
      if (rayAlpha > 0.005) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const rayCount = 7;
        for (let r = 0; r < rayCount; r++) {
          const baseAng = -Math.PI * 0.88 + (r / (rayCount - 1)) * Math.PI * 0.76;
          const sway = Math.sin(time * 0.00045 + r * 1.9) * 0.035;
          const ang = baseAng + sway;
          const spread = 0.042 + (r % 2) * 0.018;
          const rayLen = 420 + (r % 3) * 90;
          const rg = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, rayLen);
          rg.addColorStop(0, rgba(sky.sun, rayAlpha));
          rg.addColorStop(0.55, rgba(sky.hor, rayAlpha * 0.45));
          rg.addColorStop(1, 'rgba(255, 220, 160, 0)');
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.moveTo(sunX, sunY);
          ctx.lineTo(sunX + Math.cos(ang - spread) * rayLen, sunY + Math.sin(ang - spread) * rayLen);
          ctx.lineTo(sunX + Math.cos(ang + spread) * rayLen, sunY + Math.sin(ang + spread) * rayLen);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Disco con contorno cálido
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, 6.283);
      const disc = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
      disc.addColorStop(0, rgba(mixRgb(sky.sun, [255, 255, 235], 0.55)));
      disc.addColorStop(1, rgba(sky.sun));
      ctx.fillStyle = disc; ctx.fill();
      // Franjas de calor horizontales animadas (estilo cartel años 50)
      // Se pintan con el color del cielo que rodea al sol y solo dentro del disco:
      // 'destination-out' agujereaba todo el fondo y dejaba barras negras.
      ctx.save();
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, 6.283); ctx.clip();
      const stripeC = mixRgb(sky.hor, sky.sun, 0.35);
      const heatWave = (time * 0.00035) % 0.2;
      for (let i = 0; i < 4; i++) {
        const frac = 0.22 + ((i * 0.2 + heatWave) % 0.78);
        const by = sunY + sunR * frac;
        ctx.fillStyle = rgba(stripeC, 0.45 + frac * 0.45);
        ctx.fillRect(sunX - sunR - 2, by, sunR * 2 + 4, 1.2 + frac * 2.8);
      }
      ctx.restore();
      ctx.restore();
    }

    // Luna llena con cráteres suaves
    const moonA = smoothstep(0.55, 0.85, t);
    const moonX = width * 0.2 - camX * 0.03;
    const moonY = 260 - moonA * 150;
    if (moonA > 0.01) {
      ctx.save();
      const mh = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 150);
      mh.addColorStop(0, `rgba(220, 230, 255, ${0.35 * moonA})`);
      mh.addColorStop(1, 'rgba(220, 230, 255, 0)');
      ctx.fillStyle = mh; ctx.fillRect(moonX - 150, moonY - 150, 300, 300);
      ctx.fillStyle = `rgba(246, 240, 220, ${moonA})`;
      ctx.beginPath(); ctx.arc(moonX, moonY, 26, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(190, 185, 175, ${0.45 * moonA})`;
      ctx.beginPath(); ctx.arc(moonX - 8, moonY - 6, 6, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(moonX + 9, moonY + 7, 4.5, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(moonX + 5, moonY - 11, 3, 0, 6.283); ctx.fill();
      ctx.restore();
    }

    // ---- 4. Nubes alargadas iluminadas desde abajo
    ctx.save();
    const cloudLit = mixRgb(sky.sun, sky.mid, 0.35);
    const cloudBody = mixRgb(sky.mid, sky.top, 0.55);
    const cloudNight = mixRgb(sky.top, [70, 80, 130], 0.35);
    for (let i = 0; i < 6; i++) {
      const cw = 220 + (i * 71) % 160;
      const cx = (((i * 263 + time * 0.004 * (1 + i % 3)) - camX * (0.03 + i * 0.006)) % (width + 600) + width + 600) % (width + 600) - 300;
      const cy = 60 + (i * 47) % 170;
      const body = mixRgb(cloudBody, cloudNight, night);
      ctx.fillStyle = rgba(body, 0.55 - night * 0.2);
      ctx.beginPath(); ctx.ellipse(cx, cy, cw * 0.5, 9 + (i % 3) * 3, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx - cw * 0.15, cy - 7, cw * 0.28, 8, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = rgba(cloudLit, (0.75 - night * 0.7) * (1 - cy / 400));
      ctx.beginPath(); ctx.ellipse(cx + 6, cy + 5, cw * 0.42, 3.5, 0, 0, 6.283); ctx.fill();
    }
    ctx.restore();

    // ---- 5. Cordilleras con perspectiva atmosférica (lejos → cerca)
    const layers = [
      { par: 0.04, base: HOR + 6, peak: 190, freq: 0.0032, seed: 11, offset: 0, valleyW: 260, valleyMin: 0.12, haze: 0.42 },
      { par: 0.09, base: HOR + 14, peak: 150, freq: 0.0045, seed: 23, offset: 900, valleyW: 300, valleyMin: 0.05, haze: 0.22 },
      { par: 0.15, base: HOR + 22, peak: 105, freq: 0.006, seed: 37, offset: 2100, valleyW: 330, valleyMin: 0.0, haze: 0.06 }
    ];
    const snowy = biomeKey === 'montana';
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      const vx = valleyBase - camX * L.par;
      const shift = camX * L.par;
      const landC = mixRgb(sky.land, NIGHT_INK, night * 0.5 * (1 - L.haze));
      const col = mixRgb(landC, sky.hor, L.haze * (1 - night * 0.55));
      const pts = [];
      for (let x = -10; x <= width + 10; x += 10) pts.push([x, ridgeY(x + shift, L, vx + shift)]);

      ctx.save();
      // Cuerpo con degradado vertical (más claro en las cumbres que miran al sol)
      const mg = ctx.createLinearGradient(0, HOR - L.peak, 0, HOR + 30);
      mg.addColorStop(0, rgba(mixRgb(col, sky.sun, 0.18 * (1 - night))));
      mg.addColorStop(1, rgba(mixRgb(col, sky.hor, 0.25 * (1 - night))));
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.moveTo(-10, HOR + 60);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.lineTo(width + 10, HOR + 60);
      ctx.closePath();
      ctx.fill();

      // Luz de borde: las laderas que miran al sol brillan
      if (night < 0.9) {
        ctx.strokeStyle = rgba(sky.sun, (0.45 - li * 0.1) * (1 - night));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          const facing = (x1 < sunX) ? (y1 < y0) : (y1 > y0);
          if (facing) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
        }
        ctx.stroke();
      }
      // Contorno de tinta (más visible en capas cercanas)
      ctx.strokeStyle = rgba(hexToRgb(INK_DEFAULT), 0.18 + li * 0.18);
      ctx.lineWidth = 1 + li * 0.5;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();

      // Nieve en las cumbres altas
      if ((snowy || li === 0) && L.peak > 140) {
        ctx.fillStyle = rgba(mixRgb([245, 236, 225], sky.hor, 0.35 + night * 0.4), snowy ? 0.9 : 0.55);
        for (let i = 1; i < pts.length - 1; i++) {
          const [px, py] = pts[i];
          if (py < HOR - L.peak * 0.62 && py <= pts[i - 1][1] && py <= pts[i + 1][1]) {
            ctx.beginPath();
            ctx.moveTo(px, py); ctx.lineTo(px - 14, py + 16); ctx.lineTo(px - 5, py + 12);
            ctx.lineTo(px, py + 18); ctx.lineTo(px + 6, py + 11); ctx.lineTo(px + 14, py + 16);
            ctx.closePath(); ctx.fill();
          }
        }
      }
      // Castillo lejano sobre la cordillera media
      if (biomeKey === 'castillo' && li === 1) {
        const kx = vx + 230, ky = ridgeY(kx + shift, L, vx + shift);
        ctx.fillStyle = rgba(mixRgb(col, NIGHT_INK, 0.25));
        ctx.fillRect(kx - 30, ky - 40, 60, 42);
        ctx.fillRect(kx - 38, ky - 62, 14, 64); ctx.fillRect(kx + 24, ky - 70, 14, 72);
        ctx.beginPath(); ctx.moveTo(kx - 40, ky - 62); ctx.lineTo(kx - 31, ky - 80); ctx.lineTo(kx - 22, ky - 62); ctx.fill();
        ctx.beginPath(); ctx.moveTo(kx + 22, ky - 70); ctx.lineTo(kx + 31, ky - 90); ctx.lineTo(kx + 40, ky - 70); ctx.fill();
        if (night > 0.3) {
          ctx.fillStyle = `rgba(255, 200, 110, ${night * 0.9})`;
          ctx.fillRect(kx - 5, ky - 28, 4, 6); ctx.fillRect(kx + 29, ky - 54, 3, 5);
        }
      }
      ctx.restore();

      // Bruma entre capas
      const mist = ctx.createLinearGradient(0, HOR - 40, 0, HOR + 30);
      mist.addColorStop(0, rgba(sky.hor, 0));
      mist.addColorStop(1, rgba(sky.hor, 0.22 * (1 - night * 0.6)));
      ctx.fillStyle = mist;
      ctx.fillRect(0, HOR - 40, width, 70);
    }

    // ---- 6. Llanura del valle
    const groundTop = HOR + 18;
    const gg = ctx.createLinearGradient(0, groundTop, 0, height);
    const nearLand = mixRgb(sky.land, NIGHT_INK, night * 0.45);
    gg.addColorStop(0, rgba(mixRgb(nearLand, sky.hor, 0.35 * (1 - night * 0.5))));
    gg.addColorStop(1, rgba(mixRgb(nearLand, [20, 30, 18], 0.35)));
    ctx.fillStyle = gg;
    ctx.fillRect(0, groundTop, width, height - groundTop);

    // ---- 7. Río que fluye hacia el atardecer
    const riverAt = (y) => {
      // La perspectiva termina donde empieza el suelo del juego (~470), así el río se ve ancho
      const f = clamp01((y - groundTop) / (470 - groundTop));
      const par = 0.04 + f * 0.3;
      const meander = Math.sin(f * 4.2 + 0.9) * 45 * f;
      const cx = valleyBase - camX * par + meander;
      const w = 5 + Math.pow(f, 1.35) * 380;
      return { cx, w, f };
    };
    const left = [], right = [];
    for (let y = groundTop; y <= height + 4; y += 4) {
      const r = riverAt(y);
      left.push([r.cx - r.w * 0.5, y]);
      right.push([r.cx + r.w * 0.5, y]);
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    // Agua: refleja el cielo (horizonte brillante a lo lejos, cielo alto cerca)
    const wg = ctx.createLinearGradient(0, groundTop, 0, height);
    wg.addColorStop(0, rgba(mixRgb(sky.hor, [255, 255, 240], 0.25 * (1 - night))));
    wg.addColorStop(0.45, rgba(sky.mid));
    wg.addColorStop(1, rgba(mixRgb(sky.top, NIGHT_INK, 0.3)));
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.clip();

    // Columna de reflejo del sol (o de la luna) titilando sobre el agua
    const refl = night < 0.75 ? { x: sunX, c: sky.sun, a: (1 - smoothstep(0.45, 0.75, t)) } : { x: moonX, c: [235, 235, 255], a: moonA * 0.8 };
    for (let y = groundTop + 2; y < height; y += 3) {
      const r = riverAt(y);
      const spread = 6 + r.f * 70;
      const rx = refl.x + (r.cx - valleyFar) * 0.6;
      const shimmer = 0.5 + 0.5 * Math.sin(time * 0.006 + y * 0.9);
      const len = spread * (0.4 + shimmer * 0.9);
      const off = Math.sin(time * 0.002 + y * 0.31) * spread * 0.4;
      ctx.fillStyle = rgba(refl.c, refl.a * (0.25 + shimmer * 0.55) * (1 - r.f * 0.5));
      ctx.fillRect(rx + off - len * 0.5, y, len, 1 + r.f * 1.5);
    }

    // Estrellas reflejadas de noche
    if (night > 0.3) {
      for (let i = 0; i < 40; i++) {
        const s = STARS[i * 5];
        const y = groundTop + 6 + (s.y / 330) * (height - groundTop - 10);
        const r = riverAt(y);
        const sx = r.cx + ((s.x % 200) / 200 - 0.5) * r.w * 0.9;
        const tw = 0.5 + 0.5 * Math.sin(time * 0.003 + s.tw);
        ctx.fillStyle = `rgba(255, 248, 230, ${night * 0.5 * tw})`;
        ctx.fillRect(sx, y, 1.5, 1);
      }
    }

    // Ondas que avanzan hacia el horizonte (el río corre hacia el sol)
    const rippleCol = mixRgb(sky.hor, [255, 255, 255], 0.35);
    const N = 34;
    for (let i = 0; i < N; i++) {
      const s = ((i / N) + time * 0.00005) % 1;     // 0 = cerca → 1 = horizonte
      const f = Math.pow(1 - s, 1.4);
      const y = groundTop + f * (height - groundTop);
      const r = riverAt(y);
      const lat = Math.sin(i * 12.9898) * 0.38;
      const x = r.cx + lat * r.w;
      const len = 6 + r.w * 0.12;
      ctx.strokeStyle = rgba(rippleCol, (0.15 + f * 0.35) * (1 - night * 0.5) * smoothstep(0, 0.15, s) * (1 - smoothstep(0.85, 1, s)));
      ctx.lineWidth = 0.8 + f * 1.4;
      ctx.beginPath();
      ctx.moveTo(x - len * 0.5, y);
      ctx.quadraticCurveTo(x, y - 1.5 - f * 2, x + len * 0.5, y);
      ctx.stroke();
    }
    ctx.restore();

    // Orillas con tinta y franja de arena/barro iluminada
    ctx.save();
    ctx.lineJoin = 'round';
    for (const side of [left, right]) {
      ctx.strokeStyle = rgba(mixRgb(sky.sun, sky.hor, 0.4), 0.35 * (1 - night * 0.7));
      ctx.lineWidth = 2;
      ctx.beginPath();
      side.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - 1) : ctx.moveTo(p[0], p[1] - 1)));
      ctx.stroke();
      ctx.strokeStyle = rgba(hexToRgb(INK_DEFAULT), 0.55);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      side.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }
    ctx.restore();

    // ---- 8. Colinas cercanas con arboledas a los lados del río
    const hillPar = 0.22;
    const hillVX = valleyBase - camX * hillPar;
    const hillC = mixRgb(mixRgb(sky.land, [28, 34, 22], 0.45), NIGHT_INK, night * 0.55);
    const hillLayer = { base: HOR + 128, peak: 80, freq: 0.0045, seed: 59, offset: 3300, valleyW: 300, valleyMin: 0 };
    const hillShift = camX * hillPar;
    ctx.save();
    ctx.fillStyle = rgba(hillC);
    ctx.strokeStyle = rgba(hexToRgb(INK_DEFAULT), 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, height + 10);
    const hillPts = [];
    for (let x = -10; x <= width + 10; x += 10) {
      const y = ridgeY(x + hillShift, hillLayer, hillVX + hillShift);
      hillPts.push([x, y]);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width + 10, height + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Árboles en silueta sobre las colinas (pinos o copas redondas según la zona)
    const treeC = mixRgb(hillC, NIGHT_INK, 0.35);
    ctx.fillStyle = rgba(treeC);
    const dense = biomeKey === 'bosque';
    const spacing = dense ? 22 : 38;
    const startI = Math.floor(hillShift / spacing) - 1;
    for (let i = startI; i < startI + width / spacing + 3; i++) {
      const wx = i * spacing;
      const sx = wx - hillShift;
      const hash = Math.abs(Math.sin(i * 91.7) * 1000) % 1;
      if (hash < (dense ? 0.15 : 0.45)) continue;
      const gy = ridgeY(sx + hillShift, hillLayer, hillVX + hillShift);
      if (gy > hillLayer.base - 10) continue;                 // no plantar en el valle del río
      const th = (dense ? 40 : 26) + hash * 26;
      if (dense || hash > 0.7) {
        ctx.beginPath();
        ctx.moveTo(sx, gy - th); ctx.lineTo(sx - th * 0.28, gy + 2); ctx.lineTo(sx + th * 0.28, gy + 2);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillRect(sx - 1.5, gy - th * 0.5, 3, th * 0.5 + 2);
        ctx.beginPath(); ctx.arc(sx, gy - th * 0.62, th * 0.32, 0, 6.283); ctx.fill();
      }
    }
    // Luz de borde del atardecer en las colinas
    if (night < 0.9) {
      ctx.strokeStyle = rgba(sky.sun, 0.35 * (1 - night));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      hillPts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - 1.5) : ctx.moveTo(p[0], p[1] - 1.5)));
      ctx.stroke();
    }
    ctx.restore();

    // ---- 9. Velo nocturno azulado sobre todo el paisaje
    if (night > 0) {
      ctx.fillStyle = `rgba(14, 20, 52, ${night * 0.18})`;
      ctx.fillRect(0, 0, width, height);
    }

    journey.last = { t, night };
    return journey.last;
  }

  /**
   * Tiñe el primer plano (plataformas, enemigos, Ruben) con la luz del momento:
   * cálido al atardecer y azul de noche, para que el mundo combine con el cielo.
   */
  function renderTimeOfDayTint(ctx, width = 960, height = 540) {
    const L = journey.last;
    if (!L) return;
    const warm = smoothstep(0.1, 0.45, L.t) * (1 - L.night);
    let c = mixRgb([255, 255, 255], [255, 214, 190], warm * 0.6);
    c = mixRgb(c, [118, 132, 196], L.night * 0.75);
    if (c[0] > 254 && c[2] > 254) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = rgba(c);
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  /**
   * Renderizado completo de fondo para cualquier bioma
   */
  function renderBiomeBackground(ctx, biomeKey, camera, width = 960, height = 540, time = 0, options = {}) {
    const preset = PRESETS[biomeKey] || PRESETS.pradera;

    if (options.classic !== true) {
      renderSunsetJourney(ctx, biomeKey, camera, width, height, time, options);
      if (options.hasWindmill) {
        drawWindmill(ctx, 930 - camera.x, 160 - (camera.y || 0), time * 0.0007);
      }
      if (options.hasTower) {
        drawRuinedTower(ctx, 760 - camera.x * 0.3, 470 - (camera.y || 0) * 0.3, { vines: true, broken: true, stoneColor: '#4e3f3a', stoneShadow: '#2a2026' });
      }
      drawVignette(ctx, width, height);
      drawParchmentTexture(ctx, width, height, 0.035);
      return;
    }

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
    renderSunsetJourney,
    renderTimeOfDayTint,
    getJourneyProgress,
    renderBiomeBackground
  };
});
