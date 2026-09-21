/**
 * Suite di Collaudo Automatizzato — FASE 21
 * "Implementazione delle funzioni di ricerca di libri"
 * Hermae — Nunzio Giglio (Matr. 0312200894)
 */

const assert = require('assert');
const http = require('http');
const app = require('./src/app');
const db = require('./src/config/db');

let server;
let port;
let baseUrl;

// Helper per eseguire richieste HTTP simulate
function request(method, path, body = null, headers = {}) {
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

async function runTests() {
  console.log('========================================================================');
  console.log(' COLLAUDO FASE 21: MOTORE DI RICERCA LIBRI, PROSSIMITÀ & PROFILO DA MAPPA');
  console.log('========================================================================\n');

  let passedAssertions = 0;
  function pass(desc) {
    passedAssertions++;
    console.log(`  ✓ [TEST ${passedAssertions}] ${desc}`);
  }

  try {
    // 1. Avvio server di test su porta dinamica
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    // Recupero ID utenti di test dal database
    const usersRes = await db.query('SELECT id, email, nome, cognome FROM utenti');
    const users = {};
    usersRes.rows.forEach(u => { users[u.email] = u; });

    const nunzio = users['demo@hermae.it'];
    const laura = users['laura.bianchi@example.com'];
    const marco = users['marco.deluca@example.com'];
    const giulia = users['giulia.romano@example.com'];

    // ------------------------------------------------------------------------
    // PARTE 1: RICERCA TESTUALE INTEGRATA PER PAROLE CHIAVE
    // ------------------------------------------------------------------------
    console.log('[PARTE 1] Collaudo Ricerca Testuale Full-Text (Titolo, Autore, ISBN)...');

    // 1.1 Ricerca per parola chiave titolo ("Clean")
    const resTitle = await request('GET', '/api/esemplari?search=Clean');
    assert.strictEqual(resTitle.status, 200);
    assert.strictEqual(resTitle.body.success, true);
    assert.strictEqual(resTitle.body.count, 1);
    assert.ok(resTitle.body.data[0].titolo.includes('Clean Code'));
    pass('Ricerca per parola chiave titolo ("Clean") individua esattamente "Clean Code"');

    // 1.2 Ricerca per autore ("Rovelli")
    const resAuthor = await request('GET', '/api/esemplari?search=Rovelli');
    assert.strictEqual(resAuthor.status, 200);
    assert.strictEqual(resAuthor.body.count, 1);
    assert.strictEqual(resAuthor.body.data[0].autore, 'Carlo Rovelli');
    pass('Ricerca per autore ("Rovelli") individua l\'opera di Carlo Rovelli');

    // 1.3 Ricerca per ISBN parziale ("9788845278655" - Il nome della rosa)
    const resIsbn = await request('GET', '/api/esemplari?search=9788845278655');
    assert.strictEqual(resIsbn.status, 200);
    assert.strictEqual(resIsbn.body.count, 1);
    assert.strictEqual(resIsbn.body.data[0].titolo, 'Il nome della rosa');
    pass('Ricerca per codice ISBN ("9788845278655") restituisce il volume corrispondente');

    // 1.4 Ricerca case-insensitive e con spazi extra
    const resCase = await request('GET', '/api/esemplari?search=  hAwKiNg  ');
    assert.strictEqual(resCase.status, 200);
    assert.strictEqual(resCase.body.count, 1);
    assert.strictEqual(resCase.body.data[0].autore, 'Stephen Hawking');
    pass('Ricerca testuale con whitespace e case-insensitive ("  hAwKiNg  ") gestita con successo');

    // ------------------------------------------------------------------------
    // PARTE 2: RICERCA PER MACRO-CATEGORIA E SOTTOGENERE
    // ------------------------------------------------------------------------
    console.log('\n[PARTE 2] Collaudo Filtri Macro-Categoria & Sottogenere...');

    // 2.1 Ricerca per categoria slug ("informatica-tecnologia")
    const resCat = await request('GET', '/api/esemplari?categoria_id=informatica-tecnologia');
    assert.strictEqual(resCat.status, 200);
    assert.strictEqual(resCat.body.count, 2); // Solo i 2 pubblici di Nunzio (Design Patterns di Laura è privato)
    const titlesInformatica = resCat.body.data.map(b => b.titolo);
    assert.ok(titlesInformatica.includes('Clean Code: A Handbook of Agile Software Craftsmanship'));
    assert.ok(titlesInformatica.includes('Designing Data-Intensive Applications'));
    pass('Filtro per categoria slug ("informatica-tecnologia") restituisce i 2 volumi pubblici disponibili');

    // 2.2 Ricerca per sottogenere ("Astrofisica & Cosmologia")
    const resSub = await request('GET', '/api/esemplari?sottogenere=Astrofisica%20%26%20Cosmologia');
    assert.strictEqual(resSub.status, 200);
    assert.strictEqual(resSub.body.count, 1);
    assert.strictEqual(resSub.body.data[0].titolo, 'Dal big bang ai buchi neri: Breve storia del tempo');
    pass('Filtro per sottogenere tematico restituisce l\'opera specifica');

    // ------------------------------------------------------------------------
    // PARTE 3: RICERCA GEOSPAZIALE DI PROSSIMITÀ (EARTHDISTANCE POSTGIS)
    // ------------------------------------------------------------------------
    console.log('\n[PARTE 3] Collaudo Ricerca Geospaziale di Prossimità con Raggio...');

    // 3.1 Ricerca entro 5 km dal centro di Napoli (lat 40.8518, lng 14.2681)
    const resNapoli5km = await request('GET', '/api/esemplari?lat=40.8518&lng=14.2681&raggio_km=5&ordina_per=distanza');
    assert.strictEqual(resNapoli5km.status, 200);
    assert.strictEqual(resNapoli5km.body.count, 5); // 3 di Nunzio + 2 di Laura

    // Verifica che i libri siano ordinati per distanza crescente
    const distanze = resNapoli5km.body.data.map(b => b.distanza_km);
    for (let i = 0; i < distanze.length - 1; i++) {
      assert.ok(distanze[i] <= distanze[i + 1], `Ordinamento distanza fallito: ${distanze[i]} > ${distanze[i + 1]}`);
    }
    pass('Ricerca con raggio 5 km da Napoli restituisce esattamente i 5 libri locali ordinati per distanza crescente');

    // 3.2 Verifica che i libri di Roma (Giulia Romano) NON siano presenti nel raggio di 5 km
    const autori5km = resNapoli5km.body.data.map(b => b.autore);
    assert.ok(!autori5km.includes('Stephen Hawking'), 'Il libro di Roma non deve comparire nel raggio di 5 km');
    assert.ok(!autori5km.includes('Douglas Hofstadter'), 'Il libro di Roma non deve comparire nel raggio di 5 km');
    pass('I libri remoti (Roma ~190 km) sono correttamente esclusi dalla ricerca di prossimità a 5 km');

    // 3.3 Verifica calcolo metrica e fascia di prossimità
    const primoLibro = resNapoli5km.body.data[0];
    assert.ok(typeof primoLibro.distanza_metri === 'number');
    assert.ok(typeof primoLibro.distanza_km === 'number');
    assert.ok(primoLibro.fascia_prossimita === 'Stesso Quartiere' || primoLibro.fascia_prossimita === 'Stessa Città');
    assert.ok(primoLibro.coordinate && typeof primoLibro.coordinate.lat === 'number');
    pass('Calcolo della distanza metrica, chilometrica e fascia di prossimità integrato correttamente');

    // 3.4 Ricerca nazionale con raggio esteso (250 km)
    const resNazionale = await request('GET', '/api/esemplari?lat=40.8518&lng=14.2681&raggio_km=250');
    assert.strictEqual(resNazionale.status, 200);
    assert.strictEqual(resNazionale.body.count, 7); // Tutti i 7 libri pubblici (Napoli + Roma)
    pass('Ricerca con raggio 250 km include sia i libri di Napoli sia i libri di Roma (7 volumi totali)');

    // ------------------------------------------------------------------------
    // PARTE 4: COMBINAZIONE PERTINENZA TESTUALE E FILTRO GEOGRAFICO
    // ------------------------------------------------------------------------
    console.log('\n[PARTE 4] Collaudo Combinazione Filtri Testuali e Prossimità Spaziale...');

    // 4.1 Ricerca "Eco" nel raggio di 5 km da Napoli
    const resEcoNapoli = await request('GET', '/api/esemplari?search=Eco&lat=40.8518&lng=14.2681&raggio_km=5');
    assert.strictEqual(resEcoNapoli.status, 200);
    assert.strictEqual(resEcoNapoli.body.count, 1);
    assert.strictEqual(resEcoNapoli.body.data[0].titolo, 'Il nome della rosa');
    pass('Combinazione testo "Eco" + prossimità 5 km Napoli individua solo "Il nome della rosa"');

    // 4.2 Ricerca "Hawking" nel raggio di 5 km da Napoli (deve restituire 0 risultati)
    const resHawkingNapoli = await request('GET', '/api/esemplari?search=Hawking&lat=40.8518&lng=14.2681&raggio_km=5');
    assert.strictEqual(resHawkingNapoli.status, 200);
    assert.strictEqual(resHawkingNapoli.body.count, 0);
    pass('Combinazione testo "Hawking" + prossimità 5 km Napoli restituisce 0 risultati (presente solo a Roma)');

    // 4.3 Ricerca "Hawking" da Roma (lat 41.9028, lng 12.4964) con raggio 10 km
    const resHawkingRoma = await request('GET', '/api/esemplari?search=Hawking&lat=41.9028&lng=12.4964&raggio_km=10');
    assert.strictEqual(resHawkingRoma.status, 200);
    assert.strictEqual(resHawkingRoma.body.count, 1);
    assert.strictEqual(resHawkingRoma.body.data[0].titolo, 'Dal big bang ai buchi neri: Breve storia del tempo');
    assert.ok(resHawkingRoma.body.data[0].distanza_km < 5);
    pass('Ricerca da Roma per "Hawking" con raggio 10 km trova l\'opera con distanza locale');

    // ------------------------------------------------------------------------
    // PARTE 5: TUTELA PRIVACY E SCHERMATURA IN RICERCA
    // ------------------------------------------------------------------------
    console.log('\n[PARTE 5] Verifica Schermatura Volumi Riservati e Librerie Occultate...');

    // 5.1 Nessun libro privato deve mai apparire (es. "Pensieri lenti e veloci")
    const resPrivateBook = await request('GET', '/api/esemplari?search=Pensieri%20lenti');
    assert.strictEqual(resPrivateBook.status, 200);
    assert.strictEqual(resPrivateBook.body.count, 0);
    pass('Il volume privato "Pensieri lenti e veloci" è totalmente schermato dalla ricerca pubblica');

    // 5.2 Nessun libro di Marco De Luca (mostra_libreria = false) deve mai apparire
    const resMarcoBook = await request('GET', '/api/esemplari?search=citt%C3%A0%20invisibili');
    assert.strictEqual(resMarcoBook.status, 200);
    assert.strictEqual(resMarcoBook.body.count, 0);
    pass('Il volume di Marco De Luca ("Le città invisibili") è schermato per intera libreria occultata');

    // ------------------------------------------------------------------------
    // PARTE 6: ENDPOINT PROFILO PUBBLICO UTENTE (GET /api/utenti/:id/profilo)
    // ------------------------------------------------------------------------
    console.log('\n[PARTE 6] Collaudo Endpoint Profilo Pubblico Lettore (GET /api/utenti/:id/profilo)...');

    // 6.1 Profilo di Laura Bianchi (Libreria visibile, mostra_libreria = true)
    const resLauraProf = await request('GET', `/api/utenti/${laura.id}/profilo`);
    assert.strictEqual(resLauraProf.status, 200);
    assert.strictEqual(resLauraProf.body.success, true);
    const pLaura = resLauraProf.body.data;
    assert.strictEqual(pLaura.id, laura.id);
    assert.strictEqual(pLaura.nome, 'Laura');
    assert.strictEqual(pLaura.cognome_iniziale, 'B.');
    assert.strictEqual(pLaura.citta, 'Napoli');
    assert.strictEqual(pLaura.mostra_libreria, true);
    assert.strictEqual(pLaura.privacy_libreria_attiva, false);
    assert.strictEqual(pLaura.totale_libri, 2);
    assert.strictEqual(pLaura.libri.length, 2);
    const lauraBookTitles = pLaura.libri.map(b => b.titolo);
    assert.ok(lauraBookTitles.includes("L'ordine del tempo"));
    assert.ok(lauraBookTitles.includes('Se questo è un uomo'));
    assert.ok(!lauraBookTitles.includes('Design Patterns'), 'I libri privati di Laura non devono essere esposti nel profilo pubblico');
    assert.strictEqual(pLaura.email, undefined, 'L\'email personale non deve essere divulgata nel profilo pubblico');
    assert.strictEqual(pLaura.password_hash, undefined, 'L\'hash password non deve essere divulgato');
    pass('Profilo pubblico di Laura Bianchi: espone i 2 libri pubblici disponibili e preserva i dati sensibili');

    // 6.2 Profilo di Marco De Luca (Libreria occultata, mostra_libreria = false)
    const resMarcoProf = await request('GET', `/api/utenti/${marco.id}/profilo`);
    assert.strictEqual(resMarcoProf.status, 200);
    assert.strictEqual(resMarcoProf.body.success, true);
    const pMarco = resMarcoProf.body.data;
    assert.strictEqual(pMarco.id, marco.id);
    assert.strictEqual(pMarco.nome, 'Marco');
    assert.strictEqual(pMarco.cognome_iniziale, 'D.');
    assert.strictEqual(pMarco.mostra_libreria, false);
    assert.strictEqual(pMarco.privacy_libreria_attiva, true);
    assert.strictEqual(pMarco.totale_libri, 0);
    assert.strictEqual(pMarco.libri.length, 0);
    pass('Profilo pubblico di Marco De Luca: flag mostra_libreria=false, 0 libri esposti e privacy rispettata');

    // 6.3 Richiesta profilo per utente inesistente
    const resNotFound = await request('GET', '/api/utenti/00000000-0000-0000-0000-000000000000/profilo');
    assert.strictEqual(resNotFound.status, 404);
    assert.strictEqual(resNotFound.body.error.code, 'USER_NOT_FOUND');
    pass('Richiesta profilo per ID inesistente solleva correttamente 404 USER_NOT_FOUND');

    // ------------------------------------------------------------------------
    // PARTE 7: COORDINATE SICURE DEI MARKER PER LA MAPPA
    // ------------------------------------------------------------------------
    console.log('\n[PARTE 7] Verifica Coordinate Sicure nei Risultati di Ricerca per la Mappa...');

    const resTutti = await request('GET', '/api/esemplari?limit=10');
    assert.strictEqual(resTutti.status, 200);
    resTutti.body.data.forEach((item) => {
      assert.ok(item.proprietario, 'Ogni libro deve avere l\'oggetto proprietario');
      assert.ok(item.proprietario.nome, 'Nome del proprietario presente');
      assert.ok(item.proprietario.cognome_iniziale, 'Iniziale cognome presente per privacy');
      if (item.coordinate) {
        assert.ok(typeof item.coordinate.lat === 'number', 'Latitudine numerica presente');
        assert.ok(typeof item.coordinate.lng === 'number', 'Longitudine numerica presente');
      }
    });
    pass('Tutti i volumi restituiti includono metadati sicuri per il rendering dei marker Leaflet');

    console.log('\n========================================================================');
    console.log(` TUTTI I ${passedAssertions} TEST DI FASE 21 SONO STATI SUPERATI CON SUCCESSO! (100%)`);
    console.log('========================================================================\n');

  } catch (error) {
    console.error('\n❌ ERRORE DURANTE IL COLLAUDO DI FASE 21:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    process.exit(process.exitCode || 0);
  }
}

runTests();
