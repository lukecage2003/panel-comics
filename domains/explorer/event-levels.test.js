'use strict';
// Tests de l'Event Center v2 (R2, D-57) : fixtures fictives pour les règles, et contrôle des neuf sélections Panel sur les fiches fournies
const test = require('node:test');
const assert = require('node:assert');
const L = require('./event-levels.js');
const M = require('./media-core.js');
const S = require('./events-seed.js');
const X = require('./events-crossref.js');

const fixture = () => ({ id: 'gd_fixture', event: { mainSeries: { series: 'Fixture War', publisher: 'Fixture', issues: [{ issue: '1' }, { issue: '2' }, { issue: '3' }] },
  links: [{ relation: 'prelude', series: 'Fixture Prelude', issues: '1-2' }, { relation: 'tie_in', series: 'Fixture Tie', issues: '5-6' },
    { relation: 'tie_in', series: 'Fixture Other', issues: '9' }, { relation: 'aftermath', series: 'Fixture After', issues: '' }] } });
const view = g => M.eventView(g);

test('niveaux emboîtés : essentiel ⊂ recommandé ⊂ complet ; série principale toujours essentielle', () => {
  const g = fixture(), lv = L.levelsFor(g, view(g));
  assert.strictEqual(lv.editorial, false);
  assert.strictEqual(lv.levels.essential.count, 3);
  assert.strictEqual(lv.levels.recommended.count, 3);
  assert.strictEqual(lv.levels.complete.count, 3 + 2 + 2 + 1);
  assert.deepStrictEqual(lv.levels.complete.unnumbered, ['Fixture After']);
  const ess = new Set(lv.levels.essential.items.map(i => i.series + i.issue));
  assert.ok(lv.levels.complete.items.filter(i => i.role === 'core').every(i => ess.has(i.series + i.issue)));
});

test('masquer un tie-in : retiré du complet, jamais de l\'essentiel', () => {
  const g = fixture(), lv = L.levelsFor(g, view(g), { hidden: [L.linkKey('tie_in', 'Fixture Tie'), L.linkKey('main', 'Fixture War')] });
  assert.strictEqual(lv.levels.complete.count, 3 + 2 + 1);
  assert.strictEqual(lv.levels.essential.count, 3);
});

test('ordre recommandé Panel : construit par rôles, versionné, jamais repris d\'un guide tiers', () => {
  const g = fixture(), lv = L.levelsFor(g, view(g)), o = L.recommendedOrder(lv, 'complete');
  assert.strictEqual(o.type, 'recommended');
  assert.strictEqual(o.builtFrom, 'roles');
  assert.deepStrictEqual(o.entries.map(e => e.role + ':' + e.series + '#' + e.issue).slice(0, 5), ['prelude:Fixture Prelude#1', 'prelude:Fixture Prelude#2', 'core:Fixture War#1', 'core:Fixture War#2', 'core:Fixture War#3']);
  assert.ok(o.entries.every((e, i) => e.position === i + 1));
  assert.ok(!o.entries.some(e => 'readingPos' in e));
});

test('progression par niveau : lus, ignorés, prochain numéro selon le niveau', () => {
  const g = fixture(), lv = L.levelsFor(g, view(g));
  const read = new Set(['Fixture War#1', 'Fixture Prelude#1', 'Fixture Prelude#2']);
  const p = L.progressFor(lv, it => read.has(it.series + '#' + it.issue) ? 'read' : it.series === 'Fixture Tie' && it.issue === '5' ? 'skipped' : '');
  assert.deepStrictEqual([p.essential.read, p.essential.total, p.essential.next.issue], [1, 3, '2']);
  assert.strictEqual(p.complete.next.series, 'Fixture War');
  assert.strictEqual(p.complete.skipped, 1);
  assert.strictEqual(p.complete.done, 4);
});

test('les neuf événements fournis ont des niveaux justifiés et applicables', () => {
  const guides = S.EVENT_SEEDS.map(s => M.mergeCrossref(JSON.parse(JSON.stringify(s)), X.CROSSREF[s.id]));
  guides.push(M.mergeCrossref({ id: 'gd_king_in_black', sources: [S.KIB_SOURCE], event: JSON.parse(JSON.stringify(S.KIB_EVENT)) }, X.KIB_CROSSREF));
  assert.strictEqual(guides.length, 9);
  guides.forEach(g => {
    const v = view(g), a = L.auditSelection(g, v), lv = L.levelsFor(g, v);
    assert.ok(a.ok, g.id + ' : ' + a.problems.join(' ; '));
    assert.ok(lv.editorial && lv.version >= 1 && lv.changes.length >= 1, g.id + ' : sélection versionnée');
    assert.ok(lv.levels.essential.count > 0 && lv.levels.essential.count <= lv.levels.recommended.count && lv.levels.recommended.count <= lv.levels.complete.count, g.id);
    // Aucune série ni aucun numéro ajouté : chaque numéro des niveaux vient de la fiche
    const known = new Set(lv.levels.complete.items.map(i => i.series + '#' + i.issue));
    lv.levels.recommended.items.forEach(i => assert.ok(known.has(i.series + '#' + i.issue)));
  });
});

test('fiche modifiée : un lien sélectionné disparu est signalé « non applicable », jamais inventé', () => {
  const g = M.mergeCrossref(JSON.parse(JSON.stringify(S.EVENT_SEEDS.find(x => x.id === 'gd_flashpoint'))), X.CROSSREF.gd_flashpoint);
  g.event.links = g.event.links.filter(l => l.series !== 'The Flash');
  const v = view(g), lv = L.levelsFor(g, v), a = L.auditSelection(g, v);
  assert.strictEqual(a.ok, false);
  assert.deepStrictEqual(lv.unmatched.map(u => u.series), ['The Flash']);
  assert.ok(!lv.levels.recommended.items.some(i => i.series === 'The Flash'));
  assert.ok(lv.levels.essential.count === 5);
});
