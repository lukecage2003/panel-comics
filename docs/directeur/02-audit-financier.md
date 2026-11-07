# Plan directeur 2.0 · 02 — Audit financier de Collection

Statut : **audit et conception à valider** (7 novembre 2026). Aucun code ni aucune donnée n'ont été modifiés.

Légende :
- **[Fait]** : constaté dans le code ;
- **[Reco.]** : recommandation ;
- **[À valider]** : décision de l'utilisateur.

Les numéros de ligne renvoient à `index.html`.

Panel n'est pas un conseiller financier. Les montants affichés sont des **estimations** pour un suivi personnel de collection, jamais un conseil d'achat ou de vente.

## 1. Le modèle actuel

### 1.1 Champs disponibles par exemplaire [Fait]
| Champ | Sens | Remarque |
|---|---|---|
| `coverPrice` | Prix de couverture (facial) | Saisi ou importé ; libellé « Prix de couverture ($) » (l. 2441) |
| `purchasePrice` | Prix payé | Libellé « Prix payé ($) » (l. 2451) ; `0` est accepté (exemplaire gratuit) |
| `purchaseDate` | Date d'achat | Remplie avec la date du jour quand l'ajout se fait depuis les sorties ou la wishlist (l. 8617) |
| `estValue` | Valeur estimée actuelle | Écrite par la cote automatique, une cote marché ou l'utilisateur |
| `valueSource` | `auto`, `manual` ou `market` | La cote auto n'écrase ni `manual` ni `market` (l. 6331–6338) |
| `valuation` | Détail de la cote auto : `value`, `low`, `high`, `confidence`, `factors`, `computedAt` | Confiance « moyenne » ou « faible » ; fourchette ×0,75–1,35 ou ×0,55–1,8 (l. 6308–6318) |
| `valueHistory` | 40 dernières valeurs `{date, value, source, note}` | l. 6321–6328 |
| `condition` | État | « NM 9.4 (Near Mint) » par défaut à la création depuis les sorties et la wishlist (l. 8617, 8683) |

**Absents** :
- frais, port, taxes ;
- devise (`purchaseCurrency` n'existe qu'à l'export, valeur par défaut `'USD'`, l. 5116) ;
- lot d'achat, vendeur ou magasin ;
- statut de sortie (vendu, donné, perdu), date et prix de vente, frais de vente.

### 1.2 Calculs actuels [Fait]
```js
const money   = n => '$' + (Number(n) || 0).toLocaleString('en-US', …);        // l. 4805
const paidOf  = s => numOrNull(s.purchasePrice) ?? numOrNull(s.coverPrice) ?? 0; // l. 4817
const valueOf = s => numOrNull(s.estValue)      ?? numOrNull(s.coverPrice) ?? 0; // l. 4818
const isOwned = s => !s.isWishlist;                                              // l. 4816
```
`updateSinglesStats` (l. 6978–7000) calcule les valeurs suivantes.
- `Valeur estimée` = somme de `valueOf` sur **tous** les exemplaires possédés.
- `Investi` = somme de `paidOf` sur les exemplaires qui ont un prix payé **ou** un prix de couverture.
- `Plus-value` = somme de `valueOf` sur ce même ensemble, moins `Investi`.
- `%` = plus-value ÷ investi, avec la mention « sur N ex. avec prix ».
- Puis `recordValueSnapshot(totalValue, invested, n)` (l. 6416).

Le tableau de bord (l. 10031–10145) réutilise `valueOf` et `paidOf` pour :
- la valeur par éditeur ;
- le top 10 ;
- les meilleures plus-values ;
- les dépenses sur 12 mois (`m.spent += paidOf(s)`).

## 2. Anomalies

| # | Anomalie | Exemple concret | Gravité |
|---|---|---|---|
| F-01 | **Prix payé inconnu remplacé par le prix de couverture** dans « Investi » (sous-titré « prix payés »), la plus-value et les dépenses mensuelles | Prix payé non saisi, couverture 4,99, cote auto 12 → Panel affiche 4,99 investis et +7,01 de plus-value, alors que le coût réel est **inconnu** | P0 |
| F-02 | **Valeur inconnue remplacée par le prix de couverture, puis par 0** | Prix payé 30, ni cote ni couverture → valeur 0, et une **perte fictive de −30** entre dans la plus-value | P0 |
| F-03 | **Cotes heuristiques additionnées comme des valeurs sûres** : la cote auto (médiane par époque × multiplicateurs, confiance au mieux « moyenne ») est sommée avec les cotes marché et manuelles ; les fourchettes sont ignorées | « Valeur estimée 1 240 $ » sans dire que 90 % viennent d'heuristiques de confiance faible | P0 |
| F-04 | **État inventé** : NM 9.4 par défaut (l. 8617, 8683), alors que le multiplicateur de grade est calé sur 9.4 = 1 (l. 6295–6298) | Un exemplaire en mauvais état, ajouté depuis les sorties, est coté comme NM | P0 (nouvelles fiches) |
| F-05 | **`null` affiché « $0.00 »** (`Number(null) \|\| 0`) | Une valeur absente ressemble à une valeur nulle | P0 |
| F-06 | **Devise unique codée en dur** (`$`, `en-US`), alors que l'utilisateur achète probablement en euros **[Hyp.]** | 25 € saisis apparaissent « $25.00 » | P1 (modèle) ; libellés P0 |
| F-07 | **Pas de frais d'acquisition** | Exemple de référence : payé 25 € + 3 € de frais, valeur 40 €. Attendu : coût 28 €, +12 €, +42,86 %. Panel : coût 25, +15, +60 % | P1 |
| F-08 | **Pas de lot** : un achat groupé ne peut pas être réparti | 10 numéros pour 50 € port compris : aucune méthode, l'utilisateur divise à la main | P1 |
| F-09 | **Pas de sortie de collection** : un exemplaire vendu est supprimé (son historique est perdu) ou reste « possédé » (il gonfle la valeur) | Impossible de calculer une plus-value **réalisée** | P1 |
| F-10 | **Instantanés globaux biaisés** : `panel_value_snapshots` enregistre depuis l'origine des totaux qui contiennent les substitutions F-01 à F-03 | La courbe d'évolution mélange valeurs connues et substituées | P0 (marquage, sans réécriture) |
| F-11 | **Top des plus-values** (l. 10057) calculé avec `paidOf` : un prix de couverture tient lieu de prix payé | Une « meilleure plus-value » peut porter sur un coût inconnu | P0 (même correctif que F-01) |
| F-12 | **Wishlist** : « $0 estimés » (l. 1917) avec la même logique de substitution | — | P2 |

Points corrects à conserver [Fait] :
- un prix payé de `0` (gratuit) est bien compté 0 ;
- la cote auto ne remplace jamais une valeur manuelle ou marché ;
- l'historique par fiche ignore `null` (l. 6322).

## 3. Modèle cible [Reco., À valider F-D1]

### 3.1 Dix notions distinctes
| # | Notion | Définition | Stockage proposé |
|---|---|---|---|
| 1 | Prix de couverture | Prix facial imprimé, dans sa devise | `coverPrice` (existant) + `coverCurrency` |
| 2 | Prix d'achat réel | Montant payé pour **cet** exemplaire, hors frais | `purchasePrice` (existant) ; `null` = inconnu, `0` = gratuit |
| 3 | Quantité | Toujours un exemplaire par fiche ; la quantité est une vue (regroupement) ou une saisie de lot qui crée N fiches | Pas de champ `qty` sur la fiche |
| 4 | Frais | Frais imputables à l'acquisition : port, taxes, commission, gradation achetée avec l'exemplaire | `acquisitionFees` (montant) + `feesDetail` facultatif |
| 5 | Coût d'acquisition | **Prix payé + frais imputables** | Calculé, jamais saisi ; `null` si le prix payé est inconnu |
| 6 | Investissement total | Somme des coûts d'acquisition **connus** des exemplaires possédés | Calculé, avec sa couverture |
| 7 | Valeur estimée actuelle | Dernière estimation retenue, avec source, date, confiance et fourchette | `estValue`, `valueSource`, `valuation` (existants) + `valuedAt` |
| 8 | Plus ou moins-value latente | **Valeur estimée − coût d'acquisition**, pour un exemplaire possédé dont les deux sont connus | Calculé |
| 9 | Évolution en % | **Plus-value ÷ coût d'acquisition × 100**, indéfinie si le coût vaut 0 ou est inconnu | Calculé ; affiché « — » si indéfini |
| 10 | Historique de valeur | Suite datée des estimations, avec leur source | `valueHistory` (existant) ; instantanés globaux versionnés (§ 6) |

S'y ajoutent, pour les sorties de collection :
- `disposal: { kind: 'sold' | 'gift' | 'lost' | 'traded', date, price, fees, currency }` ;
- **plus-value réalisée** = prix de vente − frais de vente − coût d'acquisition.

Un exemplaire sorti **n'est plus possédé** :
- il quitte la valeur et l'investissement ;
- il reste dans un historique « Sorties ».

### 3.2 Formules et exemple de référence
```
Coût d'acquisition  = prix payé + frais imputables               (inconnu si le prix payé est inconnu)
Plus-value latente  = valeur estimée − coût d'acquisition        (inconnue si l'un des deux l'est)
Évolution %         = plus-value latente ÷ coût d'acquisition × 100  (indéfinie si coût = 0 ou inconnu)
Plus-value réalisée = prix de vente − frais de vente − coût d'acquisition
```
Exemple : 25 € + 3 € = **28 €** ; valeur 40 € → **+12 €** ; 12 ÷ 28 × 100 = **+42,86 %**.

Le test d'acceptation **T-F1** reprend exactement ce cas.

### 3.3 Règles de calcul
1. **Jamais de substitution silencieuse.**
   - Le prix de couverture n'est jamais un prix payé.
   - L'absence n'est jamais zéro.
   - Une donnée inconnue est exclue du total concerné et **comptée** dans un indicateur de couverture.
2. **Agrégats sur des ensembles explicites.**
   - La plus-value latente globale se calcule seulement sur les exemplaires dont le coût **et** la valeur sont connus.
   - L'interface affiche toujours « sur N exemplaires sur M ».
3. **Montants en centimes entiers et code ISO 4217.** Cela évite les erreurs d'arrondi.
   - L'arrondi se fait à l'affichage seulement, avec le format `fr-FR` et la devise de l'exemplaire.
4. **Devises.**
   - Les totaux sont calculés **par devise**.
   - Une conversion n'est faite que si l'utilisateur choisit une devise de référence **et** qu'un taux daté et sourcé est disponible.
   - La conversion est affichée comme telle (« ≈, au taux du JJ/MM/AAAA »).
   - Pas de conversion automatique sans source **[À valider F-D2]**.
5. **Fiabilité de la valeur.** Chaque total de valeur est ventilé par source :
   - marché, avec sa date ;
   - manuelle ;
   - automatique, avec sa confiance.
   On affiche aussi une **fourchette agrégée**, somme des bornes basses et hautes des cotes auto.
6. **Ancienneté.** Une estimation de plus de 180 jours est « à revoir » **[À valider F-D3]**. Elle reste comptée, mais elle est signalée.
7. **État inconnu.** La cote auto d'un exemplaire sans état utilise une hypothèse affichée (« état non renseigné, hypothèse NM 9.4 ») et passe en confiance « faible ». L'état n'est plus écrit d'office dans la fiche.

### 3.4 Répartition d'un lot [Reco., À valider F-D4]
Une **acquisition** regroupe une ou plusieurs fiches :
`{id, date, vendor, currency, totalPaid, fees, allocation, lines: [{copyId, allocatedPrice, allocatedFees}]}`.

Méthodes de répartition, à choisir explicitement, sans méthode cachée :

| Méthode | Règle | Usage |
|---|---|---|
| Proportionnelle au prix de couverture (proposée par défaut) | Part = couverture de la ligne ÷ somme des couvertures | Lots de numéros réguliers |
| Égale | Total ÷ nombre de lignes | Couvertures inconnues |
| Proportionnelle à la valeur estimée au moment de l'achat | Part = valeur de la ligne ÷ somme des valeurs | Lots mêlant keys et numéros courants |
| Manuelle | Saisie par ligne, avec contrôle de la somme | Cas particuliers |

Invariants vérifiables :
- la somme des parts est égale au total, au centime près ;
- le reste d'arrondi est affecté à la ligne la plus chère, et c'est affiché ;
- la méthode et la date sont enregistrées ;
- une modification du lot recalcule les parts sans toucher aux autres champs des fiches.

Les frais du lot se répartissent selon la même méthode, sauf choix contraire.

### 3.5 Cas particuliers
| Cas | Traitement |
|---|---|
| Gratuit (cadeau, promotion) | `purchasePrice = 0` ; coût = frais éventuels ; % indéfini si coût 0 ; une plus-value peut s'afficher en montant |
| Prix payé inconnu | Coût inconnu ; exclu de l'investissement et de la plus-value ; compté dans « coût inconnu » |
| Plusieurs exemplaires du même numéro | Une fiche par exemplaire, chacune avec son coût, son état et sa valeur ; regroupement à l'affichage |
| Port seul (achat unitaire) | Frais de l'exemplaire |
| Estimation absente | Exclue de la valeur ; comptée dans « valeur inconnue » |
| Estimation ancienne | Comptée, signalée « à revoir » (§ 3.3, règle 6) |
| Vente | Sortie de collection, plus-value réalisée ; la fiche est conservée, jamais supprimée d'office |
| Don, perte, échange | Sortie sans prix (ou avec une valeur d'échange déclarée) ; pas de plus-value réalisée inventée |
| Données historiques (avant le nouveau modèle) | Lues telles quelles ; `purchasePrice` null reste « inconnu » ; aucune reconstruction automatique |
| Valeur partielle ou incertaine | Fourchette affichée ; confiance visible |

## 4. Indicateurs distincts du tableau de bord financier [Reco.]
| Indicateur | Calcul | Toujours accompagné de |
|---|---|---|
| Valeur estimée totale | Somme des valeurs connues des exemplaires possédés | Ventilation par source, fourchette des cotes auto, nombre d'exemplaires sans valeur |
| Investissement total | Somme des coûts connus des exemplaires possédés | Nombre d'exemplaires au coût inconnu |
| Plus-value latente | Sur les exemplaires où coût **et** valeur sont connus | « sur N ex. » et % sur ce même ensemble |
| Plus-value réalisée | Sur les sorties vendues dont le coût est connu | Nombre de ventes au coût inconnu |
| Données inconnues | Comptes : coût inconnu, valeur inconnue, état inconnu, estimations anciennes | Lien vers la liste filtrée, pour compléter |
| Couverture | % d'exemplaires possédés avec coût connu, avec valeur connue, avec les deux | Jauge simple |
| Dépenses par mois | Coûts connus par mois d'achat | Part inconnue du mois |

**Tableau de bord dédié [Reco., À valider U-D2]** : un onglet « Finances » dans Collection, séparé des statistiques de collection (séries, éditeurs, lectures), avec :
- les indicateurs ci-dessus ;
- les sorties et la plus-value réalisée ;
- les dépenses ;
- les actions « compléter les données manquantes ».

Il doit rester **privé** : jamais d'export vers S3 ni vers Community sans décision explicite.

## 5. Correctifs proposés
| Lot | Contenu | Données touchées |
|---|---|---|
| **F0** (correctifs de calcul et d'affichage, sans migration) | F-01, F-02, F-03 (ventilation par source et couverture), F-05, F-10 (marquage), F-11, libellés de devise neutres ; F-04 limité aux **nouvelles** fiches (« état non renseigné ») | Aucune donnée existante modifiée ; seule la façon de calculer et d'afficher change, plus un champ de version sur les nouveaux instantanés |
| **F1** (modèle étendu, champs ajoutés seulement) | Devise, frais, acquisitions et lots, sorties de collection, onglet Finances | Champs **ajoutés** ; aucune donnée existante réécrite ; sauvegarde avant ; inclus dans la sauvegarde Collection (B1) |

Ordre proposé : voir [`04`](04-backlog-feuille-de-route-decisions.md) § 2.

## 6. Historique existant : ne rien réécrire
- Les instantanés `panel_value_snapshots` existants sont conservés **tels quels**.
- Les nouveaux instantanés portent un champ `m: 2` (méthode 2). Les anciens, sans `m`, sont affichés comme « ancienne méthode (inclut des substitutions) », par exemple en pointillés.
- `valueHistory` par fiche reste valable : il ne contient que des valeurs réelles de cote, puisque `null` est ignoré.
- Aucune valeur `coverPrice` n'est copiée vers `purchasePrice` ; aucune fiche n'est complétée automatiquement.

## 7. Tests d'acceptation financiers (à ajouter à `run-all-tests.js` au lot F0 ou F1)
| # | Cas | Attendu |
|---|---|---|
| T-F1 | 25 € + 3 € de frais, valeur 40 € | Coût 28,00 ; +12,00 ; +42,86 % |
| T-F2 | Prix payé inconnu, couverture 4,99, valeur 12 | Exclu de l'investissement et de la plus-value ; compté « coût inconnu » |
| T-F3 | Prix payé 30, aucune valeur | Exclu de la valeur et de la plus-value ; aucune perte de −30 |
| T-F4 | Gratuit, valeur 10 | Coût 0 ; +10 ; % « — » |
| T-F5 | Lot de 3 fiches, 50 €, couvertures 3,99 / 3,99 / 4,99 | Parts 15,38 / 15,38 / 19,24 (reste d'arrondi sur la plus chère) ; somme 50,00 |
| T-F6 | Deux devises (EUR, USD), sans devise de référence | Deux totaux séparés ; aucune somme mixte |
| T-F7 | Vente à 60 €, 5 € de frais, coût 28 | Plus-value réalisée +27 ; l'exemplaire n'est plus compté comme possédé |
| T-F8 | `null` partout | Affichage « — », jamais « 0,00 » |
| T-F9 | Données d'avant F0 | Lecture sans perte ; empreinte des fiches identique avant et après chargement |
| T-F10 | Ventilation | Somme des parts manuelle + marché + auto = valeur totale |
