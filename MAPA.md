# MAPA del código — cómo se enganchan los módulos

Este archivo describe **cómo está armado el juego hoy** (no es un historial: eso está en
`COORDINACION.md`). Actualizalo cuando cambies cómo se conectan los módulos.

## Regla principal: no envolver funciones del juego

Ningún módulo reemplaza `game.update`, `game.doAction`, `game.loadRoom`,
`game.updateNearbyNote`, `game.checkRoomExits`, `game.togglePause` ni `player.update`.
Todos se enganchan con **`window.GameHooks`**: `main.js` llama a cada lista en un momento
fijo y en el orden en que se registraron (orden de carga de `index.html`).

Registrá los hooks **dentro de `onInit`** (cuando el juego ya existe):

```js
window.GameHooks = window.GameHooks || {};
(window.GameHooks.onInit = window.GameHooks.onInit || []).push((game) => {
  const H = window.GameHooks;   // main.js ya creó todas las listas
  H.onBeforeUpdate.push((g, running) => { if (running) { /* ... */ } });
  H.onAction.push((g, action) => action === 'miAccion' ? (hacerAlgo(g), true) : false);
});
```

## GameHooks (contrato)

| Hook | Firma | Cuándo / qué devuelve |
|---|---|---|
| `onInit` | `(game)` | Una vez, al crear el juego. Acá se registran los demás hooks. |
| `onBeforeUpdate` | `(game, running)` | Cada cuadro, antes de la lógica. **También en pausa** (`running = false`), para sonidos ambiente. |
| `onAfterUpdate` | `(game, running)` | Cada cuadro, después de la lógica (también en pausa). |
| `onUpdate` | `(game, dt)` | (Antiguo) cada cuadro, después de `onAfterUpdate`. |
| `onAction` | `(game, action) → true` | Antes de que `main.js` procese `jump / attack / grab / interact / waterGuide…`. Devolver `true` **consume** la acción (no llega a los siguientes ni a main). Solo se llama si el juego corre (no en pausa ni muriendo). |
| `onBeforeRoomLoad` | `(game, index, sx, sy)` | Antes de cambiar de sala (limpiar estado de la sala que se deja). |
| `onRoomLoad` | `(game, room, index, prevIndex, sx, sy)` | Después de cambiar de sala (ya hay enemigos, cámara y HUD nuevos). |
| `onFreezeInput` | `(game) → true` | Ruben no recibe teclas este cuadro (viento plantado, esfera guiada, animación de llegada). |
| `onAfterPlayerUpdate` | `(game)` | Justo después de mover a Ruben y antes de revisar salidas (nado, animación de llegada). |
| `onBlockExits` | `(game) → true` | No revisar salidas de sala este cuadro. |
| `onKeepDialog` | `(game) → true` | No cerrar por distancia el diálogo abierto (`game.activeNote`). |
| `onBeforeTogglePause` | `(game, force) → true` | Consume la pausa (el Diario abierto se cierra en vez de pausar). |
| `onPlayerHurt` | `(game, amount)` | Ruben recibió daño (lo llama `player.takeDamage`; el Diario reinicia la regeneración). |
| `onRestartGame` | `(game)` | "Reiniciar juego": borrar **solo el progreso propio** (guardados, habilidades). Las salas ya vuelven solas a su estado inicial. |
| `onRenderWorld` | `(game, ctx, cam)` | Dibujo en coordenadas del mundo, por delante de Ruben. Para dibujar **detrás** de Ruben usá la capa `world` de `AnimationRegistry.registerLayer`. |

Orden de un cuadro (`main.update`): `onBeforeUpdate` → [si corre: `onFreezeInput` →
`player.update` → `onAfterPlayerUpdate` → notas (`onKeepDialog`) → salidas (`onBlockExits`)
→ enemigos, piedras, partículas, cámara] → `onAfterUpdate` → `onUpdate`.

## Salas: cada partida tiene su propia copia

`World.registerRoom(cfg)` hace una **copia profunda de los datos** de la sala (arreglos y
objetos planos; funciones y clases se comparten). Por eso todo lo que se guarde en la sala
o en sus objetos (`b.lit`, `npc.lineIdx`, `room.potQuest`, `room.puddles`, muros rotos,
objetos juntados) vuelve solo a su estado inicial con "Reiniciar juego". No hace falta
resetearlo a mano.

## Archivos (en el orden de carga de `index.html`)

Si una flecha dice "→ usa X", X tiene que cargarse antes.

| Archivo | Dueño | Qué hace | Expone |
|---|---|---|---|
| `ui-icons.js` | Claude | Íconos SVG de la interfaz | `UIIcons` |
| `audio.js` | Gemini | Música por bioma y efectos (Web Audio) | `soundManager` |
| `particles.js` | Gemini | Partículas (pool fijo) | `particleSystem` |
| `code-art-engine.js` | Gemini | Fondos procedurales y molino | `CodeArt` |
| `terrain-art.js` | Claude | Suelo, plataformas y muros pintados por zona; pasto que dobla el viento | `TerrainArt` |
| `enemies.js` | ambos | Escarabajo, polilla, piedras arrojables | clases |
| `controls.js` | Gemini | Teclas reasignables y menú de controles | `ControlsManager` |
| `player.js` | ambos | Ruben: física, salto regulable, ataque, pose de viento/agua | `Player` |
| `world.js` | ambos | Salas 0-3, biomas, colisiones; copia las salas por partida | `World` |
| `menu-nav.js` | Claude | Navegación de menús con teclado/mando | `MenuNavigator` |
| `bg-continuity.js` | Claude | Fondo continuo entre salas; molino con aspas del viento | `BgContinuity` |
| `levels-expansion.js` | Claude | Salas 4-12 (`PendingRooms`), parches a 0-3, animación de llegada por un hueco | `LevelsExpansion` |
| `journal.js` | Claude | Diario: objetos, notas leídas, estadísticas de Ruben (entrenamiento y objetos equipados) | `game.journal` |
| `animation-registry.js` | Gemini | Capas, skins y FX de animación | `AnimationRegistry` |
| `aim.js` | Claude | Apuntado compartido: ratón sobre el canvas y stick derecho (un solo lector) | `Aim` |
| `sound-kit.js` | Claude | Sonidos sintetizados compartidos: ruidos blanco/rosado/marrón, bucles con filtro, golpes y tonos | `SoundKit` |
| `wind-pull.js` | Claude | Jalar / soplar el aire, aturdir enemigos, molino → usa `Aim`, `SoundKit` | `WindPull` |
| `ambience.js` | Claude | Brisa de sala (`ambience: 'breeze'`) con sonido → usa `SoundKit` | `Ambience` |
| `props.js` | Claude | Decorados de sala (`props`: cabaña, ovejas) → usa `Ambience` | — |
| `npcs.js` | Claude | NPC, diálogos, burbuja de texto; dibujos del pastor y el maestro | `NPCs` |
| `notes.js` | Claude | Cartel "↑ Leer" de las notas de Angelo → usa `NPCs.drawBubble` | — |
| `water-core.js` | Claude | Superficie con olas, nado, gotas, charcos, sonidos del agua → usa `SoundKit` | `WaterCore` (interna) |
| `water-quest.js` | Claude | Campanas y escena de las macetas (sala 12) → usa `WaterCore` | `WaterQuest` (interna) |
| `water-power.js` | Claude | Dominio del Agua: orbe, disparo, esfera guiada, maestría → usa `WaterCore`, `WaterQuest`, `Aim` | `WaterControl` |
| `main.js` | ambos | Bucle, cámara, entradas, GameHooks | `Game`, `gameInstance` |

## Ruben (player.js): APIs para habilidades y estadísticas

- **Pose del brazo extendido**: `player.setArmPose(fuente, pose 0..1, ángulo)` (fuentes: `'wind'`, `'water'`). Cada habilidad escribe la suya cada cuadro y `player.armPose()` devuelve la más fuerte; el orden de los hooks no importa.
- **Modificadores** `player.mods`: `attackDamage`, `attackCooldown`, `throwDamage`, `throwSpeed`, `throwLift`, `hurtInvuln`, `blockChance`. Los ajusta el Diario (`journal.js → applyPassives`) según las estadísticas (daño, velocidad de ataque, defensa = `blockChance`); `player.js` los usa al atacar, lanzar y recibir daño (`takeDamage` puede bloquear el golpe). La velocidad de movimiento se aplica directo a `player.speed`. Nadie envuelve los métodos del jugador.
- **Maestros que entrenan**: un NPC de la sala con `trains: ['move', 'def' …]` (ids `dmg`, `atk`, `def`, `move`). `npcs.js` llama `game.journal.trainNpc(npc)` cuando ya dijo sus líneas: cada charla sube una estadística un nivel, sin costo (máximo 5).

## Reglas para no perderse

- **Ninguna función del juego ni del jugador está envuelta** por otro archivo. Si necesitás engancharte en algo que no tiene hook, agregá el hook en `main.js` (en `HOOK_NAMES` y en esta tabla) en vez de envolver.
- Apuntado con ratón / stick: usar `Aim`, no agregar otro listener de `mousemove`.
- Sonidos de ruido o tonos sintetizados: usar `SoundKit` (música y efectos clásicos siguen en `audio.js`).
- Al cambiar cómo se conectan los archivos, actualizar este `MAPA.md`.
