const express = require('express');
const passageService = require('../services/passageService');
const { upload, removeUploadedFile, removeStoredImage } = require('../config/upload');
const imageService = require('../services/imageService');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', (_req, res, next) => {
  try { res.json(passageService.listPassages()); } catch (error) { next(error); }
});

router.post('/', requireRole('admin', 'operador'), (req, res, next) => {
  try { res.status(201).json(passageService.createPassage(req.body)); } catch (error) { next(error); }
});

router.post('/:id/image', requireRole('admin', 'operador'), upload.single('image'), async (req, res, next) => {
  let processedImage;
  try {
    processedImage = await imageService.processUploadedImage(req.file);
    const result = passageService.attachImage(req.params.id, req.file, processedImage);
    removeStoredImage(result.previous_image_path);
    removeStoredImage(result.previous_original_image_path);
    removeStoredImage(result.previous_thumbnail_path);
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

module.exports = router;
