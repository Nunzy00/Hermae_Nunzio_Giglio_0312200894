# Fase 20 — Implementazione delle funzioni di occultamento della “libreria” e/o dei libri inseriti da un’utente ad altri utenti, per richiesta esplicita di tutela privacy

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-20.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stato introdotto il controllo granulare per rendere invisibili determinati libri o l'intero scaffale personale nelle viste pubbliche, rispettando la volontà dell'utente di limitare la condivisione a scopi di sola consultazione privata.  
**Difficoltà:** Mantenere separata la vista ad uso personale da quella accessibile alla community senza duplicare la logica delle query.

Nel dettaglio, le attività realizzate hanno compreso:
1. **Aggiornamento dello Schema Relazionale (Database DDL & Migrazione):**
   - Introduzione della colonna booleana `visibile_pubblico BOOLEAN NOT NULL DEFAULT TRUE` nella tabella `esemplari` del database PostgreSQL `hermae_db`;
   - Creazione dell'indice B-Tree dedicato `idx_esemplari_visibile_pubblico` per garantire prestazioni ottimali $O(\log n)$ durante i filtraggi massivi di catalogo e le interrogazioni geospaziali;
   - Allineamento formale del file DDL master [`INFO-DATABASE/schema.sql`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/INFO-DATABASE/schema.sql).
2. **Risoluzione della Difficoltà Architetturale: Pattern Query DRY Unificato (`esemplariService.js`):**
   - Per risolvere la difficoltà di *"mantenere separata la vista ad uso personale da quella accessibile alla community senza duplicare la logica delle query"*, è stata ingegnerizzata la costante di proiezione unificata `BASE_ESEMPLARI_SELECT`;
   - Tale proiezione incapsula tutte le `JOIN` relazionali con `categorie`, `utenti` e `preferenze_privacy_utenti`, aggregando in formato JSON strutturato le coordinate, le macro-aree disciplinari e lo stato dell'account;
   - La separazione tra vista personale e vista comunitaria viene gestita a livello di clausole `WHERE` modulari:
     - **Vista Personale (`getMyEsemplari`):** filtra per `e.utente_id = $1` e restituisce la totalità dei volumi censiti (sia pubblici che privati) indipendentemente dal flag globale `mostra_libreria`, permettendo all'utente di consultare e inventariare il proprio patrimonio anche in modalità archivio strettamente privato. È stato inoltre aggiunto il supporto al parametro `filters.visibilita` (`'PUBBLICO'` o `'PRIVATO'`);
     - **Vista Community (`searchEsemplari`):** inietta la condizione di salvaguardia della privacy `(priv.mostra_libreria IS NULL OR priv.mostra_libreria = TRUE) AND e.visibile_pubblico = TRUE`, estromettendo a livello di indice qualsiasi record privato o appartenente a utenti che hanno revocato la visibilità dello scaffale;
     - **Vista Singolo Esemplare (`getEsemplareById`):** riceve l'ID opzionale dell'utente richiedente (`requestingUserId`); se il libro è privato o l'utente proprietario ha occultato la libreria, l'accesso è autorizzato se e solo se `requestingUserId === row.utente_id`. In caso contrario, solleva un'eccezione HTTP `404 Not Found` per impedire attacchi di enumerazione ID (*OWASP Anti-Enumeration Principle*).
3. **Infrastruttura di Sicurezza e Autenticazione Ibrida (`optionalAuth`):**
   - Implementazione ed esportazione del middleware `optionalAuth` in [`server/src/middlewares/authMiddleware.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/src/middlewares/authMiddleware.js);
   - Il middleware intercetta l'header `Authorization: Bearer <token>` qualora fornito dal client, validando il JWT e popolando `req.user`, ma lasciando proseguire come anonima la richiesta in caso di token assente o non valido;
   - Applicazione di `optionalAuth` sull'endpoint `GET /api/esemplari/:id`, consentendo a proprietari autenticati di aprire schede di libri privati anche tramite link diretti, mentre i terzi (o visitatori non registrati) ricevono un `404 Not Found`.
4. **Endpoint Atomico di Variazione Visibilità (`PATCH /api/esemplari/:id/visibilita`):**
   - Creazione del controller `toggleVisibilita` e del metodo di servizio `toggleVisibilitaEsemplare`;
   - Esecuzione di una transazione atomica con verifica rigorosa della titolarità: sollevamento di `403 Forbidden` (`FORBIDDEN_NOT_OWNER`) qualora l'utente autenticato tenti di alterare lo stato di un volume appartenente ad altro utente;
   - Inversione immediata del flag booleano con messaggio contestuale (`PUBBLICO` o `PRIVATO`).
5. **Integrazione con le Preferenze di Riservatezza Utente (Fasi 16-17):**
   - Piena interoperabilità tra il controllo granulare per singolo libro (`visibile_pubblico`) e il controllo globale d'account (`preferenze_privacy_utenti.mostra_libreria`);
   - Se l'utente imposta `mostra_libreria = false`, tutti i suoi libri vengono istantaneamente oscurati dalle ricerche di prossimità e dalle consultazioni terze, preservando la piena operatività della sua interfaccia di gestione personale.
6. **Evoluzione dell'Interfaccia Utente Reattiva (`hermae-frontend/libreria.html`):**
   - **Banner di Avviso Dinamico:** se le preferenze dell'utente hanno `mostra_libreria === false`, compare in testa alla pagina un banner informativo `alert-warning` con icona `bi-eye-slash-fill` e collegamento diretto al pannello privacy;
   - **Controllo Granulare nella Modale di Inserimento/Modifica:** aggiunto un blocco switch responsive con indicatore semantico dello stato ("Visibile a Tutti" con icona globo verde vs "Occultato / Solo Privato" con icona lucchetto giallo) e spiegazione testuale per l'utente;
   - **Riconoscimento Immediato nelle Viste (Tabella, Card, Book-Stile):**
     - Nella Vista Tabella: badge `🔒 Privato` accanto al titolo del libro e pulsante ad azione rapida con icona occhio/occhio-barrato per commutare la visibilità con un clic;
     - Nella Vista Card: badge `🔒 Privato` nell'header e pulsante "Occulta / Rendi Pubblico" nel footer della card;
     - Nella Vista Book-Stile (Scaffale 3D): sigillo dorato `PRIVATO` sulla testata superiore del volume fisico e pulsante dedicato nell'overlay interattivo hover;
   - **Quinto Filtro Rapido di Visibilità:** compattato nella griglia dei filtri responsive (`Tutte le visibilità`, `🌐 Solo Pubblici`, `🔒 Solo Privati`) con sincronizzazione reattiva e conteggi.
7. **Collaudo End-to-End Automatizzato (`server/test_fase20.js`):**
   - Sviluppo ed esecuzione di una suite completa articolata su 10 step di verifica, con 28 asserzioni superate con successo (100% pass rate);
   - Esecuzione della suite di regressione `test_fase19.js` (40 asserzioni superate con successo).

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
INFO-DATABASE/
└── schema.sql                              # [MODIFY] Aggiunta colonna visibile_pubblico e indice B-Tree dedicato

server/
├── test_fase20.js                          # [NEW] Suite di collaudo automatizzato per Fase 20 (28 asserzioni)
└── src/
    ├── controllers/
    │   └── esemplariController.js          # [MODIFY] Aggiunta handler toggleVisibilita e propagazione visibilita / requestingUserId
    ├── middlewares/
    │   └── authMiddleware.js               # [MODIFY] Esportazione del middleware optionalAuth per inspect JWT non bloccante
    ├── routes/
    │   └── esemplariRoutes.js              # [MODIFY] Rotta PATCH /:id/visibilita e optionalAuth su GET /:id
    └── services/
        └── esemplariService.js             # [MODIFY] Proiezione BASE_ESEMPLARI_SELECT DRY, filtri privacy e toggle atomico

hermae-frontend/
└── libreria.html                           # [MODIFY] Switch privacy in modale, badge e toggle rapido su 3 viste, banner libreria occultata
```

---

## 3. Risoluzione della Difficoltà Metodologica: Architettura Query DRY

Nella progettazione delle piattaforme di sharing culturale, una criticità ricorrente consiste nella duplicazione delle query SQL tra contesti ad uso personale (dove l'utente necessita di visualizzare l'inventario completo dei propri beni materiali) e contesti pubblici o comunitari (dove devono essere applicati filtri stringenti di tutela della riservatezza e conformità al GDPR). La duplicazione del codice conduce rapidamente a disallineamenti di schema, anomalie di join e falle di sicurezza.

Hermae ha risolto tale problematica tramite la centralizzazione della proiezione relazionale:

```javascript
// Costante di proiezione condivisa (Pattern DRY) in server/src/services/esemplariService.js
const BASE_ESEMPLARI_SELECT = `
  SELECT 
    e.*,
    c.nome AS categoria_nome,
    c.slug AS categoria_slug,
    c.icona AS categoria_icona,
    u.nome AS utente_nome,
    u.cognome AS utente_cognome,
    u.citta AS utente_citta,
    u.provincia AS utente_provincia,
    pos.latitudine AS utente_latitudine,
    pos.longitudine AS utente_longitudine,
    priv.mostra_libreria AS utente_mostra_libreria,
    priv.modalita_occultamento AS utente_modalita_occultamento
  FROM esemplari e
  JOIN categorie c ON e.categoria_id = c.id
  JOIN utenti u ON e.utente_id = u.id
  LEFT JOIN posizioni_utenti pos ON u.id = pos.utente_id
  LEFT JOIN preferenze_privacy_utenti priv ON u.id = priv.utente_id
`;
```

Le clausole di sicurezza vengono composte dinamicamente a valle:

```
                          ┌─────────────────────────────┐
                          │    BASE_ESEMPLARI_SELECT    │
                          │ (Proiezione Unificata DRY)  │
                          └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   [ Vista Personale: getMyEsemplari ]             [ Vista Community: searchEsemplari ]
   - WHERE e.utente_id = $1                        - WHERE (priv.mostra_libreria IS NULL OR priv.mostra_libreria = TRUE)
   - Include libri pubblici e privati                AND e.visibile_pubblico = TRUE
   - Consultazione archivio personale              - Esclude libri privati e librerie occultate
   - Filtro opzionale: visibilita                  - Ricerca geografica e testuale protetta
```

---

## 4. Matrice di Accesso e Principio Anti-Enumerazione (OWASP)

Al fine di garantire la conformità con le direttive OWASP Web Security Testing Guide (WSTG-IDNT-04) relative all'Anti-Enumeration, quando un utente terzo o un visitatore anonimo richiede l'accesso all'endpoint puntuale `GET /api/esemplari/:id` per un'opera privata o appartenente a una libreria occultata, il sistema restituisce **HTTP 404 Not Found** anziché HTTP 403 Forbidden. Tale scelta impedisce a potenziali attaccanti di dedurre l'esistenza o la proprietà di volumi privati tramite scansione sequenziale di identificatori.

| Scenario di Accesso | Identità Richiedente | Stato Esemplare | Stato Libreria Utente | Risposta HTTP | Motivazione di Sicurezza / UX |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Consultazione Proprietario** | Utente A (Proprietario) | `visibile_pubblico = false` | Qualsiasi | **`200 OK`** | Il proprietario ha sempre diritto di consultare il proprio patrimonio. |
| **Accesso Terzo a Libro Privato** | Utente B / Anonimo | `visibile_pubblico = false` | `mostra_libreria = true` | **`404 Not Found`** | Risorsa inesistente per la community (Anti-Enumeration). |
| **Accesso Terzo a Libreria Occultata**| Utente B / Anonimo | `visibile_pubblico = true` | `mostra_libreria = false` | **`404 Not Found`** | L'intero scaffale è privato; il libro pubblico viene mascherato. |
| **Accesso Terzo a Libro Pubblico** | Utente B / Anonimo | `visibile_pubblico = true` | `mostra_libreria = true` | **`200 OK`** | Libro visibile per consultazione, prestito e scambio culturale. |
| **Tentativo Toggle Non Proprietario** | Utente B | Qualsiasi | Qualsiasi | **`403 Forbidden`** | Operazione di scrittura non autorizzata (`FORBIDDEN_NOT_OWNER`). |

---

## 5. Risultati del Collaudo e Validazione

La suite automatizzata [`server/test_fase20.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase20.js) ha verificato sistematicamente la tenuta di tutti i vincoli:

```text
========================================================================
 AVVIO TEST SUITE FASE 20 — OCCULTAMENTO LIBRERIA & TUTELA PRIVACY
 Hermae — Nunzio Giglio (Matr. 0312200894)
========================================================================

[TEST-INIT] Server HTTP di test avviato su porta effimera :53204

[FASE 20 - STEP 1] Autenticazione Utente A e Utente B...
  ✅ PASS: Token JWT ottenuti con successo per Utente A e Utente B
[FASE 20 - STEP 2] Creazione di libro pubblico e libro privato da parte di Utente A...
  ✅ PASS: Creazione libro pubblico terminata con HTTP 201 Created
  ✅ PASS: Il libro pubblico ha visibile_pubblico === true
  ✅ PASS: Creazione libro riservato terminata con HTTP 201 Created
  ✅ PASS: Il libro privato ha visibile_pubblico === false
[FASE 20 - STEP 3] Verifica vista personale proprietario (GET /api/esemplari/mie)...
  ✅ PASS: Recupero libreria personale con HTTP 200 OK
  ✅ PASS: La libreria personale include il libro pubblico
  ✅ PASS: La libreria personale include il libro privato (consultazione privata garantita)
[FASE 20 - STEP 4] Verifica filtri visibilità nella vista personale...
  ✅ PASS: Filtro visibilita=PRIVATO restituisce solo i volumi privati
  ✅ PASS: Filtro visibilita=PUBBLICO restituisce solo i volumi pubblici
[FASE 20 - STEP 5] Verifica ricerca pubblica della community (GET /api/esemplari)...
  ✅ PASS: Ricerca catalogo pubblica risponde HTTP 200 OK
  ✅ PASS: La ricerca pubblica trova il libro marcato visibile_pubblico = true
  ✅ PASS: La ricerca pubblica OCCULTA tassativamente il libro privato (visibile_pubblico = false)
[FASE 20 - STEP 6] Verifica accesso diretto GET /api/esemplari/:id e protezione privacy...
  ✅ PASS: Utente A (proprietario) accede al proprio libro privato con HTTP 200 OK
  ✅ PASS: Utente B riceve HTTP 404 Not Found (occultamento e anti-enumerazione OWASP)
  ✅ PASS: Visitatore anonimo riceve HTTP 404 Not Found sul libro privato
  ✅ PASS: Utente B accede regolarmente al libro pubblico di Utente A (HTTP 200 OK)
[FASE 20 - STEP 7] Test endpoint PATCH /api/esemplari/:id/visibilita (Toggle visibilità)...
  ✅ PASS: Toggle visibilità da parte del proprietario risponde HTTP 200 OK
  ✅ PASS: Il libro è diventato pubblico (visibile_pubblico: true)
  ✅ PASS: Dopo il toggle a pubblico, Utente B può visualizzare la scheda libro
  ✅ PASS: Il libro è tornato privato (visibile_pubblico: false)
  ✅ PASS: Tentativo di toggle da parte di un non proprietario bloccato con HTTP 403 Forbidden
[FASE 20 - STEP 8] Test occultamento intera libreria personale (mostra_libreria = false)...
  ✅ PASS: Aggiornamento preferenze privacy (mostra_libreria: false) riuscito
  ✅ PASS: Con mostra_libreria = false, NESSUN libro di Utente A appare nella ricerca pubblica della community
  ✅ PASS: Accesso diretto da terzi a un libro pubblico di un utente con libreria occultata restituisce HTTP 404
  ✅ PASS: L'Utente A vede e gestisce TUTTI i propri volumi nel proprio pannello personale anche se l'intera libreria è occultata
[FASE 20 - STEP 9] Verifica aggiornamento visibile_pubblico tramite PUT /api/esemplari/:id...
  ✅ PASS: Aggiornamento metadati via PUT riuscito
  ✅ PASS: visibile_pubblico aggiornato correttamente a false via PUT
[FASE 20 - STEP 10] Pulizia record di test creati...
  🧹 Record di test eliminati.

========================================================================
 RIEPILOGO TEST FASE 20: 28 Superati, 0 Falliti
========================================================================
```

Nessuna regressione riscontrata sulla suite della Fase 19 (`40 PASSATI, 0 FALLITI`).

---

## 6. Conformità ai Requisiti di Progetto

- **RF-3 (Gestione Catalogo Personale):** l'utente può censire libri fisici destinandoli alla consultazione privata o alla condivisione pubblica;
- **RF-6 (Ricerca Geospaziale e Catalogo):** le ricerche pubbliche escludono in modo tassativo i volumi privati e gli utenti con libreria occultata;
- **RNF-2 (GDPR, Privacy by Design & Default):** l'utente esercita un controllo pieno e granulare sulla riservatezza dei propri dati bibliografici;
- **RNF-3 (Prestazioni):** l'indicizzazione B-Tree su `visibile_pubblico` garantisce tempi di risposta costanti e scalabili;
- **RNF-4 (Usabilità ed Esperienza Utente):** integrazione coerente degli indicatori di privacy nelle tre viste (Tabella, Card, Book-Stile) con feedback immediato tramite notifiche toast e commutazione rapida senza ricaricamento di pagina.
