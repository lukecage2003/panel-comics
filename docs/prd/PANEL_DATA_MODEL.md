# PANEL — Modèle de données

Date : 13 novembre 2026. Statut : proposé (D-58). Ce modèle **part du schéma existant** (`backend/supabase/migrations`, 12 migrations) et décrit les extensions nécessaires. Il complète le modèle catalogue de [`directeur/08-rebaseline-produit.md`](../directeur/08-rebaseline-produit.md) § 9, qu'il précise sans le contredire. Aucune migration n'est créée par ce document.

## 1. Conventions

- Identifiants : `uuid` (`gen_random_uuid()`) pour les entités serveur ; les données personnelles synchronisées gardent la clé **(user_id, id texte)** existante (identifiants clients `s_…`, `loc_…`, `pl_…`).
- Colonnes communes : `created_at`, `updated_at` (déclencheur `app.touch_updated_at`), `deleted_at` pour la suppression logique.
- Textes normalisés : colonne `*_norm` (minuscules, sans accents, espaces réduits) pour l'unicité et la recherche ; `citext` pour les pseudos.
- Suppressions : **logiques** par défaut ; purge physique seulement par les fonctions RGPD (`app.purge_due`, `app.delete_account`) ou après délai documenté.
- Clés étrangères : `on delete restrict` sur le catalogue (une fiche référencée ne disparaît pas) ; `on delete cascade` depuis `auth.users` pour les données personnelles (déjà en place).

## 2. Schéma existant (vérifié)

| Table | Clé | Rôle | Migration |
|---|---|---|---|
| `app.profiles` | `user_id` → `auth.users` | Pseudo (`handle` citext unique, 3-30 caractères), nom affiché, avatar, bio (≤ 1 000), langue, marché préféré | 2 |
| `app.user_settings` | `user_id` | Préférences, notifications, confidentialité (`profile_public: false` par défaut) | 2 |
| `app.devices` | `id` uuid | Appareils (web/android), dernière synchro, révocation | 2, 10 |
| `app.copies` | (`user_id`, `id`) | Exemplaires et wishlist (`data` jsonb ≤ 64 Kio, `field_revs`, `rev`, `deleted_at`, `series_key`, `issue_number`, `is_wishlist`) | 3 |
| `app.locations` | (`user_id`, `id`) | Emplacements (`parent_id`, `kind`) | 3 |
| `app.pulls` | (`user_id`, `id`) | Pull list par numéro | 3 |
| `app.series_follows` | (`user_id`, `id`) | Séries suivies | 3 |
| `app.reading_progress` | (`user_id`, `id`) | Progression (héritage) | 3 |
| `app.reading_states` | (`user_id`, `id`) | État de lecture par œuvre (L1) | 8 |
| `app.user_sync_state`, `app.sync_ops`, `app.sync_conflicts` | — | Synchronisation, idempotence (`op_id`), conflits par champ | 4, 11 |
| `app.staff_roles`, `app.staff_role_log` | (`user_id`, `role`) | Rôles `moderator`, `admin` et journal | 10 |
| `app.service_limits` | `key` | Limites de débit configurables | 12 |

Les données personnelles sont stockées en **jsonb versionné par champ** (`field_revs`) pour la synchronisation local-first ; ce choix est conservé. Les colonnes extraites (`series_key`, `issue_number`…) servent aux index.

## 3. Catalogue (schéma `catalog`, proposé)

### 3.1 Entités

| Table | Champs importants | Unicité / index |
|---|---|---|
| `catalog.universe` | `id`, `name`, `name_norm`, `publisher_id` (null si multi-éditeurs) | `unique(name_norm)` |
| `catalog.publisher` | `id`, `name`, `name_norm`, `country` (`US`, `FR`), `parent_id` (marque → éditeur), `is_comics` bool, `scope` (`in`/`out`) | `unique(name_norm)` ; `check(country in ('US','FR'))` pour les nouveaux éditeurs |
| `catalog.series` | `id`, `publisher_id` FK, `name`, `name_norm`, `volume`, `year_began`, `year_end`, `type` (`ongoing`,`limited`,`one_shot`,`collection`), `language`, `status`, `universe_id` | `unique(publisher_id, name_norm, year_began, type)` ; GIN trigram sur `name_norm` |
| `catalog.series_bond` | `from_series_id`, `to_series_id`, `kind` (`continues`,`renumbered`,`relaunch`) | `unique(from_series_id, to_series_id, kind)` |
| `catalog.issue` | `id`, `series_id` FK, `number` (texte), `number_sort` (numérique), `title`, `cover_date`, `store_date`, `foc_date`, `date_uncertain`, `price`, `currency`, `page_count`, `summary` | `unique(series_id, number)` ; index (`store_date`), (`foc_date`) |
| `catalog.variant` | `id`, `issue_id` FK, `name`, `name_norm`, `kind` (`standard`,`ratio`,`virgin`,`foil`,`convention`,`retailer`,`other`), `ratio`, `exclusive_to`, `upc`, `sku` | `unique(issue_id, name_norm)` ; `unique(upc) where upc is not null` |
| `catalog.edition` | `id`, `publisher_id`, `series_id` (série de recueil), `format` (`single`,`tpb`,`hc`,`omnibus`,`integrale`,`deluxe`,`kiosque`), `market` (`US`,`FR`), `language`, `isbn`, `store_date`, `price`, `currency` | `unique(isbn) where isbn is not null` |
| `catalog.edition_content` | `edition_id`, `issue_id`, `position` | PK (`edition_id`, `issue_id`) |
| `catalog.edition_relation` | `from_edition_id`, `to_edition_id`, `kind` (`translated_from`,`reprint_of`,`adaptation_of`,`collects`) | `unique(from, to, kind)` |
| `catalog.cover` | `id`, `variant_id` FK, `r2_path`, `width`, `height`, `phash`, `license` (`licensed`,`user_private`,`none`), `credit`, `source_url` | `unique(variant_id, phash)` |
| `catalog.creator` | `id`, `name`, `name_norm`, `aliases` text[] | `unique(name_norm)` |
| `catalog.credit` | `issue_id`, `creator_id`, `role` (`writer`,`artist`,`penciller`,`inker`,`colorist`,`letterer`,`cover`,`editor`) | PK (`issue_id`, `creator_id`, `role`) |
| `catalog.character` | `id`, `name`, `name_norm`, `universe_id`, `aliases` | `unique(name_norm, universe_id)` |
| `catalog.appearance` | `issue_id`, `character_id`, `kind` (`first`,`death`,`return`,`cameo`,`major`) | PK (`issue_id`, `character_id`) |
| `catalog.external_id` | `entity_type`, `entity_id`, `system` (`cv`,`metron`,`gcd`,`locg`,`upc`,`isbn`,`clz`), `value` | `unique(system, value)` ; index (`entity_type`, `entity_id`) |
| `catalog.claim` | `id`, `target_type`, `target_id`, `field`, `value` jsonb, `source`, `source_url`, `license`, `retrieved_at`, `status` (`noted`,`concordant`,`corroborated`,`verified`,`disputed`), `superseded_by` | index (`target_type`, `target_id`) |
| `catalog.alias` | `entity_type`, `old_id`, `new_id`, `merged_at`, `merged_by` | PK (`entity_type`, `old_id`) — conserve les identifiants fusionnés |
| `catalog.correction_request` | `id`, `reporter_id`, `target_type`, `target_id`, `field`, `proposed` jsonb, `status` (`open`,`accepted`,`rejected`), `reviewer_id` | index (`status`) |

### 3.2 Règles d'intégrité

- **Périmètre** : déclencheur refusant une `series` dont l'éditeur a `scope = 'out'` ou un format `manga`/`manhwa` (miroir de `publication-core.js`, D-54).
- **Fusion** : remplacer une fiche = créer une ligne `catalog.alias`, réaffecter les références, marquer l'ancienne `deleted_at` ; jamais de suppression physique d'une fiche référencée.
- **Couvertures** : `license = 'none'` → jamais servie publiquement ; `user_private` → visible par son propriétaire seulement.
- **Dates par territoire** : portées par `edition.market` + `edition.store_date` ; `issue.store_date` = date VO.

## 4. Éditorial (schéma `editorial`, proposé)

| Table | Champs | Unicité |
|---|---|---|
| `editorial.event` | `id`, `title`, `universe_id`, `publisher_id`, `period_start`, `period_end`, `context`, `consequences`, `status` | `unique(publisher_id, title_norm, period_start)` |
| `editorial.event_link` | `event_id`, `issue_id` (ou `series_id` + plage), `role` (`prelude`,`core`,`tie_in`,`epilogue`,`aftermath`,`related`), `level` (`essential`,`recommended`,`complete`), `justification` | `unique(event_id, issue_id)` |
| `editorial.reading_order` | `id`, `event_id`, `kind` (`publication`,`chronological`,`panel`,`external`), `version`, `author_id`, `status` | `unique(event_id, kind, version)` |
| `editorial.reading_order_item` | `order_id`, `issue_id`, `position`, `level`, `note` | PK (`order_id`, `position`) |

Le modèle local actuel (`media-core`, `event-levels`, D-49 à D-57) se convertit sans perte : `links` → `event_link`, `sources`/`verifications` → `catalog.claim`.

## 5. Communauté (schéma `community`, proposé)

| Table | Champs importants | Contraintes |
|---|---|---|
| `community.follow` | `follower_id`, `followee_id`, `status` (`active`,`pending`), `created_at` | PK (`follower_id`, `followee_id`) ; `check(follower_id <> followee_id)` |
| `community.block` | `blocker_id`, `blocked_id`, `created_at` | PK ; empêche follow, commentaire, mention dans les deux sens |
| `community.mute` | `user_id`, `target_user_id` ou `word`, `until` | — |
| `community.post` | `id`, `author_id`, `kind` (`post`,`review`,`list`,`share_copy`), `body` (≤ 5 000), `rating` (0-5 par 0,5), `spoiler` bool, `visibility` (`public`,`followers`,`group`), `group_id`, `target_type`, `target_id` (catalogue), `comments_enabled`, `status` (`published`,`hidden`,`removed`), `edited_at`, `deleted_at` | index (`author_id`, `created_at desc`), (`target_type`, `target_id`, `created_at desc`), (`group_id`, `created_at desc`) |
| `community.post_media` | `post_id`, `r2_path`, `position`, `alt_text` | ≤ 4 par post |
| `community.post_revision` | `post_id`, `body`, `edited_at` | historique des modifications |
| `community.comment` | `id`, `post_id`, `parent_id` (2 niveaux), `author_id`, `body` (≤ 2 000), `spoiler`, `status` | index (`post_id`, `created_at`) |
| `community.reaction` | `user_id`, `target_type` (`post`,`comment`), `target_id`, `kind` | PK (`user_id`, `target_type`, `target_id`, `kind`) |
| `community.list` / `list_item` | liste partagée, `cloned_from_id` ; éléments ordonnés (`issue_id`/`series_id`, `position`, `note`) | ≤ 500 éléments (`LIMITS.maxListItems`) |
| `community.group` | `id`, `name`, `slug`, `visibility` (`public`,`request`,`private`), `owner_id`, `rules` | `unique(slug)` |
| `community.group_member` | `group_id`, `user_id`, `role` (`owner`,`moderator`,`member`), `status` (`active`,`pending`,`banned`) | PK (`group_id`, `user_id`) |
| `community.club_schedule` | `group_id`, `event_id`/`series_id`, `step`, `issues` uuid[], `opens_at` | PK (`group_id`, `step`) |
| `community.challenge` | `id`, `group_id` (null = global), `title`, `rule` jsonb (cible mesurable), `starts_at`, `ends_at`, `status` | — |
| `community.challenge_entry` | `challenge_id`, `user_id`, `progress` (dérivé), `completed_at` | PK |
| `community.taste_profile` | `user_id`, `dna` jsonb, `computed_at`, `visibility` | Comic DNA (calcul serveur, opt-in) |

## 6. Modération (schéma `moderation`, proposé)

| Table | Champs | Règles |
|---|---|---|
| `moderation.report` | `id`, `reporter_id`, `target_type`, `target_id`, `reason` (`spam`,`harassment`,`hate`,`personal_data`,`illegal`,`spoiler`,`other`), `details`, `status` (`open`,`in_review`,`closed`), `priority` | ≤ 20 signalements/jour/utilisateur ; unicité (`reporter_id`, `target_type`, `target_id`) ouvert |
| `moderation.decision` | `id`, `report_id`, `moderator_id`, `decision` (`keep`,`hide`,`remove`,`suspend`,`ban`), `reason`, `statement` (exposé des motifs DSA), `appealable`, `created_at` | inaltérable (pas d'`update`) |
| `moderation.appeal` | `id`, `decision_id`, `author_id`, `body`, `status`, `reviewer_id` (≠ modérateur initial) | — |
| `moderation.sanction` | `user_id`, `kind`, `until`, `decision_id` | — |

## 7. Notifications (schéma `notify`, proposé)

| Table | Champs | Index |
|---|---|---|
| `notify.notification` | `id`, `user_id`, `type`, `actor_id`, `target_type`, `target_id`, `group_key` (regroupement), `payload` jsonb, `read_at`, `created_at` | (`user_id`, `read_at`, `created_at desc`) ; purge à 90 jours |
| `notify.push_token` | `user_id`, `device_id` FK `app.devices`, `platform`, `token`, `revoked_at` | `unique(token)` |
| Préférences | réutilise `app.user_settings.notifications` (existant) | — |

## 8. Abonnements (schéma `billing`, proposé)

| Table | Champs | Règles |
|---|---|---|
| `billing.customer` | `user_id` PK, `stripe_customer_id` unique | aucune donnée de carte stockée |
| `billing.subscription` | `id` (Stripe), `user_id`, `plan` (`plus_monthly`,`plus_yearly`), `status` (miroir Stripe), `current_period_end`, `cancel_at_period_end`, `trial_end` | mis à jour **uniquement** par le webhook |
| `billing.entitlement` | `user_id`, `key` (`groups_max`, `devices_max`, `ics_export`, `advanced_stats`…), `value` | calculé à partir de l'offre ; lu par les RPC |
| `billing.webhook_event` | `id` (Stripe), `type`, `received_at`, `processed_at` | idempotence |

## 9. Relations principales

```
auth.users 1─1 app.profiles 1─1 app.user_settings
auth.users 1─n app.copies ─(data.issue_ref)→ catalog.issue / catalog.variant
catalog.publisher 1─n catalog.series 1─n catalog.issue 1─n catalog.variant 1─n catalog.cover
catalog.edition n─n catalog.issue (edition_content)
catalog.issue n─n catalog.creator (credit) ; n─n catalog.character (appearance)
editorial.event 1─n editorial.event_link n─1 catalog.issue
community.post n─1 auth.users ; n─0..1 (catalog.* | editorial.event) ; 1─n community.comment
community.group 1─n community.group_member ; 1─n community.challenge
moderation.report n─1 (post | comment | profile) ; 1─n moderation.decision 1─n moderation.appeal
```

## 10. Liens entre données personnelles et catalogue

Les exemplaires locaux référencent aujourd'hui le catalogue commun local (D-55). Côté serveur, on ajoute à `app.copies`, `app.pulls`, `app.reading_states` une colonne extraite **nullable** `issue_id uuid` (et `variant_id`) alimentée par rapprochement, **sans modifier `data`** : une copie non rapprochée reste valide. Index (`user_id`, `issue_id`).

## 11. Gestion des suppressions

| Objet | Comportement |
|---|---|
| Compte | Délai de grâce 30 jours → `app.delete_account` : données personnelles purgées ; publications **retirées** ou **anonymisées** selon le choix de l'utilisateur ; décisions de modération conservées (obligation légale, sans données personnelles) |
| Exemplaire | Corbeille (client), `deleted_at` (serveur), purge des tombes après 90 jours (`app.purge_tombstones`) |
| Publication | `deleted_at` + retrait de l'affichage ; contenu purgé après 30 jours sauf gel lié à une procédure |
| Fiche catalogue | Jamais supprimée si référencée ; fusion via `catalog.alias` |
| Notification | Purge à 90 jours |

## 12. Stratégie de migration

1. Migrations 13 et suivantes, **additives** : schémas `catalog`, `editorial`, `community`, `moderation`, `notify`, `billing`.
2. Une migration = un test PGlite (schéma, RLS, contraintes), comme les 12 existantes.
3. Chargement initial du catalogue : depuis le catalogue commun local exporté (D-55) et les sources sous licence ; rapport de rapprochement relu par un humain.
4. Rapprochement des données personnelles : remplissage de `issue_id` par lot, réversible (colonne nullable), journalisé.
5. Aucune modification des migrations 1 à 12.
