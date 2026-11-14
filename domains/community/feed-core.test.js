'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./feed-core');

const draft = { id: 'cd_1', kind: 'pull', text: 'Grosse semaine #NCBD', createdAt: '2026-11-12T10:00:00Z', items: [{ series: 'Absolute Batman (2024)', issue: '#15', publisher: 'DC Comics' }, { series: 'X-Men', issue: '#3', publisher: 'Marvel' }] };
const story = { id: 'st_1', series: 'Saga', issue: '#1', publisher: 'Image Comics', rating: 5, review: 'Énorme.', readAt: '2026-11-13', createdAt: '2026-11-13T20:00:00Z' };

test('tagify et publisherTag : mots-dièse lisibles, sans accent ni année', () => {
  assert.equal(F.tagify('Absolute Batman (2024 - Present)'), 'AbsoluteBatman');
  assert.equal(F.tagify('X-Men'), 'XMen');
  assert.equal(F.tagify('Héroïne fictive'), 'HéroïneFictive');
  assert.equal(F.publisherTag('DC Comics'), 'DC'); assert.equal(F.publisherTag('Marvel Comics'), 'Marvel'); assert.equal(F.publisherTag('Inconnu'), '');
});

test('buildFeed : planches et stories en publications, la plus récente d\'abord, mots-dièse déduits', () => {
  const f = F.buildFeed({ drafts: [draft], stories: [story] });
  assert.deepEqual(f.posts.map(p => p.id), ['s:st_1', 'p:cd_1']);
  const p = f.posts[1];
  assert.equal(p.media.length, 2);
  assert.deepEqual(p.tags.slice(0, 2), ['NCBD', 'PullDuMercredi']);
  assert.ok(p.tags.includes('DC') && p.tags.includes('AbsoluteBatman') && p.tags.includes('Marvel'));
  assert.ok(f.posts[0].tags.includes('CoupDeCœur') && f.posts[0].tags.includes('Saga'));
  assert.ok(f.topTags.length > 0);
});

test('filtre par mot-dièse (insensible à la casse et aux accents) et vue « enregistrés »', () => {
  assert.deepEqual(F.buildFeed({ drafts: [draft], stories: [story], tag: '#marvel' }).posts.map(p => p.id), ['p:cd_1']);
  assert.deepEqual(F.buildFeed({ drafts: [draft], stories: [story], tag: 'coupdecoeur' }).posts.map(p => p.id), ['s:st_1']);
  let s = F.toggle(F.emptyState(), 'save', 'p:cd_1', '2026-11-14T00:00:00Z').state;
  assert.deepEqual(F.buildFeed({ drafts: [draft], stories: [story], state: s, only: 'saved' }).posts.map(p => p.id), ['p:cd_1']);
});

test('toggle : j\'aime aller-retour, épingles limitées à trois et placées en tête', () => {
  let r = F.toggle(F.emptyState(), 'like', 's:st_1', '2026-11-14T00:00:00Z');
  assert.equal(r.on, true); assert.ok(r.state.likes['s:st_1']);
  r = F.toggle(r.state, 'like', 's:st_1'); assert.equal(r.on, false); assert.equal(r.state.likes['s:st_1'], undefined);
  let s = F.emptyState();
  for (const id of ['p:a', 'p:b', 'p:c']) s = F.toggle(s, 'pin', id).state;
  const over = F.toggle(s, 'pin', 'p:d'); assert.equal(over.error, 'too_many_pins');
  s = F.toggle(F.emptyState(), 'pin', 'p:cd_1').state;
  assert.equal(F.buildFeed({ drafts: [draft], stories: [story], state: s }).posts[0].id, 'p:cd_1');
  assert.equal(F.toggle(s, 'like', '<script>').error, 'invalid_id');
});

test('sanitizeState : clés, dates et épingles invalides retirées', () => {
  const s = F.sanitizeState({ likes: { 's:ok': '2026-01-01T00:00:00Z', 'bad id': '2026-01-01', 's:x': 'pas une date' }, saves: 3, pins: ['p:a', 'p:a', 'nope', 'p:b', 'p:c', 'p:d'] });
  assert.deepEqual(Object.keys(s.likes), ['s:ok']); assert.deepEqual(s.saves, {}); assert.deepEqual(s.pins, ['p:a', 'p:b', 'p:c']);
});
