'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { seriesInProgress, numOf } = require('./series-progress');

const E = (key, issue, extra = {}) => Object.assign({ key, label: key, issue }, extra);

test('numOf : numéros avec dièse, décimaux, et sans numéro', () => {
  assert.equal(numOf('#12'), 12); assert.equal(numOf('0.5'), 0.5); assert.equal(numOf('1,5'), 1.5); assert.equal(numOf(''), null); assert.equal(numOf('Tome'), null);
});

test('une série lue en partie est « à reprendre » au numéro qui suit le dernier lu', () => {
  const r = seriesInProgress([E('batman', '#1', { read: true }), E('batman', '#2', { read: true }), E('batman', '#3', { owned: true }), E('batman', '#4', { wished: true })]);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].state, r[0].read, r[0].known, r[0].pct, r[0].next, r[0].nextOwned, r[0].unreadOwned, r[0].lastRead], ['resume', 2, 4, 50, '#3', true, 1, '#2']);
});

test('les numéros sautés comptent comme trous, le suivant reste après le dernier lu', () => {
  const r = seriesInProgress([E('x', '1', { read: true }), E('x', '2', { owned: true }), E('x', '3', { read: true }), E('x', '4', {})]);
  assert.equal(r[0].next, '4'); assert.equal(r[0].gaps, 1);
});

test('série finie lue en entier : absente ; série toujours publiée et à jour : gardée', () => {
  assert.equal(seriesInProgress([E('fini', '#1', { read: true }), E('fini', '#2', { read: true })]).length, 0);
  const r = seriesInProgress([E('abs', '#1', { read: true, label: 'Absolute Batman (2024 - Present)' }), E('abs', '#2', { read: true })]);
  assert.equal(r[0].state, 'caught-up'); assert.equal(r[0].next, ''); assert.equal(r[0].label, 'Absolute Batman (2024 - Present)');
});

test('un numéro « en cours » passe devant ; puis le prochain possédé ; puis la lecture la plus récente', () => {
  const r = seriesInProgress([
    E('a', '#1', { read: true, at: '2026-01-01' }), E('a', '#2', {}),
    E('b', '#1', { read: true, at: '2026-02-01' }), E('b', '#2', { owned: true }),
    E('c', '#1', { read: true, at: '2026-03-01' }), E('c', '#2', {}),
    E('d', '#5', { current: true })
  ]);
  assert.deepEqual(r.map(x => x.key), ['d', 'b', 'c', 'a']);
  assert.equal(r[0].state, 'reading'); assert.equal(r[0].next, '#5');
});

test('entrées invalides ignorées (sans clé, sans numéro, recueil)', () => {
  assert.deepEqual(seriesInProgress([null, {}, E('', '#1', { read: true }), E('tpb', 'Tome', { read: true })]), []);
});
