const fs = require('fs');
const path = require('path');
const env = require('../config/env');

function initDatabase(db) {
  const schema = fs.readFileSync(path.join(env.rootDir, 'schema.sql'), 'utf8');
  db.exec(schema);
  ensureColumn(db, 'passages', 'image_path', 'TEXT');
  ensureColumn(db, 'passages', 'thumbnail_path', 'TEXT');
  ensureColumn(db, 'passages', 'original_image_path', 'TEXT');
  ensureColumn(db, 'pieces', 'exhibition_location', 'TEXT');
  ensureColumn(db, 'pieces', 'custodian', 'TEXT');
  ensureColumn(db, 'pieces', 'thumbnail_path', 'TEXT');
  ensureColumn(db, 'pieces', 'original_image_path', 'TEXT');
  ensureColumn(db, 'pieces', 'never_leaves_box', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'loans', 'loaned_to_passage_id', 'INTEGER');
  ensureColumn(db, 'loans', 'return_notes', 'TEXT');
  // Existing accounts predate temporary passwords, so they keep their current access.
  ensureColumn(db, 'users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'piece_images', 'thumbnail_path', 'TEXT');
  migrateLoansForeignKey(db);
  migrateExhibitionPickStatuses(db);
  consolidateLegacyPieceFields(db);
  reconcileActiveCustody(db);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_active_piece
      ON loans(piece_id) WHERE status = 'activo';
  `);
  removeLegacyCommerceTables(db);
}

function ensureColumn(db, table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all()
    .some((info) => info.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrateExhibitionPickStatuses(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'exhibition_picks'").get();
  if (!table || table.sql.includes("'finalizada'")) return;

  db.transaction(() => {
    db.exec(`
      DROP INDEX IF EXISTS idx_exhibition_picks_active_piece;
      DROP INDEX IF EXISTS idx_exhibition_picks_target;
      ALTER TABLE exhibition_picks RENAME TO exhibition_picks_legacy;
      CREATE TABLE exhibition_picks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        piece_id INTEGER NOT NULL,
        target_passage_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'seleccionada'
          CHECK (status IN ('seleccionada', 'sacada', 'montada', 'finalizada', 'cancelada')),
        requested_by TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (piece_id) REFERENCES pieces(id) ON DELETE RESTRICT,
        FOREIGN KEY (target_passage_id) REFERENCES passages(id) ON DELETE RESTRICT
      );
      INSERT INTO exhibition_picks
        (id, piece_id, target_passage_id, status, requested_by, notes, created_at, updated_at)
      SELECT id, piece_id, target_passage_id, status, requested_by, notes, created_at, updated_at
      FROM exhibition_picks_legacy;
      DROP TABLE exhibition_picks_legacy;
      CREATE INDEX idx_exhibition_picks_target
        ON exhibition_picks(target_passage_id, status);
      CREATE UNIQUE INDEX idx_exhibition_picks_active_piece
        ON exhibition_picks(piece_id)
        WHERE status IN ('seleccionada', 'sacada', 'montada');
    `);
  })();
}

function migrateLoansForeignKey(db) {
  const hasPassageForeignKey = db.prepare('PRAGMA foreign_key_list(loans)').all()
    .some((foreignKey) => foreignKey.table === 'passages' && foreignKey.from === 'loaned_to_passage_id');
  if (hasPassageForeignKey) return;

  db.transaction(() => {
    db.exec(`
      DROP INDEX IF EXISTS idx_loans_active_piece;
      DROP INDEX IF EXISTS idx_loans_piece_status;
      ALTER TABLE loans RENAME TO loans_legacy;
      CREATE TABLE loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        piece_id INTEGER NOT NULL,
        loaned_to_passage_id INTEGER,
        loaned_to TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'devuelto', 'cancelado')),
        checkout_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expected_return_date TEXT,
        returned_at TEXT,
        responsible_out TEXT,
        responsible_in TEXT,
        notes TEXT,
        return_notes TEXT,
        FOREIGN KEY (piece_id) REFERENCES pieces(id) ON DELETE RESTRICT,
        FOREIGN KEY (loaned_to_passage_id) REFERENCES passages(id) ON DELETE RESTRICT
      );
      INSERT INTO loans (
        id, piece_id, loaned_to_passage_id, loaned_to, status, checkout_date,
        expected_return_date, returned_at, responsible_out, responsible_in, notes, return_notes
      )
      SELECT
        id, piece_id, loaned_to_passage_id, loaned_to, status, checkout_date,
        expected_return_date, returned_at, responsible_out, responsible_in, notes, return_notes
      FROM loans_legacy;
      DROP TABLE loans_legacy;
      CREATE INDEX idx_loans_piece_status ON loans(piece_id, status);
    `);
  })();
}

function removeLegacyCommerceTables(db) {
  db.exec(`
    DROP TABLE IF EXISTS movements;
    DROP TABLE IF EXISTS products;
  `);
}

function consolidateLegacyPieceFields(db) {
  db.transaction(() => {
    db.exec(`
      UPDATE pieces
      SET observations = CASE
        WHEN NULLIF(TRIM(observations), '') IS NULL THEN TRIM(loan_notes)
        WHEN INSTR(observations, TRIM(loan_notes)) > 0 THEN observations
        ELSE observations || CHAR(10) || TRIM(loan_notes)
      END
      WHERE NULLIF(TRIM(loan_notes), '') IS NOT NULL
        AND TRIM(loan_notes) != '---';
      UPDATE pieces SET loan_notes = NULL, is_loan_related = 0;
      UPDATE pieces
      SET maintenance_required = CASE
        WHEN condition_status IN ('roto', 'requiere_mantenimiento', 'en_mantenimiento') THEN 1
        ELSE 0
      END;
    `);
  })();
}

function reconcileActiveCustody(db) {
  db.transaction(() => {
    db.exec(`
      INSERT INTO piece_movements (
        piece_id, type, from_presence_status, to_presence_status,
        from_condition_status, to_condition_status, reason
      )
      SELECT
        p.id, 'ajuste', p.presence_status, 'prestada',
        p.condition_status, p.condition_status,
        'Normalización: el préstamo activo conserva la presencia Prestada'
      FROM pieces p
      JOIN loans l ON l.piece_id = p.id AND l.status = 'activo'
      WHERE p.presence_status != 'prestada';

      UPDATE pieces
      SET presence_status = 'prestada', updated_at = CURRENT_TIMESTAMP
      WHERE id IN (SELECT piece_id FROM loans WHERE status = 'activo')
        AND presence_status != 'prestada';

      UPDATE exhibition_picks
      SET target_passage_id = (
        SELECT l.loaned_to_passage_id
        FROM loans l
        WHERE l.piece_id = exhibition_picks.piece_id AND l.status = 'activo'
      ), updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('seleccionada', 'sacada', 'montada')
        AND EXISTS (
          SELECT 1 FROM loans l
          WHERE l.piece_id = exhibition_picks.piece_id
            AND l.status = 'activo'
            AND l.loaned_to_passage_id IS NOT NULL
            AND l.loaned_to_passage_id != exhibition_picks.target_passage_id
        );
    `);
  })();
}

module.exports = initDatabase;
