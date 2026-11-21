'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('./notes-core');
const K = require('./likes-core');

const NOW = '2026-11-20T20:00:00.000Z';

test('pensée : texte, mots-dièse, type par défaut, visibilité publique par défaut', () => {
  const r = N.save(null, { text: 'Ma théorie : #AbsoluteBatman cache un twist #Théorie #absolutebatman', kind: 'theory' }, NOW, 'n1');
  assert.deepEqual(r.errors, []);
  assert.equal(r.note.kind, 'theory');
  assert.equal(r.note.verdict, 'open');
  assert.equal(r.note.visibility, 'public');
  assert.deepEqual(N.hashtags(r.note.text), ['AbsoluteBatman', 'Théorie']);
  const q = N.save(r.state, { text: 'Qui lit Saga ?', kind: 'bizarre' }, NOW, 'n2');
  assert.equal(q.note.kind, 'thought');
  assert.equal(q.note.verdict, '');
  assert.equal(q.state.notes[0].id, 'n2');
});

test('pensée vide, trop longue ou avec balises refusée ; image seule acceptée', () => {
  assert.ok(N.save(null, { text: '   ' }, NOW, 'n1').errors.length);
  assert.ok(N.save(null, { text: 'x'.repeat(501) }, NOW, 'n1').errors.length);
  assert.ok(N.save(null, { text: '<script>x</script>' }, NOW, 'n1').errors.length);
  assert.deepEqual(N.save(null, { text: '', imageRef: 'img_1' }, NOW, 'n1').errors, []);
  assert.equal(N.save(null, { text: 'ok', imageRef: '../etc' }, NOW, 'n1').note.imageRef, '');
});

test('modification, verdict de théorie, suppression, images utiles', () => {
  let s = N.save(null, { text: 'Le méchant est son père', kind: 'theory', imageRef: 'img_9' }, NOW, 'n1').state;
  s = N.save(s, { id: 'n1', text: 'Le méchant est son frère' }, '2026-11-21T10:00:00Z', 'zz').state;
  assert.equal(s.notes.length, 1);
  assert.ok(s.notes[0].editedAt);
  assert.equal(s.notes[0].createdAt, NOW);
  const v = N.setVerdict(s, 'n1', 'confirmed', NOW);
  assert.equal(v.ok, true);
  assert.equal(v.state.notes[0].verdict, 'confirmed');
  assert.equal(N.setVerdict(s, 'n1', 'peut-être').ok, false);
  assert.deepEqual(N.imageRefs(v.state), ['img_9']);
  assert.equal(N.remove(v.state, 'n1').state.notes.length, 0);
});

test('tendances pondérées par la fraîcheur et suggestions pendant la saisie', () => {
  const tr = N.trending([
    { at: '2026-11-20T18:00:00Z', tags: ['Saga', 'Théorie'] },
    { at: '2026-11-19T18:00:00Z', tags: ['saga'] },
    { at: '2026-10-01T18:00:00Z', tags: ['Vieux', 'Vieux2'] }
  ], NOW);
  assert.equal(tr[0].tag, 'Saga');
  assert.equal(tr[tr.length - 1].tag.startsWith('Vieux'), true);
  assert.deepEqual(N.suggest('Je pense que #sa', 16, ['Saga', 'SAGA', 'Batman', 'Sandman']).items, ['Saga', 'Sandman']);
  assert.equal(N.suggest('pas de dièse', 12, ['Saga']).prefix, null);
});

test('J\'aime personnalisé : formes originales, suggestion depuis le personnage favori', () => {
  assert.equal(K.sanitize('logo-officiel'), 'heart');
  assert.equal(K.suggestFor('Black Panther'), 'roi-felin');
  assert.equal(K.suggestFor('Miles Morales (Spider-Man)'), 'tisseur-brooklyn');
  assert.equal(K.suggestFor('Green Lantern'), 'porteur-emeraude');
  assert.equal(K.suggestFor(''), null);
  assert.equal(K.suggestFor('Tintin'), null);
  assert.equal(K.ICONS.length, 12);
  assert.ok(K.ICONS.every(i => !/marvel|dc comics|batman|superman/i.test(i.label)));
});
