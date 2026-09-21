# Fase 22 — Implementazione della funzione “Contatto” tra gli utenti

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-22.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stato sviluppato il modulo per consentire la richiesta di contatto o scambio messaggi tra chi possiede un libro e chi è interessato a riceverlo, comprensivo di notifiche interne e gestione dei thread di dialogo.

Nel dettaglio, le attività realizzate hanno compreso:
1. **Definizione delle Politiche Antispam e Rate Limiting (`privacyShieldService.js` & `richiesteService.js`):**
   - **Divieto di Auto-Richiesta:** verifica preventiva con blocco immediato (codice HTTP `400 BAD_REQUEST`) nel caso in cui un utente tenti di inviare una richiesta di scambio per un libro appartenente alla propria libreria personale;
   - **Prevenzione Richieste Duplicate Attive:** inibizione dell'invio di molteplici richieste simultanee verso lo stesso volume se è già presente una richiesta aperta nello stato `IN_ATTESA` o `ACCETTATA`;
   - **Rate Limiting a Finestra Scorrevole (Sliding Window):** limitazione a un massimo di 5 richieste di contatto nell'arco di 15 minuti per singolo account, con restituzione dello stato HTTP `429 Too Many Requests` per prevenire scraping, bot o condotte di molestia;
   - **Verifica Preferenze di Privacy del Proprietario:** rispetto stringente del flag `consenti_messaggi_diretti` nelle impostazioni di riservatezza dell'utente (`preferenze_privacy_utenti`), con rifiuto formale (`403 FORBIDDEN`) qualora il proprietario abbia scelto di non ricevere messaggi diretti dalla community.
2. **Schermatura Preventiva dei Contatti Diretti — Hermae Privacy Shield:**
   - Analisi ed elaborazione del testo mediante espressioni regolari (RFC 5322 per indirizzi email e pattern per telefoni fissi/mobili nazionali e internazionali);
   - Sostituzione deterministica con placeholder standard di sicurezza: `[EMAIL SCHERMATA A TUTELA PRIVACY]` e `[NUMERO SCHERMATO A TUTELA PRIVACY]`;
   - Sanitizzazione applicata sia al messaggio iniziale di richiesta, sia a tutti i messaggi successivi scambiati nella chat interna, garantendo che le comunicazioni rimangano tracciabili e sicure all'interno della piattaforma senza dispersione di recapiti privati.
3. **Sistema di Notifiche Interne Asincrone (`notificheService.js`, `notificheController.js`, `notificheRoutes.js`):**
   - Creazione della tabella PostgreSQL dedicata `notifiche` con indici per `utente_id`, stato di lettura `letta` e marcatura temporale;
   - Generazione automatica di notifiche interne per gli eventi cardine del ciclo di vita dello scambio:
     - `NUOVA_RICHIESTA` per il proprietario del libro alla ricezione di un contatto;
     - `NUOVO_MESSAGGIO` per l'interlocutore alla ricezione di una risposta in chat;
     - `STATO_AGGIORNATO` o `RICHIESTA_ACCETTATA` per il richiedente in caso di accettazione, rifiuto o chiusura;
   - Endpoint per il recupero delle notifiche (`GET /api/notifiche`), per il conteggio immediato delle non lette (`GET /api/notifiche/conteggio`), e per la marcatura come lette sia singola (`PATCH /api/notifiche/:id/letta`) sia cumulativa (`PATCH /api/notifiche/lette/tutte`).
4. **Gestione dei Thread di Dialogo & Chat Peer-to-Peer (`richiesteService.js`, `richiesteController.js`):**
   - Macchina a stati finiti con transizioni controllate: `IN_ATTESA` &rarr; `ACCETTATA` | `RIFIUTATA` | `ANNULLATA` &rarr; `COMPLETATA`;
   - Controllo rigoroso dei permessi: solo il proprietario può accettare o rifiutare la richiesta; solo il richiedente può annullare prima della risposta; entrambe le parti possono segnare lo scambio come completato una volta concordato;
   - Protezione da accessi terzi (`403 Forbidden` se un utente estraneo tenta di consultare o intervenire nel thread);
   - Inibizione automatica dell'invio di messaggi su scambi chiusi o archiviati (`COMPLETATA`, `RIFIUTATA`, `ANNULLATA`);
   - Marcatura automatica dei messaggi non letti come "letti" nel momento in cui l'interlocutore apre la conversazione.
5. **Nuova Interfaccia Centro Messaggi & Scambi (`hermae-frontend/chat.html` - Pagina 7):**
   - Layout desktop a doppia colonna con gestione fluida responsive per dispositivi mobili;
   - **Colonna Sinistra:** elenco conversazioni con anteprima dell'ultimo messaggio, badge del ruolo (*Richiesta Inviata* vs *Richiesta Ricevuta*), badge colorato dello stato, contatore messaggi non letti e filtri rapidi (*Tutti*, *In attesa*, *Attivi*, *Conclusi*);
   - **Colonna Destra:** testata con miniatura della copertina, titolo del volume, lettore partner e pulsanti contestuali per accettare, rifiutare, annullare o completare lo scambio; banner esplicativo del Privacy Shield; cronologia messaggi differenziata graficamente per mittente con spunte di lettura; input di risposta con helper antispam e contatore caratteri;
   - **Offcanvas Notifiche:** cassetto laterale con l'elenco delle notifiche di sistema, distinzione visiva non lette, tasto "Segna tutte come lette" e collegamento diretto al thread associato;
   - **Supporto Deep-Linking:** parametro URL `chat.html?id=...` per aprire direttamente la conversazione desiderata.
6. **Integrazione Richiesta Contatto nella Ricerca Libri (`hermae-frontend/ricerca.html`):**
   - Pulsanti "Richiedi Contatto" posizionati sui popup Leaflet della mappa geospaziale, sulle card della griglia, sulla tabella accessibile e all'interno della modale del profilo pubblico del lettore;
   - Modale Bootstrap dedicata `#modalRichiestaContatto` con riepilogo dell'opera, proprietario, disclaimer di riservatezza, form per il messaggio iniziale e collegamento rapido alla chat appena avviata;
   - Integrazione nella barra di navigazione globale (`NavbarLogged` in `global-components.js`) con indicatore numerico delle notifiche non lette.

---

## 2. Modello Dati e DDL Tabella Notifiche

Per gestire in modo persistente e performante le notifiche interne asincrone, è stata introdotta nel database relazionale la tabella `notifiche`:

```sql
-- 7. Creazione Tabella NOTIFICHE (Fase 22)
-- Notifiche interne asincrone per richieste di contatto, messaggistica e aggiornamenti di stato
CREATE TABLE IF NOT EXISTS notifiche (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    richiesta_id UUID REFERENCES richieste_prestito(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titolo VARCHAR(255) NOT NULL,
    messaggio TEXT NOT NULL,
    letta BOOLEAN DEFAULT FALSE,
    data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici di performance per notifiche utente e conteggio non lette
CREATE INDEX IF NOT EXISTS idx_notifiche_utente ON notifiche(utente_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_non_lette ON notifiche(utente_id, letta);
CREATE INDEX IF NOT EXISTS idx_notifiche_data ON notifiche(data_creazione DESC);
```

La query di aggregazione per l'elenco dei thread di dialogo raggruppa in modo efficiente le informazioni di catalogo, della controparte e dell'ultimo messaggio:

```sql
SELECT 
  r.id, r.esemplare_id, r.richiedente_id, r.proprietario_id, r.stato, r.messaggio_iniziale,
  r.data_richiesta, r.data_aggiornamento,
  e.titolo as libro_titolo, e.autore as libro_autore, 
  e.immagine_copertina, e.immagine_miniatura,
  CASE WHEN r.proprietario_id = $1 THEN 'PROPRIETARIO' ELSE 'RICHIEDENTE' END as ruolo,
  partner.id as partner_id, partner.nome as partner_nome,
  SUBSTRING(partner.cognome FROM 1 FOR 1) || '.' as partner_cognome_iniziale,
  pos.citta as partner_citta,
  last_msg.testo as ultimo_messaggio_testo,
  last_msg.data_invio as ultimo_messaggio_data,
  last_msg.mittente_id as ultimo_messaggio_mittente_id,
  COALESCE(unread.conteggio, 0) as messaggi_non_letti
FROM richieste_prestito r
JOIN esemplari e ON r.esemplare_id = e.id
JOIN utenti partner ON partner.id = CASE WHEN r.proprietario_id = $1 THEN r.richiedente_id ELSE r.proprietario_id END
LEFT JOIN posizione_utenti pos ON partner.id = pos.utente_id
LEFT JOIN LATERAL (
  SELECT testo, data_invio, mittente_id
  FROM messaggi_chat
  WHERE richiesta_id = r.id
  ORDER BY data_invio DESC
  LIMIT 1
) last_msg ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int as conteggio
  FROM messaggi_chat
  WHERE richiesta_id = r.id AND mittente_id != $1 AND letto = false
) unread ON true
WHERE r.richiedente_id = $1 OR r.proprietario_id = $1
ORDER BY COALESCE(last_msg.data_invio, r.data_richiesta) DESC;
```

---

## 3. Politiche Antispam e Algoritmo Privacy Shield

La schermatura dei contatti diretti intercetta pattern di contatto prevenendo la violazione delle condizioni di sicurezza della piattaforma:

```javascript
// privacyShieldService.js
const EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi;
const PHONE_REGEX = /(?:(?:\+|00)39[\s.-]?)?(?:(?:3\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4})|(?:0\d{1,4}[\s.-]?\d{5,8})|(?:\b[30]\d{8,11}\b))/g;

const sanitizeMessage = (testo) => {
  if (!testo || typeof testo !== 'string') return { testoSanificato: '', schermaturaApplicata: false };
  let sanificato = testo;
  sanificato = sanificato.replace(EMAIL_REGEX, () => '[EMAIL SCHERMATA A TUTELA PRIVACY]');
  sanificato = sanificato.replace(PHONE_REGEX, () => '[NUMERO SCHERMATO A TUTELA PRIVACY]');
  return { testoSanificato: sanificato, schermaturaApplicata: sanificato !== testo };
};
```

Il rate limiting applica un algoritmo a finestra temporale scorrevole (Sliding Window):

```javascript
const checkRateLimit = (utenteId, maxRichieste = 5, finestraMinuti = 15) => {
  const now = Date.now();
  const windowMs = finestraMinuti * 60 * 1000;
  const timestamps = (rateLimitMap.get(utenteId) || []).filter(ts => now - ts < windowMs);
  if (timestamps.length >= maxRichieste) {
    const oldest = timestamps[0];
    const waitSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, waitSeconds };
  }
  timestamps.push(now);
  rateLimitMap.set(utenteId, timestamps);
  return { allowed: true, remainingRequests: maxRichieste - timestamps.length };
};
```

---

## 4. Elenco Filesystem dei File Creati e Modificati

```text
INFO-DATABASE/
└── schema.sql                              # [MODIFY] Aggiunta DDL tabella notifiche e relativi indici b-tree

server/
├── src/
│   ├── services/
│   │   ├── privacyShieldService.js         # [NEW] Logica antispam, rate-limiting e regex sanitization email/telefoni
│   │   ├── notificheService.js             # [NEW] Gestione notifiche interne, marcatura lette e conteggio badge
│   │   └── richiesteService.js             # [NEW] Gestione richieste scambio, dialoghi, chat e macchina a stati
│   ├── controllers/
│   │   ├── richiesteController.js          # [NEW] Controller REST per richieste contatto e messaggistica chat
│   │   └── notificheController.js          # [NEW] Controller REST per notifiche interne e contatori
│   └── routes/
│       ├── index.js                        # [MODIFY] Registrazione endpoint /api/richieste, /api/contatti, /api/notifiche
│       ├── richiesteRoutes.js              # [NEW] Rotte per richieste contatto e messaggi (/richieste, /contatti)
│       └── notificheRoutes.js              # [NEW] Rotte per le notifiche (/notifiche)
├── test_fase22.js                          # [NEW] Suite di collaudo automatizzato end-to-end (19 asserzioni)
└── seed_demo_chats.js                      # [NEW] Script di popolamento thread di test per l'utente demo

hermae-frontend/
├── assets/js/components/
│   └── global-components.js                # [MODIFY] NavbarLogged aggiornata con badge notifiche e link chat
├── ricerca.html                            # [MODIFY] Modale richiesta contatto, bottoni su mappa, card, tabella e profilo
└── chat.html                               # [NEW] Pagina 7: Centro Messaggi & Scambi con split layout responsive
```

---

## 5. Risultati del Collaudo e Metriche di Validazione

La suite di test automatizzati [`server/test_fase22.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase22.js) è stata eseguita con esito **100% positivo** su 5 blocchi di verifica:

- **Parte 1 — Hermae Privacy Shield (Mascheramento Contatti Diretti):**
  - Schermatura di indirizzi email standard, complessi e multipli ($2/2$ superati);
  - Schermatura di recapiti telefonici cellulari e fissi ($2/2$ superati);
- **Parte 2 — Politiche Antispam & Validazione Richieste:**
  - Blocco auto-richiesta su libri di propria titolarità con codice 400 ($1/1$ superato);
  - Inibizione richieste verso utenti con privacy messaggi diretti disabilitata ($1/1$ superato);
  - Prevenzione richieste duplicate attive verso il medesimo libro ($1/1$ superato);
  - Rate limiting su superamento della soglia consentita con codice 429 ($1/1$ superato);
- **Parte 3 — Notifiche Interne di Piattaforma:**
  - Creazione notifica per il proprietario alla ricezione della richiesta ($1/1$ superato);
  - Calcolo del badge conteggio rapido notifiche non lette ($1/1$ superato);
  - Aggiornamento stato notifica letta e azzeramento cumulativo ($1/1$ superato);
- **Parte 4 — Thread di Conversazione & Chat Peer-to-Peer:**
  - Elenco thread aggregato con metadati del libro, controparte e anteprima ($1/1$ superato);
  - Schermatura del thread contro accessi di terzi non autorizzati con codice 403 ($1/1$ superato);
  - Invio messaggi nel thread e notifica asincrona automatica al destinatario ($1/1$ superato);
  - Apertura conversazione e marcatura automatica dei messaggi come letti ($1/1$ superato);
- **Parte 5 — Macchina a Stati Finita (`IN_ATTESA` &rarr; `ACCETTATA` &rarr; `COMPLETATA`):**
  - Divieto di accettazione da parte del richiedente con codice 403 ($1/1$ superato);
  - Transizione ad `ACCETTATA` da parte del proprietario con notifica di conferma ($1/1$ superato);
  - Transizione ad avvenuto scambio `COMPLETATA` registrata con successo ($1/1$ superato);
  - Inibizione invio nuovi messaggi su richieste completate con codice 400 ($1/1$ superato).

**Totale Asserzioni Superate:** $19/19$ ($100\%$ pass rate).  
**Regressione Fasi Precedenti:**  
- Fase 21 (Ricerca Geospaziale): $19/19$ superati;  
- Fase 20 (Occultamento e Privacy): $28/28$ superati;  
- Fase 19 (CRUD Libri & Upload Copertina): $40/40$ superati.  
**Totale Asserzioni di Regressione:** $106/106$ ($100\%$ success rate).
