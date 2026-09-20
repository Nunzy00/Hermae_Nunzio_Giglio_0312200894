// Middleware Express per il caricamento multipart delle immagini copertina tramite Multer
const multer = require('multer');

// Configura lo storage in memoria per consentire l'elaborazione diretta dei buffer tramite Sharp
const storage = multer.memoryStorage();

// Tipi MIME consentiti per le immagini di copertina
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
];

// Limite massimo di dimensione per ciascun file immagine (5 MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Filtro di validazione MIME type del file in ingresso
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    const error = new Error(
      `Formato file non supportato (${file.mimetype}). Sono ammessi esclusivamente file JPEG, PNG, WebP e AVIF.`
    );
    error.code = 'FILE_TYPE_NOT_ALLOWED';
    error.statusCode = 400;
    cb(error, false);
  }
};

// Inizializza l'istanza Multer con i vincoli di sicurezza definiti
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter
});

// Middleware Express per la gestione del singolo campo 'copertina' con cattura errori form-data
const uploadCoverMiddleware = (req, res, next) => {
  const singleUpload = upload.single('copertina');

  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const sizeError = new Error('Il file supera la dimensione massima consentita di 5 MB.');
          sizeError.code = 'FILE_TOO_LARGE';
          sizeError.statusCode = 400;
          return next(sizeError);
        }
        err.statusCode = 400;
        return next(err);
      }
      return next(err);
    }
    next();
  });
};

module.exports = {
  uploadCoverMiddleware,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
};
