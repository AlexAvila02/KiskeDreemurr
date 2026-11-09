/**
 * Sistema Modular y Desacoplado de Animaciones (Animation Registry)
 * Ruben: En Busca de Angelo - Estilo Animación Tradicional Años 50
 *
 * Módulo autocontenido (IIFE 'use strict') que desacopla completamente las
 * capas visuales, estelas, clips de efectos (FX) y skins sin alterar los
 * archivos base (player.js, enemies.js, world.js, main.js).
 *
 * REQUISITO DE RENDIMIENTO (CERO GARBAGE COLLECTION EN EL GAME LOOP):
 * - Pool de 64 efectos visuales (FX_POOL_SIZE = 64) pre-alojado en memoria.
 * - Buffer circular de 8 estelas (AFTERIMAGE_MAX = 8) para acrobacias de Ruben.
 * - Técnica swap-and-pop O(1) para reciclar ranuras sin new, {}, [], splice ni filter.
 * - Sin consultas al DOM ni asignaciones dinámicas en update ni render.
 */
(function () {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTES Y POOLS PRE-ALOJADOS (ZERO GC)
  // ==========================================================================
  const FX_POOL_SIZE = 64;
  const AFTERIMAGE_MAX = 8;
  const OUTLINE_COLOR = '#3a2416';

  /**
   * Pool de Efectos Visuales pre-alojado.
   * Propiedades fijas por ranura:
   * active, type, x, y, vx, vy, dir, angle, scale, frame, maxFrames, color, alpha, extra
   */
  const fxPool = new Array(FX_POOL_SIZE);
  for (let i = 0; i < FX_POOL_SIZE; i++) {
    fxPool[i] = {
      active: false,
      type: null,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      dir: 1,
      angle: 0,
      scale: 1,
      frame: 0,
      maxFrames: 20,
      color: '#f2d29b',
      alpha: 1,
      extra: 0
    };
  }
  let activeFXCount = 0;

  /**
   * Buffer circular de estelas (afterimages) pre-alojado para Ruben.
   */
  const afterimages = new Array(AFTERIMAGE_MAX);
  for (let i = 0; i < AFTERIMAGE_MAX; i++) {
    afterimages[i] = {
      active: false,
      x: 0,
      y: 0,
      facing: 1,
      sy: 1,
      sx: 1,
      flip: 0,
      alpha: 0,
      color: '#f2d29b'
    };
  }
  let afterimageHead = 0;

  // Variables escalares de estado interno (sin alocaciones en el bucle)
  let trailFrameSkip = 0;
  let playerPrevVy = 0;
  let playerPrevGrounded = true;
  let playerPrevCooldown = 0;
  let playerPrevTimer = 0;
  let carryEffortTimer = 0;
  let crawlerPuffTimer = 0;

  /**
   * Objeto reutilizable pre-alojado para pasar parámetros a spawnFX sin instanciar literales {}.
   */
  const _fxOpts = {
    vx: 0,
    vy: 0,
    dir: 1,
    angle: 0,
    scale: 1,
    color: '#f2d29b',
    duration: 20,
    extra: 0
  };

  function fillOpts(vx, vy, dir, angle, scale, color, duration, extra) {
    _fxOpts.vx = vx !== undefined ? vx : 0;
    _fxOpts.vy = vy !== undefined ? vy : 0;
    _fxOpts.dir = dir !== undefined ? dir : 1;
    _fxOpts.angle = angle !== undefined ? angle : 0;
    _fxOpts.scale = scale !== undefined ? scale : 1;
    _fxOpts.color = color !== undefined ? color : '#f2d29b';
    _fxOpts.duration = duration !== undefined ? duration : 20;
    _fxOpts.extra = extra !== undefined ? extra : 0;
    return _fxOpts;
  }

  // Registro de definiciones de FX
  const fxDefinitions = Object.create(null);

  // Registro de capas agrupadas por objetivo ('player', 'crawler', 'moth', 'debris', 'world')
  const layersByTarget = {
    player: [],
    crawler: [],
    moth: [],
    debris: [],
    world: []
  };

  // Registro de skins agrupadas por objetivo
  const skinsByTarget = {
    player: Object.create(null),
    crawler: Object.create(null),
    moth: Object.create(null),
    debris: Object.create(null),
    world: Object.create(null)
  };

  const activeSkinByTarget = {
    player: 'default',
    crawler: 'default',
    moth: 'default',
    debris: 'default',
    world: 'default'
  };

  // Registro para reportar errores de skins/capas una sola vez y no saturar la consola
  const errorLoggedMap = Object.create(null);

  function logErrorOnce(key, msg, err) {
    if (!errorLoggedMap[key]) {
      errorLoggedMap[key] = true;
      console.error(msg, err);
    }
  }

  // ==========================================================================
  // 2. GESTIÓN DEL POOL DE FX (SWAP-AND-POP O(1))
  // ==========================================================================
  function spawnFX(type, x, y, opts) {
    if (!type || !fxDefinitions[type]) return null;

    let slot;
    if (activeFXCount < FX_POOL_SIZE) {
      slot = fxPool[activeFXCount];
      activeFXCount++;
    } else {
      // Si el pool está lleno, reciclamos la ranura activa más antigua (índice 0)
      slot = fxPool[0];
    }

    const def = fxDefinitions[type];
    const defaultDur = def.duration || 20;

    slot.active = true;
    slot.type = type;
    slot.x = x;
    slot.y = y;
    slot.frame = 0;
    slot.alpha = 1;

    if (opts) {
      slot.vx = opts.vx !== undefined ? opts.vx : 0;
      slot.vy = opts.vy !== undefined ? opts.vy : 0;
      slot.dir = opts.dir !== undefined ? opts.dir : 1;
      slot.angle = opts.angle !== undefined ? opts.angle : 0;
      slot.scale = opts.scale !== undefined ? opts.scale : 1;
      slot.color = opts.color !== undefined ? opts.color : '#f2d29b';
      slot.maxFrames = opts.duration !== undefined ? opts.duration : defaultDur;
      slot.extra = opts.extra !== undefined ? opts.extra : 0;
    } else {
      slot.vx = 0;
      slot.vy = 0;
      slot.dir = 1;
      slot.angle = 0;
      slot.scale = 1;
      slot.color = '#f2d29b';
      slot.maxFrames = defaultDur;
      slot.extra = 0;
    }

    return slot;
  }

  function updateFX(dt) {
    let i = 0;
    while (i < activeFXCount) {
      const item = fxPool[i];
      item.frame++;
      item.x += item.vx;
      item.y += item.vy;

      const def = fxDefinitions[item.type];
      if (def && def.update) {
        try {
          def.update(item, dt);
        } catch (err) {
          logErrorOnce('fx-update:' + item.type, `[AnimationRegistry] Error en update de FX '${item.type}':`, err);
        }
      }

      if (!item.active || item.frame >= item.maxFrames) {
        item.active = false;
        activeFXCount--;
        if (i < activeFXCount) {
          // Técnica Swap-and-Pop: swap con el último activo
          const temp = fxPool[i];
          fxPool[i] = fxPool[activeFXCount];
          fxPool[activeFXCount] = temp;
          // No incrementamos i para procesar el elemento que acabamos de mover
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
  }

  function renderActiveFX(ctx, camera) {
    if (activeFXCount === 0) return;
    const camX = camera ? camera.x : 0;
    const camY = camera ? camera.y : 0;

    for (let i = 0; i < activeFXCount; i++) {
      const item = fxPool[i];
      if (!item.active) continue;

      const screenX = item.x - camX;
      const screenY = item.y - camY;

      // Culling rápido fuera de pantalla (margen de 80px)
      if (screenX < -80 || screenX > 1040 || screenY < -80 || screenY > 620) {
        continue;
      }

      const def = fxDefinitions[item.type];
      if (def && def.render) {
        try {
          def.render(item, ctx, camera, screenX, screenY);
        } catch (err) {
          logErrorOnce('fx-render:' + item.type, `[AnimationRegistry] Error en render de FX '${item.type}':`, err);
        }
      }
    }
  }

  function defineFX(type, config) {
    if (!type || !config || typeof config.render !== 'function') {
      console.warn('[AnimationRegistry] defineFX requiere type y función render válida.');
      return;
    }
    fxDefinitions[type] = {
      duration: config.duration || 20,
      update: config.update || null,
      render: config.render
    };
  }

  // ==========================================================================
  // 3. BUFFER CIRCULAR DE ESTELAS (AFTERIMAGES)
  // ==========================================================================
  function recordAfterimage(x, y, facing, sy, sx, flip, color) {
    const slot = afterimages[afterimageHead];
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.facing = facing;
    slot.sy = sy;
    slot.sx = sx;
    slot.flip = flip;
    slot.alpha = 0.58;
    slot.color = color || '#f2d29b';
    afterimageHead = (afterimageHead + 1) % AFTERIMAGE_MAX;
  }

  function updateAfterimages() {
    for (let i = 0; i < AFTERIMAGE_MAX; i++) {
      const slot = afterimages[i];
      if (slot.active) {
        slot.alpha -= 0.048;
        if (slot.alpha <= 0.01) {
          slot.active = false;
          slot.alpha = 0;
        }
      }
    }
  }

  function renderAfterimages(ctx, camera) {
    const camX = camera ? camera.x : 0;
    const camY = camera ? camera.y : 0;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < AFTERIMAGE_MAX; i++) {
      const slot = afterimages[i];
      if (!slot.active || slot.alpha <= 0.01) continue;

      const sx = slot.x - camX;
      const sy = slot.y - camY;
      const cx = sx + 12; // centro horizontal de Ruben (width = 24)
      const feetY = sy + 38; // base de Ruben (height = 38)

      ctx.save();
      ctx.globalAlpha = slot.alpha * 0.65;
      ctx.translate(cx, feetY);

      // Resorte squash & stretch y dirección
      ctx.scale(slot.facing * slot.sx, slot.sy);
      if (slot.flip > 0.01) {
        ctx.rotate(slot.flip * Math.PI * 2);
      }
      ctx.translate(-cx, -feetY);

      // Silueta suave de Ruben estilo años 50 (relleno traslúcido + contorno cálido)
      ctx.fillStyle = slot.color;
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = 1.5;

      // Cuerpo ovalado
      ctx.beginPath();
      ctx.ellipse(cx, sy + 22, 10, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Cabeza redonda
      ctx.beginPath();
      ctx.arc(cx + 1, sy + 10, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bufanda / capa traslúcida
      ctx.beginPath();
      ctx.moveTo(cx - 3, sy + 13);
      ctx.quadraticCurveTo(cx - 12, sy + 21, cx - 10, sy + 29);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  // ==========================================================================
  // 4. API DE ESTADOS SEMÁNTICOS (ZERO ALLOCATION)
  // ==========================================================================
  function getEntityState(entity) {
    if (!entity) return 'idle';

    // 1. Ruben (Player)
    if (typeof entity.jump === 'function' && entity.anim !== undefined) {
      if (entity.dead) return 'death';
      if (entity.anim && entity.anim.hurtFlash > 0) return 'hurt';
      if (entity.isAttacking) return 'attack';
      if (!entity.isGrounded && entity.anim && entity.anim.flip > 0.05) return 'doubleJump';
      if (!entity.isGrounded && entity.vy < 0) return 'jump';
      if (!entity.isGrounded) return 'fall';
      if (entity.carriedItem) return 'carry';
      if (Math.abs(entity.vx) > 0.4) return 'walk';
      return 'idle';
    }

    // 2. Enemigos (CrawlerEnemy, FlyingShadeEnemy)
    if (entity.hp !== undefined && (entity.alive !== undefined || entity.dead !== undefined)) {
      if (entity.dead || !entity.alive || (entity.dyingTimer && entity.dyingTimer > 0)) {
        return 'death';
      }
      if ((entity.hurtTimer && entity.hurtTimer > 0) || (entity.hitCooldown && entity.hitCooldown > 0)) {
        return 'hurt';
      }
      if (
        (entity.alertTimer && entity.alertTimer > 0) ||
        (entity.alert && entity.alert > 0) ||
        entity.state === 'chase' ||
        entity.isChasing
      ) {
        return 'chase';
      }
      return 'patrol';
    }

    // 3. Escombros arrojables (ThrowableDebris)
    if (entity.isCarried !== undefined && entity.isThrown !== undefined) {
      if (!entity.active) return 'death';
      if (entity.isCarried) return 'carry';
      if (entity.isThrown) return 'throw';
      return 'idle';
    }

    return 'idle';
  }

  // ==========================================================================
  // 5. REGISTRO DE CAPAS Y SKINS
  // ==========================================================================
  function registerLayer(target, layerId, config) {
    if (!layersByTarget[target] || !layerId || !config) {
      console.warn(`[AnimationRegistry] registerLayer: target inválido ('${target}') o parámetros faltantes.`);
      return;
    }

    const layers = layersByTarget[target];
    const order = config.order !== undefined ? config.order : 0;
    const enabled = config.enabled !== false;

    // Si ya existe la capa, actualizarla
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].id === layerId) {
        layers[i].order = order;
        layers[i].before = config.before || null;
        layers[i].after = config.after || null;
        layers[i].update = config.update || null;
        layers[i].enabled = enabled;
        layers.sort((a, b) => a.order - b.order);
        return;
      }
    }

    // Nueva capa
    layers.push({
      id: layerId,
      order,
      before: config.before || null,
      after: config.after || null,
      update: config.update || null,
      enabled
    });
    layers.sort((a, b) => a.order - b.order);
  }

  function setLayerEnabled(target, layerId, enabled) {
    const layers = layersByTarget[target];
    if (!layers) return false;
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].id === layerId) {
        layers[i].enabled = Boolean(enabled);
        return true;
      }
    }
    return false;
  }

  function registerSkin(target, skinId, renderFn) {
    if (!skinsByTarget[target] || !skinId || typeof renderFn !== 'function') {
      console.warn(`[AnimationRegistry] registerSkin: datos inválidos para target '${target}' skinId '${skinId}'.`);
      return;
    }
    skinsByTarget[target][skinId] = renderFn;
  }

  function setSkin(target, skinId) {
    if (!skinsByTarget[target]) return false;
    if (skinId !== 'default' && !skinsByTarget[target][skinId]) {
      console.warn(`[AnimationRegistry] Skin '${skinId}' no encontrada para '${target}'.`);
      return false;
    }
    activeSkinByTarget[target] = skinId;
    return true;
  }

  // ==========================================================================
  // 6. ENVOLTORIOS SEGUROS DE PROTOTIPOS (SAFE WRAPPERS)
  // ==========================================================================
  function wrapEntityPrototype(targetKey, ClassRef) {
    if (!ClassRef || !ClassRef.prototype) return;
    if (ClassRef.prototype.__animRegistryWrapped) return;
    ClassRef.prototype.__animRegistryWrapped = true;

    const origRender = ClassRef.prototype.render;
    const origUpdate = ClassRef.prototype.update;

    // Envoltorio de render
    ClassRef.prototype.render = function (ctx, camera) {
      const entity = this;
      const state = getEntityState(entity);
      const layers = layersByTarget[targetKey];

      // 1. Capas BEFORE
      if (layers) {
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          if (layer.enabled && layer.before) {
            try {
              layer.before(entity, ctx, camera, state);
            } catch (err) {
              logErrorOnce('layer-before:' + layer.id, `[AnimationRegistry] Error en capa before '${layer.id}':`, err);
            }
          }
        }
      }

      // 2. Renderizado del Skin o Fallback al Original
      const activeSkinId = activeSkinByTarget[targetKey];
      let customRenderSuccess = false;

      if (activeSkinId && activeSkinId !== 'default') {
        const skinFn = skinsByTarget[targetKey][activeSkinId];
        if (skinFn) {
          try {
            skinFn(entity, ctx, camera, state);
            customRenderSuccess = true;
          } catch (err) {
            logErrorOnce('skin-render:' + activeSkinId, `[AnimationRegistry] Error en skin '${activeSkinId}' de '${targetKey}'. Fallback al render original:`, err);
          }
        }
      }

      if (!customRenderSuccess && origRender) {
        try {
          origRender.call(entity, ctx, camera);
        } catch (err) {
          logErrorOnce('orig-render:' + targetKey, `[AnimationRegistry] Error en render original de '${targetKey}':`, err);
        }
      }

      // 3. Capas AFTER
      if (layers) {
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          if (layer.enabled && layer.after) {
            try {
              layer.after(entity, ctx, camera, state);
            } catch (err) {
              logErrorOnce('layer-after:' + layer.id, `[AnimationRegistry] Error en capa after '${layer.id}':`, err);
            }
          }
        }
      }
    };

    // Envoltorio de update
    if (origUpdate) {
      ClassRef.prototype.update = function (arg1, arg2, arg3) {
        try {
          origUpdate.call(this, arg1, arg2, arg3);
        } catch (err) {
          logErrorOnce('orig-update:' + targetKey, `[AnimationRegistry] Error en update original de '${targetKey}':`, err);
        }

        const layers = layersByTarget[targetKey];
        if (layers) {
          const entity = this;
          for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.enabled && layer.update) {
              try {
                layer.update(entity, 16.666);
              } catch (err) {
                logErrorOnce('layer-update:' + layer.id, `[AnimationRegistry] Error en capa update '${layer.id}':`, err);
              }
            }
          }
        }
      };
    }
  }

  function resolveClass(name) {
    if (typeof window !== 'undefined' && window[name]) return window[name];
    try {
      const fn = new Function('return typeof ' + name + ' !== "undefined" ? ' + name + ' : null;');
      return fn();
    } catch (e) {
      return null;
    }
  }

  function installWrappers() {
    wrapEntityPrototype('player', resolveClass('Player'));
    wrapEntityPrototype('crawler', resolveClass('CrawlerEnemy'));
    wrapEntityPrototype('moth', resolveClass('FlyingShadeEnemy'));
    wrapEntityPrototype('debris', resolveClass('ThrowableDebris'));
    wrapEntityPrototype('world', resolveClass('World'));
  }

  // ==========================================================================
  // 7. DEFINICIÓN DE CLIPS DE EFECTOS (FX) AÑOS 50
  // ==========================================================================

  // FX: Destello estelar de hoja lista ('sword-ready-glint')
  defineFX('sword-ready-glint', {
    duration: 16,
    render(fx, ctx, camera, sx, sy) {
      const p = fx.frame / fx.maxFrames;
      // Curva de destello pop: sube rápido hasta 0.35 y disminuye suave
      const peak = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
      const flare = peak * peak * 13 * fx.scale;
      if (flare <= 0.2) return;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p * 0.35 * fx.dir);

      ctx.fillStyle = '#fffdf0';
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = 1.2;

      // Estrella clásica de 4 puntas estilo cómic/animación tradicional
      const L = flare * 1.25;
      const W = flare * 0.22;
      ctx.beginPath();
      ctx.moveTo(0, -L);
      ctx.quadraticCurveTo(W, -W, L, 0);
      ctx.quadraticCurveTo(W, W, 0, L);
      ctx.quadraticCurveTo(-W, W, -L, 0);
      ctx.quadraticCurveTo(-W, -W, 0, -L);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Centro dorado brillante
      ctx.fillStyle = '#ffd27d';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.5, W * 0.85), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  });

  // FX: Arco caligráfico de tajo ('slash-crescent')
  defineFX('slash-crescent', {
    duration: 12,
    // Viaja pegado a Ruben: si ataca corriendo, el arco no queda atrás (Claude, pedido del usuario)
    update(fx) {
      const t = fx.follow;
      if (!t) return;
      fx.x = t.x + t.width / 2 + fx.offX;
      fx.y = t.y + t.height / 2 + fx.offY;
    },
    render(fx, ctx, camera, sx, sy) {
      const p = fx.frame / fx.maxFrames;
      const ease = 1 - Math.pow(1 - p, 2);
      const alpha = Math.max(0, 1 - p * p) * 0.8;
      const reach = (24 + ease * 22) * fx.scale;
      const swingDir = fx.extra || 1;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sx, sy);
      ctx.rotate(fx.angle);

      ctx.fillStyle = '#fff5dd';
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = Math.max(1, 2.2 * (1 - p));

      // Arco curvado que se afina en ambos extremos como un trazo de pluma
      const arcLen = Math.PI * 0.42;
      const rOuter = reach;
      const rInner = reach * (0.68 - p * 0.25);

      ctx.beginPath();
      ctx.arc(0, 0, rOuter, -arcLen * swingDir, arcLen * swingDir, swingDir < 0);
      ctx.arc(0, 0, Math.max(1, rInner), arcLen * swingDir, -arcLen * swingDir, swingDir >= 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  });

  // FX: Estrella de tajo / explosión estelar de cartoon ('cartoon-star-burst')
  defineFX('cartoon-star-burst', {
    duration: 18,
    render(fx, ctx, camera, sx, sy) {
      const p = fx.frame / fx.maxFrames;
      const alpha = Math.max(0, 1 - p * p);
      const dist = (8 + Math.pow(p, 0.65) * 26) * fx.scale;
      const starR = Math.max(0.6, (4.2 - p * 3.6) * fx.scale);

      ctx.save();
      ctx.globalAlpha = alpha;

      for (let k = 0; k < 5; k++) {
        const ang = k * (Math.PI * 2 / 5) + p * 0.45;
        const px = sx + Math.cos(ang) * dist;
        const py = sy + Math.sin(ang) * dist;

        ctx.save();
        ctx.translate(px, py);
        ctx.fillStyle = '#ffd768';
        ctx.strokeStyle = OUTLINE_COLOR;
        ctx.lineWidth = 1.1;

        // Pequeño diamante / estrella de 4 puntas
        ctx.beginPath();
        ctx.moveTo(0, -starR * 1.3);
        ctx.lineTo(starR * 0.45, 0);
        ctx.lineTo(0, starR * 1.3);
        ctx.lineTo(-starR * 0.45, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
    }
  });

  // FX: Anillo elástico de aterrizaje ('landing-ring')
  defineFX('landing-ring', {
    duration: 20,
    render(fx, ctx, camera, sx, sy) {
      const p = fx.frame / fx.maxFrames;
      const ease = 1 - Math.pow(1 - p, 3);
      const alpha = Math.max(0, (1 - p) * 0.95);

      const rx = (12 + ease * 40) * fx.scale;
      const ry = (3.5 + ease * 7.5) * fx.scale;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Anillo exterior de aire comprimido (onda blanca translúcida)
      ctx.strokeStyle = '#fff8ec';
      ctx.lineWidth = Math.max(1, 3.2 * (1 - p));
      ctx.beginPath();
      ctx.ellipse(sx, sy - 1, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Anillo secundario interno de polvo suave
      ctx.strokeStyle = '#e8d2a6';
      ctx.lineWidth = Math.max(0.8, 1.8 * (1 - p));
      ctx.beginPath();
      ctx.ellipse(sx, sy - 1, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Dos nubecitas de polvo que se separan a izquierda y derecha
      const puffR = Math.max(0.5, (4.5 - p * 3.5) * fx.scale);
      ctx.fillStyle = '#eed9b3';
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.arc(sx - rx, sy - puffR * 0.6, puffR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sx + rx, sy - puffR * 0.6, puffR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  });

  // FX: Gota de sudor cartoon al cargar piedra ('effort-sweat-drop')
  defineFX('effort-sweat-drop', {
    duration: 22,
    update(fx) {
      fx.vy += 0.16; // Gravedad suave
    },
    render(fx, ctx, camera, sx, sy) {
      const p = fx.frame / fx.maxFrames;
      const alpha = Math.max(0, 1 - p * p);
      const r = Math.max(0.8, 3.2 * (1 - p * 0.45));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sx, sy);

      // Forma de lágrima cómic
      ctx.fillStyle = '#85d7f8';
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = 1.1;

      ctx.beginPath();
      ctx.moveTo(0, -r * 1.5);
      ctx.quadraticCurveTo(r * 1.1, -r * 0.2, r, r);
      ctx.arc(0, r, r, 0, Math.PI, false);
      ctx.quadraticCurveTo(-r * 1.1, -r * 0.2, 0, -r * 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Destello blanco en la gota
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-r * 0.3, r * 0.4, Math.max(0.4, r * 0.3), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  });

  // FX: Nubecita de tracción para el escarabajo ('traction-puff')
  defineFX('traction-puff', {
    duration: 14,
    render(fx, ctx, camera, sx, sy) {
      const p = fx.frame / fx.maxFrames;
      const alpha = Math.max(0, 1 - p);
      const r = Math.max(0.6, (4.5 + p * 4) * fx.scale);

      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.fillStyle = '#e8d2a6';
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.arc(sx, sy - r * 0.7, r * 0.8, 0, Math.PI * 2);
      ctx.arc(sx - fx.dir * 4, sy - r * 0.5, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Líneas de velocidad
      ctx.beginPath();
      ctx.moveTo(sx - fx.dir * 8, sy - 2);
      ctx.lineTo(sx - fx.dir * 16, sy - 2);
      ctx.moveTo(sx - fx.dir * 6, sy - 6);
      ctx.lineTo(sx - fx.dir * 12, sy - 6);
      ctx.stroke();

      ctx.restore();
    }
  });

  // ==========================================================================
  // 8. REGISTRO DE CAPAS POR DEFECTO
  // ==========================================================================

  // 1. Estela Acrobática de Doble Salto y Pogo en Ruben
  registerLayer('player', 'acrobatic-trail', {
    order: -10,
    update(player) {
      if (player.dead) return;

      const isDoubleJump = player.anim && player.anim.flip > 0.05;
      const isFastPogoSlash =
        !player.isGrounded &&
        player.isAttacking &&
        player.attackAim > 0.5 &&
        player.vy > 1.2;

      if (isDoubleJump || isFastPogoSlash) {
        trailFrameSkip = (trailFrameSkip + 1) % 2;
        if (trailFrameSkip === 0) {
          const color = isFastPogoSlash ? '#68a878' : '#f2d29b';
          const sy = player.anim ? player.anim.sy : 1;
          const sx = player.anim ? player.anim.sx : 1;
          const flip = player.anim ? player.anim.flip : 0;
          recordAfterimage(player.x, player.y, player.facing, sy, sx, flip, color);
        }
      }
    },
    before(player, ctx, camera) {
      renderAfterimages(ctx, camera);
    }
  });

  // 2. Destello de Hoja Lista, Tajo y Anillo de Aterrizaje
  registerLayer('player', 'player-core-fx', {
    order: 5,
    update(player) {
      if (player.dead) return;

      // Detección de Aterrizaje con impacto (prevVy > 5.5)
      const justLanded = !playerPrevGrounded && player.isGrounded;
      if (justLanded && (playerPrevVy > 5.5 || (player.anim && player.anim.fallSpeed > 5.5))) {
        const impactVy = Math.max(playerPrevVy, (player.anim && player.anim.fallSpeed) || 0);
        const gx = player.x + player.width / 2;
        const gy = player.y + player.height;
        spawnFX('landing-ring', gx, gy, fillOpts(0, 0, 1, 0, Math.min(1.8, 0.75 + impactVy * 0.08), '#f2d29b', 20, 0));
      }
      playerPrevGrounded = player.isGrounded;
      playerPrevVy = player.vy;

      // Destello de Hoja Lista cuando attackCooldown pasa de 2 a 1
      if (playerPrevCooldown >= 2 && player.attackCooldown === 1) {
        const hx = player.x + player.width / 2 + player.facing * 14;
        const hy = player.y + 18;
        spawnFX('sword-ready-glint', hx, hy, fillOpts(0, 0, player.facing, 0, 1, '#f2d29b', 16, 0));
      }
      playerPrevCooldown = player.attackCooldown;

      // Arco caligráfico al iniciar un ataque (attackTimer === attackDuration - 1)
      if (
        playerPrevTimer !== player.attackDuration - 1 &&
        player.attackTimer === player.attackDuration - 1
      ) {
        const aim = player.attackAim || 0;
        const dirX = player.facing * Math.cos(aim);
        const dirY = Math.sin(aim);
        const arcX = player.x + player.width / 2 + dirX * 26;
        const arcY = player.y + player.height / 2 + dirY * 26;
        const crescent = spawnFX('slash-crescent', arcX, arcY, fillOpts(0, 0, player.facing, Math.atan2(dirY, dirX), 1, '#f2d29b', 12, (player.anim && player.anim.swingDir) || 1));
        if (crescent) {
          crescent.follow = player;
          crescent.offX = dirX * 26;
          crescent.offY = dirY * 26;
        }
      }
      playerPrevTimer = player.attackTimer;
    }
  });

  // 3. Esfuerzo Cartoon al Cargar Roca
  registerLayer('player', 'carry-effort', {
    order: 20,
    update(player) {
      if (player.dead) return;

      if (player.carriedItem && Math.abs(player.vx) > 0.4) {
        carryEffortTimer++;
        if (carryEffortTimer >= 22) {
          carryEffortTimer = 0;
          const templeX = player.x + player.width / 2 - player.facing * 4;
          const templeY = player.y + 7;
          const sweatVx = -player.facing * 0.65 + (Math.random() - 0.5) * 0.3;
          spawnFX('effort-sweat-drop', templeX, templeY, fillOpts(sweatVx, -1.75, -player.facing, 0, 1, '#f2d29b', 22, 0));
        }
      } else {
        carryEffortTimer = 0;
      }
    }
  });

  // 4. Aleteo Luminoso en la Polilla (FlyingShadeEnemy)
  registerLayer('moth', 'enemy-toon-fx', {
    order: -5,
    before(moth, ctx, camera) {
      if (!moth.alive) return;
      const cx = moth.x + moth.width / 2 - (camera ? camera.x : 0);
      const cy = moth.y + moth.height / 2 - (camera ? camera.y : 0);

      ctx.save();
      // Halo tenue de polen de trigo
      ctx.fillStyle = 'rgba(255, 235, 160, 0.16)';
      ctx.beginPath();
      ctx.arc(cx, cy, moth.width * 0.72, 0, Math.PI * 2);
      ctx.fill();

      // Mota de polvo brillante flotando tras el aleteo
      const t = Date.now() * 0.005 + moth.originX * 0.01;
      ctx.fillStyle = 'rgba(255, 240, 180, 0.65)';
      for (let k = 0; k < 2; k++) {
        const offX = Math.sin(t + k * 2.1) * (moth.width * 0.45);
        const offY = Math.cos(t * 1.3 + k) * (moth.height * 0.35);
        ctx.beginPath();
        ctx.arc(cx + offX, cy + offY, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  });

  // 5. Nubecita de tracción en el escarabajo (CrawlerEnemy)
  registerLayer('crawler', 'enemy-toon-fx', {
    order: 10,
    update(crawler) {
      if (!crawler.alive) return;

      if (crawler.isChasing || (crawler.alert && crawler.alert > 0)) {
        crawlerPuffTimer = (crawlerPuffTimer + 1) % 9;
        if (crawlerPuffTimer === 0) {
          const puffX = crawler.x + crawler.width / 2 - crawler.facing * (crawler.width * 0.45);
          const puffY = crawler.y + crawler.height;
          spawnFX('traction-puff', puffX, puffY, fillOpts(0, 0, -crawler.facing, 0, 0.85, '#f2d29b', 14, 0));
        }
      } else {
        crawlerPuffTimer = 0;
      }
    }
  });

  // ==========================================================================
  // 9. CONEXIÓN CON GAMEHOOKS DEL MOTOR PRINCIPAL
  // ==========================================================================
  window.GameHooks = window.GameHooks || {
    onInit: [],
    onRoomLoad: [],
    onUpdate: [],
    onRenderWorld: [],
    onRenderHUD: [],
    onAction: []
  };
  window.GameHooks.onInit = window.GameHooks.onInit || [];
  window.GameHooks.onUpdate = window.GameHooks.onUpdate || [];
  window.GameHooks.onRenderWorld = window.GameHooks.onRenderWorld || [];

  // Al inicializar el juego: conectar wrappers y asegurar bucle de update
  window.GameHooks.onInit.push((game) => {
    installWrappers();

    if (game && !game.__animRegistryUpdateHooked) {
      game.__animRegistryUpdateHooked = true;
      const origGameUpdate = game.update;
      game.update = function (dt) {
        origGameUpdate.call(this, dt);

        if (this.isPlaying && !this.isPaused) {
          updateFX(dt || 16.666);
          updateAfterimages();
        }

        // Despachar a otros hooks de onUpdate
        const hooks = window.GameHooks && window.GameHooks.onUpdate;
        if (hooks) {
          for (let i = 0; i < hooks.length; i++) {
            try {
              hooks[i](this, dt);
            } catch (e) {
              console.error(e);
            }
          }
        }
      };
    }
  });

  // Renderizar clips FX en el espacio del mundo tras las entidades
  window.GameHooks.onRenderWorld.push((game, ctx, cam) => {
    renderActiveFX(ctx, cam);
  });

  // Instalar wrappers de inmediato si las clases ya están presentes en el scope
  installWrappers();

  // ==========================================================================
  // 10. EXPOSICIÓN DE LA API PÚBLICA
  // ==========================================================================
  const AnimationRegistryAPI = {
    version: '1.0.0',
    getEntityState,
    registerLayer,
    setLayerEnabled,
    getLayers: (target) => (layersByTarget[target] ? layersByTarget[target].slice() : []),
    registerSkin,
    setSkin,
    getActiveSkin: (target) => activeSkinByTarget[target] || 'default',
    defineFX,
    spawnFX,
    clearFX: () => {
      for (let i = 0; i < FX_POOL_SIZE; i++) fxPool[i].active = false;
      activeFXCount = 0;
      for (let i = 0; i < AFTERIMAGE_MAX; i++) afterimages[i].active = false;
    },
    getFXCount: () => activeFXCount
  };

  window.AnimationRegistry = AnimationRegistryAPI;
  window.AnimSystem = AnimationRegistryAPI; // Alias
})();
