# Phase 3 · 06 — Feuille de route : comptes, profils, synchronisation local-first

Statut : **proposition à valider**. Sept lots, ajustables. Chaque lot s'arrête sur une validation de l'utilisateur avant le suivant.

Principe directeur : **Panel reste pleinement utilisable sans compte et sans réseau**. Le cloud est une option qui protège et relie les appareils ; il ne devient jamais un prérequis.

> *Mise à jour du 7 novembre 2026* : l'**ordre** des lots et leurs dépendances font désormais autorité dans [`../phase4/08-plan-execution.md`](../phase4/08-plan-execution.md), qui ajoute le lot **3.1b** (séparation des domaines côté client, sauvegardes par domaine B1) entre 3.1 et 3.4. Le contenu des lots ci-dessous reste valable.

## Vue d'ensemble
```
3.1 Fondations (local, aucun compte cloud)
 └─► 3.2 Projet cloud + authentification + CSP + hébergement
      └─► 3.3 Profils, préférences, appareils
           └─► 3.4 Moteur de synchronisation + première migration
                └─► 3.5 Conflits, multi-appareils, robustesse
                     └─► 3.6 Sauvegardes, restauration, sécurité, RGPD, suppression de compte
                          └─► 3.7 Validation complète Web + Android, préparation de la Phase 4
```
Seul le lot 3.6 peut commencer en partie en parallèle du lot 3.5 (exports et runbooks), une fois le lot 3.4 validé.

---

## Lot 3.1 — Fondations backend et préparation du client
Détail complet : [`07-lot-3.1-cahier-des-charges.md`](07-lot-3.1-cahier-des-charges.md).

- **Objectifs** : rendre le backend reproductible et testé **sans aucun compte cloud ni engagement financier**, et préparer le client sans en changer le comportement.
- **Périmètre fonctionnel** : aucun changement visible ; rapport de préparation `Panel.sync.readiness()` en console.
- **Périmètre technique** :
  - dossier `backend/` (migrations SQL, configuration Supabase, tests) ;
  - schéma `app`, tables personnelles avec colonnes de synchronisation, RLS, index ;
  - tables techniques (`user_sync_state`, `sync_ops`, `sync_conflicts`) ;
  - tests de base de données avec PGlite et un schéma `auth` simulé ;
  - script de détection de secrets ; `.env.example` ;
  - registre `SYNC_DOMAINS` côté client, drapeau désactivé.
- **Dépendances** : aucune.
- **Changements de données** : **aucun** sur les données locales. Aucun nouveau store IndexedDB n'est encore créé.
- **Risques** :
  - différences entre PGlite et le Postgres de Supabase (extensions, rôles) → tests rejoués avec Supabase local dès que Docker est disponible ;
  - RLS contournée par un superutilisateur pendant les tests → tests sous un rôle non privilégié.
- **Tests** : tests SQL (schéma, contraintes, RLS entre deux utilisateurs, déclencheurs `rev`), détection de secrets, suite existante (28 tests) inchangée.
- **Critères d'acceptation** : voir `07` § 7 (mesurables).
- **Livrables** : `backend/`, scripts npm, documentation et runbooks, rapport.
- **Validation utilisateur** : relecture du schéma et du rapport ; exécution d'une commande de test documentée.

## Lot 3.2 — Projet cloud, authentification, sécurité du client
- **Objectifs** : créer les comptes ; inscription, connexion, vérification, réinitialisation, déconnexion ; Web et Android.
- **Périmètre fonctionnel** : écran « Compte » (création, connexion, mot de passe oublié, déconnexion locale, déconnexion de tous les appareils). Aucune synchronisation.
- **Périmètre technique** :
  - projet Supabase de préproduction (Free, région UE) **créé par l'utilisateur** ;
  - SMTP personnalisé ; flux PKCE ; CSP stricte ;
  - auto-hébergement de JSZip et de supabase-js (fin des CDN externes) ;
  - hébergement web statique (HTTPS) ;
  - stockage chiffré des jetons Android ; `allowBackup` réglé ; App Links.
- **Dépendances** : 3.1. **Décisions préalables** : fournisseur, région, SMTP, hébergeur, plugin de stockage sécurisé (§ F du rapport).
- **Changements de données** : `panel-sync/state` (liaison du compte) ; profil local lié, jamais supprimé.
- **Risques** : XSS → vol de jeton (d'où la CSP) ; e-mails classés comme spam ; App Links mal configurés.
- **Tests** : parcours d'authentification complets (Web, Android), CSP sans violation dans la suite existante, énumération de comptes impossible, déconnexion qui conserve les données.
- **Critères d'acceptation** : 28 tests et plus au vert ; aucune violation CSP ; aucune clé de service dans le client ; jetons Android hors de localStorage.
- **Livrables** : écran Compte, module `panel-cloud-auth.js`, configuration de l'hébergement, runbook « créer un projet ».
- **Validation utilisateur** : création d'un compte de test, connexion sur deux appareils, réinitialisation du mot de passe.

## Lot 3.3 — Profils, préférences, appareils
- **Objectifs** : profil minimal, préférences synchronisées, liste des appareils.
- **Périmètre fonctionnel** : nom affiché, langue, marché préféré ; préférences (thème, vue, sons, haptique, lecture) ; liste des appareils avec révocation ; confidentialité « tout privé ».
- **Périmètre technique** : `profiles`, `user_settings`, `devices` ; **rôles serveur** `app.staff_roles` et `app.has_role()` (prérequis d'Explorer 2.0, voir [`../phase4/01-analyse-et-impacts.md`](../phase4/01-analyse-et-impacts.md) § 3), attribués manuellement, **sans aucun accès aux données personnelles** (`app.*`), tests de frontière à l'appui (voir [`../phase4/02-frontieres-collection-explorer.md`](../phase4/02-frontieres-collection-explorer.md), A10) ; premier usage réel de `sync_push`/`sync_pull` sur une seule entité simple (`user_settings`).
- **Dépendances** : 3.2.
- **Changements de données** : préférences locales copiées dans `user_settings` ; localStorage conservé.
- **Risques** : boucle d'écriture entre appareils (préférences) → HLC et comparaison de valeur.
- **Tests** : modification sur A visible sur B ; révocation de B ; mode hors ligne.
- **Critères d'acceptation** : aucune préférence perdue ; appareil révoqué refusé par le serveur.
- **Livrables** : écran Profil et Appareils, fonctions SQL, tests.
- **Validation utilisateur** : deux appareils, changement de thème, révocation.

## Lot 3.4 — Moteur de synchronisation et première migration
- **Objectifs** : synchroniser la collection (exemplaires, wishlist), les emplacements, la pull list, les séries suivies et la progression de lecture ; migrer une collection existante **sans perte**.
- **Périmètre fonctionnel** : assistant de migration en sept étapes (`04` § 6) ; indicateur d'état de synchronisation ; journal.
- **Périmètre technique** :
  - base `panel-sync` (outbox, shadow, state, conflicts, journal) ;
  - capture des changements par différence ; générateur `newId(prefix)` ;
  - `sync_push`, `sync_pull`, pagination, retries, verrou multi-onglets ;
  - garde-fou anti-cataclysme ; vérification d'intégrité.
- **Dépendances** : 3.3.
- **Changements de données** : correction prévisualisée des identifiants manquants ou en double ; aucune modification de `panel-catalog`.
- **Risques** : **principal risque de la phase** (perte ou duplication) ; performance avec 10 000 exemplaires ; quota localStorage.
- **Tests** :
  - unitaires (diff, fusion à trois branches, idempotence) ;
  - intégration (deux clients simulés et une base de test) ;
  - migration de jeux de 0, 1, 500 et 10 000 exemplaires ;
  - coupure réseau en plein envoi ; reprise ; double envoi.
- **Critères d'acceptation** :
  - migration vérifiée (comptes, identifiants, empreintes, relations) à 100 % ;
  - aucune double application après une réponse perdue ;
  - 10 000 exemplaires en moins de 2 minutes ;
  - mode local intact sans compte.
- **Livrables** : `panel-sync.js`, assistant de migration, fonctions SQL, tests, runbook.
- **Validation utilisateur** : migration de **sa vraie collection** après une sauvegarde JSON, puis vérification sur un deuxième appareil.

## Lot 3.5 — Conflits, multi-appareils, robustesse
- **Objectifs** : appliquer les règles de conflit par domaine et les rendre visibles et résolubles.
- **Périmètre fonctionnel** : centre des conflits (garder / prendre l'autre valeur / restaurer) ; corbeille de 30 jours ; doublons probables de wishlist.
- **Périmètre technique** : fusion par champ, HLC, résurrection sur modification, union de l'historique de lecture, resynchronisation complète au-delà de 90 jours.
- **Dépendances** : 3.4.
- **Changements de données** : `sync_conflicts` exploitée ; aucun écrasement.
- **Risques** : complexité de l'interface ; résurrections perçues comme des bugs.
- **Tests** : les cinq cas de conflit imposés et tous les scénarios multi-appareils de `04` § 7, automatisés.
- **Critères d'acceptation** : **aucune perte silencieuse** dans tous les scénarios ; chaque conflit est traçable et réversible.
- **Livrables** : centre des conflits, corbeille, tests de scénarios.
- **Validation utilisateur** : scénarios scriptés exécutés sur deux appareils.

## Lot 3.6 — Sauvegardes, restauration, sécurité, RGPD
- **Objectifs** : protéger contre le sinistre et respecter les droits des personnes.
- **Périmètre fonctionnel** : « Mes données » (export complet, intégrité), suppression de compte, politique de confidentialité.
- **Périmètre technique** :
  - `export_my_data()` ; Edge Function de suppression de compte ;
  - export logique hebdomadaire chiffré hors fournisseur ;
  - purge planifiée (pierres tombales, `sync_ops`) ;
  - runbook d'incident ; audit de sécurité (RLS, advisors Supabase) ; limitation de débit sur les fonctions RPC.
- **Dépendances** : 3.4 (export), 3.5 (purge). **Passage en Pro avant tout utilisateur réel** (sauvegardes) : décision financière.
- **Changements de données** : purge des pierres tombales de plus de 90 jours (**action destructive à faire approuver**).
- **Risques** : suppression de compte incomplète ; restauration jamais testée.
- **Tests** : restauration réelle d'une sauvegarde dans un projet de test ; suppression de compte vérifiée table par table ; tests RLS rejoués.
- **Critères d'acceptation** : restauration testée et chronométrée ; export conforme ; suppression totale vérifiée ; liste juridique (`05` § 4.4) **traitée par un professionnel**.
- **Livrables** : fonctions, runbooks, documents juridiques (rédigés ou validés par un tiers).
- **Validation utilisateur** : export, suppression d'un compte de test, lecture des documents.

## Lot 3.7 — Validation complète et préparation de la Phase 4
- **Objectifs** : stabiliser sur le Web et Android, bêta fermée ; remettre à la Phase 4 (Explorer 2.0) une base comptes, permissions et sauvegardes stable.
- **Périmètre** : tests de bout en bout sur les deux plateformes ; performances ; accessibilité des nouveaux écrans ; build Android signé ; observabilité minimale (erreurs de synchronisation) ; liste des prérequis de la Phase 4 (Explorer 2.0 ; Community viendra ensuite comme domaine indépendant).
- **Dépendances** : 3.1 à 3.6.
- **Risques** : différences de WebView ; mises à jour de l'application avec une outbox non vide.
- **Tests** : matrice Web (Edge, Chrome, Firefox) × Android (minSdk 24 à 36) ; mise à jour avec outbox pleine.
- **Critères d'acceptation** : aucune régression locale ; bêta fermée de 5 à 10 utilisateurs sans perte de données pendant 2 semaines.
- **Livrables** : rapport de validation, notes de version, plan de la Phase 4 (Explorer 2.0 ; Community vient ensuite comme domaine indépendant).
- **Validation utilisateur** : clôture de la Phase 3.

---

## Risques transverses
| Risque | Effet | Parade |
|---|---|---|
| Perte ou duplication de données pendant la synchronisation | Critique | Sauvegardes avant chaque étape, vérification d'intégrité, garde-fou anti-cataclysme, conflits conservés |
| Mutations dispersées dans `index.html` | Changements non capturés | Capture par différence au moment de la persistance, plutôt que par instrumentation de chaque mutation |
| Fichier unique de 12 850 lignes | Régressions, revue difficile | Code de la Phase 3 dans des fichiers séparés (`panel-cloud-*.js`), sans bundler |
| Sécurité du client (XSS, jetons) | Compromission de compte | CSP stricte avant le lot 3.2, stockage chiffré sur Android, fin des CDN |
| Coûts | Engagement financier | Free jusqu'au lot 3.5 ; Pro (25 $/mois) avant tout utilisateur réel ; plafond de dépenses activé |
| Licences (Comic Vine, couvertures) | Juridique | Pas de catalogue partagé ; avis juridique avant la bêta |
| RGPD | Juridique | Liste `05` § 4.4 validée par un professionnel |
| Dépendance au fournisseur | Stratégique | Postgres standard, protocole Panel, exports logiques |
| Absence de Docker en local | Tests incomplets | PGlite d'abord, puis Supabase local quand c'est possible |
