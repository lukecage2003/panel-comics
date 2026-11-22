# PANEL 2.0 — Vision stratégique

Rédigé le 14 novembre 2026, après un audit du dépôt (voir [`PANEL_2_REPOSITORY_AUDIT.md`](PANEL_2_REPOSITORY_AUDIT.md)). Ce document fait évoluer la vision du [PRD V1](../prd/PANEL_PRD_V1.md) sans la remplacer : le PRD V1 reste la référence pour le produit actuel (collection, lecture, Explorer, communauté), et PANEL 2.0 décrit la couche qui s'y ajoute.

## 1. Ce que PANEL est déjà

PANEL n'est pas un projet à démarrer. C'est une application en service, construite en 76 décisions consignées (`docs/DECISIONS.md`, D-01 à D-76). Elle fonctionne aujourd'hui **sur l'appareil**, sans compte en ligne :

- **Collection** : exemplaires physiques, variantes, emplacements (pièce, meuble, boîte, séparateur), cote, finances, import/export (CLZ, League of Comic Geeks, tableur), scanner de code-barres et reconnaissance de couverture.
- **Lecture** : journal de lecture, séries en cours, prochain numéro, lectures importées sans fausse fiche.
- **Sorties** : calendrier du mercredi (US et francophonie), Pull List, Wishlist.
- **Explorer** : catalogue local, guides de lecture, fiches événement, recoupement de sources, actualités en français, dossiers « Avant de voir ».
- **Communauté** : planches, stories, fil façon Instagram, profil, rangs et trophées, tout en brouillon local ; schéma serveur et modération préparés (migration 13), pas encore ouverts.

PANEL 2.0 ne reconstruit rien de cela. Il ajoute une **couche de connaissance vérifiable** au-dessus de ce qui existe.

## 2. Positionnement

| | |
|---|---|
| Identité | PANEL |
| Marché de lancement | Francophonie (France, Belgique, Suisse, Québec, Luxembourg), déjà reflétée dans le calendrier (D-75) |
| Ambition | Mondiale, avec une architecture prête pour plusieurs langues |
| Équilibre | Collection, lecture et communauté au même rang ; la connaissance documentaire les relie |
| Modèle | Freemium ; le social essentiel reste gratuit (PRD-D9) |
| Stratégie technique | Évolution du client existant (`index.html` + `domains/**`) et du backend Supabase préparé (PRD-D1, PRD-D2) |

## 3. La différence de PANEL

Les outils existants se répartissent en silos. Les gestionnaires de collection (CLZ, League of Comic Geeks) ne savent pas *pourquoi* deux informations divergent. Les wikis (Fandom) ne distinguent pas un fait établi d'une interprétation, et ne montrent pas leurs sources au niveau de l'affirmation. Les réseaux sociaux mesurent la popularité, pas la validité.

PANEL se différencie par trois engagements, déjà visibles dans le code :

1. **Chaque information dit d'où elle vient.** La provenance par champ (lot 2.5), le recoupement de sources avec divergences conservées (`domains/explorer/events-crossref.js`, D-51) et les niveaux de fiabilité de l'atlas Marvel (`data/cosmos-marvel.json`, champ `CZ_CERT`) en sont les premières briques.
2. **Rien n'est inventé.** Aucune donnée simulée, aucun faux abonné, aucun prix fictif (règle constante depuis D-34 ; rappelée dans D-76).
3. **La collection personnelle reste privée par construction.** Publier, c'est copier selon une liste blanche (`domains/community/policy-core.js`) : jamais de prix, de valeur, d'emplacement ni de note.

PANEL 2.0 étend ces engagements à toute la connaissance comics : éditions, continuités, adaptations, débats, recherches.

## 4. Objectifs

### Objectifs de lancement (francophonie)

- Devenir l'outil de référence pour **relier VO et VF** (Marvel/DC/Image ↔ Panini, Urban, Delcourt…) : aujourd'hui, aucun outil grand public ne le fait bien. C'est le premier besoin concret du marché francophone.
- Ouvrir les comptes et la communauté (lots 3.2 et 3.3), condition préalable à toute contribution.
- Faire vérifier les premières fiches documentaires par des contributeurs identifiés.

### Objectifs mondiaux

- Un référentiel d'éditions internationales vérifiable (Edition Intelligence).
- Une documentation des continuités qui explique les contradictions au lieu de les effacer (Canon).
- Un écosystème ouvert (API, widgets) sous licences claires (Open).

### Ce que PANEL ne fera pas

- Pas de lecture ni de redistribution de scans (PANEL a retiré sa partie numérique en phase 1, `be3d280`, données conservées).
- Pas d'**Atlas** : PANEL ATLAS est abandonné. Les relations narratives existent dans les données (Canon) sans devenir un produit cartographique autonome. Voir la décision ouverte DR-01 dans [`PANEL_2_DECISIONS_REQUIRED.md`](PANEL_2_DECISIONS_REQUIRED.md) sur la page de cartes cosmiques déjà présente dans Explorer.
- Pas de statistiques internes présentées comme représentatives du marché (Signal).
- Pas de réputation fondée sur le volume ou la popularité (ID).

## 5. Principes directeurs

| Principe | Conséquence |
|---|---|
| Évolution, pas reconstruction | Chaque module de PANEL 2.0 part d'un existant identifié (voir la matrice de l'audit). |
| Preuve avant affirmation | Une affirmation documentaire porte sa source, son statut (établi, interprétation, hypothèse) et son historique. |
| Séparation des domaines | Explorer ne lit jamais Collection (contrat S1, `scripts/check-boundaries.js`). PANEL 2.0 conserve cette frontière. |
| Gratuit pour l'essentiel | Consulter, collectionner, lire, débattre et contribuer restent gratuits. |
| Local d'abord, serveur ensuite | Ce qui fonctionne sur l'appareil continue de fonctionner hors ligne ; le serveur ajoute le partage et la vérification. |
| Internationalisation préparée | Libellés, dates, formats et contenus pensés pour plusieurs langues, en commençant par le français. |

## 6. Documents liés

| Document | Contenu |
|---|---|
| [`PANEL_2_REPOSITORY_AUDIT.md`](PANEL_2_REPOSITORY_AUDIT.md) | État réel du dépôt, matrice de l'existant |
| [`PANEL_2_GLOBAL_ARCHITECTURE.md`](PANEL_2_GLOBAL_ARCHITECTURE.md) | Placement des neuf modules dans l'architecture actuelle |
| [`PANEL_2_DATA_ARCHITECTURE.md`](PANEL_2_DATA_ARCHITECTURE.md) | Modèle de données progressif, affirmations documentées |
| [`PANEL_2_MODULE_SPECIFICATIONS.md`](PANEL_2_MODULE_SPECIFICATIONS.md) | Les neuf modules, de l'existant au manquant |
| [`PANEL_2_AI_STRATEGY.md`](PANEL_2_AI_STRATEGY.md) | IA d'assistance, vérification humaine, options locales |
| [`PANEL_2_SECURITY_GOVERNANCE.md`](PANEL_2_SECURITY_GOVERNANCE.md) | Sécurité, RGPD, droits, gouvernance documentaire |
| [`PANEL_2_BUSINESS_MODEL.md`](PANEL_2_BUSINESS_MODEL.md) | Freemium, Premium, services professionnels, coûts |
| [`PANEL_2_ROADMAP.md`](PANEL_2_ROADMAP.md) | Phases, dépendances, risques, indicateurs |
| [`PANEL_2_DECISIONS_REQUIRED.md`](PANEL_2_DECISIONS_REQUIRED.md) | Arbitrages qui reviennent au porteur du projet |
