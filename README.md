# Panel by Primestone — Collect. Discover. Connect.

Application 100% locale, sans serveur requis, centrée sur la collection de comics physiques.

> **Partie numérique retirée (Phase 1, nov. 2026).** Panel ne lit plus et n'importe plus de fichiers PDF / CBZ / CBR. Les fichiers et données déjà stockés (IndexedDB « pages », marque-pages, notes, annotations, positions de lecture, dossiers) sont **conservés intacts** : ils restent dans les sauvegardes JSON et s'exportent en archive ZIP via « Anciens fichiers numériques » (barre latérale ou menu Plus, visible seulement s'il en existe).

**Collection Physique de Singles US & Comics** : Gestionnaire d'inventaire complet avec scanner de code-barres UPC / ISBN, scanner visuel de couvertures par empreinte perceptuelle (dHash 64-bit), hiérarchie physique de boîtes et séparateurs, détection automatique des doublons, estimation de valeur et grading.

---

## 📌 État du projet (mis à jour le 7 novembre 2026)

- **Vision** : Panel by Primestone — Collect. Discover. Connect. Comics physiques uniquement (aucun lecteur ni stockage de comics numériques).
- **Architecture réelle** : application monopage locale (`index.html`, JS sans framework) ; stockage navigateur (localStorage + IndexedDB) ; relais local `serve.js` (GCD, Metron, Comic Vine) ; app Android Capacitor (`android-app/`) ; service worker hors ligne.
- **Terminé** : Phase 0 (audit), Phase 1 (stabilisation, protection des données, retrait du numérique, finitions visuelles), Phase 2 · lot 2.1 (catalogue normalisé).
- **En attente de validation** : lots 2.2 à 2.7 de la Phase 2.
- **Tests** : `node run-all-tests.js` (Edge sans interface), 23 tests.
- **Points de vigilance** : les fiches sans identifiant ou en double sont signalées (`Panel.catalog.idReport()` propose un identifiant de remplacement, sans rien appliquer). Les entrées de catalogue sans exemplaire sont conservées, et les exemplaires supprimés gardent une pierre tombale. Les instantanés de collection restent limités aux 8 derniers (comportement antérieur).
- **Décisions en attente** : renouvellement de la clé Comic Vine, signature Android de publication, option `allowBackup`, purge des anciennes clés Marvel/Vision.

## 🗂️ Catalogue normalisé (Phase 2 · lot 2.1)

Une base IndexedDB dédiée, `panel-catalog`, organise la collection en **éditeurs → séries → numéros → variantes**. Les **exemplaires** personnels sont reliés à ces entrées.

- **Indépendant des fournisseurs** : les identifiants internes (`pub_…`, `ser_…`, `iss_…`, `var_…`, `cpy_…`) sont calculés à partir des données de la collection. Les identifiants externes (code-barres, ISBN, Comic Vine, Metron, GCD) et la provenance des couvertures sont conservés un par un, avec la fiche d'où ils viennent.
- **Exemplaires** : chacun garde ses données personnelles (état, achat, valeur et historique, emplacement, wishlist, lu, note, signature, notes), les valeurs de catalogue de sa fiche et les champs inconnus. La fiche d'origine peut donc être reconstruite à l'identique.
- **Synchronisation future** : chaque entité porte `createdAt` et `updatedAt`. `updatedAt` ne change que si le contenu change. Une fiche supprimée laisse une pierre tombale (`deletedAt`) au lieu d'un effacement, et les entrées du catalogue sont conservées.
- **Migration** (automatique au démarrage, puis synchronisée après chaque enregistrement) :
  - Elle ne fait qu'ajouter : **la collection existante n'est ni modifiée ni réécrite**.
  - Avant migration : une sauvegarde complète (dans `panel-catalog`, 3 conservées) et un instantané.
  - Après migration, une vérification fiche par fiche : nombre d'entrées, reconstruction identique, références complètes. En cas d'échec, le catalogue est vidé automatiquement et la collection reste la référence.
  - Elle est idempotente : la relancer ne crée aucun doublon et ne change aucune date.
- **Doublons probables** : éditeurs proches, série sous plusieurs éditeurs, année manquante, identifiant externe partagé, variantes proches. Ils sont **signalés, jamais fusionnés**. Les fiches sans identifiant ou en double sont signalées comme anomalies.
- **Durabilité** : localStorage et IndexedDB partagent un numéro de révision. La liste complète (fiches sans identifiant ou en double comprises) et sa révision sont écrites en un seul enregistrement IndexedDB (`panel-catalog` / `meta` / `singlesFull`), ce qui exclut toute copie à moitié écrite. Si localStorage est plein, cette version plus récente est reprise au démarrage, après un instantané. Une copie tronquée est ignorée.
- **Échec de migration** : la collection n'est pas touchée et le catalogue est vidé. Aucune nouvelle tentative automatique n'a lieu tant que la collection n'a pas changé (`Panel.catalog.enable()` force une nouvelle tentative). Les sauvegardes `panel-catalog.backups` ne sont jamais supprimées automatiquement.
- **Retour arrière** (testé) : `Panel.catalog.rollback()` vide uniquement la base dérivée `panel-catalog`. Les sauvegardes, les instantanés et la collection ne sont pas touchés, et la migration automatique est désactivée (`panel_catalog_disabled`). `Panel.catalog.enable()` la relance. Pour revenir au code d'avant le lot 2.1, il suffit de revenir au commit `8b04cb3` : l'ancien code ignore simplement la base `panel-catalog`.
- **Contrôle** : « Vérifier les données » (menu Plus) affiche l'état du catalogue et le nombre de doublons signalés. L'API de test est `Panel.catalog.{status, verify, read, sync, migrate}`.

## 📲 Application installable (PWA)

Panel s'installe comme une application (icône d'accueil, plein écran, hors ligne) sur téléphone, tablette et ordinateur.

| Mode d'ouverture | Installation | Hors ligne | Caméra (scanners) |
|---|---|---|---|
| `index.html` ouvert comme fichier (`file://`) | non | non | non |
| `node serve.js` → `http://localhost:8080` (cet ordinateur) | oui | oui | oui |
| Hébergé en **HTTPS** (Netlify, Vercel, GitHub Pages…) | oui, y compris téléphone | oui | oui |

- **Fichiers** : `manifest.webmanifest` (nom, couleurs, icônes dont une « maskable » Android, 4 raccourcis : Scanner, Collection, Sorties, Séries), `sw.js` (service worker), `icons/`, `serve.js` (serveur local sans dépendance, qui ne sert que les fichiers de l'app).
- **Hors ligne** : l'app, JSZip, le lecteur de codes-barres et les polices sont mis en cache ; la collection (localStorage + IndexedDB) reste disponible. Comic Vine et les couvertures restent en ligne uniquement ; un indicateur « Hors ligne » s'affiche et la récupération des couvertures reprend au retour du réseau.
- **Mises à jour** : à chaque nouvelle version, Panel propose « Recharger » (jamais de rechargement surprise en pleine saisie).
- **Installation** : bouton « 📲 Installer l'application » (sidebar, paramètres) et bandeau masquable ; sur iPhone, le bandeau indique Partager → « Sur l'écran d'accueil ».
- **Stockage persistant** demandé une fois l'app installée (le navigateur ne purgera pas la collection) ; usage et quota visibles dans ⚙️ Paramètres.
- **Mobile** : zones sûres (encoche, barre d'accueil), barre d'actions compacte, onglets de collection.
- **Données par appareil** : chaque appareil garde sa propre collection. Pour passer de l'ordinateur au téléphone : « Export JSON » puis « Restaurer », ou réimport direct du fichier CLZ / League of Comic Geeks sur le téléphone.

```bash
node serve.js
```

## 🤖 Application Android (APK)
`android-app/` emballe Panel avec Capacitor 8.5 (source unique : `index.html`, copié à chaque construction).
- **Hors ligne** : JSZip (import Excel) et le lecteur zxing-wasm sont embarqués (empreintes SHA-256 vérifiées, `vendor.lock.json`).
- **Scanner** : caméra du téléphone (autorisation Android au premier scan).
- **Metron et GCD sans le PC** : le relais est intégré à l'app (HTTP natif, mêmes quotas et caches que `serve.js`). Identifiants Metron dans ⚙️ Paramètres, vérifiés avant d'être gardés sur le téléphone.
- **Exports et sauvegardes** : feuille de partage Android (Drive, e-mail, fichiers…). **Bouton retour** : ferme la fenêtre ouverte.
- **Construire** : `cd android-app`, puis `npm run apk` → `android-app/Panel-1.0.apk`. Outils requis (installés dans `C:Users	adeoandroid-build`) : JDK 21 Microsoft, SDK Android (API 36).
- **Signature** : clé de débogage de ce PC (`%USERPROFILE%.androiddebug.keystore`). Les mises à jour doivent être signées avec la même clé : sauvegardez ce fichier.

## 🏆 Collector Pro (novembre 2026)

Fonctions de suivi de collection au niveau des gestionnaires de référence (League of Comic Geeks, CLZ), 100 % locales :

- **Séries & complétion** : chaque série possédée avec sa barre de complétion et ses numéros manquants (`#3, #5–6`). Grille des numéros (possédé / lu / wishlist / manquant) ; un clic sur un manquant l'ajoute à la wishlist, ou tous d'un coup. Bornes « du #… au # » réglables par série (runs démarrant au #300, total connu de la série).
- **Pull list & sorties du mercredi** : les sorties de la semaine via la date de mise en vente Comic Vine (`store_date`), navigation semaine par semaine, filtre « ma pull list seulement ». Chaque sortie passe en wishlist ou en « acheté » d'un clic.
- **Wishlist séparée** : les exemplaires recherchés ne gonflent plus le nombre ni la valeur de la collection.
- **Suivi financier réel** : prix de couverture, prix payé, date d'achat, valeur estimée → investi, plus-value en $ et en %.
- **Lecture & notes** : statut lu / non lu et note de 1 à 5 étoiles par exemplaire, modifiables depuis l'inspecteur ; filtre lus / non lus.
- **Statistiques** : valeur par éditeur, top 10 des plus précieux, meilleures plus-values, achats sur 12 mois, état & grading, rangement par boîte.
- **Vue liste** compacte (en plus de la grille), mémorisée.
- **Suppression annulable** (toast « Annuler » au lieu d'une boîte de confirmation).
- **Grading étendu** : CGC 10.0 → 8.0, CBCS, PGX, et échelle non gradée FR 1.0 → NM/M 9.8 ; tri par grade numérique.
- **Mobile** : onglets Collection / Séries / Sorties / Wishlist / Stats sous 720 px.

### ⚡ Cote automatique
Aucune base de cotes officielle n'est accessible gratuitement depuis une application locale sans serveur (PriceCharting, GoCollect, CovrPrice : accès payant et/ou réservé aux serveurs). Panel combine donc trois niveaux, du moins au plus fiable :

1. **Cote auto (≈)** — estimation algorithmique et transparente : valeur médiane par époque (Moderne, années 90, Copper, Bronze, Silver, Golden), multiplicateur key issue majeure/mineure (détection automatique via la base de keys), #1, variantes ratio `1:N`, virgin/foil/exclusive/newsstand, dédicace (CGC Signature Series ou non), courbe de grade de 0.5 à 10.0, prime et plancher de slab. Chaque cote affiche sa fourchette, son niveau de confiance et le détail de chaque facteur.
2. **Valeur saisie** — votre propre estimation, jamais écrasée par défaut.
3. **Cote marché confirmée (✓)** — un prix constaté (lien direct « eBay vendus » préfiltré sur les ventes terminées, recherche GoCollect / CovrPrice) ; jamais écrasée par un recalcul.

- Tout comic ajouté sans valeur (formulaire, scan, wishlist, sorties) est coté automatiquement ; bouton « ⚡ Coter » dans la fiche.
- **Cote globale** (bouton « ⚡ Coter ») avec complétion des années de parution via Comic Vine (40 max par passage, 1 requête/s).
- **Historique de cote** par exemplaire et **courbe d'évolution** de la valeur de la collection (relevé quotidien), carte « Sources des cotes » dans les statistiques.
- Année, source de cote et historique inclus dans les exports CSV/JSON et restaurés à l'import.

### 📄 Import CLZ Comics / League of Comic Geeks / CSV
Bouton « Import CLZ / LoCG » (barre d'outils de la collection et sidebar) :

- **Détection automatique** du format (CLZ Comics, League of Comic Geeks, tableur générique), du séparateur (virgule, point-virgule, tabulation) et de la correspondance des colonnes (noms CLZ : Series, Issue, Variant Description, Grade, Grading Company, Purchase Price, Purchase Date, Storage Box, Signed by, Read… ; LoCG : Series, Issue, Publisher, Date, Price Paid… ; équivalents français).
- **Correspondance modifiable** colonne par colonne, avec aperçu des exemplaires convertis avant import.
- Conversion : grades texte ou numériques → échelle Panel (CGC/CBCS/PGX → slab certifié), prix `$1,250.00` / `12,50 €`, dates `Oct 09, 2024` / `2024-10-09` / `25/03/2023`, quantités (copies multiples), statut Wish List → wishlist, Sold → ignoré, dédicaces, keys, certificats et code-barres conservés en notes, titre complet « Batman #1 » découpé en série + numéro.
- Doublons déjà présents ignorés (option), cote automatique des exemplaires sans valeur (option), import entier annulable depuis la notification.

Les noms de colonnes exacts dépendent des champs cochés lors de l'export : si une colonne n'est pas reconnue, associez-la à l'étape 2.

**Export Excel League of Comic Geeks (.xlsx)** — validé sur un export réel de 2 687 lignes (21 colonnes : Publisher Name, Series Name, Full Title, Release Date, In Collection, In Wish List, Marked Read, My Rating, Media Format, Price Paid, Date Purchased, Condition, Notes, Tags, Storage Box, Owner, Purchase Store, Signature, Slabbing, Grading, Grading Company) :
- lecture native des classeurs `.xlsx` (chaînes partagées ou en ligne, dates Excel) ;
- numéro et variante extraits du « Full Title » (« Absolute Batman #1 Cover J Jim Lee Foil Virgin Variant ») ;
- volumes distingués : « Action Comics (Vol. 3) (2016 - Present) » → « Action Comics (2016) », séparé de « Action Comics (2011) » ;
- annuals et specials en séries propres ; recueils TPB / HC / tomes importés sans numéro avec une cote de revente dédiée ;
- « In Collection » / « In Wish List » respectés ; les comics seulement marqués lus (liste de lecture LoCG) ne sont pas importés par défaut (option pour les inclure) ;
- notes demi-étoiles arrondies à l'étoile la plus proche.

Améliorations issues de ce fichier réel :
- **Key issues** : correspondance stricte du nom de série (« Absolute Batman #1 » n'est plus confondu avec le Batman #1 de 1940) et contrôle de l'année ; les **réimpressions** (2nd printing, facsimile, « 2026 Foil Edition ») ne reçoivent qu'une prime réduite.
- **Complétion** : le run suivi est le bloc principal de numéros ; un numéro legacy isolé (#450) est signalé « hors run » au lieu de générer des centaines de manquants, et les séries à numéros épars ne sont plus présentées comme des runs incomplets. Nouveau tri par défaut « Runs presque complets ».
- **Plus-value** calculée uniquement sur les exemplaires dont un prix est connu (sinon « — »).
- **Grandes collections** : affichage progressif par 120 exemplaires (« Afficher plus »).
- Les couvertures ne sont pas incluses dans l'export LoCG : voir « Couvertures Comic Vine » ci-dessous.

### 🔑 Base des key issues (118 clés)
Utilisée par la cote automatique, l'ajout en wishlist, les sorties et les formulaires :

- **118 key issues établies**, du Golden Age à 2025 : Action Comics #1, Detective Comics #27, Amazing Fantasy #15, Fantastic Four #48 / #52, Incredible Hulk #181, Iron Man #55, Giant-Size X-Men #1, Amazing Spider-Man #129 / #300 / #361, New Mutants #87 / #98, Uncanny X-Men #266, Batman Adventures #12, Walking Dead #1, Ultimate Fallout #4, Edge of Spider-Verse #2, Venom (2018) #3, Something is Killing the Children #1, la ligne DC Absolute… (premières apparitions et événements majeurs uniquement).
- **Année de couverture** pour chaque clé : X-Men #1 de 1963 (majeure) ≠ X-Men #1 de 1991 (mineure) ; Batman (2016) #1 n'est pas le Batman #1 de 1940 ; Transformers #1 de 1984 n'est pas celui de l'Energon Universe. Sans année ni volume, un titre ambigu n'est pas classé key.
- **Titres alternatifs** : « Uncanny X-Men » / « X-Men », « Saga of the Swamp Thing » / « Swamp Thing », « Marvel Super Heroes Secret Wars » (≠ Secret Wars 2015), « Luke Cage, Hero for Hire », article « The » ignoré (« The Walking Dead » n'était jamais reconnu).
- **Niveau majeur / mineur** : la prime de cote dépend de l'importance de la clé et de l'époque (une #1 récente de la ligne Absolute ≈ 2× le prix de couverture, une première apparition Bronze Age bien davantage).
- **Réimpressions reconnues** même publiées des décennies plus tard (« Fantastic Four #52 Facsimile Edition 2026 » = réimpression de la 1ère apparition de Black Panther) : prime réduite, raison affichée.

### 🖼️ Couvertures Comic Vine en arrière-plan
Barre « Récupérer les couvertures » au-dessus de la collection (visible tant que des couvertures manquent) :

- **Par série, pas par comic** : 1 recherche du volume (nom + année de début + éditeur, ex. « Action Comics (2016) » ≠ « Action Comics (2011) », annuals et specials reconnus) puis 1 requête qui ramène 100 numéros du volume. Une collection de ~1 200 comics / ~400 séries se couvre en 2 à 3 heures au lieu de 6+.
- **Quotas respectés** : Comic Vine limite chaque type de requête à ~200 / heure ; Panel compte ses requêtes (185 / heure par sécurité, 1 toutes les 1,2 s), se met en **pause automatique** avec l'heure de reprise, gère la réponse « Rate Limit Exceeded » et réessaie seul après une coupure réseau.
- **Reprise** : l'avancement et les séries déjà identifiées sont mémorisés ; la récupération reprend à la prochaine ouverture de Panel. Les couvertures s'affichent en direct, sans recharger la grille.
- **Bilan** : couvertures trouvées, introuvables (bouton « Réessayer les introuvables »), recueils sans numéro ignorés.
- **Variantes** : l'API Comic Vine ne fournit plus les couvertures variantes (champ `associated_images` vide, vérifié en novembre 2026) : elles viennent désormais de Fandom (section suivante). Comic Vine reste la source de la couverture standard.

Validé sur une vraie collection : 9 séries « Absolute » (dont l'Annual 2025, Ark-M Special, Noir Edition) toutes associées au bon volume, 46 couvertures en 44 secondes et 34 requêtes.

### 🎭 Couvertures et variantes : Fandom + provenance (novembre 2026)
Ordre des sources : **couverture manuelle → Fandom (variante exacte) → Comic Vine (couverture standard) → Open Library (ISBN exact uniquement) → couverture générée**.

- **Fandom** (DC Database, Marvel Database, Image Comics Database ; API MediaWiki publique) : la page du numéro (« Absolute Batman Vol 1 1 ») liste toutes ses couvertures avec légende — 66 pour Absolute Batman #1 : tirages, ratios 1:25, textless, exclusivités. La page est trouvée en 1 requête groupée (« Titre Vol 1…12 N », départagée par l'année), puis en 1 requête par numéro une fois la série connue.
- **Correspondance prudente** : artistes, tirage (2nd Printing), ratio, virgin ≡ textless, noir & blanc, sketch. Une foil sans photo dédiée reçoit le même dessin marqué **approchée**. Si deux couvertures correspondent autant (ex. deux « Dan Panosian Variant »), **aucune n'est choisie** : la couverture standard reste affichée et la fiche propose toutes les images.
- **Provenance enregistrée** pour chaque couverture : source (Manuelle, Fandom, Comic Vine, Open Library), fiabilité (exacte / approchée / standard), légende et page d'origine. Visible dans la fiche (badge sur chaque image) et dans l'inspecteur.
- **Couvertures manuelles protégées** : photo, URL collée ou image choisie à la main sont verrouillées ; aucun traitement automatique ne les remplace. Les couvertures d'origine inconnue (avant cette version) sont traitées comme manuelles.
- **Annulation** : chaque remplacement garde l'image précédente (« Restaurer la précédente » dans l'inspecteur) ; chaque récupération forme un lot annulable (« Annuler le dernier lot »).
- **Sauvegardes automatiques** : instantané complet de la collection (IndexedDB) avant chaque lot et avant chaque restauration ; les 8 derniers sont listés dans ⚙️ Paramètres avec un bouton « Restaurer ».
- **Quotas** : Fandom 900 requêtes / heure maximum (1 toutes les 0,7 s), pause et reprise automatiques comme pour Comic Vine ; caches persistants (séries, pages, absences retentées après 14 jours).
- **Licence** : textes et images Fandom sous CC BY-SA ; la page source est conservée avec chaque couverture.
- **Mesuré** sur 60 comics de la vraie collection (export LoCG) : 77 % de couvertures exactes avec la recherche plein texte, ≈ 87 % avec la recherche par volume utilisée ici. Restent introuvables : des variantes absentes du wiki et des numéros très récents.

### 📷 Scanner de codes-barres refait (novembre 2026)
- **Lecteur zxing-wasm** (chargé à l'ouverture du scanner, puis disponible hors ligne) au lieu de html5-qrcode, qui ne lisait jamais le supplément à 5 chiffres. Audit sur images dégradées : 0/22 pour l'ancien lecteur, 8/11 lectures complètes (17 chiffres) pour zxing-wasm.
- **Caméra** : 1080p, mise au point continue si disponible, lampe, zoom ×2, choix de l'objectif, zone de lecture centrale. Un code n'est validé qu'après **deux lectures identiques** ; un code sans supplément n'est accepté qu'après 2,5 s (le temps de lire le supplément).
- **Aide à l'écran** : « cadrez aussi les 5 petits chiffres », « rapprochez, évitez les reflets, allumez la lampe », puis saisie manuelle après 10 s. Lecture **depuis une photo** possible (ordinateur sans caméra).
- **Saisie manuelle** : code de 12 / 17 chiffres ou ISBN, avec contrôle de la clé.
- **Identification honnête** : le supplément donne le numéro et un code d'édition (« 11 » ≈ Cover A 1er tirage) mais **pas** le nom de la variante. Supprimés : le dictionnaire de 116 codes fabriqués (dont 17 impossibles), la table « 3 = 1:25, 4 = Foil… », le prix 3,99 $ par défaut, la couverture Ultimate Spider-Man de secours.
- **Chaîne d'identification** : édition déjà confirmée (code complet appris) → **GCD par le relais local** (édition exacte, prix) → couvertures candidates **sans présélection** quand l'édition est incertaine. Rien n'est ajouté au hasard.
- **Mode continu** : ajout direct seulement pour une édition déjà confirmée (avec sa couverture) ; sinon le code part dans la liste **« À confirmer »** du scanner (un clic ouvre la fiche). Le même comic resté devant l'objectif n'est pas compté deux fois (8 s).
- **Doublons** : code déjà possédé signalé (« déjà possédé ×2 »), exemplaire supplémentaire numéroté.
- **Journal des scans** (⚙️ Paramètres, export CSV) : pour chaque scan, temps de lecture, temps d'identification, résultat (édition confirmée, GCD, variante à choisir…), proposition contre valeur finale enregistrée, touches et champs corrigés, abandons. Sert au protocole de comparaison avec LoCG (`phase5/PROTOCOLE.md`).

### 🛰️ Metron (relais local, compte gratuit)
Metron connaît le code-barres de chaque variante (74 variantes pour Absolute Batman #1, nommées comme sur League of Comic Geeks). Une fois configuré, c'est **la première source du scanner** :
- **code complet** → série, numéro, variante exacte, prix et image (source « Metron ») ;
- **début du code** → la série est reconnue dès le premier scan, sans taper le titre ;
- **mode continu** : un code mis de côté est ajouté automatiquement si Metron connaît son édition exacte.

Configuration, une seule fois : `node serve.js --metron` (pseudo Metron, pas l'e-mail ; mot de passe masqué, vérifié avant d'être enregistré dans `.secrets/metron.json`, jamais servi au navigateur). Quota respecté : 1 requête / 3,2 s, pause sur 429 ; réponses en cache (`.cache/metron.json`). Mesuré : excellent sur les DC récents, plus faible sur les variantes Marvel, les réimpressions anciennes et l'avant-2000 — GCD puis Fandom prennent alors le relais.

### 🗄️ Relais GCD local (`serve.js`)
GCD (Grand Comics Database) connaît le code-barres complet de chaque édition (18 éditions pour Absolute Batman #1), mais son API refuse les appels directs d'un navigateur. `node serve.js` ajoute un relais `/api/gcd/issues?series=…&issue=…&year=…&barcode=…` :
- 1 requête pour la liste des éditions, puis les fiches détaillées **seulement jusqu'à trouver le code** (Cover A d'abord si le code finit par 11) ; tout est gardé en cache (`.cache/gcd.json`, jamais servi au navigateur).
- **Quota** : 25 requêtes / heure (limite anonyme GCD : 30). Vérifié en réel : `76194138584600138` → « Jim Lee & Scott Williams Foil Cardstock Variant », 7,99 $ (11 requêtes la première fois, 0 ensuite).
- Disponible quand Panel est ouvert via `http://localhost`. Pour un Panel hébergé, il faudra héberger ce relais (et idéalement utiliser un compte GCD : 2 000 requêtes / jour) puis renseigner son adresse dans `localStorage['panel_gcd_proxy']`.
- Données GCD sous licence CC BY-SA 4.0.

### Fiabilité & sécurité corrigées
- Échappement HTML de toutes les données affichées (un JSON importé ne peut plus injecter de script) ; URLs d'image limitées à `http(s)`, `data:image` et `blob:`.
- Import JSON validé et nettoyé champ par champ ; export CSV protégé contre l'injection de formules tableur.
- Plus de valeurs inventées : ni 15 $ par défaut, ni couverture Spider-Man pour un comic inconnu (une couverture générée localement la remplace).
- Photos d'exemplaire réduites à ~700 px avant stockage (une photo de téléphone saturait `localStorage`).
- Copie de secours complète de la collection dans IndexedDB, restaurée automatiquement si `localStorage` est vide ou illisible.
- La sauvegarde complète inclut la pull list et les bornes de séries.

## 🚀 Nouveautés Majeures de la Modernisation

### 1. 🔍 Scanner Visuel de Couvertures (Cover Visual Recognition)
- **Reconnaissance par Photo** : Photographiez la couverture avant de n'importe quel single ou importez une image.
- **Prétraitement Canvas & Outils** : Recadrage proportionnel (format standard comics 2:3), rotation à 90° et amélioration de contraste.
- **Algorithme d'Empreinte Perceptuelle dHash 64-bit** : Calcul local d'un hash structurel invariant aux variations d'éclairage combiné à un profil de distribution chromatique 16 bins.
- **Scoring & Comparaison Côte à Côte** : Recherche multi-candidats sur Comic Vine et affichage comparatif direct (votre photo vs couverture officielle) avec badge de confiance (`Élevée > 85%`, `Moyenne > 70%`, `Basse`).
- **Confirmation en 1 Clic** : Sélectionnez la variante exacte pour préremplir immédiatement la fiche et l'ajouter à votre collection.

### 2. ⚡ Scanner UPC & Code-Barres Réparé et Modernisé
- **Multi-Caméras** : Détection et sélection automatique des caméras disponibles (arrière / ultra-large / macro / avant).
- **Cycle de Vie Robuste** : Démarrage et arrêt propres des flux vidéo sans blocage des périphériques ni fuite mémoire.
- **Formats Supportés** : UPC-A, UPC-E, EAN-13, EAN-8 avec supplément EAN-5 (voir « Scanner de codes-barres refait » ci-dessus).
- **Contrôles Intégrés** : Torche / Lampe de poche et bascule caméra en un clic.

### 3. 📦 Hiérarchie Physique & Rangement en Boîtes
- **Organisation Structurée** : Chaque comic physique peut être rangé selon la hiérarchie : `Collection → Boîte (Short Box / Long Box / Tiroir) → Séparateur (Divider / Titre)`.
- **Filtre Dynamique par Boîte** : Barre de filtre dédiée au-dessus de la collection pour isoler une boîte en un clic avec compteur dynamique d'exemplaires.
- **Auto-Complétion Intelligente** : Mémorisation et suggestion des boîtes existantes lors de la saisie d'un nouveau comic.

### 4. ⚠️ Détection Intelligente des Doublons
- **Alerte Contextuelle** : Lors de l'enregistrement d'un comic, Panel vérifie immédiatement si le titre et le numéro existent déjà dans votre collection.
- **Différenciation Fine** :
  - *Même numéro mais variante différente* (ex: Cover B vs Cover A) : Signalé à titre informatif, sans bloquer l'ajout d'une variante.
  - *Même numéro et même variante* : Propose soit de mettre à jour l'exemplaire existant, soit d'ajouter un second exemplaire identique (double physique pour investissement ou lecture).

### 5. 🌐 Étude et Intégration des Bases de Données Externes
- **Comic Vine API (Active)** : Intégrée nativement en JSONP direct (sans CORS, sans proxy, 100% client). Plus de 850 000 issues avec couvertures officielles, variantes, story arcs et crédits. Une clé par défaut est intégrée ; renseignez la vôtre dans ⚙️ Paramètres (gratuite sur comicvine.gamespot.com/api) avant de partager l'application.
- **OpenLibrary API (Active)** : Prise en charge des codes ISBN (978/979) pour les albums français (Urban Comics, Panini) et les Graphic Novels / TPB.
- **Metron Cloud (Documenté)** : Étudié pour enrichissement futur via fonction serveur (authentification HTTP Basic et absence de headers CORS natifs).
- **Grand Comics Database (Active via le relais local)** : API REST sans CORS, utilisée par `serve.js` pour identifier l'édition exacte d'un code-barres. Les images de couverture GCD ne sont pas utilisées (accès refusé aux clients automatisés).
- **Fandom (Active)** : DC / Marvel / Image Database, source des couvertures variantes.
- **League of Comic Geeks** : aucune API officielle ; ses conditions réservent tous les droits. Non utilisé.
- **ComicBookDB** : Service définitivement fermé depuis le 16 décembre 2019.

---

## 🧪 Tests Automatisés de Non-Régression (CDP Microsoft Edge)

Un banc de test automatisé complet via le protocole Chrome DevTools (CDP) est inclus dans le projet :
```bash
node run-all-tests.js
```

### Suites de Tests Validées :
- `✓ PASS - Intégrité DOM` (Tous les boutons, modales, sélecteurs et entrées)
- `✓ PASS - Décodage UPC & ISBN` (Direct Market 17 chiffres, ISBN 13 chiffres, fallbacks)
- `✓ PASS - Cycle de vie Scanner UPC` (Ouverture, arrêt sécurisé, réouverture immédiate)
- `✓ PASS - Algorithme dHash 64-bit` (Similarité perceptuelle 99% sur images identiques, rejet sur motifs opposés)
- `✓ PASS - Modale Reconnaissance Visuelle` (Cycle de vie, rotation canvas 90°, réinitialisation)
- `✓ PASS - Hiérarchie Boîtes & Doublons` (Alerte doublon, conservation multiple, filtrage dynamique par boîte)
- `✓ PASS - Recherche Globale & Comic Vine` (Raccourci ⌘K, suggestions réactives, fenêtre modale Comic Vine)
- `✓ PASS - Numérique retiré de l’interface, données numériques conservées et exportables`
- `✓ PASS - Catalogue normalisé` (migration additive vérifiée fiche par fiche, provenance, doublons signalés, idempotence, synchro incrémentale, retour arrière, durabilité IndexedDB, export LoCG réel si présent)
- `✓ PASS - Collector Pro : valeurs, wishlist exclue, anti-XSS, import sûr`
- `✓ PASS - Séries & complétion, pull list, sorties, stats, annulation, vue liste`
- `✓ PASS - Import CSV CLZ / League of Comic Geeks / tableur FR` (formats, conversions, doublons, assistant, annulation)
- `✓ PASS - Export Excel League of Comic Geeks (.xlsx)` (statuts collection / wishlist / lecture, volumes, variantes, annuals, recueils, réimpressions)
- `✓ PASS - Couvertures Comic Vine` (Comic Vine simulé : choix du volume, numéros, recueils, séries introuvables, mise à jour en direct, quota local, limite serveur 107)
- `✓ PASS - PWA` (sur http://localhost : manifest, icônes, service worker actif, page contrôlée, rechargement complet hors ligne, raccourci d'icône)
- `✓ PASS - Base des key issues` (26 cas : années, volumes, titres alternatifs, faux positifs connus)
- `✓ PASS - Cote automatique` (estimations cohérentes par grade / ratio / époque / key, priorités manuel & marché, historique, recalcul global, lien eBay vendus)
- `✓ PASS - Couvertures Fandom` (Fandom simulé : Cover A, variante exacte, foil approchée, 2nd printing, variante ambiguë non choisie, format Marvel, couverture manuelle intacte, mise à niveau d'une couverture standard, annulation de lot, instantané, quota, anti-XSS des légendes)
- `✓ PASS - Scanner` (lecture réelle par zxing-wasm d'un code UPC + supplément dessiné, clé de contrôle, fin des faux codes, mode continu → file à confirmer, édition confirmée → ajout direct, doublons, GCD simulé → édition exacte et image présélectionnée, apprentissage)
- `✓ PASS - Relais GCD local` (fiches lues au besoin, cache, quota 25 / h, paramètres validés)

Le runner attend activement qu'Edge expose le port CDP et que `window.Panel` soit prêt (plus de délai fixe), avec un garde-fou global de 180 s. Nécessite Node 22+ (WebSocket natif).

---

## 🎨 Design & Ergonomie Conservés
- Thème **OLED Dark** ultra-profond (`#070907`), surfaces vert sombre (`#0d140e`).
- Accents **Vert Citron / Lime Neon** (`#2bd965`, `#10b981`).
- Typographies **Space Grotesk** (titres et compteurs) et **Plus Jakarta Sans** (corps).
- Cartes verticales, badges de rareté, barres de progression et statistiques animées.
- Données locales préservées dans IndexedDB (`panel_comics_db`) et `localStorage`.
