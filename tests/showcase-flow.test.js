const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventario-showcases-'));
process.env.DB_PATH = path.join(tempDir, 'test.sqlite');

const db = require('../src/config/database');
const initDatabase = require('../src/database/init');
const passageService = require('../src/services/passageService');
const pieceService = require('../src/services/pieceService');
const showcaseService = require('../src/services/showcaseService');

initDatabase(db);

after(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('una vitrina acepta varios pasajes y cada pasaje conserva una sola vitrina', () => {
  const firstPassage = passageService.createPassage({ testament: 'AT', number: 1, name: 'Pasaje uno' });
  const secondPassage = passageService.createPassage({ testament: 'AT', number: 2, name: 'Pasaje dos' });
  const firstShowcase = showcaseService.createShowcase({
    code: 'VIT-001',
    name: 'Vitrina 001',
    section: 'Este valor no debe acoplar la vitrina',
    length_cm: 150,
    width_cm: 90
  });
  const secondShowcase = showcaseService.createShowcase({ code: 'VIT-002', name: 'Vitrina 002' });
  assert.equal(firstShowcase.section, null);

  showcaseService.assignPassages(firstShowcase.id, { passage_ids: [firstPassage.id, secondPassage.id] });
  let catalog = showcaseService.listShowcases();
  assert.equal(catalog.find((item) => item.id === firstShowcase.id).passage_count, 2);

  showcaseService.assignPassages(secondShowcase.id, { passage_ids: [secondPassage.id] });
  catalog = showcaseService.listShowcases();
  assert.deepEqual(
    catalog.find((item) => item.id === firstShowcase.id).passages.map((passage) => passage.id),
    [firstPassage.id]
  );
  assert.deepEqual(
    catalog.find((item) => item.id === secondShowcase.id).passages.map((passage) => passage.id),
    [secondPassage.id]
  );
});

test('el filtro de inventario usa la vitrina asignada al pasaje', () => {
  const passage = passageService.createPassage({ testament: 'NT', number: 1, name: 'Pasaje filtrable' });
  const showcase = showcaseService.createShowcase({ code: 'VIT-003', name: 'Vitrina 003' });
  showcaseService.assignPassages(showcase.id, { passage_ids: [passage.id] });
  pieceService.createPiece({ passage_id: passage.id, internal_code: 'VITRINA-TEST-1', name: 'Pieza filtrable' });

  const result = pieceService.listPieces({ showcase: String(showcase.id) });
  assert.equal(result.length, 1);
  assert.equal(result[0].assigned_showcase_code, 'VIT-003');
  assert.throws(() => pieceService.listPieces({ showcase: 'incorrecta' }), { status: 400 });
});

test('las medidas deben ser positivas y el código de vitrina es único', () => {
  showcaseService.createShowcase({ code: 'MED-01', name: 'Medidas' });
  assert.throws(
    () => showcaseService.createShowcase({ code: 'MED-02', name: 'Inválida', height_cm: -1 }),
    (error) => error.status === 400 && error.message.includes('height_cm')
  );
  assert.throws(
    () => showcaseService.createShowcase({ code: 'MED-01', name: 'Duplicada' }),
    (error) => error.status === 409
  );
});
