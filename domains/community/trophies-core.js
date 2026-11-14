'use strict';
// Trophées Panel (D-59) : calculés à partir des données locales (collection, lecture, pull list), jamais stockés ni inventés.
// Quatre paliers : Bronze, Argent, Or et Vibranium (le plus rare). Originalités par rapport aux badges habituels :
//  - les « Gardiens » : un trophée par personnage, créé dynamiquement à partir des boîtes par personnage ;
//  - les « Ères » : Golden, Silver, Bronze, Modern Age, d'après l'année de couverture ;
//  - le « Voyageur temporel » : au moins un numéro de chaque ère ;
//  - un niveau de collectionneur (XP) qui additionne les paliers obtenus.
// D-75 : Bronze s'obtient vite (pour démarrer), Argent, Or et Vibranium demandent des années (environ dix pour tout finir).
// Module pur : reçoit des entrées déjà préparées, n'écrit rien.

const TIERS = Object.freeze([
  { id: 'bronze', label: 'Bronze', xp: 10 },
  { id: 'silver', label: 'Argent', xp: 25 },
  { id: 'gold', label: 'Or', xp: 60 },
  { id: 'vibranium', label: 'Vibranium', xp: 150 }
]);

const ERAS = Object.freeze([
  { id: 'golden', label: 'Golden Age', from: 1938, to: 1955 },
  { id: 'silver', label: 'Silver Age', from: 1956, to: 1969 },
  { id: 'bronze', label: 'Bronze Age', from: 1970, to: 1984 },
  { id: 'modern', label: 'Modern Age', from: 1985, to: 2100 }
]);

const yearOf = c => { const m = /^(\d{4})/.exec(String((c && (c.coverYear || c.coverDate)) || '')); return m ? Number(m[1]) : null; };
const eraOf = c => { const y = yearOf(c); return y ? (ERAS.find(e => y >= e.from && y <= e.to) || null) : null; };
const issueNum = v => { const m = /-?\d+(?:\.\d+)?/.exec(String(v || '')); return m ? Number(m[0]) : null; };

// Définitions : seuils croissants pour Bronze, Argent, Or, Vibranium
const DEFS = Object.freeze([
  { id: 'collector', family: 'Collection', name: 'Collectionneur', icon: 'box', steps: [10, 250, 1500, 5000], unit: 'numéro', desc: 'Numéros possédés' },
  { id: 'runner', family: 'Collection', name: 'Complétiste', icon: 'stack', steps: [1, 10, 40, 120], unit: 'run complet', desc: 'Runs complets du premier au dernier numéro possédé' },
  { id: 'firsts', family: 'Collection', name: 'Chasseur de #1', icon: 'one', steps: [5, 50, 250, 750], unit: 'numéro 1', desc: 'Numéros 1 possédés' },
  { id: 'keys', family: 'Collection', name: 'Clé de voûte', icon: 'key', steps: [1, 20, 100, 400], unit: 'key issue', desc: 'Key issues possédés' },
  { id: 'multiverse', family: 'Exploration', name: 'Multivers', icon: 'orbit', steps: [3, 8, 15, 25], unit: 'éditeur', desc: 'Éditeurs différents dans la collection' },
  { id: 'reader', family: 'Lecture', name: 'Dévoreur', icon: 'book', steps: [10, 300, 2000, 6000], unit: 'lecture', desc: 'Numéros lus (premières lectures)' },
  { id: 'rereader', family: 'Lecture', name: 'Relecteur', icon: 'loop', steps: [1, 25, 150, 500], unit: 'relecture', desc: 'Relectures notées dans le journal' },
  { id: 'wednesday', family: 'Pull list', name: 'Fidèle du mercredi', icon: 'calendar', steps: [1, 50, 400, 1500], unit: 'numéro récupéré', desc: 'Numéros de la pull list récupérés' },
  { id: 'archivist', family: 'Rangement', name: 'Archiviste', icon: 'archive', steps: [10, 250, 1500, 5000], unit: 'numéro rangé', desc: 'Numéros possédés avec un emplacement' },
  // D-71 : runs lus en entier, longs runs, galerie de personnages
  { id: 'run-reader', family: 'Lecture', name: 'Lecteur de runs', icon: 'book', steps: [1, 10, 40, 120], unit: 'run lu', plural: 'runs lus', desc: 'Runs complets lus du premier au dernier numéro' },
  { id: 'marathon', family: 'Collection', name: 'Marathonien', icon: 'stack', steps: [1, 5, 15, 40], unit: 'long run', plural: 'longs runs', desc: 'Runs complets de 12 numéros ou plus' },
  { id: 'gallery', family: 'Exploration', name: 'Galerie de héros', icon: 'mask', steps: [5, 25, 80, 200], unit: 'personnage', desc: 'Personnages différents dans la collection' }
]);

const tierFor = (value, steps) => { let t = -1; steps.forEach((s, i) => { if (value >= s) t = i; }); return t; };

const describe = (def, value) => {
  const t = tierFor(value, def.steps);
  const next = t + 1 < def.steps.length ? def.steps[t + 1] : null;
  const prev = t >= 0 ? def.steps[t] : 0;
  return { id: def.id, family: def.family, name: def.name, icon: def.icon, desc: def.desc, unit: def.unit, plural: def.plural || def.unit + 's', value,
    tier: t >= 0 ? TIERS[t].id : null, tierLabel: t >= 0 ? TIERS[t].label : null, tierIndex: t,
    next, progress: next === null ? 1 : Math.max(0, Math.min(1, (value - prev) / (next - prev))) };
};

// D-71 : détail des runs complets (série, premier et dernier numéro, nombre, lus en entier ou non).
// isRead(copy) -> vrai si le numéro est lu ; un run est « lu » quand chacun de ses numéros l'est.
const runsDetail = (copies, isRead = () => false, min = 3) => {
  const by = new Map();
  (copies || []).filter(Boolean).forEach(c => {
    const n = issueNum(c.issue); if (n === null || !Number.isInteger(n)) return;
    const name = String(c.series || '').trim(); const k = name.toLowerCase(); if (!k) return;
    if (!by.has(k)) by.set(k, { series: name, nums: new Map() });
    const e = by.get(k).nums.get(n) || { read: false, copy: c };
    if (isRead(c)) e.read = true;
    by.get(k).nums.set(n, e);
  });
  const out = [];
  by.forEach(v => {
    const arr = [...v.nums.keys()].sort((a, b) => a - b);
    if (arr.length < min || arr[arr.length - 1] - arr[0] + 1 !== arr.length) return;
    out.push({ series: v.series, from: arr[0], to: arr[arr.length - 1], count: arr.length, read: arr.every(n => v.nums.get(n).read), first: v.nums.get(arr[0]).copy });
  });
  return out.sort((a, b) => b.count - a.count || a.series.localeCompare(b.series));
};

// Runs complets : au moins `min` numéros entiers consécutifs depuis le plus petit numéro possédé, sans trou
const completeRuns = (copies, min = 3) => {
  const by = new Map();
  copies.forEach(c => { const n = issueNum(c.issue); if (n === null || !Number.isInteger(n)) return; const k = String(c.series || '').trim().toLowerCase(); if (!k) return; if (!by.has(k)) by.set(k, new Set()); by.get(k).add(n); });
  let n = 0;
  by.forEach(set => { const arr = [...set].sort((a, b) => a - b); if (arr.length >= min && arr[arr.length - 1] - arr[0] + 1 === arr.length) n++; });
  return n;
};

// input : { copies (possédés), log (journal de lecture), picked (nombre de numéros récupérés), characterOf(copy) -> nom|null,
//           isKey(copy), isGraded(copy), isRead(copy) (D-71 : runs lus en entier) }
const computeTrophies = (input = {}) => {
  const copies = (input.copies || []).filter(Boolean);
  const log = (input.log || []).filter(Boolean);
  const isKey = input.isKey || (c => !!c.keyType && c.keyType !== 'none');
  const isGraded = input.isGraded || (c => /\b(cgc|cbcs|pgx)\b/i.test(String(c.condition || '')));
  const runs = runsDetail(copies, input.isRead || (() => false));
  const values = {
    collector: copies.length,
    runner: completeRuns(copies),
    firsts: copies.filter(c => issueNum(c.issue) === 1).length,
    keys: copies.filter(isKey).length,
    multiverse: new Set(copies.map(c => String(c.publisher || '').trim().toLowerCase()).filter(Boolean)).size,
    reader: log.filter(l => l.event === 'finished').length,
    rereader: log.filter(l => l.event === 'reread').length,
    wednesday: Math.max(0, Number(input.picked) || 0),
    archivist: copies.filter(c => String(c.box || c.location || '').trim()).length,
    'run-reader': runs.filter(r => r.read).length,
    marathon: runs.filter(r => r.count >= 12).length,
    gallery: new Set(copies.map(c => (input.characterOf || (() => null))(c)).filter(Boolean)).size
  };
  const trophies = DEFS.map(d => describe(d, values[d.id]));

  // Ères : un trophée par ère (Bronze 1, Argent 5, Or 25, Vibranium 100 numéros de l'ère)
  const eraCounts = Object.fromEntries(ERAS.map(e => [e.id, 0]));
  copies.forEach(c => { const e = eraOf(c); if (e) eraCounts[e.id]++; });
  const eras = ERAS.map(e => describe({ id: 'era-' + e.id, family: 'Ères', name: e.label, icon: 'clock', steps: [1, 10, 50, 200], unit: 'numéro', desc: 'Numéros parus entre ' + e.from + ' et ' + (e.to > 2050 ? 'aujourd\'hui' : e.to) }, eraCounts[e.id]));
  const erasCovered = ERAS.filter(e => eraCounts[e.id] > 0).length;
  const traveler = describe({ id: 'time-traveler', family: 'Ères', name: 'Voyageur temporel', icon: 'hourglass', steps: [2, 3, 4, 4], unit: 'ère', desc: 'Ères représentées dans la collection (Vibranium : les quatre, avec 10 numéros dans chacune)' }, erasCovered);
  if (traveler.tierIndex === 3 && !ERAS.every(e => eraCounts[e.id] >= 10)) Object.assign(traveler, describe({ id: 'time-traveler', family: 'Ères', name: 'Voyageur temporel', icon: 'hourglass', steps: [2, 3, 4, 5], unit: 'ère', desc: traveler.desc }, 4));

  // Gardiens : un trophée par personnage (au moins 5 numéros), les 12 plus fournis ; D-71 : nom du personnage gardé pour son portrait
  const charOf = input.characterOf || (() => null);
  const perChar = new Map();
  copies.forEach(c => { const ch = charOf(c); if (ch) perChar.set(ch, (perChar.get(ch) || 0) + 1); });
  const guardians = [...perChar.entries()].filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([ch, n]) => Object.assign(describe({ id: 'guardian-' + ch.toLowerCase().replace(/[^a-z0-9]+/g, '-'), family: 'Gardiens', name: 'Gardien · ' + ch, icon: 'mask', steps: [5, 50, 200, 600], unit: 'numéro', desc: 'Numéros de ' + ch + ' possédés' }, n), { character: ch }));

  const all = trophies.concat(eras, [traveler], guardians);
  const xp = all.reduce((a, t) => a + (t.tierIndex >= 0 ? TIERS.slice(0, t.tierIndex + 1).reduce((s, x) => s + x.xp, 0) : 0), 0);
  const level = Math.floor(Math.sqrt(xp / 20)) + 1;
  const nextLevelXp = 20 * level * level;
  const prevLevelXp = 20 * (level - 1) * (level - 1);
  return {
    trophies: all, xp, level, levelProgress: Math.max(0, Math.min(1, (xp - prevLevelXp) / (nextLevelXp - prevLevelXp))), nextLevelXp,
    unlocked: all.filter(t => t.tierIndex >= 0).length, total: all.length, runs,
    byTier: Object.fromEntries(TIERS.map((t, i) => [t.id, all.filter(x => x.tierIndex === i).length]))
  };
};

// Titre du collectionneur selon le niveau
const titleFor = level => level >= 20 ? 'Légende du multivers' : level >= 12 ? 'Gardien des archives' : level >= 7 ? 'Collectionneur aguerri' : level >= 3 ? 'Habitué du comic shop' : 'Nouvelle recrue';

// Profil local : pseudo et préférences, validés (aucune donnée envoyée)
const sanitizeProfile = p => {
  const s = (v, n) => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
  const color = /^#[0-9a-f]{6}$/i.test(String(p && p.color || '')) ? p.color : '#7C5CFF';
  const handle = s(p && p.handle, 24).replace(/\s+/g, '_');
  // Top 3 personnages et top 3 runs : trois entrées au plus, sans doublon ni vide
  const top3 = v => (Array.isArray(v) ? v : []).map(x => s(x, 60)).filter((x, i, a) => x && a.findIndex(y => y.toLowerCase() === x.toLowerCase()) === i).slice(0, 3);
  return { handle, displayName: s(p && p.displayName, 40), bio: s(p && p.bio, 160), favorite: s(p && p.favorite, 60), color, topCharacters: top3(p && p.topCharacters), topRuns: top3(p && p.topRuns), createdAt: (p && p.createdAt) || null };
};
const validHandle = h => /^[A-Za-z0-9_.À-ſ-]{3,24}$/.test(String(h || ''));

module.exports = { TIERS, ERAS, DEFS, eraOf, runsDetail, completeRuns, tierFor, computeTrophies, titleFor, sanitizeProfile, validHandle };
