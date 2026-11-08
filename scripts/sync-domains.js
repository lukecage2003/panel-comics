#!/usr/bin/env node
'use strict';
// Intègre les modules de domaines testés (domains/**) dans index.html, qui reste l'unique fichier de l'application
// (service worker, APK Android). Les tests Node portent sur la source ; ce script garantit que la copie intégrée est identique.
//   node scripts/sync-domains.js          réécrit le bloc intégré
//   node scripts/sync-domains.js --check  renvoie 1 si le bloc diffère de la source (inclus dans npm run test:all)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const MODULES = [
  ['catalogCore', 'domains/explorer/catalog-core.js'],
  ['communityPolicy', 'domains/community/policy-core.js'],
  ['mediaCore', 'domains/explorer/media-core.js'],
  ['eventSeeds', 'domains/explorer/events-seed.js'],
  ['eventCrossref', 'domains/explorer/events-crossref.js'],
  ['publicationCore', 'domains/catalog/publication-core.js']
];
const BEGIN = '<!-- @domains:begin -->', END = '<!-- @domains:end -->';
const ANCHOR = '<!-- ==========================================================================\n     LOGIQUE JAVASCRIPT DU LECTEUR';

const build = () => {
  const parts = MODULES.map(([name, file]) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
    if (/<\/script/i.test(src)) throw new Error(file + ' contient </script>');
    if (/\brequire\(/.test(src.replace(/\/\/.*$/gm, ''))) throw new Error(file + ' ne doit dépendre d\'aucun module');
    return `/* ${file} */\n  out.${name} = (() => { const module = { exports: {} };\n${src.trimEnd()}\n  return Object.freeze(module.exports); })();`;
  });
  return `${BEGIN}\n<script>\n// Domaines intégrés depuis domains/ par scripts/sync-domains.js : ne pas modifier ici (modifier la source, puis relancer le script).\nwindow.PanelDomains = (() => {\n  const out = {};\n  ${parts.join('\n  ')}\n  return Object.freeze(out);\n})();\n</script>\n${END}`;
};

let html = fs.readFileSync(HTML, 'utf8');
const eol = html.includes('\r\n') ? '\r\n' : '\n';
const block = build().replace(/\n/g, eol);
const b = html.indexOf(BEGIN), e = html.indexOf(END);
const current = b >= 0 && e > b ? html.slice(b, e + END.length) : null;
if (process.argv.includes('--check')) {
  if (current !== block) { console.error('sync-domains : le bloc intégré dans index.html diffère de domains/ (lancer node scripts/sync-domains.js)'); process.exit(1); }
  console.log('sync-domains : ' + MODULES.length + ' module(s) intégré(s), identiques à la source.');
  process.exit(0);
}
if (current !== null) html = html.slice(0, b) + block + html.slice(e + END.length);
else {
  const a = html.indexOf(ANCHOR.replace(/\n/g, eol));
  if (a < 0) throw new Error('ancre absente de index.html');
  html = html.slice(0, a) + block + eol + eol + html.slice(a);
}
fs.writeFileSync(HTML, html);
console.log('sync-domains : bloc écrit (' + MODULES.length + ' modules).');
