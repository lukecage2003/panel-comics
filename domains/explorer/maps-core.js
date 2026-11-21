'use strict';
// Mes cartes (D-106) : cartes d'univers importées par l'utilisateur (cosmos, multivers, planètes, villes, chronologies…).
// Module pur : métadonnées, filtres et calcul du zoom de la visionneuse. Les images restent sur l'appareil (IndexedDB côté
// interface) ; rien n'est envoyé ni partagé. Aucun format exécutable (SVG refusé).

const KINDS = Object.freeze({ cosmic: 'Cosmique', multiverse: 'Multivers', world: 'Planètes et géographie', city: 'Villes et lieux', timeline: 'Chronologie', other: 'Autre' });
const TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const MAX_BYTES = 60 * 1024 * 1024;
const MAX_MAPS = 500;

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const cleanText = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);

// Fichier accepté : type d'image courant, taille bornée
const acceptFile = f => {
  if (!f) return { ok: false, error: 'missing' };
  if (!TYPES.includes(String(f.type || '').toLowerCase())) return { ok: false, error: 'type' };
  if (!(f.size > 0) || f.size > MAX_BYTES) return { ok: false, error: 'size' };
  return { ok: true };
};
// Titre lisible tiré du nom de fichier : « carte_cosmos-marvel_v2.jpg » -> « Carte cosmos marvel v2 »
const titleFromFile = name => { const t = clean(String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_\-.]+/g, ' '), 120); return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Carte sans titre'; };
// Métadonnées nettoyées ; source facultative mais en https si renseignée
const sanitizeMeta = raw => {
  const r = raw || {};
  const source = clean(r.source, 400);
  return {
    title: clean(r.title, 120) || 'Carte sans titre',
    universe: clean(r.universe, 60),
    kind: KINDS[r.kind] ? r.kind : 'other',
    note: cleanText(r.note, 2000),
    source: /^https:\/\/\S+$/.test(source) ? source : ''
  };
};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Filtre (type, univers, texte) puis tri : les plus récentes d'abord
const filter = (list, opts = {}) => (list || []).filter(m => (!opts.kind || opts.kind === 'all' || m.kind === opts.kind) &&
  (!opts.universe || norm(m.universe) === norm(opts.universe)) &&
  (!opts.q || norm([m.title, m.universe, m.note].join(' ')).includes(norm(opts.q).trim())))
  .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
// Univers présents, pour les filtres (ordre alphabétique, sans doublon)
const universes = list => [...new Set((list || []).map(m => clean(m.universe, 60)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
// Comptes par type
const counts = list => (list || []).reduce((o, m) => { o[m.kind] = (o[m.kind] || 0) + 1; return o; }, {});

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

module.exports = { KINDS, TYPES, MAX_BYTES, MAX_MAPS, ZMIN, ZMAX, acceptFile, titleFromFile, sanitizeMeta, filter, universes, counts, clampZ, fit, clampPan, zoomAt, initial };
