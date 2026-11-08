/**
 * Mundo y Habitaciones Interconectadas - Estilo Metroidvania
 * Andamiaje multi-bioma (Pradera, Bosque, Montaña, Castillo) con fondos pintados estilo años 50,
 * muros quebradizos ("defensa con ingenio") y registro modular de salas.
 */

class World {
  constructor() {
    this.currentRoomIndex = 0;
    this.rooms = [];
    this.biomes = World.BIOMES;
    this.setupRooms();
    if (Array.isArray(window.PendingRooms)) {
      for (const cfg of window.PendingRooms) this.registerRoom(cfg);
    }
  }

  // Paletas y temas visuales por zona según docs/LORE.md
  static get BIOMES() {
    return {
      pradera: {
        id: 'pradera',
        skyStops: [
          [0, '#2c1d33'],
          [0.35, '#6e3746'],
          [0.72, '#c86d49'],
          [1, '#e8b96a']
        ],
        farSilhouette: 'rgba(62, 34, 42, 0.5)',
        midHills: '#4b382a',
        midHillsStroke: '#3a2416',
        stoneTop: '#7a654b',
        stoneBottom: '#4a3a28',
        turfMain: '#788c38',
        turfBlade: '#a5b84d',
        vignetteTint: 'rgba(48, 26, 12, 0.24)',
        enemyPalette: {
          crawlerFill: '#c98a3a',
          mothWing: 'rgba(232, 200, 130, 0.78)',
          mothBody: '#8a5a2b'
        }
      },
      bosque: {
        id: 'bosque',
        skyStops: [
          [0, '#132421'],
          [0.45, '#213d34'],
          [0.8, '#385e4b'],
          [1, '#688c68']
        ],
        farSilhouette: 'rgba(18, 36, 28, 0.65)',
        midHills: '#243b2c',
        midHillsStroke: '#17261c',
        stoneTop: '#485948',
        stoneBottom: '#293629',
        turfMain: '#386b44',
        turfBlade: '#5c9963',
        vignetteTint: 'rgba(14, 32, 22, 0.32)',
        enemyPalette: {
          crawlerFill: '#4d7a44',
          mothWing: 'rgba(168, 214, 158, 0.75)',
          mothBody: '#2f4f2f'
        }
      },
      montana: {
        id: 'montana',
        skyStops: [
          [0, '#1c2838'],
          [0.45, '#3b526b'],
          [0.8, '#6e8ba6'],
          [1, '#b8cde0']
        ],
        farSilhouette: 'rgba(42, 58, 78, 0.55)',
        midHills: '#465669',
        midHillsStroke: '#253140',
        stoneTop: '#6c7a89',
        stoneBottom: '#414b57',
        turfMain: '#dce8f2',
        turfBlade: '#ffffff',
        vignetteTint: 'rgba(20, 34, 52, 0.26)',
        enemyPalette: {
          crawlerFill: '#7a8ea1',
          mothWing: 'rgba(210, 230, 250, 0.8)',
          mothBody: '#4a5b6e'
        }
      },
      castillo: {
        id: 'castillo',
        skyStops: [
          [0, '#1f121b'],
          [0.45, '#3d1e2b'],
          [0.8, '#662d38'],
          [1, '#9e5a47']
        ],
        farSilhouette: 'rgba(36, 16, 24, 0.65)',
        midHills: '#331c24',
        midHillsStroke: '#211016',
        stoneTop: '#695853',
        stoneBottom: '#3d312e',
        turfMain: '#8c2732',
        turfBlade: '#c99b42',
        vignetteTint: 'rgba(40, 14, 20, 0.30)',
        enemyPalette: {
          crawlerFill: '#9e3b42',
          mothWing: 'rgba(224, 184, 108, 0.78)',
          mothBody: '#63242b'
        }
      }
    };
  }

  // Permite a cualquier agente registrar o reemplazar una sala de forma limpia
  registerRoom(roomConfig) {
    const normalized = {
      biome: 'pradera',
      width: 1280,
      height: 540,
      platforms: [],
      tablets: [],
      exits: [],
      breakables: [],
      collectibles: [],
      spawnEnemies: () => [],
      spawnDebris: () => [],
      door: null,
      keyItem: null,
      ...roomConfig
    };
    this.rooms[normalized.id] = normalized;
    return normalized;
  }

  setupRooms() {
    // ==========================================
    // HABITACIÓN 0: Praderas del Reino Caído
    // ==========================================
    this.registerRoom({
      id: 0,
      name: "PRADERAS DEL REINO CAÍDO",
      biome: 'pradera',
      width: 1280,
      height: 540,
      platforms: [
        { x: 0, y: 460, w: 1280, h: 80, type: 'ground' },
        { x: 0, y: 0, w: 1280, h: 20, type: 'ceiling' },
        { x: 0, y: 0, w: 30, h: 540, type: 'wall' },
        { x: 260, y: 370, w: 140, h: 22, type: 'ruins' },
        { x: 480, y: 290, w: 150, h: 22, type: 'ruins' },
        { x: 720, y: 350, w: 180, h: 22, type: 'ruins' },
        { x: 970, y: 270, w: 160, h: 22, type: 'ruins' }
      ],
      tablets: [
        {
          x: 140,
          y: 415,
          speaker: "Nota de Angelo",
          text: "«Ruben: si lees esto, no me esperes en casa. Seguí el camino viejo hacia el bosque para buscar reconocimiento y levantar a nuestro pueblo. — A.»"
        },
        {
          x: 520,
          y: 245,
          speaker: "Nota de Angelo",
          text: "«Las piedras del viejo muro se desprenden. Papá decía que el reino se defendía con ingenio, no solo con espada. Presiona K para levantar piedras y lanzarlas». — A."
        }
      ],
      exits: [
        { x: 1240, y: 340, w: 40, h: 120, targetRoom: 1, targetX: 60, targetY: 410 }
      ],
      spawnEnemies: () => [
        new CrawlerEnemy(320, 436, 110),
        new CrawlerEnemy(760, 436, 130),
        new FlyingShadeEnemy(1020, 210)
      ],
      spawnDebris: () => [
        new ThrowableDebris(220, 442),
        new ThrowableDebris(740, 332)
      ]
    });

    // ==========================================
    // HABITACIÓN 1: El Portón Norte
    // ==========================================
    this.registerRoom({
      id: 1,
      name: "EL PORTÓN NORTE",
      biome: 'pradera',
      width: 1440,
      height: 540,
      platforms: [
        { x: 0, y: 460, w: 420, h: 80, type: 'ground' },
        { x: 620, y: 460, w: 820, h: 80, type: 'ground' },
        // Techo de copas con un hueco (x 280-410) para subir al molino con doble salto
        { x: 0, y: 0, w: 280, h: 20, type: 'ceiling' },
        { x: 410, y: 0, w: 1030, h: 20, type: 'ceiling' },
        { x: 440, y: 390, w: 85, h: 20, type: 'ruins' },
        { x: 535, y: 320, w: 75, h: 20, type: 'ruins' },
        { x: 200, y: 330, w: 120, h: 20, type: 'ruins' },
        { x: 80, y: 220, w: 140, h: 20, type: 'ruins' },
        { x: 260, y: 140, w: 180, h: 20, type: 'ruins' },
        { x: 500, y: 150, w: 200, h: 20, type: 'ruins' }
      ],
      tablets: [
        {
          x: 350,
          y: 415,
          speaker: "Nota de Angelo",
          text: "«Encontré la llave del Portón Norte, pero la dejé en lo alto del molino, donde solo alguien que salta dos veces puede llegar. Búscala arriba hacia el oeste. — A.»"
        }
      ],
      exits: [
        { x: 0, y: 350, w: 40, h: 110, targetRoom: 0, targetX: 1200, targetY: 410 },
        // Pasaje hacia arriba: se activa al atravesar el hueco del techo
        // (toda la franja por encima del techo, para que nunca quede atrapado arriba)
        { x: 0, y: -400, w: 1440, h: 390, targetRoom: 2, targetX: 100, targetY: 410,
          hint: { dir: 'up', x: 280, w: 130 } },
        { x: 1390, y: 360, w: 50, h: 100, targetRoom: 3, targetX: 70, targetY: 410 }
      ],
      door: {
        x: 1060,
        y: 280,
        width: 32,
        height: 180,
        isLocked: true,
        requiredKeys: 1
      },
      spawnEnemies: () => [
        new CrawlerEnemy(780, 436, 120),
        new FlyingShadeEnemy(480, 240),
        new FlyingShadeEnemy(890, 200)
      ],
      spawnDebris: () => [
        new ThrowableDebris(280, 122),
        new ThrowableDebris(710, 442)
      ]
    });

    // ==========================================
    // HABITACIÓN 2: Altozano del Molino (Donde está la llave)
    // ==========================================
    this.registerRoom({
      id: 2,
      name: "ALTOZANO DEL MOLINO",
      biome: 'pradera',
      hasWindmill: true,
      width: 1120,
      height: 540,
      platforms: [
        { x: 0, y: 460, w: 1120, h: 80, type: 'ground' },
        { x: 0, y: 0, w: 1120, h: 20, type: 'ceiling' },
        { x: 0, y: 0, w: 30, h: 540, type: 'wall' },
        { x: 1090, y: 0, w: 30, h: 540, type: 'wall' },
        { x: 220, y: 370, w: 110, h: 20, type: 'ruins' },
        { x: 420, y: 300, w: 110, h: 20, type: 'ruins' },
        { x: 620, y: 220, w: 120, h: 20, type: 'ruins' },
        { x: 840, y: 160, w: 180, h: 24, type: 'ruins' }
      ],
      tablets: [
        {
          x: 940,
          y: 115,
          speaker: "Carta Sellada de Angelo",
          text: "«Hermano Ruben: esta llave abre el Portón Norte. Si lograste subir hasta aquí, confío plenamente en ti. No me detendré hasta levantar nuestro reino. Te espero más adelante. — A.»"
        }
      ],
      exits: [
        { x: 40, y: 400, w: 60, h: 60, targetRoom: 1, targetX: 290, targetY: 96 }
      ],
      keyItem: {
        x: 920,
        y: 126,
        collected: false
      },
      spawnEnemies: () => [
        new CrawlerEnemy(360, 436, 140),
        new FlyingShadeEnemy(520, 180),
        new FlyingShadeEnemy(750, 140)
      ],
      spawnDebris: () => [
        new ThrowableDebris(240, 352),
        new ThrowableDebris(640, 202)
      ]
    });

    // ==========================================
    // HABITACIÓN 3: Bosque de los Susurros
    // ==========================================
    this.registerRoom({
      id: 3,
      name: "BOSQUE DE LOS SUSURROS",
      biome: 'bosque',
      width: 1280,
      height: 540,
      platforms: [
        { x: 0, y: 460, w: 1280, h: 80, type: 'ground' },
        { x: 0, y: 0, w: 1280, h: 20, type: 'ceiling' },
        { x: 0, y: 0, w: 30, h: 540, type: 'wall' },
        { x: 1250, y: 0, w: 30, h: 540, type: 'wall' },
        { x: 260, y: 360, w: 160, h: 22, type: 'ruins' },
        { x: 520, y: 280, w: 220, h: 24, type: 'ruins' },
        { x: 840, y: 350, w: 180, h: 22, type: 'ruins' }
      ],
      tablets: [
        {
          x: 610,
          y: 235,
          speaker: "Rastro Reciente de Angelo",
          text: "«¡Ruben, atravesaste el Portón Norte! El Bosque de los Susurros es espeso y la niebla arrecia, pero sé que estás cerca. Mantén la espada en alto. Pronto nos reuniremos. — A.»"
        }
      ],
      exits: [
        { x: 35, y: 360, w: 45, h: 100, targetRoom: 1, targetX: 1120, targetY: 410 }
      ],
      spawnEnemies: () => [
        new CrawlerEnemy(380, 436, 130),
        new FlyingShadeEnemy(880, 230)
      ],
      spawnDebris: () => [
        new ThrowableDebris(300, 342),
        new ThrowableDebris(880, 332)
      ]
    });
  }

  getCurrentRoom() {
    return this.rooms[this.currentRoomIndex];
  }

  getCurrentBiome() {
    const room = this.getCurrentRoom();
    return World.BIOMES[room.biome] || World.BIOMES.pradera;
  }

  getPlatforms() {
    const room = this.getCurrentRoom();
    const plats = [...room.platforms];
    if (room.door && room.door.isLocked) {
      plats.push({
        x: room.door.x,
        y: room.door.y,
        w: room.door.width,
        h: room.door.height,
        type: 'locked-door'
      });
    }
    if (room.breakables) {
      for (const b of room.breakables) {
        if (!b.broken) {
          plats.push({ x: b.x, y: b.y, w: b.w, h: b.h, type: 'breakable', ref: b });
        }
      }
    }
    return plats;
  }

  // Permite romper muros agrietados o contrapesos al impactar una piedra lanzada
  checkBreakableImpact(rect) {
    const room = this.getCurrentRoom();
    if (!room.breakables) return false;
    for (const b of room.breakables) {
      if (b.broken) continue;
      if (
        rect.x < b.x + b.w &&
        rect.x + rect.w > b.x &&
        rect.y < b.y + b.h &&
        rect.y + rect.h > b.y
      ) {
        b.broken = true;
        if (window.soundManager && window.soundManager.playBreakWall) {
          window.soundManager.playBreakWall();
        }
        if (window.particleSystem) {
          window.particleSystem.createDebrisFragments(b.x + b.w / 2, b.y + b.h / 2);
        }
        return true;
      }
    }
    return false;
  }

  render(ctx, camera) {
    const room = this.getCurrentRoom();
    const biome = this.getCurrentBiome();
    const OUT = '#3a2416';

    // 1. Cielo y fondo procedural según el bioma de la zona
    if (typeof CodeArt !== 'undefined' && typeof CodeArt.renderBiomeBackground === 'function') {
      CodeArt.renderBiomeBackground(
        ctx,
        room.biome,
        camera,
        960,
        540,
        Date.now(),
        {
          hasWindmill: !!room.hasWindmill,
          hasTower: room.biome === 'pradera' || room.biome === 'castillo'
        }
      );
    } else {
      ctx.save();
      const skyGrad = ctx.createLinearGradient(0, 0, 0, room.height);
      for (const [stop, color] of biome.skyStops) {
        skyGrad.addColorStop(stop, color);
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 960, 540);

      // Sol poniente o luna brumosa en el horizonte
      if (room.biome === 'pradera') {
        const sunX = 720 - camera.x * 0.05;
        const sunY = 260;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 110);
        sunGrad.addColorStop(0, 'rgba(255, 242, 190, 0.85)');
        sunGrad.addColorStop(0.4, 'rgba(245, 185, 95, 0.35)');
        sunGrad.addColorStop(1, 'rgba(245, 185, 95, 0)');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 110, 0, Math.PI * 2);
        ctx.fill();
      }

      // Siluetas lejanas en paralaje lento (montañas, árboles altos o torres del reino)
      ctx.fillStyle = biome.farSilhouette;
      if (room.biome === 'bosque') {
        // Árboles altos del Bosque de los Susurros
        for (let i = 0; i < 10; i++) {
          const tX = (i * 140) - (camera.x * 0.14) % 140;
          ctx.fillRect(tX + 45, 80, 26, 400);
          ctx.beginPath();
          ctx.arc(tX + 58, 110, 55, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Picos y siluetas de torres del Reino Caído
        for (let i = 0; i < 7; i++) {
          const pX = (i * 220) - (camera.x * 0.12) % 220;
          ctx.beginPath();
          ctx.moveTo(pX, 470);
          ctx.lineTo(pX + 70, 210);
          ctx.lineTo(pX + 140, 470);
          ctx.fill();
        }
      }

      // Colinas redondeadas estilo animación años 50 (Paralaje medio)
      ctx.fillStyle = biome.midHills;
      ctx.strokeStyle = biome.midHillsStroke;
      ctx.lineWidth = 2;
      for (let j = 0; j < 8; j++) {
        const cX = (j * 170) - (camera.x * 0.25) % 170;
        ctx.beginPath();
        ctx.ellipse(cX + 80, 465, 115, 62, 0, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
      }

      // Molino antiguo con aspas giratorias en el Altozano del Molino
      if (room.hasWindmill) {
        const mx = 930 - camera.x;
        const my = 160 - camera.y;
        ctx.save();
        ctx.fillStyle = '#5c432d';
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx - 28, my);
        ctx.lineTo(mx - 18, my - 95);
        ctx.lineTo(mx + 18, my - 95);
        ctx.lineTo(mx + 28, my);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Techo cónico del molino
        ctx.fillStyle = '#8c412b';
        ctx.beginPath();
        ctx.moveTo(mx - 24, my - 95);
        ctx.lineTo(mx, my - 122);
        ctx.lineTo(mx + 24, my - 95);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Aspas giratorias
        ctx.translate(mx, my - 82);
        ctx.rotate(Date.now() * 0.0007);
        ctx.fillStyle = '#e8d2a6';
        for (let a = 0; a < 4; a++) {
          ctx.rotate(Math.PI / 2);
          ctx.fillRect(-3, 0, 6, 54);
          ctx.strokeRect(-3, 0, 6, 54);
        }
        ctx.restore();
      }
      ctx.restore();
    }

    // 2. Dibujar Plataformas (Contorno de tinta cálida y vegetación superior)
    const windWave = Math.sin(Date.now() * 0.003) * 2;
    for (const plat of room.platforms) {
      const sx = plat.x - camera.x;
      const sy = plat.y - camera.y;

      if (sx + plat.w < 0 || sx > 960) continue;

      ctx.save();
      const stoneGrad = ctx.createLinearGradient(sx, sy, sx, sy + plat.h);
      stoneGrad.addColorStop(0, biome.stoneTop);
      stoneGrad.addColorStop(1, biome.stoneBottom);
      ctx.fillStyle = stoneGrad;
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.roundRect(sx, sy, plat.w, plat.h, 4);
      ctx.fill();
      ctx.stroke();

      // Franja de pasto / musgo / nieve en la superficie (excepto techos y muros verticales)
      if (plat.type !== 'ceiling' && plat.type !== 'wall') {
        ctx.fillStyle = biome.turfMain;
        ctx.fillRect(sx + 2, sy, plat.w - 4, 5);

        ctx.strokeStyle = biome.turfBlade;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let gx = sx + 6; gx < sx + plat.w - 6; gx += 12) {
          ctx.moveTo(gx, sy);
          ctx.lineTo(gx + windWave, sy - 4);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2b. Dibujar Muros Quebradizos si la sala los define
    if (room.breakables) {
      for (const b of room.breakables) {
        if (b.broken) continue;
        const bx = b.x - camera.x;
        const by = b.y - camera.y;
        ctx.save();
        ctx.fillStyle = '#755c44';
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2;
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.strokeRect(bx, by, b.w, b.h);
        // Grietas visibles
        ctx.beginPath();
        ctx.moveTo(bx + 4, by + 6);
        ctx.lineTo(bx + b.w / 2, by + b.h / 2);
        ctx.lineTo(bx + b.w - 4, by + b.h - 8);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. Dibujar Notas dejadas por Angelo (Pergaminos con sello lacrado)
    for (const tab of room.tablets) {
      const sx = tab.x - camera.x;
      const sy = tab.y - camera.y;

      ctx.save();
      ctx.shadowColor = '#ffe29a';
      ctx.shadowBlur = 10;

      ctx.fillStyle = '#f5e2ba';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(sx, sy + 6, 20, 24, 3);
      ctx.fill();
      ctx.stroke();

      // Sello lacrado rojo de Angelo
      ctx.fillStyle = '#b83b3b';
      ctx.beginPath();
      ctx.arc(sx + 10, sy + 18, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // 4. Dibujar Llave Antigua si está en la habitación
    if (room.keyItem && !room.keyItem.collected) {
      const kx = room.keyItem.x - camera.x;
      const ky = room.keyItem.y - camera.y + Math.sin(Date.now() * 0.005) * 4;

      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 16;
      ctx.font = '22px sans-serif';
      ctx.fillText('🗝️', kx, ky);
      ctx.restore();
    }

    // 5. Dibujar Portón Norte
    if (room.door) {
      const dx = room.door.x - camera.x;
      const dy = room.door.y - camera.y;

      ctx.save();
      if (room.door.isLocked) {
        ctx.fillStyle = '#593a22';
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2.5;
        ctx.fillRect(dx, dy, room.door.width, room.door.height);
        ctx.strokeRect(dx, dy, room.door.width, room.door.height);

        // Herrajes de hierro y candado dorado
        ctx.fillStyle = '#d9a634';
        ctx.shadowColor = '#ffb700';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(dx + room.door.width / 2, dy + room.door.height / 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(180, 140, 80, 0.18)';
        ctx.strokeStyle = '#7c5e3d';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(dx, dy, room.door.width, room.door.height);
      }
      ctx.restore();
    }
  }
}
