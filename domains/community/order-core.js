'use strict';
// Suivi d'une vente du Marché (D-115) — module pur.
// Les états et les transitions restent ceux de market-core (FLOW) et de api.order_step (migration 19) ; ce module ajoute
// ce que l'acheteur et le vendeur voient : étapes, échéances, retard d'expédition, litige, numéro de suivi, baisses de prix.
// Ces délais sont des règles de Panel (pas des délais légaux) ; ils figurent dans les conditions du Marché.

const PAY_HOURS = 24;          // une réservation non payée se libère au bout de 24 h
const SHIP_DAYS = 5;           // le vendeur expédie sous 5 jours après le paiement, sinon l'acheteur peut annuler
const AUTO_CONFIRM_DAYS = 3;   // identique à market-core : l'argent est libéré 3 jours après la livraison sans litige
const H = 36e5, D = 864e5;

const PATH = Object.freeze({ ship: ['reserved', 'paid', 'shipped', 'delivered', 'completed'], hand: ['reserved', 'paid', 'completed'] });
const STEP_LABEL = Object.freeze({ reserved: 'Réservé', paid: 'Payé, argent gardé', shipped: 'Expédié', delivered: 'Livré', completed: 'Terminé', cancelled: 'Annulé', disputed: 'Litige en cours' });
const DISPUTE_REASONS = Object.freeze({
  not_received: { label: 'Colis non reçu', photo: false },
  not_as_described: { label: 'Ne correspond pas à l’annonce (état, numéro, variante)', photo: true },
  damaged: { label: 'Abîmé pendant le transport', photo: true },
  counterfeit: { label: 'Contrefaçon ou reproduction', photo: true },
  other: { label: 'Autre problème', photo: false }
});

// Numéro de suivi : lettres et chiffres, 8 à 40 caractères (les formats varient selon le transporteur ; l'équipe peut vérifier)
const tracking = v => { const t = String(v || '').toUpperCase().replace(/[\s.-]/g, ''); return /^[A-Z0-9]{8,40}$/.test(t) ? t : ''; };

const firstAt = (events, state) => { const e = (events || []).find(x => x && x.to === state); const t = e ? Date.parse(e.at) : NaN; return Number.isFinite(t) ? t : null; };

// Vue d'une vente pour l'une des deux personnes : étapes, prochaine action, échéance, retard
const timeline = (order, events, nowMs) => {
  const o = order || {}, path = o.delivery === 'hand' ? PATH.hand : PATH.ship, state = o.state;
  const at = s => firstAt(events, s);
  let reached = path.indexOf(state);
  if (reached < 0) { // annulé ou litige : on garde la dernière étape franchie
    reached = -1;
    path.forEach((s, i) => { if (at(s) !== null) reached = i; });
  }
  const steps = path.map((s, i) => ({ key: s, label: STEP_LABEL[s], done: i <= reached, current: i === reached && path.includes(state), at: at(s) }));
  let todo = '', due = null;
  if (state === 'reserved') { todo = 'buyer_pay'; const t = at('reserved'); due = t === null ? null : t + PAY_HOURS * H; }
  else if (state === 'paid' && o.delivery === 'hand') todo = 'meet';
  else if (state === 'paid') { todo = 'seller_ship'; const t = at('paid'); due = t === null ? null : t + SHIP_DAYS * D; }
  else if (state === 'shipped') todo = 'wait_delivery';
  else if (state === 'delivered') { todo = 'buyer_confirm'; const t = at('delivered'); due = t === null ? null : t + AUTO_CONFIRM_DAYS * D; }
  else if (state === 'disputed') todo = 'staff';
  else if (state === 'completed') todo = 'review';
  const late = due !== null && Number.isFinite(nowMs) && nowMs > due;
  return { steps, state, label: STEP_LABEL[state] || '', todo, due, late, closed: state === 'completed' || state === 'cancelled' };
};

// Phrase affichée selon la personne
const todoText = (tl, role) => {
  const me = role === 'seller' ? 'seller' : 'buyer', T = {
    buyer_pay: { buyer: 'Payez dans Panel pour confirmer la réservation.', seller: 'L’acheteur doit payer ; sinon le numéro redevient disponible.' },
    meet: { buyer: 'Vérifiez l’exemplaire, puis donnez votre code à 6 chiffres au vendeur.', seller: 'Saisissez le code que l’acheteur vous donne sur place.' },
    seller_ship: { buyer: 'Le vendeur prépare l’envoi.', seller: 'Expédiez et ajoutez le numéro de suivi.' },
    wait_delivery: { buyer: 'Colis en route.', seller: 'Colis en route.' },
    buyer_confirm: { buyer: 'Tout est conforme ? Confirmez la réception, ou ouvrez un litige.', seller: 'L’acheteur vérifie le colis ; l’argent est libéré ensuite.' },
    staff: { buyer: 'L’équipe examine le litige avec les photos et les messages.', seller: 'L’équipe examine le litige avec les photos et les messages.' },
    review: { buyer: 'Vente terminée : laissez un avis au vendeur.', seller: 'Vente terminée : l’argent vous est versé.' }
  };
  const t = T[tl && tl.todo];
  if (!t) return tl && tl.state === 'cancelled' ? 'Vente annulée : l’acheteur est remboursé.' : '';
  return t[me] + (tl.late && tl.todo === 'seller_ship' ? (me === 'buyer' ? ' Délai dépassé : vous pouvez annuler et être remboursé.' : ' Délai dépassé : l’acheteur peut annuler.') : '');
};

// L'acheteur peut-il annuler pour retard d'expédition ?
const lateCancel = (order, events, nowMs) => !!order && order.state === 'paid' && order.delivery !== 'hand' && timeline(order, events, nowMs).late;
// L'acheteur peut-il ouvrir un litige ? En route, ou dans les 3 jours qui suivent la livraison
const canDispute = (order, events, nowMs) => {
  if (!order) return false;
  if (order.state === 'shipped') return true;
  if (order.state !== 'delivered') return false;
  const t = firstAt(events, 'delivered');
  return t === null || nowMs - t <= AUTO_CONFIRM_DAYS * D;
};
const validateDispute = (reason, text, photos) => {
  const r = DISPUTE_REASONS[reason], body = String(text || '').trim(), n = (Array.isArray(photos) ? photos : []).filter(Boolean).length, e = [];
  if (!r) e.push('Choisissez le motif du litige.');
  if (body.length < 20) e.push('Décrivez le problème en quelques phrases (20 caractères au moins).');
  if (body.length > 1000) e.push('1000 caractères au plus.');
  if (r && r.photo && !n) e.push('Ajoutez au moins une photo de l’exemplaire reçu.');
  return { ok: !e.length, errors: e };
};

// Favoris : baisses de prix depuis l'ajout (prix en centimes)
const priceDrops = (favorites, current) => (Array.isArray(favorites) ? favorites : []).map(f => {
  const now = current && current[f.id];
  if (!(f && f.savedPrice > 0) || !(now > 0) || now >= f.savedPrice) return null;
  return { id: f.id, from: f.savedPrice, to: now, pct: Math.round((1 - now / f.savedPrice) * 100) };
}).filter(Boolean).sort((a, b) => b.pct - a.pct);

module.exports = { PAY_HOURS, SHIP_DAYS, AUTO_CONFIRM_DAYS, PATH, STEP_LABEL, DISPUTE_REASONS, tracking, timeline, todoText, lateCancel, canDispute, validateDispute, priceDrops };
