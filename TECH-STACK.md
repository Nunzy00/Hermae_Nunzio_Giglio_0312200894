# HERMAE - Specifiche del Tech Stack

## 1. Architettura Generale & Routing
- **Modello Architetturale:** Client-Server disaccoppiato basato su API RESTful.
- **Target Applicativo:** Single Page Application (SPA) multi-vista, strutturata a pagine dedicate per consentire navigazione fluida, indicizzazione interna e deep linking (condivisione di URL diretti per schede libro, profili e viste di ricerca).
- **Client-Side Routing:** **Vue Router** (modalità HTML5 History API per URL privi di hash, con Navigation Guards per la protezione delle rotte riservate).

---

## 2. Front-end
- **Core Framework:** **Vue.js 3** (Composition API, architettura a componenti riutilizzabili).
- **HTTP Client:** **Axios** (istanza centralizzata con interceptors per l'iniezione automatica del token di autenticazione negli header HTTP e per la gestione centralizzata degli errori di rete e sessione).
- **UI & Styling:** **Bootstrap 5** (con **Bootstrap Icons**) per la realizzazione di layout responsive, mobile-first e conformi agli standard di accessibilità **WCAG 2.1 / WAI-ARIA** (gestione del contrasto cromatico, navigazione da tastiera e supporto screen reader).
- **Motore Mappe & GIS:** **Leaflet.js** con layer tile OpenStreetMap per la resa cartografica, georeferenziazione dei marker e visualizzazione del raggio di ricerca spaziale.
- **Data Visualization:** **Chart.js** (tramite wrapper `vue-chartjs`) per la dashboard analitica (grafici a linee e barre per visualizzazioni, download e richieste di prestito).

---

## 3. Back-end & Logica Applicativa
- **Runtime:** **Node.js**.
- **Framework Web:** **Express.js** (architettura modulare a livelli: *Routes*, *Controllers*, *Services*, *Middlewares*).
- **Autenticazione & Sicurezza Custom (senza soluzioni built-in o BaaS esterni):**
  - **Cifratura Credenziali:** `bcrypt` con salt round elevato (>= 12) per l'hashing sicuro delle password prima della persistenza.
  - **Gestione Sessione / Token:** `jsonwebtoken` (generazione e verifica di token JWT firmati con chiave segreta e tempo di scadenza definito).
  - **Middleware di Autorizzazione:** Middleware Express custom per la convalida del token JWT e il controllo granulare dei ruoli (utente registrato vs amministratore).
  - **Privacy & Consenso:** Gestione applicativa del consenso esplicito al trattamento dei dati personali e alla geolocalizzazione (memorizzazione delle coordinate con livello di granularità controllato).
- **Pipeline Elaborazione Immagini:**
  - `multer` per la gestione dell'upload multipart/form-data.
  - `sharp` per il ridimensionamento asincrono e la conversione automatica nel formato **WebP** sia per l'immagine di copertina standard sia per la miniatura (*thumbnail*).

---

## 4. Base di Dati & Modellazione Dati
- **DBMS:** **PostgreSQL**.
- **Estensione Geospaziale:** **PostGIS** per la persistenza di coordinate spaziali tramite tipi dedicati (`GEOMETRY(Point, 4326)` o `GEOGRAPHY(Point, 4326)`).
- **Query Geografiche:** Utilizzo di funzioni native PostGIS (come `ST_DWithin`, `ST_DistanceSphere`, `ST_MakePoint`) e indici spaziali `GIST` per ricerche per raggio/prossimità ad alte prestazioni.
- **Interfaccia DB:** Driver nativo `pg` (node-postgres) con query SQL parametrizzate per prevenire SQL Injection, accompagnato da script DDL per schema e seeding con dati di test.

---

## 5. Mappa delle Pagine (Routing Client)
1. `/` – **Home / Esplora:** Mappa interattiva, filtri spaziali per raggio/area e ricerca testuale dei libri limitrofi.
2. `/libri/:id` – **Dettaglio Libro:** Scheda informativa completa con copertina WebP, metadati del volume, stato di disponibilità e simulazione della richiesta di prestito (link condivisibile).
3. `/pubblica` – **Pubblicazione Libro (Rotta Protetta):** Form accessibile per l'inserimento dei metadati, georeferenziazione e upload copertina.
4. `/profilo` – **Profilo Utente:** Gestione della propria libreria condivisa, monitoraggio delle richieste e impostazioni privacy/consenso.
5. `/dashboard` – **Dashboard Statistiche (Amministrativa):** Monitoraggio metriche aggregate d'uso e visualizzazione grafici Chart.js.
6. `/login` & `/registrazione` – **Autenticazione:** Accesso, registrazione utente e rilascio consensi GDPR.
