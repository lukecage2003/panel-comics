const { execFile } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const targetUrl = 'file:///C:/Users/tadeo/.gemini/antigravity/scratch/panel-comics/index.html';

console.log('--- SUITE DE TESTS COMPLÈTE & AUTOMATISÉE DE PANEL ---');
console.log('Lancement du navigateur Microsoft Edge Headless...');

const tempUserDataDir = path.join(__dirname, '.edge-test-profile');
if (!fs.existsSync(tempUserDataDir)) {
  fs.mkdirSync(tempUserDataDir, { recursive: true });
}

const proc = execFile(edgePath, [
  '--headless',
  '--disable-gpu',
  `--user-data-dir=${tempUserDataDir}`,
  '--remote-debugging-port=9224',
  '--allow-file-access-from-files',
  targetUrl
]);

const killEdge = () => {
  // Edge relance ses processus en arrière-plan : on arrête tous ceux qui utilisent CE profil de test (et seulement eux)
  try { proc.kill(); } catch (_) {}
  try {
    const ps = "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -match [regex]::Escape('" + tempUserDataDir.replace(/'/g, "''") + "') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
    require('child_process').execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore', timeout: 15000 });
  } catch (_) {}
};
// Garde-fou global : un test bloqué ne doit jamais laisser Edge tourner indéfiniment
const globalTimer = setTimeout(() => {
  console.error('✗ Délai global dépassé (180 s) — arrêt.');
  killEdge();
  process.exit(1);
}, 180000);

// Attente active du port CDP (au lieu d'un délai fixe fragile)
const waitForCdp = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetchJson('http://127.0.0.1:9224/json/list');
      if (list.some(t => t.url.includes('index.html'))) return list;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Edge n\'a pas exposé le port CDP 9224 à temps');
};

(async () => {
  try {
    const listRes = await waitForCdp();
    console.log('Onglets ouverts dans Edge:', listRes.length);
    const target = listRes.find(t => t.url.includes('index.html')) || listRes[0];

    const ws = new WebSocket(target.webSocketDebuggerUrl);

    ws.onopen = async () => {
      console.log('Connecté au protocole CDP de Microsoft Edge');
      let id = 1;
      const send = (method, params = {}) => new Promise(res => {
        const curId = id++;
        const handler = event => {
          const parsed = JSON.parse(event.data);
          if (parsed.id === curId) {
            ws.removeEventListener('message', handler);
            res(parsed.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });

      await send('Runtime.enable');

      // Attendre que l'application soit initialisée (window.Panel exposé)
      for (let i = 0; i < 40; i++) {
        const ready = await send('Runtime.evaluate', { expression: '!!(window.Panel && document.readyState === "complete")', returnByValue: true });
        if (ready && ready.result && ready.result.value) break;
        await new Promise(r => setTimeout(r, 250));
      }

      ws.addEventListener('message', event => {
        const d = JSON.parse(event.data);
        if (d.method === 'Runtime.exceptionThrown') {
          console.error('[Browser Exception]', d.params.exceptionDetails.text, d.params.exceptionDetails.exception?.description);
        }
      });

      const evalExpr = async expr => {
        const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (res.exceptionDetails) {
          console.error('Eval Error:', res.exceptionDetails);
        }
        return res.result ? res.result.value : res;
      };

      const testResults = [];

      // ==========================================
      // TEST 1 : Initialisation & Intégrité DOM
      // ==========================================
      console.log('\n[TEST 1] Intégrité de l’application & Composants UI...');
      const initErrors = await evalExpr(`window.__panel_init_errors || []`);
      console.log('Erreurs au chargement du script:', initErrors);

      const t1 = await evalExpr(`(() => {
        return {
          title: document.title,
          hasUpcScanner: !!document.getElementById('barcodeScannerModal'),
          hasCoverVisualScanner: !!document.getElementById('coverVisualScannerModal'),
          hasGlobalSearch: !!document.getElementById('globalSearch'),
          hasBoxFilter: !!document.getElementById('boxFilterSelect'),
          hasDuplicateWarning: !!document.getElementById('duplicateWarningBox'),
          noUnusedSecretFields: !document.getElementById('settingVisionApiKey') && !document.getElementById('settingMarvelPrivKey')
        };
      })()`);
      console.log('Résultat Test 1:', t1);
      testResults.push({ test: 'Intégrité DOM', ok: t1 && t1.hasUpcScanner && t1.hasCoverVisualScanner && t1.hasBoxFilter && t1.hasDuplicateWarning && t1.noUnusedSecretFields });

      // ==========================================
      // TEST 2 : Scanner UPC - Décodage & Normalisation
      // ==========================================
      console.log('\n[TEST 2] Scanner UPC (Code valide 17 chiffres, ISBN, Code inconnu)...');
      const t2 = await evalExpr(`(() => {
        const p1 = window.Panel.parseComicBarcode('75960608936400111'); // Thor 2018 #1 Variant 1
        const p2 = window.Panel.parseComicBarcode('9782809490001'); // ISBN Panini/Urban
        const p3 = window.Panel.parseComicBarcode('123456789012'); // Inconnu
        return {
          directMarket: { raw: p1.raw, issue: p1.issueNum, pub: p1.publisher, variant: p1.variantName },
          isbn: { isIsbn: p2.isIsbn, pub: p2.publisher },
          unknown: { raw: p3.raw, seriesGuess: p3.seriesGuess, pub: p3.publisher }
        };
      })()`);
      console.log('Résultat Test 2:', t2);
      testResults.push({ test: 'Décodage UPC & ISBN', ok: t2 && t2.directMarket.issue === '1' && t2.isbn.isIsbn && t2.unknown.seriesGuess === '' });

      // ==========================================
      // TEST 3 : Scanner UPC - Cycle de vie & Fermeture/Réouverture
      // ==========================================
      console.log('\n[TEST 3] Scanner UPC - Ouverture et Arrêt sécurisé...');
      const t3 = await evalExpr(`(async () => {
        const modal = document.getElementById('barcodeScannerModal');
        document.getElementById('openScannerBtn').click();
        const opened = modal.classList.contains('open');
        await window.Panel.stopBarcodeScanner();
        const closed = !modal.classList.contains('open');
        // Réouverture immédiate
        document.getElementById('openScannerBtn').click();
        const reopened = modal.classList.contains('open');
        await window.Panel.stopBarcodeScanner();
        return { opened, closed, reopened };
      })()`);
      console.log('Résultat Test 3:', t3);
      testResults.push({ test: 'Cycle de vie Scanner UPC', ok: t3 && t3.opened && t3.closed && t3.reopened });

      // ==========================================
      // TEST 4 : Moteur de Reconnaissance Visuelle (dHash 64-bit & similarité)
      // ==========================================
      console.log('\n[TEST 4] Reconnaissance Visuelle - Algorithme dHash & Similarité...');
      const t4 = await evalExpr(`(() => {
        // Canvas A : image test rouge
        const cA = document.createElement('canvas');
        cA.width = 64; cA.height = 96;
        const ctxA = cA.getContext('2d');
        ctxA.fillStyle = '#ff0000';
        ctxA.fillRect(0, 0, 64, 48);
        ctxA.fillStyle = '#0000ff';
        ctxA.fillRect(0, 48, 64, 48);

        // Canvas B : identique (doit donner ~99%)
        const cB = document.createElement('canvas');
        cB.width = 64; cB.height = 96;
        const ctxB = cB.getContext('2d');
        ctxB.drawImage(cA, 0, 0);

        // Canvas C : motif texturé contrasté (rayures alternées)
        const cC = document.createElement('canvas');
        cC.width = 64; cC.height = 96;
        const ctxC = cC.getContext('2d');
        ctxC.fillStyle = '#000000';
        ctxC.fillRect(0, 0, 64, 96);
        ctxC.fillStyle = '#ffffff';
        for (let x = 0; x < 64; x += 4) {
          ctxC.fillRect(x, 0, 2, 96);
        }

        const hashA = window.Panel.computeCanvasDHash(cA);
        const hashB = window.Panel.computeCanvasDHash(cB);
        const hashC = window.Panel.computeCanvasDHash(cC);

        const profA = window.Panel.computeCanvasColorProfile(cA);
        const profB = window.Panel.computeCanvasColorProfile(cB);
        const profC = window.Panel.computeCanvasColorProfile(cC);

        const scoreIdentical = window.Panel.calculateVisualSimilarity(hashA, hashB, profA, profB);
        const scoreDiff = window.Panel.calculateVisualSimilarity(hashA, hashC, profA, profC);

        return {
          hashLength: hashA.length,
          scoreIdentical,
          scoreDiff,
          isDHash64Bit: hashA.length === 64
        };
      })()`);
      console.log('Résultat Test 4:', t4);
      testResults.push({ test: 'Algorithme dHash 64-bit', ok: t4 && t4.isDHash64Bit && t4.scoreIdentical >= 95 && t4.scoreDiff < 60 });

      // ==========================================
      // TEST 5 : Modale Reconnaissance Visuelle - Ouverture et fermeture
      // ==========================================
      console.log('\n[TEST 5] Modale Reconnaissance Visuelle (Ouverture, Rotation, Reset)...');
      const t5 = await evalExpr(`(() => {
        window.Panel.openCoverVisualScanner();
        const modal = document.getElementById('coverVisualScannerModal');
        const isOpen = modal.classList.contains('open');
        window.Panel.rotateCoverAnalysisCanvas(); // ne plante pas si vide
        window.Panel.closeCoverVisualScanner();
        const isClosed = !modal.classList.contains('open');
        return { isOpen, isClosed };
      })()`);
      console.log('Résultat Test 5:', t5);
      testResults.push({ test: 'Modale Reconnaissance Visuelle', ok: t5 && t5.isOpen && t5.isClosed });

      // ==========================================
      // TEST 6 : Détection des Doublons & Hiérarchie des Boîtes
      // ==========================================
      console.log('\n[TEST 6] Hiérarchie des Boîtes & Détection de Doublons...');
      const t6 = await evalExpr(`(async () => {
        // Préparer un single de test dans Short Box 1
        window.Panel.setPhysicalSingles([
          {
            id: 'test_spawn_300',
            series: 'Spawn',
            issue: '#300',
            publisher: 'Image Comics',
            variant: 'Cover A',
            condition: 'NM 9.4',
            coverPrice: 3.99,
            estValue: 35.00,
            box: 'Short Box Image 1',
            divider: 'Spawn',
            location: 'Short Box Image 1 · Spawn',
            coverUrl: 'https://static.wikia.nocookie.net/marveldatabase/images/d/de/Ultimate_Spider-Man_Vol_1_1.jpg',
            addedAt: new Date().toISOString()
          }
        ]);

        // Tenter d'ajouter exactement le même exemplaire
        document.getElementById('singleSeriesInput').value = 'Spawn';
        document.getElementById('singleIssueInput').value = '#300';
        document.getElementById('singleVariantNameInput').value = 'Cover A';
        document.getElementById('singleBoxInput').value = 'Short Box Image 1';
        document.getElementById('singleDividerInput').value = 'Spawn';

        await window.Panel.saveSingleIssue();
        const warnBox = document.getElementById('duplicateWarningBox');
        const dupDetected = warnBox && warnBox.style.display === 'block';

        // Valider l'ajout comme double
        if (dupDetected) {
          document.getElementById('dupKeepBothBtn').click();
        }
        const totalAfterDouble = window.Panel.getPhysicalSingles().length;

        // Tester le filtrage par boîte
        const boxSelect = document.getElementById('boxFilterSelect');
        boxSelect.value = 'Short Box Image 1';
        boxSelect.dispatchEvent(new Event('change', { bubbles: true }));

        return {
          dupDetected,
          totalAfterDouble,
          boxesCount: document.getElementById('boxFilterSelect').options.length
        };
      })()`);
      console.log('Résultat Test 6:', t6);
      testResults.push({ test: 'Hiérarchie Boîtes & Doublons', ok: t6.dupDetected && t6.totalAfterDouble === 2 && t6.boxesCount >= 2 });

      // ==========================================
      // TEST 7 : Recherche Globale (⌘K) & Comic Vine Direct
      // ==========================================
      console.log('\n[TEST 7] Recherche Globale (⌘K) et Menu Déroulant...');
      const t7 = await evalExpr(`(() => {
        const input = document.getElementById('globalSearch');
        const menu = document.getElementById('searchResultsMenu');
        input.value = 'Batman';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const menuVisible = !menu.hidden;
        const menuHasComicVine = menu.innerHTML.includes('Comic Vine');

        // Test Enter ouvre Comic Vine Modal
        const keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        input.dispatchEvent(keyEvent);
        const cvModalOpen = document.getElementById('comicVineSearchModal').classList.contains('open');
        document.getElementById('closeComicVineModalBtn').click();

        return { menuVisible, menuHasComicVine, cvModalOpen };
      })()`);
      console.log('Résultat Test 7:', t7);
      testResults.push({ test: 'Recherche Globale & Comic Vine', ok: t7.menuVisible && t7.menuHasComicVine && t7.cvModalOpen });

      // ==========================================
      // TEST 8 : Retrait du numérique — interface absente, données conservées intactes, archive ZIP
      // ==========================================
      console.log('\n[TEST 8] Retrait du numérique (interface absente, données conservées, archive ZIP)...');
      const t8 = await evalExpr(`(async () => {
        const P = window.Panel;
        const r = {};
        // Interface : plus de lecteur, de bibliothèque numérique ni de bouton « Lire »
        const absent = ['readerModal', 'importModal', 'digitalViewSection', 'navDigitalBlock', 'switchDigital', 'inspectReadBtn', 'mobAll', 'folderModal'];
        r.uiRemoved = absent.every(id => !document.getElementById(id)) && !document.querySelector('[data-read], [data-read-cv]') && !window.pdfjsLib && !P.openReader && !P.importDigitalFiles;
        r.collectionHome = !document.getElementById('singlesViewSection').hidden && document.querySelectorAll('.mobile-dock-btn').length === 4;
        // Données numériques existantes : une fiche IndexedDB « pages » + des clés localStorage de test
        const KEYS = ['panel_folders', 'panel_bookmarks', 'panel_theories', 'panel_reading_positions', 'panel_comic_notes', 'panel_comic_annotations'];
        const saved = {};
        KEYS.forEach(k => { saved[k] = localStorage.getItem(k); });
        const seed = { panel_bookmarks: '[{"id":"bk-t8","comicId":"t8-rec","page":3}]', panel_reading_positions: '{"t8-rec":3}', panel_comic_notes: '[{"id":"n-t8","comicId":"t8-rec","body":"note"}]' };
        Object.entries(seed).forEach(([k, v]) => localStorage.setItem(k, v));
        const db = await new Promise(res => { const q = indexedDB.open('panel-library', 3); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
        const tx = (mode, fn) => new Promise(res => { const t = db.transaction('pages', mode); const out = fn(t.objectStore('pages')); t.oncomplete = () => res(out && out.result); t.onerror = () => res(null); });
        await tx('readwrite', st => st.put({ id: 't8-rec', name: 'Test Comic 001.cbz', seriesTitle: 'Test Comic', issueLabel: '#1', file: new Blob(['PK-test-contenu'], { type: 'application/zip' }) }));
        const countBefore = await tx('readonly', st => st.count());
        const snapBefore = KEYS.map(k => localStorage.getItem(k)).join('|');
        // Actions courantes de l'app : vérification, rendu de la collection, rafraîchissement des boutons
        P.checkDataIntegrity && P.checkDataIntegrity();
        document.getElementById('mobSeries').click();
        document.getElementById('mobSingles').click();
        await new Promise(res => setTimeout(res, 300));
        r.dataPreserved = (await tx('readonly', st => st.count())) === countBefore && KEYS.map(k => localStorage.getItem(k)).join('|') === snapBefore;
        r.inBackup = JSON.stringify(P.readStoredDigitalData().bookmarks) === seed.panel_bookmarks && P.readStoredDigitalData().readingPositions['t8-rec'] === 3;
        // Archive ZIP des fichiers conservés
        const arc = await P.exportStoredDigitalArchive({ download: false });
        const zip = arc && await JSZip.loadAsync(arc.blob);
        const meta = zip && JSON.parse(await zip.file('donnees-numeriques.json').async('string'));
        r.archive = !!zip && !!zip.file('fichiers/Test Comic 001.cbz') && (await zip.file('fichiers/Test Comic 001.cbz').async('string')) === 'PK-test-contenu' && meta.files.some(x => x.id === 't8-rec' && !('file' in x)) && meta.comicNotes[0].id === 'n-t8';
        r.archiveReadOnly = (await tx('readonly', st => st.count())) === countBefore;
        await new Promise(res => setTimeout(res, 50));
        r.buttonShown = [...document.querySelectorAll('.digital-archive-btn')].length === 2;
        // Nettoyage : uniquement la fiche et les valeurs créées par ce test
        await tx('readwrite', st => st.delete('t8-rec'));
        KEYS.forEach(k => { if (saved[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, saved[k]); });
        db.close();
        return r;
      })()`);
      console.log('Résultat Test 8:', t8);
      testResults.push({
        test: 'Numérique retiré de l’interface, données numériques conservées et exportables',
        ok: !!t8 && ['uiRemoved', 'collectionHome', 'dataPreserved', 'inBackup', 'archive', 'archiveReadOnly', 'buttonShown'].every(k => t8[k] === true)
      });

      // ==========================================
      // TEST 10 : Collector Pro — valeurs, wishlist, sécurité
      // ==========================================
      console.log('\n[TEST 10] Collector Pro (stats possédés vs wishlist, échappement HTML, CSV, import)...');
      const t10 = await evalExpr(`(() => {
        window.__xss = false;
        const base = { publisher: 'DC Comics', variant: 'Cover A', keyType: 'none', condition: 'NM 9.4 (Near Mint)', box: 'Short Box T', isProtected: true, coverUrl: '' };
        window.Panel.setPhysicalSingles([
          { ...base, id: 't1', series: 'Absolute Batman', issue: '#1', coverPrice: 4.99, purchasePrice: 5, estValue: 40, addedAt: new Date().toISOString() },
          { ...base, id: 't2', series: 'Absolute Batman', issue: '#3', coverPrice: 4.99, estValue: 6, addedAt: new Date().toISOString() },
          { ...base, id: 't3', series: 'Absolute Batman', issue: '#2', estValue: 500, isWishlist: true, addedAt: new Date().toISOString() },
          { ...base, id: 't4', series: '<img src=x onerror="window.__xss=true">', issue: '#1', variant: '<b>v</b>', coverUrl: 'javascript:alert(1)', addedAt: new Date().toISOString() }
        ]);
        window.Panel.showSinglesView('collection');
        const ownedCount = document.getElementById('statSinglesCount').textContent;
        const valueText = document.getElementById('statSinglesValue').textContent;
        const wishCount = document.getElementById('statSinglesWishlist').textContent;
        const gridHtml = document.getElementById('singlesGrid').innerHTML;
        const escaped = !gridHtml.includes('<img src=x') && gridHtml.includes('&lt;img src=x');
        const noJsUrl = !gridHtml.includes('javascript:');
        const imported = window.Panel.sanitizeImportedSingle({ series: 'X', coverUrl: 'javascript:alert(1)', rating: 99, keyType: 'evil' });
        const badImport = window.Panel.sanitizeImportedSingle({ issue: '#1' });
        return {
          ownedCount, valueText, wishCount, escaped, noJsUrl,
          xssFired: window.__xss,
          wishHiddenFromCollection: !gridHtml.includes('t3'),
          importSanitized: imported.coverUrl === '' && imported.rating === 5 && imported.keyType === 'none' && badImport === null
        };
      })()`);
      await new Promise(r => setTimeout(r, 300));
      const xssLate = await evalExpr('window.__xss');
      console.log('Résultat Test 10:', t10, 'xssLate:', xssLate);
      testResults.push({
        test: 'Collector Pro : valeurs, wishlist exclue, anti-XSS, import sûr',
        // 3 possédés (t1, t2, t4) ; valeur = 40 + 6 + 0 = 46 (la wishlist à 500 $ n'est pas comptée)
        ok: t10 && t10.ownedCount === '3' && t10.valueText === '$46.00' && t10.wishCount === '1' && t10.escaped && t10.noJsUrl && !t10.xssFired && !xssLate && t10.importSanitized
      });

      // ==========================================
      // TEST 11 : Séries & complétion, pull list, sorties, stats, annulation
      // ==========================================
      console.log('\n[TEST 11] Séries & complétion, pull list, sorties, statistiques, annulation...');
      const t11 = await evalExpr(`(() => {
        const base = { publisher: 'Image Comics', variant: 'Cover A', keyType: 'none', condition: 'NM 9.4 (Near Mint)', box: 'Short Box T', coverUrl: '', addedAt: new Date().toISOString() };
        window.Panel.setPhysicalSingles([1, 2, 4, 7].map(n => ({ ...base, id: 'inv' + n, series: 'Invincible', issue: '#' + n, estValue: 10 })));
        const g = window.Panel.buildSeriesIndex().find(x => x.key === 'invincible');
        const missingOk = g && JSON.stringify(g.missing) === JSON.stringify([3, 5, 6]) && g.completion === 57;

        // Numérotation legacy : #1, #2 et un #450 isolé ne doivent pas créer 447 « manquants »
        const savedList = window.Panel.getPhysicalSingles().slice();
        window.Panel.setPhysicalSingles([1, 2, 450].map(n => ({ ...base, id: 'ds' + n, series: 'Doctor Strange (2025)', issue: '#' + n })));
        const ds = window.Panel.buildSeriesIndex()[0];
        const legacyOk = ds.missing.length === 0 && JSON.stringify(ds.outliers) === '[450]' && ds.isRun === false;
        window.Panel.setPhysicalSingles(savedList);

        // Vue Séries : clic sur un numéro manquant -> ajout en wishlist
        window.Panel.showSinglesView('series');
        document.querySelector('.series-track-card[data-key="invincible"]').click();
        document.querySelector('.issue-chip[data-n="3"]').click();
        const wishAdded = window.Panel.getPhysicalSingles().some(s => s.issue === '#3' && s.isWishlist);
        const chipNowWish = document.querySelector('.issue-chip[data-n="3"]').classList.contains('wish');

        // Pull list + sorties (données simulées, sans réseau)
        window.Panel.togglePull('Invincible', true);
        window.Panel.showSinglesView('releases');
        window.Panel.setReleasesForTest([
          { id: 1, volume: 'Invincible', issue: '8', title: '', cover: '', storeDate: '2026-11-04' },
          { id: 2, volume: 'Some Other Book', issue: '1', title: '', cover: '', storeDate: '2026-11-04' }
        ]);
        document.getElementById('releasesPullOnly').checked = true;
        window.Panel.renderReleasesGrid();
        const cards = document.querySelectorAll('#releasesGrid .release-card');
        const pullFiltered = cards.length === 1 && cards[0].classList.contains('pulled');
        cards[0].querySelector('[data-buy]').click();
        const bought = window.Panel.getPhysicalSingles().some(s => s.series === 'Invincible' && s.issue === '#8' && !s.isWishlist);
        document.getElementById('releasesPullOnly').checked = false;

        // Statistiques
        window.Panel.showSinglesView('stats');
        const statsCards = document.querySelectorAll('#statsDashboard .stats-card').length;

        // Suppression avec annulation
        const before = window.Panel.getPhysicalSingles().length;
        window.Panel.removeSingleWithUndo(window.Panel.getPhysicalSingles().find(s => s.id === 'inv1'));
        const afterDelete = window.Panel.getPhysicalSingles().length;
        const undoBtn = document.querySelector('#toastPopup .toast-action');
        if (undoBtn) undoBtn.click();
        const afterUndo = window.Panel.getPhysicalSingles().length;

        // Vue liste
        window.Panel.showSinglesView('collection');
        document.getElementById('singlesViewModeBtn').click();
        const listMode = document.getElementById('singlesGrid').classList.contains('singles-list') && document.querySelectorAll('#singlesGrid .single-row').length > 1;
        document.getElementById('singlesViewModeBtn').click();

        // Persistance miroir
        const persisted = JSON.parse(localStorage.getItem('panel_physical_singles')).length === afterUndo;

        return { missingOk, legacyOk, wishAdded, chipNowWish, pullFiltered, bought, statsCards, before, afterDelete, afterUndo, listMode, persisted };
      })()`);
      console.log('Résultat Test 11:', t11);
      testResults.push({
        test: 'Séries & complétion, pull list, sorties, stats, annulation, vue liste',
        ok: t11 && t11.missingOk && t11.legacyOk && t11.wishAdded && t11.chipNowWish && t11.pullFiltered && t11.bought && t11.statsCards >= 6 &&
          t11.afterDelete === t11.before - 1 && t11.afterUndo === t11.before && t11.listMode && t11.persisted
      });

      // ==========================================
      // TEST 12 : Cote automatique (moteur, priorités manuel/marché, historique, recalcul)
      // ==========================================
      console.log('\n[TEST 12] Cote automatique (estimation, sources, historique, recalcul global)...');
      const t12 = await evalExpr(`(async () => {
        const P = window.Panel;
        const est = o => P.estimateComicValue({ series: 'Test Book', issue: '#5', variant: 'Cover A', keyType: 'none', condition: 'NM 9.4 (Near Mint)', coverPrice: 4.99, coverYear: 2024, ...o }).value;
        const regular = est({});
        const nm98 = est({ condition: 'NM/M 9.8' });
        const fn6 = est({ condition: 'FN 6.0 (Fine)' });
        const cgc98 = est({ condition: 'CGC 9.8 (Certifié)' });
        const ratio25 = est({ variant: 'Variant 1:25 Artgerm' });
        const ratio100 = est({ variant: '1:100 Virgin' });
        const bronzeKey = est({ keyType: 'major', coverYear: 1974, coverPrice: 0.25 });
        const bronzeReg = est({ coverYear: 1974, coverPrice: 0.25 });
        const detected = P.estimateComicValue({ series: 'Amazing Spider-Man', issue: '#300', condition: 'NM 9.4', coverYear: 1988 });
        const detectedKey = detected.factors.some(f => /Key issue majeure/.test(f.label));

        // Priorités : la cote auto ne remplace jamais une valeur saisie ni une cote marché
        const base = { publisher: 'Marvel', variant: 'Cover A', keyType: 'none', condition: 'NM 9.4 (Near Mint)', coverPrice: 3.99, coverYear: 2023, box: 'B', coverUrl: '', addedAt: new Date().toISOString() };
        P.setPhysicalSingles([
          { ...base, id: 'v_auto', series: 'Alpha', issue: '#2', estValue: null },
          { ...base, id: 'v_manual', series: 'Beta', issue: '#2', estValue: 77, valueSource: 'manual' },
          { ...base, id: 'v_market', series: 'Gamma', issue: '#2', estValue: 12 }
        ]);
        const mk = P.getPhysicalSingles().find(s => s.id === 'v_market');
        P.recordMarketValue(mk, 123.45, 'eBay vendu');
        const res = await P.revalueCollection({ fetchYears: false });
        const list = P.getPhysicalSingles();
        const a = list.find(s => s.id === 'v_auto'), m = list.find(s => s.id === 'v_manual'), k = list.find(s => s.id === 'v_market');

        // Enregistrement via le formulaire avec valeur vide => cote auto immédiate
        document.getElementById('addSingleModalOpenBtn').click();
        document.getElementById('singleSeriesInput').value = 'Delta Test';
        document.getElementById('singleIssueInput').value = '#1';
        document.getElementById('singleConditionSelect').value = 'CGC 9.8 (Certifié)';
        document.getElementById('singleEstValueInput').value = '';
        document.getElementById('singleYearInput').value = '2025';
        await P.saveSingleIssue();
        const saved = P.getPhysicalSingles().find(s => s.series === 'Delta Test');

        // Inspecteur : lien eBay ventes terminées + détail du calcul
        P.showSinglesView('collection');
        document.querySelector('#singlesGrid .comic-card').click();
        const ebayHref = document.getElementById('inspectEbayLink').href;
        const factorsShown = document.querySelectorAll('#inspectValueFactorsList li').length;
        document.getElementById('closeInspectorModalBtn').click();

        return {
          regular, nm98, fn6, cgc98, ratio25, ratio100, bronzeKey, bronzeReg, detectedKey,
          autoOk: a.valueSource === 'auto' && a.estValue > 0 && a.valueHistory.length >= 1,
          manualKept: m.estValue === 77 && m.valueSource === 'manual',
          marketKept: k.estValue === 123.45 && k.valueSource === 'market' && k.valueHistory.some(h => h.source === 'market'),
          revalueCount: res && res.count,
          savedAuto: !!saved && saved.valueSource === 'auto' && saved.estValue >= 35 && saved.coverYear === 2025,
          ebaySold: /ebay\\.com\\/sch\\/i\\.html\\?_nkw=.*LH_Sold=1/.test(ebayHref),
          factorsShown,
          snapshots: P.getValueSnapshots().length >= 1
        };
      })()`);
      console.log('Résultat Test 12:', t12);
      testResults.push({
        test: 'Cote automatique (estimation, priorités manuel/marché, historique, recalcul)',
        ok: t12 && Math.abs(t12.regular - 4.99) < 0.01 && t12.nm98 > t12.regular && t12.fn6 < t12.regular && t12.cgc98 >= 35 &&
          t12.ratio25 > 30 && t12.ratio100 > t12.ratio25 && t12.bronzeKey > t12.bronzeReg * 10 && t12.detectedKey &&
          t12.autoOk && t12.manualKept && t12.marketKept && t12.revalueCount === 1 && t12.savedAuto && t12.ebaySold && t12.factorsShown >= 2 && t12.snapshots
      });

      // ==========================================
      // TEST 13 : Import CSV CLZ / League of Comic Geeks / tableur FR
      // ==========================================
      console.log('\n[TEST 13] Import CSV (CLZ, League of Comic Geeks, tableur français, assistant)...');
      const clzCsv = '﻿Series,Issue,Variant Description,Publisher,Release Date,Grade,Grading Company,Purchase Price,Purchase Date,Storage Box,Signed by,Notes,Quantity,Collection Status\r\n' +
        'Amazing Spider-Man,300,,Marvel Comics,"May 01, 1988",9.8,CGC,"$1,250.00","Oct 09, 2024",Long Box Keys,,"1st Venom, full",1,In Collection\r\n' +
        '"Batman, Vol. 3",50,"Variant 1:25 Lee",DC,2018-07-04,NM,,$24.99,0000-00-00,Short Box 2,Tom King,,2,In Collection\r\n' +
        'Saga,1,,Image,2012-03-14,VF+ 8.5,,$40.00,,,,,1,Sold\r\n' +
        'Absolute Batman,1,,DC Comics,2024-10-09,,,,,,,,1,Wish List\r\n';
      const locgCsv = 'Series,Issue,Publisher,Date,Price Paid,Grade,Read,Rating\n' +
        'Transformers,1,Image Comics,10/04/2023,4.99,9.4,Yes,5\n' +
        'Ultimate Spider-Man,1,Marvel Comics,01/10/2024,5.99,,No,\n';
      const frCsv = 'Série;Numéro;Éditeur;Prix payé;Date achat;Lu;Boîte\n' +
        'Invincible;12;Image;12,50 €;25/03/2023;oui;Boîte A\n';
      const t13 = await evalExpr(`(() => {
        const P = window.Panel;
        P.setPhysicalSingles([]);
        const clz = P.importCsvText(${JSON.stringify(clzCsv)});
        const L = P.getPhysicalSingles();
        const asm = L.find(s => s.series === 'Amazing Spider-Man');
        const bats = L.filter(s => s.series === 'Batman, Vol. 3');
        const wish = L.find(s => s.series === 'Absolute Batman');
        const sagaSkipped = !L.some(s => s.series === 'Saga');

        const locg = P.importCsvText(${JSON.stringify(locgCsv)});
        const tf = P.getPhysicalSingles().find(s => s.series === 'Transformers');
        const usm = P.getPhysicalSingles().find(s => s.series === 'Ultimate Spider-Man');

        const fr = P.importCsvText(${JSON.stringify(frCsv)});
        const inv = P.getPhysicalSingles().find(s => s.series === 'Invincible');

        // Ré-import : les doublons sont ignorés
        const again = P.importCsvText(${JSON.stringify(locgCsv)});

        // Assistant : chargement, correspondance, import, annulation
        const before = P.getPhysicalSingles().length;
        P.openCsvImportModal();
        P.loadCsvTextIntoWizard('Title,Grade,Paid\\n"Hulk #181",FN 6.0,300\\n"Saga #2",9.6,4\\n', 'test.csv');
        const mappedTitle = document.querySelector('#csvImportMapping select[data-field="fullTitle"]').value === '0';
        const previewRows = document.querySelectorAll('#csvImportPreview tbody tr').length;
        document.getElementById('csvImportConfirmBtn').click();
        const afterWizard = P.getPhysicalSingles().length;
        const hulk = P.getPhysicalSingles().find(s => s.series === 'Hulk');
        const undo = document.querySelector('#toastPopup .toast-action');
        if (undo) undo.click();
        const afterUndo = P.getPhysicalSingles().length;

        return {
          clzSource: clz.source, clzAdded: clz.added, clzSkipped: clz.skipped.length,
          asm: asm && { cond: asm.condition, paid: asm.purchasePrice, date: asm.purchaseDate, year: asm.coverYear, box: asm.box, pub: asm.publisher, notes: asm.notes },
          batsCount: bats.length, batsKey: bats[0] && bats[0].keyType, batsCond: bats[0] && bats[0].condition, batsPub: bats[0] && bats[0].publisher, batsPurchaseDate: bats[0] && bats[0].purchaseDate,
          wishOk: !!wish && wish.isWishlist, sagaSkipped,
          locgSource: locg.source, tf: tf && { read: tf.isRead, rating: tf.rating, paid: tf.purchasePrice, year: tf.coverYear, auto: tf.valueSource }, usmRead: usm && usm.isRead,
          frDelim: fr.delimiter, inv: inv && { paid: inv.purchasePrice, date: inv.purchaseDate, read: inv.isRead, box: inv.box, pub: inv.publisher },
          againAdded: again.added, againDup: again.duplicates,
          mappedTitle, previewRows, wizardAdded: afterWizard - before, hulkIssue: hulk && hulk.issue, afterUndo, before
        };
      })()`);
      console.log('Résultat Test 13:', JSON.stringify(t13, null, 1));
      testResults.push({
        test: 'Import CSV CLZ / League of Comic Geeks / tableur FR (+ assistant, doublons, annulation)',
        ok: t13 && t13.clzSource === 'CLZ Comics' && t13.clzAdded === 4 && t13.clzSkipped === 1 &&
          t13.asm && t13.asm.cond === 'CGC 9.8 (Certifié)' && t13.asm.paid === 1250 && t13.asm.date === '2024-10-09' && t13.asm.year === 1988 && t13.asm.box === 'Long Box Keys' && t13.asm.pub === 'Marvel' &&
          t13.batsCount === 2 && t13.batsKey === 'signed' && t13.batsCond === 'NM 9.4 (Near Mint)' && t13.batsPub === 'DC Comics' && t13.batsPurchaseDate === '' &&
          t13.wishOk && t13.sagaSkipped &&
          t13.locgSource === 'League of Comic Geeks' && t13.tf && t13.tf.read === true && t13.tf.rating === 5 && t13.tf.paid === 4.99 && t13.tf.year === 2023 && t13.tf.auto === 'auto' && t13.usmRead === false &&
          t13.frDelim === ';' && t13.inv && t13.inv.paid === 12.5 && t13.inv.date === '2023-03-25' && t13.inv.read === true && t13.inv.box === 'Boîte A' && t13.inv.pub === 'Image Comics' &&
          t13.againAdded === 0 && t13.againDup === 2 &&
          t13.mappedTitle && t13.previewRows === 2 && t13.wizardAdded === 2 && t13.hulkIssue === '#181' && t13.afterUndo === t13.before
      });

      // ==========================================
      // TEST 14 : Export Excel League of Comic Geeks (.xlsx, structure réelle à 21 colonnes)
      // ==========================================
      console.log('\n[TEST 14] Export Excel League of Comic Geeks (.xlsx)...');
      const locgHeaders = ['Publisher Name', 'Series Name', 'Full Title', 'Release Date', 'In Collection', 'In Wish List', 'Marked Read', 'My Rating', 'Media Format',
        'Price Paid', 'Date Purchased', 'Condition', 'Notes', 'Tags', 'Storage Box', 'Owner', 'Purchase Store', 'Signature', 'Slabbing', 'Grading', 'Grading Company'];
      const L = (pub, series, full, date, col, wish, read, rating = '') => [pub, series, full, date, col, wish, read, rating, 'Print', '', '', '', '', '', '', '', '', '', '', '', ''];
      const locgRows = [
        L('DC Comics', 'Absolute Batman (2024 - Present)', 'Absolute Batman #1', '2024-10-09', '1', '0', '1', '4.5'),
        L('DC Comics', 'Absolute Batman (2024 - Present)', 'Absolute Batman #1 Cover J Jim Lee Foil Virgin Variant', '2024-10-09', '1', '0', '0'),
        L('DC Comics', 'Absolute Batman (2024 - Present)', 'Absolute Batman 2025 Annual #1', '2025-10-29', '1', '0', '1'),
        L('DC Comics', 'Absolute Batman (2025 - Present)', 'Absolute Batman Tome 1: Le Zoo HC', '2025-06-01', '1', '0', '1'),
        L('DC Comics', 'Batman (Vol. 3) (2016 - 2025)', 'Batman #1', '2016-06-15', '1', '0', '0'),
        L('DC Comics', 'Batman (Vol. 4) (2025 - Present)', 'Batman #1', '2025-09-03', '1', '0', '0'),
        L('Marvel Comics', 'The Amazing Spider-Man (Vol. 2) (1998 - 2013)', 'The Amazing Spider-Man #647 1:20 Steve McNiven Variant', '2010-11-24', '1', '0', '1', '3.0'),
        L('Marvel Comics', 'X-Men (2024 - Present)', 'X-Men #5', '2024-10-02', '0', '1', '0'),
        L('Marvel Comics', 'X-Men (2024 - Present)', 'X-Men #6', '2024-11-06', '0', '0', '1'),
        L('Image Comics', 'Invincible (2003 - 2018)', 'Invincible #1 Cover B 2026 Foil Edition', '2026-03-11', '1', '0', '1'),
        L('Image Comics', 'G.O.D.S. (2023 - 2024)', 'G.O.D.S. TP', '2024-06-01', '1', '0', '0')
      ];
      const t14 = await evalExpr(`(async () => {
        const P = window.Panel;
        if (!window.JSZip) return { error: 'JSZip indisponible' };
        const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const col = i => String.fromCharCode(65 + i);
        const headers = ${JSON.stringify(locgHeaders)};
        const rows = ${JSON.stringify(locgRows)};
        const xmlRows = [headers, ...rows].map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) =>
          /^\\d+(\\.\\d+)?$/.test(v) && ri > 0
            ? '<c r="' + col(ci) + (ri + 1) + '" t="n"><v>' + v + '</v></c>'
            : '<c r="' + col(ci) + (ri + 1) + '" t="inlineStr"><is><t>' + esc(v) + '</t></is></c>').join('') + '</row>').join('');
        const zip = new JSZip();
        zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
        zip.file('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Comics" sheetId="1" r:id="rId2"/></sheets></workbook>');
        zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
        zip.file('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + xmlRows + '</sheetData></worksheet>');
        const buf = await zip.generateAsync({ type: 'arraybuffer' });

        // Fichier choisi sur Android : nom sans extension, type générique → reconnu par son contenu
        P.openCsvImportModal();
        await P.readCsvFile(new File([buf], 'document:4521', { type: 'application/octet-stream' }));
        await new Promise(r => setTimeout(r, 300));
        const noExtension = /League of Comic Geeks/.test(document.getElementById('csvImportDetected').innerText) && /classeur Excel/.test(document.getElementById('csvImportDetected').innerText);
        document.getElementById('csvImportModal') && document.getElementById('csvImportModal').classList.remove('open');
        P.setPhysicalSingles([]);
        const parsed = await P.parseXlsxBuffer(buf);
        const source = P.detectCsvSource(parsed.headers);
        const mapping = P.detectCsvMapping(parsed.headers);
        const res = P.convertCsvRows(parsed, mapping, { source });
        const added = P.importCsvItems ? null : null;
        P.openCsvImportModal();
        P.loadParsedIntoWizard(parsed, 'ComicGeeks.xlsx');
        const summary = document.getElementById('csvImportSummary').innerText;
        document.getElementById('csvImportConfirmBtn').click();
        const items = P.getPhysicalSingles();
        const find = (series, issue, variantRe) => items.find(x => x.series === series && x.issue === issue && (!variantRe || variantRe.test(x.variant)));
        const ab1 = find('Absolute Batman (2024)', '#1', /^Cover A$/);
        const abVirgin = find('Absolute Batman (2024)', '#1', /Virgin/);
        const annual = items.find(x => /Annual/.test(x.series));
        const tome = items.find(x => /Tome 1/.test(x.variant));
        const bat16 = find('Batman (2016)', '#1');
        const bat25 = find('Batman (2025)', '#1');
        const asm = items.find(x => x.issue === '#647');
        const xmen5 = find('X-Men (2024)', '#5');
        const groups = P.buildSeriesIndex().map(g => g.key);
        const inv = items.find(x => /2026 Foil/.test(x.variant));
        const gods = items.find(x => /^G\.O\.D\.S/.test(x.series));
        return {
          noExtension,
          rows: parsed.rows.length, source, skipped: res.skipped.length, readOnlySkipped: res.skipped.filter(x => x.readOnly).length,
          total: items.length, summary,
          ab1: ab1 && { read: ab1.isRead, rating: ab1.rating, year: ab1.coverYear, key: ab1.keyType, pub: ab1.publisher },
          abVirgin: !!abVirgin, annualSeries: annual && annual.series, annualIssue: annual && annual.issue, annualKey: annual && annual.valuation && annual.valuation.factors.some(f => /Key/.test(f.label)),
          tome: tome && { issue: tome.issue, series: tome.series, variant: tome.variant },
          volumesSeparate: !!bat16 && !!bat25, bat16Key: bat16 && bat16.valuation && bat16.valuation.factors.some(f => /Key/.test(f.label)),
          asm: asm && { series: asm.series, variant: asm.variant, ratioFactor: asm.valuation && asm.valuation.factors.some(f => /ratio 1:20/.test(f.label)), rating: asm.rating },
          xmen5Wish: !!xmen5 && xmen5.isWishlist, xmen6Absent: !find('X-Men (2024)', '#6'),
          batGroups: groups.filter(k => /^batman/.test(k)),
          virginRead: abVirgin && abVirgin.isRead, readCount: items.filter(x => x.isRead).length,
          tomeValue: tome && tome.estValue, godsValue: gods && gods.estValue,
          invReprint: inv && inv.valuation.factors.some(f => /Réimpression/.test(f.label)), invValue: inv && inv.estValue
        };
      })()`);
      console.log('Résultat Test 14:', JSON.stringify(t14, null, 1));
      testResults.push({
        test: 'Export Excel League of Comic Geeks (.xlsx) : statuts, volumes, variantes, annuals, recueils',
        ok: t14 && !t14.error && t14.noExtension === true && t14.rows === 11 && t14.source === 'League of Comic Geeks' && t14.readOnlySkipped === 1 && t14.total === 10 &&
          t14.virginRead === false && t14.readCount === 5 && t14.tomeValue === 20 && t14.godsValue === 12 && t14.invReprint === true && t14.invValue < 20 &&
          t14.ab1 && t14.ab1.read === true && t14.ab1.rating === 5 && t14.ab1.year === 2024 && t14.ab1.pub === 'DC Comics' &&
          t14.abVirgin && t14.annualSeries === 'Absolute Batman 2025 Annual' && t14.annualIssue === '#1' && t14.annualKey === false &&
          t14.tome && t14.tome.issue === '' && /Tome 1: Le Zoo HC/.test(t14.tome.variant) &&
          t14.volumesSeparate && t14.bat16Key === false &&
          t14.asm && t14.asm.series === 'The Amazing Spider-Man (1998)' && /1:20/.test(t14.asm.variant) && t14.asm.ratioFactor && t14.asm.rating === 3 &&
          t14.xmen5Wish && t14.xmen6Absent && t14.batGroups.length === 2
      });

      // ==========================================
      // TEST 15 : Couvertures Comic Vine (Comic Vine simulé : volumes, numéros, variantes, quotas)
      // ==========================================
      console.log('\n[TEST 15] Couvertures Comic Vine en arrière-plan (simulé)...');
      const t15 = await evalExpr(`(async () => {
        const P = window.Panel;
        const img = tag => "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' data-c='" + tag + "'/%3E";
        const calls = { search: 0, issues: 0, issue: 0 };
        const fake = async url => {
          const u = decodeURIComponent(url);
          if (u.includes('/api/search/')) {
            calls.search++;
            if (u.includes('query=Rate Book')) return { status_code: 107, error: 'Rate Limit Exceeded' };
            if (u.includes('query=Absolute Batman')) return { status_code: 1, results: [
              { id: 3, name: 'Absolute Batman: Noir Edition', start_year: '2024', publisher: { name: 'DC Comics' }, count_of_issues: 3 },
              { id: 2, name: 'Absolute Batman', start_year: '2025', publisher: { name: 'DC Comics' }, count_of_issues: 2 },
              { id: 1, name: 'Absolute Batman', start_year: '2024', publisher: { name: 'DC Comics' }, count_of_issues: 15 } ] };
            return { status_code: 1, results: [] };
          }
          if (u.includes('/api/issues/')) {
            calls.issues++;
            if (!u.includes('volume:1')) return { status_code: 1, results: [] };
            return { status_code: 1, number_of_total_results: 12, results: Array.from({ length: 12 }, (_, i) => ({
              id: 100 + i + 1, issue_number: String(i + 1), cover_date: '2024-11-01', image: { medium_url: img('ab' + (i + 1)) } })) };
          }
          if (u.includes('/api/issue/4000-101')) { calls.issue++; return { status_code: 1, results: { associated_images: [
            { original_url: img('ab1-jock'), caption: 'Cover B Jock Variant' },
            { original_url: img('ab1-jimlee'), caption: 'Cover J Jim Lee Foil Virgin Variant' } ] } }; }
          if (u.includes('/api/issue/4000-')) { calls.issue++; return { status_code: 1, results: { associated_images: [] } }; }
          return { status_code: 101, error: 'Object Not Found' };
        };
        P.resetCvStateForTest();
        const prevCvKey = localStorage.getItem('panel_comicvine_key'); localStorage.setItem('panel_comicvine_key', 'test-key');
        P.setCvFetcherForTest(fake, 0);
        P.resetFandomStateForTest();
        P.setFandomFetcherForTest(async () => ({ query: { pages: [] } }), 0);
        P.setCoverJobOptions({ variants: true, active: false });
        const base = { publisher: 'DC Comics', keyType: 'none', condition: 'NM 9.4 (Near Mint)', coverUrl: '', addedAt: new Date().toISOString() };
        P.setPhysicalSingles([
          { ...base, id: 'c1', series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover A' },
          { ...base, id: 'c2', series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover J Jim Lee Foil Virgin Variant' },
          { ...base, id: 'c3', series: 'Absolute Batman (2024)', issue: '#2', variant: 'Cover C Somebody Unknown Variant' },
          { ...base, id: 'c4', series: 'Absolute Batman (2024)', issue: '#99', variant: 'Cover A' },
          { ...base, id: 'c5', series: 'Absolute Batman (2025)', issue: '', variant: 'Tome 1: Le Zoo HC' },
          { ...base, id: 'c6', series: 'Unknown Book (2020)', issue: '#1', variant: 'Cover A' },
          { ...base, id: 'c7', series: 'Absolute Batman (2024)', issue: '#3', variant: 'Cover A', isWishlist: true }
        ]);
        P.showSinglesView('collection');
        const barBefore = document.getElementById('coverJobBar').innerText;
        await P.runCoverJob();
        const L = id => P.getPhysicalSingles().find(x => x.id === id);
        const st = id => L(id).coverLookup && L(id).coverLookup.status;
        const domImg = document.querySelector('[data-sid="c2"] img');
        const res = {
          barBefore: /7 couverture\\(s\\) à récupérer/.test(barBefore),
          c1: st('c1') === 'found' && /ab1'/.test(L('c1').coverUrl) && L('c1').comicVineId === 101,
          c2: st('c2') === 'variant' && /ab1-jimlee/.test(L('c2').coverUrl),
          c3: st('c3') === 'regular' && /ab2'/.test(L('c3').coverUrl),
          c4: st('c4') === 'notfound',
          c5: st('c5') === 'skipped',
          c6: st('c6') === 'notfound',
          c7: st('c7') === 'found',
          domUpdated: !!domImg && /ab1-jimlee/.test(decodeURIComponent(domImg.src)),
          calls: JSON.stringify(calls),
          phase: P.getCoverJob().phase, jobError: P.getCoverJob().error || ''
        };

        // Quota local plein : pause automatique, aucune requête, reprise programmée
        P.setPhysicalSingles([{ ...base, id: 'q1', series: 'Absolute Batman (2024)', issue: '#5', variant: 'Cover A' }]);
        P.fillCvQuotaForTest('issues');
        const before = calls.issues;
        await P.runCoverJob();
        const job = P.getCoverJob();
        res.quotaPause = job.phase === 'quota' && job.resumeAt > Date.now() + 30 * 60000 && calls.issues === before && !L('q1').coverUrl;
        res.quotaBar = /Pause automatique/.test(document.getElementById('coverJobBar').innerText);
        P.pauseCoverJob();

        // Limite atteinte côté serveur (réponse 107) : pause, pas d'erreur
        P.resetCvStateForTest();
        P.setPhysicalSingles([{ ...base, id: 'r1', series: 'Rate Book (2020)', issue: '#1', variant: 'Cover A' }]);
        await P.runCoverJob();
        res.serverLimit = P.getCoverJob().phase === 'quota' && !(L('r1').coverLookup);
        P.pauseCoverJob();
        P.resetCvStateForTest();
        if (prevCvKey == null) localStorage.removeItem('panel_comicvine_key'); else localStorage.setItem('panel_comicvine_key', prevCvKey);
        res.inactive = JSON.parse(localStorage.getItem('panel_cover_job')).active === false;
        return res;
      })()`);
      console.log('Résultat Test 15:', t15);
      testResults.push({
        test: 'Couvertures Comic Vine (volumes, numéros, variantes exactes, recueils, quotas, reprise)',
        ok: t15 && t15.barBefore && t15.c1 && t15.c2 && t15.c3 && t15.c4 && t15.c5 && t15.c6 && t15.c7 && t15.domUpdated &&
          t15.calls === JSON.stringify({ search: 2, issues: 1, issue: 2 }) && t15.phase === 'done' &&
          t15.quotaPause && t15.quotaBar && t15.serverLimit && t15.inactive
      });

      // ==========================================
      // TEST 16 : Base des key issues (années, volumes, titres alternatifs, faux positifs)
      // ==========================================
      console.log('\n[TEST 16] Base des key issues (années, volumes, faux positifs)...');
      const t16 = await evalExpr(`(() => {
        const P = window.Panel;
        const k = (s, i, y) => { const r = P.checkKeyIssueInfo(s, i, y); return r ? r.tier + ':' + r.year : null; };
        const cases = {
          asm300: [k('Amazing Spider-Man', '#300', 1988), 'major:1988'],
          asm300vol: [k('The Amazing Spider-Man (1963)', '#300', null), 'major:1988'],
          asm2022_1: [k('The Amazing Spider-Man (2022)', '#1', 2022), null],
          xmen1963: [k('X-Men', '#1', 1963), 'major:1963'],
          xmen1991: [k('X-Men', '#1', 1991), 'minor:1991'],
          xmenAmbiguous: [k('X-Men', '#1', null), null],
          xmen1991vol: [k('X-Men (1991)', '#1', null), 'minor:1991'],
          gambitUncanny: [k('Uncanny X-Men', '#266', 1990), 'major:1990'],
          gambitXmen: [k('X-Men', '#266', 1991), 'major:1990'],
          walkingDead: [k('The Walking Dead', '#1', 2003), 'major:2003'],
          batman1940: [k('Batman', '#1', 1940), 'major:1940'],
          batman2016: [k('Batman (2016)', '#1', 2016), null],
          batman135old: [k('Batman', '#135', 1960), null],
          batman135new: [k('Batman (2016)', '#135', 2023), 'minor:2023'],
          tf1984: [k('Transformers', '#1', 1984), null],
          tf2023: [k('Transformers (2023)', '#1', 2023), 'minor:2023'],
          absBat: [k('Absolute Batman (2024)', '#1', 2024), 'minor:2024'],
          absAnnual: [k('Absolute Batman 2025 Annual', '#1', 2025), null],
          constantine: [k('Saga of the Swamp Thing', '#37', 1985), 'major:1985'],
          spiderman300: [k('Spider-Man', '#300', 1988), null],
          hulk181: [k('The Incredible Hulk', '#181', 1974), 'major:1974'],
          hulk2023: [k('The Incredible Hulk (2023)', '#1', 2023), null],
          lukeCage: [k('Luke Cage, Hero for Hire', '#1', 1972), 'minor:1972'],
          secretWars: [k('Marvel Super Heroes Secret Wars', '#8', 1984), 'major:1984'],
          secretWars2015: [k('Secret Wars', '#8', 2016), null],
          harley: [k('The Batman Adventures', '#12', 1993), 'major:1993']
        };
        const failed = Object.entries(cases).filter(([, [got, want]]) => got !== want).map(([n, [got, want]]) => n + ' got ' + got + ' want ' + want);
        const abs = P.estimateComicValue({ series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover A', condition: 'NM 9.4 (Near Mint)', coverPrice: 4.99, coverYear: 2024 });
        const absMinor = abs.factors.some(f => /Key issue mineure/.test(f.label)) && abs.value < 15;
        return { count: P.keyIssuesCount(), failed, absMinor, absValue: abs.value };
      })()`);
      console.log('Résultat Test 16:', JSON.stringify(t16));
      testResults.push({
        test: 'Base des key issues (années, volumes, titres alternatifs, faux positifs)',
        ok: t16 && t16.count >= 110 && t16.failed.length === 0 && t16.absMinor
      });

      // ==========================================
      // TEST 18 : Couvertures & variantes Fandom (provenance, fiabilité, protection, annulation, quotas)
      // ==========================================
      console.log('\n[TEST 18] Couvertures Fandom + provenance + protection des couvertures manuelles...');
      const t18 = await evalExpr(`(async () => {
        const P = window.Panel;
        const img = tag => "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' data-c='" + tag + "'/%3E";
        const WT = {
          'Absolute Batman Vol 1 1': "{{DC Database:Comic Template\\n| Year = 2024\\n| Image = Absolute Batman Vol 1 1.jpg\\n| Image2 = Absolute Batman Vol 1 1 Jae Lee Variant.jpg\\n| Image2Text = Jae Lee Variant\\n| Image3 = Absolute Batman Vol 1 1 Jim Lee Textless Variant.jpg\\n| Image3Text = Jim Lee Textless Variant\\n| Image4 = Absolute Batman Vol 1 1 Second Printing.jpg\\n| Image4Text = Second Printing Dustin Nguyen Variant\\n| Image5 = Absolute Batman Vol 1 1 Panosian A.jpg\\n| Image5Text = Dan Panosian Variant\\n| Image6 = Absolute Batman Vol 1 1 Panosian B.jpg\\n| Image6Text = Dan Panosian Variant\\n| Image7 = Absolute Batman Vol 1 1 Evil.jpg\\n| Image7Text = <img src=x onerror=alert(1)> Evil Variant\\n}}",
          'Absolute Batman Vol 1 2': "{{DC Database:Comic Template\\n| Year = 2024\\n| Image = Absolute Batman Vol 1 2.jpg\\n}}",
          'Batman Vol 1 1': "{{DC Database:Comic Template\\n| Year = 1940\\n| Image = Batman Vol 1 1.jpg\\n}}",
          'Ultimates Vol 4 6': "{{Marvel Database:Comic Template\\n| Year = 2024\\n| Image1 = Ultimates Vol 4 6.jpg\\n| Image2 = Ultimates Vol 4 6 Brooks Variant.jpg\\n| Image2_Text = Mark Brooks Variant\\n}}"
        };
        const calls = { fandom: 0, cv: 0 };
        P.resetFandomStateForTest();
        P.setFandomFetcherForTest(async url => {
          calls.fandom++;
          const q = new URL(url).searchParams;
          const titles = (q.get('titles') || '').split('|');
          if (q.get('prop') === 'revisions') return { query: { pages: titles.map(t => WT[t] ? { title: t, revisions: [{ slots: { main: { content: WT[t] } } }] } : { title: t, missing: true }) } };
          if (q.get('prop') === 'imageinfo') return { query: { pages: titles.map(t => ({ title: t, imageinfo: [{ thumburl: img(t.replace(/^File:/, '').replace(/\\W+/g, '-')) }] })) } };
          return { query: { pages: [] } };
        }, 0);
        P.resetCvStateForTest();
        const prevCvKey = localStorage.getItem('panel_comicvine_key'); localStorage.setItem('panel_comicvine_key', 'test-key');
        P.setCvFetcherForTest(async url => {
          calls.cv++;
          const u = decodeURIComponent(url);
          if (u.includes('/api/search/')) return { status_code: 1, results: [{ id: 1, name: 'Absolute Batman', start_year: '2024', publisher: { name: 'DC Comics' }, count_of_issues: 15 }] };
          if (u.includes('/api/issues/')) return { status_code: 1, results: [{ id: 101, issue_number: '1', cover_date: '2024-11-01', image: { medium_url: img('cv-ab1') } }, { id: 102, issue_number: '2', cover_date: '2024-12-01', image: { medium_url: img('cv-ab2') } }] };
          return { status_code: 101 };
        }, 0);
        P.setCoverJobOptions({ variants: false, active: false });
        const base = { publisher: 'DC Comics', keyType: 'none', condition: 'NM 9.4 (Near Mint)', coverUrl: '', addedAt: new Date().toISOString() };
        const manualUrl = img('ma-photo');
        P.setPhysicalSingles([
          { ...base, id: 'f1', series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover A Nick Dragotta' },
          { ...base, id: 'f2', series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover J Jim Lee Foil Virgin Variant' },
          { ...base, id: 'f3', series: 'Absolute Batman (2024)', issue: '#1', variant: '2nd Printing Dustin Nguyen Variant' },
          { ...base, id: 'f4', series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover C Somebody Unknown Variant' },
          { ...base, id: 'f5', series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover B Jae Lee Variant', coverUrl: manualUrl },
          { ...base, id: 'f6', series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover B Jae Lee Variant', coverUrl: img('cv-old'), coverLookup: { status: 'regular', at: '2026-11-01' } },
          { ...base, id: 'f7', series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover E Dan Panosian Variant' },
          { ...base, id: 'f8', series: 'Absolute Batman (2024)', issue: '#2', variant: 'Cover A' },
          { ...base, id: 'm1', publisher: 'Marvel Comics', series: 'Ultimates (2024)', issue: '#6', variant: 'Cover B Mark Brooks Variant' }
        ]);
        P.showSinglesView('collection');
        await P.runCoverJob();
        const L = id => P.getPhysicalSingles().find(x => x.id === id);
        const M = id => P.coverMetaOf(L(id)) || {};
        const res = {
          f1: M('f1').source === 'fandom' && M('f1').confidence === 'exacte' && /Vol-1-1-jpg/.test(L('f1').coverUrl),
          f2approx: M('f2').source === 'fandom' && M('f2').confidence === 'approchee' && /Textless/.test(L('f2').coverUrl),
          f3printing: M('f3').source === 'fandom' && /Second-Printing/.test(L('f3').coverUrl),
          f4fallbackCv: M('f4').source === 'comicvine' && M('f4').confidence === 'standard' && /cv-ab1/.test(L('f4').coverUrl),
          f5manualKept: L('f5').coverUrl === manualUrl && P.isCoverLocked(L('f5')) && !L('f5').coverHistory,
          f6upgraded: M('f6').source === 'fandom' && /Jae-Lee/.test(L('f6').coverUrl) && L('f6').coverHistory.length === 1 && /cv-old/.test(L('f6').coverHistory[0].url),
          f7ambiguous: M('f7').source === 'comicvine' && M('f7').confidence === 'standard',
          f8: M('f8').source === 'fandom',
          m1marvel: M('m1').source === 'fandom' && /Brooks/.test(L('m1').coverUrl),
          phase: P.getCoverJob().phase, jobError: P.getCoverJob().error || '',
          cvCalls: calls.cv,
          fandomCalls: calls.fandom
        };
        res.xss = !/<img/.test((P.parseFandomCovers(WT['Absolute Batman Vol 1 1']).find(c => /Evil/.test(c.caption)) || {}).caption || '<img');
        res.snapshots = (await P.listSnapshots()).some(x => /Avant récupération/.test(x.reason) && x.count === 9);
        // Une couverture manuelle n'est jamais remplacée, même via l'API interne
        res.applyRefused = P.applyAutoCover(L('f5'), img('auto'), { source: 'fandom', confidence: 'exacte' }) === false && L('f5').coverUrl === manualUrl;
        // Annulation du lot : couvertures automatiques retirées / restaurées, manuelle intacte
        const batch = P.lastCoverBatch();
        const undone = batch ? P.undoCoverBatch(batch.id) : 0;
        res.undo = undone >= 7 && /cv-old/.test(L('f6').coverUrl) && !L('f1').coverUrl && L('f5').coverUrl === manualUrl;
        res.undoNoRefetch = !P.coverCounts().pending;
        // Quota Fandom plein : pause automatique annoncée, aucune requête
        P.resetFandomStateForTest();
        P.setPhysicalSingles([{ ...base, id: 'q1', series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover B Jae Lee Variant', coverUrl: img('cv-q'), coverLookup: { status: 'regular' } }]);
        P.fillFandomQuotaForTest();
        const before = calls.fandom;
        await P.runCoverJob();
        res.quota = P.getCoverJob().phase === 'quota' && calls.fandom === before && /quota Fandom/.test(document.getElementById('coverJobBar').innerText);
        P.pauseCoverJob();
        // Fiche : Fandom + Comic Vine fusionnés, meilleure variante marquée, sources indiquées
        P.resetFandomStateForTest();
        const props = await P.fetchComicCoversAndDetails('Absolute Batman (2024)', '#1', 'DC Comics', { variant: 'Jae Lee Variant' });
        res.formBest = props.length >= 7 && props[0].match && /Jae Lee/.test(props[0].name) && props.every(p => p.source === 'fandom' || p.source === 'comicvine');
        res.formNoFake = (await P.fetchComicCoversAndDetails('Totally Unknown Title Zzz', '#1', 'Boom! Studios')).length === 0;
        P.resetFandomStateForTest();
        P.resetCvStateForTest();
        if (prevCvKey == null) localStorage.removeItem('panel_comicvine_key'); else localStorage.setItem('panel_comicvine_key', prevCvKey);
        return res;
      })()`);
      console.log('Résultat Test 18:', t18);
      testResults.push({
        test: 'Couvertures Fandom : variantes exactes/approchées, provenance, protection manuelle, annulation de lot, quotas',
        ok: !!t18 && ['f1', 'f2approx', 'f3printing', 'f4fallbackCv', 'f5manualKept', 'f6upgraded', 'f7ambiguous', 'f8', 'm1marvel', 'xss', 'snapshots', 'applyRefused', 'undo', 'undoNoRefetch', 'quota', 'formBest', 'formNoFake'].every(k => t18[k] === true) && t18.phase === 'done'
      });

      // ==========================================
      // TEST 17 : PWA sur http://localhost (manifest, service worker, hors ligne, raccourcis)
      // ==========================================
      console.log('\n[TEST 17] PWA (manifest, service worker, hors ligne, raccourcis)...');
      let t17 = null;
      try {
        process.env.PORT = '8099';
        const server = require('./serve.js');
        await new Promise(r => setTimeout(r, 300));
        const created = await new Promise((resolve, reject) => {
          const req = http.request({ host: '127.0.0.1', port: 9224, path: '/json/new?' + encodeURI('http://localhost:8099/'), method: 'PUT' }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
          });
          req.on('error', reject); req.end();
        });
        const ws2 = new WebSocket(created.webSocketDebuggerUrl);
        await new Promise(r => ws2.onopen = r);
        let id2 = 1;
        const send2 = (method, params = {}) => new Promise(res => {
          const cur = id2++;
          const h = ev => { const p = JSON.parse(ev.data); if (p.id === cur) { ws2.removeEventListener('message', h); res(p.result || p); } };
          ws2.addEventListener('message', h);
          ws2.send(JSON.stringify({ id: cur, method, params }));
        });
        const ev2 = async expr => { const r = await send2('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result ? r.result.value : r; };
        const waitPanel = async () => { for (let i = 0; i < 60; i++) { if (await ev2('!!window.Panel && document.readyState === "complete"')) return true; await new Promise(r => setTimeout(r, 250)); } return false; };
        await send2('Runtime.enable');
        await send2('Network.enable');
        await waitPanel();
        const first = await ev2(`(async () => {
          const man = await fetch('manifest.webmanifest').then(r => r.json());
          const icons = await Promise.all(man.icons.map(i => fetch(i.src).then(r => r.ok && r.headers.get('content-type') === 'image/png')));
          const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 8000))]);
          const blocked = await fetch('index.html.backup.20261028').then(r => r.status);
          return { manifestLink: !!document.querySelector('link[rel=manifest]'), name: man.short_name, display: man.display, iconsOk: icons.every(Boolean) && icons.length === 3,
            maskable: man.icons.some(i => i.purpose === 'maskable'), shortcuts: (man.shortcuts || []).length, swActive: !!(reg && reg.active), backupBlocked: blocked === 404,
            pwa: window.Panel.getPwaState() };
        })()`);
        // Rechargement : la page doit être contrôlée par le service worker et la coquille en cache
        await send2('Page.reload', { ignoreCache: false });
        await new Promise(r => setTimeout(r, 1200));
        await waitPanel();
        const second = await ev2(`(async () => ({ controlled: !!navigator.serviceWorker.controller,
          shellCached: !!(await caches.match('./index.html')), libsCached: (await caches.keys()).includes('panel-libs-v1') }))()`);
        // Hors ligne : rechargement complet sans réseau
        await send2('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        await send2('Page.reload', { ignoreCache: false });
        await new Promise(r => setTimeout(r, 1500));
        const offlineLoaded = await waitPanel();
        const offline = await ev2(`({ loaded: !!window.Panel, pill: !document.getElementById('offlinePill').hidden, noPdfjs: !window.pdfjsLib, jszip: !!window.JSZip })`);
        await send2('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        // Raccourci d'icône : ?view=series ouvre la vue et nettoie l'URL
        await send2('Page.navigate', { url: 'http://localhost:8099/?view=series' });
        await new Promise(r => setTimeout(r, 800));
        await waitPanel();
        const shortcut = await ev2(`({ seriesVisible: !document.getElementById('singlesSeriesView').hidden && !document.getElementById('singlesViewSection').hidden, cleanUrl: location.search === '' })`);
        ws2.close();
        server.close();
        t17 = { first, second, offlineLoaded, offline, shortcut };
      } catch (e) {
        t17 = { error: String(e && e.message || e) };
      }
      console.log('Résultat Test 17:', JSON.stringify(t17));
      testResults.push({
        test: 'PWA (manifest, icônes, service worker, hors ligne, raccourcis)',
        ok: !!t17 && !t17.error && t17.first.manifestLink && t17.first.name === 'Panel' && t17.first.display === 'standalone' && t17.first.iconsOk && t17.first.maskable &&
          t17.first.shortcuts === 4 && t17.first.swActive && t17.first.backupBlocked && t17.second.controlled && t17.second.shellCached && t17.second.libsCached &&
          t17.offlineLoaded && t17.offline.loaded && t17.offline.pill && t17.offline.noPdfjs && t17.offline.jszip && t17.shortcut.seriesVisible && t17.shortcut.cleanUrl
      });

      // ==========================================
      // TEST 19 : Scanner — zxing-wasm (17 chiffres), identification prudente, file à confirmer, GCD
      // ==========================================
      console.log('\n[TEST 19] Scanner : lecture 17 chiffres, éditions, mode continu, GCD...');
      const t19 = await evalExpr(`(async () => {
        const P = window.Panel;
        const r = {};
        P.clearScanQueueForTest();
        P.clearScanJournalForTest();
        localStorage.removeItem('panel_gcd_proxy');
        // a. Décodage : uniquement des faits établis (plus de variante inventée, plus de faux dictionnaire)
        const a = P.parseComicBarcode('76194138584600138');
        r.parse = a.base12 === '761941385846' && a.addon === '00138' && a.issueNum === '1' && a.editionCode === '38' && a.variantName === '' && a.publisher === 'DC Comics' && a.valid === true;
        const b = P.parseComicBarcode('76194138584600111');
        r.parseA = b.variantName === 'Cover A' && /probable/.test(b.variantHint);
        r.checksum = P.parseComicBarcode('761941385847').valid === false && P.parseComicBarcode('761941385846').valid === true;
        r.noFakeDict = P.parseComicBarcode('759606089364').seriesGuess === '';
        const isbn = P.parseComicBarcode('9781779527202');
        r.isbn = isbn.isIsbn === true && isbn.issueNum === '';

        // b. Lecture réelle par zxing-wasm d'un code UPC-A + supplément EAN-5 dessiné (comme sur un comic)
        const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
        const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
        const R = L.map(x => x.replace(/./g, ch => ch === '0' ? '1' : '0'));
        const PAR = ['GGLLL','GLGLL','GLLGL','GLLLG','LGGLL','LLGGL','LLLGG','LGLGL','LGLLG','LLGLG'];
        const upcBits = d => { let o = '101'; for (let i = 0; i < 6; i++) o += L[d[i]]; o += '01010'; for (let i = 6; i < 12; i++) o += R[d[i]]; return o + '101'; };
        const addBits = d => { const cs = (3 * (+d[0] + +d[2] + +d[4]) + 9 * (+d[1] + +d[3])) % 10; const p = PAR[cs]; let o = '1011'; for (let i = 0; i < 5; i++) { if (i) o += '01'; o += (p[i] === 'L' ? L : G)[d[i]]; } return o; };
        const draw = (d12, d5, m) => {
          const main = upcBits(d12), add = addBits(d5);
          const c = document.createElement('canvas'); c.width = (11 + main.length + 9 + add.length + 11) * m; c.height = 70 * m;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
          let x = 11 * m;
          for (const bit of main) { if (bit === '1') g.fillRect(x, 6 * m, m, 54 * m); x += m; }
          x += 9 * m;
          for (const bit of add) { if (bit === '1') g.fillRect(x, 14 * m, m, 46 * m); x += m; }
          return c;
        };
        const blob = await new Promise(res => draw('761941385846', '00138', 3).toBlob(res, 'image/png'));
        const t0 = performance.now();
        let d = null;
        try { d = await P.decodeBarcodeImage(blob); } catch (e) { r.decodeError = String(e.message || e); }
        r.decodeMs = Math.round(performance.now() - t0);
        r.decode = !!d && d.code === '76194138584600138' && d.addon === '00138';

        // c. Mode continu : édition incertaine → file « à confirmer », jamais d'ajout au hasard
        P.setPhysicalSingles([]);
        const c1 = P.processContinuousScan('76194138584600138');
        r.contQueued = !!c1.queued && P.getPhysicalSingles().length === 0 && P.getScanQueue().length === 1;
        P.processContinuousScan('76194138584600138');
        r.contDedup = P.getScanQueue().length === 1 && P.getScanQueue()[0].n === 2;
        P.learnEdition('76194138584600111', { series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover A Nick Dragotta', publisher: 'DC Comics', coverUrl: 'https://example.org/ab1.jpg', coverMeta: { source: 'fandom', confidence: 'exacte' }, coverPrice: 4.99, coverYear: 2024 });
        const c2 = P.processContinuousScan('76194138584600111');
        const added = P.getPhysicalSingles()[0];
        r.contAdded = !!c2.added && added.series === 'Absolute Batman (2024)' && added.variant === 'Cover A Nick Dragotta' && added.barcode === '76194138584600111' && added.coverMeta.source === 'fandom' && added.coverPrice === 4.99;
        r.contCopies = P.processContinuousScan('76194138584600111').copies === 2;

        // Sources simulées (aucun appel réseau) : Fandom avec 3 couvertures, Comic Vine vide
        const img = t => "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' data-c='" + t + "'/%3E";
        const WT = "{{DC Database:Comic Template\\n| Year = 2024\\n| Image = Absolute Batman Vol 1 1.jpg\\n| Image2 = Absolute Batman Vol 1 1 Jae Lee Variant.jpg\\n| Image2Text = Jae Lee Variant\\n| Image3 = Absolute Batman Vol 1 1 Jim Lee Foil Variant.jpg\\n| Image3Text = Jim Lee Foil Variant\\n}}";
        P.resetFandomStateForTest();
        P.setFandomFetcherForTest(async url => {
          const q = new URL(url).searchParams; const titles = (q.get('titles') || '').split('|');
          if (q.get('prop') === 'revisions') return { query: { pages: titles.map(t => t === 'Absolute Batman Vol 1 1' ? { title: t, revisions: [{ slots: { main: { content: WT } } }] } : { title: t, missing: true }) } };
          return { query: { pages: titles.map(t => ({ title: t, imageinfo: [{ thumburl: img(t.replace(/\\W+/g, '-')) }] })) } };
        }, 0);
        P.setCvFetcherForTest(async () => ({ status_code: 1, results: [] }), 0);
        const val = id => document.getElementById(id).value;

        // d. Fiche : édition déjà confirmée → tout est prérempli, doublon signalé
        await P.handleScannedBarcode('76194138584600111');
        r.formExact = val('singleSeriesInput') === 'Absolute Batman (2024)' && val('singleVariantNameInput') === 'Cover A Nick Dragotta' && /possédé ×2/.test(document.getElementById('barcodeSourceTag').textContent);

        // e. Titre connu, code d'édition 38, sans GCD : couvertures proposées, aucune présélectionnée
        P.learnSeriesForTest('761941385846', 'Absolute Batman (2024)', 'DC Comics');
        await P.handleScannedBarcode('76194138584600138');
        const sel = P.getCoverSelection();
        r.ambiguous = /Variante à identifier \\(code 38\\)/.test(val('singleVariantNameInput')) && sel.index === -1 && sel.list.length === 3 && val('singleIssueInput') === '#1';

        // f. Avec le relais GCD (simulé) : édition exacte, prix, et l'image Fandom correspondante présélectionnée
        localStorage.setItem('panel_gcd_proxy', 'http://gcd.test/api/gcd');
        let gcdUrl = '';
        P.setGcdFetcherForTest(async url => { gcdUrl = url; return { editions: [{ variant_name: 'Cover A Nick Dragotta', barcode: '76194138584600111' }], match: { variant_name: 'Jim Lee & Scott Williams Foil Cardstock Variant', barcode: '76194138584600138', price: '7.99 USD' }, complete: false }; });
        P.resetFandomStateForTest();
        await P.handleScannedBarcode('76194138584600138');
        const sel2 = P.getCoverSelection();
        r.gcdExact = val('singleVariantNameInput') === 'Jim Lee & Scott Williams Foil Cardstock Variant' && val('singleCoverPriceInput') === '7.99' && /barcode=76194138584600138/.test(gcdUrl) && /year=2024/.test(gcdUrl) && sel2.index >= 0 && /Jim Lee Foil/.test(sel2.list[sel2.index].name);

        // g. Enregistrement : édition apprise (prochain scan = ajout direct), retirée de la file
        await P.saveSingleIssue();
        const dupBtn = document.getElementById('dupKeepBothBtn');
        if (document.getElementById('duplicateWarningBox').style.display === 'block' && dupBtn) dupBtn.click();
        await new Promise(res => setTimeout(res, 50));
        const ex = P.parseComicBarcode('76194138584600138').exact;
        const saved = P.getPhysicalSingles().find(x => x.barcode === '76194138584600138');
        r.learned = !!ex && ex.variant === 'Jim Lee & Scott Williams Foil Cardstock Variant' && P.getScanQueue().length === 0 && !!saved && saved.coverMeta && saved.coverMeta.source === 'fandom';
        r.nextScanAdds = !!P.processContinuousScan('76194138584600138').added;
        // h. Journal des scans : fiches abandonnées et enregistrées, identification, corrections, touches
        const J = P.getScanJournal();
        const last = J[J.length - 1];
        r.journalDump = J.map(e => [e.method, e.ident, e.outcome, e.variantChanged, e.seriesChanged, e.clicks, e.coverSource].join('|')).join(' ; ');
        r.journal = J.filter(e => e.outcome === 'abandon').length === 1 && !!last && last.outcome === 'enregistré' && last.ident === 'édition exacte (GCD)' && last.variantChanged === false && last.seriesChanged === false && last.clicks >= 1 && last.totalMs >= 0 && /Fandom/.test(last.coverSource);

        // i. Metron (relais simulé) : titre inconnu → série, numéro et édition exacte ; couverture Metron présélectionnée
        P.clearScanQueueForTest();
        P.setPhysicalSingles([]);
        localStorage.removeItem('panel_gcd_proxy');
        localStorage.setItem('panel_metron_proxy', 'http://metron.test/api/metron');
        const ISS = { id: 127884, number: '1', cover_date: '2024-12-01', publisher: 'DC Comics', series: { name: 'Absolute Batman', year_began: 2024 }, editions: [
          { name: 'Cover A', main: true, upc: '76194138584600111', image: 'https://static.metron.test/m-a.jpg', price: '4.99' },
          { name: 'Cover J Jim Lee Foil Virgin Variant', main: false, upc: '76194138584600138', image: 'https://static.metron.test/m-j.jpg', price: '7.99' },
          { name: 'Cover C Jim Lee Variant', main: false, upc: '76194138584600121', image: 'https://static.metron.test/m-c.jpg', price: '5.99' } ] };
        P.setMetronFetcherForTest(async url => url.includes('code=76194138584600138') ? { found: 'exact', issue: ISS, edition: ISS.editions[1] } : url.includes('code=76194138584600199') ? { found: 'issue', issue: ISS } : { found: false });
        await P.handleScannedBarcode('76194138584600138');
        const sel3 = P.getCoverSelection();
        r.metronExact = val('singleSeriesInput') === 'Absolute Batman (2024)' && val('singleIssueInput') === '#1' && val('singleVariantNameInput') === 'Cover J Jim Lee Foil Virgin Variant' && val('singleCoverPriceInput') === '7.99' && sel3.index >= 0 && sel3.list[sel3.index].source === 'metron' && /Cover J/.test(sel3.list[sel3.index].name) && /Metron/.test(document.getElementById('barcodeSourceTag').textContent) && P.parseComicBarcode('76194138584600111').seriesGuess === 'Absolute Batman (2024)';
        await P.handleScannedBarcode('76194138584600199');
        const sel4 = P.getCoverSelection();
        r.metronIssue = sel4.index === -1 && sel4.list.filter(x => x.source === 'metron').length === 3 && /code 99/.test(val('singleVariantNameInput'));
        P.clearScanQueueForTest();
        P.setPhysicalSingles([]);
        P.processContinuousScan('76194138584600138');
        const added2 = await P.resolveQueuedWithMetron('76194138584600138');
        r.metronContinuous = !!added2 && added2.variant === 'Cover J Jim Lee Foil Virgin Variant' && added2.coverMeta.source === 'metron' && P.getScanQueue().length === 0;
        localStorage.removeItem('panel_metron_proxy');

        localStorage.removeItem('panel_gcd_proxy');
        P.clearScanQueueForTest();
        P.resetFandomStateForTest();
        P.resetCvStateForTest();
        document.getElementById('singleIssueDetailModal').classList.remove('open');
        return r;
      })()`);
      console.log('Résultat Test 19:', t19);
      testResults.push({
        test: 'Scanner : supplément 17 chiffres (zxing-wasm), clé de contrôle, édition exacte (GCD), candidates sans présélection, file à confirmer',
        ok: !!t19 && ['parse', 'parseA', 'checksum', 'noFakeDict', 'isbn', 'decode', 'contQueued', 'contDedup', 'contAdded', 'contCopies', 'formExact', 'ambiguous', 'gcdExact', 'learned', 'nextScanAdds', 'journal', 'metronExact', 'metronIssue', 'metronContinuous'].every(k => t19[k] === true)
      });

      // ==========================================
      // TEST 20 : Relais GCD local (serve.js) — édition par code-barres, cache, quota, paramètres
      // ==========================================
      console.log('\n[TEST 20] Relais GCD local (quota, cache, code-barres exact)...');
      let t20 = null;
      try {
        const srv = require('./serve.js');
        if (!srv.listening) await new Promise(r => srv.listen(8099, '127.0.0.1', r));
        let calls = 0;
        srv.setGcdGetForTest(async url => {
          calls++;
          if (url.startsWith('https://www.comics.org/api/series/name/')) {
            if (url.includes('/Many/')) return { next: null, results: Array.from({ length: 30 }, (_, i) => ({ api_url: 'https://www.comics.org/api/issue/' + (9000 + i) + '/?format=json', descriptor: '1 [Variant ' + i + ' Cover]', variant_of: i ? 'x' : null, price: '4.99 USD' })) };
            return { next: null, results: [
              { api_url: 'https://www.comics.org/api/issue/1/?format=json', descriptor: '1 [Nick Dragotta Cover]', variant_of: null, price: '4.99 USD' },
              { api_url: 'https://www.comics.org/api/issue/2/?format=json', descriptor: '1 [Jae Lee Variant Cover]', variant_of: 'https://www.comics.org/api/issue/1/?format=json', price: '5.99 USD' },
              { api_url: 'https://www.comics.org/api/issue/3/?format=json', descriptor: '1 [Jim Lee Foil Variant Cover]', variant_of: 'https://www.comics.org/api/issue/1/?format=json', price: '7.99 USD' } ] };
          }
          const id = (url.match(/issue\/(\d+)\//) || [])[1];
          return { barcode: { 1: '76194138584600111', 2: '76194138584600121', 3: '76194138584600138' }[id] || '', variant_name: '' };
        });
        const get = async q => { const res = await fetch('http://127.0.0.1:8099/api/gcd/issues?' + q); return { status: res.status, body: await res.json() }; };
        const a = await get('series=Absolute%20Batman&issue=1&year=2024&barcode=76194138584600138');
        const callsA = calls;
        await get('series=Absolute%20Batman&issue=1&year=2024&barcode=76194138584600138');
        const callsB = calls;
        const c = await get('series=Absolute%20Batman&issue=1&year=2024&barcode=76194138584600111');
        const callsC = calls;
        const bad = await get('series=x&issue=1;drop&year=2024');
        const many = await get('series=Many&issue=1&year=2024&barcode=99999999999900000');
        const over = await get('series=Other&issue=2&year=2024');
        t20 = {
          exact: a.status === 200 && !!a.body.match && a.body.match.variant_name === 'Jim Lee Foil Variant' && a.body.match.price === '7.99 USD',
          lazyDetails: callsA === 3,
          cached: callsB === callsA,
          mainCached: !!c.body.match && c.body.match.variant_name === 'Cover A Nick Dragotta' && callsC === callsA + 1,
          badParams: bad.status === 400,
          quotaStops: many.status === 200 && many.body.match === null && many.body.remaining === 0,
          over429: over.status === 429,
          license: a.body.license === 'CC BY-SA 4.0'
        };
        // Relais Metron (Metron simulé) : édition exacte, numéro, série, cache, authentification, non configuré
        const mCalls = [];
        const resp = (status, data) => ({ status, ok: status >= 200 && status < 300, headers: { get: k => (k === 'x-ratelimit-sustained-remaining' ? '4990' : k === 'retry-after' ? '60' : null) }, json: async () => data });
        const LIST = { results: [{ id: 127884, series: { id: 1, name: 'Absolute Batman', volume: 1, year_began: 2024 } }] };
        const DETAIL = { id: 127884, number: '1', cover_date: '2024-12-01', upc: '76194138584600111', image: 'https://static.metron.cloud/a.jpg', price: '4.99', publisher: { name: 'DC Comics' }, series: { name: 'Absolute Batman', volume: 1, year_began: 2024 }, cover_hash: 'e284c8ade52d272f',
          variants: [{ name: 'Cover J Jim Lee Foil Virgin Variant', upc: '76194138584600138', image: 'https://static.metron.cloud/j.jpg', price: '7.99' }] };
        let authHeader = '';
        srv.setMetronForTest(async (url, headers) => {
          mCalls.push(url); authHeader = headers.Authorization;
          if (url.includes('upc=76194138584600138') || url.includes('upc_starts_with=761941385846')) return resp(200, LIST);
          if (url.endsWith('/issue/127884/')) return resp(200, DETAIL);
          return resp(200, { results: [] });
        }, { username: 'u', password: 'p' });
        const mget = async q => { const res = await fetch('http://127.0.0.1:8099/api/metron/' + q); return { status: res.status, body: await res.json() }; };
        const m1 = await mget('scan?code=76194138584600138&issue=1');
        const n1 = mCalls.length;
        await mget('scan?code=76194138584600138&issue=1');
        const m2 = await mget('scan?code=76194138584600199&issue=1');
        const m3 = await mget('scan?code=761941385846');
        const mBad = await mget('scan?code=12ab');
        t20.metronExact = m1.status === 200 && m1.body.found === 'exact' && m1.body.edition.name === 'Cover J Jim Lee Foil Virgin Variant' && m1.body.issue.series.name === 'Absolute Batman' && m1.body.issue.editions.length === 2 && authHeader === 'Basic dTpw';
        t20.metronCached = n1 === 2 && mCalls.length >= n1 && mCalls.slice(n1).every(u => !u.includes('upc=76194138584600138'));
        t20.metronIssue = m2.body.found === 'issue' && m2.body.issue.number === '1';
        t20.metronSeries = m3.body.found === 'series' && m3.body.series.year_began === 2024;
        t20.metronBadParams = mBad.status === 400;
        srv.setMetronForTest(async () => resp(401, {}), { username: 'u', password: 'x' });
        const m4 = await mget('scan?code=76194138584600111&issue=1');
        const m5 = await mget('status');
        t20.metronAuth = m4.status === 401 && m5.body.configured === true && m5.body.authFailed === true;
        srv.setMetronForTest(async () => resp(200, {}), null);
        const m6 = await mget('scan?code=76194138584600111');
        t20.metronNotConfigured = m6.status === 503 && /--metron/.test(m6.body.error);
        // Relais Comic Vine : la clé est ajoutée côté serveur ; celle envoyée par le client est ignorée
        let cvUrl = '';
        srv.setCvForTest(async url => { cvUrl = url; return { json: async () => ({ status_code: 1, results: [{ name: 'Absolute Batman' }] }) }; }, 'CLESERVEUR');
        const cvOk = await (await fetch('http://127.0.0.1:8099/api/cv/search?resources=volume&query=Batman&api_key=PIRATE')).json();
        const cvBad = await fetch('http://127.0.0.1:8099/api/cv/users');
        srv.setCvForTest(async () => ({ json: async () => ({}) }), '');
        const cvNoKey = await fetch('http://127.0.0.1:8099/api/cv/search?query=x');
        t20.cvRelay = cvOk.status_code === 1 && /api_key=CLESERVEUR/.test(cvUrl) && !/PIRATE/.test(cvUrl) && /format=json/.test(cvUrl) && cvBad.status === 400 && cvNoKey.status === 503;
        const src = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
        t20.noKeyInClient = !/DEFAULT_CV_KEY/.test(src) && !/['"][0-9a-f]{40}['"]/.test(src);
      } catch (e) { t20 = { error: String(e && e.message || e) }; }
      try { require('./serve.js').close(); } catch (_) {}
      console.log('Résultat Test 20:', JSON.stringify(t20));
      testResults.push({
        test: 'Relais GCD local : édition exacte par code-barres, fiches lues au besoin, cache, quota 25/h, paramètres validés',
        ok: !!t20 && !t20.error && ['exact', 'lazyDetails', 'cached', 'mainCached', 'badParams', 'quotaStops', 'over429', 'license', 'metronExact', 'metronCached', 'metronIssue', 'metronSeries', 'metronBadParams', 'metronAuth', 'metronNotConfigured', 'cvRelay', 'noKeyInClient'].every(k => t20[k] === true)
      });

      // ==========================================
      // TEST 21 : Relais intégré à l'app Android (Metron + GCD en HTTP natif simulé)
      // ==========================================
      console.log('\n[TEST 21] Relais intégré à l\'app Android (Metron, GCD, identifiants, quotas)...');
      const t21 = await evalExpr(`(async () => {
        const P = window.Panel;
        const calls = [];
        let lastAuth = '';
        const resp = (status, data, hdr = {}) => ({ status, ok: status >= 200 && status < 300, header: k => hdr[k] ?? null, data });
        const DETAIL = { id: 127884, number: '1', cover_date: '2024-12-01', upc: '76194138584600111', image: 'https://static.metron.test/a.jpg', price: '4.99', publisher: { name: 'DC Comics' }, series: { name: 'Absolute Batman', year_began: 2024 },
          variants: [{ name: 'Cover J Jim Lee Foil Virgin Variant', upc: '76194138584600138', image: 'https://static.metron.test/j.jpg', price: '7.99' }] };
        P.setNativeHttpForTest(async (url, headers) => {
          calls.push(url);
          if (url.startsWith('https://metron.cloud/api')) {
            lastAuth = headers.Authorization;
            if (headers.Authorization !== 'Basic ' + btoa('u:p')) return resp(401, {});
            if (url.includes('upc=76194138584600138') || url.includes('upc=76194138584600111')) return resp(200, { results: [{ id: 127884, series: DETAIL.series }] }, { 'x-ratelimit-sustained-remaining': '4990' });
            if (url.endsWith('/issue/127884/')) return resp(200, DETAIL);
            return resp(200, { results: [] });
          }
          if (url.includes('comics.org/api/series/name/')) return resp(200, { next: null, results: [
            { api_url: 'https://www.comics.org/api/issue/1/?format=json', descriptor: '1 [Nick Dragotta Cover]', variant_of: null, price: '4.99 USD' },
            { api_url: 'https://www.comics.org/api/issue/3/?format=json', descriptor: '1 [Jim Lee Foil Variant Cover]', variant_of: 'x', price: '7.99 USD' } ] });
          if (url.includes('comics.org/api/issue/3/')) return resp(200, { barcode: '76194138584600138', variant_name: '' });
          if (url.includes('comics.org/api/issue/1/')) return resp(200, { barcode: '76194138584600111', variant_name: '' });
          return resp(404, {});
        });
        const r = {};
        const notConf = await P.appRoute('app:/metron/scan?code=76194138584600138&issue=1');
        r.notConfigured = notConf.status === 503;
        const bad = await P.appRelay.metronLogin('u', 'bad');
        r.badLoginNotSaved = !bad.ok && !localStorage.getItem('panel_metron_creds');
        const good = await P.appRelay.metronLogin('u', 'p');
        r.loginSaved = good.ok && JSON.parse(localStorage.getItem('panel_metron_creds')).username === 'u';
        const m1 = await P.appRoute('app:/metron/scan?code=76194138584600138&issue=1');
        r.metronExact = m1.found === 'exact' && m1.edition.name === 'Cover J Jim Lee Foil Virgin Variant' && m1.issue.series.name === 'Absolute Batman' && lastAuth === 'Basic ' + btoa('u:p') && m1.remaining === 4990;
        const n = calls.length;
        await P.appRoute('app:/metron/scan?code=76194138584600138&issue=1');
        r.metronCached = calls.length === n;
        const g = await P.appRoute('app:/gcd/issues?series=Absolute%20Batman&issue=1&year=2024&barcode=76194138584600138');
        r.gcdExact = !!g.match && g.match.variant_name === 'Jim Lee Foil Variant' && g.license === 'CC BY-SA 4.0';
        const st = await P.appRoute('app:/metron/status');
        r.status = st.configured === true && st.authFailed === false;
        P.appRelay.gcdCalls = Array(25).fill(Date.now());
        const q = await P.appRoute('app:/gcd/issues?series=Other&issue=2&year=2024');
        r.gcdQuota = q.status === 429;
        r.webModeUnchanged = !document.documentElement.classList.contains('native-app');
        P.setNativeHttpForTest(async () => resp(500, {}));
        return r;
      })()`);
      console.log('Résultat Test 21:', t21);
      testResults.push({
        test: 'App Android : relais intégré (Metron identifiants vérifiés avant enregistrement, édition exacte, cache, GCD, quota)',
        ok: !!t21 && ['notConfigured', 'badLoginNotSaved', 'loginSaved', 'metronExact', 'metronCached', 'gcdExact', 'status', 'gcdQuota', 'webModeUnchanged'].every(k => t21[k] === true)
      });

      // ==========================================
      // TEST 22 : Protection des données (vérification en lecture seule, restauration sûre, instantané, retour arrière)
      // ==========================================
      console.log('\n[TEST 22] Protection des données (Vérifier, restauration fusion/remplacement, instantané, échec)...');
      const t22 = await evalExpr(`(async () => {
        const P = window.Panel;
        const r = {};
        const origAlert = window.alert, origConfirm = window.confirm;
        window.alert = () => {}; window.confirm = () => true;
        const base = { publisher: 'DC Comics', condition: 'NM 9.4 (Near Mint)', addedAt: '2026-01-01T00:00:00.000Z', variant: 'Cover A' };
        const mine = [ { ...base, id: 'k1', series: 'Absolute Batman (2024)', issue: '#1', notes: 'à moi' }, { ...base, id: 'k2', series: 'Absolute Batman (2024)', issue: '#2' } ];
        P.setPhysicalSingles(JSON.parse(JSON.stringify(mine)));
        // Données numériques conservées : ne doivent jamais bouger
        localStorage.setItem('panel_bookmarks', JSON.stringify([{ signature: 'sig-test', page: 3 }]));
        localStorage.setItem('panel_reading_positions', JSON.stringify({ 'p_test': 5 }));
        const bmBefore = localStorage.getItem('panel_bookmarks'), posBefore = localStorage.getItem('panel_reading_positions');
        const countPages = async () => { const db = await new Promise(res => { const q = indexedDB.open('panel-library'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); if (!db) return -1; return new Promise(res => { const q = db.transaction('pages', 'readonly').objectStore('pages').count(); q.onsuccess = () => { res(q.result); db.close(); }; q.onerror = () => { res(-2); db.close(); }; }); };
        const pagesBefore = await countPages();

        // A. « Vérifier les données » : lecture seule
        document.getElementById('cleanDbBtn').click();
        await new Promise(res => setTimeout(res, 150));
        r.checkReadOnly = P.getPhysicalSingles().length === 2 && (await countPages()) === pagesBefore && localStorage.getItem('panel_bookmarks') === bmBefore && localStorage.getItem('panel_reading_positions') === posBefore;
        const integ = P.checkDataIntegrity();
        r.integrity = integ.singles === 2 && integ.duplicateIds === 0;

        // B. Validation des fichiers
        const throws = d => { try { P.validateBackupPayload(d); return false; } catch (e) { return true; } };
        r.rejectsBad = throws(null) && throws({ foo: 1 }) && throws({ format: 'panel-backup', version: 9, physicalSingles: [] }) && throws({ physicalSingles: [{}, { nope: true }] }) && throws({ format: 'autre', physicalSingles: [] });
        const payload = P.validateBackupPayload({ format: 'panel-backup', version: 3, exportedAt: '2026-11-01T10:00:00Z',
          physicalSingles: [ { ...base, id: 'k1', series: 'Absolute Batman (2024)', issue: '#1', notes: 'version sauvegarde' }, { ...base, id: 'k3', series: 'Absolute Flash (2025)', issue: '#5' }, { broken: true } ],
          seriesMeta: { 'absolute flash': { pull: true, name: 'Absolute Flash' } }, bookmarks: [{ signature: 'autre', page: 1 }], readingPositions: { x: 1 } });
        r.validated = payload.items.length === 2 && payload.invalid.length === 1 && payload.digitalKeys.length === 2;

        // C. Fusion (défaut) : ajoute, ne modifie rien d'existant, instantané pris
        const newestBefore = ((await P.listSnapshots())[0] || {}).id;
        const m = await P.applyBackupRestore(payload);
        const L = () => P.getPhysicalSingles();
        r.merge = m.ok && m.mode === 'merge' && m.added === 1 && m.conflicts === 1 && L().length === 3 && L().find(x => x.id === 'k1').notes === 'à moi' && !!P.getSeriesMeta()['absolute flash'];
        const snaps = await P.listSnapshots();
        r.snapshot = snaps[0].id !== newestBefore && snaps[0].id === m.snapshotId && snaps[0].count === 2 && /fusion/.test(snaps[0].reason) && !!snaps[0].seriesMeta;
        r.digitalUntouched = localStorage.getItem('panel_bookmarks') === bmBefore && localStorage.getItem('panel_reading_positions') === posBefore;

        // D. Remplacement explicite, puis retour à l'instantané
        const rep = await P.applyBackupRestore(payload, { mode: 'replace' });
        r.replace = rep.ok && L().length === 2 && L().every(x => x.id !== 'k2');
        await P.restoreSnapshot(rep.snapshotId);
        r.undoReplace = L().length === 3 && !!L().find(x => x.id === 'k2');

        // E. Échec d'écriture : retour automatique à l'état précédent
        const beforeFail = JSON.stringify(L());
        const fail = await P.applyBackupRestore(payload, { mode: 'replace', persist: () => { throw new Error('disque plein (simulé)'); } });
        r.rollback = !fail.ok && fail.rolledBack === true && JSON.stringify(L()) === beforeFail;
        r.digitalStillUntouched = localStorage.getItem('panel_bookmarks') === bmBefore && localStorage.getItem('panel_reading_positions') === posBefore && (await countPages()) === pagesBefore;

        window.alert = origAlert; window.confirm = origConfirm;
        localStorage.removeItem('panel_bookmarks'); localStorage.removeItem('panel_reading_positions');
        return r;
      })()`);
      console.log('Résultat Test 22:', t22);
      testResults.push({
        test: 'Protection des données : « Vérifier » sans suppression, sauvegardes validées, fusion par défaut, instantané, annulation, retour arrière sur échec, numérique intact',
        ok: !!t22 && ['checkReadOnly', 'integrity', 'rejectsBad', 'validated', 'merge', 'snapshot', 'digitalUntouched', 'replace', 'undoReplace', 'rollback', 'digitalStillUntouched'].every(k => t22[k] === true)
      });

      // ==========================================
      // TEST 23 : XSS — données importées et réponses d'API piégées (recherche globale, recherche Comic Vine)
      // ==========================================
      console.log('\n[TEST 23] XSS (couvertures, titres importés, réponses Comic Vine piégées)...');
      const t23 = await evalExpr(`(async () => {
        const P = window.Panel;
        const r = {};
        window.__xss = 0;
        const evilUrl = 'https://x.test/a.jpg" onerror="window.__xss=1';
        const evilTxt = '<img src=x onerror="window.__xss=2">';
        r.helper = P.safeImgSrc('javascript:alert(1)') === '' && !/"/.test(P.safeImgSrc(evilUrl).replace(/&quot;/g, ''));
        // 1. Recherche globale : couverture et titre importés malveillants
        P.setPhysicalSingles([{ id: 'x1', series: 'Zorglub ' + evilTxt, issue: '#1', publisher: 'DC Comics', variant: evilTxt, coverUrl: evilUrl, condition: 'NM 9.4 (Near Mint)', addedAt: '2026-01-01T00:00:00Z' }]);
        const gs = document.getElementById('globalSearch');
        gs.value = 'Zorglub'; gs.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(res => setTimeout(res, 400));
        const menu = document.getElementById('searchResultsMenu');
        r.globalSearch = !!menu && menu.textContent.includes('Zorglub') && !menu.querySelector('[onerror*="__xss"]') && !menu.querySelector('img[src*="x.test"][onerror*="__xss"]');
        gs.value = ''; gs.dispatchEvent(new Event('input', { bubbles: true }));
        // 2. Recherche Comic Vine : réponse d'API piégée
        P.setCvFetcherForTest(async () => ({ status_code: 1, results: [{ id: 9, name: evilTxt, issue_number: '1', volume: { name: 'Vol ' + evilTxt, id: 3 }, image: { medium_url: evilUrl, super_url: evilUrl }, cover_date: '2024-01-01' }] }), 0);
        const prevCvKey = localStorage.getItem('panel_comicvine_key'); localStorage.setItem('panel_comicvine_key', 'test-key');
        document.getElementById('openComicVineSearchModalBtn').click();
        const cvIn = document.getElementById('cvSearchInput');
        cvIn.value = 'Batman';
        document.getElementById('cvSearchExecuteBtn').click();
        await new Promise(res => setTimeout(res, 600));
        const modal = document.getElementById('comicVineSearchModal');
        r.cvModal = !!modal && !modal.querySelector('[onerror*="__xss"]') && !modal.innerHTML.includes('<img src=x');
        modal && modal.classList.remove('open');
        if (prevCvKey == null) localStorage.removeItem('panel_comicvine_key'); else localStorage.setItem('panel_comicvine_key', prevCvKey);
        await new Promise(res => setTimeout(res, 200));
        r.noExecution = window.__xss === 0;
        P.resetCvStateForTest();
        return r;
      })()`);
      console.log('Résultat Test 23:', t23);
      testResults.push({
        test: 'XSS : adresses d\'images et titres piégés (import, Comic Vine) affichés sans exécution',
        ok: !!t23 && ['helper', 'globalSearch', 'cvModal', 'noExecution'].every(k => t23[k] === true)
      });

      // ==========================================
      // TEST 24 : Catalogue normalisé (lot 2.1) — migration additive, intégrité, idempotence, retour arrière, durabilité IndexedDB
      // ==========================================
      console.log('\n[TEST 24] Catalogue normalisé : migration, vérification, idempotence, retour arrière, durabilité...');
      const locgPath = 'C:/Users/tadeo/Downloads/ComicGeeks-2026-11-04-14-34-02.xlsx';
      const locgB64 = fs.existsSync(locgPath) ? fs.readFileSync(locgPath).toString('base64') : '';
      const t24 = await evalExpr(`(async (locgB64) => {
        const P = window.Panel;
        const C = P.catalog;
        const r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const savedSingles = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        const H = 'https://covers.example.test/';
        const base = { condition: 'NM 9.4 (Near Mint)', keyType: 'none', isRead: false, rating: 0, isWishlist: false, notes: '', addedAt: '2026-01-01T00:00:00Z' };
        const fixture = [
          { ...base, id: 'f1', series: 'Absolute Batman (2024)', issue: '#1', publisher: 'DC Comics', variant: 'Cover A', coverUrl: H + 'ab1.jpg', coverMeta: { source: 'fandom', exact: true }, upc: '76194138470100111', purchasePrice: 4.99, purchaseDate: '2024-10-09', box: 'Boîte 1', divider: 'A', location: 'Bureau', valueHistory: [{ at: '2025-01-01', v: 12 }], estValue: 12, valueSource: 'auto' },
          { ...base, id: 'f2', series: 'Absolute Batman (2024)', issue: '#1', publisher: 'DC Comics', variant: 'Cover A', condition: 'CGC 9.8', notes: 'second exemplaire', box: 'Boîte 2' },
          { ...base, id: 'f3', series: 'Absolute Batman (2024)', issue: '#1', publisher: 'DC Comics', variant: 'Cover J Jim Lee Foil Virgin Variant', coverUrl: H + 'ab1-j.jpg', coverMeta: { source: 'comicvine' }, comicVineId: '4000-101' },
          { ...base, id: 'f4', series: 'Absolute Batman (2024)', issue: '#2', publisher: 'DC', variant: '', isWishlist: true },
          { ...base, id: 'f5', series: 'Absolute Batman (2025)', issue: '', publisher: 'DC Comics', variant: 'Tome 1: Le Zoo HC', coverPrice: 20 },
          { ...base, id: 12345, series: 'Spawn', issue: '#300', publisher: 'Image Comics', variant: 'Cover A', upc: '70985300000330011', customFoo: { keep: [1, 2] } },
          { ...base, id: 'f7', series: 'Spawn (1992)', issue: '#1.5', publisher: 'Image', variant: 'Regular', upc: '70985300000330011' },
          { ...base, id: 'f8', series: 'X-Men (2024)', issue: 'Annual #1', publisher: 'Marvel', variant: 'Cover A', coverUrl: 'data:image/jpeg;base64,AAAA', signedBy: 'Artiste', metronId: 'm-77' },
          { ...base, id: 'f8', series: 'X-Men (2024)', issue: '#1', publisher: 'Marvel', variant: 'Cover A' },
          { ...base, series: 'Sans Identifiant', issue: '#1', publisher: '', variant: 'Cover A' }
        ];
        const pullBefore = !!(P.getSeriesMeta()['absolute batman'] && P.getSeriesMeta()['absolute batman'].pull);
        P.togglePull('Absolute Batman (2024)', true);
        P.setPhysicalSingles(JSON.parse(JSON.stringify(fixture)));
        await wait(300);
        const legacyJson = JSON.stringify(P.getPhysicalSingles());
        // 1. Migration complète sur données représentatives
        await C.rollback();
        const m = await C.enable();
        const v = await C.verify();
        const cat = await C.read();
        r.migration = m.ok === true && m.status === 'ok' && !!m.backupId && !!m.snapshotId && m.legacyUntouched === true;
        r.verify = v.ok === true && v.copies === fixture.length && v.legacyCount === fixture.length;
        r.normalized = cat.publishers.length === 6 && cat.copies.length === 10 &&
          cat.variants.some(x => x.name === 'Cover J Jim Lee Foil Virgin Variant') &&
          cat.copies.filter(x => x.variantId === cat.copies.find(c => c.legacyId === 'f1').variantId).length === 2;
        const ab1 = cat.variants.find(x => x.covers.some(c => c.url === H + 'ab1.jpg'));
        r.provenance = !!ab1 && ab1.covers[0].provider === 'fandom' && ab1.externalIds.some(e => e.provider === 'upc' && e.value === '76194138470100111') &&
          cat.variants.some(x => x.externalIds.some(e => e.provider === 'comicvine' && e.value === '4000-101')) &&
          cat.variants.some(x => x.externalIds.some(e => e.provider === 'metron' && e.value === 'm-77')) &&
          !cat.variants.some(x => x.covers.some(c => /^data:/.test(c.url)));
        r.copyFields = (() => { const c = cat.copies.find(x => x.legacyId === 'f1'); return !!c && c.personal.purchasePrice === 4.99 && c.personal.box === 'Boîte 1' && c.personal.location === 'Bureau' && c.personal.valueHistory.length === 1 && c.status === 'owned'; })() &&
          cat.copies.find(x => x.legacyId === 'f4').status === 'wishlist' && cat.copies.find(x => x.legacyId === '12345').extra.customFoo.keep[1] === 2;
        r.timestamps = cat.copies.every(x => x.createdAt && x.updatedAt && x.id.startsWith('cpy_')) && cat.series.every(x => x.createdAt && x.updatedAt);
        r.pull = cat.series.some(x => x.name === 'Absolute Batman (2024)' && x.pull === true);
        const st = await C.status();
        const types = new Set((st.state.duplicates || []).map(d => d.type));
        r.duplicatesFlagged = types.has('editeurs-proches') && types.has('identifiant-externe-partage') && types.has('serie-annee-manquante');
        r.anomalies = (st.state.anomalies || []).some(a => a.type === 'identifiant-en-double') && (st.state.anomalies || []).some(a => a.type === 'fiche-sans-identifiant');
        r.backup = st.backups.some(b => b.id === m.backupId && b.count === fixture.length);
        r.legacyUntouched = JSON.stringify(P.getPhysicalSingles()) === legacyJson;
        // 2. Idempotence : relancer ne crée rien et ne change pas les dates
        const stamp = new Map(cat.variants.map(x => [x.id, x.updatedAt]));
        await wait(20);
        const m2 = await C.migrate({ force: true });
        const cat2 = await C.read();
        r.idempotent = m2.ok && CATALOG_COUNT(cat2) === CATALOG_COUNT(cat) && cat2.variants.every(x => stamp.get(x.id) === x.updatedAt);
        function CATALOG_COUNT(c) { return ['publishers', 'series', 'issues', 'variants', 'copies'].map(k => c[k].length).join('/'); }
        // 3. Synchronisation incrémentale : une modification, une suppression (pierre tombale, pas d'effacement)
        const list = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        list.find(x => x.id === 'f2').notes = 'modifié';
        const removed = list.splice(list.findIndex(x => x.id === 'f7'), 1);
        P.setPhysicalSingles(list);
        await C.sync();
        const cat3 = await C.read();
        const before = new Map(cat2.copies.map(x => [x.legacyId + '~' + x.legacyOccurrence, x.updatedAt]));
        const changed = cat3.copies.filter(x => before.get(x.legacyId + '~' + x.legacyOccurrence) !== x.updatedAt).map(x => x.legacyId).sort();
        r.changedCopies = changed;
        r.incremental = changed.join(',') === 'f2,f7' && cat3.copies.find(x => x.legacyId === 'f7').deletedAt && cat3.variants.length === cat2.variants.length && (await C.verify()).ok;
        // 3b. Réapparition : la fiche supprimée revient → même exemplaire, pierre tombale levée, date de création conservée
        const tomb = cat3.copies.find(x => x.legacyId === 'f7');
        P.setPhysicalSingles(P.getPhysicalSingles().concat(removed));
        await C.sync();
        const revived = (await C.read()).copies.find(x => x.legacyId === 'f7');
        r.tombstoneRevival = !!revived && revived.id === tomb.id && revived.deletedAt === null && revived.createdAt === tomb.createdAt && (await C.verify()).ok;
        // 4. Retour arrière : seul le catalogue dérivé est vidé ; collection intacte ; plus de migration automatique
        const listJson = JSON.stringify(P.getPhysicalSingles());
        const rb = await C.rollback();
        const catRb = await C.read();
        const skip = await C.migrate();
        r.rollback = rb.ok && rb.legacyUntouched && CATALOG_COUNT(catRb) === '0/0/0/0/0' && JSON.stringify(P.getPhysicalSingles()) === listJson && !!skip.skipped && (await C.status()).backups.length >= 1;
        const again = await C.enable();
        r.reEnable = again.ok && (await C.verify()).ok;
        // 5. Durabilité : localStorage plein → IndexedDB garde la version récente et la reprend au démarrage
        const seenIds = new Set();
        const clean = JSON.parse(JSON.stringify(P.getPhysicalSingles())).filter(x => x.id !== undefined && !seenIds.has(x.id) && seenIds.add(x.id));
        P.setPhysicalSingles(clean);
        await wait(400);
        const newer = JSON.parse(JSON.stringify(clean));
        const realSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, val) { if (k === 'panel_physical_singles') throw new DOMException('quota', 'QuotaExceededError'); return realSet.call(this, k, val); };
        newer.unshift({ ...base, id: 'f-new', series: 'Nouveauté', issue: '#1', publisher: 'DC Comics', variant: 'Cover A' });
        try { P.setPhysicalSingles(newer); } finally { Storage.prototype.setItem = realSet; }
        await wait(500);
        const stale = JSON.parse(localStorage.getItem('panel_physical_singles'));
        P.setSinglesInMemoryForTest(stale);
        const rec = await P.recoverSinglesFromIdb();
        const after = P.getPhysicalSingles();
        r.durability = !stale.some(x => x.id === 'f-new') && rec.source === 'indexeddb' && after[0].id === 'f-new' && after.length === stale.length + 1 &&
          JSON.parse(localStorage.getItem('panel_physical_singles')).length === after.length;
        r.durabilityDetail = { rec, staleLen: stale.length, afterLen: after.length, first: after[0] && after[0].id, lsLen: JSON.parse(localStorage.getItem('panel_physical_singles')).length, staleHasNew: stale.some(x => x.id === 'f-new') };
        const rec2 = await P.recoverSinglesFromIdb();
        r.durabilityStable = rec2.source === 'localStorage';
        // 5b. Sécurisation : copie complète (fiches sans identifiant / en double), coupure, échec de migration, sauvegardes
        const rawDb = () => new Promise((res, rej) => { const q = indexedDB.open('panel-catalog'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
        const rawGet = async (store, key) => { const d = await rawDb(); return new Promise(res => { const q = d.transaction(store).objectStore(store).get(key); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); };
        const rawPut = async (store, val) => { const d = await rawDb(); return new Promise(res => { const t = d.transaction(store, 'readwrite'); t.objectStore(store).put(val); t.oncomplete = () => res(true); t.onerror = () => res(false); }); };
        const bk = await rawGet('backups', m.backupId);
        r.backupContent = !!bk && JSON.stringify(bk.physicalSingles) === legacyJson && Array.isArray(bk.physicalSingles);
        const dirty = JSON.parse(legacyJson);
        P.setPhysicalSingles(dirty);
        await wait(400);
        r.idReport = (() => { const ir = C.idReport(); return ir.affected === 2 && ir.items.some(x => x.reason === 'identifiant-en-double' && x.id === 'f8') && ir.items.some(x => x.reason === 'sans-identifiant') && ir.applied === false; })();
        const dirtyNewer = [{ ...base, id: 'f-new2', series: 'Nouveauté', issue: '#2', publisher: 'DC Comics', variant: 'Cover A' }].concat(JSON.parse(legacyJson));
        Storage.prototype.setItem = function (k, val) { if (k === 'panel_physical_singles') throw new DOMException('quota', 'QuotaExceededError'); return realSet.call(this, k, val); };
        try { P.setPhysicalSingles(dirtyNewer); } finally { Storage.prototype.setItem = realSet; }
        await wait(500);
        P.setSinglesInMemoryForTest(JSON.parse(localStorage.getItem('panel_physical_singles')));
        const recD = await P.recoverSinglesFromIdb();
        r.completeRecovery = recD.source === 'indexeddb' && recD.complete === true && JSON.stringify(P.getPhysicalSingles()) === JSON.stringify(dirtyNewer);
        // Coupure simulée : copie IndexedDB tronquée (total ≠ nombre de fiches) → ignorée, collection locale conservée
        const fullRec = await rawGet('meta', 'singlesFull');
        await rawPut('meta', Object.assign({}, fullRec, { rev: fullRec.rev + 1000, items: fullRec.items.slice(0, 3) }));
        const beforeCut = JSON.stringify(P.getPhysicalSingles());
        const recCut = await P.recoverSinglesFromIdb();
        r.interrupted = recCut.source !== 'indexeddb' && JSON.stringify(P.getPhysicalSingles()) === beforeCut;
        P.setPhysicalSingles(JSON.parse(legacyJson));
        await wait(400);
        // Échec de migration forcé : collection intacte, catalogue vidé, pas de nouvelle tentative automatique
        const bkCount0 = (await C.status()).backups.length;
        const legacyNow = JSON.stringify(P.getPhysicalSingles());
        const fail = await C.migrate({ force: true, simulateFailure: true });
        const catFail = await C.read();
        const retry = await C.migrate();
        r.migrationFailure = fail.ok === false && fail.status === 'failed' && CATALOG_COUNT(catFail) === '0/0/0/0/0' && JSON.stringify(P.getPhysicalSingles()) === legacyNow && !!retry.skipped;
        const recovered = await C.migrate({ force: true });
        r.backupsKept = recovered.ok && (await C.status()).backups.length === bkCount0 + 2;
        // 6. Données réelles : export League of Comic Geeks de l'utilisateur (lecture seule, résultats chiffrés uniquement)
        if (locgB64) {
          const bin = atob(locgB64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
          const parsed = await P.parseXlsxBuffer(buf.buffer);
          const conv = P.convertCsvRows(parsed, P.detectCsvMapping(parsed.headers), { source: P.detectCsvSource(parsed.headers) });
          P.setPhysicalSingles(conv.items);
          const t0 = performance.now();
          const mr = await C.migrate({ force: true });
          const vr = await C.verify();
          r.realLocg = { rows: parsed.rows.length, singles: conv.items.length, ok: mr.ok && vr.ok, copies: vr.copies, publishers: vr.publishers, series: vr.series, issues: vr.issues, variants: vr.variants, duplicates: (vr.duplicates || []).length, ms: Math.round(performance.now() - t0) };
          r.realOk = r.realLocg.ok && vr.copies === conv.items.length;
        } else { r.realLocg = 'fichier absent (ignoré)'; r.realOk = true; }
        // Nettoyage : collection du profil de test restaurée, catalogue resynchronisé
        P.setPhysicalSingles(savedSingles);
        P.togglePull('Absolute Batman (2024)', pullBefore);
        await C.migrate({ force: true });
        r.cleanup = (await C.verify()).ok;
        return r;
      })(` + JSON.stringify(locgB64) + `)`);
      console.log('Résultat Test 24:', JSON.stringify(t24));
      testResults.push({
        test: 'Catalogue normalisé : migration additive vérifiée, provenance, doublons signalés, idempotence, synchro, retour arrière, durabilité IndexedDB, export LoCG réel',
        ok: !!t24 && ['migration', 'verify', 'normalized', 'provenance', 'copyFields', 'timestamps', 'pull', 'duplicatesFlagged', 'anomalies', 'backup', 'legacyUntouched', 'idempotent', 'incremental', 'rollback', 'reEnable', 'durability', 'durabilityStable', 'tombstoneRevival', 'backupContent', 'idReport', 'completeRecovery', 'interrupted', 'migrationFailure', 'backupsKept', 'realOk', 'cleanup'].every(k => t24[k] === true)
      });

      // ==========================================
      // TEST 25 : Exemplaires et variantes (lot 2.2) — normalisation, regroupement, saisie structurée, restauration fidèle
      // ==========================================
      console.log('\n[TEST 25] Exemplaires et variantes : normalisation, regroupement, saisie structurée...');
      const t25 = await evalExpr(`(async () => {
        const P = window.Panel, C = P.catalog, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const saved = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        const N = C.normalizeCopy;
        const a = N({ condition: 'CGC 9.8 (Certifié)' });
        const b = N({ condition: 'CGC Signature Series', notes: 'Signé par Jim Lee | Certificat slab n° 4123 | Acheté chez Convention' });
        const c = N({ condition: 'NM 9.4 (Near Mint)', purchasePrice: '3.5', purchaseDate: '2025-02-01' });
        const d = N({ condition: 'VF/NM 9.0', gradingCompany: 'cbcs', grade: '9,6', signedBy: 'Artiste', signatureAuth: 'JSA', store: 'Boutique', keyType: 'signed' });
        const e = N({ condition: 'NM 9.4 (Near Mint)', notes: 'Slab (société de gradation non précisée)' });
        r.normalize = a.grade.company === 'CGC' && a.grade.value === 9.8 && a.grade.slabbed && a.grade.labelType === 'universal' && !a.signature.signed &&
          b.grade.labelType === 'signature' && b.signature.signed && b.signature.by === 'Jim Lee' && b.signature.authenticated === 'CGC Signature Series' && b.grade.certNumber === '4123' && b.purchase.store === 'Convention' && b.fromNotes.length === 3 &&
          c.grade.scale === 'estime' && c.grade.label === 'NM' && c.grade.value === 9.4 && c.purchase.price === 3.5 && c.purchase.date === '2025-02-01' && c.purchase.currency === 'USD' &&
          d.grade.company === 'CBCS' && d.grade.value === 9.6 && d.signature.by === 'Artiste' && d.signature.authenticated === 'JSA' && d.purchase.store === 'Boutique' &&
          e.grade.slabbed && e.grade.company === null;
        const base = { condition: 'NM 9.4 (Near Mint)', keyType: 'none', isWishlist: false, notes: '', addedAt: '2026-01-01T00:00:00Z', box: 'Boîte 1' };
        const fixture = [
          { ...base, id: 'g1', series: 'Groupe Test (2024)', issue: '#1', publisher: 'DC Comics', variant: 'Cover A', purchasePrice: 4 },
          { ...base, id: 'g2', series: 'Groupe Test (2024)', issue: '#1', publisher: 'DC Comics', variant: 'Regular', condition: 'CGC 9.8 (Certifié)', box: 'Boîte 2' },
          { ...base, id: 'g3', series: 'Groupe Test (2024)', issue: '#1', publisher: 'DC Comics', variant: 'Cover B Virgin' },
          { ...base, id: 'g4', series: 'Groupe Test (2024)', issue: '#1', publisher: 'DC Comics', variant: 'Cover A', isWishlist: true }
        ];
        P.setPhysicalSingles(JSON.parse(JSON.stringify(fixture)));
        await wait(300);
        const m = await C.migrate({ force: true });
        const cat = await C.read();
        r.catalog = m.ok && (await C.verify()).ok && cat.copies.filter(x => !x.deletedAt).every(x => x.normalized && x.normalized.grade && x.variantId === C.idsOf(C.copyToLegacy(x)).variantId) &&
          cat.copies.find(x => x.legacyId === 'g2').normalized.grade.company === 'CGC' &&
          new Set(cat.copies.filter(x => ['g1', 'g2', 'g4'].includes(x.legacyId)).map(x => x.variantId)).size === 1;
        r.grouping = C.variantCopies(fixture[0]).length === 3 && C.variantCopies(fixture[2]).length === 1;
        P.renderSinglesCollection();
        await wait(100);
        const el1 = document.querySelector('[data-sid="g1"]'), el3 = document.querySelector('[data-sid="g3"]'), el4 = document.querySelector('[data-sid="g4"]');
        r.badge = !el1 || ((el1.innerHTML.includes('×2')) && (!el3 || !el3.innerHTML.includes('×')) && (!el4 || !el4.innerHTML.includes('×2')));
        r.badgeSeen = !!el1;
        P.openSingleInspector(P.getPhysicalSingles().find(x => x.id === 'g1'));
        const box = document.getElementById('inspectCopiesBox');
        r.inspector = !!box && box.textContent.includes('Exemplaires de cette variante (3)') && box.textContent.includes('CGC 9.8') && box.querySelectorAll('[data-copy-idx]').length === 3;
        const modal = box && box.closest('.modal, .modal-overlay, [class*="modal"]');
        if (modal) modal.classList.remove('open');
        // Saisie structurée : société + note → liste « Condition » mise à jour ; enregistrement des champs
        const $ = id => document.getElementById(id);
        const fire = el => el.dispatchEvent(new Event('change', { bubbles: true }));
        $('singleSeriesInput').value = 'Saisie Grading Test'; $('singleIssueInput').value = '#7'; $('singleVariantNameInput').value = 'Cover A';
        $('singleGradingCompanySelect').value = 'CBCS'; fire($('singleGradingCompanySelect'));
        $('singleGradeInput').value = '9.6'; fire($('singleGradeInput'));
        const condAfter = $('singleConditionSelect').value;
        $('singleLabelTypeSelect').value = 'signature'; $('singleCertNumberInput').value = 'C-77'; $('singleSignedByInput').value = 'Artiste';
        $('singleSignatureAuthSelect').value = 'CBCS Verified'; $('singleStoreInput').value = 'Convention';
        await P.saveSingleIssue();
        await wait(200);
        const ns = P.getPhysicalSingles().find(x => x.series === 'Saisie Grading Test');
        r.form = condAfter === 'CBCS 9.6 (Certifié)' && !!ns && ns.condition === 'CBCS 9.6 (Certifié)' && ns.gradingCompany === 'CBCS' && ns.grade === 9.6 && ns.labelType === 'signature' &&
          ns.certNumber === 'C-77' && ns.signedBy === 'Artiste' && ns.signatureAuth === 'CBCS Verified' && ns.store === 'Convention';
        $('singleConditionSelect').value = 'VF 8.0 (Very Fine)'; fire($('singleConditionSelect'));
        r.formSync = $('singleGradingCompanySelect').value === '' && $('singleGradeInput').value === '';
        const plain = P.getPhysicalSingles().find(x => x.id === 'g3');
        r.noExtraFields = !('gradingCompany' in plain) && !('signedBy' in plain) && !('store' in plain);
        // Restauration JSON fidèle : provenance, codes et grading conservés ; valeurs dangereuses filtrées
        const raw = { id: 'r1', series: 'Restauration', issue: '#1', coverUrl: 'https://covers.example.test/r1.jpg', coverMeta: { source: 'fandom', exact: true }, upc: '76194138470100111', metronId: 'm-1', gradingCompany: 'CGC', grade: 9.8, signedBy: 'X',
          coverHistory: [{ url: 'javascript:alert(1)' }, { url: 'https://covers.example.test/old.jpg', at: '2025-01-01' }], tags: ['a', 3], evil: { nested: true }, fn: null };
        const si = P.sanitizeImportedSingle(raw);
        r.restore = si.coverMeta && si.coverMeta.source === 'fandom' && si.upc === raw.upc && si.metronId === 'm-1' && si.gradingCompany === 'CGC' && si.grade === 9.8 && si.signedBy === 'X' &&
          si.coverHistory.length === 1 && si.tags.length === 1 && !('evil' in si) && !('fn' in si) && si.coverUrl === raw.coverUrl;
        // Nettoyage
        P.setPhysicalSingles(saved);
        await C.migrate({ force: true });
        r.cleanup = (await C.verify()).ok;
        return r;
      })()`);
      console.log('Résultat Test 25:', JSON.stringify(t25));
      testResults.push({
        test: 'Exemplaires et variantes : état/grading/slab/signature/achat normalisés, regroupement par variante, saisie structurée, restauration JSON fidèle',
        ok: !!t25 && ['normalize', 'catalog', 'grouping', 'badge', 'inspector', 'form', 'formSync', 'noExtraFields', 'restore', 'cleanup'].every(k => t25[k] === true)
      });

      console.log('\n==========================================');
      console.log('RÉCAPITULATIF DES TESTS EXÉCUTÉS DANS EDGE :');
      testResults.forEach(r => console.log((r.ok ? '✓ PASS' : '✗ FAIL') + ' - ' + r.test));
      console.log('==========================================');

      ws.close();
      killEdge();
      process.exit(testResults.every(r => r.ok) ? 0 : 1);
    };
  } catch(e) {
    console.error('Erreur exécution tests:', e);
    killEdge();
    process.exit(1);
  }
})();

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}
