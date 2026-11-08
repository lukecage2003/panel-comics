'use strict';
// Catalogue commun de publications (R1, D-55) — module autonome : ni réseau, ni stockage, ni accès direct aux autres domaines.
// Rôle : donner à chaque publication physique de comics une identité stable, partagée par Collection, Sorties, Explorer
// (événements, guides) et, plus tard, Pull List, Community et Discover. Les modules gardent leurs propres fiches ;
// ils y ajoutent une RÉFÉRENCE (refs) vers l'identité commune. Rien n'est supprimé ni réécrit dans leurs données.
//
// Niveaux distingués :
//  - publisher (éditeur) ;
//  - series (série, avec son volume et/ou son année de début ; type : en cours, mini-série, one-shot, recueil) ;
//  - issue (numéro individuel, unique par série et numéro) ;
//  - variant (couverture variante OU réimpression d'un numéro : kind 'cover' | 'printing' ; la couverture principale est 'main') ;
//  - edition (recueil ou édition traduite : TPB, HC, omnibus, album VF… identifiée par ISBN quand il existe, avec ses contenus).
// Règles :
//  - aucun identifiant externe n'est inventé : seuls ceux fournis par l'entrée sont gardés, après contrôle de forme ;
//  - un identifiant externe déjà porté par une autre publication bloque la fusion automatique (ambiguïté signalée) ;
//  - dates bibliographiques distinctes : couverture, mise en vente, date limite de commande (FOC) ;
//  - chaque valeur garde sa source ; une valeur différente d'une autre source est conservée comme écart, jamais écrasée ;
//  - une entrée sans discriminant (ni volume ni année) ne crée jamais de fusion silencieuse entre séries homonymes ;
//  - manga, manhwa, manhua et webtoons sont refusés (D-54) : rien n'est créé, l'entrée est comptée « hors périmètre » ;
//  - aucune image : seul un statut de couverture et de droits est porté (les visuels restent dans media-core) ;
//  - fusions et liaisons manuelles journalisées et annulables (dernière opération d'abord).

const FORMAT = 'panel-publications', VERSION = 1;
const SERIES_TYPES = Object.freeze({ ongoing: 'Série en cours', limited: 'Mini-série', one_shot: 'One-shot', collection: 'Recueil', unknown: 'Non précisé' });
const VARIANT_KINDS = Object.freeze({ main: 'Couverture principale', cover: 'Couverture variante', printing: 'Réimpression' });
const EDITION_FORMATS = Object.freeze({ tpb: 'TPB / recueil', hc: 'Hardcover', omnibus: 'Omnibus', album: 'Album', integrale: 'Intégrale', deluxe: 'Deluxe', other: 'Autre recueil' });
const EXT_SYSTEMS = Object.freeze({
  comicvine: /^\d{1,9}$/, metron: /^\d{1,9}$/, gcd: /^\d{1,9}$/, locg: /^\d{1,10}$/, clz: /^[A-Za-z0-9_-]{1,40}$/,
  upc: /^\d{12}(\d{5})?$/, isbn: /^(97[89]\d{10}|\d{9}[\dX])$/
});
const SOURCE_KINDS = Object.freeze(['manual', 'collection', 'import', 'release', 'guide', 'reference', 'bibliographic']);
const VERIFICATION = Object.freeze({ recorded: 'Relevé (une source)', concordant: 'Concordant (plusieurs sources)', verified: 'Vérifié (référence bibliographique)' });
const OUT_OF_SCOPE_RE = /\b(manga|manhwa|manhua|webtoon)\b/;

// ---------- Normalisation
const str = (v, max = 200) => (v === null || v === undefined) ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max);
const fold = s => str(s, 300).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const normTitle = s => fold(s).replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/^the /, '').trim();
const PUB_NOISE = /\b(comics?|inc|llc|ltd|publishing|publications?|entertainment|group|press|studios?)\b/g;
const normPublisher = s => fold(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(PUB_NOISE, ' ').replace(/\s+/g, ' ').trim();
// « #001 » → « 1 », « 1.MU » → « 1.mu », « ½ » conservé, « Annual 1 » conservé tel quel (normalisé)
const normIssue = v => {
  let s = fold(v).replace(/^#\s*/, '').replace(/\s+/g, ' ');
  const m = /^(-?)0*(\d+)(.*)$/.exec(s);
  if (m) s = m[1] + m[2] + m[3].replace(/\s+/g, '');
  return s.slice(0, 20);
};
const MAIN_VARIANT = /^(|main|regular|standard|normal|cover a|a cover|cvr a|couverture a|couverture principale|principale|direct|direct edition)$/;
const normVariant = v => { const s = fold(v).replace(/[^a-z0-9.]+/g, ' ').trim(); return MAIN_VARIANT.test(s) ? 'main' : s.slice(0, 80); };
const PRINTING_RE = /\b(\d+)(?:st|nd|rd|th|e|eme|ème)?\s*(?:printing|print|ptg|impression|tirage)\b/;
const normVolume = v => { const m = /(\d{1,3})/.exec(fold(v)); return m ? String(Number(m[1])) : ''; };
const year = v => { const m = /\b(1[89]\d{2}|20\d{2})\b/.exec(str(v, 40)); return m ? Number(m[1]) : null; };
const isoDate = v => { const s = str(v, 30); return /^\d{4}-\d{2}(-\d{2})?$/.test(s) ? s : ''; };
// Titre de série saisi avec année ou volume : « Wolverine (2003) », « Wolverine Vol. 3 »
const splitSeries = raw => {
  const s = str(raw, 200);
  const y = (s.match(/\((?:[^)]*?)\b(1[89]\d{2}|20\d{2})\b[^)]*\)/) || [])[1] || null;
  const v = (s.match(/\bvol(?:ume)?\.?\s*(\d{1,3})\b/i) || [])[1] || '';
  const base = s.replace(/\([^)]*\b(1[89]\d{2}|20\d{2})\b[^)]*\)/g, ' ').replace(/\(?\bvol(?:ume)?\.?\s*\d{1,3}\)?/ig, ' ').replace(/\s+/g, ' ').trim();
  return { title: base, year: y ? Number(y) : null, volume: v ? String(Number(v)) : '' };
};
// Hachage stable (FNV-1a 32 bits, deux passes) : même clé naturelle → même identifiant sur tous les appareils
const hash = s => { let h1 = 0x811c9dc5, h2 = 0x01000193; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; } return h1.toString(36) + h2.toString(36); };
const cleanExt = obj => {
  const out = {};
  if (obj && typeof obj === 'object') Object.keys(EXT_SYSTEMS).forEach(k => {
    let v = str(obj[k], 60); if (!v) return;
    if (k === 'upc' || k === 'isbn') v = v.replace(/[^0-9Xx]/g, '').toUpperCase();
    if (EXT_SYSTEMS[k].test(v)) out[k] = v;
  });
  return out;
};
const outOfScope = input => OUT_OF_SCOPE_RE.test(fold([input.format, input.medium, input.type].filter(Boolean).join(' ')));

// ---------- Magasin (objet JSON sérialisable, conservé tel quel dans la sauvegarde)
const emptyStore = () => ({ format: FORMAT, version: VERSION, series: {}, issues: {}, variants: {}, editions: {}, aliases: {}, refs: {}, history: [], seq: 0 });
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
function loadStore(raw) {
  const s = emptyStore();
  if (!isObj(raw) || raw.format !== FORMAT || raw.version !== VERSION) return s;
  ['series', 'issues', 'variants', 'editions'].forEach(k => { if (isObj(raw[k])) Object.entries(raw[k]).forEach(([id, r]) => { if (isObj(r) && r.id === id && /^pub_[sive]_[a-z0-9]{2,24}$/.test(id)) s[k][id] = JSON.parse(JSON.stringify(r)); }); });
  if (isObj(raw.aliases)) Object.entries(raw.aliases).forEach(([a, b]) => { if (typeof b === 'string') s.aliases[a] = b; });
  if (isObj(raw.refs)) Object.entries(raw.refs).forEach(([k, v]) => { if (/^[a-z]{2,20}:.{1,120}$/.test(k) && isObj(v) && typeof v.pub === 'string') s.refs[k] = { pub: v.pub, match: str(v.match, 20), at: str(v.at, 30) }; });
  if (Array.isArray(raw.history)) s.history = raw.history.filter(isObj).slice(-50);
  s.seq = Number.isInteger(raw.seq) ? raw.seq : 0;
  return s;
}

// Index reconstruits à la demande (non sérialisés)
function indexes(store) {
  const bySeriesTitle = new Map(), issueByKey = new Map(), variantByKey = new Map(), editionByIsbn = new Map(), ext = new Map();
  Object.values(store.series).forEach(r => { const k = r.titleKey; bySeriesTitle.set(k, (bySeriesTitle.get(k) || []).concat(r.id)); });
  Object.values(store.issues).forEach(r => { issueByKey.set(r.seriesId + '|' + r.numberKey, r.id); Object.entries(r.externalIds || {}).forEach(([k, v]) => ext.set(k + ':' + v, r.id)); });
  Object.values(store.variants).forEach(r => { variantByKey.set(r.issueId + '|' + r.kind + '|' + r.nameKey, r.id); Object.entries(r.externalIds || {}).forEach(([k, v]) => ext.set(k + ':' + v, r.id)); });
  Object.values(store.editions).forEach(r => { if (r.isbn) editionByIsbn.set(r.isbn, r.id); Object.entries(r.externalIds || {}).forEach(([k, v]) => ext.set(k + ':' + v, r.id)); });
  return { bySeriesTitle, issueByKey, variantByKey, editionByIsbn, ext };
}
// Index mis en cache par magasin (un import de plusieurs milliers de fiches reste linéaire) ; tenu à jour à chaque ajout, jeté après fusion ou annulation
const IX = new WeakMap();
const ixOf = store => { let x = IX.get(store); if (!x) { x = indexes(store); IX.set(store, x); } return x; };
const dropIx = store => IX.delete(store);
const canonical = (store, id) => { let x = id, n = 0; while (store.aliases[x] && n++ < 20) x = store.aliases[x]; return x; };

// ---------- Provenance et vérification
const addSource = (rec, src) => {
  if (!src || !src.id) return;
  rec.sources = rec.sources || [];
  if (!rec.sources.some(s => s.id === src.id)) rec.sources.push({ id: str(src.id, 80), kind: SOURCE_KINDS.includes(src.kind) ? src.kind : 'import', at: str(src.at, 30) });
  if (rec.sources.length > 30) rec.sources = rec.sources.slice(-30);
};
// Valeur sourcée : la première est retenue ; une valeur différente est gardée comme écart (jamais écrasée)
const setField = (rec, field, value, src) => {
  if (value === '' || value === null || value === undefined) return;
  rec.fields = rec.fields || {};
  const cur = rec.fields[field];
  if (!cur) { rec.fields[field] = { value, source: src ? src.id : '' }; return; }
  if (JSON.stringify(cur.value) === JSON.stringify(value)) return;
  rec.conflicts = (rec.conflicts || []).filter(c => !(c.field === field && JSON.stringify(c.value) === JSON.stringify(value))).concat([{ field, value, source: src ? src.id : '' }]).slice(-20);
};
const verificationOf = rec => {
  const s = rec.sources || [];
  if (s.some(x => x.kind === 'bibliographic')) return 'verified';
  return new Set(s.map(x => x.id)).size > 1 ? 'concordant' : 'recorded';
};

// ---------- Résolution d'une entrée vers l'identité commune
// input : { series, volume, year, publisher, issue, variant, printing, format, title, coverDate, storeDate, focDate, price, creators, externalIds, isbn, seriesType }
// opts  : { source: { id, kind, at }, create: true|false }
function resolve(store, input, opts = {}) {
  input = input || {};
  const src = opts.source || { id: 'manual', kind: 'manual' };
  if (outOfScope(input)) return { status: 'out_of_scope' };
  const fmt = fold(input.format);
  const ix = ixOf(store);
  const ext = cleanExt(Object.assign({}, input.externalIds || {}, input.isbn ? { isbn: input.isbn } : {}));
  // Recueil ou édition (TPB, HC, album VF…) : jamais confondu avec un numéro
  const edFmt = Object.keys(EDITION_FORMATS).find(k => k === fmt || (k === 'tpb' && /\b(tpb|trade|recueil)\b/.test(fmt)) || (k === 'hc' && /\b(hc|hardcover)\b/.test(fmt)));
  if (edFmt) return resolveEdition(store, ix, input, ext, edFmt, src, opts);

  // 1. Identifiant externe déjà connu
  const extHits = new Set(Object.entries(ext).map(([k, v]) => ix.ext.get(k + ':' + v)).filter(Boolean).map(id => canonical(store, id)));
  if (extHits.size > 1) return { status: 'ambiguous', reason: 'external_conflict', candidates: [...extHits] };
  if (extHits.size === 1) {
    const id = [...extHits][0], rec = store.issues[id] || store.variants[id];
    if (rec) { const issueId = rec.issueId || rec.id; enrich(store, store.issues[issueId], input, ext, src, ix); return { status: 'resolved', match: 'external', issueId, variantId: rec.issueId ? rec.id : variantFor(store, ix, issueId, input, ext, src, opts), seriesId: store.issues[issueId].seriesId }; }
  }
  // 2. Série
  const sp = splitSeries(input.series || input.title);
  const titleKey = normTitle(sp.title);
  if (!titleKey) return { status: 'rejected', reason: 'Titre de série manquant' };
  const number = normIssue(input.issue);
  const ser = resolveSeries(store, ix, { titleKey, title: sp.title, volume: normVolume(input.volume) || sp.volume, year: year(input.year) || sp.year, publisher: str(input.publisher, 120), type: input.seriesType }, src, opts, number);
  if (ser.status !== 'resolved') return ser;
  // Sans numéro : un one-shot sans numéro devient le numéro « 1 » seulement si la série est déclarée one-shot
  const num = number || (store.series[ser.seriesId].type === 'one_shot' ? '1' : '');
  if (!num) return { status: 'resolved', match: ser.match, seriesId: ser.seriesId, issueId: null, variantId: null };
  // 3. Numéro (unique par série et numéro)
  let issueId = ix.issueByKey.get(ser.seriesId + '|' + num), created = false;
  if (issueId && Object.entries(ext).some(([k, v]) => store.issues[issueId].externalIds && store.issues[issueId].externalIds[k] && store.issues[issueId].externalIds[k] !== v && k !== 'upc'))
    return { status: 'ambiguous', reason: 'external_mismatch', candidates: [issueId] };
  if (!issueId) {
    if (opts.create === false) return { status: 'not_found', seriesId: ser.seriesId };
    issueId = 'pub_i_' + hash(ser.seriesId + '|' + num);
    store.issues[issueId] = { id: issueId, seriesId: ser.seriesId, number: str(input.issue, 20).replace(/^#\s*/, '') || num, numberKey: num, externalIds: {}, sources: [], cover: { status: 'none', rights: 'unknown' }, createdAt: src.at || '' };
    ix.issueByKey.set(ser.seriesId + '|' + num, issueId); created = true;
  }
  enrich(store, store.issues[issueId], input, ext, src, ix);
  const variantId = variantFor(store, ix, issueId, input, ext, src, opts);
  return { status: 'resolved', match: created ? 'new' : (ser.match === 'probable' ? 'probable' : 'exact'), seriesId: ser.seriesId, issueId, variantId };
}

function resolveSeries(store, ix, s, src, opts) {
  const cands = (ix.bySeriesTitle.get(s.titleKey) || []).map(id => store.series[id]).filter(Boolean);
  const pubKey = normPublisher(s.publisher);
  const compatible = r => !(pubKey && r.publisherKey && r.publisherKey !== pubKey) && !(s.year && r.year && r.year !== s.year) && !(s.volume && r.volume && r.volume !== s.volume);
  const hasDisc = r => !!(r.year || r.volume);
  const ok = cands.filter(compatible);
  let hit = null, match = 'exact';
  if (s.year || s.volume) {
    const same = ok.filter(r => (s.year && r.year === s.year) || (s.volume && r.volume === s.volume));
    if (same.length === 1) hit = same[0];
    else if (same.length > 1) return { status: 'ambiguous', reason: 'series', candidates: same.map(r => r.id) };
    else {
      // Discriminant d'un autre type (volume contre année) sans contradiction : rattachement probable s'il n'y a qu'une candidate
      const other = ok.filter(hasDisc);
      if (other.length === 1) { hit = other[0]; match = 'probable'; }
      else if (other.length > 1) return { status: 'ambiguous', reason: 'series', candidates: other.map(r => r.id) };
    }
  } else {
    const plain = ok.filter(r => !hasDisc(r));
    if (plain.length === 1) hit = plain[0];
    else if (plain.length > 1) return { status: 'ambiguous', reason: 'series', candidates: plain.map(r => r.id) };
    else if (ok.length === 1) { hit = ok[0]; match = 'probable'; }
    else if (ok.length > 1) return { status: 'ambiguous', reason: 'series', candidates: ok.map(r => r.id) };
  }
  if (!hit) {
    if (opts.create === false) return { status: 'not_found' };
    const id = 'pub_s_' + hash([s.titleKey, pubKey, s.year || '', s.volume || ''].join('|'));
    if (store.series[id]) hit = store.series[id];
    else {
      hit = store.series[id] = { id, title: s.title, titleKey: s.titleKey, publisher: s.publisher, publisherKey: pubKey, volume: s.volume || '', year: s.year || null,
        type: SERIES_TYPES[s.type] ? s.type : 'unknown', sources: [], createdAt: src.at || '' };
      ix.bySeriesTitle.set(s.titleKey, (ix.bySeriesTitle.get(s.titleKey) || []).concat(id));
      match = 'new';
    }
  }
  // Enrichissement seulement quand le rattachement est certain (jamais sur un rapprochement probable)
  if (match !== 'probable') {
    if (!hit.publisher && s.publisher) { hit.publisher = s.publisher; hit.publisherKey = pubKey; }
    if (SERIES_TYPES[s.type] && hit.type === 'unknown') hit.type = s.type;
  }
  addSource(hit, src);
  return { status: 'resolved', seriesId: hit.id, match };
}

function enrich(store, rec, input, ext, src, ix) {
  Object.entries(ext).forEach(([k, v]) => { if (k === 'upc' && v.length === 17) return; if (!rec.externalIds[k]) { rec.externalIds[k] = v; ix.ext.set(k + ':' + v, rec.id); } });
  setField(rec, 'title', str(input.title && input.title !== input.series ? input.title : '', 200), src);
  setField(rec, 'coverDate', isoDate(input.coverDate), src);
  setField(rec, 'storeDate', isoDate(input.storeDate), src);
  setField(rec, 'focDate', isoDate(input.focDate), src);
  setField(rec, 'coverYear', year(input.coverYear), src);
  setField(rec, 'price', str(input.price, 20), src);
  if (Array.isArray(input.creators) && input.creators.length) setField(rec, 'creators', input.creators.slice(0, 20).map(c => ({ name: str(c.name, 120), roles: (c.roles || []).map(r => str(r, 20)).slice(0, 7) })).filter(c => c.name), src);
  addSource(rec, src);
  rec.verification = verificationOf(rec);
}

// Variante ou réimpression : la couverture principale existe toujours implicitement ('main') ; une variante a sa propre identité
function variantFor(store, ix, issueId, input, ext, src, opts) {
  const pr = PRINTING_RE.exec(fold(input.printing || input.variant));
  const kind = pr && Number(pr[1]) > 1 ? 'printing' : 'cover';
  const nameKey = kind === 'printing' ? String(Number(pr[1])) : normVariant(input.variant);
  if (kind === 'cover' && nameKey === 'main') {
    // Code-barres complet (17 chiffres) : identifie l'exemplaire principal ; gardé sur le numéro s'il est libre
    if (ext.upc && ext.upc.length === 17 && !store.issues[issueId].externalIds.upc) { store.issues[issueId].externalIds.upc = ext.upc; ix.ext.set('upc:' + ext.upc, issueId); }
    return null;
  }
  const key = issueId + '|' + kind + '|' + nameKey;
  let id = ix.variantByKey.get(key);
  if (!id) {
    if (opts.create === false) return null;
    id = 'pub_v_' + hash(key);
    store.variants[id] = { id, issueId, kind, name: kind === 'printing' ? nameKey + 'e impression' : str(input.variant, 120), nameKey, externalIds: {}, sources: [], cover: { status: 'none', rights: 'unknown' } };
    ix.variantByKey.set(key, id);
  }
  const v = store.variants[id];
  if (ext.upc && ext.upc.length === 17 && !v.externalIds.upc) { v.externalIds.upc = ext.upc; ix.ext.set('upc:' + ext.upc, id); }
  addSource(v, src);
  return id;
}

function resolveEdition(store, ix, input, ext, fmt, src, opts) {
  const sp = splitSeries(input.series || input.title);
  const titleKey = normTitle(input.title || sp.title);
  if (!titleKey) return { status: 'rejected', reason: 'Titre manquant' };
  let id = ext.isbn ? ix.editionByIsbn.get(ext.isbn) : null;
  const natural = 'pub_e_' + hash([titleKey, normPublisher(input.publisher), fold(input.language), normIssue(input.issue), fmt].join('|'));
  if (!id && !ext.isbn && store.editions[natural]) id = natural;
  if (!id) {
    if (opts.create === false) return { status: 'not_found' };
    id = ext.isbn ? 'pub_e_' + hash('isbn|' + ext.isbn) : natural;
    store.editions[id] = { id, title: str(input.title || input.series, 200), titleKey, number: str(input.issue, 20), format: fmt, publisher: str(input.publisher, 120), language: str(input.language, 12),
      isbn: ext.isbn || '', externalIds: {}, contents: [], sources: [], cover: { status: 'none', rights: 'unknown' } };
    if (ext.isbn) ix.editionByIsbn.set(ext.isbn, id);
  }
  const e = store.editions[id];
  Object.entries(ext).forEach(([k, v]) => { if (k !== 'isbn' && !e.externalIds[k]) { e.externalIds[k] = v; ix.ext.set(k + ':' + v, id); } });
  setField(e, 'storeDate', isoDate(input.storeDate), src);
  addSource(e, src); e.verification = verificationOf(e);
  return { status: 'resolved', match: 'edition', editionId: id };
}

// ---------- Références des modules (Collection, Sorties, Explorer…) vers l'identité commune
const refKey = (module, localId) => str(module, 20) + ':' + str(localId, 120);
function link(store, module, localId, res, at) {
  const pub = res && (res.variantId || res.issueId || res.editionId || res.seriesId);
  if (!pub) return false;
  const k = refKey(module, localId), prev = store.refs[k];
  if (prev && prev.pub === pub && prev.match === (res.match || '')) return true; // inchangé : date d'origine conservée
  store.refs[k] = { pub, match: res.match || '', at: at || '' };
  return true;
}
// Lecture d'une référence : suit les fusions ; renvoie le numéro (et la variante) commun
function lookup(store, module, localId) {
  const r = store.refs[refKey(module, localId)];
  if (!r) return null;
  const id = canonical(store, r.pub);
  const variant = store.variants[id] || null, issue = variant ? store.issues[variant.issueId] : store.issues[id] || null;
  return { pub: id, match: r.match, issueId: issue ? issue.id : null, variantId: variant ? variant.id : null, editionId: store.editions[id] ? id : null, seriesId: issue ? issue.seriesId : (store.series[id] ? id : null) };
}
// Toutes les références d'un numéro (variantes comprises), par module : « où ce comic apparaît-il dans Panel ? »
function usages(store, issueId) {
  const out = {};
  Object.entries(store.refs).forEach(([k, r]) => {
    const id = canonical(store, r.pub), v = store.variants[id];
    if (id === issueId || (v && v.issueId === issueId)) { const [m, ...rest] = k.split(':'); (out[m] = out[m] || []).push({ localId: rest.join(':'), variantId: v ? v.id : null, match: r.match }); }
  });
  return out;
}

// ---------- Adaptateurs : traduction des fiches existantes, sans les modifier
const fromCollectionCopy = c => ({ series: c.series, issue: c.issue, publisher: c.publisher, variant: c.variant, coverYear: c.coverYear, price: c.coverPrice,
  format: c.format || c.mediaFormat || '', externalIds: Object.assign({}, c.externalIds || {}, c.barcode ? { upc: c.barcode } : {}, c.isbn ? { isbn: c.isbn } : {}) });
const fromRelease = p => ({ series: p.series || p.title, title: p.title, issue: p.issue, variant: p.variant, publisher: p.publisher, format: p.format === 'single' ? '' : p.format, language: p.language,
  storeDate: p.market && p.market !== 'us' ? '' : (p.actual || p.date || ''), externalIds: p.externalIds || {} });
// Lien d'événement : un numéro par entrée ; l'éditeur vient du guide ; les plages sont déjà développées par l'appelant
const fromEventIssue = (series, volume, issue, publisher) => ({ series, volume, issue, publisher });

// Construction ou mise à jour idempotente de l'index commun à partir des données des modules (aucune donnée source modifiée)
// data : { copies: [], releases: [], eventIssues: [{ localId, series, volume, issue, publisher, sourceId }] }
function buildFromModules(store, data, at) {
  const report = { collection: count(), release: count(), explorer: count(), review: [] };
  function count() { return { linked: 0, created: 0, probable: 0, ambiguous: 0, outOfScope: 0, rejected: 0, unchanged: 0 }; }
  const run = (module, localId, input, src, rep) => {
    if (!localId) return;
    const prev = store.refs[refKey(module, localId)];
    if (prev && prev.match === 'manual') { rep.unchanged++; return; } // une liaison choisie à la main n'est jamais recalculée
    const res = resolve(store, input, { source: src });
    if (res.status === 'out_of_scope') { rep.outOfScope++; return; }
    if (res.status === 'rejected' || res.status === 'not_found') { rep.rejected++; return; }
    if (res.status === 'ambiguous') {
      rep.ambiguous++;
      // À trancher à la main : jamais de choix automatique entre candidates (liste plafonnée)
      if (report.review.length < 200) report.review.push({ module, localId: String(localId), issue: str(input.issue, 20), label: [input.series || input.title, input.issue ? '#' + String(input.issue).replace(/^#/, '') : '', input.variant || ''].filter(Boolean).join(' '), reason: res.reason, candidates: (res.candidates || []).map(id => canonical(store, id)) });
      return;
    }
    link(store, module, localId, res, at); rep.linked++;
    if (res.match === 'new') rep.created++; if (res.match === 'probable') rep.probable++;
  };
  const jobs = [];
  (data.eventIssues || []).forEach(e => jobs.push(['explorer', e.localId, fromEventIssue(e.series, e.volume, e.issue, e.publisher), { id: e.sourceId || 'guide', kind: e.sourceKind || 'guide', at }]));
  (data.releases || []).forEach(p => jobs.push(['release', p.id, fromRelease(p), { id: 'release:' + (p.source || 'import'), kind: 'release', at }]));
  (data.copies || []).forEach(c => jobs.push(['collection', c.id, fromCollectionCopy(c), { id: 'collection', kind: 'collection', at }]));
  // Les entrées qui précisent volume ou année passent d'abord : une entrée sans discriminant se rattache ensuite
  // à la série unique déjà connue (rapprochement « probable ») au lieu de créer une série homonyme sans année
  const disc = i => { const sp = splitSeries(i.series || i.title); return !!(sp.year || sp.volume || year(i.year) || normVolume(i.volume)); };
  jobs.filter(j => disc(j[2])).concat(jobs.filter(j => !disc(j[2]))).forEach(([m, id, input, src]) => run(m, id, input, src, report[m]));
  return report;
}

// ---------- Doublons : détection, fusion journalisée, annulation
// Séries homonymes dont l'une n'a ni volume ni année : candidates à une fusion, jamais fusionnées automatiquement
function duplicateCandidates(store) {
  const by = new Map(); Object.values(store.series).forEach(s => by.set(s.titleKey, (by.get(s.titleKey) || []).concat(s)));
  const out = [];
  by.forEach(list => { if (list.length < 2) return; const plain = list.filter(s => !s.year && !s.volume); if (plain.length) out.push({ titleKey: list[0].titleKey, series: list.map(s => s.id) }); });
  return out;
}
// Enregistreur de modifications : l'état antérieur de chaque fiche touchée est gardé pour l'annulation
const recorder = store => {
  const before = {};
  const touch = (map, id) => { before[map] = before[map] || {}; if (!(id in before[map])) before[map][id] = store[map][id] === undefined ? null : JSON.parse(JSON.stringify(store[map][id])); };
  return { before, touch };
};
function merge(store, fromId, intoId, opts = {}) {
  dropIx(store);
  fromId = canonical(store, fromId); intoId = canonical(store, intoId);
  const kind = id => id.slice(4, 5);
  if (fromId === intoId || kind(fromId) !== kind(intoId) || !['s', 'i'].includes(kind(fromId))) return { ok: false, error: 'Fusion impossible entre ces deux publications' };
  const map = kind(fromId) === 's' ? 'series' : 'issues';
  if (!store[map][fromId] || !store[map][intoId]) return { ok: false, error: 'Publication inconnue' };
  const rec = recorder(store);
  const moveRefs = (a, b) => Object.keys(store.refs).forEach(k => { if (canonical(store, store.refs[k].pub) === a) { rec.touch('refs', k); store.refs[k] = Object.assign({}, store.refs[k], { pub: b }); } });
  const mergeIssue = (a, b) => {
    rec.touch('issues', a); rec.touch('issues', b); rec.touch('aliases', a);
    const A = store.issues[a], B = store.issues[b];
    Object.entries(A.externalIds || {}).forEach(([k, v]) => { if (!B.externalIds[k]) B.externalIds[k] = v; });
    Object.entries(A.fields || {}).forEach(([f, v]) => setField(B, f, v.value, { id: v.source }));
    (A.sources || []).forEach(s => addSource(B, s)); B.verification = verificationOf(B);
    Object.values(store.variants).filter(v => v.issueId === a).forEach(v => {
      const twin = Object.values(store.variants).find(w => w.issueId === b && w.kind === v.kind && w.nameKey === v.nameKey);
      rec.touch('variants', v.id);
      if (twin) { rec.touch('aliases', v.id); store.aliases[v.id] = twin.id; moveRefs(v.id, twin.id); delete store.variants[v.id]; }
      else store.variants[v.id] = Object.assign({}, v, { issueId: b });
    });
    moveRefs(a, b); store.aliases[a] = b; delete store.issues[a];
  };
  if (map === 'issues') mergeIssue(fromId, intoId);
  else {
    rec.touch('series', fromId); rec.touch('series', intoId); rec.touch('aliases', fromId);
    const S = store.series[intoId];
    Object.values(store.issues).filter(i => i.seriesId === fromId).forEach(i => {
      const twin = Object.values(store.issues).find(j => j.seriesId === intoId && j.numberKey === i.numberKey);
      if (twin) mergeIssue(i.id, twin.id); else { rec.touch('issues', i.id); store.issues[i.id] = Object.assign({}, i, { seriesId: intoId }); }
    });
    (store.series[fromId].sources || []).forEach(s => addSource(S, s));
    if (!S.publisher && store.series[fromId].publisher) { S.publisher = store.series[fromId].publisher; S.publisherKey = store.series[fromId].publisherKey; }
    moveRefs(fromId, intoId); store.aliases[fromId] = intoId; delete store.series[fromId];
  }
  const op = { id: 'op_' + (++store.seq), op: 'merge', from: fromId, into: intoId, reason: str(opts.reason, 200), at: str(opts.at, 30), before: rec.before };
  store.history = store.history.concat([op]).slice(-50);
  return { ok: true, opId: op.id };
}
// Liaison manuelle d'une fiche de module à une publication (correction d'un rattachement), annulable
function relink(store, module, localId, pubId, opts = {}) {
  const id = canonical(store, pubId);
  if (!store.issues[id] && !store.variants[id] && !store.editions[id] && !store.series[id]) return { ok: false, error: 'Publication inconnue' };
  const rec = recorder(store), k = refKey(module, localId);
  rec.touch('refs', k);
  store.refs[k] = { pub: id, match: 'manual', at: str(opts.at, 30) };
  const op = { id: 'op_' + (++store.seq), op: 'relink', ref: k, into: id, at: str(opts.at, 30), before: rec.before };
  store.history = store.history.concat([op]).slice(-50);
  return { ok: true, opId: op.id };
}
// Choix manuel de la série pour une entrée ambiguë : le numéro est retrouvé (ou créé) dans cette série, puis la fiche y est liée ; annulable
function chooseSeries(store, module, localId, seriesId, input, opts = {}) {
  const sid = canonical(store, seriesId);
  if (!store.series[sid]) return { ok: false, error: 'Série inconnue' };
  const num = normIssue(input && input.issue);
  if (!num) return relink(store, module, localId, sid, opts);
  const ix = ixOf(store), rec = recorder(store), k = refKey(module, localId);
  let issueId = ix.issueByKey.get(sid + '|' + num);
  if (!issueId) {
    issueId = 'pub_i_' + hash(sid + '|' + num);
    rec.touch('issues', issueId);
    store.issues[issueId] = { id: issueId, seriesId: sid, number: str(input.issue, 20).replace(/^#\s*/, '') || num, numberKey: num, externalIds: {}, sources: [], cover: { status: 'none', rights: 'unknown' }, createdAt: str(opts.at, 30) };
    ix.issueByKey.set(sid + '|' + num, issueId);
  }
  rec.touch('refs', k);
  store.refs[k] = { pub: issueId, match: 'manual', at: str(opts.at, 30) };
  const op = { id: 'op_' + (++store.seq), op: 'choose', ref: k, into: issueId, at: str(opts.at, 30), before: rec.before };
  store.history = store.history.concat([op]).slice(-50);
  return { ok: true, opId: op.id, issueId };
}
// Annulation de la dernière opération (ordre inverse strict, pour ne jamais écraser une opération postérieure)
function undo(store) {
  const op = store.history[store.history.length - 1];
  if (!op || !op.before) return { ok: false, error: 'Rien à annuler' };
  dropIx(store);
  Object.entries(op.before).forEach(([map, recs]) => Object.entries(recs).forEach(([id, val]) => { if (val === null) delete store[map][id]; else store[map][id] = val; }));
  store.history = store.history.slice(0, -1);
  return { ok: true, undone: op.id };
}

// ---------- Lecture
function describe(store, pubId) {
  const id = canonical(store, pubId);
  const v = store.variants[id] || null, i = v ? store.issues[v.issueId] : store.issues[id], e = store.editions[id];
  if (e) return { kind: 'edition', edition: e };
  if (!i) return store.series[id] ? { kind: 'series', series: store.series[id] } : null;
  const s = store.series[i.seriesId];
  const f = k => (i.fields && i.fields[k] ? i.fields[k].value : '');
  return { kind: v ? 'variant' : 'issue', id, issue: i, variant: v, series: s,
    label: s.title + (s.volume ? ' Vol. ' + s.volume : '') + (s.year ? ' (' + s.year + ')' : '') + ' #' + i.number + (v ? ' — ' + v.name : ''),
    dates: { cover: f('coverDate'), store: f('storeDate'), foc: f('focDate') }, verification: i.verification || 'recorded',
    variants: Object.values(store.variants).filter(x => x.issueId === i.id).map(x => ({ id: x.id, kind: x.kind, name: x.name })) };
}
const stats = store => ({ series: Object.keys(store.series).length, issues: Object.keys(store.issues).length, variants: Object.keys(store.variants).length,
  editions: Object.keys(store.editions).length, refs: Object.keys(store.refs).length, aliases: Object.keys(store.aliases).length, history: store.history.length });

module.exports = { FORMAT, VERSION, SERIES_TYPES, VARIANT_KINDS, EDITION_FORMATS, EXT_SYSTEMS, VERIFICATION,
  normTitle, normPublisher, normIssue, normVariant, splitSeries, cleanExt, outOfScope,
  emptyStore, loadStore, resolve, link, lookup, usages, relink, chooseSeries, merge, undo, duplicateCandidates, describe, stats,
  fromCollectionCopy, fromRelease, fromEventIssue, buildFromModules };
