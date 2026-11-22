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
