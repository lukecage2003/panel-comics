'use strict';
// D-114 : messages « comme Signal » — X3DH + double cliquet
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./dm-ratchet');

const session = async (withOpk = true) => {
  const alice = await R.createIdentity(), bob = await R.createIdentity();
  const pk = await R.createPrekeys(bob, 3, 1);
  const a = await R.x3dhInitiate(alice, pk.bundle, withOpk ? pk.bundle.opk[0] : null);
  const b = await R.x3dhRespond(bob, pk.secret, a.init);
  return { alice, bob, pk, a, b, A: await R.initSender(a.sk, pk.bundle.spk, a.ad), B: await R.initReceiver(b.sk, pk.secret.spk, b.ad) };
};

test('X3DH : même secret des deux côtés, prépublication signée vérifiée, falsification refusée', async () => {
  const s = await session();
  assert.deepEqual(s.a.sk, s.b.sk); assert.deepEqual(s.a.ad, s.b.ad);
  assert.equal(await R.verifyBundle(s.pk.bundle), true);
  const evil = await R.createIdentity(), other = await R.createPrekeys(evil, 0);
  await assert.rejects(R.x3dhInitiate(s.alice, { ...s.pk.bundle, spk: other.bundle.spk }), /bad_signature/);
  await assert.rejects(R.x3dhRespond(s.bob, { ...s.pk.secret, opk: [] }, s.a.init), /prekey_used/);
  const s2 = await session(false);
  assert.deepEqual(s2.a.sk, s2.b.sk);
});

test('double cliquet : échanges dans les deux sens, une clé par message, clés de cliquet renouvelées', async () => {
  let { A, B } = await session(), m, t;
  [A, m] = await R.encrypt(A, 'Salut, ton Absolute Batman #1 est dispo ?');
  assert.ok(!/Batman/.test(JSON.stringify(m)));
  [B, t] = await R.decrypt(B, m); assert.equal(t, 'Salut, ton Absolute Batman #1 est dispo ?');
  const dh1 = m.header.dh;
  [B, m] = await R.encrypt(B, 'Oui, 30 € en point relais.');
  [A, t] = await R.decrypt(A, m); assert.equal(t, 'Oui, 30 € en point relais.');
  [A, m] = await R.encrypt(A, 'Parfait, je réserve.');
  assert.notEqual(m.header.dh, dh1, 'nouvelle clé de cliquet à chaque changement de sens');
  [B, t] = await R.decrypt(B, m); assert.equal(t, 'Parfait, je réserve.');
});

test('hors d\'ordre accepté, rejeu et altération refusés, état intact après un échec', async () => {
  let { A, B } = await session(), m1, m2, m3, t;
  [A, m1] = await R.encrypt(A, 'un'); [A, m2] = await R.encrypt(A, 'deux'); [A, m3] = await R.encrypt(A, 'trois');
  [B, t] = await R.decrypt(B, m3); assert.equal(t, 'trois');
  [B, t] = await R.decrypt(B, m1); assert.equal(t, 'un');
  await assert.rejects(R.decrypt(B, m1), /replay|tampered/);
  const bad = { ...m2, header: { ...m2.header, n: 7 } };
  await assert.rejects(R.decrypt(B, bad), /tampered/);
  [B, t] = await R.decrypt(B, m2); assert.equal(t, 'deux');
  await assert.rejects(R.decrypt(B, { ...m2, alg: 'autre' }), /unsupported/);
});

test('longueur masquée par rembourrage, trop de messages sautés refusés', async () => {
  let { A, B } = await session(), m, s1, s2;
  [A, s1] = await R.encrypt(A, 'a'); [A, s2] = await R.encrypt(A, 'abcdefghijklmnopqrstuvwxyz');
  assert.equal(s1.ct.length, s2.ct.length, 'même taille chiffrée pour deux textes courts');
  assert.deepEqual(R.unpad(R.pad(new Uint8Array([1, 2, 0]))), new Uint8Array([1, 2, 0]));
  [A, m] = await R.encrypt(A, 'x');
  await assert.rejects(R.decrypt(B, { ...m, header: { ...m.header, n: R.MAX_SKIP + 10 } }), /too_many_skipped|tampered/);
  assert.equal(R.expired(0, 300, 300000), true); assert.equal(R.expired(0, 0, 9e12), false);
});

test('pièces jointes : clé à usage unique, chiffré différent, empreinte contrôlée ; confiance dans la clé du contact', async () => {
  const img = new Uint8Array(4096).map((_, i) => i % 251);
  const a = await R.sealAttachment(img), b = await R.sealAttachment(img);
  assert.notEqual(a.ref.key, b.ref.key);
  assert.notDeepEqual(a.blob, b.blob);
  assert.deepEqual(await R.openAttachment(a.blob, a.ref), img);
  const bad = a.blob.slice(); bad[10] ^= 1;
  await assert.rejects(R.openAttachment(bad, a.ref), /tampered/);
  await assert.rejects(R.openAttachment(a.blob, { ...a.ref, key: b.ref.key }), /tampered/);
  await assert.rejects(R.sealAttachment(new Uint8Array(0)), /too_large/);
  assert.equal(R.trust(null, 'k1'), 'new');
  assert.equal(R.trust('k1', 'k1'), 'same');
  assert.equal(R.trust('k1', 'k2'), 'changed');
  assert.equal(R.trust('k1', ''), 'unknown');
});
