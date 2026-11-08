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

// Fiabilité documentaire (D-52). Trois axes distincts, jamais confondus :
// - recoupement : combien de sources citent la série et si elles concordent ; deux sources ne sont « indépendantes » que si l'une le déclare
//   avec une justification (independentOf + independenceNote) : sinon la concordance n'est PAS une corroboration ;
// - vérification : seule une source de type « bibliographic » (base bibliographique) peut vérifier l'identification d'une série et son nombre de numéros ;
//   elle ne vérifie jamais le rattachement de la série à l'événement ;
// - écarts : chaque différence est qualifiée (périmètre, placement, absence…) ; une absence d'information n'est jamais une contradiction.
const DIVERGENCE_KINDS = Object.freeze({ scope: 'Différence de périmètre', placement: 'Différence de placement', absence: 'Information absente d\'une source (pas une contradiction)',
  same_source: 'Ambiguïté interne à une source', explained: 'Écart expliqué', real: 'Divergence réelle (contestée)' });
const RELIABILITY = Object.freeze({ recorded: 'Relevé depuis une source', concordant: 'Concordant (indépendance non établie)', partial: 'Recoupé avec écarts', corroborated: 'Corroboré par des sources indépendantes', contested: 'Contesté' });
const VERIFICATION_LEVELS = Object.freeze({ verified: 'Vérifié (référence bibliographique)', gap: 'Écart avec la référence bibliographique', unverified: 'Non vérifié' });
const AUTO_KIND = Object.freeze({ issues: 'scope', relation: 'placement', relation_series: 'placement', volume: 'scope' });

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
  // Qualité documentaire (D-51) : divergences explicites entre sources, informations incertaines, publications non identifiées
  const divergences = (Array.isArray(raw.divergences) ? raw.divergences : []).slice(0, 60).filter(d => d && str(d.text)).map(d => ({ topic: str(d.topic, 120), text: str(d.text, 600),
    sourceIds: [...new Set((Array.isArray(d.sourceIds) ? d.sourceIds : []).map(src).filter(Boolean))],
    kind: DIVERGENCE_KINDS[d.kind] ? d.kind : '', series: str(d.series, 200), explanation: str(d.explanation, 800) }));
  // Fiabilité (D-52) : faits bibliographiques (titre, années, nombre de numéros) ; jamais sans source
  const verifications = (Array.isArray(raw.verifications) ? raw.verifications : []).slice(0, 200).filter(v => v && str(v.series) && Number.isInteger(v.issueCount) && v.issueCount > 0 && src(v.sourceId)).map(v => ({
    series: str(v.series, 200), matches: (Array.isArray(v.matches) ? v.matches : []).slice(0, 6).map(m => str(m, 200)).filter(Boolean), years: str(v.years, 20), issueCount: v.issueCount, sourceId: src(v.sourceId), note: str(v.note, 400) }));
  const notes = list => { const ok = (Array.isArray(list) ? list : []).slice(0, 30).filter(c => c && str(c.text || c.name)); return texts(ok).map((c, i) => Object.assign(c, { explanation: str(ok[i].explanation, 800) })); };
  return { universe: str(raw.universe, 80), mainSeries, links, consequences: texts(raw.consequences), teams: texts(raw.teams).map(t => ({ name: t.text, sourceId: t.sourceId })),
    divergences, uncertain: notes(raw.uncertain), unidentified: notes(raw.unidentified), verifications };
}

const issueNum = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 9999; };
// Vue d'un événement : les trois ordres restent séparés ; un ordre absent des données n'est jamais reconstruit à partir d'un autre
function eventView(guide) {
  const ev = guide && guide.event ? guide.event : null;
  const main = ev && ev.mainSeries ? ev.mainSeries.issues.slice().sort((a, b) => issueNum(a.issue) - issueNum(b.issue)) : [];
  const dated = main.filter(i => i.coverDate || i.releaseDate);
  const timeline = dated.slice().sort((a, b) => (a.releaseDate || a.coverDate).localeCompare(b.releaseDate || b.coverDate)).map(i => ({ series: ev.mainSeries.series, volume: ev.mainSeries.volume, issue: i.issue, date: i.releaseDate || i.coverDate, dateKind: i.releaseDate ? 'release' : 'cover' }));
  const groups = {};
  const merged = new Map();
  (ev ? ev.links : []).forEach(l => {
    const k = l.relation + '|' + seriesKey(l.series), list = expandIssues(l.issues), cur = merged.get(k);
    if (!cur) { merged.set(k, Object.assign({}, l, { issueList: list.slice(), sourceIds: l.sourceId ? [l.sourceId] : [], notes: l.note ? [l.note] : [], perSource: [{ sourceId: l.sourceId, issues: list }] })); return; }
    list.forEach(n => { if (!cur.issueList.includes(n)) cur.issueList.push(n); });
    if (l.sourceId && !cur.sourceIds.includes(l.sourceId)) cur.sourceIds.push(l.sourceId);
    if (l.note && !cur.notes.includes(l.note)) cur.notes.push(l.note);
    if (!cur.volume && l.volume) cur.volume = l.volume;
    cur.perSource.push({ sourceId: l.sourceId, issues: list });
  });
  merged.forEach(l => {
    l.issueList.sort((a, b) => issueNum(a) - issueNum(b));
    const withNums = l.perSource.filter(p => p.issues.length);
    l.divergent = withNums.length > 1 && withNums.some(p => p.issues.length !== l.issueList.length);
    l.note = l.notes.join(' ');
    (groups[l.relation] = groups[l.relation] || []).push(l);
  });
  Object.values(groups).forEach(g => g.sort((a, b) => (a.readingPos || 1e9) - (b.readingPos || 1e9) || a.series.localeCompare(b.series)));
  const orders = { publication: [], chronological: [], recommended: [], reference: [] };
  (guide && guide.orders || []).forEach(o => { if (orders[o.type]) orders[o.type].push(o); });
  const linkedIssues = Object.values(groups).reduce((n, g) => n + g.reduce((m, l) => m + l.issueList.length, 0), 0);
  return { main, timeline, groups, orders, counts: { main: main.length, linkedSeries: Object.values(groups).reduce((n, g) => n + g.length, 0), linkedIssues } };
}

// Recoupement (D-51) : par série et par numéro, compare ce que chaque source affirme ; rien n'est tranché ni supprimé.
// corroborated : au moins deux sources, mêmes numéros et même relation ; divergent : numéros ou relation différents ; single : une seule source.
const seriesKey = s => str(s, 200).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/\bthe\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
function crossCheck(guide) {
  const ev = guide && guide.event, bySeries = new Map();
  (ev ? ev.links : []).forEach(l => {
    const k = seriesKey(l.series); if (!k) return;
    const g = bySeries.get(k) || { series: l.series, volumes: new Set(), sources: new Map() };
    if (l.volume) g.volumes.add(l.volume);
    const s = g.sources.get(l.sourceId || '?') || { relations: new Set(), issues: new Map() };
    s.relations.add(l.relation);
    expandIssues(l.issues).forEach(n => { const r = s.issues.get(n) || new Set(); r.add(l.relation); s.issues.set(n, r); });
    g.sources.set(l.sourceId || '?', s); bySeries.set(k, g);
  });
  const items = [];
  bySeries.forEach(g => {
    const srcs = [...g.sources.entries()], reasons = [];
    const byRel = id => { const m = new Map(); g.sources.get(id).issues.forEach((rels, n) => rels.forEach(r => { const s = m.get(r) || new Set(); s.add(n); m.set(r, s); })); return m; };
    const numbered = srcs.filter(([, s]) => s.issues.size).map(([id]) => ({ id, rel: byRel(id) }));
    const all = new Set(); numbered.forEach(x => x.rel.forEach(set => set.forEach(n => all.add(n))));
    // Même relation, numéros différents : comparaison relation par relation (une source sans préludes ne contredit pas une source qui en cite)
    const rels = new Set(); numbered.forEach(x => x.rel.forEach((_, r) => rels.add(r)));
    rels.forEach(r => {
      const sets = numbered.filter(x => x.rel.has(r)).map(x => ({ sourceId: x.id, issues: [...x.rel.get(r)].sort((p, q) => issueNum(p) - issueNum(q)) }));
      if (sets.length < 2) return;
      const u = new Set(); sets.forEach(s => s.issues.forEach(n => u.add(n)));
      const missing = [...u].filter(n => sets.some(s => !s.issues.includes(n))).sort((p, q) => issueNum(p) - issueNum(q));
      if (missing.length) reasons.push({ code: 'issues', relation: r, issues: missing, detail: sets });
    });
    // Même numéro, relations différentes selon la source
    const conflicts = [...all].filter(n => { const per = numbered.map(x => [...x.rel.entries()].filter(([, s]) => s.has(n)).map(([r]) => r)).filter(l => l.length);
      return per.length > 1 && per.some(l => per.some(m => !l.some(r => m.includes(r)))); }).sort((p, q) => issueNum(p) - issueNum(q));
    if (conflicts.length) reasons.push({ code: 'relation', issues: conflicts });
    if (srcs.length > 1) { const sets = srcs.map(([, s]) => s.relations); if (sets.some(x => sets.some(y => ![...x].some(r => y.has(r))))) reasons.push({ code: 'relation_series' }); }
    if (g.volumes.size > 1) reasons.push({ code: 'volume', volumes: [...g.volumes] });
    reasons.forEach(r => { r.kind = AUTO_KIND[r.code]; });
    items.push(Object.assign({ series: g.series, key: seriesKey(g.series), sourceIds: srcs.map(([id]) => id), numberSources: numbered.length, status: srcs.length < 2 ? 'single' : reasons.length ? 'divergent' : 'corroborated', reasons, issueCount: all.size, incomplete: all.size === 0 },
      reliabilityOf(guide, seriesKey(g.series), srcs.map(([id]) => id), reasons), verificationOf(guide, seriesKey(g.series), [...all])));
  });
  items.sort((a, b) => a.series.localeCompare(b.series));
  const stats = { corroborated: 0, divergent: 0, single: 0 }, levels = { recorded: 0, concordant: 0, partial: 0, corroborated: 0, contested: 0 }, verification = { verified: 0, gap: 0, unverified: 0 };
  items.forEach(i => { stats[i.status]++; levels[i.level]++; verification[i.verification]++; });
  const incomplete = items.filter(i => i.incomplete).length;
  const ms = ev && ev.mainSeries;
  const mainCheck = ms ? Object.assign({ series: ms.series, issueCount: ms.issues.length }, verificationOf(guide, seriesKey(ms.series), ms.issues.map(i => i.issue))) : null;
  const main = ms ? ms.issues.length : 0;
  const publications = main + [...bySeries.values()].reduce((n, g) => { const s = new Set(); g.sources.forEach(x => x.issues.forEach((_, k) => s.add(k))); return n + s.size; }, 0);
  return { items, stats, levels, verification, incomplete, main: mainCheck, publications, sources: [...new Set([].concat(...items.map(i => i.sourceIds)))].filter(x => x !== '?') };
}

const srcOf = (guide, id) => ((guide && guide.sources) || []).find(s => s.id === id) || null;
const srcName = (guide, id) => { const s = srcOf(guide, id); return s ? s.label : id; };
// Indépendance : déclarée et justifiée par l'une des deux sources, jamais supposée
function sourcesIndependent(guide, a, b) {
  const decl = (x, y) => !!x && Array.isArray(x.independentOf) && x.independentOf.includes(y) && !!str(x.independenceNote);
  return a !== b && (decl(srcOf(guide, a), b) || decl(srcOf(guide, b), a));
}
const divergencesFor = (guide, key) => ((guide && guide.event && guide.event.divergences) || []).filter(d => seriesKey(d.series || d.topic) === key);
function reliabilityOf(guide, key, ids, reasons) {
  const known = ids.filter(id => id !== '?'), names = known.map(id => srcName(guide, id)).join(' ; ');
  const real = divergencesFor(guide, key).find(d => d.kind === 'real');
  if (real) return { level: 'contested', why: 'Divergence réelle signalée entre sources : ' + real.text };
  if (known.length < 2) return { level: 'recorded', why: 'Relevé depuis une seule source (' + (names || 'source non attribuée') + ') ; non recoupé.' };
  if (reasons.length) {
    const kinds = [...new Set(reasons.map(r => DIVERGENCE_KINDS[r.kind]))].join(', ').toLowerCase();
    return { level: 'partial', why: 'Cité par ' + known.length + ' sources (' + names + ') avec des écarts : ' + kinds + '. Écart conservé, non tranché.' };
  }
  const indep = known.some((a, i) => known.slice(i + 1).some(b => sourcesIndependent(guide, a, b)));
  if (indep) return { level: 'corroborated', why: 'Cité de façon identique par ' + known.length + ' sources dont l\'indépendance est justifiée (' + names + ').' };
  return { level: 'concordant', why: 'Cité de façon identique par ' + known.length + ' sources (' + names + ') ; leur indépendance n\'est pas établie : concordance, pas corroboration.' };
}
// Vérification : seule une source « bibliographic » compte ; elle porte sur l'identification et la numérotation, pas sur le rattachement à l'événement
function verificationOf(guide, key, nums) {
  const v = ((guide && guide.event && guide.event.verifications) || []).find(x => (srcOf(guide, x.sourceId) || {}).kind === 'bibliographic' && [x.series].concat(x.matches || []).some(n => seriesKey(n) === key));
  if (!v) return { verification: 'unverified', verificationWhy: 'Aucune référence bibliographique consultée pour cette série.' };
  const base = 'Référence bibliographique (' + srcName(guide, v.sourceId) + ') : ' + v.series + (v.years ? ' (' + v.years + ')' : '') + ', ' + v.issueCount + ' numéro(s).';
  const out = nums.filter(n => !/^\d+$/.test(String(n)) || Number(n) < 1 || Number(n) > v.issueCount);
  if (out.length) return { verification: 'gap', verificationWhy: base + ' Numéro(s) cité(s) hors de cet intervalle : #' + out.join(', #') + '.' + (v.note ? ' ' + v.note : ''), verificationSourceId: v.sourceId };
  return { verification: 'verified', verificationWhy: base + (nums.length ? ' Numéros cités compris entre #1 et #' + v.issueCount + '.' : '') + ' Seules l\'identification et la numérotation sont vérifiées, pas le rattachement à l\'événement.' + (v.note ? ' ' + v.note : ''), verificationSourceId: v.sourceId };
}

// Fusion d'un complément de recoupement dans un guide brut : ajoute sources, liens et notes de qualité, sans rien retirer ni réécrire
function mergeCrossref(raw, cr) {
  if (!raw || !cr) return raw;
  const g = JSON.parse(JSON.stringify(raw)), ev = g.event = g.event || { links: [] };
  g.sources = (g.sources || []).concat(JSON.parse(JSON.stringify(cr.sources || [])).filter(s => !(g.sources || []).some(x => x.id === s.id)));
  ev.links = (ev.links || []).concat(JSON.parse(JSON.stringify(cr.links || [])));
  ['divergences', 'uncertain', 'unidentified', 'verifications'].forEach(k => { ev[k] = (ev[k] || []).concat(JSON.parse(JSON.stringify(cr[k] || []))); });
  g.seedVersion = (g.seedVersion || 1) + (Number.isInteger(cr.version) && cr.version > 0 ? cr.version : 1);
  return g;
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
  commonsSearchUrl, commonsParse, EVENT_RELATIONS, ORDER_KINDS, expandIssues, sanitizeEventBlock, eventView, checkEventRelations, crossCheck, seriesKey, mergeCrossref,
  DIVERGENCE_KINDS, RELIABILITY, VERIFICATION_LEVELS, sourcesIndependent };
