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
    coordinate_offuscate POINT NOT NULL,
    raggio_ricerca_km INTEGER NOT NULL DEFAULT 5,
    data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Creazione Tabella CATEGORIE
-- Tassonomia per la categorizzazione disciplinare e letteraria degli esemplari
CREATE TABLE IF NOT EXISTS categorie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    descrizione TEXT
);

-- 4. Creazione Tabella ESEMPLARI (Copia fisica del volume posseduta dal privato)
-- Formalizzata secondo standard IFLA LRM / FRBR (esemplare fisico materiale)
CREATE TABLE IF NOT EXISTS esemplari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utente_id UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    categoria_id UUID NOT NULL REFERENCES categorie(id) ON DELETE RESTRICT,
    titolo VARCHAR(255) NOT NULL,
    autore VARCHAR(255) NOT NULL,
    anno_pubblicazione SMALLINT,
    isbn VARCHAR(20),
    descrizione TEXT,
    stato_conservazione VARCHAR(50) DEFAULT 'Buono',
    stato_disponibilita VARCHAR(30) NOT NULL DEFAULT 'DISPONIBILE',
    immagine_copertina VARCHAR(255),
    immagine_miniatura VARCHAR(255),
    coordinate_esemplare POINT NOT NULL,
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

-- 7. Creazione Tabella METRICHE_VISITE
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
CREATE INDEX IF NOT EXISTS idx_esemplari_titolo ON esemplari (titolo);
CREATE INDEX IF NOT EXISTS idx_esemplari_autore ON esemplari (autore);
CREATE INDEX IF NOT EXISTS idx_esemplari_isbn ON esemplari (isbn);
CREATE INDEX IF NOT EXISTS idx_esemplari_disponibilita ON esemplari (stato_disponibilita);
CREATE INDEX IF NOT EXISTS idx_esemplari_utente ON esemplari (utente_id);
CREATE INDEX IF NOT EXISTS idx_esemplari_categoria ON esemplari (categoria_id);
CREATE INDEX IF NOT EXISTS idx_richieste_esemplare ON richieste_prestito (esemplare_id);
CREATE INDEX IF NOT EXISTS idx_richieste_richiedente ON richieste_prestito (richiedente_id);
CREATE INDEX IF NOT EXISTS idx_richieste_proprietario ON richieste_prestito (proprietario_id);
CREATE INDEX IF NOT EXISTS idx_chat_richiesta ON messaggi_chat (richiesta_id);

-- 10. Popolamento Dati Iniziali (Seed Tassonomia Categorie)
INSERT INTO categorie (nome, slug, descrizione) VALUES
    ('Narrativa & Romanzi', 'narrativa-romanzi', 'Opere di narrativa italiana e internazionale, narrativa contemporanea e classica'),
    ('Saggistica & Filosofia', 'saggistica-filosofia', 'Testi saggistici, trattati filosofici, scienze umane e sociali'),
    ('Informatica & Tecnologia', 'informatica-tecnologia', 'Manuali di programmazione, architetture software, intelligenza artificiale e reti'),
    ('Scienze & Matematica', 'scienze-matematica', 'Fisica, chimica, biologia, matematica pura e applicata'),
    ('Storia & Biografie', 'storia-biografie', 'Saggi storici, cronache, memorie e biografie di personaggi rilevanti'),
    ('Arte & Architettura', 'arte-architettura', 'Cataloghi d''arte, critica visiva, design, urbanistica e architettura')
ON CONFLICT (slug) DO NOTHING;
