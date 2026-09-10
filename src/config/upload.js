const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('./env');

const allowedImageTypes = {
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/png': new Set(['.png']),
  'image/webp': new Set(['.webp'])
};

fs.mkdirSync(env.uploadDir, { recursive: true });
fs.mkdirSync(env.originalUploadDir, { recursive: true });
fs.mkdirSync(env.thumbnailDir, { recursive: true });
fs.mkdirSync(env.displayImageDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.originalUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const extensions = allowedImageTypes[file.mimetype];
  if (!extensions || !extensions.has(ext)) {
    const error = new Error('La imagen debe ser JPG, PNG o WebP');
    error.status = 400;
    cb(error);
    return;
  }
  cb(null, true);
}

function removeUploadedFile(file) {
  if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
}

function removeStoredImage(publicPath) {
  if (!publicPath || !publicPath.startsWith(`${env.publicUploadBase}/`)) return;
  const relativePath = publicPath.slice(env.publicUploadBase.length + 1);
  const storedPath = path.resolve(env.uploadDir, relativePath);
  if (!storedPath.startsWith(`${path.resolve(env.uploadDir)}${path.sep}`)) return;
  if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
}

module.exports = {
  upload: multer({ storage, fileFilter, limits: { fileSize: env.uploadMaxBytes } }),
  removeUploadedFile,
  removeStoredImage
};
