# PANEL 2.0 — Décisions à prendre

Seules les questions **réellement ouvertes** figurent ici. Pour chacune : le contexte, les options, une recommandation argumentée. Aucune ne bloque la poursuite de la conception ; certaines bloquent une phase (indiqué).

| ID | Question | Contexte | Options | Recommandation | Bloque |
|---|---|---|---|---|---|
| DR-01 | Que devient la page cosmique d'Explorer ? | D-75 a ajouté un atlas Marvel (301 fiches, `data/cosmos-marvel.json`). PANEL ATLAS est abandonné. Le 14 novembre 2026, l'utilisateur a demandé de ne garder que « les cartes des cosmos et multivers » et d'oublier les informations de hiérarchie cosmique | a) retirer la page ; b) garder seulement des **fiches** (cartes) de cosmos et de multivers dans Explorer, sans hiérarchie ni navigation cartographique ; c) garder l'atlas | **b)** : les fiches restent du contenu d'Explorer ; les données alimentent Canon comme affirmations sourcées ; aucun module, aucune roadmap Atlas. **Appliqué en D-78** : la page ne montre plus que les cartes des Cosmos et du multivers | Phase B |
| DR-02 | Périmètre géographique du catalogue | PRD-D10 limite le catalogue aux comics US et FR ; PANEL 2.0 vise le mondial | a) garder US/FR jusqu'à la fin de la phase A ; b) ouvrir tout de suite | **a)** : la francophonie est le marché de lancement ; le modèle (`edition.market`) est prêt à s'élargir | Phase A (extension) |
| DR-03 | Les données héritées `panel_theories` | Clé conservée lors du retrait du numérique, sans interface ; contenu inconnu | a) les proposer comme brouillons de dossiers Lab ; b) les laisser archivées | **a)**, avec accord explicite de l'utilisateur et sans publication automatique | Phase C |
| DR-04 | Rythme d'ouverture de la contribution | La modération est la ressource rare | a) ouverture par paliers (invités, contributeurs confirmés, tous) ; b) ouverture générale | **a)** | Phase A |
| DR-05 | Fournisseur d'IA (si IA) | Aucune IA payante n'est nécessaire aux fonctions essentielles | a) aucun au départ ; b) un fournisseur via une Edge Function avec quotas ; c) modèle local sur serveur | **a)** pendant la phase A, puis **b)** pour l'extraction et les synthèses, si la valeur est démontrée | Aucune (optionnel) |
| DR-06 | Licences | Licence des contributions des membres ; licences d'usage de chaque source (BnF, Wikidata, GCD, Metron, Comic Vine, Marvel Database) | a) CC BY-SA pour le texte documentaire ; b) licence propriétaire PANEL | **a)** : compatible avec les sources libres et favorable à la confiance ; vérifier source par source avant Open | Phases A et G |
| DR-07 | Source de métadonnées audiovisuelles | Multiverse a besoin des films et séries | a) Wikidata (CC0) ; b) TMDb (conditions d'API à vérifier) | **a)** d'abord, b) en complément si les conditions le permettent | Phase E |
| DR-08 | Création du projet Supabase de production | Seule la préproduction existe (migration 13 appliquée) | Région UE (PRD-D2) | À décider avec le calendrier des lots 3.2 et 3.3 | Phase 0 |
| DR-09 | Durée de conservation des journaux d'actions sensibles | RGPD : limiter la conservation | 1 an, 3 ans, durée du compte | **1 an** pour les journaux techniques ; l'historique documentaire (révisions) est permanent mais anonymisé à la suppression du compte | Phase A |
| DR-10 | Seuil de validation d'une affirmation | Équilibre entre rigueur et vitesse | 1 ou 2 revues indépendantes | **2**, dont un vérificateur du domaine | Phase A |
| DR-11 | Suppression des contributions à la clôture d'un compte | Intégrité documentaire et droit à l'effacement | a) anonymiser ; b) supprimer | **a)**, annoncé dans les règles avant l'inscription | Phase A |
| DR-12 | Ordre entre PANEL 2.0 et les demandes d'interface du 14 novembre 2026 | L'utilisateur a demandé à la fois l'audit (sans code) et des améliorations : Explorer allégé, Lecture, toutes les variantes, police des boîtes, retrait de l'aspect « gradé », communauté et direct, lenteurs | a) terminer l'audit, puis traiter les améliorations dans le client existant ; b) l'inverse | **a)**, déjà appliqué : l'audit ne modifie aucun code ; les améliorations suivent, dans des lots distincts | Aucune |

## Arbitrages techniques déjà tranchés, à ne pas rouvrir

| Sujet | Décision existante |
|---|---|
| Framework client | Garder le client actuel, pas de migration Next.js (PRD-D1) |
| Backend | Supabase, région UE (PRD-D2, D-03) |
| Architecture | Monolithe modulaire (PRD-D8) |
| Recherche | Postgres plein texte, moteur dédié seulement au-delà d'environ 1 million de fiches (PRD-D5) |
| Images | R2, images autorisées seulement (PRD-D6) |
| Social essentiel gratuit | PRD-D9 |
| Atlas | Abandonné (consigne PANEL 2.0) |
