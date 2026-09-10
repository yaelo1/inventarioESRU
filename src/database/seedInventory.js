const fs = require('fs');
const env = require('../config/env');

function boolInt(value) {
  return value ? 1 : 0;
}

function seedInventory(db) {
  const pieceCount = db.prepare('SELECT COUNT(*) AS total FROM pieces').get().total;
  if (pieceCount > 0) return false;
  const passageCount = db.prepare('SELECT COUNT(*) AS total FROM passages').get().total;
  if (passageCount > 0) {
    throw new Error('No se puede cargar el inventario inicial en una base con pasajes existentes');
  }

  const payload = JSON.parse(fs.readFileSync(env.seedDataFile, 'utf8'));

  const insertPassage = db.prepare(`
    INSERT INTO passages (
      testament, number, name, consecutive_range, box, drawer, total_pieces_reported,
      restoration_required, observations, loan_summary, showcase, maquette_box
    ) VALUES (
      @testament, @number, @name, @consecutive_range, @box, @drawer,
      @total_pieces_reported, @restoration_required, @observations, @loan_summary,
      @showcase, @maquette_box
    )
  `);

  const insertPiece = db.prepare(`
    INSERT INTO pieces (
      passage_id, internal_code, registry_number, global_number, piece_number,
      consecutive_number, name, artist, box, drawer, showcase, presence_status,
      condition_status, maintenance_required, material, deep, length, height,
      observations, loan_notes, is_loan_related
    ) VALUES (
      @passage_id, @internal_code, @registry_number, @global_number, @piece_number,
      @consecutive_number, @name, @artist, @box, @drawer, @showcase, @presence_status,
      @condition_status, @maintenance_required, @material, @deep, @length, @height,
      @observations, @loan_notes, @is_loan_related
    )
  `);

  const insertMaquette = db.prepare(`
    INSERT INTO maquettes (
      name, box, total_pieces, restoration_required, material,
      observations, deep, length, height
    ) VALUES (
      @name, @box, @total_pieces, @restoration_required, @material,
      @observations, @deep, @length, @height
    )
  `);

  const tx = db.transaction(() => {
    const passageIds = new Map();
    for (const passage of payload.passages) {
      const result = insertPassage.run({
        ...passage,
        restoration_required: boolInt(passage.restoration_required)
      });
      passageIds.set(`${passage.testament}-${passage.number}`, result.lastInsertRowid);
    }

    for (const piece of payload.pieces) {
      const passageId = passageIds.get(`${piece.testament}-${piece.passage_number}`);
      if (!passageId) continue;
      insertPiece.run({
        passage_id: passageId,
        internal_code: piece.internal_code,
        registry_number: piece.registry_number,
        global_number: piece.global_number,
        piece_number: piece.piece_number,
        consecutive_number: piece.consecutive_number,
        name: piece.name,
        artist: piece.artist || env.defaultArtist,
        box: piece.box,
        drawer: piece.drawer,
        showcase: piece.showcase,
        presence_status: piece.presence_status,
        condition_status: piece.status,
        maintenance_required: piece.status === 'roto' || piece.status === 'requiere_mantenimiento' ? 1 : 0,
        material: piece.material,
        deep: piece.deep,
        length: piece.length,
        height: piece.height,
        observations: piece.observations,
        loan_notes: piece.loan_notes,
        is_loan_related: boolInt(piece.is_loan_related)
      });
    }

    for (const maquette of payload.maquettes || []) {
      insertMaquette.run({
        ...maquette,
        restoration_required: boolInt(maquette.restoration_required)
      });
    }
  });

  tx();
  return true;
}

module.exports = seedInventory;
