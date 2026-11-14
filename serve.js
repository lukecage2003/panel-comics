// Serveur local de Panel (aucune dépendance) : permet le mode PWA (service worker, installation)
// sur cet ordinateur via http://localhost:8080 — les service workers ne fonctionnent pas en file://.
//   node serve.js            -> http://localhost:8080
//   node serve.js 5173       -> autre port
// Sur un téléphone, l'installation et la caméra exigent HTTPS : hébergez Panel (voir README).
//
// Relais GCD (Grand Comics Database) : /api/gcd/issues?series=…&issue=…&year=…
// GCD n'autorise pas les appels directs depuis un navigateur (pas de CORS) : ce relais local interroge
// son API publique pour identifier l'édition exacte d'un code-barres à 17 chiffres. Quota respecté :
// 25 requêtes / heure maximum (limite anonyme GCD : 30), réponses en cache disque (.cache/gcd.json, 30 jours).
// Données GCD sous licence CC BY-SA 4.0 (attribution : Grand Comics Database, comics.org).
//
// Relais Metron (metron.cloud) : /api/metron/scan?code=…&issue=… et /api/metron/status
// Code-barres complet → numéro + variante exacte (74 variantes pour Absolute Batman #1) ;
// début du code (12 chiffres) → série reconnue sans saisie. Compte gratuit requis :
//   node serve.js --metron      (demande le pseudo et le mot de passe, masqué, puis vérifie)
// Les identifiants restent dans .secrets/metron.json (jamais servi au navigateur) ou dans les
// variables METRON_USERNAME / METRON_PASSWORD. Quota Metron respecté : 1 requête / 3,2 s, pause sur 429.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
// Le port en argument n'est lu que si serve.js est lancé directement (pas quand un test le charge)
const port = Number((require.main === module && /^\d+$/.test(process.argv[2] || '') && process.argv[2]) || process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2'
};
// Seuls les fichiers de l'application sont servis (pas les sauvegardes, profils de test, etc.)
const ALLOWED = /^\/(index\.html|manifest\.webmanifest|sw\.js|icons\/[a-z0-9-]+\.png|fonts\/[a-z0-9-]+\.woff2)?$/i;

// ---------- Relais GCD : quota, cache, aucune donnée personnelle transmise
const GCD_HOURLY_MAX = 25;
const GCD_CACHE_TTL = 30 * 86400000;
const gcdCacheFile = path.join(root, '.cache', 'gcd.json');
let gcdCache = {};
try { gcdCache = JSON.parse(fs.readFileSync(gcdCacheFile, 'utf8')) || {}; } catch (_) { gcdCache = {}; }
const gcdCalls = [];
const gcdBudget = () => { const now = Date.now(); while (gcdCalls.length && now - gcdCalls[0] > 3600000) gcdCalls.shift(); return GCD_HOURLY_MAX - gcdCalls.length; };
let gcdPersist = true;
const saveGcdCache = () => { if (!gcdPersist) return; try { fs.mkdirSync(path.dirname(gcdCacheFile), { recursive: true }); fs.writeFileSync(gcdCacheFile, JSON.stringify(gcdCache)); } catch (_) {} };
let gcdGet = async url => {
  const r = await fetch(url, { headers: { 'User-Agent': 'PanelComics/1.0 (local collection manager; GCD relay)', Accept: 'application/json' } });
  if (r.status === 404) return { results: [] };
  if (!r.ok) throw Object.assign(new Error('GCD HTTP ' + r.status), { status: r.status });
  return r.json();
};
const sendJson = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(obj)); };
const handleGcd = async (u, res) => {
  if (u.pathname === '/api/gcd/status') return sendJson(res, 200, { ok: true, remaining: gcdBudget(), cached: Object.keys(gcdCache).length });
  if (u.pathname === '/api/gcd/cover') {
    // Fiche publique d'un numéro GCD : son champ « cover » donne l'URL du scan (licence de la base : CC BY-SA 4.0)
    const series = String(u.searchParams.get('series') || '').trim().slice(0, 120);
    const issue = String(u.searchParams.get('issue') || '').trim().slice(0, 12);
    const year = String(u.searchParams.get('year') || '').trim();
    if (!series || !/^[0-9A-Za-z.\-]+$/.test(issue) || !/^(18|19|20)\d{2}$/.test(year)) return sendJson(res, 400, { error: 'paramètres invalides' });
    const key = 'cover|' + series.toLowerCase() + '|' + issue + '|' + year;
    const hit = gcdCache[key];
    if (hit && Date.now() - hit.at < GCD_CACHE_TTL) return sendJson(res, 200, Object.assign({ cached: true, remaining: gcdBudget() }, hit.data));
    try {
      if (gcdBudget() < 2) return sendJson(res, 429, { error: 'quota GCD atteint, réessayez dans une heure', remaining: gcdBudget() });
      gcdCalls.push(Date.now());
      const list = await gcdGet('https://www.comics.org/api/series/name/' + encodeURIComponent(series) + '/issue/' + encodeURIComponent(issue) + '/year/' + year + '/?format=json');
      const rows = Array.isArray(list) ? list : (list.results || []);
      const main = rows.find(e => !e.variant_of) || rows[0];
      let cover = '';
      if (main) {
        cover = String(main.cover || '');
        if (!cover && main.api_url) { gcdCalls.push(Date.now()); const d = await gcdGet(main.api_url); cover = String(d.cover || ''); }
      }
      const data = { cover: /^https:\/\//.test(cover) ? cover : '', series: (main && main.series_name) || null, source: 'Grand Comics Database', license: 'CC BY-SA 4.0' };
      gcdCache[key] = { at: Date.now(), data };
      saveGcdCache();
      return sendJson(res, 200, Object.assign({ remaining: gcdBudget() }, data));
    } catch (e) {
      return sendJson(res, e.status === 429 ? 429 : 502, { error: 'GCD indisponible', detail: String(e.message || e).slice(0, 120) });
    }
  }
  if (u.pathname !== '/api/gcd/issues') return sendJson(res, 404, { error: 'introuvable' });
  const series = String(u.searchParams.get('series') || '').trim().slice(0, 120);
  const issue = String(u.searchParams.get('issue') || '').trim().slice(0, 12);
  const year = String(u.searchParams.get('year') || '').trim();
  if (!series || !/^[0-9A-Za-z.\-]+$/.test(issue) || !/^(18|19|20)\d{2}$/.test(year)) return sendJson(res, 400, { error: 'paramètres invalides' });
  const barcode = String(u.searchParams.get('barcode') || '').replace(/\D/g, '');
  const key = 'v2|' + series.toLowerCase() + '|' + issue + '|' + year;
  try {
    // 1. Liste des éditions du numéro (1 requête, en cache 30 jours)
    let entry = gcdCache[key];
    if (!entry || Date.now() - entry.at > GCD_CACHE_TTL) {
      if (gcdBudget() <= 0) return sendJson(res, 429, { error: 'quota GCD atteint, réessayez dans une heure', remaining: 0 });
      let url = 'https://www.comics.org/api/series/name/' + encodeURIComponent(series) + '/issue/' + encodeURIComponent(issue) + '/year/' + year + '/?format=json';
      const editions = [];
      for (let page = 0; url && page < 3 && gcdBudget() > 0; page++) {
        gcdCalls.push(Date.now());
        const d = await gcdGet(url);
        (Array.isArray(d) ? d : (d.results || [])).forEach(e => {
          // « 1 [Mitch Gerads Virgin Cardstock Variant Cover] » → nom de l'édition
          const bracket = (String(e.descriptor || '').match(/\[(.*)\]/) || [])[1] || '';
          const name = bracket.replace(/\s+Cover$/i, '').trim();
          editions.push({
            id: e.api_url || null, series: e.series_name || null, descriptor: e.descriptor || '',
            variant_name: e.variant_of ? (name || 'Variante') : ('Cover A' + (name ? ' ' + name : '')),
            main: !e.variant_of, barcode: null, price: e.price || '', publication_date: e.publication_date || ''
          });
        });
        url = d && d.next ? d.next : null;
      }
      const old = entry && entry.data && entry.data.editions || [];
      editions.forEach(e => { const o = old.find(x => x.id === e.id); if (o && o.barcode) e.barcode = o.barcode; });
      entry = gcdCache[key] = { at: Date.now(), data: { editions } };
      saveGcdCache();
    }
    const editions = entry.data.editions;
    // 2. Code-barres : les fiches détaillées ne sont lues qu'au besoin (puis gardées), Cover A d'abord si le code finit par 11
    let match = barcode ? editions.find(e => e.barcode === barcode) || null : null;
    if (barcode && !match) {
      const code = barcode.slice(-2);
      const order = editions.filter(e => e.barcode === null && e.id).sort((a, b) => (code === '11' ? (b.main - a.main) : (a.main - b.main)));
      for (const e of order) {
        if (gcdBudget() <= 0) break;
        gcdCalls.push(Date.now());
        const d = await gcdGet(e.id);
        e.barcode = String(d.barcode || '').replace(/\D/g, '');
        if (d.variant_name && !e.main) e.variant_name = String(d.variant_name).trim() || e.variant_name;
        saveGcdCache();
        if (e.barcode === barcode) { match = e; break; }
      }
    }
    const complete = editions.every(e => e.barcode !== null);
    return sendJson(res, 200, { editions, match, complete, remaining: gcdBudget(), source: 'Grand Comics Database', license: 'CC BY-SA 4.0' });
  } catch (e) {
    return sendJson(res, e.status === 429 ? 429 : 502, { error: 'GCD indisponible', detail: String(e.message || e).slice(0, 120) });
  }
};

// ---------- Relais Comic Vine : la clé reste sur le serveur (CV_API_KEY ou .secrets/comicvine.json)
const cvKeyFile = path.join(root, '.secrets', 'comicvine.json');
const loadCvKey = () => { if (process.env.CV_API_KEY) return process.env.CV_API_KEY.trim(); try { return (JSON.parse(fs.readFileSync(cvKeyFile, 'utf8')).apiKey || '').trim(); } catch (_) { return ''; } };
let cvApiKey = loadCvKey();
const cvCalls = {};
const CV_PATH_RE = /^(search|issues|volumes|characters|people|publishers|teams|story_arcs|issue\/4000-\d+|volume\/4050-\d+|character\/4005-\d+|person\/4040-\d+|publisher\/4010-\d+|team\/4060-\d+|story_arc\/4045-\d+)$/;
let cvGet = url => fetch(url, { headers: { 'User-Agent': 'PanelComics/1.0 (local collection manager; Comic Vine relay)', Accept: 'application/json' } });
const handleCv = async (u, res) => {
  if (!cvApiKey) return sendJson(res, 503, { error: 'Clé Comic Vine absente du serveur (.secrets/comicvine.json ou CV_API_KEY).' });
  const p = u.pathname.replace(/^\/api\/cv\//, '').replace(/\/$/, '');
  if (!CV_PATH_RE.test(p)) return sendJson(res, 400, { error: 'ressource non autorisée' });
  const resource = p.split('/')[0];
  const now = Date.now();
  cvCalls[resource] = (cvCalls[resource] || []).filter(t => now - t < 3600000);
  if (cvCalls[resource].length >= 190) return sendJson(res, 200, { status_code: 107, error: 'Rate Limit Exceeded (relais)' });
  const params = new URLSearchParams(u.search);
  ['api_key', 'format', 'json_callback'].forEach(k => params.delete(k));
  params.set('format', 'json');
  cvCalls[resource].push(now);
  try {
    const r = await cvGet('https://comicvine.gamespot.com/api/' + p + '/?api_key=' + encodeURIComponent(cvApiKey) + '&' + params.toString());
    const body = await r.json();
    return sendJson(res, 200, body);
  } catch (e) {
    return sendJson(res, 502, { status_code: 0, error: 'Comic Vine indisponible' });
  }
};

// ---------- Relais Metron
const METRON_BASE = 'https://metron.cloud/api';
const metronCredFile = path.join(root, '.secrets', 'metron.json');
const metronCacheFile = path.join(root, '.cache', 'metron.json');
const loadMetronCreds = () => {
  if (process.env.METRON_USERNAME && process.env.METRON_PASSWORD) return { username: process.env.METRON_USERNAME, password: process.env.METRON_PASSWORD };
  try { const c = JSON.parse(fs.readFileSync(metronCredFile, 'utf8')); return c && c.username && c.password ? c : null; } catch (_) { return null; }
};
let metronCreds = loadMetronCreds();
let metronCache = { upc: {}, prefix: {}, issues: {} };
try { metronCache = Object.assign(metronCache, JSON.parse(fs.readFileSync(metronCacheFile, 'utf8'))); } catch (_) {}
let metronPersist = true;
const saveMetronCache = () => { if (!metronPersist) return; try { fs.mkdirSync(path.dirname(metronCacheFile), { recursive: true }); fs.writeFileSync(metronCacheFile, JSON.stringify(metronCache)); } catch (_) {} };
let METRON_SPACING = 3200;
let metronState = { last: 0, blockedUntil: 0, remaining: null, authFailed: false, chain: Promise.resolve() };
let metronFetch = (url, headers) => fetch(url, { headers });
// Requêtes en file (une à la fois, espacées) : jamais plus de ~19 / minute
const metronGet = pathAndQuery => {
  const run = async () => {
    if (!metronCreds) throw Object.assign(new Error('Metron non configuré'), { status: 503 });
    if (metronState.authFailed) throw Object.assign(new Error('identifiants Metron refusés'), { status: 401 });
    if (Date.now() < metronState.blockedUntil) throw Object.assign(new Error('quota Metron'), { status: 429 });
    const wait = metronState.last + METRON_SPACING - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    metronState.last = Date.now();
    const r = await metronFetch(METRON_BASE + pathAndQuery, {
      Authorization: 'Basic ' + Buffer.from(metronCreds.username + ':' + metronCreds.password).toString('base64'),
      Accept: 'application/json', 'User-Agent': 'PanelComics/1.0 (local collection manager; Metron relay)'
    });
    const rem = r.headers && r.headers.get && r.headers.get('x-ratelimit-sustained-remaining');
    if (rem !== null && rem !== undefined) metronState.remaining = Number(rem);
    if (r.status === 401) { metronState.authFailed = true; throw Object.assign(new Error('identifiants Metron refusés'), { status: 401 }); }
    if (r.status === 429) { metronState.blockedUntil = Date.now() + 1000 * Number((r.headers.get && r.headers.get('retry-after')) || 60); throw Object.assign(new Error('quota Metron'), { status: 429 }); }
    if (r.status === 404) return { results: [] };
    if (!r.ok) throw Object.assign(new Error('Metron HTTP ' + r.status), { status: 502 });
    return r.json();
  };
  const p = metronState.chain.then(run, run);
  metronState.chain = p.catch(() => {});
  return p;
};
const DAY = 86400000;
const metronIssue = async id => {
  const hit = metronCache.issues[id];
  if (hit && Date.now() - hit.at < 7 * DAY) return hit.data;
  const d = await metronGet('/issue/' + id + '/');
  const series = d.series || {};
  const main = { name: 'Cover A', main: true, upc: d.upc || '', image: d.image || '', price: d.price || null };
  const data = {
    id: d.id, number: d.number, cover_date: d.cover_date || null, title: d.title || d.name || null,
    series: { name: series.name || '', volume: series.volume || null, year_began: series.year_began || null },
    publisher: (d.publisher && d.publisher.name) || null, cover_hash: d.cover_hash || '', cv_id: d.cv_id || null, gcd_id: d.gcd_id || null,
    editions: [main].concat((d.variants || []).map(v => ({ name: v.name || 'Variante', main: false, upc: v.upc || '', image: v.image || '', price: v.price || null })))
  };
  metronCache.issues[id] = { at: Date.now(), data };
  saveMetronCache();
  return data;
};
const metronIdsFor = async (key, store, query, ttl) => {
  const hit = metronCache[store][key];
  if (hit && Date.now() - hit.at < (hit.ids.length ? ttl : 7 * DAY)) return hit.ids;
  const d = await metronGet('/issue/?' + new URLSearchParams(query).toString());
  const ids = (d.results || []).map(x => x.id);
  const series = (d.results || [])[0] && d.results[0].series;
  metronCache[store][key] = { at: Date.now(), ids: ids.slice(0, 5), series: series || null };
  saveMetronCache();
  return ids;
};
const handleMetron = async (u, res) => {
  if (u.pathname === '/api/metron/status') return sendJson(res, 200, { configured: !!metronCreds, authFailed: metronState.authFailed, remaining: metronState.remaining });
  if (u.pathname === '/api/metron/search') {
    if (!metronCreds) return sendJson(res, 503, { error: 'Metron non configuré : lancez « node serve.js --metron »' });
    const q = String(u.searchParams.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (q.length < 2) return sendJson(res, 400, { error: 'paramètres invalides' });
    const m = q.match(/^(.*?)\s*#?\s*(\d{1,5}(?:\.\d+)?[A-Za-z]?)$/);
    const seriesName = (m && m[1].trim()) || q, number = m && m[1].trim() ? m[2] : '';
    const key = seriesName.toLowerCase() + '|' + number;
    metronCache.search = metronCache.search || {};
    const hit = metronCache.search[key];
    if (hit && Date.now() - hit.at < 7 * DAY) return sendJson(res, 200, { results: hit.results, cached: true, remaining: metronState.remaining });
    try {
      const d = await metronGet('/issue/?' + new URLSearchParams(Object.assign({ series_name: seriesName }, number ? { number } : {})).toString());
      const results = (d.results || []).slice(0, 30).map(x => ({
        id: x.id, series: (x.series && x.series.name) || '', year: (x.series && x.series.year_began) || null, volume: (x.series && x.series.volume) || null,
        number: String(x.number || ''), date: x.cover_date || '', image: /^https:\/\//.test(String(x.image || '')) ? x.image : ''
      }));
      metronCache.search[key] = { at: Date.now(), results };
      saveMetronCache();
      return sendJson(res, 200, { results, remaining: metronState.remaining });
    } catch (e) {
      return sendJson(res, e.status || 502, { error: e.message || 'Metron indisponible' });
    }
  }
  if (u.pathname !== '/api/metron/scan') return sendJson(res, 404, { error: 'introuvable' });
  if (!metronCreds) return sendJson(res, 503, { error: 'Metron non configuré : lancez « node serve.js --metron »' });
  const code = String(u.searchParams.get('code') || '').replace(/\D/g, '');
  const num = String(u.searchParams.get('issue') || '').trim();
  if (!/^\d{12,18}$/.test(code) || (num && !/^[0-9A-Za-z.\-]{1,10}$/.test(num))) return sendJson(res, 400, { error: 'paramètres invalides' });
  try {
    // 1. Code complet : numéro et édition exacte
    const ids = await metronIdsFor(code, 'upc', { upc: code }, 30 * DAY);
    if (ids.length) {
      const issue = await metronIssue(ids[0]);
      const edition = issue.editions.find(e => e.upc === code);
      if (edition) return sendJson(res, 200, { found: 'exact', issue, edition, remaining: metronState.remaining });
    }
    const base12 = code.slice(0, 12);
    // 2. Début du code + numéro : le numéro et toutes ses éditions (variante à choisir)
    if (num) {
      const ids2 = await metronIdsFor(base12 + '|' + num, 'prefix', { upc_starts_with: base12, number: num }, 30 * DAY);
      if (ids2.length) return sendJson(res, 200, { found: 'issue', issue: await metronIssue(ids2[0]), remaining: metronState.remaining });
    }
    // 3. Début du code seul : la série
    await metronIdsFor(base12, 'prefix', { upc_starts_with: base12 }, 30 * DAY);
    const s3 = metronCache.prefix[base12];
    if (s3 && s3.series) return sendJson(res, 200, { found: 'series', series: s3.series, remaining: metronState.remaining });
    return sendJson(res, 200, { found: false, remaining: metronState.remaining });
  } catch (e) {
    return sendJson(res, e.status || 502, { error: e.message || 'Metron indisponible' });
  }
};

// Configuration interactive : node serve.js --metron
const setupMetron = async () => {
  const readline = require('readline');
  const ask = (q, hidden) => new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = str => rl.output.write(str.includes(q) ? str : (/[\r\n]/.test(str) ? '\n' : '*'));
    rl.question(q, a => { rl.close(); resolve(a); });
  });
  console.log('Configuration de Metron (compte gratuit sur https://metron.cloud).');
  console.log('Le pseudo est celui affiché sur votre profil (pas l\'e-mail) ; majuscules comprises.');
  const username = (await ask('Pseudo Metron : ')).trim();
  const password = await ask('Mot de passe (masqué) : ', true);
  if (!username || !password) { console.log('\nAnnulé.'); process.exit(1); }
  metronCreds = { username, password };
  process.stdout.write('\nVérification…');
  try {
    await metronGet('/issue/?upc=76194138584600111');
  } catch (e) {
    console.log(e.status === 401 ? '\n✗ Pseudo ou mot de passe refusés par Metron. Rien n\'a été enregistré.\n  (Après 5 échecs, Metron bloque 15 minutes.)' : '\n✗ Metron injoignable : ' + e.message);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(metronCredFile), { recursive: true });
  fs.writeFileSync(metronCredFile, JSON.stringify({ username, password }), { mode: 0o600 });
  console.log('\n✓ Connexion acceptée. Identifiants enregistrés dans .secrets/metron.json (jamais servi au navigateur).');
  console.log('  Lancez maintenant : node serve.js');
  process.exit(0);
};

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); return res.end(); }
  // État des relais (aucun secret renvoyé) : l'app vérifie au démarrage quels outils en ligne sont réellement disponibles
  if (p === '/api/status' && req.method === 'GET') return void sendJson(res, 200, { ok: true, cv: !!cvApiKey, metron: !!metronCreds, gcd: true });
  if (p.startsWith('/api/gcd/') && req.method === 'GET') return void handleGcd(new URL(req.url, 'http://x'), res);
  if (p.startsWith('/api/metron/') && req.method === 'GET') return void handleMetron(new URL(req.url, 'http://x'), res);
  if (p.startsWith('/api/cv/') && req.method === 'GET') return void handleCv(new URL(req.url, 'http://x'), res);
  if (!ALLOWED.test(p)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Introuvable'); }
  const file = path.join(root, p === '/' ? 'index.html' : p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // le service worker et la page doivent toujours être revalidés pour recevoir les mises à jour
      'Cache-Control': /\.(html|js|webmanifest)$/.test(file) ? 'no-cache' : /\.woff2$/.test(file) ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
});

if (require.main === module && process.argv.includes('--metron')) setupMetron();
else server.listen(port, '127.0.0.1', () => {
  console.log(`Panel est servi sur http://localhost:${port}  (Ctrl+C pour arrêter)`);
  console.log(metronCreds ? 'Metron : configuré' : 'Metron : non configuré (node serve.js --metron pour l\'activer)');
});
module.exports = server;
// Tests : remplacement de l'accès réseau GCD
module.exports.setMetronForTest = (fetchFn, creds) => { metronFetch = fetchFn; metronCreds = creds; metronPersist = false; metronCache = { upc: {}, prefix: {}, issues: {} }; metronState = { last: 0, blockedUntil: 0, remaining: null, authFailed: false, chain: Promise.resolve() }; METRON_SPACING = 0; };

module.exports.setCvForTest = (fn, key) => { cvGet = fn; cvApiKey = key; Object.keys(cvCalls).forEach(k => delete cvCalls[k]); };
module.exports.setGcdGetForTest = fn => { gcdGet = fn; gcdCalls.length = 0; gcdCache = {}; gcdPersist = false; };
