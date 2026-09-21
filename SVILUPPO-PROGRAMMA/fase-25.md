# Fase 25 — Implementazione CMP (Consent Management Platform)

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-25.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stato implementato un sistema di **Consent Management Platform (CMP) ad hoc** per gestire in modo trasparente, granulare e conforme alle normative vigenti (**Regolamento UE 2016/679 - GDPR**, Linee Guida Cookie del Garante Privacy e **Direttiva ePrivacy 2002/58/CE**) il consenso informato relativo ai dati raccolti dal programma e agli eventuali servizi terzi infrastrutturali.

Nel dettaglio, le attività realizzate hanno compreso:
1. **Modellazione Relazionale dell'Audit Trail dei Consensi:**
   - Creazione della tabella dedicata `consensi_cmp_utenti` su PostgreSQL, strutturata per conservare lo storico e la prova del consenso informato (Principio di Accountability, Art. 5(2) e Art. 7(1) GDPR);
   - Supporto ibrido sia per utenti autenticati (`utente_id` con chiave esterna a cascata) sia per visitatori anonimi / pre-login (`consenso_id` pseudonimo generato crittograficamente e persistito in `localStorage`);
   - Tracciamento della versione della policy (`versione_policy = '1.0'`), timestamp di espressione e di aggiornamento, user agent e indirizzo IP con **mascheramento dell'ultimo ottetto** a tutela della privacy.
2. **Definizione delle 4 Categorie di Trattamento (Privacy by Default, Art. 25 GDPR):**
   - **1. Dati Tecnici & Cookie Essenziali (Necessari):** Indispensabili per autenticazione JWT, sicurezza di sessione, prevenzione CSRF e stabilità relazionale. Sempre attivi per legittimo interesse (Art. 6(1)(f) GDPR);
   - **2. Funzionali & Preferenze di Navigazione:** Memorizzazione della visualizzazione preferita dello scaffale 3D "Book-Stile" rispetto a card/tabella, raggio geospaziale e filtri. Opzionali e disattivati di default;
   - **3. Statistiche Interne Anonimizzate (First-Party Analytics):** Rilevamento delle consultazioni delle schede libro (`metriche_visite`) e calcolo dell'Indice di Impatto Culturale Hermae ad esclusivo uso personale del lettore, senza profilazione commerciale. Opzionali e disattivati di default;
   - **4. Servizi Terzi & Mappe Esterne:** Erogazione dei tile cartografici geospaziali (OpenStreetMap / CARTO) e font/icone via CDN. Opzionali e disattivati di default.
3. **Sviluppo del Layer Backend RESTful (`server/src/`):**
   - Service dedicato `cmpService.js`: gestione metadati policy, audit log, verifica consensi attivi, mascheramento IP e procedura di revoca istantanea;
   - Controller REST `cmpController.js` con validazione rigorosa dei tipi booleani (HTTP 400 Bad Request su payload non conformi);
   - Router `cmpRoutes.js` protetto da middleware `optionalAuth` per consentire operatività fluida sia ad utenti guest che autenticati;
   - Registrazione nel gateway principale `/api/cmp` con alias `/api/consensi`.
4. **Modulo Frontend Autonomo & Accessibile (`hermae-frontend/assets/js/cmp.js`):**
   - Script client vanilla modulare `window.HermaeCMP` senza dipendenze esterne;
   - **Banner Flottante Non Invasivo:** esposto al primo accesso con tre azioni chiare: "Accetta Tutti", "Rifiuta Non Necessari" e "Personalizza" (totale assenza di dark pattern);
   - **Modale Granulare Accessibile (WCAG 2.1 AA):** pannello con switch individuali per ciascuna categoria, spiegazioni su finalità e basi giuridiche, navigabilità da tastiera e supporto tasto Escape;
   - **Badge Galleggiante & Link nel Footer:** pulsante discreto nell'angolo inferiore e link permanente nel componente `<app-footer>` ("Preferenze Privacy & Cookie (CMP)") per riaprire e modificare le scelte in ogni momento;
   - Sincronizzazione automatica asincrona tra `localStorage` e database al login;
   - Integrazione in tutte le viste applicative del catalogo.
5. **Sezione di Gestione Consensi in `impostazioni.html`:**
   - Pannello dedicato con 4 card riassuntive dello stato dei consensi in tempo reale;
   - Indicazione dell'ID consenso univoco e della data dell'ultimo aggiornamento;
   - Pulsanti diretti "Personalizza CMP" e "Revoca Consensi" con notifica toast istantanea.

---

## 2. Architettura del Consenso Informato e Schema Relazionale DDL

La tabella `consensi_cmp_utenti` è stata formalizzata all'interno di [`INFO-DATABASE/schema.sql`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/INFO-DATABASE/schema.sql):

```sql
-- 8.1 Creazione Tabella CONSENSI_CMP_UTENTI (Fase 25 - Consent Management Platform)
-- Registro audit del consenso informato (GDPR Art. 5(2), 6, 7 e Direttiva ePrivacy)
CREATE TABLE IF NOT EXISTS consensi_cmp_utenti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id UUID REFERENCES utenti(id) ON DELETE CASCADE,
    consenso_id VARCHAR(64) NOT NULL,
    versione_policy VARCHAR(20) NOT NULL DEFAULT '1.0',
    necessari BOOLEAN NOT NULL DEFAULT TRUE,
    funzionali BOOLEAN NOT NULL DEFAULT FALSE,
    analitici BOOLEAN NOT NULL DEFAULT FALSE,
    servizi_terzi BOOLEAN NOT NULL DEFAULT FALSE,
    indirizzo_ip_anonimizzato VARCHAR(64),
    user_agent TEXT,
    data_espressione TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_aggiornamento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consensi_cmp_utente ON consensi_cmp_utenti (utente_id);
CREATE INDEX IF NOT EXISTS idx_consensi_cmp_id ON consensi_cmp_utenti (consenso_id);
```

---

## 3. Endpoints REST della Consent Management Platform

| Metodo | Endpoint | Accesso | Descrizione |
| :---: | :--- | :---: | :--- |
| `GET` | `/api/cmp/policy` | Pubblico | Restituisce la versione della policy e i metadati delle 4 categorie (finalità, base giuridica, tempi conservazione). |
| `GET` | `/api/cmp/stato` | Ibrido (`optionalAuth`) | Recupera lo stato attuale del consenso per l'utente loggato o per il `consenso_id` anonimo (header `X-CMP-Consent-ID`). |
| `POST` | `/api/cmp/consenso` | Ibrido (`optionalAuth`) | Registra o aggiorna l'espressione di consenso informato (audit trail PostgreSQL, IP mascherato). |
| `POST` | `/api/cmp/revoca` | Ibrido (`optionalAuth`) | Revoca istantaneamente tutti i consensi opzionali mantenendo unicamente i cookie tecnici necessari. |
| `*` | `/api/consensi/*` | Ibrido | Alias trasparente di instradamento identico a `/api/cmp/*`. |

---

## 4. Elenco Filesystem dei File Creati e Modificati

```text
INFO-DATABASE/
└── schema.sql                              # [MODIFY] DDL tabella consensi_cmp_utenti e indici B-tree

server/
├── src/
│   ├── services/
│   │   └── cmpService.js                   # [NEW] Service CMP: metadati, stato, registrazione audit e revoca
│   ├── controllers/
│   │   └── cmpController.js                # [NEW] Controller REST per policy, stato, registrazione e revoca
│   └── routes/
│       ├── index.js                        # [MODIFY] Registrazione endpoint /api/cmp e alias /api/consensi
│       └── cmpRoutes.js                    # [NEW] Definizione rotte CMP con middleware optionalAuth
└── test_fase25.js                          # [NEW] Test suite automatizzata end-to-end (16 asserzioni formali)

hermae-frontend/
├── assets/
│   └── js/
│       ├── cmp.js                          # [NEW] Modulo client CMP: banner flottante, modale accessibile e sync
│       └── components/
│           └── global-components.js        # [MODIFY] Link "Preferenze Privacy & Cookie (CMP)" in AppFooter
├── impostazioni.html                       # [MODIFY] Sezione dedicata "Gestione Consensi Dati & Cookie (CMP)"
├── dashboard.html                          # [MODIFY] Inclusione script cmp.js
├── libreria.html                           # [MODIFY] Inclusione script cmp.js
├── ricerca.html                            # [MODIFY] Inclusione script cmp.js
├── attivita.html                           # [MODIFY] Inclusione script cmp.js
├── chat.html                               # [MODIFY] Inclusione script cmp.js
├── login.html                              # [MODIFY] Inclusione script cmp.js
├── registrazione.html                      # [MODIFY] Inclusione script cmp.js
├── libro.html                              # [MODIFY] Inclusione script cmp.js
├── profilo.html                            # [MODIFY] Inclusione script cmp.js
└── status-prestito.html                    # [MODIFY] Inclusione script cmp.js

SVILUPPO-PROGRAMMA/
└── fase-25.md                              # [NEW] Documentazione analitica e tecnica di Fase 25

roadmap-mvp-1.md                            # [MODIFY] Aggiornamento roadmap con tracciamento completamento Fase 25
```

---

## 5. Risultati del Collaudo e Metriche di Validazione

La test suite automatizzata [`server/test_fase25.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase25.js) è stata eseguita con esito **100% positivo** su 16 verifiche formali:

1. **TEST 1 — Metadati Policy e Categorie:** Struttura delle 4 categorie (Necessari, Funzionali, Analitici, Terzi), basi giuridiche e flag di obbligatorietà verificati ($1/1$);
2. **TEST 2 — Alias Instradamento:** Piena operatività dell'endpoint alias `/api/consensi/policy` ($1/1$);
3. **TEST 3 — Privacy by Default:** Verifica che per nuovi client solo i cookie necessari risultino attivi ($1/1$);
4. **TEST 4 — Consenso Client Anonimo:** Registrazione riuscita con `consenso_id` generato lato client ($1/1$);
5. **TEST 5 — Persistenza Stato Anonimo:** Rilettura e coerenza dei consensi espressi per client non autenticato ($1/1$);
6. **TEST 6 — Consenso Utente Autenticato:** Registrazione e associazione a `utente_id` tramite token Bearer JWT ($1/1$);
7. **TEST 7 — Persistenza Cross-Device:** Recupero dello stato salvato per l'utente loggato su differenti sessioni ($1/1$);
8. **TEST 8 — Procedura di Revoca:** Revoca immediata di tutti i consensi opzionali via `POST /api/cmp/revoca` con mantenimento dei soli tecnici ($1/1$);
9. **TEST 9 — Validazione Input:** Rifiuto con codice HTTP 400 Bad Request di payload con parametri non booleani ($1/1$);
10. **TEST 10 — Audit Trail & Anonimizzazione IP:** Record di audit memorizzato su PostgreSQL con IP mascherato (es. `198.51.100.0` o `::1::`) per minimizzazione dati ($1/1$);
11. **TEST 11 — Isolamento Utenti:** Verifica rigorosa dell'assenza di interferenze o leakage di consensi tra utenti distinti ($1/1$);
12. **TEST 12 — Invariabilità Tecnica:** Impossibilità di disabilitare forzatamente i cookie necessari ($1/1$);
13. **TEST 13 — Tracciamento Versione Policy:** Verifica corrispondenza versione informativa $1.0$ (Art. 7 GDPR) ($1/1$);
14. **TEST 14 — Header X-CMP-Consent-ID:** Riconoscimento ed elaborazione dell'identificativo via header HTTP ($1/1$);
15. **TEST 15 — Prestazioni Endpoint:** Latenza di risposta di `/api/cmp/stato` registrata in appena **1ms** ($< 50\text{ms}$) ($1/1$);
16. **TEST 16 — Pulizia Dati:** Cancellazione atomica dei dati transitori di collaudo ($1/1$).

**Totale Asserzioni Superate (Fase 25):** $16/16$ ($100\%$ pass rate).  
**Regressione Fasi Precedenti:**  
- Fase 24 (Analytics Utente & Query CTE): $20/20$ superati ($100\%$);  
- Fase 23 (Ciclo Prestito, Lock Concorrenza & Tracking): $20/20$ superati ($100\%$);  
- Fase 22 (Contatto & Privacy Shield): $19/19$ superati ($100\%$).  
**Totale Generale Test Eseguiti:** $75/75$ ($100\%$ success rate complessivo).
