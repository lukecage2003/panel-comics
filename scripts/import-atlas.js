#!/usr/bin/env node
'use strict';
// D-108 : les cartes interactives de l'atlas « Cosmologies Marvel & DC » (dépôt de l'utilisateur), et rien d'autre, dans cartes/.
// Usage : node scripts/import-atlas.js <dossier du dépôt cloné>
// Seul l'explorateur des cartes est repris, avec ce dont il a besoin pour dessiner les cartes : explorer.html (les 18 cartes,
// animations, zoom, tour, sélection), data.js, data-dc.js, images.js et les portraits img/*.webp. Aucune autre page du site
// (accueil, encyclopédie, fiches, chronologies, dossiers) n'est copiée, et Panel n'y renvoie jamais.
// Trois retouches, demandées par l'utilisateur :
// 1. le nom « Primestone » est retiré des textes (règles ci-dessous, phrase par phrase) ; la copie est refusée s'il en reste un ;
// 2. aucun renvoi vers le site d'origine ni vers un service tiers : les adresses du site (aperçus de partage, fiches, notices) et
//    les polices Google sont retirées ; les titres prennent les polices de Panel (fonts/) ; la copie est refusée s'il en reste ;
// 3. une carte, seule : la feuille de styles de Panel (cartes/panel-cartes.css) masque tout ce qui n'est pas la carte (barre du haut
//    et ses onglets vers les autres cartes, barre du bas : tour, versions, formats, vidéo, téléchargements ; titre d'introduction,
//    légendes, Codex, quiz, panneau de fiche du site) et un court script de Panel (cartes/panel-cartes.js) coupe les raccourcis
//    clavier qui changent de carte, lancent le tour, changent de format ou filment. Un clic sur une entité ouvre la fiche de Panel.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SAFE = /^[A-Za-z0-9_.-]+$/;
const TOP_FILES = ['explorer.html', 'data.js', 'data-dc.js', 'images.js'];
const TEXT = /\.(html|js|css)$/;

// Retrait du nom, de la tournure la plus précise à la plus générale. [motif, remplacement]
const RULES = [
  [/ · Primestone(<\/title>|")/g, ' · Cosmologies Marvel &amp; DC$1'],
  [/property="og:site_name" content="Primestone"/g, 'property="og:site_name" content="Cosmologies Marvel &amp; DC"'],
  [/title="Accueil Marvel Primestone"/g, 'title="Accueil de l’atlas"'],
  [/Un atlas Primestone\. Au-delà des héros\./g, 'Un atlas de fans. Au-delà des héros.'],
  [/A Primestone atlas\. Beyond the heroes\./g, 'A fan atlas. Beyond the heroes.'],
  [/l’atlas interactif Primestone/g, 'l’atlas interactif'],
  [/la cosmologie Marvel par Primestone :/g, 'la cosmologie Marvel :'],
  [/Aucune version officielle publiée : plan Primestone/g, 'Aucune version officielle publiée : plan de l’atlas'],
  [/c’est un plan Primestone\./g, 'c’est un plan de l’atlas.'],
  [/Dans le plan Primestone, /g, 'Dans le plan de l’atlas, '],
  [/Classement Primestone indicatif/g, 'Classement indicatif'],
  [/classement Primestone indicatif/g, 'classement indicatif'],
  [/An indicative Primestone ranking/g, 'An indicative ranking'],
  [/indicative Primestone ranking/g, 'indicative ranking'],
  [/SUIS PRIMESTONE POUR LA SUITE/g, 'ABONNE-TOI POUR LA SUITE'],
  [/FOLLOW PRIMESTONE FOR MORE/g, 'FOLLOW FOR MORE'],
  [/Suis Primestone pour la suite/g, 'Abonne-toi pour la suite'],
  [/Follow Primestone for more/g, 'Follow for more'],
  [/Primestone présente/g, 'L’atlas présente'],
  [/Primestone presents/g, 'The atlas presents'],
  [/expliqué par Primestone\./g, 'expliqué par l’atlas.'],
  [/ #primestone/g, ''],
  [/le logo Primestone/g, 'le logo de l’atlas'],
  [/the Primestone logo/g, 'the atlas logo'],
  [/Aux couleurs Primestone :/g, 'Aux couleurs de l’atlas :'],
  [/In Primestone colours:/g, 'In the atlas colours:'],
  [/DA Primestone :/g, 'DA de l’atlas :'],
  [/'PRIMESTONE · COSMOLOGIE MARVEL · '/g, "UNAME.toUpperCase()+' · '"],
  [/`primestone-miniature-/g, '`miniature-'],
  [/'primestone-quiz-/g, "'quiz-"],
  [/'primestone-cosmologie-/g, "'cosmologie-"],
  [/document\.title='Primestone · Codex Cosmologie Marvel'/g, "document.title='Codex Cosmologie Marvel'"],
  [/document\.title='Cosmologie Marvel · Primestone'/g, "document.title='Cosmologie Marvel'"],
  [/\/\* Marvel Primestone : /g, '/* Atlas des cosmologies : '],
  // Aucun renvoi vers le site d'origine ni vers les polices Google
  [/<meta property="og:image"[^\n]*\n/g, ''],
  [/<meta property="og:url"[^>]*>/g, ''],
  [/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">[^\n]*\n/g, ''],
  [/<link href="https:\/\/fonts\.googleapis\.com\/[^"]*" rel="stylesheet">\n?/g, ''],
  [/window\.SOLO!=null\?'https:\/\/lukecage2003\.github\.io\/marvel-primeston\/':''/g, "''"]
];
// Ce qui ne doit plus rester dans la copie
const LEFT = /.{0,40}(?:primestone|lukecage2003|fonts\.googleapis|fonts\.gstatic).{0,40}/i;
const debrand = s => RULES.reduce((t, [re, to]) => t.replace(re, to), s);

// Seule la carte reste visible dans Panel
const PANEL_CSS = `/* Panel (D-108) : seules les cartes de l'atlas sont affichées ; le reste du site n'est pas repris. */
/* Titres aux polices de Panel, servies par Panel (aucune police chargée chez un tiers) */
@font-face { font-family: 'Big Shoulders Display'; font-weight: 700 900; font-display: swap; src: url('../fonts/barlow-condensed-800-latin.woff2') format('woff2'); }
@font-face { font-family: 'Anton'; font-display: swap; src: url('../fonts/barlow-condensed-800-latin.woff2') format('woff2'); }
/* Une carte, seule : ni barre du haut (onglets des autres cartes), ni barre du bas (tour, versions, formats, vidéo, téléchargements) */
header, footer, #card, #cap, #bars, #wm, #vbadge, #offplate, #toast, #codex, #quiz, #dl, #panel, #safe { display: none !important; }
#app { grid-template-rows: minmax(0, 1fr) !important; }
/* D-109 : entités dont l'utilisateur possède des séries, allumées par Panel */
.n.panel-own { filter: drop-shadow(0 0 5px #FFD400) drop-shadow(0 0 14px rgba(255, 212, 0, .65)); }
`;
// Raccourcis de l'explorateur coupés (changer de carte, tour, formats, film, Codex, recherche) ; Échap reste pour désélectionner
// Index des entités de toutes les cartes de l'univers ouvert, lu par Panel pour écrire la fiche d'une entité touchée
const PANEL_JS = `/* Panel (D-108) : une carte, seule. Les raccourcis clavier de l'explorateur sont coupés ; Échap désélectionne. */
addEventListener('keydown', function (e) { if (e.key !== 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey) e.stopImmediatePropagation(); }, true);
/* Index des entités des cartes (IDX de l'explorateur), lu par Panel quand une entité est touchée */
window.panelCartesIndex = function () { return typeof IDX !== 'undefined' ? IDX : null; };
/* Légende et étiquettes du nœud sur la carte ouverte (ce que la carte affiche autour de l'entité) */
window.panelCartesNode = function (id) {
  var l = typeof C !== 'undefined' && C && C.nodes || [], n = null;
  for (var i = 0; i < l.length; i++) if (l[i] && l[i].id === id) { n = l[i]; break; }
  return n ? { k: String(n.k || ''), tags: Array.isArray(n.tags) ? n.tags.map(String) : [] } : null;
};
/* D-109 : Panel allume les entités de la carte liées à la collection (calcul fait par Panel, rien n'est envoyé) ; renvoie le nombre allumé */
window.panelCartesMark = function (ids) {
  var set = {}, l = typeof C !== 'undefined' && C && C.nodes || [], els = document.querySelectorAll('.n[data-i]'), on = 0;
  (ids || []).forEach(function (k) { set[String(k)] = 1; });
  for (var i = 0; i < els.length; i++) { var n = l[Number(els[i].getAttribute('data-i'))], hit = !!(n && set[n.id]); els[i].classList.toggle('panel-own', hit); if (hit) on++; }
  return on;
};
/* D-119 : un toucher sur un personnage ou un lieu le sélectionne, au doigt comme à la souris. L'explorateur capture le pointeur
   pour pouvoir déplacer la carte : le relâchement arrive alors sur le fond et rien n'était choisi. On retient le nœud touché. */
(function () {
  var down = null;
  addEventListener('pointerdown', function (e) { var n = e.isPrimary && e.target && e.target.closest ? e.target.closest('.n[data-i]') : null; down = n ? { i: Number(n.getAttribute('data-i')), x: e.clientX, y: e.clientY } : null; }, true);
  addEventListener('pointerup', function (e) {
    var d = down; down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
    setTimeout(function () { if (typeof select === 'function' && typeof S !== 'undefined' && S && S.sel !== d.i && !S.tour) select(d.i); }, 0);
  }, true);
})();
`;
const withPanelCss = html => {
  if (!/<\/head>/i.test(html)) throw new Error('explorer.html : balise </head> introuvable');
  // D-109 : adresse versionnée par le contenu, pour qu'une carte déjà ouverte reprenne tout de suite les retouches de Panel
  const v = require('crypto').createHash('sha256').update(PANEL_CSS + PANEL_JS).digest('hex').slice(0, 10);
  return html.replace(/<\/head>/i, '<link rel="stylesheet" href="panel-cartes.css?v=' + v + '">\n<script src="panel-cartes.js?v=' + v + '"></script>\n</head>');
};

if (require.main === module) {
  const src = process.argv[2];
  if (!src || !fs.existsSync(path.join(src, 'explorer.html'))) {
    console.error('Usage : node scripts/import-atlas.js <dossier du dépôt marvel-primeston>');
    process.exit(1);
  }
  const ROOT = path.join(__dirname, '..');
  const OUT = path.join(ROOT, 'cartes');
  const files = TOP_FILES.filter(f => fs.existsSync(path.join(src, f)));
  if (files.length !== TOP_FILES.length) { console.error('Fichiers manquants dans le dépôt :', TOP_FILES.filter(f => !files.includes(f))); process.exit(1); }
  for (const f of fs.readdirSync(path.join(src, 'img'))) if (/\.webp$/.test(f) && SAFE.test(f)) files.push('img/' + f);

  // Tout est préparé en mémoire et contrôlé avant d'écrire : en cas de mention restante, cartes/ n'est pas touché
  const out = new Map(), left = [];
  for (const f of files) {
    let buf = fs.readFileSync(path.join(src, f));
    if (TEXT.test(f)) {
      let t = debrand(buf.toString('utf8'));
      if (f === 'explorer.html') t = withPanelCss(t);
      const m = t.match(LEFT);
      if (m) left.push(f + ' : ' + m[0]);
      buf = Buffer.from(t, 'utf8');
    }
    out.set(f, buf);
  }
  if (left.length) { console.error('Mentions ou renvois restants (' + left.length + ') :\n' + left.slice(0, 20).join('\n')); process.exit(1); }
  out.set('panel-cartes.css', Buffer.from(PANEL_CSS, 'utf8'));
  out.set('panel-cartes.js', Buffer.from(PANEL_JS, 'utf8'));

  fs.rmSync(OUT, { recursive: true, force: true });
  let bytes = 0;
  for (const [f, buf] of out) {
    const to = path.join(OUT, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, buf);
    bytes += buf.length;
  }
  let commit = '', date = '';
  try {
    commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    date = execFileSync('git', ['-C', src, 'log', '-1', '--format=%cI'], { encoding: 'utf8' }).trim();
  } catch (_) { /* dossier sans Git : provenance sans commit */ }
  fs.writeFileSync(path.join(OUT, 'SOURCE.json'), JSON.stringify({
    site: 'Cosmologies Marvel & DC',
    repository: 'https://github.com/lukecage2003/marvel-primeston',
    commit, date, files: out.size, bytes,
    note: 'Cartes interactives seules (explorer.html et ses données), sans les autres pages du site. Nom de l’auteur, renvois vers le site et polices Google retirés ; panel-cartes.css et panel-cartes.js ne laissent que la carte. Atlas de fans, non commercial. Personnages et images © Marvel et © DC.'
  }, null, 2) + '\n');
  console.log('cartes : ' + out.size + ' fichiers (' + (bytes / 1048576).toFixed(1) + ' Mo), commit ' + (commit.slice(0, 7) || '?'));
}

module.exports = { RULES, LEFT, debrand, PANEL_CSS, PANEL_JS };
