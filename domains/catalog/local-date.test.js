'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./local-date');

// Fuseau imposé pour chaque cas, puis rétabli (Node relit TZ à chaque changement)
const inTz = (tz, fn) => { const prev = process.env.TZ; process.env.TZ = tz; try { fn(); } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; } };

test('Paris, 0 h 30 : le jour local est le lendemain de la date UTC (cas du bogue F1)', () => inTz('Europe/Paris', () => {
  const t = new Date('2026-11-16T23:30:00Z');
  assert.equal(t.toISOString().slice(0, 10), '2026-11-16');
  assert.equal(D.localDay(t), '2026-11-17');
}));

test('Paris, été (UTC+2), 1 h 30 : jour local correct', () => inTz('Europe/Paris', () => {
  assert.equal(D.localDay(new Date('2026-07-14T23:30:00Z')), '2026-07-15');
}));

test('Montréal, 22 h : le jour local est la veille de la date UTC', () => inTz('America/Toronto', () => {
  assert.equal(D.localDay(new Date('2026-11-17T03:00:00Z')), '2026-11-16');
}));

test('mois local au premier du mois après minuit, et 12 mois glissants', () => inTz('Europe/Paris', () => {
  const t = new Date('2026-11-30T23:30:00Z'); // 1er décembre, 0 h 30 à Paris
  assert.equal(t.toISOString().slice(0, 7), '2026-11');
  assert.equal(D.localMonth(t), '2026-12');
  const m = D.localMonthsBack(t, 12);
  assert.equal(m.length, 12);
  assert.equal(m[0], '2026-01');
  assert.equal(m[11], '2026-12');
  assert.deepEqual(D.localMonthsBack(new Date(2026, 2, 31, 0, 30), 3), ['2026-01', '2026-02', '2026-03']); // 31 mars : pas de saut de février
}));

test('sans argument : aujourd\'hui, au format AAAA-MM-JJ', () => {
  assert.match(D.localDay(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(D.localDay('2026-05-04T10:00:00'), '2026-05-04');
});

test('garde-fou : aucune date « du jour » UTC dans index.html', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'index.html'), 'utf8');
  assert.equal(html.split('new Date().toISOString().slice(0, 10)').length - 1, 0, 'utiliser todayLocal() ou localDate.localDay()');
  assert.equal(html.split('new Date().toISOString().slice(0, 7)').length - 1, 0, 'utiliser localDate.localMonth()');
});
