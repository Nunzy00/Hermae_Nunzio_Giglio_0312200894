// Service per la gestione del ciclo di vita dei Prestiti (Fase 23)
// Implementa il tracking temporale, macchina a stati, transazioni concorrenti e aggiornamento disponibilità

const db = require('../config/db');
const privacyShieldService = require('./privacyShieldService');
const notificheService = require('./notificheService');

// Verifica formato UUIDv4
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof str === 'string' && uuidRegex.test(str);
};

/**
 * Arricchisce il record del prestito con metriche temporali dinamiche e countdown scadenze
 * @param {Object} loan - Record grezzo proveniente dal database
 * @returns {Object} Record arricchito con indicatori temporali
 */
const enrichLoanWithTemporalTracking = (loan) => {
  if (!loan) return null;

  const now = new Date();
  const giorniTotali = parseInt(loan.durata_giorni, 10) || 30;
  let giorniTrascorsi = null;
  let giorniRimanenti = null;
  let inRitardo = false;
  let giorniRitardo = 0;
  let percentualeTempo = 0;
  let statoTemporale = loan.stato;

  if (['IN_PRESTITO', 'ATTIVO'].includes(loan.stato) && loan.data_inizio) {
    const start = new Date(loan.data_inizio);
    const end = loan.data_scadenza
      ? new Date(loan.data_scadenza)
      : new Date(start.getTime() + giorniTotali * 86400000);

    const diffMsFromStart = Math.max(0, now.getTime() - start.getTime());
    giorniTrascorsi = Math.floor(diffMsFromStart / 86400000);

    const diffMsToEnd = end.getTime() - now.getTime();
    giorniRimanenti = Math.ceil(diffMsToEnd / 86400000);

    if (giorniRimanenti < 0) {
      inRitardo = true;
      giorniRitardo = Math.abs(giorniRimanenti);
      statoTemporale = 'SCADUTO_IN_RITARDO';
    } else if (giorniRimanenti <= 5) {
      statoTemporale = 'IN_SCADENZA';
    } else {
      statoTemporale = 'IN_CORSO';
    }

    const totalMs = end.getTime() - start.getTime();
    if (totalMs > 0) {
      percentualeTempo = Math.min(100, Math.max(0, Math.round((diffMsFromStart / totalMs) * 100)));
    }
  } else if (['RESTITUITO', 'COMPLETATA'].includes(loan.stato)) {
    statoTemporale = 'RESTITUITO';
    if (loan.data_inizio && loan.data_restituzione) {
      const start = new Date(loan.data_inizio);
      const ret = new Date(loan.data_restituzione);
      giorniTrascorsi = Math.max(0, Math.floor((ret.getTime() - start.getTime()) / 86400000));
    }
    percentualeTempo = 100;
    giorniRimanenti = 0;
  }

  return {
    ...loan,
    durata_giorni: giorniTotali,
    giorni_totali: giorniTotali,
    giorni_trascorsi: giorniTrascorsi,
    giorni_rimanenti: giorniRimanenti,
    in_ritardo: inRitardo,
    giorni_ritardo: giorniRitardo,
    percentuale_tempo: percentualeTempo,
    stato_temporale: statoTemporale
  };
};

/**
 * Crea una richiesta formale di prestito con durata e tracking temporale
 */
const creaRichiestaPrestito = async ({ richiedenteId, esemplareId, durataGiorni = 30, messaggio = '' }) => {
  if (!isValidUUID(richiedenteId)) {
    const err = new Error('Identificativo utente non valido.');
    err.statusCode = 400;
    throw err;
  }

  if (!isValidUUID(esemplareId)) {
    const err = new Error('Identificativo esemplare libro non valido.');
    err.statusCode = 400;
    throw err;
  }

  const duration = parseInt(durataGiorni, 10);
  if (isNaN(duration) || duration < 1 || duration > 180) {
    const err = new Error('La durata del prestito deve essere compresa tra 1 e 180 giorni.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Verifica esistenza e disponibilità dell'esemplare
  const bookRes = await db.query(`
    SELECT e.id, e.utente_id as proprietario_id, e.titolo, e.autore, e.stato_disponibilita, e.visibile_pubblico,
           priv.consenti_messaggi_diretti,
           u_owner.nome as proprietario_nome, u_owner.cognome as proprietario_cognome
    FROM esemplari e
    JOIN utenti u_owner ON e.utente_id = u_owner.id
    LEFT JOIN preferenze_privacy_utenti priv ON e.utente_id = priv.utente_id
    WHERE e.id = $1
  `, [esemplareId]);

  if (bookRes.rows.length === 0) {
    const err = new Error('Esemplare librario non trovato.');
    err.statusCode = 404;
    throw err;
  }

  const book = bookRes.rows[0];

  // 2. Controllo auto-richiesta
  if (book.proprietario_id === richiedenteId) {
    const err = new Error('Non puoi richiedere in prestito un volume appartenente alla tua libreria.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Controllo disponibilità effettiva
  if (book.stato_disponibilita !== 'DISPONIBILE') {
    const err = new Error(`Questo volume non è attualmente disponibile per il prestito (stato attuale: ${book.stato_disponibilita}).`);
    err.statusCode = 409;
    err.code = 'BOOK_NOT_AVAILABLE';
    throw err;
  }

  // 4. Controllo preferenze privacy messaggi diretti
  if (book.consenti_messaggi_diretti === false) {
    const err = new Error("Il proprietario di questo libro ha impostato le preferenze per non ricevere richieste dirette.");
    err.statusCode = 403;
    err.code = 'MESSAGGI_NON_CONSENTITI';
    throw err;
  }

  // 5. Prevenzione richieste duplicate attive per lo stesso utente e libro
  const existingRes = await db.query(`
    SELECT id, stato FROM richieste_prestito
    WHERE richiedente_id = $1 AND esemplare_id = $2 AND stato IN ('IN_ATTESA', 'ACCETTATA', 'IN_PRESTITO')
  `, [richiedenteId, esemplareId]);

  if (existingRes.rows.length > 0) {
    const err = new Error('Hai già una richiesta o un prestito attivo per questo specifico esemplare.');
    err.statusCode = 409;
    err.code = 'ACTIVE_REQUEST_EXISTS';
    throw err;
  }

  // 6. Rate Limiting Sliding Window (antispam)
  const rateCheck = privacyShieldService.checkRateLimit(richiedenteId, 5, 15);
  if (!rateCheck.consentito) {
    const err = new Error(`Limite richieste raggiunto. Attendi ${rateCheck.secondiAttesa} secondi prima di inviare una nuova richiesta.`);
    err.statusCode = 429;
    err.code = 'RATE_LIMIT_EXCEEDED';
    throw err;
  }

  // 7. Sanitizzazione Privacy Shield per messaggio iniziale
  const { testoSanificato } = privacyShieldService.sanitizeMessage(messaggio || '');

  // 8. Inserimento formale richiesta
  const insRes = await db.query(`
    INSERT INTO richieste_prestito 
      (esemplare_id, richiedente_id, proprietario_id, stato, durata_giorni, messaggio_iniziale, data_richiesta)
    VALUES ($1, $2, $3, 'IN_ATTESA', $4, $5, NOW())
    RETURNING *
  `, [esemplareId, richiedenteId, book.proprietario_id, duration, testoSanificato || null]);

  const newLoan = insRes.rows[0];

  // Se è presente un messaggio iniziale, inseriscilo anche nel thread chat
  if (testoSanificato && testoSanificato.trim()) {
    await db.query(`
      INSERT INTO messaggi_chat (richiesta_id, mittente_id, testo, letto, data_invio)
      VALUES ($1, $2, $3, false, NOW())
    `, [newLoan.id, richiedenteId, testoSanificato]);
  }

  // 9. Notifica asincrona per il proprietario
  const requesterRes = await db.query('SELECT nome, cognome FROM utenti WHERE id = $1', [richiedenteId]);
  const requester = requesterRes.rows[0] || { nome: 'Un lettore' };
  const reqName = `${requester.nome} ${requester.cognome ? requester.cognome.charAt(0) + '.' : ''}`.trim();

  await notificheService.creaNotifica({
    utenteId: book.proprietario_id,
    richiestaId: newLoan.id,
    tipo: 'NUOVA_RICHIESTA_PRESTITO',
    titolo: 'Nuova richiesta formale di prestito',
    messaggio: `${reqName} ha richiesto in prestito il tuo volume "${book.titolo}" per una durata di ${duration} giorni.`
  });

  return enrichLoanWithTemporalTracking(newLoan);
};

/**
 * Accetta un prestito con transazione atomica, blocco concorrenza e aggiornamento stato esemplare
 */
const accettaPrestito = async ({ richiestaId, proprietarioId, durataGiorniOverride = null, note = '' }) => {
  if (!isValidUUID(richiestaId)) {
    const err = new Error('Identificativo richiesta non valido.');
    err.statusCode = 400;
    throw err;
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock e recupero richiesta prestito
    const reqRes = await client.query(`
      SELECT r.*, e.titolo as libro_titolo, e.stato_disponibilita as libro_stato,
             u_req.nome as richiedente_nome, u_req.cognome as richiedente_cognome
      FROM richieste_prestito r
      JOIN esemplari e ON r.esemplare_id = e.id
      JOIN utenti u_req ON r.richiedente_id = u_req.id
      WHERE r.id = $1
      FOR UPDATE
    `, [richiestaId]);

    if (reqRes.rows.length === 0) {
      const err = new Error('Richiesta di prestito non trovata.');
      err.statusCode = 404;
      throw err;
    }

    const loan = reqRes.rows[0];

    // 2. Controllo autorizzazioni titolarità
    if (loan.proprietario_id !== proprietarioId) {
      const err = new Error('Solo il proprietario del libro può accettare una richiesta di prestito.');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_NOT_OWNER';
      throw err;
    }

    // 3. Verifica stato valido per accettazione
    if (loan.stato !== 'IN_ATTESA') {
      const err = new Error(`Impossibile accettare una richiesta che si trova già nello stato: ${loan.stato}.`);
      err.statusCode = 400;
      throw err;
    }

    // 4. Lock e verifica disponibilità esemplare
    const bookRes = await client.query(`
      SELECT id, stato_disponibilita, titolo FROM esemplari WHERE id = $1 FOR UPDATE
    `, [loan.esemplare_id]);

    const book = bookRes.rows[0];
    if (book.stato_disponibilita !== 'DISPONIBILE') {
      const err = new Error("Questo esemplare non è disponibile. È già stato affidato in prestito ad un altro lettore.");
      err.statusCode = 409;
      err.code = 'BOOK_ALREADY_BORROWED';
      throw err;
    }

    // 5. Calcolo date di tracking temporale
    const finalDuration = durataGiorniOverride ? parseInt(durataGiorniOverride, 10) : loan.durata_giorni;
    const dataInizio = new Date();
    const dataScadenza = new Date(dataInizio.getTime() + finalDuration * 86400000);

    // 6. Aggiornamento automatico stato dell'esemplare a 'IN_PRESTITO'
    await client.query(`
      UPDATE esemplari 
      SET stato_disponibilita = 'IN_PRESTITO' 
      WHERE id = $1
    `, [loan.esemplare_id]);

    // 7. Avanzamento stato richiesta a 'IN_PRESTITO' (con data_inizio e data_scadenza)
    const updateRes = await client.query(`
      UPDATE richieste_prestito
      SET stato = 'IN_PRESTITO',
          durata_giorni = $1,
          data_inizio = $2,
          data_scadenza = $3,
          note_restituzione = $4,
          data_aggiornamento = NOW()
      WHERE id = $5
      RETURNING *
    `, [finalDuration, dataInizio, dataScadenza, note || null, richiestaId]);

    // 8. RISOLUZIONE E BLOCCO RICHIESTE CONCORRENTI PENDENTI PER IL MEDESIMO ESEMPLARE
    const concurrentRes = await client.query(`
      SELECT id, richiedente_id FROM richieste_prestito
      WHERE esemplare_id = $1 AND id != $2 AND stato = 'IN_ATTESA'
      FOR UPDATE
    `, [loan.esemplare_id, richiestaId]);

    if (concurrentRes.rows.length > 0) {
      await client.query(`
        UPDATE richieste_prestito
        SET stato = 'RIFIUTATA',
            note_restituzione = 'Chiusa automaticamente: il volume è stato concesso in prestito ad un altro utente.',
            data_aggiornamento = NOW()
        WHERE esemplare_id = $1 AND id != $2 AND stato = 'IN_ATTESA'
      `, [loan.esemplare_id, richiestaId]);
    }

    await client.query('COMMIT');

    // 9. Notifica al richiedente vincente
    await notificheService.creaNotifica({
      utenteId: loan.richiedente_id,
      richiestaId: loan.id,
      tipo: 'PRESTITO_ACCETTATO',
      titolo: 'Richiesta di prestito accettata!',
      messaggio: `Il prestito per "${loan.libro_titolo}" è stato accettato. Durata concordata: ${finalDuration} giorni (scadenza: ${dataScadenza.toLocaleDateString('it-IT')}).`
    });

    // 10. Notifiche automatiche per tutti i richiedenti concorrenti declinati
    for (const c of concurrentRes.rows) {
      await notificheService.creaNotifica({
        utenteId: c.richiedente_id,
        richiestaId: c.id,
        tipo: 'PRESTITO_CONCORRENTE_CHIUSO',
        titolo: 'Libro non più disponibile',
        messaggio: `La tua richiesta per "${loan.libro_titolo}" è stata declinata automaticamente: il volume è stato affidato in prestito ad un altro lettore.`
      });
    }

    return enrichLoanWithTemporalTracking(updateRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Conferma la restituzione fisica del testo e ripristina la disponibilità dell'esemplare
 */
const confermaRestituzione = async ({ richiestaId, utenteId, note = '' }) => {
  if (!isValidUUID(richiestaId)) {
    const err = new Error('Identificativo richiesta non valido.');
    err.statusCode = 400;
    throw err;
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock e recupero richiesta
    const reqRes = await client.query(`
      SELECT r.*, e.titolo as libro_titolo
      FROM richieste_prestito r
      JOIN esemplari e ON r.esemplare_id = e.id
      WHERE r.id = $1
      FOR UPDATE
    `, [richiestaId]);

    if (reqRes.rows.length === 0) {
      const err = new Error('Prestito non trovato.');
      err.statusCode = 404;
      throw err;
    }

    const loan = reqRes.rows[0];

    // 2. Controllo autorizzazioni: solo proprietario o richiedente coinvolto
    if (loan.proprietario_id !== utenteId && loan.richiedente_id !== utenteId) {
      const err = new Error('Non sei autorizzato a registrare la restituzione di questo prestito.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Controllo stato
    if (!['IN_PRESTITO', 'ACCETTATA'].includes(loan.stato)) {
      const err = new Error(`Impossibile restituire un prestito nello stato attuale: ${loan.stato}.`);
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();

    // 4. Aggiornamento stato richiesta a 'RESTITUITO'
    const updatedLoanRes = await client.query(`
      UPDATE richieste_prestito
      SET stato = 'RESTITUITO',
          data_restituzione = $1,
          note_restituzione = COALESCE($2, note_restituzione),
          data_aggiornamento = NOW()
      WHERE id = $3
      RETURNING *
    `, [now, note || null, richiestaId]);

    // 5. Ripristino automatico dell'esemplare a 'DISPONIBILE'
    await client.query(`
      UPDATE esemplari
      SET stato_disponibilita = 'DISPONIBILE'
      WHERE id = $1
    `, [loan.esemplare_id]);

    await client.query('COMMIT');

    // 6. Notifica alla controparte
    const targetUserId = utenteId === loan.proprietario_id ? loan.richiedente_id : loan.proprietario_id;
    await notificheService.creaNotifica({
      utenteId: targetUserId,
      richiestaId: loan.id,
      tipo: 'PRESTITO_RESTITUITO',
      titolo: 'Libro restituito con successo',
      messaggio: `Il volume "${loan.libro_titolo}" è stato registrato come restituito. Il prestito è concluso regolarmente.`
    });

    return enrichLoanWithTemporalTracking(updatedLoanRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Rifiuta una richiesta formale di prestito (azione proprietario)
 */
const rifiutaPrestito = async ({ richiestaId, proprietarioId, motivo = '' }) => {
  if (!isValidUUID(richiestaId)) {
    const err = new Error('Identificativo richiesta non valido.');
    err.statusCode = 400;
    throw err;
  }

  const reqRes = await db.query(`
    SELECT r.*, e.titolo as libro_titolo
    FROM richieste_prestito r
    JOIN esemplari e ON r.esemplare_id = e.id
    WHERE r.id = $1
  `, [richiestaId]);

  if (reqRes.rows.length === 0) {
    const err = new Error('Richiesta di prestito non trovata.');
    err.statusCode = 404;
    throw err;
  }

  const loan = reqRes.rows[0];

  if (loan.proprietario_id !== proprietarioId) {
    const err = new Error('Solo il proprietario del libro può rifiutare la richiesta.');
    err.statusCode = 403;
    throw err;
  }

  if (loan.stato !== 'IN_ATTESA') {
    const err = new Error(`Impossibile rifiutare una richiesta con stato: ${loan.stato}.`);
    err.statusCode = 400;
    throw err;
  }

  const updateRes = await db.query(`
    UPDATE richieste_prestito
    SET stato = 'RIFIUTATA',
        note_restituzione = $1,
        data_aggiornamento = NOW()
    WHERE id = $2
    RETURNING *
  `, [motivo || 'Richiesta non accettata dal proprietario.', richiestaId]);

  await notificheService.creaNotifica({
    utenteId: loan.richiedente_id,
    richiestaId: loan.id,
    tipo: 'PRESTITO_RIFIUTATO',
    titolo: 'Richiesta prestito non accettata',
    messaggio: `La tua richiesta di prestito per "${loan.libro_titolo}" non è stata accettata dal proprietario.`
  });

  return enrichLoanWithTemporalTracking(updateRes.rows[0]);
};

/**
 * Annulla una richiesta formale di prestito (azione richiedente prima dell'accettazione)
 */
const annullaPrestito = async ({ richiestaId, richiedenteId }) => {
  if (!isValidUUID(richiestaId)) {
    const err = new Error('Identificativo richiesta non valido.');
    err.statusCode = 400;
    throw err;
  }

  const reqRes = await db.query(`
    SELECT r.*, e.titolo as libro_titolo
    FROM richieste_prestito r
    JOIN esemplari e ON r.esemplare_id = e.id
    WHERE r.id = $1
  `, [richiestaId]);

  if (reqRes.rows.length === 0) {
    const err = new Error('Richiesta di prestito non trovata.');
    err.statusCode = 404;
    throw err;
  }

  const loan = reqRes.rows[0];

  if (loan.richiedente_id !== richiedenteId) {
    const err = new Error('Solo il richiedente può annullare la propria richiesta.');
    err.statusCode = 403;
    throw err;
  }

  if (loan.stato !== 'IN_ATTESA') {
    const err = new Error(`Impossibile annullare una richiesta con stato: ${loan.stato}.`);
    err.statusCode = 400;
    throw err;
  }

  const updateRes = await db.query(`
    UPDATE richieste_prestito
    SET stato = 'ANNULLATA',
        data_aggiornamento = NOW()
    WHERE id = $1
    RETURNING *
  `, [richiestaId]);

  await notificheService.creaNotifica({
    utenteId: loan.proprietario_id,
    richiestaId: loan.id,
    tipo: 'PRESTITO_ANNULLATO',
    titolo: 'Richiesta di prestito revocata',
    messaggio: `Il richiedente ha ritirato la richiesta di prestito per il volume "${loan.libro_titolo}".`
  });

  return enrichLoanWithTemporalTracking(updateRes.rows[0]);
};

/**
 * Concede una proroga temporale sulla data di scadenza del prestito
 */
const prorogaPrestito = async ({ richiestaId, utenteId, giorniAggiuntivi = 15 }) => {
  if (!isValidUUID(richiestaId)) {
    const err = new Error('Identificativo richiesta non valido.');
    err.statusCode = 400;
    throw err;
  }

  const days = parseInt(giorniAggiuntivi, 10);
  if (isNaN(days) || days < 1 || days > 60) {
    const err = new Error('I giorni di proroga devono essere compresi tra 1 e 60.');
    err.statusCode = 400;
    throw err;
  }

  const reqRes = await db.query(`
    SELECT r.*, e.titolo as libro_titolo
    FROM richieste_prestito r
    JOIN esemplari e ON r.esemplare_id = e.id
    WHERE r.id = $1
  `, [richiestaId]);

  if (reqRes.rows.length === 0) {
    const err = new Error('Prestito non trovato.');
    err.statusCode = 404;
    throw err;
  }

  const loan = reqRes.rows[0];

  if (loan.proprietario_id !== utenteId && loan.richiedente_id !== utenteId) {
    const err = new Error('Non autorizzato.');
    err.statusCode = 403;
    throw err;
  }

  if (loan.stato !== 'IN_PRESTITO') {
    const err = new Error('La proroga può essere applicata solo su prestiti attualmente in corso.');
    err.statusCode = 400;
    throw err;
  }

  const currentScadenza = loan.data_scadenza ? new Date(loan.data_scadenza) : new Date();
  const nuovaScadenza = new Date(currentScadenza.getTime() + days * 86400000);
  const nuovaDurata = (loan.durata_giorni || 30) + days;

  const updateRes = await db.query(`
    UPDATE richieste_prestito
    SET data_scadenza = $1,
        durata_giorni = $2,
        data_aggiornamento = NOW()
    WHERE id = $3
    RETURNING *
  `, [nuovaScadenza, nuovaDurata, richiestaId]);

  // Notifica alla controparte
  const targetId = utenteId === loan.proprietario_id ? loan.richiedente_id : loan.proprietario_id;
  await notificheService.creaNotifica({
    utenteId: targetId,
    richiestaId: loan.id,
    tipo: 'PRESTITO_PROROGATO',
    titolo: 'Proroga del prestito accordata',
    messaggio: `Il prestito per "${loan.libro_titolo}" è stato esteso di ${days} giorni (nuova scadenza: ${nuovaScadenza.toLocaleDateString('it-IT')}).`
  });

  return enrichLoanWithTemporalTracking(updateRes.rows[0]);
};

/**
 * Recupera l'elenco dei prestiti di un utente con filtri di ruolo e stato
 */
const getPrestitiUtente = async (utenteId, filtri = {}) => {
  if (!isValidUUID(utenteId)) {
    const err = new Error('Identificativo utente non valido.');
    err.statusCode = 400;
    throw err;
  }

  let query = `
    SELECT 
      r.id, r.esemplare_id, r.richiedente_id, r.proprietario_id, r.stato, r.messaggio_iniziale,
      r.durata_giorni, r.data_inizio, r.data_scadenza, r.data_restituzione, r.note_restituzione,
      r.data_richiesta, r.data_aggiornamento,
      e.titolo as libro_titolo, e.autore as libro_autore, e.isbn as libro_isbn,
      e.immagine_copertina, e.immagine_miniatura, e.stato_conservazione, e.stato_disponibilita as libro_stato_disponibilita,
      c.nome as categoria_nome, c.colore_hex as categoria_colore, c.icona as categoria_icona,
      CASE WHEN r.proprietario_id = $1 THEN 'PROPRIETARIO' ELSE 'RICHIEDENTE' END as ruolo,
      partner.id as partner_id, partner.nome as partner_nome,
      SUBSTRING(partner.cognome FROM 1 FOR 1) || '.' as partner_cognome_iniziale,
      pos.citta as partner_citta
    FROM richieste_prestito r
    JOIN esemplari e ON r.esemplare_id = e.id
    JOIN categorie c ON e.categoria_id = c.id
    JOIN utenti partner ON partner.id = CASE WHEN r.proprietario_id = $1 THEN r.richiedente_id ELSE r.proprietario_id END
    LEFT JOIN posizione_utenti pos ON partner.id = pos.utente_id
    WHERE (r.richiedente_id = $1 OR r.proprietario_id = $1)
  `;

  const params = [utenteId];
  let paramIdx = 2;

  // Filtro ruolo: 'RICHIEDENTE' (libri presi in prestito) o 'PROPRIETARIO' (libri concessi)
  if (filtri.ruolo === 'RICHIEDENTE') {
    query += ` AND r.richiedente_id = $1`;
  } else if (filtri.ruolo === 'PROPRIETARIO') {
    query += ` AND r.proprietario_id = $1`;
  }

  // Filtro stato
  if (filtri.stato && filtri.stato !== 'TUTTI') {
    if (filtri.stato === 'ATTIVI') {
      query += ` AND r.stato = 'IN_PRESTITO'`;
    } else if (filtri.stato === 'IN_ATTESA') {
      query += ` AND r.stato = 'IN_ATTESA'`;
    } else if (filtri.stato === 'CONCLUSI') {
      query += ` AND r.stato IN ('RESTITUITO', 'COMPLETATA', 'RIFIUTATA', 'ANNULLATA')`;
    } else if (filtri.stato === 'IN_RITARDO') {
      query += ` AND r.stato = 'IN_PRESTITO' AND r.data_scadenza < NOW()`;
    } else {
      query += ` AND r.stato = $${paramIdx++}`;
      params.push(filtri.stato);
    }
  }

  // Ordinamento per urgenza temporale e data richiesta
  query += ` ORDER BY 
    CASE 
      WHEN r.stato = 'IN_PRESTITO' AND r.data_scadenza < NOW() THEN 1
      WHEN r.stato = 'IN_PRESTITO' THEN 2
      WHEN r.stato = 'IN_ATTESA' THEN 3
      ELSE 4
    END,
    COALESCE(r.data_scadenza, r.data_richiesta) DESC
  `;

  const res = await db.query(query, params);
  return res.rows.map(enrichLoanWithTemporalTracking);
};

/**
 * Recupera il dettaglio completo di uno specifico prestito
 */
const getPrestitoDettaglio = async (richiestaId, utenteId) => {
  if (!isValidUUID(richiestaId)) {
    const err = new Error('Identificativo richiesta non valido.');
    err.statusCode = 400;
    throw err;
  }

  const res = await db.query(`
    SELECT 
      r.id, r.esemplare_id, r.richiedente_id, r.proprietario_id, r.stato, r.messaggio_iniziale,
      r.durata_giorni, r.data_inizio, r.data_scadenza, r.data_restituzione, r.note_restituzione,
      r.data_richiesta, r.data_aggiornamento,
      e.titolo as libro_titolo, e.autore as libro_autore, e.isbn as libro_isbn,
      e.immagine_copertina, e.immagine_miniatura, e.stato_conservazione, e.stato_disponibilita as libro_stato_disponibilita,
      c.nome as categoria_nome, c.colore_hex as categoria_colore, c.icona as categoria_icona,
      CASE WHEN r.proprietario_id = $2 THEN 'PROPRIETARIO' ELSE 'RICHIEDENTE' END as ruolo,
      partner.id as partner_id, partner.nome as partner_nome,
      SUBSTRING(partner.cognome FROM 1 FOR 1) || '.' as partner_cognome_iniziale,
      pos.citta as partner_citta
    FROM richieste_prestito r
    JOIN esemplari e ON r.esemplare_id = e.id
    JOIN categorie c ON e.categoria_id = c.id
    JOIN utenti partner ON partner.id = CASE WHEN r.proprietario_id = $2 THEN r.richiedente_id ELSE r.proprietario_id END
    LEFT JOIN posizione_utenti pos ON partner.id = pos.utente_id
    WHERE r.id = $1
  `, [richiestaId, utenteId]);

  if (res.rows.length === 0) {
    const err = new Error('Prestito non trovato.');
    err.statusCode = 404;
    throw err;
  }

  const loan = res.rows[0];

  // Controllo autorizzazioni IDOR
  if (loan.richiedente_id !== utenteId && loan.proprietario_id !== utenteId) {
    const err = new Error('Non sei autorizzato a consultare questo prestito.');
    err.statusCode = 403;
    throw err;
  }

  return enrichLoanWithTemporalTracking(loan);
};

/**
 * Calcola indicatori sintetici sui prestiti per i cruscotti di visualizzazione
 */
const getMetrichePrestiti = async (utenteId) => {
  if (!isValidUUID(utenteId)) {
    const err = new Error('Identificativo utente non valido.');
    err.statusCode = 400;
    throw err;
  }

  const res = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE richiedente_id = $1 AND stato = 'IN_PRESTITO') as attivi_ricevuti,
      COUNT(*) FILTER (WHERE proprietario_id = $1 AND stato = 'IN_PRESTITO') as attivi_concessi,
      COUNT(*) FILTER (WHERE (richiedente_id = $1 OR proprietario_id = $1) AND stato = 'IN_PRESTITO' AND data_scadenza < NOW()) as in_ritardo,
      COUNT(*) FILTER (WHERE (richiedente_id = $1 OR proprietario_id = $1) AND stato = 'IN_PRESTITO' AND data_scadenza >= NOW() AND data_scadenza <= NOW() + INTERVAL '5 days') as in_scadenza,
      COUNT(*) FILTER (WHERE proprietario_id = $1 AND stato = 'IN_ATTESA') as richieste_pendenti_ricevute,
      COUNT(*) FILTER (WHERE (richiedente_id = $1 OR proprietario_id = $1) AND stato IN ('RESTITUITO', 'COMPLETATA')) as restituiti_totali
    FROM richieste_prestito
    WHERE richiedente_id = $1 OR proprietario_id = $1
  `, [utenteId]);

  const row = res.rows[0];

  return {
    attivi_ricevuti: parseInt(row.attivi_ricevuti, 10) || 0,
    attivi_concessi: parseInt(row.attivi_concessi, 10) || 0,
    in_ritardo: parseInt(row.in_ritardo, 10) || 0,
    in_scadenza: parseInt(row.in_scadenza, 10) || 0,
    richieste_pendenti_ricevute: parseInt(row.richieste_pendenti_ricevute, 10) || 0,
    restituiti_totali: parseInt(row.restituiti_totali, 10) || 0,
    totale_attivi: (parseInt(row.attivi_ricevuti, 10) || 0) + (parseInt(row.attivi_concessi, 10) || 0)
  };
};

module.exports = {
  creaRichiestaPrestito,
  accettaPrestito,
  confermaRestituzione,
  rifiutaPrestito,
  annullaPrestito,
  prorogaPrestito,
  getPrestitiUtente,
  getPrestitoDettaglio,
  getMetrichePrestiti,
  enrichLoanWithTemporalTracking
};
