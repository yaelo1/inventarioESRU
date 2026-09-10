const crypto = require('crypto');
const env = require('../config/env');
const userModel = require('../models/userModel');
const sessionModel = require('../models/sessionModel');

const COOKIE_NAME = 'inventory_session';
const roles = ['admin', 'operador', 'consulta'];

function appError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [method, salt, originalHash] = String(storedHash || '').split(':');
  if (method !== 'scrypt' || !salt || !originalHash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const original = Buffer.from(originalHash, 'hex');
  return original.length === candidate.length && crypto.timingSafeEqual(original, candidate);
}

function login(body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) throw appError('Correo y contraseña son requeridos', 400);

  const user = userModel.findByEmailWithPassword(email);
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    throw appError('Correo o contraseña incorrectos', 401);
  }

  sessionModel.removeExpired();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + env.sessionDays * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 19).replace('T', ' ');
  sessionModel.create({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt });
  return { user: publicUser(user), token };
}

function logout(token) {
  if (token) sessionModel.remove(hashSessionToken(token));
  return { ok: true };
}

function userFromToken(token) {
  if (!token) return null;
  const session = sessionModel.findValid(hashSessionToken(token));
  if (!session) return null;
  return {
    id: session.user_id,
    name: session.name,
    email: session.email,
    role: session.role,
    active: session.active,
    must_change_password: session.must_change_password
  };
}

function changePassword(userId, body) {
  const user = userModel.findByIdWithPassword(userId);
  if (!user) throw appError('Usuario no encontrado', 404);

  const currentPassword = String(body.current_password || '');
  const password = validatePassword(body.password);
  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw appError('La contraseña actual es incorrecta', 400);
  }
  if (password !== String(body.password_confirmation || '')) {
    throw appError('La confirmación de la contraseña no coincide', 400);
  }
  if (verifyPassword(password, user.password_hash)) {
    throw appError('La nueva contraseña debe ser diferente a la actual', 400);
  }

  const updated = userModel.updatePassword(userId, hashPassword(password), 0);
  sessionModel.removeForUser(userId);
  return publicUser(updated);
}

function validateRole(role) {
  if (!roles.includes(role)) throw appError('Rol no válido', 400);
  return role;
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 8) throw appError('La contraseña debe tener al menos 8 caracteres', 400);
  if (value.length > 128) throw appError('La contraseña no puede exceder 128 caracteres', 400);
  return value;
}

function hashSessionToken(token) {
  return crypto.createHmac('sha256', env.sessionSecret).update(token).digest('hex');
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    must_change_password: user.must_change_password
  };
}

module.exports = {
  COOKIE_NAME,
  changePassword,
  hashPassword,
  login,
  logout,
  normalizeEmail,
  publicUser,
  userFromToken,
  validatePassword,
  validateRole,
  verifyPassword
};
