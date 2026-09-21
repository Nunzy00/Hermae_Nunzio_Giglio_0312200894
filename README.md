# Hermae — *"Il sapere, un libro alla volta"*

<p align="center">
  <img src="client/assets/icons/icon-512x512.png" alt="Hermae Logo" width="120" style="border-radius: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);" />
</p>

<p align="center">
  <strong>Piattaforma Web e PWA di Geolocalizzazione Culturale e Condivisione Peer-to-Peer del Patrimonio Librario Privato</strong>
</p>

<p align="center">
  <a href="#-architettura-software--tech-stack"><img src="https://img.shields.io/badge/Architecture-Three--Tier%20REST-blue.svg?style=flat-square" alt="Architettura" /></a>
  <a href="#-architettura-software--tech-stack"><img src="https://img.shields.io/badge/Node.js-18%2B%20LTS-339933.svg?style=flat-square&logo=node.js" alt="Node.js" /></a>
  <a href="#-architettura-software--tech-stack"><img src="https://img.shields.io/badge/PostgreSQL-15%2B%20ACID-336791.svg?style=flat-square&logo=postgresql" alt="PostgreSQL" /></a>
  <a href="#-architettura-software--tech-stack"><img src="https://img.shields.io/badge/Vue.js-3.x%20CDN-4FC08D.svg?style=flat-square&logo=vuedotjs" alt="Vue.js" /></a>
  <a href="#-architettura-software--tech-stack"><img src="https://img.shields.io/badge/Maps-Leaflet%20%7C%20OSM-199900.svg?style=flat-square&logo=openstreetmap" alt="OpenStreetMap" /></a>
  <a href="#-privacy-by-design--geolocalizzazione-confidenziale"><img src="https://img.shields.io/badge/GDPR-Privacy%20by%20Design-success.svg?style=flat-square" alt="GDPR Compliant" /></a>
  <a href="#-accessibilità-e-inclusione-digitale"><img src="https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-purple.svg?style=flat-square" alt="WCAG 2.1 AA" /></a>
  <a href="LICENSE.txt"><img src="https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg?style=flat-square" alt="All Rights Reserved" /></a>
</p>

---

## 🎓 Contesto Accademico e Istituzionale

* **Ateneo:** Università Telematica Pegaso
* **Corso di Laurea:** Laurea Triennale in Informatica per le Aziende Digitali (Classe L-31)
* **Candidato:** Nunzio Giglio (Matricola: `0312200894`)
* **Tema Disciplinare:** Tema n. 4 — *Sharing technologies*
* **Traccia Project Work:** Traccia PW n. 14 — *Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati*
* **Anno Accademico:** 2025 / 2026

---

## 📖 Visione del Progetto

Nelle case dei cittadini risiede un immenso patrimonio librario privato e sommerso: milioni di volumi, saggi specialistici, cataloghi d'arte, romanzi storici e testi fuori catalogo che restano confinati su scaffali domestici dopo la prima lettura.

**Hermae** trasforma questo potenziale in un **bene comune accessibile di prossimità**. La piattaforma connette lettori, appassionati e studiosi della stessa area urbana, consentendo il censimento, la ricerca cartografica e il prestito temporaneo diretto (*peer-to-peer*) dei libri, abbattendo le barriere economiche d'accesso alla cultura e promuovendo la sostenibilità e la coesione civica nel pieno rispetto della privacy domiciliare.

### I Tre Pilastri Fondamentali
1. **Sovranità del Dato e Indipendenza Tecnologica:** Rifiuto radicale di piattaforme BaaS terze proprietarie (*zero Firebase, zero Auth0, zero Mapbox*). Lo stack si basa interamente su componenti open source controllati ed eseguiti autonomamente.
2. **Privacy by Design e Tutela del Domicilio:** Protezione rigorosa dell'indirizzo di casa dei cittadini tramite **Spatial Blurring** sferico (riservatezza nel raggio di quartiere 300–500 m) e filtro preventivo **Hermae Privacy Shield** contro molestie e doxxing nella messaggistica privata.
3. **Efficienza, Leggerezza e Sostenibilità:** Architettura PWA multi-pagina con Vue.js 3 in modalità progressiva via CDN (zero bundler monolitici, First Contentful Paint $< 0.8\text{ s}$) e compressione WebP a doppia risoluzione che riduce il traffico dati di oltre l'85%.

---

## ✨ Funzionalità Chiave del Sistema

### 🗺️ 1. Cartografia Culturale di Prossimità
- Mappa interattiva basata su **Leaflet.js** e layer vettoriali aperti **OpenStreetMap** (licenza ODbL 1.0).
- Visualizzazione dei volumi disponibili tramite cerchi di prossimità confidenziali di quartiere (300–500 m), impedendo l'individuazione del civico esatto o del portone privato.
- Calcolo delle distanze reali tramite la **formula trigonometrica sferica di Haversine** e interrogazioni geospaziali PostgreSQL con estensione `earthdistance` e indici ad albero **GiST** con tempi di risposta inferiori a 2 ms.

### 📚 2. Catalogo Esemplari a Tre Viste Dinamiche
- Modellazione catalografica conforme allo standard internazionale **IFLA LRM / FRBR**, che distingue la singola copia fisica materiale posseduta dal privato dall'astrazione dell'opera.
- Tassonomia a due livelli: 10 macro-categorie disciplinari controllate e vocabolario guidato di sottogeneri ispirato allo standard editoriale internazionale **Thema / EDItEUR**.
- Commutazione istantanea senza ricaricamento pagina tra **Vista Tabellare Accessibile**, **Vista a Griglia (Card)** e **Scaffale Virtuale Tridimensionale (3D Bookshelf)** interattivo.

### 🔄 3. Ciclo di Vita del Prestito & Transazioni ACID
- Macchina a stati finiti (FSM) rigorosa: `IN_ATTESA` $\rightarrow$ `ACCETTATA` / `RIFIUTATA` $\rightarrow$ `IN_CORSO` $\rightarrow$ `RESTITUITO` / `ANNULLATA`.
- Risoluzione della concorrenza e prevenzione del *double-booking* garantita a livello di motore relazionale PostgreSQL tramite transazione serializzata e clausola di lock pessimistico di riga:
  ```sql
  SELECT id, stato_disponibilita FROM esemplari WHERE id = $1 FOR UPDATE;
  ```
- All'atto dell'accettazione, l'esemplare viene bloccato atomicamente e le eventuali richieste concorrenti ancora in attesa vengono contestualmente archiviate con notifica ai richiedenti.

### 🛡️ 4. Hermae Privacy Shield & Chat Confidenziale
- Canale di comunicazione asincrono peer-to-peer tra richiedente e proprietario, attivo unicamente nel perimetro della richiesta di prestito.
- Middleware di ispezione euristica a espressioni regolari per intercettare e mascherare numeri di telefono fisso/mobile e indirizzi email personali prima della transazione materiale, mitigando rischi di adescamento, molestie e disintermediazione non protetta.

### 🖼️ 5. Pipeline Media Asincrona & Sicurezza Binaria
- Caricamento delle immagini fotografiche tramite buffer volatile in memoria (`multer.memoryStorage`), evitando la scrittura di file non convalidati sul disco del server.
- Validazione crittografica della firma binaria del file (*Magic Numbers*: JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `52 49 46 46`) per sventare attacchi di file injection camuffati da estensioni grafiche.
- Transcodifica asincrona multi-target con **Sharp (libvips)** in formato compresso **Google WebP**:
  - **Copertina di Dettaglio:** Risoluzione massima $800 \times 1200\text{ px}$ (qualità 80%, compressione predittiva);
  - **Miniatura Catalogo:** Risoluzione $200 \times 300\text{ px}$ (qualità 75%, ritaglio esatto per liste e marker);
- Gestione transazionale del disco con **cancellazione atomica dei file orfani** (`fs.unlink`) in caso di errore di salvataggio a database.

### 🍪 6. Consent Management Platform (CMP) e Conformità GDPR
- Banner e pannello di gestione del consenso conforme agli artt. 6, 7 e 25 del GDPR e alle Linee Guida del Garante per la protezione dei dati personali.
- Rifiuto esplicito di *dark pattern*: parità visiva tra opzioni di accettazione e rifiuto, nessun consenso pre-selezionato.
- Tracciamento trasparente con audit log crittografico su tabella dedicata `consensi_cmp_utenti`.

### 📱 7. PWA (Progressive Web App) & Resilienza Offline
- Manifest applicativo conforme W3C (`manifest.json`) per installazione standalone su dispositivi desktop, tablet e smartphone Android/iOS.
- Service Worker (`service-worker.js`) con strategia di caching ibrida intelligente:
  - **Cache First** per gli asset statici invarianti (HTML, CSS, icone, librerie vendor);
  - **Network First** con fallback per le chiamate API dinamiche RESTful.

### ♿ 8. Accessibilità e Inclusione Digitale (WCAG 2.1 AA)
- Struttura semantica HTML5 con ruoli espliciti **WAI-ARIA 1.2** (`aria-live`, `aria-expanded`, `aria-describedby`).
- Contrasto cromatico testo/sfondo costantemente superiore al rapporto minimo di $4.5:1$ sia nel tema Chiaro che nel tema Scuro.
- Navigabilità completa tramite tastiera e compatibilità certificata con screen reader (VoiceOver, NVDA).

---

## 🏛️ Architettura Software & Tech Stack

L'infrastruttura software di **Hermae** adotta un'architettura **Client-Server disaccoppiata a tre livelli (Three-Tier Layered Architecture)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. PRESENTATION LAYER                           │
│  11 Pagine Semantiche HTML5  │  Bootstrap 5 (CSS Custom Properties)     │
│  Vue.js 3 (CDN Progressiva)  │  Leaflet.js + OSM  │  Chart.js Canvas   │
│  Service Worker PWA (Offline Cache First / Network First)              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Chiamate HTTP RESTful JSON
                                    │ Header "Authorization: Bearer JWT"
┌───────────────────────────────────▼────────────────────────────────────┐
│                    2. BUSINESS & APPLICATION LAYER                     │
│  Node.js (v18+ LTS)  │  Express.js (v4.x RESTful API)                  │
│  Middleware Stack: Helmet, CORS, Express.json, Sanitizzazione XSS      │
│  Hermae Privacy Shield (Regex Sanitizer Chat)  │  Modulo Geodesico      │
│  Pipeline Media: Multer (MemoryStorage) + Sharp (WebP Transcoder)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Connection Pooling ("pg" driver)
                                    │ Transazioni ACID & Query Geospaziali
┌───────────────────────────────────▼────────────────────────────────────┐
│                      3. DATA & PERSISTENCE LAYER                       │
│  PostgreSQL 15+ ORDBMS (Schema 3FN con UUID v4 crittografici)          │
│  Estensioni Geospaziali: "earthdistance", "cube", Indici ad albero GiST│
│  Storage File System Locale Ottimizzato: /uploads/covers & thumbnails  │
└────────────────────────────────────────────────────────────────────────┘
```

### Tecnologie e Componenti Principali
| Livello Architetturale | Tecnologia Adottata | Versione / Specifica | Finalità e Motivazione Ingegneristica |
| :--- | :--- | :---: | :--- |
| **Front-End (UI)** | HTML5 Semantico + CSS3 | W3C Standard | Architettura a 11 viste; navigazione nativa nel browser. |
| **Design & Layout** | Bootstrap 5 + CSS Vars | v5.3.2 | Griglia flessibile responsive e supporto nativo tema Chiaro/Scuro. |
| **Reattività Client** | Vue.js 3 | v3.3.4 (CDN) | Gestione reattiva di filtri catalogo e form senza overhead di build. |
| **Mappe Territoriali** | Leaflet.js + OpenStreetMap | v1.9.4 | Visualizzazione geografica aperta con cerchi confidenziali (ODbL). |
| **Analitica Grafica** | Chart.js | v4.4.0 (CDN) | Telemetria culturale dell'utente (spline temporali e donuthart generi). |
| **Runtime Back-End** | Node.js (LTS) + Express.js | v18+ / v4.19 | Modello I/O asincrono non bloccante; API RESTful stateless. |
| **Autenticazione** | JWT + Bcrypt | RFC 7519 / 10 salt | Autonomia crittografica locale; zero dipendenza da servizi esterni. |
| **Elaborazione Immagini**| Sharp (libvips) + Multer | v0.35 / v2.4 | Transcodifica WebP in-memory; riduzione dell'85% del peso dei file. |
| **Database Relazionale**| PostgreSQL + GiST | v15+ | Conformità ACID, schema in 3FN, calcolo sferico earthdistance. |

---

## 📊 Schemi e Diagrammi Architetturali (Multimedia)

Tutti gli schemi architetturali e i diagrammi di flusso sono consultabili nella cartella [`MULTIMEDIA/`](MULTIMEDIA/README.md) in formato Markdown e Mermaid vettoriale standard:

* 📐 **[Diagramma Architettura Software a Livelli](MULTIMEDIA/diagramma-architettura-software.md):** Struttura disaccoppiata dei tre livelli, stack middleware, canali di sicurezza e servizi esterni.
* 🗄️ **[Diagramma Entità-Relazione 3FN](MULTIMEDIA/diagramma-entita-relazione.md):** Schema relazionale completo a 9 entità, identificatori crittografici `UUID v4`, chiavi esterne e indici geospaziali GiST.
* 🔄 **[Diagramma Macchina a Stati del Prestito](MULTIMEDIA/diagramma-stati-prestito.md):** Ciclo di vita del prestito, transazioni atomiche ACID e sequenza di locking pessimistico `SELECT ... FOR UPDATE`.
* 🔒 **[Diagramma di Flusso Privacy & Spatial Blurring](MULTIMEDIA/diagramma-flusso-privacy.md):** Algoritmo trigonometrico sferico WGS 84 a 3 modalità e pipeline euristica **Hermae Privacy Shield** per la chat.
* 🗺️ **[Diagramma Sitemap e Navigazione](MULTIMEDIA/diagramma-sitemap-navigazione.md):** Architettura informativa delle 11 pagine web, guardie di autenticazione JWT Bearer e percorsi utente.
* 📷 **[Diagramma Pipeline Elaborazione Immagini](MULTIMEDIA/diagramma-pipeline-immagini.md):** Sequenza di upload multipart in RAM, validazione Magic Numbers, transcodifica WebP a doppia risoluzione e rollback atomico.

---

## 📁 Struttura della Repository

```text
Hermae_Nunzio_Giglio_0312200894/
├── client/                     # Front-End dell'Applicazione Web & PWA
│   ├── assets/                 # Fogli di stile CSS, loghi, icone PWA
│   ├── js/                     # Controller client-side (auth, mappa, catalogo, chat, CMP)
│   ├── index.html              # Landing page di presentazione
│   ├── catalogo.html           # Catalogo libri a 3 viste (Tabella, Card, 3D)
│   ├── mappa.html              # Mappa geospaziale interattiva Leaflet
│   ├── scheda-libro.html       # Scheda dettagliata esemplare IFLA LRM
│   ├── login.html              # Autenticazione con rilascio token JWT
│   ├── registrazione.html      # Onboarding guidato con consensi GDPR
│   ├── dashboard.html          # Cruscotto utente e telemetria Chart.js
│   ├── aggiungi-libro.html     # Censimento esemplare e upload copertina
│   ├── richieste-prestito.html # Gestione scambi, transizioni FSM e chat
│   ├── profilo.html            # Gestione account e modalità di offuscamento
│   ├── privacy-policy.html     # Informativa legale GDPR estesa e revoca consensi
│   ├── manifest.json           # Manifest W3C per installazione PWA
│   └── service-worker.js       # Logica di caching offline (Cache First / Network First)
├── server/                     # Back-End RESTful API (Node.js & Express)
│   ├── src/
│   │   ├── config/             # Connessione al pool di PostgreSQL ('pg')
│   │   ├── controllers/        # Controller REST modulari (auth, libri, prestiti, cmp)
│   │   ├── middleware/         # Autenticazione JWT, Privacy Shield, upload Multer
│   │   ├── routes/             # Definizione degli endpoint RESTful
│   │   └── services/           # Servizi di business (Sharp WebP, geo-engine)
│   ├── uploads/                # Storage locale immagini (/covers e /thumbnails)
│   ├── package.json            # Dipendenze backend censite
│   └── server.js               # Entrypoint applicativo Express
├── INFO-DATABASE/              # Modello e Script del Database Relazionale
│   ├── schema.sql              # Script DDL PostgreSQL (estensioni, tabelle, indici, seed)
│   ├── query.sql               # Query transazionali e query geospaziali d'esempio
│   └── modello-ER.md           # Trattazione teorica del modello concettuale e logico
├── MULTIMEDIA/                 # Documentazione Grafica e Schemi Architetturali
│   ├── README.md               # Indice generale degli schemi multimediali
│   ├── diagramma-architettura-software.md
│   ├── diagramma-entita-relazione.md
│   ├── diagramma-stati-prestito.md
│   ├── diagramma-flusso-privacy.md
│   ├── diagramma-sitemap-navigazione.md
│   └── diagramma-pipeline-immagini.md
├── DOCS/ / RAPPORTO-TECNICO/   # Rapporto Tecnico Accademico Completo (rapporto-tecnico.md)
├── ELABORATO-FINALE/           # Testi formali della tesi per la commissione
├── LICENSE.txt                 # Licenza proprietaria "Tutti i diritti riservati"
└── README.md                   # Presentazione ufficiale della repository
```

---

## 🚀 Installazione e Avvio Locale (Quick Start)

### Prerequisiti di Sistema
- **Node.js:** Versione `18.0.0 LTS` o superiore (con gestore di pacchetti `npm`);
- **PostgreSQL:** Versione `15.0` o superiore con permessi di creazione database ed estensioni;
- **Browser Web Moderno:** Google Chrome, Mozilla Firefox, Safari o Microsoft Edge.

### 1. Clonazione del Progetto
```bash
git clone https://github.com/Nunzy00/Hermae_Nunzio_Giglio_0312200894.git
cd Hermae_Nunzio_Giglio_0312200894
```

### 2. Configurazione della Base di Dati PostgreSQL
Accedere alla console del DBMS PostgreSQL, creare il database ed eseguire lo script DDL che configura estensioni, tabelle, vincoli, indici e tassonomia iniziale:
```bash
# Creazione del database
psql -U postgres -c "CREATE DATABASE hermae;"

# Esecuzione dello schema completo (estensioni pgcrypto, cube, earthdistance e tabelle)
psql -U postgres -d hermae -f INFO-DATABASE/schema.sql
```

### 3. Configurazione delle Variabili d'Ambiente
All'interno della cartella `server/`, creare un file denominato `.env` valorizzando i parametri di connessione al database e la chiave di firma dei token JWT:
```ini
PORT=3000
NODE_ENV=development

# Parametri Connessione PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=latuapassword
DB_NAME=hermae

# Crittografia Autonoma JWT
JWT_SECRET=chiave_segreta_crittografica_molto_lunga_e_sicura_2026
JWT_EXPIRES_IN=7d
```

### 4. Installazione Dipendenze e Avvio del Server
```bash
cd server
npm install
npm run dev   # Avvio in modalità sviluppo con Nodemon (o 'npm start' per produzione)
```
Il server RESTful sarà attivo e in ascolto all'indirizzo:  
`http://localhost:3000`

### 5. Accesso all'Applicazione Web
I file statici del client sono serviti direttamente dal backend Node.js. È sufficiente aprire il browser e navigare su:  
👉 **`http://localhost:3000/`**

---

## 📜 Licenza d'Uso e Proprietà Intellettuale

Il presente progetto, comprensivo di codice sorgente, architetture logiche, documentazione tecnica, grafiche, marchio e denominazione *"Hermae"* è protetto dalla vigente normativa sul Diritto d'Autore (Legge 22 aprile 1941, n. 633 e ss.mm.ii.).

Tutti i diritti sono riservati in via esclusiva al titolare:
* **Titolare dei Diritti:** Nunzio Giglio
* **Codice Fiscale:** `GGLNNZ00H29B202F`
* **Recapito E-mail Istituzionale:** `contatti@nunziogiglio.it`
* **Licenza Applicata:** **TUTTI I DIRITTI RISERVATI (ALL RIGHTS RESERVED)**

Per i dettagli completi relativi ai termini di consultazione per finalità di valutazione didattica e accademica e alle restrizioni d'uso commerciale, si rimanda al file formale [**`LICENSE.txt`**](LICENSE.txt).

---

<p align="center">
  <sub>Hermae — Elaborato Finale di Tesi di Laurea in Informatica per le Aziende Digitali (L-31) — Candidato: Nunzio Giglio (0312200894)</sub>
</p>
