# Indice degli Schemi e Diagrammi Architetturali (Multimedia & Diagrams)

> **Progetto:** Hermae — *"Il sapere, un libro alla volta"*  
> **Candidato:** Nunzio Giglio (Matricola: 0312200894)  
> **Corso di Laurea:** Laurea Triennale in Informatica per le Aziende Digitali (L-31) — Università Telematica Pegaso  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Collocazione Repository:** Cartella `/MULTIMEDIA/`  

---

## 1. Finalità della Documentazione Visuale

La presente cartella raccoglie il **corpus grafico e diagrammatico formale** a supporto della Tesi di Laurea e del Rapporto Tecnico del progetto **Hermae**. Ciascun file è redatto in formato **Markdown nativo (`.md`)** ed include diagrammi vettoriali standardizzati **Mermaid**, visualizzabili direttamente sia su GitHub che all'interno di qualsiasi visualizzatore Markdown conforme (es. VS Code, editor di tesi o strumenti di rendering PDF/HTML).

I diagrammi formalizzano con rigore accademico i diversi livelli di astrazione del sistema, coprendo l'architettura logico-infrastrutturale, la persistenza relazionale, le macchine a stati di business, gli algoritmi di crittografia e privacy geospaziale, l'esperienza utente e la sicurezza dei dati multimediali.

---

## 2. Elenco dei Diagrammi e Riferimenti Accademici

| File Diagramma | Tipologia Mermaid | Oggetto di Analisi e Descrizione Ingegneristica | Capitolo Tesi di Riferimento |
| :--- | :---: | :--- | :---: |
| [diagramma-architettura-software.md](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/MULTIMEDIA/diagramma-architettura-software.md) | `graph TD` | **Architettura a 3 Livelli (Three-Tier Layered Architecture):** Disaccoppiamento tra Presentation Layer (11 viste HTML5, Vue.js CDN, PWA Service Worker, Leaflet.js), Business Logic (Express.js, JWT, Privacy Shield) e Data Layer (PostgreSQL 15+, GiST, storage WebP). | Parte II — Sez. 1 & 2 |
| [diagramma-entita-relazione.md](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/MULTIMEDIA/diagramma-entita-relazione.md) | `erDiagram` | **Modello E-R Concettuale e Logico (3FN):** Struttura relazionale normalizzata a 9 entità con chiavi primarie `UUID v4`, separazione tra Utente, Posizione e Privacy, tassonomia gerarchica a 2 livelli e tracciamento audit GDPR (`consensi_cmp_utenti`). | Parte II — Sez. 3 |
| [diagramma-stati-prestito.md](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/MULTIMEDIA/diagramma-stati-prestito.md) | `stateDiagram-v2` & `sequenceDiagram` | **Macchina a Stati Finiti (FSM) e Transazioni ACID:** Ciclo di vita del prestito (`IN_ATTESA`, `ACCETTATA`, `RIFIUTATA`, `IN_CORSO`, `RESTITUITO`), locking pessimistico `SELECT ... FOR UPDATE` per la prevenzione di double-booking e auto-rigetto concorrente. | Parte II — Sez. 2 |
| [diagramma-flusso-privacy.md](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/MULTIMEDIA/diagramma-flusso-privacy.md) | `flowchart TD` | **Privacy by Design & Spatial Blurring:** Algoritmo trigonometrico sferico WGS 84 a 3 modalità (Quartiere 300–500 m, Area CAP, Totale) e pipeline euristica regex **Hermae Privacy Shield** per la protezione dei recapiti privati nella chat peer-to-peer. | Parte II — Sez. 4 |
| [diagramma-sitemap-navigazione.md](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/MULTIMEDIA/diagramma-sitemap-navigazione.md) | `graph TD` | **Architettura Informativa e Sitemap:** Mappa gerarchica delle 11 viste del portale, separazione tra Area Pubblica libera e Area Riservata con guardie crittografiche JWT Bearer, flussi utente e componenti modali (CMP, Chat). | Parte II — Sez. 5 |
| [diagramma-pipeline-immagini.md](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/MULTIMEDIA/diagramma-pipeline-immagini.md) | `sequenceDiagram` & `flowchart TD` | **Pipeline di Elaborazione Media Asincrona:** Validazione crittografica dei Magic Numbers via buffer in RAM (Multer), transcodifica WebP ad alte prestazioni (Sharp) a doppia risoluzione (800x1200 px e 200x300 px) e rollback atomico dei file orfani. | Parte II — Sez. 2 & 5 |

---

## 3. Istruzioni per la Consultazione e Rendering

Tutti i diagrammi contenuti in questa cartella possono essere:
1. **Visualizzati direttamente su GitHub:** Il motore nativo di rendering Markdown di GitHub trasforma automaticamente i blocchi ` ```mermaid ` in grafici interattivi ad alta definizione.
2. **Esportati in formato vettoriale (SVG / PNG):** Utilizzando il [Mermaid Live Editor](https://mermaid.live/) o estensioni dedicate per Visual Studio Code (es. *Markdown Preview Mermaid Support*), è possibile esportare i diagrammi per l'inserimento in documenti di tesi stampati o presentazioni per la commissione.
3. **Inclusi nella Tesi di Laurea:** I contenuti descrittivi e le tabelle di ciascun file sono già armonizzati con la terminologia del documento `rapporto-tecnico.md` e dell'elaborato finale Word (`Giglio_Nunzio_0312200894_VersioneFinale.docx`).
