# Instrucciones para Agentes de IA (Claude Code, Gemini / Antigravity, etc.)

Este repositorio contiene el juego **Ruben: En Busca de Angelo**, un metroidvania 2D para navegador creado en HTML5 Canvas y Web Audio API sin dependencias de compilación externas.

---

## ⚡ Protocolo de Trabajo Fluido Multi-Agente (Anti-Colisiones)

Varios agentes de IA pueden trabajar en paralelo en esta carpeta. Sigue este flujo para evitar sobrescrituras y pérdidas de cambios:

1. **Leer del disco justo antes de editar**: Nunca escribas un archivo completo basándote en memoria antigua; haz ediciones quirúrgicas (`Edit`) y vuelve a leer el archivo si otro agente está activo.
2. **Validación instantánea (<100ms)**: Tras cualquier edición en `js/` o `index.html`, ejecuta:
   ```bash
   node scripts/check-project.js
   ```
   Verifica sintaxis JS de todos los módulos, integridad de `<script src>` en `index.html`, y que todas las salas tengan `spawnEnemies`/`spawnDebris` como funciones válidas y biomas existentes.
3. **Pushear siempre a `main`**: Al completar cualquier tarea, corrección o mejora (tras validar con `check-project.js`), realiza `git add`, `git commit` y **pushea siempre a `main`** (`git push origin main`) para mantener sincronizado el repositorio.
4. **Extensión sin tocar `js/main.js` ni `js/world.js`**:
   - **Hooks del Motor (`window.GameHooks`)**: Cualquier script nuevo puede suscribirse sin modificar `js/main.js`:
     - `window.GameHooks.onInit.push((game) => ...)`
     - `window.GameHooks.onRoomLoad.push((game, room, index) => ...)`
     - `window.GameHooks.onUpdate.push((game, dt) => ...)`
     - `window.GameHooks.onRenderWorld.push((game, ctx, camera) => ...)`
     - `window.GameHooks.onAction.push((game, action) => ...)`
   - **Cola de Salas (`window.PendingRooms`)**: Puedes definir nuevas salas en un archivo separado empujando configuraciones a `window.PendingRooms = window.PendingRooms || []; window.PendingRooms.push({ id: 4, ... })` o llamando `window.gameInstance.world.registerRoom({...})`.

---

## 🛡️ Convivencia Claude ↔ Gemini
- Las reglas obligatorias para ambos agentes están en **`AGENTS.md` → "Convivencia con Claude"** (releer antes de guardar, no romper APIs compartidas, sin ES Modules, `git add` solo de archivos propios, nada de `destination-out` en el canvas principal, etc.). Claude también las cumple.
- Claude: antes de editar un archivo de Gemini, releelo del disco; después de cualquier cambio en `js/`, hacé un playtest en navegador (empezar, caminar, saltar, cambiar de sala) además de `check-project.js`, y anotá lo hecho en `COORDINACION.md`.

---

## 🎨 Directrices Clave del Proyecto
1. **Sin dependencias pesadas**: El juego debe ejecutarse abriendo directamente `index.html` en el navegador. No introduzcas bundlers que rompan la ejecución directa (`file://`).
2. **Lore y Estilo Visual Oficial (`docs/LORE.md` y `COORDINACION.md`)**:
   - El hermano mayor de Ruben se llama **Angelo**.
   - Ambientación en el **mundo exterior** de un reino abandonado (`pradera`, `bosque`, `montana`, `castillo`).
   - Estilo visual: **animación tradicional a mano tipo años 50** (contornos de tinta marrón `#3a2416`, formas redondeadas, *squash & stretch*, fondos pintados y paleta de enemigos acorde a cada zona).

---

## 🧰 Andamiaje y API Interna Disponible
- **Registro de Salas (`js/world.js`)**:
  - Usa `this.registerRoom({ id, name, biome: 'pradera'|'bosque'|'montana'|'castillo', width, height, platforms, tablets, exits, breakables, collectibles, door, keyItem, spawnEnemies: () => [...], spawnDebris: () => [...] })`.
  - Si agregas salidas laterales (`exits`), pégalas al borde (`x = 0` o `x + w = width`) para que `checkRoomExits()` las detecte a cualquier altura de salto.
- **Muros / Mecanismos Quebradizos (`room.breakables`)**:
  - Declara `breakables: [{ x, y, w, h, broken: false }]` en cualquier sala. Actúan como colisión sólida hasta que una piedra lanzada (`ThrowableDebris`) los impacta (`world.checkBreakableImpact(rect)`).
- **Audio y Partículas Reactivas al Bioma (`js/audio.js`, `js/particles.js`)**:
  - Al entrar a una sala (`loadRoom`), el motor ajusta automáticamente las partículas ambientales (`particleSystem.setBiome(room.biome)`) y la armonía musical (`soundManager.setBiomeAmbience(room.biome)`).
  - Efectos de sonido listos para invocar: `playJump()`, `playDoubleJump()`, `playSlash()`, `playHit()`, `playPickup()`, `playThrow()`, `playDoorUnlock()`, `playBreakWall()`, `playUnlockAbility()`.
  - Efectos de partículas listos: `createDust()`, `createRunPuff()`, `createDoubleJumpSparks()`, `createHitImpact()`, `createSlashSparks()`, `createShockwave()`, `createDebrisFragments()`.
- **Entradas Unificadas, Reasignación y Mando (`js/main.js`, `js/controls.js`)**:
  - Todas las acciones pasan por `this.doAction('jump' | 'attack' | 'grab' | 'interact')` con soporte para teclado personalizable (`ControlsManager` con persistencia en `localStorage`), ratón y mando (Gamepad API + vibración `rumble()`).
- **Sistema Modular de Animaciones (`js/animation-registry.js`, `window.AnimationRegistry` / `window.AnimSystem`)**:
  - Permite extender, superponer o modificar animaciones de Ruben, enemigos y el mundo sin tocar sus clases base ni generar basura en el Garbage Collector (60 FPS):
    - `getEntityState(entity)`: Devuelve el estado semántico (`'idle'`, `'walk'`, `'jump'`, `'doubleJump'`, `'fall'`, `'attack'`, `'hurt'`, `'death'`, `'carry'`, `'chase'`, `'patrol'`).
    - `registerLayer(target, layerId, { order, before, after, update, enabled })`: Agrega capas de dibujado detrás (`before`) o encima (`after`) de una entidad (`target: 'player' | 'crawler' | 'moth' | 'debris' | 'world'`).
    - `setLayerEnabled(target, layerId, enabled)`: Enciende o apaga cualquier capa en tiempo de ejecución.
    - `registerSkin(target, skinId, renderFn)` y `setSkin(target, skinId)`: Reemplaza o restaura (`'default'`) el renderizado de una entidad con fallback seguro ante errores.
    - `defineFX(type, { duration, update, render })` y `spawnFX(type, x, y, opts)`: Dispara clips visuales pre-alojados (64 ranuras fijas con swap-and-pop O(1)). Incluye de fábrica: `'sword-ready-glint'`, `'slash-crescent'`, `'cartoon-star-burst'`, `'landing-ring'`, `'effort-sweat-drop'` y `'traction-puff'`.
