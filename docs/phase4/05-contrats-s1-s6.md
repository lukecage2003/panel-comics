# Phase 4 · 05 — Contrats techniques S1 à S6 (version de référence)

Statut : **documenté, non implémenté** (7 novembre 2026). Ce document **fait autorité** pour les contrats ; il remplace le § 5 de [`02-frontieres-collection-explorer.md`](02-frontieres-collection-explorer.md) (révision 3), qui renvoie désormais ici.

Légende : **[Fait]** · **[Décidé]** · **[Reco.]** · **[À valider]**.

## 1. Règles communes
| Règle | Définition |
|---|---|
| Nommage et versions | `NomDuContrat.vN`. Une évolution compatible (champ facultatif ajouté) garde `vN`. Une évolution incompatible crée `vN+1` ; `vN` reste servi pendant au moins une version majeure de l'application, et son retrait est annoncé dans le journal des décisions |
| Références | Identifiant canonique (`catalog_issue_id`, `catalog_series_id`) quand il existe ; sinon `{ series, issue, year?, variant? }` avec `unverified: true` |
| Données échangées | Objets simples, copiés, sérialisables. Jamais d'objet interne, de référence mémoire ni d'identifiant d'exemplaire |
| Erreurs | `{ ok: false, code, message }` ; `code` ∈ `unavailable`, `unauthenticated`, `forbidden`, `invalid_input`, `not_found`, `conflict`, `rate_limited`, `disabled`, `internal`. Les messages ne contiennent jamais de donnée personnelle |
| Dégradation | Le consommateur fonctionne **toujours** sans le contrat (affichage éditorial seul, boutons masqués, placeholder). Aucun contrat n'est bloquant pour l'affichage d'Explorer ou de Collection |
| Journalisation | Côté serveur : appel, code de résultat, durée ; **jamais** le contenu personnel |
| Tests de frontière | Pour chaque contrat : tests de conformité côté fournisseur, test « fournisseur absent » côté consommateur, test « permission refusée », test d'absence de fuite (la sortie ne contient aucun champ interdit) |

## 2. Synthèse
| Contrat | Responsabilité | Propriétaire fonctionnel | Consommateurs | Exécution | Statut |
|---|---|---|---|---|---|
| S1 `PersonalLens.v1` | Statuts personnels minimaux, **facultatifs** | Collection + Lecture | Explorer | Appareil | Documenté |
| S2 `PersonalCommands.v1` | Commandes explicites de l'utilisateur vers le domaine propriétaire | Collection + Lecture | Explorer | Appareil (puis synchronisation par le propriétaire) | Documenté |
| S3 `SignalAggregates.v1` | Agrégats anonymisés pour classements et priorités | Service d'agrégation (plateforme) | Explorer, plus tard Community | Serveur | Documenté ; **seuil et consentement à valider** |
| S4 `MediaRegistry.v1` | Registre d'images partagé, droits, livraison | Service média (plateforme) | Explorer ; Collection si elle le choisit | Serveur + CDN | Documenté ([`07`](07-architecture-images-r2.md)) |
| S5 `CanonicalCatalog.v1` | Catalogue canonique, **lecture seule** pour les consommateurs | Service catalogue (plateforme, alimenté par l'éditorial) | Explorer, Collection, Community | Serveur + cache local | Documenté |
| S6 `Identity.v1` | Identité, session, profil, rôles | Plateforme (Phase 3) | Tous | Serveur + session locale | Conçu en Phase 3 (lots 3.2, 3.3) |

## 3. S1 — `PersonalLens.v1` (lecture personnelle facultative)
| Élément | Définition |
|---|---|
| Responsabilité | Enrichir l'affichage d'Explorer avec des statuts personnels **minimaux**, sans jamais exposer l'inventaire |
| Propriétaire | Collection (possession, wishlist, Pull List) et Lecture (progression) |
| Entrées | `statusFor(refs[])`, au plus 500 références ; `guideProgress(guideId, entryIds[])`, au plus 2 000 ; `isEnabled()` |
| Sorties | `statusFor` → par référence `{ owned: n, wishlisted: bool, inPullList: bool, read: bool }` ; `guideProgress` → par entrée `{ status: 'to_read' \| 'reading' \| 'read' \| 'skipped' \| '', derivedFromCollection: bool }` |
| Champs interdits | Prix, valeurs, état, grading, emplacement, notes, dates et lieux d'achat, identifiants d'exemplaires, totaux de collection |
| Permissions [Décidé] | **Activée par défaut** pour les utilisateurs connectés ; **indisponible** pour les visiteurs non connectés ; **désactivable à tout moment** (réglage « Personnaliser Explorer avec mes données », effet immédiat) ; exécutée **sur l'appareil**, sur les seules données de l'utilisateur courant ; **aucun accès administrateur** (rien ne transite par le serveur) |
| Erreurs | Visiteur : `disabled` ; réglage désactivé : `disabled` ; fournisseur absent : `unavailable` ; entrée invalide : `invalid_input` ; dépassement : `rate_limited` |
| Dégradation | Explorer affiche la version **éditoriale complète** sans aucun statut ; aucune fonctionnalité éditoriale ne dépend de S1 |
| Versions | `v1` ; un nouveau statut (par exemple `rated`) est un ajout compatible |
| Tests de frontière | Sortie sans champ interdit ; réglage désactivé → aucun appel au fournisseur ; visiteur → `disabled` ; Explorer complet avec un fournisseur absent ; aucune écriture pendant un appel S1 (empreinte identique) |
| Disponibilité | Locale : disponible hors ligne |

**Vérification « pas de dépendance obligatoire »** : aucun écran, aucune recherche, aucun classement, aucun guide ni aucune sortie d'Explorer n'exige S1. S1 ajoute seulement des badges et des filtres personnels (« masquer ce que je possède »), eux-mêmes absents si S1 est désactivé. **Conforme dans la conception.** Aujourd'hui, l'Explorer du lot 2.6 lit directement Collection (C2 à C10) : il dépend de Collection **dans le code**, sans en dépendre pour ses contenus éditoriaux : les guides proviennent du magasin `editorial`. Le comportement avec une collection vide n'est pas couvert explicitement par un test : à ajouter au lot 3.1b.

**Ambiguïté P1 [À valider]** : aujourd'hui, il n'existe pas de comptes ; tous les utilisateurs sont **locaux** (profil `usr_local_…`). Appliquée à la lettre, la règle « indisponible pour les visiteurs non connectés » supprimerait, pour eux, les statuts possédé / lu / wishlist des guides, une fonction validée au lot 2.6. Options :
- **P1-a (recommandée)** : un utilisateur **local de l'appareil** (profil local, données sur l'appareil) est traité comme « connecté » pour S1, qui s'exécute de toute façon sans réseau ; le « visiteur non connecté » est celui qui consulte Explorer sans profil (web public) ;
- **P1-b** : application stricte : S1 seulement avec un compte Panel ; les utilisateurs locaux perdent les statuts jusqu'à la création d'un compte (retrait d'une fonctionnalité validée, à autoriser).

## 4. S2 — `PersonalCommands.v1` (commandes explicites vers le domaine propriétaire)
| Élément | Définition |
|---|---|
| Responsabilité | Permettre à l'utilisateur d'agir sur **ses** données depuis Explorer ; l'exécution appartient au domaine propriétaire |
| Propriétaire | Collection (wishlist, collection, Pull List, suivi) ; Lecture (progression) |
| Entrées | `addToWishlist(ref, opts)` ; `addToCollection(ref)` (ouvre le formulaire de Collection prérempli ; l'utilisateur enregistre) ; `addToPullList(ref, opts)` ; `followSeries(seriesRef)` ; `setGuideProgress(guideId, entryId, status)` ; `openItem(ref)` |
| Sorties | `{ ok: true, duplicate?: bool, undoToken?: string }` ou une erreur |
| Permissions | Uniquement à la suite d'un **geste explicite** de l'utilisateur ; jamais depuis un import, un classement, une tâche planifiée, un worker ou un rôle d'administration ; pas d'opération en masse ; indisponible pour un visiteur (Explorer propose alors « créer un profil ») |
| Règles | Validation, dédoublonnage (`sameVariantWish`), persistance, sauvegarde, annulation et synchronisation **par le propriétaire**, avec ses règles actuelles |
| Erreurs | `disabled` (visiteur), `unavailable` (Collection absente : boutons masqués), `invalid_input`, `conflict` (doublon : `ok: true, duplicate: true`), `internal` |
| Dégradation | Explorer masque les boutons d'action personnelle ; tout le reste fonctionne |
| Versions | `v1` ; une nouvelle commande est un ajout compatible |
| Tests de frontière | Une commande n'est acceptée qu'avec un jeton de geste utilisateur ; aucune commande depuis un worker ; dédoublonnage identique à celui de Collection ; annulation fonctionnelle |
| Disponibilité | Locale, hors ligne comprise ; la synchronisation est faite ensuite par le propriétaire (Phase 3) |

S2 ne dépend **pas** de S1 : une commande peut être envoyée sans lecture préalable des statuts (la réponse `duplicate` suffit).

## 5. S3 — `SignalAggregates.v1` (agrégats anonymisés)
| Élément | Définition |
|---|---|
| Responsabilité | Produire des agrégats de signaux **autorisés** (ajouts en wishlist, intérêt, lectures déclarées, consultations, recommandations) pour les classements et les priorités d'import |
| Propriétaire | Service d'agrégation (schéma `signals`, plateforme) |
| Entrées | Tâche planifiée ; lecture des tables personnelles **uniquement** dans des fonctions `security definer` dédiées, limitées aux colonnes nécessaires ; signaux de Community plus tard |
| Sorties | `signals.aggregates(catalog_ref, signal, period, count, computed_at, method_version)` ; aucun identifiant d'utilisateur, aucune liste |
| Permissions | Écriture : rôle technique du service ; lecture : publique, pour les agrégats publiés ; **aucun rôle** (y compris `admin`) n'accède aux signaux individuels par ce contrat |
| Protection contre la réidentification | Seuil minimal d'utilisateurs distincts par agrégat (**k ≥ 10 proposé, à valider juridiquement et techniquement** : ce n'est **pas** une garantie automatique d'anonymat) ; périodes d'au moins une semaine ; arrondi des comptes (par exemple à 5 près) ; **pas de différences publiables** entre agrégats proches (même période, filtres emboîtés) qui permettraient d'isoler une personne ; pas de croisements fins (éditeur × variante × semaine) sans revue ; exclusion des comptes suspendus et des doublons ; respect du consentement et des réglages de confidentialité ; étude de techniques plus fortes (bruit calibré de type confidentialité différentielle) au lot 4.7 |
| Erreurs | Agrégat sous le seuil : **absent** (jamais de valeur partielle) ; tâche échouée : dernière valeur publiée conservée, avec sa date ; source de signal désactivée : signal exclu, méthode documentée |
| Dégradation | Classements communautaires masqués ou datés ; les classements commerciaux et le reste d'Explorer fonctionnent |
| Versions | `method_version` publiée avec chaque agrégat ; un changement de méthode crée une nouvelle série, sans réécrire l'historique |
| Tests de frontière | Aucune ligne sous le seuil ; aucun identifiant dans la sortie ; aucune écriture dans `app.*` (empreinte) ; test de différenciation (deux requêtes voisines ne révèlent pas un individu) |
| Disponibilité | Asynchrone ; fraîcheur affichée |

## 6. S4 — `MediaRegistry.v1` (registre d'images partagé)
| Élément | Définition |
|---|---|
| Responsabilité | Registre central des métadonnées d'images, droits, provenance et livraison des images **publiques autorisées** |
| Propriétaire | Service média (schéma `media`, plateforme) ; fichiers sur Cloudflare R2 |
| Entrées | Lecture : `getImage(entityType, entityId, variant)`, `listImages(entityType, entityId)` ; écriture : `register`, `replace`, `withdraw`, `link`, `unlink` (workers et rôles éditoriaux) |
| Sorties | `{ assetId, url, width, height, variant, attribution, license, rightsStatus, status }` |
| Permissions | Lecture publique des images publiées ; écriture réservée au service média et aux rôles `editor` et `admin` ; aucun accès aux images personnelles de Collection |
| Règles | Associations **distinctes par domaine** (`domain` : `explorer`, `collection`, plus tard `community`) ; une association Explorer ne crée, ne modifie et ne supprime **aucune** donnée de Collection ; aucune substitution d'édition ou de variante ; images aux droits inconnus jamais copiées sur R2 |
| Erreurs | `not_found` (placeholder) ; `withdrawn` (retirée pour droits : placeholder, attribution masquée) ; `unavailable` (CDN : placeholder) |
| Dégradation | Placeholder honnête (« image non disponible »), jamais une image arbitraire |
| Versions | `v1` ; variantes d'affichage versionnées (`thumb`, `card`, `cover`, `detail`, `hero`) |
| Tests de frontière | Empreinte de Collection identique après un import massif ; refus d'écriture pour un rôle non éditorial ; une image `withdrawn` n'est plus servie |
| Disponibilité | CDN ; cache local des variantes consultées (hors ligne) |

## 7. S5 — `CanonicalCatalog.v1` (catalogue canonique, lecture seule)
| Élément | Définition |
|---|---|
| Responsabilité | Référentiel des comics, éditions, variantes, séries et éditeurs, avec provenance et droits ; périmètre **comics uniquement** ([`04`](04-perimetre-sorties-comics.md)) |
| Propriétaire | Service catalogue (schéma `catalog`), alimenté par les pipelines éditoriaux d'Explorer |
| Entrées | `resolve(refText)` → candidats et score de confiance ; `get(id)` ; `search(q)` ; `changesSince(cursor)` (cache local) |
| Sorties | Fiches canoniques publiques, références externes autorisées, `medium` |
| Permissions | **Lecture seule** pour tous les consommateurs ; écriture par les pipelines et les rôles `editor` et `admin` |
| Règles | Collection **peut**, plus tard et de façon additive, enregistrer un `catalog_issue_id` sur un exemplaire, sur proposition **validée par l'utilisateur** ; le catalogue n'écrit jamais dans Collection ; seules les sources aux droits suffisants l'alimentent |
| Erreurs | `not_found` ; résolution ambiguë → liste de candidats, **sans choix automatique** sous le seuil ; `unavailable` → cache local |
| Dégradation | Cache local ; Collection continue avec ses propres champs (série, numéro…) ; la Pull List garde son instantané `ref` [Fait, l. 8707] |
| Versions | `v1` ; `schema_version` par fiche |
| Tests de frontière | Aucune écriture possible par un client ; Collection fonctionne avec le catalogue indisponible ; aucune fiche `manga` dans les Sorties |
| Disponibilité | Serveur et cache local |

## 8. S6 — `Identity.v1`
| Élément | Définition |
|---|---|
| Responsabilité | Authentification, session, profil, appareils, rôles |
| Propriétaire | Plateforme (Phase 3 : Supabase Auth, schéma `app` pour le profil, `app.staff_roles`) |
| Entrées et sorties | `session()` → `{ userId, roles[], local: bool }` ou `null` (visiteur) ; `profile()` → profil minimal ; plus tard `publicProfile(handle)` via Community |
| Permissions | Rôles `admin`, `editor`, `moderator` attribués côté serveur ; **aucun** n'ouvre l'accès aux données personnelles d'autrui (RLS) |
| Erreurs | `unauthenticated` (visiteur ou session expirée), `forbidden` |
| Dégradation | Visiteur : Explorer public complet, Collection locale ; session expirée : tout reste local, la synchronisation attend |
| Versions | `v1` |
| Tests de frontière | Rôles éditoriaux sans aucune ligne de `app.*` ; visiteur sans accès aux fonctions personnelles ; révocation d'appareil |
| Disponibilité | Hors ligne : session locale conservée, sans rafraîchissement |

## 9. Futur contrat Community (réservé)
`CommunityFeed.v1` (publications, listes publiques, avis) et `CommunityPublish.v1` (publication **explicite** par l'utilisateur d'une copie de ses données). **Définis le 8 novembre 2026 (C-0, D-46)** dans `domains/community/policy-core.js` :
- `buildPublish` / `validatePublish` pour `CommunityPublish.v1`. Champs : `contract`, `clientId`, `visibility`, `text`, `items`, `createdAt`, `consent`, `revocable`. Les éléments passent par la liste blanche `SHAREABLE_COPY_FIELDS`. Le consentement explicite est obligatoire et la publication toujours révocable.
- `buildRevoke` pour `CommunityRevoke.v1`.
- `validateFeedItem` pour `CommunityFeed.v1`. Tout champ hors contrat, tout HTML et tout champ personnel est refusé.

Aucun service ne les reçoit encore. L'application montre seulement un « Aperçu de l'envoi » (test 46).

## Réalisation de S1 et S2 (sous-lot 3.1b-2, 8 novembre 2026)
- **API** : `Panel.contracts.personal.v1` = `{ version, lens, commands, settings }`, gelé.
- **P1-a (D-22)** : le profil local est traité comme connecté. Le réglage `panel_explorer_personalize` (activé par défaut) fait partie des préférences sauvegardées (section `app`). Son interface arrive au sous-lot 3.1b-3, quand Explorer consommera S1.
- **S1** :
  - `statusFor` renvoie exactement `{ owned, wishlisted, inPullList, read }` ;
  - `read` vient de `readingStatusOf` (domaine Lecture), alimenté provisoirement par `isRead` et remplacé par L1 (L-D2) ;
  - `guideProgress` renvoie `{ status, derivedFromCollection }` ;
  - erreurs : `disabled`, `unavailable`, `invalid_input`, `rate_limited` (au-delà de 500 références ou de 2 000 entrées).
- **S2** :
  - un jeton n'est délivré que par `commands.gesture(event)` pour un événement `isTrusted` ; il est à usage unique et valable 10 s ; sans lui : `gesture_required` ;
  - `addToCollection` ouvre la fiche créée pour que l'utilisateur la complète (aucun prix payé inventé, D-18) ;
  - `setGuideProgress` est exécutée par le domaine Lecture ; `openItem` ouvre la fiche dans Collection sans renvoyer d'identifiant à Explorer ;
  - annulation par `commands.undo(undoToken)`.
- **Tests** : test 33 de `run-all-tests.js`, avec de vrais clics envoyés par CDP (`Input.dispatchMouseEvent`).
- **Hors de ce sous-lot** : Explorer n'utilise pas encore S1 et S2 (sous-lot 3.1b-3).

## Consommation par Explorer (sous-lot 3.1b-3, 8 novembre 2026)
- **Explorer ne lit plus Collection ni Lecture** : il résout seulement la publication du calendrier (`exResolve`) et demande les statuts à S1. Le rapprochement avec l'inventaire (`colIndex`, `colMatch`) est une fonction interne de Collection, utilisée uniquement par les fournisseurs S1 et S2.
- **Ajouts compatibles de v1** (règle du § 1 : champ facultatif ajouté), sans aucun champ interdit :
  - `statusFor(refs, { include })` : statuts facultatifs renvoyés **seulement sur demande** : `unconfirmed` (même titre et numéro, année absente de la fiche : badge « Possédé ? (à confirmer) ») et `seriesFollowed` (série suivie) ; sans `include`, la sortie reste exactement `{ owned, wishlisted, inPullList, read }` ;
  - `collectionFacets()` : agrégats « d'après votre collection » pour les pages séries, éditeurs et créateurs (C5, C6) : noms, éditeurs, années de couverture, numéros, comptes ; ni prix, ni état, ni emplacement, ni note, ni identifiant d'exemplaire. Il disparaît au profit du catalogue éditorial (S5) au lot 4.3.
- **Retraits prévus par la conception** ([`02`](02-frontieres-collection-explorer.md) § 3, C3 et C4) : badge « Rangé » (emplacement, champ interdit) et repli sur la couverture d'un exemplaire personnel ; A7 : catégorie « Ma collection » retirée de la recherche d'Explorer.
- **Actions** : « + Wishlist », statut de lecture d'une entrée (boutons et liste du mode simplifié) et ouverture d'un exemplaire depuis la page d'un créateur passent par S2, avec `commands.gesture(event)` dans le gestionnaire de clic. L'ajout à la wishlist propose désormais « Annuler ».
- **Dégradation** : réglage désactivé ou fournisseur absent → guide éditorial complet, sans badge, filtre « Masquer les lus », progression ni recommandations ; les séries, créateurs et éditeurs dérivés de la collection disparaissent. Réglage désactivé : **aucun appel** au fournisseur.
- **Réglage** « Personnaliser Explorer avec mes données » : interrupteur dans l'en-tête d'Explorer, effet immédiat.
- **Tests** : test 34 (« Frontières ») ; test 29 adapté pour A7, et ses deux clics de statut rejoués par de vrais clics CDP (attentes inchangées), car S2 refuse les événements synthétiques.

## Consommation par le calendrier (sous-lot 3.1b-5, 8 novembre 2026)
- **Répartition (A5)** : publications, calendrier, sources et import = Explorer ; Pull List, wishlist structurée et conversions (`relMakeSingle`, `addPubToWishlist`, `addPubToCollection`, `wishToCollection`, `collectionToWishlist`, `addPull`, `pickUpPull`, `pullStatusOf`, panneau Pull List) = Collection.
- **E1** : les boutons du calendrier (★, « + Pull », « Wish », « Acheté ») et de la fiche publication (« + Pull List », « Wishlist », « Collection ») passent par S2 avec `commands.gesture(event)` ; Collection écrit ses fiches et sa Pull List, puis rafraîchit ses propres vues. Le panneau Pull List s'inscrit dans la vue calendrier par un registre (`registerReleasesPanel`), sans appel du calendrier vers Collection.
- **E2** : `pullStatusOf` et `pickUpPull` restent dans Collection : c'est Collection qui lit le catalogue (direction autorisée par [`02`](02-frontieres-collection-explorer.md)). Le calendrier ne lit plus l'état des pulls : il reçoit `pullPending` de S1.
- **E3** : l'annulation d'import demande à S1 `referencedPubs(pubIds)` (oui/non par publication : exemplaire lié ou numéro de Pull List, quel que soit son état). C'est une question d'intégrité, posée même si le réglage « Personnaliser » est désactivé ; sans réponse du fournisseur, **toutes** les publications ajoutées sont conservées.
- **E4** : la fiche publication affiche « Dans votre collection : N exemplaire(s) (+ à confirmer) · wishlist : oui/non » d'après S1 (`owned: n`, `wishlisted`, `unconfirmed`) ; aucun exemplaire n'est reçu.
- **E5** : le store `pulls` reste dans `panel-catalog` (pas de nouvelle version) ; il est sauvegardé par le fournisseur `collection`. Le chargement partagé (`loadReleaseData`) et l'ancien format d'export (D-23) sont les seuls usages admis côté calendrier.
- **Ajouts compatibles de v1** (sur demande seulement) : statuts facultatifs `pullPending` (numéro en attente dans la Pull List) et `seriesSubscribed` (série entière abonnée, bouton ★) ; `lens.referencedPubs` ; options de commandes `from` (origine), `variant` et `quantity` pour `addToPullList` et `addToCollection`, `followUp: 'price'` (Collection propose « Saisir le prix ») et `follow: false` pour `followSeries` (désabonnement). Le prix payé n'est jamais inventé (D-18).
- **Rapprochement** : le calendrier utilise la règle de S1 (titre et numéro avec année cohérente, ou publication liée). Une fiche sans année donne « POSSÉDÉ ? » (à confirmer) ; un numéro identique d'une autre année n'est plus marqué « POSSÉDÉ » (l'ancienne règle ignorait l'année).
- **Dégradation** : réglage désactivé ou fournisseur absent → calendrier complet sans badge ni bouton désactivé ; « Ma pull list » n'affiche rien ; les actions répondent « Action impossible » sans rien écrire.
- **Tests** : test 34 enrichi (clics synthétiques refusés, vrais clics : ajout, conversion sans doublon, prix jamais inventé, quantité, fournisseur absent, annulation d'import prudente) ; test 11 : le clic « Acheté » est rejoué par un vrai clic CDP (attente inchangée) ; test 27 inchangé. `check:boundaries` couvre aussi les fonctions du calendrier (0 couplage, 22 avant).
- **Hors périmètre** : le filtre « comics uniquement » des Sorties (B-17) n'est pas appliqué, M1 à M4 n'étant pas tranchées : il est reporté au lot 4.6.

