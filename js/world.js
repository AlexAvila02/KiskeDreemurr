/**
 * Mundo y Habitaciones Interconectadas - Estilo Metroidvania
 * Adaptado a la ambientación de exteriores: Reino Caído, Atardecer, Colinas y Ruinas.
 */

class World {
  constructor() {
    this.currentRoomIndex = 0;
    this.rooms = [];
    this.setupRooms();
  }

  setupRooms() {
    // ==========================================
    // HABITACIÓN 0: Praderas del Reino Caído
    // ==========================================
    this.rooms.push({
      id: 0,
      name: "PRADERAS DEL REINO CAÍDO",
      width: 1280,
      height: 540,
      platforms: [
        // Suelo principal con césped
        { x: 0, y: 460, w: 1280, h: 80, type: 'ground' },
        // Techo abierto / límite superior
        { x: 0, y: 0, w: 1280, h: 20, type: 'ceiling' },
        { x: 0, y: 0, w: 30, h: 540, type: 'wall' },
        // Ruinas de piedra y plataformas de salto
        { x: 260, y: 370, w: 140, h: 22, type: 'ruins' },
        { x: 480, y: 290, w: 150, h: 22, type: 'ruins' },
        { x: 720, y: 350, w: 180, h: 22, type: 'ruins' },
        { x: 970, y: 270, w: 160, h: 22, type: 'ruins' }
      ],
      // Notas dejadas por Angelo
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
      ],
      door: null,
      keyItem: null
    });

    // ==========================================
    // HABITACIÓN 1: El Portón Norte
    // ==========================================
    this.rooms.push({
      id: 1,
      name: "EL PORTÓN NORTE",
      width: 1440,
      height: 540,
      platforms: [
        // Suelos cortados por el barranco del antiguo foso
        { x: 0, y: 460, w: 420, h: 80, type: 'ground' },
        { x: 620, y: 460, w: 820, h: 80, type: 'ground' },
        { x: 0, y: 0, w: 1440, h: 20, type: 'ceiling' },
        // Plataformas sobre el barranco
        { x: 440, y: 390, w: 85, h: 20, type: 'ruins' },
        { x: 535, y: 320, w: 75, h: 20, type: 'ruins' },
        // Plataformas hacia el viejo molino
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
        // Regreso a Habitación 0
        { x: 0, y: 350, w: 40, h: 110, targetRoom: 0, targetX: 1200, targetY: 410 },
        // Salida superior hacia el Altozano del Molino (Habitación 2)
        { x: 270, y: 60, w: 150, h: 40, targetRoom: 2, targetX: 100, targetY: 410 },
        // Salida al Bosque tras cruzar el portón
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
      ],
      keyItem: null
    });

    // ==========================================
    // HABITACIÓN 2: Altozano del Molino (Donde está la llave)
    // ==========================================
    this.rooms.push({
      id: 2,
      name: "ALTOZANO DEL MOLINO",
      width: 1120,
      height: 540,
      platforms: [
        { x: 0, y: 460, w: 1120, h: 80, type: 'ground' },
        { x: 0, y: 0, w: 1120, h: 20, type: 'ceiling' },
        { x: 0, y: 0, w: 30, h: 540, type: 'wall' },
        { x: 1090, y: 0, w: 30, h: 540, type: 'wall' },
        // Plataformas ascendentes del molino
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
        { x: 40, y: 400, w: 60, h: 60, targetRoom: 1, targetX: 290, targetY: 130 }
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
      ],
      door: null
    });

    // ==========================================
    // HABITACIÓN 3: Bosque de los Susurros
    // ==========================================
    this.rooms.push({
      id: 3,
      name: "BOSQUE DE LOS SUSURROS",
      width: 960,
      height: 540,
      platforms: [
        { x: 0, y: 460, w: 960, h: 80, type: 'ground' },
        { x: 0, y: 0, w: 960, h: 20, type: 'ceiling' },
        { x: 0, y: 0, w: 30, h: 540, type: 'wall' },
        { x: 930, y: 0, w: 30, h: 540, type: 'wall' },
        { x: 300, y: 350, w: 360, h: 25, type: 'ruins' }
      ],
      tablets: [
        {
          x: 480,
          y: 300,
          speaker: "Rastro Reciente de Angelo",
          text: "«¡Ruben, atravesaste el Portón Norte! El Bosque de los Susurros es peligroso y la niebla arrecia, pero sé que estás cerca. Mantén la espada en alto. Pronto nos reuniremos. — A.»"
        }
      ],
      exits: [
        { x: 40, y: 400, w: 40, h: 60, targetRoom: 1, targetX: 1010, targetY: 410 }
      ],
      spawnEnemies: () => [],
      spawnDebris: [
        new ThrowableDebris(400, 332)
      ],
      door: null,
      keyItem: null
    });
  }

  getCurrentRoom() {
    return this.rooms[this.currentRoomIndex];
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
    return plats;
  }

  render(ctx, camera) {
    const room = this.getCurrentRoom();

    // 1. Fondo de Atardecer en el Reino Exterior (Cielo cálido y evocador)
    ctx.save();
    const skyGrad = ctx.createLinearGradient(0, 0, 0, room.height);
    skyGrad.addColorStop(0, '#1c152b');   // Violeta oscuro crepuscular
    skyGrad.addColorStop(0.35, '#45263d'); // Ámbar rojizo / vino
    skyGrad.addColorStop(0.7, '#8f4a43');  // Ocre cálido de atardecer
    skyGrad.addColorStop(1, '#caa269');    // Dorado sobre el horizonte
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 960, 540);

    // Siluetas lejanas de montañas y torres del reino caído (Paralaje lento)
    ctx.fillStyle = 'rgba(40, 24, 38, 0.45)';
    for (let i = 0; i < 7; i++) {
      const pX = (i * 220) - (camera.x * 0.12) % 220;
      ctx.beginPath();
      ctx.moveTo(pX, 470);
      ctx.lineTo(pX + 70, 220);
      ctx.lineTo(pX + 140, 470);
      ctx.fill();
    }

    // Colinas intermedias con vegetación y restos de molinos (Paralaje medio)
    ctx.fillStyle = 'rgba(32, 28, 35, 0.7)';
    for (let j = 0; j < 8; j++) {
      const cX = (j * 170) - (camera.x * 0.25) % 170;
      ctx.beginPath();
      ctx.ellipse(cX + 80, 460, 110, 60, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();

    // 2. Dibujar Plataformas (Piedra antigua y césped superior)
    for (const plat of room.platforms) {
      const sx = plat.x - camera.x;
      const sy = plat.y - camera.y;

      if (sx + plat.w < 0 || sx > 960) continue;

      ctx.save();
      // Bloque de piedra antiguo
      const stoneGrad = ctx.createLinearGradient(sx, sy, sx, sy + plat.h);
      stoneGrad.addColorStop(0, '#36343b');
      stoneGrad.addColorStop(1, '#1e1c22');
      ctx.fillStyle = stoneGrad;
      ctx.fillRect(sx, sy, plat.w, plat.h);

      // Franja de césped / pasto alto en la superficie
      ctx.fillStyle = '#657b3d';
      ctx.fillRect(sx, sy, plat.w, 4);

      // Briznas de pasto estilizadas
      ctx.fillStyle = '#89a84e';
      for (let gx = sx + 4; gx < sx + plat.w - 6; gx += 12) {
        ctx.fillRect(gx, sy - 2, 2, 4);
      }
      ctx.restore();
    }

    // 3. Dibujar Notas dejadas por Angelo (Pergaminos con sello)
    for (const tab of room.tablets) {
      const sx = tab.x - camera.x;
      const sy = tab.y - camera.y;

      ctx.save();
      ctx.shadowColor = '#ffe29a';
      ctx.shadowBlur = 10;

      // Pergamino enrollado
      ctx.fillStyle = '#ebd5ad';
      ctx.strokeStyle = '#b08b52';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(sx, sy + 6, 20, 24, 3);
      ctx.fill();
      ctx.stroke();

      // Sello lacrado rojo
      ctx.fillStyle = '#b83b3b';
      ctx.beginPath();
      ctx.arc(sx + 10, sy + 18, 4, 0, Math.PI * 2);
      ctx.fill();

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
        // Portón de hierro forjado y madera de roble
        ctx.fillStyle = '#26211e';
        ctx.strokeStyle = '#8a6845';
        ctx.lineWidth = 3;
        ctx.fillRect(dx, dy, room.door.width, room.door.height);
        ctx.strokeRect(dx, dy, room.door.width, room.door.height);

        // Cerrojo con candado dorado
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffb700';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(dx + room.door.width / 2, dy + room.door.height / 2, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Portón abierto
        ctx.fillStyle = 'rgba(180, 140, 80, 0.2)';
        ctx.strokeStyle = '#7c5e3d';
        ctx.lineWidth = 1;
        ctx.strokeRect(dx, dy, room.door.width, room.door.height);
      }
      ctx.restore();
    }
  }
}
