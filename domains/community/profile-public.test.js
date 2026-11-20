'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PP = require('./profile-public');

const copy = (id, series, issue, o = {}) => Object.assign({ id, series, issue, publisher: 'Fictif', variant: 'Cover A', addedAt: '2026-11-0' + (o.d || 1) + 'T00:00:00Z',
  coverUrl: 'https://img.example/' + id + '.jpg', purchasePrice: 12, value: 40, location: 'Boîte 3', notes: 'note-secrete-xyz', condition: 'NM' }, o);

test('réglages : valeurs par défaut, booléens seulement', () => {
  assert.deepEqual(PP.sanitize(null), PP.defaults());
  const s = PP.sanitize({ shelf: false, wishlist: 'oui', inconnu: true });
  assert.equal(s.shelf, false);
  assert.equal(s.wishlist, false);
  assert.equal('inconnu' in s, false);
});

test('jamais publiés : prix, valeur, emplacement, notes, état ne sortent pas, quels que soient les réglages', () => {
  const all = PP.FIELDS.reduce((o, f) => { o[f.key] = true; return o; }, {});
  const v = PP.publicView({ copies: [copy('a', 'Saga', '#1')], wishlist: [copy('w', 'Voulu', '#2')] }, all);
  const txt = JSON.stringify(v);
  ['purchasePrice', 'value', 'location', 'notes', 'condition', 'Boîte 3', 'note-secrete-xyz'].forEach(k => assert.equal(txt.includes(k), false, k));
  assert.equal(v.shelf[0].series, 'Saga');
  assert.equal(v.wishlist.length, 1);
});

test('chaque réglage coupé retire sa partie', () => {
  const off = PP.FIELDS.reduce((o, f) => { o[f.key] = false; return o; }, {});
  const v = PP.publicView({ profile: { handle: 'moi', topCharacters: ['Storm'] }, copies: [copy('a', 'Saga', '#1')], readCount: 4, rank: { name: 'Rang', rank: 2 } }, off);
  ['shelf', 'counts', 'read', 'wishlist', 'rank', 'topCharacters'].forEach(k => assert.equal(k in v, false, k));
  assert.equal(v.profile.handle, 'moi');
});

test('Wishlist masquée par défaut', () => {
  const v = PP.publicView({ copies: [], wishlist: [copy('w', 'Voulu', '#2')] }, null);
  assert.equal('wishlist' in v, false);
});

test('seules les publications « public » sortent', () => {
  const v = PP.publicView({ posts: [{ id: 'p1', visibility: 'private', media: [] }, { id: 'p2', visibility: 'followers', media: [] }, { id: 'p3', visibility: 'public', media: [copy('a', 'Saga', '#1')] }] }, null);
  assert.deepEqual(v.posts.map(x => x.id), ['p3']);
  assert.equal('purchasePrice' in v.posts[0].media[0], false);
});

test('étagère : derniers ajouts, rangés par série puis numéro, sans doublon, bornée', () => {
  const list = [copy('c', 'The Zeta', '#2', { d: 3 }), copy('a', 'Alpha', '#10', { d: 2 }), copy('b', 'Alpha', '#9', { d: 4 }), copy('b2', 'Alpha', '#9', { d: 5 }), copy('z', 'Vieille', '#1', { d: 1 })];
  const s = PP.shelfOrder(list, 4);
  assert.deepEqual(s.map(x => x.series + x.issue), ['Alpha#9', 'Alpha#10', 'Vieille#1', 'The Zeta#2']);
  assert.equal(s[0].id, 'b2');
  assert.deepEqual(PP.shelfOrder(list, 3).map(x => x.series + x.issue), ['Alpha#9', 'Alpha#10', 'The Zeta#2']);
  assert.equal(PP.shelfOrder(list, 2).length, 2);
});

test('couvertures : seules les adresses https ou images en ligne de données sont gardées', () => {
  assert.equal(PP.light({ coverUrl: 'javascript:alert(1)' }).coverUrl, '');
  assert.equal(PP.light({ coverUrl: 'http://x/y.jpg' }).coverUrl, '');
  assert.equal(PP.light({ coverUrl: 'https://x/y.jpg' }).coverUrl, 'https://x/y.jpg');
});
