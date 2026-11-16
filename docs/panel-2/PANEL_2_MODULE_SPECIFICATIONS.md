# PANEL 2.0 — Spécifications des neuf modules

Chaque module est décrit à partir de **ce qui existe déjà** dans PANEL (preuves dans [`PANEL_2_REPOSITORY_AUDIT.md`](PANEL_2_REPOSITORY_AUDIT.md)). Les tables citées sont détaillées dans [`PANEL_2_DATA_ARCHITECTURE.md`](PANEL_2_DATA_ARCHITECTURE.md).

Rôles utilisés (extension des rôles existants de `app.staff_roles`, migration 0010) :

| Rôle | Qui | Peut |
|---|---|---|
| Visiteur | Sans compte | Consulter ce qui est public |
| Membre | Compte vérifié (âge et règles acceptés, migration 0013) | Proposer une correction, voter, argumenter |
| Contributeur | Membre avec historique de contributions acceptées | Proposer des affirmations, relire celles des autres |
| Vérificateur | Contributeur reconnu dans un domaine (ID) | Valider (deuxième revue), arbitrer un conflit |
| Modérateur, administrateur | Personnel (`staff_roles`) | Modérer, verrouiller, restaurer |

---

## Module 01 — PANEL SOURCE

**Mission** : rendre chaque information vérifiable.

| | |
|---|---|
| Existe déjà | Provenance par champ et centre des conflits (lot 2.5, tests 28 et 45) ; recoupement multi-sources avec divergences conservées et statut « non vérifié » (`events-crossref.js`, test 51) ; vocabulaire de vérification et droits par référence (`media-core.js`, test 43) ; niveaux de fiabilité (`CZ_CERT`, `event-levels.js`) |
| Réutilisable | Le format `CROSSREF` (sources décrites une fois, faits par source, divergences expliquées) ; `VERIFICATION` ; l'interface des fiches événement et de l'atlas qui montre déjà la fiabilité |
| À améliorer | Passer de données écrites dans le code (T-07) à un stockage ; afficher le statut sur **chaque** affirmation, pas seulement sur la fiche |
| Manque réellement | Statut épistémique (fait, interprétation, hypothèse) ; preuves localisées (page, case) ; historique des modifications ; revue communautaire ; attribution aux contributeurs |
| Nouvelle architecture | Oui : tables `catalog.source`, `evidence`, `claim_revision`, `claim_review`, `claim_conflict` (étape D2) |
| Dépendances | Comptes en ligne ; ID minimal (attribution) |
| Risques de régression | Affichage alourdi des fiches existantes ; ralentissement si chaque fiche charge toutes ses preuves (chargement à la demande) |

**Cas d'utilisation**
1. Un lecteur ouvre la fiche d'un numéro et voit, pour la première apparition d'un personnage : « Fait établi · 2 sources · vérifié par 2 contributeurs ».
2. Un contributeur ajoute une preuve : la source, la page, une citation courte.
3. Deux sources divergent sur une date de parution : la fiche montre les deux, et l'explication du conflit.

**Parcours** : fiche → « Sources (3) » → liste des affirmations avec statut → « Proposer une correction » (membre) ou « Ajouter une preuve » (contributeur) → file de revue → décision motivée et historisée.

**Permissions** : lecture publique ; proposition = contributeur ; passage à `verified` = deux revues indépendantes dont un vérificateur ; verrouillage = modérateur.

**Critères d'acceptation**
- Aucune affirmation `fact` sans au moins une preuve.
- Toute modification crée une `claim_revision` ; rien ne s'efface.
- Une affirmation sans preuve suffisante s'affiche « hypothèse » ou « non vérifié », jamais comme un fait.
- Un contributeur ne peut pas valider sa propre proposition.

---

## Module 02 — PANEL EDITION INTELLIGENCE

**Mission** : comprendre les relations entre publications, de la VO à la VF.

| | |
|---|---|
| Existe déjà | Catalogue normalisé et commun (`panel-catalog`, `publication-core.js`, tests 24 et 52) ; variantes et exemplaires (lot 2.2, test 25) ; relations `edition_of`, `collects`, `translation_of` dans `catalog-core.js` ; relais BnF (`/api/bnf/editions`) ; calendrier francophone (D-75) ; tables `edition`, `edition_content`, `edition_relation` proposées dans le PRD |
| Réutilisable | Tout le catalogue ; l'import de League of Comic Geeks et de CLZ pour amorcer des correspondances ; dHash et code-barres pour identifier une édition |
| À améliorer | **Variantes incomplètes** : l'utilisateur signale qu'un numéro n'affiche pas toutes ses variantes ; il faut une liste de variantes par numéro, chacune avec sa source |
| Manque réellement | Notion d'œuvre (`catalog.story`) ; contenus regroupés avec pagination ; équivalences d'éditions ; dates par territoire au-delà de US/FR |
| Nouvelle architecture | Partielle : étapes D1 et D3 ; extension du catalogue, **pas** de catalogue parallèle |
| Dépendances | Source (une équivalence est une affirmation) |
| Risques de régression | Rattachement erroné d'exemplaires existants : aucun rattachement automatique sans confirmation de l'utilisateur ; l'exemplaire garde ses champs actuels |

**Cas d'utilisation**
1. « J'ai l'intégrale Spider-Man 1987 de Panini : quels numéros VO contient-elle ? » → liste des numéros, pages, et ce qui manque.
2. « Ce TPB et cet omnibus contiennent-ils la même chose ? » → comparaison des contenus.
3. Le scan d'un ISBN français propose l'édition, puis ses équivalents VO, marqués « établi » ou « probable ».

**Permissions** : lecture publique ; correspondances proposées par les contributeurs ; équivalence « établie » validée selon les règles de Source.

**Critères d'acceptation**
- Œuvre, publication, édition et exemplaire sont distincts dans les données et dans l'interface.
- Une correspondance incertaine est affichée comme « probable », avec la raison.
- Toutes les variantes connues d'un numéro sont listées, chacune avec sa source.

---

## Module 03 — PANEL CANON

**Mission** : documenter continuités et versions des personnages sans aplatir les contradictions.

| | |
|---|---|
| Existe déjà | Entités `character`, `team`, `event`, `saga` et relations `appears_in`, `first_appearance`, `member_of` (`catalog-core.js`) ; fiches événement avec niveaux justifiés (`events-seed.js`, `event-levels.js`) ; fiches personnage enrichies par Comic Vine et Wikidata (D-67) ; données cosmiques sourcées (`data/cosmos-marvel.json`, 301 fiches, D-75) |
| Réutilisable | Les fiches et la recherche d'Explorer ; les données de l'atlas comme **données** (continuités, entités, relations, fiabilité), sans produit Atlas |
| À améliorer | Les pages cosmiques actuelles d'Explorer ; l'utilisateur veut n'y garder que les cartes des cosmos et des multivers (DR-01) |
| Manque réellement | Continuités, versions de personnages, retcons, conséquences, double chronologie (éditoriale et narrative) |
| Nouvelle architecture | Oui : schéma `canon` (étape D4) |
| Dépendances | Source (chaque lien de version est une affirmation) ; Edition Intelligence (les chronologies référencent des publications) |
| Risques de régression | Retour d'un « Atlas » par la bande : **interdit** ; Canon s'affiche en fiches et chronologies, jamais en carte autonome |

**Cas d'utilisation**
1. « Pourquoi Jean Grey est-elle morte et vivante en même temps ? » → la fiche montre le retcon, sa date et ses sources.
2. Comparer deux versions d'un personnage dans deux continuités.
3. Lire la chronologie narrative d'un personnage, distincte de l'ordre de parution.

**Critères d'acceptation**
- Deux affirmations contradictoires restent séparées, avec un `claim_conflict` qui les explique.
- Continuité officielle, alternative et interprétation sont étiquetées.
- Aucune page de type Atlas n'apparaît dans la navigation.

---

## Module 04 — PANEL LAB

**Mission** : permettre des recherches collaboratives sérieuses et reproductibles.

| | |
|---|---|
| Existe déjà | Rien de branché. Une clé héritée `panel_theories` est conservée depuis le retrait du numérique, sans interface (contenu À VÉRIFIER) ; la politique de partage (`policy-core.js`) et la modération (0013) |
| Réutilisable | Preuves et sources de Source ; brouillons locaux et validation de la communauté ; sauvegardes par domaine |
| Manque réellement | Dossiers, hypothèses, collecte de preuves, versions, rôles de collaboration, revue, publication |
| Nouvelle architecture | Oui : schéma `lab` (étape D5) |
| Dépendances | Comptes, ID minimal, Source |
| Risques de régression | Faible : module nouveau ; veiller à ne pas exposer de données de collection |

**Parcours** : créer un dossier (question) → inviter des collaborateurs → poser des hypothèses → attacher des preuves → demander une revue → publier « validé » ou rester « en cours ».

**Critères d'acceptation**
- Le statut « en cours » ou « validé » est visible partout où le dossier est cité.
- Chaque version est consultable et comparable.
- Une conclusion validée qui affirme un fait crée une proposition dans Source, soumise aux mêmes revues.

---

## Module 05 — PANEL DEBATE

**Mission** : faire passer la discussion à des débats structurés.

| | |
|---|---|
| Existe déjà | Cahier des charges des débats en direct (`docs/LIVE-DEBATS.md`, D-61) ; onglet « Directs » de Communauté devenu un studio de préparation et de répétition seul (D-78), avec pages de la galerie du téléphone gardées sur l'appareil (D-79) ; tables `community.posts`, `reactions`, `reports` (0013) |
| Réutilisable | Modération, limites anti-abus, blocages (0013) ; preuves de Source ; écran Communauté |
| À améliorer | Le salon à plusieurs (voix, mains levées, tableau partagé) : comptes en ligne, serveur audio et décision DR-13 sur l'affichage des pages de la galerie |
| Manque réellement | Arborescence argument / contre-argument / réfutation ; votes séparés (accord et qualité) ; synthèses ; historique des positions |
| Nouvelle architecture | Oui : schéma `debate` (étape D5) ; le direct audio reste une extension ultérieure (serveur audio, coût) |
| Dépendances | Comptes, Source, modération |
| Risques de régression | Abus et harcèlement : limites et signalements existants obligatoires dès l'ouverture |

**Critères d'acceptation**
- Le nombre d'accords n'est jamais présenté comme une preuve.
- Un argument factuel sans source est marqué « non sourcé ».
- Un débat clos garde sa synthèse et ses versions.
- Débat asynchrone livré et testé avant tout direct audio.

---

## Module 06 — PANEL MULTIVERSE

**Mission** : comparer comics et adaptations.

| | |
|---|---|
| Existe déjà | « Avant de voir » : 5 dossiers films et séries avec comics à lire (`watch-guides.js`) ; actualités films et séries (D-75) |
| Réutilisable | La page dossier ; les fiches personnage ; Canon pour les versions |
| Manque réellement | Œuvres audiovisuelles, liens d'adaptation, comparaisons par aspect |
| Nouvelle architecture | Oui : schéma `multiverse` (étape D6) |
| Dépendances | Canon, Source ; source de métadonnées audiovisuelles (TMDb ou Wikidata, licences à vérifier, DR-07) |
| Risques de régression | Faible ; attention aux images d'affiches (droits) |

**Critères d'acceptation** : la version comics reste la référence affichée en premier ; chaque différence est sourcée ; les libertés d'adaptation sont qualifiées (`direct`, `loose`, `inspired`).

---

## Module 07 — PANEL SIGNAL

**Mission** : comprendre les tendances sans tromper sur leur représentativité.

| | |
|---|---|
| Existe déjà | Statistiques personnelles (collection, lecture) ; actualités agrégées avec apprentissage local (`news-core.js`) ; calendrier des sorties |
| Réutilisable | Les calculs de `stats-core.js` et `reading-stats.js`, appliqués à des agrégats |
| Manque réellement | Agrégats communautaires consentis ; séparation des catégories de données ; méthodologie publiée |
| Nouvelle architecture | Oui : schéma `signal` (étape D6), traitements périodiques |
| Dépendances | Comptes et volume suffisant d'utilisateurs ; consentement explicite (Lecture, Collection) |
| Risques de régression | Atteinte à la vie privée : seuil minimal par cellule (20), aucune donnée individuelle |

**Critères d'acceptation** : chaque chiffre porte son étiquette (« observé sur PANEL », « externe », « estimation ») et sa période ; jamais « le marché ».

---

## Module 08 — PANEL ID

**Mission** : identité et réputation fondées sur la qualité.

| | |
|---|---|
| Existe déjà | Profils serveur (`app.profiles`), membres de la communauté (`community.members`, 0013), rôles du personnel ; profil local avec pseudo, couleur, favoris (`profileLoad`) ; rangs et trophées de collectionneur |
| Réutilisable | Profils et rôles ; la page profil façon Instagram (D-76) |
| À améliorer | Distinguer clairement **récompenses de collectionneur** (rangs, trophées) et **réputation de contributeur** |
| Manque réellement | Domaines d'expertise, historique des contributions et de leur issue, réputation calculée, prévention de la manipulation |
| Nouvelle architecture | Oui : schéma `id` (étape D5) ; ID minimal (attribution) dès Source |
| Dépendances | Source, Lab, Debate (sources de contributions) |
| Risques de régression | Course aux points : la réputation ne compte **que** les contributions acceptées après revue, pondérées par leur difficulté |

**Critères d'acceptation** : la formule de réputation est publique ; aucun gain par volume brut, par likes ou par abonnés ; l'auto-validation et les votes croisés entre comptes liés sont détectés.

---

## Module 09 — PANEL OPEN

**Mission** : ouvrir PANEL à des tiers, proprement.

| | |
|---|---|
| Existe déjà | Contrats internes versionnés (S1–S6, `PERSONAL_CONTRACTS_V1`) ; exports de collection (CSV, `.xlsx`) et sauvegardes ; relais local `serve.js` (non public) |
| Réutilisable | Les contrats comme base des formats d'API ; les exports comme modèle d'export utilisateur |
| Manque réellement | API publique en lecture, clés, quotas, documentation, widgets, profils et collections partageables, webhooks |
| Nouvelle architecture | Oui : Edge Functions dédiées, table de clés et de quotas (réutiliser `app.service_limits`) |
| Dépendances | Catalogue serveur, Source, licences vérifiées par source (DR-06) |
| Risques de régression | Fuite de données ; redistribution de données sous licence restrictive : n'exposer que ce dont PANEL détient les droits |

**Critères d'acceptation** : aucune donnée personnelle sans consentement ; chaque réponse porte la licence et l'attribution ; limites de requêtes appliquées ; API en lecture seule d'abord.
