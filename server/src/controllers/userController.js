// Controller HTTP per la gestione delle richieste REST relative all'entità utenti
const userService = require('../services/userService');

// Gestisce la registrazione e creazione di un nuovo profilo utente con validazione dei dati obbligatori
const createUser = async (req, res, next) => {
  try {
    const { email, password, nome, cognome, citta, coordinate_reali, coordinate_offuscate, consenso_privacy, consenso_geo } = req.body;

    if (!email || !password || !nome || !cognome || !citta || !coordinate_reali) {
      const err = new Error('Tutti i campi obbligatori devono essere valorizzati (email, password, nome, cognome, citta, coordinate_reali).');
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

    const newUser = await userService.createUser({
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
      message: 'Utente registrato con successo.',
      data: newUser
    });
  } catch (error) {
    next(error);
  }
};

// Gestisce la lettura paginata e filtrata dei profili utenti registrati
const getAllUsers = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const citta = req.query.citta || null;

    const result = await userService.getAllUsers({ limit, offset, citta });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Gestisce il recupero dei dettagli di un singolo profilo utente tramite il suo identificatore UUID
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);

    if (!user) {
      const err = new Error(`Nessun utente trovato con ID: ${id}`);
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Gestisce l'aggiornamento dei dati anagrafici, territoriali e di preferenze di un profilo utente
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedUser = await userService.updateUser(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Profilo utente aggiornato con successo.',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

// Gestisce la cancellazione definitiva di un account utente e la revoca di tutte le risorse correlate
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await userService.deleteUser(id);

    res.status(200).json({
      success: true,
      message: 'Profilo utente eliminato con successo.',
      data: deleted
    });
  } catch (error) {
    next(error);
  }
};

// Esporta i metodi del controller utente per l'associazione alle rotte HTTP
module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
};
