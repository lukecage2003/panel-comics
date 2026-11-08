'use strict';
// Lot 3.7 (local) : V8 approché — sauvegarde complète du répertoire de données PGlite puis restauration dans une base neuve.
// Ce n'est PAS un pg_dump / pg_restore sur Supabase (non réalisable sans projet) : on vérifie que comptes, lignes, révisions,
// pierres tombales, politiques RLS et fonctions survivent à une restauration physique, empreintes comparées table par table.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { PGlite } = require('@electric-sql/pglite');
const { citext } = require('@electric-sql/pglite/contrib/citext');
const H = require('./harness');

const fingerprint = async db => {
  await H.asAdmin(db);
  const out = {};
  for (const t of H.APP_TABLES.concat(['staff_roles'])) {
    const rows = (await db.query(`select to_jsonb(x) j from app.${t} x order by 1`)).rows.map(r => JSON.stringify(r.j)).sort();
    out[t] = crypto.createHash('sha256').update(rows.join('\n')).digest('hex').slice(0, 16) + ':' + rows.length;
  }
  out.policies = (await db.query("select count(*)::int n from pg_policies where schemaname = 'app'")).rows[0].n;
  out.apiFunctions = (await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'api'")).rows[0].n;
  out.users = (await db.query('select count(*)::int n from auth.users')).rows[0].n;
  return out;
};

test('V8 (approché, PGlite) : restauration physique — empreintes identiques, RLS et synchronisation fonctionnelles après restauration', async () => {
  const db = await H.freshDb();
  await H.createUsers(db, H.USER_A, H.USER_B);
  await H.asUser(db, H.USER_A);
  const dev = (await db.query("select api.register_device('A', 'web') id")).rows[0].id;
  const ops = [];
  for (let i = 0; i < 6; i++) ops.push({ op_id: crypto.randomUUID(), entity: 'copies', id: 'r_' + i, kind: 'upsert', base_rev: 0, patch: { n: i, series: 'Saga' }, schema_version: 1 });
  ops.push({ op_id: crypto.randomUUID(), entity: 'pulls', id: 'p_1', kind: 'upsert', base_rev: 0, patch: { series: 'Saga' }, schema_version: 1 });
  assert.equal((await db.query('select api.sync_push($1, $2::jsonb, false) r', [dev, JSON.stringify(ops)])).rows[0].r.status, 'ok');
  const rev = Number((await db.query("select rev from app.copies where id = 'r_0'")).rows[0].rev);
  await db.query('select api.sync_push($1, $2::jsonb, false) r', [dev, JSON.stringify([{ op_id: crypto.randomUUID(), entity: 'copies', id: 'r_0', kind: 'delete', base_rev: rev, schema_version: 1 }])]);
  await H.asUser(db, H.USER_B);
  await db.query("select api.register_device('B', 'android')");
  const before = await fingerprint(db);
  const dump = await db.dumpDataDir('gzip');
  await db.close();

  const restored = new PGlite({ loadDataDir: dump, extensions: { citext } });
  await restored.waitReady;
  try {
    assert.deepEqual(await fingerprint(restored), before, 'empreintes identiques après restauration');
    await H.asUser(restored, H.USER_B);
    assert.equal((await restored.query('select count(*)::int n from app.copies')).rows[0].n, 0, 'RLS : B ne voit rien de A après restauration');
    await H.asUser(restored, H.USER_A);
    const pull = (await restored.query('select api.sync_pull(0, 500) r')).rows[0].r;
    assert.ok(pull.rows.find(r => r.id === 'r_0' && r.deleted_at), 'pierre tombale conservée');
    const res = (await restored.query('select api.sync_push($1, $2::jsonb, false) r', [dev, JSON.stringify([{ op_id: crypto.randomUUID(), entity: 'copies', id: 'r_9', kind: 'upsert', base_rev: 0, patch: { n: 9 }, schema_version: 1 }])])).rows[0].r;
    assert.equal(res.status, 'ok', 'synchronisation reprise après restauration');
  } finally { await restored.close(); }
});
