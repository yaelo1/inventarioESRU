const db = require('../config/database');
const env = require('../config/env');
const pieceModel = require('../models/pieceModel');
const movementModel = require('../models/pieceMovementModel');
const loanModel = require('../models/loanModel');
const passageModel = require('../models/passageModel');
const exhibitionPickModel = require('../models/exhibitionPickModel');

const presenceStatuses = ['en_caja', 'en_vitrina', 'prestada', 'en_mantenimiento', 'sin_confirmar'];
const conditionStatuses = ['bueno', 'regular', 'roto', 'requiere_mantenimiento', 'en_mantenimiento', 'sin_revisar'];
const movementTypes = ['ingreso', 'salida', 'uso', 'prestamo', 'devolucion', 'traslado', 'mantenimiento', 'cambio_estado', 'ajuste'];

function appError(message, status, errors) {
  const error = new Error(message);
  error.status = status;
  if (errors) error.errors = errors;
  return error;
}

function listPieces(query) {
  return pieceModel.list({
    testament: query.testament ? String(query.testament).toUpperCase() : null,
    passageNumber: query.passageNumber ? Number(query.passageNumber) : null,
    showcase: query.showcase ? String(query.showcase).trim() : null,
    presenceStatus: query.presenceStatus || null,
    conditionStatus: query.conditionStatus || null,
    maintenanceRequired: query.maintenanceRequired === 'true',
    custodyAlert: query.custodyAlert === 'true',
    q: query.q ? String(query.q).trim() : null
  });
}

function getPiece(id) {
  const piece = pieceModel.findById(id);
  if (!piece || !piece.active) throw appError('Pieza no encontrada', 404);
  return piece;
}

function listMovements(query) {
  for (const field of ['dateFrom', 'dateTo']) {
    if (query[field] && !/^\d{4}-\d{2}-\d{2}$/.test(String(query[field]))) {
      throw appError(`${field} debe usar YYYY-MM-DD`, 400);
    }
  }
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
    throw appError('dateFrom no puede ser posterior a dateTo', 400);
  }
  return movementModel.list({
    pieceId: query.pieceId,
    dateFromUtc: query.dateFrom ? localDayBoundaryUtc(query.dateFrom) : null,
    dateToUtcExclusive: query.dateTo ? localDayBoundaryUtc(query.dateTo, true) : null
  });
}

function localDayBoundaryUtc(value, nextDay = false) {
  const date = new Date(`${value}T00:00:00`);
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function listLoans(query) {
  if (query.status && !['activo', 'devuelto', 'cancelado'].includes(query.status)) {
    throw appError('status de préstamo no es válido', 400);
  }
  for (const field of ['originPassageId', 'destinationPassageId']) {
    if (query[field] && !Number.isInteger(Number(query[field]))) {
      throw appError(`${field} debe ser entero`, 400);
    }
  }
  if (query.due && !['overdue', 'soon', 'without-date'].includes(query.due)) {
    throw appError('due de préstamo no es válido', 400);
  }
  return loanModel.list({
    status: query.status || null,
    originPassageId: query.originPassageId ? Number(query.originPassageId) : null,
    destinationPassageId: query.destinationPassageId ? Number(query.destinationPassageId) : null,
    due: query.due || null
  });
}

function resolvePassageId(data) {
  if (data.passage_id !== undefined && data.passage_id !== null && data.passage_id !== '') {
    const passageId = Number(data.passage_id);
    if (!Number.isInteger(passageId) || !passageModel.findById(passageId)) {
      throw appError('Pasaje no encontrado', 400);
    }
    return passageId;
  }
  const passage = pieceModel.findPassage(data.testament, Number(data.passage_number));
  if (!passage) throw appError('Pasaje no encontrado', 400);
  return passage.id;
}

function validatePiece(body, partial = false) {
  const errors = [];
  const data = {};

  for (const key of ['internal_code', 'name']) {
    if (!partial && (!body[key] || typeof body[key] !== 'string')) errors.push(`${key} es requerido`);
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string' || !body[key].trim()) errors.push(`${key} debe ser texto no vacio`);
      else data[key] = body[key].trim();
    }
  }

  for (const key of ['global_number', 'piece_number', 'consecutive_number']) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      const n = Number(body[key]);
      if (!Number.isInteger(n) || n < 0) errors.push(`${key} debe ser entero >= 0`);
      else data[key] = n;
    } else if (body[key] === null || body[key] === '') {
      data[key] = null;
    }
  }

  for (const key of ['registry_number', 'artist', 'box', 'drawer', 'showcase', 'exhibition_location', 'custodian', 'material', 'deep', 'length', 'height', 'observations']) {
    if (body[key] !== undefined) data[key] = body[key] === null ? null : String(body[key]).trim();
  }

  if (!partial && data.artist === undefined) data.artist = env.defaultArtist;
  if (!partial) {
    data.presence_status = 'sin_confirmar';
    data.condition_status = 'sin_revisar';
    data.maintenance_required = 0;
    data.is_loan_related = 0;
    data.never_leaves_box = 0;
  }

  if (!partial || body.passage_id || body.testament || body.passage_number) {
    data.passage_id = resolvePassageId(body);
  }

  if (errors.length) throw appError(errors.join(', '), 400, errors);
  return data;
}

function validateStatusChange(body) {
  const errors = [];
  const data = {};
  if (body.presence_status !== undefined) {
    if (!presenceStatuses.includes(body.presence_status)) errors.push('presence_status no es valido');
    else data.presence_status = body.presence_status;
  }
  if (body.condition_status !== undefined) {
    if (!conditionStatuses.includes(body.condition_status)) errors.push('condition_status no es valido');
    else {
      data.condition_status = body.condition_status;
      data.maintenance_required = isRestorationCondition(body.condition_status) ? 1 : 0;
    }
  }
  if (errors.length) throw appError(errors.join(', '), 400, errors);
  return data;
}

function isRestorationCondition(status) {
  return ['roto', 'requiere_mantenimiento', 'en_mantenimiento'].includes(status);
}

function createPiece(body) {
  try {
    return pieceModel.create(validatePiece(body));
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) throw appError('El codigo interno ya existe', 409);
    throw error;
  }
}

function updatePiece(id, body) {
  getPiece(id);
  const data = validatePiece(body, true);
  if (!Object.keys(data).length) throw appError('No hay campos para actualizar', 400);
  try {
    return pieceModel.update(id, data);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) throw appError('El codigo interno ya existe', 409);
    throw error;
  }
}

function archivePiece(id) {
  getPiece(id);
  if (loanModel.findActiveByPiece(id)) throw appError('No se puede archivar una pieza con préstamo activo', 409);
  if (exhibitionPickModel.findActiveByPiece(id)) throw appError('No se puede archivar una pieza en una guía de montaje activa', 409);
  return pieceModel.update(id, { active: 0 });
}

function changeStatus(id, body) {
  const piece = getPiece(id);
  const data = validateStatusChange(body);
  if (!Object.keys(data).length) throw appError('No hay cambios de estado para registrar', 400);
  const activeLoan = loanModel.findActiveByPiece(id);
  const activePick = exhibitionPickModel.findActiveByPiece(id);

  if (data.presence_status === 'prestada' && !activeLoan) {
    throw appError('La presencia Prestada solo se establece al registrar un préstamo', 409);
  }
  if (activeLoan && data.presence_status && data.presence_status !== 'prestada') {
    throw appError('Registra la devolución para cambiar la presencia de una pieza prestada', 409);
  }
  if (activePick && data.presence_status && data.presence_status !== piece.presence_status) {
    throw appError('Finaliza o cancela la guía de montaje antes de cambiar la presencia', 409);
  }
  if (data.presence_status === 'en_caja' && (data.condition_status || piece.condition_status) === 'en_mantenimiento') {
    throw appError('Revisa la conservación antes de regresar una pieza de restauración a caja', 409);
  }

  const tx = db.transaction(() => {
    const updated = pieceModel.update(id, data);
    const movement = movementModel.create({
      piece_id: id,
      type: body.type && movementTypes.includes(body.type) ? body.type : 'cambio_estado',
      from_presence_status: piece.presence_status,
      to_presence_status: updated.presence_status,
      from_condition_status: piece.condition_status,
      to_condition_status: updated.condition_status,
      responsible: body.responsible ? String(body.responsible).trim() : null,
      counterparty: body.counterparty ? String(body.counterparty).trim() : null,
      reason: body.reason ? String(body.reason).trim() : null
    });
    return { piece: updated, movement };
  });

  return tx();
}

function registerMovement(id, body) {
  const piece = getPiece(id);
  const type = body.type;
  if (!movementTypes.includes(type)) throw appError('type no es valido', 400);

  const nextPresence = body.presence_status || inferPresenceFromMovement(type, piece.presence_status);
  const nextCondition = body.condition_status || inferConditionFromMovement(type, piece.condition_status);
  return changeStatus(id, {
    type,
    presence_status: nextPresence,
    condition_status: nextCondition,
    responsible: body.responsible,
    counterparty: body.counterparty,
    reason: body.reason
  });
}

function validateExpectedReturnDate(value) {
  const normalized = value ? String(value).trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw appError('expected_return_date es requerida y debe usar YYYY-MM-DD', 400);
  }
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw appError('expected_return_date no es una fecha válida', 400);
  }
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
  if (normalized < today) throw appError('expected_return_date no puede estar en el pasado', 400);
  return normalized;
}

function validateLoanAvailability(piece) {
  if (piece.presence_status === 'en_mantenimiento' || piece.condition_status === 'en_mantenimiento') {
    throw appError('Una pieza en restauración no puede prestarse', 409);
  }
}

function createLoanRecord(piece, destination, body) {
  const expectedReturnDate = validateExpectedReturnDate(body.expected_return_date);
  const destinationLabel = `${destination.testament} P${destination.number} · ${destination.name}`;
  const loan = loanModel.create({
    piece_id: piece.id,
    loaned_to_passage_id: destination.id,
    loaned_to: destinationLabel,
    expected_return_date: expectedReturnDate,
    responsible_out: body.responsible_out ? String(body.responsible_out).trim() : null,
    notes: body.notes ? String(body.notes).trim() : null
  });
  const updated = pieceModel.update(piece.id, { presence_status: 'prestada' });
  movementModel.create({
    piece_id: piece.id,
    type: 'prestamo',
    from_presence_status: piece.presence_status,
    to_presence_status: 'prestada',
    from_condition_status: piece.condition_status,
    to_condition_status: piece.condition_status,
    responsible: body.responsible_out || null,
    counterparty: destinationLabel,
    reason: body.notes || null
  });
  return { loan, piece: updated };
}

function prepareExhibition(id, body) {
  const piece = getPiece(id);
  if (!body.target_passage_id) throw appError('target_passage_id es requerido', 400);
  if (exhibitionPickModel.findActiveByPiece(id)) {
    throw appError('La pieza ya está seleccionada para salida o montaje', 409);
  }
  if (piece.presence_status === 'en_mantenimiento') {
    throw appError('Una pieza en restauración no puede seleccionarse para exposición', 409);
  }

  const target = passageModel.findById(Number(body.target_passage_id));
  if (!target) throw appError('Pasaje destino no encontrado', 400);
  const activeLoan = loanModel.findActiveByPiece(id);
  const isBorrowed = target.id !== piece.passage_id;

  if (activeLoan && activeLoan.loaned_to_passage_id !== target.id) {
    throw appError('La pieza ya está prestada a otro pasaje', 409);
  }
  if (activeLoan && !isBorrowed) {
    throw appError('La pieza prestada solo puede montarse en su pasaje destino', 409);
  }

  return db.transaction(() => {
    let loan = activeLoan || null;
    if (isBorrowed && !loan) {
      validateLoanAvailability(piece);
      loan = createLoanRecord(piece, target, body).loan;
    }
    const pick = exhibitionPickModel.create({
      piece_id: Number(id),
      target_passage_id: target.id,
      requested_by: body.requested_by ? String(body.requested_by).trim() : null,
      notes: body.notes ? String(body.notes).trim() : null
    });
    return { pick, loan, borrowed: isBorrowed };
  })();
}

function returnLoan(loanId, body) {
  const loan = loanModel.findById(loanId);
  if (!loan || loan.status !== 'activo') throw appError('Prestamo activo no encontrado', 404);
  const piece = getPiece(loan.piece_id);
  const allowedReturnPresence = ['en_caja', 'en_vitrina', 'en_mantenimiento'];
  const allowedReturnConditions = conditionStatuses.filter((status) => status !== 'sin_revisar');
  if (!allowedReturnPresence.includes(body.presence_status)) {
    throw appError('La devolución requiere una presencia confirmada', 400);
  }
  if (!allowedReturnConditions.includes(body.condition_status)) {
    throw appError('La devolución requiere revisar la conservación', 400);
  }
  if (body.presence_status === 'en_mantenimiento' && body.condition_status !== 'en_mantenimiento') {
    throw appError('Una pieza enviada a restauración debe registrarse como En restauración', 400);
  }
  if (body.condition_status === 'en_mantenimiento' && body.presence_status !== 'en_mantenimiento') {
    throw appError('Una pieza en restauración debe tener presencia En restauración', 400);
  }

  const tx = db.transaction(() => {
    const closed = loanModel.close(loanId, {
      responsible_in: body.responsible_in ? String(body.responsible_in).trim() : null,
      return_notes: body.notes ? String(body.notes).trim() : null
    });
    const activePick = exhibitionPickModel.findActiveByPiece(piece.id);
    if (activePick) exhibitionPickModel.updateStatus(activePick.id, 'finalizada');
    const updated = pieceModel.update(piece.id, {
      presence_status: body.presence_status,
      condition_status: body.condition_status,
      maintenance_required: isRestorationCondition(body.condition_status) ? 1 : 0
    });
    movementModel.create({
      piece_id: piece.id,
      type: 'devolucion',
      from_presence_status: piece.presence_status,
      to_presence_status: updated.presence_status,
      from_condition_status: piece.condition_status,
      to_condition_status: updated.condition_status,
      responsible: body.responsible_in || null,
      counterparty: loan.loaned_to,
      reason: body.notes || null
    });
    return { loan: closed, piece: updated };
  });

  return tx();
}

function attachImage(id, file, processedImage) {
  const currentPiece = getPiece(id);
  if (!file) throw appError('Archivo de imagen requerido', 400);
  const piece = pieceModel.update(id, {
    image_path: processedImage.imagePath,
    original_image_path: processedImage.originalImagePath,
    thumbnail_path: processedImage.thumbnailPath
  });
  db.prepare(`
    INSERT INTO piece_images (piece_id, path, thumbnail_path, label)
    VALUES (?, ?, ?, ?)
  `).run(id, processedImage.originalImagePath, processedImage.thumbnailPath, file.originalname);
  return {
    piece,
    image_path: processedImage.imagePath,
    original_image_path: processedImage.originalImagePath,
    thumbnail_path: processedImage.thumbnailPath,
    previous_image_path: currentPiece.image_path,
    previous_original_image_path: currentPiece.original_image_path,
    previous_thumbnail_path: currentPiece.thumbnail_path
  };
}

function inferPresenceFromMovement(type, current) {
  const map = {
    ingreso: 'en_caja',
    salida: current,
    uso: 'en_vitrina',
    prestamo: 'prestada',
    devolucion: 'en_caja',
    mantenimiento: 'en_mantenimiento'
  };
  return map[type] || current;
}

function inferConditionFromMovement(type, current) {
  return type === 'mantenimiento' ? 'en_mantenimiento' : current;
}

module.exports = {
  listPieces,
  listMovements,
  listLoans,
  getPiece,
  createPiece,
  updatePiece,
  archivePiece,
  changeStatus,
  registerMovement,
  prepareExhibition,
  returnLoan,
  attachImage,
  getStats: pieceModel.stats
};
