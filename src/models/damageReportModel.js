const db = require('../config/database');

const activeConditions = ['roto', 'requiere_mantenimiento', 'en_mantenimiento'];
const writableFields = [
  'status', 'description', 'responsible', 'reported_by_user_id',
  'resolved_at', 'resolution_notes'
];

function list(filters = {}) {
  const where = [];
  const params = {};
  if (filters.status === 'activos') where.push("dr.status != 'resuelto'");
  else if (filters.status) {
    where.push('dr.status = @status');
    params.status = filters.status;
  }
  if (filters.conditionStatus) {
    where.push('pc.condition_status = @conditionStatus');
    params.conditionStatus = filters.conditionStatus;
  }
  if (filters.testament) {
    where.push('pa.testament = @testament');
    params.testament = filters.testament;
  }
  if (filters.passageId) {
    where.push('pa.id = @passageId');
    params.passageId = filters.passageId;
  }
  if (filters.dateFrom) {
    where.push('dr.opened_at >= @dateFrom');
    params.dateFrom = `${filters.dateFrom} 00:00:00`;
  }
  if (filters.dateTo) {
    where.push("dr.opened_at < datetime(@dateTo, '+1 day')");
    params.dateTo = `${filters.dateTo} 00:00:00`;
  }
  if (filters.q) {
    where.push(`(
      pc.internal_code LIKE @q OR pc.name LIKE @q OR pa.name LIKE @q
      OR dr.description LIKE @q OR dr.responsible LIKE @q
    )`);
    params.q = `%${filters.q}%`;
  }
  return db.prepare(`${baseSelect()} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY CASE WHEN dr.status = 'resuelto' THEN 1 ELSE 0 END, dr.opened_at DESC, dr.id DESC
  `).all(params);
}

function findById(id) {
  return db.prepare(`${baseSelect()} WHERE dr.id = ?`).get(id);
}

function findActiveByPiece(pieceId) {
  return db.prepare(`
    SELECT * FROM damage_reports
    WHERE piece_id = ? AND status != 'resuelto'
    ORDER BY id DESC LIMIT 1
  `).get(pieceId);
}

function create(data) {
  const result = db.prepare(`
    INSERT INTO damage_reports (
      piece_id, status, initial_condition_status, description, responsible,
      reported_by_user_id, opened_at
    ) VALUES (
      @piece_id, @status, @initial_condition_status, @description, @responsible,
      @reported_by_user_id, COALESCE(@opened_at, CURRENT_TIMESTAMP)
    )
  `).run({
    responsible: null,
    reported_by_user_id: null,
    opened_at: null,
    ...data
  });
  return findById(result.lastInsertRowid);
}

function update(id, data) {
  const fields = writableFields.filter((field) => data[field] !== undefined);
  if (!fields.length) return findById(id);
  db.prepare(`
    UPDATE damage_reports
    SET ${fields.map((field) => `${field} = @${field}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ id, ...data });
  return findById(id);
}

function timeline(report) {
  return db.prepare(`
    SELECT id, type, from_presence_status, to_presence_status,
      from_condition_status, to_condition_status, responsible, reason, created_at
    FROM piece_movements
    WHERE piece_id = ? AND created_at >= ?
    ORDER BY created_at DESC, id DESC
  `).all(report.piece_id, report.opened_at);
}

function syncCondition({ piece, conditionStatus, responsible, reason, userId }) {
  const active = findActiveByPiece(piece.id);
  if (activeConditions.includes(conditionStatus)) {
    const status = conditionStatus === 'en_mantenimiento'
      ? 'en_restauracion'
      : 'abierto';
    if (active) {
      return update(active.id, {
        status,
        responsible: responsible || active.responsible
      });
    }
    return create({
      piece_id: piece.id,
      status,
      initial_condition_status: conditionStatus,
      description: cleanText(reason) || cleanText(piece.observations) || 'Daño registrado desde conservación',
      responsible: cleanText(responsible),
      reported_by_user_id: userId || null
    });
  }
  if (!active) return null;
  return update(active.id, {
    status: 'resuelto',
    resolved_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    resolution_notes: cleanText(reason) || active.resolution_notes || 'Conservación actualizada'
  });
}

function baseSelect() {
  return `
    SELECT dr.*, pc.internal_code, pc.name AS piece_name, pc.condition_status,
      pc.presence_status, pc.weight_grams, pc.image_path, pc.thumbnail_path, pc.original_image_path,
      pa.id AS passage_id, pa.testament, pa.number AS passage_number, pa.name AS passage_name,
      u.name AS reported_by_name
    FROM damage_reports dr
    JOIN pieces pc ON pc.id = dr.piece_id
    JOIN passages pa ON pa.id = pc.passage_id
    LEFT JOIN users u ON u.id = dr.reported_by_user_id
  `;
}

function cleanText(value) {
  return value === undefined || value === null ? null : String(value).trim() || null;
}

module.exports = { create, findActiveByPiece, findById, list, syncCondition, timeline, update };
