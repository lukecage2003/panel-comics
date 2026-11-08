# Journal d'avancement — mission « Accélération stratégique » (8 novembre 2026)

| Étape | État | Modifications | Tests | Décisions | Points bloquants | Prochaine action |
|---|---|---|---|---|---|---|
| 0. État du dépôt | Terminé | — | — | — | — | — |
| 1.1 Ajouts rapides (prix) | Terminé | `index.html` : bouton « = prix de couverture » (action explicite, aussi en modification) ; aucun chemin d'ajout rapide n'invente de prix payé (vérifié dans le code) | Test 30 étendu (34 vérifications) | Application de D-18, sans nouvelle règle | — | — |
| 1.2 Débordement mobile | Terminé | `index.html` : CSS du formulaire d'exemplaire (`min-width: 0`, retours à la ligne, pied de fenêtre) | Contrôle manuel à 320, 360, 390 et 430 px, et sur bureau | — | B-26 (sous-lignes des statistiques masquées sur mobile, P2) noté | — |
| 1.3 Devise (F-D2) | Documenté, **ouvert** | Options A à D et conséquences dans [`06`](06-specifications-F1-L1.md) § A.4 | — | Aucune | Décision F-D2 | Choix de l'utilisateur |
| Validation F0 | Terminé | `sw.js` → `panel-2026-11-08-f0b` ; historique et backlog | **29/29** | — | Validation utilisateur de F0 | — |
| 2. Lot 3.1 | **Non repris** : plan actualisé | [`phase4/08`](../phase4/08-plan-execution.md) § 5 ; [`phase3/08`](../phase3/08-lot-3.1-prompt.md) | — | — | G1 (validation des documents d'architecture) | Validation G1, puis le prompt de `phase3/08` est prêt |
| 3. Lot 3.1b | Préparé, non implémenté | [`05`](05-preparation-lot-3.1b.md) | — | — | Approbation de 3.1b, P1, B1-a/b/c | Décisions |
| 4. F1 et L1 | Spécifiés, non démarrés | [`06`](06-specifications-F1-L1.md) | — | — | Autorisation ; F-D2, F-D4, L-D1 à L-D3 | Décisions |
| 5. Explorer 2.0 et Community | Conçus, non implémentés | [`07`](07-conception-explorer-2.0-community.md) | — | — | Phase 3, 3.1b, M1 à M4, juridique | Validation de la conception |

Sauvegardes : aucune nouvelle copie n'a été nécessaire. Les copies `*.backup.20261107-f0`, réalisées avant F0, couvrent `index.html`, `run-all-tests.js` et `sw.js`. Les copies `*.backup.20261107-lot31` et `_backups/` sont intactes ; aucune n'a été supprimée.

## 8 novembre 2026 — validation F0 et G1, lot 3.1
| Étape | État | Modifications | Tests | Décisions | Points bloquants | Prochaine action |
|---|---|---|---|---|---|---|
| Validations | Terminé | DECISIONS : D-19 (F0 validé), D-20 (G1 validé) | — | D-19, D-20 | — | — |
| Lot 3.1 | Livré, en attente de validation | backend/, scripts/check-secrets.js, package.json, runbooks, `Panel.sync.readiness()`, test 31 | Base : 71/71 ; secrets : 0 ; front : 30/30 au deuxième passage (premier passage : 29/30, échec intermittent du contrôle `quota` du test 18) | — | Validation de référence sous Docker non exécutée | Validation du lot 3.1, puis lot 3.2 (projet Supabase créé par l'utilisateur) ou 3.1b |

## 8 novembre 2026 — mission « Méga mission d'accélération »
| Étape | État | Modifications | Tests | Décisions | Points bloquants | Prochaine action |
|---|---|---|---|---|---|---|
| A. Audit de clôture 3.1 | Terminé | Migration 7 (D1 à D3), `hardening.test.js`, `verify-supabase.sql`, `check-boundaries.js`, test 18 stabilisé, [`phase3/09`](../phase3/09-audit-cloture-lot-3.1.md) | Base 82/82 ; front 30/30 ; secrets 0 | — | Supabase local non exécuté (Docker absent) | Installation de Docker par l'utilisateur, puis procédure de l'audit |
| B. Plan final 3.1b | Terminé (analyse seule) | [`05`](05-preparation-lot-3.1b.md) : carte des couplages, dépendances cachées, ordre | `check:boundaries` : 15 couplages | — | Approbation de 3.1b, P1, B1-a/b/c | Décisions |
| C. Lots 3.2 à 3.7 | Terminé (documentation) | [`phase3/10`](../phase3/10-dossier-lots-3.2-3.7.md) | — | T1 à T4 recommandées, non prises | Services externes non autorisés | — |
| D. F1 et L1 | Spécifications définitives | [`06`](06-specifications-F1-L1.md) révision 2, partie C | — | Aucune (F-D2, F-D4, L-D1 à L-D3 analysées) | Décisions de l'utilisateur | Choix |
| E. Explorer 2.0 et Community | Consolidé | [`07`](07-conception-explorer-2.0-community.md) révision 2 | — | — | Phase 3, M1 à M4, juridique | Validation |
| F. Cohérence | Terminé | Nombres de tests, statuts, index, décisions en attente | Liens : voir rapport | — | — | Commit local |

## 8 novembre 2026 — lot 3.1b (lancé, D-21)
| Étape | État | Modifications | Tests | Décisions | Points bloquants | Prochaine action |
|---|---|---|---|---|---|---|
| 3.1b-0 Préalables | Terminé | DECISIONS D-21 à D-25 ; copies `*.backup.20261108-3.1b-0` | Front 30/30 (référence) | D-21 à D-25 | — | — |
| 3.1b-6 Tests de frontières et de régression | Terminé | `scripts/check-boundaries.js` (règles D, ponts admis), `package.json` (`test:all` avec `--strict`), `index.html` (crochets de vue, export `explorer` trié), test 34 clôturé, `sw.js` | `test:all` vert : front 33/33 ; base 82/82 ; secrets 0 ; frontières 0 | — | 3.1b-7 conditionnel : N1 à N5 et option mobile à valider | Décision sur 3.1b-7 ou lot 3.2 |
| 3.1b-5 Calendrier et Pull List (E1 à E5) | Terminé | `index.html` (calendrier via S1/S2, `referencedPubs`, registre des panneaux), test 34 enrichi, test 11 (clic CDP), `check-boundaries.js` étendu au calendrier, `sw.js` | Front 33/33 ; base 82/82 ; secrets 0 ; frontières 0 | — | B-17 reporté au lot 4.6 (M1-M4 non tranchées) | 3.1b-6 |
| 3.1b-4 Découplage Collection → Explorer | Terminé | `index.html` (vues hébergées, export JSON de Collection, ancien export v2), test 34 enrichi, `sw.js` | Front 33/33 ; base 82/82 ; secrets 0 ; frontières 0 | — | — | 3.1b-5 |
| 3.1b-3 Découplage Explorer → Collection | Terminé | `index.html` (Explorer via S1/S2, `collectionFacets`, réglage), test 34, test 29 (A7, clics CDP), `check-boundaries.js` étendu, `sw.js` | Front 33/33 ; base 82/82 ; secrets 0 ; frontières 0 | — | — | 3.1b-4 |
| 3.1b-2 Contrats S1 et S2 | Terminé | `Panel.contracts.personal.v1`, test 33, réglage `panel_explorer_personalize` (préférence), `sw.js` | Front 32/32 ; base 82/82 ; secrets 0 | — | — | 3.1b-3 |
| 3.1b-1 Sauvegardes par domaine | Terminé | `index.html` (`Panel.backup`, fenêtres d'export et de restauration), test 32, test 29 adapté, `sw.js` | Front 31/31 ; base 82/82 ; secrets 0 | — | — | 3.1b-2 |

## 8-9 novembre 2026 — mission « Autonomous night shift »
| Étape | État | Modifications | Tests | Décisions | Points bloquants | Prochaine action |
|---|---|---|---|---|---|---|
| 3.1b-7 et 3.1b-8 | Terminé | Navigation conservée ; clôture documentaire | `test:all` : 82/82, 0, 0 couplage, 33/33 | D-26 à D-31 (recommandations appliquées sous délégation) | — | F1 |

