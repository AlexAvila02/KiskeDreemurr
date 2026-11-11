/**
 * Atajos de salas (depuración / playtest).
 *
 * Ñ + número  →  lleva a Ruben a la sala con ese número (id de la sala).
 *   - Se pueden escribir varios dígitos (Ñ, 1, 2 → sala 12). La sala se carga
 *     al dejar de teclear ~0,6 s, o al instante con Enter.
 *   - Escape (o cualquier otra tecla) cancela.
 *   - Ruben aparece en el punto de entrada de alguna salida que lleve a esa sala;
 *     si ninguna lleva ahí, cae cerca del borde izquierdo.
 *
 * Archivo independiente: escucha el teclado en fase de captura para que los
 * dígitos no lleguen al juego mientras el atajo está activo. No toca main.js.
 */
(function () {
  'use strict';

  const ARM_TIMEOUT = 1500;   // ms para escribir el primer dígito después de Ñ
  const COMMIT_DELAY = 600;   // ms sin teclas para confirmar el número

  let armed = false;
  let buffer = '';
  let timer = null;
  let hint = null;
  let hintHideTimer = null;

  function getGame() { return window.gameInstance || null; }

  function ensureHint() {
    if (hint) return hint;
    hint = document.createElement('div');
    hint.id = 'room-shortcut-hint';
    hint.style.cssText = [
      'position:fixed', 'top:14px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:9999', 'padding:6px 14px', 'border:3px solid #3a2416', 'border-radius:14px',
      'background:#f6e7c8', 'color:#3a2416', 'font:bold 16px Georgia, serif',
      'box-shadow:3px 3px 0 #3a2416', 'pointer-events:none', 'display:none'
    ].join(';');
    document.body.appendChild(hint);
    return hint;
  }

  function showHint(text, autoHideMs) {
    const el = ensureHint();
    el.textContent = text;
    el.style.display = 'block';
    clearTimeout(hintHideTimer);
    if (autoHideMs) hintHideTimer = setTimeout(() => { el.style.display = 'none'; }, autoHideMs);
  }

  function hideHint() {
    clearTimeout(hintHideTimer);
    if (hint) hint.style.display = 'none';
  }

  function disarm() {
    armed = false;
    buffer = '';
    clearTimeout(timer);
    timer = null;
    hideHint();
  }

  // Punto de aparición: la entrada de alguna salida que apunte a esta sala
  function findSpawn(world, index) {
    const rooms = world.rooms || [];
    for (let r = 0; r < rooms.length; r++) {
      const room = rooms[r];
      if (!room || !room.exits) continue;
      for (let i = 0; i < room.exits.length; i++) {
        const ex = room.exits[i];
        if (ex && ex.targetRoom === index && typeof ex.targetX === 'number' && typeof ex.targetY === 'number') {
          return { x: ex.targetX, y: ex.targetY };
        }
      }
    }
    return { x: 80, y: 100 };
  }

  function commit() {
    const game = getGame();
    const text = buffer;
    disarm();
    if (!game || !text) return;
    const index = parseInt(text, 10);
    const world = game.world;
    const room = world && world.rooms && world.rooms[index];
    if (!room) {
      showHint(`No existe la sala ${index}`, 1400);
      return;
    }
    const p = findSpawn(world, index);
    // Soltar la piedra para no arrastrarla a otra sala por atajo (igual que main.js/save-game.js)
    const pl = game.player;
    if (pl && pl.carriedItem) { pl.carriedItem.isCarried = false; pl.carriedItem = null; }
    game.loadRoom(index, p.x, p.y);
    showHint(`Sala ${index}: ${room.name || ''}`, 1400);
  }

  function canUse(game) {
    if (!game || !game.isPlaying || game.isPaused) return false;
    const cm = game.controlsManager;
    if (cm && ((cm.isListening && cm.isListening()) || (cm.isModalOpen && cm.isModalOpen()))) return false;
    return true;
  }

  function digitOf(e) {
    if (/^[0-9]$/.test(e.key)) return e.key;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code || '');
    return m ? m[1] : null;
  }

  function swallow(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  window.addEventListener('keydown', (e) => {
    const isEnye = typeof e.key === 'string' && e.key.toLowerCase() === 'ñ';

    if (!armed) {
      if (!isEnye || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const game = getGame();
      if (!canUse(game)) return;
      swallow(e);
      armed = true;
      buffer = '';
      showHint('Ir a sala: _');
      clearTimeout(timer);
      timer = setTimeout(disarm, ARM_TIMEOUT);
      return;
    }

    // Atajo activo
    const d = digitOf(e);
    if (d !== null) {
      swallow(e);
      if (e.repeat) return;
      buffer += d;
      showHint(`Ir a sala: ${buffer}`);
      clearTimeout(timer);
      timer = setTimeout(commit, COMMIT_DELAY);
      return;
    }
    if (e.key === 'Enter') { swallow(e); commit(); return; }
    if (e.key === 'Escape') { swallow(e); disarm(); return; }
    if (isEnye) { swallow(e); return; }
    if (e.key === 'Backspace') {
      swallow(e);
      buffer = buffer.slice(0, -1);
      showHint(`Ir a sala: ${buffer || '_'}`);
      clearTimeout(timer);
      timer = setTimeout(buffer ? commit : disarm, buffer ? COMMIT_DELAY : ARM_TIMEOUT);
      return;
    }
    // Cualquier otra tecla cancela el atajo y sigue su curso normal en el juego
    disarm();
  }, true);
})();
