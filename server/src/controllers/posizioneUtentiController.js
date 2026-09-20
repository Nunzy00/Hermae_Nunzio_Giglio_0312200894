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
    let { lat, lng, raggio = 10, limit = 20, includi_solo_citta = false } = req.query;

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

    const posizioni = await posizioneService.findPosizioniVicine(lat, lng, raggio, limit, includi_solo_citta);

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

// Stima la posizione geografica approssimata tramite indirizzo IP pubblico di rete (fallback per client desktop/senza GPS)
const localizzaDaIP = async (req, res, next) => {
  try {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';

    const url = isLocalhost ? 'https://ipapi.co/json/' : `https://ipapi.co/${encodeURIComponent(clientIp)}/json/`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'HermaeSharingCulturale/1.0' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Servizio IP Geolocation non disponibile (status ${response.status})`);
    }

    const data = await response.json();
    if (!data.latitude || !data.longitude) {
      throw new Error('Coordinate non rilevabili dall\'indirizzo IP');
    }

    res.status(200).json({
      success: true,
      data: {
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude),
        citta: data.city || 'Comune rilevato da IP',
        regione: data.region || '',
        nazione: data.country_name || 'Italia',
        accuracy: 1500,
        source: 'ip_fallback'
      }
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      error: {
        code: 'IP_GEO_FAILED',
        message: 'Impossibile ricavare la posizione tramite connessione IP.'
      }
    });
  }
};

module.exports = {
  getMiaPosizione,
  salvaPosizione,
  aggiornaMiaPosizione,
  eliminaMiaPosizione,
  getPosizioniVicine,
  localizzaDaIP
};
