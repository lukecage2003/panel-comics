'use strict';
// D-114 : statistiques avancées Panel+ (calculées sur l'appareil, rien d'inventé)
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./stats-plus-core');

const C = [
  { series: 'Amazing Fantasy', issue: '15', publisher: 'Marvel', keyType: '1st appearance', condition: 'CGC 6.0', purchasePrice: '1000', estValue: '1500', purchaseDate: '2026-10-03' },
  { series: 'Absolute Batman', issue: '1', publisher: 'DC', variant: 'Jim Lee', condition: 'NM', purchasePrice: '10', estValue: '40', purchaseDate: '2026-09-12' },
  { series: 'Saga', issue: '1', publisher: 'Image', condition: 'VF', purchasePrice: '5', estValue: '', purchaseDate: '2025-06-01' },
  { series: 'Daredevil', issue: '181', publisher: 'Marvel', condition: 'VF', purchasePrice: '50', estValue: '45', addedAt: '2024-01-15' }
];
const NOW = new Date(2026, 10, 22);

test('concentration et rendement par éditeur : seuls les exemplaires cotés comptent', () => {
  const c = S.concentration(C);
  assert.equal(c.n, 3); assert.equal(c.total, 1585); assert.equal(c.top10Pct, 100);
  assert.equal(c.topPublisher.name, 'Marvel'); assert.ok(c.hhi > 0.9 && c.hhi <= 1);
  const r = S.roiByPublisher(C);
  assert.deepEqual(r.map(p => p.name), ['DC', 'Marvel']);
  assert.equal(r[0].roi, 300); assert.equal(r[1].gain, 495);
  assert.equal(S.advanced(C, NOW).unvalued, 1);
});

test('Key Issues, gradés, variantes, rythme et détention', () => {
  const k = S.keys(C); assert.equal(k.n, 1); assert.equal(k.sharePct, 25); assert.equal(k.roi, 50);
  const g = S.grading(C); assert.equal(g.graded, 1); assert.equal(g.variants, 1); assert.equal(g.avgGraded, 1500);
  const p = S.pace(C, NOW); assert.equal(p.total, 2); assert.equal(p.previous, 1); assert.equal(p.trendPct, 100); assert.equal(p.months.length, 12);
  const h = S.hold(C, NOW); assert.equal(h.n, 4); assert.equal(h.oldest[0].label, 'Daredevil #181');
});

test('accès : statistiques de base gratuites, analyses avancées réservées à Panel+', () => {
  assert.equal(S.gate(false, 'concentration'), false);
  assert.equal(S.gate(true, 'concentration'), true);
  assert.equal(S.gate(false, 'decades'), true);
  assert.equal(S.PLUS.length, 6);
  assert.deepEqual(S.concentration([]), { n: 0, total: 0, top10Pct: null, hhi: null, topPublisher: null, top: [] });
});
