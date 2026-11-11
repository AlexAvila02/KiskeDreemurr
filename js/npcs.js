/**
 * Personajes no jugables (NPC) - Ruben: En Busca de Angelo (Claude)
 *
 * Una sala declara sus NPC con `npcs: [{ id, name, x, y, facing, lines: [...], farewell }]`
 * (x = centro, y = altura de los pies). Al acercarse aparece una burbuja con la tecla de
 * Interactuar; cada pulsación muestra la siguiente línea en el cuadro de diálogo de siempre.
 * Al terminar repite la despedida. Alejarse cierra el diálogo (como las notas de Angelo).
 *
 * Dibujos: Maestro del Agua (look: 'water-master', enseña con teaches: 'water') y el
 * viejo pastor (por defecto). Decorados en props.js, notas en notes.js, brisa en ambience.js.
 * Hooks: onAction · onKeepDialog · onBeforeUpdate · onBeforeRoomLoad (ver MAPA.md); dibuja en
 * la capa world de AnimationRegistry (orden 50, detrás de Ruben). Sin basura por cuadro.
 *
 * API: window.NPCs.getNear() → NPC cercano o null · window.NPCs.drawBubble(ctx, texto, x, y)
 */
(function () {
  'use strict';

  const OUT = '#3a2416';
  const TALK_DIST_X = 52;
  const TALK_DIST_Y = 56;
  const state = { near: null, talkT: 0, t: 0 };

  function roomNpcs(g) {
    const room = g.world && g.world.getCurrentRoom();
    return (room && room.npcs) || null;
  }

  function findNear(g) {
    const list = roomNpcs(g);
    if (!list || g.player.dead) return null;
    const px = g.player.x + g.player.width / 2;
    const py = g.player.y + g.player.height / 2;
    for (const n of list) {
      if (Math.abs(px - n.x) < TALK_DIST_X && Math.abs(py - (n.y - 22)) < TALK_DIST_Y) return n;
    }
    return null;
  }

  // Despedida según el avance. Maestro del Agua: campanas de la laguna → pide mejorar la
  // habilidad → (mejorada) explica la esfera guiada → (campana del techo) despedida final.
  function farewellText(n, room) {
    const WC = window.WaterControl;
    if (n.teaches === 'water' && WC) {
      if (room && room.waterBellsDone && n.farewellDone) return n.farewellDone;
      if (WC.isUpgraded && WC.isUpgraded() && n.farewellUpgraded) return n.farewellUpgraded;
      if (room && room.waterLakeBellsDone && n.farewellLake) return n.farewellLake;
    } else if (n.farewellDone && room && room.waterBellsDone) {
      return n.farewellDone;
    }
    return n.farewell || n.lines[n.lines.length - 1];
  }

  function talk(g, n) {
    if (n.lineIdx === undefined) n.lineIdx = 0;
    // Si ya enseñó su habilidad (de otra partida guardada), salta directo a la despedida
    if (n.teaches === 'water' && window.WaterControl && window.WaterControl.isLearned() && n.lineIdx === 0) {
      n.lineIdx = n.lines.length;
    }
    let text;
    if (n.lineIdx < n.lines.length) {
      text = n.lines[n.lineIdx];
      n.lineIdx++;
      if (n.lineIdx < n.lines.length) text += '  ▸';
    } else {
      // Maestros que entrenan (n.trains): tras sus líneas, cada charla sube una estadística
      // (sin costo). Si no hay nada que entrenar, sigue la despedida de siempre.
      const trained = g.journal && g.journal.trainNpc ? g.journal.trainNpc(n) : null;
      text = trained || farewellText(n, g.world.getCurrentRoom());
    }
    g.activeNote = n;
    g.showDialog(n.name, text, true);
    state.talkT = 70; // cuadros moviendo la boca
    // Al terminar sus líneas, el maestro enseña su habilidad
    if (n.lineIdx >= n.lines.length && n.teaches === 'water' && window.WaterControl) {
      window.WaterControl.learn(g);
    }
  }

  // ---------------- dibujo (Maestro del Agua, estilo años 50) ----------------
  // Anciano de túnica turquesa con olas en el ruedo, cabeza calva, cejas y bigote blancos
  // largos que flotan, y un orbe de agua que gira sobre su palma con gotitas en órbita.
  function drawWaterMaster(ctx, n, cam, t, talking, lookDir) {
    const x = n.x - cam.x, fy = n.y - cam.y;
    const f = lookDir;
    const breathe = Math.sin(t * 0.04) * 0.025;
    const bob = talking ? Math.abs(Math.sin(t * 0.35)) * 1.5 : 0;
    const blink = (t % 240) < 7;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Sombra
    ctx.fillStyle = 'rgba(40, 22, 10, 0.22)';
    ctx.beginPath(); ctx.ellipse(x, fy + 1, 17, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    // bend (0..1): se agacha a dejar una maceta (lo controla water.js en la escena final)
    const bend = n.bend || 0;
    ctx.translate(x, fy);
    ctx.scale(1 - breathe * 0.5, 1 + breathe);
    ctx.translate(-x, -fy - bob);

    // Sandalias (no se inclinan con el cuerpo)
    ctx.fillStyle = '#8a5a35';
    ctx.beginPath(); ctx.ellipse(x - 6, fy - 2.5, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 6, fy - 2.5, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // El cuerpo se inclina hacia adelante desde los pies
    if (bend > 0) {
      ctx.translate(x, fy - 4);
      ctx.rotate(f * 0.42 * bend);
      ctx.translate(-x, -(fy - 4));
    }

    // Túnica larga turquesa (campana)
    ctx.fillStyle = '#3f8a8f';
    ctx.beginPath();
    ctx.moveTo(x - 8, fy - 38);
    ctx.quadraticCurveTo(x - 19, fy - 10, x - 17, fy - 5);
    ctx.lineTo(x + 17, fy - 5);
    ctx.quadraticCurveTo(x + 19, fy - 10, x + 8, fy - 38);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Olas blancas en el ruedo
    ctx.strokeStyle = '#e6f7f5'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const wx = x - 13 + i * 8.5, wy = fy - 9 + Math.sin(t * 0.08 + i) * 0.6;
      ctx.moveTo(wx - 3.5, wy); ctx.quadraticCurveTo(wx, wy - 4, wx + 3.5, wy);
    }
    ctx.stroke();
    // Faja azul oscuro
    ctx.strokeStyle = '#21545e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 12, fy - 22); ctx.lineTo(x + 12, fy - 22); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;

    // Brazo extendido con la palma hacia arriba (al agacharse baja hacia el suelo)
    const hx = x + f * 17, hy = fy - 27 + bend * 8;
    ctx.strokeStyle = OUT; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x + f * 6, fy - 31); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = '#3f8a8f'; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(x + f * 6, fy - 31); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.fillStyle = '#e8bf95';
    ctx.beginPath(); ctx.ellipse(hx + f * 2, hy - 1, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Orbe de agua flotando sobre la palma, con gotitas en órbita (lo guarda mientras
    // está ocupado con las macetas)
    if (!n.busy) {
    const ox = hx + f * 2, oy = hy - 14 + Math.sin(t * 0.06) * 2.5;
    const og = ctx.createRadialGradient(ox - 2, oy - 2, 1, ox, oy, 7.5);
    og.addColorStop(0, 'rgba(240, 253, 255, 0.95)');
    og.addColorStop(1, 'rgba(70, 150, 175, 0.9)');
    ctx.fillStyle = og;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(ox, oy, 7 + Math.sin(t * 0.2) * 0.6, 7 - Math.sin(t * 0.2) * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath(); ctx.ellipse(ox - 2.5, oy - 3, 2, 1.1, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9fdcef';
    for (let i = 0; i < 3; i++) {
      const a = t * 0.07 + i * 2.094;
      ctx.beginPath(); ctx.arc(ox + Math.cos(a) * 12, oy + Math.sin(a) * 4, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    }
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;

    // Cabeza calva
    const cx = x + f * 1.5, cy = fy - 47;
    ctx.fillStyle = '#e8bf95';
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Brillo en la calva
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath(); ctx.ellipse(cx - f * 3, cy - 6, 3, 1.6, -0.4 * f, 0, Math.PI * 2); ctx.fill();
    // Rodete de pelo blanco atrás
    ctx.fillStyle = '#f6efe0';
    ctx.beginPath(); ctx.arc(cx - f * 9, cy + 1, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Ojos (parpadean)
    ctx.fillStyle = OUT;
    for (const k of [-1, 1]) {
      const ex = cx + f * 2 + k * 4, ey = cy - 1;
      if (blink || talking && (t % 90) < 4) { ctx.beginPath(); ctx.moveTo(ex - 1.6, ey); ctx.lineTo(ex + 1.6, ey); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex + f * 0.6, ey, 1.3, 0, Math.PI * 2); ctx.fill(); }
    }
    // Cejas blancas largas que caen y se mecen
    ctx.strokeStyle = '#f6efe0'; ctx.lineWidth = 2.4;
    const sway = Math.sin(t * 0.05) * 1.5;
    ctx.beginPath(); ctx.moveTo(cx + f * 2 - 6, cy - 4.5); ctx.quadraticCurveTo(cx + f * 2 - 12, cy - 4, cx + f * 2 - 14, cy + 2 + sway); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + f * 2 + 6, cy - 4.5); ctx.quadraticCurveTo(cx + f * 2 + 12, cy - 4, cx + f * 2 + 14, cy + 2 - sway); ctx.stroke();
    // Bigote largo que cuelga como dos chorritos de agua
    const mouth = talking && state.talkT > 0 ? (0.5 + 0.5 * Math.sin(t * 0.6)) : 0;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx + f * 3, cy + 4); ctx.quadraticCurveTo(cx + f * 3 - 7, cy + 6, cx + f * 3 - 9, cy + 17 + sway); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + f * 3, cy + 4); ctx.quadraticCurveTo(cx + f * 3 + 7, cy + 6, cx + f * 3 + 9, cy + 17 - sway); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    if (mouth > 0.15) {
      ctx.fillStyle = '#5a2418';
      ctx.beginPath(); ctx.ellipse(cx + f * 3, cy + 7, 2.4, 0.8 + mouth * 1.8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Nariz
    ctx.fillStyle = '#d99a7a';
    ctx.beginPath(); ctx.arc(cx + f * 6, cy + 2, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---------------- dibujo (viejo pastor, estilo años 50) ----------------
  function drawShepherd(ctx, n, cam, t, talking, lookDir) {
    const x = n.x - cam.x, fy = n.y - cam.y;
    const f = lookDir;
    const breathe = Math.sin(t * 0.045) * 0.025;
    const bob = talking ? Math.abs(Math.sin(t * 0.35)) * 1.5 : 0;
    const blink = (t % 210) < 7;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Sombra
    ctx.fillStyle = 'rgba(40, 22, 10, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, fy + 1, 16, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;

    // Cayado (detrás del cuerpo, del lado hacia donde mira)
    const sx = x + f * 15;
    ctx.strokeStyle = OUT; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(sx, fy); ctx.lineTo(sx, fy - 50); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx - f * 6, fy - 50, 6, 0, Math.PI, f > 0); ctx.stroke();
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx, fy); ctx.lineTo(sx, fy - 50); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx - f * 6, fy - 50, 6, 0, Math.PI, f > 0); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;

    // Respiración: escala desde los pies
    ctx.translate(x, fy);
    ctx.scale(1 - breathe * 0.5, 1 + breathe);
    ctx.translate(-x, -fy - bob);

    // Botas
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath(); ctx.ellipse(x - 6, fy - 3, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 6, fy - 3, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Capa / túnica de lana (pera ancha)
    ctx.fillStyle = '#7a5a3a';
    ctx.beginPath();
    ctx.moveTo(x - 8, fy - 34);
    ctx.quadraticCurveTo(x - 17, fy - 8, x - 14, fy - 5);
    ctx.lineTo(x + 14, fy - 5);
    ctx.quadraticCurveTo(x + 17, fy - 8, x + 8, fy - 34);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Ribete de lana clara en el ruedo
    ctx.fillStyle = '#efe4cc';
    ctx.beginPath();
    ctx.roundRect(x - 15, fy - 9, 30, 5, 2.5);
    ctx.fill(); ctx.stroke();
    // Cinturón de cuerda
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 11, fy - 20); ctx.lineTo(x + 11, fy - 20); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;

    // Mano sobre el cayado
    ctx.fillStyle = '#f0c49a';
    ctx.beginPath(); ctx.arc(x + f * 13, fy - 26, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Cabeza
    const hx = x + f * 1.5, hy = fy - 43;
    ctx.fillStyle = '#f0c49a';
    ctx.beginPath(); ctx.arc(hx, hy, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Barba blanca grande (se abre al hablar)
    const mouth = talking && state.talkT > 0 ? (0.5 + 0.5 * Math.sin(t * 0.6)) : 0;
    ctx.fillStyle = '#f6efe0';
    ctx.beginPath();
    ctx.moveTo(hx - 9, hy + 1);
    ctx.quadraticCurveTo(hx - 10, hy + 14 + Math.sin(t * 0.04) * 1, hx + f * 2, hy + 18);
    ctx.quadraticCurveTo(hx + 10, hy + 14, hx + 9, hy + 1);
    ctx.quadraticCurveTo(hx, hy + 5, hx - 9, hy + 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (mouth > 0.15) {
      ctx.fillStyle = '#5a2418';
      ctx.beginPath(); ctx.ellipse(hx + f * 2, hy + 7, 2.6, 1 + mouth * 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Bigote
    ctx.fillStyle = '#f6efe0';
    ctx.beginPath(); ctx.ellipse(hx + f * 2 - 3.5, hy + 3.5, 4, 2.2, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx + f * 2 + 3.5, hy + 3.5, 4, 2.2, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Nariz redonda
    ctx.fillStyle = '#e0957a';
    ctx.beginPath(); ctx.arc(hx + f * 4, hy + 0.5, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Ojos (parpadean) y cejas pobladas
    ctx.fillStyle = OUT;
    for (const k of [-1, 1]) {
      const ex = hx + f * 2 + k * 3.8, ey = hy - 3;
      if (blink) { ctx.beginPath(); ctx.moveTo(ex - 1.6, ey); ctx.lineTo(ex + 1.6, ey); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex + f * 0.6, ey, 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.strokeStyle = '#f6efe0'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(hx + f * 2 - 6, hy - 6.5); ctx.lineTo(hx + f * 2 - 1.5, hy - 5.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + f * 2 + 1.5, hy - 5.5); ctx.lineTo(hx + f * 2 + 6, hy - 6.5); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;

    // Sombrero de paja de ala ancha
    ctx.fillStyle = '#c9a24a';
    ctx.beginPath(); ctx.ellipse(hx, hy - 8, 16, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy - 9);
    ctx.quadraticCurveTo(hx - 8, hy - 19, hx, hy - 19);
    ctx.quadraticCurveTo(hx + 8, hy - 19, hx + 8, hy - 9);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#8c412b'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(hx - 7.5, hy - 11); ctx.lineTo(hx + 7.5, hy - 11); ctx.stroke();

    ctx.restore();
  }

  // Burbuja "E · Hablar" sobre la cabeza
  function drawPrompt(ctx, g, n, cam, t) {
    const cm = g.controlsManager;
    const key = cm && cm.getPrimaryDisplayKey ? cm.getPrimaryDisplayKey('interact') : 'E';
    drawBubble(ctx, `${key} · Hablar`, n.x - cam.x, n.y - cam.y - 78 + Math.sin(t * 0.08) * 2);
  }

  // Cápsula oscura con borde mostaza (mismo estilo que los avisos) centrada en (x, y)
  function drawBubble(ctx, label, x, y) {
    ctx.save();
    ctx.font = 'bold 11px Georgia, serif';
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(48, 30, 18, 0.92)';
    ctx.strokeStyle = '#d9a634';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 10, w, 20, 10);
    ctx.fill(); ctx.stroke();
    // Piquito de la burbuja
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 10); ctx.lineTo(x, y + 15); ctx.lineTo(x + 4, y + 10);
    ctx.fill();
    ctx.fillStyle = '#fff2d0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 0.5);
    ctx.restore();
  }


  function render(g, ctx, cam) {
    const room = g.world && g.world.getCurrentRoom();
    if (!room) return;
    const list = room.npcs;
    if (!list) return;
    const px = g.player.x + g.player.width / 2;
    for (const n of list) {
      const talking = g.activeNote === n;
      const look = n.forceFace ? n.forceFace : (Math.abs(px - n.x) < 260 ? (px >= n.x ? 1 : -1) : (n.facing || 1));
      if (n.look === 'water-master') drawWaterMaster(ctx, n, cam, state.t, talking, look);
      else drawShepherd(ctx, n, cam, state.t, talking, look);
      if (state.near === n && !talking && !n.busy) drawPrompt(ctx, g, n, cam, state.t);
    }
  }

  function install(g) {
    const H = window.GameHooks;
    // Interactuar junto a un NPC: habla (si está ocupado, no hace nada)
    H.onAction.push((game, action) => {
      if (action !== 'interact' || !state.near) return false;
      if (state.near.busy) return true;
      // Con el texto escribiéndose, el primer toque lo completa (lo hace main.js)
      if (game.dialogTyping && !game.dialogBox.classList.contains('hidden')) return false;
      talk(game, state.near);
      return true;
    });
    // El diálogo del NPC no se cierra mientras Ruben siga al lado
    H.onKeepDialog.push((game) => !!(game.activeNote && game.activeNote.lines && game.activeNote === state.near));
    H.onBeforeUpdate.push((game, running) => {
      if (!running) return;
      state.t++;
      if (state.talkT > 0) state.talkT--;
      state.near = findNear(game);
    });
    H.onBeforeRoomLoad.push(() => { state.near = null; });

    // NPC DETRÁS de Ruben, enemigos y piedras: se dibujan justo después de las plataformas
    // (capa 'world' de AnimationRegistry). Si no existe, encima (respaldo).
    const AR = window.AnimationRegistry || window.AnimSystem;
    if (AR && AR.registerLayer) {
      AR.registerLayer('world', 'npcs', {
        order: 50,
        after(world, ctx, cam) {
          try { render(g, ctx, cam); } catch (e) { console.error('[NPC]', e); }
        }
      });
    } else {
      H.onRenderWorld.push((game, ctx, cam) => {
        try { render(game, ctx, cam); } catch (e) { console.error('[NPC]', e); }
      });
    }
  }

  window.NPCs = { getNear: () => state.near, drawBubble };
  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
    try { install(game); } catch (e) { console.error('[NPC] no se pudo iniciar:', e); }
  });
})();
