/**
 * HERMAE — Test di Collaudo Automatizzato per la Fase 17
 * Verifica delle routine di occultamento geolocalizzazione per tutela privacy:
 * 1. Test matematico algoritmi di blurring: QUARTIERE (300-500m), AREA_CAP (1.5-3 km), TOTALE (null)
 * 2. Test API PUT /api/privacy/me per cambio modalità in AREA_CAP e ricalcolo automatico coordinate
 * 3. Test query prossimità con esposizione contrassegno AREA_CAP
 * 4. Test API PUT /api/privacy/me per cambio modalità in TOTALE (azzeramento coordinate e mostra_posizione=false)
 * 5. Test query prossimità con inclusione aggregata 'Solo Città' senza coordinate né distanza
 * 6. Test ripristino valori predefiniti GDPR (DELETE /api/privacy/me)
 */

const http = require('http');
const app = require('./src/app');
const db = require('./src/config/db');
const posizioneService = require('./src/services/posizioneUtentiService');

// Formula dell'emisenoverso per verificare con precisione millimetrica la distanza dei punti generati
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

async function runTest() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[TEST SERVER FASE 17] Avviato su porta ${port}`);

  try {
    // ----------------------------------------------------
    // 1. Test Matematico Algoritmi di Offuscamento
    // ----------------------------------------------------
    console.log('\n--- 1. Verifica Matematica Algoritmi di Offuscamento ---');
    const napoliCentro = { lat: 40.8517746, lng: 14.2681244 };

    // Test modalità QUARTIERE (range 300 - 500m)
    for (let i = 0; i < 5; i++) {
      const pQuartiere = posizioneService.calculateCoordinateOccultate(napoliCentro.lat, napoliCentro.lng, 'QUARTIERE');
      const distQ = haversineDistanceMeters(napoliCentro.lat, napoliCentro.lng, pQuartiere.lat, pQuartiere.lng);
      if (distQ < 280 || distQ > 520) {
        throw new Error(`Distanza QUARTIERE fuori range atteso (300-500m): calcolata ${distQ}m`);
      }
    }
    console.log('✅ Modalità QUARTIERE: distanze verificate con successo nel range 300–500m.');

    // Test modalità AREA_CAP (range 1500 - 3000m)
    for (let i = 0; i < 5; i++) {
      const pArea = posizioneService.calculateCoordinateOccultate(napoliCentro.lat, napoliCentro.lng, 'AREA_CAP');
      const distA = haversineDistanceMeters(napoliCentro.lat, napoliCentro.lng, pArea.lat, pArea.lng);
      if (distA < 1450 || distA > 3050) {
        throw new Error(`Distanza AREA_CAP fuori range atteso (1500-3000m): calcolata ${distA}m`);
      }
    }
    console.log('✅ Modalità AREA_CAP: distanze verificate con successo nel range 1.5–3.0 km.');

    // Test modalità TOTALE
    const pTotale = posizioneService.calculateCoordinateOccultate(napoliCentro.lat, napoliCentro.lng, 'TOTALE');
    if (pTotale !== null) {
      throw new Error(`Modalità TOTALE deve restituire null, ricevuto: ${JSON.stringify(pTotale)}`);
    }
    console.log('✅ Modalità TOTALE: coordinate azzerate (null) conformemente alle specifiche.');

    // ----------------------------------------------------
    // 2. Autenticazione con Utente Demo (Nunzio)
    // ----------------------------------------------------
    console.log('\n--- 2. Autenticazione Utente Demo ---');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo@hermae.it',
        password: 'Password123!'
      })
    });
    const loginData = await loginRes.json();
    const tokenNunzio = loginData.data.tokens.accessToken;
    const nunzioId = loginData.data.user.id;
    console.log('✅ Access Token Nunzio acquisito.');

    // Assicura che la posizione iniziale di Nunzio sia persistita nel DB
    await posizioneService.upsertPosizione(nunzioId, {
      citta: 'Napoli',
      indirizzo_approssimato: 'Centro Storico',
      latitudine: 40.8517746,
      longitudine: 14.2681244,
      raggio_ricerca_km: 10
    });

    // ----------------------------------------------------
    // 3. Attivazione Modalità AREA_CAP
    // ----------------------------------------------------
    console.log('\n--- 3. Aggiornamento a Modalità AREA_CAP (PUT /api/privacy/me) ---');
    const putAreaRes = await fetch(`${baseUrl}/api/privacy/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenNunzio}`
      },
      body: JSON.stringify({
        modalita_occultamento: 'AREA_CAP'
      })
    });
    const putAreaData = await putAreaRes.json();
    console.log('Risposta Privacy AREA_CAP:', putAreaData.data);
    if (putAreaData.data.modalita_occultamento !== 'AREA_CAP' || putAreaData.data.mostra_posizione !== true) {
      throw new Error('Configurazione AREA_CAP non applicata correttamente');
    }

    // Verifica ricalcolo delle coordinate su posizione_utenti
    const posDbArea = await posizioneService.getPosizioneByUtenteId(nunzioId);
    if (!posDbArea.coordinate_offuscate) {
      throw new Error('Coordinate offuscate non presenti su DB per AREA_CAP');
    }
    const distAreaDb = haversineDistanceMeters(
      posDbArea.latitudine,
      posDbArea.longitudine,
      posDbArea.coordinate_offuscate.lat,
      posDbArea.coordinate_offuscate.lng
    );
    console.log(`Distanza reale dal centro registrata su DB: ${distAreaDb}m`);
    if (distAreaDb < 1400 || distAreaDb > 3100) {
      throw new Error(`Coordinate offuscate su DB fuori intervallo macro-area: ${distAreaDb}m`);
    }
    console.log('✅ Coordinate offuscate su DB ricalcolate correttamente su scala macro-area/CAP.');

    // ----------------------------------------------------
    // 4. Verifica Risultati Prossimità per AREA_CAP
    // ----------------------------------------------------
    console.log('\n--- 4. Verifica Prossimità con AREA_CAP (da parte di Laura Bianchi) ---');
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

    const proxRes1 = await fetch(`${baseUrl}/api/posizioni/prossimita?lat=40.8518&lng=14.2681&raggio=15`, {
      headers: { Authorization: `Bearer ${tokenLaura}` }
    });
    const proxData1 = await proxRes1.json();
    const nunzioItem1 = proxData1.data.risultati.find(r => r.utente.startsWith('Nunzio'));
    if (!nunzioItem1) {
      throw new Error('Nunzio non trovato nei risultati di prossimità con AREA_CAP a 15 km');
    }
    console.log('Dati Nunzio nei risultati di prossimità:', {
      utente: nunzioItem1.utente,
      citta: nunzioItem1.citta,
      modalita_occultamento: nunzioItem1.modalita_occultamento,
      fascia_prossimita: nunzioItem1.fascia_prossimita,
      distanza_km: nunzioItem1.distanza_km
    });
    if (nunzioItem1.modalita_occultamento !== 'AREA_CAP' || nunzioItem1.fascia_prossimita !== 'Area/CAP (~2 km)') {
      throw new Error('Etichettatura di prossimità per AREA_CAP non corretta');
    }
    console.log('✅ Nunzio visibile con contrassegno Area/CAP (~2 km) a tutela dell\'anonimato.');

    // ----------------------------------------------------
    // 5. Attivazione Modalità TOTALE (Totale Oscuramento)
    // ----------------------------------------------------
    console.log('\n--- 5. Aggiornamento a Modalità TOTALE (Totale Oscuramento) ---');
    const putTotaleRes = await fetch(`${baseUrl}/api/privacy/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenNunzio}`
      },
      body: JSON.stringify({
        modalita_occultamento: 'TOTALE'
      })
    });
    const putTotaleData = await putTotaleRes.json();
    console.log('Risposta Privacy TOTALE:', putTotaleData.data);
    if (putTotaleData.data.modalita_occultamento !== 'TOTALE' || putTotaleData.data.mostra_posizione !== false) {
      throw new Error('Configurazione TOTALE non applicata correttamente');
    }

    // Verifica azzeramento su DB
    const posDbTotale = await posizioneService.getPosizioneByUtenteId(nunzioId);
    if (posDbTotale.coordinate_offuscate !== null) {
      throw new Error(`Le coordinate su DB non sono state azzerate a NULL: ${JSON.stringify(posDbTotale.coordinate_offuscate)}`);
    }
    console.log('✅ Coordinate su DB azzerate a NULL a garanzia del totale oscuramento.');

    // ----------------------------------------------------
    // 6. Verifica Esclusione Mappa e Inclusione 'Solo Città'
    // ----------------------------------------------------
    console.log('\n--- 6. Verifica Esclusione da Mappa e Inclusione Reperibilità Città ---');
    // Richiesta standard (solo mappa)
    const proxResMapOnly = await fetch(`${baseUrl}/api/posizioni/prossimita?lat=40.8518&lng=14.2681&raggio=15`, {
      headers: { Authorization: `Bearer ${tokenLaura}` }
    });
    const proxDataMapOnly = await proxResMapOnly.json();
    const nunzioSuMappa = proxDataMapOnly.data.risultati.find(r => r.utente.startsWith('Nunzio'));
    if (nunzioSuMappa) {
      throw new Error('Violazione Privacy: Nunzio con totale oscuramento appare nei pin cartografici!');
    }
    console.log('✅ Esclusione da mappa confermata: nessun pin generato.');

    // Richiesta con includi_solo_citta=true
    const proxResAll = await fetch(`${baseUrl}/api/posizioni/prossimita?lat=40.8518&lng=14.2681&raggio=15&includi_solo_citta=true`, {
      headers: { Authorization: `Bearer ${tokenLaura}` }
    });
    const proxDataAll = await proxResAll.json();
    const nunzioSoloCitta = proxDataAll.data.risultati.find(r => r.utente.startsWith('Nunzio'));
    if (!nunzioSoloCitta) {
      throw new Error('Nunzio non trovato nei risultati aggregati per città');
    }
    console.log('Dati Nunzio aggregati:', {
      utente: nunzioSoloCitta.utente,
      citta: nunzioSoloCitta.citta,
      fascia_prossimita: nunzioSoloCitta.fascia_prossimita,
      coordinate_offuscate: nunzioSoloCitta.coordinate_offuscate,
      distanza_km: nunzioSoloCitta.distanza_km,
      mostra_su_mappa: nunzioSoloCitta.mostra_su_mappa
    });
    if (nunzioSoloCitta.fascia_prossimita !== 'Solo Città' || nunzioSoloCitta.coordinate_offuscate !== null || nunzioSoloCitta.distanza_km !== null) {
      throw new Error('Violazione dati aggregati: coordinate o distanza esposte per utente oscurato');
    }
    console.log('✅ Reperibilità aggregata verificata: utente etichettato esclusivamente con la città obbligatoria.');

    // ----------------------------------------------------
    // 7. Reset ai Valori Predefiniti GDPR
    // ----------------------------------------------------
    console.log('\n--- 7. Reset Privacy by Default (DELETE /api/privacy/me) ---');
    const delRes = await fetch(`${baseUrl}/api/privacy/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenNunzio}` }
    });
    const delData = await delRes.json();
    console.log('Dati dopo reset:', delData.data);
    if (delData.data.modalita_occultamento !== 'QUARTIERE' || delData.data.mostra_posizione !== true) {
      throw new Error('Reset alle impostazioni predefinite GDPR fallito');
    }

    const posDbReset = await posizioneService.getPosizioneByUtenteId(nunzioId);
    if (!posDbReset.coordinate_offuscate) {
      throw new Error('Coordinate offuscate di quartiere non ripristinate su DB');
    }
    console.log('✅ Ripristino impostazioni predefinite GDPR completato.');

    console.log('\n========================================');
    console.log('🎉 TUTTI I TEST DELLA FASE 17 SUPERATI!');
    console.log('========================================\n');

  } catch (err) {
    console.error('\n❌ ERRORE NEL COLLAUDO FASE 17:', err.message);
    process.exitCode = 1;
  } finally {
    server.close();
    await db.query('SELECT 1');
  }
}

runTest();
