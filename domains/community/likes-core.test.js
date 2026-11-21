'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./likes-core');

const drawn = L.ALL.filter(x => x.kind !== 'glyph');

test('plus de 150 badges dessinés : têtes et artefacts, toutes les catégories remplies', () => {
  assert.ok(drawn.length >= 150, drawn.length + ' badges');
  assert.ok(drawn.filter(x => x.kind === 'hero').length >= 120);
  assert.ok(drawn.filter(x => x.kind === 'artifact').length >= 30);
  L.CATEGORIES.forEach(c => assert.ok(L.byCat(c.key).length > 0, c.key));
});

test('clés uniques et acceptées par la base (like_icon, migration 14)', () => {
  assert.equal(new Set(L.KEYS).size, L.KEYS.length);
  L.KEYS.forEach(k => assert.match(k, /^[a-z][a-z0-9-]{1,31}$/, k));
  assert.equal(L.sanitize('<script>'), 'heart');
  assert.equal(L.sanitize('roi-felin'), 'roi-felin');
  assert.equal(L.sanitize(42), 'heart');
});

test('noms originaux : aucun nom de personnage, d\'équipe ni d\'éditeur dans ce qui est affiché', () => {
  const banned = /batman|spider|super ?man|marvel|\bdc\b|hulk|thor\b|wolverine|panther|avengers|x-men|deadpool|joker|venom|iron|captain|flash|green lantern|lanterne verte|wonder|aquaman|invincible|spawn|hellboy|groot|loki|thanos|galactus|ph[eé]nix|phoenix|magneto|storm|cyclope|robin|nightwing|catwoman|daredevil|punisher|hawkeye|ultron|doom|fatalis|harley|poison ivy|sinestro|shazam|homme-fourmi|gu[eê]pe|[eé]pouvantail|watchmen|image comics|kang|carnage|rocket|gamora|drax|vision\b|sentry|mystique|gambit|rogue|iceman|torche humaine|femme invisible|la chose/i;
  L.ALL.forEach(x => { assert.ok(!banned.test(x.label), x.key + ' : ' + x.label); assert.ok(!banned.test(x.hint || ''), x.key); });
  L.CATEGORIES.forEach(c => assert.ok(!banned.test(c.label), c.key));
});

test('SVG autonomes et sûrs : pas d\'identifiant partagé, pas de lien, pas de script, pas de valeur invalide', () => {
  drawn.forEach(x => {
    const s = L.svgOf(x.key);
    assert.ok(s.startsWith('<svg class="ic hero" viewBox="0 0 48 48"') && s.endsWith('</svg>'), x.key);
    assert.ok(!/NaN|undefined|null|<script|href|\bid=|on[a-z]+=|url\(/i.test(s), x.key);
    assert.equal((s.match(/<g[ >]/g) || []).length, (s.match(/<\/g>/g) || []).length, x.key + ' : groupes équilibrés');
    assert.ok(s.length < 8000, x.key + ' : ' + s.length + ' caractères');
  });
  assert.equal(L.svgOf('heart'), null);
  assert.equal(L.svgOf('inconnu'), null);
  assert.equal(L.svgOf('roi-felin'), L.svgOf('roi-felin'));
});

test('suggestion depuis le personnage favori et recherche', () => {
  const cases = { 'Black Panther': 'roi-felin', 'Spider-Man': 'tisseur-ecarlate', 'Iron Man': 'armure-ecarlate', 'Invincible': 'jeune-invulnerable', 'Batman': 'chevalier-nuit', 'Wolverine': 'le-griffu', 'Thor': 'dieu-tonnerre', 'Miles Morales': 'tisseur-brooklyn', 'Omni-Man': 'patriarche' };
  Object.entries(cases).forEach(([fav, k]) => assert.equal(L.suggestFor(fav), k, fav));
  assert.equal(L.suggestFor(''), null);
  assert.equal(L.suggestFor('zzz'), null);
  assert.equal(L.search('marteau')[0].key, 'marteau-runique');
  assert.ok(L.search('panthère').some(x => x.key === 'roi-felin'));
  assert.deepEqual(L.search('  '), []);
  assert.equal(L.labelOf('roi-felin'), 'Roi félin');
  assert.equal(L.catLabel(L.catOf('trident')), 'Artefacts');
  assert.match(L.colorOf('roi-felin'), /^#[0-9a-f]{6}$/);
  assert.equal(L.colorOf('heart'), '');
});
