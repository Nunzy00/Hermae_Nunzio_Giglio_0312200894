const express = require('express');

// Istanzia il router principale di Express per aggregare tutti gli endpoint applicativi
const router = express.Router();

// Endpoint di Health Check per verificare lo stato di attività, uptime e orario del server
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: 'Hermae API Gateway',
      status: 'UP',
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString()
    }
  });
});

// Esporta il router principale per essere montato sull'applicazione Express con il prefisso /api
module.exports = router;
