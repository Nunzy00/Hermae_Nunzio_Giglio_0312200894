const { pool } = require('../config/db');

/**
 * Service per l'elaborazione efficiente delle statistiche aggregate
 * e delle metriche analitiche della Dashboard utente Hermae (Fase 24).
 * 
 * Risolve la difficoltà di fase evitando query onerose e scansioni full-table,
 * combinando CTE (Common Table Expressions) a passata singola, indici B-tree mirati
 * e serie temporali generate nativamente in PostgreSQL.
 */

/**
 * Normalizza il parametro temporale in un intervallo SQL valido e numero di mesi
 * @param {string} periodo - '30d', '6m', '1y', 'all'
 * @returns {{ intervalSql: string, numMesi: number }}
 */
function parsePeriodo(periodo) {
  switch (periodo) {
    case '30d':
      return { intervalSql: '30 days', numMesi: 1, stepMesi: 1 };
    case '1y':
      return { intervalSql: '12 months', numMesi: 12, stepMesi: 12 };
    case 'all':
      return { intervalSql: '24 months', numMesi: 24, stepMesi: 24 };
    case '6m':
    default:
      return { intervalSql: '5 months', numMesi: 6, stepMesi: 6 };
  }
}

/**
 * Recupera l'insieme completo delle metriche aggregate per la Dashboard personale dell'utente.
 * Utilizza una singola query CTE per i KPI globali e query indicizzate per i grafici.
 * 
 * @param {string} utenteId - UUID dell'utente autenticato
 * @param {object} opzioni - Opzioni di filtro (periodo, ecc.)
 * @returns {Promise<object>} Payload completo delle metriche analitiche
 */
async function getDashboardAnalytics(utenteId, opzioni = {}) {
  const startTime = Date.now();
  const periodo = opzioni.periodo || '6m';
  const { numMesi } = parsePeriodo(periodo);

  // 1. Query CTE a passata singola per tutti i KPI di sintesi (Volumi, Prestiti, Letture, Visite)
  // Eseguita in un'unica round-trip verso PostgreSQL
  const kpiQuery = `
    WITH 
    libri_summary AS (
      SELECT
        COUNT(*)::int AS totale_libri,
        COUNT(*) FILTER (WHERE stato_disponibilita = 'DISPONIBILE')::int AS libri_disponibili,
        COUNT(*) FILTER (WHERE stato_disponibilita = 'IN_PRESTITO')::int AS libri_in_prestito,
        COUNT(*) FILTER (WHERE stato_disponibilita = 'NON_DISPONIBILE')::int AS libri_non_disponibili,
        COUNT(*) FILTER (WHERE visibile_pubblico = TRUE)::int AS libri_pubblici,
        COUNT(*) FILTER (WHERE visibile_pubblico = FALSE)::int AS libri_privati
      FROM esemplari
      WHERE utente_id = $1
    ),
    prestiti_concessi AS (
      SELECT
        COUNT(*)::int AS totale_richieste_ricevute,
        COUNT(*) FILTER (WHERE stato = 'IN_ATTESA')::int AS prestiti_in_attesa,
        COUNT(*) FILTER (WHERE stato IN ('IN_PRESTITO', 'ACCETTATA'))::int AS prestiti_attivi,
        COUNT(*) FILTER (WHERE stato IN ('RESTITUITO', 'COMPLETATA'))::int AS prestiti_completati,
        COUNT(*) FILTER (WHERE stato = 'RIFIUTATA')::int AS prestiti_rifiutati,
        COUNT(*) FILTER (WHERE stato = 'ANNULLATA')::int AS prestiti_annullati,
        COALESCE(AVG(durata_giorni) FILTER (WHERE stato IN ('RESTITUITO', 'COMPLETATA')), 30)::numeric(10,1) AS durata_media_prestito
      FROM richieste_prestito
      WHERE proprietario_id = $1
    ),
    letture_ricevute AS (
      SELECT
        COUNT(*)::int AS totale_richieste_inviate,
        COUNT(*) FILTER (WHERE stato = 'IN_ATTESA')::int AS letture_in_attesa,
        COUNT(*) FILTER (WHERE stato IN ('IN_PRESTITO', 'ACCETTATA'))::int AS letture_in_corso,
        COUNT(*) FILTER (WHERE stato IN ('RESTITUITO', 'COMPLETATA'))::int AS letture_completate
      FROM richieste_prestito
      WHERE richiedente_id = $1
    ),
    visite_ricevute AS (
      SELECT
        COUNT(mv.id)::int AS totale_visualizzazioni
      FROM metriche_visite mv
      JOIN esemplari e ON mv.esemplare_id = e.id
      WHERE e.utente_id = $1
    )
    SELECT 
      ls.*,
      pc.*,
      lr.*,
      vr.*
    FROM libri_summary ls
    CROSS JOIN prestiti_concessi pc
    CROSS JOIN letture_ricevute lr
    CROSS JOIN visite_ricevute vr;
  `;

  // 2. Query serie temporale mensile nativa in PostgreSQL (senza lacune di date)
  const timeSeriesQuery = `
    WITH date_series AS (
      SELECT 
        date_trunc('month', series_date) AS mese_inizio,
        (date_trunc('month', series_date) + interval '1 month' - interval '1 millisecond') AS mese_fine,
        to_char(series_date, 'Mon YY') AS mese_label,
        to_char(series_date, 'YYYY-MM') AS mese_codice
      FROM generate_series(
        date_trunc('month', NOW() - ($2 || ' months')::interval),
        date_trunc('month', NOW()),
        '1 month'::interval
      ) AS series_date
    )
    SELECT 
      ds.mese_label,
      ds.mese_codice,
      COALESCE(e_agg.conteggio_libri, 0)::int AS libri_aggiunti,
      COALESCE(p_agg.conteggio_prestiti, 0)::int AS prestiti_concessi,
      COALESCE(l_agg.conteggio_letture, 0)::int AS letture_completate,
      COALESCE(v_agg.conteggio_visite, 0)::int AS visualizzazioni
    FROM date_series ds
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS conteggio_libri
      FROM esemplari
      WHERE utente_id = $1
        AND data_creazione >= ds.mese_inizio
        AND data_creazione <= ds.mese_fine
    ) e_agg ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS conteggio_prestiti
      FROM richieste_prestito
      WHERE proprietario_id = $1
        AND stato IN ('IN_PRESTITO', 'ACCETTATA', 'RESTITUITO', 'COMPLETATA')
        AND data_richiesta >= ds.mese_inizio
        AND data_richiesta <= ds.mese_fine
    ) p_agg ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS conteggio_letture
      FROM richieste_prestito
      WHERE richiedente_id = $1
        AND stato IN ('RESTITUITO', 'COMPLETATA')
        AND data_restituzione >= ds.mese_inizio
        AND data_restituzione <= ds.mese_fine
    ) l_agg ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS conteggio_visite
      FROM metriche_visite mv
      JOIN esemplari e ON mv.esemplare_id = e.id
      WHERE e.utente_id = $1
        AND mv.data_evento >= ds.mese_inizio
        AND mv.data_evento <= ds.mese_fine
    ) v_agg ON TRUE
    ORDER BY ds.mese_inizio ASC;
  `;

  // 3. Query distribuzione tematica per macro-categoria
  const categorieQuery = `
    SELECT 
      c.id AS categoria_id,
      c.nome AS categoria_nome,
      c.colore_hex,
      c.icona,
      COUNT(e.id)::int AS conteggio
    FROM categorie c
    LEFT JOIN esemplari e ON e.categoria_id = c.id AND e.utente_id = $1
    GROUP BY c.id, c.nome, c.colore_hex, c.icona
    HAVING COUNT(e.id) > 0
    ORDER BY conteggio DESC, c.nome ASC;
  `;

  // 4. Query per i libri con maggior interesse / visualizzazioni
  const topLibriQuery = `
    SELECT 
      e.id,
      e.titolo,
      e.autore,
      e.stato_disponibilita,
      e.immagine_miniatura,
      e.immagine_copertina,
      c.nome AS categoria_nome,
      c.colore_hex AS categoria_colore,
      COUNT(mv.id)::int AS visualizzazioni,
      COUNT(rp.id)::int AS prestiti_ricevuti
    FROM esemplari e
    LEFT JOIN categorie c ON e.categoria_id = c.id
    LEFT JOIN metriche_visite mv ON mv.esemplare_id = e.id
    LEFT JOIN richieste_prestito rp ON rp.esemplare_id = e.id AND rp.stato IN ('IN_PRESTITO', 'RESTITUITO', 'COMPLETATA')
    WHERE e.utente_id = $1
    GROUP BY e.id, e.titolo, e.autore, e.stato_disponibilita, e.immagine_miniatura, e.immagine_copertina, c.nome, c.colore_hex
    ORDER BY visualizzazioni DESC, prestiti_ricevuti DESC, e.data_creazione DESC
    LIMIT 5;
  `;

  // Esecuzione parallela delle query indicizzate tramite Promise.all
  const [kpiRes, timeSeriesRes, categorieRes, topLibriRes] = await Promise.all([
    pool.query(kpiQuery, [utenteId]),
    pool.query(timeSeriesQuery, [utenteId, Math.max(1, numMesi - 1)]),
    pool.query(categorieQuery, [utenteId]),
    pool.query(topLibriQuery, [utenteId])
  ]);

  const kpiRow = kpiRes.rows[0] || {};
  const executionTimeMs = Date.now() - startTime;

  // Calcolo tasso di successo del prestito
  const prestitiConclusi = (kpiRow.prestiti_completati || 0);
  const prestitiNonRiusciti = (kpiRow.prestiti_rifiutati || 0) + (kpiRow.prestiti_annullati || 0);
  const baseTasso = prestitiConclusi + prestitiNonRiusciti;
  const tassoSuccesso = baseTasso > 0 
    ? Math.round((prestitiConclusi / baseTasso) * 100) 
    : (kpiRow.prestiti_attivi > 0 ? 100 : 0);

  // Calcolo indice di impatto culturale sintetico Hermae
  const indiceImpatto = Math.round(
    ((kpiRow.totale_libri || 0) * 10) +
    ((kpiRow.prestiti_completati || 0) * 25) +
    ((kpiRow.letture_completate || 0) * 20) +
    ((kpiRow.totale_visualizzazioni || 0) * 2)
  );

  // Mappatura delle categorie per Chart.js con percentuali
  const totLibri = kpiRow.totale_libri || 0;
  const categorieBreakdown = categorieRes.rows.map(cat => ({
    id: cat.categoria_id,
    nome: cat.categoria_nome,
    colore: cat.colore_hex || '#475569',
    icona: cat.icona,
    count: cat.conteggio,
    percentuale: totLibri > 0 ? Math.round((cat.conteggio / totLibri) * 100) : 0
  }));

  // Mappatura della serie temporale localizzata
  const mesiTradotti = {
    Jan: 'Gen', Feb: 'Feb', Mar: 'Mar', Apr: 'Apr', May: 'Mag', Jun: 'Giu',
    Jul: 'Lug', Aug: 'Ago', Sep: 'Set', Oct: 'Ott', Nov: 'Nov', Dec: 'Dic'
  };

  const trendTemporale = timeSeriesRes.rows.map(row => {
    const parts = (row.mese_label || '').split(' ');
    const meseIta = mesiTradotti[parts[0]] || parts[0];
    const anno = parts[1] ? `'${parts[1]}` : '';
    return {
      codice: row.mese_codice,
      label: `${meseIta} ${anno}`.trim(),
      libriAggiunti: row.libri_aggiunti,
      prestitiConcessi: row.prestiti_concessi,
      lettureCompletate: row.letture_completate,
      visualizzazioni: row.visualizzazioni
    };
  });

  return {
    kpi: {
      volumi: {
        totale: kpiRow.totale_libri || 0,
        disponibili: kpiRow.libri_disponibili || 0,
        inPrestito: kpiRow.libri_in_prestito || 0,
        nonDisponibili: kpiRow.libri_non_disponibili || 0,
        pubblici: kpiRow.libri_pubblici || 0,
        privati: kpiRow.libri_privati || 0
      },
      prestiti: {
        richiesteRicevute: kpiRow.totale_richieste_ricevute || 0,
        inAttesa: kpiRow.prestiti_in_attesa || 0,
        attivi: kpiRow.prestiti_attivi || 0,
        completati: kpiRow.prestiti_completati || 0,
        rifiutati: kpiRow.prestiti_rifiutati || 0,
        annullati: kpiRow.prestiti_annullati || 0,
        tassoSuccessoPercentuale: tassoSuccesso,
        durataMediaGiorni: parseFloat(kpiRow.durata_media_prestito || 30)
      },
      letture: {
        richiesteInviate: kpiRow.totale_richieste_inviate || 0,
        inAttesa: kpiRow.letture_in_attesa || 0,
        inCorso: kpiRow.letture_in_corso || 0,
        completate: kpiRow.letture_completate || 0
      },
      impatto: {
        visualizzazioniTotali: kpiRow.totale_visualizzazioni || 0,
        contattiTotali: (kpiRow.totale_richieste_ricevute || 0) + (kpiRow.totale_richieste_inviate || 0),
        indiceImpatto: indiceImpatto
      }
    },
    grafici: {
      trendTemporale: {
        labels: trendTemporale.map(t => t.label),
        datasets: {
          libriAggiunti: trendTemporale.map(t => t.libriAggiunti),
          prestitiConcessi: trendTemporale.map(t => t.prestitiConcessi),
          lettureCompletate: trendTemporale.map(t => t.lettureCompletate),
          visualizzazioni: trendTemporale.map(t => t.visualizzazioni)
        },
        dettagli: trendTemporale
      },
      distribuzioneCategorie: {
        labels: categorieBreakdown.map(c => c.nome),
        data: categorieBreakdown.map(c => c.count),
        colors: categorieBreakdown.map(c => c.colore),
        dettagli: categorieBreakdown
      }
    },
    topLibri: topLibriRes.rows.map(b => ({
      id: b.id,
      titolo: b.titolo,
      autore: b.autore,
      stato: b.stato_disponibilita,
      copertina: b.immagine_copertina || b.immagine_miniatura,
      categoria: b.categoria_nome,
      categoriaColore: b.categoria_colore,
      visualizzazioni: b.visualizzazioni,
      prestitiRicevuti: b.prestiti_ricevuti
    })),
    metadati: {
      periodoRichiesto: periodo,
      numMesiConsiderati: numMesi,
      tempoElaborazioneMs: executionTimeMs,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Registra un evento di consultazione anonimizzato in metriche_visite.
 * Esecuzione non-bloccante e a tolleranza di errore.
 * 
 * @param {string} esemplareId - ID dell'esemplare visualizzato
 * @param {string} tipoEvento - Tipo evento (default 'VISUALIZZAZIONE_SCHEDA')
 * @param {string|null} citta - Città dell'evento se disponibile
 * @returns {Promise<boolean>}
 */
async function tracciaVisitaLibro(esemplareId, tipoEvento = 'VISUALIZZAZIONE_SCHEDA', citta = null) {
  if (!esemplareId) return false;
  try {
    await pool.query(
      `INSERT INTO metriche_visite (esemplare_id, tipo_evento, citta) 
       VALUES ($1, $2, $3)`,
      [esemplareId, tipoEvento, citta]
    );
    return true;
  } catch (err) {
    // Non propagare l'errore per non compromettere la risposta dell'endpoint principale
    return false;
  }
}

/**
 * Restituisce l'elenco dei libri più consultati dell'utente
 * @param {string} utenteId 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
async function getLibriPiuConsultati(utenteId, limit = 5) {
  const res = await pool.query(
    `SELECT 
       e.id, e.titolo, e.autore, e.stato_disponibilita, e.immagine_miniatura, e.immagine_copertina,
       c.nome AS categoria_nome, c.colore_hex AS categoria_colore,
       COUNT(mv.id)::int AS visualizzazioni
     FROM esemplari e
     LEFT JOIN categorie c ON e.categoria_id = c.id
     LEFT JOIN metriche_visite mv ON mv.esemplare_id = e.id
     WHERE e.utente_id = $1
     GROUP BY e.id, e.titolo, e.autore, e.stato_disponibilita, e.immagine_miniatura, e.immagine_copertina, c.nome, c.colore_hex
     ORDER BY visualizzazioni DESC, e.data_creazione DESC
     LIMIT $2`,
    [utenteId, limit]
  );
  return res.rows;
}

module.exports = {
  getDashboardAnalytics,
  tracciaVisitaLibro,
  getLibriPiuConsultati
};
