# Journal des décisions — index

La **source unique** est [docs/DECISIONS.md](../DECISIONS.md), qui contient une ligne par décision (D-xxx). Ce fichier ne la recopie pas ; il regroupe les décisions par thème pour s'y retrouver.

| Thème | Décisions |
|---|---|
| Socle local, collection | D-1 à D-60 (voir [HISTORIQUE-LOTS](../HISTORIQUE-LOTS.md)) |
| Garder le client sans framework | Q2 du 13/11/2026 |
| Virage réseau social | D-91 (cadre), D-92 à D-97 (lots S1 à S8) |
| Monétisation et musique | D-98 ([directeur/13](../directeur/13-monetisation-musique-suite.md)) |
| Modération, rôles, double authentification | D-102, D-104, migrations 16 et 17 |
| Langues | D-103 |
| Découvrir, univers, cartes | D-100, D-105 à D-109 |
| Atelier du collectionneur | D-110 |
| Gouvernance, Panel Guardian, documents de référence, retrait de l'ancien nom | D-111, D-112 |
| **Pros et sceau Encré, Le Marché, Le Comptoir, messages chiffrés, offres** | **D-113** |

## Décisions de D-111

Le détail est dans [DECISIONS.md](../DECISIONS.md).

### Panel Guardian (migration 18)
- Il étend l'existant sans le dupliquer.
- Il reste local : la migration n'est pas appliquée.

### Âge et mineurs
- Aucun compte sous 13 ans.
- Les 13-14 ans n'animent pas de direct.
- Les 15-17 ans peuvent animer un club visible des seuls mineurs, sauf si un parent le coupe.

### Lien parental
- Il est créé par le mineur et validé par un adulte en double authentification.
- Le parent ne lit aucun contenu.

### Débats
- Pas de nouveau « Debate Hub » séparé.
- Les débats s'appuient sur les directs, le Duel et les pensées existants.

### Documents
- `docs/master/` est la nouvelle référence centrale.
- Il renvoie aux documents existants au lieu de les recopier.

### Ancien nom
- Il est retiré de tous les documents.
- Les règles de `scripts/import-atlas.js` qui le retirent à l'import sont gardées.

## Décisions de D-113

- **Certification** : le sceau **Encré** (tampon d'encre dentelé, trame, plume ; jaune et noir) pour les créateurs, éditeurs, boutiques et studios. Posé à la main, retirable, jamais vendu.
- **Marché** : adultes seulement, paiement uniquement dans Panel par un prestataire agréé, point relais, colis suivi ou main propre avec code ; pourcentage `[À DÉCIDER]` (simulation à 7 % affichée comme telle).
- **Forum** : Le Comptoir, en cercles, avec débats à deux camps ; il s'ajoute aux débats des directs sans les remplacer.
- **Messages privés** : ouverts, mais chiffrés de bout en bout, adultes seulement, demande avant tout échange. Remplace la règle « pas de messages privés » de D-111.
- **Offres** : Panel, Panel+, Créateur, Éditeur, Boutique ; aucun prix fixé ; un abonnement n'achète jamais de visibilité.
- **Rien n'est en ligne** : migration 19 testée localement seulement (S8 fermé).

## Décisions de D-114

- **Placements inspirés des grands réseaux** : barre latérale Accueil, Découvrir, Directs, Marché, Messages, Publier, Profil, puis Panel+ (comme X Premium). Sur téléphone : dock Accueil, Découvrir, Publier, Marché, Profil ; **Messages en haut à droite, à côté de la cloche** (avion en papier, comme Instagram) ; Directs en onglet de l'Accueil (comme TikTok). Onglets de l'Accueil : Fil, Le Comptoir, Directs ; onglets du Profil : Mon profil, Compte pro, Panel+. En-tête compact sur téléphone dans les espaces sociaux.
- **Messages façon Signal** : X3DH (P-256, préclé signée ECDSA, préclés à usage unique données une seule fois) puis double cliquet (HKDF, HMAC-SHA256, AES-GCM 256), en-tête authentifié, remplissage par blocs de 64 octets, rejeu refusé, 1 000 clés sautées au plus ; messages éphémères de 5 minutes à 1 semaine. Remplace T14 (RESEARCH → fait en local). Limite écrite : Panel voit les métadonnées (qui écrit à qui, quand), pas le contenu.
- **Types de comptes et pastilles** : Collectionneur (sans vérification), Créateur (or, plume), Boutique (vert, vitrine), Maison d'édition (bleu, livre), Studio (violet, cases), Équipe Panel (rouge, bouclier). Le type est choisi à l'inscription ; la pastille n'apparaît qu'après décision d'une personne de l'équipe en double authentification ; valable un an ; gratuite, jamais vendue. Les pastilles remplacent le sceau « Encré » de D-113.
- **Vérification** : pièces par type (identité, crédits, code publié, numéro d'entreprise, justificatif d'adresse, photo de vitrine, adresse sur le domaine officiel, mandat signé, ISBN) ; contrôles automatiques réels (BCE modulo 97, SIREN Luhn, ISBN-13, domaine) ; seule l'empreinte SHA-256 des fichiers est gardée sur l'appareil ; à l'ouverture, pièces chiffrées puis effacées 30 jours après la décision ; examen sous 7 jours ouvrables ; refus motivé et recours.
- **Connexion** : Apple, Google (OAuth, flux PKCE, aucun mot de passe ne passe par Panel) et e-mail (lien de connexion ou mot de passe de 12 caractères au moins) ; double authentification par application (TOTP) proposée dès la connexion. Fournisseurs désactivés dans `config.toml` tant que les comptes sont fermés ; aucun identifiant ajouté au dépôt.
- **Marché enrichi** : recherche sans accents, filtres (état, remise, prix max), tri ; offres (60 % du prix au moins, 48 h, trois en attente au plus) ; remises de lot choisies par le vendeur (paliers 2, 3, 5 ; 50 % au plus) ; favoris ; avis après vente terminée avec moyenne bayésienne (a priori 4/5, poids 5) et badge « Vendeur fiable » à 4,5 sur trois ventes au moins.
- **Panel+ payant pour les statistiques avancées** : concentration de la valeur, rendement par éditeur, Key Issues, gradés et variantes, rythme d'achat, durée de détention. Les statistiques de base restent gratuites. Calcul sur l'appareil ; aperçu flouté tant que l'offre n'est pas en vente ; aucune prévision de prix.

## Décisions de D-115

- **Suivi des ventes** : module `order-core`. Frise par mode de remise (envoi en 5 étapes, main propre en 3). Prochaine action et échéance pour l'acheteur comme pour le vendeur. Règles de Panel, pas des délais légaux, à reprendre dans les conditions du Marché :
  - paiement sous 24 h ;
  - expédition sous 5 jours, sinon l'acheteur peut annuler et être remboursé ;
  - litige possible pendant le transport ou dans les 3 jours après la livraison.
- **Litiges motivés** : cinq motifs. Une photo est exigée pour un exemplaire non conforme, abîmé ou contrefait. La description fait 20 caractères au moins ; 5 litiges par jour au plus.
- **Numéro de suivi** : lettres et chiffres, 8 à 40 caractères, normalisé.
- **Favoris** : le prix au moment de l'ajout est gardé et la baisse est affichée en pourcentage.
- **Relecture par l'équipe** : checklist par type de compte, avec des points automatiques (numéro d'entreprise, domaine, ISBN) et trois points humains (nom, lien avec la BD, pièces lisibles).
  - Valider exige tous les points justes et cochés.
  - Refuser exige un motif, montré à la personne.
  - Demander un complément exige une précision.
  - Échéance : 7 jours ouvrables ; les dossiers en retard passent en tête de file.
  - L'aperçu dans Compte pro utilise le dossier de la personne et n'enregistre rien.
- **Pièces jointes chiffrées** : clé AES-GCM 256 aléatoire par pièce, transmise dans le message chiffré. Le serveur garde le chiffré et son empreinte SHA-256 ; une seule modification d'octet fait refuser la pièce.
- **Confiance dans les clés** : première clé retenue (TOFU) ; un changement de clé est signalé avant l'envoi.
- **Migration 21** (additive, testée en local, non appliquée) :
  - colonnes `tracking`, `dispute_*` et `saved_price_cents` ;
  - fonctions `api.order_ship`, `api.order_cancel_late`, `api.order_dispute`, `api.orders_mine` ;
  - `api.favorites_mine` remplacée à signature identique.

## Décisions de D-116

- **Migrations 16 à 21 appliquées en préproduction** (projet Supabase de Paris), sur accord de l'utilisateur (« Oui, 16 à 21 ») : `moderation_terms`, `owner_admin_mfa`, `panel_guardian`, `pros_market_forum_messages`, `signal_verify_offers_plus`, `orders_tracking_disputes`. Les 21 migrations figurent dans l'historique distant.
- **Limite ajoutée avant application** : `guardian_code`, 10 essais par heure. `api.guardian_link_accept` l'appelait sans ligne de limite, donc sans plafond contre l'essai de codes à la chaîne.
- **Conseils Supabase après application** : seulement des informations.
  - Sécurité : RLS active sans règle sur 37 tables. C'est voulu : l'accès direct est révoqué et tout passe par les fonctions `api.*`.
  - Performances : 32 clés étrangères sans index, une table sans clé primaire (`community.rate_events`), index encore inutilisés (base vide).
- **Ce qui ne change pas** : l'ouverture des comptes (S8) reste fermée, rien n'est déployé, le Marché reste fermé (aucun taux de commission en base).

## Décisions de D-117

- **Migration 22 `foreign_key_indexes`** (additive, testée en local), écrite sur accord de l'utilisateur (« Oui, ajoute-la »), puis appliquée en préproduction (« Oui, applique-la ») : un index pour chacune des 32 clés étrangères signalées par le conseiller de performances Supabase.
  - But : garder rapides les suppressions en cascade (compte supprimé) et les jointures quand la base se remplira.
  - Elle ne touche à aucune donnée.
- **Test** `fk-indexes` : il échoue si une future migration ajoute une clé étrangère sans index.
- **Vérifié après application** : plus aucune clé étrangère sans index. Le conseiller signale les nouveaux index comme inutilisés, ce qui est normal sur une base vide.
- **Pas traité** : `community.rate_events` reste sans clé primaire. C'est un journal à durée courte, lu par son index existant.

## Décisions de D-118

- **Version de test en ligne** sur GitHub Pages, demandée par l'utilisateur (« je veux le mettre en ligne avec github pour tester ») : https://lukecage2003.github.io/panel-comics/ (branche `main`, racine, activée par l'utilisateur le 22/11/2026).
- Fichier `.nojekyll` : GitHub sert les fichiers tels quels.
- Sur une adresse non locale, l'app sait d'emblée que les relais de `serve.js` sont absents (aucun appel à `/api`). Le bandeau « Mode limité » l'explique sans renvoyer vers `Lancer Panel.cmd`.
- **Indisponible en ligne** : recherche Comic Vine, couvertures GCD, Metron, Wikidata, BnF, boutiques, actualités, car ils passent tous par le relais local.
- **Vérifié en ligne** : page servie, aucune erreur dans la console, Accueil, Marché et Profil ouverts, service worker enregistré.
- **Données** : chaque visiteur a sa collection dans son propre navigateur. La collection locale de l'utilisateur (origine localhost) n'est ni copiée ni touchée. Rien n'est envoyé à Supabase, les comptes (S8) restant fermés.

## Décisions de D-119

Passe téléphone demandée par l'utilisateur : « il faut que tout marche sur téléphone ».

- **Scanner** : plein écran sur téléphone, vidéo qui remplit le cadre. La lecture se fait exactement dans la zone du cadre affiché (plus une marge), quel que soit le recadrage de la vidéo. L'objectif arrière principal est choisi tout seul : on écarte ultra grand-angle, téléobjectif, macro et profondeur. Le choix est mémorisé sur l'appareil (`panel_scan_cam`), et il n'y a plus de menu ni de bouton « Changer objectif ». Si l'appareil mémorisé disparaît, on revient à l'objectif par défaut.
- **Couleur** : thème sombre par défaut partout. Avant, le téléphone suivait le thème clair du système, d'où la différence avec le PC. `theme-color` et le manifeste passent à `#141413`. Un choix déjà fait dans Réglages est gardé.
- **Bouton retour du téléphone** : il ferme d'abord la fenêtre ou le panneau ouvert, puis revient à la vue précédente. À l'accueil, un premier appui affiche « Appuyez encore sur retour pour quitter Panel. ». Rien n'est enregistré avant le premier geste de l'utilisateur.
- **Messages** : la vue montre la boîte de réception, comme les grands réseaux. Les réglages et les explications sont rangés derrière « Réglages des messages », puis « Confidentialité des messages ». Plus aucune mention de Signal, X3DH ni du nom du protocole dans l'interface ; Panel+ dit « messages privés ».
- **Cartes** : un toucher sur un personnage ou un lieu ouvre sa fiche. Avant, la capture du pointeur de l'atlas empêchait la sélection. Le correctif est dans l'adaptateur de Panel (`scripts/import-atlas.js`), le contenu de l'atlas n'est pas modifié. La pastille « Revenir à la carte » se masque hors de Découvrir.
- **Menus** : sur téléphone, le menu « Plus » s'ouvre en panneau en bas de l'écran. Avant, il débordait à gauche.
- **Non vérifié** : la vraie caméra d'un téléphone, que le navigateur de test bloque. Les comptes en ligne (S8) restent fermés ; le profil local, le Compte pro et Panel+ s'affichent sans débordement.

## Décisions de D-120

Demande de l'utilisateur : la version définitive pour tester au maximum, sans « Mode limité », plus belle et plus sûre.

- **Pourquoi le Mode limité** : sur GitHub Pages, il n'y a pas le petit serveur `serve.js` qui relaie Comic Vine, GCD, Wikidata, BnF, boutiques et actualités. Le repli par clé personnelle (JSONP) est bloqué par la politique de sécurité stricte (CSP) du site. Choix de l'utilisateur : « Relais Supabase ».
- **Relais hébergé** : fonction `panel-relay` sur le projet de préproduction, générée par `scripts/build-relay.js` à partir de `serve.js` (une seule source de vérité ; `npm run check:relay` refuse tout écart). Origines admises : la version GitHub Pages et localhost ; GET seul ; URL de 2048 caractères au plus ; 90 requêtes par minute et par adresse ; en-têtes de sécurité. Metron reste local (mot de passe jamais utilisé hors de l'appareil). Comic Vine répond dès que l'utilisateur colle sa clé `CV_API_KEY` dans les secrets des fonctions Supabase.
- **Couvertures** : les images partent sans référent (`no-referrer`), car certains sites refusent l'affichage depuis un autre site. Un échec n'est plus retenu 7 jours mais 1 jour, jamais quand l'appareil est hors ligne, et tout est retenté au retour du réseau. Le service worker garde jusqu'à 400 couvertures pour la consultation hors ligne.
- **Comptes et sauvegarde** : le projet Panel est connu d'emblée (clé publique par conception). Migration 23 : une copie de la collection par compte, 8 Mo au plus, une sauvegarde toutes les 20 secondes au plus, uniquement par les fonctions `api.collection_backup_*`, effacée avec le compte. La récupération passe par la fusion existante, jamais d'écrasement silencieux. Sauvegarde automatique quotidienne, seulement si l'utilisateur la coche.
- **Les 10 suggestions** : aide à l'installation sur Android ; bandeau Mode limité en une ligne ; bip du scanner plus doux (vibration et lampe existaient) ; scan en série (existait, D-109) ; glisser depuis le bord gauche pour revenir ; comptes ouverts ; sauvegarde dans le compte ; recherche dans les cartes ; mode une main ; couvertures gardées hors ligne.
- **Design** : icônes plus fines, onglet actif du dock plein avec un point, retour visuel à l'appui, anneau de focus, listes d'onglets qui s'estompent au bord. Messages : recherche en pastille, état vide illustré avec « Explorer le Marché ». Marché : cartes nettes, prix à la couleur de Panel, deux colonnes sur téléphone. Directs : affiche « Parlez comics, en direct » avec deux grandes actions, explications repliées.
- **Sécurité** : `npm run test:all` vérifie aussi que le relais hébergé est identique à `serve.js`. Accès à la base uniquement par les fonctions `api.*` (aucune table ouverte). La CSP garde `connect-src https:` : la restreindre casserait des sources publiques de fiches, à revoir hôte par hôte.
- **Non vérifié** : le relais avec la clé Comic Vine (pas encore collée) ; une inscription réelle (le SMTP par défaut de Supabase n'écrit qu'aux membres de l'organisation).

## Décisions de D-121

Demande de l'utilisateur : une version à confier à des bêta-testeurs, un logo jaune identique partout, une intro plus sobre, un calendrier qui montre l'avenir (US et francophone), les 10 suggestions de D-120.

- **Logo** : `icons/panel-mark.svg` est la source unique : un carré jaune (#FFD400) et trois cases de planche. `npm run icons` (`scripts/make-icons.js`) génère les PNG avec Edge ; `android-app/make-icons.ps1` en tire les icônes Android (adaptatives, rondes) et l'écran de démarrage sur fond sombre. Le site affiche le même logo (barre latérale, onglet du navigateur en SVG). Application Android passée en 1.3.
- **Intro** : fond uni, le logo se pose, ses trois cases apparaissent l'une après l'autre, le nom suit, fondu à 0,9 s. Une fois par session ; jamais avec « mouvement réduit ».
- **Calendrier** : « À venir » ouvre les trois prochains mois, chargés depuis Comic Vine (le service est appelé aussi pour un mois ou trois mois, jamais pour le passé). « Mes séries seulement » ne garde que les séries de la collection (pont en lecture seule `Panel.collectionSeries`). Côté francophone, aucun éditeur ne publie son planning sous une forme réutilisable (pas d'API ; les pages sont protégées par le droit des bases de données) : Panel renvoie vers les pages officielles d'Urban Comics, Panini Comics (checklist), Delcourt Comics et Casterman, et garde l'import CSV / JSON et la saisie manuelle. Google Books aurait pu servir mais exige une clé (quota public épuisé).
- **Suggestions** : synchronisation automatique de la copie du compte après chaque changement (regroupés, 2 minutes au plus tôt), avec l'indication d'une copie faite depuis un autre appareil ; scan d'étagère (jusqu'à 40 codes sur une photo, ajoutés en mode continu) ; carte de collectionneur au format story (1080 × 1920, partage ou enregistrement) ; visionneuse plein écran des planches (glisser, flèches, double page en paysage) ; contrôle de sécurité `scripts/check-security.js` (CSP, gestionnaires en ligne, liens externes, bibliothèques figées, relais, fonctions `SECURITY DEFINER`, RLS) ajouté à `test:all`. Rappels de sortie et courbe de valeur existaient déjà.
- **Finitions** : recherches en pastille, Découvrir sans trame, libellé du calendrier centré, bouton de la carte visible seulement dans la collection.
- **Non fait** : notifications de messages (il faudrait un service d'envoi), profil public en ligne (il faut les comptes ouverts au public), reprise automatique du planning francophone.

## Décisions de D-122 et D-123

- **D-122** : l'application Android passe par le relais hébergé ; le relais accepte la clé Comic Vine sous les noms `CV_API_KEY`, `API_COMIC_VINE`, `API COMIC VINE`, `COMIC_VINE_API_KEY`, `COMICVINE_API_KEY`. L'APK 1.4 est téléchargeable depuis la Release GitHub `v1.4-android`.
- **Ouverture** : une planche de six cases se monte (trames, rayons, lignes de vitesse), une bulle « PANEL ! » éclate et secoue la page, la page se tourne et laisse le logo. 1,8 s, une fois par session, jamais avec « mouvement réduit ». L'animation est retirée à sa fin réelle (et au plus tard à 4,5 s), même si le démarrage est lent.
- **Saisie sur téléphone** : la touche Entrée affiche « Rechercher », « OK » ou « Envoyer » selon le champ ; après Entrée, le clavier se range (sauf dans le chat d'un direct) ; la barre du bas disparaît pendant la saisie.
- **Écrans de téléphone** : marge de la barre d'état (heure, encoche, caméra) pour tous les affichages, plus seulement la PWA ; bandeau plein sous la barre d'état ; barres collantes placées sous elle ; textes longs coupés proprement.
- **Moins de texte** : descriptions de section masquées, accueil sans ligne d'explication, Comptoir sans grand bandeau sur téléphone, cercles et tris sur une ligne défilante, conseils du Marché repliables, carte Planches raccourcie.
- **Pensées** : 2 000 caractères (comme la colonne `posts.body`), migration `20261122000024_long_notes.sql` appliquée en préproduction ; les longs textes restent repliés dans le fil (« voir plus »).

## Décisions de D-126

Demande transmise par la session principale : brancher la messagerie en ligne (onglet Messages, badges, groupes, vocaux, retranscription), puis les fils de pensées si le temps le permet.

- **Messages** : l'onglet lit `api.inbox()` et parle aux fonctions `api.dm_*` (migrations 19 et 20). Les clés d'identité restent sur l'appareil (IndexedDB `panel-dm`, version 2) ; 20 clés à usage unique sont publiées et rechargées sous 5. Un changement de clé d'un correspondant est signalé avant tout envoi. Relève toutes les 5 s dans une conversation, toutes les 30 s pour la liste (60 s en arrière-plan) ; rien ne tourne sans compte connecté.
- **Badges** : `#badgeMessages` compte les personnes et groupes avec du non-lu (99+ au-delà) ; chaque ligne affiche son nombre de messages non lus ; un groupe en sourdine garde un compteur gris et ne compte pas sur l'icône. `api.inbox_mark_read` ne recule jamais et ne dépasse jamais le dernier message. Les alertes du navigateur annoncent « nouveau message » sans jamais en montrer le contenu.
- **Groupes** (migration `20261122000025_messaging_groups_voice.sql`) : tables `messaging.groups`, `group_members`, `group_messages`, `group_keys`, `reads`, RLS active et aucun droit direct ; tout passe par `api.group_*` (`search_path = ''`, rien pour `anon`). Invitations filtrées (mineurs, blocages, réglage « qui peut m'écrire »), historique invisible avant l'arrivée, propriétaire remplacé à son départ, groupe vide supprimé. Chiffrement par clés d'expéditeur : une chaîne HMAC par membre et par époque, messages signés ECDSA, clé envoyée scellée à chaque membre ; le serveur fait avancer l'époque à chaque départ ou retrait, ce qui force de nouvelles clés.
- **Vocaux** : MediaRecorder, 3 min et 4 Mo au plus ; le fichier est chiffré (`sealAttachment`) puis rangé dans le compartiment privé `voice` sous `<conversation>/<membre>/<id>.bin` ; les règles de stockage (`messaging.media_ok`) n'ouvrent la lecture qu'aux membres de la conversation. La référence, la durée, l'onde et la retranscription voyagent dans le message chiffré. Les pensées vocales restent dans la base locale `panel-notes`.
- **Retranscription** : Web Speech quand le navigateur le propose, désactivée par défaut, avec l'avertissement que le service vocal du navigateur entend l'enregistrement. Android n'a pas cette interface dans la vue web : un module natif (`@capacitor-community/speech-recognition`, reconnaissance de l'appareil, gratuit) est proposé à l'utilisateur, rien n'est ajouté sans son accord.
- **Fils de pensées** : au-delà de 2 000 caractères, une pensée est découpée en 3 parties au plus (1/3, 2/3, 3/3).
- **Tests** : `dm-group.test.js`, `dm-inbox.test.js`, `messaging-groups.test.js` ; le test Edge 87 vérifie désormais la boîte en ligne (la recherche n'apparaît qu'une fois connecté).
- **Non fait** : partage depuis Android, widget « Sorties du mercredi », signalement dans les groupes, plusieurs appareils par compte (la reprise sur un nouvel appareil remplace les clés).
