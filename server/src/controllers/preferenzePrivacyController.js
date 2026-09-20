const privacyService = require('../services/preferenzePrivacyService');

// Restituisce le impostazioni di riservatezza e visibilità dell'utente autenticato
const getMiePreferenze = async (req, res, next) => {
  try {
    const preferenze = await privacyService.getPreferenzeByUtenteId(req.user.id);
    res.status(200).json({
      success: true,
      data: preferenze
    });
  } catch (error) {
    next(error);
  }
};

// Aggiorna dinamicamente i flag di riservatezza e visibilità dell'utente
const aggiornaMiePreferenze = async (req, res, next) => {
  try {
    const {
      profilo_pubblico,
      mostra_posizione,
      mostra_libreria,
      mostra_email,
      raggio_visibilita_km,
      consenti_messaggi_diretti
    } = req.body;

    const preferenze = await privacyService.upsertPreferenze(req.user.id, {
      profilo_pubblico,
      mostra_posizione,
      mostra_libreria,
      mostra_email,
      raggio_visibilita_km,
      consenti_messaggi_diretti
    });

    res.status(200).json({
      success: true,
      message: 'Impostazioni di riservatezza aggiornate con successo.',
      data: preferenze
    });
  } catch (error) {
    next(error);
  }
};

// Ripristina le preferenze di riservatezza ai valori predefiniti cautelativi (Privacy by Default)
const resetMiePreferenze = async (req, res, next) => {
  try {
    const preferenze = await privacyService.resetPreferenzeDefault(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Preferenze di privacy ripristinate ai valori predefiniti di massima tutela (Privacy by Default).',
      data: preferenze
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMiePreferenze,
  aggiornaMiePreferenze,
  resetMiePreferenze
};
