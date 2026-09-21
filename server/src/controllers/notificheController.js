// Controller HTTP per la gestione delle notifiche interne
// Conforme alla Fase 22
const notificheService = require('../services/notificheService');

/**
 * Recupera l'elenco delle notifiche dell'utente autenticato
 * GET /api/notifiche?soloNonLette=true&limit=20
 */
const getNotifiche = async (req, res, next) => {
  try {
    const utente_id = req.user.id;
    const soloNonLette = req.query.soloNonLette === 'true' || req.query.non_lette === 'true';
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const risultato = await notificheService.getNotificheUtente(utente_id, { soloNonLette, limit, offset });

    return res.json({
      success: true,
      data: risultato.notifiche,
      totale: risultato.totale,
      non_lette: risultato.non_lette
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Restituisce il conteggio delle sole notifiche non lette (per badge navbar)
 * GET /api/notifiche/conteggio
 */
const getConteggioNonLette = async (req, res, next) => {
  try {
    const utente_id = req.user.id;
    const non_lette = await notificheService.getConteggioNonLette(utente_id);

    return res.json({
      success: true,
      data: {
        non_lette
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Segna una specifica notifica come letta
 * PATCH /api/notifiche/:id/letta
 */
const segnaLetta = async (req, res, next) => {
  try {
    const utente_id = req.user.id;
    const { id } = req.params;

    const notifica = await notificheService.segnaNotificaLetta(id, utente_id);

    return res.json({
      success: true,
      data: notifica
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Segna tutte le notifiche non lette dell'utente come lette
 * PATCH /api/notifiche/lette-tutte
 */
const segnaTutteLette = async (req, res, next) => {
  try {
    const utente_id = req.user.id;
    const esito = await notificheService.segnaTutteLette(utente_id);

    return res.json({
      success: true,
      data: esito
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifiche,
  getConteggioNonLette,
  segnaLetta,
  segnaTutteLette
};
