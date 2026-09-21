// Controller HTTP per la gestione delle richieste di contatto e messaggistica
// Conforme alla Fase 22
const richiesteService = require('../services/richiesteService');

/**
 * Invia una nuova richiesta di contatto per un esemplare
 * POST /api/richieste
 */
const creaRichiesta = async (req, res, next) => {
  try {
    const richiedente_id = req.user.id;
    const { esemplare_id, messaggio_iniziale } = req.body;

    if (!esemplare_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_BOOK_ID',
          message: 'Il parametro esemplare_id è obbligatorio'
        }
      });
    }

    const risultato = await richiesteService.creaRichiestaContatto({
      esemplare_id,
      richiedente_id,
      messaggio_iniziale
    });

    return res.status(201).json({
      success: true,
      data: risultato
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Recupera l'elenco delle richieste/conversazioni dell'utente autenticato
 * GET /api/richieste?ruolo=tutti&stato=IN_ATTESA
 */
const getRichieste = async (req, res, next) => {
  try {
    const utente_id = req.user.id;
    const { ruolo, stato } = req.query;

    const lista = await richiesteService.getRichiesteUtente(utente_id, { ruolo, stato });

    return res.json({
      success: true,
      count: lista.length,
      data: lista
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Recupera il dettaglio completo di una richiesta con tutta la cronologia messaggi
 * GET /api/richieste/:id
 */
const getRichiestaDettaglio = async (req, res, next) => {
  try {
    const utente_id = req.user.id;
    const { id } = req.params;

    const dettaglio = await richiesteService.getRichiestaById(id, utente_id);

    return res.json({
      success: true,
      data: dettaglio
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Invia un nuovo messaggio nel thread di dialogo
 * POST /api/richieste/:id/messaggi
 */
const inviaMessaggio = async (req, res, next) => {
  try {
    const mittente_id = req.user.id;
    const { id } = req.params;
    const { testo } = req.body;

    if (!testo || !testo.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_MESSAGE',
          message: 'Il testo del messaggio non può essere vuoto'
        }
      });
    }

    const risultato = await richiesteService.inviaMessaggio({
      richiesta_id: id,
      mittente_id,
      testo
    });

    return res.status(201).json({
      success: true,
      data: risultato
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Aggiorna lo stato di una richiesta (es. ACCETTATA, RIFIUTATA, COMPLETATA, ANNULLATA)
 * PATCH /api/richieste/:id/stato
 */
const aggiornaStato = async (req, res, next) => {
  try {
    const utente_id = req.user.id;
    const { id } = req.params;
    const { stato } = req.body;

    if (!stato) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_STATUS',
          message: 'Il parametro stato è obbligatorio'
        }
      });
    }

    const aggiornata = await richiesteService.aggiornaStatoRichiesta({
      richiesta_id: id,
      utente_id,
      nuovo_stato: stato
    });

    return res.json({
      success: true,
      data: aggiornata
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Recupera l'elenco cronologico dei messaggi di una specifica conversazione
 * GET /api/richieste/:id/messaggi
 */
const getMessaggi = async (req, res, next) => {
  try {
    const utente_id = req.user.id;
    const { id } = req.params;

    const dettaglio = await richiesteService.getRichiestaById(id, utente_id);

    return res.json({
      success: true,
      count: (dettaglio.messaggi || []).length,
      data: dettaglio.messaggi || [],
      richiesta: {
        id: dettaglio.id,
        stato: dettaglio.stato,
        data_richiesta: dettaglio.data_richiesta,
        data_aggiornamento: dettaglio.data_aggiornamento,
        giorni_rimanenti_chat: dettaglio.giorni_rimanenti_chat,
        avviso_retention: dettaglio.avviso_retention
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  creaRichiesta,
  getRichieste,
  getRichiestaDettaglio,
  getMessaggi,
  inviaMessaggio,
  aggiornaStato
};
