# Analisi delle Pagine Necessarie e Mappa del Sito (Sitemap)

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Riferimento:** Rapporto Tecnico — Sezione 5 / Fase 6: Alberatura e sitemap dell'applicazione  

---

## 1. Tabella Descrittiva delle Pagine del Programma

L'applicazione adotta un modello ad **accesso riservato**: il catalogo, la mappa e le funzionalità del programma sono accessibili esclusivamente previa autenticazione. Di conseguenza:
- Se l'utente **non è autenticato**, la prima pagina visibile è la schermata di **Accesso (Login)** o **Registrazione**;
- Se l'utente **è autenticato**, la pagina principale di atterraggio e navigazione è la **Dashboard**.

Di seguito la classificazione delle 11 pagine identificate:

| Nome Pagina | File HTML | Livello di Accesso | Descrizione Funzionale | Componenti & Servizi Chiave |
| :--- | :--- | :---: | :--- | :--- |
| **Accesso** | `login.html` | Non Autenticato (Guest) | **Pagina iniziale per utenti non autenticati:** form di login con credenziali (email/password), validazione client-side ed emissione del token JWT con redirect alla Dashboard. | Form Bootstrap 5, gestione errori 401, salvataggio token JWT |
| **Registrazione** | `registrazione.html` | Non Autenticato (Guest) | Creazione nuovo account utente con selezione coordinate di residenza e rilascio obbligatorio dei consensi informati (Privacy policy e GDPR). | Form multipart, checkbox consensi privacy, geocodifica |
| **Disconnessione** | `logout.html` | Autenticato $\rightarrow$ Guest | Pagina di atterraggio post-logout: rimozione sicura del token JWT dal client, terminazione sessione e reindirizzamento automatico a `login.html`. | Script rimozione token da storage locale, timer redirect |
| **Dashboard** | `dashboard.html` | **Autenticato (Pagina Principale)** | **Home page e hub operativo dell'utente autenticato:** cruscotto analitico con riepilogo delle attività personali (prestiti in corso, volumi posseduti) e grafici Chart.js sull'impatto culturale. | Chart.js, aggregazioni dati, scorciatoie di navigazione rapida |
| **Ricerca** | `ricerca.html` | Autenticato | Mappa cartografica interattiva a schermo intero, barra di ricerca testuale (titolo, autore, ISBN, categoria) e selettori per filtraggio per raggio di prossimità o città. | Leaflet.js, OpenStreetMap, filtri spaziali PostGIS, lista accessibile |
| **Libro[ID] (Template)** | `libro.html` | Autenticato | Scheda dinamica di dettaglio del volume (parametro URL `?id=...`), visualizzazione copertina WebP, metadati `schema.org/Book`, distanza confidenziale e avvio richiesta prestito. | Template viewer Vue 3, raggio confidenzialità, pulsante richiesta |
| **Libreria** | `libreria.html` | Autenticato | Gestione del proprio catalogo personale: elenco dei volumi caricati dall'utente, form di pubblicazione nuovo libro con upload copertina (Sharp) e azioni CRUD. | Upload Multer/Sharp, form modale, tabella reattiva volumi |
| **Attività (Prestiti)** | `attivita.html` | Autenticato | Monitoraggio del ciclo di vita dei prestiti: gestione delle richieste inviate e ricevute con avanzamento di stato (*In attesa*, *Accettata*, *Rifiutata*, *Conclusa*). | Macchina a stati, badge di stato, azioni conferma/rifiuto |
| **Chat** | `chat.html` | Autenticato | Canale di messaggistica asincrona tra utenti per concordare privatamente i dettagli logistici dello scambio o del prestito fisico di prossimità. | Elenco conversazioni, interfaccia messaggi, notifiche |
| **Account** | `account.html` | Autenticato | Visualizzazione e modifica delle informazioni personali dell'utente (nome, recapiti, avatar, credenziali e password). | Form aggiornamento profilo, validazione sicurezza |
| **Impostazioni** | `impostazioni.html` | Autenticato | Configurazione delle preferenze applicative, visualizzazione e revoca dei consensi privacy GDPR e impostazione del raggio di ricerca predefinito. | Gestione consensi GDPR, preferenze UX e accessibilità |

---

## 2. Elenco Filesystem del Front-end

Organizzazione modulare delle pagine HTML e delle risorse statiche all'interno della struttura del progetto web:

```text
hermae-frontend/
├── login.html                  # [Accesso] PRIMA PAGINA per utenti NON autenticati
├── registrazione.html          # [Registrazione] Onboarding nuovo account e consensi GDPR
├── dashboard.html              # [Dashboard] PAGINA PRINCIPALE per utenti AUTENTICATI
├── ricerca.html                # [Ricerca] Mappa geospaziale interattiva e filtri
├── libro.html                  # [Libro ID] Scheda template dinamica del volume
├── libreria.html               # [Libreria] Gestione patrimonio personale (CRUD)
├── attivita.html               # [Attività] Gestione stato prestiti e richieste
├── chat.html                   # [Chat] Messaggistica per accordi di scambio
├── account.html                # [Account] Profilo utente e credenziali
├── impostazioni.html           # [Impostazioni] Preferenze e revoca consensi privacy
├── logout.html                 # [Disconnessione] Rimozione token e redirect a login
│
├── assets/
│   ├── css/
│   │   ├── bootstrap.min.css   # Framework UI responsive
│   │   ├── leaflet.css         # Stili mappa cartografica
│   │   └── main.css            # Stili personalizzati e contrasti WCAG 2.1 AA
│   ├── js/
│   │   ├── api.js              # Client Axios centralizzato con JWT interceptor
│   │   ├── auth.js             # Gestione sessione, route guard e gatekeeping
│   │   └── components/         # Moduli e istanze Vue 3 per pagina
│   │       ├── map-view.js     # Logica Leaflet e filtri spaziali
│   │       ├── book-form.js    # Logica pubblicazione e preview copertine
│   │       └── charts-view.js  # Wrapper Chart.js per la dashboard
│   └── img/
│       ├── logo.svg            # Identità visiva Hermae
│       └── icons/              # Iconografia SVG e Bootstrap Icons
└── uploads/                    # Storage locale copertine WebP e miniature (dev)
```

---

## 3. Diagramma Gerarchico e Flussi di Navigazione

Il diagramma formalizza il principio per cui il portale è interamente subordinato all'autenticazione: l'utente non autenticato accede solo alle viste di login/registrazione, mentre l'utente autenticato atterra direttamente sulla **Dashboard** da cui può raggiungere tutte le funzionalità:

```mermaid
graph TD
    %% Gate di Ingresso
    START((Avvio Piattaforma)) --> GATEWAY{"Verifica Sessione<br>(Token JWT valido?)"}

    %% Area Non Autenticata
    subgraph AREA_UNAUTH [Area Non Autenticata (Accesso Obbligatorio)]
        LOGIN["Accesso / Login<br>(login.html)<br><i>Prima pagina visibile per non autenticati</i>"]
        REG["Registrazione<br>(registrazione.html)"]
        LOGOUT["Disconnessione Post-Logout<br>(logout.html)"]
    end

    %% Area Autenticata
    subgraph AREA_AUTH [Area Riservata Autenticata (Hermae Core)]
        DASHBOARD["Dashboard<br>(dashboard.html)<br><b>PAGINA PRINCIPALE UTENTE AUTENTICATO</b>"]
        RICERCA["Ricerca & Mappa<br>(ricerca.html)"]
        LIBRO["Libro [ID] Template<br>(libro.html)"]
        LIBRERIA["Libreria Personale<br>(libreria.html)"]
        ATTIVITA["Attività Prestiti/Richieste<br>(attivita.html)"]
        CHAT["Chat Messaggi<br>(chat.html)"]
        ACCOUNT["Profilo Account<br>(account.html)"]
        IMPOSTAZIONI["Impostazioni & Privacy<br>(impostazioni.html)"]
    end

    %% Condizioni di Routing Iniziale
    GATEWAY -->|NO: Utente non autenticato| LOGIN
    GATEWAY -->|SÌ: Utente autenticato| DASHBOARD

    LOGIN <-->|Link Registrazione / Login| REG
    LOGIN -->|Autenticazione riuscita| DASHBOARD
    REG -->|Registrazione completata| LOGIN

    %% Hub di Navigazione dalla Dashboard
    DASHBOARD <--> RICERCA
    DASHBOARD <--> LIBRERIA
    DASHBOARD <--> ATTIVITA
    DASHBOARD <--> CHAT
    DASHBOARD <--> ACCOUNT
    DASHBOARD <--> IMPOSTAZIONI

    %% Flusso di Consultazione e Prestito
    RICERCA -->|Selezione marker/libro| LIBRO
    LIBRO -->|Invia richiesta prestito| ATTIVITA
    ATTIVITA -->|Contatta proprietario| CHAT

    %% Flusso di Uscita
    ACCOUNT -->|Termina sessione| LOGOUT
    IMPOSTAZIONI -->|Termina sessione| LOGOUT
    LOGOUT -->|Redirect automatico| LOGIN
```

---

## 4. Considerazioni Architetturali sui Flussi e sulla Sicurezza

1. **Accesso Condizionato e Gatekeeping (Zero-Trust):** Nessun dato bibliografico, mappa o contenuto privato è accessibile liberamente. All'apertura di qualsiasi pagina, lo script `auth.js` verifica la presenza e la validità del token JWT: se assente o non valido, reindirizza istantaneamente a `login.html` memorizzando l'URL richiesto per ripristinarlo post-login.
2. **Dashboard come Pagina Principale Post-Login:** Una volta convalidato l'accesso, l'utente atterra direttamente sulla `dashboard.html`. La Dashboard funge da cabina di regia personale: mostra lo stato delle richieste di prestito pendenti, le statistiche d'uso e i collegamenti rapidi per consultare la mappa (`ricerca.html`) o pubblicare volumi nella propria libreria (`libreria.html`).
3. **Isolamento del Contesto e Prestazioni:** La scomposizione in pagine HTML dedicate fa sì che le librerie più pesanti vengano caricate solo dove necessario (es. Leaflet.js in `ricerca.html` e `libro.html`, Chart.js in `dashboard.html`), garantendo rapidità di esecuzione su dispositivi mobili.
4. **Ciclo di Disconnessione e Pulizia:** La pagina `logout.html` cancella in modo irreversibile i token di sessione dal client storage, azzera lo stato locale e riporta l'utente alla schermata di ingresso `login.html`.
