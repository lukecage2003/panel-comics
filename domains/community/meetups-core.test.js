'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./meetups-core');
const L = require('./live-core');

const NOW = '2026-11-21T10:00:00Z';
const ctx = { adult: true, now: NOW, hourOf: t => new Date(t).getUTCHours() };
const ok = { title: 'Mercredi chez Album', city: 'Lyon', venueType: 'shop', venue: 'Librairie du centre', theme: 'wednesday', when: '2026-11-25T17:30:00Z', capacity: 12 };

test('rencontre valide : lieu public, ville, date raisonnable', () => {
  const r = M.save(M.emptyState(), ok, ctx, 'm1');
  assert.deepEqual(r.errors, []);
  assert.equal(r.meetup.capacity, 12);
  assert.equal(M.sanitize({ capacity: 500 }).capacity, M.LIMITS.maxPeople);
  assert.equal(M.sanitize({ capacity: 0 }).capacity, M.LIMITS.minPeople);
});

test('jamais d\'adresse personnelle ni de contact privé', () => {
  for (const venue of ['Chez moi', '12 rue des Lilas', 'Mon appartement, 3e étage', 'Appelez le 06 12 34 56 78', 'écrivez à moi@exemple.fr', 'Digicode 1234']) {
    const r = M.save(M.emptyState(), Object.assign({}, ok, { venue }), ctx, 'x');
    assert.ok(r.errors.some(e => /adresse personnelle/.test(e)), venue);
  }
  assert.deepEqual(M.validate(M.sanitize(Object.assign({}, ok, { venue: 'Médiathèque de la Part-Dieu' })), ctx), []);
});

test('réservé aux adultes, en journée, ni trop tôt ni trop loin', () => {
  assert.ok(M.validate(M.sanitize(ok), Object.assign({}, ctx, { adult: false })).some(e => /18 ans/.test(e)));
  assert.ok(M.validate(M.sanitize(ok), { now: NOW }).some(e => /18 ans/.test(e)));
  assert.ok(M.validate(M.sanitize(Object.assign({}, ok, { when: '2026-11-21T11:00:00Z' })), ctx).some(e => /deux heures/.test(e)));
  assert.ok(M.validate(M.sanitize(Object.assign({}, ok, { when: '2027-06-01T15:00:00Z' })), ctx).some(e => /90|Quatre-vingt-dix/.test(e)));
  assert.ok(M.validate(M.sanitize(Object.assign({}, ok, { when: '2026-11-25T23:00:00Z' })), ctx).some(e => /22 h/.test(e)));
});

test('vue publique et invitation : ville et type de lieu, jamais le lieu exact', () => {
  const v = M.publicView(ok);
  assert.equal(v.city, 'Lyon'); assert.equal(v.venue, undefined); assert.equal(v.venueType, 'Boutique de comics');
  assert.ok(!/Librairie du centre/.test(M.inviteText(ok)));
  assert.match(M.inviteText(ok), /Lyon/);
});

test('à venir : la ville choisie d\'abord, puis par date ; suppression', () => {
  let st = M.save(M.emptyState(), ok, ctx, 'a').state;
  st = M.save(st, Object.assign({}, ok, { city: 'Paris', when: '2026-11-23T15:00:00Z' }), ctx, 'b').state;
  assert.deepEqual(M.upcoming(st, 'lyon', NOW).map(m => m.id), ['a', 'b']);
  assert.deepEqual(M.upcoming(st, '', NOW).map(m => m.id), ['b', 'a']);
  assert.deepEqual(M.remove(st, 'a').meetups.map(m => m.id), ['b']);
});

test('directs : équipe de co-animation préparée, trois au plus, pseudos valides, sans doublon', () => {
  const c = L.sanitizeCohosts('@Alice\n@bob modérateur\n@alice\n@x\n@carla\n@dan');
  assert.deepEqual(c, [{ handle: 'Alice', role: 'cohost' }, { handle: 'bob', role: 'moderator' }, { handle: 'carla', role: 'cohost' }]);
  assert.equal(L.cohostsText(c), '@Alice\n@bob modérateur\n@carla');
  assert.deepEqual(L.sanitizeRoom({ title: 'x', topics: ['a'], cohosts: [{ handle: '<b>', role: 'boss' }] }).cohosts, []);
  assert.deepEqual(L.sanitizeRoom({ title: 'x', topics: ['a'] }).cohosts, []);
});
