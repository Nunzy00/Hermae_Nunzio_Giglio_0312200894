# Fase 12 — Implementazione sistema di Account ed autenticazione

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-12.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stato sviluppato il sistema completo di registrazione, login e gestione della sessione utente, integrando algoritmi sicuri di hashing delle password, generazione e verifica di token di autorizzazione e protezione degli endpoint riservati.

Nello specifico:
1. È stato implementato il modulo di autenticazione custom senza dipendenze da Backend-as-a-Service (BaaS) esterni, in ossequio alle specifiche architetturali della tesi;
2. È stata integrata la libreria `jsonwebtoken` per la firma digitale crittografica e la validazione asimmetrica di **Access Token** (scadenza 1h, payload minimale) e **Refresh Token** (scadenza 7d, per il ciclo di vita e rinnovo trasparente della sessione);
3. È stato implementato il service di autenticazione (`server/src/services/authService.js`) per gestire registrazione, login con confronto hash `bcrypt` (salt $\ge 12$), rinnovo sessione e consultazione del profilo connesso;
4. È stato realizzato il middleware di protezione (`server/src/middlewares/authMiddleware.js`) per intercettare e convalidare l'header HTTP `Authorization: Bearer <token>`, bloccando accessi privi di credenziali o con token scaduti/manomessi;
5. È stato implementato il controller dedicato (`server/src/controllers/authController.js`) con gli endpoint `/register`, `/login`, `/refresh`, `/me` e `/logout`, montati sul router principale tramite `server/src/routes/authRoutes.js`;
6. Tutte le casistiche di successo, errore e rinnovo sessione sono state collaudate con esito positivo via chiamate HTTP REST.

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
server/
├── .env                        # Variabili JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN
├── .env.example                # Template con segnaposto di configurazione chiavi JWT
├── package.json                # Aggiunta della dipendenza jsonwebtoken
├── src/
    ├── config/
    │   └── env.js              # Mappatura centralizzata della configurazione JWT (secret, durate)
    ├── controllers/
    │   └── authController.js   # Controller per register, login, refreshToken, getMe, logout
    ├── middlewares/
    │   └── authMiddleware.js   # Middleware per la verifica del Bearer Token e protezione rotte
    ├── routes/
    │   ├── authRoutes.js       # Definizione delle rotte pubbliche e protette di autenticazione
    │   └── index.js            # Montaggio del router authRoutes su /api/auth
    └── services/
        └── authService.js      # Business logic: emissione token, verifica credenziali e refresh
```

---

## 3. Pacchetti e Dipendenze Installate

Per l'architettura di autenticazione stateless a token firmati è stata integrata la seguente libreria:

| Pacchetto | Versione | Tipologia | Scopo / Ruolo Tecnologico |
| :--- | :---: | :---: | :--- |
| **`jsonwebtoken`** | `^9.0.2` | Dipendenza di produzione | Standard RFC 7519 per la generazione, firma HMAC-SHA256, decodifica e verifica crittografica dei token di accesso e di rinnovo sessione. |

---

## 4. Comandi da Terminale Principali Utilizzati

Di seguito l'elenco sequenziale dei comandi da riga di comando eseguiti per l'installazione e il collaudo del sottosistema di autenticazione:

```bash
# 1. Installazione del pacchetto jsonwebtoken nel backend (dalla cartella server/)
cd server
npm install jsonwebtoken

# 2. Test registrazione nuovo utente con emissione token (POST /api/auth/register)
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "laura.bianchi@example.com",
    "password": "PasswordSicura456!",
    "nome": "Laura",
    "cognome": "Bianchi",
    "citta": "Napoli",
    "coordinate_reali": {"lng": 14.2500, "lat": 40.8400},
    "consenso_privacy": true,
    "consenso_geo": true
  }'

# 3. Test login con credenziali errate (HTTP 401 INVALID_CREDENTIALS)
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "laura.bianchi@example.com", "password": "PasswordSbagliata!"}'

# 4. Test login con credenziali corrette (HTTP 200 OK con rilascio Access Token e Refresh Token)
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "laura.bianchi@example.com", "password": "PasswordSicura456!"}'

# 5. Test accesso a risorsa riservata senza token (HTTP 401 TOKEN_MISSING)
curl -s http://localhost:3000/api/auth/me

# 6. Test accesso a risorsa riservata con formato header errato (HTTP 401 TOKEN_MALFORMED)
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: TokenSenzaBearer"

# 7. Test accesso con token non valido/manomesso (HTTP 401 TOKEN_INVALID)
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer token_fittizio_non_valido"

# 8. Test accesso autorizzato con Bearer Access Token valido (HTTP 200 OK con dati profilo)
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# 9. Test rinnovo sessione tramite Refresh Token (POST /api/auth/refresh -> HTTP 200 con nuovi token)
curl -s -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<REFRESH_TOKEN>"}'

# 10. Test logout logico di sessione (POST /api/auth/logout -> HTTP 200 OK)
curl -s -X POST http://localhost:3000/api/auth/logout
```

---

## 5. Repertorio dei Codici e delle Funzioni Implementate

Ciascun file e funzione include un commento sintetico a riga singola che ne descrive la specifica finalità:

| File Sorgente | Funzione / Blocco di Codice | Commento Sintetico (Cosa fa) |
| :--- | :--- | :--- |
| **`src/services/authService.js`** | `generateTokens(user)` | Genera la coppia di token firmati Access Token e Refresh Token per la sessione dell'utente. |
| **`src/services/authService.js`** | `verifyAccessToken(token)` | Convalida la firma crittografica e la scadenza temporale di un Access Token. |
| **`src/services/authService.js`** | `verifyRefreshToken(token)` | Convalida la firma crittografica e la scadenza temporale di un Refresh Token. |
| **`src/services/authService.js`** | `registerUser(userData)` | Registra un nuovo utente nel sistema e genera contestualmente i token di sessione iniziali. |
| **`src/services/authService.js`** | `loginUser(email, password)` | Autentica le credenziali di accesso confrontando l'hash bcrypt della password ed emette i token di sessione. |
| **`src/services/authService.js`** | `refreshSession(refreshToken)` | Rinnova la sessione utente emettendo un nuovo Access Token a fronte di un Refresh Token valido. |
| **`src/services/authService.js`** | `getCurrentUserProfile(userId)` | Recupera i dati del profilo dell'utente correntemente autenticato tramite identificatore di sessione. |
| **`src/middlewares/authMiddleware.js`** | `authenticate(req, res, next)` | Intercetta l'header Authorization Bearer, valida il token JWT e inietta l'utente decodificato nella richiesta. |
| **`src/controllers/authController.js`** | `register(req, res, next)` | Gestisce la registrazione di un nuovo utente e l'immediata emissione dei token JWT di sessione. |
| **`src/controllers/authController.js`** | `login(req, res, next)` | Autentica le credenziali fornite e restituisce i token JWT di accesso e rinnovo. |
| **`src/controllers/authController.js`** | `refreshToken(req, res, next)` | Rinnova l'Access Token dell'utente a partire da un Refresh Token valido. |
| **`src/controllers/authController.js`** | `getMe(req, res, next)` | Restituisce le informazioni anagrafiche e di profilo dell'utente correntemente autenticato. |
| **`src/controllers/authController.js`** | `logout(req, res)` | Esegue il logout logico della sessione confermando al client l'eliminazione dei token locali. |
| **`src/routes/authRoutes.js`** | `router.post('/register', ...)` | Rotta pubblica per la registrazione di un nuovo utente e l'ottenimento dei token iniziali. |
| **`src/routes/authRoutes.js`** | `router.post('/login', ...)` | Rotta pubblica per l'accesso tramite email e password con emissione di Access Token e Refresh Token. |
| **`src/routes/authRoutes.js`** | `router.post('/refresh', ...)` | Rotta per il rinnovo dell'Access Token scaduto tramite Refresh Token valido. |
| **`src/routes/authRoutes.js`** | `router.get('/me', authenticate, ...)` | Rotta protetta da autenticazione per recuperare i dettagli del profilo utente connesso. |
| **`src/routes/authRoutes.js`** | `router.post('/logout', ...)` | Rotta per la disconnessione e invalidazione logica della sessione. |
| **`src/routes/index.js`** | `router.use('/auth', authRoutes)` | Monta il router delle operazioni di autenticazione e gestione sessione sul percorso /auth. |

---

## 6. Esito del Collaudo e Verifica

Tutti i flussi di sicurezza, emissione, protezione e ciclo di vita sono stati verificati:

### 6.1 Registrazione Utente con Emissione Token (`POST /api/auth/register`)
```json
{
  "success": true,
  "message": "Registrazione completata con successo.",
  "data": {
    "user": {
      "id": "c1bc0296-20c4-40f4-9ce7-458f3b134a3c",
      "email": "laura.bianchi@example.com",
      "nome": "Laura",
      "cognome": "Bianchi",
      "citta": "Napoli",
      "coordinate_reali": { "lng": 14.25, "lat": 40.84 },
      "coordinate_offuscate": { "lng": 14.245154, "lat": 40.836855 },
      "consenso_privacy": true,
      "consenso_geo": true,
      "data_registrazione": "2026-09-20T18:12:18.143Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "tokenType": "Bearer",
      "expiresIn": "1h"
    }
  }
}
```

### 6.2 Verifica Credenziali Errate (`POST /api/auth/login`)
Invio di password non corrispondente:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Credenziali di accesso non valide (email o password errata)."
  }
}
```
Risposta coerente con codice di stato HTTP 401 Unauthorized.

### 6.3 Accesso a Risorsa Protetta senza Token (`GET /api/auth/me`)
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_MISSING",
    "message": "Accesso negato. Token di autorizzazione mancante negli header della richiesta."
  }
}
```

### 6.4 Accesso a Risorsa Protetta con Access Token Valido (`GET /api/auth/me`)
Inviando l'header `Authorization: Bearer <accessToken>`:
```json
{
  "success": true,
  "data": {
    "id": "c1bc0296-20c4-40f4-9ce7-458f3b134a3c",
    "email": "laura.bianchi@example.com",
    "nome": "Laura",
    "cognome": "Bianchi",
    "citta": "Napoli",
    "coordinate_reali": { "lng": 14.25, "lat": 40.84 },
    "coordinate_offuscate": { "lng": 14.245154, "lat": 40.836855 },
    "consenso_privacy": true,
    "consenso_geo": true,
    "data_registrazione": "2026-09-20T18:12:18.143Z"
  }
}
```

### 6.5 Ciclo di Vita del Rinnovo Sessione (`POST /api/auth/refresh`)
Invio del Refresh Token per rigenerare un Access Token senza richiedere nuovamente le credenziali:
```json
{
  "success": true,
  "message": "Sessione rinnovata con successo.",
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI...",
      "tokenType": "Bearer",
      "expiresIn": "1h"
    },
    "user": {
      "id": "c1bc0296-20c4-40f4-9ce7-458f3b134a3c",
      "email": "laura.bianchi@example.com",
      "nome": "Laura",
      "cognome": "Bianchi"
    }
  }
}
```
Il nuovo Access Token è stato testato con successo contro `/api/auth/me`, validando l'intero ciclo di vita della sessione.

### 6.6 Logout Logico (`POST /api/auth/logout`)
```json
{
  "success": true,
  "message": "Disconnessione completata con successo. Rimuovere i token di sessione dalla memoria client."
}
```
