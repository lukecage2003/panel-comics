# Plan directeur 2.0 · 01 — État des lieux et audit global

Statut : **document de conception** (7 novembre 2026). Aucun code n'a été modifié pour le produire.

Légende :
- **[Fait]** : constaté dans le code (`index.html`, commit `2913764`, identique à `93f15db` pour le code) ;
- **[Doc]** : écrit dans un document du dépôt, sans implémentation ;
- **[Hyp.]** : hypothèse non vérifiée ;
- **[Reco.]** : recommandation.

Les numéros de ligne renvoient à `index.html`.

Ce document **ne refait pas** les audits existants ; il les résume et y renvoie :
- audit technique : [`../phase3/01-audit-technique.md`](../phase3/01-audit-technique.md) ;
- analyse d'Explorer 2.0 : [`../phase4/01-analyse-et-impacts.md`](../phase4/01-analyse-et-impacts.md) ;
- couplages : [`../phase4/02-frontieres-collection-explorer.md`](../phase4/02-frontieres-collection-explorer.md).

## 1. État réel de Panel

### 1.1 Architecture
| Élément | État |
|---|---|
| Application | Un seul `index.html` (~12 850 lignes, JavaScript natif en IIFE), PWA (`sw.js`), Android via Capacitor (`android-app/`) **[Fait]** |
| Stockage | localStorage (`panel_physical_singles`, `panel_value_snapshots`, `panel_locations`, `panel_series_meta`…) et IndexedDB (`panel-library` v3, `panel-catalog` v4 avec `publications`, `pulls`, `editorial`, `readprog`) **[Fait]** |
| Backend | Aucun. Supabase / Postgres décidé (D-03), conçu en Phase 3, lot 3.1 suspendu avant tout code (D-06) **[Doc]** |
| Images | URL externes et couvertures manuelles locales ; R2 décidé (D-04), conçu dans [`phase4/07`](../phase4/07-architecture-images-r2.md) **[Doc]** |
| Tests | `run-all-tests.js` : 28 tests Edge/CDP, 28/28 au dernier passage (`93f15db`, code inchangé depuis) **[Fait]** |
| Dépôt Git | Branche `main`, aucun dépôt distant **[Fait]** |

### 1.2 Implémenté, partiel, seulement documenté
| Domaine | Implémenté **[Fait]** | Partiel | Seulement documenté **[Doc]** |
|---|---|---|---|
| Collection | Fiches d'exemplaires, wishlist, séries, emplacements (pièce → meuble → boîte → séparateur), scan code-barres et couverture, import CSV, cote automatique, historique de valeur, tableau de bord, Pull List, exports v2/v3 | Modèle financier (voir [`02`](02-audit-financier.md)) ; quantité (import seulement) | Sauvegarde par domaine B1 |
| Lecture | `isRead` et note par exemplaire ; progression des guides (`readprog`, écrite par Explorer) | Aucune entrée de navigation propre ; deux progressions parallèles | Domaine Lecture propriétaire de la progression (A3) |
| Explorer | Recherche, créateurs, séries, éditeurs (dérivés de la collection), calendrier des sorties, guides éditoriaux | Sorties qui incluent encore les mangas (l. 7476, 7556) | Explorer 2.0 (catalogue serveur, événements, Key Issues, classements), séparation C1 à C10 |
| Community | — | — | Domaine indépendant futur (D-15), C-0 à préparer |

### 1.3 Dépendances et couplages encore présents dans le code
Tous **[Fait]**, tous décrits dans [`phase4/02`](../phase4/02-frontieres-collection-explorer.md) § 3. **Aucun n'est résolu.**

- **C1 à C10** : Explorer lit Collection :
  - navigation (l. 1761–1768) ;
  - index et recherche (l. 9400–9510, dont la catégorie « Ma collection ») ;
  - écriture de `readprog` (l. 9354, 9395, 9938).
- **D1 à D4** : Collection dépend d'Explorer :
  - `goSingles` (l. 6952–6975) ;
  - les exports v2 et v3 qui embarquent `explorer` et `releases` (l. 11414, 11487, 12440–12448).
- **E1 à E5** : le module calendrier et Pull List (l. 7446–9195) écrit directement `physicalSingles` (l. 8649–8692) et partage la base `panel-catalog`.

### 1.4 Décisions validées et en attente
- Validées : D-01 à D-16, dans [`../DECISIONS.md`](../DECISIONS.md).
- En attente : P1, G2, N1 à N5, M-A à M-E, B1-a à B1-c, M1 à M4, R2, choix de Phase 3, points juridiques.
- Ce plan directeur en ajoute quelques-unes (F-D1 à F-D6, U-D1 à U-D3), listées dans [`04`](04-backlog-feuille-de-route-decisions.md) § 4.

### 1.5 Problèmes déjà connus, non résolus
- Séparation des domaines non réalisée (lot 3.1b proposé, G2 en attente).
- A7 (« Ma collection » dans la recherche d'Explorer) non réalisé.
- Les Sorties incluent les mangas, en contradiction avec D-12 (correction prévue au lot 3.1b ou 4.6, voir [`phase4/04`](../phase4/04-perimetre-sorties-comics.md)).
- Les secrets (`panel_comicvine_key`, `panel_metron_creds`) sont inclus dans les exports par défaut ([`phase3/05`](../phase3/05-sauvegardes-confidentialite.md) § 1).

## 2. Audit global par domaine

### 2.1 Collection

**Gravité P0 : intégrité des calculs.** Le détail est dans [`02`](02-audit-financier.md).
1. Une valeur absente est remplacée par le prix de couverture, puis par 0, dans **tous** les totaux (l. 4817–4818).
2. « Investi » est sous-titré « prix payés » (l. 1900–1902), mais additionne des prix de couverture quand le prix payé est inconnu.
3. Les cotes automatiques heuristiques (source `auto`, confiance « moyenne » ou « faible », l. 6308–6318) sont additionnées avec les cotes manuelles et marché, sans distinction.
4. Tous les montants s'affichent en dollars (l. 4805, libellés l. 2441–2451), et `null` s'affiche « $0.00 ».
5. Un état « NM 9.4 (Near Mint) » est inventé à la création depuis les sorties et la wishlist (l. 8617, 8683). Il alimente directement la cote, car le multiplicateur de grade 9.4 vaut 1 (l. 6295–6298).

**P1 : modèle incomplet.**
- Pas de frais, de port, de lots, de devise d'achat, de vente ni de sortie de collection.
- `isOwned = !isWishlist` (l. 4816) : un exemplaire vendu doit être supprimé, ou il reste compté comme possédé.

**P2 : interface.**
- Libellés en « $ » pour un utilisateur francophone.
- Un seul état vide générique pour le tableau de bord (l. 10039).
- Aucune indication de couverture des données (combien d'exemplaires ont un prix ou une valeur connus).

**Cas limites [Fait]**
- Un exemplaire gratuit (`purchasePrice = 0`) est correctement compté 0, car `numOrNull(0)` vaut `0`, et non `null`. Il faut le conserver.
- La quantité n'existe qu'à l'import CSV (`qty` de 1 à 20, l. 10417), qui crée N fiches. Ce comportement est sain, car chaque exemplaire reste distinct.

### 2.2 Lecture
- **Doublon de modèle [Fait]** : deux notions de lecture coexistent.
  - `isRead` et `rating` sont portés **par exemplaire** (l. 6576, 7076). Avec deux exemplaires du même numéro, il faut marquer la lecture deux fois, et les statistiques « lus » comptent des exemplaires, non des œuvres (l. 7002, 7267).
  - `readprog` (progression des guides) est écrit par Explorer.
- **Pas de domaine visible.** La lecture n'a ni écran, ni historique daté, ni statistiques propres.
- **[Reco.]**
  - La progression se rattache à l'**œuvre** (numéro identifié), pas à l'exemplaire, conformément à A3.
  - `isRead` reste lisible par compatibilité, puis sera migré au lot 3.1b ou au lot Lecture.
  - Rien de tout cela ne concerne la lecture numérique (exclue).

### 2.3 Explorer
- **Pour l'utilisateur**, Explorer est perçu comme une vue de la collection. Il est rangé sous « Vues de la collection » sur mobile (l. 1879) et absent du dock mobile (l. 2119–2136). Cela contredit A6.
- **Données** : les créateurs, séries et éditeurs d'Explorer sont **dérivés de la collection** de l'utilisateur (l. 9466–9494). Un utilisateur sans collection voit donc un Explorer presque vide. C'est un problème de produit autant que de frontière.
- **Périmètre** : présence des mangas et d'éditeurs mixtes dans les Sorties (l. 7463–7476), en contradiction avec D-12.

### 2.4 Community
Rien n'est implémenté. **Risque principal** : laisser entrer des fonctions sociales (partage, classements) avant :
- les comptes (lot 3.2) ;
- la modération (lot 4.10) ;
- la validation juridique de S3 (D-16).

### 2.5 Transversal
| Constat | Gravité |
|---|---|
| Les instantanés de valeur (`panel_value_snapshots`, l. 6416–6428) enregistrent des totaux calculés avec substitutions : l'historique global est biaisé depuis l'origine | P0 (ne pas réécrire ; marquer, voir [`02`](02-audit-financier.md) § 6) |
| Secrets inclus dans les exports par défaut | P1 (déjà planifié : B1, lot 3.1b) |
| Interface non vérifiée en conditions réelles pour ce plan : les constats UX viennent de la lecture du code **[Hyp.]** pour le rendu | Une revue au navigateur, sur bureau et mobile, est prévue au lot F0 ([`04`](04-backlog-feuille-de-route-decisions.md)) |

## 3. Ce qui va bien et doit être préservé
- Local-first, sans compte (D-02), avec export toujours disponible.
- La cote automatique est **transparente** : facteurs, fourchette basse et haute, niveau de confiance (l. 6286–6318). C'est un atout, aujourd'hui mal exploité dans les totaux.
- Les sources de valeur sont distinguées par fiche (`valueSource` : `auto`, `manual`, `market`, l. 6331–6346). La cote auto n'écrase jamais une valeur manuelle ou marché.
- Un historique de valeur par fiche existe (40 entrées, l. 6321–6328).
- La gestion fine des emplacements est rare chez les concurrents (voir [`03`](03-plan-directeur-produit-ux-architecture.md) § 5).
