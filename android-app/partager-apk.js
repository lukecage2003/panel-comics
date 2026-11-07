// Met Panel-<version>.apk à disposition sur le Wi-Fi local, le temps de l'installer sur le téléphone.
//   node partager-apk.js     → ouvrir l'adresse affichée dans Chrome sur le téléphone (même Wi-Fi)
// Seul le fichier APK est servi ; le serveur s'arrête seul après 15 minutes (ou Ctrl+C).
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const apk = fs.readdirSync(__dirname).filter(f => /^Panel-.*\.apk$/.test(f)).sort().pop();
if (!apk) { console.error('Aucun APK : lancez d\'abord « npm run apk ».'); process.exit(1); }
const file = path.join(__dirname, apk);
const port = 8160;
const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);

http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panel</title>
<body style="font-family:sans-serif;background:#0a0d08;color:#f5f7f2;padding:24px;text-align:center">
<h1>Panel pour Android</h1><p><a href="/${apk}" style="display:inline-block;background:#d4ff59;color:#0a0d08;padding:16px 24px;border-radius:12px;font-weight:700;text-decoration:none">Télécharger ${apk}</a></p>
<p style="color:#aab4a2;font-size:14px">Puis ouvrez le fichier depuis la notification de téléchargement ou l'app « Mes fichiers ».</p></body>`);
  }
  if (p !== '/' + apk) { res.writeHead(404); return res.end(); }
  console.log('Téléchargement demandé par ' + req.socket.remoteAddress);
  res.writeHead(200, { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': fs.statSync(file).size, 'Content-Disposition': `attachment; filename="${apk}"` });
  fs.createReadStream(file).pipe(res);
}).listen(port, '0.0.0.0', () => {
  console.log('Sur le téléphone (même Wi-Fi), ouvrez dans Chrome :');
  ips.forEach(ip => console.log(`   http://${ip}:${port}`));
  console.log('Arrêt automatique dans 15 minutes (Ctrl+C pour arrêter avant).');
});
setTimeout(() => { console.log('Arrêt du partage.'); process.exit(0); }, 15 * 60000);
