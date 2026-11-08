'use strict';
// Lot 3.6 (local, D-35) : portabilité, effacement, purge des pierres tombales. Données fictives, PGlite.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

let db;
const uuid = () => require('crypto').randomUUID();
test.before(async () => { db = await H.freshDb(); await H.createUsers(db, H.USER_A, H.USER_B); });
test.after(async () => { if (db) await db.close(); });

const device = async uid => { await H.asUser(db, uid); return (await db.query("insert into app.devices (user_id, label, platform) values ($1, 'test', 'web') returning id", [uid])).rows[0].id; };
const push = async (uid, dev, ops) => { await H.asUser(db, uid); return (await db.query('select api.sync_push($1, $2::jsonb, false) as r', [dev, JSON.stringify(ops)])).rows[0].r; };
const up = (entity, id, patch) => ({ op_id: uuid(), entity, id, kind: 'upsert', base_rev: 0, patch, schema_version: 1 });
const del = (entity, id, base) => ({ op_id: uuid(), entity, id, kind: 'delete', base_rev: base, schema_version: 1 });
const pull = async (uid, since) => { await H.asUser(db, uid); return (await db.query('select api.sync_pull($1, 500) as r', [since])).rows[0].r; };

test('export : toutes ses lignes (pierres tombales comprises), rien d\'autrui, anon refusé', async () => {
  const dA = await device(H.USER_A), dB = await device(H.USER_B);
  await push(H.USER_A, dA, [up('copies', 'pa_1', { series: 'Export A' }), up('reading_states', 'loc:export#1@', { status: 'read' }), up('copies', 'pa_2', { series: 'Supprimée' })]);
  const rev = (await pull(H.USER_A, 0)).rows.find(r => r.id === 'pa_2').rev;
  await push(H.USER_A, dA, [del('copies', 'pa_2', Number(rev))]);
  await push(H.USER_B, dB, [up('copies', 'pb_1', { series: 'Secret B' })]);
  await H.asUser(db, H.USER_A);
  const ex = (await db.query('select api.export_my_data() as r')).rows[0].r;
  assert.equal(ex.format, 'panel-account-export');
  assert.deepEqual(ex.copies.map(c => c.id).sort(), ['pa_1', 'pa_2']);
  assert.ok(ex.copies.find(c => c.id === 'pa_2').deleted_at, 'pierre tombale exportée');
  assert.equal(ex.reading_states.length, 1);
  assert.ok(!JSON.stringify(ex).includes('Secret B'));
  assert.ok(!JSON.stringify(ex).includes(H.USER_B));
  assert.ok(!('user_id' in ex.copies[0]));
  await H.asAnon(db);
  await assert.rejects(db.query('select api.export_my_data()'));
});

test('effacement : phrase exacte exigée, toutes ses données effacées, autrui intact, nouveau départ possible', async () => {
  await H.asUser(db, H.USER_A);
  await assert.rejects(db.query("select api.delete_my_data('oui')"), /confirmation_required/);
  await assert.rejects(db.query('select api.delete_my_data(null)'), /confirmation_required/);
  const r = (await db.query("select api.delete_my_data('SUPPRIMER MES DONNÉES') as r")).rows[0].r;
  assert.equal(r.status, 'deleted');
  assert.equal(r.counts.copies, 2);
  assert.ok(r.counts.devices >= 1);
  await H.asAdmin(db);
  for (const t of ['profiles', 'user_settings', 'devices', 'copies', 'locations', 'pulls', 'series_follows', 'reading_progress', 'reading_states', 'user_sync_state', 'sync_ops', 'sync_conflicts']) {
    const n = (await db.query(`select count(*)::int n from app.${t} where user_id = $1`, [H.USER_A])).rows[0].n;
    assert.equal(n, 0, t);
  }
  assert.equal((await db.query('select count(*)::int n from app.copies where user_id = $1', [H.USER_B])).rows[0].n, 1);
  const dA = await device(H.USER_A);
  const res = await push(H.USER_A, dA, [up('copies', 'pa_new', { series: 'Nouveau départ' })]);
  assert.equal(res.status, 'ok');
});

test('purge : service seulement, pierres tombales anciennes retirées, horizon relevé, curseur ancien → resynchronisation', async () => {
  const dB = await device(H.USER_B);
  await push(H.USER_B, dB, [up('copies', 'pb_old', { series: 'Ancienne' }), up('copies', 'pb_keep', { series: 'Récente' })]);
  const rows = (await pull(H.USER_B, 0)).rows;
  const r1 = Number(rows.find(r => r.id === 'pb_old').rev), r2 = Number(rows.find(r => r.id === 'pb_keep').rev);
  await push(H.USER_B, dB, [del('copies', 'pb_old', r1), del('copies', 'pb_keep', r2)]);
  const cursorBefore = 0;
  const after = await pull(H.USER_B, 0);
  const cursorAfter = Number(after.next_rev);
  await H.asUser(db, H.USER_B);
  await assert.rejects(db.query("select app.purge_tombstones($1, interval '30 days')", [H.USER_B]), /permission denied/);
  await H.asAdmin(db);
  await assert.rejects(db.query("select app.purge_tombstones($1, interval '1 day')", [H.USER_B]), /invalid_purge/);
  // Vieillissement simulé sans nouvelle révision (app.skip_rev, réservé au service : T4)
  await db.query("select set_config('app.skip_rev', 'on', false)");
  await db.query("update app.copies set deleted_at = now() - interval '60 days' where user_id = $1 and id = 'pb_old'", [H.USER_B]);
  await db.query("select set_config('app.skip_rev', '', false)");
  const pr = (await db.query("select app.purge_tombstones($1, interval '30 days') as r", [H.USER_B])).rows[0].r;
  assert.equal(pr.purged, 1);
  assert.ok(Number(pr.horizon) > 0);
  assert.equal((await db.query("select count(*)::int n from app.copies where user_id = $1 and id = 'pb_old'", [H.USER_B])).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int n from app.copies where user_id = $1 and id = 'pb_keep'", [H.USER_B])).rows[0].n, 1, 'pierre tombale récente conservée');
  assert.equal((await db.query("select count(*)::int n from app.copies where user_id = $1 and id = 'pb_1'", [H.USER_B])).rows[0].n, 1, 'ligne vivante intacte');
  assert.equal((await pull(H.USER_B, cursorBefore)).status, 'resync_required');
  assert.equal((await pull(H.USER_B, cursorAfter)).status, 'ok');
});
