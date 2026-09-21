# Fase 23 — Implementazione della funzione “Prestito” di un testo tra gli utenti

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-23.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stato realizzato il flusso di gestione del prestito: richiesta formale, accettazione/rifiuto da parte del proprietario, tracking temporale della durata e aggiornamento automatico dello stato del libro (disponibile/in prestito).

Nel dettaglio, le attività realizzate hanno compreso:
1. **Flusso Formale di Richiesta Prestito con Durata Parametrabile (`prestitiService.js`):**
   - Introduzione del parametro formale `durata_giorni` (default a 30 giorni, con vincolo di validità compreso tra 1 e 180 giorni) e note opzionali del richiedente;
   - Blocco preventivo di auto-richiesta su volumi di proprietà dell'utente (`400 BAD_REQUEST`);
   - Prevenzione dell'invio di richieste duplicate attive (`IN_ATTESA`, `ACCETTATA`, `IN_PRESTITO`) per lo stesso utente e lo stesso esemplare (`409 CONFLICT`);
   - Verifica stringente della disponibilità fisica del volume: inibizione immediata di nuove richieste se il libro non si trova nello stato `DISPONIBILE` (`409 BOOK_NOT_AVAILABLE`).
2. **Accettazione Transazionale con Blocco di Richieste Concorrenti (Difficoltà di Fase):**
   - Transazione atomica PostgreSQL (`BEGIN ... COMMIT`) con lock pessimistico di riga (`SELECT ... FROM esemplari WHERE id = $1 FOR UPDATE`) per scongiurare qualsiasi race condition in presenza di richieste simultanee;
   - All'accettazione della richiesta da parte del proprietario, il prestito avanza allo stato `IN_PRESTITO`, registrando la data di inizio (`CURRENT_TIMESTAMP`) e la data esatta di scadenza calcolata con aritmetica temporale (`CURRENT_TIMESTAMP + (durata_giorni || ' days')::interval`);
   - Aggiornamento automatico e istantaneo dello stato di disponibilità dell'esemplare: da `DISPONIBILE` a `IN_PRESTITO`;
   - **Risoluzione Automatica della Concorrenza:** tutte le altre richieste pendenti nello stato `IN_ATTESA` per il medesimo esemplare vengono automaticamente transizionate a `RIFIUTATA`, annotando una motivazione formale di sistema (*"Il volume è stato concesso in prestito a un altro lettore"*);
   - Invio asincrono di notifiche interne personalizzate ai richiedenti concorrenti esclusi.
3. **Tracking Temporale Dinamico e Proroga (`enrichLoanWithTemporalTracking`):**
   - Calcolo real-time del tempo trascorso, dei giorni rimanenti alla scadenza, della percentuale di avanzamento della durata e del rilevamento proattivo dello stato di ritardo (`SCADUTO_IN_RITARDO`);
   - Gestione delle richieste di proroga da parte del proprietario o concordate tra le parti: estensione della durata in giorni con ricalcolo atomico della `data_scadenza` e notifica automatica.
4. **Ciclo di Restituzione Formale e Ripristino della Disponibilità:**
   - Flusso di riconsegna attivabile dal proprietario alla ricezione fisica del volume;
   - Transazione atomica che archivia il prestito nello stato `RESTITUITO` con memorizzazione di `data_restituzione` e note opzionali sulle condizioni del volume;
   - Ripristino automatico dello stato dell'esemplare a `DISPONIBILE`, rendendolo istantaneamente di nuovo ricercabile nel catalogo geospaziale della community (Fase 21);
   - Notifica interna al richiedente attestante la regolare restituzione dell'opera.
5. **Nuova Interfaccia Dedicata: Gestione Prestiti e Attività (`hermae-frontend/attivita.html` - Pagina 8 Sitemap):**
   - Dashboard integrata con 4 card di metriche aggregate: *Prestiti Attivi*, *Libri in Lettura*, *Richieste in Attesa*, *Restituzioni Concluse*;
   - Schede di navigazione differenziate per ruolo: **"Libri Ricevuti"** (volumi presi in prestito) e **"Libri Concessi"** (volumi della propria libreria affidati alla community);
   - Filtri di stato contestuali (*Tutti*, *In attesa*, *In corso*, *In ritardo*, *Restituiti*, *Annullati/Rifiutati*) e barra di ricerca in tempo reale;
   - Card del prestito con indicatori visivi avanzati: barre di avanzamento temporale dinamiche (verdi, gialle se in scadenza, rosse pulsanti se scadute), badge di countdown e metadati della controparte;
   - Modali interattive:
     - `#modalAccetta`: accettazione formale con personalizzazione della durata in giorni e anteprima interattiva della data di scadenza;
     - `#modalRestituzione`: conferma di restituzione con note sulle condizioni del libro;
     - `#modalProroga`: richiesta ed erogazione di giorni addizionali di prestito;
     - `#modalRifiuto`: motivazione formale del rifiuto;
   - Supporto deep-linking bidirezionale con la Chat (`chat.html`) e ancoraggio via parametro URL `attivita.html?id=...`.

---

## 2. Modello Dati e Migrazioni DDL

Per supportare il ciclo formale del prestito e il tracking temporale, sono state apportate estensioni mirate alla tabella `richieste_prestito` in `INFO-DATABASE/schema.sql`:

```sql
-- Estensioni Tabella RICHIESTE_PRESTITO (Fase 23)
ALTER TABLE richieste_prestito 
ADD COLUMN IF NOT EXISTS durata_giorni INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS data_inizio TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS data_scadenza TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS data_restituzione TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS note_restituzione TEXT NULL;

-- Indici di performance per lock di concorrenza e scadenze temporali
CREATE INDEX IF NOT EXISTS idx_richieste_esemplare_stato ON richieste_prestito(esemplare_id, stato);
CREATE INDEX IF NOT EXISTS idx_richieste_data_scadenza ON richieste_prestito(data_scadenza);
```

I vincoli di stato supportati nella macchina a stati sono:
- `IN_ATTESA`: richiesta formale inoltrata dal richiedente, in attesa di valutazione da parte del proprietario;
- `ACCETTATA` / `IN_PRESTITO`: volume formalmente affidato al lettore con decorrenza temporale attiva;
- `RIFIUTATA`: richiesta declinata dal proprietario (o rifiutata automaticamente per concorrenza vinta da altro utente);
- `ANNULLATA`: richiesta ritirata dal richiedente prima dell'accettazione;
- `RESTITUITO` / `COMPLETATA`: volume rientrato nella disponibilità del proprietario, con contestuale ripristino dell'esemplare a `DISPONIBILE`.

---

## 3. Architettura Software e Risoluzione della Concorrenza

### 3.1 Gestione delle Richieste Concorrenti mediante Row-Level Lock Pessimistico

In uno scenario peer-to-peer ad alta intensità d'uso, più lettori possono individuare contemporaneamente sulla mappa lo stesso volume e inviare richieste simultanee prima che il proprietario ne accetti una. Per garantire la rigorosa integrità dei dati e impedire doppie allocazioni dello stesso esemplare fisico, il metodo `accettaPrestito` in `server/src/services/prestitiService.js` opera come segue:

```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1. Lock pessimistico di riga sul volume fisico per serializzare le transazioni concorrenti
  const esemplareRes = await client.query(
    `SELECT id, proprietario_id, titolo, stato_disponibilita 
     FROM esemplari 
     WHERE id = $1 
     FOR UPDATE`,
    [richiesta.esemplare_id]
  );

  // 2. Controllo disponibilità al momento dell'esecuzione del lock
  if (esemplareRes.rows[0].stato_disponibilita !== 'DISPONIBILE') {
    throw new Error('Questo volume non è più disponibile per il prestito.');
  }

  // 3. Avanzamento del prestito con decorrenza e scadenza temporale
  await client.query(
    `UPDATE richieste_prestito 
     SET stato = 'IN_PRESTITO',
         data_inizio = CURRENT_TIMESTAMP,
         data_scadenza = CURRENT_TIMESTAMP + ($1 || ' days')::interval,
         durata_giorni = $1,
         data_aggiornamento = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [durataEffettiva, richiestaId]
  );

  // 4. Aggiornamento automatico dello stato del libro a IN_PRESTITO
  await client.query(
    `UPDATE esemplari 
     SET stato_disponibilita = 'IN_PRESTITO', 
         data_modifica = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [richiesta.esemplare_id]
  );

  // 5. Rifiuto automatico e contestuale di tutte le richieste concorrenti rimaste in attesa
  const concRes = await client.query(
    `UPDATE richieste_prestito 
     SET stato = 'RIFIUTATA',
         note_restituzione = 'Volume affidato ad un altro lettore che ha preceduto la richiesta',
         data_aggiornamento = CURRENT_TIMESTAMP
     WHERE esemplare_id = $1 
       AND id != $2 
       AND stato = 'IN_ATTESA'
     RETURNING id, richiedente_id`,
    [richiesta.esemplare_id, richiestaId]
  );

  await client.query('COMMIT');

  // 6. Notifiche asincrone agli utenti concorrenti esclusi
  for (const c of concRes.rows) {
    await notificheService.creaNotifica({
      utenteId: c.richiedente_id,
      richiestaId: c.id,
      tipo: 'RICHIESTA_RIFIUTATA',
      titolo: 'Richiesta prestito non disponibile',
      messaggio: `Il volume "${esemplare.titolo}" è stato concesso in prestito a un altro utente.`
    });
  }
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### 3.2 Motore di Tracking Temporale Dinamico

Il modulo `enrichLoanWithTemporalTracking` calcola in memoria e arricchisce ogni prestito con lo stato temporale analitico:
- `giorni_totali`: durata nominale concessa;
- `giorni_trascorsi`: tempo intercorso tra `data_inizio` e il momento corrente;
- `giorni_rimanenti`: differenza arrotondata per eccesso tra `data_scadenza` e `now`;
- `percentuale_tempo`: indice normalizzato da 0 a 100 per guidare le barre progressive nell'interfaccia;
- `stato_temporale`:
  - `SCADUTO_IN_RITARDO`: se `giorni_rimanenti < 0` e lo stato è ancora `IN_PRESTITO`;
  - `IN_SCADENZA`: se `0 <= giorni_rimanenti <= 3`;
  - `IN_CORSO`: se `giorni_rimanenti > 3`;
  - `RESTITUITO`: per prestiti conclusi con successo;
  - `NON_INIZIATO`: per richieste in attesa o rifiutate.

---

## 4. Elenco Filesystem dei File Creati e Modificati

```text
INFO-DATABASE/
└── schema.sql                              # [MODIFY] Estensione tabella richieste_prestito (durata_giorni, date, indici)

server/
├── src/
│   ├── services/
│   │   ├── prestitiService.js              # [NEW] Logica transazionale prestito, lock FOR UPDATE, tracking e concorrenza
│   │   ├── notificheService.js             # [MODIFY] Supporto unificato snake_case e camelCase per utenteId/utente_id
│   │   └── privacyShieldService.js         # [MODIFY] Esposizione alias consentito/allowed per compatibilità rate-limiter
│   ├── controllers/
│   │   └── prestitiController.js           # [NEW] Controller REST per ciclo prestito, metriche e azioni di stato
│   └── routes/
│       ├── index.js                        # [MODIFY] Registrazione endpoint /api/prestiti e /api/attivita
│       └── prestitiRoutes.js               # [NEW] Definizione rotte protette JWT per ciclo prestito
└── test_fase23.js                          # [NEW] Test suite automatizzata end-to-end (20 asserzioni formali)

hermae-frontend/
├── attivita.html                           # [NEW] Pagina 8: Dashboard Prestiti & Attività con filtri, tracking e modali
├── prestiti.html                           # [NEW] Alias e reindirizzamento standard verso attivita.html
└── chat.html                               # [MODIFY] Pulsante "Scheda Prestito" per navigazione rapida verso il tracking
```

---

## 5. Risultati del Collaudo e Metriche di Validazione

La suite di test automatizzati [`server/test_fase23.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase23.js) è stata eseguita con esito **100% positivo** coprendo 6 aree di verifica tecnica:

1. **Parte 1 — Creazione Richiesta Formale di Prestito:**
   - Blocco auto-richiesta su libri di propria titolarità con codice HTTP 400 ($1/1$ superato);
   - Rifiuto durata prestito non conforme (< 1 o > 180 giorni) con codice HTTP 400 ($1/1$ superato);
   - Creazione formale con successo, stato `IN_ATTESA` e durata 30 gg ($1/1$ superato);
   - Prevenzione richieste duplicate attive per il medesimo utente con codice HTTP 409 ($1/1$ superato);
2. **Parte 2 — Concorrenza tra Richiedenti e Blocco Concorrente (Difficoltà di Fase):**
   - Registrazione richiesta concorrente da Utente C nello stato `IN_ATTESA` ($1/1$ superato);
   - Accettazione prestito dal proprietario con avanzamento a `IN_PRESTITO` ($1/1$ superato);
   - Aggiornamento automatico stato esemplare a `IN_PRESTITO` confermato su DB ($1/1$ superato);
   - Richiesta concorrente C declinata automaticamente con motivazione formale ($1/1$ superato);
   - Notifica asincrona recapitata all'utente concorrente escluso ($1/1$ superato);
   - Rifiuto nuove richieste per volume non disponibile con codice HTTP 409 ($1/1$ superato);
3. **Parte 3 — Tracking Temporale, Calcolo Countdown e Proroga:**
   - Metriche temporali conformi (`giorni_rimanenti: 30`, `stato_temporale: IN_CORSO`) ($1/1$ superato);
   - Proroga temporale applicata con successo (+15 giorni: nuova durata 45 gg) ($1/1$ superato);
   - Rilevamento automatico stato `SCADUTO_IN_RITARDO` con calcolo giorni di ritardo ($1/1$ superato);
4. **Parte 4 — Restituzione Formale e Ripristino Disponibilità:**
   - Restituzione registrata con successo con stato `RESTITUITO` ($1/1$ superato);
   - Ripristino automatico disponibilità esemplare a `DISPONIBILE` confermato ($1/1$ superato);
   - Volume riconsegnato accetta correttamente nuove richieste formali ($1/1$ superato);
5. **Parte 5 — Flussi Alternativi (Rifiuto e Annullamento):**
   - Annullamento richiesta da parte del richiedente registrato con stato `ANNULLATA` ($1/1$ superato);
   - Rifiuto formale con motivazione da parte del proprietario registrato con stato `RIFIUTATA` ($1/1$ superato);
6. **Parte 6 — Sicurezza Anti-IDOR ed Endpoint Metriche Dashboard:**
   - Schermatura IDOR verificata con codice HTTP 403 per utenti non correlati ($1/1$ superato);
   - Endpoint metriche aggregate cruscotto prestiti pienamente operativo ($1/1$ superato).

**Totale Asserzioni Superate:** $20/20$ ($100\%$ pass rate).  
**Regressione Fasi Precedenti:**  
- Fase 22 (Contatto & Privacy Shield): $19/19$ superati;  
- Fase 21 (Ricerca Geospaziale): $19/19$ superati;  
- Fase 20 (Occultamento e Privacy): $28/28$ superati;  
- Fase 19 (CRUD Libri & Upload Copertina): $40/40$ superati.  
**Totale Asserzioni di Regressione:** $106/106$ ($100\%$ success rate).  
**Totale Generale Test Eseguiti:** $126/126$ ($100\%$ success rate).
