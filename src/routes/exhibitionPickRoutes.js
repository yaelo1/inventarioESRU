const express = require('express');
const exhibitionPickService = require('../services/exhibitionPickService');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res, next) => {
  try { res.json(exhibitionPickService.listPicks(req.query)); } catch (error) { next(error); }
});

router.post('/:pieceId', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.status(201).json(exhibitionPickService.selectPiece(req.params.pieceId, req.body)); } catch (error) { next(error); }
});

router.patch('/:id/status', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.json(exhibitionPickService.updateStatus(req.params.id, req.body)); } catch (error) { next(error); }
});

module.exports = router;
