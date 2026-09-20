const app = require('./src/app');
const config = require('./src/config/env');
const { testConnection, closePool } = require('./src/config/db');

// Avvia il server HTTP in ascolto sulla porta configurata e verifica la connettività al database
const server = app.listen(config.port, async () => {
  console.log('====================================================');
  console.log('🚀 HERMAE SERVER avviato con successo!');
  console.log(`📍 Endpoint base: http://localhost:${config.port}${config.apiPrefix}`);
  console.log(`🩺 Health check: http://localhost:${config.port}${config.apiPrefix}/health`);
  console.log(`🌍 Ambiente: ${config.nodeEnv}`);

  try {
    const dbInfo = await testConnection();
    console.log(`🗄️  Database connesso: ${dbInfo.database} (latenza: ${dbInfo.latencyMs}ms)`);
  } catch (err) {
    console.error('❌ Errore connessione database iniziale:', err.message);
  }

  console.log('====================================================');
});

// Gestisce la chiusura pulita del server HTTP e del pool di connessioni al database (Graceful Shutdown)
const gracefulShutdown = (signal) => {
  console.log(`\nRicevuto ${signal}, chiusura delle connessioni in corso...`);
  server.close(async () => {
    console.log('Server HTTP terminato.');
    try {
      await closePool();
      console.log('Pool PostgreSQL chiuso correttamente.');
    } catch (err) {
      console.error('Errore durante la chiusura del pool DB:', err.message);
    }
    process.exit(0);
  });
};

// Intercetta il segnale SIGTERM per avviare il graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Intercetta il segnale SIGINT per avviare il graceful shutdown
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
