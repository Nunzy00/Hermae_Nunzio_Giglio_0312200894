// Servizio per l'elaborazione, ridimensionamento e conversione WebP delle copertine dei libri (RF-4)
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

// Cartella fisica di memorizzazione su filesystem
const COVERS_DIR = path.join(__dirname, '../../uploads/covers');

/**
 * Assicura che la directory di destinazione esista
 */
const ensureCoversDirExists = async () => {
  try {
    await fs.mkdir(COVERS_DIR, { recursive: true });
  } catch (err) {
    console.error('Errore durante la creazione della cartella covers:', err);
  }
};

/**
 * Elabora un buffer di immagine in memoria generando copertina standard (800px) e miniatura (200px) in formato WebP
 * 
 * @param {Buffer} buffer - Buffer dell'immagine inviata tramite Multer
 * @param {string} bookId - Identificativo UUID dell'esemplare per nominare i file
 * @returns {Promise<{ copertinaUrl: string, miniaturaUrl: string }>}
 */
const processBookCover = async (buffer, bookId) => {
  await ensureCoversDirExists();

  const timestamp = Date.now();
  const coverFileName = `cover-${bookId}-${timestamp}.webp`;
  const thumbFileName = `thumb-${bookId}-${timestamp}.webp`;

  const coverFilePath = path.join(COVERS_DIR, coverFileName);
  const thumbFilePath = path.join(COVERS_DIR, thumbFileName);

  // 1. Genera copertina standard ad alta risoluzione (max 800x1200px, WebP quality 80)
  await sharp(buffer)
    .resize(800, 1200, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 80, effort: 4 })
    .toFile(coverFilePath);

  // 2. Genera miniatura / thumbnail per tabelle e griglie veloci (max 200x300px, WebP quality 75)
  await sharp(buffer)
    .resize(200, 300, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 75, effort: 4 })
    .toFile(thumbFilePath);

  return {
    copertinaUrl: `/uploads/covers/${coverFileName}`,
    miniaturaUrl: `/uploads/covers/${thumbFileName}`
  };
};

/**
 * Elimina in sicurezza i file immagine dal filesystem (se presenti)
 * 
 * @param {string|null} copertinaUrl - URL relativo della copertina
 * @param {string|null} miniaturaUrl - URL relativo della miniatura
 */
const deleteBookCoverFiles = async (copertinaUrl, miniaturaUrl) => {
  const urlsToDelete = [copertinaUrl, miniaturaUrl].filter(Boolean);

  for (const relUrl of urlsToDelete) {
    try {
      // Normalizza il percorso assicurando che non possa evadere dalla directory covers
      const fileName = path.basename(relUrl);
      const filePath = path.join(COVERS_DIR, fileName);

      // Verifica esistenza e rimuove
      await fs.unlink(filePath);
    } catch (err) {
      // Se il file non esiste già (ENOENT), ignora; altrimenti logga l'avviso
      if (err.code !== 'ENOENT') {
        console.warn(`Avviso: Impossibile eliminare il file ${relUrl}:`, err.message);
      }
    }
  }
};

module.exports = {
  processBookCover,
  deleteBookCoverFiles,
  COVERS_DIR
};
