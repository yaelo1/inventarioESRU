const express = require('express');
const showcaseService = require('../services/showcaseService');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', (_req, res, next) => {
  try { res.json(showcaseService.listShowcases()); } catch (error) { next(error); }
});

router.post('/', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.status(201).json(showcaseService.createShowcase(req.body)); } catch (error) { next(error); }
});

router.put('/:id', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.json(showcaseService.updateShowcase(req.params.id, req.body)); } catch (error) { next(error); }
});

router.put('/:id/passages', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.json(showcaseService.assignPassages(req.params.id, req.body)); } catch (error) { next(error); }
});

module.exports = router;
