const db = require('../config/database');
const showcaseModel = require('../models/showcaseModel');

const shapes = ['rectangular', 'circular', 'irregular', 'otro'];

function appError(message, status, errors) {
  const error = new Error(message);
  error.status = status;
  if (errors) error.errors = errors;
  return error;
}

function listShowcases() {
  return showcaseModel.list();
}

function createShowcase(body) {
  const data = validateShowcase(body);
  try {
    return showcaseModel.create(data);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) throw appError('Ya existe una vitrina con ese código', 409);
    throw error;
  }
}

function updateShowcase(id, body) {
  if (!showcaseModel.findById(id)) throw appError('Vitrina no encontrada', 404);
  const data = validateShowcase(body);
  try {
    return showcaseModel.update(id, data);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) throw appError('Ya existe una vitrina con ese código', 409);
    throw error;
  }
}

function assignPassages(id, body) {
  const showcaseId = Number(id);
  if (!showcaseModel.findById(showcaseId)) throw appError('Vitrina no encontrada', 404);
  if (!Array.isArray(body.passage_ids)) throw appError('passage_ids debe ser una lista', 400);
  const passageIds = [...new Set(body.passage_ids.map(Number))];
  if (passageIds.some((passageId) => !Number.isInteger(passageId) || passageId <= 0)) {
    throw appError('Todos los pasajes deben tener un ID válido', 400);
  }
  const found = passageIds.length
    ? db.prepare(`SELECT id FROM passages WHERE id IN (${passageIds.map(() => '?').join(',')})`).all(...passageIds)
    : [];
  if (found.length !== passageIds.length) throw appError('Uno o más pasajes no existen', 400);
  showcaseModel.assignPassages(showcaseId, passageIds);
  return showcaseModel.list().find((showcase) => showcase.id === showcaseId);
}

function validateShowcase(body) {
  const errors = [];
  const code = body.code ? String(body.code).trim().toUpperCase() : '';
  const name = body.name ? String(body.name).trim() : '';
  const shape = body.shape ? String(body.shape).trim() : 'rectangular';
  if (!code) errors.push('code es requerido');
  if (!name) errors.push('name es requerido');
  if (!shapes.includes(shape)) errors.push('shape no es válida');

  const dimensions = {};
  for (const field of ['length_cm', 'width_cm', 'height_cm', 'diameter_cm']) {
    if (body[field] === '' || body[field] === null || body[field] === undefined) dimensions[field] = null;
    else {
      const value = Number(body[field]);
      if (!Number.isFinite(value) || value <= 0) errors.push(`${field} debe ser mayor a 0`);
      else dimensions[field] = value;
    }
  }
  if (errors.length) throw appError(errors.join(', '), 400, errors);
  return {
    code,
    name,
    section: null,
    support_type: optionalText(body.support_type) || 'Vitrina',
    shape,
    ...dimensions,
    measurement_notes: optionalText(body.measurement_notes),
    location: optionalText(body.location),
    observations: optionalText(body.observations)
  };
}

function optionalText(value) {
  if (value === undefined || value === null) return null;
  return String(value).trim() || null;
}

module.exports = { assignPassages, createShowcase, listShowcases, updateShowcase };
