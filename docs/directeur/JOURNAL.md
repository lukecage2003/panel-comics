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
