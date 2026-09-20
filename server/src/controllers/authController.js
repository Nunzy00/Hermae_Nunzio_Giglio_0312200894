// Controller HTTP per la gestione dei flussi di registrazione, accesso, rinnovo token e sessione utente
const authService = require('../services/authService');

// Gestisce la registrazione di un nuovo utente e l'immediata emissione dei token JWT di sessione
const register = async (req, res, next) => {
  try {
    const { email, password, nome, cognome, citta, coordinate_reali, coordinate_offuscate, consenso_privacy, consenso_geo } = req.body;

    if (!email || !password || !nome || !cognome || !citta || !coordinate_reali) {
      const err = new Error('Tutti i campi anagrafici, territoriali e credenziali sono obbligatori.');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!consenso_privacy) {
      const err = new Error('Il consenso al trattamento dei dati personali (GDPR) è obbligatorio per completare la registrazione.');
      err.statusCode = 400;
      err.code = 'PRIVACY_CONSENT_REQUIRED';
      throw err;
    }

    const result = await authService.registerUser({
      email,
      password,
      nome,
      cognome,
      citta,
      coordinate_reali,
      coordinate_offuscate,
      consenso_privacy,
      consenso_geo: Boolean(consenso_geo)
    });

    res.status(201).json({
      success: true,
      message: 'Registrazione completata con successo.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Autentica le credenziali fornite e restituisce i token JWT di accesso e rinnovo
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);

    res.status(200).json({
      success: true,
      message: 'Accesso eseguito con successo.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Rinnova l'Access Token dell'utente a partire da un Refresh Token valido
const refreshToken = async (req, res, next) => {
  try {
    const token = req.body.refreshToken || req.headers['x-refresh-token'];
    const result = await authService.refreshSession(token);

    res.status(200).json({
      success: true,
      message: 'Sessione rinnovata con successo.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Restituisce le informazioni anagrafiche e di profilo dell'utente correntemente autenticato
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUserProfile(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Esegue il logout logico della sessione confermando al client l'eliminazione dei token locali
const logout = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Disconnessione completata con successo. Rimuovere i token di sessione dalla memoria client.'
  });
};

// Esporta i metodi del controller di autenticazione
module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  logout
};
