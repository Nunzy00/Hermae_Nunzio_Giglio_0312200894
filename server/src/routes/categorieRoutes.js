// Router Express per la consultazione della tassonomia delle categorie disciplinari
const express = require('express');
const esemplariController = require('../controllers/esemplariController');

const router = express.Router();

// Recupera l'elenco delle categorie tematiche con conteggio associato degli esemplari
router.get('/', esemplariController.getCategories);

module.exports = router;
