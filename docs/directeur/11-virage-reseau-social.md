# 11 — Virage « réseau social comics » (D-91, 20 novembre 2026)

Demande de l'utilisateur (20/11/2026) : des applications et sites francophones commencent à proposer la gestion de collection. Panel devient d'abord **un réseau social de fans de comics**, la collection restant au cœur : un mélange de Twitter (conversation), d'Instagram (images, profil, algorithme) et de TikTok (directs, format vertical), le plus original possible, épuré, sans boutons partout, prêt à être commercialisé.

Ce document remplace, pour la communauté, deux principes du rebaseline (08) : « tri chronologique par défaut (pas d'algorithme au lancement) » devient **un fil classé par un algorithme transparent et réglable**, l'onglet « Abonnements » restant strictement chronologique ; « la communauté avant la collection » devient **la collection comme identité sociale**.

## 1. Nouvelle promesse

> **Panel, c'est l'endroit où tu montres tes comics, où tu en parles et où tu en découvres, sans spoiler.**

Trois idées que les gestionnaires de collection n'ont pas :
1. **La collection se montre** : chaque numéro publié devient un objet en 3D qu'on fait tourner (recto, dos, tranche), pas une ligne de tableau.
2. **Le fil connaît ta lecture** : il cache les spoilers des numéros que tu n'as pas encore lus (le suivi de lecture existe déjà dans Panel).
3. **Le fil parle comics** : il rapproche les gens par leurs séries, leurs événements, leur pull list, pas seulement par leurs « j'aime ».

## 2. Ce qu'on garde, ce qu'on enlève

| Garder | Simplifier ou masquer | Enlever de l'interface |
|---|---|---|
| Collection, wishlist, pull list, suivi de lecture, sorties, Event Center (R2), trophées, rangs, artefacts | Fiche d'ajout : série, numéro, couverture/variante, état simple, photos ; le reste replié | **Gradation** (société, note du slab, étiquette, certificat, signature) : retirée des formulaires et des fiches. Les données déjà saisies restent stockées et exportées (aucune suppression) |
| Finances (privées, jamais publiées) | Rangées dans le profil, hors de la navigation principale | Boutons redondants de la barre latérale |

Règles conservées : aucune donnée inventée (aucun compte, abonné, message ni réaction simulé), finances et emplacements jamais publiés, manga et hors-périmètre exclus (D-41, D-54), local-first tant que les comptes en ligne ne sont pas actifs.

## 3. Navigation (cinq entrées)

| Entrée | Rôle | Inspiration |
|---|---|---|
| **Accueil** | Fil « Pour toi » (algorithme) et « Abonnements » (chronologique) | Instagram, Twitter |
| **Découvrir** | Recherche, tendances par série et événement, Event Center, sorties de la semaine | Explorer d'Instagram |
| **＋ Publier** | Une seule action : photo ou numéro en 3D (Vitrine 360), texte, avis, liste | Bouton central |
| **Directs** | Directs verticaux plein écran, à faire défiler ; le « Mercredi des sorties » en direct | TikTok Live |
| **Profil** | Grille des publications, étagère 3D de la collection, rang, artefacts ; collection, lecture et finances privées derrière | Instagram |

Sur ordinateur : la même navigation en colonne étroite, le fil au centre, une colonne « tendances » à droite.

## 4. Vitrine 360 (collection en 3D)

- Un numéro publié est rendu comme un **objet** : recto, verso, tranche, épaisseur, reflet ; on le fait tourner au doigt, à la souris ou en inclinant le téléphone (gyroscope, sur autorisation).
- Images : **les photos de l'utilisateur** (recto et, s'il veut, verso). Sans photo, la couverture déjà associée à la fiche ; un dos absent est dessiné neutre (couleur dominante de la couverture), jamais inventé.
- Rendu en CSS 3D (aucune bibliothèque ni CDN, CSP inchangée) ; mouvement réduit respecté (rotation désactivée, vue fixe).
- Variante originale : **l'étagère** du profil, où les numéros publiés sont rangés par la tranche ; un appui les sort de l'étagère.

## 5. Algorithme « Pour toi » — rétro-ingénierie d'Instagram

### 5.1 Ce qu'Instagram publie lui-même

Sources publiques : les fiches de transparence de Meta (« system cards » du fil, d'Explorer, des Reels et des stories, transparency.meta.com) et les explications d'Adam Mosseri (2023-2025). Points stables et documentés :

1. **Un classement par surface** (fil, stories, Explorer, Reels), chacun avec ses propres signaux.
2. **Étapes** : collecte des contenus candidats (abonnements, puis contenus recommandés), filtrage (contenus retirés ou déconseillés), prédiction de plusieurs actions, combinaison pondérée en un score, puis règles de diversité (pas plusieurs publications du même auteur à la suite).
3. **Prédictions** : probabilité d'aimer, de commenter, d'enregistrer, de partager (envoi en message), de passer du temps, d'ouvrir le profil ; pour les vidéos, de regarder jusqu'au bout.
4. **Signaux** : historique d'interactions avec l'auteur, activité de la personne (ce qu'elle aime, enregistre), popularité et fraîcheur du contenu, informations sur l'auteur.
5. **Les trois signaux les plus forts cités par Mosseri pour la découverte** : le temps de visionnage, les « j'aime » rapportés à la portée et les **envois rapportés à la portée** (un partage privé pèse plus qu'un « j'aime »).
6. **Originalité** : les comptes qui republient le contenu d'autrui sont rétrogradés au profit de l'original.
7. **Signaux négatifs** : « Pas intéressé », masquer, ignorer ; ils pèsent fortement.
8. **Contrôle** : choix du fil chronologique (« Abonnements ») et réglages des sujets.

Ce qui n'est pas public (poids exacts, modèles) n'est pas deviné : Panel fixe ses propres poids, versionnés et affichés.

### 5.2 Le classement de Panel

`score = Σ poids(action) × probabilité(action) × fraîcheur × originalité × sécurité-spoiler`

| Bloc | Signaux Panel | Spécifique comics |
|---|---|---|
| Affinité avec l'auteur | interactions passées, abonnement, réponses | séries et événements en commun, pull lists qui se recoupent |
| Intérêt pour le sujet | séries, personnages, éditeurs, créateurs suivis ou lus | progression de lecture (R2), wishlist |
| Qualité du contenu | enregistrements et envois rapportés à la portée, réponses argumentées | photo d'origine, Vitrine 360, avis long |
| Fraîcheur | décroissance de demi-vie 18 h (fil), 72 h (Découvrir) | « Mercredi des sorties » remonte les numéros du jour |
| Originalité | ×1 original, ×0,5 republication | photos prises par l'auteur |
| Négatif | masquer, « pas intéressé », blocage | mots coupés, spoilers non voulus |

Règles finales : au plus deux publications du même auteur sur dix ; au moins 30 % de contenus d'abonnements dans « Pour toi » ; un sujet ne dépasse pas 40 % de la page.

**Bouclier anti-spoiler** (original) : une publication liée à un numéro sorti depuis moins de 30 jours que tu n'as pas marqué « lu » est floutée, avec la mention « Spoiler : tu n'as pas encore lu #12 ».

**Transparence** : « Pourquoi je vois ça ? » sur chaque publication (les deux ou trois signaux les plus forts, en clair) et un réglage « Mon algorithme » (sujets à voir plus ou moins, remise à zéro).

**Démarrage à froid** : au premier lancement, choix de 3 séries ou personnages, puis la collection et la lecture déjà présentes sur l'appareil servent de signaux (calculés sur l'appareil, jamais envoyés sans compte).

Le module est pur (`domains/community/ranking-core.js`), testé, et calcule tout sur l'appareil tant que les comptes ne sont pas actifs. Sans comptes, il classe les vraies publications locales ; il ne fabrique aucun contenu.

## 6. Idées originales pour faire venir du monde

| Idée | Principe | Pourquoi ça attire |
|---|---|---|
| **Mercredi des sorties** | Chaque mercredi, un fil et un direct dédiés aux numéros du jour, ouverts depuis la pull list | Rendez-vous hebdomadaire, comme le New Comic Day des boutiques |
| **Duel de couvertures** | Deux variantes du même numéro, la communauté vote | Partage facile, très visuel |
| **Chasse aux variantes** | Liste d'une variante cherchée, ceux qui l'ont peuvent répondre | Entraide entre collectionneurs |
| **Carte de collectionneur** | Image à partager (rang, numéro préféré en 3D, chiffres non financiers) | Viralité hors de l'application |
| **Bouclier anti-spoiler** | Floute selon ta lecture réelle | Aucune autre application ne connaît ta lecture |
| **Étagère 3D** | Profil rangé comme une vraie étagère | Signature visuelle de Panel |

## 7. Ordre des lots

| Lot | Contenu | Dépend de |
|---|---|---|
| S0 | Ce document, décision D-91 — **fait** | — |
| S1 | Navigation à cinq entrées, design social (accueil = fil) — **fait (D-92)** ; la collection reste entière, dans la barre latérale et le Profil | S0 |
| S2 | Collection épurée : gradation retirée de l'interface (données conservées), fiche d'ajout réduite — **fait (gradation)** | S0 |
| S3 | Vitrine 360 (objet 3D, publication) et étagère du profil — **fait** (étagère : S1) | S1 |
| S4 | `ranking-core` (classement, diversité, anti-spoiler, « Pourquoi je vois ça ? ») — **fait**, branché sur le fil en S1 | S1 |
| S5 | Profil social (grille, étagère, rang, réglages privés) — **fait (D-93)** : étagère 3D, réglages publics, aperçu visiteur | S3 |
| S6 | Directs verticaux (sur le studio de direct existant) — **fait (D-94)** : scène 9:16, cartes verticales | S1 ; la diffusion réelle exige un serveur audio et vidéo |
| S7 | Mercredi des sorties, Duel, Chasse, Carte de collectionneur — **fait (D-95)** | S4, S5 |
| S7b | Pensées façon Twitter (mots-dièse, image, verdict des théories), J'aime personnalisé, Duel et chat en direct, voix seule — **fait (D-96)** | S6, S7 |
| S8 | Comptes en ligne et contenu des autres (préproduction Supabase) | Accord de l'utilisateur, CGU, modération |

Tant que S8 n'est pas fait, le réseau est **montré avec les seules publications de l'utilisateur** : aucune personne, aucun abonné, aucune réaction d'autrui n'est simulée.

## 8. Risques

- **Droits** : les photos de couvertures publiées sont celles de l'utilisateur ; les couvertures tirées des sources restent créditées. Les noms des éditeurs et personnages sont des marques de leurs ayants droit.
- **Modération** : un réseau social ouvert exige CGU, signalements, file de modération (déjà prévus côté base, D-73) avant toute ouverture publique.
- **Performance** : `index.html` pèse 1,9 Mo ; le rendu 3D reste en CSS, sans bibliothèque.
- **Mineurs** : âge minimal et réglages de confidentialité déjà prévus en base (D-73).
