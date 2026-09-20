/**
 * Test Suite Fase 19 — Implementazione delle funzioni CRUD libri & Upload copertina
 * Hermae — Nunzio Giglio (Matr. 0312200894)
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const app = require('./src/app');

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
          rawBody,
          rawBuffer
        });
      });
    });
    req.on('error', reject);
    if (data) {
      if (Buffer.isBuffer(data)) {
        req.write(data);
      } else if (typeof data === 'string') {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    req.end();
  });
}

// Crea una richiesta multipart/form-data grezza con buffer binario
function sendMultipart(options, fieldName, fileName, fileBuffer, mimeType) {
  const boundary = '----WebKitFormBoundaryHermaeTest' + Math.random().toString(36).substring(2);
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const payload = Buffer.concat([
    Buffer.from(header, 'utf-8'),
    fileBuffer,
    Buffer.from(footer, 'utf-8')
  ]);

  const reqOptions = {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length
    }
  };

  return request(reqOptions, payload);
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
  console.log(' AVVIO TEST SUITE FASE 19 — CRUD LIBRI & UPLOAD COPERTINA WEBP');
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
    // Recupero categoria valida per i test
    const catRes = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/categorie',
      method: 'GET'
    });
    const catInformatica = catRes.body?.data?.find(c => c.slug === 'informatica-tecnologia');

    // Login Utente Proprietario (demo) e Utente Terzo (Laura)
    const demoAuth = await loginUser('demo@hermae.it', 'Password123!');
    const lauraAuth = await loginUser('laura.bianchi@example.com', 'PasswordSicura456!');

    // -------------------------------------------------------------
    // GRUPPO 1: Validazione Granulare Campi Obbligatori e Opzionali (Server-Side)
    // -------------------------------------------------------------
    console.log('[GRUPPO 1] Validazione Granulare Campi Obbligatori e Opzionali');

    // 1.1 Titolo mancante o vuoto
    const invTitolo = await request({
      hostname: '127.0.0.1', port, path: '/api/esemplari', method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}`, 'Content-Type': 'application/json' }
    }, { autore: 'Autore Test', categoria_id: catInformatica.id });
    assert(invTitolo.statusCode === 400 && invTitolo.body?.error?.code === 'TITOLO_REQUIRED', 'Rifiuta creazione senza titolo (400 TITOLO_REQUIRED)');

    // 1.2 Titolo oltre 255 caratteri
    const invTitoloLunghezza = await request({
      hostname: '127.0.0.1', port, path: '/api/esemplari', method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}`, 'Content-Type': 'application/json' }
    }, { titolo: 'A'.repeat(256), autore: 'Autore Test', categoria_id: catInformatica.id });
    assert(invTitoloLunghezza.statusCode === 400 && invTitoloLunghezza.body?.error?.code === 'TITOLO_TOO_LONG', 'Rifiuta titolo oltre 255 caratteri (400 TITOLO_TOO_LONG)');

    // 1.3 Autore mancante
    const invAutore = await request({
      hostname: '127.0.0.1', port, path: '/api/esemplari', method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}`, 'Content-Type': 'application/json' }
    }, { titolo: 'Titolo Test', categoria_id: catInformatica.id });
    assert(invAutore.statusCode === 400 && invAutore.body?.error?.code === 'AUTORE_REQUIRED', 'Rifiuta creazione senza autore (400 AUTORE_REQUIRED)');

    // 1.4 Categoria non valida (UUID errato)
    const invCatUuid = await request({
      hostname: '127.0.0.1', port, path: '/api/esemplari', method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}`, 'Content-Type': 'application/json' }
    }, { titolo: 'Titolo Test', autore: 'Autore Test', categoria_id: 'non-un-uuid' });
    assert(invCatUuid.statusCode === 400 && invCatUuid.body?.error?.code === 'CATEGORIA_INVALID', 'Rifiuta categoria con UUID malformato (400 CATEGORIA_INVALID)');

    // 1.5 Categoria inesistente
    const invCatNotFound = await request({
      hostname: '127.0.0.1', port, path: '/api/esemplari', method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}`, 'Content-Type': 'application/json' }
    }, { titolo: 'Titolo Test', autore: 'Autore Test', categoria_id: '00000000-0000-0000-0000-000000000000' });
    assert(invCatNotFound.statusCode === 400 && invCatNotFound.body?.error?.code === 'CATEGORIA_INVALID', 'Rifiuta categoria non esistente nel database (400 CATEGORIA_INVALID)');

    // 1.6 Anno di pubblicazione non valido (< 1450 o futuro)
    const invAnno = await request({
      hostname: '127.0.0.1', port, path: '/api/esemplari', method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}`, 'Content-Type': 'application/json' }
    }, { titolo: 'Titolo Test', autore: 'Autore Test', categoria_id: catInformatica.id, anno_pubblicazione: 1200 });
    assert(invAnno.statusCode === 400 && invAnno.body?.error?.code === 'ANNO_INVALID', 'Rifiuta anno di pubblicazione non consentito (400 ANNO_INVALID)');

    // 1.7 Codice ISBN non valido
    const invIsbn = await request({
      hostname: '127.0.0.1', port, path: '/api/esemplari', method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}`, 'Content-Type': 'application/json' }
    }, { titolo: 'Titolo Test', autore: 'Autore Test', categoria_id: catInformatica.id, isbn: '123-abc-non-valido' });
    assert(invIsbn.statusCode === 400 && invIsbn.body?.error?.code === 'ISBN_INVALID', 'Rifiuta codice ISBN con formato non conforme (400 ISBN_INVALID)');

    // 1.8 Stato conservazione non valido
    const invCons = await request({
      hostname: '127.0.0.1', port, path: '/api/esemplari', method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}`, 'Content-Type': 'application/json' }
    }, { titolo: 'Titolo Test', autore: 'Autore Test', categoria_id: catInformatica.id, stato_conservazione: 'Distrutto' });
    assert(invCons.statusCode === 400 && invCons.body?.error?.code === 'STATO_CONSERVAZIONE_INVALID', 'Rifiuta stato conservazione non censito (400 STATO_CONSERVAZIONE_INVALID)');

    // -------------------------------------------------------------
    // GRUPPO 2: Creazione Esemplare Valido con Normalizzazione
    // -------------------------------------------------------------
    console.log('\n[GRUPPO 2] Creazione Esemplare Valido e Normalizzazione Dati');
    const validBookPayload = {
      titolo: 'Designing Data-Intensive Applications',
      autore: 'Martin Kleppmann',
      categoria_id: catInformatica.id,
      sottogenere: 'Ingegneria del Software',
      editore: 'O\'Reilly Media',
      anno_pubblicazione: 2017,
      isbn: '978-1449373320',
      stato_conservazione: 'Ottimo',
      stato_disponibilita: 'DISPONIBILE',
      note: 'Edizione originale con copertina rigida.'
    };

    const createRes = await request({
      hostname: '127.0.0.1', port, path: '/api/esemplari', method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}`, 'Content-Type': 'application/json' }
    }, validBookPayload);

    assert(createRes.statusCode === 201, 'Creazione esemplare valido restituisce 201 Created');
    const bookId = createRes.body?.data?.id;
    assert(Boolean(bookId), 'ID UUID generato per il nuovo esemplare');
    assert(createRes.body?.data?.isbn === '978-1449373320', 'ISBN valido conservato correttamente');
    assert(createRes.body?.data?.sottogenere === 'Ingegneria del Software', 'Sottogenere associato correttamente');

    // -------------------------------------------------------------
    // GRUPPO 3: Upload Copertina Multipart con Multer & Sharp WebP
    // -------------------------------------------------------------
    console.log('\n[GRUPPO 3] Upload Copertina Multipart con Multer & Sharp (WebP 800px & 200px)');

    // Generazione in memoria di un'immagine di test ad alta risoluzione (1000x1500 px PNG)
    const testImageBuffer = await sharp({
      create: {
        width: 1000,
        height: 1500,
        channels: 3,
        background: { r: 30, g: 64, b: 175 }
      }
    }).png().toBuffer();

    const uploadRes = await sendMultipart({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${bookId}/copertina`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${demoAuth.token}`
      }
    }, 'copertina', 'test_cover.png', testImageBuffer, 'image/png');

    assert(uploadRes.statusCode === 200, 'POST /api/esemplari/:id/copertina restituisce 200 OK');
    assert(uploadRes.body?.success === true, 'Conferma di successo upload');
    const copertinaUrl = uploadRes.body?.data?.immagine_copertina;
    const miniaturaUrl = uploadRes.body?.data?.immagine_miniatura;

    assert(copertinaUrl && copertinaUrl.startsWith('/uploads/covers/cover-') && copertinaUrl.endsWith('.webp'), 'URL copertina standard generato in formato WebP');
    assert(miniaturaUrl && miniaturaUrl.startsWith('/uploads/covers/thumb-') && miniaturaUrl.endsWith('.webp'), 'URL miniatura generato in formato WebP');

    // Verifica presenza fisica dei file generati su filesystem
    const diskCoverPath = path.join(__dirname, copertinaUrl);
    const diskThumbPath = path.join(__dirname, miniaturaUrl);
    assert(fs.existsSync(diskCoverPath), 'File fisico copertina standard 800px presente su disco');
    assert(fs.existsSync(diskThumbPath), 'File fisico miniatura 200px presente su disco');

    // Verifica dimensioni e formato con Sharp
    const coverMeta = await sharp(diskCoverPath).metadata();
    assert(coverMeta.format === 'webp', 'Formato immagine standard convertito in WebP nativo');
    assert(coverMeta.width <= 800 && coverMeta.height <= 1200, 'Dimensioni copertina standard contenute entro 800x1200px');

    const thumbMeta = await sharp(diskThumbPath).metadata();
    assert(thumbMeta.format === 'webp', 'Formato miniatura convertito in WebP nativo');
    assert(thumbMeta.width <= 200 && thumbMeta.height <= 300, 'Dimensioni miniatura contenute entro 200x300px');

    // Verifica erogazione statica via HTTP
    const getCoverHttp = await request({
      hostname: '127.0.0.1',
      port,
      path: copertinaUrl,
      method: 'GET'
    });
    assert(getCoverHttp.statusCode === 200, 'GET HTTP su rotta statica copertina restituisce 200 OK');
    assert(getCoverHttp.headers['content-type'] === 'image/webp', 'Header Content-Type della rotta statica è "image/webp"');

    const getThumbHttp = await request({
      hostname: '127.0.0.1',
      port,
      path: miniaturaUrl,
      method: 'GET'
    });
    assert(getThumbHttp.statusCode === 200, 'GET HTTP su rotta statica miniatura restituisce 200 OK');
    assert(getThumbHttp.headers['content-type'] === 'image/webp', 'Header Content-Type della miniatura è "image/webp"');

    // -------------------------------------------------------------
    // GRUPPO 4: Sicurezza, Filtri MIME e Controlli di Titolarità
    // -------------------------------------------------------------
    console.log('\n[GRUPPO 4] Sicurezza Upload, Filtri MIME-Type e Titolarità');

    // 4.1 Invio file non ammesso (testo / script)
    const textBuffer = Buffer.from('Non sono un\'immagine ma uno script malevolo', 'utf-8');
    const rejectTypeRes = await sendMultipart({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${bookId}/copertina`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}` }
    }, 'copertina', 'malicious.txt', textBuffer, 'text/plain');
    assert(rejectTypeRes.statusCode === 400 && rejectTypeRes.body?.error?.code === 'FILE_TYPE_NOT_ALLOWED', 'Rifiuta upload di tipo MIME non immagine (400 FILE_TYPE_NOT_ALLOWED)');

    // 4.2 Richiesta senza file
    const noFileRes = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${bookId}/copertina`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${demoAuth.token}`,
        'Content-Type': 'application/json'
      }
    }, {});
    assert(noFileRes.statusCode === 400, 'Rifiuta upload copertina privo di file binario (400 FILE_REQUIRED)');

    // 4.3 Tentativo upload da utente non titolare (Laura su libro di Nunzio)
    const forbidUpload = await sendMultipart({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${bookId}/copertina`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${lauraAuth.token}` }
    }, 'copertina', 'hacked.png', testImageBuffer, 'image/png');
    assert(forbidUpload.statusCode === 403 && forbidUpload.body?.error?.code === 'FORBIDDEN_NOT_OWNER', 'Blocca upload copertina da utente non proprietario (403 FORBIDDEN_NOT_OWNER)');

    // -------------------------------------------------------------
    // GRUPPO 5: Rimozione Copertina e Pulizia Filesystem
    // -------------------------------------------------------------
    console.log('\n[GRUPPO 5] Rimozione Copertina e Pulizia Filesystem');

    // 5.1 Tentativo di rimozione da utente non proprietario
    const forbidDelCover = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${bookId}/copertina`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${lauraAuth.token}` }
    });
    assert(forbidDelCover.statusCode === 403 && forbidDelCover.body?.error?.code === 'FORBIDDEN_NOT_OWNER', 'Blocca rimozione copertina da utente non proprietario (403 FORBIDDEN_NOT_OWNER)');

    // 5.2 Rimozione autorizzata da parte del proprietario
    const delCoverRes = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${bookId}/copertina`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${demoAuth.token}` }
    });
    assert(delCoverRes.statusCode === 200, 'DELETE /api/esemplari/:id/copertina da proprietario restituisce 200 OK');
    assert(delCoverRes.body?.data?.immagine_copertina === null, 'Campo immagine_copertina azzerato a NULL nel database');
    assert(delCoverRes.body?.data?.immagine_miniatura === null, 'Campo immagine_miniatura azzerato a NULL nel database');

    // 5.3 Verifica eliminazione fisica dei file dal filesystem
    assert(!fs.existsSync(diskCoverPath), 'File fisico copertina eliminato definitivamente da disco');
    assert(!fs.existsSync(diskThumbPath), 'File fisico miniatura eliminato definitivamente da disco');

    // -------------------------------------------------------------
    // GRUPPO 6: Cancellazione Esemplare con Cleanup Automatico File
    // -------------------------------------------------------------
    console.log('\n[GRUPPO 6] Cancellazione Esemplare con Cleanup Automatico File');

    // Ricarica una copertina prima della cancellazione
    const reUpload = await sendMultipart({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${bookId}/copertina`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${demoAuth.token}` }
    }, 'copertina', 'cover_to_delete.png', testImageBuffer, 'image/png');
    const newCoverUrl = reUpload.body?.data?.immagine_copertina;
    const newThumbUrl = reUpload.body?.data?.immagine_miniatura;
    const newDiskCover = path.join(__dirname, newCoverUrl);
    const newDiskThumb = path.join(__dirname, newThumbUrl);
    assert(fs.existsSync(newDiskCover) && fs.existsSync(newDiskThumb), 'Nuovi file copertina rigenerati su disco');

    // Cancella l'esemplare
    const delBookRes = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${bookId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${demoAuth.token}` }
    });
    assert(delBookRes.statusCode === 200, 'DELETE /api/esemplari/:id restituisce 200 OK');
    assert(!fs.existsSync(newDiskCover), 'File copertina rimosso automaticamente dal filesystem alla cancellazione del libro');
    assert(!fs.existsSync(newDiskThumb), 'File miniatura rimosso automaticamente dal filesystem alla cancellazione del libro');

    // -------------------------------------------------------------
    // GRUPPO 7: Verifica Regressione Completa (Catalogo & Tassonomie)
    // -------------------------------------------------------------
    console.log('\n[GRUPPO 7] Verifica Regressione Fasi Precedenti');
    const myBooks = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari/mie',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${demoAuth.token}` }
    });
    assert(myBooks.statusCode === 200 && myBooks.body?.data?.length >= 3, 'Libreria personale consultabile senza errori di regressione');

  } catch (err) {
    console.error('Errore imprevisto durante l\'esecuzione dei test Fase 19:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(` RIEPILOGO TEST FASE 19: ${passed} PASSATI, ${failed} FALLITI`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
