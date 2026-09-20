const express = require('express');
const router = express.Router();
const posizioneController = require('../controllers/posizioneUtentiController');
const { authenticate } = require('../middlewares/authMiddleware');

// Applica il middleware di autenticazione Bearer a tutte le rotte di gestione posizione
router.use(authenticate);

// Rotta per recuperare la posizione geografica dell'utente autenticato
router.get('/me', posizioneController.getMiaPosizione);

// Rotta per registrare o sovrascrivere la posizione dell'utente
router.post('/', posizioneController.salvaPosizione);

// Rotta per aggiornare le coordinate o il raggio di ricerca dell'utente
router.put('/me', posizioneController.aggiornaMiaPosizione);

// Rotta per eliminare la posizione geografica associata all'account
router.delete('/me', posizioneController.eliminaMiaPosizione);

// Rotta per ricercare posizioni di altri lettori nelle vicinanze tramite calcolo PostGIS
router.get('/prossimita', posizioneController.getPosizioniVicine);

module.exports = router;
