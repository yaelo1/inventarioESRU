const db = require('../config/database');

function create(data) {
  const result = db.prepare(`
    INSERT INTO loans (
      piece_id, loaned_to_passage_id, loaned_to, expected_return_date, responsible_out, notes
    ) VALUES (
      @piece_id, @loaned_to_passage_id, @loaned_to, @expected_return_date, @responsible_out, @notes
    )
  `).run(data);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  return db.prepare(`
    SELECT l.*, p.internal_code, p.name AS piece_name,
      dest.testament AS destination_testament, dest.number AS destination_passage_number,
      dest.name AS destination_passage_name
    FROM loans l
    JOIN pieces p ON p.id = l.piece_id
    LEFT JOIN passages dest ON dest.id = l.loaned_to_passage_id
    WHERE l.id = ?
  `).get(id);
}

function findActiveByPiece(pieceId) {
  return db.prepare('SELECT * FROM loans WHERE piece_id = ? AND status = ?').get(pieceId, 'activo');
}

function close(id, data) {
  db.prepare(`
    UPDATE loans
    SET status = 'devuelto', returned_at = CURRENT_TIMESTAMP,
        responsible_in = @responsible_in, return_notes = @return_notes
    WHERE id = @id AND status = 'activo'
  `).run({ ...data, id });
  return findById(id);
}

function cancel(id, reason) {
  db.prepare(`
    UPDATE loans
    SET status = 'cancelado', returned_at = CURRENT_TIMESTAMP, return_notes = @reason
    WHERE id = @id AND status = 'activo'
  `).run({ id, reason });
  return findById(id);
}

function list(filters = {}) {
  return db.prepare(`
    SELECT l.*, p.internal_code, p.name AS piece_name, p.image_path, p.thumbnail_path,
      pa.id AS origin_passage_id, pa.testament, pa.number AS passage_number,
      pa.name AS passage_name, pa.image_path AS origin_passage_image_path,
      pa.thumbnail_path AS origin_passage_thumbnail_path,
      dest.testament AS destination_testament, dest.number AS destination_passage_number,
      dest.name AS destination_passage_name, dest.image_path AS destination_passage_image_path,
      dest.thumbnail_path AS destination_passage_thumbnail_path
    FROM loans l
    JOIN pieces p ON p.id = l.piece_id
    JOIN passages pa ON pa.id = p.passage_id
    LEFT JOIN passages dest ON dest.id = l.loaned_to_passage_id
    WHERE (@status IS NULL OR l.status = @status)
      AND (@originPassageId IS NULL OR p.passage_id = @originPassageId)
      AND (@destinationPassageId IS NULL OR l.loaned_to_passage_id = @destinationPassageId)
      AND (
        @due IS NULL
        OR (@due = 'overdue' AND l.status = 'activo' AND l.expected_return_date IS NOT NULL AND l.expected_return_date < DATE('now', 'localtime'))
        OR (@due = 'soon' AND l.status = 'activo' AND l.expected_return_date IS NOT NULL AND l.expected_return_date BETWEEN DATE('now', 'localtime') AND DATE('now', 'localtime', '+7 days'))
        OR (@due = 'without-date' AND l.status = 'activo' AND l.expected_return_date IS NULL)
      )
    ORDER BY l.checkout_date DESC, l.id DESC
  `).all({
    status: filters.status || null,
    originPassageId: filters.originPassageId || null,
    destinationPassageId: filters.destinationPassageId || null,
    due: filters.due || null
  });
}

module.exports = { create, findById, findActiveByPiece, close, cancel, list };
