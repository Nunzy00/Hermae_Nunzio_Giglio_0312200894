const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

// GET /api/analytics - Statistiche aggregate e KPI per la dashboard utente
router.get('/', authenticate, analyticsController.getDashboardAnalytics);

// GET /api/analytics/utente - Alias per statistiche personali
router.get('/utente', authenticate, analyticsController.getDashboardAnalytics);

// GET /api/analytics/top-libri - Libri con maggior numero di visualizzazioni
router.get('/top-libri', authenticate, analyticsController.getTopLibri);

// POST /api/analytics/visita - Registrazione evento di consultazione scheda
router.post('/visita', analyticsController.tracciaVisualizzazione);

module.exports = router;
