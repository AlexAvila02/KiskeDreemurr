/**
 * Dominio de la Tierra - Ruben: En Busca de Angelo (Claude, 21/11)
 *
 * Se aprende con la Maestra Greda (sala 23, Fondo de la Cantera) y solo si Ruben ya mueve
 * el aire (la tierra es su opuesto; docs/LORE.md). Con la tecla de la Tierra (Q / V; RT en
 * el mando) se levanta un PILAR DE ROCA:
 *   - Ratón: sube del suelo que está bajo el puntero, hasta la altura del puntero
 *     (40 a 170 px; alcance 300 px desde Ruben). Stick derecho: 170 px en esa dirección.
 *     Sin apuntar: delante de Ruben, 100 px de alto.
 *   - Es sólido para Ruben, los enemigos y las piedras (`type: 'earth'` en room.platforms;
 *     terrain-art.js no lo pinta, se dibuja acá). Al subir levanta lo que tiene encima y
 *     lanza y lastima a los enemigos que atrapa.
 *   - Hasta 3 a la vez (el más viejo se hunde); cada uno dura 12 s y se hunde solo.
 *     Al cambiar de sala desaparecen. Cada pilar gasta energía (Stamina.spend).
 * Antes de aprenderla, RT del mando sigue atacando (main.js manda 'earth').
 *
 * La mina de la sala 23 (prop `mine-mouth` con `earthSeal`): apuntar la Tierra a la entrada
 * (o usarla cerca, sin apuntar) hunde las rocas (`prop.open` 0 → 1, lo dibuja quarry.js) y
 * agrega la salida a la sala 24. La maestra la enseña con `teaches: 'earth'` vía
 * window.ElementTeachers (npcs.js).
 *
 * Guardado: localStorage 'ruben_tierra_v1' { learned, mine }. "Reiniciar juego" lo borra.
 * Hooks: onInit · onAction · onBeforeUpdate · onBeforeRoomLoad · onRoomLoad · onRestartGame
 * (ver MAPA.md). Pilares en un pool fijo (sin basura por cuadro).
 * API: window.EarthPower { isLearned(), learn(g), isMineOpen(), pillars }
 */
(function () {
  'use strict';

  const SAVE_KEY = 'ruben_tierra_v1';
  const OUT = '#3a2416';
  const PW = 56;                 // ancho del pilar
  const MAX_PILLARS = 3;
  const MIN_H = 40, MAX_H = 170, DEFAULT_H = 100;
  const REACH = 300;
  const RISE = 11;               // px por cuadro al subir
  const SINK = 5;                // px por cuadro al hundirse
  const LIFE = 12 * 60;          // cuadros de pie
  const COST = 380;              // energía por pilar (la barra empieza en 3600)
  const MINE_FRAMES = 100;       // lo que tardan las rocas de la mina en hundirse
  const MINE_EXIT = { x: 1235, y: 340, w: 70, h: 120, targetRoom: 24, targetX: 60, targetY: 410, earthMine: true };

  let save = { learned: false, mine: false };
  try { save = Object.assign(save, JSON.parse(window.localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { /* */ }
  function persist() { try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* */ } }

  // Pool fijo de pilares. state: 0 libre · 1 subiendo · 2 de pie · 3 hundiéndose
  const pillars = [];
  for (let i = 0; i < MAX_PILLARS; i++) {
    pillars.push({ x: 0, y: 0, w: PW, h: 0, type: 'earth', state: 0, base: 0, target: 0, life: 0, born: 0, seed: 0, id: 0 });
  }
  let nextId = 1;
  let clockT = 0;
  const mine = { prop: null, t: -1 };   // t >= 0: abriéndose

  const isLearned = () => !!save.learned;
  const windKnown = () => !!(window.WindPull && window.WindPull.isUnlocked && window.WindPull.isUnlocked());

  function learn(g) {
    if (save.learned) return;
    save.learned = true;
    persist();
    if (window.soundManager && window.soundManager.playUnlockAbility) window.soundManager.playUnlockAbility();
    if (g && g.showNotification) g.showNotification('✦ Ruben recuerda la Tierra: levanta pilares de roca');
  }

  // ---------------- pilares ----------------
  function roomOf(g) { return g.world && g.world.getCurrentRoom(); }

  function addToRoom(room, pl) {
    if (room.platforms.indexOf(pl) < 0) room.platforms.push(pl);
  }
  function removeFromRoom(room, pl) {
    if (!room) return;
    const i = room.platforms.indexOf(pl);
    if (i >= 0) room.platforms.splice(i, 1);
  }

  function clearAll(g) {
    const room = roomOf(g);
    for (const pl of pillars) {
      if (pl.state) removeFromRoom(room, pl);
      pl.state = 0; pl.h = 0;
    }
  }

  const solidType = (t) => t === 'ground' || t === 'ruins' || !t;

  // Busca el suelo bajo (tx, ty): devuelve la plataforma o null
  function surfaceAt(room, tx, ty) {
    let below = null, above = null;
    for (const p of room.platforms) {
      if (!solidType(p.type) || p.w < PW) continue;
      if (tx < p.x || tx > p.x + p.w) continue;
      if (p.y >= ty - 4) { if (!below || p.y < below.y) below = p; }
      else if (!above || p.y > above.y) above = p;     // el puntero está "dentro" del suelo
    }
    return below || above;
  }

  // Altura máxima sin atravesar techos, paredes ni otras plataformas encima
  function headroom(room, base, x0, top) {
    let maxH = MAX_H;
    for (const p of room.platforms) {
      if (p === base || p.type === 'earth') continue;
      if (p.x >= x0 + PW || p.x + p.w <= x0) continue;
      const bottom = p.y + p.h;
      if (bottom <= top + 1) maxH = Math.min(maxH, top - bottom - 2);
      else if (p.y < top) return 0;                    // una pared corta la columna
    }
    if (room.door && !room.door.isOpen) {
      const d = room.door;
      if (d.x < x0 + PW && d.x + d.width > x0 && d.y < top) return 0;
    }
    return maxH;
  }

  function freePillar(g) {
    let pick = null;
    for (const pl of pillars) if (!pl.state) return pl;
    // Todos en uso: el más viejo se hunde ya mismo
    for (const pl of pillars) if (!pick || pl.born < pick.born) pick = pl;
    removeFromRoom(roomOf(g), pick);
    pick.state = 0;
    return pick;
  }

  function aimPoint(g, out) {
    const p = g.player;
    const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
    const A = window.Aim;
    out.aimed = false;
    if (A) {
      const mp = A.source() === 'mouse' && A.mousePoint ? A.mousePoint(g) : null;
      if (mp) {
        const dx = Math.max(-REACH, Math.min(REACH, mp.x - cx));
        out.x = cx + dx; out.y = Math.max(mp.y, cy - REACH); out.aimed = true;
        return out;
      }
      if (A.source() === 'stick' && A.isStickHeld()) {
        const ang = A.target(g, cx, cy);
        if (ang !== null) {
          out.x = cx + Math.cos(ang) * 170; out.y = cy + Math.sin(ang) * 170; out.aimed = true;
          return out;
        }
      }
    }
    out.x = cx + p.facing * 64;
    out.y = p.y + p.height - DEFAULT_H;
    return out;
  }
  const AIM = { x: 0, y: 0, aimed: false };

  function raise(g) {
    const room = roomOf(g);
    if (!room) return;
    aimPoint(g, AIM);
    // La mina tapada: apuntar a la entrada (o usarla cerca) la abre
    const mp = mineProp(room);
    if (mp && !mp.open && mine.t < 0) {
      const cx = g.player.x + g.player.width / 2;
      if (Math.abs(AIM.x - mp.x) < 120 || (!AIM.aimed && Math.abs(cx - mp.x) < 230)) { openMine(g, room, mp); return; }
    }
    const base = surfaceAt(room, AIM.x, AIM.y);
    if (!base) { fizzle(g, AIM.x, AIM.y); return; }
    const top = base.y;
    const tx = Math.max(base.x + PW / 2, Math.min(base.x + base.w - PW / 2, AIM.x));
    let h = AIM.aimed ? Math.max(MIN_H, Math.min(MAX_H, top - AIM.y)) : DEFAULT_H;
    const maxH = headroom(room, base, tx - PW / 2, top);
    h = Math.min(h, maxH);
    if (h < MIN_H) { fizzle(g, tx, top); return; }
    if (window.Stamina && window.Stamina.spend && !window.Stamina.spend(COST)) {
      if (g.showNotification) g.showNotification('Sin energía para pedirle a la tierra');
      return;
    }
    // Un pilar nuevo encima de otro: el viejo se hunde
    for (const o of pillars) {
      if (o.state && o.state < 3 && Math.abs(o.x + PW / 2 - tx) < PW) o.state = 3;
    }
    const pl = freePillar(g);
    pl.x = tx - PW / 2; pl.base = top; pl.target = h; pl.h = 0; pl.y = top;
    pl.state = 1; pl.life = LIFE; pl.born = clockT; pl.seed = (tx * 7 + top * 3) | 0; pl.id = nextId++;
    addToRoom(room, pl);
    rumble(0.9);
    if (g.triggerScreenShake) g.triggerScreenShake(3, 120);
    g.player.setArmPose && g.player.setArmPose('earth', 1, tx >= g.player.x ? 0.6 : Math.PI - 0.6);
    armT = 18;
  }
  let armT = 0;

  function fizzle(g, x, y) {
    if (window.particleSystem) window.particleSystem.createDust(x, y, 4, '#b49a7a');
    if (g.showNotification) g.showNotification('Ahí no hay tierra que levantar');
  }

  function rumble(vol) {
    const SK = window.SoundKit;
    if (!SK || !SK.ctx()) return;
    try {
      SK.noiseHit('brown', { type: 'lowpass', freq: 420, freqTo: 140, sweep: 0.4, Q: 0.8, peak: 0.5 * vol, attack: 0.02, release: 0.45 });
      SK.tone({ type: 'triangle', freq: 90, freqTo: 52, sweep: 0.35, gain: 0.22 * vol, release: 0.4 });
    } catch (e) { /* sin sonido */ }
  }

  const overlapX = (ax, aw, bx, bw) => ax < bx + bw && ax + aw > bx;

  // Mueve el pilar y lo que tiene encima o dentro
  function stepPillar(g, pl) {
    const room = roomOf(g);
    if (pl.state === 1) {
      const prevTop = pl.y;
      pl.h = Math.min(pl.target, pl.h + RISE);
      pl.y = pl.base - pl.h;
      liftThings(g, pl, prevTop);
      if (window.particleSystem && (clockT & 3) === 0) window.particleSystem.createDust(pl.x + PW / 2 + (Math.random() - 0.5) * PW, pl.base, 2, '#b49a7a');
      if (pl.h >= pl.target) {
        pl.state = 2;
        if (window.particleSystem) window.particleSystem.createDust(pl.x + PW / 2, pl.base, 8, '#b49a7a');
      }
    } else if (pl.state === 2) {
      if (--pl.life <= 0) { pl.state = 3; rumble(0.4); }
    } else if (pl.state === 3) {
      pl.h -= SINK;
      pl.y = pl.base - Math.max(0, pl.h);
      if (pl.h <= 0) {
        pl.state = 0; pl.h = 0;
        removeFromRoom(room, pl);
        if (window.particleSystem) window.particleSystem.createDust(pl.x + PW / 2, pl.base, 6, '#b49a7a');
      }
    }
  }

  function liftThings(g, pl, prevTop) {
    const top = pl.y;
    const p = g.player;
    // Ruben: encima del pilar o atrapado en la columna que sube → queda parado arriba
    if (overlapX(p.x, p.width, pl.x, PW) && p.y + p.height > top && p.y + p.height <= pl.base + 2) {
      p.y = top - p.height;
      if (p.vy > 0) p.vy = 0;
    }
    // Enemigos: los lanza y los lastima una vez por pilar
    const es = g.enemies || [];
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (!e || e.alive === false) continue;
      if (!overlapX(e.x, e.width, pl.x, PW) || e.y + e.height <= top || e.y + e.height > pl.base + 2) continue;
      e.y = top - e.height;
      if (e._earthHit !== pl.id) {
        e._earthHit = pl.id;
        if (e.takeDamage) e.takeDamage(12, (e.x + e.width / 2 < pl.x + PW / 2 ? -1 : 1) * 5);
        e.vy = -9;
        if ('knockbackVy' in e) e.knockbackVy = -7;
      }
    }
    // Piedras sueltas
    const ds = g.debrisItems || [];
    for (let i = 0; i < ds.length; i++) {
      const d = ds[i];
      if (!d || d.isCarried || d.active === false && d.isThrown) continue;
      if (overlapX(d.x, d.width, pl.x, PW) && d.y + d.height > top && d.y + d.height <= pl.base + 2) {
        d.y = top - d.height;
        if (d.vy > 0) d.vy = 0;
      }
    }
  }

  // ---------------- la mina ----------------
  function mineProp(room) {
    if (!room || !room.props) return null;
    for (const pr of room.props) if (pr.earthSeal) return pr;
    return null;
  }

  function addMineExit(room) {
    if (!room.exits.some(e => e.earthMine)) room.exits.push(Object.assign({}, MINE_EXIT));
  }

  function openMine(g, room, pr) {
    mine.prop = pr; mine.t = 0;
    if (window.Stamina && window.Stamina.spend) window.Stamina.spend(COST);
    rumble(1.2);
    if (g.showNotification) g.showNotification('La tierra escucha... las rocas de la mina se hunden');
  }

  function stepMine(g) {
    if (mine.t < 0 || !mine.prop) return;
    mine.t++;
    const k = Math.min(1, mine.t / MINE_FRAMES);
    mine.prop.open = k;
    if (g.triggerScreenShake && (mine.t % 12) === 1) g.triggerScreenShake(4, 160);
    if (window.particleSystem && (mine.t % 5) === 0) window.particleSystem.createDust(mine.prop.x + (Math.random() - 0.5) * 120, mine.prop.y, 3, '#b49a7a');
    if ((mine.t % 25) === 1) rumble(0.7);
    if (k >= 1) {
      mine.t = -1;
      save.mine = true; persist();
      const room = roomOf(g);
      if (room && mineProp(room) === mine.prop) addMineExit(room);
      mine.prop = null;
      if (window.soundManager && window.soundManager.playDoorUnlock) window.soundManager.playDoorUnlock();
      if (g.showNotification) g.showNotification('La mina está abierta');
    }
  }

  // Aplica el guardado a una sala (la mina ya abierta en otra visita o partida)
  function applyMineState(room) {
    const pr = mineProp(room);
    if (!pr) return;
    if (save.mine) { pr.open = 1; addMineExit(room); }
  }

  // ---------------- dibujo ----------------
  function drawPillar(ctx, pl, cam) {
    const h = Math.max(0, pl.h);
    if (h < 2) return;
    const x = pl.x - cam.x, top = pl.y - cam.y, base = pl.base - cam.y;
    if (x + PW < -10 || x > 970) return;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Cuerpo: roca con forma de columna irregular (más ancha abajo)
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.6;
    ctx.fillStyle = '#a8977c';
    ctx.beginPath();
    ctx.moveTo(x - 3, base);
    ctx.lineTo(x + 2, top + 9);
    ctx.quadraticCurveTo(x + 4, top - 1, x + 14, top - 2);
    ctx.lineTo(x + PW - 14, top - 3);
    ctx.quadraticCurveTo(x + PW - 3, top - 1, x + PW - 2, top + 9);
    ctx.lineTo(x + PW + 3, base);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Vetas (estratos) que suben con el pilar
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 4, top, PW + 8, h); ctx.clip();
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.28)'; ctx.lineWidth = 1.4;
    for (let yy = 22; yy < h; yy += 26) {
      const wob = ((pl.seed + yy) % 7) - 3;
      ctx.beginPath(); ctx.moveTo(x + 2, top + yy); ctx.quadraticCurveTo(x + PW / 2, top + yy + wob, x + PW - 2, top + yy - wob * 0.5); ctx.stroke();
    }
    // Grietas
    ctx.strokeStyle = 'rgba(58, 36, 22, 0.55)'; ctx.lineWidth = 1.6;
    const cxk = x + 14 + (pl.seed % 22);
    ctx.beginPath(); ctx.moveTo(cxk, top + 14); ctx.lineTo(cxk + 5, top + 28); ctx.lineTo(cxk - 2, top + 42); ctx.stroke();
    // Luz del lado izquierdo
    ctx.strokeStyle = 'rgba(255, 248, 230, 0.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 6, top + 10); ctx.lineTo(x + 5, top + h - 6); ctx.stroke();
    ctx.restore();
    // Tapa con musgo
    ctx.fillStyle = '#7f9a5a';
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x + PW / 2, top + 1, PW / 2 - 6, 4, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Hundiéndose o por hundirse: tiembla un poco y se agrieta
    if (pl.state === 2 && pl.life < 90 && (clockT & 4)) {
      ctx.strokeStyle = 'rgba(58, 36, 22, 0.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x + PW - 14, top + 6); ctx.lineTo(x + PW - 20, top + 20); ctx.stroke();
    }
    // Tierra removida en la base
    ctx.fillStyle = '#8c6a46';
    ctx.beginPath(); ctx.ellipse(x + PW / 2, base, PW / 2 + 10, 5, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function render(g, ctx, cam) {
    for (const pl of pillars) if (pl.state) drawPillar(ctx, pl, cam);
  }

  // ---------------- maestra (npcs.js) ----------------
  window.ElementTeachers = window.ElementTeachers || {};
  window.ElementTeachers.earth = {
    isLearned,
    learn,
    blockedText: () => windKnown() ? null
      : 'Todavía no, muchacho. La tierra escucha a quien ya sabe mover el aire. Vuelve cuando el viento te obedezca.',
    farewellText: () => save.mine
      ? 'La mina vuelve a respirar. Tu hermano salió por la chimenea, hacia la montaña: buscaba a un sabio que estudia cómo arden las cosas.'
      : null
  };

  // ---------------- instalación ----------------
  function install(game) {
    const H = window.GameHooks;
    applyMineState(roomOf(game) || {});
    if (game.world) game.world.rooms.forEach(r => r && applyMineState(r));

    H.onAction.push((g, action) => {
      if (action !== 'earth') return false;
      if (!save.learned) {
        // RT del mando ataca mientras no se aprendió la Tierra
        if (g.padAction) g.doAction('attack');
        return true;
      }
      if (window.Multiplayer && window.Multiplayer.isGuest && window.Multiplayer.isGuest()) return true;
      if (g.player.dead || (g.player.isCarrying && g.player.isCarrying())) return true;
      raise(g);
      return true;
    });
    H.onBeforeUpdate.push((g, running) => {
      if (!running) return;
      clockT++;
      for (const pl of pillars) if (pl.state) stepPillar(g, pl);
      stepMine(g);
      if (armT > 0) {
        armT--;
        if (g.player.setArmPose) g.player.setArmPose('earth', armT / 18, g.player.facing > 0 ? 0.7 : Math.PI - 0.7);
      }
    });
    H.onBeforeRoomLoad.push((g) => {
      clearAll(g);
      if (mine.t >= 0 && mine.prop) {   // se fue a mitad de la apertura: queda abierta igual
        mine.prop.open = 1; save.mine = true; persist();
        mine.t = -1; mine.prop = null;
        const r23 = g.world.rooms[23];
        if (r23) applyMineState(r23);
      }
    });
    H.onRoomLoad.push((g, room) => applyMineState(room || {}));
    H.onRestartGame.push((g) => {
      for (const pl of pillars) { pl.state = 0; pl.h = 0; }
      mine.t = -1; mine.prop = null;
      save = { learned: false, mine: false };
      try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ }
    });

    // Pilares detrás de Ruben y de los enemigos (capa world, antes que decorados y NPC)
    const AR = window.AnimationRegistry || window.AnimSystem;
    const draw = (ctx, cam) => { try { render(game, ctx, cam); } catch (e) { console.error('[Tierra]', e); } };
    if (AR && AR.registerLayer) AR.registerLayer('world', 'earth-pillars', { order: 47, after(world, ctx, cam) { draw(ctx, cam); } });
    else H.onRenderWorld.push((g, ctx, cam) => draw(ctx, cam));
  }

  window.EarthPower = {
    isLearned,
    learn: (g) => learn(g || window.gameInstance),
    isMineOpen: () => !!save.mine,
    pillars
  };
  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Tierra] no se pudo iniciar:', e); }
  });
})();
