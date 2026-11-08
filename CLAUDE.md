# Instrucciones para Claude Code / Agentes de IA

Este repositorio contiene el juego **Ruben: En Busca de Angelo**, un metroidvania 2D para navegador creado en HTML5 Canvas y Web Audio API sin dependencias de compilación externas.

## Directrices Clave
1. **Sin dependencias pesadas**: El juego está diseñado para ejecutarse abriendo directamente `index.html` en el navegador. No introduzcas bundlers que rompan la ejecución directa.
2. **Lore y Estilo Visual Oficial (`docs/LORE.md` y `COORDINACION.md`)**:
   - El hermano mayor de Ruben se llama **Angelo**.
   - Ambientación en el **mundo exterior** de un reino abandonado (`pradera`, `bosque`, `montana`, `castillo`).
   - Estilo visual: **animación tradicional a mano tipo años 50** (contornos de tinta marrón `#3a2416`, formas redondeadas, *squash & stretch*, fondos pintados y paleta de enemigos acorde a cada zona).

## Andamiaje Disponible para Expandir el Juego
- **Registro de Salas (`js/world.js`)**:
  - Usa `this.registerRoom({ id, name, biome: 'pradera'|'bosque'|'montana'|'castillo', width, height, platforms, tablets, exits, breakables, collectibles, door, keyItem, spawnEnemies: () => [...], spawnDebris: () => [...] })`.
  - `World.BIOMES` define las paletas de cielo, colinas, piedra, vegetación, viñeta y colores de enemigos (`enemyPalette`) para las 4 zonas de `docs/LORE.md`.
- **Muros / Mecanismos Quebradizos (`room.breakables`)**:
  - Puedes declarar `breakables: [{ x, y, w, h, broken: false }]` en cualquier sala. Actúan como colisión sólida hasta que una piedra lanzada (`ThrowableDebris`) los impacta (`world.checkBreakableImpact(rect)`).
- **Audio y Partículas Reactivas al Bioma (`js/audio.js`, `js/particles.js`)**:
  - Al entrar a una sala (`loadRoom`), el motor ajusta automáticamente las partículas ambientales (`particleSystem.setBiome(room.biome)`) y la armonía musical (`soundManager.setBiomeAmbience(room.biome)`).
  - Efectos de sonido listos para invocar: `playJump()`, `playDoubleJump()`, `playSlash()`, `playHit()`, `playPickup()`, `playThrow()`, `playDoorUnlock()`, `playBreakWall()`, `playUnlockAbility()`.
- **Entradas Unificadas y Mando (`js/main.js`)**:
  - Todas las acciones pasan por `this.doAction('jump' | 'attack' | 'grab' | 'interact')` con soporte completo para teclado, ratón y mando (Gamepad API + vibración `rumble()`).
