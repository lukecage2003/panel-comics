'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('./news-core');

const A = (title, extra = {}) => Object.assign({ id: title, title, excerpt: '', categories: [], lang: 'fr', sourceId: 'fx', date: '2026-11-14T08:00:00Z' }, extra);

test('classify : rubriques en français et en anglais, « comics » par défaut', () => {
  assert.deepEqual(N.classify(A('Avengers: Doomsday : nouvelle bande-annonce')).sort(), ['ecran', 'marvel', 'sorties'].sort());
  assert.ok(N.classify(A('Absolute Batman #15 : premier regard')).includes('dc'));
  assert.ok(N.classify(A('Le festival d\'Angoulême dévoile sa sélection')).includes('bd'));
  assert.ok(N.classify(A('Les mangas de la semaine')).includes('manga'));
  assert.deepEqual(N.classify(A('A quiet indie graphic novel')), ['comics']);
});

test('learnFrom et decay : les rubriques ouvertes gagnent du poids qui s\'estompe de moitié en 30 jours', () => {
  let l = N.emptyLearn();
  l = N.learnFrom(l, A('Batman et le Joker'), '2026-11-01T00:00:00Z');
  assert.equal(l.topics.dc, 1); assert.equal(l.sources.fx, 0.5); assert.equal(l.clicks, 1);
  const later = N.decay(l, '2026-12-01T00:00:00Z');
  assert.ok(Math.abs(later.topics.dc - 0.5) < 0.01);
  const old = N.decay(l, '2027-11-01T00:00:00Z');
  assert.equal(old.topics.dc, undefined);
});

test('sanitizeLearn : refuse les clés et valeurs invalides', () => {
  const l = N.sanitizeLearn({ topics: { dc: 3, '<x>': 2, marvel: -1, bd: 'a', manga: 999 }, sources: {}, at: 'pas une date', clicks: -5 });
  assert.deepEqual(l.topics, { dc: 3, manga: 50 }); assert.equal(l.at, null); assert.equal(l.clicks, 0);
});

test('rank : la fraîcheur, les suivis et les préférences apprises ordonnent les articles', () => {
  const now = '2026-11-14T12:00:00Z';
  const items = [A('Un manga', { date: '2026-11-14T11:00:00Z' }), A('Batman revient', { date: '2026-11-13T11:00:00Z' }), A('Miles Morales en vedette', { date: '2026-11-12T11:00:00Z' })];
  assert.equal(N.rank(items, { now })[0].a.title, 'Un manga');
  const r = N.rank(items, { now, interests: [['miles morales', 'Miles Morales']] });
  assert.equal(r[0].a.title, 'Miles Morales en vedette'); assert.equal(r[0].why, 'Miles Morales');
  let l = N.emptyLearn();
  for (let i = 0; i < 4; i++) l = N.learnFrom(l, A('Batman'), now);
  const r2 = N.rank(items, { now, learn: l });
  assert.equal(r2[0].a.title, 'Batman revient'); assert.equal(r2[0].learnedTopic, 'DC');
});

test('inScope (D-12) : un article seulement manga est masqué, un lien manga + univers comics reste', () => {
  assert.equal(N.inScope(A('Les mangas de la semaine')), false);
  assert.equal(N.inScope(A('One Piece : le tome 110 en librairie')), false);
  assert.equal(N.inScope(A('Batman Ninja : un nouvel anime annoncé')), true);
  assert.equal(N.inScope(A('Absolute Batman #14 en VF')), true);
  assert.equal(N.inScope(A('Le festival d\'Angoulême dévoile sa sélection')), true);
});
