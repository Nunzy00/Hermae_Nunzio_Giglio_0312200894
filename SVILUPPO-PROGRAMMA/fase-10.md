# Fase 10 — Creazione Database

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-10.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

In questa fase è stato istanziato l’ambiente database fisico/cloud e sono stati eseguiti gli script DDL per la creazione delle tabelle, degli indici e dei vincoli definiti precedentemente, testando con successo la stringa di connessione dal backend.

Nello specifico:
1. È stato istanziato il database relazionale geospaziale **`hermae_db`** su istanza PostgreSQL locale;
2. Sono state abilitate le estensioni per la generazione crittografica di identificatori universali (`pgcrypto` per UUID v4 nativi) e per l'indicizzazione e calcolo geospaziale (`btree_gist`, `cube`, `earthdistance`);
3. È stato formalizzato ed eseguito lo script DDL consolidato (`INFO-DATABASE/schema.sql`) per la creazione delle 6 tabelle di sistema (`utenti`, `categorie`, `esemplari`, `richieste_prestito`, `messaggi_chat`, `metriche_visite`), con i relativi vincoli di chiave primaria, chiavi esterne con politiche di eliminazione (`ON DELETE CASCADE`, `RESTRICT`, `SET NULL`) e indici ad albero GiST e B-Tree;
4. È stato popolato il seed iniziale della tassonomia categorie;
5. È stato implementato il modulo di pooling e gestione connessioni nel backend Node.js (`server/src/config/db.js`) tramite il driver `pg` (`node-postgres`);
6. Sono stati aggiornati gli endpoint di sistema (`/api/health` e `/api/db-status`) per includere il monitoraggio in tempo reale della connessione e la latenza del database;
7. È stata collaudata la connessione tra backend e database con esito positivo e latenza media di 1–2 ms.

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
INFO-DATABASE/
└── schema.sql                  # Script DDL ufficiale per estensioni, tabelle, vincoli, indici e seed

server/
├── .env                        # Configurazione ambiente con credenziali di connessione PostgreSQL
├── .env.example                # Template pubblico di configurazione con parametri DB
├── package.json                # Aggiunta della dipendenza pg (node-postgres)
├── server.js                   # Entry point aggiornato con verifica DB all'avvio e graceful shutdown
└── src/
    ├── config/
    │   ├── db.js               # Modulo di pooling PostgreSQL con metodi query, testConnection e closePool
    │   └── env.js              # Aggiornamento configurazione con sezione db (host, port, user, name, pool)
    └── routes/
        └── index.js            # Router API aggiornato con health check integrato a PostgreSQL e /db-status
```

---

## 3. Software, Estensioni e Dipendenze Installate / Aggiornate

Per concretizzare l'ambiente database e integrarlo nel runtime backend sono stati installati e configurati i seguenti componenti:

### 3.1 Ambiente DBMS ed Estensioni PostgreSQL
- **DBMS:** PostgreSQL 14.19 (aarch64-apple-darwin, Homebrew) attivo su porta `5432`;
- **Database istanziato:** `hermae_db` (owner: `nunziogiglio`, encoding: `UTF8`);
- **Estensioni PostgreSQL attivate:**
  - **`pgcrypto` (v1.3):** Funzioni crittografiche per la generazione autonoma e sicura di UUID v4 (`gen_random_uuid()`);
  - **`btree_gist` (v1.6):** Supporto agli indici ad albero GiST su geometrie, coordinate e tipi nativi;
  - **`cube` (v1.5):** Modulo ausiliario per la gestione di spazi vettoriali e coordinate multidimensionali;
  - **`earthdistance` (v1.1):** Funzioni geodetiche sferiche per il calcolo delle distanze metriche reali (`earth_distance`).

### 3.2 Pacchetti npm del Backend (`server/`)
- **`pg` (`^8.23.0` - `node-postgres`):** Driver ufficiale client/pool per la gestione performante e sicura delle connessioni tra Node.js ed Express e il database PostgreSQL.

### 3.3 Variabili d'Ambiente Aggiunte (`server/.env`)
- `DB_HOST=localhost`: Host del server database;
- `DB_PORT=5432`: Porta di ascolto del servizio PostgreSQL;
- `DB_NAME=hermae_db`: Nome della base di dati di progetto;
- `DB_USER=nunziogiglio`: Utente proprietario del database;
- `DB_PASSWORD=`: Password di accesso (vuota su socket/trust locale);
- `DB_POOL_MAX=10`: Dimensione massima del pool di client contemporanei.

---

## 4. Comandi da Terminale Principali Utilizzati

Di seguito l'elenco sequenziale dei comandi da riga di comando eseguiti per l'istanziazione, l'esecuzione DDL e il collaudo della base di dati:

```bash
# 1. Verifica dell'istanza PostgreSQL e del server attivo su porta 5432
/opt/homebrew/bin/psql -h localhost -p 5432 -U nunziogiglio -d postgres -c "SELECT version();"

# 2. Creazione fisica della base di dati applicativa hermae_db
/opt/homebrew/bin/createdb -h localhost -p 5432 -U nunziogiglio hermae_db

# 3. Esecuzione dello script DDL con estensioni, tabelle, vincoli, indici e seed
/opt/homebrew/bin/psql -h localhost -p 5432 -U nunziogiglio -d hermae_db -f INFO-DATABASE/schema.sql

# 4. Ispezione e verifica delle tabelle relazionali create nel database
/opt/homebrew/bin/psql -h localhost -p 5432 -U nunziogiglio -d hermae_db -c "\dt"

# 5. Ispezione degli indici (PK, UNIQUE, GiST spaziali, B-Tree sulle FK)
/opt/homebrew/bin/psql -h localhost -p 5432 -U nunziogiglio -d hermae_db -c "\di"

# 6. Verifica dell'avvenuto popolamento iniziale delle categorie tassonomiche
/opt/homebrew/bin/psql -h localhost -p 5432 -U nunziogiglio -d hermae_db -c "SELECT id, nome, slug FROM categorie;"

# 7. Installazione del driver PostgreSQL nel backend Node.js (dalla cartella server/)
cd server
npm install pg

# 8. Test programmatico di connessione e calcolo della latenza da script Node.js
node -e "const { testConnection, closePool } = require('./src/config/db'); testConnection().then(res => { console.log(res); closePool(); });"

# 9. Test transazionale di integrità (inserimento utente UUID, query distanza geodesica metrica 208m e cleanup)
node -e "const { query, closePool } = require('./src/config/db'); query('SELECT earth_distance(ll_to_earth(40.8518, 14.2681), ll_to_earth(40.8530, 14.2700)) as d;').then(r => console.log('Distanza:', Math.round(r.rows[0].d), 'm')).finally(closePool);"

# 10. Collaudo via HTTP dell'endpoint /health per confermare lo stato CONNECTED del DB
curl -s http://localhost:3000/api/health

# 11. Collaudo via HTTP dell'endpoint diagnostico dedicato /db-status
curl -s http://localhost:3000/api/db-status
```

---

## 5. Repertorio dei Codici e delle Funzioni Implementate

Ciascun file e funzione include un commento sintetico a riga singola che ne descrive la specifica finalità:

| File Sorgente | Funzione / Blocco di Codice | Commento Sintetico (Cosa fa) |
| :--- | :--- | :--- |
| **`INFO-DATABASE/schema.sql`** | `CREATE EXTENSION IF NOT EXISTS ...` | Attiva le estensioni crittografiche (pgcrypto), di indicizzazione (btree_gist) e geospaziali (cube, earthdistance). |
| **`INFO-DATABASE/schema.sql`** | `CREATE TABLE ... (6 tabelle)` | Crea le tabelle relazionali utenti, categorie, esemplari, richieste_prestito, messaggi_chat e metriche_visite con UUID e vincoli di integrità. |
| **`INFO-DATABASE/schema.sql`** | `CREATE INDEX ... USING GIST (...)` | Crea gli indici spaziali ad albero GiST per le ricerche geospaziali di prossimità metrica a raggio urbano. |
| **`INFO-DATABASE/schema.sql`** | `CREATE INDEX ... (B-Tree)` | Crea gli indici B-Tree su tutte le chiavi esterne (UUID) e sui campi frequenti di ricerca e filtro. |
| **`INFO-DATABASE/schema.sql`** | `INSERT INTO categorie ...` | Inserisce le categorie tematiche di base del sistema con clausola ON CONFLICT DO NOTHING. |
| **`server/src/config/db.js`** | `new Pool(...)` | Inizializza il pool di connessioni PostgreSQL utilizzando i parametri configurati nelle variabili d'ambiente. |
| **`server/src/config/db.js`** | `pool.on('error', ...)` | Intercetta e registra gli errori imprevisti generati dai client inattivi all'interno del pool. |
| **`server/src/config/db.js`** | `query(text, params)` | Esegue una query SQL parametrizzata sfruttando un client disponibile nel pool. |
| **`server/src/config/db.js`** | `testConnection()` | Verifica la connettività attiva al database eseguendo una query di heartbeat. |
| **`server/src/config/db.js`** | `closePool()` | Chiude tutti i client attivi nel pool rilasciando le risorse di rete. |
| **`server/src/config/env.js`** | `db: { ... }` | Mappa le variabili d'ambiente DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD e DB_POOL_MAX nell'oggetto di configurazione. |
| **`server/src/routes/index.js`** | `router.get('/health', ...)` | Endpoint di Health Check per verificare lo stato di attività del server e la connettività al database. |
| **`server/src/routes/index.js`** | `router.get('/db-status', ...)` | Endpoint diagnostico dedicato per ispezionare i parametri e le metriche di connessione al database. |
| **`server/server.js`** | `server = app.listen(..., testConnection)` | Avvia il server HTTP in ascolto sulla porta configurata e verifica la connettività al database. |
| **`server/server.js`** | `gracefulShutdown(signal)` | Gestisce la chiusura pulita del server HTTP e del pool di connessioni al database (Graceful Shutdown). |

---

## 6. Esito del Collaudo e Test di Connessione

La fase di istanziazione e connessione è stata collaudata con esito positivo:

### 6.1 Verifica Schema e DDL PostgreSQL
Esecuzione dello script DDL `INFO-DATABASE/schema.sql`:
- **6 tabelle create con successo:** `utenti`, `categorie`, `esemplari`, `richieste_prestito`, `messaggi_chat`, `metriche_visite`;
- **21 indici registrati:** 6 indici PK su UUIDv4, 3 indici UNIQUE (`email`, `nome`, `slug`), 2 indici GiST territoriali (`coordinate_esemplare`, `coordinate_offuscate`), 10 indici B-Tree su FK e parametri di ricerca;
- **Seed tassonomia:** 6 categorie iniziali inserite (`Narrativa & Romanzi`, `Saggistica & Filosofia`, `Informatica & Tecnologia`, `Scienze & Matematica`, `Storia & Biografie`, `Arte & Architettura`).

### 6.2 Test di Connessione Backend (Node.js / Express)
Avvio del backend con rilevamento automatico del database:
```text
====================================================
🚀 HERMAE SERVER avviato con successo!
📍 Endpoint base: http://localhost:3000/api
🩺 Health check: http://localhost:3000/api/health
🌍 Ambiente: development
🗄️  Database connesso: hermae_db (latenza: 15ms)
====================================================
```

### 6.3 Risposta Endpoint `/api/health`
Chiamata HTTP `GET http://localhost:3000/api/health`:
```json
{
  "success": true,
  "data": {
    "service": "Hermae API Gateway",
    "status": "UP",
    "database": {
      "status": "CONNECTED",
      "database": "hermae_db",
      "latencyMs": 2,
      "timestamp": "2026-09-20T17:46:29.644Z"
    },
    "uptime": "6s",
    "timestamp": "2026-09-20T17:46:29.645Z"
  }
}
```

### 6.4 Risposta Endpoint `/api/db-status`
Chiamata HTTP `GET http://localhost:3000/api/db-status`:
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "database": "hermae_db",
    "timestamp": "2026-09-20T17:46:38.937Z",
    "latencyMs": 1,
    "version": "PostgreSQL 14.19 (Homebrew) on aarch64-apple-darwin23.6.0, compiled by Apple clang version 16.0.0 (clang-1600.0.26.6), 64-bit"
  }
}
```

### 6.5 Test di Integrità e Calcolo Geodetico
È stato eseguito un test transazionale di prova con inserimento utente tramite coordinate spaziali e calcolo della distanza metrica:
- Inserimento utente con generazione automatica UUID: `8e26edb0-5c85-495d-97fc-51c2e9cfca7d`;
- Calcolo distanza geodetica reale con funzione `earth_distance`: **208 metri** tra punto reale e punto offuscato;
- Eliminazione pulita del record di test;
- Risorse del pool rilasciate correttamente.
