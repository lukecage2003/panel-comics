# Catalogue des fonctionnalités — fiches par module (D-111)

Chaque fiche : description, objectif, utilisateurs, fonctions, état actuel → cible, dépendances, complexité, coût, revenu, risques, priorité, décision, critères d'acceptation et de sortie. Les statuts sont ceux de [CURRENT_STATE_AUDIT](CURRENT_STATE_AUDIT.md). Coûts et revenus : **ordres de grandeur qualitatifs**, aucun prix inventé (voir [FINANCIAL_MODEL](FINANCIAL_MODEL.md)).

Décisions possibles : Conservée · Améliorée · Étendue · Créée · Reportée · Abandonnée.

---

## 1. Collection
- **Description** : exemplaires, séries, boîtes, état, prix payé, cote, statistiques ; Wishlist, Pull list, Key Issues ; Atelier du collectionneur.
- **Objectif** : être le meilleur carnet de collection comics, hors ligne. **Cœur du projet.**
- **Utilisateurs** : tous les membres.
- **Actuel → cible** : OPERATIONAL. Les anomalies F-01 à F-11 de [directeur/02](../directeur/02-audit-financier.md) sont corrigées (lots F0 et F1) ; reste F-12 (estimation de la Wishlist).
- **Dépendances** : aucune externe. **Complexité** : moyenne. **Coût** : faible (local). **Revenu** : indirect (Panel+ : exports, statistiques avancées).
- **Risques** : perte de données locales → exports et sauvegardes existants ; jamais de réinitialisation.
- **Priorité** : P2 (F-12). **Décision** : Conservée.
- **Acceptation** : aucune valeur inconnue affichée comme 0 (test Edge 30). **Sortie** : F-12 fermé.

## 2. Découvrir (encyclopédie, univers, événements, cartes, quiz)
- **Description** : univers datés et sourcés, guides de lecture, atlas des cartes, personnage du jour, défis, quiz.
- **Objectif** : donner envie de lire et relier chaque fiche à la collection.
- **Actuel → cible** : OPERATIONAL → revue de licence de chaque source avant lancement public.
- **Dépendances** : sources externes (provenance par champ). **Complexité** : moyenne. **Coût** : faible. **Revenu** : affiliation marquée (P2).
- **Risques** : droit d'auteur sur textes et images → ne jamais présenter une image non vérifiée comme officielle ; mention « plan de fan » et © des éditeurs.
- **Priorité** : P1 (licences). **Décision** : Conservée.
- **Acceptation** : chaque source a une licence notée dans [DATA_GOVERNANCE](DATA_GOVERNANCE.md).

## 3. Fil social, pensées, J'aime, profil
- **Description** : fil classé (diversité, anti-spoiler, « Pourquoi je vois ça ? »), pensées avec mots-dièse, 206 J'aime dessinés, profil avec étagère.
- **Actuel → cible** : PARTIALLY_IMPLEMENTED (local) → en ligne avec S8.
- **Dépendances** : migrations 13–18, modération humaine, CGU. **Complexité** : élevée. **Coût** : hébergement proportionnel à l'usage `[À COMPLÉTER]`.
- **Risques** : contenus illicites, harcèlement, mineurs → modération, Guardian, DSA.
- **Priorité** : P0 pour la mise en ligne (gouvernance), P1 pour les fonctions. **Décision** : Conservée, Étendue (S8).
- **Acceptation** : un adulte ne voit jamais un mineur ; publications privées invisibles même d'un parent (tests PGlite).

## 4. Directs et débats (« Debate Hub »)
- **Description** : studio vertical, chat, Duel, verdicts des théories, co-animation ; débat du mercredi.
- **Actuel → cible** : PARTIALLY_IMPLEMENTED → débats en ligne sur la même base (pas de nouveau module).
- **Dépendances** : S8 ; diffusion réelle : serveur média (DEFERRED). **Complexité** : élevée.
- **Risques** : invitation d'un mineur par un adulte inconnu → **refusée côté serveur** (migration 15, vérifiée en D-111) ; heures calmes et réglages parentaux (migration 18).
- **Priorité** : P1. **Décision** : Étendue (Guardian), diffusion Reportée.

## 5. Panel Guardian (protection des mineurs)
- **Description** : aucun compte sous 13 ans ; 13-14 et 15-17 supervisés ; statut d'âge contestable (`unverified`, `verified_13_15`, `verified_16_17`, `verified_adult`, `under_13_blocked`, `review_required`) ; lien parental par code ; réglages du parent (heures calmes, directs, abonnements) ; restrictions de compte ; politique centrale côté serveur.
- **Actuel → cible** : PARTIALLY_IMPLEMENTED (migration 18 testée et appliquée en préproduction le 22/11/2026 ; module client `guardian-core` et encadré dans Compte & profil, D-112) → appliquée avec S8, écrans branchés.
- **Dépendances** : migrations 13, 15, 17 ; AIPD ; avocat. **Complexité** : élevée. **Coût** : faible technique, élevé humain (revue des contestations). **Revenu** : aucun (jamais de publicité aux mineurs).
- **Risques** : faux âge déclaré → statut jamais présenté comme vérifié ; preuve d'âge externe en RESEARCH, sans biométrie imposée.
- **Priorité** : **P0**. **Décision** : Créée (sur l'existant).
- **Acceptation** (tests `backend/tests/guardian.test.js`) : inscription à 12 ans refusée ; lien sans code refusé ; mineur ne peut pas être parent ; parent sans double authentification refusé ; adulte inconnu ne peut pas inviter un mineur en direct ; révocation ; suppression du compte efface liens, réglages et journal.
- **Sortie** : appliqué en préproduction et retesté sur la base réelle.

## 6. Modération
- **Description** : signalements, masquage automatique à trois (immédiat pour la sécurité d'un mineur), décisions motivées, appels, journal, rôles d'équipe en double authentification.
- **Actuel → cible** : PARTIALLY_IMPLEMENTED → équipe humaine et délais écrits.
- **Priorité** : P0. **Décision** : Conservée, Étendue (restrictions proportionnées, D-111).

## 7. Rencontres et écosystème pro
- **Description** : rencontres en boutique (`meetups-core`) ; cible : fiches « Boutique vérifiée », auteurs et conventions vérifiés par l'équipe.
- **Actuel → cible** : PARTIALLY_IMPLEMENTED → PLANNED pour la partie pro.
- **Dépendances** : identité légale, contrat type `[À COMPLÉTER]`. **Revenu** : principal envisagé (abonnement boutique, montant non fixé).
- **Risques** : publicité déguisée → étiquette « Partenaire », 2 sur 10 au plus dans le fil.
- **Priorité** : P2. **Décision** : Étendue.

## 8. Comptes, synchronisation, droits RGPD
- **Description** : compte facultatif, synchronisation, export, effacement, purge.
- **Actuel → cible** : PARTIALLY_IMPLEMENTED → S8.
- **Priorité** : P0 (droits d'accès et d'effacement prêts avant l'ouverture). **Décision** : Conservée.

## 9. Lecteur numérique PDF/CBZ
- **Actuel** : DEPRECATED. Les fichiers, marque-pages, notes et positions restent sur l'appareil ; archive ZIP de sortie.
- **Décision** : Abandonnée pour l'interface, **données conservées**. Jamais de suppression.

## 10. Manga
- **Décision** : Abandonnée (hors périmètre : Panel est comics seulement).

## 11. Monétisation (Panel+, boutiques, affiliation, publicité)
- **Actuel** : PREPARED (D-113) : écran « Offres » (Panel, Panel+, Créateur, Éditeur, Boutique), tous les prix à « Tarif à venir » ; `plans-core` ; tables `billing.*` (migration 19, écriture réservée au service).
- **Priorité** : P2. **Décision** : Étendue ; vente reportée jusqu'à l'étape E de la [MASTER_ROADMAP](MASTER_ROADMAP.md).

## 12. Musique dans les stories
- **Décision** : Reportée (DEFERRED) tant qu'aucune licence écrite n'existe ([directeur/13 §2](../directeur/13-monetisation-musique-suite.md)).

## 13. Le Comptoir (forum, D-113)
- **Description** : cercles (Débats, Théories, Par où commencer, Sorties du mercredi, Collection & cotes, Comics en VF, Coin des créateurs, Indés & webcomics), sujets avec étiquette, débats à deux camps, votes uniques, réponses en fil (6 niveaux), tris Tendance, Nouveaux, Meilleurs, Débattus.
- **Actuel → cible** : PARTIALLY_IMPLEMENTED (local, `forum-core`, migration 19) → en ligne avec S8.
- **Risques** : brigades de votes → un vote par compte, limites de débit ; contenu adulte → caché aux mineurs.
- **Priorité** : P1. **Décision** : Nouvelle.

## 14. Le Marché (D-113)
- **Description** : vente entre collectionneurs depuis la collection (doublons proposés en premier), photos de son exemplaire, état, point relais, colis suivi ou main propre avec code, frais de service en pourcentage.
- **Actuel → cible** : PARTIALLY_IMPLEMENTED (brouillons locaux, `market-core`, migration 19 fermée par défaut) → ouverture après choix d'un prestataire agréé et avis d'avocat.
- **Revenu** : frais de service `[À DÉCIDER]`. **Risques** : R11, R14.
- **Priorité** : P1. **Décision** : Nouvelle.

## 15. Messages privés chiffrés (D-113)
- **Description** : chiffrement de bout en bout sur l'appareil, empreinte de sécurité, demande avant échange, préférences (tout le monde, profils Encré, personne), blocage, signalement avec messages choisis.
- **Actuel → cible** : PARTIALLY_IMPLEMENTED (clé de l'appareil et vérification locale, `dm-core`, migration 19) → en ligne pour les adultes.
- **Risques** : R2, R13. **Priorité** : P1. **Décision** : Nouvelle (remplace « pas de messages privés »).

## 16. Pros, sceau Encré et L'Atelier (D-113 ; pastilles remplacées en D-114, §19)
- **Description** : profils officiels Créateur, Éditeur, Boutique, Studio ; bibliographie ; liste de preuves ; sceau **Encré** (tampon d'encre jaune et noir, dessiné pour Panel) posé à la main ; L'Atelier pour trouver un coloriste, un lettreur, un scénariste, sans coordonnées affichées.
- **Actuel → cible** : PARTIALLY_IMPLEMENTED (local, `pro-core`, migration 19) → demandes examinées par l'équipe à l'ouverture.
- **Risques** : R12. **Priorité** : P1. **Décision** : Nouvelle (étend l'écosystème pro du §7).

## 17. Navigation (D-114)

Barre latérale : Accueil, Découvrir, Directs, Marché, Messages, Publier, Profil, Panel+. Téléphone : dock Accueil, Découvrir, Publier, Marché, Profil ; Messages et notifications en haut à droite ; onglets Fil, Le Comptoir, Directs dans l'Accueil ; Mon profil, Compte pro, Panel+ dans le Profil. Statut : FAIT (local).

## 18. Messages façon Signal (D-114)

Boîte de réception (recherche, Principal, Demandes), explication du protocole, numéro de sécurité de l'appareil, vérification locale du protocole (désordre, rejeu, altération), minuteur par défaut, qui peut m'écrire. Statut : FAIT (local) ; conversations réelles à l'ouverture des comptes.

## 19. Types de comptes, pastilles et vérification (D-114)

Cinq types, cinq pastilles distinctes (plus Équipe Panel), inscription avec Apple, Google ou e-mail, dossier de vérification par type avec contrôles automatiques et modalités écrites. Statut : FAIT (local) ; envoi des dossiers à l'ouverture des comptes.

## 20. Marché enrichi et Panel+ (D-114)

Marché : Acheter (recherche, filtres, tri), Vendre (annonce, remises de lot, réputation), Offres (règles et calculateur), Favoris. Panel+ : six statistiques avancées calculées sur l'appareil, aperçu flouté tant que l'offre n'est pas en vente. Statut : FAIT (local).

## 21. Suivi des ventes et litiges (D-115)

Onglet Ventes du Marché :
- frises « envoi » et « main propre » ;
- échéances ;
- vérification du numéro de suivi ;
- motifs de litige.

Côté serveur : expédition avec suivi, annulation pour retard, litige motivé, liste de mes ventes et achats, baisses de prix des favoris.

Statut : FAIT (local).

## 22. Relecture par l'équipe et pièces jointes chiffrées (D-115)

- Aperçu de la relecture dans Compte pro : points automatiques et humains, échéance, valider, demander un complément ou refuser avec motif. Rien n'est enregistré.
- Pièces jointes chiffrées dans Messages.

Statut : FAIT (local) ; envoi réel des pièces avec les comptes (T16).
