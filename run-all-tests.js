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
  console.error('✗ Délai global dépassé (480 s) — arrêt.');
  killEdge();
  process.exit(1);
}, 480000);

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
        r.collectionHome = !document.getElementById('singlesViewSection').hidden && document.querySelectorAll('.mobile-dock-btn').length === 5; // cinq boutons depuis la navigation 4.9 (D-42), sans bouton numérique
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
        // Lot 3.1b-5 : le bouton « Acheté » passe par S2, qui refuse les clics synthétiques ; il est rejoué ci-dessous par un vrai clic (attente inchangée)
        const bought = null;
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
      // « Acheté » : vrai clic (CDP), même carte, même attente qu'avant le lot 3.1b-5
      if (t11) {
        await evalExpr(`(() => { document.getElementById('navSinglesReleases').click(); window.Panel.showSinglesView('releases'); document.getElementById('releasesPullOnly').checked = true; window.Panel.renderReleasesGrid(); return true; })()`);
        const t11sel = '#releasesGrid .release-card [data-buy]';
        await evalExpr(`(() => { const b = document.querySelector(${JSON.stringify(t11sel)}); if (b) b.scrollIntoView({ block: "center" }); return !!b; })()`);
        await new Promise(r => setTimeout(r, 500)); // défilement doux terminé avant la mesure
        const t11p = await evalExpr(`(() => { const b = document.querySelector(${JSON.stringify(t11sel)}); if (!b) return null; b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect(); return { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) }; })()`);
        if (t11p) { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: t11p.x, y: t11p.y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: t11p.x, y: t11p.y, button: 'left', clickCount: 1 }); await new Promise(r => setTimeout(r, 400)); }
        t11.bought = !!t11p && await evalExpr(`(() => { const ok = window.Panel.getPhysicalSingles().some(s => s.series === 'Invincible' && s.issue === '#8' && !s.isWishlist); document.getElementById('releasesPullOnly').checked = false; return ok; })()`);
      }
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
        // Stabilisation (échec intermittent du 8 novembre 2026) : runCoverJob() ne fait rien si un traitement
        // précédent tourne encore ; on attend donc que la file soit au repos avant de remplir le quota.
        P.pauseCoverJob();
        for (let i = 0; i < 60 && P.getCoverJob().running; i++) await new Promise(r => setTimeout(r, 50));
        res.quotaIdleBefore = !P.getCoverJob().running;
        P.resetFandomStateForTest();
        P.setPhysicalSingles([{ ...base, id: 'q1', series: 'Absolute Batman (2024)', issue: '#1', variant: 'Cover B Jae Lee Variant', coverUrl: img('cv-q'), coverLookup: { status: 'regular' } }]);
        P.fillFandomQuotaForTest();
        const before = calls.fandom;
        await P.runCoverJob();
        res.quota = P.getCoverJob().phase === 'quota' && calls.fandom === before && /quota Fandom/.test(document.getElementById('coverJobBar').innerText);
        if (!res.quota) res.quotaDiag = { phase: P.getCoverJob().phase, running: P.getCoverJob().running, fandomDelta: calls.fandom - before, bar: (document.getElementById('coverJobBar').innerText || '').slice(0, 80) };
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
          c.grade.scale === 'estime' && c.grade.label === 'NM' && c.grade.value === 9.4 && c.purchase.price === 3.5 && c.purchase.date === '2025-02-01' && c.purchase.currency === null && /* D-27 (lot F1-0) : plus de devise USD inventée */
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

      // ==========================================
      // TEST 26 : Emplacements (lot 2.3) — hiérarchie, affectation, déplacements, suppression sûre, migration, imports/exports, persistance hors ligne
      // ==========================================
      console.log('\n[TEST 26] Emplacements : hiérarchie, migration, affectation, déplacements, sauvegardes, persistance...');
      const t26a = await evalExpr(`Promise.race([(async () => {
        window.__t26log = []; window.__t26t0 = performance.now();
        const P = window.Panel, L = P.locations, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        localStorage.setItem('panel_test26_saved', JSON.stringify({ singles: P.getPhysicalSingles(), doc: L.doc(), last: localStorage.getItem('panel_last_location') }));
        await L.setDocForTest(null);
        const base = { condition: 'NM 9.4 (Near Mint)', keyType: 'none', isWishlist: false, notes: '', addedAt: '2026-01-01T00:00:00Z', publisher: 'DC Comics', variant: 'Cover A', updatedAt: '2026-02-02T00:00:00Z' };
        const fx = [
          { ...base, id: 'l1', series: 'Loc A', issue: '#1', box: 'Short Box 1', divider: 'DC', location: 'Short Box 1 · DC' },
          { ...base, id: 'l2', series: 'Loc B', issue: '#1', box: 'short box 1 ', divider: '', location: 'short box 1' },
          { ...base, id: 'l3', series: 'Loc C', issue: '#1', box: '', divider: '', location: 'Long Box Marvel' },
          { ...base, id: 'l4', series: 'Loc D', issue: '#1', box: 'Bureau / Étagère 2', divider: '', location: 'Bureau / Étagère 2' },
          { ...base, id: 'l5', series: 'Loc E', issue: '#1', box: '', divider: 'X-Men', location: '' },
          { ...base, id: 'l6', series: 'Loc F', issue: '#1', box: '', divider: '', location: '' },
          { ...base, id: 'l7', series: 'Loc G', issue: '#1', room: 'Bureau', furniture: 'Bibliothèque', box: 'Boîte 04', divider: 'Séparateur DC', location: 'Boîte 04 · Séparateur DC' },
          { ...base, id: 'l8', series: 'Loc H', issue: '#1', box: 'Short Box 1', divider: '', location: 'Salon' },
          { ...base, id: 'l9', series: 'Loc W', issue: '#1', box: 'Short Box 1', isWishlist: true }
        ];
        P.setPhysicalSingles(JSON.parse(JSON.stringify(fx)));
        await wait(300);
        const before = JSON.stringify(P.getPhysicalSingles());
        window.__t26 = "1 Migration : sauvegarde + insta"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Migration : sauvegarde + instantané, fiches inchangées, valeurs identiques regroupées, ambiguïtés signalées
        const m = await L.migrate();
        const sb1 = L.find('box', 'Short Box 1'), dc = L.find('divider', 'DC'), lbm = L.find('box', 'Long Box Marvel');
        const doc = L.doc();
        r.migration = m.ok && !!m.backupId && !!m.snapshotId && m.legacyUntouched && JSON.stringify(P.getPhysicalSingles()) === before &&
          doc.nodes.filter(n => n.level === 'box' && n.name.toLowerCase().trim() === 'short box 1').length === 1 && !!dc && !!lbm &&
          L.path(L.of(P.getPhysicalSingles()[6]).nodeId) === 'Bureau > Bibliothèque > Boîte 04 > Séparateur DC' &&
          L.of(fx[0]).nodeId === dc && L.of(fx[1]).nodeId === sb1 && L.of(fx[2]).nodeId === lbm && L.of(fx[5]).status === 'none';
        const unres = doc.unresolved.filter(u => u.kind === 'non-resolu');
        r.ambiguous = L.of(fx[3]).status === 'unresolved' && L.of(fx[4]).status === 'unresolved' && unres.length === 2 && unres.every(u => u.reason && u.count === 1) &&
          !doc.nodes.some(n => /tag[eè]re 2/i.test(n.name)) && doc.unresolved.some(u => u.kind === 'info' && u.value === 'Salon') && L.of(fx[7]).nodeId === sb1;
        const st = await P.catalog.status();
        r.backupExists = st.backups.some(b => b.id === m.backupId && b.count === fx.length);
        window.__t26 = "2 Idempotence"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Idempotence
        const ids1 = L.doc().nodes.map(n => n.id).sort().join(',');
        const m2 = await L.migrate({ force: true });
        const m3 = await L.migrate();
        r.idempotent = m2.ok && m3.already && L.doc().nodes.map(n => n.id).sort().join(',') === ids1 && JSON.stringify(P.getPhysicalSingles()) === before;
        window.__t26 = "3 Création des quatre niveaux et"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Création des quatre niveaux et relations
        const salon = L.create({ level: 'room', name: 'Salon' }), eta = L.create({ level: 'furniture', parentId: salon.node.id, name: 'Étagère', type: 'Étagère' });
        const b5 = L.create({ level: 'box', parentId: eta.node.id, name: 'Boîte 05', capacity: 150 }), mv = L.create({ level: 'divider', parentId: b5.node.id, name: 'Marvel' });
        r.create = [salon, eta, b5, mv].every(x => x.ok) && L.path(mv.node.id) === 'Salon > Étagère > Boîte 05 > Marvel' && b5.node.capacity === 150 &&
          !L.create({ level: 'divider', name: 'Orphelin' }).ok && !L.create({ level: 'box', parentId: salon.node.id, name: 'X' }).ok && !L.create({ level: 'furniture', parentId: salon.node.id, name: 'étagère' }).ok;
        window.__t26 = "4 Affectation complète, partiell"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Affectation complète, partielle, modification
        L.assign(['l1'], mv.node.id);
        const a1 = P.getPhysicalSingles().find(x => x.id === 'l1');
        r.assign = a1.locationId === mv.node.id && !!a1.locationAt && a1.box === 'Boîte 05' && a1.divider === 'Marvel' && a1.locationHistory.length === 1 && a1.locationHistory[0].path === 'Short Box 1 > DC';
        L.assign(['l2'], salon.node.id);
        r.partial = L.of(P.getPhysicalSingles().find(x => x.id === 'l2')).path.length === 1 && P.getPhysicalSingles().find(x => x.id === 'l2').box === '';
        L.assign(['l2'], b5.node.id);
        r.modify = L.path(L.of(P.getPhysicalSingles().find(x => x.id === 'l2')).nodeId) === 'Salon > Étagère > Boîte 05';
        window.__t26 = "5 Déplacement d'une boîte : les "; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Déplacement d'une boîte : les comics suivent, aucune fiche réécrite
        const h8 = JSON.stringify(P.getPhysicalSingles().find(x => x.id === 'l8'));
        const mvBox = L.move(sb1, eta.node.id);
        r.moveBox = mvBox.ok && L.path(L.of(P.getPhysicalSingles().find(x => x.id === 'l8')).nodeId) === 'Salon > Étagère > Short Box 1' && JSON.stringify(P.getPhysicalSingles().find(x => x.id === 'l8')) === h8 &&
          !L.move(mv.node.id, salon.node.id).ok && L.move(dc, b5.node.id).ok && L.path(dc) === 'Salon > Étagère > Boîte 05 > DC';
        window.__t26 = "6 Comptage, recherche, contenu, "; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Comptage, recherche, contenu, emplacements vides
        const c = L.counts();
        r.counts = c.byId[salon.node.id] === 3 && c.byId[b5.node.id] === 2 && c.byId[sb1] === 1 && c.none === 1 && c.unresolved === 2 && !(c.byId[sb1] > 1);
        const vide = L.create({ level: 'box', parentId: eta.node.id, name: 'Boîte vide' });
        r.search = L.search('boite 05').some(x => x.id === b5.node.id && x.path === 'Salon > Étagère > Boîte 05') && L.contents(b5.node.id).sort().join(',') === 'l1,l2' && L.unused().includes(vide.node.id) && !L.unused().includes(b5.node.id);
        window.__t26 = "7 Recherche dans la collection p"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Recherche dans la collection par emplacement (filtre)
        P.renderSinglesCollection();
        const sel = document.getElementById('boxFilterSelect');
        sel.value = b5.node.id; sel.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(100);
        const shown = [...document.querySelectorAll('[data-sid]')].map(e => e.dataset.sid).filter(id => /^l\\d$/.test(id)).sort().join(',');
        r.filter = shown === 'l1,l2';
        sel.value = 'all'; sel.dispatchEvent(new Event('change', { bubbles: true }));
        window.__t26 = "8 Renommage et réorganisation : "; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Renommage et réorganisation : fiches inchangées
        const g7 = JSON.stringify(P.getPhysicalSingles().find(x => x.id === 'l7'));
        const bureau = L.find('room', 'Bureau');
        L.update(bureau, { name: 'Bureau principal', description: 'Pièce du fond' });
        const order0 = L.tree().filter(x => x.level === 'room').map(x => x.name).join(',');
        L.reorder(salon.node.id, -1);
        const order1 = L.tree().filter(x => x.level === 'room').map(x => x.name).join(',');
        r.rename = L.path(L.of(P.getPhysicalSingles().find(x => x.id === 'l7')).nodeId).startsWith('Bureau principal >') && JSON.stringify(P.getPhysicalSingles().find(x => x.id === 'l7')) === g7 && order0 !== order1;
        window.__t26 = "9 Suppression sécurisée : jamais"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Suppression sécurisée : jamais d'exemplaire supprimé
        const n0 = P.getPhysicalSingles().length;
        const d1 = L.remove(lbm);
        const d2 = L.remove(lbm, { keep: true });
        const d3 = L.remove(b5.node.id);
        const d4 = L.remove(mv.node.id, { reassignTo: b5.node.id });
        r.safeDelete = d1.needsChoice && d1.count === 1 && d2.ok && L.of(P.getPhysicalSingles().find(x => x.id === 'l3')).status === 'deleted' && L.of(P.getPhysicalSingles().find(x => x.id === 'l3')).text.includes('(supprimé)') &&
          !d3.ok && d3.children >= 1 && d4.ok && d4.moved === 1 && P.getPhysicalSingles().find(x => x.id === 'l1').locationId === b5.node.id && P.getPhysicalSingles().length === n0 &&
          L.doc().nodes.some(n => n.id === mv.node.id && n.deletedAt) && L.restore(mv.node.id).ok;
        window.__t26 = "10 Formulaire : sélection progres"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Formulaire : sélection progressive filtrée, affectation à l'enregistrement
        const $ = id => document.getElementById(id);
        L.fillCascade(null);
        $('singleLocRoom').value = salon.node.id; $('singleLocRoom').dispatchEvent(new Event('change', { bubbles: true }));
        const furnOpts = [...$('singleLocFurniture').options].map(o => o.value).filter(Boolean);
        $('singleLocFurniture').value = eta.node.id; $('singleLocFurniture').dispatchEvent(new Event('change', { bubbles: true }));
        $('singleLocBox').value = b5.node.id; $('singleLocBox').dispatchEvent(new Event('change', { bubbles: true }));
        $('singleSeriesInput').value = 'Rangement Form Test'; $('singleIssueInput').value = '#3'; $('singleVariantNameInput').value = 'Cover A';
        await P.saveSingleIssue();
        await wait(200);
        const nf = P.getPhysicalSingles().find(x => x.series === 'Rangement Form Test');
        r.form = furnOpts.join(',') === eta.node.id && $('singleLocDivider').options.length >= 2 && !!nf && nf.locationId === b5.node.id && nf.box === 'Boîte 05';
        window.__t26 = "11 Export / restauration JSON : h"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Export / restauration JSON : hiérarchie et relations reconstruites, sans doublon
        const full = { format: 'panel-backup', version: 3, physicalSingles: P.getPhysicalSingles(), seriesMeta: {}, locations: L.doc() };
        const docJson = JSON.stringify(L.doc().nodes.map(n => [n.id, n.parentId, n.name, n.deletedAt]).sort());
        const payload = P.validateBackupPayload(JSON.parse(JSON.stringify(full)));
        await L.setDocForTest(null);
        const res1 = await P.applyBackupRestore(payload, { mode: 'merge' });
        const res2 = await P.applyBackupRestore(P.validateBackupPayload(JSON.parse(JSON.stringify(full))), { mode: 'merge' });
        r.restore = res1.ok && res2.ok && JSON.stringify(L.doc().nodes.map(n => [n.id, n.parentId, n.name, n.deletedAt]).sort()) === docJson &&
          P.getPhysicalSingles().find(x => x.id === 'l1').locationId === b5.node.id && L.path(L.of(P.getPhysicalSingles().find(x => x.id === 'l1')).nodeId) === 'Salon > Étagère > Boîte 05';
        window.__t26 = "12 Export CSV puis réimport répét"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        if (!r.restore) r._restoreInfo = { res1: { ok: res1.ok, error: res1.error, added: res1.added }, res2ok: res2.ok, nodes: L.doc().nodes.length, expected: JSON.parse(docJson).length, l1: (P.getPhysicalSingles().find(x => x.id === 'l1') || {}).locationId };
        // Export CSV puis réimport répété : colonnes Pièce/Meuble/Boîte/Séparateur, aucun doublon
        const cols = L.exportColumns(P.getPhysicalSingles().find(x => x.id === 'l7'));
        const csv = 'Series,Issue,Pièce,Meuble,Boîte,Séparateur\\r\\nImport Loc,1,' + cols.room + ',' + cols.furniture + ',' + cols.box + ',' + cols.divider + '\\r\\nImport Loc,2,Garage,Armoire,Boîte G,\\r\\n';
        const nodesBefore = L.doc().nodes.length;
        const imp = () => { const parsed = P.parseCsvText(csv); return P.convertCsvRows(parsed, P.detectCsvMapping(parsed.headers), { source: P.detectCsvSource(parsed.headers) }).items; };
        const it1 = imp();
        P.setPhysicalSingles(P.getPhysicalSingles().concat(it1)); await wait(700);
        const afterFirst = L.doc().nodes.length;
        P.setPhysicalSingles(P.getPhysicalSingles().concat(imp())); await wait(700);
        const imported = P.getPhysicalSingles().filter(x => x.series === 'Import Loc');
        r.csv = cols.room === 'Bureau principal' && cols.box === 'Boîte 04' && it1[0].room === 'Bureau principal' && it1[0].divider === 'Séparateur DC' &&
          imported.every(x => L.of(x).status === 'legacy') && L.of(imported[0]).nodeId === L.of(P.getPhysicalSingles().find(x => x.id === 'l7')).nodeId &&
          afterFirst === nodesBefore + 3 && L.doc().nodes.length === afterFirst && L.path(L.of(imported[1]).nodeId) === 'Garage > Armoire > Boîte G';
        window.__t26 = "13 Hors ligne : aucune requête ré"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        if (!r.csv) r._csvInfo = { mapping: P.detectCsvMapping(P.parseCsvText(csv).headers), it: it1.map(x => [x.room, x.furniture, x.box, x.divider]), st: imported.map(x => L.of(x).status), before: nodesBefore, afterFirst, now: L.doc().nodes.length };
        // Hors ligne : aucune requête réseau pendant les opérations
        const realFetch = window.fetch; let calls = 0;
        window.fetch = (...a) => { calls++; return Promise.reject(new Error('hors ligne')); };
        const off = L.create({ level: 'box', parentId: eta.node.id, name: 'Boîte hors ligne' });
        L.assign(['l6'], off.node.id);
        window.fetch = realFetch;
        r.offlineOps = off.ok && calls === 0 && L.of(P.getPhysicalSingles().find(x => x.id === 'l6')).nodeId === off.node.id;
        window.__t26 = "14 Copie IndexedDB : localStorage"; window.__t26log.push([window.__t26, Math.round(performance.now() - window.__t26t0)]);
        // Copie IndexedDB : localStorage effacé → emplacements repris
        await wait(300);
        await L.sync();
        const n1 = L.doc().nodes.length;
        const lsBackup = localStorage.getItem('panel_locations');
        localStorage.removeItem('panel_locations');
        L.reloadFromStorage();
        const rec = await L.recoverFromIdb();
        r.idbRecovery = rec.source === 'indexeddb' && L.doc().nodes.length === n1 && !!localStorage.getItem('panel_locations');
        if (!r.idbRecovery && lsBackup) localStorage.setItem('panel_locations', lsBackup);
        r._expect = { l1: b5.node.id, l6: off.node.id, nodes: n1 };
        return r;
      })(), new Promise(res => setTimeout(() => res({ blockedAt: window.__t26, stepsMs: window.__t26log }), 60000))])`);
      console.log('Résultat Test 26 (a):', JSON.stringify(t26a));
      // Durées cumulées par étape : un dépassement du délai indique l'étape réellement lente (diagnostic de l'intermittence)
      console.log('Test 26 étapes (ms):', JSON.stringify(await evalExpr('window.__t26log || []')));
      // Redémarrage complet hors ligne : la hiérarchie et les affectations sont relues depuis le stockage
      let t26b = {};
      try {
        await send('Network.enable');
        await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        await send('Page.reload', { ignoreCache: false });
        for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 250)); if (await evalExpr('!!(window.Panel && window.Panel.locations) && document.readyState === "complete"')) break; }
        await new Promise(r => setTimeout(r, 800));
        t26b = await evalExpr(`(() => {
          const P = window.Panel, L = P.locations, exp = ${JSON.stringify((t26a && t26a._expect) || {})};
          const s = id => P.getPhysicalSingles().find(x => x.id === id);
          return { restart: L.doc().nodes.length === exp.nodes && L.of(s('l1')).nodeId === exp.l1 && L.of(s('l6')).nodeId === exp.l6 && L.path(exp.l1) === 'Salon > Étagère > Boîte 05' };
        })()`);
      } finally {
        await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      }
      // Nettoyage : collection et emplacements du profil de test rétablis
      const t26c = await evalExpr(`(async () => {
        const P = window.Panel, L = P.locations;
        const saved = JSON.parse(localStorage.getItem('panel_test26_saved') || 'null');
        if (!saved) return { cleanup: false };
        P.setPhysicalSingles(saved.singles);
        await L.setDocForTest(saved.doc);
        if (saved.last == null) localStorage.removeItem('panel_last_location'); else localStorage.setItem('panel_last_location', saved.last);
        localStorage.removeItem('panel_test26_saved');
        await new Promise(r => setTimeout(r, 600));
        return { cleanup: L.doc().nodes.length === saved.doc.nodes.length && P.getPhysicalSingles().length === saved.singles.length };
      })()`);
      const t26 = Object.assign({}, t26a, t26b, t26c);
      delete t26._expect;
      console.log('Résultat Test 26:', JSON.stringify(t26));
      testResults.push({
        test: 'Emplacements : 4 niveaux, migration sûre et idempotente, ambiguïtés signalées, affectation, déplacements, suppression sans perte, recherche, JSON/CSV, redémarrage hors ligne',
        ok: !!t26a && ['migration', 'ambiguous', 'backupExists', 'idempotent', 'create', 'assign', 'partial', 'modify', 'moveBox', 'counts', 'search', 'filter', 'rename', 'safeDelete', 'form', 'restore', 'csv', 'offlineOps', 'idbRecovery', 'restart', 'cleanup'].every(k => t26[k] === true)
      });


      // ------------------------------------------------------------------
      // TEST 27 : Publications, calendrier international, Pull List, Wishlist (lot 2.4)
      // ------------------------------------------------------------------
      console.log('\n[TEST 27] Publications, calendrier, Pull List, Wishlist, sauvegardes, redémarrage hors ligne...');
      const t27a = await evalExpr(`Promise.race([(async () => {
        const P = window.Panel, R = P.releases;
        await R.ready();
        localStorage.setItem('panel_test27_saved', JSON.stringify({ singles: P.getPhysicalSingles() }));
        const r = {}, pubIds = new Set(), plIds = new Set();
        const track = p => { if (p && p.id) pubIds.add(p.id); return p; };
        const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
        window.__t27 = '1 publications';
        const us = track((await R.upsert({ series: 'T27 Saga', issue: '1', publisher: 'Image', format: 'single', date: plus(20), upc: '75960620000100111' }, 'manual')).pub);
        const fr = track((await R.upsert({ series: 'T27 Saga', issue: '1', publisher: 'Urban Comics', format: 'album', date: plus(60), isbn: '978-2-36577-000-1' }, 'manual')).pub);
        r.create = us.market === 'US' && us.publisher === 'Image Comics' && fr.market === 'FR' && fr.language === 'fr' && fr.format === 'album' && us.externalIds.upc === '75960620000100111' && fr.externalIds.isbn === '9782365770001' && us.id !== fr.id;
        const again = await R.upsert({ series: 't27 saga', issue: '#1', publisher: 'Image Comics', date: plus(20) }, 'manual');
        r.noDup = again.pub.id === us.id && again.action === 'unchanged';
        const usB = track((await R.upsert({ series: 'T27 Saga', issue: '1', publisher: 'Image', variant: 'Cover B', date: plus(20) }, 'manual')).pub);
        r.variants = usB.id !== us.id && usB.variant === 'Cover B';
        r.provenance = us.origin === 'manual' && us.sources[0].source === 'manual' && !!us.dates.lastVerified;
        window.__t27 = '2 relations';
        const sugg = R.suggest(fr.id);
        r.noAutoRelation = R.relationsOf(fr.id).length === 0 && sugg.some(x => x.pub.id === us.id);
        await R.addRelation(fr.id, 'translated_from', us.id);
        r.relations = R.relationsOf(us.id).length === 1 && R.relationsOf(us.id)[0].label === 'Traduit en' && R.relationsOf(fr.id)[0].label === 'Traduit depuis' &&
          (await R.addRelation(fr.id, 'translated_from', us.id)).duplicate === true && (await R.addRelation(fr.id, 'collects', fr.id)).ok === false;
        r.edit = (await R.edit(fr.id, { title: 'T27 Saga, tome 1' })).ok && R.get(fr.id).title === 'T27 Saga, tome 1';
        r.editClash = (await R.edit(usB.id, { variant: '' })).ok === false && R.get(usB.id).variant === 'Cover B';
        window.__t27 = '3 connecteur';
        let rows = [{ id: 9900001, volumeId: 1, volume: 'T27 Hero', issue: '5', title: '', cover: '', storeDate: plus(10), url: 'https://comicvine.gamespot.com/t27/', publisher: 'Marvel' },
          { id: 9900002, volumeId: 2, volume: 'T27 Other', issue: '1', title: '', cover: '', storeDate: plus(12), url: '', publisher: 'DC Comics' }];
        R.setFetchForTest(async () => rows);
        const s1 = await R.sync('comicvine', plus(1), plus(40));
        const hero = track(R.all().find(p => p.externalIds.comicvine === '9900001'));
        track(R.all().find(p => p.externalIds.comicvine === '9900002'));
        r.calImport = s1.status === 'ok' && s1.added === 2 && hero.market === 'US' && hero.publisher === 'Marvel' && hero.format === 'single' && hero.dates.current === plus(10) && hero.dates.actual === null && R.statusOf(hero) === 'upcoming';
        const s2 = await R.sync('comicvine', plus(1), plus(40));
        r.calDedup = s2.added === 0 && s2.unchanged === 2 && R.all().filter(p => p.externalIds.comicvine === '9900001').length === 1;
        rows = [Object.assign({}, rows[0], { storeDate: plus(24) })];
        const s3 = await R.sync('comicvine', plus(1), plus(40));
        const other = R.all().find(p => p.externalIds.comicvine === '9900002');
        r.postponed = s3.changed === 1 && hero.dates.initial === plus(10) && hero.dates.current === plus(24) && R.statusOf(hero) === 'delayed' &&
          hero.dateHistory.some(h => h.kind === 'postponed' && h.from === plus(10) && h.to === plus(24) && h.source === 'comicvine');
        r.absenceNotCancel = !other.cancelled && !!other.unseenSince && R.statusOf(other) !== 'cancelled';
        R.setFetchForTest(async () => { throw new Error('réseau simulé'); });
        const before = JSON.stringify(R.get(hero.id));
        const s4 = await R.sync('comicvine', plus(1), plus(40));
        r.syncError = s4.status === 'error' && JSON.stringify(R.get(hero.id)) === before && R.meta().sync.comicvine.lastStatus === 'error' && R.log()[0].errors[0].includes('réseau simulé');
        R.setFetchForTest(null);
        r.connectors = R.connectors().some(c => c.id === 'comicvine' && c.automated && /non commercial/.test(c.terms)) && R.connectors().some(c => c.id === 'import' && !c.automated);
        window.__t27 = '4 import CSV';
        const csv = 'marche;editeur;serie;numero;format;date_annoncee_initiale;date_annoncee;statut;isbn\\nFR;Panini;T27 Spider;3;album;' + plus(30) + ';' + plus(45) + ';;9782809400003\\n;Delcourt;T27 Annule;1;tpb;;' + plus(50) + ';Annulé;\\n;Glénat;T27 Sans Date;2;album;;;;\\n;;;;tpb;;;;';
        const imp = await R.importText(csv, 't27.csv');
        const spider = track(R.all().find(p => p.series === 'T27 Spider')), ann = track(R.all().find(p => p.series === 'T27 Annule')), nod = track(R.all().find(p => p.series === 'T27 Sans Date'));
        r.csvImport = imp.added === 3 && imp.rejected === 1 && spider.market === 'FR' && spider.publisher === 'Panini Comics' && spider.dates.initial === plus(30) && spider.dates.current === plus(45) &&
          R.statusOf(spider) === 'delayed' && ann.market === 'FR' && ann.cancelled === true && R.statusOf(ann) === 'cancelled' && ann.dateHistory.some(h => h.kind === 'cancelled');
        r.unknownDate = !!nod && nod.dates.current === null && nod.dates.initial === null && R.statusOf(nod) === 'unknown';
        const imp2 = await R.importText(csv, 't27.csv');
        r.csvNoDup = imp2.added === 0 && imp2.unchanged === 3;
        const imp3 = await R.importText(R.exportCsv([spider, ann, nod, hero]), 'export.csv');
        r.csvRoundTrip = imp3.added === 0 && imp3.fetched === 4 && imp3.unchanged === 4;
        const jsonImp = await R.importText(JSON.stringify({ publications: [R.get(fr.id)] }), 'x.json');
        r.jsonNoDup = jsonImp.added === 0 && jsonImp.unchanged === 1;
        const past = track((await R.upsert({ series: 'T27 Old', issue: '2', publisher: 'Marvel', date: plus(-10) }, 'manual')).pub);
        r.available = R.statusOf(past) === 'available';
        await R.edit(past.id, { actual: plus(-9) });
        r.confirmed = R.get(past.id).dates.actual === plus(-9);
        window.__t27 = '5 pull list';
        const pl1 = await R.pulls.add(hero.id, { quantity: 2, variant: 'Cover A' }); plIds.add(pl1.pull.id);
        const plDup = await R.pulls.add(hero.id, { variant: 'cover a' });
        r.pullAdd = pl1.ok && plDup.duplicate === true && plDup.pull.id === pl1.pull.id && R.pulls.statusOf(pl1.pull) === 'planned' && pl1.pull.ownerId === R.profile().id;
        await R.pulls.update(pl1.pull.id, { quantity: 3 });
        r.pullEdit = R.pulls.get(pl1.pull.id).quantity === 3 && R.pulls.get(pl1.pull.id).history.some(h => h.action === 'edited');
        const plPast = await R.pulls.add(past.id, {}); plIds.add(plPast.pull.id);
        r.pullAvailable = R.pulls.statusOf(plPast.pull) === 'available';
        const n0 = P.getPhysicalSingles().length;
        const pick = await R.pulls.pickUp(pl1.pull.id);
        const copies = P.getPhysicalSingles().filter(s => s.pullId === pl1.pull.id);
        r.pickUp = pick.ok && pick.copies.length === 3 && copies.length === 3 && new Set(copies.map(c => c.id)).size === 3 &&
          copies.every(c => !c.isWishlist && c.pubId === hero.id && c.series === 'T27 Hero' && c.issue === '#5' && c.variant === 'Cover A') && R.pulls.statusOf(pl1.pull.id) === 'picked';
        const pick2 = await R.pulls.pickUp(pl1.pull.id);
        r.pickNoDup = pick2.duplicate === true && P.getPhysicalSingles().length === n0 + 3;
        await R.pulls.cancel(plPast.pull.id);
        const c1 = R.pulls.statusOf(plPast.pull.id);
        await R.pulls.reactivate(plPast.pull.id);
        r.pullCancel = c1 === 'cancelled' && R.pulls.statusOf(plPast.pull.id) === 'available' && R.pulls.get(plPast.pull.id).history.map(h => h.action).join(',') === 'added,cancelled,reactivated';
        const man = await R.pulls.addManual({ series: 'T27 Inédit', issue: '1', publisher: 'Urban Comics' }); plIds.add(man.pull.id); track(R.get(man.pull.pubId));
        r.pullManual = man.ok && man.pubCreated === true && R.get(man.pull.pubId).market === 'FR' && R.get(man.pull.pubId).dates.current === null && R.pulls.statusOf(man.pull) === 'planned';
        const toW = await R.pulls.toWishlist(man.pull.id);
        const wItem = P.getPhysicalSingles().find(s => s.isWishlist && s.pubId === man.pull.pubId);
        r.pullToWish = toW.ok && !!wItem && R.pulls.statusOf(man.pull.id) === 'cancelled' && R.pulls.get(man.pull.id).history.some(h => h.action === 'moved-to-wishlist') && R.wish.of(wItem).status === 'wanted';
        const plW = await R.pulls.add(man.pull.pubId, {}); plIds.add(plW.pull.id);
        const pkW = await R.pulls.pickUp(plW.pull.id);
        r.pickConvertsWish = pkW.converted === 1 && pkW.copies[0] === wItem.id && !wItem.isWishlist && R.wish.of(wItem).status === 'found' && P.getPhysicalSingles().filter(s => s.pubId === man.pull.pubId).length === 1;
        window.__t27 = '6 wishlist';
        const wa = await R.wish.addPub(spider.id, { priority: 'high' });
        const wb = await R.wish.addPub(spider.id, {});
        R.wish.set(wa.item, { status: 'searching', targetPrice: '12.5' });
        r.wishAdd = wa.ok && wb.duplicate === true && wa.item.isWishlist && R.wish.of(wa.item).priority === 'high' && R.wish.of(wa.item).status === 'searching' && R.wish.of(wa.item).targetPrice === 12.5 && !!R.wish.of(wa.item).updatedAt;
        r.wishNotOwned = P.getPhysicalSingles().filter(s => s.series === 'T27 Spider').length === 1 && !P.getPhysicalSingles().some(s => s.series === 'T27 Spider' && !s.isWishlist);
        P.setPhysicalSingles([{ id: 't27legacy', series: 'T27 Legacy', issue: '#1', publisher: 'DC Comics', variant: 'Cover A', condition: 'NM 9.4 (Near Mint)', isWishlist: true, addedAt: '2025-01-01T00:00:00Z' }].concat(P.getPhysicalSingles()));
        const lg = P.getPhysicalSingles().find(s => s.id === 't27legacy');
        r.wishLegacy = R.wish.of(lg).status === 'wanted' && R.wish.of(lg).priority === 'normal' && R.wish.of(lg).addedAt === '2025-01-01T00:00:00Z' && lg.wish === undefined;
        R.wish.toCollection(lg);
        r.wishToCollection = !lg.isWishlist && lg.id === 't27legacy' && R.wish.of(lg).status === 'found' && !!lg.purchaseDate;
        const ownedBefore = JSON.stringify(lg);
        const cw = R.wish.fromCollection(lg, { variant: 'Cover B' });
        const cw2 = R.wish.fromCollection(lg, { variant: 'Cover B' });
        r.collectionToWish = cw.ok && cw.item.id !== 't27legacy' && cw.item.isWishlist && cw.item.variant === 'Cover B' && cw.item.wish.sourceCopyId === 't27legacy' && JSON.stringify(lg) === ownedBefore && cw2.duplicate === true;
        r.collectionLink = P.catalog.idsOf(copies[0]).issueId === hero.catalog.issueId;
        window.__t27 = '7 sauvegarde';
        const backup = { format: 'panel-backup', version: 3, physicalSingles: P.getPhysicalSingles(), seriesMeta: P.getSeriesMeta(), releases: R.exportData() };
        const payload = P.validateBackupPayload(JSON.parse(JSON.stringify(backup)));
        r.exportData = payload.releases.publications.some(p => p.id === hero.id) && payload.releases.pulls.some(p => p.id === pl1.pull.id) &&
          payload.releases.publications.find(p => p.id === fr.id).relations.length === 1 && payload.items.find(s => s.id === wa.item.id).wish.priority === 'high';
        const evil = R.sanitize({ publications: [{ id: 'pbc_x', series: 'Z', dates: {}, cover: { url: 'javascript:alert(1)' } }, { id: '../x', series: 'Y', dates: {} }], pulls: [{ id: 'pl_x', pubId: 'pbc_x', quantity: 500, status: 'hack' }] });
        r.sanitize = evil.publications.length === 1 && evil.publications[0].cover === null && evil.pulls[0].quantity === 99 && evil.pulls[0].status === 'planned';
        const m1 = R.merge(payload.releases, 'merge');
        await m1.write;
        r.mergeNoDup = m1.added === 0 && m1.replaced === 0;
        window.__t27 = '8 interface';
        P.showSinglesView('releases');
        document.getElementById('releasesSearch').value = 'T27';
        document.getElementById('releasesPullOnly').checked = false;
        R.view({ mode: 'grid', period: 'all', market: '', publisher: '', format: '', status: '' });
        const g = document.getElementById('releasesGrid');
        r.uiGrid = g.querySelectorAll('.release-card').length >= 9 && !!g.querySelector('.rel-date.is-announced') && !!g.querySelector('.rel-date.is-confirmed') && !!g.querySelector('.rel-date.is-unknown') && !!g.querySelector('.rel-status.st-delayed');
        R.view({ mode: 'month', period: 'month', anchor: new Date(plus(24) + 'T12:00:00') });
        r.uiMonth = !!g.querySelector('.rel-cal') && [...g.querySelectorAll('.rel-cal-item')].some(b => b.textContent.includes('T27 Hero'));
        const modesOk = ['list', 'publisher', 'series', 'market'].every(mode => { R.view({ mode, period: 'all' }); return g.querySelectorAll('.rel-row').length >= 9 && (mode === 'list' || g.querySelectorAll('.rel-group').length >= 2); });
        R.view({ mode: 'list', period: 'all', market: 'FR' });
        const frRows = [...g.querySelectorAll('.rel-row')];
        r.uiViews = modesOk && frRows.length >= 4 && frRows.every(x => R.get(x.dataset.id).market === 'FR');
        R.view({ mode: 'list', period: 'all', market: '', status: 'cancelled' });
        r.uiStatusFilter = g.querySelectorAll('.rel-row').length === 1;
        R.view({ status: '', mode: 'grid', period: 'week' });
        R.openSheet(fr.id);
        const sheet = document.getElementById('pubModalBody');
        r.uiSheet = document.getElementById('pubModal').classList.contains('open') && sheet.textContent.includes('Traduit depuis') && sheet.textContent.includes('Date annoncée initialement');
        R.openSheet(hero.id);
        r.uiHistory = sheet.textContent.includes('reportée');
        document.getElementById('pubModal').classList.remove('open');
        r.uiPullPanel = document.querySelectorAll('#pullPanelBody .pull-row').length >= 4 && document.getElementById('relSyncInfo').textContent.length > 20;
        document.getElementById('releasesSearch').value = '';
        P.showSinglesView('collection');
        P.openSingleInspector(wa.item);
        r.uiWishBox = !document.getElementById('inspectWishBox').hidden && document.querySelector('#inspectWishBox [data-w="priority"]').value === 'high' && document.getElementById('inspectWishlistToggleBtn').textContent.includes('acheté');
        P.openSingleInspector(lg);
        r.uiOwnedBtn = document.getElementById('inspectWishBox').hidden && document.getElementById('inspectWishlistToggleBtn').textContent.includes('Ajouter à la wishlist');
        document.getElementById('singleIssueInspectorModal').classList.remove('open');
        await new Promise(res => setTimeout(res, 300));
        r._expect = { hero: hero.id, pl1: pl1.pull.id, fr: fr.id, pubs: [...pubIds], pulls: [...plIds] };
        return r;
      })(), new Promise(res => setTimeout(() => res({ blockedAt: window.__t27 }), 60000))])`);
      console.log('Résultat Test 27 (a):', JSON.stringify(t27a));
      // Redémarrage hors ligne : publications, historique et pull list relus depuis IndexedDB
      let t27b = {};
      try {
        await send('Network.enable');
        await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        await send('Page.reload', { ignoreCache: false });
        for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 250)); if (await evalExpr('!!(window.Panel && window.Panel.releases) && document.readyState === "complete"')) break; }
        t27b = await evalExpr(`(async () => {
          const P = window.Panel, R = P.releases, exp = ${JSON.stringify((t27a && t27a._expect) || {})};
          await R.ready();
          const hero = R.get(exp.hero), pl = R.pulls.get(exp.pl1), fr = R.get(exp.fr);
          P.showSinglesView('releases');
          R.view({ mode: 'list', period: 'all' });
          const offlineInfo = document.getElementById('relSyncInfo').textContent;
          return { restart: !!hero && hero.dates.current !== hero.dates.initial && hero.dateHistory.some(h => h.kind === 'postponed') && !!pl && pl.status === 'picked' && pl.copyIds.length === 3 &&
            !!fr && fr.relations.length === 1 && P.getPhysicalSingles().filter(s => s.pullId === exp.pl1).length === 3,
            offlineView: /Hors ligne/.test(offlineInfo) && document.querySelectorAll('#releasesGrid .rel-row').length >= 9 };
        })()`);
      } finally {
        await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      }
      // Restauration : les publications et la pull list retirées de la base sont reconstruites depuis la sauvegarde, sans doublon
      const t27c = await evalExpr(`(async () => {
        const P = window.Panel, R = P.releases, exp = ${JSON.stringify((t27a && t27a._expect) || {})};
        const out = {};
        const rawDel = () => new Promise(res => {
          const q = indexedDB.open('panel-catalog');
          q.onsuccess = () => { const db = q.result; const tx = db.transaction(['publications', 'pulls'], 'readwrite');
            (exp.pubs || []).forEach(id => tx.objectStore('publications').delete(id)); (exp.pulls || []).forEach(id => tx.objectStore('pulls').delete(id));
            tx.oncomplete = () => { db.close(); res(true); }; tx.onerror = () => { db.close(); res(false); }; };
          q.onerror = () => res(false);
        });
        try {
          await R.ready();
          const backup = JSON.parse(JSON.stringify({ format: 'panel-backup', version: 3, physicalSingles: P.getPhysicalSingles(), seriesMeta: P.getSeriesMeta(), releases: R.exportData() }));
          await rawDel(); await R.reloadFromDb();
          const gone = !R.get(exp.hero) && !R.pulls.get(exp.pl1);
          const res1 = await P.applyBackupRestore(P.validateBackupPayload(backup), { mode: 'merge' });
          await new Promise(r => setTimeout(r, 400));
          await R.reloadFromDb();
          const back = !!R.get(exp.hero) && R.get(exp.hero).dateHistory.length >= 2 && R.pulls.get(exp.pl1).status === 'picked' && R.get(exp.fr).relations.length === 1;
          const count = R.all().length;
          const res2 = await P.applyBackupRestore(P.validateBackupPayload(backup), { mode: 'merge' });
          out.restore = gone && res1.ok && back && res2.ok && R.all().length === count;
        } catch (e) { out.restore = false; out._err = String(e && e.message || e); }
        // Nettoyage : collection d'origine et base du profil de test rétablies
        const saved = JSON.parse(localStorage.getItem('panel_test27_saved') || 'null');
        if (saved) P.setPhysicalSingles(saved.singles);
        localStorage.removeItem('panel_test27_saved');
        await rawDel(); await R.reloadFromDb();
        out.cleanup = !!saved && !R.get(exp.hero) && P.getPhysicalSingles().length === saved.singles.length;
        return out;
      })()`);
      const t27 = Object.assign({}, t27a, t27b, t27c);
      delete t27._expect;
      console.log('Résultat Test 27:', JSON.stringify(t27));
      const t27keys = ['create', 'noDup', 'variants', 'provenance', 'noAutoRelation', 'relations', 'edit', 'editClash', 'calImport', 'calDedup', 'postponed', 'absenceNotCancel', 'syncError', 'connectors',
        'csvImport', 'unknownDate', 'csvNoDup', 'csvRoundTrip', 'jsonNoDup', 'available', 'confirmed', 'pullAdd', 'pullEdit', 'pullAvailable', 'pickUp', 'pickNoDup', 'pullCancel', 'pullManual',
        'pullToWish', 'pickConvertsWish', 'wishAdd', 'wishNotOwned', 'wishLegacy', 'wishToCollection', 'collectionToWish', 'collectionLink', 'exportData', 'sanitize', 'mergeNoDup',
        'uiGrid', 'uiMonth', 'uiViews', 'uiStatusFilter', 'uiSheet', 'uiHistory', 'uiPullPanel', 'uiWishBox', 'uiOwnedBtn', 'restart', 'offlineView', 'restore', 'cleanup'];
      const t27fail = t27keys.filter(k => t27[k] !== true);
      if (t27fail.length) console.log('Test 27 — vérifications en échec :', t27fail.join(', '));
      testResults.push({
        test: 'Calendrier international : publications US/FR et relations, connecteur et import contrôlé, reports/annulations/historique, Pull List, Wishlist, transitions sans doublon, sauvegarde, hors ligne',
        ok: !!t27a && t27fail.length === 0
      });
      // ------------------------------------------------------------------
      // TEST 28 : Sources, provenance par champ, conflits, pipeline d'import (lot 2.5)
      // ------------------------------------------------------------------
      console.log('\n[TEST 28] Sources de données, provenance, conflits, import contrôlé, annulation...');
      const t28a = await evalExpr(`Promise.race([(async () => {
        const P = window.Panel, R = P.releases, D = P.data;
        await R.ready();
        const r = {};
        const metaBefore = R.meta();
        localStorage.setItem('panel_test28_saved', JSON.stringify({ meta: metaBefore, singles: P.getPhysicalSingles(), imports: (metaBefore.imports || []).map(x => x.id) }));
        const singlesBefore = JSON.stringify(P.getPhysicalSingles()), pullsBefore = R.pulls.all().length;
        const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
        const D1 = plus(30), D2 = plus(45), D3 = plus(37), D4 = plus(50);
        const NL = String.fromCharCode(10);
        const csv = lines => lines.join(NL);
        const byS = s => R.all().find(p => p.series === s);
        window.__t28 = '1 sources';
        const src = D.sources();
        const crit = ['coverage', 'api', 'license', 'commercial', 'cost', 'attribution', 'storage', 'cache', 'images', 'limits', 'reliability'];
        const get = id => src.find(s => s.id === id) || {};
        const conIds = R.connectors().map(c => c.id);
        r.sources = src.length >= 20 && src.every(s => crit.every(k => !!s.criteria[k]) && ['operational', 'credentials', 'authorization', 'unavailable'].includes(s.status)) &&
          get('comicvine').commercial === 'noncommercial' && get('bnf').commercial === 'commercial' && get('metron').commercial === 'unknown' && get('electre').commercial === 'written' &&
          get('locg').commercial === 'incompatible' && get('gcd').commercial === 'conditions' && ['dc', 'image', 'darkhorse', 'idw', 'boom', 'dynamite', 'panini', 'urban', 'delcourt', 'glenat', 'marvel_api', 'prh', 'lunar', 'dilicom'].every(id => !!get(id).id);
        r.noFictitious = src.filter(s => s.connector).every(s => conIds.includes(s.connector)) && src.filter(s => s.status === 'operational' || s.status === 'credentials').every(s => !!s.connector);
        let calls = 0;
        R.setFetchForTest(async () => { calls++; return []; });
        await D.setEnabled('comicvine', false);
        const off = await R.sync('comicvine', D1, D1);
        await D.setEnabled('comicvine', true);
        const on = await R.sync('comicvine', D1, D1);
        r.connectorToggle = off.status === 'disabled' && calls === 1 && on.status === 'ok' && (await D.setEnabled('bnf', true)).ok === false && (await D.setEnabled('manual', false)).ok === false;
        D.setEditionForTest('commercial');
        const blocked = await R.sync('comicvine', D1, D1);
        const cvBlocked = D.sources().find(s => s.id === 'comicvine').allowed === false && D.sources().find(s => s.id === 'import').allowed === true;
        D.setEditionForTest('personal');
        r.commercialGate = blocked.status === 'blocked' && calls === 1 && cvBlocked && D.edition() === 'personal';
        window.__t28 = '2 aperçu';
        const nBefore = R.all().length;
        const csv1 = csv(['marche;editeur;serie;numero;titre;format;date_annoncee;comicvine;isbn;Prix FR',
          'US;Image;T28 Alpha;1;Premier;single;' + D1 + ';T28CV1;;19,90', 'FR;Urban Comics;T28 Beta;1;;album;' + D2 + ';;978-2-00-000001-1;',
          'US;Image;T28 Gamma;2;;single;31/02/2027;;;', 'US;Image;;3;;single;' + D1 + ';;;', 'US;Image;T28 Alpha;1;Premier;single;' + D1 + ';T28CV1;;19,90']);
        const pl1 = await D.plan({ text: csv1, name: 't28-editeur.csv' }, { sourceType: 'publisher' });
        r.importPreview = pl1.format === 'csv' && pl1.counts.add === 2 && pl1.counts.invalid === 2 && pl1.counts.duplicate === 1 && pl1.unknown.includes('Prix FR') &&
          pl1.rows.some(x => x.action === 'invalid' && x.errors.join(' ').includes('illisible')) && R.all().length === nBefore && !pl1.blocking;
        const plMap = await D.plan({ text: csv(['Nom de série;N°;Sortie', 'T28 Theta;4;' + D1]), name: 't28-map.csv' });
        const plMap2 = await D.plan({ table: plMap.table, name: 't28-map.csv' }, { mapping: ['series', 'issue', 'date'] });
        r.mapping = !!plMap.blocking && !plMap2.blocking && plMap2.counts.add === 1 && plMap2.rows[0].raw.date === D1;
        let xlsxOk = false;
        try {
          const cell = (ref, v) => '<c r="' + ref + '" t="inlineStr"><is><t>' + v + '</t></is></c>';
          const z = new JSZip();
          z.file('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">' + cell('A1', 'serie') + cell('B1', 'numero') + cell('C1', 'editeur') + cell('D1', 'date') +
            '</row><row r="2">' + cell('A2', 'T28 Xlsx') + cell('B2', '7') + cell('C2', 'DC Comics') + cell('D2', D1) + '</row></sheetData></worksheet>');
          const buf = await z.generateAsync({ type: 'arraybuffer' });
          const px = await D.plan({ buffer: buf, name: 't28.xlsx' });
          const pj = await D.plan({ text: JSON.stringify([{ series: 'T28 Json', issue: '1', publisher: 'Marvel', dates: { current: D1 }, externalIds: { comicvine: 'T28CVJ' } }]), name: 't28.json' });
          xlsxOk = px.format === 'xlsx' && px.counts.add === 1 && px.rows[0].raw.series === 'T28 Xlsx' && pj.format === 'json' && pj.counts.add === 1 && pj.rows[0].raw.comicvine === 'T28CVJ';
        } catch (e) { r._xlsxErr = String(e && e.message || e); }
        r.formats = xlsxOk;
        window.__t28 = '3 application';
        const rep1 = await D.apply(pl1);
        const alpha = byS('T28 Alpha'), beta = byS('T28 Beta');
        r.importReport = rep1.added === 2 && rep1.invalid === 2 && rep1.duplicates === 1 && rep1.unknownColumns.includes('Prix FR') && !!alpha && !!beta && D.imports()[0].id === pl1.id;
        let reapply = false; try { await D.apply(pl1); } catch (_) { reapply = true; }
        r.noDoubleApply = reapply;
        r.unknownKept = !!alpha && alpha.extra && alpha.extra['Prix FR'] === '19,90';
        const pa = D.provenance(alpha.id);
        r.provCreate = pa.date && pa.date.type === 'publisher' && pa.date.src === 'import' && pa.date.conf === 'high' && pa.date.status === 'unverified' && !!pa.date.at && !!pa.date.verified && pa.title.v === 'Premier' && pa.comicvine.v === 'T28CV1';
        window.__t28 = '4 sources concurrentes';
        R.setFetchForTest(async () => [{ id: 'T28CV1', volume: 'T28 Alpha', issue: '1', title: 'Premier', storeDate: D1, publisher: 'Image', url: 'https://comicvine.gamespot.com/t28/' }]);
        await R.sync('comicvine', D1, D1);
        const pc = D.provenance(alpha.id);
        r.provConfirm = pc.date.status === 'verified' && (pc.date.confirmedBy || []).includes('comicvine') && pc.date.type === 'publisher' && pc.url && pc.url.src === 'comicvine' && R.get(alpha.id).url === 'https://comicvine.gamespot.com/t28/';
        R.setFetchForTest(async () => [{ id: 'T28CV1', volume: 'T28 Alpha', issue: '1', title: 'Premier (variante)', storeDate: D3, publisher: 'Image', url: 'https://comicvine.gamespot.com/t28/' }]);
        const s2 = await R.sync('comicvine', D3, D3);
        const openA = D.conflicts('open').filter(c => c.pubId === alpha.id);
        r.noSilentOverwrite = R.get(alpha.id).dates.current === D1 && R.get(alpha.id).title === 'Premier' && openA.some(c => c.field === 'date' && c.incoming.v === D3 && c.current.type === 'publisher') && openA.some(c => c.field === 'title') && s2.conflicts >= 2;
        await R.sync('comicvine', D3, D3);
        r.conflictNoDup = D.conflicts('open').filter(c => c.pubId === alpha.id).length === openA.length;
        R.setFetchForTest(async () => [{ id: 'T28CV2', volume: 'T28 Delta', issue: '1', storeDate: D1, publisher: 'Image' }]);
        await R.sync('comicvine', D1, D1);
        const pd = await D.plan({ text: csv(['editeur;serie;numero;date_annoncee;comicvine', 'Image;T28 Delta;1;' + D2 + ';T28CV2']), name: 't28-delta.csv' }, { sourceType: 'publisher' });
        await D.apply(pd);
        const delta = byS('T28 Delta');
        r.higherWins = pd.rows[0].action === 'update' && delta.dates.current === D2 && D.provenance(delta.id).date.type === 'publisher' && delta.dateHistory.some(h => h.kind === 'postponed') && !D.conflicts('open').some(c => c.pubId === delta.id);
        await R.edit(beta.id, { date: D4 });
        const pb = await D.plan({ text: csv(['editeur;serie;numero;format;date_annoncee;isbn', 'Urban Comics;T28 Beta;1;album;' + D2 + ';9782000000011']), name: 't28-beta.csv' }, { sourceType: 'publisher' });
        await D.apply(pb);
        r.manualProtected = R.get(beta.id).dates.current === D4 && D.provenance(beta.id).date.type === 'manual' && D.conflicts('open').some(c => c.pubId === beta.id && c.field === 'date' && c.current.type === 'manual');
        window.__t28 = '5 doublons';
        await R.edit(beta.id, { externalIds: { gcd: 'T28G1' } });
        const nDup = R.all().length;
        const pdup = await D.plan({ text: csv(['serie;numero;editeur;format;comicvine;gcd;isbn;date_annoncee',
          'T28 ALPHA (2026);1;Image;single;T28CV1;;;' + D1, 'T28 Beta Integrale;1;Urban Comics;album;;;978-2-00-000001-1;', 'T28 Omega;1;Image;single;T28CV2;T28G1;;', 'T28 Alphaa;1;Image;single;;;;' + D1]), name: 't28-doublons.csv' });
        const rows = pdup.rows;
        r.dupPriority = rows[0].matchId === alpha.id && rows[0].action !== 'add' && rows[1].matchId === beta.id && rows[2].action === 'conflict' && rows[3].action === 'add';
        const repDup = await D.apply(pdup);
        r.noTitleMerge = R.all().length === nDup + 1 && !!byS('T28 Alphaa') && !byS('T28 Omega') && repDup.conflictRows >= 1 &&
          D.conflicts('open').some(c => c.field === 'identity' && (c.candidates || []).includes(beta.id) && (c.candidates || []).includes(delta.id));
        r.personalUntouched = JSON.stringify(P.getPhysicalSingles()) === singlesBefore && R.pulls.all().length === pullsBefore;
        window.__t28 = '6 interface';
        P.showSinglesView('releases');
        document.getElementById('releasesSearch').value = '';
        R.view({ mode: 'list', period: 'all', market: '', publisher: '', format: '', status: '' });
        const gridTxt = document.getElementById('releasesGrid').textContent;
        r.calendarFed = gridTxt.includes('T28 Alpha') && gridTxt.includes('T28 Beta') && gridTxt.includes('T28 Delta');
        await D.open('sources');
        const body = document.getElementById('dataAdminBody');
        r.uiSources = document.getElementById('dataAdminModal').classList.contains('open') && body.querySelectorAll('.da-table tbody tr').length >= 20 && body.querySelectorAll('[data-src-toggle]').length === 2 && body.textContent.includes('Non commercial uniquement');
        const pUi = await D.planInUi(csv(['serie;numero;editeur;date_annoncee;Remarque', 'T28 Ui;1;Image;' + D1 + ';note']), 't28-ui.csv');
        r.uiImport = !!pUi && !!body.querySelector('.da-plan') && body.querySelectorAll('[data-map-col]').length === 5 && body.textContent.includes('Nouvelle') && !byS('T28 Ui');
        await D.open('conflicts');
        r.uiConflicts = body.querySelectorAll('.da-conflict').length >= 3 && !!body.querySelector('[data-choice="incoming"]') && /Conflits \\(\\d+\\)/.test(document.querySelector('[data-da-tab="conflicts"]').textContent);
        await D.open('log');
        r.uiLog = body.querySelectorAll('.da-table tbody tr').length >= 3;
        await D.open('prov');
        const ps = document.getElementById('daProvSearch');
        ps.value = 'T28 Alpha'; ps.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(res => setTimeout(res, 450));
        const hit = body.querySelector('[data-prov-id="' + alpha.id + '"]');
        if (hit) hit.click();
        r.uiProvenance = !!hit && !!body.querySelector('.da-prov') && body.textContent.includes('Éditeur') && body.textContent.includes('Prix FR');
        D.close();
        R.openSheet(alpha.id);
        r.uiSheet = document.getElementById('pubModalBody').textContent.includes('Provenance des champs') && document.getElementById('pubModalBody').textContent.includes('conflit à régler');
        document.getElementById('pubModal').classList.remove('open');
        r.uiSidebar = !!document.getElementById('openDataAdminBtn') && !!document.getElementById('backupJsonBtn') && !!document.getElementById('restoreJsonBtn') && !document.querySelector('.sidebar-footer p');
        window.__t28 = '7 résolution';
        const cDate = D.conflicts('open').find(c => c.pubId === alpha.id && c.field === 'date');
        const cTitle = D.conflicts('open').find(c => c.pubId === alpha.id && c.field === 'title');
        const cBeta = D.conflicts('open').find(c => c.pubId === beta.id && c.field === 'date');
        const cId = D.conflicts('open').find(c => c.field === 'identity');
        const z1 = await D.resolve(cDate.id, 'incoming');
        const z2 = await D.resolve(cTitle.id, 'manual', 'Premier numéro');
        const z3 = await D.resolve(cBeta.id, 'keep');
        const z4 = await D.resolve(cId.id, 'incoming');
        const z5 = await D.resolve(cDate.id, 'keep');
        const pr = D.provenance(alpha.id);
        r.resolve = z1.ok && z2.ok && z3.ok && z4.ok === false && z5.ok === false && R.get(alpha.id).dates.current === D3 && pr.date.by === 'user' && pr.date.status === 'verified' &&
          R.get(alpha.id).title === 'Premier numéro' && pr.title.type === 'manual' && (pr.title.hist || []).some(h => h.v === 'Premier') && R.get(beta.id).dates.current === D4 &&
          D.conflicts('resolved').some(c => c.id === cBeta.id && c.resolution === 'keep');
        window.__t28 = '8 annulation';
        const u1 = await D.undo(pdup.id);
        const u1b = await D.undo(pdup.id);
        r.undo = u1.ok && u1.removed === 1 && !byS('T28 Alphaa') && !!R.get(alpha.id) && u1b.ok === false && D.conflicts().some(c => c.id === cId.id && c.status === 'withdrawn');
        await R.upsert({ series: 'T28 Epsilon', issue: '1', publisher: 'Image', date: D1, comicvine: 'T28CV5' }, 'comicvine');
        const eps = byS('T28 Epsilon');
        const pe = await D.plan({ text: csv(['editeur;serie;numero;date_annoncee;comicvine', 'Image;T28 Epsilon;1;' + D2 + ';T28CV5']), name: 't28-eps.csv' }, { sourceType: 'publisher' });
        await D.apply(pe);
        const epsMid = R.get(eps.id).dates.current;
        const u2 = await D.undo(pe.id);
        r.undoRestores = epsMid === D2 && u2.restored === 1 && R.get(eps.id).dates.current === D1 && D.provenance(eps.id).date.type === 'third_party';
        const pz = await D.plan({ text: csv(['editeur;serie;numero;date_annoncee', 'Image;T28 Zeta;1;' + D1, 'Image;T28 Eta;1;' + D1]), name: 't28-zeta.csv' });
        await D.apply(pz);
        const zeta = byS('T28 Zeta'), eta = byS('T28 Eta');
        await R.pulls.add(zeta.id, {});
        await R.edit(eta.id, { title: 'Eta modifiée' });
        const u3 = await D.undo(pz.id);
        r.undoSafe = u3.ok && u3.removed === 0 && (u3.kept.includes(zeta.id) || u3.modified.includes(zeta.id)) && u3.modified.includes(eta.id) && !!R.get(zeta.id) && !!R.get(eta.id) && R.get(eta.id).title === 'Eta modifiée';
        await R.reloadFromDb();
        r.persisted = R.get(alpha.id).dates.current === D3 && !byS('T28 Alphaa') && D.provenance(alpha.id).title.type === 'manual' && R.get(eps.id).dates.current === D1;
        window.__t28 = '9 sauvegarde';
        const ex = R.exportData();
        const exA = ex.publications.find(p => p.id === alpha.id);
        const bad = JSON.parse(JSON.stringify(ex));
        const badA = bad.publications.find(p => p.id === alpha.id);
        badA.prov.date.type = 'pirate'; badA.prov.evil = { v: '<img src=x onerror=alert(1)>', type: 'manual' }; badA.extra = { ok: 'oui', nested: { x: 1 } };
        bad.conflicts.push({ id: 'pirate', pubId: alpha.id, field: 'date', status: 'open', current: {}, incoming: {} });
        const san = R.sanitize(bad);
        const sanA = san.publications.find(p => p.id === alpha.id);
        const cfCount = D.conflicts().length;
        const m = R.merge(san, 'merge');
        await m.write;
        r.backup = !!exA.prov && exA.prov.title.type === 'manual' && ex.conflicts.some(c => c.pubId === alpha.id) && !sanA.prov.date && !sanA.prov.evil && sanA.prov.title.type === 'manual' &&
          sanA.extra.ok === 'oui' && !('nested' in sanA.extra) && !san.conflicts.some(c => c.id === 'pirate') && san.conflicts.length === ex.conflicts.length && m.added === 0 && D.conflicts().length === cfCount;
        await D.setEnabled('import', false);
        let refused = false; try { await D.apply(await D.plan({ text: csv(['serie;numero', 'T28 Off;1']), name: 't28-off.csv' })); } catch (_) { refused = true; }
        r.importDisabled = refused && !byS('T28 Off');
        R.setFetchForTest(null);
        r._expect = { alpha: alpha.id, beta: beta.id };
        return r;
      })(), new Promise(res => setTimeout(() => res({ blockedAt: window.__t28 }), 90000))])`);
      console.log('Résultat Test 28 (a):', JSON.stringify(t28a));
      // Redémarrage : provenance, conflits et réglage des sources relus depuis IndexedDB
      await send('Page.reload', { ignoreCache: false });
      for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 250)); if (await evalExpr('!!(window.Panel && window.Panel.data) && document.readyState === "complete"')) break; }
      const t28b = await evalExpr(`(async () => {
        const P = window.Panel, R = P.releases, D = P.data, exp = ${JSON.stringify((t28a && t28a._expect) || {})};
        await R.ready();
        const a = R.get(exp.alpha);
        return { restart: !!a && D.provenance(exp.alpha).title.type === 'manual' && D.conflicts('resolved').some(c => c.pubId === exp.alpha) && D.sources().find(s => s.id === 'import').enabled === false && D.imports().length >= 4 };
      })()`);
      // Nettoyage : publications de test retirées, métadonnées et collection d'origine rétablies
      const t28c = await evalExpr(`(async () => {
        const P = window.Panel, R = P.releases;
        await R.ready();
        const saved = JSON.parse(localStorage.getItem('panel_test28_saved') || 'null');
        if (!saved) return { cleanup: false };
        const ids = R.all().filter(p => /^T28 /.test(p.series)).map(p => p.id);
        const pulls = R.pulls.all().filter(pl => ids.includes(pl.pubId)).map(pl => pl.id);
        const newImports = (R.meta().imports || []).map(x => x.id).filter(id => !saved.imports.includes(id));
        await new Promise(res => {
          const q = indexedDB.open('panel-catalog');
          q.onsuccess = () => { const db = q.result; const tx = db.transaction(['publications', 'pulls', 'meta'], 'readwrite');
            ids.forEach(id => tx.objectStore('publications').delete(id)); pulls.forEach(id => tx.objectStore('pulls').delete(id));
            newImports.forEach(id => tx.objectStore('meta').delete('relimport_' + id)); tx.objectStore('meta').put(saved.meta);
            tx.oncomplete = () => { db.close(); res(true); }; tx.onerror = () => { db.close(); res(false); }; };
          q.onerror = () => res(false);
        });
        await R.reloadFromDb();
        P.setPhysicalSingles(saved.singles);
        localStorage.removeItem('panel_test28_saved');
        return { cleanup: !R.all().some(p => /^T28 /.test(p.series)) && P.data.sources().find(s => s.id === 'import').enabled !== false && (R.meta().conflicts || []).length === (saved.meta.conflicts || []).length && P.getPhysicalSingles().length === saved.singles.length };
      })()`);
      const t28 = Object.assign({}, t28a, t28b, t28c);
      delete t28._expect;
      console.log('Résultat Test 28:', JSON.stringify(t28));
      const t28keys = ['sources', 'noFictitious', 'connectorToggle', 'commercialGate', 'importPreview', 'mapping', 'formats', 'importReport', 'noDoubleApply', 'unknownKept', 'provCreate',
        'provConfirm', 'noSilentOverwrite', 'conflictNoDup', 'higherWins', 'manualProtected', 'dupPriority', 'noTitleMerge', 'personalUntouched', 'calendarFed', 'uiSources', 'uiImport',
        'uiConflicts', 'uiLog', 'uiProvenance', 'uiSheet', 'uiSidebar', 'resolve', 'undo', 'undoRestores', 'undoSafe', 'persisted', 'backup', 'importDisabled', 'restart', 'cleanup'];
      const t28fail = t28keys.filter(k => t28[k] !== true);
      if (t28fail.length) console.log('Test 28 — vérifications en échec :', t28fail.join(', '));
      testResults.push({
        test: 'Sources & données : matrice des sources, connecteurs activables, édition commerciale, provenance par champ, conflits sans écrasement silencieux, doublons par priorité, import CSV/JSON/XLSX avec aperçu, correspondance, rapport et annulation sûre',
        ok: !!t28a && t28fail.length === 0
      });
      // ------------------------------------------------------------------
      // TEST 29 : Explorer & guides de lecture (lot 2.6)
      // ------------------------------------------------------------------
      console.log('\n[TEST 29] Explorer, guides de lecture, progression, rapprochements, import/export, sauvegarde...');
      const t29a = await evalExpr(`Promise.race([(async () => {
        const P = window.Panel, X = P.explorer, R = P.releases;
        await R.ready(); await X.load();
        const r = {};
        window.__t29 = '1 base';
        const kibBefore = X.guide('gd_king_in_black');
        localStorage.setItem('panel_test29_saved', JSON.stringify({ singles: P.getPhysicalSingles(), kib: kibBefore, hist: localStorage.getItem('panel_explorer_recent') }));
        const dbInfo = await new Promise(res => { const q = indexedDB.open('panel-catalog'); q.onsuccess = () => { const db = q.result; const o = { v: db.version, stores: [...db.objectStoreNames] }; res(o); }; q.onerror = () => res(null); });
        r.dbV4 = !!dbInfo && dbInfo.v === 4 && ['publishers', 'series', 'issues', 'variants', 'copies', 'publications', 'pulls', 'meta', 'backups', 'editorial', 'readprog'].every(s => dbInfo.stores.includes(s));
        // Premier guide : King in Black, données sourcées, sans niveau inventé
        const k = kibBefore, ref = k && k.orders[0], simple = k && k.orders[1];
        const ess = ref ? ref.entries.filter(e => e.importance === 'essential') : [];
        r.kibSeed = !!k && k.origin === 'seed' && ref.entries.length === 65 && ref.sourceId === 'src_cbro' && ess.length === 10 &&
          ref.entries.every(e => (e.importance === 'essential' || e.importance === 'optional') && e.importanceSource === 'src_cbro') && !ref.entries.some(e => e.importance === 'recommended') &&
          ref.entries.every((e, i) => e.pos === i + 1) && new Set(ref.entries.map(e => e.id)).size === 65 && ref.entries[11].series === 'King in Black' && ref.entries[11].issue === '1' &&
          ref.entries[64].series === 'Venom' && ref.entries[64].issue === '200' && simple.type === 'simplified' && simple.derivedFrom === ref.id && simple.entries.length === 10;
        r.kibHonest = k.completeness === 'demo' && k.image === null && k.sources.every(s => /^https:\\/\\//.test(s.url) && s.retrievedAt && s.license) && k.editions.length === 2 &&
          k.editions.every(ed => ed.status === 'unverified' && ed.contains.length === 0) && k.characters.every(c => c.status === 'unverified') && ref.entries.every(e => !e.cover && !e.pubId);
        // Validation
        window.__t29 = '2 validation';
        const v1 = X.validate({ id: 'mauvais id', title: '' }), v2 = X.validate({ id: 'gd_t29_v', title: 'V', sources: [{ id: 'src_a', label: 'A', url: 'javascript:alert(1)' }], orders: [{ entries: [{ series: 'T29 V', issue: '1', importance: 'essential' }, { series: 'T29 V', issue: '1' }, { issue: '2' }] }] });
        r.validation = !v1.ok && v1.errors.length >= 2 && !v2.ok && v2.errors.some(e => /série manquante/.test(e));
        const v3 = X.validate({ id: 'gd_t29_v', title: 'V', image: { url: 'http://x.test/a.png' }, sources: [{ id: 'src_a', label: 'A', url: 'javascript:alert(1)' }], orders: [{ entries: [{ series: 'T29 V', issue: '1', importance: 'essential' }, { series: 'T29 V', issue: '#1' }, { series: 'T29 V', issue: '2', importance: 'optional', importanceSource: 'src_a' }] }] });
        r.noAutoImportance = v3.ok && v3.guide.sources[0].url === '' && v3.guide.image === null && v3.guide.orders[0].entries.length === 2 && v3.guide.orders[0].entries[0].importance === null &&
          v3.guide.orders[0].entries[1].importance === 'optional' && v3.warnings.some(w => /sans source/.test(w)) && v3.warnings.some(w => /double/.test(w));
        // Guide de test + rapprochements
        window.__t29 = '3 rapprochements';
        const T = 'T29 Saga';
        const g1 = { id: 'gd_t29_saga', title: 'T29 Saga <img src=x onerror=window.__x29=1>', publisher: 'Marvel', category: 'saga', periodStart: 2024,
          sources: [{ id: 'src_t29', label: 'Source T29', url: 'https://example.org/t29', retrievedAt: '2026-11-07', license: 'Test' }],
          characters: [{ name: 'T29 Héros' }], creators: [{ name: 'T29 Autrice', roles: ['writer'] }],
          image: { url: 'https://127.0.0.1:1/t29-hero.png', source: 'Test', rights: 'Test' },
          orders: [{ id: 'ord_t29', type: 'reading' === 'x' ? '' : 'recommended', label: 'Ordre T29', sourceId: 'src_t29', entries: [1, 2, 3, 4, 5].map(n => ({ series: T, issue: String(n), year: '2024', publisher: 'Marvel', importance: n === 1 ? 'essential' : 'optional', importanceSource: n === 1 ? 'src_t29' : 'editorial', why: n === 2 ? 'Révélation <b>importante</b>' : '', spoiler: n === 2 })) }],
          editions: [{ id: 'ed_t29_fr', lang: 'fr', title: 'T29 Saga Intégrale', publisher: 'Panini Comics', isbn: '979-10-00000-00-1', relation: 'collects', contains: [], sourceId: 'src_t29', status: 'verified' }] };
        const s1 = await X.save(g1);
        const g2 = { id: 'gd_t29_other', title: 'T29 Autre', publisher: 'Marvel', category: 'character_path', orders: [{ id: 'ord_t29b', label: 'O', entries: [{ series: T, issue: '1', year: '2024' }] }] };
        const s2 = await X.save(g2);
        r.saved = s1.ok && s1.created && s2.ok && X.guides().some(g => g.id === 'gd_t29_saga') && X.guide('gd_t29_saga').editions[0].status === 'verified' && X.guide('gd_t29_saga').orders[0].entries[1].importance === 'optional';
        const base = P.getPhysicalSingles();
        const mk = (id, o) => Object.assign({ id, series: T, publisher: 'Marvel', isWishlist: false, isRead: false, addedAt: new Date().toISOString() }, o);
        P.setPhysicalSingles(base.concat([mk('t29_s1', { issue: '1', coverYear: 2024 }), mk('t29_s2', { issue: '2' }), mk('t29_s3', { issue: '3', coverYear: 2024, isWishlist: true }),
          mk('t29_s4', { issue: '4', coverYear: 2024, isRead: true }), mk('t29_s5', { issue: '5', coverYear: 1994 }), mk('t29_sx', { series: 'T29 Sagas', issue: '1', coverYear: 2024 })]));
        const up = await R.upsert({ market: 'US', publisher: 'Marvel', series: T, issue: '1', date: '2024-03-06', format: 'single' }, 'manual');
        const eid = n => X.entryKey(T, '', n);
        const m1 = X.match('gd_t29_saga', eid(1)), m2 = X.match('gd_t29_saga', eid(2)), m3 = X.match('gd_t29_saga', eid(3)), m4 = X.match('gd_t29_saga', eid(4)), m5 = X.match('gd_t29_saga', eid(5));
        r.matchExact = !!up.pub && m1.pubId === up.pub.id && m1.pubHow === 'auto' && m1.owned.length === 1 && m1.owned[0] === 't29_s1' && !m1.owned.includes('t29_sx');
        r.matchProbable = m2.owned.length === 0 && m2.probable[0] === 't29_s2' && m5.owned.length === 0 && m5.probable.length === 0;
        r.ownedVsWish = m3.owned.length === 0 && m3.wish[0] === 't29_s3' && m3.status === '';
        r.readDerived = m4.owned[0] === 't29_s4' && m4.effective === 'read' && m4.status === '';
        // Progression personnelle : indépendante de la possession, partagée entre guides
        window.__t29 = '4 progression';
        const p1 = await X.setProgress(eid(3), 'read'), bad = await X.setProgress(eid(3), 'possédé'), same = await X.setProgress(eid(3), 'read');
        await X.setProgress(eid(5), 'skipped');
        const st = X.stats('gd_t29_saga');
        r.progress = p1.ok && !bad.ok && same.unchanged === true && X.progress(eid(3)).status === 'read' && X.progress(eid(3)).history.length === 1 &&
          X.match('gd_t29_saga', eid(3)).owned.length === 0 && X.match('gd_t29_saga', eid(3)).wish.length === 1 && P.getPhysicalSingles().find(s => s.id === 't29_s3').isRead === false;
        r.stats = st.total === 5 && st.read === 2 && st.skipped === 1 && st.owned === 2 && st.missing === 3 && st.essential === 1 && st.optional === 4 && st.pct === 50;
        await X.setProgress(eid(1), 'reading');
        r.sharedProgress = X.stats('gd_t29_other').reading === 1 && X.match('gd_t29_other', eid(1)).status === 'reading';
        // Recherche
        window.__t29 = '5 recherche';
        const S = q => X.search(q);
        const sk = S('king in black'), sv = S('Venom'), sc = S('knull'), scr = S('cates'), sp = S('marvel'), se = S('9791039100632'), st29 = S('t29 saga 1');
        r.search = (sk.guides || {}).items[0] === 'gd_king_in_black' && !!(sc.characters && sc.characters.total) && !!(scr.creators && scr.creators.total) && !!(sp.publishers && sp.publishers.total) &&
          !!(se.editions && se.editions.items[0] === 'ed_kib_fr_venom1') && !st29.collection && /* A7 (3.1b-3) : plus de catégorie « Ma collection » */ !!(st29.publications && st29.publications.items.includes(up.pub.id)) &&
          Object.keys(S('')).length === 0 && Object.keys(S('zzqx inexistant 29')).length === 0 && !!S('Le Roi en Noir').guides;
        r.recos = X.recos().some(x => x.guideId === 'gd_t29_saga' && x.why && x.text);
        // Interface : page Explorer
        window.__t29 = '6 interface';
        await X.open();
        const root = document.getElementById('explorerRoot');
        const vis = el => !!el && el.getClientRects().length > 0;
        r.uiHome = vis(document.getElementById('singlesExplorerView')) && ['exSecFeatured', 'exSecGuides', 'exSecUniverses', 'exSecReleases', 'exSecCharacters', 'exSecCreators', 'exSecSeries', 'exSecNews'].every(id => !!document.getElementById(id)) &&
          getComputedStyle(document.querySelector('.singles-stats-bar')).display === 'none' && document.getElementById('navExplorer').classList.contains('active') &&
          ['Marvel', 'DC Comics', 'Image Comics', 'Dark Horse', 'IDW Publishing', 'BOOM! Studios', 'Dynamite'].every(n => [...root.querySelectorAll('.ex-unitile b')].some(b => b.textContent === n)) &&
          /Aucune source d'actualités/.test(document.getElementById('exSecNews').textContent) && !!root.querySelector('[data-ex-guide="gd_king_in_black"]');
        const inp = document.getElementById('exSearch');
        inp.value = 'venom'; inp.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(res => setTimeout(res, 400));
        r.uiSearch = root.querySelectorAll('.ex-res-group').length >= 1 && document.getElementById('exHome').hidden === true;
        inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        r.history = JSON.parse(localStorage.getItem('panel_explorer_recent') || '[]')[0] === 'venom';
        root.querySelector('.ex-chip[data-ex-cat="guides"]').click();
        r.uiCategory = root.querySelectorAll('.ex-res-group').length === 1;
        inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(res => setTimeout(res, 400));
        root.querySelector('[data-ex-go="publisher"]').click();
        r.uiPublisher = !!root.querySelector('.ex-phead h2') && !!root.querySelector('.ex-back');
        await X.open('character', 't29 heros');
        r.uiCharacter = /non vérifiée/.test(root.textContent) && !!root.querySelector('[data-ex-guide="gd_t29_saga"]');
        await X.open('creator', 't29 autrice');
        r.uiCreator = !!root.querySelector('[data-ex-guide="gd_t29_saga"]');
        await X.open('series', 't29 saga');
        r.uiSeries = !!root.querySelector('[data-ex-pub]') && /possédé/.test(root.textContent);
        // Guide illustré
        window.__t29 = '7 guide';
        await X.open('guide', 'gd_king_in_black');
        const entries = () => root.querySelectorAll('.ex-entry');
        r.uiGuide = entries().length === 60 && !!root.querySelector('[data-ex-moreentries]') && root.querySelectorAll('.ex-otabs .da-tab').length === 2 && !!root.querySelector('[data-ex-next]') &&
          [...root.querySelectorAll('.ex-src a')].every(a => a.rel.includes('noopener') && a.target === '_blank') && root.querySelectorAll('.ex-entry img[loading="lazy"]').length === 60 &&
          /Non identifiée au catalogue/.test(root.textContent) && /Démonstration/.test(root.textContent);
        root.querySelector('[data-ex-moreentries]').click();
        r.uiMore = entries().length === 65;
        root.querySelectorAll('.ex-otabs .da-tab')[1].click();
        r.uiOrder = entries().length === 10 && [...entries()].every(li => /Essentiel/.test(li.textContent));
        root.querySelectorAll('.ex-otabs .da-tab')[0].click();
        const cb = name => root.querySelector('[data-ex-f="' + name + '"]');
        cb('hideOptional').click();
        r.uiHideOptional = entries().length === 10;
        cb('hideOptional').click();
        const sel = root.querySelector('select[data-ex-f="imp"]'); sel.value = 'optional'; sel.dispatchEvent(new Event('change', { bubbles: true }));
        r.uiImpFilter = entries().length === 55 || (entries().length === 60 && /55 entrée/.test(root.textContent));
        const sel2 = root.querySelector('select[data-ex-f="imp"]'); sel2.value = ''; sel2.dispatchEvent(new Event('change', { bubbles: true }));
        const lang = root.querySelector('select[data-ex-f="lang"]'); lang.value = 'vf'; lang.dispatchEvent(new Event('change', { bubbles: true }));
        r.uiLangVf = entries().length === 0 && !!root.querySelector('.ex-empty');
        const lang2 = root.querySelector('select[data-ex-f="lang"]'); lang2.value = 'vo'; lang2.dispatchEvent(new Event('change', { bubbles: true }));
        cb('simple').click();
        r.uiSimple = root.querySelectorAll('.ex-entry.is-simple').length === 60 && root.querySelectorAll('select[data-ex-st]').length === 60;
        cb('simple').click();
        // Guide de test : XSS, spoilers, statut en un clic, image de remplacement, édition vérifiée
        await X.open('guide', 'gd_t29_saga');
        r.xss = window.__x29 === undefined && !root.querySelector('img[src="x"]') && root.innerHTML.includes('&lt;img') && !root.querySelector('.ex-why b');
        r.spoiler = !!root.querySelector('[data-ex-spoilers]') && !/Révélation/.test(root.textContent);
        root.querySelector('[data-ex-spoilers]').click();
        r.spoilerShown = /Révélation <b>importante<\\/b>/.test(root.textContent);
        // uiStatus et uiStatusToggle : vrais clics (CDP) après cette phase, car S2 refuse les événements synthétiques (lot 3.1b-3)
        // Échec de chargement d'image : simulé (le réseau du navigateur de test n'est pas déterministe après les tests hors ligne)
        const im0 = root.querySelector('.ex-ghero-img');
        if (im0) im0.dispatchEvent(new Event('error'));
        await new Promise(res => setTimeout(res, 100));
        const im1 = root.querySelector('.ex-ghero-img');
        const fb = !!im1 && im1.src.startsWith('data:image/svg') && im1.classList.contains('is-fallback');
        r.imageFallback = fb;
        r.uiBadges = /Possédé/.test(root.textContent) && /Wishlist/.test(root.textContent) && /à confirmer/.test(root.textContent) && /Lu \\(collection\\)/.test(root.textContent) && !!root.querySelector('.ex-link[data-ex-pub]');
        // Éditeur
        window.__t29 = '8 éditeur';
        X.editor('gd_t29_saga');
        const modal = document.getElementById('guideEditModal');
        r.editor = modal.classList.contains('open') && modal.querySelectorAll('.gd-entries tbody tr').length === 5 && !!modal.querySelector('[data-gd="title"]');
        modal.querySelector('[data-gd-act="down"][data-i="0"]').click();
        const firstSeries = modal.querySelector('.gd-entries tbody tr td:nth-child(4) input').value;
        modal.querySelector('[data-gd-act="addEntry"]').click();
        const rows = modal.querySelectorAll('.gd-entries tbody tr');
        const last = rows[rows.length - 1];
        const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
        setv(last.querySelector('input[data-gd$=".series"]'), T); setv(last.querySelector('input[data-gd$=".issue"]'), '6'); setv(last.querySelector('input[data-gd$=".year"]'), '2024');
        setv(modal.querySelector('[data-gd="title"]'), 'T29 Saga modifiée');
        const saved = await (async () => { document.getElementById('guideEditSave').click(); for (let i = 0; i < 20; i++) { await new Promise(res => setTimeout(res, 100)); if (!modal.classList.contains('open')) return true; } return false; })();
        const ge = X.guide('gd_t29_saga');
        r.editorSave = saved && firstSeries === '2' && ge.title === 'T29 Saga modifiée' && ge.orders[0].entries.length === 6 && ge.orders[0].entries[0].issue === '2' && ge.orders[0].entries[5].issue === '6' && !!ge.editedAt;
        // Contenu fourni modifié : jamais écrasé par le contenu initial
        const kEdit = JSON.parse(JSON.stringify(kibBefore)); kEdit.description = 'Note locale T29';
        r.seedEdit = (await X.save(kEdit)).ok && !!X.guide('gd_king_in_black').editedAt;
        // Import / export
        window.__t29 = '9 import';
        const exp = X.exportGuides(['gd_king_in_black']);
        r.exportOk = exp.format === 'panel-guides' && exp.guides.length === 1 && exp.guides[0].orders[0].entries.length === 65 && exp.guides[0].orders[0].entries[0].id === ref.entries[0].id && exp.guides[0].sources.length === 7;
        const progBefore = JSON.stringify(X.progress(eid(3)));
        const file = JSON.stringify({ format: 'panel-guides', version: 1, guides: [
          { id: 'gd_t29_imp', title: 'T29 Importé', publisher: 'DC Comics', orders: [{ entries: [{ series: T, issue: '3', year: '2024' }] }] },
          { id: 'gd_t29_imp', title: 'T29 Importé bis', orders: [] },
          { id: 'gd_t29_bad', title: '' },
          X.exportGuides(['gd_t29_other']).guides[0],
          { id: 'gd_t29_twin', title: 'King in Black', publisher: 'Marvel', orders: [] }] });
        const plan = await X.importPlan(file);
        r.importPlan = plan.counts.add === 1 && plan.counts.duplicate === 2 && plan.counts.invalid === 1 && plan.counts.identical === 1 && !X.guide('gd_t29_imp');
        let badFmt = false; try { await X.importPlan('{"format":"autre","guides":[]}'); } catch (_) { badFmt = true; }
        let badJson = false; try { await X.importPlan('{oops'); } catch (_) { badJson = true; }
        r.importReject = badFmt && badJson;
        const ap = await X.importApply(plan);
        r.importApply = ap.added === 1 && ap.updated === 0 && X.guide('gd_t29_imp').origin === 'import' && JSON.stringify(X.progress(eid(3))) === progBefore && !X.guide('gd_t29_twin') && !X.guide('gd_t29_bad');
        await X.planInUi(file);
        r.importUi = modal.classList.contains('open') && modal.querySelectorAll('.da-table tbody tr').length === 5 && /Importer 0 guide/.test(document.getElementById('guideEditSave').textContent) && document.getElementById('guideEditSave').disabled;
        document.getElementById('closeGuideEditBtn').click();
        // Sauvegarde JSON
        window.__t29 = '10 sauvegarde';
        const bk = X.backup();
        r.backupBlock = bk.editorial.some(g => g.id === 'gd_t29_saga') && bk.progress.some(p => p.id === eid(3) && p.status === 'read');
        const vOld = P.validateBackupPayload({ format: 'panel-backup', version: 3, physicalSingles: [] });
        const vNew = P.validateBackupPayload({ format: 'panel-backup', version: 3, physicalSingles: [], explorer: { editorial: [{ id: 'gd_t29_rest', title: 'T29 Restauré', sources: [{ label: 'x', url: 'javascript:1' }] }, { id: 'bad' }], progress: [{ id: eid(4), status: 'read' }, { id: eid(4), status: 'pirate' }, { id: 'nope', status: 'read' }] } });
        r.backupValidate = vOld.explorer === null && vNew.explorer.editorial.length === 1 && vNew.explorer.editorial[0].sources[0].url === '' && vNew.explorer.progress.length === 1;
        const rs = await X.restore({ editorial: [{ id: 'gd_t29_rest', title: 'T29 Restauré' }, Object.assign({}, X.guide('gd_t29_other'), { title: 'Écrasé ?' })], progress: [{ id: eid(4), status: 'read' }, { id: eid(3), status: 'to_read' }] }, 'merge');
        r.restoreMerge = rs.added === 2 && X.guide('gd_t29_other').title === 'T29 Autre' && X.progress(eid(3)).status === 'read' && X.progress(eid(4)).status === 'read' && !!X.guide('gd_t29_rest');
        const fullHas = await new Promise(res => { const orig = URL.createObjectURL; let got = null; URL.createObjectURL = b => { got = b; return 'blob:t29'; }; const a0 = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
          URL.createObjectURL = orig; HTMLAnchorElement.prototype.click = a0;
          // Lot 3.1b-1 (D-25) : la sauvegarde complète est au format panel-bundle ; guides et calendrier sont dans la section explorer
          P.backup.export({ legacyDigital: true }).then(d => res(!!document.getElementById('backupJsonBtn') && !!d.sections.explorer && d.sections.explorer.editorial.some(g => g.id === 'gd_t29_saga') && Array.isArray(d.sections.explorer.publications))).catch(() => res(false)); });
        r.fullBackup = fullHas;
        // Seconde ouverture de la base : aucune migration destructive
        r.seedIdempotent = (await X.load()) === true && X.guides().filter(g => g.id === 'gd_king_in_black').length === 1 && X.guide('gd_king_in_black').description === 'Note locale T29';
        r._expect = { pub: up.pub.id };
        return r;
      })(), new Promise(res => setTimeout(() => res({ blockedAt: window.__t29 }), 90000))])`);
      console.log('Résultat Test 29 (a):', JSON.stringify(t29a));
      // Statut de lecture en un clic : vrai clic de l'utilisateur (Input.dispatchMouseEvent), exigé par S2 (jeton de geste)
      const t29pos = sel => evalExpr(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return null; b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect(); return { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) }; })()`);
      const t29click = async sel => { const p = await t29pos(sel); if (!p) return false; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await new Promise(r => setTimeout(r, 400)); return true; };
      const t29key = await evalExpr(`(async () => { const X = window.Panel.explorer; await X.open('guide', 'gd_t29_saga'); return X.entryKey('T29 Saga', '', 2); })()`);
      const t29sel = '[data-ex-set="' + t29key + '"][data-st="reading"]';
      const t29s = {};
      t29s.uiStatus = (await t29click(t29sel)) && await evalExpr(`window.Panel.explorer.progress(${JSON.stringify(t29key)}).status === 'reading' && !!document.querySelector(${JSON.stringify(t29sel + '.active')})`);
      t29s.uiStatusToggle = (await t29click(t29sel)) && await evalExpr(`window.Panel.explorer.progress(${JSON.stringify(t29key)}).status === ''`);
      Object.assign(t29a || {}, t29s);
      // Redémarrage hors ligne : guides, édition et progression relus depuis IndexedDB
      await send('Page.reload', { ignoreCache: false });
      for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 250)); if (await evalExpr('!!(window.Panel && window.Panel.explorer) && document.readyState === "complete"')) break; }
      const t29b = await evalExpr(`(async () => {
        const X = window.Panel.explorer;
        await X.load();
        const k = X.entryKey('T29 Saga', '', 3);
        return { restart: !!X.guide('gd_t29_saga') && X.guide('gd_t29_saga').title === 'T29 Saga modifiée' && X.progress(k).status === 'read' && X.guide('gd_king_in_black').description === 'Note locale T29' && !!X.guide('gd_t29_imp') };
      })()`);
      // Nettoyage : guides et progression de test retirés, King in Black et collection rétablis
      const t29c = await evalExpr(`(async () => {
        const P = window.Panel, X = P.explorer, R = P.releases;
        const saved = JSON.parse(localStorage.getItem('panel_test29_saved') || 'null');
        if (!saved) return { cleanup: false };
        const ids = ['gd_t29_saga', 'gd_t29_other', 'gd_t29_imp', 'gd_t29_rest'];
        const keys = [1, 2, 3, 4, 5, 6].map(n => X.entryKey('T29 Saga', '', n));
        const pubs = R.all().filter(p => p.series === 'T29 Saga').map(p => p.id);
        await new Promise(res => {
          const q = indexedDB.open('panel-catalog');
          q.onsuccess = () => { const db = q.result; const tx = db.transaction(['editorial', 'readprog', 'publications'], 'readwrite');
            ids.forEach(id => tx.objectStore('editorial').delete(id)); keys.forEach(id => tx.objectStore('readprog').delete(id)); pubs.forEach(id => tx.objectStore('publications').delete(id));
            if (saved.kib) tx.objectStore('editorial').put(saved.kib);
            tx.oncomplete = () => { db.close(); res(true); }; tx.onerror = () => { db.close(); res(false); }; };
          q.onerror = () => res(false);
        });
        await X.load(); await R.reloadFromDb();
        P.setPhysicalSingles(saved.singles);
        if (saved.hist === null) localStorage.removeItem('panel_explorer_recent'); else localStorage.setItem('panel_explorer_recent', saved.hist);
        localStorage.removeItem('panel_test29_saved');
        return { cleanup: !X.guides().some(g => /^gd_t29/.test(g.id)) && !X.progress(keys[2]) && JSON.stringify(X.guide('gd_king_in_black')) === JSON.stringify(saved.kib) && !R.all().some(p => p.series === 'T29 Saga') && P.getPhysicalSingles().length === saved.singles.length };
      })()`);
      const t29 = Object.assign({}, t29a, t29b, t29c);
      delete t29._expect;
      console.log('Résultat Test 29:', JSON.stringify(t29));
      const t29keys = ['dbV4', 'kibSeed', 'kibHonest', 'validation', 'noAutoImportance', 'saved', 'matchExact', 'matchProbable', 'ownedVsWish', 'readDerived', 'progress', 'stats', 'sharedProgress',
        'search', 'recos', 'uiHome', 'uiSearch', 'history', 'uiCategory', 'uiPublisher', 'uiCharacter', 'uiCreator', 'uiSeries', 'uiGuide', 'uiMore', 'uiOrder', 'uiHideOptional', 'uiImpFilter',
        'uiLangVf', 'uiSimple', 'xss', 'spoiler', 'spoilerShown', 'uiStatus', 'uiStatusToggle', 'imageFallback', 'uiBadges', 'editor', 'editorSave', 'seedEdit', 'exportOk', 'importPlan', 'importReject',
        'importApply', 'importUi', 'backupBlock', 'backupValidate', 'restoreMerge', 'fullBackup', 'seedIdempotent', 'restart', 'cleanup'];
      const t29fail = t29keys.filter(k => t29[k] !== true);
      if (t29fail.length) console.log('Test 29 — vérifications en échec :', t29fail.join(', '));
      testResults.push({
        test: 'Explorer & guides de lecture : base v4 additive, King in Black sourcé, validation, rapprochements exacts, progression personnelle, recherche, pages, filtres, XSS, éditeur, import/export, sauvegarde, redémarrage',
        ok: !!t29a && t29fail.length === 0
      });
      // ------------------------------------------------------------------
      // TEST 30 : Finances de la collection (lot F0)
      // ------------------------------------------------------------------
      console.log('\n[TEST 30] Finances : aucune substitution, cas particuliers, préremplissage du prix d\'achat, historique conservé...');
      const t30 = await evalExpr(`(async () => {
        const P = window.Panel, r = {};
        const savedSingles = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        const savedSnaps = localStorage.getItem('panel_value_snapshots');
        const savedRaw = localStorage.getItem('panel_physical_singles');
        const tick = () => new Promise(res => setTimeout(res, 60));
        const txt = id => document.getElementById(id).textContent;
        try {
          const base = { publisher: 'DC Comics', variant: 'Cover A', keyType: 'none', condition: 'NM 9.4 (Near Mint)', coverUrl: '', addedAt: '2026-01-01T00:00:00Z', isWishlist: false };
          const S = o => Object.assign({}, base, o);
          // T-F1 : coût 28 (25 + 3 de frais, saisi comme prix payé en F0), valeur 40
          r.f1 = P.gainOf(S({ purchasePrice: 28, estValue: 40 })) === 12 && P.gainPct(12, 28) === 42.86 && P.pctText(42.86) === '+42,86 %';
          // T-F2 : prix payé inconnu, couverture 4,99 : jamais compté comme investi
          const f2 = P.financeSummary([S({ coverPrice: 4.99, purchasePrice: null, estValue: 12, valueSource: 'manual' })]);
          r.f2 = f2.invested === 0 && f2.costKnown === 0 && f2.costUnknown === 1 && f2.gain === null && f2.value === 12 && P.paidOf({ coverPrice: 4.99 }) === null;
          // T-F3 : prix payé 30, aucune valeur : pas de perte fictive
          const f3 = P.financeSummary([S({ purchasePrice: 30, estValue: null, coverPrice: 3.99 })]);
          r.f3 = f3.value === 0 && f3.valueKnown === 0 && f3.valueUnknown === 1 && f3.gain === null && f3.invested === 30 && P.valueOf({ coverPrice: 3.99 }) === null;
          // T-F4 : gratuit
          const f4 = P.financeSummary([S({ purchasePrice: 0, estValue: 10, valueSource: 'manual' })]);
          r.f4 = f4.invested === 0 && f4.costKnown === 1 && f4.gain === 10 && f4.gainPct === null && P.pctText(f4.gainPct) === '—';
          // Moins-value
          r.loss = P.gainOf(S({ purchasePrice: 20, estValue: 15 })) === -5 && P.gainPct(-5, 20) === -25 && P.pctText(-25) === '-25 %';
          // T-F8 : inconnu affiché « — »
          r.f8 = P.money(null) === '—' && P.money(undefined) === '—' && P.money('') === '—' && P.money(NaN) === '—' && P.money(0) === '$0.00' && P.money(3.5) === '$3.50';
          // T-F10 : ventilation par source, fourchette, wishlist exclue
          const fm = P.financeSummary([
            S({ estValue: 100, valueSource: 'market', purchasePrice: 50 }), S({ estValue: 20.1, valueSource: 'manual' }),
            S({ estValue: 7.2, valueSource: 'auto', valuation: { low: 5.4, high: 9.7 } }), S({ estValue: null }), S({ isWishlist: true, estValue: 500, purchasePrice: 1 })
          ]);
          r.f10 = fm.ownedCount === 4 && fm.value === 127.3 && Math.round((fm.bySource.market + fm.bySource.manual + fm.bySource.auto) * 100) === 12730 &&
            fm.autoLow === 5.4 && fm.autoHigh === 9.7 && fm.valueUnknown === 1 && fm.gainBase === 1 && fm.gain === 50 && fm.gainPct === 100 && fm.costUnknown === 3 && fm.coverageCost === 25;
          r.cents = P.financeSummary([S({ estValue: 0.1 }), S({ estValue: 0.2 })]).value === 0.3;
          r.empty = (e => e.ownedCount === 0 && e.gain === null && e.gainPct === null && e.coverageCost === null)(P.financeSummary([]));
          // Interface : statistiques
          P.setPhysicalSingles([
            S({ id: 'f30a', series: 'F30 Book', issue: '#1', coverPrice: 4.99, purchasePrice: null, estValue: 12, valueSource: 'manual' }),
            S({ id: 'f30b', series: 'F30 Book', issue: '#2', coverPrice: null, purchasePrice: 30, estValue: null }),
            S({ id: 'f30c', series: 'F30 Book', issue: '#3', coverPrice: 3.99, purchasePrice: 28, estValue: 40, valueSource: 'manual' })
          ]);
          P.showSinglesView('collection');
          r.uiStats = txt('statSinglesValue') === '$52.00' && txt('statSinglesInvested') === '$58.00' && txt('statSinglesGain') === '+$12.00' &&
            txt('statSinglesGainPct').includes('+42,86 %') && txt('statSinglesGainPct').includes('sur 1 ex. sur 3') && txt('statSinglesInvestedSub').includes('1 inconnu') && txt('statSinglesGradedSub').includes('1 sans valeur');
          r.uiList = !document.getElementById('singlesGrid').innerHTML.includes('NaN') && txt('boxCountSummary').includes('1 sans valeur');
          // Inspecteur
          P.openSingleInspector(P.getPhysicalSingles().find(s => s.id === 'f30a'));
          r.uiInspector = txt('inspectCoverPrice') === 'Non renseigné' && txt('inspectProfitBadge').includes('prix payé inconnu');
          P.openSingleInspector(P.getPhysicalSingles().find(s => s.id === 'f30b'));
          r.uiInspector2 = txt('inspectEstValue') === '—' && txt('inspectProfitBadge').includes('valeur inconnue');
          P.openSingleInspector(P.getPhysicalSingles().find(s => s.id === 'f30c'));
          r.uiInspector3 = txt('inspectProfitBadge').includes('+$12.00') && txt('inspectProfitBadge').includes('+42,86 %');
          document.getElementById('singleIssueInspectorModal').classList.remove('open');
          // Données existantes intactes : le calcul n'écrit rien
          const fp = JSON.stringify(P.getPhysicalSingles());
          P.financeSummary(P.getPhysicalSingles()); P.renderStatsDashboard();
          r.noMutation = JSON.stringify(P.getPhysicalSingles()) === fp && P.getPhysicalSingles().find(s => s.id === 'f30a').purchasePrice === null && P.getPhysicalSingles().find(s => s.id === 'f30b').estValue === null;
          // Instantanés : un relevé de l'ancienne méthode n'est jamais réécrit ; les nouveaux portent m: 2
          const today = new Date().toISOString().slice(0, 10);
          localStorage.setItem('panel_value_snapshots', JSON.stringify({ '2026-01-01': { v: 10, i: 5, n: 1 }, [today]: { v: 999, i: 1, n: 7 } }));
          const raw1 = localStorage.getItem('panel_value_snapshots');
          P.setPhysicalSingles(P.getPhysicalSingles());
          r.snapOldKept = localStorage.getItem('panel_value_snapshots') === raw1;
          localStorage.setItem('panel_value_snapshots', JSON.stringify({ '2026-01-01': { v: 10, i: 5, n: 1 } }));
          P.setPhysicalSingles(P.getPhysicalSingles());
          const sn = JSON.parse(localStorage.getItem('panel_value_snapshots'));
          r.snapNew = JSON.stringify(sn['2026-01-01']) === JSON.stringify({ v: 10, i: 5, n: 1 }) && !!sn[today] && sn[today].m === 2 && sn[today].v === 52 && sn[today].i === 58 && sn[today].nv === 2 && sn[today].ni === 2 && sn[today].n === 3;
          // Tableau de bord
          P.showSinglesView('stats'); P.renderStatsDashboard();
          const dash = document.getElementById('statsDashboard') ? txt('statsDashboard') : document.body.textContent;
          r.dashboard = dash.includes('Données financières') && dash.includes('Sans valeur') && dash.includes('ancienne méthode') && dash.includes('Plus-value calculée sur 1 ex. sur 3') && dash.includes('État non renseigné') && !dash.includes('NaN');
          P.showSinglesView('collection');
          // État inconnu : plus de NM 9.4 inventé ; hypothèse affichée dans la cote
          r.condImport = P.sanitizeImportedSingle({ series: 'X' }).condition === '' && P.sanitizeImportedSingle({ series: 'X', condition: 'VF 8.0 (Very Fine)' }).condition === 'VF 8.0 (Very Fine)';
          const eu = P.estimateComicValue({ series: 'F30 Book', issue: '#1', condition: '', coverPrice: 3.99, coverYear: 2024 });
          const ek = P.estimateComicValue({ series: 'F30 Book', issue: '#1', condition: 'NM 9.4 (Near Mint)', coverPrice: 3.99, coverYear: 2024 });
          r.condAuto = eu.confidence === 'faible' && eu.factors.some(f => /non renseigné/.test(f.label)) && eu.value === ek.value;
          // D-18 : préremplissage du prix d'achat à l'ajout, visible et modifiable ; couverture inchangée
          document.getElementById('addSingleModalOpenBtn').click();
          const cp = document.getElementById('singleCoverPriceInput'), pp = document.getElementById('singlePurchasePriceInput'), hint = document.getElementById('purchasePrefillHint');
          const fire = el => el.dispatchEvent(new Event('input', { bubbles: true }));
          r.formBlank = pp.value === '' && hint.hidden && document.getElementById('singleConditionSelect').value === '';
          cp.value = '4.99'; fire(cp);
          r.prefill = pp.value === '4.99' && !hint.hidden && cp.value === '4.99';
          cp.value = '5.99'; fire(cp);
          r.prefillFollows = pp.value === '5.99';
          cp.value = ''; fire(cp);
          r.prefillCleared = pp.value === '' && hint.hidden;
          cp.value = '4.99'; fire(cp);
          pp.value = '3'; fire(pp);
          cp.value = '6.99'; fire(cp);
          r.userWins = pp.value === '3' && hint.hidden && cp.value === '6.99';
          document.getElementById('singleSeriesInput').value = 'F30 Prefill';
          document.getElementById('singleIssueInput').value = '#7';
          document.getElementById('singleWishlistCheckbox').checked = false;
          document.getElementById('saveSingleToCollectionBtn').click();
          await tick();
          const saved = P.getPhysicalSingles().find(s => s.series === 'F30 Prefill');
          r.savedPaid = !!saved && saved.purchasePrice === 3 && saved.coverPrice === 6.99 && saved.condition === '';
          // Prérempli et accepté tel quel : le montant validé par l'utilisateur est enregistré comme prix payé
          document.getElementById('addSingleModalOpenBtn').click();
          cp.value = '4.99'; fire(cp);
          document.getElementById('singleSeriesInput').value = 'F30 Prefill';
          document.getElementById('singleIssueInput').value = '#8';
          document.getElementById('saveSingleToCollectionBtn').click();
          await tick();
          const accepted = P.getPhysicalSingles().find(s => s.series === 'F30 Prefill' && s.issue === '#8');
          r.savedAccepted = !!accepted && accepted.purchasePrice === 4.99 && accepted.coverPrice === 4.99;
          // Fiche de wishlist : le préremplissage non confirmé n'est pas enregistré
          document.getElementById('addSingleModalOpenBtn').click();
          cp.value = '4.99'; fire(cp);
          document.getElementById('singleSeriesInput').value = 'F30 Wish';
          document.getElementById('singleIssueInput').value = '#1';
          document.getElementById('singleWishlistCheckbox').checked = true;
          document.getElementById('saveSingleToCollectionBtn').click();
          await tick();
          const w = P.getPhysicalSingles().find(s => s.series === 'F30 Wish');
          r.wishNoPaid = !!w && w.isWishlist && w.purchasePrice === null && w.coverPrice === 4.99;
          // Modification d'une fiche au prix inconnu : aucun préremplissage
          await P.editSingleIssue(P.getPhysicalSingles().find(s => s.id === 'f30a'));
          cp.value = '7.99'; fire(cp);
          r.editNoPrefill = pp.value === '' && hint.hidden && P.getPhysicalSingles().find(s => s.id === 'f30a').purchasePrice === null;
          // Bouton explicite « = prix de couverture » (aussi en modification) : rien n'est enregistré sans validation
          const btn = document.getElementById('purchaseFromCoverBtn');
          r.editBtn = !btn.hidden && pp.value === '';
          btn.click();
          r.editBtnFill = pp.value === '7.99' && !hint.hidden && btn.hidden && P.getPhysicalSingles().find(s => s.id === 'f30a').purchasePrice === null;
                    document.getElementById('singleIssueDetailModal').classList.remove('open');
          document.getElementById('singleWishlistCheckbox').checked = false;
          // Ajouts rapides (wishlist → collection → wishlist) : aucune valeur financière inventée, couverture conservée
          P.setPhysicalSingles([S({ id: 'f30w', series: 'F30 Quick', issue: '#1', isWishlist: true, coverPrice: 4.99, purchasePrice: null, estValue: null })]);
          await P.releases.ready();
          const qw = P.getPhysicalSingles().find(s => s.id === 'f30w');
          P.releases.wish.toCollection(qw);
          r.quickWish = !qw.isWishlist && qw.purchasePrice === null && qw.coverPrice === 4.99;
          const back = P.releases.wish.fromCollection(qw, {});
          r.quickToWish = !!back.ok && !!back.item && back.item.purchasePrice === null && back.item.coverPrice === 4.99 && back.item.condition === '';
        } finally {
          P.setPhysicalSingles(savedSingles);
          if (savedSnaps === null) localStorage.removeItem('panel_value_snapshots'); else localStorage.setItem('panel_value_snapshots', savedSnaps);
        }
        r.restored = localStorage.getItem('panel_value_snapshots') === savedSnaps && JSON.stringify(P.getPhysicalSingles()) === JSON.stringify(savedSingles) && (savedRaw === null || !!localStorage.getItem('panel_physical_singles'));
        return r;
      })()`);
      console.log('Résultat Test 30:', JSON.stringify(t30));
      const t30keys = ['f1', 'f2', 'f3', 'f4', 'loss', 'f8', 'f10', 'cents', 'empty', 'uiStats', 'uiList', 'uiInspector', 'uiInspector2', 'uiInspector3', 'noMutation', 'snapOldKept', 'snapNew',
        'dashboard', 'condImport', 'condAuto', 'formBlank', 'prefill', 'prefillFollows', 'prefillCleared', 'userWins', 'savedPaid', 'savedAccepted', 'wishNoPaid', 'editNoPrefill', 'editBtn', 'editBtnFill', 'quickWish', 'quickToWish', 'restored'];
      const t30fail = t30keys.filter(k => !t30 || t30[k] !== true);
      if (t30fail.length) console.log('Test 30 — vérifications en échec :', t30fail.join(', '));
      testResults.push({
        test: 'Finances (lot F0) : aucune substitution par le prix de couverture ou zéro, inconnu affiché « — », ventilation par source, couverture, gratuit, moins-value, préremplissage du prix d\'achat (D-18), historique ancien conservé',
        ok: !!t30 && t30fail.length === 0
      });

      // ─── Test 31 : lot 3.1 — rapport de préparation de la synchronisation (lecture seule) ───
      const t31 = await evalExpr(`(async () => {
        const P = window.Panel, r = {};
        if (!P || !P.sync) return { api: false };
        r.api = typeof P.sync.readiness === 'function' && Array.isArray(P.sync.domains);
        r.disabled = P.sync.isEnabled() === false;
        // Empreinte avant : toutes les clés localStorage et le nombre de fiches de chaque store IndexedDB existant
        const lsPrint = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]])); };
        const idbCounts = async () => {
          const out = {};
          const dbs = indexedDB.databases ? await indexedDB.databases() : [];
          for (const d of dbs) {
            const db = await new Promise(res => { const q = indexedDB.open(d.name); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
            if (!db) continue;
            const key = d.name + '@' + db.version;
            out[key] = {};
            for (const s of Array.from(db.objectStoreNames)) {
              out[key][s] = await new Promise(res => { const c = db.transaction(s, 'readonly').objectStore(s).count(); c.onsuccess = () => res(c.result); c.onerror = () => res(-1); });
            }
            db.close();
          }
          return JSON.stringify(out);
        };
        const ls0 = lsPrint(), idb0 = await idbCounts();
        let rep;
        try { rep = await P.sync.readiness(); } catch (e) { return Object.assign(r, { error: String(e) }); }
        const ls1 = lsPrint(), idb1 = await idbCounts();
        r.lsUnchanged = ls0 === ls1;
        r.idbUnchanged = idb0 === idb1;
        r.shape = !!rep && rep.version === 1 && rep.enabled === false && typeof rep.byDomain === 'object' && typeof rep.counts === 'object'
          && typeof rep.ids === 'object' && typeof rep.oversizedDataCovers === 'object' && Array.isArray(rep.excludedKeys) && typeof rep.estimatedKb === 'number';
        r.domains = ['collection', 'reading', 'explorer', 'app'].every(d => Array.isArray(rep.byDomain[d]));
        r.domainField = P.sync.domains.every(d => ['collection', 'reading', 'explorer', 'app'].includes(d.domain));
        r.copiesCount = rep.counts.copies === P.getPhysicalSingles().length;
        r.secretsExcluded = P.sync.domains.filter(d => d.name === 'secrets' || d.name === 'digital_legacy').every(d => d.synced === false && d.table === null)
          && rep.excludedKeys.some(k => k.key === 'panel_comicvine_key') && rep.excludedKeys.some(k => k.key === 'panel_metron_creds');
        const cvk = localStorage.getItem('panel_comicvine_key');
        r.noSecretValues = !cvk || !JSON.stringify(rep).includes(cvk);
        r.explorerNotSynced = rep.byDomain.explorer.every(d => d.synced === false);
        r.pullsInCollection = P.sync.domains.find(d => d.name === 'pulls').domain === 'collection';
        r.readingDomain = P.sync.domains.find(d => d.name === 'reading_progress').domain === 'reading';
        r.idsReport = typeof rep.ids.problems === 'number' && rep.ids.total === P.getPhysicalSingles().length;
        return r;
      })()`);
      console.log('Résultat Test 31:', JSON.stringify(t31));
      const t31keys = ['api', 'disabled', 'lsUnchanged', 'idbUnchanged', 'shape', 'domains', 'domainField', 'copiesCount', 'secretsExcluded', 'noSecretValues', 'explorerNotSynced', 'pullsInCollection', 'readingDomain', 'idsReport'];
      const t31fail = t31keys.filter(k => !t31 || t31[k] !== true);
      if (t31fail.length) console.log('Test 31 — vérifications en échec :', t31fail.join(', '));
      testResults.push({
        test: 'Synchronisation (lot 3.1) : Panel.sync.readiness() en lecture seule (localStorage et IndexedDB inchangés), groupé par domaine, secrets exclus, synchronisation désactivée',
        ok: !!t31 && t31fail.length === 0
      });
      // ─── Test 32 : lot 3.1b-1 — sauvegardes par domaine (B1, panel-bundle v1) : tests R1 à R9 de docs/phase4/06 § 9 ───
      // Non destructif : chaque restauration est annulée et l'empreinte finale de chaque domaine est comparée à l'initiale.
      const t32 = await Promise.race([evalExpr(`(async () => {
        const P = window.Panel, B = P && P.backup, r = {};
        if (!B) return { api: false };
        if (P.pauseCoverJob) P.pauseCoverJob();
        r.api = ['export', 'validate', 'restore', 'undo', 'fingerprints', 'toV3', 'fromLegacy'].every(k => typeof B[k] === 'function');
        r.providers = JSON.stringify(B.providers().map(p => p.id + ':' + p.domain)) === JSON.stringify(['collection:collection', 'reading:reading', 'explorer:explorer', 'community:community', 'app:app']);
        const digitalKeys = ['panel_folders', 'panel_bookmarks', 'panel_theories', 'panel_reading_positions', 'panel_comic_notes', 'panel_comic_annotations'];
        const digital = () => JSON.stringify(digitalKeys.map(k => localStorage.getItem(k)));
        const digital0 = digital();
        const fp0 = await B.fingerprints();
        const clone = o => JSON.parse(JSON.stringify(o));
        // R2 : export complet, intégrité vérifiée, remplacement par sa propre sauvegarde ⇒ empreintes identiques
        const full = await B.export({ legacyDigital: true });
        r.format = full.format === 'panel-bundle' && full.version === 1 && ['collection', 'reading', 'explorer', 'app', 'legacyDigital'].every(k => full.sections[k] !== undefined && full.manifest[k]);
        const v = await B.validate(clone(full));
        r.integrity = ['collection', 'reading', 'explorer', 'app'].every(k => v.sections[k].integrity === 'vérifiée' && v.sections[k].countsOk === true);
        r.countsMatch = full.manifest.collection.count.singles === P.getPhysicalSingles().length;
        const rr = await B.restore(v, { mode: 'replace' });
        // La restauration normalise les fiches (valeurs par défaut équivalentes : null, '', false) : R2 vérifie que chaque valeur renseignée est conservée
        const fpR2 = await B.fingerprints();
        const reX = (await B.export({ legacyDigital: true })).sections;
        const byId = new Map(reX.collection.singles.map(s => [s.id, s]));
        const empty = x => x === null || x === undefined || x === '' || x === false;
        const kept = full.sections.collection.singles.every(s => { const y = byId.get(s.id); return !!y && Object.keys(s).every(k => empty(s[k]) || JSON.stringify(s[k]) === JSON.stringify(y[k])); });
        const ids = k => JSON.stringify((full.sections.collection[k] || { nodes: [] }).nodes ? full.sections.collection[k].nodes.map(n => n.id).sort() : full.sections.collection[k].map(n => n.id).sort());
        const ids2 = k => JSON.stringify((reX.collection[k] || { nodes: [] }).nodes ? reX.collection[k].nodes.map(n => n.id).sort() : reX.collection[k].map(n => n.id).sort());
        r.r2 = rr.ok === true && byId.size === full.sections.collection.singles.length && kept && ids('locations') === ids2('locations') && ids('pulls') === ids2('pulls')
          && fpR2.reading === fp0.reading && fpR2.app === fp0.app && reX.explorer.editorial.length === full.sections.explorer.editorial.length && reX.explorer.publications.length === full.sections.explorer.publications.length;
        const rr2 = await B.restore(await B.validate(await B.export()), { mode: 'replace' });
        r.r2idempotent = rr2.ok && JSON.stringify(await B.fingerprints()) === JSON.stringify(fpR2);
        if (rr2.ok) await B.undo(rr2.undoToken);
        if (!r.r2) {
          r.r2diff = Object.keys(fp0).filter(k => fp0[k] !== fpR2[k]);
          const after = (await B.export({ domains: ['collection'] })).sections.collection;
          const b0 = full.sections.collection;
          const i = b0.singles.findIndex((s, j) => JSON.stringify(s) !== JSON.stringify(after.singles[j]));
          if (i >= 0) { const a = b0.singles[i], b = after.singles[i] || {}; r.r2single = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).slice(0, 12); }
          r.r2other = ['seriesMeta', 'locations', 'pulls'].filter(k => JSON.stringify(b0[k]) !== JSON.stringify(after[k]));
        }
        if (rr.ok) await B.undo(rr.undoToken);
        // Diagnostic : écart restant après l'annulation de R2
        { const fpU = await B.fingerprints(); r.afterUndoDiff = Object.keys(fp0).filter(k => fp0[k] !== fpU[k]);
          if (r.afterUndoDiff.length) { const after = (await B.export({ domains: ['collection'] })).sections.collection, b0 = full.sections.collection;
            r.afterUndoParts = ['singles', 'seriesMeta', 'locations', 'pulls'].filter(k => JSON.stringify(b0[k]) !== JSON.stringify(after[k]));
            const i = b0.singles.findIndex((s, j) => JSON.stringify(s) !== JSON.stringify(after.singles[j]));
            if (i >= 0) { const x = b0.singles[i], y = after.singles[i] || {}; r.afterUndoKeys = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(k => JSON.stringify(x[k]) !== JSON.stringify(y[k])).map(k => k + '=' + JSON.stringify(x[k]) + '→' + JSON.stringify(y[k])).slice(0, 6); }
            r.afterUndoLen = [b0.singles.length, after.singles.length, (b0.locations.nodes || []).length, (after.locations.nodes || []).length]; } }
        // R3 + R6 : section Collection seule (une fiche en plus) ; les autres domaines inchangés ; annulation
        const bc = clone(full); delete bc.manifest.collection;
        bc.sections.collection.singles.push({ id: 's_t32_fake', series: 'T32 Série fictive', issue: '#1', publisher: 'Test' });
        const rc = await B.restore(await B.validate(bc), { domains: ['collection'] });
        const fpC = await B.fingerprints();
        r.r3collection = rc.ok && rc.added === 1 && rc.untouchedOk === true && P.getPhysicalSingles().some(s => s.id === 's_t32_fake') && fpC.reading === fp0.reading && fpC.explorer === fp0.explorer && fpC.app === fp0.app && fpC.collection !== fp0.collection;
        r.r6undo = rc.ok && (await B.undo(rc.undoToken)) === true && (await B.fingerprint('collection')) === fp0.collection && !P.getPhysicalSingles().some(s => s.id === 's_t32_fake');
        // R3 : Explorer seul (guide en plus) puis Lecture seule (progression en plus)
        const be = clone(full); delete be.manifest.explorer;
        be.sections.explorer.editorial.push({ id: 'gd_t32_guide', title: 'T32 Guide fictif' });
        const re = await B.restore(await B.validate(be), { domains: ['explorer'] });
        r.r3explorer = re.ok && re.untouchedOk === true && (await B.fingerprint('collection')) === fp0.collection && (await B.fingerprint('explorer')) !== fp0.explorer;
        if (re.ok) await B.undo(re.undoToken);
        const bl = clone(full); delete bl.manifest.reading;
        bl.sections.reading.progress.push({ id: 'ek_t32progress', status: 'read', at: '2026-11-08T00:00:00Z', history: [] });
        const rl = await B.restore(await B.validate(bl), { domains: ['reading'] });
        r.r3reading = rl.ok && rl.untouchedOk === true && (await B.fingerprint('collection')) === fp0.collection && (await B.fingerprint('explorer')) === fp0.explorer;
        if (rl.ok) await B.undo(rl.undoToken);
        // Fiches ajoutées puis annulées : absentes d'IndexedDB
        const idbHas = async (store, id) => { const db = await new Promise(res => { const q = indexedDB.open('panel-catalog'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); if (!db) return null; try { return await new Promise(res => { const g = db.transaction(store, 'readonly').objectStore(store).get(id); g.onsuccess = () => res(!!g.result); g.onerror = () => res(null); }); } finally { db.close(); } };
        r.undoIdb = (await idbHas('editorial', 'gd_t32_guide')) === false && (await idbHas('readprog', 'ek_t32progress')) === false;
        // R4 : fichier altéré (empreinte fausse) : refus sans confirmation, rien n'est modifié
        const ba = clone(full);
        if (ba.sections.collection.singles.length) ba.sections.collection.singles[0].notes = 'altéré T32'; else ba.sections.collection.seriesMeta = { t32: { name: 'altéré' } };
        const va = await B.validate(ba);
        const ra = await B.restore(va, { domains: ['collection'] });
        r.r4altered = va.sections.collection.integrity === 'altérée' && ra.ok === false && ra.needsAlteredConfirmation === true && (await B.fingerprint('collection')) === fp0.collection;
        // R5 : référence non résolue (pull vers une publication absente) : conservée, jamais supprimée
        const bp = clone(full); delete bp.manifest.collection;
        bp.sections.collection.pulls.push({ id: 'pl_t32_orphan', pubId: 'pbc_t32_absente', status: 'planned', quantity: 1, ref: { series: 'T32', issue: '#9' } });
        const rp = await B.restore(await B.validate(bp), { domains: ['collection'] });
        const exp5 = await B.export({ domains: ['collection'] });
        r.r5orphan = rp.ok && exp5.sections.collection.pulls.some(p => p.id === 'pl_t32_orphan' && p.pubId === 'pbc_t32_absente');
        if (rp.ok) await B.undo(rp.undoToken);
        // R7 : conversion inverse bundle → panel-backup v3, relisible par la restauration actuelle
        const v3 = B.toV3(clone(full));
        const pv3 = P.validateBackupPayload(clone(v3));
        r.r7 = v3.format === 'panel-backup' && v3.version === 3 && pv3.items.length === v.sections.collection.norm.items.length && pv3.explorer.editorial.length === v.sections.explorer.norm.editorial.length && pv3.releases.pulls.length === v.sections.collection.norm.pulls.length;
        // R1 : ancien fichier v3 découpé en mémoire par domaine : mêmes comptes que la restauration actuelle
        const vl = await B.validate(B.fromLegacy(clone(v3)));
        r.r1legacy = vl.sections.collection.norm.items.length === pv3.items.length && vl.sections.explorer.norm.publications.length === pv3.releases.publications.length && vl.sections.reading.norm.progress.length === pv3.explorer.progress.length;
        // R8 : garde-fou — remplacement qui retirerait plus de 10 % de la collection : confirmation renforcée exigée
        const b20 = clone(full); delete b20.manifest.collection;
        for (let i = 0; i < 20; i++) b20.sections.collection.singles.push({ id: 's_t32_g' + i, series: 'T32 Garde-fou', issue: '#' + (i + 1), publisher: 'Test' });
        const r20 = await B.restore(await B.validate(b20), { domains: ['collection'] });
        const bEmpty = clone(full); delete bEmpty.manifest.collection; bEmpty.sections.collection.singles = [];
        const fpG = await B.fingerprint('collection');
        const rg = await B.restore(await B.validate(bEmpty), { domains: ['collection'], mode: 'replace' });
        r.r8guard = r20.ok && rg.ok === false && rg.needsConfirmation === true && rg.removed >= 20 && (await B.fingerprint('collection')) === fpG;
        if (r20.ok) await B.undo(r20.undoToken);
        // R9 : Explorer absent : export et restauration de Collection seuls
        const bNoEx = await B.export({ without: ['explorer'] });
        const vNoEx = await B.validate(clone(bNoEx));
        const rNoEx = await B.restore(vNoEx, { domains: ['collection'] });
        r.r9 = bNoEx.sections.explorer === undefined && !!vNoEx.sections.collection && rNoEx.ok === true && rNoEx.added === 0 && (await B.fingerprint('collection')) === fp0.collection;
        if (rNoEx.ok) await B.undo(rNoEx.undoToken);
        r.onlyDomain = JSON.stringify(Object.keys((await B.export({ domains: ['reading'] })).sections)) === JSON.stringify(['reading']);
        // Secrets (D-24) : exclus par défaut ; option chiffrée ; mauvais mot de passe refusé ; clé présente jamais écrasée
        const SK = 'panel_gcd_proxy', prevSK = localStorage.getItem(SK), fakeSK = 'https://relais-t32.exemple.test/gcd';
        localStorage.setItem(SK, fakeSK);
        r.secretsExcludedByDefault = !JSON.stringify(full).includes(fakeSK) && !JSON.stringify(await B.export()).includes(fakeSK);
        const bs = await B.export({ domains: ['app'], secretsPassword: 'motdepasse-t32' });
        r.secretsEncrypted = !!bs.sections.secrets && bs.manifest.secrets.encrypted === true && !JSON.stringify(bs).includes(fakeSK);
        localStorage.removeItem(SK);
        const vs = await B.validate(clone(bs));
        const rBad = await B.restore(vs, { domains: ['app'], secretsPassword: 'mauvais-mot' });
        r.secretsWrongPassword = rBad.ok === false && localStorage.getItem(SK) === null;
        const rGood = await B.restore(vs, { domains: ['app'], secretsPassword: 'motdepasse-t32' });
        r.secretsRestored = rGood.ok && rGood.secrets.restored >= 1 && localStorage.getItem(SK) === fakeSK;
        localStorage.setItem(SK, 'https://autre-t32.exemple.test');
        const rKeep = await B.restore(vs, { domains: ['app'], secretsPassword: 'motdepasse-t32' });
        r.secretsNotOverwritten = rKeep.ok && rKeep.secrets.kept >= 1 && localStorage.getItem(SK) === 'https://autre-t32.exemple.test';
        if (prevSK === null) localStorage.removeItem(SK); else localStorage.setItem(SK, prevSK);
        // Fenêtres
        B.openExportDialog();
        const dlgE = document.getElementById('bundleExportDialog');
        r.uiExport = !!dlgE && dlgE.classList.contains('open') && dlgE.querySelectorAll('input[name=bunDom]').length === 5 && !!dlgE.querySelector('input[name=bunFmt][value=v3]') && !!document.getElementById('backupOptionsBtn');
        dlgE.classList.remove('open');
        B.openRestoreDialog(v, 'test-t32.json');
        const dlgR = document.getElementById('bundleRestoreDialog');
        r.uiRestore = !!dlgR && dlgR.classList.contains('open') && dlgR.querySelectorAll('input[name=bunRDom]').length === 4 && !!dlgR.querySelector('input[name=bunRMode][value=merge]:checked');
        dlgR.classList.remove('open');
        // État final : chaque domaine revenu à son empreinte initiale ; données numériques héritées intactes
        r.finalRestored = JSON.stringify(await B.fingerprints()) === JSON.stringify(fp0);
        r.digitalUntouched = digital() === digital0;
        return r;
      })()`), new Promise(res => setTimeout(() => res({ timeout: true }), 120000))]);
      console.log('Résultat Test 32:', JSON.stringify(t32));
      const t32keys = ['api', 'providers', 'format', 'integrity', 'countsMatch', 'r2', 'r2idempotent', 'r3collection', 'r6undo', 'r3explorer', 'r3reading', 'undoIdb', 'r4altered', 'r5orphan', 'r7', 'r1legacy', 'r8guard', 'r9', 'onlyDomain', 'secretsExcludedByDefault', 'secretsEncrypted', 'secretsWrongPassword', 'secretsRestored', 'secretsNotOverwritten', 'uiExport', 'uiRestore', 'finalRestored', 'digitalUntouched'];
      const t32fail = t32keys.filter(k => !t32 || t32[k] !== true);
      if (t32fail.length) console.log('Test 32 — vérifications en échec :', t32fail.join(', '));
      testResults.push({
        test: 'Sauvegardes par domaine (lot 3.1b-1) : panel-bundle v1, intégrité sha256, restauration d\'un domaine seul, annulation, altération refusée, références conservées, conversion v3, anciens fichiers, garde-fou, Explorer absent, clés chiffrées',
        ok: !!t32 && t32fail.length === 0
      });
      // ─── Test 33 : lot 3.1b-2 — contrats locaux S1 PersonalLens.v1 et S2 PersonalCommands.v1 (docs/phase4/05 § 3 et § 4) ───
      // Phase 1 : S1 (lecture seule, liste blanche, réglage, erreurs) et refus de S2 sans geste. Non destructif.
      const t33a = await evalExpr(`(async () => {
        const P = window.Panel, r = {};
        const C = P && P.contracts && P.contracts.personal && P.contracts.personal.v1;
        if (!C) return { api: false };
        r.api = C.version === 1 && Object.isFrozen(C) && ['isEnabled', 'statusFor', 'guideProgress'].every(k => typeof C.lens[k] === 'function')
          && ['gesture', 'addToWishlist', 'addToCollection', 'addToPullList', 'followSeries', 'setGuideProgress', 'openItem', 'undo'].every(k => typeof C.commands[k] === 'function');
        await P.releases.ready(); await P.explorer.load();
        const lsPrint = () => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o.push([k, localStorage.getItem(k)]); } return JSON.stringify(o.sort()); };
        const prevSetting = localStorage.getItem('panel_explorer_personalize');
        localStorage.removeItem('panel_explorer_personalize');
        r.defaultEnabled = C.lens.isEnabled() === true; // P1-a (D-22) : le profil local est traité comme connecté
        const singles = P.getPhysicalSingles();
        const s = singles.find(x => !x.isWishlist && x.series && (x.coverYear || x.pubId));
        const refs = singles.slice(0, 40).map(x => ({ series: x.series, issue: x.issue, year: x.coverYear || '', pubId: x.pubId || '' }));
        const ls0 = lsPrint();
        const st = C.lens.statusFor(refs);
        const one = s ? C.lens.statusFor([{ series: s.series, issue: s.issue, year: s.coverYear || '', pubId: s.pubId || '' }]) : null;
        const g = P.explorer.guides()[0];
        const gd = g ? P.explorer.guide(g.id) : null;
        const entryIds = gd ? ((gd.orders || [])[0] || { entries: [] }).entries.map(e => e.id) : [];
        const gp = gd ? C.lens.guideProgress(gd.id, entryIds) : { ok: true, items: [] };
        r.noWrite = lsPrint() === ls0;
        const allowed = ['owned', 'wishlisted', 'inPullList', 'read'];
        r.whitelist = st.ok === true && st.items.length === refs.length && st.items.every(it => JSON.stringify(Object.keys(it)) === JSON.stringify(allowed) && Number.isInteger(it.owned) && [it.wishlisted, it.inPullList, it.read].every(v => typeof v === 'boolean'));
        const txt = JSON.stringify(st) + JSON.stringify(one);
        r.noForbidden = !/price|value|condition|grade|location|box|notes|purchase|"id"/i.test(txt) && singles.slice(0, 40).every(x => !txt.includes(x.id));
        r.ownedDetected = !s || (one.ok && one.items[0].owned >= 1);
        r.guideProgress = gp.ok === true && gp.items.length === entryIds.length && gp.items.every(it => ['', 'to_read', 'reading', 'read', 'skipped'].includes(it.status) && typeof it.derivedFromCollection === 'boolean' && Object.keys(it).length === 2);
        r.errors = C.lens.statusFor('x').error === 'invalid_input' && C.lens.statusFor([{}]).error === 'invalid_input' && C.lens.statusFor(new Array(501).fill({ series: 'X' })).error === 'rate_limited' && C.lens.guideProgress(5, []).error === 'invalid_input';
        C.settings.setPersonalize(false);
        r.disabled = C.lens.isEnabled() === false && C.lens.statusFor(refs).error === 'disabled' && C.lens.guideProgress('x', []).error === 'disabled';
        if (prevSetting === null) localStorage.removeItem('panel_explorer_personalize'); else localStorage.setItem('panel_explorer_personalize', prevSetting);
        r.settingBackedUp = P.backup ? (await P.backup.export({ domains: ['app'] })).sections.app !== undefined : false;
        // S2 sans geste : refusé ; un événement synthétique (non isTrusted) ne donne pas de jeton
        const pub = P.releases.all().find(p => p && p.id);
        r.pubAvailable = !!pub;
        const fp0 = await P.backup.fingerprint('collection');
        r.noGesture = C.commands.addToWishlist({ pubId: pub && pub.id }, {}).error === 'gesture_required' && C.commands.addToWishlist({ pubId: pub && pub.id }, { gesture: 'g_faux' }).error === 'gesture_required'
          && C.commands.gesture(new MouseEvent('click')) === null && C.commands.gesture(null) === null && (await C.commands.setGuideProgress('g', 'ek_x', 'read', {})).error === 'gesture_required';
        r.noGestureNoWrite = (await P.backup.fingerprint('collection')) === fp0;
        // Bouton de test : un vrai clic (Input.dispatchMouseEvent) fournit un jeton de geste
        window.__t33 = { tokens: [], fp0, pubId: pub && pub.id, entry: entryIds[0] || null, guide: gd && gd.id };
        const b = document.createElement('button');
        b.id = 't33gesture'; b.textContent = 'T33'; b.style.cssText = 'position:fixed;left:4px;top:4px;width:60px;height:30px;z-index:2147483647';
        b.addEventListener('click', e => { window.__t33.tokens.push(C.commands.gesture(e)); });
        document.body.appendChild(b);
        return r;
      })()`);
      for (let i = 0; i < 6; i++) {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 30, y: 18, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 30, y: 18, button: 'left', clickCount: 1 });
      }
      // Phase 2 : commandes avec jeton de geste, dédoublonnage, jeton à usage unique, annulation
      const t33b = await evalExpr(`(async () => {
        const P = window.Panel, C = P.contracts.personal.v1, X = window.__t33, r = {};
        document.getElementById('t33gesture').remove();
        const tk = X.tokens.filter(Boolean);
        r.trustedTokens = tk.length === 6;
        if (!X.pubId || tk.length < 6) return r;
        const w1 = C.commands.addToWishlist({ pubId: X.pubId }, { gesture: tk[0] });
        const w2 = C.commands.addToWishlist({ pubId: X.pubId }, { gesture: tk[1] });
        r.wishlist = w1.ok === true && w2.ok === true && w2.duplicate === true;
        r.tokenSingleUse = C.commands.addToWishlist({ pubId: X.pubId }, { gesture: tk[0] }).error === 'gesture_required';
        if (w1.undoToken) await C.commands.undo(w1.undoToken);
        r.wishUndo = (await P.backup.fingerprint('collection')) === X.fp0;
        r.invalid = C.commands.addToWishlist({ pubId: 'pbc_inexistante' }, { gesture: tk[2] }).error === 'invalid_input';
        if (X.entry) {
          const before = P.explorer.progress(X.entry);
          const sp = await C.commands.setGuideProgress(X.guide, X.entry, before && before.status === 'skipped' ? 'reading' : 'skipped', { gesture: tk[3] });
          const changed = P.explorer.progress(X.entry);
          if (sp.undoToken) await C.commands.undo(sp.undoToken);
          const after = P.explorer.progress(X.entry);
          r.guideCommand = sp.ok === true && !!changed && changed.status !== (before ? before.status : '') && (after ? after.status : '') === (before ? before.status : '');
        } else r.guideCommand = true;
        const name = 'T33 Série suivie fictive';
        const f1 = C.commands.followSeries({ series: name }, { gesture: tk[4] });
        const f2 = C.commands.followSeries({ series: name }, { gesture: tk[5] });
        r.follow = f1.ok === true && !f1.duplicate && f2.ok === true && f2.duplicate === true;
        if (f1.undoToken) await C.commands.undo(f1.undoToken);
        const meta = P.getSeriesMeta();
        r.followUndo = !Object.values(meta).some(m => m && m.name === name && m.pull);
        r.finalCollection = (await P.backup.fingerprint('collection')) === X.fp0;
        return r;
      })()`);
      const t33 = Object.assign({}, t33a, t33b);
      console.log('Résultat Test 33:', JSON.stringify(t33));
      const t33keys = ['api', 'defaultEnabled', 'noWrite', 'whitelist', 'noForbidden', 'ownedDetected', 'guideProgress', 'errors', 'disabled', 'settingBackedUp', 'pubAvailable', 'noGesture', 'noGestureNoWrite', 'trustedTokens', 'wishlist', 'tokenSingleUse', 'wishUndo', 'invalid', 'guideCommand', 'follow', 'followUndo', 'finalCollection'];
      const t33fail = t33keys.filter(k => !t33 || t33[k] !== true);
      if (t33fail.length) console.log('Test 33 — vérifications en échec :', t33fail.join(', '));
      testResults.push({
        test: 'Contrats S1 et S2 (lot 3.1b-2) : statuts minimaux en liste blanche, lecture seule, réglage désactivable (P1-a), erreurs, commandes seulement après un vrai geste, jeton à usage unique, dédoublonnage, annulation',
        ok: t33fail.length === 0
      });
      // ─── Test 34 : lot 3.1b — frontières entre domaines (enrichi à chaque sous-lot, clôturé au 3.1b-6) ───
      // Statique : scripts/check-boundaries.js --strict à 0 couplage, et contrôle négatif (un couplage injecté est bien détecté).
      console.log('\n[TEST 34] Frontières : contrôle statique, Explorer sans fournisseur S1/S2, réglage désactivé, aucune écriture...');
      const t34s = (() => {
        const run = env => { try { return { code: 0, out: require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'scripts', 'check-boundaries.js'), '--strict'], { env: Object.assign({}, process.env, env || {}), encoding: 'utf8' }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') }; } };
        const ok = run();
        const neg = path.join(require('os').tmpdir(), 'panel-t34-negatif.html');
        fs.writeFileSync(neg, "<script>\n(() => {\n  const exT34Fuite = () => physicalSingles.length + relPulls.size;\n  const exT34Action = s => openSingleInspector(s);\n  const relT34Ecrit = () => physicalSingles.push({});\n  const colT34Lance = () => showExplorer();\n})();\n</script>\n");
        const bad = run({ BOUNDARIES_FILE: neg });
        try { fs.unlinkSync(neg); } catch (_) {}
        return { staticStrict: ok.code === 0 && / 0 couplage/.test(ok.out), staticNegative: bad.code === 1 && /5 couplage/.test(bad.out) && /relT34Ecrit/.test(bad.out) && /colT34Lance/.test(bad.out) };
      })();
      const t34a = await evalExpr(`(async () => {
        const P = window.Panel, X = P.explorer, C = P.contracts.personal.v1, r = {};
        await P.releases.ready(); await X.load();
        const fps = async () => JSON.stringify(await Promise.all(['collection', 'reading', 'explorer'].map(d => P.backup.fingerprint(d))));
        const fp0 = await fps();
        const prev = localStorage.getItem('panel_explorer_personalize');
        localStorage.removeItem('panel_explorer_personalize');
        const root = document.getElementById('explorerRoot');
        const has = sel => !!root.querySelector(sel);
        const personalSel = '.ex-entry .ex-badges .ex-b, [data-ex-set], [data-ex-st], .ex-progbox'; // badges personnels des entrées (les badges éditoriaux des éditions VF sont ailleurs)
        // Fournisseur instrumenté : compte les appels à S1 et ajoute des agrégats fictifs « d'après votre collection » (aucune écriture)
        const calls = { n: 0 };
        const spy = { version: 1, settings: C.settings, commands: C.commands, lens: {
          isEnabled: C.lens.isEnabled,
          statusFor: (...a) => { calls.n++; return C.lens.statusFor(...a); },
          guideProgress: (...a) => { calls.n++; return C.lens.guideProgress(...a); },
          collectionFacets: () => { calls.n++; const f = C.lens.collectionFacets(); if (!f.ok) return f;
            return Object.assign({}, f, { series: f.series.concat([{ name: 'T34 Serie Perso', publishers: ['T34 Editeur'], years: [2024], owned: 2, wish: 0, variants: 0, issues: ['1', '2'] }]),
              coverArtists: f.coverArtists.concat([{ name: 'T34 Artiste', covers: [{ series: 'T34 Serie Perso', issue: '1', year: '2024' }] }]) }); } } };
        X.setPersonalProviderForTest(spy);
        // 1. Personnalisation active : statuts via S1, pages dérivées signalées « d'après votre collection »
        await X.open('guide', 'gd_king_in_black');
        r.personalOn = calls.n > 0 && has('.ex-b.is-owned, .ex-b.is-missing') && has('[data-ex-set]') && has('.ex-progbox') && X.stats('gd_king_in_black').personal === true;
        await X.open('creator', 't34 artiste');
        r.derivedTagged = has('.ex-b.is-personal') && has('[data-ex-open]') && /Couvertures dans votre collection/.test(root.textContent);
        await X.open('series', 't34 serie perso');
        r.seriesTagged = has('.ex-b.is-personal') && /Numéros possédés/.test(root.textContent) && /2 exemplaire/.test(root.textContent);
        r.searchNoCollection = !('collection' in X.search('venom')) && !!X.search('t34 artiste').creators;
        // 2. Réglage désactivé depuis l'interface : effet immédiat, aucun appel au fournisseur
        await X.open('home');
        const sw = document.getElementById('exPersonalize');
        r.switchShown = !!sw && sw.checked === true;
        calls.n = 0;
        if (sw) { sw.checked = false; sw.dispatchEvent(new Event('change', { bubbles: true })); }
        r.switchImmediate = localStorage.getItem('panel_explorer_personalize') === '0' && !document.getElementById('exSecReco') && document.getElementById('exPersonalize').checked === false && /Désactivé/.test(root.textContent);
        await X.open('guide', 'gd_king_in_black');
        const guideOff = !has(personalSel) && root.querySelectorAll('.ex-entry').length === 60 && /Personnalisation désactivée ou indisponible/.test(root.textContent);
        await X.open('creator', 't34 artiste');
        const creatorOff = /Créateur introuvable/.test(root.textContent);
        await X.open('series', 't34 serie perso');
        const seriesOff = /Série introuvable/.test(root.textContent);
        r.disabledEditorialOnly = guideOff && creatorOff && seriesOff && !X.search('t34 artiste').creators && X.recos().length === 0;
        r.disabledNoProviderCall = calls.n === 0;
        await X.open('home');
        const sw2 = document.getElementById('exPersonalize');
        if (sw2) { sw2.checked = true; sw2.dispatchEvent(new Event('change', { bubbles: true })); }
        r.reenabled = localStorage.getItem('panel_explorer_personalize') === '1' && calls.n > 0;
        // 3. Fournisseur absent : Explorer complet en version éditoriale, sans badge, sans action personnelle, sans réglage
        X.setPersonalProviderForTest(null);
        await X.open('home');
        r.absentHome = ['exSecFeatured', 'exSecGuides', 'exSecUniverses', 'exSecReleases', 'exSecCharacters', 'exSecCreators', 'exSecSeries', 'exSecNews'].every(id => !!document.getElementById(id)) &&
          !document.getElementById('exSecReco') && !document.getElementById('exPersonalize') && ![...root.querySelectorAll('.ex-unitile span')].some(s => /possédé/.test(s.textContent));
        await X.open('guide', 'gd_king_in_black');
        r.absentGuide = root.querySelectorAll('.ex-entry').length === 60 && !has(personalSel) && !has('[data-ex-wish]') && !!root.querySelector('[data-ex-moreentries]') && X.stats('gd_king_in_black').personal === false;
        r.absentSearch = !!X.search('king in black').guides && !('collection' in X.search('venom'));
        r.absentRecos = X.recos().length === 0;
        // Rétablissement et empreintes : aucune écriture dans Collection, Lecture ni Explorer pendant le test
        X.setPersonalProviderForTest(undefined);
        if (prev === null) localStorage.removeItem('panel_explorer_personalize'); else localStorage.setItem('panel_explorer_personalize', prev);
        await X.open('home');
        r.noWrite = (await fps()) === fp0;
        return r;
      })()`);
      // 3.1b-4 (D1 à D4) : Collection fonctionne sans Explorer ; l'export JSON de Collection ne contient que Collection ; ancien export v2 toujours proposé
      const t34b = await evalExpr(`(async () => {
        const P = window.Panel, X = P.explorer, B = P.backup, r = {};
        await P.releases.ready(); await X.load();
        const vis = id => { const el = document.getElementById(id); return !!el && !el.hidden && el.getClientRects().length > 0; };
        const fp0 = await B.fingerprint('collection');
        r.hostedRegistered = P.views.hosted().includes('explorer');
        // Explorer retiré du routeur : la navigation de Collection, son export et sa restauration fonctionnent
        P.views.setHostedForTest('explorer', null);
        document.getElementById('navAllSingles').click();
        const v1 = vis('singlesCollectionView');
        document.getElementById('navSinglesSeries').click();
        const v2 = vis('singlesSeriesView');
        document.getElementById('navSinglesStats').click();
        const v3 = vis('singlesStatsView');
        const cb = await B.collectionExport();
        const cv = await B.validate(JSON.parse(JSON.stringify(cb)));
        const cr = await B.restore(cv, { domains: ['collection'] });
        r.collectionWithoutExplorer = v1 && v2 && v3 && !P.views.hosted().includes('explorer') && cr.ok === true && cr.added === 0;
        if (cr.ok && cr.undoToken) await B.undo(cr.undoToken);
        r.collectionExportOnly = JSON.stringify(Object.keys(cb.sections)) === JSON.stringify(['collection']) && JSON.stringify(Object.keys(cb.manifest)) === JSON.stringify(['collection']) &&
          cb.format === 'panel-bundle' && Array.isArray(cb.sections.collection.singles) && cb.sections.collection.singles.length === P.getPhysicalSingles().length && !('explorer' in cb.sections.collection) && !('releases' in cb.sections.collection);
        // Bouton « JSON » de Collection : fichier téléchargé = Collection seule
        const got = await new Promise(res => {
          const o = URL.createObjectURL, c0 = HTMLAnchorElement.prototype.click; let blob = null;
          URL.createObjectURL = b => { blob = b; return 'blob:t34'; }; HTMLAnchorElement.prototype.click = function () {};
          document.getElementById('exportSinglesJsonBtn').click();
          let n = 0; const iv = setInterval(async () => { if (blob || ++n > 40) { clearInterval(iv); URL.createObjectURL = o; HTMLAnchorElement.prototype.click = c0; res(blob ? JSON.parse(await blob.text()) : null); } }, 50);
        });
        r.buttonCollectionOnly = !P.getPhysicalSingles().length || (!!got && got.format === 'panel-bundle' && JSON.stringify(Object.keys(got.sections)) === JSON.stringify(['collection']));
        // Explorer rétabli : il se lance lui-même depuis la navigation
        P.views.setHostedForTest('explorer');
        document.getElementById('navExplorer').click();
        for (let i = 0; i < 40 && !document.getElementById('exSecGuides'); i++) await new Promise(res => setTimeout(res, 50));
        r.explorerSelfLaunch = P.views.hosted().includes('explorer') && vis('singlesExplorerView') && !!document.getElementById('exSecGuides');
        document.getElementById('navAllSingles').click();
        // Ancien export panel-singles v2 (D-23), reconstruit par les fournisseurs : même contenu qu'avant
        const old = await B.legacySinglesV2();
        const exb = X.backup(), rel = P.releases.exportData();
        r.legacyV2 = old.format === 'panel-singles' && old.version === 2 && old.singles.length === P.getPhysicalSingles().length && old.releases.publications.length === rel.publications.length &&
          old.releases.pulls.length === rel.pulls.length && old.explorer.editorial.length === exb.editorial.length && old.explorer.progress.length === exb.progress.length && !!P.validateBackupPayload(old).explorer;
        // Ancien fichier v2 avec blocs explorer et releases : relu et réparti vers le bon domaine
        const sp = B.fromLegacy(JSON.parse(JSON.stringify(old)));
        r.legacySplit = sp.sections.collection.singles.length === old.singles.length && sp.sections.explorer.editorial.length === old.explorer.editorial.length &&
          sp.sections.reading.progress.length === old.explorer.progress.length && sp.sections.explorer.publications.length === old.releases.publications.length && sp.sections.collection.pulls.length === old.releases.pulls.length;
        r.d4NoWrite = (await B.fingerprint('collection')) === fp0;
        return r;
      })()`);
      // 3.1b-5 (E1, E3, E4) : calendrier via S1/S2 ; clics synthétiques refusés ; vrais clics : ajout, conversion sans doublon, prix jamais inventé ; annulation d'import prudente
      const t34c = {};
      const t34click = async sel => {
        const okSel = await evalExpr('(() => { const b = document.querySelector(' + JSON.stringify(sel) + '); if (b) b.scrollIntoView({ block: "center" }); return !!b && !b.disabled; })()');
        if (!okSel) return false;
        await new Promise(r => setTimeout(r, 500));
        const p = await evalExpr('(() => { const b = document.querySelector(' + JSON.stringify(sel) + '); if (!b) return null; const q = b.getBoundingClientRect(); return { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) }; })()');
        if (!p) return false;
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        await new Promise(r => setTimeout(r, 500));
        return true;
      };
      const t34pub = await evalExpr(`(async () => {
        const P = window.Panel, R = P.releases;
        await R.ready();
        window.__t34cSaved = P.getPhysicalSingles().slice();
        const d = new Date(), iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const up = await R.upsert({ series: 'T34 Calendrier', issue: '1', publisher: 'Image', market: 'US', date: iso }, 'manual');
        document.getElementById('navSinglesReleases').click();
        P.showSinglesView('releases');
        document.getElementById('releasesPullOnly').checked = false;
        document.getElementById('releasesSearch').value = 'T34 Calendrier';
        R.view({ mode: 'grid', period: 'week', anchor: new Date() });
        return up && up.pub ? up.pub.id : null;
      })()`);
      if (t34pub) {
        const card = '#releasesGrid .release-card[data-id="' + t34pub + '"] ';
        const q = (expr) => evalExpr('(async () => { const P = window.Panel, R = P.releases, B = P.backup, id = ' + JSON.stringify(t34pub) + ', card = document.querySelector(' + JSON.stringify(card.trim()) + '); const mine = () => P.getPhysicalSingles().filter(s => s.pubId === id); ' + expr + ' })()');
        // Clics synthétiques (non isTrusted) : S2 refuse, aucune écriture
        t34c.calSyntheticRefused = await q(`const fp = await B.fingerprint('collection'); if (!card) return false; ['[data-wish]', '[data-buy]', '[data-pulladd]', '[data-pull]'].forEach(s => card.querySelector(s).click()); await new Promise(r => setTimeout(r, 400)); return (await B.fingerprint('collection')) === fp && mine().length === 0;`);
        // Vrai clic « Wish » : une fiche wishlist créée par Collection, badge et bouton à jour
        await t34click(card + '[data-wish]');
        t34c.calWish = await q(`const c = document.querySelector(${JSON.stringify(card.trim())}); return mine().length === 1 && mine()[0].isWishlist === true && !!c && c.textContent.includes('WISHLIST') && c.querySelector('[data-wish]').disabled === true;`);
        // Vrai clic « Acheté » : la fiche wishlist est convertie (même identifiant), aucun doublon, prix payé jamais inventé
        const wishId = await q(`return mine()[0] ? mine()[0].id : null;`);
        await t34click(card + '[data-buy]');
        t34c.calConvertNoDuplicate = await q(`const m = mine(); const c = document.querySelector(${JSON.stringify(card.trim())}); return m.length === 1 && m[0].id === ${JSON.stringify(wishId)} && m[0].isWishlist === false && m[0].purchasePrice == null && !!c && c.textContent.includes('POSSÉDÉ') && c.querySelector('[data-buy]').disabled === true;`);
        // Vrai clic « + Pull » : numéro en attente dans la Pull List (écrit par Collection)
        await t34click(card + '[data-pulladd]');
        t34c.calPull = await q(`const c = document.querySelector(${JSON.stringify(card.trim())}); return R.pulls.all().some(x => x.pubId === id && (x.status === 'planned' || x.status === 'available')) && !!c && c.querySelector('[data-pulladd]').textContent.includes('✓');`);
        // Fiche publication : comptes via S1 (E4) ; « Collection » ×2 par un vrai clic : 2 nouvelles fiches, prix jamais inventé
        t34c.sheetCounts = await q(`R.openSheet(id); const el = document.querySelector('[data-pub-mine]'); return !!el && el.textContent.includes('Dans votre collection : 1 exemplaire(s)') && el.textContent.includes('wishlist : non');`);
        await evalExpr(`(() => { const i = document.getElementById('pubActQty'); if (i) i.value = '2'; return !!i; })()`);
        await t34click('#pubToCollection');
        t34c.sheetQuantity = await q(`const m = mine().filter(s => !s.isWishlist); const el = document.querySelector('[data-pub-mine]'); document.getElementById('pubModal').classList.remove('open'); return m.length === 3 && m.every(s => s.purchasePrice == null) && !!el && el.textContent.includes(': 3 exemplaire(s)');`);
        // Fournisseur absent : aucun badge, aucun bouton désactivé ; vrai clic : action refusée, aucune écriture ; « Ma pull list » sans résultat
        await evalExpr(`(() => { window.Panel.explorer.setPersonalProviderForTest(null); window.Panel.renderReleasesGrid(); return true; })()`);
        const fpA = await evalExpr(`window.Panel.backup.fingerprint('collection')`);
        t34c.calAbsentNoBadge = await q(`return !!card && !card.querySelector('.release-flag') && !card.querySelector('[data-buy]').disabled && card.querySelector('[data-pulladd]').textContent.includes('+ Pull');`);
        await t34click(card + '[data-wish]');
        t34c.calAbsentNoWrite = (await evalExpr(`window.Panel.backup.fingerprint('collection')`)) === fpA && await q(`return mine().filter(s => s.isWishlist).length === 0;`);
        t34c.calAbsentPullOnly = await q(`document.getElementById('releasesPullOnly').checked = true; P.renderReleasesGrid(); const n = document.querySelectorAll('#releasesGrid .release-card').length; document.getElementById('releasesPullOnly').checked = false; return n === 0;`);
        // E3 : question agrégée oui/non ; sans fournisseur, l'annulation d'import conserve toutes les publications ajoutées
        t34c.e3Undo = await q(`
          const NL = String.fromCharCode(10), D = P.data, X = P.explorer, L = P.contracts.personal.v1.lens;
          const rp = L.referencedPubs([id, 'pub_inconnue_t34']);
          const shapeOk = rp.ok === true && JSON.stringify(rp.items) === '[true,false]';
          const imp = async s => { const pl = await D.plan({ text: ['editeur;serie;numero;date_annoncee', 'Image;' + s + ';1;2030-01-15'].join(NL), name: 't34-e3.csv' }); await D.apply(pl); return pl; };
          const tag = Date.now().toString(36), n1 = 'T34 Annulation Prudente ' + tag, n2 = 'T34 Annulation Normale ' + tag; const p1 = await imp(n1); const id1 = (R.all().find(x => x.series === n1) || {}).id;
          X.setPersonalProviderForTest(null);
          const u1 = await D.undo(p1.id);
          X.setPersonalProviderForTest();
          const p2 = await imp(n2);
          const u2 = await D.undo(p2.id);
          return shapeOk && !!id1 && u1.ok && u1.removed === 0 && u1.kept.includes(id1) && !!R.get(id1) && u2.ok && u2.removed === 1 && !R.all().some(x => x.series === n2);`);
        // Remise en état : collection d'avant, numéro de Pull List annulé (conservé dans l'historique), filtres effacés
        await q(`P.explorer.setPersonalProviderForTest(); P.setPhysicalSingles(window.__t34cSaved); for (const pl of R.pulls.all().filter(x => x.pubId === id && (x.status === 'planned' || x.status === 'available'))) await R.pulls.cancel(pl.id); document.getElementById('releasesSearch').value = ''; P.renderReleasesGrid(); document.getElementById('navAllSingles').click(); return true;`);
      }
      // 3.1b-6 : empreintes par domaine avant et après un redémarrage, et après une restauration complète (fusion) puis son annulation : rien ne change
      const t34d = {};
      const t34fp = () => evalExpr(`(async () => { const P = window.Panel; await P.releases.ready(); await P.explorer.load(); await new Promise(r => setTimeout(r, 300)); return await P.backup.fingerprints(); })()`);
      const t34fp0 = await t34fp();
      await send('Page.reload', { ignoreCache: false });
      for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 250)); if (await evalExpr('!!(window.Panel && window.Panel.backup && window.Panel.explorer) && document.readyState === "complete"')) break; }
      await new Promise(r => setTimeout(r, 1500)); // fin des chargements asynchrones du démarrage
      const t34fp1 = await t34fp();
      const t34domains = ['collection', 'reading', 'explorer', 'app'];
      t34d.fpRestart = !!t34fp0 && !!t34fp1 && t34domains.every(d => typeof t34fp0[d] === 'string' && t34fp0[d] === t34fp1[d]);
      if (!t34d.fpRestart) console.log('Test 34 — empreintes avant/après redémarrage :', JSON.stringify(t34fp0), JSON.stringify(t34fp1));
      Object.assign(t34d, await evalExpr(`(async () => {
        const B = window.Panel.backup, doms = ${JSON.stringify(t34domains)}, r = {};
        const fp0 = await B.fingerprints();
        const b = await B.export({ domains: doms });
        const v = await B.validate(JSON.parse(JSON.stringify(b)));
        const res = await B.restore(v, { domains: doms, mode: 'merge' });
        const fp1 = await B.fingerprints();
        r.fpAfterRestore = res.ok === true && res.added === 0 && doms.every(d => fp1[d] === fp0[d]);
        if (res.ok && res.undoToken) await B.undo(res.undoToken);
        const fp2 = await B.fingerprints();
        r.fpAfterUndo = doms.every(d => fp2[d] === fp0[d]);
        return r;
      })()`) || {});
      Object.assign(t34a || {}, t34b || {}, t34c, t34d);
      const t34 = Object.assign({}, t34s, t34a);
      console.log('Résultat Test 34:', JSON.stringify(t34));
      const t34keys = ['staticStrict', 'staticNegative', 'personalOn', 'derivedTagged', 'seriesTagged', 'searchNoCollection', 'switchShown', 'switchImmediate', 'disabledEditorialOnly', 'disabledNoProviderCall',
        'reenabled', 'absentHome', 'absentGuide', 'absentSearch', 'absentRecos', 'noWrite',
        'hostedRegistered', 'collectionWithoutExplorer', 'collectionExportOnly', 'buttonCollectionOnly', 'explorerSelfLaunch', 'legacyV2', 'legacySplit', 'd4NoWrite',
        'calSyntheticRefused', 'calWish', 'calConvertNoDuplicate', 'calPull', 'sheetCounts', 'sheetQuantity', 'calAbsentNoBadge', 'calAbsentNoWrite', 'calAbsentPullOnly', 'e3Undo', 'fpRestart', 'fpAfterRestore', 'fpAfterUndo'];
      const t34fail = t34keys.filter(k => !t34 || t34[k] !== true);
      if (t34fail.length) console.log('Test 34 — vérifications en échec :', t34fail.join(', '));
      testResults.push({
        test: 'Frontières (lot 3.1b) : contrôle statique strict, Explorer via S1/S2 seulement, pages « d\'après votre collection » masquées sans S1, réglage désactivable à effet immédiat sans appel au fournisseur, fournisseur absent, aucune écriture',
        ok: t34fail.length === 0
      });

      // ─── Test 35 : lot F1 — finances (devises explicites, frais, coût, sorties, plus-values réalisées, achats groupés) — docs/directeur/06 partie A ───
      // Données synthétiques uniquement : la collection et les clés touchées sont sauvegardées puis rétablies à l'identique.
      const t35 = await evalExpr(`(async () => {
        const P = window.Panel, F = P.finance, r = {};
        if (!F) return { api: false };
        r.api = Object.isFrozen(F) && ['summary', 'byCurrency', 'dispose', 'restoreDisposal', 'previewLot', 'createLot', 'removeLot', 'undo', 'log', 'costOf', 'realizedGainOf'].every(k => typeof F[k] === 'function');
        const KEYS = ['panel_acquisitions', 'panel_default_currency', 'panel_value_snapshots'];
        const prevLs = KEYS.map(k => [k, localStorage.getItem(k)]);
        const fp0 = await P.backup.fingerprint('collection');
        const saved = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        const base = { publisher: 'Image Comics', variant: 'Cover A', keyType: 'none', condition: '', coverYear: 2025, addedAt: '2026-11-01T00:00:00.000Z' };
        const mk = (id, o) => Object.assign({ id, series: 'T35 ' + id, issue: '#1' }, base, o);
        try {
          // T-F1 : fiches anciennes (sans devise ni frais) — calcul identique à F0
          P.setPhysicalSingles([mk('a', { purchasePrice: 10, estValue: 25 }), mk('b', { purchasePrice: null, estValue: 5 }), mk('c', { purchasePrice: 4, estValue: null }), mk('w', { isWishlist: true, estValue: 50 })]);
          const s1 = F.summary();
          r.legacyF0 = s1.ownedCount === 3 && s1.invested === 14 && s1.value === 30 && s1.gain === 15 && s1.gainBase === 1 && s1.mixed === false && JSON.stringify(s1.currencies) === '["none"]' && s1.costUnknown === 1 && s1.valueUnknown === 1;
          // T-F2 : frais inclus dans le coût ; frais inconnus = coût partiel signalé, jamais inventé
          P.setPhysicalSingles([mk('f', { purchasePrice: 10, acquisitionFees: 2, estValue: 20, purchaseCurrency: 'EUR' }), mk('g', { purchasePrice: 5, estValue: 6, purchaseCurrency: 'EUR' })]);
          const s2 = F.summary();
          r.fees = F.costOf(P.getPhysicalSingles()[0]) === 12 && s2.invested === 17 && s2.gain === 9 && s2.feesUnknown === 1 && JSON.stringify(s2.currencies) === '["EUR"]';
          // T-F3 : deux devises — aucune somme mélangée, totaux neutralisés, détail par devise, pas de relevé quotidien
          const snapBefore = localStorage.getItem('panel_value_snapshots');
          P.setPhysicalSingles([mk('e', { purchasePrice: 10, estValue: 20, purchaseCurrency: 'EUR' }), mk('u', { purchasePrice: 7, estValue: 9, purchaseCurrency: 'USD' }), mk('x', { purchasePrice: 3, estValue: 8, purchaseCurrency: 'USD', valueCurrency: 'EUR' })]);
          const s3 = F.summary();
          r.twoCurrencies = s3.mixed === true && s3.value === null && s3.invested === null && s3.gain === null && s3.byCurrency.EUR.invested === 10 && s3.byCurrency.USD.invested === 10
            && s3.byCurrency.EUR.value === 28 && s3.byCurrency.USD.value === 9 && s3.byCurrency.EUR.gain === 10 && s3.byCurrency.USD.gain === 2 && s3.byCurrency.EUR.gainBase === 1;
          r.noMixedSnapshot = localStorage.getItem('panel_value_snapshots') === snapBefore;
          r.mixedUi = /€/.test(document.getElementById('statSinglesValue').textContent) && /\\$/.test(document.getElementById('statSinglesValue').textContent);
          // T-F4 : vente — plus-value réalisée = prix − frais de vente − coût ; la fiche reste, n'est plus possédée ; annulation exacte
          P.setPhysicalSingles([mk('s', { purchasePrice: 10, acquisitionFees: 2, estValue: 20, purchaseCurrency: 'EUR' }), mk('k', { purchasePrice: 5, estValue: 6, purchaseCurrency: 'EUR' })]);
          const before = JSON.stringify(P.getPhysicalSingles());
          const d = F.dispose('s', { kind: 'sold', date: '2026-11-07', price: 30, fees: 3 });
          const s4 = F.summary();
          const sold = P.getPhysicalSingles().find(x => x.id === 's');
          r.sale = d.ok === true && d.realizedGain === 15 && sold.disposal.currency === 'EUR' && s4.ownedCount === 1 && s4.realized === 15 && s4.soldCount === 1 && P.getPhysicalSingles().length === 2;
          r.saleLog = F.log('s').some(h => h.field === 'disposal' && h.by === 'user');
          r.saleUndo = F.undo(d.undoToken) === true && JSON.stringify(P.getPhysicalSingles()) === before && F.undo(d.undoToken) === false;
          const gi = F.dispose('k', { kind: 'gift' });
          r.giftNoGain = gi.ok && gi.realizedGain === null && F.summary().ownedCount === 1;
          const rs = F.restoreDisposal('k');
          r.restoreDisposal = rs.ok && F.summary().ownedCount === 2;
          r.badKind = F.dispose('k', { kind: 'volé' }).ok === false;
          // T-F5 : vente au coût inconnu ou dans une autre devise : plus-value inconnue (jamais 0)
          P.setPhysicalSingles([mk('n', { purchasePrice: null, purchaseCurrency: 'EUR' }), mk('m', { purchasePrice: 4, purchaseCurrency: 'EUR' })]);
          r.unknownCost = F.dispose('n', { kind: 'sold', price: 12 }).realizedGain === null && F.dispose('m', { kind: 'sold', price: 12, currency: 'USD' }).realizedGain === null;
          // T-F6 : achat groupé — méthode par défaut D-29 (couverture si toutes connues), centimes exacts, reste sur la ligne la plus chère
          const lot = [mk('l1', { coverPrice: 3.99 }), mk('l2', { coverPrice: 4.99 }), mk('l3', { coverPrice: 5.99 })];
          P.setPhysicalSingles(lot.concat([mk('l4', {}), mk('l5', { purchasePrice: 9, purchaseCurrency: 'EUR' })]));
          const lotBefore = JSON.stringify(P.getPhysicalSingles());
          const acqBefore = localStorage.getItem('panel_acquisitions');
          r.lotDefault = F.defaultMethod(['l1', 'l2', 'l3']) === 'cover' && F.defaultMethod(['l1', 'l4']) === 'equal';
          const pv = F.previewLot({ copyIds: ['l1', 'l2', 'l3'], totalPaid: 10, fees: 1, currency: 'EUR' });
          const cents = pv.lines.reduce((a, l) => a + Math.round(l.allocatedPrice * 100), 0), fcents = pv.lines.reduce((a, l) => a + Math.round(l.allocatedFees * 100), 0);
          r.lotCover = pv.ok && pv.method === 'cover' && cents === 1000 && fcents === 100 && pv.remainderLine === 2 && pv.lines[0].allocatedPrice < pv.lines[2].allocatedPrice;
          r.lotPreviewNoWrite = JSON.stringify(P.getPhysicalSingles()) === lotBefore && localStorage.getItem('panel_acquisitions') === acqBefore;
          const eq = F.previewLot({ copyIds: ['l1', 'l2', 'l3'], totalPaid: 10, currency: 'EUR', method: 'equal' });
          r.lotEqual = eq.ok && eq.lines.map(l => l.allocatedPrice).join() === '3.34,3.33,3.33' && eq.remainder === 0.01;
          r.lotManual = F.previewLot({ copyIds: ['l1', 'l2'], totalPaid: 10, currency: 'EUR', method: 'manual', manual: [4, 5] }).ok === false
            && F.previewLot({ copyIds: ['l1', 'l2'], totalPaid: 10, currency: 'EUR', method: 'manual', manual: [4, 6] }).ok === true;
          r.lotCoverRefused = F.previewLot({ copyIds: ['l1', 'l4'], totalPaid: 10, currency: 'EUR', method: 'cover' }).ok === false && F.previewLot({ copyIds: ['l1'], totalPaid: 10 }).ok === false;
          const cl = F.createLot({ copyIds: ['l1', 'l4', 'l5'], totalPaid: 30, currency: 'EUR', date: '2026-11-05', vendor: 'Convention test' });
          const L = id => P.getPhysicalSingles().find(x => x.id === id);
          r.lotCreate = cl.ok && cl.method === 'equal' && JSON.stringify(cl.written) === '["l1","l4"]' && JSON.stringify(cl.skipped) === '["l5"]' && L('l5').purchasePrice === 9 && !L('l5').acquisitionId
            && L('l1').purchasePrice === 10 && L('l1').purchaseCurrency === 'EUR' && L('l1').acquisitionId === cl.id && L('l1').purchaseDate === '2026-11-05' && F.lots().length === JSON.parse(acqBefore || '[]').length + 1
            && F.log('l1').some(h => h.by === 'lot' && h.field === 'purchasePrice');
          r.lotUndo = F.undo(cl.undoToken) === true && JSON.stringify(P.getPhysicalSingles()) === lotBefore && localStorage.getItem('panel_acquisitions') === acqBefore;
          const cl2 = F.createLot({ copyIds: ['l2', 'l3'], totalPaid: 8, currency: 'EUR', method: 'equal' });
          const rm = F.removeLot(cl2.id, { removePrices: true });
          r.lotRemove = rm.ok && rm.unlinked === 2 && !L('l2').acquisitionId && L('l2').purchasePrice === null && !F.lots().some(a => a.id === cl2.id);
          F.undo(rm.undoToken);
          r.lotRemoveUndo = L('l2').acquisitionId === cl2.id && L('l2').purchasePrice === 4 && F.lots().some(a => a.id === cl2.id);
          // T-F7 : sauvegarde panel-bundle — lots, frais, sorties et journal conservés par la restauration (sanitizeImportedSingle)
          F.dispose('l3', { kind: 'sold', price: 9, fees: 1 });
          const bx = await P.backup.export({ domains: ['collection'] });
          const v = await P.backup.validate(bx);
          const items = v.sections.collection.norm.items, it3 = items.find(x => x.id === 'l3');
          r.bundleRoundTrip = Array.isArray(bx.sections.collection.acquisitions) && bx.sections.collection.acquisitions.some(a => a.id === cl2.id)
            && v.sections.collection.norm.acquisitions.some(a => a.id === cl2.id) && it3 && it3.disposal && it3.disposal.kind === 'sold' && it3.disposal.price === 9
            && Array.isArray(it3.financeLog) && it3.financeLog.length === L('l3').financeLog.length && it3.acquisitionId === cl2.id && it3.purchaseCurrency === 'EUR';
          // T-F8 : Explorer (S1) — un exemplaire sorti n'est plus « possédé »
          const C = P.contracts.personal.v1;
          const st = C.lens.isEnabled() ? C.lens.statusFor([{ series: 'T35 l3', issue: '#1', year: 2025 }, { series: 'T35 l2', issue: '#1', year: 2025 }]) : null;
          r.lensDisposed = !st || (st.ok && st.items[0].owned === 0 && st.items[1].owned === 1);
          // T-F9 : formulaire — champs présents, devise vide par défaut sans préférence, préférence mémorisée seulement par choix
          localStorage.removeItem('panel_default_currency');
          r.form = !!document.getElementById('singleCurrencySelect') && !!document.getElementById('singleFeesInput') && !!document.getElementById('singleDisposalKind') && !!document.querySelector('[data-sfilter="disposed"]');
          const dc0 = F.defaultCurrency() === null && F.setDefaultCurrency('EUR') === 'EUR';
          const va = await P.backup.validate(await P.backup.export({ domains: ['app'] }));
          r.prefSynced = va.sections.app.norm.prefs.panel_default_currency === 'EUR';
          r.defaultCurrency = dc0 && F.setDefaultCurrency('xx') === null && F.defaultCurrency() === null;
        } finally {
          P.setPhysicalSingles(saved);
          prevLs.forEach(([k, val]) => { if (val === null) localStorage.removeItem(k); else localStorage.setItem(k, val); });
        }
        r.finalCollection = (await P.backup.fingerprint('collection')) === fp0;
        return r;
      })()`);
      // T-F10 : plus aucune devise inventée dans le code (D-27)
      t35.noUsdDefault = !/purchaseCurrency\)\s*\|\|\s*'USD'/.test(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'));
      console.log('Résultat Test 35:', JSON.stringify(t35));
      const t35keys = ['api', 'legacyF0', 'fees', 'twoCurrencies', 'noMixedSnapshot', 'mixedUi', 'sale', 'saleLog', 'saleUndo', 'giftNoGain', 'restoreDisposal', 'badKind', 'unknownCost', 'lotDefault', 'lotCover', 'lotPreviewNoWrite', 'lotEqual', 'lotManual', 'lotCoverRefused', 'lotCreate', 'lotUndo', 'lotRemove', 'lotRemoveUndo', 'bundleRoundTrip', 'lensDisposed', 'form', 'defaultCurrency', 'prefSynced', 'finalCollection', 'noUsdDefault'];
      const t35fail = t35keys.filter(k => !t35 || t35[k] !== true);
      if (t35fail.length) console.log('Test 35 — vérifications en échec :', t35fail.join(', '));
      testResults.push({
        test: 'Finances F1 : devises explicites sans conversion, frais et coût, sorties de collection et plus-values réalisées, achats groupés (3 méthodes, annulation), sauvegarde, S1',
        ok: t35fail.length === 0
      });


      // ─── Test 36 : lot L1 — domaine Lecture (état par œuvre, compatibilité isRead, migration conservatrice, S1/S2, sauvegarde) — docs/directeur/06 partie B, D-30 ───
      // Données synthétiques ; collection, panel_reading_v1 et progression des guides rétablies à l'identique.
      const t36 = await evalExpr(`(async () => {
        const P = window.Panel, L = P.reading, r = {};
        if (!L) return { api: false };
        r.api = Object.isFrozen(L) && ['statusOf', 'setStatus', 'rate', 'setPosition', 'migrationPreview', 'migrate', 'undoMigration', 'resolveConflict', 'seriesProgress', 'stats', 'resume', 'history', 'undo'].every(k => typeof L[k] === 'function');
        const RK = 'panel_reading_v1', prevRaw = localStorage.getItem(RK);
        const fpC = await P.backup.fingerprint('collection'), fpR = await P.backup.fingerprint('reading');
        const saved = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        const base = { publisher: 'Image Comics', variant: 'Cover A', keyType: 'none', condition: '', coverYear: 2025, addedAt: '2026-01-01T00:00:00.000Z' };
        const mk = (id, o) => Object.assign({ id, series: 'T36 Série', issue: '#1' }, base, o);
        const ref = (series, issue) => ({ series, issue, year: 2025 });
        try {
          localStorage.removeItem(RK);
          // Compatibilité : un exemplaire lu suffit pour l'œuvre ; aucune écriture
          P.setPhysicalSingles([mk('a1', { isRead: true }), mk('a2', { isRead: false, variant: 'Cover B' }), mk('b1', { issue: '#2' }), mk('b2', { issue: '#2', variant: 'Cover B' }), mk('c3', { issue: '#3', isRead: true, disposal: { kind: 'sold', date: '2026-02-01', price: 5, fees: null, currency: 'EUR', note: '' } })]);
          r.compat = L.statusOf(P.getPhysicalSingles()[1]) === 'read' && L.statusOf(ref('T36 Série', '#2')) === '' && localStorage.getItem(RK) === null;
          // Un geste pour l'œuvre entière (deux exemplaires) ; les fiches ne sont pas modifiées par Lecture
          const copies0 = JSON.stringify(P.getPhysicalSingles());
          const s1 = L.setStatus(ref('T36 Série', '#2'), 'read');
          const all = P.getPhysicalSingles();
          r.oneGesture = s1.ok && L.isRead(all[2]) && L.isRead(all[3]) && JSON.stringify(all) === copies0 && L.history(s1.workKey).some(h => h.event === 'finished');
          const rr = L.setStatus(ref('T36 Série', '#2'), 'read', { reread: true });
          r.reread = rr.ok && L.state(ref('T36 Série', '#2')).readCount === 2 && L.history(s1.workKey).some(h => h.event === 'reread');
          r.undo = L.undo(rr.undoToken) === true && L.state(ref('T36 Série', '#2')).readCount === 1;
          r.badStatus = L.setStatus(ref('T36 Série', '#2'), 'lu').ok === false && L.setStatus({}, 'read').ok === false;
          // Lu sans être possédé : visible dans Lecture et S1, absent de Collection
          const nr = ref('T36 Lu non possédé', '#1');
          L.setStatus(nr, 'read');
          const C = P.contracts.personal.v1;
          const st = C.lens.isEnabled() ? C.lens.statusFor([nr, ref('T36 Série', '#3'), ref('T36 Série', '#2')]) : null;
          r.readNotOwned = L.stats().readNotOwned >= 1 && !P.getPhysicalSingles().some(s => s.series === nr.series) && (!st || (st.items[0].read === true && st.items[0].owned === 0));
          // Exemplaire vendu : la lecture est conservée (S1 read), il n'est plus possédé
          r.soldKeepsRead = !st || (st.items[1].read === true && st.items[1].owned === 0 && st.items[2].read === true && st.items[2].owned === 2);
          // S2 markRead : refusé sans geste
          r.markReadGesture = typeof C.commands.markRead === 'function' && C.commands.markRead(nr, 'reading', {}).error === 'gesture_required';
          // Série dérivée, jamais stockée : prochain numéro
          const sp = L.seriesProgress('T36 Série');
          r.series = sp.known === 3 && sp.read === 3 && sp.next === null;
          L.setStatus(ref('T36 Série', '#2'), 'reading');
          L.setPosition(ref('T36 Série', '#2'), { page: 12, note: 'p. 12' });
          const sp2 = L.seriesProgress('T36 Série');
          r.resume = sp2.next === '#2' && L.resume().some(x => x.issue === '#2' && x.position && x.position.page === 12);
          // Migration de isRead : aperçu, conflit de notes (la plus récente), fiches inchangées, idempotence, annulation durable
          P.setPhysicalSingles([mk('m1', { series: 'T36 Mig', isRead: true, rating: 3, updatedAt: '2026-03-01T00:00:00.000Z' }), mk('m2', { series: 'T36 Mig', variant: 'Cover B', isRead: true, rating: 5, updatedAt: '2025-03-01T00:00:00.000Z' }),
            mk('m3', { series: 'T36 Mig', issue: '#2', isRead: true, rating: 4 }), mk('m4', { series: 'T36 Mig', issue: '#3', isRead: false, rating: 2 }), mk('m5', { series: 'T36 Série', issue: '#2', isRead: true })]);
          const before = JSON.stringify(P.getPhysicalSingles());
          const pv = L.migrationPreview();
          const p1 = pv.plan.find(p => p.label.series === 'T36 Mig' && p.label.issue === '#1');
          r.migPreview = pv.works === 2 && pv.copies === 3 && pv.conflicts === 1 && p1 && p1.rating === 3 && p1.conflict.length === 2 && JSON.stringify(P.getPhysicalSingles()) === before;
          const mg = L.migrate();
          r.migrate = mg.ok && mg.created === 2 && mg.conflicts === 1 && JSON.stringify(P.getPhysicalSingles()) === before && L.state(ref('T36 Mig', '#1')).source === 'migrated:isRead' && L.state(ref('T36 Mig', '#1')).rating === 3
            && L.state(ref('T36 Série', '#2')).status === 'reading'; // un état existant n'est jamais réécrit
          r.migIdempotent = L.migrate().created === 0;
          const cf = L.conflicts()[L.keyOf(ref('T36 Mig', '#1'))];
          r.conflictKept = !!cf && cf.resolved === false && cf.candidates.map(c => c.rating).sort().join() === '3,5';
          const rc = L.resolveConflict(L.keyOf(ref('T36 Mig', '#1')), 5);
          r.resolve = rc.ok && L.state(ref('T36 Mig', '#1')).rating === 5 && L.history(L.keyOf(ref('T36 Mig', '#1'))).some(h => h.event === 'rating' && Array.isArray(h.discarded));
          L.undo(rc.undoToken);
          const um = L.undoMigration(mg.batch);
          r.undoMigration = um.ok && um.removed === 2 && L.state(ref('T36 Mig', '#1')) === null && L.statusOf(ref('T36 Mig', '#1')) === 'read' && L.migrationPreview().works === 2;
          // Sauvegarde Lecture (B1) : aller-retour des états par œuvre
          L.migrate();
          const ex = await P.backup.export({ domains: ['reading'] });
          const v = await P.backup.validate(ex);
          const w = v.sections.reading.norm.works;
          r.bundle = !!w && JSON.stringify(Object.keys(w.states).sort()) === JSON.stringify(L.list().map(s => s.workKey).sort()) && w.log.length === L.history().length;
          // Restauration : le cache relit la clé (pas d'état périmé en mémoire)
          const rawNow = localStorage.getItem(RK);
          localStorage.removeItem(RK);
          r.cacheReload = L.list().length === 0;
          localStorage.setItem(RK, rawNow);
          r.cacheReload = r.cacheReload && L.list().length > 0;
          r.form = !!document.getElementById('readingMigrateBtn');
        } finally {
          P.setPhysicalSingles(saved);
          if (prevRaw === null) localStorage.removeItem(RK); else localStorage.setItem(RK, prevRaw);
        }
        r.finalCollection = (await P.backup.fingerprint('collection')) === fpC;
        r.finalReading = (await P.backup.fingerprint('reading')) === fpR;
        return r;
      })()`);
      console.log('Résultat Test 36:', JSON.stringify(t36));
      const t36keys = ['api', 'compat', 'oneGesture', 'reread', 'undo', 'badStatus', 'readNotOwned', 'soldKeepsRead', 'markReadGesture', 'series', 'resume', 'migPreview', 'migrate', 'migIdempotent', 'conflictKept', 'resolve', 'undoMigration', 'bundle', 'cacheReload', 'form', 'finalCollection', 'finalReading'];
      const t36fail = t36keys.filter(k => !t36 || t36[k] !== true);
      if (t36fail.length) console.log('Test 36 — vérifications en échec :', t36fail.join(', '));
      testResults.push({
        test: 'Lecture L1 : état par œuvre partagé par les exemplaires, compatibilité isRead sans écriture, lu sans possession, vente sans perte, relecture, reprise, migration (aperçu, conflits de notes, idempotence, annulation), S1/S2, sauvegarde',
        ok: t36fail.length === 0
      });

      // ─── Test 37 : vues Lecture (L1-4, U-D1 = L-C) et Finances (F1-5, U-D2 = Fi-A) — D-32 ───
      // Données synthétiques ; collection et panel_reading_v1 rétablies à l'identique.
      console.log('\n[TEST 37] Vues Lecture et Finances : navigation, statistiques, changement de statut et annulation, devises sans total mixte, inconnu « — »...');
      const t37 = await evalExpr(`(async () => {
        const P = window.Panel, L = P.reading, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const RK = 'panel_reading_v1', prevRaw = localStorage.getItem(RK);
        const saved = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        const fpC = await P.backup.fingerprint('collection');
        const m = new Date().toISOString().slice(0, 7) + '-02';
        const base = { publisher: 'Image Comics', variant: 'Cover A', keyType: 'none', condition: '', coverYear: 2025, addedAt: '2026-01-01T00:00:00.000Z' };
        const mk = (id, o) => Object.assign({ id, series: 'T37 Série', issue: '#1' }, base, o);
        try {
          localStorage.removeItem(RK);
          P.setPhysicalSingles([
            mk('v1', { purchasePrice: 4, purchaseCurrency: 'EUR', purchaseDate: m, isRead: true }),
            mk('v2', { issue: '#2', purchasePrice: 5, purchaseCurrency: 'USD', purchaseDate: m }),
            mk('v3', { issue: '#3' }),
            mk('v4', { series: 'T37 Vendue', purchasePrice: 3, purchaseCurrency: 'EUR', disposal: { kind: 'sold', date: '2026-03-01', price: 9, fees: 1, currency: 'EUR', note: '' } })
          ]);
          await wait(200);
          r.nav = !!document.getElementById('navSinglesReading') && !!document.getElementById('navSinglesFinances') && !!document.querySelector('#singlesSubnav [data-sview="reading"]') && !!document.querySelector('#singlesSubnav [data-sview="finances"]');
          document.getElementById('navSinglesReading').click();
          await wait(150);
          const rv = document.getElementById('singlesReadingView');
          r.readingShown = !rv.hidden && document.getElementById('singlesCollectionView').hidden && document.getElementById('mainTitleHeading').textContent === 'Lecture' && document.getElementById('navSinglesReading').classList.contains('active');
          L.setStatus({ series: 'T37 Série', issue: '#2', year: 2025 }, 'reading');
          document.querySelector('#readingFilterTabs [data-rdf="reading"]').click();
          await wait(100);
          const dash = document.getElementById('readingDashboard');
          r.readingList = /T37 Série #2/.test(dash.querySelector('#readingList').textContent) && /Prochain numéro/.test(dash.textContent) && document.getElementById('badgeReadingNow').textContent === '1';
          const btn = dash.querySelector('#readingList [data-rdset="read"]');
          const before = L.statusOf({ series: 'T37 Série', issue: '#2', year: 2025 });
          btn.click();
          await wait(150);
          const after = L.statusOf({ series: 'T37 Série', issue: '#2', year: 2025 });
          r.setFromView = before === 'reading' && after === 'read' && P.getPhysicalSingles().find(x => x.id === 'v2').isRead === true && !!L.history().find(h => h.event === 'finished');
          // Annulation par le bouton du message
          const undoBtn = document.querySelector('#toastPopup button, .toast-action, [data-toast-action]');
          if (undoBtn) { undoBtn.click(); await wait(100); }
          r.undoFromView = !!undoBtn && L.statusOf({ series: 'T37 Série', issue: '#2', year: 2025 }) === 'reading' && P.getPhysicalSingles().find(x => x.id === 'v2').isRead === false;
          document.querySelector('#readingFilterTabs [data-rdf="journal"]').click();
          await wait(80);
          r.journal = /commencé/.test(document.getElementById('readingList').textContent);
          // XSS : un titre piégé reste du texte
          L.setStatus({ series: 'T37 <img src=x onerror="window.__x37=1">', issue: '#1', year: 2025 }, 'to_read');
          document.querySelector('#readingFilterTabs [data-rdf="all"]').click();
          await wait(80);
          r.xss = !window.__x37 && !document.querySelector('#readingDashboard img[src="x"]');
          // Finances
          document.getElementById('navSinglesFinances').click();
          await wait(150);
          const fd = document.getElementById('financeDashboard');
          const txt = fd.textContent;
          r.financeShown = !document.getElementById('singlesFinanceView').hidden && document.getElementById('mainTitleHeading').textContent === 'Finances';
          r.byCurrency = !!fd.querySelector('.fin-table') && /EUR/.test(fd.querySelector('.fin-table').textContent) && /USD/.test(fd.querySelector('.fin-table').textContent);
          r.noMixedTotal = /aucun total global/.test(txt) && P.finance.summary().invested === null;
          r.coverage = /Coût connu : 2/.test(txt) && /inconnu : 1/.test(txt);
          r.realized = /vendu/.test(txt) && /5,00/.test(txt);
          r.spend = /Dépenses par mois/.test(txt) && /4,00/.test(txt);
          const sel = document.getElementById('finDefaultCurrencySelect');
          const prevCur = P.finance.defaultCurrency();
          sel.value = 'CAD'; sel.dispatchEvent(new Event('change'));
          r.defaultCurrency = P.finance.defaultCurrency() === 'CAD' && P.getPhysicalSingles().every(x => x.purchaseCurrency !== 'CAD');
          P.finance.setDefaultCurrency(prevCur);
          // Aucune écriture de Collection par la vue Finances
          r.financeReadOnly = JSON.stringify(P.getPhysicalSingles().map(x => [x.id, x.purchasePrice, x.purchaseCurrency])) === JSON.stringify([['v1', 4, 'EUR'], ['v2', 5, 'USD'], ['v3', undefined, undefined], ['v4', 3, 'EUR']]);
          document.getElementById('navAllSingles').click();
          await wait(100);
          r.back = !document.getElementById('singlesCollectionView').hidden && document.getElementById('singlesFinanceView').hidden && document.getElementById('singlesReadingView').hidden;
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          P.setPhysicalSingles(saved);
          if (prevRaw === null) localStorage.removeItem(RK); else localStorage.setItem(RK, prevRaw);
          await wait(200);
        }
        r.finalCollection = (await P.backup.fingerprint('collection')) === fpC;
        r.finalReading = localStorage.getItem(RK) === prevRaw;
        return r;
      })()`);
      console.log('Résultat Test 37:', JSON.stringify(t37));
      const t37keys = ['nav', 'readingShown', 'readingList', 'setFromView', 'undoFromView', 'journal', 'xss', 'financeShown', 'byCurrency', 'noMixedTotal', 'coverage', 'realized', 'spend', 'defaultCurrency', 'financeReadOnly', 'back', 'finalCollection', 'finalReading'];
      const t37fail = t37keys.filter(k => !t37 || t37[k] !== true);
      if (t37fail.length) console.log('Test 37 — vérifications en échec :', t37fail.join(', '));
      testResults.push({
        test: 'Vues Lecture et Finances (U-D1 L-C, U-D2 Fi-A) : navigation, statut depuis la vue et annulation, journal, XSS, devises sans total mixte, couverture, plus-value réalisée, dépenses du mois, devise par défaut, lecture seule',
        ok: t37fail.length === 0
      });

      // ─── Test 38 : Explorer 2.0 intégré (D-33) — modules domains/ intégrés à l'identique, recherche tolérante, guides proches motivés ───
      // Un guide synthétique est ajouté puis retiré ; King in Black et la collection sont rétablis.
      console.log('\n[TEST 38] Explorer 2.0 : modules intégrés, recherche tolérante (fautes, inversions), mode strict, guides proches avec motifs, sans collection...');
      const t38 = await evalExpr(`(async () => {
        const P = window.Panel, X = P.explorer, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const D = window.PanelDomains;
        r.domains = !!D && Object.isFrozen(D) && typeof D.catalogCore.fuzzyMatch === 'function' && typeof D.catalogCore.createCatalog === 'function' && typeof D.communityPolicy.shareCopy === 'function' && Object.isFrozen(D.catalogCore);
        await X.load();
        const ids = s => ((s.guides || {}).items || []);
        r.exact = ids(X.search('King in Black')).includes('gd_king_in_black');
        r.typo = ids(X.search('Kign in Blakc')).includes('gd_king_in_black');
        r.strict = !ids(X.search('Kign in Blakc', { strict: true })).includes('gd_king_in_black');
        r.noFalse = Object.keys(X.search('zzqx wvyk')).length === 0;
        const kib = X.guide('gd_king_in_black');
        let saved = false;
        try {
          const g = JSON.parse(JSON.stringify(kib));
          g.id = 'gd_t38_near'; g.title = 'T38 Guide proche'; g.aliases = []; g.relations = []; g.prerequisites = []; g.editions = [];
          g.orders = g.orders.slice(0, 1).map(o => Object.assign(o, { id: 'ord_t38', entries: o.entries.slice(10, 13).map((e, i) => Object.assign(e, { id: 'e_t38_' + i, pos: i + 1 })) }));
          const sv = await X.save(g);
          saved = !!(sv && (sv.ok || sv.guide || sv.id));
          await wait(150);
          const rel = X.related('gd_king_in_black') || [];
          const hit = rel.find(x => x.id === 'gd_t38_near');
          r.related = !!hit && hit.why.some(w => /série/.test(w)) && hit.score >= 2;
          r.relatedNoSelf = !rel.some(x => x.id === 'gd_king_in_black');
          await X.open('guide', 'gd_king_in_black');
          await wait(150);
          const sec = document.getElementById('exRelatedGuides');
          r.relatedUi = !!sec && /T38 Guide proche/.test(sec.textContent) && /en commun/.test(sec.textContent);
          // Les guides proches ne dépendent pas de la collection : identiques sans fournisseur S1
          X.setPersonalProviderForTest(null);
          r.noCollection = JSON.stringify(X.related('gd_king_in_black')) === JSON.stringify(rel);
          X.setPersonalProviderForTest(undefined);
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          await new Promise(res => { const q = indexedDB.open('panel-catalog'); q.onsuccess = () => { const db = q.result; const tx = db.transaction(['editorial'], 'readwrite'); tx.objectStore('editorial').delete('gd_t38_near'); if (kib) tx.objectStore('editorial').put(kib); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = tx.onabort = () => { db.close(); res(); }; }; q.onerror = () => res(); });
          await X.load();
          { const nb = document.getElementById('navAllSingles'); if (nb) nb.click(); }
        }
        r.saved = saved;
        r.cleanup = !X.guide('gd_t38_near') && JSON.stringify(X.guide('gd_king_in_black')) === JSON.stringify(kib);
        return r;
      })()`);
      console.log('Résultat Test 38:', JSON.stringify(t38));
      const t38keys = ['domains', 'exact', 'typo', 'strict', 'noFalse', 'saved', 'related', 'relatedNoSelf', 'relatedUi', 'noCollection', 'cleanup'];
      const t38fail = t38keys.filter(k => !t38 || t38[k] !== true);
      if (t38fail.length) console.log('Test 38 — vérifications en échec :', t38fail.join(', '));
      testResults.push({
        test: 'Explorer 2.0 intégré : modules domains/ identiques dans index.html, recherche tolérante (fautes, inversions) avec mode strict, guides proches motivés sans collection, nettoyage',
        ok: t38fail.length === 0
      });

      // ─── Test 39 : Communauté (D-34) — partage = copie en liste blanche, brouillons locaux, aucune requête, aucune publication ───
      console.log('\n[TEST 39] Communauté : copie limitée (ni prix, ni valeur, ni emplacement, ni notes), validation (liens, données personnelles), brouillons locaux, annulation, XSS, aucune requête...');
      const t39 = await evalExpr(`(async () => {
        const P = window.Panel, C = P.community, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const CK = 'panel_community_drafts_v1', prevRaw = localStorage.getItem(CK);
        const saved = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        const fpC = await P.backup.fingerprint('collection');
        let net = 0; const f0 = window.fetch, x0 = XMLHttpRequest.prototype.open;
        window.fetch = function () { net++; return f0.apply(this, arguments); };
        XMLHttpRequest.prototype.open = function () { net++; return x0.apply(this, arguments); };
        try {
          localStorage.removeItem(CK);
          P.setPhysicalSingles([{ id: 'c39', series: 'T39 Série', issue: '#4', publisher: 'Image Comics', variant: 'Cover B', coverYear: 2024, condition: 'NM 9.4', purchasePrice: 12, purchaseCurrency: 'EUR', estValue: 40, notes: 'note privée', box: 'Boîte secrète', location: 'Boîte secrète', storeName: 'Boutique X', keyType: 'none', addedAt: '2026-01-01T00:00:00Z' }]);
          await wait(100);
          r.api = Object.isFrozen(C) && C.configured === false && C.publish().error === 'not_configured';
          const cp = C.copyOf('c39');
          r.whitelist = JSON.stringify(Object.keys(cp.copy).sort()) === JSON.stringify(['grade', 'issue', 'publisher', 'series', 'variant', 'volumeYear']) &&
            ['purchasePrice', 'estValue', 'notes', 'box', 'location', 'storeName'].every(k => cp.excluded.includes(k)) && !JSON.stringify(cp.copy).includes('secrète') && !JSON.stringify(cp.copy).includes('12');
          r.linkRefused = C.validate('voir https://exemple.test', 'public', [cp.copy]).ok === false;
          r.personalWarn = C.validate('écrivez à x@exemple.test', 'private', [cp.copy]).warnings.includes('adresse e-mail');
          r.extraFieldRefused = C.validate('x', 'private', [Object.assign({}, cp.copy, { price: 3 })]).ok === false;
          // Parcours dans l'interface : inspecteur → Partager… → brouillon
          const it = P.getPhysicalSingles()[0];
          C.share('c39');
          await wait(100);
          const dlg = document.getElementById('communityShareDialog');
          r.dialog = !!dlg && dlg.classList.contains('open') && /Jamais partagé/.test(dlg.textContent) && /purchasePrice/.test(dlg.querySelector('[data-excluded]').textContent) && !/Boîte secrète/.test(dlg.querySelector('[data-copied]').textContent);
          dlg.querySelector('[data-text]').value = 'Mon numéro préféré <img src=x onerror="window.__x39=1">';
          dlg.querySelector('[data-vis]').value = 'followers';
          dlg.querySelector('[data-save]').click();
          await wait(100);
          const ds = C.drafts();
          r.draftSaved = ds.length === 1 && ds[0].visibility === 'followers' && ds[0].status === 'draft' && !JSON.stringify(ds[0]).includes('note privée') && !dlg.classList.contains('open');
          document.getElementById('navSinglesCommunity').click();
          await wait(120);
          const cv = document.getElementById('communityDashboard');
          r.view = !document.getElementById('singlesCommunityView').hidden && /non configuré/.test(cv.textContent) && /T39 Série #4/.test(cv.textContent) && document.getElementById('badgeCommunityDrafts').textContent === '1';
          r.xss = !window.__x39 && !cv.querySelector('img[src="x"]');
          cv.querySelector('[data-draft-del]').click();
          await wait(80);
          r.removed = C.drafts().length === 0;
          const ub = document.querySelector('#toastPopup .toast-action');
          if (ub) { ub.click(); await wait(80); }
          r.undo = !!ub && C.drafts().length === 1;
          r.noNetwork = net === 0;
          r.collectionUntouched = JSON.stringify(P.getPhysicalSingles()[0]) === JSON.stringify(it);
          document.getElementById('navAllSingles').click();
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          window.fetch = f0; XMLHttpRequest.prototype.open = x0;
          const d = document.getElementById('communityShareDialog'); if (d) d.classList.remove('open');
          P.setPhysicalSingles(saved);
          if (prevRaw === null) localStorage.removeItem(CK); else localStorage.setItem(CK, prevRaw);
          await wait(200);
        }
        r.finalCollection = (await P.backup.fingerprint('collection')) === fpC;
        r.finalDrafts = localStorage.getItem(CK) === prevRaw;
        return r;
      })()`);
      console.log('Résultat Test 39:', JSON.stringify(t39));
      const t39keys = ['api', 'whitelist', 'linkRefused', 'personalWarn', 'extraFieldRefused', 'dialog', 'draftSaved', 'view', 'xss', 'removed', 'undo', 'noNetwork', 'collectionUntouched', 'finalCollection', 'finalDrafts'];
      const t39fail = t39keys.filter(k => !t39 || t39[k] !== true);
      if (t39fail.length) console.log('Test 39 — vérifications en échec :', t39fail.join(', '));
      testResults.push({
        test: 'Communauté : partage = copie en liste blanche (ni prix, valeur, emplacement, notes), liens et données personnelles contrôlés, brouillon local via l\'inspecteur, vue, XSS, retrait annulable, aucune requête ni publication',
        ok: t39fail.length === 0
      });

      // ─── Test 40 : Corbeille (D-36) — retrait copié avant suppression, restauration, purge confirmée seulement ───
      console.log('\n[TEST 40] Corbeille : retrait → corbeille, annulation, restauration depuis la fenêtre, purge exigeant confirmation...');
      const t40 = await evalExpr(`(async () => {
        const P = window.Panel, T = P.trash, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const TK = 'panel_trash_v1', prevRaw = localStorage.getItem(TK);
        const saved = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        const fpC = await P.backup.fingerprint('collection');
        const c0 = window.confirm;
        try {
          localStorage.removeItem(TK);
          const mk = (id, n) => ({ id, series: 'T40 Série', issue: '#' + n, publisher: 'Image Comics', variant: 'Cover A', addedAt: '2026-01-01T00:00:00Z' });
          P.setPhysicalSingles([mk('tr1', 1), mk('tr2', 2), mk('tr3', 3)]);
          await wait(100);
          r.api = Object.isFrozen(T) && typeof T.list === 'function' && T.purge('x').error === 'confirmation_required';
          P.removeSingleWithUndo(P.getPhysicalSingles().find(s => s.id === 'tr2'));
          r.removed = P.getPhysicalSingles().length === 2 && T.list().length === 1 && T.list()[0].item.id === 'tr2' && T.list()[0].index === 1;
          r.toast = /corbeille/.test((document.getElementById('toastPopup') || {}).textContent || '');
          r.count = !!document.getElementById('trashCount') && document.getElementById('trashCount').textContent === '1';
          const ub = document.querySelector('#toastPopup .toast-action');
          if (ub) ub.click();
          await wait(50);
          r.undo = !!ub && P.getPhysicalSingles().map(s => s.id).join() === 'tr1,tr2,tr3' && T.list().length === 0;
          P.removeSingleWithUndo(P.getPhysicalSingles().find(s => s.id === 'tr3'));
          P.removeSingleWithUndo(P.getPhysicalSingles().find(s => s.id === 'tr1'));
          r.kept = T.list().length === 2 && T.list()[0].item.id === 'tr1' && P.getPhysicalSingles().length === 1;
          document.getElementById('trashBtn').click();
          const dlg = document.getElementById('trashDialog');
          r.dialog = !!dlg && dlg.classList.contains('open') && dlg.querySelectorAll('[data-trash-restore]').length === 2;
          dlg.querySelector('[data-trash-restore="tr3"]').click();
          await wait(50);
          r.restored = P.getPhysicalSingles().some(s => s.id === 'tr3') && T.list().length === 1;
          window.confirm = () => false;
          document.getElementById('trashDialog').querySelector('[data-trash-purge="tr1"]').click();
          r.purgeCancelled = T.list().length === 1;
          window.confirm = () => true;
          document.getElementById('trashDialog').querySelector('[data-trash-purge="tr1"]').click();
          r.purged = T.list().length === 0 && !P.getPhysicalSingles().some(s => s.id === 'tr1');
          P.setPhysicalSingles([{ id: 'x40', series: '<img src=x onerror=window.__t40=1>', issue: '#1' }]);
          P.removeSingleWithUndo(P.getPhysicalSingles()[0]);
          T.open();
          await wait(50);
          r.xss = !document.querySelector('#trashDialog img') && !window.__t40;
          r.notFound = T.restore('absent').error === 'not_found';
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          window.confirm = c0;
          const d = document.getElementById('trashDialog'); if (d) d.classList.remove('open');
          P.setPhysicalSingles(saved);
          if (prevRaw === null) localStorage.removeItem(TK); else localStorage.setItem(TK, prevRaw);
          await wait(200);
        }
        r.finalCollection = (await P.backup.fingerprint('collection')) === fpC;
        r.finalTrash = localStorage.getItem(TK) === prevRaw;
        return r;
      })()`);
      console.log('Résultat Test 40:', JSON.stringify(t40));
      const t40keys = ['api', 'removed', 'toast', 'count', 'undo', 'kept', 'dialog', 'restored', 'purgeCancelled', 'purged', 'xss', 'notFound', 'finalCollection', 'finalTrash'];
      const t40fail = t40keys.filter(k => !t40 || t40[k] !== true);
      if (t40fail.length) console.log('Test 40 — vérifications en échec :', t40fail.join(', '));
      testResults.push({
        test: 'Corbeille : fiche copiée avant retrait, annulation, conservation après expiration du message, restauration depuis la fenêtre, purge seulement après confirmation, XSS, état restauré',
        ok: t40fail.length === 0
      });

      // ─── Test 41 : Calendrier « comics uniquement » (lot 4.6, D-37) — manga masqué, jamais supprimé ───
      console.log('\n[TEST 41] Calendrier : périmètre comics, manga masqué par défaut, réaffichable, données inchangées...');
      const t41 = await evalExpr(`(async () => {
        const P = window.Panel, Rl = P.releases, r = {};
        await Rl.ready();
        const before = JSON.stringify(Rl.all());
        r.predicate = Rl.outOfScope({ format: 'manga', publisher: 'Glénat' }) === true && Rl.outOfScope({ format: 'comic', publisher: 'Kana' }) === true &&
          Rl.outOfScope({ format: 'comic', publisher: 'Kurokawa' }) === true && Rl.outOfScope({ format: 'comic', publisher: 'Image Comics' }) === false && Rl.outOfScope(null) === false && Rl.outOfScope({ format: 'album', publisher: 'Dargaud' }) === true && Rl.outOfScope({ format: 'tpb', publisher: 'Urban Comics' }) === false;
        const base = { range: null, pullOnly: false, q: '', market: '', publisher: '', format: '', status: '' };
        const all = Rl.all(), outN = all.filter(p => Rl.outOfScope(p)).length;
        const masked = Rl.query(Object.assign({}, base, { includeOutOfScope: false }));
        const full = Rl.query(Object.assign({}, base, { includeOutOfScope: true }));
        r.masking = !masked.some(p => Rl.outOfScope(p)) && full.length === masked.length + outN && full.length === all.length;
        r.explicitManga = Rl.query(Object.assign({}, base, { format: 'manga' })).length === all.filter(p => p.format === 'manga').length;
        const cb = document.getElementById('releasesShowOutOfScope');
        r.control = !!cb && cb.checked === false;
        Rl.query(base);
        r.counter = document.getElementById('releasesOutOfScopeCount').textContent === String(outN);
        cb.checked = true;
        r.toggle = Rl.query(base).length === all.length;
        cb.checked = false;
        r.unchanged = JSON.stringify(Rl.all()) === before;
        r.outN = outN; r.total = all.length;
        return r;
      })()`);
      console.log('Résultat Test 41:', JSON.stringify(t41));
      const t41keys = ['predicate', 'masking', 'explicitManga', 'control', 'counter', 'toggle', 'unchanged'];
      const t41fail = t41keys.filter(k => !t41 || t41[k] !== true);
      if (t41fail.length) console.log('Test 41 — vérifications en échec :', t41fail.join(', '));
      testResults.push({
        test: 'Calendrier comics uniquement : manga et éditeurs manga masqués par défaut, compteur, case de réaffichage, filtre explicite, aucune donnée modifiée',
        ok: t41fail.length === 0
      });

      // ─── Test 42 : Sauvegardes par domaine — brouillons Communauté et corbeille (D-39) ───
      console.log('\n[TEST 42] Sauvegardes : domaine Communauté (brouillons revalidés), corbeille dans Collection, fusion, remplacement, annulation...');
      const t42 = await evalExpr(`(async () => {
        const P = window.Panel, B = P.backup, C = P.community, T = P.trash, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const CK = 'panel_community_drafts_v1', TK = 'panel_trash_v1';
        const prevC = localStorage.getItem(CK), prevT = localStorage.getItem(TK);
        const saved = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        const fp0 = await B.fingerprints();
        const clone = o => JSON.parse(JSON.stringify(o));
        try {
          localStorage.removeItem(CK); localStorage.removeItem(TK);
          r.provider = B.providers().some(p => p.id === 'community' && p.domain === 'community');
          const s1 = C.saveDraft({ text: 'Ma pile du mois', visibility: 'private', items: [{ series: 'T42', issue: '#1' }] });
          P.setPhysicalSingles([{ id: 't42a', series: 'T42 Série', issue: '#1' }, { id: 't42b', series: 'T42 Série', issue: '#2' }]);
          await wait(50);
          P.removeSingleWithUndo(P.getPhysicalSingles().find(s => s.id === 't42b'));
          const bk = await B.export({ domains: ['community', 'collection'] });
          r.exported = s1.ok && bk.sections.community.drafts.length === 1 && bk.manifest.community.count.drafts === 1 && Array.isArray(bk.sections.collection.trash) && bk.sections.collection.trash.length === 1;
          // Sauvegarde trafiquée : brouillon avec lien (compte neuf : refusé), identifiant hostile, champ privé dans un exemplaire
          const evil = clone(bk);
          evil.sections.community.drafts.push({ id: 'cd_lien', text: 'Voir https://exemple.test', visibility: 'public', items: [] });
          evil.sections.community.drafts.push({ id: '<x>', text: 'ok', visibility: 'private', items: [] });
          evil.sections.community.drafts.push({ id: 'cd_prix', text: 'Lot', visibility: 'private', items: [{ series: 'T42', issue: '#3', purchasePrice: 99, location: 'Boîte 1' }] });
          delete evil.manifest; // intégrité recalculée impossible : section non vérifiée mais lisible
          const vEvil = await B.validate(clone(Object.assign({}, bk, { sections: evil.sections })));
          const normC = vEvil.sections.community.norm;
          r.sanitized = !!normC && normC.drafts.length === 2 && !normC.drafts.some(d => d.id === 'cd_lien' || d.id === '<x>') &&
            !JSON.stringify(normC.drafts).includes('purchasePrice') && !JSON.stringify(normC.drafts).includes('Boîte 1') && normC.anomalies.length === 1;
          // Fusion dans un état vide
          localStorage.removeItem(CK); localStorage.removeItem(TK);
          const v = await B.validate(clone(bk));
          r.integrity = v.sections.community.integrity === 'vérifiée' && v.sections.community.countsOk === true;
          const m = await B.restore(v, { mode: 'merge', domains: ['community', 'collection'] });
          r.merged = m.ok === true && m.draftsSet === 1 && C.drafts().length === 1 && T.list().length === 1 && T.list()[0].item.id === 't42b';
          // Fusion répétée : idempotente
          const m2 = await B.restore(await B.validate(clone(bk)), { mode: 'merge', domains: ['community'] });
          r.idempotent = m2.ok === true && m2.draftsSet === 0 && C.drafts().length === 1;
          // Remplacement puis annulation exacte
          const before = localStorage.getItem(CK);
          C.saveDraft({ text: 'Autre brouillon', visibility: 'private', items: [] });
          const rawBefore = localStorage.getItem(CK);
          const rp = await B.restore(await B.validate(clone(bk)), { mode: 'replace', domains: ['community'] });
          r.replaced = rp.ok === true && C.drafts().length === 1 && rp.untouchedOk === true;
          r.undo = (await B.undo(rp.undoToken)) === true && localStorage.getItem(CK) === rawBefore && before !== rawBefore;
          r.noPublish = C.publish().error === 'not_configured';
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          P.setPhysicalSingles(saved);
          if (prevC === null) localStorage.removeItem(CK); else localStorage.setItem(CK, prevC);
          if (prevT === null) localStorage.removeItem(TK); else localStorage.setItem(TK, prevT);
          await wait(200);
        }
        const fp1 = await B.fingerprints();
        r.finalState = Object.keys(fp0).every(k => fp0[k] === fp1[k]);
        return r;
      })()`);
      console.log('Résultat Test 42:', JSON.stringify(t42));
      const t42keys = ['provider', 'exported', 'sanitized', 'integrity', 'merged', 'idempotent', 'replaced', 'undo', 'noPublish', 'finalState'];
      const t42fail = t42keys.filter(k => !t42 || t42[k] !== true);
      if (t42fail.length) console.log('Test 42 — vérifications en échec :', t42fail.join(', '));
      testResults.push({
        test: 'Sauvegardes : domaine Communauté (brouillons revalidés, liens et champs privés écartés), corbeille dans Collection, fusion idempotente, remplacement annulable, aucun autre domaine touché',
        ok: t42fail.length === 0
      });

      // ─── Test 43 : Visuels (D-40) — cartes illustrées, provenance, remplacement typographique, cache des échecs, compléments manuels ───
      console.log('\n[TEST 43] Visuels : résultats illustrés, pages d\'entité, provenance, remplacement sans image cassée, URL en échec non redemandée...');
      const t43 = await evalExpr(`(async () => {
        const P = window.Panel, M = P.media, X = P.explorer, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const RK = 'panel_media_refs_v1', FK = 'panel_media_failed_v1';
        const prevR = localStorage.getItem(RK), prevF = localStorage.getItem(FK);
        const saved = JSON.parse(JSON.stringify(P.getPhysicalSingles()));
        const fp0 = await P.backup.fingerprints();
        const BAD = 'https://127.0.0.1:9/t43-' + Date.now() + '.jpg';
        try {
          r.api = Object.isFrozen(M) && M.kinds().includes('event') && M.kinds().includes('character');
          const ph = decodeURIComponent(M.placeholder('character', 'Spider-Man'));
          r.placeholder = ph.startsWith('data:image/svg+xml') && ph.includes('PERSONNAGE') && ph.includes('VISUEL À COMPLÉTER') && !ph.includes('<script');
          r.refValidation = M.setRef('character', 'k', { url: 'http://x.test/a.jpg', source: 'S' }, { confirmed: true }).error === 'invalid_ref' &&
            M.setRef('character', 'k', { url: 'javascript:alert(1)', source: 'S' }, { confirmed: true }).error === 'invalid_ref' &&
            M.setRef('character', 'k', { url: 'https://x.test/a.jpg' }, { confirmed: true }).error === 'invalid_ref' &&
            M.setRef('character', 'k', { url: 'https://x.test/a.jpg', source: 'S' }).error === 'confirmation_required' &&
            M.setRef('nope', 'k', { url: 'https://x.test/a.jpg', source: 'S' }, { confirmed: true }).error === 'invalid_entity';
          await X.load();
          const guides = X.guides();
          r.guides = guides.map(g => g.title).slice(0, 8);
          await X.open('home');
          await wait(200);
          // Recherche : chaque résultat porte une vignette (visuel réel ou remplacement typographique), aucune image sans source d'affichage
          const s = document.getElementById('exSearch');
          s.value = guides[0].title.split(' ')[0];
          s.dispatchEvent(new Event('input', { bubbles: true }));
          await wait(600);
          const res = [...document.querySelectorAll('#explorerRoot .ex-res')];
          r.results = res.length;
          r.searchCards = res.length > 0 && res.every(b => b.dataset.hasMedia === '1' && b.querySelector('img.ex-res-thumb') && b.querySelector('img.ex-res-thumb').getAttribute('src'));
          r.lazy = res.every(b => b.querySelector('img').getAttribute('loading') === 'lazy');
          // Page de guide, puis page de personnage : visuel en tête, remplacement annoncé, bouton de complément
          await X.open('guide', (guides.find(g => g.id === 'gd_king_in_black') || guides[0]).id);
          await wait(200);
          const chip = document.querySelector('#explorerRoot [data-ex-go="character"]');
          r.hasCharacter = !!chip;
          if (chip) {
            const key = chip.dataset.exId, name = chip.textContent.trim();
            chip.click(); await wait(200);
            const img0 = document.querySelector('#explorerRoot .ex-phead-img');
            r.entityPlaceholder = !!img0 && img0.dataset.mediaPlaceholder === '1' && /^data:image\\/svg/.test(img0.getAttribute('src')) && !!document.querySelector('#explorerRoot .ex-media-edit');
            // Fenêtre de complément : confirmation exigée
            document.querySelector('#explorerRoot .ex-media-edit').click();
            const dlg = document.getElementById('exMediaDialog');
            dlg.querySelector('[data-m="url"]').value = BAD; dlg.querySelector('[data-m="source"]').value = 'Test 43';
            dlg.querySelector('[data-save]').click();
            r.dialogConfirm = dlg.classList.contains('open') && /confirmation/i.test(dlg.querySelector('[data-msg]').textContent) && M.ref('character', key) === null;
            dlg.querySelector('[data-m="confirm"]').checked = true;
            dlg.querySelector('[data-save]').click();
            await wait(100);
            const ref = M.ref('character', key);
            r.saved = !dlg.classList.contains('open') && !!ref && ref.url === BAD && ref.manual === true && ref.verified === false && ref.source === 'Test 43';
            const img1 = document.querySelector('#explorerRoot .ex-phead-img');
            // L'adresse locale échoue aussitôt : l'image peut déjà être remplacée ; le crédit (infobulle) et la balise générée portent la provenance
            const html = M.img({ url: 'https://exemple.test/couverture.jpg', source: 'Test 43', rights: 'CC BY' }, { alt: name, kind: 'character' });
            r.provenance = !!img1 && (img1.getAttribute('src') === BAD || img1.dataset.mediaDone === '1') && /Source : Test 43/.test(img1.title) && /non vérifié/.test(img1.title) && html.includes('https://exemple.test/couverture.jpg') && html.includes('loading="lazy"') && html.includes('Droits : CC BY');
            // Échec de chargement : remplacement immédiat, URL mémorisée, plus jamais redemandée
            img1.dispatchEvent(new Event('error'));
            await wait(50);
            r.fallback = /^data:image\\/svg/.test(img1.getAttribute('src')) && M.failed(BAD) === true;
            await X.open('character', key); await wait(150);
            const img2 = document.querySelector('#explorerRoot .ex-phead-img');
            r.notRefetched = !!img2 && img2.getAttribute('src') !== BAD && img2.dataset.mediaPlaceholder === '1';
            // Sauvegarde : visuels complétés dans le domaine Explorer
            const bk = await P.backup.export({ domains: ['explorer'] });
            r.backup = !!bk.sections.explorer.mediaRefs && !!bk.sections.explorer.mediaRefs['character:' + key];
            r.removed = M.removeRef('character', key).ok === true && M.ref('character', key) === null;
            r.entityName = name.length > 0;
          }
          // Collection : une couverture en échec n'est plus demandée, remplacement de couverture à la place
          P.setPhysicalSingles([{ id: 't43c', series: 'T43 Série', issue: '#1', coverUrl: BAD }]);
          document.getElementById('navAllSingles').click();
          await wait(300);
          const cimg = [...document.querySelectorAll('img')].find(i => (i.alt || '').includes('T43 Série'));
          r.collectionFallback = !!cimg && cimg.getAttribute('src') !== BAD && /^data:image\\/svg/.test(cimg.getAttribute('src'));
          r.noBrokenOnPage = [...document.querySelectorAll('#explorerRoot img, #singlesGrid img')].every(i => !!i.getAttribute('src'));
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          const d = document.getElementById('exMediaDialog'); if (d) d.classList.remove('open');
          P.setPhysicalSingles(saved);
          if (prevR === null) localStorage.removeItem(RK); else localStorage.setItem(RK, prevR);
          if (prevF === null) localStorage.removeItem(FK); else localStorage.setItem(FK, prevF);
          await wait(200);
        }
        const fp1 = await P.backup.fingerprints();
        r.finalState = Object.keys(fp0).every(k => fp0[k] === fp1[k]);
        return r;
      })()`);
      console.log('Résultat Test 43:', JSON.stringify(t43));
      const t43keys = ['api', 'placeholder', 'refValidation', 'searchCards', 'lazy', 'hasCharacter', 'entityPlaceholder', 'dialogConfirm', 'saved', 'provenance', 'fallback', 'notRefetched', 'backup', 'removed', 'collectionFallback', 'noBrokenOnPage', 'finalState'];
      const t43fail = t43keys.filter(k => !t43 || t43[k] !== true);
      if (t43fail.length) console.log('Test 43 — vérifications en échec :', t43fail.join(', '));
      testResults.push({
        test: 'Visuels : résultats de recherche illustrés, pages d\'entité avec visuel ou remplacement annoncé, complément manuel sourcé et confirmé, crédit affiché, échec mémorisé sans nouvelle requête, couverture de Collection, sauvegarde',
        ok: t43fail.length === 0
      });

      // ─── Test 44 : Navigation générale (lot 4.9, D-42) et cas limites du périmètre comics (D-41) ───
      console.log('\n[TEST 44] Navigation : section Explorer, Sorties & calendrier, Pull List, barre mobile à cinq boutons ; cas limites M1 à M4...');
      const t44 = await evalExpr(`(async () => {
        const P = window.Panel, Rl = P.releases, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const cb = document.getElementById('releasesPullOnly'), cb0 = cb ? cb.checked : false;
        try {
          // Cas limites
          const o = (format, publisher) => Rl.scopeReason({ format, publisher });
          r.m1 = o('album', 'Dargaud') === 'bd' && o('album', 'Dupuis') === 'bd' && o('album', 'Casterman') === 'bd' && o('album', 'Urban Comics') === null && o('tpb', 'Panini Comics') === null && o('album', 'Les Humanoïdes Associés') === null;
          r.m2 = o('other', 'Delitoon') === 'manhwa' && o('tpb', 'Ize Press') === 'manhwa' && o('other', 'Webtoon') === 'manhwa';
          r.m3 = o('manga', 'Glénat') === 'manga' && o('manga', 'Ankama') === 'manga' && o('tpb', 'Seven Seas') === 'manga';
          r.m4 = o('single', 'IDW Publishing') === null && o('single', 'Dark Horse') === null && o('tpb', 'Glénat') === null && o('tpb', 'Delcourt') === null;
          r.rules = Rl.scopeRules().map(x => x.id).join() === 'manga,manhwa,bd';
          // Navigation
          const explorerLbl = document.getElementById('navExplorerLabel');
          const btns = [...document.querySelectorAll('#navSinglesBlock .nav-btn')].map(b => b.id);
          r.explorerSection = !!explorerLbl && btns.indexOf('navExplorer') < btns.indexOf('navAllSingles') && btns.indexOf('navSinglesReleases') < btns.indexOf('navAllSingles') && btns.includes('navSinglesPullList');
          r.labels = /Accueil Explorer/.test(document.getElementById('navExplorer').textContent) && /Sorties/.test(document.getElementById('navSinglesReleases').textContent) && /Pull List/.test(document.getElementById('navSinglesPullList').textContent);
          r.badgeOnPullList = !!document.querySelector('#navSinglesPullList #badgePullCount') && !document.querySelector('#navSinglesReleases .nav-badge');
          document.getElementById('navSinglesPullList').click(); await wait(150);
          r.pullListView = !document.getElementById('singlesReleasesView').hidden && cb.checked === true && document.getElementById('navSinglesPullList').classList.contains('active') && !document.getElementById('navSinglesReleases').classList.contains('active');
          document.getElementById('navSinglesReleases').click(); await wait(150);
          r.releasesView = !document.getElementById('singlesReleasesView').hidden && cb.checked === false && document.getElementById('navSinglesReleases').classList.contains('active');
          document.getElementById('navExplorer').click(); await wait(300);
          r.explorerView = !document.getElementById('singlesExplorerView').hidden && document.getElementById('navExplorer').classList.contains('active');
          const dock = [...document.querySelectorAll('.mobile-dock .mobile-dock-btn')].map(b => b.id);
          r.dock = dock.join() === 'mobSingles,mobSeries,mobScan,mobCommunity,mobExplorer';
          r.dockActive = document.getElementById('mobExplorer').classList.contains('active');
          document.getElementById('navAllSingles').click(); await wait(150);
          r.backToCollection = !document.getElementById('singlesCollectionView').hidden && !document.getElementById('mobExplorer').classList.contains('active');
          // Liens profonds conservés
          r.deepLink = (await P.explorer.open('home')) === 'home';
          document.getElementById('navAllSingles').click(); await wait(100);
        } catch (e) { r.error = String(e && e.message || e); }
        finally { if (cb && cb.checked !== cb0) { cb.checked = cb0; if (cb.onchange) cb.onchange(); } }
        return r;
      })()`);
      // Barre mobile à 375 px : cinq cibles d'au moins 44 px, aucune ne déborde
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
      await new Promise(res => setTimeout(res, 400));
      const t44m = await evalExpr(`(() => { const bs = [...document.querySelectorAll('.mobile-dock .mobile-dock-btn')]; const rs = bs.map(b => b.getBoundingClientRect()); return { n: bs.length, visible: getComputedStyle(document.querySelector('.mobile-dock')).display !== 'none', minW: Math.min(...rs.map(x => x.width)), minH: Math.min(...rs.map(x => x.height)), inside: rs.every(x => x.left >= 0 && x.right <= window.innerWidth + 0.5), overflow: document.documentElement.scrollWidth <= window.innerWidth + 1 }; })()`);
      await send('Emulation.clearDeviceMetricsOverride', {});
      t44.mobile375 = !!t44m && t44m.n === 5 && t44m.visible && t44m.minW >= 44 && t44m.minH >= 44 && t44m.inside;
      console.log('Résultat Test 44:', JSON.stringify(t44), JSON.stringify(t44m));
      const t44keys = ['m1', 'm2', 'm3', 'm4', 'rules', 'explorerSection', 'labels', 'badgeOnPullList', 'pullListView', 'releasesView', 'explorerView', 'dock', 'dockActive', 'backToCollection', 'deepLink', 'mobile375'];
      const t44fail = t44keys.filter(k => !t44 || t44[k] !== true);
      if (t44fail.length) console.log('Test 44 — vérifications en échec :', t44fail.join(', '));
      testResults.push({
        test: 'Navigation 4.9 : section Explorer (accueil, sorties), Pull List avec son badge, vues et entrée active cohérentes, barre mobile à cinq boutons utilisable à 375 px, liens profonds ; cas limites M1 à M4',
        ok: t44fail.length === 0
      });

      // ─── Test 45 : Centre des conflits (lot 3.5, D-43) — notes de lecture à rapprocher, sources du calendrier, synchronisation ───
      console.log('\n[TEST 45] Centre des conflits : compteur, rapprochement d\'une note annulable, lien vers les conflits de sources, état restauré...');
      const t45 = await evalExpr(`(async () => {
        const P = window.Panel, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const RK = 'panel_reading_v1', prev = localStorage.getItem(RK);
        try {
          r.api = Object.isFrozen(P.conflicts) && typeof P.conflicts.counts === 'function';
          const base = P.conflicts.counts();
          const d = prev ? JSON.parse(prev) : { version: 1, states: {}, log: [], conflicts: {} };
          d.states['loc:t45 serie#1@'] = { workKey: 'loc:t45 serie#1@', series: 'T45 Série', issue: '#1', status: 'read', rating: 4, updatedAt: '2026-01-01T00:00:00Z' };
          d.conflicts['loc:t45 serie#1@'] = { kind: 'rating', candidates: [{ rating: 4 }, { rating: 2 }], chosen: 4, at: '2026-01-01T00:00:00Z', resolved: false };
          localStorage.setItem(RK, JSON.stringify(d));
          document.getElementById('navAllSingles').click(); await wait(100);
          const c1 = P.conflicts.counts();
          r.count = c1.reading === base.reading + 1 && document.getElementById('conflictCount').textContent === String(c1.total);
          document.getElementById('conflictsBtn').click();
          const dlg = document.getElementById('conflictCenterDialog');
          r.dialog = !!dlg && dlg.classList.contains('open') && !!dlg.querySelector('[data-rd-pick="loc:t45 serie#1@"][data-rating="2"]') && /Synchronisation non configurée/.test(dlg.textContent);
          dlg.querySelector('[data-rd-pick="loc:t45 serie#1@"][data-rating="2"]').click();
          await wait(50);
          const after = JSON.parse(localStorage.getItem(RK));
          r.resolved = after.states['loc:t45 serie#1@'].rating === 2 && after.conflicts['loc:t45 serie#1@'].resolved === true && P.conflicts.counts().reading === base.reading;
          r.logged = after.log.some(l => l.workKey === 'loc:t45 serie#1@' && l.kind === 'rating' || (l.workKey === 'loc:t45 serie#1@' && /rating/.test(JSON.stringify(l))));
          const ub = document.querySelector('#toastPopup .toast-action');
          if (ub) ub.click();
          await wait(50);
          const undone = JSON.parse(localStorage.getItem(RK));
          r.undo = !!ub && undone.states['loc:t45 serie#1@'].rating === 4 && undone.conflicts['loc:t45 serie#1@'].resolved === false;
          r.releasesLink = P.conflicts.counts().releases === 0 || !!document.querySelector('#conflictCenterDialog [data-open-conflicts]');
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          const dl = document.getElementById('conflictCenterDialog'); if (dl) dl.classList.remove('open');
          if (prev === null) localStorage.removeItem(RK); else localStorage.setItem(RK, prev);
          document.getElementById('navAllSingles').click(); await wait(100);
        }
        r.finalState = localStorage.getItem(RK) === prev;
        return r;
      })()`);
      console.log('Résultat Test 45:', JSON.stringify(t45));
      const t45keys = ['api', 'count', 'dialog', 'resolved', 'logged', 'undo', 'releasesLink', 'finalState'];
      const t45fail = t45keys.filter(k => !t45 || t45[k] !== true);
      if (t45fail.length) console.log('Test 45 — vérifications en échec :', t45fail.join(', '));
      testResults.push({
        test: 'Centre des conflits : compteur dans la barre latérale, note de lecture rapprochée et journalisée, annulation exacte, lien vers les conflits de sources, synchronisation annoncée non configurée',
        ok: t45fail.length === 0
      });

      // ─── Test 46 : Communauté C-0 (D-46) — aperçu de l'envoi CommunityPublish.v1, consentement explicite, rien n'est envoyé ───
      console.log('\n[TEST 46] Communauté : aperçu de l\'envoi, consentement, enveloppe filtrée, aucune requête réseau...');
      const t46 = await evalExpr(`(async () => {
        const P = window.Panel, r = {};
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const CK = 'panel_community_drafts_v1', prev = localStorage.getItem(CK);
        const fetches = []; const of = window.fetch; window.fetch = function (u) { fetches.push(String(u)); return of.apply(this, arguments); };
        try {
          const s = P.community.saveDraft({ text: 'Test 46 pile du mois', visibility: 'public', items: [{ series: 'T46 Saga', issue: '#1', grade: 'NM' }] });
          r.saved = s.ok === true;
          const no = P.community.preview(s.id, false);
          r.needsConsent = no.ok === false && no.errors.some(e => /consentement/.test(e));
          const yes = P.community.preview(s.id, true);
          r.envelope = yes.ok === true && yes.envelope.contract === 'CommunityPublish.v1' && yes.envelope.revocable === true && yes.envelope.items[0].series === 'T46 Saga' && !('price' in yes.envelope.items[0]);
          r.contractOk = window.PanelDomains.communityPolicy.validatePublish(yes.envelope).ok === true;
          document.querySelector('[data-sview="community"]').click(); await wait(100);
          const btn = document.querySelector('[data-draft-preview="' + s.id + '"]');
          r.button = !!btn;
          btn.click(); await wait(50);
          const dlg = document.getElementById('communityPreviewDialog');
          const pre = dlg.querySelector('[data-envelope]');
          r.dialogNoConsent = dlg.classList.contains('open') && /consentement/.test(pre.textContent) && dlg.querySelector('[data-publish]').disabled;
          const cb = dlg.querySelector('[data-consent]'); cb.checked = true; cb.dispatchEvent(new Event('change'));
          r.dialogEnvelope = /CommunityPublish\.v1/.test(pre.textContent) && /T46 Saga/.test(pre.textContent) && /rien n.est envoyé/.test(dlg.textContent);
          dlg.querySelector('[data-close]').click();
          r.publishBlocked = P.community.publish().error === 'not_configured';
          r.noNetwork = fetches.length === 0;
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          window.fetch = of;
          const dl = document.getElementById('communityPreviewDialog'); if (dl) dl.classList.remove('open');
          if (prev === null) localStorage.removeItem(CK); else localStorage.setItem(CK, prev);
          document.getElementById('navAllSingles').click(); await wait(100);
        }
        r.finalState = localStorage.getItem(CK) === prev;
        return r;
      })()`);
      console.log('Résultat Test 46:', JSON.stringify(t46));
      const t46keys = ['saved', 'needsConsent', 'envelope', 'contractOk', 'button', 'dialogNoConsent', 'dialogEnvelope', 'publishBlocked', 'noNetwork', 'finalState'];
      const t46fail = t46keys.filter(k => !t46 || t46[k] !== true);
      if (t46fail.length) console.log('Test 46 — vérifications en échec :', t46fail.join(', '));
      testResults.push({
        test: 'Communauté C-0 : aperçu exact de l\'envoi (CommunityPublish.v1), consentement explicite exigé, copie filtrée, publication bloquée sans service, aucune requête réseau',
        ok: t46fail.length === 0
      });

      // ─── Test 47 : Explorer 4.9 (D-47) — filtre des résultats par éditeur, totaux exacts, réinitialisation ───
      console.log('\n[TEST 47] Explorer : filtre des résultats par éditeur...');
      const t47 = await evalExpr(`(async () => {
        const r = {}; const wait = ms => new Promise(res => setTimeout(res, ms));
        const hist = localStorage.getItem('panel_explorer_recent');
        try {
          document.getElementById('navExplorer').click(); await wait(150);
          const s = document.getElementById('exSearch');
          const run = async q => { s.value = q; s.dispatchEvent(new Event('input', { bubbles: true })); await wait(300); };
          let found = '';
          for (const q of ['marvel', 'comics', 'a', 'e', 'man', 'the', 'i']) { await run(q); const sel = document.querySelector('[data-ex-rpub]'); if (sel && sel.options.length >= 3) { found = q; break; } }
          r.select = !!found;
          if (found) {
            const total = () => [...document.querySelectorAll('.ex-res-group h4 small')].reduce((a, x) => a + Number(x.textContent), 0);
            const before = total();
            const sel = document.querySelector('[data-ex-rpub]');
            const pick = sel.options[1].value;
            sel.value = pick; sel.dispatchEvent(new Event('change', { bubbles: true })); await wait(150);
            const after = total();
            const heads = [...document.querySelectorAll('.ex-res-group h4')].map(x => x.firstChild.textContent.trim());
            r.filtered = after > 0 && after <= before && document.querySelector('[data-ex-rpub]').value === pick;
            r.noUnpublished = !heads.some(x => x === 'Personnages' || x === 'Créateurs');
            r.labelled = document.querySelector('[data-ex-rpub]').getAttribute('aria-label') === 'Filtrer les résultats par éditeur';
            await run(found + ' ');
            r.reset = !document.querySelector('[data-ex-rpub]') || document.querySelector('[data-ex-rpub]').value === '';
          }
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          if (hist === null) localStorage.removeItem('panel_explorer_recent'); else localStorage.setItem('panel_explorer_recent', hist);
          document.getElementById('navAllSingles').click(); await wait(100);
        }
        return r;
      })()`);
      console.log('Résultat Test 47:', JSON.stringify(t47));
      const t47keys = ['select', 'filtered', 'noUnpublished', 'labelled', 'reset'];
      const t47fail = t47keys.filter(k => !t47 || t47[k] !== true);
      if (t47fail.length) console.log('Test 47 — vérifications en échec :', t47fail.join(', '));
      testResults.push({ test: 'Explorer 4.9 : filtre des résultats par éditeur (avant la limite, totaux exacts), catégories sans éditeur masquées, libellé accessible, réinitialisé à la nouvelle recherche', ok: t47fail.length === 0 });

      console.log('\n[TEST 48] Fiche événement : série principale, tie-ins, chronologie, ordres distincts, aucun visuel inventé...');
      const t48 = await evalExpr(`(async () => {
        const r = {}; const wait = ms => new Promise(res => setTimeout(res, ms));
        try {
          document.getElementById('navExplorer').click(); await wait(200);
          const sec = document.getElementById('exSecEvents');
          r.homeSection = !!sec && /Marvel/.test(sec.textContent) && /DC/.test(sec.textContent) && sec.querySelectorAll('.ex-gcard').length >= 9;
          const card = sec && sec.querySelector('[data-ex-guide="gd_civil_war"]');
          r.cardFacts = !!card && /7 numéro\\(s\\) principaux/.test(card.textContent);
          card.click(); await wait(200);
          const ev = document.getElementById('exEventSheet');
          r.sheet = !!ev;
          r.mainIssues = ev.querySelectorAll('.ex-iss-grid .ex-iss').length === 7;
          r.tieIns = [...ev.querySelectorAll('.ex-ev-group h4')].some(x => /Tie-in/i.test(x.textContent));
          r.sourced = ev.querySelectorAll('.ex-src-ref').length > 0;
          r.ordersDistinct = /non documenté/.test(ev.querySelector('.ex-ev-orders').textContent) && ev.querySelectorAll('.ex-ev-orders li').length === 4;
          r.timelineCited = ev.querySelectorAll('.ex-timeline li').length >= 2;
          r.noInventedImg = [...ev.querySelectorAll('img')].every(i => !i.src || i.src.startsWith('https:') || i.src.startsWith('data:'));
          r.noGalleryNote = !!ev.querySelector('[data-ex-nogallery]');
          r.noOverflow = document.documentElement.scrollWidth <= window.innerWidth + 1;
          // King in Black : seed complété (5 numéros, sources conservées)
          document.querySelector('.ex-back').click(); await wait(150);
          document.querySelector('#exSecEvents [data-ex-guide="gd_king_in_black"]').click(); await wait(200);
          r.kib = document.querySelectorAll('#exEventSheet .ex-iss-grid .ex-iss').length === 5;
        } catch (e) { r.error = String(e && e.message || e); }
        finally { document.getElementById('navAllSingles').click(); await wait(100); }
        return r;
      })()`);
      console.log('Résultat Test 48:', JSON.stringify(t48));
      const t48keys = ['homeSection', 'cardFacts', 'sheet', 'mainIssues', 'tieIns', 'sourced', 'ordersDistinct', 'timelineCited', 'noInventedImg', 'noGalleryNote', 'noOverflow', 'kib'];
      const t48fail = t48keys.filter(k => !t48 || t48[k] !== true);
      if (t48fail.length) console.log('Test 48 — vérifications en échec :', t48fail.join(', '));
      testResults.push({ test: 'Fiche événement : section Marvel/DC, série principale, tie-ins sourcés, chronologie sur dates citées, trois ordres distincts, aucun visuel inventé, King in Black complété', ok: t48fail.length === 0 });

      console.log('\n[TEST 49] Fiche numéro et recherche illustrée (numéros, filtre éditeur)...');
      const t49 = await evalExpr(`(async () => {
        const r = {}; const wait = ms => new Promise(res => setTimeout(res, ms));
        const hist = localStorage.getItem('panel_explorer_recent');
        try {
          document.getElementById('navExplorer').click(); await wait(150);
          if (document.querySelector('#explorerRoot .ex-back')) { document.querySelector('#explorerRoot .ex-back').click(); await wait(150); }
          document.querySelector('#exSecEvents [data-ex-guide="gd_civil_war"]').click(); await wait(200);
          document.querySelector('#exEventSheet .ex-iss').click(); await wait(200);
          const head = document.querySelector('.ex-issue-head');
          r.issuePage = !!head && /Civil War.*#1/.test(head.querySelector('h2').textContent);
          r.statusMissing = head.querySelector('[data-issue-status]').dataset.issueStatus === 'unavailable';
          r.appearsIn = [...document.querySelectorAll('.ex-ev-links li')].some(li => /Civil War/.test(li.textContent) && /Série principale/.test(li.textContent));
          r.editBtn = !!head.querySelector('[data-ex-media="issue"]');
          document.querySelector('.ex-back').click(); await wait(150);
          const s = document.getElementById('exSearch');
          s.value = 'blackest night'; s.dispatchEvent(new Event('input', { bubbles: true })); await wait(350);
          const groups = [...document.querySelectorAll('.ex-res-group h4')].map(x => x.firstChild.textContent.trim());
          r.issuesGroup = groups.includes('Numéros');
          r.eventFacts = !!document.querySelector('[data-ev-facts]');
          const sel = document.querySelector('[data-ex-rpub]');
          if (sel && [...sel.options].some(o => o.value === 'DC')) { sel.value = 'DC'; sel.dispatchEvent(new Event('change', { bubbles: true })); await wait(150); }
          r.filterKeepsIssues = [...document.querySelectorAll('.ex-res-group h4')].some(x => x.firstChild.textContent.trim() === 'Numéros');
          s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); await wait(250);
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          if (hist === null) localStorage.removeItem('panel_explorer_recent'); else localStorage.setItem('panel_explorer_recent', hist);
          document.getElementById('navAllSingles').click(); await wait(100);
        }
        return r;
      })()`);
      console.log('Résultat Test 49:', JSON.stringify(t49));
      const t49keys = ['issuePage', 'statusMissing', 'appearsIn', 'editBtn', 'issuesGroup', 'eventFacts', 'filterKeepsIssues'];
      const t49fail = t49keys.filter(k => !t49 || t49[k] !== true);
      if (t49fail.length) console.log('Test 49 — vérifications en échec :', t49fail.join(', '));
      testResults.push({ test: 'Fiche numéro (visuel indisponible signalé, événements et relation) et recherche : catégorie Numéros, faits des événements, filtre éditeur', ok: t49fail.length === 0 });

      console.log('\n[TEST 50] Outil de complétion et visionneuse : association FICTIVE, audit, confirmation, retrait annulable, clavier...');
      const t50p = evalExpr(`(async () => {
        const r = {}; const wait = () => Promise.resolve(); // rendus synchrones : pas de minuteries enchaînées (freinées dans un onglet caché)
        const refsRaw = localStorage.getItem('panel_media_refs_v1'), failRaw = localStorage.getItem('panel_media_failed_v1');
        try {
          const M = window.Panel.media;
          const key = M.issueIndex().find(x => x.series === 'Civil War' && x.issue === '2').key;
          // Fixture FICTIVE : domaine réservé exemple.test, jamais une vraie couverture
          const set = M.setRef('issue', key, { url: 'https://exemple.test/fx-civil-war-2.jpg', source: 'Fixture de test', visualType: 'cover' }, { confirmed: true });
          r.set = !!set.ok && M.ref('issue', key).verification === 'unverified' && /non vérifié/.test(M.credit(M.ref('issue', key)));
          document.getElementById('navExplorer').click(); await wait(150);
          if (document.querySelector('#explorerRoot .ex-back')) { document.querySelector('#explorerRoot .ex-back').click(); await wait(150); }
          document.querySelector('#exSecEvents [data-ex-guide="gd_civil_war"]').click(); await wait(150);
          const item = document.querySelector('#exEventSheet .ex-gal-item');
          r.gallery = !!item && /Série principale/.test(item.textContent);
          item.click(); await wait(100);
          const lb = document.getElementById('exLightbox');
          r.lightbox = !!lb && lb.classList.contains('open') && lb.querySelector('[role="dialog"][aria-modal="true"]') !== null;
          r.lbMeta = /Fixture de test/.test(lb.textContent) && /Couverture principale/.test(lb.textContent) && /non vérifié/.test(lb.querySelector('[data-lb-status]').textContent);
          lb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(50);
          r.lbEscape = !lb.classList.contains('open');
          document.querySelector('#explorerRoot .ex-back').click(); await wait(150);
          document.querySelector('#exSecEvents [data-ex-go="visuals"]').click(); await wait(150);
          const row = document.querySelector('[data-audit="issue:' + key + '"]');
          r.audit = !!row && /Non vérifié/.test(row.textContent);
          row.querySelector('[data-v="user_confirmed"]').click(); await wait(100);
          r.confirmed = M.ref('issue', key).verification === 'user_confirmed';
          document.querySelector('[data-audit="issue:' + key + '"] [data-ex-vremove]').click(); await wait(100);
          r.removed = M.ref('issue', key) === null;
          const undo = [...document.querySelectorAll('button')].find(b => b.textContent === 'Annuler' && b.offsetParent !== null);
          if (undo) { undo.click(); await wait(100); }
          r.undo = !!M.ref('issue', key);
          r.missingList = document.querySelectorAll('#exVisualsMissing .ex-missing li').length > 0;
          const vk = document.querySelector('[data-ex-vkind]'); vk.value = 'event'; vk.dispatchEvent(new Event('change', { bubbles: true })); await wait(100);
          r.kindFilter = [...document.querySelectorAll('#exVisualsMissing .ex-missing li span')].every(s => /^Événement/.test(s.textContent));
          r.providers = M.providers().filter(p => p.enabled).map(p => p.id).sort().join(',') === 'manual,panel_local';
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          if (refsRaw === null) localStorage.removeItem('panel_media_refs_v1'); else localStorage.setItem('panel_media_refs_v1', refsRaw);
          if (failRaw === null) localStorage.removeItem('panel_media_failed_v1'); else localStorage.setItem('panel_media_failed_v1', failRaw);
          const lb = document.getElementById('exLightbox'); if (lb) lb.classList.remove('open');
          document.getElementById('navAllSingles').click(); await wait(100);
        }
        return r;
      })()`);
      const t50 = await Promise.race([t50p, new Promise(res => setTimeout(() => res({ timeout: true }), 60000))]);
            console.log('Résultat Test 50:', JSON.stringify(t50));
      const t50keys = ['set', 'gallery', 'lightbox', 'lbMeta', 'lbEscape', 'audit', 'confirmed', 'removed', 'undo', 'missingList', 'kindFilter', 'providers'];
      const t50fail = t50keys.filter(k => !t50 || t50[k] !== true);
      if (t50fail.length) console.log('Test 50 — vérifications en échec :', t50fail.join(', '));
      testResults.push({ test: 'Complétion des visuels (fixture fictive) : galerie, visionneuse accessible (Échap), audit, confirmation, retrait annulable, filtre par type, fournisseurs réseau inactifs', ok: t50fail.length === 0 });

      console.log('\n[TEST 51] Recoupement documentaire : sources multiples, divergences conservées, qualité affichée...');
      const t51 = await Promise.race([evalExpr(`(async () => {
        const r = {}; const wait = () => Promise.resolve();
        try {
          document.getElementById('navExplorer').click(); await wait();
          if (document.querySelector('#explorerRoot .ex-back')) { document.querySelector('#explorerRoot .ex-back').click(); await wait(); }
          document.querySelector('#exSecEvents [data-ex-guide="gd_crisis_infinite_earths"]').click(); await wait();
          const q = document.getElementById('exEventQuality');
          r.section = !!q;
          r.threeSources = /Sources consultées \\(4\\)/.test(q.textContent) && q.querySelectorAll('a[href^="https://"]').length >= 4 && !!q.querySelector('[data-src-kind="bibliographic"]');
          const n = s => Number(q.querySelector(s).textContent);
          r.counts = n('[data-cc-concordant]') > 0 && n('[data-cc-partial]') > 0 && n('[data-cc-corroborated]') === 0 && !!q.querySelector('[data-cc-independence]');
          r.divergences = q.querySelectorAll('[data-ex-divergences] li').length >= 2 && [...q.querySelectorAll('[data-ex-divergences] [data-div-kind]')].every(b => b.dataset.divKind) && !!q.querySelector('[data-div-explained]');
          r.verification = !!q.querySelector('[data-cv-main] [data-cv="verified"]') && /pas le rattachement/.test(q.querySelector('[data-cv-main]').textContent) && q.querySelectorAll('[data-cc-item] [data-cc-level]').length > 0;
          r.badge = document.querySelectorAll('#exEventSheet [data-ex-divergent]').length > 0;
          r.notExhaustive = /Aucune liste n'est présentée comme exhaustive/.test(q.textContent);
          r.noGuideOrder = !document.querySelector('#exEventSheet .ex-ev-links .ex-b') || ![...document.querySelectorAll('#exEventSheet .ex-ev-links .ex-b')].some(b => /Position de lecture/.test(b.textContent));
          document.querySelector('#explorerRoot .ex-back').click(); await wait();
          document.querySelector('#exSecEvents [data-ex-guide="gd_secret_wars_1984"]').click(); await wait();
          const q2 = document.getElementById('exEventQuality');
          r.singleSourceHonest = !!q2 && /Sources consultées \\(2\\)/.test(q2.textContent) && /source unique/.test(q2.textContent) && Number(q2.querySelector('[data-cc-concordant]').textContent) === 0;
          document.querySelector('#explorerRoot .ex-back').click(); await wait();
          document.querySelector('#exSecEvents [data-ex-guide="gd_infinite_crisis"]').click(); await wait();
          const q3 = document.getElementById('exEventQuality');
          r.priorityCases = [...q3.querySelectorAll('[data-ex-divergences] li')].some(li => /Superman #712/.test(li.textContent) && li.querySelector('[data-div-kind="explained"]') && /Superman #659/.test(li.textContent)) && /Battle for Blüdhaven/.test(q3.querySelector('[data-ex-uncertain]').textContent);
          document.querySelector('#explorerRoot .ex-back').click(); await wait();
          document.querySelector('#exSecEvents [data-ex-guide="gd_blackest_night"]').click(); await wait();
          r.mainGap = !!document.querySelector('#exEventQuality [data-cv-main] [data-cv="gap"]') && /#0/.test(document.querySelector('#exEventQuality [data-cv-main]').textContent);
          r.noCoverInvented = [...document.querySelectorAll('#exEventSheet img')].every(i => !i.src || i.src.startsWith('data:') || i.closest('.is-fallback'));
        } catch (e) { r.error = String(e && e.message || e); }
        finally { document.getElementById('navAllSingles').click(); }
        return r;
      })()`), new Promise(res => setTimeout(() => res({ timeout: true }), 60000))]);
      console.log('Résultat Test 51:', JSON.stringify(t51));
      const t51keys = ['section', 'threeSources', 'counts', 'divergences', 'verification', 'badge', 'notExhaustive', 'noGuideOrder', 'singleSourceHonest', 'priorityCases', 'mainGap', 'noCoverInvented'];
      const t51fail = t51keys.filter(k => !t51 || t51[k] !== true);
      if (t51fail.length) console.log('Test 51 — vérifications en échec :', t51fail.join(', '));
      testResults.push({ test: 'Fiabilité : sources dont une bibliographique, concordance distincte de corroboration, écarts qualifiés et expliqués, vérification de la série principale (et écart Blackest Night #0), cas Superman #712 et Crisis Aftermath expliqués, aucune couverture inventée', ok: t51fail.length === 0 });

      // ─── Test 52 : Catalogue commun de publications (R1, D-55) ───
      console.log('\n[TEST 52] Catalogue commun : une identité partagée par Collection, Sorties et Explorer, sans modifier les fiches...');
      const t52 = await Promise.race([evalExpr(`(async () => {
        const P = window.Panel, C = P.publications, r = {};
        try {
          await P.releases.ready(); r.ready = await C.ready();
          const singlesBefore = localStorage.getItem('panel_physical_singles'), relBefore = JSON.stringify(P.releases.all());
          const rep = await C.rebuild(); const st = await C.stats();
          r.built = !!rep && st.issues > 0 && st.refs > 0;
          r.legacyUntouched = localStorage.getItem('panel_physical_singles') === singlesBefore && JSON.stringify(P.releases.all()) === relBefore;
          const singles = JSON.parse(singlesBefore || '[]').filter(s => s && s.id && s.series && s.issue);
          const lk = singles.length ? await C.lookup('collection', singles[0].id) : null;
          r.collection = !singles.length || !!(lk && /^pub_i_/.test(lk.issueId));
          const idx = P.media.issueIndex(); const ek = idx[0] && await C.lookup('explorer', idx[0].key);
          r.explorer = !!(ek && /^pub_i_/.test(ek.issueId));
          const rel = P.releases.all().find(p => !P.releases.outOfScope(p) && p.issue);
          const rk = rel ? await C.lookup('release', rel.id) : null;
          r.release = !rel || !!(rk && (rk.issueId || rk.editionId));
          // Idempotence : deuxième reconstruction sans création
          const rep2 = await C.rebuild(), st2 = await C.stats();
          r.idempotent = st2.issues === st.issues && st2.series === st.series && rep2.collection.created + rep2.release.created + rep2.explorer.created === 0;
          // Garde-fou manga (D-54) : aucune nouvelle publication manga, rien n'est ajouté
          const n0 = P.releases.all().length;
          const m = await P.releases.upsert({ series: 'Fixture Manga R1', issue: '1', format: 'manga', publisher: 'Fixture' }, { source: 'test' });
          r.mangaBlocked = !!m && m.action === 'rejected' && m.outOfScope === true && P.releases.all().length === n0;
          // Sauvegarde : l'index commun voyage dans la section Explorer
          const b = await P.backup.export({ domains: ['explorer'] });
          const pc = b.sections.explorer.publicationCatalog;
          r.backup = !!(pc && pc.format === 'panel-publications' && Object.keys(pc.refs).length === st2.refs);
          // Retour arrière (index seul) puis reconstruction : mêmes identifiants (déterministes), fiches intactes
          const before = singles.length ? await C.lookup('collection', singles[0].id) : null;
          await C.rollback(); r.rolledBack = (await C.stats()).refs === 0;
          await C.rebuild(); const after = singles.length ? await C.lookup('collection', singles[0].id) : null;
          r.reversible = (!before || (!!after && after.issueId === before.issueId)) && localStorage.getItem('panel_physical_singles') === singlesBefore;
          // Interface : « Dans Panel » dans l'inspecteur de Collection et sur la fiche numéro d'Explorer ; écran du catalogue commun
          const wait = ms => new Promise(res => setTimeout(res, ms));
          const until = async (fn, n = 40) => { for (let i = 0; i < n; i++) { const v = fn(); if (v) return v; await wait(100); } return null; };
          const one = P.getPhysicalSingles().find(x => x && x.id && x.series && x.issue);
          if (one) {
            P.openSingleInspector(one);
            const b = await until(() => { const e = document.getElementById('inspectPubBox'); return e && e.dataset.pubState ? e : null; });
            r.inspectorBox = !!b && b.dataset.pubState === 'linked' && !!b.querySelector('[data-pub-use="release"]') && !!b.querySelector('[data-pub-use="explorer"]') && /^pub_i_/.test(b.querySelector('[data-pub-id]').textContent);
            document.getElementById('closeInspectorModalBtn').click();
          } else r.inspectorBox = true;
          document.getElementById('navExplorer').click(); await wait(150);
          if (document.querySelector('#explorerRoot .ex-back')) { document.querySelector('#explorerRoot .ex-back').click(); await wait(150); }
          document.querySelector('#exSecEvents [data-ex-guide="gd_civil_war"]').click(); await wait(200);
          document.querySelector('#exEventSheet .ex-iss').click(); await wait(200);
          const eb = await until(() => { const e = document.getElementById('exPubUsage'); return e && e.dataset.pubState ? e : null; });
          r.explorerBox = !!eb && eb.dataset.pubState === 'linked' && !!eb.querySelector('[data-pub-use="collection"]') && !eb.querySelector('[data-pub-use="explorer"]');
          document.querySelector('.ex-back').click(); await wait(100);
          document.getElementById('navAllSingles').click(); await wait(100);
          const histBefore = (await C.history()).length;
          await C.openDialog();
          const dlg = document.getElementById('pubCatalogDialog');
          r.dialog = !!dlg && dlg.classList.contains('open') && !!dlg.querySelector('[data-pub-stats]') && /Rattachements à trancher/.test(dlg.textContent) && /Séries en double possible/.test(dlg.textContent) && (await C.history()).length === histBefore;
          dlg.querySelector('[data-close]').click();
          r.dialogClosed = !dlg.classList.contains('open') && localStorage.getItem('panel_physical_singles') === singlesBefore;
        } catch (e) { r.error = String(e && e.message || e); }
        return r;
      })()`), new Promise(res => setTimeout(() => res({ timeout: true }), 60000))]);
      console.log('Résultat Test 52:', JSON.stringify(t52));
      const t52keys = ['ready', 'built', 'legacyUntouched', 'collection', 'explorer', 'release', 'idempotent', 'mangaBlocked', 'backup', 'rolledBack', 'reversible', 'inspectorBox', 'explorerBox', 'dialog', 'dialogClosed'];
      const t52fail = t52keys.filter(k => !t52 || t52[k] !== true);
      if (t52fail.length) console.log('Test 52 — vérifications en échec :', t52fail.join(', '));
      testResults.push({ test: 'Catalogue commun (R1) : Collection, Sorties et Explorer résolus vers une identité partagée, fiches intactes, reconstruction idempotente, nouveaux mangas refusés, index sauvegardé, retour arrière et reconstruction identique', ok: t52fail.length === 0 });

      // ─── Test 53 : Event Center v2 (R2, D-57) — niveaux de lecture, progression par niveau, ordre recommandé Panel ───
      console.log('\n[TEST 53] Event Center v2 : niveaux justifiés pour les 9 événements, essentiel visible en tête, progression, ordre Panel...');
      const t53 = await Promise.race([evalExpr(`(async () => {
        const P = window.Panel, EL = window.PanelDomains.eventLevels, MC = window.PanelDomains.mediaCore, r = {}; window.__t53 = r; const T0 = performance.now(); r.ms = {};
        // Onglet de test masqué : les minuteurs y sont fortement ralentis ; les rendus d'Explorer étant synchrones, on cède la main par MessageChannel (non ralenti)
        const tick = () => new Promise(res => { const c = new MessageChannel(); c.port1.onmessage = () => res(); c.port2.postMessage(0); });
        const wait = async ms => { for (let i = 0; i < 3; i++) await tick(); };
        const prefsKey = 'panel_event_levels_v1', prefs0 = localStorage.getItem(prefsKey), prog0 = JSON.stringify(P.releases.all().length);
        localStorage.removeItem(prefsKey);
        try {
          const ids = ['gd_secret_wars_1984', 'gd_infinity_gauntlet', 'gd_house_of_m', 'gd_civil_war', 'gd_crisis_infinite_earths', 'gd_infinite_crisis', 'gd_blackest_night', 'gd_flashpoint', 'gd_king_in_black'];
          const audits = ids.map(id => { const g = P.explorer.guide(id); return g ? EL.auditSelection(g, MC.eventView(g)) : { ok: false, problems: ['absent'] }; });
          r.nineJustified = audits.every(a => a.ok);
          r.step = 'audit'; r.ms['audit'] = Math.round(performance.now() - T0);
          if (!r.nineJustified) r.auditProblems = audits.map((a, i) => a.ok ? '' : ids[i] + ':' + a.problems.join('/')).filter(Boolean);
          document.getElementById('navExplorer').click(); await wait(150);
          if (document.querySelector('#explorerRoot .ex-back')) { document.querySelector('#explorerRoot .ex-back').click(); await wait(150); }
          document.querySelector('#exSecEvents [data-ex-guide="gd_civil_war"]').click(); await wait(250);
          const sec = document.getElementById('exLevels'), sheet = document.getElementById('exEventSheet');
          r.step = 'cw-open'; r.ms['cw-open'] = Math.round(performance.now() - T0);
          r.section = !!sec && sec.dataset.level === 'essential';
          // En tête de fiche : avant la galerie et la série principale ; nombre d'essentiels lisible tout de suite
          r.firstScreen = !!sec && sheet.querySelector('.ex-sec') === sec && sec.getBoundingClientRect().top < window.innerHeight;
          r.essentialCount = sec.querySelector('[data-level-count="essential"]').textContent === '7';
          r.editorialLabel = /Sélection éditoriale Panel \\(version 1/.test(sec.querySelector('[data-level-why]').textContent);
          sec.querySelector('[data-ex-level="recommended"]').click(); await wait(200);
          const sec2 = document.getElementById('exLevels');
          r.step = 'rec'; r.ms['rec'] = Math.round(performance.now() - T0);
          r.recommended = sec2.dataset.level === 'recommended' && sec2.querySelector('[data-level-count="recommended"]').textContent === '28' && /Amazing Spider-Man/.test(sec2.querySelector('[data-level-series]').textContent) && /Front Line/.test(sec2.textContent);
          r.panelOrder = /Ordre recommandé Panel — Recommandé \\(version 1/.test(sec2.querySelector('[data-level-order] summary').textContent) && sec2.querySelectorAll('[data-level-item]').length === 28 &&
            sec2.querySelector('[data-level-item] [data-role]').dataset.role !== 'tie_in';
          r.progress = !!sec2.querySelector('[data-level-progress]');
          sec2.querySelector('[data-ex-level="complete"]').click(); await wait(200);
          r.step = 'complete'; r.ms['complete'] = Math.round(performance.now() - T0);
          let sec3 = document.getElementById('exLevels'); const total = Number(sec3.querySelector('[data-level-count="complete"]').textContent);
          const hide = sec3.querySelector('[data-ex-hide]'); hide.click(); await wait(200);
          sec3 = document.getElementById('exLevels');
          r.hide = Number(sec3.querySelector('[data-level-count="complete"]').textContent) < total && Number(sec3.querySelector('[data-level-count="essential"]').textContent) === 7;
          sec3.querySelector('[data-ex-unhide]').click(); await wait(200);
          r.unhide = Number(document.getElementById('exLevels').querySelector('[data-level-count="complete"]').textContent) === total;
          r.persisted = JSON.parse(localStorage.getItem(prefsKey)).levels.gd_civil_war === 'complete';
          // Événement sans tie-in : niveaux égaux et justifiés
          r.step = 'sw'; r.ms['sw'] = Math.round(performance.now() - T0);
          document.querySelector('#explorerRoot .ex-back').click(); await wait(150);
          r.step = 'sw-back'; r.ms['sw-back'] = Math.round(performance.now() - T0);
          document.querySelector('#exSecEvents [data-ex-guide="gd_secret_wars_1984"]').click(); await wait(250);
          r.step = 'sw-open'; r.ms['sw-open'] = Math.round(performance.now() - T0);
          const sw = document.getElementById('exLevels');
          r.noTieIn = !!sw && sw.querySelector('[data-level-count="essential"]').textContent === '12' && sw.querySelector('[data-level-count="complete"]').textContent === '12';
          r.noThirdPartyOrder = !document.querySelector('#exLevels [data-level-order]').textContent.includes('CBRO');
          r.dataUntouched = JSON.stringify(P.releases.all().length) === prog0;
          r.step = 'end'; r.ms['end'] = Math.round(performance.now() - T0);
          const back = document.querySelector('#explorerRoot .ex-back'); if (back) { back.click(); await wait(100); }
        } catch (e) { r.error = String(e && e.message || e); }
        finally {
          if (prefs0 === null) localStorage.removeItem(prefsKey); else localStorage.setItem(prefsKey, prefs0);
          document.getElementById('navAllSingles').click();
        }
        return r;
      })()`), new Promise(res => setTimeout(() => res({ timeout: true }), 90000))]);
      if (t53 && t53.timeout) { const part = await Promise.race([evalExpr('JSON.stringify(window.__t53 || null)'), new Promise(res => setTimeout(() => res('page bloquée'), 5000))]); console.log('Test 53 — état partiel :', part); }
      console.log('Résultat Test 53:', JSON.stringify(t53));
      const t53keys = ['nineJustified', 'section', 'firstScreen', 'essentialCount', 'editorialLabel', 'recommended', 'panelOrder', 'progress', 'hide', 'unhide', 'persisted', 'noTieIn', 'noThirdPartyOrder', 'dataUntouched'];
      const t53fail = t53keys.filter(k => !t53 || t53[k] !== true);
      if (t53fail.length) console.log('Test 53 — vérifications en échec :', t53fail.join(', '));
      testResults.push({ test: 'Event Center v2 (R2) : 9 événements aux niveaux justifiés, essentiel visible en tête de fiche, niveau recommandé, ordre recommandé Panel versionné construit par rôles, progression, masquage réversible, préférence locale', ok: t53fail.length === 0 });

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
