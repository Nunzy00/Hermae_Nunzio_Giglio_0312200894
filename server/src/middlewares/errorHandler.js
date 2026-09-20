const config = require('../config/env');

// Intercetta qualsiasi eccezione o errore non gestito nei controller e formatta una risposta JSON standardizzata
const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;

  // Stampa a console l'errore per monitoraggio e debug in fase di sviluppo
  console.error(`[ERROR ${statusCode}] ${err.message}`, {
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method
  });

  // Invia la risposta di errore al client nascondendo lo stack trace in produzione
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Si è verificato un errore imprevisto sul server.',
      ...(config.nodeEnv === 'development' && { stack: err.stack })
    }
  });
};

// Esporta la funzione middleware per la gestione centralizzata degli errori
module.exports = errorHandler;
