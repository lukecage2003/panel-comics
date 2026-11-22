#!/usr/bin/env node
// D-121 : contrôle de sécurité statique, inspiré des listes OWASP (ASVS, aide-mémoire CSP et Supabase RLS).
// Ne remplace pas un audit dynamique (OWASP ZAP, Lighthouse) : il empêche de réintroduire les erreurs connues.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');
const fails = [], ok = [];
const check = (name, cond, detail) => (cond ? ok : fails).push(name + (cond || !detail ? '' : ' : ' + detail));

// 1. Politique de sécurité du contenu
const csp = (html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/) || [])[1] || '';
const dir = n => (csp.match(new RegExp('(?:^|;)\\s*' + n + '\\s+([^;]*)')) || [])[1] || '';
check('CSP présente', !!csp);
check('script-src sans unsafe-inline ni unsafe-eval', !!dir('script-src') && !/'unsafe-(inline|eval)'/.test(dir('script-src')), dir('script-src'));
check('object-src none', /'none'/.test(dir('object-src')));
check('base-uri limité', /'self'|'none'/.test(dir('base-uri')));
check('form-action limité', !!dir('form-action'));
check('Referrer-Policy no-referrer', /<meta name="referrer" content="no-referrer">/.test(html));

// 2. Code de la page
const markup = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const inlineHandlers = markup.match(/<[a-z][^>]*\son(click|load|error|change|input|submit|mouse\w+|key\w+)\s*=/gi) || [];
check('aucun gestionnaire d’événement en ligne dans le HTML', !inlineHandlers.length, inlineHandlers.length + ' trouvé(s)');
const blank = html.match(/target=["\\]*_blank["\\]*[^>]*>/g) || [];
const blankNoRel = blank.filter(t => !/noopener|noreferrer/.test(t));
check('liens target=_blank avec rel=noopener', !blankNoRel.length, blankNoRel.length + ' sans noopener');
check('aucun eval()', !/[^.\w]eval\s*\(/.test(html));
const vendors = [...html.matchAll(/src="(vendor\/[^"]+)"/g)].map(m => m[1]);
check('bibliothèques locales en version figée', vendors.every(v => /\d+\.\d+/.test(v)), vendors.filter(v => !/\d+\.\d+/.test(v)).join(', '));
check('aucune bibliothèque chargée depuis un CDN', !/<script[^>]+src="https?:/.test(html));

// 3. Relais hébergé
const relay = read('backend/supabase/functions/panel-relay/index.ts');
check('relais : liste d’origines autorisées', /lukecage2003\\?\.github\\?\.io/.test(relay) && /403/.test(relay));
check('relais : limite de requêtes', /429/.test(relay));
check('relais : GET seulement', /GET/.test(relay) && /405/.test(relay));

// 4. Base de données (migrations)
const migDir = path.join(ROOT, 'backend/supabase/migrations');
const sql = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).map(f => fs.readFileSync(path.join(migDir, f), 'utf8')).join('\n');
const definers = [...sql.matchAll(/create\s+or\s+replace\s+function\s+([\w.]+)\s*\([\s\S]*?\$\$/gi)].map(m => m[0]).filter(f => /security\s+definer/i.test(f));
const noPath = definers.filter(f => !/set\s+search_path\s*=\s*''/i.test(f)).map(f => (f.match(/function\s+([\w.]+)/i) || [])[1]);
check('fonctions SECURITY DEFINER avec search_path vide', !noPath.length, noPath.join(', '));
const anonGrants = [...sql.matchAll(/grant\s+(?!usage)[^;]*\bon\s+(?:table\s+)?app\.[^;]*\bto\s+[^;]*\banon\b/gi)].map(m => m[0].slice(0, 80));
check('aucun droit direct d’anon sur les tables app.*', !anonGrants.length, anonGrants.join(' | '));
const tables = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(app\.\w+)/gi)].map(m => m[1]);
const noRls = tables.filter(t => !new RegExp('alter\\s+table\\s+' + t.replace('.', '\\.') + '\\s+enable\\s+row\\s+level\\s+security', 'i').test(sql));
check('RLS activée sur toutes les tables app.*', !noRls.length, noRls.join(', '));

console.log('check-security : ' + ok.length + ' règle(s) respectée(s), ' + fails.length + ' échec(s).');
fails.forEach(f => console.log('  ✗ ' + f));
process.exit(fails.length ? 1 : 0);
