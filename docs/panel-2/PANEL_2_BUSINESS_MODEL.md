# PANEL 2.0 — Modèle économique

Ce document prolonge les décisions et hypothèses du PRD V1 : le social essentiel reste gratuit (PRD-D9), offre **PANEL Plus** entre 3 et 5 € par mois (hypothèse H6 ; proposition Q5 : 3,99 €/mois ou 39,99 €/an, essai de 14 jours), paiement par Stripe (PRD-D7). Aucun service payant n'est créé par cette mission.

## 1. Principe

**La connaissance vérifiée est un bien commun ; le confort et les outils avancés sont payants.** Rendre Source ou Canon payants détruirait l'effet de réseau dont dépendent la contribution et la vérification.

## 2. Répartition

### Gratuit, indispensable

| Domaine | Inclus |
|---|---|
| Collection | Collection complète, variantes, emplacements, import/export, scanner (existant aujourd'hui, local) |
| Lecture, Sorties | Journal, séries en cours, calendrier, Pull List, Wishlist |
| Explorer | Toutes les fiches, sources, historique, Canon, Multiverse, Edition Intelligence en consultation |
| Communauté | Profil, fil, publications, débats, votes, signalements |
| Contribution | Proposer, relire, valider selon son rôle ; dossiers Lab publics |
| Données personnelles | Export complet, suppression |

### PANEL Plus (abonnement)

| Fonction | Domaine | Coût pour PANEL |
|---|---|---|
| Statistiques avancées de collection et de lecture | Collection, Lecture | Faible |
| Alertes avancées (variantes, VF d'une série suivie, rééditions) | Edition Intelligence, Sorties | Faible à moyen (traitements périodiques) |
| Comparateur d'éditions détaillé et vues d'ensemble (« ce qui me manque en VF ») | Edition Intelligence × Collection, sur l'appareil | Faible |
| Dossiers Lab privés et collaboration étendue | Lab | Moyen (stockage) |
| Quotas élevés d'assistance IA | IA (si activée, DR-05) | Variable, à plafonner |
| Personnalisation du profil, thèmes | Communauté | Nul |
| Sauvegarde et synchronisation multi-appareils étendues | Core | Moyen (stockage) |

### Services professionnels

| Service | Public | Remarque |
|---|---|---|
| Outils pour librairies et boutiques : référencement VO/VF, disponibilité, événements | Librairies spécialisées | Partenariats transparents, aucune mise en avant non signalée |
| Outils pour éditeurs : fiches officielles vérifiées, calendrier, correspondances | Éditeurs | Les fiches éditeur passent les mêmes revues que les autres |
| Outils pour organisateurs (festivals, dédicaces) | Organisateurs | Agenda, sans données personnelles des participants |
| Rapports Signal agrégés | Professionnels | Toujours étiquetés « observé sur PANEL », jamais présentés comme le marché |

### Facturation à l'usage

| Service | Base |
|---|---|
| API Open au-delà d'un quota gratuit | Nombre de requêtes |
| Widgets pour sites tiers à fort trafic | Nombre d'affichages |
| Exports de données en volume (quand la licence le permet) | Volume |

## 3. Coûts techniques à prévoir

Ordres de grandeur **à vérifier** (inconnus tant que l'audience n'est pas mesurée) :

| Poste | Moteur de coût | Mitigation |
|---|---|---|
| Base Supabase | Taille des tables documentaires, connexions | Monolithe, index ciblés, archivage des révisions anciennes |
| Recherche | Postgres plein texte jusqu'à environ 1 million de fiches (PRD-D5) | Moteur dédié seulement au-delà |
| Images (R2) | Stockage des images autorisées | Pas de frais de sortie (PRD-D6) ; pas d'images non autorisées |
| Traitements documentaires | Vérification des liens, détection de conflits | Traitements par lots, périodiques |
| IA | Volume de texte traité | Optionnelle, quotas, fonctions locales d'abord |
| Modération | **Temps humain**, le poste le plus lourd | Ouverture par paliers ; outils de file de modération (0013) |
| Audio en direct (Debate) | Serveur audio, bande passante | Reporté ; débat asynchrone d'abord |

## 4. Scénarios

| Scénario | Hypothèse | Conséquence |
|---|---|---|
| Prudent | Lancement francophone, quelques milliers de membres, taux de conversion Plus faible | Coûts d'infrastructure modestes ; la modération bénévole et le temps du porteur du projet sont la contrainte |
| Central | Communauté active, contributions régulières, premiers partenariats de librairies | Plus couvre l'infrastructure ; services professionnels financent la modération |
| Ambitieux | Ouverture internationale, API utilisée | Facturation de l'API et des services pro ; recrutement d'une équipe de modération |

Les taux de conversion, prix et volumes sont **des hypothèses à tester en bêta**, pas des prévisions.

## 5. Garde-fous

- Pas de publicité ciblée sur la base de la collection.
- Pas de vente de données personnelles.
- Partenariats toujours signalés comme tels.
- Une information vérifiée n'est jamais réservée aux abonnés.
