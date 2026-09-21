const analyticsService = require('../services/analyticsService');

/**
 * Controller per la gestione delle richieste analitiche e statistiche utente (Fase 24).
 */

/**
 * Gestisce la richiesta GET /api/analytics
 * Restituisce le statistiche aggregate, i KPI, le serie temporali e la ripartizione per categoria.
 */
async function getDashboardAnalytics(req, res, next) {
  try {
    const utenteId = req.user.id;
    const { periodo } = req.query;

    const data = await analyticsService.getDashboardAnalytics(utenteId, { periodo });

    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Gestisce la richiesta POST /api/analytics/visita
 * Registra una visualizzazione scheda o interazione anonimizzata
 */
async function tracciaVisualizzazione(req, res, next) {
  try {
    const { esemplareId, tipoEvento, citta } = req.body;
    if (!esemplareId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Il parametro esemplareId è obbligatorio.' }
      });
    }

    const tracked = await analyticsService.tracciaVisitaLibro(esemplareId, tipoEvento, citta);

    res.status(200).json({
      success: true,
      data: { tracked }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Gestisce la richiesta GET /api/analytics/top-libri
 * Restituisce i volumi più consultati dell'utente
 */
async function getTopLibri(req, res, next) {
  try {
    const utenteId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 5;

    const libri = await analyticsService.getLibriPiuConsultati(utenteId, limit);

    res.status(200).json({
      success: true,
      data: libri
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardAnalytics,
  tracciaVisualizzazione,
  getTopLibri
};
