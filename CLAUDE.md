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
3. **Extensión sin tocar `js/main.js` ni `js/world.js`**:
   - **Hooks del Motor (`window.GameHooks`)**: Cualquier script nuevo puede suscribirse sin modificar `js/main.js`:
     - `window.GameHooks.onInit.push((game) => ...)`
     - `window.GameHooks.onRoomLoad.push((game, room, index) => ...)`
     - `window.GameHooks.onUpdate.push((game, dt) => ...)`
     - `window.GameHooks.onRenderWorld.push((game, ctx, camera) => ...)`
     - `window.GameHooks.onAction.push((game, action) => ...)`
   - **Cola de Salas (`window.PendingRooms`)**: Puedes definir nuevas salas en un archivo separado empujando configuraciones a `window.PendingRooms = window.PendingRooms || []; window.PendingRooms.push({ id: 4, ... })` o llamando `window.gameInstance.world.registerRoom({...})`.

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
