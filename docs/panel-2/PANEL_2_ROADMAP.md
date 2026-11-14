# PANEL 2.0 — Feuille de route

Cette feuille de route se place **après** les lots déjà prévus dans [`../ROADMAP.md`](../ROADMAP.md) (comptes, synchronisation, ouverture de la communauté, lots 3.2 à 3.7). Elle ne fixe pas de dates : l'effort est donné en taille relative (S, M, L, XL), à recaler après chaque phase. L'ordre initialement proposé (Source et Edition, puis Canon, Lab et Debate, ID, Multiverse, Signal, Open) est conservé dans ses grandes lignes, avec **deux corrections** tirées de l'audit.

## 1. Corrections de l'ordre proposé

1. **Une phase 0 de prérequis** : sans comptes en ligne (le client n'est pas connecté à Supabase, T-02), aucune contribution n'est traçable.
2. **ID minimal avant Source** : l'attribution (qui propose, qui relit) est nécessaire dès la première contribution. La réputation complète reste en phase D.

## 2. Phases

### Phase 0 — Prérequis : comptes et stabilité

| | |
|---|---|
| Prérequis | Lots 3.2 et 3.3 du plan existant ; projet Supabase de production (DR-08) |
| Fonctionnalités | Connexion, synchronisation, ouverture de la communauté ; CI (T-05) ; suite de tests découpée (T-04) ; mesure des performances (T-08) |
| Dépendances | Décisions D-03, PRD-D2 |
| Difficulté | L |
| Risques | Perte ou duplication de données à la synchronisation (moteur existant, `sync.test.js`, `conflicts.test.js`) |
| Coûts | Supabase, hébergement statique |
| Critères d'acceptation | Un compte synchronise sa collection sans perte ; tous les tests passent en CI |
| Indicateurs | 0 perte de données signalée ; temps de chargement mesuré et suivi |

### Phase A — Fondations documentaires : Source, Edition Intelligence, ID minimal

| | |
|---|---|
| Prérequis | Phase 0 ; licences des sources vérifiées (DR-06) |
| Fonctionnalités | Schéma `catalog` (D1) et affirmations documentées (D2) ; migration des données écrites dans le code (`events-crossref.js`, `events-seed.js`) ; preuves et revues ; œuvres et contenus d'éditions (D3) ; correspondances VO/VF ; liste complète des variantes par numéro ; attribution des contributions |
| Dépendances | Catalogue commun existant |
| Difficulté | XL |
| Risques | Qualité des premières données ; charge de modération ; double catalogue si l'extension est mal faite |
| Coûts | Base, traitements de vérification des liens |
| Critères d'acceptation | Voir modules 01 et 02 ; aucune affirmation `fact` sans preuve ; aucun rattachement d'exemplaire sans confirmation |
| Indicateurs | Part des fiches consultées avec au moins une source ; nombre de correspondances VO/VF établies ; délai médian de revue |

### Phase B — Intelligence narrative : Canon

| | |
|---|---|
| Prérequis | Phase A |
| Fonctionnalités | Continuités, versions de personnages, retcons, conséquences, double chronologie ; reprise des 301 fiches cosmiques comme données sourcées |
| Dépendances | Source, Edition Intelligence |
| Difficulté | L |
| Risques | Débats sans fin sur le canon ; tentation de recréer un Atlas (interdit) |
| Critères d'acceptation | Module 03 |
| Indicateurs | Conflits documentés et expliqués ; taux de fiches personnage avec continuité renseignée |

### Phase C — Connaissance collaborative : Debate, puis Lab

| | |
|---|---|
| Prérequis | Phase A ; modération opérationnelle |
| Fonctionnalités | Débats asynchrones structurés, votes séparés, synthèses ; puis dossiers de recherche ; le direct audio reste une extension ultérieure (spécification `LIVE-DEBATS.md`) |
| Dépendances | Source (preuves), communauté (0013) |
| Difficulté | L |
| Risques | Abus, harcèlement, brigading |
| Critères d'acceptation | Modules 04 et 05 |
| Indicateurs | Part des arguments sourcés ; débats clos avec synthèse ; dossiers validés |

**Ordre interne** : Debate avant Lab, car il réutilise davantage l'existant (onglet Live, posts, réactions, modération) et attire la communauté qui alimentera Lab.

### Phase D — Identité et expertise : ID complet

| | |
|---|---|
| Prérequis | Phases A et C (assez de contributions pour mesurer) |
| Fonctionnalités | Domaines d'expertise, réputation transparente, badges internes, détection de manipulation |
| Difficulté | M |
| Risques | Course aux points |
| Indicateurs | Corrélation entre réputation et taux d'acceptation des contributions |

### Phase E — Analyse transmédia : Multiverse

| | |
|---|---|
| Prérequis | Phase B ; source audiovisuelle choisie (DR-07) |
| Fonctionnalités | Œuvres audiovisuelles, adaptations, comparaisons ; extension de « Avant de voir » |
| Difficulté | M |
| Indicateurs | Consultation des dossiers autour des sorties de films |

### Phase F — Intelligence de marché : Signal

| | |
|---|---|
| Prérequis | Volume d'utilisateurs suffisant pour des agrégats anonymes (seuil de 20 par cellule) ; consentement |
| Fonctionnalités | Tendances observées sur PANEL, données externes séparées, estimations étiquetées |
| Difficulté | M |
| Risques | Vie privée ; sur-interprétation |
| Indicateurs | Usage des rapports ; zéro plainte sur la représentativité |

### Phase G — Écosystème ouvert : Open

| | |
|---|---|
| Prérequis | Phases A et B ; licences ; sécurité des API |
| Fonctionnalités | API en lecture, clés, quotas, documentation, widgets, profils et collections partageables |
| Difficulté | L |
| Risques | Fuite de données, redistribution non autorisée |
| Indicateurs | Applications tierces actives ; incidents de sécurité (objectif : zéro) |

## 3. Travaux transverses, à mener en continu

| Travail | Pourquoi |
|---|---|
| Internationalisation (T-03) | Avant toute ouverture hors francophonie ; à démarrer en phase A pour les nouveaux écrans |
| Performance (T-08) | Chaque module ajoute du poids au client monolithique (T-01) |
| Tests et CI (T-04, T-05) | Les 308 tests existants (135 + 113 + 60) restent la barrière contre les régressions |

## 4. Risques principaux

| Risque | Probabilité | Impact | Réponse |
|---|---|---|---|
| Capacité de modération insuffisante | Élevée | Élevé | Ouverture par paliers |
| Données de départ trop pauvres pour attirer des contributeurs | Moyenne | Élevé | Amorcer avec les sources libres (Wikidata, BnF) et les données existantes |
| Complexité du client unique | Élevée | Moyen | Logique dans `domains/**`, chargement à la demande |
| Licences des sources | Moyenne | Élevé | Vérifier avant Open ; ne jamais redistribuer sans droit |
| Dispersion sur neuf modules | Élevée | Élevé | Une phase à la fois ; critères d'acceptation avant de passer à la suivante |
