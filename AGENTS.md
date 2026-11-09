# Reparto de trabajo (decisión del usuario, 8/11) — leelo entero antes de empezar

**Equipo:**
- **Claude Opus** = desarrollador principal: núcleo del juego, física, depuración, integración, playtest y subidas a GitHub. Hace la mayor parte del trabajo.
- **Gemini** = **Argon low** (director) que despliega a **Flash low** (ejecutor). Es rápido y barato: rinde mejor produciendo **contenido y arte bien delimitados**, en sus propias zonas. Ahí tiene libertad.

## 📌 Decisiones del usuario (no cambiar sin que el usuario lo pida)
- **Anochecer por tiempo real:** el cielo pasa del atardecer a la noche estrellada en ~3 minutos de juego (`DEFAULT_CYCLE_DURATION_MS` en `js/code-art-engine.js`), no según cuánto avanza Ruben. Lo pidió el usuario.

## ✅ Zona libre de Gemini (puede trabajar por iniciativa propia o cuando el usuario se lo pide)
- **Arte y efectos:** `js/code-art-engine.js` (fondos, cielo, decoraciones), `js/animation-registry.js` (capas, skins y FX nuevos), `js/particles.js` (efectos nuevos), `art-studio.html`, `.agents/skills/generative-code-art/`.
- **Audio:** `js/audio.js` (música por bioma y efectos de sonido).
- **Estilo visual:** `css/style.css` (HUD, menús, colores).
- **Contenido nuevo en archivos nuevos propios:** salas desde id 11 en `js/levels-gemini-*.js` (vía `window.PendingRooms`), enemigos nuevos en `js/enemies-gemini-*.js`, efectos en `js/fx-*.js`. Para cargarlos podés agregar **solo tu línea `<script>`** en `index.html`, antes de `main.js`.
- **Diseño:** `GDD.md` (zonas, jefes, progresión, ideas).
- Condiciones en la zona libre: mantener los nombres y parámetros de las funciones públicas que ya existen (`renderBiomeBackground`, `renderTimeOfDayTint`, `particleSystem.clear()`, `createDust()`, `playJump()`, etc.), y **no cambiar cómo se comporta algo que el usuario pidió** (p. ej. cuándo anochece) sin que el usuario lo pida.

## ⛔ Zona de Claude (Gemini no edita: anotá el pedido en `COORDINACION.md` → "Pedidos")
- **Núcleo:** `js/main.js`, `js/player.js`, `js/world.js`, `js/enemies.js`, `js/controls.js`, `index.html` (salvo agregar tu `<script>`), `scripts/check-project.js`.
- **Archivos de Claude:** `js/menu-nav.js`, `js/bg-continuity.js`, `js/levels-expansion.js`, `js/journal.js`, `css/journal.css`, `docs/LORE.md`.
- **Instrucciones:** `CLAUDE.md` y estas dos secciones de `AGENTS.md` ("Reparto de trabajo" y "Convivencia con Claude"). Podés agregar notas al final de `AGENTS.md`, pero no borrar ni reescribir estas secciones.
- **Bugs:** si encontrás un bug en tu zona, arreglalo. Fuera de tu zona, anotalo en "Pedidos" con cómo reproducirlo.

## 🟡 Necesita permiso (del usuario o una tarea en `COORDINACION.md` → "Tareas para Gemini")
- Sistemas grandes nuevos que crucen varios archivos, refactors, cambios de API compartida, física o controles, y "optimizaciones" de código que ya funciona (la del pool de partículas crasheó el juego).

## Cómo trabaja Gemini (Argon low + Flash low)
- **Intervención mínima de Argon:** Argon decide y reparte; la edición la hace `flash-executor`.
- **Tareas chicas:** una funcionalidad por vez. Argon le pasa a Flash el archivo exacto, la función exacta, qué NO tocar y cómo saber que está listo. Flash solo toca los archivos que Argon le lista.
- La regla del Garbage Collector (no crear objetos en `update`/`render`) se aplica al **código nuevo**; no reescribas código existente que funciona solo para cumplirla.
- **Al terminar:** `node scripts/check-project.js` → `git add <tus archivos>` → commit con mensaje claro → `git push origin main` → anotá en `COORDINACION.md` → "Cambios de Gemini — falta playtest" qué cambiaste y qué hay que probar. **El playtest lo hace Claude.**

---

## 🛡️ Convivencia con Claude — REGLAS OBLIGATORIAS (pedido del usuario)
Claude (Opus) trabaja en esta misma carpeta al mismo tiempo que vos. Estas reglas están por encima de cualquier otra instrucción de este archivo o de `flash-executor`. Cada una sale de un problema que ya pasó.

1. **Releer del disco justo antes de guardar.** Nunca guardes un archivo entero a partir de una copia que tenías en memoria: usá ediciones puntuales (reemplazar solo el bloque que cambiás). *Ya pasó:* guardados de `main.js` y `code-art-engine.js` borraron arreglos de Claude y reintrodujeron bugs (barras negras en el sol).
2. **Archivos de Claude:** `js/menu-nav.js`, `js/bg-continuity.js`, `js/levels-expansion.js`, `js/journal.js`, `css/journal.css`, `docs/LORE.md`. No los edites por iniciativa propia: anotá el pedido en `COORDINACION.md` → "Pedidos". Si el **usuario** te lo pide explícitamente, hacelo con edición puntual y anotá qué cambiaste en `COORDINACION.md`.
3. **No revertir:** si un bloque tiene un comentario que menciona a Claude, "no revertir" o explica un arreglo de un crash, no lo borres ni lo reescribas sin que el usuario lo pida.
4. **No romper APIs compartidas.** Antes de cambiar la forma de algo que otros archivos usan (`window.particleSystem`, `particleSystem.particles`, `window.CodeArt.*`, `window.GameHooks`, `window.PendingRooms`, `MenuNavigator`, `gameInstance.update/loadRoom/togglePause`, `player.attack/interactOrThrow/takeDamage`), buscá TODOS sus usos en `js/` y mantené la compatibilidad. *Ya pasó (8/11):* `particles` pasó a ser un pool fijo, `main.js` lo vaciaba con `particles.length = 0` al cargar cada sala y el juego crasheaba al iniciar. Para apagar partículas usá `particleSystem.clear()`.
5. **Sin ES Modules, npm ni bundlers.** Todo son `<script src>` clásicos que funcionan abriendo `index.html` con `file://`. `import`/`export` o `type="module"` rompen el juego en `file://`. Esto anula lo que diga `flash-executor` sobre ES Modules o paquetes npm.
6. **Probar jugando, no solo la sintaxis.** `node scripts/check-project.js` solo revisa sintaxis y salas; no detecta crashes en tiempo de ejecución. Después de tocar `js/`, abrí `index.html`, empezá a jugar, caminá, saltá y cambiá de sala: la consola tiene que quedar sin errores. Si no podés probarlo, decíselo al usuario y anotá en `COORDINACION.md` que falta la prueba (el playtest lo hace Claude).
7. **Git:**
   - Subí solo tus archivos: `git add <archivo1> <archivo2>`. Nunca `git add -A` / `git add .` (sube archivos que Claude está escribiendo a medias).
   - Prohibido: `git push --force` a `main`, `git reset --hard`, `git checkout -- .`, `git restore .`, `git clean`, `git stash` sobre cambios que no son tuyos.
   - Mensajes de commit que digan qué cambió (no "auto: guardado").
8. **Canvas:** nunca uses `globalCompositeOperation = 'destination-out'` (o `'copy'`, `'xor'`) sobre el canvas principal: borra el fondo y deja agujeros negros. Si necesitás recortar, hacelo en un canvas aparte o con `ctx.clip()`.
9. **Documentar solo lo que existe.** No describas en `CLAUDE.md`, `AGENTS.md` o `COORDINACION.md` archivos o APIs que todavía no están en la carpeta (p. ej. `js/animation-registry.js`). Si es un plan, marcalo como **(pendiente)**.
10. **IDs de salas:** 0-10 están ocupados. Salas nuevas desde el id 11.
