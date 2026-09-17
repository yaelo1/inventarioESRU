const passageModel = require('../models/passageModel');

function appError(message, status, errors) {
  const error = new Error(message);
  error.status = status;
  if (errors) error.errors = errors;
  return error;
}

function listPassages() {
  return passageModel.list();
}

function createPassage(body) {
  const errors = [];
  const testament = body.testament ? String(body.testament).toUpperCase() : '';
  const number = Number(body.number);
  const name = body.name ? String(body.name).trim() : '';

  if (!['AT', 'NT'].includes(testament)) errors.push('testament debe ser AT o NT');
  if (!Number.isInteger(number) || number <= 0) errors.push('number debe ser entero mayor a 0');
  if (!name) errors.push('name es requerido');
  if (errors.length) throw appError(errors.join(', '), 400, errors);
  if (passageModel.findByTestamentAndNumber(testament, number)) {
    throw appError('Ya existe un pasaje con ese testamento y numero', 409);
  }

  return passageModel.create({
    testament,
    number,
    name,
    box: body.box ? String(body.box).trim() : null,
    drawer: body.drawer ? String(body.drawer).trim() : null,
    showcase: null,
    observations: body.observations ? String(body.observations).trim() : null
  });
}

function attachImage(id, file, processedImage) {
  const passage = passageModel.findById(id);
  if (!passage) throw appError('Pasaje no encontrado', 404);
  if (!file) throw appError('Archivo de imagen requerido', 400);
  return {
    passage: passageModel.updateImage(
      id,
      processedImage.imagePath,
      processedImage.originalImagePath,
      processedImage.thumbnailPath
    ),
    image_path: processedImage.imagePath,
    original_image_path: processedImage.originalImagePath,
    thumbnail_path: processedImage.thumbnailPath,
    previous_image_path: passage.image_path,
    previous_original_image_path: passage.original_image_path,
    previous_thumbnail_path: passage.thumbnail_path
  };
}

module.exports = { listPassages, createPassage, attachImage };
