// Router Express per la gestione degli endpoint dell'entità Esemplare
const express = require('express');
const { authenticate, optionalAuth } = require('../middlewares/authMiddleware');
const { uploadCoverMiddleware } = require('../middlewares/uploadMiddleware');
const esemplariController = require('../controllers/esemplariController');

const router = express.Router();

// 1. Recupera tutti gli esemplari dell'utente autenticato (Libreria personale)
router.get('/mie', authenticate, esemplariController.getMyBooks);

// 2. Crea un nuovo esemplare associato all'utente autenticato
router.post('/', authenticate, esemplariController.createBook);

// 3. Ricerca catalogo esemplari disponibili nella piattaforma
router.get('/', esemplariController.searchBooks);

// 4. Recupera singolo esemplare tramite ID (optionalAuth per verificare se chi consulta è il proprietario di un esemplare privato)
router.get('/:id', optionalAuth, esemplariController.getBookById);

// 5. Alterna lo stato di visibilità pubblica/privata dell'esemplare (richiede autenticazione e titolarità)
router.patch('/:id/visibilita', authenticate, esemplariController.toggleVisibilita);

// 6. Aggiorna metadati dell'esemplare (richiede autenticazione e titolarità)
router.put('/:id', authenticate, esemplariController.updateBook);

// 6. Elimina esemplare dal catalogo (richiede autenticazione e titolarità)
router.delete('/:id', authenticate, esemplariController.deleteBook);

// 7. Carica ed elabora copertina e miniatura WebP (richiede autenticazione e titolarità)
router.post('/:id/copertina', authenticate, uploadCoverMiddleware, esemplariController.uploadCover);

// 8. Rimuove la copertina personalizzata associata all'esemplare (richiede autenticazione e titolarità)
router.delete('/:id/copertina', authenticate, esemplariController.removeCover);

module.exports = router;
