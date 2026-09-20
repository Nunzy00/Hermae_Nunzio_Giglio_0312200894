// Modulo di servizio per la gestione dell'autenticazione utente, emissione token JWT e ciclo di vita delle sessioni
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const userService = require('./userService');

// Genera la coppia di token firmati Access Token e Refresh Token per la sessione dell'utente
const generateTokens = (user) => {
  const accessPayload = {
    id: user.id,
    email: user.email,
    nome: user.nome,
    cognome: user.cognome
  };

  const refreshPayload = {
    id: user.id,
    email: user.email
  };

  const accessToken = jwt.sign(accessPayload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn
  });

  const refreshToken = jwt.sign(refreshPayload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: env.jwt.expiresIn
  };
};

// Convalida la firma crittografica e la scadenza temporale di un Access Token
const verifyAccessToken = (token) => {
  return jwt.verify(token, env.jwt.secret);
};

// Convalida la firma crittografica e la scadenza temporale di un Refresh Token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.jwt.refreshSecret);
};

// Registra un nuovo utente nel sistema e genera contestualmente i token di sessione iniziali
const registerUser = async (userData) => {
  const newUser = await userService.createUser(userData);
  const tokens = generateTokens(newUser);

  return {
    user: newUser,
    tokens
  };
};

// Autentica le credenziali di accesso confrontando l'hash bcrypt della password ed emette i token di sessione
const loginUser = async (email, password) => {
  if (!email || !password) {
    const error = new Error('Inserire sia indirizzo email che password per effettuare il login.');
    error.statusCode = 400;
    error.code = 'MISSING_CREDENTIALS';
    throw error;
  }

  const user = await userService.getUserByEmail(email, true);
  if (!user) {
    const error = new Error('Credenziali di accesso non valide (email o password errata).');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    const error = new Error('Credenziali di accesso non valide (email o password errata).');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  delete user.password_hash;
  const tokens = generateTokens(user);

  return {
    user,
    tokens
  };
};

// Rinnova la sessione utente emettendo un nuovo Access Token a fronte di un Refresh Token valido
const refreshSession = async (refreshToken) => {
  if (!refreshToken) {
    const error = new Error('Il token di rinnovo (refreshToken) è obbligatorio.');
    error.statusCode = 400;
    error.code = 'REFRESH_TOKEN_REQUIRED';
    throw error;
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await userService.getUserById(decoded.id);

    if (!user) {
      const error = new Error('Utente associato al token di sessione non trovato.');
      error.statusCode = 401;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    const tokens = generateTokens(user);

    return {
      tokens,
      user
    };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('La sessione è scaduta. Effettuare nuovamente il login.');
      error.statusCode = 401;
      error.code = 'REFRESH_TOKEN_EXPIRED';
      throw error;
    }
    const error = new Error('Token di sessione non valido o corrotto.');
    error.statusCode = 401;
    error.code = 'INVALID_REFRESH_TOKEN';
    throw error;
  }
};

// Recupera i dati del profilo dell'utente correntemente autenticato tramite identificatore di sessione
const getCurrentUserProfile = async (userId) => {
  const user = await userService.getUserById(userId);
  if (!user) {
    const error = new Error('Profilo utente autenticato non trovato.');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }
  return user;
};

// Esporta i metodi di autenticazione, gestione token e verifica sessione
module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  registerUser,
  loginUser,
  refreshSession,
  getCurrentUserProfile
};
