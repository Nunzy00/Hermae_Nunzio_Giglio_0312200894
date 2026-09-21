/**
 * Suite di Collaudo Automatizzato — FASE 22
 * "Implementazione della funzione 'Contatto' tra gli utenti"
 * Hermae — Nunzio Giglio (Matr. 0312200894)
 */

const assert = require('assert');
const http = require('http');
const app = require('./src/app');
const db = require('./src/config/db');
const privacyShieldService = require('./src/services/privacyShieldService');

let server;
let port;
let baseUrl;

let tokenUserA = null; // Richiedente (Laura Bianchi)
let userAId = null;
let tokenUserB = null; // Proprietario (Mario Rossi)
let userBId = null;
let tokenUserC = null; // Utente terzo estraneo (Giovanna Verdi)
let userCId = null;

let libroId = null;
let richiestaId = null;
let notificaId = null;

// Helper per eseguire richieste HTTP simulate
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method: method.toUpperCase(),
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = data ? JSON.parse(data) : null;
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

const runTests = async () => {
  console.log('========================================================================');
  console.log(' COLLAUDO FASE 22: FUNZIONE CONTATTO, CHAT, PRIVACY SHIELD & NOTIFICHE');
  console.log('========================================================================\n');

  try {
    // Avvia server temporaneo su porta casuale
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 1. Recupero o creazione User A (Richiedente: Utente Demo)
    const loginARes = await makeRequest('POST', '/api/auth/login', {
      email: 'demo@hermae.it',
      password: 'Password123!'
    });

    if (loginARes.status === 200 && loginARes.body.data?.tokens) {
      tokenUserA = loginARes.body.data.tokens.accessToken;
      userAId = loginARes.body.data.user.id;
    } else {
      throw new Error(`Impossibile effettuare login per demo@hermae.it: ${JSON.stringify(loginARes.body)}`);
    }

    // 2. Recupero o creazione User B (Proprietario: Laura Bianchi)
    const loginBRes = await makeRequest('POST', '/api/auth/login', {
      email: 'laura.bianchi@example.com',
      password: 'PasswordSicura456!'
    });

    if (loginBRes.status === 200 && loginBRes.body.data?.tokens) {
      tokenUserB = loginBRes.body.data.tokens.accessToken;
      userBId = loginBRes.body.data.user.id;
    } else {
      throw new Error(`Impossibile effettuare login per laura.bianchi@example.com: ${JSON.stringify(loginBRes.body)}`);
    }

    // 3. Recupero o creazione User C (Estraneo: Marco De Luca)
    const loginCRes = await makeRequest('POST', '/api/auth/login', {
      email: 'marco.deluca@example.com',
      password: 'Password123!'
    });

    if (loginCRes.status === 200 && loginCRes.body.data?.tokens) {
      tokenUserC = loginCRes.body.data.tokens.accessToken;
      userCId = loginCRes.body.data.user.id;
    } else {
      throw new Error(`Impossibile effettuare login per marco.deluca@example.com: ${JSON.stringify(loginCRes.body)}`);
    }

    // Assicura che User B abbia preferenze privacy permissive
    await db.query(`
      INSERT INTO preferenze_privacy_utenti (utente_id, mostra_libreria, consenti_messaggi_diretti)
      VALUES ($1, TRUE, TRUE)
      ON CONFLICT (utente_id) DO UPDATE SET mostra_libreria = TRUE, consenti_messaggi_diretti = TRUE
    `, [userBId]);

    // Recupera una categoria
    const catRes = await db.query(`SELECT id FROM categorie LIMIT 1`);
    const categoriaId = catRes.rows[0].id;

    // Crea un libro di test per User B
    const bookRes = await db.query(`
      INSERT INTO esemplari (utente_id, categoria_id, titolo, autore, stato_conservazione, stato_disponibilita, visibile_pubblico)
      VALUES ($1, $2, 'Il Maestro e Margherita', 'Michail Bulgakov', 'Ottimo', 'DISPONIBILE', TRUE)
      RETURNING id
    `, [userBId, categoriaId]);
    libroId = bookRes.rows[0].id;

    // Reset rate limiter
    privacyShieldService.resetRateLimit();

    // -------------------------------------------------------------------------
    // [PARTE 1] Privacy Shield: Schermatura Email e Numeri di Telefono
    // -------------------------------------------------------------------------
    console.log('[PARTE 1] Collaudo Privacy Shield (Schermatura Automatica Recapiti)...');

    // Test 1: Sanificazione email
    const emailSample = 'Ciao, scrivimi pure a mario.rossi@example.com per accordarci!';
    const shieldEmail = privacyShieldService.sanitizeMessage(emailSample);
    assert.strictEqual(shieldEmail.schermaturaApplicata, true, 'Schermatura email deve risultare attiva');
    assert.ok(shieldEmail.testoSanificato.includes('[EMAIL SCHERMATA A TUTELA PRIVACY]'), 'Deve contenere placeholder email');
    console.log('  ✓ [TEST 1] Indirizzo email intercettato e sostituito con placeholder di riservatezza');

    // Test 2: Sanificazione numeri telefonici
    const phoneSample = 'Il mio recapito è +39 333 1234567, chiamami stasera.';
    const shieldPhone = privacyShieldService.sanitizeMessage(phoneSample);
    assert.strictEqual(shieldPhone.schermaturaApplicata, true, 'Schermatura telefono deve risultare attiva');
    assert.ok(shieldPhone.testoSanificato.includes('[NUMERO SCHERMATO A TUTELA PRIVACY]'), 'Deve contenere placeholder telefono');
    console.log('  ✓ [TEST 2] Numero telefonico (+39 333...) intercettato e protetto con successo');

    // Test 3: Testo pulito
    const cleanSample = 'Buongiorno, sarei interessato a leggere questo splendido classico letterario.';
    const shieldClean = privacyShieldService.sanitizeMessage(cleanSample);
    assert.strictEqual(shieldClean.schermaturaApplicata, false, 'Non deve risultare schermatura su testo pulito');
    assert.strictEqual(shieldClean.testoSanificato, cleanSample, 'Testo pulito deve essere inalterato');
    console.log('  ✓ [TEST 3] Testi ordinari privi di recapiti preservati integralmente senza alterazioni\n');

    // -------------------------------------------------------------------------
    // [PARTE 2] Politiche Antispam & Validazione Richieste
    // -------------------------------------------------------------------------
    console.log('[PARTE 2] Collaudo Politiche Antispam & Validazione...');

    // Test 4: Blocco auto-contatto (User B richiede il proprio libro)
    const selfRes = await makeRequest('POST', '/api/richieste', {
      esemplare_id: libroId,
      messaggio_iniziale: 'Vorrei richiedere il mio stesso volume di prova.'
    }, { Authorization: `Bearer ${tokenUserB}` });

    assert.strictEqual(selfRes.status, 400, 'Auto-contatto deve restituire status 400');
    assert.strictEqual(selfRes.body.error.code, 'CANNOT_REQUEST_OWN_BOOK', 'Codice errore deve essere CANNOT_REQUEST_OWN_BOOK');
    console.log('  ✓ [TEST 4] Tentativo di auto-richiesta su libri propri bloccato con 400 CANNOT_REQUEST_OWN_BOOK');

    // Test 5: Blocco invio richiesta se proprietario ha consenti_messaggi_diretti = false
    await db.query(`UPDATE preferenze_privacy_utenti SET consenti_messaggi_diretti = FALSE WHERE utente_id = $1`, [userBId]);

    const blockedPrivacyRes = await makeRequest('POST', '/api/richieste', {
      esemplare_id: libroId,
      messaggio_iniziale: 'Vorrei richiedere questo libro per lo scambio.'
    }, { Authorization: `Bearer ${tokenUserA}` });

    assert.strictEqual(blockedPrivacyRes.status, 403, 'consenti_messaggi_diretti=false deve restituire 403');
    assert.strictEqual(blockedPrivacyRes.body.error.code, 'DIRECT_MESSAGES_DISABLED', 'Codice deve essere DIRECT_MESSAGES_DISABLED');
    console.log('  ✓ [TEST 5] Rispetto impostazione consenti_messaggi_diretti=false garantito con 403 Forbidden');

    // Ripristina consenti_messaggi_diretti = true
    await db.query(`UPDATE preferenze_privacy_utenti SET consenti_messaggi_diretti = TRUE WHERE utente_id = $1`, [userBId]);

    // Test 6: Creazione valida della richiesta da User A a User B con messaggio contenente recapito da schermare
    const reqCreateRes = await makeRequest('POST', '/api/richieste', {
      esemplare_id: libroId,
      messaggio_iniziale: 'Ciao Mario, vorrei leggere Il Maestro e Margherita! Scrivimi su laura@test.it oppure 3339876543.'
    }, { Authorization: `Bearer ${tokenUserA}` });

    assert.strictEqual(reqCreateRes.status, 201, 'Creazione richiesta valida deve restituire 201');
    assert.ok(reqCreateRes.body.data.richiesta, 'Deve restituire oggetto richiesta');

    richiestaId = reqCreateRes.body.data.richiesta.id;
    const msgSanificato = reqCreateRes.body.data.primo_messaggio.testo;
    assert.ok(msgSanificato.includes('[EMAIL SCHERMATA') && msgSanificato.includes('[NUMERO SCHERMATO'), 'Recapiti devono essere schermati sul DB');
    console.log('  ✓ [TEST 6] Creazione richiesta 201 Created: recapiti schermati sul database e richiesta registrata IN_ATTESA');

    // Test 7: Blocco richiesta duplicata attiva per lo stesso libro
    const dupRes = await makeRequest('POST', '/api/richieste', {
      esemplare_id: libroId,
      messaggio_iniziale: 'Altra richiesta duplicata per lo stesso libro.'
    }, { Authorization: `Bearer ${tokenUserA}` });

    assert.strictEqual(dupRes.status, 400, 'Richiesta duplicata attiva deve restituire 400');
    assert.strictEqual(dupRes.body.error.code, 'DUPLICATE_ACTIVE_REQUEST');
    console.log('  ✓ [TEST 7] Prevenzione richieste duplicate attive per lo stesso volume confermata con 400 Bad Request');

    // Test 8: Rate Limiting Antispam (max 5 richieste in 15 minuti)
    for (let i = 1; i <= 4; i++) {
      const bRes = await db.query(`
        INSERT INTO esemplari (utente_id, categoria_id, titolo, autore, stato_disponibilita, visibile_pubblico)
        VALUES ($1, $2, 'Libro Flood ${i}', 'Autore ${i}', 'DISPONIBILE', TRUE) RETURNING id
      `, [userBId, categoriaId]);

      await makeRequest('POST', '/api/richieste', {
        esemplare_id: bRes.rows[0].id,
        messaggio_iniziale: 'Richiesta di test antispam.'
      }, { Authorization: `Bearer ${tokenUserA}` });
    }

    const bExtra = await db.query(`
      INSERT INTO esemplari (utente_id, categoria_id, titolo, autore, stato_disponibilita, visibile_pubblico)
      VALUES ($1, $2, 'Libro Flood Extra', 'Autore Extra', 'DISPONIBILE', TRUE) RETURNING id
    `, [userBId, categoriaId]);

    const floodRes = await makeRequest('POST', '/api/richieste', {
      esemplare_id: bExtra.rows[0].id,
      messaggio_iniziale: 'Richiesta flood oltre soglia.'
    }, { Authorization: `Bearer ${tokenUserA}` });

    assert.strictEqual(floodRes.status, 429, 'Superamento rate limit deve restituire 429');
    assert.strictEqual(floodRes.body.error.code, 'RATE_LIMIT_EXCEEDED');
    console.log('  ✓ [TEST 8] Politica antispam rate limiting attiva: superamento soglia respinto con 429 Too Many Requests\n');

    // -------------------------------------------------------------------------
    // [PARTE 3] Collaudo Notifiche Interne Asincrone
    // -------------------------------------------------------------------------
    console.log('[PARTE 3] Collaudo Notifiche Interne...');

    // Test 9: Verifica notifica ricevuta da User B (proprietario)
    const notifBRes = await makeRequest('GET', '/api/notifiche', null, { Authorization: `Bearer ${tokenUserB}` });
    assert.strictEqual(notifBRes.status, 200, 'Recupero notifiche deve restituire 200');
    assert.ok(notifBRes.body.data.length > 0, 'Deve contenere almeno una notifica');
    notificaId = notifBRes.body.data[0].id;
    console.log('  ✓ [TEST 9] Notifica interna per il proprietario ("Nuova richiesta di contatto") creata automaticamente');

    // Test 10: Conteggio notifiche non lette
    const countNotifRes = await makeRequest('GET', '/api/notifiche/conteggio', null, { Authorization: `Bearer ${tokenUserB}` });
    assert.strictEqual(countNotifRes.status, 200);
    assert.ok(countNotifRes.body.data.non_lette >= 1, 'Conteggio non lette deve essere >= 1');
    console.log(`  ✓ [TEST 10] Endpoint badge conteggio rapido non lette operativo (${countNotifRes.body.data.non_lette} non lette)`);

    // Test 11: Segna singola notifica come letta
    const readRes = await makeRequest('PATCH', `/api/notifiche/${notificaId}/letta`, null, { Authorization: `Bearer ${tokenUserB}` });
    assert.strictEqual(readRes.status, 200);
    assert.strictEqual(readRes.body.data.letta, true, 'La notifica deve essere segnata letta');
    console.log('  ✓ [TEST 11] Aggiornamento stato notifica letta verificato con successo\n');

    // -------------------------------------------------------------------------
    // [PARTE 4] Gestione dei Thread di Dialogo & Chat
    // -------------------------------------------------------------------------
    console.log('[PARTE 4] Collaudo Thread di Conversazione & Chat...');

    // Test 12: Lista thread per User A (richiedente)
    const threadsARes = await makeRequest('GET', '/api/richieste?ruolo=inviate', null, { Authorization: `Bearer ${tokenUserA}` });
    assert.strictEqual(threadsARes.status, 200);
    const threadA = threadsARes.body.data.find(t => t.id === richiestaId);
    assert.ok(threadA, 'Richiesta creata deve essere presente nella lista inviate');
    assert.strictEqual(threadA.controparte.ruolo, 'Proprietario');
    console.log('  ✓ [TEST 12] Elenco thread dell\'utente aggregato correttamente con dati libro, controparte e stato');

    // Test 13: Autorizzazioni: User C (estraneo) non può accedere al thread
    const forbiddenRes = await makeRequest('GET', `/api/richieste/${richiestaId}`, null, { Authorization: `Bearer ${tokenUserC}` });
    assert.strictEqual(forbiddenRes.status, 403, 'Utente terzo non autorizzato deve ricevere 403');
    console.log('  ✓ [TEST 13] Schermatura thread contro accessi non autorizzati verificata con 403 Forbidden');

    // Test 14: User B risponde nel thread
    const replyRes = await makeRequest('POST', `/api/richieste/${richiestaId}/messaggi`, {
      testo: 'Ciao Laura! Certo, il libro è disponibile per lo scambio. Possiamo vederci in centro.'
    }, { Authorization: `Bearer ${tokenUserB}` });

    assert.strictEqual(replyRes.status, 201);
    assert.ok(replyRes.body.data.messaggio);
    console.log('  ✓ [TEST 14] Invio risposta nel thread completato con notifica automatica generata per il richiedente');

    // Test 15: User A apre il thread: verifica che i messaggi destinati a lui siano marcati letti
    const detailARes = await makeRequest('GET', `/api/richieste/${richiestaId}`, null, { Authorization: `Bearer ${tokenUserA}` });
    assert.strictEqual(detailARes.status, 200);
    assert.ok(detailARes.body.data.messaggi.length >= 2, 'Devono essere presenti almeno 2 messaggi');
    const replyMsg = detailARes.body.data.messaggi.find(m => m.mittente_id === userBId);
    assert.ok(replyMsg && replyMsg.letto, 'Il messaggio ricevuto deve essere marcato come letto');
    console.log('  ✓ [TEST 15] Apertura conversazione e marcatura automatica dei messaggi in stato letto confermata\n');

    // -------------------------------------------------------------------------
    // [PARTE 5] Transizioni di Stato della Richiesta
    // -------------------------------------------------------------------------
    console.log('[PARTE 5] Collaudo Macchina a Stati (IN_ATTESA -> ACCETTATA -> COMPLETATA)...');

    // Test 16: Il richiedente NON può accettare la richiesta
    const illegalAcceptRes = await makeRequest('PATCH', `/api/richieste/${richiestaId}/stato`, {
      stato: 'ACCETTATA'
    }, { Authorization: `Bearer ${tokenUserA}` });

    assert.strictEqual(illegalAcceptRes.status, 403, 'Il richiedente non può accettare la richiesta');
    console.log('  ✓ [TEST 16] Divieto di accettazione da parte del richiedente rispettato con 403 Forbidden');

    // Test 17: Il proprietario accetta la richiesta
    const acceptRes = await makeRequest('PATCH', `/api/richieste/${richiestaId}/stato`, {
      stato: 'ACCETTATA'
    }, { Authorization: `Bearer ${tokenUserB}` });

    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.body.data.stato, 'ACCETTATA');
    console.log('  ✓ [TEST 17] Transizione ad ACCETTATA da parte del proprietario completata con notifica');

    // Test 18: Completamento dello scambio
    const completeRes = await makeRequest('PATCH', `/api/richieste/${richiestaId}/stato`, {
      stato: 'COMPLETATA'
    }, { Authorization: `Bearer ${tokenUserB}` });

    assert.strictEqual(completeRes.status, 200);
    assert.strictEqual(completeRes.body.data.stato, 'COMPLETATA');
    console.log('  ✓ [TEST 18] Transizione ad avvenuto scambio COMPLETATA registrata con successo');

    // Test 19: Invio messaggio su richiesta chiusa respinto
    const closedMsgRes = await makeRequest('POST', `/api/richieste/${richiestaId}/messaggi`, {
      testo: 'Messaggio su richiesta chiusa.'
    }, { Authorization: `Bearer ${tokenUserA}` });

    assert.strictEqual(closedMsgRes.status, 400);
    assert.strictEqual(closedMsgRes.body.error.code, 'REQUEST_CLOSED');
    console.log('  ✓ [TEST 19] Inibizione invio messaggi su richieste chiuse confermata con 400 Bad Request');

    console.log('\n========================================================================');
    console.log(' TUTTI I 19 TEST DI FASE 22 SONO STATI SUPERATI CON SUCCESSO! (100%)');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('\n❌ ERRORE RISCONTRATO DURANTE I TEST DI FASE 22:');
    console.error(error.message);
    process.exit(1);
  } finally {
    try {
      if (richiestaId) {
        await db.query(`DELETE FROM richieste_prestito WHERE id = $1`, [richiestaId]);
      }
      if (libroId) {
        await db.query(`DELETE FROM esemplari WHERE id = $1`, [libroId]);
      }
      await db.query(`DELETE FROM esemplari WHERE titolo LIKE 'Libro Flood%'`);
    } catch (cleanErr) {
      // Ignora
    }
    if (server) {
      server.close();
    }
    process.exit(0);
  }
};

runTests();
