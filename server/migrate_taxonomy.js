const db = require('./src/config/db');

async function migrateTaxonomy() {
  try {
    console.log('--- 1. Migrazione DDL su PostgreSQL hermae_db ---');

    // 1. Aggiunta colonne a tabella categorie
    await db.query(`
      ALTER TABLE categorie 
      ADD COLUMN IF NOT EXISTS icona VARCHAR(50) DEFAULT 'bi-book',
      ADD COLUMN IF NOT EXISTS colore_hex VARCHAR(20) DEFAULT '#1e40af',
      ADD COLUMN IF NOT EXISTS sottogeneri_predefiniti TEXT[] DEFAULT '{}';
    `);
    console.log('✅ Colonne aggiunte/verificate su tabella categorie');

    // 2. Aggiunta colonna sottogenere su esemplari
    await db.query(`
      ALTER TABLE esemplari 
      ADD COLUMN IF NOT EXISTS sottogenere VARCHAR(100);
    `);
    console.log('✅ Colonna sottogenere aggiunta/verificata su tabella esemplari');

    // 3. Creazione indice B-Tree su sottogenere
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_esemplari_sottogenere ON esemplari(sottogenere);
    `);
    console.log('✅ Indice idx_esemplari_sottogenere creato/verificato');

    // 4. Inserimento/Aggiornamento delle 10 Macro-Categorie (Livello 1) con Sottogeneri (Livello 2)
    console.log('\n--- 2. Popolamento delle 10 Macro-Categorie di Livello 1 ---');
    const categorieData = [
      {
        nome: 'Narrativa & Romanzi',
        slug: 'narrativa-romanzi',
        descrizione: 'Opere di narrativa italiana e internazionale, narrativa contemporanea, classica e di genere',
        icona: 'bi-book',
        colore_hex: '#be123c',
        sottogeneri: ['Classici Letterari', 'Narrativa Contemporanea', 'Giallo & Thriller', 'Fantascienza & Distopia', 'Fantasy & Avventura', 'Romanzo Storico', 'Poesia & Teatro']
      },
      {
        nome: 'Saggistica & Filosofia',
        slug: 'saggistica-filosofia',
        descrizione: 'Testi saggistici, trattati filosofici, scienze umane, psicologia e società',
        icona: 'bi-lightbulb',
        colore_hex: '#6d28d9',
        sottogeneri: ['Filosofia Morale & Politica', 'Filosofia della Scienza', 'Psicologia & Psicoanalisi', 'Scienze Sociali & Antropologia', 'Linguistica & Semiotica', 'Critica Letteraria']
      },
      {
        nome: 'Informatica & Tecnologia',
        slug: 'informatica-tecnologia',
        descrizione: 'Ingegneria del software, linguaggi, intelligenza artificiale, architetture e reti',
        icona: 'bi-laptop',
        colore_hex: '#1d4ed8',
        sottogeneri: ['Algoritmi & Strutture Dati', 'Intelligenza Artificiale & Machine Learning', 'Reti & Cybersecurity', 'Ingegneria del Software', 'Sviluppo Web & Cloud', 'Sistemi Operativi & Database', 'Hardware & Elettronica']
      },
      {
        nome: 'Scienze & Matematica',
        slug: 'scienze-matematica',
        descrizione: 'Fisica teorica, chimica, biologia, genetica, matematica pura e applicata',
        icona: 'bi-calculator',
        colore_hex: '#047857',
        sottogeneri: ['Fisica Quantistica & Relatività', 'Astrofisica & Cosmologia', 'Matematica & Geometria', 'Biologia & Genetica', 'Chimica & Materiali', 'Neuroscienze']
      },
      {
        nome: 'Storia & Biografie',
        slug: 'storia-biografie',
        descrizione: 'Storiografia universale, cronache, memorie, biografie e archeologia',
        icona: 'bi-hourglass-split',
        colore_hex: '#b45309',
        sottogeneri: ['Storia Antica & Archeologia', 'Storia Medievale', 'Storia Moderna & Risorgimento', 'Storia Contemporanea & Guerre Mondiali', 'Biografie & Diari', 'Geopolitica']
      },
      {
        nome: 'Arte, Architettura & Design',
        slug: 'arte-architettura',
        descrizione: 'Cataloghi d\'arte, critica visiva, design grafico, urbanistica e architettura',
        icona: 'bi-palette',
        colore_hex: '#c2410c',
        sottogeneri: ['Storia dell\'Arte', 'Architettura Contemporanea', 'Design & Grafica', 'Fotografia & Cinema', 'Urbanistica & Territorio']
      },
      {
        nome: 'Economia, Diritto & Società',
        slug: 'economia-diritto',
        descrizione: 'Teoria economica, finanza, diritto pubblico e privato, sociologia del lavoro',
        icona: 'bi-briefcase',
        colore_hex: '#0f766e',
        sottogeneri: ['Micro & Macro Economia', 'Finanza & Mercati', 'Diritto Costituzionale & Civile', 'Diritto Digitale & Privacy', 'Management & Startup']
      },
      {
        nome: 'Fumetti, Manga & Graphic Novel',
        slug: 'fumetti-manga',
        descrizione: 'Graphic novel d\'autore, manga giapponesi, comic americani e fumetto europeo',
        icona: 'bi-chat-square-dots',
        colore_hex: '#db2777',
        sottogeneri: ['Graphic Novel', 'Manga Seinen & Shonen', 'Comics Supereroi', 'Fumetto Franco-Belga', 'Fumetto Italiano d\'Autore']
      },
      {
        nome: 'Bambini & Ragazzi',
        slug: 'bambini-ragazzi',
        descrizione: 'Letteratura per l\'infanzia, young adult, fiabe e divulgazione per giovani',
        icona: 'bi-balloon',
        colore_hex: '#0284c7',
        sottogeneri: ['Primi Lettori (0-6)', 'Narrativa Junior (7-12)', 'Young Adult', 'Fiabe & Miti', 'Scienza per Ragazzi']
      },
      {
        nome: 'Altro & Miscellanea',
        slug: 'altro-miscellanea',
        descrizione: 'Guide, linguistica applicata, viaggi, cucina, benessere e opere multitematiche',
        icona: 'bi-collection',
        colore_hex: '#475569',
        sottogeneri: ['Viaggi & Luoghi', 'Cucina & Enogastronomia', 'Crescita Personale', 'Dizionari & Manualistica Generale']
      }
    ];

    for (const cat of categorieData) {
      await db.query(`
        INSERT INTO categorie (nome, slug, descrizione, icona, colore_hex, sottogeneri_predefiniti)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slug) DO UPDATE SET
          nome = EXCLUDED.nome,
          descrizione = EXCLUDED.descrizione,
          icona = EXCLUDED.icona,
          colore_hex = EXCLUDED.colore_hex,
          sottogeneri_predefiniti = EXCLUDED.sottogeneri_predefiniti;
      `, [cat.nome, cat.slug, cat.descrizione, cat.icona, cat.colore_hex, cat.sottogeneri]);
    }
    console.log('✅ 10 Macro-Categorie caricate/aggiornate con successo');

    // 5. Assegnazione sottogeneri ai libri esistenti
    console.log('\n--- 3. Aggiornamento Sottogeneri (Livello 2) sui libri esistenti ---');
    const updates = [
      { titolo: 'Il nome della rosa', sottogenere: 'Giallo & Thriller' },
      { titolo: 'Clean Code: A Handbook of Agile Software Craftsmanship', sottogenere: 'Ingegneria del Software' },
      { titolo: 'Pensieri lenti e veloci', sottogenere: 'Psicologia & Psicoanalisi' },
      { titolo: 'Sette brevi lezioni di fisica', sottogenere: 'Fisica Quantistica & Relatività' },
      { titolo: '1984', sottogenere: 'Fantascienza & Distopia' },
      { titolo: 'Design Patterns: Elements of Reusable Object-Oriented Software', sottogenere: 'Ingegneria del Software' },
      { titolo: 'Barbaro: La fine dell\'impero romano', sottogenere: 'Storia Antica & Archeologia' },
      { titolo: 'L\'opera d\'arte nell\'epoca della sua riproducibilità tecnica', sottogenere: 'Storia dell\'Arte' },
      { titolo: 'Introduzione agli algoritmi e strutture dati', sottogenere: 'Algoritmi & Strutture Dati' },
      { titolo: 'Cosmo: Una storia della terra e dell\'universo', sottogenere: 'Astrofisica & Cosmologia' },
      { titolo: 'Il pendolo di Foucault', sottogenere: 'Giallo & Thriller' }
    ];

    for (const u of updates) {
      await db.query(`
        UPDATE esemplari 
        SET sottogenere = $1 
        WHERE titolo ILIKE $2;
      `, [u.sottogenere, `%${u.titolo}%`]);
    }
    console.log('✅ Sottogeneri assegnati ai volumi esistenti');

    console.log('\n🎉 MIGRAZIONE TASSONOMIA A DUE LIVELLI COMPLETATA CON SUCCESSO!');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERRORE MIGRAZIONE TASSONOMIA:', err);
    process.exit(1);
  }
}

migrateTaxonomy();
