# Phase 4 · 02 — Séparation stricte Collection / Explorer : frontières et contrats

Statut : **finalisation architecturale (révision 3, 7 novembre 2026)**. Elle intègre la correction de l'utilisateur et ses décisions A3, A5, A6 et A7. Ce document **prime** sur toute formulation contraire du [cahier des charges Explorer 2.0](00-explorer-2.0-cahier-des-charges.md) et du dossier de Phase 3. **Aucun code n'a été modifié.**

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
| **Collection** | Comics, exemplaires, éditions et variantes possédés ; état, grading ; emplacements ; acquisitions, historique d'achat ; wishlist ; Pull List ; statistiques ; recherche dans l'inventaire ; images personnelles | Utilisateur (espace personnel) |
| **Lecture personnelle** | Progression de lecture : `isRead` des exemplaires et progression des guides (`readprog`) | Utilisateur. **Collection en garde provisoirement la responsabilité pour les données existantes** [Décidé A3] |
| **Explorer** | Catalogue éditorial de découverte ; événements, crossovers, guides (contenu éditorial) ; Key Issues ; classements et tendances (présentation) ; **sorties et calendrier éditorial** [Décidé A5] ; actualités ; séries, personnages, équipes, créateurs, éditeurs ; recommandations ; images éditoriales ; contributions éditoriales | Panel (contenu éditorial) |
| **Community** (futur) | Profils publics, listes, avis, recommandations entre membres, abonnements, contributions sociales | Utilisateurs, selon leurs réglages de confidentialité |
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
| C7 | `exSearch` (l. 9497-9510) | Catégorie « Ma collection » | **Retirée de la recherche native d'Explorer** [Décidé A7], lors d'un lot Explorer futur |
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

### 3.3 Sauvegarde : principe proposé (B1)
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
| **A5** | Sorties | Les sorties éditoriales relèvent **d'Explorer** ; la Pull List reste à Collection. Le changement de navigation de Collection est documenté séparément ([`03`](03-changement-navigation.md)) et **ne sera fait qu'après validation explicite** | **[Décidé]** |
| **A6** | Navigation | Explorer a sa **propre entrée dans la navigation principale** ; il n'est plus présenté comme une sous-fonction de Collection. Changement documenté ([`03`](03-changement-navigation.md)), **non implémenté** | **[Décidé]** |
| **A7** | Recherche « Ma collection » | **Retirée** de la recherche native d'Explorer. La recherche dans l'inventaire reste à Collection. Toute interaction personnelle passe par les contrats | **[Décidé]** |
| A8 | Entités dérivées des exemplaires | Catalogue (S5) uniquement | [Reco.] intégrée |
| A9 | Indicateurs communautaires | S3 uniquement, seuil et consentement | [Reco.] intégrée |
| A10 | Rôles éditoriaux | Aucun accès aux données personnelles | [Reco.] intégrée |
| A11 | Guides créés par l'utilisateur | Brouillon personnel ; publication = soumission éditoriale (copie validée) | [Reco.] intégrée |

## 5. Contrats S1 à S6
Règles communes à tous les contrats :
- **Version** dans le nom (`v1`) ; ajout de champs seulement de façon rétrocompatible ; une version incompatible = `v2`, avec l'ancienne maintenue au moins une version de l'application.
- **Références** : identifiant canonique (`catalog_issue_id`, `catalog_series_id`) quand il existe, sinon référence textuelle normalisée `{ series, issue, year?, variant? }` marquée `unverified: true`.
- **Données** : objets simples, sérialisables, copiés. Jamais d'objet interne, de référence mémoire ni d'identifiant d'exemplaire.
- **Erreurs** : forme unique `{ ok: false, code, message }`, avec `code` ∈ `unavailable`, `unauthenticated`, `forbidden`, `invalid_input`, `not_found`, `conflict`, `rate_limited`, `internal`. Un consommateur doit **toujours** fonctionner en cas d'erreur (dégradation silencieuse vers l'état « sans donnée personnelle »).
- **Tests** : chaque contrat a des tests de conformité côté fournisseur et un test « fournisseur absent » côté consommateur.

### S1 — `PersonalLens.v1` (lecture personnelle facultative)
| Élément | Définition |
|---|---|
| Responsabilité | Donner à Explorer des **statuts personnels minimaux** pour enrichir l'affichage, sans exposer l'inventaire |
| Fournisseur / consommateur | Collection et Lecture personnelle / Explorer |
| Exécution | **Sur l'appareil**, sur les données locales de l'utilisateur courant. Aucun appel serveur entre modules ; aucune lecture des données d'un autre utilisateur |
| Entrées | `statusFor(refs[])` (≤ 500 références) ; `guideProgress(guideId, entryIds[])` (≤ 2 000) |
| Sorties | `statusFor` → par référence `{ owned: n, wishlisted: bool, inPullList: bool, read: bool }` ; `guideProgress` → par entrée `{ status: 'to_read' \| 'reading' \| 'read' \| 'skipped' \| '', derivedFromCollection: bool }` |
| Interdit dans la sortie | Prix, état, grading, emplacement, notes, date ou lieu d'achat, identifiant d'exemplaire, nombre total d'exemplaires de la collection |
| Permissions | Utilisateur courant seulement. Si l'option « Afficher mes statuts personnels dans Explorer » (à créer, activée par défaut) est désactivée, réponse vide |
| Erreurs | Fournisseur absent, sans collection ou visiteur : `{ ok: true, items: [] }` (vide, **pas** une erreur) ; entrée invalide : `invalid_input` ; dépassement : `rate_limited` |

### S2 — `PersonalCommands.v1` (commandes, à l'initiative de l'utilisateur)
| Élément | Définition |
|---|---|
| Responsabilité | Permettre à l'utilisateur d'agir sur ses données personnelles **depuis** Explorer, l'exécution restant à Collection ou Lecture |
| Fournisseur / consommateur | Collection et Lecture personnelle / Explorer |
| Entrées | `addToWishlist(ref)` ; `addToCollection(ref)` (ouvre le formulaire de Collection, prérempli : c'est l'utilisateur qui enregistre) ; `followSeries(seriesRef)` ; `setGuideProgress(guideId, entryId, status)` ; `openItem(ref)` (Collection ouvre sa propre vue) |
| Sorties | `{ ok: true, duplicate?: bool, undoToken? }` ou une erreur |
| Permissions | Uniquement à la suite d'un geste explicite de l'utilisateur (clic). **Jamais** depuis un import, un classement, une tâche planifiée ou un worker. Pas d'opération en masse |
| Règles | Validation, dédoublonnage (`sameVariantWish`), persistance, sauvegarde, annulation et synchronisation sont faits **par le fournisseur**, selon ses règles actuelles |
| Erreurs | `unavailable` (Collection absente : Explorer masque les boutons), `invalid_input`, `conflict` (doublon : `ok: true, duplicate: true`), `internal` |

### S3 — `SignalAggregates.v1` (agrégats anonymes, serveur)
| Élément | Définition |
|---|---|
| Responsabilité | Produire des **agrégats anonymes** de signaux autorisés (ajouts en wishlist, intérêt, lectures déclarées, consultations, recommandations) |
| Fournisseur / consommateurs | Service d'agrégation (schéma `signals`, plateforme) / Explorer (classements, priorités d'import), plus tard Community |
| Entrées (fournisseur) | Tâche planifiée ; lecture des tables personnelles **uniquement** dans des fonctions `security definer` dédiées, limitées aux colonnes nécessaires |
| Sorties | `signals.aggregates(catalog_ref, signal, period, count, computed_at)` ; aucun identifiant d'utilisateur |
| Permissions | Écriture : rôle technique du service seulement. Lecture : publique (agrégats publiés). Aucun rôle (y compris `admin`) ne lit les signaux individuels via ce contrat |
| Règles | Seuil k ≥ 10 utilisateurs distincts par agrégat (proposé), périodes ≥ 1 semaine, exclusion des comptes suspendus et des doublons, respect du consentement et des réglages de confidentialité, aucune écriture dans les tables personnelles |
| Erreurs | Agrégat sous le seuil : absent (pas de valeur partielle) ; tâche échouée : dernière valeur publiée conservée, avec sa date |

### S4 — `MediaRegistry.v1` (images, infrastructure commune)
| Élément | Définition |
|---|---|
| Responsabilité | Registre central et livraison des **images publiques autorisées** (R2 + CDN) |
| Fournisseur / consommateurs | Service média / Explorer, et Collection **si elle le choisit** |
| Entrées | `getImage(entityType, entityId, variant)` ; `listImages(entityType, entityId)` ; écriture : `register`, `replace`, `withdraw` (workers et rôles éditoriaux) |
| Sorties | `{ url, width, height, variant, attribution, license, status }` |
| Permissions | Lecture publique des images publiées ; écriture réservée au service média et aux rôles `editor` et `admin` |
| Règles | Les **images personnelles** (couvertures manuelles, photos d'exemplaires) restent à Collection et ne sont jamais versées au registre sans contribution volontaire et cession de droits. Aucun import ne modifie un enregistrement de Collection. Pas de substitution d'édition ou de variante |
| Erreurs | `not_found` (placeholder), `withdrawn` (retirée pour droits : placeholder et attribution masquée), `unavailable` (CDN : placeholder) |

### S5 — `CanonicalCatalog.v1` (référentiel commun)
| Élément | Définition |
|---|---|
| Responsabilité | Référentiel canonique des comics, éditions, variantes, séries et éditeurs, avec provenance et droits |
| Fournisseur / consommateurs | Service catalogue (schéma `catalog`) / Explorer, Collection, Community |
| Entrées | `resolve(refText)` → candidats avec score de confiance ; `get(id)` ; `search(q)` |
| Sorties | Fiches canoniques publiques et références externes autorisées |
| Permissions | Lecture publique ; écriture par les pipelines éditoriaux et les rôles `editor` et `admin` |
| Règles | Collection **peut**, plus tard et de façon additive, enregistrer un `catalog_issue_id` sur un exemplaire, **sur proposition validée par l'utilisateur**. Le catalogue n'écrit jamais dans Collection. Seules les sources dont les droits le permettent alimentent ce référentiel |
| Erreurs | `not_found`, résolution ambiguë (liste de candidats, **aucun choix automatique** sous le seuil de confiance), `unavailable` |

### S6 — `Identity.v1`
| Élément | Définition |
|---|---|
| Responsabilité | Authentification, profil, appareils, rôles (Phase 3) |
| Fournisseur / consommateurs | Supabase Auth et schéma `app` (profil) / tous les domaines |
| Entrées et sorties | Session (`user_id`, rôles), profil public minimal (plus tard, via Community) |
| Permissions | Rôles `admin`, `editor`, `moderator` attribués côté serveur ; **aucun** n'ouvre l'accès aux données personnelles d'autrui |
| Erreurs | `unauthenticated` : Explorer reste utilisable en visiteur ; Collection reste utilisable en local |

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
| Explorer fonctionne sans Collection, sans compte, sans connexion | **Conforme dans la conception** : S1 et S2 dégradent sans erreur ; S6 permet le visiteur ; cache local propre à Explorer (§ 8). Aujourd'hui, l'Explorer du lot 2.6 fonctionne hors ligne et sans compte, mais **dépend** des structures de Collection (C2 à C10) | § 5, § 8 ; lots 4.1 et 4.9 |
| Collection fonctionne sans Explorer | **Non conforme aujourd'hui** sur la sauvegarde (D2 à D4) et le routeur de vues (D1) ; conforme après A6 et B1 | § 3.2, B1 |
| Aucun accès direct aux données privées depuis Explorer | Garanti par S1, S3 et les tests de frontière ; couplages actuels C2 à C10 à réacheminer | § 3.1, § 7 |
| Aucun changement de Collection sans autorisation | Respecté : A5 et A6 documentés ([`03`](03-changement-navigation.md)) et non réalisés ; B1 soumis à validation | § 4 |
| Contrats S1 à S6 explicites | Responsabilités, entrées, sorties, permissions et erreurs définies | § 5 |
| Séparation des données éditoriales et personnelles | Schémas distincts ; cache Explorer distinct ; aujourd'hui, `readprog` (personnel) et `editorial` (éditorial) cohabitent dans la base `panel-catalog` (stores distincts) : acceptable localement, séparé côté serveur | § 8 ; B2 |
| Images et catalogue respectent les frontières | S4 (pas d'images personnelles publiques, aucune écriture dans Collection), S5 (lecture seule, rapprochement validé par l'utilisateur) | § 5 |
| Community indépendante | Schéma et contrats réservés ; aucune lecture de Collection | § 6 |

## 10. Risques architecturaux
| Risque | Effet | Parade |
|---|---|---|
| Couplages historiques C1 à C10 et D1 à D4 | Explorer et Collection restent liés | Réacheminement aux lots 4.1 et 4.9 ; B1 ; test statique |
| Retrait de la recherche « Ma collection » (A7) | Fonction du lot 2.6 en moins dans Explorer | Décidé ; la recherche de Collection couvre l'inventaire ; adapter le test 29 au lot concerné |
| Réidentification par des agrégats trop fins | RGPD | Seuil k, périodes larges, revue juridique |
| Rôles trop puissants | Fuite de données personnelles | A10 et tests de frontière |
| Catalogue alimenté par des sources non autorisées | Juridique | Matrice des droits ([`01`](01-analyse-et-impacts.md) § 2) |
| Évolution de format de sauvegarde (B1) | Anciennes sauvegardes illisibles | Lecture rétrocompatible obligatoire et tests sur des fichiers réels |
