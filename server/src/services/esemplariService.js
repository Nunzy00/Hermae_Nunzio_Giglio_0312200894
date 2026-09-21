// Service per la gestione del ciclo di vita dell'entità Esemplare (copia fisica del libro)
const db = require('../config/db');
const imageService = require('./imageService');

// Verifica sintattica formato UUIDv4
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof str === 'string' && uuidRegex.test(str);
};

// Proiezione standard delle colonne per garantire il principio DRY ed evitare duplicazioni query
const BASE_ESEMPLARI_SELECT = `
  e.id,
  e.utente_id,
  e.categoria_id,
  e.sottogenere,
  e.titolo,
  e.autore,
  e.editore,
  e.anno_pubblicazione,
  e.isbn,
  e.lingua,
  e.descrizione,
  e.note,
  e.stato_conservazione,
  e.stato_disponibilita,
  e.immagine_copertina,
  e.immagine_miniatura,
  e.coordinate_esemplare,
  e.visibile_pubblico,
  e.data_creazione,
  COALESCE(e.titolarita, 'PROPRIETA') as titolarita,
  c.nome as categoria_nome,
  c.slug as categoria_slug,
  c.icona as categoria_icona,
  c.colore_hex as categoria_colore,
  c.sottogeneri_predefiniti as categoria_sottogeneri
`;

// Formatta e tipizza un record restituito dal database relazionale
const formatEsemplareRow = (row) => {
  if (!row) return null;

  // Determinazione coordinate per mappa: predilige la coordinata offuscata del proprietario per tutela privacy
  let coord = null;
  if (row.proprietario_coord_offuscate && typeof row.proprietario_coord_offuscate.x !== 'undefined') {
    coord = {
      lng: row.proprietario_coord_offuscate.x,
      lat: row.proprietario_coord_offuscate.y
    };
  } else if (row.coordinate_esemplare && typeof row.coordinate_esemplare.x !== 'undefined') {
    coord = {
      lng: row.coordinate_esemplare.x,
      lat: row.coordinate_esemplare.y
    };
  }

  // Calcolo distanza metrica e fascia di prossimità territoriale
  let distMetri = null;
  let distKm = null;
  let fascia = null;
  if (row.distanza_metri !== null && typeof row.distanza_metri !== 'undefined') {
    distMetri = parseFloat(row.distanza_metri);
    distKm = parseFloat((distMetri / 1000).toFixed(2));
    if (row.proprietario_modalita_occultamento === 'AREA_CAP') {
      fascia = 'Area/CAP (~2 km)';
    } else if (distKm > 25) {
      fascia = 'Area Provinciale';
    } else if (distKm > 10) {
      fascia = 'Area Metropolitana';
    } else if (distKm > 2) {
      fascia = 'Stessa Città';
    } else {
      fascia = 'Stesso Quartiere';
    }
  }

  return {
    id: row.id,
    utente_id: row.utente_id,
    categoria_id: row.categoria_id,
    categoria_nome: row.categoria_nome || null,
    categoria_slug: row.categoria_slug || null,
    categoria_icona: row.categoria_icona || null,
    categoria_colore: row.categoria_colore || null,
    categoria_sottogeneri: row.categoria_sottogeneri || [],
    sottogenere: row.sottogenere || null,
    titolo: row.titolo,
    autore: row.autore,
    editore: row.editore || null,
    anno_pubblicazione: row.anno_pubblicazione ? parseInt(row.anno_pubblicazione, 10) : null,
    isbn: row.isbn || null,
    lingua: row.lingua || 'Italiano',
    descrizione: row.descrizione || null,
    note: row.note || null,
    stato_conservazione: row.stato_conservazione || 'Buono',
    stato_disponibilita: row.stato_disponibilita || 'DISPONIBILE',
    immagine_copertina: row.immagine_copertina || null,
    immagine_miniatura: row.immagine_miniatura || null,
    visibile_pubblico: row.visibile_pubblico !== false,
    titolarita: row.titolarita || 'PROPRIETA',
    in_prestito_temporaneo: (row.titolarita === 'IN_PRESTITO'),
    coordinate: coord,
    distanza_metri: distMetri,
    distanza_km: distKm,
    fascia_prossimita: fascia,
    data_creazione: row.data_creazione,
    proprietario: row.proprietario_nome ? {
      id: row.utente_id,
      nome: row.proprietario_nome,
      cognome: row.proprietario_cognome,
      cognome_iniziale: row.proprietario_cognome ? row.proprietario_cognome.charAt(0) + '.' : '',
      citta: row.proprietario_citta || null,
      indirizzo_approssimato: row.proprietario_indirizzo_approssimato || null
    } : undefined
  };
};

// Valida i valori consentiti per gli enum di stato
const STATI_CONSERVAZIONE_VALIDI = ['Come nuovo', 'Ottimo', 'Buono', 'Usurato'];
const STATI_DISPONIBILITA_VALIDI = ['DISPONIBILE', 'IN_PRESTITO', 'NON_DISPONIBILE'];

/**
 * Crea un nuovo esemplare associato all'utente autenticato
 */
const createEsemplare = async (utenteId, data) => {
  const {
    categoria_id,
    sottogenere,
    titolo,
    autore,
    editore,
    anno_pubblicazione,
    isbn,
    lingua,
    descrizione,
    note,
    stato_conservazione,
    stato_disponibilita,
    immagine_copertina,
    immagine_miniatura,
    titolarita
  } = data;

  // Validazione campi obbligatori minimi
  if (!titolo || typeof titolo !== 'string' || !titolo.trim()) {
    const error = new Error('Il titolo dell\'opera è obbligatorio.');
    error.statusCode = 400;
    error.code = 'TITOLO_REQUIRED';
    throw error;
  }
  if (titolo.trim().length > 255) {
    const error = new Error('Il titolo dell\'opera non può superare i 255 caratteri.');
    error.statusCode = 400;
    error.code = 'TITOLO_TOO_LONG';
    throw error;
  }

  if (!autore || typeof autore !== 'string' || !autore.trim()) {
    const error = new Error('L\'autore dell\'opera è obbligatorio.');
    error.statusCode = 400;
    error.code = 'AUTORE_REQUIRED';
    throw error;
  }
  if (autore.trim().length > 255) {
    const error = new Error('L\'autore dell\'opera non può superare i 255 caratteri.');
    error.statusCode = 400;
    error.code = 'AUTORE_TOO_LONG';
    throw error;
  }

  if (!categoria_id) {
    const error = new Error('La categoria tematica/disciplinare è obbligatoria.');
    error.statusCode = 400;
    error.code = 'CATEGORIA_REQUIRED';
    throw error;
  }

  if (!isValidUUID(categoria_id)) {
    const error = new Error('La categoria specificata non è un identificativo valido.');
    error.statusCode = 400;
    error.code = 'CATEGORIA_INVALID';
    throw error;
  }

  // Verifica esistenza della categoria selezionata
  const catCheck = await db.query('SELECT id FROM categorie WHERE id = $1', [categoria_id]);
  if (catCheck.rows.length === 0) {
    const error = new Error('La categoria specificata non esiste nel catalogo.');
    error.statusCode = 400;
    error.code = 'CATEGORIA_INVALID';
    throw error;
  }

  // Validazione anno di pubblicazione (se specificato)
  let finalAnno = null;
  if (typeof anno_pubblicazione !== 'undefined' && anno_pubblicazione !== null && anno_pubblicazione !== '') {
    const yearNum = Number(anno_pubblicazione);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(yearNum) || yearNum < 1450 || yearNum > currentYear + 1) {
      const error = new Error(`L'anno di pubblicazione deve essere un numero intero compreso tra il 1450 e il ${currentYear + 1}.`);
      error.statusCode = 400;
      error.code = 'ANNO_INVALID';
      throw error;
    }
    finalAnno = yearNum;
  }

  // Validazione codice ISBN (se specificato, 10 o 13 cifre)
  let finalIsbn = null;
  if (isbn && typeof isbn === 'string' && isbn.trim()) {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    const isbn10Regex = /^[0-9]{9}[0-9X]$/i;
    const isbn13Regex = /^(978|979)[0-9]{10}$/;
    if (!isbn10Regex.test(cleanIsbn) && !isbn13Regex.test(cleanIsbn)) {
      const error = new Error('Il codice ISBN specificato non è valido. Inserire un codice ISBN-10 o ISBN-13 valido.');
      error.statusCode = 400;
      error.code = 'ISBN_INVALID';
      throw error;
    }
    finalIsbn = isbn.trim();
  }

  // Validazione stato di conservazione
  if (stato_conservazione && !STATI_CONSERVAZIONE_VALIDI.includes(stato_conservazione)) {
    const error = new Error(`Lo stato di conservazione '${stato_conservazione}' non è valido. Valori ammessi: ${STATI_CONSERVAZIONE_VALIDI.join(', ')}.`);
    error.statusCode = 400;
    error.code = 'STATO_CONSERVAZIONE_INVALID';
    throw error;
  }
  const finalStatoCons = stato_conservazione || 'Buono';
  const finalVisibilePubblico = typeof data.visibile_pubblico === 'boolean' ? data.visibile_pubblico : true;

  // Validazione stato di disponibilità
  if (stato_disponibilita && !STATI_DISPONIBILITA_VALIDI.includes(stato_disponibilita)) {
    const error = new Error(`Lo stato di disponibilità '${stato_disponibilita}' non è valido. Valori ammessi: ${STATI_DISPONIBILITA_VALIDI.join(', ')}.`);
    error.statusCode = 400;
    error.code = 'STATO_DISPONIBILITA_INVALID';
    throw error;
  }
  const finalStatoDisp = stato_disponibilita || 'DISPONIBILE';

  // Determinazione automatica delle coordinate geografiche dell'esemplare:
  // Se fornite esplicitamente usa quelle, altrimenti eredita la posizione attuale dell'utente
  let coordinatePoint = null;
  if (data.coordinate && typeof data.coordinate.lat === 'number' && typeof data.coordinate.lng === 'number') {
    coordinatePoint = `(${data.coordinate.lng},${data.coordinate.lat})`;
  } else {
    const posRes = await db.query(
      'SELECT coordinate_reali[0] as lng, coordinate_reali[1] as lat FROM posizione_utenti WHERE utente_id = $1 LIMIT 1',
      [utenteId]
    );
    if (posRes.rows.length > 0 && posRes.rows[0].lng !== null && posRes.rows[0].lat !== null) {
      coordinatePoint = `(${posRes.rows[0].lng},${posRes.rows[0].lat})`;
    }
  }

  const insertQuery = `
    INSERT INTO esemplari (
      utente_id,
      categoria_id,
      sottogenere,
      titolo,
      autore,
      editore,
      anno_pubblicazione,
      isbn,
      lingua,
      descrizione,
      note,
      stato_conservazione,
      stato_disponibilita,
      immagine_copertina,
      immagine_miniatura,
      coordinate_esemplare,
      visibile_pubblico,
      titolarita
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    )
    RETURNING *;
  `;

  const finalTitolarita = (titolarita === 'IN_PRESTITO') ? 'IN_PRESTITO' : 'PROPRIETA';

  const values = [
    utenteId,
    categoria_id,
    sottogenere ? sottogenere.trim() : null,
    titolo.trim(),
    autore.trim(),
    editore ? editore.trim() : null,
    anno_pubblicazione ? parseInt(anno_pubblicazione, 10) : null,
    isbn ? isbn.trim() : null,
    lingua ? lingua.trim() : 'Italiano',
    descrizione ? descrizione.trim() : null,
    note ? note.trim() : null,
    finalStatoCons,
    finalStatoDisp,
    immagine_copertina || null,
    immagine_miniatura || null,
    coordinatePoint,
    finalVisibilePubblico,
    finalTitolarita
  ];

  const result = await db.query(insertQuery, values);
  return getEsemplareById(result.rows[0].id, utenteId);
};

/**
 * Recupera tutti gli esemplari appartenenti all'utente specificato con filtri opzionali
 * (Vista personale: include sia i volumi pubblici che quelli privati)
 */
const getMyEsemplari = async (utenteId, filters = {}) => {
  let query = `
    SELECT 
      ${BASE_ESEMPLARI_SELECT}
    FROM (
      SELECT 
        e.id,
        e.utente_id,
        e.categoria_id,
        e.sottogenere,
        e.titolo,
        e.autore,
        e.editore,
        e.anno_pubblicazione,
        e.isbn,
        e.lingua,
        e.descrizione,
        e.note,
        e.stato_conservazione,
        e.stato_disponibilita,
        e.immagine_copertina,
        e.immagine_miniatura,
        e.coordinate_esemplare,
        e.visibile_pubblico,
        e.data_creazione,
        COALESCE(e.titolarita, 'PROPRIETA') as titolarita
      FROM esemplari e
      WHERE e.utente_id = $1

      UNION ALL

      SELECT 
        e.id,
        e.utente_id,
        e.categoria_id,
        e.sottogenere,
        e.titolo,
        e.autore,
        e.editore,
        e.anno_pubblicazione,
        e.isbn,
        e.lingua,
        e.descrizione,
        e.note,
        e.stato_conservazione,
        'IN_PRESTITO'::character varying as stato_disponibilita,
        e.immagine_copertina,
        e.immagine_miniatura,
        e.coordinate_esemplare,
        FALSE as visibile_pubblico,
        COALESCE(r.data_inizio, r.data_richiesta) as data_creazione,
        'IN_PRESTITO'::character varying as titolarita
      FROM richieste_prestito r
      JOIN esemplari e ON r.esemplare_id = e.id
      WHERE r.richiedente_id = $1 
        AND r.stato IN ('IN_PRESTITO', 'ACCETTATA')
        AND e.utente_id != $1
    ) e
    JOIN categorie c ON e.categoria_id = c.id
    WHERE 1=1
  `;
  const params = [utenteId];
  let paramIdx = 2;

  // Filtro visibilità opzionale per la consultazione personale
  if (filters.visibilita) {
    if (filters.visibilita.toUpperCase() === 'PUBBLICO') {
      query += ` AND e.visibile_pubblico = TRUE`;
    } else if (filters.visibilita.toUpperCase() === 'PRIVATO') {
      query += ` AND e.visibile_pubblico = FALSE`;
    }
  }

  // Filtro titolarità (PROPRIETA vs IN_PRESTITO)
  if (filters.titolarita) {
    query += ` AND e.titolarita = $${paramIdx}`;
    params.push(filters.titolarita);
    paramIdx++;
  }

  if (filters.categoria_id) {
    query += ` AND e.categoria_id = $${paramIdx}`;
    params.push(filters.categoria_id);
    paramIdx++;
  }

  if (filters.sottogenere && filters.sottogenere.trim()) {
    query += ` AND LOWER(e.sottogenere) = LOWER($${paramIdx})`;
    params.push(filters.sottogenere.trim());
    paramIdx++;
  }

  if (filters.stato_disponibilita) {
    query += ` AND e.stato_disponibilita = $${paramIdx}`;
    params.push(filters.stato_disponibilita);
    paramIdx++;
  }

  if (filters.search && filters.search.trim()) {
    query += ` AND (
      LOWER(e.titolo) LIKE LOWER($${paramIdx}) OR 
      LOWER(e.autore) LIKE LOWER($${paramIdx}) OR 
      LOWER(COALESCE(e.sottogenere, '')) LIKE LOWER($${paramIdx}) OR
      LOWER(COALESCE(e.isbn, '')) LIKE LOWER($${paramIdx}) OR
      LOWER(COALESCE(e.editore, '')) LIKE LOWER($${paramIdx})
    )`;
    params.push(`%${filters.search.trim()}%`);
    paramIdx++;
  }

  query += ` ORDER BY e.data_creazione DESC;`;

  const result = await db.query(query, params);
  return result.rows.map(formatEsemplareRow);
};

/**
 * Recupera un singolo esemplare tramite identificativo UUID
 * Se il libro è privato o la libreria è nascosta, l'accesso è consentito esclusivamente al proprietario
 */
const getEsemplareById = async (id, requestingUserId = null) => {
  const query = `
    SELECT 
      ${BASE_ESEMPLARI_SELECT},
      u.nome as proprietario_nome,
      u.cognome as proprietario_cognome,
      p.citta as proprietario_citta,
      priv.mostra_libreria as proprietario_mostra_libreria
    FROM esemplari e
    JOIN categorie c ON e.categoria_id = c.id
    JOIN utenti u ON e.utente_id = u.id
    LEFT JOIN preferenze_privacy_utenti priv ON u.id = priv.utente_id
    LEFT JOIN posizione_utenti p ON u.id = p.utente_id
    WHERE e.id = $1
    LIMIT 1;
  `;
  const result = await db.query(query, [id]);

  if (result.rows.length === 0) {
    const error = new Error('Esemplare non trovato nel catalogo.');
    error.statusCode = 404;
    error.code = 'ESEMPLARE_NOT_FOUND';
    throw error;
  }

  const row = result.rows[0];

  // Controllo di riservatezza granulare:
  // Se il libro è privato o l'utente proprietario ha nascosto l'intera libreria,
  // la scheda non è visibile a terzi né a utenti non autenticati (risposta 404 per evitare enumerazione)
  const isPrivateBook = row.visibile_pubblico === false;
  const isPrivateLibrary = row.proprietario_mostra_libreria === false;
  const isOwner = requestingUserId && requestingUserId === row.utente_id;

  let isBorrower = false;
  if (requestingUserId && !isOwner) {
    const loanCheck = await db.query(
      `SELECT id FROM richieste_prestito WHERE esemplare_id = $1 AND richiedente_id = $2 AND stato IN ('IN_PRESTITO', 'ACCETTATA') LIMIT 1`,
      [id, requestingUserId]
    );
    isBorrower = loanCheck.rows.length > 0;
  }

  if ((isPrivateBook || isPrivateLibrary) && !isOwner && !isBorrower) {
    const error = new Error('Esemplare non trovato nel catalogo.');
    error.statusCode = 404;
    error.code = 'ESEMPLARE_NOT_FOUND';
    throw error;
  }

  const formatted = formatEsemplareRow(row);
  if (isBorrower) {
    formatted.titolarita = 'IN_PRESTITO';
    formatted.in_prestito_temporaneo = true;
  }

  return formatted;
};

/**
 * Aggiorna i dati di un esemplare esistente, previa verifica rigorosa di titolarità
 */
const updateEsemplare = async (id, utenteId, updateData) => {
  // 1. Verifica esistenza esemplare
  const checkRes = await db.query('SELECT utente_id FROM esemplari WHERE id = $1', [id]);
  if (checkRes.rows.length === 0) {
    const error = new Error('Esemplare non trovato.');
    error.statusCode = 404;
    error.code = 'ESEMPLARE_NOT_FOUND';
    throw error;
  }

  // 2. Controllo di autorizzazione/titolarità: solo il proprietario può modificare l'esemplare
  if (checkRes.rows[0].utente_id !== utenteId) {
    const error = new Error('Accesso negato. Non disponi dei permessi per modificare questo esemplare.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_NOT_OWNER';
    throw error;
  }

  // Costruzione dinamica dell'aggiornamento SQL
  const setClauses = [];
  const params = [id];
  let paramIdx = 2;

  if (typeof updateData.titolo !== 'undefined') {
    if (!updateData.titolo || !updateData.titolo.trim()) {
      const error = new Error('Il titolo dell\'opera non può essere vuoto.');
      error.statusCode = 400;
      error.code = 'TITOLO_INVALID';
      throw error;
    }
    setClauses.push(`titolo = $${paramIdx}`);
    params.push(updateData.titolo.trim());
    paramIdx++;
  }

  if (typeof updateData.autore !== 'undefined') {
    if (!updateData.autore || !updateData.autore.trim()) {
      const error = new Error('L\'autore dell\'opera non può essere vuoto.');
      error.statusCode = 400;
      error.code = 'AUTORE_INVALID';
      throw error;
    }
    setClauses.push(`autore = $${paramIdx}`);
    params.push(updateData.autore.trim());
    paramIdx++;
  }

  if (typeof updateData.categoria_id !== 'undefined') {
    const catCheck = await db.query('SELECT id FROM categorie WHERE id = $1', [updateData.categoria_id]);
    if (catCheck.rows.length === 0) {
      const error = new Error('La categoria specificata non esiste.');
      error.statusCode = 400;
      error.code = 'CATEGORIA_INVALID';
      throw error;
    }
    setClauses.push(`categoria_id = $${paramIdx}`);
    params.push(updateData.categoria_id);
    paramIdx++;
  }

  if (typeof updateData.sottogenere !== 'undefined') {
    setClauses.push(`sottogenere = $${paramIdx}`);
    params.push(updateData.sottogenere ? updateData.sottogenere.trim() : null);
    paramIdx++;
  }

  if (typeof updateData.editore !== 'undefined') {
    setClauses.push(`editore = $${paramIdx}`);
    params.push(updateData.editore ? updateData.editore.trim() : null);
    paramIdx++;
  }

  if (typeof updateData.anno_pubblicazione !== 'undefined') {
    if (updateData.anno_pubblicazione === null || updateData.anno_pubblicazione === '') {
      setClauses.push(`anno_pubblicazione = $${paramIdx}`);
      params.push(null);
      paramIdx++;
    } else {
      const yearNum = Number(updateData.anno_pubblicazione);
      const currentYear = new Date().getFullYear();
      if (!Number.isInteger(yearNum) || yearNum < 1450 || yearNum > currentYear + 1) {
        const error = new Error(`L'anno di pubblicazione deve essere un numero intero compreso tra il 1450 e il ${currentYear + 1}.`);
        error.statusCode = 400;
        error.code = 'ANNO_INVALID';
        throw error;
      }
      setClauses.push(`anno_pubblicazione = $${paramIdx}`);
      params.push(yearNum);
      paramIdx++;
    }
  }

  if (typeof updateData.isbn !== 'undefined') {
    if (updateData.isbn === null || updateData.isbn === '') {
      setClauses.push(`isbn = $${paramIdx}`);
      params.push(null);
      paramIdx++;
    } else {
      const cleanIsbn = updateData.isbn.replace(/[-\s]/g, '');
      const isbn10Regex = /^[0-9]{9}[0-9X]$/i;
      const isbn13Regex = /^(978|979)[0-9]{10}$/;
      if (!isbn10Regex.test(cleanIsbn) && !isbn13Regex.test(cleanIsbn)) {
        const error = new Error('Il codice ISBN specificato non è valido. Inserire un codice ISBN-10 o ISBN-13 valido.');
        error.statusCode = 400;
        error.code = 'ISBN_INVALID';
        throw error;
      }
      setClauses.push(`isbn = $${paramIdx}`);
      params.push(updateData.isbn.trim());
      paramIdx++;
    }
  }

  if (typeof updateData.lingua !== 'undefined') {
    setClauses.push(`lingua = $${paramIdx}`);
    params.push(updateData.lingua ? updateData.lingua.trim() : 'Italiano');
    paramIdx++;
  }

  if (typeof updateData.descrizione !== 'undefined') {
    setClauses.push(`descrizione = $${paramIdx}`);
    params.push(updateData.descrizione ? updateData.descrizione.trim() : null);
    paramIdx++;
  }

  if (typeof updateData.note !== 'undefined') {
    setClauses.push(`note = $${paramIdx}`);
    params.push(updateData.note ? updateData.note.trim() : null);
    paramIdx++;
  }

  if (typeof updateData.stato_conservazione !== 'undefined') {
    if (!STATI_CONSERVAZIONE_VALIDI.includes(updateData.stato_conservazione)) {
      const error = new Error(`Stato di conservazione non valido. Valori ammessi: ${STATI_CONSERVAZIONE_VALIDI.join(', ')}`);
      error.statusCode = 400;
      error.code = 'STATO_CONSERVAZIONE_INVALID';
      throw error;
    }
    setClauses.push(`stato_conservazione = $${paramIdx}`);
    params.push(updateData.stato_conservazione);
    paramIdx++;
  }

  if (typeof updateData.stato_disponibilita !== 'undefined') {
    if (!STATI_DISPONIBILITA_VALIDI.includes(updateData.stato_disponibilita)) {
      const error = new Error(`Stato di disponibilità non valido. Valori ammessi: ${STATI_DISPONIBILITA_VALIDI.join(', ')}`);
      error.statusCode = 400;
      error.code = 'STATO_DISPONIBILITA_INVALID';
      throw error;
    }
    setClauses.push(`stato_disponibilita = $${paramIdx}`);
    params.push(updateData.stato_disponibilita);
    paramIdx++;
  }

  if (typeof updateData.visibile_pubblico !== 'undefined') {
    setClauses.push(`visibile_pubblico = $${paramIdx}`);
    params.push(Boolean(updateData.visibile_pubblico));
    paramIdx++;
  }

  if (typeof updateData.titolarita !== 'undefined') {
    const titVal = updateData.titolarita === 'IN_PRESTITO' ? 'IN_PRESTITO' : 'PROPRIETA';
    setClauses.push(`titolarita = $${paramIdx}`);
    params.push(titVal);
    paramIdx++;
  }

  if (setClauses.length === 0) {
    return getEsemplareById(id, utenteId);
  }

  const updateQuery = `
    UPDATE esemplari
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING *;
  `;

  await db.query(updateQuery, params);
  return getEsemplareById(id, utenteId);
};

/**
 * Inverte atomicamente la visibilità pubblica/privata di un esemplare (solo proprietario)
 */
const toggleVisibilitaEsemplare = async (id, utenteId) => {
  // 1. Verifica esistenza e controllo titolarità
  const checkRes = await db.query('SELECT utente_id, visibile_pubblico FROM esemplari WHERE id = $1', [id]);
  if (checkRes.rows.length === 0) {
    const error = new Error('Esemplare non trovato.');
    error.statusCode = 404;
    error.code = 'ESEMPLARE_NOT_FOUND';
    throw error;
  }

  if (checkRes.rows[0].utente_id !== utenteId) {
    const error = new Error('Accesso negato. Non disponi dei permessi per modificare la visibilità di questo esemplare.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_NOT_OWNER';
    throw error;
  }

  const nuovoStato = !checkRes.rows[0].visibile_pubblico;
  await db.query('UPDATE esemplari SET visibile_pubblico = $1 WHERE id = $2', [nuovoStato, id]);

  return getEsemplareById(id, utenteId);
};

/**
 * Elimina un esemplare dal database verificando la titolarità del richiedente
 */
const deleteEsemplare = async (id, utenteId) => {
  // Recupera eventuali immagini copertina/miniatura associate per rimuoverle fisicamente dal disco
  const checkRes = await db.query(
    'SELECT utente_id, immagine_copertina, immagine_miniatura FROM esemplari WHERE id = $1',
    [id]
  );
  if (checkRes.rows.length === 0) {
    const error = new Error('Esemplare non trovato.');
    error.statusCode = 404;
    error.code = 'ESEMPLARE_NOT_FOUND';
    throw error;
  }

  if (checkRes.rows[0].utente_id !== utenteId) {
    const error = new Error('Accesso negato. Non disponi dei permessi per eliminare questo esemplare.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_NOT_OWNER';
    throw error;
  }

  // Rimuove fisicamente dal disco le immagini associate
  const oldCover = checkRes.rows[0].immagine_copertina;
  const oldThumb = checkRes.rows[0].immagine_miniatura;
  if (oldCover || oldThumb) {
    await imageService.deleteBookCoverFiles(oldCover, oldThumb);
  }

  await db.query('DELETE FROM esemplari WHERE id = $1', [id]);
  return { success: true, message: 'Esemplare eliminato con successo dal catalogo personale.' };
};

/**
 * Aggiorna le copertine (standard e miniatura) di un esemplare, verificando la titolarità
 */
const updateBookCover = async (id, utenteId, { copertinaUrl, miniaturaUrl }) => {
  const checkRes = await db.query(
    'SELECT utente_id, immagine_copertina, immagine_miniatura FROM esemplari WHERE id = $1',
    [id]
  );
  if (checkRes.rows.length === 0) {
    const error = new Error('Esemplare non trovato.');
    error.statusCode = 404;
    error.code = 'ESEMPLARE_NOT_FOUND';
    throw error;
  }

  if (checkRes.rows[0].utente_id !== utenteId) {
    const error = new Error('Accesso negato. Non disponi dei permessi per modificare questo esemplare.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_NOT_OWNER';
    throw error;
  }

  // Rimuove eventuali immagini precedenti se già presenti
  const oldCover = checkRes.rows[0].immagine_copertina;
  const oldThumb = checkRes.rows[0].immagine_miniatura;
  if (oldCover || oldThumb) {
    await imageService.deleteBookCoverFiles(oldCover, oldThumb);
  }

  await db.query(
    'UPDATE esemplari SET immagine_copertina = $1, immagine_miniatura = $2 WHERE id = $3',
    [copertinaUrl, miniaturaUrl, id]
  );

  return getEsemplareById(id);
};

/**
 * Rimuove la copertina e la miniatura da un esemplare, verificando la titolarità
 */
const removeBookCover = async (id, utenteId) => {
  const checkRes = await db.query(
    'SELECT utente_id, immagine_copertina, immagine_miniatura FROM esemplari WHERE id = $1',
    [id]
  );
  if (checkRes.rows.length === 0) {
    const error = new Error('Esemplare non trovato.');
    error.statusCode = 404;
    error.code = 'ESEMPLARE_NOT_FOUND';
    throw error;
  }

  if (checkRes.rows[0].utente_id !== utenteId) {
    const error = new Error('Accesso negato. Non disponi dei permessi per modificare questo esemplare.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_NOT_OWNER';
    throw error;
  }

  const oldCover = checkRes.rows[0].immagine_copertina;
  const oldThumb = checkRes.rows[0].immagine_miniatura;
  if (oldCover || oldThumb) {
    await imageService.deleteBookCoverFiles(oldCover, oldThumb);
  }

  await db.query(
    'UPDATE esemplari SET immagine_copertina = NULL, immagine_miniatura = NULL WHERE id = $1',
    [id]
  );

  return getEsemplareById(id);
};

/**
 * Ricerca catalogo esemplari disponibili nella piattaforma per la community
 * Combina criteri di pertinenza testuale con filtri opzionali sulla prossimità geografica (PostGIS / earthdistance)
 * (Filtro difensivo di privacy: esclude rigorosamente libri privati e intere librerie occultate)
 */
const searchEsemplari = async (filters = {}) => {
  const params = [];
  let paramIdx = 1;

  // Verifica presenza di coordinate valide per la ricerca geospaziale di prossimità
  const hasLat = typeof filters.lat !== 'undefined' && filters.lat !== null && !isNaN(parseFloat(filters.lat));
  const hasLng = typeof filters.lng !== 'undefined' && filters.lng !== null && !isNaN(parseFloat(filters.lng));
  const hasCoords = hasLat && hasLng;

  let latParamIndex = null;
  let lngParamIndex = null;

  let distanceSelect = 'NULL::numeric as distanza_metri';

  if (hasCoords) {
    const latVal = parseFloat(filters.lat);
    const lngVal = parseFloat(filters.lng);
    params.push(latVal);
    latParamIndex = paramIdx++;
    params.push(lngVal);
    lngParamIndex = paramIdx++;

    distanceSelect = `
      CASE 
        WHEN (COALESCE(p.coordinate_offuscate, e.coordinate_esemplare)) IS NOT NULL THEN
          round((earth_distance(
            ll_to_earth($${latParamIndex}, $${lngParamIndex}), 
            ll_to_earth(
              (COALESCE(p.coordinate_offuscate, e.coordinate_esemplare))[1], 
              (COALESCE(p.coordinate_offuscate, e.coordinate_esemplare))[0]
            )
          ))::numeric, 1)
        ELSE NULL
      END as distanza_metri
    `;
  }

  let query = `
    SELECT 
      ${BASE_ESEMPLARI_SELECT},
      u.nome as proprietario_nome,
      u.cognome as proprietario_cognome,
      p.citta as proprietario_citta,
      p.indirizzo_approssimato as proprietario_indirizzo_approssimato,
      p.coordinate_offuscate as proprietario_coord_offuscate,
      COALESCE(priv.modalita_occultamento, 'QUARTIERE') as proprietario_modalita_occultamento,
      ${distanceSelect}
    FROM esemplari e
    JOIN categorie c ON e.categoria_id = c.id
    JOIN utenti u ON e.utente_id = u.id
    LEFT JOIN preferenze_privacy_utenti priv ON u.id = priv.utente_id
    LEFT JOIN posizione_utenti p ON u.id = p.utente_id
    WHERE (priv.mostra_libreria IS NULL OR priv.mostra_libreria = TRUE)
      AND e.visibile_pubblico = TRUE
  `;

  if (filters.stato_disponibilita) {
    if (filters.stato_disponibilita !== 'TUTTI') {
      query += ` AND e.stato_disponibilita = $${paramIdx}`;
      params.push(filters.stato_disponibilita);
      paramIdx++;
    }
  } else {
    // Di default mostra solo quelli disponibili allo scambio
    query += ` AND e.stato_disponibilita = 'DISPONIBILE'`;
  }

  // Esclusione opzionale dei propri libri dalla ricerca community
  if (filters.escludi_utente_id) {
    query += ` AND e.utente_id != $${paramIdx}`;
    params.push(filters.escludi_utente_id);
    paramIdx++;
  }

  // Filtro categoria: accetta sia UUID che slug
  if (filters.categoria_id) {
    if (isValidUUID(filters.categoria_id)) {
      query += ` AND e.categoria_id = $${paramIdx}`;
      params.push(filters.categoria_id);
      paramIdx++;
    } else {
      query += ` AND (c.slug = $${paramIdx} OR LOWER(c.nome) = LOWER($${paramIdx}))`;
      params.push(filters.categoria_id.trim());
      paramIdx++;
    }
  }

  if (filters.sottogenere && filters.sottogenere.trim()) {
    query += ` AND LOWER(e.sottogenere) = LOWER($${paramIdx})`;
    params.push(filters.sottogenere.trim());
    paramIdx++;
  }

  // Filtro di ricerca testuale combinata (titolo, autore, sottogenere, isbn, editore)
  if (filters.search && filters.search.trim()) {
    query += ` AND (
      LOWER(e.titolo) LIKE LOWER($${paramIdx}) OR 
      LOWER(e.autore) LIKE LOWER($${paramIdx}) OR 
      LOWER(COALESCE(e.sottogenere, '')) LIKE LOWER($${paramIdx}) OR
      LOWER(COALESCE(e.isbn, '')) LIKE LOWER($${paramIdx}) OR
      LOWER(COALESCE(e.editore, '')) LIKE LOWER($${paramIdx})
    )`;
    params.push(`%${filters.search.trim()}%`);
    paramIdx++;
  }

  // Filtro spaziale per raggio chilometrico (se fornite coordinate e raggio)
  if (hasCoords && filters.raggio_km && !isNaN(parseFloat(filters.raggio_km))) {
    const raggioKm = parseFloat(filters.raggio_km);
    const radiusMeters = raggioKm * 1000;
    params.push(radiusMeters);
    const radiusParamIdx = paramIdx++;

    query += `
      AND (COALESCE(p.coordinate_offuscate, e.coordinate_esemplare)) IS NOT NULL
      AND earth_box(ll_to_earth($${latParamIndex}, $${lngParamIndex}), $${radiusParamIdx}) @> 
          ll_to_earth(
            (COALESCE(p.coordinate_offuscate, e.coordinate_esemplare))[1], 
            (COALESCE(p.coordinate_offuscate, e.coordinate_esemplare))[0]
          )
      AND earth_distance(
            ll_to_earth($${latParamIndex}, $${lngParamIndex}), 
            ll_to_earth(
              (COALESCE(p.coordinate_offuscate, e.coordinate_esemplare))[1], 
              (COALESCE(p.coordinate_offuscate, e.coordinate_esemplare))[0]
            )
          ) <= $${radiusParamIdx}
    `;
  }

  // Ordinamento dei risultati
  const ordinaPer = (filters.ordina_per || (hasCoords ? 'distanza' : 'data')).toLowerCase();
  if (ordinaPer === 'distanza' && hasCoords) {
    query += ` ORDER BY distanza_metri ASC NULLS LAST, e.data_creazione DESC`;
  } else if (ordinaPer === 'titolo') {
    query += ` ORDER BY e.titolo ASC, e.data_creazione DESC`;
  } else if (ordinaPer === 'autore') {
    query += ` ORDER BY e.autore ASC, e.data_creazione DESC`;
  } else {
    // Default: più recenti
    query += ` ORDER BY e.data_creazione DESC`;
  }

  const limit = filters.limit ? parseInt(filters.limit, 10) : 50;
  query += ` LIMIT ${limit};`;

  const result = await db.query(query, params);
  return result.rows.map(formatEsemplareRow);
};

/**
 * Recupera l'intera tassonomia delle categorie disciplinari con metadati e sottogeneri predefiniti
 */
const getAllCategorie = async () => {
  const query = `
    SELECT id, nome, slug, descrizione, icona, colore_hex, sottogeneri_predefiniti,
      (SELECT COUNT(*) FROM esemplari WHERE categoria_id = c.id) as totale_esemplari
    FROM categorie c
    ORDER BY nome ASC;
  `;
  const result = await db.query(query);
  return result.rows.map(r => ({
    id: r.id,
    nome: r.nome,
    slug: r.slug,
    descrizione: r.descrizione,
    icona: r.icona || 'bi-book',
    colore_hex: r.colore_hex || '#1e40af',
    sottogeneri_predefiniti: r.sottogeneri_predefiniti || [],
    totale_esemplari: parseInt(r.totale_esemplari, 10)
  }));
};

module.exports = {
  createEsemplare,
  getMyEsemplari,
  getEsemplareById,
  updateEsemplare,
  toggleVisibilitaEsemplare,
  deleteEsemplare,
  updateBookCover,
  removeBookCover,
  searchEsemplari,
  getAllCategorie
};
