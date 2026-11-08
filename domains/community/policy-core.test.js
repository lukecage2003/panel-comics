'use strict';
// Tests des fondations Communauté : données synthétiques uniquement, aucune transmission.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const C = require('./policy-core');

const A = { id: 'u_a', role: 'member', createdAt: '2026-01-01T00:00:00Z' };
const B = { id: 'u_b', role: 'member', createdAt: '2026-01-01T00:00:00Z' };
const M = { id: 'u_m', role: 'moderator', createdAt: '2025-01-01T00:00:00Z' };
const NOW = Date.parse('2026-11-08T12:00:00Z');

test('publier = copier : liste blanche, aucun champ financier, d\'emplacement ou de note', () => {
  const item = { id: 's1', series: 'Étoile Noire', issue: '#1', purchase: { price: 4 }, value: 50, location: 'Boîte 4', notes: 'privé', storeName: 'X', coverUrl: 'javascript:alert(1)', grade: 'NM' };
  const { copy, dropped } = C.shareCopy(item);
  assert.deepEqual(Object.keys(copy).sort(), ['grade', 'issue', 'series']);
  for (const f of ['purchase', 'value', 'location', 'notes', 'storeName', 'coverUrl', 'id']) assert.ok(dropped.includes(f), f);
  assert.ok(Object.isFrozen(copy));
  assert.ok(C.FORBIDDEN_FIELDS.every(f => !C.SHAREABLE_COPY_FIELDS.includes(f)));
  assert.deepEqual(Object.keys(C.shareCopy(item, ['series', 'value']).copy), ['series'], 'un champ hors liste blanche reste exclu même demandé');
});

test('le module ne lit aucun domaine personnel ni le réseau', () => {
  const src = fs.readFileSync(path.join(__dirname, 'policy-core.js'), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['localStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest', 'physicalSingles', 'Panel.', 'require(']) assert.ok(!src.includes(bad), bad);
});

test('visibilité : privé, abonnés, public, blocage dans les deux sens, contenu retiré', () => {
  const g = C.createGraph();
  const post = v => ({ id: 'p', authorId: A.id, visibility: v });
  assert.equal(C.canView(B, post('private'), g), false);
  assert.equal(C.canView(A, post('private'), g), true);
  assert.equal(C.canView(B, post('followers'), g), false);
  g.follow(B.id, A.id);
  assert.equal(C.canView(B, post('followers'), g), true);
  assert.equal(C.canView(null, post('public'), g), true);
  g.block(A.id, B.id);
  assert.equal(C.canView(B, post('public'), g), false, 'bloqué');
  assert.equal(g.follows(B.id, A.id), false, 'abonnement retiré');
  assert.equal(g.follow(B.id, A.id), false);
  const removed = Object.assign(post('public'), { removed: true });
  assert.equal(C.canView(null, removed, g), false);
  assert.equal(C.canView(M, removed, g), true);
  assert.equal(C.canEdit(A, removed), false);
});

test('validation : liens interdits aux nouveaux comptes, données personnelles signalées, suspension', () => {
  const fresh = { id: 'u_n', createdAt: '2026-11-06T00:00:00Z' };
  assert.equal(C.validatePost(fresh, { text: 'voir https://exemple.test', visibility: 'public' }, NOW).ok, false);
  assert.equal(C.validatePost(A, { text: 'voir https://exemple.test', visibility: 'public' }, NOW).ok, true);
  const w = C.validatePost(A, { text: 'écrivez-moi à x@exemple.test ou au 06 12 34 56 78, 12 rue des Lilas', visibility: 'public' }, NOW).warnings;
  assert.deepEqual(w, ['adresse e-mail', 'numéro de téléphone', 'adresse postale']);
  assert.equal(C.validatePost(A, { text: 'x', visibility: 'secret' }, NOW).ok, false);
  assert.equal(C.validatePost(Object.assign({}, A, { suspendedUntil: '2026-12-01T00:00:00Z' }), { text: 'x', visibility: 'public' }, NOW).ok, false);
  assert.equal(C.validatePost(A, { text: 'liste', visibility: 'public', items: [{ series: 'X', value: 9 }] }, NOW).ok, false, 'élément de liste non copié');
});

test('limites anti-abus : fenêtre glissante, reprise après expiration', () => {
  let t = NOW;
  const rl = C.createRateLimiter(() => t);
  for (let i = 0; i < C.LIMITS.postsPerHour; i++) assert.ok(rl.check(A.id, 'post').ok);
  const blocked = rl.check(A.id, 'post');
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryInMs > 0);
  assert.ok(rl.check(B.id, 'post').ok, 'limite par utilisateur');
  t += 3600e3 + 1;
  assert.ok(rl.check(A.id, 'post').ok);
});

test('modération : signalement dédoublonné, priorité, décision motivée, retrait réversible, appel', () => {
  const mod = C.createModeration(() => '2026-11-08T12:00:00Z');
  const content = { id: 'p1', authorId: A.id, visibility: 'public' };
  assert.equal(mod.report(A, content, 'spam').ok, false, 'pas son propre contenu');
  assert.equal(mod.report(B, content, 'inconnu').ok, false);
  const r1 = mod.report(B, content, 'spam');
  assert.ok(mod.report(B, content, 'spam').duplicate);
  const r2 = mod.report(M, { id: 'p2', authorId: B.id }, 'personal_data');
  assert.equal(r2.priority, 'high');
  assert.equal(mod.queue()[0].id, r2.id);
  assert.equal(mod.decide(B, r1.id, 'remove', 'spam répété').ok, false, 'un membre ne modère pas');
  assert.equal(mod.decide(M, r1.id, 'remove', '').ok, false, 'motif requis');
  assert.ok(mod.decide(M, r1.id, 'remove', 'spam répété', content).ok);
  assert.equal(content.removed, true);
  assert.equal(C.canModerate(M, { authorId: M.id }), false, 'pas d\'auto-modération');
  assert.ok(mod.appeal(A, 'p1', 'ce n\'était pas du spam').ok);
  assert.equal(mod.appeal(A, 'p1', 'encore').ok, false);
  assert.equal(mod.log().length, 1);
});
