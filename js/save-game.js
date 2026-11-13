/**
 * Partida guardada - Ruben: En Busca de Angelo (Claude)
 * Botones de la pantalla de inicio: NUEVA PARTIDA · CONTINUAR · OPCIONES.
 *
 * Guarda en localStorage ('ruben_partida_v1') dónde está Ruben y el estado de las salas
 * (llave tomada, portón abierto, muros rotos, llaves). El progreso de habilidades y del
 * Diario ya se guarda solo en sus módulos (ruben_diario_v1, agua), así que no se duplica.
 *
 * Cuándo guarda: al cambiar de sala, al ir al menú principal y cada ~2 s mientras se juega.
 * Hooks: onInit (engancha los botones) · onRoomLoad · onAfterUpdate (ver MAPA.md).
 */
(function () {
  const SAVE_KEY = 'ruben_partida_v1';
  const CONFIRM_MS = 4000;
  const SAVE_EVERY = 120; // cuadros (~2 s a 60 FPS)

  let tick = 0;
  let armedUntil = 0;
  let armTimer = null;

  function readSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.v === 1 ? s : null;
    } catch (e) { return null; }
  }

  function hasSave() { return !!readSave(); }

  function writeSave(data) {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* sin guardado */ }
  }

  function clearSave() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ }
  }

  // Foto del estado actual del mundo (solo datos planos)
  function snapshot(game) {
    const w = game.world;
    if (!w || !w.rooms) return null;
    const rooms = {};
    for (let i = 0; i < w.rooms.length; i++) {
      const r = w.rooms[i];
      if (!r) continue;
      const st = {};
      if (r.keyItem && r.keyItem.collected) st.key = 1;
      if (r.door && !r.door.isLocked) st.door = 1;
      const broken = [];
      (r.breakables || []).forEach((b, j) => { if (b.broken) broken.push(j); });
      if (broken.length) st.broken = broken;
      if (Object.keys(st).length) rooms[i] = st;
    }
    const p = game.player;
    const rp = game.respawnPoint || { x: p.x, y: p.y };
    return {
      v: 1,
      room: w.currentRoomIndex,
      x: Math.round(rp.x),
      y: Math.round(rp.y),
      keys: p.keys | 0,
      visited: Array.from(game.visitedRooms || [w.currentRoomIndex]),
      rooms
    };
  }

  function saveNow(game) {
    if (!game || !game.isPlaying || !game.player || game.player.dead) return;
    // De invitado en una sala multijugador el mundo es del anfitrión: no pisar la partida propia
    if (window.Multiplayer && window.Multiplayer.isGuest()) return;
    const data = snapshot(game);
    if (data) writeSave(data);
  }

  // Reconstruye el mundo desde la partida guardada
  function continueGame(game) {
    const s = readSave();
    if (!s) return false;
    game.world = new World();
    // Mismos parches que al iniciar (salida de la sala 3 a la 4, emblemas de las salas 0-3)
    if (window.LevelsExpansion && window.LevelsExpansion.patchOriginalRooms) window.LevelsExpansion.patchOriginalRooms(game.world);
    for (const k of Object.keys(s.rooms || {})) {
      const r = game.world.rooms[+k];
      const st = s.rooms[k];
      if (!r || !st) continue;
      if (st.key && r.keyItem) r.keyItem.collected = true;
      // Portón ya abierto: sin animación, queda abierto de entrada
      if (st.door && r.door) r.door.isLocked = false;
      for (const j of st.broken || []) { if (r.breakables && r.breakables[j]) r.breakables[j].broken = true; }
    }
    const p = game.player;
    if (p.carriedItem) { p.carriedItem.isCarried = false; p.carriedItem = null; }
    p.keys = s.keys | 0;
    p.dead = false;
    p.hp = p.maxHp;
    p.vx = 0;
    p.vy = 0;
    p.facing = 1;
    p.isAttacking = false;
    p.attackTimer = 0;
    p.attackCooldown = 0;
    p.invulnerableTimer = 60;
    game.deathTimer = 0;
    game.hitStopFrames = 0;
    game.deathCause = null;
    game.visitedRooms = new Set(s.visited || [s.room]);
    game.loadRoom(s.room, s.x, s.y);
    game.updateHUD();
    return true;
  }

  // CONTINUAR solo se activa si hay partida guardada
  function refreshButtons() {
    const cont = document.getElementById('btn-continue');
    if (cont) cont.disabled = !hasSave();
  }

  function disarm() {
    armedUntil = 0;
    clearTimeout(armTimer);
    const start = document.getElementById('btn-start');
    if (start) { start.classList.remove('btn-confirm'); start.textContent = 'NUEVA PARTIDA'; }
  }

  function install(game) {
    const start = document.getElementById('btn-start');
    const cont = document.getElementById('btn-continue');
    const pauseMenu = document.getElementById('btn-pause-menu');
    refreshButtons();

    // NUEVA PARTIDA: si hay progreso guardado, pide confirmación (segundo clic) porque lo borra.
    // Se registra antes que el listener de main.js: con stopImmediatePropagation frena el arranque.
    if (start) {
      start.addEventListener('click', (ev) => {
        if (hasSave() && Date.now() >= armedUntil) {
          ev.stopImmediatePropagation();
          armedUntil = Date.now() + CONFIRM_MS;
          start.classList.add('btn-confirm');
          start.textContent = '¿SEGURO? SE BORRA TODO';
          armTimer = setTimeout(disarm, CONFIRM_MS);
          return;
        }
        // Confirmado (o sin progreso): mundo nuevo y progreso de habilidades borrado
        disarm();
        clearSave();
        game.restartGame();
        // main.js sigue con el arranque normal (oculta el menú, inicia la partida)
      });
    }

    if (cont) {
      cont.addEventListener('click', () => {
        if (!hasSave()) return;
        window.soundManager.init();
        if (!continueGame(game)) return;
        document.getElementById('overlay-screen').classList.add('hidden');
        game.isPlaying = true;
        game.irisOpen = 1;
        game.showNotification('Seguí donde lo dejaste...');
      });
    }

    // Al volver al menú principal se guarda la posición exacta y se refresca CONTINUAR
    if (pauseMenu) {
      pauseMenu.addEventListener('click', () => {
        saveNow(game);
        refreshButtons();
      });
    }
  }

  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Partida] no se pudo iniciar el guardado:', e); }
  });
  (window.GameHooks.onRoomLoad = window.GameHooks.onRoomLoad || []).push((game) => {
    saveNow(game);
  });
  (window.GameHooks.onAfterUpdate = window.GameHooks.onAfterUpdate || []).push((game) => {
    if (++tick % SAVE_EVERY === 0) saveNow(game);
  });
  window.SaveGame = { hasSave, saveNow: () => saveNow(window.gameInstance), clear: clearSave };
})();
