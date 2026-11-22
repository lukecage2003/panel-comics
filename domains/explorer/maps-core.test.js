'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('./maps-core');
const ROOT = path.join(__dirname, '..', '..');
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas-maps.json'), 'utf8'));

test('catalogue livré : 18 cartes Marvel et DC, valides, vignettes présentes, classées', () => {
  const L = M.validate(RAW);
  assert.equal(L.length, 18);
  assert.equal(M.counts(L).marvel, 9);
  assert.equal(M.counts(L).dc, 9);
  assert.deepEqual(L.map(m => m.key).slice(0, 2), ['marvel-01', 'marvel-02']);
  assert.equal(L[9].key, 'dc-01');
  for (const m of L) {
    assert.ok(M.THEMES[m.theme] && m.title && m.sub && /[.…]$/.test(m.about), m.key);
    assert.ok(fs.existsSync(path.join(ROOT, m.thumb)), m.key);
    assert.ok(m.names.length >= 8, m.key);
  }
  Object.keys(M.THEMES).forEach(t => assert.ok(M.counts(L)[t] >= 1, t));
  assert.ok(!/officiel/i.test(L.map(m => m.about).join(' ')));
});

test('cartes interactives : seules les cartes de l\'atlas sont reprises, sans le nom de l\'auteur, sans les autres pages', () => {
  const L = M.validate(RAW), by = k => L.find(m => m.key === k);
  assert.equal(by('marvel-01').atlas, 'cartes/explorer.html?map=0');
  assert.equal(by('dc-04').atlas, 'cartes/explorer.html?u=dc&map=3');
  assert.equal(by('dc-09').atlas, 'cartes/explorer.html?u=dc&map=8');
  const C = path.join(ROOT, 'cartes');
  for (const f of ['explorer.html', 'data.js', 'data-dc.js', 'images.js', 'panel-cartes.css', 'SOURCE.json']) assert.ok(fs.existsSync(path.join(C, f)), f);
  // Rien d'autre du site : ni accueil, ni encyclopédie, ni fiches, ni chronologies
  const top = fs.readdirSync(C).sort();
  assert.deepEqual(top, ['SOURCE.json', 'data-dc.js', 'data.js', 'explorer.html', 'images.js', 'img', 'panel-cartes.css', 'panel-cartes.js']);
  assert.ok(fs.readdirSync(path.join(C, 'img')).every(f => /\.webp$/.test(f)));
  assert.ok(!fs.existsSync(path.join(ROOT, 'atlas')));
  // Le nom « Primestone » n'apparaît dans aucun fichier repris
  for (const f of top.filter(f => f !== 'img')) assert.ok(!/primestone/i.test(fs.readFileSync(path.join(C, f), 'utf8')), f);
  const I = require('../../scripts/import-atlas.js');
  // Aucun renvoi vers le site d'origine ni vers les polices Google dans les pages et scripts repris
  for (const f of ['explorer.html', 'data.js', 'data-dc.js', 'images.js', 'panel-cartes.css', 'panel-cartes.js']) assert.ok(!I.LEFT.test(fs.readFileSync(path.join(C, f), 'utf8')), f);
  const ex = fs.readFileSync(path.join(C, 'explorer.html'), 'utf8');
  assert.ok(ex.includes("q.get('map')"));
  assert.ok(/<link rel="stylesheet" href="panel-cartes\.css\?v=[0-9a-f]{10}">\n<script src="panel-cartes\.js\?v=[0-9a-f]{10}"><\/script>/.test(ex));
  // Une carte, seule : barres du haut et du bas, titre d'introduction, légendes et panneau de fiche de l'atlas masqués
  const css = fs.readFileSync(path.join(C, 'panel-cartes.css'), 'utf8');
  assert.match(css, /^header, footer, #card, #cap, #bars, #wm,.*#panel, #safe \{ display: none !important; \}$/m);
  // Raccourcis clavier coupés (sauf Échap), écouteur posé avant ceux de l'explorateur
  const js = fs.readFileSync(path.join(C, 'panel-cartes.js'), 'utf8');
  assert.ok(js.includes("e.key !== 'Escape'") && js.includes('stopImmediatePropagation(); }, true);'));
  assert.ok(js.includes('window.panelCartesIndex') && js.includes('window.panelCartesNode') && /\bIDX=/.test(ex) && /\bC=/.test(ex));
  assert.ok(css.includes("url('../fonts/barlow-condensed-800-latin.woff2')") && fs.existsSync(path.join(ROOT, 'fonts', 'barlow-condensed-800-latin.woff2')));
  const src = JSON.parse(fs.readFileSync(path.join(C, 'SOURCE.json'), 'utf8'));
  assert.match(src.commit, /^[0-9a-f]{40}$/);
  // Les règles de retrait du nom valent pour toutes les tournures connues
  assert.equal(I.debrand('Un atlas Primestone. Au-delà des héros.'), 'Un atlas de fans. Au-delà des héros.');
  assert.equal(I.debrand("'PRIMESTONE · COSMOLOGIE MARVEL · '"), "UNAME.toUpperCase()+' · '");
});

test('validation : clés, univers et thèmes contrôlés, chemins déduits de la clé', () => {
  const L = M.validate({ maps: [
    { key: 'marvel-01', uni: 'marvel', theme: 'cosmology', title: 'A', w: 10, h: 10, thumb: 'https://pirate.test/x.png' },
    { key: 'marvel-01', uni: 'marvel', theme: 'cosmology', title: 'Doublon', w: 10, h: 10 },
    { key: '../etc', uni: 'marvel', theme: 'cosmology', title: 'B', w: 10, h: 10 },
    { key: 'dc-02', uni: 'marvel', theme: 'cosmology', title: 'C', w: 10, h: 10 },
    { key: 'dc-03', uni: 'dc', theme: 'inconnu', title: 'D', w: 10, h: 10 },
    { key: 'dc-04', uni: 'dc', theme: 'powers', title: 'E', w: 0, h: 10 },
    { key: 'dc-00', uni: 'dc', theme: 'powers', title: 'F', w: 10, h: 10 }
  ] });
  assert.deepEqual(L.map(m => m.key), ['marvel-01']);
  assert.equal(L[0].thumb, 'maps/marvel-01-thumb.webp');
  assert.deepEqual(M.validate(null), []);
});

test('recherche : titres, entités en anglais ou en français, filtres combinés', () => {
  const L = M.validate(RAW);
  assert.equal(M.filter(L, { q: 'endless' })[0].key, 'dc-04');
  assert.ok(M.hits(L.find(m => m.key === 'dc-04'), 'dream').includes('Dream of the Endless'));
  assert.deepEqual(M.filter(L, { uni: 'dc', theme: 'timeline' }).map(m => m.key), ['dc-07']);
  assert.ok(M.filter(L, { q: 'Galactus' }).length >= 1);
  assert.deepEqual(M.filter(L, { q: 'zzzz introuvable' }), []);
});
