# Domaines préparés (non branchés)

Modules autonomes écrits pendant la mission « Autonomous night shift » (8 novembre 2026). Ils sont **implémentés et testés localement** avec des données synthétiques, mais **ne sont pas branchés** à `index.html`. Ils n'utilisent ni le réseau, ni le stockage, ni les données personnelles.

| Module | Rôle | Conception |
|---|---|---|
| `explorer/catalog-core.js` | Fondations Explorer 2.0. Entités typées (`kind`) et relations génériques contrôlées. Périmètre `medium === 'comic'` (D-12). Recherche locale tolérante (accents, fautes et inversions, préfixes, alias VO/VF). Pages d'entité avec leurs « portes ». Ordre de lecture des événements. Recommandations motivées. Actualités sourcées et datées. | [07 partie A](../docs/directeur/07-conception-explorer-2.0-community.md) |
| `community/policy-core.js` | Fondations Communauté. Publier revient à copier, d'après une liste blanche : jamais de prix, de valeur, d'emplacement ni de note. Visibilité, blocage, rôles, limites anti-abus, liens refusés aux comptes neufs, avertissement sur les données personnelles. Signalements, décisions motivées, retrait réversible et appel. | [07 partie C](../docs/directeur/07-conception-explorer-2.0-community.md) |

Tests : `npm run test:domains` (inclus dans `npm run test:all`).

Le module Explorer ne lit jamais Collection. Une personnalisation, par exemple masquer ce que l'on possède déjà, ne passe que par un filtre `exclude` fourni par l'appelant (contrat S1, sur l'appareil). Aucun schéma SQL réservé (`catalog`, `editorial`, `media`, `signals`, `community`) n'est créé.
