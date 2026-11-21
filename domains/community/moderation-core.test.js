'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./moderation-core');

const NOW = '2026-11-21T12:00:00Z';
const row = (id, reasons, reports, first, text) => ({ target_kind: 'post', target_id: id, reasons, reports, first_at: first, text });

test('file : mineurs et détresse d\'abord, puis harcèlement, puis le reste', () => {
  const q = M.rankQueue([
    row('a', ['spam'], 5, '2026-11-20T12:00:00Z'),
    row('b', ['harassment'], 1, '2026-11-21T11:00:00Z'),
    row('c', ['minor_safety'], 1, '2026-11-21T11:50:00Z'),
    row('d', ['spoiler'], 2, '2026-11-19T12:00:00Z')
  ], { now: NOW });
  assert.deepEqual(q.map(x => x.id), ['c', 'b', 'a', 'd']);
  assert.equal(q[0].severityLabel, 'Urgent');
  assert.equal(q[0].autoHidden, true, 'sécurité des mineurs : déjà masqué par la base');
});

test('à gravité égale : mot interdit, puis le plus signalé, puis le plus ancien', () => {
  const q = M.rankQueue([
    row('p1', ['hate'], 1, '2026-11-21T08:00:00Z'),
    row('p2', ['hate'], 3, '2026-11-21T11:00:00Z'),
    row('p3', ['hate'], 1, '2026-11-21T11:30:00Z', 'quel n00b ce type'),
    row('p4', ['hate'], 1, '2026-11-21T06:00:00Z')
  ], { now: NOW, terms: ['noob'] });
  assert.deepEqual(q.map(x => x.id), ['p3', 'p2', 'p4', 'p1']);
  assert.deepEqual(q[0].termHits, ['noob']);
  assert.equal(q[1].autoHidden, true, 'troisième signalement');
});

test('délai d\'attente et retard selon la gravité', () => {
  const [u] = M.rankQueue([row('u', ['self_harm'], 1, '2026-11-21T10:30:00Z')], { now: NOW });
  assert.equal(u.wait, '1 h');
  assert.equal(u.late, true, 'urgent : une heure au plus');
  const [s] = M.rankQueue([row('s', ['spam'], 1, '2026-11-21T10:30:00Z')], { now: NOW });
  assert.equal(s.late, false);
  assert.equal(M.waitLabel(12), '12 min');
  assert.equal(M.waitLabel(60 * 50), '2 j');
});

test('résumé : en retard, attente la plus longue, délai médian des décisions', () => {
  const q = M.rankQueue([row('a', ['minor_safety'], 1, '2026-11-21T09:00:00Z'), row('b', ['spam'], 1, '2026-11-21T11:00:00Z')], { now: NOW });
  const s = M.queueSummary(q, [
    { reported_at: '2026-11-20T10:00:00Z', at: '2026-11-20T10:20:00Z' },
    { reported_at: '2026-11-20T10:00:00Z', at: '2026-11-20T11:00:00Z' },
    { reported_at: '2026-11-20T10:00:00Z', at: '2026-11-20T13:00:00Z' }
  ]);
  assert.deepEqual(s, { open: 2, urgent: 1, late: 1, oldest: '3 h', medianResponse: '1 h' });
  assert.equal(M.queueSummary([], []).medianResponse, '');
});

test('mots interdits : liste nettoyée, accents, casse et chiffres déguisés', () => {
  assert.deepEqual(M.normalizeTerms('Idiot\n idiot ,a\n  gros   mot  ;Éàu'), ['Idiot', 'gros mot', 'Éàu']);
  assert.deepEqual(M.matchTerms('Quel 1D10T !', ['idiot']), ['idiot']);
  assert.deepEqual(M.matchTerms('Un gros  MOT ici', ['gros mot']), ['gros mot']);
  assert.deepEqual(M.matchTerms('idiotie', ['idiot']), [], 'mot entier seulement');
  assert.equal(M.normalizeTerms(Array.from({ length: 400 }, (_, i) => 'mot' + i)).length, M.LIMITS.terms);
});

test('raccourcis : une touche, jamais dans un champ ni avec un modificateur', () => {
  assert.equal(M.keyAction({ key: 'J' }), 'next');
  assert.equal(M.keyAction({ key: 'x' }), 'remove');
  assert.equal(M.keyAction({ key: '?' }), 'help');
  assert.equal(M.keyAction({ key: 'x', targetTag: 'textarea' }), null);
  assert.equal(M.keyAction({ key: 'x', ctrlKey: true }), null);
  assert.equal(M.keyAction({ key: 'q' }), null);
  assert.equal(new Set(M.SHORTCUTS.map(s => s.key)).size, M.SHORTCUTS.length);
});

test('appel api.mod_act : motif obligatoire, auteur pour les sanctions, confirmation des actions lourdes', () => {
  const [it] = M.rankQueue([row('p9', ['harassment'], 1, '2026-11-21T11:00:00Z')], { now: NOW });
  assert.equal(M.actCall(it, 'hide', 'ok').error, 'reason_required');
  const h = M.actCall(it, 'hide', M.defaultReason(it, 'hide'));
  assert.deepEqual(h.args, { p_target_kind: 'post', p_target: 'p9', p_action: 'hide', p_reason: 'Masqué en attendant l\'examen (harcèlement)' });
  assert.equal(h.confirm, false);
  assert.equal(M.actCall(it, 'suspend', 'Harcèlement répété').error, 'author_unknown');
  const s = M.actCall(Object.assign({}, it, { authorId: 'u1' }), 'suspend', 'Harcèlement répété');
  assert.deepEqual(s.args, { p_target_kind: 'member', p_target: 'u1', p_action: 'suspend', p_reason: 'Harcèlement répété', p_days: 7 });
  assert.equal(s.confirm, true);
  assert.equal(M.actCall(it, 'delete', 'xxxxx').error, 'invalid_action');
});

test('les motifs reconnus sont ceux de la base (migration 13)', () => {
  assert.deepEqual(Object.keys(M.REASONS).sort(), ['copyright', 'harassment', 'hate', 'impersonation', 'minor_safety', 'other', 'self_harm', 'sexual', 'spam', 'spoiler', 'violence']);
});
