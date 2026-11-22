# Feuille de route technique (D-111)

Ordre des lots techniques. L'historique est dans [ROADMAP.md](../ROADMAP.md) et [HISTORIQUE-LOTS.md](../HISTORIQUE-LOTS.md) ; S8 est détaillé dans [directeur/12](../directeur/12-s8-comptes-en-ligne.md).

| Lot | Contenu | Priorité | Dépend de | Statut |
|---|---|---|---|---|
| T1 | Migration 18 Panel Guardian + 11 tests PGlite | P0 | Migrations 13, 15, 17 | **Fait (local)** |
| T2 | Avis d'âge et note de non-affiliation dans Légal & sécurité | P0 | — | **Fait** |
| T3 | Corrections financières ([directeur/02](../directeur/02-audit-financier.md)) | — | — | **Fait** : F0 (D-19) et F1 (D-27 à D-29) ; reste F-12 en P2 |
| T4 | Application des migrations 13 à 18 en préproduction | P0 | Accord de l'utilisateur, CGU | Fermé (S8) |
| T5 | Écrans Guardian : code parental, réglages, contestation, restrictions dans la modération | P0 | T4 | **Préparé (D-112)** : module `guardian-core` (appels, statuts, messages) et encadré de Compte & profil ; branchement sur le serveur avec T4 |
| T6 | Branchement du fil, des pensées et des directs sur `api.*` | P1 | T4, T5 | PLANNED (module client prêt, D-97) |
| T7 | Tests de bout en bout sur la base réelle (sans données réelles d'utilisateurs) | P0 | T4 | PLANNED |
| T8 | Règles d'âge par pays (`guardian.country_rules`) | P2 | Ouverture hors de Belgique | PLANNED |
| T9 | Preuve d'âge par prestataire (statut `verified_*`, rôle service) | RESEARCH | AIPD, choix du prestataire | — |
| T10 | Serveur média des directs | DEFERRED | Revenus, modération temps réel | — |
| T11 | Migration 19 (pros, marché, forum, messages, offres) + 8 tests PGlite | P1 | Migrations 13, 15, 17, 18 | **Fait (local, D-113)** |
| T12 | Écrans Le Comptoir, Marché, Messages, Pros & Atelier, Offres (mode local) | P1 | T11 | **Fait (D-113)** |
| T13 | Prestataire de paiement agréé (séquestre, versements, DAC7) | P1 | Avis d'avocat, identité légale | `[À CHOISIR]` |
| T14 | Double cliquet pour les messages (confidentialité persistante) | FAIT EN LOCAL (D-114 : X3DH + double cliquet, migration 20 testée) | T11 | — |
| T15 | Expéditeur scellé (masquer l'expéditeur au serveur) | RESEARCH | T14 | — |
| T16 | Envoi chiffré des pièces de vérification et file d'examen de l'équipe | PLANNED | migration 20, S8 | — |

## Règles de chaque lot

- Lancer `npm run test:all` sans erreur.
- Ne jamais lancer deux suites Edge en même temps.
- Faire des commits locaux, sans push ni déploiement, sauf accord explicite.
- Une migration est **additive** et testée avec PGlite avant toute application distante.
