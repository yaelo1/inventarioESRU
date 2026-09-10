const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventario-images-'));
process.env.UPLOAD_DIR = tempDir;
process.env.ORIGINAL_UPLOAD_DIR = path.join(tempDir, 'originals');
process.env.THUMBNAIL_DIR = path.join(tempDir, 'thumbnails');
process.env.DISPLAY_IMAGE_DIR = path.join(tempDir, 'display');

const sharp = require('sharp');
const env = require('../src/config/env');
const imageService = require('../src/services/imageService');

fs.mkdirSync(env.originalUploadDir, { recursive: true });

after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

test('imagen válida genera miniatura y copia de visualización WebP', async () => {
  const filename = 'prueba.jpg';
  const sourcePath = path.join(env.originalUploadDir, filename);
  await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#c9a84c' } })
    .jpeg({ quality: 90 })
    .toFile(sourcePath);

  const result = await imageService.processUploadedImage({ path: sourcePath, filename });
  assert.equal(result.originalImagePath, `${env.publicOriginalBase}/${filename}`);
  assert.match(result.imagePath, /\/display\/.*\.webp$/);
  assert.match(result.thumbnailPath, /\/thumbnails\/.*\.webp$/);

  const displayMetadata = await sharp(imageService.storedPathFromPublic(result.imagePath)).metadata();
  const thumbnailMetadata = await sharp(imageService.storedPathFromPublic(result.thumbnailPath)).metadata();
  assert.equal(displayMetadata.format, 'webp');
  assert.equal(thumbnailMetadata.format, 'webp');
  assert.ok(displayMetadata.width <= env.displayImageWidth);
  assert.ok(thumbnailMetadata.width <= env.thumbnailWidth);
});

test('archivo TIFF disfrazado de JPG se rechaza en nuevas subidas', async () => {
  const filename = 'disfrazada.jpg';
  const sourcePath = path.join(env.originalUploadDir, filename);
  await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ffffff' } })
    .tiff({ compression: 'none' })
    .toFile(sourcePath);

  await assert.rejects(
    imageService.processUploadedImage({ path: sourcePath, filename }),
    (error) => error.status === 400 && error.message.includes('JPG, PNG o WebP')
  );
  const legacy = await imageService.ensureImageVariants(`${env.publicOriginalBase}/${filename}`);
  assert.match(legacy.thumbnailPath, /\.webp$/);
});
