/**
 * Las Canteras del Este: decorados y el cantero - Ruben: En Busca de Angelo (Claude, 21/11)
 *
 * Decorados sin colisión (`room.props`, x = centro, y = suelo), estilo años 50 con tinta #3a2416:
 *  - 'quarry-crane'  grúa de madera con pluma, polea y un bloque que se mece colgado de la soga
 *                    (`facing` 1 / -1 = hacia dónde apunta la pluma).
 *  - 'stone-blocks'  pila de bloques cortados con marcas de cincel (`rows` 1-3).
 *  - 'mine-mouth'    boca de la mina con marco de vigas, tapada por rocas enormes, cartel y pico.
 * NPC: `look: 'stonecutter'` (Bruno, el cantero) y `look: 'earth-master'` (Maestra Greda) vía
 * `window.NPCLooks` de npcs.js. La mina se abre con `pr.open` (0..1, lo escribe earth-power.js).
 * Se dibujan DETRÁS de Ruben (capa world de AnimationRegistry, orden 48; los NPC van en 50).
 * Hooks: onInit, onBeforeUpdate (reloj). Sin basura por cuadro.
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const clock = { t: 0 };

  function ink(ctx, w) { ctx.strokeStyle = OUT; ctx.lineWidth = w || 2.2; }

  // ---------------- Grúa de madera ----------------
  function drawCrane(ctx, pr, cam, t) {
    const x = pr.x - cam.x, gy = pr.y - cam.y;
    const f = pr.facing || 1;
    const H = 190, J = 120;                       // alto del mástil, largo de la pluma
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Sombra
    ctx.fillStyle = 'rgba(40, 22, 10, 0.22)';
    ctx.beginPath(); ctx.ellipse(x, gy + 1, 40, 5, 0, 0, Math.PI * 2); ctx.fill();
    ink(ctx);
    // Patas en A
    ctx.fillStyle = '#8a5a32';
    ctx.beginPath(); ctx.moveTo(x - 32, gy); ctx.lineTo(x - 5, gy - H); ctx.lineTo(x + 5, gy - H); ctx.lineTo(x - 22, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 32, gy); ctx.lineTo(x + 5, gy - H); ctx.lineTo(x - 5, gy - H); ctx.lineTo(x + 22, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Travesaños
    ctx.lineWidth = 4; ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.moveTo(x - 23, gy - 60); ctx.lineTo(x + 23, gy - 60); ctx.moveTo(x - 14, gy - 120); ctx.lineTo(x + 14, gy - 120); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#b07a46';
    ctx.beginPath(); ctx.moveTo(x - 23, gy - 60); ctx.lineTo(x + 23, gy - 60); ctx.moveTo(x - 14, gy - 120); ctx.lineTo(x + 14, gy - 120); ctx.stroke();
    // Torno con manivela
    ink(ctx, 2);
    ctx.fillStyle = '#6e4a2a';
    ctx.beginPath(); ctx.arc(x, gy - 60, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const ca = t * 0.01;
    ctx.beginPath(); ctx.moveTo(x, gy - 60); ctx.lineTo(x + Math.cos(ca) * 15, gy - 60 + Math.sin(ca) * 15); ctx.stroke();
    // Pluma
    const tipX = x + f * J, tipY = gy - H + 8;
    ctx.lineWidth = 9; ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.moveTo(x - f * 18, gy - H + 2); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = '#a06c3c';
    ctx.beginPath(); ctx.moveTo(x - f * 18, gy - H + 2); ctx.lineTo(tipX, tipY); ctx.stroke();
    // Tirante
    ink(ctx, 1.4);
    ctx.beginPath(); ctx.moveTo(x, gy - H - 2); ctx.lineTo(tipX, tipY); ctx.stroke();
    // Polea
    ink(ctx, 2);
    ctx.fillStyle = '#c8963e';
    ctx.beginPath(); ctx.arc(tipX, tipY + 4, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Soga y bloque que se mece (péndulo)
    const sw = Math.sin(t * 0.025 + pr.x) * 0.12;
    const L = 95 + Math.sin(t * 0.008) * 6;
    const bx = tipX + Math.sin(sw) * L, by = tipY + 4 + Math.cos(sw) * L;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(tipX, tipY + 6); ctx.lineTo(bx, by - 14); ctx.stroke();
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(sw * 0.8);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-14, 0); ctx.moveTo(0, -14); ctx.lineTo(14, 0); ctx.stroke();
    ctx.fillStyle = '#b9ad98'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.roundRect(-18, 0, 36, 24, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-6, 10); ctx.moveTo(4, 14); ctx.lineTo(11, 18); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // ---------------- Pila de bloques cortados ----------------
  const BLOCK_TINT = ['#c4b8a2', '#b3a68f', '#cfc3ab', '#a99c86'];
  function block(ctx, x, y, w, h, k) {
    ctx.fillStyle = BLOCK_TINT[k & 3];
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();
    // Luz arriba y marcas de cincel
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 248, 230, 0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 3); ctx.lineTo(x + w - 4, y + 3); ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.3)'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const mx = x + 8 + ((k * 13 + i * 17) % Math.max(8, w - 16));
      ctx.beginPath(); ctx.moveTo(mx, y + 8 + i * 4); ctx.lineTo(mx + 5, y + 11 + i * 4); ctx.stroke();
    }
    ctx.restore();
  }
  function drawBlocks(ctx, pr, cam) {
    const x = pr.x - cam.x, gy = pr.y - cam.y;
    const rows = Math.max(1, Math.min(3, pr.rows || 2));
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(40, 22, 10, 0.22)';
    ctx.beginPath(); ctx.ellipse(x, gy + 1, 62, 5, 0, 0, Math.PI * 2); ctx.fill();
    ink(ctx, 2);
    const W = 40, Hh = 26;
    for (let r = 0; r < rows; r++) {
      const n = 3 - r;
      const x0 = x - (n * W) / 2;
      for (let i = 0; i < n; i++) block(ctx, x0 + i * W + 1, gy - (r + 1) * Hh, W - 2, Hh - 1, r * 3 + i + (pr.x | 0));
    }
    ctx.restore();
  }

  // Roca redonda con brillo (boca de la mina)
  function rock(ctx, x, gy, rx, ry, rw, rh, c) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(x + rx, gy + ry, rw, rh, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.strokeStyle = 'rgba(255, 248, 230, 0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x + rx - rw * 0.25, gy + ry - rh * 0.4, rw * 0.4, rh * 0.25, -0.3, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
    ctx.restore();
  }

  // ---------------- Boca de la mina, tapada ----------------
  // pr.open (0..1, lo escribe earth-power.js): las rocas se hunden en el suelo y adentro
  // se ve la luz de un farol
  function drawMine(ctx, pr, cam, t) {
    const open = pr.open || 0;
    const quake = open > 0 && open < 1 ? Math.sin(t * 1.7) * 1.6 : 0;
    const x = pr.x - cam.x + quake, gy = pr.y - cam.y;
    const W = 150, H = 170;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Pared de roca alrededor
    ink(ctx, 2.4);
    ctx.fillStyle = '#8f877a';
    ctx.beginPath();
    ctx.moveTo(x - W, gy);
    ctx.quadraticCurveTo(x - W - 10, gy - H * 0.8, x - W * 0.5, gy - H - 30);
    ctx.quadraticCurveTo(x, gy - H - 60, x + W * 0.55, gy - H - 26);
    ctx.quadraticCurveTo(x + W + 12, gy - H * 0.7, x + W, gy);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Vetas
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.3)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - W + 14, gy - 60); ctx.quadraticCurveTo(x - W + 40, gy - 90, x - W + 30, gy - 130);
    ctx.moveTo(x + W - 20, gy - 40); ctx.quadraticCurveTo(x + W - 46, gy - 100, x + W - 30, gy - 150);
    ctx.stroke();
    // Hueco oscuro
    ctx.fillStyle = '#2a1b12';
    ctx.beginPath(); ctx.moveTo(x - 52, gy); ctx.lineTo(x - 52, gy - 100); ctx.quadraticCurveTo(x, gy - 140, x + 52, gy - 100); ctx.lineTo(x + 52, gy); ctx.closePath(); ctx.fill();
    // Marco de vigas
    ink(ctx, 2.2);
    ctx.fillStyle = '#8a5a32';
    ctx.beginPath(); ctx.roundRect(x - 62, gy - 118, 14, 118, 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x + 48, gy - 118, 14, 118, 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x - 72, gy - 130, 144, 16, 3); ctx.fill(); ctx.stroke();
    // Mina abierta: luz cálida de un farol al fondo
    if (open > 0) {
      ctx.save();
      ctx.globalAlpha = open * (0.55 + Math.sin(t * 0.07) * 0.08);
      ctx.fillStyle = '#f2b45a';
      ctx.beginPath(); ctx.ellipse(x, gy - 46, 30, 36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = open;
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath(); ctx.arc(x + 4, gy - 50, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Rocas enormes que tapan la entrada (al abrirse se hunden; lo de abajo del suelo no se ve)
    if (open < 1) {
      const sink = open * open * 140;
      ctx.save();
      ctx.beginPath(); ctx.rect(x - 110, gy - 240, 220, 240); ctx.clip();
      ink(ctx, 2.2);
      rock(ctx, x, gy + sink, -26, -28, 34, 28, '#9d9483');
      rock(ctx, x, gy + sink, 28, -30, 32, 30, '#8a8172');
      rock(ctx, x, gy + sink * 1.1, 2, -74, 30, 24, '#a8a08f');
      rock(ctx, x, gy + sink * 1.2, -34, -82, 18, 16, '#938a7a');
      rock(ctx, x, gy + sink * 1.2, 36, -84, 16, 14, '#9d9483');
      ctx.restore();
    }
    // Polvito que cae de las rocas cada tanto
    const k = (t * (open > 0 && open < 1 ? 0.05 : 0.01)) % 1;
    ctx.fillStyle = 'rgba(200, 190, 170, ' + (0.6 * (1 - k)).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(x + 12, gy - 98 + k * 60, 1.6, 0, Math.PI * 2); ctx.arc(x - 20, gy - 102 + ((k + 0.5) % 1) * 60, 1.3, 0, Math.PI * 2); ctx.fill();
    // Cartel tallado
    ink(ctx, 2);
    ctx.fillStyle = '#c9a26a';
    ctx.beginPath(); ctx.roundRect(x - 34, gy - 156, 68, 22, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = OUT;
    ctx.font = 'bold 12px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MINA', x, gy - 144);
    // Pico apoyado
    ink(ctx, 4);
    ctx.beginPath(); ctx.moveTo(x + 92, gy); ctx.lineTo(x + 76, gy - 46); ctx.stroke();
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 92, gy); ctx.lineTo(x + 76, gy - 46); ctx.stroke();
    ink(ctx, 2);
    ctx.fillStyle = '#7d8790';
    ctx.beginPath(); ctx.moveTo(x + 62, gy - 40); ctx.quadraticCurveTo(x + 77, gy - 54, x + 94, gy - 50); ctx.lineTo(x + 92, gy - 46); ctx.quadraticCurveTo(x + 77, gy - 48, x + 64, gy - 38); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---------------- Bruno, el cantero (NPC) ----------------
  // Petiso y ancho, delantal de cuero, mangas arremangadas, mazo al hombro, pelado con
  // bigote espeso y polvo de piedra en la ropa.
  function drawStonecutter(ctx, n, cam, t, talking, f, mouthOpen) {
    const x = n.x - cam.x, fy = n.y - cam.y;
    const fx = n.fx || null;
    const wind = fx ? fx.wind || 0 : 0;
    const breathe = Math.sin(t * 0.04) * 0.025;
    const bob = talking ? Math.abs(Math.sin(t * 0.33)) * 1.5 : 0;
    const blink = (t % 190) < 7;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(40, 22, 10, 0.22)';
    ctx.beginPath(); ctx.ellipse(x, fy + 1, 19, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, fy);
    ctx.scale(1 - breathe * 0.5, 1 + breathe);
    ctx.translate(-x, -fy - bob);
    ink(ctx, 2);
    // Botas
    ctx.fillStyle = '#4a3020';
    ctx.beginPath(); ctx.ellipse(x - 7, fy - 3, 7, 3.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 7, fy - 3, 7, 3.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Pantalón
    ctx.fillStyle = '#5e6a78';
    ctx.beginPath(); ctx.roundRect(x - 12, fy - 18, 24, 14, 4); ctx.fill(); ctx.stroke();
    // Torso ancho (camisa)
    ctx.fillStyle = '#d9c7a0';
    ctx.beginPath();
    ctx.moveTo(x - 10, fy - 40);
    ctx.quadraticCurveTo(x - 21, fy - 30, x - 16, fy - 15);
    ctx.lineTo(x + 16, fy - 15);
    ctx.quadraticCurveTo(x + 21, fy - 30, x + 10, fy - 40);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Delantal de cuero
    ctx.fillStyle = '#8a5a32';
    ctx.beginPath(); ctx.roundRect(x - 11, fy - 34, 22, 26, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c8963e'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - 8, fy - 22); ctx.lineTo(x + 8, fy - 22); ctx.stroke();
    // Polvo de piedra en la ropa
    ctx.fillStyle = 'rgba(240, 232, 214, 0.75)';
    ctx.beginPath(); ctx.arc(x - 5, fy - 14, 1.4, 0, Math.PI * 2); ctx.arc(x + 6, fy - 27, 1.2, 0, Math.PI * 2); ctx.arc(x + 2, fy - 11, 1, 0, Math.PI * 2); ctx.fill();
    ink(ctx, 2);
    // Mazo al hombro (del lado hacia donde mira)
    const sx = x + f * 14;
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(sx, fy - 24); ctx.lineTo(sx - f * 16, fy - 56); ctx.stroke();
    ctx.strokeStyle = '#a06c3c'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(sx, fy - 24); ctx.lineTo(sx - f * 16, fy - 56); ctx.stroke();
    ink(ctx, 2);
    ctx.save();
    ctx.translate(sx - f * 17, fy - 58);
    ctx.rotate(f * -0.46);
    ctx.fillStyle = '#7d8790';
    ctx.beginPath(); ctx.roundRect(-11, -6, 22, 12, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
    // Brazos arremangados
    ctx.fillStyle = '#e8b48a';
    ctx.beginPath(); ctx.arc(sx, fy - 26, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - f * 15, fy - 22, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Cabeza pelada
    const hx = x + f * 1.5, hy = fy - 48;
    ctx.fillStyle = '#e8b48a';
    ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.strokeStyle = 'rgba(255, 245, 225, 0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx - f * 2, hy - 2, 6.5, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke(); ctx.restore();
    // Patillas grises
    ctx.fillStyle = '#9c9488';
    ctx.beginPath(); ctx.ellipse(hx - f * 8.5, hy + 1, 2.6, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Ojos
    ctx.fillStyle = OUT;
    for (let k = -1; k <= 1; k += 2) {
      const ex = hx + f * 2 + k * 3.8, ey = hy - 2;
      if (blink) { ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ex - 1.6, ey); ctx.lineTo(ex + 1.6, ey); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex + f * 0.5 + wind * 0.6, ey, 1.5, 0, Math.PI * 2); ctx.fill(); }
    }
    ink(ctx, 2);
    // Cejas
    ctx.strokeStyle = '#6b6258'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(hx + f * 2 - 6.5, hy - 6); ctx.lineTo(hx + f * 2 - 1.5, hy - 5.5);
    ctx.moveTo(hx + f * 2 + 1.5, hy - 5.5); ctx.lineTo(hx + f * 2 + 6.5, hy - 6); ctx.stroke();
    ink(ctx, 2);
    // Nariz
    ctx.fillStyle = '#d98a6a';
    ctx.beginPath(); ctx.arc(hx + f * 4.5, hy + 1.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Boca (al hablar) y bigote espeso que se mueve con el viento
    if (mouthOpen) {
      const m = 0.5 + 0.5 * Math.sin(t * 0.6);
      ctx.fillStyle = '#5a2418';
      ctx.beginPath(); ctx.ellipse(hx + f * 2, hy + 7.5, 2.6, 0.8 + m * 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#7a7166';
    ctx.beginPath(); ctx.ellipse(hx + f * 2 - 4 + wind, hy + 5, 5, 2.6, 0.25 + wind * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + f * 2 + 4 + wind, hy + 5, 5, 2.6, -0.25 + wind * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---------------- Maestra Greda, de la Tierra (NPC) ----------------
  // Mujer mayor y robusta, poncho color tierra con guarda, trenza gris larga, vara con una
  // piedra atada. Mientras Ruben no le habla está agachada con la palma en el suelo,
  // escuchando a la tierra (n.listen 0..1, suavizado acá).
  function drawEarthMaster(ctx, n, cam, t, talking, f, mouthOpen) {
    const want = n.lineIdx ? 0 : 1;
    if (n.listen === undefined) n.listen = want;
    n.listen += (want - n.listen) * 0.08;
    const ls = n.listen;
    const x = n.x - cam.x, fy = n.y - cam.y;
    const breathe = Math.sin(t * 0.035) * 0.02;
    const bob = talking ? Math.abs(Math.sin(t * 0.3)) * 1.3 : 0;
    const crouch = ls * 14;
    const blink = ls > 0.5 || (t % 230) < 7;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(40, 22, 10, 0.22)';
    ctx.beginPath(); ctx.ellipse(x, fy + 1, 20, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    // Vara con piedra (clavada en el suelo, detrás)
    const sx = x - f * 17;
    ink(ctx, 4.5);
    ctx.beginPath(); ctx.moveTo(sx, fy); ctx.lineTo(sx + f * 2, fy - 64); ctx.stroke();
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(sx, fy); ctx.lineTo(sx + f * 2, fy - 64); ctx.stroke();
    ink(ctx, 2);
    ctx.fillStyle = '#b48a5a';
    ctx.beginPath(); ctx.ellipse(sx + f * 2, fy - 68, 6.5, 5.5, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d9a634'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(sx + f * 2 - 5, fy - 64); ctx.lineTo(sx + f * 2 + 5, fy - 64); ctx.stroke();
    ink(ctx, 2);
    // Cuerpo (se agacha al escuchar la tierra)
    ctx.translate(x, fy);
    ctx.scale(1 - breathe * 0.5, 1 + breathe);
    ctx.translate(-x, -fy - bob);
    const by = fy + crouch;
    // Pies
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath(); ctx.ellipse(x - 7, fy - 3, 7, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 7, fy - 3, 7, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Falda larga
    ctx.fillStyle = '#7a4a32';
    ctx.beginPath(); ctx.moveTo(x - 13, by - 30); ctx.quadraticCurveTo(x - 19, fy - 6, x - 15, fy - 5); ctx.lineTo(x + 15, fy - 5); ctx.quadraticCurveTo(x + 19, fy - 6, x + 13, by - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Poncho con guarda
    ctx.fillStyle = '#b5814a';
    ctx.beginPath(); ctx.moveTo(x, by - 46); ctx.lineTo(x - 21, by - 20); ctx.quadraticCurveTo(x, by - 14, x + 21, by - 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#5e7a4a'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x - 18, by - 22); ctx.quadraticCurveTo(x, by - 16.5, x + 18, by - 22); ctx.stroke();
    ctx.strokeStyle = '#e8d7a8'; ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 6 - 2, by - 26); ctx.lineTo(x + i * 6, by - 30); ctx.lineTo(x + i * 6 + 2, by - 26); ctx.stroke(); }
    ink(ctx, 2);
    // Mano: en reposo sobre el poncho; al escuchar, la palma apoyada en el suelo
    const hx2 = x + f * (14 + ls * 6), hy2 = by - 24 + ls * (fy - 4 - (by - 24));
    ctx.strokeStyle = OUT; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x + f * 10, by - 34); ctx.lineTo(hx2, hy2); ctx.stroke();
    ctx.strokeStyle = '#b5814a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + f * 10, by - 34); ctx.lineTo(hx2, hy2); ctx.stroke();
    ink(ctx, 2);
    ctx.fillStyle = '#c98f62';
    ctx.beginPath(); ctx.ellipse(hx2, hy2, 4.2, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (ls > 0.6) {
      // Ondas en la tierra bajo la palma
      const k = (t * 0.02) % 1;
      ctx.save(); ctx.globalAlpha = (1 - k) * 0.7 * ls; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(hx2, fy + 1, 6 + k * 22, 1.5 + k * 3, 0, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // Cabeza
    const hx = x + f * (1.5 + ls * 5), hy = by - 54 + ls * 4;
    ctx.fillStyle = '#c98f62';
    ctx.beginPath(); ctx.arc(hx, hy, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Pelo gris recogido y trenza larga a la espalda
    ctx.fillStyle = '#bdb5a8';
    ctx.beginPath(); ctx.arc(hx - f * 1, hy - 3, 9.8, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); ctx.stroke();
    const sway = Math.sin(t * 0.03) * 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.ellipse(hx - f * (8 + i * 1.5) + sway * i * 0.3, hy + 2 + i * 7, 3.4 - i * 0.3, 4.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#5e7a4a';
    ctx.beginPath(); ctx.arc(hx - f * 13 + sway, hy + 30, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Ojos (cerrados mientras escucha)
    ctx.fillStyle = OUT;
    for (let k = -1; k <= 1; k += 2) {
      const ex = hx + f * 2 + k * 3.6, ey = hy - 1;
      if (blink) { ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(ex, ey - 0.6, 1.8, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex + f * 0.6, ey, 1.5, 0, Math.PI * 2); ctx.fill(); }
    }
    ink(ctx, 2);
    // Nariz y boca
    ctx.fillStyle = '#b5785a';
    ctx.beginPath(); ctx.arc(hx + f * 4.5, hy + 2, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (mouthOpen) {
      const m = 0.5 + 0.5 * Math.sin(t * 0.6);
      ctx.fillStyle = '#5a2418';
      ctx.beginPath(); ctx.ellipse(hx + f * 2.5, hy + 6, 2.2, 0.8 + m * 1.8, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(hx + f * 2.5, hy + 4.5, 2.6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }
    // Pendiente de piedra verde
    ink(ctx, 1.4);
    ctx.fillStyle = '#7fae7a';
    ctx.beginPath(); ctx.arc(hx - f * 6, hy + 7, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawProps(ctx, room, cam, t) {
    const list = room.props;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const pr = list[i];
      if (pr.type === 'quarry-crane') drawCrane(ctx, pr, cam, t);
      else if (pr.type === 'stone-blocks') drawBlocks(ctx, pr, cam);
      else if (pr.type === 'mine-mouth') drawMine(ctx, pr, cam, t);
    }
  }

  window.NPCLooks = window.NPCLooks || {};
  window.NPCLooks.stonecutter = drawStonecutter;
  window.NPCLooks['earth-master'] = drawEarthMaster;

  function install(g) {
    window.GameHooks.onBeforeUpdate.push((game, running) => { if (running) clock.t++; });
    const draw = (ctx, cam) => {
      try { const room = g.world && g.world.getCurrentRoom(); if (room) drawProps(ctx, room, cam, clock.t); } catch (e) { console.error('[Cantera]', e); }
    };
    const AR = window.AnimationRegistry || window.AnimSystem;
    if (AR && AR.registerLayer) AR.registerLayer('world', 'quarry-props', { order: 48, after(world, ctx, cam) { draw(ctx, cam); } });
    else window.GameHooks.onRenderWorld.push((game, ctx, cam) => draw(ctx, cam));
  }

  window.Quarry = { drawCrane, drawBlocks, drawMine, drawStonecutter };
  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Cantera] no se pudo iniciar:', e); }
  });
})();
