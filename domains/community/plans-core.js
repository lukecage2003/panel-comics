'use strict';
// Offres d'abonnement (D-113) — module pur. Aucun prix n'est fixé ici : `price` reste null tant que l'éditeur de Panel ne l'a pas
// décidé ; l'application affiche alors « Tarif à venir ». La collection, la Wishlist, la Pull list, les Key Issues, le fil,
// le forum, les directs et les messages restent gratuits : un abonnement n'achète jamais de visibilité dans le fil ni dans le forum.

const PLANS = Object.freeze([
  { key: 'free', name: 'Panel', audience: 'Tout le monde', price: null, free: true,
    features: ['Collection illimitée, Wishlist, Pull list, Key Issues', 'Fil, Le Comptoir, directs, messages privés', 'Vente entre membres (frais de service par vente)', 'Découvrir, cartes, quiz et défis'] },
  { key: 'plus', name: 'Panel+', audience: 'Collectionneurs', price: null, adultOnly: true,
    features: ['Statistiques avancées et privées de la collection', 'Exports CSV et PDF d\'assurance', 'Directs plus longs, rediffusion audio 30 jours', 'Thèmes d\'étagère et cadres de profil', 'Frais de vente réduits sur le marché', 'Pastille « Soutien »'] },
  { key: 'creator', name: 'Panel Créateur', audience: 'Scénaristes, dessinateurs, coloristes…', price: null, adultOnly: true, requiresSeal: 'creator',
    features: ['Portfolio et bibliographie mis en avant sur le profil', 'Annonces de dédicaces et de conventions', 'Statistiques de profil', 'Annonces illimitées dans L\'Atelier (collaborations)', 'Précommandes et éditions signées sur le marché'] },
  { key: 'publisher', name: 'Panel Éditeur', audience: 'Maisons d\'édition', price: null, adultOnly: true, requiresSeal: 'publisher',
    features: ['Page officielle avec catalogue et calendrier des sorties', 'Annonces étiquetées « Éditeur » (2 sur 10 au plus dans le fil)', 'Directs officiels et séances de questions', 'Plusieurs gestionnaires avec double authentification', 'Statistiques agrégées, jamais de données personnelles des membres'] },
  { key: 'shop', name: 'Panel Boutique', audience: 'Boutiques de comics', price: null, adultOnly: true, requiresSeal: 'shop',
    features: ['Fiche « Boutique Encrée » et pull list en ligne', 'Annonce du mercredi des sorties', 'Rencontres et dédicaces sur place', 'Vente au marché avec statut de professionnel']
  }
]);
const ENTITLEMENTS = Object.freeze({
  stats_advanced: ['plus', 'creator', 'publisher', 'shop'], export_pdf: ['plus', 'creator', 'publisher', 'shop'], live_long: ['plus', 'creator', 'publisher'],
  shelf_themes: ['plus', 'creator'], market_reduced_fee: ['plus'], portfolio_featured: ['creator'], collab_unlimited: ['creator', 'publisher'],
  official_page: ['publisher'], official_posts: ['publisher', 'shop'], team_seats: ['publisher', 'shop'], shop_pull_list: ['shop'], pro_seller: ['shop', 'publisher', 'creator']
});
// Ce que l'abonnement ne peut JAMAIS acheter (vérifié par les tests)
const NEVER = Object.freeze(['feed_boost', 'forum_boost', 'verified_seal', 'ranking_priority', 'member_data']);

const plan = k => PLANS.find(p => p.key === k) || PLANS[0];
const has = (planKey, feature) => !NEVER.includes(feature) && (ENTITLEMENTS[feature] || []).includes(planKey);
// Un membre peut-il souscrire ? Adulte ; sceau Encré du bon type pour les offres pros
const canSubscribe = (planKey, member) => {
  const p = PLANS.find(x => x.key === planKey);
  if (!p || p.free) return { ok: false, reason: 'invalid' };
  const m = member || {};
  if (p.adultOnly && m.minor) return { ok: false, reason: 'adult_only' };
  if (p.requiresSeal && m.seal !== p.requiresSeal) return { ok: false, reason: 'seal_required' };
  if (p.price === null) return { ok: false, reason: 'not_on_sale' };
  return { ok: true };
};
const priceLabel = p => p && p.free ? 'Gratuit' : p && typeof p.price === 'number' ? p.price : 'Tarif à venir';
const REASON = Object.freeze({ invalid: 'Offre inconnue.', adult_only: 'Offre réservée aux adultes.', seal_required: 'Offre réservée aux profils Encré de ce type.', not_on_sale: 'Cette offre n\'est pas encore en vente.' });

module.exports = { PLANS, ENTITLEMENTS, NEVER, REASON, plan, has, canSubscribe, priceLabel };
