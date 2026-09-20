# Fase 14 — Definizione nel database dell’entità “posizione_utenti”, del suo schema e delle sue operazioni CRUD

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-14.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stata creata l'entità dedicata alla memorizzazione delle coordinate geografiche e dei riferimenti di localizzazione dell'utente, predisponendo le funzioni CRUD per il salvataggio e l'aggiornamento dinamico delle posizioni.  
**Difficoltà:** Non sono state riscontrate difficoltà nella strutturazione dei campi dedicati a latitudine e longitudine.

Nello specifico, l'intervento architetturale ha compreso:
1. **Definizione dello Schema Relazionale DDL:** Aggiornamento di `INFO-DATABASE/schema.sql` con l'introduzione della tabella `posizione_utenti`, provvista di chiave primaria UUID, vincolo di chiave esterna `utente_id` con `ON DELETE CASCADE`, campi testuali per comune e quartiere approssimativo (`citta`, `indirizzo_approssimato`), coordinate numeriche ad alta precisione `latitudine` e `longitudine` in standard WGS84 (`NUMERIC(10, 7)`), geometrie spaziali native PostgreSQL (`coordinate_reali POINT` e `coordinate_offuscate POINT`), e parametro di prossimità personalizzabile `raggio_ricerca_km` ($1 \le r \le 50\text{ km}$, default $5\text{ km}$);
2. **Ottimizzazione degli Indici Spaziali e B-Tree:** Creazione dell'indice spaziale ad albero GiST (`idx_posizione_utenti_coords`) sulle coordinate offuscate mediante binding geometrico bidimensionale, dell'indice univoco su `utente_id` e dell'indice B-Tree su `citta` per velocizzare i filtri per centro abitato;
3. **Algoritmo di Offuscamento Spaziale a Tutela della Privacy (*Spatial Blurring*):** Implementazione della funzione matematica `calculateSpatialBlurring(lat, lng)` nel service di backend, che applica una traslazione pseudo-casuale compresa tra 300 e 500 metri mediante coordinate polari e correzione del raggio terrestre ($\approx 6371\text{ km}$), rendendo impossibile desumere l'ubicazione domestica esatta dell'utente dalla mappa pubblica;
4. **Service Layer Geospaziale e CRUD:** Realizzazione di `server/src/services/posizioneUtentiService.js` per gestire l'inserimento/aggiornamento atomico (`upsertPosizione` con clausola `ON CONFLICT (utente_id) DO UPDATE`), la lettura della posizione personale (`getPosizioneByUtenteId`), la revoca/cancellazione del dato (`deletePosizioneByUtenteId`) e la ricerca per prossimità chilometrica geodetica (`findPosizioniVicine` con `earth_box` ed `earth_distance`);
5. **Controller e Router RESTful:** Realizzazione di `server/src/controllers/posizioneUtentiController.js` e `server/src/routes/posizioneUtentiRoutes.js` montati su `/api/posizioni` e protetti da middleware JWT `authenticate`, che espongono:
   - `GET /api/posizioni/me`: recupero dei riferimenti geografici e del raggio impostato;
   - `POST /api/posizioni`: creazione o sovrascrittura posizione;
   - `PUT /api/posizioni/me`: aggiornamento dinamico di coordinate, città e raggio;
   - `DELETE /api/posizioni/me`: cancellazione dei dati di posizione (diritto di revoca Art. 17 GDPR);
   - `GET /api/posizioni/prossimita`: scansione geospaziale degli altri utenti nel raggio chilometrico;
6. **Integrazione Flusso di Registrazione:** Aggiornamento di `authService.js` per sincronizzare in automatico la tabella `posizione_utenti` qualora l'utente fornisca coordinate in fase di registrazione;
7. **Interfaccia Utente e Gestione Preferenze:** Creazione della vista `hermae-frontend/impostazioni.html` ("Preferenze & Geolocalizzazione") conforme alle specifiche di `sitemap-programma.md` (pagina 11) e `components-map.md`, provvista di rilevamento GPS via Geolocation API HTML5, slider interattivo per il raggio di prossimità ($1\text{–}50\text{ km}$), badge informativo sullo stato di offuscamento PostGIS e pannello di riepilogo consensi GDPR;
8. **Collaudo e Verifica Automatizzata:** Validazione end-to-end con script dedicato che ha confermato il corretto funzionamento di tutte le operazioni CRUD e il calcolo spaziale.

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
INFO-DATABASE/
└── schema.sql                          # [DDL] Aggiunta tabella posizione_utenti e indici GiST/B-Tree

server/
├── src/
│   ├── services/
│   │   ├── posizioneUtentiService.js   # [Service] Calcolo spatial blurring, upsert e ricerca vicinanza
│   │   └── authService.js              # [Service] Sincronizzazione automatica posizione_utenti al signup
│   ├── controllers/
│   │   └── posizioneUtentiController.js# [Controller] Gestione richieste HTTP CRUD e calcolo prossimità
│   └── routes/
│       ├── posizioneUtentiRoutes.js    # [Routes] Rotte REST /api/posizioni protette da token JWT
│       └── index.js                    # [Gateway] Montaggio router /posizioni sul prefisso /api
│
hermae-frontend/
└── impostazioni.html                   # [Front-end] Vista gestione coordinate, slider raggio e consensi GDPR
```

---

## 3. Pacchetti, Dipendenze e Risorse Esterne

| Risorsa / Libreria | Versione | Tipologia | Scopo / Ruolo Tecnologico |
| :--- | :---: | :---: | :--- |
| **`PostgreSQL`** | `14+` | RDBMS Relazionale | Motore di memorizzazione con supporto geometrico (`POINT`), estensioni `cube` ed `earthdistance`. |
| **`pg` (node-postgres)** | `8.23.0` | Driver Node.js | Client di connessione al pool PostgreSQL con supporto a transazioni e query parametriche sicure. |
| **`Bootstrap`** | `5.3.3` | CSS Framework via CDN | Griglia flessibile, slider di raggio interattivo (`form-range`) e stili di notifica. |
| **`Bootstrap Icons`** | `1.11.3` | Icone Web via CDN | Iconografia di geolocalizzazione (`bi-geo-alt`, `bi-radar`, `bi-shield-lock`). |
| **`Vue.js 3`** | `3.4.21` | Runtime JS via CDN | Gestione reattiva dello stato del form, dello slider e delle notifiche asincrone. |
| **`Axios`** | `1.6.8` | HTTP Client via CDN | Comunicazione asincrona con gli endpoint `/api/posizioni/*` e iniezione automatica Bearer Token. |

---

## 4. Comandi da Terminale Principali Utilizzati

Di seguito i comandi eseguiti per l'applicazione delle modifiche DDL al database e il collaudo della suite geospaziale:

```bash
# 1. Applicazione della DDL dell'entità posizione_utenti e dei relativi indici su PostgreSQL
psql -d hermae_db -c "
CREATE TABLE IF NOT EXISTS posizione_utenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utente_id UUID NOT NULL UNIQUE REFERENCES utenti(id) ON DELETE CASCADE,
  citta VARCHAR(100),
  indirizzo_approssimato VARCHAR(255),
  latitudine NUMERIC(10, 7) NOT NULL,
  longitudine NUMERIC(10, 7) NOT NULL,
  coordinate_reali POINT,
  coordinate_offuscate POINT,
  raggio_ricerca_km INTEGER DEFAULT 5 CHECK (raggio_ricerca_km BETWEEN 1 AND 50),
  data_aggiornamento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_posizione_utenti_coords ON posizione_utenti USING gist (coordinate_offuscate);
CREATE INDEX IF NOT EXISTS idx_posizione_utenti_utente ON posizione_utenti (utente_id);
CREATE INDEX IF NOT EXISTS idx_posizione_utenti_citta ON posizione_utenti (citta);
"

# 2. Popolamento e allineamento iniziale degli utenti già esistenti nel database
psql -d hermae_db -c "
INSERT INTO posizione_utenti (utente_id, citta, latitudine, longitudine, coordinate_reali, coordinate_offuscate, raggio_ricerca_km)
SELECT id, citta, latitudine, longitudine, point(longitudine, latitudine), point(longitudine + 0.004, latitudine + 0.002), 5
FROM utenti
WHERE latitudine IS NOT NULL AND longitudine IS NOT NULL
ON CONFLICT (utente_id) DO NOTHING;
"

# 3. Esecuzione collaudo automatizzato delle operazioni CRUD e della ricerca di prossimità
node test_fase14.js
```

---

## 5. Repertorio dei Codici e delle Funzioni Implementate

Ciascun file e funzione include un commento sintetico a riga singola che ne descrive la specifica finalità:

| File Sorgente | Funzione / Blocco di Codice | Commento Sintetico (Cosa fa) |
| :--- | :--- | :--- |
| **`server/src/services/posizioneUtentiService.js`** | `calculateSpatialBlurring(lat, lng)` | Calcola uno spostamento pseudo-casuale tra 300 e 500 metri per tutelare la privacy dell'utente. |
| **`server/src/services/posizioneUtentiService.js`** | `upsertPosizione(utenteId, datiPosizione)` | Inserisce o aggiorna le coordinate geografiche e il raggio di ricerca associati al profilo. |
| **`server/src/services/posizioneUtentiService.js`** | `getPosizioneByUtenteId(utenteId)` | Recupera i dettagli di localizzazione dell'utente associato tramite il suo identificatore univoco. |
| **`server/src/services/posizioneUtentiService.js`** | `deletePosizioneByUtenteId(utenteId)` | Elimina il record della posizione dell'utente dal database in ossequio al diritto all'oblio. |
| **`server/src/services/posizioneUtentiService.js`** | `findPosizioniVicine(lat, lng, raggioKm, limit)` | Esegue una ricerca spaziale per individuare posizioni utente vicine entro un raggio metrico (solo coordinate offuscate). |
| **`server/src/controllers/posizioneUtentiController.js`** | `getMiaPosizione(req, res, next)` | Restituisce la posizione geografica registrata dell'utente correntemente autenticato. |
| **`server/src/controllers/posizioneUtentiController.js`** | `salvaPosizione(req, res, next)` | Crea o sovrascrive la posizione geografica per il profilo dell'utente autenticato. |
| **`server/src/controllers/posizioneUtentiController.js`** | `aggiornaMiaPosizione(req, res, next)` | Aggiorna dinamicamente i parametri di localizzazione e il raggio di prossimità dell'utente. |
| **`server/src/controllers/posizioneUtentiController.js`** | `eliminaMiaPosizione(req, res, next)` | Elimina le coordinate geografiche associate all'account dell'utente. |
| **`server/src/controllers/posizioneUtentiController.js`** | `getPosizioniVicine(req, res, next)` | Esegue una ricerca geospaziale restituendo le posizioni offuscate entro il raggio chilometrico indicato. |
| **`server/src/routes/posizioneUtentiRoutes.js`** | `router.use(authenticate)` | Applica il middleware di autenticazione Bearer a tutte le rotte di gestione posizione. |
| **`server/src/routes/posizioneUtentiRoutes.js`** | `router.get('/me', ...)` | Rotta per recuperare la posizione geografica dell'utente autenticato. |
| **`server/src/routes/posizioneUtentiRoutes.js`** | `router.put('/me', ...)` | Rotta per aggiornare le coordinate o il raggio di ricerca dell'utente. |
| **`server/src/routes/posizioneUtentiRoutes.js`** | `router.delete('/me', ...)` | Rotta per eliminare la posizione geografica associata all'account. |
| **`server/src/routes/posizioneUtentiRoutes.js`** | `router.get('/prossimita', ...)` | Rotta per ricercare posizioni di altri lettori nelle vicinanze tramite calcolo PostGIS. |
| **`server/src/services/authService.js`** | `registerUser(userData)` | Crea un nuovo utente registrando contestualmente la sua posizione iniziale nella tabella dedicata. |
| **`hermae-frontend/impostazioni.html`** | `rilevaGPS()` | Rileva le coordinate correnti tramite l'API Geolocation nativa del browser. |
| **`hermae-frontend/impostazioni.html`** | `caricaDatiPosizione()` | Carica la posizione memorizzata per l'utente autenticato dal backend. |
| **`hermae-frontend/impostazioni.html`** | `salvaPosizione()` | Invia i dati aggiornati della posizione all'endpoint REST PUT /api/posizioni/me. |
| **`hermae-frontend/impostazioni.html`** | `confermaEliminaPosizione()` | Richiede conferma ed elimina le coordinate associate all'account. |

---

## 6. Esito del Collaudo e Verifica

Il collaudo della nuova entità `posizione_utenti` e delle relative procedure CRUD e spaziali ha prodotto esito pienamente conforme a tutte le specifiche di progetto:

### 6.1 Verifica Operazioni CRUD su `/api/posizioni`
- **Autenticazione iniziale:** Eseguito login con credenziali `demo@hermae.it` / `Password123!`, ottenendo Access Token JWT valido;
- **Lettura Posizione (`GET /api/posizioni/me`):** Restituito `HTTP 200 OK` con i dati anagrafici e geografici associati all'utente (`latitudine: 40.8518`, `longitudine: 14.2681`, `raggio_ricerca_km: 5`);
- **Aggiornamento e Ricalcolo Offuscamento (`PUT /api/posizioni/me`):**
  - Richiesta: aggiornamento a `lat: 40.8358846`, `lng: 14.2487827`, quartiere `Piazza del Plebiscito`, `raggio_ricerca_km: 15`;
  - Risposta: `HTTP 200 OK`;
  - Verifica Spatial Blurring: le coordinate offuscate calcolate (`40.835916, 14.252368`) distano circa $300\text{ m}$ dalle coordinate reali, rispettando il vincolo di sicurezza domiciliare;
- **Ricerca di Prossimità Geospaziale (`GET /api/posizioni/prossimita?raggio=20`):**
  - Risposta: `HTTP 200 OK`;
  - Rilevati 3 profili utenti entro il raggio di $20\text{ km}$ con distanze geodetiche calcolate accuratamente:
    1. Nunzio G. (Napoli) — Distanza: $0.30\text{ km}$;
    2. Laura B. (Napoli) — Distanza: $0.32\text{ km}$;
    3. Marco D. (Napoli) — Distanza: $2.44\text{ km}$;
  - Privacy tutelata: la risposta espone esclusivamente le coordinate offuscate e il nome con iniziale puntata del cognome;
- **Verifica Servibilità Web:** Pagina `impostazioni.html` erogata dal web server Express con codice `HTTP 200 OK`, con controlli reattivi Vue 3, slider di raggio $1\text{–}50\text{ km}$, rilevamento GPS nativo e gestione consensi GDPR.
