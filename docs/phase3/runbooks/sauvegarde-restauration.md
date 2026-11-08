# Runbook — Sauvegarde et restauration du backend

Lot 3.1 : aucune base réelle n'existe. Ce runbook décrit la procédure pour la préproduction et la production (lot 3.2 et suivants) ; **il n'a pas été exécuté**.

## Sauvegarde (avant toute migration en préproduction ou en production)
```bash
pg_dump "$DATABASE_URL" --schema=app --format=custom --no-owner --file=panel-app-AAAAMMJJ-HHMM.dump
```
- `DATABASE_URL` vient du tableau de bord Supabase. Elle n'est jamais versionnée.
- Le fichier contient des données personnelles. Rangez-le hors du dépôt, chiffré, et ne le versionnez **jamais**.
- Les sauvegardes automatiques de Supabase (formule Pro) complètent cette sauvegarde manuelle, sans la remplacer.

## Restauration (toujours d'abord dans un projet de test)
```bash
pg_restore --dbname="$TEST_DATABASE_URL" --schema=app --no-owner --clean --if-exists panel-app-AAAAMMJJ-HHMM.dump
```
1. Restaurez dans un projet de test, jamais directement en production.
2. Vérifiez :
   - le nombre de lignes par table ;
   - la RLS active : `select relname from pg_class where relnamespace = 'app'::regnamespace and not relrowsecurity` ne doit renvoyer aucune ligne ;
   - les tests `npm run test:db` sur le schéma.
3. Ne restaurez en production qu'avec l'accord de l'utilisateur, après une nouvelle sauvegarde de l'état courant.

## Données locales de l'application
Les sauvegardes JSON, les instantanés IndexedDB et les fichiers `*.backup*` restent indépendants du backend, et ce runbook ne les touche pas.

## Vérification au lot 3.1
Le critère 8 a été vérifié en local uniquement, par le test « rejeu à vide identique » : deux bases neuves produisent un schéma strictement identique. Un vrai couple `pg_dump` / `pg_restore` n'a pas été exécuté, faute de PostgreSQL natif et de Docker.
