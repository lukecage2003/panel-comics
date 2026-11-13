# PANEL — Spécification des API

Date : 13 novembre 2026. Statut : proposé (D-58). Les opérations correspondent aux tables de [`PANEL_DATA_MODEL.md`](PANEL_DATA_MODEL.md) et aux exigences de [`PANEL_FUNCTIONAL_SPECIFICATIONS.md`](PANEL_FUNCTIONAL_SPECIFICATIONS.md).

## 1. Principes

- **Transport** : HTTPS ; Supabase PostgREST (`/rest/v1`) pour les lectures sous RLS, RPC `POST /rest/v1/rpc/<fonction>` pour les écritures métier, Edge Functions (`/functions/v1/<nom>`) pour les tiers et les secrets.
- **Authentification** : en-tête `Authorization: Bearer <JWT Supabase>` ; `apikey` publique. Les opérations « anonyme » utilisent le rôle `anon` en lecture seule.
- **Format** : JSON UTF-8 ; dates ISO 8601 UTC ; montants en centimes + devise ISO 4217.
- **Idempotence** : toute écriture accepte `p_client_op_id` (uuid) ; un rejeu renvoie le même résultat.
- **Pagination** : par curseur opaque (`p_cursor`, `p_limit` ≤ 50, défaut 20) ; tri stable (`created_at desc, id`).
- **Erreurs** : corps `{ "error": { "code": "...", "message": "...", "details": {} } }`.

| Code | HTTP | Sens |
|---|---|---|
| `unauthenticated` | 401 | Jeton absent ou expiré |
| `forbidden` | 403 | RLS, blocage, rôle ou offre insuffisants |
| `not_found` | 404 | Entité absente ou invisible pour l'appelant |
| `validation_failed` | 422 | Champ invalide (détail par champ) |
| `out_of_scope` | 422 | Publication hors périmètre comics (manga, manhwa, BD) |
| `conflict` | 409 | Unicité ou révision obsolète |
| `rate_limited` | 429 | Limite de débit (`Retry-After`) |
| `plan_required` | 402 | Fonction PANEL Plus |
| `internal` | 500 | Erreur serveur (identifiant de corrélation) |

## 2. API existantes (vérifiées)

### 2.1 API client locale `window.Panel`
API publique de l'application (et des 52 tests d'interface) : `Panel.releases` (`ready`, `all`, `query`, `upsert`, `outOfScope`, `scopeReason`, `scopeRules`), `Panel.explorer` (`open`…), `Panel.conflicts`, `Panel.sync.readiness()`, sauvegardes par domaine, `exportStoredDigitalArchive`, catalogue commun. Elle reste la frontière d'automatisation du client et n'est pas exposée sur le réseau.

### 2.2 RPC Supabase déjà écrites (migrations 8 à 12)

| RPC | Rôle | Permission |
|---|---|---|
| `api.sync_push(p_device, p_ops, p_confirm_mass_delete)` | Envoi d'opérations de synchronisation, garde-fou de suppression massive | Authentifié, appareil actif |
| `api.sync_pull(p_since, p_max)` | Récupération des changements depuis une révision | Authentifié |
| `api.export_my_data()` | Export RGPD | Authentifié |
| `api.delete_my_data(p_confirm)` | Effacement des données personnelles | Authentifié, confirmation textuelle |
| `api.my_profile()`, `api.update_profile(p_patch)` | Profil | Authentifié |
| `api.settings_get()`, `api.settings_merge(p_device, p_prefs, p_hlc)` | Préférences (horloge hybride) | Authentifié |
| `api.register_device`, `api.list_devices`, `api.revoke_device` | Appareils | Authentifié |
| `api.list_conflicts`, `api.resolve_conflict` | Conflits de synchronisation | Authentifié |
| `api.my_roles()` | Rôles du personnel | Authentifié |
| Edge Function `delete-account` | Suppression complète du compte | Authentifié, réauthentification |

Ces contrats sont **conservés tels quels**.

## 3. Opérations cibles

Format : **Opération** — méthode, chemin — paramètres — permission — réponse — erreurs — validation.

### 3.1 Authentification (Supabase Auth, existant côté service)

| Opération | Chemin | Paramètres | Réponse | Erreurs / validation |
|---|---|---|---|---|
| Inscription | `POST /auth/v1/signup` | e-mail, mot de passe, `captcha_token`, consentements | session ou e-mail de confirmation | mot de passe ≥ 10 caractères, non compromis ; âge minimum (Q7) déclaré |
| Connexion | `POST /auth/v1/token?grant_type=password` | e-mail, mot de passe | JWT + rafraîchissement | 400 identifiants invalides ; limitation par IP |
| Lien magique | `POST /auth/v1/otp` | e-mail | 200 | limitation |
| OAuth | `GET /auth/v1/authorize?provider=google` | — | redirection | — |
| Déconnexion | `POST /auth/v1/logout` | — | 204 | — |
| Réinitialisation | `POST /auth/v1/recover` | e-mail | 200 (toujours, anti-énumération) | — |

### 3.2 Catalogue

| Opération | Méthode / chemin | Paramètres | Permission | Réponse | Validation / erreurs |
|---|---|---|---|---|---|
| Rechercher | `POST rpc/search` | `q` (2-100 car.), `types[]`, `market`, `p_cursor`, `p_limit` | anon | `{ results: [{type,id,title,subtitle,score}], next_cursor }` | `validation_failed` si `q` trop court |
| Lire une série | `GET /rest/v1/series?id=eq.<id>&select=*,publisher(*),issues(*)` | `id` | anon | série + numéros | `not_found` |
| Lire un numéro | `POST rpc/issue_detail` | `p_issue_id` | anon | numéro, variantes, éditions, crédits, claims publics | `not_found` |
| Lire un événement | `POST rpc/event_detail` | `p_event_id`, `p_level` | anon | événement, liens filtrés par niveau, ordres | — |
| Proposer une correction | `POST rpc/catalog_correction_create` | `target_type`, `target_id`, `field`, `proposed`, `p_client_op_id` | authentifié | `{ id, status:'open' }` | 10/jour ; champ autorisé |
| Fusionner des fiches | `POST rpc/catalog_merge` | `entity_type`, `keep_id`, `merge_id`, `reason` | `admin` | `{ alias_created }` | `conflict` si déjà fusionné ; journal |
| Créer / modifier une fiche | `POST rpc/catalog_upsert` | entité, champs, source | `admin` ou ingestion | fiche | `out_of_scope`, unicité |

### 3.3 Collection (synchronisation existante + compléments)

| Opération | Méthode / chemin | Permission | Remarque |
|---|---|---|---|
| Synchroniser | `rpc/sync_push`, `rpc/sync_pull` | propriétaire | Existant ; couvre `copies`, `locations`, `pulls`, `series_follows`, `reading_states` |
| Rapprocher un exemplaire | `POST rpc/copy_link_issue` (`p_copy_id`, `p_issue_id`, `p_variant_id`) | propriétaire | remplit `issue_id` sans toucher `data` ; réversible |
| Statistiques | `POST rpc/collection_stats` (`p_period`) | propriétaire | résumé (Free) ; détaillé (Plus, sinon `plan_required`) |
| Publier une copie filtrée | `POST rpc/share_copy` (`p_copy_id`, `p_caption`, `p_visibility`) | propriétaire | applique la liste blanche `SHAREABLE_COPY_FIELDS` ; refuse prix, valeur, emplacement, notes |

### 3.4 Lecture

| Opération | Méthode / chemin | Permission | Validation |
|---|---|---|---|
| Changer un état | via `sync_push` (`reading_states`) | propriétaire | statut ∈ {`to_read`,`reading`,`read`,`dropped`} |
| Progression d'événement | `POST rpc/event_progress` (`p_event_id`, `p_level`) | propriétaire | dérivé du journal |
| Statistiques de lecture | `POST rpc/reading_stats` (`p_year`) | propriétaire | Plus pour le détail |

### 3.5 Publications

| Opération | Méthode / chemin | Paramètres | Permission | Réponse | Erreurs / validation |
|---|---|---|---|---|---|
| Créer | `POST rpc/post_create` | `kind`, `body` (≤ 5 000), `rating` (0-5, pas 0,5), `spoiler`, `visibility`, `target_type`, `target_id`, `media[]` (≤ 4), `group_id`, `p_client_op_id` | authentifié, non suspendu | post | `rate_limited` (10/h) ; liens refusés si compte < 7 jours ; spoiler forcé si cible parue < 30 jours ; `forbidden` si groupe non membre |
| Modifier | `POST rpc/post_update` | `p_post_id`, `body`, `spoiler` | auteur | post + révision | `conflict` si supprimé |
| Supprimer | `POST rpc/post_delete` | `p_post_id` | auteur ou modérateur | 204 | — |
| Lire le fil | `POST rpc/feed` | `tab` (`following`,`community`,`me`), `p_cursor`, `p_limit` | authentifié | `{ items, next_cursor }` | exclut bloqués, masqués, contenus `hidden`/`removed` |
| Lire les posts d'une entité | `POST rpc/entity_posts` | `target_type`, `target_id`, `p_cursor` | anon (public) | posts publics | — |
| Réagir | `POST rpc/reaction_toggle` | `target_type`, `target_id`, `kind` | authentifié | `{ active, count }` | une par type |
| Téléverser une image | `POST /functions/v1/media-sign-upload` | `mime`, `size` | authentifié | URL R2 signée (5 min) | JPEG/PNG/WebP, ≤ 5 Mo, métadonnées EXIF retirées |

### 3.6 Commentaires

| Opération | Méthode / chemin | Paramètres | Permission | Validation |
|---|---|---|---|---|
| Commenter | `POST rpc/comment_create` | `p_post_id`, `p_parent_id`, `body` (≤ 2 000), `spoiler` | authentifié, non bloqué par l'auteur | 30/h ; `forbidden` si commentaires désactivés ; profondeur ≤ 2 |
| Lister | `POST rpc/comments` | `p_post_id`, `p_cursor` | selon visibilité du post | — |
| Supprimer | `POST rpc/comment_delete` | `p_comment_id` | auteur, auteur du post, modérateur | — |

### 3.7 Abonnements sociaux et groupes

| Opération | Méthode / chemin | Permission | Validation |
|---|---|---|---|
| Suivre | `POST rpc/follow` (`p_user_id`) | authentifié | `pending` si profil privé ; refus si blocage |
| Ne plus suivre | `POST rpc/unfollow` | authentifié | — |
| Répondre à une demande | `POST rpc/follow_respond` (`p_follower_id`, `accept`) | suivi | — |
| Bloquer / débloquer | `POST rpc/block`, `rpc/unblock` | authentifié | retire les abonnements réciproques |
| Masquer | `POST rpc/mute` (`target_user_id` ou `word`, `until`) | authentifié | — |
| Créer un groupe | `POST rpc/group_create` | authentifié | quota d'offre (`plan_required`) ; `slug` unique |
| Rejoindre / quitter | `POST rpc/group_join`, `rpc/group_leave` | authentifié | `pending` si sur demande |
| Créer un challenge | `POST rpc/challenge_create` | propriétaire de groupe ou `admin` | règle mesurable validée |
| S'inscrire à un challenge | `POST rpc/challenge_join` | authentifié | statut `programmé` ou `ouvert` |

### 3.8 Abonnements PANEL Plus (Stripe)

| Opération | Méthode / chemin | Paramètres | Permission | Réponse | Erreurs |
|---|---|---|---|---|---|
| Démarrer un paiement | `POST /functions/v1/billing-checkout` | `plan` (`plus_monthly`,`plus_yearly`) | authentifié | URL Stripe Checkout | `conflict` si déjà abonné |
| Portail client | `POST /functions/v1/billing-portal` | — | abonné | URL du portail Stripe | — |
| Webhook Stripe | `POST /functions/v1/stripe-webhook` | événement Stripe signé | Stripe (signature vérifiée) | 200 | 400 signature invalide ; idempotence par `event.id` |
| Mes droits | `POST rpc/my_entitlements` | — | authentifié | `{ plan, status, entitlements }` | — |

Événements Stripe traités : `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.

### 3.9 Notifications

| Opération | Méthode / chemin | Permission |
|---|---|---|
| Lister | `POST rpc/notifications` (`p_unread_only`, `p_cursor`) | propriétaire |
| Marquer lu | `POST rpc/notifications_mark_read` (`p_ids[]` ou `all`) | propriétaire |
| Préférences | `api.settings_merge` (champ `notifications`, existant) | propriétaire |
| Enregistrer un jeton push | `POST rpc/push_token_register` (`p_device`, `platform`, `token`) | propriétaire, appareil actif |

### 3.10 Recherche

`POST rpc/search` (§ 3.2) ; `POST rpc/search_users` (`q`, profils publics seulement, exclut les bloqués) ; `POST rpc/search_groups` (groupes publics).

### 3.11 Administration et modération

| Opération | Méthode / chemin | Permission | Validation |
|---|---|---|---|
| Signaler | `POST rpc/report_create` (`target_type`, `target_id`, `reason`, `details`) | authentifié | 20/jour ; motif ∈ `REPORT_REASONS` |
| File de modération | `POST rpc/mod_queue` (`status`, `p_cursor`) | `moderator` | — |
| Décider | `POST rpc/mod_decide` (`p_report_id`, `decision`, `reason`, `statement`) | `moderator`, pas sur ses propres contenus | exposé des motifs obligatoire si `hide`/`remove`/`suspend` ; notification à l'auteur |
| Faire appel | `POST rpc/appeal_create` (`p_decision_id`, `body`) | auteur concerné | une fois par décision ; délai 6 mois |
| Traiter un appel | `POST rpc/appeal_decide` | `moderator` ≠ auteur de la décision | — |
| Rôles | `app.grant_role`, `app.revoke_role` (existant) | `admin` | journalisé |
| Statistiques de transparence | `POST rpc/mod_transparency` (`p_from`, `p_to`) | `admin` | agrégats sans données personnelles |

## 4. Sécurité des API

Voir [`PANEL_SECURITY_AND_COMPLIANCE.md`](PANEL_SECURITY_AND_COMPLIANCE.md) § 9. Résumé : RLS sur toutes les tables, RPC `SECURITY DEFINER` avec `search_path` fixé et contrôle explicite de `auth.uid()`, limites de débit en base (`app.service_limits`, existant), validation des tailles, aucune clé `service_role` côté client.
