# Phase 3 · 10 — Dossier d'exécution des lots 3.2 à 3.7 (8 novembre 2026)

**Statut : préparation.** Aucun lot n'est autorisé. Aucune connexion distante, aucune transmission de données et aucune synchronisation activée (`PANEL_SYNC_ENABLED = false`).

Ce dossier **ne remplace pas** l'architecture validée ; il la complète :
- la feuille de route [`06`](06-roadmap-phase3.md) donne le contenu des lots ;
- le protocole [`04`](04-synchronisation.md) : modèle, envoi, réception, conflits, migration, scénarios ;
- l'authentification [`03`](03-authentification-profils.md) et les sauvegardes et le RGPD [`05`](05-sauvegardes-confidentialite.md).

Il y ajoute :
- les **conséquences de l'audit du lot 3.1** ([`09`](09-audit-cloture-lot-3.1.md)) ;
- les prérequis externes, les contrats précis, les critères d'acceptation et l'ordre d'exécution.

## 0. Numérotation
La numérotation validée de [`06`](06-roadmap-phase3.md) est **conservée**. Correspondance avec les thèmes de la demande du 8 novembre 2026 :

| Thème demandé | Lot validé |
|---|---|
| Environnement Supabase | **3.2** (projet, hébergement, sécurité du client) |
| Authentification | **3.2** (comptes et sessions) et **3.3** (profils, préférences, appareils, rôles) |
| Synchronisation montante | **3.4** (`sync_push`, outbox, migration initiale) |
| Synchronisation descendante | **3.4** (`sync_pull`, pagination, curseur) |
| Résolution des conflits | **3.5** |
| Sauvegardes, RGPD, purge | **3.6** |
| Validation globale | **3.7** |

## 1. Ordre et portes
```
3.1 (livré) → [validation Supabase locale] → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7
                 └── 3.1b (indépendant côté serveur, à faire avant 3.4 : la synchronisation suit les domaines B1)
```
| Porte | Condition | Responsable |
|---|---|---|
| P-3.2 | Validation Supabase locale réussie ([`09`](09-audit-cloture-lot-3.1.md) § 6) ; projet de préproduction **créé par l'utilisateur** (Free, région UE) ; décisions de la section F de [`06`](06-roadmap-phase3.md) : SMTP, hébergeur, stockage sécurisé Android | Utilisateur |
| P-3.4 | Lot 3.1b livré (frontières et fournisseurs par domaine) ; décision technique sur le mode de `sync_push` (§ 4.1) ; L-D1 et L-D2 tranchées, ou décision explicite de synchroniser `isRead` provisoirement (§ 4.4) | Utilisateur, puis l'équipe technique |
| P-3.6 | Passage en Pro avant tout utilisateur réel (engagement financier) ; avis juridique (`05` § 4.4) | Utilisateur |
| Activation | `PANEL_SYNC_ENABLED` ne passe à `true` qu'avec l'autorisation explicite de l'utilisateur, après l'acceptation du lot 3.4 | Utilisateur |

## 2. Lot 3.2 — Environnement Supabase, comptes, sécurité du client
### 2.1 Environnements
| Environnement | Base | Clés | Migrations |
|---|---|---|---|
| Développement local | PGlite (`npm run test:db`), puis Supabase local (Docker) | Clés locales générées par `supabase start`, jamais versionnées | `supabase db reset` |
| Préproduction | Projet Free, région UE | `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` dans `backend/.env` (ignoré) ; clé de service seulement dans le tableau de bord et dans les secrets des Edge Functions | `supabase link`, puis `supabase db push` depuis un tag Git `db-AAAAMMJJ` |
| Production | Projet **séparé**, Pro | Idem, avec un projet et des clés distincts | Mêmes migrations, après la préproduction, avec un `pg_dump` préalable |

### 2.2 Procédure d'application (préproduction)
1. `npm run test:db`, puis `npm run check:secrets` : les deux au vert.
2. `supabase link --project-ref <ref>`, la référence étant fournie par l'utilisateur.
3. `supabase db push --dry-run` : vérifier la liste des migrations.
4. `supabase db push`.
5. `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/tests/verify-supabase.sql` : notice « conforme » attendue.
6. Advisors Supabase (sécurité et performances) : aucun avertissement sur le schéma `app`.
7. **Retour arrière** : base vide de préproduction ⇒ recréer le projet ou appliquer une migration inverse. Aucune donnée réelle n'est concernée à ce stade.

### 2.3 Client
- **CSP stricte** avant toute authentification : un XSS vaudrait un vol de jeton.
- **Fin des CDN** : JSZip et supabase-js hébergés localement, en version figée.
- Module séparé `panel-cloud-auth.js`, pour ne pas gonfler `index.html`.

### 2.4 Tests et acceptation
- Les critères de [`06`](06-roadmap-phase3.md) § 3.2.
- `verify-supabase.sql` conforme en préproduction.
- Suite front entièrement au vert, sans violation CSP.

## 3. Authentification (lots 3.2 et 3.3)
| Sujet | Règle |
|---|---|
| Inscription | E-mail et mot de passe avec vérification par e-mail ; message identique que le compte existe ou non (pas d'énumération) ; SMTP personnalisé |
| Connexion et renouvellement | Flux PKCE ; jeton d'accès court ; jeton de rafraîchissement **à rotation** (réglage Supabase par défaut). Au-delà de la limite de rafraîchissement : session expirée, mode local intact, reconnexion demandée |
| Stockage des jetons | Web : stockage de supabase-js, protégé par la CSP. Android : stockage chiffré (plugin à choisir, décision F), jamais en localStorage |
| Déconnexion | Locale par défaut (données et outbox conservées, § 7 de `04`) ; « déconnecter tous les appareils » révoque les sessions côté Auth |
| Récupération | Lien de réinitialisation à usage unique ; aucune donnée locale touchée |
| Utilisateur sans compte | Mode local complet, **sans** utilisateur anonyme Supabase : rien n'est créé côté serveur sans compte. La question de S1 pour les profils locaux relève de **P1** et n'est pas tranchée ici |
| Liaison d'un profil local | Seulement après vérification de l'e-mail, à l'étape 2 de la migration de `04` § 6 ; jamais automatique |
| Protection des données | Côté serveur, uniquement la RLS (pas de « routes » à protéger : l'application reste une page unique). Côté client, l'écran Compte et la synchronisation exigent une session valide |
| Erreurs | Table de correspondance des codes Supabase (identifiants invalides, e-mail non vérifié, limite de débit, réseau) vers des messages en français ; jamais de détail technique ni d'e-mail renvoyé |
| Appareils (3.3) | `devices` est créé à la première connexion. `revoked_at` et `last_sync_rev` sont écrits par le serveur seulement (migration 7). Un appareil révoqué voit `sync_push` refusé, et ses opérations en attente restent exportables |
| Rôles (3.3) | `app.staff_roles` et `app.has_role()` : aucun accès aux données personnelles (tests de frontière, A10) |

## 4. Lot 3.4 — Synchronisation montante et descendante
### 4.1 Décisions techniques à prendre au début du lot (réversibles, consignées dans `DECISIONS.md`)
| # | Question | Options | Recommandation |
|---|---|---|---|
| T1 | Mode de `sync_push` | (a) `security invoker` (`04` § 3.3) : le client garde des droits d'écriture directs, ce qui contourne la fusion par champ et `sync_ops` ; (b) `security definer`, avec contrôle explicite de `auth.uid()`, de l'appareil non révoqué et des tailles, et **retrait** des droits `INSERT`, `UPDATE` et `DELETE` directs sur les tables synchronisées | **(b)** : l'audit montre qu'une écriture ou une suppression directe échappe à la détection |
| T2 | Suppressions | (a) `DELETE` physique autorisé ; (b) pierre tombale seule (`deleted_at`), purge par le service au lot 3.6 | **(b)** : une suppression physique est invisible pour le curseur (démontré) |
| T3 | Trous de révision des upserts | (a) les accepter ; (b) `UPDATE … RETURNING`, puis `INSERT` si aucune ligne | (b) dans `sync_push` ; les trous restent tolérés par le protocole |
| T4 | Migrations de `data` côté serveur | Variable de session `app.skip_rev` lue par `assign_rev`, réservée au service | Oui, à la première migration de données seulement |

### 4.2 Contrats (fonctions RPC)
- **`sync_push(device_id uuid, ops jsonb)`**
  - **Entrée** : au plus 200 opérations, chacune `{op_id, entity, id, kind: upsert|delete, base_rev, patch, schema_version}`.
  - **Sortie** : par opération, `{op_id, status: applied|duplicate|merged|conflict|rejected, rev, server_row?}`, comme dans `04` § 3.3.
  - **Transaction** : une seule par lot ; tout ou rien.
- **`sync_pull(since_rev bigint, max int default 500)`**
  - **Sortie** : `{rows: [{entity, id, data, field_revs, rev, deleted_at, schema_version}], next_rev, has_more}`, triée par `rev`, avec les pierres tombales.
  - Si `since_rev` est inférieur à la limite de purge, la sortie est `resync_required`.
- **Garantie d'ordre** : les révisions sont visibles dans l'ordre de validation (verrou de ligne sur `user_sync_state`, [`09`](09-audit-cloture-lot-3.1.md) § 4.2). Le curseur `rev > since_rev` est donc complet. **À tester** dans une base Supabase locale avec deux sessions concurrentes.

### 4.3 Garanties exigées : « transféré » ne veut pas dire « synchronisé »
- **Idempotence** : un `op_id` rejoué renvoie le résultat enregistré, sans nouvelle révision.
- **Reprise** : outbox persistante, mêmes `op_id` après une coupure, état enregistré après chaque lot accepté.
- **Vérification** après la migration initiale et à la demande :
  - comptes par domaine ;
  - ensemble des identifiants ;
  - empreinte `stableHash` par fiche ;
  - relations (`locationId`, `pubId`).

  La synchronisation n'est déclarée « vérifiée » qu'à ce prix (`04` § 6, étape 6).
- **Garde-fou anti-cataclysme** : plus de 50 suppressions, ou plus de 10 % d'un domaine, suspend l'envoi et exige un aperçu.

### 4.4 Dépendances produit
- **`reading_progress`** couvre aujourd'hui les guides (`guide_id`, `entry_id`). L'état de lecture **par œuvre** de L1 (`ReadingState`) demandera une table `reading_states` (nouvelle migration). **Dépend de L-D1 et L-D2.**
- Tant que L1 n'est pas livré, `isRead` voyage avec l'exemplaire (`copies.data`). Le synchroniser ainsi est **techniquement possible**, mais consoliderait Collection comme propriétaire de la lecture : c'est une décision à prendre (P-3.4).
- **Finances** (F1) : les nouveaux champs (`acquisitionFees`, `disposal`, etc.) voyagent dans `copies.data`, sans migration de schéma. Les acquisitions groupées (`panel_acquisitions`) demanderont une table `acquisitions` **si F-D5 la retient**.

### 4.5 Tests
- Unitaires, intégration et volumétrie : ceux de [`06`](06-roadmap-phase3.md) § 3.4.
- Ajouts issus de l'audit :
  - aucune suppression physique possible par un client (T2) ;
  - aucune écriture directe possible (T1) ;
  - concurrence de deux sessions, ordre de validation égal à l'ordre des révisions ;
  - `op_id` rejoué après une réponse perdue ;
  - `sync_pull` interrompu à la page N, puis repris sans doublon ni trou.

## 5. Lot 3.5 — Conflits
- Règles **par domaine** de [`04`](04-synchronisation.md) § 4 (pas de « dernière écriture gagnante » universelle) : fusion par champ, premier écrit gagnant avec conflit consigné pour Collection, horloge logique hybride (HLC) pour les préférences et le statut de lecture, résurrection quand une modification rencontre une suppression.
- **Compléments de cohérence** avec les décisions produit :
  - **Finances (D-18 et F0)** : une valeur inconnue (`null`) ne remplace **jamais** une valeur connue par fusion automatique. Un `null` concurrent d'une valeur crée un conflit visible, il n'efface rien.
  - **Données inconnues** (champ que le client ne connaît pas, `schema_version` supérieure) : conservées telles quelles dans `data` et renvoyées sans modification. Un client ancien ne doit jamais effacer un champ qu'il ignore. Test obligatoire.
  - **Données anciennes** (au-delà de 90 jours hors ligne) : resynchronisation complète avec aperçu.
  - **Restauration après échec** : chaque conflit est réversible depuis `sync_conflicts` ; la corbeille dure 30 jours.
- **Acceptation** : aucune perte silencieuse dans les cinq cas imposés et les scénarios de `04` § 7.

## 6. Lot 3.6 — Sauvegardes, RGPD, purge
- Contenu prévu dans [`06`](06-roadmap-phase3.md) § 3.6 et [`05`](05-sauvegardes-confidentialite.md).
- La purge des pierres tombales est **destructive** : approbation explicite requise, avec une sauvegarde `pg_dump` vérifiée juste avant.
- La restauration est testée **dans un projet de test** et chronométrée.

## 7. Lot 3.7 — Scénarios de validation globale
| # | Scénario | Résultat attendu |
|---|---|---|
| V1 | Deux appareils modifient des champs différents d'un même exemplaire | Fusion, aucun conflit |
| V2 | Deux appareils modifient le même champ | Premier écrit gagnant, conflit visible et réversible |
| V3 | Utilisateur déconnecté qui modifie localement | Outbox conservée, envoyée à la reconnexion **du même compte** |
| V4 | Perte de réseau en plein lot | Même lot rejoué, aucune double application |
| V5 | Reconnexion après 3 jours hors ligne | Envoi, puis réception avec fusion |
| V6 | Suppression sur A, modification sur B | La modification gagne, la suppression est consignée |
| V7 | Sauvegarde JSON restaurée sur A | Aperçu obligatoire, garde-fou anti-cataclysme |
| V8 | Restauration serveur (`pg_restore`) dans un projet de test | Comptes et empreintes identiques |
| V9 | Compte supprimé | Zéro ligne dans les 11 tables ; données locales conservées sur demande |
| V10 | Session expirée pendant la synchronisation | Arrêt propre, outbox intacte, reprise après reconnexion |
| V11 | Interruption pendant `sync_pull` (fermeture de l'onglet) | Reprise à la page suivante |
| V12 | Appareil révoqué | `sync_push` refusé ; données locales exportables |
| V13 | Mise à jour de l'application avec une outbox pleine | Aucune perte |
| V14 | Client ancien face à un champ inconnu | Champ conservé |

Le contrôle automatique de tous ces scénarios se fait sur Supabase local, avant la bêta fermée.

## 8. Prérequis externes, tous du ressort de l'utilisateur
- Docker Desktop et la Supabase CLI, pour la validation locale.
- Projets Supabase de préproduction puis de production.
- Choix du SMTP, de l'hébergeur et du plugin de stockage sécurisé Android.
- Passage en Pro, qui est un engagement financier.
- Avis juridique.

Aucun de ces prérequis n'est engagé à ce jour.

## 9. Réalisation locale du lot 3.4 et d'une partie de 3.5 (mission « Autonomous night shift », 8 novembre 2026)
**Statut : implémenté et validé localement (PGlite) ; non validé sur Supabase ; synchronisation réelle non activée** (`PANEL_SYNC_ENABLED = false`, aucun projet cloud). Décision appliquée : D-31 (T1 à T4).

| Élément | Réalisé |
|---|---|
| Migration 8 (`20261109000008_sync_rpc.sql`) | Schéma `api` ; `api.sync_push(device, ops, confirm_mass_delete)` et `api.sync_pull(after_rev, limit)` ; table `reading_states` (L1) ; `field_revs` estampillés par déclencheur ; `purged_below_rev` ; retrait des écritures directes (T1) ; `app.skip_rev` ignoré pour les rôles clients (T4) |
| Idempotence | `op_id` enregistré dans `sync_ops` : un rejeu renvoie `duplicate` et le statut d'origine, sans nouvelle révision |
| Curseurs | Pagination par `rev` (`next_rev`, `has_more`) ; `resync_required` si le curseur est sous `purged_below_rev` |
| Conflits (3.5, partie) | Par champ : premier écrivain gagnant, conflit journalisé dans `sync_conflicts` ; un null n'écrase jamais une valeur concurrente connue ; modification prioritaire sur suppression ; champs inconnus conservés ; plus de 50 suppressions dans un lot : confirmation exigée |
| Moteur client (`backend/sync-engine/engine.js`) | Outbox persistante, mêmes `op_id` après coupure, état enregistré après chaque lot et chaque page, outbox liée au compte (quarantaine sinon), session expirée ou appareil révoqué : arrêt propre ; empreinte de vérification |
| Session locale (3.2/3.3, partie) | `createLocalSession()` : connecté, expiré, déconnecté ; aucun secret stocké, aucun fournisseur externe |
| Tests (`backend/tests/sync.test.js`) | 16 tests, dont 3 appareils × 150 opérations aléatoires avec coupures et convergence vérifiée. Les tests RLS, durcissement et déclencheurs du lot 3.1 s'exécutent sur le schéma des migrations 1 à 7 (`freshDb({ upTo: LOT_31 })`) |

Restant, avec un service externe ou une décision : projet Supabase et `verify-supabase.sql` réel (3.2), authentification réelle (3.2/3.3), branchement du moteur dans `index.html` et migration d'une collection existante (3.4, après 3.2), corbeille et interface de conflits (3.5), purge et RGPD (3.6), validation Web + Android (3.7).

## 10. Suite locale : adaptateurs (3.2/3.4) et lot 3.6 (mission « Autonomous full project execution », 8 novembre 2026)
**Statut : implémenté et validé localement (PGlite) ; jamais exécuté contre Supabase ; synchronisation réelle non activée.** Décision : D-35.

| Élément | Réalisé | Reste |
|---|---|---|
| `backend/sync-engine/adapters.js` | `createSupabaseTransport(client)` (noms des paramètres de la migration 8, erreurs `session_expired` / `device_revoked` / `network` / `invalid`), `createSupabaseSession(client)` (expiration avec marge, rafraîchissement, abonnement), `createWebStorage(localStorage, clé)` | Client supabase-js réel, clés publiques et URL du projet (3.2), branchement dans `index.html` |
| Migration 9 | `api.export_my_data()` ; `api.delete_my_data('SUPPRIMER MES DONNÉES')` ; `app.purge_tombstones(user, ≥ 7 jours)` réservé au service | Suppression du compte auth (API d'administration Supabase), tâche planifiée de purge, durée de conservation à valider (juridique) |
| Tests | `adapters.test.js` (5) : deux appareils convergent par le transport Supabase, session expirée puis rafraîchie, coupure réseau rejouée sans doublon ; `privacy.test.js` (3) ; `verify-supabase.sql` étendu | `verify-supabase.sql` sur un vrai projet |

## 11. Lot 3.3 local (8 novembre 2026, suite de la mission)
**Statut : implémenté et validé localement (PGlite) ; jamais exécuté contre Supabase.** Décision : D-38.

| Élément | Réalisé | Reste |
|---|---|---|
| Rôles | `app.staff_roles`, `app.staff_role_log`, `app.has_role`, `app.grant_role` / `app.revoke_role` (service seulement) | Attribution du premier administrateur (geste manuel du propriétaire, après 3.2) |
| Frontière A10 | Un administrateur ne voit ni ne modifie aucune ligne d'autrui dans les 12 tables personnelles ; aucune politique ne cite un rôle ; contrôle ajouté à `verify-supabase.sql` | `verify-supabase.sql` sur un vrai projet |
| Profil, préférences | `api.my_profile`, `api.update_profile`, `api.settings_get`, `api.settings_merge` (HLC par clé, sans boucle) | Copie des préférences locales vers `user_settings` au premier branchement |
| Appareils | `api.register_device` (20 actifs au plus), `api.list_devices`, `api.revoke_device` ; appareil révoqué refusé par `settings_merge` et `sync_push` | Écran Compte et Appareils (affiché seulement avec un projet configuré) |
| Client | `createSupabaseAccount(client)`, `createHlc(appareil)` (monotone, `observe()`) | Client supabase-js réel |

