'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./affinity-core');
const R = require('./ranking-core');

const T0 = '2026-11-21T12:00:00Z';
const days = d => new Date(Date.parse(T0) + d * 86400000).toISOString();

test('un J\'aime renforce les sujets de la publication, avec des rendements décroissants', () => {
  let st = A.record(A.emptyState(), 'like', { series: ['Saga'], tags: ['Pull'] }, T0);
  const w1 = st.w['series:saga'].v;
  assert.equal(w1, 1);
  for (let i = 0; i < 30; i++) st = A.record(st, 'save', { series: ['Saga'] }, T0);
  assert.ok(st.w['series:saga'].v <= A.CAP);
  assert.ok(A.tagWeight(st, '#pull'.replace('#', ''), T0) > 0);
  assert.equal(A.record(st, 'inconnu', { series: ['X'] }, T0).w['series:x'], undefined);
});

test('les goûts s\'estompent avec le temps (demi-vie)', () => {
  const st = A.record(A.emptyState(), 'save', { characters: ['Héroïne'] }, T0);
  const now = A.toRanking(st, T0).interests.characters['Héroïne'];
  const later = A.toRanking(st, days(A.HALF_LIFE_D)).interests.characters['Héroïne'];
  assert.ok(later < now && later > 0);
});

test('« Moins de ce sujet » devient un réglage négatif, retirer un J\'aime annule', () => {
  let st = A.record(A.emptyState(), 'less', { series: ['Bruit'] }, T0);
  const r = A.toRanking(st, T0);
  assert.ok(r.tuning['series:bruit'] < 0);
  assert.equal(r.interests.series, undefined);
  st = A.record(A.emptyState(), 'like', { series: ['Saga'] }, T0);
  st = A.record(st, 'unlike', { series: ['Saga'] }, T0);
  assert.equal(A.size(st), 0);
});

test('état illisible ou hostile : nettoyé, borné', () => {
  assert.deepEqual(A.sanitize(null), A.emptyState());
  const s = A.sanitize({ w: { 'series:ok': { v: 99, at: T0, n: 'Ok' }, 'bad key': { v: 1, at: T0 }, 'series:nan': { v: 'x', at: T0 }, '__proto__': { v: 1, at: T0 } } });
  assert.deepEqual(Object.keys(s.w), ['series:ok']);
  assert.equal(s.w['series:ok'].v, A.CAP);
  let st = A.emptyState();
  for (let i = 0; i < A.MAX_KEYS + 40; i++) st = A.record(st, 'tag', { tags: ['t' + i] }, T0);
  assert.ok(A.size(st) <= A.MAX_KEYS);
});

test('branché sur rankingCore : le sujet aimé remonte, le sujet évité descend, et c\'est expliqué', () => {
  let st = A.emptyState();
  st = A.record(st, 'like', { series: ['Saga'] }, T0);
  st = A.record(st, 'save', { series: ['Saga'] }, T0);
  st = A.record(st, 'less', { series: ['Bruit'] }, T0);
  const { interests, tuning } = A.toRanking(st, T0);
  const posts = ['Bruit', 'Neutre', 'Saga'].map((s, i) => ({ id: 'p' + i, authorId: 'a' + i, kind: 'photo', createdAt: T0, original: true, topics: { series: [s] }, issueRefs: [], stats: {} }));
  const r = R.rank(posts, { viewerId: 'me', following: [], interests, tuning }, { mode: 'forYou', now: T0 });
  const order = r.items.map(x => x.post.id);
  assert.equal(order[0], 'p2');
  assert.ok(order.indexOf('p0') > order.indexOf('p1'));
  assert.match(R.explain(r.items[0]), /collectionnes|réglages/);
});

test('« Vos goûts » : lisible, trié, oubliable', () => {
  let st = A.record(A.emptyState(), 'save', { creators: ['Dessinatrice'] }, T0);
  st = A.record(st, 'less', { publishers: ['Éditeur Z'] }, T0);
  const t = A.top(st, T0, 5);
  assert.equal(t[0].direction, 'less');
  assert.equal(t[1].kindLabel, 'Auteur');
  st = A.forget(st, t[0].key);
  assert.equal(A.top(st, T0).length, 1);
});
