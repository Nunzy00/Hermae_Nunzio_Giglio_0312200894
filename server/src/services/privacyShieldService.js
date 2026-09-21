// Service per la sicurezza, politiche antispam e schermatura preventiva dei recapiti privati
// Conforme ai requisiti di riservatezza e tutela della privacy (Fase 22)

// Mappa in memoria per il rate-limiting delle richieste di contatto (Sliding Window per utente)
// Struttura: utenteId -> array di timestamp (ms)
const rateLimitMap = new Map();

/**
 * Regex per il rilevamento di indirizzi email conformi a standard RFC 5322
 */
const EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi;

/**
 * Sanifica un testo di messaggio o richiesta, sostituendo l'indirizzo email con il placeholder di riservatezza
 * @param {string} testo - Testo originale digitato dall'utente
 * @returns {{ testoSanificato: string, schermaturaApplicata: boolean, emailRilevate: number }}
 */
const sanitizeMessage = (testo) => {
  if (!testo || typeof testo !== 'string') {
    return {
      testoSanificato: '',
      schermaturaApplicata: false,
      emailRilevate: 0,
      telefoniRilevati: 0
    };
  }

  let testoSanificato = testo;
  let emailCount = 0;

  // Intercetta e sostituisce indirizzi email a tutela della riservatezza
  testoSanificato = testoSanificato.replace(EMAIL_REGEX, () => {
    emailCount++;
    return '[EMAIL SCHERMATA A TUTELA PRIVACY]';
  });

  const schermaturaApplicata = emailCount > 0;

  return {
    testoSanificato,
    schermaturaApplicata,
    emailRilevate: emailCount,
    telefoniRilevati: 0
  };
};

/**
 * Verifica le politiche antispam di rate limiting:
 * Consente al massimo `maxRichieste` inviate nell'arco di `finestraMinuti`
 * @param {string} utenteId - UUID dell'utente richiedente
 * @param {number} maxRichieste - Numero massimo consentito (default: 5)
 * @param {number} finestraMinuti - Ampiezza finestra temporale (default: 15 min)
 * @returns {{ consentito: boolean, secondiAttesa: number }}
 */
const checkRateLimit = (utenteId, maxRichieste = 5, finestraMinuti = 15) => {
  const now = Date.now();
  const windowMs = finestraMinuti * 60 * 1000;

  if (!rateLimitMap.has(utenteId)) {
    rateLimitMap.set(utenteId, []);
  }

  const timestamps = rateLimitMap.get(utenteId).filter(ts => (now - ts) < windowMs);
  rateLimitMap.set(utenteId, timestamps);

  if (timestamps.length >= maxRichieste) {
    const oldestTimestamp = timestamps[0];
    const msToWait = windowMs - (now - oldestTimestamp);
    const secondiAttesa = Math.ceil(msToWait / 1000);
    return { consentito: false, allowed: false, secondiAttesa, waitSeconds: secondiAttesa };
  }

  timestamps.push(now);
  return { consentito: true, allowed: true, secondiAttesa: 0, waitSeconds: 0 };
};

/**
 * Reset del rate limit per collaudo e test
 * @param {string} [utenteId] - Se omesso svuota l'intera mappa
 */
const resetRateLimit = (utenteId) => {
  if (utenteId) {
    rateLimitMap.delete(utenteId);
  } else {
    rateLimitMap.clear();
  }
};

module.exports = {
  sanitizeMessage,
  checkRateLimit,
  resetRateLimit,
  EMAIL_REGEX
};
