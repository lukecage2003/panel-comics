'use strict';
// « Le Comptoir » : forum de discussion par cercles, façon Reddit (D-113) — module pur.
// Cercles thématiques, sujets avec étiquette (débat, théorie, question, critique, actu), votes (un par membre),
// classements Tendance / Nouveaux / Meilleurs / Débattus, fils de réponses, débats à deux camps.
// Règles : jamais de vote simulé ; un sujet avec spoiler cache son texte ; un sujet « adultes » n'est jamais montré à un mineur.

const CIRCLES = Object.freeze([
  { key: 'debats', name: 'Débats', about: 'Qui gagne, quel run est le meilleur, quelle version d\'un héros…', icon: 'ic-bolt' },
  { key: 'theories', name: 'Théories', about: 'Ce que prépare la prochaine saga, indices à l\'appui.', icon: 'ic-eye' },
  { key: 'lecture', name: 'Par où commencer', about: 'Conseils de lecture pour débuter une série ou un univers.', icon: 'ic-book' },
  { key: 'sorties', name: 'Sorties du mercredi', about: 'Ce qui sort, ce qu\'on a lu, ce qu\'on attend.', icon: 'ic-calendar' },
  { key: 'collection', name: 'Collection & cotes', about: 'Variantes, éditions, état, conservation, estimations.', icon: 'ic-box' },
  { key: 'vf', name: 'Comics en VF', about: 'Traductions, éditions françaises, intégrales et omnibus.', icon: 'ic-globe' },
  { key: 'createurs', name: 'Coin des créateurs', about: 'Scénario, dessin, couleur, lettrage : métier et conseils.', icon: 'ic-pen' },
  { key: 'indes', name: 'Indés & webcomics', about: 'Petits éditeurs, autoédition, projets à découvrir.', icon: 'ic-star' }
]);
const FLAIRS = ['debate', 'theory', 'question', 'review', 'news', 'show'];
const FLAIR_LABEL = Object.freeze({ debate: 'Débat', theory: 'Théorie', question: 'Question', review: 'Critique', news: 'Actu', show: 'Ma collection' });
const SORTS = ['hot', 'new', 'top', 'debated'];
const SORT_LABEL = Object.freeze({ hot: 'Tendance', new: 'Nouveaux', top: 'Meilleurs', debated: 'Débattus' });
const MAX_DEPTH = 6;

const str = (v, n) => String(v === undefined || v === null ? '' : v).trim().slice(0, n);

const validateThread = t => {
  const e = [];
  const circle = CIRCLES.some(c => c.key === (t && t.circle)) ? t.circle : '';
  if (!circle) e.push('Choisissez un cercle.');
  const title = str(t && t.title, 140);
  if (title.length < 8) e.push('Un titre de 8 caractères au moins.');
  const flair = FLAIRS.includes(t && t.flair) ? t.flair : 'question';
  const body = str(t && t.body, 6000);
  if (/<[a-z/!]/i.test(body + title)) e.push('Les balises ne sont pas acceptées.');
  const sides = flair === 'debate' ? (Array.isArray(t && t.sides) ? t.sides.map(s => str(s, 40)).filter(Boolean).slice(0, 2) : []) : [];
  if (flair === 'debate' && sides.length !== 2) e.push('Un débat a besoin de deux camps.');
  return { ok: !e.length, errors: e, thread: e.length ? null : { circle, title, flair, body, sides, spoiler: str(t.spoiler, 80), mature: !!t.mature } };
};

// Score d'un sujet : votes pour moins votes contre
const score = th => (Number(th && th.up) || 0) - (Number(th && th.down) || 0);
// Tendance : logarithme du score + fraîcheur (la formule publiée par Reddit en 2010, base 45 000 s ≈ 12,5 h)
const hot = (th, epoch) => {
  const s = score(th), order = Math.log10(Math.max(Math.abs(s), 1)), sign = s > 0 ? 1 : s < 0 ? -1 : 0;
  const t = (Date.parse(th && th.at) || 0) / 1000 - (epoch || 1735689600);
  return Math.round((sign * order + t / 45000) * 1e7) / 1e7;
};
// Débattu : beaucoup de votes, partagés à parts égales (ou deux camps serrés)
const debated = th => {
  const up = Number(th && th.up) || 0, down = Number(th && th.down) || 0, n = up + down;
  const sideA = Number(th && th.sideA) || 0, sideB = Number(th && th.sideB) || 0, m = sideA + sideB;
  const bal = (a, b, tot) => tot ? Math.pow(tot, Math.min(a, b) / Math.max(a, b, 1)) : 0;
  return Math.max(bal(up, down, n), bal(sideA, sideB, m)) + (Number(th && th.replies) || 0) * 0.1;
};
const sortThreads = (list, sort, opts) => {
  const o = opts || {};
  const L = (Array.isArray(list) ? list : []).filter(t => t && !(o.minor && t.mature));
  const by = { hot: t => hot(t), new: t => Date.parse(t.at) || 0, top: score, debated }[SORTS.includes(sort) ? sort : 'hot'];
  return L.map(t => [by(t), t]).sort((a, b) => b[0] - a[0] || String(b[1].at).localeCompare(String(a[1].at))).map(x => x[1]);
};
// Vote : un par membre ; recliquer annule ; changer de sens bascule
const vote = (prev, dir) => { const d = dir > 0 ? 1 : dir < 0 ? -1 : 0; const p = prev > 0 ? 1 : prev < 0 ? -1 : 0; const next = p === d ? 0 : d; return { next, up: (next === 1) - (p === 1), down: (next === -1) - (p === -1) }; };

// Fil des réponses : arbre trié (meilleures d'abord), profondeur limitée, réponses orphelines rattachées à la racine
const tree = (comments, opts) => {
  const o = opts || {}, L = (Array.isArray(comments) ? comments : []).filter(c => c && c.id);
  const ids = new Set(L.map(c => c.id)), kids = new Map();
  L.forEach(c => { const p = c.parent && ids.has(c.parent) ? c.parent : ''; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(c); });
  const build = (p, depth) => (kids.get(p) || []).sort((a, b) => score(b) - score(a) || String(a.at).localeCompare(String(b.at)))
    .map(c => ({ ...c, depth, removed: c.status === 'removed', children: depth + 1 < (o.maxDepth || MAX_DEPTH) ? build(c.id, depth + 1) : [], more: depth + 1 >= (o.maxDepth || MAX_DEPTH) ? (kids.get(c.id) || []).length : 0 }));
  return build('', 0);
};
const countTree = t => t.reduce((n, c) => n + 1 + countTree(c.children), 0);
const debateTally = th => { const a = Number(th && th.sideA) || 0, b = Number(th && th.sideB) || 0, n = a + b; return { a, b, n, pa: n ? Math.round(a / n * 100) : 0, pb: n ? 100 - Math.round(a / n * 100) : 0 }; };

module.exports = { CIRCLES, FLAIRS, FLAIR_LABEL, SORTS, SORT_LABEL, MAX_DEPTH, validateThread, score, hot, debated, sortThreads, vote, tree, countTree, debateTally };
