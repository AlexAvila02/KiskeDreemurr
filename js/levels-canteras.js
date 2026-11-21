/**
 * Las Canteras del Este - Ruben: En Busca de Angelo (Claude, 21/11)
 *
 * Desde la Cima de la Torre (sala 19) Angelo vio humo en las canteras del este. Camino:
 *
 *   19 Cima de la Torre ──► 20 Adarve del Este (castillo)  hueco del suelo ▼
 *   21 Borde de las Canteras (montana)  hueco del techo ▲, cabaña con humo de Bruno el cantero
 *   22 Terrazas de Piedra    (montana)  dos fosos a los abismos, piedra floja (breakable)
 *   23 Fondo de la Cantera   (montana)  Maestra Greda (enseña la Tierra), boca de la mina tapada
 *                                       que se abre con la Tierra, carta de Angelo y el Cuarzo Ahumado
 *   24 Galerías de la Mina   (montana)  adentro de la mina: un barranco que solo se sube con
 *                                       pilares de roca; el Farol del Minero
 *
 * El 20 y el 21 se unen como el Molino y el Portón Norte: bajar por el hueco del suelo cae
 * sobre la viga bajo el hueco del techo; subir saltando por ese hueco hace la animación de
 * llegada de levels-expansion.js. Decorados y el cantero se dibujan en js/quarry.js.
 * La salida de la sala 19 a la 20 la agrega js/levels-torre.js.
 */
(function () {
  'use strict';

  window.PendingRooms = window.PendingRooms || [];
  const R = (cfg) => window.PendingRooms.push(cfg);

  const ground = (x, w) => ({ x, y: 460, w, h: 80, type: 'ground' });
  const ceiling = (x, w) => ({ x, y: 0, w, h: 20, type: 'ceiling' });
  const wall = (x) => ({ x, y: 0, w: 30, h: 540, type: 'wall' });
  const ruin = (x, y, w, h = 22) => ({ x, y, w, h, type: 'ruins' });
  const crawler = (x, top, patrol) => new CrawlerEnemy(x, top - 24, patrol);
  const stone = (x, top) => new ThrowableDebris(x, top - 18);
  const shade = (x, y) => new FlyingShadeEnemy(x, y);
  // Avispa (dash) y alacrán (picadura venenosa): js/enemies-plus.js
  const wasp = (x, y) => new WaspEnemy(x, y);
  const scorpion = (x, top, patrol) => new ScorpionEnemy(x, top - 22, patrol);

  // ==========================================================
  // SALA 20: Adarve del Este (castillo) — hueco del suelo (x 1470-1570) junto a la pared
  // ==========================================================
  R({
    id: 20,
    name: 'ADARVE DEL ESTE',
    biome: 'castillo',
    ambience: 'breeze',
    width: 1600,
    height: 540,
    platforms: [
      ground(0, 1470),
      ceiling(0, 1600),
      wall(1570),
      // Almenas del camino de ronda
      ruin(220, 370, 120), ruin(420, 290, 110), ruin(640, 360, 130),
      ruin(860, 280, 120), ruin(1060, 200, 110),   // torreta (emblema)
      ruin(1240, 350, 130)
    ],
    tablets: [
      {
        x: 140, y: 415,
        speaker: 'Nota de Angelo',
        text: '«El adarve termina en el viejo montacargas de la cantera. La plataforma ya no está: hay que tirarse por el pozo. Abajo hay una viga, no te asustes. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 1115, y: 164 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 19, targetX: 1340, targetY: 410 },
      // Pozo del montacargas → la viga bajo el hueco del techo de la sala 21
      { x: 1470, y: 470, w: 100, h: 80, targetRoom: 21, targetX: 172, targetY: 60,
        hint: { dir: 'down', x: 1470, w: 100 } }
    ],
    spawnEnemies: () => [
      shade(360, 220),
      crawler(560, 460, 140),
      wasp(980, 240),
      crawler(1120, 460, 120),
      shade(1320, 200)
    ],
    spawnDebris: () => [stone(300, 460), stone(1000, 460)]
  });

  // ==========================================================
  // SALA 21: Borde de las Canteras (montana) — hueco del techo (x 120-250)
  // ==========================================================
  R({
    id: 21,
    name: 'BORDE DE LAS CANTERAS',
    biome: 'montana',
    width: 1920,
    height: 540,
    platforms: [
      ground(0, 1920),
      ceiling(0, 120), ceiling(250, 1670),
      wall(0),
      ruin(100, 140, 180),               // viga del montacargas (aterrizaje y salto para subir)
      // Escalones para volver a la viga
      ruin(420, 380, 120), ruin(560, 300, 110), ruin(330, 220, 110),
      // Gradas de la cantera
      ruin(1240, 360, 140), ruin(1420, 280, 130), ruin(1300, 200, 110),   // repisa alta (emblema)
      ruin(1650, 350, 150)
    ],
    tablets: [
      {
        x: 520, y: 415,
        speaker: 'Nota de Angelo',
        text: '«Las canteras. De estas paredes salió cada piedra del castillo. El humo era de la chimenea de un cantero: me dio sopa y no me hizo preguntas. Bueno, muchas. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 1355, y: 164 }
    ],
    props: [
      { type: 'stone-blocks', x: 700, y: 460, rows: 2 },
      { type: 'cabin', x: 930, y: 460 },
      { type: 'quarry-crane', x: 1540, y: 460, facing: -1 },
      { type: 'stone-blocks', x: 1810, y: 460, rows: 3 }
    ],
    npcs: [
      {
        id: 'bruno',
        look: 'stonecutter',
        name: 'Bruno, el cantero',
        x: 1080, y: 460, facing: -1,
        lines: [
          '¡Epa! Hace años que nadie baja por el pozo del montacargas. Soy Bruno, cantero. Cada piedra de ese castillo la sacamos de acá, a mazo y cincel.',
          '¿El muchacho de la bufanda mostaza? Se tomó toda mi sopa, preguntó de todo y se fue antes del alba. Tu hermano, ¿no? Miran las cosas igual, como si las midieran.',
          'Preguntaba por la Maestra de la Tierra. Vive en la vieja mina, al fondo de la cantera. Hace años tapó la entrada con rocas que ni diez hombres moverían.',
          'Dicen que la tierra solo le hace caso a quien ya sabe mover el aire: son opuestas, como el día y la noche. Tu hermano igual fue a probar suerte.',
          'Cuidado en las terrazas: el piso se desmorona y debajo están las grutas. Y si una pared se ve floja, no la golpees con la espada: tirale una piedra.'
        ],
        farewell: 'El humo de mi chimenea se ve desde la torre. Si te perdés, buscalo, muchacho.'
      }
    ],
    exits: [
      // Subida por el hueco del techo → sale por el pozo del adarve (animación de llegada)
      { x: 0, y: -400, w: 1920, h: 390, targetRoom: 20, targetX: 1400, targetY: 410,
        hint: { dir: 'up', x: 120, w: 130 } },
      { x: 1880, y: 340, w: 40, h: 120, targetRoom: 22, targetX: 60, targetY: 410 }
    ],
    // Escarabajos lejos de la cabaña
    spawnEnemies: () => [
      crawler(480, 460, 90),
      shade(1300, 270),
      scorpion(1500, 460, 110),
      crawler(1700, 350, 50)
    ],
    spawnDebris: () => [stone(380, 460), stone(1200, 460)]
  });

  // ==========================================================
  // SALA 22: Terrazas de Piedra (montana) — fosos x 500-660 y 1060-1220, piedra floja
  // ==========================================================
  R({
    id: 22,
    name: 'TERRAZAS DE PIEDRA',
    biome: 'montana',
    width: 1760,
    height: 540,
    platforms: [
      ground(0, 500), ground(660, 400), ground(1220, 540),
      ceiling(0, 1760),
      ruin(220, 370, 130), ruin(400, 290, 120),
      ruin(545, 380, 70, 20),            // bloque suelto sobre el primer foso
      ruin(760, 340, 140), ruin(940, 260, 130),
      ruin(780, 170, 110),               // terraza alta (emblema)
      ruin(1105, 380, 70, 20),           // bloque suelto sobre el segundo foso
      ruin(1280, 330, 120)
    ],
    breakables: [
      { x: 1500, y: 20, w: 40, h: 440, broken: false }   // pared de piedra floja
    ],
    tablets: [
      {
        x: 130, y: 415,
        speaker: 'Nota de Angelo',
        text: '«Las terrazas se desmoronan con solo mirarlas. Más adelante, una pared de piedra floja cierra el paso al fondo de la cantera: ya sabés qué hacer. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 835, y: 134 }
    ],
    props: [
      { type: 'stone-blocks', x: 300, y: 460, rows: 1 },
      { type: 'quarry-crane', x: 1360, y: 460, facing: 1 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 21, targetX: 1840, targetY: 410 },
      { x: 1720, y: 340, w: 40, h: 120, targetRoom: 23, targetX: 60, targetY: 410 }
    ],
    spawnEnemies: () => [
      crawler(320, 460, 120),
      shade(600, 240),
      scorpion(840, 460, 120),
      crawler(990, 260, 40),
      shade(1150, 230),
      scorpion(1380, 460, 90),
      crawler(1640, 460, 60)
    ],
    spawnDebris: () => [stone(150, 460), stone(720, 460), stone(1300, 460), stone(1420, 460)]
  });

  // ==========================================================
  // SALA 23: Fondo de la Cantera (montana) — boca de la mina tapada
  // ==========================================================
  R({
    id: 23,
    name: 'FONDO DE LA CANTERA',
    biome: 'montana',
    width: 1440,
    height: 540,
    platforms: [
      ground(0, 1440),
      ceiling(0, 1440),
      wall(1410),
      ruin(260, 370, 130), ruin(470, 290, 120), ruin(680, 220, 120),
      ruin(890, 150, 110),               // saliente alta (cuarzo)
      ruin(860, 360, 120)
    ],
    tablets: [
      {
        x: 640, y: 415,
        speaker: 'Carta de Angelo',
        text: '«Ruben: la mina está tapada y las rocas no se mueven ni con espada ni con piedras. Bruno dice que solo la tierra las aparta, y que la tierra escucha a quien ya domina el aire. Voy a buscar otra entrada por la montaña. Si llegás antes que yo, pedile paso a la Maestra. — A.»'
      }
    ],
    collectibles: [
      { item: 'cuarzo', x: 945, y: 114 },
      { item: 'emblema', x: 530, y: 254 }
    ],
    props: [
      { type: 'stone-blocks', x: 160, y: 460, rows: 2 },
      // La boca de la mina: la abre el poder de la Tierra (js/earth-power.js agrega la salida a la 24)
      { type: 'mine-mouth', x: 1270, y: 460, earthSeal: true }
    ],
    npcs: [
      {
        id: 'greda',
        look: 'earth-master',
        teaches: 'earth',
        name: 'Maestra Greda',
        x: 1120, y: 460, facing: -1,
        lines: [
          'Shh... la tierra me venía contando que alguien bajaba por el montacargas. Soy Greda, la Maestra de la Tierra. Esta mina la tapé yo.',
          'Tu hermano estuvo aquí. Golpeó las rocas, les gritó, quiso empujarlas con el viento. La tierra no se apura por nadie, y menos por alguien con prisa.',
          'El aire y la tierra son opuestos: uno nunca se queda quieto, la otra nunca se mueve sola. Solo quien ya sabe mover el aire entiende lo que es sostener algo.',
          'Abre la palma, así. No empujes: pide. Con la tecla de la Tierra (Q, o RT en el mando) la roca subirá donde apuntes. Úsala de escalón, de muro, o para sacarte de encima a los bichos.'
        ],
        farewell: 'Ahora pídele a las rocas de la mina que se aparten: apunta a la entrada y pide. Adentro está lo que tu hermano dejó.'
      }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 22, targetX: 1680, targetY: 410 }
    ],
    spawnEnemies: () => [
      crawler(380, 460, 120),
      shade(600, 220),
      scorpion(760, 460, 120),
      crawler(900, 360, 40),
      shade(1000, 200),
      crawler(1050, 460, 80)
    ],
    spawnDebris: () => [stone(240, 460), stone(800, 460)]
  });

  // ==========================================================
  // SALA 24: Galerías de la Mina (montana) — solo se entra con la mina abierta
  // El barranco del medio (210 px) y la cornisa del farol no se alcanzan saltando:
  // hay que levantar pilares de roca (js/earth-power.js).
  // ==========================================================
  R({
    id: 24,
    name: 'GALERÍAS DE LA MINA',
    biome: 'montana',
    width: 1760,
    height: 540,
    platforms: [
      ground(0, 620),
      { x: 620, y: 250, w: 420, h: 290, type: 'ground' },   // meseta de roca
      ground(1040, 720),
      ceiling(0, 1760),
      wall(1730),
      ruin(250, 370, 120),
      ruin(1300, 200, 140)               // cornisa alta (farol)
    ],
    tablets: [
      {
        x: 420, y: 415,
        speaker: 'Inscripción minera',
        text: '«Lo que la tierra sostiene, la tierra lo puede levantar.»'
      },
      {
        x: 1600, y: 415,
        speaker: 'Carta de Angelo',
        text: '«Ruben: si leés esto, la Maestra te abrió la mina. A mí no. Entré por la chimenea, desde arriba, y por ahí me voy. Dice que más allá de la montaña vive un sabio que estudia cómo arden las cosas: el cuarto elemento. Te dejo mi farol en la cornisa alta; a mí ya no me alcanzaba la mano. — A.»'
      }
    ],
    collectibles: [
      { item: 'emblema', x: 830, y: 214 },
      { item: 'farol', x: 1370, y: 164 }
    ],
    props: [
      { type: 'stone-blocks', x: 140, y: 460, rows: 1 },
      { type: 'stone-blocks', x: 1480, y: 460, rows: 2 }
    ],
    exits: [
      { x: 0, y: 340, w: 40, h: 120, targetRoom: 23, targetX: 1170, targetY: 410 }
    ],
    spawnEnemies: () => [
      crawler(380, 460, 120),
      shade(520, 230),
      crawler(820, 250, 120),
      scorpion(1180, 460, 110),
      wasp(1300, 300),
      crawler(1560, 460, 100)
    ],
    spawnDebris: () => [stone(200, 460), stone(1100, 460)]
  });
})();
