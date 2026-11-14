'use strict';
// Rangs du compte Panel (D-61) : une échelle très longue, de l'humain ordinaire jusqu'au sommet cosmique.
//  - Points (XP) gagnés par l'activité : collection, lecture, avis, runs complets, trophées, et activité sociale
//    (abonnés, réactions, commentaires, planches publiées, débats) qui ne compte qu'une fois les comptes en ligne actifs.
//  - Les rangs cosmiques suivent la hiérarchie présentée par House of Ideal (d'après les vidéos de Maki,
//    classement de fans, non officiel) : l'abstrait, les forces, le terrain, l'équilibre, le sommet.
//  - D-63 : l'échelle terrestre mêle Marvel et DC (méta-humains, Amazones, Kryptoniens, Lanterns, Nouveaux Dieux),
//    puis un palier « multivers DC » précède la hiérarchie cosmique Marvel. Ordre propre à Panel, pour le jeu.
//  - Module pur : aucune donnée stockée ni envoyée.

// Barème des points. `social: true` : activité qui n'existe qu'avec un compte en ligne (0 tant qu'il n'y en a pas).
const XP_RULES = [
  { id: 'owned', label: 'Numéro dans la collection', xp: 5 },
  { id: 'read', label: 'Numéro lu', xp: 8 },
  { id: 'reread', label: 'Relecture', xp: 3 },
  { id: 'rated', label: 'Note donnée à un numéro', xp: 4 },
  { id: 'reviewed', label: 'Avis écrit (40 caractères ou plus)', xp: 15 },
  { id: 'runs', label: 'Run complet', xp: 60 },
  { id: 'keys', label: 'Key issue possédé', xp: 20 },
  { id: 'trophyXp', label: 'Paliers de trophées', xp: 1 },
  { id: 'planches', label: 'Planche préparée', xp: 6 },
  { id: 'stories', label: 'Story de lecture créée', xp: 10 },
  { id: 'artefacts', label: 'Artefact débloqué', xp: 50 },
  { id: 'followers', label: 'Abonné gagné', xp: 10, social: true },
  { id: 'reactions', label: 'Réaction reçue (POW!, WOW!…)', xp: 2, social: true },
  { id: 'comments', label: 'Commentaire reçu', xp: 3, social: true },
  { id: 'published', label: 'Planche publiée', xp: 12, social: true },
  { id: 'debates', label: 'Débat en direct animé', xp: 40, social: true }
];

// Échelle terrestre (avant le cosmique), puis la hiérarchie cosmique de bas en haut.
const EARTH_DEF = [
  ['Civil', 'mixte'], ['Témoin d\'un combat', 'mixte'], ['Justicier de quartier', 'mixte'], ['Athlète de haut niveau', 'mixte'],
  ['Humain entraîné', 'mixte'], ['Maître des arts martiaux', 'mixte'], ['Détective de Gotham', 'dc'], ['Humain optimisé', 'marvel'],
  ['Super-soldat', 'marvel'], ['Agent augmenté', 'marvel'], ['Méta-humain', 'dc'], ['Mutant latent', 'marvel'],
  ['Mutant de classe Bêta', 'marvel'], ['Atlante', 'mixte'], ['Mutant de classe Alpha', 'marvel'], ['Amazone de Themyscira', 'dc'],
  ['Mutant de classe Oméga', 'marvel'], ['Inhumain révélé', 'marvel'], ['Martien vert', 'dc'], ['Green Lantern d\'Oa', 'dc'],
  ['Kryptonien', 'dc'], ['Sorcier initié', 'mixte'], ['Sorcier suprême', 'marvel'], ['Dieu d\'Asgard', 'marvel'],
  ['Nouveau Dieu', 'dc'], ['Héraut cosmique', 'marvel']
];
const EARTH = EARTH_DEF.map(x => x[0]);
// Palier DC entre la Terre et le cosmique Marvel (ordre Panel, non officiel)
const DC_MULTIVERSE = { id: 'multivers_dc', label: 'Le multivers DC', names: ['Gardiens de l\'Univers', 'Darkseid', 'Le Spectre', 'Monitor', 'Anti-Monitor', 'Lucifer Morningstar', 'Le Monde-Forgeron', 'Perpetua'] };
// Tiers cosmiques (chaque liste va du rang le plus bas au plus haut du tier)
const COSMIC = [
  { id: 'abstrait', label: 'L\'abstrait', names: ['Destiny', 'Numinus', 'Unbeing', 'Origin', 'Anomaly', 'Mirage'] },
  { id: 'forces', label: 'Les forces', names: ['Les Elder Gods', 'Witchcraft', 'L\'Anti-All', 'Lifebringer One', 'Knull', 'L\'Enigma Force'] },
  { id: 'terrain', label: 'Le terrain', names: ['Opal Luna Saturnyne', 'L\'Étranger', 'Les Watchers', 'Les Aspirants', 'Les Célestes', 'Galactus', 'Le Black Winter', 'Les Beyonders', 'The Lost One'] },
  { id: 'equilibre', label: 'L\'équilibre', names: ['Némésis', 'Le Premier Firmament', 'Griever', 'Queen of Nevers', 'Then', 'Now', 'Eulogy', 'Expediency', 'Epiphany', 'Enmity', 'Empathy', 'Entropy', 'Abraxas', 'Epoch', 'Eon', 'Beacon', 'Sara Grey', 'The Preordained', 'Continuum', 'L\'In-Betweener', 'Mistress Love', 'Master Hate', 'Powers That Be', 'The Natural Order of Things', 'Lord Chaos', 'Master Order'] },
  { id: 'sommet', label: 'Le sommet', names: ['Life', 'Oblivion', 'Death', 'Infinity', 'Eternity', 'Le Phénix', 'Le Tribunal Vivant', 'One Below All', 'Divine Creator', 'Le Fulcrum', 'The One Above All'] }
];
const ERA_TERRE = { id: 'terre', label: 'Terre' };

// XP nécessaire pour atteindre le rang n (1 = Civil, 0 XP). Croissance forte : le sommet demande des années d'activité.
const xpForRank = n => n <= 1 ? 0 : Math.round(30 * Math.pow(n - 1, 2.25) / 10) * 10;

const RANKS = (() => {
  const out = [];
  EARTH_DEF.forEach(([name, universe]) => out.push({ name, tier: ERA_TERRE.id, tierLabel: ERA_TERRE.label, cosmic: false, universe }));
  DC_MULTIVERSE.names.forEach(name => out.push({ name, tier: DC_MULTIVERSE.id, tierLabel: DC_MULTIVERSE.label, cosmic: true, universe: 'dc' }));
  COSMIC.forEach(t => t.names.forEach(name => out.push({ name, tier: t.id, tierLabel: t.label, cosmic: true, universe: 'marvel' })));
  return out.map((r, i) => Object.freeze(Object.assign(r, { rank: i + 1, xp: xpForRank(i + 1) })));
})();
const TIER_IDS = [ERA_TERRE.id, DC_MULTIVERSE.id].concat(COSMIC.map(t => t.id));

const nonNeg = v => Math.max(0, Math.floor(Number(v) || 0));

// activity : { owned, read, reread, rated, reviewed, runs, keys, trophyXp, planches, followers, reactions, comments, published, debates }
// options.online : vrai seulement si un compte en ligne fournit l'activité sociale (sinon elle vaut 0)
const computeRank = (activity = {}, options = {}) => {
  const online = !!options.online;
  const breakdown = XP_RULES.map(r => {
    const count = r.social && !online ? 0 : nonNeg(activity[r.id]);
    return { id: r.id, label: r.label, unit: r.xp, count, xp: count * r.xp, social: !!r.social, pending: !!r.social && !online };
  });
  const xp = breakdown.reduce((a, b) => a + b.xp, 0);
  let i = 0;
  while (i + 1 < RANKS.length && RANKS[i + 1].xp <= xp) i++;
  const cur = RANKS[i], next = RANKS[i + 1] || null;
  return {
    xp, rank: cur, next, total: RANKS.length,
    progress: next ? Math.max(0, Math.min(1, (xp - cur.xp) / (next.xp - cur.xp))) : 1,
    toNext: next ? next.xp - xp : 0,
    breakdown
  };
};

module.exports = { XP_RULES, EARTH, EARTH_DEF, DC_MULTIVERSE, COSMIC, RANKS, TIER_IDS, xpForRank, computeRank };
