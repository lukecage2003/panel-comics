'use strict';
// Tests du catalogue commun de publications (R1, D-55) — fixtures fictives et isolées, aucune donnée réelle
const test = require('node:test');
const assert = require('node:assert');
const P = require('./publication-core.js');

const SRC = { id: 'fx_import', kind: 'import', at: '2026-11-08' };
const fresh = () => P.emptyStore();

test('identité stable : même entrée, même identifiant, sur deux magasins distincts', () => {
  const a = fresh(), b = fresh();
  const r1 = P.resolve(a, { series: 'Fixture Heroes (2019)', issue: '#001', publisher: 'Fixture Comics' }, { source: SRC });
  const r2 = P.resolve(b, { series: 'Fixture Heroes', year: 2019, issue: '1', publisher: 'Fixture' }, { source: SRC });
  assert.strictEqual(r1.status, 'resolved');
  assert.strictEqual(r1.issueId, r2.issueId);
  assert.match(r1.issueId, /^pub_i_[a-z0-9]+$/);
  assert.strictEqual(r1.variantId, null);
});

test('unicité : un numéro n\'est créé qu\'une fois par série et numéro', () => {
  const s = fresh();
  for (let i = 0; i < 3; i++) P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '2', publisher: 'Fixture Comics' }, { source: SRC });
  P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '#02', publisher: 'Fixture Comics' }, { source: SRC });
  assert.strictEqual(P.stats(s).issues, 1);
  assert.strictEqual(P.stats(s).series, 1);
  const ids = Object.keys(s.issues).concat(Object.keys(s.series));
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('séries homonymes : deux volumes distincts restent distincts ; sans discriminant → ambiguïté, pas de fusion', () => {
  const s = fresh();
  const v1 = P.resolve(s, { series: 'Fixture Knight (1990)', issue: '1', publisher: 'Fixture Comics' }, { source: SRC });
  const v2 = P.resolve(s, { series: 'Fixture Knight (2011)', issue: '1', publisher: 'Fixture Comics' }, { source: SRC });
  assert.notStrictEqual(v1.issueId, v2.issueId);
  const amb = P.resolve(s, { series: 'Fixture Knight', issue: '1', publisher: 'Fixture Comics' }, { source: SRC });
  assert.strictEqual(amb.status, 'ambiguous');
  assert.strictEqual(amb.candidates.length, 2);
  assert.strictEqual(P.stats(s).series, 2);
});

test('variantes et réimpressions : identités propres, rattachées au même numéro', () => {
  const s = fresh();
  const main = P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '1', variant: 'Cover A' }, { source: SRC });
  const varB = P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '1', variant: 'Cover B Fixture Artist' }, { source: SRC });
  const ptg2 = P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '1', variant: '2nd Printing' }, { source: SRC });
  assert.strictEqual(main.variantId, null);
  assert.ok(varB.variantId && ptg2.variantId && varB.variantId !== ptg2.variantId);
  assert.strictEqual(varB.issueId, main.issueId);
  assert.strictEqual(s.variants[ptg2.variantId].kind, 'printing');
  assert.strictEqual(s.variants[varB.variantId].kind, 'cover');
  const d = P.describe(s, main.issueId);
  assert.strictEqual(d.variants.length, 2);
  assert.strictEqual(P.stats(s).issues, 1);
});

test('édition (recueil) jamais confondue avec un numéro ; ISBN comme identité', () => {
  const s = fresh();
  const e1 = P.resolve(s, { title: 'Fixture Heroes Vol. 1', format: 'TPB', isbn: '978-0-00-000000-2', publisher: 'Fixture Comics' }, { source: SRC });
  const e2 = P.resolve(s, { title: 'Fixture Heroes : tome 1', format: 'tpb', isbn: '9780000000002' }, { source: SRC });
  assert.strictEqual(e1.match, 'edition');
  assert.strictEqual(e1.editionId, e2.editionId);
  assert.strictEqual(P.stats(s).issues, 0);
});

test('identifiants externes : jamais inventés, contrôlés, et un conflit bloque la fusion', () => {
  const s = fresh();
  const a = P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '1', externalIds: { metron: '111', comicvine: 'abc', gcd: '' } }, { source: SRC });
  assert.deepStrictEqual(s.issues[a.issueId].externalIds, { metron: '111' });
  const viaExt = P.resolve(s, { series: 'Autre titre saisi', issue: '9', externalIds: { metron: '111' } }, { source: SRC });
  assert.strictEqual(viaExt.match, 'external');
  assert.strictEqual(viaExt.issueId, a.issueId);
  const b = P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '2', externalIds: { gcd: '5' } }, { source: SRC });
  // Deux identifiants fiables qui désignent deux publications différentes : ambiguïté, aucune fusion
  const both = P.resolve(s, { series: 'X', issue: '1', externalIds: { metron: '111', gcd: '5' } }, { source: SRC });
  assert.strictEqual(both.status, 'ambiguous');
  assert.deepStrictEqual(both.candidates.sort(), [a.issueId, b.issueId].sort());
  assert.strictEqual(s.issues[a.issueId].externalIds.gcd, undefined);
  const mismatch = P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '1', externalIds: { metron: '999' } }, { source: SRC });
  assert.strictEqual(mismatch.status, 'ambiguous');
});

test('dates distinctes et provenance : couverture, mise en vente, FOC ; écart conservé sans écraser', () => {
  const s = fresh();
  const r = P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '3', coverDate: '2019-05', storeDate: '2019-03-20', focDate: '2019-02-25' }, { source: SRC });
  P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '3', storeDate: '2019-03-27' }, { source: { id: 'fx_other', kind: 'release' } });
  const d = P.describe(s, r.issueId);
  assert.deepStrictEqual(d.dates, { cover: '2019-05', store: '2019-03-20', foc: '2019-02-25' });
  assert.strictEqual(s.issues[r.issueId].conflicts.length, 1);
  assert.strictEqual(s.issues[r.issueId].conflicts[0].source, 'fx_other');
  assert.strictEqual(d.verification, 'concordant');
  P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '3' }, { source: { id: 'fx_ref', kind: 'bibliographic' } });
  assert.strictEqual(P.describe(s, r.issueId).verification, 'verified');
  assert.deepStrictEqual(s.issues[r.issueId].cover, { status: 'none', rights: 'unknown' });
});

test('manga hors périmètre : refusé, rien n\'est créé', () => {
  const s = fresh();
  assert.strictEqual(P.resolve(s, { series: 'Fixture Manga', issue: '1', format: 'manga' }).status, 'out_of_scope');
  assert.strictEqual(P.resolve(s, { series: 'Fixture', issue: '1', medium: 'Manhwa' }).status, 'out_of_scope');
  assert.strictEqual(P.stats(s).series, 0);
  const rep = P.buildFromModules(s, { releases: [{ id: 'rel_m', series: 'Fixture Manga', issue: '1', format: 'manga' }] }, 'now');
  assert.strictEqual(rep.release.outOfScope, 1);
  assert.strictEqual(P.stats(s).refs, 0);
});

test('associations multiples : un même numéro référencé par Collection, Sorties et deux événements', () => {
  const s = fresh();
  const copies = [{ id: 's_1', series: 'Fixture Heroes (2019)', issue: '4', publisher: 'Fixture Comics', variant: '' },
    { id: 's_2', series: 'Fixture Heroes', issue: '4', publisher: 'Fixture Comics', coverYear: 2019, variant: 'Virgin Variant' }];
  const releases = [{ id: 'rel_1', series: 'Fixture Heroes (2019)', issue: '4', publisher: 'Fixture Comics', market: 'us', date: '2019-06-12', externalIds: { locg: '4242' } }];
  const eventIssues = [{ localId: 'ek_a', series: 'Fixture Heroes', volume: '', issue: '4', publisher: 'Fixture Comics', sourceId: 'fx_guide_a' },
    { localId: 'ek_b', series: 'Fixture Heroes (2019)', issue: '4', publisher: 'Fixture Comics', sourceId: 'fx_guide_b' }];
  const before = JSON.stringify({ copies, releases, eventIssues });
  const rep = P.buildFromModules(s, { copies, releases, eventIssues }, '2026-11-08');
  assert.strictEqual(JSON.stringify({ copies, releases, eventIssues }), before, 'données des modules intactes');
  const issueId = P.lookup(s, 'release', 'rel_1').issueId;
  assert.strictEqual(P.lookup(s, 'collection', 's_1').issueId, issueId);
  assert.strictEqual(P.lookup(s, 'collection', 's_2').issueId, issueId);
  assert.ok(P.lookup(s, 'collection', 's_2').variantId);
  assert.strictEqual(P.lookup(s, 'explorer', 'ek_a').issueId, issueId);
  assert.strictEqual(P.lookup(s, 'explorer', 'ek_b').issueId, issueId);
  const u = P.usages(s, issueId);
  assert.deepStrictEqual(Object.keys(u).sort(), ['collection', 'explorer', 'release']);
  assert.strictEqual(u.explorer.length, 2);
  assert.strictEqual(P.stats(s).issues, 1);
  assert.strictEqual(rep.collection.linked + rep.release.linked + rep.explorer.linked, 5);
  assert.strictEqual(s.issues[issueId].fields.storeDate.value, '2019-06-12');
});

test('import réimporté deux fois : zéro doublon, index idempotent', () => {
  const s = fresh();
  const releases = [1, 2, 3].map(n => ({ id: 'rel_' + n, series: 'Fixture Heroes (2019)', issue: String(n), publisher: 'Fixture Comics', externalIds: { locg: String(9000 + n) } }));
  P.buildFromModules(s, { releases }, 't1');
  const snap = JSON.stringify(P.stats(s));
  const again = releases.map(r => Object.assign({}, r, { id: r.id + '_bis' }));
  P.buildFromModules(s, { releases: again }, 't2');
  P.buildFromModules(s, { releases }, 't3');
  assert.strictEqual(P.stats(s).issues, 3);
  assert.strictEqual(P.lookup(s, 'release', 'rel_1_bis').issueId, P.lookup(s, 'release', 'rel_1').issueId);
  assert.strictEqual(JSON.parse(snap).issues, 3);
});

test('fusion de doublons journalisée puis annulée : état restauré à l\'identique', () => {
  const s = fresh();
  // Fiche sans année saisie avant l'import daté : deux séries, signalées comme doublon possible, jamais fusionnées seules
  P.buildFromModules(s, { copies: [{ id: 's_1', series: 'Fixture Saga', issue: '1', publisher: 'Fixture Comics' }] }, 't');
  P.buildFromModules(s, { releases: [{ id: 'rel_1', series: 'Fixture Saga (2020)', issue: '1', publisher: 'Fixture Comics', externalIds: { metron: '77' } }] }, 't');
  const a = P.lookup(s, 'collection', 's_1').seriesId, b = P.lookup(s, 'release', 'rel_1').seriesId;
  assert.notStrictEqual(a, b);
  assert.strictEqual(P.duplicateCandidates(s).length, 1);
  const before = JSON.stringify(s);
  const m = P.merge(s, a, b, { reason: 'même série', at: 't2' });
  assert.ok(m.ok);
  assert.strictEqual(P.lookup(s, 'collection', 's_1').issueId, P.lookup(s, 'release', 'rel_1').issueId);
  assert.strictEqual(P.stats(s).series, 1);
  assert.strictEqual(s.history.length, 1);
  // Une ancienne référence vers l'identifiant fusionné reste lisible (alias)
  assert.strictEqual(P.describe(s, a).kind, 'series');
  assert.ok(P.undo(s).ok);
  const after = JSON.parse(JSON.stringify(s)); after.seq = JSON.parse(before).seq;
  assert.deepStrictEqual(after, JSON.parse(before));
  assert.strictEqual(P.undo(s).ok, false);
});

test('liaison manuelle : prioritaire sur le recalcul et annulable', () => {
  const s = fresh();
  P.buildFromModules(s, { copies: [{ id: 's_1', series: 'Fixture Heroes (2019)', issue: '5' }] }, 't');
  const other = P.resolve(s, { series: 'Fixture Heroes (2019)', issue: '6' }, { source: SRC });
  const prev = P.lookup(s, 'collection', 's_1').issueId;
  assert.ok(P.relink(s, 'collection', 's_1', other.issueId, { at: 't2' }).ok);
  P.buildFromModules(s, { copies: [{ id: 's_1', series: 'Fixture Heroes (2019)', issue: '5' }] }, 't3');
  assert.strictEqual(P.lookup(s, 'collection', 's_1').issueId, other.issueId);
  P.undo(s);
  assert.strictEqual(P.lookup(s, 'collection', 's_1').issueId, prev);
  assert.strictEqual(P.relink(s, 'collection', 's_1', 'pub_i_inconnu').ok, false);
});

test('compatibilité anciennes collections : fiches sans série, sans numéro ou incomplètes', () => {
  const s = fresh();
  const rep = P.buildFromModules(s, { copies: [
    { id: 's_old1', series: '', issue: '1' },
    { id: 's_old2', series: 'Fixture One-Shot Special' },
    { id: 's_old3', series: 'Fixture Heroes (2019)', issue: '7', barcode: '75960609999900711' },
    { series: 'Sans identifiant', issue: '1' }
  ] }, 't');
  assert.strictEqual(rep.collection.rejected, 1);
  assert.strictEqual(rep.collection.linked, 2);
  assert.strictEqual(P.lookup(s, 'collection', 's_old2').issueId, null);
  assert.ok(P.lookup(s, 'collection', 's_old2').seriesId);
  const i = P.lookup(s, 'collection', 's_old3').issueId;
  assert.strictEqual(s.issues[i].externalIds.upc, '75960609999900711');
});

test('sauvegarde et restauration : sérialisation complète, magasin invalide ignoré sans erreur', () => {
  const s = fresh();
  P.buildFromModules(s, { copies: [{ id: 's_1', series: 'Fixture Heroes (2019)', issue: '1', variant: 'Cover B' }] }, 't');
  P.resolve(s, { series: 'Fixture Saga', issue: '1' }, { source: SRC });
  const json = JSON.stringify(s);
  const back = P.loadStore(JSON.parse(json));
  assert.deepStrictEqual(back, JSON.parse(json));
  assert.deepStrictEqual(P.stats(P.loadStore({ format: 'autre' })), P.stats(fresh()));
  assert.deepStrictEqual(P.stats(P.loadStore(null)), P.stats(fresh()));
  const bad = JSON.parse(json); bad.issues['pub_i_x'] = { id: 'pas_le_meme' }; bad.refs['x'] = { pub: 1 };
  const cleaned = P.loadStore(bad);
  assert.ok(!cleaned.issues['pub_i_x'] && !cleaned.refs['x']);
});

test('normalisation : numéros, variantes, éditeurs', () => {
  assert.strictEqual(P.normIssue('#001'), '1');
  assert.strictEqual(P.normIssue('1.MU'), '1.mu');
  assert.strictEqual(P.normIssue('Annual 1'), 'annual 1');
  assert.strictEqual(P.normVariant('Cover A'), 'main');
  assert.strictEqual(P.normVariant(''), 'main');
  assert.strictEqual(P.normPublisher('Fixture Comics Inc.'), P.normPublisher('fixture'));
  assert.deepStrictEqual(P.splitSeries('Fixture Knight Vol. 2'), { title: 'Fixture Knight', year: null, volume: '2' });
  assert.deepStrictEqual(P.cleanExt({ upc: '7-59606-09999-9 00711', isbn: 'bad', metron: '12' }), { upc: '75960609999900711', metron: '12' });
});
