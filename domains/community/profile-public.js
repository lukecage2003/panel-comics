'use strict';
// Profil social (lot S5, D-93, docs/directeur/11-virage-reseau-social.md) : ce qu'un visiteur verra du profil.
// Module pur : l'appelant fournit le profil, la collection et les publications ; la sortie ne contient QUE ce qui est permis.
// Jamais publiés, quels que soient les réglages : finances (prix d'achat, valeurs, plus-values), emplacements et rangement,
// notes privées, état détaillé, numéros d'exemplaire. Les publications ne sortent que si leur visibilité est « public ».

const VERSION = 1;
const FIELDS = Object.freeze([
  { key: 'shelf', label: 'Mon étagère (les numéros, par la tranche)', def: true },
  { key: 'counts', label: 'Nombre de numéros et de séries', def: true },
  { key: 'reading', label: 'Nombre de numéros lus', def: true },
  { key: 'trophies', label: 'Rang et trophées', def: true },
  { key: 'tops', label: 'Mes tops (personnages et runs)', def: true },
  { key: 'wishlist', label: 'Ma Wishlist', def: false }
]);
const NEVER = Object.freeze(['Finances, prix d\'achat et valeurs', 'Emplacements et rangement', 'Notes privées et état détaillé']);
const SHELF_MAX = 36;

const defaults = () => FIELDS.reduce((o, f) => { o[f.key] = f.def; return o; }, {});
const sanitize = prefs => {
  const out = defaults();
  if (prefs && typeof prefs === 'object') FIELDS.forEach(f => { if (typeof prefs[f.key] === 'boolean') out[f.key] = prefs[f.key]; });
  return out;
};

const str = (v, max) => String(v == null ? '' : v).slice(0, max);
const safeUrl = u => (/^https:\/\//i.test(String(u || '')) || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(String(u || '')) ? String(u) : '');
// Un numéro tel qu'il peut être montré : titre, numéro, éditeur, variante, couverture. Rien d'autre.
const light = c => ({ series: str(c && c.series, 120), issue: str(c && c.issue, 20), publisher: str(c && c.publisher, 80), variant: str(c && c.variant, 80), coverUrl: safeUrl(c && c.coverUrl) });

const normKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^(the|le|la|les)\s+/, '').trim();
const issueNum = v => { const m = String(v || '').match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : Infinity; };

// Étagère : les derniers numéros ajoutés (au plus max), rangés comme sur une vraie étagère (série, puis numéro), sans doublon.
const shelfOrder = (copies, max = SHELF_MAX) => {
  const seen = new Set();
  const recent = (Array.isArray(copies) ? copies : []).filter(c => c && c.series)
    .slice().sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')))
    .filter(c => { const k = normKey(c.series) + '#' + String(c.issue || '').trim() + '#' + normKey(c.variant); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, Math.max(0, max));
  return recent.sort((a, b) => normKey(a.series).localeCompare(normKey(b.series), 'fr') || issueNum(a.issue) - issueNum(b.issue) || String(a.issue).localeCompare(String(b.issue)))
    .map(c => Object.assign({ id: str(c.id, 80) }, light(c)));
};

// Vue publique du profil. input : { profile, copies, wishlist, readCount, rank, trophiesUnlocked, posts }
const publicView = (input, prefs) => {
  const p = sanitize(prefs), i = input || {}, pr = i.profile || null;
  const copies = Array.isArray(i.copies) ? i.copies : [];
  const out = { version: VERSION, prefs: p, never: NEVER.slice() };
  out.profile = pr ? { handle: str(pr.handle, 24), displayName: str(pr.displayName, 40), bio: str(pr.bio, 160), favorite: str(pr.favorite, 60), color: /^#[0-9a-f]{6}$/i.test(pr.color || '') ? pr.color : '#7C5CFF' } : null;
  if (p.tops && pr) { out.topCharacters = (pr.topCharacters || []).filter(Boolean).slice(0, 3).map(x => str(x, 60)); out.topRuns = (pr.topRuns || []).filter(Boolean).slice(0, 3).map(x => str(x, 60)); }
  if (p.counts) out.counts = { copies: copies.length, series: new Set(copies.map(c => normKey(c && c.series)).filter(Boolean)).size };
  if (p.reading) out.read = Math.max(0, Number(i.readCount) || 0);
  if (p.shelf) out.shelf = shelfOrder(copies).map(c => { const o = Object.assign({}, c); delete o.id; return o; });
  if (p.wishlist) out.wishlist = (Array.isArray(i.wishlist) ? i.wishlist : []).slice(0, 60).map(light);
  if (p.trophies && i.rank) out.rank = { name: str(i.rank.name, 60), rank: Number(i.rank.rank) || 0, trophies: Math.max(0, Number(i.trophiesUnlocked) || 0) };
  out.posts = (Array.isArray(i.posts) ? i.posts : []).filter(x => x && x.visibility === 'public')
    .map(x => ({ id: str(x.id, 80), kind: str(x.kind, 20), text: str(x.text, 2200), at: str(x.at, 40), media: (x.media || []).slice(0, 10).map(light) }));
  return out;
};

module.exports = { VERSION, FIELDS, NEVER, SHELF_MAX, defaults, sanitize, light, shelfOrder, publicView };
