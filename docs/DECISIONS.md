# Journal des décisions — Panel by Primestone

Décisions d'architecture et de produit, dans l'ordre chronologique. Une décision remplacée reste listée ; la colonne « Statut » indique celle qui fait autorité. Historique des lots : [`HISTORIQUE-LOTS.md`](HISTORIQUE-LOTS.md).

## Documents de référence (versions qui font autorité au 7 novembre 2026)
| Sujet | Document qui fait autorité | Versions antérieures conservées |
|---|---|---|
| Frontières Collection / Lecture / Explorer / Community | [`phase4/02-frontieres-collection-explorer.md`](phase4/02-frontieres-collection-explorer.md), révision 4 | Révisions 2 et 3 (historique Git : `b0b2f1e`, `2b91082`) |
| Contrats S1 à S6 | [`phase4/05-contrats-s1-s6.md`](phase4/05-contrats-s1-s6.md) | § 5 de `02` (révision 3, `2b91082`) |
| Sauvegardes par domaine (B1) | [`phase4/06-sauvegardes-par-domaine.md`](phase4/06-sauvegardes-par-domaine.md) | Principe esquissé dans `02` § 3.3 (révision 3) |
| Architecture des images | [`phase4/07-architecture-images-r2.md`](phase4/07-architecture-images-r2.md) | Premières recommandations de `01` § 4 |
| Navigation | [`phase4/03-changement-navigation.md`](phase4/03-changement-navigation.md) | — |
| Périmètre des Sorties | [`phase4/04-perimetre-sorties-comics.md`](phase4/04-perimetre-sorties-comics.md) | — |
| Cahier des charges Explorer 2.0 | [`phase4/00-explorer-2.0-cahier-des-charges.md`](phase4/00-explorer-2.0-cahier-des-charges.md), révision 5 | Texte d'origine et révisions 2 à 4 (passages marqués ; historique Git) |
| Ordre des lots et dépendances | [`phase4/08-plan-execution.md`](phase4/08-plan-execution.md) | Vue d'ensemble de `phase3/06-roadmap-phase3.md` (contenu des lots toujours valable) |
| Phase 3 (conception) | [`phase3/`](phase3/README.md) | — |
| Plan directeur 2.0 (audit global, audit financier, produit, backlog P0 à P3) | [`directeur/`](README.md) (index central `docs/README.md`) ; modèle financier : [`directeur/02-audit-financier.md`](directeur/02-audit-financier.md) | — |
| Fonctionnalités validées du lot 2.6 | Code `fe19e3c`, [`HISTORIQUE-LOTS.md`](HISTORIQUE-LOTS.md) | — |

En cas de contradiction : `02` (frontières) et `05` (contrats) priment sur le cahier des charges, qui prime sur l'analyse `01`.

## Décisions
| Date | # | Décision | Origine | Statut |
|---|---|---|---|---|
| 07/11/2026 | D-01 | Phase 2 clôturée ; lots 2.1 à 2.6 validés ; lot 2.7 non réalisé | Utilisateur | En vigueur |
| 07/11/2026 | D-02 | Architecture local-first ; Panel reste utilisable sans compte ni réseau | Conception Phase 3, validée par l'utilisateur au lancement du lot 3.1 | En vigueur |
| 07/11/2026 | D-03 | Backend Supabase / PostgreSQL | Utilisateur (cahier Explorer 2.0) | En vigueur |
| 07/11/2026 | D-04 | Images sur Cloudflare R2, pas sur Supabase Storage | Utilisateur | En vigueur |
| 07/11/2026 | D-05 | Phase 3 avant Explorer 2.0 (Phase 4) | Utilisateur | En vigueur |
| 07/11/2026 | D-06 | Lot 3.1 lancé puis suspendu avant tout code (copies de sécurité seulement) | Utilisateur | En vigueur (suspendu) |
| 07/11/2026 | D-07 | Séparation stricte Collection / Explorer ; interactions par contrats | Utilisateur | En vigueur |
| 07/11/2026 | D-08 (A3) | Progression de lecture = domaine personnel **Lecture**, sous la responsabilité provisoire de Collection pour l'existant ; Explorer l'affiche via S1 seulement | Utilisateur | En vigueur |
| 07/11/2026 | D-09 (A5) | Sorties éditoriales = Explorer ; Pull List = Collection ; changement de navigation documenté séparément | Utilisateur | En vigueur |
| 07/11/2026 | D-10 (A6) | Explorer a sa propre entrée de navigation principale (principe confirmé ; N1 à N5 et mobile à valider) | Utilisateur | Principe en vigueur ; détails à valider |
| 07/11/2026 | D-11 (A7) | Catégorie « Ma collection » retirée de la recherche native d'Explorer (à réaliser) | Utilisateur | En vigueur, non réalisée |
| 07/11/2026 | D-12 | Sorties, calendrier, classements de sorties et actualités : **comics uniquement**, mangas japonais exclus ; Explorer n'est pas une encyclopédie générale de la bande dessinée | Utilisateur | En vigueur |
| 07/11/2026 | D-13 (B1) | Sauvegardes indépendantes par domaine (Collection, Lecture, Explorer, puis Community) ; anciennes sauvegardes toujours lisibles | Utilisateur (principe) | Principe en vigueur ; format non implémenté |
| 07/11/2026 | D-14 (S1) | Personnalisation facultative : activée par défaut pour les connectés, indisponible pour les visiteurs, désactivable, sans accès direct ni accès administrateur | Utilisateur | En vigueur ; cas des utilisateurs locaux (P1) à valider |
| 07/11/2026 | D-15 | Community = domaine indépendant futur | Utilisateur | En vigueur |
| 07/11/2026 | D-16 | Seuil k ≥ 10 pour S3 : **proposition**, pas une garantie d'anonymat | Utilisateur | À valider juridiquement et techniquement |

## Décisions en attente
| # | Sujet | Document |
|---|---|---|
| P1 | Utilisateurs locaux sans compte et S1 | [`05`](phase4/05-contrats-s1-s6.md) § 3 |
| G2 | Création du lot 3.1b | [`08`](phase4/08-plan-execution.md) |
| N1-N5, M-A à M-E | Navigation de bureau et mobile | [`03`](phase4/03-changement-navigation.md) |
| B1-a à B1-c | Ancien format, secrets, nom du format | [`06`](phase4/06-sauvegardes-par-domaine.md) § 10 |
| M1-M4 | BD franco-belge, manhwa et manhua, manga non japonais, adaptations | [`04`](phase4/04-perimetre-sorties-comics.md) § 5 |
| R2 | Compte, domaine, workers, Cloudflare Images, plafond | [`07`](phase4/07-architecture-images-r2.md) § 11 |
| Phase 3 | Région, formule, SMTP, hébergement, stockage sécurisé Android, `allowBackup`, CAPTCHA | [`phase3/02-architecture-cible.md`](phase3/02-architecture-cible.md) |
| G-F | Insertion des lots F0, F1 et L1 dans le plan | [`directeur/04`](directeur/04-backlog-feuille-de-route-decisions.md) § 2 et 4 |
| F-D1 à F-D6 | Modèle financier, devise, ancienneté des estimations, lots, stockage serveur, libellés | [`directeur/04`](directeur/04-backlog-feuille-de-route-decisions.md) § 4 |
| U-D1 à U-D3 | Place de la Lecture et des Finances dans la navigation, identité d'œuvre | [`directeur/04`](directeur/04-backlog-feuille-de-route-decisions.md) § 4 |
| Juridique | Liste de [`phase3/05`](phase3/05-sauvegardes-confidentialite.md) § 4.4, droits des sources, consentement S3 | — |
