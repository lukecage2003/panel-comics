# Phase 3 · 09 — Audit de clôture du lot 3.1 (8 novembre 2026)

Point de départ : commit `a39c7da`. Le schéma et les tests sont dans [`backend/`](../../backend/README.md).

**Verdict : fondations prêtes pour le lot 3.2**, une fois la migration 7 et les corrections de tests ci-dessous intégrées, et sous trois réserves :
1. **Validation de référence Supabase non exécutée** : ni Docker ni la CLI ne sont installés (§ 6).
2. **Concurrence prouvée par raisonnement, pas par un test** : PGlite n'ouvre qu'une seule connexion (§ 4).
3. **Deux règles à imposer au lot 3.4** : pierres tombales obligatoires et écriture par `sync_push` seulement (§ 4.3).

## 1. État vérifié
- **Dépôt :** branche `main`, HEAD `a39c7da`, arbre propre au départ.
- **Contenu :** 6 migrations, 6 fichiers de tests, 4 runbooks.
- **Sauvegardes :** `*.backup.20261108-lot31` (3 fichiers) présentes.
- **Outils :** ni Docker ni la CLI Supabase.

## 2. Migrations
- **Ordre et dépendances : correct.**
  - 1 → schémas `app` et `extensions`, `citext` ;
  - 2 → `profiles`, `user_settings`, `devices` ;
  - 3 → tables synchronisables ;
  - 4 → tables techniques ;
  - 5 → RLS et droits ;
  - 6 → déclencheurs.

  Les politiques (5) dépendent d'`auth.uid()`, fourni par la plateforme ; les déclencheurs (6) dépendent de `user_sync_state` (4).
- **Tables, clés étrangères, index :** les 11 tables sont présentes, chaque clé étrangère vers `auth.users` est en cascade, et chaque table a un index qui commence par `user_id`.
- **Réexécution :** une migration déjà appliquée échoue au lieu de passer silencieusement, et l'échec ne modifie rien (testé). La Supabase CLI tient elle-même le registre des migrations appliquées.
- **Cohérence avec les tests :** les noms de contraintes et d'index sont vérifiés un par un, et deux bases neuves produisent un schéma identique.

## 3. Sécurité : défauts démontrés et corrigés (migration `20261108000007_hardening.sql`)
| # | Défaut | Preuve avant correction | Correction | Test |
|---|---|---|---|---|
| D1 | Un utilisateur pouvait annuler la révocation de son propre appareil (`revoked_at = null`) et falsifier `last_sync_rev` | La mise à jour était acceptée | Droits par colonne : `insert` et `update` limités à `label`, `app_version` et `last_seen_at` (plus `id`, `user_id` et `platform` à l'insertion) | `hardening.test.js` D1 |
| D2 | `field_revs` sans limite : 2 Mo acceptés, ce qui contournait la règle des 64 Ko par ligne | Insertion acceptée | `field_revs` ≤ 16 Ko sur les 5 tables synchronisées | D2 |
| D3 | Colonnes extraites sans limite (`issue_number`, `parent_id`, `kind`, `guide_id`, `entry_id`) ; `series_key` n'était arrêtée que par l'erreur d'index de PostgreSQL | Erreur 54000 (taille d'index dépassée) au lieu d'un refus explicite | Bornes explicites : 300, 50, 100 ou 40 caractères selon la colonne | D3 |
| — | Défense en profondeur | Aucun droit constaté, mais une plateforme pourrait en accorder par défaut | `revoke` explicite des fonctions `app.*` pour `anon` et `authenticated` | Privilèges |

Les migrations 1 à 6 ne sont **pas modifiées** : la convention l'interdit, et elles pourraient déjà avoir été appliquées ailleurs.

**Risques couverts par de nouveaux tests** (`hardening.test.js`), parce que les tests initiaux ne les couvraient pas vraiment :
- **`assign_rev` (`security definer`)** : une tentative sur la ligne d'un autre utilisateur ne touche pas son compteur, qu'il s'agisse d'une insertion, d'un upsert en conflit ou d'une mise à jour.
- **Privilèges :** `anon` n'a aucun droit sur aucune table ; `authenticated` n'a ni `truncate`, ni `references`, ni `trigger`, et aucune fonction `app` ne lui est exécutable.
- **Contrôle global :** [`verify-supabase.sql`](../../backend/tests/verify-supabase.sql) vérifie 11 tables, 35 politiques, une RLS à 100 %, `anon` sans droit, les droits par colonne, `assign_rev` et les cascades. Un test montre qu'il détecte une RLS désactivée ou un droit accordé à `anon`.

**Constats sans défaut :**
- **Suppression de compte :** la cascade vide les 11 tables (testé).
- **Erreurs :** elles exposent des noms de contraintes, pas de données d'autres utilisateurs.
- **Secrets :** 0 correspondance, et `.env.example` reste vide.
- **Données personnelles :** `seed.sql` est entièrement fictif.

## 4. Révisions (`rev`)
### 4.1 Garanties démontrées par les tests
- **Monotonie :** strictement croissante sur 1 000 écritures.
- **Indépendance :** les compteurs de deux utilisateurs sont indépendants.
- **Valeur client ignorée :** une valeur de `rev` fournie par le client est remplacée.
- **Transactions :**
  - plusieurs écritures dans une même transaction reçoivent des révisions consécutives ;
  - une transaction annulée ne consomme rien et ne laisse aucune ligne, même après une instruction en échec en cours de route.
- **Pierres tombales :** une suppression logique (`deleted_at`) reçoit une nouvelle révision et apparaît bien après le curseur.

### 4.2 Concurrence : par raisonnement, non testée (PGlite n'a qu'une connexion)
- L'upsert sur `user_sync_state` pose un verrou de ligne, conservé **jusqu'à la fin de la transaction**. Deux transactions d'un même utilisateur sont donc sérialisées : la seconde obtient `last_rev + 1` seulement après la validation (ou l'annulation) de la première.
- Conséquence : les révisions deviennent visibles **dans l'ordre de validation**. Un lecteur ne peut pas voir la révision N+1 sans N. Le curseur `rev > since_rev` du lot 3.4 ne peut donc pas sauter une ligne validée en retard.
- **Pas de collision possible** : une seule ligne de compteur par utilisateur, mise à jour sous verrou.
- **Coût :** les écritures d'un même utilisateur sont sérialisées, ce qui est acceptable ; une longue transaction bloque ses autres appareils.
- **À vérifier en environnement réel** (lot 3.4, base Supabase locale) : deux sessions concurrentes, 2 × 500 écritures entrelacées, ordre de validation égal à l'ordre des révisions.

### 4.3 Limites à traiter au lot 3.4 (le protocole n'est pas modifié dans ce lot)
| Constat | Effet | Mesure prévue au lot 3.4 |
|---|---|---|
| Un upsert en conflit consomme deux révisions (`BEFORE INSERT` puis `BEFORE UPDATE`) | Trous dans la numérotation, sans conséquence sur l'ordre ni la détection | Aucune correction nécessaire. `sync_push` peut faire un `UPDATE … RETURNING` puis un `INSERT` si aucune ligne n'est touchée, ce qui évite les trous |
| Une **suppression physique** est possible et **invisible** pour un curseur `rev` (démontré par un test) | Un autre appareil ne saurait jamais qu'une fiche a été supprimée | Retirer le droit `DELETE` sur les tables synchronisées : les suppressions passent par `deleted_at`, et la purge (lot 3.6) devient une tâche du service |
| Une écriture directe dans les tables contourne `sync_push` (`field_revs`, `sync_ops`, conflits) | Fusion par champ et idempotence non garanties | `sync_push` est prévue en `security invoker` (`04` § 3.3) ; elle a donc besoin des droits d'écriture. **Option recommandée :** `security definer` avec un contrôle explicite d'`auth.uid()`, et retrait des droits `INSERT`, `UPDATE` et `DELETE` directs. À trancher au début du lot 3.4 ([`10`](10-dossier-lots-3.2-3.7.md) § 3) |
| Toute mise à jour par le serveur incrémente `rev` (le déclencheur s'applique à tous) | Une migration de `data` côté serveur serait renvoyée à tous les appareils | Variable de session `app.skip_rev` respectée par `assign_rev`, réservée au service, au moment de la première migration de données (`04` § 3.7) |

## 5. Sauvegarde et restauration (critère 8)
- **Ce qui a été testé :** `dumpDataDir` et `loadDataDir` de PGlite, qui copient le **répertoire de données entier**. Sont donc inclus le schéma `app`, les données, les rôles, les politiques, l'état du compteur `rev`, le schéma `auth` simulé et l'extension `citext`.
- **Résultat après restauration :** schéma identique, données identiques, RLS active, et la séquence `rev` reprend là où elle s'était arrêtée.
- **Exclu :** rien n'est exclu de la sauvegarde PGlite. À l'inverse, le `pg_dump --schema=app` du runbook exclut `auth` : la restauration en préproduction suppose donc que les utilisateurs existent déjà dans le projet cible.
- **Compatibilité :** un répertoire PGlite n'est relisible que par une version de PGlite de même version majeure de PostgreSQL (18). Ce n'est **pas** un format d'échange vers Supabase : vers Supabase, on utilise `pg_dump` et `pg_restore` ([runbook](runbooks/sauvegarde-restauration.md)).
- **Après un échec :** une restauration ratée ne touche pas la base d'origine (on restaure dans une base neuve). Le runbook impose une base de test avant toute production.

## 6. Validation Supabase (A7) : non exécutée, procédure prête
Docker et la Supabase CLI ne sont pas installés. Je ne les ai pas installés : cela demande votre accord, et ce n'est pas indispensable au lot 3.1.

**Procédure** (machine avec Docker Desktop et la Supabase CLI, aucun projet distant) :
```bash
cd backend
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f tests/verify-supabase.sql
supabase stop
```
- `supabase db reset` applique les 7 migrations, puis `seed.sql`.
- **Résultat attendu :** la notice « schéma app conforme ».
- **Risques à observer :**
  - l'insertion de `seed.sql` dans `auth.users` avec seulement `id` et `email` : si la plateforme exige d'autres colonnes, compléter le seed, sans toucher aux migrations ;
  - PostgreSQL 17 sous Supabase, contre 18 sous PGlite ;
  - les droits par défaut propres à Supabase sur le schéma `app`, que la migration 7 neutralise pour les fonctions et que `verify-supabase.sql` contrôle pour les tables.

## 7. Tests
- **Base :** `npm run test:db` passe à **80/80**.
- **Secrets :** `npm run check:secrets` donne 0 correspondance.
- **Front :** `node run-all-tests.js` passe à **30/30** après la stabilisation du test 18.
- **Test 18 intermittent :** `runCoverJob()` ne fait rien si un traitement précédent tourne encore (`if (coverJob.running) return`). Le test attend désormais que la file soit au repos et journalise un diagnostic (`quotaDiag`) en cas d'échec. L'application n'est pas modifiée. **La cause est une hypothèse étayée, pas une preuve** : l'échec ne s'est pas reproduit.

## 8. Risques résiduels
1. **Validation de référence Supabase** non exécutée (§ 6).
2. **Concurrence réelle** non testée (§ 4.2).
3. **Écritures directes et suppressions physiques**, à fermer au lot 3.4 (§ 4.3).
4. **Profils :** `created_at` peut être fixé par le client à l'insertion. Sans enjeu de sécurité, et `profiles` n'est pas synchronisé par `rev`.
