'use strict';
// Critères 2 et 3 : tables, colonnes, types, contraintes, index, clés étrangères en cascade.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

let db;
test.before(async () => { db = await H.freshDb(); await H.createUsers(db, H.USER_A); });
test.after(async () => { await db.close(); });

const COMMON = ['user_id', 'id', 'data', 'field_revs', 'rev', 'deleted_at', 'created_at', 'updated_at', 'updated_by_device', 'schema_version'];
const EXPECTED_COLUMNS = {
  profiles: ['user_id', 'handle', 'display_name', 'avatar_path', 'bio', 'locale', 'preferred_market', 'created_at', 'updated_at'],
  user_settings: ['user_id', 'prefs', 'notifications', 'privacy', 'rev', 'updated_at'],
  devices: ['id', 'user_id', 'label', 'platform', 'app_version', 'created_at', 'last_seen_at', 'last_sync_rev', 'revoked_at'],
  copies: [...COMMON, 'series_key', 'issue_number', 'is_wishlist'],
  locations: [...COMMON, 'parent_id', 'kind'],
  pulls: [...COMMON, 'series_key', 'release_date'],
  series_follows: [...COMMON],
  reading_progress: [...COMMON, 'guide_id', 'entry_id'],
  reading_states: [...COMMON],
  user_sync_state: ['user_id', 'last_rev', 'purged_below_rev'],
  sync_ops: ['user_id', 'op_id', 'applied_rev', 'result', 'created_at'],
  sync_conflicts: ['id', 'user_id', 'entity', 'entity_id', 'field', 'local_value', 'server_value', 'base_rev', 'server_rev', 'device_id', 'created_at', 'resolved_at', 'resolution']
};

test('le schéma app contient exactement les 12 tables prévues', async () => {
  const r = await db.query("select table_name from information_schema.tables where table_schema = 'app' order by 1");
  assert.deepEqual(r.rows.map(x => x.table_name), [...H.APP_TABLES].sort());
});

test('aucun schéma réservé (catalog, editorial, media, signals, community) n\'est créé', async () => {
  const r = await db.query("select nspname from pg_namespace where nspname in ('catalog','editorial','media','signals','community')");
  assert.equal(r.rows.length, 0);
});

for (const [table, cols] of Object.entries(EXPECTED_COLUMNS)) {
  test(`colonnes de app.${table}`, async () => {
    const r = await db.query("select column_name from information_schema.columns where table_schema = 'app' and table_name = $1", [table]);
    assert.deepEqual(r.rows.map(x => x.column_name).sort(), [...cols].sort());
  });
}

test('types des colonnes de synchronisation', async () => {
  const r = await db.query(`select column_name, data_type, udt_name from information_schema.columns
    where table_schema = 'app' and table_name = 'copies'`);
  const t = Object.fromEntries(r.rows.map(x => [x.column_name, x.udt_name]));
  assert.equal(t.user_id, 'uuid'); assert.equal(t.id, 'text'); assert.equal(t.data, 'jsonb');
  assert.equal(t.field_revs, 'jsonb'); assert.equal(t.rev, 'int8'); assert.equal(t.deleted_at, 'timestamptz');
  assert.equal(t.schema_version, 'int2'); assert.equal(t.updated_by_device, 'uuid');
  const h = await db.query("select udt_name from information_schema.columns where table_schema='app' and table_name='profiles' and column_name='handle'");
  assert.equal(h.rows[0].udt_name, 'citext');
});

test('clés primaires (user_id, id) sur les tables synchronisées', async () => {
  for (const t of H.SYNC_TABLES) {
    const r = await db.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = ('app.' || $1)::regclass and i.indisprimary order by array_position(i.indkey::int2[], a.attnum)`, [t]);
    assert.deepEqual(r.rows.map(x => x.attname), ['user_id', 'id'], t);
  }
});

test('index (user_id, rev) et index des politiques présents', async () => {
  const r = await db.query("select indexname, indexdef from pg_indexes where schemaname = 'app'");
  const names = r.rows.map(x => x.indexname);
  for (const t of H.SYNC_TABLES) assert.ok(names.includes(`${t}_user_rev_idx`), t);
  for (const n of ['devices_user_id_idx', 'sync_ops_created_at_idx', 'sync_conflicts_user_resolved_idx', 'profiles_handle_key']) assert.ok(names.includes(n), n);
  // Toute table : user_id est la première colonne d'au moins un index (colonne lue par les politiques).
  for (const t of H.APP_TABLES) {
    const ok = r.rows.some(x => x.indexdef.includes(`ON app.${t} `) && /\((user_id)[,)]/.test(x.indexdef));
    assert.ok(ok, `index sur user_id pour ${t}`);
  }
});

test('toutes les clés étrangères vers auth.users sont en cascade', async () => {
  const r = await db.query(`select conrelid::regclass::text as tbl, confdeltype from pg_constraint
    where contype = 'f' and connamespace = 'app'::regnamespace`);
  assert.equal(r.rows.length, 12);
  for (const x of r.rows) assert.equal(x.confdeltype, 'c', x.tbl);
});

test('contraintes : data > 64 Ko refusé', async () => {
  const big = JSON.stringify({ blob: 'x'.repeat(66000) });
  const r = await H.tryQuery(db, 'insert into app.copies (user_id, id, data) values ($1, $2, $3)', [H.USER_A, 's_big', big]);
  assert.equal(r.ok, false); assert.match(r.error, /copies_data_size/);
});

test('contraintes : id vide ou > 100 caractères refusé', async () => {
  for (const id of ['', 'x'.repeat(101)]) {
    const r = await H.tryQuery(db, 'insert into app.locations (user_id, id) values ($1, $2)', [H.USER_A, id]);
    assert.equal(r.ok, false); assert.match(r.error, /locations_id_check/);
  }
  const ok = await H.tryQuery(db, 'insert into app.locations (user_id, id) values ($1, $2)', [H.USER_A, 'x'.repeat(100)]);
  assert.equal(ok.ok, true);
});

test('contraintes : schema_version < 1 refusé', async () => {
  const r = await H.tryQuery(db, 'insert into app.pulls (user_id, id, schema_version) values ($1, $2, 0)', [H.USER_A, 'pl_1']);
  assert.equal(r.ok, false); assert.match(r.error, /pulls_schema_version_check/);
});

test('contraintes : platform limité à web et android', async () => {
  const bad = await H.tryQuery(db, "insert into app.devices (user_id, platform) values ($1, 'ios')", [H.USER_A]);
  assert.equal(bad.ok, false);
  const good = await H.tryQuery(db, "insert into app.devices (user_id, platform) values ($1, 'android')", [H.USER_A]);
  assert.equal(good.ok, true);
});

test('contraintes : handle unique sans tenir compte de la casse (citext)', async () => {
  await H.createUsers(db, H.USER_B);
  assert.equal((await H.tryQuery(db, "insert into app.profiles (user_id, handle) values ($1, 'Lecteur_Un')", [H.USER_A])).ok, true);
  const dup = await H.tryQuery(db, "insert into app.profiles (user_id, handle) values ($1, 'lecteur_un')", [H.USER_B]);
  assert.equal(dup.ok, false); assert.match(dup.error, /profiles_handle_key/);
});

test('confidentialité : privacy privé par défaut', async () => {
  await db.query('insert into app.user_settings (user_id) values ($1)', [H.USER_A]);
  const r = await db.query('select privacy from app.user_settings where user_id = $1', [H.USER_A]);
  assert.deepEqual(r.rows[0].privacy, { profile_public: false });
});

test('suppression d\'un utilisateur : 0 ligne restante dans les 12 tables', async () => {
  const U = '33333333-3333-4333-8333-333333333333';
  await H.createUsers(db, U);
  for (const t of H.APP_TABLES) { const s = H.sampleRow(t, U); await db.query(s.sql, s.params); }
  for (const t of H.APP_TABLES) {
    const n = (await db.query(`select count(*)::int n from app.${t} where user_id = $1`, [U])).rows[0].n;
    assert.ok(n >= 1, `ligne créée dans ${t}`);
  }
  await db.query('delete from auth.users where id = $1', [U]);
  for (const t of H.APP_TABLES) {
    const n = (await db.query(`select count(*)::int n from app.${t} where user_id = $1`, [U])).rows[0].n;
    assert.equal(n, 0, t);
  }
});
