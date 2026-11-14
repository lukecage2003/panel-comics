'use strict';
// Fil façon Instagram (D-76) : les planches et les stories de l'utilisateur deviennent des publications.
//  - Mots-dièse déduits des vraies données (éditeur, type de planche, série, coup de cœur) et de ceux écrits dans le texte.
//  - « J'aime », « Enregistrer » et « Épingler » (trois au plus) : état local de l'appareil, jamais envoyé.
//  - Module pur : l'appelant fournit planches, stories et état ; rien n'est inventé (aucun compte, aucun abonné simulé).

const KIND_TAGS = Object.freeze({ pull: 'PullDuMercredi', shelfie: 'Shelfie', gem: 'Pépite', read: 'JeViensDeLire', free: 'Planche' });
const MAX_PINS = 3;

const strip = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
// « Absolute Batman (2024) » -> « AbsoluteBatman » ; « X-Men » -> « XMen » ; les accents restent (« HéroïneFictive »)
const tagify = t => String(t || '').normalize('NFC').replace(/\(\s*\d{4}[^)]*\)/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean)
  .map(w => w[0].toUpperCase() + w.slice(1)).join('').slice(0, 28);
const publisherTag = p => { const n = strip(p).toLowerCase(); return /marvel/.test(n) ? 'Marvel' : /(^|\s)dc(\s|$)|dc comics|vertigo/.test(n) ? 'DC' : /image|skybound/.test(n) ? 'ImageComics' : /urban/.test(n) ? 'UrbanComics' : /panini/.test(n) ? 'Panini' : /dupuis|dargaud|casterman|glenat|delcourt|lombard|soleil/.test(n) ? 'BD' : ''; };
const TEXT_TAG = /#([\p{L}\p{N}_]{2,30})/gu;
const norm = t => strip(t).toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');

const tagsOf = post => {
  const out = [];
  const add = t => { if (t && !out.some(x => norm(x) === norm(t))) out.push(t); };
  String(post.text || '').replace(TEXT_TAG, (_, t) => { add(t); return ''; });
  if (post.type === 'planche') add(KIND_TAGS[post.kind] || KIND_TAGS.free);
  if (post.type === 'story') { add('Lecture'); if (post.rating >= 4.5 || post.liked) add('CoupDeCœur'); if (post.reread) add('Relecture'); }
  (post.media || []).forEach(m => { add(publisherTag(m.publisher)); add(tagify(m.series)); });
  return out.filter(Boolean).slice(0, 8);
};

const emptyState = () => ({ version: 1, likes: {}, saves: {}, pins: [] });
const ID = /^[sp]:[A-Za-z0-9_-]{1,60}$/;
const sanitizeState = v => {
  const o = emptyState();
  if (!v || typeof v !== 'object') return o;
  for (const k of ['likes', 'saves']) if (v[k] && typeof v[k] === 'object') for (const [id, at] of Object.entries(v[k]).slice(0, 2000)) if (ID.test(id) && typeof at === 'string' && !isNaN(Date.parse(at))) o[k][id] = at;
  if (Array.isArray(v.pins)) o.pins = v.pins.filter(id => typeof id === 'string' && ID.test(id)).filter((id, i, a) => a.indexOf(id) === i).slice(0, MAX_PINS);
  return o;
};
// Bascule d'un « j'aime », d'un enregistrement ou d'une épingle ; renvoie un nouvel état (l'ancien reste intact pour l'annulation)
const toggle = (state, what, id, now) => {
  const s = sanitizeState(JSON.parse(JSON.stringify(state || {})));
  if (!ID.test(String(id))) return { state: s, on: false, error: 'invalid_id' };
  if (what === 'pin') {
    const i = s.pins.indexOf(id);
    if (i >= 0) { s.pins.splice(i, 1); return { state: s, on: false }; }
    if (s.pins.length >= MAX_PINS) return { state: s, on: false, error: 'too_many_pins' };
    s.pins.unshift(id); return { state: s, on: true };
  }
  const k = what === 'save' ? 'saves' : 'likes';
  if (s[k][id]) { delete s[k][id]; return { state: s, on: false }; }
  s[k][id] = new Date(now || Date.now()).toISOString(); return { state: s, on: true };
};

// Publications : épinglées d'abord (dans l'ordre d'épinglage), puis de la plus récente à la plus ancienne
const buildFeed = ({ drafts = [], stories = [], state, tag = '', only = '' } = {}) => {
  const st = sanitizeState(state);
  const posts = [];
  for (const d of drafts || []) {
    if (!d || !d.id) continue;
    const media = (d.items || []).slice(0, 10).map(c => ({ series: c.series || '', issue: c.issue || '', publisher: c.publisher || '', coverUrl: c.coverUrl || '', variant: c.variant || '' }));
    posts.push({ id: 'p:' + d.id, ref: d.id, type: 'planche', kind: d.kind || 'free', at: d.createdAt || d.updatedAt || '', text: String(d.text || ''), media, visibility: d.visibility || 'private' });
  }
  for (const s of stories || []) {
    if (!s || !s.id) continue;
    posts.push({ id: 's:' + s.id, ref: s.id, type: 'story', kind: 'read', at: s.createdAt || (s.readAt ? s.readAt + 'T12:00:00Z' : ''), text: String(s.review || ''), spoiler: !!s.spoiler, rating: Number(s.rating) || 0, liked: !!s.liked, reread: !!s.reread, readAt: s.readAt || '',
      media: [{ series: s.series || '', issue: s.issue || '', publisher: s.publisher || '', coverUrl: s.coverUrl || '', variant: s.variant || '' }], style: s.style || '' });
  }
  posts.forEach(p => { p.tags = tagsOf(p); p.likedByMe = !!st.likes[p.id]; p.saved = !!st.saves[p.id]; p.pinned = st.pins.includes(p.id); });
  const t = norm(tag).replace(/^#/, '');
  const list = posts.filter(p => (!t || p.tags.some(x => norm(x) === t)) && (only !== 'saved' || p.saved));
  const pinRank = p => p.pinned ? st.pins.indexOf(p.id) : Infinity;
  list.sort((a, b) => pinRank(a) - pinRank(b) || String(b.at).localeCompare(String(a.at)));
  // Mots-dièse les plus présents (pour les filtres en haut du fil)
  const counts = new Map();
  posts.forEach(p => p.tags.forEach(x => counts.set(x, (counts.get(x) || 0) + 1)));
  const kindSet = new Set(Object.values(KIND_TAGS).concat(['Lecture', 'CoupDeCœur', 'Relecture']));
  const topTags = [...counts.entries()].sort((a, b) => b[1] - a[1] || kindSet.has(b[0]) - kindSet.has(a[0]) || a[0].localeCompare(b[0], 'fr')).slice(0, 12).map(([tg, n]) => ({ tag: tg, n }));
  return { posts: list, total: posts.length, topTags, likes: Object.keys(st.likes).length, saves: Object.keys(st.saves).length };
};

module.exports = { KIND_TAGS, MAX_PINS, tagify, publisherTag, tagsOf, emptyState, sanitizeState, toggle, buildFeed };
