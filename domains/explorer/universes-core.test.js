'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('./universes-core');

test('catalogue : clés uniques, champs complets, périodes cohérentes, source https', () => {
  const keys = U.UNIVERSES.map(u => u.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const u of U.UNIVERSES) {
    assert.ok(u.name && u.publisher && u.tagline && u.q, u.key);
    assert.ok(U.FAMILIES[u.family], u.key);
    assert.ok(u.icons.length >= 2, u.key);
    assert.ok(u.tagline.length <= 140 && /[.!]$/.test(u.tagline), u.key);
    assert.match(u.source, /^https:\/\//, u.key);
    let prev = 0;
    for (const [a, b] of u.periods) {
      assert.ok(a >= 1930 && a <= 2026 && a >= prev, u.key);
      assert.ok(b === null || b === 0 || (b >= a && b <= 2026), u.key);
      prev = b || a;
    }
    assert.equal(u.since, u.periods[0][0]);
  }
  for (const k of ['marvel-616', 'dc', 'milestone', 'walking-dead', 'image', 'valiant', 'absolute', 'energon', 'impound', 'youneek']) assert.ok(keys.includes(k), k);
});

test('précision : les deux univers Ultimate sont distincts et datés, Milestone a cinq fondateurs', () => {
  const by = k => U.UNIVERSES.find(u => u.key === k);
  assert.deepEqual(by('ultimate-1610').periods, [[2000, 2015]]);
  assert.deepEqual(by('ultimate-6160').periods, [[2023, 2026]]);
  assert.deepEqual(by('vertigo').periods, [[1993, 2020], [2024, null]]);
  assert.deepEqual(by('milestone').periods, [[1993, 1997], [2021, null]]);
  assert.equal(by('milestone').founders.length, 5);
  assert.ok(by('milestone').founders.includes('Christopher Priest'));
  assert.equal(U.periodLabel(by('ultimate-1610').periods), '2000-2015');
  assert.equal(U.periodLabel(by('vertigo').periods), '1993-2020, depuis 2024');
  assert.equal(U.periodLabel([[2017, 0]]), 'lancé en 2017');
  assert.ok(!U.isActive(by('walking-dead')) && U.isActive(by('dc')));
});

test('familles, recherche, univers d\'un personnage et d\'un créateur', () => {
  assert.equal(U.byFamily('all').length, U.UNIVERSES.length);
  assert.ok(U.byFamily('dc').every(u => u.family === 'dc'));
  assert.deepEqual(U.find('static').map(u => u.key), ['milestone']);
  assert.ok(U.find('walking').some(u => u.key === 'walking-dead'));
  assert.deepEqual(U.find('x'), []);
  assert.deepEqual(U.ofName('Negan').map(u => u.key), ['walking-dead']);
  assert.deepEqual(U.ofName('Inconnu total'), []);
  assert.deepEqual(U.ofCreator('Dwayne McDuffie').map(u => u.key), ['milestone']);
  assert.deepEqual(U.ofCreator('robert kirkman').map(u => u.key).sort(), ['energon', 'invincible', 'walking-dead']);
  assert.equal(U.hue('dc'), U.hue('dc'));
});

test('univers ajoutés : source https obligatoire, champs nettoyés, liste bornée', () => {
  assert.deepEqual(U.validateCustom({ name: 'Mon univers', from: 2020 }).errors, ['source']);
  assert.deepEqual(U.validateCustom({ name: 'X', from: 1500, to: 1400, source: 'http://a.b/c' }, 2026).errors.sort(), ['from', 'name', 'source', 'to'].sort());
  const ok = U.validateCustom({ name: '  Univers <b>Test</b> ', publisher: 'Studio', from: '2019', to: '', tagline: 'Un essai.', icons: 'Héros A, Héros B', source: 'https://exemple.org/univers' }, 2026);
  assert.ok(ok.ok);
  assert.equal(ok.value.name, 'Univers b Test /b');
  assert.deepEqual(ok.value.periods, [[2019, null]]);
  assert.deepEqual(ok.value.icons, ['Héros A', 'Héros B']);
  assert.match(ok.value.key, /^user-/);
  const list = U.sanitizeCustomList([ok.value, ok.value, { name: 'sans source', from: 2000 }, null]);
  assert.equal(list.length, 1);
  assert.deepEqual(U.byFamily('user', list).map(u => u.key), [ok.value.key]);
  assert.ok(U.find('héros a', list).some(u => u.custom));
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
