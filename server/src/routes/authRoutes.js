// Router Express dedicato agli endpoint di autenticazione, gestione account e sessione
const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');

// Istanzia il router modulare per le operazioni di autenticazione
const router = express.Router();

// Rotta pubblica per la registrazione di un nuovo utente e l'ottenimento dei token iniziali
router.post('/register', authController.register);

// Rotta pubblica per l'accesso tramite email e password con emissione di Access Token e Refresh Token
router.post('/login', authController.login);

// Rotta per il rinnovo dell'Access Token scaduto tramite Refresh Token valido
router.post('/refresh', authController.refreshToken);

// Rotta protetta da autenticazione per recuperare i dettagli del profilo utente connesso
router.get('/me', authenticate, authController.getMe);

// Rotta per la disconnessione e invalidazione logica della sessione
router.post('/logout', authController.logout);

// Esporta il router delle rotte di autenticazione
module.exports = router;
