/**
 * Test Suite Fase 20 — Occultamento della libreria e/o dei singoli libri per tutela privacy
 * Hermae — Nunzio Giglio (Matr. 0312200894)
 *
 * Verifica dei requisiti:
 * 1. Controllo granulare singolo libro (visibile_pubblico = true / false)
 * 2. Visualizzazione completa nella vista personale dell'utente proprietario (GET /api/esemplari/mie)
 * 3. Esclusione totale dei libri privati dalle ricerche pubbliche di catalogo/community (GET /api/esemplari)
 * 4. Protezione dell'endpoint singolo esemplare (GET /api/esemplari/:id) con restituzione 404 a terzi
 * 5. Endpoint atomico PATCH /api/esemplari/:id/visibilita con verifica di titolarità (403 se non proprietario)
 * 6. Occultamento dell'intero scaffale personale tramite preferenze privacy (mostra_libreria = false)
 * 7. Risoluzione della difficoltà metodologica: Query DRY condivisa tra viste personali e comunitarie
 */

const http = require('http');
const app = require('./src/app');
const db = require('./src/config/db');

let server;
let port;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const rawBody = rawBuffer.toString('utf-8');
        let body = null;
        try {
          body = JSON.parse(rawBody);
        } catch (e) {
          body = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          rawBody
        });
      });
    });
    req.on('error', reject);
    if (data) {
      if (typeof data === 'string') {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
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
  console.log('========================================================================');
  console.log(' AVVIO TEST SUITE FASE 20 — OCCULTAMENTO LIBRERIA & TUTELA PRIVACY');
  console.log(' Hermae — Nunzio Giglio (Matr. 0312200894)');
  console.log('========================================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      console.log(`[TEST-INIT] Server HTTP di test avviato su porta effimera :${port}\n`);
      resolve();
    });
  });

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // 1. Autenticazione Utente A (Proprietario dei libri) e Utente B (Membro community terzo)
    console.log('[FASE 20 - STEP 1] Autenticazione Utente A e Utente B...');
    const userA = await loginUser('demo@hermae.it', 'Password123!');
    const userB = await loginUser('laura.bianchi@example.com', 'PasswordSicura456!');
    assert(userA.token && userB.token, 'Token JWT ottenuti con successo per Utente A e Utente B');

    // Assicura che le preferenze privacy di Utente A siano inizializzate con mostra_libreria = true
    await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/privacy/me',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userA.token}`
      }
    }, { mostra_libreria: true });

    // Recupera la prima categoria disponibile
    const catRes = await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/categorie',
      method: 'GET'
    });
    const testCatId = catRes.body.data[0].id;

    // 2. Creazione di un libro pubblico e di un libro privato da parte di Utente A
    console.log('\n[FASE 20 - STEP 2] Creazione di libro pubblico e libro privato da parte di Utente A...');
    
    // Libro 1: Pubblico (default visibile_pubblico = true)
    const pubBookRes = await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/esemplari',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userA.token}`
      }
    }, {
      titolo: 'Libro Pubblico Test Fase 20',
      autore: 'Autore Pubblico',
      categoria_id: testCatId,
      sottogenere: 'Saggistica',
      visibile_pubblico: true
    });
    assert(pubBookRes.statusCode === 201, 'Creazione libro pubblico terminata con HTTP 201 Created');
    const pubBookId = pubBookRes.body.data.id;
    assert(pubBookRes.body.data.visibile_pubblico === true, 'Il libro pubblico ha visibile_pubblico === true');

    // Libro 2: Privato (visibile_pubblico = false)
    const privBookRes = await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/esemplari',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userA.token}`
      }
    }, {
      titolo: 'Libro Riservato Test Fase 20',
      autore: 'Autore Riservato',
      categoria_id: testCatId,
      sottogenere: 'Memorie Private',
      visibile_pubblico: false
    });
    assert(privBookRes.statusCode === 201, 'Creazione libro riservato terminata con HTTP 201 Created');
    const privBookId = privBookRes.body.data.id;
    assert(privBookRes.body.data.visibile_pubblico === false, 'Il libro privato ha visibile_pubblico === false');

    // 3. Vista ad uso personale di Utente A (GET /api/esemplari/mie)
    console.log('\n[FASE 20 - STEP 3] Verifica vista personale proprietario (GET /api/esemplari/mie)...');
    const myBooksRes = await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/esemplari/mie',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userA.token}` }
    });
    assert(myBooksRes.statusCode === 200, 'Recupero libreria personale con HTTP 200 OK');
    const myBookIds = myBooksRes.body.data.map(b => b.id);
    assert(myBookIds.includes(pubBookId), 'La libreria personale include il libro pubblico');
    assert(myBookIds.includes(privBookId), 'La libreria personale include il libro privato (consultazione privata garantita)');

    // 4. Filtro privacy nella vista personale (visibilita = 'PRIVATO' e 'PUBBLICO')
    console.log('\n[FASE 20 - STEP 4] Verifica filtri visibilità nella vista personale...');
    const myPrivateBooks = await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/esemplari/mie?visibilita=PRIVATO',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userA.token}` }
    });
    assert(
      myPrivateBooks.body.data.some(b => b.id === privBookId) && !myPrivateBooks.body.data.some(b => b.id === pubBookId),
      'Filtro visibilita=PRIVATO restituisce solo i volumi privati'
    );

    const myPublicBooks = await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/esemplari/mie?visibilita=PUBBLICO',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userA.token}` }
    });
    assert(
      myPublicBooks.body.data.some(b => b.id === pubBookId) && !myPublicBooks.body.data.some(b => b.id === privBookId),
      'Filtro visibilita=PUBBLICO restituisce solo i volumi pubblici'
    );

    // 5. Ricerca catalogo della community (GET /api/esemplari)
    console.log('\n[FASE 20 - STEP 5] Verifica ricerca pubblica della community (GET /api/esemplari)...');
    const searchPublicRes = await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/esemplari?search=Test%20Fase%2020',
      method: 'GET'
    });
    assert(searchPublicRes.statusCode === 200, 'Ricerca catalogo pubblica risponde HTTP 200 OK');
    const foundBookIds = searchPublicRes.body.data.map(b => b.id);
    assert(foundBookIds.includes(pubBookId), 'La ricerca pubblica trova il libro marcato visibile_pubblico = true');
    assert(!foundBookIds.includes(privBookId), 'La ricerca pubblica OCCULTA tassativamente il libro privato (visibile_pubblico = false)');

    // 6. Accesso diretto a singolo esemplare tramite ID (GET /api/esemplari/:id)
    console.log('\n[FASE 20 - STEP 6] Verifica accesso diretto GET /api/esemplari/:id e protezione privacy...');
    
    // Utente A (proprietario) accede al proprio libro privato
    const ownerPrivAccess = await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${privBookId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userA.token}` }
    });
    assert(ownerPrivAccess.statusCode === 200, 'Utente A (proprietario) accede al proprio libro privato con HTTP 200 OK');

    // Utente B (terzo) tenta di accedere al libro privato di Utente A
    const thirdPartyPrivAccess = await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${privBookId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userB.token}` }
    });
    assert(thirdPartyPrivAccess.statusCode === 404, 'Utente B riceve HTTP 404 Not Found (occultamento e anti-enumerazione OWASP)');

    // Visitatore anonimo tenta di accedere al libro privato di Utente A
    const anonPrivAccess = await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${privBookId}`,
      method: 'GET'
    });
    assert(anonPrivAccess.statusCode === 404, 'Visitatore anonimo riceve HTTP 404 Not Found sul libro privato');

    // Utente B accede al libro pubblico di Utente A
    const thirdPartyPubAccess = await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${pubBookId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userB.token}` }
    });
    assert(thirdPartyPubAccess.statusCode === 200, 'Utente B accede regolarmente al libro pubblico di Utente A (HTTP 200 OK)');

    // 7. Toggle atomico della visibilità (PATCH /api/esemplari/:id/visibilita)
    console.log('\n[FASE 20 - STEP 7] Test endpoint PATCH /api/esemplari/:id/visibilita (Toggle visibilità)...');
    
    // Utente A inverte la visibilità del libro privato -> diventa pubblico
    const toggleToPubRes = await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${privBookId}/visibilita`,
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${userA.token}` }
    });
    assert(toggleToPubRes.statusCode === 200, 'Toggle visibilità da parte del proprietario risponde HTTP 200 OK');
    assert(toggleToPubRes.body.data.visibile_pubblico === true, 'Il libro è diventato pubblico (visibile_pubblico: true)');

    // Ora Utente B può visualizzarlo
    const checkNowPublic = await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${privBookId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userB.token}` }
    });
    assert(checkNowPublic.statusCode === 200, 'Dopo il toggle a pubblico, Utente B può visualizzare la scheda libro');

    // Utente A inverte nuovamente -> torna privato
    const toggleBackToPrivRes = await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${privBookId}/visibilita`,
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${userA.token}` }
    });
    assert(toggleBackToPrivRes.body.data.visibile_pubblico === false, 'Il libro è tornato privato (visibile_pubblico: false)');

    // Utente B tenta il toggle sul libro di Utente A (tentativo illecito)
    const unauthorizedToggle = await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${privBookId}/visibilita`,
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${userB.token}` }
    });
    assert(unauthorizedToggle.statusCode === 403, 'Tentativo di toggle da parte di un non proprietario bloccato con HTTP 403 Forbidden');

    // 8. Occultamento dell'intera libreria (mostra_libreria = false)
    console.log('\n[FASE 20 - STEP 8] Test occultamento intera libreria personale (mostra_libreria = false)...');
    
    // Utente A imposta mostra_libreria = false
    const hideLibraryRes = await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/privacy/me',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userA.token}`
      }
    }, { mostra_libreria: false });
    assert(hideLibraryRes.statusCode === 200, 'Aggiornamento preferenze privacy (mostra_libreria: false) riuscito');

    // Ora NESSUN libro di Utente A (nemmeno quello pubblico) deve apparire nella ricerca community
    const searchWithHiddenLib = await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/esemplari?search=Test%20Fase%2020',
      method: 'GET'
    });
    const hiddenLibFoundIds = searchWithHiddenLib.body.data.map(b => b.id);
    assert(
      !hiddenLibFoundIds.includes(pubBookId) && !hiddenLibFoundIds.includes(privBookId),
      'Con mostra_libreria = false, NESSUN libro di Utente A appare nella ricerca pubblica della community'
    );

    // Utente B tenta di accedere direttamente al libro (teoricamente pubblico) di Utente A
    const accessPubBookWhenLibHidden = await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${pubBookId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userB.token}` }
    });
    assert(
      accessPubBookWhenLibHidden.statusCode === 404,
      'Accesso diretto da terzi a un libro pubblico di un utente con libreria occultata restituisce HTTP 404'
    );

    // Utente A vede comunque tutti i suoi libri nella vista personale
    const myBooksStillVisibleToOwner = await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/esemplari/mie',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userA.token}` }
    });
    const ownerBookIds = myBooksStillVisibleToOwner.body.data.map(b => b.id);
    assert(
      ownerBookIds.includes(pubBookId) && ownerBookIds.includes(privBookId),
      'L\'Utente A vede e gestisce TUTTI i propri volumi nel proprio pannello personale anche se l\'intera libreria è occultata'
    );

    // Ripristino mostra_libreria = true per Utente A
    await request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/privacy/me',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userA.token}`
      }
    }, { mostra_libreria: true });

    // 9. Modifica metadati e flag visibilita via PUT
    console.log('\n[FASE 20 - STEP 9] Verifica aggiornamento visibile_pubblico tramite PUT /api/esemplari/:id...');
    const updateRes = await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${pubBookId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userA.token}`
      }
    }, {
      titolo: 'Libro Pubblico Test Fase 20 (Rinominato)',
      autore: 'Autore Pubblico',
      categoria_id: testCatId,
      visibile_pubblico: false
    });
    assert(updateRes.statusCode === 200, 'Aggiornamento metadati via PUT riuscito');
    assert(updateRes.body.data.visibile_pubblico === false, 'visibile_pubblico aggiornato correttamente a false via PUT');

    // 10. Pulizia record di test
    console.log('\n[FASE 20 - STEP 10] Pulizia record di test creati...');
    await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${pubBookId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${userA.token}` }
    });
    await request({
      hostname: '127.0.0.1',
      port: port,
      path: `/api/esemplari/${privBookId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${userA.token}` }
    });
    console.log('  🧹 Record di test eliminati.');

  } catch (err) {
    console.error('ERRORE IMPREVISTO DURANTE L\'ESECUZIONE DEI TEST:', err);
    failCount++;
  } finally {
    server.close();
    await db.pool.end();
  }

  console.log('\n========================================================================');
  console.log(` RIEPILOGO TEST FASE 20: ${passCount} Superati, ${failCount} Falliti`);
  console.log('========================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
