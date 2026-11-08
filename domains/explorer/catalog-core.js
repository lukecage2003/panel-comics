'use strict';
// Fondations Explorer 2.0 (docs/directeur/07 partie A) — module autonome, sans accès à Collection, Lecture ni au réseau.
// Préparé et testé localement ; pas encore branché à l'interface (lots 4.2 à 4.9). Aucune donnée réelle n'est incluse.
//  - entités typées par « kind » et relations génériques relation(from, to, type) : pas de nouvelle table par type (A.8) ;
//  - périmètre : seul medium === 'comic' est publié (D-12) ; provenance par champ obligatoire pour les faits ;
//  - recherche locale tolérante (accents, fautes, alias, VO/VF), sans catégorie personnelle (A7) ;
//  - pages d'entité avec au moins trois « portes » quand le graphe le permet (A.7) ;
//  - recommandations éditoriales et relationnelles, chacune avec son motif ; personnalisation seulement par un filtre S1 fourni par l'appelant.

const KINDS = Object.freeze(['series', 'issue', 'variant', 'edition', 'event', 'saga', 'character', 'team', 'creator', 'publisher', 'imprint', 'guide', 'release', 'news', 'key_fact']);
const RELATION_TYPES = Object.freeze({
  issue_of: ['issue', 'series'], variant_of: ['variant', 'issue'], edition_of: ['edition', 'issue'], collects: ['edition', 'issue'],
  translation_of: ['edition', 'edition'], part_of_event: ['issue', 'event'], part_of_saga: ['issue', 'saga'], saga_of: ['saga', 'series'],
  appears_in: ['character', 'issue'], first_appearance: ['character', 'issue'], member_of: ['character', 'team'],
  credited_on: ['creator', 'issue'], published_by: ['series', 'publisher'], imprint_of: ['imprint', 'publisher'],
  sequel_of: ['series', 'series'], related_to: ['*', '*'], about: ['news', '*'], fact_of: ['key_fact', 'issue'], release_of: ['release', 'issue'], guide_for: ['guide', '*']
});
const MEDIA = ['comic', 'manga', 'unknown'];
const EVENT_ROLES = ['main', 'tie_in', 'optional'];

const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const trigrams = s => { const t = '  ' + s + ' '; const out = new Set(); for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3)); return out; };
// Distance d'édition bornée (tolérance aux fautes) : arrêt dès que la borne est dépassée
const within = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return false;
  // Distance avec transposition de deux lettres voisines (« etolie » pour « etoile » = 1 faute)
  let pp = null, prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], pp[j - 2] + 1);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return false;
    pp = prev; prev = cur;
  }
  return prev[b.length] <= max;
};

function createCatalog() {
  const entities = new Map(), out = new Map(), inc = new Map();
  const index = { tokens: new Map(), grams: new Map(), dirty: true };

  const validate = e => {
    const errors = [];
    if (!e || typeof e !== 'object') return ['entité invalide'];
    if (typeof e.id !== 'string' || !/^[a-z]{2,4}_[A-Za-z0-9_-]{1,80}$/.test(e.id)) errors.push('id invalide (préfixe_identifiant)');
    if (!KINDS.includes(e.kind)) errors.push('kind inconnu : ' + e.kind);
    if (typeof e.name !== 'string' || !e.name.trim() || e.name.length > 300) errors.push('nom obligatoire (300 caractères au plus)');
    if (!MEDIA.includes(e.medium || 'unknown')) errors.push('medium invalide');
    if (e.aliases && (!Array.isArray(e.aliases) || e.aliases.some(a => typeof a !== 'string' || a.length > 200) || e.aliases.length > 50)) errors.push('alias invalides');
    if (e.summary && String(e.summary).length > 1200) errors.push('résumé trop long : une fiche Explorer reste courte (A.1)');
    // Faits sourcés : un key_fact ou une actualité sans source n'est jamais publié
    if ((e.kind === 'key_fact' || e.kind === 'news') && !(e.provenance && e.provenance.source)) errors.push('source obligatoire pour ' + e.kind);
    if (e.kind === 'news' && !/^\d{4}-\d{2}-\d{2}$/.test(e.expiresAt || '')) errors.push('date d\'expiration obligatoire pour une actualité');
    return errors;
  };
  const upsert = e => {
    const errors = validate(e);
    if (errors.length) return { ok: false, errors };
    const prev = entities.get(e.id);
    if (prev && prev.kind !== e.kind) return { ok: false, errors: ['changement de kind interdit'] };
    entities.set(e.id, Object.freeze(JSON.parse(JSON.stringify(Object.assign({ medium: 'unknown', aliases: [] }, e)))));
    index.dirty = true;
    return { ok: true, created: !prev };
  };
  const relate = (from, to, type, meta = {}) => {
    const a = entities.get(from), b = entities.get(to), rule = RELATION_TYPES[type];
    if (!a || !b) return { ok: false, error: 'entité inconnue' };
    if (!rule) return { ok: false, error: 'type de relation inconnu' };
    if ((rule[0] !== '*' && a.kind !== rule[0]) || (rule[1] !== '*' && b.kind !== rule[1])) return { ok: false, error: 'relation ' + type + ' impossible entre ' + a.kind + ' et ' + b.kind };
    if (from === to) return { ok: false, error: 'relation réflexive' };
    if ((type === 'part_of_event' || type === 'part_of_saga') && (meta.order === undefined || !EVENT_ROLES.includes(meta.role || 'main'))) return { ok: false, error: 'ordre et rôle requis' };
    const key = from + '|' + type + '|' + to;
    const rel = Object.freeze({ from, to, type, order: meta.order === undefined ? null : Number(meta.order), role: meta.role || null, provenance: meta.provenance || null });
    (out.get(from) || out.set(from, new Map()).get(from)).set(key, rel);
    (inc.get(to) || inc.set(to, new Map()).get(to)).set(key, rel);
    return { ok: true };
  };
  const published = e => !!e && e.medium === 'comic'; // D-12 : seul le comic est publié
  const get = id => { const e = entities.get(id); return published(e) ? e : null; };
  const relsFrom = (id, type) => [...(out.get(id) || new Map()).values()].filter(r => !type || r.type === type).filter(r => published(entities.get(r.to)));
  const relsTo = (id, type) => [...(inc.get(id) || new Map()).values()].filter(r => !type || r.type === type).filter(r => published(entities.get(r.from)));

  // Ordre de lecture d'un événement ou d'une saga : principal, tie-ins, facultatifs ; option de masquage des facultatifs
  const readingOrder = (id, opts = {}) => {
    const e = get(id);
    if (!e || (e.kind !== 'event' && e.kind !== 'saga')) return null;
    const type = e.kind === 'event' ? 'part_of_event' : 'part_of_saga';
    return relsTo(id, type).filter(r => !(opts.hideOptional && r.role === 'optional')).sort((x, y) => x.order - y.order || x.from.localeCompare(y.from))
      .map(r => ({ id: r.from, name: entities.get(r.from).name, role: r.role, order: r.order }));
  };

  // Index de recherche : jetons exacts et trigrammes (alias et titres VO/VF compris) ; reconstruit à la demande
  const buildIndex = () => {
    index.tokens.clear(); index.grams.clear();
    for (const e of entities.values()) {
      if (!published(e) || e.kind === 'key_fact') continue;
      for (const label of [e.name, ...(e.aliases || []), e.originalTitle || ''].filter(Boolean)) {
        for (const tok of norm(label).split(' ').filter(Boolean)) {
          (index.tokens.get(tok) || index.tokens.set(tok, new Set()).get(tok)).add(e.id);
          for (const g of trigrams(tok)) (index.grams.get(g) || index.grams.set(g, new Set()).get(g)).add(tok);
        }
      }
    }
    index.dirty = false;
  };
  const search = (q, opts = {}) => {
    if (index.dirty) buildIndex();
    const toks = norm(q).split(' ').filter(Boolean).slice(0, 8);
    if (!toks.length) return { groups: {}, total: 0 };
    let ids = null;
    for (const t of toks) {
      const hits = new Set(index.tokens.get(t) || []);
      // Préfixe et fautes de frappe : candidats par trigrammes, vérifiés par distance d'édition (1 faute, 2 au-delà de 7 lettres)
      const cand = new Map();
      for (const g of trigrams(t)) for (const tok of index.grams.get(g) || []) cand.set(tok, (cand.get(tok) || 0) + 1);
      for (const [tok, n] of cand) {
        if (n < Math.max(1, trigrams(t).size - 4)) continue;
        if (tok.startsWith(t) && t.length >= 3 || within(t, tok, t.length > 7 ? 2 : 1)) for (const id of index.tokens.get(tok)) hits.add(id);
      }
      ids = ids === null ? hits : new Set([...ids].filter(x => hits.has(x)));
      if (!ids.size) break;
    }
    const kinds = opts.kinds ? new Set(opts.kinds) : null;
    const groups = {};
    let total = 0;
    for (const id of ids || []) {
      const e = entities.get(id);
      if (kinds && !kinds.has(e.kind)) continue;
      (groups[e.kind] = groups[e.kind] || []).push({ id, name: e.name, kind: e.kind });
      total++;
    }
    const exact = norm(q);
    Object.values(groups).forEach(g => g.sort((a, b) => (norm(b.name) === exact) - (norm(a.name) === exact) || a.name.localeCompare(b.name)));
    return { groups, total };
  };

  // Page d'entité : contenu court et portes de sortie vers d'autres entités (A.7)
  const page = id => {
    const e = get(id);
    if (!e) return null;
    const doors = [];
    const add = (r, dir) => { const other = entities.get(dir === 'out' ? r.to : r.from); if (published(other)) doors.push({ type: r.type, dir, id: other.id, kind: other.kind, name: other.name }); };
    relsFrom(id).forEach(r => add(r, 'out')); relsTo(id).forEach(r => add(r, 'in'));
    const facts = relsTo(id, 'fact_of').map(r => entities.get(r.from)).map(f => ({ text: f.name, source: f.provenance.source }));
    return { entity: { id: e.id, kind: e.kind, name: e.name, summary: e.summary || '', aliases: e.aliases }, doors, facts, readingOrder: readingOrder(id) };
  };

  // Recommandations : relationnelles et éditoriales, chacune avec son motif ; « exclude » = filtre facultatif fourni par l'appelant (S1, sur l'appareil)
  const recommend = (id, opts = {}) => {
    const e = get(id);
    if (!e) return [];
    const scores = new Map();
    const bump = (rid, w, reason) => { if (rid === id || !get(rid)) return; const s = scores.get(rid) || { id: rid, score: 0, reasons: [] }; s.score += w; if (!s.reasons.includes(reason)) s.reasons.push(reason); scores.set(rid, s); };
    const seriesOf = x => (x.kind === 'series' ? [x.id] : relsFrom(x.id, 'issue_of').map(r => r.to));
    // Même créateur
    const issues = e.kind === 'series' ? relsTo(id, 'issue_of').map(r => r.from) : [id];
    const creators = new Set(issues.flatMap(i => relsTo(i, 'credited_on').map(r => r.from)));
    creators.forEach(c => relsFrom(c, 'credited_on').forEach(r => seriesOf(entities.get(r.to)).forEach(s => bump(s, 2, 'même créateur : ' + entities.get(c).name))));
    // Même événement
    issues.forEach(i => relsFrom(i, 'part_of_event').forEach(ev => relsTo(ev.to, 'part_of_event').forEach(r => seriesOf(entities.get(r.from)).forEach(s => bump(s, 3, 'même événement : ' + entities.get(ev.to).name)))));
    // Suite et liens éditoriaux
    seriesOf(e).forEach(s => { relsTo(s, 'sequel_of').forEach(r => bump(r.from, 5, 'suite')); relsFrom(s, 'related_to').forEach(r => bump(r.to, 4, 'choix de la rédaction')); });
    seriesOf(e).forEach(s => scores.delete(s));
    const exclude = typeof opts.exclude === 'function' ? opts.exclude : () => false;
    return [...scores.values()].filter(s => !exclude(s.id)).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, opts.limit || 10)
      .map(s => ({ id: s.id, name: entities.get(s.id).name, reasons: s.reasons }));
  };

  // Actualités : seulement sourcées et non expirées, liées à une entité
  const news = (id, today) => relsTo(id, 'about').map(r => entities.get(r.from)).filter(n => n.kind === 'news' && n.expiresAt >= today)
    .map(n => ({ id: n.id, title: n.name, source: n.provenance.source, date: n.date || null, expiresAt: n.expiresAt }));

  const stats = () => { const by = {}; for (const e of entities.values()) by[e.kind] = (by[e.kind] || 0) + 1; return { entities: entities.size, byKind: by, relations: [...out.values()].reduce((a, m) => a + m.size, 0) }; };
  return { upsert, relate, get, page, readingOrder, search, recommend, news, stats, validate };
}

module.exports = { createCatalog, KINDS, RELATION_TYPES, norm };
