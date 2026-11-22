'use strict';
// Profils pros et certification « Encré » (D-113) — module pur.
// Panel certifie des personnes et des structures réelles du monde des comics : créateurs (scénaristes, dessinateurs…),
// éditeurs, boutiques, studios. Le sceau « Encré » se gagne uniquement après une vérification humaine de l'équipe.
// Règles :
//  - aucun pro n'est présenté comme certifié sans décision de l'équipe (statut « verified ») ;
//  - aucune marque d'éditeur n'est affichée comme partenaire tant qu'elle n'a pas elle-même demandé et obtenu le sceau ;
//  - les pièces justificatives sont vues par l'équipe puis effacées : seules la décision, la date et la méthode restent ;
//  - un mineur ne peut pas ouvrir de profil pro ni publier d'annonce de collaboration.

const KINDS = ['creator', 'publisher', 'shop', 'studio'];
const KIND_LABEL = Object.freeze({ creator: 'Créateur', publisher: 'Éditeur', shop: 'Boutique', studio: 'Studio' });
const ROLES = ['writer', 'artist', 'inker', 'colorist', 'letterer', 'cover', 'editor', 'translator'];
const ROLE_LABEL = Object.freeze({ writer: 'Scénario', artist: 'Dessin', inker: 'Encrage', colorist: 'Couleur', letterer: 'Lettrage', cover: 'Couvertures', editor: 'Édition', translator: 'Traduction' });
const STATUSES = ['draft', 'pending', 'verified', 'refused', 'revoked'];

// Ce que l'équipe vérifie, par type de profil (pièces vues, jamais conservées)
const EVIDENCE = Object.freeze({
  creator: [
    ['credits', 'Au moins une publication où votre nom figure (titre, éditeur, année)'],
    ['portfolio', 'Un lien vers votre portfolio ou un réseau déjà public à votre nom'],
    ['contact', 'Un moyen de confirmer que vous êtes bien la personne (message depuis ce lien, ou contact de l\'éditeur)']
  ],
  publisher: [
    ['company', 'Numéro d\'entreprise (BCE, SIREN ou équivalent) et raison sociale'],
    ['domain', 'Une adresse e-mail sur le domaine officiel de la maison'],
    ['mandate', 'Le nom de la personne habilitée à représenter la maison sur Panel'],
    ['site', 'Le site officiel de la maison']
  ],
  shop: [
    ['company', 'Numéro d\'entreprise et adresse de la boutique'],
    ['site', 'Une page publique de la boutique (site, fiche, réseau)'],
    ['contact', 'Un contact joignable à l\'adresse de la boutique']
  ],
  studio: [
    ['company', 'Numéro d\'entreprise ou statut de l\'association'],
    ['members', 'Les membres du studio et leurs rôles'],
    ['credits', 'Au moins une publication du studio']
  ]
});

const str = (v, n) => String(v === undefined || v === null ? '' : v).trim().slice(0, n);
const URL_OK = /^https:\/\/[^\s/$.?#][^\s<>"]*$/i;

// Profil créateur ou structure (local, puis serveur à l'ouverture des comptes)
const validateProfile = (p, opts) => {
  const o = opts || {}, e = [];
  if (o.minor) e.push('Les profils pros sont réservés aux adultes.');
  const kind = KINDS.includes(p && p.kind) ? p.kind : '';
  if (!kind) e.push('Choisissez un type de profil.');
  const name = str(p && p.name, 80);
  if (name.length < 2) e.push('Indiquez votre nom public ou celui de la structure.');
  const roles = Array.isArray(p && p.roles) ? [...new Set(p.roles.filter(r => ROLES.includes(r)))] : [];
  if (kind === 'creator' && !roles.length) e.push('Choisissez au moins un métier.');
  const links = (Array.isArray(p && p.links) ? p.links : []).map(l => str(l, 300)).filter(Boolean);
  if (links.some(l => !URL_OK.test(l))) e.push('Les liens doivent commencer par https://.');
  const works = (Array.isArray(p && p.works) ? p.works : []).slice(0, 60).map(w => ({ title: str(w && w.title, 120), publisher: str(w && w.publisher, 80), year: Number(w && w.year) || null, role: ROLES.includes(w && w.role) ? w.role : '' })).filter(w => w.title);
  if (works.some(w => w.year && (w.year < 1900 || w.year > new Date().getFullYear() + 2))) e.push('Année de publication invalide.');
  return { ok: !e.length, errors: e, profile: e.length ? null : { kind, name, roles, bio: str(p.bio, 600), links: links.slice(0, 6), works, open: !!p.open, city: str(p.city, 60), country: str(p.country, 2).toUpperCase() } };
};

// Demande de sceau : la liste de contrôle est cochée par la personne ; l'équipe vérifie
const applicationCheck = (kind, ticked) => {
  const list = EVIDENCE[kind] || [];
  const t = new Set(Array.isArray(ticked) ? ticked : []);
  const missing = list.filter(([k]) => !t.has(k)).map(([, l]) => l);
  return { ready: list.length > 0 && !missing.length, missing, total: list.length, done: list.length - missing.length };
};

// Sceau « Encré » : seul un statut vérifié l'affiche ; sinon rien (jamais un faux sceau « en attente » qui ressemble au vrai)
const seal = (kind, status) => status === 'verified' && KINDS.includes(kind)
  ? { show: true, kind, label: 'Encré · ' + KIND_LABEL[kind], title: KIND_LABEL[kind] + ' vérifié par l\'équipe de Panel' }
  : { show: false, kind, label: '', title: '' };
const statusLabel = s => ({ draft: 'Brouillon', pending: 'Demande en cours d\'examen', verified: 'Encré', refused: 'Demande refusée', revoked: 'Sceau retiré' })[s] || 'Brouillon';

// Annonce de collaboration (« L'Atelier ») : deux pros du milieu se trouvent
const COLLAB_KINDS = ['seek', 'offer'];
const COLLAB_TERMS = ['paid', 'share', 'volunteer', 'tbd'];
const TERMS_LABEL = Object.freeze({ paid: 'Rémunéré', share: 'Partage des revenus', volunteer: 'Bénévole', tbd: 'À discuter' });
const validateCollab = (c, opts) => {
  const o = opts || {}, e = [];
  if (o.minor) e.push('Les annonces de collaboration sont réservées aux adultes.');
  const kind = COLLAB_KINDS.includes(c && c.kind) ? c.kind : '';
  if (!kind) e.push('Cherchez-vous ou proposez-vous ?');
  const role = ROLES.includes(c && c.role) ? c.role : '';
  if (!role) e.push('Choisissez le métier concerné.');
  const title = str(c && c.title, 100);
  if (title.length < 8) e.push('Donnez un titre d\'au moins 8 caractères.');
  const body = str(c && c.body, 1500);
  if (body.length < 30) e.push('Décrivez le projet en quelques phrases (30 caractères au moins).');
  if (/\b(?:\+?\d[\d .-]{7,}\d)\b|[\w.+-]+@[\w-]+\.[\w.]+/.test(body)) e.push('Pas de téléphone ni d\'e-mail dans l\'annonce : passez par les messages de Panel.');
  const terms = COLLAB_TERMS.includes(c && c.terms) ? c.terms : 'tbd';
  return { ok: !e.length, errors: e, collab: e.length ? null : { kind, role, title, body, terms, remote: c.remote !== false, city: str(c.city, 60) } };
};
// Correspondance simple entre une annonce et un profil (métier, ouverture aux projets, distance)
const collabMatch = (collab, profile) => {
  if (!collab || !profile || !profile.open) return 0;
  let s = 0;
  if ((profile.roles || []).includes(collab.role)) s += 3;
  if (collab.remote) s += 1; else if (collab.city && profile.city && collab.city.toLowerCase() === profile.city.toLowerCase()) s += 2;
  if ((profile.works || []).length) s += 1;
  return s;
};

module.exports = { KINDS, KIND_LABEL, ROLES, ROLE_LABEL, STATUSES, EVIDENCE, COLLAB_KINDS, COLLAB_TERMS, TERMS_LABEL,
  validateProfile, applicationCheck, seal, statusLabel, validateCollab, collabMatch };
