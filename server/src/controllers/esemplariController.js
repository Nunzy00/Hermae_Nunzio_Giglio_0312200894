// Controller per la gestione delle richieste HTTP afferenti all'entità Esemplare e Categorie
const esemplariService = require('../services/esemplariService');
const imageService = require('../services/imageService');

/**
 * Restituisce l'elenco degli esemplari appartenenti all'utente autenticato
 */
const getMyBooks = async (req, res, next) => {
  try {
    const { categoria_id, sottogenere, stato_disponibilita, search, visibilita } = req.query;
    const books = await esemplariService.getMyEsemplari(req.user.id, {
      categoria_id,
      sottogenere,
      stato_disponibilita,
      search,
      visibilita
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
    const book = await esemplariService.getEsemplareById(req.params.id, req.user?.id);
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
 * Carica ed elabora la copertina di un esemplare in formato WebP (standard e miniatura)
 */
const uploadCover = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      const error = new Error('Nessun file immagine fornito nel corpo della richiesta (campo "copertina").');
      error.statusCode = 400;
      error.code = 'FILE_REQUIRED';
      throw error;
    }

    const { id } = req.params;
    const { copertinaUrl, miniaturaUrl } = await imageService.processBookCover(req.file.buffer, id);

    const updatedBook = await esemplariService.updateBookCover(id, req.user.id, {
      copertinaUrl,
      miniaturaUrl
    });

    res.status(200).json({
      success: true,
      message: 'Copertina e miniatura WebP elaborate e associate con successo all\'esemplare.',
      data: updatedBook
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Rimuove la copertina personalizzata associata a un esemplare
 */
const removeCover = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedBook = await esemplariService.removeBookCover(id, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Copertina personalizzata rimossa con successo dall\'esemplare.',
      data: updatedBook
    });
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

/**
 * Alterna lo stato di visibilità pubblica/privata di un esemplare (solo proprietario)
 */
const toggleVisibilita = async (req, res, next) => {
  try {
    const updatedBook = await esemplariService.toggleVisibilitaEsemplare(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      message: `Visibilità esemplare impostata su ${updatedBook.visibile_pubblico ? 'PUBBLICO' : 'PRIVATO'}.`,
      data: updatedBook
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
  uploadCover,
  removeCover,
  searchBooks,
  getCategories,
  toggleVisibilita
};
