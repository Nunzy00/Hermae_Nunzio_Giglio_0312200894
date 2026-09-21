// Router Express per la gestione degli endpoint delle notifiche interne
const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const notificheController = require('../controllers/notificheController');

const router = express.Router();

// Tutte le rotte di notifica richiedono autenticazione
router.use(authenticate);

// 1. Recupera l'elenco delle notifiche dell'utente
router.get('/', notificheController.getNotifiche);

// 2. Recupera il conteggio rapido delle notifiche non lette
router.get('/conteggio', notificheController.getConteggioNonLette);

// 3. Segna tutte le notifiche non lette come lette
router.patch('/lette-tutte', notificheController.segnaTutteLette);

// 4. Segna una specifica notifica come letta
router.patch('/:id/letta', notificheController.segnaLetta);

module.exports = router;
