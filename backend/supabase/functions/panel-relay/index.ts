// @ts-nocheck
// FICHIER GÉNÉRÉ par scripts/build-relay.js depuis serve.js : ne pas modifier à la main (D-120).
// Relais hébergé de Panel (Supabase Edge Function). La clé Comic Vine est lue dans les secrets du projet
// (CV_API_KEY), jamais envoyée au navigateur. Aucune donnée personnelle n'est conservée : caches en mémoire seulement.
const process = { env: { CV_API_KEY: ['CV_API_KEY', 'API_COMIC_VINE', 'API COMIC VINE', 'COMIC_VINE_API_KEY', 'COMICVINE_API_KEY'].map(k => Deno.env.get(k) || '').find(Boolean) || '' } };
const fs = { readFileSync() { throw new Error('pas de disque'); }, writeFileSync() {}, mkdirSync() {} };
const path = { join: (...a) => a.join('/'), dirname: p => p };
const root = '';

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
// Langue de la fiche (D-104) : celle de l'interface de Panel ; libellés et résumé dans cette langue, sinon en anglais
const WD_LANGS = ['fr', 'en', 'es', 'pt'];
const wdQuery = (cv, lang) => 'SELECT ?item ?itemLabel ?inception ?frwiki ?enwiki ' + Object.keys(WD_PROPS).map(k => '?' + k + 'Label').join(' ') +
  ' WHERE { ?item wdt:P5905 "' + cv + '". OPTIONAL{?item wdt:P571 ?inception} ' + Object.entries(WD_PROPS).map(([k, pr]) => 'OPTIONAL{?item wdt:' + pr + ' ?' + k + '} ').join('') +
  'OPTIONAL{?frwiki schema:about ?item; schema:isPartOf <https://' + lang + '.wikipedia.org/>} OPTIONAL{?enwiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>} ' +
  'SERVICE wikibase:label { bd:serviceParam wikibase:language "' + lang + ',en". } } LIMIT 200';
const handleWd = async (u, res) => {
  if (u.pathname !== '/api/wd/entity') return sendJson(res, 404, { error: 'introuvable' });
  const cv = String(u.searchParams.get('cv') || '');
  if (!/^40(05|40|60|45|10)-\d{1,9}$/.test(cv)) return sendJson(res, 400, { error: 'paramètres invalides' });
  const lang = WD_LANGS.includes(u.searchParams.get('lang')) ? u.searchParams.get('lang') : 'fr';
  const ck = lang === 'fr' ? cv : cv + '|' + lang;
  const hit = wdCache[ck];
  if (hit && Date.now() - hit.at < GCD_CACHE_TTL) return sendJson(res, 200, Object.assign({ cached: true }, hit.data));
  if (wdBudget() < 2) return sendJson(res, 429, { error: 'quota Wikidata atteint, réessayez dans une heure' });
  try {
    wdCalls.push(Date.now());
    const d = await wdGet('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(wdQuery(cv, lang)), 'application/sparql-results+json');
    const rows = (d && d.results && d.results.bindings) || [];
    const val = (r, k) => r[k] && typeof r[k].value === 'string' ? r[k].value.slice(0, 200) : '';
    const uniq = k => [...new Set(rows.map(r => val(r, k + 'Label')).filter(v => v && !/^Q\d+$/.test(v) && !/^https?:/.test(v)))].slice(0, 12);
    const first = rows[0] || {};
    const data = { found: !!rows.length, qid: (val(first, 'item').match(/Q\d+$/) || [''])[0], label: val(first, 'itemLabel'), inception: val(first, 'inception').slice(0, 10),
      residence: uniq('res'), universe: uniq('univ'), creators: uniq('creator'), birthplace: uniq('pob'), sex: uniq('sex'), memberOf: uniq('member'), firstAppearance: uniq('first'),
      occupation: uniq('occupation'), citizenship: uniq('citizen'), frwiki: val(first, 'frwiki'), enwiki: val(first, 'enwiki'), summary: '', summaryLang: '', summaryUrl: '' };
    // Résumé Wikipédia (langue de l'interface d'abord, sinon anglais), extrait court avec lien vers l'article
    data.lang = lang;
    const wiki = data.frwiki || data.enwiki;
    if (wiki && /^https:\/\/(fr|en|es|pt)\.wikipedia\.org\/wiki\/[^\s?#]+$/.test(wiki)) {
      wdCalls.push(Date.now());
      const lang = wiki.slice(8, 10), title = wiki.split('/wiki/')[1];
      const sm = await wdGet('https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + title).catch(() => null);
      if (sm && typeof sm.extract === 'string') { data.summary = sm.extract.slice(0, 1200); data.summaryLang = lang; data.summaryUrl = wiki; }
    }
    data.source = 'Wikidata (CC0)' + (data.summary ? ' · Wikipédia (CC BY-SA 4.0)' : '');
    wdCache[ck] = { at: Date.now(), data };
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
const FR_COMICS_KEEP = /comics?\b|marvel|\bdc\b|batman|superman|spider-?man|spider-?verse|avengers|x-men|super-?h[ée]ros|\bbd\b|bande[s]? dessin|manga|wolverine|deadpool|daredevil|thunderbolts|fantastiques|joker|gotham|supergirl|lanterns|venom|hellboy|invincible|ast[ée]rix|tintin|angoul[êe]me/i;
const NEWS_SOURCES = [
  { id: 'cbr', name: 'CBR', lang: 'en', url: 'https://www.cbr.com/feed/', keep: /comic|marvel|dc |image comics|manga|graphic novel/i },
  { id: 'bleedingcool', name: 'Bleeding Cool', lang: 'en', url: 'https://bleedingcool.com/comics/feed/' },
  { id: 'comicsbeat', name: 'The Comics Beat', lang: 'en', url: 'https://www.comicsbeat.com/feed/' },
  { id: 'comicbook', name: 'ComicBook.com', lang: 'en', url: 'https://comicbook.com/category/comics/feed/' },
  { id: 'superpouvoir', name: 'Superpouvoir', lang: 'fr', url: 'https://www.superpouvoir.com/feed/', keep: /comic|marvel|dc |bd\b|bande dessin/i },
  { id: 'actuabd', name: 'ActuaBD', lang: 'fr', url: 'https://www.actuabd.com/spip.php?page=backend' },
  { id: 'urban', name: 'Urban Comics', lang: 'fr', url: 'https://www.urban-comics.com/feed/' },
  // D-75 : plus de sources en français ; les sites généralistes (cinéma, pop culture) sont filtrés sur les comics, la BD et les super-héros
  { id: 'bdzoom', name: 'BDzoom', lang: 'fr', url: 'https://www.bdzoom.com/feed/' },
  { id: 'ligneclaire', name: 'Ligne Claire', lang: 'fr', url: 'https://www.ligneclaire.info/feed' },
  { id: 'ecranlarge', name: 'Écran Large', lang: 'fr', url: 'https://www.ecranlarge.com/rss', keep: FR_COMICS_KEEP },
  { id: 'allocine', name: 'AlloCiné', lang: 'fr', url: 'https://www.allocine.fr/rss/news-cine.xml', keep: FR_COMICS_KEEP },
  { id: 'journaldugeek', name: 'Journal du Geek', lang: 'fr', url: 'https://www.journaldugeek.com/feed/', keep: FR_COMICS_KEEP },
  { id: 'numerama', name: 'Numerama Pop culture', lang: 'fr', url: 'https://www.numerama.com/pop-culture/feed/', keep: FR_COMICS_KEEP }
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
    .filter(a => a.date && now - new Date(a.date).getTime() < 21 * 86400000).sort((a, b) => b.date.localeCompare(a.date))
    .filter((a, i, all) => all.slice(0, i).filter(x => x.lang === a.lang).length < 120); // D-75 : 120 articles au plus par langue (le français n'est plus évincé)
  return sendJson(res, 200, { items, sources: NEWS_SOURCES.filter(src => !lang || src.lang === lang).map(src => ({ id: src.id, name: src.name, lang: src.lang, home: new URL(src.url).origin })), unavailable: errors,
    notice: 'Titres, extraits courts et images d\'illustration fournis par les flux RSS publics des sites cités ; les articles restent sur leur site.' });
};


// ---------- Garde du relais hébergé : origines autorisées, lecture seule, adresses bornées, débit par adresse IP
const ORIGINS = /^(https:\/\/lukecage2003\.github\.io|https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?)$/;
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'cross-origin' };
const PER_MIN = 90;
let hits = new Map();
const rateOk = ip => {
  const win = Math.floor(Date.now() / 60000), e = hits.get(ip);
  if (!e || e.win !== win) { if (hits.size > 5000) hits = new Map(); hits.set(ip, { win, n: 1 }); return true; }
  return ++e.n <= PER_MIN;
};
const reply = (code, obj, cors) => new Response(JSON.stringify(obj), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', ...SEC, ...cors } });

Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  const cors = ORIGINS.test(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
  if (req.method === 'OPTIONS') return new Response(null, { status: cors['Access-Control-Allow-Origin'] ? 204 : 403, headers: { ...SEC, ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
  if (!cors['Access-Control-Allow-Origin']) return reply(403, { error: 'origine refusée' }, {});
  if (req.method !== 'GET') return reply(405, { error: 'lecture seule' }, cors);
  if (req.url.length > 2048) return reply(414, { error: 'adresse trop longue' }, cors);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'inconnu';
  if (!rateOk(ip)) return reply(429, { error: 'trop de requêtes, réessayez dans une minute' }, cors);
  const u = new URL(req.url);
  const p = u.pathname.replace(/^.*?\/panel-relay(?=\/|$)/, '/api').replace(/\/$/, '');
  const pu = new URL(p + u.search, 'http://relais');
  let out = { code: 500, headers: {}, body: '' };
  const res = { writeHead(code, h) { out.code = code; out.headers = h || {}; }, end(b) { out.body = b || ''; } };
  try {
    if (p === '/api/status') return reply(200, { ok: true, hosted: true, cv: !!cvApiKey, metron: false, gcd: true, wd: true, bnf: true, shops: true, news: true }, cors);
    if (p.startsWith('/api/gcd/')) await handleGcd(pu, res);
    else if (p.startsWith('/api/cv/')) await handleCv(pu, res);
    else if (p === '/api/cv-appearances') await handleCvAppearances(pu, res);
    else if (p.startsWith('/api/wd/')) await handleWd(pu, res);
    else if (p.startsWith('/api/bnf/')) await handleBnf(pu, res);
    else if (p === '/api/shops') await handleShops(pu, res);
    else if (p === '/api/news') await handleNews(pu, res);
    else return reply(404, { error: 'introuvable' }, cors);
  } catch (_) { return reply(502, { error: 'relais indisponible' }, cors); }
  return new Response(out.body, { status: out.code, headers: { ...out.headers, ...SEC, ...cors } });
});
