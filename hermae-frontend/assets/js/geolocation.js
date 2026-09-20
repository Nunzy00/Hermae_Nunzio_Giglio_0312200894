/**
 * HERMAE — Modulo Centralizzato di Geolocalizzazione e Prossimità
 * Gestisce l'interfacciamento con Geolocation API W3C, la stima della precisione GPS e il matching geodetico
 */

// Inizializza il modulo autonomo di geolocalizzazione nello spazio globale della finestra
window.HermaeGeo = (() => {
  // Raggio medio della Terra in chilometri (raggio sferico IUGG)
  const EARTH_RADIUS_KM = 6371;

  // Verifica se le API di geolocalizzazione sono supportate dal browser client corrente
  const isSupported = () => {
    return 'geolocation' in navigator;
  };

  // Ispeziona lo stato attuale del permesso di localizzazione tramite la W3C Permissions API
  const checkPermission = async () => {
    if (!('permissions' in navigator)) {
      return 'unknown';
    }
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return status.state; // 'granted', 'prompt', 'denied'
    } catch (e) {
      return 'unknown';
    }
  };

  // Classifica il livello di accuratezza del segnale in base al margine di errore in metri
  const evaluateAccuracy = (accuracyMeters) => {
    if (accuracyMeters === null || accuracyMeters === undefined) {
      return { level: 'unknown', label: 'Precisione non determinata', badgeClass: 'bg-secondary', meters: null };
    }
    const meters = Math.round(accuracyMeters);
    if (meters <= 30) {
      return { level: 'high', label: 'Segnale GPS Ottimale', badgeClass: 'bg-success', meters };
    } else if (meters <= 100) {
      return { level: 'medium', label: 'Precisione Media (Rete/Wi-Fi)', badgeClass: 'bg-warning text-dark', meters };
    } else {
      return { level: 'low', label: 'Precisione Approssimata (Cella/IP)', badgeClass: 'bg-danger', meters };
    }
  };

  // Cache in-memory e persistente dell'ultima posizione rilevata con successo
  const STORAGE_KEY = 'hermae_last_geo';
  let lastKnownPosition = (() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  })();
  const CACHE_TTL_MS = 60000; // 60 secondi di cache rapida per click ripetuti
  let pendingPositionPromise = null; // Deduplicazione delle richieste simultanee

  // Salva una posizione acquisita in memoria e nel session storage
  const savePositionState = (posObj) => {
    lastKnownPosition = posObj;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(posObj));
    } catch (e) {}
  };

  // Tenta la rilevazione della posizione tramite fallback di rete IP (per desktop o sensori non disponibili)
  const locateViaIpFallback = async () => {
    try {
      // Prova prima l'endpoint del backend locale se disponibile
      let data = null;
      if (window.apiClient) {
        const res = await window.apiClient.get('/posizioni/ip-locate');
        if (res.data && res.data.success && res.data.data) {
          data = res.data.data;
        }
      }
      // Se non disponibile da backend o in errore, prova direttamente il servizio pubblico
      if (!data) {
        const publicRes = await fetch('https://ipapi.co/json/', {
          headers: { 'Accept': 'application/json' }
        });
        if (publicRes.ok) {
          const pubData = await publicRes.json();
          if (pubData.latitude && pubData.longitude) {
            data = {
              lat: parseFloat(pubData.latitude),
              lng: parseFloat(pubData.longitude),
              citta: pubData.city || 'Comune rilevato da IP',
              regione: pubData.region || '',
              accuracy: 1500
            };
          }
        }
      }

      if (data && data.lat && data.lng) {
        const evaluation = evaluateAccuracy(data.accuracy || 1500);
        const result = {
          lat: parseFloat(data.lat.toFixed(7)),
          lng: parseFloat(data.lng.toFixed(7)),
          accuracy: data.accuracy || 1500,
          evaluation: {
            ...evaluation,
            label: `Rete Wi-Fi / IP (${data.citta || 'Rete locale'})`
          },
          citta: data.citta,
          source: 'ip_network',
          timestamp: Date.now()
        };
        savePositionState(result);
        return result;
      }
    } catch (e) {
      // Fallback non riuscito
    }
    return null;
  };

  // Richiede la posizione geografica attuale con caching rapido, deduplicazione e fallback automatico
  const getCurrentPosition = (options = {}) => {
    // Se c'è già una richiesta in volo, riutilizzala per evitare collisioni con l'hardware
    if (pendingPositionPromise) {
      return pendingPositionPromise;
    }

    // Se abbiamo una posizione recente valida (entro 60s) e non è forzato il refresh, restituiscila all'istante
    const now = Date.now();
    if (lastKnownPosition && (now - lastKnownPosition.timestamp < CACHE_TTL_MS) && !options.forceFresh) {
      return Promise.resolve(lastKnownPosition);
    }

    pendingPositionPromise = new Promise(async (resolve, reject) => {
      // Converte la risposta nativa del browser nell'oggetto standard Hermae
      const formatSuccess = (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(7));
        const lng = parseFloat(position.coords.longitude.toFixed(7));
        const accuracy = position.coords.accuracy;
        const evaluation = evaluateAccuracy(accuracy);

        const result = {
          lat,
          lng,
          accuracy,
          evaluation,
          source: 'device_sensor',
          timestamp: position.timestamp || Date.now()
        };
        savePositionState(result);
        pendingPositionPromise = null;
        return result;
      };

      // Gestore del fallimento con fallback trasparente a IP Geolocation
      const handleFallbackOrError = async (nativeError) => {
        // Tenta subito il recupero tramite connessione di rete IP
        const ipResult = await locateViaIpFallback();
        if (ipResult) {
          pendingPositionPromise = null;
          return resolve(ipResult);
        }

        // Se anche l'IP fallisce ma abbiamo una posizione in cache (anche precedente), usala
        if (lastKnownPosition) {
          pendingPositionPromise = null;
          return resolve(lastKnownPosition);
        }

        pendingPositionPromise = null;
        reject(mapGeoError(nativeError));
      };

      if (!isSupported()) {
        return handleFallbackOrError({ code: 2 });
      }

      // Tenta prima la geolocalizzazione nativa ad alta precisione con timeout sufficiente per il fix Wi-Fi/GPS
      const primaryOptions = {
        enableHighAccuracy: true, // Fondamentale per agganciare la triangolazione Wi-Fi / GPS reale
        timeout: 15000,           // 15s consentono a macOS / CoreLocation di completare la scansione dei beacon
        maximumAge: 10000,
        ...options
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(formatSuccess(position));
        },
        (geoError) => {
          // Se il permesso è stato esplicitamente negato dall'utente, rispetta la scelta ma tenta IP se richiesto
          if (geoError.code === geoError.PERMISSION_DENIED) {
            pendingPositionPromise = null;
            return reject(mapGeoError(geoError));
          }
          // Per POSITION_UNAVAILABLE o TIMEOUT (es. Mac desktop senza antenna satellitare), attiva il fallback IP
          handleFallbackOrError(geoError);
        },
        primaryOptions
      );
    });

    return pendingPositionPromise;
  };

  // Mappa gli errori nativi della Geolocation API in messaggi comprensibili all'utente
  const mapGeoError = (geoError) => {
    let message = 'Impossibile determinare la posizione geografica.';
    let errorCode = 'UNKNOWN_ERROR';

    switch (geoError.code) {
      case geoError.PERMISSION_DENIED:
        message = 'Permesso di geolocalizzazione negato dall\'utente o dal browser.';
        errorCode = 'PERMISSION_DENIED';
        break;
      case geoError.POSITION_UNAVAILABLE:
        message = 'Segnale GPS o informazioni di localizzazione non disponibili al momento.';
        errorCode = 'POSITION_UNAVAILABLE';
        break;
      case geoError.TIMEOUT:
        message = 'Tempo scaduto durante il rilevamento delle coordinate GPS.';
        errorCode = 'TIMEOUT';
        break;
    }

    const error = new Error(message);
    error.code = errorCode;
    error.nativeError = geoError;
    return error;
  };

  // Converte un angolo da gradi a radianti
  const toRadians = (degrees) => {
    return (degrees * Math.PI) / 180;
  };

  // Calcola la distanza geodetica tra due punti sulla Terra tramite formula dell'emisenoverso (Haversine)
  const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = EARTH_RADIUS_KM * c;

    return {
      km: parseFloat(distanceKm.toFixed(2)),
      metri: Math.round(distanceKm * 1000)
    };
  };

  // Classifica la distanza in una fascia territoriale di prossimità per il matching di vicinanza
  const classifyProximity = (distanceKm) => {
    const d = parseFloat(distanceKm);
    if (d <= 2) {
      return { fascia: 'Stesso Quartiere', badgeClass: 'bg-success', label: 'Prossimità Immediata' };
    } else if (d <= 10) {
      return { fascia: 'Stessa Città', badgeClass: 'bg-primary', label: 'Area Urbana' };
    } else if (d <= 25) {
      return { fascia: 'Area Metropolitana', badgeClass: 'bg-info text-dark', label: 'Interland' };
    } else if (d <= 50) {
      return { fascia: 'Area Provinciale', badgeClass: 'bg-warning text-dark', label: 'Provincia' };
    } else {
      return { fascia: 'Fuori Raggio', badgeClass: 'bg-secondary', label: 'Oltre il confine' };
    }
  };

  // Formatta le coordinate numeriche in una stringa leggibile WGS84 standard
  const formatCoordinates = (lat, lng) => {
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      return '-';
    }
    const latFixed = parseFloat(lat).toFixed(6);
    const lngFixed = parseFloat(lng).toFixed(6);
    const latDirection = lat >= 0 ? 'N' : 'S';
    const lngDirection = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(latFixed)}° ${latDirection}, ${Math.abs(lngFixed)}° ${lngDirection}`;
  };

  // Tenta la geocodifica inversa tramite il servizio OpenStreetMap Nominatim rispettando il rate limit
  const reverseGeocode = async (lat, lng) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=14&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HermaeSharingCulturale/1.0 (nunzio.giglio@studenti.unipegaso.it)'
        }
      });
      if (!response.ok) return null;
      const data = await response.json();
      const addr = data.address || {};
      const citta = addr.city || addr.town || addr.village || addr.municipality || 'Comune sconosciuto';
      const quartiere = addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || '';
      return {
        citta,
        quartiere,
        displayName: data.display_name
      };
    } catch (e) {
      return null;
    }
  };

  // Espone l'interfaccia pubblica del modulo
  return {
    isSupported,
    checkPermission,
    evaluateAccuracy,
    getCurrentPosition,
    calculateHaversineDistance,
    classifyProximity,
    formatCoordinates,
    reverseGeocode
  };
})();
