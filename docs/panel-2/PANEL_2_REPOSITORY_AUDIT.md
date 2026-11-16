# PANEL 2.0 — Audit du dépôt

Audit réalisé le 14 novembre 2026 sur la branche `main` locale, au commit `cf43513` (D-76). Méthode : lecture du code, de l'historique Git, de la documentation et exécution des tests. Aucune modification applicative n'a été faite pendant l'audit.

Convention : chaque constat renvoie à un fichier, une fonction, une table ou un test. Ce qui n'a pas pu être vérifié est marqué **À VÉRIFIER** ou **inconnu**.

## 1. Architecture technique réelle

| Élément | Constat | Preuve |
|---|---|---|
| Client | Application monopage en JavaScript sans framework, dans un seul fichier (21 802 lignes) | `index.html` (IIFE, CSS et HTML inclus) |
| Logique métier pure | 20 modules sans DOM ni réseau, testés à part et recopiés dans `index.html` par un script | `domains/**`, `scripts/sync-domains.js` (liste `MODULES`), accès `window.PanelDomains.<nom>` |
| Hors ligne | PWA avec service worker et précache | `sw.js` (`VERSION`), `manifest.webmanifest` |
| Android | Coque Capacitor qui embarque le même client | `android-app/` (`capacitor.config.json`, `build-www.js`, `build-apk.js`) |
| Relais local | Serveur Node sans dépendance : fichiers statiques et relais vers des sources externes (clés gardées côté serveur) | `serve.js` : `/api/gcd/*`, `/api/metron/*`, `/api/cv/*`, `/api/bnf/editions`, `/api/wd/entity`, actualités RSS |
| Stockage client | `localStorage` (≈ 75 clés `panel_*`) et deux bases IndexedDB | `panel-library` (v3 : `singles`, `pages`, `backups`, `snapshots`, `meta`) ; `panel-catalog` (v4 : `publishers`, `series`, `issues`, `variants`, `copies`, `publications`, `pulls`, `editorial`, `readprog`), `CATALOG_DB_VERSION` dans `index.html` |
| Backend | Supabase (Postgres, RLS, Edge Functions) **préparé**, projet de préproduction créé ; **le client n'y est pas encore connecté** | `backend/supabase/migrations/` (13 migrations), `backend/supabase/functions/delete-account`, `backend/sync-engine/` ; `index.html` ne contient aucune référence à Supabase |
| Dépendances d'exécution | Aucune côté client ; une seule dépendance de développement | `package.json` (`@electric-sql/pglite` pour tester le SQL) |
| Dépôt | Local, sans remote ; 80 commits | `git remote -v` vide, `git log` |
| CI/CD | **Absente** (aucun dossier `.github`, aucun pipeline) ; les contrôles sont lancés à la main | `npm run test:all` |
| Internationalisation | **Absente** : textes en français écrits en dur, dates en `fr-FR` | `index.html` (≈ 50 occurrences de `'fr-FR'`) |

### Schéma serveur existant (Supabase)

| Schéma | Tables | Migration |
|---|---|---|
| `app` | `profiles`, `user_settings`, `devices`, `copies`, `locations`, `pulls`, `series_follows`, `reading_progress`, `reading_states`, `user_sync_state`, `sync_ops`, `sync_conflicts`, `staff_roles`, `staff_role_log`, `service_limits` | 0001 à 0012 |
| `community` | `members`, `posts`, `follows`, `blocks`, `reactions`, `reports`, `moderation_log`, `rate_events`, `limits` | 0013 (appliquée en préproduction, D-74) |

Les schémas `catalog`, `editorial`, `moderation`, `notify` et `billing` sont **proposés** dans [`../prd/PANEL_DATA_MODEL.md`](../prd/PANEL_DATA_MODEL.md), **pas créés**.

### Tests et contrôles

| Contrôle | Volume | Commande |
|---|---|---|
| Base de données (PGlite) | 135 tests | `npm run test:db` |
| Modules de domaine | 113 tests | `npm run test:domains` |
| Interface (Edge sans interface, CDP) | 60 tests de bout en bout | `node run-all-tests.js` |
| Frontières entre domaines | Explorer ne lit pas Collection, etc. | `node scripts/check-boundaries.js --strict` |
| Code mort | 0 déclaration morte | `node scripts/check-dead-code.js` |
| Secrets | 0 correspondance | `npm run check:secrets` |
| Modules recopiés identiques à la source | 20 modules | `node scripts/sync-domains.js --check` |

État constaté le 14 novembre 2026 : tests de base, de domaines et contrôles au vert. La suite d'interface est **instable sur une machine saturée** : une passe complète à 58 sur 60 (le test 39, corrigé ensuite), puis des passes interrompues par le délai global de 900 s quand IndexedDB ne répond plus dans Edge sans interface. Le même blocage se produit sur le commit D-75 : il ne vient pas d'une régression fonctionnelle. Voir la dette technique T-04.

## 2. Matrice de l'existant

Statuts : EXISTANT ET FONCTIONNEL · EXISTANT MAIS PARTIEL · EXPÉRIMENTAL · ABSENT · À VÉRIFIER.

| Domaine | État vérifié | Preuves dans le dépôt | Limites | Évolution recommandée |
|---|---|---|---|---|
| Collection (exemplaires, variantes) | EXISTANT ET FONCTIONNEL | `panel_physical_singles`, store IndexedDB `singles` ; lot 2.2 (`0aca044`) ; tests 6, 25 | Les variantes connues dépendent des sources interrogées ; l'utilisateur signale que **toutes les variantes d'un numéro n'apparaissent pas** (14 novembre 2026) — À VÉRIFIER source par source (GCD `/api/gcd/issues`, Metron) | Edition Intelligence : liste exhaustive des variantes par numéro, avec sa source |
| Emplacements physiques | EXISTANT ET FONCTIONNEL | lot 2.3 (`1de33e8`) ; `domains/collection/boxes-core.js` ; test 26 | — | Aucune |
| Cote et finances | EXISTANT ET FONCTIONNEL | `panel_value_snapshots`, `panel_acquisitions`, `panel_fin_budget` ; tests 12, 30, 37 | Pas de source de prix de marché publique | Hors PANEL 2.0 |
| Gradation (CGC) | EXISTANT ET FONCTIONNEL | ≈ 30 occurrences de `CGC` dans `index.html` | L'utilisateur demande de retirer cet aspect de l'application (14 novembre 2026) | Masquer dans l'interface sans supprimer les données (hors mission d'audit) |
| Import/export | EXISTANT ET FONCTIONNEL | CLZ, League of Comic Geeks (CSV, `.xlsx`), tableur ; tests 13, 14, 59 | — | Format d'échange ouvert (Open) |
| Scanner, reconnaissance | EXISTANT ET FONCTIONNEL | code-barres 17 chiffres, ISBN ; dHash de couverture ; tests 2 à 5, 19 | — | Réutilisable pour l'identification d'éditions (IA locale) |
| Catalogue normalisé | EXISTANT ET FONCTIONNEL (local) | `panel-catalog`, `domains/catalog/publication-core.js` ; test 24, test 52 « catalogue commun » | Local à l'appareil ; pas de catalogue partagé | Schéma serveur `catalog` (PRD), socle d'Edition Intelligence |
| Provenance et conflits de données | EXISTANT ET FONCTIONNEL | lot 2.5 (`29b9b2a`) ; test 28 ; test 45 (centre des conflits) | Provenance au niveau du champ d'un exemplaire, pas au niveau d'une affirmation documentaire | Socle de Source |
| Lecture | EXISTANT ET FONCTIONNEL | `panel_reading_v1`, `domains/reading/*` ; tests 37, 59 | Pas de lecture de contenus (retirée en phase 1) | Signal (tendances de lecture agrégées, avec consentement) |
| Sorties, calendrier, Pull List, Wishlist | EXISTANT ET FONCTIONNEL | `domains/releases/*` ; tests 27, 41 ; D-75 (mercredi, francophonie) | Pas de données VF exhaustives | Edition Intelligence (dates par territoire) |
| Explorer (catalogue, guides, recherche) | EXISTANT ET FONCTIONNEL | `domains/explorer/catalog-core.js` (15 types d'entités, 20 types de relations) ; tests 29, 38, 43, 47 à 49 | Contenu limité ; page jugée « trop brouillonne » par l'utilisateur (14 novembre 2026) | Reste le point d'entrée de la connaissance ; Source, Canon, Multiverse s'y affichent |
| Fiches événement et niveaux | EXISTANT ET FONCTIONNEL | `events-seed.js` (8 événements), `event-levels.js` ; tests 48, 53 | Couverture faible | Canon |
| Affirmations documentées (Source, D-81) | EXISTANT MAIS PARTIEL (local) | `domains/source/claims-core.js` ; section « Affirmations et preuves » des guides d'Explorer ; test 64 | Pas de relecture partagée avant les comptes | Premier incrément de Source |
| Niveaux d'édition et certitude VO/VF (D-81) | EXISTANT MAIS PARTIEL (local) | `domains/catalog/edition-core.js` ; fiche publication ; test 64 | Contenus des recueils non détaillés | Premier incrément d'Edition Intelligence |
| Recoupement documentaire | EXISTANT MAIS PARTIEL | `events-crossref.js` (D-51) : sources distinctes, divergences conservées et non tranchées, statut « non vérifié » ; test 51 | Données saisies à la main, limitées aux événements | **Prototype direct de Source** |
| Références visuelles et droits | EXISTANT ET FONCTIONNEL | `domains/explorer/media-core.js` : `VERIFICATION` (`verified`, `user_confirmed`, `unverified`, `disputed`), droits d'affichage par référence ; test 43 | Limité aux images | Vocabulaire de vérification à réutiliser dans Source |
| Atlas cosmique Marvel | EXPÉRIMENTAL (D-75) | `data/cosmos-marvel.json` (301 fiches, niveaux de fiabilité), pages `cosmos`, `cosmos-e` d'Explorer | **PANEL ATLAS est abandonné** ; l'utilisateur ne veut garder que les cartes des cosmos et multivers | Données reprises comme relations documentées de Canon ; voir DR-01 |
| Actualités | EXISTANT ET FONCTIONNEL | `serve.js` (RSS, 120 articles par langue), `domains/explorer/news-core.js` (apprentissage local) ; test 56 | Dépend du relais local | Signal (données externes, séparées) |
| Avant de voir (films et séries) | EXISTANT MAIS PARTIEL | `domains/explorer/watch-guides.js` (5 dossiers) | Pas de comparaison comics/adaptation | Socle de Multiverse |
| Statistiques personnelles | EXISTANT ET FONCTIONNEL | `domains/collection/stats-core.js`, `insights-core.js`, `domains/reading/reading-stats.js` | Personnelles seulement | Signal (agrégats consentis) |
| Communauté locale (planches, stories, fil) | EXISTANT MAIS PARTIEL | `panel_community_drafts_v1`, `panel_stories_v1`, `domains/community/feed-core.js` (D-76) ; tests 39, 42, 46, 60 | Rien n'est publié : aucun service configuré (`COMMUNITY_API.publish` → `not_configured`) | Ouverture des comptes (lots 3.2, 3.3) |
| Politique de partage et modération | EXISTANT MAIS PARTIEL | `domains/community/policy-core.js` ; migration 0013 ; `backend/tests/community.test.js` | Pas d'interface de modération | Gouvernance de Source, Debate, Lab |
| Rangs, trophées, artefacts | EXISTANT ET FONCTIONNEL (local) | `ranks-core.js`, `trophies-core.js`, `artefacts-core.js` | Récompensent la collection et la lecture, **pas la qualité des contributions** | ID ne doit pas les réutiliser comme réputation |
| Débats en direct | EXISTANT MAIS PARTIEL (mis à jour après l'audit) | `docs/LIVE-DEBATS.md` ; studio de direct `domains/community/live-core.js` (D-78), pages de la galerie (D-79) ; tests 61 et 62 | Répétition seul sur l'appareil ; le salon à plusieurs exige comptes et serveur audio | Debate (asynchrone d'abord) |
| Théories | EXPÉRIMENTAL, hérité | clé `panel_theories` conservée lors du retrait du numérique (`DIGITAL_LS_KEYS`) ; aucune interface | Données éventuelles conservées, non affichées | À VÉRIFIER : contenu réel chez l'utilisateur ; possible point de départ de Lab |
| Comptes, profils, appareils | EXISTANT MAIS PARTIEL | migrations 0002, 0010 ; `backend/tests/roles.test.js` | Côté serveur seulement ; aucun écran de connexion | Prérequis de toute contribution |
| Synchronisation | EXISTANT MAIS PARTIEL | `backend/sync-engine/engine.js`, migrations 0004, 0008, 0011 ; `sync.test.js`, `conflicts.test.js` | Non branchée au client | Prérequis |
| RGPD (export, purge, suppression) | EXISTANT MAIS PARTIEL | migrations 0009, 0012 ; fonction `delete-account` ; `privacy.test.js`, `delete-account.test.js` | Côté serveur seulement | À étendre aux contributions documentaires |
| Sauvegardes par domaine | EXISTANT ET FONCTIONNEL | `P.backup`, contrats `PERSONAL_CONTRACTS_V1` ; tests 22, 31, 32, 42 | Local | Réutiliser pour les exports de données personnelles |
| Notifications | EXISTANT MAIS PARTIEL | `panel_notifs_v1` ; test 54 | Locales | Schéma `notify` proposé |
| API publique, SDK, webhooks | ABSENT | `serve.js` est un relais local, pas une API publique | — | Open |
| Paiement, offres | ABSENT | schéma `billing` proposé dans le PRD | — | Modèle économique |

## 3. Réutilisations identifiées pour PANEL 2.0

| Besoin PANEL 2.0 | Brique existante à réutiliser | Où |
|---|---|---|
| Statut de vérification d'une information | `VERIFICATION` (`verified`, `user_confirmed`, `unverified`, `disputed`) | `domains/explorer/media-core.js` |
| Sources multiples et divergences conservées | Modèle `CROSSREF` (une entrée par source, divergences `D(topic, text, sourceIds)`) | `domains/explorer/events-crossref.js` |
| Entités et relations typées | `KINDS`, `RELATION_TYPES` (`edition_of`, `collects`, `translation_of`, `appears_in`, `first_appearance`…) | `domains/explorer/catalog-core.js` |
| Provenance par champ, conflits | Moteur de provenance du lot 2.5, centre des conflits | `index.html` (tests 28, 45) |
| Niveaux de fiabilité | `CZ_CERT` de l'atlas, `event-levels.js` (niveaux justifiés) | `index.html`, `domains/explorer/event-levels.js` |
| Publier sans exposer le privé | Liste blanche et validation | `domains/community/policy-core.js` |
| Modération, signalements, limites | Tables `community.reports`, `moderation_log`, `rate_events`, `limits` | migration 0013 |
| Rôles du personnel | `app.staff_roles`, `staff_role_log` | migration 0010 |
| Frontières entre domaines | Contrats S1 à S6, contrôle statique | `docs/phase4/05-contrats-s1-s6.md`, `scripts/check-boundaries.js` |
| Recherche tolérante (accents, fautes) | Recherche locale d'Explorer | `catalog-core.js` ; côté serveur, `pg_trgm` + `unaccent` prévus (PRD-D5) |
| Identification d'une couverture | dHash et code-barres | `index.html` (tests 4, 19) |

## 4. Dette technique

| ID | Dette | Preuve | Effet sur PANEL 2.0 |
|---|---|---|---|
| T-01 | Client monolithique de 21 802 lignes | `index.html` | Chaque nouveau module alourdit le chargement et la relecture ; la logique pure doit continuer d'aller dans `domains/**` |
| T-02 | Client non connecté au backend | aucune référence à Supabase dans `index.html` | Bloque toute contribution, tout débat, toute réputation : **prérequis n° 1** |
| T-03 | Pas d'internationalisation | textes et formats écrits en dur | À préparer avant l'ouverture hors francophonie |
| T-04 | Suite d'interface longue (≈ 11 min) et sensible à la charge de la machine ; délai global de 900 s | `run-all-tests.js` ; blocages IndexedDB observés le 14 novembre 2026, y compris sur D-75 | Ralentit la validation ; découper la suite et ajouter une CI |
| T-05 | Pas de CI, pas de remote | dépôt local | Aucun contrôle automatique avant fusion |
| T-06 | Documentation de `domains/README.md` périmée (« non branchés ») | `domains/README.md` | À mettre à jour hors mission d'audit |
| T-07 | Données éditoriales saisies dans le code | `events-seed.js`, `events-crossref.js`, `watch-guides.js` | Ne passe pas à l'échelle : il faut un stockage documentaire (Source) |
| T-08 | Lenteurs ressenties signalées par l'utilisateur | demande du 14 novembre 2026 | À mesurer (profilage) avant d'ajouter des modules ; **inconnu** à ce stade |

## 5. Ce que l'audit n'a pas pu vérifier

- Le contenu réel des données de l'utilisateur (clé `panel_theories`, ampleur des variantes manquantes) : l'audit ne lit pas les données personnelles.
- L'état de la base de préproduction Supabase au-delà de la migration 13.
- Les performances mesurées sur l'appareil de l'utilisateur (aucun profilage fait).
- Les licences exactes de chaque source externe pour un usage public (BnF, Wikidata, Metron, GCD, Comic Vine, Marvel Database) : à confirmer par source avant toute ouverture.
