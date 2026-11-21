'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('./maps-core');
const ROOT = path.join(__dirname, '..', '..');
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas-maps.json'), 'utf8'));

test('catalogue livré : 18 cartes Marvel et DC, valides, images présentes, classées', () => {
  const L = M.validate(RAW);
  assert.equal(L.length, 18);
  assert.equal(M.counts(L).marvel, 9);
  assert.equal(M.counts(L).dc, 9);
  assert.deepEqual(L.map(m => m.key).slice(0, 2), ['marvel-01', 'marvel-02']);
  assert.equal(L[9].key, 'dc-01');
  for (const m of L) {
    assert.ok(M.THEMES[m.theme] && m.title && m.sub && /[.…]$/.test(m.about), m.key);
    assert.ok(fs.existsSync(path.join(ROOT, m.img)) && fs.existsSync(path.join(ROOT, m.thumb)), m.key);
    assert.ok(m.names.length >= 8 && Math.max(m.w, m.h) === 5200, m.key);
  }
  Object.keys(M.THEMES).forEach(t => assert.ok(M.counts(L)[t] >= 1, t));
});

test('précision : aucune carte présentée comme officielle, la Qlippoth reste une théorie', () => {
  const L = M.validate(RAW), by = k => L.find(m => m.key === k);
  assert.equal(by('dc-01').basis.type, 'publications');
  assert.match(by('dc-01').about, /d'après la structure/);
  assert.ok(!/officiel/i.test(L.map(m => m.about).join(' ')));
  assert.equal(by('marvel-02').rel.t, 13);
  assert.equal(by('marvel-03').basis.type, 'plan');
  assert.ok(M.relSummary(by('marvel-02')).some(([c, n]) => c === 't' && n === 13));
  assert.equal(M.relLabel('t', 13), '13 théories');
  assert.equal(M.relLabel('d', 1), '1 interprétation');
  assert.equal(M.relLabel('u', 8), '8 à vérifier');
});

test('validation : clés, univers et thèmes contrôlés, chemins déduits de la clé', () => {
  const L = M.validate({ maps: [
    { key: 'marvel-01', uni: 'marvel', theme: 'cosmology', title: 'A', w: 10, h: 10, img: 'https://pirate.test/x.png' },
    { key: 'marvel-01', uni: 'marvel', theme: 'cosmology', title: 'Doublon', w: 10, h: 10 },
    { key: '../etc', uni: 'marvel', theme: 'cosmology', title: 'B', w: 10, h: 10 },
    { key: 'dc-02', uni: 'marvel', theme: 'cosmology', title: 'C', w: 10, h: 10 },
    { key: 'dc-03', uni: 'dc', theme: 'inconnu', title: 'D', w: 10, h: 10 },
    { key: 'dc-04', uni: 'dc', theme: 'powers', title: 'E', w: 0, h: 10 }
  ] });
  assert.deepEqual(L.map(m => m.key), ['marvel-01']);
  assert.equal(L[0].img, 'maps/marvel-01.webp');
  assert.deepEqual(M.validate(null), []);
});

test('recherche : titres, entités en anglais ou en français, filtres combinés', () => {
  const L = M.validate(RAW);
  assert.equal(M.filter(L, { q: 'endless' })[0].key, 'dc-04');
  assert.ok(M.hits(L.find(m => m.key === 'dc-04'), 'dream').includes('Dream of the Endless'));
  assert.deepEqual(M.filter(L, { uni: 'dc', theme: 'timeline' }).map(m => m.key), ['dc-07']);
  assert.ok(M.filter(L, { q: 'Galactus' }).length >= 1);
  assert.deepEqual(M.filter(L, { q: 'zzzz introuvable' }), []);
  assert.ok(M.ofEntity(L, 'The Presence').some(m => m.uni === 'dc'));
  assert.deepEqual(M.ofEntity(L, 'ab'), []);
});

test('visionneuse : ajustement, zoom autour du point, déplacement borné', () => {
  const f = M.fit(800, 600, 4000, 2000);
  assert.deepEqual(f, { w: 800, h: 400 });
  const s0 = M.initial(800, 600, f.w, f.h);
  assert.deepEqual(s0, { z: 1, x: 0, y: 100 });
  const s1 = M.zoomAt(s0, 2, 400, 300, 800, 600, f.w, f.h);
  assert.equal(s1.z, 2);
  assert.equal(s1.x, -400);
  assert.equal(s1.y, -100);
  assert.deepEqual(M.clampPan({ z: 2, x: 500, y: 500 }, 800, 600, f.w, f.h), { z: 2, x: 0, y: 0 });
  assert.equal(M.zoomAt(s1, 100, 0, 0, 800, 600, f.w, f.h).z, M.ZMAX);
  assert.equal(M.zoomAt(s0, 0.1, 0, 0, 800, 600, f.w, f.h).z, M.ZMIN);
  assert.deepEqual(M.fit(0, 600, 10, 10), { w: 0, h: 0 });
});
