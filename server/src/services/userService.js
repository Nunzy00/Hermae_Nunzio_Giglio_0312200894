// Modulo di servizio per la gestione della persistenza e delle operazioni CRUD sull'entità utenti
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

// Converte una stringa o oggetto geometrico POINT di PostgreSQL in un oggetto con coordinate numeriche lng e lat
const parsePoint = (pt) => {
  if (!pt) return null;
  if (typeof pt === 'object' && pt.x !== undefined && pt.y !== undefined) {
    return { lng: Number(pt.x), lat: Number(pt.y) };
  }
  if (typeof pt === 'string') {
    const parts = pt.replace(/[()]/g, '').split(',');
    return { lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
  }
  return null;
};

// Genera coordinate offuscate introducendo uno spostamento casuale controllato di 300-500 metri per la privacy GDPR
const generateBlurredCoordinates = (lng, lat) => {
  const deltaLat = (Math.random() * 0.003 + 0.002) * (Math.random() < 0.5 ? -1 : 1);
  const deltaLng = (Math.random() * 0.003 + 0.002) * (Math.random() < 0.5 ? -1 : 1);
  return {
    lng: parseFloat((lng + deltaLng).toFixed(6)),
    lat: parseFloat((lat + deltaLat).toFixed(6))
  };
};

// Formatta un record utente proveniente dal database ripulendo le credenziali ed elaborando i tipi geometrici
const formatUserRow = (row, includePassword = false) => {
  if (!row) return null;
  const user = {
    id: row.id,
    email: row.email,
    nome: row.nome,
    cognome: row.cognome,
    citta: row.citta,
    coordinate_reali: parsePoint(row.coordinate_reali),
    coordinate_offuscate: parsePoint(row.coordinate_offuscate),
    consenso_privacy: row.consenso_privacy,
    consenso_geo: row.consenso_geo,
    data_registrazione: row.data_registrazione
  };

  if (includePassword && row.password_hash) {
    user.password_hash = row.password_hash;
  }

  return user;
};

// Inserisce un nuovo utente nel database con password cifrata tramite bcrypt e coordinate WGS 84
const createUser = async (userData) => {
  const {
    email,
    password,
    nome,
    cognome,
    citta,
    coordinate_reali,
    coordinate_offuscate,
    consenso_privacy,
    consenso_geo
  } = userData;

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const realLng = coordinate_reali.lng !== undefined ? coordinate_reali.lng : coordinate_reali[0];
  const realLat = coordinate_reali.lat !== undefined ? coordinate_reali.lat : coordinate_reali[1];

  let offLng;
  let offLat;

  if (coordinate_offuscate) {
    offLng = coordinate_offuscate.lng !== undefined ? coordinate_offuscate.lng : coordinate_offuscate[0];
    offLat = coordinate_offuscate.lat !== undefined ? coordinate_offuscate.lat : coordinate_offuscate[1];
  } else {
    const blurred = generateBlurredCoordinates(realLng, realLat);
    offLng = blurred.lng;
    offLat = blurred.lat;
  }

  const sql = `
    INSERT INTO utenti (
      email, password_hash, nome, cognome, citta,
      coordinate_reali, coordinate_offuscate,
      consenso_privacy, consenso_geo
    ) VALUES (
      $1, $2, $3, $4, $5,
      point($6, $7), point($8, $9),
      $10, $11
    )
    RETURNING id, email, nome, cognome, citta,
              coordinate_reali, coordinate_offuscate,
              consenso_privacy, consenso_geo, data_registrazione;
  `;

  try {
    const res = await query(sql, [
      email.toLowerCase().trim(),
      passwordHash,
      nome.trim(),
      cognome.trim(),
      citta.trim(),
      realLng,
      realLat,
      offLng,
      offLat,
      Boolean(consenso_privacy),
      Boolean(consenso_geo)
    ]);

    return formatUserRow(res.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      const error = new Error(`L'indirizzo email '${email}' risulta già registrato nel sistema.`);
      error.statusCode = 409;
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }
    throw err;
  }
};

// Recupera un profilo utente per identificatore univoco globale UUID omettendo i dati sensibili
const getUserById = async (id) => {
  const sql = `
    SELECT id, email, nome, cognome, citta,
           coordinate_reali, coordinate_offuscate,
           consenso_privacy, consenso_geo, data_registrazione
    FROM utenti
    WHERE id = $1;
  `;
  const res = await query(sql, [id]);
  return res.rows.length ? formatUserRow(res.rows[0]) : null;
};

// Cerca un utente tramite indirizzo email con facoltà di includere l'hash della password per l'autenticazione
const getUserByEmail = async (email, includePassword = false) => {
  const sql = `
    SELECT id, email, password_hash, nome, cognome, citta,
           coordinate_reali, coordinate_offuscate,
           consenso_privacy, consenso_geo, data_registrazione
    FROM utenti
    WHERE LOWER(email) = LOWER($1);
  `;
  const res = await query(sql, [email.trim()]);
  return res.rows.length ? formatUserRow(res.rows[0], includePassword) : null;
};

// Estrae l'elenco paginato degli utenti registrati con filtro opzionale sulla città di residenza
const getAllUsers = async ({ limit = 20, offset = 0, citta = null } = {}) => {
  const params = [];
  let whereClause = '';

  if (citta) {
    params.push(`%${citta.trim()}%`);
    whereClause = `WHERE citta ILIKE $${params.length}`;
  }

  const countSql = `SELECT count(*) as total FROM utenti ${whereClause};`;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0].total, 10);

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const sql = `
    SELECT id, email, nome, cognome, citta,
           coordinate_offuscate, data_registrazione
    FROM utenti
    ${whereClause}
    ORDER BY data_registrazione DESC
    LIMIT ${limitParam} OFFSET ${offsetParam};
  `;

  const res = await query(sql, params);

  return {
    total,
    limit,
    offset,
    users: res.rows.map((r) => formatUserRow(r))
  };
};

// Aggiorna selettivamente i campi anagrafici, territoriali o di credenziali di un utente esistente
const updateUser = async (id, updateData) => {
  const existing = await getUserById(id);
  if (!existing) {
    const error = new Error(`Nessun utente trovato con ID: ${id}`);
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updateData.nome !== undefined) {
    fields.push(`nome = $${paramIndex++}`);
    values.push(updateData.nome.trim());
  }

  if (updateData.cognome !== undefined) {
    fields.push(`cognome = $${paramIndex++}`);
    values.push(updateData.cognome.trim());
  }

  if (updateData.citta !== undefined) {
    fields.push(`citta = $${paramIndex++}`);
    values.push(updateData.citta.trim());
  }

  if (updateData.consenso_privacy !== undefined) {
    fields.push(`consenso_privacy = $${paramIndex++}`);
    values.push(Boolean(updateData.consenso_privacy));
  }

  if (updateData.consenso_geo !== undefined) {
    fields.push(`consenso_geo = $${paramIndex++}`);
    values.push(Boolean(updateData.consenso_geo));
  }

  if (updateData.coordinate_reali !== undefined) {
    const realLng = updateData.coordinate_reali.lng !== undefined ? updateData.coordinate_reali.lng : updateData.coordinate_reali[0];
    const realLat = updateData.coordinate_reali.lat !== undefined ? updateData.coordinate_reali.lat : updateData.coordinate_reali[1];
    fields.push(`coordinate_reali = point($${paramIndex++}, $${paramIndex++})`);
    values.push(realLng, realLat);

    let offLng;
    let offLat;
    if (updateData.coordinate_offuscate) {
      offLng = updateData.coordinate_offuscate.lng !== undefined ? updateData.coordinate_offuscate.lng : updateData.coordinate_offuscate[0];
      offLat = updateData.coordinate_offuscate.lat !== undefined ? updateData.coordinate_offuscate.lat : updateData.coordinate_offuscate[1];
    } else {
      const blurred = generateBlurredCoordinates(realLng, realLat);
      offLng = blurred.lng;
      offLat = blurred.lat;
    }
    fields.push(`coordinate_offuscate = point($${paramIndex++}, $${paramIndex++})`);
    values.push(offLng, offLat);
  }

  if (updateData.password !== undefined && updateData.password.trim() !== '') {
    const passwordHash = await bcrypt.hash(updateData.password, 12);
    fields.push(`password_hash = $${paramIndex++}`);
    values.push(passwordHash);
  }

  if (fields.length === 0) {
    return existing;
  }

  values.push(id);
  const sql = `
    UPDATE utenti
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, email, nome, cognome, citta,
              coordinate_reali, coordinate_offuscate,
              consenso_privacy, consenso_geo, data_registrazione;
  `;

  const res = await query(sql, values);
  return formatUserRow(res.rows[0]);
};

// Elimina definitivamente un utente dal database attivando le politiche di cancellazione a cascata
const deleteUser = async (id) => {
  const existing = await getUserById(id);
  if (!existing) {
    const error = new Error(`Nessun utente trovato con ID: ${id}`);
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const sql = `DELETE FROM utenti WHERE id = $1 RETURNING id, email, nome, cognome;`;
  const res = await query(sql, [id]);
  return res.rows[0];
};

// Recupera il profilo pubblico di un utente salvaguardando la riservatezza GDPR
const getPublicUserProfile = async (id) => {
  const userSql = `
    SELECT 
      u.id, 
      u.nome, 
      u.cognome, 
      u.citta, 
      u.data_registrazione,
      p.indirizzo_approssimato,
      p.coordinate_offuscate,
      COALESCE(priv.mostra_libreria, TRUE) as mostra_libreria,
      COALESCE(priv.mostra_posizione, TRUE) as mostra_posizione,
      COALESCE(priv.modalita_occultamento, 'QUARTIERE') as modalita_occultamento
    FROM utenti u
    LEFT JOIN posizione_utenti p ON u.id = p.utente_id
    LEFT JOIN preferenze_privacy_utenti priv ON u.id = priv.utente_id
    WHERE u.id = $1;
  `;
  const userRes = await query(userSql, [id]);
  if (userRes.rows.length === 0) {
    const error = new Error(`Nessun lettore trovato con identificativo: ${id}`);
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const row = userRes.rows[0];

  // Se la libreria è visibile, estrae i libri pubblici e disponibili dell'utente
  let libriDisponibili = [];
  let totaleLibri = 0;

  if (row.mostra_libreria) {
    const booksSql = `
      SELECT 
        e.id,
        e.titolo,
        e.autore,
        e.editore,
        e.anno_pubblicazione,
        e.isbn,
        e.sottogenere,
        e.stato_conservazione,
        e.stato_disponibilita,
        e.immagine_copertina,
        e.immagine_miniatura,
        c.id as categoria_id,
        c.nome as categoria_nome,
        c.slug as categoria_slug,
        c.icona as categoria_icona,
        c.colore_hex as categoria_colore
      FROM esemplari e
      JOIN categorie c ON e.categoria_id = c.id
      WHERE e.utente_id = $1
        AND e.visibile_pubblico = TRUE
        AND e.stato_disponibilita = 'DISPONIBILE'
      ORDER BY e.data_creazione DESC;
    `;
    const booksRes = await query(booksSql, [id]);
    libriDisponibili = booksRes.rows.map(b => ({
      id: b.id,
      titolo: b.titolo,
      autore: b.autore,
      editore: b.editore,
      anno_pubblicazione: b.anno_pubblicazione ? parseInt(b.anno_pubblicazione, 10) : null,
      isbn: b.isbn,
      sottogenere: b.sottogenere,
      stato_conservazione: b.stato_conservazione,
      stato_disponibilita: b.stato_disponibilita,
      immagine_copertina: b.immagine_copertina,
      immagine_miniatura: b.immagine_miniatura,
      categoria: {
        id: b.categoria_id,
        nome: b.categoria_nome,
        slug: b.categoria_slug,
        icona: b.categoria_icona || 'bi-book',
        colore_hex: b.categoria_colore || '#1e40af'
      }
    }));
    totaleLibri = libriDisponibili.length;
  }

  return {
    id: row.id,
    nome: row.nome,
    cognome_iniziale: row.cognome ? `${row.cognome.charAt(0)}.` : '',
    nome_completo: `${row.nome} ${row.cognome ? row.cognome.charAt(0) + '.' : ''}`,
    citta: row.citta,
    indirizzo_approssimato: row.mostra_posizione && row.modalita_occultamento !== 'TOTALE' ? row.indirizzo_approssimato : null,
    data_registrazione: row.data_registrazione,
    mostra_libreria: Boolean(row.mostra_libreria),
    privacy_libreria_attiva: !row.mostra_libreria,
    totale_libri: totaleLibri,
    libri: libriDisponibili
  };
};

// Esporta le funzioni del layer di servizio per la gestione dell'entità utenti
module.exports = {
  createUser,
  getUserById,
  getPublicUserProfile,
  getUserByEmail,
  getAllUsers,
  updateUser,
  deleteUser,
  parsePoint,
  generateBlurredCoordinates
};
