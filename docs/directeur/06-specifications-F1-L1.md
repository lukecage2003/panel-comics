# Plan directeur 2.0 · 06 — Spécifications des lots F1 (finances) et L1 (lecture)

Statut : **spécifications définitives, prêtes à valider** (8 novembre 2026, révision 2 : exports, cas limites, sous-lots ; analyse des décisions en partie C). F1 et L1 sont intégrés à la feuille de route (D-17) mais **non autorisés à démarrer**.

Ce document prolonge :
- le modèle financier de [`02`](02-audit-financier.md) § 3 ;
- la séparation des domaines de [`phase4/02`](../phase4/02-frontieres-collection-explorer.md) ;
- la décision A3 (la progression de lecture appartient au domaine Lecture).

Il ne les répète pas.

Ordre prévu : **F1 et L1 après 3.1b**. Les nouveaux champs doivent naître dans les fournisseurs de sauvegarde B1 (3.1b-1), et les échanges Lecture ↔ Explorer passent par S1 et S2 (3.1b-2).

---

## Partie A — F1 : évolution financière de Collection

### A.1 Principes (rappel D-18 et F0)
- Prix de couverture, prix payé, frais, coût d'acquisition et valeur estimée sont **cinq données distinctes**. Aucune n'est déduite d'une autre sans geste explicite.
- Une donnée inconnue reste `null` : elle est exclue des totaux et comptée dans la couverture.
- **Aucune donnée existante n'est réécrite.** Les nouveaux champs sont facultatifs ; une fiche ancienne reste valide telle quelle.
- **Aucune perte d'historique.** Une vente ou une sortie ne supprime jamais la fiche.

### A.2 Structures de données proposées (champs ajoutés dans la fiche d'exemplaire)
```js
{
  // existants : coverPrice, purchasePrice, purchaseDate, estValue, valueSource, valuation, valueHistory
  coverCurrency:    'USD' | 'EUR' | … | null,   // ISO 4217 ; null = non précisée
  purchaseCurrency: 'EUR' | … | null,           // devise du prix payé et des frais
  acquisitionFees:  number | null,              // frais imputables (port, taxes, commission) ; null = inconnus, 0 = aucun
  feesDetail:       [{ kind: 'shipping'|'tax'|'commission'|'grading'|'other', amount }] | undefined,
  acquisitionId:    'acq_…' | undefined,        // lien vers un achat groupé
  valuedAt:         ISO date | undefined,       // date de la valeur retenue (marché ou saisie)
  disposal: {                                   // sortie de collection ; absent = possédé
    kind: 'sold' | 'gift' | 'lost' | 'traded',
    date, price: number|null, fees: number|null, currency, note
  } | undefined,
  financeLog: [{ at, field, from, to, by: 'user'|'lot'|'import' }]   // 50 dernières modifications financières
}
```

Achats groupés : une liste `panel_acquisitions` (localStorage, puis un fournisseur B1 Collection) :
```js
{ id: 'acq_…', date, vendor, currency, totalPaid, fees, allocation: 'cover'|'equal'|'value'|'manual',
  lines: [{ copyId, allocatedPrice, allocatedFees }], createdAt, updatedAt }
```
- Les montants sont stockés en **décimal à deux chiffres**, comme aujourd'hui. Les calculs se font en centimes, déjà le cas depuis F0 (`toCents`).
- Passer à des centimes entiers stockés n'apporterait rien sans migration. C'est donc **écarté**, ce qui amende [`02`](02-audit-financier.md) § 3.3, règle 3.

### A.3 Calculs
| Indicateur | Règle |
|---|---|
| Coût d'acquisition | `purchasePrice + acquisitionFees` ; frais `null` → coût **partiel**, affiché « ≥ prix payé » et compté dans « frais inconnus » ; prix payé `null` → coût inconnu |
| Investissement | Somme des coûts connus des exemplaires **possédés** (sans `disposal`), **par devise** |
| Plus-value latente | Valeur − coût, si les deux sont connus et dans la même devise |
| Plus-value réalisée | `disposal.price − disposal.fees − coût`, seulement pour `kind: 'sold'` et un coût connu |
| Évolution % | Plus-value ÷ coût × 100 ; indéfinie si le coût vaut 0 ou est inconnu |
| Dépenses du mois | Coûts connus par mois d'achat, par devise |

### A.4 Devises : décision F-D2 (ouverte), conséquences des options
Aujourd'hui :
- tout s'affiche en « $ » ;
- aucune devise n'est enregistrée ;
- la copie normalisée du catalogue écrit `currency: … || 'USD'` par défaut (`index.html` l. 5176, vérifié le 8 novembre 2026), ce qui affirme une devise jamais saisie.

| Option | Conséquences | Risques |
|---|---|---|
| **A. Devise par défaut EUR** pour les nouvelles fiches ; anciennes fiches « non précisée » | Affichage juste pour un collectionneur français ; totaux séparés « € » et « non précisée » | Fiches anciennes saisies en $ affichées « non précisée » jusqu'à correction ; aucune conversion |
| **B. Devise par défaut USD** | Cohérent avec l'affichage actuel et les prix de couverture US | Faux pour les achats en euros ; incite à confondre |
| **C. Choix au premier usage**, enregistré dans les préférences | Aucune hypothèse ; une seule question | Un écran de plus au premier ajout |
| **D. Statu quo** (aucune devise) | Aucun risque de migration | L'export continue d'écrire `USD` par défaut : **à corriger dans tous les cas** (écrire `null`) |

Pour toutes les options :
- aucune conversion automatique ;
- une conversion éventuelle se fait seulement vers une devise de référence choisie, avec un taux daté et sourcé affiché « ≈ » ;
- les anciennes fiches ne sont jamais réétiquetées sans geste explicite (outil « appliquer la devise X à ces N fiches », avec aperçu et annulation).

Recommandation (non approuvée) : **C**, avec EUR proposé dans le sélecteur.

### A.5 Lots (F-D4 ouverte)
- Méthodes et invariants : voir [`02`](02-audit-financier.md) § 3.4. La méthode par défaut reste à décider (F-D4).
- **Saisie d'un lot.** Sélection de fiches existantes ou création de N fiches, puis total, frais, devise et méthode. Un aperçu des parts s'affiche avant validation.
- **Effet sur les fiches.**
  - Un lot écrit `purchasePrice`, `acquisitionFees` et `acquisitionId` **seulement** sur les fiches dont le prix payé est vide, ou après confirmation fiche par fiche.
  - Chaque écriture est journalisée dans `financeLog` et peut être annulée.
- **Suppression d'un lot.** Le lien est retiré, mais les prix restent, sauf choix « retirer aussi les prix répartis ».

### A.6 Ventes et sorties
- Action « Sortir de la collection » dans la fiche : type, date, prix, frais, devise.
- La fiche reste visible dans une vue « Sorties » et peut être restaurée (annulation).
- `isOwned` devient `!isWishlist && !disposal`. Ses 8 occurrences sont à vérifier, ainsi que les comptes de séries, la complétion, S1 (`owned`) et les exports.
- Un exemplaire sorti n'est plus compté dans S1 ni dans les statistiques de possession, mais il reste dans l'historique financier.

### A.7 Interfaces
- **Formulaire.** Ajout de : devise ; frais avec leur détail facultatif ; aperçu du « coût d'acquisition » ; mode « lot ».
- **Fiche (inspecteur).** Bloc Finances : couverture, payé, frais, coût, valeur (source, date, fourchette), plus-value, historique.
- **Onglet Finances (U-D2, Fi-A recommandée).** Indicateurs de [`02`](02-audit-financier.md) § 4, par devise ; plus-value réalisée ; listes « à compléter ».
- **Filtres.** Coût inconnu, frais inconnus, valeur ancienne (F-D3), sortis.

### A.8 Tests et critères d'acceptation
- T-F1 à T-F10 de [`02`](02-audit-financier.md) § 7.
- En plus :
  - un lot avec frais, réparti en trois méthodes ;
  - une modification puis une annulation de lot ;
  - une vente avec un coût inconnu (pas de plus-value réalisée) ;
  - une sortie annulée (retour à l'identique, empreinte) ;
  - une fiche ancienne sans aucun nouveau champ (aucune différence de calcul avec F0) ;
  - un export et une restauration B1 aller-retour avec les nouveaux champs ;
  - deux devises sans somme mixte ;
  - l'export n'écrit plus `USD` par défaut.
- **Acceptation.**
  - Suite complète au vert.
  - Aucune donnée existante modifiée au chargement : empreinte identique.
  - Toute écriture financière est journalisée et peut être annulée.

### A.9 Exports et statistiques
- **CSV et Excel** : une colonne par donnée distincte, sans jamais en fusionner deux :
  - prix de couverture et devise ;
  - prix payé et devise ;
  - frais, coût d'acquisition, identifiant de lot ;
  - valeur estimée, source et date ;
  - sortie : type, date, prix, frais.

  Une cellule vide signifie « inconnu », jamais 0.
- **JSON (B1)** : les champs tels qu'ils sont enregistrés, `panel_acquisitions` compris, dans le fournisseur Collection.
- **Statistiques** :
  - tout total est **par devise**, avec son taux de couverture (« 412 / 530 fiches avec un coût connu ») ;
  - la plus-value réalisée est séparée de la plus-value latente ;
  - les sorties sont exclues de la possession, mais restent dans les dépenses historiques.

### A.10 Cas limites et anciennes données
| Cas | Règle |
|---|---|
| Ancienne fiche (aucun nouveau champ) | Calcul identique à F0 ; devise « non précisée » ; aucune réécriture au chargement |
| Gratuit (cadeau reçu, prix 0) | `purchasePrice: 0` est un coût connu, distinct de `null` |
| Lot dont une fiche a déjà un prix payé | Fiche non modifiée sans confirmation ; répartition sur les autres lignes, écart affiché |
| Lot à couverture inconnue sur certaines lignes | La méthode « couverture » est refusée pour ce lot ; « égale » ou « manuelle » sont proposées |
| Reste d'arrondi | Affecté à la ligne la plus chère et affiché (`02` § 3.4) |
| Lot en plusieurs devises | Refusé : un lot n'a qu'une devise |
| Vente d'une partie d'un lot | Chaque fiche porte sa part ; plus-value calculée par fiche |
| Échange (`traded`) | `disposal.price` = valeur convenue si elle est saisie, sinon `null` (pas de plus-value réalisée) |
| Remboursement ou retour | Annulation de la sortie (restauration) ou modification du prix payé, journalisée |
| Valeur estimée sans date (anciennes fiches) | `valuedAt` absent, affiché « date inconnue » (F-D3) ; jamais daté du jour automatiquement |

### A.11 Sous-lots d'implémentation (après 3.1b et l'autorisation de F1)
| Sous-lot | Contenu | Prérequis |
|---|---|---|
| F1-0 | Écrire `null` au lieu de `'USD'` dans la copie normalisée (l. 5176) ; test « aucune devise inventée ». Applicable seul, **sur accord explicite**, avant F1 | Accord (application de D-18) |
| F1-1 | Devises (`coverCurrency`, `purchaseCurrency`), totaux par devise, sélecteur | **F-D2** |
| F1-2 | Frais et coût d'acquisition (`acquisitionFees`, `feesDetail`), coût partiel affiché | F1-1 |
| F1-3 | Lots (`panel_acquisitions`), aperçu, journal, annulation | **F-D4** ; fournisseur B1 Collection (3.1b-1) |
| F1-4 | Sorties et ventes (`disposal`) ; `isOwned` (9 occurrences à revoir) ; vue « Sorties » ; plus-value réalisée | F1-2 |
| F1-5 | Onglet Finances, exports CSV et Excel, statistiques par devise | U-D2 ; F1-1 à F1-4 |

---

## Partie B — L1 : domaine Lecture

### B.1 Existant [Fait]
Deux progressions coexistent :
- `isRead` et `rating` **par exemplaire** (Collection) ;
- `readprog` (IndexedDB `panel-catalog`), progression des guides, écrite par Explorer.

Une œuvre possédée en deux exemplaires doit être marquée lue deux fois. Une œuvre lue sans être possédée n'a pas de place, hors des guides.

### B.2 Modèle cible
Les données de Lecture appartiennent au domaine Lecture (A3). L'identité d'œuvre est la clé (U-D3).
```js
// workKey : identifiant de catalogue (pubId / catalog_id) si connu, sinon clé locale « série normalisée + numéro »
ReadingState {
  workKey, status: 'to_read' | 'reading' | 'read' | 'abandoned',
  firstReadAt, lastReadAt, readCount,           // relectures
  rating: 0..5 | null, review: string | null,   // personnelles, privées par défaut
  position: { page?: number, note?: string },   // reprise ; pas de lecture numérique (exclue)
  source: 'user' | 'migrated:isRead' | 'guide', updatedAt
}
ReadingLog { id, workKey, at, event: 'started'|'finished'|'reread'|'abandoned', note }  // historique daté, en ajout seulement
GuideProgress { guideId, entryKey, status }     // = readprog actuel, reconnu comme donnée Lecture
```
Stockage local : réutiliser `readprog` pour la progression des guides. Pour l'état par œuvre et le journal, deux options :
1. un nouveau store, ce qui impose une version de base et doit être autorisé ;
2. une clé localStorage `panel_reading_v1`.

Recommandation : option 2 au départ, sans changement de version IndexedDB.

### B.3 Relations
| Avec | Règle |
|---|---|
| Collection | Lecture ne lit pas les exemplaires. La possession est affichée via S1 (`owned`). Plusieurs exemplaires ou éditions d'une même œuvre partagent **un seul** état de lecture. Une édition différente (VO/VF, recueil) est une autre œuvre, reliée par les relations du catalogue |
| Explorer | Explorer affiche le statut de lecture via S1 (`read`) et le modifie via S2 (`setGuideProgress`, `markRead`). Les guides restent éditoriaux (Explorer) ; leur progression est personnelle (Lecture) |
| Œuvre lue sans être possédée | État de lecture seul, sans exemplaire : cas normal |
| Exemplaire supprimé ou vendu (F1) | L'état de lecture est conservé |

### B.4 Migration de `isRead` (à autoriser explicitement)
- **Lecture de compatibilité.** Une œuvre est « lue » si au moins un exemplaire a `isRead: true`, ou si un `ReadingState` dit `read`. Aucune écriture.
- **Migration proposée.**
  - Elle crée un `ReadingState` (`source: 'migrated:isRead'`) par œuvre dont un exemplaire est lu, et reprend la meilleure note s'il y en a plusieurs : **décision**.
  - `isRead` et `rating` **restent** sur les fiches, pendant au moins deux versions.
  - Une sauvegarde est faite avant, avec aperçu, idempotence et annulation.
- **Conflit.** Un exemplaire lu et un autre non lu donnent l'état « lu », sans perte.

### B.5 Interfaces
- **Entrée Lecture** (selon U-D1) : en cours, à lire, journal, statistiques (rythme, relectures, séries suivies), « prochain numéro ».
- **« Marquer comme lu »** sur une œuvre depuis Collection (via le domaine Lecture), Explorer (S2) ou la fiche. Un seul geste suffit pour tous les exemplaires.
- **Reprise.** Dernière œuvre en cours, numéro suivant de la série, entrée suivante du guide.

### B.6 Tests et critères d'acceptation
- Une œuvre en deux exemplaires est marquée lue une fois, puis apparaît lue partout.
- Une œuvre lue sans être possédée apparaît dans Lecture et dans Explorer (S1), et pas dans Collection.
- La migration est idempotente : la relancer ne crée rien. Le retour arrière restaure l'état antérieur.
- `readprog` et les guides (test 29) restent au vert.
- Un exemplaire vendu ou supprimé ne perd pas l'état de lecture.
- La sauvegarde Lecture (B1) fait un aller-retour à l'identique.
- **Acceptation.** Aucune donnée `isRead`, `rating` ou `readprog` perdue ; suite complète au vert.

### B.6 bis Granularités et cas particuliers
| Cas | Règle |
|---|---|
| Par numéro | `workKey` d'un numéro : l'unité de base |
| Par série | **Dérivée**, jamais stockée : lus ÷ numéros connus de la série (catalogue S5, à défaut exemplaires et pulls) ; « prochain numéro » = le premier non lu |
| Recueil | Œuvre à part entière ; le marquer lu **propose** de marquer ses numéros (relations S5), avec un aperçu ; jamais automatiquement |
| Éditions multiples (VO / VF) | Œuvres distinctes, reliées par `edition_relation` ; aucune propagation, suggestion « lu en VO » |
| Plusieurs exemplaires d'une même édition | Un seul état (même `workKey`) |
| Lecture numérique | **Hors périmètre** : aucun lecteur. Une œuvre lue ailleurs, sous n'importe quelle forme, reçoit un `ReadingState` ordinaire |
| Possédé non lu | Dérivé : S1 `owned` et `status ≠ read` (liste « pile à lire ») |
| Lu non possédé | `ReadingState` sans exemplaire : cas normal, invisible dans Collection |

### B.6 ter Sous-lots d'implémentation (après 3.1b et l'autorisation de L1)
| Sous-lot | Contenu | Prérequis |
|---|---|---|
| L1-1 | Domaine Lecture : `ReadingState` et `ReadingLog` ; lecture de compatibilité de `isRead` (aucune écriture) ; fournisseur B1 Lecture | **L-D1** ; 3.1b-1 |
| L1-2 | S1 `read` et S2 `markRead` / `setGuideProgress` exécutés par Lecture | 3.1b-2 |
| L1-3 | Migration de `isRead` : aperçu, sauvegarde, idempotence, annulation | **L-D2**, **L-D3** ; autorisation explicite |
| L1-4 | Entrée Lecture, reprise, « prochain numéro », statistiques | **U-D1** |

### B.7 Décisions propres à L1
| # | Question | Recommandation |
|---|---|---|
| L-D1 | Stockage de l'état par œuvre : localStorage `panel_reading_v1` ou nouveau store IndexedDB | localStorage au départ |
| L-D2 | Migration de `isRead` vers Lecture, et conservation des champs d'origine | Migrer avec conservation pendant deux versions |
| L-D3 | Note en conflit entre exemplaires | Garder la plus récente, et l'ancienne dans le journal |
| U-D1, U-D3 | Place de la Lecture dans la navigation ; identité d'œuvre | Voir [`04`](04-backlog-feuille-de-route-decisions.md) § 4 |

---

## Partie C — Analyse des décisions ouvertes (aucune n'est prise ici)

### F-D2 — Devise
- **Problème.** Aucune devise n'est enregistrée. L'interface affiche « $ » et le catalogue écrit `USD` par défaut, alors que les achats sont probablement en euros. Un total qui mélange des devises est faux sans le signaler.
- **Options** (détail en A.4) :

| Option | Avantages | Inconvénients | Conséquences techniques |
|---|---|---|---|
| A. EUR par défaut | Juste pour un collectionneur français ; aucune question | Fausse pour les achats en $ non corrigés | Défaut `'EUR'` sur les nouvelles fiches ; anciennes fiches à `null` |
| B. USD par défaut | Cohérente avec l'affichage actuel | Fausse pour les achats en € ; prolonge la confusion | Défaut `'USD'`, à expliquer dans l'interface |
| C. Choix au premier usage | Aucune hypothèse ; une seule question | Un écran de plus au premier ajout | Préférence `defaultPurchaseCurrency`, synchronisée par `user_settings.prefs` |
| D. Statu quo | Rien à faire | Le problème demeure, et le `USD` inventé aussi | Seul F1-0 |

- **Recommandation : C**, avec EUR proposé, et F1-0 dans tous les cas.

### F-D4 — Méthode de répartition par défaut d'un lot
- **Problème.** Le prix d'un lot doit être réparti entre ses fiches. La méthode fixe le coût, donc les plus-values, de chacune.
- **Options** :

| Option | Avantages | Inconvénients | Conséquences techniques |
|---|---|---|---|
| Proportionnelle à la couverture | Reflète le prix facial ; simple | Impossible si une couverture est inconnue ; sous-évalue les keys | Refus du lot si une couverture manque (A.10) |
| Égale | Toujours possible | Grossière pour un lot hétérogène | Aucune |
| Proportionnelle à la valeur estimée | Reflète le marché | Dépend d'estimations absentes ou anciennes | Exige `estValue` sur toutes les lignes |
| Pas de défaut (choix obligatoire) | Aucune méthode cachée | Un choix de plus à chaque lot | Sélecteur obligatoire |

- **Recommandation :** proportionnelle à la couverture si toutes les couvertures sont connues, égale sinon. La méthode est toujours affichée et modifiable avant validation.

### L-D1 — Stockage de l'état de lecture par œuvre
- **Problème.** Le nouvel état de lecture a besoin d'un emplacement local.
- **Options** :

| Option | Avantages | Inconvénients | Conséquences techniques |
|---|---|---|---|
| localStorage `panel_reading_v1` | Aucune version IndexedDB ; simple | Quota partagé (5 à 10 Mo) ; réécriture complète à chaque changement | Moins de 1 Mo estimé pour 10 000 œuvres ; passage à IndexedDB possible plus tard, par une migration additive |
| Nouveau store IndexedDB | Aucun quota serré ; écriture par fiche | Hausse de version de `panel-catalog` (v5) : migration à autoriser, risque sur les bases existantes | `onupgradeneeded` additif, testé sur une copie |

- **Recommandation : localStorage.**

### L-D2 — Migration de `isRead`
- **Problème.** La lecture est portée par l'exemplaire. Migrer clarifie la propriété (A3), mais déplace des données utilisateur.
- **Options** :

| Option | Avantages | Inconvénients | Conséquences techniques |
|---|---|---|---|
| Lecture de compatibilité seule | Aucun risque | Deux sources indéfiniment ; la synchronisation consoliderait Collection comme propriétaire | Fusion au moment de la lecture |
| Migration, `isRead` conservé deux versions | Propriété claire ; retour arrière simple | Double écriture transitoire | Aperçu, sauvegarde, idempotence ; la table de lecture est synchronisée au lot 3.4 |
| Migration avec suppression de `isRead` | Modèle propre tout de suite | **Destructif** ; retour arrière difficile | Écarté sans autorisation expresse |

- **Recommandation : migration avec conservation**, avant le lot 3.4 si possible ([`phase3/10`](../phase3/10-dossier-lots-3.2-3.7.md) § 4.4).

### L-D3 — Notes différentes entre exemplaires d'une même œuvre
- **Problème.** Deux exemplaires d'une même œuvre peuvent porter des notes différentes. L'état par œuvre n'en garde qu'une.
- **Options** :

| Option | Avantages | Inconvénients | Conséquences techniques |
|---|---|---|---|
| La plus récente | Reflète l'avis actuel | Date de note souvent inconnue sur les anciennes fiches | Repli sur la plus haute faute de date |
| La plus haute | Simple, déterministe | Arbitraire | Aucune |
| Demander à l'utilisateur | Exact | Une question par œuvre concernée (rare) | Liste des conflits dans l'aperçu de migration |

- **Recommandation : demander** dans l'aperçu de migration. À défaut de réponse : la plus récente, sinon la plus haute. La valeur écartée est consignée dans `ReadingLog`.
