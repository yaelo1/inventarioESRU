const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const initDatabase = require('../src/database/init');
const env = require('../src/config/env');

const rootDir = env.rootDir;
const sourceArg = process.argv[2];
const destinationArg = process.argv[3];

if (!sourceArg) {
  console.error('Uso: node scripts/adopt-client-database.js <sqlite-cliente> [sqlite-destino]');
  process.exit(1);
}

const sourcePath = path.resolve(rootDir, sourceArg);
const destinationPath = destinationArg ? path.resolve(rootDir, destinationArg) : env.dbPath;
const backupDir = path.resolve(rootDir, process.env.BACKUP_DIR || 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const temporaryPath = `${destinationPath}.importing-${process.pid}`;
const fields = ['image_path', 'thumbnail_path', 'original_image_path'];

async function main() {
  if (!fs.existsSync(sourcePath)) throw new Error(`No existe la base de origen: ${sourcePath}`);
  if (sourcePath === destinationPath) throw new Error('La base de origen y el destino deben ser diferentes');

  fs.mkdirSync(backupDir, { recursive: true });
  const fallbackExists = fs.existsSync(destinationPath);
  const fallbackDb = fallbackExists ? new Database(destinationPath, { readonly: true }) : null;
  let sourceDb;
  let operationalDb;

  try {
    sourceDb = new Database(sourcePath, { readonly: true });
    assertHealthy(sourceDb, 'origen');
    await sourceDb.backup(temporaryPath);
    sourceDb.close();
    sourceDb = null;

    operationalDb = new Database(temporaryPath);
    operationalDb.pragma('foreign_keys = ON');
    initDatabase(operationalDb);

    const deferredFiles = [];
    const restoredFields = restoreMissingImages(operationalDb, fallbackDb, deferredFiles);
    assertHealthy(operationalDb, 'operativa');
    const foreignKeyErrors = operationalDb.pragma('foreign_key_check');
    if (foreignKeyErrors.length) throw new Error(`La base operativa tiene ${foreignKeyErrors.length} errores de llaves foráneas`);

    const summary = {
      generated_at: new Date().toISOString(),
      source: path.relative(rootDir, sourcePath),
      destination: path.relative(rootDir, destinationPath),
      restored_fields: restoredFields,
      pending_files: deferredFiles.length,
      records: tableCounts(operationalDb),
      deferred_files: deferredFiles
    };
    if (fallbackExists) {
      const previousBackup = path.join(backupDir, `inventario-pre-cliente-${timestamp}.sqlite`);
      await fallbackDb.backup(previousBackup);
      summary.previous_database_backup = path.relative(rootDir, previousBackup);
    }
    operationalDb.close();
    operationalDb = null;
    fallbackDb?.close();

    removeIfExists(`${destinationPath}-wal`);
    removeIfExists(`${destinationPath}-shm`);
    removeIfExists(destinationPath);
    fs.renameSync(temporaryPath, destinationPath);

    const manifestPath = path.join(backupDir, `client-upload-manifest-${timestamp}.json`);
    fs.writeFileSync(manifestPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    console.log(`Base de la clienta adoptada en ${destinationPath}`);
    console.log(`Respaldo y manifiesto en ${backupDir}`);
    console.log(`Rutas sustituidas temporalmente: ${restoredFields}`);
    console.log(`Archivos de la clienta aún pendientes: ${deferredFiles.length}`);
    console.log(JSON.stringify(summary.records, null, 2));
  } finally {
    if (sourceDb?.open) sourceDb.close();
    if (operationalDb?.open) operationalDb.close();
    if (fallbackDb?.open) fallbackDb.close();
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function restoreMissingImages(db, fallbackDb, deferredFiles) {
  if (!fallbackDb) return 0;
  const pieceFallback = new Map(
    fallbackDb.prepare(`SELECT internal_code, ${fields.join(', ')} FROM pieces`).all()
      .map((row) => [row.internal_code, row])
  );
  const passageFallback = new Map(
    fallbackDb.prepare(`SELECT testament, number, ${fields.join(', ')} FROM passages`).all()
      .map((row) => [`${row.testament}:${row.number}`, row])
  );
  let restored = 0;
  const transaction = db.transaction(() => {
    const pieces = db.prepare(`SELECT id, internal_code, ${fields.join(', ')} FROM pieces`).all();
    for (const piece of pieces) {
      restored += restoreRecord(db, 'pieces', piece, pieceFallback.get(piece.internal_code), deferredFiles, piece.internal_code);
    }
    const passages = db.prepare(`SELECT id, testament, number, ${fields.join(', ')} FROM passages`).all();
    for (const passage of passages) {
      const key = `${passage.testament}:${passage.number}`;
      restored += restoreRecord(db, 'passages', passage, passageFallback.get(key), deferredFiles, key);
    }
  });
  transaction();
  return restored;
}

function restoreRecord(db, table, record, fallback, deferredFiles, key) {
  let restored = 0;
  for (const field of fields) {
    const requestedPath = record[field];
    if (!requestedPath || publicFileExists(requestedPath)) continue;
    const fallbackPath = fallback?.[field];
    const usableFallback = fallbackPath && publicFileExists(fallbackPath) ? fallbackPath : null;
    deferredFiles.push({ entity: table, key, field, requested_path: requestedPath, temporary_path: usableFallback });
    if (!usableFallback) continue;
    db.prepare(`UPDATE ${table} SET ${field} = ? WHERE id = ?`).run(usableFallback, record.id);
    restored += 1;
  }
  return restored;
}

function publicFileExists(publicPath) {
  const prefix = `${env.publicUploadBase}/`;
  if (!String(publicPath).startsWith(prefix)) return false;
  const relative = String(publicPath).slice(prefix.length);
  return fs.existsSync(path.join(env.uploadDir, relative));
}

function assertHealthy(db, label) {
  const result = db.pragma('integrity_check');
  if (result.length !== 1 || result[0].integrity_check !== 'ok') {
    throw new Error(`La base ${label} no superó PRAGMA integrity_check`);
  }
}

function tableCounts(db) {
  const names = ['pieces', 'passages', 'piece_movements', 'loans', 'exhibition_picks', 'showcases', 'users', 'damage_reports'];
  return Object.fromEntries(names.map((name) => [name, db.prepare(`SELECT COUNT(*) AS total FROM ${name}`).get().total]));
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
