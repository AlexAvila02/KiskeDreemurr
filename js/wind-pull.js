/**
 * Habilidad "Jalar el Aire" - Ruben: En Busca de Angelo (Claude)
 *
 * Mantener ABAJO + L2 (mando) o ABAJO + F / Shift izq. (teclado, reasignable en Controles):
 *   - Ruben se planta (agachado, inclinado hacia atrás, palma abierta) y empieza a jalar el aire.
 *   - Frente a él aparece una franja de viento en forma de embudo que crece hasta ~360 px.
 *   - Todo insecto (escarabajo o polilla) que entra a la franja queda atrapado en el aire:
 *     deja de moverse por su cuenta, aletea/patalea indefenso y es arrastrado lentamente
 *     hacia la mano de Ruben, donde queda flotando. Atrapado no puede lastimar a Ruben.
 *   - Al soltar, los insectos quedan mareados ~1 s (caen y ven estrellitas): momento de dar
 *     el tajo. Recibir un golpe, saltar del borde o cambiar de sala corta la habilidad.
 *
 * Integración: GameHooks onBeforeUpdate / onAfterUpdate / onAction / onFreezeInput /
 * onBeforeRoomLoad (ver MAPA.md); dibuja en GameHooks.onRenderWorld. La pose de Ruben se dibuja en player.js leyendo
 * `player.setArmPose('wind', pose, ángulo)`. Sin basura por cuadro: corrientes y hojas en arreglos fijos.
 *
 * Apuntado: mientras está activa, la franja apunta hacia el cursor del ratón o hacia donde
 * se incline el stick derecho del mando (gana el último que se movió). Sin ninguno de los
 * dos, apunta hacia adelante y Izquierda/Derecha giran a Ruben. Vale para jalar y soplar.
 *
 * API: window.WindPull.isActive() · window.WindPull.getState()
 */
(function () {
  'use strict';

  const RANGE = 360;          // largo máximo de la franja
  const HALF_FAR = 48;        // media altura de la franja en el extremo lejano
  const HALF_NEAR = 18;       // media altura junto a la mano (forma de embudo)
  const PULL_SPEED = 1.05;    // px por cuadro con potencia completa ("lentamente")
  const HOLD_GAP = 22;        // distancia a la mano donde quedan flotando los insectos
  const STUN_FRAMES = 80;     // mareo al soltarlos

  const TINT = {
    pradera: [255, 244, 220],
    bosque: [224, 246, 222],
    montana: [226, 242, 255],
    castillo: [255, 236, 206]
  };
  const BITS = {
    pradera: ['#a5b84d', '#e0b84a', '#c98a3a'],
    bosque: ['#5c9963', '#86c063', '#3f7a4a'],
    montana: ['#ffffff', '#eef6fc', '#d6e8f5'],
    castillo: ['#c99b42', '#e8c97a', '#8c2732']
  };

  const state = {
    unlocked: false,
    active: false,
    power: 0,        // 0..1 (crece al mantener)
    pose: 0,         // 0..1 (suavizado para la animación de Ruben)
    facing: 1,
    mode: 'pull',    // 'pull' (Abajo + L2) o 'push' (Arriba + L2)
    cooldown: 0,
    caught: [],      // enemigos atrapados ahora
    stunned: [],     // enemigos mareados tras soltar
    t: 0,
    // Apuntado (ratón o stick derecho del mando). angle en el marco del mundo (0 = derecha).
    angle: 0,
    dirX: 1,
    dirY: 0,
    rel: 0           // ángulo relativo a donde mira Ruben (0 = adelante, <0 = arriba)
  };

  // Fuente de apuntado: 'none' (horizontal, hacia donde mira), 'mouse' o 'stick'.
  // Gana la última que se usó.

  // Corrientes de aire (pool fijo)
  const streaks = [];
  for (let i = 0; i < 34; i++) streaks.push({ u: Math.random(), v: Math.random() * 2 - 1, sp: 0.006 + Math.random() * 0.008, len: 10 + Math.random() * 22, ph: Math.random() * 6.28 });
  // Hojitas / copos / motas (pool fijo)
  const bits = [];
  for (let i = 0; i < 12; i++) bits.push({ u: Math.random(), v: Math.random() * 2 - 1, sp: 0.004 + Math.random() * 0.006, rot: Math.random() * 6.28, c: i % 3, s: 2 + Math.random() * 2 });

  // ---------------- sonido de viento (ruido filtrado) ----------------
  // Ruido grave (marrón) → bandpass que sube con la potencia (sound-kit.js)
  let windLoop = null;
  function startSound() {
    if (windLoop) return;
    windLoop = window.SoundKit.loop('brown', { type: 'bandpass', freq: 420, Q: 0.9 });
  }
  function updateSound() {
    if (!windLoop) return;
    windLoop.setLevel(0.16 * state.power, 0.08);
    windLoop.setFreq(380 + state.power * 520 + Math.sin(state.t * 0.09) * 120, 0.1);
  }
  function stopSound() {
    if (!windLoop) return;
    windLoop.stop(0.06, 0.3);
    windLoop = null;
  }

  // ---------------- geometría de la franja ----------------
  function handPoint(p) {
    return { x: p.x + p.width / 2 + state.dirX * 16, y: p.y + 19 + state.dirY * 14 };
  }

  // ---------------- apuntado ----------------
  function setAngle(a) {
    state.angle = a;
    state.dirX = Math.cos(a);
    state.dirY = Math.sin(a);
    // Ruben se da vuelta según hacia dónde apunta (con margen cerca de la vertical)
    if (state.dirX > 0.15) state.facing = 1;
    else if (state.dirX < -0.15) state.facing = -1;
    state.rel = Math.atan2(state.dirY, state.dirX * state.facing);
  }
  // Ángulo deseado este cuadro (o null = mantener el actual). Ratón / stick: aim.js
  function targetAngle(g, p) {
    if (window.Aim.source() !== 'none') return window.Aim.target(g, p.x + p.width / 2, p.y + 19);
    // Sin ratón ni stick: horizontal; izquierda/derecha giran a Ruben plantado
    const cm = g.controlsManager;
    if (cm && cm.isActive('moveLeft', g.keys)) return Math.PI;
    if (cm && cm.isActive('moveRight', g.keys)) return 0;
    return state.facing > 0 ? 0 : Math.PI;
  }
  function updateAim(g, p) {
    const want = targetAngle(g, p);
    if (want === null) return;
    // Giro suave por el camino más corto
    let d = want - state.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    setAngle(Math.abs(d) < 0.01 ? want : state.angle + d * 0.35);
  }
  function currentReach() {
    const e = 1 - Math.pow(1 - state.power, 3);
    return RANGE * e;
  }
  function halfAt(u) { return HALF_NEAR + (HALF_FAR - HALF_NEAR) * u; }
  // ¿El punto (x, y) está dentro de la franja? Devuelve u (0 = mano, 1 = extremo) o -1
  function bandU(p, x, y) {
    const h = handPoint(p);
    const reach = currentReach();
    if (reach < 4) return -1;
    const rx = x - h.x, ry = y - h.y;
    const along = rx * state.dirX + ry * state.dirY;
    if (along < -10 || along > reach) return -1;
    const perp = ry * state.dirX - rx * state.dirY;
    const u = Math.max(0, along / RANGE);
    return Math.abs(perp) <= halfAt(u) + 6 ? u : -1;
  }

  // ---------------- enemigos atrapados ----------------
  function caughtUpdate() { /* el viento lo controla: sin IA ni daño por contacto */ }
  function captureRender(ctx, camera) {
    const w = this.__wind;
    const cx = this.x + this.width / 2 - camera.x, cy = this.y + this.height / 2 - camera.y;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(w.spin);
    ctx.scale(1 + Math.sin(w.t * 0.5) * 0.06, 1 - Math.sin(w.t * 0.5) * 0.06);
    ctx.translate(-cx, -cy);
    Object.getPrototypeOf(this).render.call(this, ctx, camera);
    ctx.restore();
    if (w.stun > 0) drawDizzy(ctx, cx, cy - this.height / 2 - 6, w.t);
  }
  function drawDizzy(ctx, x, y, t) {
    ctx.save();
    ctx.fillStyle = '#ffe28a';
    ctx.strokeStyle = '#3a2416';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const a = t * 0.15 + i * 2.094;
      const sx = x + Math.cos(a) * 11, sy = y + Math.sin(a) * 3.5;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 1.4 : 3.4;
        const ang = -Math.PI / 2 + k * Math.PI / 5;
        if (k === 0) ctx.moveTo(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r);
        else ctx.lineTo(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------- colisiones (el viento no atraviesa suelo, techos ni muros) ----------------
  function overlaps(e, pl) {
    return e.x < pl.x + pl.w && e.x + e.width > pl.x && e.y < pl.y + pl.h && e.y + e.height > pl.y;
  }
  // Mueve al insecto chocando con las plataformas; devuelve true si se apoyó sobre algo
  function moveCollide(e, dx, dy, world) {
    const plats = world.getPlatforms();
    let landed = false;
    if (dx) {
      e.x += dx;
      for (const pl of plats) {
        if (!overlaps(e, pl)) continue;
        if (dx > 0) e.x = pl.x - e.width; else e.x = pl.x + pl.w;
      }
    }
    if (dy) {
      e.y += dy;
      for (const pl of plats) {
        if (!overlaps(e, pl)) continue;
        if (dy > 0) { e.y = pl.y - e.height; landed = true; } else e.y = pl.y + pl.h;
      }
    }
    return landed;
  }
  // Si quedó metido dentro de una plataforma, lo saca hacia arriba (o abajo si es un techo)
  function unstick(e, world) {
    for (const pl of world.getPlatforms()) {
      if (!overlaps(e, pl)) continue;
      const upGap = (e.y + e.height) - pl.y;
      const downGap = (pl.y + pl.h) - e.y;
      if (upGap <= downGap) e.y = pl.y - e.height; else e.y = pl.y + pl.h;
    }
  }

  function capture(e) {
    if (e.__wind) { e.__wind.stun = 0; if (state.stunned.includes(e)) state.stunned.splice(state.stunned.indexOf(e), 1); }
    else e.__wind = { t: Math.random() * 10, spin: 0, stun: 0, vy: 0, seed: Math.random() * 6.28 };
    e.update = caughtUpdate;
    e.render = captureRender;
    if ('knockbackVx' in e) e.knockbackVx = 0;
    if ('knockbackVy' in e) e.knockbackVy = 0;
    state.caught.push(e);
    const g = window.gameInstance;
    if (g && g.rumble) g.rumble(0.25, 90);
    if (window.particleSystem) window.particleSystem.createDust(e.x + e.width / 2, e.y + e.height / 2, 6, '#f5ecd8');
  }
  function release(e, stun) {
    if (!e.__wind) return;
    if (stun && e.alive) {
      e.__wind.stun = STUN_FRAMES;
      e.__wind.vy = 0;
      state.stunned.push(e);
      // Sigue sin IA mientras está mareado (update propio en stunStep)
    } else {
      delete e.update;
      delete e.render;
      delete e.__wind;
    }
  }
  function releaseAll(stun) {
    for (const e of state.caught) release(e, stun);
    state.caught.length = 0;
  }
  function clearAll() {
    releaseAll(false);
    for (const e of state.stunned) { delete e.update; delete e.render; delete e.__wind; }
    state.stunned.length = 0;
  }

  function pullStep(e, p, idx) {
    const w = e.__wind;
    w.t++;
    if (!e.alive) return false;
    const h = handPoint(p);
    const cx = e.x + e.width / 2, cy = e.y + e.height / 2;
    const gap = HOLD_GAP + Math.max(e.width, e.height) / 2 + idx * 8;
    const holdX = h.x + state.dirX * gap;
    const holdY = h.y + state.dirY * gap - 2 + Math.sin(w.t * 0.12 + w.seed) * 4 - idx * 5;
    const dx = holdX - cx, dy = holdY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = PULL_SPEED * (0.45 + state.power * 0.55) * (1 + Math.min(1, dist / 200) * 0.3);
    // Se acerca en línea recta hacia la mano, con un leve vaivén perpendicular a la franja
    const k = dist <= step || dist === 0 ? 1 : step / dist;
    const wob = Math.sin(w.t * 0.21 + w.seed) * 0.7;
    const mx = dx * k - state.dirY * wob;
    const my = dy * k + state.dirX * wob;
    const world = window.gameInstance.world;
    unstick(e, world);
    moveCollide(e, mx, my, world);
    // Aletea / patalea indefenso girando en el aire
    w.spin = Math.sin(w.t * 0.18 + w.seed) * 0.5 + (Math.abs(dx) > 4 ? -state.facing * 0.25 : 0);
    if ('flapT' in e) e.flapT += 0.6;     // la polilla aletea desesperada
    if ('animT' in e) e.animT += 0.5;     // el escarabajo mueve las patas
    if ('facing' in e) e.facing = -state.facing;
    if ('lookX' in e) e.lookX = -state.facing;
    if ('vy' in e) e.vy = 0;
    if ('vx' in e) e.vx = 0;
    if ('isGrounded' in e) e.isGrounded = false;
    // Hilitos de aire alrededor del atrapado
    if (w.t % 9 === 0 && window.particleSystem) window.particleSystem.createDust(e.x + e.width / 2, e.y + e.height / 2, 1, '#ffffff');
    return true;
  }

  function stunStep(e, world, room) {
    const w = e.__wind;
    w.t++;
    w.stun--;
    if (!e.alive || w.stun <= 0) {
      delete e.update; delete e.render; delete e.__wind;
      return false;
    }
    w.spin *= 0.9;
    const flier = 'originY' in e;
    unstick(e, world);
    // Empujón (p. ej. una bola de agua): se frena solo y respeta las plataformas
    const pvx = w.vx || 0;
    if (pvx) w.vx = Math.abs(pvx) < 0.08 ? 0 : pvx * 0.9;
    if (flier) {
      // La polilla baja flotando, pero se posa sobre el suelo en vez de hundirse
      const pvy = w.pvy || 0;
      if (pvy) w.pvy = Math.abs(pvy) < 0.08 ? 0 : pvy * 0.9;
      moveCollide(e, pvx, 0.35 + pvy, world);
    } else {
      // El escarabajo cae al suelo (con colisión real contra plataformas)
      w.vy = Math.min(8, w.vy + 0.45);
      if (moveCollide(e, pvx, w.vy, world)) {
        w.vy = 0;
        if ('isGrounded' in e) e.isGrounded = true;
      }
      if (e.y > room.height + 60) { e.alive = false; e.hp = 0; }
    }
    return true;
  }

  // ---------------- desbloqueo de habilidad ----------------
  function isUnlocked(g) {
    if (state.unlocked) return true;
    if (g && g.journal && g.journal.save && g.journal.save.notes && g.journal.save.notes['1:0']) {
      state.unlocked = true;
      return true;
    }
    try {
      const raw = window.localStorage.getItem('ruben_diario_v1');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.notes && data.notes['1:0']) {
          state.unlocked = true;
          return true;
        }
      }
    } catch (e) { /* */ }
    return false;
  }

  function checkUnlock(g) {
    if (state.unlocked) return;
    if (isUnlocked(g)) return;
    const r = g.world ? g.world.getCurrentRoom() : null;
    const isRoom1 = g.world && (g.world.currentRoomIndex === 1 || (r && r.id === 1));
    const activeNote = g.activeNote;
    if (isRoom1 && activeNote && (activeNote.style === 'aire' || (r.tablets && activeNote === r.tablets[0]))) {
      state.unlocked = true;
      if (window.soundManager && window.soundManager.playUnlockAbility) {
        window.soundManager.playUnlockAbility();
      }
      if (g.showNotification) {
        g.showNotification('✦ ¡Habilidad aprendida: Jalar el Aire! (Abajo + F / L2)');
      }
      if (window.particleSystem) {
        const px = g.player.x + g.player.width / 2;
        const py = g.player.y + g.player.height / 2;
        window.particleSystem.createDust(px, py, 14, '#cce8ff');
      }
    }
  }

  // ---------------- ciclo ----------------
  function wantsPull(g) {
    if (!isUnlocked(g)) return false;
    const cm = g.controlsManager;
    if (!cm) return false;
    const pad = g.getPad ? g.getPad() : null;
    const b6 = pad && pad.buttons && pad.buttons[6];
    g.keys.PadL2 = !!(b6 && (b6.pressed || b6.value > 0.35));
    if (!cm.isActive('windPull', g.keys)) return null;
    // Con una bola de agua en la mano, F / L2 es del agua (water.js)
    if (window.WaterControl && window.WaterControl.isHolding && window.WaterControl.isHolding()) return null;
    // Abajo + L2 = jalar (atrae) · Arriba + L2 = soplar (empuja hacia afuera)
    if (cm.isActive('aimUp', g.keys)) return 'push';
    if (cm.isActive('aimDown', g.keys)) return 'pull';
    return null;
  }

  const PUSH_SPEED = 2.6;     // px por cuadro con potencia completa al soplar
  // Soplar: aleja a los enemigos dentro de la franja (más fuerte cerca de la mano)
  function pushStep(e, p, u) {
    const world = window.gameInstance.world;
    const sp = PUSH_SPEED * (0.35 + state.power * 0.65) * (1 - u * 0.5);
    unstick(e, world);
    moveCollide(e, state.dirX * sp, state.dirY * sp, world);
    if ('knockbackVx' in e) e.knockbackVx = 0;
    if (state.t % 11 === 0 && window.particleSystem) window.particleSystem.createDust(e.x + e.width / 2, e.y + e.height / 2, 1, '#ffffff');
  }

  // ---------------- molino (salas con hasWindmill, p. ej. el Altozano del Molino) ----------------
  // Soplar hacia las aspas las hace girar: el sentido depende de qué lado del eje golpea el
  // viento (torque) y al dejar de soplar vuelven solas, con inercia, al giro tranquilo de siempre.
  const MILL_X = 930, MILL_Y = 78, MILL_R = 56;   // eje y largo de las aspas (coords de la sala)
  const MILL_BASE = 0.0117;                       // rad por cuadro (= el giro de siempre)
  const MILL_MAX = 0.32;
  const mill = { angle: (Date.now() * 0.0007) % (Math.PI * 2), vel: MILL_BASE, puff: 0 };
  function millStep(g) {
    const room = g.world.getCurrentRoom();
    if (!room || !room.hasWindmill) return;
    let push = 0;
    if (state.active && state.mode === 'push' && state.power > 0.05) {
      const h = handPoint(g.player);
      const rx = MILL_X - h.x, ry = MILL_Y - h.y;
      const along = rx * state.dirX + ry * state.dirY;
      const perp = ry * state.dirX - rx * state.dirY;
      const reach = currentReach();
      const u = Math.max(0, Math.min(1, along / RANGE));
      if (along > -MILL_R && along < reach + MILL_R * 0.6 && Math.abs(perp) < halfAt(u) + MILL_R) {
        // perp > 0 → torque horario (el mismo sentido del giro de siempre)
        const sign = Math.abs(perp) < 10 ? 1 : Math.sign(perp);
        const lever = Math.abs(perp) < 10 ? 0.6 : Math.min(1, 0.5 + Math.abs(perp) / MILL_R);
        const falloff = 1 - Math.max(0, along) / (RANGE + MILL_R) * 0.6;
        push = sign * state.power * lever * falloff;
      }
    }
    if (push) {
      mill.vel = Math.max(-MILL_MAX, Math.min(MILL_MAX, mill.vel + push * 0.0065));
    } else {
      mill.vel += (MILL_BASE - mill.vel) * 0.012; // frena despacio (inercia de las aspas)
    }
    mill.angle = (mill.angle + mill.vel) % (Math.PI * 2);
    // Girando rápido: polvillo que salta de la punta de las aspas
    if (Math.abs(mill.vel) > 0.12 && ++mill.puff % 7 === 0 && window.particleSystem) {
      const k = mill.angle + (mill.puff % 4) * Math.PI / 2;
      window.particleSystem.createDust(MILL_X + Math.cos(k) * MILL_R, MILL_Y + Math.sin(k) * MILL_R, 2, '#e8d2a6');
    }
  }

  function preUpdate(g) {
    checkUnlock(g);
    const p = g.player;
    state.t++;
    if (state.cooldown > 0) state.cooldown--;
    const hurt = p.anim && p.anim.hurtFlash > 0;
    // Sin energía elemental (js/stamina.js) no se puede activar ni seguir usando el viento
    const can = !p.dead && p.isGrounded && !p.isAttacking && !p.carriedItem && !hurt && state.cooldown === 0 && g.deathTimer <= 0 &&
      (!window.Stamina || window.Stamina.canUse());
    const want = wantsPull(g);

    // Cambio de modo en caliente (jalar ↔ soplar): suelta a los atrapados
    if (state.active && want && want !== state.mode) {
      releaseAll(true);
      state.mode = want;
    }

    if (state.active && (!want || !can)) {
      state.active = false;
      releaseAll(true);
      if (hurt) state.cooldown = 30;
    } else if (!state.active && want && can) {
      state.active = true;
      state.facing = p.facing || 1;
      // Arranca apuntando hacia donde mira Ruben (el ratón/stick lo corrige enseguida)
      setAngle(state.facing > 0 ? 0 : Math.PI);
      window.Aim.forgetStale();   // ratón quieto hace rato / stick suelto: apunta adelante
      state.power = 0;
      state.mode = want;
      startSound();
    }

    if (state.active) {
      updateAim(g, p);
      state.power = Math.min(1, state.power + 0.045);
      p.facing = state.facing;
      for (const e of g.enemies) {
        if (!e || !e.alive || state.caught.includes(e)) continue;
        const u = bandU(p, e.x + e.width / 2, e.y + e.height / 2);
        if (u < 0) continue;
        // Jalar: atrapa a los insectos · Soplar: los empuja lejos
        if (state.mode === 'push') pushStep(e, p, u); else capture(e);
      }
      if (window.AnimSystem && window.AnimSystem.spawnFX && state.t % 26 === 0) {
        const h = handPoint(p);
        try { window.AnimSystem.spawnFX('landing-ring', h.x, h.y, {}); } catch (e) { /* */ }
      }
    } else {
      state.power = Math.max(0, state.power - 0.12);
      if (state.power === 0) stopSound();
    }
    updateSound();
  }

  function postUpdate(g) {
    const p = g.player;
    const room = g.world.getCurrentRoom();
    // Arrastrar a los atrapados
    let idx = 0;
    for (let i = state.caught.length - 1; i >= 0; i--) {
      const e = state.caught[i];
      if (!g.enemies.includes(e) || !pullStep(e, p, idx)) { release(e, false); state.caught.splice(i, 1); continue; }
      idx++;
    }
    for (let i = state.stunned.length - 1; i >= 0; i--) {
      const e = state.stunned[i];
      if (!g.enemies.includes(e) || !stunStep(e, g.world, room)) state.stunned.splice(i, 1);
    }
    // Avance de corrientes y hojas
    // Al soplar, las corrientes y hojas viajan hacia afuera (sentido inverso)
    const spd = (0.6 + state.power) * (state.mode === 'push' ? -1.6 : 1);
    for (const s of streaks) {
      s.u -= s.sp * spd;
      if (s.u < 0.02) { s.u = 1; s.v = Math.random() * 2 - 1; s.len = 10 + Math.random() * 22; }
      else if (s.u > 1) { s.u = 0.03; s.v = Math.random() * 2 - 1; s.len = 10 + Math.random() * 22; }
    }
    for (const b of bits) {
      b.u -= b.sp * spd;
      b.rot += 0.2 * Math.abs(spd);
      if (b.u < 0.03) { b.u = 1; b.v = Math.random() * 2 - 1; }
      else if (b.u > 1) { b.u = 0.04; b.v = Math.random() * 2 - 1; }
    }
    // Pose de Ruben (suavizada)
    const target = state.active ? 1 : 0;
    state.pose += (target - state.pose) * (state.active ? 0.22 : 0.18);
    if (state.pose < 0.01 && !state.active) state.pose = 0;
    p.setArmPose('wind', state.pose, state.rel);   // brazo extendido (player.js)
    millStep(g);
  }

  // ---------------- dibujo ----------------
  function render(g, ctx, cam) {
    if (!g.isPlaying || g.isPaused) { if (windLoop && g.isPaused) stopSound(); return; }
    const pw = state.power;
    if (pw <= 0.01) return;
    const p = g.player;
    const biome = (g.world.getCurrentRoom().biome) || 'pradera';
    const tint = TINT[biome] || TINT.pradera;
    const h = handPoint(p);
    const reach = currentReach();
    const t = state.t;

    ctx.save();
    // Marco local de la franja: origen en la mano, eje x = hacia donde apunta.
    // Se espeja según hacia dónde mira Ruben y se gira por el ángulo relativo, así
    // el dibujo de siempre (hacia adelante) sirve para cualquier dirección.
    ctx.translate(h.x - cam.x, h.y - cam.y);
    ctx.scale(state.facing, 1);
    ctx.rotate(state.rel);
    const f = 1, hx = 0, hy = 0;
    // Bruma de aire sin bordes: manchas suaves a lo largo de la franja (no se ve el límite,
    // solo el aire que corre hacia Ruben)
    const steps = 6;
    for (let k = 0; k < steps; k++) {
      const u = (k + 0.5) / steps;
      const along = u * reach;
      const bx = hx + f * along;
      const by = hy + Math.sin(t * 0.05 + k) * 3;
      const r = halfAt(along / RANGE) * 1.15;
      const a = 0.16 * pw * (1 - u * 0.6);
      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      glow.addColorStop(0, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${a})`);
      glow.addColorStop(1, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Corrientes que viajan hacia la mano y se cierran en espiral
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    for (const s of streaks) {
      const along = s.u * RANGE;
      if (along > reach) continue;
      const half = halfAt(s.u);
      const x = hx + f * along;
      const y = hy + s.v * half * 0.85 + Math.sin(t * 0.07 + s.ph) * 3;
      const a = Math.sin(Math.min(1, s.u * 1.15) * Math.PI) * 0.75 * pw;
      if (a < 0.03) continue;
      ctx.globalAlpha = a;
      ctx.lineWidth = 1.2 + (1 - s.u) * 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + f * s.len * 0.5, y - s.v * 4, x + f * s.len, y - s.v * 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Hojitas / copos arrastrados
    const cols = BITS[biome] || BITS.pradera;
    for (const b of bits) {
      const along = b.u * RANGE;
      if (along > reach) continue;
      const x = hx + f * along;
      const y = hy + b.v * halfAt(b.u) * 0.75 + Math.sin(t * 0.1 + b.rot) * 4;
      ctx.globalAlpha = Math.min(1, b.u * 4) * pw;
      ctx.fillStyle = cols[b.c];
      ctx.strokeStyle = '#3a2416';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      if (biome === 'montana') ctx.arc(x, y, b.s * 0.7, 0, Math.PI * 2);
      else ctx.ellipse(x, y, b.s * 1.4, b.s * 0.7, b.rot, 0, Math.PI * 2);
      ctx.fill();
      if (biome !== 'montana') ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Remolino en la palma
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * pw})`;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const r = 6 + i * 4 + Math.sin(t * 0.2 + i) * 1.2;
      const a0 = t * (0.22 + i * 0.05) * -f + i * 2.1;
      ctx.beginPath();
      ctx.arc(hx + f * 3, hy, r, a0, a0 + 1.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------- instalación ----------------
  function install(g) {
    const H = window.GameHooks;
    // Plantado: Ruben no recibe teclas y no salta, ni ataca, ni agarra
    H.onFreezeInput.push(() => state.active);
    H.onAction.push((game, action) => state.active && action !== 'interact');
    H.onBeforeUpdate.push((game, running) => { if (running) preUpdate(game); });
    H.onAfterUpdate.push((game, running) => { if (running) postUpdate(game); });
    H.onBeforeRoomLoad.push(() => {
      clearAll();
      state.active = false;
      state.power = 0;
      stopSound();
    });

    window.GameHooks.onRenderWorld.push((game, ctx, cam) => {
      try { render(game, ctx, cam); } catch (e) { console.error('[Viento]', e); }
    });
  }

  const band = { power: 0, mode: 'pull', hx: 0, hy: 0, dirX: 1, dirY: 0, reach: 0, range: RANGE };
  window.WindPull = {
    isUnlocked: () => isUnlocked(window.gameInstance),
    isActive: () => state.active,
    // Ángulo de las aspas del molino (bg-continuity.js lo usa para dibujarlo)
    getMillAngle: () => mill.angle,
    // Franja de viento actual (la usan el agua y el pasto). Devuelve siempre el mismo
    // objeto (sin basura por cuadro); power = 0 cuando no sopla ni jala.
    getBand: () => {
      const g = window.gameInstance;
      if (!g || !g.player || state.power <= 0.01) { band.power = 0; return band; }
      const h = handPoint(g.player);
      band.power = state.power;
      band.mode = state.mode;
      band.hx = h.x; band.hy = h.y;
      band.dirX = state.dirX; band.dirY = state.dirY;
      band.reach = currentReach();
      return band;
    },
    // Aturde a un enemigo N cuadros (sin IA ni daño por contacto, estrellitas) con un
    // empujón opcional (vx, vy) que respeta las plataformas. Lo usa el agua (water.js).
    stun: (e, frames, vx = 0, vy = 0) => {
      if (!e || !e.alive) return;
      const ci = state.caught.indexOf(e);
      if (ci >= 0) state.caught.splice(ci, 1);
      if (!e.__wind) e.__wind = { t: Math.random() * 10, spin: 0, stun: 0, vy: 0, seed: Math.random() * 6.28 };
      const w = e.__wind;
      e.update = caughtUpdate;
      e.render = captureRender;
      w.stun = Math.max(w.stun, frames);
      w.vx = vx;
      w.spin = (vx >= 0 ? 1 : -1) * 0.5;
      if ('originY' in e) w.pvy = vy; else w.vy = vy;
      if ('knockbackVx' in e) e.knockbackVx = 0;
      if ('knockbackVy' in e) e.knockbackVy = 0;
      if ('vx' in e) e.vx = 0;
      if ('vy' in e) e.vy = 0;
      if (!state.stunned.includes(e)) state.stunned.push(e);
    },
    // Media altura de la franja a la distancia relativa u (0 = mano, 1 = extremo)
    bandHalf: (u) => halfAt(u),
    getState: () => ({ unlocked: isUnlocked(window.gameInstance), active: state.active, power: state.power, caught: state.caught.length, stunned: state.stunned.length })
  };
  window.GameHooks = window.GameHooks || { onInit: [], onRoomLoad: [], onUpdate: [], onRenderWorld: [], onAction: [] };
  window.GameHooks.onInit = window.GameHooks.onInit || [];
  window.GameHooks.onRenderWorld = window.GameHooks.onRenderWorld || [];
  window.GameHooks.onRestartGame = window.GameHooks.onRestartGame || [];
  window.GameHooks.onRestartGame.push(() => {
    state.unlocked = false;
    clearAll();
    state.active = false;
    state.power = 0;
    stopSound();
  });
  window.GameHooks.onInit.push((game) => {
    try { install(game); } catch (e) { console.error('[Viento] no se pudo iniciar:', e); }
  });
})();
