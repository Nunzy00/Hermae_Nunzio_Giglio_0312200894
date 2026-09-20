const db = require('./src/config/db');

async function seedEsemplari() {
  try {
    console.log('--- Popolamento Esemplari con Tassonomia Gerarchica a Due Livelli ---');

    const usersRes = await db.query('SELECT id, email FROM utenti');
    const users = {};
    usersRes.rows.forEach(u => { users[u.email] = u.id; });

    const catsRes = await db.query('SELECT id, slug FROM categorie');
    const cats = {};
    catsRes.rows.forEach(c => { cats[c.slug] = c.id; });

    const posRes = await db.query('SELECT utente_id, coordinate_reali[0] as lng, coordinate_reali[1] as lat FROM posizione_utenti');
    const coords = {};
    posRes.rows.forEach(p => { 
      coords[p.utente_id] = `(${p.lng},${p.lat})`; 
    });

    const books = [
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
        note: 'Copertina con lievi segni d\'uso, testo perfettamente leggibile ed integro.',
        stato_conservazione: 'Buono',
        stato_disponibilita: 'IN_PRESTITO',
        coordinate: coords[users['demo@hermae.it']] || '(14.2681,40.8518)'
      },
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
        note: 'Hardcover in inglese, pagine in ottime condizioni con alcune note a matita.',
        stato_conservazione: 'Buono',
        stato_disponibilita: 'DISPONIBILE',
        coordinate: coords[users['laura.bianchi@example.com']] || '(14.2500,40.8400)'
      },
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
        coordinate: coords[users['marco.deluca@example.com']] || '(14.1950,40.8250)'
      },
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
        note: 'Edizione economica, attualmente riservata per consultazione accademica.',
        stato_conservazione: 'Buono',
        stato_disponibilita: 'NON_DISPONIBILE',
        coordinate: coords[users['giulia.romano@example.com']] || '(12.4700,41.8880)'
      }
    ];

    // Pulizia e re-inserimento coerente
    await db.query('DELETE FROM esemplari;');

    for (const b of books) {
      await db.query(`
        INSERT INTO esemplari (
          utente_id, categoria_id, sottogenere, titolo, autore, editore, anno_pubblicazione, 
          isbn, lingua, descrizione, note, stato_conservazione, stato_disponibilita, coordinate_esemplare
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
      `, [
        b.utente_id, b.categoria_id, b.sottogenere, b.titolo, b.autore, b.editore, b.anno_pubblicazione,
        b.isbn, b.lingua, b.descrizione, b.note, b.stato_conservazione, b.stato_disponibilita, b.coordinate
      ]);
    }

    console.log(`Successfully seeded ${books.length} mock esemplari with 2-level taxonomy!`);
    const check = await db.query(`
      SELECT e.titolo, e.autore, c.nome as categoria, e.sottogenere, e.stato_conservazione, e.stato_disponibilita, u.email as proprietario
      FROM esemplari e
      JOIN categorie c ON e.categoria_id = c.id
      JOIN utenti u ON e.utente_id = u.id
      ORDER BY e.titolo;
    `);
    console.table(check.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding esemplari:', err);
    process.exit(1);
  }
}

seedEsemplari();
