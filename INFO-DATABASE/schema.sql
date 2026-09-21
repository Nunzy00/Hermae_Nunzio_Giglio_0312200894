-- ====================================================================
-- HERMAE - Base di Dati Relazionale Geospaziale
-- Corso di Laurea: Laurea Triennale in Informatica per le Aziende Digitali (L-31)
-- Tema n. 4: Sharing Technologies | Traccia PW n. 14
-- Candidato: Nunzio Giglio (Matr. 0312200894)
-- File: INFO-DATABASE/schema.sql
-- Descrizione: Script DDL per la creazione di estensioni, tabelle, vincoli e indici (Fase 10)
-- ====================================================================

-- 1. Attivazione delle estensioni crittografiche, di indicizzazione e geospaziali
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "cube";
CREATE EXTENSION IF NOT EXISTS "earthdistance";

-- 2. Creazione Tabella UTENTI
-- Memorizza i dati anagrafici, credenziali bcrypt, consensi privacy/geo e coordinate WGS 84
CREATE TABLE IF NOT EXISTS utenti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,
    citta VARCHAR(100) NOT NULL,
    coordinate_reali POINT NOT NULL,
    coordinate_offuscate POINT NOT NULL,
    consenso_privacy BOOLEAN NOT NULL DEFAULT FALSE,
    consenso_geo BOOLEAN NOT NULL DEFAULT FALSE,
    data_registrazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Creazione Tabella POSIZIONE_UTENTI (Fase 14)
-- Entità dedicata alla memorizzazione delle coordinate geografiche e preferenze territoriali dell'utente
CREATE TABLE IF NOT EXISTS posizione_utenti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id UUID NOT NULL UNIQUE REFERENCES utenti(id) ON DELETE CASCADE,
    citta VARCHAR(100) NOT NULL,
    indirizzo_approssimato VARCHAR(255),
    latitudine NUMERIC(10, 7) NOT NULL,
    longitudine NUMERIC(10, 7) NOT NULL,
    coordinate_reali POINT NOT NULL,
    coordinate_offuscate POINT,
    raggio_ricerca_km INTEGER NOT NULL DEFAULT 5,
    data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Creazione Tabella PREFERENZE_PRIVACY_UTENTI (Fase 16)
-- Struttura dati per la memorizzazione di flag di riservatezza, visibilità spaziale e permessi profilo (Privacy by Default)
CREATE TABLE IF NOT EXISTS preferenze_privacy_utenti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id UUID NOT NULL UNIQUE REFERENCES utenti(id) ON DELETE CASCADE,
    profilo_pubblico BOOLEAN NOT NULL DEFAULT FALSE,
    mostra_posizione BOOLEAN NOT NULL DEFAULT TRUE,
    mostra_libreria BOOLEAN NOT NULL DEFAULT TRUE,
    mostra_email BOOLEAN NOT NULL DEFAULT FALSE,
    raggio_visibilita_km INTEGER NOT NULL DEFAULT 10,
    consenti_messaggi_diretti BOOLEAN NOT NULL DEFAULT TRUE,
    modalita_occultamento VARCHAR(20) NOT NULL DEFAULT 'QUARTIERE' CHECK (modalita_occultamento IN ('QUARTIERE', 'AREA_CAP', 'TOTALE')),
    data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Creazione Tabella CATEGORIE (Livello 1 Tassonomia Controllata)
-- Tassonomia gerarchica per la categorizzazione disciplinare e letteraria degli esemplari
CREATE TABLE IF NOT EXISTS categorie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    descrizione TEXT,
    icona VARCHAR(50) DEFAULT 'bi-book',
    colore_hex VARCHAR(20) DEFAULT '#1e40af',
    sottogeneri_predefiniti TEXT[] DEFAULT '{}'
);

-- 4. Creazione Tabella ESEMPLARI (Copia fisica del volume posseduta dal privato)
-- Formalizzata secondo standard IFLA LRM / FRBR con Tassonomia Ibrida a Due Livelli
CREATE TABLE IF NOT EXISTS esemplari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    categoria_id UUID NOT NULL REFERENCES categorie(id) ON DELETE RESTRICT,
    sottogenere VARCHAR(100),
    titolo VARCHAR(255) NOT NULL,
    autore VARCHAR(255) NOT NULL,
    editore VARCHAR(150),
    anno_pubblicazione SMALLINT,
    isbn VARCHAR(20),
    lingua VARCHAR(50) DEFAULT 'Italiano',
    descrizione TEXT,
    note TEXT,
    stato_conservazione VARCHAR(50) DEFAULT 'Buono',
    stato_disponibilita VARCHAR(30) NOT NULL DEFAULT 'DISPONIBILE',
    immagine_copertina VARCHAR(255),
    immagine_miniatura VARCHAR(255),
    coordinate_esemplare POINT,
    visibile_pubblico BOOLEAN NOT NULL DEFAULT TRUE,
    data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Creazione Tabella RICHIESTE_PRESTITO
-- Gestione transazionale peer-to-peer con macchina a stati finiti
CREATE TABLE IF NOT EXISTS richieste_prestito (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esemplare_id UUID NOT NULL REFERENCES esemplari(id) ON DELETE CASCADE,
    richiedente_id UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    proprietario_id UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    stato VARCHAR(30) NOT NULL DEFAULT 'IN_ATTESA',
    messaggio_iniziale TEXT,
    data_richiesta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Creazione Tabella MESSAGGI_CHAT
-- Messaggistica testuale asincrona tra richiedente e proprietario
CREATE TABLE IF NOT EXISTS messaggi_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    richiesta_id UUID NOT NULL REFERENCES richieste_prestito(id) ON DELETE CASCADE,
    mittente_id UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    testo TEXT NOT NULL,
    letto BOOLEAN DEFAULT FALSE,
    data_invio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Creazione Tabella NOTIFICHE (Fase 22)
-- Notifiche interne asincrone per richieste di contatto, messaggistica e aggiornamenti di stato
CREATE TABLE IF NOT EXISTS notifiche (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    richiesta_id UUID REFERENCES richieste_prestito(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titolo VARCHAR(150) NOT NULL,
    messaggio TEXT NOT NULL,
    letta BOOLEAN NOT NULL DEFAULT FALSE,
    data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Creazione Tabella METRICHE_VISITE
-- Tracciamento analitico anonimizzato delle interazioni per la dashboard
CREATE TABLE IF NOT EXISTS metriche_visite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esemplare_id UUID REFERENCES esemplari(id) ON DELETE SET NULL,
    tipo_evento VARCHAR(50) NOT NULL,
    citta VARCHAR(100),
    data_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Indici Spaziali GiST (Generalized Search Tree)
-- Ottimizzano le query geospaziali di prossimità metrica a raggio urbano/quartiere
CREATE INDEX IF NOT EXISTS idx_esemplari_coordinate ON esemplari USING GIST (coordinate_esemplare);
CREATE INDEX IF NOT EXISTS idx_utenti_coordinate_offuscate ON utenti USING GIST (coordinate_offuscate);
CREATE INDEX IF NOT EXISTS idx_posizione_utenti_coords ON posizione_utenti USING GIST (coordinate_offuscate);

-- 9. Indici B-Tree su Chiavi Esterne (UUID) e Parametri di Ricerca
CREATE INDEX IF NOT EXISTS idx_posizione_utenti_utente ON posizione_utenti (utente_id);
CREATE INDEX IF NOT EXISTS idx_posizione_utenti_citta ON posizione_utenti (citta);
CREATE INDEX IF NOT EXISTS idx_preferenze_privacy_utente ON preferenze_privacy_utenti (utente_id);
CREATE INDEX IF NOT EXISTS idx_esemplari_titolo ON esemplari (titolo);
CREATE INDEX IF NOT EXISTS idx_esemplari_autore ON esemplari (autore);
CREATE INDEX IF NOT EXISTS idx_esemplari_isbn ON esemplari (isbn);
CREATE INDEX IF NOT EXISTS idx_esemplari_disponibilita ON esemplari (stato_disponibilita);
CREATE INDEX IF NOT EXISTS idx_esemplari_utente ON esemplari (utente_id);
CREATE INDEX IF NOT EXISTS idx_esemplari_categoria ON esemplari (categoria_id);
CREATE INDEX IF NOT EXISTS idx_esemplari_sottogenere ON esemplari (sottogenere);
CREATE INDEX IF NOT EXISTS idx_esemplari_visibile_pubblico ON esemplari (visibile_pubblico);
CREATE INDEX IF NOT EXISTS idx_richieste_esemplare ON richieste_prestito (esemplare_id);
CREATE INDEX IF NOT EXISTS idx_richieste_richiedente ON richieste_prestito (richiedente_id);
CREATE INDEX IF NOT EXISTS idx_richieste_proprietario ON richieste_prestito (proprietario_id);
CREATE INDEX IF NOT EXISTS idx_chat_richiesta ON messaggi_chat (richiesta_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_utente ON notifiche (utente_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_letta ON notifiche (utente_id, letta);

-- 10. Popolamento Dati Iniziali (Seed Tassonomia Gerarchica a Due Livelli)
INSERT INTO categorie (nome, slug, descrizione, icona, colore_hex, sottogeneri_predefiniti) VALUES
    ('Narrativa & Romanzi', 'narrativa-romanzi', 'Opere di narrativa italiana e internazionale, narrativa contemporanea, classica e di genere', 'bi-book', '#be123c', ARRAY['Classici Letterari', 'Narrativa Contemporanea', 'Giallo & Thriller', 'Fantascienza & Distopia', 'Fantasy & Avventura', 'Romanzo Storico', 'Poesia & Teatro']),
    ('Saggistica & Filosofia', 'saggistica-filosofia', 'Testi saggistici, trattati filosofici, scienze umane, psicologia e società', 'bi-lightbulb', '#6d28d9', ARRAY['Filosofia Morale & Politica', 'Filosofia della Scienza', 'Psicologia & Psicoanalisi', 'Scienze Sociali & Antropologia', 'Linguistica & Semiotica', 'Critica Letteraria']),
    ('Informatica & Tecnologia', 'informatica-tecnologia', 'Ingegneria del software, linguaggi, intelligenza artificiale, architetture e reti', 'bi-laptop', '#1d4ed8', ARRAY['Algoritmi & Strutture Dati', 'Intelligenza Artificiale & Machine Learning', 'Reti & Cybersecurity', 'Ingegneria del Software', 'Sviluppo Web & Cloud', 'Sistemi Operativi & Database', 'Hardware & Elettronica']),
    ('Scienze & Matematica', 'scienze-matematica', 'Fisica teorica, chimica, biologia, genetica, matematica pura e applicata', 'bi-calculator', '#047857', ARRAY['Fisica Quantistica & Relatività', 'Astrofisica & Cosmologia', 'Matematica & Geometria', 'Biologia & Genetica', 'Chimica & Materiali', 'Neuroscienze']),
    ('Storia & Biografie', 'storia-biografie', 'Storiografia universale, cronache, memorie, biografie e archeologia', 'bi-hourglass-split', '#b45309', ARRAY['Storia Antica & Archeologia', 'Storia Medievale', 'Storia Moderna & Risorgimento', 'Storia Contemporanea & Guerre Mondiali', 'Biografie & Diari', 'Geopolitica']),
    ('Arte, Architettura & Design', 'arte-architettura', 'Cataloghi d''arte, critica visiva, design grafico, urbanistica e architettura', 'bi-palette', '#c2410c', ARRAY['Storia dell''Arte', 'Architettura Contemporanea', 'Design & Grafica', 'Fotografia & Cinema', 'Urbanistica & Territorio']),
    ('Economia, Diritto & Società', 'economia-diritto', 'Teoria economica, finanza, diritto pubblico e privato, sociologia del lavoro', 'bi-briefcase', '#0f766e', ARRAY['Micro & Macro Economia', 'Finanza & Mercati', 'Diritto Costituzionale & Civile', 'Diritto Digitale & Privacy', 'Management & Startup']),
    ('Fumetti, Manga & Graphic Novel', 'fumetti-manga', 'Graphic novel d''autore, manga giapponesi, comic americani e fumetto europeo', 'bi-chat-square-dots', '#db2777', ARRAY['Graphic Novel', 'Manga Seinen & Shonen', 'Comics Supereroi', 'Fumetto Franco-Belga', 'Fumetto Italiano d''Autore']),
    ('Bambini & Ragazzi', 'bambini-ragazzi', 'Letteratura per l''infanzia, young adult, fiabe e divulgazione per giovani', 'bi-balloon', '#0284c7', ARRAY['Primi Lettori (0-6)', 'Narrativa Junior (7-12)', 'Young Adult', 'Fiabe & Miti', 'Scienza per Ragazzi']),
    ('Altro & Miscellanea', 'altro-miscellanea', 'Guide, linguistica applicata, viaggi, cucina, benessere e opere multitematiche', 'bi-collection', '#475569', ARRAY['Viaggi & Luoghi', 'Cucina & Enogastronomia', 'Crescita Personale', 'Dizionari & Manualistica Generale'])
ON CONFLICT (slug) DO UPDATE SET
    nome = EXCLUDED.nome,
    descrizione = EXCLUDED.descrizione,
    icona = EXCLUDED.icona,
    colore_hex = EXCLUDED.colore_hex,
    sottogeneri_predefiniti = EXCLUDED.sottogeneri_predefiniti;
