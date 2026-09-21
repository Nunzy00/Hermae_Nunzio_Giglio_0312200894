# Diagramma di Flusso della Privacy & Obfuscation (Spatial Blurring & Privacy Shield)

> **Progetto:** Hermae — *"Il sapere, un libro alla volta"*  
> **Candidato:** Nunzio Giglio (Matricola: 0312200894)  
> **Corso di Laurea:** Informatica per le Aziende Digitali (L-31) — Università Telematica Pegaso  
> **Tema n. 4:** Sharing technologies | **Traccia PW n. 14**  
> **Collocazione:** Cartella `MULTIMEDIA/` — Documentazione Tecnica e Tesi  

---

## 1. Descrizione del Modello di Tutela della Privacy

La piattaforma **Hermae** implementa una strategia multilivello di **Privacy by Design e Privacy by Default** (conforme all'art. 25 del GDPR, Regolamento UE 2016/679). La tutela dei soggetti privati che aprono la propria libreria domestica al prestito si articola su due sottosistemi cardine:

1. **Algoritmo di Spatial Blurring (Offuscamento Geospaziale):** Trasformazione trigonometrica sferica applicata alle coordinate GPS WGS 84 prima della serializzazione verso il client pubblico, precludendo l'identificazione del domicilio privato o del numero civico.
2. **Hermae Privacy Shield (Filtro Euristico Chat Anti-Doxxing):** Motore di sanitizzazione dei messaggi scambiati via chat che intercetta e maschera recapiti telefonici ed email, prevenendo adescamento, molestie e disintermediazione non protetta.

---

## 2. Diagramma di Flusso dell'Offuscamento Geospaziale (Mermaid)

```mermaid
flowchart TD
    START(["Acquisizione Coordinate Reali<br>(GPS Browser o Geocoding Nominatim)"]) --> CHK_CONS{"Consenso Geo<br>Rilasciato?<br>(GDPR Art. 6/7)"}
    
    CHK_CONS -- No --> DEFAULT_FALLBACK["Assegnazione Centroide Città<br>(Coordinate Generiche del Comune)"] --> SAVE_DB
    
    CHK_CONS -- Sì --> MODE_SELECTOR{"Modalità Privacy<br>Selezionata<br>(PREFERENZE_PRIVACY)"}

    MODE_SELECTOR -- "1. QUARTIERE (Default)" --> CALC_BLUR["Calcolo Offset Sferico Casuale<br>Distanza r: 300 - 500 m<br>Angolo theta: 0 - 2pi"]
    CALC_BLUR --> APPLY_TRIG["Calcolo Trigonometrico WGS 84:<br>delta_lat = (r * cos theta) / R_Terra<br>delta_lon = (r * sin theta) / (R_Terra * cos lat)"]
    APPLY_TRIG --> BLURRED_POINT["Generazione 'coordinate_offuscate'<br>(Punto fittizio nel raggio di quartiere)"]
    
    MODE_SELECTOR -- "2. AREA_CAP" --> CALC_CAP["Aggregazione a Poligono Postale<br>(Baricentro del CAP / Circoscrizione)"]
    CALC_CAP --> BLURRED_POINT

    MODE_SELECTOR -- "3. TOTALE" --> CALC_NULL["Soppressione Totale Marker<br>(Visibilità solo aggregata comunale)"]
    CALC_NULL --> BLURRED_POINT

    BLURRED_POINT --> SAVE_DB[("Persistenza PostgreSQL:<br>coordinate_reali (RISERVATA)<br>coordinate_offuscate (PUBBLICA)")]
    
    SAVE_DB --> API_OUTPUT["Esposizione API Pubblica (/api/libri/mappa):<br>Inclusione esclusiva di coordinate_offuscate<br>+ Raggio cerchio Leaflet.js (300-500m)"]
    
    DEFAULT_FALLBACK --> SAVE_DB
    API_OUTPUT --> END_CLIENT(["Rendering Mappa Client Leaflet.js<br>(Marker approssimato senza civico)"])
```

---

## 3. Diagramma della Pipeline di Sanitizzazione Chat (Mermaid)

```mermaid
flowchart TD
    MSG_IN(["Messaggio Testuale Inviato da Utente<br>(POST /api/chat/:richiesta_id)"]) --> AUTH_CHECK{"Utente Partecipante<br>alla Richiesta?<br>(JWT Match)"}
    
    AUTH_CHECK -- No (403 Forbidden) --> ERR_AUTH["Rigetto Chiamata API<br>(Unauthorized Access)"]
    
    AUTH_CHECK -- Sì --> SHIELD_INIT["Avvio Hermae Privacy Shield<br>(Middleware di Ispezione Euristica)"]
    
    SHIELD_INIT --> REGEX_PHONE{"Rilevamento Numero Telefonico?<br>Regex: (+39)?[0-9 . -]{8,14}"}
    
    REGEX_PHONE -- Rilevato --> MASK_PHONE["Sostituzione con Badge:<br>'[NUMERO_TELEFONICO_OFFUSCATO]'"]
    REGEX_PHONE -- Non rilevato --> REGEX_EMAIL{"Rilevamento Indirizzo Email?<br>Regex: RFC 5322 Standard"}
    
    MASK_PHONE --> REGEX_EMAIL
    
    REGEX_EMAIL -- Rilevato --> MASK_EMAIL["Sostituzione con Badge:<br>'[EMAIL_OFFUSCATA_PER_SICUREZZA]'"]
    REGEX_EMAIL -- Non rilevato --> SANITIZE_HTML["Sanitizzazione XSS<br>(Escape tag HTML e caratteri pericolosi)"]
    
    MASK_EMAIL --> SANITIZE_HTML
    
    SANITIZE_HTML --> CHK_MODIFIED{"Testo Modificato dal Filtro?"}
    
    CHK_MODIFIED -- Sì --> FLAG_NOTICE["Aggiunta Avviso di Sicurezza nel Payload:<br>'Per la tua tutela, i dati di contatto diretti<br>sono filtrati fino alla conferma del prestito.'"]
    CHK_MODIFIED -- No --> PERSIST_CHAT
    
    FLAG_NOTICE --> PERSIST_CHAT[("Salvataggio su DB PostgreSQL<br>Tabella 'messaggi_chat'")]
    
    PERSIST_CHAT --> DISPATCH_SOCKET["Invio Notifica e Risposta 201 Created<br>(Testo confidenziale protetto a destinazione)"]
    DISPATCH_SOCKET --> MSG_OUT(["Visualizzazione nel Thread Chat Client"])
```

---

## 4. Specifiche Matematiche e Regolamentari

### Formulazione dell'Offset di Quartiere (Jittering Sferico)
Dato un punto geografico reale $P = (\phi, \lambda)$ con latitudine $\phi$ e longitudine $\lambda$ espresse in radianti, e dato il raggio terrestre medio $R \approx 6.371.000 \text{ m}$:
1. Si campiona un raggio casuale $d \sim \mathcal{U}(300, 500) \text{ metri}$;
2. Si campiona un angolo azimutale $\theta \sim \mathcal{U}(0, 2\pi)$;
3. Le coordinate offuscate $P' = (\phi', \lambda')$ sono calcolate tramite proiezione euclidea locale (valida per $d \ll R$):
$$\phi' = \phi + \frac{d \cdot \cos(\theta)}{R}$$
$$\lambda' = \lambda + \frac{d \cdot \sin(\theta)}{R \cdot \cos(\phi)}$$

### Conformità Normativa GDPR
- **Art. 5(1)(c) — Minimizzazione dei dati:** I dettagli del domicilio reale non lasciano mai l'infrastruttura backend e non sono accessibili ad altri utenti non autenticati né mediante scraping.
- **Art. 25 — Privacy by Design & Default:** L'impostazione predefinita alla registrazione applica l'offuscamento di quartiere; la condivisione della posizione esatta è disabilitata a livello di schema.
- **Art. 32 — Sicurezza del Trattamento:** Mascheramento proattivo delle informazioni di contatto nelle chat private tra estranei prima dello scambio fisico.
