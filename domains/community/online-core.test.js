'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('./online-core');

test('pensée -> appel serveur : texte et mots-dièse seulement, rien pour « Moi seul » ni pour une image seule', () => {
  const c = O.noteCall({ kind: 'theory', text: 'Le méchant est son père #AbsoluteBatman #absolutebatman #Théorie', imageRef: 'ni_1', spoiler: true, visibility: 'followers',
    issue: { series: 'Absolute Batman', issue: '#5', publisher: 'DC', price: 4.99, location: 'Boîte 3' } });
  assert.equal(c.fn, 'note_create');
  assert.deepEqual(c.args.p_tags, ['AbsoluteBatman', 'Théorie']);
  assert.deepEqual(c.args.p_issue, { series: 'Absolute Batman', issue: '#5', publisher: 'DC' });
  assert.equal(c.args.p_visibility, 'followers');
  assert.equal(c.imageLocalOnly, true);
  assert.ok(!/ni_1|4\.99|Boîte/.test(JSON.stringify(c.args)), 'ni image locale ni donnée privée');
  assert.equal(O.noteCall({ text: 'secret', visibility: 'private' }).skip, 'private');
  assert.equal(O.noteCall({ text: '', imageRef: 'ni_2', visibility: 'public' }).skip, 'image_only');
});

test('directs : salon, duel, chat et vote', () => {
  const r = O.roomCall({ title: 'Absolute ou Ultimate ?', format: 'duel', duel: { sides: ['Absolute Batman', 'Ultimate Spider-Man'] } }, 'public');
  assert.equal(r.args.p_side_b, 'Ultimate Spider-Man');
  assert.equal(O.roomCall({ title: 'x', format: 'review', duel: { sides: ['a', 'b'] } }).args.p_side_a, '');
  assert.equal(O.roomCall({ title: 'x', format: 'karaoké' }).skip, 'invalid');
  assert.equal(O.sayCall('r', '   ').skip, 'empty');
  assert.equal(O.voteCall('r', 2).skip, 'invalid');
  assert.equal(O.tallyText({ a: 1, b: 3 }, ['A1', 'B1']), 'A1 25 % · B1 75 % (4 votes)');
  assert.equal(O.tallyText({ a: 0, b: 0 }), 'Aucun vote pour l\'instant');
});

test('lignes du serveur -> fil ; erreurs en français', () => {
  const p = O.postFromRow({ id: 'u1', author_id: 'me', kind: 'note', status: 'visible', body: 'Qui lit Saga ?', visibility: 'public', spoiler: false, created_at: '2026-11-20T10:00:00Z',
    payload: { note: 'question', verdict: '' } }, { handle: 'fan', display_name: 'Fan', like_icon: 'claws' }, 'me');
  assert.equal(p.id, 'o:u1'); assert.equal(p.kind, 'question'); assert.equal(p.mine, true); assert.equal(p.author.likeIcon, 'claws');
  assert.equal(O.postFromRow({ id: 'u2', kind: 'note', status: 'hidden', payload: {} }), null);
  assert.equal(O.chatFromRow({ id: 3, status: 'removed' }), null);
  assert.equal(O.errorText({ message: 'rate_limited' }), O.MESSAGES.rate_limited);
  assert.equal(O.errorText(new TypeError('Failed to fetch')), O.MESSAGES.network);
  assert.equal(O.errorText({ message: 'quelque chose de bizarre' }), O.MESSAGES.unknown);
});
