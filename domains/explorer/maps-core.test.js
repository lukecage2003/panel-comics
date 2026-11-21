'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./maps-core');

test('fichiers acceptés : images courantes, taille bornée, SVG refusé', () => {
  assert.ok(M.acceptFile({ type: 'image/jpeg', size: 1000 }).ok);
  assert.equal(M.acceptFile({ type: 'image/svg+xml', size: 1000 }).error, 'type');
  assert.equal(M.acceptFile({ type: 'image/png', size: 0 }).error, 'size');
  assert.equal(M.acceptFile({ type: 'image/png', size: M.MAX_BYTES + 1 }).error, 'size');
  assert.equal(M.acceptFile(null).error, 'missing');
});

test('métadonnées : titre tiré du fichier, champs nettoyés, source https seulement', () => {
  assert.equal(M.titleFromFile('carte_cosmos-marvel_v2.jpg'), 'Carte cosmos marvel v2');
  assert.equal(M.titleFromFile(''), 'Carte sans titre');
  const m = M.sanitizeMeta({ title: '  Terre-616  ', universe: 'Marvel', kind: 'inconnu', note: 'a\n\n\n\nb', source: 'http://pas-securise.test' });
  assert.deepEqual(m, { title: 'Terre-616', universe: 'Marvel', kind: 'other', note: 'a\n\nb', source: '' });
  assert.equal(M.sanitizeMeta({ source: 'https://ex.org/carte' }).source, 'https://ex.org/carte');
});

test('filtres, univers et comptes', () => {
  const L = [
    { title: 'Cosmos Marvel', universe: 'Marvel', kind: 'cosmic', note: '', createdAt: '2026-11-01' },
    { title: 'Gotham', universe: 'DC', kind: 'city', note: 'quartiers', createdAt: '2026-11-03' },
    { title: 'Multivers DC', universe: 'dc', kind: 'multiverse', note: '', createdAt: '2026-11-02' }
  ];
  assert.deepEqual(M.filter(L).map(m => m.title), ['Gotham', 'Multivers DC', 'Cosmos Marvel']);
  assert.deepEqual(M.filter(L, { kind: 'city' }).map(m => m.title), ['Gotham']);
  assert.deepEqual(M.filter(L, { universe: 'DC' }).map(m => m.title), ['Gotham', 'Multivers DC']);
  assert.deepEqual(M.filter(L, { q: 'quartier' }).map(m => m.title), ['Gotham']);
  assert.deepEqual(M.universes(L), ['dc', 'DC', 'Marvel']);
  assert.deepEqual(M.counts(L), { cosmic: 1, city: 1, multiverse: 1 });
});

test('visionneuse : ajustement, zoom autour du point, déplacement borné', () => {
  const f = M.fit(800, 600, 4000, 2000);
  assert.deepEqual(f, { w: 800, h: 400 });
  const s0 = M.initial(800, 600, f.w, f.h);
  assert.deepEqual(s0, { z: 1, x: 0, y: 100 });
  // Zoom ×2 au centre : le centre reste au centre
  const s1 = M.zoomAt(s0, 2, 400, 300, 800, 600, f.w, f.h);
  assert.equal(s1.z, 2);
  assert.equal(s1.x, -400);
  assert.equal(s1.y, -100);
  // Bornes : pas de vide sur les bords, zoom limité
  assert.deepEqual(M.clampPan({ z: 2, x: 500, y: 500 }, 800, 600, f.w, f.h), { z: 2, x: 0, y: 0 });
  assert.equal(M.zoomAt(s1, 100, 0, 0, 800, 600, f.w, f.h).z, M.ZMAX);
  assert.equal(M.zoomAt(s0, 0.1, 0, 0, 800, 600, f.w, f.h).z, M.ZMIN);
  assert.deepEqual(M.fit(0, 600, 10, 10), { w: 0, h: 0 });
});
