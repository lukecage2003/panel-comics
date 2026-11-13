'use strict';
const test = require('node:test');
const assert = require('node:assert');
const R = require('./reading-stats.js');

const log = [
  { workKey: 'a', event: 'finished', at: '2026-11-02T10:00:00Z' },
  { workKey: 'b', event: 'finished', at: '2026-10-15T10:00:00Z' },
  { workKey: 'a', event: 'reread', at: '2026-11-10T10:00:00Z' },
  { workKey: 'c', event: 'started', at: '2026-11-11T10:00:00Z' },
  { workKey: 'd', event: 'finished', at: '2025-06-01T10:00:00Z' },
  { workKey: 'e', event: 'finished', at: '2024-01-01T10:00:00Z' },
  null, { event: 'finished' }
];

test('12 mois glissants, relectures comptées par défaut', () => {
  const s = R.readingStats(log, '2026-11-13T12:00:00Z');
  assert.strictEqual(s.months.length, 12);
  assert.strictEqual(s.months[0].month, '2025-12');
  assert.strictEqual(s.months[11].month, '2026-11');
  assert.strictEqual(s.months[11].n, 2);
  assert.strictEqual(s.months[10].n, 1);
  assert.strictEqual(s.months.reduce((a, m) => a + m.n, 0), 3, 'juin 2025 et 2024 hors fenêtre');
});

test('totaux de l\'année : premières lectures et relectures séparées', () => {
  const s = R.readingStats(log, '2026-11-13T12:00:00Z');
  assert.deepStrictEqual([s.year, s.yearFirst, s.yearRereads, s.yearWorks], [2026, 2, 1, 2]);
  const s2 = R.readingStats(log, '2026-11-13T12:00:00Z', { countRereads: false });
  assert.strictEqual(s2.months[11].n, 1);
});

test('objectif annuel', () => {
  const s = R.readingStats(log, '2026-11-13T12:00:00Z');
  assert.deepStrictEqual(R.goalProgress(s, 4), { goal: 4, done: 2, pct: 50 });
  assert.strictEqual(R.goalProgress(s, 0), null);
  assert.strictEqual(R.goalProgress(s, 'x'), null);
  assert.strictEqual(R.goalProgress(R.readingStats(log, '2026-11-13T12:00:00Z'), 1).pct, 100);
});

test('mois au passage d\'année', () => {
  assert.deepStrictEqual(R.lastMonths('2026-01-31T23:00:00Z', 3), ['2025-11', '2025-12', '2026-01']);
});
