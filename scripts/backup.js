const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const env = require('../src/config/env');

async function main() {
  const backupDir = path.resolve(env.rootDir, process.env.BACKUP_DIR || 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destination = path.join(backupDir, `inventario-${timestamp}.sqlite`);
  await db.backup(destination);
  console.log(`Base respaldada en ${destination}`);
  console.log(`Respalda también el directorio de imágenes: ${env.uploadDir}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.close());
