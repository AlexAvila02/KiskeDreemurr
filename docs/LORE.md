# RUBEN — Lore y dirección del juego

## Género
Plataformero 2D metroidvania de aventura y misterio.

## Premisa
Ruben y su hermano mayor **Angelo** (unos años mayor) vienen de un **reino abandonado** rodeado de praderas, montañas y bosques. Su familia era acomodada, pero tras conflictos y una guerra quedan pocos sobrevivientes. Los hermanos quieren ganar reconocimiento para volver a levantar a su pueblo.

Hace un par de semanas Angelo partió sin dar señales. Dejó **notas con pistas** para Ruben. Ruben sale a buscarlo.

## Mecánica narrativa clave: las notas de Angelo
Las notas son el hilo del misterio y el reemplazo natural del "Códice Antiguo" del HUD:
- Se encuentran en el mundo y se leen con **E** (`dialog-speaker` = "Nota de Angelo").
- Cada nota apunta a la siguiente zona o a una habilidad que Ruben necesita.
- Ejemplos para la primera zona:
  1. *"Ruben: si lees esto, no me esperes en casa. Seguí el camino viejo hacia el bosque. — A."*
  2. *"Las piedras del puente se mueven. Papá decía que el reino se defendía con ingenio, no solo con espada."* (enseña agarrar/lanzar objetos)
  3. *"Encontré la llave del portón norte, pero la dejé donde solo alguien que salta dos veces puede llegar."* (enseña el doble salto)

## Zonas sugeridas (mundo exterior)
| Zona | Ambiente | Paleta de enemigos |
|---|---|---|
| Praderas del Reino Caído | ruinas del pueblo, pasto alto, atardecer | ocres, verdes secos |
| Bosque de los Susurros | árboles altos, niebla | verdes oscuros, musgo |
| Paso de la Montaña Gris | riscos, viento, nieve | grises, azules fríos |
| Castillo Abandonado | el viejo hogar familiar | dorados apagados, rojo vino |

## Elementos, recuerdos y maestros (lore del usuario, 8/11)

### Los recuerdos devuelven los poderes
Ruben **perdió la memoria**. Los poderes elementales no se "ganan": se **recuerdan**. Una carta especial de Angelo (o la lección de un maestro) le devuelve un pedazo de su pasado, y con ese recuerdo vuelve a saber usar el elemento. El juego termina cuando Ruben aprende el último elemento y **recuerda todo su pasado**, que está ligado a la búsqueda de Angelo.
- *En el juego:* `js/memories.js` muestra el recuerdo (viñeta sepia y tres líneas) al aprender viento o agua.

### Orden de los elementos
1. **Viento** — el que recomiendan los sabios para empezar: nos rodea a todos, y hasta quien agita una mano ya lo está empujando. Además está en los otros tres (el fuego necesita aire, el agua lo lleva dentro, la tierra en parte también). *En el juego: carta azul de Angelo en la sala 1.*
2. **Agua** — *en el juego: Maestro Arroyo, sala 12.*
3. **Tierra** — es el opuesto del viento, y solo se aprende sabiendo ya usar el viento. Permite **cambiar el mapa**: crear paredes, plataformas y pasajes, y unir salas que están una encima de la otra aunque no tengan camino. *En el juego: la enseña la Maestra Greda (sala 23); levanta pilares de roca (escalón, muro, lanzan enemigos) y abrió la mina tapada. Unir salas de arriba/abajo: **(pendiente)**.*
4. **Fuego** — el último, como fue uno de los mayores descubrimientos de la humanidad. Al revés de lo habitual, es el elemento **más seguro** y el que más beneficios da a quien lo entiende. **(pendiente)**

> Nota: en los apuntes originales hay dos versiones del orden (viento primero / agua primero). El juego usa viento → agua → tierra → fuego hasta que el usuario decida otra cosa.

### Los cuatro maestros sostienen el reino
Los niveles existen y son habitables porque los cuatro maestros los mantienen:
- **Tierra**: le da forma a las salas.
- **Viento**: hace circular el aire; sin él todo se asfixiaría.
- **Fuego**: mantiene tibia la tierra para que nada se congele.
- **Agua**: da la humedad para que la vida florezca.

Cada maestro vive en una zona distinta del mapa.
- **Maestro del Agua (Arroyo)**: cuando Ruben lo encuentra está **rezando**. Al enseñar dice que los mejores sabios están cada vez más convencidos de que la vida viene del agua, y que él cree en sus palabras. *(En el juego. Falta la animación de despedida al terminar el entrenamiento.)*
- **Maestro del Fuego**: un científico, alguien con grandes conocimientos de química (la combustión). **(pendiente)**
- **Maestros del Viento y de la Tierra**. **(pendiente)** La **Maestra de la Tierra, Greda**, vive en la vieja mina al fondo de las Canteras del Este (sala 23), que tapó con rocas; Bruno el cantero (sala 21) cuenta que la tierra solo escucha a quien ya mueve el aire. Cuando Ruben llega está agachada con la palma en el suelo, escuchando a la tierra. Angelo no logró que le abriera la mina: entró por la chimenea y siguió hacia la montaña, buscando a un sabio que estudia cómo arden las cosas (el Maestro del Fuego). *En el juego.*

### Energía elemental
Usar los elementos gasta una barra de energía. Cuanto más intenso el uso (un viento que barre toda la sala), más rápido se gasta y antes se cansa Ruben. Usarla una y otra vez la **hace crecer**: Ruben se acostumbra. *En el juego: `js/stamina.js` (hasta el doble de capacidad).*

### Animales con elementos
Los animales del reino también pueden tener elementos. **(pendiente; idea anterior descartada: que los escarabajos crearan los niveles con la tierra — ahora lo hacen los maestros.)**

## Personaje
Ruben tiene **diseño original**, no basado en ningún juego existente.

## Estilo visual
Animación tradicional a mano, estilo Disney años 50: contornos suaves, formas redondeadas, squash & stretch en saltos y golpes, fondos pintados. Los colores de cada enemigo combinan con su zona.

## Controles (los que ya definió Gemini)
A/D o ←/→ moverse · ESPACIO/W saltar y doble salto · J/click izq atacar · K/click der agarrar/lanzar · E interactuar.
