// Controller per la gestione dei flussi di prestito tra utenti (Fase 23)
const prestitiService = require('../services/prestitiService');

/**
 * Recupera l'elenco dei prestiti dell'utente autenticato (libri ricevuti o concessi)
 */
const getPrestiti = async (req, res, next) => {
  try {
    const utenteId = req.user.id;
    const { ruolo, stato } = req.query;

    const prestiti = await prestitiService.getPrestitiUtente(utenteId, { ruolo, stato });

    res.status(200).json({
      success: true,
      data: prestiti,
      total: prestiti.length
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Recupera le metriche aggregate sui prestiti per i cruscotti
 */
const getMetriche = async (req, res, next) => {
  try {
    const utenteId = req.user.id;
    const metriche = await prestitiService.getMetrichePrestiti(utenteId);

    res.status(200).json({
      success: true,
      data: metriche
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Recupera il dettaglio completo di uno specifico prestito
 */
const getPrestitoDettaglio = async (req, res, next) => {
  try {
    const utenteId = req.user.id;
    const { id } = req.params;

    const prestito = await prestitiService.getPrestitoDettaglio(id, utenteId);

    res.status(200).json({
      success: true,
      data: prestito
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Invia una richiesta formale di prestito
 */
const creaPrestito = async (req, res, next) => {
  try {
    const richiedenteId = req.user.id;
    const { esemplare_id, durata_giorni, messaggio } = req.body;

    if (!esemplare_id) {
      return res.status(400).json({
        success: false,
        message: 'Il parametro esemplare_id è obbligatorio.'
      });
    }

    const nuovoPrestito = await prestitiService.creaRichiestaPrestito({
      richiedenteId,
      esemplareId: esemplare_id,
      durataGiorni: durata_giorni || 30,
      messaggio: messaggio || ''
    });

    res.status(201).json({
      success: true,
      message: 'Richiesta formale di prestito inoltrata con successo.',
      data: nuovoPrestito
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Accetta un prestito da parte del proprietario
 */
const accettaPrestito = async (req, res, next) => {
  try {
    const proprietarioId = req.user.id;
    const { id } = req.params;
    const { durata_giorni, note } = req.body;

    const prestitoAccettato = await prestitiService.accettaPrestito({
      richiestaId: id,
      proprietarioId,
      durataGiorniOverride: durata_giorni,
      note
    });

    res.status(200).json({
      success: true,
      message: 'Prestito accettato con successo. La disponibilità del libro è stata aggiornata a IN_PRESTITO.',
      data: prestitoAccettato
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Rifiuta una richiesta di prestito
 */
const rifiutaPrestito = async (req, res, next) => {
  try {
    const proprietarioId = req.user.id;
    const { id } = req.params;
    const { motivo } = req.body;

    const prestitoRifiutato = await prestitiService.rifiutaPrestito({
      richiestaId: id,
      proprietarioId,
      motivo
    });

    res.status(200).json({
      success: true,
      message: 'Richiesta di prestito declinata.',
      data: prestitoRifiutato
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Annulla una richiesta da parte del richiedente prima dell'accettazione
 */
const annullaPrestito = async (req, res, next) => {
  try {
    const richiedenteId = req.user.id;
    const { id } = req.params;

    const prestitoAnnullato = await prestitiService.annullaPrestito({
      richiestaId: id,
      richiedenteId
    });

    res.status(200).json({
      success: true,
      message: 'Richiesta di prestito revocata con successo.',
      data: prestitoAnnullato
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Registra la restituzione del testo e ripristina la disponibilità a DISPONIBILE
 */
const confermaRestituzione = async (req, res, next) => {
  try {
    const utenteId = req.user.id;
    const { id } = req.params;
    const { note } = req.body;

    const prestitoRestituito = await prestitiService.confermaRestituzione({
      richiestaId: id,
      utenteId,
      note
    });

    res.status(200).json({
      success: true,
      message: 'Restituzione registrata. La disponibilità del libro è stata ripristinata a DISPONIBILE.',
      data: prestitoRestituito
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Concede o richiede una proroga temporale del prestito
 */
const prorogaPrestito = async (req, res, next) => {
  try {
    const utenteId = req.user.id;
    const { id } = req.params;
    const { giorni_aggiuntivi } = req.body;

    const prestitoProrogato = await prestitiService.prorogaPrestito({
      richiestaId: id,
      utenteId,
      giorniAggiuntivi: giorni_aggiuntivi || 15
    });

    res.status(200).json({
      success: true,
      message: 'Proroga del prestito applicata con successo.',
      data: prestitoProrogato
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPrestiti,
  getMetriche,
  getPrestitoDettaglio,
  creaPrestito,
  accettaPrestito,
  rifiutaPrestito,
  annullaPrestito,
  confermaRestituzione,
  prorogaPrestito
};
