# Fase 21 — Implementazione delle funzioni di ricerca di libri

> **Corso di Studio:** Laurea Triennale in Informatica per le Aziende Digitali (L-31)  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14:** Sviluppo di un software di geolocalizzazione culturale per condividere il patrimonio librario degli utenti privati  
> **Progetto:** Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)  
> **Cartella di Riferimento:** `SVILUPPO-PROGRAMMA/`  
> **File:** `fase-21.md`  

---

## 1. Descrizione Sintetica delle Operazioni Eseguite

È stato realizzato il motore di ricerca integrato, capace di filtrare le opere per parole chiave (titolo, autore, genere), combinando i criteri di pertinenza testuale con filtri opzionali sulla prossimità geografica. È stata aggiunta inoltre la possibilità di aprire il profilo di un utente dall’interno della mappa e di visualizzare i libri cercati direttamente sulla mappa cartografica.

Nel dettaglio, le attività realizzate hanno compreso:
1. **Estensione del Motore di Ricerca Backend Geospaziale (`esemplariService.js` & `esemplariController.js`):**
   - Rielaborazione della funzione di servizio `searchEsemplari(filters)` per supportare in modo congiunto filtri testuali multicampo (`search`, `categoria_id`, `sottogenere`, `stato_disponibilita`) e vincoli geospaziali di prossimità (`lat`, `lng`, `raggio_km`, `ordina_per`);
   - Calcolo istantaneo delle distanze geodetiche metriche tramite le funzioni native PostgreSQL / PostGIS `earth_distance` e `ll_to_earth` con bounding box ottimizzato `earth_box`;
   - Formattazione arricchita dei record con `distanza_metri`, `distanza_km` e calcolo semantico della `fascia_prossimita` (*Stesso Quartiere, Stessa Città, Area/CAP, Area Metropolitana, Area Provinciale*);
   - Salvaguardia assoluta della privacy: i pin territoriali e le distanze impiegano rigorosamente le coordinate offuscate dell'utente (`p.coordinate_offuscate`), escludendo totalmente dalla ricerca sia i singoli libri contrassegnati come privati (`visibile_pubblico = false`), sia tutti i libri degli utenti che hanno occultato l'intero scaffale (`mostra_libreria = false`);
   - Supporto all'ordinamento parametrico flessibile: prossimità geodetica (`distanza`), novità (`data`), alfabetico (`titolo`, `autore`).
2. **Endpoint e Logica di Servizio per il Profilo Pubblico Utente (`userService.js`, `userController.js`, `userRoutes.js`):**
   - Implementazione del metodo `getPublicUserProfile(id)` e della relativa rotta `GET /api/utenti/:id/profilo` (e per retrocompatibilità `/api/users/:id/profilo`);
   - Estrazione sicura dei dati anagrafici pubblici (nome, iniziale cognome per tutela identità, comune, quartiere approssimato, data registrazione);
   - Gestione trasparente del rispetto della riservatezza: se l'utente ha la libreria aperta (`mostra_libreria = true`), l'endpoint include l'elenco e il conteggio dei soli libri pubblici e disponibili allo scambio con copertine e categorie; se l'utente ha occultato la libreria (`mostra_libreria = false`), restituisce scaffale vuoto e flag `privacy_libreria_attiva = true`;
   - Omissione totale dei dati sensibili (nessuna esposizione di email, password hash, coordinate reali di residenza, flag interni di consenso).
3. **Evoluzione dell'Interfaccia Utente Reattiva (`hermae-frontend/ricerca.html`):**
   - **Nuova Barra di Ricerca Unificata:** input con *debounce* fluido a 350ms, selettore a tendina per le 10 Macro-Categorie con conteggio volumi, selettore reattivo dei Sottogeneri tematici Thema/BISAC, selettore ordinamento e chips dei filtri attivi con azzeramento rapido;
   - **Switch Prossimità e Slider Chilometrico:** possibilità di alternare con un click la ricerca locale (entro un raggio circolare da 1 a 50 km dal centro impostato dall'utente o rilevato via GPS) alla ricerca globale su scala nazionale;
   - **Visualizzazione Dinamica con Marker Clustering & Pin con Conteggio Libri:** Quando la mappa è zoomata all'indietro o vi sono più libri nella stessa zona (o appartenenti al medesimo lettore), la mappa raggruppa dinamicamente i punti in un unico **pin circolare ad alto contrasto con il numero di libri all'interno** (evitando la sovrapposizione caotica di icone). Al click o ingrandendo lo zoom, il cluster si espande o spiderfizza a raggiera con le linee di collegamento, mostrando i singoli volumi con icona e colore della specifica macro-categoria disciplinare;
   - **Popup Informativo Avanzato:** al click sul marker o a seguito di de-clustering, la mappa visualizza la miniatura della copertina WebP, il titolo, l'autore, la categoria, la distanza in km, il proprietario e il **pulsante prioritario "Visualizza Profilo Lettore"**;
   - **Griglia Risultati Libri Trovati:** schede descrittive sotto la mappa con copertine WebP, dettagli di prossimità e pulsanti rapidi *"Mostra su Mappa"* (con animazione `flyTo` e apertura automatica del popup) e *"Profilo Lettore"*;
   - **Modale Bootstrap Interattiva del Profilo Pubblico (`#modalProfiloLettore`):** consultabile direttamente dall'interno della mappa o dalla griglia, visualizza l'avatar del lettore, le sue informazioni pubbliche e l'intero catalogo dei suoi volumi disponibili, ovvero l'avviso di tutela della privacy in caso di scaffale occultato;
   - **Vista Elenco Tabellare Accessibile (WCAG 2.1 AA):** tabella completa navigabile da tastiera con screen reader e ordinamento per prossimità.
4. **Collaudo Automatizzato End-to-End (`server/test_fase21.js`):**
   - Sviluppo ed esecuzione di una suite automatizzata articolata su 7 blocchi di verifica e 19 asserzioni formali, superata al 100%;
   - Verifica di regressione superata per le Fasi 19 e 20 e per il dataset mock multi-utente.

---

## 2. Architettura Tecnica e Query Geospaziale PostGIS

Per combinare la ricerca full-text con la prossimità metrica in un'unica query SQL performante:

```sql
SELECT 
  e.id, e.titolo, e.autore, e.sottogenere, e.immagine_copertina, e.immagine_miniatura,
  c.nome as categoria_nome, c.colore_hex as categoria_colore, c.icona as categoria_icona,
  u.nome as proprietario_nome, u.cognome as proprietario_cognome,
  p.citta as proprietario_citta, p.indirizzo_approssimato as proprietario_indirizzo_approssimato,
  p.coordinate_offuscate as proprietario_coord_offuscate,
  round((earth_distance(
    ll_to_earth($1, $2), 
    ll_to_earth((p.coordinate_offuscate)[1], (p.coordinate_offuscate)[0])
  ))::numeric, 1) as distanza_metri
FROM esemplari e
JOIN categorie c ON e.categoria_id = c.id
JOIN utenti u ON e.utente_id = u.id
LEFT JOIN preferenze_privacy_utenti priv ON u.id = priv.utente_id
LEFT JOIN posizione_utenti p ON u.id = p.utente_id
WHERE (priv.mostra_libreria IS NULL OR priv.mostra_libreria = TRUE)
  AND e.visibile_pubblico = TRUE
  AND e.stato_disponibilita = 'DISPONIBILE'
  -- Filtro Spaziale di Prossimità entro Raggio Metrico (PostGIS earthdistance)
  AND p.coordinate_offuscate IS NOT NULL
  AND earth_box(ll_to_earth($1, $2), $3) @> ll_to_earth((p.coordinate_offuscate)[1], (p.coordinate_offuscate)[0])
  AND earth_distance(ll_to_earth($1, $2), ll_to_earth((p.coordinate_offuscate)[1], (p.coordinate_offuscate)[0])) <= $3
  -- Filtro Testuale Combinato
  AND (
    LOWER(e.titolo) LIKE LOWER($4) OR 
    LOWER(e.autore) LIKE LOWER($4) OR 
    LOWER(COALESCE(e.sottogenere, '')) LIKE LOWER($4) OR 
    LOWER(COALESCE(e.isbn, '')) LIKE LOWER($4)
  )
ORDER BY distanza_metri ASC NULLS LAST, e.data_creazione DESC
LIMIT 50;
```

---

## 3. Elenco Filesystem dei File Creati e Modificati

```text
server/
├── src/
│   ├── services/
│   │   ├── esemplariService.js             # [MODIFY] Estesa searchEsemplari con PostGIS earthdistance e distanze
│   │   └── userService.js                  # [MODIFY] Aggiunto metodo getPublicUserProfile
│   ├── controllers/
│   │   ├── esemplariController.js          # [MODIFY] Gestiti parametri lat, lng, raggio_km, ordina_per
│   │   └── userController.js               # [MODIFY] Aggiunto metodo getPublicProfile
│   └── routes/
│       ├── index.js                        # [MODIFY] Montato alias /utenti accanto a /users
│       └── userRoutes.js                   # [MODIFY] Registrata rotta GET /:id/profilo
└── test_fase21.js                          # [NEW] Suite di collaudo automatizzato per la ricerca (19 asserzioni)

hermae-frontend/
└── ricerca.html                            # [MODIFY] Motore di ricerca integrato, pin libri su mappa, popup e modale profilo
```

---

## 4. Risultati del Collaudo e Metriche di Validazione

La suite automatizzata [`server/test_fase21.js`](file:///Users/nunziogiglio/Documents/Github/Repositories/Hermae_Nunzio_Giglio_0312200894/server/test_fase21.js) è stata eseguita con esito pienamente positivo:

- **Parte 1 — Ricerca Testuale Full-Text:** individua correttamente corrispondenze su titolo, autore, codice ISBN e termini misti con gestione del case e degli spazi ($4/4$ superati);
- **Parte 2 — Filtri Categoria e Sottogenere:** individua con precisione i volumi tematici ($2/2$ superati);
- **Parte 3 — Ricerca Geospaziale di Prossimità:** verifica del calcolo metrico delle distanze e ordinamento per vicinanza con raggio a 5 km da Napoli ed estensione a 250 km ($4/4$ superati);
- **Parte 4 — Combinazione Pertinenza & Prossimità:** conferma che i volumi fuori raggio non compaiono anche in presenza di corrispondenza testuale ($3/3$ superati);
- **Parte 5 — Schermatura Privacy:** nessun libro privato o appartenente a librerie occultate viene divulgato ($2/2$ superati);
- **Parte 6 — Endpoint Profilo Pubblico Utente:** verifica del profilo di utenti con libreria aperta vs occultata e protezione dei dati personali ($3/3$ superati);
- **Parte 7 — Coordinate Sicure Marker Mappa:** riscontro della conformità delle coordinate offuscate esposte al client ($1/1$ superato).

**Totale Asserzioni Superate:** $19/19$ ($100\%$ pass rate).  
**Regressione Fasi 19 e 20:** $68/68$ asserzioni confermate con successo.
