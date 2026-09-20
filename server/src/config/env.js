// Carica e convalida le variabili d'ambiente da file .env con valori di fallback predefiniti
const dotenv = require('dotenv');
dotenv.config();

// Esporta l'oggetto di configurazione centralizzato per l'intera applicazione
module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  apiPrefix: process.env.API_PREFIX || '/api',
  db: {
    connectionString: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'hermae_db',
    user: process.env.DB_USER || 'nunziogiglio',
    password: process.env.DB_PASSWORD || '',
    maxConnections: parseInt(process.env.DB_POOL_MAX, 10) || 10
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'hermae_jwt_secret_dev_key_2026_unipegaso',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'hermae_jwt_refresh_dev_key_2026_unipegaso',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  }
};
