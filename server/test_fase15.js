const http = require('http');
const app = require('./src/app');
const { closePool } = require('./src/config/db');

// Esegue il collaudo della Fase 15 (funzioni di geolocalizzazione, matching di prossimità e vista ricerca.html)
async function runCollaudoFase15() {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[TEST SERVER FASE 15] Avviato su porta ${port}`);

  try {
    // 1. Login per ottenere Access Token JWT valido
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
    console.log('✅ Access Token acquisito con successo.');

    // 2. Collaudo endpoint /api/posizioni/prossimita con raggio 5 km (deve includere Laura Bianchi ~1.5 km ed escludere Marco De Luca ~6.4 km e Giulia Romano ~188 km)
    console.log('\n--- 2. Verifica Prossimità con Raggio Ristretto (5 km da Napoli Centro) ---');
    const prox5Res = await fetch(`${baseUrl}/api/posizioni/prossimita?lat=40.8518&lng=14.2681&raggio=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const prox5Data = await prox5Res.json();
    console.log('Stato HTTP:', prox5Res.status);
    console.log(`Risultati trovati nel raggio di 5 km: ${prox5Data.data.totale_trovati}`);
    prox5Data.data.risultati.forEach((r, i) => {
      console.log(`  [${i + 1}] ${r.utente} (${r.citta}${r.indirizzo_approssimato ? ' - ' + r.indirizzo_approssimato : ''}) | Distanza: ${r.distanza_km} km | Fascia: ${r.fascia_prossimita}`);
    });

    // Marco De Luca (~6.4 km) e Giulia Romano (~188 km) devono essere esclusi da 5 km
    const hasMarcoIn5 = prox5Data.data.risultati.some(r => r.indirizzo_approssimato === 'Fuorigrotta');
    const hasGiuliaIn5 = prox5Data.data.risultati.some(r => r.citta === 'Roma');
    if (hasMarcoIn5 || hasGiuliaIn5) {
      throw new Error('Filtro perimetrale di 5 km ha incluso utenti fuori raggio!');
    }
    console.log('✅ Filtro di prossimità a 5 km coerente: esclusi profili a 6.4 km e 188 km.');

    // 3. Collaudo endpoint /api/posizioni/prossimita con raggio esteso (10 km da Napoli Centro)
    console.log('\n--- 3. Verifica Prossimità con Raggio Esteso (10 km da Napoli Centro) ---');
    const prox10Res = await fetch(`${baseUrl}/api/posizioni/prossimita?lat=40.8518&lng=14.2681&raggio=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const prox10Data = await prox10Res.json();
    console.log('Stato HTTP:', prox10Res.status);
    console.log(`Risultati trovati nel raggio di 10 km: ${prox10Data.data.totale_trovati}`);
    prox10Data.data.risultati.forEach((r, i) => {
      console.log(`  [${i + 1}] ${r.utente} (${r.citta}${r.indirizzo_approssimato ? ' - ' + r.indirizzo_approssimato : ''}) | Distanza: ${r.distanza_km} km | Fascia: ${r.fascia_prossimita}`);
    });

    const hasMarcoIn10 = prox10Data.data.risultati.some(r => r.indirizzo_approssimato === 'Fuorigrotta');
    if (!hasMarcoIn10) {
      throw new Error('Marco De Luca (Fuorigrotta ~6.4 km) doveva essere incluso nel raggio di 10 km!');
    }
    console.log('✅ Slider e query per raggio esteso validati con successo.');

    // 4. Verifica erogazione del modulo geolocation.js
    console.log('\n--- 4. Verifica Servibilità Modulo geolocation.js ---');
    const geoModuleRes = await fetch(`${baseUrl}/assets/js/geolocation.js`);
    console.log('Stato HTTP geolocation.js:', geoModuleRes.status);
    if (geoModuleRes.status !== 200) {
      throw new Error('Impossibile recuperare assets/js/geolocation.js');
    }
    const geoModuleText = await geoModuleRes.text();
    if (!geoModuleText.includes('HermaeGeo') || !geoModuleText.includes('calculateHaversineDistance')) {
      throw new Error('Modulo geolocation.js privo dei metodi richiesti');
    }
    console.log('✅ assets/js/geolocation.js convalidato con successo.');

    // 5. Verifica erogazione della pagina ricerca.html
    console.log('\n--- 5. Verifica Servibilità Vista ricerca.html ---');
    const mapPageRes = await fetch(`${baseUrl}/ricerca.html`);
    console.log('Stato HTTP ricerca.html:', mapPageRes.status);
    if (mapPageRes.status !== 200) {
      throw new Error('Impossibile erogare ricerca.html');
    }
    const mapPageText = await mapPageRes.text();
    if (!mapPageText.includes('leaflet') || !mapPageText.includes('raggioSlider') || !mapPageText.includes('table-hover')) {
      throw new Error('ricerca.html priva degli elementi cartografici o accessibili');
    }
    console.log('✅ ricerca.html erogata e convalidata con successo.');

    console.log('\n========================================');
    console.log('🎉 TUTTI I TEST DELLA FASE 15 SUPERATI!');
    console.log('========================================');
  } finally {
    server.close();
    await closePool();
  }
}

// Avvia l'esecuzione del collaudo
runCollaudoFase15().catch((err) => {
  console.error('❌ Errore durante il collaudo della Fase 15:', err);
  process.exit(1);
});
