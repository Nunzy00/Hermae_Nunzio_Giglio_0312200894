const posizioneService = require('../services/posizioneUtentiService');

// Restituisce la posizione geografica registrata dell'utente correntemente autenticato
const getMiaPosizione = async (req, res, next) => {
  try {
    const posizione = await posizioneService.getPosizioneByUtenteId(req.user.id);
    if (!posizione) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Nessuna coordinata geografica registrata per questo account.'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: posizione
    });
  } catch (error) {
    next(error);
  }
};

// Crea o sovrascrive la posizione geografica per il profilo dell'utente autenticato
const salvaPosizione = async (req, res, next) => {
  try {
    const { citta, indirizzo_approssimato, latitudine, longitudine, raggio_ricerca_km } = req.body;
    const posizione = await posizioneService.upsertPosizione(req.user.id, {
      citta,
      indirizzo_approssimato,
      latitudine,
      longitudine,
      raggio_ricerca_km
    });

    res.status(201).json({
      success: true,
      message: 'Posizione geografica salvata con successo.',
      data: posizione
    });
  } catch (error) {
    next(error);
  }
};

// Aggiorna dinamicamente i parametri di localizzazione e il raggio di prossimità dell'utente
const aggiornaMiaPosizione = async (req, res, next) => {
  try {
    const { citta, indirizzo_approssimato, latitudine, longitudine, raggio_ricerca_km } = req.body;
    const posizione = await posizioneService.upsertPosizione(req.user.id, {
      citta,
      indirizzo_approssimato,
      latitudine,
      longitudine,
      raggio_ricerca_km
    });

    res.status(200).json({
      success: true,
      message: 'Posizione geografica aggiornata con successo.',
      data: posizione
    });
  } catch (error) {
    next(error);
  }
};

// Elimina le coordinate geografiche associate all'account dell'utente
const eliminaMiaPosizione = async (req, res, next) => {
  try {
    const deleted = await posizioneService.deletePosizioneByUtenteId(req.user.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Nessuna posizione trovata da cancellare per questo utente.'
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Posizione geografica rimossa con successo.'
    });
  } catch (error) {
    next(error);
  }
};

// Esegue una ricerca geospaziale restituendo le posizioni offuscate entro il raggio chilometrico indicato
const getPosizioniVicine = async (req, res, next) => {
  try {
    let { lat, lng, raggio = 10, limit = 20 } = req.query;

    // Se le coordinate non sono specificate nella query, utilizza quelle salvate dell'utente connesso
    if (!lat || !lng) {
      const miaPos = await posizioneService.getPosizioneByUtenteId(req.user.id);
      if (!miaPos) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'COORDINATES_REQUIRED',
            message: 'Specificare i parametri lat e lng o configurare la propria posizione.'
          }
        });
      }
      lat = miaPos.latitudine;
      lng = miaPos.longitudine;
      if (!req.query.raggio) {
        raggio = miaPos.raggio_ricerca_km;
      }
    }

    const posizioni = await posizioneService.findPosizioniVicine(lat, lng, raggio, limit);

    res.status(200).json({
      success: true,
      data: {
        centro_ricerca: { lat: parseFloat(lat), lng: parseFloat(lng) },
        raggio_km: parseFloat(raggio),
        totale_trovati: posizioni.length,
        risultati: posizioni
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMiaPosizione,
  salvaPosizione,
  aggiornaMiaPosizione,
  eliminaMiaPosizione,
  getPosizioniVicine
};
