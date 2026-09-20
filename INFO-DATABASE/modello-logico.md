# Modello Logico-Relazionale della Base di Dati

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `INFO-DATABASE/`  

---

## 1. Dal Modello Concettuale al Modello Logico

La traduzione del modello concettuale Entità-Relazione nello schema logico-relazionale segue le regole standard dell'ingegneria dei dati:
- Ciascuna entità è tradotta in una **relazione (tabella)** indipendente;
- Tutte le relazioni cardinali 1:N sono implementate mediante inclusione della **chiave primaria (PK) del lato "1" come chiave esterna (FK)** nella tabella del lato "N";
- Tutte le chiavi primarie ed esterne adottano il tipo di dato nativo **UUID (RFC 4122)** per ragioni di sicurezza, non enumerabilità e scalabilità;
- Le entità territoriali sono mappate sul tipo geospaziale nativo **`GEOMETRY(Point, 4326)`** (WGS 84).

---

## 2. Verifica della Normalizzazione (3FN - Terza Forma Normale)

Lo schema relazionale rispetta rigorosamente i requisiti della **Terza Forma Normale (3FN)**:
1. **Prima Forma Normale (1FN):** Tutti gli attributi contengono esclusivamente valori atomici (non ripetuti, non composti o multicolonna).
2. **Seconda Forma Normale (2FN):** È in 1FN e ciascun attributo non-chiave dipende interamente dall'intera chiave primaria (requisito banalmente soddisfatto essendo tutte le chiavi primarie semplici/atomiche su base UUID).
3. **Terza Forma Normale (3FN):** È in 2FN e nessun attributo non-chiave dipende transitivamente dalla chiave primaria (assenza di dipendenze funzionali tra attributi non-chiave; i dati di categoria, autore ed esemplare risiedono nelle rispettive relazioni).

---

## 3. Notazione Relazionale Sintetica degli Schemi

In notazione formale (in grassetto la chiave primaria **PK**, con asterisco le chiavi esterne **FK\***):

* **UTENTI** (**id**, email, password_hash, nome, cognome, citta, coordinate_reali, coordinate_offuscate, consenso_privacy, consenso_geo, data_registrazione)
* **CATEGORIE** (**id**, nome, slug, descrizione)
* **ESEMPLARI** (**id**, utente_id\*, categoria_id\*, titolo, autore, anno_pubblicazione, isbn, descrizione, stato_conservazione, stato_disponibilita, immagine_copertina, immagine_miniatura, coordinate_esemplare, data_creazione)
* **RICHIESTE_PRESTITO** (**id**, esemplare_id\*, richiedente_id\*, proprietario_id\*, stato, messaggio_iniziale, data_richiesta, data_aggiornamento)
* **MESSAGGI_CHAT** (**id**, richiesta_id\*, mittente_id\*, testo, letto, data_invio)
* **METRICHE_VISITE** (**id**, esemplare_id\*, tipo_evento, citta, data_evento)

---

## 4. Dizionario Dati Logico delle Tabelle

### 4.1 Tabella `utenti`
Memorizza i profili registrati, le credenziali cifrate con `bcrypt` e le coordinate territoriali per il calcolo delle distanze.

| Colonna | Tipo SQL | Null | Vincoli & Default | Descrizione e Ruolo Logico |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PK, DEFAULT gen_random_uuid()` | Identificatore univoco globale dell'utente. |
| `email` | `VARCHAR(255)` | No | `UNIQUE` | Indirizzo email (login univoco di accesso). |
| `password_hash` | `VARCHAR(255)` | No | — | Hash crittografico delle credenziali (`bcrypt` salt $\ge 12$). |
| `nome` | `VARCHAR(100)` | No | — | Nome anagrafico dell'utente. |
| `cognome` | `VARCHAR(100)` | No | — | Cognome anagrafico dell'utente. |
| `citta` | `VARCHAR(100)` | No | — | Comune/Città per il raggruppamento e filtri su scala urbana. |
| `coordinate_reali` | `GEOMETRY(Point, 4326)` | No | — | Posizione spaziale WGS 84 (riservata per query GIS interne). |
| `coordinate_offuscate` | `GEOMETRY(Point, 4326)` | No | — | Centroide o punto perturbato (raggio confidenzialità 300–500 m). |
| `consenso_privacy` | `BOOLEAN` | No | `DEFAULT FALSE` | Consenso informato al trattamento dei dati personali (GDPR). |
| `consenso_geo` | `BOOLEAN` | No | `DEFAULT FALSE` | Consenso informato alla geolocalizzazione culturale. |
| `data_registrazione` | `TIMESTAMP` | No | `DEFAULT CURRENT_TIMESTAMP` | Data e ora di creazione account. |

### 4.2 Tabella `categorie`
Tassonomia disciplinare controllata per la classificazione e i filtri di ricerca degli esemplari.

| Colonna | Tipo SQL | Null | Vincoli & Default | Descrizione e Ruolo Logico |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PK, DEFAULT gen_random_uuid()` | Identificatore univoco della categoria tematica. |
| `nome` | `VARCHAR(100)` | No | `UNIQUE` | Nome visualizzato (es. *Narrativa*, *Informatica*, *Storia*). |
| `slug` | `VARCHAR(100)` | No | `UNIQUE` | Stringa URL-friendly per filtri di navigazione web. |
| `descrizione` | `TEXT` | Sì | — | Descrizione estesa dell'ambito della categoria. |

### 4.3 Tabella `esemplari` *(Ex Libri)*
Catalogo delle copie fisiche materiali possedute dai privati, con metadati bibliografici editoriali e collocazione geografica.

| Colonna | Tipo SQL | Null | Vincoli & Default | Descrizione e Ruolo Logico |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PK, DEFAULT gen_random_uuid()` | Identificatore univoco dell'esemplare fisico. |
| `utente_id` | `UUID` | No | `FK -> utenti(id) ON DELETE CASCADE` | Proprietario della copia (se l'utente si cancella, i libri decadono). |
| `categoria_id` | `UUID` | No | `FK -> categorie(id) ON DELETE RESTRICT` | Categoria di appartenenza (eliminazione bloccata se ci sono copie). |
| `titolo` | `VARCHAR(255)` | No | — | Titolo dell'opera (`schema.org/Book: name`). |
| `autore` | `VARCHAR(255)` | No | — | Autore dell'opera (`schema.org/Book: author`). |
| `anno_pubblicazione` | `SMALLINT` | Sì | — | Anno di edizione dell'esemplare posseduto. |
| `isbn` | `VARCHAR(20)` | Sì | — | Codice ISBN-10 o ISBN-13 (per ricerche bibliografiche dirette). |
| `descrizione` | `TEXT` | Sì | — | Note d'edizione o breve sinossi. |
| `stato_conservazione` | `VARCHAR(50)` | No | `DEFAULT 'Buono'` | Condizione fisica (es. *Come nuovo*, *Buono*, *Usurato*). |
| `stato_disponibilita` | `VARCHAR(30)` | No | `DEFAULT 'DISPONIBILE'` | Stato copia: `DISPONIBILE`, `IN_PRESTITO`, `NON_DISPONIBILE`. |
| `immagine_copertina` | `VARCHAR(255)` | Sì | — | Percorso relativo dell'immagine standard WebP (800px). |
| `immagine_miniatura` | `VARCHAR(255)` | Sì | — | Percorso relativo del thumbnail compresso WebP (200px). |
| `coordinate_esemplare`| `GEOMETRY(Point, 4326)` | No | — | Collocazione territoriale con raggio di confidenzialità (300–500 m). |
| `data_creazione` | `TIMESTAMP` | No | `DEFAULT CURRENT_TIMESTAMP` | Data e ora di inserimento nel catalogo. |

### 4.4 Tabella `richieste_prestito`
Modella la transazione peer-to-peer per l'accesso a un esemplare e ne gestisce la macchina a stati finiti.

| Colonna | Tipo SQL | Null | Vincoli & Default | Descrizione e Ruolo Logico |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PK, DEFAULT gen_random_uuid()` | Identificatore univoco della richiesta di prestito. |
| `esemplare_id` | `UUID` | No | `FK -> esemplari(id) ON DELETE CASCADE` | Esemplare fisico richiesto. |
| `richiedente_id` | `UUID` | No | `FK -> utenti(id) ON DELETE CASCADE` | Utente fruitore che inoltra la richiesta. |
| `proprietario_id` | `UUID` | No | `FK -> utenti(id) ON DELETE CASCADE` | Utente proprietario che riceve la richiesta. |
| `stato` | `VARCHAR(30)` | No | `DEFAULT 'IN_ATTESA'` | Stato: `IN_ATTESA`, `ACCETTATA`, `RIFIUTATA`, `CONCLUSA`. |
| `messaggio_iniziale` | `TEXT` | Sì | — | Messaggio iniziale di contatto tra le parti. |
| `data_richiesta` | `TIMESTAMP` | No | `DEFAULT CURRENT_TIMESTAMP` | Timestamp di invio richiesta. |
| `data_aggiornamento` | `TIMESTAMP` | No | `DEFAULT CURRENT_TIMESTAMP` | Timestamp dell'ultimo cambio di stato. |

### 4.5 Tabella `messaggi_chat`
Messaggistica testuale asincrona tra richiedente e proprietario, vincolata a un thread di prestito.

| Colonna | Tipo SQL | Null | Vincoli & Default | Descrizione e Ruolo Logico |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PK, DEFAULT gen_random_uuid()` | Identificatore univoco del singolo messaggio. |
| `richiesta_id` | `UUID` | No | `FK -> richieste_prestito(id) ON DELETE CASCADE` | Richiesta di prestito di riferimento. |
| `mittente_id` | `UUID` | No | `FK -> utenti(id) ON DELETE CASCADE` | Utente mittente. |
| `testo` | `TEXT` | No | — | Testo del messaggio. |
| `letto` | `BOOLEAN` | No | `DEFAULT FALSE` | Stato di lettura del messaggio per notifiche badge. |
| `data_invio` | `TIMESTAMP` | No | `DEFAULT CURRENT_TIMESTAMP` | Timestamp di invio. |

### 4.6 Tabella `metriche_visite`
Tracciamento analitico anonimizzato delle interazioni sugli esemplari a supporto della dashboard amministrativa.

| Colonna | Tipo SQL | Null | Vincoli & Default | Descrizione e Ruolo Logico |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PK, DEFAULT gen_random_uuid()` | Identificatore univoco dell'evento registrato. |
| `esemplare_id` | `UUID` | Sì | `FK -> esemplari(id) ON DELETE SET NULL` | Esemplare consultato (null se l'evento è generico). |
| `tipo_evento` | `VARCHAR(50)` | No | — | Evento: `VISUALIZZAZIONE_SCHEDA`, `RICERCA_SPAZIALE`, `PRESTITO_AVVIATO`. |
| `citta` | `VARCHAR(100)` | Sì | — | Città dell'interazione per analisi territoriali aggregate. |
| `data_evento` | `TIMESTAMP` | No | `DEFAULT CURRENT_TIMESTAMP` | Timestamp dell'evento. |

---

## 5. Politiche di Integrità Referenziale e Vincoli di Chiave Esterna

Le clausole di integrità referenziale garantiscono la consistenza transazionale del database:
1. **`ON DELETE CASCADE` su Utenti ed Esemplari:** Se un utente cancella il proprio account, tutti i suoi esemplari fisici, richieste e messaggi associati vengono contestualmente eliminati per rispetto del principio di cancellazione GDPR (diritto all'oblio).
2. **`ON DELETE RESTRICT` su Categorie:** Impedisce la rimozione accidentale di una categoria tematica qualora vi siano ancora esemplari associati ad essa.
3. **`ON DELETE SET NULL` su Metriche:** Se un esemplare viene rimosso dal proprietario, i dati analitici storici di visualizzazione vengono conservati in forma aggregata/anonima ponendo la chiave a `NULL`.

---

## 6. Strategia di Indicizzazione Logica

- **Indici Spaziali GiST (Generalized Search Tree):** Definiti su `esemplari(coordinate_esemplare)` e `utenti(coordinate_offuscate)` per consentire l'esecuzione delle funzioni di distanza geodesica PostGIS (`ST_DWithin`) con tempi di risposta stabili sotto i 200 ms.
- **Indici B-Tree su Chiavi Esterne (UUID):** Definiti su tutti i campi di relazione (`utente_id`, `categoria_id`, `esemplare_id`, `richiedente_id`, `proprietario_id`, `richiesta_id`) per ottimizzare le operazioni di `JOIN` tra tabelle.
- **Indici B-Tree su Campi di Ricerca Testuale:** Indici specifici su `esemplari(titolo)`, `esemplari(autore)`, `esemplari(isbn)` e `esemplari(stato_disponibilita)`.
