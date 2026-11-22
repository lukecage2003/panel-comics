'use strict';
// D-125 (migration 25) : non-lus, groupes chiffrés par clés d'expéditeur, vocaux dans un compartiment privé. Base PGlite locale.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');
const R = require('../../domains/community/dm-ratchet');
const G = require('../../domains/community/dm-group');

const ALEX = H.USER_A, BOB = H.USER_B;
const CLEO = '33333333-3333-4333-8333-333333333333', TEEN = '44444444-4444-4444-8444-444444444444', DAN = '55555555-5555-4555-8555-555555555555';
const Y = new Date().getFullYear();

let db;
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const r = async (sql, p) => (await q1(sql + ' r', p)).r;
const as = uid => H.asUser(db, uid);
const ids = {};
const publish = async (uid, name) => {
  const id = await R.createIdentity(), pre = await R.createPrekeys(id, 1, 1);
  await as(uid); await db.query('select api.dm_bundle_publish($1, $2, 1, $3, $4, $5)', [pre.bundle.ik, pre.bundle.sik, pre.bundle.spk, pre.bundle.spkSig, JSON.stringify(pre.bundle.opk)]);
  ids[name] = id;
};
test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, ALEX, BOB, CLEO, TEEN, DAN);
  const join = async (u, h, y) => { await as(u); await db.query('select api.community_join($1, $2, true)', [h, y]); };
  await join(ALEX, 'alex', 1990); await join(BOB, 'bob', 1985); await join(CLEO, 'cleo', 1992); await join(TEEN, 'ado', Y - 16); await join(DAN, 'dan', 1980);
  await publish(ALEX, 'alex'); await publish(BOB, 'bob'); await publish(CLEO, 'cleo');
});
test.after(async () => { if (db) await db.close(); });

const box1 = async (sk, text, epoch, gid, who) => G.encryptGroup(sk, text, { groupId: gid, epoch, signKey: ids[who].sign.privateKey });

test('état de la messagerie et non-lus d\'une conversation', async () => {
  await as(ALEX);
  const me = await r('select api.messaging_me()');
  assert.deepEqual([me.member, me.handle, me.adult, me.bundle, me.prekeys], [true, 'alex', true, true, 1]);
  await as(TEEN); assert.equal((await r('select api.messaging_me()')).adult, false);
  // Alex écrit à Bob (demande), Bob voit 1 non lu ; il lit, plus rien
  await as(ALEX);
  const conv = await r("select api.dm_open('bob')");
  const sa = await R.initSender(new Uint8Array(32), ids.bob.pub.ik, new Uint8Array(0));
  const [, m] = await R.encrypt(sa, 'Salut');
  const sent = await r('select api.dm_send2($1, $2)', [conv.id, JSON.stringify(m)]);
  assert.equal((await r('select api.inbox()')).dms[0].unread, 0, 'ses propres messages ne sont jamais « non lus »');
  await as(BOB);
  let box = await r('select api.inbox()');
  assert.deepEqual([box.dms.length, box.dms[0].status, box.dms[0].mine, box.dms[0].unread, box.dms[0].with], [1, 'request', false, 1, 'alex']);
  await db.query('select api.inbox_mark_read($1, $2)', [conv.id, 999999]);
  assert.equal((await r('select api.inbox()')).dms[0].unread, 0);
  await H.asAdmin(db);
  assert.equal(Number((await q1('select last_id from messaging.reads where user_id = $1', [BOB])).last_id), Number(sent.id), 'jamais au-delà du dernier message réel');
  await as(BOB); await db.query('select api.inbox_mark_read($1, 0)', [conv.id]);
  await H.asAdmin(db); assert.equal(Number((await q1('select last_id from messaging.reads where user_id = $1', [BOB])).last_id), Number(sent.id), 'jamais en arrière');
  await as(DAN); await assert.rejects(db.query('select api.inbox_mark_read($1, 1)', [conv.id]), /not_found/);
  await H.asAnon(db); await assert.rejects(db.query('select api.inbox()'), /permission denied/);
});

test('groupes : invitations filtrées, acceptation, historique invisible avant l\'arrivée, clés confiées, époque', async () => {
  await as(ALEX);
  await assert.rejects(db.query("select api.group_create('   ', '{}')"), /name_required/);
  const g = await r("select api.group_create('Club <Watchmen>', $1)", [['bob', 'ado', 'personne']]);
  assert.equal(g.invited, 1);
  assert.deepEqual(g.skipped.map(s => s.reason).sort(), ['minor_protected', 'not_found'], 'un mineur n\'est jamais ajouté, un pseudo inconnu non plus');
  const gid = g.id;
  let list = await r('select api.group_members($1)', [gid]);
  assert.equal(list.name, 'Club Watchmen');
  assert.deepEqual(list.members.map(x => [x.handle, x.role, x.status]), [['alex', 'owner', 'active'], ['bob', 'member', 'invited']]);
  await as(TEEN); await assert.rejects(db.query('select api.group_members($1)', [gid]), /not_found/);
  await assert.rejects(db.query("select api.group_create('Ados', '{}')"), /adult_only/);
  // Un invité ne lit rien et n'envoie rien
  await as(BOB);
  assert.equal((await r('select api.inbox()')).groups[0].status, 'invited');
  let sk = G.createSenderKey(), m;
  [sk, m] = await box1(sk, 'avant', 1, gid, 'bob');
  await assert.rejects(db.query('select api.group_send($1, $2)', [gid, JSON.stringify(m)]), /not_found/);
  // Alex envoie avant l'arrivée de Bob
  await as(ALEX);
  let ska = G.createSenderKey(), ma;
  [ska, ma] = await box1(ska, 'Message d\'avant', 1, gid, 'alex');
  await assert.rejects(db.query('select api.group_send($1, $2)', [gid, JSON.stringify({ ...ma, ct: 'en clair' })]), /invalid_box/);
  await assert.rejects(db.query('select api.group_send($1, $2)', [gid, JSON.stringify({ ...ma, e: 2 })]), /epoch_stale/);
  await db.query('select api.group_send($1, $2)', [gid, JSON.stringify(ma)]);
  await as(BOB); await db.query('select api.group_respond($1, true)', [gid]);
  assert.equal((await r('select api.group_messages($1)', [gid])).length, 0, 'l\'historique d\'avant reste invisible');
  assert.equal((await r('select api.inbox()')).groups[0].unread, 0);
  // Alex confie sa clé à Bob (et pas à un inconnu), puis écrit : Bob déchiffre
  await as(ALEX);
  const dist = await G.sealSenderKey(ids.alex, ids.bob.pub.ik, ska, { groupId: gid, epoch: 1, from: 'alex', to: 'bob' });
  await assert.rejects(db.query('select api.group_key_put($1, 1, $2)', [gid, JSON.stringify([{ to: 'bob', box: { ...dist, eph: 'x' } }])]), /invalid_keys/);
  assert.equal((await r('select api.group_key_put($1, 1, $2)', [gid, JSON.stringify([{ to: 'bob', box: dist }, { to: 'dan', box: dist }])])).stored, 1);
  [ska, ma] = await box1(ska, 'Bienvenue Bob !', 1, gid, 'alex');
  await db.query('select api.group_send($1, $2)', [gid, JSON.stringify(ma)]);
  await H.asAdmin(db); assert.doesNotMatch((await q1('select box::text b from messaging.group_messages order by id desc limit 1')).b, /Bienvenue/);
  await as(BOB);
  const inb = await r('select api.inbox()');
  assert.equal(inb.groups[0].unread, 1);
  const keys = await r('select api.group_keys($1)', [gid]);
  const mem = (await r('select api.group_members($1)', [gid])).members.find(x => x.handle === 'alex');
  const recv = await G.openSenderKey(ids.bob, keys[0].box, { groupId: gid, epoch: 1, from: 'alex', to: 'bob', senderSik: mem.sik });
  const msgs = await r('select api.group_messages($1)', [gid]);
  assert.equal(msgs.length, 1);
  assert.equal((await G.decryptGroup(recv, msgs[0].box, { groupId: gid, epoch: 1, sik: mem.sik }))[1], 'Bienvenue Bob !');
  await db.query('select api.inbox_mark_read($1, $2)', [gid, msgs[0].id]);
  assert.equal((await r('select api.inbox()')).groups[0].unread, 0);
  // Sourdine : propre à chacun
  await db.query('select api.group_mute($1, true)', [gid]);
  assert.equal((await r('select api.inbox()')).groups[0].muted, true);
  await as(ALEX); assert.equal((await r('select api.inbox()')).groups[0].muted, false);
  // Droits : un membre n'invite pas, ne renomme pas ; le créateur nomme un administrateur
  await as(BOB);
  await assert.rejects(db.query("select api.group_invite($1, 'cleo')", [gid]), /forbidden/);
  await assert.rejects(db.query("select api.group_rename($1, 'Pirate')", [gid]), /forbidden/);
  await as(ALEX);
  await db.query("select api.group_invite($1, 'cleo')", [gid]);
  await assert.rejects(db.query("select api.group_invite($1, 'ado')", [gid]), /minor_protected/);
  await db.query("select api.group_set_role($1, 'bob', 'admin')", [gid]);
  await as(CLEO); await db.query('select api.group_respond($1, true)', [gid]);
  // Retrait de Cléo par l'administrateur Bob : nouvelle époque, l'ancienne clé est refusée
  await as(BOB);
  await assert.rejects(db.query("select api.group_remove($1, 'alex')", [gid]), /forbidden/);
  await db.query("select api.group_remove($1, 'cleo')", [gid]);
  assert.equal((await r('select api.group_members($1)', [gid])).epoch, 2);
  await as(CLEO); assert.equal((await r('select api.group_messages($1)', [gid])).length, 0, 'la personne retirée ne lit plus rien');
  await as(ALEX);
  [ska, ma] = await box1(ska, 'Ancienne clé', 1, gid, 'alex');
  await assert.rejects(db.query('select api.group_send($1, $2)', [gid, JSON.stringify(ma)]), /epoch_stale/);
  await assert.rejects(db.query('select api.group_key_put($1, 1, $2)', [gid, JSON.stringify([{ to: 'bob', box: dist }])]), /epoch_stale/);
  // Le créateur part : Bob (administrateur) devient créateur ; le dernier départ efface le groupe
  await db.query('select api.group_leave($1)', [gid]);
  await as(BOB);
  const after = await r('select api.group_members($1)', [gid]);
  assert.deepEqual(after.members.map(x => [x.handle, x.role]), [['bob', 'owner']]);
  assert.equal(after.epoch, 3);
  await db.query('select api.group_leave($1)', [gid]);
  await H.asAdmin(db); assert.equal((await q1('select count(*)::int n from messaging.groups where id = $1', [gid])).n, 0);
});

test('groupe éphémère : messages échus non servis puis purgés ; tables fermées aux accès directs', async () => {
  await as(ALEX);
  const gid = (await r("select api.group_create('Flash', $1)", [['dan']])).id;
  await as(DAN); await assert.rejects(db.query('select api.group_timer_set($1, 300)', [gid]), /not_found|forbidden/);
  await db.query('select api.group_respond($1, true)', [gid]);
  await assert.rejects(db.query('select api.group_timer_set($1, 300)', [gid]), /forbidden/);
  await as(ALEX);
  await assert.rejects(db.query('select api.group_timer_set($1, 42)', [gid]), /invalid_timer/);
  await db.query('select api.group_timer_set($1, 300)', [gid]);
  const [, m] = await box1(G.createSenderKey(), 'disparaît', 1, gid, 'alex');
  await db.query('select api.group_send($1, $2)', [gid, JSON.stringify(m)]);
  await H.asAdmin(db); await db.query("update messaging.group_messages set expires_at = now() - interval '1 second' where group_id = $1", [gid]);
  await as(DAN); assert.equal((await r('select api.group_messages($1)', [gid])).length, 0);
  await H.asAdmin(db); assert.ok((await q1('select messaging.purge_expired() n')).n >= 1);
  await as(ALEX);
  for (const t of ['reads', 'groups', 'group_members', 'group_messages', 'group_keys']) await assert.rejects(db.query(`select * from messaging.${t}`), /permission denied/, t);
});

test('vocaux : compartiment privé, écriture dans son dossier d\'un fil dont on est membre, lecture réservée aux membres', async () => {
  await H.asAdmin(db);
  const b = await q1("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'voice'");
  assert.deepEqual([b.public, Number(b.file_size_limit), b.allowed_mime_types], [false, 4194304, ['application/octet-stream']]);
  const conv = (await q1('select id from messaging.conversations limit 1')).id;
  const f = 'ab'.repeat(16) + '.bin';
  const put = (uid, name) => as(uid).then(() => H.tryQuery(db, "insert into storage.objects (bucket_id, name, owner) values ('voice', $1, $2)", [name, uid]));
  assert.equal((await put(ALEX, `${conv}/${ALEX}/${f}`)).ok, true);
  assert.equal((await put(ALEX, `${conv}/${BOB}/${'cd'.repeat(16)}.bin`)).ok, false, 'jamais dans le dossier d\'un autre');
  assert.equal((await put(DAN, `${conv}/${DAN}/${'ef'.repeat(16)}.bin`)).ok, false, 'jamais dans un fil dont on n\'est pas membre');
  assert.equal((await put(ALEX, `${conv}/${ALEX}/../x.bin`)).ok, false);
  assert.equal((await put(ALEX, `${conv}/${ALEX}/${'0'.repeat(32)}.mp3`)).ok, false);
  await as(BOB); assert.equal((await db.query("select name from storage.objects where bucket_id = 'voice'")).rows.length, 1, 'l\'autre personne de la conversation lit le fichier chiffré');
  await as(DAN); assert.equal((await db.query("select name from storage.objects where bucket_id = 'voice'")).rows.length, 0, 'un tiers ne voit rien');
  await as(BOB); await db.query("delete from storage.objects where bucket_id = 'voice'");
  await H.asAdmin(db); assert.equal((await q1("select count(*)::int n from storage.objects where bucket_id = 'voice'")).n, 1, 'seul l\'expéditeur efface son fichier');
  await as(ALEX); await db.query("delete from storage.objects where bucket_id = 'voice'");
  await H.asAdmin(db); assert.equal((await q1("select count(*)::int n from storage.objects where bucket_id = 'voice'")).n, 0);
  await H.asAnon(db); assert.equal((await H.tryQuery(db, "insert into storage.objects (bucket_id, name) values ('voice', $1)", [`${conv}/${ALEX}/${f}`])).ok, false);
});
