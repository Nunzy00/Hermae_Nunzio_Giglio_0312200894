# Diagramma della Macchina a Stati del Prestito e Transazioni ACID

> **Progetto:** Hermae — *"Il sapere, un libro alla volta"*  
> **Candidato:** Nunzio Giglio (Matricola: 0312200894)  
> **Corso di Laurea:** Informatica per le Aziende Digitali (L-31) — Università Telematica Pegaso  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14**  
> **Collocazione:** Cartella `MULTIMEDIA/` — Documentazione Tecnica e Tesi  

---

## 1. Descrizione del Ciclo di Vita del Prestito

La gestione del prestito tra utenti privati in **Hermae** è formalizzata come una **macchina a stati finiti (FSM - Finite State Machine)** implementata all'interno di transazioni relazionali **ACID** (*Atomicity, Consistency, Isolation, Durability*) gestite da PostgreSQL.

### Risoluzione della Concorrenza e Locking Pessimistico
Per prevenire anomalie di concorrenza del tipo *Race Condition* o *Double Booking* (assegnazione contemporanea dello stesso esemplare fisico a due richiedenti diversi), il server esegue l'accettazione all'interno di una transazione serializzata con clausola:
```sql
SELECT id, stato_disponibilita FROM esemplari WHERE id = $1 FOR UPDATE;
```
Tale lock pessimistico garantisce che, all'atto dell'accettazione di una richiesta:
1. Lo stato dell'esemplare transiti atomicamente a `IN_PRESTITO`.
2. Tutte le richieste concorrenti rimaste in stato `IN_ATTESA` per il medesimo esemplare vengano contestualmente e automaticamente rigettate dal motore con notifica ai richiedenti concorrenti.

---

## 2. Diagramma a Stati Finiti (Mermaid stateDiagram-v2)

```mermaid
stateDiagram-v2
    [*] --> IN_ATTESA : Invio richiesta prestito (POST /api/prestiti)
    
    note right of IN_ATTESA
        Esemplare: DISPONIBILE
        Chat privata aperta
        Richiesta visibile al proprietario
    end note

    IN_ATTESA --> RIFIUTATA : Rifiuto da parte del proprietario
    IN_ATTESA --> ANNULLATA : Revoca da parte del richiedente

    IN_ATTESA --> ACCETTATA : Accettazione proprietario\n[Lock Transazionale 'FOR UPDATE']

    state ACCETTATA {
        [*] --> BloccoEsemplare : Esemplare marcato 'IN_PRESTITO'
        BloccoEsemplare --> AutoRigettoConcorrenti : Scarto automatico altre richieste 'IN_ATTESA'
        AutoRigettoConcorrenti --> CalcoloScadenza : Calcolo data_scadenza (+30 gg)
    }

    ACCETTATA --> IN_CORSO : Scambio fisico avvenuto\n(Conferma consegna manuale o automatica)

    note right of IN_CORSO
        Esemplare: IN_PRESTITO (non visibile per nuovi prestiti)
        Monitoraggio data scadenza attivo
        Chat attiva per il reso
    end note

    IN_CORSO --> RESTITUITO : Chiusura prestito con restituzione fisica\n(Esemplare torna 'DISPONIBILE')

    RIFIUTATA --> [*] : Archiviazione richiesta
    ANNULLATA --> [*] : Archiviazione richiesta
    RESTITUITO --> [*] : Feedback e storico conservato
```

---

## 3. Matrice delle Transizioni di Stato

| Stato Sorgente | Evento / Azione | Condizione di Guardia | Stato Destinazione | Effetto Collaterale su Esemplare |
| :--- | :--- | :--- | :--- | :--- |
| **Non Esistente** | `POST /api/prestiti` | Utente autenticato $\ne$ Proprietario | `IN_ATTESA` | Nessuno (`stato_disponibilita = DISPONIBILE`). Genera notifica. |
| `IN_ATTESA` | `PATCH /:id/rifiuta` | Eseguito dal proprietario | `RIFIUTATA` | Nessuno (`DISPONIBILE`). Notifica al richiedente. |
| `IN_ATTESA` | `PATCH /:id/annulla` | Eseguito dal richiedente | `ANNULLATA` | Nessuno (`DISPONIBILE`). Notifica al proprietario. |
| `IN_ATTESA` | `PATCH /:id/accetta` | Esemplare ancora `DISPONIBILE` (Lock `FOR UPDATE`) | `ACCETTATA` | `stato_disponibilita = IN_PRESTITO`. Auto-rifiuto richieste concorrenti. |
| `ACCETTATA` | `PATCH /:id/avvia` | Consegna materiale concordata via chat | `IN_CORSO` | Permane `IN_PRESTITO`. Inizio decorrenza giorni prestito. |
| `IN_CORSO` | `PATCH /:id/restituisci` | Restituzione verificata dal proprietario | `RESTITUITO` | `stato_disponibilita = DISPONIBILE`. Chiusura thread chat. |

---

## 4. Diagramma di Sequenza della Risoluzione Concorrente (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    actor U1 as Richiedente A (Primo)
    actor U2 as Richiedente B (Concorrente)
    participant API as Server Express API
    participant DB as PostgreSQL (ACID Transaction)
    actor P as Proprietario Esemplare

    U1->>API: POST /api/prestiti (Richiesta A)
    API->>DB: INSERT INTO richieste_prestito (IN_ATTESA)
    U2->>API: POST /api/prestiti (Richiesta B)
    API->>DB: INSERT INTO richieste_prestito (IN_ATTESA)
    
    Note over P,DB: Il proprietario decide di accettare la Richiesta A
    P->>API: PATCH /api/prestiti/richiesta-A/accetta
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT * FROM esemplari WHERE id = $1 FOR UPDATE
    Note over DB: Lock di riga acquisito sull'esemplare
    API->>DB: UPDATE esemplari SET stato_disponibilita = 'IN_PRESTITO'
    API->>DB: UPDATE richieste_prestito SET stato = 'ACCETTATA' WHERE id = 'A'
    API->>DB: UPDATE richieste_prestito SET stato = 'RIFIUTATA' WHERE esemplare_id = $1 AND stato = 'IN_ATTESA'
    API->>DB: COMMIT TRANSACTION
    Note over DB: Transazione completata atomicamente

    API-->>P: Esito 200 OK (Prestito accettato)
    API-->>U1: Notifica: "La tua richiesta di prestito è stata accettata!"
    API-->>U2: Notifica: "L'esemplare è stato assegnato ad un altro utente."
```
