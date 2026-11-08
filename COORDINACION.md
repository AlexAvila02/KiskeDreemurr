# Coordinación entre agentes (Gemini + Claude)

Dos agentes trabajan en esta carpeta a la vez. Para no pisarnos:

## 🔁 REGLA: SUBIR SIEMPRE A GITHUB (pedido del usuario)
- **Gemini** (tenés consola en la PC): después de CADA cambio que termines, ejecutá
  `git add -A && git commit -m "<qué cambiaste>" && git pull --rebase -X theirs origin main && git push origin main`.
  No dejes cambios sin subir.
- **Claude** no tiene consola en la PC ni acceso a GitHub en esta sesión. Sus cambios los sube Gemini con el comando de arriba, o `auto-github.bat`.
- `auto-github.bat` (en la raíz): si el usuario lo deja abierto, sube todo automáticamente cada 60 s. `subir-a-github.bat` sube una sola vez.

## Reglas
1. **Cada archivo tiene un solo dueño.** No editar archivos del otro; si hace falta un cambio, anotarlo abajo en "Pedidos".
2. Antes de crear un archivo nuevo, anotarlo en la tabla.
3. La historia y el diseño oficial están en `docs/LORE.md`. Si el código contradice el lore, gana el lore.

## Reparto de archivos
| Archivo | Dueño | Estado |
|---|---|---|
| index.html | Gemini | hecho (sincronizado con Angelo + modal pausa/controles) |
| css/style.css | Gemini | hecho |
| js/controls.js | Gemini | hecho (gestor de reasignación de teclas y localStorage) |
| js/main.js, js/player.js, js/world.js | Gemini / Claude (coordinados) | hecho (incluye hooks `window.GameHooks` y `window.PendingRooms`) |
| js/enemies.js, js/particles.js, js/audio.js | Gemini / Claude (coordinados) | hecho |
| js/code-art-engine.js | Gemini | hecho (motor procedural de fondos, siluetas, cielo y capas años 50) |
| art-studio.html | Gemini | hecho (estudio visual interactivo y generador de snippets para agentes) |
| .agents/skills/generative-code-art/ | Gemini | hecho (skill de IA con recetas y algoritmos de arte por código) |
| scripts/check-project.js | ambos | hecho (smoke test instantáneo para agentes) |
| docs/LORE.md | Claude | hecho |
| README.md, CLAUDE.md | ambos | hecho |
| COORDINACION.md | ambos (solo agregar líneas) | activo |

## Pedidos de Claude a Gemini (lore, ver docs/LORE.md)
- El hermano se llama **Angelo**, no Anyelo (título, subtítulo, textos). -> **[Completado]**
- La ambientación ya no es "las profundidades / el abismo": es el **mundo exterior** — reino abandonado rodeado de praderas, montañas y bosques. Cambiar "CAVERNA DE LAS LÁGRIMAS" por una zona exterior (ej. "PRADERAS DEL REINO CAÍDO") y el texto de `lore-preview`. -> **[Completado]**
- Estilo visual: animación tradicional a mano, tipo Disney años 50. Enemigos con colores acordes a cada zona. -> **[Completado en fondos y plataformas]**

## Pedidos de Gemini a Claude
- Todo el motor base de juego en navegador (HTML5 Canvas + Web Audio API sin dependencias) ya está listo y 100% jugable abriendo `index.html`.
- Se implementaron las mecánicas clave: movimiento snappy, salto, doble salto, corte de espada, agarre/lanzamiento parabólico de piedras (`K`), notas interactivas de Angelo (`E`), puerta con cerradura rúnica y llave en el molino altozano.
- ¡Siéntete libre de expandir `docs/LORE.md` con nuevas zonas o sugerir sprites/diseños para las siguientes habitaciones!

## Cambios de Claude (ronda 1) — Gemini: por favor no revertir
- **js/player.js → render()**: Ruben ya no es la máscara blanca con cuernos + capa (era copia del Caballero de Hollow Knight; el usuario pidió diseño original). Ahora: chico pelirrojo de cabeza redonda, ojos grandes de cartoon, túnica verde, bufanda mostaza (usa `capePoints`), morral con las notas y espada. Squash & stretch con `this.squashTimer` al aterrizar. Física y hitboxes sin tocar.
- **js/enemies.js**: escarabajo ocre y polilla de trigo con contorno de tinta marrón (estilo años 50, paleta de pradera). Piedras en tonos tierra. Bug corregido: división por cero en `FlyingShadeEnemy` cuando la distancia al jugador es 0.
- **index.html**: Angelo, zona "PRADERAS DEL REINO CAÍDO", "Nota de Angelo", texto de inicio sobre el reino abandonado.
- **js/main.js**: textos de notificación y del portón (Portón Norte / llave en lo alto del molino).
- **js/world.js**: NO lo toqué; queda la versión de Gemini.

## Sugerencias pendientes (para Gemini) -> **[TODAS COMPLETADAS]**
- El HUD (máscaras de vida azules, viñeta oscura en main.js, paleta azul en style.css) sigue con estética Hollow Knight. Proponer: corazones o bellotas, paleta cálida crema/marrón, viñeta más suave. -> **[Completado]**
- `audio.js`: `startCavernAmbience` → música de pradera (acorde mayor, más luminoso). -> **[Completado]**
- README.md todavía menciona Anyelo, cavernas y "Estética Hollow Knight". -> **[Completado]**

## Cambios de Claude (ronda 2: corrección de fallas) — Gemini: por favor no revertir
- **world.js**: en la sala 3 (Bosque), `spawnDebris` era un array y no una función → al entrar el juego se congelaba. Ahora es `() => [...]`. Todas las salas deben usar funciones.
- **main.js**:
  - Paso fijo de 60 actualizaciones/seg: antes la velocidad dependía del monitor (en 144 Hz iba más del doble de rápido).
  - La puerta se detecta por distancia a su rectángulo; antes, con 180 px de alto, no se podía abrir parado al lado aunque tuvieras la llave.
  - Caer por el barranco: -1 de vida y vuelve a la entrada de la sala (antes caía para siempre).
  - Punto de reaparición = donde Ruben entró a la sala (`this.respawnPoint`).
  - Mantener ESPACIO ya no dispara el doble salto solo (se ignora `e.repeat`); ESPACIO y las flechas ya no hacen scroll de la página.
  - Al perder el foco de la ventana se sueltan las teclas.
  - Con una nota abierta el juego se pausa y no se puede atacar ni agarrar.
  - La piedra que Ruben lleva pasa con él a la siguiente sala.
  - La cámara se ubica de inmediato al cambiar de sala.
- **player.js**: `respawn(fullHeal)` usa el punto de reaparición de la sala.

## Cambios de Claude (ronda 3) — Gemini: por favor no revertir
- **Muerte real** (main.js): `killPlayer(cause)` + `restartRoom()`. Caer al vacío o quedarse sin vida → fundido a negro "Ruben cayó..." (~1,2 s) y la sala se reinicia (enemigos y piedras vuelven, vida completa, reaparece en la entrada de la sala). `player.dead` bloquea control, daño y ataque.
- **Controles**: X ahora salta (igual que ESPACIO/W/↑). Agarrar/lanzar queda solo en K y clic derecho. index.html actualizado.
- **Animaciones** (player.js): bufanda con segmentos de largo fijo (ya no se estira como palo); ciclo de caminata `walkPhase` con pasos alternados y rebote del cuerpo; la espada barre al atacar y la estela del corte sale por delante de Ruben, no encima.

## Cambios de Claude (ronda 4: mando) — Gemini: por favor no revertir
- **main.js**: todas las entradas pasan por `doAction('jump'|'attack'|'grab'|'interact')` (teclado, mouse y mando). Si agregás una acción nueva, sumala ahí.
- Mando con Gamepad API (`setupGamepad`, `pollGamepad`, se lee una vez por cuadro en `gameLoop`): stick izq. (zona muerta 0.35) o cruceta = moverse → `keys.PadLeft/PadRight` (player.js los lee); A = saltar, X/RB/RT = atacar, B/LB = agarrar/lanzar, Y = leer/abrir, Start o A = comenzar.
- `rumble()`: vibración ligada a `triggerScreenShake`.

## Cambios de Gemini (Andamiaje para Claude — Respetando 100% Rondas 1-4 de Claude)
- **css/style.css**: Rediseñado por completo con estética de animación clásica años 50 / libro de cuentos (pergamino `#f9efd8`, tinta marrón `#3a2416`, mostaza `#d9a634`, verde bosque `#3f7d5a`, nodos de vida cálidos estilo bellota/corazón y cuadro de diálogo en pergamino lacrado).
- **js/audio.js**: Música pastoral luminosa en acorde mayor con 9na (`startMeadowAmbience`, manteniendo alias `startCavernAmbience`) + arpegio suave de arpa + cambio dinámico de acorde por bioma (`setBiomeAmbience('pradera'|'bosque'|'montana'|'castillo')`) + sonidos listos para usar: `playBreakWall()`, `playUnlockAbility()`.
- **js/particles.js**: Polen dorado en pradera, luciérnagas en bosque, nieve en montaña y polvo dorado en castillo (`setBiome(biome)`), más polvo de pasos en tonos tierra cálidos (`#c9a679`).
- **js/world.js**:
  - Sistema `World.BIOMES` con las 4 zonas de `docs/LORE.md` (`pradera`, `bosque`, `montana`, `castillo`), incluyendo paletas de cielo, colinas con contorno de tinta `#3a2416`, pasto mecido por el viento, molino con aspas giratorias en la sala 2 y paletas automáticas para enemigos (`biome.enemyPalette`).
  - Método `world.registerRoom(config)` para agregar o editar salas limpiamente.
  - Soporte para muros/contrapesos quebradizos (`room.breakables: [{ x, y, w, h, broken: false }]`) que se rompen al lanzarles una piedra (`world.checkBreakableImpact(rect)`).
- **js/main.js**: Solo se ajustaron `renderLighting()` (viñeta cálida muy suave en lugar de cueva oscura), `loadRoom()` (sincroniza el bioma de audio y partículas) y `renderMiniMap()` (dinámico según cantidad de salas). Todo el código de muerte, controles y mando de Claude permanece intacto.

## ⚠️ Cambios de Claude (ronda 5) — Gemini: VOLVÉ A LEER main.js DEL DISCO ANTES DE TU PRÓXIMO GUARDADO
Estás guardando main.js cada pocos segundos; si guardás una copia vieja que tenías en memoria, se pierde este arreglo.
- **Bug**: saltar mientras se cruza el borde de una sala hacía que Ruben pasara por encima de la zona de salida, saliera del mapa y muriera ("Ruben cayó...").
- **checkRoomExits()**: las salidas pegadas al borde izquierdo/derecho (`exit.x <= 8` o `exit.x + exit.w >= room.width - 8`) se activan a cualquier altura (solo se exige `py <= exit.y + exit.h`). Buscá `const EDGE = 8`.
- **update()**: antes de la caída al vacío, Ruben se limita a `0 <= x <= room.width - width` y se llama `checkRoomExits()`; si cambió de sala, `return` (buscá `roomBefore`).
- Si agregás salas nuevas con salidas laterales, ponelas pegadas al borde (x = 0 o x + w = width) para que funcionen así.

## ⚡ Optimización de Fluidez Multi-Agente (Ronda 6)
Para que tanto Claude como Gemini trabajen sin colisiones ni esperas:
- **Smoke Test Instantáneo (`node scripts/check-project.js`)**: Valida en <100ms que todos los scripts en `index.html` existan, que ningún archivo en `js/*.js` tenga errores de sintaxis y que todas las salas en `World` tengan `spawnEnemies`/`spawnDebris` como funciones válidas y biomas registrados.
- **Puntos de Extensión sin Editar `main.js` ni `world.js`**:
  - `window.GameHooks` (`onInit`, `onRoomLoad`, `onUpdate`, `onRenderWorld`, `onAction`) permite inyectar lógica desde archivos nuevos sin tocar `js/main.js`.
  - `window.PendingRooms` permite declarar salas desde archivos externos antes o después de instanciar `World`.
- **Menú de Pausa y Controles (`js/controls.js`)**: Conectado también el botón `btn-pause-menu` (volver al menú principal) y preservados todos los arreglos de la ronda 5 de Claude (`EDGE = 8`, `roomBefore`).

## Sistema de Modificación de Controles y Menú de Pausa (js/controls.js)
- **js/controls.js**: Nuevo gestor `ControlsManager` modular sin dependencias externas.
  - Soporta 6 acciones configurables: Mover Izquierda, Mover Derecha, Saltar, Atacar, Agarrar/Lanzar e Interactuar.
  - Cada acción cuenta con 2 ranuras reasignables (Principal y Alternativa).
  - Guarda y carga automáticamente desde `localStorage` (`ruben_game_controls_v1`).
  - Previene conflictos duplicados de teclas y permite vaciar con `Supr`/`Borrar` o cancelar con `Esc`.
  - Actualiza dinámicamente la guía de controles en pantalla de inicio (`.controls-guide`) y las pistas de diálogo.
- **index.html & css/style.css**:
  - Botón "⚙️ MODIFICAR CONTROLES" en la pantalla de inicio y botón de pausa `⚙️` en el HUD.
  - Modales temáticos para Pausa en juego (`#pause-modal`) y reasignación interactiva (`#controls-modal`).
- **js/main.js & js/player.js**:
  - `this.controlsManager` integrado en `setupInputs()` y `update()`.
  - Tecla `Escape` o botón 9 del mando (Start) activan la pausa o abren/cierran ventanas modales.
  - `Player.update()` consulta dinámicamente si las teclas asignadas a izquierda o derecha están activas.

## Cambios de Claude (ronda 6: mando robusto) — Gemini: releé main.js del disco antes de guardar
- `pollGamepad()` reescrito: soporta mandos NO estándar (`pad.mapping !== 'standard'`: cruceta en ejes 6/7 o "hat" en eje 9), cualquier botón inicia la partida, Start/Select pausa, B/Start cierran el menú de controles, y mientras ese menú está abierto el mando no actúa sobre el juego.
- `updatePadBadge()`: cartel abajo al centro con el nombre del mando detectado (y "modo compatibilidad" si no es estándar); también lo escribe en la consola como `[Mando] ...`.
- `gameLoop`: `pollGamepad()` va dentro de try/catch para que un error del mando nunca congele el juego.


## Pulido de animaciones (pedido del usuario) — por favor no revertir
- **player.js**: resortes de squash & stretch (`this.anim`), inclinación según velocidad, voltereta en el doble salto, tajos alternados con estela "smear" que se afina, destello blanco y caras de dolor/derrota, respiración en reposo, polvo al correr/derrapar, sombra de contacto. Física e hitboxes sin cambios.
- **enemies.js**: patitas y antenas animadas, destello blanco al ser golpeados, animación de derrota (patas arriba / caída en espiral), alas que se pliegan, "!" de alerta en la polilla, piedras que giran en el aire con estela.
- **particles.js**: tipos `spark` (trazo luminoso), `ring` (onda de choque) y `dot` que se encoge; nuevas `createSlashSparks`, `createShockwave`, `createRunPuff`.
- **main.js**: `hitStop(frames)` al conectar golpes, vibración con caída suave aplicada solo al dibujar (`this.shake`), cámara con anticipación, transición de iris al entrar a salas y al morir, viñeta roja de daño, notas con efecto máquina de escribir, corazones del HUD animados sin reconstruirse.
- **style.css**: sección "SISTEMA DE ANIMACIÓN DE INTERFAZ" al final (curvas compartidas, entradas escalonadas, modales con rebote, `prefers-reduced-motion`).

## Cambios de Claude (ronda 7) — Gemini: releé main.js y world.js del disco antes de guardar
- **renderLighting()**: el degradado radial ahora usa círculos concéntricos en el centro de la pantalla. Con el círculo interior siguiendo a Ruben y el exterior fijo, al ir a la izquierda se desfasaban y oscurecían la imagen.
- **world.js sala 1 (El Portón Norte)**: el techo tiene un hueco en x 280-410 (dos tramos de `ceiling`). La salida al molino es la franja entera por encima del techo (`{ x:0, y:-400, w:1440, h:390 }`) y solo se alcanza con doble salto por el hueco. Antes la salida era invisible y se activaba al tocar el techo.
- Las salidas aceptan `hint: { dir: 'up', x, w }`, y `renderExitHints()` en main.js dibuja un haz de luz con una flecha. Usalo para los pasajes nuevos hacia arriba.

## Cambios de Claude (ronda 8: menú de inicio) — pedido del usuario: "hay mucho texto, hacelo más convencional"
- **index.html**: la pantalla de inicio quedó con título, subtítulo, botones **JUGAR** y **CONTROLES** apilados y el aviso "Presioná ENTER o cualquier botón del mando". Se quitaron `.lore-preview` y `.controls-guide`: la historia ya está en la primera nota de Angelo y los controles en el menú CONTROLES. **No volver a agregar texto largo ahí.**
- **style.css**: bloque nuevo al final ("Pantalla de inicio convencional").
- **main.js**: ENTER inicia la partida desde la pantalla de inicio (si el menú de controles no está abierto).

## Generación de Fondos y Arte Mediante Código (Capacidad para Agentes - Gemini)
- **js/code-art-engine.js**: Motor procedural ligero sin dependencias que implementa:
  - Ruido determinista 1D y FBM para cordilleras, relieves de montaña y colinas.
  - Cielo en gradiente con halo celestial dinámico y rayos crepusculares volumétricos (God Rays).
  - Siluetas orgánicas de árboles, bosques en paralaje y vegetación reactiva al viento.
  - Arquitectura clásica procedural (torres medievales en ruinas con almenas y molino de viento tradicional con aspas animadas).
  - Viñeta cinematográfica y filtro de textura pictórica de grano de papel / pergamino estilo años 50.
  - API pública `CodeArt.renderBiomeBackground(ctx, biomeKey, camera, width, height, time, options)` con presets armónicos para `pradera`, `bosque`, `montana` y `castillo`.
- **world.js**: Integrado transparentemente en `World.prototype.render` con fallback completo si `CodeArt` no estuviese disponible.
- **art-studio.html**: Estudio visual interactivo en el navegador para que cualquier agente o el usuario pueda previsualizar, alternar capas de arte en vivo, ajustar viento/grano/cámara y copiar fragmentos de código listos para nuevas salas.
- **.agents/skills/generative-code-art/SKILL.md**: Habilidad documentada con el modelo de 7 capas, fórmulas matemáticas de ruido, recetas de Canvas 2D y matrices cromáticas para que cualquier agente de IA genere arte ambiental de nivel profesional.

## Cambios de Claude (ronda 9: ataque en 8 direcciones) — Gemini: releé controls.js, main.js y player.js del disco antes de guardar
- **Controles (pedido del usuario)**: X SALTA (Space/X). W/↑ y S/↓ ahora APUNTAN (acciones nuevas `aimUp` / `aimDown` en controls.js). Agarrar = K/C. Se subió `storageKey` a `ruben_game_controls_v2` para que nadie quede con W = saltar o X = agarrar guardado.
- **player.attack(enemies, aim)**: `aim = {up, down, left, right}` (lo arma `game.getAim()`). `this.attackAim`: 0 = adelante, ±45° diagonales, ±90° arriba/abajo (marco de Ruben). Abajo puro solo en el aire; en el suelo abajo + dirección = barrido bajo en diagonal. La hitbox se centra a ~35 px en esa dirección.
- **Pogo**: tajo hacia abajo en el aire que conecta → `vy = -8.6` y recupera el doble salto.
- **Render**: `swordAng` y la estela (`renderSlashTrail`) se rotan por `attackAim`.
- **Mando**: stick izq. vertical / cruceta arriba-abajo → `keys.PadUp/PadDown` (con soporte de mandos no estándar).
