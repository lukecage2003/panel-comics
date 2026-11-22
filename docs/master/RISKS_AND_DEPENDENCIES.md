# Risques et dépendances (D-111)

| # | Risque | Probabilité | Impact | Parade | Déclencheur de révision |
|---|---|---|---|---|---|
| R1 | Un mineur ment sur son âge | Élevée | Élevé | Statut « non vérifié », séparation adultes et mineurs, signalement immédiat pour la sécurité d'un mineur, contestation, preuve d'âge (RESEARCH) | Premier incident signalé |
| R2 | Un adulte tente de contacter un mineur | Moyenne | Très élevé | Les adultes ne voient pas les mineurs ; invitation en direct refusée côté serveur ; messages privés (D-113) réservés aux adultes et refusés côté serveur entre mineur et adulte (`messaging.can`, migration 19) | AIPD sur les messages avant leur ouverture |
| R3 | Faux parent | Moyenne | Élevé | Le lien part du jeune ; code à usage unique de 48 h ; double authentification ; l'équipe peut révoquer | — |
| R4 | Modération débordée | Élevée au lancement | Élevé | Beta sur invitation, masquage à trois signalements, limites de débit, restrictions proportionnées | Délai de traitement dépassé |
| R5 | Droit d'auteur (images, textes, cartes) | Moyenne | Élevé | Provenance, « plan de fan », ©, revue par un juriste en propriété intellectuelle | Lancement commercial |
| R6 | Coût d'hébergement plus élevé que prévu | Moyenne | Moyen | Local d'abord ; directs réels reportés ; scénario 6 du [FINANCIAL_MODEL](FINANCIAL_MODEL.md) | Facture réelle |
| R7 | Perte des données locales d'un membre | Faible | Élevé | Exports, sauvegardes, aucune réinitialisation automatique | — |
| R8 | Obligations DSA mal évaluées (taille de l'entreprise) | Moyenne | Moyen | Appliquer les règles comme bonne pratique ; avocat | Croissance |
| R9 | Dépendance à un fournisseur (Supabase) | Faible | Moyen | SQL standard, migrations versionnées, tests PGlite | Changement de conditions |
| R10 | Identité légale absente | Certaine aujourd'hui | Bloquant | Aucune ouverture des comptes avant | — |
| R11 | Arnaque au Marché (paiement hors plateforme, faux envoi) | Élevée | Élevé | Paiement uniquement dans Panel par un prestataire agréé ; coordonnées et « virement » refusés dans les annonces ; code de remise ; litige arbitré | Premier litige |
| R12 | Faux éditeur, fausse boutique ou faux créateur | Moyenne | Élevé | Sceau Encré posé à la main sur pièces ; retrait possible ; aucune page au nom d'une maison avant sa demande | Signalement d'usurpation |
| R13 | Contenu illégal dans des messages chiffrés | Moyenne | Élevé | Demande avant échange, blocage, signalement avec messages choisis, aucun message entre mineur et adulte | AIPD, avis d'avocat |
| R14 | Obligations fiscales et de paiement du Marché mal évaluées | Moyenne | Élevé | Marché fermé par défaut ; DAC7, DSP2 et droit de la consommation listés au §5 de la conformité | Avant l'ouverture du Marché |

## Dépendances externes (aucune n'est activée)

- Hébergeur de base de données, dans l'UE.
- Avocat belge, comptable.
- Prestataire de paiement (Marché et abonnements) : à choisir, agréé dans l'UE ; aucun n'est contacté.
- Prestataire de preuve d'âge : RESEARCH.
- Serveur média : DEFERRED.
- Licences de données externes et de musique.
