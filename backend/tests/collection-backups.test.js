'use strict';
// D-120 : sauvegarde de la collection dans le compte, seulement par api.collection_backup_*. PGlite, données fictives.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

let db;
test.before(async () => { db = await H.freshDb(); await H.createUsers(db, H.USER_A, H.USER_B); });
test.after(async () => { if (db) await db.close(); });

const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const save = (payload, n = 1) => db.query('select api.collection_backup_save($1::jsonb, $2, $3)', [JSON.stringify(payload), n, 'test']);

test('sauvegarde de collection : fonctions api seulement, propriétaire seul, anonyme refusé, débit et taille bornés', async () => {
  await H.asUser(db, H.USER_A);
  await save({ items: [{ series: 'Test', issue: '1' }] });
  const got = await q1('select * from api.collection_backup_get()');
  assert.equal(got.item_count, 1);
  assert.equal(got.payload.items[0].series, 'Test');
  await assert.rejects(save({ items: [] }), /rate_limited/, 'deux sauvegardes en moins de 20 s refusées');
  await assert.rejects(db.query('select * from app.collection_backups'), 'lecture directe refusée');
  await assert.rejects(db.query("insert into app.collection_backups (user_id, payload, bytes) values ($1, '{}', 2)", [H.USER_A]), 'écriture directe refusée');
  await assert.rejects(save([1, 2]), /invalid_payload/);
  await H.asUser(db, H.USER_B);
  assert.equal((await db.query('select * from api.collection_backup_get()')).rows.length, 0, 'B ne voit pas la sauvegarde de A');
  assert.equal((await q1('select api.collection_backup_delete() d')).d, false, 'B ne peut pas effacer celle de A');
  await H.asAnon(db);
  await assert.rejects(db.query('select * from api.collection_backup_get()'), 'anonyme refusé');
  await H.asUser(db, H.USER_B);
  await assert.rejects(save({ big: 'x'.repeat(8400000) }), /payload_too_large/);
  await H.asAdmin(db);
  await db.query("update app.collection_backups set updated_at = now() - interval '1 minute'");
  await H.asUser(db, H.USER_A);
  assert.equal((await q1('select api.collection_backup_delete() d')).d, true);
  await H.asAdmin(db);
  await H.asUser(db, H.USER_A);
  await save({ items: [] }, 0);
  await H.asAdmin(db);
  await db.query('delete from auth.users where id = $1', [H.USER_A]);
  assert.equal((await q1('select count(*)::int n from app.collection_backups')).n, 0, 'compte supprimé : sauvegarde effacée');
});
