const damageReportModel = require('../models/damageReportModel');
const pieceService = require('./pieceService');

const statuses = ['abierto', 'en_restauracion', 'resuelto'];
const conditions = ['roto', 'requiere_mantenimiento', 'en_mantenimiento'];

function appError(message, status, errors) {
  const error = new Error(message);
  error.status = status;
  if (errors) error.errors = errors;
  return error;
}

function listReports(query = {}) {
  const filters = validateFilters(query);
  return damageReportModel.list(filters);
}

function getReport(id) {
  const report = damageReportModel.findById(id);
  if (!report) throw appError('Reporte de daño no encontrado', 404);
  return { ...report, timeline: damageReportModel.timeline(report) };
}

function updateReport(id, body, user) {
  const report = getReport(id);
  if (report.status === 'resuelto') throw appError('El reporte ya está resuelto', 409);
  const status = body.status ? String(body.status) : report.status;
  if (!statuses.includes(status)) throw appError('Estado de reporte no válido', 400);
  const responsible = optionalText(body.responsible);
  const note = optionalText(body.note);

  if (status === 'resuelto') {
    const resolvedCondition = String(body.resolved_condition || '');
    if (!['bueno', 'regular'].includes(resolvedCondition)) {
      throw appError('Selecciona la conservación final: Bueno o Regular', 400);
    }
    if (!note) throw appError('Las notas de resolución son requeridas', 400);
    pieceService.changeStatus(report.piece_id, {
      type: 'mantenimiento',
      presence_status: report.presence_status === 'en_mantenimiento' ? 'en_caja' : report.presence_status,
      condition_status: resolvedCondition,
      responsible,
      reason: note,
      actor_user_id: user.id
    });
    return getReport(id);
  }

  if (status === 'en_restauracion') {
    pieceService.changeStatus(report.piece_id, {
      type: 'mantenimiento',
      presence_status: 'en_mantenimiento',
      condition_status: 'en_mantenimiento',
      responsible,
      reason: note || 'Enviada a restauración',
      actor_user_id: user.id
    });
  } else {
    pieceService.changeStatus(report.piece_id, {
      type: 'mantenimiento',
      condition_status: report.condition_status,
      responsible,
      reason: note || `Seguimiento: ${status}`,
      actor_user_id: user.id
    });
    damageReportModel.update(id, { status, responsible });
  }
  return getReport(id);
}

function exportCsv(query = {}) {
  const rows = listReports(query);
  const headers = [
    'Código', 'Pieza', 'Pasaje', 'Peso', 'Conservación', 'Estado del reporte',
    'Descripción', 'Responsable', 'Fecha de apertura', 'Fecha de resolución', 'Notas de resolución'
  ];
  const body = rows.map((report) => [
    report.internal_code,
    report.piece_name,
    `${report.testament} P${report.passage_number} · ${report.passage_name}`,
    report.weight_grams == null ? '' : `${report.weight_grams} g`,
    report.condition_status,
    reportStatusLabel(report.status),
    report.description,
    report.responsible || '',
    report.opened_at,
    report.resolved_at || '',
    report.resolution_notes || ''
  ]);
  return `\uFEFF${[headers, ...body].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function validateFilters(query) {
  const status = query.status || 'activos';
  if (status !== 'activos' && !statuses.includes(status)) throw appError('Estado de reporte no válido', 400);
  if (query.conditionStatus && !conditions.includes(query.conditionStatus)) {
    throw appError('Conservación no válida para reportes de daño', 400);
  }
  for (const field of ['dateFrom', 'dateTo']) {
    if (query[field] && !/^\d{4}-\d{2}-\d{2}$/.test(String(query[field]))) {
      throw appError(`${field} debe usar YYYY-MM-DD`, 400);
    }
  }
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
    throw appError('dateFrom no puede ser posterior a dateTo', 400);
  }
  const passageId = query.passageId ? Number(query.passageId) : null;
  if (query.passageId && (!Number.isInteger(passageId) || passageId <= 0)) {
    throw appError('passageId debe ser entero positivo', 400);
  }
  return {
    status,
    conditionStatus: query.conditionStatus || null,
    testament: query.testament ? String(query.testament).toUpperCase() : null,
    passageId,
    dateFrom: query.dateFrom || null,
    dateTo: query.dateTo || null,
    q: optionalText(query.q)
  };
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function optionalText(value) {
  if (value === undefined || value === null) return null;
  return String(value).trim() || null;
}

function reportStatusLabel(status) {
  return {
    abierto: 'Pendiente',
    en_restauracion: 'En restauración',
    resuelto: 'Resuelto'
  }[status] || status;
}

module.exports = { exportCsv, getReport, listReports, updateReport };
