# Plan directeur 2.0 · 08 — Rebaseline produit : vision, architecture, roadmap

Date : 8 novembre 2026. Statut : **document de référence proposé** (D-54), à valider par l'utilisateur. Il ne remplace pas les décisions D-01 à D-53 ; il les réordonne autour de six piliers.

Légende utilisée partout :

| Marque | Sens |
|---|---|
| **[Existant]** | Fonctionne aujourd'hui dans l'application, testé |
| **[Partiel]** | Existe mais incomplet, ou seulement local, ou non branché |
| **[Implémenté localement]** | Code et tests présents, jamais validé sur un service réel (Supabase, Android publié) |
| **[Proposé]** | Seulement décrit ici : rien n'est codé |
| **[Bloqué]** | Dépend d'un élément externe (compte, licence, décision, service) |

Ce document ne refait pas les audits précédents ; il s'appuie sur [`01`](01-etat-des-lieux-et-audit.md), [`03`](03-plan-directeur-produit-ux-architecture.md), [`07`](07-conception-explorer-2.0-community.md), [`phase3/02`](../phase3/02-architecture-cible.md), [`phase4/00`](../phase4/00-explorer-2.0-cahier-des-charges.md) et [`phase4/09`](../phase4/09-systeme-visuel-documentaire.md).

---

## 1. Vision produit

**Panel est la plateforme de référence francophone des lecteurs et collectionneurs de comics** : savoir quoi lire, savoir ce qui sort, gérer ce qu'on possède, en parler avec d'autres lecteurs.

Panel **n'est pas une encyclopédie**. Chaque donnée de catalogue n'existe que parce qu'un usage la consomme : lire un événement, suivre une sortie, compléter une série, recommander, discuter.

Les quatre promesses qui différencient Panel :
1. **Lire sans se perdre.** Un événement dit en une seconde ce qu'il faut lire (essentiel), ce qui enrichit (recommandé) et ce qui complète (complet), avec la provenance de chaque choix.
2. **Ne rater aucune sortie utile.** Le calendrier part de *mes* séries, *mes* créateurs, *mes* événements.
3. **Une collection honnête et privée.** Local-first, finances jamais partagées, provenance des valeurs (D-02, F0, F1).
4. **Une communauté centrée sur la lecture**, pas sur la spéculation : critiques, listes, discussions par numéro et par événement, protection contre les spoilers.

## 2. Périmètre fonctionnel exact

**Inclus** : comics américains et internationaux (Marvel, DC, Image, Dark Horse, IDW, BOOM! Studios, Dynamite, Oni, Titan, Mad Cave, Vault, etc.), y compris leurs éditions françaises (Urban, Panini Comics, Delcourt Comics, etc., règle M1 de D-41) ; numéros, variantes, recueils (TPB, HC, omnibus) en tant que publications physiques.

**Exclu définitivement** :

| Exclusion | État actuel | Traitement |
|---|---|---|
| Manga (catalogue, calendrier, fonctions, catégories hybrides) | Masqué par défaut dans les Sorties (D-37, D-41) ; type `manga` encore présent dans le modèle (`MEDIA` de `catalog-core`, détection de format des sorties, case « Afficher le hors périmètre ») | Voir § 5 : arrêt de l'ingestion, données conservées et masquées, retrait de la case après export proposé |
| Manhwa, manhua, webtoons | Masqués (M2, D-41) | Idem manga |
| Lecteur de comics numérique, import de fichiers numériques (CBZ, CBR, PDF), lecture intégrée | Retirés en Phase 1 ; reste **uniquement** l'export en lecture seule de l'ancienne bibliothèque numérique (`exportStoredDigitalArchive`) | Conservé tel quel (protection des données) ; aucun ajout |
| Bande dessinée franco-belge | Masquée (M1, D-41) | Inchangé |

« Lecture » dans Panel signifie **suivi de lecture** (lu, à lire, journal, progression d'un événement), jamais affichage de pages.

## 3. Fonctionnalités existantes à conserver

| Domaine | Fonctionnalité | État |
|---|---|---|
| Collection | Fiches d'exemplaires physiques, wishlist, séries et complétion, emplacements (pièce → meuble → boîte → séparateur), scan code-barres, reconnaissance de couverture (dHash 64 bits), import CSV, CLZ et League of Comic Geeks (xlsx), cote automatique et historique, tableau de bord, corbeille annulable (D-36) | [Existant] |
| Finances | Coût réel, frais, lots, devises sans conversion, plus-values (F0, F1, D-27 à D-29) | [Existant] ; export Excel restant |
| Pull List | Séries suivies, prochaines sorties, filtre « ma pull list » (D-42) | [Existant] |
| Sorties | Calendrier, reports et annulations, sources Comic Vine (clé de l'utilisateur), Metron (identifiants de l'utilisateur), import, saisie ; conflits de sources (D-43) ; comics uniquement | [Existant] ; aucune source sous licence pour un service partagé : [Bloqué] |
| Lecture | État par œuvre (en cours, à lire), journal, prochain numéro (L1, D-30) | [Existant] |
| Explorer | Recherche tolérante (D-33), guides, fiches événement et numéro, galerie et visionneuse, outil de complétion des visuels, 9 événements recoupés et contrôlés (D-48 à D-52) | [Existant] |
| Community | Contrats Publish, Revoke, Feed et aperçu de l'envoi (D-46) ; brouillons locaux | [Partiel] : rien n'est publié faute de service |
| Données | Sauvegardes par domaine, fusion, instantanés, restauration, retour arrière (D-39) | [Existant] |
| Backend | 12 migrations Supabase, RLS, moteur de synchronisation, conflits, RGPD, limitation de débit, testés sur PGlite (124 tests) | [Implémenté localement] ; projet cloud : [Bloqué] (compte à créer par l'utilisateur) |
| Plateformes | PWA (`sw.js`), Android Capacitor (`android-app/`, APK 1.0 à 1.2) | [Existant] ; signature de publication : [Bloqué] |
| Qualité | 50 tests d'interface Edge/CDP, 34 tests de domaine, 124 tests base, contrôle des secrets, contrôle des frontières entre domaines | [Existant] |

## 4. Fonctionnalités à améliorer

| Pilier | Écart principal | Priorité |
|---|---|---|
| Event Center | Pas de niveaux essentiel / recommandé / complet sur les liens d'événement ; ordre recommandé configurable absent ; personnages d'événement non reliés au catalogue ; progression par niveau absente | P1 |
| Releases | Pas de vue hebdomadaire par semaine de sortie, pas de vue « Upcoming #1 », variantes non regroupées sous le numéro, FOC non exploité, historique des changements de date incomplet, notifications absentes | P1 |
| Catalogue | Une publication n'a pas d'identifiant canonique partagé entre Collection, Sorties et Explorer ; identifiants externes (Comic Vine, Metron, GCD, LoCG, UPC, ISBN) dispersés | **P0** (fondation) |
| Collection | Variantes au niveau exemplaire, numéros manquants calculés sur un catalogue fiable, détection de doublons à l'import LoCG | P1 |
| Characters & Creators | Pages dérivées de la collection seulement ; pas de rôles normalisés (scénario, dessin, encrage, couleur, lettrage, couverture) | P2 |
| Community | Aucun service actif ; pas de profils, abonnements, critiques, listes partagées, modération | P2 (après backend) |
| Discover & Editorial | Actualités non activées ; pas de CMS ; recommandations limitées aux guides proches | P2 |
| Design | Blanc éblouissant corrigé (b299255) ; mode sombre et affinage « inspiré d'Apple » en cours dans une session dédiée | P0 |
| Navigation | Sept entrées cibles (§ 10) à confronter à la navigation 4.9 (D-42) | P1 |

## 5. Fonctionnalités à supprimer ou à exclure (retrait propre)

Règle : **aucune suppression aveugle**. Chaque retrait suit : inventaire → masquage → export proposé à l'utilisateur → retrait du code d'interface → conservation des données en stockage.

| Élément | Emplacement | Étape 1 (sans risque) | Étape 2 (après export proposé) |
|---|---|---|---|
| Type `manga` du catalogue | `domains/explorer/catalog-core.js` (`MEDIA`) | Refuser toute nouvelle entrée `manga` à la validation ; marquer `scope: 'out'` | Retirer la valeur du modèle quand aucune donnée ne l'utilise |
| Détection de format manga des sorties | `index.html` (règles de périmètre D-37, D-41) | Ne plus ingérer depuis les connecteurs (filtre à l'import) | Supprimer la case « Afficher le hors périmètre » ; garder un compteur et un export des éléments masqués |
| Liste d'éditeurs manga | Règles de périmètre | Conservée comme **liste d'exclusion** (elle protège le périmètre) | — |
| Exemplaires manga éventuels dans la collection de l'utilisateur | Données locales | Jamais modifiés ; badge « hors périmètre » | Export dédié proposé ; aucune suppression automatique |
| Ancienne bibliothèque numérique | IndexedDB `pages`, clés `panel_folders`, etc. | Conservée, export ZIP en lecture seule | Aucune ; suppression seulement sur demande explicite de l'utilisateur |

## 6. Analyse comparative : League of Comic Geeks

Sources : notes de développement du centre d'aide ([intercom.help/comicgeeks](https://intercom.help/comicgeeks/en/articles/9436409-development-notes)), fiche App Store, articles de presse (§ Sources). Le site bloque la lecture automatisée (HTTP 403) : **aucune page n'a été collectée**, et son API est privée (jetons d'accès ; les clients open source Himon et locg-cli sont archivés).

| Mécanique LoCG | Gratuit / payant | Ce que Panel en retient | État Panel |
|---|---|---|---|
| New Comics par semaine de sortie, par FOC ou par mois de catalogue distributeur ; filtres #1, facsimilés, omnibus, créateur | Gratuit | Vue hebdomadaire + vue FOC + « Upcoming #1 » | [Partiel] / [Proposé] |
| Variantes regroupées sous la couverture principale, type, exclusivité (revendeur, convention) | Gratuit | Modèle `variant` rattaché au numéro (§ 9) | [Proposé] |
| Pull List hebdomadaire, abonnement à une série ou à un **créateur**, export | Gratuit | Abonnement série + créateur + événement | [Partiel] (séries seulement) |
| Automatisation : numéro tiré ajouté à la collection ou à la wishlist à la sortie ; synchronisation calendrier | Pro | Proposé en gratuit local (pas de coût serveur) ; synchronisation calendrier (ICS) en option premium | [Proposé] |
| Alertes de changement de date et retards | Pro/Patron | Historique des sollicitations (déjà partiel avec reports et annulations) | [Partiel] |
| Collection : boîte, magasin, grading, exemplaires multiples, statistiques, valeurs | Pro/Patron | **Déjà gratuit dans Panel** (emplacements, finances) : avantage concurrentiel | [Existant] |
| Read List, journal de lecture, statistiques de lecture | Journal : Pro | Lecture L1 gratuite | [Existant] |
| Listes communautaires (ordres de lecture, tops), clonage | Pro/Patron | Listes partagées avec provenance | [Proposé] |
| Critiques (longueur minimale, commentaires désactivables), notes au demi-point, onglets communauté / suivis / personnel | Gratuit | Repris, avec spoilers masqués | [Proposé] |
| Social : suivre, activité, commentaires en fil, mentions, masquer des mots ou des utilisateurs (90 jours), bloquer, signaler, messages privés, flou spoiler et NSFW | Gratuit | Repris intégralement ; modération automatisée en plus | [Proposé] |
| Pick of the Week (vote du mercredi au samedi) | Gratuit | « Coup de cœur de la semaine » communautaire | [Proposé] |
| Key issues (indicateurs, filtres, comptes) | Pro/Patron | Clés **documentées et sourcées** seulement, pas d'alerte spéculative | [Proposé] |
| Événements : ordres de lecture et listes de contrôle | Gratuit | **Point fort de Panel** : niveaux de lecture, provenance, recoupement (D-51, D-52) | [Partiel] |

Limites de LoCG que Panel peut dépasser [Interp.] : interface surtout anglophone ; ordres d'événement sans niveaux de lecture ni provenance ; fonctions de collection avancées payantes ; pas de contrôle de fiabilité visible.

## 7. Reverse engineering des dépôts GitHub

Activité et licence lues par l'API GitHub le 8 novembre 2026 ; modèles inspectés dans le code source (pas seulement le README). **Aucun code n'est copié** : les dépôts GPL-3.0 ne peuvent pas être intégrés dans Panel sans le placer sous GPL ; seuls des concepts sont repris et reconstruits.

| Dépôt | Activité | Licence | Inspecté | Ce qui inspire Panel | À reconstruire proprement |
|---|---|---|---|---|---|
| **Metron-Project/metron** (site Django de la base Metron) | 154 ★, poussé le 7 nov. 2026 | GPL-3.0 | `comicsdb/models/{issue,series,variant,credits,arc,attribution}.py`, `pull_list`, `reading_lists`, `user_collection`, `wish_list`, `issue_ratings` | Issue unique par `(series, number)` ; dates **couverture, magasin, FOC** distinctes ; `cover_hash` ; `Variant` rattaché à l'issue (nom, prix, SKU, UPC) ; `Credits` issue × créateur × rôles multiples ; `Series` unique par `(publisher, name, volume, series_type)` avec `year_began` ; `Attribution` générique (source + URL) ; historique des modifications ; **ReadingList** typée (événement, histoire, personnage, équipe, créateur, maître) avec source d'attribution (CBRO, CMRO, CBH, LoCG…) et items ordonnés typés **Prologue / Core / Tie-in / Epilogue** ; PullList par série ; CollectionItem (quantité, format, grade, société de grading, achat, emplacement, lu, note) ; WishList (statut, priorité, grade voulu, prix max) | Modèle relationnel Postgres propre à Panel (§ 9), niveaux de lecture en plus des rôles, provenance par relation (pas seulement par objet) |
| **Metron-Project/mokkari** | 20 ★, actif | GPL-3.0 | Client de l'API Metron (compte, limite de débit) | Contrat d'API Metron : candidat n° 1 pour les sorties | Client JavaScript léger côté serveur Panel |
| **GrandComicsDatabase/gcd-django** | 124 ★, poussé le 8 nov. 2026 | GPL-3.0 (code) ; données CC BY-SA 4.0 | `apps/gcd/models/{issue,series,seriesbond,story,reprint}.py` | Variante = issue avec `variant_of` et `variant_name` ; `key_date` triable + `on_sale_date` avec indicateur d'incertitude ; `SeriesBond` (suite, renumérotation) ; `Reprint` story → story pour relier recueils et numéros ; `is_comics_publication` | Relation recueil → numéros contenus ; dates incertaines marquées |
| **comictagger/comictagger** | 846 ★, actif | Apache-2.0 | `comictaggerlib/imagehasher.py`, `issueidentifier.py` | Identification de couverture : hachages moyen, différence et perceptuel 64 bits ; distance de Hamming ; seuils (≤ 8 quasi certain, ≤ 16 correspondance, ≤ 12 pour une variante, écart minimal de 4 avec le second candidat) ; recadrage des bordures et des doubles pages | Panel a déjà un dHash 64 bits (test 4) : ajouter les seuils, l'écart au second candidat et le recadrage ; code réécrit (licence compatible mais inutile de l'importer) |
| **mylar3/mylar3** | 1 468 ★, poussé en mars 2026 | GPL-3.0 | `mylar/locg.py`, `weeklypull.py` | Liste hebdomadaire stockée par (semaine, année) avec statut par numéro | **Contre-exemple** : la liste vient d'un agrégateur tiers non documenté qui reprend des données LoCG ; dépendance fragile et droits incertains : Panel n'en dépendra pas |
| **DieselTech/CBL-ReadingLists** | 226 ★, actif | **Aucune licence** | Fichiers `.cbl` (XML) | Format d'échange simple : liste de `Book` (série, numéro, volume = année de début, année) + identifiants par base (`Database Name="cv"`) | Format d'**export** Panel compatible ; **aucun import** de ces listes (elles reproduisent CBRO, LoCG, CMRO) |
| **Kareadita/Kavita**, **gotson/komga** | 12 076 ★ / 6 832 ★ | GPL-3.0 / MIT | Lecteurs numériques | Import CBL de listes de lecture | Hors périmètre (lecteurs numériques) : rien n'est repris |
| **Buried-In-Code/Himon**, **hsukenooi/locg-cli** | Archivés | MIT | Client d'une API LoCG privée (jeton) | Confirme l'absence d'API publique LoCG | Aucune intégration LoCG ; import par fichier exporté par l'utilisateur seulement ([Existant]) |
| **Metron-Project/Simyan** | 17 ★ | GPL-3.0 | Client Comic Vine | — | Comic Vine reste réservé à la clé personnelle de l'utilisateur (usage non commercial) |

Recherche GitHub générique (« pull list », « reading order ») : seulement des projets personnels inactifs ou sans licence ; rien à reprendre.

## 8. Architecture technique cible

Principe : **évolution, pas réécriture**. Le monofichier `index.html` reste l'hôte ; les règles métier continuent de migrer dans `domains/**` (testables sous Node, intégrés par `sync-domains`) ; le serveur est Supabase/Postgres (D-03) déjà préparé.

```
Client (PWA + Android Capacitor)
 ├─ Hôte d'interface : index.html (navigation, rendu)
 ├─ Domaines purs (domains/**) : catalog-core, media-core, events, releases*, collection*, community/policy-core, reliability
 ├─ Stockage local-first : IndexedDB + localStorage (existant) → moteur de synchronisation (implémenté localement)
 └─ Sauvegardes par domaine (existant)
Serveur (Supabase, [Bloqué] : projet à créer)
 ├─ Schéma app : comptes, profils, appareils, préférences, rôles (migrations 1-12)
 ├─ Schéma catalog* : éditeurs, séries, numéros, variantes, éditions, identifiants externes, provenance
 ├─ Schéma editorial* : événements, ordres de lecture, guides, articles, actualités agrégées
 ├─ Schéma community* : profils publics, abonnements, publications, commentaires, réactions, critiques, listes, groupes, messages, signalements
 ├─ Fonctions : ingestion des sources (planifiées), notifications, modération automatisée
 └─ Stockage d'images (R2, D-04) : seulement pour images autorisées
(* = proposé)
```

Règles transverses (déjà en vigueur) : frontières entre domaines contrôlées (`check-boundaries --strict`) ; aucun domaine n'écrit les données d'un autre (contrats S1 à S6) ; les données personnelles restent locales tant que l'utilisateur ne synchronise pas ; finances jamais partagées.

## 9. Modèle de données cible

Toutes les tables catalogue portent `id` (UUID stable Panel), `created_at`, `updated_at` et un historique ; chaque **relation** porte sa provenance.

### 9.1 Catalogue (schéma `catalog`, [Proposé])

| Entité | Champs clés | Unicité |
|---|---|---|
| `publisher`, `imprint` | nom, pays, parent | nom normalisé |
| `series` | éditeur, nom, `volume`, `year_began`, `year_end`, type (en cours, mini-série, one-shot, recueil), langue, statut | (éditeur, nom normalisé, année de début, type) |
| `issue` | série, numéro (texte), titre, `cover_date`, `store_date`, `foc_date`, `date_uncertain`, prix, UPC, ISBN, pages, résumé | (série, numéro) |
| `variant` | issue, nom, type (ratio, convention, revendeur, virgin, foil…), ratio, exclusivité, UPC/SKU | (issue, nom normalisé) |
| `edition` (recueil) | série de recueil, format (TPB, HC, omnibus), ISBN, langue, éditeur VF | ISBN |
| `edition_content` | édition → issues contenues (ordre) | (édition, issue) |
| `series_bond` | série → série (suite, renumérotation, relance) | — |
| `external_id` | entité, système (`cv`, `metron`, `gcd`, `locg`, `upc`, `isbn`), valeur | (système, valeur) |
| `character`, `team` | nom, alias, univers | nom + univers |
| `creator` | nom, alias | nom normalisé |
| `credit` | issue × créateur × rôle (scénario, dessin, encrage, couleur, lettrage, couverture, éditeur) | (issue, créateur, rôle) |
| `appearance` | issue × personnage/équipe, type (premier, mort, retour, mention) | (issue, personnage) |
| `claim` (provenance) | entité ou relation ciblée, source, `retrieved_at`, statut (relevé, concordant, corroboré, vérifié, contesté), explication, remplacé par | historique conservé |

Une publication n'est **jamais dupliquée** : un événement, une liste, une pull list ou un exemplaire **référencent** `issue.id` (ou `variant.id`). Les identifiants externes permettent la déduplication à l'import (LoCG, CLZ, Comic Vine, Metron).

### 9.2 Événements et ordres de lecture (schéma `editorial`)

| Entité | Champs |
|---|---|
| `event` | titre, univers, éditeur, période, contexte, conséquences, statut éditorial |
| `event_link` | événement × issue (ou série + plage), **rôle** (prélude, cœur, tie-in, épilogue, conséquence, lié), **niveau** (essentiel, recommandé, complet), justification, provenance (`claim`) |
| `reading_order` | événement ou thème, type (**publication**, **chronologique**, **recommandé Panel**, **référence externe**), auteur, version, statut |
| `reading_order_item` | ordre × issue, position, niveau, note |
| `event_character` | événement × personnage, importance |

Le modèle local actuel (`event` de `media-core`, D-49 à D-52) est le prototype de ce schéma ; il sera converti sans perte (les `links` deviennent des `event_link`, les `sources` et `verifications` des `claim`).

### 9.3 Utilisateur (schémas `app` existant + domaines personnels)

`collection_item` (exemplaire : issue/variante, état, grade, achat, lot, emplacement, lu, note) [Existant en local] ; `pull_subscription` (série, créateur ou événement ; préférence de variantes) [Partiel] ; `wishlist_item` (priorité, prix max) [Existant] ; `read_log` (date, relecture) [Existant] ; `event_progress` (événement × niveau × issues lues, dérivé de `read_log`) [Proposé] ; `notification_pref` [Proposé].

### 9.4 Sorties

`release_week` (vue calculée sur `store_date`), `solicitation_snapshot` (issue, date de relevé, dates et prix annoncés → historique des reports, annulations, changements) [Partiel : reports et annulations existent], `foc_reminder` [Proposé].

### 9.5 Communauté et contenus

`profile` (pseudo, bio, visibilité publique/privée), `follow`, `post`, `comment` (fil, parent), `reaction`, `review` (issue/série/événement, note au demi-point, spoiler), `list` (partagée, clonable, provenance), `group`, `group_member`, `thread` (attaché à événement / issue / série), `message`, `report`, `moderation_action`, `block`, `mute`, `notification` ; `news_item` (titre, résumé court, lien, source, date — **lien sortant, pas de reproduction**), `article` (CMS Panel, auteur, statut, relecture).

## 10. Parcours utilisateurs principaux

| Parcours | Étapes | État |
|---|---|---|
| « Je veux lire Civil War » | Events → fiche → niveau Essentiel (7 + x numéros) → marquer lus → progression → passer à Recommandé | [Partiel] (fiche et progression des guides existent ; niveaux absents) |
| « Qu'est-ce qui sort mercredi ? » | Releases → semaine → filtre éditeurs suivis → variantes repliées → tirer dans la pull list | [Partiel] |
| « Quelles nouvelles séries commencent ? » | Releases → Upcoming #1 → suivre la série → notification à la sortie | [Proposé] |
| « J'ai acheté mes comics » | Pull list de la semaine → cocher acheté → exemplaire créé (prix, magasin, emplacement) | [Partiel] |
| « Il me manque quoi ? » | Collection → série → numéros manquants → wishlist | [Existant] (fiabilité dépend du catalogue) |
| « Je donne mon avis » | Fiche numéro → critique (spoiler masqué) → fil de discussion | [Proposé], [Bloqué] par le backend |
| « Je découvre » | Home → recommandations (séries proches de mes lectures, créateurs suivis, tendances) | [Partiel] |

Navigation proposée, confrontée à la navigation 4.9 (D-42) :

| Cible | Correspond aujourd'hui à | Action |
|---|---|---|
| Home | Accueil Explorer | Recentrer sur « ma semaine » (sorties suivies, progression, activité) |
| Discover | Recherche, univers, guides, personnages, créateurs | Séparer de Home |
| Events | Section Événements d'Explorer | Promouvoir en entrée de premier niveau |
| Releases | Sorties & calendrier | Renommer, ajouter Upcoming #1 |
| Collection | Ma collection, Séries, Pull List, Wishlist, Statistiques, Finances, Lecture | Regrouper en sous-onglets |
| Community | Communauté (brouillons) | Activer après backend |
| Profile | Paramètres, compte, sauvegardes | Nouveau regroupement |

Mobile : barre à cinq boutons (Home, Events, Releases, Collection, Community) ; Discover par la recherche, Profile par l'avatar.

## 11. Architecture de la communauté

- **Domaine indépendant** (D-15) : `domains/community/policy-core.js` contient déjà les contrats Publish (copie filtrée par liste blanche, consentement), Revoke et Feed [Implémenté localement].
- **Graphe social** : `follow` asymétrique ; profils publics ou privés (abonnement sur demande) ; blocage et masquage (utilisateurs, mots, durée).
- **Contenus** : publications, critiques, listes, fils attachés à une entité du catalogue (l'`issue.id` unique évite les discussions dupliquées).
- **Feed** : abonnements + groupes + entités suivies ; tri chronologique par défaut (pas d'algorithme opaque au lancement).
- **Spoilers** : drapeau obligatoire sur critiques et commentaires d'un numéro paru depuis moins de N jours ; flou automatique ; préférence par utilisateur.
- **Modération** : automatisée (filtres de mots, limitation de débit déjà codée en base (D-45), détection de liens, scores de signalement) + outils humains (file de signalements, actions motivées et journalisées, rôles `moderator` déjà prévus (D-38)), recours.
- **Confidentialité** : la collection, les finances et les emplacements ne sont **jamais** publiés ; une « collection publique » est une **copie filtrée** choisie par l'utilisateur (contrat Publish).
- **Dépendances** : backend actif (3.2), comptes (3.3), CSP et hébergement, documents juridiques (CGU, politique de modération) : [Bloqué].

## 12. Architecture du calendrier des sorties

- **Source de vérité** : `issue.store_date` + `foc_date` + `solicitation_snapshot` (historique).
- **Ingestion** (serveur, planifiée) : connecteurs indépendants, chacun avec licence et limites documentées ; fusion par `external_id` puis par (série, numéro) ; conflits conservés (mécanisme D-43 réutilisé).
- **Sources** :

| Source | Données | Conditions | Statut |
|---|---|---|---|
| Metron API | Numéros, dates magasin et FOC, variantes, crédits | Compte, 20 requêtes/min, quota ; conditions de réutilisation à confirmer | Candidat principal : [Bloqué] (compte de service Panel et lecture des conditions) |
| Comic Vine | Numéros, dates | Strictement non commercial | Clé personnelle de l'utilisateur seulement [Existant] |
| GCD (dumps) | Fonds de catalogue, variantes, recueils | CC BY-SA 4.0 (partage à l'identique) | Fonds de catalogue, pas pour l'à-venir ; avis juridique requis |
| collection.id | Recherche publique, CC BY-SA 4.0 | Pas d'aspiration massive | Vérification ponctuelle seulement (D-52) |
| Sollicitations éditeurs (communiqués) | Annonces, #1, équipes | Droits des éditeurs | Saisie éditoriale manuelle |
| Distributeurs (Lunar, PRH) | Catalogues | Accord commercial | [Bloqué] |
| LoCG | — | Pas d'API publique, pas de collecte | Exclu ; import de l'export personnel de l'utilisateur seulement |

- **Vues** : semaine (mercredi aux États-Unis, adaptation au rythme VF), mois, FOC, **Upcoming #1** (numéro = 1 ou 0 et série nouvelle selon `year_began`), mini-séries, one-shots, variantes repliées sous le numéro, filtres éditeur / format / créateur, « mes sorties ».
- **États par numéro** pour l'utilisateur : tiré (pull), acheté, manqué (date passée sans achat), attendu, reporté, annulé.
- **Notifications** : sortie d'un numéro tiré, FOC proche, changement de date, nouveau #1 d'un créateur suivi ; locales d'abord (PWA, Android), push après backend.
- **Comics uniquement** : filtre de périmètre appliqué **à l'ingestion** (§ 5).

## 13. Architecture de l'Event Center

- Fiche : contexte, personnages, série principale, liens par **rôle** et par **niveau**, conséquences, ordres séparés (publication, chronologique, recommandé Panel, référence externe), qualité documentaire (D-51, D-52), progression.
- **Niveaux** : *Essentiel* = série principale + numéros sans lesquels l'histoire ne se comprend pas ; *Recommandé* = tie-ins qui éclairent l'intrigue principale ; *Complet* = tout ce qui est rattaché. Chaque niveau est une **sélection éditoriale Panel**, affichée comme telle avec sa justification, jamais comme un fait bibliographique.
- **Ordres de lecture** : versionnés, auteur et date ; l'ordre recommandé Panel est construit par Panel (jamais recopié d'un guide tiers) ; un ordre externe n'est cité que par lien.
- **Traçabilité** : chaque lien porte ses `claim` (sources, statut de fiabilité, explication) ; une modification crée une nouvelle version.
- **Progression** : dérivée du journal de lecture (domaine Lecture, A3) ; « prochain numéro à lire » selon le niveau choisi ; aucun écrit direct d'Explorer dans la collection.
- **Configuration** : l'utilisateur choisit un niveau et un ordre ; il peut masquer un tie-in ; préférences locales.

## 14. Stratégie de données et de sources

1. **Faits** (titres, numéros, dates, crédits) : sources bibliographiques sous licence (Metron, GCD, collection.id) avec attribution ; jamais de collecte massive non autorisée.
2. **Sélections éditoriales** (niveaux, ordres recommandés, événements) : produites par Panel, sourcées, révisées.
3. **Contenus tiers** (actualités, critiques externes) : titre + résumé court rédigé par Panel + lien sortant + source ; aucune reproduction.
4. **Images** : uniquement autorisées (D-48 à D-52) ; sinon remplacements typographiques. Couvertures de numéros : [Bloqué] tant qu'aucune licence n'est obtenue.
5. **Données utilisateur** : locales par défaut ; synchronisées avec consentement ; jamais transmises à un tiers.
6. **Fiabilité** : statuts relevé / concordant / corroboré / vérifié / contesté (D-52) appliqués à tout le catalogue.
7. **Juridique** : GPL des projets étudiés → concepts seulement ; CC BY-SA → obligations de partage à l'identique pour une base dérivée, avis requis avant ouverture publique.

## 15. Roadmap ordonnée

| Phase | Contenu | Dépend de | Bloqué par |
|---|---|---|---|
| **R0** Assainissement | Mode sombre et design (session dédiée) ; inventaire manga étape 1 (§ 5) ; navigation à sept entrées sans réécrire les écrans | — | — |
| **R1** Catalogue canonique local | `catalog-core` étendu : identifiants Panel stables, `external_id`, variantes rattachées, recueils et contenus, déduplication, migration des fiches existantes vers des références `issue.id` (sans perte, réversible) | R0 | — |
| **R2** Event Center v2 | Niveaux de lecture, rôles, ordres versionnés, progression par niveau, personnages d'événement ; conversion des 9 événements | R1 | — |
| **R3** Releases v2 | Vues semaine, FOC, Upcoming #1, variantes repliées, états tiré / acheté / manqué, historique des sollicitations, notifications locales, abonnement créateur et événement | R1 | Source partagée : [Bloqué] (Metron) ; fonctionne avec les sources personnelles existantes |
| **R4** Collection & Pull List v2 | Import LoCG/CLZ avec déduplication par identifiants, variantes au niveau exemplaire, manquants fiables, automatisation pull → collection | R1, R3 | — |
| **R5** Characters & Creators | Pages de découverte (rôles normalisés, séries, lectures recommandées, affiliations) alimentant les recommandations | R1, R2 | Données de crédits : source sous licence |
| **R6** Backend actif | Lots 3.2 à 3.7 : projet Supabase, comptes, synchronisation, validation Web et Android | — | **Projet cloud et compte à créer par l'utilisateur** |
| **R7** Catalogue partagé | Schémas `catalog` et `editorial` côté serveur, ingestion planifiée, modération des contributions | R1, R6 | Licence des sources, avis juridique |
| **R8** Community MVP | Profils, abonnements, critiques, listes, fils par entité, spoilers, signalements, modération | R6, R7 | CGU, politique de modération |
| **R9** Discover & Editorial | Agrégation d'actualités (flux RSS publics, lien sortant), CMS d'articles, recommandations, tendances | R6, R8 | Sources d'actualités autorisées |
| **R10** Bêta privée et freemium | Bêta fermée francophone, offre gratuite complète pour l'usage personnel, premium pour confort (synchronisation calendrier, exports étendus, statistiques avancées) | R6 à R9 | Hébergement, paiement (décision utilisateur) |

## 16. Dépendances entre phases

```
R0 ──► R1 ──┬──► R2 ──► R5
            ├──► R3 ──► R4
            └──────────────► R7 ──► R8 ──► R9 ──► R10
R6 (bloqué : compte cloud) ───┘
```

R1 est la fondation : sans identifiant canonique, Events, Releases et Collection divergeraient. R6 peut avancer en parallèle dès que l'utilisateur crée le projet cloud.

## 17. Risques

| Risque | Nature | Probabilité / impact | Atténuation |
|---|---|---|---|
| Aucune source de sorties sous licence pour un service partagé | Données, juridique | Élevée / bloquant pour R7 | Metron à confirmer ; sources personnelles en attendant ; saisie éditoriale |
| Couvertures non autorisées | Juridique | Élevée / image du produit | Remplacements soignés ; démarches de licence ; images de l'utilisateur seulement en privé |
| Migration vers `issue.id` corrompant une collection | Technique | Moyenne / critique | Migration additive, instantané préalable, restauration testée, aucune suppression (règle existante) |
| Monofichier de 16 400 lignes | Dette technique | Certaine / ralentit | Extraction continue vers `domains/**`, frontières contrôlées |
| CC BY-SA contaminant une base dérivée | Juridique | Moyenne | Séparer faits sourcés et contenus Panel ; avis juridique avant R7 |
| Modération insuffisante au lancement | Communauté | Moyenne / réputation | Bêta privée, limitation de débit (D-45), file de signalements avant ouverture |
| Dépendance à un agrégateur non documenté (cas Mylar3) | Technique | — | Interdit par principe (§ 14) |
| Confusion sélection éditoriale / fait | Confiance | Moyenne | Étiquetage systématique (D-52) |

## 18. Critères d'acceptation par phase

| Phase | Critères |
|---|---|
| R0 | Mode sombre et clair lisibles (contraste AA) ; aucun nouvel élément manga ingéré ; données manga existantes intactes et exportables ; 50/50 tests d'interface |
| R1 | Chaque exemplaire, lien d'événement et sortie référence un `issue.id` ; zéro doublon sur un import LoCG réimporté deux fois ; migration réversible testée sur une copie ; tests de domaine dédiés |
| R2 | Les 9 événements ont des niveaux justifiés ; un lecteur voit le nombre de numéros essentiels en moins d'un écran ; progression par niveau ; aucun ordre tiers reproduit |
| R3 | Vue semaine, FOC, Upcoming #1 ; variantes repliées ; historique d'un report visible ; notifications locales déclenchées en test ; aucun manga |
| R4 | Import avec rapport (ajoutés, fusionnés, ignorés) ; numéros manquants exacts sur une série de référence ; automatisation pull → collection annulable |
| R5 | Fiche créateur : rôles, séries, lectures recommandées ; aucune page sans usage |
| R6 | Matrice V1 à V14 validée sur Supabase réel, Web et Android |
| R7 | Chaque fait porte une source et une licence ; ingestion rejouable ; contributions modérées |
| R8 | Spoilers masqués par défaut ; signalement traité de bout en bout ; collection jamais publiée sans copie filtrée consentie |
| R9 | Chaque actualité : source, date, lien sortant, aucun texte reproduit |
| R10 | Bêta fermée avec retours ; offre gratuite sans régression des fonctions existantes |

**Stratégie de tests** (inchangée dans son principe) : règles métier en tests de domaine Node (rapides, sans navigateur) ; tests d'interface Edge/CDP seulement pour les parcours ; tests de base PGlite pour chaque migration ; fixtures **fictives** uniquement ; une suite d'interface à la fois ; contrôle des secrets et des frontières à chaque commit.

## Sources (consultées le 8 novembre 2026)
- League of Comic Geeks, notes de développement : https://intercom.help/comicgeeks/en/articles/9436409-development-notes
- League of Comic Geeks, abonnements : https://intercom.help/comicgeeks/en/collections/9546267-pro-patron-subscriptions
- MobileSyrup, présentation de LoCG : https://mobilesyrup.com/2017/05/27/league-of-comic-geeks/
- CLZ, refonte de la pull list (NCBD) : https://clz.com/blog/clz-comics-web/2025/01/15/re-design-of-pull-list-feature-and-now-called-ncbd
- Dépôts : https://github.com/Metron-Project/metron, https://github.com/Metron-Project/mokkari, https://github.com/GrandComicsDatabase/gcd-django, https://github.com/comictagger/comictagger, https://github.com/mylar3/mylar3, https://github.com/DieselTech/CBL-ReadingLists, https://github.com/Buried-In-Code/Himon, https://github.com/hsukenooi/locg-cli, https://github.com/Metron-Project/Simyan, https://github.com/Kareadita/Kavita, https://github.com/gotson/komga
