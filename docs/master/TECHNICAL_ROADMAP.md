# Feuille de route technique (D-111)

Ordre des lots techniques. L'historique est dans [ROADMAP.md](../ROADMAP.md) et [HISTORIQUE-LOTS.md](../HISTORIQUE-LOTS.md) ; S8 est détaillé dans [directeur/12](../directeur/12-s8-comptes-en-ligne.md).

| Lot | Contenu | Priorité | Dépend de | Statut |
|---|---|---|---|---|
| T1 | Migration 18 Panel Guardian + 11 tests PGlite | P0 | Migrations 13, 15, 17 | **Fait (local)** |
| T2 | Avis d'âge et note de non-affiliation dans Légal & sécurité | P0 | — | **Fait** |
| T3 | Corrections financières F-01 à F-05 ([directeur/02](../directeur/02-audit-financier.md)) | P1 | — | À vérifier lot par lot (NEEDS_AUDIT) |
| T4 | Application des migrations 13 à 18 en préproduction | P0 | Accord de l'utilisateur, CGU | Fermé (S8) |
| T5 | Écrans Guardian : code parental, réglages, contestation, restrictions dans la modération | P0 | T4 | PLANNED |
| T6 | Branchement du fil, des pensées et des directs sur `api.*` | P1 | T4, T5 | PLANNED (module client prêt, D-97) |
| T7 | Tests de bout en bout sur la base réelle (sans données réelles d'utilisateurs) | P0 | T4 | PLANNED |
| T8 | Règles d'âge par pays (`guardian.country_rules`) | P2 | Ouverture hors de Belgique | PLANNED |
| T9 | Preuve d'âge par prestataire (statut `verified_*`, rôle service) | RESEARCH | AIPD, choix du prestataire | — |
| T10 | Serveur média des directs | DEFERRED | Revenus, modération temps réel | — |

## Règles de chaque lot

- Lancer `npm run test:all` sans erreur.
- Ne jamais lancer deux suites Edge en même temps.
- Faire des commits locaux, sans push ni déploiement, sauf accord explicite.
- Une migration est **additive** et testée avec PGlite avant toute application distante.
