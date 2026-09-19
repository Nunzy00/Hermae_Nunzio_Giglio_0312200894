# Tech Stack

1. **Front-end:** Vue.js + Bootstrap 5 (con icone Bootstrap Icons) per un layout responsive e conforme ai criteri di accessibilità WCAG/WAI-ARIA.
2. **Client HTTP:** Axios (richiesto da ateneo per le chiamate REST verso il back-end).
3. **Back-end:** Node.js con Express.js (architettura RESTful modulare: rotte, controller, middleware).
4. **Database & GIS:** PostgreSQL con estensione **PostGIS** per la persistenza dei dati e le query spaziali (`GEOMETRY(Point, 4326)` o `GEOGRAPHY` per il calcolo raggio/vicinanza).
5. **Gestione Immagini:** `multer` per l'upload multipart e pipeline con libreria **Sharp** per ridimensionamento, generazione thumbnail e compressione nativa in formato `.webp`.
6. **Mappe & Filtro Spaziale:** Leaflet.js (con tile provider OpenStreetMap) integrato nei componenti Vue per la geolocalizzazione interattiva e i marker.
7. **Visualizzazione Statistiche:** Chart.js (o wrapper `vue-chartjs`) per i grafici della dashboard amministrativa (trend visualizzazioni, richieste prestito).
