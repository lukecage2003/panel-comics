#!/usr/bin/env node
'use strict';
// Contrôle statique des frontières entre domaines (préparation du lot 3.1b, aucun changement de comportement).
// Mode rapport (par défaut) : liste les couplages connus, code de sortie 0.
// Mode strict (--strict, à activer au sous-lot 3.1b-6) : code de sortie 1 s'il reste un couplage interdit.
// Références : docs/phase4/02-frontieres-collection-explorer.md (C2-C10, D1-D4, E1-E5), docs/directeur/05-preparation-lot-3.1b.md.
const fs = require('fs');
const path = require('path');

const FILE = process.env.BOUNDARIES_FILE || path.join(__dirname, '..', 'index.html'); // fichier substituable (contrôle négatif des tests)
const src = fs.readFileSync(FILE, 'utf8').split(/\r?\n/);

// Fonctions de premier niveau de l'IIFE : « const nom = » indenté de deux espaces.
const fns = [];
src.forEach((line, i) => {
  const m = /^ {2}const ([A-Za-z_$][\w$]*) = /.exec(line);
  if (m) fns.push({ name: m[1], start: i });
});
fns.forEach((f, k) => { f.end = k + 1 < fns.length ? fns[k + 1].start - 1 : src.length - 1; });

// Explorer : fonctions préfixées « ex » et « gd » (guides), rendu, chargement et éditeur de guides.
const EXPLORER_FNS = ['wireExplorer', 'showExplorer', 'renderExplorer', 'loadExplorerData', 'renderGuideEditor', 'openGuideEditor', 'saveGuideDraft', 'wireGuideEditor'];
const isExplorer = n => /^(ex|gd)[A-Z]/.test(n) || EXPLORER_FNS.includes(n);
// Identifiants personnels (Collection, Lecture) qu'Explorer ne doit plus lire directement après 3.1b.
const PERSONAL = [
  { id: 'physicalSingles', rule: 'C2-C6 : inventaire personnel → S1' },
  { id: 'relPulls', rule: 'C8 : Pull List (Collection) → S1 inPullList' },
  { id: 'openSingleInspector', rule: 'C9 : action Collection → S2 openItem' },
  { id: 'addPubToWishlist', rule: 'C9 : action Collection → S2 addToWishlist' },
  { id: "exPut('readprog'", rule: 'C10 : écriture de la progression (Lecture) → S2 setGuideProgress' },
  { id: 'persistSingles', rule: 'Écriture de Collection depuis Explorer interdite' },
  { id: "put('collection'", rule: 'A7 : catégorie « Ma collection » dans la recherche Explorer' },
  // Lot 3.1b-3 : fonctions internes de Collection et de Lecture, accessibles seulement par S1 et S2
  { id: 'getPullList', rule: 'C8 : séries suivies (Collection) → S1 seriesFollowed' },
  { id: 'seriesMeta', rule: 'C8 : séries suivies (Collection) → S1 seriesFollowed' },
  { id: 'isPulled', rule: 'C8 : séries suivies (Collection) → S1 seriesFollowed' },
  { id: 'colMatch', rule: 'Rapprochement interne de Collection → S1' },
  { id: 'colIndex', rule: 'Rapprochement interne de Collection → S1' },
  { id: 'lecSetGuideProgress', rule: 'C10 : écriture de la progression (Lecture) → S2 setGuideProgress' },
  { id: 'exProgress', rule: 'C10 : lecture de la progression (Lecture) → S1 guideProgress', allow: ['exEditorial', 'loadExplorerData'] }
];

const findings = [];
for (const f of fns.filter(f => isExplorer(f.name))) {
  for (let i = f.start; i <= f.end; i++) {
    const line = src[i];
    if (/^\s*\/\//.test(line)) continue;
    for (const p of PERSONAL) if (line.includes(p.id) && !(p.allow && p.allow.includes(f.name))) findings.push({ fn: f.name, line: i + 1, id: p.id, rule: p.rule });
  }
}

const strict = process.argv.includes('--strict');
const byRule = {};
findings.forEach(x => { (byRule[x.rule] = byRule[x.rule] || []).push(`${x.fn} l.${x.line}`); });
console.log(`check-boundaries : ${fns.filter(f => isExplorer(f.name)).length} fonctions Explorer analysées, ${findings.length} couplage(s) vers les données personnelles.`);
for (const [rule, where] of Object.entries(byRule)) console.log(`  - ${rule} : ${where.join(', ')}`);
if (strict && findings.length) { console.log('check-boundaries --strict : ÉCHEC (frontières non respectées).'); process.exitCode = 1; }
else if (!strict) console.log('Mode rapport : aucun échec. Le mode --strict sera activé au sous-lot 3.1b-6.');

module.exports = { findings };
