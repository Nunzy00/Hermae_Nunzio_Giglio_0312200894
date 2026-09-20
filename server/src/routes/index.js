const express = require('express');
const { testConnection } = require('../config/db');
const userRoutes = require('./userRoutes');
const authRoutes = require('./authRoutes');
const posizioneRoutes = require('./posizioneUtentiRoutes');
const privacyRoutes = require('./preferenzePrivacyRoutes');
const esemplariRoutes = require('./esemplariRoutes');
const categorieRoutes = require('./categorieRoutes');

// Istanzia il router principale di Express per aggregare tutti gli endpoint applicativi
const router = express.Router();

// Endpoint di Health Check per verificare lo stato di attività del server e la connettività al database
router.get('/health', async (req, res) => {
  let dbInfo = { status: 'DISCONNECTED' };

  try {
    const dbCheck = await testConnection();
    dbInfo = {
      status: 'CONNECTED',
      database: dbCheck.database,
      latencyMs: dbCheck.latencyMs,
      timestamp: dbCheck.timestamp
    };
  } catch (err) {
    dbInfo = {
      status: 'DISCONNECTED',
      error: err.message
    };
  }

  res.status(200).json({
    success: true,
    data: {
      service: 'Hermae API Gateway',
      status: 'UP',
      database: dbInfo,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString()
    }
  });
});

// Endpoint diagnostico dedicato per ispezionare i parametri e le metriche di connessione al database
router.get('/db-status', async (req, res, next) => {
  try {
    const status = await testConnection();
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (err) {
    next(err);
  }
});

// Monta il router delle operazioni di autenticazione e gestione sessione sul percorso /auth
router.use('/auth', authRoutes);

// Monta il router delle operazioni CRUD dell'entità utenti sul percorso /users
router.use('/users', userRoutes);

// Monta il router delle operazioni geospaziali e gestione posizione sul percorso /posizioni
router.use('/posizioni', posizioneRoutes);

// Monta il router delle preferenze di riservatezza e permessi profilo sul percorso /privacy
router.use('/privacy', privacyRoutes);

// Monta il router delle operazioni CRUD dell'entità esemplari (libri fisici) sul percorso /esemplari
router.use('/esemplari', esemplariRoutes);

// Monta il router di consultazione delle categorie disciplinari sul percorso /categorie
router.use('/categorie', categorieRoutes);

// Esporta il router principale per essere montato sull'applicazione Express con il prefisso /api
module.exports = router;
