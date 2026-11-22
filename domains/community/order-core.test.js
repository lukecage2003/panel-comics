'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('./order-core');

const T0 = Date.parse('2026-11-02T10:00:00Z'), D = 864e5;
const ev = (to, ms) => ({ to, at: new Date(ms).toISOString() });

test('suivi : étapes, échéance d’expédition, retard, annulation possible', () => {
  const o = { state: 'paid', delivery: 'relay' }, events = [ev('reserved', T0), ev('paid', T0 + 3600e3)];
  const tl = O.timeline(o, events, T0 + D);
  assert.deepEqual(tl.steps.map(s => s.done), [true, true, false, false, false]);
  assert.equal(tl.todo, 'seller_ship');
  assert.equal(tl.due, T0 + 3600e3 + O.SHIP_DAYS * D);
  assert.equal(tl.late, false);
  assert.equal(O.lateCancel(o, events, T0 + D), false);
  assert.equal(O.lateCancel(o, events, T0 + 6 * D), true);
  assert.match(O.todoText(O.timeline(o, events, T0 + 6 * D), 'buyer'), /annuler et être remboursé/);
  assert.equal(O.lateCancel({ state: 'paid', delivery: 'hand' }, events, T0 + 9 * D), false, 'en main propre : pas de délai d’expédition');
});

test('suivi : main propre en trois étapes, litige et vente annulée', () => {
  const tl = O.timeline({ state: 'paid', delivery: 'hand' }, [ev('reserved', T0), ev('paid', T0)], T0);
  assert.deepEqual(tl.steps.map(s => s.key), ['reserved', 'paid', 'completed']);
  assert.match(O.todoText(tl, 'buyer'), /code à 6 chiffres/);
  const dis = O.timeline({ state: 'disputed', delivery: 'parcel' }, [ev('reserved', T0), ev('paid', T0), ev('shipped', T0), ev('disputed', T0)], T0);
  assert.deepEqual(dis.steps.map(s => s.done), [true, true, true, false, false]);
  assert.equal(dis.todo, 'staff');
  assert.match(O.todoText(O.timeline({ state: 'cancelled', delivery: 'parcel' }, [], T0), 'buyer'), /remboursé/);
});

test('litige : fenêtre de 3 jours après livraison, motif, description, photo exigée selon le motif', () => {
  const del = [ev('delivered', T0)];
  assert.equal(O.canDispute({ state: 'shipped' }, [], T0), true);
  assert.equal(O.canDispute({ state: 'delivered' }, del, T0 + 2 * D), true);
  assert.equal(O.canDispute({ state: 'delivered' }, del, T0 + 4 * D), false);
  assert.equal(O.canDispute({ state: 'completed' }, del, T0), false);
  assert.equal(O.validateDispute('damaged', 'Le coin supérieur est plié, la couverture déchirée.', []).ok, false);
  assert.equal(O.validateDispute('damaged', 'Le coin supérieur est plié, la couverture déchirée.', ['p.jpg']).ok, true);
  assert.equal(O.validateDispute('not_received', 'Rien reçu après dix jours de suivi.', []).ok, true);
  assert.equal(O.validateDispute('nope', 'x', []).errors.length, 2);
});

test('numéro de suivi et baisses de prix des favoris', () => {
  assert.equal(O.tracking(' 1z 999-aa1 0123456784 '), '1Z999AA10123456784');
  assert.equal(O.tracking('abc'), '');
  assert.equal(O.tracking('<script>'), '');
  const d = O.priceDrops([{ id: 'a', savedPrice: 4000 }, { id: 'b', savedPrice: 2000 }, { id: 'c', savedPrice: 1000 }], { a: 3000, b: 2500, c: 900 });
  assert.deepEqual(d.map(x => [x.id, x.pct]), [['a', 25], ['c', 10]]);
});
