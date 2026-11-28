'use strict';
// D-145 (migration 26) : accusés « Vu » réciproques et « Retirer pour tous ». Base PGlite locale.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');
const R = require('../../domains/community/dm-ratchet');

const ALEX = H.USER_A, BOB = H.USER_B, DAN = '55555555-5555-4555-8555-555555555555';
let db;
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const r = async (sql, p) => (await q1(sql + ' r', p)).r;
const as = uid => H.asUser(db, uid);
const ids = {};
test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, ALEX, BOB, DAN);
  for (const [u, h] of [[ALEX, 'alex'], [BOB, 'bob'], [DAN, 'dan']]) {
    await as(u); await db.query('select api.community_join($1, $2, true)', [h, 1985]);
    const id = await R.createIdentity(), pre = await R.createPrekeys(id, 1, 1);
    await db.query('select api.dm_bundle_publish($1, $2, 1, $3, $4, $5)', [pre.bundle.ik, pre.bundle.sik, pre.bundle.spk, pre.bundle.spkSig, JSON.stringify(pre.bundle.opk)]);
    ids[h] = id;
  }
});
test.after(async () => { if (db) await db.close(); });

test('Vu réciproque, retrait pour tous limité à ses propres messages', async () => {
  await as(ALEX);
  const conv = await r("select api.dm_open('bob')");
  const sa = await R.initSender(new Uint8Array(32), ids.bob.pub.ik, new Uint8Array(0));
  const [s1, m1] = await R.encrypt(sa, 'Salut');
  const [, m2] = await R.encrypt(s1, 'Tu as lu Watchmen ?');
  const a = await r('select api.dm_send2($1, $2)', [conv.id, JSON.stringify(m1)]);
  // Une demande n'accepte qu'un message tant que Bob n'a pas répondu
  await as(BOB); await db.query('select api.dm_respond($1, true)', [conv.id]);
  await as(ALEX);
  const b = await r('select api.dm_send2($1, $2)', [conv.id, JSON.stringify(m2)]);
  let st = await r('select api.thread_state($1)', [conv.id]);
  assert.deepEqual([st.receipts, st.seen, st.unsent], [true, null, []]);
  // Bob lit le premier : Alex le voit
  await as(BOB); await db.query('select api.inbox_mark_read($1, $2)', [conv.id, a.id]);
  await as(ALEX); st = await r('select api.thread_state($1)', [conv.id]);
  assert.equal(Number(st.seen.upto), Number(a.id));
  // Bob coupe ses accusés : plus personne ne voit rien (réciproque)
  await as(BOB); await db.query('select api.dm_receipts_set(false)');
  await as(ALEX); assert.equal((await r('select api.thread_state($1)', [conv.id])).seen, null);
  await as(BOB); assert.equal((await r('select api.thread_state($1)', [conv.id])).receipts, false);
  await db.query('select api.dm_receipts_set(true)');
  // Bob ne peut pas retirer un message d'Alex ; Dan n'a pas accès au fil
  await assert.rejects(db.query('select api.msg_unsend($1, $2)', [conv.id, b.id]), /not_found/);
  await as(DAN); await assert.rejects(db.query('select api.thread_state($1)', [conv.id]), /not_found/);
  await assert.rejects(db.query('select api.msg_unsend($1, $2)', [conv.id, b.id]), /not_found/);
  // Alex retire le second : le texte chiffré disparaît, l'identifiant reste comme trace pour les deux
  await as(ALEX); await db.query('select api.msg_unsend($1, $2)', [conv.id, b.id]);
  await as(BOB);
  const rows = await r('select api.dm_messages($1, 0)', [conv.id]);
  assert.deepEqual(rows.map(x => Number(x.id)), [Number(a.id)]);
  assert.deepEqual((await r('select api.thread_state($1)', [conv.id])).unsent.map(Number), [Number(b.id)]);
  await H.asAdmin(db);
  assert.equal(Number((await q1('select count(*) n from messaging.messages where id = $1', [b.id])).n), 0);
  await H.asAnon(db); await assert.rejects(db.query('select api.thread_state($1)', [conv.id]), /permission denied/);
});
