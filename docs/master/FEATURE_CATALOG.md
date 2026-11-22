# Catalogue des fonctionnalités — fiches par module (D-111)

Chaque fiche : description, objectif, utilisateurs, fonctions, état actuel → cible, dépendances, complexité, coût, revenu, risques, priorité, décision, critères d'acceptation et de sortie. Les statuts sont ceux de [CURRENT_STATE_AUDIT](CURRENT_STATE_AUDIT.md). Coûts et revenus : **ordres de grandeur qualitatifs**, aucun prix inventé (voir [FINANCIAL_MODEL](FINANCIAL_MODEL.md)).

Décisions possibles : Conservée · Améliorée · Étendue · Créée · Reportée · Abandonnée.

---

## 1. Collection
- **Description** : exemplaires, séries, boîtes, état, prix payé, cote, statistiques ; Wishlist, Pull list, Key Issues ; Atelier du collectionneur.
- **Objectif** : être le meilleur carnet de collection comics, hors ligne. **Cœur du projet.**
- **Utilisateurs** : tous les membres.
- **Actuel → cible** : OPERATIONAL → corriger les points financiers restants de [directeur/02](../directeur/02-audit-financier.md) (valeur inconnue ≠ 0, frais, sorties de collection).
- **Dépendances** : aucune externe. **Complexité** : moyenne. **Coût** : faible (local). **Revenu** : indirect (Panel+ : exports, statistiques avancées).
- **Risques** : perte de données locales → exports et sauvegardes existants ; jamais de réinitialisation.
- **Priorité** : P1 (finances). **Décision** : Conservée, Améliorée.
- **Acceptation** : aucune valeur inconnue affichée comme 0 ; tests de domaines verts. **Sortie** : F-01 à F-05 fermés.

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
- **Actuel → cible** : PARTIALLY_IMPLEMENTED (migration 18 testée, non appliquée) → appliquée avec S8, écrans parentaux.
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
- **Actuel** : PLANNED. **Priorité** : P2. **Décision** : Reportée jusqu'à l'étape E de la [MASTER_ROADMAP](MASTER_ROADMAP.md).

## 12. Musique dans les stories
- **Décision** : Reportée (DEFERRED) tant qu'aucune licence écrite n'existe ([directeur/13 §2](../directeur/13-monetisation-musique-suite.md)).
