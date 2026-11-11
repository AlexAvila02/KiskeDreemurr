/**
 * Agua: campanas y escena de las macetas (sala 12) - Ruben: En Busca de Angelo (Claude)
 * (Parte 2 de 3 del agua: water-core.js → water-quest.js → water-power.js)
 *
 *  - CAMPANAS (`room.waterBells: [{ x, y, pitch, ceiling }]`): suenan al tocarlas con agua.
 *    Las 3 de la laguna → el maestro pide mejorar la habilidad; la del techo solo la
 *    alcanza la esfera guiada. Todas → empieza la escena de las macetas.
 *  - ESCENA DE LAS MACETAS (`room.potSpots`): el Maestro saca 3 macetas y las apoya; habla
 *    abajo (sin bloquear) mientras Ruben las riega con esferas: se llenan, brotan y florecen.
 *
 * API interna para water-power.js: window.WaterQuest = { ringBell, potCatch, fillPot }
 * Hooks: onBeforeUpdate · onAfterUpdate · onAction (el maestro ocupado) · onKeepDialog ·
 *   onBeforeRoomLoad · onRestartGame · onRenderWorld · capa world 'water-pots' (ver MAPA.md).
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const { ws, burst, playSplash, playBell } = window.WaterCore;

  function ringBell(g, room, b, vx) {
    b.swing = (vx >= 0 ? 1 : -1) * 0.9;
    b.ringT = 50;
    playBell(b.pitch || 660);
    if (b.lit) return;
    b.lit = true;
    const lake = room.waterBells.filter(x => !x.ceiling);
    if (!room.waterLakeBellsDone && lake.every(x => x.lit)) {
      room.waterLakeBellsDone = true;
      if (window.soundManager && window.soundManager.playUnlockAbility) window.soundManager.playUnlockAbility();
      if (g.showNotification) g.showNotification('¡Las tres campanas resonaron sobre la laguna! Habla con el maestro');
    }
    if (!room.waterBellsDone && room.waterBells.every(x => x.lit)) {
      room.waterBellsDone = true;
      startPotQuest(room);
      if (b.ceiling && window.soundManager && window.soundManager.playUnlockAbility) window.soundManager.playUnlockAbility();
      if (g.showNotification) g.showNotification('¡La campana del techo cantó! El maestro te espera');
    }
  }


  function drawBells(ctx, room, cam, t) {
    if (!room.waterBells) return;
    for (const b of room.waterBells) {
      if (b.swing === undefined) { b.swing = 0; b.ang = 0; b.vang = 0; b.ringT = 0; }
      const x = b.x - cam.x, y = b.y - cam.y;
      ctx.save();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, 20 - cam.y); ctx.lineTo(x, y - 6); ctx.stroke();
      ctx.translate(x, y - 6);
      ctx.rotate(b.ang);
      // Brillo azul cuando ya sonó
      if (b.lit) {
        const gl = ctx.createRadialGradient(0, 16, 2, 0, 16, 30);
        gl.addColorStop(0, `rgba(170, 230, 255, ${0.35 + (b.ringT / 50) * 0.4})`);
        gl.addColorStop(1, 'rgba(170, 230, 255, 0)');
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(0, 16, 30, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = b.lit ? '#9fdcef' : '#d9a634';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.quadraticCurveTo(-7, 6, -8, 16);
      ctx.quadraticCurveTo(-12, 22, -13, 25);
      ctx.lineTo(13, 25);
      ctx.quadraticCurveTo(12, 22, 8, 16);
      ctx.quadraticCurveTo(7, 6, 5, 4);
      ctx.quadraticCurveTo(0, 0, -5, 4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.arc(Math.sin(b.ang * 3) * 4, 26, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Ondas de sonido al tañer
      if (b.ringT > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(255, 246, 214, ${b.ringT / 50})`;
        ctx.lineWidth = 1.4;
        for (let k = 0; k < 2; k++) {
          const rr = 18 + (50 - b.ringT) * 0.9 + k * 10;
          ctx.beginPath(); ctx.arc(x, y + 12, rr, -0.9, 0.9); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y + 12, rr, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  function bellsStep(room) {
    if (!room.waterBells) return;
    for (const b of room.waterBells) {
      if (b.swing === undefined) { b.swing = 0; b.ang = 0; b.vang = 0; b.ringT = 0; }
      if (b.swing) { b.vang += b.swing * 0.12; b.swing = 0; }
      b.vang += -b.ang * 0.06; b.vang *= 0.95; b.ang += b.vang;
      if (b.ringT > 0) b.ringT--;
    }
  }

  // ---------------- escena de las macetas (sala con `potSpots`) ----------------
  // Al sonar la última campana, el Maestro saca 3 macetas y las apoya en el suelo, una
  // junto a la otra. Después habla (cuadro de diálogo ABAJO, sin bloquear el juego)
  // mientras Ruben lleva una esfera de agua a cada maceta: se llenan, brotan y florecen.
  const POT_LINES = [
    'El origen es el agua. Del océano nació la vida y ella fluyó hasta llegar a nosotros...',
    'Eso es lo que dicen nuestras mejores mentes... y yo creo en sus palabras.'
  ];
  const PLACE_T = 72;            // cuadros por maceta (sacarla, bajarla, enderezarse)
  const cs = { __cutscene: true, name: '' };   // marcador de g.activeNote durante la escena

  function startPotQuest(room) {
    if (!room.potSpots || room.potQuest) return;
    room.potQuest = {
      phase: 'intro', t: 0, idx: 0, line: 0, lineT: 0, doneT: 0,
      pots: room.potSpots.map(s => ({ x: s.x, y: s.y, color: s.color || '#e2705a', placed: false, filled: false, fill: 0, sprout: 0, bloom: 0, landT: 0 }))
    };
  }
  function questActive(room) { return !!(room && room.potQuest && room.potQuest.phase !== 'finished'); }
  function waterMaster(room) { return room && room.npcs ? room.npcs.find(n => n.teaches === 'water') : null; }
  // Mano del maestro en el mundo (misma geometría que drawWaterMaster: brazo que baja con
  // `bend` y cuerpo que gira f * 0.42 * bend alrededor de los pies)
  function masterHand(n) {
    const f = n.forceFace || n.facing || 1, b = n.bend || 0;
    const lx = f * 19, ly = -27 + b * 8 + 4;          // relativo al pivote (n.x, n.y - 4)
    const a = f * 0.42 * b, c = Math.cos(a), s = Math.sin(a);
    return { x: n.x + lx * c - ly * s, y: n.y - 4 + lx * s + ly * c };
  }

  // Cuadro de la escena: pegado al borde de abajo, ancho (casi todo el canvas) y bajito
  // (una o dos líneas), para no tapar las macetas ni a Ruben
  function bottomDialog(g, on) {
    const b = g.dialogBox;
    if (!b) return;
    const st2 = b.style;
    st2.top = on ? 'auto' : '';
    st2.bottom = on ? '8px' : '';
    st2.width = on ? '90%' : '';
    st2.maxWidth = on ? '880px' : '';
    st2.padding = on ? '6px 26px 6px' : '';
    st2.borderRadius = on ? '14px' : '';
    st2.transformOrigin = on ? '50% 100%' : '';
  }
  function showPotLine(g, q, n) {
    cs.name = n ? n.name : 'Maestro';
    g.activeNote = cs;
    g.showDialog(cs.name, POT_LINES[q.line], true);
    bottomDialog(g, true);
  }
  function endPotDialog(g) {
    if (g.activeNote === cs) { g.activeNote = null; g.hideDialog(); }
    bottomDialog(g, false);
  }
  function playThud() {
    window.SoundKit.tone({ freq: 150, freqTo: 55, sweep: 0.16, gain: 0.16, release: 0.2, stopAt: 0.22 });
  }


  function potQuestStep(g, room) {
    const q = room.potQuest;
    if (!q || q.phase === 'finished') return;
    const n = waterMaster(room);
    if (n) { n.forceFace = 1; n.busy = true; }
    q.t++;
    if (q.phase === 'intro') {
      if (q.t > 50) { q.phase = 'place'; q.t = 0; q.idx = 0; }
      return;
    }
    if (q.phase === 'place') {
      const k = q.t;
      // Se agacha, la saca de entre la túnica, la baja hasta el suelo y se endereza
      if (n) n.bend = k < 20 ? k / 20 : (k < 52 ? 1 : Math.max(0, 1 - (k - 52) / 18));
      if (k === 52) {
        const p = q.pots[q.idx];
        p.placed = true; p.landT = 14;
        playThud();
        if (window.particleSystem) window.particleSystem.createDust(p.x, p.y, 6);
      }
      if (k >= PLACE_T) {
        q.idx++; q.t = 0;
        if (q.idx >= q.pots.length) {
          q.phase = 'talk'; q.line = 0; q.lineT = 0;
          if (n) n.bend = 0;
          showPotLine(g, q, n);
        }
      }
      return;
    }
    // Hablando (y regando): si el texto se perdió (volvió a la sala), se muestra otra vez
    if (g.activeNote !== cs && q.phase !== 'finished') showPotLine(g, q, n);
    q.lineT++;
    if (q.line === 0 && q.lineT > 460) { q.line = 1; q.lineT = 0; showPotLine(g, q, n); }
    for (const p of q.pots) {
      if (p.landT > 0) p.landT--;
      if (p.filled) { p.fill = Math.min(1, p.fill + 0.05); p.sprout = Math.min(1, p.sprout + 0.02); }
      if (q.phase === 'bloom') p.bloom = Math.min(1, p.bloom + 0.025);
    }
    if (q.phase === 'talk' && q.pots.every(p => p.filled) && q.line === 1 && q.lineT > 150) {
      q.phase = 'bloom'; q.doneT = 0;
      if (window.soundManager && window.soundManager.playUnlockAbility) window.soundManager.playUnlockAbility();
      for (const p of q.pots) burst(p.x, p.y - 30, 10, 2.4);
    }
    if (q.phase === 'bloom') {
      q.doneT++;
      if (q.doneT === 60 && g.showNotification) g.showNotification('Las tres macetas florecieron');
      if (q.doneT > 210) {
        q.phase = 'finished';
        endPotDialog(g);
        if (n) { n.forceFace = 0; n.busy = false; n.bend = 0; }
      }
    }
  }

  // ¿Esta esfera (x, y, r) cae en la boca de alguna maceta vacía?
  function potCatch(room, x, y, r) {
    const q = room.potQuest;
    if (!q || (q.phase !== 'talk' && q.phase !== 'bloom')) return null;
    for (const p of q.pots) {
      if (!p.placed || p.filled) continue;
      const nx = Math.max(p.x - 15, Math.min(x, p.x + 15)), ny = Math.max(p.y - 30, Math.min(y, p.y - 10));
      if ((x - nx) * (x - nx) + (y - ny) * (y - ny) <= (r * 0.7) * (r * 0.7)) return p;
    }
    return null;
  }
  function fillPot(g, room, p) {
    p.filled = true;
    burst(p.x, p.y - 24, 8, 1.8);
    playSplash(0.4);
    playBell(880 + room.potQuest.pots.indexOf(p) * 147);
  }

  function drawPot(ctx, x, gy, scale, p, t) {
    ctx.save();
    ctx.translate(x, gy);
    const sq = p && p.landT > 0 ? Math.sin(p.landT / 14 * Math.PI) * 0.18 : 0;
    ctx.scale(scale * (1 + sq), scale * (1 - sq));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    // Sombra
    ctx.fillStyle = 'rgba(40, 22, 10, 0.22)';
    ctx.beginPath(); ctx.ellipse(0, 1, 13, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    // Cuerpo de barro (se angosta abajo) y borde
    ctx.fillStyle = '#c0663a';
    ctx.beginPath();
    ctx.moveTo(-9, 0); ctx.lineTo(-12, -18); ctx.lineTo(12, -18); ctx.lineTo(9, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d27a4a';
    ctx.beginPath(); ctx.roundRect(-15, -25, 30, 7, 2.5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 220, 180, 0.45)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(-9, -15); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    // Tierra o agua dentro
    if (p && p.fill > 0) {
      ctx.fillStyle = `rgba(120, 196, 220, ${0.5 + 0.4 * p.fill})`;
      ctx.beginPath(); ctx.ellipse(0, -25, 12 * p.fill + 1, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#5a3a22';
      ctx.beginPath(); ctx.ellipse(0, -25, 12, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Brote que crece y, al final, flor
    if (p && p.sprout > 0) {
      const sh = 4 + 18 * p.sprout;
      const sw = Math.sin(t * 0.05 + p.x) * 1.5 * p.sprout;
      ctx.strokeStyle = '#3f7d5a'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(sw * 0.5, -26 - sh * 0.5, sw, -26 - sh); ctx.stroke();
      if (p.sprout > 0.35) {
        const ls = Math.min(1, (p.sprout - 0.35) / 0.4);
        ctx.fillStyle = '#5fa67c'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(sw * 0.4 - 5 * ls, -26 - sh * 0.45, 5 * ls, 2.4 * ls, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(sw * 0.5 + 5 * ls, -26 - sh * 0.6, 5 * ls, 2.4 * ls, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      if (p.bloom > 0) {
        const fx = sw, fy = -26 - sh, pr = 2 + 4 * p.bloom;
        ctx.fillStyle = p.color; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) {
          const a = i * 1.2566 + t * 0.01;
          ctx.beginPath(); ctx.arc(fx + Math.cos(a) * pr, fy + Math.sin(a) * pr, pr * 0.75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = '#f0bf4c';
        ctx.beginPath(); ctx.arc(fx, fy, pr * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPots(ctx, room, cam, t) {
    const q = room.potQuest;
    if (!q) return;
    for (const p of q.pots) if (p.placed) drawPot(ctx, p.x - cam.x, p.y - cam.y, 1, p, t);
    // La maceta que el maestro está sacando / bajando
    if (q.phase === 'place' && q.idx < q.pots.length) {
      const n = waterMaster(room);
      const p = q.pots[q.idx];
      const k = q.t;
      if (n && k < 52) {
        const h = masterHand(n);
        if (k < 20) {
          drawPot(ctx, h.x - cam.x, h.y + 10 - cam.y, Math.max(0.05, k / 20) * 0.85, null, t);
        } else {
          const s = (k - 20) / 32, e = s * s * (3 - 2 * s);
          const x = h.x + (p.x - h.x) * e, y = (h.y + 10) + (p.y - h.y - 10) * e - Math.sin(s * Math.PI) * 14;
          drawPot(ctx, x - cam.x, y - cam.y, 0.85 + 0.15 * e, null, t);
        }
      }
    }
  }

  // ---------------- instalación ----------------
  function install(g) {
    const H = window.GameHooks;
    H.onBeforeUpdate.push((game, running) => { if (running) potQuestStep(game, game.world.getCurrentRoom()); });
    H.onAfterUpdate.push((game, running) => { if (running) bellsStep(game.world.getCurrentRoom()); });
    // Durante la escena el maestro está ocupado: Interactuar no hace nada
    H.onAction.push((game, action) => action === 'interact' && questActive(game.world.getCurrentRoom()));
    // El texto de la escena de las macetas no se cierra por distancia
    H.onKeepDialog.push((game) => game.activeNote === cs);
    H.onBeforeRoomLoad.push((game) => {
      if (game.activeNote === cs) { game.activeNote = null; game.hideDialog(); }
      bottomDialog(game, false);
    });
    H.onRestartGame.push((game) => {
      if (game.activeNote === cs) game.activeNote = null;
      bottomDialog(game, false);
    });

    // Macetas detrás de Ruben (capa world, después de los charcos); campanas por delante
    const AR = window.AnimationRegistry || window.AnimSystem;
    const drawPotsLayer = (ctx, cam) => { try { drawPots(ctx, g.world.getCurrentRoom(), cam, ws.t); } catch (e) { console.error('[Agua]', e); } };
    if (AR && AR.registerLayer) AR.registerLayer('world', 'water-pots', { order: 61, after(world, ctx, cam) { drawPotsLayer(ctx, cam); } });
    else H.onRenderWorld.push((game, ctx, cam) => drawPotsLayer(ctx, cam));
    H.onRenderWorld.push((game, ctx, cam) => {
      try { drawBells(ctx, game.world.getCurrentRoom(), cam, ws.t); } catch (e) { console.error('[Agua]', e); }
    });
  }

  window.WaterQuest = { ringBell, potCatch, fillPot };
  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[Agua] no se pudo iniciar la misión:', e); }
  });
})();
