/**
 * HERMAE — Modulo Client PWA (Progressive Web App)
 * Gestisce la registrazione del Service Worker, l'installazione su Desktop/Mobile
 * e il monitoraggio dello stato di connettività di rete.
 */

(function () {
  'use strict';

  let deferredInstallPrompt = null;
  let isAppInstalled = false;

  const HermaePWA = {
    // Rileva se l'applicazione è in esecuzione in modalità standalone (installata)
    isStandalone() {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://')
      );
    },

    // Registra il Service Worker
    async registerServiceWorker() {
      if (!('serviceWorker' in navigator)) {
        console.log('[PWA] I Service Worker non sono supportati da questo browser.');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });

        // Controlla aggiornamenti in background
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Nuova versione di Hermae disponibile. Ricarica per applicare.');
                HermaePWA.notifyUpdateAvailable();
              }
            });
          }
        });

        console.log('[PWA] Service Worker registrato con successo. Scope:', registration.scope);
      } catch (error) {
        console.warn('[PWA] Errore durante la registrazione del Service Worker:', error.message);
      }
    },

    // Notifica disponibilità aggiornamento
    notifyUpdateAvailable() {
      if (window.toastManager && typeof window.toastManager.addToast === 'function') {
        window.toastManager.addToast(
          'Aggiornamento Disponibile',
          'Una nuova versione dell\'applicazione è pronta. Fai clic per ricaricare.',
          'info'
        );
      }
    },

    // Mostra il prompt nativo di installazione
    async promptInstall() {
      if (!deferredInstallPrompt) {
        console.log('[PWA] Il prompt di installazione non è al momento disponibile.');
        return false;
      }

      // Mostra il dialogo nativo del browser
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      console.log(`[PWA] Scelta installazione utente: ${choiceResult.outcome}`);

      if (choiceResult.outcome === 'accepted') {
        isAppInstalled = true;
        HermaePWA.hideInstallUI();
      }

      deferredInstallPrompt = null;
      return choiceResult.outcome === 'accepted';
    },

    // Inizializza l'interfaccia di installazione
    initInstallUI() {
      // Se già installata in standalone, non mostrare alcun prompt
      if (this.isStandalone()) {
        isAppInstalled = true;
        return;
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        // Previene la comparsa del mini-infobar predefinito di Chrome/Edge
        e.preventDefault();
        deferredInstallPrompt = e;
        console.log('[PWA] Evento beforeinstallprompt intercettato.');
        HermaePWA.renderInstallBanner();
      });

      window.addEventListener('appinstalled', () => {
        isAppInstalled = true;
        deferredInstallPrompt = null;
        console.log('[PWA] Hermae è stata installata con successo.');
        HermaePWA.hideInstallUI();
        if (window.toastManager && typeof window.toastManager.addToast === 'function') {
          window.toastManager.addToast(
            'Applicazione Installata',
            'Hermae è ora disponibile tra le tue applicazioni per l\'accesso rapido!',
            'success'
          );
        }
      });
    },

    // Renderizza un badge/banner discreto di installazione
    renderInstallBanner() {
      if (document.getElementById('hermaePwaInstallContainer') || isAppInstalled || this.isStandalone()) {
        return;
      }

      const container = document.createElement('div');
      container.id = 'hermaePwaInstallContainer';
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'Installazione applicazione Hermae');
      container.innerHTML = `
        <div class="card shadow-lg border-0 p-3" style="background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15); border-radius: 1rem; color: #f8fafc; max-width: 360px;">
          <div class="d-flex align-items-center gap-3 mb-2">
            <img src="assets/img/icon-192x192.png" alt="Hermae Icon" width="44" height="44" class="rounded-3 shadow-sm" />
            <div class="flex-grow-1 min-w-0">
              <div class="fw-bold text-truncate text-white" style="font-size: 0.95rem;">Installa Hermae</div>
              <div class="small text-secondary" style="font-size: 0.78rem;">Il sapere, un libro alla volta</div>
            </div>
            <button type="button" class="btn-close btn-close-white btn-sm" id="hermaePwaDismissBtn" aria-label="Chiudi avviso installazione"></button>
          </div>
          <p class="small text-secondary mb-3" style="font-size: 0.82rem; line-height: 1.4;">
            Installa l'app su desktop o dispositivo mobile per un accesso immediato e fruizione rapida.
          </p>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-primary btn-sm flex-grow-1 fw-semibold py-1 d-flex align-items-center justify-content-center gap-1" id="hermaePwaInstallBtn">
              <i class="bi bi-download" aria-hidden="true"></i>
              <span>Installa App</span>
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm py-1 text-white-50" id="hermaePwaLaterBtn">
              Più tardi
            </button>
          </div>
        </div>
      `;

      // Posizionamento fisso in basso a destra (non sovrapposto al CMP o badge)
      Object.assign(container.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: '1050',
        animation: 'fadeInUp 0.3s ease-out'
      });

      document.body.appendChild(container);

      // Event listeners per i pulsanti
      const installBtn = document.getElementById('hermaePwaInstallBtn');
      const dismissBtn = document.getElementById('hermaePwaDismissBtn');
      const laterBtn = document.getElementById('hermaePwaLaterBtn');

      if (installBtn) {
        installBtn.addEventListener('click', () => {
          HermaePWA.promptInstall();
        });
      }

      const closeHandler = () => {
        HermaePWA.hideInstallUI();
        // Non riproporre per la sessione corrente
        sessionStorage.setItem('hermae_pwa_dismissed', 'true');
      };

      if (dismissBtn) dismissBtn.addEventListener('click', closeHandler);
      if (laterBtn) laterBtn.addEventListener('click', closeHandler);
    },

    // Rimuove il banner di installazione
    hideInstallUI() {
      const container = document.getElementById('hermaePwaInstallContainer');
      if (container) {
        container.remove();
      }
    },

    // Monitoraggio globale della connettività (Online / Offline)
    initNetworkMonitoring() {
      window.addEventListener('online', () => {
        console.log('[PWA] Connessione di rete ristabilita.');
        document.body.classList.remove('is-offline');
        if (window.toastManager && typeof window.toastManager.addToast === 'function') {
          window.toastManager.addToast(
            'Sei di nuovo Online',
            'La connessione a Internet è stata ristabilita. Tutte le funzionalità sono attive.',
            'success'
          );
        }
      });

      window.addEventListener('offline', () => {
        console.log('[PWA] Connessione di rete persa. Modalità offline attiva.');
        document.body.classList.add('is-offline');
        if (window.toastManager && typeof window.toastManager.addToast === 'function') {
          window.toastManager.addToast(
            'Connessione Assente',
            'Dispositivo offline. Le risorse e pagine salvate in cache restano disponibili.',
            'warning'
          );
        }
      });

      // Applica classe iniziale se già offline
      if (!navigator.onLine) {
        document.body.classList.add('is-offline');
      }
    },

    // Inizializzazione principale
    init() {
      this.registerServiceWorker();
      this.initInstallUI();
      this.initNetworkMonitoring();
    }
  };

  // Esponi globalmente
  window.HermaePWA = HermaePWA;

  // Avvio automatico al caricamento del DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => HermaePWA.init());
  } else {
    HermaePWA.init();
  }
})();
