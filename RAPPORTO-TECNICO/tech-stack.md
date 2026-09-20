# HERMAE - Specifiche del Tech Stack

## 1. Architettura Generale & Navigazione
- **Modello Architetturale:** Client-Server disaccoppiato basato su API RESTful.
- **Struttura Front-end Multi-Pagina (Pagine HTML Distinte):** Per rendere più semplice, affidabile e naturale la navigazione tramite browser (supporto nativo a cronologia, pulsanti avanti/indietro, ricaricamento e bookmarking diretto), l'applicazione è strutturata su **diverse pagine HTML dedicate**. Ciascuna pagina implementa un layout coerente e include componenti reattivi **Vue.js 3** per la gestione interattiva dell'interfaccia, dei filtri e dello stato locale.
- **Comunicazione Client-Server:** Chiamate HTTP asincrone verso gli endpoint REST esposti dal back-end Node.js/Express, con payload JSON stateless e autenticazione tramite token.

---

## 2. Front-end
- **Core Framework & Reattività:** **Vue.js 3** (Composition API, componenti reattivi montati nelle rispettive pagine HTML per gestire dinamicamente mappe, form e aggiornamenti dell'interfaccia senza appesantire la navigazione).
- **HTTP Client:** **Axios** (istanza centralizzata con interceptors per l'iniezione automatica del token di autenticazione negli header HTTP e gestione uniforme degli errori di sessione e rete).
- **UI, Layout & Styling:** **Bootstrap 5** (con **Bootstrap Icons**) per la realizzazione di layout responsive, mobile-first e conformi agli standard di accessibilità **WCAG 2.1 Livello AA / WAI-ARIA** (contrasti cromatici $\ge 4.5:1$, navigazione da tastiera, aree touch $\ge 44 \times 44$ px e supporto screen reader).
- **Motore Mappe & GIS:** **Leaflet.js** con layer tile OpenStreetMap per la resa cartografica interattiva, georeferenziazione dei marker e visualizzazione del raggio di ricerca spaziale.
- **Data Visualization:** **Chart.js** (tramite wrapper `vue-chartjs`) per la dashboard analitica (grafici a linee e barre per visualizzazioni, consultazioni e richieste di prestito).

---

## 3. Back-end & Logica Applicativa
- **Runtime:** **Node.js**.
- **Framework Web:** **Express.js** (architettura modulare a livelli: *Routes*, *Controllers*, *Services*, *Middlewares*).
- **Autenticazione & Sicurezza Custom (senza soluzioni built-in o BaaS esterni):**
  - **Cifratura Credenziali:** `bcrypt` con salt round elevato ($\ge 12$) per l'hashing sicuro delle password prima della persistenza su database.
  - **Gestione Sessione / Token:** `jsonwebtoken` (generazione e verifica di token JWT firmati con chiave segreta, scadenza definita e payload minimale).
  - **Sicurezza di Rete & Middleware:** Middleware `cors` per abilitare le richieste controllate e sanitizzazione dei parametri di richiesta per prevenire attacchi XSS.
  - **Privacy Geografica & Spatial Blurring:** Il back-end memorizza le coordinate per le elaborazioni di distanza, ma espone alle API pubbliche coordinate offuscate tramite **spatial blurring** (raggio di confidenzialità di 300–500 m) per tutelare l'inviolabilità del domicilio privato (GDPR).
  - **Gestione Consensi:** Raccolta e verifica applicativa del consenso esplicito e granulare al trattamento dati e alla geolocalizzazione.
- **Pipeline Elaborazione Immagini:**
  - `multer` per la gestione dell'upload multipart con **whitelist rigorosa limitata ai principali formati immagine** consentiti (`image/jpeg`, `image/png`, `image/webp`), con blocco preventivo di qualsiasi altro tipo di file o script malevolo.
  - `sharp` per il ridimensionamento asincrono e la conversione automatica nel formato compresso **WebP** sia per l'immagine di copertina standard (800px) sia per la miniatura (*thumbnail* a 200px), riducendo il traffico dati del 70–80%.
- **Gestione Ciclo di Vita Prestiti:** Logica di gestione delle richieste di contatto/prestito basata su macchina a stati (*In attesa*, *Accettata*, *Rifiutata*, *Conclusa*) e relativo aggiornamento dello stato di disponibilità del volume (*Disponibile* / *In prestito*).

---

## 4. Base di Dati & Modellazione Geospaziale
- **DBMS:** **PostgreSQL**.
- **Estensione Geospaziale:** **PostGIS** per la persistenza di coordinate spaziali tramite tipi dedicati (`GEOMETRY(Point, 4326)` o `GEOGRAPHY(Point, 4326)`).
- **Query Geografiche e Scalabilità:**
  - Query spaziali native PostGIS (`ST_DWithin`, `ST_DistanceSphere`, `ST_MakePoint`) abbinate a indici spaziali ad albero **GiST** per ricerche per raggio/prossimità ad alte prestazioni (< 200 ms).
  - Supporto combinato a ricerche su **scala di quartiere** (per raggio metrico) e su **scala cittadina** (tramite filtro sul comune/città o bounding box geografico), predisponendo l'architettura a una reale scalabilità territoriale.
- **Interfaccia DB & Protezione:** Driver nativo `pg` (node-postgres) con query SQL rigorosamente parametrizzate per prevenire **SQL Injection**, accompagnato da script DDL per schema e script di seeding con dati fittizi realistici.

---

## 5. Mappa delle Pagine HTML dell'Applicazione
L'architettura front-end si articola su diverse pagine HTML dedicate per agevolare l'uso dei comandi nativi del browser (cronologia, tasti avanti/indietro, ricarica e condivisione URL):

1. `index.html` – **Home / Esplora:** Mappa cartografica interattiva, ricerca testuale per metadati (titolo, autore, ISBN, categoria) e selettore per filtraggio per raggio di prossimità o per città.
2. `libro-dettaglio.html` – **Dettaglio Libro:** Scheda informativa completa con anteprima copertina WebP, metadati, distanza stimata con raggio di confidenzialità e opzione di contatto / richiesta di prestito simulata (accessibile direttamente tramite parametro id).
3. `pubblica.html` – **Pubblicazione Libro (Area Riservata):** Form accessibile per l'inserimento dei dati bibliografici, posizionamento su mappa e upload guidato della copertina (esclusivamente formati JPEG, PNG, WebP) con anteprima immediata.
4. `profilo.html` – **Profilo Utente:** Gestione della propria libreria condivisa, monitoraggio delle richieste di prestito (inviate e ricevute) con relativo stato e gestione consensi privacy.
5. `dashboard.html` – **Dashboard Statistiche (Amministrativa):** Cruscotto di monitoraggio con visualizzazione aggregata delle metriche d'uso tramite grafici interattivi Chart.js.
6. `login.html` & `registrazione.html` – **Autenticazione:** Viste per l'accesso e la registrazione utente con consensi espliciti per la privacy e la geolocalizzazione.
