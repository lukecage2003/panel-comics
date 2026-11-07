# Feuille de route — Panel by Primestone

Mise à jour : 7 novembre 2026. Historique détaillé : [`HISTORIQUE-LOTS.md`](HISTORIQUE-LOTS.md).

## Phases
| Phase | Thème | Statut |
|---|---|---|
| 0 | Audit initial | Terminée |
| 1 | Stabilisation, protection des données, retrait de la partie numérique | Clôturée |
| 2 | Collection, catalogue, emplacements, calendrier, sources de données, Explorer et guides (lots 2.1 à 2.6) | **Clôturée le 7 novembre 2026** |
| 3 | Comptes, profils, synchronisation local-first, sauvegardes, RGPD | **Conçue, non commencée** |
| 4 | **Explorer 2.0** : catalogue éditorial multi-éditeurs, Key Issues, classements, système central d'images (Cloudflare R2), administration et contributions (lots 4.1 à 4.11) | **Spécifiée** ([cahier des charges](phase4/00-explorer-2.0-cahier-des-charges.md), [analyse](phase4/01-analyse-et-impacts.md)), non commencée |

## Phase 3 — lots proposés
Détail : [`phase3/06-roadmap-phase3.md`](phase3/06-roadmap-phase3.md).

| Lot | Contenu | Statut |
|---|---|---|
| 3.1 | Fondations backend (migrations, RLS, tests sans Docker), préparation du client, sans compte cloud | Spécifié ([cahier des charges](phase3/07-lot-3.1-cahier-des-charges.md), [prompt](phase3/08-lot-3.1-prompt.md)), **en attente de validation** |
| 3.2 | Projet cloud, authentification, CSP, hébergement, sécurité Android | À faire |
| 3.3 | Profils, préférences, appareils, rôles serveur (prérequis d'Explorer 2.0) | À faire |
| 3.4 | Moteur de synchronisation, migration d'une collection existante | À faire |
| 3.5 | Conflits, multi-appareils, corbeille | À faire |
| 3.6 | Sauvegardes, restauration, suppression de compte, RGPD | À faire |
| 3.7 | Validation Web + Android, bêta fermée | À faire |

## Phase 4 — Explorer 2.0
Lots 4.1 (audit et architecture) à 4.11 (qualité et lancement), décrits dans le [cahier des charges](phase4/00-explorer-2.0-cahier-des-charges.md) § 14. Prérequis : Phase 3 terminée. Point bloquant identifié : les **droits des sources** (métadonnées et images) pour un catalogue partagé ([analyse](phase4/01-analyse-et-impacts.md) § 2).

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
- Le lot 2.7, envisagé à l'origine, n'a pas été réalisé ; ses sujets figurent ci-dessus.
