# Instrucciones para Claude Code / Agentes de IA

Este repositorio contiene el juego **Ruben: En Busca de Angelo**, un metroidvania 2D para navegador creado en HTML5 Canvas y Web Audio API sin dependencias de compilación externas.

## Directrices Clave para el Agente
1. **Sin dependencias pesadas**: El juego está diseñado para ejecutarse abriendo directamente `index.html` en el navegador (o mediante un servidor estático ligero). No introduzcas bundlers (Webpack, Vite) ni dependencias npm que rompan la ejecución directa sin antes consultarlo.
2. **Lore oficial**: Consulta siempre `docs/LORE.md` antes de inventar nuevas mecánicas o zonas. El hermano mayor se llama **Angelo** (no Anyelo) y la historia se centra en reconstruir su reino abandonado.
3. **Mecánica central**:
   - Movimiento fluido con Doble Salto.
   - Combate con espada / corte luminoso.
   - Agarre y lanzamiento de piedras o restos caídos (`K`).
   - Notas de Angelo (`E`) que guían al jugador.
   - Puertas selladas y llaves con *backtracking*.
4. **Estructura de Archivos**:
   - `index.html`: Canvas y elementos HUD.
   - `css/style.css`: Estilos visuales del HUD y pantallas.
   - `js/player.js`: Entidad Ruben (físicas, saltos, ataque, agarre de objetos).
   - `js/world.js`: Habitaciones, plataformas, notas, puertas y fondos de paralaje.
   - `js/enemies.js`: IA de enemigos y escombros arrojables (`ThrowableDebris`).
   - `js/particles.js`: Sistema de partículas de ambiente e impactos.
   - `js/audio.js`: Sintetizador Web Audio API en tiempo real.
   - `js/main.js`: Bucle de juego, cámara y eventos de teclado/ratón.
