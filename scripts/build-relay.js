// Génère la fonction Supabase « panel-relay » à partir des relais de serve.js (D-120).
// Une seule source : les relais Comic Vine, GCD, Wikidata, BnF, boutiques et actualités sont repris tels quels,
// avec des remplacements minimaux pour Deno (pas de disque : caches en mémoire de l'instance).
// Metron reste local (identifiants personnels, jamais envoyés à un serveur hébergé).
//   node scripts/build-relay.js          -> écrit backend/supabase/functions/panel-relay/index.ts
//   node scripts/build-relay.js --check  -> vérifie que le fichier est à jour
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'serve.js'), 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');
const at = marker => { const i = lines.findIndex(l => l.startsWith('// ---------- ' + marker)); if (i < 0) throw new Error('repère introuvable : ' + marker); return i; };
const part = (from, to) => lines.slice(at(from), at(to)).join('\n');

const body = [part('Relais GCD', 'Relais Metron'), part('Relais Wikidata', 'Durcissement')].join('\n\n');
if (/require\(|process\.argv|readline/.test(body)) throw new Error('code Node non transposable dans les relais repris');

const out = `// @ts-nocheck
// FICHIER GÉNÉRÉ par scripts/build-relay.js depuis serve.js : ne pas modifier à la main (D-120).
// Relais hébergé de Panel (Supabase Edge Function). La clé Comic Vine est lue dans les secrets du projet
// (CV_API_KEY), jamais envoyée au navigateur. Aucune donnée personnelle n'est conservée : caches en mémoire seulement.
const process = { env: { CV_API_KEY: Deno.env.get('CV_API_KEY') || '' } };
const fs = { readFileSync() { throw new Error('pas de disque'); }, writeFileSync() {}, mkdirSync() {} };
const path = { join: (...a) => a.join('/'), dirname: p => p };
const root = '';

${body}

// ---------- Garde du relais hébergé : origines autorisées, lecture seule, adresses bornées, débit par adresse IP
const ORIGINS = /^(https:\\/\\/lukecage2003\\.github\\.io|https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d{1,5})?)$/;
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
  const p = u.pathname.replace(/^.*?\\/panel-relay(?=\\/|$)/, '/api').replace(/\\/$/, '');
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
`;

const file = path.join(root, 'backend', 'supabase', 'functions', 'panel-relay', 'index.ts');
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (cur !== out) { console.error('build-relay : panel-relay/index.ts n\'est pas à jour (node scripts/build-relay.js)'); process.exit(1); }
  console.log('build-relay : relais hébergé identique à serve.js.');
} else {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
  console.log('build-relay : ' + path.relative(root, file) + ' écrit (' + out.length + ' octets).');
}
