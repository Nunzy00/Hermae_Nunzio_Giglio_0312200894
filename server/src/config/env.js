// Carica e convalida le variabili d'ambiente da file .env con valori di fallback predefiniti
const dotenv = require('dotenv');
dotenv.config();

// Esporta l'oggetto di configurazione centralizzato per l'intera applicazione
module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  apiPrefix: process.env.API_PREFIX || '/api'
};
