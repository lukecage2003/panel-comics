'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./guardian-core');

test('statuts alignés sur la migration 18 ; l\'âge déclaré n\'est jamais présenté comme vérifié', () => {
  assert.deepEqual(G.STATUSES, ['unverified', 'verified_13_15', 'verified_16_17', 'verified_adult', 'under_13_blocked', 'review_required']);
  const v = G.statusView({ band: '15-17', status: 'unverified', guardians: 1, children: 0, settings: null, review_open: false });
  assert.equal(v.verified, false); assert.ok(/non vérifié/.test(v.statusLabel));
  assert.equal(v.minor, true); assert.equal(v.canInviteParent, true); assert.equal(v.liveHost, true);
  assert.equal(G.statusView({ band: '13-14', status: 'unverified', guardians: 2 }).canInviteParent, false);
  assert.equal(G.statusView({ band: '13-14' }).liveHost, false, '13-14 ans : jamais d\'animation');
  assert.equal(G.statusView({ band: '18+', status: 'inventé' }).status, 'unverified');
  assert.equal(G.statusView({ band: '12' }), null);
  const s = G.statusView({ band: '15-17', settings: { quiet_start: 21, quiet_end: 7, live_join: true, live_host: false, follows_open: false } });
  assert.equal(s.quiet, 'De 21 h à 7 h'); assert.equal(s.liveHost, false); assert.equal(s.followsOpen, false);
});

test('code parental : saisie tolérante, appel refusé sans code valide', () => {
  assert.equal(G.normalizeCode(' 3fa9c-01b2e '), '3FA9C01B2E');
  assert.equal(G.formatCode('3FA9C01B2E'), '3FA9C-01B2E');
  assert.equal(G.normalizeCode('ZZZZZZZZZZ'), '');
  assert.deepEqual(G.linkAcceptCall('3fa9c 01b2e'), { fn: 'guardian_link_accept', args: { p_code: '3FA9C01B2E' } });
  assert.equal(G.linkAcceptCall('1234').skip, 'invalid_code');
  assert.equal(G.linkRevokeCall('').skip, 'invalid');
});

test('réglages du parent, contestation et vérification d\'action', () => {
  const c = G.settingsCall('child', { quietStart: '21', quietEnd: 7, liveHost: false });
  assert.deepEqual(c.args, { p_child: 'child', p_quiet_start: 21, p_quiet_end: 7, p_live_join: true, p_live_host: false, p_follows_open: true });
  assert.equal(G.settingsCall('child', { quietStart: 21 }).skip, 'invalid_hours');
  assert.equal(G.settingsCall('child', { quietStart: 25, quietEnd: 7 }).skip, 'invalid_hours');
  assert.equal(G.settingsCall('child', {}).args.p_quiet_start, null);
  assert.equal(G.reviewCall('18+', 'court').skip, 'reason_required');
  assert.equal(G.reviewCall('12', 'une raison assez longue').skip, 'invalid_band');
  assert.equal(G.reviewCall('15-17', 'Je me suis trompé d\'année').fn, 'age_review_request');
  assert.equal(G.canCall('dm').skip, 'invalid', 'pas de messages privés dans Panel');
});

test('décisions et erreurs du serveur en français, sans détail technique', () => {
  assert.deepEqual(G.decision({ allowed: true, reason: '' }), { allowed: true, text: '' });
  assert.ok(/Heures calmes/.test(G.decision({ allowed: false, reason: 'quiet_hours' }).text));
  assert.equal(G.decision(null).text, G.MESSAGES.unknown);
  assert.equal(G.errorText({ message: 'guardian_quiet_hours' }), G.MESSAGES.quiet_hours);
  assert.equal(G.errorText({ message: 'invalid_code' }), G.MESSAGES.invalid_code);
  assert.equal(G.errorText({ message: 'too_young' }), G.MESSAGES.under_13);
  assert.equal(G.errorText(new Error('Failed to fetch')), G.MESSAGES.network);
  assert.equal(G.errorText({ message: 'syntax error at or near' }), G.MESSAGES.unknown);
  for (const m of Object.values(G.MESSAGES)) assert.ok(!/guardian_|sql|uuid/i.test(m), m);
});
