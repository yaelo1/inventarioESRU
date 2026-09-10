const express = require('express');
const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: env.loginRateWindowMinutes * 60 * 1000,
  limit: env.loginRateMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de acceso. Espera unos minutos e inténtalo nuevamente' }
});

router.post('/login', loginLimiter, (req, res, next) => {
  try {
    const result = authService.login(req.body);
    res.cookie(authService.COOKIE_NAME, result.token, cookieOptions());
    res.json({ user: result.user });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res, next) => {
  try {
    authService.logout(req.sessionToken);
    res.clearCookie(authService.COOKIE_NAME, clearCookieOptions());
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/me', (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Sesión requerida' });
    return;
  }
  res.json({ user: req.user });
});

router.patch('/password', requireAuth, (req, res, next) => {
  try {
    const user = authService.changePassword(req.user.id, req.body);
    res.clearCookie(authService.COOKIE_NAME, clearCookieOptions());
    res.json({ ok: true, user });
  } catch (error) {
    next(error);
  }
});

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: env.sessionDays * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

function clearCookieOptions() {
  const { maxAge, ...options } = cookieOptions();
  return options;
}

module.exports = router;
