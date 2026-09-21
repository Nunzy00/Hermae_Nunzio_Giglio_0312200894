// Middleware di sicurezza per la verifica del token JWT e la protezione degli endpoint riservati
const { verifyAccessToken } = require('../services/authService');

// Intercetta l'header Authorization Bearer, valida il token JWT e inietta l'utente decodificato nella richiesta
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    const error = new Error('Accesso negato. Token di autorizzazione mancante negli header della richiesta.');
    error.statusCode = 401;
    error.code = 'TOKEN_MISSING';
    return next(error);
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    const error = new Error("Formato di autorizzazione non valido. Utilizzare il formato: 'Bearer <token>'.");
    error.statusCode = 401;
    error.code = 'TOKEN_MALFORMED';
    return next(error);
  }

  const token = parts[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('Token di sessione scaduto. Utilizzare il refresh token per rinnovare la sessione.');
      error.statusCode = 401;
      error.code = 'TOKEN_EXPIRED';
      return next(error);
    }

    const error = new Error('Token di autorizzazione non valido, manomesso o non riconosciuto.');
    error.statusCode = 401;
    error.code = 'TOKEN_INVALID';
    return next(error);
  }
};

// Intercetta opzionalmente il Bearer token se presente senza bloccare la richiesta
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    try {
      const decoded = verifyAccessToken(parts[1]);
      req.user = decoded;
    } catch (err) {
      // Token non valido o scaduto: prosegue come richiesta anonima
    }
  }
  next();
};

// Esporta i middleware di autenticazione per la protezione delle rotte applicative
module.exports = {
  authenticate,
  optionalAuth
};
