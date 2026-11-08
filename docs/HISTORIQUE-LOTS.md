# Historique des lots — Panel by Primestone

Relevé du 7 novembre 2026. Chaque référence a été vérifiée avec `git log` : la branche `main` est locale et n'a pas de remote, donc rien n'est poussé.

## Phase 0 — Audit
Audit initial réalisé avant le suivi par Git. Aucun commit ne lui correspond.

## Phase 1 — Stabilisation (clôturée)

| Étape | Commit | Contenu |
|---|---|---|
| 1 à 4 | `3dfa56f` | Point de départ suivi par Git, stabilisation, protection des données |
| 5 | `be3d280` | Retrait de la partie numérique ; les données sont conservées |
| 6 et 7 | `8b04cb3` | Finitions visuelles, DESIGN.md, Android 1.2 |
| — | `7bc4771` | Exclusion des rapports générés du détecteur |

## Phase 2 — Collection, catalogue et découverte (clôturée le 7 novembre 2026)

| Lot | Périmètre | Commit(s) vérifié(s) | Statut |
|---|---|---|---|
| 2.1 | Catalogue normalisé indépendant (IndexedDB `panel-catalog`, provenance, durabilité) | `31a5184`, puis `8823254` (sécurisation : copie IndexedDB atomique, échec de migration sans nouvelle tentative, rapport d'identifiants) | Validé |
| 2.2 | Exemplaires et variantes (normalisation, regroupement, saisie structurée, restauration fidèle) | `0aca044` | Validé |
| 2.3 | Organisation physique : emplacements Pièce → Meuble → Boîte → Séparateur | `1de33e8` | Validé |
| 2.4 | Calendrier international, sorties, Pull List par numéro, Wishlist structurée | `7eae929` | Validé |
| 2.5 | Sources de données, provenance par champ, conflits, import contrôlé (« Data Acquisition & Intelligence Engine ») | `29b9b2a` (DA Primestone livrée juste avant, dans `d36df45`) | Validé |
| 2.6 | Explorer & Reading Guides | `fe19e3c` | Validé le 7 novembre 2026 |

Remarques :
- Le commit `d36df45` est la direction artistique « Primestone » (jaune et noir). Elle a été livrée et validée avec le lot 2.5 ; ce n'est pas un commit fonctionnel du lot 2.5.
- Le lot 2.1 compte deux commits : la livraison, puis la sécurisation.
- Un lot 2.7 avait été envisagé au départ. Il n'a pas été réalisé : la Phase 2 se clôt au lot 2.6, et les sujets restants passent au backlog (voir [`ROADMAP.md`](ROADMAP.md)).

### Validation du lot 2.6
L'utilisateur a réalisé huit contrôles fonctionnels, tous satisfaisants :
1. Recherche globale et pertinence des résultats.
2. Pages éditeurs, personnages, créateurs et séries.
3. Guide King in Black et ses 65 entrées.
4. Filtres Essentiel / Facultatif.
5. Persistance de la progression après fermeture et réouverture.
6. Distinction entre possédé, lu et wishlist.
7. Import et export des guides.
8. Affichage mobile.

### Limites connues à la clôture de la Phase 2 (non transformées en fonctionnalités)
- Le guide King in Black est une **démonstration non exhaustive** relevée auprès d'une seule source.
- Les **sources d'images sous licence** pour les guides restent à identifier.
- Les **correspondances VO/VF** sont en partie non vérifiées (deux éditions Panini sans sommaire confirmé).
- Les **actualités** ne sont pas activées, faute de source ou de CMS.
- **ReadingOrders.com, Comic Compass et French Comics Reading Order** n'ont pas été consultés.
- La clé Comic Vine reste à renouveler. La signature Android de publication, l'option `allowBackup` et la purge des anciennes clés Marvel/Vision sont toujours en attente de décision.

## Plan directeur 2.0 — lot F0 : correctifs des calculs financiers
Autorisé le 7 novembre 2026 (décision D-17), **livré le 8 novembre 2026, en attente de validation**. Spécification : [`directeur/02-audit-financier.md`](directeur/02-audit-financier.md) et backlog B-01 à B-06, B-24, B-25 de [`directeur/04`](directeur/04-backlog-feuille-de-route-decisions.md).
- **Aucune substitution** : un prix payé inconnu n'est plus remplacé par le prix de couverture ; une valeur inconnue n'est plus remplacée par le prix de couverture ni par 0. Les totaux portent sur les données connues, avec leur couverture (« 1 inconnu(s) », « sur N ex. sur M »).
- Affichage « — » pour une valeur inconnue (au lieu de « $0.00 ») ; sommes en centimes ; pourcentages au format français.
- Valeur totale ventilée par source (marché, saisie, cote auto avec sa fourchette) ; carte « Données financières » au tableau de bord.
- Plus d'état « NM 9.4 » inventé à la création (sorties, wishlist, scan continu, séries, import CSV sans état, restauration JSON) ; option « État non renseigné » ; la cote auto signale l'hypothèse et passe en confiance faible.
- **D-18** : à l'ajout, le prix de couverture préremplit le prix d'achat (visible, modifiable, jamais en arrière-plan) ; non enregistré sur une fiche de wishlist ; aucun préremplissage en modification.
- Instantanés de valeur : nouveaux relevés « méthode 2 » ; les anciens relevés sont conservés tels quels et affichés comme « ancienne méthode ».
- Aucune donnée existante modifiée, aucune migration ; devise inchangée (F-D2 ouverte). Test 30 ajouté (30 vérifications) ; suite complète 29/29.
- **Finition F0 (8 novembre 2026)** :
  - ajouts rapides vérifiés (sorties, Pull List, wishlist ↔ collection, scan continu, séries) : aucun n'invente de prix payé ; les publications n'ont pas de prix de couverture, donc le prix payé reste inconnu ;
  - bouton explicite « = prix de couverture » dans le formulaire, visible seulement si le prix payé est vide et la couverture connue, y compris en modification (rien n'est enregistré sans validation) ;
  - formulaire d'exemplaire sans débordement horizontal à 320, 360, 390 et 430 px (champs, sélecteurs et boutons accessibles ; bureau inchangé) ;
  - test 30 étendu à 34 vérifications ; suite complète 29/29 ; `sw.js` en `panel-2026-11-08-f0b`.

## Phase 3 — Comptes, profils et synchronisation local-first
Conception livrée le 7 novembre 2026 (voir [`phase3/`](phase3/), commit `93f15db`). Le lot 3.1 a été lancé par l'utilisateur le 7 novembre 2026, puis suspendu le même jour avant toute modification de code (copies de sécurité `*.backup.20261107-lot31` créées, non versionnées), pour intégrer la correction « séparation stricte Collection / Explorer ».

### Lot 3.1 — Fondations backend et préparation du client (8 novembre 2026, en attente de validation)
Repris après la validation de G1 (D-20) ; F0 validé (D-19).
- **Backend** ([`backend/`](../backend/README.md)) :
  - 6 migrations compatibles Supabase, schéma `app` et ses 11 tables (aucune autre ; schémas Explorer et Community non créés) ;
  - RLS sur 100 % des tables, politiques par opération, tables techniques en lecture seule, `anon` sans droit ;
  - révision `rev` par utilisateur (`security definer`, `search_path` vide) et `updated_at` ;
  - contraintes de taille et d'identifiant, cascade à la suppression d'un compte.
- **Tests sans Docker** (PGlite 0.5.11, PostgreSQL 18.6, rôles non privilégiés vérifiés) : 71 tests en 13 à 23 s environ, dont :
  - 1 000 écritures de révision ;
  - un test de mutation (RLS désactivée ⇒ fuite détectée) ;
  - une sauvegarde puis une restauration locale (`dumpDataDir`).
- **Secrets** : `npm run check:secrets` donne 0 correspondance dans les fichiers suivis. Un faux positif, une empreinte de commit dans une URL de `build.gradle`, est écarté par une exception de contexte.
- **Client** :
  - `SYNC_DOMAINS` et `Panel.sync.readiness()`, en lecture seule et groupés par domaine ;
  - `PANEL_SYNC_ENABLED = false` ; aucune interface, aucun réseau ;
  - test 31 : localStorage et IndexedDB identiques avant et après l'appel ;
  - `sw.js` passe en `panel-2026-11-08-lot31`.
- **Constat pour le lot 3.4** : un upsert en conflit consomme deux révisions (`BEFORE INSERT` puis `BEFORE UPDATE`). L'ordre reste strictement croissant, avec un trou.
- **Non exécuté** : `supabase db reset` sous Docker (ni Docker ni la CLI ne sont installés).
- **Suite du front** : premier passage à 29/30, avec un échec intermittent du contrôle `quota` du test 18 (Fandom, sans lien avec le lot) ; second passage à **30/30**.
- **Sauvegardes** : `*.backup.20261108-lot31` pour `index.html`, `run-all-tests.js` et `sw.js` ; aucune sauvegarde supprimée.

### Audit de clôture du lot 3.1 et préparation des lots suivants (8 novembre 2026)
- **Défauts démontrés et corrigés** (migration 7 `hardening`, [audit](phase3/09-audit-cloture-lot-3.1.md)) :
  - D1 : un appareil révoqué pouvait être réactivé par l'utilisateur ; droits par colonne sur `devices` ;
  - D2 : `field_revs` sans limite de taille ;
  - D3 : colonnes extraites sans limite de longueur.
- **Tests** : base 82/82 (dont `hardening.test.js`) ; `verify-supabase.sql` en lecture seule ; secrets 0 ; front 30/30, test 18 stabilisé.
- **Outils** : `npm run check:boundaries` (15 couplages relevés, mode rapport).
- **Documents** : plan définitif de 3.1b ([`directeur/05`](directeur/05-preparation-lot-3.1b.md)), dossier des lots 3.2 à 3.7 ([`phase3/10`](phase3/10-dossier-lots-3.2-3.7.md)), spécifications F1 et L1 révisées avec l'analyse de F-D2, F-D4, L-D1 à L-D3 ([`directeur/06`](directeur/06-specifications-F1-L1.md)), conception Explorer 2.0 et Community consolidée ([`directeur/07`](directeur/07-conception-explorer-2.0-community.md)).
- **Non exécuté** : validation sous Supabase local (Docker absent) ; procédure dans l'audit.

### Lot 3.1b — Séparation des domaines côté client (lancé le 8 novembre 2026, D-21)
Décisions : P1-a (D-22), B1-a deux versions (D-23), B1-b secrets exclus avec option chiffrée (D-24), B1-c `panel-bundle` (D-25). Navigation (3.1b-7) reportée au lot 4.9 ; filtre comics des Sorties reporté au lot 4.6.
- **3.1b-1 Sauvegardes par domaine** ([spécification et réalisation](phase4/06-sauvegardes-par-domaine.md) § 11) :
  - format `panel-bundle` v1 : fournisseurs Collection, Lecture, Explorer et Application ; manifeste avec comptes et sha256 ;
  - restauration d'un domaine seul, avec aperçu, fusion par défaut, garde-fou au-delà de 50 fiches ou 10 %, et annulation ;
  - export au format compatible v3 toujours proposé ; clés exportées seulement chiffrées (AES-GCM, PBKDF2) et sur demande ;
  - anciens fichiers v3 et v2 relus comme avant ;
  - test 32 (R1 à R9) ; test 29 adapté au nouveau format de la sauvegarde complète ;
  - défaut trouvé par le test et corrigé : l'annulation d'une restauration doit reprendre une copie profonde et suspendre la resynchronisation des emplacements, sinon l'état d'avant n'est pas rétabli à l'identique.
  - Résultats : front **31/31**, base 82/82, secrets 0. Sauvegardes `*.backup.20261108-3.1b-0` créées ; aucune supprimée.
- **3.1b-2 Contrats S1 et S2** ([réalisation](phase4/05-contrats-s1-s6.md#réalisation-de-s1-et-s2-sous-lot-31b-2-8-novembre-2026)) :
  - `Panel.contracts.personal.v1` : statuts minimaux en liste blanche, lecture seule, réglage de personnalisation, P1-a ;
  - commandes acceptées seulement après un vrai geste de l'utilisateur, avec un jeton à usage unique ;
  - dédoublonnage par Collection et annulation exacte ;
  - test 33 ; front **32/32**. Sauvegardes `*.backup.20261108-3.1b-2`.
- **3.1b-3 Explorer découplé de Collection (C2 à C10, A7)** ([réalisation](phase4/05-contrats-s1-s6.md#consommation-par-explorer-sous-lot-31b-3-8-novembre-2026)) :
  - Explorer ne lit plus `physicalSingles`, `relPulls` ni les séries suivies ; statuts et filtres personnels via S1, actions via S2 avec un jeton de geste ;
  - S1 v1 complété de façon compatible : statuts facultatifs `unconfirmed` et `seriesFollowed`, agrégats `collectionFacets` « d'après votre collection » ;
  - retraits prévus par la conception : badge « Rangé », couverture d'un exemplaire personnel, catégorie « Ma collection » de la recherche (A7) ;
  - interrupteur « Personnaliser Explorer avec mes données » (effet immédiat) ; sans S1, guide éditorial complet et pages dérivées masquées ;
  - test 34 « Frontières » créé ; test 29 adapté pour A7, deux clics rejoués par CDP ; `check:boundaries` : 0 couplage.
  - Résultats : front **33/33**, base 82/82, secrets 0. Sauvegardes `*.backup.20261108-3.1b-3`.
- **3.1b-4 Collection découplée d'Explorer (D1 à D4)** ([plan](directeur/05-preparation-lot-3.1b.md), [sauvegardes](phase4/06-sauvegardes-par-domaine.md)) :
  - le routeur de Collection délègue la vue Explorer à un registre de vues hébergées ; Explorer se lance lui-même ; disposition inchangée ;
  - l'export JSON de Collection ne contient plus que Collection (`panel-bundle`, section `collection`) ;
  - l'ancien export `panel-singles` v2 reste proposé pendant deux versions (D-23), reconstruit par les fournisseurs ;
  - test 34 enrichi : Collection sans Explorer (navigation, export, restauration), bouton JSON, ancien export, anciens fichiers répartis par domaine.
  - Résultats : front **33/33**, base 82/82, secrets 0. Sauvegardes `*.backup.20261108-3.1b-4`.
- **3.1b-5 Calendrier (Explorer) séparé de la Pull List (Collection) (E1 à E5)** ([réalisation](phase4/05-contrats-s1-s6.md#consommation-par-le-calendrier-sous-lot-31b-5-8-novembre-2026)) :
  - boutons du calendrier et de la fiche publication via S2 (jeton de geste) ; Collection écrit ses fiches et sa Pull List ;
  - badges, « ✓ Pull », filtre « Ma pull list » et comptes de la fiche via S1 (ajouts compatibles `pullPending`, `seriesSubscribed`) ;
  - annulation d'import par la question agrégée `referencedPubs`, prudente sans fournisseur (E3) ;
  - rapprochement selon la règle de S1 : « POSSÉDÉ ? » pour une fiche sans année, plus de « POSSÉDÉ » pour un numéro d'une autre année ;
  - test 34 enrichi ; test 11 : clic « Acheté » rejoué par CDP ; `check:boundaries` étendu au calendrier (0 couplage) ; B-17 reporté au lot 4.6.
  - Résultats : front **33/33**, base 82/82, secrets 0. Sauvegardes `*.backup.20261108-3.1b-5`.
- **3.1b-6 Tests de frontières et de régression** ([plan](directeur/05-preparation-lot-3.1b.md)) :
  - `check:boundaries --strict` dans `npm run test:all` ; règles C, D et E, ponts admis nommés ; 0 couplage ; contrôle négatif à 5 couplages ;
  - routeur de Collection : ouverture et rendu du calendrier par des crochets de vue (D1) ;
  - test 34 clôturé : empreintes par domaine stables au redémarrage, après une restauration complète et après son annulation ;
  - export du fournisseur `explorer` trié par identifiant (empreinte indépendante de l'ordre de stockage) ;
  - 3.1b-7 (navigation) non engagé : N1 à N5 et une option mobile restent à valider.
  - Résultats : `npm run test:all` vert : front **33/33**, base 82/82, secrets 0, frontières 0. Sauvegardes `*.backup.20261108-3.1b-6`.

- **Clôture du lot 3.1b (D-26)** : vérification indépendante de `npm run test:all` : base 82/82, secrets 0, frontières en mode strict 0 couplage, front **33/33**. 3.1b-7 non engagé : navigation actuelle conservée.

## Phase 4 — Explorer 2.0
Cahier des charges fourni par l'utilisateur le 7 novembre 2026 et archivé dans [`phase4/`](phase4/). Révision 2 du 7 novembre 2026 : séparation stricte Collection / Explorer ([frontières et contrats](phase4/02-frontieres-collection-explorer.md)). Révision 3 du même jour : décisions A3, A5, A6 et A7, contrats S1 à S6 détaillés, domaine Community indépendant, [changement de navigation](phase4/03-changement-navigation.md) documenté sans être implémenté. Révision 4 : Sorties limitées aux comics, mangas japonais exclus ([périmètre](phase4/04-perimetre-sorties-comics.md)). Révision 5 (finalisation architecturale) : sauvegardes par domaine (B1, principe approuvé), contrats S1 à S6 de référence, architecture des images R2, propositions de navigation mobile, audit final des dépendances (E1 à E5 ajoutés), plan d'exécution et [journal des décisions](DECISIONS.md). Aucun code modifié. Non commencée ; prérequis : Phase 3.

- **F1 Finances (mission « Autonomous night shift », D-27 à D-29)** ([spécification et réalisation](directeur/06-specifications-F1-L1.md#a12-réalisation-de-f1-mission--autonomous-night-shift--8-novembre-2026)) :
  - F1-0 : plus de `USD` inventé ; F1-1 : devise d'achat explicite, préférence au premier choix, totaux par devise sans conversion ;
  - F1-2 : frais et coût d'acquisition ; F1-3 : achats groupés (4 méthodes, reste d'arrondi, annulation, sauvegarde) ;
  - F1-4 : sorties de collection (vente, don, perte, échange), filtre « Sorties », plus-value réalisée, S1 ;
  - F1-5 partiel : colonnes CSV ajoutées ; `Panel.finance` ; test 35 ; test 25 adapté à D-27.
  - Résultats : `npm run test:all` vert : front **34/34**, base 82/82, secrets 0, frontières 0. Sauvegardes `*.backup.20261108-f1`.

- **L1 Lecture (mission « Autonomous night shift », D-30)** ([réalisation](directeur/06-specifications-F1-L1.md#b8-réalisation-de-l1-mission--autonomous-night-shift--8-novembre-2026)) :
  - état par œuvre (`panel_reading_v1`), journal, compatibilité `isRead` sans écriture, lu sans possession, vente sans perte ;
  - S1 `read` et S2 `markRead` par Lecture ; un geste pour tous les exemplaires ; `isRead` conservé ;
  - migration conservatrice avec aperçu, conflits de notes, idempotence et annulation ; section `works` de la sauvegarde Lecture ;
  - test 36. Résultats : `npm run test:all` vert : front **35/35**, base 82/82, secrets 0, frontières 0. Sauvegardes `*.backup.20261108-l1`.

- **Backend 3.4 local (mission « Autonomous night shift », D-31)** ([réalisation](phase3/10-dossier-lots-3.2-3.7.md)) :
  - migration 8 : `api.sync_push` / `api.sync_pull`, `reading_states`, écritures directes retirées, pierres tombales, conflits par champ ;
  - moteur client `backend/sync-engine/engine.js` (outbox, reprise, quarantaine de compte), session locale sans secret ;
  - `sync.test.js` (16 tests, 3 appareils simulés). Résultats : `npm run test:all` vert : base **99/99**, secrets 0, frontières 0, front 35/35. Rien n'est connecté au réseau.

- **Fondations Explorer 2.0 et Communauté (mission « Autonomous night shift »)** ([réalisation](directeur/07-conception-explorer-2.0-community.md)) : modules autonomes `domains/explorer/catalog-core.js` et `domains/community/policy-core.js`, non branchés ; `npm run test:domains` : **16/16**, ajouté à `test:all`.

- **Mission « Autonomous full project execution » (8 novembre 2026)** :
  - vues **Lecture** et **Finances** dans la section Collection (D-32 : U-D1 = L-C, U-D2 = Fi-A), tests 37 ;
  - **Explorer 2.0 intégré** : modules `domains/` intégrés par `scripts/sync-domains.js`, recherche tolérante, « Guides proches » (D-33), test 38 ;
  - **Communauté** : « Partager… » depuis une fiche, copie en liste blanche, brouillons locaux, vue Communauté, aucune publication (D-34), test 39 ;
  - **backend** : adaptateurs Supabase, migration 9 (export, effacement, purge ; D-35), `adapters.test.js`, `privacy.test.js` ;
  - **test 26** : attente infinie possible corrigée (`snapshotSingles` sans `onabort`), durées par étape journalisées.
  - **corbeille** (D-36) : fiche copiée avant retrait, restauration, purge confirmée seulement, test 40 ;
  - **calendrier comics uniquement** (D-37) : manga masqué par défaut, réaffichable, test 41.
  - **lot 3.3 local** (D-38) : migration 10 (rôles sans accès aux données personnelles, profil, préférences HLC, appareils), `roles.test.js`, adaptateur de compte.
  - **sauvegardes** (D-39) : domaine Communauté et corbeille, test 42 ;
  - **visuels** (D-40) : module commun (provenance, remplacement typographique, cache des échecs, compléments manuels), recherche illustrée, pages d'entité, galeries, test 43 ;
  - **périmètre comics** (D-41) : cas limites M1 à M4 ; **navigation 4.9** (D-42) : section Explorer, Pull List, barre mobile à cinq boutons, test 44.
| Lot 3.5 local : conflits | Terminé localement (non validé sur Supabase) | migration 11, `backend/tests/conflicts.test.js`, `adapters.js`, `index.html` (centre des conflits), `run-all-tests.js` (test 45) | base 115/115, front 44/44 | D-43 | Projet Supabase (3.2) | Lot 3.6 local |
