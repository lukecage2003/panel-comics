// Prépare www/ pour l'APK à partir de la source unique ../index.html :
//  - bibliothèques (JSZip, zxing-wasm) copiées depuis ../vendor → l'app fonctionne hors ligne ;
//  - empreintes SHA-256 vérifiées (vendor.lock.json) : un fichier modifié bloque la construction ;
//  - pas de service worker (inutile dans l'app).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(__dirname, 'www');
const LOCK = path.join(__dirname, 'vendor.lock.json');

// Fichiers versionnés dans ../vendor (stabilisation S6) ; l'adresse d'origine sert de clé au verrou d'empreintes
const VENDOR = [
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', out: 'vendor/jszip-3.10.1.min.js' },
  { url: 'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/iife/reader/index.js', out: 'vendor/zxing-wasm-3.1.3/iife/reader/index.js' },
  { url: 'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/reader/zxing_reader.wasm', out: 'vendor/zxing-wasm-3.1.3/reader/zxing_reader.wasm' }
];

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

(async () => {
  const lock = fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) : {};
  fs.rmSync(WWW, { recursive: true, force: true });
  fs.mkdirSync(WWW, { recursive: true });

  for (const v of VENDOR) {
    const src = path.join(ROOT, v.out);
    if (!fs.existsSync(src)) throw new Error('Bibliothèque absente du dépôt : ' + v.out);
    const buf = fs.readFileSync(src);
    const h = sha(buf);
    if (lock[v.url] && lock[v.url] !== h) throw new Error(`Empreinte différente pour ${v.url} : fichier modifié, construction arrêtée.`);
    lock[v.url] = h;
    fs.mkdirSync(path.dirname(path.join(WWW, v.out)), { recursive: true });
    fs.writeFileSync(path.join(WWW, v.out), buf);
  }
  fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2));

  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const swap = (from, to) => {
    if (!html.includes(from)) throw new Error('Motif absent de index.html : ' + from);
    html = html.split(from).join(to);
  };
  // Les bibliothèques sont déjà appelées par leur chemin local (vendor/) : aucune adresse à remplacer
  if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(html)) throw new Error('index.html appelle encore un CDN');
  // Les balises <script> des bibliothèques ne doivent plus demander d'en-têtes CORS au CDN
  html = html.replace(/(<script src="vendor\/[^"]+")\s+integrity="[^"]*"/g, '$1').replace(/(<script src="vendor\/[^"]+")\s+crossorigin="[^"]*"/g, '$1');
  // CSP (D-83) : le script principal vient d'être modifié, ses empreintes sont recalculées sur cette copie
  // D-132 : gros scripts et feuille de style en fichiers séparés (code compilé gardé en cache, démarrage plus rapide)
  const parts = require(path.join(ROOT, 'scripts', 'split-html.js')).split(html);
  html = parts.html;
  for (const f of parts.files) {
    fs.mkdirSync(path.dirname(path.join(WWW, f.name)), { recursive: true });
    fs.writeFileSync(path.join(WWW, f.name), f.text);
  }
  html = require(path.join(ROOT, 'scripts', 'csp.js')).apply(html);
  fs.writeFileSync(path.join(WWW, 'index.html'), html);

  fs.copyFileSync(path.join(ROOT, 'manifest.webmanifest'), path.join(WWW, 'manifest.webmanifest'));
  fs.cpSync(path.join(ROOT, 'icons'), path.join(WWW, 'icons'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'fonts'), path.join(WWW, 'fonts'), { recursive: true });
  // Bibliothèque de connexion (D-84) : versionnée dans vendor/, chargée seulement si un projet en ligne est configuré
  fs.readdirSync(path.join(ROOT, 'vendor')).filter(f => /^supabase-js-[0-9.]+\.js$/.test(f)).forEach(f => fs.copyFileSync(path.join(ROOT, 'vendor', f), path.join(WWW, 'vendor', f)));
  fs.cpSync(path.join(ROOT, 'data'), path.join(WWW, 'data'), { recursive: true });
  // Cartes des univers (D-107) : vignettes des cartes de l'atlas
  fs.cpSync(path.join(ROOT, 'maps'), path.join(WWW, 'maps'), { recursive: true });
  // D-108 : cartes interactives de l'atlas (explorateur des cartes et ses données, sans les autres pages du site)
  fs.cpSync(path.join(ROOT, 'cartes'), path.join(WWW, 'cartes'), { recursive: true });
  const size = fs.readdirSync(WWW, { recursive: true }).length;
  console.log(`www/ prêt : ${size} fichiers, bibliothèques locales vérifiées (${VENDOR.length}).`);
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
