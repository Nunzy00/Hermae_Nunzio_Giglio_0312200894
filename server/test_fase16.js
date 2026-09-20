const http = require('http');
const app = require('./src/app');
const { closePool } = require('./src/config/db');

// Esegue il collaudo automatizzato end-to-end per la Fase 16 (preferenze_privacy_utenti e Privacy by Default)
async function runCollaudoFase16() {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[TEST SERVER FASE 16] Avviato su porta ${port}`);

  try {
    // 1. Autenticazione con demo@hermae.it per acquisire Access Token JWT
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

    // 2. Verifica protezione rotta senza autenticazione (HTTP 401)
    console.log('\n--- 2. Verifica Protezione Endpoint Riservati (senza token) ---');
    const unauthRes = await fetch(`${baseUrl}/api/privacy/me`);
    console.log('Stato HTTP senza token:', unauthRes.status);
    if (unauthRes.status !== 401) {
      throw new Error(`Atteso 401, ricevuto ${unauthRes.status}`);
    }
    console.log('✅ Endpoint /api/privacy/me protetto da middleware JWT.');

    // 3. Lettura preferenze di privacy (GET /api/privacy/me)
    console.log('\n--- 3. Lettura Impostazioni di Riservatezza (GET /api/privacy/me) ---');
    const getRes = await fetch(`${baseUrl}/api/privacy/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const getData = await getRes.json();
    console.log('Stato HTTP:', getRes.status);
    console.log('Dati preferenze utente:', getData.data);
    if (!getData.success || typeof getData.data.mostra_posizione !== 'boolean') {
      throw new Error(`Struttura preferenze non valida: ${JSON.stringify(getData)}`);
    }
    console.log('✅ Lettura preferenze superata con successo.');

    // 4. Aggiornamento dinamico delle preferenze (PUT /api/privacy/me)
    console.log('\n--- 4. Aggiornamento Impostazioni (PUT /api/privacy/me: disattivazione mostra_posizione) ---');
    const updateRes = await fetch(`${baseUrl}/api/privacy/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        mostra_posizione: false,
        mostra_email: false,
        raggio_visibilita_km: 25
      })
    });
    const updateData = await updateRes.json();
    console.log('Stato HTTP:', updateRes.status);
    console.log('Dati aggiornati:', updateData.data);
    if (updateData.data.mostra_posizione !== false || updateData.data.raggio_visibilita_km !== 25) {
      throw new Error(`Aggiornamento preferenze fallito: ${JSON.stringify(updateData)}`);
    }
    console.log('✅ Aggiornamento preferenze completato con successo.');

    // 5. Test di Privacy by Design: verifica esclusione dalle ricerche di prossimità altrui
    console.log('\n--- 5. Verifica Privacy by Design: Oscuramento da Ricerca Geospaziale ---');
    // Login con Laura Bianchi per effettuare la ricerca
    const loginLauraRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'laura.bianchi@example.com',
        password: 'PasswordSicura456!'
      })
    });
    const loginLauraData = await loginLauraRes.json();
    const tokenLaura = loginLauraData.data.tokens.accessToken;

    // Laura cerca utenti nel raggio di 50 km (Nunzio ha mostra_posizione = false, quindi non deve apparire)
    const searchRes1 = await fetch(`${baseUrl}/api/posizioni/prossimita?lat=40.8518&lng=14.2681&raggio=50`, {
      headers: { Authorization: `Bearer ${tokenLaura}` }
    });
    const searchData1 = await searchRes1.json();
    const nunzioPresente1 = searchData1.data.risultati.some(r => r.utente.startsWith('Nunzio'));
    console.log(`Nunzio visibile con mostra_posizione=false? ${nunzioPresente1 ? 'SÌ (ERRORE)' : 'NO (CORRETTO)'}`);
    if (nunzioPresente1) {
      throw new Error('Violazione Privacy: l\'utente con mostra_posizione=false compare nella ricerca geospaziale!');
    }
    console.log('✅ Privacy by Design verificata: utente escluso dalla mappa pubblica.');

    // 6. Riattivazione mostra_posizione e ripristino valori
    console.log('\n--- 6. Riattivazione mostra_posizione e Verifica Visibilità Ripristinata ---');
    await fetch(`${baseUrl}/api/privacy/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        mostra_posizione: true,
        raggio_visibilita_km: 10
      })
    });
    console.log('✅ mostra_posizione riattivato a true.');

    // 7. Reset ai valori di fabbrica Privacy by Default (DELETE /api/privacy/me)
    console.log('\n--- 7. Reset ai Valori Predefiniti GDPR (DELETE /api/privacy/me) ---');
    const resetRes = await fetch(`${baseUrl}/api/privacy/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const resetData = await resetRes.json();
    console.log('Stato HTTP:', resetRes.status);
    console.log('Dati dopo reset:', resetData.data);
    if (resetData.data.mostra_email !== false || resetData.data.profilo_pubblico !== false) {
      throw new Error(`Reset fallito: ${JSON.stringify(resetData)}`);
    }
    console.log('✅ Ripristino dei valori predefiniti GDPR confermato.');

    console.log('\n========================================');
    console.log('🎉 TUTTI I TEST DELLA FASE 16 SUPERATI!');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ ERRORE NEL COLLAUDO FASE 16:', error.message);
    process.exit(1);
  } finally {
    server.close();
    await closePool();
  }
}

runCollaudoFase16();
