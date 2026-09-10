const express = require('express');
const pieceService = require('../services/pieceService');
const { upload, removeUploadedFile, removeStoredImage } = require('../config/upload');
const imageService = require('../services/imageService');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res, next) => {
  try { res.json(pieceService.listPieces(req.query)); } catch (error) { next(error); }
});

router.get('/stats/summary', (_req, res, next) => {
  try { res.json(pieceService.getStats()); } catch (error) { next(error); }
});

router.get('/movements/history', (req, res, next) => {
  try { res.json(pieceService.listMovements(req.query)); } catch (error) { next(error); }
});

router.get('/loans', (req, res, next) => {
  try { res.json(pieceService.listLoans(req.query)); } catch (error) { next(error); }
});

router.post('/loans/:loanId/return', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.json(pieceService.returnLoan(req.params.loanId, req.body)); } catch (error) { next(error); }
});

router.get('/:id', (req, res, next) => {
  try { res.json(pieceService.getPiece(req.params.id)); } catch (error) { next(error); }
});

router.post('/', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.status(201).json(pieceService.createPiece(req.body)); } catch (error) { next(error); }
});

router.put('/:id', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.json(pieceService.updatePiece(req.params.id, req.body)); } catch (error) { next(error); }
});

router.patch('/:id/status', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.json(pieceService.changeStatus(req.params.id, req.body)); } catch (error) { next(error); }
});

router.post('/:id/movements', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.status(201).json(pieceService.registerMovement(req.params.id, req.body)); } catch (error) { next(error); }
});

router.post('/:id/image', requireRole('admin', 'operador'), upload.single('image'), async (req, res, next) => {
  let processedImage;
  try {
    processedImage = await imageService.processUploadedImage(req.file);
    const result = pieceService.attachImage(req.params.id, req.file, processedImage);
    delete result.previous_image_path;
    delete result.previous_original_image_path;
    delete result.previous_thumbnail_path;
    res.status(201).json(result);
  } catch (error) {
    removeUploadedFile(req.file);
    removeStoredImage(processedImage?.imagePath);
    removeStoredImage(processedImage?.thumbnailPath);
    next(error);
  }
});

router.delete('/:id', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.json(pieceService.archivePiece(req.params.id)); } catch (error) { next(error); }
});

module.exports = router;
