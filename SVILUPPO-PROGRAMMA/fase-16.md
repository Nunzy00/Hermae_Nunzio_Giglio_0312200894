# Fase 16 — Definizione nel database dell’entità “preferenze_privacy_utenti”, del suo schema e delle sue operazioni CRUD

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-16.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stata definita la struttura dati che accoglie le impostazioni di riservatezza dell’utente, memorizzando flag di visibilità e permessi per l’esposizione della posizione e del profilo, affiancata dalle relative routine CRUD.  
**Difficoltà:** Non sono state riscontrate difficoltà nella definizione dei vincoli predefiniti orientati alla tutela della privacy (Privacy by Default).

Nello specifico, l'intervento architetturale ha compreso:
1. **Definizione dello Schema Relazionale DDL (`INFO-DATABASE/schema.sql`):** Creazione della tabella `preferenze_privacy_utenti` su PostgreSQL (`hermae_db`) con chiave primaria UUID, vincolo di integrità referenziale `ON DELETE CASCADE` verso `utenti(id)`, vincolo di unicità `UNIQUE (utente_id)` per garantire una relazione stretta $1:1$ e indice B-Tree `idx_preferenze_privacy_utente`;
2. **Attuazione dei Principi di *Privacy by Default* e *Privacy by Design* (Art. 25 GDPR):**
   - `mostra_email DEFAULT FALSE`: l'indirizzo email dell'utente non viene mai divulgato pubblicamente agli altri membri della piattaforma (la mediazione avviene esclusivamente tramite la chat interna peer-to-peer);
   - `profilo_pubblico DEFAULT FALSE`: il profilo anagrafico completo rimane riservato per impostazione predefinita;
   - `mostra_posizione DEFAULT TRUE`: abilita la partecipazione al matching librario georeferenziato (con coordinate offuscate di 300–500m), disattivabile a discrezione dell'utente in qualunque momento;
   - `mostra_libreria DEFAULT TRUE`: rende visibili i titoli della collezione libraria agli altri utenti della comunità;
   - `raggio_visibilita_km DEFAULT 10`: raggio chilometrico di visibilità predefinito entro cui rendersi rintracciabili per gli scambi;
   - `consenti_messaggi_diretti DEFAULT TRUE`: consente la ricezione di richieste di contatto e scambio per i volumi condivisi;
3. **Livello di Servizio Backend (`server/src/services/preferenzePrivacyService.js`):** Implementazione delle query parametrizzate SQL native a protezione da SQL Injection per le operazioni CRUD:
   - `getPreferenzeByUtenteId(utenteId)`: lettura impostazioni o inizializzazione automatica con i valori di default GDPR qualora non ancora persistite;
   - `upsertPreferenze(utenteId, data)`: salvataggio o aggiornamento atomico tramite costrutto `INSERT ... ON CONFLICT (utente_id) DO UPDATE`;
   - `resetPreferenzeDefault(utenteId)`: ripristino istantaneo di tutte le impostazioni ai vincoli di tutela massima garantiti dal regolamento europeo;
   - `deletePreferenzeByUtenteId(utenteId)`: rimozione del record (gestito anche a livello relazionale tramite cascade);
4. **Controller e Protezione Endpoint RESTful (`preferenzePrivacyController.js` e `preferenzePrivacyRoutes.js`):**
   - Esposizione degli endpoint `/api/privacy/me` protetti dal middleware `authenticate` (JWT bearer token):
     - `GET /api/privacy/me`: restituisce le impostazioni dell'utente autenticato;
     - `PUT /api/privacy/me`: aggiorna in modo granulare i flag di visibilità e il raggio chilometrico;
     - `DELETE /api/privacy/me`: reimposta le preferenze ai valori predefiniti GDPR;
   - Registrazione del router nel dispatcher principale `server/src/routes/index.js`;
5. **Integrazione Geospaziale *Privacy by Design* (`posizioneUtentiService.js`):**
   - Modifica della query spaziale `findPosizioniVicine` tramite `LEFT JOIN preferenze_privacy_utenti ppu ON p.utente_id = ppu.utente_id` con clausola restrittiva `AND COALESCE(ppu.mostra_posizione, TRUE) = TRUE`. L'utente che revoca la visibilità della posizione viene escluso immediatamente e a monte dalle ricerche cartografiche degli altri utenti;
6. **Interfaccia Grafica Utente (`hermae-frontend/impostazioni.html`):**
   - Implementazione del pannello dedicato *"Preferenze di Riservatezza & Visibilità Profilo"* conforme a WCAG 2.1 AA;
   - Controlli reattivi Vue 3 (`form-check-input` switch) per l'attivazione/disattivazione dei singoli flag di visibilità; in particolare, per la visibilità sulla mappa viene chiarito che, essendo la città un dato obbligatorio della piattaforma, la disattivazione esclude l'utente dalla mappa cartografica e dal calcolo della distanza metrica precisa, mantenendolo individuabile solo tramite l'indicazione della sua città;
   - Slider numerico per la regolazione dinamica del raggio di visibilità ($1\text{–}50\text{ km}$);
   - Pulsante di salvataggio esplicito e pulsante di ripristino rapido *"Ripristina Privacy by Default"* per la massima trasparenza verso l'utente;
7. **Collaudo Automatizzato Completo (`server/test_fase16.js`):** Creazione ed esecuzione della suite di test end-to-end che convalida l'isolamento JWT, le operazioni CRUD e l'oscuramento automatico dalle ricerche di vicinanza.

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
INFO-DATABASE/
└── schema.sql                          # [MODIFY] Definizione DDL tabella preferenze_privacy_utenti e relativo indice

server/
├── src/
│   ├── controllers/
│   │   └── preferenzePrivacyController.js # [NEW] Controller REST per la gestione delle preferenze di riservatezza
│   ├── routes/
│   │   ├── index.js                    # [MODIFY] Registrazione del router /api/privacy
│   │   └── preferenzePrivacyRoutes.js  # [NEW] Definizione endpoint protetti GET, PUT, DELETE /me
│   └── services/
│       ├── preferenzePrivacyService.js # [NEW] Routine CRUD e gestione Privacy by Default per il database
│       └── posizioneUtentiService.js   # [MODIFY] Integrazione filtro spaziale Privacy by Design (mostra_posizione)
└── test_fase16.js                      # [NEW] Suite di test automatizzati per le routine di privacy

hermae-frontend/
└── impostazioni.html                   # [MODIFY] Sezione UI reattiva Vue 3 per la gestione della privacy utente
```

---

## 3. Pacchetti, Dipendenze e Risorse Esterne

| Risorsa / Libreria | Versione | Tipologia | Scopo / Ruolo Tecnologico |
| :--- | :---: | :---: | :--- |
| **`PostgreSQL`** | `14+` | RDBMS Relazionale | Archiviazione persistente con integrità referenziale, vincoli di unicità e indici B-Tree. |
| **`pg` (Node-Postgres)** | `^8.11.3` | Driver Client Node.js | Esecuzione di query parametrizzate asincrone e transazionali verso il database PostgreSQL. |
| **`Express.js`** | `^4.19.2` | Framework HTTP | Routing RESTful, gestione middleware di autenticazione e controller di risposta JSON. |
| **`jsonwebtoken (JWT)`** | `^9.0.2` | Autenticazione Stateless | Validazione dell'identità dell'utente sul payload decodificato (`req.user.id`). |
| **`Vue.js 3`** | `3.4.21` | Runtime Frontend via CDN | Binding bidirezionale dello stato delle preferenze (`v-model`) e gestione asincrona delle chiamate API. |
| **`Bootstrap 5`** | `5.3.3` | Framework CSS | Interruttori accessibili (`form-switch`) e componenti per form reattivi con feedback visivo. |

---

## 4. Comandi da Terminale Principali Utilizzati

```bash
# 1. Applicazione della migrazione DDL su database PostgreSQL hermae_db
psql -U postgres -d hermae_db -c "
CREATE TABLE IF NOT EXISTS preferenze_privacy_utenti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id UUID NOT NULL UNIQUE REFERENCES utenti(id) ON DELETE CASCADE,
    profilo_pubblico BOOLEAN NOT NULL DEFAULT FALSE,
    mostra_posizione BOOLEAN NOT NULL DEFAULT TRUE,
    mostra_libreria BOOLEAN NOT NULL DEFAULT TRUE,
    mostra_email BOOLEAN NOT NULL DEFAULT FALSE,
    raggio_visibilita_km INTEGER NOT NULL DEFAULT 10,
    consenti_messaggi_diretti BOOLEAN NOT NULL DEFAULT TRUE,
    data_aggiornamento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_preferenze_privacy_utente ON preferenze_privacy_utenti(utente_id);
"

# 2. Esecuzione della suite di test automatizzati per la Fase 16 (Auth, CRUD, Geospatial Isolation, Reset)
node server/test_fase16.js
```

---

## 5. Repertorio dei Codici e delle Funzioni Implementate

Ciascun file e funzione include un commento sintetico a riga singola che ne descrive la specifica finalità:

| File Sorgente | Funzione / Blocco di Codice | Commento Sintetico (Cosa fa) |
| :--- | :--- | :--- |
| **`server/src/services/preferenzePrivacyService.js`** | `getPreferenzeByUtenteId(utenteId)` | Recupera le preferenze di riservatezza dell'utente o genera i valori di default GDPR se assenti. |
| **`server/src/services/preferenzePrivacyService.js`** | `upsertPreferenze(utenteId, data)` | Inserisce o aggiorna atomicamente le preferenze di privacy dell'utente tramite clausola ON CONFLICT. |
| **`server/src/services/preferenzePrivacyService.js`** | `resetPreferenzeDefault(utenteId)` | Ripristina istantaneamente le impostazioni dell'utente ai parametri di tutela Privacy by Default. |
| **`server/src/services/preferenzePrivacyService.js`** | `deletePreferenzeByUtenteId(utenteId)` | Elimina fisicamente il record delle preferenze di privacy associato all'identificativo utente. |
| **`server/src/controllers/preferenzePrivacyController.js`** | `getMiePreferenze(req, res, next)` | Eroga le impostazioni di privacy dell'utente correntemente autenticato tramite token JWT. |
| **`server/src/controllers/preferenzePrivacyController.js`** | `aggiornaMiePreferenze(req, res, next)` | Convalida il payload HTTP e invoca l'upsert dei nuovi parametri di riservatezza dell'utente. |
| **`server/src/controllers/preferenzePrivacyController.js`** | `resetMiePreferenze(req, res, next)` | Gestisce la richiesta di ripristino dei parametri di default GDPR per l'utente loggato. |
| **`server/src/routes/preferenzePrivacyRoutes.js`** | `Router HTTP /me` | Configura gli endpoint protetti GET, PUT e DELETE /me applicando il middleware JWT authenticate. |
| **`server/src/services/posizioneUtentiService.js`** | `findPosizioniVicine(lat, lng, ...)` | Integra il filtro LEFT JOIN con preferenze_privacy_utenti per escludere profili con visibilità disattivata. |
| **`hermae-frontend/impostazioni.html`** | `caricaPreferenzePrivacy()` | Interroga le API RESTful per sincronizzare le impostazioni di privacy con i controlli Vue del form. |
| **`hermae-frontend/impostazioni.html`** | `salvaPreferenzePrivacy()` | Invia al backend i parametri di privacy modificati dall'utente mostrando un alert accessibile. |
| **`hermae-frontend/impostazioni.html`** | `ripristinaPrivacyDefault()` | Ripristina i valori predefiniti GDPR sul server e aggiorna reattivamente gli switch a video. |

---

## 6. Esito del Collaudo e Verifica

La suite di collaudo automatizzato [`server/test_fase16.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase16.js) ha verificato con esito positivo tutte le asserzioni di sistema:

### 6.1 Autenticazione e Sicurezza degli Endpoint
- Accesso agli endpoint `/api/privacy/me` rigorosamente inibito in assenza di Bearer Token (`HTTP 401 Unauthorized`);
- Autenticazione riuscita con utente di test `demo@hermae.it` e ricezione del JWT token.

### 6.2 Operazioni CRUD e Persistenza su PostgreSQL
- **Lettura (`GET /api/privacy/me`):** Restituzione corretta del record con valori predefiniti GDPR conformi;
- **Aggiornamento (`PUT /api/privacy/me`):** Modifica con successo di `mostra_posizione = false` e `raggio_visibilita_km = 25`, con aggiornamento automatico del timestamp `data_aggiornamento`.

### 6.3 Convalida *Privacy by Design* su Ricerca Geospaziale
- Con `mostra_posizione = false`, l'interrogazione dell'endpoint `/api/posizioni/prossimita` esclude categoricamente l'utente dalla mappa pubblica dei lettori vicini;
- Con la riattivazione a `mostra_posizione = true`, il profilo dell'utente ricompare immediatamente nel raggio di prossimità calcolato tramite la formula geodetica.

### 6.4 Convalida Ripristino *Privacy by Default*
- Invocazione dell'endpoint `DELETE /api/privacy/me` per il reset ai valori di fabbrica GDPR (`mostra_email = false`, `profilo_pubblico = false`, `raggio_visibilita_km = 10`);
- Conferma dell'avvenuto allineamento dei dati nel database.
