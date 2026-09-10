const db = require('../src/config/database');
const initDatabase = require('../src/database/init');
const seedInventory = require('../src/database/seedInventory');

initDatabase(db);
const seeded = seedInventory(db);

console.log(seeded ? 'Inventario inicial cargado.' : 'La base ya contiene piezas; no se modificó.');
