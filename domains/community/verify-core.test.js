'use strict';
// D-114 : types de comptes, pastilles et vérification
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('./verify-core');

test('contrôles réels : BCE (modulo 97), SIREN (Luhn), ISBN-13, domaine officiel', () => {
  const base = '04123456', bce = base + String(97 - (Number(base) % 97)).padStart(2, '0');
  assert.equal(V.checkBCE(bce), true); assert.equal(V.checkBCE('BE ' + bce.slice(0, 4) + '.' + bce.slice(4, 7) + '.' + bce.slice(7)), true);
  assert.equal(V.checkBCE(bce.slice(0, 9) + ((Number(bce[9]) + 1) % 10)), false);
  // SIREN construit : 8 chiffres + clé de Luhn
  const s8 = '12345678'; let siren = ''; for (let k = 0; k < 10; k++) if (V.checkSIREN(s8 + k)) siren = s8 + k;
  assert.ok(siren); assert.equal(V.checkSIREN('123456780') && siren !== '123456780', false);
  const i12 = '978236577201'; let isbn = ''; for (let k = 0; k < 10; k++) if (V.checkISBN13(i12 + k)) isbn = i12 + k;
  assert.ok(isbn); assert.equal(V.checkISBN13('978-2-36577-201-' + ((Number(isbn[12]) + 1) % 10)), false);
  assert.equal(V.domainMatches('presse@urban-comics.example', 'https://www.urban-comics.example/catalogue'), true);
  assert.equal(V.domainMatches('editions.urban@gmail.com', 'https://www.urban-comics.example'), false);
  assert.equal(V.domainMatches('a@evil-urban-comics.example', 'https://urban-comics.example'), false);
});

test('dossier : pièces obligatoires, formats, taille, code de preuve', () => {
  assert.deepEqual(V.progress('publisher', ['company', 'domain_email']), { total: 5, done: 2, missing: ['mandate', 'identity', 'catalogue'], ready: false });
  assert.equal(V.progress('creator', ['identity', 'credits', 'proof_link']).ready, true);
  assert.equal(V.progress('collector', []).ready, false);
  const id = V.DOCS.creator[0];
  assert.equal(V.fileOk(id, { name: 'carte.PDF', size: 2e5 }).ok, true);
  assert.equal(V.fileOk(id, { name: 'carte.exe', size: 2e5 }).ok, false);
  assert.equal(V.fileOk(id, { name: 'carte.jpg', size: 50 * 1048576 }).ok, false);
  assert.match(V.proofCode(), /^PANEL-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test('pastille : seulement après décision de l\'équipe, distincte par type, expire après un an, jamais pour un collectionneur', () => {
  assert.equal(V.badge('creator', 'in_review'), null);
  assert.equal(V.badge('collector', 'verified'), null);
  const b = V.badge('publisher', 'verified', 0, 1000);
  assert.equal(b.label, 'Éditeur vérifié');
  assert.notEqual(V.BADGES.creator.color, V.BADGES.publisher.color);
  assert.equal(V.badge('shop', 'verified', 0, 366 * 864e5), null);
  assert.deepEqual(V.step('draft', 'submit', 'owner'), { ok: true, state: 'submitted' });
  assert.equal(V.step('in_review', 'approve', 'owner').error, 'forbidden');
  assert.equal(V.step('refused', 'appeal', 'owner').state, 'submitted');
  assert.equal(V.step('verified', 'approve', 'staff').error, 'invalid_transition');
});

test('relecture : échéance en jours ouvrables, file triée, points automatiques et humains, décision motivée', () => {
  const V = require('./verify-core');
  const fri = Date.parse('2026-11-20T09:00:00Z');
  assert.equal(new Date(V.reviewDue(fri)).toISOString().slice(0, 10), '2026-12-01', '7 jours ouvrables après un vendredi');
  const q = V.queueOrder([{ id: 'b', submitted_at: '2026-11-19T09:00:00Z' }, { id: 'c' }, { id: 'a', submitted_at: '2026-11-01T09:00:00Z' }], Date.parse('2026-11-22T00:00:00Z'));
  assert.deepEqual(q.map(x => x.id), ['a', 'b', 'c']);
  assert.equal(q[0].overdue, true);
  const base = '04123456', bce = base + String(97 - (Number(base) % 97)).padStart(2, '0');
  const items = V.checklist('publisher', { country: 'BE', company: bce, website: 'https://maison.example', domain_email: 'presse@maison.example', isbn: '9782070612758', docs: { mandate: 'x', identity: 'y' } });
  assert.ok(items.filter(i => i.auto).every(i => i.ok === true));
  assert.equal(V.decide('approve', items, []).ok, false, 'les points humains doivent être cochés');
  assert.equal(V.decide('approve', items, items.filter(i => i.ok === null).map(i => i.key)).ok, true);
  const bad = V.checklist('publisher', { company: '123' });
  assert.equal(V.decide('approve', bad, bad.map(i => i.key)).ok, false, 'un numéro faux bloque la validation');
  assert.equal(V.decide('refuse', items, [], 'nope').ok, false);
  assert.equal(V.decide('refuse', items, [], 'mismatch').state, 'refused');
  assert.equal(V.decide('ask', items, [], '', 'court').ok, false);
  assert.equal(V.decide('ask', items, [], '', 'Merci d’envoyer un extrait Kbis de moins de 3 mois.').state, 'needs_more');
});
