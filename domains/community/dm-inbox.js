'use strict';
// Boîte de réception en ligne (D-125) — module pur : non-lus et pastilles, tri des fils, contenu des messages (texte ou vocal),
// onde des vocaux, retranscription, fils de pensées. Ni réseau, ni stockage, ni horloge cachée.
// Règles :
//  - l'icône Messages compte les PERSONNES ou GROUPES qui attendent une réponse (fils non lus, demandes et invitations reçues) ;
//    chaque fil affiche son nombre de MESSAGES non lus ; un groupe en sourdine garde son compteur mais ne compte pas sur l'icône ;
//  - un vocal voyage DANS le message chiffré : chemin du fichier chiffré, clé, empreinte, durée, onde et retranscription ;
//    tout est vérifié à l'ouverture, un contenu mal formé est montré comme texte, jamais interprété.

const BADGE_MAX = 99;
const badgeText = n => { const v = Math.max(0, Math.floor(Number(n) || 0)); return v === 0 ? '' : v > BADGE_MAX ? BADGE_MAX + '+' : String(v); };

// Fils unifiés (conversations et groupes) à partir de api.inbox()
const threads = inbox => {
  const i = inbox && typeof inbox === 'object' ? inbox : {};
  const dms = (Array.isArray(i.dms) ? i.dms : []).filter(d => d && d.id && d.status !== 'closed').map(d => ({
    kind: 'dm', id: String(d.id), title: '@' + String(d.with || ''), handle: String(d.with || ''), status: d.status, mine: !!d.mine, seal: d.seal || null,
    unread: Math.max(0, Number(d.unread) || 0), lastId: Number(d.last_id) || 0, lastAt: d.last_at || '', muted: false, timer: Number(d.timer) || 0,
    request: d.status === 'request' && !d.mine, declined: d.status === 'declined'
  }));
  const groups = (Array.isArray(i.groups) ? i.groups : []).filter(g => g && g.id).map(g => ({
    kind: 'group', id: String(g.id), title: String(g.name || 'Groupe'), status: g.status, role: g.role, members: Number(g.members) || 0, epoch: Number(g.epoch) || 1,
    unread: Math.max(0, Number(g.unread) || 0), lastId: Number(g.last_id) || 0, lastAt: g.last_at || '', muted: !!g.muted, invitedBy: g.invited_by || '',
    request: g.status === 'invited', declined: false
  }));
  return dms.concat(groups).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)) || b.lastId - a.lastId);
};
// Résumé pour les pastilles
const summary = list => {
  const l = Array.isArray(list) ? list : [];
  const unreadThreads = l.filter(t => !t.request && t.unread > 0);
  const requests = l.filter(t => t.request).length;
  const people = unreadThreads.filter(t => !t.muted).length;
  return { people, requests, messages: unreadThreads.reduce((s, t) => s + t.unread, 0), icon: people + requests, muted: unreadThreads.filter(t => t.muted).length };
};
// Onglets « Principal » / « Demandes » et recherche
const filterThreads = (list, tab, query) => {
  const q = String(query || '').trim().toLowerCase();
  return (Array.isArray(list) ? list : []).filter(t => (tab === 'requests' ? t.request : !t.request) && !t.declined && (!q || t.title.toLowerCase().includes(q)));
};
const rowBadge = t => t && !t.request && t.unread > 0 ? badgeText(t.unread) : '';
const rowHint = t => !t ? '' : t.request ? (t.kind === 'group' ? 'Invitation' + (t.invitedBy ? ' de @' + t.invitedBy : '') : 'Demande de message')
  : t.kind === 'group' ? t.members + ' membre' + (t.members > 1 ? 's' : '') + (t.muted ? ' · en sourdine' : '')
  : t.status === 'request' ? 'En attente de réponse' : t.unread ? t.unread + ' nouveau' + (t.unread > 1 ? 'x' : '') + ' message' + (t.unread > 1 ? 's' : '') : 'Chiffré de bout en bout';
// Nouveaux messages depuis le dernier passage (pour une alerte) : fils non muets dont le dernier message a avancé
const freshThreads = (before, after) => {
  const prev = new Map((before || []).map(t => [t.kind + ':' + t.id, t.lastId]));
  return (after || []).filter(t => !t.muted && t.unread > 0 && t.lastId > (prev.get(t.kind + ':' + t.id) || 0));
};

// ── Contenu d'un message ──────────────────────────────────────────────────────────────────────
const PREFIX = 'PANEL:1:';
const MAX_VOICE_SEC = 180;
const MAX_VOICE_BYTES = 4 * 1048576;
const MAX_TRANSCRIPT = 1500;
const BARS = 48;
const MIMES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
const PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{32}\.bin$/;
const B64 = /^[A-Za-z0-9+/]+=*$/;
const cleanText = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const voiceOk = v => !!v && PATH.test(String(v.path || '')) && v.ref && B64.test(String(v.ref.key || '')) && B64.test(String(v.ref.iv || '')) && /^[0-9a-f]{64}$/.test(String(v.ref.digest || ''))
  && Number.isInteger(v.ref.size) && v.ref.size > 0 && v.ref.size <= MAX_VOICE_BYTES && Number(v.dur) > 0 && Number(v.dur) <= MAX_VOICE_SEC + 1
  && MIMES.includes(v.mime) && Array.isArray(v.peaks) && v.peaks.length <= 64 && v.peaks.every(p => Number.isInteger(p) && p >= 0 && p <= 100);
// Texte simple : envoyé tel quel ; vocal : préfixe + JSON
const encodeContent = c => {
  if (!c || c.kind !== 'voice') return String(c && c.text !== undefined ? c.text : c || '');
  const v = { kind: 'voice', path: c.path, ref: c.ref, dur: Math.round(Number(c.dur) * 10) / 10, mime: c.mime, peaks: c.peaks || [], tr: cleanText(c.tr, MAX_TRANSCRIPT) };
  if (!voiceOk(v)) throw new Error('invalid_voice');
  return PREFIX + JSON.stringify(v);
};
const decodeContent = s => {
  const t = String(s || '');
  if (!t.startsWith(PREFIX)) return { kind: 'text', text: t };
  try {
    const v = JSON.parse(t.slice(PREFIX.length));
    if (v && v.kind === 'voice' && voiceOk(v)) return { kind: 'voice', path: v.path, ref: v.ref, dur: Number(v.dur), mime: v.mime, peaks: v.peaks, tr: cleanText(v.tr, MAX_TRANSCRIPT) };
  } catch (_) { /* contenu illisible : montré comme texte */ }
  return { kind: 'text', text: t };
};
const preview = s => { const c = decodeContent(s); return c.kind === 'voice' ? 'Message vocal · ' + formatDuration(c.dur) : c.text.slice(0, 80); };

// Chemin d'un vocal dans le compartiment privé : <fil>/<expéditeur>/<identifiant>.bin
const voicePath = (threadId, userId, fileHex) => { const p = String(threadId) + '/' + String(userId) + '/' + String(fileHex) + '.bin'; if (!PATH.test(p)) throw new Error('invalid_path'); return p; };
// Format d'enregistrement : le premier que le navigateur sait produire
const pickMime = isSupported => { for (const m of MIMES) { try { if (isSupported(m)) return m; } catch (_) { /* format suivant */ } } return ''; };
// Onde : BARS barres de 0 à 100, à partir des échantillons (crête par tranche, normalisée sur la plus forte)
const peaks = (samples, bars) => {
  const n = Math.max(1, Math.min(64, bars || BARS)), s = samples && samples.length ? samples : [];
  if (!s.length) return new Array(n).fill(0);
  const size = s.length / n, raw = [];
  for (let i = 0; i < n; i++) { let m = 0; const a = Math.floor(i * size), b = Math.max(a + 1, Math.floor((i + 1) * size)); for (let j = a; j < b && j < s.length; j++) { const v = Math.abs(s[j]); if (v > m) m = v; } raw.push(m); }
  const top = Math.max(...raw);
  return raw.map(v => top > 0 ? Math.round(v / top * 100) : 0);
};
const formatDuration = sec => { const v = Math.max(0, Math.round(Number(sec) || 0)); return Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0'); };
// Avancement de lecture -> nombre de barres colorées
const playedBars = (current, duration, bars) => { const d = Number(duration) || 0, n = bars || BARS; return d > 0 ? Math.max(0, Math.min(n, Math.round(Number(current) / d * n))) : 0; };

// ── Retranscription ───────────────────────────────────────────────────────────────────────────
// 'web' : API Web Speech du navigateur ; 'none' : rien (l'application Android n'a pas cette API dans sa WebView)
const speechSupport = g => !g ? 'none' : (typeof g.SpeechRecognition === 'function' || typeof g.webkitSpeechRecognition === 'function') ? 'web' : 'none';
// Résultats successifs (finaux seulement) -> texte propre, première lettre en capitale
const joinTranscript = parts => {
  const t = (Array.isArray(parts) ? parts : []).map(p => String(p || '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return t ? cleanText(t.charAt(0).toUpperCase() + t.slice(1), MAX_TRANSCRIPT) : '';
};

// ── Fil de pensées : un long texte découpé en parties numérotées (1/3, 2/3…) ─────────────────────
const splitThread = (text, max) => {
  const lim = Math.max(40, Math.floor(max || 2000)), body = String(text || '').trim();
  if (!body) return [];
  if (body.length <= lim) return [body];
  const room = lim - 8, parts = [];
  let rest = body;
  while (rest.length > room) {
    const win = rest.slice(0, room);
    let cut = Math.max(win.lastIndexOf('\n'), win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '));
    if (cut < room * 0.5) cut = win.lastIndexOf(' ');
    if (cut < room * 0.3) cut = room - 1;
    parts.push(rest.slice(0, cut + 1).trim()); rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts.map((p, i) => p + ' (' + (i + 1) + '/' + parts.length + ')');
};

const REASON = Object.freeze({
  not_member: 'Choisissez d’abord votre pseudo Panel.', adult_only: 'Les messages sont réservés aux adultes.', no_key: 'Cette personne n’a pas encore activé ses messages.',
  closed: 'Cette personne ne reçoit pas de messages.', verified_only: 'Cette personne ne reçoit des messages que des profils vérifiés.', blocked: 'Un blocage existe entre vous.',
  minor_protected: 'Les messages privés ne sont pas ouverts aux comptes mineurs.', request_pending: 'Demande envoyée : attendez sa réponse avant d’écrire encore.',
  rate_limited: 'Doucement : trop d’envois d’un coup. Réessayez dans un instant.', group_full: 'Un groupe compte 32 personnes au plus.', name_required: 'Donnez un nom au groupe.',
  forbidden: 'Action réservée au créateur ou aux administrateurs du groupe.', not_found: 'Introuvable ou plus accessible.', epoch_stale: 'Le groupe a changé : nouvelles clés en cours, réessayez.',
  invalid_handle: 'Pseudo invalide : 3 à 24 lettres, chiffres, points, tirets.', handle_taken: 'Ce pseudo est déjà pris.', too_young: 'Panel est ouvert dès 13 ans.',
  invalid_voice: 'Vocal illisible.', too_large: 'Vocal trop lourd (4 Mo au plus).', mic_denied: 'Micro refusé : autorisez-le dans les réglages du navigateur.',
  mic_unavailable: 'Enregistrement indisponible sur cet appareil.', network: 'Pas de connexion : rien n’a été envoyé.', unknown: 'Action impossible pour le moment. Réessayez plus tard.'
});
const reason = e => { const m = String((e && (e.message || e.code)) || e || ''); const k = Object.keys(REASON).find(x => m.includes(x)); return REASON[k || (/fetch|network|Failed/i.test(m) ? 'network' : 'unknown')]; };

module.exports = { BADGE_MAX, badgeText, threads, summary, filterThreads, rowBadge, rowHint, freshThreads, PREFIX, MAX_VOICE_SEC, MAX_VOICE_BYTES, MAX_TRANSCRIPT, BARS, MIMES,
  encodeContent, decodeContent, preview, voicePath, pickMime, peaks, formatDuration, playedBars, speechSupport, joinTranscript, splitThread, REASON, reason };
