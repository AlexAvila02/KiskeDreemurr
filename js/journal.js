/**
 * Diario de Ruben - Objetos, Notas de Angelo y Estadísticas (Claude)
 *
 * - Objetos coleccionables en las salas (`room.collectibles: [{ item, x, y }]`).
 * - Menú "Diario" con tres pestañas: OBJETOS · ESTADÍSTICAS · NOTAS DE ANGELO.
 * - ESTADÍSTICAS de Ruben: daño básico, velocidad de ataque, defensa (probabilidad de
 *   bloquear un golpe) y velocidad de movimiento.
 *     · Se suben ENTRENANDO con los maestros: hablá con ellos después de sus líneas y cada
 *       charla sube su estadística más baja un nivel, sin costo. Máximo STAT_MAX por stat.
 *     · Se potencian EQUIPANDO objetos del diario (hasta EQUIP_SLOTS a la vez).
 * - Sin sistema de puntos: el entrenamiento y los objetos equipados son la única progresión.
 * - Progreso guardado en localStorage ('ruben_diario_v1').
 *
 * Abrir / cerrar: I o Tab (si no están asignadas a otra acción) · botón del HUD ·
 * "DIARIO" en el menú de pausa · 🎮 Select/Back. Dentro: Q/E o LB/RB cambian de pestaña,
 * flechas o cruceta mueven la selección, Enter / A elige, Esc / B cierra.
 *
 * Se integra con GameHooks (onInit, onAfterUpdate, onBeforeTogglePause, onRenderWorld;
 *   ver MAPA.md), ajusta player.mods (estadísticas) y amplía MenuNavigator (js/menu-nav.js)
 *   para que el mando navegue el Diario. Los maestros llaman a `game.journal.trainNpc(npc)`
 *   desde npcs.js.
 */
(function () {
  'use strict';

  const SAVE_KEY = 'ruben_diario_v1';
  const INK = '#3a2416';


  // ------------------------------------------------------------------
  // Catálogo de objetos
  // ------------------------------------------------------------------
  const ITEMS = {
    llave: {
      name: 'Llave del Portón Norte',
      desc: 'Angelo la dejó en lo alto del molino. Abrió el camino hacia el Bosque de los Susurros.',
      kind: 'Objeto clave'
    },
    emblema: {
      name: 'Emblema del Reino',
      desc: 'Escudos del viejo ejército de la familia. Cada uno le recuerda a Ruben un entrenamiento con Angelo.',
      kind: 'Reliquia · se acumula',
      stack: true
    },
    panuelo: {
      name: 'Pañuelo de Angelo',
      desc: 'Bordado por mamá con una A y una R entrelazadas. Todavía huele a fogata: Angelo pasó por el claro hace poco.',
      kind: 'Recuerdo'
    },
    mapa: {
      name: 'Mapa Rasgado',
      desc: 'Un trozo del mapa del reino. Alguien marcó con carbón el camino que sube por el roble hasta la Montaña Gris.',
      kind: 'Recuerdo'
    },
    brujula: {
      name: 'Brújula de Papá',
      desc: 'Su aguja no apunta al norte: apunta siempre hacia el castillo, el viejo hogar de la familia.',
      kind: 'Recuerdo'
    },
    campanilla: {
      name: 'Campanilla de Plata',
      desc: 'Angelo la llevaba atada al cinturón para no perderse en la niebla. Se le cayó cruzando la cornisa.',
      kind: 'Recuerdo'
    },
    retrato: {
      name: 'Retrato Familiar',
      desc: 'Una pintura chamuscada: papá, mamá, Angelo y un Ruben muy chiquito. Estaba colgada en las murallas.',
      kind: 'Recuerdo'
    },
    sello: {
      name: 'Sello del Reino',
      desc: 'El sello real de la familia. Prueba de quiénes son... y de lo que pueden volver a ser.',
      kind: 'Objeto clave'
    }
  };
  const ITEM_ORDER = ['llave', 'emblema', 'panuelo', 'mapa', 'brujula', 'campanilla', 'retrato', 'sello'];


  // ------------------------------------------------------------------
  // Estadísticas de Ruben (pestaña ESTADÍSTICAS del Diario)
  // ------------------------------------------------------------------
  const STAT_MAX = 100;              // tope interno de entrenamiento por estadística (el jugador no lo ve)
  const BASE_DAMAGE = 15;            // daño del tajo básico (player.js: 15 * mods.attackDamage)
  const BASE_ATTACK_FRAMES = 18;     // cuadros entre tajos sin mejoras (player.js)
  const STATS = {
    dmg:  { name: 'Daño básico', short: 'Daño', step: 0.10, trainText: 'El maestro te hace repetir el tajo hasta que los brazos pesan, y el golpe pesa más.' },
    atk:  { name: 'Velocidad de ataque', short: 'Ritmo', step: 0.08, trainText: 'Te enseña a volver a la guardia sin pensarlo: las manos ganan ritmo.' },
    def:  { name: 'Defensa', short: 'Defensa', step: 0.06, trainText: 'Te hace cubrirte con el brazo una y otra vez: ahora los golpes te encuentran menos.' },
    move: { name: 'Velocidad de movimiento', short: 'Veloc.', step: 0.05, trainText: 'Corren cuesta arriba y cuesta abajo: el cuerpo aprende a ir liviano.' }
  };
  const STAT_ORDER = ['dmg', 'atk', 'def', 'move'];
  const EQUIP_SLOTS = 2;             // objetos equipados a la vez
  // Objetos del diario que se equipan: suman un % a una estadística
  const EQUIP = {
    brujula:    { stat: 'move', bonus: 0.12 },
    campanilla: { stat: 'atk',  bonus: 0.15 },
    retrato:    { stat: 'dmg',  bonus: 0.15 },
    sello:      { stat: 'def',  bonus: 0.12 }
  };

  // ------------------------------------------------------------------
  // Íconos dibujados a mano con Canvas (tinta marrón, estilo años 50)
  // Coordenadas en una caja de 32 x 32 centrada en (0, 0)
  // ------------------------------------------------------------------
  function heartPath(c, s = 1, ox = 0, oy = 0) {
    c.beginPath();
    c.moveTo(ox, oy + 10 * s);
    c.bezierCurveTo(ox - 14 * s, oy, ox - 10 * s, oy - 12 * s, ox, oy - 5 * s);
    c.bezierCurveTo(ox + 10 * s, oy - 12 * s, ox + 14 * s, oy, ox, oy + 10 * s);
    c.closePath();
  }
  function sparkle(c, x, y, r, color = '#fff2d0') {
    c.save();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
    c.fill();
    c.restore();
  }
  function fs(c, fill) { c.fillStyle = fill; c.fill(); c.stroke(); }

  const ICONS = {
    emblema(c) {
      c.beginPath();
      c.moveTo(-11, -12); c.lineTo(11, -12); c.lineTo(11, 0);
      c.quadraticCurveTo(11, 10, 0, 14); c.quadraticCurveTo(-11, 10, -11, 0); c.closePath();
      const g = c.createLinearGradient(0, -12, 0, 14);
      g.addColorStop(0, '#f6d57a'); g.addColorStop(1, '#bf8a2b');
      fs(c, g);
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-7, -4); c.lineTo(0, 3); c.lineTo(7, -4); c.lineTo(7, 1); c.lineTo(0, 8); c.lineTo(-7, 1); c.closePath();
      fs(c, '#b83b3b');
      c.beginPath(); c.arc(0, -7.5, 2.2, 0, Math.PI * 2); fs(c, '#fff2d0');
    },
    llave(c) {
      c.rotate(-0.55);
      c.beginPath();
      c.arc(-8, 0, 6, 0, Math.PI * 2);
      c.arc(-8, 0, 2.4, 0, Math.PI * 2, true);
      c.fillStyle = '#e2b54a'; c.fill('evenodd'); c.stroke();
      c.beginPath(); c.roundRect(-2.5, -2, 17, 4, 1.5); fs(c, '#e2b54a');
      c.beginPath(); c.rect(8, 2, 3, 5); fs(c, '#e2b54a');
      c.beginPath(); c.rect(12, 2, 2.5, 3.5); fs(c, '#e2b54a');
    },
    panuelo(c) {
      c.rotate(Math.PI / 4);
      c.beginPath(); c.roundRect(-10, -10, 20, 20, 3); fs(c, '#c9524a');
      c.save();
      c.strokeStyle = '#f5e2ba'; c.lineWidth = 1.3; c.setLineDash([2, 2]);
      c.strokeRect(-6.5, -6.5, 13, 13);
      c.restore();
      c.beginPath(); c.moveTo(4, 10); c.lineTo(10, 10); c.lineTo(10, 4); c.closePath(); fs(c, '#e07a6e');
      c.rotate(-Math.PI / 4);
      c.fillStyle = '#f5e2ba';
      c.font = 'bold 8px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('AR', 0, 0.5);
    },
    mapa(c) {
      c.beginPath();
      c.moveTo(-12, -10); c.lineTo(10, -11); c.lineTo(12, -4); c.lineTo(9, 0); c.lineTo(12, 5);
      c.lineTo(11, 11); c.lineTo(-11, 10); c.closePath();
      fs(c, '#f2dcae');
      c.save();
      c.strokeStyle = 'rgba(58, 36, 22, 0.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-4, -10.5); c.lineTo(-4, 10.5); c.moveTo(4, -10.8); c.lineTo(4, 10.6); c.stroke();
      c.strokeStyle = '#b83b3b'; c.lineWidth = 1.6; c.setLineDash([2, 2]);
      c.beginPath(); c.moveTo(-8, 6); c.quadraticCurveTo(-3, -6, 2, 2); c.quadraticCurveTo(5, 6, 7, -4); c.stroke();
      c.setLineDash([]); c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(5, -6.5); c.lineTo(9, -2.5); c.moveTo(9, -6.5); c.lineTo(5, -2.5); c.stroke();
      c.restore();
    },
    brujula(c) {
      c.beginPath(); c.arc(0, -13.5, 2.6, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); fs(c, '#c8963e');
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, 0, 8.8, 0, Math.PI * 2); fs(c, '#f5e8c8');
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        c.beginPath(); c.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); c.lineTo(Math.cos(a) * 8.6, Math.sin(a) * 8.6); c.stroke();
      }
      c.rotate(0.6);
      c.beginPath(); c.moveTo(0, -7.5); c.lineTo(2.4, 0); c.lineTo(-2.4, 0); c.closePath(); fs(c, '#c63d33');
      c.beginPath(); c.moveTo(0, 7.5); c.lineTo(2.4, 0); c.lineTo(-2.4, 0); c.closePath(); fs(c, '#8a96a3');
      c.beginPath(); c.arc(0, 0, 1.4, 0, Math.PI * 2); fs(c, INK);
    },
    campanilla(c) {
      c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(-4.5, -12, 4, 2.6, -0.4, 0, Math.PI * 2); fs(c, '#4a6fa5');
      c.beginPath(); c.ellipse(4.5, -12, 4, 2.6, 0.4, 0, Math.PI * 2); fs(c, '#4a6fa5');
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-9, 7); c.quadraticCurveTo(-9, -10, 0, -10); c.quadraticCurveTo(9, -10, 9, 7);
      c.lineTo(11.5, 9.5); c.lineTo(-11.5, 9.5); c.closePath();
      const g = c.createLinearGradient(-9, 0, 9, 0);
      g.addColorStop(0, '#9aa8b4'); g.addColorStop(0.35, '#eef3f6'); g.addColorStop(1, '#8796a3');
      fs(c, g);
      c.beginPath(); c.arc(0, -11.5, 2, 0, Math.PI * 2); fs(c, '#3b5a88');
      c.beginPath(); c.arc(0, 11.5, 2.6, 0, Math.PI * 2); fs(c, '#d9a634');
      c.save(); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(-5, 4); c.quadraticCurveTo(-5.5, -4, -2, -6.5); c.stroke(); c.restore();
    },
    retrato(c) {
      c.beginPath(); c.roundRect(-12, -12, 24, 24, 2); fs(c, '#d9a634');
      c.lineWidth = 1.3;
      c.beginPath(); c.rect(-8.5, -8.5, 17, 17); fs(c, '#6e3746');
      const fig = (x, y, r, body) => {
        c.beginPath(); c.arc(x, y + r + 3.2, r * 1.15, Math.PI, 0); c.lineTo(x + r * 1.15, 8.5); c.lineTo(x - r * 1.15, 8.5); c.closePath();
        c.fillStyle = body; c.fill();
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = '#f2cfa6'; c.fill();
      };
      fig(-4.8, -2, 2.4, '#3f7d5a');
      fig(-0.6, -3, 2.5, '#8c2732');
      fig(3.4, 0, 2.0, '#d9a634');
      fig(6.2, 2.6, 1.5, '#4a6fa5');
      c.beginPath(); c.rect(-8.5, -8.5, 17, 17); c.stroke();
      c.save(); c.fillStyle = 'rgba(30,16,10,0.45)';
      c.beginPath(); c.moveTo(4, -8.5); c.lineTo(8.5, -8.5); c.lineTo(8.5, -3); c.closePath(); c.fill(); c.restore();
    },
    sello(c) {
      c.beginPath(); c.moveTo(-5, 6); c.lineTo(-9, 15); c.lineTo(-5, 13); c.lineTo(-2, 16); c.lineTo(0, 7); fs(c, '#7d1f1d');
      c.beginPath(); c.moveTo(5, 6); c.lineTo(9, 15); c.lineTo(5, 13); c.lineTo(2, 16); c.lineTo(0, 7); fs(c, '#7d1f1d');
      c.beginPath();
      const N = 12;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const r = 11 + (i % 2 ? 1.4 : -0.4);
        const x = Math.cos(a) * r, y = Math.sin(a) * r - 1;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath(); fs(c, '#b0302c');
      c.save(); c.strokeStyle = '#e07a6e'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, -1, 7.2, 0, Math.PI * 2); c.stroke(); c.restore();
      c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(-5, 2.5); c.lineTo(-5, -4); c.lineTo(-2.5, -1); c.lineTo(0, -5.5); c.lineTo(2.5, -1); c.lineTo(5, -4); c.lineTo(5, 2.5); c.closePath();
      fs(c, '#e9b04a');
    },
    corazon(c) {
      heartPath(c); fs(c, '#d4483b');
      c.save(); c.fillStyle = 'rgba(255,255,255,0.6)';
      c.beginPath(); c.ellipse(-4.5, -3.5, 2.6, 1.6, -0.6, 0, Math.PI * 2); c.fill(); c.restore();
    },
    diario(c) {
      c.beginPath(); c.roundRect(-11, -12, 22, 24, 3); fs(c, '#7a4a2b');
      c.beginPath(); c.rect(-11, -12, 5, 24); fs(c, '#4a2a18');
      c.beginPath(); c.rect(9, -10, 2.5, 20); fs(c, '#f5e2ba');
      c.beginPath(); c.arc(2, 0, 4, 0, Math.PI * 2); fs(c, '#d9a634');
      c.beginPath(); c.roundRect(7, -2.2, 6, 4.4, 1); fs(c, '#d9a634');
    },
    bellota(c) {
      c.beginPath(); c.ellipse(0, 4, 8, 9, 0, 0, Math.PI * 2); fs(c, '#c98a3a');
      c.save(); c.fillStyle = 'rgba(255,240,200,0.55)';
      c.beginPath(); c.ellipse(-3.5, 5, 2, 3.5, 0.2, 0, Math.PI * 2); c.fill(); c.restore();
      c.beginPath();
      c.moveTo(-10, -2); c.quadraticCurveTo(-9, -11, 0, -11); c.quadraticCurveTo(9, -11, 10, -2);
      c.quadraticCurveTo(0, 1.5, -10, -2); c.closePath(); fs(c, '#7a5230');
      c.save(); c.strokeStyle = 'rgba(245,226,186,0.45)'; c.lineWidth = 1;
      c.beginPath();
      for (let x = -6; x <= 6; x += 4) { c.moveTo(x - 2, -8); c.lineTo(x + 2, -2); }
      c.stroke(); c.restore();
      c.lineWidth = 2.6; c.beginPath(); c.moveTo(0, -11); c.quadraticCurveTo(1, -14, 3, -15); c.stroke();
    },
    brote(c) {
      c.beginPath(); c.ellipse(0, 12, 9, 2.8, 0, 0, Math.PI * 2); fs(c, '#7a5230');
      c.lineWidth = 4; c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(-1.5, 3, 0, -2); c.stroke();
      c.strokeStyle = '#4f9a5c'; c.lineWidth = 2; c.stroke(); c.strokeStyle = INK;
      c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(0, -1); c.quadraticCurveTo(-12, -2, -11, -10); c.quadraticCurveTo(-2, -10, 0, -1); fs(c, '#6aa84f');
      c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(13, -1, 12, -12); c.quadraticCurveTo(1, -13, 0, -2); fs(c, '#86c063');
      sparkle(c, 9, 5, 3.2); sparkle(c, -9, 3, 2.4); sparkle(c, 4, -15, 2.2);
    },
    roble(c) {
      const pts = [[0, -14], [4, -12], [5, -8], [9, -8], [8, -3], [12, 0], [8, 3], [9, 8], [3, 7], [1.5, 11]];
      c.beginPath();
      c.moveTo(0, -14);
      for (let i = 1; i < pts.length; i++) {
        const [x, y] = pts[i], [px, py] = pts[i - 1];
        c.quadraticCurveTo((px + x) / 2 + 2.5, (py + y) / 2, x, y);
      }
      c.lineTo(-1.5, 11);
      for (let i = pts.length - 1; i > 0; i--) {
        const [x, y] = pts[i - 1], [px, py] = pts[i];
        c.quadraticCurveTo(-((px + x) / 2 + 2.5), (py + y) / 2, -x, y);
      }
      c.closePath(); fs(c, '#a77a2e');
      c.save(); c.strokeStyle = 'rgba(58,36,22,0.6)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, -11); c.lineTo(0, 16);
      c.moveTo(0, -4); c.lineTo(6, -6); c.moveTo(0, -4); c.lineTo(-6, -6);
      c.moveTo(0, 3); c.lineTo(6, 1); c.moveTo(0, 3); c.lineTo(-6, 1);
      c.stroke(); c.restore();
    },
    espada(c) {
      sparkle(c, 10, -9, 3); sparkle(c, -10, 7, 2.2);
      c.rotate(Math.PI / 4);
      c.beginPath(); c.moveTo(-2.4, -12); c.lineTo(0, -16); c.lineTo(2.4, -12); c.lineTo(2.4, 4); c.lineTo(-2.4, 4); c.closePath();
      fs(c, '#e4ebef');
      c.save(); c.strokeStyle = 'rgba(58,36,22,0.4)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, -12); c.lineTo(0, 3); c.stroke(); c.restore();
      c.beginPath(); c.roundRect(-7, 4, 14, 3.6, 1.5); fs(c, '#d9a634');
      c.beginPath(); c.rect(-1.7, 7.6, 3.4, 6); fs(c, '#6b3f26');
      c.beginPath(); c.arc(0, 15.2, 2.3, 0, Math.PI * 2); fs(c, '#d9a634');
    },
    tajos(c) {
      const crescent = (r, fill) => {
        c.beginPath();
        c.arc(0, 0, r, -2.5, 0.7);
        c.arc(-r * 0.28, r * 0.18, r * 0.72, 0.7, -2.5, true);
        c.closePath(); fs(c, fill);
      };
      c.save(); c.translate(-3, 3); crescent(10, '#f0c75a'); c.restore();
      c.save(); c.translate(3, -2); crescent(12, '#fff2d0'); c.restore();
      c.save(); c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-14, 10); c.lineTo(-9, 10); c.moveTo(-13, 14); c.lineTo(-6, 14); c.stroke(); c.restore();
    },
    botin(c) {
      c.beginPath(); c.moveTo(-5, -4); c.lineTo(-3.5, -10); c.lineTo(3.5, -10); c.lineTo(5, -4); c.closePath(); fs(c, '#a77a45');
      c.beginPath();
      c.moveTo(-9, -3); c.quadraticCurveTo(-14, 13, 0, 13); c.quadraticCurveTo(14, 13, 9, -3); c.quadraticCurveTo(0, -0.5, -9, -3);
      c.closePath(); fs(c, '#c49a5e');
      c.lineWidth = 2.2; c.beginPath(); c.moveTo(-6, -4); c.quadraticCurveTo(0, -1.5, 6, -4); c.stroke();
      c.lineWidth = 1.4; heartPath(c, 0.45, 0, 5); fs(c, '#d4483b');
    },
    bota(c) {
      c.save(); c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(-15, -3); c.lineTo(-9, -3); c.moveTo(-16, 2); c.lineTo(-8, 2); c.moveTo(-14, 7); c.lineTo(-9, 7); c.stroke(); c.restore();
      c.beginPath();
      c.moveTo(-5, -11); c.lineTo(4, -11); c.lineTo(4, 2); c.quadraticCurveTo(13, 3, 13, 8); c.lineTo(13, 11); c.lineTo(-5, 11); c.closePath();
      fs(c, '#7a4a2b');
      c.beginPath(); c.roundRect(-6.5, -13.5, 12, 4.5, 1.5); fs(c, '#d9a634');
      c.save(); c.strokeStyle = 'rgba(245,226,186,0.5)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-5, 8); c.lineTo(13, 8); c.stroke(); c.restore();
      c.beginPath(); c.moveTo(4, -6); c.quadraticCurveTo(12, -12, 14, -6); c.quadraticCurveTo(10, -6, 4, -2); fs(c, '#f5e8c8');
    },
    piedra(c) {
      c.save(); c.lineWidth = 1.6; c.setLineDash([2.5, 2.5]);
      c.beginPath(); c.moveTo(-15, 12); c.quadraticCurveTo(-14, -2, -6, -6); c.stroke(); c.restore();
      c.beginPath();
      c.moveTo(-5, -4); c.lineTo(1, -9); c.lineTo(8, -6); c.lineTo(11, 1); c.lineTo(7, 8); c.lineTo(-2, 9); c.lineTo(-7, 3); c.closePath();
      fs(c, '#8b7a62');
      c.save(); c.fillStyle = 'rgba(255,240,210,0.45)';
      c.beginPath(); c.moveTo(-2, -4); c.lineTo(2, -6.5); c.lineTo(5, -4.5); c.lineTo(0, -2); c.closePath(); c.fill(); c.restore();
      c.save(); c.strokeStyle = 'rgba(58,36,22,0.5)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(2, 0); c.lineTo(6, 4); c.stroke(); c.restore();
    },
    pluma(c) {
      sparkle(c, -10, -8, 2.6); sparkle(c, 10, 9, 2.2);
      c.rotate(0.6);
      c.beginPath(); c.moveTo(0, -15); c.quadraticCurveTo(9, -6, 4, 8); c.lineTo(0, 11); c.lineTo(-4, 8); c.quadraticCurveTo(-9, -6, 0, -15); c.closePath();
      fs(c, '#f5e8c8');
      c.save(); c.strokeStyle = 'rgba(58,36,22,0.45)'; c.lineWidth = 1;
      c.beginPath();
      for (let y = -8; y <= 5; y += 4) { c.moveTo(0, y); c.lineTo(5, y - 3); c.moveTo(0, y); c.lineTo(-5, y - 3); }
      c.stroke(); c.restore();
      c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, -13); c.lineTo(0, 16); c.stroke();
      c.beginPath(); c.moveTo(0, -15); c.quadraticCurveTo(3, -12, 2.4, -9); c.lineTo(-2.4, -9); c.quadraticCurveTo(-3, -12, 0, -15); fs(c, '#d9a634');
    }
  };

  function drawIcon(ctx, key, cx, cy, size, opts = {}) {
    const fn = ICONS[key];
    if (!fn) return;
    ctx.save();
    ctx.translate(cx, cy);
    if (opts.scaleX !== undefined) ctx.scale(opts.scaleX, 1);
    ctx.scale(size / 32, size / 32);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    fn(ctx);
    ctx.restore();
  }

  // Lienzo nítido (alta densidad) con un ícono dibujado; `hidden` = silueta "por descubrir"
  function iconCanvas(key, size, hidden = false) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    cv.className = 'journal-icon';
    paintIcon(cv, key, hidden);
    return cv;
  }
  function paintIcon(cv, key, hidden = false) {
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    drawIcon(c, key, cv.width / 2, cv.height / 2, cv.width * 0.86);
    if (hidden) {
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(58, 36, 22, 0.88)';
      c.fillRect(0, 0, cv.width, cv.height);
      c.globalCompositeOperation = 'source-over';
    }
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }


  // ------------------------------------------------------------------
  // Diario
  // ------------------------------------------------------------------
  function emptySave() {
    return { collected: {}, notes: {}, valor: 0, stats: { dmg: 0, atk: 0, def: 0, move: 0 }, equipped: [] };
  }

  class Journal {
    constructor(game) {
      this.game = game;
      this.save = this.load();
      this.counted = new WeakSet();   // enemigos ya contados como derrotados
      this.tab = 'items';
      this.selectedItem = 'llave';
      this.openedFromPause = false;
      this.resetArmed = 0;

      const p = game.player;
      this.base = {
        maxHp: p.maxHp, speed: p.speed, jumpForce: p.jumpForce,
        attackCooldown: p.mods ? p.mods.attackCooldown : BASE_ATTACK_FRAMES
      };

      this.syncRoomsWithSave();
      this.wrapGame();
      this.buildUI();
      this.hookMenuNav();
      this.setupKeys();
      this.applyPassives();
      this.refreshHud();
    }

    // ---------------- Guardado ----------------
    load() {
      try {
        const raw = window.localStorage.getItem(SAVE_KEY);
        if (!raw) return emptySave();
        const data = JSON.parse(raw);
        const s = emptySave();
        s.collected = data.collected || {};
        s.notes = data.notes || {};
        s.valor = Number(data.valor) || 0;
        for (const id of STAT_ORDER) {
          s.stats[id] = Math.max(0, Math.min(STAT_MAX, Number(data.stats && data.stats[id]) || 0));
        }
        s.equipped = Array.isArray(data.equipped) ? data.equipped.filter(id => EQUIP[id]).slice(0, EQUIP_SLOTS) : [];
        return s;
      } catch (e) {
        return emptySave();
      }
    }
    persist() {
      try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { /* sin guardado */ }
    }

    syncRoomsWithSave() {
      this.game.world.rooms.forEach((room, id) => {
        if (!room || !room.collectibles) return;
        room.collectibles.forEach((c, i) => { c.collected = !!this.save.collected[`${id}:${i}`]; });
      });
    }

    // ---------------- Cuentas ----------------
    emblemCount() {
      return Object.values(this.save.collected).filter(v => v === 'emblema').length;
    }
    statLevel(id) { return Math.max(0, Math.min(STAT_MAX, this.save.stats[id] || 0)); }
    ownsItem(id) {
      if (id === 'llave') return this.game.player.keys > 0 || !!(this.game.world.rooms[2] && this.game.world.rooms[2].keyItem && this.game.world.rooms[2].keyItem.collected);
      return Object.values(this.save.collected).includes(id);
    }
    itemCount(id) { return Object.values(this.save.collected).filter(v => v === id).length; }
    worldCount(id) {
      let n = 0;
      for (const room of this.game.world.rooms) {
        if (room && room.collectibles) n += room.collectibles.filter(c => c.item === id).length;
      }
      return n;
    }
    whereFound(id) {
      for (const key of Object.keys(this.save.collected)) {
        if (this.save.collected[key] === id) {
          const room = this.game.world.rooms[+key.split(':')[0]];
          if (room) return room.name;
        }
      }
      if (id === 'llave') return 'ALTOZANO DEL MOLINO';
      return null;
    }

    // ---------------- Estadísticas ----------------
    // Bonus de los objetos equipados sobre una estadística (fracción: 0.15 = +15%)
    equipBonus(id) {
      let sum = 0;
      for (const eid of this.save.equipped) {
        const e = EQUIP[eid];
        if (e && e.stat === id) sum += e.bonus;
      }
      return sum;
    }
    // Multiplicador de daño, velocidad de ataque o de movimiento (1 = sin mejoras)
    statMult(id) { return 1 + STATS[id].step * this.statLevel(id) + this.equipBonus(id); }
    blockChance() { return Math.min(0.5, STATS.def.step * this.statLevel('def') + this.equipBonus('def')); }
    attackCooldown() { return Math.max(6, Math.round(this.base.attackCooldown / this.statMult('atk'))); }

    applyPassives() {
      const p = this.game.player, b = this.base;
      p.maxHp = b.maxHp;
      p.hp = Math.min(p.hp, p.maxHp);
      p.speed = b.speed * this.statMult('move');
      p.jumpForce = b.jumpForce;
      // Estadísticas de combate: player.js las lee de player.mods
      if (p.mods) {
        p.mods.attackDamage = this.statMult('dmg');
        p.mods.attackCooldown = this.attackCooldown();
        p.mods.blockChance = this.blockChance();
      }
      if (this.game.updateHUD) this.game.updateHUD();
    }

    // Texto de cada fila de la pestaña ESTADÍSTICAS
    statText(id) {
      if (id === 'def') return `bloquea ${Math.round(this.blockChance() * 100)}% de golpes`;
      const m = this.statMult(id);
      const pct = Math.round((m - 1) * 100);
      const sign = pct >= 0 ? '+' : '';
      if (id === 'dmg') return `${Math.round(BASE_DAMAGE * m)} · ${sign}${pct}%`;
      if (id === 'atk') return `tajo cada ${this.attackCooldown()} cuadros · ${sign}${pct}%`;
      return `${(this.base.speed * m).toFixed(1)} · ${sign}${pct}%`;
    }
    trainersOf(id) {
      const names = [];
      for (const room of this.game.world.rooms) {
        if (!room || !room.npcs) continue;
        room.npcs.forEach(n => { if ((n.trains || []).includes(id)) names.push(n.name.split(',')[0]); });
      }
      return names.length ? names.join(' · ') : 'nadie todavía';
    }

    // Lo llama npcs.js cuando el maestro ya dijo sus líneas y Ruben vuelve a hablarle.
    // Devuelve el texto del entrenamiento, o null si no hay nada que entrenar (sigue la despedida).
    trainNpc(npc) {
      const ids = (npc.trains || []).filter(id => STATS[id]);
      const open = ids.filter(id => this.statLevel(id) < STAT_MAX);
      if (!open.length) return null;
      // Entrena la estadística más baja de ese maestro (sin costo)
      open.sort((a, b) => this.statLevel(a) - this.statLevel(b));
      const id = open[0];
      this.save.stats[id] = this.statLevel(id) + 1;
      this.persist();
      this.applyPassives();
      this.refreshHeader();
      const sm = window.soundManager;
      if (sm && sm.playUnlockAbility) try { sm.playUnlockAbility(); } catch (e) { /* */ }
      this.game.showNotification(`${STATS[id].name} · nivel ${this.statLevel(id)}`);
      return `${STATS[id].trainText} (${STATS[id].name}: nivel ${this.statLevel(id)}).`;
    }

    // Equipa / quita un objeto del diario (hasta EQUIP_SLOTS)
    toggleEquip(id) {
      if (!EQUIP[id] || !this.ownsItem(id)) return false;
      const i = this.save.equipped.indexOf(id);
      if (i >= 0) {
        this.save.equipped.splice(i, 1);
      } else {
        if (this.save.equipped.length >= EQUIP_SLOTS) {
          this.game.showNotification(`Ya tenés ${EQUIP_SLOTS} objetos equipados: quitá uno primero`);
          return false;
        }
        this.save.equipped.push(id);
      }
      this.persist();
      this.applyPassives();
      this.renderStats();
      this.refreshHeader();
      return true;
    }

    // ---------------- Envoltorios del motor ----------------
    wrapGame() {
      const H = window.GameHooks;
      H.onAfterUpdate.push(() => this.tick());
      // Con el Diario abierto, "pausa" lo cierra (en vez de abrir el menú de pausa)
      H.onBeforeTogglePause.push(() => {
        if (!this.isOpen()) return false;
        this.close(false);
        return true;
      });
      H.onRenderWorld.push((game, ctx, cam) => this.renderWorld(ctx, cam));
    }

    // ---------------- Lógica por cuadro ----------------
    tick() {
      const g = this.game;
      if (!g.isPlaying || g.isPaused || g.deathTimer > 0 || g.hitStopFrames > 0) return;
      const p = g.player;
      if (p.dead) return;
      const roomId = g.world.currentRoomIndex;
      const room = g.world.getCurrentRoom();
      const px = p.x + p.width / 2, py = p.y + p.height / 2;

      // Objetos
      if (room.collectibles) {
        room.collectibles.forEach((c, i) => {
          if (c.collected) return;
          if (Math.hypot(px - c.x, py - c.y) < 30) this.collect(roomId, i, c);
        });
      }

      // Notas leídas (las muestra main.js por cercanía)
      const note = g.activeNote;
      if (note && room.tablets) {
        const idx = room.tablets.indexOf(note);
        if (idx >= 0 && !this.save.notes[`${roomId}:${idx}`]) {
          this.save.notes[`${roomId}:${idx}`] = true;
          this.persist();
          this.notesDirty = true;
        }
      }

      // Llave (para que el HUD/diario se entere)
      if (p.keys !== this.lastKeys) { this.lastKeys = p.keys; this.itemsDirty = true; }

      // Enemigos derrotados -> Valor
      for (const e of g.enemies) {
        if (e && e.alive === false && !this.counted.has(e)) {
          this.counted.add(e);
          this.onEnemyDefeated(e);
        }
      }
    }

    onEnemyDefeated() {
      this.save.valor += 1;
      this.persist();
    }

    collect(roomId, index, c) {
      c.collected = true;
      this.save.collected[`${roomId}:${index}`] = c.item;
      this.persist();
      this.itemsDirty = true;
      const info = ITEMS[c.item] || { name: c.item };
      window.particleSystem.createDoubleJumpSparks(c.x, c.y);
      window.particleSystem.createShockwave(c.x, c.y, 34, '#ffe9a8', 3);
      const sm = window.soundManager;
      if (c.item === 'emblema') {
        if (sm && sm.playPickup) sm.playPickup();
        this.game.showNotification(`Emblema del Reino · ${this.emblemCount()}/${this.worldCount('emblema')}`);
      } else {
        if (sm && sm.playUnlockAbility) sm.playUnlockAbility();
        this.game.showNotification(`Encontraste: ${info.name} · miralo en el Diario (${this.openKeyLabel()})`);
      }
      this.selectedItem = c.item;
    }

    // ---------------- Dibujo en el mundo ----------------
    renderWorld(ctx, cam) {
      const room = this.game.world.getCurrentRoom();
      const now = Date.now();

      // Objetos flotando con brillo
      if (room.collectibles) {
        for (const c of room.collectibles) {
          if (c.collected) continue;
          const sx = c.x - cam.x;
          const sy = c.y - cam.y + Math.sin(now * 0.004 + c.x * 0.01) * 4;
          if (sx < -40 || sx > 1000) continue;
          ctx.save();
          const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, 26);
          glow.addColorStop(0, c.item === 'emblema' ? 'rgba(255, 226, 138, 0.55)' : 'rgba(255, 242, 208, 0.6)');
          glow.addColorStop(1, 'rgba(255, 226, 138, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill();
          const spin = c.item === 'emblema' ? Math.cos(now * 0.003 + c.x) : 1;
          const scaleX = c.item === 'emblema' ? (Math.abs(spin) < 0.15 ? 0.15 * Math.sign(spin || 1) : spin) : 1;
          drawIcon(ctx, c.item, sx, sy, 26, { scaleX });
          const tw = (now * 0.002 + c.x * 0.03) % 1;
          if (tw < 0.5) sparkle(ctx, sx + 11, sy - 11, 3 * Math.sin(tw * Math.PI * 2));
          ctx.restore();
        }
      }

      // Bajadas (salidas con hint 'down')
      if (room.exits) {
        const t = now * 0.003;
        for (const ex of room.exits) {
          if (!ex.hint || ex.hint.dir !== 'down') continue;
          const ax = ex.hint.x + ex.hint.w / 2 - cam.x;
          const ay = ex.y - 18 - cam.y + Math.sin(t) * 4;
          ctx.save();
          ctx.fillStyle = '#f9efd8';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ax, ay + 12); ctx.lineTo(ax + 10, ay); ctx.lineTo(ax + 4, ay); ctx.lineTo(ax + 4, ay - 10);
          ctx.lineTo(ax - 4, ay - 10); ctx.lineTo(ax - 4, ay); ctx.lineTo(ax - 10, ay); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }
    }

    // ---------------- Interfaz ----------------
    openKeyLabel() {
      const cm = this.game.controlsManager;
      if (cm && cm.getActionForKey && cm.getActionForKey('KeyI')) return 'Tab';
      return 'I';
    }

    buildUI() {
      const hud = document.getElementById('hud-overlay') || document.body;

      // Botón del HUD junto a llave / objeto en mano
      const slots = document.querySelector('.items-display');
      if (slots) {
        const btn = el('button', 'item-slot journal-hud-btn');
        btn.id = 'journal-hud-btn';
        btn.type = 'button';
        btn.title = 'Diario de Ruben: objetos, estadísticas y notas';
        btn.appendChild(iconCanvas('diario', 16));
        btn.appendChild(el('span', 'slot-text', 'Diario'));
        this.hudKey = el('span', 'journal-key', this.openKeyLabel());
        btn.appendChild(this.hudKey);
        btn.addEventListener('click', () => { if (this.isOpen()) this.close(); else this.open(); });
        slots.appendChild(btn);
        this.hudBtn = btn;
      }

      // Botón en el menú de pausa
      const actions = document.querySelector('#pause-modal .pause-actions');
      if (actions) {
        const b = el('button', 'btn-secondary', 'DIARIO DE RUBEN');
        if (window.UIIcons) b.insertAdjacentHTML('afterbegin', window.UIIcons.svg('book', 'ui-icon'));
        b.id = 'btn-pause-journal';
        b.type = 'button';
        const resume = document.getElementById('btn-pause-resume');
        if (resume && resume.nextSibling) actions.insertBefore(b, resume.nextSibling); else actions.appendChild(b);
        b.addEventListener('click', () => this.open(true));
      }

      // Ventana del diario
      const modal = el('div', 'modal-overlay hidden');
      modal.id = 'journal-modal';
      modal.innerHTML = `
        <div class="modal-card journal-card" role="dialog" aria-label="Diario de Ruben">
          <div class="journal-header">
            <div class="journal-title-wrap">
              <h2 class="modal-title">DIARIO DE RUBEN</h2>
              <p class="modal-subtitle" id="journal-subtitle"></p>
            </div>
            <button class="btn-close" id="journal-close" type="button" title="Cerrar">✕</button>
          </div>
          <div class="journal-tabs" role="tablist">
            <button class="journal-tab" type="button" data-tab="items" id="journal-tab-items">OBJETOS</button>
            <button class="journal-tab" type="button" data-tab="stats" id="journal-tab-stats">ESTADÍSTICAS</button>
            <button class="journal-tab" type="button" data-tab="notes" id="journal-tab-notes">NOTAS DE ANGELO</button>
          </div>
          <div class="journal-page" data-page="items">
            <div class="journal-items-grid" id="journal-items-grid"></div>
            <div class="journal-detail" id="journal-item-detail"></div>
          </div>
          <div class="journal-page" data-page="stats">
            <div class="journal-stats" id="journal-stats"></div>
          </div>
          <div class="journal-page" data-page="notes">
            <div class="journal-notes" id="journal-notes"></div>
          </div>
          <div class="journal-footer">
            <span><b id="journal-footer-key">I</b> o <b>Esc</b> cerrar · <b>Q</b>/<b>E</b> pestañas · ${window.UIIcons ? window.UIIcons.svg('gamepad', 'ui-inline') : ''} <b>A</b> equipar · <b>LB</b>/<b>RB</b> pestañas · <b>B</b> cerrar</span>
            <button class="journal-reset" id="journal-reset" type="button">Borrar diario</button>
          </div>
        </div>`;
      const notif = document.getElementById('notification');
      if (notif && notif.parentNode === hud) hud.insertBefore(modal, notif); else hud.appendChild(modal);
      this.modal = modal;

      modal.querySelector('#journal-close').addEventListener('click', () => this.close());
      modal.addEventListener('mousedown', (e) => { if (e.target === modal) this.close(); });
      modal.querySelectorAll('.journal-tab').forEach(t => {
        t.addEventListener('click', () => this.setTab(t.dataset.tab));
      });
      const reset = modal.querySelector('#journal-reset');
      reset.addEventListener('click', () => {
        if (Date.now() < this.resetArmed) { this.resetAll(); reset.textContent = 'Borrar diario'; this.resetArmed = 0; return; }
        this.resetArmed = Date.now() + 3000;
        reset.textContent = '¿Seguro? Tocá otra vez';
        setTimeout(() => { if (Date.now() >= this.resetArmed) reset.textContent = 'Borrar diario'; }, 3100);
      });
    }

    isOpen() { return !!this.modal && !this.modal.classList.contains('hidden'); }

    open(fromPause = false) {
      const g = this.game;
      if (!g.isPlaying || g.deathTimer > 0 || this.isOpen()) return;
      if (g.controlsManager && g.controlsManager.isModalOpen && g.controlsManager.isModalOpen()) return;
      this.openedFromPause = fromPause || g.isPaused;
      const pause = document.getElementById('pause-modal');
      if (pause) pause.classList.add('hidden');
      g.isPaused = true;
      g.keys = {};
      this.renderAll();
      this.modal.classList.remove('hidden');
      if (window.soundManager && window.soundManager.playPickup) try { window.soundManager.playPickup(); } catch (e) { /* */ }
    }

    close(returnToPause = true) {
      if (!this.isOpen()) return;
      const g = this.game;
      this.modal.classList.add('hidden');
      g.keys = {};
      if (this.openedFromPause && returnToPause) {
        const pause = document.getElementById('pause-modal');
        if (pause) pause.classList.remove('hidden');
        g.isPaused = true;
      } else {
        g.isPaused = false;
        const pause = document.getElementById('pause-modal');
        if (pause) pause.classList.add('hidden');
      }
      if (document.activeElement && this.modal.contains(document.activeElement)) document.activeElement.blur();
      this.refreshHud();
    }

    setTab(tab) {
      this.tab = tab;
      this.modal.querySelectorAll('.journal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      this.modal.querySelectorAll('.journal-page').forEach(p => p.classList.toggle('hidden', p.dataset.page !== tab));
      if (tab === 'items') this.renderItems();
      if (tab === 'stats') this.renderStats();
      if (tab === 'notes') this.renderNotes();
      const nav = this.game.menuNav;
      if (nav) { nav.clearHighlight(); nav.focused = null; }
    }
    cycleTab(dir) {
      const order = ['items', 'stats', 'notes'];
      const i = (order.indexOf(this.tab) + dir + order.length) % order.length;
      this.setTab(order[i]);
      if (window.soundManager && window.soundManager.playJump) try { window.soundManager.playJump(); } catch (e) { /* */ }
    }

    renderAll() {
      this.refreshHeader();
      this.setTab(this.tab);
    }

    refreshHeader() {
      if (!this.modal) return;
      this.modal.querySelector('#journal-subtitle').textContent =
        `EMBLEMAS ${this.emblemCount()}/${this.worldCount('emblema')} · VALOR ${this.save.valor}`;
      const fk = this.modal.querySelector('#journal-footer-key');
      if (fk) fk.textContent = this.openKeyLabel();
    }

    refreshHud() {
      if (this.hudKey) this.hudKey.textContent = this.openKeyLabel();
    }

    renderItems() {
      const grid = this.modal.querySelector('#journal-items-grid');
      grid.innerHTML = '';
      // Solo se muestran los objetos ya conseguidos: nada revela cuántos faltan
      const ownedIds = ITEM_ORDER.filter(id => this.ownsItem(id));
      if (!ownedIds.includes(this.selectedItem)) this.selectedItem = ownedIds[0] || null;
      for (const id of ownedIds) {
        const info = ITEMS[id];
        const b = el('button', 'journal-slot owned' + (id === this.selectedItem ? ' selected' : ''));
        b.type = 'button';
        b.appendChild(iconCanvas(id, 40));
        if (info.stack) {
          b.appendChild(el('span', 'journal-slot-count', `${this.itemCount(id)}`));
        }
        b.title = info.name;
        const select = () => {
          this.selectedItem = id;
          grid.querySelectorAll('.journal-slot').forEach(s => s.classList.remove('selected'));
          b.classList.add('selected');
          this.renderItemDetail();
        };
        b.addEventListener('click', select);
        b.addEventListener('focus', select);
        b.addEventListener('mouseenter', select);
        grid.appendChild(b);
      }
      const foot = el('div', 'journal-grid-foot', ownedIds.length
        ? `Objetos encontrados: ${ownedIds.length}`
        : 'Todavía no encontraste ningún objeto.');
      grid.appendChild(foot);
      this.renderItemDetail();
      this.itemsDirty = false;
    }

    renderItemDetail() {
      const box = this.modal.querySelector('#journal-item-detail');
      const id = this.selectedItem;
      box.innerHTML = '';
      if (!id || !this.ownsItem(id)) {
        box.appendChild(el('p', 'journal-detail-desc', 'Las notas de Angelo dan pistas de dónde buscar.'));
        return;
      }
      const info = ITEMS[id];
      const frame = el('div', 'journal-detail-frame');
      frame.appendChild(iconCanvas(id, 88));
      box.appendChild(frame);
      box.appendChild(el('div', 'journal-detail-kind', info.kind));
      box.appendChild(el('h3', 'journal-detail-name', info.name));
      box.appendChild(el('p', 'journal-detail-desc', info.desc));
      const where = this.whereFound(id);
      let meta = where ? `Encontrado en: ${where}` : '';
      if (info.stack) meta = `Tenés ${this.itemCount(id)}` + (where ? ` · el primero, en ${where}` : '');
      if (meta) box.appendChild(el('div', 'journal-detail-meta', meta));
    }

    // Gráfico de radar de las 4 estadísticas: cada eje es una estadística y el nivel
    // (0 a STAT_MAX) indica qué tan lejos del centro llega la forma. Al inicio todas están en 0.
    statRadar() {
      const cx = 130, cy = 112, R = 70, labelR = R + 22;
      const f = n => n.toFixed(1);
      const pt = (i, frac) => {
        const a = -Math.PI / 2 + i * (Math.PI / 2); // eje 0 arriba, luego sentido horario
        return [cx + Math.cos(a) * R * frac, cy + Math.sin(a) * R * frac];
      };
      // Patrón rayado para la zona pendiente (lo que aún no se entrena)
      let svg = '<defs><pattern id="radar-hatch" patternUnits="userSpaceOnUse" width="6" height="6">' +
        '<rect width="6" height="6" fill="#fffaf0"/>' +
        '<path d="M0,6 L6,0 M-3,3 L3,-3 M3,9 L9,3" stroke="#4a6fa5" stroke-width="1.3"/>' +
        '</pattern></defs>';
      // Anillos decorativos sin números: no revelan el tope
      for (let ring = 1; ring <= 4; ring++) {
        const pts = STAT_ORDER.map((_, i) => pt(i, ring / 4).map(f).join(',')).join(' ');
        svg += `<polygon class="radar-ring" points="${pts}"/>`;
      }
      // Zona pendiente: el máximo en cada eje, rayada en azul (lo que falta por entrenar)
      const maxPts = STAT_ORDER.map((_, i) => pt(i, 1).map(f).join(',')).join(' ');
      svg += `<polygon class="radar-pending" points="${maxPts}"/>`;
      STAT_ORDER.forEach((_, i) => {
        const [x, y] = pt(i, 1);
        svg += `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${f(x)}" y2="${f(y)}"/>`;
      });
      // Zona entrenada: sólida en naranja fuerte, encima de la zona pendiente
      const shape = STAT_ORDER.map((id, i) => pt(i, this.statLevel(id) / STAT_MAX).map(f).join(',')).join(' ');
      svg += `<polygon class="radar-shape" points="${shape}"/>`;
      STAT_ORDER.forEach((id, i) => {
        const lvl = this.statLevel(id);
        if (lvl > 0) {
          const [x, y] = pt(i, lvl / STAT_MAX);
          svg += `<circle class="radar-dot stat-${id}" cx="${f(x)}" cy="${f(y)}" r="3.5"/>`;
        }
        const [lx, ly] = pt(i, labelR / R);
        const anchor = i === 1 ? 'start' : (i === 3 ? 'end' : 'middle');
        svg += `<text class="radar-label" x="${f(lx)}" y="${f(ly)}" text-anchor="${anchor}">${STATS[id].short}</text>`;
        svg += `<text class="radar-level" x="${f(lx)}" y="${f(ly + 12)}" text-anchor="${anchor}">${lvl}</text>`;
      });
      const wrap = el('div', 'stat-radar-wrap');
      wrap.innerHTML = `<svg class="stat-radar" viewBox="0 0 260 232" role="img" ` +
        `aria-label="Gráfico de radar de las estadísticas de Ruben">${svg}</svg>` +
        `<div class="stat-radar-legend"><span class="lg-trained">Entrenado</span>` +
        `<span class="lg-pending">Por entrenar</span></div>`;
      return wrap;
    }

    // Pestaña ESTADÍSTICAS: las 4 estadísticas de Ruben (radar + filas de texto) y los objetos equipados
    renderStats() {
      const box = this.modal.querySelector('#journal-stats');
      box.innerHTML = '';

      const sec = el('div', 'stats-section');
      sec.appendChild(el('div', 'stats-title', 'RUBEN'));
      sec.appendChild(this.statRadar());
      for (const id of STAT_ORDER) {
        const row = el('div', 'stat-row stat-' + id);
        const head = el('div', 'stat-head');
        head.appendChild(el('span', 'stat-name', STATS[id].name));
        head.appendChild(el('span', 'stat-value', this.statText(id)));
        row.appendChild(head);
        const eb = this.equipBonus(id);
        const meta = `Nivel ${this.statLevel(id)}` + (eb ?` · equipo +${Math.round(eb * 100)}%` : '') +
          ` · Entrenan: ${this.trainersOf(id)}`;
        row.appendChild(el('div', 'stat-meta', meta));
        sec.appendChild(row);
      }
      box.appendChild(sec);

      const eq = el('div', 'stats-section');
      eq.appendChild(el('div', 'stats-title', `OBJETOS EQUIPADOS · ${this.save.equipped.length}/${EQUIP_SLOTS}`));
      const list = el('div', 'stats-equip-list');
      for (const id of Object.keys(EQUIP)) {
        const info = ITEMS[id];
        if (!this.ownsItem(id)) continue; // los no conseguidos no se muestran
        const on = this.save.equipped.includes(id);
        const b = el('button', 'stat-equip' + (on ? ' equipped' : ''));
        b.type = 'button';
        b.dataset.item = id;
        b.appendChild(iconCanvas(id, 32));
        const txt = el('span', 'stat-equip-text');
        txt.appendChild(el('span', 'stat-equip-name', info.name));
        txt.appendChild(el('span', 'stat-equip-desc',
          `${STATS[EQUIP[id].stat].name} +${Math.round(EQUIP[id].bonus * 100)}%`));
        b.appendChild(txt);
        b.appendChild(el('span', 'stat-equip-state', on ? 'EQUIPADO' : 'Equipar'));
        b.addEventListener('click', () => this.toggleEquip(id));
        list.appendChild(b);
      }
      eq.appendChild(list);
      box.appendChild(eq);

      box.appendChild(el('p', 'stats-foot',
        'Los maestros entrenan en persona: hablá con ellos cuando terminen sus líneas. Cada charla sube una estadística.'));
    }

    renderNotes() {
      const list = this.modal.querySelector('#journal-notes');
      list.innerHTML = '';
      let total = 0, found = 0;
      const entries = [];
      this.game.world.rooms.forEach((room, rid) => {
        if (!room || !room.tablets) return;
        room.tablets.forEach((tab, i) => {
          total++;
          if (this.save.notes[`${rid}:${i}`]) { found++; entries.push({ room, tab }); }
        });
      });
      list.appendChild(el('div', 'journal-notes-count', `Notas encontradas: ${found} de ${total}`));
      if (!entries.length) {
        list.appendChild(el('p', 'journal-notes-empty', 'Todavía no leíste ninguna nota. Pasá por encima de los pergaminos con sello rojo.'));
      }
      for (const { room, tab } of entries) {
        const card = el('article', 'journal-note');
        const head = el('div', 'journal-note-head');
        head.appendChild(el('span', 'journal-note-speaker', tab.speaker));
        head.appendChild(el('span', 'journal-note-room', room.name));
        card.appendChild(head);
        card.appendChild(el('p', 'journal-note-text', tab.text));
        list.appendChild(card);
      }
      this.notesDirty = false;
    }

    resetAll() {
      this.save = emptySave();
      this.persist();
      this.syncRoomsWithSave();
      this.applyPassives();
      this.renderAll();
      this.refreshHud();
      this.game.showNotification('El diario quedó en blanco');
    }

    // ---------------- Mando ----------------
    hookMenuNav() {
      const nav = this.game.menuNav;
      if (!nav) return;
      nav.defaults['journal-modal'] = 'journal-tab-items';
      const origGet = nav.getActiveMenu.bind(nav);
      nav.getActiveMenu = () => (this.isOpen() ? this.modal : origGet());
      const origHandle = nav.handlePad.bind(nav);
      nav.handlePad = (pressed, prev) => {
        const just = (i) => pressed[i] && !prev[i];
        if (this.isOpen()) {
          if (just(1)) { this.close(); return true; }
          if (just(8)) { this.close(); return true; }
          if (just(9)) { this.close(false); return true; }
          if (just(4)) { this.cycleTab(-1); return true; }
          if (just(5)) { this.cycleTab(1); return true; }
          return origHandle(pressed, prev);
        }
        const g = this.game;
        const menuVisible = !!origGet();
        if (!menuVisible && g.isPlaying && !g.isPaused && g.deathTimer <= 0 && just(8)) {
          this.open();
          return true;
        }
        return origHandle(pressed, prev);
      };
    }

    // ---------------- Teclado ----------------
    setupKeys() {
      window.addEventListener('keydown', (e) => {
        const g = this.game;
        const cm = g.controlsManager;
        if (cm && cm.isListening && cm.isListening()) return;
        const boundElsewhere = cm && cm.getActionForKey && cm.getActionForKey(e.code);
        const isToggle = (e.code === 'KeyI' || e.code === 'Tab') && !boundElsewhere;

        if (this.isOpen()) {
          e.stopImmediatePropagation();
          if (e.code === 'Escape' || isToggle) { e.preventDefault(); this.close(); return; }
          if (e.code === 'KeyQ') { e.preventDefault(); this.cycleTab(-1); return; }
          if (e.code === 'KeyE') { e.preventDefault(); this.cycleTab(1); return; }
          const dirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
          const nav = g.menuNav;
          if (dirs[e.code] && nav) {
            e.preventDefault();
            nav.activeId = 'journal-modal';
            if (!nav.focused || !this.modal.contains(nav.focused)) nav.ensureFocus(this.modal);
            else nav.move(this.modal, dirs[e.code]);
            return;
          }
          if ((e.code === 'Enter' || e.code === 'Space') && document.activeElement && this.modal.contains(document.activeElement)) {
            e.preventDefault();
            document.activeElement.click();
            return;
          }
          if (e.code === 'Space' || e.code === 'Enter') e.preventDefault();
          return;
        }

        if (isToggle && !e.repeat && g.isPlaying && !g.isPaused && g.deathTimer <= 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.open();
        }
      }, true);
    }
  }

  window.JournalData = { ITEMS, ITEM_ORDER, STATS, STAT_ORDER, EQUIP, drawIcon };
  window.GameHooks = window.GameHooks || { onInit: [], onRoomLoad: [], onUpdate: [], onRenderWorld: [], onAction: [] };
  window.GameHooks.onInit = window.GameHooks.onInit || [];
  window.GameHooks.onRenderWorld = window.GameHooks.onRenderWorld || [];
  // "Reiniciar juego" (menú de pausa): el diario vuelve a empezar en blanco
  window.GameHooks.onRestartGame = window.GameHooks.onRestartGame || [];
  window.GameHooks.onRestartGame.push((game) => {
    const j = game.journal;
    if (!j) return;
    j.save = emptySave();
    j.persist();
    j.syncRoomsWithSave();
    j.applyPassives();
    j.refreshHud();
    if (window.BgContinuity) window.BgContinuity.reset();
  });
  window.GameHooks.onInit.push((game) => {
    try {
      game.journal = new Journal(game);
    } catch (e) {
      console.error('[Diario] no se pudo iniciar:', e);
    }
  });
})();
