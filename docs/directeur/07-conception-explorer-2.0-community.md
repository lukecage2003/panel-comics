# Plan directeur 2.0 · 07 — Conception Explorer 2.0 et Community

Statut : **conception à valider** (8 novembre 2026). Aucune implémentation n'est prévue dans cette mission.

- **Explorer 2.0** est déjà spécifié en détail dans le [cahier des charges](../phase4/00-explorer-2.0-cahier-des-charges.md) (révision 5), les [frontières](../phase4/02-frontieres-collection-explorer.md), les [contrats](../phase4/05-contrats-s1-s6.md), les [images R2](../phase4/07-architecture-images-r2.md) et le [plan d'exécution](../phase4/08-plan-execution.md). La partie A **ne les répète pas** : elle en fait la synthèse et comble les manques demandés (sagas, personnages et équipes, actualités, recommandations, recherche).
- **Community** n'avait qu'une réservation (C-0, contrats réservés). La partie B en est la **conception complète**, qui sert de document C-0.

Décisions déjà acquises, non rediscutées :
- D-07, séparation des domaines ;
- D-09 (A5) : calendrier dans Explorer, Pull List dans Collection ;
- D-10 (A6) : entrée Explorer propre ;
- D-11 (A7) : pas de recherche personnelle dans Explorer ;
- D-12 : comics uniquement, pas de mangas japonais, manhwa, manhua ni webtoons, pas d'encyclopédie générale ;
- D-15 : Community est un domaine indépendant ;
- D-16 : k ≥ 10 est une simple proposition.

---

## Partie A — Explorer 2.0

### A.1 Vision
Explorer est un **espace éditorial de découverte des comics**, américains et internationaux (franco-belge selon M1). Il répond à quatre questions : « que lire ? », « dans quel ordre ? », « qu'est-ce qui sort ? », « qui l'a fait ? ».

Il fonctionne **sans compte et sans collection**. S1 n'ajoute que des badges facultatifs (possédé, lu, wishlist).

Ce n'est :
- ni une encyclopédie : les fiches restent courtes, sourcées, orientées lecture ;
- ni une extension de Collection.

### A.2 Architecture fonctionnelle
| Module | Contenu | Lot | Spécifié dans |
|---|---|---|---|
| Catalogue | Séries, numéros, variantes, recueils, éditions VO/VF, relations | 4.2, 4.3, 4.8 | `00` § 3, § 10 |
| Événements et crossovers | Événement, tie-ins, ordre, impact | 4.4 | `00` § 3.2 |
| **Sagas** (ajout) | Arc narratif d'une série (« Court of Owls ») : regroupement ordonné de numéros dans une série ; plus léger qu'un événement | 4.4 (même modèle qu'un événement, `kind: 'saga'`) | Ce document |
| Key Issues | Premières apparitions, morts, origines ; sourcés, sans cote | 4.5 | `00` § 3.2 |
| **Personnages et équipes** (précisé) | Fiche courte : alias, première apparition, éditeur, séries principales, événements, guide « par où commencer » ; équipes = personnages membres datés | 4.3 (données), 4.9 (pages) | `00` § 3.2 ; ce document |
| Créateurs | Bibliographie de comics, rôles, séries marquantes | 4.3, 4.9 | `00` |
| Éditeurs | Lignes éditoriales, imprints, séries en cours | 4.3, 4.9 | `00` |
| Sorties | Calendrier international de comics, reports et annulations (A5) | 4.6 | `00` § 6.1 ; [`04`](../phase4/04-perimetre-sorties-comics.md) |
| **Actualités** (ajout) | Annonces éditoriales courtes **liées** à une entité (série, événement, créateur) avec source et date ; pas de rédaction d'articles longs ; activées seulement avec une source licenciée ou une rédaction interne | 4.10 (outil), après décision de source | Ce document |
| Classements | Commerciaux sourcés (4.6) et communautaires agrégés S3 (4.7, k ≥ 10 à valider) | 4.6, 4.7 | `00` § 6 |
| Guides de lecture | Guides éditoriaux (existant lot 2.6), progression dans le domaine Lecture | Existant, puis 4.9 | Lot 2.6 ; [`06`](06-specifications-F1-L1.md) § B |
| **Recommandations** (précisé) | Éditoriales (« si vous avez aimé X ») et contextuelles (relations du catalogue). Personnalisées **seulement** via S1 et sur l'appareil ; aucun profilage serveur | 4.9 | Ce document |
| Recherche globale | Catalogue éditorial seulement (A7) ; tolérance aux fautes, alias de personnages, VO/VF ; filtres par type d'entité | 4.9 | `00` ; ce document |
| Médias | Couvertures et visuels via S4 (R2) ; droits par source | 4.2 | [`07`](../phase4/07-architecture-images-r2.md) |

### A.3 Structure des données (schéma `catalog` / `editorial`, réservé en Phase 3)
Entités :
- `series`, `issue`, `variant`, `edition_relation` (VO ↔ VF, recueil ↔ numéros) ;
- `event` (`kind`: `event` | `saga`), `event_entry` (ordre, rôle : principal, tie-in, facultatif) ;
- `character`, `team`, `team_membership` (période), `creator`, `credit` (rôle par numéro), `publisher`, `imprint` ;
- `key_fact` (type, numéro, source) ;
- `release` (date annoncée, date réelle, statut, historique) ;
- `news_item` (entité liée, source, date, expiration) ;
- `guide`, `guide_entry` ;
- `ranking` (source, période, entrées) ;
- `media` (S4).

Chaque fiche porte :
- `medium` (`comic` | `manga` | `unknown`) : seul `comic` est publié (D-12) ;
- sa provenance par champ (déjà le principe du lot 2.6).

### A.4 Parcours
1. **Découverte sans compte** : accueil, événement, ordre de lecture, numéro, « où le trouver » (sorties, éditions).
2. **Personnage** : fiche, « par où commencer » (guide), événement, série.
3. **Sorties de la semaine** : filtre éditeur et marché, puis S2 « ajouter à ma Pull List » (Collection) ou « à ma wishlist ».
4. **Avec S1 actif** : badges possédé, lu ou wishlist sur les guides, puis « prochain numéro à lire » (Lecture).

### A.5 Contrats et dépendances
- **Contrats consommés** : S1 (statuts), S2 (commandes), S3 (agrégats, 4.7), S4 (médias), S5 (catalogue canonique publié), S6 (identité).
- **Aucun accès** à `app.*`, ni à `physicalSingles`, ni à Lecture en direct.
- **Dépendances** : critères X1 à X4 de [`08`](../phase4/08-plan-execution.md) § 6 ; 3.1b pour la séparation côté client ; décisions M1 à M4 ; matrice des droits des sources.

### A.6 Priorités, risques, tests
- **Priorités** : catalogue et images (4.2, 4.3), puis événements, sagas et Key Issues (4.4, 4.5), puis sorties (4.6), puis accueil et recherche (4.9). Actualités et classements communautaires en dernier.
- **Risques.**
  - Droits sur les métadonnées et les images : ne jamais supposer qu'une API gratuite autorise un usage commercial. Comic Vine est non commercial ; GCD est en CC BY-SA, avec partage à l'identique.
  - Glissement vers l'encyclopédie : maîtrisé par des fiches courtes et le périmètre D-12.
  - Coûts R2 : plafond à fixer (décision R2).
- **Tests** : critères 1 à 31 du cahier ; Explorer complet sans collection ; aucune donnée personnelle dans les réponses ; aucun mangas publié (`medium`) ; recherche sans catégorie personnelle.

---

## Partie B — Community (conception C-0)

### B.1 Vision
Un espace d'échange **entre lecteurs et collectionneurs de comics**, sur ce que chacun **choisit de publier** : critiques, listes, discussions.
- Community ne lit **jamais** les données privées de Collection, de Lecture ni les finances.
- Elle ne reçoit que des **copies publiées explicitement**, révocables (`CommunityPublish.v1`).

### B.2 Trois catégories de données
| Catégorie | Exemples | Règle |
|---|---|---|
| Personnelle privée | Collection, finances, emplacements, lecture, notes | Jamais visible ni lue par Community ; aucune exception administrateur |
| Publique (publiée par l'utilisateur) | Critique, liste, message, profil public | Copie explicite ; modifiable et retirable ; modérée |
| Agrégée | « 120 lecteurs ont lu cet événement » | Seulement via S3, seuil k à valider (D-16), consentement selon le juriste |

### B.3 Fonctions
| Fonction | Description | Règles clés |
|---|---|---|
| Profils publics | Pseudonyme (`handle`, Phase 3), avatar, bio, critiques et listes publiées | Privé par défaut ; le profil public est une option |
| Abonnements | Suivre un utilisateur, une série ou un événement | Abonnement à un utilisateur : unilatéral ; blocage possible |
| Publications | Critique d'une œuvre (note, texte, spoiler), liste (« top 10 Batman »), message | Rattachées à une entité du catalogue (S5) |
| Discussions et commentaires | Fils par œuvre, événement ou groupe ; commentaires sous publications | Balises « spoiler » obligatoires sur un événement récent |
| Réactions | Un jeu restreint (utile, j'aime) | Pas de compteur public avant k réactions |
| Listes | Publiques, partagées ou privées | Une liste publiée est une copie de références, jamais de l'inventaire |
| Groupes | Clubs de lecture, magasins (plus tard) | Modérateurs de groupe, règles affichées |
| Notifications | Réponses, mentions, abonnements, modération | Réglables ; aucune notification par e-mail sans consentement |
| Modération | Signalements, file de traitement, sanctions graduées, appel | Journal de modération ; rôles serveur (lot 3.3, `app.has_role`), sans accès aux données privées |
| Contributions | Corrections du catalogue proposées par les utilisateurs | Vers l'outil éditorial 4.10 ; jamais d'écriture directe dans le catalogue |
| Réputation | Ancienneté, contributions acceptées, critiques jugées utiles | Jamais fondée sur la valeur d'une collection ; non échangeable |

### B.4 Données (schéma `community`, réservé)
Tables :
- `profile_public` (référence S6) ;
- `follow`, `block` ;
- `post` (`kind`: review | list | message, `entity_ref` S5, `visibility`, `spoiler`) ;
- `comment`, `reaction` ;
- `list_item` (références au catalogue) ;
- `group`, `group_member` (rôle) ;
- `notification` ;
- `report`, `moderation_action` ;
- `contribution` (vers 4.10) ;
- `reputation_event`.

Chaque table porte `deleted_at` pour la suppression douce et le droit à l'effacement.

### B.5 Contrats
- **`CommunityPublish.v1`** : appelé par Collection ou Lecture **sur geste explicite**. Il crée une copie (référence d'œuvre, texte, note), jamais un lien vers les données privées. Le retrait côté utilisateur supprime la copie publique.
- **`CommunityFeed.v1`** : lecture des contenus publics, paginée et filtrée par entité ; consommée par Explorer, par exemple pour les critiques sur une fiche.
- **Contrats consommés** : S5 (entités), S4 (médias), S6 (identité), S3 (publication de signaux agrégés).
- **Interdits** : lecture de `app.*` ; les jointures entre `community` et `app` côté serveur.

### B.6 Confidentialité, sécurité, abus
- RLS par défaut : seul l'auteur modifie ses contenus ; la visibilité est contrôlée en base.
- **Limites de débit** sur les publications, commentaires et signalements. **Anti-spam** : nouveaux comptes limités, liens filtrés.
- **Harcèlement** : blocage, masquage, signalement, modération humaine. Les données de collection ne sont jamais exposées, ce qui supprime le risque de cibler une collection de valeur.
- **RGPD** : export et effacement des contenus (Phase 3, `export_my_data`) ; anonymisation des contributions acceptées ([`phase3/05`](../phase3/05-sauvegardes-confidentialite.md) § 3).
- **Juridique** : à valider avant l'ouverture : modération, statut d'hébergeur et obligations associées, mineurs (âge minimum), conditions d'utilisation.

### B.7 Parcours
1. Publier une critique depuis Lecture : « publier ma critique », aperçu de ce qui devient public, confirmation, puis copie publique.
2. Découvrir les critiques d'un événement depuis Explorer (`CommunityFeed`).
3. Signaler un message : file de modération, décision, notification, appel.

### B.8 Feuille de route par lots
| Lot | Contenu | Prérequis |
|---|---|---|
| C-0 | Ce document validé ; matrice des risques ; avis juridique | — |
| C-1 | Profils publics, abonnements, blocage | Phase 3 terminée (comptes, profils, RLS) |
| C-2 | Critiques et listes (`CommunityPublish`), lecture `CommunityFeed` dans Explorer | C-1 ; L1 (critiques issues de Lecture) ; 4.9 |
| C-3 | Commentaires, réactions, notifications | C-2 ; modération opérationnelle |
| C-4 | Modération complète, signalements, sanctions | 4.10 (outils), rôles 3.3 |
| C-5 | Groupes, contributions vers 4.10, réputation | C-4 |

### B.9 Stratégie de tests
- Isolation RLS : un utilisateur ne lit ni ne modifie les contenus privés d'un autre.
- Test statique : aucun accès `community` → `app`.
- Le retrait d'une publication la supprime partout.
- Limites de débit, blocage effectif dans les deux sens, contenu signalé masqué après décision, export et effacement complets.

### B.10 Décisions à prendre plus tard (non bloquantes aujourd'hui)
- Contenus autorisés : critiques seules au départ, ou discussions dès C-2 ?
- Âge minimum.
- Modération : interne, communautaire ou mixte.
- Réputation : visible ou non.
- Groupes de magasins : ouverts ou non.
