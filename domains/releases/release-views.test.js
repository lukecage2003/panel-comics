'use strict';
const test = require('node:test');
const assert = require('node:assert');
const V = require('./release-views.js');

const pub = (series, issue, date, extra = {}) => Object.assign({ series, issue, publisher: 'Image', market: 'US', format: 'single', dates: { current: date } }, extra);
const today = '2026-11-13';

test('nouveaux #1 : futur, sans numéro antérieur connu', () => {
  const a1 = pub('Nouvelle Série', '1', '2026-11-25');
  const b1 = pub('Relance', '1', '2026-12-02');
  const b0 = pub('Relance', '5', '2026-10-01');
  const old = pub('Ancienne', '1', '2026-10-01');
  const c2 = pub('Nouvelle Série', '2', '2026-12-23');
  const all = [a1, b1, b0, old, c2];
  assert.deepStrictEqual(V.upcomingFirsts(all, all, today), [a1, b1].filter(p => V.isUpcomingFirst(p, all, today)));
  assert.ok(V.isUpcomingFirst(a1, all, today));
  assert.ok(!V.isUpcomingFirst(old, all, today), 'déjà sorti');
  assert.ok(!V.isUpcomingFirst(c2, all, today), 'pas un #1');
  assert.ok(!V.isUpcomingFirst(pub('Annulé', '1', '2026-12-01', { cancelled: true }), all, today));
});

test('un #1 précédé d\'un #0 antérieur de la même série n\'est pas un lancement', () => {
  const z = pub('Zéro', '0', '2026-11-20'), one = pub('Zéro', '1', '2026-12-10');
  assert.ok(V.isUpcomingFirst(z, [z, one], today));
  assert.ok(!V.isUpcomingFirst(one, [z, one], today));
});

test('variantes regroupées sous la couverture principale', () => {
  const a = pub('X', '1', '2026-11-25', { variant: 'Cover B' });
  const b = pub('X', '1', '2026-11-25', { variant: 'Cover A' });
  const c = pub('X', '1', '2026-11-25', { variant: '1:25 Incentive' });
  const d = pub('X', '2', '2026-12-25');
  const g = V.groupVariants([a, b, c, d]);
  assert.strictEqual(g.length, 2);
  assert.strictEqual(g[0].main, b);
  assert.deepStrictEqual(g[0].variants, [a, c]);
  assert.deepStrictEqual(g[1], { main: d, variants: [] });
});

test('rappel local : sorties suivies des 7 prochains jours, une fois par jour', () => {
  const a = pub('A', '3', '2026-11-18', { id: 'a' }), b = pub('B', '#1', '2026-11-13', { id: 'b' });
  const far = pub('C', '1', '2026-12-30', { id: 'c' }), past = pub('D', '1', '2026-11-01', { id: 'd' }), x = pub('E', '2', '2026-11-15', { id: 'e', cancelled: true });
  const r = V.reminderDigest([a, b, far, past, x], today, null);
  assert.deepStrictEqual(r.ids, ['b', 'a']);
  assert.strictEqual(r.body, 'B #1, A #3');
  assert.strictEqual(V.reminderDigest([a], today, today), null, 'déjà rappelé aujourd\'hui');
  assert.strictEqual(V.reminderDigest([far], today, null), null);
  assert.strictEqual(V.addDays('2026-12-28', 7), '2027-01-04');
});

test('FOC affichée seulement si connue', () => {
  assert.strictEqual(V.focOf(pub('X', '1', '2026-11-25')), null);
  assert.strictEqual(V.focOf(pub('X', '1', '2026-11-25', { focDate: '2026-10-27' })), '2026-10-27');
  assert.strictEqual(V.focOf({ dates: { foc: '2026-10-20T00:00:00Z' } }), '2026-10-20');
  assert.strictEqual(V.focOf({ focDate: 'bientôt' }), null);
});
