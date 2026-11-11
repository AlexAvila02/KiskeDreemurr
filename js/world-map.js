/**
 * Mapa del reino - Ruben: En Busca de Angelo (Claude)
 *
 * Ventana de mapa que se abre con un botón: M en el teclado (si no está asignada a otra
 * acción) o R3 (clic del stick derecho) en el mando. Se cierra con M / R3, Esc, B o Start.
 * Pausa el juego mientras está abierto (igual que el Diario).
 *
 * El plano se arma solo a partir de las salidas de cada sala (izquierda, derecha, arriba,
 * abajo): cada sala es un rectángulo proporcional a su ancho. Se dibujan las salas
 * visitadas; las salas vecinas sin visitar aparecen como contorno punteado con "?".
 * La sala actual late y muestra dónde está Ruben.
 * Hooks: onInit, onBeforeTogglePause (MAPA.md). Amplía MenuNavigator.handlePad.
 */
(function () {
  'use strict';

  const INK = '#3a2416';
  const ROOM_H = 540;
  const GAP_X = 60, GAP_Y = 90;
  // Las salas son muy anchas y bajas: en el plano se dibujan más altas para que se lean
  const Y_STRETCH = 2.2;
  const BIOME_FILL = { pradera: '#b9cf86', bosque: '#86a86a', montana: '#b3b0a6', castillo: '#b49a86' };

  function exitDir(room, ex) {
    if (ex.y + ex.h <= 0 || ex.y < -40) return 'up';
    if (ex.y >= (room.height || ROOM_H) - 80 && ex.w >= 60 && ex.x > 0 && ex.x + ex.w < room.width) return 'down';
    if (ex.x <= 0) return 'left';
    if (ex.x + ex.w >= room.width) return 'right';
    return ex.y > (room.height || ROOM_H) / 2 ? 'down' : 'up';
  }

  // Centro horizontal de una salida de arriba/abajo: el hueco marcado (hint) si lo hay
  function holeX(ex) { return ex.hint ? ex.hint.x + ex.hint.w / 2 : ex.x + ex.w / 2; }

  // Coloca las salas en un plano (unidades = píxeles del juego) recorriendo las salidas
  function layout(rooms) {
    const pos = {};
    const queue = [];
    const start = rooms[0] ? 0 : rooms.findIndex(Boolean);
    if (start < 0) return pos;
    pos[start] = { x: 0, y: 0 };
    queue.push(start);
    const place = (j, q) => { pos[j] = q; queue.push(j); };
    while (queue.length) {
      const i = queue.shift();
      const r = rooms[i], p = pos[i];
      const rh = r.height || ROOM_H;
      // Salidas de esta sala
      for (const ex of (r.exits || [])) {
        const j = ex.targetRoom, nb = rooms[j];
        if (!nb || pos[j]) continue;
        const d = exitDir(r, ex);
        const nh = nb.height || ROOM_H;
        const cx = p.x + holeX(ex) - (ex.targetX || 0);
        if (d === 'right') place(j, { x: p.x + r.width + GAP_X, y: p.y });
        else if (d === 'left') place(j, { x: p.x - nb.width - GAP_X, y: p.y });
        else if (d === 'down') place(j, { x: cx, y: p.y + rh + GAP_Y });
        else place(j, { x: cx, y: p.y - nh - GAP_Y });
      }
      // Salidas de otras salas que llegan a esta (por si la ida no está declarada)
      rooms.forEach((nb, j) => {
        if (!nb || pos[j] || !nb.exits) return;
        const ex = nb.exits.find(e => e.targetRoom === i);
        if (!ex) return;
        const d = exitDir(nb, ex);
        const nh = nb.height || ROOM_H;
        const cx = p.x + (ex.targetX || 0) - holeX(ex);
        if (d === 'right') place(j, { x: p.x - nb.width - GAP_X, y: p.y });
        else if (d === 'left') place(j, { x: p.x + r.width + GAP_X, y: p.y });
        else if (d === 'down') place(j, { x: cx, y: p.y - nh - GAP_Y });
        else place(j, { x: cx, y: p.y + rh + GAP_Y });
      });
    }
    // Salas sin conexión desde el inicio: a la derecha de todo, en su fila
    let maxX = 0;
    for (const k in pos) maxX = Math.max(maxX, pos[k].x + rooms[k].width);
    rooms.forEach((r, i) => { if (r && !pos[i]) { pos[i] = { x: maxX + 120, y: 0 }; maxX += r.width + 120; } });
    return pos;
  }

  class WorldMap {
    constructor(game) {
      this.game = game;
      this.t = 0;
      this.raf = 0;
      this.build();
      this.setupKeys();
      this.setupPad();
      const H = window.GameHooks;
      H.onBeforeTogglePause.push(() => {
        if (!this.isOpen()) return false;
        this.close();
        return true;
      });
    }

    build() {
      const hud = document.getElementById('hud-overlay') || document.body;
      const m = document.createElement('div');
      m.id = 'map-modal';
      m.className = 'modal-overlay hidden';
      m.innerHTML =
        '<div class="map-card">' +
        '  <div class="map-title">MAPA DEL REINO</div>' +
        '  <canvas class="map-canvas" width="880" height="420"></canvas>' +
        '  <div class="map-room-name"></div>' +
        '  <div class="map-hint">M / R3 · Esc / B para cerrar</div>' +
        '</div>';
      m.addEventListener('click', (e) => { if (e.target === m) this.close(); });
      hud.appendChild(m);
      this.modal = m;
      this.canvas = m.querySelector('canvas');
      this.nameEl = m.querySelector('.map-room-name');
    }

    isOpen() { return !!this.modal && !this.modal.classList.contains('hidden'); }

    canOpen() {
      const g = this.game;
      if (!g.isPlaying || g.isPaused || g.deathTimer > 0 || this.isOpen()) return false;
      if (g.journal && g.journal.isOpen && g.journal.isOpen()) return false;
      if (g.controlsManager && g.controlsManager.isModalOpen && g.controlsManager.isModalOpen()) return false;
      return true;
    }

    open() {
      if (!this.canOpen()) return;
      const g = this.game;
      g.isPaused = true;
      g.keys = {};
      this.modal.classList.remove('hidden');
      const room = g.world.getCurrentRoom();
      this.nameEl.textContent = room ? room.name : '';
      if (window.soundManager && window.soundManager.playPickup) try { window.soundManager.playPickup(); } catch (e) { /* */ }
      const loop = () => { this.t++; this.draw(); if (this.isOpen()) this.raf = requestAnimationFrame(loop); };
      cancelAnimationFrame(this.raf);
      loop();
    }

    close() {
      if (!this.isOpen()) return;
      const g = this.game;
      this.modal.classList.add('hidden');
      cancelAnimationFrame(this.raf);
      g.keys = {};
      g.isPaused = false;
      const pause = document.getElementById('pause-modal');
      if (pause) pause.classList.add('hidden');
    }

    toggle() { if (this.isOpen()) this.close(); else this.open(); }

    draw() {
      const g = this.game, rooms = g.world.rooms;
      const c = this.canvas, ctx = c.getContext('2d');
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      // Papel
      ctx.fillStyle = '#efe0bd';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(58, 36, 22, 0.08)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      const pos = this.pos || (this.pos = layout(rooms));
      if (rooms.length !== this.layoutCount) { this.pos = layout(rooms); this.layoutCount = rooms.length; }
      const P = this.pos;
      const visited = g.visitedRooms || new Set([g.world.currentRoomIndex]);
      const cur = g.world.currentRoomIndex;
      // Salas a mostrar: visitadas + vecinas de visitadas
      const known = new Set();
      visited.forEach(i => { if (rooms[i]) known.add(i); });
      known.add(cur);
      const hinted = new Set();
      known.forEach(i => (rooms[i].exits || []).forEach(ex => { if (rooms[ex.targetRoom] && !known.has(ex.targetRoom)) hinted.add(ex.targetRoom); }));
      const shown = [...known, ...hinted];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const i of shown) {
        const p = P[i], r = rooms[i];
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x + r.width); y1 = Math.max(y1, p.y + (r.height || ROOM_H));
      }
      const pad = 34;
      const s = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / ((y1 - y0) * Y_STRETCH), 0.16);
      const sy = s * Y_STRETCH;
      const ox = (W - (x1 - x0) * s) / 2 - x0 * s;
      const oy = (H - (y1 - y0) * sy) / 2 - y0 * sy;
      const rect = (i) => { const p = P[i], r = rooms[i]; return { x: ox + p.x * s, y: oy + p.y * sy, w: r.width * s, h: (r.height || ROOM_H) * sy }; };

      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // Conexiones (pasillos) entre salas conocidas
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      known.forEach(i => {
        const r = rooms[i], a = rect(i);
        for (const ex of (r.exits || [])) {
          const j = ex.targetRoom;
          if (!rooms[j] || !(known.has(j) || hinted.has(j))) continue;
          const b = rect(j), d = exitDir(r, ex);
          ctx.setLineDash(known.has(j) ? [] : [4, 5]);
          ctx.beginPath();
          if (d === 'right') { const y = a.y + (ex.y + ex.h / 2) * sy; ctx.moveTo(a.x + a.w, y); ctx.lineTo(b.x, y); }
          else if (d === 'left') { const y = a.y + (ex.y + ex.h / 2) * sy; ctx.moveTo(a.x, y); ctx.lineTo(b.x + b.w, y); }
          else if (d === 'down') { const x = a.x + holeX(ex) * s; ctx.moveTo(x, a.y + a.h); ctx.lineTo(x, b.y); }
          else { const x = a.x + holeX(ex) * s; ctx.moveTo(x, a.y); ctx.lineTo(x, b.y + b.h); }
          ctx.stroke();
        }
      });
      ctx.setLineDash([]);

      // Salas vecinas sin visitar
      hinted.forEach(i => {
        const b = rect(i);
        ctx.fillStyle = 'rgba(58, 36, 22, 0.06)';
        ctx.strokeStyle = 'rgba(58, 36, 22, 0.55)'; ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 6); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(58, 36, 22, 0.6)';
        ctx.font = '700 18px Cinzel, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', b.x + b.w / 2, b.y + b.h / 2);
      });

      // Salas visitadas
      known.forEach(i => {
        const r = rooms[i], b = rect(i);
        ctx.fillStyle = BIOME_FILL[r.biome] || '#cdb48a';
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 6); ctx.fill(); ctx.stroke();
        // Plataformas sólidas como silueta
        ctx.fillStyle = 'rgba(58, 36, 22, 0.45)';
        for (const pl of (r.platforms || [])) {
          if (pl.type === 'wall' || pl.type === 'ceiling') continue;
          const px = Math.max(0, pl.x), pw = Math.min(r.width, pl.x + pl.w) - px;
          if (pw <= 0) continue;
          ctx.fillRect(b.x + px * s, b.y + pl.y * sy, pw * s, Math.max(1.5, Math.min(pl.h, (r.height || ROOM_H) - pl.y) * sy));
        }
        // Agua
        ctx.fillStyle = 'rgba(80, 150, 200, 0.75)';
        for (const w of (r.water || [])) ctx.fillRect(b.x + w.x * s, b.y + w.y * sy, w.w * s, w.h * sy);
      });

      // Sala actual: borde que late y Ruben
      if (rooms[cur]) {
        const b = rect(cur), k = 0.5 + 0.5 * Math.sin(this.t * 0.12);
        ctx.strokeStyle = `rgba(217, 166, 52, ${0.6 + 0.4 * k})`; ctx.lineWidth = 3 + k * 2;
        ctx.beginPath(); ctx.roundRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 8); ctx.stroke();
        const p = g.player;
        const rx = b.x + (p.x + p.width / 2) * s, ry = b.y + (p.y + p.height / 2) * sy;
        ctx.fillStyle = '#e2483a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(rx, ry, 5 + k * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    setupKeys() {
      window.addEventListener('keydown', (e) => {
        const g = this.game, cm = g.controlsManager;
        if (cm && cm.isListening && cm.isListening()) return;
        const isM = e.code === 'KeyM' && !(cm && cm.getActionForKey && cm.getActionForKey('KeyM'));
        if (this.isOpen()) {
          if (isM || e.code === 'Escape') {
            e.preventDefault(); e.stopImmediatePropagation();
            if (!e.repeat) this.close();
          }
          return;
        }
        if (isM && !e.repeat && this.canOpen()) {
          e.preventDefault(); e.stopImmediatePropagation();
          this.open();
        }
      }, true);
    }

    setupPad() {
      const nav = this.game.menuNav;
      if (!nav || !nav.handlePad) return;
      const origGet = nav.getActiveMenu ? nav.getActiveMenu.bind(nav) : null;
      if (origGet) nav.getActiveMenu = () => (this.isOpen() ? this.modal : origGet());
      const orig = nav.handlePad.bind(nav);
      nav.handlePad = (pressed, prev) => {
        const just = (i) => pressed[i] && !prev[i];
        if (this.isOpen()) {
          if (just(1) || just(9) || just(11) || just(8)) this.close();
          return true;
        }
        if (just(11) && this.canOpen() && !(origGet && origGet())) { this.open(); return true; }
        return orig(pressed, prev);
      };
    }
  }

  window.GameHooks = window.GameHooks || {};
  window.GameHooks.onBeforeTogglePause = window.GameHooks.onBeforeTogglePause || [];
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { game.worldMap = new WorldMap(game); window.WorldMap = game.worldMap; } catch (e) { console.error('[Mapa] no se pudo iniciar:', e); }
  });
})();
