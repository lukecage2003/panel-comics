'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('./scope-core.js');

test('manga et manhwa hors périmètre, par format ou par éditeur', () => {
  assert.strictEqual(S.scopeReason({ format: 'manga', publisher: 'Glénat' }), 'manga');
  assert.strictEqual(S.scopeReason({ format: 'comic', publisher: 'Kana' }), 'manga');
  assert.strictEqual(S.scopeReason({ format: 'tpb', publisher: 'Seven Seas' }), 'manga');
  assert.strictEqual(S.scopeReason({ format: 'other', publisher: 'Delitoon' }), 'manhwa');
  assert.strictEqual(S.scopeReason({ format: 'album', publisher: 'Dargaud' }), 'bd');
});

test('éditeurs de comics et éditeurs mixtes dans le périmètre', () => {
  ['Image Comics', 'Urban Comics', 'Panini Comics', 'Glénat', 'Delcourt', 'IDW Publishing'].forEach(pub => assert.strictEqual(S.scopeReason({ format: 'tpb', publisher: pub }), null, pub));
  assert.strictEqual(S.scopeReason(null), null);
  assert.strictEqual(S.scopeReason({ format: 'manga', publisher: 'Kana', scope: 'in' }), null, 'choix explicite conservé');
});

test('liste proposée : uniquement des éditeurs de comics US et FR', () => {
  const names = S.PUBLISHERS.map(p => S.norm(p[0]));
  ['kana', 'kurokawa', 'ankama', 'dargaud', 'dupuis', 'casterman'].forEach(n => assert.ok(!names.includes(n), n));
  assert.ok(S.PUBLISHERS.every(p => S.MARKETS.includes(p[1])));
  assert.ok(S.PUBLISHERS.every(p => !S.isExcludedPublisher(p[0])));
});

test('résolution des éditeurs par alias, sans accent ni casse', () => {
  assert.deepStrictEqual(S.resolvePublisher('marvel comics'), { name: 'Marvel', market: 'US' });
  assert.deepStrictEqual(S.resolvePublisher('URBAN'), { name: 'Urban Comics', market: 'FR' });
  assert.deepStrictEqual(S.resolvePublisher('glenat comics'), { name: 'Glénat', market: 'FR' });
  assert.deepStrictEqual(S.resolvePublisher('Éditeur inconnu'), { name: 'Éditeur inconnu', market: '' });
  assert.deepStrictEqual(S.resolvePublisher(''), { name: '', market: '' });
});

test('module figé (aucune modification possible des listes)', () => {
  assert.ok(Object.isFrozen(S.SCOPE_RULES) && Object.isFrozen(S.PUBLISHERS) && Object.isFrozen(S.PUBLISHERS[0][2]));
});
