const userModel = require('../models/userModel');
const sessionModel = require('../models/sessionModel');
const authService = require('./authService');

function appError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function listUsers() {
  return userModel.list();
}

function createUser(body, options = {}) {
  const data = validateUser(body);
  data.password_hash = authService.hashPassword(authService.validatePassword(body.password));
  data.must_change_password = options.mustChangePassword === false ? 0 : 1;
  try {
    return userModel.create(data);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) throw appError('Ese correo ya está registrado', 409);
    throw error;
  }
}

function updateUser(id, body, currentUser) {
  const user = requireUser(id);
  const data = {};
  if (body.name !== undefined) data.name = validateName(body.name);
  if (body.email !== undefined) data.email = authService.normalizeEmail(body.email);
  if (body.role !== undefined) data.role = authService.validateRole(body.role);
  if (body.active !== undefined) data.active = body.active ? 1 : 0;
  if (!Object.keys(data).length) throw appError('No hay campos para actualizar', 400);

  if (user.id === currentUser.id && data.active === 0) {
    throw appError('No puedes desactivar tu propio usuario', 409);
  }
  if (user.role === 'admin' && data.role && data.role !== 'admin' && userModel.countAdmins() <= 1) {
    throw appError('Debe quedar al menos un admin activo', 409);
  }
  if (user.role === 'admin' && data.active === 0 && userModel.countAdmins() <= 1) {
    throw appError('Debe quedar al menos un admin activo', 409);
  }

  const updated = userModel.update(id, data);
  if (data.active === 0) sessionModel.removeForUser(id);
  return updated;
}

function updatePassword(id, body) {
  requireUser(id);
  const passwordHash = authService.hashPassword(authService.validatePassword(body.password));
  sessionModel.removeForUser(id);
  return userModel.updatePassword(id, passwordHash, 1);
}

function deactivateUser(id, currentUser) {
  return updateUser(id, { active: 0 }, currentUser);
}

function reactivateUser(id) {
  requireUser(id);
  return userModel.update(id, { active: 1 });
}

function deleteUser(id, currentUser) {
  const user = requireUser(id);
  if (user.id === currentUser.id) {
    throw appError('No puedes eliminar tu propio usuario', 409);
  }
  if (user.active) {
    throw appError('Primero debes desactivar el usuario', 409);
  }
  sessionModel.removeForUser(id);
  userModel.remove(id);
  return { ok: true };
}

function validateUser(body) {
  return {
    name: validateName(body.name),
    email: validateEmail(body.email),
    role: authService.validateRole(body.role || 'operador')
  };
}

function validateName(value) {
  const name = String(value || '').trim();
  if (!name) throw appError('Nombre requerido', 400);
  return name;
}

function validateEmail(value) {
  const email = authService.normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw appError('Correo no válido', 400);
  return email;
}

function requireUser(id) {
  const user = userModel.findById(id);
  if (!user) throw appError('Usuario no encontrado', 404);
  return user;
}

module.exports = {
  createUser,
  deactivateUser,
  deleteUser,
  listUsers,
  reactivateUser,
  updatePassword,
  updateUser
};
