# Phase 4 · 02 — Séparation stricte Collection / Explorer : frontières et contrats

Statut : **finalisation architecturale (révision 4, 7 novembre 2026, fait autorité)**. Elle intègre la correction de l'utilisateur, ses décisions A3, A5, A6, A7, B1 (principe) et S1, le périmètre « comics uniquement » et l'audit final des dépendances (C1 à C10, D1 à D4, E1 à E5). Documents liés qui font autorité : contrats [`05`](05-contrats-s1-s6.md), sauvegardes [`06`](06-sauvegardes-par-domaine.md), images [`07`](07-architecture-images-r2.md), navigation [`03`](03-changement-navigation.md), plan [`08`](08-plan-execution.md), journal [`../DECISIONS.md`](../DECISIONS.md). Ce document **prime** sur toute formulation contraire du [cahier des charges Explorer 2.0](00-explorer-2.0-cahier-des-charges.md) et du dossier de Phase 3. **Aucun code n'a été modifié.**

Légende : **[Fait]** constaté dans le code · **[Décidé]** décision de l'utilisateur · **[Reco.]** recommandation · **[À valider]** décision encore ouverte.

## 1. Règle absolue
- **Collection** et **Explorer** sont deux modules fonctionnellement indépendants.
- Explorer n'est pas une extension de Collection, et Collection n'est pas une dépendance d'Explorer.
- Explorer fonctionne **sans collection, sans compte et sans connexion** (contenus publics mis en cache, § 8).
- Collection fonctionne **sans Explorer** (§ 3.2).
- Les lots Explorer 2.0 ne modifient **aucune** fonctionnalité, interface, donnée ou modèle de Collection sans autorisation explicite.
- Le partage d'infrastructure n'est pas un partage de responsabilité. Toute interaction passe par un contrat explicite, versionné et documenté (§ 5).
- **Community** est un futur domaine **indépendant**, ni intégré à Explorer ni à Collection (§ 6).

## 2. Domaines et responsabilités
| Domaine | Responsabilité | Propriétaire des données |
|---|---|---|
| **Collection** | Inventaire personnel ; comics, exemplaires, éditions et variantes possédés ; état, grading ; emplacements physiques ; acquisitions et historique personnel ; **prix d'achat et valeurs personnelles** ; wishlist ; Pull List ; statistiques ; recherche dans l'inventaire ; images personnelles ; toutes les données privées du collectionneur | Utilisateur (espace personnel) |
| **Lecture personnelle** | Progression et suivi de lecture : `isRead` des exemplaires et progression des guides (`readprog`), avec compatibilité de l'existant | Utilisateur. **Collection en garde provisoirement la responsabilité pour les données existantes** [Décidé A3] |
| **Explorer** | Catalogue éditorial de découverte ; événements, crossovers, guides (contenu éditorial) ; Key Issues ; classements et tendances (présentation) ; **sorties et calendrier éditorial de comics, mangas exclus** [Décidé A5 ; périmètre : [`04`](04-perimetre-sorties-comics.md)] ; actualités et contenus éditoriaux ; séries, personnages, équipes, auteurs et créateurs, éditeurs ; recherche et recommandations de découverte ; ressources éditoriales et images associées ; contributions éditoriales. Périmètre : **comics**, et non une encyclopédie générale de la bande dessinée (D-12) | Panel (contenu éditorial) |
| **Community** (futur) | Interactions sociales, publications, discussions, profils communautaires, listes, avis, abonnements ; ni extension de Collection ni d'Explorer | Utilisateurs, selon leurs réglages de confidentialité |
| **Services communs** | Catalogue canonique (S5), registre d'images et R2 (S4), identité et rôles (S6), agrégation des signaux (S3), sauvegarde (§ 3.3), file de tâches, recherche (index séparés par domaine) | Plateforme |

## 3. Couplages constatés [Fait]
### 3.1 D'Explorer vers Collection (module Explorer, `index.html`, lignes 9197 à 10030 environ)
| # | Emplacement | Couplage | Traitement décidé ou proposé |
|---|---|---|---|
| C1 | Navigation (l. 1761-1768, 6952-6975) | « Explorer & guides » est un bouton du bloc « Collection Physique » et une sous-vue de `#singlesViewSection` | Entrée propre dans la navigation principale [Décidé A6] ; changement documenté dans [`03`](03-changement-navigation.md), non implémenté |
| C2 | `exIndexBuild` (l. 9400-9408) | Lecture directe de `physicalSingles`, `relPubs`, `relPulls` | Via S1 (statuts) et le catalogue éditorial (`relPubs` relève d'Explorer, A5) |
| C3 | `exMatch` (l. 9410-9438) | Statuts possédé / wishlist / probable / rangé ; progression dérivée d'`isRead` | Via S1, sans `locationId`, `box` ni identifiant d'exemplaire |
| C4 | `exCoverOf` (l. 9439-9445) | Repli sur la couverture de l'exemplaire personnel | Supprimé côté Explorer : seules les images éditoriales (S4) ou un placeholder |
| C5 | `exCreators` (l. 9466-9474) | Créateurs dérivés de `coverArtist` ; « Couvertures dans votre collection » | Entités issues du catalogue (S5) uniquement ; la section personnelle passe par S1 ou disparaît |
| C6 | `exSeriesList`, `exPublishers` (l. 9475-9494) | Séries et éditeurs dérivés de la collection, avec comptes | Catalogue (S5) uniquement ; comptes personnels via S1 |
| C7 | `exSearch` (l. 9497-9510) | Catégorie « Ma collection » | **Retirée de la recherche native d'Explorer** [Décidé A7], au lot 3.1b proposé ([`08`](08-plan-execution.md)) |
| C8 | Suivi de séries (l. 9522) | Lecture directe de `relPulls` | Via S1 (`inPullList`) |
| C9 | Actions (l. 9979-9982) | `openSingleInspector`, `addPubToWishlist` | Via S2 (`openItem`, `addToWishlist`) |
| C10 | `readprog` (l. 9354, 9395, 9938) | **Explorer écrit** la progression des guides dans le magasin `readprog` de `panel-catalog` | Écriture via S2 (`setGuideProgress`), lecture via S1 [Décidé A3 : Explorer n'en devient jamais propriétaire] |

### 3.2 De Collection vers Explorer (constatés pendant la finalisation)
| # | Emplacement | Couplage | Traitement proposé |
|---|---|---|---|
| D1 | `goSingles` (l. 6952-6975) | Le routeur des vues de Collection héberge et lance Explorer (`showExplorer`) | Disparaît avec A6 : Explorer a son propre routeur ([`03`](03-changement-navigation.md)) |
| D2 | Export `panel-singles` v2 (l. 11414) et import (l. 11487) | L'export **Collection** contient le bloc `explorer` (contenu éditorial des guides et progression) et appelle `exportExplorerData` / `sanitizeExplorerData` | Sauvegarde par fournisseurs (§ 3.3). **Changement du format de sauvegarde de Collection : [À valider B1]** |
| D3 | Export `panel-singles` v2 | L'export Collection contient aussi le bloc `releases` (publications du calendrier, éditoriales selon A5, et Pull List, personnelle) | Idem (B1) : à terme, la Pull List dans la partie personnelle, les publications dans la partie Explorer |
| D4 | Sauvegarde complète `panel-backup` v3 (l. 12440-12448) | Agrège Collection, emplacements, sorties et Explorer | Acceptable : c'est la sauvegarde **de l'application**, un service commun. À réorganiser en fournisseurs (B1) |

Aucune autre référence de Collection vers les fonctions internes d'Explorer n'a été trouvée hors des emplacements D1 à D4 et de l'API de test `Panel.explorer` (l. 12697-12710), qui relève d'Explorer [Fait].

**Rien de cela n'est modifié aujourd'hui.** Les couplages restent en place et validés jusqu'aux lots qui les traiteront.

### 3.2 bis Calendrier et Pull List (lot 2.4) : couplages constatés lors de l'audit final
Le module « Publications, calendrier, Pull List et wishlist » (`index.html`, l. 7446 à 9195 environ) mêle des données éditoriales (publications, qui relèvent d'Explorer selon A5) et des données personnelles (Pull List, wishlist, qui relèvent de Collection).

| # | Emplacement | Couplage | Traitement proposé |
|---|---|---|---|
| E1 | `addPubToWishlist`, `addPubToCollection`, `wishToCollection`, `collectionToWishlist` (l. 8649-8692) | Le code du calendrier **écrit directement** `physicalSingles` et appelle `persistSingles` | Ces fonctions sont de la logique **Collection** ; elles restent à Collection et sont exposées à Explorer par S2 |
| E2 | `pullStatusOf`, `pickUpPull` (l. 8697-8800) | La Pull List (Collection) lit le statut des publications (`relPubs`) et crée des exemplaires depuis une publication | Direction autorisée (Collection consomme le catalogue en lecture, S5) ; la Pull List garde son instantané `ref` (l. 8707), qui la rend robuste à une publication absente |
| E3 | Annulation d'import (l. 8384-8388) | Conserve les publications référencées par la Pull List et par les exemplaires (`pubId`) en lisant Collection | Remplacer par une question S1 agrégée (« ces publications sont-elles référencées ? », réponse oui ou non par identifiant), sans lecture de l'inventaire |
| E4 | `relCopiesOf` et recherche par série et numéro (l. 8970, 9059) | Le calendrier affiche les exemplaires possédés d'une publication | Via S1 (`owned: n`) |
| E5 | Stockage | Publications (éditorial) et Pull List (personnel) dans la même base `panel-catalog` (stores `publications` et `pulls`) ; de même `editorial` et `readprog` | Acceptable localement (stores distincts) ; séparés dans les sauvegardes (B1) et côté serveur (schémas) |

### 3.3 Sauvegarde par domaine (B1)
**Principe approuvé par l'utilisateur.** Spécification complète : [`06-sauvegardes-par-domaine.md`](06-sauvegardes-par-domaine.md). Le texte ci-dessous est le résumé de la révision 3.
- Un service commun de sauvegarde reçoit des **fournisseurs** déclarés par chaque domaine : `collection`, `lecture`, `explorer`, plus tard `community`. Chacun expose `export()`, `validate(payload)` et `restore(payload, mode)`.
- Collection n'appelle plus aucune fonction d'Explorer : si Explorer est absent, la sauvegarde de Collection fonctionne.
- **Compatibilité** : les fichiers existants (`panel-backup` v3, `panel-singles` v2 avec blocs `explorer` et `releases`) restent **lisibles et restaurables indéfiniment**. Aucune sauvegarde existante n'est modifiée ni supprimée.

## 4. Décisions intégrées et ambiguïtés
| # | Sujet | Décision ou résolution | Statut |
|---|---|---|---|
| A1 | Priorité d'import « comics des collections » | Signal agrégé anonyme (S3) | [Reco.] intégrée |
| A2 | Images réutilisées par Collection | Infrastructure commune (S4) ; Collection choisit, Explorer n'écrit jamais de champ de Collection | [Reco.] intégrée |
| **A3** | Progression des guides | Domaine personnel **Lecture**, sous la responsabilité provisoire de Collection pour les données existantes. Explorer l'affiche **uniquement via S1, de façon facultative**, et ne devient **jamais** propriétaire. L'écriture depuis l'interface d'un guide passe par S2 | **[Décidé]** |
| A4 | « Ajouter à sa collection » | Commande S2 exécutée par Collection | [Reco.] intégrée |
| **A5** | Sorties | Les sorties éditoriales **de comics** (mangas japonais exclus, [`04`](04-perimetre-sorties-comics.md)) relèvent **d'Explorer** ; la Pull List reste à Collection. Le changement de navigation de Collection est documenté séparément ([`03`](03-changement-navigation.md)) et **ne sera fait qu'après validation explicite** | **[Décidé]** |
| **A6** | Navigation | Explorer a sa **propre entrée dans la navigation principale** ; il n'est plus présenté comme une sous-fonction de Collection. Changement documenté ([`03`](03-changement-navigation.md)), **non implémenté** | **[Décidé]** |
| **A7** | Recherche « Ma collection » | **Retirée** de la recherche native d'Explorer. La recherche dans l'inventaire reste à Collection. Toute interaction personnelle passe par les contrats | **[Décidé]** |
| A8 | Entités dérivées des exemplaires | Catalogue (S5) uniquement | [Reco.] intégrée |
| A9 | Indicateurs communautaires | S3 uniquement, seuil et consentement | [Reco.] intégrée |
| A10 | Rôles éditoriaux | Aucun accès aux données personnelles | [Reco.] intégrée |
| A11 | Guides créés par l'utilisateur | Brouillon personnel ; publication = soumission éditoriale (copie validée) | [Reco.] intégrée |

## 5. Contrats S1 à S6
**La version de référence est [`05-contrats-s1-s6.md`](05-contrats-s1-s6.md)** : responsabilité, propriétaire, entrées, sorties, permissions, erreurs, versions, tests de frontière, disponibilité et dégradation pour chaque contrat. La rédaction de la révision 3 de ce paragraphe est conservée dans l'historique Git (`2b91082`).

| Contrat | Rôle | Propriétaire |
|---|---|---|
| S1 `PersonalLens.v1` | Lecture personnelle **facultative** : activée par défaut pour les connectés, indisponible pour les visiteurs, désactivable, exécutée sur l'appareil, sans accès administrateur [Décidé] ; cas des utilisateurs locaux : **P1 à valider** | Collection + Lecture |
| S2 `PersonalCommands.v1` | Commandes explicites de l'utilisateur, exécutées par le domaine propriétaire | Collection + Lecture |
| S3 `SignalAggregates.v1` | Agrégats anonymisés ; seuil k ≥ 10 **proposé**, à valider juridiquement et techniquement | Service d'agrégation |
| S4 `MediaRegistry.v1` | Registre d'images partagé, associations par domaine | Service média |
| S5 `CanonicalCatalog.v1` | Catalogue canonique en lecture seule | Service catalogue |
| S6 `Identity.v1` | Identité et rôles | Plateforme |

## 6. Community, futur domaine indépendant
- Schéma propre `community` (réservé, non créé) : profils publics, listes publiques, avis, abonnements, signalements.
- Community **publie** ses signaux dans S3 et **consomme** S5, S4 et S6. Elle ne lit pas les tables de Collection : une collection ou une liste ne devient publique que par une **publication explicite** de l'utilisateur (copie publiée, révocable), jamais par une vue directe.
- Explorer peut afficher des contenus Community publiés via un futur contrat `CommunityFeed.v1`, sans en être propriétaire.
- Rien n'est créé en Phase 3 ni dans les lots Explorer ; seuls les noms de schéma et les contrats sont réservés.

## 7. Dépendances interdites
- Explorer lit un stockage interne de Collection ou de Lecture (`physicalSingles`, `seriesMeta`, `relPulls`, `locDoc`, `readprog`, `app.*`) en dehors de S1.
- Explorer écrit dans ces stockages en dehors de S2 ; Explorer devient propriétaire de la progression de lecture.
- Collection appelle une fonction interne d'Explorer (`exMatch`, `exEditorial`, `exportExplorerData`…), une fois B1 réalisé.
- Une entité Explorer est dérivée de données personnelles ; une image personnelle sert d'image éditoriale.
- Une requête serveur joint tables personnelles et éditoriales pour l'affichage d'Explorer.
- Un rôle éditorial ou d'administration lit les collections individuelles.
- Un import, un classement ou une tâche planifiée modifie une donnée de Collection.
- Explorer exige un compte, une connexion ou une collection pour un contenu public.
- Community lit directement Collection ; Community est construite à l'intérieur d'Explorer.
- Fusion des interfaces, déplacement de fonctionnalités de Collection, remplacement de ses modèles, migration destructive.

## 8. Traduction technique
### Client
- Modules séparés : `collection` (existant), `explorer` (fichiers séparés en Phase 4), et une couche `contracts` (`Panel.contracts.personal.v1` pour S1 et S2, implémentée par Collection).
- **Fonctionnement hors ligne d'Explorer** : le contenu public est mis en cache dans une base locale propre à Explorer (par exemple `panel-explorer-cache`), **distincte** des bases personnelles. Le Service Worker met en cache les variantes d'images consultées. Les guides du lot 2.6, aujourd'hui locaux (magasin `editorial`), restent disponibles hors ligne.
- **Test statique de frontière** (lot 4.1) : le code d'Explorer ne référence aucun identifiant interne de Collection, et inversement après B1.

### Serveur
| Schéma | Domaine | Accès |
|---|---|---|
| `app` | Collection, Lecture, profil (Phase 3) | RLS par `user_id` ; aucun rôle éditorial |
| `catalog` | Commun (S5) | Lecture publique ; écriture éditoriale |
| `editorial` | Explorer (guides, événements, Key Issues, sorties, classements présentés) | Lecture publique du publié ; écriture éditoriale |
| `media` | Commun (S4) | Lecture publique du publié ; écriture par les workers et les rôles éditoriaux |
| `signals` | Service d'agrégation (S3) | Écriture par le rôle technique ; lecture publique des agrégats |
| `community` | Community (futur) | Réservé, non créé |

Tests de frontière (lots 3.3 et 4.2) :
- les rôles `editor` et `admin` ne lisent aucune ligne de `app.*` ;
- la clé anonyme lit le contenu public d'Explorer et aucune ligne de `app.*` ;
- les agrégats sous le seuil ne sont jamais publiés ;
- une empreinte des tables `app.*` reste identique avant et après un import ou un calcul de classement.

## 9. Vérification de cohérence (7 novembre 2026)
| Exigence | Résultat | Où |
|---|---|---|
| Explorer fonctionne sans Collection, sans compte, sans connexion | **Conforme dans la conception** : S1 et S2 dégradent sans erreur ; S6 permet le visiteur ; cache local propre à Explorer (§ 8). Aujourd'hui, l'Explorer du lot 2.6 fonctionne hors ligne et sans compte, mais **dépend** des structures de Collection (C2 à C10) | § 5, § 8 ; lot 3.1b proposé |
| Collection fonctionne sans Explorer | **Non conforme aujourd'hui** sur la sauvegarde (D2 à D4) et le routeur de vues (D1) ; conforme après A6 et B1 (lot 3.1b) | § 3.2, [`06`](06-sauvegardes-par-domaine.md) |
| Aucun accès direct aux données privées depuis Explorer | Garanti **dans la conception** par S1, S3 et les tests de frontière. **Pas résolu dans le code** : C2 à C10 et E1 à E5 sont toujours présents (vérifié le 7 novembre 2026) | § 3.1, § 3.2 bis, § 7 |
| Aucun changement de Collection sans autorisation | Respecté : A5 et A6 documentés ([`03`](03-changement-navigation.md)) et non réalisés ; B1 soumis à validation | § 4 |
| Contrats S1 à S6 explicites | Responsabilité, propriétaire, entrées, sorties, permissions, erreurs, versions, tests de frontière, dégradation : définis ; S1 sans dépendance obligatoire | [`05`](05-contrats-s1-s6.md) |
| Séparation des données éditoriales et personnelles | Schémas distincts ; cache Explorer distinct ; aujourd'hui, `readprog` (personnel) et `editorial` (éditorial) cohabitent dans la base `panel-catalog` (stores distincts) : acceptable localement, séparé côté serveur | § 8 ; B2 |
| Images et catalogue respectent les frontières | S4 (pas d'images personnelles publiques, aucune écriture dans Collection), S5 (lecture seule, rapprochement validé par l'utilisateur) | § 5 |
| Community indépendante | Schéma et contrats réservés ; aucune lecture de Collection ni d'Explorer | § 6 |
| Périmètre comics | Règle documentée ; calendrier actuel non conforme (format `manga`, éditeurs Kana et Kurokawa) | [`04`](04-perimetre-sorties-comics.md) |
| Personnalisation S1 facultative | Conforme dans la conception ; cas des utilisateurs locaux (P1) à décider | [`05`](05-contrats-s1-s6.md) § 3 |

## 10. Risques architecturaux
| Risque | Effet | Parade |
|---|---|---|
| Couplages historiques C1 à C10, D1 à D4 et E1 à E5 | Explorer et Collection restent liés | Réacheminement (C2 à C10, E1 à E5) et B1 au lot 3.1b proposé, à défaut aux lots 4.1 et 4.9 ; test statique |
| Retrait de la recherche « Ma collection » (A7) | Fonction du lot 2.6 en moins dans Explorer | Décidé ; la recherche de Collection couvre l'inventaire ; adapter le test 29 au lot concerné |
| Réidentification par des agrégats trop fins | RGPD | Seuil k, périodes larges, revue juridique |
| Rôles trop puissants | Fuite de données personnelles | A10 et tests de frontière |
| Catalogue alimenté par des sources non autorisées | Juridique | Matrice des droits ([`01`](01-analyse-et-impacts.md) § 2) |
| Évolution de format de sauvegarde (B1) | Anciennes sauvegardes illisibles | Lecture rétrocompatible obligatoire et tests sur des fichiers réels |
