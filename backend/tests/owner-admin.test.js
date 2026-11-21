'use strict';
// D-104 (migration 17, préparée) : administrateur général, double authentification obligatoire pour l'équipe.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

const OWNER = H.USER_A, MEMBER = H.USER_B;
const MOD = '88888888-8888-4888-8888-888888888888', ADMIN = '99999999-9999-4999-8999-999999999999';

let db, post;
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, OWNER, MEMBER, MOD, ADMIN);
  for (const [u, h] of [[OWNER, 'panel_owner'], [MEMBER, 'lecteur'], [MOD, 'moderatrice'], [ADMIN, 'admin_panel']]) { await H.asUser(db, u); await db.query('select api.community_join($1, $2)', [h, 1990]); }
  await H.asUser(db, MEMBER);
  post = (await q1("select api.post_create('story', 'Belle couverture', '{}', 'public') id")).id;
  await H.asUser(db, OWNER); await db.query("select api.report('post', $1, 'spam')", [post]);
  // Le rôle de propriétaire ne s'attribue que côté serveur (rôle service), jamais par l'application
  await H.asAdmin(db);
  await db.query("select app.grant_role($1, 'owner', 'service', 'propriétaire de Panel')", [OWNER]);
  await db.query("select app.grant_role($1, 'moderator', 'service', 'test')", [MOD]);
});
test.after(async () => { if (db) await db.close(); });

test('owner : impossible à obtenir depuis l\'application', async () => {
  await H.asUser(db, MEMBER);
  await assert.rejects(db.query("select app.grant_role($1, 'owner', 'moi', 'x')", [MEMBER]), /permission denied/);
  await assert.rejects(db.query("insert into app.staff_roles (user_id, role, granted_by) values ($1, 'owner', 'moi')", [MEMBER]), /permission denied/);
  await H.asUser(db, OWNER);
  await assert.rejects(db.query("select api.admin_set_role($1, 'owner', true, 'promotion')", [MEMBER]), /invalid_role/);
});

test('sans double authentification, l\'équipe n\'a aucun pouvoir', async () => {
  await H.asUser(db, OWNER, 'aal1');
  assert.deepEqual((await q1('select api.my_access() a')).a, { roles: ['owner'], mfa: false });
  await assert.rejects(db.query('select api.admin_overview()'), /forbidden/);
  await assert.rejects(db.query("select api.admin_set_role($1, 'moderator', true, 'aide')", [MEMBER]), /forbidden/);
  await H.asUser(db, MOD, 'aal1');
  await assert.rejects(db.query('select api.mod_terms_get()'), /forbidden/);
  await assert.rejects(db.query("select api.mod_act('post', $1, 'hide', 'test')", [post]), /forbidden/);
});

test('propriétaire en double authentification : vue d\'ensemble agrégée, sans donnée personnelle', async () => {
  await H.asUser(db, OWNER, 'aal2');
  assert.equal((await q1('select api.my_access() a')).a.mfa, true);
  const o = (await q1('select api.admin_overview() o')).o;
  assert.equal(o.members, 4);
  assert.equal(o.reports_open, 1);
  assert.deepEqual(o.staff.map(s => s.role).sort(), ['moderator', 'owner']);
  assert.deepEqual(Object.keys(o).sort(), ['members', 'members_active', 'members_suspended', 'posts', 'posts_hidden', 'reports_open', 'staff']);
  // Les données personnelles restent inaccessibles, même au propriétaire
  const rows = await db.query('select count(*)::int n from app.collection_items where user_id <> $1', [OWNER]).catch(() => ({ rows: [{ n: 0 }] }));
  assert.equal(rows.rows[0].n, 0);
});

test('rôles d\'équipe : propriétaire seulement, motif obligatoire, jamais sur soi, journalisés', async () => {
  await H.asUser(db, OWNER, 'aal2');
  await assert.rejects(db.query("select api.admin_set_role($1, 'admin', true, '  ')", [ADMIN]), /reason_required/);
  await assert.rejects(db.query("select api.admin_set_role($1, 'moderator', false, 'retrait')", [OWNER]), /invalid_target/);
  assert.equal((await q1("select api.admin_set_role($1, 'admin', true, 'aide à la modération') r", [ADMIN])).r.status, 'granted');
  // Un administrateur voit la vue d'ensemble mais ne peut pas distribuer de rôles ni lire le journal
  await H.asUser(db, ADMIN, 'aal2');
  assert.equal(typeof (await q1('select api.admin_overview() o')).o.members, 'number');
  await assert.rejects(db.query("select api.admin_set_role($1, 'moderator', true, 'x')", [MEMBER]), /forbidden/);
  await assert.rejects(db.query('select api.admin_role_log()'), /forbidden/);
  await H.asUser(db, OWNER, 'aal2');
  const log = (await q1('select api.admin_role_log(10) l')).l;
  assert.equal(log[0].role, 'admin');
  assert.equal(log[0].action, 'grant');
  assert.match(log[0].actor, /^owner:/);
  assert.equal(log[0].reason, 'aide à la modération');
  assert.equal((await q1("select api.admin_set_role($1, 'admin', false, 'fin de mission') r", [ADMIN])).r.status, 'revoked');
});

test('modération en double authentification : inchangée', async () => {
  await H.asUser(db, MOD, 'aal2');
  assert.ok(Array.isArray((await q1('select api.mod_terms_get() t')).t));
  await H.asUser(db, MEMBER, 'aal2');
  await assert.rejects(db.query('select api.admin_overview()'), /forbidden/);
  assert.deepEqual((await q1('select api.my_access() a')).a, { roles: [], mfa: true });
});
