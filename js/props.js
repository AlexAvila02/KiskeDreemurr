/**
 * Decorados de sala - Ruben: En Busca de Angelo (Claude)
 *
 * Una sala declara `props: [{ type: 'cabin' | 'sheep', x, y, ... }]` (sin colisión).
 *  - 'cabin': cabaña del pastor (troncos, techo de paja, chimenea con humo que se inclina con
 *    la brisa de ambience.js, ventana con luz, farol, banco y leña).
 *  - 'sheep': oveja que pasta yendo y viniendo (`range`, `facing`, `small`).
 * Se dibujan DETRÁS de Ruben y de los NPC (capa world de AnimationRegistry, orden 49).
 * Hooks: onBeforeUpdate (reloj) (ver MAPA.md).
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const clock = { t: 0 };
  // Intensidad de la brisa de la sala (0 si no hay): inclina el humo de la chimenea
  function breezeStrength() {
    const b = window.Ambience && window.Ambience.getBreeze ? window.Ambience.getBreeze() : null;
    return b ? b.level * b.gust : 0;
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
      const sx = cx0 + 12 + Math.sin(k * 6 + i) * 6 + k * (18 + breezeStrength() * 55);
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

  function install(g) {
    window.GameHooks.onBeforeUpdate.push((game, running) => { if (running) clock.t++; });
    const draw = (ctx, cam) => {
      try { const room = g.world && g.world.getCurrentRoom(); if (room) drawProps(ctx, room, cam, clock.t); } catch (e) { console.error('[Decorados]', e); }
    };
    const AR = window.AnimationRegistry || window.AnimSystem;
    if (AR && AR.registerLayer) AR.registerLayer('world', 'room-props', { order: 49, after(world, ctx, cam) { draw(ctx, cam); } });
    else window.GameHooks.onRenderWorld.push((game, ctx, cam) => draw(ctx, cam));
  }

  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Decorados] no se pudo iniciar:', e); }
  });
})();
