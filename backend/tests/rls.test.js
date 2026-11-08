'use strict';
// Critères 4 et 11 : isolation entre deux utilisateurs, anonyme refusé, test positif et négatif par politique,
// et vérification par mutation (RLS désactivée ⇒ le test d'isolation détecte la fuite).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

const PERSONAL = ['profiles', 'user_settings', 'devices', ...H.SYNC_TABLES];
const TECHNICAL = ['user_sync_state', 'sync_ops', 'sync_conflicts'];

let db;
test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, H.USER_A, H.USER_B);
  // Chaque utilisateur possède au moins une ligne dans chaque table (insertion en administrateur pour les tables techniques).
  for (const uid of [H.USER_A, H.USER_B]) {
    for (const t of TECHNICAL) { const s = H.sampleRow(t, uid); await db.query(s.sql, s.params); }
  }
});
test.after(async () => { await db.close(); });

// Nombre de lignes de « other » visibles pour l'utilisateur courant.
const foreignVisible = async (table, other) => (await db.query(`select count(*)::int n from app.${table} where user_id = $1`, [other])).rows[0].n;

test('RLS activée sur 100 % des tables du schéma app', async () => {
  await H.asAdmin(db);
  const r = await db.query(`select c.relname, c.relrowsecurity from pg_class c
    where c.relnamespace = 'app'::regnamespace and c.relkind = 'r'`);
  assert.equal(r.rows.length, 11);
  for (const x of r.rows) assert.equal(x.relrowsecurity, true, x.relname);
});

test('les rôles de test ne contournent pas la RLS', async () => {
  const r = await db.query("select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('anon','authenticated')");
  assert.equal(r.rows.length, 2);
  for (const x of r.rows) { assert.equal(x.rolsuper, false); assert.equal(x.rolbypassrls, false); }
});

for (const t of PERSONAL) {
  test(`${t} : A crée, lit, modifie et supprime ses lignes (positif)`, async () => {
    await H.asUser(db, H.USER_A);
    const s = H.sampleRow(t, H.USER_A, 7);
    assert.equal((await H.tryQuery(db, s.sql, s.params)).ok, true, 'insert');
    const own = (await db.query(`select count(*)::int n from app.${t} where user_id = $1`, [H.USER_A])).rows[0].n;
    assert.ok(own >= 1, 'select');
    const col = t === 'profiles' ? 'display_name' : t === 'user_settings' ? 'prefs' : t === 'devices' ? 'label' : 'data';
    const val = col === 'prefs' || col === 'data' ? "'{\"v\": 2}'::jsonb" : "'modifié'";
    const up = await db.query(`update app.${t} set ${col} = ${val} where user_id = $1`, [H.USER_A]);
    assert.ok(up.affectedRows >= 1, 'update');
    // B crée aussi ses propres lignes (pour les tests négatifs)
    await H.asUser(db, H.USER_B);
    const sb = H.sampleRow(t, H.USER_B, 8);
    assert.equal((await H.tryQuery(db, sb.sql, sb.params)).ok, true, 'insert B');
  });

  test(`${t} : A ne lit, ne modifie ni ne supprime aucune ligne de B (négatif)`, async () => {
    await H.asUser(db, H.USER_A);
    assert.equal(await foreignVisible(t, H.USER_B), 0, 'select');
    const all = (await db.query(`select count(*)::int n from app.${t}`)).rows[0].n;
    const own = (await db.query(`select count(*)::int n from app.${t} where user_id = $1`, [H.USER_A])).rows[0].n;
    assert.equal(all, own, 'select sans filtre = seulement ses lignes');
    const col = t === 'profiles' ? 'display_name' : t === 'user_settings' ? 'prefs' : t === 'devices' ? 'label' : 'data';
    const val = col === 'prefs' || col === 'data' ? "'{\"pirate\": true}'::jsonb" : "'pirate'";
    assert.equal((await db.query(`update app.${t} set ${col} = ${val} where user_id = $1`, [H.USER_B])).affectedRows, 0, 'update');
    assert.equal((await db.query(`delete from app.${t} where user_id = $1`, [H.USER_B])).affectedRows, 0, 'delete');
    // Insertion au nom de B refusée
    const s = H.sampleRow(t, H.USER_B, 9);
    const ins = await H.tryQuery(db, s.sql, s.params);
    assert.equal(ins.ok, false, 'insert au nom de B'); assert.match(ins.error, /row-level security/);
    // Transfert d'une ligne de A vers B refusé
    const mv = await H.tryQuery(db, `update app.${t} set user_id = $1 where user_id = $2`, [H.USER_B, H.USER_A]);
    assert.equal(mv.ok, false, 'transfert vers B');
    // Vérification administrateur : les lignes de B sont intactes
    await H.asAdmin(db);
    assert.ok((await db.query(`select count(*)::int n from app.${t} where user_id = $1`, [H.USER_B])).rows[0].n >= 1);
  });

  test(`${t} : anon ne voit rien et ne peut rien écrire`, async () => {
    await H.asAnon(db);
    const sel = await H.tryQuery(db, `select count(*) from app.${t}`);
    assert.equal(sel.ok, false); assert.match(sel.error, /permission denied/);
    const s = H.sampleRow(t, H.USER_A, 10);
    const ins = await H.tryQuery(db, s.sql, s.params);
    assert.equal(ins.ok, false); assert.match(ins.error, /permission denied/);
    await H.asAdmin(db);
  });
}

for (const t of TECHNICAL) {
  test(`${t} : lecture seule de ses propres lignes (positif et négatif)`, async () => {
    await H.asUser(db, H.USER_A);
    assert.ok((await db.query(`select count(*)::int n from app.${t}`)).rows[0].n >= 1, 'lit ses lignes');
    assert.equal(await foreignVisible(t, H.USER_B), 0, 'ne lit pas celles de B');
    const s = H.sampleRow(t, H.USER_A, 11);
    const ins = await H.tryQuery(db, s.sql.replace(' on conflict do nothing', ''), s.params);
    assert.equal(ins.ok, false, 'insert refusé'); assert.match(ins.error, /permission denied/);
    const up = await H.tryQuery(db, `update app.${t} set user_id = user_id where user_id = $1`, [H.USER_A]);
    assert.equal(up.ok, false, 'update refusé');
    const del = await H.tryQuery(db, `delete from app.${t} where user_id = $1`, [H.USER_A]);
    assert.equal(del.ok, false, 'delete refusé');
    await H.asAnon(db);
    assert.equal((await H.tryQuery(db, `select 1 from app.${t}`)).ok, false, 'anon refusé');
    await H.asAdmin(db);
  });
}

test('sans jeton (authenticated sans sub), aucune ligne visible', async () => {
  await H.asAdmin(db);
  await db.exec('set role authenticated');
  for (const t of PERSONAL) assert.equal((await db.query(`select count(*)::int n from app.${t}`)).rows[0].n, 0, t);
  await H.asAdmin(db);
});

test('mutation : RLS désactivée sur une table ⇒ le test d\'isolation échoue (fuite détectée)', async () => {
  for (const t of ['copies', 'user_sync_state']) {
    await H.asAdmin(db);
    await db.exec(`alter table app.${t} disable row level security`);
    try {
      await H.asUser(db, H.USER_A);
      assert.ok(await foreignVisible(t, H.USER_B) > 0, `${t} : sans RLS, A voit les lignes de B (le test d'isolation serait rouge)`);
    } finally {
      await H.asAdmin(db);
      await db.exec(`alter table app.${t} enable row level security`);
    }
    await H.asUser(db, H.USER_A);
    assert.equal(await foreignVisible(t, H.USER_B), 0, `${t} : RLS réactivée`);
  }
  await H.asAdmin(db);
  const r = await db.query("select count(*)::int n from pg_class where relnamespace = 'app'::regnamespace and relkind = 'r' and not relrowsecurity");
  assert.equal(r.rows[0].n, 0, 'aucune table laissée sans RLS');
});
