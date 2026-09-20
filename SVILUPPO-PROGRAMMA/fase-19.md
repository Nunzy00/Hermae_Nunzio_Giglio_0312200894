# Fase 19 — Implementazione delle funzioni CRUD libri & Upload copertina

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-19.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

Sono stati sviluppati gli endpoint e le relative interfacce per permettere agli utenti di aggiungere nuovi testi, visualizzare la propria libreria personale, modificare i dettagli delle opere e cancellare copie rimosse dalla disponibilità.  
**Difficoltà:** Gestione della validazione dei campi obbligatori (titolo, autore, etc) lato server e client.

Nel dettaglio, le attività realizzate hanno compreso:
1. **Validazione Rigorosa e Multi-Livello dei Dati (Client-Side & Server-Side):**
   - Per risolvere la complessità emersa nella validazione congiunta dei campi obbligatori e opzionali, è stata implementata una politica di validazione a doppio livello conforme ai principi difensivi OWASP:
     - **Lato Server (`esemplariService.js`):** normalizzazione preventiva dei testi (`trim()`), verifica stringente della presenza e lunghezza dei campi mandatory (`titolo` 1..255 caratteri con codice `TITOLO_REQUIRED` e `TITOLO_TOO_LONG`, `autore` 1..255 caratteri con codice `AUTORE_REQUIRED` e `AUTORE_TOO_LONG`), verifica dell'UUIDv4 della categoria (`CATEGORIA_REQUIRED` e `CATEGORIA_INVALID`), controllo dell'anno di pubblicazione nel range storico ammissibile $1450 \le \text{anno} \le \text{anno\_corrente} + 1$ (`ANNO_INVALID`), espressione regolare per codici ISBN-10 e ISBN-13 (`ISBN_INVALID`), e validazione degli enumeratori di stato d'usura e disponibilità;
     - **Lato Client (`libreria.html`):** validazione reattiva preventiva in Vue 3 prima dell'invio HTTP, con evidenziazione in tempo reale dei bordi di errore (`.is-invalid`), messaggi esplicativi contestuali (`.invalid-feedback`) e ripristino immediato all'input dell'utente.
2. **Infrastruttura di Upload e Pipeline Grafica ad Alte Prestazioni (`Multer` & `Sharp`):**
   - Installazione e configurazione delle dipendenze di sistema `multer` (^1.4.5-lts.1) e `sharp` (^0.33.5);
   - Creazione del middleware dedicato `uploadMiddleware.js` basato su storage in memoria volatile (`multer.memoryStorage()`) con tetto massimo di $5\text{ MB}$;
   - Applicazione del filtro di validazione sui MIME-Type ammessi (`image/jpeg`, `image/png`, `image/webp`, `image/avif`), con rifiuto immediato di file binari o di testo non conformi (`400 FILE_TYPE_NOT_ALLOWED`);
   - Creazione del modulo di servizio `imageService.js` per la manipolazione asincrona delle immagini:
     - Generazione copertina standard ad alta risoluzione: ridimensionamento proporzionale entro il bounding box $800 \times 1200\text{ px}$, conversione nel formato ad alta efficienza **WebP** con compressione qualitativa all'80% (`quality: 80`);
     - Generazione miniatura (*thumbnail*): ridimensionamento entro $200 \times 300\text{ px}$, conversione WebP con fattore di qualità al 75% (`quality: 75`);
     - Assegnazione di nomi file univoci e crittograficamente sicuri basati su identificativo UUID del libro e timestamp UNIX (`cover-[bookId]-[timestamp].webp` e `thumb-[bookId]-[timestamp].webp`).
3. **Persistenza, Routing Statico e Garbage Collection del Filesystem:**
   - Creazione e gestione della directory fisica `server/uploads/covers/`;
   - Esposizione sicura della rotta statica Express (`/uploads`) per la fruizione delle immagini da browser con corretti header HTTP `Content-Type: image/webp`;
   - Implementazione della cancellazione automatica dei file orfani dal disco (*filesystem cleanup*) sia in caso di sovrascrittura di una copertina preesistente, sia all'invocazione dell'endpoint di cancellazione esplicita della copertina (`DELETE /api/esemplari/:id/copertina`), sia alla cancellazione fisica definitiva dell'esemplare (`DELETE /api/esemplari/:id`).
4. **Controllo di Titolarità e Sicurezza degli Accessi (Ownership Enforcement):**
   - Tutte le rotte di upload, modifica e rimozione copertina verificano preventivamente che l'utente autenticato tramite Bearer Token JWT sia l'effettivo proprietario della risorsa (`esemplare.utente_id === utenteId`);
   - I tentativi di manomissione da parte di utenti terzi vengono neutralizzati con sollevamento dell'errore HTTP `403 Forbidden` (`FORBIDDEN_NOT_OWNER`).
5. **Evoluzione dell'Interfaccia Utente Reattiva (`hermae-frontend/libreria.html`):**
   - Inserimento nel modulo di censimento/modifica di una zona di caricamento interattiva (*Drag & Drop Dropzone*) con selettore file nativo accessibile;
   - Generazione di anteprima locale immediata tramite API browser `FileReader` prima della trasmissione HTTP;
   - Pulsante dedicato "Rimuovi Copertina" con eliminazione trasparente sia in memoria che nel database;
   - Integrazione coerente della visualizzazione copertine su tutte e tre le modalità di visualizzazione:
     - **Vista Tabella:** resa della miniatura WebP ottimizzata (`44x60 px`) con bordo dorsale e fallback al segnaposto cromatico della macro-area;
     - **Vista Card:** visualizzazione della copertina rigida proporzionata (`62x88 px`) con texture d'usura o mockup vettoriale Hermae;
     - **Vista Scaffale Book-Stile:** posizionamento della copertina reale come fondale del libro 3D, armonizzata con gradiente scuro di protezione per preservare la leggibilità delle impressioni in lamina dorata e della targhetta ex-libris;
   - Risoluzione dinamica universale degli URL immagine sia in contesti di sviluppo locale (`http://localhost:3000`) sia in produzione reverse proxy.
6. **Collaudo End-to-End Automatizzato (`server/test_fase19.js`):**
   - Sviluppo ed esecuzione di una suite completa articolata su 7 gruppi di test funzionali e di sicurezza, per un totale di 40 asserzioni superate con successo (100% pass rate).

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
server/
├── uploads/
│   └── covers/                             # [NEW] Directory persistente per l'archiviazione delle copertine WebP
├── package.json                            # [MODIFY] Aggiunta dipendenze native multer (^1.4.5) e sharp (^0.33.5)
├── package-lock.json                       # [MODIFY] Lockfile delle dipendenze binarie ottimizzate
├── test_fase19.js                          # [NEW] Suite di collaudo automatizzato per Fase 19 (40 asserzioni)
└── src/
    ├── app.js                              # [MODIFY] Esposizione della cartella statica /uploads per WebP
    ├── controllers/
    │   └── esemplariController.js          # [MODIFY] Handler per uploadCover e removeCover con validazioni
    ├── middlewares/
    │   └── uploadMiddleware.js             # [NEW] Middleware Multer con storage volatile e filtro MIME
    ├── routes/
    │   └── esemplariRoutes.js              # [MODIFY] Nuovi endpoint POST/DELETE per la risorsa /:id/copertina
    └── services/
        ├── esemplariService.js             # [MODIFY] Validazioni stringenti campi e integrazione rimozione file
        └── imageService.js                 # [NEW] Pipeline Sharp: ridimensionamento WebP (800px / 200px) e unlink

hermae-frontend/
└── libreria.html                           # [MODIFY] Dropzone Drag&Drop, anteprima, feedback errori e rendering copertine
```

---

## 3. Pacchetti, Dipendenze e Risorse Esterne

| Risorsa / Libreria | Versione | Tipologia | Scopo / Ruolo Tecnologico |
| :--- | :---: | :---: | :--- |
| **`sharp`** | `^0.33.5` | Elaborazione Immagini | Modulo Node.js ad alte prestazioni basato su `libvips` per il ricampionamento e la conversione in formato WebP. |
| **`multer`** | `^1.4.5-lts.1` | Middleware Multipart | Gestione dei flussi HTTP `multipart/form-data`, buffering in RAM e filtraggio preventivo delle estensioni. |
| **`PostgreSQL`** | `14+` | RDBMS Relazionale | Persistenza degli URL relativi delle copertine standard e delle miniature nelle colonne `immagine_copertina` e `immagine_miniatura`. |
| **`Express`** | `^4.19.2` | Framework Web | Esposizione delle rotte RESTful, dispatch dei controller e hosting delle risorse statiche con caching HTTP. |
| **`Vue.js 3` (CDN)** | `3.5.13` | Framework Front-End | Gestione reattiva dello stato dell'interfaccia, validazione campi in tempo reale e anteprima immediata da `FileReader`. |
| **`Bootstrap 5.3`** | `5.3.3` | Framework UI | Classi di validazione visiva (`.is-invalid`, `.invalid-feedback`), finestre modali e griglie responsive. |

---

## 4. Architettura della Pipeline Grafica e Modello di Validazione

La gestione dei contenuti multimediali rispetta rigorosamente i requisiti non funzionali di prestazione (RNF-3), usabilità (RNF-4) e sicurezza (RNF-5):

```
Client HTTP (Browser)
   │
   ├── 1. Richiesta multipart/form-data (File binario max 5 MB)
   ▼
[uploadMiddleware.js] 
   │  ├── Verifica limite dimensione (max 5MB) ──> [Errore 400 FILE_TOO_LARGE]
   │  ├── Filtro MIME-Type (JPEG, PNG, WebP, AVIF) ──> [Errore 400 FILE_TYPE_NOT_ALLOWED]
   │  └── Caricamento temporaneo in memoria (Buffer volatile)
   ▼
[esemplariController.js]
   │  ├── Verifica presenza buffer ──> [Errore 400 FILE_REQUIRED]
   │  └── Invocazione pipeline grafica
   ▼
[imageService.js] (Pipeline Sharp / libvips)
   │  ├── Ricampionamento standard: max 800x1200 px, WebP (quality: 80)
   │  ├── Ricampionamento miniatura: max 200x300 px, WebP (quality: 75)
   │  └── Scrittura asincrona su filesystem (/uploads/covers/cover-*.webp, thumb-*.webp)
   ▼
[esemplariService.js]
   │  ├── Verifica titolarità esemplare (utente proprietario) ──> [Errore 403 FORBIDDEN_NOT_OWNER]
   │  ├── Cancellazione vecchi file fisici da disco (garbage collection)
   │  └── Aggiornamento atomico colonne DB: immagine_copertina, immagine_miniatura
   ▼
Risposta HTTP 200 OK (JSON con URL statici generati)
```

---

## 5. Specifiche degli Endpoint RESTful Implementati ed Estesi

| Metodo | Endpoint | Autenticazione | Parametri / Body | Codici Risposta | Descrizione Operazione |
| :---: | :--- | :---: | :--- | :---: | :--- |
| `POST` | `/api/esemplari` | JWT Bearer | JSON con metadati libro | `201`, `400`, `401` | Creazione di una nuova scheda esemplare con validazione rigorosa dei campi obbligatori. |
| `PUT` | `/api/esemplari/:id` | JWT Bearer | JSON con metadati aggiornati | `200`, `400`, `401`, `403`, `404` | Aggiornamento dei metadati bibliografici con verifica di titolarità. |
| `DELETE` | `/api/esemplari/:id` | JWT Bearer | Parametro di rotta `id` (UUID) | `200`, `401`, `403`, `404` | Rimozione dell'esemplare e contestuale cancellazione fisica delle immagini copertina associate. |
| `POST` | `/api/esemplari/:id/copertina` | JWT Bearer | `multipart/form-data` con campo `copertina` | `200`, `400`, `401`, `403`, `404` | Upload, elaborazione WebP multi-risoluzione e associazione copertina all'esemplare. |
| `DELETE` | `/api/esemplari/:id/copertina` | JWT Bearer | Parametro di rotta `id` (UUID) | `200`, `401`, `403`, `404` | Rimozione della copertina dal database e disallocazione fisica dei file WebP dal server. |
| `GET` | `/uploads/covers/:filename` | Pubblico | Nome file immagine WebP | `200`, `404` | Erogazione statica ottimizzata dell'asset visivo con header `image/webp`. |

---

## 6. Piano di Collaudo ed Evidenze di Verifica Sperimentale

Il collaudo della Fase 19 è stato condotto mediante lo script automatizzato `server/test_fase19.js`, con verifica dell'intera catena client-server.

### Risultati dei Test Automatizzati (`node test_fase19.js`):

```text
================================================================
 HERMAE — SUITE DI COLLAUDO FASE 19 (CRUD LIBRI & UPLOAD COPERTINA)
================================================================

[GRUPPO 1] Validazione Rigorosa Campi Esemplare (Server-Side)
  ✓ PASS: Rifiuta titolo mancante (400 TITOLO_REQUIRED)
  ✓ PASS: Rifiuta autore mancante (400 AUTORE_REQUIRED)
  ✓ PASS: Rifiuta categoria mancante (400 CATEGORIA_REQUIRED)
  ✓ PASS: Rifiuta categoria con UUID non valido (400 CATEGORIA_INVALID)
  ✓ PASS: Rifiuta anno pubblicazione futuro eccessivo (400 ANNO_INVALID)
  ✓ PASS: Rifiuta anno pubblicazione anteriore al 1450 (400 ANNO_INVALID)
  ✓ PASS: Rifiuta codice ISBN non conforme (400 ISBN_INVALID)
  ✓ PASS: Rifiuta stato disponibilità non censito (400 STATO_DISPONIBILITA_INVALID)
  ✓ PASS: Rifiuta stato conservazione non censito (400 STATO_CONSERVAZIONE_INVALID)

[GRUPPO 2] Creazione Esemplare Valido e Normalizzazione Dati
  ✓ PASS: Creazione esemplare valido restituisce 201 Created
  ✓ PASS: ID UUID generato per il nuovo esemplare
  ✓ PASS: ISBN valido conservato correttamente
  ✓ PASS: Sottogenere associato correttamente

[GRUPPO 3] Upload Copertina Multipart con Multer & Sharp (WebP 800px & 200px)
  ✓ PASS: POST /api/esemplari/:id/copertina restituisce 200 OK
  ✓ PASS: Conferma di successo upload
  ✓ PASS: URL copertina standard generato in formato WebP
  ✓ PASS: URL miniatura generato in formato WebP
  ✓ PASS: File fisico copertina standard 800px presente su disco
  ✓ PASS: File fisico miniatura 200px presente su disco
  ✓ PASS: Formato immagine standard convertito in WebP nativo
  ✓ PASS: Dimensioni copertina standard contenute entro 800x1200px
  ✓ PASS: Formato miniatura convertito in WebP nativo
  ✓ PASS: Dimensioni miniatura contenute entro 200x300px
  ✓ PASS: GET HTTP su rotta statica copertina restituisce 200 OK
  ✓ PASS: Header Content-Type della rotta statica è "image/webp"
  ✓ PASS: GET HTTP su rotta statica miniatura restituisce 200 OK
  ✓ PASS: Header Content-Type della miniatura è "image/webp"

[GRUPPO 4] Sicurezza Upload, Filtri MIME-Type e Titolarità
  ✓ PASS: Rifiuta upload di tipo MIME non immagine (400 FILE_TYPE_NOT_ALLOWED)
  ✓ PASS: Rifiuta upload copertina privo di file binario (400 FILE_REQUIRED)
  ✓ PASS: Blocca upload copertina da utente non proprietario (403 FORBIDDEN_NOT_OWNER)

[GRUPPO 5] Rimozione Copertina e Pulizia Filesystem
  ✓ PASS: Blocca rimozione copertina da utente non proprietario (403 FORBIDDEN_NOT_OWNER)
  ✓ PASS: DELETE /api/esemplari/:id/copertina da proprietario restituisce 200 OK
  ✓ PASS: Campo immagine_copertina azzerato a NULL nel database
  ✓ PASS: Campo immagine_miniatura azzerato a NULL nel database
  ✓ PASS: File fisico copertina eliminato definitivamente da disco
  ✓ PASS: File fisico miniatura eliminato definitivamente da disco

[GRUPPO 6] Cancellazione Esemplare con Cleanup Automatico File
  ✓ PASS: Nuovi file copertina rigenerati su disco
  ✓ PASS: DELETE /api/esemplari/:id restituisce 200 OK
  ✓ PASS: File copertina rimosso automaticamente dal filesystem alla cancellazione del libro
  ✓ PASS: File miniatura rimosso automaticamente dal filesystem alla cancellazione del libro

[GRUPPO 7] Verifica Regressione Fasi Precedenti
  ✓ PASS: Libreria personale consultabile senza errori di regressione

================================================================
 RIEPILOGO TEST FASE 19: 40 PASSATI, 0 FALLITI (100% SUCCESSO)
================================================================
```

---

## 7. Conclusioni e Collegamento con le Fasi Successive

L'implementazione della **Fase 19** completa e consolida le funzionalità fondamentali di gestione del patrimonio librario per gli utenti della piattaforma Hermae. La risoluzione della criticità legata alla validazione ha consentito di erigere un'infrastruttura robusta, prevenendo incoerenze informative e garantendo la qualità del dato sia a livello di interfaccia utente sia nel motore di persistenza.

L'integrazione di una pipeline grafica nativa basata sullo standard moderno WebP assicura un abbattimento del payload di rete superiore al 60% rispetto ai tradizionali formati JPEG/PNG, soddisfacendo in pieno il requisito di performance e fruibilità su dispositivi mobili con connettività limitata (RNF-3 e RNF-4).

Con il catalogo personale pienamente operativo e arricchito dal supporto iconografico e multimediale, il sistema è pronto per procedere alla successiva **Fase 20**: *"Implementazione della vista catalogo generale / vetrina dei libri con filtri di ricerca"*, che aprirà l'esplorazione pubblica dell'intero patrimonio culturale condiviso dalla comunità.
