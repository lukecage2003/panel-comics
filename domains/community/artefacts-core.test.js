'use strict';
const test = require('node:test');
const assert = require('node:assert');
const A = require('./artefacts-core.js');

test('catalogue : identifiants uniques, mesures connues, six gemmes', () => {
  const ids = A.ARTEFACTS.map(a => a.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  A.ARTEFACTS.forEach(a => assert.ok(a.metric === 'gems' || A.METRICS[a.metric], a.id));
  A.ARTEFACTS.forEach(a => assert.ok(A.RARITIES[a.rarity], a.id));
  assert.strictEqual(A.ARTEFACTS.filter(a => a.gem).length, 6);
  assert.ok(A.ARTEFACTS.some(a => a.universe === 'dc') && A.ARTEFACTS.some(a => a.universe === 'marvel'));
});

test('aucune activité : rien de débloqué, valeurs invalides ignorées', () => {
  const r = A.computeArtefacts({ owned: -3, read: 'x' });
  assert.strictEqual(r.unlocked, 0);
  assert.ok(r.next);
});

test('déblocage sur mesure réelle et gant de l\'Infini avec les six gemmes', () => {
  const some = A.computeArtefacts({ owned: 1, read: 10 });
  assert.ok(some.list.find(a => a.id === 'batarang').unlocked);
  assert.ok(some.list.find(a => a.id === 'web_shooter').unlocked);
  assert.ok(!some.list.find(a => a.id === 'gauntlet').unlocked);
  const early = A.computeArtefacts({ publishers: 4, reviewed: 25, read: 200, owned: 300, reread: 10, stories: 20 });
  assert.strictEqual(early.gems, 0, 'D-75 : quelques mois d\'activité ne suffisent plus pour une gemme');
  const all = A.computeArtefacts({ publishers: 15, reviewed: 300, read: 2500, owned: 2500, reread: 200, stories: 365 });
  assert.strictEqual(all.gems, 6);
  assert.ok(all.list.find(a => a.id === 'gauntlet').unlocked);
});

test('D-75 : illustrations https pour le Gant, les six gemmes et Mjolnir', () => {
  ['gauntlet', 'gem_space', 'gem_mind', 'gem_reality', 'gem_power', 'gem_time', 'gem_soul', 'mjolnir'].forEach(id => {
    const a = A.ARTEFACTS.find(x => x.id === id);
    assert.ok(/^https:\/\//.test(a.img) && a.imgSrc, id);
  });
});
