# Phase 4 · 03 — Changement de navigation : Explorer et Sorties (décisions A5 et A6)

Statut : **documenté, non implémenté**. Ce changement touche l'interface de Collection : **il ne sera réalisé qu'après une validation explicite de l'utilisateur**, dans un lot désigné (proposé : lot 4.9), avec sauvegarde préalable et tests de non-régression.

## 1. Situation actuelle [Fait]
Barre latérale (bureau), `index.html` l. 1761-1800 :
```
COLLECTION PHYSIQUE
  Ma collection            (navAllSingles)
  Explorer & guides        (navExplorer)        ← sous-vue de Collection
  Séries & complétion      (navSinglesSeries)
  Calendrier & pull list   (navSinglesReleases) ← sorties (éditorial) + Pull List (personnel)
  Wishlist                 (navSinglesWishlist)
  Statistiques             (navSinglesStats)
AJOUTER
  Scanner code-barres · Scanner couverture · Importer CLZ / LoCG · Ajouter un single
```
- Barre mobile (l. 2120-2132) : `mobSingles`, `mobSeries`, `mobScan`, `mobWishlist` ; Explorer n'y figure pas.
- Routeur : `goSingles(view)` (l. 6952-6975) affiche Explorer dans `#singlesViewSection` (`singlesExplorerView`), masque la barre de statistiques de Collection et désactive les boutons mobiles de Collection.

## 2. Cible
```
EXPLORER                              ← nouvelle entrée de la navigation principale (A6)
  Accueil Explorer
  Sorties & calendrier                ← sorties éditoriales (A5)
  Guides · Événements · Key Issues · Classements · Séries · Personnages · Créateurs (Phase 4)
COLLECTION PHYSIQUE                   ← inchangée, sauf le retrait de deux entrées
  Ma collection
  Séries & complétion
  Pull List                           ← la partie personnelle de « Calendrier & pull list »
  Wishlist
  Statistiques
AJOUTER                               ← inchangé
```
- **Explorer** : section et conteneur propres (par exemple `#explorerSection`), routeur propre, hors de `#singlesViewSection`.
- **Mobile** : une entrée Explorer dans la barre du bas. Le nombre de boutons (5) et la place de `mobScan` sont à valider : c'est un changement de l'interface mobile de Collection.
- **Sorties** : la vue calendrier (publications, reports, annulations) passe dans Explorer. La **Pull List** reste dans Collection. Depuis une sortie, « Ajouter à ma Pull List » passe par S2 ; le badge « dans ma Pull List » par S1.

## 3. Ce qui change dans Collection (à autoriser explicitement)
| # | Changement | Type |
|---|---|---|
| N1 | Retrait du bouton « Explorer & guides » du bloc Collection Physique | Interface Collection |
| N2 | « Calendrier & pull list » devient « Pull List » ; la vue calendrier part dans Explorer | Interface Collection |
| N3 | Le routeur `goSingles` ne connaît plus la vue `explorer` (D1) ; la vue `releases` est scindée | Structure Collection |
| N4 | Barre mobile : ajout d'Explorer, réorganisation éventuelle | Interface mobile |
| N5 | Badge `badgePullCount` : conservé sur l'entrée Pull List | Interface Collection |

Ce qui **ne change pas** : les données, les modèles, les fonctions et le comportement de Collection, de la Wishlist, de la Pull List, des emplacements, des statistiques et des ajouts.

## 4. Conditions de réalisation
1. Validation explicite de N1 à N5 par l'utilisateur.
2. Sauvegarde des fichiers modifiés (`*.backup.<date>-nav`).
3. Raccourcis et liens profonds existants conservés : `Panel.explorer.open(...)`, raccourcis du manifeste PWA, ancres éventuelles — avec redirection depuis l'ancienne vue.
4. Tests : suite existante au vert ; nouveaux tests (Explorer accessible depuis la navigation principale, Pull List intacte, aucune vue Collection perdue, mobile 375 px).
5. Captures avant et après, sur bureau et sur mobile, soumises à l'utilisateur.

## 5. Questions ouvertes
- Ordre des sections dans la navigation principale : Explorer avant ou après Collection ?
- Barre mobile : quel bouton laisse sa place, ou faut-il passer à cinq boutons ?
- Le libellé « Pull List » seul convient-il, ou « Pull List & suivis » ?
