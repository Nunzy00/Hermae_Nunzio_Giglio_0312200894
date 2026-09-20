# Utenti Mock per Testing e Collaudo — Piattaforma Hermae

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `DATI-MOCK/`  
> **File:** `utenti_mock.md`  

---

## 1. Finalità del Documento

Questo documento elenca l'insieme degli account utente di test (*mock users*) pre-configurati all'interno del database relazionale geospaziale PostgreSQL (`hermae_db`).  
Gli account sono pronti all'uso per effettuare le sessioni di collaudo funzionale, test di autenticazione (login/logout/refresh token), navigazione della dashboard, gestione della geolocalizzazione di prossimità (`impostazioni.html`) e future simulazioni di prestito librario e messaggistica.

---

## 2. Tabella Credenziali e Dati di Localizzazione

| Utente | Email (Login) | Password (Collaudo) | Città / Zona | Coordinate WGS84 (Lat, Lng) | Raggio Ricerca | Scenario di Testing Prevalente |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **Nunzio Giglio** | `demo@hermae.it` | `Password123!` | Napoli (Centro Storico) | `40.8518000, 14.2681000` | $5\text{ km}$ | **Utente Principale:** Cruscotto, gestione libreria, modifica coordinate e slider raggio. |
| **Laura Bianchi** | `laura.bianchi@example.com` | `PasswordSicura456!` | Napoli (Vomero) | `40.8400000, 14.2500000` | $5\text{ km}$ | **Prossimità Immediata (~1.5 km):** Scambio di quartiere, visualizzazione su mappa locale. |
| **Marco De Luca** | `marco.deluca@example.com` | `Password123!` | Napoli (Fuorigrotta) | `40.8250000, 14.1950000` | $10\text{ km}$ | **Media Prossimità (~6 km):** Test estensione raggio (visibile solo se raggio $\ge 7\text{ km}$). |
| **Giulia Romano** | `giulia.romano@example.com` | `Password123!` | Roma (Trastevere) | `41.8880000, 12.4700000` | $5\text{ km}$ | **Fuori Raggio / Altra Città:** Test isolamento territoriale e filtri geografici provinciali. |

---

## 3. Dettaglio dei Profili Utente e Scenari di Utilizzo

### 3.1 Utente Demo: Nunzio Giglio
- **Email:** `demo@hermae.it`
- **Password:** `Password123!`
- **Ubicazione:** Napoli — Centro Storico / Piazza del Plebiscito
- **Coordinate Reali:** Latitudine `40.8518000`, Longitudine `14.2681000`
- **Raggio di Ricerca Predefinito:** $5\text{ km}$ (configurabile fino a $50\text{ km}$)
- **Scopo Principale:** È il profilo di riferimento primario per dimostrazioni e revisioni. Permette di accedere alla **Dashboard**, visualizzare le metric-card, navigare su **Impostazioni & Privacy**, verificare il ricalcolo dello *spatial blurring* (300–500m) e testare il rilevamento GPS tramite browser.

---

### 3.2 Utente di Quartiere: Laura Bianchi
- **Email:** `laura.bianchi@example.com`
- **Password:** `PasswordSicura456!`
- **Ubicazione:** Napoli — Quartiere Vomero / Chiaia
- **Coordinate Reali:** Latitudine `40.8400000`, Longitudine `14.2500000`
- **Distanza rispetto a Demo:** $\approx 1.5\text{ km}$
- **Raggio di Ricerca Predefinito:** $5\text{ km}$
- **Scopo Principale:** Collaudo dello scambio iper-locale a livello di quartiere. Quando `demo@hermae.it` cerca utenti o libri con raggio $5\text{ km}$, il profilo di Laura Bianchi viene regolarmente intercettato dalla query spaziale PostGIS (`earthdistance`).

---

### 3.3 Utente Metropolitano: Marco De Luca
- **Email:** `marco.deluca@example.com`
- **Password:** `Password123!`
- **Ubicazione:** Napoli — Quartiere Fuorigrotta / Campi Flegrei
- **Coordinate Reali:** Latitudine `40.8250000`, Longitudine `14.1950000`
- **Distanza rispetto a Demo:** $\approx 6.4\text{ km}$
- **Raggio di Ricerca Predefinito:** $10\text{ km}$
- **Scopo Principale:** Test di calibrazione dello slider del raggio chilometrico:
  - Se l'utente imposta un raggio di $5\text{ km}$, Marco De Luca **non** compare tra i risultati di prossimità;
  - Se l'utente incrementa il raggio a $10\text{ km}$ o $15\text{ km}$, Marco De Luca viene immediatamente incluso nei risultati con calcolo accurato della distanza geodetica.

---

### 3.4 Utente Fuori Raggio: Giulia Romano
- **Email:** `giulia.romano@example.com`
- **Password:** `Password123!`
- **Ubicazione:** Roma — Quartiere Trastevere
- **Coordinate Reali:** Latitudine `41.8880000`, Longitudine `12.4700000`
- **Distanza rispetto a Demo:** $\approx 188\text{ km}$
- **Raggio di Ricerca Predefinito:** $5\text{ km}$
- **Scopo Principale:** Validazione dei filtri di contenimento geografico. Permette di verificare che le query perimetrali (`earth_box`) escludano rigorosamente i profili dislocati al di fuori del confine di prossimità selezionato, preservando l'integrità del modello di scambio locale.

---

## 4. Modalità di Verifica e Accesso da Front-end

1. **Accesso alla Piattaforma:**
   - Aprire il browser su: `http://localhost:3000/login.html`
   - Inserire l'indirizzo email e la relativa password indicate nella tabella sopra;
   - Premere **"Accedi alla Piattaforma"**.

2. **Verifica Dashboard e Token:**
   - All'avvenuto login si atterra su `http://localhost:3000/dashboard.html`;
   - Il banner di benvenuto mostrerà il nome utente e la città associata;
   - La sessione è protetta da Access Token JWT e Refresh Token memorizzati nel `localStorage`.

3. **Verifica e Modifica Coordinate (`impostazioni.html`):**
   - Dal menu in alto a destra cliccare su **"Privacy & Impostazioni"** oppure raggiungere `http://localhost:3000/impostazioni.html`;
   - È possibile modificare città, quartiere, latitudine e longitudine, utilizzare il pulsante **"Rileva Posizione con Browser (GPS)"** o trascinare lo slider del raggio tra $1$ e $50\text{ km}$;
   - Al salvataggio (`PUT /api/posizioni/me`), il sistema ri-applica l'algoritmo di *spatial blurring* aggiornando le coordinate offuscate di mappa;
   - È possibile testare il **Diritto all'Oblio (Art. 17 GDPR)** eliminando le coordinate con il pulsante dedicato in fondo alla pagina.

4. **Test di Disconnessione:**
   - Cliccare su **"Disconnetti"** nel menu a tendina dell'account per invocare `logout.html`, azzerare il `localStorage` e tornare alla schermata di accesso.
