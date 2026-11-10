/**
 * Agua y "Dominio del Agua" - Ruben: En Busca de Angelo (Claude)
 *
 * 1) CUERPOS DE AGUA: una sala declara `water: [{ x, y, w, h }]` (y = superficie en reposo).
 *    - La superficie es una fila de resortes (una columna cada 8 px) que se contagian el
 *      movimiento: las salpicaduras forman olas que viajan, rebotan y se calman.
 *    - Ruben nada: flota, el agua lo frena, SALTAR da una brazada (o un salto fuera del
 *      agua si está en la superficie). Entrar/salir salpica según la velocidad.
 *    - Piedras y enemigos que caen al agua salpican; las piedras se hunden despacio.
 *    - Sonido ambiente de agua que lame la orilla (sigue en pausa, como la brisa).
 *
 * 2) DOMINIO DEL AGUA (se aprende con el Maestro del Agua, sala 12):
 *    - Mantener F / Shift izq. (acción "windPull") o L2 SIN apretar arriba/abajo, con agua
 *      a menos de 320 px: el agua sube de la laguna (la superficie se levanta en ese punto)
 *      y forma un orbe en la mano de Ruben que crece mientras se mantiene.
 *    - Apuntar con el ratón o el stick derecho (sin ninguno: adelante y un poco arriba).
 *    - Soltar: el orbe sale disparado con gravedad real. Golpea enemigos (daño según
 *      tamaño), rompe muros quebradizos, hace sonar campanas y salpica al chocar.
 *    - Arriba/Abajo + F/L2 siguen siendo Soplar/Jalar el Aire (wind-pull.js).
 *
 * Integración (sin editar main.js): envuelve game.update, game.doAction, game.loadRoom y
 * player.update; dibuja con GameHooks.onRenderWorld (el agua tapa a Ruben, translúcida).
 * Pools fijos: sin basura por cuadro.
 *
 * API: window.WaterControl.learn(game) · .isLearned() · .getState()
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const COL = 8;                 // px por columna de la superficie
  const K = 0.028, DAMP = 0.04, SPREAD = 0.24, PASSES = 4;
  const SAVE_KEY = 'ruben_agua_v1';
  const RANGE = 320;             // distancia máxima a la superficie para levantar agua
  const EMPTY_KEYS = Object.freeze({});
  const STICK_DEAD = 0.35;

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

  // ---------------- sonido (Web Audio, sin archivos) ----------------
  const snd = { noise: null, amb: null, stream: null };
  function ac() {
    const sm = window.soundManager;
    return sm && sm.ctx && !sm.isMuted ? sm.ctx : null;
  }
  function noiseBuf(c) {
    if (snd.noise) return snd.noise;
    const len = c.sampleRate * 2;
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const fade = 1500;
    for (let i = 0; i < fade; i++) { const k = i / fade; d[i] *= k; d[len - 1 - i] *= k; }
    snd.noise = b;
    return b;
  }
  function playSplash(intensity) {
    const c = ac(); if (!c) return;
    const I = Math.max(0.15, Math.min(1, intensity));
    try {
      const now = c.currentTime;
      const src = c.createBufferSource(); src.buffer = noiseBuf(c);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700 + Math.random() * 500; bp.Q.value = 0.7;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.22 * I, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.18 + 0.3 * I);
      src.connect(bp); bp.connect(g); g.connect(c.destination);
      src.start(now, Math.random()); src.stop(now + 0.6);
      // "Bloop": burbuja que baja de tono
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(420 + Math.random() * 120, now);
      o.frequency.exponentialRampToValueAtTime(120, now + 0.16);
      const og = c.createGain();
      og.gain.setValueAtTime(0.1 * I, now);
      og.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
      o.connect(og); og.connect(c.destination);
      o.start(now); o.stop(now + 0.2);
    } catch (e) { /* */ }
  }
  function playStroke() {
    const c = ac(); if (!c) return;
    try {
      const now = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(260, now); o.frequency.exponentialRampToValueAtTime(520, now + 0.12);
      const g = c.createGain(); g.gain.setValueAtTime(0.06, now); g.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
      o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.18);
    } catch (e) { /* */ }
  }
  function playWhoosh(size) {
    const c = ac(); if (!c) return;
    try {
      const now = c.currentTime;
      const src = c.createBufferSource(); src.buffer = noiseBuf(c);
      const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 1.2;
      hp.frequency.setValueAtTime(500, now); hp.frequency.exponentialRampToValueAtTime(2600, now + 0.22);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.14 * (0.5 + size * 0.5), now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.3);
      src.connect(hp); hp.connect(g); g.connect(c.destination);
      src.start(now, Math.random()); src.stop(now + 0.35);
    } catch (e) { /* */ }
  }
  function playBell(pitch) {
    const c = ac(); if (!c) return;
    try {
      const now = c.currentTime;
      for (const [mul, vol] of [[1, 0.12], [2.76, 0.05], [5.4, 0.025]]) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = pitch * mul;
        const g = c.createGain(); g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0006, now + 1.6);
        o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 1.7);
      }
    } catch (e) { /* */ }
  }
  // Bucle: ruido filtrado con gorgoteo (el agua subiendo a la mano)
  function streamSound(level) {
    const c = ac();
    if (!c || level <= 0.01) {
      if (snd.stream) {
        const s = snd.stream; snd.stream = null;
        try { s.g.gain.setTargetAtTime(0, s.c.currentTime, 0.06); s.src.stop(s.c.currentTime + 0.4); s.lfo.stop(s.c.currentTime + 0.4); } catch (e) { /* */ }
      }
      return;
    }
    if (!snd.stream) {
      try {
        const src = c.createBufferSource(); src.buffer = noiseBuf(c); src.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 2.2;
        const lfo = c.createOscillator(); lfo.frequency.value = 7;
        const lfoG = c.createGain(); lfoG.gain.value = 420;
        lfo.connect(lfoG); lfoG.connect(bp.frequency);
        const g = c.createGain(); g.gain.value = 0;
        src.connect(bp); bp.connect(g); g.connect(c.destination);
        src.start(); lfo.start();
        snd.stream = { c, src, lfo, g };
      } catch (e) { snd.stream = null; return; }
    }
    snd.stream.g.gain.setTargetAtTime(0.03 + 0.06 * level, c.currentTime, 0.08);
  }
  // Ambiente: agua que lame la orilla (ruido grave con vaivén lento)
  function ambientSound(level, t) {
    const c = ac();
    if (!c || level <= 0.005) {
      if (snd.amb) {
        const s = snd.amb; snd.amb = null;
        try { s.g.gain.setTargetAtTime(0, s.c.currentTime, 0.3); s.src.stop(s.c.currentTime + 1.5); } catch (e) { /* */ }
      }
      return;
    }
    if (!snd.amb) {
      try {
        const src = c.createBufferSource(); src.buffer = noiseBuf(c); src.loop = true;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.9;
        const g = c.createGain(); g.gain.value = 0;
        src.connect(lp); lp.connect(g); g.connect(c.destination);
        src.start();
        snd.amb = { c, src, lp, g };
      } catch (e) { snd.amb = null; return; }
    }
    const lap = 0.5 + 0.5 * Math.sin(t * 0.021) * Math.sin(t * 0.0067 + 1);
    snd.amb.g.gain.setTargetAtTime(level * (0.018 + 0.03 * lap), c.currentTime, 0.4);
    snd.amb.lp.frequency.setTargetAtTime(260 + 260 * lap, c.currentTime, 0.5);
  }

  // ---------------- estado ----------------
  const st = {
    learned: false,
    swim: false, swimBody: null, prevSwim: false, waveT: 0,
    holding: false, size: 0, pose: 0, src: null, srcX: 0, angle: 0, rel: 0, facing: 1,
    noWaterMsgT: 0, ambLevel: 0, t: 0
  };
  const aim = { source: 'none', mouseX: 0, mouseY: 0, mouseT: -1e9, stickHeld: false };
  const SHOTS = [];
  for (let i = 0; i < 6; i++) SHOTS.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 6, size: 0, t: 0 });

  function loadLearned() {
    try { return window.localStorage.getItem(SAVE_KEY) === '1'; } catch (e) { return false; }
  }
  st.learned = loadLearned();

  function learn(g) {
    if (st.learned) return;
    st.learned = true;
    try { window.localStorage.setItem(SAVE_KEY, '1'); } catch (e) { /* */ }
    if (window.soundManager && window.soundManager.playUnlockAbility) window.soundManager.playUnlockAbility();
    if (g && g.showNotification) g.showNotification('✦ ¡Habilidad aprendida: Dominio del Agua! (F / L2 cerca del agua)');
    if (g && g.player) burst(g.player.x + g.player.width / 2, g.player.y + 10, 18, 4.5);
  }

  // ---------------- nado ----------------
  function swimStep(g) {
    const p = g.player;
    const room = g.world.getCurrentRoom();
    const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
    const wb = p.dead ? null : bodyAt(room, cx, cy, 0);
    const surf = wb ? surfaceAt(wb, cx) : 0;
    const inside = !!wb && cy > surf;
    st.swim = inside;
    st.swimBody = inside ? wb : null;

    // Entrar / salir: salpicadura según la velocidad
    if (inside && !st.prevSwim) {
      const sp = Math.abs(p.vy) + Math.abs(p.vx) * 0.4;
      splashAt(wb, cx, Math.min(9, sp * 0.9), 2);
      burst(cx, surf, 6 + Math.round(sp * 1.6), 2 + sp * 0.35);
      playSplash(sp / 11);
    } else if (!inside && st.prevSwim && st.lastBody) {
      const wb2 = st.lastBody;
      if (cx >= wb2.x && cx <= wb2.x + wb2.w) {
        splashAt(wb2, cx, -2.5, 1);
        burst(cx, surfaceAt(wb2, cx), 7, 3);
        playSplash(0.35);
      }
    }
    st.prevSwim = inside;
    if (inside) st.lastBody = wb;
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
    st.waveT++;
    if (Math.abs(p.vx) > 0.8 && st.waveT % 7 === 0 && cy - surf < 26) splashAt(wb, cx - p.vx * 3, 1.1, 1);
    if (st.waveT % 18 === 0 && cy - surf > 20) spawnDrop(cx + p.facing * 6, p.y + 8, 0, -0.4, 1.5 + Math.random(), true);
  }

  function swimJump(g) {
    const p = g.player;
    const wb = st.swimBody;
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

  // ---------------- Dominio del Agua ----------------
  function readStick(g) {
    const pad = g.getPad ? g.getPad() : null;
    if (!pad || !pad.axes || pad.axes.length < 4) { aim.stickHeld = false; return null; }
    const ax = pad.axes[2] || 0, ay = pad.axes[3] || 0;
    aim.stickHeld = ax * ax + ay * ay > STICK_DEAD * STICK_DEAD;
    if (aim.stickHeld) { aim.source = 'stick'; return Math.atan2(ay, ax); }
    return null;
  }
  function handPos(p) {
    const dx = Math.cos(st.angle), dy = Math.sin(st.angle);
    return { x: p.x + p.width / 2 + dx * 16, y: p.y + 19 + dy * 14 };
  }
  function wantsWater(g) {
    if (!st.learned) return false;
    const cm = g.controlsManager;
    if (!cm || !cm.isActive) return false;
    const pad = g.getPad ? g.getPad() : null;
    const b6 = pad && pad.buttons && pad.buttons[6];
    const l2 = !!(b6 && (b6.pressed || b6.value > 0.35));
    const held = cm.isActive('windPull', g.keys) || l2;
    if (!held) return false;
    // Con arriba/abajo es el viento (wind-pull.js)
    if (cm.isActive('aimUp', g.keys) || cm.isActive('aimDown', g.keys)) return false;
    return true;
  }
  function nearestSource(g) {
    const room = g.world.getCurrentRoom();
    if (!room.water) return null;
    const p = g.player;
    const hx = p.x + p.width / 2, hy = p.y + 19;
    let best = null, bestD = RANGE;
    for (const wb of room.water) {
      const sx = Math.max(wb.x + 10, Math.min(wb.x + wb.w - 10, hx));
      const sy = surfaceAt(wb, sx);
      const d = Math.hypot(hx - sx, hy - sy);
      if (d < bestD) { bestD = d; best = wb; st.srcX = sx; }
    }
    return best;
  }
  function updateAim(g) {
    const p = g.player;
    let want = readStick(g);
    if (want === null && aim.source === 'mouse') {
      const cam = g.camera || { x: 0, y: 0 };
      const dx = aim.mouseX + cam.x - (p.x + p.width / 2), dy = aim.mouseY + cam.y - (p.y + 19);
      if (dx * dx + dy * dy > 36) want = Math.atan2(dy, dx);
    }
    if (want === null && aim.source !== 'stick') want = st.facing > 0 ? -0.35 : Math.PI + 0.35;
    if (want === null) return;
    let d = want - st.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    st.angle += d * 0.35;
    const cx = Math.cos(st.angle);
    if (cx > 0.15) st.facing = 1; else if (cx < -0.15) st.facing = -1;
    st.rel = Math.atan2(Math.sin(st.angle), cx * st.facing);
  }

  function shoot(g) {
    const p = g.player;
    const h = handPos(p);
    const size = st.size;
    for (const s of SHOTS) {
      if (s.on) continue;
      const sp = 6.5 + 7 * size;
      s.on = true; s.x = h.x + Math.cos(st.angle) * (8 + 10 * size); s.y = h.y + Math.sin(st.angle) * (8 + 10 * size);
      s.vx = Math.cos(st.angle) * sp; s.vy = Math.sin(st.angle) * sp;
      s.r = 5 + 8 * size; s.size = size; s.t = 0;
      break;
    }
    playWhoosh(size);
    if (p.anim) { p.anim.sx = 0.86; p.anim.vsx = 0; }
    if (g.rumble) g.rumble(0.3, 90);
  }

  function popOrb(g) {
    const h = handPos(g.player);
    burst(h.x, h.y, 6 + Math.round(st.size * 10), 2.5);
    playSplash(0.3);
  }

  function controlStep(g) {
    const p = g.player;
    const hurt = p.anim && p.anim.hurtFlash > 0;
    const can = !p.dead && p.isGrounded && !st.swim && !p.carriedItem && !hurt && g.deathTimer <= 0 &&
      !(window.WindPull && window.WindPull.isActive && window.WindPull.isActive());
    const want = wantsWater(g);

    if (st.holding && (!want || !can)) {
      st.holding = false;
      if (st.size > 0.22 && !hurt && !p.dead) shoot(g); else if (st.size > 0.05) popOrb(g);
      st.size = 0;
    } else if (!st.holding && want && can) {
      const src = nearestSource(g);
      if (src) {
        st.holding = true;
        st.src = src;
        st.size = 0;
        st.facing = p.facing || 1;
        st.angle = st.facing > 0 ? -0.35 : Math.PI + 0.35;
        if (aim.source === 'stick' && !aim.stickHeld) aim.source = 'none';
        if (aim.source === 'mouse' && performance.now() - aim.mouseT > 3000) aim.source = 'none';
        playSplash(0.25);
      } else if (st.noWaterMsgT <= 0 && g.world.getCurrentRoom().water) {
        st.noWaterMsgT = 120;
        if (g.showNotification) g.showNotification('El agua está demasiado lejos');
      }
    }
    if (st.noWaterMsgT > 0) st.noWaterMsgT--;

    if (st.holding) {
      updateAim(g);
      p.facing = st.facing;
      st.size = Math.min(1, st.size + 0.022);
      // El agua sube desde la laguna: la superficie se levanta en ese punto y la sigue
      const wb = st.src;
      const h = handPos(p);
      st.srcX += (Math.max(wb.x + 10, Math.min(wb.x + wb.w - 10, h.x)) - st.srcX) * 0.08;
      splashAt(wb, st.srcX, -0.55 * (0.4 + st.size), 2);
      if (st.t % 3 === 0) {
        const sy = surfaceAt(wb, st.srcX);
        const d = spawnDrop(st.srcX + (Math.random() - 0.5) * 14, sy, 0, 0, 1.4 + Math.random() * 1.6, false);
        if (d) { d.vx = (h.x - d.x) * 0.06; d.vy = (h.y - sy) * 0.06 - 2.2; d.life = 22; }
      }
    }
    streamSound(st.holding ? 0.4 + st.size * 0.6 : 0);
  }

  // Pose de Ruben (reutiliza la pose de "Jalar el Aire" de player.js). Se aplica DESPUÉS
  // del update del juego, porque wind-pull.js escribe su propia pose en ese update.
  function applyPose(g) {
    const p = g.player;
    st.pose += ((st.holding ? 1 : 0) - st.pose) * 0.2;
    if (st.pose < 0.01) st.pose = 0;
    if (st.pose > 0 && st.pose >= (p.windPose || 0)) { p.windPose = st.pose; p.windAim = st.rel; }
  }

  function shotsStep(g) {
    const room = g.world.getCurrentRoom();
    const plats = g.world.getPlatforms();
    for (const s of SHOTS) {
      if (!s.on) continue;
      s.t++;
      s.vy += 0.2;
      s.x += s.vx; s.y += s.vy;
      if (s.t % 2 === 0) spawnDrop(s.x - s.vx * 0.5, s.y - s.vy * 0.5, s.vx * 0.1 + (Math.random() - 0.5), s.vy * 0.1, 1 + s.size * 1.5, false);
      let hit = false;
      // Agua: se funde con la laguna (gran ola)
      const wb = bodyAt(room, s.x, s.y, 0);
      if (wb && s.y >= surfaceAt(wb, s.x)) {
        splashAt(wb, s.x, 4 + s.size * 7, 3);
        burst(s.x, surfaceAt(wb, s.x), 8 + Math.round(s.size * 10), 3 + s.size * 2);
        playSplash(0.5 + s.size * 0.4);
        s.on = false; continue;
      }
      // Enemigos
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const nx = Math.max(e.x, Math.min(s.x, e.x + e.width)), ny = Math.max(e.y, Math.min(s.y, e.y + e.height));
        if ((s.x - nx) * (s.x - nx) + (s.y - ny) * (s.y - ny) <= s.r * s.r) {
          e.takeDamage(Math.round(10 + 20 * s.size), Math.sign(s.vx || 1) * (4 + 5 * s.size));
          if (g.hitStop) g.hitStop(3);
          hit = true; break;
        }
      }
      // Campanas de práctica
      if (!hit && room.waterBells) {
        for (const b of room.waterBells) {
          if (Math.hypot(s.x - b.x, s.y - (b.y + 10)) < s.r + 13) { ringBell(g, room, b, s.vx); hit = true; break; }
        }
      }
      // Muros quebradizos y plataformas
      if (!hit && g.world.checkBreakableImpact && s.size > 0.45 &&
        g.world.checkBreakableImpact({ x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 })) hit = true;
      if (!hit) {
        for (const pl of plats) {
          if (s.x + s.r > pl.x && s.x - s.r < pl.x + pl.w && s.y + s.r > pl.y && s.y - s.r < pl.y + pl.h) { hit = true; break; }
        }
      }
      if (!hit && (s.x < -50 || s.x > room.width + 50 || s.y > room.height + 50 || s.t > 240)) { s.on = false; continue; }
      if (hit) {
        burst(s.x, s.y, 8 + Math.round(s.size * 12), 2.6 + s.size * 2.2);
        playSplash(0.35 + s.size * 0.5);
        if (window.particleSystem) window.particleSystem.createShockwave(s.x, s.y, 14 + s.size * 16, 'rgba(200, 236, 255, 0.85)', 2);
        s.on = false;
      }
    }
  }

  function ringBell(g, room, b, vx) {
    b.swing = (vx >= 0 ? 1 : -1) * 0.9;
    b.ringT = 50;
    playBell(b.pitch || 660);
    if (b.lit) return;
    b.lit = true;
    if (room.waterBells.every(x => x.lit) && !room.waterBellsDone) {
      room.waterBellsDone = true;
      if (window.soundManager && window.soundManager.playUnlockAbility) window.soundManager.playUnlockAbility();
      if (g.showNotification) g.showNotification('¡Las tres campanas resonaron sobre la laguna!');
    }
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

  function drawOrbAt(ctx, x, y, r, t) {
    ctx.save();
    const wob = Math.sin(t * 0.3) * 0.08;
    ctx.translate(x, y);
    ctx.scale(1 + wob, 1 - wob);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 1, 0, 0, r);
    g.addColorStop(0, 'rgba(240, 253, 255, 0.95)');
    g.addColorStop(0.45, 'rgba(126, 204, 220, 0.9)');
    g.addColorStop(1, 'rgba(48, 120, 150, 0.9)');
    ctx.fillStyle = g;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawControl(ctx, g, cam, t) {
    const p = g.player;
    if (st.holding && st.size > 0.02) {
      const h = handPos(p);
      const ox = h.x + Math.cos(st.angle) * (8 + 10 * st.size), oy = h.y + Math.sin(st.angle) * (8 + 10 * st.size);
      const r = 4 + 9 * st.size;
      // Chorro de agua desde la laguna hasta el orbe (tubo que se afina y fluye)
      const wb = st.src;
      const sx = st.srcX, sy = surfaceAt(wb, sx);
      const mx = (sx + ox) / 2, my = Math.min(sy, oy) - 40;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(58, 36, 22, 0.55)';
      ctx.lineWidth = 3 + 5 * st.size + 2;
      ctx.beginPath(); ctx.moveTo(sx - cam.x, sy - cam.y); ctx.quadraticCurveTo(mx - cam.x, my - cam.y, ox - cam.x, oy - cam.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(126, 204, 220, 0.9)';
      ctx.lineWidth = 3 + 5 * st.size;
      ctx.stroke();
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -t * 1.6;
      ctx.strokeStyle = 'rgba(240, 253, 255, 0.95)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      drawOrbAt(ctx, ox - cam.x, oy - cam.y, r, t);
    }
    for (const s of SHOTS) {
      if (s.on) drawOrbAt(ctx, s.x - cam.x, s.y - cam.y, s.r, t + s.t);
    }
  }

  function drawBells(ctx, room, cam, t) {
    if (!room.waterBells) return;
    for (const b of room.waterBells) {
      if (b.swing === undefined) { b.swing = 0; b.ang = 0; b.vang = 0; b.ringT = 0; }
      const x = b.x - cam.x, y = b.y - cam.y;
      ctx.save();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, 20 - cam.y); ctx.lineTo(x, y - 6); ctx.stroke();
      ctx.translate(x, y - 6);
      ctx.rotate(b.ang);
      // Brillo azul cuando ya sonó
      if (b.lit) {
        const gl = ctx.createRadialGradient(0, 16, 2, 0, 16, 30);
        gl.addColorStop(0, `rgba(170, 230, 255, ${0.35 + (b.ringT / 50) * 0.4})`);
        gl.addColorStop(1, 'rgba(170, 230, 255, 0)');
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(0, 16, 30, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = b.lit ? '#9fdcef' : '#d9a634';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.quadraticCurveTo(-7, 6, -8, 16);
      ctx.quadraticCurveTo(-12, 22, -13, 25);
      ctx.lineTo(13, 25);
      ctx.quadraticCurveTo(12, 22, 8, 16);
      ctx.quadraticCurveTo(7, 6, 5, 4);
      ctx.quadraticCurveTo(0, 0, -5, 4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.arc(Math.sin(b.ang * 3) * 4, 26, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Ondas de sonido al tañer
      if (b.ringT > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(255, 246, 214, ${b.ringT / 50})`;
        ctx.lineWidth = 1.4;
        for (let k = 0; k < 2; k++) {
          const rr = 18 + (50 - b.ringT) * 0.9 + k * 10;
          ctx.beginPath(); ctx.arc(x, y + 12, rr, -0.9, 0.9); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y + 12, rr, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  function bellsStep(room) {
    if (!room.waterBells) return;
    for (const b of room.waterBells) {
      if (b.swing === undefined) { b.swing = 0; b.ang = 0; b.vang = 0; b.ringT = 0; }
      if (b.swing) { b.vang += b.swing * 0.12; b.swing = 0; }
      b.vang += -b.ang * 0.06; b.vang *= 0.95; b.ang += b.vang;
      if (b.ringT > 0) b.ringT--;
    }
  }

  // ---------------- instalación ----------------
  function install(g) {
    const p = g.player;
    const origPlayerUpdate = p.update.bind(p);
    p.update = (world, keys, cm) => {
      origPlayerUpdate(world, st.holding ? EMPTY_KEYS : keys, cm);
      try { swimStep(g); } catch (e) { console.error('[Agua]', e); }
    };

    const origDoAction = g.doAction.bind(g);
    g.doAction = (action) => {
      if (st.holding && action !== 'interact') return;          // plantado con el orbe
      if (action === 'jump' && st.swim && st.swimBody && g.isPlaying && !g.isPaused && !p.dead) { swimJump(g); return; }
      origDoAction(action);
    };

    const origUpdate = g.update.bind(g);
    g.update = (dt) => {
      const running = g.isPlaying && !g.isPaused;
      if (running) {
        st.t++;
        const room = g.world.getCurrentRoom();
        try {
          if (room.water) for (const wb of room.water) stepSim(wb);
          controlStep(g);
        } catch (e) { console.error('[Agua]', e); }
      }
      origUpdate(dt);
      if (running) {
        const room = g.world.getCurrentRoom();
        try {
          applyPose(g);
          objectsStep(g);
          shotsStep(g);
          stepDrops(room);
          bellsStep(room);
        } catch (e) { console.error('[Agua]', e); }
      } else {
        streamSound(0);
      }
      // Ambiente de agua: sigue en pausa / Diario; se apaga en el menú principal
      const room = g.world && g.world.getCurrentRoom();
      const wantAmb = g.isPlaying && room && room.water ? 1 : 0;
      st.ambLevel += (wantAmb - st.ambLevel) * 0.03;
      if (!g.isPlaying) st.ambLevel = 0;
      ambientSound(st.ambLevel, st.t);
    };

    const origLoad = g.loadRoom.bind(g);
    g.loadRoom = (index, sx = null, sy = null) => {
      st.holding = false; st.size = 0; st.swim = false; st.prevSwim = false; st.lastBody = null;
      for (const s of SHOTS) s.on = false;
      for (const d of DROPS) d.on = false;
      streamSound(0);
      origLoad(index, sx, sy);
    };

    const canvas = g.canvas;
    if (canvas) {
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        aim.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
        aim.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
        aim.mouseT = performance.now();
        aim.source = 'mouse';
      });
    }

    window.GameHooks.onRenderWorld.push((game, ctx, cam) => {
      try {
        const room = game.world.getCurrentRoom();
        drawBells(ctx, room, cam, st.t);
        if (room.water) drawWater(ctx, room, cam, st.t);
        drawDrops(ctx, cam);
        drawControl(ctx, game, cam, st.t);
      } catch (e) { console.error('[Agua]', e); }
    });
  }

  window.WaterControl = {
    learn: (g) => learn(g || window.gameInstance),
    isLearned: () => st.learned,
    getState: () => ({ learned: st.learned, swimming: st.swim, holding: st.holding, size: st.size })
  };
  window.GameHooks = window.GameHooks || { onInit: [], onRoomLoad: [], onUpdate: [], onRenderWorld: [], onAction: [] };
  window.GameHooks.onInit = window.GameHooks.onInit || [];
  window.GameHooks.onRenderWorld = window.GameHooks.onRenderWorld || [];
  window.GameHooks.onRestartGame = window.GameHooks.onRestartGame || [];
  window.GameHooks.onRestartGame.push(() => {
    st.learned = false;
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ }
    st.holding = false; st.size = 0;
    for (const s of SHOTS) s.on = false;
  });
  window.GameHooks.onInit.push((game) => {
    try { install(game); } catch (e) { console.error('[Agua] no se pudo iniciar:', e); }
  });
})();
