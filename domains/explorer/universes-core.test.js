'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('./universes-core');

test('catalogue : clés uniques, champs complets, familles connues, années plausibles', () => {
  const keys = U.UNIVERSES.map(u => u.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const u of U.UNIVERSES) {
    assert.ok(u.name && u.publisher && u.tagline && u.q, u.key);
    assert.ok(U.FAMILIES[u.family], u.key);
    assert.ok(u.since >= 1930 && u.since <= 2026, u.key);
    assert.ok(u.icons.length >= 2, u.key);
    assert.ok(u.tagline.length <= 90 && /[.!]$/.test(u.tagline), u.key);
  }
  for (const k of ['marvel-616', 'dc', 'milestone', 'walking-dead', 'image', 'valiant', 'absolute', 'energon']) assert.ok(keys.includes(k), k);
});

test('familles, recherche et univers d\'un personnage', () => {
  assert.equal(U.byFamily('all').length, U.UNIVERSES.length);
  assert.ok(U.byFamily('dc').every(u => u.family === 'dc'));
  assert.deepEqual(U.find('static').map(u => u.key), ['milestone']);
  assert.ok(U.find('walking').some(u => u.key === 'walking-dead'));
  assert.deepEqual(U.find('x'), []);
  assert.deepEqual(U.ofName('Negan').map(u => u.key), ['walking-dead']);
  assert.deepEqual(U.ofName('Inconnu total'), []);
  assert.equal(U.hue('dc'), U.hue('dc'));
});

test('images génériques des sources repérées, vraies images gardées', () => {
  assert.ok(U.isPlaceholderImage('https://comicvine.gamespot.com/a/uploads/scale_small/11122/111222211/6373148-blank.png'));
  assert.ok(U.isPlaceholderImage('https://x.test/img_broken.png'));
  assert.ok(U.isPlaceholderImage(''));
  assert.ok(!U.isPlaceholderImage('https://comicvine.gamespot.com/a/uploads/scale_small/12/124259/8126579-amazing_spider-man_vol_5_1.jpg'));
});

test('classement : le personnage connu passe devant l\'homonyme obscur', () => {
  const R = (name, pop, pub, img = 'https://x.test/a.jpg') => ({ name, count_of_issue_appearances: pop, publisher: { name: pub }, image: { small_url: img } });
  const list = [R('Spider', 1, 'DC Comics', 'https://x.test/6373148-blank.png'), R('Spider', 3, 'Raj Comics'), R('Spider-Man', 15000, 'Marvel'), R('Spider', 58, 'DC Comics'), R('The Spider', 40, 'Pulp')];
  const out = U.rank(list, 'spider');
  assert.equal(out[0].name, 'Spider-Man');
  assert.equal(out[1].count_of_issue_appearances, 58);
  assert.equal(out[out.length - 1].count_of_issue_appearances, 1);
  assert.equal(U.relevance('Batman', 'batman'), 3);
  assert.ok(U.relevance('Batman Beyond', 'batman') > U.relevance('The Batman Who Laughs', 'batman'));
  assert.deepEqual(U.rank([], 'x'), []);
});
