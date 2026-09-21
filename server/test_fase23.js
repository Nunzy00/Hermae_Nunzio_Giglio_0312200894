/**
 * Suite di Collaudo Automatizzato — FASE 23
 * "Implementazione della funzione 'Prestito' di un testo tra gli utenti"
 * Hermae — Nunzio Giglio (Matr. 0312200894)
 */

const assert = require('assert');
const http = require('http');
const app = require('./src/app');
const db = require('./src/config/db');

let server;
let port;
let baseUrl;

let tokenUserA = null; // Richiedente primario (Demo / Mario Rossi)
let userAId = null;
let tokenUserB = null; // Proprietario (Laura Bianchi)
let userBId = null;
let tokenUserC = null; // Richiedente concorrente (Marco De Luca)
let userCId = null;

let bookId = null;
let loanIdA = null;
let loanIdC = null;

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
  console.log(' COLLAUDO FASE 23: CICLO PRESTITO, CONCORRENZA E TRACKING TEMPORALE');
  console.log('========================================================================\n');

  try {
    // Avvio server di test su porta casuale
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 1. Recupero credenziali per gli utenti di test
    const loginARes = await makeRequest('POST', '/api/auth/login', {
      email: 'demo@hermae.it',
      password: 'Password123!'
    });
    assert.strictEqual(loginARes.status, 200, 'Login Utente A (Demo) fallito');
    tokenUserA = loginARes.body.data.tokens.accessToken;
    userAId = loginARes.body.data.user.id;

    const loginBRes = await makeRequest('POST', '/api/auth/login', {
      email: 'laura.bianchi@example.com',
      password: 'PasswordSicura456!'
    });
    assert.strictEqual(loginBRes.status, 200, 'Login Utente B (Laura) fallito');
    tokenUserB = loginBRes.body.data.tokens.accessToken;
    userBId = loginBRes.body.data.user.id;

    const loginCRes = await makeRequest('POST', '/api/auth/login', {
      email: 'marco.deluca@example.com',
      password: 'Password123!'
    });
    assert.strictEqual(loginCRes.status, 200, 'Login Utente C (Marco) fallito');
    tokenUserC = loginCRes.body.data.tokens.accessToken;
    userCId = loginCRes.body.data.user.id;

    // 2. Creazione di un esemplare dedicato di Laura Bianchi per i test di prestito
    const catRes = await db.query('SELECT id FROM categorie LIMIT 1');
    const catId = catRes.rows[0].id;

    const bookInsert = await db.query(`
      INSERT INTO esemplari (utente_id, categoria_id, titolo, autore, stato_conservazione, stato_disponibilita, visibile_pubblico)
      VALUES ($1, $2, 'I Promessi Sposi - Edizione Speciale Test Fase 23', 'Alessandro Manzoni', 'Ottimo', 'DISPONIBILE', true)
      RETURNING id, stato_disponibilita
    `, [userBId, catId]);
    bookId = bookInsert.rows[0].id;
    assert.strictEqual(bookInsert.rows[0].stato_disponibilita, 'DISPONIBILE');

    console.log('[PARTE 1] Creazione Richiesta Formale di Prestito...');

    // TEST 1: Blocco auto-richiesta (Laura tenta di richiedere un proprio libro)
    const selfRes = await makeRequest('POST', '/api/prestiti', {
      esemplare_id: bookId,
      durata_giorni: 30
    }, { Authorization: `Bearer ${tokenUserB}` });
    assert.strictEqual(selfRes.status, 400);
    console.log('  ✓ [TEST 1] Blocco auto-richiesta su libri di propria proprietà verificato (400 Bad Request)');

    // TEST 2: Validazione durata prestito (durata non compresa tra 1 e 180 giorni)
    const invalidDurRes = await makeRequest('POST', '/api/prestiti', {
      esemplare_id: bookId,
      durata_giorni: 999
    }, { Authorization: `Bearer ${tokenUserA}` });
    assert.strictEqual(invalidDurRes.status, 400);
    console.log('  ✓ [TEST 2] Rifiuto durata prestito non conforme (400 Bad Request)');

    // TEST 3: Creazione richiesta formale valida da Utente A con durata 30 giorni
    const reqARes = await makeRequest('POST', '/api/prestiti', {
      esemplare_id: bookId,
      durata_giorni: 30,
      messaggio: 'Richiesta formale di prestito per studio universitario'
    }, { Authorization: `Bearer ${tokenUserA}` });

    assert.strictEqual(reqARes.status, 201);
    assert.strictEqual(reqARes.body.success, true);
    assert.strictEqual(reqARes.body.data.stato, 'IN_ATTESA');
    assert.strictEqual(reqARes.body.data.durata_giorni, 30);
    loanIdA = reqARes.body.data.id;
    console.log('  ✓ [TEST 3] Richiesta formale creata con successo (201 Created, stato: IN_ATTESA, durata: 30 gg)');

    // TEST 4: Blocco richiesta duplicata attiva per lo stesso utente e volume
    const dupRes = await makeRequest('POST', '/api/prestiti', {
      esemplare_id: bookId,
      durata_giorni: 15
    }, { Authorization: `Bearer ${tokenUserA}` });
    assert.strictEqual(dupRes.status, 409);
    console.log('  ✓ [TEST 4] Prevenzione richieste duplicate attive per il medesimo utente (409 Conflict)');

    console.log('\n[PARTE 2] Concorrenza tra Richiedenti e Blocco Concorrente (Difficoltà di Fase)...');

    // TEST 5: Utente C invia richiesta concorrente per lo stesso volume mentre è ancora IN_ATTESA
    const reqCRes = await makeRequest('POST', '/api/prestiti', {
      esemplare_id: bookId,
      durata_giorni: 45,
      messaggio: 'Anche io desidero questo testo in prestito'
    }, { Authorization: `Bearer ${tokenUserC}` });
    assert.strictEqual(reqCRes.status, 201);
    assert.strictEqual(reqCRes.body.data.stato, 'IN_ATTESA');
    loanIdC = reqCRes.body.data.id;
    console.log('  ✓ [TEST 5] Richiesta concorrente da Utente C registrata nello stato IN_ATTESA');

    // TEST 6: Accettazione del prestito da parte del proprietario B per l'Utente A
    const acceptRes = await makeRequest('PATCH', `/api/prestiti/${loanIdA}/accetta`, {
      durata_giorni: 30,
      note: 'Consegna a mano concordata'
    }, { Authorization: `Bearer ${tokenUserB}` });

    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.body.data.stato, 'IN_PRESTITO');
    assert.ok(acceptRes.body.data.data_inizio, 'data_inizio deve essere valorizzata');
    assert.ok(acceptRes.body.data.data_scadenza, 'data_scadenza deve essere calcolata');
    console.log('  ✓ [TEST 6] Prestito accettato da proprietario con avanzamento a IN_PRESTITO e tracking temporale');

    // TEST 7: Aggiornamento automatico stato dell'esemplare a 'IN_PRESTITO' nel database
    const checkBookRes = await db.query('SELECT stato_disponibilita FROM esemplari WHERE id = $1', [bookId]);
    assert.strictEqual(checkBookRes.rows[0].stato_disponibilita, 'IN_PRESTITO');
    console.log('  ✓ [TEST 7] Aggiornamento automatico stato esemplare a IN_PRESTITO confermato su database');

    // TEST 8: Blocco/Rifiuto automatico della richiesta concorrente C a seguito dell'accettazione di A
    const checkLoanC = await db.query('SELECT stato, note_restituzione FROM richieste_prestito WHERE id = $1', [loanIdC]);
    assert.strictEqual(checkLoanC.rows[0].stato, 'RIFIUTATA');
    assert.ok(checkLoanC.rows[0].note_restituzione.includes('altro utente') || checkLoanC.rows[0].note_restituzione.includes('concesso in prestito'));
    console.log('  ✓ [TEST 8] Richiesta concorrente C declinata automaticamente con motivazione formale');

    // TEST 9: Verifica notifica interna ricevuta dall'utente concorrente C
    const notifCRes = await db.query(`
      SELECT tipo, titolo FROM notifiche 
      WHERE utente_id = $1 AND richiesta_id = $2
    `, [userCId, loanIdC]);
    assert.ok(notifCRes.rows.length > 0);
    assert.strictEqual(notifCRes.rows[0].tipo, 'PRESTITO_CONCORRENTE_CHIUSO');
    console.log('  ✓ [TEST 9] Notifica asincrona recapitata all\'utente concorrente informandolo dell\'affidamento ad altri');

    // TEST 10: Inibizione di NUOVE richieste di prestito sul volume ora 'IN_PRESTITO'
    const newReqOnBusyBook = await makeRequest('POST', '/api/prestiti', {
      esemplare_id: bookId,
      durata_giorni: 20
    }, { Authorization: `Bearer ${tokenUserC}` });
    assert.strictEqual(newReqOnBusyBook.status, 409);
    console.log('  ✓ [TEST 10] Rifiuto nuove richieste per volume non disponibile (409 Conflict, BOOK_NOT_AVAILABLE)');

    console.log('\n[PARTE 3] Tracking Temporale, Calcolo Countdown e Proroga...');

    // TEST 11: Verifica calcolo giorni rimanenti e percentuale di avanzamento
    const detailRes = await makeRequest('GET', `/api/prestiti/${loanIdA}`, null, {
      Authorization: `Bearer ${tokenUserA}`
    });
    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailRes.body.data.durata_giorni, 30);
    assert.strictEqual(detailRes.body.data.in_ritardo, false);
    assert.ok(detailRes.body.data.giorni_rimanenti >= 29 && detailRes.body.data.giorni_rimanenti <= 30);
    assert.strictEqual(detailRes.body.data.stato_temporale, 'IN_CORSO');
    console.log('  ✓ [TEST 11] Metriche temporali conformi (giorni_rimanenti: 30, stato_temporale: IN_CORSO)');

    // TEST 12: Concessione proroga temporale (estensione data di scadenza di +15 giorni)
    const prorogaRes = await makeRequest('PATCH', `/api/prestiti/${loanIdA}/proroga`, {
      giorni_aggiuntivi: 15
    }, { Authorization: `Bearer ${tokenUserB}` });
    assert.strictEqual(prorogaRes.status, 200);
    assert.strictEqual(prorogaRes.body.data.durata_giorni, 45);
    assert.ok(prorogaRes.body.data.giorni_rimanenti >= 44);
    console.log('  ✓ [TEST 12] Proroga temporale applicata (+15 giorni: nuova durata 45 gg)');

    // TEST 13: Simulazione scadenza temporale e rilevamento automatico ritardo
    await db.query(`
      UPDATE richieste_prestito 
      SET data_scadenza = NOW() - INTERVAL '3 days'
      WHERE id = $1
    `, [loanIdA]);

    const overdueRes = await makeRequest('GET', `/api/prestiti/${loanIdA}`, null, {
      Authorization: `Bearer ${tokenUserA}`
    });
    assert.strictEqual(overdueRes.status, 200);
    assert.strictEqual(overdueRes.body.data.in_ritardo, true);
    assert.strictEqual(overdueRes.body.data.giorni_ritardo, 3);
    assert.strictEqual(overdueRes.body.data.stato_temporale, 'SCADUTO_IN_RITARDO');
    console.log('  ✓ [TEST 13] Rilevamento automatico stato SCADUTO_IN_RITARDO e calcolo giorni di ritardo (+3 gg)');

    console.log('\n[PARTE 4] Restituzione Formale e Ripristino Disponibilità...');

    // TEST 14: Conferma avvenuta restituzione del volume (azione proprietario/richiedente)
    const returnRes = await makeRequest('PATCH', `/api/prestiti/${loanIdA}/restituisci`, {
      note: 'Volume riconsegnato in perfette condizioni'
    }, { Authorization: `Bearer ${tokenUserB}` });

    assert.strictEqual(returnRes.status, 200);
    assert.strictEqual(returnRes.body.data.stato, 'RESTITUITO');
    assert.ok(returnRes.body.data.data_restituzione, 'data_restituzione registrata');
    console.log('  ✓ [TEST 14] Restituzione registrata con successo (stato: RESTITUITO)');

    // TEST 15: Ripristino automatico dell'esemplare a 'DISPONIBILE'
    const restoredBookRes = await db.query('SELECT stato_disponibilita FROM esemplari WHERE id = $1', [bookId]);
    assert.strictEqual(restoredBookRes.rows[0].stato_disponibilita, 'DISPONIBILE');
    console.log('  ✓ [TEST 15] Ripristino automatico disponibilità esemplare a DISPONIBILE confermato');

    // TEST 16: Il volume tornato DISPONIBILE può nuovamente ricevere richieste di prestito
    const newReqAfterReturn = await makeRequest('POST', '/api/prestiti', {
      esemplare_id: bookId,
      durata_giorni: 15,
      messaggio: 'Nuovo prestito dopo restituzione'
    }, { Authorization: `Bearer ${tokenUserC}` });
    assert.strictEqual(newReqAfterReturn.status, 201);
    const loanId2 = newReqAfterReturn.body.data.id;
    console.log('  ✓ [TEST 16] Il volume riconsegnato accetta correttamente nuove richieste');

    console.log('\n[PARTE 5] Flussi Alternativi (Rifiuto e Annullamento)...');

    // TEST 17: Annullamento richiesta da parte del richiedente (User C) prima dell'accettazione
    const cancelRes = await makeRequest('PATCH', `/api/prestiti/${loanId2}/annulla`, null, {
      Authorization: `Bearer ${tokenUserC}`
    });
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.body.data.stato, 'ANNULLATA');
    console.log('  ✓ [TEST 17] Annullamento richiesta da parte del richiedente registrato con stato ANNULLATA');

    // TEST 18: Rifiuto formale da parte del proprietario
    const newReqForReject = await makeRequest('POST', '/api/prestiti', {
      esemplare_id: bookId,
      durata_giorni: 20
    }, { Authorization: `Bearer ${tokenUserA}` });
    const loanToRejectId = newReqForReject.body.data.id;

    const rejectRes = await makeRequest('PATCH', `/api/prestiti/${loanToRejectId}/rifiuta`, {
      motivo: 'Non disponibile per impegni personali'
    }, { Authorization: `Bearer ${tokenUserB}` });
    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual(rejectRes.body.data.stato, 'RIFIUTATA');
    console.log('  ✓ [TEST 18] Rifiuto formale con motivazione da parte del proprietario registrato');

    console.log('\n[PARTE 6] Sicurezza Anti-IDOR ed Endpoint Metriche Dashboard...');

    // TEST 19: Protezione IDOR: Utente C non autorizzato a consultare il prestito di A
    const idorRes = await makeRequest('GET', `/api/prestiti/${loanIdA}`, null, {
      Authorization: `Bearer ${tokenUserC}`
    });
    assert.strictEqual(idorRes.status, 403);
    console.log('  ✓ [TEST 19] Schermatura IDOR verificata con 403 Forbidden per utenti non correlati');

    // TEST 20: Endpoint metriche aggregate cruscotto prestiti
    const metricsRes = await makeRequest('GET', '/api/prestiti/metriche', null, {
      Authorization: `Bearer ${tokenUserB}`
    });
    assert.strictEqual(metricsRes.status, 200);
    assert.ok(typeof metricsRes.body.data.attivi_concessi === 'number');
    assert.ok(typeof metricsRes.body.data.restituiti_totali === 'number');
    console.log('  ✓ [TEST 20] Endpoint metriche aggregate cruscotto prestiti operativo');

    console.log('\n========================================================================');
    console.log(' TUTTI I 20 TEST DI FASE 23 SONO STATI SUPERATI CON SUCCESSO! (100%)');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('\n❌ ERRORE DURANTE IL COLLAUDO FASE 23:', err);
    process.exit(1);
  } finally {
    // Cleanup dei record di test
    try {
      if (bookId) {
        await db.query('DELETE FROM richieste_prestito WHERE esemplare_id = $1', [bookId]);
        await db.query('DELETE FROM esemplari WHERE id = $1', [bookId]);
      }
    } catch (e) {}

    if (server) {
      server.close();
    }
    process.exit(0);
  }
};

runTests();
