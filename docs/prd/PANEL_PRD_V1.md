# PANEL — PRD V1 (Product Requirements Document)

Date : 13 novembre 2026. Statut : **proposé (D-58)**, à valider par le porteur du projet.
Ce dossier `docs/prd/` contient neuf documents de référence. Celui-ci est le document chapeau : vision, audit de l'existant, écarts, glossaire, hypothèses, décisions à confirmer et risques.

Ce PRD **ne remplace pas** les documents existants. Il les consolide et les ordonne vers la vision « plateforme sociale comics » :
- [`directeur/08-rebaseline-produit.md`](../directeur/08-rebaseline-produit.md) (D-54) reste la référence du périmètre comics, de la stratégie de sources et du modèle catalogue cible ;
- [`DECISIONS.md`](../DECISIONS.md) reste le journal des décisions ; en cas de contradiction, une décision D-xx prime sur ce PRD tant qu'elle n'est pas explicitement remplacée.

| N° | Document | Contenu |
|---|---|---|
| 1 | `PANEL_PRD_V1.md` (ce document) | Vision, audit, écarts, glossaire, hypothèses, décisions, risques |
| 2 | [`PANEL_FUNCTIONAL_SPECIFICATIONS.md`](PANEL_FUNCTIONAL_SPECIFICATIONS.md) | 12 modules : exigences identifiées, priorités, règles, états, cas limites |
| 3 | [`PANEL_TECHNICAL_ARCHITECTURE.md`](PANEL_TECHNICAL_ARCHITECTURE.md) | Architecture réelle, architecture cible, choix technologiques argumentés |
| 4 | [`PANEL_DATA_MODEL.md`](PANEL_DATA_MODEL.md) | Schéma existant (12 migrations) et extensions nécessaires |
| 5 | [`PANEL_API_SPECIFICATION.md`](PANEL_API_SPECIFICATION.md) | API existante (`window.Panel`, RPC) et contrats cibles |
| 6 | [`PANEL_UX_UI_SPECIFICATION.md`](PANEL_UX_UI_SPECIFICATION.md) | Navigation, écrans, états, design system, accessibilité |
| 7 | [`PANEL_SECURITY_AND_COMPLIANCE.md`](PANEL_SECURITY_AND_COMPLIANCE.md) | RGPD, DSA, modération, droits des images, sécurité |
| 8 | [`PANEL_ROADMAP.md`](PANEL_ROADMAP.md) | Phases 0 à 6, dépendances, risques, critères, KPI et analytics |
| 9 | [`PANEL_ACCEPTANCE_TESTS.md`](PANEL_ACCEPTANCE_TESTS.md) | Critères d'acceptation vérifiables, reliés aux exigences |

Légende d'état utilisée dans tous les documents (reprise de D-54) :

| Marque | Sens |
|---|---|
| **[Existant]** | Fonctionne aujourd'hui dans l'application, couvert par des tests |
| **[Partiel]** | Existe mais incomplet, seulement local, ou non branché à l'interface |
| **[Implémenté localement]** | Code et tests présents, jamais exécuté sur un service réel |
| **[Proposé]** | Décrit seulement : aucun code |
| **[Bloqué]** | Dépend d'un élément externe (compte, licence, décision, service) |

---

## 1. Vision produit

**Vision.** PANEL est la plateforme sociale et culturelle européenne des lecteurs de comics, lancée d'abord en francophonie. On y gère sa collection, on y suit ses lectures et ses sorties, et on y rencontre d'autres lecteurs.

**Mission.** Donner à chaque lecteur de comics un lieu unique, fiable et respectueux de ses données pour savoir quoi lire, ne rater aucune sortie utile, valoriser sa collection et en parler avec une communauté spécialisée.

**Trois piliers équilibrés** :

| Pilier | Promesse | Point d'appui existant |
|---|---|---|
| Collection | Cataloguer, organiser, valoriser sa collection physique, sans erreur silencieuse | Le plus abouti : scan, emplacements, finances, import LoCG/CLZ [Existant] |
| Reading | Suivre ses lectures, sa progression dans les événements, découvrir quoi lire ensuite | Lecture par œuvre, Event Center v2 (niveaux de lecture) [Existant] |
| Community | Partager, discuter, se retrouver entre lecteurs, sans spéculation ni exposition des données privées | Règles et contrats codés, aucun service actif [Partiel] |

**Proposition de valeur.**
- Pour le collectionneur : un inventaire exact et privé (finances jamais publiées), gratuit là où les concurrents font payer (emplacements, finances, statistiques).
- Pour le lecteur : des ordres de lecture **justifiés par niveau** (essentiel, recommandé, complet) avec leur provenance.
- Pour le passionné : une communauté francophone centrée sur la lecture, avec spoilers masqués et collection partagée seulement par copie filtrée consentie.

**Positionnement concurrentiel.**

| Acteur | Force | Faiblesse exploitée par PANEL |
|---|---|---|
| League of Comic Geeks | Catalogue US, pull list, communauté | Anglophone ; fonctions de collection avancées payantes ; ordres de lecture sans niveaux ni provenance |
| CLZ Comics | Scan, catalogue | Payant, peu social, anglophone |
| Goodreads / Babelio / SensCritique | Social, critiques | Pas de logique de numéros, variantes, pull list ni collection physique |
| Instagram, Discord, forums | Volume, spontanéité | Aucune structure catalogue ; spoilers ; information dispersée |

PANEL n'est **pas** un clone d'Instagram (pas de fil photo infini comme cœur du produit), ni une encyclopédie (chaque donnée sert un usage), ni une place de marché.

**Périmètre éditorial (rappel D-37, D-41, D-54, confirmé le 13 novembre 2026).** Comics uniquement : éditeurs américains (Marvel, DC, Image, Dark Horse, IDW, BOOM!, Dynamite, Oni, Titan, Mad Cave, Vault…) et éditeurs français de comics (Urban Comics, Panini Comics, Delcourt Comics, Bliss, HiComics, Komics Initiative, Vestron, Les Humanoïdes Associés…). **Exclus** : manga, manhwa, manhua, webtoon, bande dessinée franco-belge, lecture numérique de pages. Les données hors périmètre déjà présentes sont conservées et masquées, jamais supprimées.

## 2. Publics cibles et personas

| Persona | Profil | Besoins | Frustrations actuelles |
|---|---|---|---|
| **Karim, collectionneur exigeant** (persona réel de référence, PRODUCT.md) | 30-45 ans, ~1 200 singles US, variantes DC Absolute, achète chaque mercredi | Ajout rapide et exact, emplacements, valeur, numéros manquants | Saisie manuelle, outils anglophones, fonctions payantes |
| **Léa, lectrice VF** | 20-35 ans, achète des recueils Urban et Panini | Savoir dans quel ordre lire un événement, ce qui sort en VF | Ordres de lecture contradictoires, correspondance VO/VF floue |
| **Tom, nouveau venu** | 15-25 ans, arrive par le cinéma ou le jeu vidéo | Par où commencer, quoi lire sur un personnage | Catalogue intimidant, jargon |
| **Sophie, animatrice de club** | Libraire ou responsable d'association | Réunir un groupe, proposer une lecture commune | Outils génériques (Discord, WhatsApp) sans catalogue |
| **Modérateur PANEL** | Bénévole ou salarié | Traiter les signalements vite et de façon traçable | — (n'existe pas encore) |

## 3. Problèmes utilisateurs

1. « Je ne sais pas dans quel ordre lire » (événements, crossovers, VO/VF).
2. « Je rate des sorties ou j'achète deux fois le même numéro. »
3. « Ma collection est éparpillée entre un tableur, LoCG et ma mémoire. »
4. « Je n'ai personne avec qui parler de comics en français, sans spoilers. »
5. « Je ne veux pas exposer la valeur de ma collection ni mon adresse. »

## 4. Parcours utilisateurs principaux

| Parcours | Étapes clés | État actuel |
|---|---|---|
| P1 Ajouter un comic | Scan code-barres ou couverture → candidat → confirmation → emplacement | [Existant] |
| P2 Importer sa collection | Fichier LoCG/CLZ/CSV → aperçu → rapport ajoutés/fusionnés/ignorés | [Existant] (déduplication par identifiants : [Partiel]) |
| P3 Lire un événement | Explorer → fiche événement → niveau Essentiel → marquer lus → progression | [Existant] (D-57) |
| P4 Ma semaine de sorties | Calendrier → semaine → pull list → acheté → exemplaire créé | [Partiel] (automatisation pull → collection : [Proposé]) |
| P5 Compléter une série | Collection → Séries → numéros manquants → wishlist | [Existant] |
| P6 Créer un compte et synchroniser | Inscription → consentement → migration de la collection locale | [Implémenté localement] / [Bloqué] (projet cloud) |
| P7 Publier et discuter | Fiche numéro → critique avec spoiler → commentaires | [Proposé] |
| P8 Rejoindre un club | Découvrir un groupe → rejoindre → lecture commune → challenge | [Proposé] |
| P9 Passer à PANEL Plus | Paramètres → offre → paiement → confirmation | [Proposé] |

## 5. Principes fondamentaux du produit

1. **Jamais faux en silence** : l'incertitude est montrée, l'utilisateur décide (PRODUCT.md).
2. **Les données de l'utilisateur sont sacrées** : sauvegarde avant changement, annulation possible, aucune suppression destructive (règle constante depuis la phase 1).
3. **Local d'abord, compte facultatif** : toutes les fonctions personnelles marchent sans compte ; la communauté exige un compte.
4. **Privé par défaut** : finances, valeurs, emplacements et notes ne sont jamais publiés ; partager = copie filtrée consentie (contrat Publish, D-46).
5. **Comics uniquement**, filtré à l'entrée (D-54).
6. **Une seule identité par publication** : collection, sorties, événements et discussions référencent le même identifiant (catalogue commun, D-55).
7. **Sélection éditoriale ≠ fait bibliographique** : chaque niveau, ordre ou recommandation affiche sa justification et sa provenance (D-52, D-57).
8. **Le social essentiel est gratuit** : publier, commenter, suivre, rejoindre un club, signaler ne sont jamais payants.
9. **Mobile d'abord**, à parité avec le poste de travail.
10. **Évolution, pas réécriture** : on étend l'existant testé.

---

## 6. Audit de l'existant (vérifié dans le code le 13 novembre 2026)

### 6.1 Architecture réelle

| Couche | Réalité vérifiée | Source |
|---|---|---|
| Client web | **Un seul fichier `index.html`** de 17 384 lignes : HTML, CSS et JavaScript vanilla dans une IIFE ; aucune étape de build, aucune dépendance npm d'exécution | `index.html`, `package.json` |
| Bibliothèques embarquées | zxing-wasm (codes-barres), JSZip (export d'archive), pdf.js (héritage) | `android-app/vendor.lock.json` |
| Modules métier purs | `domains/catalog/publication-core.js`, `domains/explorer/{catalog-core,media-core,event-levels,events-seed,events-crossref}.js`, `domains/community/policy-core.js` ; **intégrés dans `index.html`** par `scripts/sync-domains.js` (7 modules, contrôle `--check`) | `domains/`, `scripts/` |
| Stockage local | localStorage (59 clés `panel_*`) + IndexedDB `panel-catalog` et `panel-library` ; instantanés et sauvegardes par domaine | `index.html` |
| PWA | `sw.js` (cache versionné), `manifest.webmanifest` | racine |
| Android | Capacitor, APK 1.0 à 1.2, relais intégré pour les sources | `android-app/` |
| Relais local | `serve.js` (Node) : sert l'application et relaie Comic Vine / Metron sur PC | `serve.js` |
| Backend | Supabase/Postgres **préparé, jamais déployé** : 12 migrations (schéma `app`), RLS, déclencheurs de révision, RPC de synchronisation, purge RGPD, rôles, limites de débit, Edge Function `delete-account` | `backend/supabase/` |
| Moteur de synchronisation | `backend/sync-engine/{engine,adapters}.js`, local-first, conflits par champ | `backend/sync-engine/` |
| Tests | 52 tests d'interface Edge/CDP (`run-all-tests.js`), 55 tests de domaine, 124 tests base sur PGlite, contrôle des secrets, contrôle des frontières entre domaines | scripts npm |
| Documentation | ~60 documents (plan directeur, phases 3 et 4, 57 décisions D-01 à D-57, runbooks) | `docs/` |

### 6.2 État de santé technique

| Indicateur | Constat | Évaluation |
|---|---|---|
| Couverture de tests | Large et réelle (231 tests automatisés, tous verts au 13 novembre 2026) | Bon |
| Discipline de données | Sauvegardes, instantanés, corbeille, retour arrière, migrations réversibles testées | Très bon |
| Frontières de domaines | Contrôlées automatiquement (`check-boundaries --strict`), contrats S1 à S6 | Bon |
| Monofichier | 17 384 lignes, croissance continue ; temps de chargement et de revue en hausse | **Dette principale** |
| Backend | Complet sur le papier, jamais exécuté sur un vrai projet | Risque d'écart à l'intégration |
| Hébergement | Aucun hébergement public ; usage local ou APK | Bloquant pour toute fonction sociale |
| Sources de données | Comic Vine (clé personnelle, non commercial), Metron (compte personnel) ; aucune source sous licence pour un service partagé | **Bloquant** pour un catalogue public |
| Couvertures | Aucune licence ; images de l'utilisateur seulement en privé | Bloquant juridique pour l'affichage public |
| Documentation produit | `PRODUCT.md` décrit encore un lecteur numérique retiré en phase 1 | À mettre à jour (incohérence) |
| Fichiers de sauvegarde | ~60 copies `*.backup.*` à la racine | Encombrement ; à archiver hors de la racine (sur accord) |

### 6.3 Inventaire fonctionnel (matrice demandée)

| Module | État actuel vérifié | Qualité | Évolution nécessaire |
|---|---|---|---|
| **Explorer** | [Existant] Recherche tolérante (D-33), guides, univers, personnages et créateurs dérivés de la collection, 9 événements avec niveaux justifiés, ordre recommandé versionné et progression (D-57), fiches numéro et galerie, catalogue commun (D-55, D-56) | Bonne, données limitées (pas de source partagée) | Catalogue partagé côté serveur (sources sous licence), pages créateur, recommandations |
| **Collection** | [Existant] Exemplaires, variantes, grading, emplacements hiérarchiques, scan code-barres et couverture (dHash), import CSV/CLZ/LoCG xlsx, wishlist, séries et numéros manquants, statistiques, finances par devise (F0, F1), corbeille, sauvegardes par domaine | Très bonne, la plus mature | Déduplication par identifiants à l'import, variantes au niveau exemplaire, synchronisation multi-appareils |
| **Reading** | [Existant] État de lecture par œuvre (lu, en cours, à lire), journal, prochain numéro (L1, D-30), progression d'événement par niveau (D-57) | Bonne | Statistiques de lecture, objectifs, partage d'activité |
| **Releases** | [Existant] Calendrier semaine / mois / 3 mois, vues cartes / mensuelle / liste / éditeur / série / marché, reports et annulations, conflits de sources (D-43), pull list (D-42), import et export CSV, comics US et FR uniquement | Bonne en local ; dépend des sources personnelles | Source partagée sous licence, FOC, Upcoming #1, variantes repliées, notifications |
| **Community** | [Partiel] Brouillons de partage locaux ; contrats Publish / Revoke / Feed, graphe, limiteur de débit, validation, modération codés et testés dans `policy-core` (D-46) ; **rien n'est publié** | Règles solides, aucun service | Backend actif, profils, fil, commentaires, groupes |
| **Profiles** | [Implémenté localement] Table `app.profiles`, préférences, appareils, rôles (migrations 2 et 10) ; **aucun écran Compte** | Schéma prêt | Écran Compte, profil public, Comic DNA |
| **Notifications** | **Absent** : seulement des messages éphémères (toasts) | — | Notifications locales puis push, préférences |
| **Premium** | **Absent** : aucun code de paiement ni de limite d'offre | — | PANEL Plus via Stripe, droits par offre |
| **Admin** | [Partiel] Administration des **sources de données** locale (« Sources & données »), catalogue commun (rattachements), rôles `member / moderator / admin` (migration 10), modération codée dans `policy-core` ; aucune console d'administration | Fondations | Console de modération, gestion du catalogue, journal d'audit |

### 6.4 Problèmes prioritaires

| # | Problème | Impact | Traitement proposé |
|---|---|---|---|
| PB-1 | Aucun backend déployé ni hébergement public | Bloque Community, Profiles, Notifications push, Premium | Phase 1 : créer le projet Supabase (UE) et l'hébergement — **décision et compte de l'utilisateur** |
| PB-2 | Aucune source de catalogue sous licence pour un service partagé | Bloque un catalogue public et les sorties partagées | Démarche Metron / GCD + saisie éditoriale ; avis juridique |
| PB-3 | Monofichier de 17 384 lignes | Ralentit chaque évolution, risque de régression | Poursuivre l'extraction vers `domains/**` ; pas de réécriture (voir architecture § 4) |
| PB-4 | Couvertures sans licence | Image de marque en public | Images de l'utilisateur en privé ; remplacements typographiques en public ; démarches de licence |
| PB-5 | `PRODUCT.md` et `README.md` partiellement obsolètes | Mauvaise compréhension par une nouvelle équipe | Mise à jour documentaire (Phase 0) |
| PB-6 | Pas d'identité de compte ni de consentement en interface | Bloque la conformité RGPD des fonctions sociales | Écran Compte et consentements (Phase 1) |

### 6.5 Écart entre l'existant et la vision cible

| Pilier | Couverture estimée de la cible V1 | Commentaire |
|---|---|---|
| Collection | ~80 % | Manque surtout la synchronisation et la déduplication par identifiants |
| Reading | ~60 % | Manque statistiques, objectifs, clubs de lecture |
| Releases / Pull List | ~55 % | Manque source partagée, FOC, notifications |
| Community | ~10 % | Seulement des règles ; tout le service est à construire |
| Profils, notifications, premium, administration | ~5 à 15 % | Schéma et règles seulement |

Ces pourcentages sont des **estimations qualitatives** fondées sur le nombre d'exigences Must de [`PANEL_FUNCTIONAL_SPECIFICATIONS.md`](PANEL_FUNCTIONAL_SPECIFICATIONS.md) déjà satisfaites ; ils ne mesurent pas l'effort restant.

---

## 7. Périmètres MVP, V1 et futur

| Niveau | Contenu |
|---|---|
| **MVP (bêta fermée)** | Comptes et synchronisation ; Collection, Reading, Releases et Pull List existants, branchés au compte ; profils (privé/public) ; publications et commentaires sur une fiche (numéro, série, événement) avec spoilers ; suivre un lecteur ; fil chronologique ; signalement, blocage, modération ; notifications in-app ; administration minimale |
| **V1 publique** | Groupes et clubs de lecture, challenges, notifications push, Comic DNA, Collection Match, recommandations, PANEL Plus (Stripe), catalogue partagé alimenté par une source sous licence, console de modération complète, conformité DSA |
| **Futur (V2+)** | Expansion européenne (langues, marchés), contributions communautaires au catalogue, messages privés, événements en direct, partenaires libraires, API publique |

Détail par exigence : [`PANEL_FUNCTIONAL_SPECIFICATIONS.md`](PANEL_FUNCTIONAL_SPECIFICATIONS.md) ; phasage : [`PANEL_ROADMAP.md`](PANEL_ROADMAP.md).

## 8. Décisions structurantes proposées

| ID | Décision proposée | Justification | Statut |
|---|---|---|---|
| PRD-D1 | **Garder le client actuel** (`index.html` + `domains/**`, PWA, Android) ; **ne pas migrer vers Next.js** à ce stade | Fonctionnel, testé (231 tests) ; une réécriture coûterait des mois sans valeur utilisateur et mettrait en risque les données locales | À confirmer |
| PRD-D2 | **Supabase (Postgres, Auth, RLS, Edge Functions), région UE** comme backend unique | Déjà choisi (D-03) et préparé (12 migrations, 124 tests) | Confirmé (D-03) ; projet à créer |
| PRD-D3 | Pages **publiques indexables** (profils publics, fiches catalogue) servies plus tard par une petite application Next.js séparée, **seulement si le référencement devient un objectif mesuré** | Évite une réécriture ; le SEO est le seul vrai argument pour du rendu serveur | À confirmer (Phase 5) |
| PRD-D4 | Hébergement statique du client : **Cloudflare Pages ou Vercel** (statique), au choix | Les deux conviennent à un fichier statique ; Cloudflare simplifie R2 (D-04), Vercel simplifie un futur Next.js | Décision utilisateur |
| PRD-D5 | Recherche : **Postgres plein texte + `pg_trgm` + `unaccent`** côté serveur ; moteur dédié (Meilisearch ou Typesense) seulement au-delà de ~1 million de fiches ou si la latence p95 dépasse 300 ms | Pas d'infrastructure de plus au départ ; recherche locale tolérante déjà en place (D-33) | Proposé |
| PRD-D6 | Médias : **Cloudflare R2** pour les images autorisées et les images téléversées par les utilisateurs (D-04, `phase4/07`) | Pas de frais de sortie ; déjà spécifié | Confirmé (D-04) ; compte à créer |
| PRD-D7 | Paiement : **Stripe Billing + Checkout + portail client**, webhooks traités par une Edge Function | Standard, conforme SCA/PSD2, évite de manipuler des données de carte | Proposé |
| PRD-D8 | **Monolithe modulaire**, pas de microservices | Taille d'équipe, simplicité ; frontières déjà contrôlées par domaine | Proposé |
| PRD-D9 | Le social essentiel reste gratuit ; Plus = confort, statistiques avancées, personnalisation, quotas élevés | Règle de la mission ; protège la croissance communautaire | Proposé |
| PRD-D10 | Comics US et FR uniquement, filtrés à l'entrée ; données hors périmètre conservées et masquées | D-37, D-41, D-54, demande du 13 novembre 2026 | Confirmé |

## 9. Glossaire

| Terme | Définition dans PANEL |
|---|---|
| Univers | Monde narratif partagé (Marvel 616, DC Absolute…) ; regroupe personnages et événements |
| Éditeur | Entreprise qui publie (Marvel, Urban Comics) ; une **marque** (imprint) est rattachée à un éditeur |
| Série | Suite de numéros publiée par un éditeur sous un titre et un volume (ex. *Absolute Batman* (2024)) |
| Numéro (issue) | Une parution d'une série, identifiée par (série, numéro) |
| Édition | Publication physique concrète : single, recueil (TPB, HC, omnibus, intégrale) ; une édition VF est une édition liée à l'œuvre originale |
| Variante | Version d'un numéro avec une couverture ou un traitement différent (ratio, virgin, foil, exclusivité) |
| Couverture | Image d'une variante ; soumise à droits |
| Exemplaire personnel | Objet physique possédé par un utilisateur (état, grade, prix, emplacement) ; **privé** |
| Lecture | Fait qu'un utilisateur a lu une œuvre ; appartient à l'œuvre, pas à l'exemplaire (L1, D-30) |
| Publication communautaire | Contenu créé par un utilisateur (post, critique, liste, commentaire), attaché éventuellement à une entité du catalogue |
| Pull List | Séries (plus tard créateurs, événements) suivies pour leurs prochaines sorties |
| FOC | *Final Order Cutoff* : date limite de commande en librairie avant une sortie US |
| NCBD | *New Comic Book Day* : jour de sortie hebdomadaire US (mercredi) |
| Événement | Crossover ou arc majeur, avec liens par rôle et niveaux de lecture |
| Niveau de lecture | Essentiel, recommandé, complet : sélection éditoriale justifiée (D-57) |
| Catalogue commun | Identité partagée d'une publication entre Collection, Sorties et Explorer (D-55) |
| Comic DNA | Profil de goûts calculé à partir des lectures et de la collection (proposé) |
| Collection Match | Compatibilité de goûts entre deux lecteurs (proposé) |
| Local-first | Les données vivent d'abord sur l'appareil ; le serveur synchronise |

## 10. Hypothèses

| ID | Hypothèse | Conséquence si fausse |
|---|---|---|
| H1 | Le porteur créera un projet Supabase en région UE et un hébergement statique | Toute la partie sociale reste bloquée |
| H2 | Une source de métadonnées compatible avec un usage partagé (Metron ou équivalent) sera obtenue | Catalogue partagé limité à la saisie éditoriale et aux données des utilisateurs |
| H3 | La bêta fermée compte 50 à 300 lecteurs francophones | Dimensionnement, modération et coûts à revoir |
| H4 | L'équipe reste petite (1 à 3 développeurs, assistés par Claude Code) | Justifie le monolithe modulaire et l'absence de réécriture |
| H5 | Les utilisateurs acceptent un compte pour la communauté mais pas pour la collection | Justifie le local-first et le compte facultatif |
| H6 | Le prix de PANEL Plus se situe entre 3 et 5 € par mois | Hypothèse de travail ; à tester en bêta |

## 11. Décisions à confirmer par le porteur du projet

| ID | Question | Options | Recommandation |
|---|---|---|---|
| Q1 | Valider le PRD (D-58) comme référence | Oui / avec réserves | Oui, avec revue des priorités Must |
| Q2 | Rester sur le client actuel (PRD-D1) | Garder / migrer vers Next.js | Garder |
| Q3 | Hébergement du client (PRD-D4) | Cloudflare Pages / Vercel | Cloudflare Pages (cohérence avec R2) |
| Q4 | Région Supabase | Paris `eu-west-3` / Francfort `eu-central-1` | Paris |
| Q5 | Prix de PANEL Plus et période d'essai | 3,99 €/mois et 39,99 €/an, essai 14 jours / autre | Tester en bêta |
| Q6 | Source de catalogue partagé | Metron (à confirmer) / GCD (CC BY-SA) / saisie éditoriale | Metron + saisie éditoriale ; avis juridique |
| Q7 | Âge minimum | 13 ans / 15 ans (majorité numérique en France) / 16 ans | 15 ans, consentement parental en dessous non géré au lancement |
| Q8 | Messages privés en V1 | Oui / non | Non (risques de modération) ; V2 |
| Q9 | Archivage des ~60 fichiers `*.backup.*` hors de la racine | Oui / non | Oui, après vérification ; aucune suppression |
| Q10 | Entité juridique éditrice de PANEL (mentions légales, DSA, Stripe) | — | Requise avant la bêta publique |

## 12. Risques identifiés

| ID | Risque | Probabilité / impact | Atténuation |
|---|---|---|---|
| R-1 | Pas de source de données sous licence | Élevée / bloquant pour le public | Saisie éditoriale, contributions modérées, sources personnelles en local |
| R-2 | Droits des couvertures | Élevée / image | Images privées seulement, remplacements soignés, licences |
| R-3 | Communauté vide au lancement | Moyenne / critique | Bêta par invitation, clubs animés, contenus éditoriaux, import LoCG pour amorcer les profils |
| R-4 | Modération insuffisante | Moyenne / réputation et légal | Limites de débit (D-45), file de signalements, bêta fermée, règles DSA |
| R-5 | Régression dans le monofichier | Moyenne / élevée | Tests (231), extraction progressive, une suite à la fois |
| R-6 | Migration local → serveur qui perd des données | Faible / critique | Migration additive, instantané préalable, restauration testée (V1 à V14) |
| R-7 | Coûts serveur et paiement | Faible au début | Offres gratuites Supabase/Cloudflare ; budget à suivre (`directeur/02`) |
| R-8 | Dérive vers la spéculation (cotes) | Moyenne / identité | Pas de classement par valeur, finances jamais publiques |
| R-9 | Dépendance à un seul développeur | Élevée | Documentation (ce PRD), tests, conventions |
