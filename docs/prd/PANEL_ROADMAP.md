# PANEL — Roadmap de modernisation

Date : 13 novembre 2026. Statut : proposé (D-58). Cette roadmap **intègre** la roadmap R0 à R10 de [`directeur/08-rebaseline-produit.md`](../directeur/08-rebaseline-produit.md) (D-54) : R0 à R2 sont déjà livrés (D-53, D-55 à D-57) ; les phases ci-dessous ordonnent la suite vers la vision sociale. Exigences : [`PANEL_FUNCTIONAL_SPECIFICATIONS.md`](PANEL_FUNCTIONAL_SPECIFICATIONS.md) ; critères : [`PANEL_ACCEPTANCE_TESTS.md`](PANEL_ACCEPTANCE_TESTS.md).

## Correspondance avec la roadmap existante

| Phase PRD | Lots existants | État au 13 novembre 2026 |
|---|---|---|
| 0 Audit et stabilisation | R0, ce PRD | R0 livré (mode sombre D-53, périmètre comics, navigation mobile) |
| 1 Fondations | Lots 3.2 à 3.7 (R6) | Préparé localement ; **bloqué par la création du projet cloud** |
| 2 Collection et Reading | R1 (catalogue commun, livré), R4 | R1 livré (D-55, D-56) |
| 3 Releases et Pull List | R3 | À faire |
| 4 Community | R7, R8 | À faire |
| 5 Différenciation | R2 (livré, D-57), R5, R9 | Partiel |
| 6 Monétisation et expansion | R10 | À faire |

---

## Phase 0 — Audit et stabilisation

- **Objectifs** : référence produit validée ; base saine avant d'ouvrir des comptes.
- **Contenu** : validation de ce PRD (D-58) ; mise à jour de `PRODUCT.md` et `README.md` (lecteur numérique retiré, trois piliers) ; archivage des ~60 fichiers `*.backup.*` hors de la racine (sur accord, sans suppression) ; inventaire manga étape 1 terminé (D-54 § 5) ; extraction d'au moins deux blocs métier de `index.html` vers `domains/**`.
- **Fonctions réutilisées** : tout l'existant.
- **Dépendances** : aucune.
- **Risques** : faible ; régression lors d'une extraction (tests).
- **Critères d'acceptation** : PRD validé ; 52/52 tests d'interface, 55 de domaine, 124 de base ; `check-boundaries --strict` et `check:secrets` verts ; aucune donnée utilisateur modifiée.
- **Livrables** : documents à jour, `index.html` réduit, tests verts.

## Phase 1 — Amélioration des fondations existantes

- **Objectifs** : comptes réels, synchronisation, hébergement public sécurisé.
- **Contenu** : projet Supabase UE (décision Q4) ; déploiement des migrations 1 à 12 ; hébergement statique (Q3) avec CSP ; écran **Compte** (PRF-01 à PRF-03, PRF-06, PRF-07) ; consentements ; synchronisation d'une collection existante (COL-14) ; sécurité Android (Keystore, `allowBackup`, signature) ; observabilité minimale ; sauvegardes serveur.
- **Fonctions réutilisées** : migrations 1 à 12, `sync-engine`, adaptateurs Supabase (D-35), matrice V1 à V14 (D-44), runbooks.
- **Dépendances** : **compte cloud créé par le porteur** (bloquant), Phase 0.
- **Risques** : écart entre PGlite et Supabase réel ; perte de données à la migration (atténuation : instantané, restauration testée).
- **Critères** : matrice V1 à V14 validée sur Supabase réel, Web et Android ; export et suppression de compte fonctionnels ; aucune perte sur une collection réelle de 1 200 exemplaires (copie).
- **Livrables** : application hébergée, comptes, synchronisation, runbooks à jour.

## Phase 2 — Collection et Reading

- **Objectifs** : pilier Collection irréprochable, pilier Reading enrichi.
- **Contenu** : déduplication par identifiants à l'import (COL-06) ; variantes au niveau exemplaire (COL-16) ; historique des acquisitions et répartition par période (COL-09, COL-11) ; statistiques de lecture (RDG-06) ; objectifs (RDG-07) ; catalogue `catalog` côté serveur (EXP-05, EXP-07 partiel) avec chargement initial depuis le catalogue commun local.
- **Fonctions réutilisées** : catalogue commun (D-55, D-56), import LoCG/CLZ, Lecture L1, Event Center v2.
- **Dépendances** : Phase 1 pour le serveur ; la partie locale peut commencer avant.
- **Risques** : rapprochement erroné (atténuation : validation humaine, jamais de fusion silencieuse).
- **Critères** : réimport LoCG sans aucun doublon ; numéros manquants exacts sur une série de référence ; statistiques de lecture correctes sur un jeu de test.
- **Livrables** : migrations `catalog` (13+), tests, écrans enrichis.

## Phase 3 — Releases et Pull List

- **Objectifs** : ne rater aucune sortie.
- **Contenu** : vues FOC et Upcoming #1 (REL-06), variantes repliées (REL-07), historique des reports (REL-03), « récupéré » → exemplaire (PUL-03), suivi créateur et événement (PUL-04), notifications locales (NOT-04), ingestion serveur planifiée (REL-08) si une source est obtenue.
- **Fonctions réutilisées** : calendrier, pull list, conflits de sources (D-43), contrats de domaine S1 à S6.
- **Dépendances** : Phase 2 (catalogue) ; **source sous licence** pour la partie partagée (bloquant pour REL-08 uniquement).
- **Risques** : absence de source (atténuation : sources personnelles, saisie éditoriale).
- **Critères** : vue semaine/FOC/Upcoming #1 ; un report visible avec historique ; notification locale déclenchée en test ; aucune entrée hors périmètre.
- **Livrables** : écrans calendrier v2, Edge Function d'ingestion (si source), tests.

## Phase 4 — Community (MVP social, bêta fermée)

- **Objectifs** : premières interactions entre lecteurs, en sécurité.
- **Contenu** : profils publics (PRF-03, PRF-04), suivre (COM-01), fil chronologique (COM-02, COM-03), publications et critiques avec spoilers (PUB-01 à PUB-05, PUB-07, PUB-08), commentaires et réactions, blocage et masquage (COM-05, COM-06), signalements et modération avec appels (ADM-01 à ADM-04, ADM-08), notifications in-app (NOT-01 à NOT-03), DIF-08 (collection ↔ publications), documents juridiques (CGU, confidentialité, modération).
- **Fonctions réutilisées** : `policy-core` (contrats Publish/Revoke/Feed, graphe, limiteur, validation, modération), rôles (migration 10), limites (migration 12).
- **Dépendances** : Phases 1 et 2 ; CGU validées ; entité juridique (Q10).
- **Risques** : communauté vide ; modération débordée ; contenus illicites (atténuation : bêta sur invitation, 50 à 300 lecteurs, file de modération testée).
- **Critères** : parcours signalement → décision → appel de bout en bout ; spoilers floutés par défaut ; aucune donnée privée exposée (test d'intrusion RLS) ; temps de traitement des signalements < 72 h en bêta.
- **Livrables** : migrations `community`, `moderation`, `notify` ; écrans Fil, Profil, Publication, Modération ; bêta fermée.

## Phase 5 — Différenciation et fonctions avancées

- **Objectifs** : ce qui rend PANEL unique.
- **Contenu** : groupes et clubs de lecture (GRP-01 à GRP-03), challenges (GRP-04, GRP-05), Comic DNA (DIF-01), Collection Match (DIF-02), recommandations (DIF-05), découverte communautaire (DIF-06), pages créateurs et personnages (EXP-06), notifications push (NOT-05), listes partagées (PUB-06), site public indexable optionnel (PRD-D3).
- **Fonctions réutilisées** : niveaux de lecture et progression (D-57), journal de lecture, catalogue.
- **Dépendances** : Phase 4 ; volume d'utilisateurs suffisant pour Match et recommandations.
- **Risques** : fonctions gadgets (atténuation : objectifs mesurables DIF, retrait si non atteints après 3 mois).
- **Critères** : objectifs DIF mesurés en bêta ; progression de challenge exacte (dérivée du journal).
- **Livrables** : écrans Groupes, Clubs, Challenges, profil enrichi.

## Phase 6 — Monétisation et expansion

- **Objectifs** : modèle économique viable, V1 publique, préparation européenne.
- **Contenu** : PANEL Plus (PLN-01 à PLN-06) avec Stripe ; conformité DSA complète (rapport de transparence, ADM-09) ; console d'administration (ADM-05, ADM-07) ; V1 publique ; puis expansion européenne : internationalisation (i18n des chaînes, formats de date et devises), marchés supplémentaires (éditions allemandes, espagnoles, italiennes de comics), modération multilingue.
- **Fonctions réutilisées** : finances multi-devises (F1), préférences de marché (`app.profiles.preferred_market`).
- **Dépendances** : Phases 4 et 5 ; décisions de prix (Q5) ; entité juridique.
- **Risques** : conversion faible (atténuation : valeur Plus centrée sur le confort, test de prix) ; complexité TVA (Stripe Tax).
- **Critères** : abonnement, renouvellement, échec de paiement, annulation et rétrogradation testés en mode test Stripe ; aucune fonction sociale essentielle bloquée ; aucune donnée perdue à la rétrogradation.
- **Livrables** : offre Plus, V1 publique, plan d'expansion.

## Dépendances

```
Phase 0 ──► Phase 1 (bloquée : compte cloud) ──► Phase 2 ──► Phase 3
                                              └──► Phase 4 ──► Phase 5 ──► Phase 6
Phase 2 (partie locale) et Phase 3 (partie locale) peuvent avancer sans Phase 1.
```

## Jalons produit

| Jalon | Contenu | Phase |
|---|---|---|
| Fondations | Comptes, synchronisation, hébergement | 1 |
| MVP | Collection + Reading + Releases branchés au compte, social de base | 2 à 4 |
| Bêta fermée | 50 à 300 lecteurs francophones, sur invitation | 4 |
| V1 publique | Clubs, challenges, DNA, Plus, DSA | 5 et 6 |
| V2 | Contributions catalogue, messages privés, partenaires libraires | après 6 |
| Expansion européenne | Langues et marchés supplémentaires | 6 et suivantes |

## KPI et analytics

| KPI | Définition exacte | Calcul |
|---|---|---|
| **North Star** : lecteurs actifs engagés hebdomadaires (LAEH) | Utilisateurs ayant, dans la semaine ISO, au moins **une action de pilier** : lecture enregistrée, exemplaire ajouté, ou interaction sociale (publication, commentaire, réaction, adhésion) | `count(distinct user_id)` sur `analytics.events` où `type ∈ piliers` par semaine |
| Activation | Part des inscrits qui, sous 7 jours, ajoutent ≥ 5 exemplaires **ou** marquent ≥ 3 lectures **et** suivent ≥ 1 lecteur ou groupe | activés / inscrits de la cohorte |
| Rétention J7 / J30 | Part d'une cohorte d'inscription active (≥ 1 action de pilier) le jour 7 (fenêtre J7-J13) / jour 30 (fenêtre J30-J36) | actifs fenêtre / taille cohorte |
| Engagement | Sessions par utilisateur actif hebdomadaire ; ratio actifs journaliers / mensuels | DAU / MAU |
| Utilisation de la collection | Exemplaires ajoutés par semaine ; part des utilisateurs actifs avec ≥ 1 ajout ; taux de scans réussis sans correction | sommes et ratios hebdomadaires |
| Activité communautaire | Publications, commentaires, réactions par actif hebdomadaire ; part des publications recevant ≥ 1 réponse sous 48 h | ratios hebdomadaires |
| Conversion Premium | Part des utilisateurs actifs mensuels abonnés à Plus ; conversion d'essai | abonnés actifs / MAU ; essais convertis / essais terminés |
| Churn | Part des abonnés au début du mois ayant annulé ou expiré à la fin du mois | perdus / abonnés début de mois |
| Acquisition | Inscriptions par canal (invitation, recherche, réseau social, bouche-à-oreille) ; coût par inscription si campagne | inscriptions / canal (paramètre d'invitation ou déclaratif) |
| Qualité de modération | Délai médian de traitement d'un signalement ; part des décisions infirmées en appel | médiane ; infirmées / appels |

Mesure : événements produits **anonymisés ou pseudonymisés**, collectés après consentement, sans contenu ni donnée de collection ; tableau de bord interne.
