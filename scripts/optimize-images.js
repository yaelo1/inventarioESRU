const db = require('../src/config/database');
const initDatabase = require('../src/database/init');
const { ensureImageVariants } = require('../src/services/imageService');

initDatabase(db);

async function main() {
  const references = db.prepare(`
    SELECT 'pieces' AS entity, id, image_path, original_image_path, thumbnail_path
    FROM pieces
    WHERE image_path IS NOT NULL AND TRIM(image_path) != ''
    UNION ALL
    SELECT 'passages' AS entity, id, image_path, original_image_path, thumbnail_path
    FROM passages
    WHERE image_path IS NOT NULL AND TRIM(image_path) != ''
    ORDER BY entity, id
  `).all();
  const updatePiece = db.prepare(`
    UPDATE pieces
    SET original_image_path = ?, image_path = ?, thumbnail_path = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const updatePassage = db.prepare(`
    UPDATE passages
    SET original_image_path = ?, image_path = ?, thumbnail_path = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const updateHistory = db.prepare(`
    UPDATE piece_images SET thumbnail_path = ? WHERE path = ?
  `);
  const cache = new Map();
  const failures = [];

  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index];
    const originalPath = reference.original_image_path || reference.image_path;
    try {
      let variants = cache.get(originalPath);
      if (!variants) {
        variants = await ensureImageVariants(originalPath);
        cache.set(originalPath, variants);
      }
      if (reference.entity === 'pieces') {
        updatePiece.run(originalPath, variants.imagePath, variants.thumbnailPath, reference.id);
        updateHistory.run(variants.thumbnailPath, originalPath);
      } else {
        updatePassage.run(originalPath, variants.imagePath, variants.thumbnailPath, reference.id);
      }
    } catch (error) {
      failures.push(`${reference.entity}#${reference.id}: ${error.message}`);
    }
    if ((index + 1) % 25 === 0 || index + 1 === references.length) {
      console.log(`Procesadas ${index + 1}/${references.length}`);
    }
  }

  console.log(`Imágenes únicas optimizadas: ${cache.size}`);
  if (failures.length) {
    console.error(`Fallaron ${failures.length} referencias:`);
    failures.forEach((failure) => console.error(failure));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.close());
