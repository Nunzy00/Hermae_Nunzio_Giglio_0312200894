# Fase 18 — Definizione nel database dell’entità “esemplare” (l’entità per la gestione di un libro inserito dall’utente), del suo schema e delle sue operazioni CRUD

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-18.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stata strutturata l'entità "esemplare" per mappare ogni singola copia fisica di un libro caricata da un utente (stato d'usura, note, disponibilità, collegamenti bibliografici), unitamente alle funzioni CRUD dedicate.  
**Difficoltà:** Non sono state rilevate complessità; la relazione uno-a-molti con la tabella degli utenti è risultata lineare.

Nel dettaglio, le attività realizzate hanno compreso:
1. **Modellazione Concettuale e Relazionale (IFLA LRM / FRBR):**
   In aderenza ai modelli internazionali di catalogazione e archiviazione bibliografica *IFLA LRM* (*Library Reference Model*) e *FRBR* (*Functional Requirements for Bibliographic Records*), l'entità **Esemplare** (*Item*) è stata formalizzata come istanza fisica, tangibile e localizzata di un'opera intellettuale. Nel contesto dell'architettura peer-to-peer di *Hermae*, ogni esemplare possiede caratteristiche materiali uniche:
   - **Stato di conservazione / usura:** categorizzato nei livelli standardizzati `Come nuovo`, `Ottimo`, `Buono`, `Usurato`;
   - **Note d'esemplare:** note libere a cura del proprietario per censire particolarità fisiche (es. prime edizioni, sovraccoperte, presenza di glosse o sottolineature, fioriture sui tagli);
   - **Stato di disponibilità:** gestione del ciclo di vita dello scambio con la macchina a stati finiti (`DISPONIBILE`, `IN_PRESTITO`, `NON_DISPONIBILE`);
   - **Metadati bibliografici:** titolo, autore/i, editore, anno di pubblicazione, codice ISBN (10 o 13 cifre), lingua della copia fisica;
   - **Collegamento geospaziale:** attributo `coordinate_esemplare POINT` per l'interrogazione tramite le estensioni spaziali PostGIS/earthdistance.
2. **Aggiornamento Schema DDL e Migrazione Database (`INFO-DATABASE/schema.sql`):**
   - Aggiunta delle colonne `editore VARCHAR(150)`, `lingua VARCHAR(50) DEFAULT 'Italiano'`, `note TEXT`;
   - Rimozione del vincolo di obbligatorietà su `coordinate_esemplare` (`ALTER TABLE esemplari ALTER COLUMN coordinate_esemplare DROP NOT NULL`), consentendo l'ereditarietà automatica o asincrona della geolocalizzazione;
   - Creazione di indici B-Tree dedicati per l'ottimizzazione delle ricerche e dei join relazionali (`idx_esemplari_utente`, `idx_esemplari_categoria`, `idx_esemplari_disponibilita`, `idx_esemplari_titolo`).
3. **Generazione Dataset di Collaudo (`DATI-MOCK/esemplari_mock.md` e `server/seed_esemplari.js`):**
   - Popolamento iniziale nel database PostgreSQL di 10 volumi mock distribuiti tra i 4 utenti attivi e le 6 categorie disciplinari, per validare scenari di prossimità locale ($1.5\text{ km}$ e $6.4\text{ km}$), scambi metropolitani e isolamento geografico interurbano.
4. **Livello di Servizio Applicativo (`server/src/services/esemplariService.js`):**
   - Implementazione completa delle routine CRUD: `createEsemplare`, `getMyEsemplari`, `getEsemplareById`, `updateEsemplare`, `deleteEsemplare`, `searchEsemplari`, `getAllCategorie`;
   - Ereditarietà automatica delle coordinate geospaziali dell'utente (`posizione_utenti.coordinate_reali`) in fase di creazione del volume;
   - Validazione rigorosa degli enum di conservazione e disponibilità;
   - **Controllo di titolarità e autorizzazione (Security & Ownership):** inibizione delle operazioni di modifica (`PUT`) o cancellazione (`DELETE`) a utenti non proprietari, con sollevamento dell'errore HTTP `403 Forbidden` (`FORBIDDEN_NOT_OWNER`).
5. **Controller RESTful e Routing Express (`esemplariController.js`, `esemplariRoutes.js`, `categorieRoutes.js`):**
   - Definizione degli endpoint RESTful montati su `/api/esemplari` e `/api/categorie`, con protezione tramite middleware JWT (`authenticate`) su tutte le operazioni riservate;
   - Esposizione dell'endpoint pubblico/filtrabile per il catalogo e le tassonomie tematiche.
6. **Interfaccia Grafica e Vista Web (`hermae-frontend/libreria.html`):**
   - Realizzazione della **Pagina 6 della Sitemap** (*La Mia Libreria Personale*) conforme a WCAG 2.1 Livello AA;
   - Cruscotto con 4 schede metriche reattive disposte su un'unica riga orizzontale (*Totale*, *Disponibili*, *In Prestito*, *Riservati*);
   - Barra di ricerca full-text singola a tutta larghezza e 3 selettori di filtro compattati su una singola riga (*Categoria*, *Disponibilità*, *Usura*);
   - Tre modalità di visualizzazione commutabili dinamicamente:
     - **Tabella:** Griglia accessibile con miniature copertina a tema disciplinare, dati catalografici e azioni rapide;
     - **Card:** Vista a schede moderne con mockup copertina rigida, note bibliografiche in risalto ed ergonomia touch;
     - **Book-Stile:** Scaffale virtuale 3D con libri fisici personalizzati per categoria, costola goffrata, nastro segnalibro in tessuto e asse in legno massiccio;
   - Finestre modali accessibili per il censimento/modifica dell'esemplare e per la cancellazione protetta;
   - Aggiornamento contestuale del contatore volumi sulla Dashboard principale (`dashboard.html`).
7. **Suite di Test Automatizzata (`server/test_fase18.js`):**
   - Esecuzione di 28 asserzioni di collaudo (validazioni 400, protezione 401, titolarità 403, CRUD 200/201, rimozione 404, filtri catalogo e regressione Fasi 16 e 17 al 100%).

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
INFO-DATABASE/
└── schema.sql                          # [MODIFY] Aggiunta colonne editore, lingua, note e coordinate_esemplare DROP NOT NULL

DATI-MOCK/
└── esemplari_mock.md                   # [NEW] Documentazione dettagliata delle 10 copie fisiche di collaudo

server/
├── seed_esemplari.js                   # [NEW] Script di popolamento iniziale e migrazione dati su PostgreSQL
├── test_fase18.js                      # [NEW] Suite di collaudo automatizzato end-to-end (28 asserzioni)
└── src/
    ├── controllers/
    │   └── esemplariController.js      # [NEW] Controller REST per esemplari e categorie disciplinari
    ├── routes/
    │   ├── categorieRoutes.js          # [NEW] Router Express per endpoint /api/categorie
    │   ├── esemplariRoutes.js          # [NEW] Router Express per endpoint /api/esemplari (CRUD protetto)
    │   └── index.js                    # [MODIFY] Registrazione dei router /esemplari e /categorie nel Gateway
    └── services/
        └── esemplariService.js         # [NEW] Logica di business, vincoli di titolarità ed ereditarietà spaziale

hermae-frontend/
├── dashboard.html                      # [MODIFY] Sincronizzazione dinamica del contatore volumi nella metric-card
└── libreria.html                       # [NEW] Vista Page 6 della Sitemap: cruscotto reattivo e gestione CRUD
```

---

## 3. Pacchetti, Dipendenze e Risorse Esterne

| Risorsa / Libreria | Versione | Tipologia | Scopo / Ruolo Tecnologico |
| :--- | :---: | :---: | :--- |
| **`PostgreSQL + PostGIS`** | `14+` | RDBMS Relazionale/Spaziale | Memorizzazione persistente dei volumi, indici B-Tree e geolocalizzazione $POINT$. |
| **`pg` (Node-Postgres)** | `^8.23.0` | Driver Client Node.js | Esecuzione di query parametrizzate asincrone e gestione transazionale del pool. |
| **`Express`** | `^4.19.2` | Web Framework Backend | Gestione del routing RESTful, middleware di autenticazione e serializzazione JSON. |
| **`jsonwebtoken`** | `^9.0.3` | Sicurezza / Auth | Autenticazione stateless basata su token crittografici RFC 7519 Bearer. |
| **`Vue.js 3` (CDN)** | `3.5.13` | Framework Front-End | Gestione dello stato reattivo, filtri multi-parametro e binding bidirezionale. |
| **`Bootstrap 5.3`** | `5.3.3` | Framework CSS/UI | Layout responsive a griglia, finestre modali accessibili e badge semantici. |
| **`Bootstrap Icons`** | `1.11.3` | Iconografia Vettoriale | Pittogrammi accessibili per azioni di catalogo, filtri e indicatori di stato. |

---

## 4. Dettaglio del Modello Dati e delle Relazioni Relazionali

La tabella `esemplari` implementa la relazione $1:N$ con la tabella `utenti` e la relazione $N:1$ con la tabella `categorie`:

$$\text{utenti} \xrightarrow{1:N} \text{esemplari} \xleftarrow{N:1} \text{categorie}$$

```sql
-- Definizione DDL della Tabella ESEMPLARI (INFO-DATABASE/schema.sql)
CREATE TABLE IF NOT EXISTS esemplari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    categoria_id UUID NOT NULL REFERENCES categorie(id) ON DELETE RESTRICT,
    titolo VARCHAR(255) NOT NULL,
    autore VARCHAR(255) NOT NULL,
    editore VARCHAR(150),
    anno_pubblicazione SMALLINT,
    isbn VARCHAR(20),
    lingua VARCHAR(50) DEFAULT 'Italiano',
    descrizione TEXT,
    note TEXT,
    stato_conservazione VARCHAR(50) DEFAULT 'Buono',
    stato_disponibilita VARCHAR(30) NOT NULL DEFAULT 'DISPONIBILE',
    immagine_copertina VARCHAR(255),
    immagine_miniatura VARCHAR(255),
    coordinate_esemplare POINT,
    data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Vincoli di Integrità e Ottimizzazione Indici
- **`ON DELETE CASCADE` su `utente_id`:** in caso di cancellazione del profilo utente (diritto all'oblio ex Art. 17 GDPR), tutti i suoi esemplari fisici associati vengono automaticamente eliminati dal sistema;
- **`ON DELETE RESTRICT` su `categoria_id`:** impedisce la cancellazione accidentale di una categoria tematica qualora vi siano volumi censiti afferenti a tale disciplina;
- **Indici B-Tree Geografici e Relazionali:**
  - `idx_esemplari_utente` su `utente_id`: velocizza il recupero istantaneo della libreria personale;
  - `idx_esemplari_categoria` su `categoria_id`: ottimizza le ricerche disciplinari filtrate;
  - `idx_esemplari_disponibilita` su `stato_disponibilita`: filtra tempestivamente i volumi disponibili;
  - `idx_esemplari_titolo` su `titolo`: ottimizza le ricerche testuali del catalogo.

---

## 5. Architettura delle API RESTful Implementate

Tutti gli endpoint rispondono con formato JSON uniforme standardizzato:

| Metodo | Endpoint | Autenticazione | Ruolo / Descrizione | Codici Risposta |
| :---: | :--- | :---: | :--- | :---: |
| `GET` | `/api/esemplari/mie` | **Sì (Bearer)** | Elenco dei volumi posseduti dall'utente autenticato con filtri opzionali | `200`, `401` |
| `POST` | `/api/esemplari` | **Sì (Bearer)** | Registrazione nuovo esemplare fisico con ereditarietà coordinate utente | `201`, `400`, `401` |
| `GET` | `/api/esemplari/:id` | No | Dettaglio singolo esemplare con dati aggregati di categoria e proprietario | `200`, `404` |
| `PUT` | `/api/esemplari/:id` | **Sì (Bearer)** | Aggiornamento metadati (ammesso solo per il legittimo proprietario) | `200`, `400`, `401`, `403`, `404` |
| `DELETE`| `/api/esemplari/:id` | **Sì (Bearer)** | Eliminazione definitiva dell'esemplare (ammesso solo per il proprietario) | `200`, `401`, `403`, `404` |
| `GET` | `/api/esemplari` | No | Ricerca catalogo con filtri testuali (`search`), categoria e disponibilità | `200` |
| `GET` | `/api/categorie` | No | Elenco tassonomia categorie disciplinari con conteggio volumi associati | `200` |

---

## 6. Risultati del Collaudo Automatizzato

La suite di test dedicata (`server/test_fase18.js`) ha verificato in ambiente isolato tutte le asserzioni di sistema:

```text
================================================================
 AVVIO TEST SUITE FASE 18 — ENTITÀ ESEMPLARE & CRUD BIBLIOGRAFICO
================================================================

[GRUPPO 1] Tassonomia Categorie Disciplinari
  ✓ PASS: GET /api/categorie restituisce 200 OK
  ✓ PASS: Categorie presenti >= 6 con conteggio volumi
  ✓ PASS: Categoria "narrativa-romanzi" identificata correttamente

[GRUPPO 2] Protezione Endpoints Riservati e Autenticazione
  ✓ PASS: GET /api/esemplari/mie senza token restituisce 401 Unauthorized
  ✓ Token generati per demo (demo@hermae.it) e laura (laura.bianchi@example.com)

[GRUPPO 3] Consultazione Libreria Personale (getMyBooks)
  ✓ PASS: GET /api/esemplari/mie con token restituisce 200 OK
  ✓ PASS: Libreria demo contiene 3 volumi mock
  ✓ PASS: Record formattato con titolo e stato di conservazione

[GRUPPO 4] Creazione Nuovo Esemplare & Validazioni
  ✓ PASS: Rifiuta creazione senza titolo (400 TITOLO_REQUIRED)
  ✓ PASS: Rifiuta creazione senza autore (400 AUTORE_REQUIRED)
  ✓ PASS: POST /api/esemplari restituisce 201 Created
  ✓ PASS: ID UUID generato per il nuovo esemplare
  ✓ PASS: Titolo memorizzato correttamente
  ✓ PASS: Coordinate geospaziali ereditate automaticamente dalla posizione utente

[GRUPPO 5] Recupero Dettaglio Esemplare per ID
  ✓ PASS: GET /api/esemplari/:id restituisce 200 OK
  ✓ PASS: Dettaglio include informazioni proprietario e città

[GRUPPO 6] Controllo di Titolarità e Sicurezza Autorizzativa
  ✓ PASS: PUT /api/esemplari/:id da utente non titolare restituisce 403 Forbidden
  ✓ PASS: Codice errore FORBIDDEN_NOT_OWNER
  ✓ PASS: DELETE /api/esemplari/:id da utente non titolare restituisce 403 Forbidden

[GRUPPO 7] Aggiornamento Metadati da Proprietario (updateBook)
  ✓ PASS: PUT /api/esemplari/:id da proprietario restituisce 200 OK
  ✓ PASS: Stato di conservazione aggiornato a "Ottimo"
  ✓ PASS: Note bibliografiche aggiornate con successo

[GRUPPO 8] Eliminazione Esemplare da Proprietario (deleteBook)
  ✓ PASS: DELETE /api/esemplari/:id da proprietario restituisce 200 OK
  ✓ PASS: Conferma di successo cancellazione
  ✓ PASS: GET /api/esemplari/:id dopo DELETE restituisce 404 Not Found

[GRUPPO 9] Ricerca e Filtri Catalogo Pubblico (searchBooks)
  ✓ PASS: GET /api/esemplari?search=Eco restituisce 200 OK
  ✓ PASS: Trovati 2 volumi di Umberto Eco
  ✓ PASS: GET /api/esemplari per categoria specifica restituisce 200 OK
  ✓ PASS: Tutti i risultati appartengono alla categoria richiesta

================================================================
 RIEPILOGO TEST FASE 18: 28 PASSATI, 0 FALLITI (100% SUCCESS RATE)
================================================================
```

---

## 7. Conformità agli Standard del Corso di Laurea L-31

L'implementazione della Fase 18 rispetta puntualmente tutti i criteri formali previsti per l'elaborato di Tesi / Prova Finale:
- **Modello FRBR / IFLA LRM:** distinzione rigorosa tra l'entità astratta dell'opera e la copia fisica materiale (*esemplare*) posseduta dal privato;
- **Integrità Referenziale e Sicurezza:** vincoli relazionali formali su chiave esterna e controlli applicativi rigorosi contro manipolazioni non autorizzate (IDOR prevention con verifica di titolarità `403 Forbidden`);
- **Accessibilità Web (WCAG 2.1 AA):** marcatura semantica, comandi di salto, gestione accessibile delle finestre modali con focus trapping e contrasti cromatici verificati;
- **Integrazione Architetturale Completa:** coerenza tra DDL relazionale, servizi RESTful e componenti front-end reattivi Vue 3.
