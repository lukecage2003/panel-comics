'use strict';
// D-98 (migration 15) : co-animation des directs, toutes les éventualités. Base PGlite, rôles non privilégiés.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

const HOST = H.USER_A, CO = H.USER_B;
const C2 = '66666666-6666-4666-8666-666666666666', C3 = '77777777-7777-4777-8777-777777777777';
const C4 = '88888888-8888-4888-8888-888888888888', TEEN = '33333333-3333-4333-8333-333333333333';
const VIEW = '99999999-9999-4999-8999-999999999999';
const Y = new Date().getFullYear();

let db, room;
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const as = uid => H.asUser(db, uid);
test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, HOST, CO, C2, C3, C4, TEEN, VIEW);
  const join = async (u, h, y) => { await as(u); await db.query('select api.community_join($1, $2)', [h, y]); };
  await join(HOST, 'hote_live', 1990); await join(CO, 'co_anim', 1988); await join(C2, 'co_deux', 1991);
  await join(C3, 'co_trois', 1992); await join(C4, 'co_quatre', 1993); await join(TEEN, 'ado_live', Y - 16); await join(VIEW, 'spectateur', 1985);
  await as(HOST); await db.query("select api.community_update_profile('Hôte', '', 'public')");
  room = (await q1("select api.live_create('Débat du mercredi', 'wednesday', '', '', 'public') id")).id;
});
test.after(async () => { if (db) await db.close(); });

test('inviter : rôle valide, pas soi-même, pas un mineur, pas un compte inconnu, une seule invitation active', async () => {
  await as(HOST);
  await assert.rejects(db.query("select api.live_invite($1, 'co_anim', 'boss')", [room]), /invalid_role/);
  await assert.rejects(db.query("select api.live_invite($1, 'hote_live')", [room]), /self_invite/);
  await assert.rejects(db.query("select api.live_invite($1, 'ado_live')", [room]), /cannot_invite/);
  await assert.rejects(db.query("select api.live_invite($1, 'personne_ici')", [room]), /cannot_invite/);
  assert.equal((await q1("select api.live_invite($1, 'co_anim') r", [room])).r.status, 'invited');
  await assert.rejects(db.query("select api.live_invite($1, 'co_anim')", [room]), /already_invited/);
  await as(CO); await assert.rejects(db.query("select api.live_invite($1, 'co_deux')", [room]), /not_found/);
});

test('l\'invité voit l\'invitation, accepte ; trois places au plus ; refus et annulation', async () => {
  await as(CO);
  const inv = (await q1('select api.live_my_invites() r')).r;
  assert.equal(inv.length, 1); assert.equal(inv[0].host, 'hote_live'); assert.equal(inv[0].role, 'cohost');
  assert.equal((await q1('select api.live_invite_respond($1, true) r', [room])).r.status, 'accepted');
  await assert.rejects(db.query('select api.live_invite_respond($1, true)', [room]), /not_found/);
  await as(HOST);
  await db.query("select api.live_invite($1, 'co_deux', 'moderator')", [room]);
  await db.query("select api.live_invite($1, 'co_trois')", [room]);
  await assert.rejects(db.query("select api.live_invite($1, 'co_quatre')", [room]), /team_full/);
  await as(C3); assert.equal((await q1('select api.live_invite_respond($1, false) r', [room])).r.status, 'declined');
  await as(HOST); await db.query("select api.live_invite($1, 'co_quatre')", [room]);
  await db.query("select api.live_host_remove($1, 'co_quatre')", [room]);
  await assert.rejects(db.query("select api.live_host_remove($1, 'co_quatre')", [room]), /not_found/);
  await as(C4); await assert.rejects(db.query('select api.live_invite_respond($1, true)', [room]), /not_found/);
  await as(C2); await db.query('select api.live_invite_respond($1, true)', [room]);
});

test('invitation expirée après 24 h', async () => {
  await as(HOST);
  const r2 = (await q1("select api.live_create('Club', 'review', '', '', 'public') id")).id;
  await db.query("select api.live_invite($1, 'co_quatre')", [r2]);
  await H.asAdmin(db); await db.query("update community.live_hosts set invited_at = now() - interval '25 hours' where room_id = $1", [r2]);
  await as(C4);
  assert.equal((await q1('select api.live_my_invites() r')).r.length, 0);
  await assert.rejects(db.query('select api.live_invite_respond($1, true)', [r2]), /expired/);
  await as(HOST); assert.equal((await q1("select api.live_invite($1, 'co_quatre') r", [r2])).r.status, 'invited');
});

test('l\'équipe modère le chat ; un co-animateur ne retire pas l\'hôte ; un spectateur ne retire rien', async () => {
  await as(HOST); await db.query("select api.live_set_status($1, 'live')", [room]);
  const hostMsg = (await q1("select api.live_say($1, 'Bienvenue') id", [room])).id;
  await as(VIEW); const v = (await q1("select api.live_say($1, 'message hors sujet') id", [room])).id;
  const v2 = (await q1("select api.live_say($1, 'encore') id", [room])).id;
  await assert.rejects(db.query('select api.live_unsay($1)', [hostMsg]), /forbidden/);
  await as(C2); await db.query('select api.live_unsay($1)', [v]);
  await as(CO);
  await assert.rejects(db.query('select api.live_unsay($1)', [hostMsg]), /forbidden/);
  await db.query('select api.live_unsay($1)', [v2]);
  await H.asAdmin(db);
  const log = (await db.query("select reason from community.moderation_log where target_kind = 'live_message' order by id")).rows.map(r => r.reason);
  assert.deepEqual(log.slice(-2), ['Retiré par un modérateur du salon', 'Retiré par un co-animateur']);
});

test('les spectateurs voient l\'équipe acceptée, pas les invitations ni les refus', async () => {
  await as(VIEW);
  const rows = (await db.query('select user_id, status from community.live_hosts where room_id = $1', [room])).rows;
  assert.ok(rows.length >= 2 && rows.every(r => r.status === 'accepted'));
  await as(HOST);
  assert.ok((await db.query('select 1 from community.live_hosts where room_id = $1', [room])).rows.length > rows.length);
});

test('passage de relais : l\'hôte qui part transmet au premier co-animateur ; sans co-animateur, le direct se termine', async () => {
  await as(C2); assert.equal((await q1('select api.live_leave($1) r', [room])).r.status, 'left');
  await as(HOST); assert.equal((await q1('select api.live_leave($1) r', [room])).r.status, 'handed_over');
  await H.asAdmin(db);
  const r = await q1('select host_id, status from community.live_rooms where id = $1', [room]);
  assert.equal(r.host_id, CO); assert.equal(r.status, 'live');
  await as(CO); assert.equal((await q1('select api.live_leave($1) r', [room])).r.status, 'ended');
  await assert.rejects(db.query("select api.live_invite($1, 'co_quatre')", [room]), /room_closed/);
});

test('aucune écriture directe, aucun accès anonyme ; suppression de compte en cascade', async () => {
  await as(HOST);
  assert.equal((await H.tryQuery(db, "insert into community.live_hosts (room_id, user_id) values ('" + room + "', '" + HOST + "')")).ok, false);
  assert.equal((await H.tryQuery(db, "update community.live_hosts set status = 'accepted'")).ok, false);
  await H.asAnon(db);
  assert.equal((await H.tryQuery(db, 'select * from community.live_hosts')).ok, false);
  assert.equal((await H.tryQuery(db, 'select api.live_my_invites()')).ok, false);
  await H.asAdmin(db);
  await db.query('delete from auth.users where id = $1', [C4]);
  assert.equal((await q1('select count(*)::int n from community.live_hosts where user_id = $1', [C4])).n, 0);
});
