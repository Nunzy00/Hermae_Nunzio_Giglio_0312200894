/**
 * TEST SUITE FASE 26 — HERMAE — IL SAPERE, UN LIBRO ALLA VOLTA
 * Progetto: Hermae — Candidato: Nunzio Giglio (Matr. 0312200894)
 * 
 * Verifica end-to-end della Progressive Web App (PWA):
 * 1. Validità sintattica e requisiti W3C Web App Manifest (manifest.json)
 * 2. Esistenza fisica e integrità di tutte le icone dichiarate (192, 512, maskable, apple)
 * 3. Validità sintattica e architettura del Service Worker (service-worker.js)
 * 4. Verifica della strategia di Caching Ibrida (Network First vs Cache First vs Network Only)
 * 5. Verifica della pagina di fallback offline accessibile (offline.html)
 * 6. Verifica del modulo client PWA (pwa.js, install prompt e connettività)
 * 7. Copertura globale dei meta tag e script PWA in tutti i file HTML
 * 8. Risposta e header HTTP del server Express (Service-Worker-Allowed e MIME types)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const app = require('./src/app');

const FRONTEND_DIR = path.join(__dirname, '../hermae-frontend');
const MANIFEST_PATH = path.join(FRONTEND_DIR, 'manifest.json');
const SW_PATH = path.join(FRONTEND_DIR, 'service-worker.js');
const PWA_JS_PATH = path.join(FRONTEND_DIR, 'assets/js/pwa.js');
const OFFLINE_HTML_PATH = path.join(FRONTEND_DIR, 'offline.html');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    throw new Error(message);
  }
  passedTests++;
  console.log(`  -> OK: ${message}`);
}

async function runTests() {
  console.log('========================================================================');
  console.log(' COLLAUDO FASE 26: PROGRESSIVE WEB APP (PWA) & SERVICE WORKER');
  console.log('========================================================================\n');

  let server;
  let baseUrl;

  try {
    // Avvio del server HTTP di test su porta dinamica
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`[SETUP] Server di collaudo PWA avviato su ${baseUrl}\n`);
        resolve();
      });
    });

    // TEST 1: Esistenza e validazione W3C del manifest.json
    console.log('[TEST 1] Verifica esistenza e conformità W3C di manifest.json...');
    assert(fs.existsSync(MANIFEST_PATH), 'manifest.json esiste sul filesystem');
    const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(manifestContent);
    assert(manifest.name === 'Hermae — Il sapere, un libro alla volta', 'manifest.name contiene il nome e motto corretti');
    assert(manifest.short_name === 'Hermae', 'manifest.short_name impostato su "Hermae"');
    assert(manifest.display === 'standalone', 'manifest.display impostato su "standalone"');
    assert(manifest.start_url === '/dashboard.html', 'manifest.start_url configurato correttamente');
    assert(manifest.theme_color === '#1e3a8a', 'manifest.theme_color configurato con colore brand (#1e3a8a)');
    assert(manifest.background_color === '#0f172a', 'manifest.background_color configurato con colore dark (#0f172a)');
    assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'manifest.icons contiene almeno 3 icone');

    // TEST 2: Verifica icone dichiarate nel manifest
    console.log('\n[TEST 2] Verifica esistenza e integrità delle icone PWA dichiarate...');
    for (const icon of manifest.icons) {
      const iconPath = path.join(FRONTEND_DIR, icon.src);
      assert(fs.existsSync(iconPath), `Icona '${icon.src}' presente su filesystem`);
      const stat = fs.statSync(iconPath);
      assert(stat.size > 500, `Icona '${icon.src}' integra e non vuota (${stat.size} bytes)`);
    }

    // Verifica specifica icona maskable e apple-touch-icon
    const hasMaskable = manifest.icons.some(i => i.purpose && i.purpose.includes('maskable'));
    assert(hasMaskable, 'Presente icona con purpose "maskable" per launcher Android adattivi');
    const appleIconPath = path.join(FRONTEND_DIR, 'assets/img/apple-touch-icon.png');
    assert(fs.existsSync(appleIconPath), 'apple-touch-icon.png presente per dispositivi iOS Safari');

    // TEST 3: Verifica scorciatoie PWA (Shortcuts)
    console.log('\n[TEST 3] Verifica scorciatoie rapide (App Shortcuts)...');
    assert(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3, 'Configurate almeno 3 scorciatoie rapide');
    const shortcutNames = manifest.shortcuts.map(s => s.name);
    assert(shortcutNames.includes('La Mia Libreria'), 'Scorciatoia "La Mia Libreria" presente');
    assert(shortcutNames.includes('Mappa & Ricerca'), 'Scorciatoia "Mappa & Ricerca" presente');

    // TEST 4: Validazione sintattica del Service Worker (service-worker.js)
    console.log('\n[TEST 4] Verifica sintattica e struttura del Service Worker...');
    assert(fs.existsSync(SW_PATH), 'service-worker.js esiste sul filesystem');
    const swCode = fs.readFileSync(SW_PATH, 'utf8');
    // Verifica sintassi con Node vm.Script
    let syntaxOk = true;
    try {
      new vm.Script(swCode);
    } catch (e) {
      syntaxOk = false;
    }
    assert(syntaxOk, 'service-worker.js sintatticamente valido senza errori JS');

    // TEST 5: Verifica ciclo di vita e gestione cache del Service Worker
    console.log('\n[TEST 5] Verifica ciclo di vita del Service Worker (install, activate, fetch)...');
    assert(swCode.includes("addEventListener('install'"), 'Listener evento install presente');
    assert(swCode.includes("addEventListener('activate'"), 'Listener evento activate presente');
    assert(swCode.includes("addEventListener('fetch'"), 'Listener evento fetch presente');
    assert(swCode.includes('skipWaiting()'), 'Chiamata a skipWaiting() per attivazione immediata');
    assert(swCode.includes('clients.claim()'), 'Chiamata a clients.claim() per controllo immediato dei client');

    // TEST 6: Verifica strategia di Caching Ibrida
    console.log('\n[TEST 6] Verifica strategia di Caching Ibrida (Network First vs Cache First vs Network Only)...');
    assert(swCode.includes("pathname.startsWith('/api/')"), 'Bypass esplicito per chiamate REST /api/ (Network Only)');
    assert(swCode.includes("request.mode === 'navigate'") || swCode.includes("includes('text/html')"), 'Rilevamento navigazione HTML');
    assert(swCode.includes('offline.html'), 'Fallback esplicito a offline.html per navigazione offline');
    assert(swCode.includes('caches.match('), 'Utilizzo della cache locale per asset statici');

    // TEST 7: Verifica pagina offline di cortesia (offline.html)
    console.log('\n[TEST 7] Verifica accessibilità e completezza di offline.html...');
    assert(fs.existsSync(OFFLINE_HTML_PATH), 'offline.html esiste sul filesystem');
    const offlineHtml = fs.readFileSync(OFFLINE_HTML_PATH, 'utf8');
    assert(offlineHtml.includes('<!DOCTYPE html>'), 'offline.html ha DOCTYPE valido');
    assert(offlineHtml.includes('role="main"'), 'offline.html rispetta i landmark WCAG 2.1 AA');
    assert(offlineHtml.includes('window.location.reload()'), 'offline.html include pulsante/azione per riprovare connessione');
    assert(offlineHtml.includes("addEventListener('online'"), 'offline.html rileva automaticamente il ritorno online');

    // TEST 8: Verifica modulo client PWA (assets/js/pwa.js)
    console.log('\n[TEST 8] Verifica del modulo client PWA (assets/js/pwa.js)...');
    assert(fs.existsSync(PWA_JS_PATH), 'assets/js/pwa.js esiste sul filesystem');
    const pwaJsCode = fs.readFileSync(PWA_JS_PATH, 'utf8');
    let pwaSyntaxOk = true;
    try {
      new vm.Script(pwaJsCode);
    } catch (e) {
      pwaSyntaxOk = false;
    }
    assert(pwaSyntaxOk, 'assets/js/pwa.js sintatticamente valido');
    assert(pwaJsCode.includes('registerServiceWorker'), 'Metodo registerServiceWorker presente');
    assert(pwaJsCode.includes('beforeinstallprompt'), 'Gestione dell\'evento beforeinstallprompt per installazione');
    assert(pwaJsCode.includes('display-mode: standalone'), 'Rilevamento modalità standalone');
    assert(pwaJsCode.includes("addEventListener('online'") && pwaJsCode.includes("addEventListener('offline'"), 'Monitoraggio globale stato connettività di rete');

    // TEST 9: Verifica integrazione PWA su tutti i file HTML del frontend
    console.log('\n[TEST 9] Verifica inclusione meta tag e script PWA in tutti i file HTML...');
    const htmlFiles = fs.readdirSync(FRONTEND_DIR).filter(f => f.endsWith('.html'));
    assert(htmlFiles.length >= 10, `Trovati ${htmlFiles.length} file HTML nel frontend`);
    
    let allIncludedManifest = true;
    let allIncludedPwaJs = true;
    for (const file of htmlFiles) {
      const content = fs.readFileSync(path.join(FRONTEND_DIR, file), 'utf8');
      if (!content.includes('rel="manifest"')) {
        allIncludedManifest = false;
        console.warn(`Manca manifest in ${file}`);
      }
      if (!content.includes('assets/js/pwa.js') && file !== 'offline.html') {
        allIncludedPwaJs = false;
        console.warn(`Manca pwa.js in ${file}`);
      }
    }
    assert(allIncludedManifest, 'Tutti i file HTML includono <link rel="manifest" href="manifest.json">');
    assert(allIncludedPwaJs, 'Tutti i file HTML includono <script src="assets/js/pwa.js">');

    // TEST 10: Erogazione HTTP di manifest.json con header e MIME type corretti
    console.log('\n[TEST 10] Verifica erogazione HTTP di manifest.json...');
    const manifestRes = await fetch(`${baseUrl}/manifest.json`);
    assert(manifestRes.status === 200, 'GET /manifest.json risponde con HTTP 200 OK');
    const manifestContentType = manifestRes.headers.get('content-type');
    assert(manifestContentType.includes('json'), `Content-Type di manifest.json corretto: ${manifestContentType}`);
    const fetchedManifest = await manifestRes.json();
    assert(fetchedManifest.short_name === 'Hermae', 'Contenuto manifest erogato via HTTP corretto');

    // TEST 11: Erogazione HTTP di service-worker.js con header Service-Worker-Allowed
    console.log('\n[TEST 11] Verifica erogazione HTTP di service-worker.js e header di scope...');
    const swRes = await fetch(`${baseUrl}/service-worker.js`);
    assert(swRes.status === 200, 'GET /service-worker.js risponde con HTTP 200 OK');
    const swContentType = swRes.headers.get('content-type');
    assert(swContentType.includes('javascript'), `Content-Type di service-worker.js corretto: ${swContentType}`);
    const swAllowedHeader = swRes.headers.get('service-worker-allowed');
    assert(swAllowedHeader === '/', `Header Service-Worker-Allowed impostato su "/": ${swAllowedHeader}`);

    // TEST 12: Erogazione HTTP di offline.html
    console.log('\n[TEST 12] Verifica erogazione HTTP di offline.html...');
    const offlineRes = await fetch(`${baseUrl}/offline.html`);
    assert(offlineRes.status === 200, 'GET /offline.html risponde con HTTP 200 OK');
    const offlineText = await offlineRes.text();
    assert(offlineText.includes('Connessione a Internet Assente'), 'Contenuto di offline.html correttamente servito');

    // TEST 13: Erogazione HTTP delle icone PWA
    console.log('\n[TEST 13] Verifica erogazione HTTP delle icone PNG PWA...');
    const icon192Res = await fetch(`${baseUrl}/assets/img/icon-192x192.png`);
    assert(icon192Res.status === 200, 'GET /assets/img/icon-192x192.png risponde con HTTP 200 OK');
    assert(icon192Res.headers.get('content-type').includes('image/png'), 'Content-Type icon-192x192.png corretto');

    const icon512Res = await fetch(`${baseUrl}/assets/img/icon-512x512.png`);
    assert(icon512Res.status === 200, 'GET /assets/img/icon-512x512.png risponde con HTTP 200 OK');

    const iconMaskableRes = await fetch(`${baseUrl}/assets/img/icon-maskable-512x512.png`);
    assert(iconMaskableRes.status === 200, 'GET /assets/img/icon-maskable-512x512.png risponde con HTTP 200 OK');

    // TEST 14: Verifica conformità requisiti PWA installabili Lighthouse / Chromium
    console.log('\n[TEST 14] Verifica criteri di installabilità PWA (Lighthouse / Chromium)...');
    assert(manifest.icons.some(i => i.sizes === '192x192'), 'Icona 192x192 presente per requisiti Chromium');
    assert(manifest.icons.some(i => i.sizes === '512x512'), 'Icona 512x512 presente per requisiti Chromium');
    assert(manifest.start_url && manifest.display && manifest.name, 'start_url, display e name presenti');
    assert(swCode.includes("addEventListener('fetch'"), 'Service worker con fetch handler presente');

    console.log('\n========================================================================');
    console.log(` ESITO FINALE COLLAUDO FASE 26: ${passedTests}/${totalTests} TEST SUPERATI (100% SUCCESS)`);
    console.log('========================================================================\n');

  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ ERRORE DURANTE IL COLLAUDO FASE 26:', err);
  process.exit(1);
});
