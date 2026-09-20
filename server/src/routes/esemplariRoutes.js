// Router Express per la gestione degli endpoint dell'entità Esemplare
const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const esemplariController = require('../controllers/esemplariController');

const router = express.Router();

// 1. Recupera tutti gli esemplari dell'utente autenticato (Libreria personale)
router.get('/mie', authenticate, esemplariController.getMyBooks);

// 2. Crea un nuovo esemplare associato all'utente autenticato
router.post('/', authenticate, esemplariController.createBook);

// 3. Ricerca catalogo esemplari disponibili nella piattaforma
router.get('/', esemplariController.searchBooks);

// 4. Recupera singolo esemplare tramite ID
router.get('/:id', esemplariController.getBookById);

// 5. Aggiorna metadati dell'esemplare (richiede autenticazione e titolarità)
router.put('/:id', authenticate, esemplariController.updateBook);

// 6. Elimina esemplare dal catalogo (richiede autenticazione e titolarità)
router.delete('/:id', authenticate, esemplariController.deleteBook);

module.exports = router;
