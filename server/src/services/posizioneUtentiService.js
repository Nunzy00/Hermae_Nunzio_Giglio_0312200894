const db = require('../config/db');

// Calcola un punto geospaziale perturbato con raggio di confidenzialità (minRadius - maxRadius metri) per la tutela GDPR del domicilio
const calculateSpatialBlurring = (lat, lng, minRadiusMeters = 300, maxRadiusMeters = 500) => {
  // Genera una distanza casuale uniforme compresa tra il raggio minimo e massimo stabilito
  const distance = minRadiusMeters + Math.random() * (maxRadiusMeters - minRadiusMeters);
  // Genera un angolo casuale uniforme in radianti (0 - 2PI)
  const angle = Math.random() * 2 * Math.PI;

  // Approssimazione geodesica: 1 grado di latitudine corrisponde a circa 111.320 metri
  const deltaLat = (distance * Math.cos(angle)) / 111320;
  // 1 grado di longitudine varia in funzione del coseno della latitudine
  const deltaLng = (distance * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));

  return {
    lat: parseFloat((lat + deltaLat).toFixed(6)),
    lng: parseFloat((lng + deltaLng).toFixed(6)),
    distanzaOffuscamentoMetri: Math.round(distance)
  };
};

// Applica l'algoritmo di occultamento specifico a seconda della modalità di riservatezza scelta
const calculateCoordinateOccultate = (lat, lng, modalitaOccultamento = 'QUARTIERE') => {
  if (modalitaOccultamento === 'TOTALE') {
    return null;
  }
  if (modalitaOccultamento === 'AREA_CAP') {
    // Approssimazione ad area/distretto/CAP: raggio perturbato da 1.5 km a 3 km
    return calculateSpatialBlurring(lat, lng, 1500, 3000);
  }
  // Modalità 'QUARTIERE' standard: raggio di confidenzialità da 300 a 500 metri
  return calculateSpatialBlurring(lat, lng, 300, 500);
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

// Ricalcola istantaneamente le coordinate offuscate dell'utente su PostgreSQL in base al livello di riservatezza
const ricalcolaCoordinateUtente = async (utenteId, modalitaOccultamento = 'QUARTIERE') => {
  const currentPos = await getPosizioneByUtenteId(utenteId);
  if (!currentPos) return null;

  if (modalitaOccultamento === 'TOTALE') {
    const updateQuery = `
      UPDATE posizione_utenti
      SET coordinate_offuscate = NULL,
          data_aggiornamento = CURRENT_TIMESTAMP
      WHERE utente_id = $1
      RETURNING *;
    `;
    const res = await db.query(updateQuery, [utenteId]);
    return formatPosizioneRow(res.rows[0]);
  }

  const blurred = calculateCoordinateOccultate(currentPos.latitudine, currentPos.longitudine, modalitaOccultamento);
  const updateQuery = `
    UPDATE posizione_utenti
    SET coordinate_offuscate = point($2::float8, $3::float8),
        data_aggiornamento = CURRENT_TIMESTAMP
    WHERE utente_id = $1
    RETURNING *;
  `;
  const res = await db.query(updateQuery, [utenteId, blurred.lng, blurred.lat]);
  return formatPosizioneRow(res.rows[0]);
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

  // Verifica le preferenze privacy dell'utente per applicare la modalità di occultamento prescelta
  const privRes = await db.query(
    'SELECT modalita_occultamento, mostra_posizione FROM preferenze_privacy_utenti WHERE utente_id = $1',
    [utenteId]
  );
  const modalita = (privRes.rows.length > 0 && privRes.rows[0].modalita_occultamento)
    ? privRes.rows[0].modalita_occultamento
    : (data.modalita_occultamento || 'QUARTIERE');
  const mostraPosizione = privRes.rows.length > 0 ? privRes.rows[0].mostra_posizione : true;

  // Calcola il punto offuscato a norma GDPR a seconda della modalità attiva
  let blurred = null;
  if (mostraPosizione && modalita !== 'TOTALE') {
    blurred = calculateCoordinateOccultate(lat, lng, modalita);
  }
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
      ${blurred ? 'point($6::float8, $7::float8)' : 'NULL'},
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
    blurred ? blurred.lng : null,
    blurred ? blurred.lat : null,
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

// Esegue una ricerca spaziale per individuare posizioni utente vicine entro un raggio metrico
const findPosizioniVicine = async (lat, lng, raggioKm = 10, limit = 20, includiSoloCitta = false) => {
  const targetLat = parseFloat(lat);
  const targetLng = parseFloat(lng);
  const radius = parseFloat(raggioKm);
  const includeAggregated = String(includiSoloCitta).toLowerCase() === 'true';

  // 1. Ricerca utenti georeferenziati con coordinate offuscate attive (QUARTIERE e AREA_CAP)
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
      COALESCE(ppu.modalita_occultamento, 'QUARTIERE') as modalita_occultamento,
      round((earth_distance(ll_to_earth($1, $2), ll_to_earth((p.coordinate_offuscate)[1], (p.coordinate_offuscate)[0])))::numeric, 1) as distanza_metri
    FROM posizione_utenti p
    JOIN utenti u ON p.utente_id = u.id
    LEFT JOIN preferenze_privacy_utenti ppu ON p.utente_id = ppu.utente_id
    WHERE p.coordinate_offuscate IS NOT NULL
      AND earth_box(ll_to_earth($1, $2), $3 * 1000) @> ll_to_earth((p.coordinate_offuscate)[1], (p.coordinate_offuscate)[0])
      AND earth_distance(ll_to_earth($1, $2), ll_to_earth((p.coordinate_offuscate)[1], (p.coordinate_offuscate)[0])) <= $3 * 1000
      AND COALESCE(ppu.mostra_posizione, TRUE) = TRUE
      AND COALESCE(ppu.modalita_occultamento, 'QUARTIERE') != 'TOTALE'
    ORDER BY distanza_metri ASC
    LIMIT $4;
  `;

  const result = await db.query(query, [targetLat, targetLng, radius, limit]);
  const risultatiMappati = result.rows.map(row => {
    const km = parseFloat((row.distanza_metri / 1000).toFixed(2));
    let fascia = 'Stesso Quartiere';
    if (row.modalita_occultamento === 'AREA_CAP') {
      fascia = 'Area/CAP (~2 km)';
    } else if (km > 25) {
      fascia = 'Area Provinciale';
    } else if (km > 10) {
      fascia = 'Area Metropolitana';
    } else if (km > 2) {
      fascia = 'Stessa Città';
    }

    return {
      id: row.id,
      utente_id: row.utente_id,
      citta: row.citta,
      indirizzo_approssimato: row.indirizzo_approssimato || null,
      utente: `${row.nome} ${row.cognome.charAt(0)}.`,
      coordinate_offuscate: { lat: row.coordinate_offuscate.y, lng: row.coordinate_offuscate.x },
      distanza_metri: parseFloat(row.distanza_metri),
      distanza_km: km,
      fascia_prossimita: fascia,
      modalita_occultamento: row.modalita_occultamento,
      mostra_su_mappa: true
    };
  });

  // 2. Se richiesto, include gli utenti con totale oscuramento appartenenti alla stessa città della ricerca
  if (includeAggregated) {
    const targetCity = risultatiMappati.length > 0 ? risultatiMappati[0].citta : null;
    if (targetCity) {
      const querySoloCitta = `
        SELECT 
          p.id,
          p.utente_id,
          p.citta,
          u.nome,
          u.cognome,
          COALESCE(ppu.modalita_occultamento, 'TOTALE') as modalita_occultamento
        FROM posizione_utenti p
        JOIN utenti u ON p.utente_id = u.id
        LEFT JOIN preferenze_privacy_utenti ppu ON p.utente_id = ppu.utente_id
        WHERE LOWER(p.citta) = LOWER($1)
          AND (COALESCE(ppu.mostra_posizione, TRUE) = FALSE OR COALESCE(ppu.modalita_occultamento, 'QUARTIERE') = 'TOTALE')
        LIMIT 10;
      `;
      const resSoloCitta = await db.query(querySoloCitta, [targetCity]);
      resSoloCitta.rows.forEach(row => {
        risultatiMappati.push({
          id: row.id,
          utente_id: row.utente_id,
          citta: row.citta,
          indirizzo_approssimato: null,
          utente: `${row.nome} ${row.cognome.charAt(0)}.`,
          coordinate_offuscate: null,
          distanza_metri: null,
          distanza_km: null,
          fascia_prossimita: 'Solo Città',
          modalita_occultamento: 'TOTALE',
          mostra_su_mappa: false
        });
      });
    }
  }

  return risultatiMappati;
};

module.exports = {
  calculateSpatialBlurring,
  calculateCoordinateOccultate,
  ricalcolaCoordinateUtente,
  upsertPosizione,
  getPosizioneByUtenteId,
  deletePosizioneByUtenteId,
  findPosizioniVicine
};

