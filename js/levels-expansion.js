/**
 * Expansión de Niveles - Ruben: En Busca de Angelo (Claude)
 *
 * Salas nuevas 4 a 10 registradas vía window.PendingRooms (sin tocar world.js):
 *   4  Claro de las Luciérnagas   (bosque)
 *   5  Raíces del Roble Viejo     (bosque)   muro de raíces quebradizo + subida por las ramas
 *   6  Senda de la Montaña Gris   (montana)
 *   7  Cornisa del Viento Helado  (montana)  saltos de cornisa en cornisa sobre el abismo
 *   8  Puente del Paso Helado     (montana)  rastrillo oxidado quebradizo
 *   9  Murallas del Castillo      (castillo) foso
 *   10 Salón del Trono Olvidado   (castillo) final provisorio de la expansión
 *
 * Todas usan el mismo motor de fondos pintados (CodeArt) y su paralaje; además
 * js/bg-continuity.js empalma el fondo de cada sala con el de la anterior.
 *
 * `collectibles: [{ item, x, y }]` -> objetos del Diario (js/journal.js). x, y = centro.
 * `hint: { dir: 'down', x, w }` en una salida -> flecha hacia abajo (la dibuja journal.js).
 *
 * Además, en GameHooks.onInit se parchean las salas 0-3 de world.js:
 *   - sala 3 (Bosque de los Susurros): se quita el muro derecho y se agrega la salida a la sala 4.
 *   - salas 0, 2 y 3: un Emblema del Reino escondido en cada una.
 */
(function () {
  'use strict';

  window.PendingRooms = window.PendingRooms || [];
  const R = (cfg) => window.PendingRooms.push(cfg);

  // Atajos de geometría (suelo en y = 460, techo en y = 0)
  const ground = (x, w) => ({ x, y: 460, w, h: 80, type: 'ground' });
  const ceiling = (x, w) => ({ x, y: 0, w, h: 20, type: 'ceiling' });
  const wall = (x) => ({ x, y: 0, w: 30, h: 540, type: 'wall' });
  const ruin = (x, y, w, h = 22) => ({ x, y, w, h, type: 'ruins' });
  // Enemigo caminante parado sobre una superficie de altura `top`
  const crawler = (x, top, patrol) => new CrawlerEnemy(x, top - 24, patrol);
  const stone = (x, top) => new ThrowableDebris(x, top - 18);

  // ==========================================================
  // SALA 4: Claro de las Luciérnagas (bosque)
  // ==========================================================
  R({
    id: 4,
    name: 'CLARO DE LAS LUCIÉRNAGAS',
    biome: 'bosque',
    width: 1760,
    height: 540,
    platforms: [
      ground(0, 560), ground(700, 460), ground(1300, 460),
      ceiling(0, 1760),
      ruin(200, 360, 140), ruin(380, 270, 120),
      ruin(760, 350, 160), ruin(960, 260, 150),
      ruin(1180, 160, 120),               // rama alta (emblema)
      ruin(1200, 395, 60, 20),            // tocón sobre el segundo barranco
      ruin(1420, 340, 160)
    ],
    tablets: [
      {
        x: 300, y: 415,
        speaker: 'Nota de Angelo',
        text: '«El bosque se abre en un claro lleno de luciérnagas. Dormí acá una noche. Si encontrás mi pañuelo, guardalo: me lo bordó mamá. — A.»'
      }
    ],
    collectibles: [
      { item: 'panuelo', x: 1035, y: 224 },
      { item: 'emblema', x: 1240, y: 124 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 3, targetX: 1190, targetY: 410 },
      { x: 1720, y: 340, w: 40, h: 120, targetRoom: 5, targetX: 60, targetY: 410 }
    ],
    spawnEnemies: () => [
      crawler(240, 460, 110),
      crawler(900, 460, 140),
      new FlyingShadeEnemy(620, 230),
      new FlyingShadeEnemy(1350, 190),
      crawler(1500, 460, 120)
    ],
    spawnDebris: () => [stone(150, 460), stone(820, 460)]
  });

  // ==========================================================
  // SALA 5: Raíces del Roble Viejo (bosque)
  // ==========================================================
  R({
    id: 5,
    name: 'RAÍCES DEL ROBLE VIEJO',
    biome: 'bosque',
    width: 1440,
    height: 540,
    platforms: [
      ground(0, 1440),
      ceiling(0, 1180), ceiling(1300, 140),   // hueco entre las copas (x 1180-1300)
      wall(1410),
      ruin(220, 360, 140), ruin(460, 280, 140), ruin(680, 200, 120),
      // Subida por las ramas del roble, al otro lado del muro de raíces
      ruin(1000, 380, 120), ruin(1300, 300, 110), ruin(1040, 220, 110),
      ruin(1160, 140, 160)
    ],
    breakables: [
      { x: 900, y: 20, w: 34, h: 440, broken: false }   // muro de raíces: se quiebra con una piedra
    ],
    tablets: [
      {
        x: 790, y: 415,
        speaker: 'Nota de Angelo',
        text: '«Las raíces del roble viejo taparon el sendero y la espada no las corta. Pero una piedra bien lanzada las quiebra. Del otro lado, trepá por las ramas: arriba sigue el camino a la montaña. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 740, y: 164 },
      { item: 'mapa', x: 1355, y: 264 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 4, targetX: 1680, targetY: 410 },
      // Pasaje hacia arriba por el hueco de las copas (igual que la sala 1)
      { x: 0, y: -400, w: 1440, h: 390, targetRoom: 6, targetX: 120, targetY: 410,
        hint: { dir: 'up', x: 1180, w: 120 } }
    ],
    spawnEnemies: () => [
      crawler(300, 460, 150),
      new FlyingShadeEnemy(560, 200),
      crawler(1150, 460, 120),
      new FlyingShadeEnemy(1220, 250)
    ],
    spawnDebris: () => [stone(140, 460), stone(520, 460), stone(700, 460), stone(260, 360)]
  });

  // ==========================================================
  // SALA 6: Senda de la Montaña Gris (montana)
  // ==========================================================
  R({
    id: 6,
    name: 'SENDA DE LA MONTAÑA GRIS',
    biome: 'montana',
    width: 1600,
    height: 540,
    platforms: [
      ground(0, 700), ground(860, 740),
      ceiling(0, 1600),
      wall(0),
      ruin(300, 370, 130), ruin(500, 290, 120),
      ruin(745, 365, 70, 20),            // piedra suelta sobre la grieta
      ruin(980, 300, 160), ruin(1200, 220, 140), ruin(1400, 330, 130)
    ],
    tablets: [
      {
        x: 200, y: 415,
        speaker: 'Nota de Angelo',
        text: '«La Montaña Gris. Desde acá arriba se ve el castillo, nuestro viejo hogar. La brújula de papá apunta siempre hacia él. Ojo con las grietas, Ruben: la nieve esconde el borde. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 560, y: 254 },
      { item: 'brujula', x: 1270, y: 184 }
    ],
    exits: [
      // Bajada de vuelta a las ramas del roble
      { x: 40, y: 400, w: 60, h: 60, targetRoom: 5, targetX: 1220, targetY: 96,
        hint: { dir: 'down', x: 40, w: 60 } },
      { x: 1560, y: 340, w: 40, h: 120, targetRoom: 7, targetX: 60, targetY: 410 }
    ],
    spawnEnemies: () => [
      crawler(420, 460, 130),
      new FlyingShadeEnemy(640, 210),
      crawler(1040, 300, 50),
      crawler(1250, 460, 160),
      new FlyingShadeEnemy(1380, 200)
    ],
    spawnDebris: () => [stone(260, 460), stone(1000, 460)]
  });

  // ==========================================================
  // SALA 7: Cornisa del Viento Helado (montana)
  // ==========================================================
  R({
    id: 7,
    name: 'CORNISA DEL VIENTO HELADO',
    biome: 'montana',
    width: 1920,
    height: 540,
    platforms: [
      ground(0, 360), ground(1560, 360),
      ceiling(0, 1920),
      // Cornisas sobre el abismo
      ruin(440, 400, 120), ruin(640, 340, 110), ruin(830, 400, 120),
      ruin(1030, 320, 120), ruin(1230, 390, 110), ruin(1400, 330, 110),
      // Saliente alto (emblema)
      ruin(900, 200, 120), ruin(1120, 160, 100)
    ],
    tablets: [
      {
        x: 180, y: 415,
        speaker: 'Nota de Angelo',
        text: '«La cornisa es angosta y el abismo no perdona. Saltá de piedra en piedra y no mires abajo. Yo crucé de noche, con la campanilla de plata sonando para no perderme... creo que se me cayó más adelante. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 960, y: 164 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 6, targetX: 1520, targetY: 410 },
      { x: 1880, y: 340, w: 40, h: 120, targetRoom: 8, targetX: 60, targetY: 410 }
    ],
    spawnEnemies: () => [
      new FlyingShadeEnemy(560, 250),
      new FlyingShadeEnemy(1000, 230),
      crawler(1060, 320, 40),
      new FlyingShadeEnemy(1380, 240),
      crawler(1700, 460, 120)
    ],
    spawnDebris: () => [stone(250, 460)]
  });

  // ==========================================================
  // SALA 8: Puente del Paso Helado (montana)
  // ==========================================================
  R({
    id: 8,
    name: 'PUENTE DEL PASO HELADO',
    biome: 'montana',
    width: 1600,
    height: 540,
    platforms: [
      ground(0, 1600),
      ceiling(0, 1600),
      ruin(250, 360, 150), ruin(520, 290, 140), ruin(780, 220, 140), ruin(1020, 320, 150)
    ],
    breakables: [
      { x: 1300, y: 20, w: 30, h: 440, broken: false }   // rastrillo oxidado
    ],
    tablets: [
      {
        x: 150, y: 415,
        speaker: 'Nota de Angelo',
        text: '«Un rastrillo oxidado cierra el puente. Lo trabé yo mismo para que nadie me siguiera... salvo vos. Ya sabés qué hacer con las piedras. — A.»'
      }
    ],
    collectibles: [
      { item: 'campanilla', x: 850, y: 184 },
      { item: 'emblema', x: 1460, y: 424 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 7, targetX: 1840, targetY: 410 },
      { x: 1560, y: 340, w: 40, h: 120, targetRoom: 9, targetX: 60, targetY: 410 }
    ],
    spawnEnemies: () => [
      crawler(420, 460, 140),
      new FlyingShadeEnemy(660, 200),
      crawler(1080, 320, 50),
      new FlyingShadeEnemy(1150, 220),
      crawler(1440, 460, 80)
    ],
    spawnDebris: () => [stone(300, 360), stone(620, 460), stone(1120, 460), stone(950, 460)]
  });

  // ==========================================================
  // SALA 9: Murallas del Castillo (castillo)
  // ==========================================================
  R({
    id: 9,
    name: 'MURALLAS DEL CASTILLO',
    biome: 'castillo',
    width: 1760,
    height: 540,
    platforms: [
      ground(0, 820), ground(980, 780),
      ceiling(0, 1760),
      ruin(200, 370, 120), ruin(380, 290, 110), ruin(560, 210, 130),
      ruin(760, 140, 120),               // almena alta (emblema)
      ruin(875, 385, 60, 20),            // escalón sobre el foso
      ruin(1100, 350, 150), ruin(1320, 270, 150), ruin(1520, 350, 130)
    ],
    tablets: [
      {
        x: 120, y: 415,
        speaker: 'Nota de Angelo',
        text: '«Las murallas siguen en pie, aunque el reino cayó. Entré por la brecha del foso. Cuidado, Ruben: adentro hay bichos con los colores de la vieja guardia. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 820, y: 104 },
      { item: 'retrato', x: 1395, y: 234 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 8, targetX: 1520, targetY: 410 },
      { x: 1720, y: 340, w: 40, h: 120, targetRoom: 10, targetX: 60, targetY: 410 }
    ],
    spawnEnemies: () => [
      crawler(330, 460, 140),
      new FlyingShadeEnemy(480, 200),
      crawler(640, 460, 110),
      new FlyingShadeEnemy(900, 260),
      crawler(1160, 460, 150),
      new FlyingShadeEnemy(1450, 190),
      crawler(1380, 270, 50)
    ],
    spawnDebris: () => [stone(240, 460), stone(1050, 460), stone(1600, 460)]
  });

  // ==========================================================
  // SALA 10: Salón del Trono Olvidado (castillo)
  // ==========================================================
  R({
    id: 10,
    name: 'SALÓN DEL TRONO OLVIDADO',
    biome: 'castillo',
    width: 1440,
    height: 540,
    platforms: [
      ground(0, 1440),
      ceiling(0, 1440),
      wall(1410),
      ruin(240, 360, 140), ruin(520, 280, 160), ruin(820, 280, 160), ruin(1100, 360, 140),
      ruin(640, 170, 160)                // palco del trono
    ],
    tablets: [
      {
        x: 1220, y: 415,
        speaker: 'Carta de Angelo',
        text: '«Ruben: el trono está vacío, pero el sello del reino seguía acá. Te lo dejé arriba, como prueba de quiénes somos. Yo sigo hacia la torre del este: ahí está la respuesta. No tardes. — A.»'
      },
      {
        x: 300, y: 315,
        speaker: 'Inscripción en la pared',
        text: '«Aquí se juró defender el reino con ingenio y no solo con espada.»'
      }
    ],
    collectibles: [
      { item: 'sello', x: 720, y: 134 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 9, targetX: 1680, targetY: 410 }
    ],
    spawnEnemies: () => [
      crawler(400, 460, 160),
      new FlyingShadeEnemy(600, 220),
      new FlyingShadeEnemy(900, 200),
      crawler(960, 460, 160),
      new FlyingShadeEnemy(1200, 250)
    ],
    spawnDebris: () => [stone(180, 460), stone(1300, 460)]
  });

  // ==========================================================
  // Parches a las salas originales (world.js) sin editar ese archivo
  // ==========================================================
  function patchOriginalRooms(world) {
    const rooms = world.rooms;
    const addCollectible = (id, c) => {
      const r = rooms[id];
      if (!r) return;
      r.collectibles = r.collectibles || [];
      if (!r.collectibles.some(o => o.item === c.item && o.x === c.x && o.y === c.y)) r.collectibles.push(c);
    };

    // Sala 3: abrir el bosque hacia el Claro de las Luciérnagas
    const r3 = rooms[3];
    if (r3 && rooms[4] && !r3.exits.some(e => e.targetRoom === 4)) {
      r3.platforms = r3.platforms.filter(p => !(p.type === 'wall' && p.x >= r3.width - 40));
      r3.exits.push({ x: r3.width - 40, y: 340, w: 40, h: 120, targetRoom: 4, targetX: 60, targetY: 410 });
    }

    // Emblemas escondidos en la primera zona
    addCollectible(0, { item: 'emblema', x: 1050, y: 234 });  // ruina alta del extremo derecho
    addCollectible(2, { item: 'emblema', x: 680, y: 184 });   // a mitad de la subida al molino
    addCollectible(3, { item: 'emblema', x: 340, y: 324 });   // rama baja del bosque
  }

  window.GameHooks = window.GameHooks || { onInit: [], onRoomLoad: [], onUpdate: [], onRenderWorld: [], onAction: [] };
  window.GameHooks.onInit = window.GameHooks.onInit || [];
  window.GameHooks.onInit.push((game) => patchOriginalRooms(game.world));
  // "Reiniciar juego" crea un World nuevo: volver a aplicar los parches de las salas 0-3
  window.GameHooks.onRestartGame = window.GameHooks.onRestartGame || [];
  window.GameHooks.onRestartGame.push((game) => patchOriginalRooms(game.world));
  window.LevelsExpansion = { patchOriginalRooms };
})();
