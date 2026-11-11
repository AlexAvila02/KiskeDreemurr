/**
 * Hogar del Maestro Arroyo - Ruben: En Busca de Angelo (Claude)
 *
 * Decorados sin colisión para `room.props` (sala 12, Laguna del Maestro):
 *  - 'water-wheel'  { x, y }    rueda hidráulica: un manantial sale de la pared, corre por
 *                               un canal de madera sobre pilotes y cae sobre la rueda, que
 *                               gira y mueve una dinamo con bombilla; un cable lleva la luz
 *                               al hogar. x = centro de la rueda, y = suelo.
 *  - 'master-house' { x, y }    casita de piedra con techo de tejas azul verdoso, ventana
 *                               redonda encendida (con la energía de la rueda), puerta de
 *                               arco, chimenea, tonel de lluvia y juncos. x = centro, y = suelo.
 *  - 'flower-meadow'{ x, y, w } prado de flores que se mecen (margaritas, tulipanes,
 *                               amapolas, campanillas) con mariposas. x = borde izq., y = suelo.
 * Estilo años 50: tinta marrón #3a2416, formas redondeadas. Se dibujan DETRÁS de Ruben
 * (capa world de AnimationRegistry, orden 48). Hooks: onInit, onBeforeUpdate (MAPA.md).
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const clock = { t: 0 };
  const TAU = Math.PI * 2;

  // Pseudoazar con semilla (las flores quedan siempre en el mismo lugar)
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function ink(ctx, w) { ctx.strokeStyle = OUT; ctx.lineWidth = w || 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

  // Brillo de la bombilla (late con el giro de la rueda); lo comparte la casa
  function glow(t) { return 0.75 + 0.25 * Math.sin(t * 0.09) * Math.sin(t * 0.023 + 1); }

  // ---------------- rueda hidráulica + manantial + dinamo ----------------
  const WHEEL_R = 78;
  function drawWaterWheel(ctx, pr, cam, t) {
    const gx = pr.x - cam.x, gy = pr.y - cam.y;
    const cx = gx, cy = gy - WHEEL_R - 18;          // eje de la rueda
    const flumeY = cy - WHEEL_R - 26;              // fondo del canal
    const wallX = 30 - cam.x;                       // cara de la pared izquierda
    ctx.save();
    ink(ctx);

    // Estanque de piedra bajo la rueda
    const bw = 210, bx = cx - bw / 2;
    ctx.fillStyle = '#4f88a8';
    ctx.beginPath(); ctx.ellipse(cx, gy - 4, bw / 2, 13, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.55)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.012) + i / 3) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.ellipse(cx + 22, gy - 5, 10 + k * 60, 2 + k * 7, 0, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Bordillo de piedras
    ink(ctx, 2);
    for (let i = 0; i < 9; i++) {
      const sx = bx + 8 + i * (bw - 16) / 8;
      ctx.fillStyle = i % 2 ? '#a39684' : '#8f8271';
      ctx.beginPath(); ctx.ellipse(sx, gy - 2 + (i % 2) * 2, 15, 7, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }

    // Pilotes del canal
    ink(ctx, 2);
    ctx.fillStyle = '#7a5434';
    for (const px of [wallX + 50, wallX + 120]) {
      ctx.beginPath(); ctx.roundRect(px - 5, flumeY + 10, 10, gy - flumeY - 12, 3); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(wallX + 50, gy - 40); ctx.lineTo(wallX + 120, flumeY + 40); ctx.stroke();

    // Brazo de soporte de la rueda (detrás)
    ctx.fillStyle = '#6b4a2e';
    ctx.beginPath();
    ctx.moveTo(cx - 34, gy - 4); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx + 34, gy - 4);
    ctx.lineTo(cx + 22, gy - 4); ctx.lineTo(cx, cy + 20); ctx.lineTo(cx - 22, gy - 4); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // La rueda (gira en sentido horario: el agua cae del lado derecho de arriba)
    const ang = t * 0.022;
    ctx.save();
    ctx.translate(cx, cy);
    // Aro exterior e interior
    ctx.lineWidth = 9; ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.arc(0, 0, WHEEL_R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = '#a0713f';
    ctx.beginPath(); ctx.arc(0, 0, WHEEL_R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.arc(0, 0, WHEEL_R - 26, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#a0713f';
    ctx.beginPath(); ctx.arc(0, 0, WHEEL_R - 26, 0, TAU); ctx.stroke();
    // Rayos
    for (let i = 0; i < 8; i++) {
      const a = ang + i * TAU / 8;
      const ca = Math.cos(a), sa = Math.sin(a);
      ctx.lineWidth = 7; ctx.strokeStyle = OUT;
      ctx.beginPath(); ctx.moveTo(ca * 10, sa * 10); ctx.lineTo(ca * (WHEEL_R - 2), sa * (WHEEL_R - 2)); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = '#b58250';
      ctx.beginPath(); ctx.moveTo(ca * 10, sa * 10); ctx.lineTo(ca * (WHEEL_R - 2), sa * (WHEEL_R - 2)); ctx.stroke();
    }
    // Paletas / cangilones
    ink(ctx, 2);
    for (let i = 0; i < 16; i++) {
      const a = ang + i * TAU / 16;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = i % 2 ? '#8a5f36' : '#9b6c3e';
      ctx.beginPath(); ctx.roundRect(WHEEL_R - 4, -6, 20, 12, 3); ctx.fill(); ctx.stroke();
      // Agua dentro de los cangilones de la mitad derecha (los que bajan llenos)
      const wa = ((a % TAU) + TAU) % TAU;
      if (wa > TAU * 0.78 || wa < TAU * 0.22) {
        ctx.fillStyle = 'rgba(140, 210, 235, 0.9)';
        ctx.beginPath(); ctx.roundRect(WHEEL_R + 1, -3.5, 11, 7, 2); ctx.fill();
      }
      ctx.restore();
    }
    // Cubo central
    ctx.fillStyle = '#5b3d25';
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9a25a';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Canal de madera: sale de la pared y termina sobre la rueda
    const fEnd = cx + 12;
    // Boca de piedra del manantial en la pared
    ink(ctx, 2.2);
    ctx.fillStyle = '#8f8271';
    ctx.beginPath(); ctx.roundRect(wallX - 6, flumeY - 30, 38, 40, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2d4a5a';
    ctx.beginPath(); ctx.ellipse(wallX + 13, flumeY - 8, 10, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // Musgo
    ctx.fillStyle = '#6f9a4a';
    ctx.beginPath(); ctx.ellipse(wallX + 6, flumeY - 30, 16, 6, -0.2, 0, TAU); ctx.fill(); ctx.stroke();
    // Agua en el canal (antes de las tablas para que asome por arriba)
    ctx.fillStyle = '#7cc6e2';
    ctx.beginPath(); ctx.roundRect(wallX + 14, flumeY - 6, fEnd - wallX - 14, 8, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(235, 250, 255, 0.85)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.02) + i / 6) % 1;
      const sx = wallX + 18 + k * (fEnd - wallX - 30);
      ctx.beginPath(); ctx.moveTo(sx, flumeY - 3); ctx.lineTo(sx + 10, flumeY - 3); ctx.stroke();
    }
    // Tablas del canal
    ink(ctx, 2.2);
    ctx.fillStyle = '#9b6c3e';
    ctx.beginPath(); ctx.roundRect(wallX + 10, flumeY, fEnd - wallX - 6, 12, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.5)'; ctx.lineWidth = 1.2;
    for (let px = wallX + 40; px < fEnd - 10; px += 34) {
      ctx.beginPath(); ctx.moveTo(px, flumeY + 2); ctx.lineTo(px, flumeY + 10); ctx.stroke();
    }

    // Chorro que cae del canal sobre la rueda (lado derecho de arriba)
    const jx = fEnd + 2, jTop = flumeY + 2, jBot = cy - WHEEL_R + 30;
    ctx.fillStyle = 'rgba(140, 210, 235, 0.85)';
    ctx.beginPath();
    ctx.moveTo(jx - 2, jTop);
    ctx.quadraticCurveTo(jx + 12, jTop + 4, jx + 14, jBot);
    ctx.lineTo(jx + 4, jBot);
    ctx.quadraticCurveTo(jx + 2, jTop + 10, jx - 2, jTop + 8);
    ctx.closePath(); ctx.fill();
    // Gotas que salpican al caer en los cangilones y al llegar al estanque
    ctx.fillStyle = 'rgba(200, 238, 252, 0.9)';
    for (let i = 0; i < 7; i++) {
      const k = ((t * 0.03) + i / 7) % 1;
      const side = i % 2 ? 1 : -1;
      const dx = jx + 10 + side * k * (16 + i * 3);
      const dy = jBot - 6 - Math.sin(k * Math.PI) * 18;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.arc(dx, dy, 2.4, 0, TAU); ctx.fill();
    }
    // Hilo de agua que gotea de la rueda al estanque (lado derecho)
    for (let i = 0; i < 5; i++) {
      const k = ((t * 0.025) + i / 5) % 1;
      ctx.globalAlpha = 0.85 * (1 - k * 0.6);
      ctx.beginPath(); ctx.arc(cx + WHEEL_R + 8 - k * 10, cy + 10 + k * (gy - cy - 20), 2.2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Eje hasta la dinamo (cubierta de madera con bobina de cobre y bombilla)
    const dx0 = cx + 100, dTop = gy - 70;
    ink(ctx, 2);
    ctx.fillStyle = '#6b4a2e';
    ctx.beginPath(); ctx.roundRect(cx, cy - 4, dx0 - cx, 8, 3); ctx.fill(); ctx.stroke();
    // Correa animada
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.7)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.04) + i / 4) % 1;
      const sx = cx + 18 + k * (dx0 - cx - 24);
      ctx.beginPath(); ctx.moveTo(sx, cy - 3); ctx.lineTo(sx + 4, cy + 3); ctx.stroke();
    }
    // Caja
    ink(ctx, 2.2);
    ctx.fillStyle = '#8a5f36';
    ctx.beginPath(); ctx.roundRect(dx0 - 8, dTop, 64, 70, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.45)'; ctx.lineWidth = 1.2;
    for (let yy = dTop + 14; yy < gy - 4; yy += 14) { ctx.beginPath(); ctx.moveTo(dx0 - 6, yy); ctx.lineTo(dx0 + 54, yy); ctx.stroke(); }
    // Bobina de cobre
    ink(ctx, 2);
    ctx.fillStyle = '#c47a3a';
    ctx.beginPath(); ctx.roundRect(dx0 + 4, dTop + 18, 40, 30, 10); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 210, 150, 0.7)'; ctx.lineWidth = 1.3;
    for (let i = 0; i < 6; i++) { const xx = dx0 + 10 + i * 6; ctx.beginPath(); ctx.moveTo(xx, dTop + 20); ctx.lineTo(xx, dTop + 46); ctx.stroke(); }
    // Engranaje que gira al frente
    ctx.save();
    ctx.translate(dx0 + 24, dTop + 33);
    ctx.rotate(-ang * 2.6);
    ink(ctx, 1.6);
    ctx.fillStyle = '#c9a25a';
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16, r = i % 2 ? 7 : 10;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fill();
    ctx.restore();
    // Bombilla sobre la caja
    const g = glow(t);
    const bxx = dx0 + 24, byy = dTop - 18;
    const halo = ctx.createRadialGradient(bxx, byy, 2, bxx, byy, 46);
    halo.addColorStop(0, `rgba(255, 236, 150, ${0.55 * g})`);
    halo.addColorStop(1, 'rgba(255, 236, 150, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(bxx, byy, 46, 0, TAU); ctx.fill();
    ink(ctx, 2);
    ctx.fillStyle = '#7d6e60';
    ctx.beginPath(); ctx.roundRect(bxx - 6, dTop - 8, 12, 9, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgb(255, ${Math.round(220 + 30 * g)}, ${Math.round(120 + 60 * g)})`;
    ctx.beginPath(); ctx.arc(bxx, byy, 11, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(190, 110, 30, 0.8)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(bxx - 4, byy + 4); ctx.lineTo(bxx - 2, byy - 3); ctx.lineTo(bxx + 2, byy + 2); ctx.lineTo(bxx + 4, byy - 4); ctx.stroke();
    // Chispitas de energía
    ctx.fillStyle = '#fff2b0';
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.018) + i / 4) % 1;
      const a = i * 1.7 + t * 0.01;
      ctx.globalAlpha = (1 - k) * g;
      const sx = bxx + Math.cos(a) * (14 + k * 22), sy = byy + Math.sin(a) * (14 + k * 22);
      ctx.beginPath(); ctx.moveTo(sx, sy - 3); ctx.lineTo(sx + 1, sy); ctx.lineTo(sx, sy + 3); ctx.lineTo(sx - 1, sy); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cable a la casa: postes y un hilo que cuelga, con pulsos de luz que viajan
    const pole1 = dx0 + 90;
    const houseX = (pr.houseX != null ? pr.houseX : pr.x + 370) - cam.x;
    const endX = houseX - 74, endY = gy - 96;
    ink(ctx, 2);
    ctx.fillStyle = '#6b4a2e';
    ctx.beginPath(); ctx.roundRect(pole1 - 4, gy - 120, 8, 120, 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(pole1 - 12, gy - 118, 24, 5, 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    const a0x = bxx + 10, a0y = dTop - 6, p1y = gy - 116;
    ctx.beginPath(); ctx.moveTo(a0x, a0y); ctx.quadraticCurveTo((a0x + pole1) / 2, a0y + 14, pole1, p1y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pole1, p1y); ctx.quadraticCurveTo((pole1 + endX) / 2, p1y + 34, endX, endY); ctx.stroke();
    // Pulsos
    ctx.fillStyle = '#ffe98a';
    for (let i = 0; i < 2; i++) {
      const k = ((t * 0.012) + i / 2) % 1;
      const u = k, mx = (pole1 + endX) / 2, my = p1y + 34;
      const px = (1 - u) * (1 - u) * pole1 + 2 * (1 - u) * u * mx + u * u * endX;
      const py = (1 - u) * (1 - u) * p1y + 2 * (1 - u) * u * my + u * u * endY;
      ctx.globalAlpha = 0.9 * g;
      ctx.beginPath(); ctx.arc(px, py, 2.6, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------------- el hogar del maestro ----------------
  function drawHouse(ctx, pr, cam, t) {
    const x = pr.x - cam.x, gy = pr.y - cam.y;
    const W = 190, H = 100;
    const L = x - W / 2, R = x + W / 2, top = gy - H;
    const g = glow(t);
    ctx.save();
    ink(ctx);

    // Sombra
    ctx.fillStyle = 'rgba(30, 22, 14, 0.28)';
    ctx.beginPath(); ctx.ellipse(x, gy + 1, W * 0.62, 6, 0, 0, TAU); ctx.fill();

    // Chimenea (detrás del techo) y humo
    const chx = x - 58;
    ctx.fillStyle = '#9a8a78';
    ctx.beginPath(); ctx.roundRect(chx, top - 74, 24, 56, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7d6e60';
    ctx.beginPath(); ctx.roundRect(chx - 3, top - 78, 30, 7, 2); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.005) + i / 4) % 1;
      const sx = chx + 12 + Math.sin(k * 6 + i) * 6 + k * 14;
      const sy = top - 84 - k * 70;
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.fillStyle = '#e8e2d6';
      ctx.beginPath(); ctx.arc(sx, sy, 6 + k * 12, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ink(ctx);

    // Paredes de piedra encalada, un poco abombadas
    ctx.fillStyle = '#e9dcc0';
    ctx.beginPath();
    ctx.moveTo(L + 6, gy);
    ctx.quadraticCurveTo(L - 4, gy - H / 2, L + 4, top);
    ctx.lineTo(R - 4, top);
    ctx.quadraticCurveTo(R + 4, gy - H / 2, R - 6, gy);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Piedras de la pared
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.32)'; ctx.lineWidth = 1.3;
    const R0 = rng(77);
    for (let i = 0; i < 16; i++) {
      const px = L + 14 + R0() * (W - 28), py = top + 12 + R0() * (H - 22);
      ctx.beginPath(); ctx.ellipse(px, py, 6 + R0() * 6, 3 + R0() * 2, 0, 0, TAU); ctx.stroke();
    }
    // Zócalo de piedras de río
    ink(ctx, 1.8);
    for (let i = 0; i < 10; i++) {
      const sx = L + 10 + i * (W - 20) / 9;
      ctx.fillStyle = i % 2 ? '#a39684' : '#8f9a9a';
      ctx.beginPath(); ctx.ellipse(sx, gy - 5, 11, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }

    // Techo de tejas azul verdoso, curvado como una ola
    ink(ctx, 2.4);
    ctx.fillStyle = '#4f8f8c';
    ctx.beginPath();
    ctx.moveTo(L - 22, top + 8);
    ctx.quadraticCurveTo(L - 4, top - 6, x - 30, top - 52);
    ctx.quadraticCurveTo(x, top - 76, x + 30, top - 52);
    ctx.quadraticCurveTo(R + 4, top - 6, R + 22, top + 8);
    ctx.quadraticCurveTo(R + 26, top + 18, R + 12, top + 16);
    ctx.lineTo(L - 12, top + 16);
    ctx.quadraticCurveTo(L - 26, top + 18, L - 22, top + 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Hileras de tejas (festones)
    ctx.strokeStyle = 'rgba(30, 60, 58, 0.55)'; ctx.lineWidth = 1.4;
    for (let row = 0; row < 3; row++) {
      const yy = top + 8 - row * 17;
      const half = (W / 2 + 12) - row * 30;
      ctx.beginPath();
      for (let xx = x - half; xx < x + half; xx += 16) ctx.arc(xx + 8, yy - 2, 8, 0, Math.PI);
      ctx.stroke();
    }
    // Brillo del techo
    ctx.strokeStyle = 'rgba(220, 250, 245, 0.45)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 20, top - 58); ctx.quadraticCurveTo(x, top - 70, x + 18, top - 60); ctx.stroke();
    // Remate: gota de agua de cobre en la cumbre
    ink(ctx, 2);
    ctx.fillStyle = '#7cc6e2';
    ctx.beginPath(); ctx.moveTo(x, top - 92); ctx.quadraticCurveTo(x + 10, top - 74, x, top - 68); ctx.quadraticCurveTo(x - 10, top - 74, x, top - 92); ctx.fill(); ctx.stroke();

    // Puerta de arco
    const dw = 40, dh = 62, dl = x + 16;
    ctx.fillStyle = '#7a5434';
    ctx.beginPath();
    ctx.moveTo(dl, gy); ctx.lineTo(dl, gy - dh + dw / 2);
    ctx.arc(dl + dw / 2, gy - dh + dw / 2, dw / 2, Math.PI, 0);
    ctx.lineTo(dl + dw, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(dl + dw / 2, gy - 2); ctx.lineTo(dl + dw / 2, gy - dh + 4); ctx.stroke();
    ctx.fillStyle = '#c9a25a';
    ink(ctx, 1.4);
    ctx.beginPath(); ctx.arc(dl + dw - 9, gy - 30, 2.6, 0, TAU); ctx.fill(); ctx.stroke();
    // Ola pintada sobre la puerta
    ctx.strokeStyle = '#4f8f8c'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(dl + 4, gy - dh - 8);
    ctx.quadraticCurveTo(dl + 12, gy - dh - 16, dl + 20, gy - dh - 8);
    ctx.quadraticCurveTo(dl + 28, gy - dh - 0, dl + 36, gy - dh - 8);
    ctx.stroke();

    // Ventana redonda encendida (con la luz de la rueda)
    const wx = x - 40, wy = top + 40;
    const halo = ctx.createRadialGradient(wx, wy, 4, wx, wy, 44);
    halo.addColorStop(0, `rgba(255, 220, 130, ${0.45 * g})`);
    halo.addColorStop(1, 'rgba(255, 220, 130, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(wx, wy, 44, 0, TAU); ctx.fill();
    ink(ctx, 2.4);
    ctx.fillStyle = '#7a5434';
    ctx.beginPath(); ctx.arc(wx, wy, 20, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgb(255, ${Math.round(205 + 30 * g)}, ${Math.round(110 + 40 * g)})`;
    ctx.beginPath(); ctx.arc(wx, wy, 15, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(wx - 15, wy); ctx.lineTo(wx + 15, wy); ctx.moveTo(wx, wy - 15); ctx.lineTo(wx, wy + 15); ctx.stroke();
    // Macetero de la ventana con flores
    ctx.fillStyle = '#c0663a';
    ctx.beginPath(); ctx.roundRect(wx - 22, wy + 20, 44, 10, 3); ctx.fill(); ctx.stroke();
    const sw = Math.sin(t * 0.03) * 1.5;
    for (let i = 0; i < 4; i++) {
      const fx = wx - 15 + i * 10 + sw, fy = wy + 15;
      ctx.fillStyle = ['#e2705a', '#f6e27a', '#f2a3c0', '#ffffff'][i];
      ink(ctx, 1.2);
      ctx.beginPath(); ctx.arc(fx, fy, 4, 0, TAU); ctx.fill(); ctx.stroke();
    }

    // Aislador donde llega el cable de la rueda, y farol eléctrico sobre la puerta
    ink(ctx, 1.8);
    ctx.fillStyle = '#9fdcef';
    ctx.beginPath(); ctx.roundRect(L - 2, top + 2, 8, 10, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(L + 2, top + 12); ctx.quadraticCurveTo(x - 10, top + 6, dl + dw + 10, gy - dh - 4); ctx.stroke();
    const lx = dl + dw + 12, ly = gy - dh + 2;
    const lh = ctx.createRadialGradient(lx, ly, 2, lx, ly, 34);
    lh.addColorStop(0, `rgba(255, 236, 150, ${0.5 * g})`);
    lh.addColorStop(1, 'rgba(255, 236, 150, 0)');
    ctx.fillStyle = lh;
    ctx.beginPath(); ctx.arc(lx, ly, 34, 0, TAU); ctx.fill();
    ink(ctx, 1.8);
    ctx.beginPath(); ctx.moveTo(lx, ly - 12); ctx.lineTo(lx, ly - 6); ctx.stroke();
    ctx.fillStyle = '#7d6e60';
    ctx.beginPath(); ctx.roundRect(lx - 5, ly - 8, 10, 5, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgb(255, ${Math.round(225 + 25 * g)}, ${Math.round(130 + 60 * g)})`;
    ctx.beginPath(); ctx.arc(lx, ly + 2, 6.5, 0, TAU); ctx.fill(); ctx.stroke();

    // Tonel de lluvia con su gotera
    const tx = R + 22;
    ink(ctx, 2);
    ctx.fillStyle = '#8a5f36';
    ctx.beginPath(); ctx.roundRect(tx - 15, gy - 40, 30, 40, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#5b3d25'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx - 15, gy - 28); ctx.lineTo(tx + 15, gy - 28); ctx.moveTo(tx - 15, gy - 12); ctx.lineTo(tx + 15, gy - 12); ctx.stroke();
    ink(ctx, 1.6);
    ctx.fillStyle = '#7cc6e2';
    ctx.beginPath(); ctx.ellipse(tx, gy - 40, 13, 4, 0, 0, TAU); ctx.fill(); ctx.stroke();
    const dk = (t * 0.02) % 1;
    ctx.fillStyle = 'rgba(140, 210, 235, 0.9)';
    ctx.beginPath(); ctx.arc(tx, top + 16 + dk * (gy - 44 - top - 16), 2.4, 0, TAU); ctx.fill();

    // Juncos y helechos a los lados
    ink(ctx, 1.8);
    for (let i = 0; i < 6; i++) {
      const bx = L - 18 + i * 6, h = 30 + (i % 3) * 10;
      const s = Math.sin(t * 0.025 + i) * 3;
      ctx.strokeStyle = '#4e7a3a';
      ctx.beginPath(); ctx.moveTo(bx, gy); ctx.quadraticCurveTo(bx + s, gy - h / 2, bx + s * 2, gy - h); ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillStyle = '#7a5434'; ctx.strokeStyle = OUT;
        ctx.beginPath(); ctx.ellipse(bx + s * 2, gy - h - 6, 3, 7, 0, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    // Banquito y regadera junto a la puerta
    ink(ctx, 2);
    ctx.fillStyle = '#9b6c3e';
    ctx.beginPath(); ctx.roundRect(x - 78, gy - 22, 46, 7, 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 72, gy - 15); ctx.lineTo(x - 72, gy); ctx.moveTo(x - 38, gy - 15); ctx.lineTo(x - 38, gy); ctx.stroke();
    ctx.fillStyle = '#6fa3b8';
    ctx.beginPath(); ctx.roundRect(x - 66, gy - 40, 20, 18, 5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 46, gy - 34); ctx.lineTo(x - 34, gy - 44); ctx.stroke();
    ctx.restore();
  }

  // ---------------- prado de flores ----------------
  const FLOWER_KINDS = [
    { petal: '#ffffff', center: '#f2c94c', n: 8, r: 5.5, kind: 'daisy' },
    { petal: '#e2483a', center: '#3a2416', n: 5, r: 6, kind: 'poppy' },
    { petal: '#f6d94a', center: '#d98a2b', n: 6, r: 5, kind: 'daisy' },
    { petal: '#f29ac0', center: '#f6e27a', n: 0, r: 7, kind: 'tulip' },
    { petal: '#8fb8f0', center: '#ffffff', n: 0, r: 6, kind: 'bell' },
    { petal: '#b98ae0', center: '#f6e27a', n: 5, r: 5, kind: 'daisy' },
    { petal: '#ff9f5a', center: '#3a2416', n: 0, r: 7, kind: 'tulip' }
  ];
  function buildMeadow(pr) {
    const R0 = rng(pr.seed || 1212);
    const list = [];
    const n = Math.round(pr.w / 7);
    for (let i = 0; i < n; i++) {
      const x = pr.x + 6 + R0() * (pr.w - 12);
      // Tres franjas de profundidad: atrás más chicas y más altas en pantalla
      const depth = R0();
      list.push({
        x, back: depth < 0.4,
        h: 18 + R0() * 28 + (depth < 0.4 ? 10 : 0),
        k: FLOWER_KINDS[Math.floor(R0() * FLOWER_KINDS.length)],
        s: 0.75 + R0() * 0.5,
        ph: R0() * TAU
      });
    }
    list.sort((a, b) => (a.back === b.back ? 0 : a.back ? -1 : 1));
    const grass = [];
    for (let i = 0; i < n * 1.4; i++) grass.push({ x: pr.x + R0() * pr.w, h: 8 + R0() * 16, ph: R0() * TAU, c: R0() < 0.5 ? '#5f8f3e' : '#77a84a' });
    const flies = [];
    for (let i = 0; i < Math.max(2, Math.round(pr.w / 220)); i++) {
      flies.push({ cx: pr.x + (i + 0.5) * pr.w / Math.max(2, Math.round(pr.w / 220)), ph: R0() * TAU, c: ['#f6d94a', '#9fdcef', '#f29ac0', '#ffffff'][i % 4] });
    }
    return { list, grass, flies };
  }

  function drawFlower(ctx, f, x, gy, t) {
    const sway = Math.sin(t * 0.03 + f.ph) * (3 + f.h * 0.08);
    const hx = x + sway, hy = gy - f.h - (f.back ? 6 : 0);
    const k = f.k, s = f.s;
    ctx.strokeStyle = '#4e7a3a'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x, gy - (f.back ? 6 : 0)); ctx.quadraticCurveTo(x + sway * 0.3, (gy + hy) / 2, hx, hy); ctx.stroke();
    // Hojita
    ctx.fillStyle = '#6f9a4a';
    ctx.beginPath(); ctx.ellipse(x + sway * 0.25 + 4, gy - f.h * 0.35, 5 * s, 2.2 * s, -0.6, 0, TAU); ctx.fill();
    ink(ctx, 1.2);
    if (k.kind === 'tulip') {
      ctx.fillStyle = k.petal;
      ctx.beginPath();
      ctx.moveTo(hx - k.r * s, hy - 2);
      ctx.quadraticCurveTo(hx - k.r * s, hy + k.r * s, hx, hy + k.r * s);
      ctx.quadraticCurveTo(hx + k.r * s, hy + k.r * s, hx + k.r * s, hy - 2);
      ctx.lineTo(hx + k.r * s * 0.5, hy - k.r * s * 0.6); ctx.lineTo(hx, hy - 1);
      ctx.lineTo(hx - k.r * s * 0.5, hy - k.r * s * 0.6); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (k.kind === 'bell') {
      ctx.fillStyle = k.petal;
      ctx.beginPath();
      ctx.moveTo(hx - k.r * s, hy + k.r * s);
      ctx.quadraticCurveTo(hx - k.r * s * 0.8, hy - k.r * s, hx, hy - k.r * s);
      ctx.quadraticCurveTo(hx + k.r * s * 0.8, hy - k.r * s, hx + k.r * s, hy + k.r * s);
      ctx.quadraticCurveTo(hx, hy + k.r * s * 0.5, hx - k.r * s, hy + k.r * s);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = k.petal;
      const spin = Math.sin(t * 0.01 + f.ph) * 0.2;
      for (let i = 0; i < k.n; i++) {
        const a = spin + i * TAU / k.n;
        ctx.beginPath();
        ctx.ellipse(hx + Math.cos(a) * k.r * s, hy + Math.sin(a) * k.r * s, k.r * s * 0.7, k.r * s * 0.42, a, 0, TAU);
        ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = k.center;
      ctx.beginPath(); ctx.arc(hx, hy, k.r * s * 0.55, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }

  function drawMeadow(ctx, pr, cam, t) {
    if (!pr._meadow) pr._meadow = buildMeadow(pr);
    const m = pr._meadow;
    const gy = pr.y - cam.y;
    const vw = ctx.canvas ? ctx.canvas.width : 2000;
    const minX = cam.x - 30, maxX = cam.x + vw + 30;
    if (pr.x + pr.w < minX || pr.x > maxX) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Mancha de pasto más claro bajo el prado
    ctx.fillStyle = 'rgba(140, 190, 90, 0.35)';
    ctx.beginPath(); ctx.ellipse(pr.x + pr.w / 2 - cam.x, gy + 2, pr.w / 2, 9, 0, 0, TAU); ctx.fill();
    // Pasto
    ctx.lineWidth = 1.6;
    for (const gr of m.grass) {
      if (gr.x < minX || gr.x > maxX) continue;
      const x = gr.x - cam.x, s = Math.sin(t * 0.035 + gr.ph) * 2.5;
      ctx.strokeStyle = gr.c;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.quadraticCurveTo(x + s * 0.4, gy - gr.h / 2, x + s, gy - gr.h); ctx.stroke();
    }
    // Flores
    for (const f of m.list) {
      if (f.x < minX || f.x > maxX) continue;
      drawFlower(ctx, f, f.x - cam.x, gy, t);
    }
    // Mariposas
    for (const b of m.flies) {
      const bx = b.cx + Math.sin(t * 0.011 + b.ph) * 120 - cam.x;
      const by = gy - 60 - Math.sin(t * 0.023 + b.ph * 2) * 22;
      const flap = Math.abs(Math.sin(t * 0.32 + b.ph));
      ink(ctx, 1.2);
      ctx.fillStyle = b.c;
      ctx.beginPath(); ctx.ellipse(bx - 4, by, 5 * flap + 0.8, 4, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(bx + 4, by, 5 * flap + 0.8, 4, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.ellipse(bx, by, 1.4, 4, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawProps(ctx, room, cam, t) {
    if (!room.props) return;
    for (const pr of room.props) {
      if (pr.type === 'flower-meadow') drawMeadow(ctx, pr, cam, t);
      else if (pr.type === 'master-house') drawHouse(ctx, pr, cam, t);
      else if (pr.type === 'water-wheel') drawWaterWheel(ctx, pr, cam, t);
    }
  }

  function install(g) {
    window.GameHooks.onBeforeUpdate.push((game, running) => { if (running) clock.t++; });
    const draw = (ctx, cam) => {
      try { const room = g.world && g.world.getCurrentRoom(); if (room) drawProps(ctx, room, cam, clock.t); } catch (e) { console.error('[Hogar del Maestro]', e); }
    };
    const AR = window.AnimationRegistry || window.AnimSystem;
    if (AR && AR.registerLayer) AR.registerLayer('world', 'master-home', { order: 48, after(world, ctx, cam) { draw(ctx, cam); } });
    else window.GameHooks.onRenderWorld.push((game, ctx, cam) => draw(ctx, cam));
  }

  window.GameHooks = window.GameHooks || {};
  window.GameHooks.onInit = window.GameHooks.onInit || [];
  window.GameHooks.onBeforeUpdate = window.GameHooks.onBeforeUpdate || [];
  window.GameHooks.onRenderWorld = window.GameHooks.onRenderWorld || [];
  window.GameHooks.onInit.push(install);
})();
