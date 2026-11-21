'use strict';
// Modération plus rapide (D-102) : module pur, sans réseau ni stockage.
// Il range la file renvoyée par api.mod_queue (migration 13), calcule le délai d'attente de chaque signalement,
// repère les mots interdits réglés par l'équipe et décrit les raccourcis clavier de la console.
// Règles fixes :
//   la sécurité des mineurs et l'automutilation passent avant tout, puis le harcèlement, la haine, la violence et le contenu sexuel ;
//   à gravité égale, le contenu le plus signalé, puis le plus ancien ;
//   le masquage automatique (troisième signalement, ou sécurité des mineurs dès le premier) est fait par la base, jamais ici ;
//   un mot interdit ne retire rien tout seul : il met le contenu en avant dans la file pour qu'une personne décide.

const REASONS = Object.freeze({
  minor_safety: { label: 'Sécurité d\'un mineur', severity: 4 },
  self_harm: { label: 'Automutilation ou détresse', severity: 4 },
  harassment: { label: 'Harcèlement', severity: 3 },
  hate: { label: 'Haine', severity: 3 },
  violence: { label: 'Violence', severity: 3 },
  sexual: { label: 'Contenu sexuel', severity: 3 },
  impersonation: { label: 'Usurpation d\'identité', severity: 2 },
  copyright: { label: 'Droit d\'auteur', severity: 1 },
  spam: { label: 'Spam', severity: 1 },
  other: { label: 'Autre', severity: 1 },
  spoiler: { label: 'Spoiler non signalé', severity: 0 }
});
// Délai de réponse visé, par gravité (en minutes)
const TARGET_MIN = Object.freeze({ 4: 60, 3: 240, 2: 720, 1: 1440, 0: 2880 });
const SEVERITY_LABEL = Object.freeze({ 4: 'Urgent', 3: 'Prioritaire', 2: 'Important', 1: 'Normal', 0: 'Faible' });
const AUTO_HIDE_AT = 3;
const LIMITS = Object.freeze({ terms: 300, termMin: 2, termMax: 40 });
// Raccourcis de la console (une touche, sans modificateur ; inactifs dans un champ de saisie)
const SHORTCUTS = Object.freeze([
  { key: 'j', action: 'next', label: 'Signalement suivant' },
  { key: 'k', action: 'prev', label: 'Signalement précédent' },
  { key: 'h', action: 'hide', label: 'Masquer le contenu' },
  { key: 'r', action: 'restore', label: 'Rétablir (signalement infondé)' },
  { key: 'x', action: 'remove', label: 'Retirer le contenu' },
  { key: 'w', action: 'warn', label: 'Avertir l\'auteur' },
  { key: 's', action: 'suspend', label: 'Suspendre l\'auteur 7 jours' },
  { key: 'd', action: 'dismiss', label: 'Classer sans suite' },
  { key: '?', action: 'help', label: 'Afficher les raccourcis' }
]);
// Action de console -> action de api.mod_act (cible : « post » pour un contenu, « member » pour son auteur)
const ACTIONS = Object.freeze({
  hide: { kind: 'post', action: 'hide' }, restore: { kind: 'post', action: 'restore' }, remove: { kind: 'post', action: 'remove' },
  dismiss: { kind: 'post', action: 'dismiss' }, warn: { kind: 'member', action: 'warn' }, suspend: { kind: 'member', action: 'suspend', days: 7 }
});
const DESTRUCTIVE = Object.freeze(['remove', 'suspend']);

const severityOf = reasons => (Array.isArray(reasons) ? reasons : [reasons]).reduce((m, r) => Math.max(m, REASONS[r] ? REASONS[r].severity : 1), 0);
const ms = v => { const t = Date.parse(v); return Number.isFinite(t) ? t : NaN; };

// Délai lisible : « 12 min », « 3 h », « 2 j »
const waitLabel = minutes => {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  if (m < 60) return m + ' min';
  if (m < 48 * 60) return Math.floor(m / 60) + ' h';
  return Math.floor(m / 1440) + ' j';
};

// Mots interdits : un par ligne (ou séparés par des virgules), sans doublon, 2 à 40 caractères
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[$5]/g, 's').replace(/7/g, 't');
const normalizeTerms = input => {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[\n,;]/);
  const out = [], seen = new Set();
  raw.forEach(t => {
    const v = String(t || '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.termMax);
    const k = fold(v);
    if (v.length < LIMITS.termMin || seen.has(k) || out.length >= LIMITS.terms) return;
    seen.add(k); out.push(v);
  });
  return out;
};
// Mots trouvés dans un texte (mot entier, sans tenir compte des accents, de la casse ni des chiffres déguisés)
const matchTerms = (text, terms) => {
  const t = ' ' + fold(text).replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
  return normalizeTerms(terms).filter(term => { const k = fold(term).replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); return k && t.includes(' ' + k + ' '); });
};

// File de modération : lignes de api.mod_queue { target_kind, target_id, reports, reasons, first_at, text? }
const rankQueue = (rows, opts = {}) => {
  const now = ms(opts.now || new Date().toISOString());
  const terms = opts.terms || [];
  return (Array.isArray(rows) ? rows : []).filter(r => r && r.target_id).map(r => {
    const reasons = (Array.isArray(r.reasons) ? r.reasons : [r.reasons]).filter(x => REASONS[x]);
    const severity = severityOf(reasons.length ? reasons : ['other']);
    const reports = Math.max(1, Number(r.reports) || 1);
    const first = ms(r.first_at), waitMin = Number.isFinite(first) && Number.isFinite(now) ? Math.max(0, Math.round((now - first) / 60000)) : 0;
    const termHits = r.text ? matchTerms(r.text, terms) : [];
    const late = waitMin > TARGET_MIN[severity];
    return {
      kind: r.target_kind === 'member' ? 'member' : 'post', id: String(r.target_id), reports, reasons,
      reasonLabels: reasons.map(x => REASONS[x].label), severity, severityLabel: SEVERITY_LABEL[severity],
      firstAt: r.first_at || '', waitMin, wait: waitLabel(waitMin), targetMin: TARGET_MIN[severity], late,
      autoHidden: reports >= AUTO_HIDE_AT || reasons.includes('minor_safety'), termHits, text: r.text ? String(r.text).slice(0, 500) : ''
    };
  }).sort((a, b) => (b.severity - a.severity) || ((b.termHits.length > 0) - (a.termHits.length > 0)) || (b.reports - a.reports) || (b.waitMin - a.waitMin) || a.id.localeCompare(b.id));
};

// Résumé de la file : combien en retard, attente la plus longue, délai médian des décisions récentes
const queueSummary = (ranked, log = []) => {
  const list = Array.isArray(ranked) ? ranked : [];
  const done = (Array.isArray(log) ? log : []).map(e => { const a = ms(e.reported_at || e.reportedAt), b = ms(e.at || e.created_at); return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 60000) : null; }).filter(v => v !== null).sort((a, b) => a - b);
  const median = done.length ? (done.length % 2 ? done[(done.length - 1) / 2] : Math.round((done[done.length / 2 - 1] + done[done.length / 2]) / 2)) : null;
  return {
    open: list.length, urgent: list.filter(x => x.severity >= 4).length, late: list.filter(x => x.late).length,
    oldest: list.length ? waitLabel(Math.max(...list.map(x => x.waitMin))) : '', medianResponse: median === null ? '' : waitLabel(median)
  };
};

// Touche -> action (null si la touche n'est pas un raccourci, si un modificateur est pressé ou si l'on écrit dans un champ)
const keyAction = (e = {}) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  const tag = String(e.targetTag || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.editable) return null;
  const k = String(e.key || '');
  const s = SHORTCUTS.find(x => x.key === (k.length === 1 ? k.toLowerCase() : k));
  return s ? s.action : null;
};

// Appel api.mod_act pour une action de console ; le motif est obligatoire (5 caractères au moins), comme côté base
const actCall = (item, action, reason) => {
  const a = ACTIONS[action];
  if (!a || !item) return { ok: false, error: 'invalid_action' };
  const why = String(reason || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (why.length < 5) return { ok: false, error: 'reason_required' };
  if (a.kind === 'member' && !item.authorId) return { ok: false, error: 'author_unknown' };
  const args = { p_target_kind: a.kind, p_target: a.kind === 'member' ? String(item.authorId) : item.id, p_action: a.action, p_reason: why };
  if (a.days) args.p_days = a.days;
  return { ok: true, fn: 'mod_act', args, confirm: DESTRUCTIVE.includes(action) };
};

// Motif proposé par défaut (modifiable) : le modérateur garde la main sur le texte
const defaultReason = (item, action) => {
  if (!item) return '';
  const why = item.reasonLabels && item.reasonLabels.length ? item.reasonLabels.join(', ').toLowerCase() : 'signalement';
  const base = { hide: 'Masqué en attendant l\'examen', restore: 'Rétabli : signalement infondé', remove: 'Retiré', dismiss: 'Classé sans suite', warn: 'Avertissement', suspend: 'Suspension de 7 jours' }[action] || '';
  return base ? base + ' (' + why + ')' + (item.termHits && item.termHits.length && action !== 'restore' && action !== 'dismiss' ? ' ; mot interdit : ' + item.termHits.join(', ') : '') : '';
};

module.exports = { REASONS, TARGET_MIN, SEVERITY_LABEL, AUTO_HIDE_AT, LIMITS, SHORTCUTS, ACTIONS, DESTRUCTIVE, severityOf, waitLabel, normalizeTerms, matchTerms, rankQueue, queueSummary, keyAction, actCall, defaultReason };
