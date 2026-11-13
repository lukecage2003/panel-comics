# PANEL — Tests d'acceptation

Date : 13 novembre 2026. Statut : proposé (D-58). Chaque exigence de [`PANEL_FUNCTIONAL_SPECIFICATIONS.md`](PANEL_FUNCTIONAL_SPECIFICATIONS.md) a ici au moins un critère vérifiable (`AT-<ID>`). La colonne « Preuve » indique le test automatisé existant, ou le type de test à écrire : **D** test de domaine Node (`domains/**/*.test.js`), **B** test de base PGlite (`backend/tests`), **I** test d'interface Edge/CDP (`run-all-tests.js`), **M** vérification manuelle ou mesure produit.

Règles de test (inchangées) : fixtures **fictives** uniquement ; jamais les données réelles de l'utilisateur ; une suite d'interface à la fois ; `check:secrets` et `check-boundaries --strict` à chaque commit.

## Explorer et catalogue

| ID | Critère d'acceptation | Preuve |
|---|---|---|
| AT-EXP-01 | « absolut batmn » et « ABSOLUTE BATMAN » trouvent la série *Absolute Batman* en tête ; temps de réponse local < 200 ms sur 5 000 fiches | Existant (D-33) ; B pour la version serveur |
| AT-EXP-02 | La fiche série affiche éditeur, volume, années, numéros et le statut possédé / manquant de l'utilisateur | I |
| AT-EXP-03 | La fiche numéro affiche dates couverture / magasin / FOC distinctes ; une date incertaine est marquée | I, B |
| AT-EXP-04 | Les 9 événements ont des niveaux justifiés ; l'essentiel est visible en tête ; progression par niveau | Existant (test « Event Center v2 (R2) ») |
| AT-EXP-05 | Un même numéro ajouté par Collection, Sorties et Explorer a une seule identité ; reconstruction idempotente | Existant (test « Catalogue commun (R1) ») |
| AT-EXP-06 | Une page créateur liste ses rôles normalisés et ses séries ; aucune page sans contenu | I |
| AT-EXP-07 | Chaque fiche partagée porte au moins une `claim` avec source et licence ; ingestion rejouable sans doublon | B |
| AT-EXP-08 | Une correction proposée apparaît dans la file d'administration et son statut est notifié à l'auteur | B, I |
| AT-EXP-09 | Une contribution non relue n'est jamais visible publiquement | B |
| AT-EXP-10 | Aucun éditeur manga/manhwa/BD n'est proposé ; une publication `manga` est refusée (`out_of_scope`) ; les données existantes restent intactes | Existant (tests 41 et 44, test de domaine « manga hors périmètre ») ; B |

## Collection

| ID | Critère | Preuve |
|---|---|---|
| AT-COL-01 | Un code-barres UPC + supplément connu donne le bon numéro ; un code ambigu présente des candidats, jamais un choix silencieux | Existant (suites scan) |
| AT-COL-02 | Une couverture à distance de Hamming ≤ 8 est reconnue ; écart < 4 avec le second candidat → choix présenté | Existant (test 4) + D pour les seuils |
| AT-COL-03 | Modifier un exemplaire conserve les autres champs ; une valeur inconnue s'affiche « — » | Existant |
| AT-COL-04 | Un exemplaire rangé dans pièce → meuble → boîte s'affiche avec son chemin complet | Existant |
| AT-COL-05 | Import LoCG d'un fichier de test de 2 700 lignes : rapport ajoutés / fusionnés / ignorés exact | Existant |
| AT-COL-06 | Réimporter le même fichier crée **zéro** doublon | D, I |
| AT-COL-07 | Un élément de wishlist garde priorité, statut et prix maximal après synchronisation | I, B |
| AT-COL-08 | Les numéros manquants d'une série de référence (fixture) sont exacts | Existant |
| AT-COL-09 | Le bandeau de chiffres n'apparaît que sur la page Collection ; répartition par éditeur = 100 % | Existant (test 44 + vérification du 13 novembre 2026) ; I pour la période |
| AT-COL-10 | Aucune conversion de devise implicite ; plus-value par devise exacte sur fixture | Existant (F0, F1) |
| AT-COL-11 | L'historique des acquisitions par mois correspond aux dates d'achat de la fixture | I |
| AT-COL-12 | Un exemplaire supprimé va en corbeille et se restaure à l'identique | Existant (D-36) |
| AT-COL-13 | Export puis restauration d'une sauvegarde par domaine redonnent un état identique (comparaison JSON) | Existant (D-39) |
| AT-COL-14 | Deux appareils convergent après modifications concurrentes ; aucun exemplaire perdu (scénarios V1 à V14) | Impl. local (D-44) ; M sur Supabase réel |
| AT-COL-15 | Une copie partagée ne contient ni prix, ni valeur, ni emplacement, ni notes | Existant en domaine (`shareCopy`) ; B |
| AT-COL-16 | Un exemplaire de variante référence `variant_id` ; le numéro parent reste compté une fois en complétion | D, I |

## Lecture

| ID | Critère | Preuve |
|---|---|---|
| AT-RDG-01 | Marquer « lu » un numéro possédé en 2 exemplaires crée un seul état de lecture | Existant (L1) |
| AT-RDG-02 | Une relecture ajoute une entrée datée sans écraser la première | Existant |
| AT-RDG-03 | Le prochain numéro proposé est le premier non lu de la série | Existant |
| AT-RDG-04 | La progression d'un événement au niveau Essentiel compte uniquement les numéros essentiels lus | Existant (R2) |
| AT-RDG-05 | Une note au demi-point (3,5) est acceptée ; 3,3 est refusée | D, B |
| AT-RDG-06 | Les statistiques de lecture annuelles égalent le comptage du journal de la fixture | D |
| AT-RDG-07 | L'objectif annuel affiche le pourcentage exact et ne compte pas deux fois une relecture (paramètre) | D |
| AT-RDG-08 | Un numéro lu non possédé reste lu après ajout puis suppression d'un exemplaire | Existant |

## Calendrier et Pull List

| ID | Critère | Preuve |
|---|---|---|
| AT-REL-01 | Les vues semaine, mois, 3 mois et les 6 affichages s'affichent sans débordement à 375 px | Existant (test 44) |
| AT-REL-02 | Les filtres Marché et Éditeur ne proposent que États-Unis / Francophone et des éditeurs comics | Existant (test 41) + I |
| AT-REL-03 | Un report affiche l'ancienne et la nouvelle date avec la date du relevé | I |
| AT-REL-04 | Un conflit de dates entre deux sources est visible et tranchable, réversible | Existant (test 45) |
| AT-REL-05 | « Ma pull list seulement » ne montre que les séries suivies | Existant (test 44) |
| AT-REL-06 | La vue Upcoming #1 liste les numéros 1 (ou 0) de séries nouvelles ; la vue FOC trie par `foc_date` | I |
| AT-REL-07 | 5 variantes d'un numéro s'affichent repliées sous une seule carte | I |
| AT-REL-08 | L'ingestion planifiée rejouée deux fois ne crée aucun doublon ; une entrée manga est rejetée | B |
| AT-REL-09 | Export CSV puis import du même fichier : aucun doublon | Existant |
| AT-REL-10 | Le flux ICS s'importe dans un agenda standard et ne contient que la pull list | M |
| AT-PUL-01 | Suivre une série fait apparaître ses prochaines sorties | Existant |
| AT-PUL-02 | Les 4 statuts sont modifiables et persistent | Existant |
| AT-PUL-03 | « Récupéré » propose de créer un exemplaire prérempli ; annulable ; aucune écriture directe dans Collection | I, D |
| AT-PUL-04 | Suivre un créateur fait apparaître ses nouvelles séries | I |
| AT-PUL-05 | La préférence « principale seulement » masque les variantes de la pull list | I |
| AT-PUL-06 | L'export PDF/CSV de la pull list contient les numéros de la semaine choisie | I |

## Communauté, profils, publications

| ID | Critère | Preuve |
|---|---|---|
| AT-COM-01 | Suivre un profil privé crée une demande `pending` ; l'accepter rend ses publications visibles | D (graphe existant) ; B |
| AT-COM-02 | Le fil ne contient que les publications des abonnements, groupes et entités suivies, en ordre chronologique | D (contrat Feed) ; B |
| AT-COM-03 | Les onglets Abonnements / Communauté / Moi renvoient des ensembles distincts | I |
| AT-COM-04 | L'activité automatique est désactivée par défaut et ne publie rien sans activation | B |
| AT-COM-05 | Un mot masqué fait disparaître les publications qui le contiennent pour la durée choisie | D |
| AT-COM-06 | Après blocage, ni le profil ni les contenus ne sont visibles dans les deux sens ; les abonnements sont supprimés | D, B |
| AT-COM-07 | Un utilisateur vote une seule fois par semaine pour le coup de cœur | B |
| AT-COM-08 | (Won't) Aucune messagerie privée n'est exposée en V1 | M |
| AT-PRF-01 | Inscription, confirmation d'e-mail, connexion, lien magique, déconnexion fonctionnent ; mot de passe faible refusé | M, B |
| AT-PRF-02 | Un pseudo hors format (`^[A-Za-z0-9_.-]{3,30}$`) ou déjà pris est refusé | Existant (contrainte migration 2) ; B |
| AT-PRF-03 | Un profil privé n'apparaît pas dans la recherche d'utilisateurs pour un non-abonné | B |
| AT-PRF-04 | La vitrine n'affiche jamais une donnée financière ou un emplacement | B, I |
| AT-PRF-05 | Le Comic DNA n'est visible qu'après opt-in | B |
| AT-PRF-06 | L'export RGPD contient toutes les tables personnelles ; la suppression purge tout après le délai de grâce | Impl. local (`privacy.test.js`, `delete-account.test.js`) ; M |
| AT-PRF-07 | Un appareil révoqué ne peut plus synchroniser | Impl. local (`roles.test.js`) |
| AT-PUB-01 | Une publication de 5 001 caractères ou de 5 images est refusée ; 10 publications/heure maximum | D (`validatePost`, limiteur) ; B |
| AT-PUB-02 | Une critique avec note et spoiler s'affiche floutée pour les autres lecteurs | I |
| AT-PUB-03 | Une réponse de 3ᵉ niveau est refusée ; commentaires désactivés → `forbidden` | B |
| AT-PUB-04 | Une réaction répétée est un basculement (pas de doublon) | B |
| AT-PUB-05 | Une critique d'un numéro paru il y a 10 jours est forcée en spoiler | D, B |
| AT-PUB-06 | Cloner une liste conserve la provenance de la liste d'origine | B |
| AT-PUB-07 | Partager un exemplaire ne transmet que les champs de la liste blanche | Existant (D-46) |
| AT-PUB-08 | Modifier conserve l'historique ; supprimer retire l'affichage immédiatement | B, I |
| AT-PUB-09 | Une mention notifie l'utilisateur mentionné sauf s'il a bloqué l'auteur | B |

## Groupes, notifications, offres

| ID | Critère | Preuve |
|---|---|---|
| AT-GRP-01 | Un groupe privé est invisible pour un non-membre ; un groupe sur demande crée une adhésion `pending` | B |
| AT-GRP-02 | Un membre ne peut pas modérer ; un modérateur de groupe ne peut pas supprimer le propriétaire | B |
| AT-GRP-03 | Les discussions de l'étape 3 d'un club sont floutées pour un membre qui n'a pas terminé l'étape 2 | I |
| AT-GRP-04 | La progression d'un challenge égale le nombre de lectures du journal correspondant à la règle | D |
| AT-GRP-05 | Un badge est attribué une seule fois, à la complétion | B |
| AT-GRP-06 | (Futur) — | — |
| AT-NOT-01 | Le compteur de non lues diminue après « tout marquer lu » | I, B |
| AT-NOT-02 | Chaque type de la liste NOT-02 est déclenché par son événement source en test | B |
| AT-NOT-03 | Désactiver un type supprime les envois futurs de ce type sur ce canal | B |
| AT-NOT-04 | Une notification locale de sortie est déclenchée sans compte, pour un numéro de la pull list | I |
| AT-NOT-05 | Un jeton push révoqué ne reçoit plus rien | B, M |
| AT-NOT-06 | Le résumé hebdomadaire n'est envoyé qu'aux utilisateurs qui l'ont activé | B |
| AT-PLN-01 | Toutes les actions sociales essentielles fonctionnent avec un compte Free | I, B |
| AT-PLN-02 | Paiement de test Stripe → abonnement `active` → droits Plus visibles | M (mode test) |
| AT-PLN-03 | Annulation dans le portail → `cancel_at_period_end` → retour à Free à la date prévue | M, B |
| AT-PLN-04 | Modifier les droits côté client n'ouvre aucune fonction Plus (RPC refuse `plan_required`) | B |
| AT-PLN-05 | L'essai se termine à la date prévue ; sans paiement, retour à Free sans perte | B |
| AT-PLN-06 | Après rétrogradation, groupes et statistiques existants restent consultables, aucune donnée supprimée | B, I |

## Administration et modération

| ID | Critère | Preuve |
|---|---|---|
| AT-ADM-01 | Un signalement avec un motif hors liste est refusé ; 21ᵉ signalement du jour refusé | D (`REPORT_REASONS`, `LIMITS`) ; B |
| AT-ADM-02 | Une décision `hide` masque le contenu et crée une entrée de journal inaltérable | D (`createModeration`) ; B |
| AT-ADM-03 | L'auteur reçoit l'exposé des motifs ; son appel est traité par un autre modérateur | B |
| AT-ADM-04 | Un modérateur ne peut pas décider sur son propre contenu | D (`canModerate`) ; B |
| AT-ADM-05 | Une fusion crée un alias ; les références de l'ancienne fiche suivent la nouvelle ; réversible | Existant en local (D-56) ; B |
| AT-ADM-06 | Désactiver une source empêche toute ingestion depuis elle | Existant |
| AT-ADM-07 | Le tableau de bord affiche les mêmes chiffres qu'une requête de contrôle | B |
| AT-ADM-08 | Toute attribution de rôle apparaît dans `staff_role_log` | Impl. local (`roles.test.js`) |
| AT-ADM-09 | Le rapport de transparence agrège sans donnée personnelle | B |

## Différenciation

| ID | Critère | Preuve |
|---|---|---|
| AT-DIF-01 | Le Comic DNA d'une fixture donne les éditeurs et créateurs dominants attendus, avec explication | D |
| AT-DIF-02 | Collection Match de deux fixtures donne le score attendu et n'expose aucune valeur | D |
| AT-DIF-03 | Voir AT-GRP-03 ; taux de complétion mesuré en bêta | M |
| AT-DIF-04 | Voir AT-GRP-04 ; taux de complétion mesuré en bêta | M |
| AT-DIF-05 | Une recommandation n'inclut jamais un numéro déjà lu ni hors périmètre | D |
| AT-DIF-06 | Les tendances ne sont jamais triées par valeur marchande | D |
| AT-DIF-07 | L'archétype est reproductible pour une même entrée | D |
| AT-DIF-08 | Depuis une critique, « Ajouter à ma wishlist » crée l'élément ; depuis un exemplaire, « En parler » préremplit la cible | I |

## Critères transverses (toute livraison)

| ID | Critère |
|---|---|
| AT-X-01 | Toutes les suites existantes restent vertes (52 interface, 55 domaine, 124 base) |
| AT-X-02 | Aucune donnée utilisateur supprimée ou modifiée sans sauvegarde et retour arrière testés |
| AT-X-03 | Contraste AA dans les modes clair et sombre ; aucun débordement à 375 px |
| AT-X-04 | `check:secrets` et `check-boundaries --strict` verts |
| AT-X-05 | Aucun contenu manga, manhwa, manhua, webtoon ou BD franco-belge proposé |

## Contrôle de couverture

Exigences définies : EXP 10, COL 16, RDG 8, REL 10, PUL 6, COM 8, PRF 7, PUB 9, GRP 6, NOT 6, PLN 6, ADM 9, DIF 8 = **109**. Critères `AT-` : **109** (1 par exigence ; GRP-06 et COM-08 notés hors version).
