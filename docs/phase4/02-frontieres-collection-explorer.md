# Phase 4 · 02 — Séparation stricte Collection / Explorer : frontières et contrats

Statut : **correction architecturale demandée par l'utilisateur le 7 novembre 2026**, à valider. Ce document **prime** sur toute formulation contraire du [cahier des charges Explorer 2.0](00-explorer-2.0-cahier-des-charges.md) et du dossier de Phase 3. **Aucun code n'a été modifié.**

Légende : **[Fait]** constaté dans le code · **[Reco.]** recommandation · **[À valider]** décision de l'utilisateur.

## 1. Règle absolue
- **Collection** et **Explorer** sont deux modules fonctionnellement indépendants.
- Explorer n'est pas une extension de Collection, et Collection n'est pas une dépendance d'Explorer.
- Explorer fonctionne pour un utilisateur sans aucun comic, et pour un **visiteur non connecté** (contenus publics).
- Les lots Explorer 2.0 **ne modifient pas** Collection : ni ses fonctionnalités, ni son interface, ni ses données personnelles, ni ses modèles.
- Le partage d'infrastructure n'est pas un partage de responsabilité. Toute interaction passe par un **contrat de service explicite, versionné et documenté** (§ 5).

## 2. Responsabilités
| Collection (personnel) | Explorer (découverte, public) | Services communs (infrastructure) |
|---|---|---|
| Comics, exemplaires, éditions et variantes possédés | Catalogue éditorial de découverte | Catalogue **canonique** (comics, éditions, variantes), identifiants stables |
| État, grading, emplacements physiques | Événements, crossovers, guides de lecture | Référentiel des éditeurs et des séries |
| Acquisitions, historique d'achat | Key Issues | Registre des images et Cloudflare R2 |
| Wishlist, Pull List | Classements commerciaux et communautaires, tendances | Authentification, profils, rôles |
| Statistiques de collection | Sorties et calendrier éditorial, actualités | Services backend, file de tâches, journalisation |
| Progression personnelle liée à la lecture et aux possessions | Séries, personnages, équipes, créateurs, éditeurs | Recherche (index séparés par module) |
| Images personnelles (couvertures manuelles, photos) | Recommandations, gestion des images éditoriales, contributions | Service d'agrégation des signaux communautaires |

## 3. État actuel du code (lot 2.6) : couplages constatés [Fait]
Le module Explorer (`index.html`, lignes 9197 à 10030 environ) a été conçu, au lot 2.6, comme une vue de Collection. Il **lit directement** les structures internes de Collection :

| # | Emplacement | Couplage | Nature |
|---|---|---|---|
| C1 | Navigation (l. 1761-1768, 6952-6975) | « Explorer & guides » est un bouton du bloc **« Collection Physique »** et une sous-vue de `#singlesViewSection` (`goSingles('explorer')`) | Interface imbriquée |
| C2 | `exIndexBuild` (l. 9400-9408) | Index construit à partir de `physicalSingles`, `relPubs` et `relPulls` | Lecture directe de l'inventaire et de la Pull List |
| C3 | `exMatch` (l. 9410-9438) | Statuts « possédé / wishlist / probable / rangé » par entrée de guide ; **progression dérivée** de `isRead` des exemplaires | Lecture directe de l'inventaire et de ses champs internes (`locationId`, `box`, `isRead`) |
| C4 | `exCoverOf` (l. 9439-9445) | Repli sur la **couverture de l'exemplaire personnel** (« Votre collection ») | Image personnelle utilisée comme image éditoriale |
| C5 | `exCreators` (l. 9468-9474) | Créateurs **dérivés** de `coverArtist` des exemplaires ; page Créateur « Couvertures dans votre collection » | Entités Explorer construites depuis Collection |
| C6 | `exSeriesList`, `exPublishers` (l. 9475-9494) | Séries et éditeurs **dérivés** de la collection, avec comptes possédés et wishlist | Entités Explorer construites depuis Collection |
| C7 | `exSearch` (l. 9497-9510) | Catégorie de recherche « Ma collection » qui parcourt l'inventaire | Recherche transversale |
| C8 | Suivi de séries (l. 9522) | Séries suivies déduites de `relPulls` | Lecture directe de la Pull List |
| C9 | Actions (l. 9979-9982) | `openSingleInspector(s)` ouvre la fiche Collection ; `addPubToWishlist` écrit dans la wishlist | **Écriture** dans Collection, mais par une fonction de Collection (proche d'un contrat) |
| C10 | Données | Le calendrier (lot 2.4, `relPubs`) est rangé dans la navigation Collection, alors que les sorties relèvent d'Explorer ; la Pull List, elle, relève de Collection | Données éditoriales et personnelles mêlées dans la même vue |

Points positifs : Explorer a ses propres magasins (`editorial`, `readprog`) ; il **n'écrit jamais** directement `physicalSingles` (vérifié : aucun `persistSingles`, `push` ou `splice` dans le module) ; la seule écriture passe par `addPubToWishlist`.

**Ces couplages sont validés fonctionnellement (lot 2.6) et ne sont pas modifiés aujourd'hui.** Ils seront réacheminés par les contrats du § 5, sans changement fonctionnel pour Collection, au lot 4.1 (conception) puis au lot 4.9 (réalisation).

## 4. Ambiguïtés relevées et résolution proposée
| # | Ambiguïté | Résolution proposée | Statut |
|---|---|---|---|
| A1 | Cahier § 3.6 : priorité d'import « comics déjà présents dans les collections » | Explorer ne lit pas les collections. La priorité vient d'un **signal agrégé anonyme** (« demande », contrat S3), calculé par le service d'agrégation | [Reco.] |
| A2 | Cahier § 3.1 : système d'images réutilisé par « Collection, Wishlist, Pull List » | Le registre est une **infrastructure commune**. Collection peut **choisir** d'afficher une image du registre pour un comic canonique, selon ses propres règles. Explorer n'écrit jamais `coverUrl`, `coverSource` ni aucune donnée d'exemplaire | [Reco.] |
| A3 | Cahier § 8 et lot 2.6 : « progression personnelle » des guides | La progression de guide (`readprog`) est **personnelle** : elle est rattachée à l'espace personnel, et non au catalogue éditorial. Explorer l'affiche via un contrat ; Collection garde `isRead`. La dérivation `isRead` → « lu » dans les guides passe par le contrat S1 | **[À valider]** : la progression de guide relève-t-elle de Collection ou d'un domaine personnel « Lecture » distinct ? |
| A4 | Cahier § 18 : « ajouter les comics à sa collection » depuis Explorer | Une **commande** envoyée à Collection (contrat S2), à l'initiative de l'utilisateur, exécutée et validée par Collection, qui renvoie le résultat. Explorer ne crée jamais d'exemplaire | [Reco.] |
| A5 | Calendrier : sorties (Explorer) et Pull List (Collection) dans la même vue (lot 2.4) | À terme, les **sorties** relèvent d'Explorer (catalogue éditorial) et la **Pull List** de Collection. La vue actuelle reste en place. Le badge « dans ma Pull List » d'une sortie passe par S1 | **[À valider]** : faut-il déplacer, en Phase 4, l'entrée « Sorties » de la navigation Collection vers Explorer ? Cela touche la navigation de Collection |
| A6 | Navigation : Explorer est une sous-vue de Collection (C1) | Explorer 2.0 aura sa **propre entrée de navigation** et sa propre section, hors du bloc « Collection Physique ». Retirer le bouton actuel du bloc Collection est une modification de l'interface Collection | **[À valider]** |
| A7 | Recherche « Ma collection » dans Explorer (C7), fonctionnalité du lot 2.6 | Option 1 : conserver un groupe « Dans ma collection » fourni par Collection (contrat S1, recherche limitée à des références). Option 2 : retirer ce groupe (réduction d'une fonctionnalité validée) | **[À valider]**, recommandation : option 1 |
| A8 | Séries, éditeurs et créateurs dérivés des exemplaires (C5, C6) | Explorer 2.0 construit ses entités **uniquement** depuis le catalogue canonique et éditorial. Les comptes personnels (« 3 possédés ») ne sont affichés que via S1 ; la section « Couvertures dans votre collection » passe par S1 ou disparaît | [Reco.] |
| A9 | Cahier § 6.2 : « ajouts en collection » comme indicateur | Seulement via le service d'agrégation (S3), avec seuil d'anonymat et consentement à définir (Phase 3, lot 3.6) | [Reco.] |
| A10 | Rôles éditoriaux (lot 3.3) | Un rôle `admin`, `editor` ou `moderator` ne donne **aucun accès** aux tables personnelles (`app.*`). Pas de contournement de la RLS par rôle | [Reco.] |
| A11 | Guides créés par l'utilisateur (`user_guides`, lot 3.4) | Brouillon **personnel** privé. La publication communautaire est une **soumission** à Explorer (copie éditoriale validée), sans lien vivant vers les données personnelles | [Reco.] |

## 5. Contrats de service autorisés
Tous les contrats sont versionnés (`v1`), documentés, testés, et utilisent les **identifiants canoniques** (`catalog_issue_id`, `catalog_series_id`) ou, à défaut, une référence textuelle normalisée (série, numéro, année). Ils ne renvoient jamais d'objet interne.

### S1 — `CollectionLens` (lecture, personnelle, facultative)
- **Fournisseur** : Collection. **Consommateur** : Explorer.
- **Portée** : utilisateur courant uniquement, exécutée côté client sur ses propres données ; **aucun appel serveur entre modules**.
- **Entrée** : liste de références canoniques (≤ 500 par appel).
- **Sortie** (par référence) : `{ owned: n, wishlisted: bool, inPullList: bool, read: bool }`. Pas de prix, d'état, de grading, d'emplacement, de note ni d'identifiant d'exemplaire.
- Deux fonctions annexes, si A7 option 1 : `searchRefs(q, limit)` → références canoniques et libellés ; `openItem(ref)` → Collection ouvre sa propre fiche.
- **Absence de collection, utilisateur non connecté ou module indisponible** : réponse vide ; Explorer fonctionne normalement.

### S2 — `CollectionCommands` (écriture, sur action de l'utilisateur)
- **Fournisseur** : Collection. **Consommateur** : Explorer.
- Commandes : `addToWishlist(ref)`, `addToCollection(ref)` (ouvre le formulaire de saisie de Collection, prérempli ; c'est Collection qui enregistre), `followSeries(ref)`.
- Validation, dédoublonnage (`sameVariantWish`), sauvegarde et annulation **restent dans Collection**. Réponse : `{ ok, duplicate, error }`.
- **Jamais** déclenchées automatiquement par un import, un classement ou une tâche planifiée.

### S3 — `CommunitySignals` (agrégats, serveur)
- **Fournisseur** : service d'agrégation dédié (schéma `signals`), exécuté en tâche planifiée avec un rôle technique. **Consommateur** : Explorer (classements, priorités d'import).
- Lit les tables personnelles **uniquement** dans une fonction `security definer` dédiée, et n'écrit **que** des agrégats (`community.popularity_snapshots` : référence canonique, période, comptes).
- Règles : seuil minimal d'utilisateurs par agrégat (k ≥ 10 proposé), exclusion des comptes suspendus et des doublons, respect du réglage de confidentialité et du consentement, **aucun identifiant d'utilisateur** dans la sortie.
- N'écrit **jamais** dans les tables de Collection.

### S4 — `MediaRegistry` (infrastructure commune)
- Lecture : `getImage(entityType, entityId, variant)` → URL CDN, attribution, droits. Écriture : réservée aux workers et aux rôles éditoriaux.
- Les images **personnelles** (couvertures manuelles, photos d'exemplaires) restent la propriété de Collection. Elles ne sont **jamais** reprises dans le registre public ni par Explorer sans un consentement explicite (contribution volontaire, droits cédés).
- Un import Explorer ne modifie **aucun** enregistrement de Collection.

### S5 — `CanonicalCatalog` (infrastructure commune, lecture seule pour les deux modules)
- Comics, éditions, variantes, séries, éditeurs, identifiants externes. Alimenté par les pipelines éditoriaux, sous contrôle des droits.
- Collection **peut** référencer une entrée canonique par un champ facultatif `catalog_issue_id` **ajouté plus tard, de façon additive**. Ce rapprochement est proposé à l'utilisateur et n'est jamais imposé. Aucune migration destructive.

### S6 — Identité
Authentification, profil et rôles (Phase 3), communs. Les rôles ne donnent aucun accès aux données personnelles (A10).

## 6. Dépendances interdites
- Explorer lit `physicalSingles`, `seriesMeta`, `relPulls`, `locDoc`, `app.copies`, `app.locations`, `app.pulls` ou tout autre stockage interne de Collection, en dehors de S1 et S3.
- Explorer écrit dans un stockage de Collection, en dehors des commandes S2 initiées par l'utilisateur.
- Collection importe ou appelle une fonction interne d'Explorer (`exMatch`, `exEditorial`…).
- Une entité Explorer (série, créateur, éditeur, personnage) est **dérivée** de données personnelles.
- Une image personnelle sert d'image éditoriale ou publique.
- Une requête serveur joint des tables personnelles et des tables éditoriales pour l'affichage d'Explorer.
- Un rôle éditorial ou d'administration voit les collections individuelles.
- Un classement, un import ou une tâche planifiée modifie une donnée de Collection.
- Explorer exige un compte ou une collection pour afficher un contenu public.
- Fusion des interfaces, déplacement de fonctionnalités de Collection, remplacement de ses modèles par des modèles éditoriaux, migration destructive.

## 7. Traduction technique
### Client
- Deux modules distincts : `collection` (existant) et `explorer`, ce dernier dans des fichiers séparés en Phase 4.
- Un unique point de contact `Panel.contracts.collection.v1` (S1 et S2), implémenté par Collection.
- Une **règle de vérification automatique** (test statique) : le code d'Explorer ne doit référencer aucun identifiant interne de Collection (`physicalSingles`, `seriesMeta`, `relPulls`, `locDoc`, `persistSingles`…).

### Serveur
| Schéma | Propriétaire | Accès |
|---|---|---|
| `app` | Collection et données personnelles (Phase 3) | RLS par `user_id` ; aucun rôle éditorial |
| `catalog` | Commun (référentiel canonique) | Lecture publique ; écriture par les rôles éditoriaux et les workers |
| `editorial` | Explorer | Lecture publique des contenus publiés ; écriture par les rôles éditoriaux |
| `media` | Commun (registre des images) | Lecture publique des images publiées ; écriture par les workers et les rôles éditoriaux |
| `signals` / `community` | Service d'agrégation / Explorer | Fonctions `security definer` d'agrégation seulement ; sortie publique sans identifiant d'utilisateur |

Tests de frontière (lots 3.3 et 4.2) :
- un rôle `editor` ou `admin` ne lit aucune ligne de `app.*` ;
- la clé anonyme lit le contenu public d'Explorer sans aucune ligne de `app.*` ;
- les fonctions d'agrégation renvoient des comptes seulement au-dessus du seuil.

## 8. Risques architecturaux
| Risque | Effet | Parade |
|---|---|---|
| Couplages historiques du lot 2.6 (C1 à C10) | Explorer 2.0 bâti sur les structures de Collection | Réacheminement par S1 et S2 au lot 4.9 ; test statique de frontière |
| Expérience perçue comme moins riche (comptes « possédé » absents pour un visiteur) | Attente produit | S1 enrichit l'affichage si une collection existe ; Explorer reste complet sans elle |
| Réidentification par des agrégats trop fins | RGPD | Seuil k, périodes larges, aucun identifiant, revue juridique |
| Catalogue canonique alimenté par des sources non autorisées | Juridique | Matrice des droits ([`01`](01-analyse-et-impacts.md) § 2) |
| Rôles trop puissants | Fuite de données personnelles | A10 et tests de frontière |
| Navigation : déplacer Explorer et les Sorties hors du bloc Collection modifie l'interface Collection | Conflit avec « ne pas modifier Collection » | Décisions A5 et A6 soumises à l'utilisateur |
| Double source de vérité pour les références (texte normalisé et identifiants canoniques) | Mauvais rapprochements | Identifiant canonique prioritaire ; repli textuel marqué « non vérifié » |
