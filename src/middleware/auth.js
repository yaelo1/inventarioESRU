const authService = require('../services/authService');

function parseCookies(header) {
  return String(header || '').split(';').reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join('=') || '');
    return cookies;
  }, {});
}

function getSessionToken(req) {
  return parseCookies(req.headers.cookie)[authService.COOKIE_NAME];
}

function attachUser(req, _res, next) {
  req.sessionToken = getSessionToken(req);
  req.user = authService.userFromToken(req.sessionToken);
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: 'Sesión requerida' });
    return;
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'No tienes permisos para esta acción' });
      return;
    }
    next();
  };
}

function requirePasswordReady(req, res, next) {
  if (req.user?.must_change_password) {
    res.status(403).json({
      error: 'Debes cambiar tu contraseña temporal antes de continuar',
      code: 'PASSWORD_CHANGE_REQUIRED'
    });
    return;
  }
  next();
}

module.exports = { attachUser, getSessionToken, requireAuth, requirePasswordReady, requireRole };
