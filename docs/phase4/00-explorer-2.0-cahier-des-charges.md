# PANEL EXPLORER 2.0
## Cahier des charges fonctionnel et technique définitif

> Document fourni par l'utilisateur le 7 novembre 2026. Il définit la **Phase 4**, qui commence après la Phase 3.
>
> **Révision 2 (7 novembre 2026) : correction architecturale « séparation stricte Collection / Explorer »** demandée par l'utilisateur. La section 0 et les passages marqués « *Révision 2* » ont été ajoutés ; le reste du texte d'origine est inchangé. En cas de contradiction, la section 0 et le document [`02-frontieres-collection-explorer.md`](02-frontieres-collection-explorer.md) font foi.
> Analyse des impacts : [`01-analyse-et-impacts.md`](01-analyse-et-impacts.md).

**Produit :** Panel by Primestone  
**Module :** Explorer 2.0  
**Slogan :** Collect. Discover. Connect.  
**Plateformes :** Web et Android  
**Langue initiale :** Français  
**Architecture backend :** Supabase / PostgreSQL  
**Stockage des images :** Cloudflare R2  
**Stratégie d'importation :** Import massif initial + importation progressive et actualisation automatique  
**Couverture visuelle :** Tous les domaines d'Explorer  
**Gestion éditoriale :** Hybride — automatisation, validation humaine et contributions communautaires

---

# 0. SÉPARATION STRICTE COLLECTION / EXPLORER (*Révision 2*)

- Explorer et Collection sont deux modules **fonctionnellement indépendants**. Explorer n'est pas une extension de Collection ; Collection n'est pas une dépendance d'Explorer.
- **Collection** reste seule responsable : comics, exemplaires, éditions et variantes possédés, état et grading, emplacements, acquisitions et historique d'achat, wishlist, Pull List, statistiques de collection, progression personnelle liée à la lecture et aux possessions.
- **Explorer** est responsable de la découverte : catalogue éditorial, événements, guides, Key Issues, classements, tendances, sorties et calendrier éditorial, actualités, séries, personnages, équipes, créateurs, éditeurs, recommandations, images éditoriales, contributions.
- Explorer fonctionne pour un utilisateur **sans collection** et pour un **visiteur non connecté**.
- Services communs autorisés : catalogue canonique, identifiants stables, référentiel éditeurs et séries, infrastructure d'images (R2), authentification, services backend, recherche. **Partager l'infrastructure ne signifie pas partager la responsabilité.**
- Explorer ne lit pas les données internes de Collection. Toute interaction passe par les **contrats S1 à S6** de [`02-frontieres-collection-explorer.md`](02-frontieres-collection-explorer.md) (lecture personnelle facultative, commandes initiées par l'utilisateur, agrégats anonymes, registre d'images, catalogue canonique, identité).
- Les lots Explorer 2.0 ne modifient **aucune** fonctionnalité, interface, donnée ou modèle de Collection, et n'effectuent aucune migration destructive.

---

# 1. VISION

Explorer 2.0 doit devenir le centre de découverte de Panel.

L'objectif est de proposer une expérience complète permettant de découvrir, comprendre et explorer l'industrie des comics.

Explorer doit associer :

1. Editorial Discovery : événements, guides, actualités et recommandations.
2. Collector Discovery : Key Issues, variantes, couvertures et numéros importants.
3. Community Discovery : tendances, classements et recommandations communautaires.
4. Industry Discovery : sorties, annonces, éditeurs, séries et créateurs.
5. Visual Discovery : exploration visuelle de l'ensemble du catalogue grâce à des images pertinentes et de haute qualité.

L'expérience doit être visuellement riche. Les couvertures et illustrations ne doivent pas être considérées comme des éléments décoratifs secondaires, mais comme des données essentielles du produit.

## Principes fondamentaux

- Couverture de tous les éditeurs disposant de données exploitables.
- Images associées aux bonnes entités et éditions.
- Données et images traçables.
- Respect des droits et licences.
- Importation automatisée, contrôlée et reproductible.
- Aucun contenu incertain présenté comme vérifié.
- Interface responsive et cohérente sur web et Android.
- Architecture capable d'absorber une augmentation importante du volume de données et d'images.

---

# 2. PÉRIMÈTRE FONCTIONNEL

Explorer comprend les modules suivants :

1. Accueil Explorer.
2. Événements et crossovers.
3. Key Issues.
4. Classements et tendances.
5. Sorties et calendrier.
6. Guides de lecture.
7. Univers et personnages.
8. Séries et créateurs.
9. Actualités et contenus éditoriaux.
10. Recherche globale.
11. Découverte personnalisée.
12. Gestion des images.
13. Administration éditoriale.

Tous les modules doivent être capables d'utiliser le même système centralisé de gestion des images.

---

# 3. SYSTÈME CENTRALISÉ DE GESTION DES IMAGES

## 3.1 Objectif

Créer une infrastructure commune permettant de rechercher, importer, identifier, stocker, traiter, actualiser et afficher les images associées à l'ensemble du contenu de Panel.

Le système doit fonctionner indépendamment de l'interface Explorer.

Il doit pouvoir être réutilisé ultérieurement dans les autres parties de Panel, notamment (*Révision 2* : en tant qu'**infrastructure commune** ; chaque module garde son propre usage, et les imports d'Explorer ne modifient jamais les enregistrements personnels de Collection — contrat S4) :
- Collection.
- Fiches de comics.
- Fiches de séries.
- Wishlist.
- Pull List.
- Guides.
- Profils.
- Listes communautaires.
- Publications communautaires.

## 3.2 Couverture visuelle obligatoire

Le système doit prendre en charge :

### Comics
- Couverture principale.
- Variantes.
- Éditions alternatives.
- Éditions spéciales.
- Recueils.
- Graphic novels.
- Omnibus.
- Trade paperbacks.
- Hardcover.

### Événements
- Illustration principale.
- Couvertures des numéros associés.
- Couvertures des mini-séries.
- Visuels promotionnels autorisés.
- Illustrations éditoriales.

### Key Issues
- Couverture principale.
- Variantes.
- Différentes éditions.
- Images associées à une apparition ou un événement historique.

### Séries
- Illustration principale.
- Couvertures représentatives.
- Visuels promotionnels autorisés.

### Personnages et équipes
- Portrait.
- Illustration principale.
- Images associées à des périodes ou incarnations, si les sources le permettent.

### Créateurs
- Portrait.
- Illustration ou photographie autorisée.
- Visuel de présentation.

### Éditeurs
- Logo.
- Image de présentation.
- Identité visuelle autorisée.

### Guides et contenus éditoriaux
- Image de couverture.
- Bannière.
- Miniatures.
- Images des comics inclus dans le guide.
- Illustrations de présentation.

### Classements et tendances
- Couvertures des comics classés.
- Images des séries et éditeurs.
- Visuels des nouveautés.

Toutes ces catégories doivent pouvoir fonctionner avec une image principale, des images secondaires et des variantes selon leur pertinence.

## 3.3 Architecture de stockage

**Cloudflare R2 est le stockage central des fichiers images.**

Supabase ne doit pas être utilisé comme stockage principal des images d'Explorer.

Répartition des responsabilités :

| Infrastructure | Responsabilité |
|---|---|
| Supabase PostgreSQL | Métadonnées, relations, provenance, droits, état des imports |
| Cloudflare R2 | Fichiers images originaux et versions optimisées |
| Service de traitement | Validation, conversion, redimensionnement et génération des variantes |
| CDN / cache | Livraison rapide des images |
| Pipeline d'importation | Recherche, acquisition autorisée, validation et actualisation |

Le système doit utiliser une architecture compatible avec l'API S3 de Cloudflare R2.

Il doit être possible de changer de fournisseur de stockage ultérieurement sans réécrire les modules Explorer.

## 3.4 Organisation des fichiers

Utiliser des clés d'objets déterministes, indépendantes des noms de fichiers originaux.

Exemple conceptuel :

- `publishers/{publisher_id}/`
- `comics/{issue_id}/`
- `series/{series_id}/`
- `events/{event_id}/`
- `characters/{character_id}/`
- `creators/{creator_id}/`
- `guides/{guide_id}/`
- `editorial/{content_id}/`

Chaque image doit posséder un identifiant stable en base de données.

Ne pas construire les chemins de stockage uniquement à partir des titres des comics : les titres peuvent changer et contenir des caractères problématiques.

## 3.5 Modèle de données des images

Créer un registre central des images.

Chaque image doit pouvoir contenir :

- Identifiant interne.
- Entité associée.
- Type d'entité.
- Source d'origine.
- URL source, si applicable.
- Clé de stockage R2.
- Type d'image.
- Format original.
- Format optimisé.
- Dimensions.
- Taille du fichier.
- Hash de contenu.
- Date d'importation.
- Date de dernière vérification.
- Statut de traitement.
- Statut de validation.
- Informations de licence.
- Conditions d'utilisation.
- Attribution éventuelle.
- Statut de publication.
- Historique des modifications.

Une image peut être associée à plusieurs entités lorsque cette relation est justifiée.

Les relations entre images et entités doivent être gérées explicitement.

## 3.6 Importation massive initiale

Le système doit permettre de constituer un premier fonds d'images avant le lancement public d'Explorer 2.0.

Processus :

1. Identifier les entités du catalogue sans image.
2. Rechercher les images disponibles dans les sources autorisées.
3. Récupérer les informations bibliographiques associées.
4. Comparer les résultats avec les identifiants canoniques Panel.
5. Vérifier les correspondances entre série, numéro, édition et variante.
6. Contrôler les droits de téléchargement et de stockage.
7. Importer les images autorisées.
8. Enregistrer les fichiers dans R2.
9. Générer les versions optimisées.
10. Mettre à jour les métadonnées PostgreSQL.
11. Vérifier l'accessibilité des images.
12. Produire un rapport complet.

L'import doit fonctionner par lots, avec possibilité de reprendre un traitement interrompu.

### Priorisation

L'import initial doit traiter en priorité :

1. Comics les plus demandés, selon un **signal agrégé et anonyme** (contrat S3). *Révision 2* : Explorer ne lit pas les collections individuelles.
2. Comics des séries populaires.
3. Événements et guides existants.
4. Key Issues.
5. Sorties récentes et à venir.
6. Personnages et équipes les plus consultés.
7. Autres entités du catalogue.

La priorité ne doit pas empêcher la couverture progressive du reste du catalogue.

## 3.7 Importation progressive et actualisation

Après l'import initial, le système doit continuer à enrichir les images.

Déclencheurs possibles :

- Création d'une nouvelle entité.
- Import d'un nouveau numéro.
- Ajout d'un événement.
- Publication d'un guide.
- Consultation d'une fiche dépourvue d'image.
- Détection d'une image cassée.
- Nouvelle version disponible auprès d'une source autorisée.
- Correction manuelle par l'équipe éditoriale.

L'importation progressive ne doit pas bloquer l'affichage de l'interface.

Une fiche sans image doit afficher un placeholder adapté pendant le traitement.

## 3.8 Moteur de correspondance des images

Le système doit éviter les mauvaises associations.

La correspondance doit tenir compte de :

- Identifiant externe.
- Identifiant canonique Panel.
- Éditeur.
- Série.
- Numéro.
- Volume.
- Année.
- Édition.
- Variante.
- Date de publication.

Les correspondances doivent être classées par niveau de confiance.

Trois comportements :

**Confiance élevée :** import automatique si les droits sont vérifiés.

**Confiance intermédiaire :** proposition à valider.

**Confiance faible :** aucune association automatique.

Une couverture d'une autre édition ne doit jamais être substituée silencieusement à celle recherchée.

## 3.9 Traitement des images

Le service de traitement doit pouvoir :

- Vérifier les formats.
- Vérifier les dimensions.
- Contrôler les fichiers corrompus.
- Détecter les doublons.
- Calculer un hash.
- Générer des miniatures.
- Générer des versions intermédiaires.
- Optimiser les images.
- Convertir les formats lorsque cela est pertinent.
- Préserver une version originale lorsque les droits le permettent.

Formats de sortie à privilégier :
- WebP.
- AVIF lorsque compatible avec la chaîne de traitement.
- JPEG ou PNG lorsque nécessaire.

Les images originales doivent être conservées uniquement lorsque les conditions de licence et de stockage l'autorisent.

Le traitement doit être effectué par un service serveur ou un worker dédié. R2 est le stockage : il ne doit pas être considéré comme un moteur de transformation d'images.

## 3.10 Variantes d'affichage

Prévoir plusieurs tailles :

- Thumbnail : petites listes et résultats de recherche.
- Card : cartes Explorer.
- Cover : couvertures standard.
- Detail : fiches détaillées.
- Hero : bannières et mises en avant.

Les images doivent conserver leurs proportions d'origine lorsque le contenu est une couverture.

Les bannières et visuels éditoriaux peuvent utiliser des ratios différents.

Éviter les recadrages automatiques qui coupent les titres, crédits ou éléments importants des couvertures.

## 3.11 Gestion des droits

Le système doit distinguer :

- Image hébergée par Panel avec autorisation.
- Image hébergée par un fournisseur externe.
- Image référencée sans copie locale.
- Image fournie par un utilisateur.
- Image sous licence spécifique.
- Image dont les droits sont inconnus.

Une URL publique n'autorise pas automatiquement le téléchargement ou la redistribution.

Pour chaque source :
- Vérifier les conditions d'utilisation.
- Identifier les droits de stockage.
- Identifier les droits de transformation.
- Identifier les droits d'affichage.
- Vérifier les obligations d'attribution.
- Respecter les restrictions géographiques ou commerciales.

En cas de droits inconnus, ne pas importer automatiquement l'image dans R2.

Prévoir une possibilité de retrait et de remplacement d'une image.

## 3.12 Administration des images

Créer une interface permettant :

- De consulter les images manquantes.
- De consulter les images cassées.
- De lancer des imports ciblés.
- De relancer un import.
- De remplacer une image.
- De valider une correspondance.
- De consulter les variantes.
- De consulter la source.
- De vérifier les droits.
- De comparer les images.
- De consulter les erreurs.
- De visualiser les statistiques de stockage.

L'administration doit permettre un traitement en masse, avec confirmation avant toute opération destructive.

---

# 4. MODULE ÉVÉNEMENTS

Construire un catalogue couvrant tous les éditeurs dont les données sont accessibles.

Types :
- Événements majeurs.
- Crossovers.
- Sagas.
- Événements de séries.
- Initiatives éditoriales.
- Relances.
- Événements inter-éditeurs.

Chaque événement possède :
- Informations générales.
- Éditeur.
- Période.
- Description.
- Image principale.
- Galerie de visuels autorisés.
- Série principale.
- Mini-séries.
- Tie-ins.
- Prologues.
- Épilogues.
- Ordres de lecture.
- Sources.
- Relations avec d'autres événements.
- Niveau de complétude.
- Statut de validation.

Chaque entrée de lecture doit pouvoir afficher la couverture exacte du numéro concerné.

Les ordres de lecture comprennent :
- Publication.
- Chronologie narrative.
- Recommandation Panel.
- Parcours personnalisé.

Les guides existants du Lot 2.6 doivent être réutilisés.

---

# 5. MODULE KEY ISSUES

Créer une base des numéros importants.

Catégories :
- First Appearance.
- First Full Appearance.
- Cameo Appearance.
- First Team Appearance.
- First Origin.
- Important Death.
- Character Return.
- First Costume Appearance.
- Iconic Cover.
- Landmark Issue.
- Major Event Issue.

Niveaux :
- Major Key.
- Minor Key.
- Historical Key.
- Cultural Key.
- Collector Key.

Chaque fiche doit contenir :
- Comic.
- Série.
- Numéro.
- Éditeur.
- Date.
- Personnage associé.
- Catégorie.
- Importance.
- Justification.
- Sources.
- Statut de validation.
- Couverture.
- Variantes disponibles.

La classification doit reposer sur une justification éditoriale. Le prix d'un comic ne doit pas déterminer automatiquement son importance.

---

# 6. MODULE CLASSEMENTS ET TENDANCES

Distinguer deux systèmes indépendants.

## 6.1 Classements commerciaux

Données provenant de sources externes exploitables.

Afficher :
- Source.
- Période.
- Méthodologie.
- Périmètre géographique.
- Date de mise à jour.
- Limites.

Ne jamais présenter un classement partiel comme les ventes mondiales complètes.

## 6.2 Classements communautaires Panel

*Révision 2* : ces indicateurs proviennent **uniquement** du service d'agrégation dédié (contrat S3) : collecte autorisée, seuil d'anonymat, aucun accès d'Explorer aux inventaires individuels, aucune collection exposée sans autorisation, aucune modification des données de Collection.

Indicateurs possibles :
- Ajouts en collection.
- Ajouts en wishlist.
- Lectures déclarées.
- Séries suivies.
- Recommandations.
- Listes contenant le comic.
- Avis.
- Progression de popularité.

Créer :
- Top hebdomadaire.
- Top mensuel.
- Top par éditeur.
- Séries populaires.
- Comics populaires.
- Personnages populaires.
- Nouveautés populaires.
- Plus fortes progressions.

Chaque entrée de classement doit afficher sa couverture.

Les calculs doivent être réalisés par traitements planifiés et agrégations, pas à chaque affichage de page.

Le système doit limiter :
- Doublons d'actions.
- Actions automatisées.
- Manipulation des classements.
- Comptes suspendus.
- Activité anormale.

---

# 7. MODULE SORTIES

Calendrier :
- Sorties de la semaine.
- Sorties du mois.
- Prochaines sorties.
- Nouveaux numéros.
- Nouvelles séries.
- Recueils.
- Variantes.
- Reports.

Chaque sortie doit être associée à son image exacte, lorsque disponible et autorisée.

Une nouvelle image peut déclencher une actualisation automatique de la fiche concernée.

---

# 8. MODULE GUIDES

Conserver le système réalisé en Lot 2.6.

Enrichissements :
- Couvertures de chaque numéro.
- Image de présentation.
- Galerie.
- Guides par personnage.
- Guides par événement.
- Guides par série.
- Guides chronologiques.
- Guides par période éditoriale.
- Guides officiels Panel.
- Guides communautaires validés.
- Progression personnelle (*Révision 2* : donnée personnelle, affichée via le contrat S1 ; voir la décision A3).

Les couvertures doivent être reliées aux entrées du catalogue, et non importées séparément à chaque création de guide.

---

# 9. PERSONNAGES, SÉRIES, CRÉATEURS ET ÉDITEURS

Chaque fiche doit proposer :
- Image principale.
- Images secondaires si disponibles.
- Informations bibliographiques.
- Relations avec d'autres entités.
- Comics associés.
- Événements associés.
- Guides associés.
- Classements et tendances.

Les images doivent être partagées via le registre central.

---

# 10. ARCHITECTURE TECHNIQUE

## 10.1 Architecture générale

- Frontend Panel existant.
- Supabase Auth.
- Supabase PostgreSQL.
- API et fonctions serveur.
- Cloudflare R2.
- Worker d'importation.
- Worker de traitement d'images.
- Système de tâches et de reprises.
- Cache/CDN.
- Recherche.
- Moteur de classements.
- Administration éditoriale.

L'architecture frontend doit être déterminée après inspection du repository existant.

## 10.2 Répartition des responsabilités

**Supabase**
- Comptes.
- Données catalogue.
- Relations éditoriales.
- Métadonnées des images.
- Sources et licences.
- État des imports.
- Permissions.
- Historique.

**Cloudflare R2**
- Images autorisées.
- Versions originales lorsque permises.
- Miniatures.
- Versions optimisées.
- Visuels éditoriaux autorisés.

**Workers**
- Import.
- Validation.
- Déduplication.
- Conversion.
- Génération des variantes.
- Actualisation.
- Nettoyage contrôlé.

**CDN et cache**
- Distribution.
- Mise en cache.
- Réduction des téléchargements répétés.
- Chargement rapide sur web et Android.

## 10.3 Tables indicatives

Ne pas recréer les tables déjà existantes dans le catalogue.

*Révision 2* : les tables éditoriales et média vivent dans les schémas `catalog`, `editorial`, `media` et `community`, **séparés** du schéma personnel `app` (Collection). Aucune jointure entre tables personnelles et éditoriales pour l'affichage d'Explorer. Les guides du lot 2.6 existent localement (magasin `editorial`) : `reading_guides` et `guide_entries` en seront la version serveur.

Tables éditoriales possibles :
- events.
- event_entries.
- event_relations.
- key_issues.
- key_issue_sources.
- reading_guides.
- guide_entries.
- editorial_content.
- ranking_sources.
- sales_rankings.
- popularity_snapshots.
- ranking_snapshots.
- data_sources.
- import_jobs.
- editorial_reviews.
- change_history.

Tables du système d'images :
- media_assets.
- media_entity_links.
- media_sources.
- media_rights.
- media_variants.
- media_import_jobs.
- media_processing_jobs.
- media_audit_logs.

Les noms et relations définitifs doivent être adaptés au schéma réel.

## 10.4 File d'attente des imports

Créer une file persistante.

Chaque tâche doit comporter :
- Type de tâche.
- Entité concernée.
- Source.
- Priorité.
- Statut.
- Nombre de tentatives.
- Date de création.
- Date de dernière tentative.
- Dernière erreur.
- Prochaine tentative.
- Résultat.

Statuts :
- Pending.
- Processing.
- Completed.
- Needs Review.
- Failed.
- Cancelled.

Prévoir :
- Reprises automatiques.
- Backoff progressif.
- Limitation du débit.
- Traitement par lots.
- Idempotence.
- Journalisation.
- Annulation.
- Reprise après interruption.

Ne pas lancer des milliers de téléchargements simultanés.

## 10.5 Déduplication

Utiliser :
- Hash cryptographique du fichier.
- Identifiants de source.
- Identifiants canoniques.
- Relations entre entités.
- Dimensions et métadonnées.

Deux images identiques ne doivent pas nécessairement être stockées deux fois.

Cependant, deux couvertures visuellement proches ne doivent pas être considérées automatiquement comme identiques.

## 10.6 Accès et sécurité

- Les clés R2 restent côté serveur.
- Aucun secret dans le frontend.
- Les opérations d'import nécessitent des permissions.
- Les fichiers entrants doivent être contrôlés.
- Limiter les types MIME.
- Vérifier les signatures réelles des fichiers.
- Limiter la taille.
- Protéger les endpoints.
- Prévenir les abus et téléchargements malveillants.
- Appliquer les politiques RLS sur les métadonnées sensibles.

Les images publiques autorisées peuvent être distribuées par URL CDN. Les images privées doivent utiliser un mécanisme d'accès adapté.

## 10.7 Performance

- Chargement différé.
- Images responsive.
- Miniatures.
- Cache CDN.
- Pagination.
- Compression.
- Formats modernes.
- Préchargement limité des images prioritaires.
- Éviter les requêtes N+1.
- Ne pas recalculer les classements à chaque consultation.

L'interface doit afficher une image de remplacement élégante lorsque l'image n'est pas encore disponible.

---

# 11. SOURCES ET DROITS

Sources à étudier :
- Comic Vine.
- Metron.
- Sites officiels des éditeurs.
- Sources bibliographiques ouvertes.
- Fournisseurs d'images sous licence.
- Contributions communautaires.

Aucune source ne doit être considérée comme libre de droits par défaut.

Pour chaque intégration, vérifier :
- Accès API.
- Conditions d'utilisation.
- Droit de téléchargement.
- Droit de stockage.
- Droit de transformation.
- Droit d'affichage.
- Attribution.
- Restrictions commerciales.

Prévoir une architecture multi-source pour ne pas dépendre d'un fournisseur unique.

---

# 12. INTERFACE EXPLORER 2.0

La nouvelle interface doit être conçue autour des visuels.

Sections :
- À la une.
- Événements.
- Key Issues.
- Classements.
- Sorties.
- Guides.
- Univers.
- Personnages.
- Séries.
- Créateurs.

Principes :
- Couvertures visibles.
- Cartes illustrées.
- Galeries.
- Bannières.
- Hiérarchie éditoriale.
- Filtres rapides.
- Recherche globale.
- Navigation mobile adaptée.
- États de chargement.
- Placeholders cohérents.

Ne pas remplir la page avec des blocs textuels génériques.

La qualité visuelle doit être contrôlée sur les données réelles, et pas uniquement sur des données de démonstration.

---

# 13. ADMINISTRATION

Créer une interface permettant de gérer :

**Contenus**
- Événements.
- Key Issues.
- Guides.
- Classements.
- Sorties.
- Articles.
- Mises en avant.

**Images**
- Images manquantes.
- Imports.
- Images cassées.
- Correspondances douteuses.
- Variantes.
- Droits.
- Remplacements.
- Erreurs.
- Statistiques R2.

**Données**
- Sources.
- Imports.
- Doublons.
- Corrections.
- Validation.
- Historique.
- Restauration.

**Contributions**
- Propositions communautaires.
- Corrections.
- Signalements.
- Validation.
- Rejet.

Les permissions doivent être appliquées côté serveur.

---

# 14. ROADMAP DÉFINITIVE

## Prérequis : Phase 3

Stabiliser les comptes, la synchronisation, les sauvegardes, les permissions et les fondations backend avant de construire Explorer 2.0.

## Phase 4 — Explorer 2.0

### Lot 4.1 — Audit et architecture

- Audit du Lot 2.6, dont les couplages avec Collection (C1 à C10, document 02).
- Conception des contrats S1 à S6 et du test statique de frontière.
- Audit du catalogue.
- Inventaire des images existantes.
- Identification des images manquantes.
- Audit des sources.
- Vérification des licences.
- Architecture des données.
- Architecture R2.
- Définition des contrats d'API.
- Plan de migration.

**Livrable :** architecture technique validée.

### Lot 4.2 — Fondations éditoriales et Media Infrastructure

- Modèles éditoriaux.
- Registre central des images.
- Intégration Cloudflare R2.
- Configuration des accès.
- Gestion des métadonnées.
- Gestion des droits.
- File d'attente.
- Worker d'importation.
- Worker de traitement.
- Déduplication.
- Génération des variantes.
- Interface technique de diagnostic.

**Livrable :** infrastructure éditoriale et images opérationnelle.

### Lot 4.3 — Import massif initial

- Inventaire du catalogue.
- Identification des images manquantes.
- Importation par lots.
- Priorisation des entités.
- Correspondance avec les identifiants canoniques.
- Contrôle des droits.
- Génération des formats optimisés.
- Vérification des fichiers.
- Rapport de couverture visuelle.

**Livrable :** premier fonds d'images exploitable dans Panel.

### Lot 4.4 — Événements 2.0

- Catalogue multi-éditeurs.
- Fiches détaillées.
- Images principales.
- Galeries.
- Couvertures des numéros.
- Relations entre événements.
- Ordres de lecture.
- Progression.
- Sources et validation.

**Livrable :** système complet d'événements illustrés.

### Lot 4.5 — Key Issues

- Catégories.
- Major/Minor Keys.
- Fiches détaillées.
- Justifications.
- Sources.
- Couvertures.
- Variantes.
- Filtres.
- Relations avec le catalogue.

**Livrable :** base de Key Issues illustrée.

### Lot 4.6 — Sorties et classements commerciaux

- Calendrier.
- Sources commerciales.
- Classements.
- Historique.
- Images des sorties.
- Couvertures.
- Variantes.
- Méthodologies.

**Livrable :** calendrier et classements commerciaux.

### Lot 4.7 — Popularité communautaire

- Agrégation des signaux.
- Calcul des scores.
- Classements.
- Tendances.
- Historique.
- Anti-manipulation.
- Couvertures des résultats.

**Livrable :** moteur de popularité Panel.

### Lot 4.8 — Importation progressive et actualisation

- Déclencheurs automatiques.
- Détection des images manquantes.
- Actualisation des images.
- Gestion des erreurs.
- Reprises.
- Contrôle des images cassées.
- Imports ciblés.
- Rapports.

**Livrable :** système d'images maintenu à jour.

### Lot 4.9 — Explorer Home et recherche

- Nouvelle page d'accueil, dans une **section et une navigation propres** à Explorer (décision A6).
- Réacheminement des couplages du lot 2.6 par les contrats S1 et S2, sans changement fonctionnel pour Collection.
- Cartes illustrées.
- Sections.
- Recherche globale.
- Filtres.
- Découverte personnalisée.
- Intégration des couvertures.
- Optimisation mobile.
- Tests visuels.

**Livrable :** Explorer 2.0 complet côté utilisateur.

### Lot 4.10 — Administration et contributions

- Administration éditoriale.
- Gestion des images.
- Imports manuels.
- Validation des données.
- Contributions communautaires.
- Modération.
- Historique.
- Statistiques.

**Livrable :** outils opérationnels.

### Lot 4.11 — Qualité et lancement

- Tests fonctionnels.
- Tests de sécurité.
- Tests de performance.
- Tests d'import.
- Tests de stockage.
- Tests de correspondance.
- Tests de droits.
- Tests Android.
- Tests web.
- Vérification de l'intégrité.
- Vérification des images.
- Validation finale.

**Livrable :** Explorer 2.0 prêt pour une bêta contrôlée.

---

# 15. CRITÈRES D'ACCEPTATION

Explorer 2.0 doit satisfaire les critères suivants :

1. Les événements peuvent être créés pour tous les éditeurs pris en charge.
2. Les événements possèdent des fiches structurées.
3. Les couvertures des numéros sont correctement associées.
4. Les Key Issues disposent de catégories et de justifications.
5. Les images des Key Issues sont correctement associées.
6. Les classements commerciaux affichent leurs sources.
7. Les classements communautaires utilisent des données réelles.
8. Les couvertures apparaissent dans les classements.
9. Le calendrier présente les sorties disponibles.
10. Les guides existants sont conservés et enrichis.
11. La recherche couvre les catégories principales.
12. Les imports sont traçables.
13. Les images autorisées sont stockées dans R2.
14. Les images non autorisées ne sont pas copiées dans R2.
15. L'import massif peut être interrompu et repris.
16. L'import progressif fonctionne sans bloquer l'interface.
17. Les doublons sont détectés.
18. Les mauvaises correspondances sont évitées ou soumises à validation.
19. Les images possèdent des variantes optimisées.
20. Les images cassées peuvent être détectées et corrigées.
21. L'administration permet de gérer les images et leurs droits.
22. Les contributions passent par un système de validation.
23. Les interfaces web et Android sont correctement optimisées.
24. Les performances restent acceptables avec un volume important d'images.
25. Aucune régression n'est introduite dans la collection et le catalogue.
26. *Révision 2* : Explorer s'affiche entièrement pour un visiteur non connecté et pour un utilisateur sans collection.
27. *Révision 2* : le test statique de frontière passe (aucune référence d'Explorer aux structures internes de Collection).
28. *Révision 2* : un rôle éditorial ou d'administration ne lit aucune donnée personnelle (tests RLS).
29. *Révision 2* : les classements communautaires ne contiennent que des agrégats au-dessus du seuil d'anonymat.
30. *Révision 2* : aucun import, classement ou tâche planifiée ne modifie une donnée de Collection (empreinte des données personnelles identique avant et après).

---

# 16. INDICATEURS DE QUALITÉ VISUELLE

Le projet doit mesurer la couverture visuelle.

Indicateurs :
- Pourcentage de comics possédant une couverture autorisée.
- Pourcentage de séries possédant une image.
- Pourcentage d'événements illustrés.
- Pourcentage de Key Issues illustrés.
- Pourcentage de guides illustrés.
- Pourcentage de fiches personnages illustrées.
- Nombre d'images manquantes.
- Nombre d'images cassées.
- Nombre d'images en attente de validation.
- Nombre de correspondances incertaines.

Il faudra définir des seuils de couverture avant le lancement bêta.

Les images non disponibles doivent être clairement identifiées et ne doivent pas être remplacées par des visuels arbitraires.

---

# 17. PRINCIPES DE LIVRAISON

- Développer lot par lot.
- Auditer avant toute modification structurelle.
- Préserver les données de l'utilisateur.
- Réutiliser les composants et données existants.
- Ne pas supprimer les fonctionnalités de Lot 2.6.
- Ne pas modifier les données de collection sans sauvegarde et validation.
- Ne pas pousser de code.
- Ne pas déployer sans autorisation.
- Ne pas créer d'abonnements ou de dépenses sans autorisation.
- Ne pas explorer d'autres repositories ou projets.
- Fournir un rapport détaillé à la fin de chaque lot.
- Arrêter et demander validation avant toute opération destructive ou irréversible.

---

# 18. DÉFINITION DU SUCCÈS

Explorer doit permettre à un utilisateur de découvrir un événement, de consulter sa couverture, d'explorer les numéros associés, de voir leurs Key Issues, de consulter les tendances et d'ajouter les comics à sa collection (*Révision 2* : par une commande envoyée à Collection, qui l'exécute — contrat S2).

Il doit également pouvoir parcourir des classements illustrés, découvrir des séries, des personnages et des créateurs, et profiter de guides visuellement riches.

Le système d'images doit fonctionner en arrière-plan, de manière fiable et continue.

**Vision finale :**

Découvrir → Comprendre → Lire → Collectionner → Partager.

Panel doit devenir une plateforme de référence pour découvrir et explorer les comics, avec des données fiables, une profondeur éditoriale réelle et une expérience visuelle à la hauteur de son ambition.
