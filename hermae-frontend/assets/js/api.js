/**
 * HERMAE — Modulo Client HTTP Centralizzato (Axios)
 * Gestisce l'intercettazione delle richieste, iniezione Bearer Token e rinnovo trasparente della sessione
 */

// Determina l'URL base dell'API in base all'ambiente di esecuzione locale o integrato
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : '/api';

// Inizializza l'istanza Axios configurata per comunicare con il backend Hermae
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Intercetta ogni richiesta in uscita per iniettare automaticamente il Bearer Access Token se presente
apiClient.interceptors.request.use(
  (config) => {
    // Recupera l'access token salvato nella memoria locale del browser
    const token = localStorage.getItem('hermae_access_token');
    if (token) {
      // Imposta l'header standard di autorizzazione con formato RFC 6750 Bearer
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // Ritorna l'errore di configurazione della richiesta
    return Promise.reject(error);
  }
);

// Flag per evitare loop multipli di refresh simultanei
let isRefreshing = false;
// Coda di richieste sospese in attesa del rinnovo del token
let failedQueue = [];

// Elabora la coda delle richieste pendenti risolvendo o rigettando le promesse
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Intercetta ogni risposta per catturare errori 401 e rinnovare automaticamente il token scaduto
apiClient.interceptors.response.use(
  (response) => {
    // Restituisce direttamente la risposta in caso di successo HTTP 2xx
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Gestisce il caso di token scaduto (HTTP 401) escludendo richieste di login o refresh stesso
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      const isAuthEndpoint = originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/register');
      
      // Se l'errore 401 proviene da login o register non tentare il refresh
      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      // Se il refresh è già in corso, accoda la richiesta
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('hermae_refresh_token');

      // Se non esiste alcun refresh token, azzera la sessione e reindirizza al login
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem('hermae_access_token');
        localStorage.removeItem('hermae_refresh_token');
        localStorage.removeItem('hermae_user');
        if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('registrazione.html')) {
          window.location.href = 'login.html?session_expired=1';
        }
        return Promise.reject(error);
      }

      try {
        // Esegue la chiamata all'endpoint di rinnovo token senza passare per l'interceptor request
        const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const { tokens } = refreshResponse.data.data;

        // Memorizza i nuovi token di accesso e di rinnovo nel localStorage
        localStorage.setItem('hermae_access_token', tokens.accessToken);
        localStorage.setItem('hermae_refresh_token', tokens.refreshToken);

        // Aggiorna l'header Authorization per la richiesta originale
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;

        // Sblocca la coda con il nuovo token valido
        processQueue(null, tokens.accessToken);
        isRefreshing = false;

        // Riprova l'esecuzione della richiesta originale fallita
        return apiClient(originalRequest);
      } catch (refreshErr) {
        // In caso di fallimento del refresh, invalida la sessione e pulisce lo storage
        processQueue(refreshErr, null);
        isRefreshing = false;
        localStorage.removeItem('hermae_access_token');
        localStorage.removeItem('hermae_refresh_token');
        localStorage.removeItem('hermae_user');
        
        if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('registrazione.html')) {
          window.location.href = 'login.html?session_expired=1';
        }
        return Promise.reject(refreshErr);
      }
    }

    // Ritorna qualsiasi altro errore HTTP non gestibile dal refresh
    return Promise.reject(error);
  }
);

// Esporta il client configurato sull'oggetto globale della finestra
window.apiClient = apiClient;
