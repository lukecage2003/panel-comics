'use strict';
const test = require('node:test');
const assert = require('node:assert');
const R = require('./ranks-core.js');

test('échelle longue, croissante, du Civil à The One Above All', () => {
  assert.ok(R.RANKS.length >= 70);
  assert.strictEqual(R.RANKS[0].name, 'Civil');
  assert.strictEqual(R.RANKS[0].xp, 0);
  assert.strictEqual(R.RANKS[R.RANKS.length - 1].name, 'The One Above All');
  for (let i = 1; i < R.RANKS.length; i++) assert.ok(R.RANKS[i].xp > R.RANKS[i - 1].xp, 'seuil croissant au rang ' + (i + 1));
  assert.ok(R.RANKS[R.RANKS.length - 1].xp > 200000);
  const firstCosmic = R.RANKS.findIndex(r => r.cosmic);
  assert.ok(firstCosmic >= 15 && R.RANKS.slice(0, firstCosmic).every(r => r.tier === 'terre'));
  assert.strictEqual(R.RANKS[firstCosmic].tier, 'multivers_dc');
  assert.ok(R.RANKS.some(r => r.universe === 'dc' && !r.cosmic) && R.RANKS.some(r => r.universe === 'marvel' && !r.cosmic));
  assert.ok(R.RANKS.length >= 90);
  assert.deepStrictEqual([...new Set(R.RANKS.map(r => r.tier))], R.TIER_IDS);
});

test('points : barème appliqué, activité sociale ignorée sans compte', () => {
  const a = { owned: 10, read: 5, reviewed: 1, runs: 1, followers: 100, reactions: 50 };
  const off = R.computeRank(a);
  assert.strictEqual(off.xp, 10 * 5 + 5 * 8 + 15 + 60);
  assert.ok(off.breakdown.find(b => b.id === 'followers').pending);
  const on = R.computeRank(a, { online: true });
  assert.strictEqual(on.xp, off.xp + 100 * 10 + 50 * 2);
  assert.ok(on.rank.rank > off.rank.rank);
});

test('D-71 : runs lus, longs runs, découvertes et semaines de lecture rapportent des points', () => {
  const r = R.computeRank({ runsRead: 1, longRuns: 1, firsts: 2, graded: 1, publishers: 1, characters: 2, eras: 1, readWeeks: 1 });
  assert.strictEqual(r.xp, 90 + 120 + 12 + 12 + 10 + 40 + 12); // D-78 : la gradation ne rapporte plus de points
  assert.ok(!r.breakdown.some(b => b.id === 'graded'));
  assert.ok(r.breakdown.some(b => b.id === 'runsRead' && b.label === 'Run complet lu en entier'));
});

test('progression vers le rang suivant et valeurs invalides', () => {
  const z = R.computeRank({ owned: -4, read: 'x' });
  assert.strictEqual(z.xp, 0);
  assert.strictEqual(z.rank.name, 'Civil');
  assert.strictEqual(z.toNext, R.RANKS[1].xp);
  const top = R.computeRank({ trophyXp: 1e9 });
  assert.strictEqual(top.rank.name, 'The One Above All');
  assert.strictEqual(top.next, null);
  assert.strictEqual(top.progress, 1);
});
