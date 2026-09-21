/**
 * Script di Popolamento Dati Mock — Esemplari e Riservatezza Privacy
 * Hermae — Nunzio Giglio (Matr. 0312200894)
 *
 * Configura un dataset realistico ed eterogeneo per testare:
 * 1. Libri pubblici vs privati per lo stesso utente con libreria visibile (Laura Bianchi, Nunzio Giglio, Giulia Romano)
 * 2. Utente con intera libreria occultata (Marco De Luca: mostra_libreria = false)
 * 3. Visibilità nella vista personale (/api/esemplari/mie) vs vista pubblica (/api/esemplari)
 */

const db = require('./src/config/db');

async function seedEsemplari() {
  try {
    console.log('========================================================================');
    console.log(' POPOLAMENTO DATI MOCK ESEMPLARI E SCENARI PRIVACY HERMAE');
    console.log('========================================================================\n');

    // 1. Recupero Utenti
    const usersRes = await db.query('SELECT id, email, nome, cognome FROM utenti');
    const users = {};
    usersRes.rows.forEach(u => { users[u.email] = u.id; });

    // 2. Recupero Categorie
    const catsRes = await db.query('SELECT id, slug FROM categorie');
    const cats = {};
    catsRes.rows.forEach(c => { cats[c.slug] = c.id; });

    // 3. Recupero Coordinate Utenti
    const posRes = await db.query('SELECT utente_id, coordinate_reali[0] as lng, coordinate_reali[1] as lat FROM posizione_utenti');
    const coords = {};
    posRes.rows.forEach(p => { 
      coords[p.utente_id] = `(${p.lng},${p.lat})`; 
    });

    // 4. Configurazione Preferenze Privacy per Scenari di Test
    console.log('[1/3] Configurazione Preferenze Privacy Utenti...');
    
    // Nunzio Giglio (demo@hermae.it) -> mostra_libreria = TRUE
    await db.query(`
      INSERT INTO preferenze_privacy_utenti (utente_id, mostra_libreria, mostra_posizione, modalita_occultamento)
      VALUES ($1, true, true, 'QUARTIERE')
      ON CONFLICT (utente_id) DO UPDATE SET mostra_libreria = true, mostra_posizione = true, modalita_occultamento = 'QUARTIERE'
    `, [users['demo@hermae.it']]);

    // Laura Bianchi (laura.bianchi@example.com) -> mostra_libreria = TRUE (Libreria visibile, con mix libri pubblici e privati)
    await db.query(`
      INSERT INTO preferenze_privacy_utenti (utente_id, mostra_libreria, mostra_posizione, modalita_occultamento)
      VALUES ($1, true, true, 'QUARTIERE')
      ON CONFLICT (utente_id) DO UPDATE SET mostra_libreria = true, mostra_posizione = true, modalita_occultamento = 'QUARTIERE'
    `, [users['laura.bianchi@example.com']]);

    // Marco De Luca (marco.deluca@example.com) -> mostra_libreria = FALSE (SCENARIO TEST: Intera libreria occultata!)
    await db.query(`
      INSERT INTO preferenze_privacy_utenti (utente_id, mostra_libreria, mostra_posizione, modalita_occultamento)
      VALUES ($1, false, true, 'AREA_CAP')
      ON CONFLICT (utente_id) DO UPDATE SET mostra_libreria = false, mostra_posizione = true, modalita_occultamento = 'AREA_CAP'
    `, [users['marco.deluca@example.com']]);

    // Giulia Romano (giulia.romano@example.com) -> mostra_libreria = TRUE (Roma, mix pubblico/privato)
    await db.query(`
      INSERT INTO preferenze_privacy_utenti (utente_id, mostra_libreria, mostra_posizione, modalita_occultamento)
      VALUES ($1, true, true, 'QUARTIERE')
      ON CONFLICT (utente_id) DO UPDATE SET mostra_libreria = true, mostra_posizione = true, modalita_occultamento = 'QUARTIERE'
    `, [users['giulia.romano@example.com']]);

    console.log('  ✓ Preferenze privacy impostate:');
    console.log('    - demo@hermae.it: mostra_libreria = TRUE');
    console.log('    - laura.bianchi@example.com: mostra_libreria = TRUE');
    console.log('    - marco.deluca@example.com: mostra_libreria = FALSE (INTERO SCAFFALE OCCULTATO)');
    console.log('    - giulia.romano@example.com: mostra_libreria = TRUE\n');

    // 5. Definizione del Catalogo Esemplari
    const books = [
      // ------------------------------------------------------------------------
      // UTENTE DEMO: Nunzio Giglio (demo@hermae.it) — Napoli Centro Storico
      // ------------------------------------------------------------------------
      {
        utente_id: users['demo@hermae.it'],
        categoria_id: cats['narrativa-romanzi'],
        sottogenere: 'Giallo & Thriller',
        titolo: 'Il nome della rosa',
        autore: 'Umberto Eco',
        editore: 'Bompiani',
        anno_pubblicazione: 1980,
        isbn: '9788845278655',
        lingua: 'Italiano',
        descrizione: 'Celebre giallo storico ambientato in un monastero benedettino del XIV secolo, incentrato sull\'indagine di frate Guglielmo da Baskerville.',
        note: 'Prima edizione tascabile con copertina integra, lievi fioriture sui tagli.',
        stato_conservazione: 'Ottimo',
        stato_disponibilita: 'DISPONIBILE',
        visibile_pubblico: true,
        coordinate: coords[users['demo@hermae.it']] || '(14.2681,40.8518)'
      },
      {
        utente_id: users['demo@hermae.it'],
        categoria_id: cats['informatica-tecnologia'],
        sottogenere: 'Ingegneria del Software',
        titolo: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        autore: 'Robert C. Martin',
        editore: 'Prentice Hall',
        anno_pubblicazione: 2008,
        isbn: '9780132350884',
        lingua: 'Inglese',
        descrizione: 'Guida fondamentale ai principi dello sviluppo software pulito, refactoring e standard di leggibilità del codice.',
        note: 'Edizione in lingua originale inglese. Nessuna sottolineatura, pari al nuovo.',
        stato_conservazione: 'Come nuovo',
        stato_disponibilita: 'DISPONIBILE',
        visibile_pubblico: true,
        coordinate: coords[users['demo@hermae.it']] || '(14.2681,40.8518)'
      },
      {
        utente_id: users['demo@hermae.it'],
        categoria_id: cats['informatica-tecnologia'],
        sottogenere: 'Architetture Software',
        titolo: 'Designing Data-Intensive Applications',
        autore: 'Martin Kleppmann',
        editore: "O'Reilly Media",
        anno_pubblicazione: 2017,
        isbn: '9781449373320',
        lingua: 'Inglese',
        descrizione: 'Trattato sistematico sui sistemi distribuiti, consistenza dei dati, modelli di storage, transazioni e partizionamento.',
        note: 'Testo di riferimento per progettazione backend ad alte prestazioni.',
        stato_conservazione: 'Come nuovo',
        stato_disponibilita: 'DISPONIBILE',
        visibile_pubblico: true,
        coordinate: coords[users['demo@hermae.it']] || '(14.2681,40.8518)'
      },
      {
        utente_id: users['demo@hermae.it'],
        categoria_id: cats['saggistica-filosofia'],
        sottogenere: 'Psicologia & Psicoanalisi',
        titolo: 'Pensieri lenti e veloci',
        autore: 'Daniel Kahneman',
        editore: 'Mondadori',
        anno_pubblicazione: 2012,
        isbn: '9788804623120',
        lingua: 'Italiano',
        descrizione: 'Trattato di economia comportamentale e psicologia cognitiva sui due sistemi che guidano i processi decisionali umani.',
        note: 'Copertina con lievi segni d\'uso, annotazioni a margine; esemplare ad uso di studio personale.',
        stato_conservazione: 'Buono',
        stato_disponibilita: 'NON_DISPONIBILE',
        visibile_pubblico: false, // PRIVATO
        coordinate: coords[users['demo@hermae.it']] || '(14.2681,40.8518)'
      },
      {
        utente_id: users['demo@hermae.it'],
        categoria_id: cats['saggistica-filosofia'],
        sottogenere: 'Filosofia della Mente',
        titolo: 'L\'errore di Cartesio: Emozione, ragione e cervello umano',
        autore: 'Antonio Damasio',
        editore: 'Adelphi',
        anno_pubblicazione: 1995,
        isbn: '9788845911545',
        lingua: 'Italiano',
        descrizione: 'Riflessione neuroscientifica sull\'interazione imprescindibile tra sentimenti ed elaborazione razionale.',
        note: 'Copia privata personale con glosse di approfondimento, non disponibile per il prestito pubblico.',
        stato_conservazione: 'Ottimo',
        stato_disponibilita: 'NON_DISPONIBILE',
        visibile_pubblico: false, // PRIVATO
        coordinate: coords[users['demo@hermae.it']] || '(14.2681,40.8518)'
      },

      // ------------------------------------------------------------------------
      // UTENTE LAURA BIANCHI (laura.bianchi@example.com) — Napoli Vomero (1.5 km)
      // Libreria PUBBLICA (mostra_libreria = true), con 2 libri pubblici e 2 privati
      // ------------------------------------------------------------------------
      {
        utente_id: users['laura.bianchi@example.com'],
        categoria_id: cats['storia-biografie'],
        sottogenere: 'Storia Contemporanea & Guerre Mondiali',
        titolo: 'Se questo è un uomo',
        autore: 'Primo Levi',
        editore: 'Einaudi',
        anno_pubblicazione: 1958,
        isbn: '9788806219345',
        lingua: 'Italiano',
        descrizione: 'Testimonianza memorialistica fondamentale dell\'esperienza di prigionia dell\'autore nel campo di concentramento di Auschwitz.',
        note: 'Edizione commentata per le scuole superiori con prefazione dell\'autore.',
        stato_conservazione: 'Ottimo',
        stato_disponibilita: 'DISPONIBILE',
        visibile_pubblico: true, // PUBBLICO
        coordinate: coords[users['laura.bianchi@example.com']] || '(14.2500,40.8400)'
      },
      {
        utente_id: users['laura.bianchi@example.com'],
        categoria_id: cats['scienze-matematica'],
        sottogenere: 'Fisica Quantistica & Relatività',
        titolo: 'L\'ordine del tempo',
        autore: 'Carlo Rovelli',
        editore: 'Adelphi',
        anno_pubblicazione: 2017,
        isbn: '9788845931925',
        lingua: 'Italiano',
        descrizione: 'Saggio di divulgazione scientifica sulla fisica quantistica a loop e la natura fondamentale del tempo nell\'universo.',
        note: 'Copia perfetta, nessun segno di usura, dorso intatto.',
        stato_conservazione: 'Come nuovo',
        stato_disponibilita: 'DISPONIBILE',
        visibile_pubblico: true, // PUBBLICO
        coordinate: coords[users['laura.bianchi@example.com']] || '(14.2500,40.8400)'
      },
      {
        utente_id: users['laura.bianchi@example.com'],
        categoria_id: cats['informatica-tecnologia'],
        sottogenere: 'Ingegneria del Software',
        titolo: 'Design Patterns: Elements of Reusable Object-Oriented Software',
        autore: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
        editore: 'Addison-Wesley',
        anno_pubblicazione: 1994,
        isbn: '9780201633610',
        lingua: 'Inglese',
        descrizione: 'Il classico testo della Gang of Four sui pattern di progettazione orientati agli oggetti nel software moderno.',
        note: 'Manuale da consultazione professionale quotidiana per l\'ufficio; tenuto riservato.',
        stato_conservazione: 'Buono',
        stato_disponibilita: 'NON_DISPONIBILE',
        visibile_pubblico: false, // PRIVATO (Laura lo vede, Nunzio/altri NO)
        coordinate: coords[users['laura.bianchi@example.com']] || '(14.2500,40.8400)'
      },
      {
        utente_id: users['laura.bianchi@example.com'],
        categoria_id: cats['narrativa-romanzi'],
        sottogenere: 'Classici Letterari',
        titolo: 'Memorie del sottosuolo',
        autore: 'Fëdor Dostoevskij',
        editore: 'Garzanti',
        anno_pubblicazione: 1992,
        isbn: '9788811364580',
        lingua: 'Italiano',
        descrizione: 'Monologo filosofico ed esistenziale ambientato a San Pietroburgo, cardine della letteratura russa ottocentesca.',
        note: 'Copia con dedica manoscritta privata di famiglia; visibile solo a Laura.',
        stato_conservazione: 'Ottimo',
        stato_disponibilita: 'NON_DISPONIBILE',
        visibile_pubblico: false, // PRIVATO (Laura lo vede, Nunzio/altri NO)
        coordinate: coords[users['laura.bianchi@example.com']] || '(14.2500,40.8400)'
      },

      // ------------------------------------------------------------------------
      // UTENTE MARCO DE LUCA (marco.deluca@example.com) — Napoli Fuorigrotta (6.4 km)
      // Libreria PRIVATA (mostra_libreria = FALSE) — NESSUN SUO LIBRO APPARE AL PUBBLICO!
      // ------------------------------------------------------------------------
      {
        utente_id: users['marco.deluca@example.com'],
        categoria_id: cats['narrativa-romanzi'],
        sottogenere: 'Classici Letterari',
        titolo: 'Le città invisibili',
        autore: 'Italo Calvino',
        editore: 'Einaudi',
        anno_pubblicazione: 1972,
        isbn: '9788806218751',
        lingua: 'Italiano',
        descrizione: 'Dialogo immaginario tra Marco Polo e Kublai Khan sulle città utopiche, simboliche e mnestiche dell\'impero.',
        note: 'Edizione storica da collezione; copertina ingiallita e vissuta ma integra.',
        stato_conservazione: 'Usurato',
        stato_disponibilita: 'DISPONIBILE',
        visibile_pubblico: true, // Teoricamente pubblico, MA mascherato perché Marco ha mostra_libreria = false!
        coordinate: coords[users['marco.deluca@example.com']] || '(14.1950,40.8250)'
      },
      {
        utente_id: users['marco.deluca@example.com'],
        categoria_id: cats['arte-architettura'],
        sottogenere: 'Storia dell\'Arte',
        titolo: 'Storia della bellezza',
        autore: 'Umberto Eco',
        editore: 'Bompiani',
        anno_pubblicazione: 2004,
        isbn: '9788845232497',
        lingua: 'Italiano',
        descrizione: 'Viaggio estetico attraverso le varie epoche dell\'arte occidentale, dalla classicità greca all\'era multimediale.',
        note: 'Volume illustrato di grande formato con sovraccoperta originale lucida.',
        stato_conservazione: 'Ottimo',
        stato_disponibilita: 'DISPONIBILE',
        visibile_pubblico: true, // Teoricamente pubblico, MA mascherato perché Marco ha mostra_libreria = false!
        coordinate: coords[users['marco.deluca@example.com']] || '(14.1950,40.8250)'
      },
      {
        utente_id: users['marco.deluca@example.com'],
        categoria_id: cats['economia-diritto'],
        sottogenere: 'Diritto Civile & Commerciale',
        titolo: 'Istituzioni di Diritto Privato',
        autore: 'Pietro Trimarchi',
        editore: 'Giuffrè',
        anno_pubblicazione: 2020,
        isbn: '9788828822004',
        lingua: 'Italiano',
        descrizione: 'Manuale accademico universitario sul diritto privato e delle obbligazioni nell\'ordinamento giuridico italiano.',
        note: 'Testo ad uso di preparazione concorsuale, con glosse e schemi ad albero.',
        stato_conservazione: 'Buono',
        stato_disponibilita: 'NON_DISPONIBILE',
        visibile_pubblico: false, // PRIVATO
        coordinate: coords[users['marco.deluca@example.com']] || '(14.1950,40.8250)'
      },

      // ------------------------------------------------------------------------
      // UTENTE GIULIA ROMANO (giulia.romano@example.com) — Roma Trastevere (Fuori Raggio)
      // Libreria PUBBLICA (mostra_libreria = true), con 2 libri pubblici e 1 privato
      // ------------------------------------------------------------------------
      {
        utente_id: users['giulia.romano@example.com'],
        categoria_id: cats['saggistica-filosofia'],
        sottogenere: 'Filosofia della Scienza',
        titolo: 'Gödel, Escher, Bach: un\'Eterna Ghirlanda Brillante',
        autore: 'Douglas Hofstadter',
        editore: 'Adelphi',
        anno_pubblicazione: 1984,
        isbn: '9788845907555',
        lingua: 'Italiano',
        descrizione: 'Opera monumentale vincitrice del Premio Pulitzer sull\'intreccio tra logica matematica, musica canonica e arte visuale ricorsiva.',
        note: 'Traduzione italiana Adelphi, edizione rilegata in ottimo stato.',
        stato_conservazione: 'Ottimo',
        stato_disponibilita: 'DISPONIBILE',
        visibile_pubblico: true, // PUBBLICO
        coordinate: coords[users['giulia.romano@example.com']] || '(12.4700,41.8880)'
      },
      {
        utente_id: users['giulia.romano@example.com'],
        categoria_id: cats['scienze-matematica'],
        sottogenere: 'Astrofisica & Cosmologia',
        titolo: 'Dal big bang ai buchi neri: Breve storia del tempo',
        autore: 'Stephen Hawking',
        editore: 'Rizzoli',
        anno_pubblicazione: 1988,
        isbn: '9788817079754',
        lingua: 'Italiano',
        descrizione: 'Trattazione delle frontiere cosmologiche, della singolarità dello spazio-tempo e della radiazione termica dei buchi neri.',
        note: 'Edizione economica divulgativa con illustrazioni e diagrammi.',
        stato_conservazione: 'Buono',
        stato_disponibilita: 'DISPONIBILE',
        visibile_pubblico: true, // PUBBLICO
        coordinate: coords[users['giulia.romano@example.com']] || '(12.4700,41.8880)'
      },
      {
        utente_id: users['giulia.romano@example.com'],
        categoria_id: cats['economia-diritto'],
        sottogenere: 'Economia Politica & Finanza',
        titolo: 'Il Capitale nel XXI secolo',
        autore: 'Thomas Piketty',
        editore: 'Bompiani',
        anno_pubblicazione: 2014,
        isbn: '9788845277702',
        lingua: 'Italiano',
        descrizione: 'Studio empirico storico sulla concentrazione della ricchezza e la dinamica delle disuguaglianze economiche.',
        note: 'Copia privata personale per ricerca dottorale, occultata alla community.',
        stato_conservazione: 'Come nuovo',
        stato_disponibilita: 'NON_DISPONIBILE',
        visibile_pubblico: false, // PRIVATO
        coordinate: coords[users['giulia.romano@example.com']] || '(12.4700,41.8880)'
      }
    ];

    // 6. Pulizia e Inserimento
    console.log('[2/3] Pulizia ed inserimento catalogo esemplari...');
    await db.query('DELETE FROM esemplari;');

    for (const b of books) {
      await db.query(`
        INSERT INTO esemplari (
          utente_id, categoria_id, sottogenere, titolo, autore, editore, anno_pubblicazione, 
          isbn, lingua, descrizione, note, stato_conservazione, stato_disponibilita, 
          visibile_pubblico, coordinate_esemplare
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
      `, [
        b.utente_id, b.categoria_id, b.sottogenere, b.titolo, b.autore, b.editore, b.anno_pubblicazione,
        b.isbn, b.lingua, b.descrizione, b.note, b.stato_conservazione, b.stato_disponibilita, 
        b.visibile_pubblico, b.coordinate
      ]);
    }

    console.log(`  ✓ Inseriti con successo ${books.length} esemplari mock.\n`);

    // 7. Riepilogo Analitico e Visibilità
    console.log('[3/3] Verifica Stato di Visibilità nel Database:\n');
    const check = await db.query(`
      SELECT 
        e.titolo, 
        e.autore, 
        u.nome || ' ' || u.cognome as proprietario,
        u.email,
        CASE WHEN e.visibile_pubblico THEN '🌐 PUBBLICO' ELSE '🔒 PRIVATO' END as visibilita_libro,
        CASE WHEN priv.mostra_libreria THEN 'SI' ELSE 'NO (OCCULTATA)' END as libreria_pubblica,
        CASE 
          WHEN (priv.mostra_libreria IS NULL OR priv.mostra_libreria = TRUE) AND e.visibile_pubblico = TRUE 
          THEN '✅ VISIBILE' 
          ELSE '❌ NASCOSTO (Privacy)' 
        END as visibile_in_ricerca_pubblica
      FROM esemplari e
      JOIN utenti u ON e.utente_id = u.id
      LEFT JOIN preferenze_privacy_utenti priv ON u.id = priv.utente_id
      ORDER BY u.nome, e.visibile_pubblico DESC, e.titolo;
    `);

    console.table(check.rows);

    const publicCount = check.rows.filter(r => r.visibile_in_ricerca_pubblica === '✅ VISIBILE').length;
    const hiddenCount = check.rows.filter(r => r.visibile_in_ricerca_pubblica !== '✅ VISIBILE').length;

    console.log(`------------------------------------------------------------------------`);
    console.log(`Totale Volumi: ${books.length} | Visibili alla Community: ${publicCount} | Occultati per Privacy: ${hiddenCount}`);
    console.log(`------------------------------------------------------------------------\n`);

    process.exit(0);
  } catch (err) {
    console.error('Errore durante il popolamento mock:', err);
    process.exit(1);
  }
}

seedEsemplari();
