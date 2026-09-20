# Fase 15 — Implementazione delle funzioni di geolocalizzazione dell'utente

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-15.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

In questa fase è stato implementato l'interfacciamento con le API del browser/dispositivo per la rilevazione della posizione geografica (previo consenso), convertendo le coordinate in formato utile per il matching di vicinanza.  
**Difficoltà:** Gestione della variabilità nella precisione del GPS a seconda del dispositivo client e della connessione di rete.

Nello specifico, l'intervento architetturale ha compreso:
1. **Sviluppo del Modulo Client-Side Centralizzato (`hermae-frontend/assets/js/geolocation.js`):** È stato creato un modulo autonomo conforme agli standard W3C (`navigator.geolocation` e Permissions API) che incapsula la richiesta di geolocalizzazione, la gestione tipizzata degli errori (permesso negato, timeout, assenza di segnale) e la normalizzazione delle coordinate in formato standard WGS84 a 7 cifre decimali;
2. **Mitigazione della Variabilità di Precisione GPS:** Per gestire le differenze fisiologiche di accuratezza tra dispositivi (ricevitori GPS integrati su smartphone vs reti Wi-Fi e triangolazione di cella su personal computer desktop), il modulo analizza il parametro `coords.accuracy` classificandolo in tre livelli visivi e operativi:
   - *Segnale GPS Ottimale* ($\le 30\text{ m}$ - Badge Verde);
   - *Precisione Media Rete/Wi-Fi* ($30\text{ m} < \text{accuracy} \le 100\text{ m}$ - Badge Giallo);
   - *Precisione Approssimata* ($> 100\text{ m}$ - Badge Rosso con avviso di approssimazione);
3. **Calcolo Geodetico e Classificazione di Prossimità (*Haversine*):** Implementazione della formula trigonometrica dell'emisenoverso sul client per il calcolo istantaneo delle distanze sferiche in chilometri e metri, unitamente a un algoritmo di clustering in 4 fasce di prossimità (*Stesso Quartiere* $< 2\text{ km}$, *Stessa Città* $2\text{–}10\text{ km}$, *Area Metropolitana* $10\text{–}25\text{ km}$, *Area Provinciale* $25\text{–}50\text{ km}$);
4. **Componente Reattivo `<geo-accuracy-badge>`:** Registrato nei componenti Vue 3 globali (`global-components.js`) per fornire all'utente un riscontro visivo accessibile e immediato sulla qualità del segnale acquisito;
5. **Realizzazione della Vista `hermae-frontend/ricerca.html` (Pagina 4 Sitemap):** Implementata la vista riservata di consultazione cartografica interattiva basata su **Leaflet.js 1.9.4** e tile open-source OpenStreetMap:
   - Marker centrale interattivo dell'utente con supporto a **Drag & Drop** e selezione puntuale tramite click diretto sulla mappa Leaflet per la ridefinizione precisa delle coordinate personali;
   - Funzionalità di **Memorizzazione Coordinate**: pulsante dedicato per salvare le nuove coordinate WGS84 e il comune identificato direttamente nel profilo utente su PostgreSQL (`PUT /api/posizioni/me`);
   - Layout compatto della barra dei controlli organizzato a due righe: riga superiore dedicata ai comandi di geolocalizzazione, ricentratura e memorizzazione coordinate; riga inferiore dedicata allo slider di prossimità ($1\text{–}50\text{ km}$) affiancato direttamente dal contatore di lettori nel raggio;
   - Pulsante e controllo Leaflet personalizzato *"Centra sul mio Pin"* per ricentrare la visuale cartografica sul proprio punto di ricerca con animazione fluida `flyToBounds`;
   - Cerchio vettoriale dinamico semitrasparente che rappresenta visivamente il raggio di prossimità impostato dallo slider ($1\text{–}50\text{ km}$);
   - Posizionamento dei marker georeferenziati degli altri lettori disponibili (mostrati rigorosamente con coordinate offuscate di 300–500m a norma GDPR);
   - Vista alternativa a tabella accessibile conforme a **WCAG 2.1 AA** per la navigazione con screen reader da parte di utenti non vedenti;
6. **Resilienza e Prevenzione del Throttling Hardware/Browser:** Gestione dei click ravvicinati con caching in-memory e `sessionStorage`, de-duplicazione delle promesse concorrenti e fallback trasparente GeoIP su endpoint pubblico `/api/posizioni/ip-locate`;
7. **Integrazione nelle Viste Esistenti:** Collegamento del modulo unificato `geolocation.js` e del badge di precisione nelle pagine `impostazioni.html` e `registrazione.html`;
8. **Arricchimento del Backend (`posizioneUtentiService.js`):** Aggiornamento della query spaziale `/api/posizioni/prossimita` per calcolare ed esporre automaticamente il quartiere approssimativo e la `fascia_prossimita`.

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
hermae-frontend/
├── assets/
│   └── js/
│       ├── geolocation.js              # [NEW] Modulo client geolocalizzazione, precisione GPS e Haversine
│       └── components/
│           └── global-components.js    # [MODIFY] Registrazione del componente <geo-accuracy-badge>
├── ricerca.html                        # [NEW] Vista mappa geospaziale interattiva (Leaflet.js) e lista accessibile
├── impostazioni.html                   # [MODIFY] Integrazione modulo geolocation.js e badge accuratezza
└── registrazione.html                  # [MODIFY] Integrazione modulo geolocation.js e rilevamento GPS unificato

server/
├── src/
│   ├── controllers/
│   │   └── posizioneUtentiController.js# [MODIFY] Aggiunta localizzaDaIP per fallback resiliente di rete
│   ├── routes/
│   │   └── posizioneUtentiRoutes.js    # [MODIFY] Registrazione endpoint protetto GET /ip-locate
│   └── services/
│       └── posizioneUtentiService.js   # [MODIFY] Arricchimento di findPosizioniVicine con fascia_prossimita
└── test_fase15.js                      # [NEW] Script di collaudo automatizzato end-to-end per la Fase 15
```

---

## 3. Pacchetti, Dipendenze e Risorse Esterne

| Risorsa / Libreria | Versione | Tipologia | Scopo / Ruolo Tecnologico |
| :--- | :---: | :---: | :--- |
| **`W3C Geolocation API`** | Standard HTML5 | Browser API | Rilevamento delle coordinate del dispositivo client con calcolo del margine di accuratezza in metri (`coords.accuracy`). |
| **`W3C Permissions API`** | Standard Web | Browser API | Ispezione preventiva dello stato dei consensi concessi dal browser (`navigator.permissions.query`). |
| **`Leaflet.js`** | `1.9.4` | Libreria JS / CSS via CDN | Motore di rendering cartografico geospaziale leggero e interattivo per la visualizzazione dei layer vettoriali e marker. |
| **`OpenStreetMap (OSM)`** | Tile Server Libero | Servizio Mappe Aperto | Tile raster cartografiche open-source prive di costi di licenza o vincoli proprietari. |
| **`Vue.js 3`** | `3.4.21` | Runtime JS via CDN | Gestione dello stato reattivo della mappa, dello slider di raggio e della commutazione di vista. |
| **`PostgreSQL + earthdistance`** | `14+` | RDBMS Geospaziale | Calcolo geodetico della distanza e filtraggio perimetrale su indice GiST. |

---

## 4. Comandi da Terminale Principali Utilizzati

```bash
# 1. Verifica erogazione della nuova pagina ricerca.html (HTTP 200 OK)
curl -sI http://localhost:3000/ricerca.html

# 2. Verifica erogazione del modulo centralizzato di geolocalizzazione (HTTP 200 OK)
curl -sI http://localhost:3000/assets/js/geolocation.js

# 3. Esecuzione della suite di test automatizzati per geolocalizzazione, matching e filtri raggio
node server/test_fase15.js
```

---

## 5. Repertorio dei Codici e delle Funzioni Implementate

Ciascun file e funzione include un commento sintetico a riga singola che ne descrive la specifica finalità:

| File Sorgente | Funzione / Blocco di Codice | Commento Sintetico (Cosa fa) |
| :--- | :--- | :--- |
| **`hermae-frontend/assets/js/geolocation.js`** | `isSupported()` | Verifica se le API di geolocalizzazione sono supportate dal browser client corrente. |
| **`hermae-frontend/assets/js/geolocation.js`** | `checkPermission()` | Ispeziona lo stato attuale del permesso di localizzazione tramite la W3C Permissions API. |
| **`hermae-frontend/assets/js/geolocation.js`** | `evaluateAccuracy(accuracyMeters)` | Classifica il livello di accuratezza del segnale in base al margine di errore in metri. |
| **`hermae-frontend/assets/js/geolocation.js`** | `getCurrentPosition(options)` | Richiede la posizione geografica attuale con opzioni di precisione elevata e timeout. |
| **`hermae-frontend/assets/js/geolocation.js`** | `calculateHaversineDistance(lat1, lon1, lat2, lon2)` | Calcola la distanza geodetica tra due punti sulla Terra tramite formula dell'emisenoverso (Haversine). |
| **`hermae-frontend/assets/js/geolocation.js`** | `classifyProximity(distanceKm)` | Classifica la distanza in una fascia territoriale di prossimità per il matching di vicinanza. |
| **`hermae-frontend/assets/js/geolocation.js`** | `formatCoordinates(lat, lng)` | Formatta le coordinate numeriche in una stringa leggibile WGS84 standard. |
| **`hermae-frontend/assets/js/geolocation.js`** | `reverseGeocode(lat, lng)` | Tenta la geocodifica inversa tramite il servizio OpenStreetMap Nominatim rispettando il rate limit. |
| **`assets/js/components/global-components.js`** | `GeoAccuracyBadge` | Componente indicatore visivo accessibile dell'accuratezza del segnale GPS con ruoli ARIA. |
| **`hermae-frontend/ricerca.html`** | `initLeafletMap()` | Inizializza la mappa Leaflet con tile provider OpenStreetMap e layer cartografici. |
| **`hermae-frontend/ricerca.html`** | `updateUserCenterOnMap()` | Aggiorna il marker del centro e il cerchio di raggio sulla mappa Leaflet. |
| **`hermae-frontend/ricerca.html`** | `renderProximityMarkersOnMap()` | Rendering dei marker georeferenziati per ciascun utente rilevato dalla query di prossimità. |
| **`hermae-frontend/ricerca.html`** | `caricaDatiProssimita()` | Interroga l'API RESTful di backend per ottenere gli utenti vicini entro il raggio specificato. |
| **`hermae-frontend/ricerca.html`** | `onRaggioChange()` | Gestisce la variazione dello slider applicando un debounce per non sovraccaricare la rete. |
| **`hermae-frontend/ricerca.html`** | `rilevaPosizioneGPS()` | Rileva la posizione fisica attuale tramite il modulo Geolocation con gestione precisione. |
| **`server/src/services/posizioneUtentiService.js`** | `findPosizioniVicine(lat, lng, raggioKm, limit)` | Esegue la ricerca spaziale arricchendo i risultati con quartiere approssimativo e fascia territoriale. |

---

## 6. Esito del Collaudo e Verifica

La suite di test automatizzati [`server/test_fase15.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase15.js) ha convalidato la piena efficacia delle routine spaziali e dell'erogazione front-end:

### 6.1 Verifica Precisione GPS e Calcolo Geodetico
- Acquisizione coordinate con `enableHighAccuracy: true` e classificazione immediata del livello di confidenza ($\le 30\text{ m}$ ottimale);
- Formula di Haversine client-side perfettamente allineata con il calcolo geodetico PostgreSQL `earth_distance` (margine di scostamento inferiore allo $0.1\%$).

### 6.2 Test di Filtraggio Dinamico per Raggio di Prossimità
- **Test Raggio Ristretto ($5\text{ km}$ da Napoli Centro):**
  - Rilevati 2 utenti nel perimetro: Nunzio G. ($0.32\text{ km}$, Stesso Quartiere) e Laura B. ($1.92\text{ km}$, Stesso Quartiere);
  - Correttamente esclusi Marco De Luca ($6.63\text{ km}$) e Giulia Romano ($188\text{ km}$);
- **Test Raggio Esteso ($10\text{ km}$ da Napoli Centro):**
  - Rilevati 3 utenti nel perimetro: inclusione immediata di Marco De Luca ($6.63\text{ km}$, Fascia *Stessa Città* / Fuorigrotta);
  - Confermato il rigido isolamento territoriale per utenti situati oltre il limite (Giulia Romano esclusa).

### 6.3 Verifica Erogazione e Integrazione Web
- Pagina `http://localhost:3000/ricerca.html` erogata con codice `HTTP 200 OK`;
- Modulo `http://localhost:3000/assets/js/geolocation.js` erogato con codice `HTTP 200 OK`;
- Integrazione verificata della vista alternativa per screen reader (`book-list-accessible`) conforme al Livello AA delle WCAG 2.1.
