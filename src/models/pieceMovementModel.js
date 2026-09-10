const db = require('../config/database');

function create(data) {
  const result = db.prepare(`
    INSERT INTO piece_movements (
      piece_id, type, from_presence_status, to_presence_status,
      from_condition_status, to_condition_status, responsible, counterparty, reason
    ) VALUES (
      @piece_id, @type, @from_presence_status, @to_presence_status,
      @from_condition_status, @to_condition_status, @responsible, @counterparty, @reason
    )
  `).run(data);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  return db.prepare('SELECT * FROM piece_movements WHERE id = ?').get(id);
}

function list(filters = {}) {
  const where = ['(@pieceId IS NULL OR m.piece_id = @pieceId)'];
  const params = {
    pieceId: filters.pieceId || null,
    dateFrom: filters.dateFromUtc || null,
    dateTo: filters.dateToUtcExclusive || null
  };

  if (filters.dateFromUtc) where.push('m.created_at >= @dateFrom');
  if (filters.dateToUtcExclusive) where.push('m.created_at < @dateTo');

  return db.prepare(`
    SELECT m.*, p.internal_code, p.name AS piece_name, pa.testament, pa.number AS passage_number, pa.name AS passage_name
    FROM piece_movements m
    JOIN pieces p ON p.id = m.piece_id
    JOIN passages pa ON pa.id = p.passage_id
    WHERE ${where.join(' AND ')}
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 300
  `).all(params);
}

module.exports = { create, findById, list };
