#!/usr/bin/env node
'use strict';
// Stabilisation E (U1, mouvement réduit) : garde-fou statique sur index.html.
//  1. Toute règle CSS contenant :hover est sous @media (hover: hover), sauf les neutralisations
//     placées sous @media (prefers-reduced-motion: reduce).
//  2. Aucun défilement « smooth » codé en dur : passer par smoothScroll(), qui respecte prefers-reduced-motion.
//  3. La règle globale de mouvement réduit arrête aussi les animations en boucle et le défilement animé.
const fs = require('fs');
const path = require('path');

function hoverRules(html) {
  const a = html.indexOf('<style>') + 7, b = html.indexOf('</style>', a);
  const css = html.slice(a, b), out = [];
  let i = 0, start = 0; const stack = [];
  while (i < css.length) {
    if (css.startsWith('/*', i)) { i = css.indexOf('*/', i + 2) + 2; start = i; continue; }
    const c = css[i];
    if (c === '"' || c === "'") { i = css.indexOf(c, i + 1) + 1; continue; }
    if (c === '{') { stack.push(css.slice(start, i).trim()); start = i + 1; }
    else if (c === '}') {
      const pre = stack.pop();
      if (pre && !pre.startsWith('@') && pre.includes(':hover')) out.push({ sel: pre.replace(/\s+/g, ' '), ctx: stack.join(' ') });
      start = i + 1;
    }
    i++;
  }
  return out;
}

function check(html) {
  const problems = [];
  const rules = hoverRules(html);
  for (const r of rules) if (!/hover:\s*hover|prefers-reduced-motion:\s*reduce/.test(r.ctx)) problems.push('survol sans garde : ' + r.sel.slice(0, 100));
  const smooth = (html.match(/behavior:\s*'smooth'/g) || []).length;
  if (smooth) problems.push(smooth + " défilement(s) behavior: 'smooth' codé(s) en dur (utiliser smoothScroll())");
  if (!/prefers-reduced-motion: reduce\) \{ html \{ scroll-behavior: auto !important; \}[^}]*animation-iteration-count: 1 !important/.test(html)) problems.push('règle globale de mouvement réduit incomplète');
  return { rules: rules.length, problems };
}

module.exports = { hoverRules, check };
if (require.main === module) {
  const { rules, problems } = check(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'));
  console.log(`check-motion : ${rules} règle(s) :hover analysée(s), ${problems.length} problème(s).`);
  problems.forEach(p => console.log('  ' + p));
  process.exitCode = problems.length ? 1 : 0;
}
