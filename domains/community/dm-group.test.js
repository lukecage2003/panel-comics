'use strict';
// D-125 : groupes chiffrés par clés d'expéditeur
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./dm-ratchet');
const G = require('./dm-group');

const GID = '0f0e0d0c-0b0a-4908-8706-050403020100';
const trio = async () => ({ alex: await R.createIdentity(), bob: await R.createIdentity(), cleo: await R.createIdentity() });

test('clé d\'expéditeur confiée, messages déchiffrés même dans le désordre, rejeu refusé', async () => {
  const { alex, bob } = await trio();
  let sk = G.createSenderKey();
  const dist = await G.sealSenderKey(alex, bob.pub.ik, sk, { groupId: GID, epoch: 1, from: 'alex', to: 'bob' });
  assert.doesNotMatch(JSON.stringify(dist), new RegExp(Buffer.from(sk.ck).toString('base64').replace(/[+/=]/g, '.')), 'la clé de chaîne ne circule jamais en clair');
  let recv = await G.openSenderKey(bob, dist, { groupId: GID, epoch: 1, from: 'alex', to: 'bob', senderSik: alex.pub.sik });
  const meta = { groupId: GID, epoch: 1, signKey: alex.sign.privateKey };
  let m1, m2, m3;
  [sk, m1] = await G.encryptGroup(sk, 'Qui vient au club samedi ?', meta);
  [sk, m2] = await G.encryptGroup(sk, 'On commence par Watchmen.', meta);
  [sk, m3] = await G.encryptGroup(sk, 'Apportez vos exemplaires.', meta);
  assert.deepEqual([m1.n, m2.n, m3.n], [0, 1, 2]);
  assert.equal(new Set([m1.ct, m2.ct, m3.ct]).size, 3);
  const rm = { groupId: GID, epoch: 1, sik: alex.pub.sik };
  let t;
  [recv, t] = await G.decryptGroup(recv, m3, rm); assert.equal(t, 'Apportez vos exemplaires.');
  [recv, t] = await G.decryptGroup(recv, m1, rm); assert.equal(t, 'Qui vient au club samedi ?');
  [recv, t] = await G.decryptGroup(recv, m2, rm); assert.equal(t, 'On commence par Watchmen.');
  await assert.rejects(G.decryptGroup(recv, m2, rm), /replay/);
});

test('signature : un autre membre ne peut pas se faire passer pour l\'expéditeur ; altération et mauvaise époque refusées', async () => {
  const { alex, bob, cleo } = await trio();
  const sk = G.createSenderKey();
  const recvBob = await G.openSenderKey(bob, await G.sealSenderKey(alex, bob.pub.ik, sk, { groupId: GID, epoch: 1, from: 'alex', to: 'bob' }), { groupId: GID, epoch: 1, from: 'alex', to: 'bob', senderSik: alex.pub.sik });
  // Cléo connaît aussi la clé de chaîne d'Alex, mais signe avec sa propre clé : Bob refuse
  const [, forged] = await G.encryptGroup(sk, 'Je suis Alex, promis.', { groupId: GID, epoch: 1, signKey: cleo.sign.privateKey });
  await assert.rejects(G.decryptGroup(recvBob, forged, { groupId: GID, epoch: 1, sik: alex.pub.sik }), /bad_signature/);
  const [, ok] = await G.encryptGroup(sk, 'Vrai message.', { groupId: GID, epoch: 1, signKey: alex.sign.privateKey });
  await assert.rejects(G.decryptGroup(recvBob, { ...ok, ct: ok.ct.slice(0, -4) + 'AAAA' }, { groupId: GID, epoch: 1, sik: alex.pub.sik }), /bad_signature/);
  await assert.rejects(G.decryptGroup(recvBob, ok, { groupId: GID, epoch: 2, sik: alex.pub.sik }), /tampered/);
  await assert.rejects(G.decryptGroup(recvBob, ok, { groupId: '1f0e0d0c-0b0a-4908-8706-050403020100', epoch: 1, sik: alex.pub.sik }), /bad_signature/);
  const [, back] = await G.decryptGroup(recvBob, ok, { groupId: GID, epoch: 1, sik: alex.pub.sik });
  assert.equal(back, 'Vrai message.');
});

test('clé confiée : seule la destinataire l\'ouvre, et seulement si l\'expéditeur l\'a signée', async () => {
  const { alex, bob, cleo } = await trio();
  const sk = G.createSenderKey();
  const dist = await G.sealSenderKey(alex, bob.pub.ik, sk, { groupId: GID, epoch: 3, from: 'alex', to: 'bob' });
  await assert.rejects(G.openSenderKey(cleo, dist, { groupId: GID, epoch: 3, from: 'alex', to: 'bob', senderSik: alex.pub.sik }), /tampered/);
  await assert.rejects(G.openSenderKey(bob, dist, { groupId: GID, epoch: 3, from: 'alex', to: 'bob', senderSik: cleo.pub.sik }), /bad_signature/);
  await assert.rejects(G.openSenderKey(bob, dist, { groupId: GID, epoch: 4, from: 'alex', to: 'bob', senderSik: alex.pub.sik }), /bad_signature/);
  const r = await G.openSenderKey(bob, dist, { groupId: GID, epoch: 3, from: 'alex', to: 'bob', senderSik: alex.pub.sik });
  assert.equal(r.n, 0); assert.equal(r.ck.length, 32);
});

test('changement d\'époque : la personne partie ne lit pas la suite', async () => {
  const { alex, bob, cleo } = await trio();
  const sk1 = G.createSenderKey();
  const cleoOld = await G.openSenderKey(cleo, await G.sealSenderKey(alex, cleo.pub.ik, sk1, { groupId: GID, epoch: 1, from: 'alex', to: 'cleo' }), { groupId: GID, epoch: 1, from: 'alex', to: 'cleo', senderSik: alex.pub.sik });
  // Cléo quitte le groupe : époque 2, nouvelle clé confiée à Bob seulement
  const sk2 = G.createSenderKey();
  const bobNew = await G.openSenderKey(bob, await G.sealSenderKey(alex, bob.pub.ik, sk2, { groupId: GID, epoch: 2, from: 'alex', to: 'bob' }), { groupId: GID, epoch: 2, from: 'alex', to: 'bob', senderSik: alex.pub.sik });
  const [, m] = await G.encryptGroup(sk2, 'Après le départ.', { groupId: GID, epoch: 2, signKey: alex.sign.privateKey });
  await assert.rejects(G.decryptGroup(cleoOld, m, { groupId: GID, epoch: 1, sik: alex.pub.sik }), /tampered/);
  await assert.rejects(G.decryptGroup(cleoOld, m, { groupId: GID, epoch: 2, sik: alex.pub.sik }), /tampered/);
  assert.equal((await G.decryptGroup(bobNew, m, { groupId: GID, epoch: 2, sik: alex.pub.sik }))[1], 'Après le départ.');
});

test('distribution, nom et droits', () => {
  const members = [{ handle: 'moi', me: true, ik: 'x', sik: 'y', status: 'active' }, { handle: 'bob', ik: 'x', sik: 'y', status: 'active' },
    { handle: 'cleo', ik: 'x', sik: 'y', status: 'invited' }, { handle: 'dan', ik: null, sik: null, status: 'active' }];
  assert.deepEqual(G.needDistribution(members, ['bob']).map(x => x.handle), ['cleo']);
  assert.equal(G.cleanName('  <b>Club\u0007 Watchmen</b> '), 'bClub Watchmen/b');
  assert.equal(G.cleanName('x'.repeat(80)).length, 60);
  assert.equal(G.canManage('admin', 'member', 'remove'), true);
  assert.equal(G.canManage('admin', 'admin', 'remove'), false);
  assert.equal(G.canManage('owner', 'admin', 'remove'), true);
  assert.equal(G.canManage('member', 'member', 'invite'), false);
  assert.equal(G.canManage('owner', 'member', 'role'), true);
  assert.equal(G.MAX_MEMBERS, 32);
});
