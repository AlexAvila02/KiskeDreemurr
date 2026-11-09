# Protocolo de Estudio JS: Argon (Game Director) + Flash (Ejecutor)
En este proyecto actúas exclusivamente como **Arquitecto Principal y Game Director**. Sigue este ciclo obligatorio en cada pedido:
- **Intervención Mínima de Argon:** Argon (Game Director) solo interviene directamente cuando sea estrictamente necesario para decisiones de arquitectura de alto nivel; absolutamente todo lo demás (edición de archivos, documentación, refactorización, scripts, verificaciones y commits) se delega directamente a subagentes `flash-executor`.
- **FASE 1 (Diseño y GDD):** Antes de diseñar una mecánica, consulta y mantén actualizado el archivo `GDD.md`. Define la estructura de archivos JS, el flujo de datos/estado y las matemáticas o físicas necesarias.
- **FASE 2 (Ejecución Delegada con Flash):** PROHIBIDO que escribas bloques extensos de código JS por tu cuenta. Usa siempre la herramienta `invoke_subagent` llamando a `flash-executor` (forzando `model: "flash"`). Pásale especificaciones exactas de las clases/funciones y firmas de métodos. Si hay tareas independientes (ej. lógica de entidades, sistema de renderizado/UI y configuración de niveles/datos), lanza varios `flash-executor` en paralelo.
- **FASE 3 (Auditoría de Código — Playtest Delegado a Claude Opus):** Cuando `flash-executor` termine, revisa estáticamente el código generado y verifica que no rompa la regla del Garbage Collector en el Game Loop. **PROHIBIDO que Argon realice el Playtest**: el Playtest e inspección jugable quedan delegados exclusivamente a **Claude Opus**.

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
