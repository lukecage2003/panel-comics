# Runbook — Migrations

## Créer une migration
1. Créez `backend/supabase/migrations/AAAAMMJJHHMMSS_description.sql`. L'horodatage doit être postérieur à celui de la dernière migration.
2. N'ajoutez que des changements additifs. Une suppression ou un renommage demande :
   - une migration de données ;
   - une sauvegarde (voir [sauvegarde-restauration](sauvegarde-restauration.md)) ;
   - l'accord écrit de l'utilisateur.
3. Toute nouvelle table du schéma `app` doit :
   - activer la RLS ;
   - avoir ses politiques par opération ;
   - avoir un index sur `user_id` ;
   - ne rien accorder à `anon`.
4. Ajoutez les tests correspondants dans `backend/tests/`, au moins un positif et un négatif par politique, et mettez à jour la liste de `schema.test.js`.

## Tester
```bash
npm run test:db
```
La base PGlite est neuve à chaque fichier de test, sans Docker ni réseau. Avec Docker et la Supabase CLI, faites aussi une validation de référence :
```bash
supabase db reset
```

## Appliquer (lot 3.2 et suivants, jamais au lot 3.1)
- **Préproduction :** `supabase db push`, depuis une révision taguée, sur le projet créé par l'utilisateur.
- **Production :** même procédure après la préproduction, avec une sauvegarde préalable (`pg_dump`).
- Une migration déjà appliquée ne se modifie **jamais**. Pour corriger, ajoutez une migration.

## Revenir en arrière
- **Avant toute application à une base réelle :** `git revert` du commit qui ajoute la migration.
- **Après application :** écrivez une migration inverse, testée sur une copie, puis restaurez la sauvegarde si nécessaire. On ne supprime jamais les données sans l'accord de l'utilisateur.
