// Router Express per la gestione del ciclo di vita dei Prestiti (Fase 23)
const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const prestitiController = require('../controllers/prestitiController');

const router = express.Router();

// Tutte le rotte dei prestiti richiedono autenticazione
router.use(authenticate);

// 1. Recupera le metriche di riepilogo prestiti per i cruscotti
router.get('/metriche', prestitiController.getMetriche);

// 2. Recupera l'elenco dei prestiti con filtri di ruolo e stato
router.get('/', prestitiController.getPrestiti);

// 3. Recupera il dettaglio completo di uno specifico prestito
router.get('/:id', prestitiController.getPrestitoDettaglio);

// 4. Invia una nuova richiesta formale di prestito con durata specificata
router.post('/', prestitiController.creaPrestito);

// 5. Accetta un prestito da parte del proprietario (con blocco concorrenza e disponibilità)
router.patch('/:id/accetta', prestitiController.accettaPrestito);

// 6. Rifiuta una richiesta di prestito da parte del proprietario
router.patch('/:id/rifiuta', prestitiController.rifiutaPrestito);

// 7. Annulla una richiesta prima dell'accettazione da parte del richiedente
router.patch('/:id/annulla', prestitiController.annullaPrestito);

// 8. Registra la restituzione del testo e ripristina la disponibilità a DISPONIBILE
router.patch('/:id/restituisci', prestitiController.confermaRestituzione);

// 9. Concede o richiede una proroga temporale
router.patch('/:id/proroga', prestitiController.prorogaPrestito);

module.exports = router;
