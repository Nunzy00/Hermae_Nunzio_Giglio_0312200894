/**
 * Test Suite Fase 18 — Entità Esemplare, Schema, Relazioni e Operazioni CRUD
 * Piattaforma Hermae (PW 14 — Nunzio Giglio Matr. 0312200894)
 */

const http = require('http');
const app = require('./src/app');

let server;
let port;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
            rawBody: body
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: body
          });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function loginUser(email, password) {
  const res = await request({
    hostname: '127.0.0.1',
    port: port,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password });

  if (res.statusCode !== 200 || !res.body?.data?.tokens?.accessToken) {
    throw new Error(`Login fallito per ${email}: ${JSON.stringify(res.body)}`);
  }
  return {
    user: res.body.data.user,
    token: res.body.data.tokens.accessToken
  };
}

async function runTests() {
  console.log('================================================================');
  console.log(' AVVIO TEST SUITE FASE 18 — ENTITÀ ESEMPLARE & CRUD BIBLIOGRAFICO');
  console.log('================================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      console.log(`✓ Test server avviato su porta effimera: ${port}\n`);
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // 1. Test categorie
    console.log('[GRUPPO 1] Tassonomia Categorie Disciplinari (Livello 1 e 2)');
    const catRes = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/categorie',
      method: 'GET'
    });
    assert(catRes.statusCode === 200, 'GET /api/categorie restituisce 200 OK');
    assert(Array.isArray(catRes.body?.data) && catRes.body.data.length === 10, 'Macro-categorie presenti = 10 (standard Thema/BISAC)');
    const categories = catRes.body?.data || [];
    const catNarrativa = categories.find(c => c.slug === 'narrativa-romanzi');
    assert(Boolean(catNarrativa), 'Categoria "narrativa-romanzi" identificata correttamente');
    assert(catNarrativa.icona === 'bi-book' && catNarrativa.colore_hex === '#be123c', 'Metadati grafici icona e colore presenti');
    assert(Array.isArray(catNarrativa.sottogeneri_predefiniti) && catNarrativa.sottogeneri_predefiniti.includes('Fantascienza & Distopia'), 'Array sottogeneri predefiniti Thema/BISAC valorizzato');

    // 2. Test autenticazione e sicurezza
    console.log('\n[GRUPPO 2] Protezione Endpoints Riservati e Autenticazione');
    const noAuthRes = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari/mie',
      method: 'GET'
    });
    assert(noAuthRes.statusCode === 401, 'GET /api/esemplari/mie senza token restituisce 401 Unauthorized');

    // Login Utente Demo e Secondo Utente (Laura Bianchi)
    const demoAuth = await loginUser('demo@hermae.it', 'Password123!');
    const lauraAuth = await loginUser('laura.bianchi@example.com', 'PasswordSicura456!');
    console.log(`  ✓ Token generati per demo (${demoAuth.user.email}) e laura (${lauraAuth.user.email})`);

    // 3. Test lettura libreria personale (getMyBooks)
    console.log('\n[GRUPPO 3] Consultazione Libreria Personale (getMyBooks)');
    const myBooksRes = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari/mie',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${demoAuth.token}` }
    });
    assert(myBooksRes.statusCode === 200, 'GET /api/esemplari/mie con token restituisce 200 OK');
    assert(myBooksRes.body?.data?.length >= 3, `Libreria demo contiene ${myBooksRes.body?.data?.length} volumi mock`);
    const primoLibro = myBooksRes.body?.data?.[0];
    assert(primoLibro && primoLibro.titolo && primoLibro.stato_conservazione, 'Record formattato con titolo e stato di conservazione');

    // 4. Test validazione creazione esemplare (createBook)
    console.log('\n[GRUPPO 4] Creazione Nuovo Esemplare & Validazioni');
    // 4.1 Titolo mancante
    const inv1 = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${demoAuth.token}`,
        'Content-Type': 'application/json'
      }
    }, { autore: 'Autore Test', categoria_id: catNarrativa.id });
    assert(inv1.statusCode === 400 && inv1.body?.error?.code === 'TITOLO_REQUIRED', 'Rifiuta creazione senza titolo (400 TITOLO_REQUIRED)');

    // 4.2 Autore mancante
    const inv2 = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${demoAuth.token}`,
        'Content-Type': 'application/json'
      }
    }, { titolo: 'Titolo Test', categoria_id: catNarrativa.id });
    assert(inv2.statusCode === 400 && inv2.body?.error?.code === 'AUTORE_REQUIRED', 'Rifiuta creazione senza autore (400 AUTORE_REQUIRED)');

    // 4.3 Creazione valida con ereditarietà coordinate geospaziali e sottogenere L2
    const newBookPayload = {
      titolo: 'Saggio sulla lucidità',
      autore: 'José Saramago',
      editore: 'Einaudi',
      anno_pubblicazione: 2004,
      isbn: '9788806178499',
      lingua: 'Italiano',
      descrizione: 'Romanzo allegorico sul voto in bianco e le dinamiche del potere democratico.',
      note: 'Copertina integra, lievi segni di piega all\'angolo superiore.',
      stato_conservazione: 'Buono',
      stato_disponibilita: 'DISPONIBILE',
      categoria_id: catNarrativa.id,
      sottogenere: 'Fantascienza & Distopia'
    };

    const createRes = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${demoAuth.token}`,
        'Content-Type': 'application/json'
      }
    }, newBookPayload);

    assert(createRes.statusCode === 201, 'POST /api/esemplari restituisce 201 Created');
    assert(createRes.body?.data?.id, 'ID UUID generato per il nuovo esemplare');
    assert(createRes.body?.data?.titolo === newBookPayload.titolo, 'Titolo memorizzato correttamente');
    assert(createRes.body?.data?.sottogenere === 'Fantascienza & Distopia', 'Sottogenere (Livello 2) memorizzato correttamente');
    assert(createRes.body?.data?.coordinate?.lat !== null, 'Coordinate geospaziali ereditate automaticamente dalla posizione utente');
    const createdId = createRes.body?.data?.id;

    // 5. Test recupero dettaglio per ID (getBookById)
    console.log('\n[GRUPPO 5] Recupero Dettaglio Esemplare per ID');
    const getByIdRes = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${createdId}`,
      method: 'GET'
    });
    assert(getByIdRes.statusCode === 200, 'GET /api/esemplari/:id restituisce 200 OK');
    assert(getByIdRes.body?.data?.proprietario?.nome === 'Nunzio', 'Dettaglio include informazioni proprietario e città');
    assert(getByIdRes.body?.data?.sottogenere === 'Fantascienza & Distopia', 'Dettaglio include sottogenere L2');

    // 6. Test sicurezza di titolarità (Ownership / Authorization 403)
    console.log('\n[GRUPPO 6] Controllo di Titolarità e Sicurezza Autorizzativa');
    // Laura tenta di modificare il libro appena creato da Nunzio
    const forbiddenPut = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${createdId}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${lauraAuth.token}`,
        'Content-Type': 'application/json'
      }
    }, { titolo: 'Tentativo Manomissione Titolo' });
    assert(forbiddenPut.statusCode === 403, 'PUT /api/esemplari/:id da utente non titolare restituisce 403 Forbidden');
    assert(forbiddenPut.body?.error?.code === 'FORBIDDEN_NOT_OWNER', 'Codice errore FORBIDDEN_NOT_OWNER');

    // Laura tenta di cancellare il libro di Nunzio
    const forbiddenDel = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${createdId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${lauraAuth.token}`
      }
    });
    assert(forbiddenDel.statusCode === 403, 'DELETE /api/esemplari/:id da utente non titolare restituisce 403 Forbidden');

    // 7. Test aggiornamento autorizzato da parte del proprietario (incluso sottogenere)
    console.log('\n[GRUPPO 7] Aggiornamento Metadati da Proprietario (updateBook)');
    const updateRes = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${createdId}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${demoAuth.token}`,
        'Content-Type': 'application/json'
      }
    }, {
      stato_conservazione: 'Ottimo',
      note: 'Note aggiornate: copertina ripulita e protetta.',
      sottogenere: 'Narrativa Filosofica'
    });
    assert(updateRes.statusCode === 200, 'PUT /api/esemplari/:id da proprietario restituisce 200 OK');
    assert(updateRes.body?.data?.stato_conservazione === 'Ottimo', 'Stato di conservazione aggiornato a "Ottimo"');
    assert(updateRes.body?.data?.sottogenere === 'Narrativa Filosofica', 'Sottogenere aggiornato con successo a "Narrativa Filosofica"');
    assert(updateRes.body?.data?.note.includes('protetta'), 'Note bibliografiche aggiornate con successo');

    // 8. Test cancellazione autorizzata (deleteBook)
    console.log('\n[GRUPPO 8] Eliminazione Esemplare da Proprietario (deleteBook)');
    const delRes = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${createdId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${demoAuth.token}`
      }
    });
    assert(delRes.statusCode === 200, 'DELETE /api/esemplari/:id da proprietario restituisce 200 OK');
    assert(delRes.body?.success === true, 'Conferma di successo cancellazione');

    // Verifica che l'esemplare sia effettivamente rimosso
    const checkAfterDel = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${createdId}`,
      method: 'GET'
    });
    assert(checkAfterDel.statusCode === 404, 'GET /api/esemplari/:id dopo DELETE restituisce 404 Not Found');

    // 9. Test ricerca ed esplorazione catalogo pubblico (searchBooks)
    console.log('\n[GRUPPO 9] Ricerca e Filtri Catalogo Pubblico (searchBooks)');
    const searchRes = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari?search=Eco',
      method: 'GET'
    });
    assert(searchRes.statusCode === 200, 'GET /api/esemplari?search=Eco restituisce 200 OK');
    assert(searchRes.body?.data?.length >= 2, `Trovati ${searchRes.body?.data?.length} volumi di Umberto Eco`);

    // 10. Test filtri avanzati per macro-categoria e sottogenere (Tassonomia a 2 Livelli)
    console.log('\n[GRUPPO 10] Filtri Tassonomia Ibrida a Due Livelli (searchBooks)');
    const catSearch = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari?categoria_id=${catNarrativa.id}`,
      method: 'GET'
    });
    assert(catSearch.statusCode === 200, 'GET /api/esemplari per categoria specifica restituisce 200 OK');
    assert(catSearch.body?.data?.every(b => b.categoria_id === catNarrativa.id), 'Tutti i risultati appartengono alla macro-categoria richiesta');

    // Ricerca per sottogenere
    const subSearch = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari?sottogenere=Ingegneria%20del%20Software',
      method: 'GET'
    });
    assert(subSearch.statusCode === 200, 'GET /api/esemplari?sottogenere=... restituisce 200 OK');
    assert(subSearch.body?.data?.length >= 1, `Trovati ${subSearch.body?.data?.length} volumi nel sottogenere "Ingegneria del Software"`);
    assert(subSearch.body?.data?.every(b => b.sottogenere === 'Ingegneria del Software'), 'Tutti i volumi filtrati matchano esattamente il sottogenere');

  } catch (err) {
    console.error('Errore imprevisto durante l\'esecuzione dei test:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(` RIEPILOGO TEST FASE 18: ${passed} PASSATI, ${failed} FALLITI`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
