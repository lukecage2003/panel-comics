'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('./stats-core.js');

const copies = [
  { coverYear: 1984, purchaseDate: '2024-03-02' },
  { coverYear: '1987', purchaseDate: '2024-11-20' },
  { coverDate: '2024-10-09', addedAt: '2025-01-05T10:00:00Z' },
  { releaseDate: '2025-02-12', purchaseDate: '2025-02-12' },
  { coverYear: 'inconnu' },
  { coverYear: 2099, purchaseDate: 'pas une date' }
];

test('répartition par décennie, dates inconnues à part', () => {
  const r = S.byDecade(copies);
  assert.deepStrictEqual(r.rows.map(x => [x.label, x.n]), [['1980s', 2], ['2020s', 2], ['2090s', 1]]);
  assert.strictEqual(r.unknown, 1);
  assert.strictEqual(r.rows.reduce((a, x) => a + x.n, 0) + r.unknown, r.total);
});

test('acquisitions par année : date d\'achat, sinon date d\'ajout signalée approximative', () => {
  const r = S.acquisitionsByYear(copies);
  assert.deepStrictEqual(r.rows, [{ year: 2024, n: 2, approx: 0 }, { year: 2025, n: 2, approx: 1 }]);
  assert.strictEqual(r.unknown, 2);
});

test('années invalides ignorées, entrées vides acceptées', () => {
  assert.strictEqual(S.yearOf('1850'), null);
  assert.strictEqual(S.yearOf(''), null);
  assert.strictEqual(S.yearOf(null), null);
  assert.deepStrictEqual(S.byDecade(null), { rows: [], unknown: 0, total: 0 });
  assert.deepStrictEqual(S.acquisitionsByYear([]), { rows: [], unknown: 0, total: 0 });
});
