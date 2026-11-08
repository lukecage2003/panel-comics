'use strict';
// Audit de clôture du lot 3.1 : tests des défauts corrigés par la migration 7, et des risques
// que les tests initiaux ne couvraient pas réellement (définisseur de rev, upsert sur la ligne d'autrui, rollback).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

let db;
const lastRev = async uid => {
  await H.asAdmin(db);
  const r = await db.query('select last_rev from app.user_sync_state where user_id = $1', [uid]);
  return r.rows.length ? Number(r.rows[0].last_rev) : 0;
};
// Exécuté sur le schéma du lot 3.1 (migrations 1 à 7) : la migration 8 retire les écritures directes (T1) ; le schéma final est couvert par sync.test.js.
test.before(async () => { db = await H.freshDb({ upTo: H.LOT_31 }); await H.createUsers(db, H.USER_A, H.USER_B); });
test.after(async () => { await db.close(); });

test('D1 : un appareil révoqué ne peut pas être réactivé par l\'utilisateur', async () => {
  await H.asUser(db, H.USER_A);
  const dev = (await db.query("insert into app.devices (user_id, label, platform) values ($1, 'Téléphone', 'android') returning id", [H.USER_A])).rows[0].id;
  await H.asAdmin(db);
  await db.query('update app.devices set revoked_at = now() where id = $1', [dev]);
  await H.asUser(db, H.USER_A);
  const un = await H.tryQuery(db, 'update app.devices set revoked_at = null where id = $1', [dev]);
  assert.equal(un.ok, false); assert.match(un.error, /permission denied/);
  const forge = await H.tryQuery(db, 'update app.devices set last_sync_rev = 999 where id = $1', [dev]);
  assert.equal(forge.ok, false, 'last_sync_rev réservé au serveur');
  const preRevoked = await H.tryQuery(db, "insert into app.devices (user_id, platform, revoked_at) values ($1, 'web', null)", [H.USER_A]);
  assert.equal(preRevoked.ok, false, 'revoked_at non inscriptible à la création');
  // Les champs légitimes restent modifiables
  assert.equal((await db.query("update app.devices set label = 'Mon téléphone', last_seen_at = now() where id = $1", [dev])).affectedRows, 1);
  await H.asAdmin(db);
  assert.ok((await db.query('select revoked_at from app.devices where id = $1', [dev])).rows[0].revoked_at, 'révocation intacte');
});

test('D2 : field_revs limité à 16 Ko', async () => {
  await H.asUser(db, H.USER_A);
  const big = await H.tryQuery(db, "insert into app.copies (user_id, id, field_revs) values ($1, 's_fr', $2)", [H.USER_A, JSON.stringify({ x: 'y'.repeat(20000) })]);
  assert.equal(big.ok, false); assert.match(big.error, /copies_field_revs_size/);
  const ok = await H.tryQuery(db, "insert into app.copies (user_id, id, field_revs) values ($1, 's_fr', $2)", [H.USER_A, JSON.stringify({ grade: 3, notes: 4 })]);
  assert.equal(ok.ok, true);
  await H.asAdmin(db);
  const n = (await db.query("select count(*)::int n from pg_constraint where conname like '%\\_field_revs_size' and connamespace = 'app'::regnamespace")).rows[0].n;
  assert.equal(n, 5);
});

test('D3 : colonnes extraites bornées, erreur explicite', async () => {
  await H.asUser(db, H.USER_A);
  const cases = [
    ['copies', 'issue_number', 51, /copies_issue_number_len/],
    ['copies', 'series_key', 301, /copies_series_key_len/],
    ['locations', 'kind', 41, /locations_kind_len/],
    ['locations', 'parent_id', 101, /locations_parent_id_len/],
    ['pulls', 'series_key', 301, /pulls_series_key_len/],
    ['reading_progress', 'guide_id', 101, /reading_progress_guide_id_len/],
    ['reading_progress', 'entry_id', 101, /reading_progress_entry_id_len/]
  ];
  for (const [t, col, len, re] of cases) {
    const r = await H.tryQuery(db, `insert into app.${t} (user_id, id, ${col}) values ($1, $2, $3)`, [H.USER_A, `x_${col}`, 'k'.repeat(len)]);
    assert.equal(r.ok, false, `${t}.${col}`); assert.match(r.error, re);
    const ok = await H.tryQuery(db, `insert into app.${t} (user_id, id, ${col}) values ($1, $2, $3)`, [H.USER_A, `x_${col}`, 'k'.repeat(len - 1)]);
    assert.equal(ok.ok, true, `${t}.${col} à la limite`);
  }
  await H.asAdmin(db);
});

test('rev (security definer) : une tentative sur la ligne d\'autrui ne touche pas son compteur', async () => {
  await H.asUser(db, H.USER_B);
  await db.query("insert into app.copies (user_id, id) values ($1, 's_b')", [H.USER_B]);
  const before = await lastRev(H.USER_B);
  await H.asUser(db, H.USER_A);
  const attempts = [
    ["insert into app.copies (user_id, id) values ($1, 's_new')", [H.USER_B]],
    ["insert into app.copies (user_id, id) values ($1, 's_b') on conflict (user_id, id) do update set data = '{\"p\":1}'", [H.USER_B]],
    ["update app.copies set data = '{\"p\":1}' where user_id = $1", [H.USER_B]]
  ];
  for (const [sql, p] of attempts) await H.tryQuery(db, sql, p);
  assert.equal(await lastRev(H.USER_B), before, 'compteur de B inchangé');
  const data = (await db.query("select data from app.copies where user_id = $1 and id = 's_b'", [H.USER_B])).rows[0].data;
  assert.deepEqual(data, {}, 'ligne de B inchangée');
});

test('rev : une transaction annulée ne consomme aucune révision et ne laisse aucune ligne', async () => {
  const before = await lastRev(H.USER_A);
  await H.asUser(db, H.USER_A);
  await db.exec('begin');
  await db.query("insert into app.pulls (user_id, id) values ($1, 'pl_rb1')", [H.USER_A]);
  await db.query("insert into app.pulls (user_id, id) values ($1, 'pl_rb2')", [H.USER_A]);
  await db.exec('rollback');
  assert.equal(await lastRev(H.USER_A), before);
  await H.asUser(db, H.USER_A);
  assert.equal((await db.query("select count(*)::int n from app.pulls where id like 'pl_rb%'")).rows[0].n, 0);
  // Une instruction en échec au milieu d'une transaction : tout est annulé, sans trou
  await db.exec('begin');
  await db.query("insert into app.pulls (user_id, id) values ($1, 'pl_rb3')", [H.USER_A]);
  const bad = await H.tryQuery(db, "insert into app.pulls (user_id, id, schema_version) values ($1, 'pl_rb4', 0)", [H.USER_A]);
  assert.equal(bad.ok, false);
  await db.exec('rollback');
  assert.equal(await lastRev(H.USER_A), before);
});

test('rev : plusieurs écritures dans une transaction reçoivent des révisions distinctes et consécutives', async () => {
  const before = await lastRev(H.USER_A);
  await H.asUser(db, H.USER_A);
  await db.exec('begin');
  const revs = [];
  for (const id of ['tx1', 'tx2', 'tx3']) revs.push(Number((await db.query('insert into app.series_follows (user_id, id) values ($1, $2) returning rev', [H.USER_A, id])).rows[0].rev));
  await db.exec('commit');
  assert.deepEqual(revs, [before + 1, before + 2, before + 3]);
});

test('pierre tombale : marquer deleted_at attribue une nouvelle révision (détectable par un curseur)', async () => {
  await H.asUser(db, H.USER_A);
  const r0 = Number((await db.query("insert into app.locations (user_id, id) values ($1, 'loc_t') returning rev", [H.USER_A])).rows[0].rev);
  const r1 = Number((await db.query("update app.locations set deleted_at = now() where id = 'loc_t' returning rev")).rows[0].rev);
  assert.ok(r1 > r0);
  const since = (await db.query('select id, deleted_at from app.locations where rev > $1', [r0])).rows;
  assert.ok(since.some(x => x.id === 'loc_t' && x.deleted_at), 'la suppression logique apparaît après le curseur');
  await H.asAdmin(db);
});

test('constat 3.4 : une suppression physique reste possible et n\'est PAS visible par un curseur rev', async () => {
  // Documente le risque résiduel : le lot 3.4 doit imposer les pierres tombales (voir docs/phase3/09).
  await H.asUser(db, H.USER_A);
  const r0 = Number((await db.query("insert into app.locations (user_id, id) values ($1, 'loc_h') returning rev", [H.USER_A])).rows[0].rev);
  assert.equal((await db.query("delete from app.locations where id = 'loc_h'")).affectedRows, 1);
  const since = (await db.query('select id from app.locations where rev > $1', [r0])).rows;
  assert.equal(since.some(x => x.id === 'loc_h'), false);
  await H.asAdmin(db);
});

test('privilèges : anon n\'a aucun droit sur aucune table, authenticated seulement ceux prévus', async () => {
  await H.asAdmin(db);
  const r = await db.query(`select c.relname,
      has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger') anon_any,
      has_table_privilege('authenticated', c.oid, 'truncate,references,trigger') auth_extra,
      has_table_privilege('authenticated', c.oid, 'insert') auth_ins
    from pg_class c where c.relnamespace = 'app'::regnamespace and c.relkind = 'r'`);
  for (const x of r.rows) {
    assert.equal(x.anon_any, false, `anon sur ${x.relname}`);
    assert.equal(x.auth_extra, false, `truncate/references/trigger sur ${x.relname}`);
    if (['user_sync_state', 'sync_ops', 'sync_conflicts'].includes(x.relname)) assert.equal(x.auth_ins, false, x.relname);
  }
  const fn = await db.query("select proname from pg_proc where pronamespace = 'app'::regnamespace and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'))");
  assert.equal(fn.rows.length, 0, 'aucune fonction app exécutable par un client');
});
