'use strict';
// Dates « du jour » à l'heure locale (stabilisation, étape C, F1) — module pur : ni DOM, ni réseau, ni stockage.
// Pourquoi : toISOString() tronqué à 10 caractères donne la date UTC. Entre minuit et 1 h (2 h l'été) en France,
// et jusqu'à 5 h au Québec, la date d'achat, de cession, « aujourd'hui » du calendrier et les noms d'export
// étaient ceux de la veille. Les dates saisies par l'utilisateur (AAAA-MM-JJ) sont locales : on compare local à local.
// Ne pas utiliser pour les horodatages techniques (addedAt, updatedAt…), qui restent en ISO UTC complet.

const pad = n => String(n).padStart(2, '0');
const asDate = d => (d instanceof Date ? d : d === undefined ? new Date() : new Date(d));

// AAAA-MM-JJ du jour local de l'instant donné (maintenant par défaut)
const localDay = d => { const x = asDate(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };

// AAAA-MM du mois local
const localMonth = d => localDay(d).slice(0, 7);

// Les `count` derniers mois locaux, du plus ancien au mois courant (AAAA-MM), sans dépendre du jour du mois
const localMonthsBack = (d, count = 12) => {
  const x = asDate(d), out = [];
  for (let i = count - 1; i >= 0; i--) out.push(localMonth(new Date(x.getFullYear(), x.getMonth() - i, 1, 12)));
  return out;
};

module.exports = { localDay, localMonth, localMonthsBack };
