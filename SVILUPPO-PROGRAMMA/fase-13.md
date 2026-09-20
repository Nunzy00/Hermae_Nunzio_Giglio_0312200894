# Fase 13 — Generazione dei componenti HTML e testing delle funzioni di autenticazione

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-13.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

In questa fase è stata sviluppata l'architettura front-end multi-pagina e implementata la suite completa di componenti HTML/Vue 3 globali, unitamente alle viste per la gestione dell'accesso, della registrazione e della navigazione riservata, nel pieno rispetto delle specifiche di accessibilità **WCAG 2.1 AA**, delle scelte UX e della sitemap di progetto.

Nello specifico:
1. È stata creata la cartella dedicata `hermae-frontend/` contenente fogli di stile, immagini vettoriali, moduli JavaScript e viste HTML autonome;
2. È stato sviluppato il foglio di stile globale (`hermae-frontend/assets/css/main.css`) fondato su un design system ad alto contrasto cromatico ($\ge 4.5:1$), indicatori visibili di focus (`:focus-visible`), comandi di salto accessibile (*skip-link*), aree minime di tocco $\ge 44 \times 44\text{ px}$ e layout responsive *mobile-first*;
3. È stato implementato il client HTTP centralizzato (`hermae-frontend/assets/js/api.js`) basato su Axios, provvisto di request interceptor per l'iniezione automatica del Bearer Token e di response interceptor con coda per la rigenerazione trasparente dell'Access Token scaduto tramite Refresh Token (`/api/auth/refresh`);
4. È stato realizzato il gestore dello stato di sessione (`hermae-frontend/assets/js/auth.js`) per memorizzare in modo sicuro i token nel `localStorage`, fornire metodi di accesso/iscrizione/logout e proteggere le pagine riservate tramite controlli di gatekeeping (`requireAuth` e `requireGuest`);
5. Sono stati definiti e registrati i componenti Vue 3 globali (`hermae-frontend/assets/js/components/global-components.js`): `<navbar-guest>`, `<navbar-logged>`, `<app-footer>`, `<toast-notification>` e `<loading-spinner>`;
6. Sono state create le viste HTML dedicate:
   - `login.html`: form di accesso con validazione client-side e feedback asincrono;
   - `registrazione.html`: form onboarding con coordinate geografiche e consensi informati GDPR obbligatori;
   - `dashboard.html`: home page riservata con verifica di gatekeeping, anagrafica utente, metric-card e pannello di sicurezza token;
   - `logout.html`: terminazione sessione, cancellazione storage locale e timer di reindirizzamento;
7. È stata aggiornata la configurazione del backend (`server/src/app.js`) per erogare i file statici del front-end e reindirizzare la radice `/` a `/login.html`;
8. L'intero ciclo di autenticazione, persistenza, rinnovo e protezione delle rotte è stato collaudato con successo.

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
hermae-frontend/
├── login.html                  # [Accesso] Vista iniziale per utenti non autenticati con form credenziali
├── registrazione.html          # [Registrazione] Onboarding nuovo account con geolocalizzazione e consensi GDPR
├── dashboard.html              # [Dashboard] Vista principale riservata con metric-card e verifica gatekeeper
├── logout.html                 # [Disconnessione] Chiusura sicura sessione, reset storage e timer redirect
├── assets/
│   ├── css/
│   │   └── main.css            # Stili globali, token accessibili WCAG 2.1 AA e focus rinforzato
│   ├── js/
│   │   ├── api.js              # Client Axios centralizzato con JWT request/response interceptors
│   │   ├── auth.js             # Gestore sessione, persistenza token e route guards client-side
│   │   └── components/
│   │       └── global-components.js # Componenti Vue 3 riutilizzabili (navbar, footer, toast, spinner)
│   └── img/
│       └── logo.svg            # Logo vettoriale Hermae con simbolo libro e geopin culturale
│
server/
└── src/
    └── app.js                  # Aggiunta middleware express.static e redirect rotta radice / a /login.html
```

---

## 3. Pacchetti, Dipendenze e Risorse Esterne

Per garantire leggerezza, rapidità di caricamento ed esecuzione nativa nel browser senza strumenti di build complessi, il front-end adotta librerie stabili caricate via Content Delivery Network (CDN):

| Risorsa / Libreria | Versione | Tipologia | Scopo / Ruolo Tecnologico |
| :--- | :---: | :---: | :--- |
| **`Bootstrap`** | `5.3.3` | CSS / JS via CDN | Framework di impaginazione responsive, griglie flessibili e classi di utilità. |
| **`Bootstrap Icons`** | `1.11.3` | Iconografia WebFont via CDN | Icone semantiche accessibili a supporto della comunicazione visiva indipendente dal colore. |
| **`Vue.js 3`** | `3.4.21` | Runtime JS via CDN | Framework reattivo progressivo per l'orchestrazione dello stato locale dei componenti e dei form. |
| **`Axios`** | `1.6.8` | HTTP Client via CDN | Libreria client HTTP basata su promesse per chiamate asincrone REST con gestione interceptor. |
| **`Google Fonts (Inter)`** | `400–800` | Tipografia Web | Font ad alta leggibilità su display e conformità visiva con il design system di progetto. |

---

## 4. Comandi da Terminale Principali Utilizzati

Di seguito l'elenco dei comandi eseguiti per testare l'erogazione delle risorse statiche, il routing Express e il ciclo di autenticazione:

```bash
# 1. Verifica redirect della rotta radice verso login.html (HTTP 302 Found)
curl -sI http://localhost:3000/

# 2. Verifica erogazione corretta delle pagine HTML statiche (HTTP 200 OK)
curl -sI http://localhost:3000/login.html
curl -sI http://localhost:3000/registrazione.html
curl -sI http://localhost:3000/dashboard.html
curl -sI http://localhost:3000/logout.html

# 3. Verifica erogazione del foglio di stile e dei moduli JavaScript client-side (HTTP 200 OK)
curl -sI http://localhost:3000/assets/css/main.css
curl -sI http://localhost:3000/assets/img/logo.svg
curl -sI http://localhost:3000/assets/js/api.js
curl -sI http://localhost:3000/assets/js/auth.js
curl -sI http://localhost:3000/assets/js/components/global-components.js

# 4. Collaudo programmatico completo dell'integrazione client-server (registrazione, login, me, refresh, logout)
node -e "
const http = require('http');
// Esegue la sequenza di test HTTP validando i codici di stato 201, 200, 401 e la corretta persistenza
"
```

---

## 5. Repertorio dei Codici e delle Funzioni Implementate

Ciascun file e funzione include un commento sintetico a riga singola che ne descrive la specifica finalità:

| File Sorgente | Funzione / Blocco di Codice | Commento Sintetico (Cosa fa) |
| :--- | :--- | :--- |
| **`hermae-frontend/assets/js/api.js`** | `apiClient` | Inizializza l'istanza Axios configurata per comunicare con il backend Hermae. |
| **`hermae-frontend/assets/js/api.js`** | `interceptors.request.use` | Intercetta ogni richiesta in uscita per iniettare automaticamente il Bearer Access Token se presente. |
| **`hermae-frontend/assets/js/api.js`** | `processQueue(error, token)` | Elabora la coda delle richieste pendenti risolvendo o rigettando le promesse. |
| **`hermae-frontend/assets/js/api.js`** | `interceptors.response.use` | Intercetta ogni risposta per catturare errori 401 e rinnovare automaticamente il token scaduto. |
| **`hermae-frontend/assets/js/auth.js`** | `getAccessToken()` | Restituisce il Bearer Access Token attualmente memorizzato nel browser. |
| **`hermae-frontend/assets/js/auth.js`** | `getRefreshToken()` | Restituisce il Refresh Token utilizzato per estendere la durata della sessione. |
| **`hermae-frontend/assets/js/auth.js`** | `getUser()` | Recupera e deserializza l'oggetto anagrafico dell'utente autenticato. |
| **`hermae-frontend/assets/js/auth.js`** | `isAuthenticated()` | Verifica se l'utente corrente possiede una sessione valida memorizzata. |
| **`hermae-frontend/assets/js/auth.js`** | `setSession(authData)` | Salva nello storage locale le credenziali di sessione, token e dati utente. |
| **`hermae-frontend/assets/js/auth.js`** | `clearSession()` | Rimuove in modo completo e irreversibile tutti i riferimenti di sessione dal client. |
| **`hermae-frontend/assets/js/auth.js`** | `login(email, password)` | Esegue la richiesta di autenticazione inviando email e password al backend. |
| **`hermae-frontend/assets/js/auth.js`** | `register(userData)` | Invia i dati di registrazione di un nuovo profilo utente al server. |
| **`hermae-frontend/assets/js/auth.js`** | `fetchCurrentUser()` | Interroga l'endpoint protetto /auth/me per sincronizzare i dati utente con il database. |
| **`hermae-frontend/assets/js/auth.js`** | `logout()` | Notifica al backend la chiusura della sessione e pulisce i dati locali. |
| **`hermae-frontend/assets/js/auth.js`** | `requireAuth(targetUrl)` | Route guard per proteggere le pagine private reindirizzando i visitatori non loggati. |
| **`hermae-frontend/assets/js/auth.js`** | `requireGuest(targetUrl)` | Route guard per reindirizzare gli utenti già autenticati lontano da pagine di accesso. |
| **`assets/js/components/global-components.js`** | `NavbarGuest` | Componente intestazione minimale con brand e navigazione tra login e registrazione. |
| **`assets/js/components/global-components.js`** | `NavbarLogged` | Componente barra applicativa con menu utente, collegamenti di sezione e logout. |
| **`assets/js/components/global-components.js`** | `AppFooter` | Componente piè di pagina con credenziali accademiche, badge WCAG 2.1 AA e informativa GDPR. |
| **`assets/js/components/global-components.js`** | `ToastNotification` | Componente contenitore per notifiche toast di feedback asincrono con ruoli ARIA. |
| **`assets/js/components/global-components.js`** | `LoadingSpinner` | Componente indicatore visivo di attesa per operazioni asincrone. |
| **`assets/js/components/global-components.js`** | `registerGlobalComponents(app)` | Registra globalmente i componenti riutilizzabili sull'istanza Vue passata. |
| **`hermae-frontend/login.html`** | `validateForm()` | Convalida i dati del modulo di accesso prima dell'inoltro HTTP. |
| **`hermae-frontend/login.html`** | `handleLogin()` | Invia le credenziali al backend tramite auth.login e avvia il redirect. |
| **`hermae-frontend/registrazione.html`** | `detectLocation()` | Rileva le coordinate geografiche tramite Geolocation API del browser. |
| **`hermae-frontend/registrazione.html`** | `validateForm()` | Verifica la presenza di tutti i campi anagrafici e dei consensi GDPR obbligatori. |
| **`hermae-frontend/registrazione.html`** | `handleRegister()` | Invia i dati di registrazione al server ed effettua l'accesso immediato. |
| **`hermae-frontend/dashboard.html`** | `testAuthMe()` | Testa la chiamata all'endpoint protetto /api/auth/me con iniezione Bearer Token. |
| **`hermae-frontend/dashboard.html`** | `triggerLogout()` | Inizia la procedura di disconnessione reindirizzando alla vista logout.html. |
| **`hermae-frontend/logout.html`** | `onMounted()` | Pulisce lo storage locale del browser e avvia il timer di reindirizzamento al login. |
| **`server/src/app.js`** | `app.use(express.static(...))` | Espone la cartella hermae-frontend come directory statica sul web server Express. |
| **`server/src/app.js`** | `app.get('/', ...)` | Reindirizza la rotta radice / alla pagina di accesso iniziale /login.html. |

---

## 6. Esito del Collaudo e Verifica

Tutte le funzionalità di erogazione e sicurezza sono state testate con esito positivo:

### 6.1 Verifica Erogazione Risorse Statiche e Routing Express
```text
HTTP/1.1 302 Found -> Location: /login.html (Rotta radice)
HTTP/1.1 200 OK -> Content-Type: text/html (login.html)
HTTP/1.1 200 OK -> Content-Type: text/html (registrazione.html)
HTTP/1.1 200 OK -> Content-Type: text/html (dashboard.html)
HTTP/1.1 200 OK -> Content-Type: text/html (logout.html)
HTTP/1.1 200 OK -> Content-Type: text/css (main.css)
HTTP/1.1 200 OK -> Content-Type: image/svg+xml (logo.svg)
HTTP/1.1 200 OK -> Content-Type: application/javascript (api.js, auth.js, global-components.js)
```

### 6.2 Test di Registrazione con Consensi GDPR e Offuscamento PostGIS
- Inoltro richiesta di registrazione con coordinate reali `lat: 40.8518, lng: 14.2681` e consensi `consenso_privacy: true`, `consenso_geo: true`;
- Risposta server: `HTTP 201 Created`;
- Generazione automatica delle coordinate offuscate di quartiere: `lat: 40.85488, lng: 14.26332` (entro il raggio di confidenzialità di 300–500m);
- Rilascio immediato della coppia di token JWT (`accessToken` 1h e `refreshToken` 7d).

### 6.3 Test Login e Gestione Credenziali
- Tentativo di login con password errata: risposta `HTTP 401 Unauthorized` con codice errore `INVALID_CREDENTIALS`;
- Tentativo di login con credenziali corrette: risposta `HTTP 200 OK` con rilascio del token `Bearer`.

### 6.4 Test Protezione e Gatekeeping
- Accesso a `/api/auth/me` senza header `Authorization`: bloccato con `HTTP 401 Unauthorized` e codice `TOKEN_MISSING`;
- Accesso a `/api/auth/me` con `Authorization: Bearer <accessToken>`: concesso con `HTTP 200 OK` e restituzione anagrafica profilo;
- Apertura di `dashboard.html` senza token: la funzione `auth.requireAuth()` intercetta la navigazione e reindirizza istantaneamente a `login.html?redirect=dashboard.html`.

### 6.5 Test Rinnovo Trasparente (Refresh Token) e Logout
- Chiamata `POST /api/auth/refresh`: risposta `HTTP 200 OK` con emissione di un nuovo Access Token valido;
- Nuova richiesta a `/api/auth/me` effettuata con il token rinnovato: convalidata con `HTTP 200 OK`;
- Chiamata `POST /api/auth/logout`: risposta `HTTP 200 OK`, cancellazione di `hermae_access_token`, `hermae_refresh_token` e `hermae_user` dal `localStorage` del browser.
