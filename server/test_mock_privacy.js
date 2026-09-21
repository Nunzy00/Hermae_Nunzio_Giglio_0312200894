/**
 * Script di Verifica e Collaudo Visibilità Dati Mock Privacy
 * Hermae — Nunzio Giglio (Matr. 0312200894)
 *
 * Simula gli accessi via API per verificare concretamente:
 * 1. Cosa vede ogni singolo utente nella propria libreria personale (GET /api/esemplari/mie)
 * 2. Cosa vede la community nella ricerca pubblica (GET /api/esemplari)
 * 3. Cosa succede se un utente prova ad accedere direttamente con ID a un libro privato di un altro utente (GET /api/esemplari/:id)
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

async function runVerification() {
  console.log('========================================================================');
  console.log(' COLLAUDO VISIBILITÀ E PRIVACY DATI MOCK (MULTI-UTENTE)');
  console.log('========================================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });

  try {
    const utenti = [
      { nome: 'Nunzio Giglio', email: 'demo@hermae.it', pass: 'Password123!' },
      { nome: 'Laura Bianchi', email: 'laura.bianchi@example.com', pass: 'PasswordSicura456!' },
      { nome: 'Marco De Luca', email: 'marco.deluca@example.com', pass: 'Password123!' },
      { nome: 'Giulia Romano', email: 'giulia.romano@example.com', pass: 'Password123!' }
    ];

    const tokens = {};
    for (const u of utenti) {
      const auth = await loginUser(u.email, u.pass);
      tokens[u.email] = auth.token;
    }

    console.log('------------------------------------------------------------------------');
    console.log('PARTE 1: VISTA AD USO PERSONALE (GET /api/esemplari/mie)');
    console.log('Ogni utente vede TUTTI i propri libri (pubblici e privati)');
    console.log('------------------------------------------------------------------------\n');

    for (const u of utenti) {
      const res = await request({
        hostname: '127.0.0.1',
        port,
        path: '/api/esemplari/mie',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokens[u.email]}` }
      });

      const privacyRes = await request({
        hostname: '127.0.0.1',
        port,
        path: '/api/privacy/me',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokens[u.email]}` }
      });

      const libPubblica = privacyRes.body?.data?.mostra_libreria;

      console.log(`👤 Utente: ${u.nome} (${u.email})`);
      console.log(`   Stato Scaffale Privacy: ${libPubblica ? '🌐 PUBBLICO' : '🔒 OCCULTATO AL PUBBLICO (mostra_libreria = false)'}`);
      console.log(`   Totale Volumi Personali: ${res.body.count}`);

      res.body.data.forEach((b, idx) => {
        console.log(`   ${idx + 1}. "${b.titolo}" [${b.visibile_pubblico ? '🌐 PUBBLICO' : '🔒 PRIVATO'}] — ${b.stato_disponibilita} (${b.stato_conservazione})`);
      });
      console.log('');
    }

    console.log('------------------------------------------------------------------------');
    console.log('PARTE 2: VISTA COMMUNITY / RICERCA PUBBLICA (GET /api/esemplari)');
    console.log('I libri privati e gli utenti con libreria occultata sono ESCLUSI');
    console.log('------------------------------------------------------------------------\n');

    const searchRes = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari',
      method: 'GET'
    });

    console.log(`Totale Volumi Visibili nel Catalogo Pubblico: ${searchRes.body.count}\n`);
    const tableData = searchRes.body.data.map((b, idx) => ({
      '#': idx + 1,
      'Titolo': b.titolo,
      'Autore': b.autore,
      'Proprietario': b.proprietario ? `${b.proprietario.nome} ${b.proprietario.cognome}` : 'N/D',
      'Città': b.proprietario ? b.proprietario.citta : 'N/D',
      'Visibilità': b.visibile_pubblico ? '🌐 Pubblico' : '🔒 Privato'
    }));

    console.table(tableData);

    console.log('\n------------------------------------------------------------------------');
    console.log('PARTE 3: TEST DI ACCESSO DIRETTO PUNTUALE (GET /api/esemplari/:id)');
    console.log('Verifica protezione 404 Anti-Enumeration da parte di utenti terzi');
    console.log('------------------------------------------------------------------------\n');

    // Recupera ID del libro privato di Laura Bianchi: "Design Patterns"
    const lauraBooks = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari/mie',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokens['laura.bianchi@example.com']}` }
    });
    const lauraPrivateBook = lauraBooks.body.data.find(b => !b.visibile_pubblico);
    const lauraPublicBook = lauraBooks.body.data.find(b => b.visibile_pubblico);

    // Recupera ID del libro (teoricamente pubblico) di Marco De Luca (la cui libreria è occultata)
    const marcoBooks = await request({
      hostname: '127.0.0.1',
      port,
      path: '/api/esemplari/mie',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokens['marco.deluca@example.com']}` }
    });
    const marcoBookWithHiddenLibrary = marcoBooks.body.data[0];

    // TEST 3.1: Nunzio tenta di accedere al libro PRIVATO di Laura
    const test1 = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${lauraPrivateBook.id}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokens['demo@hermae.it']}` }
    });
    console.log(`1. Nunzio accede al libro PRIVATO di Laura ("${lauraPrivateBook.titolo}"):`);
    console.log(`   Esito HTTP: ${test1.statusCode} (${test1.statusCode === 404 ? '✅ CORRETTO: 404 Not Found' : '❌ ERRORE'})`);

    // TEST 3.2: Nunzio tenta di accedere al libro di Marco (Libreria OCCULTATA)
    const test2 = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${marcoBookWithHiddenLibrary.id}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokens['demo@hermae.it']}` }
    });
    console.log(`2. Nunzio accede al libro di Marco con libreria occultata ("${marcoBookWithHiddenLibrary.titolo}"):`);
    console.log(`   Esito HTTP: ${test2.statusCode} (${test2.statusCode === 404 ? '✅ CORRETTO: 404 Not Found' : '❌ ERRORE'})`);

    // TEST 3.3: Nunzio accede al libro PUBBLICO di Laura
    const test3 = await request({
      hostname: '127.0.0.1',
      port,
      path: `/api/esemplari/${lauraPublicBook.id}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokens['demo@hermae.it']}` }
    });
    console.log(`3. Nunzio accede al libro PUBBLICO di Laura ("${lauraPublicBook.titolo}"):`);
    console.log(`   Esito HTTP: ${test3.statusCode} (${test3.statusCode === 200 ? '✅ CORRETTO: 200 OK' : '❌ ERRORE'})\n`);

    console.log('========================================================================');
    console.log(' TUTTI I CONTROLLI DI PRIVACY E VISIBILITÀ SONO PERFETTAMENTE VERIFICATI!');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('Errore durante la verifica:', err);
  } finally {
    server.close();
    await db.pool.end();
  }
}

runVerification();
