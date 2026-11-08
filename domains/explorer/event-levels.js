'use strict';
// Event Center v2 (R2, D-57) — module autonome : ni réseau, ni stockage, ni accès direct aux autres domaines.
// Niveaux de lecture (Essentiel ⊂ Recommandé ⊂ Complet), rôles normalisés, ordre recommandé Panel versionné, progression par niveau.
// Règles :
//  - un niveau est une SÉLECTION ÉDITORIALE PANEL, affichée comme telle avec sa justification, jamais comme un fait bibliographique ;
//  - une sélection ne porte que sur des liens déjà présents dans la fiche (aucune série ni aucun numéro ajouté) ; un lien introuvable
//    (fiche modifiée par l'utilisateur, source retirée) est signalé « non applicable » et ignoré ;
//  - l'ordre recommandé Panel est construit à partir des rôles (préludes, série principale, tie-ins choisis, épilogues, conséquences) :
//    il n'est jamais recopié d'un guide tiers ; chaque modification de sélection crée une nouvelle version ;
//  - « Complet » = série principale + tous les liens de la fiche, sauf ceux masqués par l'utilisateur (jamais l'essentiel) ;
//  - une série citée sans numéros est comptée à part (« numéros non précisés »), jamais devinée.

const LEVELS = Object.freeze({ essential: 'Essentiel', recommended: 'Recommandé', complete: 'Complet' });
const LEVEL_KEYS = Object.freeze(['essential', 'recommended', 'complete']);
const LEVEL_DEF = Object.freeze({
  essential: 'La série principale et les numéros sans lesquels l\'histoire ne se comprend pas.',
  recommended: 'L\'essentiel, plus les lectures qui éclairent l\'intrigue principale.',
  complete: 'Tout ce que les sources rattachent à l\'événement.'
});
const ROLES = Object.freeze({ core: 'Cœur (série principale)', prelude: 'Prélude', tie_in: 'Tie-in', epilogue: 'Épilogue', consequence: 'Conséquence', related: 'Lié' });
const ROLE_OF = Object.freeze({ prelude: 'prelude', tie_in: 'tie_in', crossover: 'tie_in', epilogue: 'epilogue', aftermath: 'consequence', related_series: 'related' });
const ROLE_ORDER = Object.freeze(['prelude', 'core', 'tie_in', 'epilogue', 'consequence', 'related']);
const AUTHOR = 'Panel — sélection éditoriale';

// Sélections éditoriales Panel (version 1, 8 novembre 2026). Chaque entrée désigne un lien existant (relation + série) et dit pourquoi.
const SELECTIONS = Object.freeze({
  gd_secret_wars_1984: { version: 1, at: '2026-11-08', changes: [{ version: 1, at: '2026-11-08', note: 'Première sélection.' }],
    essentialWhy: 'Récit complet en douze numéros : la série principale suffit.', essential: [],
    recommendedWhy: 'Aucun lien n\'est rattaché par les sources : rien à ajouter.', recommended: [] },
  gd_infinity_gauntlet: { version: 1, at: '2026-11-08', changes: [{ version: 1, at: '2026-11-08', note: 'Première sélection.' }],
    essentialWhy: 'Les six numéros, précédés de The Thanos Quest, où Thanos réunit les Gemmes : sans lui, le début de la série principale reste obscur.',
    essential: [{ relation: 'prelude', series: 'The Thanos Quest', why: 'Thanos rassemble les Gemmes de l\'infini : point de départ direct de la série principale.' }],
    recommendedWhy: 'Le retour de Thanos dans Silver Surfer et le sort des Gemmes après l\'événement.',
    recommended: [{ relation: 'prelude', series: 'Silver Surfer', why: 'Retour de Thanos et mise en place de l\'intrigue cosmique, par le scénariste de la série principale.' },
      { relation: 'aftermath', series: 'Warlock and the Infinity Watch', why: 'Ce que deviennent les Gemmes après l\'événement.' }] },
  gd_house_of_m: { version: 1, at: '2026-11-08', changes: [{ version: 1, at: '2026-11-08', note: 'Première sélection.' }],
    essentialWhy: 'Les huit numéros contiennent toute l\'intrigue.', essential: [],
    recommendedWhy: 'Ce qui précède immédiatement l\'événement et ses premières conséquences.',
    recommended: [{ relation: 'prelude', series: 'Excalibur', why: 'Xavier et Magneto à Génosha juste avant l\'événement : situe l\'état de la Sorcière rouge.' },
      { relation: 'aftermath', series: 'Decimation: House of M – The Day After', why: 'Premières conséquences de la perte de leurs pouvoirs par la plupart des mutants.' }] },
  gd_civil_war: { version: 1, at: '2026-11-08', changes: [{ version: 1, at: '2026-11-08', note: 'Première sélection.' }],
    essentialWhy: 'Les sept numéros racontent tout le conflit.', essential: [],
    recommendedWhy: 'Les deux lectures qui éclairent le plus la série principale, parmi des dizaines de tie-ins.',
    recommended: [{ relation: 'tie_in', series: 'Amazing Spider-Man', why: 'Le point de vue de Peter Parker, dont le choix de révéler son identité est au cœur de l\'événement.' },
      { relation: 'tie_in', series: 'Civil War: Front Line', why: 'Le conflit vu du terrain par des journalistes : contexte et enjeux de la loi de recensement.' }] },
  gd_crisis_infinite_earths: { version: 1, at: '2026-11-08', changes: [{ version: 1, at: '2026-11-08', note: 'Première sélection.' }],
    essentialWhy: 'Les douze numéros forment un récit complet.', essential: [],
    recommendedWhy: 'Les nombreux crossovers prolongent l\'événement dans chaque série sans être nécessaires à l\'intrigue : Panel n\'en recommande aucun.', recommended: [] },
  gd_infinite_crisis: { version: 1, at: '2026-11-08', changes: [{ version: 1, at: '2026-11-08', note: 'Première sélection.' }],
    essentialWhy: 'Les sept numéros contiennent l\'intrigue principale.', essential: [],
    recommendedWhy: 'Le numéro de lancement et les quatre mini-séries qui mènent à l\'événement.',
    recommended: [{ relation: 'prelude', series: 'Countdown to Infinite Crisis', why: 'Point de départ des quatre mini-séries préparatoires.' },
      { relation: 'prelude', series: 'The OMAC Project', why: 'L\'une des quatre mini-séries préparatoires.' },
      { relation: 'prelude', series: 'Villains United', why: 'L\'une des quatre mini-séries préparatoires.' },
      { relation: 'prelude', series: 'Day of Vengeance', why: 'L\'une des quatre mini-séries préparatoires.' },
      { relation: 'prelude', series: 'Rann–Thanagar War', why: 'L\'une des quatre mini-séries préparatoires.' }] },
  gd_blackest_night: { version: 1, at: '2026-11-08', changes: [{ version: 1, at: '2026-11-08', note: 'Première sélection.' }],
    essentialWhy: 'La série principale, du #0 au #8.', essential: [],
    recommendedWhy: 'L\'intrigue se poursuit dans les deux séries Green Lantern, étroitement liées à la série principale.',
    recommended: [{ relation: 'tie_in', series: 'Green Lantern', why: 'Le fil principal de l\'intrigue continue dans Green Lantern, écrit par le scénariste de l\'événement.' },
      { relation: 'tie_in', series: 'Green Lantern Corps', why: 'Le versant Green Lantern Corps de l\'invasion des Black Lanterns.' }] },
  gd_flashpoint: { version: 1, at: '2026-11-08', changes: [{ version: 1, at: '2026-11-08', note: 'Première sélection.' }],
    essentialWhy: 'Les cinq numéros racontent l\'événement.', essential: [],
    recommendedWhy: 'Ce qui mène directement à l\'événement et le Batman de cette réalité, central dans l\'intrigue.',
    recommended: [{ relation: 'prelude', series: 'The Flash', why: 'Les numéros qui mènent directement au début de l\'événement.' },
      { relation: 'tie_in', series: 'Flashpoint: Batman – Knight of Vengeance', why: 'Le Batman de cette réalité, personnage central de la série principale.' }] },
  gd_king_in_black: { version: 1, at: '2026-11-08', changes: [{ version: 1, at: '2026-11-08', note: 'Première sélection.' }],
    essentialWhy: 'Les cinq numéros racontent l\'événement.', essential: [],
    recommendedWhy: 'La série Venom qui prépare l\'arrivée de Knull.',
    recommended: [{ relation: 'related_series', series: 'Venom', why: 'La série Venom du scénariste de l\'événement prépare directement l\'arrivée de Knull.' }] }
});

const str = (v, max = 200) => (v === null || v === undefined) ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max);
const key = s => str(s, 200).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/\bthe\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const linkKey = (relation, series) => relation + '|' + key(series);
const issueNum = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 9999; };

// Liens d'une vue d'événement (eventView de media-core, fournie par l'appelant) aplatis par rôle
function linksOf(view) {
  const out = [];
  Object.entries((view && view.groups) || {}).forEach(([relation, list]) => (list || []).forEach(l => out.push({ relation, role: ROLE_OF[relation] || 'related', series: l.series, volume: l.volume || '', issues: (l.issueList || []).slice(), readingPos: l.readingPos || null })));
  return out;
}
const itemsOf = (l, why, level) => l.issues.map(n => ({ series: l.series, volume: l.volume, issue: n, role: l.role, relation: l.relation, level, why }));

// Niveaux d'un événement. guide : fiche (id, event.mainSeries) ; view : eventView(guide) ; opts.hidden : clés relation|série masquées par l'utilisateur
function levelsFor(guide, view, opts = {}) {
  const sel = SELECTIONS[guide && guide.id] || null;
  const hidden = new Set((opts.hidden || []).map(String));
  const ms = guide && guide.event && guide.event.mainSeries;
  const links = linksOf(view), byKey = new Map();
  links.forEach(l => { const k = linkKey(l.relation, l.series); byKey.set(k, (byKey.get(k) || []).concat(l)); });
  const unmatched = [], pick = (list, level) => {
    const items = [], series = [];
    (list || []).forEach(s => {
      const found = byKey.get(linkKey(s.relation, s.series));
      if (!found) { unmatched.push({ level, relation: s.relation, series: s.series }); return; }
      found.forEach(l => { series.push({ series: l.series, volume: l.volume, role: l.role, relation: l.relation, why: s.why, count: l.issues.length, key: linkKey(l.relation, l.series) }); items.push(...itemsOf(l, s.why, level)); });
    });
    return { items, series };
  };
  const core = ms ? (view.main || []).map(i => ({ series: ms.series, volume: ms.volume || '', issue: String(i.issue), role: 'core', relation: 'main', level: 'essential', why: 'Série principale.' })) : [];
  const ess = pick(sel ? sel.essential : [], 'essential');
  const rec = pick(sel ? sel.recommended : [], 'recommended');
  const chosen = new Set(ess.series.concat(rec.series).map(x => x.key));
  const rest = links.filter(l => !chosen.has(linkKey(l.relation, l.series)));
  const comp = { items: [], series: [] };
  rest.forEach(l => { const k = linkKey(l.relation, l.series); if (hidden.has(k)) return; comp.series.push({ series: l.series, volume: l.volume, role: l.role, relation: l.relation, why: '', count: l.issues.length, key: k }); comp.items.push(...itemsOf(l, '', 'complete')); });
  const dedupe = list => { const seen = new Set(); return list.filter(i => { const k = key(i.series) + '|' + key(i.volume) + '|' + i.issue; if (seen.has(k)) return false; seen.add(k); return true; }); };
  const essential = dedupe(core.concat(ess.items));
  const recommended = dedupe(essential.concat(rec.items));
  const complete = dedupe(recommended.concat(comp.items));
  const unnumbered = list => list.filter(x => !x.count).map(x => x.series);
  const lv = (items, added, why, selWhy, series) => ({ count: items.length, added, why, selectionWhy: selWhy, items, series, unnumbered: unnumbered(series) });
  return {
    guideId: guide && guide.id, editorial: !!sel, author: AUTHOR, version: sel ? sel.version : 0, at: sel ? sel.at : '', changes: sel ? sel.changes.slice() : [],
    levels: {
      essential: lv(essential, essential.length, LEVEL_DEF.essential, sel ? sel.essentialWhy : 'Aucune sélection Panel pour cet événement : la série principale seule.', ess.series),
      recommended: lv(recommended, recommended.length - essential.length, LEVEL_DEF.recommended, sel ? sel.recommendedWhy : 'Aucune sélection Panel pour cet événement.', rec.series),
      complete: lv(complete, complete.length - recommended.length, LEVEL_DEF.complete, 'Tous les liens rattachés par les sources' + (hidden.size ? ', sauf ceux que vous avez masqués' : '') + '.', comp.series)
    },
    hidden: [...hidden], unmatched
  };
}

// Ordre recommandé Panel : construit à partir des rôles (jamais recopié) ; numéros d'une même série dans l'ordre de publication
function recommendedOrder(lv, level) {
  const items = (lv && lv.levels[level] ? lv.levels[level].items : []).slice();
  const firstPos = new Map(); items.forEach((it, i) => { const k = it.role + '|' + key(it.series); if (!firstPos.has(k)) firstPos.set(k, i); });
  items.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || firstPos.get(a.role + '|' + key(a.series)) - firstPos.get(b.role + '|' + key(b.series)) || issueNum(a.issue) - issueNum(b.issue));
  return { type: 'recommended', id: 'ord_panel_' + (lv && lv.guideId) + '_' + level + '_v' + (lv ? lv.version : 0), label: 'Ordre recommandé Panel — ' + LEVELS[level] + (lv && lv.version ? ' (version ' + lv.version + ', ' + lv.at + ')' : ''),
    author: AUTHOR, version: lv ? lv.version : 0, builtFrom: 'roles', note: 'Construit par Panel à partir des rôles : préludes, série principale, tie-ins, épilogues, conséquences. Les tie-ins se lisent en parallèle de la série principale ; aucune position n\'est reprise d\'un guide tiers.',
    entries: items.map((it, i) => Object.assign({ position: i + 1 }, it)) };
}

// Progression par niveau. statusOf(item) → 'read' | 'skipped' | 'reading' | '' (fourni par l'appelant, à partir du domaine Lecture)
function progressFor(lv, statusOf) {
  const out = {};
  LEVEL_KEYS.forEach(level => {
    const ord = recommendedOrder(lv, level).entries;
    let read = 0, skipped = 0, next = null;
    ord.forEach(it => { const s = statusOf(it); if (s === 'read') read++; else if (s === 'skipped') skipped++; else if (!next) next = it; });
    out[level] = { total: ord.length, read, skipped, done: read + skipped, percent: ord.length ? Math.round((read + skipped) * 100 / ord.length) : 0, next };
  });
  return out;
}

// Contrôle des sélections contre une fiche : chaque entrée justifiée, aucune entrée sans lien correspondant
function auditSelection(guide, view) {
  const sel = SELECTIONS[guide && guide.id];
  if (!sel) return { ok: false, missing: true, problems: ['Aucune sélection Panel'] };
  const lv = levelsFor(guide, view), problems = [];
  if (!sel.essentialWhy || !sel.recommendedWhy) problems.push('Justification de niveau manquante');
  sel.essential.concat(sel.recommended).forEach(s => { if (!str(s.why)) problems.push('Justification manquante : ' + s.series); });
  lv.unmatched.forEach(u => problems.push('Lien introuvable : ' + u.relation + ' ' + u.series));
  return { ok: !problems.length, problems, counts: { essential: lv.levels.essential.count, recommended: lv.levels.recommended.count, complete: lv.levels.complete.count } };
}

module.exports = { LEVELS, LEVEL_KEYS, LEVEL_DEF, ROLES, ROLE_OF, AUTHOR, SELECTIONS, linkKey, levelsFor, recommendedOrder, progressFor, auditSelection };
