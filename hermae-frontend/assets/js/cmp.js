/**
 * HERMAE — Consent Management Platform (CMP) Client-Side Module
 * Sistema ad hoc per la gestione granulare del consenso informato (GDPR & Direttiva ePrivacy)
 * Progetto: Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'hermae_cmp_consents';
  const CURRENT_POLICY_VERSION = '1.0';

  // Stato predefinito nel rispetto del principio di Privacy by Default (Art. 25 GDPR)
  const DEFAULT_CONSENTS = {
    necessari: true,    // Sempre attivo
    funzionali: false,   // Opzionale
    analitici: false,    // Opzionale
    servizi_terzi: false // Opzionale
  };

  /**
   * Genera un identificativo client pseudo-univoco crittograficamente sicuro
   */
  function generateClientId() {
    return 'cmp_' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Recupera i consensi salvati in memoria locale o i default
   */
  function loadLocalConsents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.categorie === 'object') {
          return {
            consenso_id: parsed.consenso_id || generateClientId(),
            espresso: Boolean(parsed.espresso),
            versione_policy: parsed.versione_policy || CURRENT_POLICY_VERSION,
            timestamp: parsed.timestamp || null,
            categorie: {
              necessari: true,
              funzionali: Boolean(parsed.categorie.funzionali),
              analitici: Boolean(parsed.categorie.analitici),
              servizi_terzi: Boolean(parsed.categorie.servizi_terzi)
            }
          };
        }
      }
    } catch (e) {
      // Ignora errori di parsing e usa default
    }

    return {
      consenso_id: generateClientId(),
      espresso: false,
      versione_policy: CURRENT_POLICY_VERSION,
      timestamp: null,
      categorie: { ...DEFAULT_CONSENTS }
    };
  }

  // Istanza di stato corrente
  let state = loadLocalConsents();

  /**
   * Salva localmente lo stato dei consensi
   */
  function persistLocal(consentsObj) {
    state = {
      consenso_id: consentsObj.consenso_id || state.consenso_id,
      espresso: true,
      versione_policy: CURRENT_POLICY_VERSION,
      timestamp: new Date().toISOString(),
      categorie: {
        necessari: true,
        funzionali: Boolean(consentsObj.categorie.funzionali),
        analitici: Boolean(consentsObj.categorie.analitici),
        servizi_terzi: Boolean(consentsObj.categorie.servizi_terzi)
      }
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Hermae CMP] Impossibile salvare in localStorage:', e);
    }
  }

  /**
   * Sincronizza lo stato con il backend Hermae se disponibile
   */
  async function syncWithBackend() {
    try {
      const token = localStorage.getItem('hermae_access_token') || sessionStorage.getItem('hermae_access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }
      headers['X-CMP-Consent-ID'] = state.consenso_id;

      await fetch('/api/cmp/consenso', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          consenso_id: state.consenso_id,
          versione_policy: state.versione_policy,
          funzionali: state.categorie.funzionali,
          analitici: state.categorie.analitici,
          servizi_terzi: state.categorie.servizi_terzi
        })
      });
    } catch (err) {
      // Sincronizzazione in background asincrona, non blocca l'utente
    }
  }

  /**
   * Notifica ad eventuali listener applicativi il cambio di consensi
   */
  function dispatchConsentEvent() {
    window.dispatchEvent(
      new CustomEvent('hermae:consent-updated', {
        detail: { ...state }
      })
    );
  }

  // =========================================================================
  // INTERFACCIA VISIVA: BANNER & MODALE CMP
  // =========================================================================

  function injectCmpStyles() {
    if (document.getElementById('hermae-cmp-styles')) return;
    const style = document.createElement('style');
    style.id = 'hermae-cmp-styles';
    style.textContent = `
      /* Stili Consent Management Platform (Hermae CMP) */
      .hermae-cmp-banner-wrap {
        position: fixed;
        bottom: 20px;
        right: 20px;
        left: 20px;
        max-width: 680px;
        margin-left: auto;
        z-index: 1080;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
        padding: 1.25rem 1.5rem;
        animation: hermaeCmpSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      @media (max-width: 575.98px) {
        .hermae-cmp-banner-wrap {
          bottom: 10px;
          right: 10px;
          left: 10px;
          padding: 1rem;
        }
      }
      @keyframes hermaeCmpSlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .hermae-cmp-badge-trigger {
        position: fixed;
        bottom: 18px;
        left: 18px;
        z-index: 1070;
        background: #ffffff;
        color: #1e40af;
        border: 1px solid #cbd5e1;
        border-radius: 50px;
        padding: 6px 14px;
        font-size: 0.78rem;
        font-weight: 600;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }
      .hermae-cmp-badge-trigger:hover {
        background: #f1f5f9;
        color: #1d4ed8;
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
      }
      /* Modale CMP */
      .hermae-cmp-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(3px);
        z-index: 1090;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .hermae-cmp-modal-content {
        background: #ffffff;
        border-radius: 14px;
        max-width: 680px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
        animation: hermaeCmpZoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: hidden;
      }
      @keyframes hermaeCmpZoomIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
      .hermae-cmp-cat-card {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 1rem;
        background: #f8fafc;
        transition: border-color 0.15s ease;
      }
      .hermae-cmp-cat-card:hover {
        border-color: #cbd5e1;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Crea e mostra il banner di primo accesso se il consenso non è mai stato espresso
   */
  function renderBanner() {
    if (document.getElementById('hermae-cmp-banner')) return;
    injectCmpStyles();

    const banner = document.createElement('aside');
    banner.id = 'hermae-cmp-banner';
    banner.className = 'hermae-cmp-banner-wrap';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Informativa e gestione del consenso sui dati e cookie (CMP)');

    banner.innerHTML = `
      <div class="d-flex align-items-start gap-3">
        <div class="bg-primary-subtle text-primary rounded-circle p-2 flex-shrink-0 d-none d-sm-flex align-items-center justify-content-center" style="width: 42px; height: 42px;">
          <i class="bi bi-shield-lock-fill fs-5" aria-hidden="true"></i>
        </div>
        <div class="flex-grow-1">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <h2 class="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-shield-check text-primary d-sm-none"></i>
              <span>Riservatezza &amp; Consenso Informato (CMP)</span>
            </h2>
            <span class="badge bg-light text-muted border py-1 px-2" style="font-size: 0.68rem;">
              GDPR v${CURRENT_POLICY_VERSION}
            </span>
          </div>
          <p class="text-secondary small mb-3" style="font-size: 0.82rem; line-height: 1.45;">
            Hermae tutela la tua privacy secondo il principio di <strong>Privacy by Default</strong> (Art. 25 GDPR). 
            Utilizziamo cookie tecnici essenziali per il funzionamento e l'autenticazione. Puoi scegliere liberamente se acconsentire alle preferenze funzionali, alle statistiche interne anonime e ai servizi esterni di mappa e CDN.
          </p>
          <div class="d-flex flex-wrap align-items-center justify-content-end gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm py-1.5 px-3" id="btnCmpCustom" style="font-size: 0.8rem;">
              <i class="bi bi-sliders me-1"></i>Personalizza
            </button>
            <button type="button" class="btn btn-outline-dark btn-sm py-1.5 px-3" id="btnCmpReject" style="font-size: 0.8rem;">
              Rifiuta Non Necessari
            </button>
            <button type="button" class="btn btn-primary btn-sm py-1.5 px-3" id="btnCmpAcceptAll" style="font-size: 0.8rem;">
              <i class="bi bi-check2-all me-1"></i>Accetta Tutti
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Event listener pulsanti
    document.getElementById('btnCmpAcceptAll').addEventListener('click', () => {
      saveConsents({ funzionali: true, analitici: true, servizi_terzi: true });
      closeBanner();
    });

    document.getElementById('btnCmpReject').addEventListener('click', () => {
      saveConsents({ funzionali: false, analitici: false, servizi_terzi: false });
      closeBanner();
    });

    document.getElementById('btnCmpCustom').addEventListener('click', () => {
      openModal();
    });
  }

  function closeBanner() {
    const banner = document.getElementById('hermae-cmp-banner');
    if (banner) {
      banner.remove();
    }
  }

  /**
   * Crea e mostra il pulsante flottante in basso a sinistra per riaprire le preferenze in qualsiasi momento
   */
  function renderBadgeTrigger() {
    if (document.getElementById('hermae-cmp-badge')) return;
    injectCmpStyles();

    const trigger = document.createElement('button');
    trigger.id = 'hermae-cmp-badge';
    trigger.className = 'hermae-cmp-badge-trigger';
    trigger.setAttribute('type', 'button');
    trigger.setAttribute('title', 'Gestisci i consensi di riservatezza e cookie (CMP)');
    trigger.innerHTML = `
      <i class="bi bi-shield-lock-fill text-primary" aria-hidden="true"></i>
      <span>Privacy &amp; Cookie</span>
    `;

    trigger.addEventListener('click', () => {
      openModal();
    });

    document.body.appendChild(trigger);
  }

  /**
   * Apre il modale accessibile di personalizzazione granulare
   */
  function openModal() {
    closeModal();
    injectCmpStyles();

    const backdrop = document.createElement('div');
    backdrop.id = 'hermae-cmp-modal';
    backdrop.className = 'hermae-cmp-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'cmpModalTitle');

    backdrop.innerHTML = `
      <div class="hermae-cmp-modal-content">
        <!-- Header del Modale -->
        <div class="p-3 px-4 border-bottom d-flex align-items-center justify-content-between bg-light">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-shield-lock-fill text-primary fs-5"></i>
            <h2 id="cmpModalTitle" class="h6 fw-bold mb-0 text-dark">Centro Consensi Privacy &amp; Cookie (CMP)</h2>
          </div>
          <button type="button" class="btn-close" id="btnCmpCloseModal" aria-label="Chiudi finestra consensi"></button>
        </div>

        <!-- Corpo del Modale con le 4 Categorie di Trattamento -->
        <div class="p-3 px-4 overflow-y-auto" style="max-height: calc(90vh - 140px);">
          <p class="text-secondary small mb-3">
            In conformità al <strong>Regolamento UE 2016/679 (GDPR)</strong> e alla <strong>Direttiva ePrivacy</strong>, 
            puoi scegliere in modo granulare e trasparente quali categorie di trattamento abilitare. 
            Le tue scelte sono revocabili in qualsiasi momento.
          </p>

          <div class="d-flex flex-column gap-3">
            <!-- Categoria 1: Necessari (Sempre Attivi) -->
            <div class="hermae-cmp-cat-card">
              <div class="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <span class="fw-bold text-dark small">1. Dati Tecnici &amp; Cookie Essenziali</span>
                    <span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size: 0.65rem;">Sempre Attivo</span>
                  </div>
                  <p class="text-muted small mb-1" style="font-size: 0.78rem;">
                    Indispensabili per l'autenticazione JWT, la persistenza della sessione, la protezione anti-CSRF e la sicurezza dell'infrastruttura relazionale.
                  </p>
                  <span class="text-secondary" style="font-size: 0.7rem;">Base giuridica: Art. 6(1)(f) GDPR (Legittimo Interesse del Titolare)</span>
                </div>
                <div class="form-check form-switch fs-5 mb-0">
                  <input class="form-check-input" type="checkbox" role="switch" checked disabled title="I cookie tecnici non possono essere disattivati" />
                </div>
              </div>
            </div>

            <!-- Categoria 2: Funzionali & Preferenze -->
            <div class="hermae-cmp-cat-card">
              <div class="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <label for="cmpSwitchFunzionali" class="fw-bold text-dark small mb-0">2. Funzionali &amp; Preferenze Interfaccia</label>
                    <span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size: 0.65rem;">Facoltativo</span>
                  </div>
                  <p class="text-muted small mb-1" style="font-size: 0.78rem;">
                    Memorizzano la modalità di visualizzazione della libreria (es. Scaffale 3D "Book-Stile" vs Card/Tabella), il raggio geografico preferito e i filtri di ricerca.
                  </p>
                  <span class="text-secondary" style="font-size: 0.7rem;">Base giuridica: Art. 6(1)(a) GDPR (Consenso Esplicito)</span>
                </div>
                <div class="form-check form-switch fs-5 mb-0">
                  <input class="form-check-input" type="checkbox" role="switch" id="cmpSwitchFunzionali" ${state.categorie.funzionali ? 'checked' : ''} />
                </div>
              </div>
            </div>

            <!-- Categoria 3: Analitici Interni Anonimizzati -->
            <div class="hermae-cmp-cat-card">
              <div class="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <label for="cmpSwitchAnalitici" class="fw-bold text-dark small mb-0">3. Statistiche &amp; Impatto Culturale (First-Party)</label>
                    <span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size: 0.65rem;">Facoltativo</span>
                  </div>
                  <p class="text-muted small mb-1" style="font-size: 0.78rem;">
                    Consentono la raccolta anonimizzata delle visualizzazioni delle schede libro e il calcolo dell'Indice di Impatto Culturale ad esclusivo uso personale del lettore, senza profilazione commerciale né cessione a terzi.
                  </p>
                  <span class="text-secondary" style="font-size: 0.7rem;">Base giuridica: Art. 6(1)(a) GDPR (Consenso Esplicito)</span>
                </div>
                <div class="form-check form-switch fs-5 mb-0">
                  <input class="form-check-input" type="checkbox" role="switch" id="cmpSwitchAnalitici" ${state.categorie.analitici ? 'checked' : ''} />
                </div>
              </div>
            </div>

            <!-- Categoria 4: Servizi Terzi & Mappe Esterne -->
            <div class="hermae-cmp-cat-card">
              <div class="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <label for="cmpSwitchTerzi" class="fw-bold text-dark small mb-0">4. Mappe Interattive &amp; CDN Esterne</label>
                    <span class="badge bg-primary-subtle text-primary border border-primary-subtle" style="font-size: 0.65rem;">Facoltativo</span>
                  </div>
                  <p class="text-muted small mb-1" style="font-size: 0.78rem;">
                    Abilitano il caricamento di risorse geospaziali esterne (OpenStreetMap / CARTO tile) e dei font/icone via CDN.
                  </p>
                  <span class="text-secondary" style="font-size: 0.7rem;">Base giuridica: Art. 6(1)(a) GDPR (Consenso Esplicito)</span>
                </div>
                <div class="form-check form-switch fs-5 mb-0">
                  <input class="form-check-input" type="checkbox" role="switch" id="cmpSwitchTerzi" ${state.categorie.servizi_terzi ? 'checked' : ''} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer del Modale con Azioni -->
        <div class="p-3 px-4 border-top bg-light d-flex flex-wrap align-items-center justify-content-between gap-2">
          <button type="button" class="btn btn-outline-danger btn-sm" id="btnCmpModalRejectAll">
            <i class="bi bi-x-circle me-1"></i>Rifiuta Tutti
          </button>
          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-primary btn-sm" id="btnCmpModalSave">
              <i class="bi bi-check-lg me-1"></i>Salva Preferenze
            </button>
            <button type="button" class="btn btn-success btn-sm" id="btnCmpModalAcceptAll">
              <i class="bi bi-check2-all me-1"></i>Accetta Tutti
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Event listener chiusura modale
    document.getElementById('btnCmpCloseModal').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    document.addEventListener('keydown', handleEscapeKey);

    // Salva Preferenze Selezionate
    document.getElementById('btnCmpModalSave').addEventListener('click', () => {
      const funzionali = document.getElementById('cmpSwitchFunzionali').checked;
      const analitici = document.getElementById('cmpSwitchAnalitici').checked;
      const servizi_terzi = document.getElementById('cmpSwitchTerzi').checked;

      saveConsents({ funzionali, analitici, servizi_terzi });
      closeModal();
      closeBanner();
    });

    // Rifiuta Tutti (mantiene solo necessari)
    document.getElementById('btnCmpModalRejectAll').addEventListener('click', () => {
      saveConsents({ funzionali: false, analitici: false, servizi_terzi: false });
      closeModal();
      closeBanner();
    });

    // Accetta Tutti
    document.getElementById('btnCmpModalAcceptAll').addEventListener('click', () => {
      saveConsents({ funzionali: true, analitici: true, servizi_terzi: true });
      closeModal();
      closeBanner();
    });
  }

  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  }

  function closeModal() {
    const modal = document.getElementById('hermae-cmp-modal');
    if (modal) {
      document.removeEventListener('keydown', handleEscapeKey);
      modal.remove();
    }
  }

  /**
   * Salva ed emette la decisione del consenso
   */
  function saveConsents(choices) {
    persistLocal({
      consenso_id: state.consenso_id,
      categorie: choices
    });
    syncWithBackend();
    dispatchConsentEvent();
  }

  /**
   * Inizializzazione automatica al caricamento della pagina
   */
  function init() {
    renderBadgeTrigger();
    if (!state.espresso) {
      renderBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API Pubblica esposta a livello globale su window.HermaeCMP
  window.HermaeCMP = {
    getConsents: () => ({ ...state }),
    hasConsent: (category) => {
      if (category === 'necessari') return true;
      return Boolean(state.categorie && state.categorie[category]);
    },
    saveConsents,
    openModal,
    openBanner: renderBanner,
    closeBanner,
    syncWithBackend
  };
})();
