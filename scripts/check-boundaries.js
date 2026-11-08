#!/usr/bin/env node
'use strict';
// Contrôle statique des frontières entre domaines (préparation du lot 3.1b, aucun changement de comportement).
// Mode rapport (par défaut) : liste les couplages connus, code de sortie 0.
// Mode strict (--strict, à activer au sous-lot 3.1b-6) : code de sortie 1 s'il reste un couplage interdit.
// Références : docs/phase4/02-frontieres-collection-explorer.md (C2-C10, D1-D4, E1-E5), docs/directeur/05-preparation-lot-3.1b.md.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(FILE, 'utf8').split(/\r?\n/);

// Fonctions de premier niveau de l'IIFE : « const nom = » indenté de deux espaces.
const fns = [];
src.forEach((line, i) => {
  const m = /^ {2}const ([A-Za-z_$][\w$]*) = /.exec(line);
  if (m) fns.push({ name: m[1], start: i });
});
fns.forEach((f, k) => { f.end = k + 1 < fns.length ? fns[k + 1].start - 1 : src.length - 1; });

// Explorer : fonctions préfixées « ex » (hors exports génériques) et rendu des entités.
const isExplorer = n => /^ex[A-Z]/.test(n) || n === 'wireExplorer' || n === 'showExplorer';
// Identifiants personnels (Collection, Lecture) qu'Explorer ne doit plus lire directement après 3.1b.
const PERSONAL = [
  { id: 'physicalSingles', rule: 'C2-C6 : inventaire personnel → S1' },
  { id: 'relPulls', rule: 'C8 : Pull List (Collection) → S1 inPullList' },
  { id: 'openSingleInspector', rule: 'C9 : action Collection → S2 openItem' },
  { id: 'addPubToWishlist', rule: 'C9 : action Collection → S2 addToWishlist' },
  { id: "exPut('readprog'", rule: 'C10 : écriture de la progression (Lecture) → S2 setGuideProgress' },
  { id: 'persistSingles', rule: 'Écriture de Collection depuis Explorer interdite' },
  { id: "put('collection'", rule: 'A7 : catégorie « Ma collection » dans la recherche Explorer' }
];

const findings = [];
for (const f of fns.filter(f => isExplorer(f.name))) {
  for (let i = f.start; i <= f.end; i++) {
    const line = src[i];
    if (/^\s*\/\//.test(line)) continue;
    for (const p of PERSONAL) if (line.includes(p.id)) findings.push({ fn: f.name, line: i + 1, id: p.id, rule: p.rule });
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
