/**
 * Dominio del Agua - Ruben: En Busca de Angelo (Claude)
 * (Parte 3 de 3 del agua: water-core.js → water-quest.js → water-power.js)
 *
 * Se aprende con el Maestro del Agua (sala 12; npcs.js llama a WaterControl.learn).
 *    - Mantener F / Shift izq. (acción "windPull") o L2 SIN apretar arriba/abajo, con agua
 *      a menos de 320 px: el agua sube de la laguna (la superficie se levanta en ese punto)
 *      y forma un orbe en la mano de Ruben que crece mientras se mantiene.
 *    - Apuntar con el ratón o el stick derecho (sin ninguno: adelante y un poco arriba).
 *    - Soltar: el orbe sale disparado con gravedad real. Empuja y aturde enemigos (sin
 *      daño), rompe muros quebradizos, hace sonar campanas y deja un charco al caer.
 *    - Arriba/Abajo + F/L2 siguen siendo Soplar/Jalar el Aire (wind-pull.js).
 *    - La bola lanzada se deshace a los ~22 cuadros (alcance limitado).
 *    - LLEVARLA: con F / L2 mantenido Ruben camina y salta con la bola en la mano. Crece
 *      solo mientras está enganchada a una fuente (laguna o charco a <= 320 px); lejos de
 *      toda fuente se evapora despacio (60 s una bola llena). Pasa con él de sala en sala.
 *    - CHARCOS: el agua que cae (bola lanzada, esfera guiada, bola que se le cae) queda en
 *      el suelo como charco y se evapora (60 s uno lleno, también estando en otra sala).
 *      Un charco es fuente: se puede volver a levantar, pero solo el agua que le quede.
 *    - ENEMIGOS: el agua no hace daño. La bola lanzada los empuja y los aturde 3 s; la
 *      esfera guiada los atraviesa, los arrastra con su velocidad y también los aturde.
 *    - MAESTRÍA: cada lanzamiento agranda la esfera (radio x(1 + maestría)); al llegar a
 *      +77% la habilidad se mejora sola (se guarda en ruben_agua_maestria_v1).
 *    - ESFERA GUIADA (mejorada): G o L3 cerca del agua suelta una esfera del tamaño
 *      original que se guía por el aire con el stick izquierdo / flechas (sin gravedad,
 *      ~8 s). Toca campanas (también la del techo), daña enemigos y rompe muros. G / L3
 *      de nuevo la revienta.
 *
 * API pública: window.WaterControl.learn(game) · .isLearned() · .isUpgraded() · .isHolding()
 *   · .getState()
 * Hooks: onBeforeUpdate · onAfterUpdate · onAction · onFreezeInput · onBeforeRoomLoad ·
 *   onRestartGame · onRenderWorld (ver MAPA.md).
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const { ws, EVAP_FRAMES, surfaceAt, splashAt, bodyAt, spawnDrop, burst, addPuddle,
    playSplash, playWhoosh, streamSound } = window.WaterCore;
  const { ringBell, potCatch, fillPot } = window.WaterQuest;
  const SAVE_KEY = 'ruben_agua_v1';
  const MASTERY_KEY = 'ruben_agua_maestria_v1';
  const RANGE = 320;             // distancia máxima a la superficie para levantar agua
  // La bola lanzada se deshace al rato: su alcance es ~245 px hacia arriba / ~300 de lado,
  // por eso la campana del techo (sobre el maestro) solo se alcanza con la esfera guiada.
  const SHOT_LIFE = 22;
  // Maestría: cada lanzamiento agranda la esfera; al llegar a +77% se mejora la habilidad
  const MASTERY_MAX = 0.77;
  const BASE_R = 13;             // radio de la esfera "original" (orbe lleno sin maestría)
  const GUIDE_SPEED = 4.2, GUIDE_LIFE = 480;
  const STUN_WATER = 180;        // 3 s de aturdimiento al mojar a un enemigo

  // ---------------- estado ----------------
  const st = {
    learned: false,
    holding: false, size: 0, pose: 0, src: null, srcX: 0, angle: 0, rel: 0, facing: 1,
    noWaterMsgT: 0,
    mastery: 0, upgraded: false, l3Prev: false,
    connected: false, srcKind: 'body'   // ¿la bola está enganchada a una fuente? (laguna / charco)
  };
  // Esfera guiada (tras la mejora): se mueve por el aire con el stick izquierdo / flechas
  const guide = { on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, r: BASE_R, vol: 1 };
  const SHOTS = [];
  for (let i = 0; i < 6; i++) SHOTS.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 6, size: 0, t: 0 });

  function loadLearned() {
    try { return window.localStorage.getItem(SAVE_KEY) === '1'; } catch (e) { return false; }
  }
  st.learned = loadLearned();
  try { st.mastery = Math.min(MASTERY_MAX, parseFloat(window.localStorage.getItem(MASTERY_KEY)) || 0); } catch (e) { st.mastery = 0; }
  st.upgraded = st.mastery >= MASTERY_MAX - 1e-6;

  // Radio del orbe según lo cargado (0..1) y la maestría (hasta +77%)
  function orbRadius(size) { return (4 + 9 * size) * (1 + st.mastery); }

  function gainMastery(g, size) {
    if (st.upgraded) return;
    const before = st.mastery;
    st.mastery = Math.min(MASTERY_MAX, st.mastery + 0.045 * (0.3 + 0.7 * size));
    try { window.localStorage.setItem(MASTERY_KEY, String(st.mastery)); } catch (e) { /* */ }
    // Avisos a mitad de camino y al completar
    const pct = (m) => Math.round(m / MASTERY_MAX * 100);
    if (pct(before) < 50 && pct(st.mastery) >= 50 && g.showNotification) g.showNotification('El agua responde mejor: tu esfera está creciendo');
    if (st.mastery >= MASTERY_MAX - 1e-6) {
      st.upgraded = true;
      if (window.soundManager && window.soundManager.playUnlockAbility) window.soundManager.playUnlockAbility();
      if (g.showNotification) g.showNotification('✦ ¡Dominio del Agua mejorado! Esfera guiada: G / L3 y guíala con el stick');
      const p = g.player;
      burst(p.x + p.width / 2, p.y + 10, 22, 5);
      if (window.particleSystem) window.particleSystem.createShockwave(p.x + p.width / 2, p.y + 19, 40, 'rgba(170, 230, 255, 0.9)', 3);
    }
  }

  function learn(g) {
    if (st.learned) return;
    st.learned = true;
    try { window.localStorage.setItem(SAVE_KEY, '1'); } catch (e) { /* */ }
    if (window.soundManager && window.soundManager.playUnlockAbility) window.soundManager.playUnlockAbility();
    if (g && g.showNotification) g.showNotification('✦ ¡Habilidad aprendida: Dominio del Agua! (F / L2 cerca del agua)');
    if (g && g.player) burst(g.player.x + g.player.width / 2, g.player.y + 10, 18, 4.5);
  }


  // Moja a un enemigo: no le hace daño, lo empuja (con sus colisiones) y lo aturde 3 s
  function wetEnemy(g, e, vx, vy) {
    const WP = window.WindPull;
    if (WP && WP.stun) WP.stun(e, STUN_WATER, vx, vy);
    else if ('knockbackVx' in e) e.knockbackVx = vx;
    e.__wetT = ws.t;
    burst(e.x + e.width / 2, e.y + e.height / 2, 8, 2.6);
    playSplash(0.45);
  }

  // ---------------- Dominio del Agua ----------------
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
    // Con arriba/abajo es el viento (wind-pull.js)... salvo que ya lleve una bola en la mano
    if (!st.holding && (cm.isActive('aimUp', g.keys) || cm.isActive('aimDown', g.keys))) return false;
    return true;
  }
  // Busca la fuente de agua más cercana (laguna o charco) a ≤ RANGE de la mano.
  // Deja el resultado en st.src / st.srcKind / st.srcX y devuelve la fuente (o null).
  function nearestSource(g, minPuddle = 0.06) {
    const room = g.world.getCurrentRoom();
    const p = g.player;
    const hx = p.x + p.width / 2, hy = p.y + 19;
    let best = null, kind = '', bx = 0, bestD = RANGE;
    for (const wb of room.water || []) {
      const sx = Math.max(wb.x + 10, Math.min(wb.x + wb.w - 10, hx));
      const d = Math.hypot(hx - sx, hy - surfaceAt(wb, sx));
      if (d < bestD) { bestD = d; best = wb; kind = 'body'; bx = sx; }
    }
    for (const q of room.puddles || []) {
      if (q.vol < minPuddle) continue;
      const d = Math.hypot(hx - q.x, hy - q.y);
      if (d < bestD) { bestD = d; best = q; kind = 'puddle'; bx = q.x; }
    }
    if (best) { st.src = best; st.srcKind = kind; st.srcX = bx; }
    return best;
  }
  function srcY() { return st.srcKind === 'body' ? surfaceAt(st.src, st.srcX) : st.src.y - 2; }
  function srcStillThere(g) {
    if (!st.src) return false;
    const room = g.world.getCurrentRoom();
    if (st.srcKind === 'puddle' && (!(room.puddles || []).includes(st.src) || st.src.vol <= 0.03)) return false;
    if (st.srcKind === 'body' && !(room.water || []).includes(st.src)) return false;
    const p = g.player;
    return Math.hypot(p.x + p.width / 2 - st.srcX, p.y + 19 - srcY()) <= RANGE + 40;
  }
  function updateAim(g) {
    const p = g.player;
    const Aim = window.Aim;
    // Ratón quieto hace rato = sin apuntado (así Ruben puede girar al caminar con la bola)
    Aim.forgetStale(guide.on);
    if (Aim.source() === 'none') st.facing = p.facing || st.facing;
    let want = Aim.target(g, p.x + p.width / 2, p.y + 19);
    if (want === null && Aim.source() !== 'stick') want = st.facing > 0 ? -0.35 : Math.PI + 0.35;
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
      const off = 6 + orbRadius(size);
      s.on = true; s.x = h.x + Math.cos(st.angle) * off; s.y = h.y + Math.sin(st.angle) * off;
      s.vx = Math.cos(st.angle) * sp; s.vy = Math.sin(st.angle) * sp;
      s.r = orbRadius(size); s.size = size; s.t = 0;
      break;
    }
    playWhoosh(size);
    gainMastery(g, size);
    if (p.anim) { p.anim.sx = 0.86; p.anim.vsx = 0; }
    if (g.rumble) g.rumble(0.3, 90);
  }

  // La bola se cae de la mano: salpica y deja su charco en el suelo
  function popOrb(g) {
    const h = handPos(g.player);
    burst(h.x, h.y, 6 + Math.round(st.size * 10), 2.5);
    playSplash(0.3);
    addPuddle(g, h.x, h.y, st.size * 0.9);
  }
  function endHold() { st.holding = false; st.size = 0; st.connected = false; st.src = null; }

  // Sostener F / L2: Ruben puede caminar y saltar con la bola en la mano.
  //  - Conectada a una fuente (laguna o charco a ≤ RANGE): la bola crece (del charco solo
  //    saca lo que el charco tiene).
  //  - Lejos de toda fuente (o en otra sala): deja de crecer y se evapora despacio.
  //  - Soltar el botón: la lanza. Recibir un golpe o caer al agua: se le cae.
  function controlStep(g) {
    const p = g.player;
    const hurt = p.anim && p.anim.hurtFlash > 0;
    const blocked = guide.on || p.dead || ws.swim || !!p.carriedItem || g.deathTimer > 0 ||
      !!(window.WindPull && window.WindPull.isActive && window.WindPull.isActive()) ||
      // Sin energía elemental (js/stamina.js) no se puede sostener el agua
      (!!window.Stamina && !window.Stamina.canUse());
    const want = wantsWater(g);

    if (st.holding) {
      if (hurt || p.dead || ws.swim) {
        if (st.size > 0.05 && !ws.swim) popOrb(g);
        endHold();
      } else if (!want || blocked) {
        if (st.size > 0.12) shoot(g); else if (st.size > 0.04) popOrb(g);
        endHold();
      }
    } else if (want && !blocked && !hurt && p.isGrounded) {
      if (nearestSource(g)) {
        st.holding = true;
        st.connected = true;
        st.size = 0;
        st.facing = p.facing || 1;
        st.angle = st.facing > 0 ? -0.35 : Math.PI + 0.35;
        playSplash(0.25);
      } else if (st.noWaterMsgT <= 0) {
        st.noWaterMsgT = 120;
        if (g.showNotification) g.showNotification('No hay agua cerca');
      }
    }
    if (st.noWaterMsgT > 0) st.noWaterMsgT--;

    if (st.holding) {
      updateAim(g);
      if (window.Aim.source() !== 'none') p.facing = st.facing;
      const h = handPos(p);
      if (st.connected && !srcStillThere(g)) { st.connected = false; st.src = null; }
      // Al pasar cerca de agua con la bola a medio llenar, se vuelve a enganchar sola
      if (!st.connected && st.size < 0.98 && ws.t % 15 === 0 && nearestSource(g)) st.connected = true;

      if (st.connected && st.srcKind === 'body') {
        const wb = st.src;
        st.size = Math.min(1, st.size + 0.022);
        // El agua sube desde la laguna: la superficie se levanta en ese punto y la sigue
        st.srcX += (Math.max(wb.x + 10, Math.min(wb.x + wb.w - 10, h.x)) - st.srcX) * 0.08;
        splashAt(wb, st.srcX, -0.55 * (0.4 + st.size), 2);
      } else if (st.connected) {
        // Del charco solo sale lo que el charco tiene
        const q = st.src;
        const d = Math.min(0.022, q.vol, 1 - st.size);
        st.size += d; q.vol -= d; q.lastT = ws.t;
        if (q.vol <= 0.03 || st.size >= 1) { st.connected = false; st.src = null; }
      } else {
        // Sin fuente: la bola se evapora despacio en la mano
        st.size -= 1 / EVAP_FRAMES;
        if (st.size <= 0.05) {
          burst(h.x, h.y, 4, 1.2);
          endHold();
          if (g.showNotification) g.showNotification('El agua se evaporó');
        }
      }
      if (st.holding && st.connected && ws.t % 3 === 0) {
        const sy = srcY();
        const d = spawnDrop(st.srcX + (Math.random() - 0.5) * 14, sy, 0, 0, 1.4 + Math.random() * 1.6, false);
        if (d) { d.vx = (h.x - d.x) * 0.06; d.vy = (h.y - sy) * 0.06 - 2.2; d.life = 22; }
      }
    }
    streamSound(st.holding && st.connected ? 0.4 + st.size * 0.6 : 0);
  }

  // Pose de Ruben: brazo extendido (player.setArmPose; se dibuja la más fuerte entre viento y
  // agua). Con la bola solo se planta si está quieto en el suelo; caminando la lleva normal.
  function applyPose(g) {
    const p = g.player;
    const posed = guide.on || (st.holding && p.isGrounded && Math.abs(p.vx) < 0.6);
    st.pose += (posed ? 1 - st.pose : -st.pose) * 0.2;
    if (st.pose < 0.01) st.pose = 0;
    p.setArmPose('water', st.pose, st.rel);
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
          // Sin daño: el golpe de agua lo empuja (más cuanto más grande) y lo aturde 3 s
          wetEnemy(g, e, Math.sign(s.vx || 1) * (2.5 + 4.5 * s.size), -1.5 - 2 * s.size);
          if (g.hitStop) g.hitStop(2);
          hit = true; break;
        }
      }
      // Macetas del maestro
      const sp = !hit ? potCatch(room, s.x, s.y, s.r) : null;
      if (sp) { fillPot(g, room, sp); s.on = false; continue; }
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
      if (!hit && (s.x < -50 || s.x > room.width + 50 || s.y > room.height + 50)) { s.on = false; continue; }
      // Se deshace en el aire al agotar su impulso (no llega a la campana del techo)
      if (!hit && s.t >= SHOT_LIFE) {
        burst(s.x, s.y, 6 + Math.round(s.size * 8), 1.6);
        playSplash(0.2);
        addPuddle(g, s.x, s.y, s.size * 0.7);       // el agua cae y queda en el suelo
        s.on = false; continue;
      }
      if (hit) {
        burst(s.x, s.y, 8 + Math.round(s.size * 12), 2.6 + s.size * 2.2);
        playSplash(0.35 + s.size * 0.5);
        if (window.particleSystem) window.particleSystem.createShockwave(s.x, s.y, 14 + s.size * 16, 'rgba(200, 236, 255, 0.85)', 2);
        // Queda un charco donde cae el agua (en el suelo que haya debajo del impacto)
        addPuddle(g, s.x - Math.sign(s.vx || 1) * 2, s.y - s.r - 2, s.size * 0.85);
        s.on = false;
      }
    }
  }


  // ---------------- esfera guiada (tras la mejora) ----------------
  function canGuide(g) {
    const p = g.player;
    return st.learned && st.upgraded && !st.holding && !p.dead && p.isGrounded && !ws.swim &&
      !p.carriedItem && g.deathTimer <= 0 && !(p.anim && p.anim.hurtFlash > 0) &&
      // La esfera guiada también gasta energía elemental (js/stamina.js)
      (!window.Stamina || window.Stamina.canUse());
  }
  function toggleGuide(g) {
    if (guide.on) { popGuide(g); return; }
    if (!st.learned) return;
    if (!st.upgraded) {
      if (g.showNotification && st.noWaterMsgT <= 0) { st.noWaterMsgT = 120; g.showNotification('Tu esfera todavía es pequeña: sigue practicando con el agua'); }
      return;
    }
    if (!canGuide(g)) return;
    const src = nearestSource(g, 0.25);
    if (!src) {
      if (g.showNotification && st.noWaterMsgT <= 0) { st.noWaterMsgT = 120; g.showNotification('No hay agua cerca'); }
      return;
    }
    const p = g.player;
    const sy = srcY();
    if (st.srcKind === 'body') {
      splashAt(src, st.srcX, -4, 2);
      guide.vol = 1;
    } else {
      // De un charco sale una esfera tan grande como el agua que le queda
      guide.vol = Math.min(1, src.vol);
      src.vol -= guide.vol; src.lastT = ws.t;
    }
    st.src = null;
    guide.r = Math.max(6, BASE_R * Math.sqrt(guide.vol));
    burst(st.srcX, sy, 10, 3.2);
    guide.on = true;
    guide.x = p.x + p.width / 2 + (p.facing || 1) * 24;
    guide.y = p.y - 6;
    guide.vx = 0; guide.vy = -1.5; guide.t = 0;
    playWhoosh(0.6);
    playSplash(0.3);
  }
  function popGuide(g) {
    if (!guide.on) return;
    guide.on = false;
    burst(guide.x, guide.y, 14, 2.8);
    playSplash(0.45);
    if (window.particleSystem) window.particleSystem.createShockwave(guide.x, guide.y, 24, 'rgba(200, 236, 255, 0.85)', 2);
    addPuddle(g, guide.x, guide.y - guide.r - 2, guide.vol * 0.9);   // su agua queda en el suelo
  }
  function guideStep(g) {
    // L3 (botón 10 del mando): alterna la esfera guiada (por flanco)
    const pad = g.getPad ? g.getPad() : null;
    const l3 = !!(pad && pad.buttons && pad.buttons[10] && pad.buttons[10].pressed);
    if (l3 && !st.l3Prev && g.deathTimer <= 0) toggleGuide(g);
    st.l3Prev = l3;
    if (!guide.on) return;

    const p = g.player;
    if (p.dead || (p.anim && p.anim.hurtFlash > 0) || ws.swim) { popGuide(g); return; }
    // Sin energía la esfera se revienta sola
    if (window.Stamina && !window.Stamina.canUse()) { popGuide(g); return; }
    guide.t++;
    // Dirección: stick izquierdo (analógico) o teclas de movimiento / apuntar
    let dx = 0, dy = 0;
    const cm = g.controlsManager;
    if (cm && cm.isActive) {
      if (cm.isActive('moveLeft', g.keys)) dx -= 1;
      if (cm.isActive('moveRight', g.keys)) dx += 1;
      if (cm.isActive('aimUp', g.keys)) dy -= 1;
      if (cm.isActive('aimDown', g.keys)) dy += 1;
    }
    if (pad && pad.axes && pad.axes.length >= 2) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (ax * ax + ay * ay > 0.25 * 0.25) { dx = ax; dy = ay; }
    }
    const len = Math.hypot(dx, dy);
    const tvx = len > 0 ? dx / Math.max(1, len) * GUIDE_SPEED : 0;
    const tvy = len > 0 ? dy / Math.max(1, len) * GUIDE_SPEED : 0;
    guide.vx += (tvx - guide.vx) * 0.14;
    guide.vy += (tvy - guide.vy) * 0.14;
    guide.x += guide.vx;
    guide.y += guide.vy + (len > 0 ? 0 : Math.sin(guide.t * 0.08) * 0.25);
    if (guide.t % 3 === 0) spawnDrop(guide.x - guide.vx * 2, guide.y - guide.vy * 2, guide.vx * 0.1, guide.vy * 0.1 + 0.3, 1.2, false);
    // Ruben mira a su esfera (brazo extendido hacia ella)
    const ang = Math.atan2(guide.y - (p.y + 19), guide.x - (p.x + p.width / 2));
    if (Math.cos(ang) > 0.15) p.facing = 1; else if (Math.cos(ang) < -0.15) p.facing = -1;
    st.angle = ang;
    st.rel = Math.atan2(Math.sin(ang), Math.cos(ang) * p.facing);

    const room = g.world.getCurrentRoom();
    const R = guide.r || BASE_R;
    // Choques: agua (se funde), campanas, muros quebradizos, plataformas.
    // A los enemigos los ATRAVIESA: los empuja con su propia velocidad y los aturde 3 s.
    const wb = bodyAt(room, guide.x, guide.y, 0);
    if (wb && guide.y >= surfaceAt(wb, guide.x)) {
      splashAt(wb, guide.x, 6, 3); burst(guide.x, surfaceAt(wb, guide.x), 12, 3.4); playSplash(0.6);
      guide.on = false; return;
    }
    const gp = potCatch(room, guide.x, guide.y, R);
    if (gp) { fillPot(g, room, gp); guide.on = false; return; }
    if (room.waterBells) {
      for (const b of room.waterBells) {
        if (Math.hypot(guide.x - b.x, guide.y - (b.y + 10)) < R + 13) { ringBell(g, room, b, guide.vx); popGuide(g); return; }
      }
    }
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const nx = Math.max(e.x, Math.min(guide.x, e.x + e.width)), ny = Math.max(e.y, Math.min(guide.y, e.y + e.height));
      if ((guide.x - nx) * (guide.x - nx) + (guide.y - ny) * (guide.y - ny) <= R * R) {
        // Una vez por pasada (no lo re-aturde cada cuadro mientras lo cruza)
        if (e.__wetT === undefined || ws.t - e.__wetT > 45) wetEnemy(g, e, guide.vx * 0.9, guide.vy * 0.6 - 0.8);
      }
    }
    if (g.world.checkBreakableImpact && g.world.checkBreakableImpact({ x: guide.x - R, y: guide.y - R, w: R * 2, h: R * 2 })) { popGuide(g); return; }
    for (const pl of g.world.getPlatforms()) {
      if (guide.x + R > pl.x && guide.x - R < pl.x + pl.w && guide.y + R > pl.y && guide.y - R < pl.y + pl.h) { popGuide(g); return; }
    }
    if (guide.x < -40 || guide.x > room.width + 40 || guide.y < -40 || guide.y > room.height + 40 || guide.t > GUIDE_LIFE) popGuide(g);
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
      const r = orbRadius(st.size);
      const ox = h.x + Math.cos(st.angle) * (6 + r), oy = h.y + Math.sin(st.angle) * (6 + r);
      // Chorro de agua desde la fuente (laguna o charco) hasta el orbe; solo si está enganchada
      if (st.connected && st.src) {
      const sx = st.srcX, sy = srcY();
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
      }
      drawOrbAt(ctx, ox - cam.x, oy - cam.y, r, t);
      // Progreso de la maestría: arco dorado alrededor del orbe (hasta +77% = mejora)
      if (!st.upgraded) {
        const k = st.mastery / MASTERY_MAX;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(58, 36, 22, 0.5)';
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(ox - cam.x, oy - cam.y, r + 6, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#e6b85c';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ox - cam.x, oy - cam.y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, k)); ctx.stroke();
        ctx.restore();
      }
    }
    for (const s of SHOTS) {
      if (s.on) {
        // Al final de su vida la bola se encoge antes de deshacerse
        const fade = s.t > SHOT_LIFE - 6 ? (SHOT_LIFE - s.t) / 6 : 1;
        drawOrbAt(ctx, s.x - cam.x, s.y - cam.y, s.r * (0.5 + 0.5 * fade), t + s.t);
      }
    }
    if (guide.on) {
      // Esfera guiada: estela de gotitas y un halo celeste que late
      const gx = guide.x - cam.x, gy = guide.y - cam.y;
      ctx.save();
      const GR = guide.r || BASE_R;
      const halo = ctx.createRadialGradient(gx, gy, GR * 0.6, gx, gy, GR * 2.4);
      halo.addColorStop(0, `rgba(170, 230, 255, ${0.35 + 0.15 * Math.sin(t * 0.2)})`);
      halo.addColorStop(1, 'rgba(170, 230, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(gx, gy, GR * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      drawOrbAt(ctx, gx, gy, GR, t);
    }
  }

  // ---------------- instalación ----------------
  function install(g) {
    const H = window.GameHooks;
    // Guiando la esfera, Ruben queda plantado
    H.onFreezeInput.push(() => guide.on);
    H.onAction.push((game, action) => {
      if (action === 'waterGuide') { toggleGuide(game); return true; }
      if (guide.on && action !== 'interact') return true;                         // plantado guiando la esfera
      if (st.holding && (action === 'attack' || action === 'grab')) return true;  // manos ocupadas con la bola
      return false;
    });
    H.onBeforeUpdate.push((game, running) => {
      if (!running) return;
      controlStep(game);
      guideStep(game);
    });
    H.onAfterUpdate.push((game, running) => {
      if (running) {
        applyPose(game);
        shotsStep(game);
      } else {
        streamSound(0);
      }
    });
    H.onBeforeRoomLoad.push(() => {
      // La bola que Ruben lleva en la mano pasa con él a la otra sala (suelta de su fuente)
      st.connected = false; st.src = null;
      guide.on = false;
      for (const s of SHOTS) s.on = false;
      streamSound(0);
    });
    H.onRestartGame.push(() => {
      // Solo el progreso propio: las salas (campanas, macetas, charcos) vuelven solas
      st.learned = false; st.mastery = 0; st.upgraded = false; guide.on = false;
      try { window.localStorage.removeItem(SAVE_KEY); window.localStorage.removeItem(MASTERY_KEY); } catch (e) { /* */ }
      st.holding = false; st.size = 0; st.connected = false; st.src = null;
      for (const s of SHOTS) s.on = false;
    });

    H.onRenderWorld.push((game, ctx, cam) => {
      try { drawControl(ctx, game, cam, ws.t); } catch (e) { console.error('[Agua]', e); }
    });
  }

  window.WaterControl = {
    learn: (g) => learn(g || window.gameInstance),
    isLearned: () => st.learned,
    isUpgraded: () => st.upgraded,
    isHolding: () => st.holding,
    isGuiding: () => guide.on,
    getState: () => ({ learned: st.learned, upgraded: st.upgraded, mastery: st.mastery, swimming: ws.swim, holding: st.holding, size: st.size, guiding: guide.on })
  };
  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Agua] no se pudo iniciar el Dominio del Agua:', e); }
  });
})();
