'use strict';
// D-114 (migration 20) : messages façon Signal, vérification par type de compte, offres, favoris, avis, droits Panel+. Base PGlite locale.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');
const R = require('../../domains/community/dm-ratchet');

const ALEX = H.USER_A, BOB = H.USER_B;
const TEEN = '33333333-3333-4333-8333-333333333333', MOD = '44444444-4444-4444-8444-444444444444';
const ED = '55555555-5555-4555-8555-555555555555', SHOP = '66666666-6666-4666-8666-666666666666';
const Y = new Date().getFullYear();
const HASH = 'a'.repeat(64);

let db;
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const as = (uid, aal) => H.asUser(db, uid, aal);
test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, ALEX, BOB, TEEN, MOD, ED, SHOP);
  const join = async (u, h, y) => { await as(u); await db.query('select api.community_join($1, $2, true)', [h, y]); };
  await join(ALEX, 'alex_encre', 1990); await join(BOB, 'bob_lecteur', 1985); await join(TEEN, 'ado_fan', Y - 16);
  await join(MOD, 'moderation', 1990); await join(ED, 'maison_test', 1980); await join(SHOP, 'comic_shop', 1979);
  await H.asAdmin(db); await db.query("select app.grant_role($1, 'moderator', 'service', 'test')", [MOD]);
});
test.after(async () => { if (db) await db.close(); });

test('messages : paquet de préclés, préclé à usage unique donnée une seule fois, double cliquet de bout en bout, minuteur', async () => {
  const ia = await R.createIdentity(), ib = await R.createIdentity();
  const pb = await R.createPrekeys(ib, 2, 1);
  await as(BOB);
  await assert.rejects(db.query('select api.dm_bundle_publish($1, $2, 1, $3, $4, $5)', ['pas-une-cle', pb.bundle.sik, pb.bundle.spk, pb.bundle.spkSig, '[]']), /check constraint|violates/);
  const pub = (await q1('select api.dm_bundle_publish($1, $2, 1, $3, $4, $5) r', [pb.bundle.ik, pb.bundle.sik, pb.bundle.spk, pb.bundle.spkSig, JSON.stringify(pb.bundle.opk)])).r;
  assert.equal(pub.prekeys, 2);
  await as(TEEN); await assert.rejects(db.query("select api.dm_bundle_get('bob_lecteur')"), /minor_protected/);
  await as(ALEX);
  const b1 = (await q1("select api.dm_bundle_get('bob_lecteur') r")).r;
  const b2 = (await q1("select api.dm_bundle_get('bob_lecteur') r")).r;
  assert.notEqual(b1.opk.id, b2.opk.id, 'chaque préclé à usage unique n\'est donnée qu\'une fois');
  assert.equal((await q1("select api.dm_bundle_get('bob_lecteur') r")).r.opk, null, 'plus de préclé : la session se fait sans');
  await as(BOB); assert.equal((await q1('select api.dm_prekeys_left() n')).n, 0);
  // Session X3DH puis double cliquet ; le serveur ne voit que l'enveloppe
  await as(ALEX);
  const bundle = { ik: b1.ik, sik: b1.sik, spk: b1.spk, spkSig: b1.spkSig };
  const x = await R.x3dhInitiate(ia, bundle, b1.opk);
  let sa = await R.initSender(x.sk, b1.spk, x.ad), m;
  [sa, m] = await R.encrypt(sa, 'Salut Bob, tu vends ton Daredevil 181 ?');
  m.init = x.init;
  const conv = (await q1("select api.dm_open('bob_lecteur') r")).r;
  assert.equal(conv.v2, true);
  await assert.rejects(db.query('select api.dm_send2($1, $2)', [conv.id, JSON.stringify({ ...m, ct: 'Salut en clair' })]), /invalid_box/);
  assert.equal((await q1('select api.dm_send2($1, $2) r', [conv.id, JSON.stringify(m)])).r.seq, 1);
  await H.asAdmin(db);
  const stored = (await q1('select box::text b from messaging.messages where conversation_id = $1', [conv.id])).b;
  assert.doesNotMatch(stored, /Daredevil/, 'aucun texte clair côté serveur');
  await as(BOB); await db.query('select api.dm_respond($1, true)', [conv.id]);
  const got = (await q1('select api.dm_messages($1) r', [conv.id])).r[0].box;
  const resp = await R.x3dhRespond(ib, pb.secret, got.init);
  const sb = await R.initReceiver(resp.sk, pb.secret.spk, resp.ad);
  const [sb2, text] = await R.decrypt(sb, got);
  assert.equal(text, 'Salut Bob, tu vends ton Daredevil 181 ?');
  // Minuteur : un message éphémère n'est plus servi après l'échéance, puis il est purgé
  await assert.rejects(db.query('select api.dm_timer_set($1, 42)', [conv.id]), /invalid_timer/);
  await db.query('select api.dm_timer_set($1, 300)', [conv.id]);
  let s2 = sb2, m2; [s2, m2] = await R.encrypt(s2, 'Ce message disparaît.');
  assert.equal((await q1('select api.dm_send2($1, $2) r', [conv.id, JSON.stringify(m2)])).r.timer, 300);
  await H.asAdmin(db); await db.query("update messaging.messages set expires_at = now() - interval '1 second' where conversation_id = $1 and expires_at is not null", [conv.id]);
  await as(ALEX); assert.equal((await q1('select api.dm_messages($1) r', [conv.id])).r.length, 1);
  await assert.rejects(db.query('select messaging.purge_expired()'), /permission denied/);
  await H.asAdmin(db); assert.equal((await q1('select messaging.purge_expired() n')).n, 1);
});

test('vérification : contrôles automatiques réels, empreintes seulement, examen en double authentification, pastille d\'un an', async () => {
  const base = '04123456', bce = base + String(97 - (Number(base) % 97)).padStart(2, '0');
  await as(ED); await db.query("select api.pro_profile_save('publisher', 'Maison Test', '{}', '', '{https://maison.example}', '[]', false, '')");
  const all = '{company,domain_email,mandate,identity,catalogue}';
  const att = JSON.stringify([{ key: 'mandate', sha256: HASH, bytes: 20000, ext: 'pdf' }]);
  await assert.rejects(db.query("select api.verify_submit('{company}', 'BE', $1, 'https://maison.example', 'presse@maison.example', '', $2)", [bce, att]), /evidence_missing/);
  await assert.rejects(db.query("select api.verify_submit($1, 'BE', '0412345600', 'https://maison.example', 'presse@maison.example', '', $2)", [all, att]), /company_number_invalid/);
  await assert.rejects(db.query("select api.verify_submit($1, 'BE', $2, 'https://maison.example', 'maison@gmail.com', '', $3)", [all, bce, att]), /domain_mismatch/);
  const i12 = '978236577201', okDigit = [...Array(10).keys()].find(k => { let s = 0; for (let i = 0; i < 13; i++) s += Number((i12 + k)[i]) * (i % 2 ? 3 : 1); return s % 10 === 0; });
  await assert.rejects(db.query("select api.verify_submit($1, 'BE', $2, 'https://maison.example', 'presse@maison.example', $3, $4)", [all, bce, i12 + ((okDigit + 1) % 10), att]), /isbn_invalid/);
  assert.equal((await q1('select pro.isbn_ok($1) ok', [i12 + okDigit]).catch(() => ({ ok: 'refusé' }))).ok, 'refusé', 'fonction interne non exposée');
  await assert.rejects(db.query("select api.verify_submit($1, 'BE', $2, 'https://maison.example', 'presse@maison.example', '', $3)", [all, bce, JSON.stringify([{ key: 'mandate', sha256: 'zz', bytes: 1, ext: 'exe' }])]), /invalid_attest/);
  const r = (await q1("select api.verify_submit($1, 'BE', $2, 'https://maison.example', 'presse@maison.example', '', $3) r", [all, bce, att])).r;
  assert.equal(r.company_ok, true); assert.equal(r.domain_ok, true); assert.match(r.proof_code, /^PANEL-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal((await q1('select api.verify_status() r')).r.seal, null, 'aucune pastille avant la décision');
  // Équipe : double authentification obligatoire ; on ne s'examine pas soi-même
  await as(MOD, 'aal1'); await assert.rejects(db.query("select api.verify_review($1, 'take')", [ED]), /forbidden/);
  await as(MOD); assert.equal((await q1('select api.verify_queue() q')).q.length, 1);
  await assert.rejects(db.query("select api.verify_review($1, 'approve')", [ED]), /invalid_transition/);
  await db.query("select api.verify_review($1, 'take')", [ED]);
  assert.equal((await q1("select api.verify_review($1, 'ask', null, 'Mandat non signé') r", [ED])).r.stage, 'needs_more');
  await as(ED); await db.query("select api.verify_submit($1, 'BE', $2, 'https://maison.example', 'presse@maison.example', '', $3)", [all, bce, att]);
  await as(MOD); await db.query("select api.verify_review($1, 'take')", [ED]);
  assert.equal((await q1("select api.verify_review($1, 'approve', null, 'BCE, domaine et mandat vérifiés') r", [ED])).r.status, 'verified');
  await as(BOB); assert.equal((await q1("select api.pro_get('maison_test') r")).r.seal, 'publisher');
  // Après un an, la pastille disparaît jusqu'au renouvellement ; les empreintes sont effacées 30 jours après la décision
  await H.asAdmin(db);
  await db.query("update pro.profiles set verified_at = now() - interval '366 days' where user_id = $1", [ED]);
  await as(BOB); assert.equal((await q1("select api.pro_get('maison_test') r")).r.seal, null);
  await H.asAdmin(db); await db.query("update pro.applications set purge_after = now() - interval '1 day' where user_id = $1", [ED]);
  assert.equal((await q1('select pro.verify_purge() n')).n, 1);
  assert.equal((await q1("select attest::text a, company_no from pro.applications where user_id = $1 and status = 'accepted'", [ED])).a, '[]');
  // Contrôles SQL alignés sur le module verify-core
  const r2 = await q1('select pro.isbn_ok($1) a, pro.bce_ok($2) c, pro.bce_ok($3) d', [i12 + okDigit, bce, bce.slice(0, 9) + ((Number(bce[9]) + 1) % 10)]);
  assert.deepEqual(r2, { a: true, c: true, d: false });
});

test('marché : offres encadrées, acceptation qui réserve au prix de l\'offre, favoris, avis après vente terminée', async () => {
  await H.asAdmin(db); await db.query('update market.settings set fee_rate = 0.07');
  await as(SHOP);
  const lid = (await q1("select api.listing_create('Daredevil', '181', 'Marvel', 4000, 'EUR', 'vf', '{relay,hand}', 'Liège', 'BE', '', 2) id")).id;
  await as(TEEN); await assert.rejects(db.query("select api.offer_make($1, 3000, 'relay')", [lid]), /adult_only/);
  await as(BOB);
  await assert.rejects(db.query("select api.offer_make($1, 2000, 'relay')", [lid]), /offer_too_low/);
  await assert.rejects(db.query("select api.offer_make($1, 4000, 'relay')", [lid]), /buy_instead/);
  await assert.rejects(db.query("select api.offer_make($1, 3000, 'parcel')", [lid]), /invalid_delivery/);
  const o1 = (await q1("select api.offer_make($1, 3000, 'relay') r", [lid])).r.offer;
  await db.query("select api.offer_make($1, 3100, 'relay')", [lid]); await db.query("select api.offer_make($1, 3200, 'relay')", [lid]);
  await assert.rejects(db.query("select api.offer_make($1, 3300, 'relay')", [lid]), /too_many_offers/);
  assert.equal((await q1('select api.favorite_toggle($1) r', [lid])).r.favorite, true);
  assert.equal((await q1('select api.favorites_mine() r')).r.length, 1);
  await assert.rejects(db.query("select api.offer_respond($1, 'accept')", [o1]), /not_found/);
  await as(SHOP); assert.equal((await q1('select api.offers_mine() r')).r.filter(x => x.role === 'seller').length, 3);
  const acc = (await q1("select api.offer_respond($1, 'accept') r", [o1])).r;
  await H.asAdmin(db);
  const ord = await q1('select price_cents, fee_cents, state from market.orders where id = $1', [acc.order]);
  assert.deepEqual(ord, { price_cents: 3000, fee_cents: 210, state: 'reserved' });
  assert.equal((await q1("select count(*)::int n from market.offers where listing_id = $1 and status = 'declined'", [lid])).n, 2, 'les autres offres sont refusées');
  // Avis : seulement l'acheteur, après une vente terminée, une fois
  await as(BOB); await assert.rejects(db.query("select api.review_leave($1, 5, 'Parfait')", [acc.order]), /not_found/);
  await H.asAdmin(db); await db.query("select api.order_step($1, 'pay')", [acc.order]);
  await as(SHOP); await db.query("select api.order_step($1, 'ship')", [acc.order]);
  await H.asAdmin(db); await db.query("select api.order_step($1, 'deliver')", [acc.order]); await db.query("select api.order_step($1, 'autoconfirm')", [acc.order]);
  await as(BOB);
  await assert.rejects(db.query("select api.review_leave($1, 5, 'Écrivez-moi : bob@exemple.be')", [acc.order]), /contact_refused/);
  await db.query("select api.review_leave($1, 5, 'Bien emballé, conforme à la description.')", [acc.order]);
  await assert.rejects(db.query("select api.review_leave($1, 4, 'Encore')", [acc.order]), /already_reviewed/);
  const rep = (await q1("select api.seller_reputation('comic_shop') r")).r;
  assert.equal(rep.n, 1); assert.equal(Number(rep.score), 4.17); assert.equal(rep.sales, 1);
});

test('Panel+ : statistiques avancées seulement avec un abonnement actif écrit par le rôle service', async () => {
  await as(ALEX); assert.equal((await q1('select api.my_entitlements() r')).r.stats_plus, false);
  await assert.rejects(db.query("insert into billing.subscriptions values ($1, 'plus', 'active', 'x', now() + interval '1 month')", [ALEX]), /permission denied/);
  await H.asAdmin(db); await db.query("insert into billing.subscriptions values ($1, 'plus', 'active', 'prov_123', now() + interval '1 month')", [ALEX]);
  await as(ALEX); assert.equal((await q1('select api.my_entitlements() r')).r.stats_plus, true);
  await H.asAdmin(db); await db.query("update billing.subscriptions set period_end = now() - interval '1 day' where user_id = $1", [ALEX]);
  await as(ALEX); assert.equal((await q1('select api.my_entitlements() r')).r.stats_plus, false);
});
