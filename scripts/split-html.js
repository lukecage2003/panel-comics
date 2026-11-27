'use strict';
// D-132 : démarrage rapide de l'application Android. La source reste un fichier unique (index.html) ;
// à la construction, les gros scripts en ligne et la feuille de style sortent dans des fichiers séparés.
// Le moteur peut alors garder en cache le code compilé d'un lancement à l'autre (impossible pour un script en ligne)
// et lire la page sans analyser 2,9 Mo d'un bloc. Ordre et nature des scripts inchangés (classiques, synchrones).
// Usage : const { html, files } = require('./split-html').split(sourceHtml) ; files = [{ name, text }].
const MIN = 20 * 1024; // les petits scripts (thème, écran d'ouverture) restent en ligne : ils doivent agir avant tout le reste

function split(src) {
  const files = [];
  let n = 0;
  let html = src.replace(/<script>([\s\S]*?)<\/script>/g, (all, code) => {
    if (code.length < MIN) return all;
    const name = 'js/app-' + (++n) + '.js';
    files.push({ name, text: code });
    return '<script src="' + name + '"></script>';
  });
  html = html.replace(/<style>([\s\S]*?)<\/style>/, (all, css) => {
    if (css.length < MIN) return all;
    files.push({ name: 'app.css', text: css });
    return '<link rel="stylesheet" href="app.css" />';
  });
  if (!n) throw new Error('split-html : aucun script principal trouvé');
  return { html, files };
}

module.exports = { split };
