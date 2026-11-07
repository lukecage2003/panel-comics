# Plan directeur 2.0 · 06 — Spécifications des lots F1 (finances) et L1 (lecture)

Statut : **spécification à valider** (8 novembre 2026). F1 et L1 sont intégrés à la feuille de route (D-17) mais **non autorisés à démarrer**.

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
- l'export écrit `purchaseCurrency: 'USD'` par défaut (l. ~5164), ce qui affirme une devise jamais saisie.

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

### B.7 Décisions propres à L1
| # | Question | Recommandation |
|---|---|---|
| L-D1 | Stockage de l'état par œuvre : localStorage `panel_reading_v1` ou nouveau store IndexedDB | localStorage au départ |
| L-D2 | Migration de `isRead` vers Lecture, et conservation des champs d'origine | Migrer avec conservation pendant deux versions |
| L-D3 | Note en conflit entre exemplaires | Garder la plus récente, et l'ancienne dans le journal |
| U-D1, U-D3 | Place de la Lecture dans la navigation ; identité d'œuvre | Voir [`04`](04-backlog-feuille-de-route-decisions.md) § 4 |
