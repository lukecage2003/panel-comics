'use strict';
// Panel Guardian, côté application (D-112) — module pur : prépare les appels aux fonctions api.guardian_* de la migration 18
// et traduit leurs réponses en français. Ni réseau, ni stockage : l'appelant possède le client Supabase.
// La décision reste celle du serveur (déclencheurs) ; ce module ne fait qu'afficher et préparer.
// Règles :
//  - le code parental n'est jamais conservé par l'application (affiché une fois, puis oublié) ;
//  - aucune date de naissance ne part : le serveur ne reçoit qu'une année au moment de l'adhésion (déjà en place) ;
//  - l'âge déclaré n'est jamais présenté comme vérifié.

const STATUSES = ['unverified', 'verified_13_15', 'verified_16_17', 'verified_adult', 'under_13_blocked', 'review_required'];
const BANDS = ['13-14', '15-17', '18+'];
const ACTIONS = ['post', 'follow', 'live_join', 'live_host', 'live_chat'];
const RESTRICTIONS = ['no_post', 'no_live', 'no_follow', 'read_only'];

const STATUS_LABEL = Object.freeze({
  unverified: 'Âge déclaré, non vérifié',
  verified_13_15: 'Âge vérifié : 13 à 15 ans',
  verified_16_17: 'Âge vérifié : 16 ou 17 ans',
  verified_adult: 'Âge vérifié : adulte',
  under_13_blocked: 'Compte refusé : moins de 13 ans',
  review_required: 'Tranche d\'âge en cours d\'examen'
});
const BAND_LABEL = Object.freeze({ '13-14': '13-14 ans', '15-17': '15-17 ans', '18+': 'Adulte' });
const RESTRICTION_LABEL = Object.freeze({ no_post: 'Publication suspendue', no_live: 'Directs suspendus', no_follow: 'Abonnements suspendus', read_only: 'Lecture seule' });

const MESSAGES = Object.freeze({
  under_13: 'Panel n\'ouvre pas de compte en ligne avant 13 ans.',
  too_young: 'Panel n\'ouvre pas de compte en ligne avant 13 ans.',
  quiet_hours: 'Heures calmes : un parent a mis Panel en pause à cette heure-ci.',
  minor_live_host: 'Animer un direct n\'est pas ouvert à ce compte.',
  guardian_live_off: 'Les directs sont coupés par un parent relié.',
  guardian_follows_off: 'Les nouveaux abonnements sont coupés par un parent relié.',
  age_review_pending: 'Les directs reprendront après l\'examen de votre tranche d\'âge.',
  restricted: 'Cette action est suspendue sur votre compte pour le moment.',
  adult_account: 'Un compte adulte n\'a pas besoin de parent relié.',
  adult_required: 'Seul un compte adulte peut devenir parent relié.',
  mfa_required: 'Activez la double authentification pour continuer.',
  max_guardians: 'Deux parents au plus peuvent être reliés.',
  invalid_code: 'Code invalide ou expiré. Demandez un nouveau code.',
  invalid_band: 'Choisissez une autre tranche d\'âge que l\'actuelle.',
  reason_required: 'Expliquez votre demande en une phrase au moins.',
  invalid_hours: 'Heures calmes invalides.',
  own_review: 'Vous ne pouvez pas examiner votre propre demande.',
  own_account: 'Action impossible sur votre propre compte.',
  rate_limited: 'Trop d\'essais d\'un coup. Réessayez dans un moment.',
  not_member: 'Rejoignez d\'abord la communauté.',
  not_found: 'Introuvable ou déjà traité.',
  forbidden: 'Action réservée.',
  network: 'Pas de connexion. Réessayez plus tard.',
  unknown: 'Action impossible pour le moment. Réessayez plus tard.'
});

const hour = v => (v === null || v === undefined || v === '') ? null : (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 23 ? Number(v) : NaN);

// Code parental saisi : 10 caractères hexadécimaux, espaces et tirets tolérés
const normalizeCode = raw => { const c = String(raw || '').replace(/[\s-]/g, '').toUpperCase(); return /^[0-9A-F]{10}$/.test(c) ? c : ''; };
const formatCode = code => { const c = normalizeCode(code); return c ? c.slice(0, 5) + '-' + c.slice(5) : ''; };

const linkCreateCall = () => ({ fn: 'guardian_link_create', args: {} });
const linkAcceptCall = raw => { const c = normalizeCode(raw); return c ? { fn: 'guardian_link_accept', args: { p_code: c } } : { skip: 'invalid_code' }; };
const linkRevokeCall = (linkId, reason) => linkId ? { fn: 'guardian_link_revoke', args: { p_link: String(linkId), p_reason: String(reason || '').slice(0, 200) } } : { skip: 'invalid' };
const settingsCall = (childId, s) => {
  const o = s || {}, qs = hour(o.quietStart), qe = hour(o.quietEnd);
  if (!childId || Number.isNaN(qs) || Number.isNaN(qe) || (qs === null) !== (qe === null)) return { skip: 'invalid_hours' };
  return { fn: 'guardian_settings_set', args: { p_child: String(childId), p_quiet_start: qs, p_quiet_end: qe,
    p_live_join: o.liveJoin !== false, p_live_host: o.liveHost !== false, p_follows_open: o.followsOpen !== false } };
};
const reviewCall = (band, reason) => {
  if (!BANDS.includes(band)) return { skip: 'invalid_band' };
  const r = String(reason || '').trim();
  return r.length < 10 ? { skip: 'reason_required' } : { fn: 'age_review_request', args: { p_band: band, p_reason: r.slice(0, 500) } };
};
const canCall = action => ACTIONS.includes(action) ? { fn: 'guardian_can', args: { p_action: action } } : { skip: 'invalid' };

// Réponse de api.guardian_status -> vue affichable
const statusView = st => {
  if (!st || typeof st !== 'object' || !BANDS.includes(st.band)) return null;
  const status = STATUSES.includes(st.status) ? st.status : 'unverified';
  const minor = st.band !== '18+';
  const s = st.settings && typeof st.settings === 'object' ? st.settings : null;
  return {
    band: st.band, bandLabel: BAND_LABEL[st.band], status, statusLabel: STATUS_LABEL[status], verified: /^verified_/.test(status),
    minor, guardians: Math.max(0, Number(st.guardians) || 0), children: Math.max(0, Number(st.children) || 0), reviewOpen: !!st.review_open,
    canInviteParent: minor && (Number(st.guardians) || 0) < 2,
    quiet: s && s.quiet_start !== null && s.quiet_start !== undefined ? quietLabel(s.quiet_start, s.quiet_end) : '',
    liveHost: minor ? (st.band === '15-17' && (!s || s.live_host !== false)) : true,
    liveJoin: !s || s.live_join !== false, followsOpen: !s || s.follows_open !== false
  };
};
const quietLabel = (a, b) => { const qs = hour(a), qe = hour(b); return qs === null || qe === null || Number.isNaN(qs) || Number.isNaN(qe) || qs === qe ? '' : 'De ' + qs + ' h à ' + qe + ' h'; };
// Réponse de api.guardian_can -> { allowed, text }
const decision = r => (r && r.allowed === true) ? { allowed: true, text: '' } : { allowed: false, text: MESSAGES[(r && r.reason) || ''] || MESSAGES.unknown };
// Erreur du serveur (« guardian_quiet_hours », « invalid_code »…) -> message français
const errorText = err => {
  if (!err) return '';
  const m = String(err.message || err.code || err || '');
  if (/fetch|network|Failed to|ECONN/i.test(m)) return MESSAGES.network;
  const g = /guardian_([a-z_]+)/.exec(m);
  if (g && MESSAGES[g[1]]) return MESSAGES[g[1]];
  const k = Object.keys(MESSAGES).find(x => new RegExp('\\b' + x + '\\b').test(m));
  return MESSAGES[k || 'unknown'];
};

module.exports = { STATUSES, BANDS, ACTIONS, RESTRICTIONS, STATUS_LABEL, BAND_LABEL, RESTRICTION_LABEL, MESSAGES, normalizeCode, formatCode,
  linkCreateCall, linkAcceptCall, linkRevokeCall, settingsCall, reviewCall, canCall, statusView, quietLabel, decision, errorText };
