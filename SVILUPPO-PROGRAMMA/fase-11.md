# Fase 11 — Definizione nel database dell’entità “utenti”, del suo schema e delle sue operazioni CRUD

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-11.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stata implementata la tabella dell’entità utente con i relativi campi anagrafici e di sicurezza, corredata dai metodi del layer di persistenza per le operazioni di Create, Read, Update e Delete dei profili registrati.

Nello specifico:
1. È stato strutturato il layer di persistenza e business logic dell'entità utenti (`server/src/services/userService.js`), incapsulando le query SQL parametrizzate sul pool PostgreSQL (`hermae_db`);
2. Sono state implementate le funzioni per la crittografia delle password tramite **`bcrypt`** (fattore di costo salt $\ge 12$) e per l'offuscamento geospaziale automatico delle coordinate domiciliari (**spatial blurring** a raggio 300–500 m per conformità al principio di Privacy-by-Design / GDPR);
3. È stata integrata la gestione robusta dei vincoli di unicità (errore `23505` di PostgreSQL su email duplicate, mappato tempestivamente su codice `EMAIL_ALREADY_EXISTS` con stato HTTP 409 Conflict);
4. È stato implementato il controller RESTful (`server/src/controllers/userController.js`) con validazione dei campi obbligatori e verifica del consenso informato al trattamento dei dati personali;
5. È stato definito e registrato il router applicativo (`server/src/routes/userRoutes.js`) montato su `/api/users`;
6. Tutte le 4 operazioni CRUD, unitamente ai vincoli di sicurezza e unicità, sono state collaudate con esito positivo sia a livello logico che tramite chiamate HTTP REST.

---

## 2. Elenco Filesystem dei File Creati e Modificati

```text
server/
├── package.json                # Aggiunta della dipendenza bcryptjs per l'hashing crittografico
├── src/
    ├── controllers/
    │   └── userController.js   # Controller REST con validazione payload e gestione risposte HTTP
    ├── routes/
    │   ├── index.js            # Router principale aggiornato con montaggio delle rotte /users
    │   └── userRoutes.js       # Router dedicato agli endpoint CRUD dell'entità utenti
    └── services/
        └── userService.js      # Layer di persistenza con metodi CRUD, parsing POINT e spatial blurring
```

---

## 3. Pacchetti e Dipendenze Installate

Per garantire la sicurezza crittografica e l'hashing irreversibile delle password conformemente agli standard OWASP e alle linee guida di architettura della tesi, è stato installato il seguente modulo:

| Pacchetto | Versione | Tipologia | Scopo / Ruolo Tecnologico |
| :--- | :---: | :---: | :--- |
| **`bcryptjs`** | `^3.0.3` | Dipendenza di produzione | Implementazione ottimizzata dell'algoritmo di cifratura irreversibile Blowfish per la generazione di salt crittografici (12 cicli) e hash sicuri delle password utente. |

---

## 4. Comandi da Terminale Principali Utilizzati

Di seguito la sequenza ordinata dei comandi da riga di comando eseguiti per l'installazione delle dipendenze e il collaudo funzionale delle operazioni CRUD:

```bash
# 1. Installazione della libreria di hashing crittografico bcryptjs (nella cartella server/)
cd server
npm install bcryptjs

# 2. Test validazione consenso privacy obbligatorio (HTTP 400 con codice PRIVACY_CONSENT_REQUIRED)
curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.noconsent@example.com",
    "password": "Password123!",
    "nome": "Test",
    "cognome": "User",
    "citta": "Napoli",
    "coordinate_reali": {"lng": 14.2681, "lat": 40.8518},
    "consenso_privacy": false
  }'

# 3. Test creazione profilo utente (Create - HTTP 201 Created con generazione UUID e coordinate offuscate)
curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mario.rossi@example.com",
    "password": "PasswordSicura123!",
    "nome": "Mario",
    "cognome": "Rossi",
    "citta": "Napoli",
    "coordinate_reali": {"lng": 14.2681, "lat": 40.8518},
    "consenso_privacy": true,
    "consenso_geo": true
  }'

# 4. Test violazione vincolo di unicità email (HTTP 409 Conflict con codice EMAIL_ALREADY_EXISTS)
curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mario.rossi@example.com",
    "password": "AltraPassword123!",
    "nome": "Mario",
    "cognome": "Rossi",
    "citta": "Napoli",
    "coordinate_reali": {"lng": 14.2681, "lat": 40.8518},
    "consenso_privacy": true,
    "consenso_geo": true
  }'

# 5. Test lettura elenco utenti registrati con paginazione (Read All - HTTP 200 OK)
curl -s http://localhost:3000/api/users

# 6. Test recupero singolo profilo utente per UUID (Read One - HTTP 200 OK)
curl -s http://localhost:3000/api/users/42c8d0dd-367e-4e79-ad35-827af799c8a8

# 7. Test aggiornamento dati utente (Update - HTTP 200 OK)
curl -s -X PUT http://localhost:3000/api/users/42c8d0dd-367e-4e79-ad35-827af799c8a8 \
  -H "Content-Type: application/json" \
  -d '{"nome": "Mario Luigi", "citta": "Pozzuoli"}'

# 8. Test cancellazione account utente (Delete - HTTP 200 OK)
curl -s -X DELETE http://localhost:3000/api/users/42c8d0dd-367e-4e79-ad35-827af799c8a8

# 9. Test verifica rimozione account (HTTP 404 Not Found con codice USER_NOT_FOUND)
curl -s http://localhost:3000/api/users/42c8d0dd-367e-4e79-ad35-827af799c8a8
```

---

## 5. Repertorio dei Codici e delle Funzioni Implementate

Ciascun file include commenti sintetici a riga singola che ne descrivono la specifica finalità:

| File Sorgente | Funzione / Blocco di Codice | Commento Sintetico (Cosa fa) |
| :--- | :--- | :--- |
| **`src/services/userService.js`** | `parsePoint(pt)` | Converte una stringa o oggetto geometrico POINT di PostgreSQL in un oggetto con coordinate numeriche lng e lat. |
| **`src/services/userService.js`** | `generateBlurredCoordinates(lng, lat)` | Genera coordinate offuscate introducendo uno spostamento casuale controllato di 300-500 metri per la privacy GDPR. |
| **`src/services/userService.js`** | `formatUserRow(row, includePassword)` | Formatta un record utente proveniente dal database ripulendo le credenziali ed elaborando i tipi geometrici. |
| **`src/services/userService.js`** | `createUser(userData)` | Inserisce un nuovo utente nel database con password cifrata tramite bcrypt e coordinate WGS 84. |
| **`src/services/userService.js`** | `getUserById(id)` | Recupera un profilo utente per identificatore univoco globale UUID omettendo i dati sensibili. |
| **`src/services/userService.js`** | `getUserByEmail(email, includePassword)`| Cerca un utente tramite indirizzo email con facoltà di includere l'hash della password per l'autenticazione. |
| **`src/services/userService.js`** | `getAllUsers(filters)` | Estrae l'elenco paginato degli utenti registrati con filtro opzionale sulla città di residenza. |
| **`src/services/userService.js`** | `updateUser(id, updateData)` | Aggiorna selettivamente i campi anagrafici, territoriali o di credenziali di un utente esistente. |
| **`src/services/userService.js`** | `deleteUser(id)` | Elimina definitivamente un utente dal database attivando le politiche di cancellazione a cascata. |
| **`src/controllers/userController.js`**| `createUser(req, res, next)` | Gestisce la registrazione e creazione di un nuovo profilo utente con validazione dei dati obbligatori. |
| **`src/controllers/userController.js`**| `getAllUsers(req, res, next)` | Gestisce la lettura paginata e filtrata dei profili utenti registrati. |
| **`src/controllers/userController.js`**| `getUserById(req, res, next)` | Gestisce il recupero dei dettagli di un singolo profilo utente tramite il suo identificatore UUID. |
| **`src/controllers/userController.js`**| `updateUser(req, res, next)` | Gestisce l'aggiornamento dei dati anagrafici, territoriali e di preferenze di un profilo utente. |
| **`src/controllers/userController.js`**| `deleteUser(req, res, next)` | Gestisce la cancellazione definitiva di un account utente e la revoca di tutte le risorse correlate. |
| **`src/routes/userRoutes.js`** | `router.post('/', ...)` | Rotta per la registrazione e creazione di un nuovo profilo utente (Create). |
| **`src/routes/userRoutes.js`** | `router.get('/', ...)` | Rotta per la consultazione paginata e filtrata dell'elenco utenti (Read All). |
| **`src/routes/userRoutes.js`** | `router.get('/:id', ...)` | Rotta per il recupero del singolo profilo utente tramite UUID (Read One). |
| **`src/routes/userRoutes.js`** | `router.put('/:id', ...)` | Rotta per l'aggiornamento parziale o totale dei dati utente tramite UUID (Update). |
| **`src/routes/userRoutes.js`** | `router.delete('/:id', ...)` | Rotta per la rimozione definitiva dell'account utente tramite UUID (Delete). |
| **`src/routes/index.js`** | `router.use('/users', userRoutes)` | Monta il router delle operazioni CRUD dell'entità utenti sul percorso /users. |

---

## 6. Esito del Collaudo e Verifica

Tutte le operazioni del ciclo di vita del dato (CRUD) e le logiche di sicurezza sono state verificate:

### 6.1 Test Creazione e Spatial Blurring (Create)
Invio di richiesta `POST /api/users`:
```json
{
  "success": true,
  "message": "Utente registrato con successo.",
  "data": {
    "id": "42c8d0dd-367e-4e79-ad35-827af799c8a8",
    "email": "mario.rossi@example.com",
    "nome": "Mario",
    "cognome": "Rossi",
    "citta": "Napoli",
    "coordinate_reali": { "lng": 14.2681, "lat": 40.8518 },
    "coordinate_offuscate": { "lng": 14.270727, "lat": 40.848851 },
    "consenso_privacy": true,
    "consenso_geo": true,
    "data_registrazione": "2026-09-20T18:03:46.044Z"
  }
}
```
- Identificatore generato conformemente allo standard **UUIDv4**;
- Password cifrata nel database con `bcrypt` (salt rounds 12) e totalmente omessa dalla risposta JSON;
- Coordinate offuscate calcolate automaticamente mediante raggio di confidenzialità.

### 6.2 Test Vincolo di Unicità (Email Duplicata)
Invio di una seconda registrazione con la medesima email `mario.rossi@example.com`:
```json
{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "L'indirizzo email 'mario.rossi@example.com' risulta già registrato nel sistema."
  }
}
```
L'eccezione `23505` di PostgreSQL è stata catturata correttamente e trasformata in una risposta HTTP 409 Conflict informativa.

### 6.3 Test Lettura e Paginazione (Read)
- **Elenco utenti (`GET /api/users`):**
  ```json
  {
    "success": true,
    "data": {
      "total": 1,
      "limit": 20,
      "offset": 0,
      "users": [
        {
          "id": "42c8d0dd-367e-4e79-ad35-827af799c8a8",
          "email": "mario.rossi@example.com",
          "nome": "Mario",
          "cognome": "Rossi",
          "citta": "Napoli",
          "coordinate_offuscate": { "lng": 14.270727, "lat": 40.848851 },
          "data_registrazione": "2026-09-20T18:03:46.044Z"
        }
      ]
    }
  }
  ```

### 6.4 Test Aggiornamento (Update)
Chiamata `PUT /api/users/:id` con modifica del nome e della città:
```json
{
  "success": true,
  "message": "Profilo utente aggiornato con successo.",
  "data": {
    "id": "42c8d0dd-367e-4e79-ad35-827af799c8a8",
    "email": "mario.rossi@example.com",
    "nome": "Mario Luigi",
    "cognome": "Rossi",
    "citta": "Pozzuoli"
  }
}
```

### 6.5 Test Cancellazione e Diritto all'Oblio (Delete)
Chiamata `DELETE /api/users/:id`:
```json
{
  "success": true,
  "message": "Profilo utente eliminato con successo.",
  "data": {
    "id": "42c8d0dd-367e-4e79-ad35-827af799c8a8",
    "email": "mario.rossi@example.com",
    "nome": "Mario Luigi",
    "cognome": "Rossi"
  }
}
```
La successiva interrogazione `GET /api/users/:id` ha restituito correttamente l'errore `404 Not Found` (`USER_NOT_FOUND`), confermando la rimozione completa del record dal database.
