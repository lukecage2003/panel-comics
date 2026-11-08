'use strict';
// Critère 6 : le détecteur de secrets détecte réellement (sensibilité) et masque les valeurs. Valeurs FICTIVES.
const test = require('node:test');
const assert = require('node:assert/strict');
const { scanText, mask } = require('../../scripts/check-secrets.js');

const FAKE = {
  jwt: ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJmaWN0aWYifQ', 'c2lnbmF0dXJlZmljdGl2ZQ'].join('.'),
  hex: '0123456789abcdef'.repeat(2) + '01234567',
  stripe: 'sk_' + 'test_' + 'FICTIF0123456789',
  url: 'https://' + 'utilisateur:motfictif' + '@hote.exemple.test/x',
  pwd: 'password' + ': "' + 'fictif123' + '"'
};

test('détecte JWT, clé hexadécimale, clé Stripe, URL avec identifiants, mot de passe', () => {
  const names = scanText(Object.values(FAKE).join('\n')).map(x => x.name);
  for (const n of ['JWT', 'clé hexadécimale de 40 caractères (format Comic Vine)', 'clé Stripe', 'URL avec identifiants', 'mot de passe en clair']) {
    assert.ok(names.includes(n), n);
  }
});

test('ignore une empreinte de commit dans une URL de dépôt', () => {
  assert.equal(scanText(`https://android.googlesource.com/platform/+/${FAKE.hex}/tools`).length, 0);
});

test('identifiants par défaut de la base Supabase locale tolérés, mais pas sur un autre hôte', () => {
  assert.equal(scanText('psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"').length, 0);
  const remote = 'postgresql://' + 'postgres:postgres' + '@db.exemple.test:5432/postgres';
  assert.ok(scanText(remote).some(x => x.name === 'URL avec identifiants'));
  const other = 'postgresql://' + 'postgres:autre' + '@127.0.0.1:54322/postgres';
  assert.ok(scanText(other).some(x => x.name === 'URL avec identifiants'), 'autre mot de passe en local : signalé');
});

test('ne révèle jamais la valeur entière', () => {
  for (const f of scanText(FAKE.jwt + '\n' + FAKE.hex)) {
    assert.ok(!f.masked.includes(FAKE.jwt) && !f.masked.includes(FAKE.hex));
  }
  assert.equal(mask('court'), '****');
});
