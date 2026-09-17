const db = require('../config/database');

const writableFields = [
  'passage_id', 'internal_code', 'registry_number', 'global_number',
  'piece_number', 'consecutive_number', 'name', 'artist', 'box', 'drawer',
  'showcase', 'exhibition_location', 'custodian', 'never_leaves_box',
  'presence_status', 'condition_status', 'maintenance_required',
  'material', 'deep', 'length', 'height', 'observations', 'loan_notes',
  'is_loan_related', 'image_path', 'original_image_path', 'thumbnail_path', 'active'
];

function list(filters = {}) {
  const where = ['pc.active = 1'];
  const params = {};

  if (filters.testament) {
    where.push('pa.testament = @testament');
    params.testament = filters.testament;
  }
  if (filters.passageNumber) {
    where.push('pa.number = @passageNumber');
    params.passageNumber = filters.passageNumber;
  }
  if (filters.showcase) {
    where.push('s.id = @showcase');
    params.showcase = filters.showcase;
  }
  if (filters.presenceStatus) {
    where.push('pc.presence_status = @presenceStatus');
    params.presenceStatus = filters.presenceStatus;
  }
  if (filters.conditionStatus) {
    where.push('pc.condition_status = @conditionStatus');
    params.conditionStatus = filters.conditionStatus;
  }
  if (filters.maintenanceRequired) {
    where.push("pc.condition_status IN ('roto', 'requiere_mantenimiento', 'en_mantenimiento')");
  }
  if (filters.custodyAlert) {
    where.push("(pc.presence_status = 'en_mantenimiento' OR pc.condition_status IN ('roto', 'requiere_mantenimiento', 'en_mantenimiento'))");
  }
  if (filters.q) {
    where.push(`(
      pc.name LIKE @q OR pc.internal_code LIKE @q OR pc.registry_number LIKE @q
      OR pc.material LIKE @q OR pc.observations LIKE @q
      OR pc.exhibition_location LIKE @q OR pc.custodian LIKE @q OR pa.name LIKE @q
      OR s.code LIKE @q OR s.name LIKE @q
      OR (pa.testament || ' P' || pa.number) LIKE @q
      OR (pa.testament || '-P' || pa.number) LIKE @q
    )`);
    params.q = `%${filters.q}%`;
  }

  return db.prepare(`
    SELECT pc.*, pa.testament, pa.number AS passage_number, pa.name AS passage_name,
      s.id AS assigned_showcase_id, s.code AS assigned_showcase_code,
      s.name AS assigned_showcase_name,
      l.id AS active_loan_id,
      l.loaned_to_passage_id AS active_loan_passage_id,
      l.loaned_to AS active_loan_destination,
      loan_dest.testament AS active_loan_testament,
      loan_dest.number AS active_loan_passage_number,
      loan_dest.name AS active_loan_passage_name,
      ep.id AS active_pick_id,
      ep.status AS active_pick_status,
      ep.target_passage_id AS active_pick_passage_id,
      pick_dest.testament AS active_pick_testament,
      pick_dest.number AS active_pick_passage_number,
      pick_dest.name AS active_pick_passage_name
    FROM pieces pc
    JOIN passages pa ON pa.id = pc.passage_id
    LEFT JOIN showcase_passages sp ON sp.passage_id = pa.id
    LEFT JOIN showcases s ON s.id = sp.showcase_id AND s.active = 1
    LEFT JOIN loans l ON l.piece_id = pc.id AND l.status = 'activo'
    LEFT JOIN passages loan_dest ON loan_dest.id = l.loaned_to_passage_id
    LEFT JOIN exhibition_picks ep
      ON ep.piece_id = pc.id AND ep.status IN ('seleccionada', 'sacada', 'montada')
    LEFT JOIN passages pick_dest ON pick_dest.id = ep.target_passage_id
    WHERE ${where.join(' AND ')}
    ORDER BY pc.global_number, pa.testament, pa.number, pc.piece_number
  `).all(params);
}

function findById(id) {
  return db.prepare(`
    SELECT pc.*, pa.testament, pa.number AS passage_number, pa.name AS passage_name,
      s.id AS assigned_showcase_id, s.code AS assigned_showcase_code,
      s.name AS assigned_showcase_name
    FROM pieces pc
    JOIN passages pa ON pa.id = pc.passage_id
    LEFT JOIN showcase_passages sp ON sp.passage_id = pa.id
    LEFT JOIN showcases s ON s.id = sp.showcase_id AND s.active = 1
    WHERE pc.id = ?
  `).get(id);
}

function findPassage(testament, number) {
  return db.prepare('SELECT * FROM passages WHERE testament = ? AND number = ?').get(testament, number);
}

function create(data) {
  const fields = writableFields.filter((field) => data[field] !== undefined);
  const result = db.prepare(`
    INSERT INTO pieces (${fields.join(', ')})
    VALUES (${fields.map((field) => `@${field}`).join(', ')})
  `).run(data);
  return findById(result.lastInsertRowid);
}

function update(id, data) {
  const fields = writableFields.filter((field) => data[field] !== undefined);
  db.prepare(`
    UPDATE pieces
    SET ${fields.map((field) => `${field} = @${field}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ ...data, id });
  return findById(id);
}

function stats() {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS pieces,
      (SELECT COUNT(DISTINCT piece_id) FROM loans WHERE status = 'activo') AS loaned,
      SUM(CASE WHEN presence_status = 'en_mantenimiento' THEN 1 ELSE 0 END) AS in_restoration,
      SUM(CASE WHEN condition_status = 'roto' THEN 1 ELSE 0 END) AS broken,
      SUM(CASE WHEN condition_status IN ('roto', 'requiere_mantenimiento', 'en_mantenimiento') THEN 1 ELSE 0 END) AS maintenance
    FROM pieces
    WHERE active = 1
  `).get();
  const byPassage = db.prepare(`
    SELECT pa.testament, pa.number, pa.name, COUNT(pc.id) AS pieces
    FROM passages pa
    LEFT JOIN pieces pc ON pc.passage_id = pa.id AND pc.active = 1
    GROUP BY pa.id
    ORDER BY pa.testament, pa.number
  `).all();
  return { totals, byPassage };
}

module.exports = { list, findById, findPassage, create, update, stats };
