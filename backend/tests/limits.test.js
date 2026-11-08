'use strict';
// Lot 3.6 (local, D-45) : limitation de débit des écritures, purge planifiable, suppression complète d'un compte. PGlite, données fictives.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const H = require('./harness');

let db;
const U3 = '33333333-aaaa-4333-8333-333333333333';
test.before(async () => { db = await H.freshDb(); await H.createUsers(db, H.USER_A, H.USER_B, U3); });
test.after(async () => { if (db) await db.close(); });

const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const device = async uid => { await H.asUser(db, uid); return (await q1("select api.register_device('t', 'web') id")).id; };
const ops = (n, prefix) => Array.from({ length: n }, (_, i) => ({ op_id: crypto.randomUUID(), entity: 'copies', id: prefix + i, kind: 'upsert', base_rev: 0, patch: { n: i }, schema_version: 1 }));
const push = async (uid, dev, list) => { await H.asUser(db, uid); return (await q1('select api.sync_push($1, $2::jsonb, false) r', [dev, JSON.stringify(list)])).r; };

test('limitation de débit : au-delà du plafond, le lot entier est refusé sans écriture ; autrui non concerné ; réglage réservé au service', async () => {
  await H.asAdmin(db);
  await db.query("update app.service_limits set value = 250 where key = 'sync_ops_per_minute'");
  const dA = await device(H.USER_A), dB = await device(H.USER_B);
  assert.equal((await push(H.USER_A, dA, ops(200, 'a'))).status, 'ok');
  await H.asUser(db, H.USER_A);
  await assert.rejects(db.query('select api.sync_push($1, $2::jsonb, false)', [dA, JSON.stringify(ops(100, 'b'))]), /rate_limited/);
  await H.asAdmin(db);
  assert.equal((await q1("select count(*)::int n from app.copies where user_id = $1 and id like 'b%'", [H.USER_A])).n, 0, 'rien d\'écrit');
  assert.equal((await q1('select count(*)::int n from app.sync_ops where user_id = $1', [H.USER_A])).n, 200);
  assert.equal((await push(H.USER_B, dB, ops(100, 'c'))).status, 'ok', 'B a son propre quota');
  for (const role of ['anon', 'authenticated']) {
    await (role === 'anon' ? H.asAnon(db) : H.asUser(db, H.USER_A));
    assert.equal((await H.tryQuery(db, 'select * from app.service_limits')).ok, false, role + ' : lecture refusée');
    assert.equal((await H.tryQuery(db, "update app.service_limits set value = 999999")).ok, false, role + ' : modification refusée');
  }
  await H.asAdmin(db);
  await db.query("update app.service_limits set value = 3000 where key = 'sync_ops_per_minute'");
});

test('purge planifiable : service seulement, pierres tombales anciennes de tous les comptes, âge minimal 7 jours', async () => {
  const dA = await device(H.USER_A);
  const rev = Number((await (async () => { await H.asAdmin(db); return q1("select rev from app.copies where user_id = $1 and id = 'a0'", [H.USER_A]); })()).rev);
  await push(H.USER_A, dA, [{ op_id: crypto.randomUUID(), entity: 'copies', id: 'a0', kind: 'delete', base_rev: rev, schema_version: 1 }]);
  await H.asAdmin(db);
  await db.query("update app.copies set deleted_at = now() - interval '120 days' where user_id = $1 and id = 'a0'", [H.USER_A]);
  await assert.rejects(db.query("select app.purge_due(interval '1 day')"), /invalid_purge/);
  const r = (await q1("select app.purge_due(interval '90 days') r")).r;
  assert.equal(r.purged, 1); assert.equal(r.users, 1);
  assert.equal((await q1("select count(*)::int n from app.copies where user_id = $1 and id = 'a1'", [H.USER_A])).n, 1, 'lignes vivantes intactes');
  await H.asUser(db, H.USER_A);
  assert.equal((await H.tryQuery(db, 'select app.purge_due()')).ok, false, 'client refusé');
});

test('suppression de compte : service seulement, zéro ligne personnelle dans toutes les tables, autrui intact', async () => {
  const d = await device(U3);
  await push(U3, d, ops(5, 'z'));
  await H.asUser(db, U3);
  await db.query("select api.update_profile('{\"display_name\":\"Test\"}'::jsonb)");
  await assert.rejects(db.query('select app.delete_account($1)', [U3]), /permission denied/);
  await H.asAdmin(db);
  const before = (await q1('select count(*)::int n from app.copies where user_id = $1', [H.USER_B])).n;
  assert.equal((await q1('select app.delete_account($1) r', [U3])).r.status, 'account_deleted');
  const tables = (await db.query("select table_name t from information_schema.columns where table_schema = 'app' and column_name = 'user_id'")).rows.map(r => r.t);
  assert.ok(tables.length >= 12);
  for (const t of tables) assert.equal((await q1(`select count(*)::int n from app.${t} where user_id = $1`, [U3])).n, 0, t);
  assert.equal((await q1('select count(*)::int n from app.copies where user_id = $1', [H.USER_B])).n, before);
  await assert.rejects(db.query('select app.delete_account($1)', [U3]), /unknown_user/);
});
