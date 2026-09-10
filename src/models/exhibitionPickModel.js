const db = require('../config/database');

function list(filters = {}) {
  const where = [];
  const params = {
    targetPassageId: filters.targetPassageId || null,
    status: filters.status || null
  };

  if (filters.targetPassageId) where.push('ep.target_passage_id = @targetPassageId');
  if (filters.status && filters.status !== 'no_seleccionada') where.push('ep.status = @status');
  else if (!filters.includeCompleted) where.push("ep.status IN ('seleccionada', 'sacada', 'montada')");

  const picks = filters.status === 'no_seleccionada' ? [] : db.prepare(`
    SELECT
      ep.*,
      pc.internal_code,
      pc.registry_number,
      pc.name AS piece_name,
      pc.box,
      pc.drawer,
      pc.showcase,
      pc.exhibition_location,
      pc.custodian,
      pc.presence_status,
      pc.condition_status,
      pc.image_path,
      pc.thumbnail_path,
      l.id AS active_loan_id,
      origin.testament AS origin_testament,
      origin.number AS origin_passage_number,
      origin.name AS origin_passage_name,
      target.testament AS target_testament,
      target.number AS target_passage_number,
      target.name AS target_passage_name
    FROM exhibition_picks ep
    JOIN pieces pc ON pc.id = ep.piece_id
    JOIN passages origin ON origin.id = pc.passage_id
    JOIN passages target ON target.id = ep.target_passage_id
    LEFT JOIN loans l ON l.piece_id = ep.piece_id AND l.status = 'activo'
    WHERE ${where.length ? where.join(' AND ') : '1 = 1'}
    ORDER BY target.testament, target.number, ep.status, pc.global_number, ep.id
  `).all(params);

  if (!filters.targetPassageId || filters.includeCompleted) return picks;

  const unselected = db.prepare(`
    SELECT
      NULL AS id,
      pc.id AS piece_id,
      @targetPassageId AS target_passage_id,
      'no_seleccionada' AS status,
      NULL AS requested_by,
      NULL AS notes,
      NULL AS created_at,
      NULL AS updated_at,
      pc.internal_code,
      pc.registry_number,
      pc.name AS piece_name,
      pc.box,
      pc.drawer,
      pc.showcase,
      pc.exhibition_location,
      pc.custodian,
      pc.presence_status,
      pc.condition_status,
      pc.image_path,
      pc.thumbnail_path,
      NULL AS active_loan_id,
      origin.testament AS origin_testament,
      origin.number AS origin_passage_number,
      origin.name AS origin_passage_name,
      origin.testament AS target_testament,
      origin.number AS target_passage_number,
      origin.name AS target_passage_name
    FROM pieces pc
    JOIN passages origin ON origin.id = pc.passage_id
    WHERE pc.passage_id = @targetPassageId
      AND pc.active = 1
      AND NOT EXISTS (
        SELECT 1 FROM exhibition_picks active_pick
        WHERE active_pick.piece_id = pc.id
          AND active_pick.target_passage_id = @targetPassageId
          AND active_pick.status IN ('seleccionada', 'sacada', 'montada')
      )
    ORDER BY pc.global_number, pc.id
  `).all(params);

  if (filters.status === 'no_seleccionada') return unselected;
  if (filters.status) return picks;
  return [...picks, ...unselected];
}

function findById(id) {
  return db.prepare(`
    SELECT ep.*, pc.name AS piece_name, pc.internal_code,
      target.testament AS target_testament,
      target.number AS target_passage_number,
      target.name AS target_passage_name
    FROM exhibition_picks ep
    JOIN pieces pc ON pc.id = ep.piece_id
    JOIN passages target ON target.id = ep.target_passage_id
    WHERE ep.id = ?
  `).get(id);
}

function findActiveByPiece(pieceId) {
  return db.prepare(`
    SELECT * FROM exhibition_picks
    WHERE piece_id = ? AND status IN ('seleccionada', 'sacada', 'montada')
  `).get(pieceId);
}

function create(data) {
  const result = db.prepare(`
    INSERT INTO exhibition_picks (piece_id, target_passage_id, requested_by, notes)
    VALUES (@piece_id, @target_passage_id, @requested_by, @notes)
  `).run(data);
  return findById(result.lastInsertRowid);
}

function updateStatus(id, status) {
  db.prepare(`
    UPDATE exhibition_picks
    SET status = @status, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ id, status });
  return findById(id);
}

module.exports = { list, findById, findActiveByPiece, create, updateStatus };
