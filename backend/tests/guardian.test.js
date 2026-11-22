'use strict';
// D-111 (migration 18) : Panel Guardian — âge, supervision parentale, restrictions, politique côté serveur. Base PGlite locale.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

const PARENT = H.USER_A, STRANGER = H.USER_B;
const TEEN = '33333333-3333-4333-8333-333333333333', YOUNG = '44444444-4444-4444-8444-444444444444';
const KID = '55555555-5555-4555-8555-555555555555', MOD = '66666666-6666-4666-8666-666666666666';
const HOST = '77777777-7777-4777-8777-777777777777', GONE = '88888888-8888-4888-8888-888888888888';
const Y = new Date().getFullYear();

let db;
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const as = (uid, aal) => H.asUser(db, uid, aal);
test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, PARENT, STRANGER, TEEN, YOUNG, KID, MOD, HOST, GONE);
  const join = async (u, h, y) => { await as(u); await db.query('select api.community_join($1, $2, true)', [h, y]); };
  await join(PARENT, 'parent_un', 1980); await join(STRANGER, 'inconnu', 1985); await join(TEEN, 'ado_seize', Y - 16);
  await join(YOUNG, 'ado_treize', Y - 14); await join(MOD, 'moderation', 1990); await join(HOST, 'hote', 1990); await join(GONE, 'ado_parti', Y - 15);
  await H.asAdmin(db); await db.query("select app.grant_role($1, 'moderator', 'service', 'test')", [MOD]);
});
test.after(async () => { if (db) await db.close(); });

test('moins de 13 ans : inscription refusée, aucune trace conservée', async () => {
  await as(KID);
  await assert.rejects(db.query('select api.community_join($1, $2)', ['enfant', Y - 12]), /too_young/);
  await H.asAdmin(db);
  assert.equal((await q1('select count(*)::int n from guardian.age_assurances where user_id = $1', [KID])).n, 0);
  assert.equal((await q1('select count(*)::int n from community.members where user_id = $1', [KID])).n, 0);
});

test('statut d\'âge : déclaratif, jamais présenté comme vérifié ; tables inaccessibles directement', async () => {
  await as(TEEN);
  const s = (await q1('select api.guardian_status() s')).s;
  assert.equal(s.band, '15-17'); assert.equal(s.status, 'unverified'); assert.equal(s.method, 'self_declared');
  await assert.rejects(db.query('select * from guardian.age_assurances'), /permission denied/);
  await assert.rejects(db.query("update guardian.age_assurances set status = 'verified_adult'"), /permission denied/);
  await assert.rejects(db.query('select * from guardian.links'), /permission denied/);
});

test('lien parental : créé par le mineur, code obligatoire, adulte en double authentification, code à usage unique', async () => {
  // Un adulte ne peut pas générer de code « enfant », et un faux code est refusé
  await as(PARENT); await assert.rejects(db.query('select api.guardian_link_create()'), /adult_account/);
  await assert.rejects(db.query("select api.guardian_link_accept('ABCDEF1234')"), /invalid_code/);
  await as(TEEN);
  const code = (await q1('select api.guardian_link_create() r')).r.code;
  assert.match(code, /^[0-9A-F]{10}$/);
  // Le code n'est jamais stocké en clair
  await H.asAdmin(db); assert.equal((await q1('select count(*)::int n from guardian.links where code_hash = $1', [code])).n, 0);
  // Un mineur ne peut pas devenir parent ; un adulte sans double authentification non plus
  await as(YOUNG); await assert.rejects(db.query('select api.guardian_link_accept($1)', [code]), /adult_required/);
  await as(PARENT, 'aal1'); await assert.rejects(db.query('select api.guardian_link_accept($1)', [code]), /mfa_required/);
  await as(PARENT); assert.equal((await q1('select api.guardian_link_accept($1) r', [code.toLowerCase()])).r.status, 'active');
  // Déjà utilisé : un second adulte ne peut pas le réclamer
  await as(STRANGER); await assert.rejects(db.query('select api.guardian_link_accept($1)', [code]), /invalid_code/);
  await as(PARENT); const L = (await q1('select api.guardian_links() l')).l;
  assert.equal(L.length, 1); assert.equal(L[0].handle, 'ado_seize'); assert.equal(L[0].role, 'guardian');
  await as(TEEN); assert.equal((await q1('select api.guardian_status() s')).s.guardians, 1);
});

test('lien frauduleux : un inconnu ne règle rien et ne voit rien de l\'enfant', async () => {
  await as(STRANGER);
  await assert.rejects(db.query('select api.guardian_settings_set($1, 21, 7, true, false, true)', [TEEN]), /forbidden/);
  assert.deepEqual((await q1('select api.guardian_links() l')).l, []);
});

test('parent : règle des limites, sans accès aux publications privées ni aux échanges', async () => {
  await as(TEEN); await db.query("select api.post_create('story', 'Mon carnet privé', '{}', 'private')");
  await as(PARENT);
  assert.equal((await q1('select api.guardian_settings_set($1, null, null, false, true, false) r', [TEEN])).r.status, 'saved');
  assert.equal((await q1("select count(*)::int n from community.posts where body = 'Mon carnet privé'")).n, 0);
  assert.equal((await q1('select count(*)::int n from community.members where user_id = $1', [TEEN])).n, 0, 'un adulte ne voit pas le profil d\'un mineur');
  await as(TEEN);
  assert.equal((await q1("select api.guardian_can('follow') r")).r.reason, 'guardian_follows_off');
  await assert.rejects(db.query('select api.follow($1)', [HOST]), /guardian_follows_off/);
  // Animer un direct : accordé par le parent pour un 15-17 ans
  assert.equal((await q1("select api.guardian_can('live_host') r")).r.allowed, true);
});

test('heures calmes : publier et discuter en direct bloqués pour le mineur, pas pour l\'adulte', async () => {
  await H.asAdmin(db);
  const h = (await q1("select extract(hour from (now() at time zone 'Europe/Brussels'))::int h")).h;
  await as(PARENT); await db.query('select api.guardian_settings_set($1, $2, $3, true, false, true)', [TEEN, h, (h + 2) % 24]);
  await as(TEEN);
  assert.equal((await q1("select api.guardian_can('post') r")).r.reason, 'quiet_hours');
  await assert.rejects(db.query("select api.post_create('story', 'Il est tard', '{}', 'followers')"), /guardian_quiet_hours/);
  await as(PARENT); await db.query('select api.post_create($1, $2, $3, $4)', ['story', 'Bonne nuit', '{}', 'followers']);
  await db.query('select api.guardian_settings_set($1, null, null, true, false, true)', [TEEN]);
  await as(TEEN); assert.equal((await q1("select api.guardian_can('post') r")).r.allowed, true);
});

test('directs : 13-14 ans n\'anime jamais ; 15-17 ans sans accord non plus ; un adulte inconnu ne peut pas inviter un mineur', async () => {
  await as(YOUNG);
  await assert.rejects(db.query("select api.live_create('Mon direct', 'wednesday', '', '', 'followers')"), /guardian_minor_live_host|forbidden|minor/);
  await as(TEEN); // live_host coupé par le parent juste avant
  await assert.rejects(db.query("select api.live_create('Mon direct', 'wednesday', '', '', 'followers')"), /guardian_minor_live_host|minor/);
  await as(HOST); await db.query("select api.community_update_profile('Hôte', '', 'public')");
  const room = (await q1("select api.live_create('Débat', 'wednesday', '', '', 'public') id")).id;
  await assert.rejects(db.query("select api.live_invite($1, 'ado_seize')", [room]), /cannot_invite/);
  await assert.rejects(db.query("select api.live_invite($1, 'ado_treize')", [room]), /cannot_invite/);
});

test('contestation d\'âge : examen humain en double authentification, directs suspendus pendant l\'examen', async () => {
  await as(YOUNG);
  await assert.rejects(db.query("select api.age_review_request('18+', 'court')"), /reason_required/);
  await assert.rejects(db.query("select api.age_review_request('13-14', 'même tranche que maintenant')"), /invalid_band/);
  const id = (await q1("select api.age_review_request('15-17', 'Je me suis trompé d''année de naissance') r")).r.id;
  assert.equal((await q1('select api.guardian_status() s')).s.status, 'review_required');
  assert.equal((await q1("select api.guardian_can('live_chat') r")).r.reason, 'age_review_pending');
  // Pas une décision de l'intéressé ni d'un membre ; pas sans double authentification
  await assert.rejects(db.query('select api.age_review_decide($1, true, $2)', [id, 'ok']), /forbidden/);
  await as(MOD, 'aal1'); await assert.rejects(db.query('select api.age_review_decide($1, true, $2)', [id, 'ok']), /forbidden/);
  await as(MOD); assert.equal((await q1('select api.age_review_decide($1, true, $2) r', [id, 'Pièce présentée hors ligne, non conservée'])).r.status, 'accepted');
  await as(YOUNG); const s = (await q1('select api.guardian_status() s')).s;
  assert.equal(s.band, '15-17'); assert.equal(s.status, 'unverified'); assert.equal(s.method, 'staff_review');
});

test('restriction de compte : proportionnée, motivée, levable ; jamais sur son propre compte', async () => {
  await as(MOD);
  await assert.rejects(db.query("select api.restriction_set($1, 'no_post', 'x')", [HOST]), /invalid/);
  await assert.rejects(db.query("select api.restriction_set($1, 'no_post', 'moi-même')", [MOD]), /own_account/);
  const id = (await q1("select api.restriction_set($1, 'no_post', 'Spam répété', 3) r", [HOST])).r.id;
  await as(HOST);
  await assert.rejects(db.query("select api.post_create('story', 'Encore', '{}', 'public')"), /guardian_restricted/);
  assert.equal((await q1("select api.guardian_can('live_chat') r")).r.allowed, true, 'la restriction ne touche que la publication');
  await assert.rejects(db.query('select api.restriction_lift($1, $2)', [id, 'je veux']), /forbidden/);
  await as(MOD); await db.query('select api.restriction_lift($1, $2)', [id, 'Avertissement compris']);
  await as(HOST); await db.query("select api.post_create('story', 'De retour', '{}', 'public')");
});

test('révocation : par le parent ; le mineur ne peut pas couper seul avant sa majorité ; réglages retirés', async () => {
  await as(TEEN);
  const id = (await q1('select api.guardian_links() l')).l[0].id;
  await assert.rejects(db.query('select api.guardian_link_revoke($1)', [id]), /forbidden/);
  await as(STRANGER); await assert.rejects(db.query('select api.guardian_link_revoke($1)', [id]), /forbidden/);
  await as(PARENT); assert.equal((await q1('select api.guardian_link_revoke($1, $2) r', [id, 'test'])).r.status, 'revoked');
  await assert.rejects(db.query('select api.guardian_settings_set($1, null, null, true, false, true)', [TEEN]), /forbidden/);
  await as(TEEN); const s = (await q1('select api.guardian_status() s')).s;
  assert.equal(s.guardians, 0); assert.equal(s.settings, null);
  await H.asAdmin(db); assert.ok((await q1("select count(*)::int n from guardian.events where user_id = $1 and kind = 'guardian_revoked'", [TEEN])).n === 1);
});

test('suppression du compte : liens, réglages, statut et journal Guardian partent avec lui', async () => {
  await as(GONE); const code = (await q1('select api.guardian_link_create() r')).r.code;
  await as(PARENT); await db.query('select api.guardian_link_accept($1)', [code]);
  await H.asAdmin(db);
  await db.query('select app.delete_account($1)', [GONE]);
  for (const t of ['age_assurances where user_id', 'links where child_id', 'settings where child_id', 'events where user_id']) {
    assert.equal((await q1(`select count(*)::int n from guardian.${t} = $1`, [GONE])).n, 0, t);
  }
  await as(PARENT); assert.deepEqual((await q1('select api.guardian_links() l')).l, []);
});
