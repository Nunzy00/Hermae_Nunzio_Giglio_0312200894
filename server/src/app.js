const express = require('express');
const path = require('path');
const config = require('./config/env');
const corsMiddleware = require('./middlewares/corsMiddleware');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const apiRouter = require('./routes/index');

// Inizializza l'applicazione web Express
const app = express();

// Abilita la gestione delle richieste cross-origin da client remoti
app.use(corsMiddleware);

// Configura il parsing automatico dei corpi richiesta in formato JSON (limite 10MB)
app.use(express.json({ limit: '10mb' }));

// Configura il parsing dei corpi richiesta con codifica URL (form-urlencoded)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Espone la cartella uploads come directory statica per erogare le copertine WebP salvate
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Espone i file statici del front-end per consentire l'accesso diretto via browser all'applicazione
app.use(express.static(path.join(__dirname, '../../hermae-frontend')));

// Reindirizza la rotta radice alla pagina di accesso iniziale dell'applicazione
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Monta il router principale su prefisso centralizzato configurato (/api)
app.use(config.apiPrefix, apiRouter);

// Registra il middleware per gestire richieste verso rotte inesistenti (404 Not Found)
app.use(notFound);

// Registra il middleware globale di gestione degli errori non catturati (500 Error Handler)
app.use(errorHandler);

// Esporta l'istanza configurata dell'applicazione Express per l'avvio del server
module.exports = app;
