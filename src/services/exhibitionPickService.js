const db = require('../config/database');
const exhibitionPickModel = require('../models/exhibitionPickModel');
const pieceModel = require('../models/pieceModel');
const movementModel = require('../models/pieceMovementModel');
const loanModel = require('../models/loanModel');
const pieceService = require('./pieceService');

const pickStatuses = ['seleccionada', 'sacada', 'montada', 'finalizada', 'cancelada', 'no_seleccionada'];
const allowedTransitions = {
  seleccionada: ['sacada', 'cancelada'],
  sacada: ['montada', 'cancelada'],
  montada: ['finalizada']
};

function appError(message, status, errors) {
  const error = new Error(message);
  error.status = status;
  if (errors) error.errors = errors;
  return error;
}

function listPicks(query) {
  if (query.status && !pickStatuses.includes(query.status)) {
    throw appError('status no es válido', 400);
  }
  return exhibitionPickModel.list({
    targetPassageId: query.targetPassageId ? Number(query.targetPassageId) : null,
    status: query.status || null,
    includeCompleted: query.includeCompleted === 'true'
  });
}

function selectPiece(pieceId, body) {
  return pieceService.prepareExhibition(pieceId, body);
}

function updateStatus(id, body) {
  if (!pickStatuses.includes(body.status) || body.status === 'no_seleccionada') {
    throw appError('status no es valido', 400);
  }
  const pick = exhibitionPickModel.findById(id);
  if (!pick) throw appError('Seleccion no encontrada', 404);
  if (pick.status === body.status) return pick;
  if (!(allowedTransitions[pick.status] || []).includes(body.status)) {
    throw appError(`No se puede cambiar de ${pick.status} a ${body.status}`, 409);
  }
  const piece = pieceModel.findById(pick.piece_id);
  if (!piece || !piece.active) throw appError('Pieza no encontrada', 404);
  const activeLoan = loanModel.findActiveByPiece(pick.piece_id);
  if (body.status === 'finalizada' && activeLoan) {
    throw appError('Una pieza prestada debe desmontarse y devolverse en una sola operación', 409);
  }

  const tx = db.transaction(() => {
    const updated = exhibitionPickModel.updateStatus(id, body.status);
    if (body.status === 'cancelada' && activeLoan) {
      if (pick.status !== 'seleccionada') {
        throw appError('La pieza ya salió; registra su devolución para cerrar el préstamo', 409);
      }
      loanModel.cancel(activeLoan.id, body.notes ? String(body.notes).trim() : 'Preparación de salida cancelada');
      const stored = pieceModel.update(pick.piece_id, { presence_status: 'en_caja' });
      movementModel.create({
        piece_id: pick.piece_id,
        type: 'ajuste',
        from_presence_status: piece.presence_status,
        to_presence_status: stored.presence_status,
        from_condition_status: piece.condition_status,
        to_condition_status: stored.condition_status,
        responsible: body.responsible ? String(body.responsible).trim() : null,
        counterparty: `${pick.target_testament || ''} P${pick.target_passage_number || ''}`.trim(),
        reason: body.notes ? String(body.notes).trim() : 'Preparación de salida y préstamo cancelados'
      });
    }
    if (body.status === 'sacada') {
      movementModel.create({
        piece_id: pick.piece_id,
        type: 'salida',
        from_presence_status: piece.presence_status,
        to_presence_status: piece.presence_status,
        from_condition_status: piece.condition_status,
        to_condition_status: piece.condition_status,
        responsible: body.responsible ? String(body.responsible).trim() : null,
        counterparty: `${pick.target_testament || ''} P${pick.target_passage_number || ''}`.trim(),
        reason: body.notes ? String(body.notes).trim() : 'Salida para exposición'
      });
    }
    if (body.status === 'montada') {
      const mounted = activeLoan
        ? pieceModel.findById(pick.piece_id)
        : pieceModel.update(pick.piece_id, { presence_status: 'en_vitrina' });
      movementModel.create({
        piece_id: pick.piece_id,
        type: 'uso',
        from_presence_status: piece.presence_status,
        to_presence_status: mounted.presence_status,
        from_condition_status: piece.condition_status,
        to_condition_status: mounted.condition_status,
        responsible: body.responsible ? String(body.responsible).trim() : null,
        counterparty: `${pick.target_testament || ''} P${pick.target_passage_number || ''}`.trim(),
        reason: body.notes ? String(body.notes).trim() : 'Montada en exposición'
      });
    }
    if (body.status === 'finalizada' && !activeLoan) {
      const stored = pieceModel.update(pick.piece_id, { presence_status: 'en_caja' });
      movementModel.create({
        piece_id: pick.piece_id,
        type: 'ingreso',
        from_presence_status: piece.presence_status,
        to_presence_status: stored.presence_status,
        from_condition_status: piece.condition_status,
        to_condition_status: stored.condition_status,
        responsible: body.responsible ? String(body.responsible).trim() : null,
        counterparty: `${pick.target_testament || ''} P${pick.target_passage_number || ''}`.trim(),
        reason: body.notes ? String(body.notes).trim() : 'Exposición finalizada; pieza guardada'
      });
    }
    return updated;
  });

  return tx();
}

module.exports = { listPicks, selectPiece, updateStatus };
