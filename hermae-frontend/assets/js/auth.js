/**
 * HERMAE — Modulo di Gestione Sessione e Autenticazione Client-Side
 * Amministra il ciclo di vita dei token, il profilo utente e i route guard di navigazione
 */

const auth = {
  // Restituisce il Bearer Access Token attualmente memorizzato nel browser
  getAccessToken() {
    return localStorage.getItem('hermae_access_token');
  },

  // Restituisce il Refresh Token utilizzato per estendere la durata della sessione
  getRefreshToken() {
    return localStorage.getItem('hermae_refresh_token');
  },

  // Recupera e deserializza l'oggetto anagrafico dell'utente autenticato
  getUser() {
    const raw = localStorage.getItem('hermae_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  // Verifica se l'utente corrente possiede una sessione valida memorizzata
  isAuthenticated() {
    return !!this.getAccessToken() && !!this.getUser();
  },

  // Salva nello storage locale le credenziali di sessione, token e dati utente
  setSession(authData) {
    if (authData.tokens) {
      localStorage.setItem('hermae_access_token', authData.tokens.accessToken);
      localStorage.setItem('hermae_refresh_token', authData.tokens.refreshToken);
    }
    if (authData.user) {
      localStorage.setItem('hermae_user', JSON.stringify(authData.user));
    }
  },

  // Rimuove in modo completo e irreversibile tutti i riferimenti di sessione dal client
  clearSession() {
    localStorage.removeItem('hermae_access_token');
    localStorage.removeItem('hermae_refresh_token');
    localStorage.removeItem('hermae_user');
    sessionStorage.removeItem('hermae_redirect');
  },

  // Esegue la richiesta di autenticazione inviando email e password al backend
  async login(email, password) {
    const response = await window.apiClient.post('/auth/login', { email, password });
    if (response.data && response.data.success) {
      this.setSession(response.data.data);
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Errore durante l\'autenticazione.');
  },

  // Invia i dati di registrazione di un nuovo profilo utente al server
  async register(userData) {
    const response = await window.apiClient.post('/auth/register', userData);
    if (response.data && response.data.success) {
      this.setSession(response.data.data);
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Errore durante la registrazione.');
  },

  // Interroga l'endpoint protetto /auth/me per sincronizzare i dati utente con il database
  async fetchCurrentUser() {
    const response = await window.apiClient.get('/auth/me');
    if (response.data && response.data.success) {
      const user = response.data.data;
      localStorage.setItem('hermae_user', JSON.stringify(user));
      return user;
    }
    throw new Error('Impossibile recuperare il profilo utente.');
  },

  // Notifica al backend la chiusura della sessione e pulisce i dati locali
  async logout() {
    try {
      await window.apiClient.post('/auth/logout');
    } catch (err) {
      // Ignora errori di rete sul logout per garantire comunque la pulizia locale
    } finally {
      this.clearSession();
      window.location.href = 'logout.html';
    }
  },

  // Route guard per proteggere le pagine private reindirizzando i visitatori non loggati
  requireAuth(targetUrl = 'login.html') {
    if (!this.isAuthenticated()) {
      const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
      const search = window.location.search;
      sessionStorage.setItem('hermae_redirect', currentPath + search);
      window.location.href = `${targetUrl}?redirect=${encodeURIComponent(currentPath + search)}`;
      return false;
    }
    return true;
  },

  // Route guard per reindirizzare gli utenti già autenticati lontano da pagine di accesso
  requireGuest(targetUrl = 'dashboard.html') {
    if (this.isAuthenticated()) {
      const redirect = sessionStorage.getItem('hermae_redirect') || targetUrl;
      sessionStorage.removeItem('hermae_redirect');
      window.location.href = redirect;
      return false;
    }
    return true;
  }
};

// Rende accessibile l'oggetto auth nel contesto globale
window.auth = auth;
