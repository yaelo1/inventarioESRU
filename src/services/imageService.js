const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const env = require('../config/env');

const browserFormats = new Set(['jpeg', 'png', 'webp']);

sharp.cache({ files: 0, memory: 32, items: 100 });
sharp.concurrency(1);
fs.mkdirSync(env.thumbnailDir, { recursive: true });
fs.mkdirSync(env.displayImageDir, { recursive: true });

async function processUploadedImage(file) {
  if (!file) throw imageError('Archivo de imagen requerido', 400);
  try {
    const metadata = await readMetadata(file.path, true);
    if (!browserFormats.has(metadata.format)) {
      throw imageError('El contenido debe ser una imagen JPG, PNG o WebP válida', 400);
    }
    const variants = await createVariants(file.path, file.filename);
    return { originalImagePath: `${env.publicOriginalBase}/${file.filename}`, ...variants };
  } catch (error) {
    if (error.status) throw error;
    throw imageError('No se pudo procesar la imagen. Verifica que el archivo no esté dañado', 400);
  }
}

async function ensureImageVariants(publicPath) {
  const sourcePath = storedPathFromPublic(publicPath);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw imageError(`No existe el archivo ${publicPath}`, 404);
  }
  return createVariants(sourcePath, publicPath, true);
}

async function readMetadata(sourcePath, allowLegacyTiff = false, tolerateLegacyErrors = false) {
  const metadata = await sharp(sourcePath, {
    failOn: tolerateLegacyErrors ? 'none' : 'error',
    limitInputPixels: env.imageMaxPixels
  }).metadata();
  const allowed = allowLegacyTiff ? new Set([...browserFormats, 'tiff']) : browserFormats;
  if (!metadata.width || !metadata.height || !allowed.has(metadata.format)) {
    throw imageError('Formato de imagen no compatible', 400);
  }
  if (metadata.width * metadata.height > env.imageMaxPixels) {
    throw imageError(`La imagen excede el límite de ${env.imageMaxPixels} píxeles`, 400);
  }
  return metadata;
}

async function createThumbnail(sourcePath, fingerprint, tolerateLegacyErrors = false) {
  const hash = crypto.createHash('sha256').update(String(fingerprint)).digest('hex').slice(0, 20);
  const filename = `${hash}-${env.thumbnailWidth}.webp`;
  const outputPath = path.join(env.thumbnailDir, filename);
  if (!fs.existsSync(outputPath)) {
    await sharp(sourcePath, { failOn: tolerateLegacyErrors ? 'none' : 'error', limitInputPixels: env.imageMaxPixels })
      .rotate()
      .resize({ width: env.thumbnailWidth, height: env.thumbnailWidth, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: env.thumbnailQuality, effort: 4 })
      .toFile(outputPath);
  }
  return `${env.publicThumbnailBase}/${filename}`;
}

async function createDisplayImage(sourcePath, fingerprint, tolerateLegacyErrors = false) {
  const hash = crypto.createHash('sha256').update(String(fingerprint)).digest('hex').slice(0, 20);
  const filename = `${hash}-${env.displayImageWidth}.webp`;
  const outputPath = path.join(env.displayImageDir, filename);
  if (!fs.existsSync(outputPath)) {
    await sharp(sourcePath, { failOn: tolerateLegacyErrors ? 'none' : 'error', limitInputPixels: env.imageMaxPixels })
      .rotate()
      .resize({ width: env.displayImageWidth, height: env.displayImageWidth, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: env.displayImageQuality, effort: 4 })
      .toFile(outputPath);
  }
  return `${env.publicDisplayImageBase}/${filename}`;
}

async function createVariants(sourcePath, fingerprint, tolerateLegacyErrors = false) {
  return {
    imagePath: await createDisplayImage(sourcePath, fingerprint, tolerateLegacyErrors),
    thumbnailPath: await createThumbnail(sourcePath, fingerprint, tolerateLegacyErrors)
  };
}

function storedPathFromPublic(publicPath) {
  if (!publicPath || !String(publicPath).startsWith(`${env.publicUploadBase}/`)) return null;
  const relativePath = String(publicPath).slice(env.publicUploadBase.length + 1);
  const resolved = path.resolve(env.uploadDir, relativePath);
  const uploadRoot = `${path.resolve(env.uploadDir)}${path.sep}`;
  return resolved.startsWith(uploadRoot) ? resolved : null;
}

function imageError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = { ensureImageVariants, processUploadedImage, storedPathFromPublic };
