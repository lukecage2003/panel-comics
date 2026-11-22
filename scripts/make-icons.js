#!/usr/bin/env node
// D-121 : icônes de Panel générées depuis icons/panel-mark.svg (source unique du logo).
// Edge sans interface dessine le SVG dans un canvas (transparence gardée) via son protocole de débogage.
// Usage : node scripts/make-icons.js   (puis, pour l'application Android : powershell -File android-app/make-icons.ps1)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
if (!EDGE) { console.error('make-icons : Microsoft Edge introuvable.'); process.exit(1); }
const mark = fs.readFileSync(path.join(ROOT, 'icons', 'panel-mark.svg'), 'utf8');
const full = mark.replace(/ rx="116"/, ''); // carré plein : maskable, Apple, Android adaptatif
const OUT = [['icon-512.png', 512, mark], ['icon-192.png', 192, mark], ['favicon-32.png', 32, mark], ['icon-maskable-512.png', 512, full], ['apple-touch-icon.png', 180, full]];
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-icons-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
  try {
    let port = 0;
    for (let i = 0; i < 100 && !port; i++) { await wait(100); try { port = +fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (_) {} }
    if (!port) throw new Error('Edge ne répond pas');
    const page = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
    for (const [name, size, svg] of OUT) {
      const expr = `(async () => { const img = new Image(); img.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(Buffer.from(svg).toString('base64'))};
        await img.decode(); const c = document.createElement('canvas'); c.width = c.height = ${size};
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, ${size}, ${size}); return c.toDataURL('image/png'); })()`;
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      const url = r.result && r.result.result && r.result.result.value;
      if (!url) throw new Error('rendu impossible pour ' + name);
      fs.writeFileSync(path.join(ROOT, 'icons', name), Buffer.from(url.split(',')[1], 'base64'));
      console.log('make-icons : ' + name + ' (' + size + ' px)');
    }
    ws.close();
  } finally {
    edge.kill();
    await wait(500);
    try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }); } catch (_) { /* profil encore verrouillé : laissé au système */ }
  }
})().catch(e => { console.error('make-icons : ' + e.message); process.exit(1); });
