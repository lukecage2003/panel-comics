'use strict';
// Pensées (D-96) : la partie « Twitter » de Panel. Un texte court sur les comics (pensée, théorie, question), avec mots-dièse,
// une image facultative (page de la galerie, gardée sur l'appareil), un numéro lié facultatif et un voile anti-spoiler.
// Les théories reçoivent un verdict de leur auteur quand le numéro sort (« Confirmée » ou « Ratée »), idée propre à Panel.
// Module pur : l'appelant fournit l'état et l'heure ; aucune personne, aucune réponse ni réaction d'autrui n'est simulée.

const VERSION = 1;
const KINDS = Object.freeze({ thought: 'Pensée', theory: 'Théorie', question: 'Question' });
const KIND_TAGS = Object.freeze({ thought: '', theory: 'Théorie', question: 'Question' });
const VERDICTS = Object.freeze({ open: 'En attente du verdict', confirmed: 'Confirmée', busted: 'Ratée' });
const VISIBILITY = Object.freeze(['private', 'followers', 'public']);
const LIMITS = Object.freeze({ text: 2000, notes: 1000, tag: 30, tags: 10, series: 120, issue: 20 });
const ID = /^[A-Za-z0-9_-]{1,60}$/;
const TAG = /#([\p{L}\p{N}_]{2,30})/gu;

const str = (v, n) => String(v === undefined || v === null ? '' : v).slice(0, n);
const iso = v => { const t = Date.parse(v); return v && Number.isFinite(t) ? new Date(t).toISOString() : ''; };
const strip = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const emptyState = () => ({ version: VERSION, notes: [] });

// Mots-dièse écrits dans le texte, sans doublon (casse et accents ignorés), dix au plus
const hashtags = text => {
  const out = [];
  String(text || '').replace(TAG, (_, t) => { if (!out.some(x => strip(x) === strip(t)) && out.length < LIMITS.tags) out.push(t); return ''; });
  return out;
};

const sanitizeNote = n => {
  if (!n || typeof n !== 'object' || !ID.test(String(n.id || ''))) return null;
  const text = str(n.text, LIMITS.text).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const imageRef = ID.test(String(n.imageRef || '')) ? n.imageRef : '';
  if (!text && !imageRef) return null;
  const kind = KINDS[n.kind] ? n.kind : 'thought';
  const issue = n.issue && typeof n.issue === 'object' && n.issue.series ? { series: str(n.issue.series, LIMITS.series).trim(), issue: str(n.issue.issue, LIMITS.issue).trim(), publisher: str(n.issue.publisher, 100).trim() } : null;
  return {
    id: n.id, kind, text, imageRef, imageAlt: str(n.imageAlt, 140).trim(), issue,
    spoiler: n.spoiler === true,
    verdict: kind === 'theory' && VERDICTS[n.verdict] ? n.verdict : (kind === 'theory' ? 'open' : ''),
    visibility: VISIBILITY.includes(n.visibility) ? n.visibility : 'public',
    createdAt: iso(n.createdAt), editedAt: iso(n.editedAt)
  };
};

const sanitizeState = s => {
  const o = emptyState();
  if (!s || typeof s !== 'object' || !Array.isArray(s.notes)) return o;
  for (const n of s.notes) { const x = sanitizeNote(n); if (x && x.createdAt && !o.notes.some(y => y.id === x.id)) o.notes.push(x); if (o.notes.length >= LIMITS.notes) break; }
  return o;
};

const validate = n => {
  const errors = [];
  if (!n) { errors.push('Écrivez quelque chose ou ajoutez une image.'); return errors; }
  if (n.text.length > LIMITS.text) errors.push('Deux mille caractères au plus.');
  if (/<[a-z!/]/i.test(n.text)) errors.push('Les balises ne sont pas acceptées.');
  return errors;
};

// Ajoute ou modifie une pensée ; renvoie { state, note, errors } sans toucher l'état d'origine
const save = (state, input, now, newId) => {
  const st = sanitizeState(state);
  const prev = input && input.id ? st.notes.find(x => x.id === input.id) : null;
  const raw = Object.assign({}, prev || {}, input || {}, { id: prev ? prev.id : newId, createdAt: prev ? prev.createdAt : now, editedAt: prev ? now : '' });
  if (raw.text && String(raw.text).length > LIMITS.text) return { state: st, note: null, errors: ['Deux mille caractères au plus.'] };
  const note = sanitizeNote(raw);
  const errors = validate(note);
  if (errors.length) return { state: st, note: null, errors };
  if (!prev && st.notes.length >= LIMITS.notes) return { state: st, note: null, errors: ['Mille pensées au plus sur cet appareil.'] };
  st.notes = prev ? st.notes.map(x => x.id === note.id ? note : x) : [note].concat(st.notes);
  return { state: st, note, errors: [] };
};
const remove = (state, id) => { const st = sanitizeState(state); const removed = st.notes.find(x => x.id === id) || null; st.notes = st.notes.filter(x => x.id !== id); return { state: st, removed }; };
// Verdict d'une théorie, donné par son auteur
const setVerdict = (state, id, verdict, now) => {
  const st = sanitizeState(state);
  const n = st.notes.find(x => x.id === id);
  if (!n || n.kind !== 'theory' || !VERDICTS[verdict]) return { state: st, ok: false };
  n.verdict = verdict; n.editedAt = new Date(now || Date.now()).toISOString();
  return { state: st, ok: true };
};
// Images encore utiles (pour libérer les autres)
const imageRefs = state => sanitizeState(state).notes.map(n => n.imageRef).filter(Boolean);

// Tendances : mots-dièse des sept derniers jours, pondérés par la fraîcheur (demi-vie 48 h), puis les plus anciens
const trending = (tagLists, now, limit = 8) => {
  const t0 = Date.parse(now) || Date.now(), score = new Map(), label = new Map();
  for (const x of tagLists || []) {
    const age = Math.max(0, (t0 - (Date.parse(x.at) || 0)) / 36e5);
    const w = age > 24 * 7 ? 0.05 : Math.pow(0.5, age / 48);
    for (const tg of x.tags || []) { const k = strip(tg); score.set(k, (score.get(k) || 0) + w); if (!label.has(k)) label.set(k, tg); }
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([k, s]) => ({ tag: label.get(k), score: Math.round(s * 100) / 100 }));
};
// Suggestions pendant la saisie : le mot-dièse en cours (« #abs ») complété par les tendances et les séries de la collection
const suggest = (text, caret, pool, limit = 6) => {
  const before = String(text || '').slice(0, caret === undefined ? undefined : caret);
  const m = before.match(/#([\p{L}\p{N}_]{0,30})$/u);
  if (!m) return { prefix: null, items: [] };
  const p = strip(m[1]);
  const seen = new Set(), items = [];
  for (const tg of pool || []) { const k = strip(tg); if (!tg || seen.has(k) || (p && !k.startsWith(p)) || k === p) continue; seen.add(k); items.push(tg); if (items.length >= limit) break; }
  return { prefix: m[1], items };
};

module.exports = { VERSION, KINDS, KIND_TAGS, VERDICTS, LIMITS, emptyState, hashtags, sanitizeNote, sanitizeState, save, remove, setVerdict, imageRefs, trending, suggest };
