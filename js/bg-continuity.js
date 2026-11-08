/**
 * Continuidad del Fondo entre Secciones - Ruben: En Busca de Angelo
 *
 * Pedido del usuario: "al inicio de cada sección se debe respetar el fondo y por
 * ende el paralaje del final de la anterior sección, para dar sensación de continuidad".
 *
 * Cómo funciona (sin tocar world.js ni main.js):
 *  - Envuelve CodeArt.renderBiomeBackground. El fondo ya no se dibuja con la cámara
 *    de la sala (que vuelve a 0 en cada sala) sino con una "cámara de fondo" continua:
 *        camaraFondo = camaraSala + desplazamiento
 *    Al cambiar de sala, el desplazamiento se recalcula para que la cámara de fondo
 *    del primer cuadro de la sala nueva sea EXACTAMENTE la del último cuadro de la
 *    anterior. Así montañas, colinas, río y estrellas siguen en el mismo lugar y el
 *    paralaje continúa desde ahí.
 *  - Si la sala nueva es de otro bioma (p. ej. Bosque → Montaña Gris), al entrar se
 *    sigue viendo el paisaje del bioma anterior y se funde con el nuevo a medida que
 *    Ruben se adentra en la sala (fundido completo a ~720 px de la entrada).
 *  - El molino (sala 2) pertenece a la sala, no al fondo: se dibuja con la cámara real.
 *
 * API: window.BgContinuity.getState() (depuración) · window.BgContinuity.reset()
 */
(function () {
  'use strict';

  const BLEND_DISTANCE = 720; // px que Ruben recorre hasta que el bioma nuevo cubre todo

  const state = {
    roomIndex: null,
    offsetX: 0,
    offsetY: 0,
    lastBgX: 0,
    lastBgY: 0,
    lastBiome: null,
    lastOpts: null,
    blend: null      // { biome, opts, entryX, entryY, t }
  };

  let offscreen = null;
  let offCtx = null;

  function getOffscreen(w, h) {
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      offCtx = offscreen.getContext('2d');
    }
    if (offscreen.width !== w || offscreen.height !== h) {
      offscreen.width = w;
      offscreen.height = h;
    }
    return offCtx;
  }

  function smooth(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  function install() {
    const CA = window.CodeArt;
    if (!CA || typeof CA.renderBiomeBackground !== 'function' || CA.__continuityInstalled) return false;
    const original = CA.renderBiomeBackground;
    CA.__continuityInstalled = true;
    CA.renderBiomeBackgroundRaw = original;

    CA.renderBiomeBackground = function (ctx, biomeKey, camera, width = 960, height = 540, time = 0, options = {}) {
      const g = window.gameInstance;
      if (!g || !g.world) return original.call(this, ctx, biomeKey, camera, width, height, time, options);

      const cam = camera || { x: 0, y: 0 };
      const idx = g.world.currentRoomIndex;
      const player = g.player;

      // ¿Primer cuadro en una sala nueva? -> empalmar el fondo con el de la anterior
      if (idx !== state.roomIndex) {
        if (state.roomIndex !== null) {
          state.offsetX = state.lastBgX - cam.x;
          state.offsetY = state.lastBgY - cam.y;
          const entryX = player ? player.x : 0;
          const entryY = player ? player.y : 0;
          const prev = state.blend;
          if (prev && state.lastBiome === biomeKey) {
            // Sala del mismo bioma a mitad de un fundido: el fundido sigue donde estaba
            prev.entryX = entryX;
            prev.entryY = entryY;
          } else if (prev && prev.biome === biomeKey) {
            // Volvió atrás a mitad de un fundido: se veía (1 - t) de este bioma y t del
            // anterior; se invierte el fundido para que el primer cuadro sea idéntico
            state.blend = { biome: state.lastBiome, opts: state.lastOpts || {}, entryX, entryY, t: 1 - prev.t };
          } else if (state.lastBiome && state.lastBiome !== biomeKey) {
            // Bioma nuevo: arranca mostrando el paisaje que se veía al salir
            const fromBiome = prev && prev.t < 0.5 ? prev.biome : state.lastBiome;
            const fromOpts = prev && prev.t < 0.5 ? prev.opts : (state.lastOpts || {});
            state.blend = { biome: fromBiome, opts: fromOpts, entryX, entryY, t: 0 };
          }
        }
        state.roomIndex = idx;
      }

      const bgCam = { x: cam.x + state.offsetX, y: cam.y + state.offsetY };
      // El molino es parte de la sala: se dibuja aparte con la cámara real
      const bgOpts = Object.assign({}, options, { hasWindmill: false });

      original.call(this, ctx, biomeKey, bgCam, width, height, time, bgOpts);

      // Fundido desde el bioma de la sección anterior
      if (state.blend) {
        const b = state.blend;
        if (player && !player.dead) {
          const d = Math.hypot(player.x - b.entryX, (player.y - b.entryY) * 0.5);
          b.t = Math.max(b.t, smooth(d / BLEND_DISTANCE)); // nunca retrocede
        }
        if (b.t >= 0.999) {
          state.blend = null;
        } else {
          const oc = getOffscreen(width, height);
          oc.setTransform(1, 0, 0, 1, 0, 0);
          oc.clearRect(0, 0, width, height);
          original.call(this, oc, b.biome, bgCam, width, height, time, b.opts);
          ctx.save();
          ctx.globalAlpha = 1 - b.t;
          ctx.drawImage(offscreen, 0, 0, width, height);
          ctx.restore();
        }
      }

      if (options.hasWindmill && typeof CA.drawWindmill === 'function') {
        CA.drawWindmill(ctx, 930 - cam.x, 160 - (cam.y || 0), time * 0.0007);
      }

      state.lastBgX = bgCam.x;
      state.lastBgY = bgCam.y;
      state.lastBiome = biomeKey;
      state.lastOpts = bgOpts;
    };
    return true;
  }

  window.BgContinuity = {
    getState: () => JSON.parse(JSON.stringify(state)),
    reset: () => {
      state.roomIndex = null;
      state.offsetX = state.offsetY = 0;
      state.lastBgX = state.lastBgY = 0;
      state.blend = null;
    }
  };

  // CodeArt se carga antes que este archivo; por si acaso, reintentar al iniciar el juego
  if (!install()) {
    window.GameHooks = window.GameHooks || { onInit: [], onRoomLoad: [], onUpdate: [], onRenderWorld: [], onAction: [] };
    window.GameHooks.onInit = window.GameHooks.onInit || [];
    window.GameHooks.onInit.push(() => install());
  }
})();
