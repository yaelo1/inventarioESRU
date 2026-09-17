const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const env = require('../src/config/env');
const initDatabase = require('../src/database/init');

initDatabase(db);

const catalog = JSON.parse(fs.readFileSync(path.join(env.rootDir, 'data/showcases.json'), 'utf8'));
const findShowcase = db.prepare('SELECT id FROM showcases WHERE code = ?');
const migrateLegacyShowcase = db.prepare(`
  UPDATE showcases SET
    code = @code,
    name = @name,
    section = NULL,
    observations = CASE
      WHEN NULLIF(TRIM(@observations), '') IS NULL THEN observations
      WHEN NULLIF(TRIM(observations), '') IS NULL THEN @observations
      WHEN INSTR(observations, @observations) > 0 THEN observations
      ELSE observations || CHAR(10) || @observations
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE code = @legacy_code
`);
const upsert = db.prepare(`
  INSERT INTO showcases (
    code, name, section, support_type, shape, length_cm, width_cm,
    height_cm, diameter_cm, measurement_notes, location, observations
  ) VALUES (
    @code, @name, @section, @support_type, @shape, @length_cm, @width_cm,
    @height_cm, @diameter_cm, @measurement_notes, @location, @observations
  )
  ON CONFLICT(code) DO UPDATE SET
    name = excluded.name,
    section = NULL,
    support_type = excluded.support_type,
    shape = excluded.shape,
    length_cm = excluded.length_cm,
    width_cm = excluded.width_cm,
    height_cm = excluded.height_cm,
    diameter_cm = excluded.diameter_cm,
    measurement_notes = excluded.measurement_notes,
    updated_at = CURRENT_TIMESTAMP
`);
const findLegacyPassages = db.prepare(`
  SELECT id FROM passages WHERE testament = ? AND TRIM(showcase) = ?
`);
const assign = db.prepare(`
  INSERT OR IGNORE INTO showcase_passages (showcase_id, passage_id) VALUES (?, ?)
`);

let assignments = 0;
db.transaction(() => {
  catalog.forEach((entry) => {
    const data = {
      code: entry.code,
      name: entry.name,
      section: null,
      support_type: entry.support_type || 'Vitrina',
      shape: entry.shape || 'rectangular',
      length_cm: entry.length_cm || null,
      width_cm: entry.width_cm || null,
      height_cm: entry.height_cm || null,
      diameter_cm: entry.diameter_cm || null,
      measurement_notes: entry.measurement_notes || null,
      location: entry.location || null,
      observations: entry.observations || null
    };
    if (!findShowcase.get(entry.code) && entry.legacy_code) {
      migrateLegacyShowcase.run({
        code: entry.code,
        name: entry.name,
        legacy_code: entry.legacy_code,
        observations: entry.observations || null
      });
    }
    upsert.run(data);
    const showcase = findShowcase.get(entry.code);
    const passages = findLegacyPassages.all(entry.legacy_testament, entry.legacy_label);
    passages.forEach((passage) => {
      const result = assign.run(showcase.id, passage.id);
      assignments += result.changes;
    });
  });
})();

console.log(`Vitrinas importadas: ${catalog.length}`);
console.log(`Pasajes asignados por primera vez: ${assignments}`);
