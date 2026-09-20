const app = require('./src/app');
const config = require('./src/config/env');

// Avvia il server HTTP in ascolto sulla porta configurata e visualizza le informazioni di stato
const server = app.listen(config.port, () => {
  console.log('====================================================');
  console.log('🚀 HERMAE SERVER avviato con successo!');
  console.log(`📍 Endpoint base: http://localhost:${config.port}${config.apiPrefix}`);
  console.log(`🩺 Health check: http://localhost:${config.port}${config.apiPrefix}/health`);
  console.log(`🌍 Ambiente: ${config.nodeEnv}`);
  console.log('====================================================');
});

// Intercetta il segnale di chiusura del processo per terminare le connessioni attive (Graceful Shutdown)
process.on('SIGTERM', () => {
  console.log('Ricevuto SIGTERM, chiusura del server in corso...');
  server.close(() => {
    console.log('Server HTTP terminato.');
  });
});
