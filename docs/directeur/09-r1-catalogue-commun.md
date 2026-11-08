# R1 — Catalogue commun de publications (D-55, 8 novembre 2026)

Première étape de la roadmap du [rebaseline](08-rebaseline-produit.md) (§ 9.1 et R1) : une publication de comics a une identité stable, la même dans Collection, Sorties et Explorer. Les modules ne sont pas réécrits : ils gardent leurs fiches et sont résolus vers l'identité commune par un index de références.

## 1. Constat de départ

| Module | Stockage | Identité avant R1 |
|---|---|---|
| Collection | `panel_physical_singles` (localStorage + miroir IndexedDB) ; catalogue normalisé dérivé `panel-catalog` (lot 2.1) | `s_…` par exemplaire ; `catalogIdsOf` → `pub_` (éditeur), `ser_`, `iss_`, `var_`, avec l'éditeur **exact** dans la clé |
| Sorties | IndexedDB `panel-catalog/publications` (`relPubs`) | `pbc_…` ; identifiants externes ; clé naturelle `relNatural` ; référence `catalog.issueId` calculée par `catalogIdsOf` |
| Explorer (événements, guides) | fiches éditoriales | `ek_…` = hachage (série, volume, numéro), sans éditeur |

Collection et Sorties partageaient donc une clé fragile (« Marvel » ≠ « Marvel Comics ») et Explorer aucune.

## 2. Architecture ajoutée

- **Module de domaine** `domains/catalog/publication-core.js` (pur : ni réseau, ni stockage), intégré par `scripts/sync-domains.js` sous `window.PanelDomains.publicationCore`.
- **Pont** dans `index.html` (section « CATALOGUE COMMUN DE PUBLICATIONS ») : lit les fiches des trois modules, résout, enregistre l'index dans `panel-catalog/meta` (clé `publications`), expose `Panel.publications`.
- **Reconstruction** différée (1,5 s) après chaque enregistrement de la collection ou des sorties, et au démarrage. Idempotente, environ 100 ms pour 6 000 fiches (mesure locale sur fixture).

## 3. Modèle et identifiants

| Niveau | Identifiant | Clé d'identité |
|---|---|---|
| Série | `pub_s_…` | titre normalisé + éditeur normalisé + année de début + volume |
| Numéro | `pub_i_…` | série + numéro normalisé (`#001` = `1`) ; unique |
| Variante | `pub_v_…` (`kind: cover`) | numéro + nom de variante normalisé (« Cover A », « Regular » = couverture principale, sans identifiant propre) |
| Réimpression | `pub_v_…` (`kind: printing`) | numéro + rang d'impression (2e, 3e…) |
| Recueil / édition | `pub_e_…` | ISBN s'il existe, sinon titre + éditeur + langue + tome + format (TPB, HC, omnibus, album, intégrale, deluxe) |
| One-shot | série `type: one_shot` | sans numéro → numéro « 1 » seulement si la série est déclarée one-shot |

Chaque fiche porte : identifiants externes (`comicvine`, `metron`, `gcd`, `locg`, `clz`, `upc`, `isbn`, **uniquement ceux fournis**, forme contrôlée), champs sourcés (titre, dates de **couverture**, de **mise en vente** et **FOC** distinctes, année, prix, équipe créative), écarts entre sources conservés (`conflicts`), sources et statut de vérification (`recorded`, `concordant`, `verified` si une source `bibliographic`), statut de couverture et de droits (`none` / `unknown` : aucune image n'est stockée).

Identifiants déterministes (hachage FNV double) : la même publication obtient le même identifiant sur tous les appareils et après un retour arrière.

## 4. Résolution et doublons

Ordre : identifiant externe déjà connu → série (titre, éditeur, année, volume) → numéro → variante.

- Deux identifiants fiables qui désignent deux publications différentes : **ambiguïté**, rien n'est fusionné.
- Un identifiant externe contraire à celui déjà porté par le numéro : ambiguïté.
- Séries homonymes : avec année ou volume, distinctes ; une entrée sans discriminant se rattache à la série unique connue (« probable », sans enrichir la série), et devient ambiguë s'il en existe plusieurs.
- Les entrées précises (année ou volume) sont traitées avant les autres pour éviter de créer des séries « sans année ».
- `duplicateCandidates` : séries homonymes dont l'une n'a ni année ni volume. Jamais fusionnées automatiquement.
- `merge` (séries ou numéros), `relink` (correction manuelle d'un rattachement, prioritaire sur le recalcul) : journalisés (50 dernières opérations), avec l'état antérieur de chaque fiche touchée ; `undo` annule la dernière opération à l'identique. Les anciens identifiants restent lisibles par alias.

## 5. Modules connectés

| Module | Référence | Ce qui est résolu |
|---|---|---|
| Collection | `collection:<id d'exemplaire>` | chaque fiche avec une série (variante comprise) |
| Sorties | `release:<id pbc_>` | chaque publication dans le périmètre ; recueils vers `pub_e_` |
| Explorer | `explorer:<clé ek_>` | chaque numéro cité par un événement, un lien ou un ordre de lecture |
| Catalogue lot 2.1 | `catalog:<iss_…>` | correspondance des identifiants existants de la Collection et de la référence `catalog.issueId` des sorties |

`Panel.publications.usages(issueId)` répond à « où ce comic apparaît-il ? » (exemplaires, sorties, événements). Un même numéro peut être cité par plusieurs événements.

## 6. Données migrées et préservées

- Aucune fiche de Collection, Sorties ou Explorer n'est modifiée (vérifié par test de domaine et test navigateur 52 : empreinte avant/après).
- L'index est **dérivé** : `Panel.publications.rollback()` le supprime seul ; une reconstruction redonne les mêmes identifiants. Les opérations manuelles disposent d'une copie de l'état précédent (`publicationsPrev`) et de l'annulation.
- Sauvegarde : section Explorer du panel-bundle (`publicationCatalog`), revalidée à la lecture ; absente des anciennes sauvegardes → rien n'est touché ; restaurée en fusion seulement si l'index local est vide ; annulée avec la restauration.
- Les fiches d'un module supprimées sortent de l'index (références automatiques seulement ; les liaisons manuelles restent).

## 7. Manga (D-54)

- Plus aucune **nouvelle** publication manga ou manhwa dans Sorties (`relUpsert` refuse, `outOfScope: true`) ; les fiches existantes restent intactes, modifiables et masquées par défaut (D-37).
- Le catalogue commun ne reprend pas les sorties manga/manhwa existantes (comptées « hors périmètre »).
- La suppression de la catégorie attend un mécanisme d'export et de préservation validé : non faite.

## 8. Tests

- `domains/catalog/publication-core.test.js` : 15 tests sur fixtures fictives (identité stable, unicité, homonymes, variantes et réimpressions, éditions, identifiants externes et conflits, dates et provenance, manga, associations multiples, import réimporté sans doublon, fusion et annulation à l'identique, liaison manuelle, anciennes fiches incomplètes, sauvegarde et restauration, normalisation).
- Test navigateur 52 : construction, fiches intactes, résolution des trois modules, idempotence, refus manga, index dans la sauvegarde, retour arrière et reconstruction identique.

## 9. Interface (finition R1, D-56)

- **« Dans Panel »** : encadré dans l'inspecteur d'un exemplaire (Collection) et sur la fiche numéro d'Explorer. Il indique les exemplaires possédés et en wishlist, les annonces de Sorties avec leur date, les événements qui citent le numéro et leur relation, les dates de couverture, de mise en vente et FOC si elles sont connues, l'identifiant Panel et le statut de vérification. Sur la fiche Explorer, les événements, déjà listés, ne sont pas répétés.
- **Écran « Catalogue commun »** (menu Plus) :
  - rattachements à trancher : entrée ambiguë → choix de la série parmi les candidates (`chooseSeries`, le numéro est retrouvé ou créé dans cette série) ;
  - séries en double possible : fusion d'une série sans année dans une série datée, après confirmation ;
  - historique des dix dernières opérations ; bouton d'annulation de la dernière.
- Rien n'est automatique ; aucune fiche de module n'est modifiée ; chaque opération est annulable à l'identique (test de domaine).
- La vérification d'intégrité résume aussi le catalogue commun.

## 10. Limites et dépendances

- Dans la roadmap D-54, **R2 est l'Event Center v2** (niveaux de lecture, rôles, ordres versionnés, progression par niveau) ; il s'appuie sur les `pub_i_` de R1.
- Le rattachement d'une fiche de Sorties n'est pas encore affiché sur sa propre fiche (seulement depuis Collection et Explorer).
- Les recueils ne listent pas encore leur contenu (`contents` vide) ; les crédits ne sont repris que s'ils sont fournis.
- Le catalogue lot 2.1 (`iss_`) reste en place et relié par correspondance ; sa clé n'est pas remplacée.
- Les sorties hors marché US ne fournissent pas de date de mise en vente US (non confondues).
- Pull List, Community et Discover pourront référencer `pub_i_` / `pub_s_` sans nouveau modèle.
