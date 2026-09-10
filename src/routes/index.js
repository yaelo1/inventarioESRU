const express = require('express');
const authRoutes = require('./authRoutes');
const exhibitionPickRoutes = require('./exhibitionPickRoutes');
const passageRoutes = require('./passageRoutes');
const pieceRoutes = require('./pieceRoutes');
const userRoutes = require('./userRoutes');
const { requireAuth, requirePasswordReady } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

router.get('/health', (_req, res, next) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ ok: true, database: 'ready', uptime_seconds: Math.floor(process.uptime()) });
  } catch (error) {
    next(error);
  }
});
router.use('/auth', authRoutes);
router.use(requireAuth);
router.use(requirePasswordReady);
router.use('/exhibition-picks', exhibitionPickRoutes);
router.use('/passages', passageRoutes);
router.use('/pieces', pieceRoutes);
router.use('/users', userRoutes);

module.exports = router;
