'use strict';
// Politique de sécurité du contenu (CSP) de index.html (lot 3.2, D-83) — générée, jamais écrite à la main.
// Les scripts en ligne sont autorisés par leur empreinte SHA-256 : tout script injecté (XSS) est refusé.
// Usage : node scripts/csp.js          → recalcule les empreintes et réécrit la balise <meta> de index.html
//         node scripts/csp.js --check  → échoue si la balise ne correspond plus aux scripts (à relancer après toute modification)
// Relancé automatiquement par scripts/sync-domains.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'index.html');
const START = '<!-- CSP:début (générée par scripts/csp.js, ne pas modifier à la main) -->';
const END = '<!-- CSP:fin -->';

function inlineScripts(html) {
  const out = [], re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  // Le navigateur hache le texte après normalisation des fins de ligne (CRLF → LF) : même empreinte quel que soit le checkout
  while ((m = re.exec(html))) out.push(m[1].replace(/\r\n?/g, '\n'));
  return out;
}

function policy(html) {
  const hashes = inlineScripts(html).map(s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'");
  const zx = (/const ZXING_VERSION = '([0-9.]+)'/.exec(html) || [])[1];
  if (!zx) throw new Error('ZXING_VERSION introuvable dans index.html');
  const directives = [
    "default-src 'self'",
    // Scripts : ceux de la page (empreintes), JSZip et zxing-wasm en version figée, réponses JSONP de Comic Vine (clé personnelle) ;
    // 'wasm-unsafe-eval' pour le lecteur de codes-barres (WebAssembly), jamais 'unsafe-eval' ni 'unsafe-inline'
    ["script-src 'self'"].concat(hashes, [
      'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
      'https://cdn.jsdelivr.net/npm/zxing-wasm@' + zx + '/dist/iife/reader/index.js',
      'https://comicvine.gamespot.com/api/',
      "'wasm-unsafe-eval'"]).join(' '),
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
    'frame-src https://www.openstreetmap.org',
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];
  return { csp: directives.join('; '), count: hashes.length };
}

function block(csp) {
  return START + '\n  <meta http-equiv="Content-Security-Policy" content="' + csp.replace(/"/g, '&quot;') + '" />\n  ' + END;
}

// Pour une copie transformée de index.html (application Android, build-www.js) : balise recalculée sur le texte final
function apply(html) {
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < a) throw new Error('csp : balise absente');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  return html.slice(0, a) + block(policy(html).csp).replace(/\n/g, eol) + html.slice(b + END.length);
}

function run(check) {
  const html = fs.readFileSync(FILE, 'utf8');
  const { csp, count } = policy(html);
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const want = block(csp).replace(/\n/g, eol);
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < a) {
    if (check) { console.error('csp : balise absente de index.html (lancez node scripts/csp.js)'); process.exit(1); }
    // Première insertion : juste après <meta charset>, avant tout script (une CSP en <meta> ne vaut que pour la suite du document)
    const anchor = '<meta charset="utf-8" />';
    if (html.indexOf(anchor) < 0) throw new Error('<meta charset> introuvable');
    fs.writeFileSync(FILE, html.replace(anchor, anchor + eol + '  ' + want));
    console.log('csp : balise insérée (' + count + ' script(s) en ligne).');
    return;
  }
  const cur = html.slice(a, b + END.length);
  if (cur === want) { console.log('csp : à jour (' + count + ' script(s) en ligne).'); return; }
  if (check) { console.error('csp : empreintes périmées (lancez node scripts/csp.js)'); process.exit(1); }
  fs.writeFileSync(FILE, html.slice(0, a) + want + html.slice(b + END.length));
  console.log('csp : empreintes mises à jour (' + count + ' script(s) en ligne).');
}

if (require.main === module) run(process.argv.includes('--check'));
module.exports = { policy, inlineScripts, run, apply };
