/**
 * Arte del Terreno - Ruben: En Busca de Angelo (Claude)
 *
 * Suelo, plataformas, techos, paredes y muros quebradizos dibujados a mano en el
 * mismo estilo que los fondos pintados (tinta marrón #3a2416, formas redondeadas,
 * paleta de cada zona):
 *   pradera  → tierra con piedritas y raíces, pasto con matas y florcitas, piedra de ruina
 *   bosque   → tierra oscura, musgo, helechos, hongos, musgo colgando de las ramas
 *   montana  → roca gris azulada, capa de nieve redondeada, carámbanos, escarcha
 *   castillo → sillares y adoquines, alfombra roja con borde dorado, bóvedas y hiedra
 *
 * Rendimiento: el detalle fijo de cada plataforma se pinta UNA vez en un lienzo
 * aparte (caché por plataforma) y en cada cuadro solo se copia con drawImage; lo
 * único que se dibuja en vivo es el pasto que se mece con el viento y el brillo de
 * la nieve. Sin basura por cuadro.
 *
 * API: TerrainArt.drawPlatform(ctx, plat, sx, sy, biomeKey, biome)
 *      TerrainArt.drawBreakable(ctx, b, sx, sy, biomeKey, biome)
 *      TerrainArt.clearCache()
 * world.js la usa si existe (con respaldo al dibujo simple anterior).
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const PAD = 30;               // margen del lienzo en caché para lo que sobresale (pasto, carámbanos)
  const cache = new WeakMap();  // plataforma -> { key, canvas }

  // ---------- utilidades ----------
  function rng(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedOf(p) {
    return (Math.imul(p.x | 0, 73856093) ^ Math.imul(p.y | 0, 19349663) ^ Math.imul(p.w | 0, 83492791) ^ Math.imul(p.h | 0, 2654435761)) | 0;
  }
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // amt > 0 aclara, amt < 0 oscurece
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const f = (v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
    return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Colores extra por zona (los base salen de World.BIOMES para seguir la paleta del juego)
  const EXTRA = {
    pradera: { soil: '#5e4530', root: '#6b4a2b', flowers: ['#f3d36b', '#fff1d6', '#e98b7a', '#c9a0dc'], moss: '#7d9440' },
    bosque: { soil: '#2f2a1d', root: '#4a3523', mush: ['#c8473d', '#b5763a', '#e0a84a'], moss: '#4f8a52', fern: '#5c9963' },
    montana: { soil: '#4f5a66', ice: '#cfe6f5', iceDeep: '#8fb4cf', frost: '#eef6fc' },
    castillo: { soil: '#4a3a34', carpet: '#8c2732', carpetDark: '#5e1a22', gold: '#c99b42', ivy: '#46703f', mortar: '#2c211d' }
  };

  // ---------- piezas de dibujo ----------
  function body(c, x, y, w, h, r, top, bottom) {
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fill();
  }
  function outline(c, x, y, w, h, r, lw = 2) {
    c.strokeStyle = OUT;
    c.lineWidth = lw;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.stroke();
  }
  function pebble(c, x, y, rx, ry, fill, rot = 0) {
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 1.2;
    c.strokeStyle = OUT;
    c.stroke();
    c.fillStyle = 'rgba(255, 245, 220, 0.28)';
    c.beginPath();
    c.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.45, ry * 0.3, rot, 0, Math.PI * 2);
    c.fill();
  }
  function bigRock(c, x, y, s, fill, R) {
    const n = 7;
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = s * (0.75 + R() * 0.35);
      const px = x + Math.cos(a) * rr * 1.25, py = y + Math.sin(a) * rr * 0.8;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = 1.4;
    c.strokeStyle = OUT;
    c.stroke();
    c.strokeStyle = 'rgba(255, 245, 220, 0.3)';
    c.beginPath();
    c.moveTo(x - s * 0.7, y - s * 0.25);
    c.quadraticCurveTo(x - s * 0.2, y - s * 0.65, x + s * 0.4, y - s * 0.45);
    c.stroke();
  }
  function wavyLine(c, x0, x1, y, amp, R, color, lw) {
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(x0, y);
    for (let x = x0; x < x1; x += 24) {
      c.quadraticCurveTo(x + 12, y + (R() - 0.5) * amp * 2, Math.min(x1, x + 24), y + (R() - 0.5) * amp);
    }
    c.stroke();
  }
  function root(c, x, y, len, color, R, dir = 1) {
    c.strokeStyle = color;
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, y);
    let cx = x, cy = y;
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const nx = cx + (R() - 0.5) * 10, ny = cy + dir * len / steps;
      c.quadraticCurveTo(cx + (R() - 0.5) * 12, (cy + ny) / 2, nx, ny);
      cx = nx; cy = ny;
    }
    c.stroke();
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x + (R() - 0.5) * 4, y + dir * len * 0.4);
    c.quadraticCurveTo(x + 8, y + dir * len * 0.55, x + 10 + R() * 4, y + dir * len * 0.7);
    c.stroke();
  }
  // Mata de pasto fija (3-5 hojas redondeadas)
  function tuft(c, x, y, h, fill, R) {
    const n = 3 + Math.floor(R() * 3);
    c.fillStyle = fill;
    c.strokeStyle = OUT;
    c.lineWidth = 1.1;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 2.6;
      const lean = (i - (n - 1) / 2) * 1.6 + (R() - 0.5) * 2;
      const hh = h * (0.65 + R() * 0.45);
      c.beginPath();
      c.moveTo(x + off - 1.6, y);
      c.quadraticCurveTo(x + off + lean * 0.4, y - hh * 0.6, x + off + lean, y - hh);
      c.quadraticCurveTo(x + off + lean * 0.4 + 1.5, y - hh * 0.5, x + off + 1.6, y);
      c.closePath();
      c.fill();
      c.stroke();
    }
  }
  function flower(c, x, y, color, R) {
    const h = 6 + R() * 5;
    c.strokeStyle = '#4f6b2a';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + (R() - 0.5) * 4, y - h * 0.6, x, y - h);
    c.stroke();
    c.fillStyle = color;
    c.strokeStyle = OUT;
    c.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + R();
      c.beginPath();
      c.arc(x + Math.cos(a) * 1.9, y - h + Math.sin(a) * 1.9, 1.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.fillStyle = '#e0a03a';
    c.beginPath();
    c.arc(x, y - h, 1.1, 0, Math.PI * 2);
    c.fill();
  }
  function mushroom(c, x, y, s, cap, R) {
    c.fillStyle = '#f2e3c4';
    c.strokeStyle = OUT;
    c.lineWidth = 1.2;
    c.beginPath();
    c.roundRect(x - s * 0.28, y - s * 0.9, s * 0.56, s * 0.9, s * 0.2);
    c.fill();
    c.stroke();
    c.fillStyle = cap;
    c.beginPath();
    c.moveTo(x - s * 0.8, y - s * 0.8);
    c.quadraticCurveTo(x - s * 0.75, y - s * 1.6, x, y - s * 1.62);
    c.quadraticCurveTo(x + s * 0.75, y - s * 1.6, x + s * 0.8, y - s * 0.8);
    c.quadraticCurveTo(x, y - s * 0.62, x - s * 0.8, y - s * 0.8);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255, 246, 225, 0.92)';
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(x + (i - 1) * s * 0.38 + (R() - 0.5) * 2, y - s * (1.15 + R() * 0.25), s * 0.11, 0, Math.PI * 2);
      c.fill();
    }
  }
  function fern(c, x, y, h, color, R, dir) {
    c.strokeStyle = OUT;
    c.lineWidth = 1;
    c.fillStyle = color;
    const tipX = x + dir * h * 0.55, tipY = y - h;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + dir * h * 0.05, y - h * 0.7, tipX, tipY);
    c.stroke();
    for (let i = 1; i <= 5; i++) {
      const t = i / 6;
      const px = x + (tipX - x) * t * t + dir * h * 0.05 * (1 - t);
      const py = y + (tipY - y) * t;
      const L = (1 - t) * h * 0.32 + 2;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.ellipse(px + side * L * 0.45, py - L * 0.15, L * 0.55, L * 0.22, side * 0.5 - dir * 0.3, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    }
  }
  function icicle(c, x, y, len, w) {
    const g = c.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, '#f2f9ff');
    g.addColorStop(1, '#9cc3dd');
    c.fillStyle = g;
    c.strokeStyle = OUT;
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(x - w, y);
    c.quadraticCurveTo(x - w * 0.4, y + len * 0.6, x, y + len);
    c.quadraticCurveTo(x + w * 0.4, y + len * 0.6, x + w, y);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.moveTo(x - w * 0.35, y + 2);
    c.lineTo(x - w * 0.1, y + len * 0.55);
    c.stroke();
  }
  function mossDrip(c, x, y, len, color, R) {
    c.fillStyle = color;
    c.strokeStyle = OUT;
    c.lineWidth = 1.1;
    const w = 4 + R() * 5;
    c.beginPath();
    c.moveTo(x - w, y - 1);
    c.quadraticCurveTo(x - w * 0.8, y + len * 0.7, x - 1, y + len);
    c.quadraticCurveTo(x + 1.5, y + len * 1.05, x + 2, y + len * 0.8);
    c.quadraticCurveTo(x + w * 0.7, y + len * 0.4, x + w, y - 1);
    c.closePath();
    c.fill();
    c.stroke();
  }
  function vine(c, x, y, len, color, R) {
    c.strokeStyle = '#3d5a2a';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x + 6, y + len * 0.3, x - 6, y + len * 0.65, x + (R() - 0.5) * 4, y + len);
    c.stroke();
    c.fillStyle = color;
    c.strokeStyle = OUT;
    c.lineWidth = 0.9;
    for (let i = 1; i <= 3; i++) {
      const ly = y + len * (i / 3.4);
      const side = i % 2 ? 1 : -1;
      c.beginPath();
      c.ellipse(x + side * 3.5, ly, 3.4, 1.8, side * 0.6, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  }
  function sparklePath(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
  }

  // ---------- superficie superior por zona ----------
  // Borde de pasto/musgo con jorobas suaves que cae un poco por los costados
  function grassLip(c, x, y, w, color, dark, R, thick = 7) {
    c.fillStyle = color;
    c.strokeStyle = OUT;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x - 2, y + thick + 4);
    c.quadraticCurveTo(x - 3, y - 1, x + 4, y - 2);
    for (let px = x + 4; px < x + w - 4; px += 16) {
      const nx = Math.min(x + w - 4, px + 16);
      c.quadraticCurveTo((px + nx) / 2, y - 3 - R() * 3, nx, y - 1.5);
    }
    c.quadraticCurveTo(x + w + 3, y - 1, x + w + 2, y + thick + 4);
    // borde inferior ondulado con "gotitas" de pasto
    for (let px = x + w + 2; px > x - 2; px -= 13) {
      const nx = Math.max(x - 2, px - 13);
      const drip = R() < 0.3 ? 5 + R() * 4 : 0;
      c.quadraticCurveTo((px + nx) / 2, y + thick + 2 + drip, nx, y + thick - 1 + R() * 2);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = rgba('#fff6d8', 0.35);
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(x + 5, y + 1.2);
    c.lineTo(x + w - 5, y + 1.2);
    c.stroke();
    c.strokeStyle = rgba('#1c1208', 0.25);
    c.beginPath();
    c.moveTo(x + 2, y + thick);
    c.lineTo(x + w - 2, y + thick);
    c.stroke();
  }
  function snowCap(c, x, y, w, R, thick = 8) {
    c.fillStyle = '#f4f9fd';
    c.strokeStyle = OUT;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x - 3, y + thick + 2);
    c.quadraticCurveTo(x - 5, y - 2, x + 6, y - 3);
    for (let px = x + 6; px < x + w - 6; px += 22) {
      const nx = Math.min(x + w - 6, px + 22);
      c.quadraticCurveTo((px + nx) / 2, y - 6 - R() * 4, nx, y - 3);
    }
    c.quadraticCurveTo(x + w + 5, y - 2, x + w + 3, y + thick + 2);
    for (let px = x + w + 3; px > x - 3; px -= 18) {
      const nx = Math.max(x - 3, px - 18);
      const sag = R() < 0.35 ? 4 + R() * 4 : 1;
      c.quadraticCurveTo((px + nx) / 2, y + thick + sag, nx, y + thick - 1);
    }
    c.closePath();
    c.fill();
    c.stroke();
    // sombra azulada bajo la nieve
    c.strokeStyle = 'rgba(120, 160, 200, 0.55)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x + 4, y + thick - 2);
    c.lineTo(x + w - 4, y + thick - 2);
    c.stroke();
  }
  function carpet(c, x, y, w, h, R) {
    const E = EXTRA.castillo;
    const inset = Math.min(10, w * 0.08);
    // alfombra
    c.fillStyle = E.carpet;
    c.strokeStyle = OUT;
    c.lineWidth = 1.4;
    c.beginPath();
    c.rect(x + inset, y - 2, w - inset * 2, 6);
    c.fill();
    c.stroke();
    c.strokeStyle = E.gold;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x + inset + 2, y + 2.4);
    c.lineTo(x + w - inset - 2, y + 2.4);
    c.stroke();
    // caídas laterales con borla
    for (const side of [0, 1]) {
      const ex = side ? x + w - inset : x + inset;
      const dir = side ? -1 : 1;
      c.fillStyle = E.carpetDark;
      c.strokeStyle = OUT;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(ex, y - 2);
      c.lineTo(ex + dir * 9, y - 2);
      c.lineTo(ex + dir * 7, y + h * 0.75);
      c.lineTo(ex + dir * 1, y + h * 0.55);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = E.gold;
      c.beginPath();
      c.arc(ex + dir * 6, y + h * 0.75 + 2, 2, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  }

  // ---------- texturas del cuerpo ----------
  function masonry(c, x, y, w, h, R, opts) {
    const rowH = opts.rowH || h;
    c.strokeStyle = opts.joint || rgba(OUT, 0.55);
    c.lineWidth = 1.3;
    for (let ry = y, row = 0; ry < y + h - 2; ry += rowH, row++) {
      if (row > 0) {
        c.beginPath();
        c.moveTo(x + 2, ry);
        c.lineTo(x + w - 2, ry);
        c.stroke();
      }
      let px = x + (row % 2 ? opts.minW * 0.5 : 0) + opts.minW * (0.6 + R() * 0.6);
      while (px < x + w - 10) {
        c.beginPath();
        c.moveTo(px, ry + 1);
        c.lineTo(px + (R() - 0.5) * 2, Math.min(y + h - 1, ry + rowH - 1));
        c.stroke();
        // brillo en el borde de cada bloque
        c.strokeStyle = 'rgba(255, 240, 210, 0.16)';
        c.beginPath();
        c.moveTo(px + 2, ry + 2.5);
        c.lineTo(px + opts.minW * 0.7, ry + 2.5);
        c.stroke();
        c.strokeStyle = opts.joint || rgba(OUT, 0.55);
        px += opts.minW + R() * (opts.maxW - opts.minW);
      }
    }
  }
  function chips(c, x, y, w, h, R, count) {
    c.fillStyle = 'rgba(30, 18, 10, 0.35)';
    for (let i = 0; i < count; i++) {
      const px = x + 6 + R() * (w - 12), py = y + 4 + R() * (h - 8);
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + 2 + R() * 3, py + 1 + R() * 2);
      c.lineTo(px + R() * 2, py + 3 + R() * 2);
      c.closePath();
      c.fill();
    }
  }
  function cracks(c, x, y, w, h, R, count) {
    c.strokeStyle = rgba(OUT, 0.6);
    c.lineWidth = 1.1;
    for (let i = 0; i < count; i++) {
      let px = x + 8 + R() * (w - 16), py = y + 4 + R() * (h * 0.5);
      c.beginPath();
      c.moveTo(px, py);
      for (let k = 0; k < 3; k++) {
        px += (R() - 0.5) * 10;
        py += 4 + R() * 7;
        c.lineTo(px, Math.min(y + h - 2, py));
      }
      c.stroke();
    }
  }

  // ---------- pintado completo de una plataforma (a la caché) ----------
  function paint(c, p, biomeKey, biome) {
    const R = rng(seedOf(p));
    const x = PAD, y = PAD, w = p.w, h = p.h;
    const top = biome.stoneTop, bot = biome.stoneBottom;
    const E = EXTRA[biomeKey] || EXTRA.pradera;
    const type = p.type || 'ruins';
    const isGround = type === 'ground' || (h >= 50 && type !== 'wall');

    if (type === 'wall') {
      body(c, x, y, w, h, 3, shade(top, 0.05), bot);
      if (biomeKey === 'castillo') {
        masonry(c, x, y, w, h, R, { rowH: 20, minW: 14, maxW: 18, joint: rgba(E.mortar || OUT, 0.8) });
      } else {
        // piedras apiladas
        for (let ry = y + 4; ry < y + h - 8;) {
          const sh = 22 + R() * 18;
          c.fillStyle = shade(top, (R() - 0.5) * 0.18);
          c.strokeStyle = rgba(OUT, 0.8);
          c.lineWidth = 1.3;
          c.beginPath();
          c.roundRect(x + 3, ry, w - 6, Math.min(sh, y + h - 4 - ry), 6);
          c.fill();
          c.stroke();
          c.fillStyle = 'rgba(255,240,210,0.16)';
          c.beginPath();
          c.roundRect(x + 5, ry + 2, w - 12, 3, 2);
          c.fill();
          ry += sh + 2;
        }
      }
      // acentos por zona
      for (let ry = y + 40 + R() * 60; ry < y + h - 30; ry += 90 + R() * 90) {
        if (biomeKey === 'bosque' || biomeKey === 'pradera') mossDrip(c, x + w - 2, ry, 10 + R() * 10, E.moss, R);
        else if (biomeKey === 'castillo') vine(c, x + w * 0.5, ry, 22 + R() * 14, E.ivy, R);
        else if (biomeKey === 'montana') { c.fillStyle = 'rgba(240,248,255,0.75)'; c.beginPath(); c.ellipse(x + w * 0.5, ry, w * 0.4, 3, 0, 0, Math.PI * 2); c.fill(); }
      }
      outline(c, x, y, w, h, 3);
      return;
    }

    if (type === 'ceiling') {
      body(c, x, y, w, h, 3, shade(bot, -0.1), top);
      chips(c, x, y, w, h, R, Math.floor(w / 40));
      outline(c, x, y, w, h, 3);
      const by = y + h;
      if (biomeKey === 'castillo') {
        // bóveda: pequeños arcos de piedra bajo el techo
        for (let px = x + 10; px < x + w - 40; px += 70 + R() * 30) {
          c.fillStyle = shade(top, -0.05);
          c.strokeStyle = OUT;
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(px, by - 1);
          c.lineTo(px + 34, by - 1);
          c.lineTo(px + 34, by + 4);
          c.quadraticCurveTo(px + 17, by + 2, px + 30, by + 4);
          c.lineTo(px + 26, by + 9);
          c.quadraticCurveTo(px + 17, by + 5, px + 8, by + 9);
          c.lineTo(px + 4, by + 4);
          c.quadraticCurveTo(px + 17, by + 2, px, by + 4);
          c.closePath();
          c.fill();
          c.stroke();
          if (R() < 0.35) vine(c, px + 17, by + 5, 16 + R() * 14, E.ivy, R);
        }
      } else {
        for (let px = x + 8 + R() * 20; px < x + w - 8; px += 26 + R() * 46) {
          if (biomeKey === 'montana') icicle(c, px, by - 1, 7 + R() * 14, 2.5 + R() * 2);
          else if (biomeKey === 'bosque') {
            if (R() < 0.55) mossDrip(c, px, by - 1, 6 + R() * 12, E.moss, R);
            else vine(c, px, by - 1, 16 + R() * 22, E.fern, R);
          } else {
            if (R() < 0.6) root(c, px, by - 1, 8 + R() * 14, E.root, R, 1);
            else mossDrip(c, px, by - 1, 4 + R() * 6, E.moss, R);
          }
        }
      }
      return;
    }

    // ---- suelo grueso o ruina flotante ----
    if (isGround) {
      body(c, x, y, w, h, 3, top, shade(E.soil, -0.15));
      // capas de tierra
      for (let i = 1; i <= 2; i++) wavyLine(c, x + 3, x + w - 3, y + 14 + i * 18, 4, R, 'rgba(30, 18, 10, 0.28)', 1.6);
      if (biomeKey === 'castillo') {
        // adoquines en la parte superior del patio
        masonry(c, x, y + 6, w, 30, R, { rowH: 15, minW: 22, maxW: 40, joint: rgba(E.mortar, 0.75) });
      }
      // piedritas
      const nPeb = Math.floor(w / 34);
      for (let i = 0; i < nPeb; i++) {
        const px = x + 8 + R() * (w - 16), py = y + 16 + R() * (h - 26);
        pebble(c, px, py, 2.5 + R() * 4, 2 + R() * 2.6, shade(top, 0.08 + R() * 0.15), (R() - 0.5) * 0.6);
      }
      // rocas grandes enterradas
      for (let px = x + 60 + R() * 80; px < x + w - 40; px += 170 + R() * 160) {
        bigRock(c, px, y + 34 + R() * 22, 9 + R() * 7, shade(top, 0.12), R);
      }
      // raíces / grietas
      for (let px = x + 30 + R() * 60; px < x + w - 20; px += 120 + R() * 140) {
        if (biomeKey === 'pradera' || biomeKey === 'bosque') root(c, px, y + 8, 18 + R() * 16, E.root, R, 1);
        else cracks(c, px - 10, y + 10, 30, 40, R, 1);
      }
      if (biomeKey === 'montana') {
        // escarcha
        c.fillStyle = 'rgba(235, 246, 255, 0.5)';
        for (let i = 0; i < w / 20; i++) {
          c.beginPath();
          c.arc(x + R() * w, y + 12 + R() * (h - 16), 0.8 + R() * 1.2, 0, Math.PI * 2);
          c.fill();
        }
      }
      outline(c, x, y, w, h, 3);
    } else {
      // ruina flotante: sillares con biseles, desgaste y sombra inferior
      body(c, x, y, w, h, 6, shade(top, 0.08), bot);
      masonry(c, x, y, w, h, R, biomeKey === 'castillo'
        ? { rowH: Math.max(8, h / 2), minW: 18, maxW: 30, joint: rgba(E.mortar, 0.8) }
        : { rowH: h, minW: 26, maxW: 46 });
      chips(c, x, y, w, h, R, Math.max(1, Math.floor(w / 45)));
      c.fillStyle = 'rgba(20, 10, 5, 0.25)';
      c.beginPath();
      c.roundRect(x + 3, y + h - 5, w - 6, 3, 2);
      c.fill();
      outline(c, x, y, w, h, 6);
      // cosas que cuelgan por debajo
      const by = y + h;
      for (let px = x + 10 + R() * 18; px < x + w - 8; px += 24 + R() * 40) {
        if (biomeKey === 'montana') icicle(c, px, by - 1, 6 + R() * 12, 2 + R() * 2);
        else if (biomeKey === 'bosque') { if (R() < 0.7) mossDrip(c, px, by - 1, 5 + R() * 9, E.moss, R); }
        else if (biomeKey === 'pradera') { if (R() < 0.45) root(c, px, by - 2, 6 + R() * 8, E.root, R, 1); }
        else if (biomeKey === 'castillo') { if (R() < 0.3) vine(c, px, by - 1, 12 + R() * 12, E.ivy, R); }
      }
    }

    // ---- superficie ----
    if (biomeKey === 'montana') {
      snowCap(c, x, y, w, R, isGround ? 9 : 7);
      for (let px = x + 14 + R() * 30; px < x + w - 14; px += 60 + R() * 90) {
        pebble(c, px, y - 3, 4 + R() * 3, 2.5 + R() * 1.5, shade(top, 0.05)); // piedra asomando de la nieve
      }
    } else if (biomeKey === 'castillo') {
      if (isGround) {
        c.fillStyle = shade(top, 0.18);
        c.strokeStyle = OUT;
        c.lineWidth = 1.5;
        c.beginPath();
        c.roundRect(x - 1, y - 2, w + 2, 7, 3);
        c.fill();
        c.stroke();
        for (let px = x + 20 + R() * 30; px < x + w - 12; px += 70 + R() * 80) tuft(c, px, y - 1, 7 + R() * 4, E.gold, R);
      } else {
        carpet(c, x, y, w, h, R);
      }
    } else {
      const lipColor = biome.turfMain;
      grassLip(c, x, y, w, lipColor, shade(lipColor, -0.3), R, isGround ? 8 : 6);
      // matas
      for (let px = x + 8 + R() * 14; px < x + w - 8; px += 18 + R() * 30) {
        tuft(c, px, y - 1, 7 + R() * 6, shade(lipColor, (R() - 0.4) * 0.25), R);
      }
      if (biomeKey === 'pradera') {
        const cols = E.flowers;
        for (let px = x + 12 + R() * 30; px < x + w - 10; px += 34 + R() * 60) {
          flower(c, px, y - 1, cols[Math.floor(R() * cols.length)], R);
          if (R() < 0.4) flower(c, px + 5, y - 1, cols[Math.floor(R() * cols.length)], R);
        }
      } else {
        for (let px = x + 20 + R() * 40; px < x + w - 16; px += 60 + R() * 110) {
          if (R() < 0.55) mushroom(c, px, y, 5 + R() * 4, E.mush[Math.floor(R() * E.mush.length)], R);
          else fern(c, px, y, 12 + R() * 8, E.fern, R, R() < 0.5 ? -1 : 1);
        }
      }
    }
  }

  function getCanvas(p, biomeKey, biome) {
    const key = biomeKey + '|' + p.w + '|' + p.h + '|' + p.type + '|' + biome.stoneTop + biome.turfMain;
    const hit = cache.get(p);
    if (hit && hit.key === key) return hit.canvas;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(p.w + PAD * 2);
    cv.height = Math.ceil(p.h + PAD * 2);
    const c = cv.getContext('2d');
    c.lineJoin = 'round';
    c.lineCap = 'round';
    paint(c, p, biomeKey, biome);
    cache.set(p, { key, canvas: cv });
    return cv;
  }

  // Pasto que se mece (en vivo, pocas líneas por plataforma visible)
  function drawLive(ctx, p, sx, sy, biomeKey, biome, t) {
    if (p.type === 'ceiling' || p.type === 'wall') return;
    if (biomeKey === 'pradera' || biomeKey === 'bosque') {
      ctx.strokeStyle = biome.turfBlade;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const x0 = Math.max(sx + 6, -10), x1 = Math.min(sx + p.w - 6, 970);
      const start = sx + 6 + Math.ceil((x0 - sx - 6) / 11) * 11;
      // Viento de Ruben (wind-pull.js): las briznas dentro de la franja se doblan en la
      // dirección del viento (soplar = se alejan, jalar = se inclinan hacia Ruben) y tiemblan
      const WP = window.WindPull;
      const band = WP && WP.getBand ? WP.getBand() : null;
      const windOn = band && band.power > 0.05 && band.reach > 8;
      const camX = p.x - sx, camY = p.y - sy;   // de pantalla a mundo
      for (let gx = start; gx < x1; gx += 11) {
        const k = (gx - sx) * 0.37;
        let sway = Math.sin(t * 2.2 + k * 0.6) * 2.2;
        let hh = 4 + ((k * 7.3) % 5);
        if (windOn) {
          const rx = gx + camX - band.hx, ry = sy + camY - 3 - band.hy;
          const along = rx * band.dirX + ry * band.dirY;
          if (along > -6 && along < band.reach) {
            const u = Math.max(0, along / band.range);
            const perp = Math.abs(ry * band.dirX - rx * band.dirY);
            const half = (WP.bandHalf ? WP.bandHalf(u) : 30) + 12;
            if (perp < half) {
              const f = band.power * (1 - u * 0.5) * (1 - perp / half * 0.7);
              const dir = (band.mode === 'push' ? 1 : -1) * (band.dirX >= 0 ? 1 : -1);
              sway = sway * (1 - f) + dir * f * (7 + Math.abs(band.dirX) * 3) + Math.sin(t * 24 + k * 2.1) * 1.6 * f;
              hh *= 1 - f * 0.25;   // al doblarse se ve más bajita
            }
          }
        }
        ctx.moveTo(gx, sy - 1);
        ctx.quadraticCurveTo(gx + sway * 0.3, sy - hh * 0.6, gx + sway, sy - hh);
      }
      ctx.stroke();
    } else if (biomeKey === 'montana') {
      // destellos en la nieve
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      const n = Math.max(1, Math.floor(p.w / 160));
      for (let i = 0; i < n; i++) {
        const ph = (t * 0.6 + i * 0.37 + p.x * 0.013) % 1;
        if (ph > 0.25) continue;
        const r = Math.sin(ph / 0.25 * Math.PI) * 2.6;
        const px = sx + ((i * 97 + p.x * 3) % Math.max(10, p.w - 20)) + 10;
        sparklePath(ctx, px, sy - 3, r);
        ctx.fill();
      }
    }
  }

  function drawPlatform(ctx, p, sx, sy, biomeKey, biome) {
    const key = biomeKey in EXTRA ? biomeKey : 'pradera';
    const cv = getCanvas(p, key, biome);
    ctx.drawImage(cv, Math.round(sx - PAD), Math.round(sy - PAD));
    drawLive(ctx, p, sx, sy, key, biome, Date.now() * 0.001);
  }

  // ---------- muros quebradizos ----------
  function paintBreakable(c, b, biomeKey, biome) {
    const R = rng(seedOf(b) ^ 0x5bd1e995);
    const x = PAD, y = PAD, w = b.w, h = b.h;
    if (biomeKey === 'bosque') {
      // muro de raíces enredadas
      c.fillStyle = 'rgba(40, 26, 14, 0.85)';
      c.beginPath();
      c.roundRect(x + 2, y, w - 4, h, 6);
      c.fill();
      const n = Math.max(3, Math.round(w / 8));
      for (let i = 0; i < n; i++) {
        const rx = x + 3 + (i + 0.5) * (w - 6) / n;
        const thick = 5 + R() * 4;
        c.strokeStyle = OUT;
        c.lineWidth = thick + 2.5;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(rx, y);
        for (let yy = y; yy < y + h; yy += 40) {
          c.quadraticCurveTo(rx + (R() - 0.5) * 14, yy + 20, rx + (R() - 0.5) * 6, Math.min(y + h, yy + 40));
        }
        c.stroke();
        c.strokeStyle = shade('#6b4a2b', (R() - 0.5) * 0.2);
        c.lineWidth = thick;
        c.stroke();
        c.strokeStyle = 'rgba(255, 230, 190, 0.25)';
        c.lineWidth = 1.2;
        c.stroke();
      }
      for (let yy = y + 30 + R() * 30; yy < y + h - 20; yy += 70 + R() * 60) {
        vine(c, x + w * (0.2 + R() * 0.6), yy, 14 + R() * 10, '#5c9963', R);
      }
    } else if (biomeKey === 'montana' || biomeKey === 'castillo') {
      // rastrillo de hierro oxidado (se ve el fondo entre los barrotes)
      const bars = Math.max(2, Math.round(w / 10));
      c.lineCap = 'butt';
      for (let yy = y + 30; yy < y + h - 20; yy += 46) {
        c.fillStyle = '#4c4642';
        c.strokeStyle = OUT;
        c.lineWidth = 1.4;
        c.beginPath();
        c.rect(x - 2, yy, w + 4, 5);
        c.fill();
        c.stroke();
      }
      for (let i = 0; i < bars; i++) {
        const bx = x + (i + 0.5) * w / bars;
        c.fillStyle = '#5b5550';
        c.strokeStyle = OUT;
        c.lineWidth = 1.4;
        c.beginPath();
        c.rect(bx - 2.5, y, 5, h - 8);
        c.fill();
        c.stroke();
        // óxido
        c.fillStyle = 'rgba(150, 80, 40, 0.65)';
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.ellipse(bx, y + R() * (h - 20), 2, 3 + R() * 5, 0, 0, Math.PI * 2);
          c.fill();
        }
        // punta
        c.fillStyle = '#6a625b';
        c.beginPath();
        c.moveTo(bx - 3.5, y + h - 9);
        c.lineTo(bx, y + h);
        c.lineTo(bx + 3.5, y + h - 9);
        c.closePath();
        c.fill();
        c.stroke();
      }
      if (biomeKey === 'montana') {
        for (let yy = y + 30; yy < y + h - 20; yy += 46) {
          c.fillStyle = '#f4f9fd';
          c.strokeStyle = OUT;
          c.lineWidth = 1;
          c.beginPath();
          c.ellipse(x + w / 2, yy - 1, w / 2 + 2, 2.6, 0, Math.PI, 0);
          c.fill();
          c.stroke();
          icicle(c, x + w * 0.3, yy + 5, 5 + R() * 6, 1.6);
        }
      }
    } else {
      // muro de piedra agrietado
      body(c, x, y, w, h, 4, shade(biome.stoneTop, 0.05), biome.stoneBottom);
      masonry(c, x, y, w, h, R, { rowH: 24, minW: Math.max(10, w * 0.45), maxW: Math.max(14, w * 0.9) });
      outline(c, x, y, w, h, 4);
      cracks(c, x, y, w, h, R, Math.max(2, Math.floor(h / 70)));
    }
  }

  function drawBreakable(ctx, b, sx, sy, biomeKey, biome) {
    const key = 'brk|' + biomeKey + '|' + b.w + '|' + b.h;
    let hit = cache.get(b);
    if (!hit || hit.key !== key) {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(b.w + PAD * 2);
      cv.height = Math.ceil(b.h + PAD * 2);
      const c = cv.getContext('2d');
      c.lineJoin = 'round';
      paintBreakable(c, b, biomeKey, biome);
      hit = { key, canvas: cv };
      cache.set(b, hit);
    }
    ctx.drawImage(hit.canvas, Math.round(sx - PAD), Math.round(sy - PAD));
  }

  window.TerrainArt = {
    drawPlatform,
    drawBreakable,
    clearCache() { /* WeakMap: se libera solo; esto fuerza repintar cambiando la clave */ }
  };
})();
