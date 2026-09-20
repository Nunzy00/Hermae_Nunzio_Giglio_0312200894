// Definizione del router Express dedicato agli endpoint CRUD dell'entità utenti
const express = require('express');
const userController = require('../controllers/userController');

// Istanzia il router modulare di Express per le rotte dell'entità utenti
const router = express.Router();

// Rotta per la registrazione e creazione di un nuovo profilo utente (Create)
router.post('/', userController.createUser);

// Rotta per la consultazione paginata e filtrata dell'elenco utenti (Read All)
router.get('/', userController.getAllUsers);

// Rotta per il recupero del singolo profilo utente tramite UUID (Read One)
router.get('/:id', userController.getUserById);

// Rotta per l'aggiornamento parziale o totale dei dati utente tramite UUID (Update)
router.put('/:id', userController.updateUser);

// Rotta per la rimozione definitiva dell'account utente tramite UUID (Delete)
router.delete('/:id', userController.deleteUser);

// Esporta il router configurato delle rotte utenti
module.exports = router;
