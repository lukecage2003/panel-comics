# Modèle économique (D-111)

Synthèse. Le détail des propositions déjà faites est dans [directeur/13](../directeur/13-monetisation-musique-suite.md) (D-98) et [panel-2/PANEL_2_BUSINESS_MODEL](../panel-2/PANEL_2_BUSINESS_MODEL.md). **Statut : propositions.** Rien n'est vendu ; aucun prestataire de paiement, de publicité ou partenaire n'est choisi ni contacté ; aucun partenariat n'existe.

## Principes non négociables

1. La collection, la Wishlist, la Pull list, les Key Issues, le fil, les directs et les rencontres restent **gratuits et complets**.
2. On ne vend **ni les données, ni la visibilité** dans le fil.
3. **Aucune publicité ni offre payante présentée aux mineurs.**
4. Toute annonce commerciale est étiquetée (« Partenaire », « lien affilié »).
5. Aucun faux membre, faux avis ou faux abonné pour amorcer la croissance.
6. Un abonnement n'achète **jamais** : une place dans le fil, des votes ou une place au Comptoir, le sceau Encré, un meilleur classement, les données des membres (liste `NEVER` de `plans-core`, vérifiée par les tests, D-113).

## Sources de revenus envisagées (par ordre de priorité)

| # | Source | Pour qui | Valeur offerte | Prix | Statut |
|---|---|---|---|---|---|
| 1 | Frais de service du Marché (D-113) | Vendeurs adultes | Paiement protégé, remise suivie (point relais, colis, main propre avec code), litiges arbitrés | Pourcentage du prix `[À DÉCIDER]` ; l'application affiche une **simulation à 7 %** clairement marquée « taux réel à fixer » | PREPARED (migration 19, marché fermé tant que `market.settings.fee_rate` est vide) |
| 2 | Panel Boutique (« Boutique Encrée ») | Boutiques de comics | Pull list en ligne, annonce du mercredi, rencontres sur place, vente avec statut de professionnel | `[À DÉFINIR]` après entretiens | PLANNED |
| 2 bis | Panel Éditeur | Maisons d'édition vérifiées | Page officielle, catalogue, calendrier, directs officiels, plusieurs gestionnaires en double authentification, statistiques agrégées | `[À DÉFINIR]` | PLANNED |
| 2 ter | Panel Créateur | Créateurs vérifiés | Portfolio mis en avant, dédicaces, Atelier illimité, précommandes | `[À DÉFINIR]` | PLANNED |
| 2 quater | Panel+ | Membres adultes | Confort : directs plus longs, thèmes, statistiques privées, exports, frais de vente réduits | Hypothèse D-98 : environ 3 € par mois ou 30 € par an — **à valider** | PLANNED |
| 3 | Affiliation | Membres adultes | Lien « Acheter » marqué sur la fiche d'un numéro | Commission selon contrat `[À DÉFINIR]` | RESEARCH |
| 4 | Conventions et événements | Organisateurs vérifiés | Annonce de stands et de dédicaces | `[À DÉFINIR]` | RESEARCH |
| 5 | Publicité contextuelle sans profilage | Adultes seulement | — | — | DEFERRED (dernier recours) |

## Coûts principaux

| Poste | Nature | Montant |
|---|---|---|
| Hébergement de la base (Supabase ou autre, UE) | Variable selon l'usage | `[À COMPLÉTER]` d'après la grille de l'hébergeur au moment du choix |
| Diffusion des directs (serveur média) | Variable, élevé | DEFERRED, `[À COMPLÉTER]` |
| Modération humaine | Fixe et variable | `[À COMPLÉTER]` (bénévoles ou salariés) |
| Avocat (CGU, AIPD), comptable | Ponctuel | `[À COMPLÉTER]` sur devis |
| Frais des boutiques d'applications et du paiement | Pourcentage du chiffre d'affaires | Selon les conditions publiées par chaque plateforme, `[À COMPLÉTER]` |

## Écosystème pro

- **Vérification et sceau Encré (D-113)** : l'équipe vérifie chaque pro à la main, sur pièce (liste `EVIDENCE` de `pro-core` : numéro d'entreprise, domaine officiel, mandat, publications…), puis efface les justificatifs ; la décision et son motif restent dans le journal. Le sceau peut être retiré. Il ne s'achète pas et aucun abonnement ne le donne. Aucune vérification automatique n'est présentée comme une certification.
- **Grandes maisons** : Panel ne prétend à aucun partenariat. Une maison d'édition (petite ou grande) ouvre sa page en déposant une demande Éditeur ; rien n'est affiché à son nom tant qu'elle ne l'a pas fait et que l'équipe ne l'a pas vérifiée.
- **Place dans le fil** : 2 sur 10 au plus, comme un auteur ([ranking-core](../../domains/community/ranking-core.js)). Les pros ne passent jamais devant les abonnements.
- **Mineurs** : un pro ne contacte jamais un mineur. La séparation entre adultes et mineurs s'applique aussi à lui.

## Marché entre membres (D-113)

| Point | Choix | Statut |
|---|---|---|
| Qui vend | Adultes seulement ; un vendeur régulier est signalé comme professionnel | PREPARED |
| Paiement | Uniquement dans Panel, via un **prestataire de paiement agréé** qui garde l'argent jusqu'à la confirmation (Panel ne détient jamais les fonds) | `[À CHOISIR]` ⚖ |
| Remise | Point relais, colis suivi, main propre avec code à 6 chiffres (empreinte seule côté serveur) | PREPARED |
| Libération | À la confirmation de l'acheteur, ou 3 jours après la livraison sans litige | PREPARED |
| Frais | Pourcentage `[À DÉCIDER]` ; la livraison est payée par l'acheteur au prix du transporteur | `[À DÉCIDER]` |
| Ce qui n'est jamais publié | Prix d'achat, cote, rangement, notes de l'exemplaire (`listingFromCopy`) | Testé |

Les obligations légales du marché sont rangées dans [SECURITY_AND_COMPLIANCE §5](SECURITY_AND_COMPLIANCE.md).
