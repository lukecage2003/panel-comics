'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rituals-core');

const copy = (id, series, issue, variant, o = {}) => Object.assign({ id, series, issue, variant, publisher: 'Fictif', coverUrl: 'https://img.example/' + id + '.jpg',
  purchasePrice: 9, value: 50, location: 'Boîte 7', notes: 'note-secrete-xyz', condition: 'NM' }, o);

test('mercredi de la semaine (lundi à dimanche)', () => {
  assert.equal(R.wednesdayOf('2026-11-16'), '2026-11-18'); // lundi
  assert.equal(R.wednesdayOf('2026-11-18'), '2026-11-18'); // mercredi
  assert.equal(R.wednesdayOf('2026-11-22'), '2026-11-18'); // dimanche
  assert.equal(R.wednesdayOf('2026-11-23'), '2026-11-25');
  assert.equal(R.wednesdayOf('pas une date'), '');
});

test('semaine des sorties : pull list d\'abord, annulées et autres semaines écartées, doublons fusionnés', () => {
  const items = [
    { id: 'a', series: 'Saga', issue: '2', day: '2026-11-18', pulled: true },
    { id: 'a2', series: 'Saga', issue: '#2', day: '2026-11-18', pulled: true },
    { id: 'b', series: 'Autre', issue: '1', day: '2026-11-19', pulled: false },
    { id: 'c', series: 'Annulé', issue: '1', day: '2026-11-18', pulled: true, status: 'cancelled' },
    { id: 'd', series: 'Plus tard', issue: '1', day: '2026-11-25', pulled: true }
  ];
  const w = R.releaseWeek({ items, today: '2026-11-17' });
  assert.equal(w.wednesday, '2026-11-18');
  assert.equal(w.isWednesday, false);
  assert.deepEqual(w.pulled.map(x => x.id), ['a']);
  assert.deepEqual(w.others.map(x => x.id), ['b']);
  assert.deepEqual(R.wednesdayTopics(w), ['Saga #2']);
  assert.equal(R.releaseWeek({ items, today: '2026-11-18' }).isWednesday, true);
});

test('duel : deux variantes avec couverture du même numéro, jamais de champ financier', () => {
  const d = R.duelCandidates([copy('a', 'Saga', '#1', 'Cover A'), copy('b', 'Saga', '1', 'Cover B'), copy('c', 'Seul', '#1', 'Cover A'), copy('d', 'Saga', '#1', 'Cover C', { coverUrl: '' })]);
  assert.equal(d.length, 1);
  assert.deepEqual(d[0].options.map(x => x.id), ['a', 'b']);
  assert.equal(R.duelText(d[0].options[0], d[0].options[1]), 'Duel de couvertures : Saga #1. Cover A ou Cover B ?');
  const l = JSON.stringify(R.light(d[0].options[0]));
  ['purchasePrice', 'value', 'Boîte 7', 'note-secrete-xyz', 'NM'].forEach(k => assert.equal(l.includes(k), false, k));
});

test('vote : un seul par duel, change de côté, se retire', () => {
  let r = R.vote(null, 'cd_1', 0, Date.parse('2026-11-20T10:00:00Z'));
  assert.equal(r.side, 0);
  assert.equal(R.myVote(r.state, 'cd_1'), 0);
  r = R.vote(r.state, 'cd_1', 1);
  assert.equal(R.myVote(r.state, 'cd_1'), 1);
  assert.equal(Object.keys(r.state.votes).length, 1);
  r = R.vote(r.state, 'cd_1', 1);
  assert.equal(R.myVote(r.state, 'cd_1'), null);
  assert.equal(R.vote(null, 'mauvais id !', 0).error, 'invalid');
  assert.equal(R.vote(null, 'cd_1', 2).error, 'invalid');
  assert.deepEqual(R.sanitizeVotes({ votes: { cd_2: { side: 5, at: 'x' } } }).votes, {});
});

test('chasse : variante voulue, prix visé jamais publié, trouvée quand un exemplaire correspond', () => {
  const w = copy('w', 'Saga', '#3', 'Cover A', { isWishlist: true, wish: { variantWanted: 'Virgin', targetPrice: 80, priority: 'high' } });
  const it = R.huntItem(w);
  assert.equal(it.variant, 'Virgin');
  assert.equal(JSON.stringify(it).includes('80'), false);
  assert.equal(R.huntText(it), 'Je cherche Saga #3 (Virgin). Quelqu\'un l\'a ?');
  assert.equal(R.huntFound(it, [copy('x', 'Saga', '3', 'Cover A')]), false);
  assert.equal(R.huntFound(it, [copy('y', 'saga', '#3', 'virgin')]), true);
  const c = R.huntCandidates([copy('a', 'Bas', '#1', '', { wish: { status: 'wanted' } }), w, copy('z', 'Fini', '#1', '', { wish: { status: 'found' } })]);
  assert.deepEqual(c.map(x => x.id), ['w', 'a']);
});

test('carte : seulement le profil public, chiffres non financiers', () => {
  const view = { profile: { handle: 'moi', displayName: 'Moi', color: '#112233' }, counts: { copies: 12, series: 3 }, read: 5, rank: { rank: 4, name: 'Gardien', trophies: 6 } };
  const m = R.cardModel({ view, favorite: copy('f', 'Saga', '#1', 'Cover B') });
  assert.deepEqual(m.facts.map(f => f.n), [12, 3, 5, 6]);
  assert.equal(m.rank.name, 'Gardien');
  const txt = JSON.stringify(m);
  ['purchasePrice', 'value', 'Boîte 7', 'note-secrete-xyz'].forEach(k => assert.equal(txt.includes(k), false, k));
  const off = R.cardModel({ view: { profile: null } });
  assert.deepEqual(off.facts, []);
  assert.equal(off.rank, null);
});
