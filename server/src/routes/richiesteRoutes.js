// Router Express per la gestione degli endpoint delle richieste di contatto e messaggistica
const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const richiesteController = require('../controllers/richiesteController');

const router = express.Router();

// Tutte le rotte delle richieste di contatto e messaggistica richiedono autenticazione
router.use(authenticate);

// 1. Invia una nuova richiesta di contatto per un esemplare
router.post('/', richiesteController.creaRichiesta);

// 2. Recupera l'elenco dei thread di conversazione dell'utente
router.get('/', richiesteController.getRichieste);

// 3. Recupera il dettaglio completo di una richiesta con tutta la cronologia messaggi
router.get('/:id', richiesteController.getRichiestaDettaglio);

// 4. Invia un nuovo messaggio all'interno del thread
router.post('/:id/messaggi', richiesteController.inviaMessaggio);

// 5. Aggiorna lo stato della richiesta (ACCETTATA, RIFIUTATA, COMPLETATA, ANNULLATA)
router.patch('/:id/stato', richiesteController.aggiornaStato);

module.exports = router;
