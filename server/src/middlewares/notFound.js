// Intercetta tutte le richieste HTTP verso rotte non registrate e restituisce risposta 404 in formato JSON
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Risorsa non trovata: [${req.method}] ${req.originalUrl}`
    }
  });
};

// Esporta la funzione middleware per la gestione degli errori 404
module.exports = notFound;
