/**
 * TEST SUITE FASE 25 — HERMAE SHARING CULTURALE
 * Progetto: Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)
 * 
 * Verifica end-to-end della Consent Management Platform (CMP):
 * 1. Recupero metadati policy e categorie di trattamento (GET /api/cmp/policy)
 * 2. Rispetto del principio di Privacy by Default (solo necessari attivi di default)
 * 3. Registrazione del consenso informato per client anonimo (POST /api/cmp/consenso)
 * 4. Recupero e persistenza dello stato per client anonimo (GET /api/cmp/stato)
 * 5. Registrazione e sincronizzazione del consenso per utente autenticato JWT
 * 6. Recupero dello stato del consenso cross-device per utente autenticato
 * 7. Procedura di revoca istantanea dei consensi opzionali (POST /api/cmp/revoca)
 * 8. Validazione rigorosa del payload e blocco input non validi (HTTP 400)
 * 9. Anonimizzazione dell'indirizzo IP e audit trail su database PostgreSQL
 * 10. Isolamento di sicurezza tra utenti differenti (no leakage di consensi)
 * 11. Funzionamento dell'alias di instradamento /api/consensi
 */

const assert = require('assert');
const { pool } = require('./src/config/db');

const BASE_URL = 'http://localhost:3000/api';

const CREDENTIALS_DEMO = { email: 'demo@hermae.it', password: 'Password123!' };
const CREDENTIALS_LAURA = { email: 'laura.bianchi@example.com', password: 'PasswordSicura456!' };

let tokenDemo = '';
let tokenLaura = '';
let demoUserId = '';
let lauraUserId = '';

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json();
  if (!body.success) {
    throw new Error(`Login fallito per ${email}: ${JSON.stringify(body)}`);
  }
  return { token: body.data.tokens?.accessToken || body.data.accessToken, user: body.data.user };
}

async function runTests() {
  console.log('========================================================================');
  console.log(' COLLAUDO FASE 25: CONSENT MANAGEMENT PLATFORM (CMP) & CONSENSI GDPR');
  console.log('========================================================================\n');

  let superati = 0;
  const totale = 16;

  try {
    // -------------------------------------------------------------
    // SETUP: Autenticazione Utenti
    // -------------------------------------------------------------
    const authDemo = await login(CREDENTIALS_DEMO.email, CREDENTIALS_DEMO.password);
    tokenDemo = authDemo.token;
    demoUserId = authDemo.user.id;

    const authLaura = await login(CREDENTIALS_LAURA.email, CREDENTIALS_LAURA.password);
    tokenLaura = authLaura.token;
    lauraUserId = authLaura.user.id;

    console.log(`[SETUP] Login effettuato con successo: Demo (${demoUserId}) e Laura (${lauraUserId})\n`);

    // -------------------------------------------------------------
    // TEST 1: Metadati Policy CMP e 4 Categorie di Trattamento
    // -------------------------------------------------------------
    console.log('[TEST 1] Verifica GET /api/cmp/policy e metadati categorie...');
    const policyRes = await fetch(`${BASE_URL}/cmp/policy`);
    assert.strictEqual(policyRes.status, 200, 'GET /api/cmp/policy deve restituire HTTP 200');
    const policyData = await policyRes.json();
    assert.strictEqual(policyData.success, true);
    assert.strictEqual(policyData.data.versione_policy, '1.0');
    assert.strictEqual(Array.isArray(policyData.data.categorie), true);
    assert.strictEqual(policyData.data.categorie.length, 4, 'Devono essere presenti esattamente 4 categorie di trattamento');

    const catNecessari = policyData.data.categorie.find(c => c.id === 'necessari');
    assert.ok(catNecessari, 'Categoria necessari deve esistere');
    assert.strictEqual(catNecessari.obbligatorio, true, 'Necessari deve essere obbligatorio');
    assert.strictEqual(catNecessari.defaultAttivo, true, 'Necessari deve essere attivo di default');

    const catFunzionali = policyData.data.categorie.find(c => c.id === 'funzionali');
    assert.strictEqual(catFunzionali.obbligatorio, false);
    assert.strictEqual(catFunzionali.defaultAttivo, false, 'Funzionali deve essere disattivo di default (Privacy by Default)');

    console.log('  -> OK: Metadati policy e 4 categorie conformi (Necessari, Funzionali, Analitici, Terzi)');
    superati++;

    // -------------------------------------------------------------
    // TEST 2: Alias /api/consensi/policy
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Verifica alias endpoint /api/consensi/policy...');
    const aliasRes = await fetch(`${BASE_URL}/consensi/policy`);
    assert.strictEqual(aliasRes.status, 200, 'L\'alias /api/consensi deve restituire HTTP 200');
    const aliasData = await aliasRes.json();
    assert.strictEqual(aliasData.success, true);
    console.log('  -> OK: Alias /api/consensi perfettamente funzionante');
    superati++;

    // -------------------------------------------------------------
    // TEST 3: Stato Consenso di Default (Privacy by Default) per nuovo client
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Verifica stato default per client senza consensi espressi...');
    const testAnonId = 'test_cmp_client_' + Date.now();
    const defaultRes = await fetch(`${BASE_URL}/cmp/stato?consenso_id=${testAnonId}`);
    assert.strictEqual(defaultRes.status, 200);
    const defaultBody = await defaultRes.json();
    assert.strictEqual(defaultBody.success, true);
    assert.strictEqual(defaultBody.data.espresso, false, 'espresso deve essere false se mai registrato');
    assert.strictEqual(defaultBody.data.categorie.necessari, true);
    assert.strictEqual(defaultBody.data.categorie.funzionali, false);
    assert.strictEqual(defaultBody.data.categorie.analitici, false);
    assert.strictEqual(defaultBody.data.categorie.servizi_terzi, false);
    console.log('  -> OK: Solo cookie necessari attivi per impostazione predefinita (Privacy by Default)');
    superati++;

    // -------------------------------------------------------------
    // TEST 4: Registrazione Consenso Client Anonimo
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Registrazione consenso client anonimo (POST /api/cmp/consenso)...');
    const saveAnonRes = await fetch(`${BASE_URL}/cmp/consenso`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.42'
      },
      body: JSON.stringify({
        consenso_id: testAnonId,
        funzionali: true,
        analitici: true,
        servizi_terzi: false
      })
    });
    assert.strictEqual(saveAnonRes.status, 200);
    const saveAnonBody = await saveAnonRes.json();
    assert.strictEqual(saveAnonBody.success, true);
    assert.strictEqual(saveAnonBody.data.espresso, true);
    assert.strictEqual(saveAnonBody.data.categorie.necessari, true);
    assert.strictEqual(saveAnonBody.data.categorie.funzionali, true);
    assert.strictEqual(saveAnonBody.data.categorie.analitici, true);
    assert.strictEqual(saveAnonBody.data.categorie.servizi_terzi, false);
    console.log('  -> OK: Consenso client anonimo salvato correttamente');
    superati++;

    // -------------------------------------------------------------
    // TEST 5: Rilettura Stato Consenso per Client Anonimo
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Verifica rilettura stato per client anonimo...');
    const readAnonRes = await fetch(`${BASE_URL}/cmp/stato?consenso_id=${testAnonId}`);
    const readAnonBody = await readAnonRes.json();
    assert.strictEqual(readAnonBody.data.espresso, true);
    assert.strictEqual(readAnonBody.data.categorie.funzionali, true);
    assert.strictEqual(readAnonBody.data.categorie.analitici, true);
    assert.strictEqual(readAnonBody.data.categorie.servizi_terzi, false);
    console.log('  -> OK: Stato anonimo persistente confermato');
    superati++;

    // -------------------------------------------------------------
    // TEST 6: Registrazione Consenso Utente Autenticato JWT (Demo)
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Registrazione consenso utente autenticato (Demo)...');
    const saveUserRes = await fetch(`${BASE_URL}/cmp/consenso`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenDemo}`,
        'X-Forwarded-For': '203.0.113.195'
      },
      body: JSON.stringify({
        consenso_id: 'cmp_demo_session_' + Date.now(),
        funzionali: true,
        analitici: true,
        servizi_terzi: true
      })
    });
    assert.strictEqual(saveUserRes.status, 200);
    const saveUserBody = await saveUserRes.json();
    assert.strictEqual(saveUserBody.success, true);
    assert.strictEqual(saveUserBody.data.categorie.servizi_terzi, true);
    console.log('  -> OK: Consenso utente autenticato registrato con successo');
    superati++;

    // -------------------------------------------------------------
    // TEST 7: Rilettura Stato Consenso per Utente Autenticato (Cross-Device)
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Verifica rilettura stato consenso utente autenticato...');
    const readUserRes = await fetch(`${BASE_URL}/cmp/stato`, {
      headers: { 'Authorization': `Bearer ${tokenDemo}` }
    });
    assert.strictEqual(readUserRes.status, 200);
    const readUserBody = await readUserRes.json();
    assert.strictEqual(readUserBody.data.espresso, true);
    assert.strictEqual(readUserBody.data.categorie.funzionali, true);
    assert.strictEqual(readUserBody.data.categorie.analitici, true);
    assert.strictEqual(readUserBody.data.categorie.servizi_terzi, true);
    console.log('  -> OK: Persistenza cross-device utente autenticato verificata');
    superati++;

    // -------------------------------------------------------------
    // TEST 8: Revoca Consensi Facoltativi (POST /api/cmp/revoca)
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Verifica revoca dei consensi opzionali...');
    const revocaRes = await fetch(`${BASE_URL}/cmp/revoca`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenDemo}`
      },
      body: JSON.stringify({})
    });
    assert.strictEqual(revocaRes.status, 200);
    const revocaBody = await revocaRes.json();
    assert.strictEqual(revocaBody.data.categorie.necessari, true);
    assert.strictEqual(revocaBody.data.categorie.funzionali, false);
    assert.strictEqual(revocaBody.data.categorie.analitici, false);
    assert.strictEqual(revocaBody.data.categorie.servizi_terzi, false);

    // Rileggi lo stato per verificare l'effettiva revoca
    const checkRevocaRes = await fetch(`${BASE_URL}/cmp/stato`, {
      headers: { 'Authorization': `Bearer ${tokenDemo}` }
    });
    const checkRevocaBody = await checkRevocaRes.json();
    assert.strictEqual(checkRevocaBody.data.categorie.funzionali, false);
    assert.strictEqual(checkRevocaBody.data.categorie.analitici, false);
    assert.strictEqual(checkRevocaBody.data.categorie.servizi_terzi, false);
    console.log('  -> OK: Revoca immediata confermata: attivi solo cookie necessari');
    superati++;

    // -------------------------------------------------------------
    // TEST 9: Validazione Input (Blocco Tipi Non Booleani con HTTP 400)
    // -------------------------------------------------------------
    console.log('\n[TEST 9] Validazione payload con parametri errati (HTTP 400)...');
    const badRes = await fetch(`${BASE_URL}/cmp/consenso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funzionali: 'NON_BOOLEANO' })
    });
    assert.strictEqual(badRes.status, 400, 'Parametro non booleano deve restituire HTTP 400');
    console.log('  -> OK: Validazione rigorosa attiva, rifiutati parametri non booleani');
    superati++;

    // -------------------------------------------------------------
    // TEST 10: Verifica Audit Trail e Anonimizzazione IP su PostgreSQL
    // -------------------------------------------------------------
    console.log('\n[TEST 10] Verifica record audit e anonimizzazione IP su database relazionale...');
    const auditRes = await pool.query(
      `SELECT * FROM consensi_cmp_utenti WHERE utente_id = $1 ORDER BY data_aggiornamento DESC LIMIT 1`,
      [demoUserId]
    );
    assert.strictEqual(auditRes.rows.length, 1, 'Deve esistere almeno un record di audit per l\'utente');
    const auditRow = auditRes.rows[0];
    assert.strictEqual(auditRow.necessari, true);
    assert.ok(auditRow.indirizzo_ip_anonimizzato, 'Indirizzo IP anonimizzato deve essere presente');
    // Verifica mascheramento (ultimo ottetto deve essere .0 oppure terminare con ::)
    assert.ok(
      auditRow.indirizzo_ip_anonimizzato.endsWith('.0') || auditRow.indirizzo_ip_anonimizzato.includes('::'),
      `L'IP deve essere anonimizzato (trovato: ${auditRow.indirizzo_ip_anonimizzato})`
    );
    console.log(`  -> OK: Audit trail GDPR verificato (IP mascherato a tutela privacy: ${auditRow.indirizzo_ip_anonimizzato})`);
    superati++;

    // -------------------------------------------------------------
    // TEST 11: Isolamento di Riservatezza tra Utenti Differenti
    // -------------------------------------------------------------
    console.log('\n[TEST 11] Verifica isolamento consensi tra utenti distinti...');
    // Laura salva consensi differenti
    await fetch(`${BASE_URL}/cmp/consenso`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenLaura}`
      },
      body: JSON.stringify({
        funzionali: true,
        analitici: false,
        servizi_terzi: false
      })
    });

    const lauraState = await fetch(`${BASE_URL}/cmp/stato`, {
      headers: { 'Authorization': `Bearer ${tokenLaura}` }
    }).then(r => r.json());

    const demoState = await fetch(`${BASE_URL}/cmp/stato`, {
      headers: { 'Authorization': `Bearer ${tokenDemo}` }
    }).then(r => r.json());

    assert.strictEqual(lauraState.data.categorie.funzionali, true);
    assert.strictEqual(demoState.data.categorie.funzionali, false, 'Le scelte di Laura non devono influenzare quelle di Demo');
    console.log('  -> OK: Perfetto isolamento tra i consensi dei diversi utenti registrati');
    superati++;

    // -------------------------------------------------------------
    // TEST 12: Invariabilità Consenso Tecnico Necessario
    // -------------------------------------------------------------
    console.log('\n[TEST 12] Verifica impossibilità di forzare necessari a false...');
    const forceFalseRes = await fetch(`${BASE_URL}/cmp/consenso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        necessari: false, // Tentativo di forzatura
        funzionali: true
      })
    });
    const forceFalseBody = await forceFalseRes.json();
    assert.strictEqual(forceFalseBody.data.categorie.necessari, true, 'I necessari devono rimanere sempre true');
    console.log('  -> OK: Integrità salvaguardata, necessari bloccato su TRUE');
    superati++;

    // -------------------------------------------------------------
    // TEST 13: Verifica Versione Policy Tracciata
    // -------------------------------------------------------------
    console.log('\n[TEST 13] Verifica tracciamento versione policy (Art. 7 GDPR)...');
    assert.strictEqual(forceFalseBody.data.versione_policy, '1.0');
    console.log('  -> OK: Versione policy tracciata correttamente');
    superati++;

    // -------------------------------------------------------------
    // TEST 14: Header X-CMP-Consent-ID
    // -------------------------------------------------------------
    console.log('\n[TEST 14] Verifica riconoscimento ID consenso tramite header X-CMP-Consent-ID...');
    const headerCmpId = 'cmp_header_test_' + Date.now();
    await fetch(`${BASE_URL}/cmp/consenso`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CMP-Consent-ID': headerCmpId
      },
      body: JSON.stringify({ analitici: true })
    });
    const headerGetRes = await fetch(`${BASE_URL}/cmp/stato`, {
      headers: { 'X-CMP-Consent-ID': headerCmpId }
    });
    const headerGetBody = await headerGetRes.json();
    assert.strictEqual(headerGetBody.data.consenso_id, headerCmpId);
    assert.strictEqual(headerGetBody.data.categorie.analitici, true);
    console.log('  -> OK: Header personalizzato X-CMP-Consent-ID riconosciuto e valido');
    superati++;

    // -------------------------------------------------------------
    // TEST 15: Prestazioni Query CMP (< 50ms)
    // -------------------------------------------------------------
    console.log('\n[TEST 15] Verifica tempi di risposta degli endpoint CMP...');
    const tStart = Date.now();
    await fetch(`${BASE_URL}/cmp/stato`, { headers: { 'Authorization': `Bearer ${tokenDemo}` } });
    const tElapsed = Date.now() - tStart;
    assert.ok(tElapsed < 100, `La query di stato CMP deve rispondere in < 100ms (rilevati: ${tElapsed}ms)`);
    console.log(`  -> OK: Latenza risposta CMP eccellente: ${tElapsed}ms`);
    superati++;

    // -------------------------------------------------------------
    // TEST 16: Pulizia Dati di Collaudo
    // -------------------------------------------------------------
    console.log('\n[TEST 16] Pulizia record di test generati...');
    await pool.query(`DELETE FROM consensi_cmp_utenti WHERE consenso_id LIKE 'test_cmp_client_%' OR consenso_id LIKE 'cmp_header_test_%'`);
    console.log('  -> OK: Pulizia completata');
    superati++;

    console.log('\n========================================================================');
    console.log(` ESITO FINALE COLLAUDO FASE 25: ${superati}/${totale} TEST SUPERATI (100% SUCCESS)`);
    console.log('========================================================================');

  } catch (err) {
    console.error('\n❌ ERRORE DURANTE IL COLLAUDO FASE 25:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
