# PANEL 2.0 — Architecture des données

Ce document **étend** le modèle proposé dans [`../prd/PANEL_DATA_MODEL.md`](../prd/PANEL_DATA_MODEL.md) (schémas `catalog`, `editorial`, `community`, `moderation`, `notify`, `billing`) et le schéma réellement créé (`app`, `community`, migrations 0001 à 0013). Il ne le remplace pas. Aucune migration n'est écrite ni appliquée dans le cadre de cette mission.

Légende : **[existe]** créé et testé · **[PRD]** proposé dans le PRD V1 · **[2.0]** nouveauté de PANEL 2.0.

## 1. Principes

1. **Tables typées pour ce qui est stable** (séries, numéros, variantes, éditions, créateurs) : c'est déjà le choix du PRD et du catalogue local `panel-catalog`.
2. **Affirmations documentées pour ce qui se discute** (une date, une première apparition, un rattachement de continuité, une correspondance VO/VF incertaine). Une seule table générique, `catalog.claim` [PRD], enrichie ; pas de base de graphe générale.
3. **Ne pas tout généraliser.** Un numéro n'est pas une « entité abstraite avec propriétés » : c'est une ligne de `catalog.issue`. Seuls les faits contestables passent par les affirmations.
4. **Rien ne s'efface.** Une fiche fusionnée laisse un alias (`catalog.alias` [PRD]) ; une affirmation remplacée garde son historique.
5. **Personnel et partagé ne se mélangent pas.** Les exemplaires restent dans `app.copies` [existe] ; le catalogue ne connaît aucun utilisateur.

## 2. Quatre niveaux à ne jamais confondre

Le module Edition Intelligence exige de séparer **œuvre**, **publication**, **édition** et **exemplaire**. Correspondance avec l'existant :

| Niveau | Définition | Table | Exemple |
|---|---|---|---|
| Œuvre (contenu) | Un récit, indépendamment de son support | `catalog.story` **[2.0]** | Le récit « Kraven's Last Hunt », partie 1 |
| Publication | Un numéro paru, avec sa date et son éditeur | `catalog.issue` [PRD] ; local : store `issues` [existe] | *Web of Spider-Man* #31 (1987) |
| Édition | Un support qui contient des œuvres : fascicule, TPB, HC, omnibus, intégrale, traduction | `catalog.edition` [PRD] ; variantes : `catalog.variant` [PRD] | L'intégrale Panini 1987 ; le TPB Marvel |
| Exemplaire | L'objet que possède un utilisateur | `app.copies` [existe] ; local : `panel_physical_singles` [existe] | « Mon exemplaire, boîte 3 » |

Ajout **[2.0]** pour relier ces niveaux :

| Table | Champs | Rôle |
|---|---|---|
| `catalog.story` | `id`, `title`, `title_norm`, `original_issue_id` (première publication), `page_count` | L'unité de contenu ; deux éditions contiennent « la même chose » si elles contiennent les mêmes `story` |
| `catalog.edition_content` [PRD, étendu] | `edition_id`, `story_id` **[2.0]** (en plus de `issue_id`), `position`, `page_start`, `page_end`, `completeness` (`complete`, `abridged`, `extract`) **[2.0]** | Différences de pagination et contenus partiels |
| `catalog.edition_relation` [PRD] | `kind` : `translated_from`, `reprint_of`, `collects` (+ `equivalent_to` **[2.0]**) | VO/VF, rééditions ; une équivalence est **une affirmation** (section 3), jamais un simple lien |

Une correspondance VO/VF est **établie** quand les contenus (`story`) coïncident et qu'une source le confirme ; **probable** quand seule une heuristique le suggère (titre, date, pagination) ; elle reste affichée comme telle.

## 3. Affirmations documentées (cœur de Source)

`catalog.claim` [PRD] porte déjà `target_type`, `target_id`, `field`, `value`, `source`, `source_url`, `license`, `retrieved_at`, `status`, `superseded_by`. Ajouts **[2.0]** :

| Champ ou table | Contenu | Pourquoi |
|---|---|---|
| `claim.kind` | `fact` (fait établi), `interpretation`, `hypothesis` | Distinction exigée par Source ; ne se confond pas avec `status` |
| `claim.status` [PRD] | `noted`, `concordant`, `corroborated`, `verified`, `disputed` | Repris tel quel ; aligné sur `VERIFICATION` de `media-core.js` (`verified`, `user_confirmed`, `unverified`, `disputed`) |
| `claim.reliability` | 0 à 3, calculé (nombre et qualité des sources, vérifications) | Équivalent serveur de `CZ_CERT` (atlas) et des niveaux d'`event-levels.js` |
| `claim.author_id`, `claim.created_at` | Qui a proposé, quand | Traçabilité ; `null` pour une importation de source automatique, avec `source` renseignée |
| `catalog.source` **[2.0]** | `id`, `type` (`publication`, `site`, `entretien`, `document`, `base`), `title`, `url`, `publisher`, `license`, `trust` (`primary`, `secondary`, `tertiary`) | Une source est décrite une fois et réutilisée (modèle de `events-crossref.js`, `cbro()`, `ro()`) |
| `catalog.evidence` **[2.0]** | `claim_id`, `source_id`, `locator` (jsonb : `issue_id`, `page`, `panel`, `timecode`, `url_fragment`), `quote` (≤ 300 caractères), `quote_lang` | Preuve précise : page et case **seulement** pour un document légalement consulté ; citation courte (droit de citation) |
| `catalog.claim_revision` **[2.0]** | `claim_id`, `revision`, `value`, `kind`, `status`, `changed_by`, `changed_at`, `reason` | Historique complet, en ajout seulement |
| `catalog.claim_review` **[2.0]** | `claim_id`, `reviewer_id`, `verdict` (`confirm`, `reject`, `needs_source`), `comment`, `at` | Vérification communautaire ; deux revues indépendantes pour passer `verified` |
| `catalog.claim_conflict` **[2.0]** | `claim_a`, `claim_b`, `nature` (`contradiction`, `retcon`, `continuity_split`, `translation_difference`), `explanation`, `explained_by` | Explique **pourquoi** deux affirmations divergent sans les fusionner (modèle des divergences `D(topic, text, sourceIds)` d'`events-crossref.js`) |
| `catalog.correction_request` [PRD] | Reste la porte d'entrée des corrections pour un simple utilisateur | — |

### Propriétés exigées pour chaque relation importante

| Propriété | Où elle vit |
|---|---|
| Origine | `claim.author_id` ou `claim.source` (import) |
| Source | `catalog.evidence` → `catalog.source` |
| Fiabilité | `claim.reliability`, `claim.status` |
| Date de création | `claim.created_at` |
| Auteur | `claim.author_id` |
| Historique | `catalog.claim_revision` |
| Contradictions | `catalog.claim_conflict` |

Une relation narrative (« X apparaît pour la première fois dans Y ») est stockée comme **affirmation** sur la relation typée (`catalog.appearance` [PRD]) : la ligne typée porte la valeur courante, l'affirmation porte la preuve et l'historique.

## 4. Canon : univers, continuités, versions

| Table | Statut | Champs | Note |
|---|---|---|---|
| `catalog.universe` | [PRD] | `id`, `name`, `publisher_id` | Existe dans le PRD |
| `canon.continuity` | **[2.0]** | `id`, `universe_id`, `name` (« Terre-616 », « Ultimate »), `designation`, `kind` (`main`, `alternate`, `imprint`, `elseworld`), `period_start`, `period_end` | Remplace l'idée d'Atlas : une liste de continuités, pas une carte |
| `canon.character_version` | **[2.0]** | `id`, `character_id` (`catalog.character` [PRD]), `continuity_id`, `label`, `first_issue_id`, `last_issue_id` | « Peter Parker (Terre-616) » et « Miles Morales (Ultimate) » restent liés au même concept sans fusion |
| `canon.version_link` | **[2.0]** | `from_version`, `to_version`, `kind` (`same_person`, `legacy`, `counterpart`, `reboot`, `retcon_of`) | Chaque lien est une affirmation (section 3) |
| `canon.event_consequence` | **[2.0]** | `event_id` (`editorial.event` [PRD]), `target_type`, `target_id`, `change` (texte), `status` (`in_force`, `retconned`) | Conséquences et retcons datés |
| `canon.timeline_entry` | **[2.0]** | `continuity_id`, `subject`, `position_publication` (date de parution), `position_narrative` (ordre interne), `claim_id` | Chronologie éditoriale **et** narrative, séparées |

Données existantes à reprendre : les 301 fiches de `data/cosmos-marvel.json` (entités cosmiques, relations, niveaux de fiabilité, sources) deviennent des `character`, `continuity` et affirmations sourcées. Aucun produit Atlas n'en découle (DR-01).

## 5. Multiverse : adaptations

| Table | Statut | Champs |
|---|---|---|
| `multiverse.screen_work` | **[2.0]** | `id`, `kind` (`film`, `series`, `animation`, `game` exclu par défaut), `title`, `release_date`, `studio`, `external_ids` (TMDb, Wikidata) |
| `multiverse.adaptation` | **[2.0]** | `screen_work_id`, `adapts_type` (`story`, `event`, `series`), `adapts_id`, `fidelity` (`direct`, `loose`, `inspired`) — affirmation sourcée |
| `multiverse.comparison` | **[2.0]** | `subject` (`character_version`, `event`), `comics_id`, `screen_id`, `aspect` (`powers`, `origin`, `personality`, `plot`), `difference` (texte), `claim_id` |

Socle existant : `domains/explorer/watch-guides.js` (films, séries et comics à lire avant un film) ; la page « Avant de voir » reste l'interface.

## 6. Communauté : Lab, Debate, ID

S'ajoutent au schéma `community` [existe, 0013] :

| Table | Statut | Champs | Règle |
|---|---|---|---|
| `lab.dossier` | **[2.0]** | `id`, `title`, `question`, `status` (`draft`, `in_progress`, `in_review`, `validated`, `archived`), `owner_id`, `visibility` | Une recherche en cours n'est jamais présentée comme validée |
| `lab.dossier_member` | **[2.0]** | `dossier_id`, `user_id`, `role` (`owner`, `editor`, `reviewer`, `reader`) | — |
| `lab.hypothesis` | **[2.0]** | `dossier_id`, `text`, `status` (`open`, `supported`, `refuted`, `inconclusive`) | — |
| `lab.item` | **[2.0]** | `dossier_id`, `hypothesis_id`, `claim_id` ou `evidence` (même structure que `catalog.evidence`), `added_by` | Réutilise les preuves de Source |
| `lab.revision` | **[2.0]** | `dossier_id`, `revision`, `snapshot` jsonb, `author_id`, `at` | Versions reproductibles |
| `debate.debate` | **[2.0]** | `id`, `question`, `scope` (`canon`, `edition`, `opinion`), `status` (`open`, `closed`, `synthesized`), `created_by` | `opinion` ne produit jamais d'affirmation documentaire |
| `debate.argument` | **[2.0]** | `id`, `debate_id`, `parent_id`, `stance` (`for`, `against`, `rebuttal`), `text`, `author_id`, `evidence` (→ `catalog.evidence`) | Arborescence argument → contre-argument → réfutation |
| `debate.vote` | **[2.0]** | `argument_id`, `user_id`, `value` (`agree`, `disagree`), `quality` (`sourced`, `logical`, `off_topic`) | Popularité (`value`) et qualité (`quality`) **séparées** |
| `debate.synthesis` | **[2.0]** | `debate_id`, `text`, `author_id`, `reviewed_by`, `version` | — |
| `id.expertise` | **[2.0]** | `user_id`, `domain` (éditeur, période, personnage), `declared_at`, `evidence_count` | Déclarée, puis étayée par des contributions vérifiées |
| `id.contribution` | **[2.0]** | `user_id`, `type` (`claim`, `review`, `dossier`, `argument`), `target_id`, `outcome` (`accepted`, `rejected`, `pending`) | Base transparente de la réputation |

Les rangs et trophées existants (`ranks-core.js`, `trophies-core.js`) mesurent la collection et la lecture : ils restent des **récompenses de collectionneur**, distincts de la réputation documentaire.

## 7. Signal

| Table | Statut | Contenu | Étiquette obligatoire |
|---|---|---|---|
| `signal.panel_metric` | **[2.0]** | Agrégats anonymes (lectures, ajouts, suivis) par semaine, seuil minimal de 20 utilisateurs par cellule | « Observé sur PANEL » |
| `signal.external_metric` | **[2.0]** | Données d'une source externe (actualités, palmarès publiés) | « Source externe : … » |
| `signal.estimate` | **[2.0]** | Estimations calculées | « Estimation » + méthode |

Pas de données commerciales tant qu'aucune source licenciée n'existe ; la catégorie est réservée.

## 8. Migration progressive

| Étape | Contenu | Prérequis | Réversibilité |
|---|---|---|---|
| D1 | Schéma `catalog` du PRD (sans les ajouts 2.0) + import du catalogue local existant | Comptes ouverts | Ajouts seulement ; le local reste la référence tant que la synchronisation n'est pas validée |
| D2 | `catalog.claim` enrichi, `source`, `evidence`, `claim_revision`, `claim_review`, `claim_conflict` | D1 | Ajouts seulement |
| D3 | `catalog.story`, extension d'`edition_content` | D2 | Ajouts seulement |
| D4 | Schéma `canon` | D2 | Ajouts seulement |
| D5 | Schémas `lab`, `debate`, `id` | D2, comptes | Ajouts seulement |
| D6 | Schémas `multiverse`, `signal` | D3, D4 | Ajouts seulement |

Chaque étape suit la règle déjà en vigueur : migration additive, testée sous PGlite (`backend/tests/migrations.test.js`), sauvegarde et procédure de retour arrière (`docs/phase3/runbooks/migrations.md`), application seulement avec l'accord de l'utilisateur.

## 9. Internationalisation des données

- Titres traduits : `catalog.title_translation` **[2.0]** (`entity_type`, `entity_id`, `lang`, `title`), plutôt qu'une colonne par langue.
- Dates par territoire : `edition.market` + `edition.store_date` [PRD] ; à élargir au-delà de `US`/`FR` (la contrainte `check(country in ('US','FR'))` du PRD devra s'assouplir à l'ouverture mondiale).
- Les affirmations portent leur langue de citation (`evidence.quote_lang`).
