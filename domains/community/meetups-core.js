'use strict';
// Rencontres par ville (D-98) : donner envie de se voir en vrai, sans jamais exposer personne.
// Module pur. Règles fixes, non réglables :
//   lieux publics seulement (boutique de comics, bibliothèque, café, salon ou festival, médiathèque, parc, ludothèque) ;
//   jamais d'adresse personnelle : le texte est refusé s'il ressemble à un domicile ;
//   18 ans et plus pour participer (les mineurs ne voient pas les rencontres) ;
//   de 2 à 30 personnes, entre 2 heures et 90 jours à l'avance, en journée ou en soirée (8 h – 22 h) ;
//   la ville est publique, le lieu exact n'est montré qu'aux inscrits (côté serveur, quand les comptes seront actifs).
// Tant que les comptes ne sont pas actifs, la rencontre est préparée sur cet appareil : aucune inscription n'est simulée.

const VERSION = 1;
const VENUES = Object.freeze({
  shop: 'Boutique de comics', library: 'Bibliothèque ou médiathèque', cafe: 'Café ou salon de thé', festival: 'Salon ou festival',
  park: 'Parc ou jardin public', games: 'Ludothèque ou bar à jeux', other: 'Autre lieu public'
});
const THEMES = Object.freeze({
  wednesday: 'Mercredi des sorties', swap: 'Troc de numéros', club: 'Club de lecture', signing: 'Dédicace annoncée', hunt: 'Chasse aux bacs', chat: 'Discussion libre'
});
const LIMITS = Object.freeze({ title: 80, city: 60, venue: 80, note: 300, minPeople: 2, maxPeople: 30, minLeadH: 2, maxLeadD: 90, firstHour: 8, lastHour: 22, saved: 20 });
const SAFETY = Object.freeze([
  'Rendez-vous dans un lieu public, à l\'heure dite, jamais chez quelqu\'un.',
  'Prévenez un proche de l\'endroit où vous allez.',
  'Venez et repartez par vos propres moyens.',
  'N\'apportez que les numéros que vous êtes prêt à montrer ; un troc se décide sur place, sans pression.',
  'Un comportement gênant ? Partez, puis signalez-le : l\'équipe Panel le traite en priorité.'
]);
// Ressemble à une adresse privée ou à un moyen de contact : refusé
const PRIVATE = /\b(chez (moi|nous|lui|elle)|mon (appart|appartement|domicile)|notre (appart|maison)|domicile|[ée]tage|interphone|digicode|code porte|b[aâ]timent [a-z0-9]\b|appt?\b|n[°o] ?\d+\s*(rue|avenue|bd|boulevard|all[ée]e|impasse|chemin)|\d+\s*(bis|ter)?\s*,?\s*(rue|avenue|av\.|bd|boulevard|all[ée]e|impasse|chemin|place)\b|\+?\d[\d .-]{7,}\d|@[a-z0-9.-]+\.[a-z]{2,}|whatsapp|telegram|snap(chat)?)\b/i;

const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const cityKey = c => str(c, LIMITS.city).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const sanitize = m => {
  if (!m || typeof m !== 'object') return null;
  const n = Math.round(Number(m.capacity));
  return {
    id: str(m.id, 40),
    title: str(m.title, LIMITS.title),
    city: str(m.city, LIMITS.city),
    venueType: VENUES[m.venueType] ? m.venueType : 'other',
    venue: str(m.venue, LIMITS.venue),
    theme: THEMES[m.theme] ? m.theme : 'chat',
    when: (() => { const t = Date.parse(m.when); return m.when && isFinite(t) ? new Date(t).toISOString() : ''; })(),
    capacity: isFinite(n) ? Math.max(LIMITS.minPeople, Math.min(LIMITS.maxPeople, n)) : 8,
    note: str(m.note, LIMITS.note),
    createdAt: (() => { const t = Date.parse(m.createdAt); return isFinite(t) ? new Date(t).toISOString() : ''; })()
  };
};

// Renvoie la liste des problèmes, en clair ; vide si la rencontre est publiable
const validate = (m, ctx) => {
  const e = [], now = Date.parse((ctx && ctx.now) || new Date().toISOString());
  if (!ctx || ctx.adult !== true) e.push('Les rencontres sont réservées aux 18 ans et plus.');
  if (!m) return e.concat(['Rencontre illisible.']);
  if (!m.title) e.push('Donnez un titre à la rencontre.');
  if (!m.city) e.push('Indiquez la ville.');
  if (!m.venue) e.push('Indiquez le lieu public (nom de la boutique, de la bibliothèque…).');
  if ([m.title, m.venue, m.note].some(x => PRIVATE.test(x || ''))) e.push('Pas d\'adresse personnelle ni de numéro de téléphone : choisissez un lieu public, les détails se donnent aux inscrits.');
  const t = Date.parse(m.when);
  if (!m.when || !isFinite(t)) e.push('Choisissez la date et l\'heure.');
  else {
    if (t < now + LIMITS.minLeadH * 3600000) e.push('Prévoyez la rencontre au moins deux heures à l\'avance.');
    if (t > now + LIMITS.maxLeadD * 86400000) e.push('Quatre-vingt-dix jours à l\'avance au plus.');
    const h = (ctx && typeof ctx.hourOf === 'function') ? ctx.hourOf(t) : new Date(t).getHours();
    if (h < LIMITS.firstHour || h >= LIMITS.lastHour) e.push('Entre 8 h et 22 h, pour que chacun rentre sereinement.');
  }
  return e;
};

const emptyState = () => ({ version: VERSION, meetups: [] });
const sanitizeState = s => {
  const out = emptyState();
  if (s && Array.isArray(s.meetups)) s.meetups.map(sanitize).filter(m => m && m.id).slice(0, LIMITS.saved).forEach(m => { if (!out.meetups.some(x => x.id === m.id)) out.meetups.push(m); });
  return out;
};
const save = (state, input, ctx, newId) => {
  const st = sanitizeState(state);
  const prev = input && input.id ? st.meetups.find(x => x.id === input.id) : null;
  const m = sanitize(Object.assign({}, prev || {}, input || {}, { id: prev ? prev.id : newId, createdAt: prev ? prev.createdAt : (ctx && ctx.now) }));
  const errors = validate(m, ctx);
  if (errors.length) return { state: st, meetup: null, errors };
  if (!prev && st.meetups.length >= LIMITS.saved) return { state: st, meetup: null, errors: ['Vingt rencontres préparées au plus.'] };
  st.meetups = prev ? st.meetups.map(x => x.id === m.id ? m : x) : [m].concat(st.meetups);
  return { state: st, meetup: m, errors: [] };
};
const remove = (state, id) => { const st = sanitizeState(state); st.meetups = st.meetups.filter(x => x.id !== id); return st; };

// À venir, de la ville choisie d'abord, puis par date
const upcoming = (state, city, now) => {
  const t0 = Date.parse(now || new Date().toISOString()), ck = cityKey(city);
  return sanitizeState(state).meetups.filter(m => Date.parse(m.when) > t0 - 3 * 3600000)
    .sort((a, b) => ((ck && cityKey(b.city) === ck) - (ck && cityKey(a.city) === ck)) || Date.parse(a.when) - Date.parse(b.when));
};

// Ce qu'un inconnu verra avant de s'inscrire : la ville et le type de lieu, jamais le nom exact ni la note
const publicView = m => {
  const s = sanitize(m);
  return s && { title: s.title, city: s.city, venueType: VENUES[s.venueType], theme: THEMES[s.theme], when: s.when, capacity: s.capacity };
};

// Invitation à envoyer à quelqu'un (texte), sans le lieu exact
const inviteText = m => {
  const s = sanitize(m); if (!s) return '';
  return s.title + ' · ' + THEMES[s.theme] + ' · ' + s.city + ' (' + VENUES[s.venueType].toLowerCase() + ') · ' + s.capacity + ' places. Le lieu exact est donné aux inscrits sur Panel.';
};

module.exports = { VERSION, VENUES, THEMES, LIMITS, SAFETY, cityKey, sanitize, validate, emptyState, sanitizeState, save, remove, upcoming, publicView, inviteText };
