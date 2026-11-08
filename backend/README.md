# Backend Panel (Phase 3)

Fondations du backend livrées au lot 3.1 : un schéma PostgreSQL compatible Supabase, versionné et testé **sans Docker ni compte cloud**. Aucun projet Supabase n'existe à ce stade, et l'application n'envoie rien au réseau (`PANEL_SYNC_ENABLED = false`).

## Commandes (depuis la racine du dépôt)
| Commande | Effet |
|---|---|
| `npm ci` | Installe la seule dépendance de développement, PGlite (version figée dans `package.json` et `package-lock.json`) |
| `npm run test:db` | Applique les migrations sur une base PGlite neuve et lance les tests (`node:test`). Écrit aussi `backend/tests/report.txt`, qui n'est pas versionné |
| `npm run check:secrets` | Cherche des secrets dans les fichiers suivis par Git ; renvoie 1 en cas de correspondance |
| `npm run test:all` | `test:db`, puis `check:secrets`, puis la suite du front (`node run-all-tests.js`) |

## Structure
```
backend/
  .env.example            noms de variables, sans valeur (jamais de clé de service)
  supabase/
    config.toml           configuration de la Supabase CLI, sans secret
    migrations/           10 migrations horodatées (7e : durcissement ; 8e : RPC de synchronisation, lot 3.4 ; 9e : export, effacement, purge, lot 3.6 ; 10e : rôles, profil, préférences HLC, appareils, lot 3.3)
    seed.sql              données fictives (@exemple.test)
  tests/
    auth-stub.sql         schéma auth minimal (en test seulement ; Supabase fournit le vrai)
    harness.js            PGlite, stub, migrations, rôles anon et authenticated, asUser(uuid)
    schema.test.js        tables, colonnes, types, contraintes, index, cascade
    rls.test.js           isolation entre utilisateurs, anon refusé, test de mutation
    triggers.test.js      rev monotone par utilisateur, updated_at
    migrations.test.js    ordre, rejeu déterministe, conventions, seed
    secrets.test.js       sensibilité et masquage du détecteur de secrets
    hardening.test.js     défauts corrigés par la migration 7, rev sous transaction, privilèges
    sync.test.js          lot 3.4 : sync_push / sync_pull, idempotence, conflits, curseurs, coupures, 3 appareils simulés
    verify-supabase.sql   contrôle du schéma, réutilisable sur Supabase local (psql)
  sync-engine/
    engine.js             moteur client (outbox, lots, pages, reprise) ; transport et stockage injectés, aucun appel réseau
    adapters.js           adaptateurs Supabase : transport RPC (api.sync_push / sync_pull), session (supabase-js), stockage Web ; testés avec un faux client adossé à PGlite
```

## Schéma `app` (données personnelles uniquement)
- **12 tables** (la 12e, `reading_states`, au lot 3.4) **:**
  - profil et réglages : `profiles`, `user_settings`, `devices` ;
  - synchronisables : `copies`, `locations`, `pulls`, `series_follows`, `reading_progress`, `reading_states` ;
  - techniques : `user_sync_state`, `sync_ops`, `sync_conflicts`.
- **RLS :** activée sur toutes les tables. Politiques `to authenticated` par opération, avec `(select auth.uid()) = user_id`. Les tables techniques sont en lecture seule. `anon` n'a aucun droit.
- **Déclencheurs :**
  - `app.assign_rev()` (`security definer`, `search_path` vide) : révision strictement croissante par utilisateur ;
  - `updated_at` : horodatage serveur, `created_at` conservé.
- **Écritures (lot 3.4, D-31) :** un client n'écrit plus directement dans les tables synchronisées. Il passe par `api.sync_push` et lit par `api.sync_pull` (`security definer`, `search_path` vide, `authenticated` seulement). Les suppressions sont des pierres tombales.
- **Schémas réservés, non créés :** `catalog`, `editorial`, `media`, `signals` (Explorer 2.0) et `community`.

## Conventions de migration
- **Nom :** `AAAAMMJJHHMMSS_description.sql`.
- **Fichier figé :** jamais modifié une fois commité. Toute correction passe par une nouvelle migration.
- **Pas de destruction sans préparation :** jamais de `drop` ni de `truncate` sans une migration de données et une sauvegarde (le test `migrations.test.js` le contrôle).
- **Schéma `auth` :** jamais créé dans `migrations/`.

## Écarts connus entre PGlite et Supabase
- **Schéma `auth` simulé :** le vrai fournit des colonnes et fonctions supplémentaires ; seuls `auth.users(id)` et `auth.uid()` sont utilisés.
- **Version de PostgreSQL :** PGlite 0.5.11 embarque PostgreSQL 18.6, alors que `config.toml` vise 17. Aucune fonctionnalité propre à la 18 n'est utilisée.
- **Validation de référence :** `supabase db reset` sous Docker n'a pas été exécuté (ni Docker ni la CLI ne sont installés). Procédure prête : [`docs/phase3/09`](../docs/phase3/09-audit-cloture-lot-3.1.md) § 6.
- **Upserts et révisions :** un `INSERT … ON CONFLICT DO UPDATE` déclenche `BEFORE INSERT` puis `BEFORE UPDATE` ; il consomme donc deux révisions. Elles restent strictement croissantes, avec un trou. Le lot 3.4 (`sync_push`) devra en tenir compte, ou utiliser un `UPDATE` puis un `INSERT` explicites.

## Runbooks
Dans [`../docs/phase3/runbooks/`](../docs/phase3/runbooks/) :
- [migrations](../docs/phase3/runbooks/migrations.md) ;
- [secrets](../docs/phase3/runbooks/secrets.md) ;
- [sauvegarde et restauration](../docs/phase3/runbooks/sauvegarde-restauration.md) ;
- [retour arrière du lot 3.1](../docs/phase3/runbooks/rollback-lot-3.1.md).
