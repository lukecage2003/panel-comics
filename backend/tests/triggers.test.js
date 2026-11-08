'use strict';
// Critère 5 : rev strictement croissant par utilisateur, indépendant entre utilisateurs ; updated_at.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

let db;
test.before(async () => { db = await H.freshDb(); await H.createUsers(db, H.USER_A, H.USER_B); });
test.after(async () => { await db.close(); });

test('rev strictement croissant sur 1 000 écritures (insertions et mises à jour, toutes tables)', async () => {
  await H.asUser(db, H.USER_A);
  const revs = [];
  for (let i = 0; i < 1000; i++) {
    const t = H.SYNC_TABLES[i % H.SYNC_TABLES.length];
    const id = `w_${i % 200}`;
    const r = await db.query(`insert into app.${t} (user_id, id, data) values ($1, $2, $3)
      on conflict (user_id, id) do update set data = excluded.data returning rev`, [H.USER_A, id, JSON.stringify({ i })]);
    revs.push(Number(r.rows[0].rev));
  }
  for (let i = 1; i < revs.length; i++) assert.ok(revs[i] > revs[i - 1], `rev ${i}`);
  assert.equal(revs[0], 1);
  // Les 200 premières écritures sont des insertions simples : aucune révision sautée.
  assert.equal(revs[199], 200);
  // Un upsert en conflit (INSERT … ON CONFLICT DO UPDATE) déclenche BEFORE INSERT puis BEFORE UPDATE :
  // il consomme deux révisions (trou toléré par le protocole : le curseur since_rev reste valide). Documenté pour le lot 3.4.
  assert.equal(revs[999], 200 + 800 * 2);
  const st = (await db.query('select last_rev from app.user_sync_state where user_id = $1', [H.USER_A])).rows[0];
  assert.equal(Number(st.last_rev), revs[999], 'last_rev = dernière révision attribuée');
});

test('rev indépendant entre deux utilisateurs', async () => {
  await H.asUser(db, H.USER_B);
  const r1 = await db.query("insert into app.copies (user_id, id) values ($1, 's_b1') returning rev", [H.USER_B]);
  const r2 = await db.query("insert into app.pulls (user_id, id) values ($1, 'pl_b1') returning rev", [H.USER_B]);
  assert.equal(Number(r1.rows[0].rev), 1); assert.equal(Number(r2.rows[0].rev), 2);
  await H.asAdmin(db);
  const a = (await db.query('select last_rev from app.user_sync_state where user_id = $1', [H.USER_A])).rows[0];
  assert.equal(Number(a.last_rev), 1800, 'A inchangé par les écritures de B');
});

test('rev fourni par le client ignoré (le serveur décide)', async () => {
  await H.asUser(db, H.USER_B);
  const r = await db.query("insert into app.copies (user_id, id, rev) values ($1, 's_b2', 999999) returning rev", [H.USER_B]);
  assert.equal(Number(r.rows[0].rev), 3);
  const u = await db.query("update app.copies set rev = 1 where user_id = $1 and id = 's_b2' returning rev", [H.USER_B]);
  assert.equal(Number(u.rows[0].rev), 4);
  await H.asAdmin(db);
});

test('user_settings reçoit aussi une rev', async () => {
  await H.asUser(db, H.USER_B);
  const r = await db.query('insert into app.user_settings (user_id) values ($1) returning rev', [H.USER_B]);
  assert.equal(Number(r.rows[0].rev), 5);
  await H.asAdmin(db);
});

test('updated_at mis à jour, created_at conservé', async () => {
  await H.asUser(db, H.USER_B);
  const before = (await db.query("select created_at, updated_at from app.copies where user_id = $1 and id = 's_b1'", [H.USER_B])).rows[0];
  await new Promise(r => setTimeout(r, 15));
  await db.query("update app.copies set data = '{\"x\":1}', created_at = '2000-01-01' where user_id = $1 and id = 's_b1'", [H.USER_B]);
  const after = (await db.query("select created_at, updated_at from app.copies where user_id = $1 and id = 's_b1'", [H.USER_B])).rows[0];
  assert.equal(new Date(after.created_at).getTime(), new Date(before.created_at).getTime(), 'created_at conservé');
  assert.ok(new Date(after.updated_at) > new Date(before.updated_at), 'updated_at avancé');
  await H.asAdmin(db);
});

test('la fonction rev est security definer avec search_path vide', async () => {
  const r = await db.query("select prosecdef, proconfig from pg_proc where proname = 'assign_rev' and pronamespace = 'app'::regnamespace");
  assert.equal(r.rows[0].prosecdef, true);
  assert.ok((r.rows[0].proconfig || []).some(c => /^search_path=("")?$/.test(c)), JSON.stringify(r.rows[0].proconfig));
  // Non appelable directement par un utilisateur
  await H.asUser(db, H.USER_A);
  const call = await H.tryQuery(db, 'select app.assign_rev()');
  assert.equal(call.ok, false);
  await H.asAdmin(db);
});
