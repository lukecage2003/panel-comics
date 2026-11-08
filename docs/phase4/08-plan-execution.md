# Plan d'exécution — reprise du développement (Phase 3, Phase 4, Community)

Statut : **proposition à valider** (7 novembre 2026). Aucun lot n'est lancé. Ce plan **fait autorité** sur l'ordre et les dépendances des lots ; le contenu détaillé des lots de Phase 3 reste dans [`../phase3/06-roadmap-phase3.md`](../phase3/06-roadmap-phase3.md), celui de la Phase 4 dans le [cahier des charges](00-explorer-2.0-cahier-des-charges.md) § 14.

## 1. Vue d'ensemble des dépendances
```
PHASE 3 — FONDATIONS
 3.1  Backend reproductible (migrations, RLS, tests) ─────────────┐
 3.1b Séparation des domaines côté client (B1, S1/S2 locaux) ─────┤  (indépendants l'un de l'autre ; 3.1b après 3.1 pour éviter
                                                                  │   des modifications concurrentes de index.html)
 3.2  Projet cloud, authentification, CSP, hébergement ◄──────────┘ (dépend de 3.1)
 3.3  Profils, préférences, appareils, rôles ◄── 3.2
 3.4  Synchronisation + migration ◄── 3.3 et 3.1b (synchronisation par domaine)
 3.5  Conflits, multi-appareils ◄── 3.4
 3.6  Sauvegardes serveur, restauration, RGPD ◄── 3.4 (export), 3.5 (purge) ; B1 ◄── 3.1b
 3.7  Validation Web + Android ◄── 3.1 à 3.6

PHASE 4 — EXPLORER 2.0
 4.1  Audit, matrice des droits, contrats ◄── peut être PRÉPARÉ dès maintenant (documentaire) ; validé après 3.3
 4.2  Infrastructure éditoriale et images ◄── 3.3 (rôles), 3.6 (sauvegardes serveur), 4.1
 4.3  Import initial ◄── 4.2 + matrice des droits validée
 4.4  Événements ◄── 4.2 (4.3 pour les images)
 4.5  Key Issues ◄── 4.2
 4.6  Sorties de comics + classements commerciaux ◄── 4.2
 4.7  Tendances communautaires ◄── 4.2 + S3 + validation juridique (seuil, consentement) + 3.4 (données synchronisées)
 4.8  Import progressif ◄── 4.3
 4.9  Accueil et recherche ◄── 4.4 à 4.6 (4.7 facultatif)
 4.10 Administration et contributions ◄── 4.2 ; contributions ◄── Community-0
 4.11 Tests et validation ◄── tous

COMMUNITY (phase ultérieure)
 C-0  Frontières et contrats (documentaire) ◄── peut être préparé maintenant
 C-1… Implémentation ◄── Phase 3 terminée + 4.10 (modération)
```

### Justification des dépendances
| Dépendance | Raison |
|---|---|
| 3.2 ◄ 3.1 | L'authentification s'appuie sur le schéma, la RLS et les tests du lot 3.1 |
| 3.4 ◄ 3.1b | La synchronisation se fait **par domaine** : il faut des fournisseurs et des frontières claires avant de synchroniser |
| 3.4 ◄ 3.3 | La synchronisation exige des appareils enregistrés et des profils |
| 3.6 ◄ 3.4, 3.5 | L'export serveur et la purge supposent le modèle de synchronisation et ses pierres tombales |
| 4.2 ◄ 3.3 | L'administration éditoriale exige des rôles serveur, sans accès aux données personnelles |
| 4.2 ◄ 3.6 | Aucune donnée éditoriale serveur sans sauvegardes serveur testées |
| 4.3 ◄ matrice des droits | Aucune image copiée sur R2 sans droits vérifiés |
| 4.7 ◄ validation juridique | Les agrégats communautaires traitent des données personnelles |
| 3.1b ∥ 3.1 | 3.1b est **côté client** et 3.1 **côté serveur** : indépendants techniquement. On les **sérialise** seulement parce que les deux touchent `index.html` |
| 4.1 ∥ Phase 3 | Travail documentaire (audit, droits, contrats) : préparable en parallèle, sans code |
| C-0 ∥ tout | Documentaire |

## 2. Phase 3 — Fondations techniques
### Lot 3.1 — Backend reproductible (reprise)
- Contenu inchangé ([`../phase3/07-lot-3.1-cahier-des-charges.md`](../phase3/07-lot-3.1-cahier-des-charges.md), [prompt](../phase3/08-lot-3.1-prompt.md)), avec trois précisions :
  - le registre `SYNC_DOMAINS` porte un champ `domain` (`collection`, `reading`, `explorer`, `app`) et le rapport `readiness()` est groupé par domaine ;
  - les schémas `catalog`, `editorial`, `media`, `signals` et `community` sont réservés, non créés ;
  - les copies de sécurité `*.backup.20261107-lot31` déjà créées sont conservées et réutilisées.
- Retour arrière : entièrement additif ; `git revert` local ou restauration des copies.

### Lot 3.1b — Séparation des domaines côté client (nouveau, à valider)
- **Objectifs** : rendre Collection indépendante d'Explorer et préparer Explorer à fonctionner sans Collection, **sans changement fonctionnel visible** (sauf N1 à N5 si l'utilisateur les valide, et A7).
- **Contenu** :
  1. Sauvegardes par domaine B1 ([`06`](06-sauvegardes-par-domaine.md)) : fournisseurs, `panel-bundle` v1, lecture rétrocompatible, tests R1 à R10.
  2. Couche `Panel.contracts.personal.v1` (S1 et S2 locaux), avec le réglage de personnalisation.
  3. Réacheminement des accès C2 à C10 et E1 à E5 par S1 et S2 (comportement identique).
  4. Retrait de la catégorie « Ma collection » de la recherche d'Explorer (A7), test 29 adapté.
  5. Test statique de frontière (Explorer ↔ Collection).
  6. Navigation N1 à N5 et option mobile choisie, **uniquement si validées** (sinon reportées au lot 4.9).
- **Risques** : régression de la restauration (le plus grave) ; lisibilité des anciennes sauvegardes. Parade : tests R1 à R10 sur de vrais fichiers anonymisés, instantanés, annulation.
- **Retour arrière** : modifications isolées par étape, une copie de sécurité par étape, l'ancien format toujours lisible et exportable.

### Lots 3.2 à 3.7
Contenu de [`../phase3/06-roadmap-phase3.md`](../phase3/06-roadmap-phase3.md), avec ces ajouts :
| Lot | Ajouts issus de la finalisation |
|---|---|
| 3.2 | Session S6 ; décision P1 (utilisateur local et S1) appliquée |
| 3.3 | Rôles `app.staff_roles` sans accès à `app.*` ; tests de frontière |
| 3.4 | Synchronisation domaine par domaine (Collection, Lecture), via les fournisseurs B1 ; **Explorer non synchronisé** (contenu éditorial servi par le serveur en Phase 4) |
| 3.5 | Conflits par domaine |
| 3.6 | Export serveur par domaine (`export_my_data` découpé selon B1) ; règles de consentement pour S3 préparées |
| 3.7 | Vérification « Collection sans Explorer » et « Explorer sans Collection » sur le Web et Android |

### Thèmes transverses de la Phase 3
| Thème | Où | Mesure |
|---|---|---|
| Sauvegardes et restauration | 3.1b (local), 3.6 (serveur) | R1 à R10 ; restauration serveur chronométrée |
| Séparation des domaines | 3.1b | Test statique ; empreintes par domaine |
| Migration des données | 3.4 | Migration en sept étapes, vérifiée ([`../phase3/04-synchronisation.md`](../phase3/04-synchronisation.md) § 6) |
| Synchronisation, conflits | 3.4, 3.5 | Aucune perte silencieuse |
| Sécurité, permissions | 3.1, 3.2, 3.3, 3.6 | RLS, CSP, rôles sans accès personnel |
| Non-régression | Tous | 29 tests existants (28 + test 30 du lot F0) + nouveaux, toujours au vert |
| Retour arrière | Tous | Copies de sécurité, commits locaux, aucune opération destructive |

## 3. Phase 4 — Explorer 2.0
| Lot | Contenu (cahier § 14) | Précisions de la finalisation |
|---|---|---|
| 4.1 Audit et préparation | Audit du lot 2.6 et du catalogue, inventaire des images, **matrice des droits par source**, contrats d'API | Couplages restants, P1, M1 à M4, décisions R2 |
| 4.2 Infrastructure éditoriale et images | Schémas `catalog`, `editorial`, `media` ; R2 ; file ; workers ; administration technique | [`07`](07-architecture-images-r2.md) ; tests de frontière S4 et S5 |
| 4.3 Import initial | Import par lots, priorités, rapport de couverture | Sources autorisées seulement ; priorités via S3 |
| 4.4 Événements | Catalogue multi-éditeurs, ordres de lecture | Réutilise les guides du lot 2.6 (lecture via S1) |
| 4.5 Key Issues | Catégories, justifications, sources | Justification éditoriale, pas de prix |
| 4.6 Sorties de comics et classements commerciaux | Calendrier, sources, méthodologies | **Comics uniquement** ([`04`](04-perimetre-sorties-comics.md)) ; mise en conformité du calendrier du lot 2.4 par masquage |
| 4.7 Tendances communautaires | Agrégation, anti-manipulation | S3 ; validation juridique préalable |
| 4.8 Import progressif | Déclencheurs, images cassées | Asynchrone |
| 4.9 Accueil et recherche | Accueil, recherche, filtres | Navigation N1 à N5 si pas faite en 3.1b ; fonctionne sans compte, sans collection, hors ligne |
| 4.10 Administration et contributions | Outils éditoriaux, modération | Contributions publiques après Community-0 |
| 4.11 Tests et validation | Fonctionnels, sécurité, performance, droits | Critères 1 à 31 du cahier |

## 4. Community (phase ultérieure, non commencée)
- **C-0 (documentaire)** : frontières et contrats `CommunityFeed.v1` et `CommunityPublish.v1`, modèle de publication explicite (copie révocable), modération, signalements, confidentialité par catégorie (`privacy.*` de la Phase 3).
- Règles : schéma `community` propre ; ne lit ni Collection ni Explorer directement ; publie ses signaux dans S3 ; consomme S4, S5 et S6.
- Implémentation : pas avant la fin de la Phase 3 et le lot 4.10.

## 5. Critères d'acceptation pour reprendre le lot 3.1
Mise à jour du 8 novembre 2026 : **G1 validé (D-20), le lot 3.1 a repris et a été livré le jour même** (en attente de validation). Rappel : le lot 3.1 porte sur les fondations backend (migrations, PGlite, RLS) ; la séparation des domaines côté client est le lot 3.1b ([préparation](../directeur/05-preparation-lot-3.1b.md)).

| # | Critère | Statut au 8 novembre 2026 |
|---|---|---|
| G1 | Documents d'architecture cohérents et validés par l'utilisateur (frontières, contrats, B1, images, navigation, périmètre comics) **Validé le 8 novembre 2026 (D-20)** |
| G2 | Décision sur le lot 3.1b (création, contenu, place dans le plan) | Placement approuvé (D-17) ; implémentation **suspendue** jusqu'à approbation explicite |
| G3 | Décision P1 (utilisateurs locaux et S1) — nécessaire avant 3.1b, pas avant 3.1 | **À valider** |
| G4 | Arbre Git propre, suite de tests au vert avant de commencer | 29/29 le 8 novembre 2026 (finition F0) ; arbre propre après le commit de cette mission ; à relancer au démarrage |
| G5 | Copies de sécurité `*.backup.20261107-lot31` présentes | Présentes (plus les copies `*.backup.20261107-f0`) |
| G6 | Aucun engagement financier ni compte cloud requis par le lot 3.1 | Conforme |
| G7 | Prompt du lot 3.1 mis à jour (champ `domain`, schémas réservés, documents à lire) | Fait dans [`../phase3/08-lot-3.1-prompt.md`](../phase3/08-lot-3.1-prompt.md) |

## 6. Critères d'acceptation pour commencer Explorer 2.0 (lot 4.2 et suivants)
| # | Critère |
|---|---|
| X1 | Lots 3.1 à 3.3 validés ; 3.6 validé pour les sauvegardes serveur (le lot 4.1 documentaire peut commencer avant) |
| X2 | Lot 3.1b validé : Collection fonctionne sans Explorer (test R9) ; Explorer fonctionne sans Collection (test « fournisseur absent ») ; test statique de frontière au vert |
| X3 | Rôles serveur testés : aucun accès à `app.*` |
| X4 | Matrice des droits par source validée (juridiquement si nécessaire) ; au moins une source d'images exploitable identifiée |
| X5 | Décisions R2 prises : compte, domaine, hébergement des workers, plafond de dépenses |
| X6 | Cas limites M1 à M4 du périmètre comics tranchés |
| X7 | Navigation N1 à N5 et option mobile validées (ou explicitement reportées au lot 4.9) |
| X8 | Pour 4.7 seulement : seuil k et consentement validés juridiquement et techniquement |
| X9 | Suite de non-régression complète au vert, sur le Web et Android |
