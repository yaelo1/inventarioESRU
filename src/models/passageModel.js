const db = require('../config/database');

function list() {
  return db.prepare(`
    SELECT pa.*, COUNT(pc.id) AS pieces
    FROM passages pa
    LEFT JOIN pieces pc ON pc.passage_id = pa.id AND pc.active = 1
    GROUP BY pa.id
    ORDER BY pa.testament, pa.number
  `).all();
}

function findById(id) {
  return db.prepare('SELECT * FROM passages WHERE id = ?').get(id);
}

function findByTestamentAndNumber(testament, number) {
  return db.prepare('SELECT * FROM passages WHERE testament = ? AND number = ?').get(testament, number);
}

function create(data) {
  const result = db.prepare(`
    INSERT INTO passages (testament, number, name, box, drawer, showcase, observations)
    VALUES (@testament, @number, @name, @box, @drawer, @showcase, @observations)
  `).run(data);
  return findById(result.lastInsertRowid);
}

function updateImage(id, imagePath, originalImagePath, thumbnailPath) {
  db.prepare(`
    UPDATE passages
    SET image_path = @imagePath, original_image_path = @originalImagePath,
        thumbnail_path = @thumbnailPath, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ id, imagePath, originalImagePath, thumbnailPath });
  return findById(id);
}

module.exports = { list, findById, findByTestamentAndNumber, create, updateImage };
