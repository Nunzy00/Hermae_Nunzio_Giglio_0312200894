const express = require('express');
const router = express.Router();
const privacyController = require('../controllers/preferenzePrivacyController');
const { authenticate } = require('../middlewares/authMiddleware');

// Applica il controllo di accesso Bearer JWT a tutte le rotte di gestione privacy
router.use(authenticate);

// Rotta per recuperare le preferenze di riservatezza dell'utente autenticato
router.get('/me', privacyController.getMiePreferenze);

// Rotta per aggiornare i flag di visibilità e i permessi del profilo
router.put('/me', privacyController.aggiornaMiePreferenze);

// Rotta per ripristinare le preferenze di privacy ai valori cautelativi di fabbrica
router.delete('/me', privacyController.resetMiePreferenze);

module.exports = router;
