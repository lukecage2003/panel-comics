# PANEL 2.0 — Sécurité, droits et gouvernance

Ce document complète [`../prd/PANEL_SECURITY_AND_COMPLIANCE.md`](../prd/PANEL_SECURITY_AND_COMPLIANCE.md) (RGPD, consentement, DSA, modération, abus, API, droits sur les couvertures, licences, paiements), qui reste la référence. Il traite ce que PANEL 2.0 ajoute : **la contribution documentaire**.

## 1. Socle existant (vérifié)

| Mesure | Preuve |
|---|---|
| RLS sur toutes les tables personnelles | migration 0005 ; `backend/tests/rls.test.js` |
| Durcissement (fonctions `security definer` limitées, schémas) | migration 0007 ; `hardening.test.js` |
| Rôles du personnel et journal de leurs changements | `app.staff_roles`, `staff_role_log` (0010) ; `roles.test.js` |
| Limites de service et purge | `app.service_limits` (0012) ; `limits.test.js` |
| Export et suppression de compte | fonction `delete-account` ; migrations 0009, 0012 ; `privacy.test.js`, `delete-account.test.js` |
| Communauté : âge, blocages, visibilité, limites de débit, contrôle du contenu, signalements, file de modération | 0013 : `community.is_adult`, `blocked_between`, `can_see_post`, `rate_check`, `payload_ok`, `api.report`, `api.mod_queue` ; `community.test.js` |
| Publier = copier selon une liste blanche | `domains/community/policy-core.js` ; test 39 |
| Aucun secret dans le dépôt | `npm run check:secrets` ; `docs/phase3/runbooks/secrets.md` |
| Images : droits par référence, affichage refusé si non autorisé | `media-core.js` (`rights.display`) ; test 43 |

## 2. Permissions par domaine (ajouts 2.0)

| Action | Visiteur | Membre | Contributeur | Vérificateur | Modérateur |
|---|---|---|---|---|---|
| Lire une fiche, ses sources, son historique | oui | oui | oui | oui | oui |
| Proposer une correction (`correction_request`) | non | oui | oui | oui | oui |
| Proposer une affirmation avec preuve | non | non | oui | oui | oui |
| Relire (première revue) | non | non | oui (hors ses propositions) | oui | oui |
| Valider (passage à `verified`) | non | non | non | oui (domaine d'expertise) | oui |
| Qualifier un conflit (`claim_conflict`) | non | non | non | oui | oui |
| Verrouiller une fiche, restaurer une version | non | non | non | non | oui |
| Créer un dossier Lab, un débat | non | oui | oui | oui | oui |
| Voter dans un débat | non | oui | oui | oui | oui |

Toutes ces règles sont appliquées **côté base** (RLS et fonctions `api.*`, comme pour la communauté en 0013), pas seulement dans l'interface.

## 3. Gouvernance documentaire

| Règle | Mécanisme |
|---|---|
| Personne ne modifie arbitrairement une information fiable | Une affirmation `verified` ne se modifie pas : on propose une nouvelle affirmation, qui doit passer les mêmes revues ; l'ancienne est remplacée (`superseded_by`), pas effacée |
| Deux regards au moins | Passage à `verified` = deux revues indépendantes, dont un vérificateur ; jamais l'auteur |
| Historique intégral | `claim_revision` en ajout seulement ; aucune suppression physique |
| Restauration | Un modérateur restaure une version antérieure, l'action est journalisée |
| Fiches sensibles | Verrouillage temporaire en cas de « guerre d'édition » |
| Transparence | L'historique et les revues d'une fiche sont publics (pseudonymes) |

## 4. Prévention des contributions frauduleuses

| Menace | Parade |
|---|---|
| Faux comptes qui se valident mutuellement | Ancienneté et contributions acceptées exigées pour relire ; détection des revues croisées répétées entre deux comptes |
| Source inventée | Vérification automatique que l'URL répond et que la citation existe (voir la stratégie IA) ; sinon, preuve marquée « non vérifiable » |
| Vandalisme | Limites de débit (`community.rate_check`), retour arrière en un geste, verrouillage |
| Manipulation des votes de débat | Un vote par membre ; votes séparés (accord et qualité) ; la popularité ne change jamais le statut documentaire |
| Course à la réputation | Réputation calculée sur les contributions **acceptées**, pondérées, plafonnées par période ; formule publique |
| Brigading (raid d'un groupe) | Débats et fiches verrouillables ; seuils d'ancienneté pour voter sur un sujet sensible |

## 5. RGPD appliqué aux contributions

| Sujet | Règle |
|---|---|
| Base légale | Contribution publique = intérêt légitime et acceptation des règles ; pas de donnée personnelle dans les affirmations |
| Export | L'export de compte inclut les contributions, revues, dossiers, arguments, votes |
| Suppression | À la suppression du compte, les contributions **restent** (intégrité documentaire) mais sont **anonymisées** (« contributeur supprimé ») ; les votes sont supprimés ; à annoncer dans les règles avant l'inscription |
| Mineurs | Les règles d'âge de 0013 (`community.is_adult`) s'appliquent à la contribution et aux débats |
| Journalisation | Actions sensibles (validation, verrouillage, restauration, changement de rôle) dans un journal en ajout seulement, conservé selon une durée définie (DR-09) |

## 6. Droits sur les contenus

| Contenu | Règle |
|---|---|
| Scans, pages, cases | **Jamais** hébergés ni redistribués. Une preuve peut citer « page 12, case 3 » d'un document légalement consulté, sans image. Exception locale (D-79) : le studio de direct accepte des pages de la galerie du téléphone, gardées sur l'appareil seulement ; leur affichage dans un salon à plusieurs est soumis à DR-13 |
| Citations | Courtes (≤ 300 caractères), attribuées, à but de démonstration (droit de citation) |
| Couvertures | Règles existantes : `license` (`licensed`, `user_private`, `none`) du PRD, droits par référence de `media-core.js` |
| Données importées | Chaque source a sa licence (`catalog.source.license`) ; une donnée sous licence non redistribuable n'est **pas** exposée par Open |
| Contributions des membres | Licence à choisir (DR-06), par exemple CC BY-SA pour le texte documentaire, pour rester compatible avec les sources libres (Wikidata en CC0, wikis Fandom en CC BY-SA) |

## 7. Protection des API (Open)

- Clés par application, quotas par clé et par adresse (`app.service_limits` étendu).
- Lecture seule au départ ; aucune route d'écriture publique.
- Aucune donnée personnelle sans consentement explicite de la personne (profil public, collection partagée volontairement).
- Journal des accès conservé pour l'investigation d'abus.
- Révocation immédiate d'une clé.

## 8. Modération

Le personnel est la ressource rare. Recommandation : **ouvrir la contribution par paliers** (invitations, puis contributeurs confirmés, puis tous les membres), au rythme de la capacité de modération réelle (DR-04).
