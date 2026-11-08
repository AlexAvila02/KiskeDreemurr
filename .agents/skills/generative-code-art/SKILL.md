---
name: generative-code-art
description: >-
  Guía y recetas maestras para generar fondos, paisajes, escenarios y arte visual procedural mediante código
  (HTML5 Canvas, SVG, WebGL/CSS). Enseña técnicas de capas de profundidad (paralaje), ruido procedural
  (Perlin/Simplex), teoría del color atmosférico, vegetación fractal, siluetas orgánicas, arquitectura clásica y texturas pictóricas.
---

# Generación de Fondos y Arte Visual Mediante Código (Guía para Agentes)

Esta habilidad dota a los agentes de IA con el conocimiento algorítmico, matemático y estético necesario para generar paisajes, escenarios, fondos atmosféricos y elementos visuales de alta calidad utilizando código nativo (HTML5 Canvas 2D, SVG o Shaders), sin depender de imágenes externas pesadas.

---

## 🎨 1. El Modelo Mental: Arquitectura de 7 Capas de Profundidad

Un error común al generar arte por código es pintar figuras geométricas planas sobre un fondo uniforme. El arte ambiental convincente se construye mediante **planos de profundidad y perspectiva aérea**:

```text
[Cámara / Pantalla]
  ▲
  │ Capa 6: Post-procesado atmosférico (Rayos de sol, motas de polvo, viñeta, textura papel)
  │ Capa 5: Primer plano (Paralaje 1.25x - Siluetas oscuras, ramas desenfocadas, hierba cercana)
  │ Capa 4: Plano de acción / Jugable (Paralaje 1.0x - Plataformas, entidades, detalles interactivos)
  │ Capa 3: Plano medio arquitectónico (Paralaje 0.4x - Ruinas, molinos, murallas, árboles medianos)
  │ Capa 2: Plano medio-lejano (Paralaje 0.2x - Colinas onduladas con curvas Bézier armónicas)
  │ Capa 1: Silueta lejana extrema (Paralaje 0.06x - Cordilleras montañosas, copas de bosque distante)
  │ Capa 0: Bóveda celeste y dispersión de luz (Cielo en gradiente multi-stop, sol/luna, nubes)
```

### Reglas de Perspectiva Aérea:
1. **Desaturación y Aclarado con la Distancia**: Cuanto más lejos esté un plano, más se mezcla con el color del cielo (menor contraste, menor saturación).
2. **Escala de Detalle**: Los planos lejanos solo muestran siluetas y masas; los detalles de textura solo existen en los planos 3, 4 y 5.
3. **Velocidad de Paralaje**: `posRelativa = elementoX - (cameraX * factorParalaje)`. Cuanto más distante, menor el factor (`0.05` a `0.3`).

---

## 📐 2. Matemáticas y Algoritmos Procedurales Esenciales

### A. Ruido Determinista Ligero (Pseudo-Random & Value Noise)
Evita la aleatoriedad sin semilla (`Math.random()`) para dibujar paisajes en tiempo real, ya que vibrarían en cada frame. Usa un generador determinista con semilla:

```javascript
// Generador Pseudo-Aleatorio con Semilla (Mulberry32)
function createSeededRandom(seed = 12345) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruido 1D suave con interpolación cosenoidal (para relieves y colinas)
function smoothNoise1D(x, seed = 42) {
  const i = Math.floor(x);
  const f = x - i;
  const ft = f * Math.PI;
  const fCosine = (1 - Math.cos(ft)) * 0.5;

  const rand = (n) => {
    const s = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };

  const a = rand(i);
  const b = rand(i + 1);
  return a * (1 - fCosine) + b * fCosine;
}

// Movimiento Browniano Fraccionario (FBM) para montañas realistas
function fbm1D(x, octaves = 4, persistence = 0.5, seed = 42) {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;
  for (let o = 0; o < octaves; o++) {
    total += smoothNoise1D(x * frequency, seed + o * 100) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return total / maxValue;
}
```

---

## 🌲 3. Recetas de Generación por Elemento

### A. Cielo Atmosférico y Rayos Crepusculares (God Rays)
```javascript
function drawAtmosphericSky(ctx, width, height, stops, sunPos = { x: 700, y: 200 }) {
  // Gradiente vertical del cielo
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  stops.forEach(([stop, color]) => grad.addColorStop(stop, color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Halo solar disperso
  const halo = ctx.createRadialGradient(sunPos.x, sunPos.y, 5, sunPos.x, sunPos.y, 140);
  halo.addColorStop(0, 'rgba(255, 245, 210, 0.9)');
  halo.addColorStop(0.3, 'rgba(250, 195, 110, 0.4)');
  halo.addColorStop(1, 'rgba(250, 195, 110, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(sunPos.x, sunPos.y, 140, 0, Math.PI * 2);
  ctx.fill();
}

function drawGodRays(ctx, sunX, sunY, numRays = 8, maxLength = 600) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < numRays; i++) {
    const angle = 0.4 + (i / numRays) * 0.9;
    const spread = 0.05 + Math.sin(i * 1.5) * 0.02;
    const grad = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, maxLength);
    grad.addColorStop(0, 'rgba(255, 235, 180, 0.25)');
    grad.addColorStop(0.6, 'rgba(255, 210, 140, 0.08)');
    grad.addColorStop(1, 'rgba(255, 200, 120, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(sunX + Math.cos(angle - spread) * maxLength, sunY + Math.sin(angle - spread) * maxLength);
    ctx.lineTo(sunX + Math.cos(angle + spread) * maxLength, sunY + Math.sin(angle + spread) * maxLength);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
```

### B. Cordilleras de Montaña con Relieve y Tinta (Estilo Ilustración)
```javascript
function drawMountainRidge(ctx, yBase, peakHeight, width, cameraX, parallax, color, inkColor, seed) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = inkColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, yBase);

  const step = 20;
  for (let x = 0; x <= width + step; x += step) {
    const worldX = (x + cameraX * parallax);
    const noiseVal = fbm1D(worldX * 0.003, 4, 0.5, seed);
    const y = yBase - noiseVal * peakHeight;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(width, yBase + 100);
  ctx.lineTo(0, yBase + 100);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
```

### C. Colinas Orgánicas y Curvas Bézier Suaves (Años 50 / Cuento)
```javascript
function drawRollingHills(ctx, yBase, amplitude, width, cameraX, parallax, fillColor, strokeColor) {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, yBase + 150);

  const segmentWidth = 160;
  const offsetX = -(cameraX * parallax) % segmentWidth;

  for (let x = offsetX - segmentWidth; x < width + segmentWidth * 2; x += segmentWidth) {
    const cpX = x + segmentWidth / 2;
    const cpY = yBase - amplitude;
    const endX = x + segmentWidth;
    const endY = yBase;
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
  }

  ctx.lineTo(width + 200, yBase + 200);
  ctx.lineTo(-200, yBase + 200);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
```

### D. Árboles y Follaje Estilizado (Racimos de Tinta y Sombras)
Evita dibujar árboles como triángulos o paletas verdes sólidas. Construye racimos con 3 valores de tono (sombra, medio, luz):
```javascript
function drawStylizedTree(ctx, x, y, trunkHeight = 90, canopyRadius = 45, palette) {
  ctx.save();
  const OUT = palette.ink || '#3a2416';

  // 1. Tronco orgánico con conicidad y raíces
  ctx.fillStyle = palette.trunk || '#5a402d';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.quadraticCurveTo(x - 6, y - trunkHeight * 0.5, x - 5, y - trunkHeight);
  ctx.lineTo(x + 5, y - trunkHeight);
  ctx.quadraticCurveTo(x + 6, y - trunkHeight * 0.5, x + 10, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Racimos de follaje superpuestos (Volumen)
  const cy = y - trunkHeight;
  const clusters = [
    { dx: 0, dy: -canopyRadius * 0.4, r: canopyRadius * 0.8 },
    { dx: -canopyRadius * 0.5, dy: 0, r: canopyRadius * 0.65 },
    { dx: canopyRadius * 0.5, dy: 0, r: canopyRadius * 0.65 },
    { dx: -canopyRadius * 0.25, dy: canopyRadius * 0.2, r: canopyRadius * 0.55 },
    { dx: canopyRadius * 0.25, dy: canopyRadius * 0.2, r: canopyRadius * 0.55 },
  ];

  // Sombra base
  ctx.fillStyle = palette.leafShadow || '#2c4b31';
  for (const c of clusters) {
    ctx.beginPath();
    ctx.arc(x + c.dx, cy + c.dy + 4, c.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tono medio + contorno
  ctx.fillStyle = palette.leafMid || '#46754a';
  for (const c of clusters) {
    ctx.beginPath();
    ctx.arc(x + c.dx, cy + c.dy, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Reflejo de luz superior (cálido)
  ctx.fillStyle = palette.leafHighlight || '#72aa5c';
  for (const c of clusters) {
    ctx.beginPath();
    ctx.arc(x + c.dx - c.r * 0.2, cy + c.dy - c.r * 0.25, c.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
```

### E. Textura Pictórica de Papel / Grano (Acabado Acuarela o Animación Clásica)
Elimina la esterilidad digital aplicando un patrón estático o micro-grano:
```javascript
function drawPaperGrain(ctx, width, height, intensity = 0.04) {
  // Se puede generar una sola vez en un canvas offscreen y reutilizar
  if (!window._paperCanvas) {
    const pc = document.createElement('canvas');
    pc.width = 256;
    pc.height = 256;
    const pctx = pc.getContext('2d');
    const imgData = pctx.createImageData(256, 256);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = 128 + (Math.random() * 80 - 40);
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
    pctx.putImageData(imgData, 0, 0);
    window._paperCanvas = pc;
  }

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = intensity;
  const pattern = ctx.createPattern(window._paperCanvas, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
```

---

## 🎨 4. Paletas Cromáticas Armónicas por Bioma

| Bioma | Cielo (Stops) | Niebla / Silueta Distante | Relieve Medio | Piedra / Plataforma | Vegetación / Detalles |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pradera del Ocaso** | `#2c1d33` ➔ `#6e3746` ➔ `#c86d49` ➔ `#e8b96a` | `rgba(62, 34, 42, 0.5)` | `#4b382a` / `#3a2416` | `#7a654b` ➔ `#4a3a28` | `#788c38` / `#a5b84d` |
| **Bosque Profundo** | `#132421` ➔ `#213d34` ➔ `#385e4b` ➔ `#688c68` | `rgba(18, 36, 28, 0.65)` | `#243b2c` / `#17261c` | `#485948` ➔ `#293629` | `#386b44` / `#5c9963` |
| **Cumbres Nevadas** | `#1c2838` ➔ `#3b526b` ➔ `#6e8ba6` ➔ `#b8cde0` | `rgba(42, 58, 78, 0.55)` | `#465669` / `#253140` | `#6c7a89` ➔ `#414b57` | `#dce8f2` / `#ffffff` |
| **Castillo en Ruinas** | `#1b1226` ➔ `#392243` ➔ `#613958` ➔ `#965b6f` | `rgba(45, 25, 48, 0.6)` | `#3e3044` / `#281d2c` | `#584a5e` ➔ `#362a3c` | `#b86862` / `#e29b82` |

---

## ⚡ 5. Optimización de Rendimiento para Agentes

1. **Offscreen Pre-rendering**: Si un fondo procedural es complejo (cientos de cálculos de ruido), renderízalo **una sola vez** en un `<canvas>` fuera de pantalla (`document.createElement('canvas')`) de ancho extendido (ej. 1920x540) y en el bucle principal dibújalo con `ctx.drawImage()`.
2. **Batching de Trazados**: Agrupa llamadas `moveTo`/`lineTo` dentro de un único `beginPath()` y `fill()`/`stroke()` en lugar de abrir trazados individuales en bucles.
3. **Culling Horizontal**: Comprueba siempre si `x + ancho < 0 || x > canvasWidth` antes de pintar árboles, rocas o edificios para evitar sobrecarga innecesaria en la GPU.
