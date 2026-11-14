/**
 * Multijugador cooperativo (Claude) — hasta 4 jugadores desde sus casas.
 *
 * El que crea la sala es el ANFITRIÓN y hace de servidor privado: simula los enemigos y
 * es dueño del estado del mundo (llave, portón, muros rotos) y de la sala en la que están
 * todos. Cada jugador mueve a su propio Ruben en su computadora (sin retraso) y manda su
 * posición ~20 veces por segundo; el anfitrión reenvía a todos la foto de jugadores y
 * enemigos.
 *
 * Conexión: WebRTC directo entre navegadores con PeerJS (se carga desde la CDN solo al abrir
 * el menú MULTIJUGADOR). El servidor público de PeerJS solo presenta a los jugadores con un
 * código corto (p. ej. K7Q2M); después la partida va directa entre ellos.
 *
 * Reglas de sala: todos juntos. Si cualquiera cruza una salida, el grupo entero pasa a la
 * sala nueva (el anfitrión decide y avisa a todos).
 *
 * Hooks: onInit · onBeforeUpdate · onAfterUpdate · onRoomLoad · onEnemyTarget ·
 * onRestartGame · onRenderWorld · capa 'player' de AnimationRegistry (color de cada jugador).
 * API: window.Multiplayer { isHost(), isGuest(), isActive(), open(), leave() }
 */
(function () {
  const PEER_SRC = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const PREFIX = 'ruben-angelo-coop-v1-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const MAX_PLAYERS = 4;
  const SEND_EVERY = 3;        // cuadros entre envíos de posición (~20 por segundo)
  const WORLD_EVERY = 30;      // cuadros entre envíos del estado del mundo (si cambió)
  const NAME_KEY = 'ruben_mp_nombre';
  // Color de cada lugar: 0 = colores originales (anfitrión), el resto gira el tono
  // Túnica y bufanda de cada lugar (0 = colores originales de Ruben)
  const SLOT_PALETTE = [null,
    { tunic: '#35577f', scarf: '#6fa3e0' },
    { tunic: '#8a3b4f', scarf: '#e88aa8' },
    { tunic: '#5f5a8a', scarf: '#d7d36a' }];
  const SLOT_COLOR = ['#d9a634', '#6fa3e0', '#e88aa8', '#d7d36a'];
  const FAR = { x: -1e6, y: -1e6, width: 1, height: 1, takeDamage() {} };

  const MP = {
    mode: 'off',            // 'off' | 'host' | 'guest' | 'connecting'
    peer: null,
    code: '',
    myId: 'host',
    mySlot: 0,
    conns: new Map(),       // anfitrión: peerId → conexión
    hostConn: null,         // invitado: conexión al anfitrión
    players: new Map(),     // id → { id, name, slot, room, st, ghost, target }
    netEnemies: new Map(),  // invitado: id de enemigo → NetEnemy
    nextEnemyId: 1,
    frame: 0,
    lastWorldJson: '',
    lastWorldRef: null,
    applyingRoom: false,
    lastExitSentAt: 0,
    ui: null
  };

  // ------------------------------------------------------------------ utilidades
  const game = () => window.gameInstance;
  const r1 = (v) => Math.round(v * 10) / 10;
  const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  function myName() {
    let n = '';
    try { n = localStorage.getItem(NAME_KEY) || ''; } catch (e) { /* */ }
    return n || 'Ruben';
  }
  function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* */ } }
  function cleanName(n) { return String(n || '').replace(/[<>]/g, '').trim().slice(0, 14) || 'Ruben'; }

  function makeCode() {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return c;
  }

  function resolveClass(name) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name || '')) return null;
    if (window[name]) return window[name];
    try { return new Function('return typeof ' + name + ' !== "undefined" ? ' + name + ' : null;')(); } catch (e) { return null; }
  }

  let peerLoading = null;
  function loadPeerJS() {
    if (window.Peer) return Promise.resolve();
    if (peerLoading) return peerLoading;
    peerLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PEER_SRC;
      s.async = true;
      s.onload = () => (window.Peer ? resolve() : reject(new Error('PeerJS no cargó')));
      s.onerror = () => { peerLoading = null; reject(new Error('Sin conexión a internet (no se pudo cargar PeerJS)')); };
      document.head.appendChild(s);
    });
    return peerLoading;
  }

  function send(conn, msg) {
    if (conn && conn.open) { try { conn.send(msg); } catch (e) { /* conexión cayéndose */ } }
  }
  function broadcast(msg, exceptId) {
    for (const [id, c] of MP.conns) if (id !== exceptId) send(c, msg);
  }

  // ------------------------------------------------------------------ estado de Ruben
  function packPlayer(g) {
    const p = g.player;
    const arm = p.armPose ? p.armPose() : { pose: 0, aim: 0 };
    return {
      x: r1(p.x), y: r1(p.y), vx: r1(p.vx), vy: r1(p.vy), f: p.facing,
      g: p.isGrounded ? 1 : 0, a: p.isAttacking ? 1 : 0, aa: r1(p.attackAim || 0),
      h: p.hp, mh: p.maxHp, d: (p.dead || g.deathTimer > 0) ? 1 : 0, iv: p.invulnerableTimer > 0 ? 1 : 0,
      ap: r1(arm.pose || 0), am: r1(arm.aim || 0)
    };
  }

  // Ruben de otro jugador: un Player normal que no se simula, solo se anima hacia la posición recibida
  function ensureGhost(pl) {
    if (pl.ghost || typeof Player === 'undefined') return pl.ghost;
    const st = pl.st || { x: 80, y: 410 };
    const gh = new Player(st.x, st.y);
    gh._mpSlot = pl.slot;
    gh._mpGhost = true;
    pl.ghost = gh;
    pl.snap = true;
    return gh;
  }

  function animateGhost(pl) {
    const gh = ensureGhost(pl);
    const st = pl.st;
    if (!gh || !st) return;
    gh._mpSlot = pl.slot;
    if (pl.snap || Math.hypot(st.x - gh.x, st.y - gh.y) > 180) {
      gh.x = st.x; gh.y = st.y; pl.snap = false;
    } else {
      gh.x += (st.x + st.vx - gh.x) * 0.35;
      gh.y += (st.y + st.vy - gh.y) * 0.35;
    }
    gh.vx = st.vx; gh.vy = st.vy;
    gh.facing = st.f || 1;
    gh.isGrounded = !!st.g;
    gh.attackAim = st.aa || 0;
    gh.maxHp = st.mh || gh.maxHp;
    if (st.h < gh.hp) gh.anim.hurtFlash = 7;
    gh.hp = st.h;
    // Tajo: al empezar, mismo resorte que en player.attack
    if (st.a && !pl.wasAttacking) {
      gh.anim.swingDir *= -1; gh.anim.lunge = 1; gh.anim.sx = 1.12; gh.anim.vsx = 0;
      gh.attackTimer = gh.attackDuration;
    }
    pl.wasAttacking = !!st.a;
    if (gh.attackTimer > 0) gh.attackTimer--;
    gh.isAttacking = gh.attackTimer > 0;
    // Parpadeo de invulnerabilidad
    if (st.iv) gh.invulnerableTimer = gh.invulnerableTimer > 1 ? gh.invulnerableTimer - 1 : 40;
    else gh.invulnerableTimer = 0;
    // Brazo extendido (viento / agua)
    if (gh.setArmPose) gh.setArmPose('net', st.ap || 0, st.am || 0);
    // Derrota y vuelta
    if (st.d && !gh.dead) { gh.dead = true; if (gh.startDeath) gh.startDeath(); }
    else if (!st.d && gh.dead) { gh.dead = false; gh.anim.deathY = 0; gh.anim.deathVy = 0; gh.anim.deathRot = 0; pl.snap = true; }
    if (gh.dead) { if (gh.updateDeath) gh.updateDeath(); return; }
    gh.stepWalkCycle();
    const moveDir = Math.abs(gh.vx) > 0.4 ? Math.sign(gh.vx) : 0;
    try { gh.updateAnimation(moveDir); } catch (e) { /* */ }
    try { gh.updateCapePhysics(); } catch (e) { /* */ }
  }

  // Blanco para los enemigos del anfitrión (no recibe daño allá: cada invitado se lo calcula)
  function targetFor(pl) {
    if (!pl.target) {
      const gh = ensureGhost(pl);
      pl.target = {
        get x() { return gh.x; }, get y() { return gh.y; },
        width: gh.width, height: gh.height, takeDamage() {}
      };
    }
    return pl.target;
  }

  function playersInMyRoom() {
    const g = game();
    const out = [];
    if (!g) return out;
    const room = g.world.currentRoomIndex;
    for (const pl of MP.players.values()) {
      if (pl.id === MP.myId || !pl.st) continue;
      if (pl.room === room) out.push(pl);
    }
    return out;
  }

  // ------------------------------------------------------------------ estado del mundo
  function worldState(g) {
    const w = g.world;
    const rooms = {};
    if (!w || !w.rooms) return rooms;
    for (let i = 0; i < w.rooms.length; i++) {
      const r = w.rooms[i];
      if (!r) continue;
      const st = {};
      if (r.keyItem && r.keyItem.collected) st.k = 1;
      if (r.door && !r.door.isLocked) st.d = 1;
      const b = [];
      (r.breakables || []).forEach((x, j) => { if (x.broken) b.push(j); });
      if (b.length) st.b = b;
      if (st.k || st.d || st.b) rooms[i] = st;
    }
    return rooms;
  }

  // Une el estado recibido con el propio: llave, portón y muros solo avanzan (nunca se deshacen)
  function mergeWorld(g, rooms, who, quiet) {
    if (!rooms || !g.world || !g.world.rooms) return;
    const cur = g.world.currentRoomIndex;
    for (const k of Object.keys(rooms)) {
      const r = g.world.rooms[+k];
      const st = rooms[k];
      if (!r || !st) continue;
      const here = +k === cur;
      if (st.k && r.keyItem && !r.keyItem.collected) {
        r.keyItem.collected = true;
        g.player.keys++;
        g.updateHUD();
        if (!quiet) {
          g.showNotification(`¡${who || 'Un compañero'} encontró la llave de Angelo!`);
          if (window.soundManager && here) window.soundManager.playPickup();
        }
      }
      if (st.d && r.door && r.door.isLocked) {
        r.door.isLocked = false;
        if (here && !quiet) {
          r.door.openedAt = Date.now();
          if (window.soundManager) window.soundManager.playDoorUnlock();
          g.triggerScreenShake(8, 250);
          g.showNotification('¡El Portón Norte se abrió!');
        }
      }
      for (const j of st.b || []) {
        const b = r.breakables && r.breakables[j];
        if (!b || b.broken) continue;
        b.broken = true;
        if (here && !quiet) {
          if (window.soundManager && window.soundManager.playBreakWall) window.soundManager.playBreakWall();
          if (window.particleSystem) window.particleSystem.createDebrisFragments(b.x + b.w / 2, b.y + b.h / 2);
        }
      }
    }
  }

  function freshWorld(g) {
    g.world = new World();
    if (window.LevelsExpansion && window.LevelsExpansion.patchOriginalRooms) window.LevelsExpansion.patchOriginalRooms(g.world);
  }

  // ------------------------------------------------------------------ enemigos en el invitado
  // Envoltorio de un enemigo del anfitrión: se dibuja con su clase real, pero su posición y
  // su vida vienen de la red. Los golpes del invitado se mandan al anfitrión.
  class NetEnemy {
    constructor(id, real) {
      this.id = id;
      this.real = real;
      this.tx = real.x; this.ty = real.y;
      this.netAlive = true;
    }
    get x() { return this.real.x; } set x(v) { this.real.x = v; }
    get y() { return this.real.y; } set y(v) { this.real.y = v; }
    get width() { return this.real.width; }
    get height() { return this.real.height; }
    get alive() { return this.real.alive; } set alive(v) { this.real.alive = v; }
    get hp() { return this.real.hp; }
    get facing() { return this.real.facing; } set facing(v) { this.real.facing = v; }
    takeDamage(amount, knockback = 0) {
      const e = this.real;
      if (!e.alive || e.hitCooldown > 0) return;
      send(MP.hostConn, { t: 'hit', id: this.id, amt: amount, kb: knockback });
      // Efectos locales del golpe sin que muera acá (lo decide el anfitrión)
      e.hp = Math.max(e.hp, amount + 1);
      try { e.takeDamage(amount, knockback); } catch (err) { /* */ }
    }
    apply(s) {
      // s = [id, clase, x, y, mira, vivo, vida]
      this.tx = s[2]; this.ty = s[3];
      const e = this.real;
      if (e.lookX !== undefined) e.lookX = s[4]; else e.facing = s[4];
      e.hp = s[6];
      if (!s[5] && e.alive) {
        e.alive = false;
        e.dyingTimer = e.DYING_FRAMES || 26;
        if (window.particleSystem) window.particleSystem.createDust(e.x + e.width / 2, e.y + e.height / 2, 10, '#e8c882');
      }
      this.netAlive = !!s[5];
    }
    update(world) {
      const e = this.real;
      const dying = !e.alive;
      try { e.update(world, FAR); } catch (err) { /* */ }
      if (!dying || e.dyingTimer > 0) {
        if (Math.hypot(this.tx - e.x, this.ty - e.y) > 160) { e.x = this.tx; e.y = this.ty; }
        else if (!dying) { e.x += (this.tx - e.x) * 0.35; e.y += (this.ty - e.y) * 0.35; }
      }
    }
    render(ctx, cam) { this.real.render(ctx, cam); }
  }

  function applyEnemySnapshot(g, list) {
    const seen = new Set();
    const out = [];
    for (const s of list) {
      const id = s[0];
      seen.add(id);
      let ne = MP.netEnemies.get(id);
      if (!ne) {
        const Cls = resolveClass(s[1]);
        if (!Cls) continue;
        let real;
        try { real = new Cls(s[2], s[3]); } catch (e) { continue; }
        ne = new NetEnemy(id, real);
        MP.netEnemies.set(id, ne);
        if (!s[5]) { real.alive = false; real.dyingTimer = 0; }
      }
      ne.apply(s);
      out.push(ne);
    }
    for (const id of Array.from(MP.netEnemies.keys())) if (!seen.has(id)) MP.netEnemies.delete(id);
    // Mismo arreglo (otros módulos guardan referencias a g.enemies)
    g.enemies.length = 0;
    for (const ne of out) g.enemies.push(ne);
  }

  // ------------------------------------------------------------------ anfitrión
  function hostSnapshot(g) {
    const enemies = [];
    for (const e of g.enemies) {
      if (!e || e.x === undefined) continue;
      if (!e._mpId) e._mpId = MP.nextEnemyId++;
      if (!e.alive && !(e.dyingTimer > 0)) continue;
      enemies.push([e._mpId, e.constructor && e.constructor.name, r1(e.x), r1(e.y),
        e.lookX !== undefined ? e.lookX : (e.facing || 1), e.alive ? 1 : 0, Math.round(e.hp || 0)]);
    }
    const players = [];
    for (const pl of MP.players.values()) {
      if (pl.st) players.push([pl.id, pl.name, pl.slot, pl.room, pl.st]);
    }
    return { t: 's', r: g.world.currentRoomIndex, e: enemies, p: players };
  }

  function freeSlot() {
    const used = new Set(Array.from(MP.players.values(), (p) => p.slot));
    for (let i = 1; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
    return -1;
  }

  function hostOnConnection(conn) {
    conn.on('data', (msg) => hostOnData(conn, msg));
    conn.on('close', () => hostDrop(conn));
    conn.on('error', () => hostDrop(conn));
  }

  function hostDrop(conn) {
    if (!MP.conns.has(conn.peer)) return;
    MP.conns.delete(conn.peer);
    const pl = MP.players.get(conn.peer);
    MP.players.delete(conn.peer);
    broadcast({ t: 'bye', id: conn.peer });
    if (pl && game()) game().showNotification(`${pl.name} salió de la sala`);
    refreshUI();
  }

  function hostOnData(conn, msg) {
    const g = game();
    if (!g || !msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      const slot = freeSlot();
      if (slot < 0 || MP.conns.size >= MAX_PLAYERS - 1) {
        send(conn, { t: 'full' });
        setTimeout(() => { try { conn.close(); } catch (e) { /* */ } }, 300);
        return;
      }
      const name = cleanName(msg.name);
      MP.conns.set(conn.peer, conn);
      MP.players.set(conn.peer, { id: conn.peer, name, slot, room: g.world.currentRoomIndex, st: null });
      const p = g.player;
      send(conn, {
        t: 'welcome', id: conn.peer, slot, code: MP.code,
        room: g.world.currentRoomIndex, x: r1(p.x), y: r1(p.y), keys: p.keys | 0,
        w: worldState(g)
      });
      g.showNotification(`${name} se unió a la sala`);
      if (window.soundManager && window.soundManager.playUnlockAbility) window.soundManager.playUnlockAbility();
      refreshUI();
      return;
    }
    const pl = MP.players.get(conn.peer);
    if (!pl) return;
    if (msg.t === 'p') {
      pl.st = msg.s;
      pl.room = msg.r;
    } else if (msg.t === 'hit') {
      const e = g.enemies.find((x) => x && x._mpId === msg.id);
      if (e && e.alive && e.takeDamage) e.takeDamage(+msg.amt || 0, +msg.kb || 0);
    } else if (msg.t === 'w') {
      mergeWorld(g, msg.w, pl.name, false);
    } else if (msg.t === 'exit') {
      // Un invitado cruzó una salida: el grupo entero va a esa sala
      const i = msg.i | 0;
      if (g.world.rooms[i] && i !== g.world.currentRoomIndex) {
        if (g.player.carriedItem) { g.player.carriedItem.isCarried = false; g.player.carriedItem = null; }
        g.loadRoom(i, +msg.x, +msg.y);
        g.showNotification(`${pl.name} guió al grupo a otra zona`);
      }
    }
  }

  // ------------------------------------------------------------------ invitado
  function guestOnData(msg) {
    const g = game();
    if (!g || !msg || typeof msg !== 'object') return;
    if (msg.t === 'welcome') {
      MP.mode = 'guest';
      startBgTicker();
      MP.myId = msg.id;
      MP.mySlot = msg.slot;
      MP.code = msg.code;
      g.player._mpSlot = msg.slot;
      // El mundo pasa a ser el del anfitrión
      freshWorld(g);
      mergeWorld(g, msg.w, '', true);
      const p = g.player;
      if (p.carriedItem) { p.carriedItem.isCarried = false; p.carriedItem = null; }
      p.keys = msg.keys | 0;
      p.dead = false; p.hp = p.maxHp; p.vx = 0; p.vy = 0; p.invulnerableTimer = 90;
      g.deathTimer = 0; g.hitStopFrames = 0;
      MP.applyingRoom = true;
      g.loadRoom(msg.room, +msg.x + MP.mySlot * 12, +msg.y);
      MP.applyingRoom = false;
      startPlaying(g);
      g.showNotification('Te uniste a la aventura · seguí a tus compañeros');
      if (MP.ui) closeModal();
      refreshUI();
      return;
    }
    if (msg.t === 'full') { setStatus('La sala está llena (máximo 4 jugadores)', true); leave(true); return; }
    if (msg.t === 's') {
      for (const row of msg.p) {
        const [id, name, slot, room, st] = row;
        if (id === MP.myId) continue;
        let pl = MP.players.get(id);
        if (!pl) { pl = { id, name, slot, room, st }; MP.players.set(id, pl); pl.snap = true; refreshUI(); }
        if (pl.room !== room) pl.snap = true;
        pl.name = name; pl.slot = slot; pl.room = room; pl.st = st;
      }
      if (msg.r === g.world.currentRoomIndex) {
        if (!MP.applyingRoom) applyEnemySnapshot(g, msg.e);
      } else if (Date.now() - MP.lastExitSentAt > 1500) {
        // Quedó en otra sala (mensaje perdido o carrera): volver con el grupo
        const host = MP.players.get('host');
        const hs = host && host.st;
        followRoom(g, msg.r, hs ? hs.x : null, hs ? hs.y : null);
      }
      return;
    }
    if (msg.t === 'room') { followRoom(g, msg.i, msg.x, msg.y); return; }
    if (msg.t === 'w') { mergeWorld(g, msg.w, msg.who, false); return; }
    if (msg.t === 'reset') {
      freshWorld(g);
      mergeWorld(g, msg.w, '', true);
      g.player.keys = msg.keys | 0;
      g.visitedRooms = new Set();
      MP.applyingRoom = true;
      g.loadRoom(msg.i, +msg.x + MP.mySlot * 12, +msg.y);
      MP.applyingRoom = false;
      g.showNotification('El anfitrión empezó una partida nueva');
      return;
    }
    if (msg.t === 'bye') {
      const pl = MP.players.get(msg.id);
      MP.players.delete(msg.id);
      if (pl) g.showNotification(`${pl.name} salió de la sala`);
      refreshUI();
    }
  }

  function followRoom(g, i, x, y) {
    if (!g.world.rooms[i]) return;
    if (i === g.world.currentRoomIndex) return;
    const p = g.player;
    if (p.carriedItem) { p.carriedItem.isCarried = false; p.carriedItem = null; }
    if (g.deathTimer > 0) { g.deathTimer = 0; p.dead = false; p.hp = p.maxHp; }
    MP.applyingRoom = true;
    const sx = x === null || x === undefined ? null : +x + MP.mySlot * 12;
    const sy = y === null || y === undefined ? null : +y;
    g.loadRoom(i, sx, sy === null ? null : sy);
    MP.applyingRoom = false;
  }

  function startPlaying(g) {
    if (window.soundManager && window.soundManager.init) window.soundManager.init();
    if (g.isPaused) g.togglePause(false);
    if (g.overlayScreen) g.overlayScreen.classList.add('hidden');
    if (!g.isPlaying) { g.isPlaying = true; g.irisOpen = 1; }
  }

  // ------------------------------------------------------------------ crear / unirse / salir
  function createPeer(id) {
    // Opciones por defecto de PeerJS: servidor de presentación público + STUN/TURN propios
    return id ? new window.Peer(id, { debug: 0 }) : new window.Peer({ debug: 0 });
  }

  async function host() {
    if (MP.mode !== 'off') return;
    MP.mode = 'connecting';
    setStatus('Preparando la sala...');
    refreshUI();
    try { await loadPeerJS(); } catch (e) { MP.mode = 'off'; setStatus(e.message, true); refreshUI(); return; }
    const tryOpen = (attempt) => {
      const code = makeCode();
      const peer = createPeer(PREFIX + code);
      MP.peer = peer;
      peer.on('open', () => {
        MP.mode = 'host';
        MP.code = code;
        MP.myId = 'host';
        MP.mySlot = 0;
        const g = game();
        if (g) g.player._mpSlot = 0;
        MP.players.set('host', { id: 'host', name: myName(), slot: 0, room: g ? g.world.currentRoomIndex : 0, st: null });
        MP.lastWorldRef = g ? g.world : null;
        startBgTicker();
        setStatus('Pasales este código a tus amigos');
        refreshUI();
      });
      peer.on('connection', hostOnConnection);
      peer.on('disconnected', () => { if (MP.mode === 'host' && !peer.destroyed) { try { peer.reconnect(); } catch (e) { /* */ } } });
      peer.on('error', (err) => {
        if (err && err.type === 'unavailable-id' && attempt < 4) { try { peer.destroy(); } catch (e) { /* */ } tryOpen(attempt + 1); return; }
        if (MP.mode === 'connecting') { MP.mode = 'off'; try { peer.destroy(); } catch (e) { /* */ } MP.peer = null; }
        setStatus(errorText(err), true);
        refreshUI();
      });
    };
    tryOpen(0);
  }

  async function join(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { setStatus('Escribí el código que te pasó el anfitrión', true); return; }
    if (MP.mode !== 'off') return;
    MP.mode = 'connecting';
    setStatus('Buscando la sala ' + code + '...');
    refreshUI();
    try { await loadPeerJS(); } catch (e) { MP.mode = 'off'; setStatus(e.message, true); refreshUI(); return; }
    const peer = createPeer(null);
    MP.peer = peer;
    let opened = false;
    const timeout = setTimeout(() => {
      if (!opened && MP.peer === peer) { setStatus('No se pudo conectar con la sala ' + code, true); leave(true); }
    }, 15000);
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { serialization: 'json', reliable: true });
      MP.hostConn = conn;
      conn.on('open', () => {
        opened = true;
        clearTimeout(timeout);
        setStatus('Conectado, entrando...');
        send(conn, { t: 'hello', name: myName(), v: 1 });
      });
      conn.on('data', guestOnData);
      conn.on('close', () => { if (MP.hostConn === conn) hostLost(); });
      conn.on('error', () => { if (MP.hostConn === conn) hostLost(); });
    });
    peer.on('error', (err) => {
      clearTimeout(timeout);
      setStatus(errorText(err), true);
      if (MP.mode !== 'guest') leave(true);
    });
  }

  // ------------------------------------------------------------------ ventana oculta
  // El navegador congela requestAnimationFrame cuando la ventana está minimizada o en otra
  // pestaña: el anfitrión dejaría a todos congelados. Un Worker (sus temporizadores no se
  // frenan) da el pulso y se simula sin dibujar mientras la ventana esté oculta.
  let bgWorker = null;
  let bgLast = 0;
  let bgAcc = 0;
  function startBgTicker() {
    if (bgWorker || typeof Worker === 'undefined') return;
    try {
      const url = URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},16)'], { type: 'text/javascript' }));
      bgWorker = new Worker(url);
      bgWorker.onmessage = bgTick;
    } catch (e) { bgWorker = null; }
  }
  function stopBgTicker() {
    if (bgWorker) { try { bgWorker.terminate(); } catch (e) { /* */ } }
    bgWorker = null;
    bgLast = 0;
  }
  function bgTick() {
    const g = game();
    if (!g || !document.hidden || (MP.mode !== 'host' && MP.mode !== 'guest')) { bgLast = 0; bgAcc = 0; return; }
    const now = performance.now();
    if (!bgLast) { bgLast = now; return; }
    bgAcc += Math.min(250, now - bgLast);
    bgLast = now;
    while (bgAcc >= g.STEP) {
      bgAcc -= g.STEP;
      try { g.update(g.STEP); } catch (e) { console.error('[Multijugador] cuadro en segundo plano:', e); }
    }
  }

  function hostLost() {
    const g = game();
    const wasGuest = MP.mode === 'guest';
    leave(true);
    if (wasGuest && g) {
      // El mundo era del anfitrión: volver al menú para seguir la partida propia
      g.isPlaying = false;
      if (g.isPaused) g.togglePause(false);
      g.overlayScreen.classList.remove('hidden');
      g.showNotification('Se cerró la sala del anfitrión');
    }
  }

  function leave(silent) {
    const wasGuest = MP.mode === 'guest';
    const p = MP.peer;
    MP.mode = 'off';
    MP.peer = null;
    stopBgTicker();
    for (const c of MP.conns.values()) { try { c.close(); } catch (e) { /* */ } }
    MP.conns.clear();
    if (MP.hostConn) { try { MP.hostConn.close(); } catch (e) { /* */ } }
    MP.hostConn = null;
    MP.players.clear();
    MP.netEnemies.clear();
    MP.code = '';
    MP.myId = 'host';
    MP.mySlot = 0;
    const g = game();
    if (g) {
      g.player._mpSlot = 0;
      // Invitado que sale: los enemigos vuelven a ser los de su computadora
      if (wasGuest) g.loadRoom(g.world.currentRoomIndex, g.player.x, g.player.y);
    }
    if (p) { try { p.destroy(); } catch (e) { /* */ } }
    if (!silent) setStatus('');
    refreshUI();
  }

  function errorText(err) {
    const t = err && err.type;
    if (t === 'peer-unavailable') return 'No existe una sala con ese código (¿está abierta?)';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'No se pudo llegar al servidor de presentación. Revisá tu conexión.';
    if (t === 'browser-incompatible') return 'Este navegador no soporta WebRTC';
    if (t === 'webrtc') return 'La conexión directa falló (red muy restringida)';
    return 'Error de conexión' + (t ? ' (' + t + ')' : '');
  }

  // ------------------------------------------------------------------ interfaz
  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function buildUI(g) {
    const hudRoot = document.getElementById('hud-overlay') || document.body;
    const modal = el('div', { id: 'mp-modal', class: 'modal-overlay hidden' });
    modal.innerHTML = `
      <div class="modal-card mp-card">
        <div>
          <h2 class="modal-title">MULTIJUGADOR</h2>
          <p class="modal-subtitle">HASTA 4 VIAJEROS · COOPERATIVO</p>
        </div>
        <label class="mp-field">TU NOMBRE
          <input id="mp-name" class="mp-input" maxlength="14" autocomplete="off" spellcheck="false">
        </label>
        <div id="mp-lobby">
          <div class="mp-row"><button id="mp-host" class="btn-start">CREAR SALA</button></div>
          <p class="mp-or">— O UNITE CON UN CÓDIGO —</p>
          <div class="mp-row">
            <input id="mp-code-in" class="mp-input mp-code-input" maxlength="5" placeholder="CÓDIGO" autocomplete="off" spellcheck="false">
            <button id="mp-join" class="btn-secondary">UNIRSE</button>
          </div>
        </div>
        <div id="mp-room" class="mp-hidden">
          <div id="mp-code" class="mp-code"></div>
          <ul id="mp-players" class="mp-players"></ul>
        </div>
        <div id="mp-status" class="mp-status"></div>
        <p id="mp-hint" class="mp-hint">El que crea la sala es el anfitrión: su partida es la que juegan todos.
          Si el anfitrión cierra el juego, la sala se cierra para todos.</p>
        <div class="mp-row">
          <button id="mp-leave" class="btn-secondary btn-danger-subtle mp-hidden">SALIR DE LA SALA</button>
          <button id="mp-close" class="btn-secondary">VOLVER</button>
        </div>
      </div>`;
    hudRoot.appendChild(modal);

    const badge = el('div', { id: 'mp-badge', class: 'mp-badge mp-hidden' });
    (document.getElementById('game-container') || document.body).appendChild(badge);

    const $ = (id) => modal.querySelector('#' + id);
    const ui = MP.ui = {
      modal, badge,
      name: $('mp-name'), codeIn: $('mp-code-in'), lobby: $('mp-lobby'), room: $('mp-room'),
      code: $('mp-code'), list: $('mp-players'), status: $('mp-status'),
      leave: $('mp-leave'), close: $('mp-close'), hostBtn: $('mp-host'), joinBtn: $('mp-join')
    };
    ui.name.value = myName();

    // Escribir en los campos no mueve a Ruben ni dispara atajos del juego
    modal.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') { e.stopPropagation(); closeModal(); return; }
      if (e.target && e.target.tagName === 'INPUT') {
        e.stopPropagation();
        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
          if (e.target === ui.codeIn) ui.joinBtn.click();
          else e.target.blur();
        }
      }
    });
    modal.addEventListener('keyup', (e) => { if (e.target && e.target.tagName === 'INPUT') e.stopPropagation(); });
    ui.name.addEventListener('change', () => {
      const n = cleanName(ui.name.value);
      ui.name.value = n;
      saveName(n);
      const me = MP.players.get(MP.myId);
      if (me) me.name = n;
    });
    ui.hostBtn.addEventListener('click', () => { saveName(cleanName(ui.name.value)); host(); });
    ui.joinBtn.addEventListener('click', () => { saveName(cleanName(ui.name.value)); join(ui.codeIn.value); });
    ui.leave.addEventListener('click', () => {
      const wasGuest = MP.mode === 'guest';
      leave();
      if (wasGuest) hostLostToMenu();
    });
    ui.close.addEventListener('click', closeModal);
    ui.code.addEventListener('click', () => {
      try { navigator.clipboard.writeText(MP.code); setStatus('Código copiado'); } catch (e) { /* */ }
    });

    // Botones MULTIJUGADOR en la pantalla de inicio y en la pausa
    const menu = document.querySelector('#overlay-screen .menu-actions');
    if (menu) {
      const b = el('button', { id: 'btn-multiplayer', class: 'btn-secondary' }, 'MULTIJUGADOR');
      const opts = document.getElementById('btn-open-controls-menu');
      menu.insertBefore(b, opts || null);
      b.addEventListener('click', () => openModal());
    }
    const pause = document.querySelector('#pause-modal .pause-actions');
    if (pause) {
      const b = el('button', { id: 'btn-pause-multiplayer', class: 'btn-secondary' },
        (window.UIIcons ? UIIcons.svg('gamepad', 'ui-icon') : '') + 'MULTIJUGADOR');
      const ctrl = document.getElementById('btn-pause-controls');
      pause.insertBefore(b, ctrl ? ctrl.nextSibling : null);
      b.addEventListener('click', () => openModal(true));
    }
  }

  function hostLostToMenu() {
    const g = game();
    if (!g) return;
    g.isPlaying = false;
    if (g.isPaused) g.togglePause(false);
    g.overlayScreen.classList.remove('hidden');
  }

  function openModal(fromPause) {
    if (!MP.ui) return;
    if (window.soundManager && window.soundManager.init) window.soundManager.init();
    MP.ui.fromPause = !!fromPause;
    if (fromPause) document.getElementById('pause-modal').classList.add('hidden');
    MP.ui.modal.classList.remove('hidden');
    refreshUI();
  }

  function closeModal() {
    if (!MP.ui) return;
    MP.ui.modal.classList.add('hidden');
    const g = game();
    if (MP.ui.fromPause && g && g.isPaused) document.getElementById('pause-modal').classList.remove('hidden');
    MP.ui.fromPause = false;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function setStatus(text, isError) {
    if (!MP.ui) return;
    MP.ui.status.textContent = text || '';
    MP.ui.status.classList.toggle('mp-error', !!isError);
  }

  function sortedPlayers() {
    return Array.from(MP.players.values()).sort((a, b) => a.slot - b.slot);
  }

  function refreshUI() {
    const ui = MP.ui;
    if (!ui) return;
    const inRoom = MP.mode === 'host' || MP.mode === 'guest';
    ui.lobby.classList.toggle('mp-hidden', inRoom);
    ui.room.classList.toggle('mp-hidden', !inRoom);
    ui.leave.classList.toggle('mp-hidden', !inRoom && MP.mode !== 'connecting');
    ui.hostBtn.disabled = ui.joinBtn.disabled = MP.mode === 'connecting';
    ui.name.disabled = inRoom;
    ui.code.textContent = MP.code;
    ui.code.title = 'Clic para copiar';
    // Lista de jugadores (yo incluido)
    ui.list.innerHTML = '';
    const rows = sortedPlayers();
    if (MP.mode === 'guest' && !MP.players.has(MP.myId)) rows.push({ id: MP.myId, name: myName(), slot: MP.mySlot });
    rows.sort((a, b) => a.slot - b.slot);
    for (const pl of rows) {
      const li = el('li');
      const dot = el('span', { class: 'mp-dot' });
      dot.style.background = SLOT_COLOR[pl.slot] || '#ccc';
      li.appendChild(dot);
      li.appendChild(document.createTextNode(pl.name));
      const tag = el('span', { class: 'mp-tag' }, (pl.slot === 0 ? 'ANFITRIÓN' : '') + (pl.id === MP.myId ? (pl.slot === 0 ? ' · VOS' : 'VOS') : ''));
      li.appendChild(tag);
      ui.list.appendChild(li);
    }
    // Insignia en partida
    if (inRoom) {
      const n = Math.max(rows.length, 1);
      ui.badge.innerHTML = '';
      for (const pl of rows) {
        const d = el('span', { class: 'mp-dot', title: pl.name });
        d.style.background = SLOT_COLOR[pl.slot] || '#ccc';
        ui.badge.appendChild(d);
      }
      ui.badge.appendChild(document.createTextNode(`SALA ${MP.code} · ${n}/${MAX_PLAYERS}`));
    }
    ui.badge.classList.toggle('mp-hidden', !inRoom);
  }

  // ------------------------------------------------------------------ dibujo
  function drawNameTag(ctx, cam, gh, name, slot) {
    const x = gh.x + gh.width / 2 - cam.x;
    const y = gh.y - cam.y - 18;
    ctx.save();
    ctx.font = '600 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(name).width + 16;
    ctx.fillStyle = 'rgba(48, 30, 18, 0.78)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - 8, w, 16, 8); else ctx.rect(x - w / 2, y - 8, w, 16);
    ctx.fill();
    ctx.fillStyle = SLOT_COLOR[slot] || '#fff';
    ctx.beginPath();
    ctx.arc(x - w / 2 + 7, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f9efd8';
    ctx.fillText(name, x + 3, y + 0.5);
    ctx.restore();
  }

  function registerColorLayer() {
    const AR = window.AnimationRegistry || window.AnimSystem;
    if (!AR || !AR.registerLayer) return false;
    AR.registerLayer('player', 'mp-player-color', {
      order: -1000,
      // Túnica y bufanda del color de cada jugador (player.js lee entity.palette)
      before(entity) {
        const slot = entity._mpSlot | 0;
        entity.palette = (MP.mode === 'host' || MP.mode === 'guest') && slot > 0 ? SLOT_PALETTE[slot] : null;
      }
    });
    return true;
  }

  // ------------------------------------------------------------------ hooks
  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((g) => {
    const H = window.GameHooks;
    try { buildUI(g); } catch (e) { console.error('[Multijugador] interfaz:', e); }
    if (!registerColorLayer()) setTimeout(registerColorLayer, 0);

    // Fantasmas: animar a los demás jugadores (también en pausa, para que no se congelen)
    H.onBeforeUpdate.push((game) => {
      if (MP.mode !== 'host' && MP.mode !== 'guest') return;
      for (const pl of playersInMyRoom()) animateGhost(pl);
    });

    // Enemigos del anfitrión: persiguen al jugador vivo más cercano de la sala
    H.onEnemyTarget.push((game, enemy) => {
      if (MP.mode !== 'host') return null;
      const others = playersInMyRoom();
      if (!others.length) return null;
      const ex = enemy.x + (enemy.width || 0) / 2, ey = enemy.y + (enemy.height || 0) / 2;
      const p = game.player;
      let best = null;
      let bestD = (p.dead || game.deathTimer > 0) ? Infinity : Math.hypot(p.x + p.width / 2 - ex, p.y + p.height / 2 - ey);
      for (const pl of others) {
        if (!pl.st || pl.st.d || !pl.ghost) continue;
        const gh = pl.ghost;
        const d = Math.hypot(gh.x + gh.width / 2 - ex, gh.y + gh.height / 2 - ey);
        if (d < bestD) { bestD = d; best = pl; }
      }
      enemy._mpTgt = best ? best.id : null;
      return best ? targetFor(best) : null;
    });

    H.onAfterUpdate.push((game, running) => {
      if (MP.mode !== 'host' && MP.mode !== 'guest') return;
      MP.frame++;
      const room = game.world.currentRoomIndex;
      const p = game.player;

      // Contacto con enemigos que no tenían a este jugador como blanco
      if (running && !p.dead && game.deathTimer <= 0) {
        for (const e of game.enemies) {
          if (!e || !e.alive) continue;
          if (MP.mode === 'host' && !e._mpTgt) continue; // ya lo resolvió enemy.update
          if (overlap(e, p)) {
            const kd = Math.sign((p.x + p.width / 2) - (e.x + e.width / 2)) || 1;
            p.takeDamage(1, kd * 6);
          }
        }
      }

      if (MP.mode === 'host') {
        const me = MP.players.get('host');
        if (me) { me.st = packPlayer(game); me.room = room; me.name = myName(); }
        // Partida nueva o CONTINUAR en el anfitrión: el mundo cambió entero
        if (MP.lastWorldRef && game.world !== MP.lastWorldRef) {
          MP.lastWorldRef = game.world;
          MP.lastWorldJson = JSON.stringify(worldState(game));
          broadcast({ t: 'reset', w: worldState(game), i: room, x: r1(p.x), y: r1(p.y), keys: p.keys | 0 });
        }
        MP.lastWorldRef = game.world;
        if (MP.conns.size && MP.frame % SEND_EVERY === 0) broadcast(hostSnapshot(game));
        if (MP.conns.size && MP.frame % WORLD_EVERY === 0) {
          const w = worldState(game);
          const json = JSON.stringify(w);
          if (json !== MP.lastWorldJson) { MP.lastWorldJson = json; broadcast({ t: 'w', w, who: myName() }); }
        }
      } else {
        if (MP.frame % SEND_EVERY === 0) send(MP.hostConn, { t: 'p', s: packPlayer(game), r: room });
        if (MP.frame % WORLD_EVERY === 0) {
          const w = worldState(game);
          const json = JSON.stringify(w);
          if (json !== MP.lastWorldJson) { MP.lastWorldJson = json; send(MP.hostConn, { t: 'w', w }); }
        }
      }
    });

    H.onRoomLoad.push((game, room, index, prevIndex, sx, sy) => {
      if (MP.mode === 'host') {
        for (const pl of MP.players.values()) pl.snap = true;
        if (index !== prevIndex) {
          const p = game.player;
          broadcast({ t: 'room', i: index, x: sx === null ? r1(p.x) : sx, y: sy === null ? r1(p.y) : sy });
        }
      } else if (MP.mode === 'guest') {
        // Los enemigos los manda el anfitrión
        game.enemies.length = 0;
        MP.netEnemies.clear();
        for (const pl of MP.players.values()) pl.snap = true;
        if (index !== prevIndex && !MP.applyingRoom) {
          MP.lastExitSentAt = Date.now();
          const p = game.player;
          send(MP.hostConn, { t: 'exit', i: index, x: sx === null ? r1(p.x) : sx, y: sy === null ? r1(p.y) : sy });
        }
      }
    });

    H.onRenderWorld.push((game, ctx, cam) => {
      if (MP.mode !== 'host' && MP.mode !== 'guest') return;
      for (const pl of playersInMyRoom()) {
        const gh = pl.ghost;
        if (!gh) continue;
        try { gh.render(ctx, cam); } catch (e) { /* */ }
        if (!gh.dead) drawNameTag(ctx, cam, gh, pl.name, pl.slot);
      }
    });
  });

  window.addEventListener('beforeunload', () => { if (MP.peer) { try { MP.peer.destroy(); } catch (e) { /* */ } } });

  window.Multiplayer = {
    isHost: () => MP.mode === 'host',
    isGuest: () => MP.mode === 'guest',
    isActive: () => MP.mode === 'host' || MP.mode === 'guest',
    open: () => openModal(),
    leave: () => leave(),
    _state: MP
  };
})();
