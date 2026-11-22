'use strict';
// D-113 (migration 19) : pros et sceau Encré, marché, Le Comptoir, messages chiffrés, offres. Base PGlite locale.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');
const DM = require('../../domains/community/dm-core');

const ALEX = H.USER_A, BOB = H.USER_B;
const TEEN = '33333333-3333-4333-8333-333333333333', MOD = '44444444-4444-4444-8444-444444444444';
const ED = '55555555-5555-4555-8555-555555555555', R1 = '66666666-6666-4666-8666-666666666666', R2 = '77777777-7777-4777-8777-777777777777';
const Y = new Date().getFullYear();

let db;
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const as = (uid, aal) => H.asUser(db, uid, aal);
test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, ALEX, BOB, TEEN, MOD, ED, R1, R2);
  const join = async (u, h, y) => { await as(u); await db.query('select api.community_join($1, $2, true)', [h, y]); };
  await join(ALEX, 'alex_encre', 1990); await join(BOB, 'bob_lecteur', 1985); await join(TEEN, 'ado_fan', Y - 16);
  await join(MOD, 'moderation', 1990); await join(ED, 'maison_test', 1980); await join(R1, 'lecteur_un', 1991); await join(R2, 'lecteur_deux', 1992);
  await H.asAdmin(db); await db.query("select app.grant_role($1, 'moderator', 'service', 'test')", [MOD]);
});
test.after(async () => { if (db) await db.close(); });

test('pros : profil réservé aux adultes, sceau Encré seulement par l\'équipe, perdu si l\'identité change', async () => {
  await as(TEEN);
  await assert.rejects(db.query("select api.pro_profile_save('creator', 'Ado', '{artist}', '', '{}', '[]', false, '')"), /adult_only/);
  await as(ALEX);
  await assert.rejects(db.query("select api.pro_profile_save('creator', 'Alex Encre', '{artist}', '', '{http://x.example}', '[]', true, 'Liège')"), /invalid_link/);
  await db.query("select api.pro_profile_save('creator', 'Alex Encre', '{writer,artist}', 'Autrice', '{https://alex.example}', '[{\"title\":\"Nuit Rouge\",\"year\":2024}]', true, 'Liège')");
  await assert.rejects(db.query("select api.pro_apply('{credits}')"), /evidence_missing/);
  assert.equal((await q1("select api.pro_apply('{credits,portfolio,contact}') r")).r.status, 'pending');
  assert.equal((await q1("select api.pro_get('alex_encre') r")).r.seal, null, 'pas de sceau en attente');
  await assert.rejects(db.query("select api.pro_decide($1, true, 'moi')", [ALEX]), /forbidden/);
  await as(MOD, 'aal1'); await assert.rejects(db.query("select api.pro_decide($1, true, 'ok')", [ALEX]), /forbidden/);
  await as(MOD); assert.equal((await q1("select api.pro_decide($1, true, 'Crédits vérifiés chez l''éditeur') r", [ALEX])).r.status, 'verified');
  await as(BOB); assert.equal((await q1("select api.pro_get('alex_encre') r")).r.seal, 'creator');
  await as(TEEN); assert.equal((await q1("select api.pro_get('alex_encre') r")).r.seal, 'creator', 'un mineur voit les profils d\'adultes, comme le fil');
  // Une maison d'édition passe par la même vérification ; changer de nom retire le sceau
  await as(ED); await db.query("select api.pro_profile_save('publisher', 'Maison Test', '{}', '', '{https://maison.example}', '[]', false, '')");
  await db.query("select api.pro_apply('{company,domain,mandate,site}')");
  await as(MOD); await db.query("select api.pro_decide($1, true, 'BCE et domaine vérifiés')", [ED]);
  await as(ED); assert.equal((await q1("select api.pro_profile_save('publisher', 'Autre Nom', '{}', '', '{}', '[]', false, '') r")).r.status, 'draft');
  await H.asAdmin(db); assert.equal((await q1('select count(*)::int n from pro.applications where user_id = $1', [ED])).n, 1);
  assert.equal((await q1("select count(*)::int n from information_schema.columns where table_schema = 'pro' and column_name ~ 'evidence|document|piece'")).n, 0, 'aucune pièce stockée');
});

test('L\'Atelier : annonces sans coordonnées, invisibles des mineurs', async () => {
  await as(ALEX);
  await assert.rejects(db.query("select api.collab_post('seek', 'colorist', 'Coloriste pour un one-shot', 'Écrivez-moi à alex@exemple.be pour le projet de 24 pages.', 'share', true, '')"), /contact_refused/);
  await db.query("select api.collab_post('seek', 'colorist', 'Coloriste pour un one-shot', 'Projet de 24 pages, science-fiction, scénario bouclé, dessin en cours.', 'share', true, '')");
  await as(BOB); const L = (await q1("select api.collab_list('colorist') l")).l;
  assert.equal(L.length, 1); assert.equal(L[0].seal, 'creator');
  await as(TEEN); assert.deepEqual((await q1('select api.collab_list() l')).l, []);
});

test('marché : fermé sans taux décidé, réservé aux adultes, pas de paiement hors Panel', async () => {
  await as(TEEN);
  await assert.rejects(db.query("select api.listing_create('Batman', '1', 'DC', 1000, 'EUR', 'nm', '{relay}', '', 'BE', '', 1)"), /adult_only/);
  await as(ALEX);
  await assert.rejects(db.query("select api.listing_create('Batman', '1', 'DC', 1000, 'EUR', 'nm', '{relay}', '', 'BE', 'Paiement par virement', 1)"), /off_platform_refused/);
  await assert.rejects(db.query("select api.listing_create('Batman', '1', 'DC', 1000, 'EUR', 'nm', '{hand}', '', 'BE', '', 1)"), /check constraint|violates/);
  await assert.rejects(db.query("select api.listing_create('Batman', '1', 'DC', 1000, 'EUR', 'nm', '{relay}', '', 'BE', '', 0)"), /photo_required/);
  const id = (await q1("select api.listing_create('Absolute Batman', '1', 'DC', 2450, 'EUR', 'nm', '{relay,hand}', 'Liège', 'BE', 'Lu une fois.', 2) id")).id;
  await as(BOB);
  assert.equal((await q1("select api.market_list('absolute') l")).l.length, 1);
  await assert.rejects(db.query("select api.order_reserve($1, 'relay')", [id]), /market_closed/);
  await as(TEEN); assert.deepEqual((await q1("select api.market_list('') l")).l, []);
  await assert.rejects(db.query('select * from market.listings'), /permission denied/);
});

test('vente : séquestre par le prestataire, chaque étape par la bonne personne, remise en main propre par code', async () => {
  await H.asAdmin(db); await db.query('update market.settings set fee_rate = 0.07');
  await as(BOB);
  const id = (await q1("select l->>'id' id from jsonb_array_elements(api.market_list('absolute')) l")).id;
  await assert.rejects(db.query("select api.order_reserve($1, 'parcel')", [id]), /invalid_delivery/);
  const r = (await q1("select api.order_reserve($1, 'hand') r", [id])).r;
  assert.equal(r.fee_cents, 172);
  const ord = r.order;
  // Un membre ne peut pas se déclarer payé : seul le rôle service (prestataire de paiement) le fait
  await assert.rejects(db.query("select api.order_step($1, 'pay')", [ord]), /invalid_transition/);
  await as(ALEX); await assert.rejects(db.query("select api.order_step($1, 'pay')", [ord]), /invalid_transition/);
  await H.asAdmin(db); assert.equal((await q1("select api.order_step($1, 'pay') r", [ord])).r.state, 'paid');
  await as(R1); await assert.rejects(db.query("select api.order_step($1, 'handover', '000000')", [ord]), /not_found/);
  await as(BOB); const code = (await q1('select api.order_handover_code($1) r', [ord])).r.code;
  assert.match(code, /^\d{6}$/);
  await as(ALEX);
  await assert.rejects(db.query("select api.order_step($1, 'handover', '999999x')", [ord]), /invalid_code/);
  assert.equal((await q1("select api.order_step($1, 'handover', $2) r", [ord, code])).r.state, 'completed');
  await H.asAdmin(db);
  assert.equal((await q1('select status from market.listings where id = $1', [id])).status, 'sold');
  assert.equal((await q1('select count(*)::int n from market.order_events where order_id = $1', [ord])).n, 3);
  assert.equal((await q1("select count(*)::int n from market.orders where handover_hash = $1", [code])).n, 0, 'code haché');
});

test('Le Comptoir : sujets, un vote par membre, débats, séparation adultes et mineurs, contenu adulte', async () => {
  await as(ALEX);
  await assert.rejects(db.query("select api.thread_create('debats', 'Qui gagne ce duel ?', '', 'debate', '{Hulk}', '', false)"), /check constraint|violates/);
  const th = (await q1("select api.thread_create('debats', 'Hulk contre la Chose, qui gagne ?', 'Arguments bienvenus', 'debate', '{Hulk,La Chose}', '', false) id")).id;
  await assert.rejects(db.query('select api.forum_vote($1, 1)', [th]), /own_content/);
  for (const u of [BOB, R1, R2]) { await as(u); await db.query('select api.forum_vote($1, 1)', [th]); }
  await as(BOB); assert.equal((await q1('select api.forum_vote($1, 1) r', [th])).r.dir, 0, 'recliquer annule');
  await db.query('select api.forum_vote($1, -1)', [th]);
  await db.query('select api.forum_side($1, 0)', [th]); await db.query('select api.forum_side($1, 1)', [th]);
  await H.asAdmin(db); const t = await q1('select up, down, side_a, side_b from forum.threads where id = $1', [th]);
  assert.deepEqual(t, { up: 2, down: 1, side_a: 0, side_b: 1 });
  await as(R1); const c1 = (await q1("select api.comment_create($1, null, 'La Chose, sans hésiter') id", [th])).id;
  await as(R2); await db.query("select api.comment_create($1, $2, 'Hulk enragé ne connaît pas de limite')", [th, c1]);
  assert.equal((await q1('select jsonb_array_length(api.forum_comments($1)) n', [th])).n, 2);
  // Un mineur voit le sujet d'un adulte ; un adulte ne voit pas celui d'un mineur ; contenu adulte caché aux mineurs
  await as(TEEN);
  const tt = (await q1("select api.thread_create('lecture', 'Par quel comics Spider-Man commencer ?', '', 'question', '{}', '', true) id")).id;
  assert.ok((await q1("select api.forum_threads('debats') l")).l.some(x => x.id === th));
  await as(ALEX);
  assert.ok(!(await q1('select api.forum_threads() l')).l.some(x => x.id === tt));
  await assert.rejects(db.query("select api.comment_create($1, null, 'Bonjour')", [tt]), /not_found/);
  const adultT = (await q1("select api.thread_create('collection', 'Couvertures variantes osées', '', 'show', '{}', '', true) id")).id;
  await as(TEEN); assert.ok(!(await q1('select api.forum_threads() l')).l.some(x => x.id === adultT));
  await H.asAdmin(db); assert.equal((await q1('select mature from forum.threads where id = $1', [tt])).mature, false, 'un mineur ne peut pas marquer « adultes »');
});

test('Le Comptoir : signalement, masquage au troisième ou immédiat pour la sécurité d\'un mineur ; Guardian s\'applique', async () => {
  await as(BOB); const th = (await q1("select api.thread_create('theories', 'Le prochain Galactus sera une femme', '', 'theory', '{}', '', false) id")).id;
  for (const u of [ALEX, R1]) { await as(u); assert.equal((await q1("select api.forum_report($1, 'spam') r", [th])).r.hidden, false); }
  await as(R2); assert.equal((await q1("select api.forum_report($1, 'spam') r", [th])).r.hidden, true);
  // Restriction Guardian (migration 18) : plus de sujet ni de réponse
  await as(MOD); await db.query("select api.restriction_set($1, 'no_post', 'Spam répété', 2)", [R2]);
  await as(R2); await assert.rejects(db.query("select api.thread_create('debats', 'Encore un sujet de spam', '', 'question', '{}', '', false)"), /guardian_restricted/);
});

test('messages : chiffrés de bout en bout, demande d\'abord, jamais avec un mineur, l\'équipe ne lit rien', async () => {
  const A = await DM.createIdentity(), B = await DM.createIdentity(), T = await DM.createIdentity();
  await as(TEEN); await assert.rejects(db.query('select api.dm_key_set($1)', [T.publicJwk]), /adult_only/);
  await as(ALEX); await db.query('select api.dm_key_set($1)', [A.publicJwk]);
  await as(BOB); await db.query('select api.dm_key_set($1)', [B.publicJwk]);
  await as(ALEX);
  await assert.rejects(db.query("select api.dm_open('ado_fan')"), /minor_protected/);
  const c = (await q1("select api.dm_open('bob_lecteur') r")).r;
  assert.equal(c.status, 'request'); assert.equal(c.their_key.x, B.publicJwk.x);
  const kA = await DM.conversationKey(A.privateKey, c.their_key, c.id);
  const box1 = await DM.seal(kA, 'Salut, ton Absolute Batman est toujours dispo ?', { conversationId: c.id, senderId: ALEX, seq: 1 });
  await db.query('select api.dm_send($1, $2)', [c.id, box1]);
  const box2 = await DM.seal(kA, 'Encore moi', { conversationId: c.id, senderId: ALEX, seq: 2 });
  await assert.rejects(db.query('select api.dm_send($1, $2)', [c.id, box2]), /request_pending/);
  await as(R1); await assert.rejects(db.query('select api.dm_send($1, $2)', [c.id, box2]), /not_found/);
  assert.deepEqual((await q1('select api.dm_messages($1) l', [c.id])).l, []);
  await as(BOB);
  assert.equal((await q1('select api.dm_respond($1, true) r', [c.id])).r.status, 'active');
  const got = (await q1('select api.dm_messages($1) l', [c.id])).l;
  const kB = await DM.conversationKey(B.privateKey, A.publicJwk, c.id);
  assert.equal(await DM.open(kB, got[0].box, { conversationId: c.id, senderId: ALEX }), 'Salut, ton Absolute Batman est toujours dispo ?');
  // Conversation acceptée : le serveur refuse tout ce qui n'a pas la forme d'un message chiffré
  await as(ALEX);
  await assert.rejects(db.query('select api.dm_send($1, $2)', [c.id, { v: 1, alg: DM.ALG, iv: 'AAAAAAAAAAAAAAAA', ct: 'Ceci est du texte en clair !', seq: 3 }]), /check constraint|violates/);
  await assert.rejects(db.query('select api.dm_send($1, $2)', [c.id, { ...box2, text: 'en clair' }]), /check constraint|violates/);
  await db.query('select api.dm_send($1, $2)', [c.id, box2]);
  await as(BOB);
  // Le serveur et l'équipe ne voient aucun texte clair
  await H.asAdmin(db);
  assert.ok(!/Batman/.test(JSON.stringify((await db.query('select * from messaging.messages')).rows)));
  await as(MOD); await assert.rejects(db.query('select * from messaging.messages'), /permission denied/);
  assert.deepEqual((await q1('select api.dm_messages($1) l', [c.id])).l, []);
  // Signalement : seuls les messages choisis par la personne partent à l'équipe ; la conversation se ferme
  await as(BOB); await db.query("select api.dm_report($1, 'scam', $2)", [c.id, ['Salut, ton Absolute Batman est toujours dispo ?']]);
  await as(ALEX); await assert.rejects(db.query('select api.dm_send($1, $2)', [c.id, box2]), /closed/);
  // Blocage et préférence « Encré seulement »
  await as(R1); await db.query('select api.dm_key_set($1)', [T.publicJwk]); await db.query("select api.dm_prefs_set('verified')");
  await as(BOB); await assert.rejects(db.query("select api.dm_open('lecteur_un')"), /verified_only/);
  await as(ALEX); assert.equal((await q1("select api.dm_open('lecteur_un') r")).r.status, 'request', 'Alex est Encrée');
  await as(R1); await db.query('select api.block($1)', [ALEX]);
  await as(ALEX); await assert.rejects(db.query("select api.dm_open('lecteur_un')"), /blocked/);
});

test('offres : aucun prix fixé, abonnement écrit par le prestataire seulement, suppression du compte en cascade', async () => {
  await as(BOB);
  const p = (await q1('select api.my_plans() r')).r;
  assert.ok(p.plans.every(x => x.price_cents === null)); assert.deepEqual(p.active, []);
  await assert.rejects(db.query("insert into billing.subscriptions values ($1, 'plus', 'active', 'x', now() + interval '1 month')", [BOB]), /permission denied/);
  await H.asAdmin(db);
  await db.query('select app.delete_account($1)', [ALEX]);
  for (const t of ['pro.profiles where user_id', 'pro.collabs where author_id', 'market.listings where seller_id', 'forum.threads where author_id', 'messaging.keys where user_id', 'messaging.messages where sender_id']) {
    assert.equal((await q1(`select count(*)::int n from ${t} = $1`, [ALEX])).n, 0, t);
  }
});
