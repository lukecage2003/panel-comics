'use strict';
// Tests du système documentaire et iconographique (D-48, D-49). Les fixtures « fx_ » sont FICTIVES (URL exemple.test, licences
// inventées pour le test) et ne représentent aucune couverture réelle ; le catalogue initial est testé pour sa cohérence seulement.
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./media-core');
const S = require('./events-seed');

const ref = (o) => M.normalizeRef(Object.assign({ url: 'https://exemple.test/fx.jpg', source: 'Fixture' }, o), { kind: 'issue', id: 'fx_issue_1' });

test('fournisseurs : seuls les données locales et l\'ajout manuel sont actifs ; un fournisseur réseau exige clé, compte et décision', () => {
  assert.deepEqual(M.PROVIDERS.filter(p => p.enabled).map(p => p.id).sort(), ['manual', 'panel_local']);
  assert.ok(M.PROVIDERS.every(p => M.PROVIDER_KINDS.includes(p.kind) && p.note));
  const cv = M.providerById('comic_vine');
  assert.equal(M.providerCanRun(cv).reason, 'external_services_disabled');
  assert.equal(M.providerCanRun(cv, { externalAllowed: true }).reason, 'missing_key');
  assert.equal(M.providerCanRun(cv, { externalAllowed: true, keys: { comic_vine: 'k' } }).reason, 'missing_account');
  assert.equal(M.providerCanRun(M.providerById('wikimedia_commons'), { externalAllowed: true }).reason, 'disabled');
  assert.equal(M.providerCanRun(M.providerById('wikimedia_commons'), { externalAllowed: true, enabled: ['wikimedia_commons'] }).ok, true);
  assert.ok(M.PROVIDERS.filter(p => p.kind === 'official' || p.id === 'gcd').every(p => p.imageRights === 'not_granted'), 'aucune autorisation d\'affichage supposée');
});

test('références : provenance complète, https seulement, un ajout manuel n\'est jamais « vérifié »', () => {
  assert.equal(M.normalizeRef({ url: 'http://exemple.test/a.jpg' }), null);
  assert.equal(M.normalizeRef({ url: 'javascript:alert(1)' }), null);
  const r = ref({ providerId: 'manual', verification: 'verified', visualType: 'variant', retrievedAt: '2026-11-08', rights: { license: 'CC BY 4.0', display: 'allowed' }, tech: { width: 400, height: 600 } });
  assert.equal(r.verification, 'user_confirmed');
  assert.deepEqual([r.entityKind, r.entityId, r.visualType, r.tech.width], ['issue', 'fx_issue_1', 'variant', 400]);
  assert.equal(ref({ visualType: 'inconnu' }).visualType, 'cover');
});

test('statuts : officiel, base, tierce autorisée, manuel, non vérifié, indisponible, droits non établis', () => {
  const failed = u => u.includes('cassee');
  assert.equal(M.classifyRef(ref({ providerId: 'marvel_official', verification: 'verified' })), 'official');
  assert.equal(M.classifyRef(ref({ providerId: 'gcd', verification: 'verified' })), 'database');
  assert.equal(M.classifyRef(ref({ providerId: 'wikimedia_commons', verification: 'verified', rights: { license: 'CC BY-SA 4.0' } })), 'authorized');
  assert.equal(M.classifyRef(ref({ providerId: 'manual' })), 'manual');
  assert.equal(M.classifyRef(ref({ verification: 'unverified', rights: { license: 'CC0' } })), 'unverified');
  assert.equal(M.classifyRef(ref({ url: 'https://exemple.test/cassee.jpg' }), { failed }), 'unavailable');
  assert.equal(M.classifyRef(ref({ rights: { display: 'forbidden' } })), 'rights_unknown');
  assert.equal(M.classifyRef(ref({ verification: 'unverified' })), 'rights_unknown');
  assert.equal(M.classifyRef(null), 'unavailable');
  assert.equal(Object.keys(M.MEDIA_STATUS).length, 8);
  assert.equal(M.classifyRef(ref({ verification: 'verified', rights: { statement: 'Données du calendrier' } })), 'local');
});

test('choix du visuel : couverture principale avant variante, jamais un recueil pour un numéro, interdit et cassé écartés', () => {
  const cover = ref({ visualType: 'cover', url: 'https://exemple.test/c.jpg', verification: 'verified' });
  const variant = ref({ visualType: 'variant', url: 'https://exemple.test/v.jpg', verification: 'verified' });
  const tpb = ref({ visualType: 'collected_cover', url: 'https://exemple.test/t.jpg', verification: 'verified' });
  assert.equal(M.pickRef('issue', [variant, cover, tpb]).url, cover.url);
  assert.equal(M.pickRef('issue', [tpb]), null);
  assert.equal(M.pickRef('edition', [cover, tpb]).url, tpb.url);
  assert.equal(M.pickRef('issue', [ref({ rights: { display: 'forbidden' } })]), null);
  assert.equal(M.pickRef('issue', [cover], { failed: u => u === cover.url }), null);
  const promo = ref({ visualType: 'promo', url: 'https://exemple.test/p.jpg' });
  assert.equal(M.pickRef('event', [cover, promo]).url, promo.url, 'visuel promotionnel préféré pour un événement');
});

test('contrôle des associations : non vérifiée, cassée, droits absents, recueil sur un numéro, même image sur deux entités', () => {
  const a = ref({ providerId: 'manual', url: 'https://exemple.test/x.jpg' });
  const b = ref({ visualType: 'collected_cover', url: 'https://exemple.test/x.jpg', verification: 'verified', rights: { statement: 'Fixture' } });
  const codes = M.auditRefs([{ kind: 'event', key: 'fx_e', ref: a }, { kind: 'issue', key: 'fx_i', ref: b }], { failed: () => false }).map(x => x.kind + ':' + x.code).sort();
  assert.deepEqual(codes, ['event:no_origin', 'event:rights', 'event:shared_url', 'event:unverified', 'issue:collected_for_issue', 'issue:shared_url']);
});

test('adaptateur Wikimedia Commons (désactivé) : requête construite, licences non libres rejetées, association non vérifiée', () => {
  const u = M.commonsSearchUrl('Fixture cover', 5000);
  assert.ok(u.startsWith('https://commons.wikimedia.org/w/api.php?') && u.includes('iiurlwidth=1200') && u.includes('origin=*'));
  assert.equal(M.commonsSearchUrl(''), '');
  // Réponse FICTIVE au format de l'API (pages et licences inventées pour le test)
  const sample = { query: { pages: {
    1: { pageid: 1, title: 'File:Fx libre.jpg', imageinfo: [{ url: 'https://exemple.test/libre.jpg', thumburl: 'https://exemple.test/libre-400.jpg', thumbwidth: 400, thumbheight: 600, mime: 'image/jpeg', descriptionurl: 'https://exemple.test/File:Fx_libre.jpg',
      extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="x">Auteur fictif</a>' }, AttributionRequired: { value: 'true' } } }] },
    2: { pageid: 2, title: 'File:Fx non libre.jpg', imageinfo: [{ url: 'https://exemple.test/nonlibre.jpg', extmetadata: { LicenseShortName: { value: 'Fair use' }, NonFree: { value: 'true' } } }] },
    3: { pageid: 3, title: 'File:Fx sans licence.jpg', imageinfo: [{ url: 'https://exemple.test/x.jpg', extmetadata: {} }] } } } };
  const r = M.commonsParse(sample, { kind: 'event', id: 'fx_event' }, 'promo', '2026-11-08');
  assert.equal(r.refs.length, 1); assert.equal(r.rejected.length, 2);
  const x = r.refs[0];
  assert.deepEqual([x.providerId, x.attribution, x.rights.license, x.verification, x.visualType, x.url, x.entityId], ['wikimedia_commons', 'Auteur fictif', 'CC BY-SA 4.0', 'unverified', 'promo', 'https://exemple.test/libre-400.jpg', 'fx_event']);
  assert.equal(M.classifyRef(x), 'unverified');
});

test('modèle événement : numéros explicites, liens typés et sourcés, trois ordres distincts, chronologie sur dates citées seulement', () => {
  assert.deepEqual(M.expandIssues('1-3, 7'), ['1', '2', '3', '7']);
  assert.deepEqual(M.expandIssues('#0-2'), ['0', '1', '2']);
  assert.deepEqual(M.expandIssues('5-1'), []);
  const srcIds = new Set(['src_fx']);
  const ev = M.sanitizeEventBlock({ universe: 'Fixture', mainSeries: { series: 'Fx Event', issues: [{ issue: '#2', coverDate: '2020-02' }, { issue: '1', coverDate: '2020-01' }, { issue: '1' }, { issue: '3', coverDate: 'bientôt' }] },
    links: [{ relation: 'tie_in', series: 'Fx Tie', issues: '1-2', sourceId: 'src_fx', readingPos: 2 }, { relation: 'invente', series: 'X' }, { relation: 'prelude', series: 'Fx Pre', sourceId: 'src_inconnue' }] }, srcIds);
  assert.equal(ev.mainSeries.issues.length, 3, 'doublon retiré');
  assert.equal(ev.mainSeries.issues.find(i => i.issue === '3').coverDate, '', 'date invalide non retenue');
  assert.equal(ev.links.length, 2, 'relation inconnue écartée');
  assert.equal(ev.links.find(l => l.relation === 'prelude').sourceId, '', 'source inconnue non attribuée');
  const v = M.eventView({ event: ev, orders: [{ type: 'publication', entries: [] }, { type: 'reference', entries: [] }] });
  assert.deepEqual(v.main.map(i => i.issue), ['1', '2', '3']);
  assert.deepEqual(v.timeline.map(t => t.issue), ['1', '2']);
  assert.equal(v.orders.publication.length, 1); assert.equal(v.orders.recommended.length, 0, 'aucun ordre recommandé reconstruit'); assert.equal(v.orders.chronological.length, 0);
  assert.equal(v.groups.tie_in[0].issueList.length, 2);
  assert.equal(M.sanitizeEventBlock(null), null);
});

test('relations entre événements : cible inconnue et réciproque absente signalées, jamais créées', () => {
  const gs = [{ id: 'gd_fx_a', relations: [{ type: 'followed_by', guideId: 'gd_fx_b' }, { type: 'related', guideId: 'gd_fx_z' }] }, { id: 'gd_fx_b', relations: [] }];
  assert.deepEqual(M.checkEventRelations(gs).map(x => x.code).sort(), ['missing_reciprocal', 'unknown_target']);
});

test('catalogue initial : 4 Marvel + 4 DC, une source par fiche, chaque lien sourcé, aucune image, relations cohérentes', () => {
  const pubs = S.EVENT_SEEDS.map(g => g.publisher);
  assert.equal(pubs.filter(p => p === 'Marvel').length, 4); assert.equal(pubs.filter(p => p === 'DC').length, 4);
  S.EVENT_SEEDS.forEach(g => {
    assert.match(g.id, /^gd_[a-z0-9_]+$/);
    assert.ok(g.sources.length >= 1 && g.sources.every(s => s.url.startsWith('https://en.wikipedia.org/') && /aucune image/.test(s.license)));
    assert.equal(g.image, null, g.id + ' : aucune image');
    assert.equal(g.completeness, 'partial');
    const ids = new Set(g.sources.map(s => s.id));
    const ev = M.sanitizeEventBlock(g.event, ids);
    assert.ok(ev.mainSeries.issues.length >= 5);
    assert.ok(ev.links.every(l => l.sourceId), g.id + ' : chaque lien porte sa source');
    assert.ok(g.orders.every(o => o.type === 'publication'), g.id + ' : seul l\'ordre de publication est fourni');
    assert.ok(g.creators.every(c => c.sourceId && ids.has(c.sourceId)));
  });
  assert.deepEqual(M.checkEventRelations(S.EVENT_SEEDS), []);
  const kib = M.sanitizeEventBlock(S.KIB_EVENT, new Set([S.KIB_SOURCE.id, 'src_cbro']));
  assert.equal(kib.mainSeries.issues.length, 5); assert.equal(kib.mainSeries.issues[0].releaseDate, '2020-12-02');
  assert.ok(kib.links.every(l => l.sourceId));
});
