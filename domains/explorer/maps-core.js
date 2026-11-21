'use strict';
// Cartes des univers (D-107) : catalogue des cartes de l'atlas Primestone « Cosmologies Marvel & DC », fournies par Panel
// (data/atlas-maps.json et images dans maps/). Personne n'ajoute de carte personnelle.
// Module pur : validation du catalogue, classement, recherche (titres et entités) et calcul du zoom de la visionneuse.

const UNIS = Object.freeze({ marvel: 'Marvel', dc: 'DC' });
const THEMES = Object.freeze({ cosmology: 'Structure du cosmos', beings: 'Entités et familles', realms: 'Lieux et royaumes', powers: 'Magie et forces', timeline: 'Chronologies' });
// Niveaux de fiabilité de l'atlas (repris tels quels)
const REL = Object.freeze({ c: 'Canon', o: 'Source officielle', d: 'Interprétation', t: 'Théorie', x: 'Contesté', u: 'À vérifier' });
const BASIS = Object.freeze({ publications: 'D\'après', data: 'Construite à partir des fiches de l\'atlas.', plan: 'Plan Primestone, sans schéma officiel.' });

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, ' ').replace(/\s+/g, ' ').trim();

// Catalogue validé : clé « marvel-01 » ou « dc-01 », chemins d'images déduits de la clé (jamais lus dans les données)
const validate = raw => {
  const list = raw && Array.isArray(raw.maps) ? raw.maps : [];
  const seen = new Set(), out = [];
  for (const m of list) {
    const key = String(m && m.key || '');
    const k = key.match(/^(marvel|dc)-(\d{2})$/);
    if (!k || seen.has(key) || m.uni !== k[1] || !THEMES[m.theme]) continue;
    const title = clean(m.title, 80); if (!title) continue;
    const w = Number(m.w), h = Number(m.h); if (!(w > 0 && h > 0)) continue;
    const basis = m.basis && BASIS[m.basis.type] ? { type: m.basis.type, text: m.basis.type === 'publications' ? clean(m.basis.text, 200) : '' } : { type: 'plan', text: '' };
    const rel = {}; Object.keys(REL).forEach(c => { const n = Number(m.rel && m.rel[c]); if (n > 0) rel[c] = Math.floor(n); });
    const names = (Array.isArray(m.names) ? m.names : []).map(x => (Array.isArray(x) ? x : [x]).map(s => clean(s, 80)).filter(Boolean).slice(0, 2)).filter(x => x.length).slice(0, 400);
    seen.add(key);
    out.push({ key, uni: k[1], n: Number(k[2]), theme: m.theme, title, sub: clean(m.sub, 140), about: clean(m.about, 400), basis, w, h, rel, names,
      img: 'maps/' + key + '.webp', thumb: 'maps/' + key + '-thumb.webp' });
  }
  return out.sort((a, b) => (a.uni === b.uni ? a.n - b.n : a.uni === 'marvel' ? -1 : 1));
};

// Entités de la carte qui correspondent à la recherche (nom anglais ou français)
const hits = (m, q) => { const t = norm(q); if (t.length < 2) return []; return m.names.filter(x => x.some(s => norm(s).includes(t))).map(x => x[0]); };
// Filtre par univers, thème et texte (titre, sous-titre, présentation, entités) ; l'ordre du catalogue est conservé
const filter = (list, opts = {}) => (list || []).filter(m => (!opts.uni || opts.uni === 'all' || m.uni === opts.uni) &&
  (!opts.theme || opts.theme === 'all' || m.theme === opts.theme) &&
  (!opts.q || norm([m.title, m.sub, m.about].join(' ')).includes(norm(opts.q)) || hits(m, opts.q).length > 0));
// Comptes par univers et par thème (pour les filtres)
const counts = list => (list || []).reduce((o, m) => { o[m.uni] = (o[m.uni] || 0) + 1; o[m.theme] = (o[m.theme] || 0) + 1; return o; }, {});
// Niveaux de fiabilité présents sur la carte, dans l'ordre de l'atlas : [['t', 13], ['u', 8]]
const relSummary = m => Object.keys(REL).filter(c => m.rel[c]).map(c => [c, m.rel[c]]);
// Libellé compté et accordé : « 13 théories », « 1 interprétation », « 8 à vérifier »
const REL_COUNT = Object.freeze({ c: ['entrée canon', 'entrées canon'], o: ['source officielle', 'sources officielles'], d: ['interprétation', 'interprétations'], t: ['théorie', 'théories'], x: ['entrée contestée', 'entrées contestées'], u: ['à vérifier', 'à vérifier'] });
const relLabel = (c, n) => REL_COUNT[c] ? n + ' ' + REL_COUNT[c][n > 1 ? 1 : 0] : '';
// Cartes où figure une entité (nom exact, anglais ou français)
const ofEntity = (list, name) => { const t = norm(name); if (t.length < 3) return []; return (list || []).filter(m => m.names.some(x => x.some(s => norm(s) === t))); };

// ── Visionneuse : zoom autour d'un point, déplacement borné ─────────────────────
const ZMIN = 1, ZMAX = 10;
const clampZ = z => Math.min(ZMAX, Math.max(ZMIN, Number(z) || 1));
// Taille de l'image ajustée à la vue (contenue), à zoom 1
const fit = (vw, vh, iw, ih) => { if (!(vw > 0 && vh > 0 && iw > 0 && ih > 0)) return { w: 0, h: 0 }; const s = Math.min(vw / iw, vh / ih); return { w: iw * s, h: ih * s }; };
// Position bornée : l'image reste centrée si elle est plus petite que la vue, sinon elle ne laisse pas de vide sur les bords
const clampPan = (st, vw, vh, fw, fh) => {
  const cw = fw * st.z, ch = fh * st.z;
  const x = cw <= vw ? (vw - cw) / 2 : Math.min(0, Math.max(vw - cw, st.x));
  const y = ch <= vh ? (vh - ch) / 2 : Math.min(0, Math.max(vh - ch, st.y));
  return { z: st.z, x, y };
};
// Zoom d'un facteur autour du point (px, py) de la vue : ce point reste sous le doigt ou la souris
const zoomAt = (st, factor, px, py, vw, vh, fw, fh) => {
  const z = clampZ(st.z * factor), k = z / st.z;
  return clampPan({ z, x: px - (px - st.x) * k, y: py - (py - st.y) * k }, vw, vh, fw, fh);
};
const initial = (vw, vh, fw, fh) => clampPan({ z: 1, x: 0, y: 0 }, vw, vh, fw, fh);

module.exports = { UNIS, THEMES, REL, BASIS, validate, hits, filter, counts, relSummary, relLabel, ofEntity, ZMIN, ZMAX, clampZ, fit, clampPan, zoomAt, initial };
