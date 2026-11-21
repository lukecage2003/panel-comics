# Monétisation, musique et suite du virage social (D-98)

Statut au 21/11/2026 : **propositions**. Rien n'est vendu, aucun service de paiement ni de publicité n'est branché, aucun compte n'est créé.

## 1. Gagner de l'argent sans trahir les collectionneurs

Principe : la collection, le fil, les directs et les rencontres restent **gratuits et complets**. On ne vend jamais les données, ni l'attention par un fil truqué.

### 1.1 Gratuit, pour toujours

- La collection illimitée, la Wishlist, la Pull list et les Key Issues.
- Le fil, les pensées, les J'aime, les directs avec chat et les rencontres.
- Les 206 J'aime dessinés.

### 1.2 Panel+ (abonnement, environ 3 € par mois ou 30 € par an)

Seulement du confort, jamais de la visibilité achetée :

- Directs plus longs (plus de 60 min) et rediffusion audio gardée 30 jours.
- Thèmes d'étagère et cadres de profil (dessins de Panel).
- Statistiques avancées de la collection, restées privées.
- Exports (CSV, PDF d'assurance).
- Badge « Soutien » discret.

À prévoir avant le lancement :

- Paiement passant par les boutiques d'applications (Google Play Billing) et par un prestataire web. Aucun prestataire n'est choisi ni contacté.
- Remboursement dans les 14 jours (droit européen de rétractation).
- Résiliation en deux gestes.

### 1.3 Boutiques partenaires (revenu principal envisagé)

- Les boutiques de comics paient une fiche « Boutique vérifiée » : pull list en ligne, annonce du mercredi, organisation de rencontres sur place.
- Elles ont un intérêt direct : les rencontres en boutique (`meetupsCore`, thème « Mercredi des sorties ») leur amènent des clients.
- Les annonces des boutiques sont **étiquetées « Partenaire »**.
- Elles ne passent jamais devant les publications des abonnements.
- Elles respectent les mêmes règles du fil : 2 par fenêtre de 10 au plus, comme un auteur.

### 1.4 Liens d'affiliation (librairies, éditeurs)

- Un lien « Acheter » sur la fiche d'un numéro, uniquement s'il est clairement marqué « lien affilié ».
- Jamais dans les publications des membres sans leur choix.

### 1.5 Publicité : seulement en dernier recours

- Si elle vient un jour : des annonces contextuelles (sorties de la semaine), sans profilage ni traceur tiers.
- Jamais dans les directs.
- Jamais pour les mineurs.
- Jamais d'annonce déguisée en publication.

### 1.6 Pour économiser le quota de Claude (développement)

Le quota se gagne sans perte de qualité :

- **Des lots plus courts et ciblés** : un lot par sujet, un seul passage de tests Edge à la fin.
- **Des modules purs testés en Node** : rapides, sans navigateur, comme `affinityCore` ou `meetupsCore`. La suite Edge est réservée aux parcours d'écran.
- **Des consignes regroupées** : une liste priorisée au début d'une session coûte moins cher que des ajouts en cours de route, qui forcent à relire le contexte.

## 2. Musique dans les stories et les publications

Une musique de catalogue (titres du commerce) ne peut pas être ajoutée librement.

### 2.1 Pourquoi c'est réservé

Il faut deux licences :

- les **droits d'auteur** (Sacem en France, et les éditeurs musicaux) ;
- les **droits voisins** (les maisons de disques, pour l'enregistrement).

Instagram et TikTok ont signé des accords mondiaux avec les grandes maisons de disques et les sociétés d'auteurs. Ces accords coûtent des millions et sont conclus plateforme par plateforme. Une petite application ne peut pas s'en passer, ni les contourner.

### 2.2 Ce qui est possible, dans l'ordre

1. **Bibliothèque libre de droits** : des morceaux sous licence explicite, utilisables dans une application. Exemples : musique composée pour Panel, ou catalogues payants avec licence « application » (droits d'auteur et voisins couverts). À vérifier titre par titre, licence écrite à l'appui.
2. **Sons originaux de Panel** : petites boucles, « POW ! », ambiances de boutique. Composés pour l'application, ils lui appartiennent.
3. **Lien vers un titre** sans le jouer dans Panel : par exemple « Écouter sur… ». Seuls le titre et l'artiste sont cités, ce qui ne pose pas de problème de droit.
4. **Catalogue du commerce sous licence** : seulement à grande échelle, par un contrat avec un agrégateur de licences musicales. C'est un choix d'entreprise, pas une fonctionnalité qu'on code.

Rien de tout cela n'est codé tant qu'aucune licence n'est signée.

## 3. Les J'aime dessinés : la ligne juridique

Les 206 dessins de `likesCore` sont **créés par Panel**. Ce qui les rend publiables :

- Ce sont des **archétypes** du genre : un chevalier de la nuit à oreilles pointues, un roi félin, un dieu du tonnerre. Ces idées ne sont pas protégeables en soi.
- Ils ne reprennent **aucun logo ni emblème** (pas de chauve-souris, de toile, de « S », d'étoile sur un bouclier rond), **aucun visage** et **aucun costume reproduit trait pour trait**.
- Leurs **noms sont français et originaux**. Un test refuse les noms de personnages, d'équipes et d'éditeurs, ainsi que les traductions officielles.
- Les mots-clés de recherche (par exemple « panthère ») restent **internes**. Ils servent à proposer un dessin à un fan, jamais à l'afficher sous un nom déposé.

Avant un lancement commercial, prévoir une relecture par un juriste en propriété intellectuelle. Il retirera ou retouchera tout dessin jugé trop proche.

## 4. Suite proposée (par ordre de valeur)

1. ~~**Étagère de collection**~~ : fait (D-99), animations sur ordinateur seulement.
2. ~~**Collection épurée**~~ : fait (D-99), filtres repliés et actions dans « ••• ».
3. ~~**Découvrir** : personnages suivis (à partir des favoris et des numéros possédés) en tête.~~ : fait (D-100), section « Vos personnages ».
4. **Ouverture des comptes (S8)** :
   - brancher `online-core` sur les migrations 14 et 15 déjà en préproduction ;
   - envoyer les invitations de co-animation et publier les rencontres ;
   - ouvrir les inscriptions aux rencontres, le lieu exact n'étant donné qu'aux inscrits.
5. ~~**Modération plus rapide**~~ : préparée (D-102) ; console, module et migration 16 prêts, actifs à l'ouverture des comptes :
   - file triée par gravité (harcèlement et mineurs d'abord) ;
   - masquage automatique au troisième signalement, déjà en base ;
   - raccourcis clavier pour les modérateurs ;
   - mots interdits réglables ;
   - délai de réponse affiché.
6. **Monde entier (i18n)** :
   - extraire les textes de l'interface dans des tables par langue (français, puis anglais, espagnol, portugais) ;
   - dates et nombres avec `Intl` ;
   - écriture de droite à gauche plus tard.
