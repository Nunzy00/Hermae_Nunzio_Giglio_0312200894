# Specifiche dei Requisiti di Sistema (Funzionali e Non Funzionali)

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Riferimento:** Rapporto Tecnico — Sezione 2: Requisiti funzionali e non funzionali  

---

## 1. Introduzione e Metodologia di Classificazione

La presente sezione formalizza il capitolato dei requisiti di sistema per la piattaforma **Hermae**. L'individuazione dei requisiti discende direttamente dall'analisi della situazione-problema e degli obiettivi di progetto, strutturandosi in due categorie:

1. **Requisiti Funzionali (RF):** Descrivono le funzionalità, i servizi e i comportamenti operativi che il software deve erogare agli utenti e agli amministratori.
2. **Requisiti Non Funzionali (RNF):** Definiscono i vincoli qualitativi, prestazionali, di sicurezza, di conformità normativa e di usabilità che il sistema deve rispettare nell'erogazione delle proprie funzioni.

Per la prioritizzazione dei requisiti viene adottata la metodologia **MoSCoW**:
- **Must have (M):** Requisito obbligatorio e vincolante per il rilascio del prototipo;
- **Should have (S):** Requisito ad alta priorità, fortemente raccomandato;
- **Could have (C):** Requisito desiderabile ma secondario o implementabile come arricchimento;
- **Won't have (W):** Requisito posticipato a iterazioni future.

---

## 2. Matrice dei Requisiti Funzionali (RF)

| ID | Requisito Funzionale | Descrizione Dettagliata | Priorità | Modulo Architetturale |
| :---: | :--- | :--- | :---: | :--- |
| **RF-1** | **Autenticazione & Gestione Utenti** | Registrazione nuovo utente, login con rilascio token JWT, logout, gestione del profilo personale e raccolta granulare dei consensi informati (privacy e geolocalizzazione). | **Must** | Modulo Auth & Utenti (Express / bcrypt / JWT) |
| **RF-2** | **Geolocalizzazione & Coordinate** | Acquisizione della posizione geografica dell'utente/libro (mediante inserimento indirizzo/geocodifica o coordinate esplicite WGS 84), associazione del punto geografico all'entità libro. | **Must** | Modulo Geospaziale (PostGIS / Leaflet) |
| **RF-3** | **Gestione Catalogo (CRUD Libri)** | Operazioni complete di creazione, lettura, modifica e cancellazione delle schede libro: metadati (titolo, autore, anno, ISBN), categorizzazione tematica, stato di conservazione e disponibilità. | **Must** | Servizio Catalogo & DB PostgreSQL |
| **RF-4** | **Upload Immagini e Miniature** | Caricamento multipart di copertine, validazione MIME-type, ridimensionamento asincrono e conversione automatica in formato compresso **WebP** sia standard (800px) sia miniatura (*thumbnail* 200px). | **Must** | Pipeline Media (Multer + Sharp) |
| **RF-5** | **Motore di Ricerca Testuale** | Ricerca full-text e filtri combinati per titolo, autore, codice ISBN e categoria tematica, integrata sia in vista tabellare/griglia sia sulla mappa. | **Must** | Controller Ricerca & SQL Query |
| **RF-6** | **Ricerca Geospaziale dei Contenuti** | Visualizzazione su mappa interattiva (Leaflet.js) con marker georeferenziati e filtraggio spaziale in tempo reale per raggio chilometrico (da 1 a 50 km) tramite funzioni native PostGIS (`ST_DWithin`). | **Must** | GIS Engine (PostGIS + Leaflet) |
| **RF-7** | **Scheda Dettaglio & Anteprima** | Vista dedicata con URL condivisibile (*deep linking* `/libri/:id`), anteprima ad alta risoluzione della copertina WebP, metadati bibliografici, distanza stimata e raggio di confidenzialità. | **Must** | Front-end SPA (Vue Router) |
| **RF-8** | **Gestione Richieste di Contatto e Prestito** | Invio di una richiesta simulata di prestito/consultazione da parte dell'utente fruitore, notifica o tracciamento dello stato (In attesa / Accettata / Rifiutata / Conclusa) e aggiornamento disponibilità. | **Should** | Servizio Prestiti & Notifiche |
| **RF-9** | **Dashboard Analitica & Statistiche** | Tracciamento anonimizzato delle metriche d'uso (visualizzazioni schede, ricerche, richieste prestito) e cruscotto grafico interattivo (Chart.js) per il monitoraggio dell'impatto culturale sul territorio. | **Should** | Modulo Statistiche (Chart.js / SQL) |

---

## 3. Matrice dei Requisiti Non Funzionali (RNF)

| ID | Categoria RNF | Standard / Parametro di Verifica | Descrizione e Criteri di Accettazione | Priorità |
| :---: | :--- | :--- | :--- | :---: |
| **RNF-1** | **Accessibilità Digitale** | **WCAG 2.1 Livello AA / WAI-ARIA** | Conformità alle linee guida W3C: contrasto cromatico $\ge 4.5:1$ per testo normale, navigabilità completa tramite tastiera, focus visibile, etichette `aria-*` per elementi dinamici della mappa e tabelle alternative accessibili. | **Must** |
| **RNF-2** | **Privacy by Design & GDPR** | **Regolamento UE 2016/679 (GDPR)** | Riservatezza della posizione del domicilio tramite **spatial blurring**: le coordinate mostrate su mappa pubblica hanno un raggio di confidenzialità (300-500 m). Consenso esplicito e granulare in fase di registrazione; minimizzazione dei dati nei token JWT. | **Must** |
| **RNF-3** | **Prestazioni ed Efficienza** | **Metriche GIS & Web Performance** | - Tempo di risposta query spaziali PostGIS con indici GiST: **< 200 ms**.<br>- Compressione immagini WebP: riduzione del payload del **70-80%** rispetto ai formati JPEG/PNG originari.<br>- Primo rendering utile (*First Contentful Paint*): **$\le 1.5$ s**. | **Must** |
| **RNF-4** | **Usabilità & User Experience (UX)** | **Mobile-First & Heuristic Evaluation** | Design responsivo adattabile a schermi smartphone, tablet e desktop; navigazione coerente a componenti; feedback immediato per errori nei form e azioni asincrone; mappa fluida e comandi touch con area $\ge 44 \times 44$ px. | **Must** |
| **RNF-5** | **Sicurezza & Integrità Dati** | **Crittografia & OWASP Top 10** | Password conservate esclusivamente con hashing crittografico **bcrypt** (salt round $\ge 12$). Autenticazione stateless con token **JWT** firmati. Prevenzione SQL Injection tramite query SQL parametrizzate. Sanitizzazione e validazione MIME dei file in upload. | **Must** |
| **RNF-6** | **Compatibilità & Standard Aperti** | **Cross-Browser & Web Standards** | Funzionamento garantito sui principali browser moderni (Google Chrome, Mozilla Firefox, Apple Safari, Microsoft Edge). Piena aderenza agli standard W3C (HTML5 semantico, CSS3, ECMAScript moderno). | **Should** |
| **RNF-7** | **Modularità & Manutenibilità** | **Clean Architecture (MVC/Layers)** | Chiara separazione client-server: Single Page Application (Vue.js 3) disaccoppiata dal back-end RESTful (Express.js a tre livelli: *Routes*, *Controllers*, *Services*). Codice sorgente documentato e manutenibile. | **Should** |

---

## 4. Note Tecniche e Chiarimenti Metodologici

### 4.1 Livello di Accessibilità: WCAG 2.1 Livello AA vs AAA
Per la natura del progetto, il target di riferimento è il **Livello AA delle WCAG 2.1**:
- Il livello AA costituisce lo standard accademico, normativo (Direttiva UE 2016/2102) e industriale per tutte le moderne applicazioni web della pubblica utilità e della sharing economy.
- Il livello AAA, pur rappresentando un ideale teorico, introduce vincoli estremamente rigidi (es. contrasto 7:1 fisso su ogni elemento grafico, totale assenza di mappe interattive dinamiche complesse non sostituibili al 100%) che risulterebbero incompatibili con le consuete librerie cartografiche (Leaflet.js) e con la fruizione visiva delle copertine dei libri.

### 4.2 Privacy Geografica e Spatial Blurring (RNF-2)
A differenza delle piattaforme commerciali in cui il punto di ritiro è pubblico (es. negozi o locker), nel prestito peer-to-peer i libri risiedono presso abitazioni private. Il requisito **RNF-2** assicura che il punto geografico esposto pubblicamente non coincida mai con il civico reale dell'utente, bensì con un centroide di quartiere o un punto perturbato artificialmente (*spatial jittering*), proteggendo la sicurezza e la riservatezza dell'utente.

### 4.3 Scalabilità Geospaziale e Prestazioni (RNF-3)
L'adozione dell'estensione geospaziale **PostGIS** con indici spaziali ad albero **GiST** (*Generalized Search Tree*) assicura che l'interrogazione per raggio chilometrico operi con complessità algoritmica $O(\log N)$, rendendo l'applicazione pronta a gestire carichi urbani crescenti senza decadimento prestazionale.
