const express = require('express');
const router = express.Router();
const cmpController = require('../controllers/cmpController');
const { optionalAuth } = require('../middlewares/authMiddleware');

// Applica l'autenticazione opzionale: associa req.user se il token è valido, altrimenti gestisce come client anonimo
router.use(optionalAuth);

// Restituisce l'elenco delle categorie, finalità e basi giuridiche della policy CMP
router.get('/policy', cmpController.getPolicy);

// Restituisce lo stato attuale del consenso per l'utente loggato o per il client id
router.get('/stato', cmpController.getStato);

// Registra una scelta esplicita di consenso (tutti, personalizzati o solo necessari)
router.post('/consenso', cmpController.salvaConsenso);

// Revoca immediata dei consensi facoltativi
router.post('/revoca', cmpController.revocaConsensi);

module.exports = router;
