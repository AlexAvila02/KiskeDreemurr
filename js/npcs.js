/**
 * Personajes no jugables (NPC) - Ruben: En Busca de Angelo (Claude)
 *
 * Una sala declara sus NPC con `npcs: [{ id, name, x, y, facing, lines: [...], farewell }]`
 * (x = centro, y = altura de los pies). Al acercarse aparece una burbuja con la tecla de
 * Interactuar; cada pulsación muestra la siguiente línea en el cuadro de diálogo de siempre.
 * Al terminar repite la despedida. Alejarse cierra el diálogo (como las notas de Angelo).
 *
 * Integración (sin editar main.js): envuelve game.doAction, game.updateNearbyNote y
 * game.update; dibuja en GameHooks.onRenderWorld. Sin basura por cuadro en el dibujo.
 *
 * API: window.NPCs.getNear() → NPC cercano o null
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const TALK_DIST_X = 52;
  const TALK_DIST_Y = 56;
  const state = { near: null, talkT: 0, t: 0 };

  function roomNpcs(g) {
    const room = g.world && g.world.getCurrentRoom();
    return (room && room.npcs) || null;
  }

  function findNear(g) {
    const list = roomNpcs(g);
    if (!list || g.player.dead) return null;
    const px = g.player.x + g.player.width / 2;
    const py = g.player.y + g.player.height / 2;
    for (const n of list) {
      if (Math.abs(px - n.x) < TALK_DIST_X && Math.abs(py - (n.y - 22)) < TALK_DIST_Y) return n;
    }
    return null;
  }

  function talk(g, n) {
    if (n.lineIdx === undefined) n.lineIdx = 0;
    // Si ya enseñó su habilidad (de otra partida guardada), salta directo a la despedida
    if (n.teaches === 'water' && window.WaterControl && window.WaterControl.isLearned() && n.lineIdx === 0) {
      n.lineIdx = n.lines.length;
    }
    let text;
    if (n.lineIdx < n.lines.length) {
      text = n.lines[n.lineIdx];
      n.lineIdx++;
      if (n.lineIdx < n.lines.length) text += '  ▸';
    } else {
      const room = g.world.getCurrentRoom();
      text = (n.farewellDone && room && room.waterBellsDone) ? n.farewellDone : (n.farewell || n.lines[n.lines.length - 1]);
    }
    g.activeNote = n;
    g.showDialog(n.name, text, true);
    state.talkT = 70; // cuadros moviendo la boca
    // Al terminar sus líneas, el maestro enseña su habilidad
    if (n.lineIdx >= n.lines.length && n.teaches === 'water' && window.WaterControl) {
      window.WaterControl.learn(g);
    }
  }

  // ---------------- dibujo (Maestro del Agua, estilo años 50) ----------------
  // Anciano de túnica turquesa con olas en el ruedo, cabeza calva, cejas y bigote blancos
  // largos que flotan, y un orbe de agua que gira sobre su palma con gotitas en órbita.
  function drawWaterMaster(ctx, n, cam, t, talking, lookDir) {
    const x = n.x - cam.x, fy = n.y - cam.y;
    const f = lookDir;
    const breathe = Math.sin(t * 0.04) * 0.025;
    const bob = talking ? Math.abs(Math.sin(t * 0.35)) * 1.5 : 0;
    const blink = (t % 240) < 7;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Sombra
    ctx.fillStyle = 'rgba(40, 22, 10, 0.22)';
    ctx.beginPath(); ctx.ellipse(x, fy + 1, 17, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.translate(x, fy);
    ctx.scale(1 - breathe * 0.5, 1 + breathe);
    ctx.translate(-x, -fy - bob);

    // Sandalias
    ctx.fillStyle = '#8a5a35';
    ctx.beginPath(); ctx.ellipse(x - 6, fy - 2.5, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 6, fy - 2.5, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Túnica larga turquesa (campana)
    ctx.fillStyle = '#3f8a8f';
    ctx.beginPath();
    ctx.moveTo(x - 8, fy - 38);
    ctx.quadraticCurveTo(x - 19, fy - 10, x - 17, fy - 5);
    ctx.lineTo(x + 17, fy - 5);
    ctx.quadraticCurveTo(x + 19, fy - 10, x + 8, fy - 38);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Olas blancas en el ruedo
    ctx.strokeStyle = '#e6f7f5'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const wx = x - 13 + i * 8.5, wy = fy - 9 + Math.sin(t * 0.08 + i) * 0.6;
      ctx.moveTo(wx - 3.5, wy); ctx.quadraticCurveTo(wx, wy - 4, wx + 3.5, wy);
    }
    ctx.stroke();
    // Faja azul oscuro
    ctx.strokeStyle = '#21545e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 12, fy - 22); ctx.lineTo(x + 12, fy - 22); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;

    // Brazo extendido con la palma hacia arriba
    const hx = x + f * 17, hy = fy - 27;
    ctx.strokeStyle = OUT; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x + f * 6, fy - 31); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = '#3f8a8f'; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(x + f * 6, fy - 31); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.fillStyle = '#e8bf95';
    ctx.beginPath(); ctx.ellipse(hx + f * 2, hy - 1, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Orbe de agua flotando sobre la palma, con gotitas en órbita
    const ox = hx + f * 2, oy = hy - 14 + Math.sin(t * 0.06) * 2.5;
    const og = ctx.createRadialGradient(ox - 2, oy - 2, 1, ox, oy, 7.5);
    og.addColorStop(0, 'rgba(240, 253, 255, 0.95)');
    og.addColorStop(1, 'rgba(70, 150, 175, 0.9)');
    ctx.fillStyle = og;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(ox, oy, 7 + Math.sin(t * 0.2) * 0.6, 7 - Math.sin(t * 0.2) * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath(); ctx.ellipse(ox - 2.5, oy - 3, 2, 1.1, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9fdcef';
    for (let i = 0; i < 3; i++) {
      const a = t * 0.07 + i * 2.094;
      ctx.beginPath(); ctx.arc(ox + Math.cos(a) * 12, oy + Math.sin(a) * 4, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;

    // Cabeza calva
    const cx = x + f * 1.5, cy = fy - 47;
    ctx.fillStyle = '#e8bf95';
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Brillo en la calva
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath(); ctx.ellipse(cx - f * 3, cy - 6, 3, 1.6, -0.4 * f, 0, Math.PI * 2); ctx.fill();
    // Rodete de pelo blanco atrás
    ctx.fillStyle = '#f6efe0';
    ctx.beginPath(); ctx.arc(cx - f * 9, cy + 1, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Ojos (parpadean)
    ctx.fillStyle = OUT;
    for (const k of [-1, 1]) {
      const ex = cx + f * 2 + k * 4, ey = cy - 1;
      if (blink || talking && (t % 90) < 4) { ctx.beginPath(); ctx.moveTo(ex - 1.6, ey); ctx.lineTo(ex + 1.6, ey); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex + f * 0.6, ey, 1.3, 0, Math.PI * 2); ctx.fill(); }
    }
    // Cejas blancas largas que caen y se mecen
    ctx.strokeStyle = '#f6efe0'; ctx.lineWidth = 2.4;
    const sway = Math.sin(t * 0.05) * 1.5;
    ctx.beginPath(); ctx.moveTo(cx + f * 2 - 6, cy - 4.5); ctx.quadraticCurveTo(cx + f * 2 - 12, cy - 4, cx + f * 2 - 14, cy + 2 + sway); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + f * 2 + 6, cy - 4.5); ctx.quadraticCurveTo(cx + f * 2 + 12, cy - 4, cx + f * 2 + 14, cy + 2 - sway); ctx.stroke();
    // Bigote largo que cuelga como dos chorritos de agua
    const mouth = talking && state.talkT > 0 ? (0.5 + 0.5 * Math.sin(t * 0.6)) : 0;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx + f * 3, cy + 4); ctx.quadraticCurveTo(cx + f * 3 - 7, cy + 6, cx + f * 3 - 9, cy + 17 + sway); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + f * 3, cy + 4); ctx.quadraticCurveTo(cx + f * 3 + 7, cy + 6, cx + f * 3 + 9, cy + 17 - sway); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    if (mouth > 0.15) {
      ctx.fillStyle = '#5a2418';
      ctx.beginPath(); ctx.ellipse(cx + f * 3, cy + 7, 2.4, 0.8 + mouth * 1.8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Nariz
    ctx.fillStyle = '#d99a7a';
    ctx.beginPath(); ctx.arc(cx + f * 6, cy + 2, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---------------- dibujo (viejo pastor, estilo años 50) ----------------
  function drawShepherd(ctx, n, cam, t, talking, lookDir) {
    const x = n.x - cam.x, fy = n.y - cam.y;
    const f = lookDir;
    const breathe = Math.sin(t * 0.045) * 0.025;
    const bob = talking ? Math.abs(Math.sin(t * 0.35)) * 1.5 : 0;
    const blink = (t % 210) < 7;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Sombra
    ctx.fillStyle = 'rgba(40, 22, 10, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, fy + 1, 16, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;

    // Cayado (detrás del cuerpo, del lado hacia donde mira)
    const sx = x + f * 15;
    ctx.strokeStyle = OUT; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(sx, fy); ctx.lineTo(sx, fy - 50); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx - f * 6, fy - 50, 6, 0, Math.PI, f > 0); ctx.stroke();
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx, fy); ctx.lineTo(sx, fy - 50); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx - f * 6, fy - 50, 6, 0, Math.PI, f > 0); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;

    // Respiración: escala desde los pies
    ctx.translate(x, fy);
    ctx.scale(1 - breathe * 0.5, 1 + breathe);
    ctx.translate(-x, -fy - bob);

    // Botas
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath(); ctx.ellipse(x - 6, fy - 3, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 6, fy - 3, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Capa / túnica de lana (pera ancha)
    ctx.fillStyle = '#7a5a3a';
    ctx.beginPath();
    ctx.moveTo(x - 8, fy - 34);
    ctx.quadraticCurveTo(x - 17, fy - 8, x - 14, fy - 5);
    ctx.lineTo(x + 14, fy - 5);
    ctx.quadraticCurveTo(x + 17, fy - 8, x + 8, fy - 34);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Ribete de lana clara en el ruedo
    ctx.fillStyle = '#efe4cc';
    ctx.beginPath();
    ctx.roundRect(x - 15, fy - 9, 30, 5, 2.5);
    ctx.fill(); ctx.stroke();
    // Cinturón de cuerda
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 11, fy - 20); ctx.lineTo(x + 11, fy - 20); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;

    // Mano sobre el cayado
    ctx.fillStyle = '#f0c49a';
    ctx.beginPath(); ctx.arc(x + f * 13, fy - 26, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Cabeza
    const hx = x + f * 1.5, hy = fy - 43;
    ctx.fillStyle = '#f0c49a';
    ctx.beginPath(); ctx.arc(hx, hy, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Barba blanca grande (se abre al hablar)
    const mouth = talking && state.talkT > 0 ? (0.5 + 0.5 * Math.sin(t * 0.6)) : 0;
    ctx.fillStyle = '#f6efe0';
    ctx.beginPath();
    ctx.moveTo(hx - 9, hy + 1);
    ctx.quadraticCurveTo(hx - 10, hy + 14 + Math.sin(t * 0.04) * 1, hx + f * 2, hy + 18);
    ctx.quadraticCurveTo(hx + 10, hy + 14, hx + 9, hy + 1);
    ctx.quadraticCurveTo(hx, hy + 5, hx - 9, hy + 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (mouth > 0.15) {
      ctx.fillStyle = '#5a2418';
      ctx.beginPath(); ctx.ellipse(hx + f * 2, hy + 7, 2.6, 1 + mouth * 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Bigote
    ctx.fillStyle = '#f6efe0';
    ctx.beginPath(); ctx.ellipse(hx + f * 2 - 3.5, hy + 3.5, 4, 2.2, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + f * 2 + 3.5, hy + 3.5, 4, 2.2, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Nariz redonda
    ctx.fillStyle = '#e0957a';
    ctx.beginPath(); ctx.arc(hx + f * 4, hy + 0.5, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Ojos (parpadean) y cejas pobladas
    ctx.fillStyle = OUT;
    for (const k of [-1, 1]) {
      const ex = hx + f * 2 + k * 3.8, ey = hy - 3;
      if (blink) { ctx.beginPath(); ctx.moveTo(ex - 1.6, ey); ctx.lineTo(ex + 1.6, ey); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex + f * 0.6, ey, 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.strokeStyle = '#f6efe0'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(hx + f * 2 - 6, hy - 6.5); ctx.lineTo(hx + f * 2 - 1.5, hy - 5.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + f * 2 + 1.5, hy - 5.5); ctx.lineTo(hx + f * 2 + 6, hy - 6.5); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;

    // Sombrero de paja de ala ancha
    ctx.fillStyle = '#c9a24a';
    ctx.beginPath(); ctx.ellipse(hx, hy - 8, 16, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy - 9);
    ctx.quadraticCurveTo(hx - 8, hy - 19, hx, hy - 19);
    ctx.quadraticCurveTo(hx + 8, hy - 19, hx + 8, hy - 9);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#8c412b'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(hx - 7.5, hy - 11); ctx.lineTo(hx + 7.5, hy - 11); ctx.stroke();

    ctx.restore();
  }

  // ---------------- decorados (room.props): cabaña y ovejas ----------------
  // Cabaña del pastor: troncos, techo de paja redondeado, chimenea con humo, ventana
  // redonda con luz cálida, puerta de arco, farol, banco y macetas. x = centro, y = suelo.
  function drawCabin(ctx, pr, cam, t) {
    const x = pr.x - cam.x, gy = pr.y - cam.y;
    const W = 170, H = 92;                     // paredes
    const L = x - W / 2, R = x + W / 2, top = gy - H;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.2;

    // Sombra en el pasto
    ctx.fillStyle = 'rgba(40, 22, 10, 0.25)';
    ctx.beginPath(); ctx.ellipse(x, gy + 1, W * 0.62, 6, 0, 0, Math.PI * 2); ctx.fill();

    // Chimenea de piedra (detrás del techo)
    const cx0 = x + 38;
    ctx.fillStyle = '#9a8a78';
    ctx.beginPath(); ctx.roundRect(cx0, top - 62, 24, 50, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.45)'; ctx.lineWidth = 1.2;
    for (let r = 0; r < 4; r++) {
      const yy = top - 52 + r * 11;
      ctx.beginPath(); ctx.moveTo(cx0 + 2, yy); ctx.lineTo(cx0 + 22, yy); ctx.stroke();
      const off = r % 2 ? 8 : 15;
      ctx.beginPath(); ctx.moveTo(cx0 + off, yy); ctx.lineTo(cx0 + off, yy + 11); ctx.stroke();
    }
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
    ctx.fillStyle = '#7d6e60';
    ctx.beginPath(); ctx.roundRect(cx0 - 3, top - 66, 30, 7, 2); ctx.fill(); ctx.stroke();

    // Humo: bocanadas que suben, crecen y se desvanecen (bucle continuo)
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.006) + i / 4) % 1;
      // Con brisa, el humo se inclina hacia la derecha
      const sx = cx0 + 12 + Math.sin(k * 6 + i) * 6 + k * (18 + breeze.level * breeze.gust * 55);
      const sy = top - 70 - k * 70;
      ctx.globalAlpha = (1 - k) * 0.55;
      ctx.fillStyle = '#efe6d8';
      ctx.beginPath(); ctx.arc(sx, sy, 5 + k * 9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Paredes de troncos
    ctx.fillStyle = '#8a5a35';
    ctx.beginPath(); ctx.roundRect(L, top, W, H, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.55)'; ctx.lineWidth = 1.4;
    for (let r = 1; r < 6; r++) {
      const yy = top + r * (H / 6);
      ctx.beginPath(); ctx.moveTo(L + 3, yy); ctx.quadraticCurveTo(x, yy + 2, R - 3, yy); ctx.stroke();
    }
    // Puntas de los troncos en las esquinas
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    ctx.fillStyle = '#b07a4a';
    for (let r = 0; r < 6; r++) {
      const yy = top + r * (H / 6) + H / 12;
      ctx.beginPath(); ctx.arc(L, yy, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(R, yy, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.lineWidth = 2.2;

    // Techo de paja redondeado con alero
    ctx.fillStyle = '#d4a94e';
    ctx.beginPath();
    ctx.moveTo(L - 22, top + 10);
    ctx.quadraticCurveTo(L - 4, top - 44, x, top - 58);
    ctx.quadraticCurveTo(R + 4, top - 44, R + 22, top + 10);
    ctx.quadraticCurveTo(x, top + 22, L - 22, top + 10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Mechones de paja
    ctx.strokeStyle = 'rgba(122, 82, 30, 0.6)'; ctx.lineWidth = 1.3;
    for (let i = 0; i < 11; i++) {
      const u = (i + 0.5) / 11;
      const bx = L - 18 + u * (W + 36);
      const by = top + 10 + Math.sin(u * Math.PI) * 10;
      ctx.beginPath(); ctx.moveTo(bx, by - 2); ctx.lineTo(bx + (u - 0.5) * 10, by - 26 - Math.sin(u * Math.PI) * 18); ctx.stroke();
    }
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;

    // Ventana redonda con luz cálida (con cruz de madera)
    const wx = x - 48, wy = top + 40;
    const glow = ctx.createRadialGradient(wx, wy, 2, wx, wy, 30);
    glow.addColorStop(0, 'rgba(255, 214, 120, 0.45)');
    glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(wx, wy, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd77a';
    ctx.beginPath(); ctx.arc(wx, wy, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx - 13, wy); ctx.lineTo(wx + 13, wy); ctx.moveTo(wx, wy - 13); ctx.lineTo(wx, wy + 13); ctx.stroke();
    // Maceta con flores bajo la ventana
    ctx.fillStyle = '#b5562b';
    ctx.beginPath(); ctx.roundRect(wx - 14, wy + 17, 28, 8, 2); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#f2d29b' : '#e2705a';
      ctx.beginPath(); ctx.arc(wx - 9 + i * 6, wy + 14 + Math.sin(t * 0.05 + i) * 0.6, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Puerta de arco
    const dx = x + 2, dw = 34, dh = 56;
    ctx.fillStyle = '#5c3a20';
    ctx.beginPath();
    ctx.moveTo(dx - dw / 2, gy);
    ctx.lineTo(dx - dw / 2, gy - dh + dw / 2);
    ctx.arc(dx, gy - dh + dw / 2, dw / 2, Math.PI, 0);
    ctx.lineTo(dx + dw / 2, gy);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 220, 160, 0.25)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(dx - 6, gy - 2); ctx.lineTo(dx - 6, gy - dh + 12); ctx.moveTo(dx + 6, gy - 2); ctx.lineTo(dx + 6, gy - dh + 12); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
    ctx.fillStyle = '#d9a634';
    ctx.beginPath(); ctx.arc(dx + 10, gy - 26, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Farol colgando junto a la puerta (se mece y brilla)
    const lx = dx + 30, ly = top + 26;
    const sway = Math.sin(t * 0.04) * 0.12;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(sway);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 0); ctx.stroke();
    const lg = ctx.createRadialGradient(0, 8, 1, 0, 8, 22);
    lg.addColorStop(0, 'rgba(255, 210, 110, 0.5)');
    lg.addColorStop(1, 'rgba(255, 210, 110, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(0, 8, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect(-5, 1, 10, 13, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(lx - 10, ly - 8); ctx.lineTo(lx, ly - 8); ctx.stroke();

    // Banco de madera a la derecha
    ctx.fillStyle = '#a06a3c';
    ctx.beginPath(); ctx.roundRect(R + 8, gy - 16, 40, 6, 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R + 13, gy - 10); ctx.lineTo(R + 13, gy); ctx.moveTo(R + 43, gy - 10); ctx.lineTo(R + 43, gy); ctx.stroke();

    // Leña apilada a la izquierda
    ctx.fillStyle = '#b07a4a';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(L - 14 + i * 9, gy - 6, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(L - 9.5, gy - 14, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(L - 0.5, gy - 14, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.restore();
  }

  // Oveja de lana redonda que pasta yendo y viniendo despacio
  function drawSheep(ctx, pr, cam, t) {
    if (pr._t0 === undefined) pr._t0 = (pr.x * 7.3) % 1000;   // desfase fijo por oveja
    const k = t + pr._t0;
    // Va y viene por su zona (posición derivada del tiempo de juego, sin estado):
    // en los extremos frena y se queda pastando antes de dar la vuelta
    const ph = k * 0.0035;
    const vel = Math.cos(ph);
    const walking = Math.abs(vel) > 0.35;
    const s = pr.small ? 0.75 : 1;
    const f = (vel >= 0 ? 1 : -1) * (pr.facing || 1);
    const x = pr.x + (pr.range || 50) * Math.sin(ph) * (pr.facing || 1) - cam.x, gy = pr.y - cam.y;
    const step = walking ? Math.sin(k * 0.2) : 0;
    const graze = walking ? 0 : (0.5 + 0.5 * Math.sin(k * 0.05));
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    // Sombra
    ctx.fillStyle = 'rgba(40, 22, 10, 0.2)';
    ctx.beginPath(); ctx.ellipse(x, gy + 1, 16 * s, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    // Patitas
    ctx.lineWidth = 3;
    for (const p of [-9, -3, 4, 10]) {
      const lift = (p < 0 ? step : -step) * 1.5;
      ctx.beginPath(); ctx.moveTo(x + p * s, gy - 9 * s); ctx.lineTo(x + p * s + lift * 0.5, gy - Math.max(0, lift)); ctx.stroke();
    }
    ctx.lineWidth = 2;
    // Cuerpo de lana (nube de bolitas)
    const by = gy - 16 * s - Math.abs(step) * 0.8;
    ctx.fillStyle = '#f6f0e2';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.moveTo(x + Math.cos(a) * 11 * s + 6 * s, by + Math.sin(a) * 6 * s);
      ctx.arc(x + Math.cos(a) * 11 * s, by + Math.sin(a) * 6 * s, 6 * s, 0, Math.PI * 2);
    }
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, by, 13 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    // Cabeza oscura (baja a pastar)
    const hx = x + f * 15 * s, hy = by - 2 * s + graze * 9 * s;
    ctx.fillStyle = '#4a3528';
    ctx.beginPath(); ctx.ellipse(hx, hy, 5.5 * s, 7 * s, f * 0.5 + graze * f * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx - f * 4 * s, hy - 4 * s, 3 * s, 1.6 * s, f * -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(hx + f * 1.5 * s, hy - 1.5 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
    // Copete de lana
    ctx.fillStyle = '#f6f0e2';
    ctx.beginPath(); ctx.arc(hx - f * 1 * s, hy - 6 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawProps(ctx, room, cam, t) {
    if (!room.props) return;
    for (const pr of room.props) {
      if (pr.type === 'cabin') drawCabin(ctx, pr, cam, t);
      else if (pr.type === 'sheep') drawSheep(ctx, pr, cam, t);
    }
  }

  // Burbuja "E · Hablar" sobre la cabeza
  function drawPrompt(ctx, g, n, cam, t) {
    const cm = g.controlsManager;
    const key = cm && cm.getPrimaryDisplayKey ? cm.getPrimaryDisplayKey('interact') : 'E';
    drawBubble(ctx, `${key} · Hablar`, n.x - cam.x, n.y - cam.y - 78 + Math.sin(t * 0.08) * 2);
  }

  // Cápsula oscura con borde mostaza (mismo estilo que los avisos) centrada en (x, y)
  function drawBubble(ctx, label, x, y) {
    ctx.save();
    ctx.font = 'bold 11px Georgia, serif';
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(48, 30, 18, 0.92)';
    ctx.strokeStyle = '#d9a634';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 10, w, 20, 10);
    ctx.fill(); ctx.stroke();
    // Piquito de la burbuja
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 10); ctx.lineTo(x, y + 15); ctx.lineTo(x + 4, y + 10);
    ctx.fill();
    ctx.fillStyle = '#fff2d0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 0.5);
    ctx.restore();
  }

  function render(g, ctx, cam) {
    const room = g.world && g.world.getCurrentRoom();
    if (!room) return;
    drawProps(ctx, room, cam, state.t);
    const list = room.npcs;
    if (!list) return;
    const px = g.player.x + g.player.width / 2;
    for (const n of list) {
      const talking = g.activeNote === n;
      const look = Math.abs(px - n.x) < 260 ? (px >= n.x ? 1 : -1) : (n.facing || 1);
      if (n.look === 'water-master') drawWaterMaster(ctx, n, cam, state.t, talking, look);
      else drawShepherd(ctx, n, cam, state.t, talking, look);
      if (state.near === n && !talking) drawPrompt(ctx, g, n, cam, state.t);
    }
  }

  // ---------------- notas de Angelo: cartel "↑ Leer" ----------------
  // Al pararse sobre una nota aparece el cartel; SOLO con ARRIBA (W/↑, stick o cruceta)
  // se abre el texto (nunca se abre sola ni con Interactuar). Alejarse lo cierra. Al abrirse se asigna
  // game.activeNote = nota, que es lo que usan el Diario (notas leídas) y el desbloqueo
  // de "Jalar el Aire".
  const notes = { near: null, prevUp: false };

  function findNearTablet(g) {
    const room = g.world && g.world.getCurrentRoom();
    if (!room || !room.tablets || g.player.dead) return null;
    const px = g.player.x + g.player.width / 2;
    const py = g.player.y + g.player.height / 2;
    for (const tab of room.tablets) {
      if (Math.abs(px - (tab.x + 11)) < 38 && Math.abs(py - (tab.y + 17)) < 46) return tab;
    }
    return null;
  }

  function readNote(g, tab) {
    if (g.activeNote === tab) {
      // Ya abierta: un toque completa el texto que se está escribiendo
      if (g.dialogTyping && g.finishTyping) g.finishTyping();
      return;
    }
    g.activeNote = tab;
    g.showDialog(tab.speaker, tab.text, true);
  }

  function notesStep(g) {
    notes.near = findNearTablet(g);
    const cm = g.controlsManager;
    const up = !!((cm && cm.isActive && cm.isActive('aimUp', g.keys)) || g.keys.PadUp ||
      (!cm && (g.keys.KeyW || g.keys.ArrowUp)));
    if (up && !notes.prevUp && notes.near && g.deathTimer <= 0) readNote(g, notes.near);
    notes.prevUp = up;
  }

  function notesRender(g, ctx, cam) {
    const tab = notes.near;
    if (!tab || g.activeNote === tab || !g.isPlaying) return;
    drawBubble(ctx, '↑ Leer', tab.x + 11 - cam.x, tab.y - cam.y - 36 + Math.sin(state.t * 0.08) * 2);
  }

  // ---------------- brisa ambiental (room.ambience === 'breeze') ----------------
  // Corrientes de aire finas y pétalos/briznas que cruzan la pantalla de izquierda a
  // derecha, más un susurro de viento con ráfagas suaves. Pools fijos (sin basura).
  const breeze = { level: 0, gust: 0, t: 0 };
  const BREEZE_STREAKS = [];
  for (let i = 0; i < 16; i++) {
    BREEZE_STREAKS.push({ x: Math.random() * 1100, y: 60 + Math.random() * 400, sp: 0.6 + Math.random() * 0.7, len: 26 + Math.random() * 40, ph: Math.random() * 6.28, par: 0.4 + Math.random() * 0.5 });
  }
  const BREEZE_BITS = [];
  for (let i = 0; i < 10; i++) {
    BREEZE_BITS.push({ x: Math.random() * 1100, y: 120 + Math.random() * 340, sp: 0.8 + Math.random() * 0.8, rot: Math.random() * 6.28, c: i % 3, ph: Math.random() * 6.28 });
  }
  const BREEZE_COLS = ['#f2d29b', '#e2705a', '#a5b84d'];
  const bAudio = { src: null, gain: null, filter: null, buffer: null };

  function breezeStart() {
    const sm = window.soundManager;
    if (!sm || !sm.ctx || sm.isMuted || bAudio.src) return;
    const ac = sm.ctx;
    try {
      if (!bAudio.buffer) {
        // Ruido "rosado" suave (2 s en bucle)
        const len = ac.sampleRate * 2;
        bAudio.buffer = ac.createBuffer(1, len, ac.sampleRate);
        const d = bAudio.buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
          d[i] = (b0 + b1 + b2) * 0.9;
        }
        // Fundido en las puntas del bucle para que no haga "clic"
        const fade = 2000;
        for (let i = 0; i < fade; i++) { const k = i / fade; d[i] *= k; d[len - 1 - i] *= k; }
      }
      const src = ac.createBufferSource();
      src.buffer = bAudio.buffer;
      src.loop = true;
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      filter.Q.value = 0.7;
      const gain = ac.createGain();
      gain.gain.value = 0;
      src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
      src.start();
      bAudio.src = src; bAudio.gain = gain; bAudio.filter = filter;
    } catch (e) { bAudio.src = null; }
  }
  function breezeStop() {
    if (!bAudio.src) return;
    const ac = window.soundManager.ctx;
    const src = bAudio.src, gain = bAudio.gain;
    bAudio.src = null;
    try {
      gain.gain.setTargetAtTime(0, ac.currentTime, 0.25);
      src.stop(ac.currentTime + 1.2);
    } catch (e) { /* */ }
  }

  // running = juego activo. En pausa / Diario el sonido sigue (con sus ráfagas) porque
  // sigue siendo la sala donde está Ruben; solo se congelan las corrientes y pétalos.
  // Al volver al menú principal (isPlaying = false) se apaga.
  function breezeStep(g, running) {
    if (!g.isPlaying) { breeze.level = 0; breezeStop(); return; }
    const room = g.world && g.world.getCurrentRoom();
    const want = room && room.ambience === 'breeze' && !g.player.dead;
    // Entra y sale con fundido (~1 s)
    breeze.level += ((want ? 1 : 0) - breeze.level) * 0.03;
    if (breeze.level < 0.005 && !want) breeze.level = 0;
    breeze.t++;
    // Ráfagas: suma de senos lentos (nunca se apaga del todo: brisa leve y constante)
    const t = breeze.t;
    breeze.gust = 0.45 + 0.3 * Math.sin(t * 0.011) + 0.15 * Math.sin(t * 0.027 + 1.3) + 0.1 * Math.sin(t * 0.063 + 0.5);
    if (breeze.level > 0.01) breezeStart(); else breezeStop();
    if (bAudio.src) {
      const ac = window.soundManager.ctx;
      const now = ac.currentTime;
      if (window.soundManager.isMuted) { breezeStop(); return; }
      bAudio.gain.gain.setTargetAtTime(0.055 * breeze.level * (0.5 + breeze.gust), now, 0.3);
      bAudio.filter.frequency.setTargetAtTime(320 + breeze.gust * 520, now, 0.4);
    }
    if (!running) return; // en pausa: suena, pero no se mueve nada en pantalla
    // Avance de corrientes y briznas (en pantalla, con un poco de paralaje)
    const push = 0.6 + breeze.gust * 1.6;
    for (const s of BREEZE_STREAKS) {
      s.x += s.sp * push;
      if (s.x > 1080) { s.x = -80 - Math.random() * 120; s.y = 60 + Math.random() * 400; }
    }
    for (const b of BREEZE_BITS) {
      b.x += b.sp * push * 1.2;
      b.y += Math.sin(t * 0.03 + b.ph) * 0.35;
      b.rot += 0.04 + breeze.gust * 0.06;
      if (b.x > 1080) { b.x = -40 - Math.random() * 200; b.y = 120 + Math.random() * 340; }
    }
  }

  function breezeRender(g, ctx, cam) {
    const lv = breeze.level;
    if (lv <= 0.01) return;
    const t = breeze.t;
    ctx.save();
    ctx.lineCap = 'round';
    // Corrientes: trazos finos y ondulados, casi transparentes
    ctx.strokeStyle = '#fff6e4';
    for (const s of BREEZE_STREAKS) {
      const x = s.x;                                // corren en coordenadas de pantalla
      const y = s.y + Math.sin(t * 0.02 + s.ph) * 6;
      const a = lv * (0.17 + breeze.gust * 0.22) * Math.sin(Math.min(1, Math.max(0, (x + 80) / 1160)) * Math.PI);
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      ctx.lineWidth = 1.2 + s.par;
      const L = s.len * (0.7 + breeze.gust * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + L * 0.3, y - 4, x + L * 0.6, y + 4, x + L, y - 1);
      ctx.stroke();
    }
    // Briznas y pétalos que vuelan
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 0.8;
    for (const b of BREEZE_BITS) {
      ctx.globalAlpha = lv * 0.85;
      ctx.fillStyle = BREEZE_COLS[b.c];
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 3.2, 1.5, b.rot, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function install(g) {
    const origDoAction = g.doAction.bind(g);
    g.doAction = (action) => {
      if (action === 'interact' && state.near && g.isPlaying && !g.isPaused && g.deathTimer <= 0) {
        // Con el texto escribiéndose, el primer toque lo completa (comportamiento de siempre)
        if (g.dialogTyping && !g.dialogBox.classList.contains('hidden')) return origDoAction(action);
        talk(g, state.near);
        return;
      }
      origDoAction(action);
    };

    // Reemplaza la lectura automática de notas de main.js:
    //  - el diálogo del NPC no se cierra mientras Ruben siga al lado
    //  - sobre una nota NO se abre sola (solo el cartel); si ya está abierta, se mantiene
    //  - lejos de toda nota, main.js hace lo de siempre (cerrar textos / mensaje del portón)
    const origNearby = g.updateNearbyNote.bind(g);
    g.updateNearbyNote = () => {
      if (g.activeNote && g.activeNote.lines && g.activeNote === state.near) return;
      const tab = notes.near;
      if (tab) {
        if (g.activeNote === tab) return;
        // Pasó de una nota a otra (o de un NPC a una nota): cerrar el texto anterior
        const room = g.world.getCurrentRoom();
        if (g.activeNote && g.activeNote !== room.door) { g.activeNote = null; g.hideDialog(); }
        return;
      }
      origNearby();
    };

    const origUpdate = g.update.bind(g);
    g.update = (dt) => {
      const running = g.isPlaying && !g.isPaused;
      if (running) {
        state.t++;
        if (state.talkT > 0) state.talkT--;
        state.near = findNear(g);
        try { notesStep(g); } catch (e) { console.error('[Notas]', e); }
      }
      try { breezeStep(g, running); } catch (e) { console.error('[Brisa]', e); }
      origUpdate(dt);
    };

    // La brisa va por delante de todo (aire entre la cámara y la escena)
    window.GameHooks.onRenderWorld.push((game, ctx, cam) => {
      try { breezeRender(game, ctx, cam); } catch (e) { console.error('[Brisa]', e); }
      try { notesRender(game, ctx, cam); } catch (e) { console.error('[Notas]', e); }
    });

    const origLoad = g.loadRoom.bind(g);
    g.loadRoom = (index, sx = null, sy = null) => {
      state.near = null;
      notes.near = null;
      origLoad(index, sx, sy);
    };

    // Decorados y NPC van DETRÁS de Ruben, enemigos y piedras: se dibujan justo después
    // de las plataformas (capa 'world' de AnimationRegistry). Si no existe, encima (respaldo).
    const AR = window.AnimationRegistry || window.AnimSystem;
    if (AR && AR.registerLayer) {
      AR.registerLayer('world', 'npcs-and-props', {
        order: 50,
        after(world, ctx, cam) {
          try { render(g, ctx, cam); } catch (e) { console.error('[NPC]', e); }
        }
      });
    } else {
      window.GameHooks.onRenderWorld.push((game, ctx, cam) => {
        try { render(game, ctx, cam); } catch (e) { console.error('[NPC]', e); }
      });
    }
  }

  window.NPCs = { getNear: () => state.near };
  window.GameHooks = window.GameHooks || { onInit: [], onRoomLoad: [], onUpdate: [], onRenderWorld: [], onAction: [] };
  window.GameHooks.onInit = window.GameHooks.onInit || [];
  window.GameHooks.onRenderWorld = window.GameHooks.onRenderWorld || [];
  window.GameHooks.onInit.push((game) => {
    try { install(game); } catch (e) { console.error('[NPC] no se pudo iniciar:', e); }
  });
})();
