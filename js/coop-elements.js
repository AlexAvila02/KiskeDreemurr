/**
 * Los elementos entre jugadores (multijugador) - Ruben: En Busca de Angelo (Claude)
 *
 * Con el multijugador activo, el viento y el agua de cada jugador también le llegan a los demás
 * (sin daño: es un juego cooperativo):
 *   - VIENTO: se ve la franja de viento de cada compañero (wind-pull.js la dibuja).
 *       · Jalar: si te alcanza, te arrastra hacia su mano. Ruben se echa hacia atrás
 *         resistiendo, clava los talones (polvo), manotea y grita. Caminar en contra frena,
 *         pero cuesta. Cerca de la mano deja de tirar.
 *       · Soplar: te empuja en la dirección del viento (hacia arriba te levanta). Ruben se
 *         inclina contra el viento, se tapa la cara, entrecierra los ojos y aprieta los dientes.
 *     La bufanda y el pelo flamean hacia donde sopla.
 *   - AGUA: se ven la bola en la mano, las bolas lanzadas y la esfera guiada de los demás.
 *     Si te pega una, te empapa: te empuja, das un saltito y chorreás gotas un rato.
 *
 * Cada computadora calcula lo que le pasa a SU Ruben (con el viento y el agua de los demás) y
 * lo manda en su estado; así los demás ven la animación de arrastre / empuje en su fantasma.
 *
 * Usa: Multiplayer.others() · WindPull.netState / setRemotes / forceFrom / reachFor ·
 *   WaterControl.netState / shots / SHOT_LIFE · WaterCore (gotas, orbe, sonidos) ·
 *   player.windHit (pose en player.js). multiplayer.js llama a CoopElements.pack(g).
 * Hooks: onInit · onBeforeUpdate · onAfterPlayerUpdate · onAfterUpdate · onBeforeRoomLoad ·
 *   onRestartGame · onRenderWorld.
 */
(function () {
  'use strict';

  const PULL_SPEED = 2.5;     // px por cuadro que te arrastra el viento de otro (potencia llena)
  const PUSH_SPEED = 3.6;     // px por cuadro que te empuja al soplar
  const HOLD = 34;            // a esta distancia de la mano deja de arrastrarte
  const WET_FRAMES = 150;     // cuadros chorreando agua después de un baldazo

  const me = {
    wh: { pull: 0, push: 0, dir: 1 },   // pose de viento de mi Ruben (player.windHit)
    wetT: 0,
    guideCd: 0
  };
  const sources = new Map();   // id de jugador → fuente de viento (la lee wind-pull.js)
  const srcList = [];
  const shots = new Map();     // 'jugador:bola' → bola de agua ajena en vuelo
  const seenShots = new Map(); // 'jugador:bola' → cuadro (para no volver a crearla)
  const guides = new Map();    // id de jugador → esfera guiada ajena
  let frame = 0;
  let windLoop = null;
  let others = [];

  const MP = () => window.Multiplayer;
  const on = () => !!(MP() && MP().isActive && MP().isActive());
  const r2 = (v) => Math.round(v * 100) / 100;

  function rectHit(x, y, r, b) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.width)), ny = Math.max(b.y, Math.min(y, b.y + b.height));
    return (x - nx) * (x - nx) + (y - ny) * (y - ny) <= r * r;
  }
  function inPlatform(world, x, y, r) {
    for (const pl of world.getPlatforms()) {
      if (x + r > pl.x && x - r < pl.x + pl.w && y + r > pl.y && y - r < pl.y + pl.h) return true;
    }
    return false;
  }

  // ---------------- lo que mando por la red ----------------
  function pack(g) {
    const out = {};
    const W = window.WindPull, WC = window.WaterControl;
    const w = W && W.netState ? W.netState() : null;
    if (w) out.w = w;
    const wh = me.wh;
    if (wh.pull > 0.02 || wh.push > 0.02) out.h = [r2(wh.pull), r2(wh.push), wh.dir];
    if (WC && WC.netState) {
      const ws = WC.netState(g);
      if (ws.o) out.o = ws.o;
      if (ws.s) out.s = ws.s;
      if (ws.gd) out.gd = ws.gd;
    }
    if (me.wetT > 0) out.wt = 1;
    return out;
  }

  // ---------------- lo que llega de los demás ----------------
  function readOthers(g) {
    others = MP().others();
    srcList.length = 0;
    const alive = new Set();
    for (const pl of others) {
      const gh = pl.ghost;
      if (!gh) continue;
      alive.add(pl.id);
      const e = (pl.st && pl.st.e) || null;
      const dead = !!(pl.st && pl.st.d);

      // Viento del compañero
      let src = sources.get(pl.id);
      if (!src) {
        src = { owner: pl.id, hx: 0, hy: 0, dirX: 1, dirY: 0, facing: 1, rel: 0, angle: 0, power: 0, mode: 'pull', reach: 0, flow: Math.random() * 20 };
        sources.set(pl.id, src);
      }
      const w = e && e.w && !dead ? e.w : null;
      src.power += ((w ? w[1] : 0) - src.power) * 0.35;
      if (src.power < 0.01 && !w) src.power = 0;
      if (w) {
        src.mode = w[0] === 2 ? 'push' : 'pull';
        let d = w[2] - src.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        src.angle = src.power < 0.05 ? w[2] : src.angle + d * 0.4;
      }
      src.dirX = Math.cos(src.angle); src.dirY = Math.sin(src.angle);
      src.facing = src.dirX > 0.15 ? 1 : (src.dirX < -0.15 ? -1 : (gh.facing || 1));
      src.rel = Math.atan2(src.dirY, src.dirX * src.facing);
      src.hx = gh.x + gh.width / 2 + src.dirX * 16;
      src.hy = gh.y + 19 + src.dirY * 14;
      src.reach = window.WindPull ? window.WindPull.reachFor(src.power) : 0;
      src.flow += (0.6 + src.power) * (src.mode === 'push' ? -1.6 : 1);
      if (src.power > 0.01) srcList.push(src);

      // Cómo le pega el viento a él (lo calcula su computadora)
      const h = e && e.h;
      const gw = gh.windHit || (gh.windHit = { pull: 0, push: 0, dir: 1 });
      const tp = h ? h[0] : 0, ts = h ? h[1] : 0;
      gw.pull += (tp - gw.pull) * (tp > gw.pull ? 0.35 : 0.15);
      gw.push += (ts - gw.push) * (ts > gw.push ? 0.35 : 0.15);
      if (h) gw.dir = h[2] || 1;
      gh._coopWet = !!(e && e.wt);

      // Bolas de agua que lanzó
      if (e && e.s) {
        for (const s of e.s) {
          const key = pl.id + ':' + s[0];
          if (seenShots.has(key)) continue;
          seenShots.set(key, frame);
          shots.set(key, { owner: pl.id, x: s[1], y: s[2], vx: s[3], vy: s[4], r: s[5], t: s[6], size: s[7] });
        }
      }
      // Esfera guiada
      const gd = e && e.gd;
      let gs = guides.get(pl.id);
      if (gd) {
        if (!gs) { gs = { owner: pl.id, x: gd[0], y: gd[1], vx: 0, vy: 0, r: gd[4] }; guides.set(pl.id, gs); }
        gs.tx = gd[0]; gs.ty = gd[1]; gs.vx = gd[2]; gs.vy = gd[3]; gs.r = gd[4];
      } else if (gs) {
        if (window.WaterCore) window.WaterCore.burst(gs.x, gs.y, 10, 2.6);
        guides.delete(pl.id);
      }
    }
    for (const id of Array.from(sources.keys())) if (!alive.has(id)) sources.delete(id);
    for (const id of Array.from(guides.keys())) if (!alive.has(id)) guides.delete(id);
    for (const [k, f] of seenShots) if (frame - f > 600) seenShots.delete(k);
    if (window.WindPull && window.WindPull.setRemotes) window.WindPull.setRemotes(srcList);
  }

  // ---------------- el viento de los demás sobre mi Ruben ----------------
  function moveCollide(p, dx, dy, world) {
    const plats = world.getPlatforms();
    const hit = (pl) => p.x < pl.x + pl.w && p.x + p.width > pl.x && p.y < pl.y + pl.h && p.y + p.height > pl.y;
    if (dx) {
      p.x += dx;
      for (const pl of plats) {
        if (!hit(pl)) continue;
        p.x = dx > 0 ? pl.x - p.width : pl.x + pl.w;
      }
    }
    if (dy) {
      p.y += dy;
      for (const pl of plats) {
        if (!hit(pl)) continue;
        if (dy > 0) { p.y = pl.y - p.height; p.vy = Math.min(p.vy, 0); p.isGrounded = true; }
        else { p.y = pl.y + pl.h; p.vy = Math.max(p.vy, 0); }
      }
    }
  }

  function windOnMe(g) {
    const p = g.player;
    const W = window.WindPull;
    let tPull = 0, tPush = 0, mx = 0, my = 0, dirHint = 0;
    if (W && !p.dead && g.deathTimer <= 0) {
      const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
      for (const src of srcList) {
        const f = W.forceFrom(src, cx, cy, 10).f;
        if (f <= 0.02) continue;
        const k = Math.min(1, f * 1.5);
        if (src.mode === 'pull') {
          const dx = src.hx - cx, dy = src.hy - cy;
          const d = Math.hypot(dx, dy) || 1;
          const near = Math.max(0, Math.min(1, (d - HOLD) / 40));
          const sp = PULL_SPEED * k * near;
          mx += dx / d * sp; my += dy / d * sp;
          tPull = Math.max(tPull, k * (0.35 + 0.65 * near));
          if (!dirHint) dirHint = Math.sign(dx);
        } else {
          const sp = PUSH_SPEED * k;
          mx += src.dirX * sp; my += src.dirY * sp;
          tPush = Math.max(tPush, k);
          if (!dirHint) dirHint = Math.sign(src.dirX);
        }
      }
    }
    if (mx || my) {
      // Caminar en contra del viento cuesta (pero se puede)
      if (Math.abs(p.vx) > 0.5 && Math.sign(p.vx) === -Math.sign(mx)) p.vx *= 0.7;
      // Hacia arriba: el viento le gana a la gravedad (si es apenas un roce, no lo despega)
      if (my < 0 && (!p.isGrounded || my < -0.7)) {
        const lift = Math.min(1, -my / 1.6);
        p.vy = Math.max(-4, p.vy - p.gravity * lift * 1.05);
        if (p.vy > 0) p.vy *= 1 - 0.5 * lift;
      } else if (my < 0) my = 0;
      moveCollide(p, mx, my, g.world);
    }
    const wh = me.wh;
    if (Math.abs(mx) > 0.05) wh.dir = Math.sign(mx);
    else if (dirHint) wh.dir = dirHint;
    wh.pull += (tPull - wh.pull) * (tPull > wh.pull ? 0.3 : 0.12);
    wh.push += (tPush - wh.push) * (tPush > wh.push ? 0.3 : 0.12);
    if (wh.pull < 0.01) wh.pull = 0;
    if (wh.push < 0.01) wh.push = 0;
    if ((tPull || tPush) && g.rumble && frame % 12 === 0) g.rumble(0.12 + 0.2 * Math.max(tPull, tPush), 60);
  }

  // Polvo de los talones (arrastrado) o de los pies que patinan (empujado)
  const PUFF = { vx: 0, vy: 0, dir: 1, angle: 0, scale: 1, color: '#f2d29b', duration: 14, extra: 0 };
  function heelDust(p, wh) {
    const k = Math.max(wh.pull, wh.push);
    if (k < 0.3 || !p.isGrounded || p.dead || frame % 5) return;
    const x = p.x + p.width / 2 + wh.dir * (wh.pull >= wh.push ? 8 : -6);
    if (window.AnimSystem && window.AnimSystem.spawnFX) {
      PUFF.dir = -wh.dir; PUFF.scale = 0.7 + 0.5 * k;
      try { window.AnimSystem.spawnFX('traction-puff', x, p.y + p.height - 2, PUFF); } catch (e) { /* */ }
    } else if (window.particleSystem) {
      window.particleSystem.createRunPuff(x, p.y + p.height, -wh.dir, 1);
    }
  }

  // Sonido del viento de los demás (más fuerte si me está pegando)
  function updateSound(g) {
    const SK = window.SoundKit;
    if (!SK) return;
    let lvl = Math.max(me.wh.pull, me.wh.push) * 0.13;
    for (const s of srcList) lvl = Math.max(lvl, s.power * 0.045);
    if (lvl > 0.005 && g.isPlaying && !g.isPaused) {
      if (!windLoop) windLoop = SK.loop('brown', { type: 'bandpass', freq: 520, Q: 0.8 });
      windLoop.setLevel(lvl, 0.1);
      windLoop.setFreq(420 + lvl * 3200 + Math.sin(frame * 0.08) * 90, 0.12);
    } else if (windLoop) {
      windLoop.stop(0.06, 0.3);
      windLoop = null;
    }
  }

  // ---------------- agua de los demás ----------------
  function soakMe(g, vx, vol) {
    const p = g.player;
    const WC = window.WaterCore;
    p.vx = Math.sign(vx || 1) * (2.6 + 3 * vol);
    p.vy = Math.min(p.vy, -3.2);
    if (p.anim) { p.anim.sx = 0.8; p.anim.vsx = 0; }
    if (g.rumble) g.rumble(0.35, 120);
    if (g.triggerScreenShake) g.triggerScreenShake(3, 120);
    if (WC) {
      WC.burst(p.x + p.width / 2, p.y + p.height / 2, 10 + Math.round(vol * 12), 2.8 + vol * 2);
      WC.playSplash(0.4 + vol * 0.4);
    }
    me.wetT = WET_FRAMES;
  }

  function shotsStep(g) {
    const WC = window.WaterCore;
    const life = (window.WaterControl && window.WaterControl.SHOT_LIFE) || 22;
    const p = g.player;
    const room = g.world.getCurrentRoom();
    const NR = window.NpcReactions;
    for (const [key, s] of shots) {
      s.t++;
      s.vy += 0.2;
      s.x += s.vx; s.y += s.vy;
      if (WC && s.t % 2 === 0) WC.spawnDrop(s.x - s.vx * 0.5, s.y - s.vy * 0.5, s.vx * 0.1 + (Math.random() - 0.5), s.vy * 0.1, 1 + s.size * 1.5, false);
      let pop = false;
      if (!p.dead && g.deathTimer <= 0 && rectHit(s.x, s.y, s.r, p)) {
        soakMe(g, s.vx, s.size);
        pop = true;
      }
      if (!pop) {
        for (const pl of others) {
          if (pl.id !== s.owner && pl.ghost && !pl.ghost.dead && rectHit(s.x, s.y, s.r, pl.ghost)) { pop = true; break; }
        }
      }
      // Enemigos: revienta en ellos (el que la tiró decide el aturdido; el anfitrión lo aplica)
      if (!pop) {
        for (const e of g.enemies) {
          if (e && e.alive && rectHit(s.x, s.y, s.r, e)) { pop = true; break; }
        }
      }
      // Maestros y vecinos: los moja y el maestro le devuelve el agua al que la tiró
      if (!pop && NR) {
        const npc = NR.hitTest(room, s.x, s.y, s.r);
        if (npc) { NR.splash(g, npc, 0.35 + s.size * 0.65, s.vx, ghostOf(s.owner)); pop = true; }
      }
      if (!pop && inPlatform(g.world, s.x, s.y, s.r)) pop = true;
      if (pop || s.t >= life) {
        if (WC) {
          WC.burst(s.x, s.y, 6 + Math.round(s.size * (pop ? 12 : 8)), pop ? 2.6 + s.size * 2.2 : 1.6);
          WC.playSplash(pop ? 0.35 + s.size * 0.5 : 0.2);
        }
        shots.delete(key);
        continue;
      }
      if (s.x < -50 || s.x > room.width + 50 || s.y > room.height + 50) shots.delete(key);
    }
    // Esferas guiadas ajenas: siguen su posición de la red y me empapan al atravesarme
    if (me.guideCd > 0) me.guideCd--;
    for (const gs of guides.values()) {
      gs.x += (gs.tx + gs.vx - gs.x) * 0.35;
      gs.y += (gs.ty + gs.vy - gs.y) * 0.35;
      if (WC && frame % 3 === 0) WC.spawnDrop(gs.x, gs.y, (Math.random() - 0.5) * 0.8, 0.3, 1.2, false);
      if (me.guideCd <= 0 && !p.dead && g.deathTimer <= 0 && rectHit(gs.x, gs.y, gs.r, p)) {
        soakMe(g, gs.vx || (p.x + p.width / 2 - gs.x), 0.6);
        me.guideCd = 45;
      }
      // Moja una sola vez al maestro (en la computadora del dueño la esfera se gasta ahí)
      if (!gs.npcDone && NR) {
        const npc = NR.hitTest(room, gs.x, gs.y, gs.r || 13);
        if (npc) { gs.npcDone = true; NR.splash(g, npc, 0.7, gs.vx, ghostOf(gs.owner)); }
      }
    }
    // Mis bolas lanzadas revientan al chocar con un compañero (él se moja en su computadora)
    const mine = window.WaterControl && window.WaterControl.shots;
    if (mine) {
      for (const s of mine) {
        if (!s.on) continue;
        for (const pl of others) {
          const gh = pl.ghost;
          if (!gh || gh.dead || !rectHit(s.x, s.y, s.r, gh)) continue;
          s.on = false;
          if (WC) {
            WC.burst(s.x, s.y, 8 + Math.round(s.size * 12), 2.6 + s.size * 2.2);
            WC.playSplash(0.35 + s.size * 0.5);
          }
          if (window.particleSystem) window.particleSystem.createShockwave(s.x, s.y, 14 + s.size * 16, 'rgba(200, 236, 255, 0.85)', 2);
          break;
        }
      }
    }
  }

  // Gotas que chorrean de un Ruben empapado
  function drip(p) {
    const WC = window.WaterCore;
    if (!WC || frame % 4) return;
    WC.spawnDrop(p.x + 3 + Math.random() * (p.width - 6), p.y + 8 + Math.random() * 22, (Math.random() - 0.5) * 0.6, 0.4, 1 + Math.random() * 0.8, false);
  }

  function ghostOf(id) {
    for (const pl of others) if (pl.id === id) return pl.ghost || null;
    return null;
  }

  // ---------------- dibujo del agua ajena ----------------
  function render(g, ctx, cam) {
    if (!on() || !g.isPlaying) return;
    const WC = window.WaterCore;
    if (!WC || !WC.drawOrb) return;
    const t = WC.ws ? WC.ws.t : frame;
    for (const pl of others) {
      const e = pl.st && pl.st.e;
      const gh = pl.ghost;
      if (!e || !e.o || !gh || gh.dead) continue;
      const r = e.o[0], a = e.o[1];
      const hx = gh.x + gh.width / 2 + Math.cos(a) * 16, hy = gh.y + 19 + Math.sin(a) * 14;
      WC.drawOrb(ctx, hx + Math.cos(a) * (6 + r) - cam.x, hy + Math.sin(a) * (6 + r) - cam.y, r, t);
    }
    const life = (window.WaterControl && window.WaterControl.SHOT_LIFE) || 22;
    for (const s of shots.values()) {
      const fade = s.t > life - 6 ? Math.max(0, (life - s.t) / 6) : 1;
      WC.drawOrb(ctx, s.x - cam.x, s.y - cam.y, s.r * (0.5 + 0.5 * fade), t + s.t);
    }
    for (const gs of guides.values()) {
      const gx = gs.x - cam.x, gy = gs.y - cam.y, R = gs.r || 13;
      ctx.save();
      const halo = ctx.createRadialGradient(gx, gy, R * 0.6, gx, gy, R * 2.4);
      halo.addColorStop(0, `rgba(170, 230, 255, ${0.35 + 0.15 * Math.sin(t * 0.2)})`);
      halo.addColorStop(1, 'rgba(170, 230, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(gx, gy, R * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      WC.drawOrb(ctx, gx, gy, R, t);
    }
  }

  function clearAll() {
    shots.clear();
    guides.clear();
    srcList.length = 0;
    for (const s of sources.values()) s.power = 0;
    if (window.WindPull && window.WindPull.setRemotes) window.WindPull.setRemotes(srcList);
    me.wh.pull = 0; me.wh.push = 0;
  }

  // ---------------- instalación ----------------
  function install(g) {
    const H = window.GameHooks;
    H.onBeforeUpdate.push((game, running) => {
      if (!on()) {
        if (game.player.windHit) game.player.windHit = null;
        if (srcList.length || shots.size || guides.size) clearAll();
        others = [];
        if (windLoop) updateSound(game);
        return;
      }
      readOthers(game);
      game.player.windHit = me.wh;
      if (!running) { updateSound(game); return; }
      frame++;
      for (const pl of others) {
        const gh = pl.ghost;
        if (!gh || !gh.windHit) continue;
        heelDust(gh, gh.windHit);
        if (gh._coopWet) drip(gh);
      }
    });
    H.onAfterPlayerUpdate.push((game) => {
      if (!on()) return;
      windOnMe(game);
      heelDust(game.player, me.wh);
    });
    H.onAfterUpdate.push((game, running) => {
      if (!on() || !running) return;
      shotsStep(game);
      if (me.wetT > 0) { me.wetT--; drip(game.player); }
      updateSound(game);
    });
    H.onBeforeRoomLoad.push(() => { clearAll(); seenShots.clear(); });
    H.onRestartGame.push(() => { clearAll(); seenShots.clear(); me.wetT = 0; });
    H.onRenderWorld.push((game, ctx, cam) => {
      try { render(game, ctx, cam); } catch (e) { console.error('[Elementos coop]', e); }
    });
  }

  window.CoopElements = {
    pack,
    getState: () => ({ pull: me.wh.pull, push: me.wh.push, dir: me.wh.dir, wet: me.wetT, sources: srcList.length, shots: shots.size, guides: guides.size })
  };
  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Elementos coop] no se pudo iniciar:', e); }
  });
})();
