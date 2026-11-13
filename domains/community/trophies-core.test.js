'use strict';
const test = require('node:test');
const assert = require('node:assert');
const T = require('./trophies-core.js');

const copy = (series, issue, extra = {}) => Object.assign({ series, issue, publisher: 'Marvel', coverYear: 2024 }, extra);

test('collection vide : aucun trophée obtenu, niveau 1', () => {
  const r = T.computeTrophies({});
  assert.strictEqual(r.unlocked, 0);
  assert.strictEqual(r.level, 1);
  assert.strictEqual(r.xp, 0);
  assert.ok(r.trophies.every(t => t.tier === null));
});

test('paliers Bronze à Vibranium et progression vers le suivant', () => {
  const copies = Array.from({ length: 12 }, (_, i) => copy('Venom', '#' + (i + 1)));
  const r = T.computeTrophies({ copies });
  const col = r.trophies.find(t => t.id === 'collector');
  assert.deepStrictEqual([col.tier, col.value, col.next], ['bronze', 12, 100]);
  assert.ok(col.progress > 0 && col.progress < 1);
  assert.strictEqual(r.trophies.find(t => t.id === 'runner').tier, 'bronze', 'Venom #1 à #12 sans trou');
  assert.strictEqual(r.trophies.find(t => t.id === 'firsts').value, 1);
  assert.strictEqual(T.tierFor(2000, [10, 100, 500, 2000]), 3);
});

test('runs complets : un trou casse le run', () => {
  assert.strictEqual(T.completeRuns([copy('A', '#1'), copy('A', '#2'), copy('A', '#3')]), 1);
  assert.strictEqual(T.completeRuns([copy('A', '#1'), copy('A', '#2'), copy('A', '#4')]), 0);
});

test('ères, voyageur temporel et gardiens par personnage', () => {
  const copies = [copy('X', '#1', { coverYear: 1950 }), copy('X', '#2', { coverYear: 1963 }), copy('X', '#3', { coverYear: 1975 }), copy('X', '#4', { coverYear: 2020 })]
    .concat(Array.from({ length: 5 }, (_, i) => copy('Batman', '#' + i, { publisher: 'DC Comics' })));
  const r = T.computeTrophies({ copies, characterOf: c => /batman/i.test(c.series) ? 'Batman' : null });
  assert.strictEqual(r.trophies.find(t => t.id === 'era-golden').tier, 'bronze');
  const tt = r.trophies.find(t => t.id === 'time-traveler');
  assert.strictEqual(tt.tier, 'gold', 'quatre ères mais pas 10 numéros dans chacune : pas encore Vibranium');
  const g = r.trophies.find(t => t.id === 'guardian-batman');
  assert.ok(g && g.tier === 'bronze' && g.name === 'Gardien · Batman');
  assert.ok(r.xp > 0 && r.level >= 1);
});

test('lecture, pull list, rangement et gradés', () => {
  const r = T.computeTrophies({
    copies: [copy('A', '#1', { box: 'Short 1', condition: 'CGC 9.8', keyType: 'major' })],
    log: [{ event: 'finished' }, { event: 'reread' }, { event: 'started' }], picked: 3
  });
  const v = id => r.trophies.find(t => t.id === id);
  assert.deepStrictEqual([v('reader').value, v('rereader').value, v('wednesday').value, v('archivist').value, v('slabs').value, v('keys').value], [1, 1, 3, 1, 1, 1]);
  assert.strictEqual(v('wednesday').tier, 'bronze');
});

test('profil local : nettoyage et pseudo valide', () => {
  const p = T.sanitizeProfile({ handle: 'Tadeo comics', displayName: '<b>Moi</b>', color: 'red', bio: 'x'.repeat(300) });
  assert.strictEqual(p.handle, 'Tadeo_comics');
  assert.strictEqual(p.displayName, 'bMoi/b');
  assert.strictEqual(p.color, '#7C5CFF');
  assert.strictEqual(p.bio.length, 160);
  assert.ok(T.validHandle('Tadeo_comics'));
  assert.ok(!T.validHandle('ab'));
  assert.ok(!T.validHandle('a<script>'));
  assert.strictEqual(T.titleFor(1), 'Nouvelle recrue');
});
