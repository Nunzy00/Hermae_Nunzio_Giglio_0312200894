/**
 * Seed realistico per conversazioni e notifiche di demo
 * Popola thread di dialogo per test visivo in chat.html
 */

const db = require('./src/config/db');
const privacyShieldService = require('./src/services/privacyShieldService');

async function seedDemoChats() {
  try {
    console.log('Seeding demo chat conversations...');

    // 1. Recupera ID utenti
    const demoRes = await db.query("SELECT id FROM utenti WHERE email = 'demo@hermae.it'");
    const lauraRes = await db.query("SELECT id FROM utenti WHERE email = 'laura.bianchi@example.com'");
    const marcoRes = await db.query("SELECT id FROM utenti WHERE email = 'marco.deluca@example.com'");

    if (demoRes.rows.length === 0 || lauraRes.rows.length === 0 || marcoRes.rows.length === 0) {
      console.log('Utenti non trovati per il seed');
      process.exit(0);
    }

    const demoId = demoRes.rows[0].id;
    const lauraId = lauraRes.rows[0].id;
    const marcoId = marcoRes.rows[0].id;

    // 2. Trova un libro di Laura
    const libroLauraRes = await db.query("SELECT id, titolo FROM esemplari WHERE utente_id = $1 LIMIT 1", [lauraId]);
    // 3. Trova un libro di Demo
    const libroDemoRes = await db.query("SELECT id, titolo FROM esemplari WHERE utente_id = $1 LIMIT 1", [demoId]);

    if (libroLauraRes.rows.length === 0 || libroDemoRes.rows.length === 0) {
      console.log('Libri non trovati per il seed');
      process.exit(0);
    }

    const libroLaura = libroLauraRes.rows[0];
    const libroDemo = libroDemoRes.rows[0];

    // Pulisci eventuali record precedenti di questi utenti
    await db.query("DELETE FROM richieste_prestito WHERE richiedente_id IN ($1, $2, $3) OR proprietario_id IN ($1, $2, $3)", [demoId, lauraId, marcoId]);
    await db.query("DELETE FROM notifiche WHERE utente_id IN ($1, $2, $3)", [demoId, lauraId, marcoId]);

    // Crea Conversazione 1: Demo (richiedente) -> Laura (proprietario), stato ACCETTATA
    const ins1 = await db.query(`
      INSERT INTO richieste_prestito (richiedente_id, proprietario_id, esemplare_id, stato, messaggio_iniziale, data_richiesta, data_aggiornamento)
      VALUES ($1, $2, $3, 'ACCETTATA', 'Richiesta di scambio concordata', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour')
      RETURNING id
    `, [demoId, lauraId, libroLaura.id]);

    const req1Id = ins1.rows[0].id;

    // Messaggi Conversazione 1 con Privacy Shield
    const msg1_1 = privacyShieldService.sanitizeMessage(
      "Ciao Laura! Ho visto che hai reso disponibile questo volume e mi piacerebbe molto concordare uno scambio culturale. Sei in zona centro?"
    ).testoSanificato;
    await db.query(`
      INSERT INTO messaggi_chat (richiesta_id, mittente_id, testo, letto, data_invio)
      VALUES ($1, $2, $3, true, NOW() - INTERVAL '110 minutes')
    `, [req1Id, demoId, msg1_1]);

    const msg1_2 = privacyShieldService.sanitizeMessage(
      "Ciao! Certamente, il volume è disponibile in ottime condizioni. Se vuoi sentiamoci al 3331234567 oppure scrivimi su laura.test@example.com per fare prima!"
    ).testoSanificato;
    await db.query(`
      INSERT INTO messaggi_chat (richiesta_id, mittente_id, testo, letto, data_invio)
      VALUES ($1, $2, $3, true, NOW() - INTERVAL '70 minutes')
    `, [req1Id, lauraId, msg1_2]);

    const msg1_3 = privacyShieldService.sanitizeMessage(
      "Ottimo! Vedo che il Privacy Shield Hermae ha protetto i tuoi recapiti personali. Accordiamoci direttamente qui: sabato alle 16:30 vicino alla libreria centrale va bene per te?"
    ).testoSanificato;
    await db.query(`
      INSERT INTO messaggi_chat (richiesta_id, mittente_id, testo, letto, data_invio)
      VALUES ($1, $2, $3, false, NOW() - INTERVAL '25 minutes')
    `, [req1Id, demoId, msg1_3]);

    // Crea Conversazione 2: Marco (richiedente) -> Demo (proprietario), stato IN_ATTESA
    const ins2 = await db.query(`
      INSERT INTO richieste_prestito (richiedente_id, proprietario_id, esemplare_id, stato, messaggio_iniziale, data_richiesta)
      VALUES ($1, $2, $3, 'IN_ATTESA', 'Richiesta di contatto e scambio', NOW() - INTERVAL '15 minutes')
      RETURNING id
    `, [marcoId, demoId, libroDemo.id]);

    const req2Id = ins2.rows[0].id;

    const msg2_1 = privacyShieldService.sanitizeMessage(
      "Salve! Ho trovato il tuo libro nella mappa di prossimità. Sarei molto interessato a riceverlo in prestito per la preparazione della mia tesi di laurea. Fammi sapere se è possibile!"
    ).testoSanificato;
    await db.query(`
      INSERT INTO messaggi_chat (richiesta_id, mittente_id, testo, letto, data_invio)
      VALUES ($1, $2, $3, false, NOW() - INTERVAL '14 minutes')
    `, [req2Id, marcoId, msg2_1]);

    // Crea Notifiche Interne per Demo
    await db.query(`
      INSERT INTO notifiche (utente_id, richiesta_id, tipo, titolo, messaggio, letta, data_creazione)
      VALUES 
      ($1, $2, 'NUOVA_RICHIESTA', 'Nuova richiesta di scambio ricevuta', 'Marco De Luca ti ha inviato una richiesta di contatto per il tuo libro "${libroDemo.titolo}".', false, NOW() - INTERVAL '14 minutes'),
      ($1, $3, 'STATO_AGGIORNATO', 'Richiesta accettata', 'Laura Bianchi ha accettato la tua proposta di scambio per "${libroLaura.titolo}".', true, NOW() - INTERVAL '60 minutes')
    `, [demoId, req2Id, req1Id]);

    console.log('Seed completato con successo!');
    process.exit(0);
  } catch (err) {
    console.error('Errore seed:', err);
    process.exit(1);
  }
}

seedDemoChats();
