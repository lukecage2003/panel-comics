'use strict';
// D-115 (migration 21) : suivi des ventes, numéro de suivi, annulation pour retard, litige motivé, baisses de prix des favoris. Base PGlite locale.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

const BUYER = H.USER_A, SELLER = H.USER_B, OTHER = '77777777-7777-4777-8777-777777777777';
let db;
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const as = uid => H.asUser(db, uid);
const listing = async (price, delivery) => { await as(SELLER); return (await q1("select api.listing_create('Saga', '1', 'Image', $1, 'EUR', 'nm', $2, 'Liège', 'BE', '', 1) id", [price, delivery])).id; };
const order = async (lid, delivery) => { await as(BUYER); return (await q1('select api.order_reserve($1, $2) r', [lid, delivery])).r.order; };
const sys = async (oid, action) => { await H.asAdmin(db); return db.query('select api.order_step($1, $2)', [oid, action]); };
const back = async (oid, state, days) => { await H.asAdmin(db); await db.query("update market.order_events set at = at - make_interval(days => $3) where order_id = $1 and to_state = $2", [oid, state, days]); };

test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, BUYER, SELLER, OTHER);
  const join = async (u, h) => { await as(u); await db.query('select api.community_join($1, 1990, true)', [h]); };
  await join(BUYER, 'acheteur_test'); await join(SELLER, 'vendeur_test'); await join(OTHER, 'autre_test');
  await H.asAdmin(db); await db.query('update market.settings set fee_rate = 0.07');
});
test.after(async () => { if (db) await db.close(); });

test('expédition : numéro de suivi contrôlé, vendeur seulement, frise des étapes', async () => {
  const oid = await order(await listing(2500, '{relay}'), 'relay');
  await sys(oid, 'pay');
  await as(BUYER); await assert.rejects(db.query("select api.order_ship($1, '1Z999AA10123456784')", [oid]), /not_found/);
  await as(SELLER);
  await assert.rejects(db.query("select api.order_ship($1, '<b>x</b>')", [oid]), /invalid_tracking/);
  assert.equal((await q1("select api.order_ship($1, '1z 999-aa1 0123456784') r", [oid])).r.state, 'shipped');
  const mine = (await q1('select api.orders_mine() r')).r.find(x => x.id === oid);
  assert.equal(mine.role, 'seller'); assert.equal(mine.tracking, '1Z999AA10123456784'); assert.equal(mine.fee_cents, 175);
  assert.deepEqual(mine.events.map(e => e.to), ['reserved', 'paid', 'shipped']);
  await as(BUYER);
  const b = (await q1('select api.orders_mine() r')).r.find(x => x.id === oid);
  assert.equal(b.role, 'buyer'); assert.equal(b.fee_cents, null, 'les frais du vendeur ne sont pas montrés à l’acheteur');
  await as(OTHER); assert.equal((await q1('select api.orders_mine() r')).r.length, 0);
});

test('retard : l’acheteur annule seulement après 5 jours sans expédition ; le numéro redevient disponible', async () => {
  const lid = await listing(3000, '{parcel}'), oid = await order(lid, 'parcel');
  await sys(oid, 'pay');
  await as(BUYER); await assert.rejects(db.query('select api.order_cancel_late($1)', [oid]), /not_late_yet/);
  await back(oid, 'paid', 6);
  await as(SELLER); await assert.rejects(db.query('select api.order_cancel_late($1)', [oid]), /not_found/);
  await as(BUYER); assert.equal((await q1('select api.order_cancel_late($1) r', [oid])).r.state, 'cancelled');
  await H.asAdmin(db);
  assert.equal((await q1('select status from market.listings where id = $1', [lid])).status, 'listed');
  assert.equal((await q1("select action from market.order_events where order_id = $1 order by id desc limit 1", [oid])).action, 'late_cancel');
  const hand = await order(await listing(1500, '{hand}'), 'hand');
  await sys(hand, 'pay'); await back(hand, 'paid', 9);
  await as(BUYER); await assert.rejects(db.query('select api.order_cancel_late($1)', [hand]), /invalid_transition/, 'main propre : pas de délai d’expédition');
});

test('litige : motif, description, photo selon le motif, fenêtre de 3 jours après livraison', async () => {
  const oid = await order(await listing(4000, '{relay}'), 'relay');
  await sys(oid, 'pay'); await as(SELLER); await db.query("select api.order_ship($1, 'AB12345678')", [oid]);
  await sys(oid, 'deliver');
  await as(BUYER);
  await assert.rejects(db.query("select api.order_dispute($1, 'nope', 'Le coin est plié, la couverture abîmée.', 1)", [oid]), /invalid_reason/);
  await assert.rejects(db.query("select api.order_dispute($1, 'damaged', 'Abîmé', 1)", [oid]), /invalid_body/);
  await assert.rejects(db.query("select api.order_dispute($1, 'damaged', 'Le coin est plié, la couverture abîmée.', 0)", [oid]), /photo_required/);
  assert.equal((await q1("select api.order_dispute($1, 'damaged', 'Le coin est plié, la couverture abîmée.', 2) r", [oid])).r.state, 'disputed');
  await H.asAdmin(db);
  assert.deepEqual(await q1('select dispute_reason, dispute_photos from market.orders where id = $1', [oid]), { dispute_reason: 'damaged', dispute_photos: 2 });
  const late = await order(await listing(2000, '{relay}'), 'relay');
  await sys(late, 'pay'); await as(SELLER); await db.query("select api.order_ship($1, 'AB12345679')", [late]);
  await sys(late, 'deliver'); await back(late, 'delivered', 4);
  await as(BUYER); await assert.rejects(db.query("select api.order_dispute($1, 'not_received', 'Rien reçu, le suivi est bloqué depuis une semaine.')", [late]), /dispute_window_closed/);
});

test('favoris : prix gardé à l’ajout, baisse signalée', async () => {
  const lid = await listing(5000, '{relay}');
  await as(BUYER); await db.query('select api.favorite_toggle($1)', [lid]);
  await H.asAdmin(db); await db.query('update market.listings set price_cents = 4000 where id = $1', [lid]);
  await as(BUYER);
  const f = (await q1('select api.favorites_mine() r')).r.find(x => x.id === lid);
  assert.equal(f.saved_price_cents, 5000); assert.equal(f.drop_pct, 20);
  await as(OTHER); await assert.rejects(db.query('select market.reached_at($1, $2)', [lid, 'paid']), /permission denied/);
});
