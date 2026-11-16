'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./auth-core');

const jwt = role => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role, iss: 'fixture' })).toString('base64url'), 'signature-fictive'].join('.');
const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co';

test('configuration : clé publique seulement, clé secrète refusée, adresse contrôlée', () => {
  const ok = A.parseConfig({ url: URL_OK + '/', publishableKey: 'sb_publishable_FixtureKey123' });
  assert.equal(ok.ok, true);
  assert.equal(ok.config.ref, 'abcdefghijklmnopqrst');
  assert.equal(ok.config.url, URL_OK);
  assert.equal(A.parseConfig({ url: URL_OK, publishableKey: jwt('anon') }).ok, true);
  assert.match(A.parseConfig({ url: URL_OK, publishableKey: 'sb_' + 'secret_' + 'FixtureKey123' }).errors[0], /SECRÈTE/);
  assert.match(A.parseConfig({ url: URL_OK, publishableKey: jwt('service_role') }).errors[0], /SECRÈTE/);
  assert.match(A.parseConfig({ url: 'http://evil.example', publishableKey: 'sb_publishable_FixtureKey123' }).errors[0], /Adresse/);
  assert.equal(A.parseConfig({ url: 'http://127.0.0.1:54321', publishableKey: 'sb_publishable_FixtureKey123' }).config.local, true);
});

test('e-mail et mot de passe : contrôles locaux avant tout envoi', () => {
  assert.equal(A.validateEmail(' Fixture@Example.Invalid '), 'fixture@example.invalid');
  assert.equal(A.validateEmail('pas-une-adresse'), '');
  assert.deepEqual(A.passwordIssues('court1'), ['au moins 10 caractères']);
  assert.deepEqual(A.passwordIssues('seulementdeslettres'), ['des lettres et des chiffres']);
  assert.deepEqual(A.passwordIssues('motdepasse2026'), []);
});

test('erreurs traduites en français, sans détail technique', () => {
  assert.equal(A.mapAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }).code, 'invalid_credentials');
  assert.equal(A.mapAuthError({ status: 429, message: 'x' }).code, 'rate_limited');
  assert.equal(A.mapAuthError({ code: 'over_email_send_rate_limit' }).code, 'rate_limited');
  assert.equal(A.mapAuthError(new TypeError('Failed to fetch')).code, 'network');
  const u = A.mapAuthError({ code: 'weird', message: 'stack trace fixture@example.invalid' });
  assert.equal(u.code, 'unknown');
  assert.doesNotMatch(u.message, /fixture|stack/);
});

const fakeClient = behaviour => {
  const calls = [];
  const auth = new Proxy({}, { get: (_, name) => async (...args) => { calls.push([name, args]); return (behaviour[name] || (() => ({ data: {}, error: null })))(...args); } });
  return { client: { auth }, calls };
};

test('inscription et réinitialisation : même message que le compte existe ou non', async () => {
  const fresh = fakeClient({});
  const taken = fakeClient({ signUp: () => ({ data: {}, error: { code: 'user_already_exists', message: 'User already registered' } }) });
  const r1 = await A.createAuthFlow(fresh.client, { redirectTo: 'http://localhost:8085/' }).signUp('fixture@example.invalid', 'motdepasse2026');
  const r2 = await A.createAuthFlow(taken.client).signUp('fixture@example.invalid', 'motdepasse2026');
  assert.deepEqual(r1, r2);
  assert.equal(r1.message, A.NEUTRAL.signUp);
  assert.equal(fresh.calls[0][1][0].options.emailRedirectTo, 'http://localhost:8085/');
  const weak = await A.createAuthFlow(fresh.client).signUp('fixture@example.invalid', 'court');
  assert.equal(weak.ok, false);
  assert.equal(fresh.calls.length, 1); // mot de passe faible : rien n'est envoyé
  const limited = fakeClient({ signUp: () => ({ error: { status: 429 } }) });
  assert.equal((await A.createAuthFlow(limited.client).signUp('fixture@example.invalid', 'motdepasse2026')).error.code, 'rate_limited');
  const unknownUser = fakeClient({ resetPasswordForEmail: () => ({ error: { code: 'user_not_found' } }) });
  assert.equal((await A.createAuthFlow(unknownUser.client).resetPassword('fixture@example.invalid')).message, A.NEUTRAL.reset);
});

test('connexion, déconnexion locale par défaut, état du compte', async () => {
  const session = { user: { email: 'fixture@example.invalid', email_confirmed_at: '2026-11-16' }, expires_at: 2e9, refresh_token: 'r' };
  const f = fakeClient({ signInWithPassword: () => ({ data: { session }, error: null }) });
  const flow = A.createAuthFlow(f.client);
  assert.equal((await flow.signIn('fixture@example.invalid', 'x')).session, session);
  await flow.signOut();
  await flow.signOut(true);
  assert.deepEqual(f.calls.slice(1).map(c => c[1][0].scope), ['local', 'global']);
  const bad = fakeClient({ signInWithPassword: () => ({ error: { code: 'invalid_credentials' } }) });
  assert.equal((await A.createAuthFlow(bad.client).signIn('fixture@example.invalid', 'x')).error.message, A.MESSAGES.invalid_credentials);
  const thrown = fakeClient({ signInWithPassword: () => { throw new TypeError('Failed to fetch'); } });
  assert.equal((await A.createAuthFlow(thrown.client).signIn('fixture@example.invalid', 'x')).error.code, 'network');
  assert.equal(A.accountState(null).state, 'local');
  assert.equal(A.accountState(session, Date.now()).state, 'signedIn');
  assert.equal(A.accountState({ user: {}, expires_at: 1 }, Date.now()).state, 'expired');
});
