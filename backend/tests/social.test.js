'use strict';
// D-97 (migration 14) : pensées, mots-dièse et tendances, verdict des théories, J'aime personnalisé,
// directs (salons, chat, votes du duel), signalements et modération des directs. Base PGlite, rôles non privilégiés.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

const ADULT = H.USER_A, ADULT2 = H.USER_B;
const TEEN = '33333333-3333-4333-8333-333333333333';
const R1 = '66666666-6666-4666-8666-666666666666', R2 = '77777777-7777-4777-8777-777777777777';
const MOD = '55555555-5555-4555-8555-555555555555';
const Y = new Date().getFullYear();

let db;
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const as = uid => H.asUser(db, uid);
test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, ADULT, ADULT2, TEEN, R1, R2, MOD);
  const join = async (u, h, y) => { await as(u); await db.query('select api.community_join($1, $2)', [h, y]); };
  await join(ADULT, 'hote_duel', 1990); await join(ADULT2, 'fan_deux', 1988); await join(TEEN, 'ado_comics', Y - 16);
  await join(R1, 'lecteur_r1', 1991); await join(R2, 'lecteur_r2', 1992); await join(MOD, 'moderation', 1980);
  await as(ADULT); await db.query("select api.community_update_profile('Hôte', '', 'public')");
  await H.asAdmin(db); await db.query("select app.grant_role($1, 'moderator', 'service', 'test')", [MOD]);
});
test.after(async () => { if (db) await db.close(); });

test('pensée : type, texte nettoyé, mots-dièse réellement écrits, numéro lié sans donnée privée', async () => {
  await as(ADULT);
  const id = (await q1("select api.note_create('theory', $1, $2, $3, 'public', true) id",
    ['Le méchant est son père #AbsoluteBatman #Théorie', ['AbsoluteBatman', 'Théorie', 'Absent', 'x', '<b>'], { series: 'Absolute Batman', issue: '#5', publisher: 'DC', price: 4.99 }])).id;
  const p = await q1('select kind, body, payload, spoiler, visibility from community.posts where id = $1', [id]);
  assert.equal(p.kind, 'note'); assert.equal(p.spoiler, true);
  assert.equal(p.payload.note, 'theory'); assert.equal(p.payload.verdict, 'open');
  assert.deepEqual(p.payload.issue, { series: 'Absolute Batman', issue: '#5', publisher: 'DC' });
  const tags = (await db.query('select tag::text t from community.post_tags where post_id = $1 order by 1', [id])).rows.map(r => r.t);
  assert.deepEqual(tags, ['AbsoluteBatman', 'Théorie']);
  await assert.rejects(db.query("select api.note_create('thought', '   ', null, null, 'public')"), /empty/);
  await assert.rejects(db.query("select api.note_create('thought', $1, null, null, 'public')", ['x'.repeat(2001)]), /too_long/);
  assert.ok(await db.query("select api.note_create('thought', $1, null, null, 'public') as id", ['Une longue pensée. '.repeat(90)]), 'une pensée de 1 700 caractères passe');
  await assert.rejects(db.query("select api.note_create('thought', '<script>x</script>', null, null, 'public')"), /markup_refused/);
  await assert.rejects(db.query("select api.note_create('poeme', 'ok', null, null, 'public')"), /invalid_post/);
});

test('verdict de théorie : l\'auteur seul, valeurs fermées', async () => {
  await as(ADULT);
  const id = (await q1("select id from community.posts where kind = 'note' and author_id = $1", [ADULT])).id;
  await as(ADULT2);
  await assert.rejects(db.query("select api.note_verdict($1, 'busted')", [id]), /not_found/);
  await as(ADULT);
  await assert.rejects(db.query("select api.note_verdict($1, 'peut-être')", [id]), /invalid_verdict/);
  assert.equal((await q1("select api.note_verdict($1, 'confirmed') r", [id])).r.verdict, 'confirmed');
  const q = (await q1("select api.note_create('question', 'Qui lit Saga ? #Saga', array['Saga'], null, 'public') id")).id;
  await assert.rejects(db.query("select api.note_verdict($1, 'confirmed')", [q]), /not_found/);
});

test('tendances : seulement ce que l\'appelant peut voir, fusion de la casse', async () => {
  await as(ADULT2);
  await db.query("select api.note_create('thought', 'Encore #saga', array['saga'], null, 'public')");
  await db.query("select api.note_create('thought', 'Secret #Privé', array['Privé'], null, 'private')");
  const tr = (await q1('select api.trending_tags(10) r')).r;
  assert.equal(tr[0].tag.toLowerCase(), 'saga');
  await as(R1);
  const seen = (await q1('select api.trending_tags(10) r')).r.map(x => x.tag);
  assert.ok(!seen.includes('Privé'), 'une publication privée ne fait pas tendance pour les autres');
  assert.ok(seen.some(t => t.toLowerCase() === 'absolutebatman'));
  await as(TEEN);
  // Un mineur voit les publications publiques d'adultes (non « mature »), comme en migration 13
  assert.ok((await q1('select api.trending_tags(5) r')).r.length >= 1);
});

test('J\'aime : réaction « like » et forme choisie parmi les douze dessins', async () => {
  await as(R1);
  const pid = (await q1("select id from community.posts where kind = 'note' and author_id = $1 limit 1", [ADULT])).id;
  assert.equal((await q1("select api.react($1, 'like') r", [pid])).r.status, 'reacted');
  assert.equal((await q1('select api.set_like_icon($1) r', ['claws'])).r.like_icon, 'claws');
  await assert.rejects(db.query("select api.set_like_icon('Logo Éditeur!')"), /invalid_icon/);
  assert.equal((await q1("select api.set_like_icon('roi-panthere') r")).r.like_icon, 'roi-panthere');
  await db.query("select api.set_like_icon('claws')");
  assert.equal((await q1("select like_icon from community.members where handle = 'lecteur_r1'")).like_icon, 'claws');
});

let room;
test('direct en duel : camps obligatoires, ouverture par l\'hôte seul, chat et votes', async () => {
  await as(ADULT);
  await assert.rejects(db.query("select api.live_create('Duel', 'duel', 'A', '', 'public')"), /sides_required/);
  room = (await q1("select api.live_create('Absolute ou Ultimate ?', 'duel', 'Absolute Batman', 'Ultimate Spider-Man', 'public') id")).id;
  await as(R1);
  await assert.rejects(db.query("select api.live_say($1, 'trop tôt')", [room]), /not_live/);
  await assert.rejects(db.query("select api.live_set_status($1, 'live')", [room]), /not_found/);
  await as(ADULT); await db.query("select api.live_set_status($1, 'live')", [room]);
  await as(R1);
  const m1 = (await q1("select api.live_say($1, 'Preuve : la page 12') id", [room])).id;
  await assert.rejects(db.query("select api.live_say($1, '<img src=x>')", [room]), /markup_refused/);
  await assert.rejects(db.query('select api.live_say($1, $2)', [room, 'x'.repeat(201)]), /too_long/);
  await db.query('select api.live_vote($1, 0)', [room]);
  await db.query('select api.live_vote($1, 1)', [room]); // on peut changer d'avis : un seul vote par membre
  await as(R2); await db.query('select api.live_vote($1, 1)', [room]);
  await as(ADULT2); await db.query('select api.live_vote($1, 0)', [room]);
  await assert.rejects(db.query('select api.live_vote($1, 2)', [room]), /invalid_side/);
  assert.deepEqual((await q1('select api.live_tally($1) r', [room])).r, { a: 1, b: 2 });
  // Votes : chacun ne lit que le sien
  assert.equal((await db.query('select * from community.live_votes where room_id = $1', [room])).rows.length, 1);
  // Les messages se lisent sous RLS
  assert.equal((await db.query('select body from community.live_messages where room_id = $1', [room])).rows[0].body, 'Preuve : la page 12');
  // L'hôte retire un message (journalisé), l'auteur supprime le sien
  await as(ADULT); await db.query('select api.live_unsay($1)', [m1]);
  await as(R2); await assert.rejects(db.query('select api.live_unsay($1)', [m1]), /forbidden/);
  await as(ADULT2);
  assert.equal((await db.query('select 1 from community.live_messages where id = $1', [m1])).rows.length, 0);
  await H.asAdmin(db);
  assert.equal((await q1("select count(*)::int n from community.moderation_log where target_kind = 'live_message' and action = 'remove'")).n, 1);
});

test('direct : blocage et protection des mineurs', async () => {
  await as(ADULT); await db.query('select api.block($1)', [R2]);
  await as(R2);
  await assert.rejects(db.query("select api.live_say($1, 'coucou')", [room]), /not_live/);
  assert.equal((await db.query('select 1 from community.live_rooms where id = $1', [room])).rows.length, 0);
  await as(ADULT); await db.query('select api.unblock($1)', [R2]);
  // Un salon d'un mineur n'est jamais visible d'un adulte
  await as(TEEN);
  const teenRoom = (await q1("select api.live_create('Mon club', 'review', '', '', 'followers') id")).id;
  await assert.rejects(db.query("select api.live_create('Public ?', 'review', '', '', 'everyone')"), /invalid_room/);
  await as(ADULT2);
  assert.equal((await db.query('select 1 from community.live_rooms where id = $1', [teenRoom])).rows.length, 0);
});

test('signalements de direct : masquage à trois, immédiat pour la sécurité d\'un mineur ; modération journalisée', async () => {
  await as(R1);
  const m = (await q1("select api.live_say($1, 'message limite') id", [room])).id;
  await as(ADULT2); assert.equal((await q1("select api.report_live('live_message', null, $1, 'spam') r", [m])).r.hidden, false);
  assert.equal((await q1("select api.report_live('live_message', null, $1, 'spam') r", [m])).r.status, 'already_reported');
  await as(R2); await db.query("select api.report_live('live_message', null, $1, 'spam')", [m]);
  await as(TEEN);
  // Salon public d'un adulte : un mineur le voit et peut signaler (masquage au troisième signalement)
  assert.equal((await q1("select api.report_live('live_message', null, $1, 'harassment') r", [m])).r.hidden, true);
  await as(ADULT2);
  assert.equal((await db.query('select 1 from community.live_messages where id = $1', [m])).rows.length, 0);
  await as(R1);
  await assert.rejects(db.query("select api.report_live('live_message', null, $1, 'spam')", [m]), /not_found/); // son propre message
  await as(R2);
  assert.equal((await q1("select api.report_live('live_room', $1, null, 'minor_safety') r", [room])).r.hidden, true);
  await as(ADULT2);
  assert.equal((await db.query('select 1 from community.live_rooms where id = $1', [room])).rows.length, 0);
  await as(R1);
  await assert.rejects(db.query("select api.mod_live($1, 'restore', 'ok')", [room]), /forbidden/);
  await as(MOD);
  await assert.rejects(db.query("select api.mod_live($1, 'restore', '  ')", [room]), /reason_required/);
  await db.query("select api.mod_live($1, 'restore', 'Signalement non fondé')", [room]);
  await as(ADULT2);
  assert.equal((await db.query('select 1 from community.live_rooms where id = $1', [room])).rows.length, 1);
  await as(ADULT); await db.query("select api.live_set_status($1, 'ended')", [room]);
  await as(R1); await assert.rejects(db.query("select api.live_say($1, 'après la fin')", [room]), /not_live/);
});

test('limites : 30 messages par minute dans le chat', async () => {
  await as(ADULT);
  const r = (await q1("select api.live_create('Chat rapide', 'qa', '', '', 'public') id")).id;
  await db.query("select api.live_set_status($1, 'live')", [r]);
  await as(ADULT2);
  for (let i = 0; i < 30; i++) await db.query('select api.live_say($1, $2)', [r, 'message ' + i]);
  await assert.rejects(db.query("select api.live_say($1, 'un de trop')", [r]), /rate_limited/);
});

test('aucune écriture directe ni accès anonyme aux nouvelles tables', async () => {
  await as(ADULT);
  for (const sql of [
    "insert into community.live_messages (room_id, author_id, body) values (gen_random_uuid(), '" + ADULT + "', 'x')",
    "update community.live_rooms set status = 'live'",
    "insert into community.live_votes (room_id, user_id, side) values (gen_random_uuid(), '" + ADULT + "', 0)",
    "delete from community.post_tags"
  ]) assert.equal((await H.tryQuery(db, sql)).ok, false, sql);
  await H.asAnon(db);
  for (const sql of ['select * from community.live_rooms', "select api.live_tally('" + R1 + "')", "select api.trending_tags(5)"]) {
    assert.equal((await H.tryQuery(db, sql)).ok, false, sql);
  }
});

test('suppression du compte : salons, messages, votes et mots-dièse disparaissent en cascade', async () => {
  await H.asAdmin(db);
  await db.query('delete from auth.users where id = $1', [ADULT]);
  assert.equal((await q1('select count(*)::int n from community.live_rooms where host_id = $1', [ADULT])).n, 0);
  assert.equal((await q1("select count(*)::int n from community.post_tags t join community.posts p on p.id = t.post_id where p.author_id = $1", [ADULT])).n, 0);
});
