'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./edition-core');

const vo = { id: 'p1', series: 'Fixture Saga (2025)', issue: '1', market: 'US', language: 'en', format: 'single', publisher: 'Éditeur fictif US', externalIds: { upc: '000000000001' } };
const vf = { id: 'p2', series: 'Fixture Saga', issue: '1', market: 'FR', language: 'fr', format: 'album', publisher: 'Éditeur fictif FR' };
const other = { id: 'p3', series: 'Autre Héros fictif', issue: '1', market: 'FR' };

test('quatre niveaux distincts : œuvre, publication, édition, exemplaire', () => {
  const l = E.levels(Object.assign({ formatLabel: 'Single' }, vo), { owned: 2 });
  assert.deepEqual(l.map(x => x.level), ['work', 'publication', 'edition', 'copy']);
  assert.equal(l[0].key, 'fixture saga');
  assert.equal(l[0].value, 'Fixture Saga');
  assert.equal(l[1].value, 'Fixture Saga (2025) #1 (US)');
  assert.match(l[2].value, /Single · en · Éditeur fictif US · UPC 000000000001/);
  assert.equal(l[3].value, '2 dans votre collection');
  assert.equal(E.levels(vf, null)[3].value, 'Aucun exemplaire dans votre collection');
  assert.equal(E.workKey('Fixture Saga Vol. 2 (2019)'), E.workKey('fixture saga'));
});

test('une suggestion reste probable, avec ses raisons ; jamais établie', () => {
  const pr = E.probable(vo, vf);
  assert.equal(pr.certainty, 'probable');
  assert.deepEqual(pr.reasons, ['Même titre d\'œuvre', 'Autre marché (FR)', 'Autre langue (fr)', 'Même numéro ou tome', 'Format différent : recueil possible, contenu à vérifier']);
  assert.equal(E.probable(vo, other), null);
  assert.equal(E.probable({ series: '' }, vf), null);
});

test('correspondances : établies d\'abord, sans doublon avec les suggestions', () => {
  const c = E.correspondences(vo, [{ otherId: 'p2', type: 'translated_from', evidence: 'Mentions légales fictives' }], [vf, other, vo]);
  assert.equal(c.length, 1);
  assert.equal(c[0].certainty, 'established');
  assert.match(c[0].reasons[0], /choisie par vous · preuve : Mentions légales fictives/);
  const c2 = E.correspondences(vo, [], [vf, other]);
  assert.deepEqual(c2.map(x => [x.otherId, x.certainty]), [['p2', 'probable']]);
});
