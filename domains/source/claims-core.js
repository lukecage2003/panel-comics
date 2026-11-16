'use strict';
// PANEL SOURCE (module 01 de PANEL 2.0, D-81) : affirmations documentées, preuves localisées, historique, revue, conflits.
// Module pur, sans réseau ni stockage : il calcule, l'appelant enregistre. Il ne remplace pas le recoupement existant
// (events-crossref.js, media-core.crossCheck) : il le lit pour en tirer des affirmations, une par source.
// Règles (docs/panel-2/PANEL_2_MODULE_SPECIFICATIONS.md, module 01) :
// - statut épistémique distinct de la vérification : fait, interprétation ou hypothèse ;
// - aucune affirmation « fait » sans preuve : sans preuve, elle s'affiche « non vérifiée, aucune preuve » ;
// - rien ne s'efface : toute modification ajoute une révision ;
// - un auteur ne relit jamais sa propre affirmation ; « vérifiée » exige deux relectures indépendantes, dont un vérificateur ;
// - deux affirmations qui divergent sur un même sujet restent toutes deux visibles : le conflit est signalé, jamais tranché ici.
// Aucune image n'est jamais stockée : une preuve cite la source, la page, la case et au plus une courte citation.

const STATUS = Object.freeze({ fact: 'Fait', interpretation: 'Interprétation', hypothesis: 'Hypothèse' });
const VERIFICATION = Object.freeze({ unverified: 'Non vérifié', reviewed: 'Relu une fois', verified: 'Vérifié', disputed: 'Contesté' });
const ROLES = Object.freeze({ member: 'Membre', contributor: 'Contributeur', verifier: 'Vérificateur', moderator: 'Modérateur' });
const LIMITS = Object.freeze({ value: 400, quote: 200, reason: 300, note: 300, evidence: 12, revisions: 50, reviews: 20, claims: 500 });

const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const iso = v => { const t = Date.parse(v); return v && Number.isFinite(t) ? new Date(t).toISOString() : ''; };
const safeUrl = u => { const s = str(u, 500); return /^https?:\/\//i.test(s) ? s : ''; };
const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Preuve : une source désignée (identifiant connu ou libellé), éventuellement un lien, une page, une case, une courte citation
const sanitizeEvidence = e => {
  if (!e || typeof e !== 'object') return null;
  const out = {
    sourceId: str(e.sourceId, 60), label: str(e.label, 160), url: safeUrl(e.url),
    page: str(e.page, 12), panel: str(e.panel, 12), quote: str(e.quote, LIMITS.quote),
    retrievedAt: iso(e.retrievedAt), addedBy: str(e.addedBy, 60), addedAt: iso(e.addedAt)
  };
  return out.sourceId || out.label ? out : null;
};
const evidenceKey = e => [e.sourceId || norm(e.label), e.page, e.panel].join('|');
const evidenceText = e => [e.label || e.sourceId, e.page ? 'p. ' + e.page : '', e.panel ? 'case ' + e.panel : ''].filter(Boolean).join(', ');

const sanitizeReview = r => {
  if (!r || typeof r !== 'object') return null;
  const reviewer = str(r.reviewer, 60);
  if (!reviewer || (r.verdict !== 'confirm' && r.verdict !== 'reject')) return null;
  return { reviewer, role: ROLES[r.role] ? r.role : 'member', verdict: r.verdict, note: str(r.note, LIMITS.note), at: iso(r.at) };
};

const sanitizeClaim = c => {
  if (!c || typeof c !== 'object') return null;
  const id = str(c.id, 60), subjectKind = str(c.subject && c.subject.kind, 30), subjectId = str(c.subject && c.subject.id, 80), property = str(c.property, 160);
  if (!id || !subjectKind || !subjectId || !property) return null;
  const evidence = [];
  (Array.isArray(c.evidence) ? c.evidence : []).forEach(x => { const e = sanitizeEvidence(x); if (e && !evidence.some(y => evidenceKey(y) === evidenceKey(e)) && evidence.length < LIMITS.evidence) evidence.push(e); });
  const reviews = (Array.isArray(c.reviews) ? c.reviews : []).map(sanitizeReview).filter(Boolean).slice(0, LIMITS.reviews);
  const revisions = (Array.isArray(c.revisions) ? c.revisions : []).filter(r => r && typeof r === 'object').slice(-LIMITS.revisions).map(r => ({
    at: iso(r.at), author: str(r.author, 60), reason: str(r.reason, LIMITS.reason),
    before: r.before && typeof r.before === 'object' ? { value: str(r.before.value, LIMITS.value), status: STATUS[r.before.status] ? r.before.status : 'fact' } : null
  }));
  return {
    id, subject: { kind: subjectKind, id: subjectId, label: str(c.subject.label, 160) }, property, label: str(c.label, 200),
    value: str(c.value, LIMITS.value), status: STATUS[c.status] ? c.status : 'hypothesis',
    origin: c.origin === 'local' ? 'local' : 'panel', author: str(c.author, 60), createdAt: iso(c.createdAt),
    evidence, reviews, revisions, note: str(c.note, LIMITS.note)
  };
};

// Vérification calculée à partir des relectures, jamais déclarée : un auteur ne compte pas, un relecteur ne compte qu'une fois
const verificationOf = claim => {
  const c = sanitizeClaim(claim); if (!c) return 'unverified';
  const seen = new Set(), valid = c.reviews.filter(r => r.reviewer !== c.author && !seen.has(r.reviewer) && seen.add(r.reviewer));
  const ok = valid.filter(r => r.verdict === 'confirm'), ko = valid.filter(r => r.verdict === 'reject');
  if (ko.length) return 'disputed';
  if (!c.evidence.length) return 'unverified';
  if (ok.length >= 2 && ok.some(r => r.role === 'verifier' || r.role === 'moderator')) return 'verified';
  return ok.length ? 'reviewed' : 'unverified';
};

// Statut affiché : un « fait » sans preuve n'est jamais présenté comme un fait
const display = claim => {
  const c = sanitizeClaim(claim); if (!c) return null;
  const verification = verificationOf(c), noProof = !c.evidence.length;
  const status = c.status === 'fact' && noProof ? 'hypothesis' : c.status;
  const why = noProof ? 'Aucune preuve : affichée comme hypothèse, non vérifiée.'
    : verification === 'verified' ? 'Deux relectures indépendantes, dont un vérificateur.'
    : verification === 'disputed' ? 'Au moins une relecture la conteste : les deux positions restent visibles.'
    : verification === 'reviewed' ? 'Une relecture favorable ; une seconde, par un vérificateur, est nécessaire.'
    : c.origin === 'local' ? 'Proposition faite sur cet appareil : la relecture par d\'autres membres ouvrira avec les comptes.'
    : 'Relevé d\'une source, pas encore relu.';
  return { status, statusLabel: STATUS[status], verification, verificationLabel: VERIFICATION[verification], evidenceCount: c.evidence.length, why, downgraded: status !== c.status };
};

// Nouvelle affirmation (proposition locale ou relevé) ; erreurs explicites, l'état d'origine n'est jamais modifié
const validate = c => {
  const errors = [];
  if (!c) return ['Affirmation illisible.'];
  if (!c.value) errors.push('Indiquez ce que vous affirmez.');
  if (c.status === 'fact' && !c.evidence.length) errors.push('Un fait demande au moins une preuve (source, page ou citation courte). Sinon, choisissez « hypothèse » ou « interprétation ».');
  return errors;
};
const createClaim = (input, author, now, newId) => {
  const c = sanitizeClaim(Object.assign({}, input, { id: newId, author, createdAt: now, origin: input && input.origin === 'panel' ? 'panel' : 'local', reviews: [], revisions: [] }));
  const errors = validate(c);
  return errors.length ? { claim: null, errors } : { claim: c, errors: [] };
};

// Révision : la valeur ou le statut change, l'ancienne version est gardée dans l'historique (rien ne s'efface)
const revise = (claim, patch, author, now, reason) => {
  const c = sanitizeClaim(claim); if (!c) return { claim: null, errors: ['Affirmation introuvable.'] };
  if (!str(reason, LIMITS.reason)) return { claim: c, errors: ['Expliquez la raison de la modification.'] };
  const next = sanitizeClaim(Object.assign({}, c, {
    value: patch && patch.value != null ? patch.value : c.value,
    status: patch && STATUS[patch.status] ? patch.status : c.status,
    reviews: [], // une nouvelle version doit être relue de nouveau
    revisions: c.revisions.concat([{ at: now, author, reason, before: { value: c.value, status: c.status } }])
  }));
  const errors = validate(next);
  return errors.length ? { claim: c, errors } : { claim: next, errors: [] };
};

const addEvidence = (claim, ev, author, now) => {
  const c = sanitizeClaim(claim); if (!c) return { claim: null, errors: ['Affirmation introuvable.'] };
  const e = sanitizeEvidence(Object.assign({}, ev, { addedBy: author, addedAt: now }));
  if (!e) return { claim: c, errors: ['Désignez la source de la preuve.'] };
  if (c.evidence.some(y => evidenceKey(y) === evidenceKey(e))) return { claim: c, errors: ['Cette preuve est déjà citée.'] };
  if (c.evidence.length >= LIMITS.evidence) return { claim: c, errors: ['Douze preuves au plus par affirmation.'] };
  return { claim: sanitizeClaim(Object.assign({}, c, { evidence: c.evidence.concat([e]) })), errors: [] };
};

const review = (claim, input) => {
  const c = sanitizeClaim(claim); if (!c) return { claim: null, errors: ['Affirmation introuvable.'] };
  const r = sanitizeReview(input);
  if (!r) return { claim: c, errors: ['Relecture illisible.'] };
  if (r.reviewer === c.author) return { claim: c, errors: ['Vous ne pouvez pas relire votre propre affirmation.'] };
  if (c.reviews.some(x => x.reviewer === r.reviewer)) return { claim: c, errors: ['Vous avez déjà relu cette version.'] };
  return { claim: sanitizeClaim(Object.assign({}, c, { reviews: c.reviews.concat([r]) })), errors: [] };
};

// Conflits : même sujet, même propriété, valeurs différentes → toutes les valeurs restent visibles avec leurs affirmations
const conflicts = claims => {
  const groups = new Map();
  (Array.isArray(claims) ? claims : []).map(sanitizeClaim).filter(Boolean).forEach(c => {
    const k = c.subject.kind + '|' + c.subject.id + '|' + c.property;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  });
  const out = [];
  groups.forEach(list => {
    const byValue = new Map();
    list.forEach(c => { const v = norm(c.value); if (!byValue.has(v)) byValue.set(v, { value: c.value, claimIds: [] }); byValue.get(v).claimIds.push(c.id); });
    if (byValue.size > 1) out.push({ subject: list[0].subject, property: list[0].property, label: list[0].label, values: Array.from(byValue.values()) });
  });
  return out;
};

// Lecture du recoupement existant : une affirmation par lien et par source (aucune fusion entre sources)
const RELATION_FR = Object.freeze({ prelude: 'Prélude', tie_in: 'Tie-in', aftermath: 'Suite', related_series: 'Série liée', main: 'Série principale', order: 'Ordre de lecture' });
const fromEvent = (guide, retrievedAt) => {
  const g = guide || {}, ev = g.event || {}, out = [];
  if (!g.id) return out;
  const srcs = new Map((Array.isArray(g.sources) ? g.sources : []).map(s => [s.id, s]));
  const evidenceFor = sid => { const s = srcs.get(sid); return s ? [{ sourceId: s.id, label: s.label, url: s.url, retrievedAt: s.retrievedAt || retrievedAt }] : []; };
  const subject = { kind: 'event', id: g.id, label: g.title || '' };
  const base = (id, property, label, value, sid, status) => sanitizeClaim({ id, subject, property, label, value, status, origin: 'panel', author: 'Panel', createdAt: iso((srcs.get(sid) || {}).retrievedAt || retrievedAt), evidence: evidenceFor(sid) });
  if (ev.mainSeries && ev.mainSeries.series) {
    const ms = ev.mainSeries, nums = (ms.issues || []).map(i => i.issue).filter(Boolean);
    out.push(base('pc_' + g.id + '_main', 'main_series', 'Série principale', [ms.series, ms.volume].filter(Boolean).join(' ') + (nums.length ? ' #' + nums[0] + (nums.length > 1 ? '-' + nums[nums.length - 1] : '') : ''), ms.sourceId, 'fact'));
  }
  (ev.links || []).forEach((l, i) => {
    if (!l || !l.series || l.relation === 'order') return;
    const label = [l.series, l.volume].filter(Boolean).join(' ');
    out.push(base('pc_' + g.id + '_l' + i, 'link|' + norm(label), label, (RELATION_FR[l.relation] || l.relation) + (l.issues ? ' · #' + l.issues : ''), l.sourceId, 'fact'));
  });
  (ev.consequences || []).forEach((c, i) => { if (c && c.text) out.push(base('pc_' + g.id + '_c' + i, 'consequence|' + i, 'Conséquence', c.text, c.sourceId, 'fact')); });
  return out.filter(Boolean);
};

// État local des propositions : { claims: [...] } validé à la lecture
const emptyState = () => ({ claims: [] });
const sanitizeState = s => {
  const out = emptyState();
  (s && Array.isArray(s.claims) ? s.claims : []).forEach(x => { const c = sanitizeClaim(x); if (c && c.origin === 'local' && !out.claims.some(y => y.id === c.id)) out.claims.push(c); });
  out.claims = out.claims.slice(0, LIMITS.claims);
  return out;
};
const upsert = (state, claim) => {
  const st = sanitizeState(state), c = sanitizeClaim(claim);
  if (!c) return st;
  const i = st.claims.findIndex(x => x.id === c.id);
  if (i >= 0) st.claims[i] = c; else st.claims.unshift(c);
  st.claims = st.claims.slice(0, LIMITS.claims);
  return st;
};
const forSubject = (state, kind, id) => sanitizeState(state).claims.filter(c => c.subject.kind === kind && c.subject.id === id);

module.exports = { STATUS, VERIFICATION, ROLES, LIMITS, RELATION_FR, sanitizeEvidence, sanitizeClaim, evidenceText, verificationOf, display, validate, createClaim, revise, addEvidence, review, conflicts, fromEvent, emptyState, sanitizeState, upsert, forSubject };
