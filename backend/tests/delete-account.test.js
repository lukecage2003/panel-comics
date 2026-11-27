'use strict';
// Lot 3.6 (local, D-45) : logique de l'Edge Function delete-account, exécutée contre PGlite par de faux clients (pas de Supabase).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const H = require('./harness');
const { createDeleteAccountHandler, PHRASE } = require('../supabase/functions/delete-account/handler');

let db;
const TOKENS = { ['tok_' + 'a'.repeat(24)]: H.USER_A, ['tok_' + 'b'.repeat(24)]: H.USER_B };
test.before(async () => { db = await H.freshDb(); await H.createUsers(db, H.USER_A, H.USER_B); });
test.after(async () => { if (db) await db.close(); });

const fakeUserClient = token => ({
  auth: { getUser: async () => (TOKENS[token] ? { data: { user: { id: TOKENS[token] } } } : { data: { user: null }, error: { message: 'invalid JWT' } }) },
  schema: () => ({ rpc: async (fn, args) => {
    await H.asUser(db, TOKENS[token]);
    try { return { data: (await db.query(`select api.${fn}($1) r`, [args.p_confirm])).rows[0].r }; } catch (e) { return { error: { message: e.message } }; }
  } })
});
const admin = (fail) => ({ auth: { admin: { deleteUser: async uid => {
  if (fail) return { error: { message: 'simulé' } };
  await H.asAdmin(db); await db.query('select app.delete_account($1)', [uid]); return { data: {} };
} } } });
const req = (token, body, method = 'POST') => ({ method, headers: token ? { authorization: 'Bearer ' + token } : {}, body: JSON.stringify(body) });
const seed = async uid => {
  await H.asUser(db, uid);
  const dev = (await db.query("select api.register_device('t', 'web') id")).rows[0].id;
  const ops = [0, 1, 2].map(i => ({ op_id: crypto.randomUUID(), entity: 'copies', id: 'x' + i, kind: 'upsert', base_rev: 0, patch: { n: i }, schema_version: 1 }));
  await db.query('select api.sync_push($1, $2::jsonb, false)', [dev, JSON.stringify(ops)]);
};

test('delete-account : jeton, méthode et phrase exigés ; rien n\'est effacé sur refus', async () => {
  await seed(H.USER_A);
  const h = createDeleteAccountHandler({ userClientFor: fakeUserClient, adminClient: admin() });
  assert.equal((await h(req(null, { confirm: PHRASE }))).status, 401);
  assert.equal((await h(req('tok_' + 'z'.repeat(24), { confirm: PHRASE }))).status, 401);
  assert.equal((await h(req(Object.keys(TOKENS)[0], { confirm: PHRASE }, 'GET'))).status, 405);
  const bad = await h(req(Object.keys(TOKENS)[0], { confirm: 'oui' }));
  assert.equal(bad.status, 400); assert.equal(JSON.parse(bad.body).error, 'confirmation_required');
  await H.asAdmin(db);
  assert.equal((await db.query('select count(*)::int n from app.copies where user_id = $1', [H.USER_A])).rows[0].n, 3);
});

test('delete-account : échec de l\'API d\'administration → données effacées signalées, compte conservé (aucune suppression silencieuse)', async () => {
  await seed(H.USER_B);
  const h = createDeleteAccountHandler({ userClientFor: fakeUserClient, adminClient: admin(true) });
  const r = await h(req(Object.keys(TOKENS)[1], { confirm: PHRASE }));
  assert.equal(r.status, 500); assert.equal(JSON.parse(r.body).data_deleted, true);
  await H.asAdmin(db);
  assert.equal((await db.query('select count(*)::int n from auth.users where id = $1', [H.USER_B])).rows[0].n, 1);
});

test('delete-account : succès — données puis compte supprimés, zéro ligne, autrui intact, réponse non mise en cache', async () => {
  const h = createDeleteAccountHandler({ userClientFor: fakeUserClient, adminClient: admin() });
  const r = await h(req(Object.keys(TOKENS)[0], { confirm: PHRASE }));
  assert.equal(r.status, 200); assert.equal(r.headers['cache-control'], 'no-store');
  assert.equal(JSON.parse(r.body).counts.copies, 3);
  await H.asAdmin(db);
  assert.equal((await db.query('select count(*)::int n from auth.users where id = $1', [H.USER_A])).rows[0].n, 0);
  for (const t of H.APP_TABLES) assert.equal((await db.query(`select count(*)::int n from app.${t} where user_id = $1`, [H.USER_A])).rows[0].n, 0, t);
  assert.equal((await db.query('select count(*)::int n from auth.users where id = $1', [H.USER_B])).rows[0].n, 1);
});

test('delete-account : handler.mjs (déployé) reprend exactement la logique de handler.js', () => {
  const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '../supabase/functions/delete-account');
  const code = f => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r/g, '').split('\n').filter(l => !/^\s*\/\//.test(l) && l.trim() && l.trim() !== "'use strict';" && !/^(module\.exports|export) /.test(l)).join('\n');
  assert.equal(code('handler.mjs'), code('handler.js'));
});
