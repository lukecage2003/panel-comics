'use strict';
const test = require('node:test');
const assert = require('node:assert');
const I = require('./insights-core.js');

test('créateurs : une œuvre compte une fois, lus séparés, repli par titre', () => {
  const copies = [
    { id: 'a', series: 'Saga', issue: '#1' }, { id: 'b', series: 'Saga', issue: '#1' },
    { id: 'c', series: 'Saga', issue: '#2' }, { id: 'd', series: 'Uncanny X-Men', issue: '#141' }
  ];
  const credits = { a: { persons: [{ name: 'Brian K. Vaughan', role: 'writer' }, { name: 'Fiona Staples', role: 'artist, cover' }], characters: ['Alana'], teams: [] },
    c: { persons: [{ name: 'Brian K. Vaughan', role: 'writer' }], characters: ['Alana', 'Marko'], teams: [] } };
  const r = I.creatorInsights(copies, { creditsOf: c => credits[c.id] || null, isRead: c => c.id === 'b', characterOf: c => /x-men/i.test(c.series) ? 'X-Men' : null });
  assert.strictEqual(r.works, 3);
  assert.deepStrictEqual(r.writers.owned[0], { name: 'Brian K. Vaughan', n: 2, read: 1 });
  assert.strictEqual(r.artists.owned[0].name, 'Fiona Staples');
  assert.strictEqual(r.covers.owned[0].name, 'Fiona Staples');
  assert.strictEqual(r.characters.owned[0].name, 'Alana');
  assert.strictEqual(r.teams.owned[0].name, 'X-Men');
  assert.strictEqual(r.inferredTeams, 1);
  assert.strictEqual(r.writers.read.length, 1);
});

test('réponse Comic Vine réduite et nettoyée', () => {
  const c = I.creditsFromComicVine({ person_credits: [{ name: ' Jack Kirby ', role: 'penciler' }, { name: '' }], character_credits: [{ name: 'Thing' }], team_credits: null });
  assert.deepStrictEqual(c, { persons: [{ name: 'Jack Kirby', role: 'penciler' }], characters: ['Thing'], teams: [] });
  assert.strictEqual(I.creditsFromComicVine(null), null);
});

test('finances : couverture, seconde main, plus-values, mois et éditeurs', () => {
  const now = new Date(2026, 10, 14);
  const r = I.financeInsights([
    { paid: 3, cover: 4.99, value: 10, date: '2026-11-02', publisher: 'Marvel', series: 'A', issue: '#1', secondHand: true },
    { paid: 5, cover: 4.99, value: 4, date: '2026-10-10', publisher: 'Marvel', series: 'B', issue: '#1' },
    { paid: null, cover: 3.99, value: null, publisher: 'DC' }
  ], now);
  assert.strictEqual(r.count, 3);
  assert.strictEqual(r.unknownPaid, 1);
  assert.strictEqual(r.paid, 8);
  assert.ok(Math.abs(r.vsCover.saved - 1.98) < 1e-9);
  assert.strictEqual(r.secondHand.n, 1);
  assert.ok(Math.abs(r.secondHand.saved - 1.99) < 1e-9);
  assert.strictEqual(r.unrealized.gain, 6);
  assert.strictEqual(r.best[0].label, 'A #1');
  assert.strictEqual(r.worst[0].label, 'B #1');
  assert.strictEqual(r.months.length, 12);
  assert.strictEqual(r.months[11].spent, 3);
  assert.strictEqual(r.months[10].spent, 5);
  assert.strictEqual(r.publishers[0].name, 'Marvel');
  assert.strictEqual(I.teamOfSeries('Justice League of America'), 'Justice League');
});
