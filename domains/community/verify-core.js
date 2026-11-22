'use strict';
// Types de comptes et vérification (D-114) — module pur.
// À l'inscription, chacun choisit son type : Collectionneur (aucune vérification) ou un type pro (Créateur, Boutique,
// Maison d'édition, Studio). Un type pro reste « en attente » tant qu'une personne de l'équipe n'a pas examiné les pièces :
// aucune pastille n'apparaît avant. La vérification est gratuite, ne s'achète jamais et se renouvelle chaque année.
// Pièces : envoyées chiffrées à l'ouverture des comptes, lues par l'équipe en double authentification, effacées 30 jours
// après la décision ; seule la décision motivée reste au journal (minimisation, RGPD art. 5).

const TYPES = Object.freeze(['collector', 'creator', 'shop', 'publisher', 'studio']);
const TYPE_INFO = Object.freeze({
  collector: { label: 'Collectionneur', about: 'Votre collection, le fil, Le Comptoir, le Marché. Aucune vérification.', verified: false },
  creator: { label: 'Créateur', about: 'Scénariste, dessinateur, coloriste, encreur, lettreur, traducteur publié.', verified: true },
  shop: { label: 'Boutique', about: 'Librairie ou comic shop avec une adresse physique ou en ligne.', verified: true },
  publisher: { label: "Maison d'édition", about: 'Éditeur de comics, petit ou grand, avec un catalogue publié.', verified: true },
  studio: { label: 'Studio', about: 'Collectif ou studio de création avec des publications.', verified: true }
});
// Pastilles : une forme et une couleur par type, pour les reconnaître d'un coup d'œil (comme les certifications des grands réseaux)
const BADGES = Object.freeze({
  creator: { label: 'Créateur vérifié', color: '#FFC21A', ink: '#14110F', glyph: 'nib' },
  shop: { label: 'Boutique vérifiée', color: '#18A957', ink: '#FFFFFF', glyph: 'shop' },
  publisher: { label: 'Éditeur vérifié', color: '#1D6CF2', ink: '#FFFFFF', glyph: 'book' },
  studio: { label: 'Studio vérifié', color: '#8B3DFF', ink: '#FFFFFF', glyph: 'panels' },
  staff: { label: 'Équipe Panel', color: '#E5243B', ink: '#FFFFFF', glyph: 'shield' }
});
// Pièces demandées : clé, libellé, obligatoire, formats acceptés
const DOCS = Object.freeze({
  creator: [
    { key: 'identity', label: "Pièce d'identité (carte, passeport) : seuls le nom et la photo sont comparés", required: true, accept: ['pdf', 'jpg', 'png'] },
    { key: 'credits', label: 'Une preuve de publication à votre nom : page de crédits, couverture, contrat ou ISBN', required: true, accept: ['pdf', 'jpg', 'png'] },
    { key: 'proof_link', label: 'Le code Panel publié sur votre portfolio ou un réseau public à votre nom', required: true, accept: ['link'] },
    { key: 'publisher_ref', label: 'Contact de votre éditeur pour confirmation (facultatif, accélère l’examen)', required: false, accept: ['text'] }
  ],
  shop: [
    { key: 'company', label: "Numéro d'entreprise (BCE, SIREN ou équivalent) et raison sociale", required: true, accept: ['number'] },
    { key: 'address', label: 'Justificatif d’adresse de la boutique de moins de 3 mois', required: true, accept: ['pdf', 'jpg', 'png'] },
    { key: 'storefront', label: 'Photo de la vitrine ou du comptoir avec le code Panel bien visible', required: true, accept: ['jpg', 'png'] },
    { key: 'identity', label: "Pièce d'identité du gérant ou de la gérante", required: true, accept: ['pdf', 'jpg', 'png'] }
  ],
  publisher: [
    { key: 'company', label: "Numéro d'entreprise et extrait du registre (BCE, Kbis ou équivalent)", required: true, accept: ['number', 'pdf'] },
    { key: 'domain_email', label: 'Une adresse sur le domaine officiel de la maison (un code y est envoyé)', required: true, accept: ['email'] },
    { key: 'mandate', label: 'Lettre de mandat signée par un représentant légal, qui désigne les gestionnaires du compte', required: true, accept: ['pdf'] },
    { key: 'identity', label: "Pièce d'identité de la personne mandatée", required: true, accept: ['pdf', 'jpg', 'png'] },
    { key: 'catalogue', label: 'Un ISBN de votre catalogue (contrôlé automatiquement)', required: true, accept: ['isbn'] }
  ],
  studio: [
    { key: 'company', label: "Numéro d'entreprise ou statuts de l'association", required: true, accept: ['number', 'pdf'] },
    { key: 'members', label: 'Membres du studio et leurs rôles (chacun peut demander sa propre pastille Créateur)', required: true, accept: ['text'] },
    { key: 'credits', label: 'Une publication du studio', required: true, accept: ['pdf', 'jpg', 'png', 'isbn'] }
  ]
});
const STATES = Object.freeze(['none', 'draft', 'submitted', 'in_review', 'needs_more', 'verified', 'refused', 'expired', 'revoked']);
const STATE_LABEL = Object.freeze({ none: 'Compte collectionneur', draft: 'Dossier en préparation', submitted: 'Dossier envoyé', in_review: 'En cours d’examen', needs_more: 'Pièce à compléter', verified: 'Vérifié', refused: 'Refusé (motif indiqué, recours possible)', expired: 'À renouveler', revoked: 'Pastille retirée' });
const REFUSAL = Object.freeze({ unreadable: 'Pièce illisible', mismatch: 'Les noms ne correspondent pas', no_publication: 'Aucune publication vérifiable', not_comics: 'Activité sans lien avec la bande dessinée', impersonation: 'Usurpation d’identité', expired_doc: 'Pièce expirée' });
const REVIEW_DAYS = 7, RENEW_DAYS = 365, DOC_RETENTION_DAYS = 30;
const MAX_FILE_MB = 10;

// Numéro d'entreprise belge (BCE) : 10 chiffres, les deux derniers = 97 − (8 premiers mod 97)
const checkBCE = v => { const d = String(v || '').replace(/[^\d]/g, ''); if (!/^[01]\d{9}$/.test(d)) return false; return 97 - (Number(d.slice(0, 8)) % 97) === Number(d.slice(8)); };
// SIREN français : 9 chiffres, clé de Luhn
const luhn = s => { let sum = 0; for (let i = 0; i < s.length; i++) { let n = Number(s[s.length - 1 - i]); if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; } return sum % 10 === 0; };
const checkSIREN = v => { const d = String(v || '').replace(/\s/g, ''); return /^\d{9}$/.test(d) && luhn(d); };
// ISBN-13 : somme pondérée 1-3 modulo 10
const checkISBN13 = v => { const d = String(v || '').replace(/[-\s]/g, ''); if (!/^97[89]\d{10}$/.test(d)) return false; let s = 0; for (let i = 0; i < 13; i++) s += Number(d[i]) * (i % 2 ? 3 : 1); return s % 10 === 0; };
const companyCheck = (country, v) => country === 'BE' ? checkBCE(v) : country === 'FR' ? checkSIREN(v) : String(v || '').replace(/\W/g, '').length >= 6; // autres pays : contrôle humain
// L'adresse e-mail est-elle sur le domaine du site officiel ? (sous-domaines acceptés)
const domainMatches = (email, site) => {
  const m = /@([a-z0-9.-]+)$/i.exec(String(email || '').trim()); let host = '';
  try { host = new URL(String(site || '')).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) { return false; }
  if (!m || !host) return false;
  const d = m[1].toLowerCase();
  return d === host || d.endsWith('.' + host);
};
// Code à publier sur le portfolio, la vitrine, etc. (lettres sans ambiguïté)
const proofCode = rnd => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', b = (rnd || (n => globalThis.crypto.getRandomValues(new Uint8Array(n))))(8); let s = ''; for (let i = 0; i < 8; i++) s += A[b[i] % A.length]; return 'PANEL-' + s.slice(0, 4) + '-' + s.slice(4); };
// Contrôle d'un fichier choisi (rien n'est lu ici : type, taille, extension)
const fileOk = (doc, f) => {
  const ext = String(f && f.name || '').split('.').pop().toLowerCase().replace('jpeg', 'jpg');
  if (!doc || !f) return { ok: false, reason: 'Pièce inconnue.' };
  if (!doc.accept.includes(ext)) return { ok: false, reason: 'Format accepté : ' + doc.accept.filter(a => /^(pdf|jpg|png)$/.test(a)).join(', ') + '.' };
  if (!(f.size > 0) || f.size > MAX_FILE_MB * 1048576) return { ok: false, reason: 'Fichier vide ou de plus de ' + MAX_FILE_MB + ' Mo.' };
  return { ok: true };
};
// Avancement du dossier : pièces obligatoires fournies
const progress = (type, provided) => {
  const docs = DOCS[type] || [], have = new Set(provided || []), req = docs.filter(d => d.required);
  const missing = req.filter(d => !have.has(d.key)).map(d => d.key);
  return { total: req.length, done: req.length - missing.length, missing, ready: !!docs.length && !missing.length };
};
// Transitions : qui peut faire quoi
const FLOW = Object.freeze({ 'draft:submit': ['submitted', 'owner'], 'submitted:review': ['in_review', 'staff'], 'in_review:approve': ['verified', 'staff'], 'in_review:refuse': ['refused', 'staff'], 'in_review:ask': ['needs_more', 'staff'], 'needs_more:submit': ['submitted', 'owner'], 'refused:appeal': ['submitted', 'owner'], 'verified:expire': ['expired', 'system'], 'expired:submit': ['submitted', 'owner'], 'verified:revoke': ['revoked', 'staff'] });
const step = (state, action, actor) => { const f = FLOW[state + ':' + action]; if (!f) return { ok: false, error: 'invalid_transition' }; if (f[1] !== actor) return { ok: false, error: 'forbidden' }; return { ok: true, state: f[0] }; };
// Pastille affichée : seulement un compte pro vérifié et non expiré
const badge = (type, state, verifiedAtMs, nowMs) => {
  if (state !== 'verified' || !BADGES[type]) return null;
  if (Number.isFinite(verifiedAtMs) && Number.isFinite(nowMs) && nowMs - verifiedAtMs > RENEW_DAYS * 864e5) return null;
  return { type, ...BADGES[type] };
};

module.exports = { TYPES, TYPE_INFO, BADGES, DOCS, STATES, STATE_LABEL, REFUSAL, REVIEW_DAYS, RENEW_DAYS, DOC_RETENTION_DAYS, MAX_FILE_MB,
  checkBCE, checkSIREN, checkISBN13, companyCheck, domainMatches, proofCode, fileOk, progress, step, badge };
