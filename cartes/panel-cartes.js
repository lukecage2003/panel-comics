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
