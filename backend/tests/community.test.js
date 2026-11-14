'use strict';
// D-73 : communauté et modération — âge, visibilité, blocages, contenus mature, signalements, modération journalisée,
// limites de débit, écritures directes refusées, et contrôles inspirés des lints Supabase (splinter).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

const ADULT = H.USER_A, ADULT2 = H.USER_B;
const TEEN = '33333333-3333-4333-8333-333333333333';
const KID = '44444444-4444-4444-8444-444444444444';
const MOD = '55555555-5555-4555-8555-555555555555';
const Y = new Date().getFullYear();

let db;
test.before(async () => { db = await H.freshDb(); await H.createUsers(db, ADULT, ADULT2, TEEN, KID, MOD); });
test.after(async () => { if (db) await db.close(); });
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const as = uid => H.asUser(db, uid);

test('adhésion : âge minimal, consentement parental, pseudo, tranche d\'âge seule conservée', async () => {
  await as(KID);
  await assert.rejects(db.query('select api.community_join($1, $2)', ['petit_lecteur', Y - 11]), /too_young/);
  await assert.rejects(db.query('select api.community_join($1, $2)', ['jeune_lecteur', Y - 14]), /parental_consent_required/);
  assert.equal((await q1('select api.community_join($1, $2, true) r', ['jeune_lecteur', Y - 14])).r.age_band, '13-14');
  await as(TEEN);
  await assert.rejects(db.query('select api.community_join($1, $2)', ['<script>', Y - 16]), /invalid_handle/);
  await assert.rejects(db.query('select api.community_join($1, $2)', ['Jeune_Lecteur', Y - 16]), /handle_taken/);
  assert.equal((await q1('select api.community_join($1, $2) r', ['ado_comics', Y - 16])).r.age_band, '15-17');
  await as(ADULT); await db.query('select api.community_join($1, $2)', ['adulte_un', 1990]);
  await assert.rejects(db.query('select api.community_join($1, $2)', ['adulte_bis', 1990]), /already_member/);
  await as(ADULT2); await db.query('select api.community_join($1, $2)', ['adulte_deux', 1985]);
  await as(MOD); await db.query('select api.community_join($1, $2)', ['moderation', 1980]);
  await H.asAdmin(db);
  const cols = (await db.query("select column_name from information_schema.columns where table_schema = 'community' and table_name = 'members'")).rows.map(r => r.column_name);
  assert.ok(!cols.some(c => /birth|date_of/.test(c)), 'aucune date de naissance stockée');
  await H.asAnon(db);
  await assert.rejects(db.query('select api.community_join($1, $2)', ['anonyme', 1990]), /permission denied/);
  await assert.rejects(db.query('select * from community.members'), /permission denied/);
});

test('profil : un mineur ne peut pas être public ; nom et bio nettoyés', async () => {
  await as(TEEN);
  await assert.rejects(db.query("select api.community_update_profile('Ado', 'bio', 'public')"), /minor_profile_not_public/);
  await as(ADULT);
  await db.query("select api.community_update_profile($1, $2, 'public')", ['Adulte <b>Un</b>', 'Fan de\u0007 comics']);
  const m = await q1("select display_name, bio from community.members where handle = 'adulte_un'");
  assert.equal(m.display_name, 'Adulte bUn/b'); assert.equal(m.bio, 'Fan de comics');
});

test('écritures directes refusées : tout passe par les fonctions contrôlées', async () => {
  await as(ADULT);
  await assert.rejects(db.query("insert into community.posts (author_id, kind) values ($1, 'planche')", [ADULT]), /permission denied/);
  await assert.rejects(db.query("update community.members set status = 'active' where user_id = $1", [ADULT]), /permission denied/);
  await assert.rejects(db.query('delete from community.reports'), /permission denied/);
  await assert.rejects(db.query('select * from community.moderation_log'), /permission denied/);
  await assert.rejects(db.query('select * from community.rate_events'), /permission denied/);
  await assert.rejects(db.query("select community.rate_check('post')"), /permission denied/);
});

let pubPost, followersPost, maturePost;
test('publications : données privées refusées, mature réservé aux adultes, visibilité respectée', async () => {
  await as(ADULT);
  await assert.rejects(db.query("select api.post_create('planche', 'x', $1::jsonb, 'public')", [JSON.stringify({ items: [{ series: 'X', purchasePrice: 12 }] })]), /private_data_refused/);
  await assert.rejects(db.query("select api.post_create('planche', 'x', $1::jsonb, 'public')", [JSON.stringify({ location: 'Boîte 3' })]), /private_data_refused/);
  await assert.rejects(db.query("select api.post_create('video', 'x', '{}', 'public')"), /invalid_post/);
  pubPost = (await q1("select api.post_create('planche', 'Ma pile du mercredi', $1::jsonb, 'public') id", [JSON.stringify({ items: [{ series: 'Fixture', issue: '1' }] })])).id;
  followersPost = (await q1("select api.post_create('story', 'Pour mes abonnés', '{}', 'followers') id")).id;
  maturePost = (await q1("select api.post_create('story', 'Contenu adulte', '{}', 'public', true) id")).id;
  await as(TEEN);
  await assert.rejects(db.query("select api.post_create('story', 'x', '{}', 'followers', true)"), /minor_mature_refused/);
  // Un mineur ne voit pas le profil ni les contenus d'un adulte ? Il voit l'adulte public, jamais le contenu mature.
  const seen = (await db.query('select id from community.posts')).rows.map(r => r.id);
  assert.ok(seen.includes(pubPost)); assert.ok(!seen.includes(followersPost)); assert.ok(!seen.includes(maturePost));
  await as(ADULT2);
  const seen2 = (await db.query('select id from community.posts')).rows.map(r => r.id);
  assert.ok(seen2.includes(pubPost) && seen2.includes(maturePost) && !seen2.includes(followersPost));
  await db.query('select api.follow($1)', [ADULT]);
  assert.ok((await db.query('select id from community.posts')).rows.some(r => r.id === followersPost), 'visible une fois abonné');
});

test('protection des mineurs : un adulte ne voit ni ne suit un mineur', async () => {
  await as(ADULT);
  await assert.rejects(db.query('select api.follow($1)', [TEEN]), /minor_protected/);
  assert.equal((await q1('select count(*)::int n from community.members where user_id = $1', [TEEN])).n, 0);
  await as(TEEN);
  assert.equal((await q1('select count(*)::int n from community.members where user_id = $1', [KID])).n, 1, 'les mineurs se voient entre eux');
});

test('blocage : réciproque, retire les abonnements et rend les contenus invisibles', async () => {
  await as(ADULT);
  await db.query('select api.block($1)', [ADULT2]);
  assert.equal((await q1('select count(*)::int n from community.follows where follower_id = $1', [ADULT2])).n, 0);
  await as(ADULT2);
  assert.equal((await q1('select count(*)::int n from community.posts where author_id = $1', [ADULT])).n, 0);
  assert.equal((await q1('select count(*)::int n from community.members where user_id = $1', [ADULT])).n, 0);
  await assert.rejects(db.query('select api.follow($1)', [ADULT]), /blocked/);
  await assert.rejects(db.query("select api.react($1, 'pow')", [pubPost]), /not_found/);
  await as(ADULT);
  await db.query('select api.unblock($1)', [ADULT2]);
  await as(ADULT2);
  assert.ok((await q1('select count(*)::int n from community.posts where author_id = $1', [ADULT])).n >= 1);
  assert.equal((await q1("select api.react($1, 'kapow') r", [pubPost])).r.status, 'reacted');
  await assert.rejects(db.query("select api.react($1, 'like')", [pubPost]), /invalid_reaction/);
});

test('signalements : un par personne, masquage automatique à 3, immédiat pour la sécurité des mineurs', async () => {
  await as(ADULT2);
  assert.equal((await q1("select api.report('post', $1, 'spam') r", [pubPost])).r.hidden, false);
  assert.equal((await q1("select api.report('post', $1, 'spam') r", [pubPost])).r.status, 'already_reported');
  await assert.rejects(db.query("select api.report('post', $1, 'je_veux')", [pubPost]), /invalid_reason/);
  await as(TEEN); await db.query("select api.report('post', $1, 'harassment', 'détail')", [pubPost]);
  await as(MOD);
  const r3 = await q1("select api.report('post', $1, 'hate') r", [pubPost]);
  assert.equal(r3.r.hidden, true);
  await as(ADULT2);
  assert.equal((await q1('select count(*)::int n from community.posts where id = $1', [pubPost])).n, 0, 'masqué en attente d\'examen');
  await as(ADULT);
  assert.equal((await q1('select status from community.posts where id = $1', [pubPost])).status, 'hidden', 'l\'auteur voit son statut');
  const fresh = (await q1("select api.post_create('story', 'nouvelle', '{}', 'public') id")).id;
  await as(ADULT2);
  assert.equal((await q1("select api.report('post', $1, 'minor_safety') r", [fresh])).r.hidden, true);
  await assert.rejects(db.query("select api.report('member', $1, 'spam')", [ADULT2]), /invalid_target/);
});

test('modération : réservée au rôle, motif obligatoire, journalisée, suspension et bannissement effectifs', async () => {
  await as(ADULT2);
  await assert.rejects(db.query('select api.mod_queue()'), /forbidden/);
  await assert.rejects(db.query("select api.mod_act('post', $1, 'restore', 'moi')", [pubPost]), /forbidden/);
  await H.asAdmin(db);
  await db.query("select app.grant_role($1, 'moderator', 'service', 'test')", [MOD]);
  await as(MOD);
  const queue = (await q1('select api.mod_queue() q')).q;
  assert.ok(queue.length >= 2 && queue[0].priority === 2, 'sécurité des mineurs en tête');
  await assert.rejects(db.query("select api.mod_act('post', $1, 'restore', '  ')", [pubPost]), /reason_required/);
  await db.query("select api.mod_act('post', $1, 'restore', 'Signalements non fondés')", [pubPost]);
  assert.equal((await q1("select count(*)::int n from community.reports where target_id = $1 and status = 'open'", [pubPost])).n, 0);
  await assert.rejects(db.query("select api.mod_act('member', $1, 'ban', 'moi')", [MOD]), /self_moderation_refused/);
  await db.query("select api.mod_act('member', $1, 'suspend', 'Harcèlement répété', 3)", [ADULT2]);
  const log = (await q1('select api.mod_log($1) l', [pubPost])).l;
  assert.ok(log.some(x => x.action === 'auto_hide') && log.some(x => x.action === 'restore' && x.moderator_id === MOD));
  await as(ADULT2);
  await assert.rejects(db.query("select api.post_create('story', 'x', '{}', 'public')"), /not_allowed/);
  await as(ADULT);
  assert.ok((await db.query('select id from community.posts where id = $1', [pubPost])).rows.length === 1);
  await as(MOD);
  await db.query("select api.mod_act('member', $1, 'ban', 'Récidive')", [ADULT2]);
  await as(ADULT);
  assert.equal((await q1('select count(*)::int n from community.members where user_id = $1', [ADULT2])).n, 0, 'banni : invisible');
  await assert.rejects(db.query('select api.follow($1)', [ADULT2]), /invalid_target/);
});

test('limites de débit : au-delà du plafond, refus sans écriture', async () => {
  await H.asAdmin(db);
  await db.query("update community.limits set max_count = 2 where action = 'post'");
  await db.query("delete from community.rate_events where action = 'post'");
  await as(TEEN);
  await db.query("select api.post_create('story', 'a', '{}', 'followers')");
  await db.query("select api.post_create('story', 'b', '{}', 'followers')");
  const before = (await q1('select count(*)::int n from community.posts where author_id = $1', [TEEN])).n;
  await assert.rejects(db.query("select api.post_create('story', 'c', '{}', 'followers')"), /rate_limited/);
  assert.equal((await q1('select count(*)::int n from community.posts where author_id = $1', [TEEN])).n, before);
});

test('suppression de compte : contenus effacés en cascade, journal de modération conservé sans identité', async () => {
  await H.asAdmin(db);
  const nLog = (await q1('select count(*)::int n from community.moderation_log')).n;
  await db.query('delete from auth.users where id = $1', [TEEN]);
  assert.equal((await q1('select count(*)::int n from community.posts where author_id = $1', [TEEN])).n, 0);
  assert.equal((await q1('select count(*)::int n from community.members where user_id = $1', [TEEN])).n, 0);
  assert.equal((await q1('select count(*)::int n from community.moderation_log')).n, nLog);
});

test('lints de sécurité (inspirés de supabase/splinter) sur app, api et community', async () => {
  await H.asAdmin(db);
  // 0013 / 0007 / 0008 : RLS activée partout, et chaque table lisible a au moins une politique
  const noRls = (await db.query(`select n.nspname || '.' || c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname in ('app', 'community') and not c.relrowsecurity`)).rows;
  assert.deepEqual(noRls, []);
  const grantedNoPolicy = (await db.query(`select t.table_schema || '.' || t.table_name t from information_schema.role_table_grants t
    where t.grantee = 'authenticated' and t.table_schema in ('app', 'community') and t.privilege_type = 'SELECT'
      and not exists (select 1 from pg_policies p where p.schemaname = t.table_schema and p.tablename = t.table_name)`)).rows;
  assert.deepEqual(grantedNoPolicy, []);
  // 0011 : toute fonction security definer fixe son search_path
  const mutable = (await db.query(`select n.nspname || '.' || p.proname f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'api', 'community') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`)).rows;
  assert.deepEqual(mutable, []);
  // 0015 : aucune politique ne s'appuie sur des métadonnées modifiables par l'utilisateur
  const meta = (await db.query("select policyname from pg_policies where coalesce(qual, '') || coalesce(with_check, '') ~* 'user_metadata|raw_user_meta'")).rows;
  assert.deepEqual(meta, []);
  // anon n'exécute aucune fonction des schémas applicatifs, ni n'écrit dans aucune table
  const anonExec = (await db.query(`select n.nspname || '.' || p.proname f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'api', 'community') and has_function_privilege('anon', p.oid, 'execute')`)).rows;
  assert.deepEqual(anonExec, []);
  const anonWrite = (await db.query(`select table_schema || '.' || table_name t from information_schema.role_table_grants
    where grantee in ('anon', 'PUBLIC') and table_schema in ('app', 'api', 'community')`)).rows;
  assert.deepEqual(anonWrite, []);
  // Les clients n'ont aucun droit d'écriture direct dans community
  const writes = (await db.query(`select table_name, privilege_type from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'community' and privilege_type <> 'SELECT'`)).rows;
  assert.deepEqual(writes, []);
});
