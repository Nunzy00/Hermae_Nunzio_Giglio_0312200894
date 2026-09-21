# Diagramma Entità-Relazione (Schema E-R Concettuale e Logico 3FN)

> **Progetto:** Hermae — *"Il sapere, un libro alla volta"*  
> **Candidato:** Nunzio Giglio (Matricola: 0312200894)  
> **Corso di Laurea:** Informatica per le Aziende Digitali (L-31) — Università Telematica Pegaso  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14**  
> **Collocazione:** Cartella `MULTIMEDIA/` — Documentazione Tecnica e Tesi  

---

## 1. Descrizione del Modello dei Dati

La persistenza di **Hermae** poggia su un database relazionale avanzato (**PostgreSQL 15+**) strutturato secondo la **Terza Forma Normale (3FN)** per eliminare le anomalie di inserimento, modifica e cancellazione. Il modello dati è concepito per soddisfare tre pilastri architetturali:

1. **Standard Catalografico IFLA LRM / FRBR:** Netta distinzione concettuale tra *Categoria/Opera* ed *Esemplare fisico* (`ESEMPLARI`), inteso come singola copia materiale detenuta da un cittadino, caratterizzata da usura, note bibliografiche, collocazione geospaziale e storico transazionale.
2. **Privacy by Design e Sovranità del Dato:** Scorporo dell'utente nelle entità correlate 1:1 `POSIZIONE_UTENTI` e `PREFERENZE_PRIVACY_UTENTI`, con gestione del registro audit del consenso conforme a GDPR ed ePrivacy (`CONSENSI_CMP_UTENTI`).
3. **Identificatori Crittografici Globali (UUID v4):** Tutte le tabelle adottano chiavi primarie `UUID v4` generate crittograficamente (`gen_random_uuid()`), precludendo attacchi di enumerazione sequenziale (IDOR).

---

## 2. Diagramma Entità-Relazione Completo (Mermaid)

```mermaid
erDiagram
    UTENTI ||--|| POSIZIONE_UTENTI : "ha_localizzazione (1:1)"
    UTENTI ||--|| PREFERENZE_PRIVACY_UTENTI : "definisce_privacy (1:1)"
    UTENTI ||--o{ CONSENSI_CMP_UTENTI : "esprime_consenso (1:N)"
    UTENTI ||--o{ ESEMPLARI : "possiede_custodisce (1:N)"
    CATEGORIE ||--o{ ESEMPLARI : "classifica_disciplina (1:N)"
    UTENTI ||--o{ RICHIESTE_PRESTITO : "invia_come_richiedente (1:N)"
    UTENTI ||--o{ RICHIESTE_PRESTITO : "riceve_come_proprietario (1:N)"
    ESEMPLARI ||--o{ RICHIESTE_PRESTITO : "e_oggetto_di (1:N)"
    RICHIESTE_PRESTITO ||--o{ MESSAGGI_CHAT : "origina_conversazione (1:N)"
    UTENTI ||--o{ MESSAGGI_CHAT : "invia_messaggio (1:N)"
    UTENTI ||--o{ NOTIFICHE : "riceve_notifiche (1:N)"
    RICHIESTE_PRESTITO ||--o{ NOTIFICHE : "genera_evento (1:N)"
    ESEMPLARI ||--o{ METRICHE_VISITE : "registra_telemetria (1:N)"

    UTENTI {
        uuid id PK "gen_random_uuid()"
        string email UK "RFC 5322"
        string password_hash "bcrypt 10-rounds"
        string nome "max 100 char"
        string cognome "max 100 char"
        string citta "domicilio dichiarato"
        point coordinate_reali "WGS 84 esatte"
        point coordinate_offuscate "punto pubblico sfumato"
        boolean consenso_privacy "GDPR art. 6/7"
        boolean consenso_geo "consenso geolocalizzazione"
        timestamp data_registrazione "DEFAULT now()"
    }

    POSIZIONE_UTENTI {
        uuid id PK
        uuid utente_id FK,UK "ON DELETE CASCADE"
        string citta
        string indirizzo_approssimato "via/piazza senza civico"
        numeric latitudine "precision 10,7"
        numeric longitudine "precision 10,7"
        point coordinate_reali "punto esatto per Haversine"
        point coordinate_offuscate "punto pubblico con jitter"
        integer raggio_ricerca_km "DEFAULT 5 km"
        timestamp data_aggiornamento
    }

    PREFERENZE_PRIVACY_UTENTI {
        uuid id PK
        uuid utente_id FK,UK "ON DELETE CASCADE"
        boolean profilo_pubblico "DEFAULT false"
        boolean mostra_posizione "DEFAULT true"
        boolean mostra_libreria "DEFAULT true"
        boolean mostra_email "DEFAULT false"
        integer raggio_visibilita_km "DEFAULT 10 km"
        boolean consenti_messaggi_diretti "DEFAULT true"
        string modalita_occultamento "QUARTIERE, AREA_CAP, TOTALE"
        timestamp data_aggiornamento
    }

    CATEGORIE {
        uuid id PK
        string nome UK "macro-categoria Livello 1"
        string slug UK "URL slug indicizzato"
        text descrizione
        string icona "Bootstrap Icon class"
        string colore_hex "colore tematico esadecimale"
        string_array sottogeneri_predefiniti "vocabolario Livello 2"
    }

    ESEMPLARI {
        uuid id PK
        uuid utente_id FK "ON DELETE CASCADE"
        uuid categoria_id FK "ON DELETE RESTRICT"
        string sottogenere "sottogenere specifico Liv. 2"
        string titolo "titolo dell'opera"
        string autore "autore/i"
        string editore
        smallint anno_pubblicazione
        string isbn "ISBN-10 o ISBN-13"
        string lingua "DEFAULT Italiano"
        text descrizione "sinossi"
        text note "dediche, edizioni speciali"
        string stato_conservazione "Ottimo, Buono, Discreto, Usurato"
        string stato_disponibilita "DISPONIBILE, IN_PRESTITO, NON_DISPONIBILE"
        string immagine_copertina "path WebP 800x1200"
        string immagine_miniatura "path WebP 200x300"
        point coordinate_esemplare "GiST WGS 84 offuscato"
        boolean visibile_pubblico "DEFAULT true"
        string titolarita "PROPRIETA, CUSTODIA"
        timestamp data_creazione
    }

    RICHIESTE_PRESTITO {
        uuid id PK
        uuid esemplare_id FK "ON DELETE CASCADE"
        uuid richiedente_id FK "ON DELETE CASCADE"
        uuid proprietario_id FK "ON DELETE CASCADE"
        string stato "IN_ATTESA, ACCETTATA, RIFIUTATA, IN_CORSO, RESTITUITO, ANNULLATA"
        text messaggio_iniziale
        integer durata_giorni "DEFAULT 30 gg"
        timestamp data_inizio
        timestamp data_scadenza
        timestamp data_restituzione
        text note_restituzione
        timestamp data_richiesta
        timestamp data_aggiornamento
    }

    MESSAGGI_CHAT {
        uuid id PK
        uuid richiesta_id FK "ON DELETE CASCADE"
        uuid mittente_id FK "ON DELETE CASCADE"
        text testo "filtrato da Privacy Shield"
        boolean letto "DEFAULT false"
        timestamp data_invio
    }

    NOTIFICHE {
        uuid id PK
        uuid utente_id FK "ON DELETE CASCADE"
        uuid richiesta_id FK "ON DELETE CASCADE"
        string tipo "RICHIESTA, ACCETTAZIONE, CHAT, RESTITUZIONE"
        string titolo
        text messaggio
        boolean letta "DEFAULT false"
        timestamp data_creazione
    }

    METRICHE_VISITE {
        uuid id PK
        uuid esemplare_id FK "ON DELETE SET NULL"
        string tipo_evento "VISUALIZZAZIONE, RICERCA_MAPPA, CONDIVISIONE"
        string citta "localizzazione statistica"
        timestamp data_evento
    }

    CONSENSI_CMP_UTENTI {
        uuid id PK
        uuid utente_id FK "ON DELETE CASCADE"
        string consenso_id UK "token crittografico CMP"
        string versione_policy "DEFAULT 1.0"
        boolean necessari "DEFAULT true"
        boolean funzionali
        boolean analitici
        boolean servizi_terzi "DEFAULT false"
        string indirizzo_ip_anonimizzato "trunc subnet /24"
        text user_agent
        timestamp data_espressione
        timestamp data_aggiornamento
    }
```

---

## 3. Dettaglio delle Relazioni e Vincoli di Integrità

### Cardinalità delle Relazioni
| Relazione | Entità Coinvolte | Cardinalità | Regola di Integrità Referenziale |
| :--- | :--- | :---: | :--- |
| **Localizzazione Utente** | `UTENTI` $\leftrightarrow$ `POSIZIONE_UTENTI` | **1 : 1** | Ciascun utente ha esattamente una configurazione territoriale. `ON DELETE CASCADE`. |
| **Privacy Utente** | `UTENTI` $\leftrightarrow$ `PREFERENZE_PRIVACY_UTENTI` | **1 : 1** | Impostazioni di riservatezza strettamente vincolate al profilo. `ON DELETE CASCADE`. |
| **Audit Consensi CMP** | `UTENTI` $\rightarrow$ `CONSENSI_CMP_UTENTI` | **1 : N** | Storico dei consensi cookie ed ePrivacy con timestamp di espressione e revisione. |
| **Possesso Esemplari** | `UTENTI` $\rightarrow$ `ESEMPLARI` | **1 : N** | Un utente può catalogare molteplici libri fisici; ogni copia appartiene a un unico custode. |
| **Classificazione** | `CATEGORIE` $\rightarrow$ `ESEMPLARI` | **1 : N** | Ciascun esemplare appartiene a una sola macro-categoria. Vincolo `ON DELETE RESTRICT`. |
| **Richiesta Prestito** | `UTENTI` / `ESEMPLARI` $\rightarrow$ `RICHIESTE_PRESTITO` | **1 : N** | Coinvolge richiedente, proprietario ed esemplare. Gestita a transazioni atomiche. |
| **Messaggistica Privata** | `RICHIESTE_PRESTITO` $\rightarrow$ `MESSAGGI_CHAT` | **1 : N** | Ogni richiesta attiva un canale di chat bidirezionale confidenziale. |
| **Sistema Notifiche** | `UTENTI` $\rightarrow$ `NOTIFICHE` | **1 : N** | Segnalazioni asincrone di cambi di stato o nuovi messaggi ricevuti. |
| **Telemetria Culturale** | `ESEMPLARI` $\rightarrow$ `METRICHE_VISITE` | **1 : N** | Rilevamento analitico anonimizzato delle consultazioni. Vincolo `ON DELETE SET NULL`. |

### Indici Geospaziali e Prestazionali
1. **Indici GiST (Generalized Search Tree):** Definiti sulle colonne `coordinate_esemplare`, `coordinate_offuscate` e tramite estensione `earthdistance` (`cube`), riducendo la complessità di ricerca da $\mathcal{O}(N)$ a $\mathcal{O}(\log N)$.
2. **Indici B-Tree Composti:** Applicati sulle chiavi esterne ad alta frequenza di join, in particolare su `(esemplare_id, stato)` e `(proprietario_id, stato)` in `RICHIESTE_PRESTITO`, garantendo latenze inferiori a 2 ms anche su milioni di tuple.
