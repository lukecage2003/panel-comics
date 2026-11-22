'use strict';
// D-113 : pros et sceau Encré, marché, Le Comptoir, messages chiffrés, offres
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./pro-core'), M = require('./market-core'), F = require('./forum-core'), D = require('./dm-core'), O = require('./plans-core');

test('pros : profil validé, mineur refusé, sceau seulement après vérification humaine', () => {
  const ok = P.validateProfile({ kind: 'creator', name: 'Alex Encre', roles: ['writer', 'artist', 'pirate'], links: ['https://alex.example'], works: [{ title: 'Nuit Rouge', publisher: 'Indé', year: 2024, role: 'writer' }], open: true });
  assert.ok(ok.ok); assert.deepEqual(ok.profile.roles, ['writer', 'artist']);
  assert.ok(!P.validateProfile({ kind: 'creator', name: 'Ado', roles: ['artist'] }, { minor: true }).ok);
  assert.ok(P.validateProfile({ kind: 'creator', name: 'X Y', roles: ['artist'], links: ['http://non-securise.example'] }).errors.some(e => /https/.test(e)));
  assert.ok(!P.validateProfile({ kind: 'creator', name: 'Sans métier' }).ok);
  assert.deepEqual(P.seal('publisher', 'pending'), { show: false, kind: 'publisher', label: '', title: '' });
  assert.equal(P.seal('publisher', 'verified').label, 'Encré · Éditeur');
  const a = P.applicationCheck('publisher', ['company', 'domain']);
  assert.equal(a.ready, false); assert.equal(a.missing.length, 2);
  assert.equal(P.applicationCheck('publisher', ['company', 'domain', 'mandate', 'site']).ready, true);
});

test('L\'Atelier : annonces de collaboration sans coordonnées, réservées aux adultes, correspondance par métier', () => {
  const c = P.validateCollab({ kind: 'seek', role: 'colorist', title: 'Coloriste pour un one-shot', body: 'Projet de 24 pages, science-fiction, scénario bouclé, dessin en cours.', terms: 'share' });
  assert.ok(c.ok);
  assert.ok(!P.validateCollab({ kind: 'seek', role: 'colorist', title: 'Coloriste pour un one-shot', body: 'Écrivez-moi à moi@exemple.be pour en parler longuement.' }).ok);
  assert.ok(!P.validateCollab({ kind: 'seek', role: 'colorist', title: 'Coloriste', body: 'x'.repeat(40) }, { minor: true }).ok);
  assert.ok(P.collabMatch(c.collab, { open: true, roles: ['colorist'], works: [{}] }) > P.collabMatch(c.collab, { open: true, roles: ['letterer'] }));
  assert.equal(P.collabMatch(c.collab, { open: false, roles: ['colorist'] }), 0);
});

test('marché : annonce sans données privées, coordonnées et paiement hors Panel refusés, frais en centimes', () => {
  const draft = M.listingFromCopy({ id: 'c1', series: 'Absolute Batman', issue: '1', publisher: 'DC', purchasePrice: 4.99, estValue: 30, location: 'Boîte 2', notes: 'secret' });
  assert.ok(!/4\.99|30|Boîte|secret/.test(JSON.stringify(draft)));
  const l = M.validateListing({ ...draft, price: '24,50', condition: 'nm', delivery: ['relay', 'hand'], city: 'Liège', photos: ['ph1'] });
  assert.ok(l.ok, l.errors.join()); assert.equal(l.listing.price, 2450); assert.equal(l.listing.currency, 'EUR');
  assert.ok(!M.validateListing({ ...draft, price: 10, condition: 'nm', delivery: ['hand'], photos: ['p'] }).ok, 'ville obligatoire en main propre');
  assert.ok(M.validateListing({ ...draft, price: 10, condition: 'nm', delivery: ['relay'], photos: ['p'], body: 'Paiement par virement svp' }).errors.some(e => /hors de Panel/.test(e)));
  assert.ok(!M.validateListing({ ...draft, price: 10, condition: 'nm', delivery: ['relay'], photos: ['p'] }, { minor: true }).ok);
  assert.deepEqual(M.fees(2450, 0.07), { price: 2450, fee: 172, seller: 2278, rate: 0.07 });
  assert.equal(M.fees(2450, 0.9), null);
});

test('marché : étapes d\'une vente, chacun son rôle, aucune transition inventée', () => {
  assert.deepEqual(M.step('listed', 'reserve', 'buyer'), { ok: true, state: 'reserved' });
  assert.equal(M.step('listed', 'reserve', 'seller').error, 'forbidden');
  assert.equal(M.step('listed', 'ship', 'seller').error, 'invalid_transition');
  assert.equal(M.step('paid', 'handover', 'buyer').state, 'completed');
  assert.equal(M.step('disputed', 'resolve_buyer', 'buyer').error, 'forbidden');
  assert.deepEqual(M.nextActions('delivered', 'buyer'), ['confirm', 'dispute']);
  assert.match(M.handoverCode(() => [123]), /^000123$/);
  assert.match(M.handoverCode(), /^\d{6}$/);
});

test('Le Comptoir : sujets, votes uniques, classements, fils de réponses, contenu adulte caché aux mineurs', () => {
  assert.ok(!F.validateThread({ circle: 'debats', title: 'Qui gagne ?', flair: 'debate', sides: ['Hulk'] }).ok);
  const t = F.validateThread({ circle: 'debats', title: 'Hulk contre la Chose, qui gagne ?', flair: 'debate', sides: ['Hulk', 'La Chose'] });
  assert.ok(t.ok); assert.ok(!F.validateThread({ circle: 'inconnu', title: 'Un titre assez long' }).ok);
  assert.deepEqual(F.vote(0, 1), { next: 1, up: 1, down: 0 });
  assert.deepEqual(F.vote(1, 1), { next: 0, up: -1, down: 0 });
  assert.deepEqual(F.vote(1, -1), { next: -1, up: -1, down: 1 });
  const now = Date.parse('2026-11-22T12:00:00Z');
  const L = [{ id: 'a', up: 50, down: 2, at: new Date(now - 864e5 * 3).toISOString() }, { id: 'b', up: 5, down: 0, at: new Date(now).toISOString() },
    { id: 'c', up: 40, down: 38, at: new Date(now - 36e5).toISOString() }, { id: 'd', up: 99, down: 0, at: new Date(now).toISOString(), mature: true }];
  assert.equal(F.sortThreads(L, 'top')[0].id, 'd');
  assert.ok(!F.sortThreads(L, 'top', { minor: true }).some(x => x.id === 'd'));
  assert.equal(F.sortThreads(L, 'debated')[0].id, 'c');
  assert.equal(F.sortThreads(L, 'new', { minor: true })[0].id, 'b');
  const tr = F.tree([{ id: '1', up: 1, at: '1' }, { id: '2', parent: '1', up: 5, at: '2' }, { id: '3', parent: '1', up: 9, at: '3' }, { id: '4', parent: 'disparu', at: '4' }]);
  assert.equal(tr.length, 2); assert.equal(tr[0].children[0].id, '3'); assert.equal(F.countTree(tr), 4);
  const deep = Array.from({ length: 9 }, (_, i) => ({ id: 'n' + i, parent: i ? 'n' + (i - 1) : '', at: String(i) }));
  assert.equal(F.countTree(F.tree(deep)), F.MAX_DEPTH);
  assert.deepEqual(F.debateTally({ sideA: 3, sideB: 1 }), { a: 3, b: 1, n: 4, pa: 75, pb: 25 });
});

test('messages : chiffrement de bout en bout, empreinte identique des deux côtés, altération détectée', async () => {
  const A = await D.createIdentity(), B = await D.createIdentity();
  await assert.rejects(globalThis.crypto.subtle.exportKey('jwk', A.privateKey), 'clé privée non exportable');
  assert.equal(await D.safetyNumber(A.publicJwk, B.publicJwk), await D.safetyNumber(B.publicJwk, A.publicJwk));
  assert.match(await D.safetyNumber(A.publicJwk, B.publicJwk), /^(\d{5} ){11}\d{5}$/);
  const kA = await D.conversationKey(A.privateKey, B.publicJwk, 'conv1'), kB = await D.conversationKey(B.privateKey, A.publicJwk, 'conv1');
  const meta = { conversationId: 'conv1', senderId: 'alice', seq: 1 };
  const box = await D.seal(kA, 'Tu me vends ton Absolute Batman #1 ?', meta);
  assert.ok(!/Batman/.test(JSON.stringify(box)), 'le serveur ne voit que du chiffré');
  assert.equal(await D.open(kB, box, meta), 'Tu me vends ton Absolute Batman #1 ?');
  await assert.rejects(D.open(kB, box, { ...meta, senderId: 'mallory' }), /tampered/);
  await assert.rejects(D.open(kB, { ...box, seq: 2 }, meta), /tampered/);
  const kOther = await D.conversationKey(A.privateKey, B.publicJwk, 'conv2');
  await assert.rejects(D.open(kOther, box, meta), /tampered/);
  await assert.rejects(D.seal(kA, '   ', meta), /empty/);
  assert.throws(() => D.importPublic({ kty: 'RSA' }), /invalid_key/);
});

test('messages : jamais entre mineur et adulte, demande avant tout échange, blocage et préférences respectés', () => {
  const ad = { id: 'a' }, ad2 = { id: 'b' }, teen = { id: 't', minor: true };
  assert.deepEqual(D.canMessage(ad, ad2), { ok: true, request: true });
  assert.deepEqual(D.canMessage(ad, ad2, { mutual: true }), { ok: true, request: false });
  assert.equal(D.canMessage(ad, teen).reason, 'minor_protected');
  assert.equal(D.canMessage(teen, ad).reason, 'minor_protected');
  assert.equal(D.canMessage(ad, ad2, { blocked: true }).reason, 'blocked');
  assert.equal(D.canMessage(ad, { id: 'b', dmPolicy: 'verified' }).reason, 'verified_only');
  assert.equal(D.canMessage({ id: 'a', verified: true }, { id: 'b', dmPolicy: 'verified' }).ok, true);
});

test('offres : aucun prix inventé, jamais de visibilité achetée, offres pros réservées aux profils Encré', () => {
  assert.ok(O.PLANS.every(p => p.price === null));
  assert.equal(O.priceLabel(O.plan('plus')), 'Tarif à venir'); assert.equal(O.priceLabel(O.plan('free')), 'Gratuit');
  for (const f of O.NEVER) for (const p of O.PLANS) assert.equal(O.has(p.key, f), false, f);
  assert.equal(O.has('plus', 'stats_advanced'), true); assert.equal(O.has('free', 'stats_advanced'), false);
  assert.equal(O.canSubscribe('publisher', { seal: 'creator' }).reason, 'seal_required');
  assert.equal(O.canSubscribe('plus', { minor: true }).reason, 'adult_only');
  assert.equal(O.canSubscribe('plus', {}).reason, 'not_on_sale');
});
