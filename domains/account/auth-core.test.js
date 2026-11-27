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

test('D-114 : Google et Apple par OAuth, lien magique neutre, double authentification, profil d\'inscription', async () => {
  const f = fakeClient({ signInWithOAuth: () => ({ data: { url: 'https://abcdefghijklmnopqrst.supabase.co/auth/v1/authorize' }, error: null }) });
  const flow = A.createAuthFlow(f.client, { redirectTo: 'http://localhost:8085/' });
  assert.equal((await flow.oauth('google')).ok, true);
  assert.equal((await flow.oauth('apple')).ok, true);
  assert.equal((await flow.oauth('myspace')).ok, false);
  assert.deepEqual(f.calls.map(c => c[1][0].provider), ['google', 'apple']);
  assert.equal(f.calls[0][1][0].options.redirectTo, 'http://localhost:8085/');
  const m1 = await flow.magicLink('fixture@example.invalid');
  const m2 = await A.createAuthFlow(fakeClient({ signInWithOtp: () => ({ error: { code: 'otp_disabled' } }) }).client).magicLink('fixture@example.invalid');
  assert.deepEqual(m1, m2); assert.equal(m1.message, A.NEUTRAL.magic);
  const mfa = { enroll: async () => ({ data: { id: 'f1', totp: { qr_code: 'data:image/svg+xml;x', uri: 'otpauth://totp/Panel' } } }), challengeAndVerify: async ({ code }) => code === '123456' ? { data: {} } : { error: { code: 'mfa_verification_failed' } }, listFactors: async () => ({ data: { totp: [{ id: 'f1', status: 'verified' }, { id: 'f2', status: 'unverified' }] } }) };
  const mf = A.createAuthFlow({ auth: { mfa } });
  assert.equal((await mf.mfaEnroll()).factorId, 'f1');
  assert.equal((await mf.mfaVerify('f1', '12345')).error.code, 'mfa_code');
  assert.equal((await mf.mfaVerify('f1', '654321')).ok, false);
  assert.equal((await mf.mfaVerify('f1', '123456')).ok, true);
  assert.deepEqual((await mf.mfaFactors()).totp.map(x => x.id), ['f1']);
  const T = ['collector', 'creator', 'publisher'];
  assert.equal(A.signupProfile({ handle: '@Alex_Encre', birthYear: 1990, type: 'creator', terms: true }, 2026, T).profile.needsVerification, true);
  assert.equal(A.signupProfile({ handle: 'ado.comics', birthYear: 2011, terms: true }, 2026, T).profile.band, '15-17');
  assert.ok(A.signupProfile({ handle: 'urban_comics', birthYear: 1980, type: 'publisher', terms: true }, 2026, T).errors.some(e => /réservé/.test(e)));
  assert.ok(A.signupProfile({ handle: 'petit', birthYear: 2015, terms: true }, 2026, T).errors.some(e => /13 ans/.test(e)));
  assert.ok(A.signupProfile({ handle: 'pro.ado', birthYear: 2010, type: 'creator', terms: true }, 2026, T).errors.some(e => /adultes/.test(e)));
  assert.ok(!A.signupProfile({ handle: 'sans.accord', birthYear: 1990 }, 2026, T).ok);
});

test('mots de passe divulgués (D-130) : seul le préfixe de 5 caractères part, comparaison locale, échec réseau non bloquant', async () => {
  const crypto = require('node:crypto');
  const pw = 'Motdepasse1234';
  const hex = crypto.createHash('sha1').update(pw).digest('hex').toUpperCase();
  const seen = [];
  const fakeFetch = body => async (url, init) => { seen.push({ url, init }); return { ok: true, text: async () => body }; };
  assert.equal(await A.pwnedCount(pw, { fetch: fakeFetch('0000000000000000000000000000000000A:0\r\n' + hex.slice(5) + ':42\r\n') }), 42);
  assert.equal(seen[0].url, 'https://api.pwnedpasswords.com/range/' + hex.slice(0, 5));
  assert.ok(!seen[0].url.includes(hex.slice(5)) && !seen[0].url.includes(pw));
  assert.equal(await A.pwnedCount(pw, { fetch: fakeFetch('ABCDEF:3\r\n') }), 0);
  assert.equal(await A.pwnedCount(pw, { fetch: async () => { throw new Error('hors ligne'); } }), null);
  assert.equal(await A.pwnedCount(pw, { fetch: async () => ({ ok: false }) }), null);
  assert.equal(await A.pwnedCount(pw, {}), null); // jamais d'appel réseau implicite
  // Inscription : refusée si divulgué, envoyée sinon (et sans fetch injecté, aucune vérification)
  let signed = 0;
  const client = { auth: { signUp: async () => { signed++; return { data: {}, error: null }; } } };
  const bad = await A.createAuthFlow(client, { pwnedFetch: fakeFetch(hex.slice(5) + ':9') }).signUp('a@exemple.fr', pw);
  assert.equal(bad.ok, false); assert.equal(bad.error.code, 'pwned_password'); assert.equal(signed, 0);
  assert.equal((await A.createAuthFlow(client, { pwnedFetch: async () => { throw new Error('x'); } }).signUp('a@exemple.fr', pw)).ok, true);
  assert.equal((await A.createAuthFlow(client, {}).signUp('a@exemple.fr', pw)).ok, true);
  assert.equal(signed, 2);
});
