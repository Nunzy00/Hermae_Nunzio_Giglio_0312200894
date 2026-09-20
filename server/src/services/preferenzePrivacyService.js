const db = require('../config/db');
const posizioneService = require('./posizioneUtentiService');

// Valori predefiniti cautelativi orientati alla massima tutela dell'utente (Privacy by Default ex Art. 25 GDPR)
const DEFAULT_PRIVACY_SETTINGS = {
  profilo_pubblico: false,
  mostra_posizione: true,
  mostra_libreria: true,
  mostra_email: false,
  raggio_visibilita_km: 10,
  consenti_messaggi_diretti: true,
  modalita_occultamento: 'QUARTIERE'
};

// Formatta il record restituito dal database assicurando il casting tipizzato
const formatPrivacyRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    utente_id: row.utente_id,
    profilo_pubblico: Boolean(row.profilo_pubblico),
    mostra_posizione: Boolean(row.mostra_posizione),
    mostra_libreria: Boolean(row.mostra_libreria),
    mostra_email: Boolean(row.mostra_email),
    raggio_visibilita_km: parseInt(row.raggio_visibilita_km, 10),
    consenti_messaggi_diretti: Boolean(row.consenti_messaggi_diretti),
    modalita_occultamento: row.modalita_occultamento || 'QUARTIERE',
    data_aggiornamento: row.data_aggiornamento
  };
};

// Recupera le impostazioni di privacy dell'utente specificato, creandole con valori di default qualora assenti
const getPreferenzeByUtenteId = async (utenteId) => {
  const selectQuery = `
    SELECT *
    FROM preferenze_privacy_utenti
    WHERE utente_id = $1
    LIMIT 1;
  `;
  const result = await db.query(selectQuery, [utenteId]);

  if (result.rows.length > 0) {
    return formatPrivacyRow(result.rows[0]);
  }

  // Se non ancora presente, inizializza automaticamente il profilo di riservatezza (Privacy by Default)
  const insertQuery = `
    INSERT INTO preferenze_privacy_utenti (
      utente_id,
      profilo_pubblico,
      mostra_posizione,
      mostra_libreria,
      mostra_email,
      raggio_visibilita_km,
      consenti_messaggi_diretti,
      modalita_occultamento
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (utente_id) DO UPDATE SET data_aggiornamento = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const insertResult = await db.query(insertQuery, [
    utenteId,
    DEFAULT_PRIVACY_SETTINGS.profilo_pubblico,
    DEFAULT_PRIVACY_SETTINGS.mostra_posizione,
    DEFAULT_PRIVACY_SETTINGS.mostra_libreria,
    DEFAULT_PRIVACY_SETTINGS.mostra_email,
    DEFAULT_PRIVACY_SETTINGS.raggio_visibilita_km,
    DEFAULT_PRIVACY_SETTINGS.consenti_messaggi_diretti,
    DEFAULT_PRIVACY_SETTINGS.modalita_occultamento
  ]);

  return formatPrivacyRow(insertResult.rows[0]);
};

// Crea o aggiorna le impostazioni di riservatezza dell'utente applicando la logica di upsert atomico
const upsertPreferenze = async (utenteId, data = {}) => {
  // Recupera le impostazioni attuali o di default per fondere eventuali campi non specificati
  const attuali = await getPreferenzeByUtenteId(utenteId);

  const profiloPubblico = data.profilo_pubblico !== undefined ? Boolean(data.profilo_pubblico) : attuali.profilo_pubblico;
  let mostraPosizione = data.mostra_posizione !== undefined ? Boolean(data.mostra_posizione) : attuali.mostra_posizione;
  const mostraLibreria = data.mostra_libreria !== undefined ? Boolean(data.mostra_libreria) : attuali.mostra_libreria;
  const mostraEmail = data.mostra_email !== undefined ? Boolean(data.mostra_email) : attuali.mostra_email;
  const consentiMessaggi = data.consenti_messaggi_diretti !== undefined ? Boolean(data.consenti_messaggi_diretti) : attuali.consenti_messaggi_diretti;

  let modalitaOccultamento = data.modalita_occultamento !== undefined ? data.modalita_occultamento : attuali.modalita_occultamento;
  if (modalitaOccultamento && !['QUARTIERE', 'AREA_CAP', 'TOTALE'].includes(modalitaOccultamento)) {
    const error = new Error("Modalità di occultamento non valida. Valori ammessi: 'QUARTIERE', 'AREA_CAP', 'TOTALE'.");
    error.statusCode = 400;
    error.code = 'INVALID_OBFUSCATION_MODE';
    throw error;
  }

  // Sincronizzazione automatica: se l'utente richiede totale oscuramento, disattiva mostra_posizione
  if (modalitaOccultamento === 'TOTALE') {
    mostraPosizione = false;
  } else if (data.modalita_occultamento && modalitaOccultamento !== 'TOTALE' && data.mostra_posizione === undefined) {
    mostraPosizione = true;
  }

  let raggio = attuali.raggio_visibilita_km;
  if (data.raggio_visibilita_km !== undefined) {
    const parsedRaggio = parseInt(data.raggio_visibilita_km, 10);
    if (isNaN(parsedRaggio) || parsedRaggio < 1 || parsedRaggio > 100) {
      const error = new Error('Il raggio di visibilità chilometrico deve essere un numero intero compreso tra 1 e 100 km.');
      error.statusCode = 400;
      error.code = 'INVALID_RANGE';
      throw error;
    }
    raggio = parsedRaggio;
  }

  const query = `
    INSERT INTO preferenze_privacy_utenti (
      utente_id,
      profilo_pubblico,
      mostra_posizione,
      mostra_libreria,
      mostra_email,
      raggio_visibilita_km,
      consenti_messaggi_diretti,
      modalita_occultamento,
      data_aggiornamento
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    ON CONFLICT (utente_id) DO UPDATE SET
      profilo_pubblico = EXCLUDED.profilo_pubblico,
      mostra_posizione = EXCLUDED.mostra_posizione,
      mostra_libreria = EXCLUDED.mostra_libreria,
      mostra_email = EXCLUDED.mostra_email,
      raggio_visibilita_km = EXCLUDED.raggio_visibilita_km,
      consenti_messaggi_diretti = EXCLUDED.consenti_messaggi_diretti,
      modalita_occultamento = EXCLUDED.modalita_occultamento,
      data_aggiornamento = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const result = await db.query(query, [
    utenteId,
    profiloPubblico,
    mostraPosizione,
    mostraLibreria,
    mostraEmail,
    raggio,
    consentiMessaggi,
    modalitaOccultamento
  ]);

  // Se la modalità di occultamento o la visibilità sono cambiate, sincronizza le coordinate offuscate su posizione_utenti
  await posizioneService.ricalcolaCoordinateUtente(utenteId, mostraPosizione ? modalitaOccultamento : 'TOTALE');

  return formatPrivacyRow(result.rows[0]);
};

// Ripristina tutte le impostazioni ai valori restrittivi predefiniti (Privacy by Default)
const resetPreferenzeDefault = async (utenteId) => {
  return await upsertPreferenze(utenteId, DEFAULT_PRIVACY_SETTINGS);
};

// Rimuove fisicamente il record delle preferenze privacy dal database (Diritto all'oblio completo)
const deletePreferenzeByUtenteId = async (utenteId) => {
  const query = `
    DELETE FROM preferenze_privacy_utenti
    WHERE utente_id = $1
    RETURNING id;
  `;
  const result = await db.query(query, [utenteId]);
  return result.rowCount > 0;
};

module.exports = {
  DEFAULT_PRIVACY_SETTINGS,
  getPreferenzeByUtenteId,
  upsertPreferenze,
  resetPreferenzeDefault,
  deletePreferenzeByUtenteId
};

