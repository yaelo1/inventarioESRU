const path = require('path');
require('dotenv').config();

const rootDir = path.resolve(__dirname, '../..');

function resolveFromRoot(value) {
  return path.resolve(rootDir, value);
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const port = Number(required('PORT'));
const nodeEnv = required('NODE_ENV');
const sessionSecret = required('SESSION_SECRET');
const uploadMaxBytes = Number(required('UPLOAD_MAX_BYTES'));
const sessionDays = Number(required('SESSION_DAYS'));
const imageMaxPixels = Number(required('IMAGE_MAX_PIXELS'));
const thumbnailWidth = Number(required('THUMBNAIL_WIDTH'));
const thumbnailQuality = Number(required('THUMBNAIL_QUALITY'));
const displayImageWidth = Number(required('DISPLAY_IMAGE_WIDTH'));
const displayImageQuality = Number(required('DISPLAY_IMAGE_QUALITY'));
const mediaCacheDays = Number(required('MEDIA_CACHE_DAYS'));
const loginRateWindowMinutes = Number(required('LOGIN_RATE_WINDOW_MINUTES'));
const loginRateMax = Number(required('LOGIN_RATE_MAX'));
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV debe ser development, test o production');
}
if (nodeEnv === 'production' && (sessionSecret.length < 32 || sessionSecret.includes('reemplaza'))) {
  throw new Error('SESSION_SECRET debe tener al menos 32 caracteres aleatorios en producción');
}
if (!Number.isInteger(port) || port <= 0) throw new Error('PORT debe ser un entero positivo');
if (!Number.isInteger(uploadMaxBytes) || uploadMaxBytes <= 0) {
  throw new Error('UPLOAD_MAX_BYTES debe ser un entero positivo');
}
if (!Number.isInteger(sessionDays) || sessionDays <= 0) {
  throw new Error('SESSION_DAYS debe ser un entero positivo');
}
for (const [name, value] of Object.entries({
  IMAGE_MAX_PIXELS: imageMaxPixels,
  THUMBNAIL_WIDTH: thumbnailWidth,
  DISPLAY_IMAGE_WIDTH: displayImageWidth,
  MEDIA_CACHE_DAYS: mediaCacheDays,
  LOGIN_RATE_WINDOW_MINUTES: loginRateWindowMinutes,
  LOGIN_RATE_MAX: loginRateMax
})) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} debe ser un entero positivo`);
}
if (!Number.isInteger(thumbnailQuality) || thumbnailQuality < 1 || thumbnailQuality > 100) {
  throw new Error('THUMBNAIL_QUALITY debe ser un entero entre 1 y 100');
}
if (!Number.isInteger(displayImageQuality) || displayImageQuality < 1 || displayImageQuality > 100) {
  throw new Error('DISPLAY_IMAGE_QUALITY debe ser un entero entre 1 y 100');
}

module.exports = {
  rootDir,
  port,
  nodeEnv,
  trustProxy: required('TRUST_PROXY') === '1',
  dbPath: resolveFromRoot(required('DB_PATH')),
  staticDir: resolveFromRoot(required('STATIC_DIR')),
  htmlFile: required('HTML_FILE'),
  seedDataFile: resolveFromRoot(required('SEED_DATA_FILE')),
  uploadDir: resolveFromRoot(required('UPLOAD_DIR')),
  originalUploadDir: resolveFromRoot(required('ORIGINAL_UPLOAD_DIR')),
  thumbnailDir: resolveFromRoot(required('THUMBNAIL_DIR')),
  displayImageDir: resolveFromRoot(required('DISPLAY_IMAGE_DIR')),
  uploadMaxBytes,
  imageMaxPixels,
  thumbnailWidth,
  thumbnailQuality,
  displayImageWidth,
  displayImageQuality,
  mediaCacheDays,
  sessionSecret,
  sessionDays,
  publicUploadBase: required('PUBLIC_UPLOAD_BASE'),
  publicOriginalBase: required('PUBLIC_ORIGINAL_BASE'),
  publicThumbnailBase: required('PUBLIC_THUMBNAIL_BASE'),
  publicDisplayImageBase: required('PUBLIC_DISPLAY_IMAGE_BASE'),
  apiPrefix: required('API_PREFIX'),
  frontendPublicPath: required('FRONTEND_PUBLIC_PATH'),
  defaultArtist: required('DEFAULT_ARTIST'),
  jsonLimit: required('JSON_LIMIT'),
  timezone: required('TZ'),
  loginRateWindowMinutes,
  loginRateMax
};
