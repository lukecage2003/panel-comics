'use strict';
// Cartes des univers (D-107, D-108) : catalogue des cartes de l'atlas « Cosmologies Marvel & DC » (atlas de fans), fourni par Panel
// (data/atlas-maps.json et vignettes dans maps/). Chaque carte s'ouvre, animée, dans l'explorateur des cartes repris seul dans
// cartes/ ; un personnage ou un lieu touché ouvre sa fiche dans Panel. Personne n'ajoute de carte personnelle.
// Module pur : validation du catalogue, classement, recherche (titres et entités) et adresse de la carte dans l'atlas.

const UNIS = Object.freeze({ marvel: 'Marvel', dc: 'DC' });
const THEMES = Object.freeze({ cosmology: 'Structure du cosmos', beings: 'Entités et familles', realms: 'Lieux et royaumes', powers: 'Magie et forces', timeline: 'Chronologies' });

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, ' ').replace(/\s+/g, ' ').trim();

// Catalogue validé : clé « marvel-01 » ou « dc-01 », chemins déduits de la clé (jamais lus dans les données)
const validate = raw => {
  const list = raw && Array.isArray(raw.maps) ? raw.maps : [];
  const seen = new Set(), out = [];
  for (const m of list) {
    const key = String(m && m.key || '');
    const k = key.match(/^(marvel|dc)-(\d{2})$/);
    if (!k || seen.has(key) || m.uni !== k[1] || !THEMES[m.theme]) continue;
    const title = clean(m.title, 80); if (!title) continue;
    const w = Number(m.w), h = Number(m.h); if (!(w > 0 && h > 0)) continue;
    const n = Number(k[2]); if (!(n >= 1)) continue;
    const names = (Array.isArray(m.names) ? m.names : []).map(x => (Array.isArray(x) ? x : [x]).map(s => clean(s, 80)).filter(Boolean).slice(0, 2)).filter(x => x.length).slice(0, 400);
    seen.add(key);
    out.push({ key, uni: k[1], n, theme: m.theme, title, sub: clean(m.sub, 140), about: clean(m.about, 400), w, h, names,
      thumb: 'maps/' + key + '-thumb.webp', atlas: atlasUrl(k[1], n) });
  }
  return out.sort((a, b) => (a.uni === b.uni ? a.n - b.n : a.uni === 'marvel' ? -1 : 1));
};
// Adresse de la carte dans l'explorateur de l'atlas : « explorer.html?map=0 » (Marvel), « explorer.html?u=dc&map=0 » (DC)
const atlasUrl = (uni, n) => 'cartes/explorer.html?' + (uni === 'dc' ? 'u=dc&' : '') + 'map=' + (n - 1);

// Entités de la carte qui correspondent à la recherche (nom anglais ou français)
const hits = (m, q) => { const t = norm(q); if (t.length < 2) return []; return m.names.filter(x => x.some(s => norm(s).includes(t))).map(x => x[0]); };
// Filtre par univers, thème et texte (titre, sous-titre, présentation, entités) ; l'ordre du catalogue est conservé
const filter = (list, opts = {}) => (list || []).filter(m => (!opts.uni || opts.uni === 'all' || m.uni === opts.uni) &&
  (!opts.theme || opts.theme === 'all' || m.theme === opts.theme) &&
  (!opts.q || norm([m.title, m.sub, m.about].join(' ')).includes(norm(opts.q)) || hits(m, opts.q).length > 0));
// Comptes par univers et par thème (pour les filtres)
const counts = list => (list || []).reduce((o, m) => { o[m.uni] = (o[m.uni] || 0) + 1; o[m.theme] = (o[m.theme] || 0) + 1; return o; }, {});

module.exports = { UNIS, THEMES, validate, atlasUrl, hits, filter, counts };
