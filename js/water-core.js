/**
 * Agua: superficie, nado, gotas, charcos y sonidos - Ruben: En Busca de Angelo (Claude)
 * (Parte 1 de 3 del agua: water-core.js → water-quest.js → water-power.js)
 *
 * CUERPOS DE AGUA: una sala declara `water: [{ x, y, w, h }]` (y = superficie en reposo).
 *  - La superficie es una fila de resortes (una columna cada 8 px) que se contagian el
 *    movimiento: las salpicaduras forman olas que viajan, rebotan y se calman.
 *  - Ruben nada: flota, el agua lo frena, SALTAR da una brazada (o un salto fuera del agua
 *    si está en la superficie), ABAJO bucea. Entrar/salir salpica según la velocidad.
 *  - Piedras y enemigos que caen al agua salpican; las piedras se hunden despacio.
 *  - CHARCOS (`room.puddles`): el agua que cae al suelo queda como charco y se evapora
 *    (60 s uno lleno, también estando en otra sala). Son fuente para el Dominio del Agua.
 *  - El viento de Ruben (wind-pull.js) encrespa la superficie (windOnWater).
 *  - Sonido ambiente de agua que lame la orilla (sigue en pausa, como la brisa).
 *
 * API interna para water-quest.js y water-power.js: window.WaterCore
 *   ws (reloj ws.t y estado de nado ws.swim / ws.swimBody), surfaceAt, splashAt, bodyAt,
 *   spawnDrop, burst, addPuddle, EVAP_FRAMES y sonidos (playSplash, playWhoosh,
 *   playBell, streamSound).
 * Hooks: onBeforeUpdate · onAfterUpdate · onAction (brazada) · onAfterPlayerUpdate (nado)
 *   · onBeforeRoomLoad · onRenderWorld · capa world 'water-puddles' (ver MAPA.md).
 * Pools fijos: sin basura por cuadro.
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const COL = 8;                 // px por columna de la superficie
  const K = 0.028, DAMP = 0.04, SPREAD = 0.24, PASSES = 4;

  // Estado compartido del agua (reloj de cuadros y nado)
  const ws = { t: 0, swim: false, swimBody: null, prevSwim: false, lastBody: null, waveT: 0, ambLevel: 0 };

  // ---------------- simulación de la superficie ----------------
  function sim(wb) {
    if (!wb._sim) {
      const n = Math.max(3, Math.round(wb.w / COL) + 1);
      wb._sim = { n, h: new Float32Array(n), v: new Float32Array(n), d: new Float32Array(n), t: Math.random() * 100 };
    }
    return wb._sim;
  }
  function colIndex(wb, x) {
    const s = sim(wb);
    return Math.max(0, Math.min(s.n - 1, Math.round((x - wb.x) / wb.w * (s.n - 1))));
  }
  function surfaceAt(wb, x) {
    const s = sim(wb);
    const f = Math.max(0, Math.min(s.n - 1, (x - wb.x) / wb.w * (s.n - 1)));
    const i = Math.min(s.n - 2, Math.floor(f));
    const t = f - i;
    return wb.y + s.h[i] * (1 - t) + s.h[i + 1] * t;
  }
  // force > 0 hunde la superficie (algo cayó), < 0 la levanta (el agua sube a la mano)
  function splashAt(wb, x, force, radius = 1) {
    const s = sim(wb);
    const i = colIndex(wb, x);
    for (let k = -radius; k <= radius; k++) {
      const j = i + k;
      if (j >= 0 && j < s.n) s.v[j] += force * (1 - Math.abs(k) / (radius + 1));
    }
  }
  function stepSim(wb) {
    const s = sim(wb);
    s.t++;
    // Ondulación de reposo muy suave (el agua nunca está quieta del todo)
    if (s.t % 40 === 0) s.v[(Math.random() * s.n) | 0] += (Math.random() - 0.5) * 0.6;
    for (let i = 0; i < s.n; i++) {
      s.v[i] += -K * s.h[i] - DAMP * s.v[i];
      s.h[i] += s.v[i];
      if (s.h[i] > 46) s.h[i] = 46; else if (s.h[i] < -60) s.h[i] = -60;
    }
    for (let p = 0; p < PASSES; p++) {
      s.d.fill(0);
      for (let i = 0; i < s.n; i++) {
        if (i > 0) { const dl = SPREAD * (s.h[i] - s.h[i - 1]); s.v[i - 1] += dl; s.d[i - 1] += dl; }
        if (i < s.n - 1) { const dr = SPREAD * (s.h[i] - s.h[i + 1]); s.v[i + 1] += dr; s.d[i + 1] += dr; }
      }
      for (let i = 0; i < s.n; i++) s.h[i] += s.d[i] * 0.5;
    }
  }
  function bodyAt(room, x, y, margin = 0) {
    if (!room || !room.water) return null;
    for (const wb of room.water) {
      if (x >= wb.x && x <= wb.x + wb.w && y >= wb.y - margin && y <= wb.y + wb.h) return wb;
    }
    return null;
  }

  // ---------------- gotas y burbujas (pools fijos) ----------------
  const DROPS = [];
  for (let i = 0; i < 120; i++) DROPS.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 0, bubble: false });
  function spawnDrop(x, y, vx, vy, r, bubble) {
    for (const d of DROPS) {
      if (d.on) continue;
      d.on = true; d.x = x; d.y = y; d.vx = vx; d.vy = vy; d.r = r; d.life = bubble ? 50 : 70; d.bubble = !!bubble;
      return d;
    }
    return null;
  }
  function burst(x, y, count, power, up = 1) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const sp = power * (0.45 + Math.random() * 0.75);
      spawnDrop(x + (Math.random() - 0.5) * 10, y, Math.cos(a) * sp, Math.sin(a) * sp * up, 1.6 + Math.random() * 2.2, false);
    }
  }
  function stepDrops(room) {
    for (const d of DROPS) {
      if (!d.on) continue;
      d.life--;
      if (d.bubble) {
        d.vy -= 0.04; d.vx *= 0.96; d.x += d.vx + Math.sin(d.life * 0.3) * 0.2; d.y += d.vy;
        const wb = bodyAt(room, d.x, d.y, 4);
        if (!wb || d.y <= surfaceAt(wb, d.x) || d.life <= 0) d.on = false;
        continue;
      }
      d.vy += 0.32; d.x += d.vx; d.y += d.vy;
      const wb = d.vy > 0 ? bodyAt(room, d.x, d.y, 0) : null;
      if (wb && d.y >= surfaceAt(wb, d.x)) { splashAt(wb, d.x, 0.25 + d.r * 0.08, 0); d.on = false; continue; }
      if (d.life <= 0 || (room && d.y > room.height + 20)) d.on = false;
    }
  }

  // ---------------- sonido (sound-kit.js: ruido y tonos sintetizados) ----------------
  const SK = window.SoundKit;
  const ac = () => SK.ctx();
  const snd = { amb: null, stream: null };
  function playSplash(intensity) {
    const I = Math.max(0.15, Math.min(1, intensity));
    SK.noiseHit('white', { type: 'bandpass', freq: 700 + Math.random() * 500, Q: 0.7, peak: 0.22 * I, attack: 0.012, release: 0.18 + 0.3 * I, stopAt: 0.6, randomStart: true });
    // "Bloop": burbuja que baja de tono
    SK.tone({ freq: 420 + Math.random() * 120, freqTo: 120, sweep: 0.16, gain: 0.1 * I, release: 0.18, stopAt: 0.2 });
  }
  function playStroke() {
    SK.tone({ freq: 260, freqTo: 520, sweep: 0.12, gain: 0.06, release: 0.16, stopAt: 0.18 });
  }
  function playWhoosh(size) {
    SK.noiseHit('white', { type: 'bandpass', freq: 500, freqTo: 2600, sweep: 0.22, Q: 1.2, peak: 0.14 * (0.5 + size * 0.5), attack: 0.03, release: 0.3, stopAt: 0.35, randomStart: true });
  }
  function playBell(pitch) {
    for (const [mul, vol] of [[1, 0.12], [2.76, 0.05], [5.4, 0.025]]) {
      SK.tone({ freq: pitch * mul, gain: vol, release: 1.6, floor: 0.0006, stopAt: 1.7 });
    }
  }
  // Bucle: ruido filtrado con gorgoteo (el agua subiendo a la mano)
  function streamSound(level) {
    if (!ac() || level <= 0.01) {
      if (snd.stream) { snd.stream.stop(0.06, 0.4); snd.stream = null; }
      return;
    }
    if (!snd.stream) snd.stream = SK.loop('white', { type: 'bandpass', freq: 1300, Q: 2.2, lfoFreq: 7, lfoDepth: 420 });
    if (snd.stream) snd.stream.setLevel(0.03 + 0.06 * level, 0.08);
  }
  // Ambiente: agua que lame la orilla (ruido grave con vaivén lento)
  function ambientSound(level, t) {
    if (!ac() || level <= 0.005) {
      if (snd.amb) { snd.amb.stop(0.3, 1.5); snd.amb = null; }
      return;
    }
    if (!snd.amb) snd.amb = SK.loop('white', { type: 'lowpass', freq: 380, Q: 0.9 });
    if (!snd.amb) return;
    const lap = 0.5 + 0.5 * Math.sin(t * 0.021) * Math.sin(t * 0.0067 + 1);
    snd.amb.setLevel(level * (0.018 + 0.03 * lap), 0.4);
    snd.amb.setFreq(260 + 260 * lap, 0.5);
  }

  // ---------------- nado ----------------
  function swimStep(g) {
    const p = g.player;
    const room = g.world.getCurrentRoom();
    const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
    const wb = p.dead ? null : bodyAt(room, cx, cy, 0);
    const surf = wb ? surfaceAt(wb, cx) : 0;
    const inside = !!wb && cy > surf;
    ws.swim = inside;
    ws.swimBody = inside ? wb : null;

    // Entrar / salir: salpicadura según la velocidad
    if (inside && !ws.prevSwim) {
      const sp = Math.abs(p.vy) + Math.abs(p.vx) * 0.4;
      splashAt(wb, cx, Math.min(9, sp * 0.9), 2);
      burst(cx, surf, 6 + Math.round(sp * 1.6), 2 + sp * 0.35);
      playSplash(sp / 11);
    } else if (!inside && ws.prevSwim && ws.lastBody) {
      const wb2 = ws.lastBody;
      if (cx >= wb2.x && cx <= wb2.x + wb2.w) {
        splashAt(wb2, cx, -2.5, 1);
        burst(cx, surfaceAt(wb2, cx), 7, 3);
        playSplash(0.35);
      }
    }
    ws.prevSwim = inside;
    if (inside) ws.lastBody = wb;
    if (!inside) return;

    // Flotación: anula la gravedad y un resorte suave lleva a Ruben a flotar con la cabeza
    // afuera (centro ~6 px bajo la superficie); el agua frena todo. Con ABAJO bucea.
    const depth = cy - surf;
    const cm = g.controlsManager;
    const diving = !!(cm && cm.isActive && cm.isActive('aimDown', g.keys));
    p.vy -= p.gravity;
    p.vy += diving ? 0.32 : (6 - depth) * 0.025;
    p.vy *= 0.9;
    if (p.vy > 3) p.vy = 3;
    if (p.vy < -6) p.vy = -6;
    p.vx *= 0.84;
    p.coyoteTime = 0;
    // Olas al nadar por la superficie y burbujas al ir bajo el agua
    ws.waveT++;
    if (Math.abs(p.vx) > 0.8 && ws.waveT % 7 === 0 && cy - surf < 26) splashAt(wb, cx - p.vx * 3, 1.1, 1);
    if (ws.waveT % 18 === 0 && cy - surf > 20) spawnDrop(cx + p.facing * 6, p.y + 8, 0, -0.4, 1.5 + Math.random(), true);
  }

  function swimJump(g) {
    const p = g.player;
    const wb = ws.swimBody;
    const cx = p.x + p.width / 2;
    const depth = (p.y + p.height / 2) - surfaceAt(wb, cx);
    if (depth < 22) {
      // Cerca de la superficie: salto fuera del agua
      p.vy = -10.2;
      splashAt(wb, cx, 3.5, 2);
      burst(cx, surfaceAt(wb, cx), 10, 3.6);
      playSplash(0.5);
      if (p.anim) { p.anim.sy = 1.25; p.anim.vsy = 0; }
    } else {
      // Brazada: impulso hacia arriba con burbujas
      p.vy = Math.min(p.vy, -4.4);
      for (let i = 0; i < 3; i++) spawnDrop(cx + (Math.random() - 0.5) * 12, p.y + p.height - 4, (Math.random() - 0.5) * 0.6, -0.6, 1.6 + Math.random() * 1.4, true);
      playStroke();
      if (p.anim) { p.anim.sy = 1.15; p.anim.vsy = 0; }
    }
  }

  // Piedras y enemigos que caen al agua
  function objectsStep(g) {
    const room = g.world.getCurrentRoom();
    if (!room.water) return;
    for (const d of g.debrisItems || []) {
      if (!d.active || d.isCarried) { d._inWater = false; continue; }
      const cx = d.x + d.width / 2, cy = d.y + d.height / 2;
      const wb = bodyAt(room, cx, cy, 0);
      const inside = !!wb && cy > surfaceAt(wb, cx);
      if (inside && !d._inWater) {
        splashAt(wb, cx, Math.min(8, 2 + Math.abs(d.vy) * 0.8), 1);
        burst(cx, surfaceAt(wb, cx), 8, 2.6);
        playSplash(0.4 + Math.abs(d.vy) / 20);
      }
      d._inWater = inside;
      if (inside) { d.vx *= 0.88; if (d.vy > 1.3) d.vy = 1.3; }
    }
    for (const e of g.enemies || []) {
      if (!e.alive) continue;
      const cx = e.x + e.width / 2, cy = e.y + e.height / 2;
      const wb = bodyAt(room, cx, cy, 0);
      const inside = !!wb && cy > surfaceAt(wb, cx);
      if (inside && !e._inWater) {
        splashAt(wb, cx, 4, 1);
        burst(cx, surfaceAt(wb, cx), 8, 2.6);
        playSplash(0.4);
      }
      e._inWater = inside;
    }
  }

  // ---------------- charcos (el agua lanzada queda en el suelo y se evapora) ----------------
  // room.puddles = [{ x, y (suelo), vol, lastT }]. Un charco lleno (vol 1) tarda EVAP_FRAMES
  // en evaporarse, también mientras Ruben está en otra sala (usa el reloj global ws.t).
  // Sirven de fuente para el Dominio del Agua: lo que se saca se resta del charco.
  const EVAP_FRAMES = 3600;      // 60 s (+50%) para evaporar un charco (o un orbe lleno en la mano)
  function groundBelow(world, x, y) {
    let best = null;
    for (const pl of world.getPlatforms()) {
      if (x < pl.x || x > pl.x + pl.w || pl.y < y - 2) continue;
      if (!best || pl.y < best.y) best = pl;
    }
    return best;
  }
  function addPuddle(g, x, y, vol) {
    if (vol < 0.04) return;
    const room = g.world.getCurrentRoom();
    const pl = groundBelow(g.world, x, y);
    if (!pl) return;
    const px = Math.max(pl.x + 8, Math.min(pl.x + pl.w - 8, x));
    if (bodyAt(room, px, pl.y - 2, 0)) return;      // el fondo de una laguna no hace charco
    if (window.soundManager && window.soundManager.playWaterGroundImpact) {
      window.soundManager.playWaterGroundImpact(Math.min(1.2, vol * 1.1));
    }
    const list = room.puddles || (room.puddles = []);
    for (const p of list) {
      if (p.y === pl.y && Math.abs(p.x - px) < 46) {   // se junta con el charco vecino
        p.x = (p.x * p.vol + px * vol) / (p.vol + vol);
        p.vol = Math.min(2, p.vol + vol);
        p.pop = 1;
        return;
      }
    }
    if (list.length >= 14) list.shift();
    list.push({ x: px, y: pl.y, vol: Math.min(2, vol), lastT: ws.t, pop: 1, seed: Math.random() * 100 });
  }
  function puddlesStep(g, room) {
    const list = room.puddles;
    if (!list || !list.length) return;
    const p = g.player;
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      q.vol -= (ws.t - q.lastT) / EVAP_FRAMES;
      q.lastT = ws.t;
      if (q.pop > 0) q.pop = Math.max(0, q.pop - 0.08);
      if (q.vol <= 0.03) { list.splice(i, 1); continue; }
      // Ruben chapotea al pisarlo
      if (p.isGrounded && Math.abs(p.vx) > 1 && ws.t % 9 === 0 &&
        Math.abs(p.y + p.height - q.y) < 3 && Math.abs(p.x + p.width / 2 - q.x) < puddleHalf(q)) {
        burst(p.x + p.width / 2, q.y - 1, 2, 1.6);
        if (ws.t % 27 === 0) playSplash(0.16);
      }
    }
  }
  function puddleHalf(q) { return 8 + 23 * Math.sqrt(Math.min(2, q.vol)); }

  function drawPuddles(ctx, room, cam, t) {
    const list = room.puddles;
    if (!list || !list.length) return;
    ctx.save();
    for (const q of list) {
      const x = q.x - cam.x, y = q.y - cam.y;
      const hw = puddleHalf(q) * (1 + q.pop * 0.25), hh = 2.2 + 1.3 * Math.sqrt(Math.min(2, q.vol));
      const a = Math.min(1, q.vol * 4);          // al final se desvanece
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(96, 176, 204, 0.62)';
      ctx.strokeStyle = 'rgba(58, 36, 22, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y + 0.5, hw, hh, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(240, 253, 255, 0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x - hw * 0.55, y - hh * 0.25); ctx.lineTo(x - hw * 0.1, y - hh * 0.4); ctx.stroke();
      // Vapor: dos hilitos que suben y se desvanecen (se nota que se está evaporando)
      ctx.strokeStyle = 'rgba(240, 250, 255, 0.5)';
      ctx.lineWidth = 1.1;
      for (let k = 0; k < 2; k++) {
        const ph = ((t * 0.012 + q.seed + k * 0.5) % 1);
        const vx = x + (k ? 1 : -1) * hw * 0.35 + Math.sin(ph * 6 + q.seed) * 3;
        const vy = y - 4 - ph * 22;
        ctx.globalAlpha = a * (1 - ph) * 0.6;
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.quadraticCurveTo(vx + 3, vy - 3, vx, vy - 6); ctx.stroke();
      }
    }
    ctx.restore();
  }


  // ---------------- dibujo ----------------
  function drawWater(ctx, room, cam, t) {
    for (const wb of room.water) {
      const s = sim(wb);
      const x0 = wb.x - cam.x, bottom = wb.y + wb.h - cam.y;
      const step = wb.w / (s.n - 1);
      ctx.save();
      // Cuerpo del agua (translúcido: se ve a Ruben nadando)
      const grad = ctx.createLinearGradient(0, wb.y - cam.y - 10, 0, bottom);
      grad.addColorStop(0, 'rgba(120, 196, 206, 0.58)');
      grad.addColorStop(0.35, 'rgba(62, 140, 160, 0.66)');
      grad.addColorStop(1, 'rgba(28, 70, 92, 0.82)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, bottom);
      for (let i = 0; i < s.n; i++) ctx.lineTo(x0 + i * step, wb.y + s.h[i] - cam.y);
      ctx.lineTo(x0 + wb.w, bottom);
      ctx.closePath();
      ctx.fill();
      // Rayos de luz bajo el agua
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#e8fbff';
      for (let k = 0; k < 4; k++) {
        const lx = x0 + ((k * 151 + t * 0.25) % wb.w);
        ctx.beginPath();
        ctx.moveTo(lx, wb.y - cam.y + 4); ctx.lineTo(lx + 16, wb.y - cam.y + 4);
        ctx.lineTo(lx + 36, bottom); ctx.lineTo(lx + 22, bottom);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Contorno de tinta de la superficie + brillo claro debajo
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(58, 36, 22, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < s.n; i++) {
        const y = wb.y + s.h[i] - cam.y;
        if (i === 0) ctx.moveTo(x0, y); else ctx.lineTo(x0 + i * step, y);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(236, 252, 255, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < s.n; i++) {
        const y = wb.y + s.h[i] - cam.y + 3;
        if (i === 0) ctx.moveTo(x0, y); else ctx.lineTo(x0 + i * step, y);
      }
      ctx.stroke();
      // Destellos que viajan por la superficie
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 6; k++) {
        const u = ((k * 0.173 + t * 0.0016 * (k % 2 ? 1 : -0.7)) % 1 + 1) % 1;
        const sx = wb.x + 6 + u * (wb.w - 12);
        const sy = surfaceAt(wb, sx) - cam.y + 8 + (k % 3) * 6;
        const a = 0.35 + 0.35 * Math.sin(t * 0.07 + k);
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.moveTo(sx - cam.x - 5, sy); ctx.lineTo(sx - cam.x + 5, sy); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawDrops(ctx, cam) {
    ctx.save();
    for (const d of DROPS) {
      if (!d.on) continue;
      const x = d.x - cam.x, y = d.y - cam.y;
      if (d.bubble) {
        ctx.globalAlpha = Math.min(1, d.life / 20) * 0.8;
        ctx.strokeStyle = 'rgba(236, 252, 255, 0.95)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, d.r, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, d.life / 15);
        ctx.fillStyle = '#bfe9f2';
        ctx.beginPath();
        // Gota estirada según la velocidad
        const sp = Math.min(3, Math.hypot(d.vx, d.vy) * 0.25);
        const a = Math.atan2(d.vy, d.vx);
        ctx.ellipse(x, y, d.r * (1 + sp * 0.4), d.r, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }


  // ---------------- el viento sobre el agua (wind-pull.js) ----------------
  // Cada columna de la superficie que cae dentro de la franja de viento recibe fuerza:
  //  - Soplar: la hunde con un picado irregular (olas que se propagan) y levanta espuma
  //    que vuela en la dirección del viento.
  //  - Jalar: la levanta hacia Ruben y arranca gotitas que vuelan a su mano.
  function windOnWater(room) {
    const WP = window.WindPull;
    if (!room.water || !WP || !WP.getBand) return;
    const b = WP.getBand();
    if (!b || b.power <= 0.05 || b.reach < 8) return;
    const push = b.mode === 'push';
    for (const wb of room.water) {
      const s = sim(wb);
      const step = wb.w / (s.n - 1);
      for (let i = 0; i < s.n; i++) {
        const x = wb.x + i * step, y = wb.y + s.h[i];
        const rx = x - b.hx, ry = y - b.hy;
        const along = rx * b.dirX + ry * b.dirY;
        if (along < -6 || along > b.reach) continue;
        const u = Math.max(0, along / b.range);
        const perp = Math.abs(ry * b.dirX - rx * b.dirY);
        const half = (WP.bandHalf ? WP.bandHalf(u) : 30) + 10;
        if (perp > half) continue;
        // Más fuerza cerca de la mano y en el centro de la franja
        const f = b.power * (1 - u * 0.55) * (1 - perp / half * 0.6);
        const chop = 0.55 + 0.45 * Math.sin(ws.t * 0.45 + i * 1.3);
        s.v[i] += (push ? 0.32 : -0.26) * f * chop;
        // Espuma / gotas arrancadas por el viento
        if (Math.random() < 0.035 * f) {
          const sx = push ? b.dirX : -b.dirX;
          spawnDrop(x, y - 1, sx * (2 + Math.random() * 2.5) * f + (Math.random() - 0.5) * 0.6, -1.2 - Math.random() * 2 * f, 1.2 + Math.random() * 1.4, false);
        }
      }
    }
  }

  // ---------------- instalación ----------------
  function install(g) {
    const H = window.GameHooks;
    // Después de mover a Ruben: física de nado. SALTAR en el agua = brazada.
    H.onAfterPlayerUpdate.push((game) => swimStep(game));
    H.onAction.push((game, action) => {
      if (action === 'jump' && ws.swim && ws.swimBody && !game.player.dead) { swimJump(game); return true; }
      return false;
    });
    H.onBeforeUpdate.push((game, running) => {
      if (!running) return;
      ws.t++;
      const room = game.world.getCurrentRoom();
      if (room.water) { windOnWater(room); for (const wb of room.water) stepSim(wb); }
    });
    H.onAfterUpdate.push((game, running) => {
      if (running) {
        const room = game.world.getCurrentRoom();
        objectsStep(game);
        stepDrops(room);
        puddlesStep(game, room);
      }
      // Ambiente de agua: sigue en pausa / Diario; se apaga en el menú principal
      const room = game.world && game.world.getCurrentRoom();
      const wantAmb = game.isPlaying && room && room.water ? 1 : 0;
      ws.ambLevel += (wantAmb - ws.ambLevel) * 0.03;
      if (!game.isPlaying) ws.ambLevel = 0;
      ambientSound(ws.ambLevel, ws.t);
    });
    H.onBeforeRoomLoad.push(() => {
      ws.swim = false; ws.prevSwim = false; ws.lastBody = null;
      for (const d of DROPS) d.on = false;
    });

    // Charcos detrás de Ruben (capa world); agua y gotas por delante (translúcidas)
    const AR = window.AnimationRegistry || window.AnimSystem;
    const drawPuddlesLayer = (ctx, cam) => { try { drawPuddles(ctx, g.world.getCurrentRoom(), cam, ws.t); } catch (e) { console.error('[Agua]', e); } };
    if (AR && AR.registerLayer) AR.registerLayer('world', 'water-puddles', { order: 60, after(world, ctx, cam) { drawPuddlesLayer(ctx, cam); } });
    else H.onRenderWorld.push((game, ctx, cam) => drawPuddlesLayer(ctx, cam));
    H.onRenderWorld.push((game, ctx, cam) => {
      try {
        const room = game.world.getCurrentRoom();
        if (room.water) drawWater(ctx, room, cam, ws.t);
        drawDrops(ctx, cam);
      } catch (e) { console.error('[Agua]', e); }
    });
  }

  window.WaterCore = {
    ws, EVAP_FRAMES, sim, surfaceAt, splashAt, bodyAt, spawnDrop, burst, addPuddle,
    playSplash, playWhoosh, playBell, streamSound
  };
  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Agua] no se pudo iniciar el núcleo:', e); }
  });
})();
