# Esemplari Mock per Testing e Collaudo — Piattaforma Hermae

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `DATI-MOCK/`  
> **File:** `esemplari_mock.md`  

---

## 1. Finalità e Modello Concettuale

Il presente documento formalizza il dataset di prova degli **esemplari** (*copie fisiche materiali di volumi possedute da utenti privati*) pre-popolati nel database relazionale PostgreSQL `hermae_db`.

In conformità con il modello concettuale bibliografico internazionale **IFLA LRM** (*Library Reference Model*) e **FRBR** (*Functional Requirements for Bibliographic Records*), l'entità **Esemplare** (*Item*) costituisce l'istanza fisica e tangibile di una determinata *Manifestazione* e *Opera*. A differenza di un catalogo bibliotecario centralizzato, nella piattaforma peer-to-peer *Hermae* ogni esemplare:
1. Appartiene univocamente a un utente privato (`utente_id` $\rightarrow$ `utenti.id` con relazione $1:N$ e vincolo `ON DELETE CASCADE`);
2. È classificato secondo la tassonomia disciplinare della piattaforma (`categoria_id` $\rightarrow$ `categorie.id` con vincolo `ON DELETE RESTRICT`);
3. Presenta attributi fisici individuali propri della singola copia materiale: **stato di conservazione** (*Ottimo, Come nuovo, Buono, Usurato*), **note d'esemplare** (presenza di glosse, fioriture, dediche, integrità del dorso o della sovraccoperta), **lingua**, **editore**, e **stato di disponibilità** (*DISPONIBILE, IN_PRESTITO, NON_DISPONIBILE*);
4. Eredita o associa la geolocalizzazione dell'utente (`coordinate_esemplare POINT`) per abilitare i motori di calcolo spaziale PostGIS nelle ricerche di prossimità geografica.

---

## 2. Tabella Sinottica degli Esemplari Mock (Tassonomia Gerarchica a Due Livelli)

| Titolo Opera | Autore | Editore / Anno | ISBN | Categoria (Livello 1) | Sottogenere (Livello 2) | Stato Usura | Disponibilità | Proprietario Mock |
| :--- | :--- | :---: | :---: | :--- | :--- | :---: | :---: | :--- |
| **Il nome della rosa** | Umberto Eco | Bompiani (1980) | `9788845278655` | Narrativa & Romanzi | Giallo & Thriller | Ottimo | `DISPONIBILE` | Nunzio Giglio (`demo@hermae.it`) |
| **Clean Code** | Robert C. Martin | Prentice Hall (2008) | `9780132350884` | Informatica & Tecnologia | Ingegneria del Software | Come nuovo | `DISPONIBILE` | Nunzio Giglio (`demo@hermae.it`) |
| **Pensieri lenti e veloci** | Daniel Kahneman | Mondadori (2012) | `9788804623120` | Saggistica & Filosofia | Psicologia & Psicoanalisi | Buono | `IN_PRESTITO` | Nunzio Giglio (`demo@hermae.it`) |
| **Se questo è un uomo** | Primo Levi | Einaudi (1958) | `9788806219345` | Storia & Biografie | Storia Contemporanea & Guerre Mondiali | Ottimo | `DISPONIBILE` | Laura Bianchi (`laura.bianchi@example.com`) |
| **L'ordine del tempo** | Carlo Rovelli | Adelphi (2017) | `9788845931925` | Scienze & Matematica | Fisica Quantistica & Relatività | Come nuovo | `DISPONIBILE` | Laura Bianchi (`laura.bianchi@example.com`) |
| **Design Patterns** | Gamma, Helm, Johnson, Vlissides | Addison-Wesley (1994) | `9780201633610` | Informatica & Tecnologia | Ingegneria del Software | Buono | `DISPONIBILE` | Laura Bianchi (`laura.bianchi@example.com`) |
| **Le città invisibili** | Italo Calvino | Einaudi (1972) | `9788806218751` | Narrativa & Romanzi | Classici Letterari | Usurato | `DISPONIBILE` | Marco De Luca (`marco.deluca@example.com`) |
| **Storia della bellezza** | Umberto Eco | Bompiani (2004) | `9788845232497` | Arte, Architettura & Design | Storia dell'Arte | Ottimo | `DISPONIBILE` | Marco De Luca (`marco.deluca@example.com`) |
| **Gödel, Escher, Bach** | Douglas Hofstadter | Adelphi (1984) | `9788845907555` | Saggistica & Filosofia | Filosofia della Scienza | Ottimo | `DISPONIBILE` | Giulia Romano (`giulia.romano@example.com`) |
| **Breve storia del tempo** | Stephen Hawking | Rizzoli (1988) | `9788817079754` | Scienze & Matematica | Astrofisica & Cosmologia | Buono | `NON_DISPONIBILE` | Giulia Romano (`giulia.romano@example.com`) |

---

## 3. Dettaglio Schede Esemplari e Scenari di Collaudo

### 3.1 Libreria Utente Demo (`demo@hermae.it`)
- **Esemplare 1:** *Il nome della rosa* (Umberto Eco).
  - *Descrizione:* Celebre giallo storico ambientato in un monastero benedettino del XIV secolo.
  - *Note d'esemplare:* Prima edizione tascabile con copertina integra, lievi fioriture sui tagli.
  - *Stato Usura:* `Ottimo` | *Disponibilità:* `DISPONIBILE`.
  - *Scenario:* Collaudo della visualizzazione nella libreria personale, modifica dei metadati bibliografici e ricezione di future richieste di prestito.
- **Esemplare 2:** *Clean Code: A Handbook of Agile Software Craftsmanship* (Robert C. Martin).
  - *Descrizione:* Guida fondamentale ai principi dello sviluppo software pulito, refactoring e standard di leggibilità del codice.
  - *Note d'esemplare:* Edizione in lingua originale inglese. Nessuna sottolineatura, pari al nuovo.
  - *Stato Usura:* `Come nuovo` | *Disponibilità:* `DISPONIBILE`.
  - *Scenario:* Filtro per categoria tecnica (`Informatica & Tecnologia`) e test ricerca testuale full-text per autore.
- **Esemplare 3:** *Pensieri lenti e veloci* (Daniel Kahneman).
  - *Descrizione:* Trattato di economia comportamentale e psicologia cognitiva sui due sistemi che guidano i processi decisionali.
  - *Note d'esemplare:* Copertina con lievi segni d'uso, testo perfettamente leggibile ed integro.
  - *Stato Usura:* `Buono` | *Disponibilità:* `IN_PRESTITO`.
  - *Scenario:* Test visivo del badge di stato `IN_PRESTITO` (giallo/warning) e inibizione di ulteriori richieste concorrenti.

---

### 3.2 Libreria Laura Bianchi (`laura.bianchi@example.com`) — Prossimità 1.5 km
- **Esemplare 4:** *Se questo è un uomo* (Primo Levi) — Storia & Biografie, `Ottimo`, `DISPONIBILE`.
- **Esemplare 5:** *L'ordine del tempo* (Carlo Rovelli) — Scienze & Matematica, `Come nuovo`, `DISPONIBILE`.
- **Esemplare 6:** *Design Patterns* (GoF) — Informatica & Tecnologia, `Buono`, `DISPONIBILE`.
- *Scenario di Testing:* Permette all'utente Demo (`demo@hermae.it`), posizionato a Napoli Centro Storico, di individuare i volumi disponibili a breve raggio nel quartiere Vomero/Chiaia entro il raggio di $5\text{ km}$.

---

### 3.3 Libreria Marco De Luca (`marco.deluca@example.com`) — Media Distanza ~6.4 km
- **Esemplare 7:** *Le città invisibili* (Italo Calvino) — Narrativa & Romanzi, `Usurato`, `DISPONIBILE`.
  - Test verifica dello stato `Usurato` (badge grigio/arancione), a dimostrazione della valorizzazione di libri vissuti.
- **Esemplare 8:** *Storia della bellezza* (Umberto Eco) — Arte & Architettura, `Ottimo`, `DISPONIBILE`.
- *Scenario di Testing:* Verifica del filtraggio per raggio: con slider raggio a $5\text{ km}$ i libri non compaiono; aumentando il raggio a $10\text{ km}$ diventano accessibili.

---

### 3.4 Libreria Giulia Romano (`giulia.romano@example.com`) — Fuori Raggio (Roma)
- **Esemplare 9:** *Gödel, Escher, Bach: un'Eterna Ghirlanda Brillante* (Douglas Hofstadter) — Saggistica & Filosofia, `Ottimo`, `DISPONIBILE`.
- **Esemplare 10:** *Dal big bang ai buchi neri: Breve storia del tempo* (Stephen Hawking) — Scienze & Matematica, `Buono`, `NON_DISPONIBILE`.
- *Scenario di Testing:* Collaudo dell'isolamento geografico per la ricerca di prossimità locale e collaudo dello stato `NON_DISPONIBILE` (esemplare momentaneamente ritirato dal proprietario).
