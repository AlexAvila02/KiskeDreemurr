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
    this._platformsBuffer = [];
    this._doorCollider = { x: 0, y: 0, w: 0, h: 0, type: 'locked-door' };
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
  // Copia profunda de los DATOS de una sala (arreglos y objetos planos). Funciones e
  // instancias de clases se comparten. Así cada World (cada partida) tiene su propio
  // estado: campanas, muros rotos, objetos juntados, NPC... nunca se arrastran entre partidas.
  static cloneRoomData(v) {
    if (Array.isArray(v)) return v.map(World.cloneRoomData);
    // Objeto plano = su prototipo es Object.prototype (o null). Se compara por la cadena de
    // prototipos y no contra Object.prototype para funcionar también en otros "realms"
    // (iframes, vm de Node en scripts/check-project.js).
    const proto = v && typeof v === 'object' ? Object.getPrototypeOf(v) : undefined;
    if (proto !== undefined && (proto === null || Object.getPrototypeOf(proto) === null)) {
      const o = {};
      for (const k in v) o[k] = World.cloneRoomData(v[k]);
      return o;
    }
    return v;
  }

  registerRoom(roomConfig) {
    roomConfig = World.cloneRoomData(roomConfig);
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
    if (normalized.breakables) {
      for (let i = 0; i < normalized.breakables.length; i++) {
        const b = normalized.breakables[i];
        b.type = 'breakable';
        b.ref = b;
      }
    }
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
        // Suelo continuo: el barranco (x 420-620) se tapó (pedido del usuario, 9/11)
        { x: 0, y: 460, w: 1440, h: 80, type: 'ground' },
        // Techo de copas con un hueco (x 280-410) para subir al molino saltando desde la ruina alta
        { x: 0, y: 0, w: 280, h: 20, type: 'ceiling' },
        { x: 410, y: 0, w: 1030, h: 20, type: 'ceiling' },
        // Muro sobre el Portón Norte: cierra el hueco entre el techo y la puerta
        // (antes se podía pasar por arriba rebotando en una polilla + doble salto)
        { x: 1054, y: 0, w: 44, h: 284, type: 'wall' },
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
          style: 'aire', // pergamino azul transparente (recuerdo del aire)
          speaker: "Nota de Angelo",
          text: "«Encontré la llave del Portón Norte, pero la dejé en lo alto del molino, donde solo alguien que salte bien alto puede llegar. Búscala arriba hacia el oeste. Si te plantas firme, mantén Abajo + F (o L2) para jalar el aire y atraer a las criaturas hacia ti. — A.»"
        }
      ],
      exits: [
        { x: 0, y: 350, w: 40, h: 110, targetRoom: 0, targetX: 1200, targetY: 410 },
        // Pasaje hacia arriba: se activa al atravesar el hueco del techo
        // (toda la franja por encima del techo, para que nunca quede atrapado arriba)
        { x: 0, y: -400, w: 1440, h: 390, targetRoom: 2, targetX: 145, targetY: 410,
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
        // Hueco en el suelo (x 30-130) junto a la pared: por ahí se sube desde el
        // Portón Norte y por ahí se baja de vuelta dejándose caer
        { x: 130, y: 460, w: 990, h: 80, type: 'ground' },
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
        // Caer por el hueco del suelo → baja por el hueco de las copas de la sala 1
        { x: 30, y: 470, w: 100, h: 80, targetRoom: 1, targetX: 330, targetY: 60,
          hint: { dir: 'down', x: 30, w: 100 } }
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
        // Sin pared a la izquierda: el sendero sigue abierto de vuelta al Portón Norte
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
        // Pegada al borde: se sale caminando (o saltando) hacia la izquierda, como en las demás salas
        { x: 0, y: 340, w: 40, h: 120, targetRoom: 1, targetX: 1120, targetY: 410 }
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
    const buf = this._platformsBuffer;
    buf.length = 0;
    if (!room) return buf;

    const plats = room.platforms;
    for (let i = 0; i < plats.length; i++) {
      buf.push(plats[i]);
    }

    if (room.door && room.door.isLocked) {
      this._doorCollider.x = room.door.x;
      this._doorCollider.y = room.door.y;
      this._doorCollider.w = room.door.width;
      this._doorCollider.h = room.door.height;
      buf.push(this._doorCollider);
    }

    if (room.breakables) {
      for (let i = 0; i < room.breakables.length; i++) {
        const b = room.breakables[i];
        if (!b.broken) {
          buf.push(b);
        }
      }
    }
    return buf;
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
    // El motor CodeArt (js/code-art-engine.js) siempre está cargado en index.html
    CodeArt.renderBiomeBackground(ctx, room.biome, camera, 960, 540, Date.now(), {
      hasWindmill: !!room.hasWindmill
    });

    // 2. Dibujar Plataformas (Contorno de tinta cálida y vegetación superior)
    const windWave = Math.sin(Date.now() * 0.003) * 2;
    for (const plat of room.platforms) {
      const sx = plat.x - camera.x;
      const sy = plat.y - camera.y;

      if (sx + plat.w < 0 || sx > 960) continue;

      // Terreno con detalle pintado a mano por zona (js/terrain-art.js)
      if (window.TerrainArt) {
        ctx.save();
        window.TerrainArt.drawPlatform(ctx, plat, sx, sy, room.biome, biome);
        ctx.restore();
        continue;
      }

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
        if (window.TerrainArt) {
          ctx.save();
          window.TerrainArt.drawBreakable(ctx, b, bx, by, room.biome, biome);
          ctx.restore();
          continue;
        }
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
      // Pergamino del aire: azul celeste translúcido, como el aire
      const isAire = tab.style === 'aire';
      ctx.shadowColor = isAire ? '#9fd8ff' : '#ffe29a';
      ctx.shadowBlur = isAire ? 14 : 10;

      ctx.fillStyle = isAire ? 'rgba(150, 205, 255, 0.45)' : '#f5e2ba';
      ctx.strokeStyle = isAire ? 'rgba(200, 235, 255, 0.85)' : OUT;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(sx, sy + 6, 20, 24, 3);
      ctx.fill();
      ctx.stroke();

      // Sello lacrado de Angelo (rojo; azul claro en el pergamino del aire)
      ctx.fillStyle = isAire ? 'rgba(225, 245, 255, 0.8)' : '#b83b3b';
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
      if (window.JournalData && window.JournalData.drawIcon) {
        // Llave dibujada a mano con el mismo estilo que los objetos del Diario
        window.JournalData.drawIcon(ctx, 'llave', kx + 11, ky - 8, 26);
      } else {
        ctx.font = '22px sans-serif';
        ctx.fillText('🗝️', kx, ky);
      }
      ctx.restore();
    }

    // 5. Dibujar Portón Norte
    if (room.door) {
      const d = room.door;
      const dx = d.x - camera.x;
      const dy = d.y - camera.y;

      ctx.save();
      if (d.isLocked) {
        ctx.fillStyle = '#593a22';
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2.5;
        ctx.fillRect(dx, dy, d.width, d.height);
        ctx.strokeRect(dx, dy, d.width, d.height);

        // Herrajes de hierro y candado dorado
        ctx.fillStyle = '#d9a634';
        ctx.shadowColor = '#ffb700';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(dx + d.width / 2, dy + d.height / 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Portón abierto: la hoja gira hacia atrás sobre la bisagra (borde izquierdo),
        // se aleja del jugador (se encoge y se oscurece) y queda abierta. Sin marco.
        // openedAt lo fija main.js al desbloquear; si falta (sala restaurada) queda abierta de una.
        const t = d.openedAt ? Math.min(1, (Date.now() - d.openedAt) / 700) : 1;
        const e = 1 - Math.pow(1 - t, 3);            // ease-out
        const swing = e * 0.82 * (Math.PI / 2);      // ángulo de giro
        const leafW = d.width * Math.cos(swing);     // ancho aparente de la hoja
        const taper = d.height * 0.05 * e;           // el borde lejano se achica en altura
        const shade = 1 - 0.5 * e;                   // se oscurece al alejarse

        // Vano: hueco oscuro que queda detrás de la hoja
        ctx.fillStyle = 'rgba(28, 16, 9, 0.35)';
        ctx.fillRect(dx, dy, d.width, d.height);

        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx + leafW, dy + taper);
        ctx.lineTo(dx + leafW, dy + d.height - taper);
        ctx.lineTo(dx, dy + d.height);
        ctx.closePath();
        ctx.fillStyle = `rgb(${Math.round(89 * shade)}, ${Math.round(58 * shade)}, ${Math.round(34 * shade)})`;
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
