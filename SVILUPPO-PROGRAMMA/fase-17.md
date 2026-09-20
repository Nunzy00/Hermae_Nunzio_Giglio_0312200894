# Fase 17 — Implementazione delle funzioni di occultamento della geolocalizzazione dell’utente per richiesta esplicita di tutela privacy

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-17.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stata scritta la logica che consente di offuscare la posizione precisa dell’utente (tramite approssimazione ad area/CAP o totale oscuramento) qualora egli attivi le opzioni di tutela della privacy, impedendo il tracciamento diretto da parte di terzi.  
**Difficoltà:** Definire un algoritmo di offuscamento delle coordinate che tutelasse l'anonimato senza azzerare la fruibilità delle ricerche di prossimità.

Nello specifico, l'intervento architetturale ha compreso:
1. **Definizione e Risoluzione della Difficoltà Algoritmica di Offuscamento:**
   Per scongiurare attacchi di inferenza statistica e triangolazione sul domicilio dell'utente senza degradare la fruibilità del book sharing locale, è stato implementato un modello a tre livelli discreti di riservatezza geospaziale:
   - **`QUARTIERE` (Standard, perturbazione $300\text{–}500\text{ m}$):** Micro-offuscamento geodesico casuale uniforme in coordinate polari ($r \in [300, 500]\text{ m}$, $\theta \in [0, 2\pi]$). Maschera il numero civico e il fabbricato di residenza, preservando il matching di prossimità per gli scambi a piedi nel quartiere;
   - **`AREA_CAP` (Macro-Area / CAP / Distretto, perturbazione $1500\text{–}3000\text{ m}$):** Approssimazione geodesica estesa su scala equiparabile all'area di un Codice di Avviamento Postale urbano o di un distretto municipale ($1.5\text{–}3\text{ km}$). Rende matematicamente impossibile identificare l'area di dimora abituale, consentendo al contempo all'utente di partecipare alle ricerche e ai filtri a livello comunale e metropolitano ($5\text{–}25\text{ km}$);
   - **`TOTALE` (Totale Oscuramento Geografico):** Azzeramento rigoroso di qualsiasi coordinata pubblica (`coordinate_offuscate = NULL`). L'utente non genera alcun pin o marker cartografico sulla mappa Leaflet (`mostra_posizione = false`), ma rimane individuabile nelle ricerche testuali aggregate esclusivamente tramite la propria **città di appartenenza** (dato obbligatorio di registrazione), etichettato con la dicitura `"Solo Città"` e senza esposizione di alcuna distanza metrica;
2. **Evoluzione dello Schema Relazionale DDL (`INFO-DATABASE/schema.sql`):**
   - Aggiunta della colonna `modalita_occultamento VARCHAR(20) NOT NULL DEFAULT 'QUARTIERE' CHECK (modalita_occultamento IN ('QUARTIERE', 'AREA_CAP', 'TOTALE'))` alla tabella `preferenze_privacy_utenti`;
   - Rimozione del vincolo `NOT NULL` dal campo `coordinate_offuscate` della tabella `posizione_utenti` (`ALTER TABLE posizione_utenti ALTER COLUMN coordinate_offuscate DROP NOT NULL`), in piena rispondenza al principio di minimizzazione dei dati (Art. 5 GDPR) in caso di totale oscuramento;
3. **Infrastruttura di Backend e Routine Geospaziali (`posizioneUtentiService.js`):**
   - Funzione `calculateCoordinateOccultate(lat, lng, modalitaOccultamento)`: calcolo parametrico del punto offuscato a seconda della modalità selezionata;
   - Funzione `ricalcolaCoordinateUtente(utenteId, modalitaOccultamento)`: sincronizzazione transazionale istantanea del punto georeferenziato su PostgreSQL al mutare delle preferenze di privacy;
   - Adattamento di `upsertPosizione`: recupero automatico della modalità di privacy dell'utente durante il salvataggio o l'aggiornamento manuale delle coordinate;
   - Query geospaziale `findPosizioniVicine(lat, lng, raggioKm, limit, includiSoloCitta)`:
     - Restituisce i marker cartografici per le modalità `QUARTIERE` e `AREA_CAP`;
     - Per gli utenti in modalità `AREA_CAP`, associa l'indicatore di fascia territoriale `'Area/CAP (~2 km)'`;
     - Se `includiSoloCitta = true`, include nei risultati gli utenti con `modalita_occultamento = 'TOTALE'` della stessa città, esponendoli privi di coordinate (`coordinate_offuscate: null`), privi di distanza (`distanza_km: null`) e con fascia `'Solo Città'`;
4. **Sincronizzazione Reattiva nel Servizio Privacy (`preferenzePrivacyService.js`):**
   - Convalida tipizzata del parametro `modalita_occultamento` nei metodi `getPreferenzeByUtenteId` e `upsertPreferenze`;
   - Sincronizzazione automatica tra `modalita_occultamento` e `mostra_posizione` (se l'utente sceglie `TOTALE`, `mostra_posizione` viene forzato a `false`);
   - Invocazione automatica del ricalcolo delle coordinate su `posizione_utenti`;
5. **Controller RESTful (`posizioneUtentiController.js` e `preferenzePrivacyController.js`):**
   - Gestione del parametro `includi_solo_citta` nell'endpoint di prossimità `GET /api/posizioni/prossimita`;
   - Convalida e destrutturazione di `modalita_occultamento` nell'endpoint protetto `PUT /api/privacy/me`;
6. **Interfaccia Grafica Utente (`impostazioni.html` e `ricerca.html`):**
   - In `impostazioni.html`: implementato il selettore visivo a tre opzioni (*Quartiere 300–500m*, *Area / CAP 1.5–3 km*, *Totale Oscuramento*) con card reattive Vue 3, radio input accessibili, badge di stato dinamico e feedback in tempo reale;
   - In `ricerca.html`: aggiornato il rendering dei popup Leaflet con contrassegno semantico differenziato per *Area/CAP* (badge arancione/avviso di approssimazione) rispetto al *Quartiere* (badge verde di confidenzialità). Nella tabella accessibile WCAG 2.1 AA, gli utenti con totale oscuramento figurano con badge `Solo Città` e dicitura esplicita *"Distanza non calcolata"*;
7. **Collaudo Automatizzato Completo (`server/test_fase17.js`):** Suite di test end-to-end con verifica matematica geodesica delle distanze, collaudo degli aggiornamenti API, azzeramento coordinate a NULL e verifica dell'esclusione/inclusione aggregata.

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
INFO-DATABASE/
└── schema.sql                          # [MODIFY] Aggiunta colonna modalita_occultamento e coordinate_offuscate NULLABLE

server/
├── src/
│   ├── controllers/
│   │   ├── posizioneUtentiController.js   # [MODIFY] Aggiunta parametro includi_solo_citta nella ricerca vicinanza
│   │   └── preferenzePrivacyController.js # [MODIFY] Gestione modalita_occultamento in aggiornaMiePreferenze
│   └── services/
│       ├── posizioneUtentiService.js      # [MODIFY] Algoritmi di occultamento (Quartiere, Area/CAP, Totale) e ricalcolo
│       └── preferenzePrivacyService.js    # [MODIFY] Sincronizzazione modalita_occultamento e ricalcolo su posizione_utenti
└── test_fase17.js                      # [NEW] Suite di collaudo automatizzato end-to-end per la Fase 17

hermae-frontend/
├── impostazioni.html                   # [MODIFY] Selettore reattivo Vue 3 della modalità di occultamento (3 livelli)
└── ricerca.html                        # [MODIFY] Gestione indicatori Area/CAP su popup mappa e tabella accessibile
```

---

## 3. Pacchetti, Dipendenze e Risorse Esterne

| Risorsa / Libreria | Versione | Tipologia | Scopo / Ruolo Tecnologico |
| :--- | :---: | :---: | :--- |
| **`PostgreSQL + earthdistance`** | `14+` | RDBMS Geospaziale | Calcolo geodetico della distanza e gestione indici GiST su coordinate perturbate. |
| **`pg` (Node-Postgres)** | `^8.11.3` | Driver Client Node.js | Esecuzione di query parametrizzate asincrone e transazionali. |
| **`Express.js`** | `^4.19.2` | Framework HTTP | Routing RESTful con controller e gestione query parameters. |
| **`Leaflet.js`** | `1.9.4` | Libreria Mappe CDN | Rendering geospaziale con popup personalizzati per il livello di privacy applicato. |
| **`Vue.js 3`** | `3.4.21` | Runtime Frontend via CDN | Binding reattivo del form di privacy e sincronizzazione bidirezionale dei controlli. |
| **`Bootstrap 5`** | `5.3.3` | Framework CSS | Componenti visivi per card radio-button e badge semantici di riservatezza. |

---

## 4. Comandi da Terminale Principali Utilizzati

```bash
# 1. Applicazione migrazione DDL su preferenze_privacy_utenti e posizione_utenti
node -e "
const db = require('./server/src/config/db');
(async () => {
  await db.query(\`
    ALTER TABLE preferenze_privacy_utenti 
    ADD COLUMN IF NOT EXISTS modalita_occultamento VARCHAR(20) NOT NULL DEFAULT 'QUARTIERE' 
    CHECK (modalita_occultamento IN ('QUARTIERE', 'AREA_CAP', 'TOTALE'));
    ALTER TABLE posizione_utenti ALTER COLUMN coordinate_offuscate DROP NOT NULL;
  \`);
  process.exit(0);
})();
"

# 2. Esecuzione della suite di test automatizzati per la Fase 17 (Matematica Blurring, API, DB, Prossimità)
node server/test_fase17.js

# 3. Esecuzione test di regressione per la Fase 16
node server/test_fase16.js
```

---

## 5. Repertorio dei Codici e delle Funzioni Implementate

Ciascun file e funzione include un commento sintetico a riga singola che ne descrive la specifica finalità:

| File Sorgente | Funzione / Blocco di Codice | Commento Sintetico (Cosa fa) |
| :--- | :--- | :--- |
| **`server/src/services/posizioneUtentiService.js`** | `calculateSpatialBlurring(lat, lng, min, max)` | Genera un punto perturbato casuale uniforme in coordinate polari entro il raggio indicato. |
| **`server/src/services/posizioneUtentiService.js`** | `calculateCoordinateOccultate(lat, lng, modalita)` | Seleziona e applica l'algoritmo di occultamento specifico a seconda della modalità scelta. |
| **`server/src/services/posizioneUtentiService.js`** | `ricalcolaCoordinateUtente(utenteId, modalita)` | Ricalcola e aggiorna atomicamente su PostgreSQL le coordinate offuscate dell'utente. |
| **`server/src/services/posizioneUtentiService.js`** | `findPosizioniVicine(lat, lng, raggio, limit, inc)` | Esegue la ricerca spaziale distinguendo tra posizioni su mappa e utenti aggregati per sola città. |
| **`server/src/services/preferenzePrivacyService.js`** | `upsertPreferenze(utenteId, data)` | Persiste le preferenze di privacy e scatena il ricalcolo delle coordinate geospaziali. |
| **`server/src/controllers/preferenzePrivacyController.js`** | `aggiornaMiePreferenze(req, res, next)` | Riceve la richiesta HTTP e delega l'aggiornamento della modalità di occultamento. |
| **`server/src/controllers/posizioneUtentiController.js`** | `getPosizioniVicine(req, res, next)` | Gestisce il parametro opzionale includi_solo_citta per le ricerche geospaziali e testuali. |
| **`hermae-frontend/impostazioni.html`** | `getModalitaBadge(modalita)` | Restituisce la classe stilistica del badge in base alla modalità di occultamento selezionata. |
| **`hermae-frontend/impostazioni.html`** | `getModalitaLabel(modalita)` | Restituisce l'etichetta descrittiva leggibile associata al livello di occultamento attivo. |
| **`hermae-frontend/impostazioni.html`** | `onModalitaOccultamentoChange()` | Sincronizza reattivamente lo stato dello switch di visibilità con il livello di occultamento. |
| **`hermae-frontend/ricerca.html`** | `renderProximityMarkersOnMap()` | Differenzia la dicitura e le icone nei popup Leaflet per gli utenti con offuscamento Area/CAP. |

---

## 6. Esito del Collaudo e Verifica

La suite di test automatizzati [`server/test_fase17.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase17.js) ha convalidato tutte le asserzioni di sistema:

### 6.1 Verifica Matematica degli Algoritmi di Blurring
- **Modalità `QUARTIERE`:** La formula dell'emisenoverso ha riscontrato distanze conformi nell'intervallo $300\text{–}500\text{ m}$;
- **Modalità `AREA_CAP`:** Distanze calcolate rigorosamente nell'intervallo $1500\text{–}3000\text{ m}$ ($1.5\text{–}3.0\text{ km}$);
- **Modalità `TOTALE`:** La funzione ha restituito con certezza il valore `null`, impedendo l'emissione di qualsiasi dato geospaziale.

### 6.2 Test di Attivazione Modalità `AREA_CAP`
- Invocazione `PUT /api/privacy/me` con `{ modalita_occultamento: 'AREA_CAP' }`: risposta `HTTP 200 OK`;
- Ricalcolo automatico confermato su PostgreSQL: le coordinate offuscate di Nunzio sono state ricollocate a circa $2\text{ km}$ dal centro reale;
- Alla ricerca di prossimità condotta da Laura Bianchi entro $15\text{ km}$, Nunzio è risultato regolarmente rintracciabile ed etichettato con la fascia `'Area/CAP (~2 km)'`.

### 6.3 Test di Attivazione Modalità `TOTALE` (Totale Oscuramento)
- Invocazione `PUT /api/privacy/me` con `{ modalita_occultamento: 'TOTALE' }`: risposta `HTTP 200 OK` e `mostra_posizione = false`;
- Azzeramento confermato su PostgreSQL: le coordinate offuscate sono state impostate a `NULL`;
- Nella ricerca su mappa standard, Nunzio è risultato escluso (zero pin cartografici generati);
- Nella ricerca con parametro `includi_solo_citta = true`, Nunzio è comparso nei dati aggregati con `fascia_prossimita = 'Solo Città'`, `coordinate_offuscate = null` e `distanza_km = null`, rispettando la condizione di visibilità aggregata per sola città obbligatoria.

### 6.4 Convalida Ripristino e Regressione
- Esecuzione `DELETE /api/privacy/me`: ripristino istantaneo a `modalita_occultamento = 'QUARTIERE'` e `mostra_posizione = true`;
- Riesecuzione completa della suite `server/test_fase16.js` superata con esito positivo al $100\%$.
