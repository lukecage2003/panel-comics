'use strict';
// Fondations Communauté (docs/directeur/07 partie C) — politiques pures, sans réseau, sans stockage, sans accès aux domaines personnels.
// Préparé et testé localement ; rien n'est publié ni transmis. Aucune fonction ne lit Collection, Lecture ou Finances :
// une publication est une COPIE explicite, construite champ par champ à partir d'une liste blanche (C-D1).

const VISIBILITY = Object.freeze(['private', 'followers', 'public']);
const ROLES = Object.freeze(['member', 'moderator', 'admin']);
const REPORT_REASONS = Object.freeze(['spam', 'harassment', 'hate', 'personal_data', 'illegal', 'spoiler', 'other']);
// Champs publiables d'une fiche de collection : jamais le prix, la valeur, l'emplacement, les notes, la provenance d'achat ni l'appareil
const SHAREABLE_COPY_FIELDS = Object.freeze(['series', 'issue', 'volumeYear', 'publisher', 'variant', 'coverUrl', 'grade']);
const FORBIDDEN_FIELDS = Object.freeze(['purchase', 'price', 'value', 'fees', 'location', 'box', 'divider', 'room', 'notes', 'storeName', 'acquisitions', 'disposal', 'financeLog', 'deviceId', 'email', 'userId']);
const LIMITS = Object.freeze({ postsPerHour: 10, commentsPerHour: 30, reportsPerDay: 20, newAccountLinkDays: 7, maxText: 5000, maxListItems: 500 });

const URL_RE = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\./i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){3,5}\d{2,4}/;

// Publier = copier : seuls les champs de la liste blanche passent, sous forme de texte borné ; tout le reste est ignoré et signalé
function shareCopy(item, fields = SHAREABLE_COPY_FIELDS) {
  const allowed = fields.filter(f => SHAREABLE_COPY_FIELDS.includes(f));
  const out = {}, dropped = [];
  for (const k of Object.keys(item || {})) {
    if (allowed.includes(k) && (typeof item[k] === 'string' || typeof item[k] === 'number')) out[k] = String(item[k]).slice(0, 300);
    else dropped.push(k);
  }
  if (out.coverUrl && !/^https:\/\//.test(out.coverUrl)) { delete out.coverUrl; dropped.push('coverUrl'); }
  return { copy: Object.freeze(out), dropped: dropped.sort() };
}
// Détection de données personnelles dans un texte libre : l'auteur est prévenu avant publication (rien n'est envoyé)
function personalDataWarnings(text) {
  const w = [];
  if (EMAIL_RE.test(text)) w.push('adresse e-mail');
  if (PHONE_RE.test(text)) w.push('numéro de téléphone');
  if (/\b\d{1,4}[ ,]+(rue|avenue|boulevard|bd|chemin|impasse|allée|street|st\.|road)\b/i.test(text)) w.push('adresse postale');
  return w;
}

// Visibilité : l'auteur voit tout ; un bloqué ne voit rien dans un sens comme dans l'autre ; contenu retiré visible du seul auteur et des modérateurs
function canView(viewer, content, graph) {
  if (!content) return false;
  const v = viewer || null;
  if (v && v.id === content.authorId) return true;
  if (v && graph.isBlocked(content.authorId, v.id)) return false;
  if (content.removed) return !!v && (v.role === 'moderator' || v.role === 'admin');
  if (content.visibility === 'public') return true;
  if (content.visibility === 'followers') return !!v && graph.follows(v.id, content.authorId);
  return false;
}
const canEdit = (actor, content) => !!actor && !!content && actor.id === content.authorId && !content.removed;
const canModerate = (actor, content) => !!actor && (actor.role === 'moderator' || actor.role === 'admin') && (!content || actor.id !== content.authorId);

// Graphe social minimal en mémoire (tests) : suivre, bloquer (le blocage retire les abonnements dans les deux sens)
function createGraph() {
  const follows = new Set(), blocks = new Set();
  const k = (a, b) => a + '>' + b;
  return {
    follow(a, b) { if (a === b || blocks.has(k(a, b)) || blocks.has(k(b, a))) return false; follows.add(k(a, b)); return true; },
    unfollow(a, b) { follows.delete(k(a, b)); },
    block(a, b) { if (a === b) return false; blocks.add(k(a, b)); follows.delete(k(a, b)); follows.delete(k(b, a)); return true; },
    unblock(a, b) { blocks.delete(k(a, b)); },
    follows: (a, b) => follows.has(k(a, b)),
    isBlocked: (a, b) => blocks.has(k(a, b)) || blocks.has(k(b, a))
  };
}

// Limites anti-abus par fenêtre glissante ; horloge injectée (déterministe en test)
function createRateLimiter(now = () => Date.now()) {
  const hits = new Map();
  const windows = { post: [3600e3, LIMITS.postsPerHour], comment: [3600e3, LIMITS.commentsPerHour], report: [86400e3, LIMITS.reportsPerDay] };
  return {
    check(userId, action) {
      const w = windows[action];
      if (!w) return { ok: false, reason: 'action inconnue' };
      const key = userId + '|' + action, t = now();
      const list = (hits.get(key) || []).filter(x => t - x < w[0]);
      if (list.length >= w[1]) { hits.set(key, list); return { ok: false, reason: 'limite atteinte', retryInMs: w[0] - (t - list[0]) }; }
      list.push(t); hits.set(key, list);
      return { ok: true, remaining: w[1] - list.length };
    }
  };
}

// Validation d'une publication : texte borné, liens interdits aux comptes de moins de 7 jours, avertissements de données personnelles
function validatePost(author, post, now = Date.now()) {
  const errors = [], warnings = [];
  if (!author || !author.id) errors.push('auteur requis');
  if (!post || typeof post.text !== 'string' || !post.text.trim()) errors.push('texte requis');
  else {
    if (post.text.length > LIMITS.maxText) errors.push('texte trop long');
    const ageDays = author && author.createdAt ? (now - Date.parse(author.createdAt)) / 86400e3 : 0;
    if (URL_RE.test(post.text) && !(ageDays >= LIMITS.newAccountLinkDays)) errors.push('liens indisponibles pendant les ' + LIMITS.newAccountLinkDays + ' premiers jours du compte');
    warnings.push(...personalDataWarnings(post.text));
  }
  if (!VISIBILITY.includes(post && post.visibility)) errors.push('visibilité invalide');
  if (post && post.items && (!Array.isArray(post.items) || post.items.length > LIMITS.maxListItems)) errors.push('liste invalide');
  if (post && post.items) post.items.forEach((it, i) => { const extra = Object.keys(it || {}).filter(f => !SHAREABLE_COPY_FIELDS.includes(f)); if (extra.length) errors.push('élément ' + i + ' : champs non publiables ' + extra.join(', ')); });
  if (author && author.suspendedUntil && Date.parse(author.suspendedUntil) > now) errors.push('compte suspendu');
  return { ok: !errors.length, errors, warnings };
}

// Signalements et modération : file, décisions journalisées et motivées, appel possible, pas d'auto-modération
function createModeration(now = () => new Date().toISOString()) {
  const reports = [], log = [];
  let seq = 0;
  const report = (reporter, content, reason, note = '') => {
    if (!reporter || !content) return { ok: false, error: 'signalement incomplet' };
    if (!REPORT_REASONS.includes(reason)) return { ok: false, error: 'motif inconnu' };
    if (reporter.id === content.authorId) return { ok: false, error: 'on ne signale pas son propre contenu' };
    const dup = reports.find(r => r.contentId === content.id && r.reporterId === reporter.id && r.status === 'open');
    if (dup) return { ok: true, id: dup.id, duplicate: true };
    const r = { id: 'rep_' + (++seq), contentId: content.id, authorId: content.authorId, reporterId: reporter.id, reason, note: String(note).slice(0, 500), status: 'open', at: now() };
    reports.push(r);
    // Priorité : données personnelles et contenus illégaux d'abord
    return { ok: true, id: r.id, priority: reason === 'personal_data' || reason === 'illegal' ? 'high' : 'normal' };
  };
  const queue = () => reports.filter(r => r.status === 'open').sort((a, b) => (['personal_data', 'illegal'].includes(b.reason) - ['personal_data', 'illegal'].includes(a.reason)) || a.at.localeCompare(b.at));
  const decide = (moderator, reportId, decision, reason, content) => {
    const r = reports.find(x => x.id === reportId);
    if (!r) return { ok: false, error: 'signalement introuvable' };
    if (!canModerate(moderator, { authorId: r.authorId })) return { ok: false, error: 'droits insuffisants' };
    if (!['dismiss', 'remove', 'warn', 'suspend'].includes(decision)) return { ok: false, error: 'décision inconnue' };
    if (!reason || String(reason).trim().length < 5) return { ok: false, error: 'motif de décision requis' };
    r.status = 'closed';
    const entry = { reportId, contentId: r.contentId, authorId: r.authorId, decision, reason: String(reason), by: moderator.id, at: now(), appealable: decision !== 'dismiss' };
    log.push(entry);
    // Retrait = masquage réversible, jamais une suppression de la donnée de l'auteur
    if (decision === 'remove' && content && content.id === r.contentId) content.removed = true;
    return { ok: true, entry };
  };
  const appeal = (author, contentId, text) => {
    const e = log.find(x => x.contentId === contentId && x.authorId === (author && author.id) && x.appealable && !x.appealed);
    if (!e) return { ok: false, error: 'aucune décision contestable' };
    e.appealed = { text: String(text).slice(0, 1000), at: now(), status: 'open' };
    return { ok: true };
  };
  return { report, queue, decide, appeal, log: () => log.map(x => Object.assign({}, x)) };
}

// Contrats C-0 (D-46) : CommunityPublish.v1 (envoi explicite d'une copie, révocable) et CommunityFeed.v1 (élément de fil reçu).
// Purs et versionnés : aucun envoi ici. Un futur service distant n'acceptera que ces enveloppes ; tout champ hors contrat est refusé.
const PUBLISH_CONTRACT = 'CommunityPublish.v1', FEED_CONTRACT = 'CommunityFeed.v1', REVOKE_CONTRACT = 'CommunityRevoke.v1';
const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
function buildPublish(author, draft, consent, now = Date.now()) {
  const errors = [];
  if (!consent || consent.explicit !== true) errors.push('consentement explicite requis');
  if (!draft || !ID_RE.test(String(draft.id || ''))) errors.push('identifiant de brouillon invalide');
  const v = validatePost(author || { id: 'local', createdAt: null }, draft || {}, now);
  errors.push(...v.errors);
  if (errors.length) return { ok: false, errors, warnings: v.warnings };
  const items = (draft.items || []).map(it => shareCopy(it).copy);
  const at = new Date(now).toISOString();
  const env = { contract: PUBLISH_CONTRACT, clientId: draft.id, visibility: draft.visibility, text: String(draft.text || '').slice(0, LIMITS.maxText), items, createdAt: at, consent: { explicit: true, at }, revocable: true };
  return { ok: true, envelope: deepFreeze(env), warnings: v.warnings };
}
function validatePublish(env) {
  const errors = [], keys = ['contract', 'clientId', 'visibility', 'text', 'items', 'createdAt', 'consent', 'revocable'];
  if (!env || typeof env !== 'object') return { ok: false, errors: ['enveloppe absente'] };
  const extra = Object.keys(env).filter(k => !keys.includes(k));
  if (extra.length) errors.push('champs hors contrat : ' + extra.join(', '));
  if (env.contract !== PUBLISH_CONTRACT) errors.push('contrat inconnu');
  if (!ID_RE.test(String(env.clientId || ''))) errors.push('clientId invalide');
  if (!VISIBILITY.includes(env.visibility)) errors.push('visibilité inconnue');
  if (typeof env.text !== 'string' || env.text.length > LIMITS.maxText) errors.push('texte invalide');
  if (!Array.isArray(env.items) || env.items.length > LIMITS.maxListItems) errors.push('liste invalide');
  else env.items.forEach((it, i) => { const bad = Object.keys(it || {}).filter(k => !SHAREABLE_COPY_FIELDS.includes(k)); if (bad.length) errors.push('élément ' + i + ' : champs interdits ' + bad.join(', ')); });
  if (!ISO_RE.test(String(env.createdAt || ''))) errors.push('date invalide');
  if (!env.consent || env.consent.explicit !== true) errors.push('consentement explicite requis');
  if (env.revocable !== true) errors.push('une publication doit rester révocable');
  return { ok: !errors.length, errors };
}
function buildRevoke(env, now = Date.now()) {
  if (!env || env.contract !== PUBLISH_CONTRACT || !ID_RE.test(String(env.clientId || ''))) return { ok: false, errors: ['publication inconnue'] };
  return { ok: true, envelope: deepFreeze({ contract: REVOKE_CONTRACT, clientId: env.clientId, at: new Date(now).toISOString() }) };
}
// Élément de fil reçu d'un service : validé avant tout affichage ; jamais d'HTML, jamais de champ personnel
function validateFeedItem(x) {
  const errors = [], keys = ['contract', 'id', 'authorId', 'authorName', 'visibility', 'text', 'items', 'createdAt', 'removed'];
  if (!x || typeof x !== 'object') return { ok: false, errors: ['élément absent'] };
  const extra = Object.keys(x).filter(k => !keys.includes(k));
  if (extra.length) errors.push('champs hors contrat : ' + extra.join(', '));
  if (x.contract !== FEED_CONTRACT) errors.push('contrat inconnu');
  if (!ID_RE.test(String(x.id || '')) || !ID_RE.test(String(x.authorId || ''))) errors.push('identifiants invalides');
  if (typeof x.authorName !== 'string' || x.authorName.length > 80) errors.push('nom invalide');
  if (!VISIBILITY.includes(x.visibility)) errors.push('visibilité inconnue');
  if (typeof x.text !== 'string' || x.text.length > LIMITS.maxText || /<[a-z!/]/i.test(x.text)) errors.push('texte invalide');
  if (!Array.isArray(x.items) || x.items.some(it => Object.keys(it || {}).some(k => !SHAREABLE_COPY_FIELDS.includes(k)))) errors.push('liste invalide');
  if (!ISO_RE.test(String(x.createdAt || ''))) errors.push('date invalide');
  if (x.removed !== undefined && typeof x.removed !== 'boolean') errors.push('retrait invalide');
  return { ok: !errors.length, errors };
}
function deepFreeze(o) { Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); }

module.exports = { VISIBILITY, ROLES, REPORT_REASONS, SHAREABLE_COPY_FIELDS, FORBIDDEN_FIELDS, LIMITS, shareCopy, personalDataWarnings, canView, canEdit, canModerate, createGraph, createRateLimiter, validatePost, createModeration, PUBLISH_CONTRACT, FEED_CONTRACT, REVOKE_CONTRACT, buildPublish, validatePublish, buildRevoke, validateFeedItem };
