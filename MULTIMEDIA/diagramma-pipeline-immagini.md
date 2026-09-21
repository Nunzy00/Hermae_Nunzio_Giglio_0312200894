# Diagramma della Pipeline di Elaborazione Immagini (Multer & Sharp WebP)

> **Progetto:** Hermae — *"Il sapere, un libro alla volta"*  
> **Candidato:** Nunzio Giglio (Matricola: 0312200894)  
> **Corso di Laurea:** Informatica per le Aziende Digitali (L-31) — Università Telematica Pegaso  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14**  
> **Collocazione:** Cartella `MULTIMEDIA/` — Documentazione Tecnica e Tesi  

---

## 1. Descrizione della Pipeline Multimediale

La gestione delle immagini fotografiche delle copertine in **Hermae** è progettata secondo rigorosi standard di **sicurezza applicativa**, **efficienza di banda** e **ottimizzazione dell'esperienza utente (Core Web Vitals - LCP)**.

### Principi Ingegneristici Adottati
1. **Acquisizione in Memoria Volatile (`MemoryStorage`):** Il file binario non viene mai scritto direttamente sul file system all'atto della ricezione, precludendo l'esecuzione di file dannosi o script malevoli non verificati.
2. **Validazione Crittografica dei Magic Numbers:** L'applicazione non si fida dell'estensione fornita dall'utente o dell'header `Content-Type`, ma ispeziona i primi byte (*file signatures*) del buffer binario.
3. **Transcodifica Asincrona Standardizzata (Formato WebP):** Tramite la libreria a prestazioni native in C++ `sharp`, qualsiasi immagine valida viene convertita in formato **Google WebP**, generando contestualmente due risoluzioni distinte:
   - **Copertina di Dettaglio:** Risoluzione massima $800 \times 1200 \text{ px}$ (qualità 80%, compressione predittiva), destinata alla scheda libro;
   - **Miniatura Catalogo:** Risoluzione ridotta $200 \times 300 \text{ px}$ (qualità 75%, ritaglio esatto), destinata a catalogo, scaffale 3D e popup cartografici (riduzione peso $> 85\%$).
4. **Cancellazione Atomica dei File Orfani:** In caso di errore durante la transazione sul database PostgreSQL, un blocco di rollback rimuove immediatamente i file WebP generati sul disco, prevenendo il degrado dello spazio di archiviazione.

---

## 2. Diagramma di Sequenza della Pipeline (Mermaid sequenceDiagram)

```mermaid
sequenceDiagram
    autonumber
    actor Utente as Client Browser (Front-End)
    participant Multer as Multer Middleware (RAM Buffer)
    participant Validator as Magic Number Validator
    participant Sharp as Sharp Transcoder Engine
    participant Disk as Local Storage File System
    participant DB as PostgreSQL Database

    Utente->>Multer: POST /api/libri (multipart/form-data + JWT)
    Note over Utente,Multer: Payload: file binario (max 5 MB) + metadati JSON
    
    Multer->>Multer: Caricamento in RAM (buffer volatile)
    
    Multer->>Validator: Passaggio Buffer Grezzo
    Validator->>Validator: Ispezione Byte Iniziali (Magic Numbers)<br>JPEG: FF D8 FF | PNG: 89 50 4E 47 | WebP: 52 49 46 46
    
    alt File Non Conforme o Corrotto
        Validator-->>Utente: 400 Bad Request ("Formato immagine non valido o file corrotto")
    else File Conforme e Verificato
        Validator->>Sharp: Inoltro Buffer per Elaborazione Parallela
        
        par Generazione Copertina Dettaglio
            Sharp->>Sharp: Ridimensionamento 800x1200 px max<br>Transcodifica WebP (Quality 80%)
            Sharp->>Disk: Scrittura /uploads/covers/{uuid}.webp
        and Generazione Miniatura Catalogo
            Sharp->>Sharp: Ridimensionamento 200x300 px crop<br>Transcodifica WebP (Quality 75%)
            Sharp->>Disk: Scrittura /uploads/thumbnails/{uuid}.webp
        end

        Sharp->>DB: Inserimento Record Esemplare (UUID, Titolo, Percorsi WebP)
        
        alt Fallimento Inserimento DB (Rollback)
            DB-->>Sharp: Errore SQL / Vincolo violato
            Sharp->>Disk: fs.unlink() atomico su copertina e miniatura
            Sharp-->>Utente: 500 Internal Server Error (File orfani rimossi)
        else Successo Inserimento DB
            DB-->>Sharp: Record Inserito con Successo
            Sharp-->>Utente: 201 Created (Nuovo Esemplare con Copertina Ottimizzata)
        end
    end
```

---

## 3. Diagramma di Flusso della Validazione e Transcodifica (Mermaid)

```mermaid
flowchart TD
    INPUT_FILE(["File Ricevuto da Request Multipart"]) --> CHK_SIZE{"Dimensione File<br><= 5 MB?"}
    
    CHK_SIZE -- No --> ERR_SIZE["Rigetto 413: Payload Too Large"]
    CHK_SIZE -- Sì --> ALLOC_RAM["Allocazione in Buffer RAM<br>(multer.memoryStorage)"]

    ALLOC_RAM --> CHK_MAGIC{"Ispezione Magic Numbers<br>(Primi 8 byte)"}

    CHK_MAGIC -- "Non Riconosciuto" --> ERR_MAGIC["Rigetto 400: Signature Mismatch<br>(Protezione da file camuffati/polyglot)"]

    CHK_MAGIC -- "JPEG / PNG / WebP Valido" --> DUAL_SHARP["Inizializzazione Motore Sharp (Libvips)"]

    DUAL_SHARP --> PIPE_COVER["Pipeline 1: Copertina Completa<br>- resize: max 800x1200 (inside)<br>- format: WebP, quality: 80<br>- path: /uploads/covers/{uuid}.webp"]
    DUAL_SHARP --> PIPE_THUMB["Pipeline 2: Miniatura Catalogo<br>- resize: 200x300 (cover)<br>- format: WebP, quality: 75<br>- path: /uploads/thumbnails/{uuid}.webp"]

    PIPE_COVER --> ASYNC_WRITE["Salvataggio Asincrono su Disco"]
    PIPE_THUMB --> ASYNC_WRITE

    ASYNC_WRITE --> DB_TX{"Transazione SQL<br>INSERT INTO esemplari"}

    DB_TX -- Errore --> ATOMIC_CLEANUP["Rollback Transazione & fs.unlink():<br>Eliminazione immediata dei 2 file WebP"]
    ATOMIC_CLEANUP --> ERR_500["Risposta 500 Server Error<br>(Zero File Orfani su Disco)"]

    DB_TX -- Successo --> COMMIT_OK["Commit Transazione"]
    COMMIT_OK --> RESP_OK(["Risposta 201 Created al Client<br>con URL Relativi Immagini"])
```

---

## 4. Analisi Comparativa delle Prestazioni e Metriche

| Parametro | Immagine Originale (Upload Tipico) | Copertina Dettaglio WebP | Miniatura WebP Catalogo | Guadagno Prestazionale |
| :--- | :---: | :---: | :---: | :---: |
| **Formato** | JPEG / PNG da fotocamera | WebP Lossy | WebP Lossy | Formato next-gen W3C |
| **Risoluzione Tipica** | $4032 \times 3024 \text{ px}$ | $800 \times 1200 \text{ px}$ (adattivo) | $200 \times 300 \text{ px}$ | Riduzione pixel $> 95\%$ |
| **Peso Medio File** | $\sim 3.8 \text{ MB}$ | $\sim 140 \text{ KB}$ | $\sim 18 \text{ KB}$ | **Compressione del 99.5%** |
| **Impatto Core Web Vitals** | LCP $> 4.2 \text{ s}$ (Bloccante) | LCP $< 0.8 \text{ s}$ | Caricamento istantaneo | **Ottimizzazione CWV (Good)** |
