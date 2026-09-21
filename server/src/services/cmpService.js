/**
 * HERMAE — Servizio Consent Management Platform (CMP)
 * Gestione centralizzata del consenso informato (GDPR Art. 5(2), 6, 7 e Direttiva ePrivacy 2002/58/CE)
 * 
 * Modulo ad hoc per il tracciamento granulare dei consensi su dati raccolti e servizi terzi.
 */

const db = require('../config/db');
const crypto = require('crypto');

// Versione corrente della Privacy & Cookie Policy
const POLICY_VERSION = '1.0';

/**
 * Metadati strutturati delle 4 categorie di trattamento previste dalla CMP Hermae
 */
const CATEGORIE_CMP = [
  {
    id: 'necessari',
    nome: 'Cookie & Dati Tecnici Essenziali',
    descrizione: 'Indispensabili per il funzionamento sicuro della piattaforma, autenticazione con token JWT, protezione anti-CSRF e stabilità delle sessioni operative.',
    baseGiuridica: 'Art. 6(1)(f) GDPR (Legittimo Interesse del Titolare) ed esenzione Art. 122 D.Lgs. 196/2003',
    obbligatorio: true,
    defaultAttivo: true,
    tempoConservazione: 'Sessione utente / Durata token JWT (max 7 giorni)',
    serviziCoinvolti: ['Hermae Core Server', 'PostgreSQL Session Layer']
  },
  {
    id: 'funzionali',
    nome: 'Funzionali & Preferenze di Navigazione',
    descrizione: 'Consentono di memorizzare la modalità di visualizzazione preferita della libreria (es. Scaffale 3D "Book-Stile" vs griglia/tabella), il raggio geografico impostato e lo stato dei filtri.',
    baseGiuridica: 'Art. 6(1)(a) GDPR (Consenso esplicito dell’interessato)',
    obbligatorio: false,
    defaultAttivo: false,
    tempoConservazione: '12 mesi o fino alla revoca esplicita',
    serviziCoinvolti: ['Hermae Local Storage Cache', 'UI State Manager']
  },
  {
    id: 'analitici',
    nome: 'Statistiche Interne Anonimizzate',
    descrizione: 'Permettono l’elaborazione delle metriche interne aggregate di consultazione dei libri e il calcolo dell’Indice di Impatto Culturale Hermae ad esclusivo uso personale del lettore, senza profilazione né tracciamento commerciale o cessione a terzi.',
    baseGiuridica: 'Art. 6(1)(a) GDPR (Consenso esplicito dell’interessato)',
    obbligatorio: false,
    defaultAttivo: false,
    tempoConservazione: '12 mesi (dati aggregati anonimi a livello DB)',
    serviziCoinvolti: ['Hermae Analytics Engine (First-Party)']
  },
  {
    id: 'servizi_terzi',
    nome: 'Servizi Esterni, CDN & Mappe Interattive',
    descrizione: 'Abilitano l’erogazione dei tile cartografici geospaziali (OpenStreetMap / CARTO), dei web font e delle icone vettoriali erogate da reti di distribuzione dei contenuti (CDN). In assenza di consenso, la piattaforma adotta asset locali o modalità a basso impatto.',
    baseGiuridica: 'Art. 6(1)(a) GDPR (Consenso esplicito dell’interessato)',
    obbligatorio: false,
    defaultAttivo: false,
    tempoConservazione: 'Durata della sessione / Cookie di terze parti secondo rispettive informative',
    serviziCoinvolti: ['OpenStreetMap / CartoDB', 'Google Fonts / Inter', 'Bootstrap CDN (jsDelivr)']
  }
];

/**
 * Anonimizza un indirizzo IP secondo le prescrizioni del Garante Privacy (mascheramento ultimo ottetto)
 */
function anonymizeIp(ip) {
  if (!ip) return null;
  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
  }
  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts.slice(0, 3).join(':')}::`;
  }
  return ip.substring(0, 8) + '...';
}

/**
 * Genera un identificativo crittografico univoco per il consenso client
 */
function generaConsensoId() {
  return 'cmp_' + crypto.randomBytes(16).toString('hex');
}

/**
 * Restituisce i metadati della policy CMP per l'interfaccia utente
 */
const getPolicyMetadata = () => {
  return {
    versione_policy: POLICY_VERSION,
    data_aggiornamento: '2026-09-21',
    titolare_trattamento: 'Hermae — Piattaforma di Geolocalizzazione Culturale (Nunzio Giglio)',
    categorie: CATEGORIE_CMP
  };
};

/**
 * Recupera lo stato attuale del consenso per un utente autenticato o per un client ID anonimo
 */
const getStatoConsenso = async ({ utenteId = null, consensoId = null }) => {
  let row = null;

  if (utenteId) {
    const userRes = await db.query(
      `SELECT * FROM consensi_cmp_utenti WHERE utente_id = $1 ORDER BY data_aggiornamento DESC LIMIT 1`,
      [utenteId]
    );
    if (userRes.rows.length > 0) {
      row = userRes.rows[0];
    }
  }

  if (!row && consensoId) {
    const anonRes = await db.query(
      `SELECT * FROM consensi_cmp_utenti WHERE consenso_id = $1 ORDER BY data_aggiornamento DESC LIMIT 1`,
      [consensoId]
    );
    if (anonRes.rows.length > 0) {
      row = anonRes.rows[0];
    }
  }

  if (row) {
    return {
      espresso: true,
      consenso_id: row.consenso_id,
      versione_policy: row.versione_policy,
      categorie: {
        necessari: true, // Sempre attivo
        funzionali: Boolean(row.funzionali),
        analitici: Boolean(row.analitici),
        servizi_terzi: Boolean(row.servizi_terzi)
      },
      data_espressione: row.data_espressione,
      data_aggiornamento: row.data_aggiornamento
    };
  }

  // Nessun consenso precedentemente registrato: default Privacy by Default (solo necessari)
  return {
    espresso: false,
    consenso_id: consensoId || generaConsensoId(),
    versione_policy: POLICY_VERSION,
    categorie: {
      necessari: true,
      funzionali: false,
      analitici: false,
      servizi_terzi: false
    },
    data_espressione: null,
    data_aggiornamento: null
  };
};

/**
 * Registra o aggiorna un'espressione di consenso (GDPR Accountability Art. 5(2) e Art. 7(1))
 */
const registraConsenso = async ({
  utenteId = null,
  consensoId = null,
  funzionali = false,
  analitici = false,
  servizi_terzi = false,
  versione_policy = POLICY_VERSION,
  ip = null,
  userAgent = null
}) => {
  const finalConsensoId = consensoId && consensoId.trim() ? consensoId.trim() : generaConsensoId();
  const finalIp = anonymizeIp(ip);
  const finalUserAgent = userAgent ? userAgent.substring(0, 255) : null;

  const insertQuery = `
    INSERT INTO consensi_cmp_utenti (
      utente_id,
      consenso_id,
      versione_policy,
      necessari,
      funzionali,
      analitici,
      servizi_terzi,
      indirizzo_ip_anonimizzato,
      user_agent,
      data_espressione,
      data_aggiornamento
    ) VALUES (
      $1, $2, $3, TRUE, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING *;
  `;

  const values = [
    utenteId,
    finalConsensoId,
    versione_policy || POLICY_VERSION,
    Boolean(funzionali),
    Boolean(analitici),
    Boolean(servizi_terzi),
    finalIp,
    finalUserAgent
  ];

  const result = await db.query(insertQuery, values);
  const row = result.rows[0];

  return {
    espresso: true,
    consenso_id: row.consenso_id,
    versione_policy: row.versione_policy,
    categorie: {
      necessari: true,
      funzionali: row.funzionali,
      analitici: row.analitici,
      servizi_terzi: row.servizi_terzi
    },
    data_espressione: row.data_espressione,
    data_aggiornamento: row.data_aggiornamento
  };
};

/**
 * Revoca tutti i consensi opzionali (mantenendo unicamente i necessari)
 */
const revocaConsensi = async ({
  utenteId = null,
  consensoId = null,
  ip = null,
  userAgent = null
}) => {
  return registraConsenso({
    utenteId,
    consensoId,
    funzionali: false,
    analitici: false,
    servizi_terzi: false,
    versione_policy: POLICY_VERSION,
    ip,
    userAgent
  });
};

module.exports = {
  POLICY_VERSION,
  CATEGORIE_CMP,
  getPolicyMetadata,
  getStatoConsenso,
  registraConsenso,
  revocaConsensi,
  anonymizeIp,
  generaConsensoId
};
