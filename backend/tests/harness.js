'use strict';
// Banc de tests de base de données sans Docker : PGlite (PostgreSQL en WebAssembly),
// schéma auth simulé, migrations appliquées dans l'ordre, rôles non privilégiés.
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { citext } = require('@electric-sql/pglite/contrib/citext');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const AUTH_STUB = path.join(__dirname, 'auth-stub.sql');

const APP_TABLES_31 = [
  'profiles', 'user_settings', 'devices',
  'copies', 'locations', 'pulls', 'series_follows', 'reading_progress',
  'user_sync_state', 'sync_ops', 'sync_conflicts'
];
// Lot 3.4 (migration 8) : état de lecture par œuvre (L1)
const APP_TABLES = APP_TABLES_31.concat(['reading_states']);
// Schéma du lot 3.1 (migrations 1 à 7) : écritures directes encore permises, avant leur retrait au lot 3.4 (T1, D-31)
const LOT_31 = 7;
const SYNC_TABLES = ['copies', 'locations', 'pulls', 'series_follows', 'reading_progress'];

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

const migrationFiles = () => fs.readdirSync(MIGRATIONS_DIR).filter(f => /^\d{14}_.+\.sql$/.test(f)).sort();

// Base neuve : stub auth + migrations (+ seed facultatif).
async function freshDb({ migrations = true, seed = false, upTo = Infinity } = {}) {
  const db = new PGlite({ extensions: { citext } });
  await db.exec(fs.readFileSync(AUTH_STUB, 'utf8'));
  if (migrations) {
    for (const f of migrationFiles().slice(0, upTo)) {
      try { await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')); }
      catch (e) { throw new Error(`Migration ${f} : ${e.message}`); }
    }
  }
  if (seed) await db.exec(fs.readFileSync(path.join(ROOT, 'supabase', 'seed.sql'), 'utf8'));
  return db;
}

// Contextes d'exécution : superutilisateur (administration du test), utilisateur authentifié, anonyme.
async function asAdmin(db) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
}
async function asUser(db, uid) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid.replace(/'/g, '')}', false); set role authenticated;`);
}
async function asAnon(db) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`);
}

async function createUsers(db, ...ids) {
  await asAdmin(db);
  for (const id of ids) await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id.slice(0, 4)}@exemple.test`]);
}

// Exécute une requête et renvoie l'erreur (ou null) sans lever d'exception.
async function tryQuery(db, sql, params) {
  try { const r = await db.query(sql, params); return { ok: true, rows: r.rows, affected: r.affectedRows }; }
  catch (e) { return { ok: false, error: e.message, code: e.code }; }
}

// Une ligne minimale valide par table, pour l'utilisateur donné.
function sampleRow(table, uid, n = 1) {
  switch (table) {
    case 'profiles': return { sql: 'insert into app.profiles (user_id, handle, display_name) values ($1, $2, $3)', params: [uid, `lecteur_${uid.slice(0, 4)}_${n}`, 'Lecteur'] };
    case 'user_settings': return { sql: 'insert into app.user_settings (user_id, prefs) values ($1, $2)', params: [uid, JSON.stringify({ theme: 'lime' })] };
    case 'devices': return { sql: "insert into app.devices (user_id, label, platform) values ($1, $2, 'web')", params: [uid, `Appareil ${n}`] };
    case 'user_sync_state': return { sql: 'insert into app.user_sync_state (user_id, last_rev) values ($1, 0) on conflict do nothing', params: [uid] };
    case 'sync_ops': return { sql: 'insert into app.sync_ops (user_id, op_id, applied_rev) values ($1, gen_random_uuid(), 1)', params: [uid] };
    case 'sync_conflicts': return { sql: "insert into app.sync_conflicts (user_id, entity, entity_id, field) values ($1, 'copies', 's_1', 'grade')", params: [uid] };
    default: return { sql: `insert into app.${table} (user_id, id, data) values ($1, $2, $3)`, params: [uid, `x_${n}`, JSON.stringify({ n })] };
  }
}

module.exports = { APP_TABLES_31, LOT_31, freshDb, asAdmin, asUser, asAnon, createUsers, tryQuery, sampleRow, migrationFiles, APP_TABLES, SYNC_TABLES, USER_A, USER_B };
