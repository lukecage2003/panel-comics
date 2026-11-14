#!/usr/bin/env node
// Contrôle du code mort (D-67) : déclarations JavaScript de index.html jamais utilisées ailleurs.
//   node scripts/check-dead-code.js          -> rapport, échoue si une déclaration morte n'est pas dans la liste connue
//   node scripts/check-dead-code.js --list   -> rapport complet, sans échec
// Méthode : chaque `const|let|var|function NOM` déclaré dans un <script> intégré doit apparaître au moins une seconde fois
// (appel, lecture, export, attribut HTML). Les modules synchronisés depuis domains/** sont exclus : leurs exports sont
// testés par leurs propres suites. Un nom construit dynamiquement (rare) peut être ajouté à ALLOW avec sa raison.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Noms utilisés indirectement (chaîne, réflexion, API de test) : chacun avec sa raison
const ALLOW = new Map([
]);

// Parties générées par scripts/sync-domains.js (entre <!-- @domains:begin --> et <!-- @domains:end -->) : exclues
const app = html.replace(/<!-- @domains:begin -->[\s\S]*?<!-- @domains:end -->/, '');

const scripts = [];
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(app))) {
  if (/\ssrc=|type=["']?(application\/(ld\+)?json|module)/i.test(m[1])) continue;
  scripts.push(m[2]);
}
const code = scripts.join('\n');
// Retire chaînes et commentaires pour trouver les déclarations (mais compte les usages dans tout le fichier, chaînes comprises)
const decls = new Set();
const declRe = /(?:^|[;{}\n]\s*)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=|(?:^|[;{}\n]\s*)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
while ((m = declRe.exec(code))) decls.add(m[1] || m[2]);

const count = name => {
  // Un point isolé devant le nom = propriété d'un autre objet ; « ...nom » (décomposition) est bien un usage
  const r = new RegExp('(?<![\\w$])(?<![^.]\\.)' + name.replace(/\$/g, '\\$') + '(?![\\w$])', 'g');
  return (html.match(r) || []).length;
};
const dead = [...decls].filter(n => n.length > 1 && count(n) < 2).sort();
const unknown = dead.filter(n => !ALLOW.has(n));
const list = process.argv.includes('--list');

console.log('check-dead-code : ' + decls.size + ' déclarations analysées, ' + dead.length + ' jamais réutilisée(s).');
if (dead.length) dead.forEach(n => console.log('  ' + (ALLOW.has(n) ? '(connue) ' : '') + n + (ALLOW.has(n) ? ' — ' + ALLOW.get(n) : '')));
if (!list && unknown.length) { console.error('check-dead-code : ' + unknown.length + ' déclaration(s) morte(s) à retirer ou à justifier.'); process.exit(1); }
