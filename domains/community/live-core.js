'use strict';
// Studio de direct (D-78) : préparer un débat (sujet, ordre du jour, tableau d'images, règles), le répéter seul sur l'appareil,
// garder la synthèse de chaque répétition. Le salon vocal à plusieurs (voix, mains levées, auditeurs) arrive avec les comptes
// en ligne et un serveur audio (docs/LIVE-DEBATS.md). Module pur : aucun participant, aucun message ni aucune réaction d'autrui
// n'est jamais simulé ; tout ce qui est compté vient de l'utilisateur lui-même.

const FORMATS = Object.freeze({ wednesday: 'Débat du mercredi', duel: 'Duel en direct', trial: 'Procès d\'un event', bestrun: 'Meilleur run', club: 'Club de lecture', free: 'Sujet libre' });
// Duel en direct (D-96) : deux camps, des manches chronométrées (ouverture, réplique, conclusion), des preuves en images, puis le vote.
const DUEL_ROUNDS = Object.freeze([
  { key: 'a1', side: 0, label: 'Ouverture', secs: 90 }, { key: 'b1', side: 1, label: 'Ouverture', secs: 90 },
  { key: 'a2', side: 0, label: 'Réplique', secs: 60 }, { key: 'b2', side: 1, label: 'Réplique', secs: 60 },
  { key: 'a3', side: 0, label: 'Conclusion', secs: 45 }, { key: 'b3', side: 1, label: 'Conclusion', secs: 45 },
  { key: 'vote', side: null, label: 'Vote', secs: 30 }
]);
const CHAT_MAX = 200, CHAT_LEN = 200;
const DEFAULT_RULES = Object.freeze([
  'On débat des œuvres, jamais des personnes.',
  'Spoilers annoncés avant d\'en parler.',
  'Une main levée, une prise de parole.',
  'Aucun enregistrement sans l\'accord de tous.'
]);
const REACTIONS = Object.freeze(['POW!', 'WOW!', 'BOOM!', 'ZAP!', 'HMM…']);
const LIMITS = Object.freeze({ title: 90, topic: 120, topics: 8, images: 24, pages: 16, caption: 80, rules: 6, rule: 140, rooms: 30, history: 30, side: 40 });

const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const isoOrEmpty = v => { const t = Date.parse(v); return v && Number.isFinite(t) ? new Date(t).toISOString() : ''; };
const uniq = list => list.filter((x, i) => list.indexOf(x) === i);

const emptyState = () => ({ rooms: [], history: [] });

// Une image du tableau est soit une couverture de la collection (kind « copy », référence à l'exemplaire), soit une page
// choisie dans la galerie de l'appareil (kind « page », D-79). Une page n'est qu'une référence : l'image elle-même reste
// sur l'appareil (IndexedDB « panel-live »), n'est jamais envoyée ni versée dans une planche publique.
const sanitizeImage = im => {
  if (!im || typeof im !== 'object') return null;
  const ref = str(im.ref, 80);
  if (!ref) return null;
  const side = im.side === 0 || im.side === 1 ? { side: im.side } : {};
  if (im.kind === 'page') return Object.assign({ ref, kind: 'page', caption: str(im.caption, LIMITS.caption), spoiler: im.spoiler === true }, side);
  return Object.assign({ ref, kind: 'copy', series: str(im.series, 120), issue: str(im.issue, 20) }, side);
};
const duelOf = r => {
  if (!r || r.format !== 'duel') return null;
  const s = Array.isArray(r.duel && r.duel.sides) ? r.duel.sides : [];
  return { sides: [str(s[0], LIMITS.side) || 'Pour', str(s[1], LIMITS.side) || 'Contre'] };
};
const isPage = im => !!im && im.kind === 'page';
const imageLabel = im => isPage(im) ? (im.caption || 'Page de la galerie') : [im.series, im.issue].filter(Boolean).join(' ');

const sanitizeRoom = r => {
  if (!r || typeof r !== 'object') return null;
  const topics = (Array.isArray(r.topics) ? r.topics : String(r.topics || '').split('\n')).map(t => str(t, LIMITS.topic)).filter(Boolean).slice(0, LIMITS.topics);
  const rules = (Array.isArray(r.rules) ? r.rules : String(r.rules || '').split('\n')).map(t => str(t, LIMITS.rule)).filter(Boolean).slice(0, LIMITS.rules);
  const images = [];
  (Array.isArray(r.images) ? r.images : []).forEach(x => {
    const im = sanitizeImage(x);
    if (!im || images.some(y => y.ref === im.ref) || images.length >= LIMITS.images) return;
    if (isPage(im) && images.filter(isPage).length >= LIMITS.pages) return;
    images.push(im);
  });
  return {
    id: str(r.id, 40),
    title: str(r.title, LIMITS.title),
    format: FORMATS[r.format] ? r.format : 'free',
    when: isoOrEmpty(r.when),
    topics, rules: rules.length ? rules : DEFAULT_RULES.slice(), images, duel: duelOf(Object.assign({}, r, { format: FORMATS[r.format] ? r.format : 'free' })),
    cohosts: sanitizeCohosts(r.cohosts),
    createdAt: isoOrEmpty(r.createdAt), updatedAt: isoOrEmpty(r.updatedAt)
  };
};

const sanitizeSummary = x => {
  if (!x || typeof x !== 'object') return null;
  const reactions = {};
  REACTIONS.forEach(k => { const n = Math.floor(Number(x.reactions && x.reactions[k])); if (n > 0) reactions[k] = Math.min(n, 9999); });
  return {
    id: str(x.id, 40), roomId: str(x.roomId, 40), title: str(x.title, LIMITS.title), format: FORMATS[x.format] ? x.format : 'free',
    startedAt: isoOrEmpty(x.startedAt), endedAt: isoOrEmpty(x.endedAt),
    durationSec: Math.max(0, Math.min(86400, Math.floor(Number(x.durationSec) || 0))),
    topics: (Array.isArray(x.topics) ? x.topics : []).map(t => ({ text: str(t && t.text, LIMITS.topic), secs: Math.max(0, Math.floor(Number(t && t.secs) || 0)) })).filter(t => t.text).slice(0, LIMITS.topics),
    shown: (Array.isArray(x.shown) ? x.shown : []).map(sanitizeImage).filter(Boolean).slice(0, LIMITS.images),
    reactions,
    duel: x.duel && Array.isArray(x.duel.sides) ? { sides: x.duel.sides.slice(0, 2).map(s => str(s, LIMITS.side)), vote: x.duel.vote === 0 || x.duel.vote === 1 ? x.duel.vote : null, rounds: Math.max(0, Math.min(DUEL_ROUNDS.length, Math.floor(Number(x.duel.rounds) || 0))) } : null,
    chat: Math.max(0, Math.min(CHAT_MAX, Math.floor(Number(x.chat) || 0)))
  };
};

const sanitizeState = s => {
  const out = emptyState();
  if (!s || typeof s !== 'object') return out;
  (Array.isArray(s.rooms) ? s.rooms : []).forEach(r => { const x = sanitizeRoom(r); if (x && x.id && x.title && !out.rooms.some(y => y.id === x.id)) out.rooms.push(x); });
  out.rooms = out.rooms.slice(0, LIMITS.rooms);
  (Array.isArray(s.history) ? s.history : []).forEach(h => { const x = sanitizeSummary(h); if (x && x.id) out.history.push(x); });
  out.history = out.history.slice(0, LIMITS.history);
  return out;
};

// Co-animation (D-98, migration 15) : jusqu'à trois personnes prévues, par pseudo ; rôle « co-animateur » ou « modérateur ».
// Les invitations partent quand les comptes sont actifs (api.live_invite) : ici, seule la préparation est gardée.
const COHOST_MAX = 3;
const COHOST_ROLES = Object.freeze({ cohost: 'Co-animateur', moderator: 'Modérateur du salon' });
const HANDLE = /^[A-Za-z0-9_.-]{3,24}$/;
// Accepte une liste [{ handle, role }] ou un texte « @pseudo » / « @pseudo modérateur », une personne par ligne
const sanitizeCohosts = v => {
  const lines = Array.isArray(v) ? v : String(v || '').split(/\n|,/).map(l => { const m = l.trim().match(/^@?(\S+)(?:\s+(.*))?$/); return m ? { handle: m[1], role: /mod/i.test(m[2] || '') ? 'moderator' : 'cohost' } : null; });
  const out = [];
  lines.forEach(x => {
    if (!x || typeof x !== 'object') return;
    const h = String(x.handle || '').replace(/^@/, '').trim();
    if (!HANDLE.test(h) || out.some(y => y.handle.toLowerCase() === h.toLowerCase()) || out.length >= COHOST_MAX) return;
    out.push({ handle: h, role: COHOST_ROLES[x.role] ? x.role : 'cohost' });
  });
  return out;
};
const cohostsText = list => sanitizeCohosts(list).map(c => '@' + c.handle + (c.role === 'moderator' ? ' modérateur' : '')).join('\n');

const validateRoom = r => {
  const errors = [];
  if (!r || !r.title) errors.push('Donnez un sujet au direct.');
  if (r && r.format !== 'duel' && !r.topics.length) errors.push('Ajoutez au moins un point à l\'ordre du jour.');
  return errors;
};

// Crée ou met à jour un direct préparé. Renvoie { state, room, errors } ; l'état d'origine n'est jamais modifié.
const saveRoom = (state, input, now, newId) => {
  const st = sanitizeState(state);
  const prev = input && input.id ? st.rooms.find(x => x.id === input.id) : null;
  const room = sanitizeRoom(Object.assign({}, prev || {}, input || {}, { id: prev ? prev.id : newId, createdAt: prev ? prev.createdAt : now, updatedAt: now }));
  const errors = validateRoom(room);
  if (errors.length) return { state: st, room: null, errors };
  if (!prev && st.rooms.length >= LIMITS.rooms) return { state: st, room: null, errors: ['Trente directs préparés au plus : supprimez-en un.'] };
  st.rooms = prev ? st.rooms.map(x => x.id === room.id ? room : x) : [room].concat(st.rooms);
  return { state: st, room, errors: [] };
};

const removeRoom = (state, id) => {
  const st = sanitizeState(state);
  const room = st.rooms.find(x => x.id === id) || null;
  st.rooms = st.rooms.filter(x => x.id !== id);
  return { state: st, removed: room };
};

// Directs programmés à venir d'abord (le plus proche en tête), puis les brouillons sans date, puis les dates passées
const ordered = (state, now) => {
  const t = Date.parse(now) || 0;
  const rank = r => { const w = Date.parse(r.when); return !r.when ? 1 : w >= t ? 0 : 2; };
  return sanitizeState(state).rooms.slice().sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? Date.parse(a.when) - Date.parse(b.when) : String(b.updatedAt).localeCompare(String(a.updatedAt))));
};

// ── Répétition : une session en mémoire, menée par l'utilisateur seul
const secsBetween = (a, b) => Math.max(0, Math.round(((Date.parse(b) || 0) - (Date.parse(a) || 0)) / 1000));
const startSession = (room, now) => ({ roomId: room.id, startedAt: now, topic: 0, topicStartedAt: now, done: [], shown: null, shownLog: [], reactions: {}, round: 0, roundStartedAt: now, vote: null, chat: [] });
// Manche suivante du duel (la dernière est le vote) ; au-delà, le duel est clos
const nextRound = (session, room, now) => {
  if (!session || !room.duel || session.round >= DUEL_ROUNDS.length) return session;
  return Object.assign({}, session, { round: session.round + 1, roundStartedAt: now });
};
const roundOf = session => session && session.round < DUEL_ROUNDS.length ? DUEL_ROUNDS[session.round] : null;
// Votre vote (un seul) : même camp = retiré ; tant que les comptes ne sont pas actifs, aucun autre vote n'existe
const castVote = (session, side) => {
  if (!session || (side !== 0 && side !== 1)) return session;
  return Object.assign({}, session, { vote: session.vote === side ? null : side });
};
// Chat du direct : vos messages seulement tant que les comptes ne sont pas actifs (aucun message d'autrui simulé)
const sendChat = (session, text, now) => {
  const t = str(text, CHAT_LEN);
  if (!session || !t) return session;
  return Object.assign({}, session, { chat: (session.chat || []).concat([{ at: now, text: t, by: 'me' }]).slice(-CHAT_MAX) });
};
// Preuves montrées par camp (images du tableau rattachées à un camp et montrées pendant le duel)
const evidenceCount = (session, room) => {
  const out = [0, 0];
  uniq((session && session.shownLog) || []).forEach(ref => { const im = room.images.find(x => x.ref === ref); if (im && (im.side === 0 || im.side === 1)) out[im.side]++; });
  return out;
};
const nextTopic = (session, room, now) => {
  if (!session || session.topic >= room.topics.length) return session;
  const done = session.done.concat([{ text: room.topics[session.topic], secs: secsBetween(session.topicStartedAt, now) }]);
  return Object.assign({}, session, { topic: session.topic + 1, topicStartedAt: now, done });
};
// Image suivante ou précédente du tableau (flèches du clavier, balayage) ; boucle en fin de liste
const stepImage = (session, room, dir) => {
  if (!session || !room.images.length) return session;
  const i = room.images.findIndex(x => x.ref === session.shown);
  const n = room.images.length, j = i < 0 ? (dir < 0 ? n - 1 : 0) : (i + (dir < 0 ? -1 : 1) + n) % n;
  return showImage(Object.assign({}, session, { shown: null }), room, room.images[j].ref);
};
// Références de pages encore utiles (directs préparés et synthèses) : les autres pages stockées peuvent être libérées
const pageRefs = state => {
  const st = sanitizeState(state), out = new Set();
  st.rooms.forEach(r => r.images.filter(isPage).forEach(im => out.add(im.ref)));
  st.history.forEach(h => h.shown.filter(isPage).forEach(im => out.add(im.ref)));
  return Array.from(out);
};
const showImage = (session, room, ref) => {
  const im = room.images.find(x => x.ref === ref);
  if (!session || !im) return session;
  const shown = session.shown === ref ? null : ref;
  return Object.assign({}, session, { shown, shownLog: shown && !session.shownLog.includes(ref) ? session.shownLog.concat([ref]) : session.shownLog });
};
const react = (session, kind) => {
  if (!session || !REACTIONS.includes(kind)) return session;
  const reactions = Object.assign({}, session.reactions, { [kind]: (session.reactions[kind] || 0) + 1 });
  return Object.assign({}, session, { reactions });
};
// Fin de la répétition : synthèse ajoutée en tête de l'historique (30 au plus)
const endSession = (state, session, room, now, newId) => {
  const st = sanitizeState(state);
  const last = session.topic < room.topics.length ? [{ text: room.topics[session.topic], secs: secsBetween(session.topicStartedAt, now) }] : [];
  const summary = sanitizeSummary({
    id: newId, roomId: room.id, title: room.title, format: room.format, startedAt: session.startedAt, endedAt: now,
    durationSec: secsBetween(session.startedAt, now), topics: session.done.concat(last),
    shown: uniq(session.shownLog).map(ref => room.images.find(x => x.ref === ref)).filter(Boolean), reactions: session.reactions,
    duel: room.duel ? { sides: room.duel.sides, vote: session.vote, rounds: Math.min(session.round || 0, DUEL_ROUNDS.length) } : null,
    chat: (session.chat || []).length
  });
  st.history = [summary].concat(st.history).slice(0, LIMITS.history);
  return { state: st, summary };
};

const fmtDuration = sec => {
  const s = Math.max(0, Math.floor(Number(sec) || 0)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? h + ' h ' + p(m) + ' min' : m ? m + ' min ' + p(r) + ' s' : r + ' s';
};
const clock = sec => { const s = Math.max(0, Math.floor(Number(sec) || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

// Texte de la planche de synthèse, à partir de la répétition seulement
// Les pages de la galerie restent privées : la planche ne cite que leur nombre, jamais leur image
const summaryText = x => {
  const pages = (x.shown || []).filter(isPage).length;
  return [
    (FORMATS[x.format] || FORMATS.free) + ' : ' + x.title,
    x.duel ? x.duel.sides.join(' contre ') + (x.duel.vote === 0 || x.duel.vote === 1 ? ' · mon vote : ' + x.duel.sides[x.duel.vote] : '') : '',
    x.topics.length ? 'Au programme : ' + x.topics.map(t => t.text).join(' · ') : '',
    'Durée : ' + fmtDuration(x.durationSec),
    pages ? pages + ' page' + (pages > 1 ? 's' : '') + ' commentée' + (pages > 1 ? 's' : '') : ''
  ].filter(Boolean).join('\n');
};

module.exports = { COHOST_MAX, COHOST_ROLES, sanitizeCohosts, cohostsText, FORMATS, DUEL_ROUNDS, CHAT_MAX, nextRound, roundOf, castVote, sendChat, evidenceCount, DEFAULT_RULES, REACTIONS, LIMITS, emptyState, sanitizeRoom, sanitizeState, validateRoom, saveRoom, removeRoom, ordered, startSession, nextTopic, showImage, stepImage, pageRefs, isPage, imageLabel, react, endSession, fmtDuration, clock, summaryText };
