'use strict';
// Critère 2 : application dans l'ordre sur une base vide ; rejeu à vide déterministe ; conventions ; seed fictif.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const MIG_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

// Empreinte du schéma app : tables, colonnes, contraintes, index, politiques, déclencheurs.
async function fingerprint(db) {
  const q = async sql => (await db.query(sql)).rows.map(r => JSON.stringify(r)).join('\n');
  return [
    await q("select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'app' order by 1, 2"),
    await q("select conrelid::regclass::text t, conname, pg_get_constraintdef(oid) d from pg_constraint where connamespace = 'app'::regnamespace order by 1, 2"),
    await q("select indexname, indexdef from pg_indexes where schemaname = 'app' order by 1"),
    await q("select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname = 'app' order by 1, 2"),
    await q("select event_object_table, trigger_name, action_timing, event_manipulation from information_schema.triggers where trigger_schema = 'app' order by 1, 2, 4")
  ].join('\n---\n');
}

test('quatorze migrations horodatées, dans l\'ordre attendu', () => {
  assert.deepEqual(H.migrationFiles(), [
    '20261107000001_app_schema.sql',
    '20261107000002_profiles_settings_devices.sql',
    '20261107000003_personal_domains.sql',
    '20261107000004_sync_tables.sql',
    '20261107000005_rls_policies.sql',
    '20261107000006_rev_triggers.sql',
    '20261108000007_hardening.sql',
    '20261109000008_sync_rpc.sql',
    '20261109000009_privacy_purge.sql',
    '20261110000010_roles_profile_devices.sql',
    '20261110000011_conflict_resolution.sql',
    '20261110000012_limits_purge_account.sql',
    '20261114000013_community_moderation.sql',
    '20261120000014_social_notes_live.sql',
    '20261121000015_live_cohosts.sql',
    '20261121000016_moderation_terms.sql'
  ]);
});

test('les migrations ne créent pas le schéma auth (fourni par Supabase) et ne contiennent aucune instruction destructive', () => {
  for (const f of H.migrationFiles()) {
    const sql = fs.readFileSync(path.join(MIG_DIR, f), 'utf8').replace(/--.*$/gm, '');
    assert.doesNotMatch(sql, /create\s+(schema|table|function)\s+auth\b|create\s+table\s+auth\./i, f);
    assert.doesNotMatch(sql, /\b(drop\s+(table|schema)|truncate)\b/i, f);
    assert.doesNotMatch(sql, /create\s+schema\s+(if\s+not\s+exists\s+)?(catalog|editorial|media|signals)\b/i, f);
  }
});

test('application sur une base vide, puis rejeu à vide identique (déterministe)', async () => {
  const a = await H.freshDb();
  const b = await H.freshDb();
  const fa = await fingerprint(a), fb = await fingerprint(b);
  assert.ok(fa.length > 1000);
  assert.equal(fa, fb);
  await a.close(); await b.close();
});

test('chaque migration s\'applique séparément dans l\'ordre (sans la suivante)', async () => {
  const db = await H.freshDb({ migrations: false });
  for (const f of H.migrationFiles()) {
    await db.exec(fs.readFileSync(path.join(MIG_DIR, f), 'utf8'));
    const n = (await db.query("select count(*)::int n from information_schema.tables where table_schema = 'app'")).rows[0].n;
    assert.ok(n >= 0, f);
  }
  const n = (await db.query("select count(*)::int n from information_schema.tables where table_schema = 'app'")).rows[0].n;
  assert.equal(n, 15);
  await db.close();
});

test('un rejeu sur une base déjà migrée échoue proprement sans rien abîmer (pas d\'application double)', async () => {
  const db = await H.freshDb();
  const before = await fingerprint(db);
  const first = H.migrationFiles()[1];
  let failed = false;
  try { await db.exec(fs.readFileSync(path.join(MIG_DIR, first), 'utf8')); } catch (_) { failed = true; }
  assert.equal(failed, true, 'une migration déjà appliquée ne doit pas passer silencieusement');
  assert.equal(await fingerprint(db), before);
  await db.close();
});

test('sauvegarde puis restauration locale (PGlite dumpDataDir / loadDataDir) : données, RLS et révisions intactes', async () => {
  const { PGlite } = require('@electric-sql/pglite');
  const { citext } = require('@electric-sql/pglite/contrib/citext');
  const db = await H.freshDb({ seed: true });
  await H.createUsers(db, H.USER_A);
  // Écritures en administrateur : depuis la migration 8, un client n'écrit plus directement (api.sync_push)
  for (let i = 0; i < 5; i++) await db.query('insert into app.copies (user_id, id, data) values ($1, $2, $3)', [H.USER_A, `s_r${i}`, JSON.stringify({ i })]);
  await H.asAdmin(db);
  const before = await fingerprint(db);
  const rows = JSON.stringify((await db.query('select user_id, id, data, rev from app.copies order by 1, 2')).rows);
  const dump = await db.dumpDataDir('gzip');
  await db.close();
  const restored = new PGlite({ loadDataDir: dump, extensions: { citext } });
  assert.equal(await fingerprint(restored), before, 'schéma identique');
  assert.equal(JSON.stringify((await restored.query('select user_id, id, data, rev from app.copies order by 1, 2')).rows), rows, 'données identiques');
  await H.asUser(restored, H.USER_A);
  assert.equal((await restored.query('select count(*)::int n from app.copies')).rows[0].n, 5, 'RLS active après restauration');
  await H.asAdmin(restored);
  const r = await restored.query("insert into app.copies (user_id, id) values ($1, 's_after') returning rev", [H.USER_A]);
  assert.equal(Number(r.rows[0].rev), 6, 'la séquence rev reprend où elle s\'était arrêtée');
  await restored.close();
});

test('seed : données fictives seulement, chargées sans erreur', async () => {
  const seed = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'seed.sql'), 'utf8');
  for (const m of seed.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []) assert.match(m, /@exemple\.test$/, m);
  const db = await H.freshDb({ seed: true });
  const n = (await db.query('select count(*)::int n from app.copies')).rows[0].n;
  assert.equal(n, 2);
  await db.close();
});

test('verify-supabase.sql : passe sur le schéma migré et détecte un écart', async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'verify-supabase.sql'), 'utf8');
  const db = await H.freshDb();
  await db.exec(sql);
  await db.exec('alter table app.pulls disable row level security');
  await assert.rejects(db.exec(sql), /RLS désactivée/);
  await db.exec('alter table app.pulls enable row level security');
  await db.exec('grant select on app.copies to anon');
  await assert.rejects(db.exec(sql), /anon a des droits/);
  await db.close();
});
