/**
 * Abismos - Caer por un barranco ya no mata (Claude, 17/11)
 *
 * Si Ruben cae al vacío en una sala de la superficie, aparece en una gruta del abismo llena
 * de enemigos donde hay un objeto nuevo para el Diario. Al fondo de cada gruta, un túnel
 * vuelve a la superficie: a la sala de la que cayó, en el punto donde había entrado a ella.
 *
 *   1ª caída → sala 13, GRUTA DEL ECO ........... Bastón del Ermitaño (arma, +50% alcance)
 *   2ª caída → sala 14, MADRIGUERA DE LOS TOPOS .. Colmillo de Topo (amuleto, +20% daño)
 *   3ª caída → sala 15, CALABOZO HUNDIDO ......... Caparazón Hueco (amuleto, +15% defensa)
 *   Después: se elige la primera gruta cuyo objeto falte; con todo juntado, se van turnando.
 *
 * - Salas registradas con window.PendingRooms (room.abyss = true, room.hideOnMap = true).
 * - Hooks: onPlayerFall (consume la muerte por caída), onRoomLoad (apunta el túnel de vuelta),
 *   onRestartGame, onRenderWorld (cartel del túnel y haz de luz por donde cayó).
 * - Guardado propio: 'ruben_abismo_v1' = { falls, back: { room, x, y } }.
 */
(function () {
  'use strict';

  const SAVE_KEY = 'ruben_abismo_v1';
  const INK = '#3a2416';
  const ABYSS_IDS = [13, 14, 15];
  const ABYSS_ITEM = { 13: 'baston', 14: 'colmillo', 15: 'caparazon' };

  window.PendingRooms = window.PendingRooms || [];
  const R = (cfg) => window.PendingRooms.push(cfg);

  const ground = (x, w) => ({ x, y: 460, w, h: 80, type: 'ground' });
  const ceiling = (x, w) => ({ x, y: 0, w, h: 20, type: 'ceiling' });
  const ruin = (x, y, w, h = 22) => ({ x, y, w, h, type: 'ruins' });
  const crawler = (x, top, patrol) => new CrawlerEnemy(x, top - 24, patrol);
  const stone = (x, top) => new ThrowableDebris(x, top - 18);
  // Túnel de vuelta (borde derecho). targetRoom/X/Y se completan al entrar (onRoomLoad)
  const tunnel = (w) => ({ x: w - 40, y: 340, w: 40, h: 120, targetRoom: 0, targetX: 80, targetY: 410, abyssReturn: true });

  // ==========================================================
  // SALA 13: Gruta del Eco (1ª caída) — Bastón del Ermitaño
  // ==========================================================
  R({
    id: 13,
    name: 'GRUTA DEL ECO',
    biome: 'montana',
    abyss: true,
    hideOnMap: true,
    width: 2200,
    height: 540,
    platforms: [
      ground(0, 2200),
      ceiling(180, 2020),                       // x 0-180: el hueco por donde cayó
      ruin(320, 360, 140), ruin(560, 290, 130),
      ruin(820, 370, 150),
      ruin(1040, 370, 120), ruin(1200, 280, 150),   // altar del bastón
      ruin(1500, 350, 140), ruin(1760, 300, 130)
    ],
    tablets: [
      {
        x: 230, y: 415,
        speaker: 'Nota de Angelo',
        text: '«Si caíste hasta acá, no estás solo... ni a salvo. Al fondo de la gruta hay un túnel que sube. — A.»'
      }
    ],
    collectibles: [
      { item: 'baston', x: 1275, y: 244 }
    ],
    exits: [tunnel(2200)],
    spawnEnemies: () => [
      crawler(420, 460, 120),
      crawler(480, 460, 120),
      crawler(700, 460, 140),
      crawler(760, 460, 140),
      crawler(980, 460, 110),
      crawler(1040, 460, 110),
      crawler(1215, 280, 45),
      crawler(1285, 280, 45),
      crawler(1380, 460, 130),
      crawler(1440, 460, 130),
      crawler(1650, 460, 140),
      crawler(1710, 460, 140),
      crawler(1890, 460, 120),
      crawler(1950, 460, 120),
      new FlyingShadeEnemy(640, 200),
      new FlyingShadeEnemy(700, 235),
      new FlyingShadeEnemy(1120, 170),
      new FlyingShadeEnemy(1180, 205),
      new FlyingShadeEnemy(1600, 210),
      new FlyingShadeEnemy(1660, 175),
      new FlyingShadeEnemy(1900, 180),
      new FlyingShadeEnemy(1960, 215)
    ],
    spawnDebris: () => [stone(150, 460), stone(900, 460), stone(1560, 350)]
  });

  // ==========================================================
  // SALA 14: Madriguera de los Topos (2ª caída) — Colmillo de Topo
  // ==========================================================
  R({
    id: 14,
    name: 'MADRIGUERA DE LOS TOPOS',
    biome: 'bosque',
    abyss: true,
    hideOnMap: true,
    width: 2100,
    height: 540,
    platforms: [
      ground(0, 2100),
      ceiling(180, 1920),
      ruin(300, 380, 120), ruin(500, 300, 120), ruin(700, 220, 140),   // subida al colmillo
      ruin(980, 360, 160),
      ruin(1260, 300, 140), ruin(1520, 380, 120), ruin(1720, 290, 140)
    ],
    collectibles: [
      { item: 'colmillo', x: 770, y: 184 }
    ],
    exits: [tunnel(2100)],
    spawnEnemies: () => [
      crawler(360, 460, 120),
      crawler(420, 460, 120),
      crawler(515, 300, 40),
      crawler(570, 300, 40),
      crawler(760, 460, 150),
      crawler(820, 460, 150),
      crawler(1000, 360, 50),
      crawler(1080, 360, 50),
      crawler(1180, 460, 140),
      crawler(1240, 460, 140),
      crawler(1460, 460, 130),
      crawler(1520, 460, 130),
      crawler(1780, 460, 120),
      crawler(1840, 460, 120),
      crawler(1740, 290, 45),
      crawler(1810, 290, 45),
      new FlyingShadeEnemy(780, 150),
      new FlyingShadeEnemy(840, 185),
      new FlyingShadeEnemy(1300, 200),
      new FlyingShadeEnemy(1360, 165),
      new FlyingShadeEnemy(1700, 170),
      new FlyingShadeEnemy(1760, 205)
    ],
    spawnDebris: () => [stone(140, 460), stone(1000, 360), stone(1600, 460)]
  });

  // ==========================================================
  // SALA 15: Calabozo Hundido (3ª caída) — Caparazón Hueco
  // ==========================================================
  R({
    id: 15,
    name: 'CALABOZO HUNDIDO',
    biome: 'castillo',
    abyss: true,
    hideOnMap: true,
    width: 2300,
    height: 540,
    platforms: [
      ground(0, 2300),
      ceiling(180, 2120),
      ruin(340, 360, 140), ruin(620, 290, 120), ruin(880, 360, 140),
      ruin(1160, 300, 140), ruin(1420, 230, 130),   // torre del caparazón
      ruin(1700, 360, 150), ruin(1960, 300, 130)
    ],
    collectibles: [
      { item: 'caparazon', x: 1485, y: 194 }
    ],
    exits: [tunnel(2300)],
    spawnEnemies: () => [
      crawler(420, 460, 130),
      crawler(480, 460, 130),
      crawler(680, 460, 120),
      crawler(740, 460, 120),
      crawler(940, 460, 140),
      crawler(1000, 460, 140),
      crawler(1180, 300, 45),
      crawler(1250, 300, 45),
      crawler(1300, 460, 130),
      crawler(1360, 460, 130),
      crawler(1560, 460, 140),
      crawler(1620, 460, 140),
      crawler(1720, 360, 50),
      crawler(1795, 360, 50),
      crawler(1990, 460, 110),
      crawler(2050, 460, 110),
      new FlyingShadeEnemy(560, 190),
      new FlyingShadeEnemy(620, 225),
      new FlyingShadeEnemy(1000, 170),
      new FlyingShadeEnemy(1060, 205),
      new FlyingShadeEnemy(1450, 140),
      new FlyingShadeEnemy(1510, 175),
      new FlyingShadeEnemy(1900, 200),
      new FlyingShadeEnemy(1960, 165)
    ],
    spawnDebris: () => [stone(150, 460), stone(1100, 460), stone(1800, 460)]
  });

  // ------------------------------------------------------------------
  // Guardado
  // ------------------------------------------------------------------
  function load() {
    try {
      const d = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null');
      if (d && typeof d === 'object') return { falls: d.falls | 0, back: d.back || null };
    } catch (e) { /* sin guardado */ }
    return { falls: 0, back: null };
  }
  let state = load();
  function persist() {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* sin guardado */ }
  }

  function owns(game, item) {
    const j = game.journal;
    return !!(j && j.ownsItem && j.ownsItem(item));
  }

  // Gruta a la que cae: en orden, la primera cuyo objeto falte; si están todos, se turnan
  function pickAbyss(game) {
    const rooms = game.world.rooms;
    const ids = ABYSS_IDS.filter(id => rooms[id]);
    if (!ids.length) return -1;
    for (const id of ids) if (!owns(game, ABYSS_ITEM[id])) return id;
    return ids[state.falls % ids.length];
  }

  function onFall(game) {
    const p = game.player;
    if (p.dead || game.deathTimer > 0) return false;
    const room = game.world.getCurrentRoom();
    if (room && room.abyss) return false;          // (las grutas no tienen barrancos)
    const target = pickAbyss(game);
    if (target < 0) return false;
    const rp = game.respawnPoint || { x: 80, y: 410 };
    state.back = { room: game.world.currentRoomIndex, x: rp.x, y: rp.y };
    state.falls += 1;
    persist();
    p.vx = 0;
    p.vy = 0;
    p.invulnerableTimer = Math.max(p.invulnerableTimer || 0, 60);
    game.loadRoom(target, 70, 24);
    const sm = window.soundManager;
    if (sm && sm.playHit) try { sm.playHit(); } catch (e) { /* */ }
    if (game.triggerScreenShake) game.triggerScreenShake(6, 220);
    const name = game.world.getCurrentRoom().name;
    game.showNotification(`¡Caíste a ${name}! Buscá el túnel al fondo para volver`);
    return true;
  }

  // Al entrar a una gruta, el túnel apunta a donde Ruben estaba antes de caer
  function aimTunnel(game, room) {
    if (!room || !room.abyss || !room.exits) return;
    const back = state.back;
    const rooms = game.world.rooms;
    const ok = back && rooms[back.room] && !rooms[back.room].abyss;
    for (const ex of room.exits) {
      if (!ex.abyssReturn) continue;
      ex.targetRoom = ok ? back.room : 0;
      ex.targetX = ok ? back.x : 80;
      ex.targetY = ok ? back.y : 410;
    }
  }

  // Cartel del túnel y haz de luz por el hueco de arriba (estilo años 50: tinta marrón)
  function render(game, ctx, cam) {
    const room = game.world.getCurrentRoom();
    if (!room || !room.abyss) return;
    const t = Date.now() * 0.001;
    ctx.save();
    // Oscuridad de gruta (esta capa va detrás de Ruben y los enemigos: ellos quedan claros)
    ctx.fillStyle = 'rgba(22, 13, 9, 0.62)';
    ctx.fillRect(0, 0, 960, 540);
    // Estalactitas colgando del techo
    ctx.fillStyle = '#2a1d16'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    const first = Math.floor((cam.x - 40) / 110);
    for (let i = first; i < first + 11; i++) {
      const x = i * 110 + ((i * 37) % 50) - cam.x;
      if (i * 110 < 200 || i * 110 > room.width - 60) continue;
      const len = 22 + ((i * 53) % 34);
      ctx.beginPath();
      ctx.moveTo(x - 12, 18 - cam.y); ctx.quadraticCurveTo(x - 3, 18 + len * 0.6 - cam.y, x, 18 + len - cam.y);
      ctx.quadraticCurveTo(x + 3, 18 + len * 0.6 - cam.y, x + 12, 18 - cam.y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Haz de luz por donde cayó
    const lx = 90 - cam.x, ly = -cam.y;
    if (lx > -200 && lx < 1160) {
      const g = ctx.createLinearGradient(lx, ly, lx, ly + 460);
      g.addColorStop(0, 'rgba(255, 244, 200, 0.4)');
      g.addColorStop(1, 'rgba(255, 244, 200, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(lx - 70, ly); ctx.lineTo(lx + 70, ly);
      ctx.lineTo(lx + 120, ly + 460); ctx.lineTo(lx - 120, ly + 460);
      ctx.closePath(); ctx.fill();
    }
    // Boca del túnel con luz del día y cartel
    const ex = room.width - cam.x, ey = 460 - cam.y;
    if (ex > -100 && ex < 1300) {
      const glow = ctx.createRadialGradient(ex - 10, ey - 60, 4, ex - 10, ey - 60, 90);
      glow.addColorStop(0, 'rgba(255, 240, 190, ' + (0.45 + 0.1 * Math.sin(t * 2)) + ')');
      glow.addColorStop(1, 'rgba(255, 240, 190, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(ex - 10, ey - 60, 90, 0, Math.PI * 2); ctx.fill();
      // Poste y tabla
      const sx = ex - 130, sy = ey;
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.fillStyle = '#7a4a2b';
      ctx.beginPath(); ctx.rect(sx - 3, sy - 58, 6, 58); ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.translate(sx, sy - 62);
      ctx.rotate(Math.sin(t * 1.3) * 0.03);
      ctx.fillStyle = '#d8b57a';
      ctx.beginPath();
      ctx.moveTo(-40, -14); ctx.lineTo(30, -14); ctx.lineTo(44, 0); ctx.lineTo(30, 14); ctx.lineTo(-40, 14);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = 'bold 11px Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SUPERFICIE', -2, 1);
      ctx.restore();
    }
    ctx.restore();
  }

  window.Abyss = { ids: ABYSS_IDS.slice(), state: () => state };

  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    const H = window.GameHooks;
    H.onPlayerFall.push((g) => onFall(g));
    H.onRoomLoad.push((g, room) => aimTunnel(g, room));
    // Detrás de Ruben (capa 'world' de AnimationRegistry); sin ella, por delante como respaldo
    const AR = window.AnimationRegistry;
    if (AR && AR.registerLayer) AR.registerLayer('world', 'abyss-cave', { order: 40, after(world, ctx, cam) { render(game, ctx, cam); } });
    else H.onRenderWorld.push((g, ctx, cam) => render(g, ctx, cam));
    H.onRestartGame.push(() => { state = { falls: 0, back: null }; persist(); });
    // Si la partida arranca (o se continúa) dentro de una gruta, apuntar el túnel igual
    aimTunnel(game, game.world.getCurrentRoom());
  });
})();
