const db = require('../config/db');

// Calcola un punto geospaziale perturbato con raggio di confidenzialità (300-500m) per la tutela GDPR del domicilio
const calculateSpatialBlurring = (lat, lng, minRadiusMeters = 300, maxRadiusMeters = 500) => {
  // Genera una distanza casuale compresa tra il raggio minimo e massimo stabilito
  const distance = minRadiusMeters + Math.random() * (maxRadiusMeters - minRadiusMeters);
  // Genera un angolo casuale uniforme in radianti (0 - 2PI)
  const angle = Math.random() * 2 * Math.PI;

  // Approssimazione geodesica: 1 grado di latitudine corrisponde a circa 111.320 metri
  const deltaLat = (distance * Math.cos(angle)) / 111320;
  // 1 grado di longitudine varia in funzione del coseno della latitudine
  const deltaLng = (distance * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));

  return {
    lat: parseFloat((lat + deltaLat).toFixed(6)),
    lng: parseFloat((lng + deltaLng).toFixed(6))
  };
};

// Formatta la riga del database convertendo i tipi POINT di PostgreSQL in oggetti coordinate standard { lat, lng }
const formatPosizioneRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    utente_id: row.utente_id,
    citta: row.citta,
    indirizzo_approssimato: row.indirizzo_approssimato || null,
    latitudine: parseFloat(row.latitudine),
    longitudine: parseFloat(row.longitudine),
    coordinate_reali: row.coordinate_reali ? { lat: row.coordinate_reali.y, lng: row.coordinate_reali.x } : null,
    coordinate_offuscate: row.coordinate_offuscate ? { lat: row.coordinate_offuscate.y, lng: row.coordinate_offuscate.x } : null,
    raggio_ricerca_km: parseInt(row.raggio_ricerca_km, 10),
    data_aggiornamento: row.data_aggiornamento
  };
};

// Crea o aggiorna la posizione geografica dell'utente applicando la logica di upsert atomico
const upsertPosizione = async (utenteId, data) => {
  const { citta, indirizzo_approssimato, latitudine, longitudine, raggio_ricerca_km = 5 } = data;

  // Valida la correttezza dei parametri geografici
  const lat = parseFloat(latitudine);
  const lng = parseFloat(longitudine);
  if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
    const error = new Error('Coordinate geografiche non valide (latitudine tra -90 e 90, longitudine tra -180 e 180).');
    error.statusCode = 400;
    error.code = 'INVALID_COORDINATES';
    throw error;
  }

  if (!citta || typeof citta !== 'string' || !citta.trim()) {
    const error = new Error('Il comune o la città di riferimento è un campo obbligatorio.');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  // Calcola il punto offuscato a norma GDPR per la visualizzazione pubblica
  const blurred = calculateSpatialBlurring(lat, lng);
  const raggio = Math.max(1, Math.min(50, parseInt(raggio_ricerca_km, 10) || 5));

  const query = `
    INSERT INTO posizione_utenti (
      utente_id,
      citta,
      indirizzo_approssimato,
      latitudine,
      longitudine,
      coordinate_reali,
      coordinate_offuscate,
      raggio_ricerca_km,
      data_aggiornamento
    )
    VALUES (
      $1, $2, $3, $4::numeric, $5::numeric,
      point($5::float8, $4::float8),
      point($6::float8, $7::float8),
      $8,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (utente_id) DO UPDATE SET
      citta = EXCLUDED.citta,
      indirizzo_approssimato = EXCLUDED.indirizzo_approssimato,
      latitudine = EXCLUDED.latitudine,
      longitudine = EXCLUDED.longitudine,
      coordinate_reali = EXCLUDED.coordinate_reali,
      coordinate_offuscate = EXCLUDED.coordinate_offuscate,
      raggio_ricerca_km = EXCLUDED.raggio_ricerca_km,
      data_aggiornamento = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const values = [
    utenteId,
    citta.trim(),
    indirizzo_approssimato ? indirizzo_approssimato.trim() : null,
    lat,
    lng,
    blurred.lng,
    blurred.lat,
    raggio
  ];

  const result = await db.query(query, values);
  return formatPosizioneRow(result.rows[0]);
};

// Recupera i dettagli di localizzazione dell'utente associato tramite il suo identificatore univoco
const getPosizioneByUtenteId = async (utenteId) => {
  const query = `
    SELECT * FROM posizione_utenti
    WHERE utente_id = $1;
  `;
  const result = await db.query(query, [utenteId]);
  if (!result.rows.length) {
    return null;
  }
  return formatPosizioneRow(result.rows[0]);
};

// Elimina il record della posizione dell'utente dal database
const deletePosizioneByUtenteId = async (utenteId) => {
  const query = `
    DELETE FROM posizione_utenti
    WHERE utente_id = $1
    RETURNING *;
  `;
  const result = await db.query(query, [utenteId]);
  return result.rowCount > 0;
};

// Esegue una ricerca spaziale per individuare posizioni utente vicine entro un raggio metrico (solo coordinate offuscate)
const findPosizioniVicine = async (lat, lng, raggioKm = 10, limit = 20) => {
  const targetLat = parseFloat(lat);
  const targetLng = parseFloat(lng);
  const radius = parseFloat(raggioKm);

  // Calcola la distanza sferica in metri tramite estensione earthdistance di PostgreSQL filtrando per preferenze privacy
  const query = `
    SELECT 
      p.id,
      p.utente_id,
      p.citta,
      p.indirizzo_approssimato,
      p.coordinate_offuscate,
      p.raggio_ricerca_km,
      u.nome,
      u.cognome,
      round((earth_distance(ll_to_earth($1, $2), ll_to_earth((p.coordinate_offuscate)[1], (p.coordinate_offuscate)[0])))::numeric, 1) as distanza_metri
    FROM posizione_utenti p
    JOIN utenti u ON p.utente_id = u.id
    LEFT JOIN preferenze_privacy_utenti ppu ON p.utente_id = ppu.utente_id
    WHERE earth_box(ll_to_earth($1, $2), $3 * 1000) @> ll_to_earth((p.coordinate_offuscate)[1], (p.coordinate_offuscate)[0])
      AND earth_distance(ll_to_earth($1, $2), ll_to_earth((p.coordinate_offuscate)[1], (p.coordinate_offuscate)[0])) <= $3 * 1000
      AND COALESCE(ppu.mostra_posizione, TRUE) = TRUE
    ORDER BY distanza_metri ASC
    LIMIT $4;
  `;

  const result = await db.query(query, [targetLat, targetLng, radius, limit]);
  return result.rows.map(row => {
    const km = parseFloat((row.distanza_metri / 1000).toFixed(2));
    let fascia = 'Stesso Quartiere';
    if (km > 25) fascia = 'Area Provinciale';
    else if (km > 10) fascia = 'Area Metropolitana';
    else if (km > 2) fascia = 'Stessa Città';

    return {
      id: row.id,
      utente_id: row.utente_id,
      citta: row.citta,
      indirizzo_approssimato: row.indirizzo_approssimato || null,
      utente: `${row.nome} ${row.cognome.charAt(0)}.`,
      coordinate_offuscate: { lat: row.coordinate_offuscate.y, lng: row.coordinate_offuscate.x },
      distanza_metri: parseFloat(row.distanza_metri),
      distanza_km: km,
      fascia_prossimita: fascia
    };
  });
};

module.exports = {
  calculateSpatialBlurring,
  upsertPosizione,
  getPosizioneByUtenteId,
  deletePosizioneByUtenteId,
  findPosizioniVicine
};
