// Modulo di gestione e connessione al database relazionale PostgreSQL tramite pool di client
const { Pool } = require('pg');
const config = require('./env');

// Inizializza il pool di connessioni PostgreSQL utilizzando i parametri configurati nelle variabili d'ambiente
const pool = new Pool(
  config.db.connectionString
    ? { connectionString: config.db.connectionString }
    : {
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user,
        password: config.db.password,
        max: config.db.maxConnections,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      }
);

// Intercetta e registra gli errori imprevisti generati dai client inattivi all'interno del pool
pool.on('error', (err) => {
  console.error('Errore critico non gestito nel pool di connessione PostgreSQL:', err.message);
});

// Esegue una query SQL parametrizzata sfruttando un client disponibile nel pool
const query = (text, params) => pool.query(text, params);

// Verifica la connettività attiva al database eseguendo una query di heartbeat
const testConnection = async () => {
  const start = Date.now();
  const result = await pool.query(
    'SELECT NOW() as server_time, current_database() as database_name, version() as db_version'
  );
  const latencyMs = Date.now() - start;

  return {
    status: 'connected',
    database: result.rows[0].database_name,
    timestamp: result.rows[0].server_time,
    latencyMs,
    version: result.rows[0].db_version
  };
};

// Chiude tutti i client attivi nel pool rilasciando le risorse di rete
const closePool = () => pool.end();

// Esporta l'istanza del pool e i metodi di esecuzione query e diagnostica
module.exports = {
  pool,
  query,
  testConnection,
  closePool
};
