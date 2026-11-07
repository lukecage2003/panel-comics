// Prépare www/ pour l'APK à partir de la source unique ../index.html :
//  - bibliothèques (PDF.js, JSZip, zxing-wasm) embarquées localement → l'app fonctionne hors ligne ;
//  - empreintes SHA-256 vérifiées (vendor.lock.json) : un fichier modifié côté CDN bloque la construction ;
//  - pas de service worker (inutile dans l'app).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(__dirname, 'www');
const CACHE = path.join(__dirname, 'vendor-cache');
const LOCK = path.join(__dirname, 'vendor.lock.json');

const VENDOR = [
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', out: 'vendor/jszip.min.js' },
  { url: 'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/iife/reader/index.js', out: 'vendor/zxing/iife/reader/index.js' },
  { url: 'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/reader/zxing_reader.wasm', out: 'vendor/zxing/reader/zxing_reader.wasm' }
];

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

(async () => {
  const lock = fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) : {};
  fs.rmSync(WWW, { recursive: true, force: true });
  fs.mkdirSync(WWW, { recursive: true });

  for (const v of VENDOR) {
    const cached = path.join(CACHE, v.out);
    let buf = fs.existsSync(cached) ? fs.readFileSync(cached) : null;
    if (!buf) {
      const r = await fetch(v.url);
      if (!r.ok) throw new Error(`Téléchargement impossible : ${v.url} (HTTP ${r.status})`);
      buf = Buffer.from(await r.arrayBuffer());
      fs.mkdirSync(path.dirname(cached), { recursive: true });
      fs.writeFileSync(cached, buf);
    }
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
  swap('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'vendor/jszip.min.js');
  swap("'https://cdn.jsdelivr.net/npm/zxing-wasm@' + ZXING_VERSION + '/dist/iife/reader/index.js'", "'vendor/zxing/iife/reader/index.js'");
  swap("'https://cdn.jsdelivr.net/npm/zxing-wasm@' + ZXING_VERSION + '/dist/reader/'", "new URL('vendor/zxing/reader/', location.href).href");
  // Les balises <script> des bibliothèques ne doivent plus demander d'en-têtes CORS au CDN
  html = html.replace(/(<script src="vendor\/[^"]+")\s+integrity="[^"]*"/g, '$1').replace(/(<script src="vendor\/[^"]+")\s+crossorigin="[^"]*"/g, '$1');
  fs.writeFileSync(path.join(WWW, 'index.html'), html);

  fs.copyFileSync(path.join(ROOT, 'manifest.webmanifest'), path.join(WWW, 'manifest.webmanifest'));
  fs.cpSync(path.join(ROOT, 'icons'), path.join(WWW, 'icons'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'fonts'), path.join(WWW, 'fonts'), { recursive: true });
  const size = fs.readdirSync(WWW, { recursive: true }).length;
  console.log(`www/ prêt : ${size} fichiers, bibliothèques locales vérifiées (${VENDOR.length}).`);
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
