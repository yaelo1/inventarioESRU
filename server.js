const env = require('./src/config/env');
const db = require('./src/config/database');
const initDatabase = require('./src/database/init');
const createApp = require('./src/app');

initDatabase(db);

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`Inventario FAMMA listo en http://localhost:${env.port}`);
});

function shutdown(signal) {
  console.log(`${signal} recibido; cerrando conexiones...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
