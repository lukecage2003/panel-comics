'use strict';
const test = require('node:test');
const assert = require('node:assert');
const B = require('./boxes-core.js');

const c = (series, issue, extra = {}) => Object.assign({ series, issue, publisher: 'Marvel' }, extra);

test('personnage déduit du titre, champ de la fiche prioritaire, jamais inventé', () => {
  assert.strictEqual(B.characterOf(c('Ultimate Spider-Man (2024)', '#1')), 'Spider-Man');
  assert.strictEqual(B.characterOf(c('Miles Morales: Spider-Man', '#1')), 'Miles Morales');
  assert.strictEqual(B.characterOf(c('Absolute Batman (2024)', '#1')), 'Batman');
  assert.strictEqual(B.characterOf(c('Detective Comics', '#1027')), 'Batman');
  assert.strictEqual(B.characterOf(c('Uncanny X-Men', '#1')), 'X-Men');
  assert.strictEqual(B.characterOf(c('Saga', '#1')), null);
  assert.strictEqual(B.characterOf(c('Saga', '#1', { character: 'Alana' })), 'Alana');
});

test('boîtes par run : numéros triés, plus remplies d\'abord', () => {
  const list = [c('Venom', '#3'), c('Venom', '#1'), c('Venom', '#10'), c('Saga', '#2')];
  const boxes = B.buildBoxes(list, 'run');
  assert.deepStrictEqual(boxes.map(b => [b.label, b.count]), [['Venom', 3], ['Saga', 1]]);
  assert.deepStrictEqual(boxes[0].items.map(x => x.issue), ['#1', '#3', '#10']);
});

test('boîtes par personnage : plusieurs runs dans une boîte, « autres » en dernier', () => {
  const list = [c('Saga', '#1'), c('Batman', '#1'), c('Absolute Batman', '#2'), c('Detective Comics', '#5')];
  const boxes = B.buildBoxes(list, 'character');
  assert.strictEqual(boxes[0].label, 'Batman');
  assert.strictEqual(boxes[0].runs, 3);
  assert.strictEqual(boxes[boxes.length - 1].label, B.OTHER_CHARACTERS);
});

test('par éditeur, par emplacement, mode inconnu ramené au run, remplissage d\'une short box', () => {
  const list = [c('A', '#1', { box: 'Short Box 1' }), c('B', '#1', { publisher: '' })];
  assert.deepStrictEqual(B.buildBoxes(list, 'publisher').map(b => b.label), ['Marvel', 'Éditeur inconnu']);
  assert.deepStrictEqual(B.buildBoxes(list, 'location').map(b => b.label), ['Short Box 1', 'Non rangé']);
  assert.strictEqual(B.buildBoxes(list, 'nimporte')[0].mode, 'run');
  const many = Array.from({ length: 160 }, (_, i) => c('X', '#' + i));
  const box = B.buildBoxes(many, 'run')[0];
  assert.strictEqual(box.fill, 1);
  assert.strictEqual(box.boxes, 2);
  assert.deepStrictEqual(B.buildBoxes(null), []);
});
