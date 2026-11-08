#!/usr/bin/env node
'use strict';
// Contrôle statique des frontières entre domaines (préparation du lot 3.1b, aucun changement de comportement).
// Mode rapport (par défaut) : liste les couplages connus, code de sortie 0.
// Mode strict (--strict, utilisé par npm run test:all depuis le sous-lot 3.1b-6) : code de sortie 1 s'il reste un couplage interdit.
// Références : docs/phase4/02-frontieres-collection-explorer.md (C2-C10, D1-D4, E1-E5), docs/directeur/05-preparation-lot-3.1b.md.
const fs = require('fs');
const path = require('path');

const FILE = process.env.BOUNDARIES_FILE || path.join(__dirname, '..', 'index.html'); // fichier substituable (contrôle négatif des tests)
const src = fs.readFileSync(FILE, 'utf8').split(/\r?\n/);

// Fonctions de premier niveau de l'IIFE : « const nom = » indenté de deux espaces.
const fns = [];
src.forEach((line, i) => {
  const m = /^ {2}const ([A-Za-z_$][\w$]*) = /.exec(line);
  if (m) fns.push({ name: m[1], start: i });
});
fns.forEach((f, k) => { f.end = k + 1 < fns.length ? fns[k + 1].start - 1 : src.length - 1; });

// Explorer : fonctions préfixées « ex » et « gd » (guides), rendu, chargement et éditeur de guides.
const EXPLORER_FNS = ['wireExplorer', 'showExplorer', 'renderExplorer', 'loadExplorerData', 'renderGuideEditor', 'openGuideEditor', 'saveGuideDraft', 'wireGuideEditor'];
const isExplorer = n => /^(ex|gd)[A-Z]/.test(n) || EXPLORER_FNS.includes(n);
// Identifiants personnels (Collection, Lecture) qu'Explorer ne doit plus lire directement après 3.1b.
const PERSONAL = [
  { id: 'physicalSingles', rule: 'C2-C6 : inventaire personnel → S1' },
  { id: 'relPulls', rule: 'C8 : Pull List (Collection) → S1 inPullList' },
  { id: 'openSingleInspector', rule: 'C9 : action Collection → S2 openItem' },
  { id: 'addPubToWishlist', rule: 'C9 : action Collection → S2 addToWishlist' },
  { id: "exPut('readprog'", rule: 'C10 : écriture de la progression (Lecture) → S2 setGuideProgress' },
  { id: 'persistSingles', rule: 'Écriture de Collection depuis Explorer interdite' },
  { id: "put('collection'", rule: 'A7 : catégorie « Ma collection » dans la recherche Explorer' },
  // Lot 3.1b-3 : fonctions internes de Collection et de Lecture, accessibles seulement par S1 et S2
  { id: 'getPullList', rule: 'C8 : séries suivies (Collection) → S1 seriesFollowed' },
  { id: 'seriesMeta', rule: 'C8 : séries suivies (Collection) → S1 seriesFollowed' },
  { id: 'isPulled', rule: 'C8 : séries suivies (Collection) → S1 seriesFollowed' },
  { id: 'colMatch', rule: 'Rapprochement interne de Collection → S1' },
  { id: 'colIndex', rule: 'Rapprochement interne de Collection → S1' },
  { id: 'lecSetGuideProgress', rule: 'C10 : écriture de la progression (Lecture) → S2 setGuideProgress' },
  { id: 'exProgress', rule: 'C10 : lecture de la progression (Lecture) → S1 guideProgress', allow: ['exEditorial', 'loadExplorerData'] }
];

// Lot 3.1b-5 (E1 à E5) : calendrier éditorial, publications et sources = Explorer (A5). Pull List, wishlist et conversions = Collection (relMakeSingle, addPub*, *Pull*).
const CALENDAR_FNS = ['renderReleasesGrid', 'renderReleasesWeekLabel', 'renderPubSheet', 'openPubSheet', 'loadReleaseData', 'loadReleasesForWeek', 'syncReleases', 'importReleaseRows', 'importReleaseText',
  'exportReleasesCsv', 'exportReleaseData', 'sanitizeReleaseData', 'mergeReleaseData', 'wireReleaseControls', 'renderDataAdmin', 'openDataAdmin', 'wireDataAdmin'];
const COLLECTION_IN_CALENDAR = ['relMakeSingle'];
const isCalendar = n => !isExplorer(n) && !COLLECTION_IN_CALENDAR.includes(n) && (/^(rel|da|src|prov|cv)[A-Z]/.test(n) || CALENDAR_FNS.includes(n));
// Stockage partagé (E5) et ancien format d'export (D-23) : seuls usages admis de la Pull List depuis le calendrier
const E5_ALLOW = ['relPubs', 'loadReleaseData', 'exportReleaseData', 'mergeReleaseData', 'sanitizeReleaseData'];
const CALENDAR_PERSONAL = PERSONAL.filter(p => !['exProgress', "put('collection'", "exPut('readprog'"].includes(p.id)).map(p => (p.id === 'relPulls' ? Object.assign({}, p, { rule: 'E1, E3 : Pull List (Collection) → S1 pullPending / referencedPubs', allow: E5_ALLOW }) : p)).concat([
  { id: 'addPubToCollection', rule: 'E1 : écriture de Collection → S2 addToCollection' },
  { id: 'addPull(', rule: 'E1 : écriture de la Pull List → S2 addToPullList' },
  { id: 'togglePull', rule: 'E1 : abonnement à une série → S2 followSeries' },
  { id: 'wishToCollection', rule: 'E1 : conversion (Collection) → S2 addToCollection' },
  { id: 'pickUpPull', rule: 'E1 : conversion (Collection) → S2' },
  { id: 'editSingleIssue', rule: 'E1 : fiche d\'exemplaire (Collection) → S2' },
  { id: 'renderPullPanel', rule: 'A5 : panneau Pull List (Collection) → registre des panneaux hébergés' },
  { id: 'ownsIssue', rule: 'E4 : possession (Collection) → S1 statusFor' },
  { id: 'relCopiesOf', rule: 'E4 : exemplaires d\'une publication → S1 statusFor (owned: n)' }
]);

const findings = [];
const scan = (list, rules) => {
  for (const f of list) {
    for (let i = f.start; i <= f.end; i++) {
      const line = src[i];
      if (/^\s*\/\//.test(line)) continue;
      for (const p of rules) if (line.includes(p.id) && !(p.allow && p.allow.includes(f.name))) findings.push({ fn: f.name, line: i + 1, id: p.id, rule: p.rule });
    }
  }
};
scan(fns.filter(f => isExplorer(f.name)), PERSONAL);
scan(fns.filter(f => isCalendar(f.name)), CALENDAR_PERSONAL);

// Lot 3.1b-6 (D1 à D4) : Collection (et tout code hors Explorer et calendrier) ne lance ni ne lit Explorer directement.
// Seuls les ponts nommés ci-dessous y sont admis, chacun pour une raison de conception.
const EXPLORER_PRIVATE = [
  { id: 'showExplorer', rule: 'D1 : lancement d’Explorer → registre des vues hébergées' },
  { id: 'renderExplorer', rule: 'D1 : rendu d’Explorer → registre des vues hébergées' },
  { id: 'wireExplorer', rule: 'D1 : Explorer se branche lui-même' },
  { id: 'exOpenView', rule: 'D1 : point d’entrée d’Explorer → registre des vues hébergées' },
  { id: 'loadExplorerData', rule: 'D1 : données d’Explorer chargées par Explorer' },
  { id: 'renderReleasesGrid', rule: 'D1 : rendu du calendrier (Explorer) → crochets de vue' },
  { id: 'loadReleasesForWeek', rule: 'D1 : ouverture du calendrier (Explorer) → crochets de vue' },
  { id: 'exportExplorerData', rule: 'D2, D3 : export de Collection sans Explorer → fournisseurs de sauvegarde' },
  { id: 'exportReleaseData', rule: 'D2, D3 : export de Collection sans calendrier → fournisseurs de sauvegarde' },
  { id: 'mergeReleaseData', rule: 'D3 : restauration du calendrier par son fournisseur' },
  { id: 'sanitizeReleaseData', rule: 'D3 : validation du calendrier par son fournisseur' },
  { id: 'exEditorial', rule: 'D : guides éditoriaux (Explorer) → S1 / fournisseur' },
  { id: 'exProgress', rule: 'D : progression (Lecture) → S1 guideProgress' },
  { id: 'exResolve', rule: 'D : rapprochement éditorial (Explorer) → fournisseur S1' },
  { id: 'exIndexBuild', rule: 'D : index éditorial (Explorer) → fournisseur S1' },
  { id: 'gdExport', rule: 'D : export des guides (Explorer)' }
];
const D_BRIDGES = {
  lecSetGuideProgress: 'Lecture, propriétaire de la progression (stockage partagé E5)',
  exportExplorerData: 'Explorer : bloc de l’ancien format (D-23)',
  mergeExplorerData: 'Explorer : bloc de l’ancien format (D-23)',
  initReleases: 'Application : démarrage des modules',
  validateBackupPayload: 'Application : sauvegarde complète (D4)',
  applyBackupRestore: 'Application : restauration complète (D4)',
  bindEvents: 'Application : boutons de sauvegarde complète (D4)',
  bunReady: 'Application : fournisseurs de sauvegarde (D4)',
  BUNDLE_PROVIDERS: 'Application : registre des fournisseurs de sauvegarde (D4)',
  BUNDLE_STORES: 'Application : registre des fournisseurs de sauvegarde (D4)',
  lensGuideProgress: 'Fournisseur S1',
  cmdSetGuideProgress: 'Fournisseur S2',
  PERSONAL_CONTRACTS_V1: 'Fournisseurs S1/S2 et API de test window.Panel'
};
const isOther = n => !isExplorer(n) && !isCalendar(n);
scan(fns.filter(f => isOther(f.name) && !Object.prototype.hasOwnProperty.call(D_BRIDGES, f.name)), EXPLORER_PRIVATE);

const strict = process.argv.includes('--strict');
const byRule = {};
findings.forEach(x => { (byRule[x.rule] = byRule[x.rule] || []).push(`${x.fn} l.${x.line}`); });
console.log(`check-boundaries : ${fns.filter(f => isExplorer(f.name)).length} fonctions Explorer, ${fns.filter(f => isCalendar(f.name)).length} du calendrier et ${fns.filter(f => isOther(f.name)).length} autres (Collection, Lecture, Application ; ${Object.keys(D_BRIDGES).length} ponts admis) analysées, ${findings.length} couplage(s) entre domaines.`);
for (const [rule, where] of Object.entries(byRule)) console.log(`  - ${rule} : ${where.join(', ')}`);
if (strict && findings.length) { console.log('check-boundaries --strict : ÉCHEC (frontières non respectées).'); process.exitCode = 1; }
else if (!strict) console.log('Mode rapport : aucun échec (npm run test:all utilise --strict).');

module.exports = { findings };
