# Phase 3 · 03 — Authentification, sessions, appareils et profils

Statut : **conception à valider**. Elle repose sur Supabase Auth (voir [`02`](02-architecture-cible.md)).

## 1. Fonctionnalités d'authentification
| Fonction | Mécanisme | Remarques |
|---|---|---|
| Inscription | E-mail + mot de passe ; vérification d'e-mail obligatoire avant toute synchronisation | Mot de passe d'au moins 10 caractères, avec lettres et chiffres. La protection contre les mots de passe fuités (HaveIBeenPwned) n'existe qu'en Pro [Doc] |
| Connexion | `signInWithPassword` ; flux PKCE pour les liens | Message d'erreur générique (« identifiants incorrects ») |
| Déconnexion | `signOut({ scope: 'local' })` sur l'appareil ; `global` pour « tous les appareils » ; `others` pour « les autres appareils » [Doc] | La déconnexion **ne supprime pas** les données locales par défaut (voir § 4) |
| Vérification d'e-mail | Lien à usage unique ; Web : page de rappel ; Android : App Link vers l'application | SMTP personnalisé obligatoire avant la bêta (2 e-mails par heure avec le fournisseur intégré) [Doc] |
| Mot de passe oublié / réinitialisation | `resetPasswordForEmail`, puis page de nouveau mot de passe | Réponse identique que le compte existe ou non |
| Sessions | Jeton d'accès JWT d'**1 h** (valeur par défaut recommandée) ; jeton de rafraîchissement **à usage unique, renouvelé à chaque échange**, avec une fenêtre de réutilisation de 10 s ; une réutilisation hors fenêtre révoque toute la session [Doc] | Durée maximale de session et délai d'inactivité seulement en Pro [Doc] |
| Renouvellement | Automatique (supabase-js) ; hors ligne, la session n'est pas rafraîchie et l'application reste utilisable localement | La synchronisation reprend après rafraîchissement ; si le jeton est révoqué, on demande une reconnexion sans toucher aux données locales |
| Gestion des appareils | Table `devices` (déclarée par le client, revue côté serveur) : nom, plateforme, version, dernière synchronisation, `revoked_at` | Révoquer un appareil : il est marqué, refusé par `sync_push`/`sync_pull` (vérification serveur), et l'utilisateur lance « déconnecter les autres appareils » |
| Protection contre les abus | Limites de débit Auth par défaut (connexion et inscription : 30 requêtes / 5 min par IP ; jeton : 150 / 5 min) [Doc] ; CAPTCHA (Turnstile ou hCaptcha) avant la bêta publique, à décider | Limite applicative par utilisateur sur `sync_push` (taille de lot, fréquence) |
| Connexion sociale (future) | Google, puis Apple si iOS | Hors Phase 3 ; le modèle `profiles` ne dépend pas de la méthode de connexion |

## 2. Sécurité
- **Identifiants** : stockés et hachés par Supabase Auth (bcrypt). Panel ne voit ni ne stocke jamais un mot de passe ; aucun champ de mot de passe n'est sauvegardé localement.
- **Jetons** :
  - Web : stockage du navigateur (localStorage par défaut), d'où la **CSP stricte** et l'absence de XSS comme prérequis du lot 3.2 ;
  - Android : stockage chiffré par le Keystore (plugin à valider), `allowBackup` réglé avant le lot 3.2.
- **Communications** : HTTPS seulement ; `allowMixedContent: false` déjà en place sur Android.
- **Autorisations** : vérifiées **dans Postgres** (RLS + `auth.uid()` + vérification de l'appareil dans les fonctions de synchronisation). Le client n'est jamais considéré comme sûr.
- **Énumération de comptes** :
  - mêmes messages et mêmes délais pour un e-mail inconnu ou connu (inscription, connexion, réinitialisation) ;
  - aucune fonction publique « ce pseudonyme ou cet e-mail existe-t-il ? » sans limitation de débit (vérification du pseudonyme réservée aux utilisateurs connectés, limitée).
- **Limitation des tentatives** : limites Auth du fournisseur, CAPTCHA en option, limites applicatives sur les fonctions RPC.
- **Session compromise** :
  - la réutilisation d'un jeton de rafraîchissement révoque toute la session (comportement par défaut, à conserver) [Doc] ;
  - bouton « Déconnecter tous les appareils » (`global`) ;
  - la réinitialisation du mot de passe déconnecte les autres sessions.
- **Récupération de compte** : réinitialisation par e-mail. Pas de questions secrètes. La double authentification (TOTP) est prévue après la Phase 3.

## 3. Web et Android : différences
| Aspect | Web (PWA) | Android (Capacitor) |
|---|---|---|
| Stockage de session | localStorage (supabase-js) | Adaptateur `auth.storage` sur le Keystore (plugin natif) |
| Retour des liens e-mail | URL HTTPS de l'application hébergée | App Link (`assetlinks.json` sur le domaine) vers `MainActivity` ; repli sur une page web qui invite à revenir dans l'application |
| Sauvegarde système | Aucune | `allowBackup` : risque de restaurer un jeton sur un autre appareil |
| Plusieurs onglets | Une seule session partagée ; un verrou (BroadcastChannel ou `navigator.locks`) empêche deux synchronisations simultanées | Sans objet |
| Effacement par l'utilisateur | « Effacer les données du site » supprime la session **et** les données locales : le cloud permet de les récupérer | Désinstallation : idem |

Autres appareils (iOS, bureau) : même client web. Le stockage sécurisé doit être évalué pour chaque plateforme ; aucune équivalence n'est supposée.

## 4. Comportement local lié au compte
- **Profil local → compte** : le profil local existant (`relMeta.profile`, `usr_local_…`) est **lié** au compte à la première connexion. On enregistre `linkedUserId` et `linkedAt` dans `panel-sync/state`.
- **Déconnexion** : on propose « Garder mes données sur cet appareil » (par défaut) ou « Retirer mes données de cet appareil », ce qui exige qu'aucune modification ne soit en attente, ou une confirmation explicite de leur perte, avec un export proposé.
- **Changement de compte** : interdit tant que des données d'un autre compte sont présentes localement sans avoir été retirées ou exportées. On ne mélange **jamais** deux comptes dans une même base locale.

## 5. Modèle de profil
Champs proposés, Postgres, schéma `app` :

### `profiles` (1:1 avec `auth.users`)
| Champ | Type | Règle |
|---|---|---|
| `user_id` | `uuid` PK → `auth.users(id)` `on delete cascade` | |
| `handle` | `citext` unique, nullable | 3 à 30 caractères `[a-z0-9_]`, choisi plus tard ; réservé aux futurs profils publics |
| `display_name` | `text` (≤ 60) | |
| `avatar_path` | `text` nullable | Chemin de stockage objet, ajouté plus tard ; pas d'URL externe arbitraire |
| `bio` | `text` (≤ 500) | |
| `locale` | `text` (`fr-FR` par défaut) | |
| `preferred_market` | `text` (`FR`, `US`) | Reprend `REL_MARKETS` |
| `created_at`, `updated_at` | `timestamptz` | `updated_at` mis à jour par déclencheur |

### `user_settings` (1:1)
| Champ | Type | Contenu |
|---|---|---|
| `user_id` | PK | |
| `prefs` | `jsonb` | Thème, vue, sons, haptique, préférences de lecture (spoilers, mode simplifié), marché par défaut du calendrier |
| `notifications` | `jsonb` | Tout désactivé par défaut (aucune notification en Phase 3) |
| `privacy` | `jsonb` | `{ profile: 'private', collection: 'private', stats: 'private', wishlist: 'private', activity: 'private' }`. **Tout est privé par défaut**, et chaque catégorie aura son propre réglage plus tard |
| `rev`, `updated_at` | | Synchronisé comme les autres entités (§ [`04`](04-synchronisation.md)) |

### `devices`
`id uuid` (généré par le client, stable par installation), `user_id`, `label`, `platform` (`web` ou `android`), `app_version`, `created_at`, `last_seen_at`, `last_sync_rev`, `revoked_at`.

### Statistiques personnelles
**Calculées localement**, sans stockage serveur en Phase 3. Une vue serveur `my_stats` pourra être ajoutée si un tableau de bord en a besoin.

## 6. Préparation des phases futures (sans les développer)
- **Profil public, collection publique** : un futur champ `privacy.*` et des **vues** `public_profiles` et `public_collection` filtrées par confidentialité, sans relâcher la RLS des tables de base.
- **Abonnements, publications, historique d'activité** : tables séparées dans un futur domaine `community`. Les clés étrangères pointeront vers `profiles.user_id` ; rien n'y est créé en Phase 3.
- **Modération, administration** : rôle applicatif `app_role` (dans `app_metadata`, modifiable seulement côté serveur), pas avant la Phase 4.
- **Premium** : une table `entitlements` future, alimentée par le fournisseur de paiement ; rien en Phase 3.
- **International** : `locale` et `preferred_market` sont prêts dès maintenant ; les textes restent à extraire (i18n) dans une phase ultérieure.

## Sources
Voir [`02-architecture-cible.md`](02-architecture-cible.md), section Sources (sessions, déconnexion, limites de débit, sécurité des mots de passe).
