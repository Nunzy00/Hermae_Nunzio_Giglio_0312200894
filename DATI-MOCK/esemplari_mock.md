# Esemplari Mock per Testing e Collaudo — Piattaforma Hermae

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `DATI-MOCK/`  
> **File:** `esemplari_mock.md`  

---

## 1. Finalità e Modello Concettuale

Il presente documento formalizza il dataset di prova degli **esemplari** (*copie fisiche materiali di volumi possedute da utenti privati*) pre-popolati nel database relazionale PostgreSQL `hermae_db`.

A seguito del completamento delle **Fasi 18, 19 e 20**, ogni esemplare integra:
1. **Appartenenza Univoca e Titolarità:** (`utente_id` $\rightarrow$ `utenti.id` con relazione $1:N$ e vincolo `ON DELETE CASCADE`);
2. **Tassonomia Gerarchica a Due Livelli:** macro-area disciplinare (`categoria_id` $\rightarrow$ `categorie.id`) e sottogenere tematico flessibile (`sottogenere`);
3. **Stato Conservazione e Disponibilità:** attributi fisici individuali (*Ottimo, Come nuovo, Buono, Usurato*) e operativi (*DISPONIBILE, IN_PRESTITO, NON_DISPONIBILE*);
4. **Geolocalizzazione Ereditata:** coordinate puntuali (`coordinate_esemplare POINT`) coerenti con la localizzazione dell'utente;
5. **Controllo Granulare di Visibilità e Privacy (Fase 20):** colonna booleana `visibile_pubblico BOOLEAN NOT NULL DEFAULT TRUE` abbinata al flag d'account `preferenze_privacy_utenti.mostra_libreria`.

---

## 2. Tabella Sinottica degli Esemplari Mock e Matrice di Visibilità

Il dataset è composto da **15 volumi complessivi**, distribuiti su 4 utenti posizionati strategicamente sul territorio (Napoli Centro, Vomero, Fuorigrotta e Roma).

| # | Titolo Opera | Autore | Macro-Categoria | Sottogenere | Proprietario | Visibilità Libro | Libreria Pubblica | Visibilità Community (Ricerca) |
| :-: | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| 1 | **Il nome della rosa** | Umberto Eco | Narrativa & Romanzi | Giallo & Thriller | Nunzio Giglio (`demo@hermae.it`) | 🌐 Pubblico | SI | **✅ Visibile** |
| 2 | **Clean Code** | Robert C. Martin | Informatica & Tecnologia | Ingegneria del Software | Nunzio Giglio (`demo@hermae.it`) | 🌐 Pubblico | SI | **✅ Visibile** |
| 3 | **Designing Data-Intensive Applications** | Martin Kleppmann | Informatica & Tecnologia | Architetture Software | Nunzio Giglio (`demo@hermae.it`) | 🌐 Pubblico | SI | **✅ Visibile** |
| 4 | **Pensieri lenti e veloci** | Daniel Kahneman | Saggistica & Filosofia | Psicologia & Psicoanalisi | Nunzio Giglio (`demo@hermae.it`) | 🔒 Privato | SI | **❌ Nascosto (Privacy)** |
| 5 | **L'errore di Cartesio** | Antonio Damasio | Saggistica & Filosofia | Filosofia della Mente | Nunzio Giglio (`demo@hermae.it`) | 🔒 Privato | SI | **❌ Nascosto (Privacy)** |
| 6 | **Se questo è un uomo** | Primo Levi | Storia & Biografie | Storia Contemporanea | Laura Bianchi (`laura.bianchi@example.com`) | 🌐 Pubblico | SI | **✅ Visibile** |
| 7 | **L'ordine del tempo** | Carlo Rovelli | Scienze & Matematica | Fisica Quantistica | Laura Bianchi (`laura.bianchi@example.com`) | 🌐 Pubblico | SI | **✅ Visibile** |
| 8 | **Design Patterns** | Gamma, Helm, Johnson, Vlissides | Informatica & Tecnologia | Ingegneria del Software | Laura Bianchi (`laura.bianchi@example.com`) | 🔒 Privato | SI | **❌ Nascosto (Privacy)** |
| 9 | **Memorie del sottosuolo** | Fëdor Dostoevskij | Narrativa & Romanzi | Classici Letterari | Laura Bianchi (`laura.bianchi@example.com`) | 🔒 Privato | SI | **❌ Nascosto (Privacy)** |
| 10 | **Le città invisibili** | Italo Calvino | Narrativa & Romanzi | Classici Letterari | Marco De Luca (`marco.deluca@example.com`) | 🌐 Pubblico | **NO (Occultata)** | **❌ Nascosto (Libreria off)** |
| 11 | **Storia della bellezza** | Umberto Eco | Arte & Architettura | Storia dell'Arte | Marco De Luca (`marco.deluca@example.com`) | 🌐 Pubblico | **NO (Occultata)** | **❌ Nascosto (Libreria off)** |
| 12 | **Istituzioni di Diritto Privato** | Pietro Trimarchi | Economia & Diritto | Diritto Civile | Marco De Luca (`marco.deluca@example.com`) | 🔒 Privato | **NO (Occultata)** | **❌ Nascosto (Libreria off)** |
| 13 | **Gödel, Escher, Bach** | Douglas Hofstadter | Saggistica & Filosofia | Filosofia della Scienza | Giulia Romano (`giulia.romano@example.com`) | 🌐 Pubblico | SI | **✅ Visibile** |
| 14 | **Breve storia del tempo** | Stephen Hawking | Scienze & Matematica | Astrofisica & Cosmologia | Giulia Romano (`giulia.romano@example.com`) | 🌐 Pubblico | SI | **✅ Visibile** |
| 15 | **Il Capitale nel XXI secolo** | Thomas Piketty | Economia & Diritto | Economia Politica | Giulia Romano (`giulia.romano@example.com`) | 🔒 Privato | SI | **❌ Nascosto (Privacy)** |

---

## 3. Riepilogo Quantitativo dei Dati Mock

- **Totale Volumi Fisici a Sistema:** $15$
- **Volumi Pubblici alla Community:** $7$
  - Nunzio Giglio: $3$ volumi
  - Laura Bianchi: $2$ volumi
  - Giulia Romano: $2$ volumi
- **Volumi Nascosti alla Community (Tutela Privacy):** $8$
  - Libri privati di utenti con libreria visibile: $5$ ($2$ di Nunzio, $2$ di Laura, $1$ di Giulia)
  - Intero scaffale occultato di Marco De Luca: $3$ volumi (tutti schermati perché `mostra_libreria = false`)

---

## 4. Guida Pratica per il Collaudo e la Verifica

### Scenario A: Test della Vista Personale di Nunzio Giglio (`demo@hermae.it`)
1. Effettuare il login con `demo@hermae.it` / `Password123!` su `http://localhost:3000/login.html`;
2. Navigare su **"La Mia Libreria"** (`libreria.html`);
3. **Risultato Atteso:**
   - Compaiono tutti i **5 libri personali** (sia i 3 pubblici che i 2 privati);
   - I volumi privati (*Pensieri lenti e veloci*, *L'errore di Cartesio*) mostrano il badge scuro `🔒 Privato` e nella tabella il pulsante con icona occhio barrato giallo;
   - Selezionando il filtro **"🔒 Solo Privati"**, la vista mostra esclusivamente i 2 volumi riservati;
   - Cliccando sull'icona occhio di un libro privato, viene invocato `PATCH /api/esemplari/:id/visibilita` e il libro diventa istantaneamente pubblico.

---

### Scenario B: Test della Vista Personale di Laura Bianchi (`laura.bianchi@example.com`)
1. Effettuare il logout ed accedere con `laura.bianchi@example.com` / `PasswordSicura456!`;
2. Aprire `libreria.html`;
3. **Risultato Atteso:**
   - Laura visualizza i suoi **4 libri personali** (2 pubblici e 2 privati: *Design Patterns* e *Memorie del sottosuolo*);
   - Laura può modificare la visibilità dei suoi libri, ma Nunzio non può visualizzare i libri privati di Laura quando cerca libri nella community.

---

### Scenario C: Test dell'Occultamento Intera Libreria con Marco De Luca (`marco.deluca@example.com`)
1. Effettuare il login con `marco.deluca@example.com` / `Password123!`;
2. Aprire `libreria.html`;
3. **Risultato Atteso:**
   - In testa alla pagina compare il **banner giallo di avviso**: *"Libreria Personale Occultata al Pubblico - Hai disattivato la visibilità della tua intera libreria nelle impostazioni di privacy. I tuoi libri rimangono consultabili solo da te."*;
   - Marco vede comunque tutti i suoi **3 libri** nel proprio inventario personale;
   - Cliccando su **"Gestisci Privacy"** nel banner si apre `impostazioni.html` dove Marco può riattivare lo switch `mostra_libreria`.

---

### Scenario D: Test della Ricerca Pubblica di Prossimità / Catalogo
1. Interrogare l'endpoint pubblico `GET http://localhost:3000/api/esemplari` (da browser o Postman/curl);
2. **Risultato Atteso:**
   - Vengono restituiti esattamente **7 volumi**;
   - **NESSUN libro privato** di Nunzio, Laura o Giulia compare tra i risultati;
   - **NESSUN libro di Marco De Luca compare** tra i risultati (schermatura totale dell'account per `mostra_libreria = false`).

---

### Scenario E: Collaudo Rapido via Script Node.js
È possibile eseguire in qualsiasi momento lo script di collaudo rapido da terminale:
```bash
node server/test_mock_privacy.js
```
Lo script effettua il login per ciascun utente, interroga la vista personale, la ricerca pubblica e testa la protezione `404 Not Found` per l'accesso a libri riservati.
