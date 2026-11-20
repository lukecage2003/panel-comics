'use strict';
// Classement du fil « Pour toi » (D-91, docs/directeur/11-virage-reseau-social.md § 5).
// Inspiré de ce qu'Instagram publie lui-même (fiches de transparence de Meta, explications d'Adam Mosseri) :
//  - plusieurs actions prédites (j'aime, enregistrement, envoi, réponse, temps passé) combinées par des poids ;
//  - affinité avec l'auteur, intérêt pour le sujet, fraîcheur, originalité, signaux négatifs forts ;
//  - règles de diversité après le score (auteur, sujet, part des abonnements).
// Propre à Panel : intérêt calculé sur les séries, personnages, éditeurs et événements (collection, lecture, pull list),
// et « bouclier anti-spoiler » fondé sur la lecture réelle. Les poids sont ceux de Panel, versionnés (ceux d'Instagram ne sont pas publics).
// Module pur et déterministe : l'appelant fournit les publications et le contexte ; rien n'est inventé ni envoyé.

const VERSION = 1;
const WEIGHTS = Object.freeze({ like: 1, reply: 2.5, save: 3, send: 4, dwell: 1.5 });
// Taux de référence (a priori) : une publication sans portée n'est ni favorisée ni pénalisée
const PRIOR = Object.freeze({ like: 0.08, reply: 0.01, save: 0.02, send: 0.01, dwell: 0.3 });
const PRIOR_REACH = 50;
const HALF_LIFE_H = Object.freeze({ forYou: 18, discover: 72 });
const SPOILER_DAYS = 30;
const RULES = Object.freeze({ perAuthorWindow: 10, perAuthorMax: 2, topicShareMax: 0.4, followingShareMin: 0.3 });
const TOPIC_KINDS = ['series', 'characters', 'creators', 'publishers', 'events'];
const LABELS = Object.freeze({
  following: 'Tu suis ce compte', affinity: 'Tu échanges souvent avec ce compte', interest: 'Lié à ce que tu lis ou collectionnes',
  quality: 'Beaucoup enregistré ou partagé', fresh: 'Publié récemment', original: 'Photo ou numéro 3D d\'origine', tuned: 'Sujet que tu as demandé à voir plus'
});

const num = v => (Number.isFinite(+v) && +v > 0 ? +v : 0);
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(\s*\d{4}[^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const asSet = v => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : []));
const topicKeys = post => { const t = (post && post.topics) || {}; const out = []; TOPIC_KINDS.forEach(k => (Array.isArray(t[k]) ? t[k] : []).forEach(x => { const n = norm(x); if (n) out.push(k + ':' + n); })); return out; };

// Taux lissé : (actions + a priori × portée de référence) / (portée + portée de référence)
const rate = (n, reach, prior) => (num(n) + prior * PRIOR_REACH) / (num(reach) + PRIOR_REACH);

// Intérêts : { 'series:saga': poids }, à partir de ce que l'appelant fournit (collection, lecture, pull list, wishlist), poids bornés à 1
const interestMap = ctx => {
  const m = new Map();
  const add = (kind, name, w) => { const n = norm(name); if (!n) return; const k = kind + ':' + n; m.set(k, Math.min(1, (m.get(k) || 0) + w)); };
  const I = (ctx && ctx.interests) || {};
  TOPIC_KINDS.forEach(kind => { const v = I[kind]; if (v && typeof v === 'object') Object.entries(v).forEach(([name, w]) => add(kind, name, Math.max(0, Math.min(1, +w || 0)))); });
  return m;
};

// Spoiler : un texte (avis, discussion, ou publication marquée « spoiler ») cite un numéro sorti il y a moins de SPOILER_DAYS jours
// que la personne n'a pas marqué lu. Une simple photo de couverture n'est pas un spoiler.
const SPOILER_KINDS = new Set(['text', 'review']);
const spoilerOf = (post, ctx, now) => {
  if (!post.spoiler && !SPOILER_KINDS.has(post.kind)) return null;
  const read = asSet(ctx && ctx.readKeys);
  const refs = Array.isArray(post.issueRefs) ? post.issueRefs : [];
  for (const r of refs) {
    if (!r || !r.key || read.has(r.key)) continue;
    const d = Date.parse(r.releaseDate || '');
    if (!Number.isFinite(d) || now - d < SPOILER_DAYS * 864e5) return { key: r.key, label: r.label || '' };
  }
  return null;
};

const scoreOne = (post, ctx, im, now, mode) => {
  const st = post.stats || {}, reach = num(st.reach);
  const following = asSet(ctx.following).has(post.authorId);
  const aff = Math.min(1, num((ctx.affinity || {})[post.authorId]) / 10);
  const tk = topicKeys(post);
  const tuning = ctx.tuning || {};
  let interest = 0, tuned = 0;
  tk.forEach(k => { interest = Math.max(interest, im.get(k) || 0); const t = +tuning[k] || 0; if (Math.abs(t) > Math.abs(tuned)) tuned = Math.max(-1, Math.min(1, t)); });
  const p = { like: rate(st.likes, reach, PRIOR.like), reply: rate(st.replies, reach, PRIOR.reply), save: rate(st.saves, reach, PRIOR.save), send: rate(st.sends, reach, PRIOR.send), dwell: rate(st.longViews, reach, PRIOR.dwell) };
  const engagement = Object.keys(WEIGHTS).reduce((s, k) => s + WEIGHTS[k] * p[k], 0);
  const baseline = Object.keys(WEIGHTS).reduce((s, k) => s + WEIGHTS[k] * PRIOR[k], 0);
  const quality = engagement / baseline; // 1 = moyenne
  const ageH = Math.max(0, (now - Date.parse(post.createdAt || 0)) / 36e5);
  const fresh = Math.pow(0.5, ageH / (HALF_LIFE_H[mode] || HALF_LIFE_H.forYou));
  const original = post.original === false ? 0.5 : 1;
  const relevance = 1 + (following ? 0.6 : 0) + aff + 1.2 * interest + 0.8 * tuned;
  const score = Math.max(0, relevance) * quality * fresh * original;
  const parts = [
    ['following', following ? 0.6 : 0], ['affinity', aff], ['interest', 1.2 * interest], ['tuned', tuned > 0 ? 0.8 * tuned : 0],
    ['quality', quality > 1.3 ? quality - 1 : 0], ['fresh', ageH < 6 ? 0.5 : 0], ['original', post.kind === 'vitrine360' || (post.original !== false && post.kind === 'photo') ? 0.3 : 0]
  ].filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { score, following, topics: tk, reasons: parts.map(x => ({ id: x[0], label: LABELS[x[0]] })) };
};

// Classement complet. mode : 'forYou' (algorithme), 'following' (abonnements, chronologique), 'discover' (sans les abonnements)
const rank = (posts, ctx = {}, opts = {}) => {
  const mode = opts.mode === 'following' || opts.mode === 'discover' ? opts.mode : 'forYou';
  const now = Number.isFinite(opts.now) ? opts.now : Date.parse(opts.now || '') || Date.now();
  const hidden = ctx.hidden || {}, hp = asSet(hidden.posts), ha = asSet(hidden.authors), ht = asSet((hidden.topics || []).map(t => { const i = String(t).indexOf(':'); return i > 0 ? t.slice(0, i) + ':' + norm(t.slice(i + 1)) : norm(t); }));
  const follow = asSet(ctx.following);
  const im = interestMap(ctx);
  const list = (Array.isArray(posts) ? posts : []).filter(p => p && p.id && p.authorId && !hp.has(p.id) && !ha.has(p.authorId))
    .filter(p => !topicKeys(p).some(k => ht.has(k)))
    .filter(p => mode !== 'following' || follow.has(p.authorId) || p.authorId === ctx.viewerId)
    .filter(p => mode !== 'discover' || (!follow.has(p.authorId) && p.authorId !== ctx.viewerId));
  const scored = list.map(p => Object.assign({ post: p, spoiler: spoilerOf(p, ctx, now) }, scoreOne(p, ctx, im, now, mode)));
  if (mode === 'following') {
    scored.sort((a, b) => String(b.post.createdAt).localeCompare(String(a.post.createdAt)) || String(a.post.id).localeCompare(String(b.post.id)));
    return { version: VERSION, mode, items: scored };
  }
  scored.sort((a, b) => b.score - a.score || String(b.post.createdAt).localeCompare(String(a.post.createdAt)) || String(a.post.id).localeCompare(String(b.post.id)));
  return { version: VERSION, mode, items: diversify(scored, mode) };
};

// Règles finales : au plus perAuthorMax publications d'un auteur par fenêtre de perAuthorWindow ; un sujet au plus topicShareMax
// d'une fenêtre ; en « Pour toi », au moins followingShareMin d'abonnements par fenêtre quand il en reste. Les écartés passent plus bas, jamais retirés.
const diversify = (scored, mode) => {
  const pool = scored.slice(), out = [];
  const W = RULES.perAuthorWindow;
  while (pool.length) {
    const win = out.slice(Math.floor(out.length / W) * W);
    const byAuthor = a => win.filter(x => x.post.authorId === a).length;
    const topicCount = k => win.filter(x => x.topics.includes(k)).length;
    const topicCap = Math.max(1, Math.floor(W * RULES.topicShareMax));
    const needFollow = mode === 'forYou' && win.filter(x => x.following).length < Math.ceil(W * RULES.followingShareMin) && (W - win.length) <= Math.ceil(W * RULES.followingShareMin) - win.filter(x => x.following).length;
    const ok = x => byAuthor(x.post.authorId) < RULES.perAuthorMax && !x.topics.some(k => topicCount(k) >= topicCap) && (!needFollow || x.following);
    let i = pool.findIndex(ok);
    if (i < 0 && needFollow) i = pool.findIndex(x => byAuthor(x.post.authorId) < RULES.perAuthorMax && !x.topics.some(k => topicCount(k) >= topicCap));
    if (i < 0) i = 0;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
};

// « Pourquoi je vois ça ? » : phrase lisible à partir des raisons d'un élément classé
const explain = item => {
  if (!item || !Array.isArray(item.reasons) || !item.reasons.length) return 'Publication récente parmi celles disponibles.';
  return item.reasons.map(r => r.label).join(' · ') + '.';
};

// Réglage « Mon algorithme » : voir plus (+1) ou moins (-1) d'un sujet ; 0 retire le réglage. Renvoie un nouvel objet.
const tune = (tuning, kind, name, value) => {
  const out = Object.assign({}, tuning || {});
  if (!TOPIC_KINDS.includes(kind)) return out;
  const k = kind + ':' + norm(name);
  const v = Math.max(-1, Math.min(1, +value || 0));
  if (!norm(name)) return out;
  if (v === 0) delete out[k]; else out[k] = v;
  return out;
};

module.exports = { VERSION, WEIGHTS, PRIOR, HALF_LIFE_H, SPOILER_DAYS, RULES, LABELS, TOPIC_KINDS, norm, topicKeys, rank, explain, tune };
