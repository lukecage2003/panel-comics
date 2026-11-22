# État des lieux — 22 novembre 2026 (D-111)

Ce document met à jour l'[audit du 14/11](../panel-2/PANEL_2_REPOSITORY_AUDIT.md) (commit `cf43513`) avec l'état réel du dépôt après les décisions D-91 à D-111. Il ne refait pas l'audit historique de [directeur/01](../directeur/01-etat-des-lieux-et-audit.md).

## Statuts utilisés

| Statut | Sens |
|---|---|
| OPERATIONAL | Codé, branché dans l'application, couvert par des tests |
| PARTIALLY_IMPLEMENTED | Codé en partie, ou seulement en local alors que la cible est en ligne |
| INCOMPLETE | Commencé, non utilisable tel quel |
| PLANNED | Décidé et documenté, pas codé |
| MISSING | Exigé par le méga-prompt ou la loi, absent |
| DEPRECATED | Retiré de l'interface ; données conservées |
| NEEDS_AUDIT | Existe ; à revoir avant le lancement |

## Pile technique (conservée)

### Client
- Un seul `index.html` d'environ 28 700 lignes, en JavaScript sans framework.
  - Décision : garder ce client. Pas de migration vers React ou Next.js (Q2, 13/11).
- Modules purs dans `domains/**` (contexte : account, catalog, collection, community, explorer, i18n, reading, releases, source).
  - Ils sont intégrés par `scripts/sync-domains.js`, qui met aussi à jour les empreintes CSP.

### Stockage et application installable
- Stockage sur l'appareil : IndexedDB et `localStorage`.
- Application installable :
  - manifeste avec 8 raccourcis ;
  - service worker `sw.js` ;
  - fonctionne hors ligne.

### Serveur préparé
- Supabase (Postgres) avec 18 migrations dans `backend/supabase/migrations`.
- Elles sont testées en local avec PGlite.
- Le projet de préproduction existe, mais **l'ouverture des comptes (S8) reste fermée**.
- Les migrations 13 à 18 ne sont pas branchées sur l'application.

### Tests
| Suite | Nombre de tests | Outil |
|---|---|---|
| Domaines | 219 | Node |
| Base | 172 | PGlite |
| Parcours | 84 | Edge, sans interface |

Scripts de contrôle : `check:motion`, `check:secrets`, `check-dead-code`, `check-boundaries --strict`.

## Statut par module

| Module | Statut | Preuve | Écart principal |
|---|---|---|---|
| Collection (exemplaires, séries, boîtes, statistiques) | OPERATIONAL | `domains/collection/*`, tests Edge (test 30) | Finances : F-01 à F-05, F-10 et F-11 corrigés par le lot F0 (D-19), F-06 à F-09 par le lot F1 (D-27 à D-29) ; vérifié le 22/11 dans [HISTORIQUE-LOTS](../HISTORIQUE-LOTS.md). Reste F-12 (Wishlist, P2) |
| Wishlist, Pull list, Key Issues | OPERATIONAL | `release-views`, `scope-core` | — |
| Cote suivie (Atelier, D-110) | OPERATIONAL | `wsValueHtml` | Aucune cote de marché externe (voulu) |
| Imports (fichier LoCG en lecture seule, CSV) | OPERATIONAL | — | Provenance par champ : `source/claims-core` |
| Scan de code-barres, scan en rafale | OPERATIONAL | D-109 | — |
| Sorties du mercredi | OPERATIONAL | `domains/releases` | Données externes : licences à vérifier (voir [DATA_GOVERNANCE](DATA_GOVERNANCE.md)) |
| Lecture (statut, statistiques, progression) | OPERATIONAL | `domains/reading` | — |
| Lecteur numérique PDF/CBZ | DEPRECATED | Archive ZIP de sortie conservée (`exportDigitalArchiveBtn`) | Fichiers, marque-pages et notes jamais supprimés |
| Découvrir : encyclopédie, univers, événements, guides | OPERATIONAL | `domains/explorer/*` | Sources externes : NEEDS_AUDIT de licence au lancement |
| Cartes des univers (atlas, Mes cartes) | OPERATIONAL | `maps-core`, `cartes/` | Mention « plan de fan », © Marvel / © DC ; les cartes viennent du dépôt de l'utilisateur |
| Quiz, défis, club de lecture, personnage du jour | OPERATIONAL | D-109, D-110 | Locaux |
| Fil classé, pensées, J'aime dessinés | PARTIALLY_IMPLEMENTED | `feed-core`, `ranking-core`, `notes-core`, `likes-core` | Local seulement ; le contenu des autres membres arrive avec S8 |
| Profil social, étagère 3D, carte de collectionneur | PARTIALLY_IMPLEMENTED | `profile-public` | Pas encore publié en ligne |
| Directs (studio vertical, chat, duel, co-animation) | PARTIALLY_IMPLEMENTED | `live-core`, migrations 14 et 15 | Pas de diffusion audio ou vidéo réelle (DEFERRED) |
| Débats (« Debate Hub ») | PARTIALLY_IMPLEMENTED | Duel, `exMpDebate`, verdicts des théories, [LIVE-DEBATS](../LIVE-DEBATS.md) | Pas d'espace de débat en ligne distinct ; s'appuie sur les directs et les pensées existants (pas de doublon) |
| Rencontres et boutiques | PARTIALLY_IMPLEMENTED | `meetups-core` | Aucune boutique partenaire |
| Modération (signalements, masquage, appels, journal) | PARTIALLY_IMPLEMENTED | Migrations 13, 16 et 17, `moderation-core` | Équipe humaine à constituer |
| Rôles d'équipe et double authentification | PARTIALLY_IMPLEMENTED | Migration 17 | Non appliquée en ligne |
| Âge et mineurs | PARTIALLY_IMPLEMENTED | Migration 13 (tranches, refus sous 13 ans, profils mineurs privés) + **migration 18 Guardian** | Non appliquée ; preuve d'âge externe : RESEARCH |
| Espace parental | PARTIALLY_IMPLEMENTED | Migration 18 (lien par code, réglages, révocation) ; module client `domains/community/guardian-core.js` (D-112) ; encadré dans Compte & profil (code contrôlé sur l'appareil, rien n'est envoyé) | Écrans branchés sur le serveur au moment de S8 |
| Synchronisation, export, effacement de compte | PARTIALLY_IMPLEMENTED | Migrations 8, 9 et 12 | Non branché |
| Langues (fr, en, es…) | OPERATIONAL | `domains/i18n` | Le français reste la langue source |
| Monétisation (écran Offres) | PARTIALLY_IMPLEMENTED | `plans-core`, migration 19 (`billing.*`), D-113 | Aucun prix, aucun paiement branché (voulu) |
| Pros, sceau Encré, L'Atelier | PARTIALLY_IMPLEMENTED | `pro-core`, migration 19 (`pro.*`), D-113 | Local ; aucune demande examinée ; aucun pro inscrit |
| Le Comptoir (forum) | PARTIALLY_IMPLEMENTED | `forum-core`, migration 19 (`forum.*`), D-113 | Local seulement |
| Le Marché | PARTIALLY_IMPLEMENTED | `market-core`, migration 19 (`market.*`), D-113 | Brouillons locaux ; marché fermé ; prestataire de paiement à choisir |
| Messages privés chiffrés | PARTIALLY_IMPLEMENTED | `dm-core`, migration 19 (`messaging.*`), D-113 | Clé de l'appareil et vérification locale ; pas encore de double cliquet |
| Identité légale de l'éditeur | MISSING | — | `[À COMPLÉTER]` avant toute ouverture |
| CGU, confidentialité, règles validées | MISSING (squelettes prêts) | [SECURITY_AND_COMPLIANCE](SECURITY_AND_COMPLIANCE.md) | Avocat belge |
| AIPD sur les mineurs | MISSING | — | Avant l'ouverture aux mineurs |

## Constats

1. **Rien n'est à reconstruire.**
   - Le méga-prompt demande Guardian, un Debate Hub, la modération et un écosystème pro.
   - Les trois premiers existent déjà en grande partie : ils ont été étendus, pas dupliqués.
2. **Le principal écart est juridique et humain**, pas technique :
   - l'identité de l'éditeur ;
   - les textes juridiques ;
   - l'équipe de modération ;
   - l'AIPD.
3. **Ce qui reste local par choix** : tout le social, jusqu'à l'accord de l'utilisateur pour S8.
4. **Ancien nom** : il est retiré de l'interface depuis D-108 et des documents depuis D-111. Il ne subsiste que dans les règles de `scripts/import-atlas.js`, qui servent justement à le retirer à chaque import, et dans leur test.
