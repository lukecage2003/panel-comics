'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./ranking-core');

const NOW = Date.parse('2026-11-20T12:00:00Z');
const h = n => new Date(NOW - n * 36e5).toISOString();
const post = (id, authorId, o = {}) => Object.assign({ id, authorId, kind: 'photo', createdAt: h(2), topics: {}, stats: {} }, o);

test('qualité : enregistrements et envois rapportés à la portée pèsent plus que les « j\'aime »', () => {
  const likes = post('a', 'u1', { stats: { reach: 200, likes: 40 } });
  const sends = post('b', 'u2', { stats: { reach: 200, saves: 15, sends: 15 } });
  const r = R.rank([likes, sends], {}, { now: NOW });
  assert.deepEqual(r.items.map(x => x.post.id), ['b', 'a']);
  assert.equal(r.version, 1);
});

test('une publication sans portée n\'est ni favorisée ni pénalisée ; la fraîcheur départage', () => {
  const r = R.rank([post('old', 'u1', { createdAt: h(40) }), post('new', 'u2', { createdAt: h(1) })], {}, { now: NOW });
  assert.deepEqual(r.items.map(x => x.post.id), ['new', 'old']);
  assert.ok(Math.abs(r.items[0].score - Math.pow(0.5, 1 / 18)) < 1e-9);
});

test('intérêt comics : séries lues ou collectionnées et abonnements remontent, avec leurs raisons', () => {
  const ctx = { following: ['u3'], interests: { series: { 'Absolute Batman (2024)': 1 } } };
  const r = R.rank([post('x', 'u1'), post('bat', 'u2', { topics: { series: ['Absolute Batman'] } }), post('f', 'u3')], ctx, { now: NOW });
  assert.equal(r.items[0].post.id, 'bat');
  assert.equal(r.items[0].reasons[0].id, 'interest');
  assert.equal(r.items[1].post.id, 'f');
  assert.match(R.explain(r.items[1]), /Tu suis ce compte/);
});

test('originalité : une republication pèse moitié moins que l\'original', () => {
  const r = R.rank([post('repost', 'u1', { original: false }), post('orig', 'u2')], {}, { now: NOW });
  assert.deepEqual(r.items.map(x => x.post.id), ['orig', 'repost']);
  assert.ok(Math.abs(r.items[1].score * 2 - r.items[0].score) < 1e-9);
});

test('signaux négatifs : publications, auteurs et sujets masqués disparaissent ; « voir moins » fait descendre', () => {
  const posts = [post('a', 'u1'), post('b', 'u2'), post('c', 'u3', { topics: { series: ['Saga'] } }), post('d', 'u4', { topics: { characters: ['Venom'] } }), post('e', 'u5')];
  const ctx = { hidden: { posts: ['a'], authors: ['u2'], topics: ['series:Saga'] }, tuning: R.tune({}, 'characters', 'Venom', -1) };
  const r = R.rank(posts, ctx, { now: NOW });
  assert.deepEqual(r.items.map(x => x.post.id), ['e', 'd']);
  assert.deepEqual(R.tune(ctx.tuning, 'characters', 'Venom', 0), {});
  assert.deepEqual(R.tune({}, 'inconnu', 'x', 1), {});
});

test('bouclier anti-spoiler : avis sur un numéro récent non lu signalé, photo jamais, lu jamais', () => {
  const ref = [{ key: 'ek_saga_1_67', releaseDate: '2026-11-11', label: 'Saga #67' }];
  const posts = [post('rev', 'u1', { kind: 'review', issueRefs: ref }), post('pic', 'u2', { issueRefs: ref }), post('oldrev', 'u3', { kind: 'review', issueRefs: [{ key: 'k2', releaseDate: '2026-01-01' }] })];
  const r = R.rank(posts, {}, { now: NOW });
  const by = id => r.items.find(x => x.post.id === id);
  assert.deepEqual(by('rev').spoiler, { key: 'ek_saga_1_67', label: 'Saga #67' });
  assert.equal(by('pic').spoiler, null);
  assert.equal(by('oldrev').spoiler, null);
  assert.equal(R.rank(posts, { readKeys: ['ek_saga_1_67'] }, { now: NOW }).items.find(x => x.post.id === 'rev').spoiler, null);
});

test('diversité : au plus deux publications d\'un même auteur par fenêtre de dix, sans rien retirer', () => {
  const posts = [];
  for (let i = 0; i < 6; i++) posts.push(post('star' + i, 'star', { stats: { reach: 100, saves: 30 } }));
  for (let i = 0; i < 10; i++) posts.push(post('o' + i, 'u' + i));
  const r = R.rank(posts, {}, { now: NOW });
  assert.equal(r.items.length, 16);
  assert.equal(r.items.slice(0, 10).filter(x => x.post.authorId === 'star').length, 2);
  assert.deepEqual(r.items.slice(0, 2).map(x => x.post.authorId), ['star', 'star']);
});

test('« Pour toi » garde au moins 30 % d\'abonnements par fenêtre quand il y en a', () => {
  const posts = [];
  for (let i = 0; i < 10; i++) posts.push(post('d' + i, 'd' + i, { stats: { reach: 100, saves: 20 } }));
  for (let i = 0; i < 3; i++) posts.push(post('f' + i, 'f' + i, { createdAt: h(30) }));
  const r = R.rank(posts, { following: ['f0', 'f1', 'f2'] }, { now: NOW });
  assert.equal(r.items.slice(0, 10).filter(x => x.following).length, 3);
});

test('modes : « Abonnements » strictement chronologique, « Découvrir » sans les abonnements ni soi-même', () => {
  const posts = [post('f-old', 'f', { createdAt: h(5) }), post('f-new', 'f', { createdAt: h(1), stats: { reach: 1 } }), post('x', 'u1', { stats: { reach: 100, sends: 50 } }), post('me', 'moi')];
  const ctx = { following: ['f'], viewerId: 'moi' };
  assert.deepEqual(R.rank(posts, ctx, { now: NOW, mode: 'following' }).items.map(x => x.post.id), ['f-new', 'me', 'f-old']);
  assert.deepEqual(R.rank(posts, ctx, { now: NOW, mode: 'discover' }).items.map(x => x.post.id), ['x']);
});

test('robustesse : entrées absentes ou invalides, résultat déterministe', () => {
  assert.deepEqual(R.rank(null).items, []);
  assert.deepEqual(R.rank([{ id: 'sans-auteur' }, null, post('ok', 'u1', { createdAt: 'n/a', stats: { reach: -5, likes: 'x' } })], {}, { now: NOW }).items.map(x => x.post.id), ['ok']);
  const posts = [post('a', 'u1'), post('b', 'u2'), post('c', 'u3')];
  assert.deepEqual(R.rank(posts, {}, { now: NOW }).items.map(x => x.post.id), R.rank(posts.slice().reverse(), {}, { now: NOW }).items.map(x => x.post.id));
  assert.equal(R.explain(null), 'Publication récente parmi celles disponibles.');
});
