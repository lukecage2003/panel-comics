/* Panel (D-108) : une carte, seule. Les raccourcis clavier de l'explorateur sont coupés ; Échap désélectionne. */
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
