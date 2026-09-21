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
 * Regex per il rilevamento di numeri telefonici mobili e fissi italiani e internazionali
 * Copre formati: +39 333 1234567, 333-1234567, 081.1234567, (02) 12345678, sequenze continue da 9-12 cifre
 */
const PHONE_REGEX = /(?:(?:\+|00)39[\s.-]?)?(?:(?:3\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4})|(?:0\d{1,4}[\s.-]?\d{5,8})|(?:\b[30]\d{8,11}\b))/g;

/**
 * Sanifica un testo di messaggio o richiesta, sostituendo email e numeri telefonici con placeholder di riservatezza
 * @param {string} testo - Testo originale digitato dall'utente
 * @returns {{ testoSanificato: string, schermaturaApplicata: boolean, emailRilevate: number, telefoniRilevati: number }}
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
  let phoneCount = 0;

  // Intercetta e sostituisce indirizzi email
  testoSanificato = testoSanificato.replace(EMAIL_REGEX, () => {
    emailCount++;
    return '[EMAIL SCHERMATA A TUTELA PRIVACY]';
  });

  // Intercetta e sostituisce recapiti telefonici
  testoSanificato = testoSanificato.replace(PHONE_REGEX, () => {
    phoneCount++;
    return '[NUMERO SCHERMATO A TUTELA PRIVACY]';
  });

  const schermaturaApplicata = emailCount > 0 || phoneCount > 0;

  return {
    testoSanificato,
    schermaturaApplicata,
    emailRilevate: emailCount,
    telefoniRilevati: phoneCount
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
  EMAIL_REGEX,
  PHONE_REGEX
};
