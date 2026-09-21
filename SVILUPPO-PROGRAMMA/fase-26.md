# Fase 26 — Implementazione PWA (Progressive Web App)

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-26.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

L'applicazione web è stata trasformata in **Progressive Web App (PWA)** mediante la creazione del `manifest.json`, la configurazione di un **Service Worker** dedicato al caching delle risorse statiche e la predisposizione per l'installazione su dispositivi mobili e desktop.

Nel dettaglio, le attività realizzate hanno compreso:
1. **Configurazione del Web App Manifest W3C (`manifest.json`):**
   - Definizione dei metadati applicativi: denominazione completa (*Hermae — Il sapere, un libro alla volta*), nome breve (*Hermae*), orientamento preferito (*portrait-primary*), palette cromatica istituzionale (`theme_color: #1e3a8a`, `background_color: #0f172a`) e modalità di visualizzazione a schermo intero indipendente dal browser (`display: standalone`);
   - Definizione del set di icone multi-risoluzione (192x192, 512x512, SVG vettoriale e formato adattivo con `purpose: maskable` per i launcher moderni di Android);
   - Configurazione delle **App Shortcuts** per l'avvio rapido delle sezioni chiave direttamente dall'icona del launcher: *"La Mia Libreria"*, *"Mappa & Ricerca"*, *"I Miei Prestiti"* e *"Messaggi & Chat"*.
2. **Generazione e Ottimizzazione degli Asset Grafici PWA:**
   - Creazione dell'icona vettoriale quadrata [`assets/img/icon.svg`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/hermae-frontend/assets/img/icon.svg) e della variante maskable [`assets/img/icon-maskable.svg`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/hermae-frontend/assets/img/icon-maskable.svg) con safe zone circolare dell'80%;
   - Compilazione e rasterizzazione tramite pipeline `sharp` dei formati PNG standard: `icon-192x192.png`, `icon-512x512.png`, `icon-maskable-512x512.png` e `apple-touch-icon.png` (180x180 px per iOS Safari).
3. **Ingegnerizzazione del Service Worker (`service-worker.js`):**
   - Implementazione del ciclo di vita completo del worker (`install`, `activate`, `fetch`, `message`);
   - Precaching atomico dell'App Shell core (`hermae-pwa-v1`) con attivazione immediata (`self.skipWaiting()`) e takeover trasparente dei client aperti (`self.clients.claim()`);
   - Pulizia automatica delle versioni di cache obsolete all'attivazione;
   - Risoluzione della criticità di caching mediante una **Strategia Ibrida a 3 Livelli** (Network First per HTML, Stale-While-Revalidate / Cache First per asset statici e Network Only per API REST).
4. **Sviluppo della Vista di Fallback Offline Accessibile (`offline.html`):**
   - Creazione di una pagina di atterraggio dedicata conforme a **WCAG 2.1 AA**;
   - Rilevamento in tempo reale del ripristino della connettività tramite eventi di rete (`window.online`/`window.offline`) con reload automatico;
   - Informazioni chiare sulle funzionalità fruibili offline (consultazione cache locale) e pulsante di ripristino connessione rapido.
5. **Modulo Client-Side di Gestione PWA (`assets/js/pwa.js`):**
   - Script client unificato `window.HermaePWA` per la registrazione automatica del worker con scope radice (`/`);
   - Intercettazione dell'evento nativo `beforeinstallprompt`, memorizzazione dell'evento differito e presentazione di un banner discreto di installazione non invasivo (senza dark pattern);
   - Rilevamento dello stato di installazione standalone (`window.matchMedia('(display-mode: standalone)')`);
   - Monitoraggio globale della connettività con notifiche Toast reattive.
6. **Integrazione Globale nel Frontend e Server Backend:**
   - Inclusione dei meta tag PWA (`manifest`, `theme-color`, `apple-mobile-web-app-capable`) e dello script `pwa.js` su tutti i 16 template HTML della piattaforma;
   - Configurazione in [`server/src/app.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/src/app.js) del middleware per l'header HTTP `Service-Worker-Allowed: /` e l'associazione dei corretti Content-Type.

---

## 2. Analisi della Difficoltà Riscontrata e Risoluzione Architetturale

### Problema Tecnico
> **Difficoltà riscontrata:** Scelta della strategia di caching più idonea (Network First vs Cache First) per bilanciare la disponibilità offline con l'aggiornamento costante dei dati dinamici.

Nelle applicazioni web tradizionali o nelle PWA puramente statiche, la strategia convenzionale **Cache First** (o *Cache-Falling-Back-to-Network*) garantisce tempi di caricamento istantanei e navigazione offline immediata. Tuttavia, nel contesto specifico della piattaforma Hermae — basata su uno scambio bibliografico peer-to-peer con **macchina a stati finiti** (`DISPONIBILE`, `IN_PRESTITO`, `RESTITUITO`), chat in tempo reale, notifiche interne asincrone e vincoli normativi GDPR sul consenso CMP — l'adozione indiscriminata di una strategia Cache First avrebbe comportato gravi criticità:
- **Rischio di Dati Stantii (Stale Data):** Un libro già concesso in prestito a un terzo utente avrebbe continuato ad apparire disponibile nella schermata di ricerca o nella libreria locale, generando tentativi di prestito conflittuali e frustrazione nell'esperienza utente;
- **Disallineamento Transazionale:** Richieste di scambio e contatti visualizzati con stati intermedi non aggiornati rispetto alla persistenza PostgreSQL;
- **Conformità Privacy & GDPR:** Il consenso informato espresso tramite CMP necessita di applicazione immediata e sincronizzazione server-side, incompatibile con il congelamento dei dati in una cache client non invalidata.

D'altra parte, un approccio puramente **Network First** su ogni risorsa avrebbe annullato il valore aggiunto della PWA, causando rallentamenti su reti mobili a bassa latenza e impedendo del tutto l'accesso all'applicazione in condizioni di connettività assente.

### Soluzione: Architettura di Caching Ibrida a 3 Livelli
Per risolvere brillantemente il trade-off, il Service Worker implementa una suddivisione rigida del traffico HTTP basata sulla natura semantica della richiesta:

```
                          RICHIESTA CLIENT HTTP (GET)
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
  [ /api/* & uploads ]       [ Documenti HTML ]           [ Asset Statici ]
    Dati Dinamici & REST       Navigazione Pagine           CSS, JS, Fonts, Img
        │                             │                             │
        ▼                             ▼                             ▼
  NETWORK ONLY                  NETWORK FIRST                 STALE-WHILE-REVALIDATE
  Bypass completo SW            Tenta la rete                 / CACHE FIRST
  Nessuna cache locale          Cache fallback se offline     Cache immediata
  JSON 503 se non connesso      offline.html di cortesia      Background revalidate
```

1. **Livello 1 — Asset Statici Immutabili $\rightarrow$ Stale-While-Revalidate / Cache First:**
   - Applicato a: CSS di layout (`style.css`, Bootstrap), script infrastrutturali (`api.js`, `auth.js`, `cmp.js`, `pwa.js`, Vue 3, Axios), font di sistema (Inter da Google Fonts) e icone vettoriali (`logo.svg`, `icon.svg`, PNG);
   - Comportamento: restituzione istantanea dalla cache locale per massimizzare la reattività (LCP e INP eccellenti), con aggiornamento asincrono in background per allinearsi a eventuali nuove release.
2. **Livello 2 — Documenti di Navigazione HTML $\rightarrow$ Network First con Fallback Offline:**
   - Applicato a: Tutte le viste di navigazione (`/`, `dashboard.html`, `libreria.html`, `ricerca.html`, `attivita.html`, `chat.html`, `impostazioni.html`, ecc.);
   - Comportamento: il worker tenta prioritariamente di prelevare l'HTML fresco dal server, aggiornando la copia locale in cache. Qualora il client sia offline o la rete sia disconnessa, viene restituita la versione cached della pagina; se la pagina specifica non è ancora stata visitata, viene servita la pagina di cortesia dedicata `offline.html`.
3. **Livello 3 — Servizi Dinamici & REST API $\rightarrow$ Network Only:**
   - Applicato a: Tutti gli endpoint `/api/*` e caricamento copertine `/uploads/*`;
   - Comportamento: bypass totale della cache del Service Worker. Le chiamate raggiungono sempre PostgreSQL attraverso l'Express Server. Se la rete è assente, il Service Worker intercetta il fallimento e restituisce un payload JSON controllato con stato `503 Service Unavailable (Offline)` senza corrompere lo stato applicativo.

---

## 3. Specifiche del Web App Manifest (`manifest.json`)

Il file [`hermae-frontend/manifest.json`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/hermae-frontend/manifest.json) è stato validato secondo i requisiti W3C e Chromium/Lighthouse:

```json
{
  "name": "Hermae — Il sapere, un libro alla volta",
  "short_name": "Hermae",
  "description": "Piattaforma di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati",
  "start_url": "/dashboard.html",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#0f172a",
  "theme_color": "#1e3a8a",
  "lang": "it-IT",
  "dir": "ltr",
  "categories": ["books", "education", "lifestyle"],
  "icons": [
    { "src": "assets/img/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "assets/img/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "assets/img/icon-maskable-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "assets/img/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ],
  "shortcuts": [
    {
      "name": "La Mia Libreria",
      "short_name": "Libreria",
      "description": "Accedi al tuo catalogo personale di libri",
      "url": "/libreria.html",
      "icons": [{ "src": "assets/img/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "Mappa & Ricerca",
      "short_name": "Cerca",
      "description": "Esplora i libri disponibili nei dintorni sulla mappa",
      "url": "/ricerca.html",
      "icons": [{ "src": "assets/img/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "I Miei Prestiti",
      "short_name": "Prestiti",
      "description": "Monitora lo stato di avanzamento delle letture e scambi",
      "url": "/attivita.html",
      "icons": [{ "src": "assets/img/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "Messaggi & Chat",
      "short_name": "Chat",
      "description": "Apri il centro comunicazioni e scambi",
      "url": "/chat.html",
      "icons": [{ "src": "assets/img/icon-192x192.png", "sizes": "192x192" }]
    }
  ]
}
```

---

## 4. Esperienza Utente Offline e Modulo Client (`assets/js/pwa.js`)

Il modulo client vanilla [`hermae-frontend/assets/js/pwa.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/hermae-frontend/assets/js/pwa.js) orchestra l'esperienza utente PWA in modo progressivo:
1. **Prompt di Installazione Trasparente:** L'evento nativo `beforeinstallprompt` viene intercettato per evitare la comparsa intrusiva della barra standard. Viene presentato un banner elegante in stile dark glassmorphism nell'angolo inferiore destro dell'interfaccia con pulsanti *"Installa App"* e *"Più tardi"*;
2. **Supporto Standalone:** Rileva se l'applicazione è già eseguita in modalità finestra autonoma (`display-mode: standalone`) disattivando automaticamente i richiami di installazione;
3. **Rilevamento Connettività e Toast Reattivi:** Ascolta globalmente gli eventi `window.online` e `window.offline`, aggiungendo una classe visuale al `<body>` e mostrando notifiche toast immediate per informare l'utente del passaggio alla modalità offline o del recupero del segnale;
4. **Pagina di Cortesia ([`offline.html`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/hermae-frontend/offline.html)):** In caso di navigazione verso una pagina non precaricata senza connessione, l'utente visualizza una schermata curata con pulsante *"Riprova Connessione"* e indicatori visuali pulsanti (rosso per offline, verde per online).

---

## 5. Configurazione Server Express (`server/src/app.js`)

Per garantire il controllo dell'intero dominio applicativo da parte del Service Worker (servito dalla directory `/`), è stato configurato il middleware dedicato:

```javascript
// Configura header ottimali per PWA (Service-Worker-Allowed e corretti MIME type)
app.use((req, res, next) => {
  if (req.path === '/service-worker.js') {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  } else if (req.path === '/manifest.json') {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  }
  next();
});
```

---

## 6. Collaudo e Matrice di Test Automatizzati

È stata implementata ed eseguita la suite di test automatizzata end-to-end [`server/test_fase26.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase26.js):

| N. Test | Descrizione della Verifica | Esito |
| :---: | :--- | :---: |
| **TEST 1** | Esistenza e conformità W3C di `manifest.json` (name, short_name, display standalone, theme/bg color, start_url) | **SUPERATO** |
| **TEST 2** | Esistenza, integrità fisica e non-vacuità di tutte le icone dichiarate (192, 512, maskable, SVG, apple-touch-icon) | **SUPERATO** |
| **TEST 3** | Configurazione e validità delle scorciatoie applicative (App Shortcuts) per le sezioni chiave | **SUPERATO** |
| **TEST 4** | Validazione sintattica del Service Worker (`service-worker.js`) senza errori JS | **SUPERATO** |
| **TEST 5** | Verifica listener del ciclo di vita (`install`, `activate`, `fetch`), `skipWaiting()` e `clients.claim()` | **SUPERATO** |
| **TEST 6** | Risoluzione della difficoltà di caching: verifica routing ibrido (Network First, Cache First, Network Only su `/api/`) | **SUPERATO** |
| **TEST 7** | Accessibilità, validità DOCTYPE, landmark WCAG 2.1 AA e rilevamento online/offline di `offline.html` | **SUPERATO** |
| **TEST 8** | Validazione sintattica e metodi del modulo client PWA (`assets/js/pwa.js`) per installazione e connettività | **SUPERATO** |
| **TEST 9** | Copertura totale dei meta tag PWA e inclusione di `pwa.js` su tutti i 16 template HTML | **SUPERATO** |
| **TEST 10** | Erogazione HTTP di `manifest.json` con HTTP 200 OK e Content-Type `application/manifest+json` | **SUPERATO** |
| **TEST 11** | Erogazione HTTP di `service-worker.js` con HTTP 200 OK e header `Service-Worker-Allowed: /` | **SUPERATO** |
| **TEST 12** | Erogazione HTTP di `offline.html` con HTTP 200 OK | **SUPERATO** |
| **TEST 13** | Erogazione HTTP delle icone PNG PWA (192, 512, maskable) con corretti Content-Type `image/png` | **SUPERATO** |
| **TEST 14** | Verifica dei criteri di installabilità PWA stabiliti dalle specifiche Chromium e Lighthouse | **SUPERATO** |

**Esito finale collaudo**: **62/62 asserzioni superate con successo (100% success rate)**.

---

## 7. Deliverable e Risorse Prodotte

- [`hermae-frontend/manifest.json`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/hermae-frontend/manifest.json) — Web App Manifest W3C PWA;
- [`hermae-frontend/service-worker.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/hermae-frontend/service-worker.js) — Service Worker con caching ibrido a 3 livelli;
- [`hermae-frontend/offline.html`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/hermae-frontend/offline.html) — Pagina offline di cortesia conforme WCAG 2.1 AA;
- [`hermae-frontend/assets/js/pwa.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/hermae-frontend/assets/js/pwa.js) — Modulo client per installazione e monitoraggio connettività;
- [`hermae-frontend/assets/img/icon.svg`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/hermae-frontend/assets/img/icon.svg) e raster PNG: `icon-192x192.png`, `icon-512x512.png`, `icon-maskable-512x512.png`, `apple-touch-icon.png`;
- [`server/src/app.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/src/app.js) — Middleware header HTTP PWA;
- [`server/test_fase26.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase26.js) — Suite di test automatizzata end-to-end;
- [`SVILUPPO-PROGRAMMA/fase-26.md`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/SVILUPPO-PROGRAMMA/fase-26.md) — Relazione tecnica di fase;
- [`roadmap-mvp-1.md`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/roadmap-mvp-1.md) — Aggiornamento tracciamento avanzamento di progetto.
