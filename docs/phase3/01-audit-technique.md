# Phase 3 · 01 — Audit technique avant le passage au cloud

Relevé du 7 novembre 2026 sur `main` au commit `fe19e3c`, working tree propre.

Conventions de lecture :
- **[Fait]** : vérifié dans le dépôt, avec le fichier et la ligne au moment du relevé.
- **[Doc]** : tiré d'une documentation officielle (voir les sources en fin de document).
- **[Hypothèse]** : non vérifié.
- **[Reco]** : recommandation.

Cet audit ne refait pas celui de la Phase 0. Il ne retient que ce qui pèse sur les comptes, les profils et la synchronisation.

---

## 1. Architecture générale

### 1.1 Composants
| Composant | Fichier | Rôle | Constat |
|---|---|---|---|
| Application | `index.html` (12 852 lignes) | HTML, CSS et un seul `<script>` en IIFE, sans framework ni bundler | [Fait] Tous les modules partagent la portée de l'IIFE : collection, catalogue, emplacements, calendrier, sources, Explorer. |
| Service worker | `sw.js` (88 lignes) | Coquille hors ligne, cache des bibliothèques CDN | [Fait] Les pages passent par le réseau d'abord (3 s), puis le cache. Les API et les couvertures passent par le réseau seul. Seules les requêtes `GET` sont traitées. |
| Relais local | `serve.js` (301 lignes) | Serveur statique et relais GCD, Metron, Comic Vine | [Fait] Écoute sur `127.0.0.1` uniquement. Les clés restent dans `.secrets/` ou des variables d'environnement, jamais servies au navigateur. |
| Android | `android-app/` (Capacitor 8.5.3) | Application qui embarque `www` | [Fait] `allowMixedContent: false`, `webContentsDebuggingEnabled: false`, `CapacitorHttp` désactivé ; `allowBackup="true"` (décision en attente) ; permissions INTERNET et CAMERA ; minSdk 24, targetSdk 36 ; version 1.2 (code 3). |
| Tests | `run-all-tests.js` (2 562 lignes) | 28 scénarios de bout en bout dans Edge sans interface, via CDP | [Fait] Aucun test unitaire isolé ; les tests Android sont des exemples Capacitor par défaut. |
| Produit et design | `PRODUCT.md`, `DESIGN.md`, `README.md` | Documentation | À jour à la clôture de la Phase 2. |

### 1.2 Organisation du code et état
- **[Fait] État global en variables de module** : `physicalSingles`, `seriesMeta`, `locDoc`, `relPubs`/`relPulls`/`relMeta`, `exEditorial`/`exProgress`, etc. Il n'y a ni store centralisé ni bus d'événements. Chaque domaine écrit lui-même son stockage :
  - collection : `persistSingles()` ;
  - séries suivies : `saveSeriesMeta()` ;
  - emplacements : `saveLocDoc()` ;
  - calendrier : `relPut()` ;
  - Explorer : `exPut()`.
- **[Fait] Communication entre modules** : appels directs de fonctions. Par exemple, `persistSingles()` déclenche `scheduleCatalogSync()` et `scheduleLocationSync()`.
- **[Fait] Démarrage** : `dbReady` ouvre `panel-library` v3, puis `openCatalogDb()` ouvre `panel-catalog` v4. `recoverSinglesFromIdb()` reprend la copie IndexedDB si elle est plus récente. Viennent ensuite `initReleases()` (qui câble l'administration des sources et l'Explorer) et la migration du catalogue.
- **[Fait] Gestion des erreurs** : les erreurs de démarrage sont collectées (`window.__panel_init_errors`). Les écritures IndexedDB sont en `try/catch` avec un avertissement en console. Il n'y a pas de journal centralisé ni de remontée d'erreurs.
- **[Fait] API publique** : `window.Panel` expose les domaines (`catalog`, `locations`, `releases`, `data`, `explorer`…). C'est le point d'appui des tests ; il servira aussi pour la synchronisation.

### 1.3 Limites avant le cloud
1. **Pas de point unique de mutation.** Une modification d'exemplaire peut venir de dizaines d'endroits (formulaires, imports, scanner, cote automatique, couvertures en arrière-plan, emplacements), qui finissent tous par `persistSingles()`. [Reco] Capturer les changements **par différence** au moment de la persistance (empreinte par fiche comparée à une copie de référence), plutôt que d'instrumenter chaque point d'appel.
2. **Collection écrite en bloc.** Chaque `persistSingles()` réécrit tout le tableau dans localStorage (`panel_physical_singles`), puis la copie complète `meta/singlesFull` et le magasin `singles` (vidé puis rempli). Le coût est O(n) à chaque modification. C'est acceptable jusqu'à quelques milliers de fiches, mais pas comme base d'un journal de synchronisation. [Hypothèse] Une collection de 10 000 fiches avec des couvertures en `data:` peut approcher le quota de localStorage, environ 5 Mo selon le navigateur ; un repli est prévu (toast, IndexedDB).
3. **Un seul fichier de 12 852 lignes.** Il est maintenable par sections, mais ajouter un client d'authentification et un moteur de synchronisation risque de l'alourdir. [Reco] Isoler le code de la Phase 3 dans des fichiers séparés chargés par `<script src>`, mis en cache par le service worker et copiés dans `www` pour Android, sans introduire de bundler.
4. **Pas de CSP.** `index.html` ne déclare aucune Content-Security-Policy ; JSZip est chargé depuis cdnjs. Une session d'authentification stockée dans le navigateur rend la protection contre le XSS critique. [Reco] Ajouter une CSP au lot 3.2.

## 2. Architecture des données

### 2.1 Bases IndexedDB
| Base | Version | Magasins | Contenu |
|---|---|---|---|
| `panel-library` | 3 | `pages`, `singles`, `snapshots` | `pages` : anciennes données numériques, **conservées, jamais synchronisées**. `singles` : copie par identifiant de la collection, réécrite en entier. `snapshots` : 8 derniers instantanés complets de la collection. |
| `panel-catalog` | 4 | `publishers`, `series`, `issues`, `variants`, `copies`, `publications`, `pulls`, `meta`, `backups`, `editorial`, `readprog` | Catalogue normalisé dérivé de la collection (lot 2.1), calendrier (lot 2.4), méta (`singlesFull`, `singlesMirror`, `locations`, `releases`, `relimport_*`, `migration`, `state`), sauvegardes du catalogue, guides et progression (lot 2.6). |

### 2.2 localStorage (principales clés, relevé `grep`)
| Catégorie | Clés | Synchroniser ? |
|---|---|---|
| Collection | `panel_physical_singles`, `panel_singles_rev` | **Oui** : fiche par fiche, pas en bloc |
| Séries suivies (pull list par série) | `panel_series_meta` | **Oui** |
| Préférences | `panel_theme`, `panel_singles_view_mode`, `panel_sound_effects`, `panel_haptic_feedback`, `panel_pwa_banner_dismissed` | En partie : thème, vue et sons oui ; bannière d'installation non (propre à l'appareil) |
| Secrets | `panel_comicvine_key`, `panel_metron_creds` | **Jamais** |
| Caches et quotas | `panel_cv_volumes`, `panel_cv_rate`, `panel_fandom_*`, `panel_app_gcd_*`, `panel_app_metron_*`, `panel_upc_editions`, `panel_custom_upc_db`, `panel_cover_job`, `panel_cover_batches` | Non (recalculables ou propres à l'appareil). `panel_custom_upc_db` est un apprentissage de l'utilisateur, candidat pour plus tard |
| Journal du scanner et file à confirmer | `panel_scan_journal`, `panel_scan_queue` | Non pour la Phase 3 (état de travail local) |
| Historique de valeur | `panel_value_snapshots` | À évaluer au lot 3.4 (personnel, volumineux) |
| Données numériques héritées | `panel_reading_positions`, `panel_bookmarks`, `panel_comic_notes`, `panel_comic_annotations`, `panel_theories`, `panel_folders` | **Jamais** (conservées localement, hors périmètre produit) |
| Explorer | `panel_explorer_recent` | Non (historique de recherche local) |
| Divers | `panel_last_location`, `panel_locations` (ancien format), `panel_catalog_disabled`, relais `panel_*_proxy` | Non |

### 2.3 Inventaire des entités
| Entité | Stockage | Identifiant | Horodatages | Suppression | Nature |
|---|---|---|---|---|---|
| Exemplaire (single, wishlist incluse) | `physicalSingles` | `s_<ms>_<5 car.>` (plusieurs générateurs, l. 3699, 6664, 7292, 8615, 8683) ; des fiches sans identifiant ou en double sont possibles (`idReport`) | `addedAt` ; `updatedAt` seulement sur certains chemins ; `wish.updatedAt` | Suppression physique du tableau (pierre tombale côté `copies` du catalogue seulement) | **Personnelle** |
| Wishlist structurée | dans l'exemplaire (`isWishlist`, `wish{status,priority,targetPrice,pubId,variantWanted}`) | celui de l'exemplaire | `wish.addedAt/updatedAt` | idem | Personnelle |
| Série suivie | `seriesMeta[key]` (`pull`, `name`…) | clé de série normalisée | non | suppression de clé | Personnelle |
| Emplacement | `locDoc.nodes` (meta `locations`) | `loc_<base36>` | `createdAt`, `updatedAt`, `deletedAt` | **pierre tombale** | Personnelle |
| Abonnement Pull List par numéro | `pulls` | `pl_<base36>` ; `ownerId` = profil local | oui | statut `cancelled` | Personnelle |
| Profil local | `relMeta.profile` | `usr_local_<base36>` (`kind: 'local'`) | `createdAt` | — | Personnelle (pivot de liaison au compte) |
| Publication (calendrier) | `publications` | `pbc_<hash>` | `dates.*`, provenance par champ | statut `cancelled` | **Globale par nature, mais alimentée par des sources sous licence** (Comic Vine : usage non commercial), voir § 5 |
| Catalogue normalisé | `publishers/series/issues/variants/copies` | identifiants stables dérivés (`stableHash`) | `updatedAt`, `deletedAt` (copies) | pierre tombale | Dérivé, **recalculable** depuis la collection : pas à synchroniser |
| Guide de lecture | `editorial` | `gd_…` | `createdAt`, `updatedAt`, `editedAt` | aucune suppression dans l'interface | Le contenu fourni est global ; les guides créés ou importés sont personnels |
| Progression de lecture | `readprog` | `ek_<hash série/volume/numéro>` | `at` + historique (30) | statut vide | **Personnelle** |
| Conflits et journal des sources | `relMeta.conflicts/log`, meta `relimport_*` | `cf_…`, `imp_…` | oui | — | Locale (administration des données) |
| Instantanés | `snapshots` (8), `backups` (catalogue) | `snap_…` | `at` | rotation | Locale (protection) |

### 2.4 Relations
- Exemplaire → catalogue : `pubId`, `catalogIdsOf(s)` (publisher, série, numéro, variante), `comicVineId`.
- Exemplaire → emplacement : `locationId` ; ancien format `box`, `divider`, `location`.
- Pull → publication : `pubId`. Entrée de guide → publication : `pubId` explicite ou correspondance exacte. Progression → entrée : `ek_` (clé partagée par tous les guides).
- **[Constat]** Les relations sont des identifiants texte, sans contrainte d'intégrité. Côté serveur, il faudra tolérer des références orphelines (publication absente du serveur) au lieu de les rejeter.

### 2.5 Migrations, données inconnues, compatibilité
- **[Fait]** Les migrations IndexedDB sont additives (`mk()` ne crée que les magasins absents) et la migration du catalogue est idempotente, avec retour arrière. Les sauvegardes JSON sont versionnées (`panel-backup` v3, `panel-singles` v2) ; les versions plus récentes sont refusées.
- **[Fait]** Les champs inconnus des fiches sont conservés (catalogue : `extra` ; import : colonnes non associées).
- **[Risque]** Une base `panel-catalog` v4 ne peut pas être ouverte par du code antérieur, documenté au lot 2.6. Même règle pour toute future base de synchronisation. [Reco] Mettre la synchronisation dans une **base distincte** (`panel-sync`) pour ne plus monter `panel-catalog`.

## 3. Fonctionnement hors ligne
| Fonction | Hors ligne ? | Détail |
|---|---|---|
| Ouvrir l'application (PWA ou Android) | Oui | Coquille en cache (`sw.js`) ; `www` embarqué sur Android |
| Collection, séries, emplacements, wishlist, pull list, statistiques | Oui | Tout est local |
| Explorer, guides, progression | Oui | IndexedDB |
| Calendrier déjà chargé | Oui | Message « Hors ligne : dernières données enregistrées » (l. 8852) |
| Actualisation du calendrier (Comic Vine) | Non | Bloquée si `!navigator.onLine` (l. 8988) |
| Recherche Comic Vine, couvertures (Comic Vine, Fandom, Open Library), GCD, Metron | Non | Réseau requis ; relais local pour GCD et Metron |
| Scanner de codes-barres | Oui, après une première utilisation | La bibliothèque zxing-wasm est mise en cache |
| Export ZIP de l'ancien numérique | Oui, après une première utilisation | JSZip est mis en cache |
| Événements réseau | — | `online`/`offline` écoutés (l. 12587) ; reprise du travail de couvertures en arrière-plan |

[Fait] Aucune fonction ne dépend d'une connexion permanente. La Phase 3 doit préserver ce point : la session et la synchronisation sont **optionnelles**.

## 4. Sauvegardes et restauration (existant)
- **Sauvegarde JSON complète** (`backupJsonBtn`, `panel-backup` v3) : collection, séries, emplacements, calendrier (`releases`), Explorer (`explorer`), données numériques héritées. **Export de la collection** : `panel-singles` v2.
- **Restauration** (`applyBackupRestore`) : validation stricte, fusion par défaut ou remplacement explicite, instantané avant, vérification de relecture, retour arrière complet en cas d'échec (collection, séries, emplacements, calendrier, Explorer).
- **Instantanés automatiques** : avant chaque modification par lot, 8 conservés (IndexedDB `snapshots`).
- **Copies de secours** : `meta/singlesFull` (atomique) et le magasin `singles`. Au démarrage, la copie la plus récente est reprise.
- **Pas de sauvegarde automatique hors de l'appareil.** La perte de l'appareil, ou l'effacement des données du navigateur, entraîne la perte de la collection en l'absence d'export manuel. C'est le premier bénéfice attendu de la Phase 3.
- **Risques avec la synchronisation** :
  1. une restauration en mode « remplacement » produirait des milliers de suppressions et de modifications à propager. Elle doit passer par un aperçu de synchronisation et ne jamais écraser silencieusement des données distantes plus récentes ;
  2. la reprise depuis IndexedDB au démarrage remplace le tableau entier. Le moteur doit la voir comme une suite de changements comparés à sa copie de référence, pas comme un nouvel état ;
  3. l'annulation d'un import ou un instantané restauré produit aussi des changements en masse. Même traitement.

## 5. Sécurité
| Sujet | Constat | Conséquence pour la Phase 3 |
|---|---|---|
| Secrets serveur | [Fait] `serve.js` lit `.secrets/*.json` ou les variables d'environnement ; `.secrets/`, `.env*` et `*.backup*` sont ignorés par Git | Même règle pour les clés cloud : aucune clé secrète dans le dépôt ni dans le client |
| Secrets client | [Fait] La clé Comic Vine (`panel_comicvine_key`) et les identifiants Metron (`panel_metron_creds`, Android) sont dans localStorage, et aussi dans la sauvegarde JSON (`readStoredDigitalData`) | Ne jamais les synchroniser ; les exclure de toute exportation cloud |
| Authentification | [Fait] Aucune | À créer (lot 3.2) |
| XSS | [Fait] `escapeHtml` systématique (sans `'`, d'où des attributs entre guillemets doubles) ; tests XSS 22 et 29 ; pas de CSP | La CSP devient obligatoire avant de stocker une session |
| Relais local | [Fait] `127.0.0.1` seulement, `nosniff`, `no-store`, paramètres validés | Inchangé ; le cloud ne passe pas par `serve.js` |
| Android | [Fait] `allowBackup="true"` (sauvegarde Google des données de l'application, sessions comprises), débogage WebView désactivé, contenu mixte refusé | Trancher `allowBackup` avant de stocker un jeton de rafraîchissement ; stockage sécurisé appuyé sur le Keystore |
| Licences | [Fait, lot 2.5] Comic Vine : usage non commercial ; couvertures non couvertes par les droits sur les métadonnées | **Ne pas téléverser de catalogue partagé alimenté par Comic Vine.** Les données de calendrier synchronisées restent personnelles ; décision juridique en attente pour la sauvegarde cloud des couvertures en URL |
| Autorisations serveur | Sans objet aujourd'hui | Toute autorisation côté serveur (RLS) ; le frontend ne protège rien |

## 6. Qualité et tests
- **Existant** : 28 scénarios de bout en bout (collection, imports, scanner, catalogue, migration, emplacements, calendrier, sources, Explorer, XSS, protection des données, PWA hors ligne, relais).
  - Points forts : tests de migration, de retour arrière, de redémarrage, d'hors ligne simulé et d'injection.
  - Point faible : durée de plusieurs minutes, aucun test unitaire.
- **Absent et nécessaire pour la Phase 3** :
  - tests de schéma et de RLS (autorisé / refusé, par opération, entre deux utilisateurs) ;
  - tests unitaires du moteur de synchronisation (fusion par champ, idempotence, ordre, pierres tombales) ;
  - tests de propriétés : convergence de deux appareils après n opérations aléatoires ;
  - tests de panne réseau (coupure en plein envoi, doublon de requête, réponse perdue) ;
  - tests de migration d'une grande collection (10 000 fiches) avec vérification d'intégrité ;
  - tests Android réels (mode avion, réinstallation, stockage sécurisé), aujourd'hui inexistants ;
  - tests de charge du `pull` paginé ;
  - analyse de secrets dans le dépôt.

## 7. Synthèse
**Forces**
- Fonctionnement local et hors ligne complet.
- Protections de données éprouvées : instantanés, retour arrière, fusion par défaut.
- Identifiants déjà préfixés.
- Pierres tombales sur les emplacements.
- Provenance par champ (lot 2.5), un modèle réutilisable pour la fusion par champ.
- Profil local (`usr_local_…`) et `ownerId` déjà prévus.
- Tests de bout en bout riches.

**Faiblesses**
- Collection écrite en bloc, sans horodatage fiable par fiche.
- Suppressions physiques des exemplaires.
- Mutations dispersées.
- Fichier unique volumineux.
- Pas de CSP ; secrets clients dans localStorage et dans les sauvegardes.
- Aucune sauvegarde hors de l'appareil.

**Risques principaux pour la Phase 3**, par ordre de gravité :
1. Perte silencieuse lors d'une fusion ou d'une restauration.
2. Fuite d'une session ou d'une clé.
3. Données d'un utilisateur visibles par un autre (RLS mal écrite).
4. Collection de milliers de fiches migrée partiellement.
5. Licence Comic Vine incompatible avec un stockage cloud partagé.
6. Montée de version IndexedDB non réversible.

## Sources
- Dépôt Panel, commit `fe19e3c` (`index.html`, `sw.js`, `serve.js`, `android-app/`, `run-all-tests.js`).
- Documentation Supabase (consultée le 7/11/2026) : voir [`02-architecture-cible.md`](02-architecture-cible.md).
