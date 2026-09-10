const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventario-famma-'));
process.env.DB_PATH = path.join(tempDir, 'test.sqlite');

const db = require('../src/config/database');
const initDatabase = require('../src/database/init');
const passageService = require('../src/services/passageService');
const pieceService = require('../src/services/pieceService');
const exhibitionPickService = require('../src/services/exhibitionPickService');
const loanModel = require('../src/models/loanModel');
const exhibitionPickModel = require('../src/models/exhibitionPickModel');

initDatabase(db);

after(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function createPassage(number, name) {
  return passageService.createPassage({ testament: 'AT', number, name });
}

function createPiece(passage, code) {
  return pieceService.createPiece({
    passage_id: passage.id,
    internal_code: code,
    name: `Pieza ${code}`,
    box: '1',
    drawer: '2'
  });
}

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

test('flujo prestado: preparación, montaje, cierre y devolución', () => {
  const origin = createPassage(1, 'Origen');
  const target = createPassage(2, 'Destino');
  const piece = createPiece(origin, 'TEST-LOAN-1');
  pieceService.changeStatus(piece.id, { presence_status: 'en_caja', condition_status: 'bueno' });

  assert.throws(
    () => pieceService.prepareExhibition(piece.id, { target_passage_id: target.id }),
    (error) => error.status === 400 && error.message.includes('expected_return_date')
  );

  const prepared = pieceService.prepareExhibition(piece.id, {
    target_passage_id: target.id,
    expected_return_date: futureDate(),
    responsible_out: 'Curaduría',
    requested_by: 'Curaduría',
    notes: 'Pieza requerida para el pasaje destino'
  });

  assert.equal(prepared.borrowed, true);
  assert.equal(pieceService.getPiece(piece.id).presence_status, 'prestada');
  assert.equal(loanModel.findActiveByPiece(piece.id).id, prepared.loan.id);
  assert.throws(() => pieceService.changeStatus(piece.id, { presence_status: 'en_caja' }), { status: 409 });
  assert.throws(() => pieceService.archivePiece(piece.id), { status: 409 });
  assert.throws(
    () => exhibitionPickService.updateStatus(prepared.pick.id, { status: 'montada' }),
    { status: 409 }
  );

  exhibitionPickService.updateStatus(prepared.pick.id, { status: 'sacada' });
  exhibitionPickService.updateStatus(prepared.pick.id, { status: 'montada' });
  assert.equal(pieceService.getPiece(piece.id).presence_status, 'prestada');
  assert.throws(
    () => exhibitionPickService.updateStatus(prepared.pick.id, { status: 'finalizada' }),
    (error) => error.status === 409 && error.message.includes('desmontarse y devolverse')
  );

  assert.throws(() => pieceService.returnLoan(prepared.loan.id, {}), { status: 400 });
  const returned = pieceService.returnLoan(prepared.loan.id, {
    presence_status: 'en_caja',
    condition_status: 'bueno',
    responsible_in: 'Custodia',
    notes: 'Regresó sin daño'
  });
  assert.equal(returned.piece.presence_status, 'en_caja');
  assert.equal(returned.loan.notes, 'Pieza requerida para el pasaje destino');
  assert.equal(returned.loan.return_notes, 'Regresó sin daño');
  assert.equal(loanModel.findActiveByPiece(piece.id), undefined);
  assert.equal(exhibitionPickModel.findActiveByPiece(piece.id), undefined);
});

test('flujo propio: una pieza montada puede guardarse y volver a seleccionarse', () => {
  const passage = createPassage(3, 'Exhibición propia');
  const piece = createPiece(passage, 'TEST-OWN-1');
  const unselectedPiece = createPiece(passage, 'TEST-OWN-2');
  pieceService.changeStatus(piece.id, { presence_status: 'en_caja', condition_status: 'bueno' });

  const prepared = pieceService.prepareExhibition(piece.id, { target_passage_id: passage.id });
  assert.equal(prepared.loan, null);
  const roster = exhibitionPickService.listPicks({ targetPassageId: String(passage.id) });
  assert.equal(roster.find((item) => item.piece_id === piece.id).status, 'seleccionada');
  assert.equal(roster.find((item) => item.piece_id === unselectedPiece.id).status, 'no_seleccionada');
  exhibitionPickService.updateStatus(prepared.pick.id, { status: 'sacada' });
  exhibitionPickService.updateStatus(prepared.pick.id, { status: 'montada' });
  assert.equal(pieceService.getPiece(piece.id).presence_status, 'en_vitrina');
  exhibitionPickService.updateStatus(prepared.pick.id, { status: 'finalizada' });
  assert.equal(pieceService.getPiece(piece.id).presence_status, 'en_caja');

  const next = pieceService.prepareExhibition(piece.id, { target_passage_id: passage.id });
  assert.equal(next.pick.status, 'seleccionada');
  exhibitionPickService.updateStatus(next.pick.id, { status: 'cancelada' });
});

test('conservación gobierna la alerta de restauración', () => {
  const passage = createPassage(4, 'Conservación');
  const piece = createPiece(passage, 'TEST-COND-1');
  pieceService.changeStatus(piece.id, { condition_status: 'requiere_mantenimiento' });
  assert.equal(pieceService.getPiece(piece.id).maintenance_required, 1);
  pieceService.changeStatus(piece.id, { condition_status: 'bueno' });
  assert.equal(pieceService.getPiece(piece.id).maintenance_required, 0);
});

test('cancelar una preparación prestada revierte también el préstamo', () => {
  const origin = createPassage(5, 'Origen cancelación');
  const target = createPassage(6, 'Destino cancelación');
  const piece = createPiece(origin, 'TEST-CANCEL-LOAN');
  pieceService.changeStatus(piece.id, { presence_status: 'en_caja', condition_status: 'bueno' });

  const prepared = pieceService.prepareExhibition(piece.id, {
    target_passage_id: target.id,
    expected_return_date: futureDate()
  });
  exhibitionPickService.updateStatus(prepared.pick.id, { status: 'cancelada' });

  assert.equal(loanModel.findById(prepared.loan.id).status, 'cancelado');
  assert.equal(loanModel.findActiveByPiece(piece.id), undefined);
  assert.equal(pieceService.getPiece(piece.id).presence_status, 'en_caja');
  assert.equal(exhibitionPickModel.findActiveByPiece(piece.id), undefined);
});
