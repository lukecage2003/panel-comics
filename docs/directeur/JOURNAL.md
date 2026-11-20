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
| F1 Finances | Terminé (F1-5 partiel) | `index.html` (`Panel.finance`, formulaire, filtre « Sorties », CSV, B1), test 35, test 25 adapté, `sw.js` | `test:all` : 82/82, 0, 0 couplage, 34/34 | D-27 à D-29 appliquées | Onglet Finances (U-D2) | L1 |
| L1 Lecture | Terminé (L1-4 partiel) | `index.html` (`Panel.reading`, S1 `read`, S2 `markRead`, fenêtre « Lecture par œuvre… », B1 `works`), test 36, `sw.js` | `test:all` : 82/82, 0, 0 couplage, 35/35 | D-30 appliquée | Entrée Lecture (U-D1) | Backend 3.4 local |
| Backend 3.4 local | Terminé localement (non validé sur Supabase) | migration 8, `backend/sync-engine/engine.js`, `backend/tests/sync.test.js`, tests 3.1 adaptés | `test:all` : 99/99, 0, 0 couplage, 35/35 | D-31 appliquée | Projet Supabase (3.2) | Fondations Explorer 2.0 |
| Fondations Explorer 2.0 et Communauté | Préparé (non branché) | `domains/`, `package.json` (`test:domains`) | `test:domains` 16/16, secrets 0, frontières 0 | — | Source du catalogue, conditions d'utilisation | Rapport final |
| Vues, Explorer 2.0, Communauté, 3.6 local | Terminé localement | `index.html`, `domains/`, `scripts/sync-domains.js`, `backend/` (adaptateurs, migration 9), tests 37 à 39 | base 107/107, domaines, front 38/38 | D-32 à D-35 | Projet Supabase (3.2), source du catalogue | Validation globale |
| Corbeille, calendrier comics uniquement | Terminé localement | `index.html`, `run-all-tests.js` (tests 40, 41), `sw.js` | front 40/40 | D-36, D-37 | Cas limites M1 à M4 | Rapport final |
| Lot 3.3 local | Terminé localement (non validé sur Supabase) | migration 10, `backend/tests/roles.test.js`, `adapters.js` (`createHlc`, `createSupabaseAccount`), `verify-supabase.sql` | base 111/111, adaptateurs 6/6 | D-38 | Projet Supabase (3.2) | Brouillons Communauté dans les sauvegardes |
| Sauvegardes Communauté, visuels, M1-M4, navigation 4.9 | Terminé localement | `index.html`, `run-all-tests.js` (tests 42 à 44), `sw.js` | voir commit | D-39 à D-42 | Sources d'images sous licence, données éditoriales DC | Interface des conflits |
  - **conflits 3.5** (D-43) : résolution serveur réversible (migration 11, V2 et V6 sur PGlite), centre des conflits dans l'application, test 45 ; front 44/44.
  - **validation 3.7** (D-44) : matrice V1 à V14, V5 et V9 ajoutés, V8 approché par restauration PGlite ; base 118/118.
  - **3.6 suite** (D-45) : limitation de débit, purge planifiable, suppression de compte (Edge Function testée localement, non déployée), runbook d'incident.
  - **Community C-0** (D-46) : contrats Publish, Revoke et Feed codés et testés ; aperçu de l'envoi dans l'application, test 46.
  - **Explorer 4.9** (D-47) : filtre des résultats par éditeur, test 47.
  - **Système visuel et documentaire** (D-48 à D-50) : fournisseurs et statuts, modèle événementiel, catalogue de huit événements Marvel et DC, fiches événement et numéro, visionneuse, outil de complétion, tests 48 à 50.
  - **Recoupement** (D-51) : CBRO et Reading Orders pour huit événements, divergences expliquées, qualité documentaire par fiche, test 51.
  - **Contrôle éditorial** (D-52) : statuts de fiabilité expliqués, concordance distincte de corroboration, vérification par référence bibliographique (collection.id), écarts qualifiés, cas Superman #712, Crisis Aftermath, ASM #539 et Excalibur traités.
  - **R1 Catalogue commun** (D-55) : identité partagée par Collection, Sorties et Explorer (index de références réversible), variantes, réimpressions et recueils distincts, fusion annulable, nouveaux mangas refusés, test 52.
  - **R1 finition** (D-56) : encadré « Dans Panel » sur l'exemplaire et le numéro, écran Catalogue commun (rattachements à trancher, fusion, historique, annulation).
  - **R2 Event Center v2** (D-57) : niveaux de lecture justifiés pour les 9 événements, ordre recommandé Panel versionné, progression par niveau, test 53.
  - **Suite Edge fiabilisée** (20/11/2026) : profil neuf à chaque exécution, minuteurs non ralentis, rechargement après blocage ; tests 12, 39, 61, 68 et 70 corrigés ; 69/69 d'un seul tenant.
