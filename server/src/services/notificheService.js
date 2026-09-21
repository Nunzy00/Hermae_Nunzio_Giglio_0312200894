// Service per la gestione delle notifiche interne asincrone
// Conforme alla Fase 22
const db = require('../config/db');

// Verifica sintattica formato UUIDv4
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof str === 'string' && uuidRegex.test(str);
};

/**
 * Crea una notifica interna per un utente
 * @param {Object} params
 * @param {string} params.utente_id - Destinatario
 * @param {string} [params.richiesta_id] - Richiesta associata
 * @param {string} params.tipo - 'NUOVA_RICHIESTA', 'NUOVO_MESSAGGIO', 'RICHIESTA_ACCETTATA', 'RICHIESTA_RIFIUTATA', 'RICHIESTA_COMPLETATA', 'RICHIESTA_ANNULLATA'
 * @param {string} params.titolo - Titolo breve
 * @param {string} params.messaggio - Contenuto descrittivo
 */
const creaNotifica = async ({ utente_id, richiesta_id = null, tipo, titolo, messaggio }) => {
  if (!isValidUUID(utente_id)) {
    throw new Error('Identificativo utente non valido per la notifica');
  }

  const query = `
    INSERT INTO notifiche (utente_id, richiesta_id, tipo, titolo, messaggio)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, utente_id, richiesta_id, tipo, titolo, messaggio, letta, data_creazione
  `;

  const { rows } = await db.query(query, [utente_id, richiesta_id, tipo, titolo, messaggio]);
  return rows[0];
};

/**
 * Recupera l'elenco delle notifiche dell'utente con filtri e paginazione
 * @param {string} utente_id
 * @param {Object} options
 * @param {boolean} [options.soloNonLette=false]
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 */
const getNotificheUtente = async (utente_id, { soloNonLette = false, limit = 50, offset = 0 } = {}) => {
  if (!isValidUUID(utente_id)) {
    throw new Error('Identificativo utente non valido');
  }

  let filterClause = '';
  const values = [utente_id];

  if (soloNonLette) {
    filterClause = ' AND letta = FALSE';
  }

  values.push(Math.min(Math.max(parseInt(limit) || 50, 1), 100));
  values.push(Math.max(parseInt(offset) || 0, 0));

  const query = `
    SELECT id, utente_id, richiesta_id, tipo, titolo, messaggio, letta, data_creazione
    FROM notifiche
    WHERE utente_id = $1 ${filterClause}
    ORDER BY data_creazione DESC
    LIMIT $2 OFFSET $3
  `;

  const { rows } = await db.query(query, values);

  const countQuery = `
    SELECT 
      COUNT(*)::int as totale,
      COUNT(CASE WHEN letta = FALSE THEN 1 END)::int as non_lette
    FROM notifiche
    WHERE utente_id = $1
  `;
  const countRes = await db.query(countQuery, [utente_id]);

  return {
    notifiche: rows,
    totale: countRes.rows[0].totale,
    non_lette: countRes.rows[0].non_lette
  };
};

/**
 * Segna una specifica notifica come letta
 * @param {string} notifica_id
 * @param {string} utente_id
 */
const segnaNotificaLetta = async (notifica_id, utente_id) => {
  if (!isValidUUID(notifica_id) || !isValidUUID(utente_id)) {
    throw new Error('Identificativo non valido');
  }

  const query = `
    UPDATE notifiche
    SET letta = TRUE
    WHERE id = $1 AND utente_id = $2
    RETURNING id, letta
  `;

  const { rows } = await db.query(query, [notifica_id, utente_id]);
  if (rows.length === 0) {
    const notFoundErr = new Error('Notifica non trovata o non appartenente all\'utente');
    notFoundErr.code = 'NOTIFICATION_NOT_FOUND';
    throw notFoundErr;
  }

  return rows[0];
};

/**
 * Segna tutte le notifiche non lette dell'utente come lette
 * @param {string} utente_id
 */
const segnaTutteLette = async (utente_id) => {
  if (!isValidUUID(utente_id)) {
    throw new Error('Identificativo utente non valido');
  }

  const query = `
    UPDATE notifiche
    SET letta = TRUE
    WHERE utente_id = $1 AND letta = FALSE
    RETURNING id
  `;

  const { rowCount } = await db.query(query, [utente_id]);
  return { aggiornate: rowCount };
};

/**
 * Restituisce il conteggio delle notifiche non lette dell'utente
 * @param {string} utente_id
 */
const getConteggioNonLette = async (utente_id) => {
  if (!isValidUUID(utente_id)) {
    throw new Error('Identificativo utente non valido');
  }

  const query = `
    SELECT COUNT(*)::int as non_lette
    FROM notifiche
    WHERE utente_id = $1 AND letta = FALSE
  `;

  const { rows } = await db.query(query, [utente_id]);
  return rows[0].non_lette;
};

module.exports = {
  creaNotifica,
  getNotificheUtente,
  segnaNotificaLetta,
  segnaTutteLette,
  getConteggioNonLette
};
