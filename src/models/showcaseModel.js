const db = require('../config/database');

function list() {
  const showcases = db.prepare(`
    SELECT s.*,
      COUNT(DISTINCT sp.passage_id) AS passage_count,
      COUNT(DISTINCT pc.id) AS piece_count
    FROM showcases s
    LEFT JOIN showcase_passages sp ON sp.showcase_id = s.id
    LEFT JOIN pieces pc ON pc.passage_id = sp.passage_id AND pc.active = 1
    WHERE s.active = 1
    GROUP BY s.id
    ORDER BY s.code
  `).all();

  const assignments = db.prepare(`
    SELECT sp.showcase_id, pa.id, pa.testament, pa.number, pa.name,
      COUNT(pc.id) AS pieces
    FROM showcase_passages sp
    JOIN passages pa ON pa.id = sp.passage_id
    LEFT JOIN pieces pc ON pc.passage_id = pa.id AND pc.active = 1
    GROUP BY sp.showcase_id, pa.id
    ORDER BY pa.testament, pa.number
  `).all();
  const byShowcase = new Map();
  assignments.forEach((passage) => {
    if (!byShowcase.has(passage.showcase_id)) byShowcase.set(passage.showcase_id, []);
    byShowcase.get(passage.showcase_id).push(passage);
  });
  return showcases.map((showcase) => ({
    ...showcase,
    passages: byShowcase.get(showcase.id) || []
  }));
}

function findById(id) {
  return db.prepare('SELECT * FROM showcases WHERE id = ? AND active = 1').get(id);
}

function findByCode(code) {
  return db.prepare('SELECT * FROM showcases WHERE code = ?').get(code);
}

function create(data) {
  const result = db.prepare(`
    INSERT INTO showcases (
      code, name, section, support_type, shape, length_cm, width_cm,
      height_cm, diameter_cm, measurement_notes, location, observations
    ) VALUES (
      @code, @name, @section, @support_type, @shape, @length_cm, @width_cm,
      @height_cm, @diameter_cm, @measurement_notes, @location, @observations
    )
  `).run(data);
  return findById(result.lastInsertRowid);
}

function update(id, data) {
  db.prepare(`
    UPDATE showcases SET
      code = @code, name = @name, section = @section,
      support_type = @support_type, shape = @shape,
      length_cm = @length_cm, width_cm = @width_cm,
      height_cm = @height_cm, diameter_cm = @diameter_cm,
      measurement_notes = @measurement_notes, location = @location,
      observations = @observations, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id AND active = 1
  `).run({ id, ...data });
  return findById(id);
}

function assignPassages(showcaseId, passageIds) {
  return db.transaction(() => {
    const currentIds = db.prepare('SELECT passage_id FROM showcase_passages WHERE showcase_id = ?')
      .all(showcaseId).map((row) => row.passage_id);
    const desired = new Set(passageIds);
    const remove = db.prepare('DELETE FROM showcase_passages WHERE showcase_id = ? AND passage_id = ?');
    currentIds.filter((id) => !desired.has(id)).forEach((id) => remove.run(showcaseId, id));

    const assign = db.prepare(`
      INSERT INTO showcase_passages (showcase_id, passage_id)
      VALUES (?, ?)
      ON CONFLICT(passage_id) DO UPDATE SET
        showcase_id = excluded.showcase_id,
        assigned_at = CURRENT_TIMESTAMP
    `);
    passageIds.forEach((passageId) => assign.run(showcaseId, passageId));
  })();
}

module.exports = { assignPassages, create, findByCode, findById, list, update };
