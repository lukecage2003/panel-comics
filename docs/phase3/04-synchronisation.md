# Phase 3 · 04 — Moteur de synchronisation local-first

Statut : **conception à valider**. Ce document est le cœur technique de la Phase 3.

## 1. Données à synchroniser (entité par entité)
| Entité locale | Table serveur | Synchronisée | Justification |
|---|---|---|---|
| Exemplaire (`physicalSingles`, wishlist incluse) | `copies` | **Oui** | Donnée personnelle essentielle |
| Séries suivies (`seriesMeta`) | `series_follows` | **Oui** | Préférence de suivi personnelle |
| Emplacements (`locDoc.nodes`) | `locations` | **Oui** | Organisation personnelle, déjà avec pierres tombales |
| Pull List par numéro (`pulls`) | `pulls` | **Oui** | Personnelle. Les champs de référence (série, numéro, date) sont copiés ; la publication n'est pas transférée |
| Progression de lecture (`readprog`) | `reading_progress` | **Oui** | Personnelle |
| Guides créés ou importés par l'utilisateur (`editorial`, `origin ≠ seed` ou `editedAt`) | `user_guides` | Oui (lot 3.4, facultatif) | Personnels |
| Préférences (thème, vue, sons, haptique, lecture) | `user_settings.prefs` | **Oui** | Confort multi-appareil |
| Profil local | lié à `auth.users` | Liaison seulement | |
| Variantes et catalogue normalisé | — | **Non** | Recalculables depuis les exemplaires |
| Publications du calendrier (Comic Vine, imports) | — | **Non en Phase 3** | Licence Comic Vine non commerciale (lot 2.5) ; à revoir avec un avis juridique |
| Clés et identifiants (Comic Vine, Metron) | — | **Jamais** | Secrets propres à l'appareil |
| Caches, quotas, journaux du scanner, historique de recherche | — | Non | Propres à l'appareil, recalculables |
| Instantanés et sauvegardes locales | — | Non | Protection locale, indépendante du cloud |
| Données numériques héritées (Phase 1) | — | **Jamais** | Hors périmètre produit, conservées localement |
| Historique de valeur (`panel_value_snapshots`) | — | À décider au lot 3.4 | Volumineux, d'intérêt secondaire |

Toutes ces entités relèvent de l'**espace personnel** (Collection et progression personnelle). Aucune n'est lue par Explorer en dehors des contrats définis dans [`../phase4/02-frontieres-collection-explorer.md`](../phase4/02-frontieres-collection-explorer.md).

Couvertures : seule l'**URL** et sa provenance sont synchronisées. Une couverture manuelle stockée en `data:` n'est envoyée qu'au-dessous de 256 Ko. Au-delà, un stockage objet sera nécessaire (décision ultérieure, droits d'image à vérifier).

## 2. Modèle serveur commun
Chaque table personnelle synchronisée porte ces colonnes :

| Colonne | Rôle | Pourquoi |
|---|---|---|
| `user_id uuid` (FK `auth.users`, `on delete cascade`) | Propriétaire | Isolation par la RLS ; suppression de compte |
| `id text` | Identifiant client stable (`s_…`, `loc_…`, `pl_…`, `ek_…`, `gd_…`) | Les fiches existantes gardent leur identifiant. **Clé primaire `(user_id, id)`** : pas de collision entre utilisateurs |
| `data jsonb` | Contenu de la fiche (champs métier) | Le schéma local évolue souvent ; on extrait seulement les colonnes utiles aux index |
| `field_revs jsonb` | `{champ: rev}`, révision de la dernière écriture de chaque champ de premier niveau | Fusion par champ sans historique complet |
| `rev bigint` | Révision serveur, tirée d'une séquence par utilisateur (`user_sync_state.last_rev + 1`) | Ordre total par utilisateur ; curseur de réception (`pull`) |
| `deleted_at timestamptz` | Pierre tombale | Propager les suppressions ; corbeille ; restauration |
| `created_at`, `updated_at timestamptz` | Horodatage serveur | Audit ; jamais utilisé seul pour trancher un conflit (les horloges des appareils dérivent) |
| `updated_by_device uuid` | Appareil auteur | Diagnostic, révocation |
| `schema_version smallint` | Version du format de `data` | Migrations progressives |

Tables techniques :
- `user_sync_state(user_id PK, last_rev bigint)` : compteur par utilisateur, verrouillé par `SELECT … FOR UPDATE` dans `sync_push`.
- `sync_ops(user_id, op_id uuid, applied_rev, result, created_at)`, PK `(user_id, op_id)` : **idempotence**. Rétention de 90 jours.
- `sync_conflicts(id, user_id, entity, entity_id, field, local_value, server_value, base_rev, server_rev, device_id, created_at, resolved_at, resolution)` : **aucune valeur perdante n'est jetée**.

## 3. Protocole
### 3.1 Côté client (`panel-sync`, base IndexedDB distincte)
- `state` : utilisateur lié, `device_id`, curseur `pulled_rev`, dernier succès, version du protocole.
- `shadow` : pour chaque entité synchronisée, la dernière version **connue du serveur** (`data`, `rev`). C'est la base des différences et de la fusion à trois branches.
- `outbox` : opérations en attente, dans l'ordre (`seq` local croissant).
- `conflicts` : conflits reçus, à présenter à l'utilisateur.
- `journal` : les 200 dernières opérations de synchronisation, avec leur résultat.

### 3.2 Capture des changements
1. À chaque persistance d'un domaine, une capture **différée** (1 à 2 s, regroupée) calcule `stableHash(stableJson(fiche))` pour chaque fiche et le compare à `shadow`.
2. Fiche nouvelle : opération `upsert` avec tous les champs. Fiche modifiée : `upsert` avec **seulement les champs de premier niveau modifiés** (le patch) et `base_rev = shadow.rev`. Fiche disparue : `delete` avec `base_rev`.
3. Les opérations portent sur des fiches, pas sur des tableaux. Plusieurs changements de la même fiche encore en attente sont **fusionnés** dans l'outbox, avec le premier `base_rev` conservé.
4. **Garde-fou anti-cataclysme** : si une capture produit plus de 50 suppressions, ou supprime plus de 10 % d'un domaine, l'envoi est **suspendu** et un aperçu est exigé. Cela couvre la restauration, la reprise IndexedDB, un import annulé ou un bug.

### 3.3 Envoi (`sync_push(device_id, ops jsonb)`, fonction RPC `security invoker`)
Une transaction par lot de 200 opérations au plus. Pour chaque opération :
1. `op_id` déjà présent dans `sync_ops` : on renvoie le résultat enregistré (**idempotence** en cas de réponse perdue).
2. On verrouille `user_sync_state` et la ligne de l'entité.
3. Ligne absente : insertion (`rev` suivant ; `field_revs` = tous les champs à ce `rev`).
4. `base_rev = rev` serveur : application directe.
5. `base_rev < rev` serveur : **fusion par champ**. Pour chaque champ du patch :
   - `field_revs[champ] <= base_rev` (le serveur n'a pas touché ce champ depuis la base du client) : on applique ;
   - sinon : **conflit de champ**, résolu par la règle du domaine (§ 4). La valeur écartée est enregistrée dans `sync_conflicts`.
6. Suppression concurrente d'une modification : règles du § 4.
7. On renvoie `{op_id, status: applied|duplicate|merged|conflict|rejected, rev, server_row?}`.

**Autorisation** : `auth.uid()` doit être non nul, l'appareil doit appartenir à l'utilisateur et ne pas être révoqué, la RLS s'applique sur toutes les écritures, avec une limite de taille par opération (`data` ≤ 64 Ko) et par lot.

### 3.4 Réception (`sync_pull(since_rev, limit)`)
- Renvoie les lignes de toutes les tables personnelles avec `rev > since_rev`, pierres tombales comprises, triées par `rev`, par pages de 500, avec `has_more`.
- Le client applique chaque page dans une transaction locale (domaine, puis `shadow`), puis avance `pulled_rev`. Une interruption fait simplement **reprendre à la page suivante**.
- Une ligne reçue qui concerne une fiche modifiée localement **et encore dans l'outbox** déclenche une fusion locale à trois branches (`shadow` = base, serveur, local), selon les mêmes règles, avant d'être réécrite dans l'outbox.

### 3.5 Retries, erreurs, ordre
- **Backoff exponentiel** avec gigue (1 s, 2 s, 4 s… jusqu'à 5 min) ; l'événement `online` réinitialise l'attente.
- Erreurs de réseau ou 5xx : on réessaie le **même** lot (les mêmes `op_id` rendent l'opération sans risque).
- Erreur 4xx de validation : l'opération est mise en quarantaine (`rejected`), montrée à l'utilisateur, **jamais supprimée silencieusement**.
- **Ordre** : FIFO par `seq` local. Un emplacement créé avant d'y ranger un exemplaire part dans le même lot ou dans un lot antérieur. Une référence vers une fiche inconnue du serveur est **acceptée** (pas de contrainte de clé étrangère sur les relations métier), car le client est la source de ses identifiants.
- **Verrou multi-onglets** : `navigator.locks.request('panel-sync')`.

### 3.6 Pierres tombales et purge
- Toute suppression synchronisée devient une **pierre tombale serveur** (`deleted_at`, `data` conservé), visible dans une « corbeille » pendant 30 jours.
- Une restauration depuis la corbeille est un `upsert` normal.
- La purge des pierres tombales de plus de 90 jours est **une tâche différée explicite (lot 3.6)**. Un appareil resté hors ligne plus de 90 jours bascule alors en **resynchronisation complète** avec aperçu (`since_rev` inférieur à la limite de purge, donc réponse `resync_required`).

### 3.7 Migrations de schéma
- `schema_version` par ligne ; le client sait lire N et N-1.
- Une migration de `data` côté serveur est une migration SQL versionnée qui n'augmente pas `rev`, sauf si les clients doivent recevoir le changement.
- Un client trop ancien (version du protocole) reçoit `upgrade_required` : il reste fonctionnel localement, mais sans synchronisation.

## 4. Résolution des conflits par domaine
Pas de stratégie unique : **fusion par champ** partout, puis une règle propre à chaque domaine en cas de conflit sur un même champ. La valeur écartée est **toujours** enregistrée.

| Situation | Règle | Interface |
|---|---|---|
| **Collection** : deux appareils modifient des champs différents d'un même exemplaire | Fusion automatique : les deux changements sont gardés | Rien |
| **Collection** : même champ (prix d'achat, état, note) | Le premier écrit sur le serveur gagne ; la valeur concurrente va en `sync_conflicts` | Badge « 1 conflit », choix « garder / prendre l'autre valeur » |
| **Collection** : champs de liste (`tags`, historique de valeur) | Union dédoublonnée | Rien |
| **Progression de lecture**, même entrée | `history` : union triée par date. `status` : le changement le plus récent selon l'**horloge logique hybride** (HLC = horloge du client + compteur, corrigée par l'heure du serveur à la réception) ; en cas d'égalité, `read` > `reading` > `skipped` > `to_read` | Aucune perte, puisque l'historique conserve les deux |
| **Wishlist** : un appareil ajoute un comic, un autre supprime une fiche wishlist du même comic | Deux fiches différentes, donc deux opérations valides. Après réception, si deux fiches wishlist visent la même variante (`pubId`/série + numéro + variante), on propose la fusion (règle de dédoublonnage existante `sameVariantWish`) | « Doublon possible » |
| **Wishlist** : un appareil passe la fiche en « possédé » (`isWishlist: false`), l'autre la supprime | La modification gagne sur la suppression (résurrection) ; la suppression est consignée | Notification « restaurée car modifiée sur un autre appareil » |
| **Emplacements** : un appareil déplace le comic (`locationId`), un autre modifie son état (`condition`) | Champs différents, fusion automatique | Rien |
| **Emplacements** : l'emplacement cible est supprimé ailleurs | Le comic garde son `locationId`, qui se résout en « (supprimé) », comme aujourd'hui (`locationOf` → `deleted`) | L'exemplaire apparaît « Emplacement supprimé » |
| **Suppression hors ligne** d'un exemplaire modifié sur un autre appareil | **La modification l'emporte** : la fiche reste vivante avec la modification, et la suppression est enregistrée comme conflit | « Supprimé sur l'appareil A mais modifié sur B : supprimer / garder » |
| **Suppression contre suppression** | Idempotente | Rien |
| **Préférences** | Par clé : le plus récent selon la HLC (sans enjeu de perte) | Rien |
| **Séries suivies** | Suivre ou ne plus suivre : le plus récent selon la HLC ; la pull list par numéro n'est jamais supprimée en cascade | Rien |
| **Guides personnels** | Fusion par champ ; ordres et entrées : le plus récent gagne par ordre complet, la version écartée est conservée | Conflit présenté |

Principe de sûreté : **en cas de doute, ne pas supprimer**. Une résurrection non voulue se corrige d'un clic ; une perte, non.

## 5. Identifiants stables
- Les identifiants existants sont conservés tels quels (`s_<ms>_<rand5>`, etc.). Le risque de collision entre deux appareils d'un même utilisateur est faible mais réel.
- Les nouvelles fiches sont créées avec `crypto.randomUUID()` et le préfixe existant (`s_<uuid>`), si nécessaire derrière un générateur unique `newId(prefix)` (lot 3.4).
- **Avant la première synchronisation** : rapport `idReport` (fiches sans identifiant, doublons) avec **correction prévisualisée et explicite**. Aucune fiche sans identifiant unique n'est envoyée.

## 6. Migration d'une collection locale existante vers un compte
Parcours en sept étapes, **jamais automatique** :

1. **Préparation**
   - Sauvegarde JSON complète obligatoire, téléchargée et relue (validation).
   - Instantané local.
   - Rapport de préparation : nombre de fiches par domaine, identifiants à corriger, couvertures volumineuses, secrets qui ne seront pas envoyés.
2. **Liaison** du profil local au compte (après vérification de l'e-mail).
3. **Comparaison avec le cloud**
   - Cloud vide : envoi initial.
   - Cloud non vide : fusion proposée, avec « déjà présent » (même `id`), « probable doublon » (même série, numéro, variante, état et prix, mais identifiants différents) et « nouveau ». **Aucun dédoublonnage automatique.**
4. **Aperçu** : « 4 812 exemplaires à envoyer, 0 suppression, 37 doublons probables à examiner ».
5. **Envoi par lots** de 200, reprenable : l'état est enregistré après chaque lot accepté et les mêmes `op_id` sont réutilisés.
6. **Vérification d'intégrité**, la migration n'est réussie qu'à ce prix :
   - comptes par domaine (serveur, via `sync_pull` complet ou `export_my_data`) égaux aux comptes locaux ;
   - même ensemble d'identifiants ;
   - empreinte de contenu par fiche (`stableHash` des champs synchronisés) identique ;
   - relations vérifiées : `locationId` présents, `pubId` conservés ;
   - champs critiques échantillonnés : prix d'achat, état, emplacement, wishlist, lu.
7. **Résultat**
   - Succès : la migration est marquée « vérifiée », avec date et empreinte globale.
   - Échec : rapport des écarts et nouvel envoi des seules fiches en écart. **Les données locales restent intactes à chaque étape.**
   - **Retour arrière** : délier le compte (local intact) ; côté serveur, effacement des données envoyées sur demande explicite de l'utilisateur.

Volumétrie visée : 10 000 exemplaires en moins de 2 minutes sur une connexion domestique (50 lots), à mesurer au lot 3.4.

## 7. Multi-appareils : scénarios
| Situation | Comportement |
|---|---|
| Premier appareil | Migration (§ 6) ou compte vierge |
| Deuxième appareil, vierge | Réception complète paginée, aperçu, application |
| Deuxième appareil, avec des données locales | Parcours de fusion (§ 6, étape 3) ; jamais d'écrasement |
| Appareil hors ligne plusieurs jours | L'outbox persiste ; à la reconnexion, envoi puis réception avec fusion par champ ; au-delà de 90 jours, resynchronisation complète avec aperçu |
| Modifications simultanées | Fusion par champ, règles du § 4, conflits visibles |
| Appareil retiré ou révoqué | Refusé par le serveur ; ses opérations en attente restent sur l'appareil, exportables |
| Déconnexion | Données conservées par défaut ; outbox conservée et envoyée à la prochaine connexion **du même compte** |
| Réinstallation | Données locales perdues ; reconnexion, puis réception complète |
| Restauration d'une sauvegarde JSON | Locale, puis capture des changements avec aperçu obligatoire (garde-fou anti-cataclysme) |
| Changement de compte | Bloqué tant que les données de l'autre compte sont présentes (retrait ou export d'abord) |

## 8. Pourquoi chaque mécanisme
- **Identifiants stables** : sans eux, pas de correspondance entre appareils ni d'idempotence.
- **`rev` serveur** : ordre total par utilisateur, curseur fiable, indépendant des horloges des appareils.
- **`field_revs`** : fusion par champ sans conserver tout l'historique.
- **`shadow`** : base commune pour les différences et la fusion à trois branches côté client.
- **`op_id` et `sync_ops`** : une réponse perdue n'entraîne jamais de double application.
- **Outbox persistante** : rien ne se perd lors d'une coupure ou d'un redémarrage.
- **Pierres tombales** : une suppression se propage, se restaure et s'audite.
- **Pagination et curseur** : reprise après interruption, volumes importants.
- **Garde-fou anti-cataclysme** : protège contre la propagation d'une erreur locale à tous les appareils.
- **Conflits conservés** : garantie « aucune perte silencieuse ».
