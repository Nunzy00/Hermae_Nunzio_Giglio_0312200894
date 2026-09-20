# Fase 9 — Implementazione Struttura Base del Server

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

In questa fase è stato predisposto l’ambiente backend iniziale, configurando il web server, i middleware per la gestione delle richieste HTTP/CORS, la gestione degli errori globali e la struttura ad albero delle directory e dei router applicativi.

---

## 2. Elenco Filesystem dei File Creati

```text
server/
├── .env                        # Variabili d'ambiente (porta, ambiente, origini CORS)
├── .env.example                # Template pubblico di configurazione
├── .gitignore                  # Esclusione di node_modules, .env e file di log
├── package.json                # Dipendenze (express, cors, dotenv, nodemon) e script
├── server.js                   # Entry point con avvio del listener HTTP e graceful shutdown
├── src/
│   ├── app.js                  # Inizializzazione Express, middleware e routing
│   ├── config/
│   │   └── env.js              # Centralizzazione e validazione delle variabili d'ambiente
│   ├── middlewares/
│   │   ├── corsMiddleware.js   # Middleware per la gestione delle policy CORS
│   │   ├── notFound.js         # Middleware per la gestione degli errori 404 (Route Not Found)
│   │   └── errorHandler.js     # Middleware globale di gestione centralizzata errori (500)
│   ├── routes/
│   │   └── index.js            # Router principale (/api) con endpoint di Health Check
│   ├── controllers/            # Directory predisposta per i controller applicativi
│   └── services/               # Directory predisposta per i servizi di business logic e DB
└── uploads/
    └── .gitkeep                # Directory per lo storage locale delle immagini WebP
```

---

## 3. Repertorio dei Codici e delle Funzioni Implementate

Ciascun file include commenti sintetici a riga singola che ne esplicitano la funzione. Di seguito il repertorio delle funzioni e dei blocchi di codice con il relativo commento associato:

| File Sorgente | Funzione / Blocco di Codice | Commento Sintetico (Cosa fa) |
| :--- | :--- | :--- |
| **`server.js`** | `app.listen(config.port, ...)` | Avvia il server HTTP in ascolto sulla porta configurata e visualizza le informazioni di stato. |
| **`server.js`** | `process.on('SIGTERM', ...)` | Intercetta il segnale di chiusura del processo per terminare le connessioni attive (Graceful Shutdown). |
| **`src/app.js`** | `express()` | Inizializza l'applicazione web Express. |
| **`src/app.js`** | `app.use(corsMiddleware)` | Abilita la gestione delle richieste cross-origin da client remoti. |
| **`src/app.js`** | `app.use(express.json(...))` | Configura il parsing automatico dei corpi richiesta in formato JSON (limite 10MB). |
| **`src/app.js`** | `app.use(express.urlencoded(...))`| Configura il parsing dei corpi richiesta con codifica URL (form-urlencoded). |
| **`src/app.js`** | `app.use('/uploads', express.static(...))` | Espone la cartella uploads come directory statica per erogare le copertine WebP salvate. |
| **`src/app.js`** | `app.use(config.apiPrefix, apiRouter)` | Monta il router principale su prefisso centralizzato configurato (/api). |
| **`src/app.js`** | `app.use(notFound)` | Registra il middleware per gestire richieste verso rotte inesistenti (404 Not Found). |
| **`src/app.js`** | `app.use(errorHandler)` | Registra il middleware globale di gestione degli errori non catturati (500 Error Handler). |
| **`src/config/env.js`** | `dotenv.config()` | Carica e convalida le variabili d'ambiente da file .env con valori di fallback predefiniti. |
| **`src/config/env.js`** | `module.exports = { ... }` | Esporta l'oggetto di configurazione centralizzato per l'intera applicazione. |
| **`src/middlewares/corsMiddleware.js`** | `corsOptions` | Definisce le opzioni di sicurezza per abilitare le richieste cross-origin dal client front-end. |
| **`src/middlewares/corsMiddleware.js`** | `cors(corsOptions)` | Esporta il middleware CORS configurato per l'integrazione nella pipeline Express. |
| **`src/middlewares/notFound.js`** | `notFound(req, res, next)` | Intercetta tutte le richieste HTTP verso rotte non registrate e restituisce risposta 404 in formato JSON. |
| **`src/middlewares/errorHandler.js`** | `errorHandler(err, req, res, next)` | Intercetta qualsiasi eccezione o errore non gestito nei controller e formatta una risposta JSON standardizzata. |
| **`src/routes/index.js`** | `router.get('/health', ...)` | Endpoint di Health Check per verificare lo stato di attività, uptime e orario del server. |

---

## 4. Esito del Collaudo e Verifica

L'infrastruttura di base è stata collaudata con esito positivo:
- **Avvio HTTP:** Server attivo su `http://localhost:3000/api`;
- **Verifica Health Check:** Chiamata `GET /api/health` eseguita con risposta HTTP 200:
  ```json
  {
    "success": true,
    "data": {
      "service": "Hermae API Gateway",
      "status": "UP",
      "uptime": "2s",
      "timestamp": "2026-09-20T17:27:33.894Z"
    }
  }
  ```
- **Verifica Gestione 404:** Chiamata `GET /api/rotta-inesistente` intercettata correttamente dal middleware `notFound`:
  ```json
  {
    "success": false,
    "error": {
      "code": "ROUTE_NOT_FOUND",
      "message": "Risorsa non trovata: [GET] /api/rotta-inesistente"
    }
  }
  ```
- **Chiusura Controllata:** Segnale `SIGTERM` gestito correttamente con rilascio del socket e chiusura pulita.
