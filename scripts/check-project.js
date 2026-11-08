/**
 * Script de Verificación Rápida (Smoke Test) para Agentes de IA
 * Ejecutar con: node scripts/check-project.js
 *
 * Verifica en <100ms:
 * 1. Sintaxis válida en todos los archivos JS (`js/*.js`).
 * 2. Que todos los `<script src="...">` de `index.html` existan en disco.
 * 3. Integridad estructural de las salas en `js/world.js` (salidas válidas, funciones spawn, biomas).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
let errors = 0;
let warnings = 0;

function ok(msg) {
  console.log(`  [OK] ${msg}`);
}

function fail(msg) {
  console.error(`  [ERROR] ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  [AVISO] ${msg}`);
  warnings++;
}

console.log('=== Verificación Rápida del Proyecto (Ruben: En Busca de Angelo) ===\n');

// 1. Verificar index.html y referencias a scripts/estilos
const indexHtmlPath = path.join(root, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  fail('No se encontró index.html en la raíz del proyecto.');
} else {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const scriptMatches = [...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi)];
  for (const match of scriptMatches) {
    const relPath = match[1];
    const fullPath = path.join(root, relPath);
    if (fs.existsSync(fullPath)) {
      ok(`Script referenciado existe: ${relPath}`);
    } else {
      fail(`Script referenciado en index.html NO existe: ${relPath}`);
    }
  }
}

// 2. Verificar sintaxis de todos los archivos en js/
const jsDir = path.join(root, 'js');
if (fs.existsSync(jsDir)) {
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  for (const file of jsFiles) {
    const fullPath = path.join(jsDir, file);
    const code = fs.readFileSync(fullPath, 'utf8');
    try {
      new vm.Script(code, { filename: `js/${file}` });
      ok(`Sintaxis JS válida: js/${file}`);
    } catch (err) {
      fail(`Error de sintaxis en js/${file}: ${err.message}`);
    }
  }
}

// 3. Simulación ligera de World para validar salas, biomas y funciones spawn
try {
  const sandbox = {
    window: { GameHooks: {}, PendingRooms: [] },
    document: { hidden: false, getElementById: () => null, querySelector: () => null },
    localStorage: { getItem: () => null, setItem: () => null },
    navigator: { getGamepads: () => [] },
    console,
    Math,
    Date,
    Set,
    Array,
    Object,
    JSON,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);

  const loadOrder = ['enemies.js', 'world.js'];
  for (const file of loadOrder) {
    const code = fs.readFileSync(path.join(jsDir, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: `js/${file}` });
  }

  const world = vm.runInContext('new World()', sandbox);
  const rooms = world.rooms.filter(Boolean);
  ok(`Mundo inicializado con ${rooms.length} salas registradas.`);

  for (const room of rooms) {
    if (!WorldBiomesCheck(world, room.biome)) {
      warn(`Sala ${room.id} (${room.name}) usa un bioma no definido: '${room.biome}'`);
    }
    if (typeof room.spawnEnemies !== 'function') {
      fail(`Sala ${room.id} (${room.name}): spawnEnemies debe ser una función () => [...]`);
    } else {
      const enemies = room.spawnEnemies();
      if (!Array.isArray(enemies)) {
        fail(`Sala ${room.id} (${room.name}): spawnEnemies() no devolvió un Array`);
      }
    }
    if (typeof room.spawnDebris !== 'function') {
      fail(`Sala ${room.id} (${room.name}): spawnDebris debe ser una función () => [...]`);
    } else {
      const debris = room.spawnDebris();
      if (!Array.isArray(debris)) {
        fail(`Sala ${room.id} (${room.name}): spawnDebris() no devolvió un Array`);
      }
    }
    for (const exit of room.exits || []) {
      if (!world.rooms[exit.targetRoom]) {
        warn(`Sala ${room.id} tiene salida hacia targetRoom=${exit.targetRoom}, que aún no está registrada.`);
      }
    }
  }
} catch (err) {
  fail(`Fallo al validar instancias de World/Rooms: ${err.message}`);
}

function WorldBiomesCheck(world, biomeId) {
  return Boolean(world.biomes && world.biomes[biomeId]);
}

console.log('\n------------------------------------------------------------');
if (errors > 0) {
  console.error(`Resultado: ${errors} error(es), ${warnings} aviso(s).`);
  process.exit(1);
} else {
  console.log(`Resultado: ¡Todo en orden! (0 errores, ${warnings} aviso(s)).`);
  process.exit(0);
}
