# PANEL — Architecture technique

Date : 13 novembre 2026. Statut : proposé (D-58). Ce document part de l'architecture **réellement en place** et ne propose un changement que s'il est nécessaire et argumenté. Références : [`phase3/02-architecture-cible.md`](../phase3/02-architecture-cible.md) (choix Supabase, D-03), [`phase3/04-synchronisation.md`](../phase3/04-synchronisation.md), [`phase4/02-frontieres-collection-explorer.md`](../phase4/02-frontieres-collection-explorer.md) (frontières), [`phase4/07-architecture-images-r2.md`](../phase4/07-architecture-images-r2.md) (images).

## 1. Architecture réelle (vérifiée)

```
┌──────────────────────── Client (local-first) ────────────────────────┐
│ index.html (17 384 lignes, HTML + CSS + JS vanilla, IIFE)            │
│  ├─ Hôte d'interface : navigation, rendu, routeur de vues            │
│  ├─ Domaines purs intégrés par scripts/sync-domains.js :             │
│  │    catalog/publication-core · explorer/catalog-core · media-core  │
│  │    event-levels · events-seed · events-crossref                   │
│  │    community/policy-core                                          │
│  ├─ API publique de test : window.Panel                              │
│  ├─ Stockage : localStorage (59 clés panel_*) + IndexedDB            │
│  │    (panel-catalog, panel-library), instantanés, corbeille         │
│  └─ Sources : Comic Vine (clé utilisateur), Metron (compte           │
│       utilisateur), import fichiers ; relais serve.js / Android      │
│ Distribution : PWA (sw.js, manifest) · Android Capacitor (APK 1.2)   │
└──────────────────────────────────────────────────────────────────────┘
┌──────────── Backend préparé, NON déployé (backend/supabase) ─────────┐
│ Postgres : schéma app (12 migrations), RLS, déclencheurs de révision │
│ RPC api.* : sync_push/pull, export/delete_my_data, profils, réglages,│
│   appareils, conflits, rôles                                         │
│ Edge Function : delete-account                                       │
│ Moteur de synchronisation client : backend/sync-engine               │
│ Tests : PGlite (124), sans Docker                                    │
└──────────────────────────────────────────────────────────────────────┘
```

Il n'existe **ni Next.js, ni React, ni TypeScript, ni Tailwind, ni Stripe, ni moteur de recherche serveur** dans le dépôt. La pile cible indiquée dans la mission est donc évaluée ci-dessous technologie par technologie.

## 2. Évaluation de la pile proposée

| Technologie proposée | Existant | Recommandation | Justification |
|---|---|---|---|
| Next.js + React | Non (vanilla JS) | **Ne pas migrer** (confirmé par l'utilisateur le 13 novembre 2026) ; possible plus tard pour un site public séparé (PRD-D3) | Réécrire 17 000 lignes testées n'apporte rien à l'utilisateur ; le local-first et l'APK fonctionnent sans rendu serveur. Seul argument fort : le SEO des pages publiques (profils, fiches) → petite application séparée lisant les mêmes API |
| TypeScript | Non | **Adoption progressive** : JSDoc typé + `// @ts-check` dans `domains/**`, puis `.ts` pour les Edge Functions | Bénéfice réel sans build pour le client ; les Edge Functions Supabase sont déjà en TypeScript (`delete-account/index.ts`) |
| Tailwind CSS | Non (CSS à variables, mode sombre D-53) | **Ne pas adopter** dans le client actuel | Le design system existe en jetons CSS (`:root`, `data-mode`) ; Tailwind exigerait un build. À envisager seulement pour l'application publique Next.js |
| PostgreSQL / Supabase | Oui (préparé) | **Garder** (D-03) | 12 migrations, RLS, 124 tests |
| Supabase Auth | Oui (prévu) | **Garder** | Intégré à RLS ; e-mail, lien magique, OAuth |
| Cloudflare R2 | Spécifié (D-04) | **Garder** | Pas de frais de sortie ; images autorisées et téléversements |
| Vercel | Non | **Cloudflare Pages recommandé** pour le client statique ; Vercel si une application Next.js est créée | Cohérence avec R2 et un seul fournisseur réseau ; les deux sont acceptables (Q3) |
| Stripe | Non | **Adopter** en Phase 6 | Billing, Checkout, portail client, SCA |
| Moteur de recherche | Recherche locale tolérante (D-33) | **Postgres FTS + pg_trgm + unaccent** d'abord ; Meilisearch/Typesense plus tard | Évite un service de plus ; seuils de bascule : > 1 M fiches ou p95 > 300 ms |

## 3. Architecture cible (monolithe modulaire)

```
Clients
 ├─ App PANEL (index.html + domains/**) — PWA + Android Capacitor   [existant, étendu]
 └─ Site public (optionnel, Phase 5) — Next.js en lecture seule      [proposé]
        │ HTTPS (JWT Supabase)
        ▼
Supabase (région UE)
 ├─ Auth (GoTrue)
 ├─ Postgres
 │   ├─ app        : comptes, profils, réglages, appareils, rôles, données personnelles synchronisées [existant]
 │   ├─ catalog    : éditeurs, séries, numéros, éditions, variantes, identifiants, provenance          [proposé]
 │   ├─ editorial  : événements, liens, ordres de lecture                                             [proposé]
 │   ├─ community  : publications, commentaires, réactions, abonnements, groupes, challenges          [proposé]
 │   ├─ moderation : signalements, décisions, recours, blocages                                        [proposé]
 │   ├─ notify     : notifications, préférences, jetons push                                           [proposé]
 │   └─ billing    : clients, abonnements, droits (miroir Stripe)                                      [proposé]
 ├─ API : PostgREST (lecture sous RLS) + RPC api.* (écritures métier) + Edge Functions
 ├─ Edge Functions : delete-account [existant], stripe-webhook, push-dispatch, ingest-releases,
 │                  moderation-autocheck, media-sign-upload                                             [proposé]
 ├─ Realtime : compteurs de notifications (optionnel)
 └─ Cron (pg_cron) : purge RGPD [existant], ingestion planifiée, résumé hebdomadaire                  [proposé]
Cloudflare R2 : images (couvertures autorisées, avatars, images de publications) via URL signées
Stripe : Checkout, Billing, portail client → webhook → billing.*
FCM / Web Push : notifications push
```

**Pourquoi pas de microservices (PRD-D8).** Équipe de 1 à 3 personnes ; un seul Postgres garantit l'intégrité référentielle (une publication communautaire référence `catalog.issue.id`) ; les domaines sont séparés par **schémas** et contrôlés par `check-boundaries`. Une extraction future (ex. recherche, notifications) reste possible car chaque domaine passe par ses propres RPC.

## 4. Frontend

- **Hôte actuel conservé.** Nouvelles vues (Fil, Profil, Groupes, Notifications, Compte, Abonnement) ajoutées comme vues du routeur existant (`showSinglesView`, `registerHostedView`, `registerViewHooks`).
- **Logique métier dans `domains/**`** (testable sous Node), intégrée par `sync-domains`. Nouveaux domaines prévus : `domains/community/feed-core.js`, `domains/notify/notify-core.js`, `domains/billing/entitlements-core.js`.
- **Réduction de la dette du monofichier** (PB-3), sans réécriture : à chaque lot, extraire au moins un bloc métier vers `domains/**` ; objectif < 12 000 lignes dans `index.html` à la fin de la Phase 3. Option à évaluer en Phase 1 : découper le CSS et le JS en fichiers statiques chargés par `index.html` (sans build), si l'APK et le service worker le supportent.
- **Hors ligne.** Le service worker reste versionné ; les fonctions sociales affichent un état « hors ligne » et mettent en file les brouillons.
- **Design.** Jetons CSS existants, mode clair/sombre/système (D-53) ; voir [`PANEL_UX_UI_SPECIFICATION.md`](PANEL_UX_UI_SPECIFICATION.md).

## 5. Backend

- **Écritures métier par RPC `api.*`** (SECURITY DEFINER, contrôles explicites, limites de débit), comme les RPC existantes. Lectures simples par PostgREST sous RLS.
- **Edge Functions** pour ce qui touche un tiers (Stripe, FCM, R2, sources de catalogue) ou des secrets.
- **Idempotence** : toute RPC d'écriture accepte un `client_op_id` (déjà le cas pour `sync_push`).

## 6. API

Contrats détaillés : [`PANEL_API_SPECIFICATION.md`](PANEL_API_SPECIFICATION.md). Versionnement : préfixe de schéma `api` (v1 implicite) ; une rupture crée `api_v2.*` et l'ancienne version reste servie 6 mois.

## 7. Authentification

Supabase Auth : e-mail + mot de passe (règles de robustesse), lien magique, OAuth Google et Apple (Apple obligatoire si Google est proposé sur iOS ; iOS non prévu à court terme). Jetons JWT courts (1 h) + jeton de rafraîchissement ; sur Android, stockage sécurisé (Keystore) — prérequis du lot 3.2 (`allowBackup`). CAPTCHA (Turnstile ou hCaptcha) à l'inscription (décision Phase 3 ouverte).

## 8. Autorisations

| Niveau | Mécanisme |
|---|---|
| Données personnelles | RLS `user_id = auth.uid()` [existant] |
| Contenus communautaires | RLS selon `visibility` + blocages + statut de modération ; fonctions `policy-core.canView/canEdit/canModerate` reproduites en SQL et testées des deux côtés |
| Rôles du personnel | `app.staff_roles` + `app.has_role()` [existant], journal `staff_role_log` |
| Droits d'offre | `billing.entitlements` lu par les RPC ; jamais décidé par le client |

## 9. Stockage

| Donnée | Lieu |
|---|---|
| Données personnelles | Appareil (référence), Postgres `app.*` si synchronisées |
| Catalogue, éditorial, communauté | Postgres |
| Images | R2 ; base : chemin, dimensions, hachage, licence, propriétaire |
| Secrets | Variables d'Edge Functions ; jamais dans le dépôt (`check-secrets`) |

## 10. Recherche

Phase 1 à 4 : `tsvector` (configuration `french_unaccent` + `simple` pour les titres anglais), `pg_trgm` pour la tolérance aux fautes, index GIN ; requêtes via RPC `api.search(q, types, limit, cursor)`. Le client garde sa recherche locale (D-33) pour la collection personnelle. Bascule vers Meilisearch/Typesense documentée si les seuils du § 2 sont dépassés.

## 11. Notifications

Table `notify.notifications` alimentée par des déclencheurs et RPC ; diffusion par Edge Function `push-dispatch` (FCM pour Android, Web Push VAPID pour la PWA) ; e-mail transactionnel par un fournisseur SMTP UE (à choisir). Notifications de sorties d'abord **locales** (sans compte).

## 12. Observabilité

| Besoin | Outil proposé |
|---|---|
| Erreurs client | Sentry (région UE) ou équivalent, sans données personnelles, échantillonné, opt-in en bêta |
| Journaux serveur | Journaux Supabase + Edge Functions |
| Métriques produit | Événements anonymisés dans Postgres (`analytics.events`) ou PostHog UE ; consentement requis (voir sécurité) |
| Disponibilité | Sonde externe sur l'hébergement et `api.health()` |
| Alertes | Taux d'erreur RPC, file de modération > 48 h, webhooks Stripe en échec |

## 13. Sauvegardes

- Client : sauvegardes par domaine, instantanés, corbeille [existant].
- Serveur : plan Supabase avec sauvegardes quotidiennes + PITR dès la bêta publique ; export logique hebdomadaire chiffré vers R2 ; restauration testée chaque trimestre (runbook [`phase3/runbooks/sauvegarde-restauration.md`](../phase3/runbooks/sauvegarde-restauration.md)).

## 14. Stratégie de migration

1. **Migrations additives uniquement** sur les données utilisateurs ; jamais de `drop` sur une table peuplée sans copie et restauration vérifiée.
2. Numérotation continue après `20261110000012` ; chaque migration a un test PGlite.
3. Migration d'une collection locale vers le compte : instantané préalable, envoi par `sync_push`, vérification de comptage, retour arrière possible (scénarios V1 à V14).
4. Conversion des données locales vers des références catalogue (`issue.id`) : réversible, testée sur copie (critère R1 de D-54, déjà amorcée par D-55).
5. Les migrations existantes **ne sont pas modifiées** (règle de la mission).

## 15. Environnements

| Environnement | Usage |
|---|---|
| Local | `index.html` via `serve.js`, PGlite pour les tests |
| Préproduction | Projet Supabase séparé, hébergement de prévisualisation |
| Production | Projet Supabase UE, hébergement statique, R2, Stripe en mode réel |

Les clés de test et de production ne sont jamais mélangées ; Stripe en mode test en préproduction.
