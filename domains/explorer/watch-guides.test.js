'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('./watch-guides');

test('chaque dossier a un titre, une date ISO, des films et des comics avec une recherche', () => {
  for (const g of W.GUIDES) {
    assert.match(g.release, /^\d{4}-\d{2}-\d{2}$/, g.id);
    assert.ok(g.watch.length && g.read.length, g.id);
    for (const r of g.read) assert.ok(r.q && r.t && r.y, g.id + ' ' + r.t);
    assert.ok(new Set(W.GUIDES.map(x => x.id)).size === W.GUIDES.length);
  }
});

test('pick : l\'actualité met un dossier en tête, puis la sortie la plus proche', () => {
  const now = '2026-11-14T12:00:00Z';
  const none = W.pick([], now);
  assert.equal(none[0].guide.id, 'avengers-doomsday');
  const arts = [{ title: 'The Batman Part II : premières images du tournage' }];
  const r = W.pick(arts, now);
  assert.equal(r[0].guide.id, 'the-batman-2'); assert.equal(r[0].articles.length, 1);
  assert.ok(r.length <= 3);
  // un film sorti depuis longtemps n'est plus proposé
  assert.ok(!W.pick([], '2028-06-01T00:00:00Z').some(x => x.guide.id === 'avengers-doomsday'));
});
