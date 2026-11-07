# Plan directeur 2.0 · 04 — Backlog P0 à P3, feuille de route, décisions ouvertes

Statut : **proposition à valider** (7 novembre 2026). Aucun lot n'est lancé.

L'ordre des lots de Phase 3, Phase 4 et Community reste celui de [`phase4/08`](../phase4/08-plan-execution.md), qui fait autorité. Ce document y **insère** deux lots de correction (F0, F1) et un lot Lecture (L1), sous réserve de validation (décision G-F).

Priorités :
- **P0** : intégrité des données, erreurs de calcul, sécurité, risque de perte ;
- **P1** : modèle ou séparation nécessaires avant d'aller plus loin ;
- **P2** : finition ;
- **P3** : long terme.

Les numéros de ligne renvoient à `index.html`.

## 1. Backlog

### P0
| # | Problème | Solution | Domaine | Fichiers | Dépendances | Difficulté | Risque | Critères d'acceptation |
|---|---|---|---|---|---|---|---|---|
| B-01 | Prix de couverture compté comme prix payé (F-01, F-11) | `paidOf` renvoie `null` si le prix payé est inconnu ; agrégats sur les ensembles connus, avec une couverture | Collection | `index.html` (l. 4817, 6978–7000, 10031–10145), `run-all-tests.js` | — | Faible | Faible : changement de chiffres affichés, sans toucher aux données | T-F2, T-F4 ; « Investi » = somme des prix payés connus |
| B-02 | Valeur inconnue = couverture ou 0 (F-02) | `valueOf` renvoie `null` ; exclusion et comptage « valeur inconnue » | Collection | idem (l. 4818) | — | Faible | Faible | T-F3 ; aucune perte fictive |
| B-03 | Cotes auto additionnées comme sûres (F-03) | Ventilation de la valeur totale par source, fourchette agrégée des cotes auto, badge de confiance | Collection | idem | B-02 | Moyenne | Faible | T-F10 ; fourchette visible ; part auto en % |
| B-04 | `null` affiché « $0.00 », dollar codé en dur (F-05, F-06 libellés) | `money(null)` → « — » ; format `fr-FR` ; libellés sans « ($) » tant que la devise n'existe pas (F1) | Collection | idem (l. 4805, 2441–2451, 1891–1917, 6858) | — | Faible | Faible | T-F8 ; aucun « $ » dans les libellés de saisie |
| B-05 | État NM 9.4 inventé à la création (F-04) | Les nouvelles fiches ont un état vide ; la cote auto affiche l'hypothèse et passe en confiance faible ; **aucune fiche existante modifiée** | Collection | idem (l. 8617, 8683 ; autres occurrences de création à recenser) | — | Faible | Moyen : estimations des nouvelles fiches plus prudentes | Une fiche créée depuis les sorties a `condition = ''` ; empreinte des fiches existantes inchangée |
| B-06 | Instantanés globaux biaisés (F-10) | Nouveaux instantanés avec `m: 2` ; les anciens affichés « ancienne méthode » ; **aucune réécriture** | Collection | idem (l. 6416–6428) | B-01, B-02 | Faible | Faible | Les clés `panel_value_snapshots` existantes restent identiques octet pour octet |
| B-07 | Secrets inclus dans les exports par défaut | Déjà prévu : B1, lot 3.1b ([`phase4/06`](../phase4/06-sauvegardes-par-domaine.md)) | Transversal | — | G2 | — | — | Critères de `06` |

### P1
| # | Problème | Solution | Domaine | Fichiers | Dépendances | Difficulté | Risque | Critères d'acceptation |
|---|---|---|---|---|---|---|---|---|
| B-10 | Pas de frais (F-07) | Champ `acquisitionFees` ; coût d'acquisition calculé | Collection | `index.html`, tests | F0, sauvegarde | Moyenne | Faible (champ ajouté) | T-F1 |
| B-11 | Pas de devise (F-06) | `purchaseCurrency`, `coverCurrency`, devise par défaut ; totaux par devise | Collection | idem | F-D2 | Moyenne | Moyen : anciennes fiches sans devise (traitées comme « devise non précisée », affichées à part) | T-F6 |
| B-12 | Pas de lots (F-08) | Acquisitions avec une méthode de répartition explicite | Collection | idem | B-10, F-D4 | Élevée | Moyen | T-F5 ; invariant de somme |
| B-13 | Pas de sortie de collection (F-09) | `disposal` ; vue « Sorties » ; plus-value réalisée | Collection | idem | B-10 | Moyenne | Moyen : `isOwned` change de définition (vérifier ses 8 occurrences et tous les filtres sur `isWishlist`) | T-F7 ; aucune fiche supprimée par une vente |
| B-14 | Onglet Finances | Indicateurs de [`02`](02-audit-financier.md) § 4 | Collection | idem | B-10 à B-13, U-D2 | Moyenne | Faible | Tous les indicateurs présents avec leur couverture |
| B-15 | Couplages C, D, E et A7 | Lot 3.1b (fournisseurs, S1 et S2 locaux, B1) | Tous | idem | G2, 3.1 | Élevée | Moyen | Critères de [`phase4/08`](../phase4/08-plan-execution.md) |
| B-16 | Lecture par exemplaire, double progression | Progression par œuvre dans le domaine Lecture ; `isRead` lu par compatibilité et migré sans perte | Lecture | idem | 3.1b, U-D3 | Moyenne | Moyen : migration de données de lecture (sauvegarde avant, autorisation requise) | Une œuvre lue une fois apparaît lue pour tous ses exemplaires ; aucune donnée `readprog` ou `isRead` perdue |
| B-17 | Mangas dans les Sorties (D-12) | Filtre `medium` ([`phase4/04`](../phase4/04-perimetre-sorties-comics.md)) | Explorer | idem (l. 7463–7476, 7556) | M1 à M4 | Faible | Faible : publications masquées, jamais supprimées | Aucun format `manga` affiché dans les Sorties |

### P2
| # | Problème | Solution | Domaine | Dépendances | Critères d'acceptation |
|---|---|---|---|---|---|
| B-20 | États vides génériques | Un message et une action par contexte | Tous | — | Revue au navigateur |
| B-21 | Filtres de données manquantes | Coût inconnu, valeur inconnue, état non renseigné, estimation à revoir | Collection | F0 | Filtres présents ; compteurs exacts |
| B-22 | Estimations anciennes | Signal à 180 jours (F-D3) | Collection | F0 | Signal visible |
| B-23 | Navigation (A6) | Selon N1 à N5, M-A à M-E, U-D1 | Tous | Décisions | Explorer présent dans le dock mobile |
| B-24 | Wishlist « $0 estimés » (F-12) | Même logique que B-02 | Collection | F0 | « — » si aucune valeur |
| B-25 | Revue UX au navigateur (bureau, mobile) | Faite. Débordement du formulaire d'ajout **corrigé** (finition F0, vérifié à 320, 360, 390 et 430 px). Reste : sur mobile, les sous-lignes des statistiques (couverture des données) sont masquées | Collection | — | Reste à traiter en P2 (B-26) |
| B-26 | Sous-lignes des statistiques masquées sur mobile | Afficher la couverture (« N inconnus ») dans un format compact ou au toucher | Collection | — | Couverture visible à 375 px |

### P3
| # | Sujet | Dépendances |
|---|---|---|
| B-30 | Écran Lecture complet : journal, rythme, objectifs annuels (lot L1) | B-16 |
| B-31 | Cote marché licenciée | Contrat avec une source ; aucun engagement sans validation |
| B-32 | Community C-0 puis C-1 | Phase 3, 4.10, validation juridique |
| B-33 | Conversion de devises avec taux sourcés | B-11, choix d'une source |

## 2. Feuille de route
| Étape | Lots | Statut |
|---|---|---|
| 1. Corrections avant de continuer | **F0** (B-01 à B-06, B-24, B-25) | **Approuvé (D-17), livré le 8 novembre 2026, en attente de validation** ; ajout de D-18 (préremplissage du prix d'achat) |
| 2. Conception et finition | Décisions F-D1 à F-D6, U-D1 à U-D3 ; N et M ; B-20 à B-22 | En attente |
| 3. Architecture | **3.1** → **3.1b** (B-07, B-15, B-17 si M1 à M4 tranchées), dans l'ordre de [`phase4/08`](../phase4/08-plan-execution.md) | Lot 3.1 suspendu ; reprise seulement sur votre instruction |
| 4. Développement fonctionnel | **F1** (B-10 à B-14) après 3.1b, pour que le fournisseur Collection de B1 sauvegarde d'emblée les nouveaux champs ; **L1** (B-16) après 3.1b ; puis 3.2 à 3.7, puis 4.1 à 4.11 | Proposé |
| 5. Long terme | B-30 à B-33, Community | — |

Ordre proposé, **à valider (G-F)** :
```
F0 → 3.1 → 3.1b → F1 → L1 → 3.2 … 3.7 → 4.1 … 4.11 → C-0 …
```
- F1 et L1 sont indépendants de 3.2 et 3.3. Ils pourraient aussi être placés **après** la Phase 3, mais seulement avant 3.4 si l'on veut éviter de synchroniser un modèle qui changera.
- Les champs étant seulement ajoutés dans `copies.data` (option F-D5-1), il n'y a pas de dépendance stricte.

### Prochaine phase recommandée : lot F0
| | |
|---|---|
| Objectif | Des chiffres financiers exacts et honnêtes, sans modifier une seule donnée existante |
| Contenu | B-01 à B-06, B-24 ; tests T-F2 à T-F4, T-F8 à T-F10 ; revue au navigateur B-25 |
| Hors périmètre | Frais, devises, lots, sorties (F1) ; séparation des domaines (3.1b) ; aucun nouveau stockage |
| Sauvegarde | Copies datées de `index.html` et `run-all-tests.js` avant modification ; les copies `*.backup.20261107-lot31` sont conservées |
| Critères de validation | 28 tests existants verts et nouveaux tests verts ; empreinte de `panel_physical_singles` et de `panel_value_snapshots` identique avant et après chargement ; aucun « $0.00 » pour une valeur inconnue ; « Investi » n'inclut aucun prix de couverture ; capture bureau et mobile du tableau de bord |
| Retour arrière | Revenir au commit précédent : aucune donnée n'a changé de format |

## 3. Contradictions et hypothèses relevées
| # | Constat | Traitement |
|---|---|---|
| X-F1 | `phase4/08` place 3.1 en premier ; ce plan propose F0 avant 3.1 | Pas une contradiction de décision : 3.1 est suspendu et F0 ne touche pas le backend. **À valider (G-F)** |
| X-F2 | A3 attribue la progression à Lecture, mais `isRead` vit dans les fiches de Collection | Transition déjà prévue (« responsabilité provisoire de Collection ») ; B-16 la termine |
| X-F3 | Libellé « Investi — prix payés » faux tant que B-01 n'est pas fait | Corrigé par F0 |
| H-1 | L'utilisateur achète principalement en euros | Hypothèse ; F-D2 |
| H-2 | Les constats UX de rendu viennent du code, pas d'un passage au navigateur | B-25 |
| H-3 | La licence GCD (CC BY-SA 4.0) impose le partage à l'identique d'une base dérivée | Interprétation ; validation juridique avant tout usage |

## 4. Décisions ouvertes (ajoutées à [`../DECISIONS.md`](../DECISIONS.md))
| # | Question | Options | Recommandation |
|---|---|---|---|
| G-F | Insérer F0, F1, L1 dans le plan | Oui (ordre du § 2) / autre ordre / non | Oui |
| F-D1 | Adopter le modèle financier de [`02`](02-audit-financier.md) § 3 | Oui / à amender | Oui |
| F-D2 | Devise par défaut et conversion | EUR sans conversion automatique / USD / choix au premier usage | EUR, sans conversion automatique |
| F-D3 | Délai au-delà duquel une estimation est « à revoir » | 90 / 180 / 365 jours | 180 |
| F-D4 | Méthode de répartition des lots par défaut | Couverture / égale / valeur / manuelle | Couverture, avec le choix toujours visible |
| F-D5 | Stockage serveur des acquisitions | 1 : dans `copies.data` / 2 : table au lot 3.4 | 1 |
| F-D6 | Renommer les libellés « $ » dès F0 | Oui / attendre F1 | Oui (libellés neutres) |
| U-D1 | Place de la Lecture dans la navigation | L-A / L-B / L-C | L-C ou L-A selon N et M |
| U-D2 | Place des Finances | Fi-A / Fi-B | Fi-A |
| U-D3 | Identité d'œuvre pour la Lecture | Identifiant de catalogue avec repli local / autre | Identifiant de catalogue avec repli |
