'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('./i18n-core');
const EN = require('./i18n-en');
const ES = require('./i18n-es');
const PT = require('./i18n-pt');

test('langue : choix enregistré, sinon le navigateur en « auto », sinon le français', () => {
  assert.equal(I.resolveLocale('en'), 'en');
  assert.equal(I.resolveLocale('EN'), 'en');
  assert.equal(I.resolveLocale('de'), 'fr', 'langue inconnue : français');
  assert.equal(I.resolveLocale('', ['en-GB']), 'fr', 'aucun choix : français, pas de bascule implicite');
  assert.equal(I.resolveLocale('auto', ['de-DE', 'pt-BR']), 'pt');
  assert.equal(I.intlLocale('en'), 'en-US');
  assert.equal(I.intlLocale('xx'), 'fr-FR');
  assert.equal(I.dir('en'), 'ltr');
});

test('traduction exacte, espaces conservés, rien pour le français ni pour une phrase inconnue', () => {
  const tr = I.translator('en', EN);
  assert.equal(tr('  Réglages '), '  Settings ');
  assert.equal(tr('Une note personnelle de l\'utilisateur'), null, 'contenu inconnu : jamais touché');
  assert.equal(tr(''), null);
  assert.equal(I.translator('fr', EN)('Réglages'), null, 'le français est la langue source');
  assert.equal(I.translator('en', null)('Réglages'), null);
});

test('nombres : repérés dans la phrase et remis à leur place', () => {
  const tr = I.translator('en', EN);
  assert.equal(tr('Tout afficher (18)'), 'Show all (18)');
  assert.equal(tr('1 120 XP'), '1 120 XP');
  assert.equal(tr('Numéros possédés : 3 / 10 pour le palier suivant'), 'Issues owned: 3 / 10 for the next tier');
  assert.equal(tr('À débloquer · 0 numéro 1'), 'To unlock · 0 issue #1');
  assert.equal(I.template('Lot 2.3 · 4 comic(s)').t, 'Lot {n} · {n} comic(s)');
});

test('noms propres gardés tels quels, sans retraduction en chaîne', () => {
  const tr = I.translator('en', EN);
  assert.equal(tr('Jonathan Hickman'), 'Jonathan Hickman');
  assert.equal(tr('Settings'), null, 'une traduction n\'est pas une phrase source');
});

test('tables saines : pas de traduction vide, mêmes {n}, aucune balise', () => {
  [EN, ES, PT].forEach(d => assert.deepEqual(I.checkDict(d), [], d.locale));
  assert.equal(I.checkDict({ phrases: { 'a {n}': 'b', c: '', d: '<b>x</b>' } }).length, 3);
});

test('la coque est traduite dans les quatre langues', () => {
  const shell = ['Accueil', 'Collection', 'Lecture', 'Explorer', 'Réglages', 'Ma collection', 'Fermer', 'Langue'];
  [EN, ES, PT].forEach(d => {
    const c = I.coverage(shell, d.locale, d);
    assert.equal(c.translated, shell.length, d.locale + ' : ' + c.missing.join(', '));
  });
});

test('dates et nombres suivent la langue (Intl)', () => {
  assert.equal(I.fmtNumber(1234.5, 'en'), '1,234.5');
  assert.equal(I.fmtDate('2026-11-18T12:00:00Z', 'en', { day: 'numeric', month: 'short', timeZone: 'UTC' }), 'Nov 18');
  assert.equal(I.fmtDate('invalide', 'en'), '');
});
