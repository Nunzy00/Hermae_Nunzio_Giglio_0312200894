const http = require('http');
const app = require('./src/app');
const { closePool } = require('./src/config/db');

// Esegue il collaudo completo delle API per l'entità posizione_utenti
async function runCollaudo() {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[TEST SERVER] Avviato su porta ${port}`);

  try {
    // 1. Login con utente di prova demo@hermae.it
    console.log('\n--- 1. Autenticazione con demo@hermae.it ---');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo@hermae.it',
        password: 'Password123!'
      })
    });
    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.data.tokens.accessToken) {
      throw new Error(`Login fallito: ${JSON.stringify(loginData)}`);
    }
    const token = loginData.data.tokens.accessToken;
    console.log('✅ Login riuscito, token JWT acquisito.');

    // 2. GET /api/posizioni/me
    console.log('\n--- 2. Verifica GET /api/posizioni/me ---');
    const getPosRes = await fetch(`${baseUrl}/api/posizioni/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const getPosData = await getPosRes.json();
    console.log('Stato HTTP:', getPosRes.status);
    console.log('Dati posizione recuperata:', getPosData.data);
    if (getPosRes.status !== 200 || !getPosData.data.latitudine) {
      throw new Error('Recupero posizione utente fallito');
    }
    console.log('✅ GET /api/posizioni/me riuscita.');

    // 3. PUT /api/posizioni/me (Aggiornamento posizione e raggio di ricerca)
    console.log('\n--- 3. Verifica PUT /api/posizioni/me (Aggiornamento coordinate e raggio 15 km) ---');
    const putRes = await fetch(`${baseUrl}/api/posizioni/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        citta: 'Napoli',
        indirizzo_approssimato: 'Piazza del Plebiscito',
        latitudine: 40.8358846,
        longitudine: 14.2487827,
        raggio_ricerca_km: 15
      })
    });
    const putData = await putRes.json();
    console.log('Stato HTTP:', putRes.status);
    console.log('Risultato aggiornamento:', putData.data);
    if (putRes.status !== 200 || putData.data.raggio_ricerca_km !== 15) {
      throw new Error('Aggiornamento posizione fallito');
    }
    console.log('Coordinate reali:', putData.data.latitudine, putData.data.longitudine);
    console.log('Coordinate offuscate (300-500m):', putData.data.coordinate_offuscate);
    console.log('✅ PUT /api/posizioni/me completata con successo.');

    // 4. GET /api/posizioni/prossimita
    console.log('\n--- 4. Verifica GET /api/posizioni/prossimita (Ricerca geospaziale PostGIS) ---');
    const proxRes = await fetch(`${baseUrl}/api/posizioni/prossimita?raggio=20`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const proxData = await proxRes.json();
    console.log('Stato HTTP:', proxRes.status);
    console.log(`Numero posizioni rilevate nel raggio di 20 km: ${proxData.data.totale_trovati}`);
    proxData.data.risultati.forEach((p, idx) => {
      console.log(`  [${idx + 1}] ${p.utente} (${p.citta}) - Distanza: ${p.distanza_km} km`);
    });
    if (proxRes.status !== 200 || !Array.isArray(proxData.data.risultati)) {
      throw new Error('Ricerca di prossimità fallita');
    }
    console.log('✅ GET /api/posizioni/prossimita riuscita con calcolo geodetico.');

    // 5. Verifica erogazione pagina impostazioni.html
    console.log('\n--- 5. Verifica servibilità pagina impostazioni.html ---');
    const pageRes = await fetch(`${baseUrl}/impostazioni.html`);
    console.log('Stato HTTP impostazioni.html:', pageRes.status);
    if (pageRes.status !== 200) {
      throw new Error('Erogazione impostazioni.html fallita');
    }
    const htmlText = await pageRes.text();
    if (!htmlText.includes('raggio_ricerca_km') || !htmlText.includes('posizione_utenti')) {
      throw new Error('Contenuto impostazioni.html non integro');
    }
    console.log('✅ impostazioni.html erogata e convalidata con successo.');

    console.log('\n========================================');
    console.log('🎉 TUTTI I TEST DELLA FASE 14 SUPERATI!');
    console.log('========================================');
  } finally {
    server.close();
    await closePool();
  }
}

// Avvia l'esecuzione del collaudo
runCollaudo().catch((err) => {
  console.error('❌ Errore durante il collaudo:', err);
  process.exit(1);
});
