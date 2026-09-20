const cors = require('cors');
const config = require('../config/env');

// Definisce le opzioni di sicurezza per abilitare le richieste cross-origin dal client front-end
const corsOptions = {
  origin: config.clientOrigin === '*' ? '*' : config.clientOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Esporta il middleware CORS configurato per l'integrazione nella pipeline Express
module.exports = cors(corsOptions);
