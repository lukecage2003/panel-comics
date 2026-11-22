# Modèle financier — six scénarios (D-111)

> **Ce ne sont pas des prévisions.** Ce sont des calculs à partir d'hypothèses écrites, pour savoir **quels chiffres il faudra mesurer**. Aucun résultat n'est garanti. Aucun prix d'hébergement, de prestataire ou de partenaire n'est inventé : ils restent des variables `[À COMPLÉTER]`.

## 1. Formules

### Variables

| Variable | Sens |
|---|---|
| `M` | Membres actifs par mois |
| `a` | Part des membres adultes |
| `c` | Conversion vers Panel+, parmi les adultes |
| `P` | Prix mensuel net de Panel+ après frais de plateforme |
| `B` | Boutiques vérifiées |
| `Pb` | Prix mensuel d'une fiche boutique |
| `H(M)` | Hébergement mensuel pour `M` membres |
| `Mod` | Coût mensuel de la modération |
| `F` | Frais fixes : comptable, assurance, domaine |

### Calcul

- **Revenu mensuel** `R = M × a × c × P + B × Pb`
- **Coût mensuel** `C = H(M) + Mod + F`
- **Résultat** `R − C`
- **Seuil** : il est atteint quand `M × a × c × P + B × Pb ≥ H(M) + Mod + F`.

## 2. Hypothèses communes

| Variable | Valeur retenue | Source |
|---|---|---|
| `a` | 0,85 | Hypothèse, à mesurer |
| `P` | Aucune valeur chiffrée | Seule piste écrite : environ 3 € par mois (D-98, à valider). La part nette après frais dépend des conditions des plateformes `[À COMPLÉTER]`. |
| `H(M)`, `Mod`, `F`, `Pb` | **Inconnus** `[À COMPLÉTER]` | Les scénarios les gardent en lettres. |

## 3. Scénarios

Chaque scénario donne :
- le nombre d'abonnés Panel+ attendu, `M × a × c` ;
- le revenu, exprimé en multiples de `P` et de `Pb`.

| # | Scénario | M | c | B | Abonnés Panel+ | Revenu mensuel |
|---|---|---|---|---|---|---|
| 1 | **Local seulement** (aujourd'hui) | — | 0 | 0 | 0 | 0 |
| 2 | **Beta fermée** | 500 | 0 % (pas de vente en beta) | 0 | 0 | 0 |
| 3 | **Lancement prudent** | 5 000 | 1 % | 5 | 42,5 | `42,5 P + 5 Pb` |
| 4 | **Lancement médian** | 20 000 | 2 % | 20 | 340 | `340 P + 20 Pb` |
| 5 | **Croissance forte** | 100 000 | 3 % | 80 | 2 550 | `2 550 P + 80 Pb` |
| 6 | **Stress** : croissance sans revenus | 100 000 | 0,5 % | 0 | 425 | `425 P`, à comparer à `H(100 000) + Mod` |

Lecture des scénarios :
- **1. Local seulement** : coût d'hébergement nul, pas de revenu. Pas de risque financier.
- **2. Beta fermée** : il faut couvrir `H(500) + F`. C'est le coût d'apprentissage.
- **3. Lancement prudent** : conversions basses et quelques boutiques pilotes.
- **4. Lancement médian** : hypothèse centrale, à remplacer par les mesures de la beta.
- **5. Croissance forte** : les directs réels deviennent nécessaires. `H` augmente fortement avec le serveur média (DEFERRED).
- **6. Stress** : il montre le danger d'ouvrir les directs réels avant d'avoir des revenus.

## 4. Ce qu'il faut mesurer en beta

- Membres actifs.
- Part d'adultes.
- Intention d'achat déclarée. Ce n'est pas une vente.
- Coût réel de la base par membre, sur les factures.
- Temps de modération par 1 000 membres.
- Intérêt des boutiques, en entretiens, sans engagement.

## 5. À valider

**Avec un comptable** :
- le statut de l'éditeur ;
- la TVA sur les abonnements numériques (règles du lieu du client dans l'UE) ;
- le traitement des commissions des plateformes.

**Règle de mise à jour** : dès qu'une facture réelle existe, sa valeur remplace la variable correspondante dans ce document, avec sa date.
