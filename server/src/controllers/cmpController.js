/**
 * HERMAE — Controller Consent Management Platform (CMP)
 * Gestione degli endpoint REST per il consenso informato GDPR/ePrivacy
 */

const cmpService = require('../services/cmpService');

/**
 * Restituisce i metadati strutturati della policy CMP e le categorie di trattamento
 * GET /api/cmp/policy
 */
const getPolicy = async (req, res, next) => {
  try {
    const policy = cmpService.getPolicyMetadata();
    return res.status(200).json({
      success: true,
      data: policy
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Restituisce lo stato attuale del consenso per l'utente loggato o per il consenso_id fornito
 * GET /api/cmp/stato
 */
const getStato = async (req, res, next) => {
  try {
    const utenteId = req.user ? req.user.id : null;
    const consensoId = req.query.consenso_id || req.headers['x-cmp-consent-id'] || null;

    const stato = await cmpService.getStatoConsenso({ utenteId, consensoId });
    return res.status(200).json({
      success: true,
      data: stato
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Registra o aggiorna un'espressione di consenso informato
 * POST /api/cmp/consenso
 */
const salvaConsenso = async (req, res, next) => {
  try {
    const utenteId = req.user ? req.user.id : null;
    const {
      consenso_id,
      funzionali,
      analitici,
      servizi_terzi,
      versione_policy
    } = req.body || {};

    const resolvedConsensoId = consenso_id || req.headers['x-cmp-consent-id'] || null;

    // Validazione rigorosa: i campi facoltativi devono essere booleani se forniti
    const validateBool = (val, name) => {
      if (val !== undefined && typeof val !== 'boolean') {
        const error = new Error(`Il campo '${name}' deve essere di tipo booleano.`);
        error.statusCode = 400;
        throw error;
      }
    };

    validateBool(funzionali, 'funzionali');
    validateBool(analitici, 'analitici');
    validateBool(servizi_terzi, 'servizi_terzi');

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || null;

    const risultato = await cmpService.registraConsenso({
      utenteId,
      consensoId: resolvedConsensoId,
      funzionali: Boolean(funzionali),
      analitici: Boolean(analitici),
      servizi_terzi: Boolean(servizi_terzi),
      versione_policy: versione_policy || cmpService.POLICY_VERSION,
      ip: clientIp,
      userAgent
    });

    return res.status(200).json({
      success: true,
      message: 'Consenso informato registrato con successo nel registro CMP.',
      data: risultato
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Revoca tutti i consensi facoltativi
 * POST /api/cmp/revoca
 */
const revocaConsensi = async (req, res, next) => {
  try {
    const utenteId = req.user ? req.user.id : null;
    const consensoId = req.body.consenso_id || req.headers['x-cmp-consent-id'] || null;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || null;

    const risultato = await cmpService.revocaConsensi({
      utenteId,
      consensoId,
      ip: clientIp,
      userAgent
    });

    return res.status(200).json({
      success: true,
      message: 'Consensi facoltativi revocati. Attivi esclusivamente i cookie tecnici necessari.',
      data: risultato
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPolicy,
  getStato,
  salvaConsenso,
  revocaConsensi
};
