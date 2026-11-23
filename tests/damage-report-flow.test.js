const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventario-damage-'));
process.env.DB_PATH = path.join(tempDir, 'test.sqlite');

const db = require('../src/config/database');
const initDatabase = require('../src/database/init');
const passageService = require('../src/services/passageService');
const pieceService = require('../src/services/pieceService');
const damageReportService = require('../src/services/damageReportService');
const damageReportPdfService = require('../src/services/damageReportPdfService');
const userService = require('../src/services/userService');

initDatabase(db);

const passage = passageService.createPassage({ testament: 'AT', number: 71, name: 'Pruebas de conservación' });
const curator = userService.createUser({
  name: 'Curadora de prueba',
  email: 'curadora-damage@example.test',
  password: 'Curadora123',
  role: 'curadora'
}, { mustChangePassword: false });

after(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('unitaria: el peso se guarda en gramos y rechaza valores inválidos', () => {
  const piece = pieceService.createPiece({
    passage_id: passage.id,
    internal_code: 'WEIGHT-001',
    name: 'Pieza con peso',
    weight_grams: 1250
  });
  assert.equal(piece.weight_grams, 1250);

  const updated = pieceService.updatePiece(piece.id, { weight_grams: 875.5 });
  assert.equal(updated.weight_grams, 875.5);
  assert.throws(
    () => pieceService.updatePiece(piece.id, { weight_grams: 0 }),
    (error) => error.status === 400 && error.message.includes('mayor a 0')
  );
});

test('integración: un daño conserva un solo expediente activo hasta su resolución', () => {
  const piece = pieceService.createPiece({
    passage_id: passage.id,
    internal_code: 'DAMAGE-001',
    name: 'Pieza dañada',
    weight_grams: 2400
  });

  const damaged = pieceService.changeStatus(piece.id, {
    condition_status: 'roto',
    responsible: 'Montaje',
    reason: 'Fisura lateral',
    actor_user_id: curator.id
  });
  assert.equal(damaged.damage_report.status, 'abierto');
  assert.equal(damaged.damage_report.description, 'Fisura lateral');

  const reviewed = damageReportService.updateReport(damaged.damage_report.id, {
    status: 'abierto',
    responsible: 'Curaduría',
    note: 'Se solicita diagnóstico'
  }, curator);
  assert.equal(reviewed.status, 'abierto');

  const restoration = damageReportService.updateReport(damaged.damage_report.id, {
    status: 'en_restauracion',
    responsible: 'Taller',
    note: 'Ingreso al taller'
  }, curator);
  assert.equal(restoration.status, 'en_restauracion');
  assert.equal(pieceService.getPiece(piece.id).condition_status, 'en_mantenimiento');

  const resolved = damageReportService.updateReport(damaged.damage_report.id, {
    status: 'resuelto',
    resolved_condition: 'bueno',
    responsible: 'Taller',
    note: 'Fisura estabilizada y pieza revisada'
  }, curator);
  assert.equal(resolved.status, 'resuelto');
  assert.equal(resolved.resolution_notes, 'Fisura estabilizada y pieza revisada');
  assert.equal(pieceService.getPiece(piece.id).condition_status, 'bueno');

  const reports = damageReportService.listReports({ status: 'resuelto', q: 'DAMAGE-001' });
  assert.equal(reports.length, 1);
  assert.ok(reports[0].resolved_at);
  assert.ok(damageReportService.getReport(reports[0].id).timeline.length >= 3);
});

test('regresión: un nuevo daño posterior abre otro expediente y el CSV respeta filtros', () => {
  const piece = pieceService.listPieces({ q: 'DAMAGE-001' })[0];
  const damagedAgain = pieceService.registerMovement(piece.id, {
    type: 'mantenimiento',
    condition_status: 'requiere_mantenimiento',
    responsible: 'Custodia',
    reason: 'Desprendimiento nuevo',
    actor_user_id: curator.id
  });
  assert.equal(damagedAgain.damage_report.reported_by_user_id, curator.id);

  const active = damageReportService.listReports({ status: 'activos', q: 'DAMAGE-001' });
  assert.equal(active.length, 1);
  assert.equal(active[0].description, 'Desprendimiento nuevo');

  const csv = damageReportService.exportCsv({ status: 'activos', passageId: String(passage.id) });
  assert.match(csv, /DAMAGE-001/);
  assert.match(csv, /2400 g/);
  assert.doesNotMatch(csv, /WEIGHT-001/);
});

test('migración: estados dañados previos generan un reporte sin duplicarse', () => {
  const result = db.prepare(`
    INSERT INTO pieces (passage_id, internal_code, name, condition_status, maintenance_required)
    VALUES (?, 'LEGACY-DAMAGE', 'Daño anterior', 'roto', 1)
  `).run(passage.id);

  initDatabase(db);
  initDatabase(db);
  const reports = db.prepare('SELECT * FROM damage_reports WHERE piece_id = ?').all(result.lastInsertRowid);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].status, 'abierto');
});

test('sistema: el reporte PDF genera un documento válido con las piezas filtradas', async () => {
  const reports = damageReportService.listReports({ status: 'activos' });
  const pdf = await damageReportPdfService.generateDamageReportsPdf({
    reports,
    filters: { status: 'activos' },
    generatedBy: curator
  });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 3000);
  assert.match(pdf.subarray(pdf.length - 20).toString(), /%%EOF/);
});
