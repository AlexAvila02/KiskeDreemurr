/**
 * La Torre del Este - Ruben: En Busca de Angelo (Claude, 21/11)
 *
 * La carta del Salón del Trono (sala 10) dice que Angelo siguió "hacia la torre del este".
 * Este archivo abre ese camino sin tocar world.js ni levels-expansion.js:
 *
 *   10 Salón del Trono  ──(puerta tapiada: se rompe con una piedra)──►
 *   16 Galería de los Estandartes  (castillo)  dos fosos que dan a los abismos
 *   17 Pie de la Torre del Este    (castillo)  hueco del techo ▲
 *   18 Escalera Derrumbada         (castillo)  hueco del suelo ▼ / hueco del techo ▲
 *   19 Cima de la Torre            (castillo)  hueco del suelo ▼, brisa, Catalejo de Angelo
 *
 * Los pisos de la torre se unen igual que el Portón Norte y el Molino (salas 1 y 2):
 * se sube saltando por un hueco del techo (salida `hint: 'up'`) y se llega con la
 * animación de llegada de levels-expansion.js (la sala de arriba tiene un hueco 'down').
 *
 * Parche a la sala 10 (en onInit y onRestartGame): la pared derecha pasa a ser un muro
 * quebradizo (`breakables`) con la salida a la sala 16 detrás.
 */
(function () {
  'use strict';

  window.PendingRooms = window.PendingRooms || [];
  const R = (cfg) => window.PendingRooms.push(cfg);

  // Atajos de geometría (iguales a levels-expansion.js: suelo en y = 460, techo en y = 0)
  const ground = (x, w) => ({ x, y: 460, w, h: 80, type: 'ground' });
  const ceiling = (x, w) => ({ x, y: 0, w, h: 20, type: 'ceiling' });
  const wall = (x) => ({ x, y: 0, w: 30, h: 540, type: 'wall' });
  const ruin = (x, y, w, h = 22) => ({ x, y, w, h, type: 'ruins' });
  const crawler = (x, top, patrol) => new CrawlerEnemy(x, top - 24, patrol);
  const stone = (x, top) => new ThrowableDebris(x, top - 18);
  const shade = (x, y) => new FlyingShadeEnemy(x, y);

  // ==========================================================
  // SALA 16: Galería de los Estandartes (castillo)
  // ==========================================================
  R({
    id: 16,
    name: 'GALERÍA DE LOS ESTANDARTES',
    biome: 'castillo',
    width: 1920,
    height: 540,
    platforms: [
      // Dos fosos en el piso (x 620-780 y 1300-1440): caer lleva a los abismos
      ground(0, 620), ground(780, 520), ground(1440, 480),
      ceiling(0, 1920),
      ruin(200, 360, 140), ruin(400, 280, 120),
      ruin(665, 365, 70, 20),            // capitel caído sobre el primer foso
      ruin(900, 340, 150), ruin(1100, 260, 140),
      ruin(1260, 150, 110),              // viga alta (emblema)
      ruin(1340, 370, 60, 20),           // capitel sobre el segundo foso
      ruin(1560, 340, 150)
    ],
    tablets: [
      {
        x: 300, y: 415,
        speaker: 'Inscripción en la pared',
        text: '«Galería de los Estandartes. Cada bandera es una familia que juró proteger el reino. Mientras una siga en pie, el reino no ha caído.»'
      },
      {
        x: 1690, y: 415,
        speaker: 'Nota de Angelo',
        text: '«Nuestra bandera sigue colgada: la roja con la torre. Papá decía que la torre del este fue lo primero que se construyó y lo último que se rindió. Ahí voy. Cuidado con los fosos: el piso se hundió hasta las grutas. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 1315, y: 114 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 10, targetX: 1320, targetY: 410 },
      { x: 1880, y: 340, w: 40, h: 120, targetRoom: 17, targetX: 60, targetY: 410 }
    ],
    spawnEnemies: () => [
      crawler(300, 460, 120),
      shade(520, 220),
      crawler(960, 460, 140),
      crawler(1160, 260, 45),
      shade(1240, 270),
      crawler(1600, 460, 120),
      shade(1760, 200)
    ],
    spawnDebris: () => [stone(150, 460), stone(1000, 460), stone(1500, 460)]
  });

  // ==========================================================
  // SALA 17: Pie de la Torre del Este (castillo) — hueco del techo (x 900-1030)
  // ==========================================================
  R({
    id: 17,
    name: 'PIE DE LA TORRE DEL ESTE',
    biome: 'castillo',
    width: 1280,
    height: 540,
    platforms: [
      ground(0, 1280),
      ceiling(0, 900), ceiling(1030, 250),
      wall(1250),
      // Escalones hasta la viga bajo el hueco
      ruin(250, 370, 130), ruin(450, 300, 110), ruin(640, 225, 110),
      ruin(860, 140, 200),               // viga bajo el hueco (aterrizaje al bajar y salto para subir)
      ruin(1100, 320, 120)               // repisa del rincón (emblema)
    ],
    tablets: [
      {
        x: 150, y: 415,
        speaker: 'Nota de Angelo',
        text: '«La escalera de la torre se derrumbó hace años. Para subir hay que ir de piso en piso por los huecos del techo: trepá hasta la viga y saltá con todo. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 1160, y: 284 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 16, targetX: 1840, targetY: 410 },
      // Pasaje hacia arriba (toda la franja sobre el techo, como en la sala 1)
      { x: 0, y: -400, w: 1280, h: 390, targetRoom: 18, targetX: 145, targetY: 410,
        hint: { dir: 'up', x: 900, w: 130 } }
    ],
    spawnEnemies: () => [
      crawler(330, 460, 120),
      shade(700, 210),
      crawler(1000, 460, 100),
      shade(1120, 230)
    ],
    spawnDebris: () => [stone(200, 460), stone(1180, 460)]
  });

  // ==========================================================
  // SALA 18: Escalera Derrumbada (castillo)
  // hueco del suelo (x 30-130) ▼ a la sala 17 · hueco del techo (x 1080-1200) ▲ a la 19
  // ==========================================================
  R({
    id: 18,
    name: 'ESCALERA DERRUMBADA',
    biome: 'castillo',
    width: 1280,
    height: 540,
    platforms: [
      ground(130, 1150),
      ceiling(0, 1080), ceiling(1200, 80),
      wall(0), wall(1250),
      // Zigzag de la escalera rota
      ruin(250, 380, 120), ruin(430, 300, 110),
      ruin(250, 220, 110),
      ruin(460, 140, 140),               // descanso alto (emblema)
      // Restos de los peldaños hacia el hueco
      ruin(680, 230, 120), ruin(880, 190, 100),
      ruin(1060, 140, 150)               // viga bajo el hueco del techo
    ],
    tablets: [
      {
        x: 760, y: 415,
        speaker: 'Nota de Angelo',
        text: '«Acá arriba anidan las polillas de la guardia. Si te rodean, jalá el aire y mareálas. Falta poco para la cima. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 530, y: 104 }
    ],
    exits: [
      // Dejarse caer por el hueco del suelo → la viga bajo el hueco de la sala 17
      { x: 30, y: 470, w: 100, h: 80, targetRoom: 17, targetX: 945, targetY: 60,
        hint: { dir: 'down', x: 30, w: 100 } },
      { x: 0, y: -400, w: 1280, h: 390, targetRoom: 19, targetX: 145, targetY: 410,
        hint: { dir: 'up', x: 1080, w: 120 } }
    ],
    spawnEnemies: () => [
      crawler(620, 460, 150),
      shade(360, 260),
      shade(800, 170),
      crawler(1000, 460, 110),
      crawler(720, 230, 40)
    ],
    spawnDebris: () => [stone(300, 460), stone(1150, 460)]
  });

  // ==========================================================
  // SALA 19: Cima de la Torre (castillo) — hueco del suelo (x 30-130) ▼ a la sala 18
  // ==========================================================
  R({
    id: 19,
    name: 'CIMA DE LA TORRE',
    biome: 'castillo',
    ambience: 'breeze',                  // arriba sopla el viento (js/ambience.js)
    width: 1440,
    height: 540,
    platforms: [
      ground(130, 1310),
      ceiling(0, 1440),
      wall(0), wall(1410),
      ruin(300, 370, 130), ruin(520, 290, 120),
      ruin(740, 210, 120),
      ruin(960, 140, 120),               // almena más alta (catalejo)
      ruin(1150, 320, 150)
    ],
    tablets: [
      {
        x: 1260, y: 415,
        speaker: 'Carta de Angelo',
        text: '«Ruben: desde la cima se ve todo el reino. Papá subía acá a mirar los caminos. Al este, más allá de las murallas, sale humo de las canteras: alguien sigue viviendo ahí. Voy a averiguar quién. Te dejo mi catalejo en la almena más alta, para que veas lo que yo vi. — A.»'
      }
    ],
    collectibles: [
      { item: 'catalejo', x: 1020, y: 104 },
      { item: 'emblema', x: 580, y: 254 }
    ],
    exits: [
      { x: 30, y: 470, w: 100, h: 80, targetRoom: 18, targetX: 1115, targetY: 60,
        hint: { dir: 'down', x: 30, w: 100 } }
    ],
    spawnEnemies: () => [
      shade(450, 220),
      crawler(720, 460, 140),
      shade(900, 250),
      crawler(1200, 460, 100),
      shade(1250, 200)
    ],
    spawnDebris: () => [stone(250, 460), stone(1050, 460)]
  });

  // ==========================================================
  // Parche a la sala 10: la pared del fondo es una puerta tapiada que se quiebra
  // ==========================================================
  function patchThroneRoom(world) {
    const r10 = world.rooms[10];
    if (!r10 || !world.rooms[16] || r10.exits.some(e => e.targetRoom === 16)) return;
    r10.platforms = r10.platforms.filter(p => !(p.type === 'wall' && p.x >= r10.width - 40));
    r10.breakables = r10.breakables || [];
    // Mismo formato que World.registerRoom (type/ref), así lo detecta checkBreakableImpact
    const b = { x: 1395, y: 20, w: 45, h: 440, broken: false, type: 'breakable' };
    b.ref = b;
    r10.breakables.push(b);
    r10.exits.push({ x: r10.width - 40, y: 340, w: 40, h: 120, targetRoom: 16, targetX: 60, targetY: 410 });
  }

  window.GameHooks = window.GameHooks || {};
  (window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => patchThroneRoom(game.world));
  // "Reiniciar juego" crea un World nuevo: volver a abrir la puerta tapiada
  (window.GameHooks.onRestartGame = window.GameHooks.onRestartGame || []).push((game) => patchThroneRoom(game.world));
  window.LevelsTorre = { patchThroneRoom };
})();
