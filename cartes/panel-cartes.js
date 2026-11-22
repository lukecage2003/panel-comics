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
/* D-120 : recherche dans la carte. On tape un nom, la carte va droit sur le personnage ou le lieu (et sa fiche s'ouvre dans Panel). */
(function () {
  var norm = function (t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
  var nameOf = function (o) { var e = typeof IDX !== 'undefined' && IDX && IDX[o.id]; return (e && (e.fr || e.t)) || o.t || o.id || ''; };
  var css = document.createElement('style');
  css.textContent = '#pnlFind{position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:50;width:min(420px,calc(100vw - 92px));font:600 15px system-ui,sans-serif}' +
    '#pnlFind input{width:100%;box-sizing:border-box;height:44px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(10,10,12,.82);color:#fff;font:inherit;outline:none;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}' +
    '#pnlFind input:focus{border-color:#FFD400}#pnlFind ul{list-style:none;margin:6px 0 0;padding:6px;border-radius:18px;background:rgba(10,10,12,.92);max-height:46vh;overflow:auto}' +
    '#pnlFind li button{display:block;width:100%;min-height:44px;text-align:left;padding:8px 12px;border:0;border-radius:12px;background:none;color:#fff;font:inherit;cursor:pointer}#pnlFind li button:hover,#pnlFind li button:focus{background:rgba(255,212,0,.16)}';
  document.head.appendChild(css);
  var box = document.createElement('div'); box.id = 'pnlFind'; box.setAttribute('role', 'search');
  box.innerHTML = '<input type="search" placeholder="Chercher sur la carte" aria-label="Chercher sur la carte" autocomplete="off" enterkeyhint="search"><ul hidden></ul>';
  var add = function () { if (document.body) document.body.appendChild(box); else setTimeout(add, 50); }; add();
  var input = box.querySelector('input'), list = box.querySelector('ul');
  var go = function (i) { list.hidden = true; input.blur(); if (typeof select === 'function') select(i); };
  input.addEventListener('input', function () {
    var q = norm(input.value).trim(), nodes = typeof C !== 'undefined' && C && C.nodes || [];
    list.textContent = '';
    if (q.length < 2) { list.hidden = true; return; }
    var hits = [];
    for (var i = 0; i < nodes.length && hits.length < 8; i++) { var n = nameOf(nodes[i]); if (norm(n).indexOf(q) >= 0) hits.push([i, n]); }
    hits.forEach(function (h) { var li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.textContent = h[1]; b.onclick = function () { go(h[0]); }; li.appendChild(b); list.appendChild(li); });
    if (!hits.length) { var li = document.createElement('li'); li.style.cssText = 'padding:10px 12px;opacity:.7'; li.textContent = 'Rien sur cette carte'; list.appendChild(li); }
    list.hidden = false;
  });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var b = list.querySelector('button'); if (b) b.click(); } });
})();
