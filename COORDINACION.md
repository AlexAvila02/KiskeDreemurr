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

## Cambios de Claude (ronda 11): notas con el mismo cuadro que los avisos (pedido del usuario)
- **style.css** (bloque al final): `.dialog-box` ahora usa el estilo de `.notification`: cápsula oscura `rgba(48,30,18,.94)`, borde `#d9a634`, radio 20px, texto `#fff2d0`, arriba al centro (`top: 76px`), máx. 560px. Se mantienen el efecto máquina de escribir, la pausa y la forma de cerrar.
- **main.js `showDialog()`**: oculta el aviso activo para que no se encime con la nota.
- Cualquier texto nuevo del juego (carteles, diálogos, avisos) debe usar este mismo estilo.

## Cambios de Claude (ronda 12): notas automáticas y sin pausa (pedido del usuario)
- Las notas de Angelo **se muestran solas** al pasar por encima (`updateNearbyNote()`, se llama cada cuadro en `update`) y **se ocultan al alejarse**. No hace falta apretar E.
- **El juego ya no se congela** con un texto abierto: se quitó la pausa de `update()` y `doAction()` ya no bloquea acciones con la nota visible.
- El mensaje del "Portón Cerrado" (con E) también se oculta solo al alejarse (`activeNote = room.door`).
- `showDialog(speaker, text, auto)`: con `auto = true` no se muestra "Presiona E para cerrar". `hideDialog()` lo oculta.
- **No volver a pausar el juego por los textos.**

## Mejora de Lógica y Física de Enemigos (`js/enemies.js` - Gemini)
- **Física y Colisión con Paredes / Plataformas (`aabbOverlap`, `moveWithCollisions`)**:
  - Ningún enemigo ni objeto arrojable puede atravesar paredes, suelos, techos, muros quebradizos ni el portón cerrado.
  - `FlyingShadeEnemy` (Polilla) resuelve colisiones separadas en ejes X e Y, deslizándose suavemente por paredes y plataformas en lugar de atravesarlas.
  - `CrawlerEnemy` (Escarabajo) tiene gravedad real, detección de suelo firme un paso adelante (`hasGroundAhead`) para no caer al vacío ni flotar fuera de plataformas, y rebota/gira limpiamente al tocar muros o bordes de sala.
- **Cero Teletransportación (`FlyingShadeEnemy` y `CrawlerEnemy`)**:
  - Eliminado el bug en `FlyingShadeEnemy` donde al salir Ruben del radio de detección se asignaba `this.y = this.originY + Math.sin(...)` directamente, causando un teletransporte instantáneo de regreso a su altura de origen. Ahora regresa volando suavemente con velocidad e inercia (`this.vx`, `this.vy`) hacia su ruta de patrulla.
  - Eliminado el bucle de giro infinito en `CrawlerEnemy` tras ser empujado por knockback fuera de su `patrolDistance`.
- **Línea de Visión (`hasLineOfSight` con algoritmo Liang-Barsky)**:
  - Tanto la polilla como el escarabajo verifican que no haya plataformas ni muros entre ellos y Ruben antes de iniciar o mantener la persecución.
  - El escarabajo también detecta a Ruben cuando está en su misma plataforma/altura y acelera su embestida con un aviso `!`.

## Cambios de Claude (ronda 13: niveles nuevos, Diario y fondo continuo) — pedido del usuario
Archivos NUEVOS (dueño Claude): `js/bg-continuity.js`, `js/levels-expansion.js`, `js/journal.js`, `css/journal.css`.
Solo se tocaron líneas en `index.html` (1 `<link>` + 3 `<script>` antes de main.js) y `scripts/check-project.js` (carga `js/levels-*.js` y valida coleccionables/destinos). **No se editaron main.js, world.js, player.js ni code-art-engine.js.**
- **Fondo continuo entre secciones** (`bg-continuity.js`): envuelve `CodeArt.renderBiomeBackground`. Al cambiar de sala, el fondo arranca exactamente con la posición de paralaje del último cuadro de la sala anterior (cámara de fondo = cámara de sala + desplazamiento). Si cambia el bioma, se ve el paisaje anterior y se funde con el nuevo a medida que Ruben avanza (~720 px). El molino se dibuja con la cámara real de la sala.
- **Salas 4-10** (`levels-expansion.js`, vía `window.PendingRooms`): 4 Claro de las Luciérnagas, 5 Raíces del Roble Viejo (muro de raíces quebradizo + subida por el hueco de las copas), 6 Senda de la Montaña Gris, 7 Cornisa del Viento Helado, 8 Puente del Paso Helado (rastrillo quebradizo), 9 Murallas del Castillo, 10 Salón del Trono Olvidado. **IDs 4-10 ocupados**: si agregás salas, usá 11 en adelante.
  - En `onInit` se parchea la sala 3: se quita su muro derecho y se agrega la salida a la sala 4. También se agregan Emblemas a las salas 0, 2 y 3.
  - Salidas con `hint: { dir: 'down', x, w }` dibujan una flecha hacia abajo (la dibuja journal.js).
- **Objetos** (`room.collectibles: [{ item, x, y }]`, x/y = centro): llave (derivada de `player.keys`), emblema (se acumula, +1 punto), pañuelo, mapa, brújula, campanilla, retrato, sello.
- **Diario de Ruben** (`journal.js`): I o Tab (si no están asignadas), botón "Diario" del HUD, "📖 DIARIO DE RUBEN" en la pausa, 🎮 Select. Pestañas OBJETOS · VIRTUDES · NOTAS DE ANGELO (Q/E o LB/RB). Pausa el juego mientras está abierto.
- **Árbol de virtudes pasivas**: Corazón (+1 vida, regenera 1 corazón tras 15 s sin daño, +1 vida e invulnerabilidad más larga) · Espada (+50% daño, ataque más rápido, botín: doble Valor y corazones) · Ingenio (+12% velocidad, piedras al doble de daño y más alcance, saltos +10%). Puntos = emblemas + 1 cada 5 de Valor (enemigos derrotados). Guardado en `localStorage['ruben_diario_v1']`.
  - Se aplica envolviendo `player.attack`, `player.interactOrThrow`, `player.takeDamage`, `game.update`, `game.loadRoom` y `game.togglePause`; amplía `MenuNavigator` (getActiveMenu/handlePad) para el mando. Si cambiás esas firmas, avisá.
- Nota: `GameHooks.onUpdate`, `onRoomLoad` y `onAction` están declarados en main.js pero nunca se llaman; por eso el Diario envuelve `update`/`loadRoom` directamente.

## 🛡️ Reglas de convivencia (pedido del usuario, 8/11) — leer `AGENTS.md`
Las reglas obligatorias para Gemini y Claude están en `AGENTS.md`, sección "Convivencia con Claude". Resumen: releer del disco antes de guardar · archivos de Claude: `js/menu-nav.js`, `js/bg-continuity.js`, `js/levels-expansion.js`, `js/journal.js`, `css/journal.css`, `docs/LORE.md` · no romper APIs compartidas (crash del pool de partículas) · sin ES Modules ni npm · probar jugando · `git add` solo de archivos propios, sin force push ni reset · nada de `destination-out` en el canvas principal · documentar solo lo que existe · salas nuevas desde id 11.
- Arreglo (Claude): crash al iniciar → `particleSystem.clear()` en `particles.js` (repara el pool si alguien lo vacía) y `main.js` lo usa al cargar sala.
- Playtest (Claude, 8/11 21:15): con `js/animation-registry.js` de Gemini (commit 7494c89) el juego arranca y recorre las 11 salas sin errores de consola.

## 🧭 Reparto de trabajo (decisión del usuario, 8/11)
Claude = desarrollador principal (núcleo, física, depuración, playtest, GitHub). Gemini (Argon low + Flash low) = zona libre de arte (`code-art-engine.js`, `animation-registry.js`, `particles.js`, `art-studio.html`), audio (`audio.js`), estilo (`css/style.css`), `GDD.md` y contenido nuevo en archivos propios (`js/levels-gemini-*.js`, `js/enemies-gemini-*.js`, `js/fx-*.js`). Detalle completo en `AGENTS.md`.

## 📌 Decisiones del usuario
- **Anochecer por tiempo real (~3 min)**, versión de Gemini, aprobada por el usuario (8/11). No volver al anochecer por avance sin que el usuario lo pida.

## Tareas para Gemini
Formato: `- [pendiente | en curso | hecha — falta playtest | cerrada] Título — qué lograr, archivos permitidos, quién la pidió.`
- (ninguna por ahora)

## Cambios de Gemini — falta playtest
Formato: `- [fecha] Qué cambió · archivos · qué probar.` Claude lo prueba y lo marca ✅ o anota el problema.
- [8/11] Confirmación en dos pasos para aprender virtudes con mando/teclado (pedido del usuario): apretar A sobre el nodo de la virtud mueve el foco al botón APRENDER; un segundo A sobre APRENDER la compra y devuelve el foco al nodo, o B/Esc cancela y vuelve al nodo · `js/journal.js` · abrir Diario (Select / I) → pestaña VIRTUDES → seleccionar virtud disponible con A → confirmar en APRENDER con A (o cancelar con B).
- [8/11] Habilidad "Jalar el Aire" bloqueada hasta leer el pergamino de aire en Sala 1 (pedido del usuario): al iniciar una partida la habilidad está inactiva; al leer la nota celeste en la sala 1 (El Portón Norte) se desbloquea con fanfarria sonora, partículas y aviso; persiste en guardado y se resetea al reiniciar partida · js/wind-pull.js, js/world.js · iniciar juego en sala 0 → intentar Abajo+F (no debe hacer nada) → ir a sala 1 → leer nota celeste → recibir aviso de habilidad aprendida → probar Abajo+F (debe jalar el aire normalmente).

## Propuestas de Gemini
- (ninguna por ahora)


## Cambios de Claude (8/11 noche): "Reiniciar juego" + íconos sin emojis — pedido del usuario
- **Reiniciar juego** en el menú de pausa (`#btn-pause-newgame`, debajo de "Reiniciar sala"). Pide confirmación: el primer clic/A muestra "¿SEGURO? SE BORRA TODO" (4 s), el segundo reinicia. `game.restartGame()` en `main.js`: crea un `World` nuevo, deja muros/objetos/llave/portón como al principio, Ruben en la sala 0 sin llave y con vida completa, y llama a **`GameHooks.onRestartGame`** (nuevo). `levels-expansion.js` vuelve a parchear las salas 0-3 y `journal.js` borra el Diario (objetos, notas, Valor y virtudes).
- **Íconos SVG en lugar de emojis** (`js/ui-icons.js` + `css/ui-icons.css`, cargados antes que el resto): HUD (llave, piedra, engranaje de pausa), botones de pausa, pistas de mando/ratón, íconos de la lista de controles (`controls.js`), botón del Diario. En HTML: `<span class="ui-icon" data-icon="nombre"></span>`; en JS: `UIIcons.svg('nombre')`. La llave del molino en el mundo ahora se dibuja con `JournalData.drawIcon('llave')` (con respaldo al emoji). Gemini: si agregás UI nueva, usá estos íconos en vez de emojis.
- Playtest: reiniciar desde la sala 5 con llave, virtudes y muro roto → vuelve a la sala 0 con todo como nuevo; caminar y saltar ok; sin errores de consola.
- (8/11 21:58) Controles: se quitó la franja chica de "ratón/mando" (`.controls-aux-info`) y ahora son filas normales al final de la lista, con encabezado "Ratón y mando" y columnas Ratón / Mando (`ControlsManager.renderMousePadRows()`, filas fijas `.control-row-fixed`, no reasignables).

## Cambios de Claude (8/11 22:40): terreno con detalle por zona — pedido del usuario
- Nuevo `js/terrain-art.js` (dueño Claude, cargado después de code-art-engine.js): suelo, plataformas, techos, paredes y muros quebradizos pintados a mano según la zona. Pradera: tierra con piedritas, raíces, pasto con matas y florcitas. Bosque: musgo, helechos, hongos, musgo y enredaderas colgando. Montaña: roca gris azulada, nieve redondeada, carámbanos, escarcha y destellos. Castillo: sillares, adoquines, alfombra roja con borde dorado, bóvedas y hiedra. Muros quebradizos: raíces enredadas (bosque), rastrillo de hierro oxidado (montaña/castillo), piedra agrietada (pradera).
- Rendimiento: cada plataforma se pinta una sola vez en un lienzo en caché (WeakMap) y se copia con drawImage; en vivo solo se dibuja el pasto meciéndose y los destellos de nieve. Mismos FPS medidos con y sin el terreno nuevo.
- `world.js`: el bucle de plataformas y el de muros quebradizos llaman a `TerrainArt.drawPlatform/drawBreakable` si existe (el dibujo anterior queda como respaldo). Colisiones sin cambios.
- Playtest: salas 0, 1, 3, 5, 7, 8, 9 y 10 recorridas; sin errores de consola.

## Arreglo de Claude (8/11 22:55): Portón Norte — pedido del usuario
- Se podía pasar por encima del Portón Norte (sala 1) sin la llave rebotando en una polilla + doble salto: había 260 px libres entre el techo y la puerta. Ahora hay un muro de piedra (`type: 'wall'`, x 1054, y 0, h 284) que une el techo con la puerta.
- Reaparición: al cruzar el portón abierto, el punto de reaparición pasa al otro lado de la puerta (y viceversa al volver). Antes, morir apenas pasado el portón te devolvía al principio de la sala, antes de la puerta.
- `main.js update()`: si Ruben muere en el cuadro (golpe de enemigo) ya no se revisan salidas en ese cuadro, así siempre reaparece en la sala donde murió.
- Playtest: saltos contra la puerta cerrada desde 5 alturas → no pasa (x máx 1036); morir pasando el portón → reaparece en x 1116 del lado de adentro; morir al entrar a una sala nueva → reaparece en esa sala.

## Cambios de Claude (8/11 22:54): Pergamino de aire en Sala 1 — pedido del usuario
- `world.js`: la nota de Angelo en la Sala 1 (El Portón Norte) ahora lleva `style: 'aire'`, dibujándose como un pergamino celeste translúcido con brillo y sello azul claro, representando el recuerdo del aire. Colisiones y lectura intactas.

## Cambio de Claude (8/11 23:05): ganancia de virtudes 80% menor — pedido del usuario
- `journal.js`: los puntos de virtud ahora salen de "fragmentos": Emblema = 5, enemigo derrotado = 1 (2 con Botín del Cazador), **25 fragmentos = 1 punto** (antes: Emblema = 1 punto, 5 enemigos = 1 punto). El subtítulo del Diario muestra "PRÓXIMO PUNTO x/25". Las virtudes ya aprendidas en partidas guardadas se conservan.

## Cambio de Claude (8/11 23:40): habilidad "Jalar el Aire" — pedido del usuario
- Nuevo `js/wind-pull.js` (dueño Claude, cargado antes de main.js). Mantener **Abajo + L2** (mando) o **Abajo + F / Shift izq.** (teclado, acción `windPull` reasignable en Controles): Ruben se planta y jala el aire. Aparece una franja de viento en forma de embudo (hasta 360 px, con corrientes, hojas/copos según la zona y remolino en la palma). Los insectos (escarabajos y polillas) que entran quedan atrapados en el aire, sin IA ni daño por contacto, y son arrastrados lentamente hasta flotar frente a la mano. Al soltar quedan mareados ~1,3 s (caen, estrellitas): momento para el tajo. Se corta al recibir un golpe, sin suelo, con piedra en la mano o al cambiar de sala. Sonido de viento con ruido filtrado (Web Audio), sin basura por cuadro.
- `player.js`: pose `player.windPose` (0..1): agachado, inclinado hacia atrás, piernas abiertas, espada baja atrás, brazo libre extendido con la palma abierta y dedos en abanico, boca en "O" aspirando, bufanda empujada hacia atrás, leve temblor por el esfuerzo.
- `controls.js`: acción `windPull` (F / Shift izq.), `PadL2` en `isActive`, fila "Jalar el Aire — Abajo + L2" en Ratón y mando y línea en la guía de controles. `ui-icons.js`: ícono `wind`.
- Envuelve `game.update`, `game.doAction` (plantado no salta/ataca/agarra), `game.loadRoom` y `player.update`; a los atrapados les pone `update`/`render` propios (se quitan al soltar).
- Playtest: atrapar polilla + escarabajo en pradera y montaña, soltar y golpear al mareado, golpe recibido corta la habilidad, Diario/pausa la congelan y apagan el sonido, cruzar de sala y reiniciar sala ok; sin errores de consola.

## Arreglo de Claude (8/11 23:50): insectos atrapados por el viento atravesaban el suelo — pedido del usuario
- `wind-pull.js`: los insectos atrapados y mareados ahora se mueven con colisión real (`moveCollide`) contra suelo, techos, muros, portón cerrado y muros quebradizos, y `unstick` los saca si quedaron metidos en una plataforma. Antes la polilla mareada bajaba 0,35 px por cuadro sin chocar (se hundía en el suelo) y el arrastre ignoraba las plataformas.
- Playtest: arrastre en el suelo y desde una ruina, soltar y dejar caer/flotar → ningún insecto queda dentro de una plataforma. También probado el desbloqueo de Gemini (con la nota `1:0` leída la habilidad funciona) ✅.
- (8/11 23:58, Claude, pedido del usuario) Jalar el Aire: se quitaron las líneas discontinuas del borde y el relleno con forma de embudo; ahora la franja es una bruma suave sin bordes (manchas radiales) más las corrientes, hojas/copos y el remolino. La zona de captura no cambió.

## Cambio de Claude (9/11): apuntar el aire con ratón o stick derecho — pedido del usuario
- `wind-pull.js`: mientras se jala o sopla el aire, la franja apunta hacia el cursor del ratón o hacia donde se incline el stick derecho del mando (ejes 2/3); gana el último que se movió. Sin ninguno (o si el ratón no se movió en 3 s), apunta hacia adelante y Izquierda/Derecha giran a Ruben plantado. La captura (`bandU`), el arrastre (`pullStep`), el empuje (`pushStep`) y el dibujo usan el vector `state.dirX/dirY`; Ruben se da vuelta según el lado al que apunta.
- `player.js`: el brazo extendido y la palma se orientan con `player.windAim` (ángulo relativo, 0 = adelante).
- `controls.js`: fila "Apuntar el aire — Mover el ratón / Stick derecho" y pista en la guía.
- Prueba rápida: ratón arriba-derecha → la polilla queda atrapada y viaja a la mano; escarabajos fuera de la franja, no. El usuario pidió no hacer más playtest.

## Cambio de Claude (9/11): ataque básico más pulido y estela pegada a Ruben — pedido del usuario
- **Bug**: al atacar corriendo, el arco `slash-crescent` (`animation-registry.js`) se creaba en un punto fijo del mundo y quedaba atrás. Ahora el FX tiene `update` que lo mueve con Ruben (`fx.follow` + `offX/offY`, asignados al crearlo en la capa `player-core-fx`); además es un poco más tenue (×0.8) para no tapar la estela principal. Gemini: es tu archivo; solo se tocó ese FX y su spawn.
- `player.js renderSlashTrail()`: estela rehecha. Cabeza con ease-out y cola que arranca tarde (el arco se abre rápido, se sostiene y se cierra), punta afinada y cabeza redondeada, resplandor cálido con trazo ancho (sin `shadowBlur`), contorno de tinta `#3a2416` en el borde exterior, filo brillante y dos líneas de velocidad. Puntos en `Float32Array` fijos (`SLASH_OUT/IN`), sin arrays por cuadro. Hitbox, daño y tiempos de ataque sin cambios.
- Sin playtest (el usuario dijo que no hace falta); `check-project.js` OK.

## Cambio de Claude (9/11): soplar viento hace girar el molino — pedido del usuario
- `wind-pull.js` (`millStep`, `WindPull.getMillAngle()`): en salas con `hasWindmill` (sala 2, Altozano del Molino), si Ruben **sopla** (Arriba + F/L2) y la franja alcanza las aspas (eje en 930, 78; radio 56), las aspas aceleran. El sentido sale del torque: el viento que pasa por debajo del eje las gira al revés que el que pasa por arriba. Velocidad máx. 0,32 rad/cuadro; al dejar de soplar vuelven solas, con inercia, al giro de siempre (0,0117 rad/cuadro). Girando rápido, sueltan polvillo desde la punta de las aspas.
- `bg-continuity.js`: el molino se dibuja con `WindPull.getMillAngle()` (si no existe, el `time * 0.0007` de antes).
- Sin playtest (el usuario dijo que no hace falta); `check-project.js` OK.

## Cambio de Claude (9/11): salir de las salas de arriba bajando por un hueco — pedido del usuario
- Salas 2 (Altozano del Molino, `world.js`) y 6 (Senda de la Montaña Gris, `levels-expansion.js`): antes, para volver había que caminar hacia la pared izquierda hasta una caja de salida. Ahora el suelo tiene un hueco en x 30-130, junto a la pared. Ruben aparece al lado (x 145) y para volver se deja caer por el hueco (salida `{ x: 30, y: 470, w: 100, h: 80 }` con flecha `hint: 'down'`). Cae por el hueco de las copas de la sala de abajo (sala 1: x 330, y 60 · sala 5: x 1225, y 60).
- Sin commit ni push (el usuario los hace con otra IA); `check-project.js` OK.
- (9/11, Claude, pedido del usuario) Animación de llegada a las salas de arriba (`levels-expansion.js`, `installRiseArrival`): al entrar por una salida `hint: 'up'` a una sala con salida `hint: 'down'` (salas 2 y 6), Ruben espera 8 cuadros escondido bajo el hueco y después sale disparado hacia arriba (estirón, sonido de salto, polvo y onda en el borde del hueco). Hace un tiro parabólico de 30 cuadros con voltereta y aterriza con la física normal en el punto de aparición de siempre (x 145). Mientras sube no se revisan salidas y se ignoran salto, ataque y agarre. Envuelve `game.loadRoom`, `game.checkRoomExits`, `game.doAction` y `player.update`. Sin commit (lo sube el usuario).
- (9/11, Claude, pedido del usuario) Sala 3 (Bosque de los Susurros, `world.js`): se quitó la pared izquierda, que tapaba el camino de vuelta, y la salida a la sala 1 quedó pegada al borde (`{ x: 0, y: 340, w: 40, h: 120 }`, como las demás salidas laterales). Antes había que caminar contra la pared hasta una caja en x 35-80. Sin commit (lo sube el usuario).

## Cambio de Claude (9/11): sin doble salto y sin castillo en el fondo — pedido del usuario
- **Doble salto eliminado** (`player.js`): `jump()` solo salta desde el suelo o con coyote time. Se quitaron `doubleJumpForce`, `canDoubleJump` y `hasUsedDoubleJump`, y el pogo ya no "devuelve" el doble salto (sigue rebotando con `vy = -8.6`). `playDoubleJump` y `createDoubleJumpSparks` siguen existiendo, porque los usan la llave y el Diario.
- **Salto más fuerte para no romper el mapa**: `jumpForce` pasó de -9.6 a **-12** (sube 144 px; antes eran 91 + 84 con el doble salto). Un script de alcance confirmó que con 144 px todas las plataformas de las 11 salas se alcanzan, y que los huecos de las copas de las salas 1 y 5 (piden 131 px) también. Como 144 < 175 (el máximo anterior), no se abren atajos.
- **Salto regulable** (nuevo, `player.isJumpHeld`): soltar el botón mientras sube corta la subida a la mitad (toque = saltito). Lee el control reasignable de `jump` y el botón A del mando (`buttons[0]`).
- Textos: nota de Angelo en la sala 1 ("donde solo alguien que salte bien alto puede llegar"), Controles ("Saltar"), virtud Ingenio 3 ("Saltos un 10% más potentes"); `journal.js` ya no guarda `doubleJumpForce`.
- **Castillo del fondo eliminado**: `world.js` pasa `hasTower: false` (la torre en ruinas de pradera/castillo) y en `code-art-engine.js` (archivo de Gemini) se borró la silueta del castillo lejano sobre la cordillera del bioma castillo.
- Pendiente: README/GDD/LORE todavía mencionan el doble salto. Sin commit (lo sube el usuario); `check-project.js` OK; sin playtest.
- (9/11, Claude, pedido del usuario) Se quitó el haz de luz con flecha que marcaba las subidas por el hueco de las copas (salas 1 y 5): `main.js render()` ya no llama a `renderExitHints()`, aunque la función sigue existiendo. Los `hint: { dir: 'up' }` de las salidas se mantienen, porque la animación de llegada (`levels-expansion.js`) los usa para detectar la subida. Las flechas hacia abajo (`journal.js`) no se tocaron. Sin commit.

## Cambio de Claude (9/11): el barranco del Portón Norte baja a una sala nueva con un NPC — pedido del usuario
- **Sala 1** (`world.js`): caer por el barranco del suelo (x 420-620) ya no mata. La salida `{ x: 420, y: 500, w: 200, h: 60, hint: 'down' }` lleva a la sala 11.
- **Sala 11 nueva: "Hondonada del Pastor"** (`levels-expansion.js`, pradera, 960×540). Ruben entra cayendo por el hueco del techo (x 400-560) y aterriza en la saliente (420, 140). Se baja por piedras escalonadas, hay un Emblema en (820, 244) y no hay enemigos. Para volver se sube por las piedras y se salta por el hueco: sale del barranco de la sala 1 con la animación de llegada y aterriza en x 640. El script de alcance confirma que todo se alcanza con el salto simple.
- **NPC nuevo, `js/npcs.js`** (dueño Claude, cargado antes de main.js). Las salas declaran `npcs: [{ id, name, x, y, facing, lines, farewell }]`. Al acercarse aparece una burbuja "E · Hablar"; cada pulsación de Interactuar muestra la siguiente línea en el cuadro de diálogo normal (con "▸" si hay más), y al final repite la despedida. Alejarse cierra el diálogo. Tobías, el viejo pastor: sombrero de paja, barba blanca, cayado; respira, parpadea, mira a Ruben y mueve la boca al hablar. Habla de Angelo, del castillo y del molino. Envuelve `doAction`, `updateNearbyNote`, `update` y `loadRoom`; dibuja en `onRenderWorld`, así que queda delante de Ruben.
- `index.html`: `<script src="js/npcs.js?v=1">` y versiones `?v=` subidas en todos los archivos cambiados hoy (evita copias viejas en caché).
- Verificación rápida por código: caer al barranco → sala 11 vivo; hablar 2 líneas; alejarse cierra; saltar por el hueco → sala 1, aterriza en x 640. Sin commit.
- (9/11, Claude, pedido del usuario) **Sala 11 al doble de ancho (1920) hacia la izquierda, con cabaña.** Todo lo anterior se corrió +960: hueco del techo en x 1360-1520, saliente (1380, 140), Emblema (1780, 244), Tobías en x 1215; la sala 1 ahora deja caer a Ruben en x 1428. Mitad izquierda nueva: prado con 3 ruinas, 3 ovejas que pastan yendo y viniendo, 2 escarabajos y una piedra.
- `npcs.js`: decorados sin colisión con `room.props: [{ type: 'cabin' | 'sheep', x, y, ... }]`. **Cabaña del pastor**: troncos, techo de paja, chimenea con humo animado, ventana redonda con luz y macetas, puerta de arco, farol que se mece, banco y leña. **Ovejas**: lana de bolitas, caminan y bajan la cabeza a pastar; la posición sale del tiempo de juego, sin estado. Decorados y NPC ahora se dibujan **detrás** de Ruben y los enemigos, con la capa `'world'` de AnimationRegistry (`npcs-and-props`); `onRenderWorld` queda solo de respaldo.
- Revisado en navegador (cabaña, pastor, prado con ovejas). OJO: el navegador tenía `index.html` viejo en caché (sin `npcs.js`); con `index.html?nocache=2` cargó bien. Si algo no aparece, recargar forzado (Ctrl+F5). Sin commit.
- (9/11, Claude, pedido del usuario) **Brisa en la sala 11** (`ambience: 'breeze'`, lógica en `npcs.js`). Corrientes de aire finas y onduladas más pétalos y briznas que cruzan la pantalla de izquierda a derecha, dibujados delante de todo, con pools fijos. Ráfagas suaves (suma de senos lentos, nunca se apaga). El humo de la chimenea se inclina con la brisa. **Sonido**: ruido rosado en bucle → lowpass que sigue a la ráfaga (320-840 Hz) → ganancia ~0,03-0,08. Entra y sale con fundido de ~1 s al cambiar de sala; se apaga en pausa y respeta `soundManager.isMuted`. Cualquier sala puede usarlo con `ambience: 'breeze'`. Revisado en navegador sin errores de consola (el sonido no se pudo escuchar desde la prueba). Sin commit.
- (9/11, Claude, pedido del usuario) La brisa de la sala sigue sonando **en el menú de pausa y en el Diario**, con sus ráfagas; solo se congelan las corrientes y pétalos. Se apaga al volver al menú principal (`isPlaying = false`) o, con fundido, al cambiar a una sala sin brisa. La música por bioma ya sonaba en pausa. `NPCs.isBreezeSounding()` sirve para depurar. Probado en navegador: jugando, pausa y Diario → suena; sala 1 → se apaga. Sin commit.

## Cambio de Claude (9/11): las notas de Angelo se leen con ARRIBA — pedido del usuario
- Las notas **ya no se abren solas** al pasar por encima (esto reemplaza la ronda 12). Al pararse sobre una aparece un cartel "↑ Leer" (cápsula oscura con borde mostaza, como los avisos). Con **ARRIBA** (acción `aimUp`: W/↑ o stick/cruceta arriba del mando, solo al apretar) se abre el texto; **Interactuar** (E / Y) también la abre. Alejarse la cierra, como antes. No pausa el juego.
- `npcs.js` (`notesStep`, `readNote`, `notesRender`): envuelve `game.updateNearbyNote` (sobre una nota no la abre; lejos de todas, main.js hace lo de siempre: cerrar textos y el mensaje del portón). Al abrir asigna `game.activeNote = nota`, así el Diario sigue registrando notas leídas y la nota celeste de la sala 1 sigue desbloqueando "Jalar el Aire".
- Probado en navegador (sala 0): al llegar → cartel y sin texto; ARRIBA → texto + registrada en el Diario; alejarse → se cierra. Sin commit.
- (9/11, Claude, pedido del usuario) Notas: **solo ARRIBA las abre** (se quitó la alternativa con Interactuar). También se sacó la apertura automática de `main.js updateNearbyNote()` (cerca de una nota ya no hace nada; sigue cerrando al alejarse), así ninguna nota se abre sola aunque el navegador tenga un `npcs.js` viejo en caché. Gemini: **no volver a abrir las notas por cercanía**. Probado: cerca → cerrada; E → cerrada; flecha arriba (tecla real) → abierta; alejarse → cerrada. Sin commit.

## Limpieza de Claude (9/11): se borró todo lo que no servía — pedido del usuario
- **Copia vieja**: `Claude outputs/ruben-expansion.zip`, un zip de la ronda 13 con versiones viejas de bg-continuity, levels-expansion, journal, journal.css, index.html, check-project y COORDINACION. Se eliminó del repo (`git rm`).
- **Código muerto**:
  - `audio.js`: `playDoubleJump()` (ya no hay doble salto) y el alias `startCavernAmbience()`, que nadie llamaba.
  - `main.js`: `closeDialog()`, sin uso, y `renderExitHints()`, el haz con flecha que ya no se dibujaba.
  - `world.js`: el fondo de respaldo para cuando CodeArt no está cargado (nunca se ejecutaba: CodeArt siempre se carga), el molino duplicado y los colores `skyStops` / `farSilhouette` / `midHills` / `midHillsStroke` que solo usaba ese respaldo. También se quitó la opción `hasTower: false`.
  - `controls.js`: la guía `.controls-guide` (ese elemento ya no existe desde la ronda 8) y `getDisplayKeysText()`.
  - `player.js`: `squashTimer`, que se escribía pero nunca se leía.
  - `npcs.js`: `isBreezeSounding()`, que era solo de depuración.
- **CSS sin uso**: `.lore-preview`, `.controls-guide`, `.control-key`, `.controls-aux-info`, `.aux-badge` (`style.css` y `ui-icons.css`).
- Comentarios que todavía hablaban de doble salto o de notas automáticas: corregidos.
- **Se mantuvo, porque sí sirve**: `art-studio.html` y el motor de fondos con `drawRuinedTower` (lo usa el estudio), los `.bat` de subida a GitHub, los dos `flash-executor.md` (uno de Claude y otro de Antigravity), los `GameHooks` (`onUpdate` lo despacha animation-registry.js) y `createDoubleJumpSparks` (lo usan la llave y el Diario).
- Verificado: escaneo de funciones y clases sin referencias = 0; `check-project.js` OK; recorrido en navegador por las salas 0, 1, 2, 3, 5, 6, 9 y 11 con salto, ataque y pausa, sin errores de consola. Versiones `?v=` subidas. Sin commit.
- (9/11, Claude, pedido del usuario) **Se quitó el acceso a la sala 11 (Hondonada del Pastor)**: se borró la salida del barranco de la sala 1 hacia la sala 11, así que caer al barranco vuelve a ser caída al vacío, como al principio. **La sala 11 sigue en `levels-expansion.js`** (cabaña, Tobías, ovejas, brisa) para conectarla en otro lugar; ningún lugar lleva a ella hoy. Al conectarla, revisar su salida de arriba (apunta a la sala 1, x 640). Sin commit.
- (9/11, Claude, pedido del usuario) **Sala 1: barranco tapado.** Los dos tramos de suelo (x 0-420 y 620-1440) pasaron a ser uno continuo (x 0-1440), así que ya no hay caída al vacío en el Portón Norte. Todo sigue alcanzable (script de alcance OK). Sin commit.

## Cambio de Claude (9/11): agua con física, Dominio del Agua y Maestro del Agua — pedido del usuario
- **Archivo nuevo `js/water.js`** (dueño Claude, cargado después de npcs.js y antes de main.js).
  - **Agua**: las salas declaran `water: [{ x, y, w, h }]` (y = superficie). La superficie es una fila de resortes cada 8 px que propagan olas. Los objetos que caen salpican (gotas + "bloop" sintetizado); las piedras se hunden despacio.
  - **Nado**: flotación con resorte hacia la superficie, freno del agua, SALTAR = brazada (o salto fuera del agua cerca de la superficie), ABAJO = bucear, burbujas.
  - **Ambiente**: sonido ambiente de agua (sigue en pausa, como la brisa).
  - **Dominio del Agua** (se aprende con el maestro; se guarda en `localStorage['ruben_agua_v1']` y se borra con "Reiniciar juego"): mantener **F / Shift izq. o L2 SIN arriba/abajo** a ≤320 px del agua. La superficie se levanta en ese punto, sube un chorro y se forma un orbe en la mano que crece. Se apunta con ratón o stick derecho y al soltar sale con gravedad: daña enemigos según tamaño, rompe muros quebradizos (orbe grande), hace sonar campanas y salpica. Arriba/Abajo + F/L2 sigue siendo el viento.
  - Usa la pose de "Jalar el Aire" de player.js (`windPose` / `windAim`).
  - API: `WaterControl.learn / isLearned / getState`.
- **Sala 12 nueva "Laguna del Maestro"** (`levels-expansion.js`, bosque, 1600×540): se entra por el **primer barranco de la sala 4** (x 560-700, antes caída mortal; salida con `hint: 'down'`) y se cae a la saliente alta (680, 140). Tiene una laguna de x 520-1080 (superficie y 412, 108 px de hondo) entre dos orillas (y 400), 3 campanas de práctica (`waterBells`), un Emblema en (1240, 274) y una polilla. Se vuelve por el hueco del techo (x 640-800) con la animación de llegada a la sala 4 (x 720). Script de alcance OK.
- **Maestro Arroyo** (`npcs.js`, `look: 'water-master'`, `teaches: 'water'`): anciano de túnica turquesa con olas, cejas y bigote blancos que se mecen, y un orbe de agua flotando sobre la palma con gotitas en órbita. Tres líneas sobre el agua y Angelo; al terminar enseña la habilidad. Su despedida cambia cuando suenan las tres campanas.
- `controls.js`: fila "Dominio del Agua (cerca del agua)" y acción F renombrada "Viento (con Arriba/Abajo) / Agua (sola)". `ui-icons.js`: ícono `water`.
- Probado en navegador antes de que el usuario pidiera no probar: bajada sala 4 → 12 sin morir, aterrizaje en la saliente, entrar al agua (nada). **Sin probar**: el ajuste de flotación posterior, hablar con el maestro, el orbe y las campanas. Sin commit.
- (10/11, Claude, pedido del usuario) **Campana del techo + mejora del Dominio del Agua + esfera guiada.**
  - Sala 12: 4.ª campana colgada del techo sobre el maestro (300, 32, `ceiling: true`).
  - La bola lanzada se deshace a los **22 cuadros** (`SHOT_LIFE`). Simulación: ni con la esfera al máximo llega a la campana del techo (le faltan 14 px) desde ningún punto de la sala; las 3 campanas de la laguna siguen alcanzables con la bola base.
  - **Maestría** (`ruben_agua_maestria_v1`): cada lanzamiento la sube (+0,045 × (0,3 + 0,7 × carga)) y el orbe crece (radio × (1 + maestría)). Un arco dorado alrededor del orbe muestra el progreso, con aviso al 50%. Al llegar a **+77%** se mejora sola (fanfarria, onda, aviso).
  - **Esfera guiada**: acción nueva `waterGuide` (**G**, reasignable) o **L3** del mando (botón 10, por flanco), cerca del agua. Suelta una esfera del tamaño original (r 13) que se guía por el aire con el **stick izquierdo** o las teclas de mover/apuntar, con inercia, sin gravedad y ~8 s de vida. Ruben queda plantado con el brazo hacia ella y un hilo de agua los une. Hace sonar campanas, daña enemigos, rompe muros y se funde con el agua; G / L3 de nuevo la revienta.
  - **Maestro Arroyo**: la despedida cambia por etapas → (3 campanas) pide mejorar la habilidad → (mejorada) explica G / L3 → (campana del techo) despedida final (`farewellLake`, `farewellUpgraded`, `farewellDone`).
  - Controles: fila "Esfera guiada (tras mejorar) — L3 · stick izq.". "Reiniciar juego" borra habilidad y maestría.
  - Sin playtest (el usuario dijo que no hace falta); `check-project.js` OK. Sin commit.
- (10/11, Claude, pedido del usuario) **El viento afecta el agua y el pasto.**
  - `wind-pull.js`: API nueva `WindPull.getBand()` (franja actual: power, mode, mano, dirección, alcance; devuelve siempre el mismo objeto) y `WindPull.bandHalf(u)`.
  - `water.js` (`windOnWater`): las columnas de la superficie dentro de la franja reciben fuerza. **Soplar** las hunde con picado irregular (olas que viajan) y arranca espuma que vuela en la dirección del viento; **jalar** levanta el agua hacia Ruben con gotitas que vuelan a su mano.
  - `terrain-art.js` (`drawLive`): las briznas de pasto (pradera y bosque) dentro de la franja se doblan en la dirección del viento (soplar = se alejan, jalar = se inclinan hacia Ruben), tiemblan y se ven más bajitas. Las de afuera siguen con su vaivén normal.
  - Sin playtest (el usuario dijo que no hace falta); `check-project.js` OK. Sin commit.
- (10/11, Claude, pedido del usuario) **Escena de las macetas del Maestro del Agua** (`water.js`, sala 12 `potSpots`).
  - Al sonar la **4.ª campana** empieza la escena. El maestro gira hacia la laguna, guarda su orbe y, una por una, se agacha (`n.bend`), saca una maceta de barro y la apoya en el suelo, con golpe sordo, polvo y aplastón. Quedan juntas en x 352, 386 y 420.
  - Después habla en un **cuadro de diálogo ABAJO** (estilo en línea `bottom: 74px`, que vuelve arriba al terminar o al salir de la sala), sin bloquear el juego:
    1. «El origen es el agua. Del océano nació la vida y ella fluyó hasta llegar a nosotros...»
    2. ~7,5 s después: «Eso es lo que dicen nuestras mejores mentes... y yo creo en sus palabras.»
  - Mientras habla hay que llevar una **esfera de agua a cada maceta**: vale la esfera guiada (G / L3) y también la bola lanzada. Cada maceta se llena, suena una nota y le crece un brote. Con las tres llenas y la 2.ª frase leída, florecen (cada una de un color), fanfarria, aviso «Las tres macetas florecieron» y el diálogo se cierra.
  - Durante la escena el maestro no habla con E (`n.busy`, sin cartel "Hablar") y su texto no se cierra por distancia. Si Ruben sale y vuelve, la frase se muestra de nuevo. Las macetas se dibujan detrás de Ruben (capa `world` `water-pots`).
  - Sin playtest (el usuario dijo que no hace falta); `check-project.js` OK. Sin commit.
- (10/11, Claude, pedido del usuario) Cuadro de diálogo de la escena de las macetas: pegado al borde de abajo (`bottom: 8px`), más ancho (90%, máx. 880 px) y más bajito (padding 6 px, radio 14), para no tapar las macetas ni a Ruben. Vuelve al estilo normal al terminar o al salir de la sala. Sin commit.
- (10/11, Claude, bug reportado por el usuario) **"Reiniciar juego" no reiniciaba las campanas.** Causa: las salas de `window.PendingRooms` reutilizan sus objetos de configuración entre partidas (`registerRoom` copia la sala pero no sus arreglos), así que `waterBells[i].lit` y `npcs[i].lineIdx` sobrevivían. Ahora `water.js` (en `onRestartGame`) apaga todas las campanas, borra `waterBellsDone` / `waterLakeBellsDone` / `potQuest` (macetas), reinicia el agua y vuelve a cero a los NPC (líneas, pose, ocupado; también el pastor). OJO para salas nuevas: todo estado que se guarde en objetos de la configuración hay que resetearlo en `onRestartGame`. Sin commit.

## Cambio de Claude (10/11): el agua queda en el suelo, se lleva entre salas y ya no hace daño — pedido del usuario
- **Charcos** (`water.js`, `room.puddles`): el agua que cae (bola lanzada que choca o se deshace en el aire, esfera guiada que revienta, bola que se le cae a Ruben) queda como charco en el suelo que haya debajo. Se evapora: un charco lleno dura **40 s** (`EVAP_FRAMES`), también mientras Ruben está en otra sala. Tiene hilitos de vapor, se junta con charcos vecinos y Ruben chapotea al pisarlo. No se forma en el fondo de una laguna.
- **Los charcos son fuente de agua**: con F / L2 cerca de un charco (≤320 px) se vuelve a levantar, pero solo sale el agua que le queda. La esfera guiada (G / L3) también puede salir de un charco, más chica si tiene poca agua.
- **Llevar la bola**: con F / L2 mantenido Ruben ya **no queda plantado**: camina y salta con la bola en la mano (no puede atacar ni agarrar). Crece solo mientras está enganchada a una fuente; lejos de toda fuente se evapora despacio (40 s una llena; aviso "El agua se evaporó"). **Pasa con él de sala en sala** (`loadRoom` ya no la borra). Soltar = lanzarla. Si lo golpean se le cae y deja charco.
- **Viento vs. agua**: con una bola en la mano, F / L2 es del agua aunque se apriete arriba/abajo (`wind-pull.js` cede con `WaterControl.isHolding()`).
- **Enemigos — sin daño**: la bola lanzada los **empuja** (más cuanto más grande) y los **aturde 3 s** (`STUN_WATER = 180`); la esfera guiada los **atraviesa** sin reventar, los arrastra con su velocidad y también los aturde. Se quitó todo `takeDamage` del agua.
- `wind-pull.js`: API nueva **`WindPull.stun(enemigo, cuadros, vx, vy)`** (reutiliza el mareo del viento: sin IA ni daño por contacto, estrellitas) y el mareo ahora admite empuje horizontal con colisiones reales.
- Prueba headless (Node, mundo simulado, sin navegador): bola 1 → 0,75 tras 10 s lejos; sigue en la mano al cambiar de sala; enemigo sin perder vida, empujado de x 360 a 318 y aturdido ~3 s; de un charco de 0,5 sale una bola de 0,47; charco 0,61 → 0,11 en 20 s. Sin errores. **Sin probar en el juego real** (aspecto visual, sensación al caminar con la bola). `check-project.js` OK. Sin commit.

## 🧱 Refactorización etapa 1 (Claude, 10/11, aprobada por el usuario): GameHooks nativos y salas copiadas — Gemini: LEER `MAPA.md`
- **Ya no se envuelven funciones del juego.** Antes había 24 envolturas (`game.update` ×5, `loadRoom` ×5, `doAction` ×4, `player.update` ×3...), y el orden dependía de la carga. Ahora `main.js` llama a hooks en momentos fijos: `onBeforeUpdate / onAfterUpdate(game, running)` (también en pausa), `onAction → true` (consume), `onBeforeRoomLoad`, `onRoomLoad(game, room, index, prevIndex, sx, sy)`, `onFreezeInput → true`, `onAfterPlayerUpdate`, `onBlockExits → true`, `onKeepDialog → true`, `onBeforeTogglePause → true`, `onRestartGame`. Ayudantes: `game.runHooks(name, ...)` y `game.runHooksUntil(name, ...)`. Contrato completo en **`MAPA.md`** (archivo nuevo, describe el estado actual).
  - `main.js`: `update` = hooks + `updateCore`; `loadRoom` = hooks + `loadRoomCore`; puntos de enganche en `doAction`, `togglePause`, `updateNearbyNote` (ahora cierra el texto anterior al pasar de una nota a otra), `checkRoomExits` y alrededor de `player.update`.
  - Migrados: `wind-pull.js`, `npcs.js`, `water.js`, `levels-expansion.js` (animación de llegada), `journal.js` (update, sala y pausa) y `animation-registry.js` (FX en `onAfterUpdate`; la envoltura vieja quedó solo como respaldo si no hay hooks nativos).
  - Siguen envueltas, para la etapa 3: `player.attack / interactOrThrow / takeDamage` en `journal.js` (virtudes).
- **Salas copiadas por partida**: `World.registerRoom` hace copia profunda de los datos (`World.cloneRoomData`; funciones y clases se comparten). Se quitaron los reseteos a mano de `main.restartGame` (muros, objetos, llave, portón) y de `water.js` (campanas, macetas, charcos, NPC).
- `CLAUDE.md` y `AGENTS.md`: regla nueva "no envolver funciones del juego, usar GameHooks (ver MAPA.md)".
- Verificación: `check-project.js` OK. Prueba sin navegador con el juego REAL (todos los scripts de `index.html`, `Game` y `Player` reales en un DOM simulado):
  - 0 envolturas sobre game/player y sin errores.
  - Caminar, saltar y cambiar de sala OK; llegada a la sala 2 con la curva OK.
  - Notas: no se abren solas, ARRIBA las abre y al alejarse se cierran.
  - Viento plantado OK; agua (nadar, maestro enseña, orbe) OK.
  - "Reiniciar juego" deja las campanas apagadas y el maestro desde cero; pausa OK.
- **Sin playtest en navegador.** Sin commit (lo sube el usuario).

## Cambio puntual de Gemini (11/11, pedido del usuario): Selección de habilidades en el Diario por clic
- **js/journal.js** (`buildTree`): Se eliminó el listener de `mouseenter` en los botones de virtudes del árbol de habilidades (`b.addEventListener('mouseenter', ...)`).
- Ahora una habilidad solo se selecciona al hacerle **clic** (o mediante `focus` con teclado/gamepad), evitando que el cursor la deseleccione por accidente al moverse hacia el botón "Aprender".
- Verificado con `node scripts/check-project.js` (0 errores).

## Composición musical y ambiental de Gemini (11/11, pedido del usuario): Música para la Laguna del Maestro
- **js/audio.js** (Zona libre de Gemini):
  - Añadido preset de acordes armónicos `laguna`: pad en Re2, La2, Re3, Mi3, La3 (resonancia acuática y mística) con filtro lowpass en 450 Hz y banco armónico de campana/arpa.
  - Implementado el tema "El Canto de la Laguna / Tema del Maestro Arroyo":
    - Melodía lírica contemplativa dividida en 4 frases en escala Re Lidio / Pentatónica acuática (D4, E4, F#4, A4, B4, D5, E5).
    - Notas con envolvente suave (ataque límpido tipo campana de agua / arpa de cristal) y eco sintetizado a ~260ms amortiguado a ~750 Hz emulando la acústica de la gruta subterránea.
    - Silencios meditativos (~4 s) entre frases para que respire y armonice con el rumor ambiente de agua de `water.js`.
    - Transición suave con `enterLagunaTheme()` y restauración transparente al salir mediante `leaveLagunaTheme(targetBiome)`.
    - Conectado nativamente a `GameHooks.onRoomLoad` para la sala 12 (`room.id === 12 || room.name === 'LAGUNA DEL MAESTRO'`).
  - Sin allocations en el bucle principal (`update`/`render`): la síntesis se programa por Web Audio API con temporizadores espaciados.
  - Verificado con `node scripts/check-project.js` (0 errores) y pruebas unitarias de eventos y hooks sin navegador. Pendiente playtest con Claude Opus en la sala 12.

## Ajuste de Audio de Gemini (11/11, pedido del usuario): Eliminación de zumbido / estática de fondo
- **js/audio.js** (Zona libre de Gemini):
  - Se removió por completo el drone continuo de baja frecuencia (`this.ambientOscs` y `this.ambientGain`) en `startMeadowAmbience()`, `setBiomeAmbience()` y `enterLagunaTheme()`, el cual producía un zumbido eléctrico / sonido percibido como estática persistente durante el juego.
  - Se mantienen los arpegios melódicos limpios y pastorales de arpa por bioma y las frases cristalinas de la Laguna del Maestro sin ningún ruido residual.
  - Se afinó el decaimiento de las notas (`exponentialRampToValueAtTime`) a valores asintóticos inaudibles (`0.00001`) antes del `stop()` para evitar cualquier micro-clic al cortar la reproducción.
  - Verificado con `node scripts/check-project.js` (0 errores).

## Cambio puntual de Gemini (11/11, pedido del usuario): Eliminación del hilo punteado entre Ruben y la esfera guiada de agua
- **js/water.js** (`drawControl`):
  - A petición explícita del usuario ("elmina los puntos que unen la esfera de agua con ruben al usar la habilidad"), se eliminó el trazo punteado/hilo de agua (`ctx.setLineDash([3, 7])`) que unía la mano de Ruben con la esfera guiada (`guide.on`).
  - Se conserva íntegro el halo celeste radial exterior de la esfera, su estela de partículas y el renderizado principal del orbe (`drawOrbAt`).
  - Verificado con `node scripts/check-project.js` (0 errores).

## Ajuste de Audio de Gemini (11/11, pedido del usuario): Bucle continuo y Crossfade gradual en la Laguna del Maestro
- **js/audio.js** (Zona libre de Gemini):
  - Solucionado el problema reportado por el usuario ("solo se reproduce una vez el tema, tiene que sonar mientras este en la sala y al salir de ella debe cambiar gradualmente"):
    - **Bucle musical continuo ininterrumpido**: El secuenciador `scheduleNextLagunaPhrase()` encadena cíclicamente las 4 frases melódicas en Re Lidio con una cadencia natural (pausa de 1.2s entre frases y 1.8s de respiro lírico al culminar la Frase 4 antes de reiniciar la Frase 1), manteniéndose activo sin detenerse mientras Ruben permanezca en la Laguna (Sala 12).
    - **Master Gain y Crossfade gradual**:
      - Se implementó `this.lagunaGain` como Master Gain de la laguna, conectando tanto las notas directas como sus ecos a dicho nodo.
      - `enterLagunaTheme()`: Desvanece la ganancia hacia 1.0 en ~1.5s mediante `linearRampToValueAtTime`, arrancando el bucle si no estaba activo y cancelando cualquier temporizador de fade previo.
      - `leaveLagunaTheme(targetBiome)`: Marca la sala como inactiva, restaura de inmediato el bioma ambiental objetivo y realiza un fade-out gradual en `this.lagunaGain.gain` de su volumen actual a `0.00001` en 2.5s. Cancela el secuenciador a los 2.6s tras culminar el desvanecimiento para evitar cortes secos de notas en reproducción.
  - Verificado con `node scripts/check-project.js` (0 errores).

## Cambio puntual de Gemini (11/11, pedido del usuario): Aumento de +50% al tiempo de evaporación del agua
- **js/water-core.js** (y `js/water.js` / `js/water-power.js`):
  - Modificada la constante `EVAP_FRAMES` de `2400` a `3600` (a 60 cuadros/segundo: pasa de 40 s a 60 s, incremento del +50%).
  - Compartida vía `WaterCore.EVAP_FRAMES` a `js/water-power.js`.
  - Afecta al tiempo que tardan los charcos de agua en el suelo en evaporarse por completo (`room.puddles`, también entre salas con `ws.t`), así como a la evaporación del orbe de agua en la mano cuando Ruben se aleja de una fuente de agua (`st.size -= 1 / EVAP_FRAMES`).
  - Actualizados los comentarios y documentación en cabecera con el nuevo valor nominal de 60 s.
  - Verificado con `node scripts/check-project.js` (0 errores).


## 🧱 Refactorización etapa 2 (Claude, 11/11, aprobada por el usuario): archivos separados por tema — ver `MAPA.md` → "Archivos"
Sin cambios de comportamiento: el código de cada función se movió **tal cual**, cortando por rangos de líneas. Solo se reescribió lo que antes compartían dentro de un mismo archivo: estado/reloj e instalación de hooks.
- **`water.js` (1505 líneas) → 3 archivos**, en este orden de carga:
  - `water-core.js`: superficie, nado, gotas, charcos, sonidos y viento sobre el agua. Expone `WaterCore`, con el reloj y el estado de nado en `WaterCore.ws`.
  - `water-quest.js`: campanas y escena de las macetas. Expone `WaterQuest`.
  - `water-power.js`: Dominio del Agua y la API pública `WaterControl`, que no cambió.
  - Se borró `water.js`.
- **`npcs.js` (806 líneas) → 4 archivos**:
  - `ambience.js`: brisa. Expone `Ambience.getBreeze()`.
  - `props.js`: cabaña y ovejas, capa world `room-props` (orden 49).
  - `npcs.js`: NPC y diálogos, capa `npcs` (orden 50). Expone `NPCs.drawBubble`.
  - `notes.js`: cartel "↑ Leer".
- Capas world: `water-puddles` (60) y `water-pots` (61), antes eran una sola.
- `index.html`: los 7 scripts nuevos, en orden y con comentarios.
- `AGENTS.md`: lista de archivos de Claude actualizada (faltaban wind-pull, terrain-art, ui-icons y los nuevos). `MAPA.md`: tabla de todos los archivos (dueño, qué hace, qué expone, de qué depende).
- Verificación: `check-project.js` OK. Prueba sin navegador con el juego REAL, sin errores:
  - Todo lo de la etapa 1 sigue funcionando.
  - Esfera guiada: aparece, se mueve y revienta.
  - Escena de las macetas completa: coloca 3, el diálogo aparece abajo y no se cierra por distancia, florecen y el cuadro vuelve arriba.
  - `render()` completo en las salas 0, 2, 11 y 12, con decorados, brisa, NPC, notas, agua, campanas y macetas.
- **Sin playtest en navegador.** Sin commit. Copia de respaldo de los originales en el scratchpad de la sesión.

## 🧱 Refactorización etapa 3 (Claude, 11/11, aprobada por el usuario): sin duplicados ni envolturas — ver `MAPA.md`
- **`aim.js` (nuevo, `window.Aim`)**: un solo lector de ratón (un único `mousemove` sobre el canvas) y stick derecho. `wind-pull.js` y `water-power.js` dejaron de tener cada uno su propio estado, listener y lectura del stick; conservan su suavizado y su política (`Aim.forgetStale(keepIdleStick)`, `Aim.target(game, x, y)`).
- **`sound-kit.js` (nuevo, `window.SoundKit`)**: ruidos blanco/rosado/marrón en caché, `loop` (ruido → filtro → volumen, con LFO opcional), `noiseHit` y `tone`. Pasaron al kit el agua (salpicadura, brazada, ráfaga, campana, chorro, ambiente), la brisa, el viento y el golpe de maceta, con los mismos parámetros. Va aparte de `audio.js` porque ese archivo es zona de Gemini. **Gemini: para efectos sintetizados nuevos podés usar `SoundKit`.**
- **Pose del brazo** (`player.js`): `player.setArmPose('wind' | 'water', pose, ángulo)` y `armPose()` devuelve la más fuerte. Se eliminaron `player.windPose` / `windAim` y el truco de "aplicar la pose del agua después del viento".
- **Virtudes sin envolturas**: `player.mods` (`attackDamage`, `attackCooldown`, `throwDamage`, `throwSpeed`, `throwLift`, `hurtInvuln`), que ajusta `journal.js → applyPassives`. Hook nuevo **`onPlayerHurt(game, amount)`** (`player.takeDamage`), que el Diario usa para reiniciar la regeneración. **Ya no queda ninguna función del juego ni del jugador envuelta.**
- **Error corregido de paso**: con la virtud de piedras al doble, el daño de una misma piedra se duplicaba en cada lanzamiento (25 → 50 → 100…). Ahora siempre es el doble del daño base (`item.baseDamage`).
- Verificación: `check-project.js` OK. Prueba sin navegador con el juego REAL, con audio simulado que cuenta nodos:
  - Todo lo de las etapas 1 y 2 sigue funcionando.
  - El kit crea nodos sin errores de envolvente.
  - Hay un solo listener de ratón y la fuente pasa a "ratón".
  - Pose de agua 1, apuntando hacia el cursor; pose de viento 1 y 0 al soltar.
  - Virtudes: daño 22,5, enfriamiento 12, piedra 50/50/50, invulnerabilidad 83 y regeneración reiniciada.
  - Dibujo de las salas 0, 2, 11 y 12 sin errores, incluido el tema de la laguna nuevo de Gemini en `audio.js`, que funciona con `onRoomLoad`.
- **Sin playtest en navegador.** Sin commit.

## Sonido de impacto de agua contra el suelo (Gemini, 11/11, pedido del usuario)
- **sounds/water-impact.mp3** (archivo nuevo):
  - Guardado el archivo de audio MP3 aportado por el usuario con el sonido real de chapoteo / impacto de agua.
- **js/audio.js**:
  - Incorporado en `SoundManager.WATER_IMPACT_B64` para garantizar carga instantánea, 100% offline y compatible con protocolo `file://` (sin bloqueos CORS ni peticiones de red).
  - Decodificado a `this.waterImpactBuffer` en `AudioContext` para reproducción con cero latencia y modulación de pitch orgánica (`playbackRate = 0.95 .. 1.05`).
  - Método público nuevo: `window.soundManager.playWaterGroundImpact(intensity)`.
- **js/water-core.js** (`addPuddle`):
  - Conectado el disparo de `window.soundManager.playWaterGroundImpact(intensity)` cada vez que el agua cae y choca contra una plataforma o el suelo (`pl`), cubriendo orbes lanzados, esfera guiada reventada y agua caída de la mano.
- Verificado con `node scripts/check-project.js` (0 errores).

## Estadísticas en lugar del árbol de virtudes (Claude, 11/11, pedido del usuario)
- El Diario ya no tiene árbol de virtudes: la pestaña VIRTUDES pasó a **ESTADÍSTICAS** (`js/journal.js`).
- Cuatro estadísticas de Ruben: **daño básico**, **velocidad de ataque**, **defensa** (probabilidad de bloquear un golpe) y **velocidad de movimiento**.
- Se suben **entrenando con los maestros**: Tobías (movimiento y defensa) y Maestro Arroyo (ataque y daño), en `js/levels-expansion.js` con `trains`. Cada nivel cuesta 1 ✦ (punto de entrenamiento), máximo 5 por estadística.
- Se potencian **equipando objetos** del diario (máximo 2): Brújula (movimiento +12%), Campanilla (ataque +15%), Retrato (daño +15%), Sello (defensa +12%).
- Los puntos ✦ siguen saliendo de Emblemas y enemigos. Las virtudes viejas (salto, piedras, vida máxima extra, regeneración, botín) se quitaron; los puntos ya gastados en virtudes vuelven a estar disponibles al cargar.
- `js/npcs.js` (`talk`) llama `journal.trainNpc(n)` tras las líneas del NPC; `js/player.js` suma `mods.blockChance` en `takeDamage`.

## Pantalla de inicio, portón animado y avisos (Claude, 11/11, pedido del usuario)
- **js/main.js**: el aviso (`notification`) baja abajo (`placeNotification`) mientras hay un diálogo abierto (Maestro, notas), así no se encima con el diálogo. Al desbloquear el portón se fija `door.openedAt`.
- **js/world.js**: el portón abierto anima la hoja girando hacia atrás sobre la bisagra y queda abierta, sin marco.
- **js/save-game.js** (nuevo): botones NUEVA PARTIDA · CONTINUAR · OPCIONES. Guarda sala, posición, llaves y estado de salas en `ruben_partida_v1` (al cambiar de sala, al ir al menú y cada ~2 s). NUEVA PARTIDA pide confirmación si hay partida guardada.
- **index.html / css/style.css**: botones nuevos, CONTINUAR apagado sin partida guardada.
- Verificado: `scripts/check-project.js` (0 errores) y playtest en navegador (menú, puerta, aviso sobre diálogo, continuar, nueva partida). Sin errores de consola.
- Pendiente: el estado de la escena del Maestro (macetas/campanas) no se guarda; al continuar se reinicia esa sala.

## Claude (11/11, pedido del usuario): barra de energía elemental
- **js/stamina.js (nuevo)**: barra azul (degrada a blanco) bajo los corazones, compartida por Aire y Agua. Llena = 1 minuto de uso (3600 cuadros). Se vacía mientras un poder está activo y se recarga al soltar a la misma velocidad. Al agotarse queda bloqueada hasta el 20 % (evita parpadeos que sueltan a los insectos). Reinicio de juego la llena.
- **js/wind-pull.js** (`can`) y **js/water-power.js** (`blocked`) consultan `window.Stamina.canUse()`.
- **index.html**: carga `js/stamina.js` antes de `wind-pull.js` (subido a `?v=7`).
- **css/style.css**: bloque `.stamina-bar` / `.stamina-fill`.
- Verificado: `check-project.js` (0 errores) y playtest en Chromium (Playwright): barra visible tras desbloquear el viento, baja al usar, sube al soltar, se agota y no reactiva bloqueada, recarga y reinicio. Sin errores de consola.
- **Falta playtest** del agua con la barra (sala del Maestro del Agua) y del ajuste de tiempos con mando.

## Radar de estadísticas (Claude, 11/11, pedido del usuario)
- El Diario → ESTADÍSTICAS ya no usa barras de pips: ahora hay un **gráfico de radar** (SVG) con los cuatro ejes (Daño arriba, Ritmo derecha, Defensa abajo, Veloc. izquierda), escala 0 a 5 por eje, con el nivel de cada una marcado y su valor al lado del eje.
- Al iniciar el juego todas las estadísticas están en **0** (mínimo), así que la forma arranca como un rombo vacío en el centro.
- `js/journal.js`: nuevo `statRadar()`, nombre corto `short` en `STATS`, y `renderStats()` lo muestra arriba de las filas de texto. `css/journal.css`: bloque `.stat-radar` (se quitaron las reglas `.stat-bar`/`.stat-pip`).
- Verificado: `scripts/check-project.js` (0 errores) y playtest en navegador (Nueva partida → Diario → Estadísticas): el radar renderiza con las cuatro etiquetas y todos los ejes en 0/5. Pendiente: ver el radar con niveles entrenados (polígono relleno y puntos de color).
