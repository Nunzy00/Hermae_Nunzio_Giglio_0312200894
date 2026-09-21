# Fase 24 — Implementazione delle funzionalità “Analytics” per l’utente

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-24.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stata creata una dashboard personale in cui ciascun utente può visualizzare statistiche aggregate sulla propria attività: numero di volumi condivisi, prestiti completati, letture archiviate e metriche generali di utilizzo.

Nel dettaglio, le attività realizzate hanno compreso:
1. **Aggregazione delle Metriche Chiave dell'Utente (KPI):**
   - **Volumi Condivisi:** censimento totale dei libri dell'utente (`esemplari.utente_id`), con ripartizione per stato di disponibilità (`DISPONIBILE`, `IN_PRESTITO`, `NON_DISPONIBILE`) e per livello di riservatezza (volumi pubblici vs volumi privati in conformità con la tutela privacy della Fase 20);
   - **Prestiti Concessi & Conclusi:** riepilogo delle richieste ricevute come proprietario, prestiti attivi in corso, scambi conclusi con successo (`RESTITUITO`, `COMPLETATA`) e calcolo del tasso di successo percentuale degli scambi;
   - **Letture Archiviate:** storico dei volumi presi in prestito dalla community e completati/letti (`richiedente_id`), volumi attualmente in lettura e richieste pendenti;
   - **Metriche Generali di Utilizzo & Impatto Culturale:** totale delle consultazioni ricevute sulle schede libro (`metriche_visite`), contatti totali attivati, durata media dei prestiti (in giorni) e calcolo dell'**Indice di Impatto Culturale Hermae** (algoritmo pesato basato su volumi catalogati, prestiti conclusi, letture e visite).
2. **Risoluzione della Difficoltà di Fase — Elaborazione Efficiente Senza Query Onerose:**
   - Superamento del pattern anti-prestazionale "N+1 query" attraverso la progettazione di una **query CTE (Common Table Expression) a passata singola**, che raccoglie in un'unica round-trip verso PostgreSQL l'intero quadro dei KPI aggregati;
   - Generazione della serie temporale mensile nativamente nel motore relazionale tramite `generate_series` e `LEFT JOIN` aggregati, garantendo continuità cronologica senza buchi temporali e senza iterazioni onerose nel layer applicativo Node.js;
   - Aggiunta nel database di indici B-Tree mirati su `metriche_visite(esemplare_id)`, `metriche_visite(data_evento DESC)` e indici composti su `richieste_prestito(proprietario_id, stato)`, `richieste_prestito(richiedente_id, stato)` ed `esemplari(utente_id, stato_disponibilita)`;
   - Tempo medio di esecuzione della query analitica registrato: **~20 millisecondi**, garantendo massima reattività anche sotto carico concorrente.
3. **Tracciamento Anonimizzato delle Consultazioni:**
   - Registrazione asincrona e non-bloccante degli eventi di visualizzazione delle schede libro (`VISUALIZZAZIONE_SCHEDA`) all'interno della tabella `metriche_visite`;
   - Integrazione automatica in `GET /api/esemplari/:id` (escludendo le auto-consultazioni del proprietario);
   - Endpoint dedicato `POST /api/analytics/visita` con validazione dei parametri e `GET /api/analytics/top-libri` per la graduatoria dei titoli più consultati.
4. **Cruscotto Analitico e Grafici Reattivi (`hermae-frontend/dashboard.html`):**
   - Integrazione della libreria **Chart.js 4** in modalità UMD;
   - **Grafico a Linee (Trend Attività Culturali):** visualizzazione dell'andamento mensile multi-serie con curve spline (Volumi Aggiunti, Prestiti Concessi, Letture Archiviate, Consultazioni Schede);
   - **Grafico a Ciambella (Composizione per Categoria):** ripartizione tematica dei generi letterari presenti nella libreria, colorati secondo la palette esadecimale ufficiale di ciascuna categoria;
   - **Toolbar con Filtri di Periodo:** selettori rapidi per 30 Giorni (`30d`), 6 Mesi (`6m`, predefinito), 1 Anno (`1y`) e Tutto lo storico (`all`);
   - **Classifica "Volumi Più Consultati":** elenco dei titoli del proprietario con il maggior numero di visite, copertina/miniatura, categoria e conteggio prestiti;
   - **Indicatori di Efficienza & Prossimità:** barra del tasso di successo, durata media e bilanciamento pubblico/privato;
   - **Accessibilità WCAG 2.1 AA:** pulsante toggle "Tabella Dati" che espone le medesime informazioni dei grafici in formato tabellare accessibile per screen reader e navigazione da tastiera;
   - Predisposizione di alias di reindirizzamento trasparente (`statistiche.html` e `analytics.html`).

---

## 2. Architettura di Interrogazione Aggregata Ottimizzata (Single-Pass CTE)

Per azzerare l'onere computazionale sul database relazionale, il metodo `getDashboardAnalytics` in `server/src/services/analyticsService.js` adotta una struttura a Common Table Expressions che esegue scansioni indicizzate parallele:

```sql
WITH 
libri_summary AS (
  SELECT
    COUNT(*)::int AS totale_libri,
    COUNT(*) FILTER (WHERE stato_disponibilita = 'DISPONIBILE')::int AS libri_disponibili,
    COUNT(*) FILTER (WHERE stato_disponibilita = 'IN_PRESTITO')::int AS libri_in_prestito,
    COUNT(*) FILTER (WHERE stato_disponibilita = 'NON_DISPONIBILE')::int AS libri_non_disponibili,
    COUNT(*) FILTER (WHERE visibile_pubblico = TRUE)::int AS libri_pubblici,
    COUNT(*) FILTER (WHERE visibile_pubblico = FALSE)::int AS libri_privati
  FROM esemplari
  WHERE utente_id = $1
),
prestiti_concessi AS (
  SELECT
    COUNT(*)::int AS totale_richieste_ricevute,
    COUNT(*) FILTER (WHERE stato = 'IN_ATTESA')::int AS prestiti_in_attesa,
    COUNT(*) FILTER (WHERE stato IN ('IN_PRESTITO', 'ACCETTATA'))::int AS prestiti_attivi,
    COUNT(*) FILTER (WHERE stato IN ('RESTITUITO', 'COMPLETATA'))::int AS prestiti_completati,
    COUNT(*) FILTER (WHERE stato = 'RIFIUTATA')::int AS prestiti_rifiutati,
    COUNT(*) FILTER (WHERE stato = 'ANNULLATA')::int AS prestiti_annullati,
    COALESCE(AVG(durata_giorni) FILTER (WHERE stato IN ('RESTITUITO', 'COMPLETATA')), 30)::numeric(10,1) AS durata_media_prestito
  FROM richieste_prestito
  WHERE proprietario_id = $1
),
letture_ricevute AS (
  SELECT
    COUNT(*)::int AS totale_richieste_inviate,
    COUNT(*) FILTER (WHERE stato = 'IN_ATTESA')::int AS letture_in_attesa,
    COUNT(*) FILTER (WHERE stato IN ('IN_PRESTITO', 'ACCETTATA'))::int AS letture_in_corso,
    COUNT(*) FILTER (WHERE stato IN ('RESTITUITO', 'COMPLETATA'))::int AS letture_completate
  FROM richieste_prestito
  WHERE richiedente_id = $1
),
visite_ricevute AS (
  SELECT
    COUNT(mv.id)::int AS totale_visualizzazioni
  FROM metriche_visite mv
  JOIN esemplari e ON mv.esemplare_id = e.id
  WHERE e.utente_id = $1
)
SELECT ls.*, pc.*, lr.*, vr.*
FROM libri_summary ls
CROSS JOIN prestiti_concessi pc
CROSS JOIN letture_ricevute lr
CROSS JOIN visite_ricevute vr;
```

La serie storica mensile per i grafici lineari viene generata in PostgreSQL garantendo l'integrità degli intervalli senza buchi temporali:

```sql
WITH date_series AS (
  SELECT 
    date_trunc('month', series_date) AS mese_inizio,
    (date_trunc('month', series_date) + interval '1 month' - interval '1 millisecond') AS mese_fine,
    to_char(series_date, 'Mon YY') AS mese_label,
    to_char(series_date, 'YYYY-MM') AS mese_codice
  FROM generate_series(
    date_trunc('month', NOW() - ($2 || ' months')::interval),
    date_trunc('month', NOW()),
    '1 month'::interval
  ) AS series_date
)
SELECT 
  ds.mese_label, ds.mese_codice,
  COALESCE(e_agg.conteggio_libri, 0)::int AS libri_aggiunti,
  COALESCE(p_agg.conteggio_prestiti, 0)::int AS prestiti_concessi,
  COALESCE(l_agg.conteggio_letture, 0)::int AS letture_completate,
  COALESCE(v_agg.conteggio_visite, 0)::int AS visualizzazioni
FROM date_series ds
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS conteggio_libri FROM esemplari
  WHERE utente_id = $1 AND data_creazione >= ds.mese_inizio AND data_creazione <= ds.mese_fine
) e_agg ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS conteggio_prestiti FROM richieste_prestito
  WHERE proprietario_id = $1 AND stato IN ('IN_PRESTITO', 'ACCETTATA', 'RESTITUITO', 'COMPLETATA')
    AND data_richiesta >= ds.mese_inizio AND data_richiesta <= ds.mese_fine
) p_agg ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS conteggio_letture FROM richieste_prestito
  WHERE richiedente_id = $1 AND stato IN ('RESTITUITO', 'COMPLETATA')
    AND data_restituzione >= ds.mese_inizio AND data_restituzione <= ds.mese_fine
) l_agg ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS conteggio_visite FROM metriche_visite mv
  JOIN esemplari e ON mv.esemplare_id = e.id
  WHERE e.utente_id = $1 AND mv.data_evento >= ds.mese_inizio AND mv.data_evento <= ds.mese_fine
) v_agg ON TRUE
ORDER BY ds.mese_inizio ASC;
```

---

## 3. Modello Dati e Migrazioni DDL

Nel file `INFO-DATABASE/schema.sql` e sul database PostgreSQL sono stati applicati gli indici B-Tree necessari a velocizzare le aggregazioni analitiche:

```sql
-- Indici B-Tree specifici per le query analitiche e di tracciamento (Fase 24)
CREATE INDEX IF NOT EXISTS idx_metriche_visite_esemplare ON metriche_visite (esemplare_id);
CREATE INDEX IF NOT EXISTS idx_metriche_visite_data ON metriche_visite (data_evento DESC);
CREATE INDEX IF NOT EXISTS idx_metriche_visite_tipo ON metriche_visite (tipo_evento);
CREATE INDEX IF NOT EXISTS idx_richieste_proprietario_stato ON richieste_prestito (proprietario_id, stato);
CREATE INDEX IF NOT EXISTS idx_richieste_richiedente_stato ON richieste_prestito (richiedente_id, stato);
CREATE INDEX IF NOT EXISTS idx_esemplari_utente_disp ON esemplari (utente_id, stato_disponibilita);
```

---

## 4. Elenco Filesystem dei File Creati e Modificati

```text
INFO-DATABASE/
└── schema.sql                              # [MODIFY] Aggiunta indici B-tree per metriche_visite e aggregazioni

server/
├── src/
│   ├── services/
│   │   └── analyticsService.js             # [NEW] Query CTE single-pass, serie temporali e tracciamento visite
│   ├── controllers/
│   │   ├── analyticsController.js          # [NEW] Controller REST per KPI, grafici, top libri e visite
│   │   └── esemplariController.js          # [MODIFY] Tracciamento automatico visualizzazioni in getBookById
│   └── routes/
│       ├── index.js                        # [MODIFY] Registrazione endpoint /api/analytics e /api/statistiche
│       └── analyticsRoutes.js              # [NEW] Rotte protette JWT per analytics e metriche
└── test_fase24.js                          # [NEW] Test suite automatizzata end-to-end (20 asserzioni formali)

hermae-frontend/
├── dashboard.html                          # [MODIFY] Dashboard analitica completa con Chart.js 4 e tabelle accessibili
├── statistiche.html                        # [NEW] Alias di reindirizzamento trasparente a dashboard.html
└── analytics.html                          # [NEW] Alias di reindirizzamento trasparente a dashboard.html
```

---

## 5. Risultati del Collaudo e Metriche di Validazione

La suite di test automatizzati [`server/test_fase24.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase24.js) è stata eseguita con esito **100% positivo** su 8 aree di verifica:

1. **Parte 1 — Protezione Endpoint e Accesso Autenticato:**
   - Blocco richieste non autenticate su `/api/analytics` con codice HTTP 401 ($1/1$ superato);
   - Accesso autenticato con token JWT valido e payload strutturato con codice HTTP 200 ($1/1$ superato);
   - Funzionalità e coerenza dell'endpoint alias `/api/statistiche` ($1/1$ superato);
2. **Parte 2 — Validazione Metriche e KPI di Sintesi:**
   - Coerenza contatori volumi (totale = disponibili + in prestito + non disponibili = pubblici + privati) ($1/1$ superato);
   - Validazione struttura prestiti concessi e tasso di successo percentuale ($1/1$ superato);
   - Validazione struttura letture archiviate e richieste in corso ($1/1$ superato);
   - Calcolo algoritmo Indice di Impatto Culturale Hermae ($1/1$ superato);
3. **Parte 3 — Generazione Serie Storica Mensile e Filtri:**
   - Serie temporale di default a 6 mesi continua e priva di valori nulli ($1/1$ superato);
   - Filtro temporale `?periodo=1y` con 12 intervalli mensili ($1/1$ superato);
   - Filtro temporale `?periodo=30d` ($1/1$ superato);
4. **Parte 4 — Ripartizione Tematica per Categorie Letterarie:**
   - Raggruppamento per generi valido e conteggi associati ($1/1$ superato);
   - Presenza dei codici colore HEX ufficiali e coerenza con il totale volumi ($1/1$ superato);
5. **Parte 5 — Tracciamento Consultazioni (`metriche_visite`):**
   - Validazione input `POST /api/analytics/visita` con codice HTTP 400 su parametri mancanti ($1/1$ superato);
   - Registrazione evento consultazione confermata su database ($1/1$ superato);
   - Tracciamento automatico integrato in `GET /api/esemplari/:id` con incremento visualizzazioni ($1/1$ superato);
6. **Parte 6 — Classifica Libri Più Consultati:**
   - Recupero top libri e rispetto del limite di visualizzazione con codice HTTP 200 ($1/1$ superato);
7. **Parte 7 — Schermatura IDOR e Riservatezza Utente:**
   - Isolamento perimetrale dei dati analitici tra utenti differenti confermato ($1/1$ superato);
   - Tracciamento e riservatezza dei volumi privati preservati nella dashboard personale ($1/1$ superato);
8. **Parte 8 — Efficienza Computazionale (Risoluzione Difficoltà di Fase):**
   - Tempo di esecuzione della query aggregata CTE confermato in soli **22ms** ($< 150\text{ms}$) ($1/1$ superato);
   - 3 richieste analitiche concorrenti elaborate in parallelo in **29ms** senza degrado prestazionale ($1/1$ superato).

**Totale Asserzioni Superate:** $20/20$ ($100\%$ pass rate).  
**Regressione Fasi Precedenti:**  
- Fase 23 (Ciclo Prestito, Lock Concorrenza & Tracking): $20/20$ superati;  
- Fase 22 (Contatto & Privacy Shield): $19/19$ superati;  
- Fase 21 (Ricerca Geospaziale): $19/19$ superati;  
- Fase 20 (Occultamento e Privacy): $28/28$ superati;  
- Fase 19 (CRUD Libri & Upload Copertina): $40/40$ superati.  
**Totale Asserzioni di Regressione:** $126/126$ ($100\%$ success rate).  
**Totale Generale Test Eseguiti:** $146/146$ ($100\%$ success rate).
