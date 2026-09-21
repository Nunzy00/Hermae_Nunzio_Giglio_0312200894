// Service per la gestione delle richieste di contatto/prestito e messaggistica interna
// Conforme alla Fase 22
const db = require('../config/db');
const privacyShieldService = require('./privacyShieldService');
const notificheService = require('./notificheService');

// Verifica sintattica formato UUIDv4
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof str === 'string' && uuidRegex.test(str);
};

/**
 * Crea una nuova richiesta di contatto/scambio per un esemplare disponibile
 * @param {Object} params
 * @param {string} params.esemplare_id - UUID del volume richiesto
 * @param {string} params.richiedente_id - UUID dell'utente che avvia il contatto
 * @param {string} params.messaggio_iniziale - Testo del messaggio introduttivo
 */
const creaRichiestaContatto = async ({ esemplare_id, richiedente_id, messaggio_iniziale }) => {
  if (!isValidUUID(esemplare_id) || !isValidUUID(richiedente_id)) {
    const err = new Error('Identificativi forniti non validi');
    err.code = 'INVALID_UUID';
    err.status = 400;
    throw err;
  }

  const testoGrezzo = (messaggio_iniziale || '').trim();
  if (testoGrezzo.length < 5 || testoGrezzo.length > 1000) {
    const err = new Error('Il messaggio iniziale deve contenere tra 5 e 1000 caratteri');
    err.code = 'INVALID_MESSAGE_LENGTH';
    err.status = 400;
    throw err;
  }

  // 1. Controllo rate-limiting antispam: max 5 richieste in 15 minuti
  const rateLimit = privacyShieldService.checkRateLimit(richiedente_id, 5, 15);
  if (!rateLimit.consentito) {
    const err = new Error(`Limite richieste antispam raggiunto. Attendi ${rateLimit.secondiAttesa} secondi prima di inviare un nuovo contatto.`);
    err.code = 'RATE_LIMIT_EXCEEDED';
    err.status = 429;
    throw err;
  }

  // 2. Recupera informazioni sull'esemplare e sul relativo proprietario
  const bookQuery = `
    SELECT 
      e.id, e.utente_id as proprietario_id, e.titolo, e.autore, e.stato_disponibilita, e.visibile_pubblico,
      u.nome as proprietario_nome, u.cognome as proprietario_cognome,
      COALESCE(priv.consenti_messaggi_diretti, TRUE) as consenti_messaggi_diretti,
      COALESCE(priv.mostra_libreria, TRUE) as mostra_libreria
    FROM esemplari e
    JOIN utenti u ON e.utente_id = u.id
    LEFT JOIN preferenze_privacy_utenti priv ON u.id = priv.utente_id
    WHERE e.id = $1
  `;
  const bookRes = await db.query(bookQuery, [esemplare_id]);

  if (bookRes.rows.length === 0 || !bookRes.rows[0].visibile_pubblico || !bookRes.rows[0].mostra_libreria) {
    const err = new Error('Il volume richiesto non è disponibile o è riservato');
    err.code = 'BOOK_NOT_AVAILABLE';
    err.status = 404;
    throw err;
  }

  const book = bookRes.rows[0];

  if (book.stato_disponibilita !== 'DISPONIBILE') {
    const err = new Error('Il volume non risulta attualmente disponibile allo scambio');
    err.code = 'BOOK_UNAVAILABLE';
    err.status = 400;
    throw err;
  }

  // 3. Verifica auto-contatto: un utente non può contattare se stesso
  if (book.proprietario_id === richiedente_id) {
    const err = new Error('Non è consentito inviare una richiesta di contatto per un libro di propria appartenenza');
    err.code = 'CANNOT_REQUEST_OWN_BOOK';
    err.status = 400;
    throw err;
  }

  // 4. Verifica preferenze di privacy del proprietario: consenti_messaggi_diretti
  if (!book.consenti_messaggi_diretti) {
    const err = new Error('Il lettore proprietario del volume ha disabilitato la ricezione di messaggi diretti');
    err.code = 'DIRECT_MESSAGES_DISABLED';
    err.status = 403;
    throw err;
  }

  // 5. Verifica richieste attive duplicate pendenti tra gli stessi utenti per questo libro
  const dupQuery = `
    SELECT id, stato
    FROM richieste_prestito
    WHERE esemplare_id = $1 AND richiedente_id = $2 AND stato IN ('IN_ATTESA', 'ACCETTATA')
  `;
  const dupRes = await db.query(dupQuery, [esemplare_id, richiedente_id]);
  if (dupRes.rows.length > 0) {
    const err = new Error('Esiste già una richiesta di contatto attiva per questo volume con lo stato: ' + dupRes.rows[0].stato);
    err.code = 'DUPLICATE_ACTIVE_REQUEST';
    err.status = 400;
    throw err;
  }

  // 6. Recupera dati del richiedente per la notifica
  const reqUserQuery = `SELECT nome, cognome FROM utenti WHERE id = $1`;
  const reqUserRes = await db.query(reqUserQuery, [richiedente_id]);
  const reqUser = reqUserRes.rows[0] || { nome: 'Un lettore', cognome: '' };
  const reqUserDisplay = `${reqUser.nome} ${reqUser.cognome ? reqUser.cognome[0] + '.' : ''}`.trim();

  // 7. Sanificazione e Schermatura Preventiva Privacy (Email e Numeri di Telefono)
  const shieldResult = privacyShieldService.sanitizeMessage(testoGrezzo);
  const testoSanificato = shieldResult.testoSanificato;

  // 8. Esecuzione transazione DB per inserire richiesta, messaggio iniziale e notifica
  const client = await db.getClient ? await db.getClient() : db;
  let useTx = typeof client.query === 'function';

  try {
    if (client.connect) await client.query('BEGIN');

    // Inserisce record richiesta
    const insertReqQuery = `
      INSERT INTO richieste_prestito (esemplare_id, richiedente_id, proprietario_id, stato, messaggio_iniziale)
      VALUES ($1, $2, $3, 'IN_ATTESA', $4)
      RETURNING id, esemplare_id, richiedente_id, proprietario_id, stato, messaggio_iniziale, data_richiesta, data_aggiornamento
    `;
    const reqInsertRes = await client.query(insertReqQuery, [
      esemplare_id,
      richiedente_id,
      book.proprietario_id,
      testoSanificato
    ]);
    const nuovaRichiesta = reqInsertRes.rows[0];

    // Inserisce primo messaggio nella chat
    const insertMsgQuery = `
      INSERT INTO messaggi_chat (richiesta_id, mittente_id, testo, letto)
      VALUES ($1, $2, $3, FALSE)
      RETURNING id, richiesta_id, mittente_id, testo, letto, data_invio
    `;
    const msgInsertRes = await client.query(insertMsgQuery, [
      nuovaRichiesta.id,
      richiedente_id,
      testoSanificato
    ]);
    const primoMessaggio = msgInsertRes.rows[0];

    // Crea notifica interna per il proprietario
    const insertNotifQuery = `
      INSERT INTO notifiche (utente_id, richiesta_id, tipo, titolo, messaggio)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    await client.query(insertNotifQuery, [
      book.proprietario_id,
      nuovaRichiesta.id,
      'NUOVA_RICHIESTA',
      'Nuova richiesta di contatto',
      `${reqUserDisplay} è interessato al tuo libro "${book.titolo}" e ti ha inviato un messaggio.`
    ]);

    if (client.connect) await client.query('COMMIT');

    return {
      richiesta: nuovaRichiesta,
      primo_messaggio: primoMessaggio,
      libro: {
        id: book.id,
        titolo: book.titolo,
        autore: book.autore
      },
      schermatura_applicata: shieldResult.schermaturaApplicata,
      avviso_privacy: shieldResult.schermaturaApplicata
        ? 'Per la tua tutela, eventuali recapiti diretti (email/telefono) sono stati schermati automaticamente.'
        : null
    };
  } catch (txErr) {
    if (client.connect) await client.query('ROLLBACK');
    throw txErr;
  } finally {
    if (client.release) client.release();
  }
};

/**
 * Recupera l'elenco dei thread di contatto dell'utente autenticato
 * @param {string} utente_id
 * @param {Object} [filtri]
 * @param {string} [filtri.ruolo='tutti'] - 'ricevute', 'inviate', 'tutti'
 * @param {string} [filtri.stato] - 'IN_ATTESA', 'ACCETTATA', 'RIFIUTATA', 'COMPLETATA', 'ANNULLATA'
 */
const getRichiesteUtente = async (utente_id, { ruolo = 'tutti', stato = null } = {}) => {
  if (!isValidUUID(utente_id)) {
    const err = new Error('Identificativo utente non valido');
    err.code = 'INVALID_UUID';
    err.status = 400;
    throw err;
  }

  const conditions = [];
  const values = [utente_id];
  let paramIdx = 2;

  if (ruolo === 'ricevute') {
    conditions.push('r.proprietario_id = $1');
  } else if (ruolo === 'inviate') {
    conditions.push('r.richiedente_id = $1');
  } else {
    conditions.push('(r.proprietario_id = $1 OR r.richiedente_id = $1)');
  }

  if (stato && typeof stato === 'string') {
    conditions.push(`r.stato = $${paramIdx}`);
    values.push(stato.toUpperCase());
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT 
      r.id,
      r.esemplare_id,
      r.richiedente_id,
      r.proprietario_id,
      r.stato,
      r.messaggio_iniziale,
      r.data_richiesta,
      r.data_aggiornamento,
      -- Dati Libro
      e.titolo as libro_titolo,
      e.autore as libro_autore,
      e.immagine_copertina as libro_copertina,
      e.immagine_miniatura as libro_miniatura,
      c.nome as categoria_nome,
      c.colore_hex as categoria_colore,
      c.icona as categoria_icona,
      -- Dati Richiedente
      u_rich.nome as richiedente_nome,
      u_rich.cognome as richiedente_cognome,
      u_rich.citta as richiedente_citta,
      -- Dati Proprietario
      u_prop.nome as proprietario_nome,
      u_prop.cognome as proprietario_cognome,
      u_prop.citta as proprietario_citta,
      -- Conteggio messaggi non letti per l'utente corrente
      (
        SELECT COUNT(*)::int
        FROM messaggi_chat mc
        WHERE mc.richiesta_id = r.id AND mc.mittente_id != $1 AND mc.letto = FALSE
      ) as messaggi_non_letti,
      -- Ultimo messaggio del thread
      (
        SELECT mc.testo
        FROM messaggi_chat mc
        WHERE mc.richiesta_id = r.id
        ORDER BY mc.data_invio DESC
        LIMIT 1
      ) as ultimo_messaggio_testo,
      (
        SELECT mc.data_invio
        FROM messaggi_chat mc
        WHERE mc.richiesta_id = r.id
        ORDER BY mc.data_invio DESC
        LIMIT 1
      ) as ultimo_messaggio_data
    FROM richieste_prestito r
    JOIN esemplari e ON r.esemplare_id = e.id
    JOIN categorie c ON e.categoria_id = c.id
    JOIN utenti u_rich ON r.richiedente_id = u_rich.id
    JOIN utenti u_prop ON r.proprietario_id = u_prop.id
    ${whereClause}
    ORDER BY COALESCE(
      (SELECT mc.data_invio FROM messaggi_chat mc WHERE mc.richiesta_id = r.id ORDER BY mc.data_invio DESC LIMIT 1),
      r.data_aggiornamento,
      r.data_richiesta
    ) DESC
  `;

  const { rows } = await db.query(query, values);

  return rows.map((r) => {
    const isOwner = r.proprietario_id === utente_id;
    const counterpart = isOwner
      ? {
          id: r.richiedente_id,
          nome: r.richiedente_nome,
          cognome_iniziale: r.richiedente_cognome ? r.richiedente_cognome[0] + '.' : '',
          citta: r.richiedente_citta,
          ruolo: 'Richiedente'
        }
      : {
          id: r.proprietario_id,
          nome: r.proprietario_nome,
          cognome_iniziale: r.proprietario_cognome ? r.proprietario_cognome[0] + '.' : '',
          citta: r.proprietario_citta,
          ruolo: 'Proprietario'
        };

    return {
      id: r.id,
      esemplare_id: r.esemplare_id,
      stato: r.stato,
      data_richiesta: r.data_richiesta,
      data_aggiornamento: r.data_aggiornamento,
      ruolo_utente: isOwner ? 'PROPRIETARIO' : 'RICHIEDENTE',
      libro: {
        id: r.esemplare_id,
        titolo: r.libro_titolo,
        autore: r.libro_autore,
        copertina: r.libro_copertina,
        miniatura: r.libro_miniatura,
        categoria_nome: r.categoria_nome,
        categoria_colore: r.categoria_colore,
        categoria_icona: r.categoria_icona
      },
      controparte: counterpart,
      messaggi_non_letti: r.messaggi_non_letti,
      ultimo_messaggio: {
        testo: r.ultimo_messaggio_testo || r.messaggio_iniziale,
        data: r.ultimo_messaggio_data || r.data_richiesta
      }
    };
  });
};

/**
 * Recupera il dettaglio completo di una richiesta con cronologia dei messaggi
 * e marca automaticamente i messaggi non letti come letti
 * @param {string} richiesta_id
 * @param {string} utente_id
 */
const getRichiestaById = async (richiesta_id, utente_id) => {
  if (!isValidUUID(richiesta_id) || !isValidUUID(utente_id)) {
    const err = new Error('Identificativo richiesta non valido');
    err.code = 'INVALID_UUID';
    err.status = 400;
    throw err;
  }

  const reqQuery = `
    SELECT 
      r.id,
      r.esemplare_id,
      r.richiedente_id,
      r.proprietario_id,
      r.stato,
      r.messaggio_iniziale,
      r.data_richiesta,
      r.data_aggiornamento,
      -- Dati Libro
      e.titolo as libro_titolo,
      e.autore as libro_autore,
      e.anno_pubblicazione as libro_anno,
      e.immagine_copertina as libro_copertina,
      e.immagine_miniatura as libro_miniatura,
      e.stato_conservazione as libro_stato_conservazione,
      c.nome as categoria_nome,
      c.colore_hex as categoria_colore,
      c.icona as categoria_icona,
      -- Dati Richiedente
      u_rich.nome as richiedente_nome,
      u_rich.cognome as richiedente_cognome,
      u_rich.citta as richiedente_citta,
      -- Dati Proprietario
      u_prop.nome as proprietario_nome,
      u_prop.cognome as proprietario_cognome,
      u_prop.citta as proprietario_citta
    FROM richieste_prestito r
    JOIN esemplari e ON r.esemplare_id = e.id
    JOIN categorie c ON e.categoria_id = c.id
    JOIN utenti u_rich ON r.richiedente_id = u_rich.id
    JOIN utenti u_prop ON r.proprietario_id = u_prop.id
    WHERE r.id = $1
  `;
  const { rows } = await db.query(reqQuery, [richiesta_id]);

  if (rows.length === 0) {
    const err = new Error('Richiesta non trovata');
    err.code = 'REQUEST_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const r = rows[0];

  // Controllo autorizzativo: l'utente deve essere richiedente o proprietario
  if (r.richiedente_id !== utente_id && r.proprietario_id !== utente_id) {
    const err = new Error('Non sei autorizzato ad accedere a questo thread di conversazione');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  // Aggiorna come letti tutti i messaggi indirizzati all'utente corrente in questa richiesta
  await db.query(
    `UPDATE messaggi_chat SET letto = TRUE WHERE richiesta_id = $1 AND mittente_id != $2 AND letto = FALSE`,
    [richiesta_id, utente_id]
  );

  // Recupera la sequenza cronologica di tutti i messaggi
  const msgQuery = `
    SELECT 
      m.id,
      m.richiesta_id,
      m.mittente_id,
      m.testo,
      m.letto,
      m.data_invio,
      u.nome as mittente_nome,
      u.cognome as mittente_cognome
    FROM messaggi_chat m
    JOIN utenti u ON m.mittente_id = u.id
    WHERE m.richiesta_id = $1
    ORDER BY m.data_invio ASC
  `;
  const msgRes = await db.query(msgQuery, [richiesta_id]);

  const isOwner = r.proprietario_id === utente_id;
  const counterpart = isOwner
    ? {
        id: r.richiedente_id,
        nome: r.richiedente_nome,
        cognome_iniziale: r.richiedente_cognome ? r.richiedente_cognome[0] + '.' : '',
        citta: r.richiedente_citta,
        ruolo: 'Richiedente'
      }
    : {
        id: r.proprietario_id,
        nome: r.proprietario_nome,
        cognome_iniziale: r.proprietario_cognome ? r.proprietario_cognome[0] + '.' : '',
        citta: r.proprietario_citta,
        ruolo: 'Proprietario'
      };

  return {
    id: r.id,
    esemplare_id: r.esemplare_id,
    stato: r.stato,
    data_richiesta: r.data_richiesta,
    data_aggiornamento: r.data_aggiornamento,
    ruolo_utente: isOwner ? 'PROPRIETARIO' : 'RICHIEDENTE',
    libro: {
      id: r.esemplare_id,
      titolo: r.libro_titolo,
      autore: r.libro_autore,
      anno: r.libro_anno,
      copertina: r.libro_copertina,
      miniatura: r.libro_miniatura,
      stato_conservazione: r.libro_stato_conservazione,
      categoria_nome: r.categoria_nome,
      categoria_colore: r.categoria_colore,
      categoria_icona: r.categoria_icona
    },
    controparte: counterpart,
    messaggi: msgRes.rows.map(m => ({
      id: m.id,
      mittente_id: m.mittente_id,
      e_mio: m.mittente_id === utente_id,
      mittente_nome: m.mittente_nome,
      mittente_iniziale: m.mittente_cognome ? m.mittente_cognome[0] + '.' : '',
      testo: m.testo,
      letto: m.letto,
      data_invio: m.data_invio
    }))
  };
};

/**
 * Invia un nuovo messaggio all'interno di un thread di contatto attivo
 * @param {Object} params
 * @param {string} params.richiesta_id
 * @param {string} params.mittente_id
 * @param {string} params.testo
 */
const inviaMessaggio = async ({ richiesta_id, mittente_id, testo }) => {
  if (!isValidUUID(richiesta_id) || !isValidUUID(mittente_id)) {
    const err = new Error('Identificativi non validi');
    err.code = 'INVALID_UUID';
    err.status = 400;
    throw err;
  }

  const testoGrezzo = (testo || '').trim();
  if (testoGrezzo.length < 1 || testoGrezzo.length > 1000) {
    const err = new Error('Il messaggio deve contenere tra 1 e 1000 caratteri');
    err.code = 'INVALID_MESSAGE_LENGTH';
    err.status = 400;
    throw err;
  }

  // Verifica che la richiesta esista e che il mittente sia partecipante autorizzato
  const reqQuery = `
    SELECT 
      r.id, r.richiedente_id, r.proprietario_id, r.stato,
      e.titolo as libro_titolo,
      u.nome as mittente_nome, u.cognome as mittente_cognome
    FROM richieste_prestito r
    JOIN esemplari e ON r.esemplare_id = e.id
    JOIN utenti u ON u.id = $2
    WHERE r.id = $1
  `;
  const { rows } = await db.query(reqQuery, [richiesta_id, mittente_id]);

  if (rows.length === 0) {
    const err = new Error('Richiesta di contatto non trovata');
    err.code = 'REQUEST_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const r = rows[0];

  if (r.richiedente_id !== mittente_id && r.proprietario_id !== mittente_id) {
    const err = new Error('Non sei autorizzato a inviare messaggi in questo thread');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  // È consentito inviare messaggi solo su richieste IN_ATTESA o ACCETTATA
  if (!['IN_ATTESA', 'ACCETTATA'].includes(r.stato)) {
    const err = new Error(`Impossibile inviare messaggi su una richiesta con stato: ${r.stato}`);
    err.code = 'REQUEST_CLOSED';
    err.status = 400;
    throw err;
  }

  // Sanificazione preventiva dei recapiti personali (Email / Telefono)
  const shield = privacyShieldService.sanitizeMessage(testoGrezzo);
  const testoSanificato = shield.testoSanificato;

  // Inserisce il messaggio nel database
  const insertQuery = `
    INSERT INTO messaggi_chat (richiesta_id, mittente_id, testo, letto)
    VALUES ($1, $2, $3, FALSE)
    RETURNING id, richiesta_id, mittente_id, testo, letto, data_invio
  `;
  const msgRes = await db.query(insertQuery, [richiesta_id, mittente_id, testoSanificato]);
  const nuovoMessaggio = msgRes.rows[0];

  // Aggiorna data_aggiornamento nella richiesta
  await db.query(`UPDATE richieste_prestito SET data_aggiornamento = CURRENT_TIMESTAMP WHERE id = $1`, [richiesta_id]);

  // Crea la notifica per il destinatario (la controparte del thread)
  const destinatarioId = (mittente_id === r.richiedente_id) ? r.proprietario_id : r.richiedente_id;
  const mittenteDisplay = `${r.mittente_nome} ${r.mittente_cognome ? r.mittente_cognome[0] + '.' : ''}`.trim();

  await notificheService.creaNotifica({
    utente_id: destinatarioId,
    richiesta_id: r.id,
    tipo: 'NUOVO_MESSAGGIO',
    titolo: 'Nuovo messaggio ricevuto',
    messaggio: `${mittenteDisplay} ti ha scritto a proposito di "${r.libro_titolo}".`
  });

  return {
    messaggio: {
      ...nuovoMessaggio,
      e_mio: true,
      mittente_nome: r.mittente_nome,
      mittente_iniziale: r.mittente_cognome ? r.mittente_cognome[0] + '.' : ''
    },
    schermatura_applicata: shield.schermaturaApplicata,
    avviso_privacy: shield.schermaturaApplicata
      ? 'Per la tua tutela, eventuali recapiti diretti (email/telefono) sono stati schermati automaticamente.'
      : null
  };
};

/**
 * Aggiorna lo stato di una richiesta (es. ACCETTATA, RIFIUTATA, COMPLETATA, ANNULLATA)
 * con verifica dei ruoli e notifica alla controparte
 * @param {Object} params
 * @param {string} params.richiesta_id
 * @param {string} params.utente_id
 * @param {string} params.nuovo_stato
 */
const aggiornaStatoRichiesta = async ({ richiesta_id, utente_id, nuovo_stato }) => {
  if (!isValidUUID(richiesta_id) || !isValidUUID(utente_id)) {
    const err = new Error('Identificativi non validi');
    err.code = 'INVALID_UUID';
    err.status = 400;
    throw err;
  }

  const statoPulito = (nuovo_stato || '').trim().toUpperCase();
  const statiValidi = ['ACCETTATA', 'RIFIUTATA', 'COMPLETATA', 'ANNULLATA'];
  if (!statiValidi.includes(statoPulito)) {
    const err = new Error(`Stato non valido. Valori ammessi: ${statiValidi.join(', ')}`);
    err.code = 'INVALID_STATUS';
    err.status = 400;
    throw err;
  }

  const reqQuery = `
    SELECT 
      r.id, r.esemplare_id, r.richiedente_id, r.proprietario_id, r.stato,
      e.titolo as libro_titolo,
      u.nome as utente_nome, u.cognome as utente_cognome
    FROM richieste_prestito r
    JOIN esemplari e ON r.esemplare_id = e.id
    JOIN utenti u ON u.id = $2
    WHERE r.id = $1
  `;
  const { rows } = await db.query(reqQuery, [richiesta_id, utente_id]);

  if (rows.length === 0) {
    const err = new Error('Richiesta non trovata');
    err.code = 'REQUEST_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const r = rows[0];
  const isOwner = r.proprietario_id === utente_id;
  const isRequester = r.richiedente_id === utente_id;

  if (!isOwner && !isRequester) {
    const err = new Error('Non sei autorizzato a modificare lo stato di questa richiesta');
    err.code = 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  // Verifica regole di transizione di stato
  if (isOwner) {
    // Il proprietario può ACCETTARE o RIFIUTARE solo se IN_ATTESA
    if (['ACCETTATA', 'RIFIUTATA'].includes(statoPulito) && r.stato !== 'IN_ATTESA') {
      const err = new Error(`Il proprietario può accettare o rifiutare solo richieste con stato 'IN_ATTESA' (stato attuale: ${r.stato})`);
      err.code = 'INVALID_STATUS_TRANSITION';
      err.status = 400;
      throw err;
    }
    // Il proprietario può completare solo se ACCETTATA
    if (statoPulito === 'COMPLETATA' && r.stato !== 'ACCETTATA') {
      const err = new Error(`È possibile completare solo una richiesta precedentemente accettata (stato attuale: ${r.stato})`);
      err.code = 'INVALID_STATUS_TRANSITION';
      err.status = 400;
      throw err;
    }
  } else if (isRequester) {
    // Il richiedente può ANNULLARE solo se IN_ATTESA
    if (statoPulito === 'ANNULLATA' && r.stato !== 'IN_ATTESA') {
      const err = new Error(`Il richiedente può annullare solo richieste con stato 'IN_ATTESA' (stato attuale: ${r.stato})`);
      err.code = 'INVALID_STATUS_TRANSITION';
      err.status = 400;
      throw err;
    }
    // Il richiedente può completare solo se ACCETTATA
    if (statoPulito === 'COMPLETATA' && r.stato !== 'ACCETTATA') {
      const err = new Error(`È possibile completare solo una richiesta precedentemente accettata (stato attuale: ${r.stato})`);
      err.code = 'INVALID_STATUS_TRANSITION';
      err.status = 400;
      throw err;
    }
    if (['ACCETTATA', 'RIFIUTATA'].includes(statoPulito)) {
      const err = new Error('Solo il proprietario del libro può accettare o rifiutare la richiesta');
      err.code = 'FORBIDDEN';
      err.status = 403;
      throw err;
    }
  }

  // Aggiorna lo stato nel database
  const updateQuery = `
    UPDATE richieste_prestito
    SET stato = $1, data_aggiornamento = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, esemplare_id, richiedente_id, proprietario_id, stato, data_aggiornamento
  `;
  const updateRes = await db.query(updateQuery, [statoPulito, richiesta_id]);
  const richiestaAggiornata = updateRes.rows[0];

  // Invia notifica di stato alla controparte
  const destinatarioId = isOwner ? r.richiedente_id : r.proprietario_id;
  const utenteDisplay = `${r.utente_nome} ${r.utente_cognome ? r.utente_cognome[0] + '.' : ''}`.trim();

  let titoloNotifica = 'Aggiornamento richiesta di scambio';
  let testoNotifica = `La richiesta per "${r.libro_titolo}" è passata allo stato: ${statoPulito}.`;

  if (statoPulito === 'ACCETTATA') {
    titoloNotifica = 'Richiesta Accettata!';
    testoNotifica = `${utenteDisplay} ha accettato la tua richiesta per "${r.libro_titolo}". Potete concordare i dettagli dello scambio nella chat!`;
  } else if (statoPulito === 'RIFIUTATA') {
    titoloNotifica = 'Richiesta Rifiutata';
    testoNotifica = `${utenteDisplay} ha declinato la richiesta per "${r.libro_titolo}".`;
  } else if (statoPulito === 'COMPLETATA') {
    titoloNotifica = 'Scambio Concluso con Successo';
    testoNotifica = `Lo scambio per "${r.libro_titolo}" è stato contrassegnato come completato!`;
  } else if (statoPulito === 'ANNULLATA') {
    titoloNotifica = 'Richiesta Annullata';
    testoNotifica = `${utenteDisplay} ha annullato la richiesta per "${r.libro_titolo}".`;
  }

  await notificheService.creaNotifica({
    utente_id: destinatarioId,
    richiesta_id: r.id,
    tipo: `RICHIESTA_${statoPulito}`,
    titolo: titoloNotifica,
    messaggio: testoNotifica
  });

  return richiestaAggiornata;
};

module.exports = {
  creaRichiestaContatto,
  getRichiesteUtente,
  getRichiestaById,
  inviaMessaggio,
  aggiornaStatoRichiesta
};
