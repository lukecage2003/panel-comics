'use strict';
// Marché entre membres (D-113) — module pur : annonces, frais, remise (point relais, colis, main propre), étapes d'une vente.
// Règles :
//  - Panel ne détient jamais l'argent : le paiement passera par un prestataire de paiement agréé (séquestre), choisi plus tard ;
//  - le taux des frais de Panel n'est pas fixé : `rate` est un paramètre ; SIM_RATE ne sert qu'à la simulation affichée ;
//  - aucun prix d'expédition n'est inventé : il viendra du transporteur choisi au moment de l'achat ;
//  - une annonce ne reprend jamais les données privées de la fiche (prix payé, cote, emplacement, notes) : le vendeur fixe son prix ;
//  - réservé aux adultes ; jamais de paiement hors de Panel ; remise en main propre dans un lieu public, confirmée par un code.

const SIM_RATE = 0.07; // simulation seulement, taux réel à décider (docs/master/BUSINESS_MODEL.md)
const CONDITIONS = ['nm', 'vf', 'fn', 'vg', 'g', 'fair'];
const CONDITION_LABEL = Object.freeze({ nm: 'Quasi neuf (NM)', vf: 'Très bon (VF)', fn: 'Bon (FN)', vg: 'Correct (VG)', g: 'Usé (G)', fair: 'Abîmé' });
const DELIVERY = ['relay', 'parcel', 'hand'];
const DELIVERY_LABEL = Object.freeze({ relay: 'Point relais', parcel: 'Colis suivi à domicile', hand: 'Remise en main propre' });
const STATES = ['draft', 'listed', 'reserved', 'paid', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'];
// Transitions permises : [état, action] -> nouvel état, et qui peut agir
const FLOW = Object.freeze({
  'draft:publish': ['listed', 'seller'], 'listed:unpublish': ['draft', 'seller'], 'listed:reserve': ['reserved', 'buyer'],
  'reserved:release': ['listed', 'any'], 'reserved:pay': ['paid', 'buyer'], 'paid:ship': ['shipped', 'seller'],
  'paid:handover': ['completed', 'buyer'], 'shipped:deliver': ['delivered', 'carrier'], 'delivered:confirm': ['completed', 'buyer'],
  'delivered:autoconfirm': ['completed', 'system'], 'paid:cancel': ['cancelled', 'seller'], 'shipped:dispute': ['disputed', 'buyer'],
  'delivered:dispute': ['disputed', 'buyer'], 'disputed:resolve_buyer': ['cancelled', 'staff'], 'disputed:resolve_seller': ['completed', 'staff']
});
const AUTO_CONFIRM_DAYS = 3;

const cents = v => { const n = Math.round(Number(String(v).replace(',', '.')) * 100); return Number.isFinite(n) ? n : NaN; };
const str = (v, n) => String(v === undefined || v === null ? '' : v).trim().slice(0, n);

const validateListing = (l, opts) => {
  const o = opts || {}, e = [];
  if (o.minor) e.push('Le marché est réservé aux adultes.');
  const title = str(l && l.title, 120);
  if (title.length < 3) e.push('Indiquez le titre du comics.');
  const price = cents(l && l.price);
  if (!(price >= 100)) e.push('Prix minimum : 1,00.');
  if (price > 5000000) e.push('Prix trop élevé pour une vente entre membres.');
  const condition = CONDITIONS.includes(l && l.condition) ? l.condition : '';
  if (!condition) e.push('Choisissez l\'état.');
  const delivery = (Array.isArray(l && l.delivery) ? l.delivery : []).filter(d => DELIVERY.includes(d));
  if (!delivery.length) e.push('Choisissez au moins un mode de remise.');
  if (delivery.includes('hand') && !str(l.city, 60)) e.push('Indiquez la ville pour une remise en main propre.');
  const photos = (Array.isArray(l && l.photos) ? l.photos : []).filter(p => typeof p === 'string' && p).slice(0, 6);
  if (!photos.length) e.push('Ajoutez au moins une photo de votre exemplaire.');
  const body = str(l && l.body, 1000);
  if (/\b(?:\+?\d[\d .-]{7,}\d)\b|[\w.+-]+@[\w-]+\.[\w.]+|virement|paypal|western union|iban/i.test(body)) e.push('Pas de coordonnées ni de paiement hors de Panel dans l\'annonce.');
  return { ok: !e.length, errors: e, listing: e.length ? null : {
    title, issue: str(l.issue, 20), publisher: str(l.publisher, 80), price, currency: /^[A-Z]{3}$/.test(l.currency || '') ? l.currency : 'EUR',
    condition, delivery, city: delivery.includes('hand') ? str(l.city, 60) : '', country: str(l.country, 2).toUpperCase() || 'BE', photos, body, copyRef: str(l.copyRef, 60) } };
};
// Annonce depuis une fiche de la collection : seules les informations publiques sont reprises
const listingFromCopy = copy => ({
  title: str(copy && (copy.series || copy.title), 120), issue: str(copy && copy.issue, 20), publisher: str(copy && copy.publisher, 80),
  copyRef: str(copy && copy.id, 60), price: '', condition: '', delivery: [], photos: [], body: ''
});

// Frais : le vendeur reçoit le prix moins les frais de Panel ; l'acheteur paie le prix et l'expédition (prix du transporteur)
const fees = (priceCents, rate) => {
  const r = Number(rate);
  if (!(priceCents > 0) || !(r >= 0 && r < 0.5)) return null;
  const fee = Math.round(priceCents * r);
  return { price: priceCents, fee, seller: priceCents - fee, rate: r };
};
const money = (c, cur, locale) => { try { return new Intl.NumberFormat(locale || 'fr-BE', { style: 'currency', currency: cur || 'EUR' }).format(c / 100); } catch (_) { return (c / 100).toFixed(2) + ' ' + (cur || 'EUR'); } };

// Étape suivante d'une vente : refuse toute transition non prévue ou par la mauvaise personne
const step = (state, action, actor) => {
  const t = FLOW[state + ':' + action];
  if (!t) return { ok: false, error: 'invalid_transition' };
  if (t[1] !== 'any' && t[1] !== actor) return { ok: false, error: 'forbidden' };
  return { ok: true, state: t[0] };
};
const nextActions = (state, actor) => Object.keys(FLOW).filter(k => k.startsWith(state + ':') && (FLOW[k][1] === actor || FLOW[k][1] === 'any')).map(k => k.split(':')[1]);

// Code de remise en main propre : 6 chiffres, donné par l'acheteur au vendeur une fois l'exemplaire vérifié
const handoverCode = rnd => { const b = (rnd || (n => { const a = new Uint32Array(n); globalThis.crypto.getRandomValues(a); return a; }))(1); return String(b[0] % 1000000).padStart(6, '0'); };

const SAFETY = Object.freeze([
  'Payez toujours dans Panel : jamais de virement, de lien ou de paiement entre amis.',
  'En main propre : un lieu public, de jour ; vérifiez l\'exemplaire avant de donner votre code de remise.',
  'L\'argent est libéré au vendeur après votre confirmation, ou ' + AUTO_CONFIRM_DAYS + ' jours après la livraison sans litige.',
  'Un problème ? Ouvrez un litige depuis la vente : l\'équipe tranche avec les photos et les messages.'
]);

module.exports = { SIM_RATE, CONDITIONS, CONDITION_LABEL, DELIVERY, DELIVERY_LABEL, STATES, FLOW, AUTO_CONFIRM_DAYS, SAFETY,
  cents, validateListing, listingFromCopy, fees, money, step, nextActions, handoverCode };
