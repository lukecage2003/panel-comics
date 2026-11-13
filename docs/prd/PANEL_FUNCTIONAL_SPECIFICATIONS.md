# PANEL — Spécifications fonctionnelles V1

Date : 13 novembre 2026. Statut : proposé (D-58). Vision et légende des états : [`PANEL_PRD_V1.md`](PANEL_PRD_V1.md).

## Conventions

- **Identifiant d'exigence** : `MODULE-NN` (ex. `COL-04`). Il est repris dans [`PANEL_ACCEPTANCE_TESTS.md`](PANEL_ACCEPTANCE_TESTS.md) (tests `AT-MODULE-NN`) et dans la roadmap.
- **Priorité MoSCoW** : M (Must), S (Should), C (Could), W (Won't pour cette version).
- **Cible** : MVP (bêta fermée), V1 (publique), F (futur).
- **État** : [Existant], [Partiel], [Impl. local], [Proposé], [Bloqué].
- Les règles transverses (périmètre comics, données privées, aucune suppression destructive) s'appliquent à tous les modules sans être répétées.

| Préfixe | Module |
|---|---|
| EXP | 1. Explorer et catalogue |
| COL | 2. Collection personnelle |
| RDG | 3. Suivi de lecture |
| REL | 4. Calendrier des sorties |
| PUL | 5. Pull List |
| COM | 6. Communauté et fil d'actualité |
| PRF | 7. Profils utilisateurs |
| PUB | 8. Publications et interactions |
| GRP | 9. Groupes, clubs et challenges |
| NOT | 10. Notifications |
| PLN | 11. PANEL Free et PANEL Plus |
| ADM | 12. Administration et modération |
| DIF | Fonctions de différenciation (§ 15) |

---

## 1. Explorer et catalogue (EXP)

**Objectif.** Trouver n'importe quel comic, série, événement, personnage ou créateur, et savoir quoi lire, avec des données fiables et sourcées.

**User stories.**
- En tant que lecteur, je cherche « absolute batman » sans accent ni casse exacts et je trouve la série.
- En tant que nouveau venu, je choisis un personnage et je vois par où commencer.
- En tant que lecteur VF, je vois à quelle édition française correspond un numéro VO.

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| EXP-01 | Recherche tolérante (accents, casse, fautes légères) sur séries, numéros, événements, personnages, créateurs, éditeurs | M | MVP | [Existant] local (D-33) ; serveur [Proposé] |
| EXP-02 | Fiche série : éditeur, volume, années, numéros, éditions VF liées, statut de complétion personnel | M | MVP | [Partiel] |
| EXP-03 | Fiche numéro : dates (couverture, magasin, FOC), crédits, variantes, éditions qui le contiennent | M | MVP | [Partiel] (FOC, crédits normalisés [Proposé]) |
| EXP-04 | Fiche événement : contexte, liens par rôle et niveau (essentiel / recommandé / complet), ordre recommandé versionné, progression | M | MVP | [Existant] (D-57) |
| EXP-05 | Identité commune d'une publication entre Collection, Sorties et Explorer | M | MVP | [Existant] local (D-55) ; serveur [Proposé] |
| EXP-06 | Pages personnage et créateur avec rôles normalisés et lectures recommandées | S | V1 | [Partiel] (dérivées de la collection) |
| EXP-07 | Catalogue partagé côté serveur, alimenté par source sous licence et saisie éditoriale | M | V1 | [Bloqué] (source, backend) |
| EXP-08 | Signalement d'une erreur de données par un utilisateur → file de correction | S | V1 | [Proposé] |
| EXP-09 | Contributions communautaires au catalogue avec relecture | C | F | [Proposé] |
| EXP-10 | Filtre de périmètre : aucun manga, manhwa, manhua, webtoon ou BD franco-belge proposé ou ingéré | M | MVP | [Existant] (D-37, D-41, D-54) |

**Règles métier.**
- Une publication n'est jamais dupliquée : unicité (série, numéro) ; variante unique par (numéro, nom normalisé).
- Chaque fait porte une source (`claim`) ; une sélection éditoriale est étiquetée comme telle.
- Un ordre de lecture tiers n'est jamais reproduit : seul un lien est cité.

**États d'une fiche catalogue.** `brouillon` → `publiée` → (`contestée` ↔ `publiée`) → `fusionnée` (pointe vers la fiche conservée) ; jamais supprimée physiquement si référencée.

**Cas limites.** Numéros non entiers (#½, #0, #1.MU) ; renumérotations (Legacy) ; même titre, volumes différents ; éditeur mixte (Glénat : comics et manga, décidé par le format, D-41) ; dates incertaines.

**Dépendances.** Modèle catalogue ([`PANEL_DATA_MODEL.md`](PANEL_DATA_MODEL.md) § 3), recherche serveur, source sous licence.

---

## 2. Collection personnelle (COL)

**Objectif.** Cataloguer, organiser et valoriser sa collection physique sans erreur silencieuse.

**User stories.**
- En tant que collectionneur, je scanne un code-barres et j'obtiens le bon numéro et la bonne variante, ou un choix si c'est incertain.
- Je sais dans quelle boîte se trouve un numéro.
- Je vois combien j'ai investi et ce que vaut ma collection, par devise, sans conversion cachée.

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| COL-01 | Ajout par scan code-barres (UPC/EAN + supplément) avec candidats en cas d'incertitude | M | MVP | [Existant] |
| COL-02 | Ajout par reconnaissance de couverture (hachage perceptuel) | S | MVP | [Existant] (seuils et écart au second candidat [Proposé]) |
| COL-03 | Saisie manuelle et édition d'un exemplaire (état, grade, société de grading, prix, date, magasin, notes) | M | MVP | [Existant] |
| COL-04 | Emplacements hiérarchiques (pièce → meuble → boîte → séparateur) | M | MVP | [Existant] |
| COL-05 | Import CSV, CLZ, League of Comic Geeks (xlsx) avec aperçu et rapport | M | MVP | [Existant] |
| COL-06 | Déduplication à l'import par identifiants externes (UPC, ISBN, Comic Vine, Metron, LoCG) ; réimport sans doublon | M | MVP | [Partiel] |
| COL-07 | Wishlist avec priorité, statut, prix maximal | M | MVP | [Existant] |
| COL-08 | Séries et numéros manquants, complétion | M | MVP | [Existant] |
| COL-09 | Statistiques : nombre, valeur, investi, plus-value, répartition éditeurs et périodes | M | MVP | [Existant] (répartition par période [Partiel]) |
| COL-10 | Finances par devise, lots, frais, ventes, plus-values (F0, F1) | S | MVP | [Existant] |
| COL-11 | Historique des acquisitions (chronologie, par mois) | S | V1 | [Partiel] |
| COL-12 | Corbeille annulable, aucune suppression définitive implicite | M | MVP | [Existant] (D-36) |
| COL-13 | Export complet (JSON, CSV) et sauvegardes par domaine, restauration | M | MVP | [Existant] (D-39) |
| COL-14 | Synchronisation multi-appareils via le compte | M | MVP | [Impl. local] ; [Bloqué] (projet cloud) |
| COL-15 | Collection publique = copie filtrée consentie (sans prix, valeur, emplacement, notes) | S | V1 | [Impl. local] (contrat Publish, D-46) |
| COL-16 | Variante au niveau exemplaire rattachée au catalogue | S | V1 | [Partiel] |

**Règles métier.** Les finances, la valeur, les emplacements et les notes ne quittent jamais l'appareil sans synchronisation consentie et ne sont jamais publics. Une valeur inconnue s'affiche « — », jamais 0. Aucune conversion de devise implicite.

**États d'un exemplaire.** `possédé` ↔ `wishlist` ; `possédé` → `vendu` (conserve l'historique) ; `possédé` → `corbeille` → (`restauré` | purge explicite après délai).

**Cas limites.** Plusieurs exemplaires du même numéro ; lot acheté à prix global ; grading (CGC/CBCS) avec étiquette ; exemplaire hors périmètre importé (conservé, badge « hors périmètre »).

**Dépendances.** Catalogue commun, synchronisation, stockage local.

---

## 3. Suivi de lecture (RDG)

**Objectif.** Savoir ce que j'ai lu, ce que je lis et quoi lire ensuite.

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| RDG-01 | État par œuvre : à lire, en cours, lu, abandonné ; un geste vaut pour tous les exemplaires | M | MVP | [Existant] (L1, D-30) |
| RDG-02 | Journal de lecture daté, relectures | M | MVP | [Existant] |
| RDG-03 | Prochain numéro à lire par série | M | MVP | [Existant] |
| RDG-04 | Progression d'événement par niveau | M | MVP | [Existant] (D-57) |
| RDG-05 | Note (demi-point) et critique liée à une lecture | S | MVP | [Proposé] (critique = PUB) |
| RDG-06 | Statistiques de lecture (par mois, éditeur, créateur) | S | V1 | [Proposé] |
| RDG-07 | Objectif annuel de lecture | C | V1 | [Proposé] |
| RDG-08 | Lecture d'un numéro non possédé conservée | M | MVP | [Existant] |

**Règles.** La lecture appartient à l'œuvre (clé d'œuvre), pas à l'exemplaire. Aucune lecture de pages numériques (hors périmètre).
**États.** `à lire` → `en cours` → `lu` ; `en cours` → `abandonné` ; `lu` → `relu` (nouvelle entrée de journal).
**Cas limites.** Recueil contenant des singles déjà lus ; lecture VF d'une œuvre VO.
**Dépendances.** Catalogue commun (relation édition → numéros contenus).

---

## 4. Calendrier des sorties (REL)

**Objectif.** Ne rater aucune sortie utile, en VO et en VF.

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| REL-01 | Vue semaine (NCBD), mois, 3 mois, toutes dates ; affichages cartes, mensuel, liste, par éditeur, par série, par marché | M | MVP | [Existant] |
| REL-02 | Marchés États-Unis et francophone uniquement ; éditeurs comics US et FR uniquement | M | MVP | [Existant] (13 novembre 2026) |
| REL-03 | Reports et annulations avec historique | M | MVP | [Partiel] |
| REL-04 | Conflits de sources visibles et tranchables | S | MVP | [Existant] (D-43) |
| REL-05 | Filtre « Ma pull list seulement » | M | MVP | [Existant] |
| REL-06 | Vue FOC et vue « Upcoming #1 » | S | V1 | [Proposé] |
| REL-07 | Variantes repliées sous le numéro | S | V1 | [Proposé] |
| REL-08 | Source partagée sous licence, ingestion planifiée serveur | M | V1 | [Bloqué] |
| REL-09 | Import et export CSV | S | MVP | [Existant] |
| REL-10 | Export ICS (abonnement calendrier) | C | V1 | [Proposé] (Plus) |

**États d'une sortie.** `annoncée` → `à venir` → `disponible` ; `à venir` → `reportée` (nouvelle date, historique) ; tout état → `annulée`.
**Cas limites.** Date VF sans date VO ; sortie sans jour précis (mois seulement) ; double source avec dates différentes.
**Dépendances.** Source sous licence, catalogue commun, notifications.

---

## 5. Pull List (PUL)

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| PUL-01 | Suivre une série ; prochaines sorties | M | MVP | [Existant] (D-42) |
| PUL-02 | Statut par numéro : prévu, disponible, récupéré, annulé | M | MVP | [Existant] |
| PUL-03 | « Récupéré » crée un exemplaire (prix, magasin, emplacement), annulable | S | V1 | [Proposé] |
| PUL-04 | Suivre un créateur ou un événement | S | V1 | [Proposé] |
| PUL-05 | Préférence de variante (principale seulement, toutes, ratio) | C | V1 | [Proposé] |
| PUL-06 | Export de la pull list pour son libraire (PDF/CSV) | C | V1 | [Proposé] |

**Règle.** Une pull list n'écrit jamais directement dans la Collection : elle passe par le contrat de domaine (S1 à S6) avec confirmation.
**Cas limites.** Série renumérotée (suivi transféré via `series_bond`) ; série annulée.

---

## 6. Communauté et fil d'actualité (COM)

**Objectif.** Rencontrer d'autres lecteurs et suivre leur activité, sans algorithme opaque ni exposition de données privées.

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| COM-01 | Suivre / ne plus suivre un lecteur (asymétrique) ; profil privé = demande d'abonnement | M | MVP | [Impl. local] (graphe `policy-core`) |
| COM-02 | Fil chronologique : publications des abonnements, des groupes et des entités suivies | M | MVP | [Impl. local] (contrat Feed) |
| COM-03 | Onglets du fil : Abonnements, Communauté, Moi | S | MVP | [Proposé] |
| COM-04 | Activité automatique optionnelle (j'ai lu, j'ai ajouté) — désactivée par défaut | S | V1 | [Proposé] |
| COM-05 | Masquer des mots ou des utilisateurs (durée paramétrable) | S | MVP | [Proposé] |
| COM-06 | Bloquer un utilisateur (invisibilité réciproque) | M | MVP | [Impl. local] |
| COM-07 | Coup de cœur de la semaine (vote communautaire) | C | V1 | [Proposé] |
| COM-08 | Messages privés | W | F | — |

**Règles.** Tri chronologique par défaut. Un compte bloqué ne voit plus le profil ni les contenus. Limites de débit (`policy-core.LIMITS` : 10 publications/heure, 30 commentaires/heure, liens interdits les 7 premiers jours).
**Dépendances.** Backend, comptes, modération.

---

## 7. Profils utilisateurs (PRF)

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| PRF-01 | Compte (e-mail + mot de passe, lien magique ; OAuth Google/Apple en option) | M | MVP | [Impl. local] (Supabase Auth) |
| PRF-02 | Pseudo unique, avatar, bio, langue, pays (facultatif) | M | MVP | [Impl. local] (`app.profiles`) |
| PRF-03 | Visibilité du profil : public, abonnés seulement, privé | M | MVP | [Impl. local] (`VISIBILITY`) |
| PRF-04 | Vitrine : séries favorites, statistiques de lecture publiques choisies, collection publique filtrée | S | V1 | [Proposé] |
| PRF-05 | Comic DNA affiché sur le profil (opt-in) | S | V1 | [Proposé] |
| PRF-06 | Export et suppression du compte (RGPD) | M | MVP | [Impl. local] (migrations 9 et 12, Edge Function) |
| PRF-07 | Appareils connectés et révocation | S | MVP | [Impl. local] (`app.devices`) |

**États d'un compte.** `invité (local)` → `inscrit non vérifié` → `actif` → (`suspendu` ↔ `actif`) → `suppression demandée` (délai de grâce 30 jours) → `supprimé` (données purgées, contenus publics anonymisés ou retirés selon le choix).
**Cas limites.** Pseudo déjà pris ou injurieux ; changement de pseudo (ancien réservé 30 jours) ; compte mineur.

---

## 8. Publications et interactions (PUB)

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| PUB-01 | Publication texte (5 000 caractères max) avec images (4 max), attachée ou non à une entité (numéro, série, événement, personnage) | M | MVP | [Impl. local] (validation `validatePost`) |
| PUB-02 | Critique : note au demi-point, texte, drapeau spoiler | M | MVP | [Proposé] |
| PUB-03 | Commentaires en fil (2 niveaux) ; désactivables par l'auteur | M | MVP | [Proposé] |
| PUB-04 | Réactions (une par type et par utilisateur) | M | MVP | [Proposé] |
| PUB-05 | Spoiler : obligatoire sur un numéro paru depuis moins de 30 jours (paramètre) ; flou par défaut | M | MVP | [Proposé] |
| PUB-06 | Listes partagées (ordre de lecture personnel, top), clonables avec provenance | S | V1 | [Proposé] |
| PUB-07 | Partage d'un exemplaire = copie filtrée (titre, numéro, année, éditeur, variante, couverture, état) | S | MVP | [Impl. local] (D-46) |
| PUB-08 | Modifier (historique conservé) et supprimer sa publication | M | MVP | [Proposé] |
| PUB-09 | Mentions @pseudo | C | V1 | [Proposé] |

**États d'une publication.** `brouillon` (local) → `publiée` → (`modifiée`) → `retirée par l'auteur` | `masquée par modération` (recours possible) ; révocation = contrat Revoke.
**Cas limites.** Image sous droits (couverture officielle téléversée) ; publication sur une fiche fusionnée (suit la fiche conservée) ; auteur bloqué par le lecteur.

---

## 9. Groupes, clubs et challenges (GRP)

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| GRP-01 | Créer un groupe (public, sur demande, privé), description, règles | S | V1 | [Proposé] |
| GRP-02 | Rôles : propriétaire, modérateur de groupe, membre | S | V1 | [Proposé] |
| GRP-03 | Club de lecture : œuvre ou événement, calendrier de lecture (numéros par semaine), discussions par étape avec spoilers cloisonnés | S | V1 | [Proposé] |
| GRP-04 | Challenge communautaire : objectif mesurable (lire N numéros d'un thème avant une date), progression issue du journal de lecture | S | V1 | [Proposé] |
| GRP-05 | Badges de challenge (sans valeur marchande) | C | V1 | [Proposé] |
| GRP-06 | Groupes locaux (ville, librairie partenaire) | C | F | [Proposé] |

**États d'un challenge.** `programmé` → `ouvert` → `clos` → `archivé` ; inscription possible en `programmé` et `ouvert`.
**Règle.** La progression d'un challenge est **dérivée** du journal de lecture ; aucune déclaration manuelle de score.

---

## 10. Notifications (NOT)

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| NOT-01 | Centre de notifications in-app (non lues, tout marquer lu) | M | MVP | [Proposé] |
| NOT-02 | Types : nouvel abonné, réponse, mention, réaction (groupées), sortie d'un numéro suivi, FOC proche, changement de date, décision de modération | M | MVP | [Proposé] |
| NOT-03 | Préférences par type et par canal (in-app, push, e-mail) | M | MVP | [Proposé] |
| NOT-04 | Notifications locales (PWA, Android) pour les sorties, sans compte | S | MVP | [Proposé] |
| NOT-05 | Push Web et Android (FCM) | S | V1 | [Proposé] |
| NOT-06 | Résumé hebdomadaire par e-mail (opt-in) | C | V1 | [Proposé] |

**Règles.** Aucune notification marketing sans consentement explicite. Regroupement des réactions (« 5 personnes ont aimé »). Heures calmes respectées.

---

## 11. PANEL Free et PANEL Plus (PLN)

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| PLN-01 | Offre Free complète pour l'usage personnel et social essentiel | M | V1 | [Proposé] |
| PLN-02 | PANEL Plus mensuel et annuel via Stripe Checkout | M | V1 | [Proposé] |
| PLN-03 | Portail client Stripe : moyen de paiement, factures, annulation | M | V1 | [Proposé] |
| PLN-04 | Droits par offre calculés côté serveur (table `entitlements`), jamais côté client | M | V1 | [Proposé] |
| PLN-05 | Essai gratuit (durée à décider, Q5) sans carte ou avec carte | S | V1 | [Proposé] |
| PLN-06 | Rétrogradation sans perte de données (fonctions Plus en lecture seule) | M | V1 | [Proposé] |

Détail des offres : [`PANEL_ROADMAP.md`](PANEL_ROADMAP.md) § Phase 6 et ci-dessous.

| Fonction | Free | Plus |
|---|---|---|
| Collection, emplacements, scan, import, export, sauvegardes | Illimité | Illimité |
| Lecture, événements, progression | Oui | Oui |
| Calendrier, pull list | Oui | + export ICS, suivi créateur/événement illimité (Free : 10) |
| Publier, commenter, réagir, suivre, rejoindre des groupes, signaler, bloquer | **Oui, toujours** | Oui |
| Créer des groupes | 2 | 20 |
| Statistiques avancées (périodes, créateurs, tendances, Comic DNA détaillé) | Résumé | Complet |
| Thèmes et personnalisation du profil | Base | Étendue |
| Synchronisation multi-appareils | 2 appareils | 10 appareils |
| Publicité | Aucune | Aucune |

**Règle absolue.** Aucune interaction sociale essentielle derrière l'abonnement. Une rétrogradation ne supprime ni ne masque aucune donnée existante.
**États d'un abonnement** (miroir Stripe) : `trialing` → `active` → (`past_due` → `active` | `canceled`) ; `active` → `canceled` (fin de période) ; `incomplete` → `incomplete_expired`.

---

## 12. Administration et modération (ADM)

| ID | Exigence | Prio | Cible | État |
|---|---|---|---|---|
| ADM-01 | Signaler un contenu ou un compte (motifs : spam, harcèlement, haine, données personnelles, illégal, spoiler, autre) | M | MVP | [Impl. local] (`REPORT_REASONS`) |
| ADM-02 | File de modération : priorité, décision motivée (conserver, masquer, retirer, suspendre), journalisée | M | MVP | [Impl. local] (`createModeration`) |
| ADM-03 | Recours de l'auteur et notification de la décision (exposé des motifs DSA) | M | MVP | [Partiel] (champ `appealable`) |
| ADM-04 | Rôles `member`, `moderator`, `admin` ; un modérateur ne juge pas ses propres contenus | M | MVP | [Impl. local] (migration 10) |
| ADM-05 | Gestion du catalogue : fusion, correction, rattachements, provenance | S | V1 | [Partiel] (catalogue commun local, D-56) |
| ADM-06 | Administration des sources de données | S | MVP | [Existant] local |
| ADM-07 | Tableau de bord : signalements ouverts, délai moyen, comptes suspendus | S | V1 | [Proposé] |
| ADM-08 | Journal d'audit des actions d'administration (inaltérable) | M | MVP | [Impl. local] (`staff_role_log`) |
| ADM-09 | Rapport de transparence annuel (DSA) | S | V1 | [Proposé] |

---

## 13. Catalogue et données comics

Définitions et relations complètes : [`PANEL_DATA_MODEL.md`](PANEL_DATA_MODEL.md) § 3. Résumé des distinctions :

| Notion | Ce que c'est | Ce que ce n'est pas |
|---|---|---|
| Univers | Monde narratif (Marvel 616, Ultimate, DC Absolute) | Un éditeur |
| Éditeur | Entreprise de publication (Marvel, Urban Comics) | Une marque ou un univers |
| Série | Titre + volume chez un éditeur | Un événement |
| Numéro | Parution d'une série (série, numéro) | Un objet physique |
| Édition | Publication physique (single, TPB, HC, omnibus, VF) qui contient un ou plusieurs numéros | Une variante |
| Variante | Version d'un numéro (couverture, traitement, exclusivité) | Une réédition |
| Couverture | Image attachée à une variante, avec droits | Un fichier libre d'usage |
| Exemplaire personnel | Objet possédé, privé | Une fiche catalogue |
| Lecture | Fait de lecture attaché à l'œuvre | Une possession |
| Publication communautaire | Contenu utilisateur | Une donnée catalogue |

**Éditions françaises et originales.** Une édition VF est reliée aux numéros VO qu'elle contient (`edition_content`) ; relation `translated_from` déjà présente dans les sorties (`REL_RELATIONS`). Rééditions : relation `reprint_of`. Dates par territoire : chaque édition a ses dates (`store_date` par marché). Formats : single, TPB, HC, omnibus, intégrale, deluxe, kiosque.

**Anti-doublons et correction.** Unicité en base + rapprochement par identifiants externes puis par (série normalisée, numéro) ; doublons possibles présentés à un humain (catalogue commun, D-56) ; fusion conservant l'identifiant perdant comme alias ; jamais de fusion automatique silencieuse.

## 14. Collection Intelligence

| Fonction | Exigences | État |
|---|---|---|
| Statistiques de collection | COL-09 | [Existant] |
| Progression des séries, numéros manquants | COL-08 | [Existant] |
| Répartition par éditeur | COL-09 | [Existant] |
| Répartition par période (décennie, année de couverture) | COL-09 | [Partiel] |
| Historique des acquisitions | COL-11 | [Partiel] |
| Emplacements physiques | COL-04 | [Existant] |
| Import CSV | COL-05, COL-06 | [Existant] / [Partiel] |
| Export des données | COL-13 | [Existant] |
| Sauvegarde et portabilité | COL-13, PRF-06 | [Existant] / [Impl. local] |

## 15. Social et différenciation (DIF)

Chaque fonction a un objectif mesurable ; une fonction qui ne l'atteint pas après 3 mois de bêta est retirée ou revue.

| ID | Fonction | Description | Objectif mesurable | Prio | Cible |
|---|---|---|---|---|---|
| DIF-01 | **Comic DNA** | Profil de goûts : éditeurs, créateurs, univers, genres, périodes, calculé sur lectures et collection ; explicable (« parce que vous avez lu… ») | ≥ 40 % des profils actifs l'affichent ; recommandations issues du DNA cliquées ≥ 2× plus que les génériques | S | V1 |
| DIF-02 | **Collection Match** | Compatibilité entre deux lecteurs (lectures et séries communes, différences intéressantes), sans exposer les valeurs | ≥ 15 % des nouveaux abonnements issus d'un Match | S | V1 |
| DIF-03 | **Reading Clubs** | GRP-03 | ≥ 30 % des membres d'un club terminent l'étape 1 | S | V1 |
| DIF-04 | **Community Challenges** | GRP-04 | ≥ 20 % des inscrits terminent | S | V1 |
| DIF-05 | **Recommandations** | Prochaine lecture à partir des événements (niveaux), du Comic DNA et des lecteurs proches | Taux d'ajout à « à lire » ≥ 5 % des recommandations vues | S | V1 |
| DIF-06 | **Découverte communautaire** | Tendances de la semaine (lectures, critiques), coups de cœur, listes populaires — chronologique ou par volume, jamais par valeur marchande | ≥ 25 % des sessions hebdomadaires visitent Découvrir | C | V1 |
| DIF-07 | **Profils de lecteurs** | Archétypes explicables issus du DNA (« Explorateur indé », « Gardien du 616 ») | Partage du profil ≥ 10 % des utilisateurs | C | V1 |
| DIF-08 | **Collection ↔ publications** | Depuis un exemplaire : « en parler » ; depuis une critique : « ajouter à ma wishlist / à lire » | ≥ 20 % des critiques ont généré une action wishlist ou à lire | M | MVP |

**Gadgets écartés** : classements par valeur de collection, fil infini algorithmique, gamification monétaire, NFT, cotes spéculatives publiques.
