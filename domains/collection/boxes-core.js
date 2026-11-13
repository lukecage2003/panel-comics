'use strict';
// Vue « Boîtes » de la collection : les exemplaires rangés comme dans des short boxes, regroupés au choix
// par run (série), par personnage, par éditeur ou par emplacement physique. Module pur, aucune écriture.
// Le personnage vient du champ `character` de la fiche s'il est renseigné, sinon il est déduit du titre de la série ;
// une série non reconnue va dans « Autres personnages » (jamais d'attribution inventée au-delà du titre).

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Personnages de comics US / FR reconnus dans les titres (ordre : du plus précis au plus général)
const CHARACTERS = Object.freeze([
  ['Miles Morales', /miles morales/],
  ['Spider-Gwen', /spider[- ]?gwen|ghost[- ]spider/],
  ['Spider-Man', /spider[- ]?man|spectacular spider|web of spider|spider[- ]?verse/],
  ['Venom', /\bvenom|carnage/],
  ['Batman', /\bbatman|detective comics|\bbat[- ]?family|nightwing|robin\b|gotham/],
  ['Superman', /superman|action comics|man of steel/],
  ['Wonder Woman', /wonder woman/],
  ['Flash', /\bflash\b/],
  ['Green Lantern', /green lantern/],
  ['Aquaman', /aquaman/],
  ['Justice League', /justice league|\bjla\b/],
  ['Harley Quinn', /harley quinn/],
  ['Joker', /\bjoker\b/],
  ['Wolverine', /wolverine|\blogan\b/],
  ['X-Men', /x[- ]?men|x[- ]?force|x[- ]?factor|uncanny|mutants?\b|krakoa/],
  ['Deadpool', /deadpool/],
  ['Avengers', /avengers/],
  ['Iron Man', /iron man/],
  ['Captain America', /captain america/],
  ['Thor', /\bthor\b/],
  ['Hulk', /\bhulk\b/],
  ['Black Panther', /black panther|wakanda/],
  ['Daredevil', /daredevil/],
  ['Fantastic Four', /fantastic four|\bff\b/],
  ['Doctor Strange', /doctor strange|dr\.? strange/],
  ['Moon Knight', /moon knight/],
  ['Punisher', /punisher/],
  ['Captain Marvel', /captain marvel|ms\.? marvel/],
  ['Black Widow', /black widow/],
  ['Guardians of the Galaxy', /guardians of the galaxy/],
  ['Silver Surfer', /silver surfer/],
  ['Invincible', /invincible/],
  ['Spawn', /\bspawn\b/],
  ['Hellboy', /hellboy|\bb\.?p\.?r\.?d\b/],
  ['Teenage Mutant Ninja Turtles', /ninja turtles|\btmnt\b/],
  ['Transformers', /transformers/],
  ['Swamp Thing', /swamp thing/],
  ['Sandman', /sandman/]
].map(([name, re]) => Object.freeze([name, re])));

const OTHER_CHARACTERS = 'Autres personnages';
const characterOf = c => {
  if (!c) return null;
  if (typeof c.character === 'string' && c.character.trim()) return c.character.trim().slice(0, 60);
  const t = norm(c.series);
  const hit = CHARACTERS.find(([, re]) => re.test(t));
  return hit ? hit[0] : null;
};

const MODES = Object.freeze({ run: 'Par run', character: 'Par personnage', publisher: 'Par éditeur', location: 'Par boîte physique' });
const BOX_CAPACITY = 150; // une short box contient environ 150 numéros

const keyOf = (c, mode) => {
  if (mode === 'character') return characterOf(c) || OTHER_CHARACTERS;
  if (mode === 'publisher') return String(c.publisher || '').trim() || 'Éditeur inconnu';
  if (mode === 'location') return String(c.box || '').trim() || 'Non rangé';
  return String(c.series || '').trim() || 'Sans série';
};

const issueNum = v => { const m = /-?\d+(?:\.\d+)?/.exec(String(v || '')); return m ? Number(m[0]) : Infinity; };

// Boîtes triées par contenu (les plus remplies d'abord), les « autres » en dernier ; numéros triés dans chaque boîte
const buildBoxes = (copies, mode = 'run') => {
  const m = MODES[mode] ? mode : 'run';
  const groups = new Map();
  (copies || []).forEach(c => { if (!c) return; const k = keyOf(c, m); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); });
  const isOther = k => k === OTHER_CHARACTERS || k === 'Non rangé' || k === 'Éditeur inconnu' || k === 'Sans série';
  return [...groups.entries()].map(([key, items]) => {
    const sorted = items.slice().sort((a, b) => String(a.series || '').localeCompare(String(b.series || ''), 'fr') || issueNum(a.issue) - issueNum(b.issue));
    const runs = new Set(items.map(x => String(x.series || '').trim()).filter(Boolean));
    const publishers = new Set(items.map(x => String(x.publisher || '').trim()).filter(Boolean));
    return { key, label: key, mode: m, items: sorted, count: items.length, runs: runs.size, publishers: [...publishers],
      fill: Math.min(1, items.length / BOX_CAPACITY), boxes: Math.max(1, Math.ceil(items.length / BOX_CAPACITY)), other: isOther(key) };
  }).sort((a, b) => (a.other - b.other) || b.count - a.count || a.label.localeCompare(b.label, 'fr'));
};

module.exports = { norm, CHARACTERS, OTHER_CHARACTERS, characterOf, MODES, BOX_CAPACITY, keyOf, buildBoxes };
