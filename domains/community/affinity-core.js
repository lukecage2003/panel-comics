'use strict';
// Goûts appris (D-98) : l'algorithme « Pour toi » s'adapte à ce que la personne fait sur CET appareil.
// Module pur : l'appelant fournit les gestes (J'aime, Enregistrer, clic sur un mot-dièse, « Moins de ce sujet ») et leurs sujets.
// Rien n'est envoyé : l'état vit dans le stockage local, se lit en clair (« Vos goûts ») et s'efface d'un geste.
// Les poids s'estompent avec le temps (demi-vie HALF_LIFE_D jours) : un goût ancien ne fige pas le fil.

const VERSION = 1;
const KINDS = Object.freeze(['series', 'characters', 'creators', 'publishers', 'events', 'tags']);
const SIGNALS = Object.freeze({ like: 1, unlike: -1, save: 1.5, unsave: -1.5, tag: 0.6, open: 0.4, less: -2.5 });
const HALF_LIFE_D = 30;
const CAP = 6;          // poids brut maximal d'un sujet (avant estompage)
const FLOOR = -4;       // « Moins de ce sujet » peut descendre plus bas qu'un J'aime ne monte
const MAX_KEYS = 240;   // au-delà, les sujets les plus faibles sont oubliés
const KIND_LABEL = Object.freeze({ series: 'Série', characters: 'Personnage', creators: 'Auteur', publishers: 'Éditeur', events: 'Événement', tags: 'Mot-dièse' });

const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(\s*\d{4}[^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const ms = d => { const t = d instanceof Date ? d.getTime() : Date.parse(d); return isNaN(t) ? Date.now() : t; };
const KEY = /^(series|characters|creators|publishers|events|tags):[a-z0-9 ]{1,80}$/;

const emptyState = () => ({ version: VERSION, w: {} });

// Chaque entrée : { v: poids au moment at, at: ISO, n: libellé d'origine (affichage) }
const sanitize = raw => {
  const out = emptyState();
  if (!raw || typeof raw !== 'object' || !raw.w || typeof raw.w !== 'object') return out;
  Object.entries(raw.w).slice(0, MAX_KEYS * 2).forEach(([k, e]) => {
    if (!KEY.test(k) || !e || typeof e !== 'object') return;
    const v = Number(e.v);
    if (!isFinite(v) || isNaN(Date.parse(e.at))) return;
    out.w[k] = { v: Math.max(FLOOR, Math.min(CAP, v)), at: new Date(Date.parse(e.at)).toISOString(), n: String(e.n || k.split(':')[1]).slice(0, 80) };
  });
  return prune(out);
};

const decay = (v, at, now) => { const days = Math.max(0, (ms(now) - ms(at)) / 86400000); return v * Math.pow(0.5, days / HALF_LIFE_D); };

const prune = st => {
  const keys = Object.keys(st.w);
  if (keys.length <= MAX_KEYS) return st;
  keys.sort((a, b) => Math.abs(st.w[b].v) - Math.abs(st.w[a].v)).slice(MAX_KEYS).forEach(k => { delete st.w[k]; });
  return st;
};

// topics : { series: [...], characters: [...], tags: [...] … } ; renvoie un nouvel état
const record = (state, signal, topics, now) => {
  const st = sanitize(state);
  const s = SIGNALS[signal];
  if (!s || !topics || typeof topics !== 'object') return st;
  const t = new Date(ms(now)).toISOString();
  KINDS.forEach(kind => {
    const list = Array.isArray(topics[kind]) ? topics[kind] : [];
    [...new Set(list.map(x => String(x || '').trim()).filter(Boolean))].slice(0, 12).forEach(name => {
      const n = norm(name); if (!n || n.length > 80) return;
      const k = kind + ':' + n, e = st.w[k];
      const base = e ? decay(e.v, e.at, now) : 0;
      // Plus un sujet est déjà fort, moins un geste de plus le renforce (rendements décroissants)
      const gain = s > 0 ? s * (1 - Math.max(0, base) / (CAP + 1)) : s;
      const v = Math.max(FLOOR, Math.min(CAP, base + gain));
      if (Math.abs(v) < 0.05) { delete st.w[k]; return; }
      st.w[k] = { v, at: t, n: name.slice(0, 80) };
    });
  });
  return prune(st);
};

// Intérêts pour rankingCore : { series: { nom: 0..1 } … } (les tags se rangent dans series/characters selon leur nom, ici à part)
// et réglages négatifs (tuning) pour ce que la personne fuit. Courbe douce : 1 J'aime ≈ 0,25 ; 4 gestes forts ≈ 0,7.
const toRanking = (state, now) => {
  const st = sanitize(state), interests = {}, tuning = {};
  Object.entries(st.w).forEach(([k, e]) => {
    const [kind, n] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
    const v = decay(e.v, e.at, now);
    if (kind === 'tags') return;
    if (v > 0.05) { (interests[kind] = interests[kind] || {})[e.n] = Math.round((v / (v + 3)) * 1000) / 1000; }
    else if (v < -0.5) tuning[kind + ':' + n] = Math.max(-1, Math.round((v / 4) * 100) / 100);
  });
  return { interests, tuning };
};

// Poids d'un mot-dièse (pour classer les puces de filtre) : >0 aimé, <0 évité
const tagWeight = (state, tag, now) => { const e = sanitize(state).w['tags:' + norm(tag)]; return e ? decay(e.v, e.at, now) : 0; };

// « Vos goûts » : les sujets les plus forts, lisibles, avec leur sens
const top = (state, now, n) => {
  const st = sanitize(state);
  return Object.entries(st.w).map(([k, e]) => ({ key: k, kind: k.slice(0, k.indexOf(':')), name: e.n, weight: Math.round(decay(e.v, e.at, now) * 100) / 100 }))
    .filter(x => Math.abs(x.weight) >= 0.2)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, Math.max(1, n || 12))
    .map(x => Object.assign(x, { kindLabel: KIND_LABEL[x.kind], direction: x.weight > 0 ? 'more' : 'less' }));
};

const forget = (state, key) => { const st = sanitize(state); delete st.w[key]; return st; };
const size = state => Object.keys(sanitize(state).w).length;

module.exports = { VERSION, KINDS, SIGNALS, HALF_LIFE_D, CAP, FLOOR, MAX_KEYS, KIND_LABEL, norm, emptyState, sanitize, record, toRanking, tagWeight, top, forget, size };
