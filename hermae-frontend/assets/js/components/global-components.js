/**
 * HERMAE — Componenti Globali Condivisi (Vue.js 3)
 * Contiene le definizioni modulari dei componenti riutilizzabili su tutte le viste HTML
 */

// Componente Navbar Guest: Intestazione minimale per utenti non autenticati
const NavbarGuest = {
  name: 'NavbarGuest',
  props: {
    activePage: {
      type: String,
      default: ''
    }
  },
  template: `
    <header>
      <nav class="navbar navbar-expand-lg navbar-hermae" aria-label="Navigazione principale visitatori">
        <div class="container">
          <a class="navbar-brand d-flex align-items-center gap-2" href="login.html" aria-label="Torna alla schermata di accesso Hermae">
            <img src="assets/img/logo.svg" alt="Logo Hermae Sharing Culturale" height="38" />
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navGuestContent" aria-controls="navGuestContent" aria-expanded="false" aria-label="Espandi menu di navigazione">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse justify-content-end" id="navGuestContent">
            <ul class="navbar-nav align-items-center gap-2 mt-2 mt-lg-0">
              <li class="nav-item">
                <a class="nav-link" :class="{ active: activePage === 'login' }" href="login.html">
                  <i class="bi bi-box-arrow-in-right me-1" aria-hidden="true"></i>Accedi
                </a>
              </li>
              <li class="nav-item">
                <a class="btn btn-primary btn-sm px-3" :class="{ 'btn-outline-primary': activePage === 'registrazione' }" href="registrazione.html">
                  <i class="bi bi-person-plus me-1" aria-hidden="true"></i>Registrati
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </header>
  `
};

// Componente Navbar Logged: Barra applicativa per utenti autenticati con collegamenti operativi
const NavbarLogged = {
  name: 'NavbarLogged',
  props: {
    activePage: {
      type: String,
      default: 'dashboard'
    }
  },
  data() {
    return {
      user: window.auth ? window.auth.getUser() : null
    };
  },
  methods: {
    // Gestisce l'azione di disconnessione delegando al modulo di autenticazione
    async handleLogout() {
      if (window.auth) {
        await window.auth.logout();
      }
    }
  },
  template: `
    <header>
      <nav class="navbar navbar-expand-lg navbar-hermae sticky-top" aria-label="Navigazione principale riservata">
        <div class="container-fluid px-lg-4">
          <a class="navbar-brand d-flex align-items-center gap-2" href="dashboard.html" aria-label="Hermae Dashboard">
            <img src="assets/img/logo.svg" alt="Logo Hermae" height="36" />
          </a>

          <!-- Controlli a destra: Account Utente affiancato all'icona burger su mobile -->
          <div class="d-flex align-items-center gap-2 order-lg-last ms-auto ms-lg-0">
            <!-- Menu Utente con Profilo e Logout -->
            <div class="dropdown">
              <button class="btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2 py-1 px-2 px-md-3" type="button" id="userMenuBtn" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-person-circle fs-5" aria-hidden="true"></i>
                <span class="d-none d-md-inline fw-semibold text-truncate" style="max-width: 140px;">
                  {{ user ? user.nome : 'Utente' }}
                </span>
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby="userMenuBtn">
                <li class="px-3 py-2 border-bottom">
                  <div class="small text-muted">Accesso effettuato come:</div>
                  <div class="fw-bold text-truncate" style="max-width: 200px;">{{ user ? user.email : '' }}</div>
                </li>
                <li>
                  <a class="dropdown-item" href="account.html">
                    <i class="bi bi-person me-2" aria-hidden="true"></i>Profilo Account
                  </a>
                </li>
                <li>
                  <a class="dropdown-item" href="impostazioni.html">
                    <i class="bi bi-shield-check me-2" aria-hidden="true"></i>Privacy & Impostazioni
                  </a>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <button class="dropdown-item text-danger d-flex align-items-center" type="button" @click="handleLogout">
                    <i class="bi bi-box-arrow-right me-2" aria-hidden="true"></i>Disconnetti
                  </button>
                </li>
              </ul>
            </div>

            <!-- Icona Burger Menu (visibile solo su schermi piccoli < lg) -->
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navLoggedContent" aria-controls="navLoggedContent" aria-expanded="false" aria-label="Espandi menu riservato">
              <span class="navbar-toggler-icon"></span>
            </button>
          </div>

          <!-- Menu collassabile delle sezioni -->
          <div class="collapse navbar-collapse" id="navLoggedContent">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0 gap-1 ms-lg-3">
              <li class="nav-item">
                <a class="nav-link" :class="{ active: activePage === 'dashboard' }" href="dashboard.html">
                  <i class="bi bi-speedometer2 me-1" aria-hidden="true"></i>Dashboard
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link" :class="{ active: activePage === 'ricerca' }" href="ricerca.html">
                  <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>Mappa & Ricerca
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link" :class="{ active: activePage === 'libreria' }" href="libreria.html">
                  <i class="bi bi-bookshelf me-1" aria-hidden="true"></i>La Mia Libreria
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link" :class="{ active: activePage === 'attivita' }" href="attivita.html">
                  <i class="bi bi-arrow-left-right me-1" aria-hidden="true"></i>Prestiti
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link" :class="{ active: activePage === 'chat' }" href="chat.html">
                  <i class="bi bi-chat-dots me-1" aria-hidden="true"></i>Messaggi
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </header>
  `
};

// Componente App Footer: Piè di pagina essenziale con copyright e crediti di sviluppo
const AppFooter = {
  name: 'AppFooter',
  data() {
    return {
      currentYear: new Date().getFullYear()
    };
  },
  template: `
    <footer class="footer-hermae" role="contentinfo">
      <div class="container text-center">
        <p class="mb-0 text-white-50 small">
          &copy; {{ currentYear }} <strong>Hermae</strong>. Realizzato da <strong>Nunzio Giglio</strong>.
        </p>
      </div>
    </footer>
  `
};

// Componente Toast Notification: Contenitore reattivo per notifiche asincrone accessibili
const ToastNotification = {
  name: 'ToastNotification',
  props: {
    toasts: {
      type: Array,
      default: () => []
    }
  },
  emits: ['remove-toast'],
  template: `
    <div class="toast-container-hermae" aria-live="assertive" aria-atomic="true">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="toast show shadow-lg" 
        :class="'border-' + (toast.type || 'primary')"
        role="alert"
      >
        <div class="toast-header" :class="'bg-' + (toast.type || 'primary') + ' text-white'">
          <i class="bi me-2" :class="getIcon(toast.type)" aria-hidden="true"></i>
          <strong class="me-auto">{{ toast.title || 'Notifica' }}</strong>
          <small class="text-white-50">adesso</small>
          <button type="button" class="btn-close btn-close-white ms-2" @click="$emit('remove-toast', toast.id)" aria-label="Chiudi notifica"></button>
        </div>
        <div class="toast-body bg-white text-dark">
          {{ toast.message }}
        </div>
      </div>
    </div>
  `,
  methods: {
    // Determina l'icona contestuale in base al tipo di notifica (success, danger, warning, info)
    getIcon(type) {
      switch (type) {
        case 'success': return 'bi-check-circle-fill';
        case 'danger': return 'bi-exclamation-triangle-fill';
        case 'warning': return 'bi-exclamation-circle-fill';
        default: return 'bi-info-circle-fill';
      }
    }
  }
};

// Componente Loading Spinner: Indicatore visivo accessibile di operazione in corso
const LoadingSpinner = {
  name: 'LoadingSpinner',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: 'Caricamento in corso...'
    }
  },
  template: `
    <div v-if="active" class="loading-overlay" role="status" aria-live="polite">
      <div class="loading-box">
        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
          <span class="visually-hidden">{{ message }}</span>
        </div>
        <div class="fw-semibold text-dark">{{ message }}</div>
      </div>
    </div>
  `
};

// Registra globalmente i componenti riutilizzabili sull'applicazione Vue 3 passata come parametro
function registerGlobalComponents(app) {
  app.component('navbar-guest', NavbarGuest);
  app.component('navbar-logged', NavbarLogged);
  app.component('app-footer', AppFooter);
  app.component('toast-notification', ToastNotification);
  app.component('loading-spinner', LoadingSpinner);
}

// Esporta le definizioni e la funzione di registrazione nel contesto globale
window.HermaeComponents = {
  NavbarGuest,
  NavbarLogged,
  AppFooter,
  ToastNotification,
  LoadingSpinner,
  registerGlobalComponents
};
