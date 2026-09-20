// Controller per la gestione delle richieste HTTP afferenti all'entità Esemplare e Categorie
const esemplariService = require('../services/esemplariService');

/**
 * Restituisce l'elenco degli esemplari appartenenti all'utente autenticato
 */
const getMyBooks = async (req, res, next) => {
  try {
    const { categoria_id, sottogenere, stato_disponibilita, search } = req.query;
    const books = await esemplariService.getMyEsemplari(req.user.id, {
      categoria_id,
      sottogenere,
      stato_disponibilita,
      search
    });

    res.status(200).json({
      success: true,
      count: books.length,
      data: books
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Crea un nuovo esemplare associandolo all'utente autenticato
 */
const createBook = async (req, res, next) => {
  try {
    const newBook = await esemplariService.createEsemplare(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Nuovo esemplare registrato con successo nel catalogo personale.',
      data: newBook
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Recupera i dettagli di un singolo esemplare tramite ID
 */
const getBookById = async (req, res, next) => {
  try {
    const book = await esemplariService.getEsemplareById(req.params.id);
    res.status(200).json({
      success: true,
      data: book
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Aggiorna i metadati di un esemplare esistente (solo proprietario)
 */
const updateBook = async (req, res, next) => {
  try {
    const updatedBook = await esemplariService.updateEsemplare(req.params.id, req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Esemplare aggiornato con successo.',
      data: updatedBook
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina un esemplare dal catalogo (solo proprietario)
 */
const deleteBook = async (req, res, next) => {
  try {
    const result = await esemplariService.deleteEsemplare(req.params.id, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Esegue una ricerca pubblica/filtrata degli esemplari disponibili
 */
const searchBooks = async (req, res, next) => {
  try {
    const { search, categoria_id, sottogenere, stato_disponibilita, limit } = req.query;
    const books = await esemplariService.searchEsemplari({
      search,
      categoria_id,
      sottogenere,
      stato_disponibilita,
      limit
    });

    res.status(200).json({
      success: true,
      count: books.length,
      data: books
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Restituisce l'elenco delle categorie bibliografiche/disciplinari
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await esemplariService.getAllCategorie();
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyBooks,
  createBook,
  getBookById,
  updateBook,
  deleteBook,
  searchBooks,
  getCategories
};
