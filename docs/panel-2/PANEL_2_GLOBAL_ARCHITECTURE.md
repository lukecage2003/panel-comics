# PANEL 2.0 — Architecture globale

Ce document place les neuf modules de PANEL 2.0 dans l'architecture **actuelle**. Il part de l'audit ([`PANEL_2_REPOSITORY_AUDIT.md`](PANEL_2_REPOSITORY_AUDIT.md)) et des décisions déjà prises : client actuel conservé (PRD-D1), Supabase comme backend unique (PRD-D2), monolithe modulaire (PRD-D8).

## 1. L'hypothèse de travail, confrontée au code

L'organisation proposée (CORE, LIBRARY, INTELLIGENCE, COMMUNITY, OPEN) est **pertinente comme regroupement conceptuel**, à deux corrections près :

1. **Pas de nouveau domaine technique « INTELLIGENCE ».** Le code a déjà quatre domaines produit séparés par des contrats : Collection, Lecture, Explorer, Communauté, plus les Sorties et le catalogue commun. Source, Canon et Multiverse produisent de la connaissance que l'on consulte **dans Explorer** : ce sont des sous-domaines de connaissance servis par Explorer, pas une cinquième application. Lab et Debate sont des activités communautaires : ils vivent dans Communauté.
2. **Edition Intelligence n'est pas un module isolé.** C'est l'extension du **catalogue commun** déjà partagé par Collection, Sorties et Explorer (test 52, `domains/catalog/publication-core.js`). Le placer ailleurs créerait un deuxième catalogue.

## 2. Architecture recommandée

```
┌──────────────────────────────── CLIENT EXISTANT (index.html + domains/**, PWA, Android) ────────────────────────────────┐
│                                                                                                                         │
│  COLLECTION        LECTURE          SORTIES           EXPLORER (connaissance)                 COMMUNAUTÉ                 │
│  exemplaires       journal          calendrier        catalogue, guides, événements           profils, fil, planches      │
│  emplacements      séries en cours  Pull List         + SOURCE (preuves, fiabilité)           + DEBATE (débats structurés)│
│  cote, finances                     Wishlist          + CANON (continuités, versions)         + LAB (dossiers de recherche)│
│                                                       + MULTIVERSE (adaptations)              + ID (identité, expertise)  │
│                                                       + SIGNAL (tendances, sources séparées)                              │
│                                                                                                                         │
│  ───────────── CATALOGUE COMMUN + EDITION INTELLIGENCE (œuvres, publications, éditions, variantes, VO/VF) ─────────────── │
│  ───────────── CORE : contrats S1–S6, sauvegardes par domaine, provenance, notifications, recherche, i18n ───────────────  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │ synchronisation (backend/sync-engine)
┌──────────────────────────────── BACKEND SUPABASE (préparé) ─────────────────────────────────────────────────────────────┐
│ app (existant) · community (existant, 0013) · catalog (proposé PRD) · editorial (proposé PRD) → étendu en `knowledge`     │
│ moderation · notify · billing (proposés PRD) · Edge Functions · R2 pour les images autorisées                            │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │ plus tard
                                    PANEL OPEN : API en lecture, widgets, exports (Edge Functions + clés + quotas)
```

## 3. Domaines et responsabilités

| Domaine (existant) | Responsabilité actuelle | Ajout PANEL 2.0 | Ne fait pas |
|---|---|---|---|
| **Core** | Contrats S1–S6, sauvegardes par domaine, provenance par champ, recherche locale, notifications locales | Identité serveur (comptes), journal des actions sensibles, internationalisation, recherche serveur (`pg_trgm`, PRD-D5) | Aucune logique métier propre à un module |
| **Catalogue commun** | Éditeurs, séries, numéros, variantes, publications partagés par Collection, Sorties, Explorer | **Edition Intelligence** : œuvres (contenus), éditions (TPB, HC, omnibus…), traductions VO/VF, contenus regroupés, dates par territoire | Ne connaît pas les exemplaires d'un utilisateur (ils restent dans Collection) |
| **Collection** | Exemplaires physiques, variantes possédées, emplacements, finances | Rattache un exemplaire à une édition précise du catalogue | Ne publie rien sans copie en liste blanche |
| **Lecture** | Journal, séries en cours | Fournit des agrégats **consentis** à Signal | Ne partage pas l'historique individuel |
| **Sorties** | Calendrier, Pull List, Wishlist | Dates par territoire venues d'Edition Intelligence | — |
| **Explorer** | Catalogue, guides, événements, recoupement, actualités, dossiers | Affiche **Source**, **Canon**, **Multiverse**, **Signal** | Ne lit jamais Collection (contrat S1) ; ne devient pas un Atlas |
| **Communauté** | Profils, fil, planches, stories, rangs, politique de partage, modération (serveur) | **Debate**, **Lab**, **ID** | Ne transforme pas la popularité en vérité |
| **Open** (nouveau, mince) | — | API en lecture seule, widgets, exports | N'expose jamais de donnée personnelle sans consentement |

## 4. Flux entre modules

| Flux | De → vers | Contenu | Règle |
|---|---|---|---|
| F1 | Source → Edition Intelligence, Canon, Multiverse | Affirmations avec sources et statut | Toute affirmation importante cite au moins une source ; sinon statut « hypothèse » |
| F2 | Edition Intelligence → Collection, Sorties | Éditions, variantes, correspondances VO/VF | Correspondance incertaine affichée comme telle, jamais fusionnée d'office |
| F3 | Canon → Explorer | Continuités, versions de personnages, événements | Les contradictions sont exposées, pas aplaties |
| F4 | Lab → Source | Une recherche validée peut proposer des affirmations | Passe par la même vérification que toute contribution |
| F5 | Debate → Lab / Source | Synthèse d'un débat, arguments sourcés | Le vote ne change pas le statut documentaire |
| F6 | Source, Lab, Debate → ID | Contributions vérifiées, recherches publiées, arguments retenus | Réputation par critères transparents, pas par volume |
| F7 | Lecture, Collection → Signal | Agrégats anonymes, avec consentement explicite | Toujours étiquetés « observé sur PANEL » |
| F8 | Actualités, sources externes → Signal | Données externes | Toujours étiquetées « externe », avec la source |
| F9 | Catalogue, Source, Canon → Open | Lecture publique selon les licences | Rien sous licence restrictive ; quotas |

## 5. Dépendances

```
Comptes en ligne (lots 3.2–3.3)
   └─> ID minimal (attribution des contributions)
         └─> Source ─┬─> Edition Intelligence ──> Collection, Sorties
                     ├─> Canon ──> Multiverse
                     ├─> Lab
                     └─> Debate
Lecture + Collection (consentement) ──> Signal
Source + Catalogue + licences vérifiées ──> Open
```

Deux dépendances priment sur l'ordre initialement proposé :

- **Les comptes en ligne d'abord.** Sans identité, aucune contribution n'est traçable : Source ne peut pas exister autrement qu'en saisie interne.
- **Une identité minimale avant la réputation.** Source a besoin de savoir *qui* propose et *qui* valide dès le premier jour ; la réputation complète (ID) vient plus tard.

## 6. Contraintes techniques

| Contrainte | Conséquence |
|---|---|
| Client en un seul fichier (T-01) | La logique de chaque module va dans `domains/<domaine>/*.js` (pur, testé), l'interface reste mince ; les pages lourdes (Lab, Debate) sont chargées à la demande |
| Frontières contrôlées | Ajouter les nouveaux préfixes au contrôle `scripts/check-boundaries.js` (par exemple `src*` pour Source dans Explorer) |
| Hors ligne | La consultation de la connaissance déjà vue reste possible hors ligne ; la contribution exige le réseau |
| Monolithe modulaire (PRD-D8) | Un seul backend Supabase ; schémas Postgres par domaine ; pas de microservices |
| Recherche | Postgres plein texte + `pg_trgm` + `unaccent` jusqu'à environ 1 million de fiches (PRD-D5) |
| Images | Seulement les images autorisées, sur R2 (PRD-D6), avec la référence de droits de `media-core.js` |

## 7. Risques de régression

| Risque | Domaine touché | Parade |
|---|---|---|
| Un deuxième catalogue apparaît | Catalogue, Collection | Edition Intelligence étend `panel-catalog` et le schéma `catalog`, jamais un magasin parallèle |
| Explorer se met à lire la collection | Explorer | Contrat S1 et `check-boundaries.js --strict` restent bloquants |
| Fuite de données personnelles par la contribution | Communauté | Toute publication passe par `policy-core.js` (liste blanche) |
| Alourdissement du client | Tous | Budget de taille et de temps de chargement, mesuré avant chaque lot (T-08) |
| Régression de l'existant hors ligne | Tous | Les 60 tests d'interface et 248 tests unitaires restent la barrière ; CI à ajouter (T-05) |
