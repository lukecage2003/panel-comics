'use strict';
// Tests des fondations Explorer 2.0 : données synthétiques uniquement.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCatalog, fuzzyMatch } = require('./catalog-core');

const fixture = () => {
  const c = createCatalog();
  const E = (id, kind, name, extra = {}) => assert.ok(c.upsert(Object.assign({ id, kind, name, medium: 'comic' }, extra)).ok, id);
  E('ser_a', 'series', 'Étoile Noire', { aliases: ['Dark Star'], originalTitle: 'Dark Star' });
  E('ser_b', 'series', 'Étoile Noire : Renaissance');
  E('ser_c', 'series', 'Gardiens du Seuil');
  E('ser_m', 'series', 'Lame Lunaire', { medium: 'manga' });
  E('iss_a1', 'issue', 'Étoile Noire #1'); E('iss_a2', 'issue', 'Étoile Noire #2');
  E('iss_c1', 'issue', 'Gardiens du Seuil #1'); E('iss_m1', 'issue', 'Lame Lunaire #1', { medium: 'manga' });
  E('evt_x', 'event', 'La Grande Éclipse');
  E('cre_1', 'creator', 'Alex Martin');
  E('chr_1', 'character', 'Nova');
  E('kf_1', 'key_fact', 'Première apparition de Nova', { provenance: { source: 'fixture' } });
  E('nws_1', 'news', 'Annonce fictive', { provenance: { source: 'fixture' }, expiresAt: '2026-12-31' });
  E('nws_old', 'news', 'Annonce expirée', { provenance: { source: 'fixture' }, expiresAt: '2025-01-01' });
  const R = (a, b, t, m) => assert.ok(c.relate(a, b, t, m).ok, a + ' ' + t + ' ' + b);
  R('iss_a1', 'ser_a', 'issue_of'); R('iss_a2', 'ser_a', 'issue_of'); R('iss_c1', 'ser_c', 'issue_of'); R('iss_m1', 'ser_m', 'issue_of');
  R('iss_a2', 'evt_x', 'part_of_event', { order: 2, role: 'main' }); R('iss_c1', 'evt_x', 'part_of_event', { order: 1, role: 'tie_in' });
  R('cre_1', 'iss_a1', 'credited_on'); R('cre_1', 'iss_m1', 'credited_on');
  R('chr_1', 'iss_a1', 'first_appearance'); R('kf_1', 'iss_a1', 'fact_of');
  R('ser_b', 'ser_a', 'sequel_of'); R('nws_1', 'ser_a', 'about'); R('nws_old', 'ser_a', 'about');
  return c;
};

test('validation : kind, identifiant, source obligatoire pour faits et actualités', () => {
  const c = createCatalog();
  assert.equal(c.upsert({ id: 'ser_x', kind: 'planet', name: 'X' }).ok, false);
  assert.equal(c.upsert({ id: 'bad id', kind: 'series', name: 'X' }).ok, false);
  assert.equal(c.upsert({ id: 'kf_x', kind: 'key_fact', name: 'Fait' }).ok, false);
  assert.equal(c.upsert({ id: 'nws_x', kind: 'news', name: 'N', provenance: { source: 's' } }).ok, false, 'expiration requise');
  assert.ok(c.upsert({ id: 'ser_x', kind: 'series', name: 'X' }).ok);
  assert.equal(c.upsert({ id: 'ser_x', kind: 'issue', name: 'X' }).ok, false, 'changement de kind');
});

test('relations génériques typées : types et sens contrôlés, ordre requis pour un événement', () => {
  const c = fixture();
  assert.equal(c.relate('ser_a', 'iss_a1', 'issue_of').ok, false);
  assert.equal(c.relate('iss_a1', 'evt_x', 'part_of_event').ok, false);
  assert.equal(c.relate('iss_a1', 'nope', 'issue_of').ok, false);
  assert.equal(c.relate('ser_a', 'ser_a', 'related_to').ok, false);
});

test('périmètre D-12 : le manga est stocké mais jamais publié ni cherchable', () => {
  const c = fixture();
  assert.equal(c.get('ser_m'), null);
  assert.equal(c.search('lame lunaire').total, 0);
  assert.ok(!c.page('cre_1').doors.some(d => d.id === 'iss_m1'));
});

test('recherche tolérante : accents, faute de frappe, préfixe, alias VO, groupée par kind', () => {
  const c = fixture();
  assert.ok(c.search('etoile noire').groups.series.some(x => x.id === 'ser_a'));
  assert.ok(c.search('etolie').total > 0, 'faute de frappe');
  assert.ok(c.search('gard').groups.series.some(x => x.id === 'ser_c'), 'préfixe');
  assert.equal(c.search('dark star').groups.series[0].id, 'ser_a', 'alias VO');
  assert.equal(c.search('etoile noire').groups.series[0].id, 'ser_a', 'correspondance exacte en tête');
  assert.deepEqual(Object.keys(c.search('nova', { kinds: ['character'] }).groups), ['character']);
  assert.equal(c.search('').total, 0);
});

test('page d\'entité : au moins trois portes, faits sourcés', () => {
  const c = fixture();
  const p = c.page('iss_a1');
  assert.ok(p.doors.length >= 3, JSON.stringify(p.doors));
  assert.deepEqual(p.facts, [{ text: 'Première apparition de Nova', source: 'fixture' }]);
  assert.equal(c.page('nope'), null);
});

test('ordre de lecture d\'un événement : trié, facultatifs masquables', () => {
  const c = fixture();
  assert.deepEqual(c.readingOrder('evt_x').map(x => x.id), ['iss_c1', 'iss_a2']);
  c.upsert({ id: 'iss_c2', kind: 'issue', name: 'Gardiens du Seuil #2', medium: 'comic' });
  c.relate('iss_c2', 'evt_x', 'part_of_event', { order: 3, role: 'optional' });
  assert.equal(c.readingOrder('evt_x', { hideOptional: true }).length, 2);
});

test('recommandations : chacune avec son motif, filtre personnel fourni par l\'appelant', () => {
  const c = fixture();
  const rec = c.recommend('ser_a');
  assert.ok(rec.length >= 2);
  assert.ok(rec.every(r => r.reasons.length > 0));
  assert.equal(rec[0].id, 'ser_b');
  assert.ok(rec[0].reasons.includes('suite'));
  assert.ok(rec.some(r => r.id === 'ser_c' && r.reasons.some(x => x.startsWith('même événement'))));
  assert.ok(!rec.some(r => r.id === 'ser_m'), 'pas de manga');
  assert.ok(!c.recommend('ser_a', { exclude: id => id === 'ser_b' }).some(r => r.id === 'ser_b'));
});

test('actualités : seulement non expirées, avec source', () => {
  const c = fixture();
  assert.deepEqual(c.news('ser_a', '2026-11-08').map(n => n.id), ['nws_1']);
});

test('entités figées : une page ne permet pas de modifier le catalogue', () => {
  const c = fixture();
  assert.throws(() => { 'use strict'; c.get('ser_a').name = 'X'; });
});

test('performance : 50 000 entités, recherche sous 150 ms après indexation', () => {
  const c = createCatalog();
  const words = ['ombre', 'lumiere', 'gardien', 'cite', 'tempete', 'eclipse', 'serpent', 'aube', 'abime', 'phare'];
  for (let i = 0; i < 50000; i++) c.upsert({ id: 'ser_' + i, kind: i % 5 ? 'issue' : 'series', name: words[i % 10] + ' ' + words[(i * 7) % 10] + ' ' + i, medium: 'comic' });
  c.search('ombre'); // indexation
  const t0 = process.hrtime.bigint();
  const r = c.search('tempet abime');
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(r.total > 0);
  assert.ok(ms < 150, ms + ' ms');
});

test('fuzzyMatch : exact, faute, inversion, préfixe, mots courts stricts', () => {
  assert.equal(fuzzyMatch('king black', 'King in Black (2020)'), 0);
  assert.equal(fuzzyMatch('kign in blakc', 'King in Black'), 1, 'inversions');
  assert.equal(fuzzyMatch('kig', 'King in Black'), -1, 'moins de 4 lettres : strict');
  assert.equal(fuzzyMatch('venmo', 'Venom #1'), 1);
  assert.equal(fuzzyMatch('spidr', 'Spider-Man'), 1);
  assert.equal(fuzzyMatch('absolu', 'Absolute Batman'), 0, 'sous-chaîne exacte');
  assert.equal(fuzzyMatch('superman', 'Batman'), -1);
  assert.equal(fuzzyMatch('', 'x'), -1);
});
