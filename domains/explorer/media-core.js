'use strict';
// Système documentaire et iconographique d'Explorer (D-48) — fonctions pures, sans réseau, sans stockage, sans données personnelles.
// 1) Fournisseurs de visuels : registre extensible ; un fournisseur n'est actif que si ses conditions sont remplies (aucun ne l'est
//    aujourd'hui en dehors des données locales et des ajouts manuels).
// 2) Références de visuels : provenance complète, statut de droits, statut de vérification, type de visuel.
// 3) Modèle documentaire des événements : série principale, liens typés (tie-in, prélude, épilogue, conséquences…), trois ordres distincts.
// Aucune relation n'est déduite : seules les relations fournies et sourcées sont conservées.

// ---------- 1. Fournisseurs (étude du 8 novembre 2026, à revoir avant toute activation)
const PROVIDER_KINDS = Object.freeze(['local', 'manual', 'official', 'database', 'third_party']);
const PROVIDERS = Object.freeze([
  { id: 'panel_local', label: 'Données Panel (guides, calendrier)', kind: 'local', requiresKey: false, requiresAccount: false, network: false, enabled: true,
    imageRights: 'per_record', terms: '', note: 'Visuels déjà présents dans les données, avec la source et les droits de chaque enregistrement.' },
  { id: 'manual', label: 'Ajout manuel', kind: 'manual', requiresKey: false, requiresAccount: false, network: false, enabled: true,
    imageRights: 'declared', terms: '', note: 'Saisi par l\'utilisateur : source obligatoire, confirmation explicite ; jamais présenté comme officiel.' },
  { id: 'wikimedia_commons', label: 'Wikimedia Commons', kind: 'third_party', requiresKey: false, requiresAccount: false, network: true, enabled: false,
    imageRights: 'per_file', terms: 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia',
    note: 'API publique ; licence propre à chaque fichier. Les couvertures récentes y sont rares (œuvres non libres). Adaptateur prêt, désactivé : aucun service externe n\'est activé.' },
  { id: 'gcd', label: 'Grand Comics Database', kind: 'database', requiresKey: false, requiresAccount: false, network: true, enabled: false,
    imageRights: 'not_granted', terms: 'https://www.comics.org/',
    note: 'Données d\'indexation sous licence libre (attribution, partage dans les mêmes conditions) ; les numérisations de couvertures ne sont pas couvertes par cette licence. Métadonnées seulement, jamais d\'images.' },
  { id: 'metron', label: 'Metron', kind: 'database', requiresKey: false, requiresAccount: true, network: true, enabled: false,
    imageRights: 'not_granted', terms: 'https://metron.cloud/',
    note: 'API avec compte. Droits d\'affichage des couvertures non établis. Désactivé.' },
  { id: 'comic_vine', label: 'Comic Vine', kind: 'database', requiresKey: true, requiresAccount: true, network: true, enabled: false,
    imageRights: 'not_granted', terms: 'https://comicvine.gamespot.com/api/',
    note: 'Clé d\'API requise (clé du projet expirée) ; usage non commercial et attribution exigés ; droits des images non établis. Désactivé.' },
  { id: 'marvel_official', label: 'Marvel (éditeur)', kind: 'official', requiresKey: true, requiresAccount: true, network: true, enabled: false,
    imageRights: 'not_granted', terms: 'https://www.marvel.com/',
    note: 'Source officielle. Disponibilité et conditions d\'une API publique à confirmer ; aucune autorisation d\'affichage obtenue. Visuels officiels ajoutables manuellement, avec leur page d\'origine.' },
  { id: 'dc_official', label: 'DC (éditeur)', kind: 'official', requiresKey: false, requiresAccount: false, network: true, enabled: false,
    imageRights: 'not_granted', terms: 'https://www.dc.com/',
    note: 'Source officielle sans API publique connue ; aucune autorisation d\'affichage obtenue. Ajout manuel avec page d\'origine.' }
]);
const providerById = id => PROVIDERS.find(p => p.id === id) || null;
// Un fournisseur réseau ne peut être actif qu'avec ses prérequis (clé, compte, autorisation) ET une décision explicite
function providerCanRun(p, ctx = {}) {
  if (!p) return { ok: false, reason: 'unknown_provider' };
  if (!p.network) return { ok: p.enabled, reason: p.enabled ? '' : 'disabled' };
  if (!ctx.externalAllowed) return { ok: false, reason: 'external_services_disabled' };
  if (p.requiresKey && !ctx.keys?.[p.id]) return { ok: false, reason: 'missing_key' };
  if (p.requiresAccount && !ctx.accounts?.[p.id]) return { ok: false, reason: 'missing_account' };
  if (!(ctx.enabled || []).includes(p.id)) return { ok: false, reason: 'disabled' };
  return { ok: true, reason: '' };
}

// ---------- 2. Références de visuels
const VISUAL_TYPES = Object.freeze(['cover', 'variant', 'reprint_cover', 'collected_cover', 'promo', 'character_art', 'creator_photo', 'logo']);
const ENTITY_KINDS = Object.freeze(['event', 'guide', 'series', 'run', 'issue', 'publication', 'edition', 'character', 'team', 'creator', 'publisher']);
const VERIFICATION = Object.freeze(['verified', 'user_confirmed', 'unverified', 'disputed']);
const str = (v, max = 300) => (v === null || v === undefined) ? '' : String(v).trim().slice(0, max);
const https = u => { const s = str(u, 1000); return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : ''; };
const isoDate = v => { const s = str(v, 30); return /^\d{4}-\d{2}(-\d{2})?(T[\d:.]+Z)?$/.test(s) ? s : ''; };

function normalizeRef(raw, entity) {
  if (!raw || typeof raw !== 'object') return null;
  const url = https(raw.url);
  if (!url) return null;
  const providerId = providerById(raw.providerId) ? raw.providerId : (raw.manual ? 'manual' : 'panel_local');
  const rights = raw.rights && typeof raw.rights === 'object' ? raw.rights : { statement: str(raw.rights, 300) };
  const display = ['allowed', 'forbidden', 'unknown'].includes(rights.display) ? rights.display : 'unknown';
  const ref = {
    entityKind: ENTITY_KINDS.includes(entity?.kind || raw.entityKind) ? (entity?.kind || raw.entityKind) : '',
    entityId: str(entity?.id || raw.entityId, 120),
    refId: str(raw.refId, 120),
    providerId,
    source: str(raw.source, 120) || (providerById(providerId)?.label || ''),
    url, sourceUrl: https(raw.sourceUrl),
    attribution: str(raw.attribution, 300),
    publisher: str(raw.publisher, 100),
    visualType: VISUAL_TYPES.includes(raw.visualType) ? raw.visualType : 'cover',
    retrievedAt: isoDate(raw.retrievedAt),
    rights: { license: str(rights.license, 80), statement: str(rights.statement, 300), url: https(rights.url), display },
    verification: VERIFICATION.includes(raw.verification) ? raw.verification : (raw.verified === true && providerId !== 'manual' ? 'verified' : 'unverified'),
    tech: { width: Number(raw.tech?.width) > 0 ? Math.round(Number(raw.tech.width)) : null, height: Number(raw.tech?.height) > 0 ? Math.round(Number(raw.tech.height)) : null, mime: str(raw.tech?.mime, 40) }
  };
  // Un ajout manuel ne peut jamais être « vérifié » au sens d'une source officielle : au mieux confirmé par l'utilisateur
  if (providerId === 'manual' && ref.verification === 'verified') ref.verification = 'user_confirmed';
  return ref;
}

// Statut affichable : huit états distincts, du plus fiable au moins établi
const MEDIA_STATUS = Object.freeze({
  official: 'Source officielle', database: 'Base spécialisée', local: 'Données de Panel (source citée)', authorized: 'Source tierce autorisée', manual: 'Ajout manuel',
  unverified: 'Non vérifié', unavailable: 'Indisponible', rights_unknown: 'Droits non établis'
});
function classifyRef(ref, ctx = {}) {
  if (!ref) return 'unavailable';
  if (ctx.failed && ctx.failed(ref.url)) return 'unavailable';
  if (ref.rights.display === 'forbidden') return 'rights_unknown';
  const p = providerById(ref.providerId);
  if (ref.providerId === 'manual') return 'manual';
  if (ref.verification === 'unverified' || ref.verification === 'disputed') return ref.rights.display === 'allowed' || ref.rights.license ? 'unverified' : 'rights_unknown';
  if (p && p.kind === 'official') return 'official';
  if (p && p.kind === 'database') return 'database';
  if (p && p.kind === 'third_party') return ref.rights.license ? 'authorized' : 'rights_unknown';
  return ref.rights.display === 'allowed' || ref.rights.license || ref.rights.statement ? 'local' : 'rights_unknown';
}
const displayable = (ref, ctx = {}) => !!ref && ref.rights.display !== 'forbidden' && !(ctx.failed && ctx.failed(ref.url));

// Choix du visuel d'une entité : jamais une couverture de recueil pour un numéro, jamais une variante quand la couverture principale existe
const TYPE_PREF = Object.freeze({
  issue: ['cover', 'variant', 'reprint_cover'], publication: ['cover', 'variant', 'reprint_cover'], series: ['cover', 'collected_cover', 'promo', 'logo'], run: ['cover', 'collected_cover', 'promo'],
  event: ['promo', 'cover', 'collected_cover', 'logo'], guide: ['promo', 'cover', 'collected_cover', 'logo'], edition: ['collected_cover', 'cover'],
  character: ['character_art', 'promo', 'cover'], team: ['character_art', 'promo', 'cover'], creator: ['creator_photo'], publisher: ['logo']
});
const VERIF_RANK = { verified: 0, user_confirmed: 1, unverified: 2, disputed: 3 };
function pickRef(kind, refs, ctx = {}) {
  const pref = TYPE_PREF[kind] || ['cover'];
  const ok = (refs || []).filter(r => r && displayable(r, ctx) && pref.includes(r.visualType));
  ok.sort((a, b) => (ctx.manualFirst ? (b.providerId === 'manual') - (a.providerId === 'manual') : 0) || pref.indexOf(a.visualType) - pref.indexOf(b.visualType) || VERIF_RANK[a.verification] - VERIF_RANK[b.verification]);
  return ok[0] || null;
}

// Contrôle des associations douteuses (outil de complétion) : rien n'est corrigé automatiquement
function auditRefs(entries, ctx = {}) {
  const issues = [], byUrl = new Map();
  (entries || []).forEach(({ kind, key, ref }) => {
    if (!ref) return;
    const id = kind + ':' + key;
    if (ctx.failed && ctx.failed(ref.url)) issues.push({ id, kind, key, code: 'broken', label: 'Image indisponible' });
    if (ref.verification === 'unverified') issues.push({ id, kind, key, code: 'unverified', label: 'Association non vérifiée' });
    if (ref.verification === 'disputed') issues.push({ id, kind, key, code: 'disputed', label: 'Association contestée' });
    if (!ref.rights.license && !ref.rights.statement && ref.rights.display !== 'allowed') issues.push({ id, kind, key, code: 'rights', label: 'Droits non renseignés' });
    if (!ref.sourceUrl && ref.providerId === 'manual') issues.push({ id, kind, key, code: 'no_origin', label: 'Page d\'origine absente' });
    if ((kind === 'issue' || kind === 'publication') && ref.visualType === 'collected_cover') issues.push({ id, kind, key, code: 'collected_for_issue', label: 'Couverture de recueil associée à un numéro' });
    const list = byUrl.get(ref.url) || []; list.push(id); byUrl.set(ref.url, list);
  });
  byUrl.forEach((ids, url) => { if (ids.length > 1) ids.forEach(id => { const [kind, ...k] = id.split(':'); issues.push({ id, kind, key: k.join(':'), code: 'shared_url', label: 'Même image associée à ' + ids.length + ' entités', url }); }); });
  return issues;
}

// Adaptateur Wikimedia Commons (désactivé) : construction de requête et lecture de réponse, testés sur un échantillon
const FREE_LICENSE_RE = /^(cc0|public domain|pd[- ]|pd$|cc[ -]by(-sa)?[ -][1-4]\.0)/i;
function commonsSearchUrl(query, width = 400) {
  const q = str(query, 200);
  if (!q) return '';
  const p = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6', gsrlimit: '10', gsrsearch: q,
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(Math.max(80, Math.min(1200, width | 0))) });
  return 'https://commons.wikimedia.org/w/api.php?' + p.toString();
}
const stripHtml = s => str(String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '), 300);
function commonsParse(json, entity, visualType = 'cover', retrievedAt = '') {
  const pages = json && json.query && json.query.pages ? Object.values(json.query.pages) : [];
  const out = [], rejected = [];
  pages.forEach(pg => {
    const ii = pg && pg.imageinfo && pg.imageinfo[0];
    if (!ii) return;
    const md = ii.extmetadata || {};
    const lic = str(md.LicenseShortName && md.LicenseShortName.value, 80);
    if (!FREE_LICENSE_RE.test(lic) || md.NonFree?.value === 'true') { rejected.push({ title: str(pg.title, 200), license: lic || 'inconnue' }); return; }
    const ref = normalizeRef({ providerId: 'wikimedia_commons', source: 'Wikimedia Commons', url: ii.thumburl || ii.url, sourceUrl: ii.descriptionurl, refId: 'commons:' + str(pg.pageid, 20),
      attribution: stripHtml(md.Artist && md.Artist.value) || 'Auteur non indiqué', visualType, retrievedAt,
      rights: { license: lic, url: str(md.LicenseUrl && md.LicenseUrl.value, 300), statement: md.AttributionRequired?.value === 'true' ? 'Attribution requise' : '', display: 'allowed' },
      verification: 'unverified', tech: { width: ii.thumbwidth || ii.width, height: ii.thumbheight || ii.height, mime: ii.mime } }, entity);
    if (ref) out.push(ref);
  });
  // Résultat d'une recherche plein texte : l'association à l'entité reste « non vérifiée » tant qu'un humain ne l'a pas confirmée
  return { refs: out, rejected };
}

// ---------- 3. Modèle documentaire des événements
const EVENT_RELATIONS = Object.freeze({ prelude: 'Prélude', tie_in: 'Tie-in', crossover: 'Crossover', epilogue: 'Épilogue', aftermath: 'Conséquences', related_series: 'Série liée' });
const ORDER_KINDS = Object.freeze({ publication: 'Ordre de publication', chronological: 'Ordre chronologique (dans l\'univers)', recommended: 'Ordre de lecture recommandé', reference: 'Ordre de la source citée' });
const ROLES = Object.freeze(['writer', 'artist', 'inker', 'colorist', 'letterer', 'editor', 'cover']);

// « 1-5 », « 0-8 », « 13-14, 16 » → numéros explicites ; au plus 500
function expandIssues(spec) {
  const out = [];
  String(spec || '').split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
    const m = /^#?(\d{1,4})(?:\s*-\s*#?(\d{1,4}))?$/.exec(part);
    if (!m) { if (/^#?[0-9A-Za-z.½-]{1,10}$/.test(part)) out.push(part.replace(/^#/, '')); return; }
    const a = Number(m[1]), b = m[2] !== undefined ? Number(m[2]) : a;
    if (b < a || b - a > 500) return;
    for (let n = a; n <= b && out.length < 500; n++) out.push(String(n));
  });
  return [...new Set(out)];
}

function sanitizeEventBlock(raw, srcIds) {
  if (!raw || typeof raw !== 'object') return null;
  const src = v => { const s = str(v, 50); return srcIds && srcIds.has(s) ? s : ''; };
  const people = list => (Array.isArray(list) ? list : []).slice(0, 20).filter(p => p && str(p.name)).map(p => ({ name: str(p.name, 120), roles: (Array.isArray(p.roles) ? p.roles : []).filter(r => ROLES.includes(r)).slice(0, 7), note: str(p.note, 200) }));
  const ms = raw.mainSeries && typeof raw.mainSeries === 'object' ? raw.mainSeries : null;
  const issues = ms ? (Array.isArray(ms.issues) ? ms.issues : []).slice(0, 200).filter(i => i && str(i.issue, 10)).map(i => ({
    issue: str(i.issue, 10).replace(/^#/, ''), title: str(i.title, 200), coverDate: isoDate(i.coverDate), releaseDate: isoDate(i.releaseDate), creators: people(i.creators), sourceId: src(i.sourceId), note: str(i.note, 300)
  })) : [];
  const seen = new Set();
  const mainSeries = ms && str(ms.series) ? { series: str(ms.series, 200), volume: str(ms.volume, 30), publisher: str(ms.publisher, 100), sourceId: src(ms.sourceId), note: str(ms.note, 300),
    issues: issues.filter(i => (seen.has(i.issue) ? false : (seen.add(i.issue), true))) } : null;
  const links = (Array.isArray(raw.links) ? raw.links : []).slice(0, 300).filter(l => l && EVENT_RELATIONS[l.relation] && str(l.series)).map(l => ({
    relation: l.relation, series: str(l.series, 200), volume: str(l.volume, 30), issues: str(l.issues, 60), note: str(l.note, 300), sourceId: src(l.sourceId),
    readingPos: Number.isInteger(l.readingPos) && l.readingPos > 0 ? l.readingPos : null
  }));
  const texts = list => (Array.isArray(list) ? list : []).slice(0, 30).filter(c => c && str(c.text || c.name)).map(c => ({ text: str(c.text || c.name, 600), sourceId: src(c.sourceId) }));
  return { universe: str(raw.universe, 80), mainSeries, links, consequences: texts(raw.consequences), teams: texts(raw.teams).map(t => ({ name: t.text, sourceId: t.sourceId })) };
}

const issueNum = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 9999; };
// Vue d'un événement : les trois ordres restent séparés ; un ordre absent des données n'est jamais reconstruit à partir d'un autre
function eventView(guide) {
  const ev = guide && guide.event ? guide.event : null;
  const main = ev && ev.mainSeries ? ev.mainSeries.issues.slice().sort((a, b) => issueNum(a.issue) - issueNum(b.issue)) : [];
  const dated = main.filter(i => i.coverDate || i.releaseDate);
  const timeline = dated.slice().sort((a, b) => (a.releaseDate || a.coverDate).localeCompare(b.releaseDate || b.coverDate)).map(i => ({ series: ev.mainSeries.series, volume: ev.mainSeries.volume, issue: i.issue, date: i.releaseDate || i.coverDate, dateKind: i.releaseDate ? 'release' : 'cover' }));
  const groups = {};
  (ev ? ev.links : []).forEach(l => { (groups[l.relation] = groups[l.relation] || []).push(Object.assign({ issueList: expandIssues(l.issues) }, l)); });
  Object.values(groups).forEach(g => g.sort((a, b) => (a.readingPos || 1e9) - (b.readingPos || 1e9) || a.series.localeCompare(b.series)));
  const orders = { publication: [], chronological: [], recommended: [], reference: [] };
  (guide && guide.orders || []).forEach(o => { if (orders[o.type]) orders[o.type].push(o); });
  const linkedIssues = Object.values(groups).reduce((n, g) => n + g.reduce((m, l) => m + l.issueList.length, 0), 0);
  return { main, timeline, groups, orders, counts: { main: main.length, linkedSeries: Object.values(groups).reduce((n, g) => n + g.length, 0), linkedIssues } };
}

// Relations entre événements : signale (sans corriger) les cibles inconnues et les réciproques absentes
function checkEventRelations(guides) {
  const ids = new Set((guides || []).map(g => g.id)), out = [];
  (guides || []).forEach(g => (g.relations || []).forEach(r => {
    if (!r.guideId) return;
    if (!ids.has(r.guideId)) { out.push({ guideId: g.id, code: 'unknown_target', target: r.guideId }); return; }
    const back = { preceded_by: 'followed_by', followed_by: 'preceded_by' }[r.type];
    const other = guides.find(x => x.id === r.guideId);
    if (back && !(other.relations || []).some(x => x.type === back && x.guideId === g.id)) out.push({ guideId: g.id, code: 'missing_reciprocal', target: r.guideId, expected: back });
  }));
  return out;
}

module.exports = { PROVIDER_KINDS, PROVIDERS, providerById, providerCanRun, VISUAL_TYPES, ENTITY_KINDS, VERIFICATION, MEDIA_STATUS, normalizeRef, classifyRef, displayable, pickRef, auditRefs,
  commonsSearchUrl, commonsParse, EVENT_RELATIONS, ORDER_KINDS, expandIssues, sanitizeEventBlock, eventView, checkEventRelations };
