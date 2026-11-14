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
// Relais Wikidata : /api/wd/entity?cv=4005-… (ville, univers, créateurs, création, résumé Wikipédia), voir plus bas.
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

// Apparitions récentes d'un personnage, d'une équipe ou d'un créateur (D-67) : /api/cv-appearances?ref=character:26578
// La liste complète des crédits peut peser plusieurs Mo (Batman : ~6 Mo) : le relais la lit une fois, garde les 30 entrées
// les plus récentes dans Comic Vine, lit leurs dates en une requête, et renvoie 12 numéros triés. Cache disque 7 jours.
const cvAppFile = path.join(root, '.cache', 'cv-appearances.json');
let cvAppCache = {};
try { cvAppCache = JSON.parse(fs.readFileSync(cvAppFile, 'utf8')) || {}; } catch (_) { cvAppCache = {}; }
let cvAppPersist = true;
const CV_APP_KIND = { character: ['character/4005-', 'issue_credits'], team: ['team/4060-', 'issue_credits'], person: ['person/4040-', 'issue_credits'] };
const cvBudgetTake = resource => { const now = Date.now(); cvCalls[resource] = (cvCalls[resource] || []).filter(t => now - t < 3600000); if (cvCalls[resource].length >= 190) return false; cvCalls[resource].push(now); return true; };
const cvJson = async (p, params) => { const r = await cvGet('https://comicvine.gamespot.com/api/' + p + '/?api_key=' + encodeURIComponent(cvApiKey) + '&format=json&' + new URLSearchParams(params).toString()); return r.json(); };
const handleCvAppearances = async (u, res) => {
  if (!cvApiKey) return sendJson(res, 503, { error: 'Clé Comic Vine absente du serveur.' });
  const m = /^(character|team|person):(\d{1,9})$/.exec(String(u.searchParams.get('ref') || ''));
  if (!m) return sendJson(res, 400, { error: 'paramètres invalides' });
  const key = m[1] + ':' + m[2], hit = cvAppCache[key];
  if (hit && Date.now() - hit.at < 7 * 86400000) return sendJson(res, 200, Object.assign({ cached: true }, hit.data));
  const [prefix, field] = CV_APP_KIND[m[1]];
  try {
    if (!cvBudgetTake(m[1]) ) return sendJson(res, 429, { error: 'quota Comic Vine atteint pour l\'heure' });
    const d = await cvJson(prefix + m[2], { field_list: field + ',count_of_issue_appearances' });
    const credits = (d.results && Array.isArray(d.results[field]) ? d.results[field] : []).filter(x => x && Number.isInteger(x.id));
    const top = credits.map(x => x.id).sort((a, b) => b - a).slice(0, 30);
    let issues = [];
    if (top.length) {
      if (!cvBudgetTake('issues')) return sendJson(res, 429, { error: 'quota Comic Vine atteint pour l\'heure' });
      const r = await cvJson('issues', { filter: 'id:' + top.join('|'), limit: 30, field_list: 'id,name,issue_number,volume,image,cover_date,store_date' });
      issues = (r.results || []).map(x => ({ id: x.id, name: String(x.name || '').slice(0, 120), issue_number: String(x.issue_number || '').slice(0, 12),
        volume: x.volume ? { id: x.volume.id, name: String(x.volume.name || '').slice(0, 160) } : null,
        image: x.image && /^https:\/\//.test(x.image.small_url || '') ? x.image.small_url : '', date: String(x.store_date || x.cover_date || '').slice(0, 10) }))
        .filter(x => x.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    }
    const data = { total: credits.length, latest: issues };
    cvAppCache[key] = { at: Date.now(), data };
    if (cvAppPersist) { try { fs.mkdirSync(path.dirname(cvAppFile), { recursive: true }); fs.writeFileSync(cvAppFile, JSON.stringify(cvAppCache)); } catch (_) {} }
    return sendJson(res, 200, data);
  } catch (e) {
    return sendJson(res, 502, { error: 'Comic Vine indisponible' });
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

// ---------- Relais Wikidata + Wikipédia (D-67) : /api/wd/entity?cv=4005-1699
// Données ouvertes (Wikidata CC0, résumés Wikipédia CC BY-SA 4.0), sans clé ni compte. Seul l'identifiant Comic Vine
// public est envoyé. Quota 60 requêtes / heure, cache disque 30 jours (.cache/wikidata.json).
const WD_HOURLY_MAX = 60;
const wdCacheFile = path.join(root, '.cache', 'wikidata.json');
let wdCache = {};
try { wdCache = JSON.parse(fs.readFileSync(wdCacheFile, 'utf8')) || {}; } catch (_) { wdCache = {}; }
const wdCalls = [];
const wdBudget = () => { const now = Date.now(); while (wdCalls.length && now - wdCalls[0] > 3600000) wdCalls.shift(); return WD_HOURLY_MAX - wdCalls.length; };
let wdPersist = true;
const saveWdCache = () => { if (!wdPersist) return; try { fs.mkdirSync(path.dirname(wdCacheFile), { recursive: true }); fs.writeFileSync(wdCacheFile, JSON.stringify(wdCache)); } catch (_) {} };
let wdGet = async (url, accept) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'PanelComics/1.0 (local collection manager; open data relay)', Accept: accept || 'application/json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
  return r.json();
};
const WD_PROPS = { res: 'P551', univ: 'P1080', creator: 'P170', pob: 'P19', sex: 'P21', member: 'P463', first: 'P4584', occupation: 'P106', citizen: 'P27' };
const wdQuery = cv => 'SELECT ?item ?itemLabel ?inception ?frwiki ?enwiki ' + Object.keys(WD_PROPS).map(k => '?' + k + 'Label').join(' ') +
  ' WHERE { ?item wdt:P5905 "' + cv + '". OPTIONAL{?item wdt:P571 ?inception} ' + Object.entries(WD_PROPS).map(([k, pr]) => 'OPTIONAL{?item wdt:' + pr + ' ?' + k + '} ').join('') +
  'OPTIONAL{?frwiki schema:about ?item; schema:isPartOf <https://fr.wikipedia.org/>} OPTIONAL{?enwiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>} ' +
  'SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". } } LIMIT 200';
const handleWd = async (u, res) => {
  if (u.pathname !== '/api/wd/entity') return sendJson(res, 404, { error: 'introuvable' });
  const cv = String(u.searchParams.get('cv') || '');
  if (!/^40(05|40|60|45|10)-\d{1,9}$/.test(cv)) return sendJson(res, 400, { error: 'paramètres invalides' });
  const hit = wdCache[cv];
  if (hit && Date.now() - hit.at < GCD_CACHE_TTL) return sendJson(res, 200, Object.assign({ cached: true }, hit.data));
  if (wdBudget() < 2) return sendJson(res, 429, { error: 'quota Wikidata atteint, réessayez dans une heure' });
  try {
    wdCalls.push(Date.now());
    const d = await wdGet('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(wdQuery(cv)), 'application/sparql-results+json');
    const rows = (d && d.results && d.results.bindings) || [];
    const val = (r, k) => r[k] && typeof r[k].value === 'string' ? r[k].value.slice(0, 200) : '';
    const uniq = k => [...new Set(rows.map(r => val(r, k + 'Label')).filter(v => v && !/^Q\d+$/.test(v) && !/^https?:/.test(v)))].slice(0, 12);
    const first = rows[0] || {};
    const data = { found: !!rows.length, qid: (val(first, 'item').match(/Q\d+$/) || [''])[0], label: val(first, 'itemLabel'), inception: val(first, 'inception').slice(0, 10),
      residence: uniq('res'), universe: uniq('univ'), creators: uniq('creator'), birthplace: uniq('pob'), sex: uniq('sex'), memberOf: uniq('member'), firstAppearance: uniq('first'),
      occupation: uniq('occupation'), citizenship: uniq('citizen'), frwiki: val(first, 'frwiki'), enwiki: val(first, 'enwiki'), summary: '', summaryLang: '', summaryUrl: '' };
    // Résumé Wikipédia (français d'abord), extrait court avec lien vers l'article
    const wiki = data.frwiki || data.enwiki;
    if (wiki && /^https:\/\/(fr|en)\.wikipedia\.org\/wiki\/[^\s?#]+$/.test(wiki)) {
      wdCalls.push(Date.now());
      const lang = wiki.slice(8, 10), title = wiki.split('/wiki/')[1];
      const sm = await wdGet('https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + title).catch(() => null);
      if (sm && typeof sm.extract === 'string') { data.summary = sm.extract.slice(0, 1200); data.summaryLang = lang; data.summaryUrl = wiki; }
    }
    data.source = 'Wikidata (CC0)' + (data.summary ? ' · Wikipédia (CC BY-SA 4.0)' : '');
    wdCache[cv] = { at: Date.now(), data };
    saveWdCache();
    return sendJson(res, 200, data);
  } catch (e) {
    return sendJson(res, e.status === 429 ? 429 : 502, { error: 'Wikidata indisponible', detail: String(e.message || e).slice(0, 120) });
  }
};

// ---------- Relais BnF (D-67) : /api/bnf/editions?title=Absolute%20Batman
// Catalogue public de la Bibliothèque nationale de France (SRU, Dublin Core), sans clé : éditions françaises déjà parues
// (dépôt légal), avec date, éditeur, collection et ISBN. Seuls les éditeurs de comics francophones sont gardés.
// Quota 40 requêtes / heure, cache disque 14 jours (.cache/bnf.json).
const BNF_HOURLY_MAX = 40;
const bnfCacheFile = path.join(root, '.cache', 'bnf.json');
let bnfCache = {};
try { bnfCache = JSON.parse(fs.readFileSync(bnfCacheFile, 'utf8')) || {}; } catch (_) { bnfCache = {}; }
const bnfCalls = [];
const bnfBudget = () => { const now = Date.now(); while (bnfCalls.length && now - bnfCalls[0] > 3600000) bnfCalls.shift(); return BNF_HOURLY_MAX - bnfCalls.length; };
let bnfPersist = true;
let bnfGet = async url => { const r = await fetch(url, { headers: { 'User-Agent': 'PanelComics/1.0 (local collection manager; BnF relay)', Accept: 'application/xml' } }); if (!r.ok) throw Object.assign(new Error('BnF HTTP ' + r.status), { status: r.status }); return r.text(); };
const BNF_PUBLISHERS = /urban|panini|marvel france|semic|delcourt|gl[ée]nat|bliss|hi comics|komics initiative|akileos|futuropolis|dargaud|humano[iï]des|ankama|snorgleux|kinaye|404 [ée]ditions|vents d'ouest|soleil|casterman|dupuis|lombard|wetta|reflexions|graph zeppelin|black river|huginn|vestron|omaké|dc comics/i;
const xmlDecode = t => String(t || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
const handleBnf = async (u, res) => {
  if (u.pathname !== '/api/bnf/editions') return sendJson(res, 404, { error: 'introuvable' });
  const title = String(u.searchParams.get('title') || '').replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (title.length < 2) return sendJson(res, 400, { error: 'paramètres invalides' });
  const key = title.toLowerCase(), hit = bnfCache[key];
  if (hit && Date.now() - hit.at < 14 * 86400000) return sendJson(res, 200, Object.assign({ cached: true }, hit.data));
  if (bnfBudget() < 1) return sendJson(res, 429, { error: 'quota BnF atteint, réessayez dans une heure' });
  try {
    bnfCalls.push(Date.now());
    const q = 'bib.title all "' + title + '" and bib.doctype any "a"';
    const xml = await bnfGet('https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&recordSchema=dublincore&maximumRecords=50&query=' + encodeURIComponent(q));
    const recs = xml.split('<srw:record>').slice(1);
    const field = (r, tag) => [...r.matchAll(new RegExp('<dc:' + tag + '[^>]*>([\\s\\S]*?)</dc:' + tag + '>', 'g'))].map(m => xmlDecode(m[1]).trim());
    const editions = recs.map(r => {
      const ids = field(r, 'identifier');
      const isbn = (ids.map(x => (x.match(/ISBN\s*([0-9Xx-]{10,17})/) || [])[1]).find(Boolean) || '').replace(/-/g, '');
      const ark = ids.find(x => /^https?:\/\/catalogue\.bnf\.fr\/ark:/.test(x)) || '';
      const descs = field(r, 'description');
      return { title: (field(r, 'title')[0] || '').split(' / ')[0].slice(0, 200), publisher: (field(r, 'publisher')[0] || '').slice(0, 120), date: (field(r, 'date')[0] || '').slice(0, 10),
        collection: ((descs.find(x => /^Collection\s*:/.test(x)) || '').replace(/^Collection\s*:\s*/, '')).slice(0, 120), isbn: /^(97[89])?\d{9}[\dX]$/i.test(isbn) ? isbn : '',
        creators: field(r, 'creator').slice(0, 4).map(c => c.replace(/\s*\(.*?\)\.?|\.\s*Auteur.*$|\.\s*Illustrateur.*$/g, '').trim().slice(0, 80)), lang: field(r, 'language')[0] || '',
        url: ark.replace(/^http:/, 'https:') };
    }).filter(e => e.lang === 'fre' && BNF_PUBLISHERS.test(e.publisher) && e.title)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
    const data = { title, editions, source: 'BnF, catalogue général (data.bnf.fr, Licence Ouverte)' };
    bnfCache[key] = { at: Date.now(), data };
    if (bnfPersist) { try { fs.mkdirSync(path.dirname(bnfCacheFile), { recursive: true }); fs.writeFileSync(bnfCacheFile, JSON.stringify(bnfCache)); } catch (_) {} }
    return sendJson(res, 200, data);
  } catch (e) {
    return sendJson(res, 502, { error: 'BnF indisponible', detail: String(e.message || e).slice(0, 120) });
  }
};

// ---------- Relais boutiques (D-69) : /api/shops?lat=48.85&lon=2.35&r=10  ou  /api/shops?q=Lyon&r=10
// Données OpenStreetMap (ODbL) : Overpass pour les boutiques, Nominatim pour une ville ou un code postal tapé.
// La position n'est jamais conservée telle quelle : arrondie à 0,01° (environ 1 km) avant tout envoi, et c'est cette
// position arrondie qui sert de clé de cache (7 jours, .cache/shops.json). Quota : 30 recherches par heure.
const SHOPS_HOURLY_MAX = 30;
const shopsCacheFile = path.join(root, '.cache', 'shops.json');
let shopsCache = {};
try { shopsCache = JSON.parse(fs.readFileSync(shopsCacheFile, 'utf8')) || {}; } catch (_) { shopsCache = {}; }
const shopsCalls = [];
const shopsBudget = () => { const now = Date.now(); while (shopsCalls.length && now - shopsCalls[0] > 3600000) shopsCalls.shift(); return SHOPS_HOURLY_MAX - shopsCalls.length; };
let shopsPersist = true;
const OSM_UA = 'PanelComics/1.0 (local comic collection manager; OpenStreetMap relay)';
// Instances Overpass publiques (Allemagne) : la principale d'abord, puis une instance de secours si elle est saturée (25 s chacune)
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
let osmGet = async (url, body) => {
  const r = await fetch(url, Object.assign(body ? { method: 'POST', headers: { 'User-Agent': OSM_UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body } : { headers: { 'User-Agent': OSM_UA, Accept: 'application/json', 'Accept-Language': 'fr,en' } }, { signal: AbortSignal.timeout(body ? 25000 : 12000) }));
  if (!r.ok) throw Object.assign(new Error('OSM HTTP ' + r.status), { status: r.status });
  return r.json();
};
const round2 = x => Math.round(Number(x) * 100) / 100;
const kmBetween = (a, b, c, d) => { const R = 6371, t = Math.PI / 180, x = Math.sin((c - a) * t / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin((d - b) * t / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const shopsQuery = (lat, lon, m) => '[out:json][timeout:20];(' +
  'nwr(around:' + m + ',' + lat + ',' + lon + ')["shop"~"^(comics?|comic_books?)$"];' +
  'nwr(around:' + m + ',' + lat + ',' + lon + ')["shop"="books"]["books"~"comic|bande",i];' +
  'nwr(around:' + m + ',' + lat + ',' + lon + ')["shop"~"^(books|games|collector|hobby|anime|toys)$"]["name"~"comic|bd|b\\\\.d\\\\.|bande dessin|bulle|bédé|super ?h[ée]ros",i];' +
  ');out center tags 80;';
const httpsOnly = u => /^https:\/\/[^\s"<>]+$/i.test(String(u || '')) ? String(u).slice(0, 300) : (/^www\.[^\s"<>]+$/i.test(String(u || '')) ? 'https://' + String(u).slice(0, 290) : '');
const shopOf = (e, lat, lon) => {
  const t = e.tags || {}, la = e.lat !== undefined ? e.lat : e.center && e.center.lat, lo = e.lon !== undefined ? e.lon : e.center && e.center.lon;
  if (!t.name || typeof la !== 'number' || typeof lo !== 'number') return null;
  const txt = [t.name, t.description, t.books, t['description:fr']].filter(Boolean).join(' ').toLowerCase();
  const kinds = [];
  if (/comic|\bus\b|import|vo\b|marvel|dc /.test(txt) || /^comics?$/.test(t.shop || '')) kinds.push('Comics');
  if (/\bbd\b|b\.d\.|bande dessin|bulle|bédé|franco/.test(txt)) kinds.push('BD');
  if (/manga/.test(txt)) kinds.push('Manga');
  if (t.shop === 'games' || /jeux|games/.test(txt)) kinds.push('Jeux');
  const addr = [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return { id: e.type[0] + e.id, name: String(t.name).slice(0, 120), lat: la, lon: lo, km: Math.round(kmBetween(lat, lon, la, lo) * 10) / 10, address: addr.slice(0, 200),
    hours: String(t.opening_hours || '').slice(0, 200), website: httpsOnly(t.website || t['contact:website']), phone: String(t.phone || t['contact:phone'] || '').replace(/[^\d+ ().-]/g, '').slice(0, 30),
    kinds: kinds.length ? kinds : ['Librairie'], wheelchair: t.wheelchair === 'yes', osm: 'https://www.openstreetmap.org/' + e.type + '/' + e.id };
};
const handleShops = async (u, res) => {
  if (u.pathname !== '/api/shops') return sendJson(res, 404, { error: 'introuvable' });
  const r = [5, 10, 25, 50].includes(Number(u.searchParams.get('r'))) ? Number(u.searchParams.get('r')) : 10;
  const q = String(u.searchParams.get('q') || '').replace(/[^\p{L}\p{N} '\-,.]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  let lat = Number(u.searchParams.get('lat')), lon = Number(u.searchParams.get('lon')), place = '';
  if (!q && !(Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return sendJson(res, 400, { error: 'paramètres invalides' });
  try {
    if (q) {
      if (q.length < 2) return sendJson(res, 400, { error: 'paramètres invalides' });
      const gk = 'q:' + q.toLowerCase();
      if (shopsCache[gk] && Date.now() - shopsCache[gk].at < 30 * 86400000) ({ lat, lon, place } = shopsCache[gk].data);
      else {
        if (shopsBudget() < 2) return sendJson(res, 429, { error: 'quota de recherche atteint, réessayez dans une heure' });
        shopsCalls.push(Date.now());
        const g = await osmGet('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ format: 'jsonv2', limit: '1', addressdetails: '0', q }).toString());
        if (!Array.isArray(g) || !g[0]) return sendJson(res, 200, { place: '', center: null, radius: r, shops: [], notFound: true });
        lat = Number(g[0].lat); lon = Number(g[0].lon); place = String(g[0].display_name || q).split(',').slice(0, 3).join(',').slice(0, 120);
        shopsCache[gk] = { at: Date.now(), data: { lat, lon, place } };
      }
    }
    lat = round2(lat); lon = round2(lon);
    const key = lat + ',' + lon + ',' + r, hit = shopsCache[key];
    if (hit && Date.now() - hit.at < 7 * 86400000) return sendJson(res, 200, Object.assign({ cached: true }, hit.data, { place: place || hit.data.place }));
    if (shopsBudget() < 1) return sendJson(res, 429, { error: 'quota de recherche atteint, réessayez dans une heure' });
    shopsCalls.push(Date.now());
    let d = null, lastErr = null;
    for (const url of OVERPASS) {
      try { d = await osmGet(url, 'data=' + encodeURIComponent(shopsQuery(lat, lon, r * 1000))); if (d && Array.isArray(d.elements) && !/error|timed out|out of memory/i.test(String(d.remark || ''))) break; d = null; lastErr = new Error('Overpass incomplet'); }
      catch (e) { d = null; lastErr = e; }
    }
    if (!d) throw Object.assign(lastErr || new Error('Overpass indisponible'), { status: 503 });
    const seen = new Set();
    const shops = ((d && d.elements) || []).map(e => shopOf(e, lat, lon)).filter(x => x && x.km <= r + 0.5 && !seen.has(x.name.toLowerCase() + '|' + Math.round(x.lat * 500)) && seen.add(x.name.toLowerCase() + '|' + Math.round(x.lat * 500)))
      .sort((a, b) => a.km - b.km).slice(0, 60);
    const data = { place, center: { lat, lon }, radius: r, shops, source: 'OpenStreetMap (ODbL), contributeurs OpenStreetMap' };
    shopsCache[key] = { at: shops.length ? Date.now() : Date.now() - 6 * 86400000, data }; // résultat vide : gardé un jour seulement
    if (shopsPersist) { try { fs.mkdirSync(path.dirname(shopsCacheFile), { recursive: true }); fs.writeFileSync(shopsCacheFile, JSON.stringify(shopsCache)); } catch (_) {} }
    return sendJson(res, 200, data);
  } catch (e) {
    return sendJson(res, e.status === 429 ? 429 : 503, { error: 'OpenStreetMap est saturé ou indisponible, réessayez dans quelques minutes', detail: String(e.message || e).slice(0, 120) });
  }
};

// ---------- Relais actualités (D-69) : /api/news
// Flux RSS publics de sites spécialisés. Panel ne reprend que le titre, un court extrait (240 caractères au plus),
// la date, l'auteur, les rubriques et l'image d'illustration fournie par le flux, avec le lien vers l'article d'origine.
// Chaque flux est relu au plus toutes les 30 minutes (cache disque .cache/news.json).
const NEWS_SOURCES = [
  { id: 'cbr', name: 'CBR', lang: 'en', url: 'https://www.cbr.com/feed/', keep: /comic|marvel|dc |image comics|manga|graphic novel/i },
  { id: 'bleedingcool', name: 'Bleeding Cool', lang: 'en', url: 'https://bleedingcool.com/comics/feed/' },
  { id: 'comicsbeat', name: 'The Comics Beat', lang: 'en', url: 'https://www.comicsbeat.com/feed/' },
  { id: 'comicbook', name: 'ComicBook.com', lang: 'en', url: 'https://comicbook.com/category/comics/feed/' },
  { id: 'superpouvoir', name: 'Superpouvoir', lang: 'fr', url: 'https://www.superpouvoir.com/feed/', keep: /comic|marvel|dc |bd|bande dessin/i },
  { id: 'actuabd', name: 'ActuaBD', lang: 'fr', url: 'https://www.actuabd.com/spip.php?page=backend' },
  { id: 'urban', name: 'Urban Comics', lang: 'fr', url: 'https://www.urban-comics.com/feed/' }
];
const newsCacheFile = path.join(root, '.cache', 'news.json');
let newsCache = {};
try { newsCache = JSON.parse(fs.readFileSync(newsCacheFile, 'utf8')) || {}; } catch (_) { newsCache = {}; }
let newsPersist = true;
let newsGet = async url => { const r = await fetch(url, { headers: { 'User-Agent': 'PanelComics/1.0 (local comic collection manager; news relay)', Accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(15000) }); if (!r.ok && !(r.status >= 300 && r.status < 400)) throw new Error('HTTP ' + r.status); const t = await r.text(); if (!/<(rss|rdf:RDF|channel)[\s>]/i.test(t)) throw new Error('flux illisible'); return t; }; // certains sites renvoient le flux avec un code 301
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê' };
const htmlDecode = t => String(t || '').replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] !== undefined ? ENT[n.toLowerCase()] : m);
const cdata = t => String(t || '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
const plain = t => htmlDecode(htmlDecode(cdata(t)).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const tagOf = (it, tag) => { const m = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i').exec(it); return m ? m[1] : ''; };
const parseFeed = (xml, src) => xml.split(/<item[\s>]/i).slice(1).map(raw => {
  const it = raw.split(/<\/item>/i)[0];
  const link = plain(tagOf(it, 'link'));
  const date = new Date(plain(tagOf(it, 'pubDate')) || plain(tagOf(it, 'dc:date')) || 0);
  const cats = [...it.matchAll(/<(?:category|dc:subject)(?:\s[^>]*)?>([\s\S]*?)<\/(?:category|dc:subject)>/gi)].map(m => plain(m[1])).filter(c => c && !/^\d+$/.test(c)).slice(0, 5);
  let img = (/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i.exec(it) || /<media:(?:content|thumbnail)[^>]+url="([^"]+)"/i.exec(it) || /<img[^>]+src="([^"]+)"/i.exec(htmlDecode(cdata(tagOf(it, 'content:encoded') || tagOf(it, 'description')))) || [])[1] || '';
  img = htmlDecode(img);
  let excerpt = plain(tagOf(it, 'description'));
  if (excerpt.length > 240) excerpt = excerpt.slice(0, 240).replace(/\s+\S*$/, '') + '…';
  return { id: src.id + ':' + link.replace(/^https?:\/\//, '').slice(0, 160), source: src.name, sourceId: src.id, lang: src.lang, title: plain(tagOf(it, 'title')).slice(0, 220), url: /^https:\/\//.test(link) ? link.slice(0, 400) : '',
    date: isNaN(date) ? '' : date.toISOString(), author: plain(tagOf(it, 'dc:creator')).slice(0, 80), categories: cats, excerpt, image: /^https:\/\/[^\s"<>]+$/.test(img) ? img.slice(0, 400) : '' };
}).filter(a => a.title && a.url && (!src.keep || src.keep.test(a.title + ' ' + a.categories.join(' ') + ' ' + a.excerpt)));
const handleNews = async (u, res) => {
  if (u.pathname !== '/api/news') return sendJson(res, 404, { error: 'introuvable' });
  const lang = ['fr', 'en'].includes(u.searchParams.get('lang')) ? u.searchParams.get('lang') : '';
  const now = Date.now(), errors = [];
  await Promise.all(NEWS_SOURCES.filter(src => !lang || src.lang === lang).map(async src => {
    const hit = newsCache[src.id];
    if (hit && now - hit.at < 30 * 60000) return;
    try { const items = parseFeed(await newsGet(src.url), src).slice(0, 25); newsCache[src.id] = { at: now, items }; }
    catch (e) { errors.push(src.name); if (hit) hit.at = now - 25 * 60000; } // en cas d'échec : l'ancienne liste reste servie, nouvel essai dans 5 minutes
  }));
  if (newsPersist) { try { fs.mkdirSync(path.dirname(newsCacheFile), { recursive: true }); fs.writeFileSync(newsCacheFile, JSON.stringify(newsCache)); } catch (_) {} }
  const items = NEWS_SOURCES.filter(src => (!lang || src.lang === lang) && newsCache[src.id]).flatMap(src => newsCache[src.id].items)
    .filter(a => a.date && now - new Date(a.date).getTime() < 21 * 86400000).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80);
  return sendJson(res, 200, { items, sources: NEWS_SOURCES.filter(src => !lang || src.lang === lang).map(src => ({ id: src.id, name: src.name, lang: src.lang, home: new URL(src.url).origin })), unavailable: errors,
    notice: 'Titres, extraits courts et images d\'illustration fournis par les flux RSS publics des sites cités ; les articles restent sur leur site.' });
};

// ---------- Durcissement (D-68)
// 1. Hôte : seules les adresses locales sont servies (protection contre le « DNS rebinding » : un site tiers qui ferait
//    pointer son nom vers 127.0.0.1 ne peut ni lire Panel ni utiliser les relais et leurs quotas).
// 2. Relais /api : refusés aux autres origines (en-tête Origin d'un autre site), lecture seule (GET).
// 3. En-têtes de sécurité sur la page : pas d'intégration dans un cadre, pas de plugin, base et formulaires limités au site,
//    caméra et géolocalisation réservées à Panel, micro, paiement, USB et capteurs refusés.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), interest-cohort=()',
  'Content-Security-Policy': "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; worker-src 'self'; manifest-src 'self'"
};
const requestGuard = (req, res, p) => {
  const host = String(req.headers.host || '');
  if (!LOCAL_HOST.test(host)) { res.writeHead(421, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS }); res.end('Hôte refusé'); return false; }
  if (p.startsWith('/api/')) {
    const origin = req.headers.origin;
    if (origin && origin !== 'null') {
      let ok = false; try { const o = new URL(origin); ok = /^https?:$/.test(o.protocol) && o.host.toLowerCase() === host.toLowerCase(); } catch (_) {}
      if (!ok) { sendJson(res, 403, { error: 'origine refusée' }); return false; }
    }
    if (req.method !== 'GET') { sendJson(res, 405, { error: 'méthode non autorisée' }); return false; }
  } else if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD', ...SECURITY_HEADERS }); res.end(); return false; }
  return true;
};

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); return res.end(); }
  if (!requestGuard(req, res, p)) return;
  // État des relais (aucun secret renvoyé) : l'app vérifie au démarrage quels outils en ligne sont réellement disponibles
  if (p === '/api/status' && req.method === 'GET') return void sendJson(res, 200, { ok: true, cv: !!cvApiKey, metron: !!metronCreds, gcd: true, wd: true, bnf: true, shops: true, news: true });
  if (p.startsWith('/api/gcd/') && req.method === 'GET') return void handleGcd(new URL(req.url, 'http://x'), res);
  if (p.startsWith('/api/metron/') && req.method === 'GET') return void handleMetron(new URL(req.url, 'http://x'), res);
  if (p.startsWith('/api/cv/') && req.method === 'GET') return void handleCv(new URL(req.url, 'http://x'), res);
  if (p === '/api/cv-appearances' && req.method === 'GET') return void handleCvAppearances(new URL(req.url, 'http://x'), res);
  if (p === '/api/news' && req.method === 'GET') return void handleNews(new URL(req.url, 'http://x'), res);
  if (p === '/api/shops' && req.method === 'GET') return void handleShops(new URL(req.url, 'http://x'), res);
  if (p.startsWith('/api/bnf/') && req.method === 'GET') return void handleBnf(new URL(req.url, 'http://x'), res);
  if (p.startsWith('/api/wd/') && req.method === 'GET') return void handleWd(new URL(req.url, 'http://x'), res);
  if (!ALLOWED.test(p)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS }); return res.end('Introuvable'); }
  const file = path.join(root, p === '/' ? 'index.html' : p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // le service worker et la page doivent toujours être revalidés pour recevoir les mises à jour
      'Cache-Control': /\.(html|js|webmanifest)$/.test(file) ? 'no-cache' : /\.woff2$/.test(file) ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
      ...SECURITY_HEADERS
    });
    res.end(req.method === 'HEAD' ? undefined : data);
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
module.exports.setCvAppearancesForTest = () => { cvAppCache = {}; cvAppPersist = false; };
module.exports.setNewsGetForTest = fn => { newsGet = fn; newsCache = {}; newsPersist = false; };
module.exports.setOsmGetForTest = fn => { osmGet = fn; shopsCalls.length = 0; shopsCache = {}; shopsPersist = false; };
module.exports.setBnfGetForTest = fn => { bnfGet = fn; bnfCalls.length = 0; bnfCache = {}; bnfPersist = false; };
module.exports.setWdGetForTest = fn => { wdGet = fn; wdCalls.length = 0; wdCache = {}; wdPersist = false; };
module.exports.setGcdGetForTest = fn => { gcdGet = fn; gcdCalls.length = 0; gcdCache = {}; gcdPersist = false; };
