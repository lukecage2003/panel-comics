# Feuille de route — Panel by Primestone

Mise à jour : 7 novembre 2026. Historique détaillé : [`HISTORIQUE-LOTS.md`](HISTORIQUE-LOTS.md).

## Phases
| Phase | Thème | Statut |
|---|---|---|
| 0 | Audit initial | Terminée |
| 1 | Stabilisation, protection des données, retrait de la partie numérique | Clôturée |
| 2 | Collection, catalogue, emplacements, calendrier, sources de données, Explorer et guides (lots 2.1 à 2.6) | **Clôturée le 7 novembre 2026** |
| 3 | Comptes, profils, synchronisation local-first, sauvegardes, RGPD | **En cours** : lot 3.1 livré le 8 novembre 2026, en attente de validation |
| 4 | **Explorer 2.0** : catalogue éditorial multi-éditeurs, Key Issues, classements, système central d'images (Cloudflare R2), administration et contributions (lots 4.1 à 4.11) | **Spécifiée** ([cahier des charges](phase4/00-explorer-2.0-cahier-des-charges.md), [analyse](phase4/01-analyse-et-impacts.md)), non commencée |
| 5 | **Community** : domaine social indépendant (publications, discussions, profils communautaires) | Frontières réservées ; non planifiée |

## Plan directeur 2.0 (7 novembre 2026)
Audit global et financier, backlog P0 à P3 : [`directeur/04-backlog-feuille-de-route-decisions.md`](directeur/04-backlog-feuille-de-route-decisions.md). **G-F approuvé (D-17)** : lot **F0** (correctifs des calculs financiers, sans migration) avant le lot 3.1, puis **F1** (frais, devises, lots, sorties) et **L1** (lecture par œuvre) après le lot 3.1b. F0 **validé (D-19)** ; F1 et L1 intégrés mais non autorisés ; 3.1b suspendu jusqu'à approbation explicite.

## Phase 3 — lots proposés
Détail : [`phase3/06-roadmap-phase3.md`](phase3/06-roadmap-phase3.md).

| Lot | Contenu | Statut |
|---|---|---|
| 3.1 | Fondations backend (migrations, RLS, tests sans Docker), préparation du client, sans compte cloud | **Livré le 8 novembre 2026 et audité** ([audit de clôture](phase3/09-audit-cloture-lot-3.1.md), migration 7 de durcissement), en attente de validation (G1 validé, D-20) : [`backend/`](../backend/README.md), [runbooks](phase3/runbooks/), `Panel.sync.readiness()` ([cahier des charges](phase3/07-lot-3.1-cahier-des-charges.md)) |
| 3.1b | Séparation des domaines côté client : sauvegardes par domaine (B1), contrats S1 et S2 locaux, réacheminement des couplages, navigation si validée | **Plan définitif, non autorisé** ([plan](directeur/05-preparation-lot-3.1b.md)) |
| 3.2 | Projet cloud, authentification, CSP, hébergement, sécurité Android | À faire |
| 3.3 | Profils, préférences, appareils, rôles serveur (prérequis d'Explorer 2.0) | À faire |
| 3.4 | Moteur de synchronisation, migration d'une collection existante | À faire |
| 3.5 | Conflits, multi-appareils, corbeille | À faire |
| 3.6 | Sauvegardes, restauration, suppression de compte, RGPD | À faire |
| 3.7 | Validation Web + Android, bêta fermée | À faire |

## Ordre et dépendances
L'ordre des lots, leurs dépendances et les critères pour reprendre le lot 3.1 et commencer Explorer 2.0 font autorité dans le [plan d'exécution](phase4/08-plan-execution.md). Journal des décisions : [`DECISIONS.md`](DECISIONS.md).

## Phase 4 — Explorer 2.0
Lots 4.1 (audit et architecture) à 4.11 (qualité et lancement), décrits dans le [cahier des charges](phase4/00-explorer-2.0-cahier-des-charges.md) § 14. Prérequis : Phase 3 terminée. Règle structurante : **séparation stricte Collection / Explorer** ([frontières et contrats](phase4/02-frontieres-collection-explorer.md), révision 3) ; les lots Explorer ne modifient pas Collection. Décisions du 7 novembre 2026 : A3 (progression = domaine Lecture, via S1), A5 (sorties = Explorer), A6 (entrée de navigation propre, [changement documenté](phase4/03-changement-navigation.md), non implémenté), A7 (pas de recherche « Ma collection » dans Explorer). Community sera un domaine indépendant. Les **Sorties** concernent exclusivement les comics, mangas japonais exclus ([périmètre](phase4/04-perimetre-sorties-comics.md)). Point bloquant identifié : les **droits des sources** (métadonnées et images) pour un catalogue partagé ([analyse](phase4/01-analyse-et-impacts.md) § 2).

## Backlog (hors lots planifiés)
- Source d'actualités ou CMS (actualités non activées).
- Sources d'images sous licence (désormais traitées par Explorer 2.0, lots 4.1 et 4.3).
- Vérification des correspondances VO/VF (deux éditions Panini sans sommaire confirmé).
- Guides supplémentaires ; extension du guide King in Black (démonstration non exhaustive).
- Références non consultées : ReadingOrders.com, Comic Compass, French Comics Reading Order.
- Renouvellement de la clé Comic Vine.
- Signature Android de publication ; réglage de `allowBackup` (prérequis du lot 3.2).
- Purge des anciennes clés Marvel/Vision (**nécessite l'accord de l'utilisateur**).
- Retrait des secrets des exports JSON par défaut (prévu au lot 3.2 ou 3.6).
- Mise en conformité du calendrier actuel (lot 2.4) avec la règle « comics uniquement » (format `manga`, éditeurs Kana et Kurokawa) : lots 4.6 et 4.9, par masquage, sans suppression. Cas limites M1 à M4 (BD franco-belge, manhwa et manhua, manga non japonais, adaptations) **à trancher**.
- Changement de navigation N1 à N5 (Explorer et Sorties hors du bloc Collection) : **en attente de validation explicite**.
- Sauvegarde par domaine (B1) : **principe approuvé** ; spécification dans [`phase4/06`](phase4/06-sauvegardes-par-domaine.md) ; réalisation prévue au lot 3.1b ; options B1-a à B1-c à trancher.
- Le lot 2.7, envisagé à l'origine, n'a pas été réalisé ; ses sujets figurent ci-dessus.
