# Diagramma dell'Architettura Software a Livelli (Layered Architecture)

> **Progetto:** Hermae — *"Il sapere, un libro alla volta"*  
> **Candidato:** Nunzio Giglio (Matricola: 0312200894)  
> **Corso di Laurea:** Informatica per le Aziende Digitali (L-31) — Università Telematica Pegaso  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14**  
> **Collocazione:** Cartella `MULTIMEDIA/` — Documentazione Tecnica e Tesi  

---

## 1. Descrizione Architetturale

L'applicazione **Hermae** implementa un'architettura **Client-Server disaccoppiata a tre livelli (Three-Tier Layered Architecture)** conforme ai principi REST (*Representational State Transfer*). Il sistema disaccoppia nettamente la logica di presentazione, l'elaborazione di business e la persistenza relazionale, garantendo modularità, sicurezza e scalabilità orizzontale.

---

## 2. Diagramma Architetturale Generale (Mermaid)

```mermaid
graph TD
    subgraph Presentation_Layer ["1. Presentation Layer (Client Browser & PWA)"]
        UI["11 Pagine HTML Semantiche<br>(Responsive Bootstrap 5 + CSS Custom Properties)"]
        VUE["Componenti Reattivi Vue.js 3 (CDN)<br>(Reattività form, filtri e commutazione 3 viste)"]
        SW["Service Worker PWA (service-worker.js)<br>(Strategia ibrida Cache First / Network First)"]
        MAP_LIB["Leaflet.js Cartografia<br>(Layer vettoriali OSM & Marker colorati)"]
        CHART_LIB["Chart.js Telemetria<br>(Spline mensile & Grafico a ciambella generi)"]
        UI --- VUE
        UI --- SW
        VUE --- MAP_LIB
        VUE --- CHART_LIB
    end

    subgraph Security_Transport ["Canale di Comunicazione & Sicurezza"]
        AXIOS["Client HTTP (Axios / Fetch API)<br>Chiamate asincrone stateless"]
        SEC_HEADERS["Header 'Authorization: Bearer JWT'<br>Token crittografici RFC 7519"]
        AXIOS --- SEC_HEADERS
    end

    subgraph Business_Layer ["2. Application & Business Logic Layer (Node.js & Express)"]
        MID["Middleware Stack Globale<br>(Helmet, CORS, Express.json, Express.static)"]
        ROUTERS["REST API Routers<br>(/api/auth, /api/libri, /api/prestiti, /api/cmp, /api/chat)"]
        CTRL["Controllers & Services Modulari<br>(Validazione parametri, logica di dominio, error handling)"]
        SHARP_PIPE["Pipeline Media Asincrona<br>(Multer in-memory + Sharp WebP)"]
        PRIVACY_SHIELD["Hermae Privacy Shield<br>(Filtro euristico regex chat anti-adescamento)"]
        GEO_ENGINE["Modulo Geodesico Client/Server<br>(Formula trigonometrica sferica di Haversine)"]
        
        MID --> ROUTERS
        ROUTERS --> CTRL
        CTRL --> SHARP_PIPE
        CTRL --> PRIVACY_SHIELD
        CTRL --> GEO_ENGINE
    end

    subgraph Persistence_Layer ["3. Data & Storage Layer (PostgreSQL & Filesystem)"]
        POOL["Driver 'pg' Connection Pooling<br>(Query SQL parametriche sicure $1, $2)"]
        DB[("PostgreSQL 15+ ORDBMS<br>Schema 3FN con UUID v4 e vincoli ACID")]
        GIST_EXT["Estensioni Geospaziali Sferiche<br>(earthdistance, cube, indici ad albero GiST)"]
        STORAGE_MEDIA["Storage Locale Immagini WebP<br>(/uploads/covers & /uploads/thumbnails)"]
        
        POOL --> DB
        DB --- GIST_EXT
    end

    subgraph External_Services ["Servizi Terzi Aperti"]
        OSM["OpenStreetMap Tile Server<br>(Mappe base aperte - Licenza ODbL 1.0)"]
    end

    Presentation_Layer -->|Chiamate HTTP REST JSON| Security_Transport
    Security_Transport --> Business_Layer
    Business_Layer -->|Transazioni SQL & Query GiST| Persistence_Layer
    SHARP_PIPE -->|Salvataggio atomico file grafici| STORAGE_MEDIA
    MAP_LIB -.->|Download tile cartografici standard| OSM
    UI -.->|Fruizione diretta immagini WebP| STORAGE_MEDIA
```

---

## 3. Dettaglio dei Livelli Software

### 1. Presentation Layer (Front-End)
- **Architettura Multi-Pagina (11 Viste):** Scelta per preservare la navigabilità nativa del browser (cronologia, tasti avanti/indietro, bookmarking), evitando la complessità e la fragilità delle Single Page Application monolitiche.
- **Vue.js 3 in modalità CDN Progressiva:** Integrato direttamente nelle pagine per gestire lo stato reattivo locale (filtri istantanei, form dinamici, commutazione tra Tabella, Card e Scaffale 3D) con First Contentful Paint inferiore a 1 secondo.
- **Service Worker PWA:** Gestisce la cache offline tramite la Cache Storage API con strategia Network First per dati dinamici e Cache First per asset statici.

### 2. Business Logic Layer (Back-End)
- **Runtime Node.js & Framework Express.js:** Esecuzione asincrona event-driven non bloccante.
- **Autenticazione Stateless:** Autenticazione basata su JSON Web Token (JWT) firmati con algoritmo HMAC-SHA256 e conservazione password con salting adattivo bcrypt a 10 cicli.
- **Hermae Privacy Shield:** Middleware per la sanitizzazione del testo nelle chat private con mascheramento di email e numeri telefonici.

### 3. Data & Persistence Layer (Database & Storage)
- **PostgreSQL 15+:** Database relazionale conforme allo standard ACID, con schema in 3FN e identificatori primari `UUID v4`.
- **Indici GiST su `ll_to_earth()`:** Calcolo geodetico su coordinate sferiche con risposte costantemente sotto i 2 millisecondi.
- **Storage WebP:** File system locale strutturato per archiviare separatamente copertine di dettaglio (800x1200 px) e miniature (200x300 px), con cancellazione atomica dei file orfani.
