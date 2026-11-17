'use strict';
// Stabilisation G : fichiers de l'application compressés et revalidés par serve.js (aucun réseau externe, port éphémère).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const server = require('../serve.js');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'));
let port;
test.before(() => new Promise(r => server.listen(0, '127.0.0.1', () => { port = server.address().port; r(); })));
test.after(() => new Promise(r => server.close(r)));

const get = (p, headers = {}) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: p, headers: Object.assign({ Host: 'localhost:' + port }, headers) }, res => {
    const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
  }).on('error', reject);
});

test('brotli quand le navigateur l\'accepte : contenu identique, au moins 4 fois plus léger', async () => {
  const r = await get('/', { 'Accept-Encoding': 'gzip, deflate, br' });
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-encoding'], 'br');
  assert.equal(r.headers.vary, 'Accept-Encoding');
  assert.ok(r.body.length * 4 < index.length, r.body.length + ' octets');
  assert.ok(zlib.brotliDecompressSync(r.body).equals(index));
  assert.equal(r.headers['cache-control'], 'no-cache');
  assert.ok(r.headers['content-security-policy'] || r.headers['x-content-type-options'], 'en-têtes de sécurité conservés');
});

test('gzip en repli, rien sans Accept-Encoding', async () => {
  const g = await get('/', { 'Accept-Encoding': 'gzip' });
  assert.equal(g.headers['content-encoding'], 'gzip');
  assert.ok(zlib.gunzipSync(g.body).equals(index));
  const n = await get('/');
  assert.equal(n.headers['content-encoding'], undefined);
  assert.ok(n.body.equals(index));
});

test('revalidation : même ETag → 304 sans corps', async () => {
  const a = await get('/', { 'Accept-Encoding': 'br' });
  assert.match(a.headers.etag, /^W\/"\d+-\d+"$/);
  const b = await get('/', { 'Accept-Encoding': 'br', 'If-None-Match': a.headers.etag });
  assert.equal(b.status, 304);
  assert.equal(b.body.length, 0);
  const c = await get('/', { 'If-None-Match': 'W/"0-0"' });
  assert.equal(c.status, 200);
});

test('images et polices non recompressées ; chemins non autorisés toujours refusés', async () => {
  const icons = fs.readdirSync(path.join(__dirname, '..', 'icons')).filter(f => /^[a-z0-9-]+\.png$/.test(f));
  if (icons.length) { const i = await get('/icons/' + icons[0], { 'Accept-Encoding': 'br' }); assert.equal(i.status, 200); assert.equal(i.headers['content-encoding'], undefined); }
  assert.equal((await get('/serve.js', { 'Accept-Encoding': 'br' })).status, 404);
  assert.equal((await get('/.secrets/metron.json')).status, 404);
});
