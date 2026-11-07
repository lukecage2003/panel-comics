# Plan directeur 2.0 · 05 — Dossier de préparation du lot 3.1b (séparation des domaines côté client)

Statut : **préparation technique** (8 novembre 2026).
- **Le lot 3.1b est suspendu** jusqu'à approbation explicite de l'utilisateur (D-17). Rien n'est implémenté.
- Ce dossier découpe le lot défini dans [`phase4/08`](../phase4/08-plan-execution.md) § 2 en sous-lots courts. Il ne refait pas la conception.

Documents de référence, qui font autorité :
- frontières et couplages C, D et E : [`phase4/02`](../phase4/02-frontieres-collection-explorer.md) ;
- contrats S1 et S2 : [`phase4/05`](../phase4/05-contrats-s1-s6.md) ;
- sauvegardes B1 : [`phase4/06`](../phase4/06-sauvegardes-par-domaine.md) ;
- navigation : [`phase4/03`](../phase4/03-changement-navigation.md) ;
- périmètre comics : [`phase4/04`](../phase4/04-perimetre-sorties-comics.md).

## 0. Règles communes à tous les sous-lots
- **Un seul sous-lot à la fois.** Ils touchent tous `index.html` et `run-all-tests.js`, donc jamais deux sous-lots en parallèle.
- **Sauvegarde avant chaque sous-lot.** Une copie datée de `index.html` et `run-all-tests.js` (`*.backup.AAAAMMJJ-3.1b-N`). Les copies existantes, dont `*.backup.20261107-lot31` et `*.backup.20261107-f0`, sont conservées.
- **Données.**
  - Aucune donnée utilisateur réécrite.
  - Pas de nouvelle version de base IndexedDB, pas de nouveau store.
  - Les clés localStorage existantes sont conservées. Une empreinte par domaine est prise avant et après chaque sous-lot.
- **Comportement identique**, sauf A7 (retrait de « Ma collection » de la recherche d'Explorer) et la navigation, seulement si elle est validée.
- **Tests.** Les tests ciblés du sous-lot, puis la suite complète, actuellement 29 tests, dont le test 30 (finances).
- **Numéros de ligne.** Ceux de [`phase4/02`](../phase4/02-frontieres-collection-explorer.md) datent d'avant F0 : décalage d'environ +80 à +100 lignes. Ils sont à relocaliser par nom de fonction (`exIndexBuild`, `exSearch`, `relMakeSingle`, `pullStatusOf`, `goSingles`…).

## 1. Sous-lots

### 3.1b-0 — Préalables (sans code)
| | |
|---|---|
| Objectif | Lever les décisions bloquantes et figer la référence |
| Dépendances | Approbation de 3.1b ; P1 (pour 3.1b-2) ; B1-a, B1-b, B1-c (pour 3.1b-1) ; N et M (pour 3.1b-7 seulement) |
| Actions | Suite complète à 29/29 ; relevé des empreintes de `panel_physical_singles`, `panel-catalog` (comptes par store) et `panel-library` ; inventaire des sauvegardes ; relocalisation des couplages C1 à C10, D1 à D4 et E1 à E5 par fonction |
| Acceptation | Tableau des couplages à jour, avec les lignes réelles ; décisions consignées dans `DECISIONS.md` |

### 3.1b-1 — Sauvegardes par domaine (B1)
| | |
|---|---|
| Objectif | Fournisseurs `BackupProvider.v1` (Collection, Lecture, Explorer, Application) et format `panel-bundle` v1, avec lecture rétrocompatible de `panel-backup` v3 et `panel-singles` v2 |
| Fichiers | `index.html` (export l. ~11500, import l. ~11580, `panel-backup` l. ~12530), `run-all-tests.js` |
| Changements | Registre des fournisseurs ; export par domaine et complet (manifeste, sha256) ; aperçu avant restauration ; restauration par domaine avec instantané et annulation ; l'ancien export reste disponible (B1-a) ; secrets selon B1-b |
| Risques | **Le plus grave du lot** : une restauration qui perd ou écrase des données. Parades : instantané automatique, aperçu obligatoire, fusion par défaut, annulation |
| Tests | R1 à R10 de [`06`](../phase4/06-sauvegardes-par-domaine.md) § 9, dont un aller-retour par domaine à l'identique (empreintes) ; anciens fichiers v2 et v3 relus sans perte ; fichier corrompu refusé sans effet ; restauration d'un domaine sans toucher aux autres ; numérique (PDF/CBZ, annotations, marque-pages) intact |
| Sauvegarde | Copie avant le sous-lot ; export complet de démonstration avant les tests |
| Acceptation | R1 à R10 au vert ; tests 21 (protection des données) et 24 (restauration JSON fidèle) inchangés et au vert |

### 3.1b-2 — Contrats locaux S1 et S2
| | |
|---|---|
| Objectif | Couche `Panel.contracts.personal.v1` : S1 `PersonalLens.v1` (statuts minimaux) et S2 `PersonalCommands.v1` (commandes explicites) |
| Fichiers | `index.html` (nouvelle section après le moteur de collection), `run-all-tests.js` |
| Dépendances | 3.1b-1 (sauvegarde du réglage) ; **décision P1** |
| Changements | `statusFor(refs)` → `{owned, wishlisted, inPullList, read}`, sans champ interdit (prix, valeur, état, emplacement, notes, dates d'achat, identifiants d'exemplaire) ; S2 `addToWishlist`, `addToCollection` (ouvre le formulaire, D-18), `addToPullList`, `followSeries`, `setGuideProgress`, `openItem`, chacun avec un jeton de geste ; réglage « Personnaliser Explorer avec mes données » |
| Risques | Fuite de champs personnels vers Explorer ; commande déclenchée sans geste |
| Tests | Sortie S1 sans champ interdit (liste blanche) ; réglage désactivé → aucun appel au fournisseur ; commande sans jeton refusée ; dédoublonnage identique à `sameVariantWish` ; annulation |
| Acceptation | Tests de frontière de [`05`](../phase4/05-contrats-s1-s6.md) § 3 et § 4 au vert |

### 3.1b-3 — Découplage Explorer → Collection (C2 à C10)
| | |
|---|---|
| Objectif | Explorer ne lit plus `physicalSingles` et n'écrit plus dans Collection : tout passe par S1 et S2 |
| Fichiers | `index.html` (`exIndexBuild`, `exMatch`, `exCoverOf`, pages créateurs, séries et éditeurs, `exSearch`, `openSingleInspector` / `addPubToWishlist` appelés depuis Explorer) |
| Dépendances | 3.1b-2 |
| Changements | Badges et filtres personnels via S1 ; actions via S2. Les pages créateurs, séries et éditeurs encore **dérivées de la collection** (C6) restent, mais alimentées par S1 et signalées comme « personnelles » ; leur remplacement par le catalogue éditorial relève de 4.3 |
| A7 | Retrait de la catégorie « Ma collection » de la recherche d'Explorer ; test 29 adapté |
| Risques | Régression visible d'Explorer (badges, progression) |
| Tests | Test statique : aucune référence à `physicalSingles`, `persistSingles` ni aux stores de Collection dans le code d'Explorer ; Explorer complet avec un fournisseur S1 absent (`unavailable`) ; test 29 au vert hors A7 |
| Acceptation | Critère X2, partie Explorer, de [`08`](../phase4/08-plan-execution.md) § 6 |

### 3.1b-4 — Découplage Collection → Explorer (D1 à D4)
| | |
|---|---|
| Objectif | Collection fonctionne sans Explorer |
| Fichiers | `index.html` (`goSingles`, exports `panel-singles` v2 et `panel-backup` v3 qui embarquent `explorer` et `releases`) |
| Dépendances | 3.1b-1 (les blocs `explorer` et `releases` passent dans leurs fournisseurs) |
| Changements | `goSingles` n'appelle plus Explorer directement ; les exports Collection ne contiennent plus que Collection, et l'ancien export complet reste disponible (B1-a) |
| Tests | R9 : Collection démarre, exporte et restaure avec Explorer désactivé ; anciens fichiers v2 et v3 avec bloc `explorer` relus et répartis vers le bon domaine |
| Acceptation | Critère X2, partie Collection |

### 3.1b-5 — Séparation du calendrier éditorial (Explorer) et de la Pull List (Collection) (E1 à E5)
| | |
|---|---|
| Objectif | Appliquer A5 : publications et sorties = Explorer ; pulls, wishlist structurée et conversions = Collection |
| Fichiers | `index.html` (module calendrier et Pull List : `relMakeSingle`, `addPubToWishlist`, `addPubToCollection`, `wishToCollection`, `collectionToWishlist`, `pullStatusOf`, `pickUpPull`, `pullRef`, `relCopiesOf`, annulation d'import) |
| Changements | Les écritures dans `physicalSingles` (E1) passent par S2, exécutées par Collection ; `pullStatusOf` et `relCopiesOf` lisent S1 ; le store `pulls` reste dans `panel-catalog` (pas de nouvelle version), mais sa **propriété** est attribuée à Collection dans le registre des fournisseurs (E5) ; l'annulation d'import n'inspecte plus les fiches (E3) |
| Hors périmètre sans décision | Filtre « comics uniquement » des Sorties (B-17) : seulement si M1 à M4 sont tranchées, sinon au lot 4.6 |
| Risques | Doublons lors des conversions pull → collection ; perte du lien `pullId` |
| Tests | Test 27 (calendrier) au vert sans modification de ses attentes ; conversion wishlist → collection sans doublon ; prix payé jamais inventé (règle F0) |
| Acceptation | Aucune écriture directe dans `physicalSingles` hors du domaine Collection (test statique) |

### 3.1b-6 — Tests de frontières et de régression
| | |
|---|---|
| Objectif | Rendre la séparation vérifiable de façon permanente |
| Fichiers | `run-all-tests.js` (test 31 « Frontières », R1 à R10) ; éventuellement un petit script statique `scripts/check-boundaries.js` sans dépendance |
| Tests | Statique (accès interdits par domaine) ; dynamique (fournisseur absent, réglage S1 désactivé, visiteur) ; empreintes par domaine avant et après un démarrage et après une restauration |
| Acceptation | Suite complète au vert (29 tests + nouveaux) |

### 3.1b-7 — Navigation (conditionnel)
- **Seulement si** N1 à N5 et une option mobile (M-A à M-E) sont validées. Sinon, reporté au lot 4.9.
- Conséquences connues ([`03`](../phase4/03-changement-navigation.md)) :
  - sortie d'Explorer de « Vues de la collection » ;
  - entrée Explorer dans le dock mobile, ce qui impose de choisir le bouton remplacé ou de passer à cinq boutons ;
  - Pull List rattachée à Collection ;
  - place de la Lecture (U-D1) à décider en même temps, pour éviter deux refontes successives.
- Tests : navigation au clavier ; aucune vue inaccessible ; mobile de 320 à 430 px sans défilement horizontal.

## 2. Ordre d'exécution
```
3.1b-0 → 3.1b-1 → 3.1b-2 → 3.1b-3 → 3.1b-4 → 3.1b-5 → 3.1b-6 (→ 3.1b-7 si validé)
```
- 3.1b-3 et 3.1b-4 sont logiquement indépendants, mais sérialisés car ils touchent le même fichier.
- 3.1b-6 est enrichi au fil des sous-lots et clôturé en dernier.

## 3. Décisions à ne pas prendre à la place de l'utilisateur
| # | Décision | Bloque | Options | Recommandation (non approuvée) |
|---|---|---|---|---|
| — | Lancement de 3.1b | Tout le lot | Lancer / attendre | Lancer après validation de G1 et du lot 3.1 |
| P1 | Utilisateurs locaux et S1 | 3.1b-2 et suivants | P1-a : le profil local est traité comme connecté (aucun changement visible) ; P1-b : S1 réservé aux comptes (les badges disparaissent pour les utilisateurs sans compte) | P1-a : évite de retirer une fonctionnalité validée |
| B1-a | Durée de l'ancien format d'export | 3.1b-1, 3.1b-4 | Deux versions / une version / indéfiniment | Deux versions |
| B1-b | Secrets dans les exports | 3.1b-1 | Exclusion définitive / export facultatif chiffré | Exclusion par défaut, option explicite chiffrée |
| B1-c | Nom du format | 3.1b-1 | `panel-bundle` / autre | `panel-bundle` |
| N1-N5, M-A à M-E, U-D1 | Navigation bureau et mobile, place de la Lecture | 3.1b-7 seulement | Voir [`03`](../phase4/03-changement-navigation.md) et [`03` du plan directeur](03-plan-directeur-produit-ux-architecture.md) § 3.2 | Décider ensemble ou reporter à 4.9 |
| M1-M4 | Périmètre comics des Sorties | Filtre B-17 dans 3.1b-5 | Voir [`phase4/04`](../phase4/04-perimetre-sorties-comics.md) § 5 | Trancher avant 3.1b-5, sinon reporter le filtre au lot 4.6 |
