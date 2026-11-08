# Ruben: En Busca de Angelo 🗝️

Un juego de aventura y misterio estilo **Metroidvania 2D** en el navegador, con físicas fluidas, exploración no lineal, combate y mecánicas de interacción con el entorno.

---

## 📜 Historia y Premisa
Ruben y su hermano mayor **Angelo** provienen de un **reino abandonado** rodeado de praderas, montañas y bosques. Su familia era acomodada, pero tras conflictos y guerras quedan pocos sobrevivientes. Ambos soñaban con devolverle el esplendor a su pueblo.

Hace un par de semanas, Angelo partió en busca de respuestas y reconocimiento, dejando **notas con pistas y sellos lacrados** en su trayecto. Ruben toma su espada y emprende la marcha para encontrarlo.

---

## 🎮 Cómo Jugar
No requiere instalar Node.js ni configurar servidores:
1. Haz doble clic en el archivo [`index.html`](file:///C:/Users/USUARIO/Desktop/Kisukedreemurr/index.html) para abrirlo en cualquier navegador (Chrome, Edge, Firefox, Brave, etc.).
2. Haz clic en el botón **«COMENZAR AVENTURA»** para inicializar el audio sintetizado inmersivo y empezar a jugar.

### 🕹️ Controles
| Acción | Teclas |
| :--- | :--- |
| **Moverse** | `A` / `D` o Flechas `←` / `→` |
| **Salto y Doble Salto** | `ESPACIO` o `W` o Flecha `↑` *(presiona dos veces en el aire)* |
| **Golpear / Ataque de Espada** | `J` o `Z` o `Clic Izquierdo` del ratón |
| **Agarrar / Lanzar Piedras** | `K` o `X` o `Clic Derecho` *(acércate a una roca/escombro para levantarla y vuelve a presionar para arrojarla)* |
| **Interactuar / Leer / Abrir** | `E` *(junto a las notas de Angelo o frente al Portón Norte)* |

---

## 🗺️ Características Metroidvania Implementadas
- **Movimiento Ágil y Físicas Snappy**: Control suave de aceleración/fricción, salto regulable por tiempo, *coyote time* y animación reactiva de capa.
- **Doble Salto Místico**: Permite superar los riscos y barrancos del reino, generando destellos y sonido resonante.
- **Combate y Defensa con Entorno**:
  - Ataque cuerpo a cuerpo con arco luminoso de corte y retroceso (*recoil*).
  - Agarre y lanzamiento de piedras o restos caídos de los enemigos para daño a distancia.
- **Exploración No Lineal y Backtracking**:
  - **Zona 0: Praderas del Reino Caído**: Punto de partida con notas de Angelo y primeros enemigos.
  - **Zona 1: El Portón Norte**: Gran portón cerrado que separa las praderas del bosque; requiere la llave del molino.
  - **Zona 2: Altozano del Molino**: Desafío de plataformeo vertical donde reposa la Llave de Angelo junto a su carta.
  - **Zona 3: Bosque de los Susurros**: Siguiente región desbloqueada al cruzar el portón norte.
- **Audio Sintetizado en Vivo (Web Audio API)**: Acordes atmosféricos en tonos menores, silbidos de acero, impacto de rocas y ecos de cerraduras sin necesidad de archivos MP3 pesados.
- **Ambientación y Estilo**: Atardecer crepuscular, siluetas de torres en ruinas, vegetación de colinas y partículas de esporas ambientales.

---

## 📁 Estructura del Proyecto
```text
Kisukedreemurr/
├── index.html           # Estructura del juego y contenedor Canvas/HUD
├── README.md            # Documentación y guía de controles
├── COORDINACION.md      # Coordinación y reparto entre agentes
├── docs/
│   └── LORE.md          # Dirección creativa, historia y personajes
├── css/
│   └── style.css        # Estilos visuales, HUD y estética crepuscular
└── js/
    ├── audio.js         # Generador procedural de efectos sonoros y ambiente
    ├── particles.js     # Partículas de salto, destellos, polvo e impactos
    ├── enemies.js       # IA de enemigos (terrestres, voladores) y escombros arrojables
    ├── player.js        # Física de Ruben, ataque, agarre de piedras y capa
    ├── world.js         # Habitaciones interconectadas, puertas, llaves y notas de Angelo
    └── main.js          # Bucle principal de juego, cámara y eventos
```
