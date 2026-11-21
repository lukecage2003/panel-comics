'use strict';
// Récolte des textes visibles de l'interface et couverture de traduction (D-103).
// Usage : node scripts/i18n-harvest.js [sortie.json]
//   Ouvre Panel dans un Edge invisible (profil neuf, supprimé à la fin), parcourt les écrans principaux et les onglets des Réglages,
//   relève les textes visibles, les infobulles, les libellés d'accessibilité et les indications de saisie, puis indique, pour chaque
//   langue, combien de ces textes ont une traduction. Ne modifie aucune donnée ; la sortie (facultative) est un fichier généré à ne pas versionner.
const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const PORT = 9226;
const out = process.argv[2] || '';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-i18n-'));
const proc = execFile(EDGE, ['--headless', '--disable-gpu', '--user-data-dir=' + profile, '--remote-debugging-port=' + PORT, '--allow-file-access-from-files',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--window-size=1280,900', URL]);
const stop = () => {
  try { proc.kill(); } catch (_) {}
  try { execFileSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -match [regex]::Escape('" + profile.replace(/'/g, "''") + "') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore', timeout: 15000 }); } catch (_) {}
  for (let i = 0; i < 5; i++) { try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch (_) { const t = Date.now() + 400; while (Date.now() < t) {} } }
};
const timer = setTimeout(() => { console.error('Délai dépassé.'); stop(); process.exit(1); }, 180000);

const HARVEST = `(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 60 && !(window.Panel && document.readyState === 'complete'); i++) await wait(250);
  await wait(800);
  const seen = new Set();
  const add = s => { s = String(s || '').replace(/\\s+/g, ' ').trim(); if (s.length < 2 || s.length > 160 || !/[A-Za-zÀ-ÿ]{2}/.test(s)) return; seen.add(s); };
  const harvest = () => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('script,style,svg,[data-no-i18n]') || !p.getClientRects().length) continue; add(n.nodeValue); }
    document.querySelectorAll('[title],[aria-label],[placeholder]').forEach(e => { if (!e.getClientRects().length) return; ['title', 'aria-label', 'placeholder'].forEach(a => e.hasAttribute(a) && add(e.getAttribute(a))); });
  };
  harvest();
  for (const id of ['navSinglesCommunity', 'navExplorer', 'navLive', 'navProfile', 'navAllSingles', 'navSinglesSeries', 'navSinglesPullList', 'navSinglesReleases', 'navSinglesWishlist', 'navSinglesReading', 'navSinglesStats', 'navSinglesFinances']) {
    const b = document.getElementById(id); if (b) { b.click(); await wait(700); harvest(); }
  }
  const sb = document.getElementById('openSettingsBtnTop');
  if (sb) { sb.click(); await wait(700); for (const t of [...document.querySelectorAll('[data-set-tab]')]) { t.click(); await wait(300); harvest(); } document.getElementById('settingsModal').classList.remove('open'); }
  const I = window.PanelDomains.i18n, list = [...seen].sort((a, b) => a.localeCompare(b, 'fr'));
  const cov = {};
  if (I) Object.keys(I.LOCALES).filter(l => l !== 'fr').forEach(l => { const tr = I.translator(l, window.PanelDomains['i18n' + l[0].toUpperCase() + l.slice(1)]); const miss = list.filter(s => tr(s) === null); cov[l] = { total: list.length, translated: list.length - miss.length, missing: miss }; });
  return { strings: list, coverage: cov };
})()`;

(async () => {
  try {
    let target = null;
    for (let i = 0; i < 80 && !target; i++) {
      try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/list'); target = (await r.json()).find(t => t.url.includes('index.html')); } catch (_) {}
      if (!target) await new Promise(r => setTimeout(r, 250));
    }
    if (!target) throw new Error('Edge ne répond pas.');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const send = (method, params) => new Promise(res => { const my = ++id; const h = ev => { const d = JSON.parse(ev.data); if (d.id === my) { ws.removeEventListener('message', h); res(d.result); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: my, method, params })); });
    const r = await send('Runtime.evaluate', { expression: HARVEST, awaitPromise: true, returnByValue: true });
    const v = r && r.result && r.result.value;
    if (!v) throw new Error('Récolte impossible : ' + JSON.stringify(r && r.exceptionDetails || r).slice(0, 300));
    console.log('Textes relevés :', v.strings.length);
    Object.entries(v.coverage).forEach(([l, c]) => console.log(l + ' : ' + c.translated + ' / ' + c.total + ' (' + Math.round(c.translated / Math.max(1, c.total) * 100) + ' %)'));
    if (out) { fs.writeFileSync(out, JSON.stringify(v, null, 1)); console.log('Écrit :', out); }
    ws.close();
  } catch (e) { console.error(e.message || e); process.exitCode = 1; }
  finally { clearTimeout(timer); stop(); }
})();
