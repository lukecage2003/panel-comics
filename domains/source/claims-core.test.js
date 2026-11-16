'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./claims-core');

const T0 = '2026-11-16T10:00:00.000Z';
const subject = { kind: 'event', id: 'gd_fixture', label: 'Événement fictif' };
const proof = { label: 'Fixture Saga #1 (éditeur fictif)', page: '12', panel: '3', quote: 'Citation courte et fictive.' };

test('un fait exige une preuve ; sans preuve, une hypothèse reste affichée comme telle', () => {
  const bad = S.createClaim({ subject, property: 'first_appearance', value: 'Fixture Héros apparaît pour la première fois', status: 'fact' }, 'alice', T0, 'c1');
  assert.equal(bad.claim, null);
  assert.match(bad.errors[0], /au moins une preuve/);
  const hyp = S.createClaim({ subject, property: 'first_appearance', value: 'Fixture Héros apparaît pour la première fois', status: 'hypothesis' }, 'alice', T0, 'c1');
  assert.deepEqual(hyp.errors, []);
  const d = S.display(hyp.claim);
  assert.equal(d.statusLabel, 'Hypothèse');
  assert.equal(d.verification, 'unverified');
  // Un « fait » venu d'un relevé sans preuve est rétrogradé à l'affichage
  const raw = S.sanitizeClaim({ id: 'x', subject, property: 'p', value: 'v', status: 'fact', origin: 'panel', author: 'Panel' });
  assert.equal(S.display(raw).status, 'hypothesis');
  assert.equal(S.display(raw).downgraded, true);
});

test('preuves localisées, sans doublon, citation tronquée, lien http seulement', () => {
  const { claim } = S.createClaim({ subject, property: 'p', value: 'v', status: 'fact', evidence: [proof] }, 'alice', T0, 'c2');
  assert.equal(S.evidenceText(claim.evidence[0]), 'Fixture Saga #1 (éditeur fictif), p. 12, case 3');
  assert.match(S.addEvidence(claim, proof, 'bob', T0).errors[0], /déjà citée/);
  const long = S.addEvidence(claim, { label: 'Autre source fictive', url: 'javascript:alert(1)', quote: 'x'.repeat(500) }, 'bob', T0).claim;
  assert.equal(long.evidence.length, 2);
  assert.equal(long.evidence[1].url, '');
  assert.equal(long.evidence[1].quote.length, S.LIMITS.quote);
  assert.equal(long.evidence[1].addedBy, 'bob');
});

test('relecture : jamais par l\'auteur, une fois par relecteur, vérifiée avec deux relectures dont un vérificateur', () => {
  let { claim } = S.createClaim({ subject, property: 'p', value: 'v', status: 'fact', evidence: [proof] }, 'alice', T0, 'c3');
  assert.match(S.review(claim, { reviewer: 'alice', verdict: 'confirm' }).errors[0], /propre affirmation/);
  claim = S.review(claim, { reviewer: 'bob', verdict: 'confirm', role: 'contributor' }).claim;
  assert.equal(S.verificationOf(claim), 'reviewed');
  assert.match(S.review(claim, { reviewer: 'bob', verdict: 'confirm' }).errors[0], /déjà relu/);
  const twoMembers = S.review(claim, { reviewer: 'carol', verdict: 'confirm', role: 'member' }).claim;
  assert.equal(S.verificationOf(twoMembers), 'reviewed');
  const verified = S.review(claim, { reviewer: 'dan', verdict: 'confirm', role: 'verifier' }).claim;
  assert.equal(S.verificationOf(verified), 'verified');
  const disputed = S.review(verified, { reviewer: 'eve', verdict: 'reject', note: 'Page différente dans mon édition.' }).claim;
  assert.equal(S.verificationOf(disputed), 'disputed');
  // Une relecture forgée au nom de l'auteur ne compte pas
  const forged = S.sanitizeClaim(Object.assign({}, claim, { reviews: [{ reviewer: 'alice', verdict: 'confirm', role: 'verifier' }, { reviewer: 'bob', verdict: 'confirm', role: 'verifier' }] }));
  assert.equal(S.verificationOf(forged), 'reviewed');
});

test('révision : rien ne s\'efface, raison obligatoire, nouvelle relecture nécessaire', () => {
  let { claim } = S.createClaim({ subject, property: 'p', value: 'Version 1', status: 'fact', evidence: [proof] }, 'alice', T0, 'c4');
  claim = S.review(claim, { reviewer: 'bob', verdict: 'confirm' }).claim;
  assert.match(S.revise(claim, { value: 'Version 2' }, 'alice', T0, '').errors[0], /raison/);
  const r = S.revise(claim, { value: 'Version 2', status: 'interpretation' }, 'alice', T0, 'Lecture différente de la case 3');
  assert.deepEqual(r.errors, []);
  assert.equal(r.claim.value, 'Version 2');
  assert.equal(r.claim.revisions.length, 1);
  assert.deepEqual(r.claim.revisions[0].before, { value: 'Version 1', status: 'fact' });
  assert.equal(r.claim.reviews.length, 0);
});

test('conflits : valeurs divergentes conservées, jamais fusionnées', () => {
  const a = S.sanitizeClaim({ id: 'a', subject, property: 'link|x', label: 'Série X', value: 'Tie-in · #1-3', status: 'fact', evidence: [{ label: 'Source A' }] });
  const b = S.sanitizeClaim({ id: 'b', subject, property: 'link|x', label: 'Série X', value: 'Prélude · #1-2', status: 'fact', evidence: [{ label: 'Source B' }] });
  const c = S.sanitizeClaim({ id: 'c', subject, property: 'link|x', label: 'Série X', value: 'tie-in · #1-3 ', status: 'fact', evidence: [{ label: 'Source C' }] });
  const k = S.conflicts([a, b, c]);
  assert.equal(k.length, 1);
  assert.equal(k[0].values.length, 2);
  assert.deepEqual(k[0].values.map(v => v.claimIds), [['a', 'c'], ['b']]);
  assert.equal(S.conflicts([a, c]).length, 0);
});

test('fromEvent : une affirmation par lien et par source, preuve = source citée', () => {
  const guide = { id: 'gd_fx', title: 'Événement fictif', sources: [{ id: 's1', label: 'Source fictive 1', url: 'https://example.invalid/1', retrievedAt: '2026-11-08' }, { id: 's2', label: 'Source fictive 2' }],
    event: { mainSeries: { series: 'Fixture Saga', volume: '', sourceId: 's1', issues: [{ issue: '1' }, { issue: '6' }] },
      links: [{ relation: 'tie_in', series: 'Fixture X', volume: 'Vol. 2', issues: '1-3', sourceId: 's1' }, { relation: 'prelude', series: 'Fixture X', volume: 'Vol. 2', issues: '1-2', sourceId: 's2' }, { relation: 'order', series: 'Ignorée' }],
      consequences: [{ text: 'Conséquence fictive.', sourceId: 'zzz' }] } };
  const cl = S.fromEvent(guide, '2026-11-08');
  assert.equal(cl.length, 4);
  assert.equal(cl[0].value, 'Fixture Saga #1-6');
  assert.equal(cl[1].evidence[0].label, 'Source fictive 1');
  assert.equal(S.display(cl[1]).verification, 'unverified');
  assert.equal(S.display(cl[3]).status, 'hypothesis'); // source inconnue : aucune preuve, donc pas présentée comme un fait
  assert.equal(S.conflicts(cl).length, 1);
});

test('état local : seules les propositions locales sont gardées, validées à la lecture', () => {
  const { claim } = S.createClaim({ subject, property: 'p', value: 'v', status: 'hypothesis' }, 'alice', T0, 'c9');
  let st = S.upsert(S.emptyState(), claim);
  st = S.upsert(st, Object.assign({}, claim, { value: 'v2' }));
  assert.equal(st.claims.length, 1);
  assert.equal(st.claims[0].value, 'v2');
  const dirty = S.sanitizeState({ claims: [claim, { id: 'p', origin: 'panel', subject, property: 'p', value: 'x' }, null, { id: 'bad' }] });
  assert.equal(dirty.claims.length, 1);
  assert.equal(S.forSubject(st, 'event', 'gd_fixture').length, 1);
  assert.equal(S.forSubject(st, 'event', 'autre').length, 0);
});
