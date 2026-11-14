/**
 * Reacciones de los maestros a los poderes de Ruben - Ruben: En Busca de Angelo (Claude)
 *
 * AGUA (una bola lanzada o la esfera guiada los moja; water-power.js llama a `splash`):
 *  - Maestro del Agua (look 'water-master'): se encoge por el chapuzón, abre los dos brazos
 *    y el agua se le despega del cuerpo en gotas que se juntan en una bola sobre su cabeza;
 *    sube las manos bajo la bola, toma impulso y se la lanza a Ruben. No hace daño: lo
 *    empapa y lo empuja. Si Ruben la esquiva, queda un charco (sirve de fuente de agua).
 *  - Los demás (el pastor): se encogen, se sacuden el agua como un perro y protestan.
 * AIRE (la franja de wind-pull.js los alcanza): solo reaccionan el pelo y los ojos. El pelo
 *  (cejas, bigote, barba) vuela en la dirección del viento y aletea; con el viento de cara
 *  entrecierran los ojos, y la primera ráfaga los sorprende (ojos bien abiertos).
 *
 * Este archivo solo calcula el estado y lo deja en `npc.fx`; el dibujo de cada personaje
 * está en npcs.js (lee `npc.fx`). Acá se dibuja lo que va por delante: las gotas que se
 * juntan, la bola y el globo de texto.
 *
 * API: window.NpcReactions.hitTest(room, x, y, r) → NPC o null · .splash(game, npc, vol, vx)
 *   · .REST (pose en reposo, para npcs.js)
 * Hooks: onBeforeUpdate · onBeforeRoomLoad · onRenderWorld (ver MAPA.md). Pools fijos.
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const GRAV = 0.2;
  // Línea de tiempo del Maestro del Agua (cuadros)
  const T_HIT = 16, T_GATHER = 72, T_WINDUP = 88, T_THROW = 98, T_END = 128;
  const T_LAUNCH = T_WINDUP + 3;
  // Línea de tiempo de quien solo se sacude
  const S_HIT = 16, S_SHAKE = 62, S_END = 100;

  // Poses de las manos, relativas a los pies: x hacia donde mira, y hacia arriba negativa.
  // [mano de adelante x, y, mano de atrás x, y]
  const POSE = {
    rest: [17, -27, -8, -24],
    spread: [26, -37, -26, -37],
    raise: [6, -67, -6, -67],
    windup: [-3, -66, -14, -61],
    thrust: [25, -43, 17, -50]
  };
  const REST = {
    wind: 0, flut: 0, squint: 0, startle: 0, wet: 0,
    phase: '', t: 0, vol: 0, face: 0, eyes: '',
    arms: 0, h1x: POSE.rest[0], h1y: POSE.rest[1], h2x: POSE.rest[2], h2y: POSE.rest[3],
    flinch: 0, shake: 0, lean: 0,
    ballR: 0, ballX: 0, ballY: -80, say: '', sayT: 0
  };
  function fxOf(n) { return n.fx || (n.fx = Object.assign({}, REST)); }
  const isWaterMaster = (n) => n.look === 'water-master';
  const ease = (k) => { k = k < 0 ? 0 : k > 1 ? 1 : k; return k * k * (3 - 2 * k); };

  let clock = 0;

  // ---------------- gotas que se juntan (pool fijo) ----------------
  const MOTES = [];
  for (let i = 0; i < 28; i++) MOTES.push({ on: false, npc: null, sx: 0, sy: 0, cx: 0, cy: 0, x: 0, y: 0, t: 0, dur: 1, r: 2 });
  function spawnMote(n, fx) {
    for (const m of MOTES) {
      if (m.on) continue;
      const side = Math.random() < 0.5 ? -1 : 1;
      m.on = true; m.npc = n; m.t = 0; m.dur = 16 + Math.random() * 10; m.r = 1.6 + Math.random() * 1.6;
      // Sale de algún punto del cuerpo empapado y hace una curva hacia afuera antes de subir
      m.sx = n.x + side * (4 + Math.random() * 12); m.sy = n.y - 8 - Math.random() * 40;
      m.cx = m.sx + side * (22 + Math.random() * 18); m.cy = m.sy - 8 - Math.random() * 14;
      m.x = m.sx; m.y = m.sy;
      return;
    }
  }
  function stepMotes() {
    for (const m of MOTES) {
      if (!m.on) continue;
      const fx = m.npc.fx;
      if (!fx || fx.phase !== 'gather') { m.on = false; continue; }
      m.t++;
      const u = ease(m.t / m.dur), v = 1 - u;
      const tx = m.npc.x + fx.face * fx.ballX, ty = m.npc.y + fx.ballY;
      m.x = v * v * m.sx + 2 * v * u * m.cx + u * u * tx;
      m.y = v * v * m.sy + 2 * v * u * m.cy + u * u * ty;
      if (m.t >= m.dur) m.on = false;
    }
  }

  // ---------------- bolas devueltas (pool fijo) ----------------
  const BALLS = [];
  for (let i = 0; i < 3; i++) BALLS.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 8, vol: 0.5, t: 0 });
  function launchBall(g, n, fx) {
    const WC = window.WaterCore;
    const p = g.player;
    const x = n.x + fx.face * fx.ballX, y = n.y + fx.ballY;
    const tx = p.x + p.width / 2, ty = p.y + p.height / 2;
    const dx = tx - x, dy = ty - y;
    // Tiro parabólico que cae justo donde está Ruben ahora (si se mueve, la esquiva)
    const T = Math.max(16, Math.min(46, Math.hypot(dx, dy) / 8));
    for (const b of BALLS) {
      if (b.on) continue;
      b.on = true; b.x = x; b.y = y; b.t = 0; b.r = fx.ballR; b.vol = fx.vol;
      b.vx = dx / T; b.vy = dy / T - 0.5 * GRAV * T;
      break;
    }
    if (WC) { WC.playWhoosh(0.5 + fx.vol * 0.5); WC.burst(x, y, 5, 2); }
  }
  function ballSplash(g, b, puddle) {
    const WC = window.WaterCore;
    b.on = false;
    if (!WC) return;
    WC.burst(b.x, b.y, 10 + Math.round(b.vol * 12), 2.8 + b.vol * 2);
    for (let i = 0; i < 4; i++) WC.spawnMist(b.x + (Math.random() - 0.5) * 16, b.y, (Math.random() - 0.5) * 2, -0.5 - Math.random(), 3 + Math.random() * 3);
    WC.playSplash(0.4 + b.vol * 0.4);
    if (window.particleSystem) window.particleSystem.createShockwave(b.x, b.y, 14 + b.vol * 14, 'rgba(200, 236, 255, 0.85)', 2);
    if (puddle) WC.addPuddle(g, b.x, b.y - b.r - 2, b.vol * 0.8);
  }
  // Empapa a Ruben: sin daño, lo empuja y lo hace dar un saltito
  function soakPlayer(g, b) {
    const p = g.player;
    p.vx = Math.sign(b.vx || 1) * (2.6 + 3 * b.vol);
    p.vy = Math.min(p.vy, -3.2);
    if (p.anim) { p.anim.sx = 0.8; p.anim.vsx = 0; }
    if (g.rumble) g.rumble(0.35, 120);
    if (g.triggerScreenShake) g.triggerScreenShake(3, 120);
    b.x = p.x + p.width / 2; b.y = p.y + p.height / 2;
    ballSplash(g, b, false);
    // El agua que le chorrea queda a sus pies
    if (window.WaterCore) window.WaterCore.addPuddle(g, b.x, p.y + p.height - 6, b.vol * 0.6);
  }
  function stepBalls(g, room) {
    const WC = window.WaterCore;
    const p = g.player;
    let plats = null;
    for (const b of BALLS) {
      if (!b.on) continue;
      b.t++;
      b.vy += GRAV; b.x += b.vx; b.y += b.vy;
      if (WC && b.t % 2 === 0) WC.spawnDrop(b.x - b.vx * 0.5, b.y - b.vy * 0.5, b.vx * 0.1 + (Math.random() - 0.5), b.vy * 0.1, 1 + b.vol * 1.4, false);
      // Ruben
      if (!p.dead) {
        const nx = Math.max(p.x, Math.min(b.x, p.x + p.width)), ny = Math.max(p.y, Math.min(b.y, p.y + p.height));
        if ((b.x - nx) * (b.x - nx) + (b.y - ny) * (b.y - ny) <= b.r * b.r) { soakPlayer(g, b); continue; }
      }
      // Laguna: se funde con ella
      const wb = WC ? WC.bodyAt(room, b.x, b.y, 0) : null;
      if (wb && b.y >= WC.surfaceAt(wb, b.x)) {
        WC.splashAt(wb, b.x, 4 + b.vol * 6, 3);
        b.y = WC.surfaceAt(wb, b.x);
        ballSplash(g, b, false);
        continue;
      }
      // Suelo y paredes: revienta y deja un charco
      plats = plats || g.world.getPlatforms();
      let hit = false;
      for (const pl of plats) {
        if (b.x + b.r > pl.x && b.x - b.r < pl.x + pl.w && b.y + b.r > pl.y && b.y - b.r < pl.y + pl.h) { hit = true; break; }
      }
      if (hit || b.t > 150) { ballSplash(g, b, true); continue; }
      if (b.x < -60 || b.x > room.width + 60 || b.y > room.height + 60) b.on = false;
    }
  }

  // ---------------- viento: pelo y ojos ----------------
  function windStep(n, fx) {
    const WP = window.WindPull;
    let target = 0;
    if (WP && WP.forceAt) {
      const f = WP.forceAt(n.x, n.y - 40, 22);
      if (f > 0) {
        const b = WP.getBand();
        // Soplar empuja el pelo hacia donde apunta el viento; jalar lo trae hacia Ruben
        let wx = b.dirX * (b.mode === 'push' ? 1 : -1);
        if (Math.abs(wx) < 0.35) wx = wx < 0 ? -0.35 : 0.35;
        target = Math.max(-1, Math.min(1, f * wx * 1.5));
      }
    }
    const before = Math.abs(fx.wind);
    fx.wind += (target - fx.wind) * (target ? 0.16 : 0.07);   // entra rápido, se calma despacio
    if (Math.abs(fx.wind) < 0.004 && !target) fx.wind = 0;
    const now = Math.abs(fx.wind);
    // La primera ráfaga lo sorprende
    if (before < 0.22 && now >= 0.22 && Math.abs(target) > now) fx.startle = 16;
    if (fx.startle > 0) fx.startle--;
    fx.flut = now * (Math.sin(clock * 0.85 + n.x) * 0.7 + Math.sin(clock * 0.37 + n.x * 0.3) * 0.5);
    // Viento de cara → entrecierra los ojos (face = hacia dónde mira; lo escribe npcs.js)
    const face = fx.look || n.facing || 1;
    const into = -fx.wind * face;
    const sq = into > 0.12 ? Math.min(1, into * 1.7) : 0;
    fx.squint += (sq - fx.squint) * 0.2;
    if (fx.squint < 0.01) fx.squint = 0;
  }

  // ---------------- agua ----------------
  function moveHands(fx, pose, rate) {
    fx.h1x += (pose[0] - fx.h1x) * rate; fx.h1y += (pose[1] - fx.h1y) * rate;
    fx.h2x += (pose[2] - fx.h2x) * rate; fx.h2y += (pose[3] - fx.h2y) * rate;
  }
  function endReaction(fx) {
    fx.phase = ''; fx.t = 0; fx.eyes = ''; fx.arms = 0; fx.flinch = 0; fx.shake = 0; fx.lean = 0;
    fx.ballR = 0; fx.vol = 0; fx.wet = 0;
    fx.h1x = POSE.rest[0]; fx.h1y = POSE.rest[1]; fx.h2x = POSE.rest[2]; fx.h2y = POSE.rest[3];
  }
  function drip(n, fx) {
    const WC = window.WaterCore;
    if (WC && fx.wet > 0.1 && clock % 5 === 0) {
      WC.spawnDrop(n.x + (Math.random() - 0.5) * 26, n.y - 6 - Math.random() * 44, 0, 0.2, 1.2 + Math.random() * 1.2, false);
    }
  }

  // Maestro del Agua: se quita el agua de encima, la junta en una bola y la devuelve
  function masterStep(g, n, fx) {
    const t = ++fx.t;
    const p = g.player;
    const targetR = 6 + 9 * Math.min(1, fx.vol);
    if (t < T_WINDUP) fx.face = p.x + p.width / 2 >= n.x ? 1 : -1;
    if (t <= T_HIT) {
      // Chapuzón: se encoge con los ojos apretados
      fx.phase = 'hit'; fx.eyes = 'shut';
      fx.flinch = Math.sin(Math.PI * t / T_HIT);
      fx.arms = ease(t / T_HIT) * 0.4;
      moveHands(fx, POSE.spread, 0.12);
      drip(n, fx);
    } else if (t <= T_GATHER) {
      // Abre los brazos (el agua se despega) y los sube bajo la bola que se va formando
      fx.phase = 'gather'; fx.eyes = 'calm'; fx.flinch = 0;
      const k = (t - T_HIT) / (T_GATHER - T_HIT);
      fx.arms = Math.min(1, fx.arms + 0.09);
      moveHands(fx, k < 0.42 ? POSE.spread : POSE.raise, k < 0.42 ? 0.24 : 0.1);
      if (k < 0.8 && t % 2 === 0) spawnMote(n, fx);
      fx.wet = Math.max(0, 1 - k * 1.25);
      fx.ballR = targetR * ease(k * 1.1);
      drip(n, fx);
    } else if (t <= T_WINDUP) {
      // Toma impulso: se echa hacia atrás con la bola en alto
      fx.phase = 'windup'; fx.eyes = 'open'; fx.ballR = targetR; fx.wet = 0;
      moveHands(fx, POSE.windup, 0.25);
      fx.lean += (-0.14 - fx.lean) * 0.25;
    } else if (t <= T_THROW) {
      // Lanza con los dos brazos
      fx.phase = 'throw'; fx.eyes = 'open';
      moveHands(fx, POSE.thrust, 0.55);
      fx.lean += (0.2 - fx.lean) * 0.5;
      if (t === T_LAUNCH) { launchBall(g, n, fx); fx.ballR = 0; }
    } else if (t <= T_END) {
      // Vuelve a su pose, satisfecho
      fx.phase = 'recover'; fx.eyes = 'happy';
      const k = (t - T_THROW) / (T_END - T_THROW);
      fx.arms = 1 - ease(k);
      moveHands(fx, POSE.rest, 0.12);
      fx.lean *= 0.85;
      if (t === T_THROW + 6) { fx.say = 'El agua siempre vuelve'; fx.sayT = 110; }
    } else {
      endReaction(fx);
      return;
    }
    // La bola se forma sobre la cabeza y después viaja con las manos
    if (fx.ballR > 0) {
      const held = fx.phase === 'gather' ? ease((t - T_HIT) / (T_GATHER - T_HIT) * 1.4 - 0.4) : 1;
      const mx = (fx.h1x + fx.h2x) / 2, my = (fx.h1y + fx.h2y) / 2 - fx.ballR - 4;
      const bx = mx * held, by = (-74 - fx.ballR) * (1 - held) + my * held;
      fx.ballX += (bx - fx.ballX) * 0.5; fx.ballY += (by - fx.ballY) * 0.5;
    }
  }

  // Los demás: se sacuden el agua
  function shakeStep(g, n, fx) {
    const WC = window.WaterCore;
    const t = ++fx.t;
    fx.face = 0;
    if (t <= S_HIT) {
      fx.phase = 'hit'; fx.eyes = 'shut';
      fx.flinch = Math.sin(Math.PI * t / S_HIT);
      drip(n, fx);
    } else if (t <= S_SHAKE) {
      // Sacudida que se va apagando; las gotas salen despedidas a los dos lados
      fx.phase = 'shake'; fx.eyes = 'shut'; fx.flinch = 0;
      const k = (t - S_HIT) / (S_SHAKE - S_HIT);
      fx.shake = Math.sin(t * 1.7) * 3.2 * (1 - k * 0.7);
      fx.wet = 1 - k;
      if (WC && t % 2 === 0) {
        const side = Math.sin(t * 1.7) > 0 ? 1 : -1;
        WC.spawnDrop(n.x + side * 10, n.y - 14 - Math.random() * 34, side * (1.8 + Math.random() * 2.6), -1 - Math.random() * 2.2, 1.2 + Math.random() * 1.4, false);
      }
      if (t === S_HIT + 8) { fx.say = n.wetLine || '¡Brr! ¡Está helada!'; fx.sayT = 100; }
    } else if (t <= S_END) {
      fx.phase = 'recover'; fx.eyes = ''; fx.shake *= 0.6; fx.wet = 0;
    } else {
      endReaction(fx);
    }
  }

  function splash(g, n, vol, vx) {
    const WC = window.WaterCore;
    const fx = fxOf(n);
    if (WC) {
      WC.burst(n.x, n.y - 30, 8 + Math.round(vol * 10), 2.6 + vol * 1.6);
      WC.playSplash(0.35 + vol * 0.4);
    }
    if (g.rumble) g.rumble(0.2, 80);
    // Ocupado con las macetas: solo salpica
    if (n.busy) return;
    if (fx.phase && fx.phase !== 'recover') {
      // Ya estaba reaccionando: el agua nueva se suma a la que está juntando
      if (fx.phase === 'hit' || fx.phase === 'gather' || fx.phase === 'shake') fx.vol = Math.min(1.2, fx.vol + vol * 0.6);
      return;
    }
    const keepArms = fx.arms;
    endReaction(fx);
    fx.arms = keepArms;
    fx.phase = 'hit'; fx.t = 0; fx.vol = vol; fx.wet = 1;
    fx.ballX = 0; fx.ballY = -80;
    fx.sayT = 0;
    fx.wetDir = vx >= 0 ? 1 : -1;
  }

  // ¿La esfera (x, y, r) toca a algún NPC? (caja del cuerpo: 28 x 60 sobre los pies)
  function hitTest(room, x, y, r) {
    const list = room && room.npcs;
    if (!list) return null;
    for (const n of list) {
      const nx = Math.max(n.x - 14, Math.min(x, n.x + 14)), ny = Math.max(n.y - 60, Math.min(y, n.y));
      if ((x - nx) * (x - nx) + (y - ny) * (y - ny) <= r * r) return n;
    }
    return null;
  }

  // ---------------- ciclo ----------------
  function update(g) {
    clock++;
    const room = g.world && g.world.getCurrentRoom();
    if (!room) return;
    for (const n of room.npcs || []) {
      const fx = fxOf(n);
      windStep(n, fx);
      if (fx.phase) { if (isWaterMaster(n)) masterStep(g, n, fx); else shakeStep(g, n, fx); }
      if (fx.sayT > 0) fx.sayT--;
    }
    stepMotes();
    stepBalls(g, room);
  }

  // ---------------- dibujo (por delante de Ruben) ----------------
  function render(g, ctx, cam) {
    const room = g.world && g.world.getCurrentRoom();
    if (!room) return;
    const WC = window.WaterCore;
    // Gotas que vuelan del cuerpo a la bola
    ctx.save();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 0.9;
    for (const m of MOTES) {
      if (!m.on) continue;
      const u = m.t / m.dur;
      ctx.globalAlpha = Math.min(1, u * 5);
      ctx.fillStyle = '#bfe9f2';
      ctx.beginPath(); ctx.arc(m.x - cam.x, m.y - cam.y, m.r * (1 - u * 0.35), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath(); ctx.arc(m.x - cam.x - m.r * 0.3, m.y - cam.y - m.r * 0.3, m.r * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    for (const n of room.npcs || []) {
      const fx = n.fx;
      if (!fx) continue;
      if (fx.ballR > 0.5 && WC) {
        const bx = n.x + fx.face * fx.ballX - cam.x, by = n.y + fx.ballY - cam.y;
        // Halo que late mientras el maestro domina el agua
        ctx.save();
        const halo = ctx.createRadialGradient(bx, by, fx.ballR * 0.6, bx, by, fx.ballR * 2.2);
        halo.addColorStop(0, `rgba(170, 230, 255, ${0.3 + 0.12 * Math.sin(clock * 0.25)})`);
        halo.addColorStop(1, 'rgba(170, 230, 255, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(bx, by, fx.ballR * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        WC.drawOrb(ctx, bx, by, fx.ballR, clock);
      }
      if (fx.sayT > 0 && window.NPCs) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, fx.sayT / 12);
        window.NPCs.drawBubble(ctx, fx.say, n.x - cam.x, n.y - cam.y - 84 - Math.min(6, (110 - fx.sayT) * 0.5));
        ctx.restore();
      }
    }
    if (WC) for (const b of BALLS) if (b.on) WC.drawOrb(ctx, b.x - cam.x, b.y - cam.y, b.r, clock + b.t);
  }

  function clear() {
    for (const m of MOTES) m.on = false;
    for (const b of BALLS) b.on = false;
  }

  function install(g) {
    const H = window.GameHooks;
    H.onBeforeUpdate.push((game, running) => { if (running) update(game); });
    H.onBeforeRoomLoad.push((game) => {
      // Las reacciones a medias no siguen en otra sala
      const room = game.world && game.world.getCurrentRoom();
      for (const n of (room && room.npcs) || []) if (n.fx) { endReaction(n.fx); n.fx.wind = 0; n.fx.sayT = 0; }
      clear();
    });
    H.onRenderWorld.push((game, ctx, cam) => {
      try { render(game, ctx, cam); } catch (e) { console.error('[Reacciones]', e); }
    });
  }

  window.NpcReactions = { hitTest, splash, REST, isReacting: (n) => !!(n.fx && (n.fx.phase || n.fx.sayT > 0)) };
  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Reacciones] no se pudo iniciar:', e); }
  });
})();
