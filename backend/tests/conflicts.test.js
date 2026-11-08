'use strict';
// Lot 3.5 (local, D-43) : résolution des conflits consignés (V2 et V6 de phase3/10 § 7), réversible, sans perte. PGlite, données fictives.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

let db;
const uuid = () => require('crypto').randomUUID();
test.before(async () => { db = await H.freshDb(); await H.createUsers(db, H.USER_A, H.USER_B); });
test.after(async () => { if (db) await db.close(); });

const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const device = async uid => { await H.asUser(db, uid); return (await q1("select api.register_device('t', 'web') id")).id; };
const push = async (uid, dev, ops) => { await H.asUser(db, uid); return (await q1('select api.sync_push($1, $2::jsonb, false) r', [dev, JSON.stringify(ops)])).r; };
const up = (id, patch, base = 0) => ({ op_id: uuid(), entity: 'copies', id, kind: 'upsert', base_rev: base, patch, schema_version: 1 });
const del = (id, base) => ({ op_id: uuid(), entity: 'copies', id, kind: 'delete', base_rev: base, schema_version: 1 });
const row = async (uid, id) => { await H.asUser(db, uid); return (await q1('select data, deleted_at, rev from app.copies where id = $1', [id])); };

test('V2 : même champ modifié sur deux appareils → conflit visible, résolution « local » puis retour « server » (réversible)', async () => {
  const d1 = await device(H.USER_A), d2 = await device(H.USER_A);
  await push(H.USER_A, d1, [up('cp_1', { grade: 'VF 8.0', series: 'Saga' })]);
  const base = Number((await row(H.USER_A, 'cp_1')).rev);
  await push(H.USER_A, d1, [up('cp_1', { grade: 'NM 9.4' }, base)]);
  const r = await push(H.USER_A, d2, [up('cp_1', { grade: 'VG 4.0' }, base)]);
  assert.equal(r.results[0].status, 'conflict');
  await H.asUser(db, H.USER_A);
  const open = (await q1('select api.list_conflicts() r')).r;
  assert.equal(open.length, 1);
  const c = open[0];
  assert.deepEqual([c.field, c.local_value, c.server_value], ['grade', 'VG 4.0', 'NM 9.4']);
  assert.equal((await row(H.USER_A, 'cp_1')).data.grade, 'NM 9.4', 'premier écrit gagnant');
  const res = (await q1('select api.resolve_conflict($1, $2, $3) r', [d2, c.id, 'local'])).r;
  assert.equal(res.changed, true);
  const after = await row(H.USER_A, 'cp_1');
  assert.equal(after.data.grade, 'VG 4.0');
  assert.equal(after.data.series, 'Saga', 'autres champs intacts');
  assert.ok(Number(after.rev) > base, 'nouvelle révision : les autres appareils la reçoivent');
  await H.asUser(db, H.USER_A);
  assert.equal((await q1('select api.list_conflicts() r')).r.length, 0);
  const all = (await q1('select api.list_conflicts(false) r')).r;
  assert.equal(all[0].resolution, 'chose_local');
  // Réversible : l'autre choix rétablit la valeur écartée, conservée dans le conflit
  await q1('select api.resolve_conflict($1, $2, $3) r', [d1, c.id, 'server']);
  assert.equal((await row(H.USER_A, 'cp_1')).data.grade, 'NM 9.4');
  // Valeur déjà en place : aucune écriture
  await H.asUser(db, H.USER_A);
  const same = (await q1('select api.resolve_conflict($1, $2, $3) r', [d1, c.id, 'server'])).r;
  assert.equal(same.changed, false);
  // La révision servie par sync_pull contient la valeur résolue
  const pull = (await q1('select api.sync_pull(0, 500) r')).r;
  assert.equal(pull.rows.find(x => x.id === 'cp_1').data.grade, 'NM 9.4');
});

test('V6 : suppression contre modification → la modification gagne ; « local » rejoue la suppression, « server » la défait', async () => {
  const d1 = await device(H.USER_A), d2 = await device(H.USER_A);
  await push(H.USER_A, d1, [up('cp_2', { series: 'Invincible' })]);
  const base = Number((await row(H.USER_A, 'cp_2')).rev);
  await push(H.USER_A, d1, [up('cp_2', { notes: 'modifié' }, base)]);
  const r = await push(H.USER_A, d2, [del('cp_2', base)]);
  assert.equal(r.results[0].status, 'conflict');
  assert.equal((await row(H.USER_A, 'cp_2')).deleted_at, null, 'la modification gagne');
  await H.asUser(db, H.USER_A);
  const c = (await q1('select api.list_conflicts(false) r')).r.find(x => x.entity_id === 'cp_2');
  assert.equal(c.field, '__deleted');
  await q1('select api.resolve_conflict($1, $2, $3) r', [d2, c.id, 'local']);
  assert.ok((await row(H.USER_A, 'cp_2')).deleted_at, 'suppression rejouée (pierre tombale, rien d\'effacé)');
  await H.asUser(db, H.USER_A);
  await q1('select api.resolve_conflict($1, $2, $3) r', [d1, c.id, 'server']);
  const back = await row(H.USER_A, 'cp_2');
  assert.equal(back.deleted_at, null);
  assert.equal(back.data.notes, 'modifié', 'données conservées après aller-retour');
});

test('garde-fous : choix invalide, conflit d\'autrui, appareil révoqué, anon', async () => {
  await H.asUser(db, H.USER_A);
  const c = (await q1('select api.list_conflicts(false) r')).r[0];
  const dA = (await q1("select api.register_device('x', 'web') id")).id;
  await assert.rejects(db.query('select api.resolve_conflict($1, $2, $3)', [dA, c.id, 'both']), /invalid_choice/);
  const dB = await device(H.USER_B);
  await H.asUser(db, H.USER_B);
  assert.equal((await q1('select api.list_conflicts(false) r')).r.length, 0, 'B ne voit pas les conflits de A');
  await assert.rejects(db.query('select api.resolve_conflict($1, $2, $3)', [dB, c.id, 'local']), /unknown_conflict/);
  await H.asUser(db, H.USER_A);
  await q1('select api.revoke_device($1) r', [dA]);
  await assert.rejects(db.query('select api.resolve_conflict($1, $2, $3)', [dA, c.id, 'local']), /device_revoked/);
  await H.asAnon(db);
  await assert.rejects(db.query('select api.list_conflicts()'), /permission denied/);
});
