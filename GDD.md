# Game Design Document (GDD) — Ruben: En Busca de Angelo 🗝️

## 1. Concepto General
- **Título del Proyecto:** *Ruben: En Busca de Angelo*
- **Género:** Metroidvania 2D de aventura, plataformeo ágil y misterio.
- **Premisa / High Concept:** Ruben y su hermano mayor **Angelo** provienen de un reino exterior abandonado tras antiguas guerras. Hace dos semanas Angelo partió en busca de respuestas dejando notas lacradas con pistas. Ruben emprende la marcha con su espada, resolviendo acertijos con el entorno (agarre y lanzamiento de piedras, muros quebradizos, llaves y portones) y desbloqueando habilidades a través de 4 biomas interconectados (`pradera`, `bosque`, `montana`, `castillo`).
- **Estilo Visual y Sonoro:**
  - **Arte:** Animación tradicional pintada a mano estilo años 50 (contornos de tinta marrón `#3a2416`, formas redondeadas, *squash & stretch*, fondos procedurales multicapa con `CodeArt` y paleta cromática reactiva por bioma).
  - **Audio:** Síntesis procedural en tiempo real mediante **Web Audio API** (acordes pastorales/ambientales por bioma y efectos de sonido dinámicos sin archivos pesados).

---

## 2. Stack Tecnológico y Librería JS
- **Motor / Renderizado:** **HTML5 Canvas 2D Nativo** (`960x540`) + **Web Audio API** + **CSS3 HUD**.
- **Arquitectura de Carga:** Scripts modulares en JS Vanilla sin bundlers ni dependencias externas (ejecución directa abriendo `index.html`).
- **Reglas Críticas de Rendimiento (60 FPS / Paso Fijo):**
  - Bucle principal con paso fijo de lógica a `60 Hz` (`FIXED_DT = 1000 / 60`) en `js/main.js`.
  - **Regla de Garbage Collector:** Prohibido instanciar objetos (`new`, `{}`, `[]`), clonar arrays (`.map`, `.filter`, spread `...`) o hacer consultas al DOM (`document.querySelector`) dentro de `update()` o `render()`. Reutilizar objetos pre-alojados (Object Pooling), usar `deltaTime` / paso fijo y cachear referencias del DOM/Canvas al inicializar.
  - **Validación automática:** Ejecutar `node scripts/check-project.js` tras cada cambio (<100ms).

---

## 3. Arquitectura de Módulos Actual
```text
Kisukedreemurr/
├── index.html                  # Contenedor Canvas (960x540), HUD, modales de Pausa y Controles
├── art-studio.html             # Estudio interactivo para previsualizar fondos procedurales
├── css/
│   └── style.css               # Estética años 50 (pergamino #f9efd8, tinta #3a2416, cápsulas de aviso)
├── docs/
│   └── LORE.md                 # Lore oficial, biomas, notas de Angelo y dirección artística
├── scripts/
│   └── check-project.js        # Smoke test instantáneo de sintaxis, scripts y salas
└── js/
    ├── audio.js                # Sintetizador Web Audio API (música por bioma y SFX)
    ├── particles.js            # Sistema de partículas ambientales y de combate
    ├── code-art-engine.js      # Motor procedural de fondos años 50 (7 capas, FBM, árboles, ruinas)
    ├── enemies.js              # IA y física con colisiones (CrawlerEnemy, FlyingShadeEnemy, ThrowableDebris)
    ├── controls.js             # Gestor de controles reasignables (localStorage v2)
    ├── player.js               # Física de Ruben, ataque en 8 direcciones, pogo, doble salto y agarre
    ├── world.js                # Salas 0 a 3, biomas, puertas, llaves, notas y colisiones Zero-GC
    ├── menu-nav.js             # Navegación de menús con teclado, ratón y mando
    ├── animation-registry.js   # Sistema desacoplado de animaciones, skins, capas y VFX con Object Pool
    ├── bg-continuity.js        # Continuidad de paralaje y transición suave de fondo entre salas/biomas
    ├── levels-expansion.js     # Salas 4 a 10 (Bosque, Montaña Gris y Castillo) vía window.PendingRooms
    ├── journal.js              # Diario de Ruben (Reliquias, Notas de Angelo y Árbol de Virtudes pasivas)
    └── main.js                 # Bucle principal (60 Hz), cámara, transiciones, Gamepad API y GameHooks
```

### 3.1 Arquitectura Desacoplada de Animaciones (`js/animation-registry.js`)
Para que cualquier agente pueda agregar, modificar o reemplazar animaciones sin tocar la física ni los archivos base (`player.js`, `enemies.js`, `world.js`, `main.js`), el motor expone `window.AnimationRegistry`:
- **Detección Automática de Estado (`getEntityState`):** Deduce el estado actual de cualquier entidad (`'idle'`, `'walk'`, `'jump'`, `'doubleJump'`, `'fall'`, `'attack'`, `'carry'`, `'hurt'`, `'death'`) leyendo sus propiedades físicas en modo solo-lectura.
- **Capas de Animación Aditivas (`registerLayer(target, layerId, { before, after })`):** Permite inyectar efectos detrás o delante de `'player'`, `'crawler'`, `'moth'` o `'debris'` sin alterar su `render()` original.
- **Skins / Reemplazo Seguro (`registerSkin(target, skinId, renderFn)` y `setSkin(target, skinId)`):** Permite cambiar por completo el dibujo de una entidad por estado; incluye *fallback* automático con `try/catch` al render original si ocurre algún error.
- **Object Pool de Efectos Animados (`defineFX` / `spawnFX`):** Pool pre-alojado de 64 efectos (`afterimage`, `slash-burst`, `landing-ring`, `strain-drop`, `sword-glint`) con reciclaje *swap-and-pop* $O(1)$ y cero Garbage Collector.

---

## 4. Controles e Inputs (`ruben_game_controls_v2`)
| Acción | Teclado Principal / Alt | Ratón | Gamepad | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **Mover Izq. / Der.** | `A` / `D` o `←` / `→` | — | Stick Izq. / Cruceta | Movimiento horizontal con aceleración y fricción |
| **Apuntar Arriba / Abajo** | `W` / `S` o `↑` / `↓` | — | Stick Izq. / Cruceta | Dirección de ataque en 8 direcciones y pogo aéreo |
| **Saltar / Doble Salto** | `Espacio` / `X` | — | Botón `A` | Salto regulable, *coyote time* y voltereta en doble salto |
| **Atacar (Espada)** | `J` / `Z` | Clic Izq. | `X` / `RB` / `RT` | Corte en 8 direcciones, *recoil* y *pogo* hacia abajo |
| **Agarrar / Lanzar** | `K` / `C` | Clic Der. | `B` / `LB` | Levantar rocas/escombros y arrojarlos en parábola |
| **Interactuar** | `E` / `Enter` | — | Botón `Y` | Abrir portones con llave (las notas se leen automáticamente al acercarse) |
| **Diario / Virtudes** | `I` / `Tab` | Botón `📖` | `Select` / `Back` | Abrir Diario (Objetos, Árbol de Virtudes y Notas de Angelo) |
| **Pausa / Menú** | `Escape` | Botón `⚙️` | `Start` | Abrir menú de pausa o configuración de controles |

---

## 5. Hoja de Ruta de Hitos (Roadmap)
- [x] **Hito 1 — Base Técnica y Core Loop:** Motor HTML5 Canvas a 60 Hz fijo, cámara suave, controles reasignables, soporte de Gamepad y audio procedural.
- [x] **Hito 2 — Mecánicas de Ruben y Combate:** Salto, doble salto, ataque en 8 direcciones con *pogo*, agarre/lanzamiento de rocas y lectura automática de notas de Angelo.
- [x] **Hito 3 — Primeras 4 Salas y Arte Procedural:** Salas 0 a 3 (*Praderas del Reino Caído*, *El Portón Norte*, *Altozano del Molino*, *Bosque de los Susurros*), motor `CodeArt`, continuidad de fondos (`bg-continuity.js`) y enemigos con línea de visión y colisiones reales.
- [x] **Hito 4 — Expansión de Biomas (Salas 4 a 10) y Diario de Progresión (`levels-expansion.js` + `journal.js`):**
  - **Bosque (Salas 4 y 5):** *Claro de las Luciérnagas* y *Raíces del Roble Viejo* (muro de raíces quebradizo y ascenso por las copas).
  - **Montaña Gris (Salas 6, 7 y 8):** *Senda de la Montaña Gris*, *Cornisa del Viento Helado* y *Puente del Paso Helado* (rastrillo oxidado quebradizo).
  - **Castillo Abandonado (Salas 9 y 10):** *Murallas del Castillo* y *Salón del Trono Olvidado* con el Sello del Reino.
  - **Diario y Árbol de Virtudes:** 8 tipos de reliquias/recuerdos y 3 ramas pasivas (*Corazón*, *Acero*, *Viento*).
- [x] **Hito 5 — Optimización GC y Object Pooling (60 FPS):**
  - **Object Pool en `js/particles.js`:** Pre-alojamiento de las 420 partículas al inicializar (`pool` + `activeCount` con técnica *swap-and-pop*), eliminando toda creación de objetos `{}` y `.splice()` durante el bucle principal.
  - **Cacheo de colisiones en `js/world.js`:** Reutilización de un único array pre-alojado (`_platformsBuffer` + `_doorCollider`) en `getPlatforms()` sin clonar con spread `[...]` ni instanciar objetos por frame.
