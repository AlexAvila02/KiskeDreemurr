/**
 * Tarjeta de elemento aprendido - Ruben: En Busca de Angelo (Claude)
 *
 * Cuando Ruben aprende un elemento (o lo mejora), apenas se cierra el texto que lo enseñó
 * (la carta de Angelo, el maestro) aparece una tarjeta grande de papel: el emblema del
 * elemento dibujado y animado al estilo de los dibujos de los 50, un texto grande que
 * explica la habilidad y sus controles (teclado con las teclas reasignadas + mando).
 * El juego queda en pausa hasta cerrarla (Intro / Espacio / E / Esc, clic, o A / B / Start).
 * Después de la tarjeta se muestra el recuerdo de memories.js.
 *
 * Para sumar un elemento: una entrada en CARDS con `learned()`, textos y `draw(ctx, t)`.
 * Guardado: localStorage 'ruben_tarjetas_elemento_v1'. "Reiniciar juego" lo borra.
 *
 * API: window.ElementCard.isOpen() · .busy() · .show(id)
 * Hooks: onBeforeUpdate · onBeforeTogglePause · onRestartGame (ver MAPA.md).
 */
(function () {
  'use strict';

  const SAVE_KEY = 'ruben_tarjetas_elemento_v1';
  const INK = '#3a2416';
  const MIN_OPEN_MS = 700;   // evita cerrarla sin querer con la misma tecla que cerró la carta

  const keyOf = (id, fb) => {
    const cm = window.gameInstance && window.gameInstance.controlsManager;
    try { return cm && cm.getPrimaryDisplayKey ? cm.getPrimaryDisplayKey(id) : fb; } catch (e) { return fb; }
  };

  // ---------------- dibujos de los emblemas (canvas 260x260) ----------------
  function blob(ctx, x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
  }

  function drawWind(ctx, t) {
    const cx = 130, cy = 130;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Disco de fondo que "respira" (squash & stretch)
    const s = 1 + Math.sin(t * 2.2) * 0.035;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, 2 - s);
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    blob(ctx, 0, 0, 104, '#e3f2fb');
    ctx.restore();
    // Remolinos que giran
    for (let i = 0; i < 3; i++) {
      const a0 = t * 1.6 + i * (Math.PI * 2 / 3);
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const u = k / 40;
        const a = a0 + u * 4.2;
        const r = 18 + u * 66;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.82;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.stroke();
      ctx.strokeStyle = i === 0 ? '#ffffff' : (i === 1 ? '#bfe3f7' : '#d8eefa');
      ctx.lineWidth = 6; ctx.stroke();
    }
    // Hojitas arrastradas por el viento
    for (let i = 0; i < 4; i++) {
      const a = -t * 1.1 + i * 1.57;
      const r = 78 + Math.sin(t * 3 + i) * 8;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.82;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a * 2 + i);
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 5.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#8fbf5a' : '#d9a441'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
    // Ojito central (personalidad de dibujo animado)
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    blob(ctx, cx, cy, 15, '#ffffff');
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + 3, cy + 1, 6, 0, Math.PI * 2); ctx.fill();
  }

  function drop(ctx, x, y, h, fill) {
    // Gota: punta arriba, panza redonda abajo
    const r = h * 0.42;
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.55);
    ctx.bezierCurveTo(x + r * 0.35, y - h * 0.2, x + r, y + h * 0.02, x + r, y + h * 0.2);
    ctx.arc(x, y + h * 0.2, r, 0, Math.PI, false);
    ctx.bezierCurveTo(x - r, y + h * 0.02, x - r * 0.35, y - h * 0.2, x, y - h * 0.55);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
  }

  function drawWater(ctx, t, guided) {
    const cx = 130, cy = 130;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    blob(ctx, cx, cy, 104, guided ? '#e6f4ff' : '#dff3f6');
    // Olas abajo
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 101, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath();
    ctx.moveTo(20, 260);
    for (let x = 20; x <= 240; x += 4) ctx.lineTo(x, 196 + Math.sin(x * 0.06 + t * 3) * 7);
    ctx.lineTo(240, 260); ctx.closePath();
    ctx.fillStyle = '#5fb3d6'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 5;
    if (guided) {
      // Esfera guiada: orbe que dibuja un ocho con estela
      for (let k = 6; k >= 0; k--) {
        const tt = t * 1.4 - k * 0.09;
        const x = cx + Math.sin(tt) * 52, y = 112 + Math.sin(tt * 2) * 26;
        ctx.globalAlpha = k ? 0.12 + (6 - k) * 0.05 : 1;
        ctx.lineWidth = k ? 0 : 5;
        ctx.beginPath(); ctx.arc(x, y, k ? 26 - k * 2.5 : 30, 0, Math.PI * 2);
        ctx.fillStyle = '#7fd0f0'; ctx.fill(); if (!k) ctx.stroke();
        if (!k) {
          ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.ellipse(x - 10, y - 11, 8, 5, -0.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      return;
    }
    // Gota grande que rebota (squash & stretch)
    const b = Math.abs(Math.sin(t * 2.4));
    const sq = 1 - (1 - b) * 0.16;
    ctx.save(); ctx.translate(cx, 150 - b * 26); ctx.scale(2 - sq, sq);
    drop(ctx, 0, -20, 120, '#7fd0f0');
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(-16, -2, 9, 15, 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    // Gotitas que saltan a los lados
    for (let i = 0; i < 2; i++) {
      const ph = (t * 1.2 + i * 0.5) % 1;
      const x = cx + (i ? 1 : -1) * (40 + ph * 50);
      const y = 196 - Math.sin(ph * Math.PI) * 44;
      ctx.lineWidth = 3;
      drop(ctx, x, y, 22, '#a8e2f5');
    }
  }

  // ---------------- tarjetas ----------------
  const CARDS = [
    {
      id: 'wind',
      memory: 'wind',
      element: 'Elemento del Aire',
      title: '¡Ruben aprendió a mover el Viento!',
      desc: 'El aire obedece a Ruben. Puede JALARLO para atrapar insectos en el aire y arrastrarlos hacia su mano, o SOPLARLO para empujarlos lejos. Al soltarlos quedan mareados: ¡es el momento del tajo!',
      accent: '#5aa7d6',
      learned: () => !!(window.WindPull && window.WindPull.isUnlocked && window.WindPull.isUnlocked()),
      controls: () => {
        const f = keyOf('windPull', 'F'), dn = keyOf('aimDown', 'S'), up = keyOf('aimUp', 'W');
        return [
          ['Jalar el aire', `${dn} + ${f}`, 'Abajo + L2'],
          ['Soplar el aire', `${up} + ${f}`, 'Arriba + L2'],
          ['Apuntar la ráfaga', 'Ratón', 'Stick derecho']
        ];
      },
      note: 'Gasta energía elemental (la barra azul bajo los corazones).',
      draw: (ctx, t) => drawWind(ctx, t)
    },
    {
      id: 'water',
      memory: 'water',
      element: 'Elemento del Agua',
      title: '¡Ruben aprendió el Dominio del Agua!',
      desc: 'Cerca de una laguna o un charco, Ruben levanta el agua y forma una esfera en su mano que crece mientras la sostiene. Al soltarla sale disparada: empuja y aturde enemigos, rompe muros quebradizos y hace sonar campanas.',
      accent: '#3f9fc6',
      learned: () => !!(window.WaterControl && window.WaterControl.isLearned && window.WaterControl.isLearned()),
      controls: () => {
        const f = keyOf('windPull', 'F');
        return [
          ['Levantar y cargar el agua', `Mantener ${f}`, 'Mantener L2'],
          ['Apuntar', 'Ratón', 'Stick derecho'],
          ['Lanzar la esfera', `Soltar ${f}`, 'Soltar L2']
        ];
      },
      note: 'Manteniendo la tecla, Ruben camina y salta con el agua en la mano.',
      draw: (ctx, t) => drawWater(ctx, t, false)
    },
    {
      id: 'water-guide',
      element: 'Agua · Mejora',
      title: '¡Esfera guiada desbloqueada!',
      desc: 'Ruben domina el agua: ahora puede soltar una esfera que vuela por el aire sin caer y guiarla a donde quiera. Atraviesa enemigos dañándolos, rompe muros y alcanza campanas lejanas, ¡incluso la del techo!',
      accent: '#2f86b8',
      learned: () => !!(window.WaterControl && window.WaterControl.isUpgraded && window.WaterControl.isUpgraded()),
      controls: () => {
        const g = keyOf('waterGuide', 'G');
        return [
          ['Soltar la esfera (cerca del agua)', g, 'L3'],
          ['Guiarla por el aire', 'Flechas', 'Stick izquierdo'],
          ['Reventarla', `${g} otra vez`, 'L3 otra vez']
        ];
      },
      note: 'Mientras la guías, Ruben se queda quieto concentrado.',
      draw: (ctx, t) => drawWater(ctx, t, true)
    }
  ];

  // ---------------- estado y guardado ----------------
  let seen = {};
  try { seen = JSON.parse(window.localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { seen = {}; }
  const persist = () => { try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(seen)); } catch (e) { /* */ } };

  const st = { cur: null, openedAt: 0, raf: 0, wasPaused: false, booted: false, el: null, canvas: null };

  // Partidas viejas: lo que ya estaba aprendido antes de que existiera la tarjeta no la muestra
  function bootSeen() {
    if (st.booted) return;
    st.booted = true;
    const mem = window.Memories;
    let changed = false;
    for (const c of CARDS) {
      if (seen[c.id] || !c.learned()) continue;
      const old = c.memory ? (mem && mem.seen && mem.seen(c.memory)) : true;
      if (old) { seen[c.id] = true; changed = true; }
    }
    if (changed) persist();
  }

  // ---------------- DOM ----------------
  function injectCss() {
    if (document.getElementById('element-card-css')) return;
    const s = document.createElement('style');
    s.id = 'element-card-css';
    s.textContent = `
#element-card{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at center,rgba(40,24,12,.35),rgba(20,10,4,.78));opacity:0;transition:opacity .35s ease;pointer-events:auto}
#element-card.ec-on{opacity:1}
#element-card.hidden{display:none}
#element-card .ec-paper{position:relative;display:flex;gap:26px;align-items:center;width:min(880px,92%);max-height:92%;box-sizing:border-box;
  padding:24px 32px 34px;background:#f6e7c4;border:5px solid ${INK};border-radius:26px;
  box-shadow:0 0 0 6px #e2c48f, 0 0 0 11px ${INK}, 0 18px 40px rgba(0,0,0,.5);
  transform:scale(.6) rotate(-3deg);transition:transform .45s cubic-bezier(.2,1.6,.4,1)}
#element-card.ec-on .ec-paper{transform:scale(1) rotate(0)}
#element-card canvas{flex:0 0 auto;width:250px;height:250px}
#element-card .ec-body{flex:1 1 auto;min-width:0;color:${INK};font-family:'Outfit',sans-serif}
#element-card .ec-tag{display:inline-block;font-family:'Cinzel',serif;font-weight:800;font-size:15px;letter-spacing:3px;text-transform:uppercase;
  color:#fff8e6;background:var(--ec-accent);border:3px solid ${INK};border-radius:999px;padding:3px 14px}
#element-card h2{font-family:'Cinzel',serif;font-weight:800;font-size:31px;line-height:1.12;margin:10px 0 8px}
#element-card .ec-desc{font-size:19px;line-height:1.4;margin:0 0 12px}
#element-card table{border-collapse:separate;border-spacing:0 6px;width:100%;font-size:18px}
@media (max-width:760px){#element-card .ec-hint{bottom:4px}}
#element-card th{font-family:'Cinzel',serif;font-size:13px;letter-spacing:2px;text-align:left;color:#8c5a2b;padding:0 8px}
#element-card td{padding:5px 8px;background:#fbf1da;border-top:2px solid ${INK};border-bottom:2px solid ${INK}}
#element-card td:first-child{border-left:2px solid ${INK};border-radius:10px 0 0 10px;font-weight:600}
#element-card td:last-child{border-right:2px solid ${INK};border-radius:0 10px 10px 0}
#element-card kbd{display:inline-block;font-family:'Outfit',sans-serif;font-weight:600;font-size:17px;background:#fff;
  border:2px solid ${INK};border-bottom-width:4px;border-radius:7px;padding:0 7px;white-space:nowrap}
#element-card .ec-note{font-size:15px;font-style:italic;margin:8px 0 0;opacity:.85}
#element-card .ec-hint{position:absolute;right:26px;bottom:9px;color:#8c5a2b;font-family:'Cinzel',serif;font-weight:800;font-size:14px;
  letter-spacing:1px;animation:ecBlink 1.3s ease-in-out infinite}
@keyframes ecBlink{50%{opacity:.35}}
@media (max-width:760px){#element-card .ec-paper{flex-direction:column;gap:8px;padding:16px}#element-card canvas{width:150px;height:150px}
  #element-card h2{font-size:22px}#element-card .ec-desc{font-size:15px}#element-card table{font-size:14px}#element-card .ec-hint{bottom:-30px}}`;
    document.head.appendChild(s);
  }

  function build() {
    if (st.el) return;
    injectCss();
    const host = document.getElementById('game-container') || document.body;
    const el = document.createElement('div');
    el.id = 'element-card';
    el.className = 'hidden';
    el.setAttribute('role', 'dialog');
    el.innerHTML = '<div class="ec-paper"><canvas width="260" height="260" aria-hidden="true"></canvas><div class="ec-body">' +
      '<span class="ec-tag"></span><h2></h2><p class="ec-desc"></p>' +
      '<table><thead><tr><th>Acción</th><th>Teclado</th><th>Mando</th></tr></thead><tbody></tbody></table>' +
      '<p class="ec-note"></p></div><div class="ec-hint">Intro · A — continuar</div></div>';
    el.addEventListener('mousedown', (e) => { e.stopPropagation(); close(); });
    host.appendChild(el);
    st.el = el;
    st.canvas = el.querySelector('canvas');
    window.addEventListener('keydown', (e) => {
      if (!st.cur) return;
      if (['Enter', 'NumpadEnter', 'Space', 'KeyE', 'Escape'].includes(e.code)) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!e.repeat) close();
      }
    }, true);
  }

  function animate() {
    if (!st.cur) return;
    const ctx = st.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 260, 260);
    try { st.cur.draw(ctx, performance.now() / 1000); } catch (e) { /* */ }
    st.raf = requestAnimationFrame(animate);
  }

  function fanfare() {
    const sm = window.soundManager, sk = window.SoundKit;
    try { if (sm && sm.playUnlockAbility) sm.playUnlockAbility(); } catch (e) { /* */ }
    if (!sk || !sk.tone) return;
    try {
      sk.tone({ freq: 392, freqTo: 523, sweep: 0.2, gain: 0.06, release: 0.5, stopAt: 0.6 });
      sk.tone({ freq: 659, freqTo: 784, sweep: 0.3, gain: 0.05, release: 0.9, stopAt: 1.1 });
    } catch (e) { /* */ }
  }

  function open(g, c) {
    build();
    st.cur = c;
    seen[c.id] = true;
    persist();
    const el = st.el;
    el.style.setProperty('--ec-accent', c.accent);
    el.querySelector('.ec-tag').textContent = c.element;
    el.querySelector('h2').textContent = c.title;
    el.querySelector('.ec-desc').textContent = c.desc;
    el.querySelector('.ec-note').textContent = c.note || '';
    const tb = el.querySelector('tbody');
    tb.textContent = '';
    for (const [name, kb, pad] of c.controls()) {
      const tr = document.createElement('tr');
      const td0 = document.createElement('td'); td0.textContent = name;
      const td1 = document.createElement('td'); const k1 = document.createElement('kbd'); k1.textContent = kb; td1.appendChild(k1);
      const td2 = document.createElement('td'); const k2 = document.createElement('kbd'); k2.textContent = pad; td2.appendChild(k2);
      tr.append(td0, td1, td2);
      tb.appendChild(tr);
    }
    // Pausa sin el menú de pausa (igual que el Diario)
    st.wasPaused = false;
    g.isPaused = true;
    g.keys = {};
    const pause = document.getElementById('pause-modal');
    if (pause) pause.classList.add('hidden');
    el.classList.remove('hidden');
    void el.offsetWidth;
    el.classList.add('ec-on');
    st.openedAt = performance.now();
    fanfare();
    cancelAnimationFrame(st.raf);
    animate();
  }

  function close(force) {
    if (!st.cur) return;
    if (!force && performance.now() - st.openedAt < MIN_OPEN_MS) return;
    const g = window.gameInstance;
    st.cur = null;
    cancelAnimationFrame(st.raf);
    st.el.classList.remove('ec-on');
    setTimeout(() => { if (!st.cur) st.el.classList.add('hidden'); }, 360);
    if (g) {
      g.keys = {};
      g.isPaused = false;
      const pause = document.getElementById('pause-modal');
      if (pause) pause.classList.add('hidden');
    }
    try { if (window.soundManager && window.soundManager.playPickup) window.soundManager.playPickup(); } catch (e) { /* */ }
  }

  function pendingCard() {
    for (const c of CARDS) if (!seen[c.id] && c.learned()) return c;
    return null;
  }

  function step(g) {
    if (st.cur) return;
    bootSeen();
    if (g.activeNote || !g.player || g.player.dead || g.deathTimer > 0) return;
    // En el multijugador no se pausa la partida de todos: se avisa con la notificación de siempre
    if (window.Multiplayer && window.Multiplayer.isActive && window.Multiplayer.isActive()) return;
    const c = pendingCard();
    if (c) open(g, c);
  }

  window.ElementCard = {
    isOpen: () => !!st.cur,
    // ¿Hay una tarjeta abierta o por abrirse? (memories.js espera a que se cierre)
    busy: () => {
      if (st.cur) return true;
      if (window.Multiplayer && window.Multiplayer.isActive && window.Multiplayer.isActive()) return false;
      bootSeen();
      return !!pendingCard();
    },
    show: (id) => { const c = CARDS.find((k) => k.id === id); const g = window.gameInstance; if (c && g && g.isPlaying) open(g, c); },
    close: () => close(true)
  };

  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push(() => {
    try {
      const H = window.GameHooks;
      H.onBeforeUpdate.push((g, running) => {
        if (!running) return;
        try { step(g); } catch (e) { console.error('[Tarjeta de elemento]', e); }
      });
      // Esc / Start / B con la tarjeta abierta la cierran en vez de abrir el menú de pausa
      H.onBeforeTogglePause.push(() => { if (!st.cur) return false; close(); return true; });
      H.onRestartGame.push(() => {
        seen = {};
        try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ }
        if (st.cur) close(true);
      });
    } catch (e) { console.error('[Tarjeta de elemento] no se pudo iniciar:', e); }
  });
})();
