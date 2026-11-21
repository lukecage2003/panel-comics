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
