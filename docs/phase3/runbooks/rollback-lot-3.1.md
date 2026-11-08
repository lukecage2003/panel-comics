# Runbook — Retour arrière du lot 3.1

Le lot est **additif**. Aucune donnée utilisateur, aucune base réelle et aucune version IndexedDB n'ont changé.

## Option 1 : Git (recommandée)
```bash
git revert <empreinte du commit du lot 3.1>
```
Cette commande crée un commit inverse et ne réécrit pas l'historique.

## Option 2 : copies de sécurité
Restaurez les fichiers du client à partir des copies prises juste avant le lot :
- `index.html.backup.20261108-lot31`
- `run-all-tests.js.backup.20261108-lot31`
- `sw.js.backup.20261108-lot31`
- `.gitignore.backup.20261107-lot31` (identique au `.gitignore` d'avant le lot)

Les copies `*.backup.20261107-lot31`, plus anciennes, sont également conservées.

## Ce qui disparaît avec le retour arrière
- `backend/`, `scripts/check-secrets.js`, `package.json`, `package-lock.json` et `node_modules/` (ce dernier n'est pas versionné) ;
- les runbooks et le registre `SYNC_DOMAINS` / `Panel.sync.readiness()` du client.

## Ce qui ne change pas
Les données locales restent intactes :
- `localStorage` ;
- `panel-library` v3 et `panel-catalog` v4 ;
- les PDF et CBZ, les notes, les annotations, les marque-pages ;
- les sauvegardes et les instantanés.

Le service worker doit être réinstallé pour reprendre l'ancienne version, ce qui se fait automatiquement au rechargement.
