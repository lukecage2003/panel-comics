# Panel by Primestone — Collect. Discover. Connect.

Application 100% locale, sans serveur requis, centrée sur la collection de comics physiques.

> **Partie numérique retirée (Phase 1, nov. 2026).** Panel ne lit plus et n'importe plus de fichiers PDF / CBZ / CBR. Les fichiers et données déjà stockés (IndexedDB « pages », marque-pages, notes, annotations, positions de lecture, dossiers) sont **conservés intacts** : ils restent dans les sauvegardes JSON et s'exportent en archive ZIP via « Anciens fichiers numériques » (barre latérale ou menu Plus, visible seulement s'il en existe).

**Collection Physique de Singles US & Comics** : Gestionnaire d'inventaire complet avec scanner de code-barres UPC / ISBN, scanner visuel de couvertures par empreinte perceptuelle (dHash 64-bit), hiérarchie physique de boîtes et séparateurs, détection automatique des doublons, estimation de valeur et grading.

---

## 📌 État du projet (mis à jour le 13 novembre 2026)

- **Référence produit** : [`docs/prd/PANEL_PRD_V1.md`](docs/prd/PANEL_PRD_V1.md) (D-58) : plateforme sociale de comics en trois piliers (Collection, Reading, Community), lancement francophone, modèle freemium ; roadmap en phases 0 à 6 ([`docs/prd/PANEL_ROADMAP.md`](docs/prd/PANEL_ROADMAP.md)).
- **Périmètre** : comics uniquement, éditeurs américains et français de comics. Manga, manhwa, webtoon et BD franco-belge exclus (données existantes conservées et masquées).
- **Décision d'architecture (13 novembre 2026)** : on garde ce client (`index.html` + `domains/**`), pas de migration Next.js. Backend Supabase préparé dans `backend/` (12 migrations), **non déployé** : comptes, synchronisation et communauté attendent la création du projet cloud par l'utilisateur.
- **Livré depuis le 7 novembre** : lots 3.1 et 3.1b, Explorer 2.0 local, finances F0/F1, lecture L1, catalogue commun (D-55, D-56), Event Center v2 (D-57), mode sombre (D-53). Les puces ci-dessous datent de la clôture de la Phase 2 (historique).
- **Vision (7 novembre)** : Panel by Primestone — Collect. Discover. Connect. Comics physiques uniquement (aucun lecteur ni stockage de comics numériques).
- **Architecture réelle** : application monopage locale (`index.html`, JS sans framework) ; stockage navigateur (localStorage + IndexedDB) ; relais local `serve.js` (GCD, Metron, Comic Vine) ; app Android Capacitor (`android-app/`) ; service worker hors ligne.
- **Terminé** : Phase 0 (audit), Phase 1 (stabilisation, protection des données, retrait du numérique, finitions visuelles), **Phase 2 clôturée** : lots 2.1 à 2.6 validés (le lot 2.6 « Explorer & guides de lecture » a été validé le 7 novembre 2026 après huit contrôles fonctionnels, commit `fe19e3c`). Historique détaillé : [`docs/HISTORIQUE-LOTS.md`](docs/HISTORIQUE-LOTS.md).
- **En cours** : préparation de la Phase 3 (comptes, profils, synchronisation local-first). Conception livrée dans [`docs/phase3/`](docs/phase3/), en attente de validation ; aucun code de la Phase 3 n'est écrit.
- **Index de la documentation** : [`docs/README.md`](docs/README.md) (dont le plan directeur 2.0, [`docs/directeur/`](docs/directeur/04-backlog-feuille-de-route-decisions.md)).
- **Feuille de route** : [`docs/ROADMAP.md`](docs/ROADMAP.md) ; journal des décisions : [`docs/DECISIONS.md`](docs/DECISIONS.md) ; plan d'exécution : [`docs/phase4/08-plan-execution.md`](docs/phase4/08-plan-execution.md). Le lot 2.7 un temps envisagé n'a pas été réalisé : la Phase 2 se clôt au lot 2.6.
- **Limites connues conservées de la Phase 2** : le guide King in Black est une démonstration non exhaustive ; les sources d'images sous licence restent à identifier ; les correspondances VO/VF sont en partie non vérifiées ; les actualités ne sont pas activées (pas de source ni de CMS) ; ReadingOrders.com, Comic Compass et French Comics Reading Order n'ont pas été consultés.
- **Tests** : `node run-all-tests.js` (Edge sans interface), 52 tests (au 13 novembre 2026) ; domaines : `npm run test:domains` (55). Base de données : `npm run test:db` (PGlite, sans Docker) ; secrets : `npm run check:secrets` ; frontières : `npm run check:boundaries`.
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
- **Exemplaires et variantes (lot 2.2)** : chaque exemplaire du catalogue porte une forme normalisée (`normalized`) :
  - grading : note, estimée ou certifiée, société (CGC, CBCS, PGX ou EGS), slab, étiquette (Universal, Signature Series, Qualified ou Restored) et n° de certificat ;
  - signature : signataire et authentification ;
  - achat : prix, devise, date et lieu.

  Ces valeurs sont lues dans les champs explicites, puis dans l'état texte, puis dans les mentions des notes laissées par les imports. La fiche d'origine n'est pas modifiée. Le schéma du catalogue passe à 2, et une migration avec sauvegarde est relancée une fois au démarrage.
- **Regroupement** : les cartes et la liste affichent « ×N » quand une variante a plusieurs exemplaires possédés. La fiche détaillée liste tous les exemplaires de la même variante. Le calcul est local et fonctionne aussi après un retour arrière du catalogue.
- **Saisie** : un bloc « Grading, slab et signature » et un champ « Acheté chez » complètent le formulaire. La liste « Condition / Grading » reste synchronisée avec la société et la note. Les nouveaux champs ne sont écrits que s'ils sont remplis. L'import CSV renseigne aussi `signedBy`, `certNumber` et `store`, sans retirer les notes.
- **Restauration JSON fidèle** : les champs d'une fiche qui n'étaient pas listés sont désormais conservés lors d'une restauration. Auparavant, ils étaient perdus : provenance des couvertures, historique, codes-barres, identifiants Metron/GCD, grading. Seuls les valeurs simples et quelques objets connus et vérifiés sont repris.
- **Emplacements (lot 2.3)** : hiérarchie **Pièce → Meuble → Boîte → Séparateur**, enregistrée une seule fois dans `localStorage` (`panel_locations`) avec une copie IndexedDB (`panel-catalog` / `meta` / `locations`, même révision, reprise automatique si le stockage local est perdu).
  - **Identifiants** : chaque élément a un identifiant stable et des dates de création et de modification. Un exemplaire référence son emplacement par identifiant (`locationId`, `locationAt`, et `locationHistory` qui garde les 10 derniers). L'affectation peut être partielle (une pièce seulement, par exemple) ou absente.
  - **Migration** : les anciens champs `box`, `divider` et `location` sont rattachés par une table de correspondance, sans modifier les fiches ni leurs dates. Une sauvegarde complète et un instantané sont faits avant, et la migration peut être relancée sans effet. Les écritures identiques sont regroupées (casse, accents, espaces).
  - **Valeurs ambiguës** : une valeur contenant un chemin (`/`, `>`, `|`), un séparateur sans boîte, une pièce sans meuble ou un nom porté par plusieurs boîtes n'est jamais transformé. Ces valeurs sont listées comme « non résolues » dans le gestionnaire, qui permet de les affecter.
  - **Gestionnaire** (« Gérer les emplacements », filtre Rangement) :
    - création, renommage, description, type de meuble, capacité de boîte ;
    - réorganisation et déplacement d'un élément vers un autre parent ;
    - nombre de comics par niveau, emplacements vides, recherche ;
    - contenu d'un emplacement, avec déplacement groupé.
  - **Suppression sécurisée** : la suppression est refusée tant qu'il reste des sous-emplacements. Les comics rangés sont soit réaffectés, soit gardés avec leur emplacement précédent, affiché « (supprimé) ». L'élément est conservé comme pierre tombale. Aucun exemplaire n'est supprimé.
  - **Formulaire** : une sélection progressive Pièce → Meuble → Boîte → Séparateur, où chaque choix filtre le suivant et où l'on peut s'arrêter à n'importe quel niveau. Le dernier emplacement utilisé est proposé. La saisie libre en texte reste disponible. Un nouveau comic n'est plus placé d'office dans « Short Box 1 ».
  - **Affichage** : le chemin complet apparaît sur les cartes, dans la liste et dans la fiche. Le filtre Rangement et la recherche trouvent un comic par son emplacement.
  - **Imports et exports** :
    - CSV : colonnes Pièce, Meuble, Boîte et Séparateur reconnues à l'import et ajoutées à l'export ;
    - JSON : sauvegarde et export contiennent toute la hiérarchie, la restauration la reconstruit sans doublon et sans supprimer d'emplacement existant ;
    - un réimport répété ne crée aucun doublon.
- **Échec de migration** : la collection n'est pas touchée et le catalogue est vidé. Aucune nouvelle tentative automatique n'a lieu tant que la collection n'a pas changé (`Panel.catalog.enable()` force une nouvelle tentative). Les sauvegardes `panel-catalog.backups` ne sont jamais supprimées automatiquement.
- **Retour arrière** (testé) : `Panel.catalog.rollback()` vide uniquement la base dérivée `panel-catalog`. Les sauvegardes, les instantanés et la collection ne sont pas touchés, et la migration automatique est désactivée (`panel_catalog_disabled`). `Panel.catalog.enable()` la relance. Pour revenir au code d'avant le lot 2.1, il suffit de revenir au commit `8b04cb3` : l'ancien code ignore simplement la base `panel-catalog`.
- **Contrôle** : « Vérifier les données » (menu Plus) affiche l'état du catalogue et le nombre de doublons signalés. L'API de test est `Panel.catalog.{status, verify, read, sync, migrate}`.

## 📅 Calendrier international, Pull List et Wishlist (Phase 2 · lot 2.4)

### Modèle
- **Publication** (donnée de catalogue, IndexedDB `panel-catalog` / `publications`, identifiant `pbc_…` stable). Elle contient :
  - titre, série, numéro, variante, éditeur ;
  - marché (`US`, `FR`, extensible), langue et format (single, album, TPB, hardcover, intégrale, omnibus, deluxe, kiosque, manga, autre) ;
  - dates séparées : annoncée initialement, annoncée actuellement, confirmée (si connue) et dernière vérification ;
  - historique des changements de date, avec la source et la date du constat ;
  - couverture avec sa provenance, identifiants externes (Comic Vine, Metron, GCD, ISBN, UPC…) et sources ;
  - lien vers le catalogue normalisé (`iss_…`, `var_…`).
- **Une édition française et le numéro américain sont deux publications distinctes.** Le marché fait partie de l'identité. Elles sont reliées par une **relation éditoriale explicite** : traduit depuis, adaptation de, réédition de, compilation de, contient.
  - Aucune relation n'est créée automatiquement.
  - La fiche propose des suggestions (autre marché, titre proche), que l'utilisateur doit confirmer.
- **Statuts calculés** : Annoncé, À venir (31 jours ou moins), Disponible, Reporté (dernier changement = report), Annulé, Date inconnue. Panel n'invente jamais de date.
- **Exemplaire physique** : inchangé (lots 2.2 et 2.3). Un exemplaire créé depuis le calendrier garde `pubId`, et `pullId` s'il vient de la Pull List.
- **Intention d'achat** :
  - **Wishlist** : fiches existantes `isWishlist`, enrichies d'un objet `wish` (priorité, statut Souhaité / Recherche active / Trouvé / Abandonné, prix cible, dates, origine, publication liée). Les anciennes entrées reçoivent des valeurs par défaut à la lecture ; aucune fiche n'est réécrite.
  - **Pull List** : IndexedDB `pulls`. Chaque entrée est un numéro précis, avec variante, quantité, statut (Prévu, Disponible, Récupéré, Annulé), historique, et `ownerId` du profil local.
- **Préparation des comptes (phase 3)** : un profil local à identifiant stable (`usr_local_…`) est créé. Les données personnelles (pull list, wishlist, exemplaires) restent séparées du catalogue (publications) et reliées par identifiants. Aucun backend, aucun compte.

### Moteur et connecteurs
- **Architecture indépendante du fournisseur** : chaque connecteur récupère puis normalise ses données. Le moteur rapproche ensuite chaque publication de l'existant :
  1. par identifiant externe ;
  2. sinon par clé exacte (marché, éditeur, série, numéro, format, variante) ;
  3. jamais par ressemblance. Un cas ambigu est créé à part et signalé comme doublon possible.
- **Ce que le moteur détecte** : nouvelles publications, reports et avancées, annulations, rétablissements.
- **Absence dans une réponse** : la publication est marquée « non revue », jamais annulée.
- **Erreurs** : en cas d'erreur, rien n'est modifié. L'erreur est inscrite dans un journal de synchronisation (50 dernières entrées).
- **Connecteurs réellement opérationnels** :

  | Connecteur | Marchés | Fonctionnement | Limite |
  |---|---|---|---|
  | Comic Vine (API) | États-Unis | Actualisation **manuelle** (bouton) ou à l'ouverture d'une semaine non vue depuis 12 h ; éditeur lu via les volumes | Clé requise ; **usage non commercial uniquement** (conditions Comic Vine), 200 requêtes / ressource / heure ; dates non confirmées |
  | Import contrôlé CSV / JSON | Tous | Planning éditeur, export d'un autre outil, export Panel | Données fournies par l'utilisateur |
  | Saisie manuelle | Tous | Fiche publication | — |

- **Aucune mise à jour automatique en arrière-plan.** Le calendrier affiche la date de la dernière actualisation. Hors ligne, il affiche les dernières données enregistrées.
- **Sources étudiées et non intégrées** (novembre 2026) :
  - **Metron** : API gratuite qui filtre par date de mise en vente. Elle demande un compte (identifiants), donc une autorisation est nécessaire avant de l'utiliser pour le calendrier.
  - **Marvel API** : statut actuel non confirmé ; usage commercial soumis à l'accord de Marvel.
  - **Sollicitations éditeurs, Lunar, PRH Comics** : sites web ou fichiers réservés aux libraires. Pas d'API publique, et le scraping est exclu.
  - **BnF (SRU)** : Licence ouverte, réutilisation gratuite y compris commerciale. Les notices arrivent après le dépôt légal ; c'est donc une piste pour confirmer une date ou un ISBN, pas pour annoncer une sortie. Le service n'est pas appelable directement depuis le navigateur sans relais.
  - **Electre, Dilicom** : données des livres « à paraître » en France, sous abonnement payant (exclu sans autorisation).
  - **Sites Panini, Urban, Delcourt, Glénat** : plannings publiés en HTML, sans API ; exclus comme fondation (scraping fragile).
  - **Conséquence** : le marché francophone est alimenté par import contrôlé et saisie manuelle.

### Interface
- **Vue « Calendrier & pull list »** :
  - affichages : cartes de la semaine, calendrier mensuel (sur mobile, points de couleur et liste détaillée dessous), liste chronologique, regroupements par éditeur, par série ou par marché ;
  - périodes : semaine, mois, 3 mois, toutes les dates ;
  - filtres : marché, éditeur, format, statut, série ou titre, « ma pull list » ;
  - date annoncée en pointillés, date confirmée en trait plein.
- **Fiche publication** :
  - dates et historique, sources et identifiants, relations, nombre d'exemplaires possédés ;
  - actions : Pull List (variante, quantité), Wishlist, Collection, Modifier.
- **Pull List** :
  - ajout depuis le calendrier ou en saisie manuelle (la publication est créée si elle n'existe pas) ;
  - modification de la variante et de la quantité, historique ;
  - Récupéré : crée un exemplaire distinct par unité dans la collection, ou convertit l'entrée wishlist de la même publication. Une seconde demande ne crée rien ;
  - → Wishlist ; Annuler / Rétablir (rien n'est supprimé) ;
  - les « séries suivies » (★, ancienne pull list par série) sont conservées.
- **Wishlist** : priorité, statut et prix cible modifiables dans la fiche. « Je l'ai acheté » garde la même fiche, au statut « Trouvé ». « Ajouter à la wishlist » depuis un exemplaire possédé crée une **nouvelle** entrée : l'exemplaire reste dans la collection, ce qui remplace l'ancien basculement qui le retirait.

### Transitions
- **Calendrier → Pull List**
- **Catalogue ou calendrier → Wishlist** : sans doublon pour une même variante.
- **Catalogue ou calendrier → Collection** : une entrée wishlist de la même publication est convertie.
- **Wishlist → Collection**
- **Pull List → Collection** : idempotente.
- **Pull List → Wishlist** : la sélection est conservée, annulée, dans l'historique.
- **Collection → Wishlist**

Aucune transition ne supprime de donnée d'origine, et rien n'est fusionné quand l'identité n'est pas certaine.

### Imports, exports, migration
- **JSON (sauvegarde et export)** : bloc `releases` (publications, pull list, profil, état de synchronisation). La restauration fusionne ou remplace sans jamais supprimer, et ne crée pas de doublon.
- **CSV collection** : colonnes Priorité wishlist, Statut wishlist et Prix cible (reconnues à l'import).
- **CSV calendrier** : export et réimport sans doublon.
- **Restauration** : l'historique des emplacements (`locationHistory`) est désormais conservé.
- **LoCG, CLZ, XLSX** : inchangés.
- **Migration** :
  - IndexedDB `panel-catalog` passe en version 3 et ajoute deux magasins vides ;
  - le schéma de migration du catalogue reste 2, donc aucune nouvelle migration n'est lancée ;
  - aucune donnée existante n'est transformée ;
  - copie du code avant le lot : `_backups/20261107-lot24-avant/`.
- **API** : `Panel.releases.{upsert, edit, query, sync, importText, exportCsv, exportData, addRelation, suggest, pulls.*, wish.*}`.

## 🛰️ Sources de données, provenance et import contrôlé (Phase 2 · lot 2.5)

Accès : bouton **Sources & données** dans le rail latéral, ou bouton **Importer un calendrier** du calendrier. Le panneau a cinq onglets : Sources, Importer, Conflits, Journal, Provenance.

### Matrice des sources (relevé du 7 novembre 2026)
États : **Fonctionne** · **Prêt — identifiants requis** · **Abonnement ou autorisation requis** · **Non disponible**. Les onze critères de chaque source (couverture, API, licence, usage commercial, coût, attribution, stockage, cache, images, limites, fiabilité) sont affichés dans l'onglet Sources et exposés par `Panel.data.sources()`.

| Source | Marché | Type | État | Usage commercial |
|---|---|---|---|---|
| Comic Vine (API) | US | Base tierce | Prêt — clé requise (fonctionne avec clé) | Non commercial uniquement |
| Import contrôlé CSV / JSON / XLSX | Tous | Import utilisateur | Fonctionne | Sous conditions (selon l'origine du fichier) |
| Saisie manuelle | Tous | Saisie | Fonctionne | Compatible |
| Metron (API) | US | Base tierce | Non disponible (compte requis, licence non vérifiée) | Informations insuffisantes |
| Grand Comics Database | International | Base tierce | Non disponible pour le calendrier | Sous conditions (CC BY-SA 4.0, couvertures exclues) |
| Marvel Comics API | US | Éditeur | Non disponible (statut du portail non confirmé) | Autorisation écrite |
| Sites DC, Image, Dark Horse, IDW, BOOM!, Dynamite | US | Éditeur | Autorisation requise (aucune API, scraping exclu) | Autorisation écrite |
| PRH Publisher Services (Marvel), Lunar (DC), Diamond / Universal | US | Distributeur | Autorisation requise (comptes libraires) | Autorisation écrite |
| Sites Panini, Urban, Delcourt, Glénat | FR | Éditeur | Autorisation requise | Autorisation écrite |
| BnF (SRU, data.bnf.fr) | FR | Base tierce | Non disponible (relais requis ; après parution seulement) | Compatible (Licence Ouverte, mention de la source) |
| Electre Data Services | FR | Base tierce | Abonnement requis | Autorisation écrite (contrat) |
| Dilicom (FEL) | FR | Distributeur | Abonnement professionnel requis | Autorisation écrite |
| Open Library | International | Base tierce | Non disponible | Informations insuffisantes |
| Google Books API | International | Base tierce | Non disponible | Autorisation écrite |
| League of Comic Geeks, CLZ | US / International | Base tierce | Non disponible (export personnel importable) | Incompatible comme source |

- **Stratégie retenue** : calendrier US par Comic Vine en usage personnel ; calendrier francophone et plannings éditeurs par import contrôlé et saisie. Les sources sous contrat (Electre, Dilicom, distributeurs, éditeurs) demandent un accord écrit avant toute intégration. La BnF est la seule source gratuite compatible commercialement, mais elle ne couvre que l'après-parution.
- **Aucun connecteur fictif** : seuls Comic Vine, l'import et la saisie ont un connecteur. Les autres sources sont documentées, pas simulées.
- **Activer / désactiver** : Comic Vine et l'import se désactivent dans l'onglet Sources. Une source désactivée n'est jamais interrogée, pas même par l'actualisation à l'ouverture d'une semaine.
- **Édition commerciale** : `panelEdition = 'commercial'` bloque automatiquement les sources « non commercial », « autorisation écrite », « incompatible » et « informations insuffisantes ». L'édition actuelle est **personnelle**.
- **Images** : les droits sur les métadonnées n'incluent pas les droits sur les couvertures. Chaque couverture garde sa source et une mention de droits ; une couverture manuelle n'est jamais remplacée par une source.

### Provenance par champ
- Chaque publication porte `prov[champ]`, avec : valeur, source, type de source (éditeur, distributeur, base tierce, import utilisateur, saisie manuelle, déduit), référence externe, date de récupération, date de dernière vérification, historique (20 valeurs), statut (vérifié / non vérifié) et confiance (élevée, moyenne, faible).
- Champs suivis : titre, éditeur, langue, lien, date annoncée, date confirmée, couverture, ISBN, UPC et identifiants Comic Vine, Metron, GCD, LoCG et CLZ.
- Une valeur confirmée par une seconde source passe en « vérifié » (`confirmedBy`).
- Les fiches antérieures au lot 2.5 ne sont pas réécrites : leur provenance est déduite à l'affichage et marquée « antérieur (non tracé) ».

### Conflits et doublons
- **Priorité des valeurs** : saisie manuelle > éditeur > distributeur > base tierce = import utilisateur > déduit.
- **Règles d'application** :
  - une source moins fiable n'écrase jamais une valeur : elle ouvre un conflit ;
  - une source corrige librement sa propre valeur ;
  - une date peut être reportée par une source de même rang (cas d'un report d'éditeur) ;
  - l'éditeur, qui fait partie de l'identité, n'est jamais modifié par une source.
- **Résolution** (onglet Conflits ou fiche publication) : garder la valeur actuelle, prendre la valeur proposée, ou saisir une autre valeur. Une modification manuelle règle les conflits du champ concerné. Un même conflit n'est jamais ouvert deux fois.
- **Rapprochement** : identifiant Panel, puis identifiant externe fiable (Comic Vine, Metron, GCD, LoCG, CLZ), puis ISBN / UPC, puis correspondance exacte (marché, éditeur, série, numéro, format, variante). Jamais par ressemblance de titre.
- **Identifiants contradictoires** (deux fiches désignées) : rien n'est créé ni fusionné ; un conflit d'identité est ouvert.

### Pipeline d'import
1. Lecture : CSV (`;` ou `,`), JSON (liste, export Panel ou sauvegarde) ou XLSX (première feuille).
2. Correspondance des colonnes, automatique puis modifiable. Une colonne non associée est conservée dans `extra`.
3. Validation : série manquante, date illisible, marché ou éditeur inconnu, couverture non https, date absente. Aucune date n'est inventée.
4. Aperçu ligne par ligne, sans rien écrire : nouvelle, mise à jour (avec le détail des champs), identique, conflit, doublon possible, doublon dans le fichier, invalide.
5. Application, puis rapport (ajouts, mises à jour, inchangées, conflits, doublons, invalides, colonnes inconnues, erreurs). Un aperçu ne s'applique qu'une fois.
6. Annulation sûre : un instantané est conservé (`meta/relimport_<id>`). L'annulation retire les fiches créées et restaure les fiches modifiées. Elle n'y touche pas si la fiche a été modifiée depuis, ou si elle est utilisée (pull list, exemplaire, relation).

L'import alimente le catalogue des publications : calendrier, éditeurs, séries et relations. Il ne modifie jamais la collection, la wishlist ni la pull list.

### Actualisation
Aucune synchronisation périodique et aucun backend. Pour chaque source, l'onglet Sources affiche :
- la dernière actualisation et son résultat (ajouts, modifications, conflits ou erreur) ;
- le nombre de publications ;
- les conflits ouverts.

Le Journal garde les 50 dernières opérations : actualisations, imports, annulations, activations.

### Sauvegarde et API
- **Sauvegarde JSON** : le bloc `releases` contient la provenance, les champs inconnus, les conflits et le réglage des sources. À la restauration, les types de source invalides, les champs non suivis et les conflits mal formés sont écartés ; les conflits sont fusionnés sans doublon.
- **API** : `Panel.data.{sources, setEnabled, edition, plan, apply, undo, imports, conflicts, resolve, provenance, stats, open}`.
- **Sauvegarde du code avant le lot** : `_backups/20261107-da-lot25-avant/`.

## 🧭 Explorer et guides de lecture (Phase 2 · lot 2.6)

Accès : entrée **Explorer & guides** du rail latéral, ou onglet **Explorer** de la barre des vues (mobile compris). Le lot est **validé** (7 novembre 2026, commit `fe19e3c`).

### Page Explorer
- **Recherche globale** : une seule saisie couvre les guides et événements (titres VO/VF et alias, par exemple « Le Roi en Noir »), les publications du calendrier, la collection (titre, numéro, ISBN, UPC), les séries, les personnages, les créateurs, les éditeurs, ainsi que les éditions et recueils. Les résultats sont groupés par catégorie, avec un filtre par catégorie et un état vide explicite. Les recherches validées sont mémorisées localement (`panel_explorer_recent`, 8 au plus). Il n'y a pas de moteur séparé : la recherche s'appuie sur `catNorm` et sur les données déjà chargées.
- **Sections** :
  - **Pour vous** : suggestions déterministes et expliquées, calculées à partir de la progression, des possessions et de la pull list. Aucun service d'IA.
  - **À la une** : uniquement les guides marqués « À la une ».
  - **Guides de lecture** : avec filtre par catégorie.
  - **Univers** : Marvel, DC, Image, Dark Horse, IDW, BOOM!, Dynamite et les éditeurs de la collection, chacun avec une page.
  - **Sorties** : réutilise `relQuery` du lot 2.4 (30 prochains jours US et FR, 14 derniers jours).
  - **Personnages**, **Créateurs**, **Séries**.
  - **Actualités** : structure seulement. Aucune actualité n'est inventée ; la section attend des contenus éditoriaux de type `news` ou une future source (CMS).
- **Pages de découverte** : éditeur (guides, sorties à 60 jours, séries, personnages, créateurs), personnage (guides où il est cité, statut de vérification), créateur (guides, collaborations citées, couvertures de la collection), série (numéros possédés, variantes, publications, guides). Seules les données présentes dans Panel sont affichées : pas de biographie ni de chronologie non sourcée.

### Guides de lecture
- **Fiche** : titre, titre original, éditeur, période, synopsis sans spoiler et zone spoiler séparée, description et notes de complétude, image, personnages, créateurs, prérequis, événements précédents et suivants, langues, sources, dernière vérification et complétude (complet selon les sources / partiel / démonstration).
- **Catégories** : événement majeur, crossover, saga, chronologie, parcours de personnage, grande période, guide de série, parcours de découverte.
- **Ordres** : plusieurs par guide (source, publication, chronologique, recommandé, simplifié, complet). Chaque ordre cite sa source ; un ordre dérivé indique son ordre d'origine. Aucun ordre n'est fusionné entre sources.
- **Entrée** : position, série, volume, numéro, éditeur, année, lien de publication (`pubId`), couverture, explication, importance, source de l'importance, spoiler, prérequis, source, éditions associées.
- **Importance** : Essentiel / Recommandé / Facultatif seulement avec une source ou une décision éditoriale explicite. Sinon, l'entrée reste « Non classé » ; un niveau sans source est retiré à l'enregistrement et à l'import.
- **Consultation** :
  - parcours numéroté avec couvertures en chargement différé, progression globale et par niveau, bouton « Reprendre » (première entrée ni lue ni ignorée) ;
  - filtres par importance, éditeur et langue (VO / avec édition VF) ; masquer les facultatifs, masquer les lus ; mode simplifié ;
  - spoilers masqués par défaut ;
  - accès à la fiche publication, ajout à la wishlist pour une publication identifiée.

### Premier cas : King in Black (démonstration documentée)
- **Ordre de la source** : 65 numéros relevés sur Comic Book Reading Orders (consulté le 7/11/2026). Seuls les faits sont repris : titres, numéros, ordre et classement requis / facultatif. La série *King in Black* et les numéros *Venom* sont « Essentiel » (requis selon la source), soit 10 entrées ; les 55 autres sont « Facultatif ». Aucun « Recommandé » n'est attribué.
- **Ordre simplifié** : dérivé de l'ordre de la source (requis seulement), avec sa provenance.
- **Contexte** (Comic Book Herald) : préparation recommandée par la série *Venom* de Cates et Stegman ; précédé d'*Absolute Carnage* (2019).
- **Personnages et créateurs** : marqués « non vérifié ».
- **Éditions françaises** : *King in Black : Venom* n°01 (ISBN 9791039100632) et n°02 (ISBN 9791039102056), relevées sur une fiche de libraire. Elles restent « non vérifiées » et sans contenu associé : leur sommaire exact n'est pas confirmé. Les autres ISBN trouvés (sites de partage, coffret sans ISBN) ont été écartés.
- **Images** : aucune image des sites de référence n'est reprise. Le guide utilise un visuel généré par Panel ; chaque entrée affiche la couverture de la fiche publication ou de la collection quand le rapprochement est sûr, sinon la couverture de remplacement Panel.
- **Sources non atteintes** : ReadingOrders.com, Comic Compass et French Comics Reading Order n'ont pas été consultés. Le guide ne prétend pas être exhaustif.
- **Contenu fourni avec Panel** : il est ajouté s'il manque. Il n'est mis à jour que s'il n'a jamais été modifié localement (`seedVersion`, `editedAt`).

### Correspondances VO / VF et rapprochements
- **Relations d'édition typées** : traduction de, réédition de, recueil de, contient, partie de, variante de. Une édition ne passe en « Vérifié » qu'avec une source ; l'association aux entrées se fait par position, explicitement.
- **Entrée → publication** : d'abord le `pubId` explicite, sinon une correspondance exacte (même série de base, sans « (2021) » ni « Vol. n », même numéro, année à ±1 an, publication unique et non variante).
- **Entrée → collection** : même règle, sans année = « Possédé ? (à confirmer) », qui n'est pas compté comme possédé. Aucun rapprochement par ressemblance de titre.
- **Une entrée non identifiée reste « Non identifiée au catalogue »** ; aucune publication n'est créée.

### Intégration à la collection et progression
- **États distincts par entrée** :
  - possédé (×n), possédé à confirmer, manquant ;
  - rangé ;
  - wishlist ;
  - pull list ;
  - fiche publication.
  Posséder n'implique jamais avoir lu ; la wishlist n'est pas la collection.
- **Progression personnelle** (`readprog`) : À lire, En cours, Lu, Ignoré, avec historique (30 changements). Elle est indépendante des données éditoriales et de la possession, et partagée entre les guides qui contiennent le même numéro (clé `ek_` + empreinte série/volume/numéro). Un exemplaire marqué lu dans la collection apparaît « Lu (collection) » sans écrire de progression.
- **Réutilisation** : `addPubToWishlist`, `openPubSheet`, `relQuery`, `placeholderCover`. Aucun service dupliqué.

### Administration, import et export
- **Éditeur** (bouton « Modifier » ou « Créer un guide ») :
  - métadonnées, image (https) avec source et droits, personnages, créateurs, prérequis, sources ;
  - plusieurs ordres ; entrées ajoutées, déplacées ou retirées ; importance et sa source ; spoiler ; `pubId` ;
  - éditions VO/VF avec relation, source, statut et entrées contenues.
  Le brouillon est validé à l'enregistrement.
- **Import JSON** (`{ "format": "panel-guides", "version": 1, "guides": [...] }`) :
  - lecture et validation du schéma (identifiants `gd_…`, URL https seulement, champs bornés) ;
  - aperçu sans écriture : nouveau, mise à jour, identique, doublon (même identifiant dans le fichier, ou même titre et éditeur qu'un guide existant), invalide ;
  - confirmation, puis résumé. La progression de lecture n'est jamais modifiée par un import.
- **Export** : un guide ou tous les guides, en conservant les identifiants, les relations et la provenance.

### Stockage, migration et sauvegarde
- **IndexedDB `panel-catalog` passe en version 4** : migration additive des magasins `editorial` (index `kind`) et `readprog`. Les magasins existants ne sont ni supprimés ni réécrits, et la migration est idempotente.
- **Retour arrière** : un code antérieur ne peut pas ouvrir une base en version 4. Les fonctions du catalogue y seraient désactivées, la collection (localStorage) restant intacte. Pour revenir en arrière : sauvegarde JSON, puis code de `_backups/20261107-lot26-avant/`.
- **Sauvegardes JSON** : la sauvegarde complète et l'export de la collection contiennent un bloc `explorer` (guides et progression). À la restauration, ce bloc est validé ; la fusion ajoute sans écraser, le remplacement rétablit, et l'opération est annulée en cas d'échec. Les anciennes sauvegardes sans bloc `explorer` restent acceptées.
- **API** : `Panel.explorer.{load, open, state, guides, guide, save, validate, search, setProgress, progress, entryKey, stats, match, recos, exportGuides, importPlan, importApply, planInUi, editor, backup, restore}`.
- **Sauvegarde du code avant le lot** : `_backups/20261107-lot26-avant/`.

### Sécurité et performances
- **Sécurité** : tout texte est échappé ; les URL d'images et de sources n'acceptent que https ; les liens externes sont en `noopener noreferrer`. Aucune clé, aucune collecte automatique, aucun téléchargement d'images depuis les sites de référence.
- **Performances** : les couvertures sont chargées en différé (`loading="lazy"`), avec une image de remplacement en cas d'erreur. La liste est affichée par tranches de 60 entrées, la recherche est temporisée (160 ms) et les données sont chargées une seule fois en mémoire.

## 🗄️ Backend (Phase 3 · lot 3.1)
Fondations du futur backend, **sans compte cloud ni envoi réseau** : schéma PostgreSQL compatible Supabase (schéma `app`, 11 tables, RLS sur toutes les tables, révision serveur par utilisateur), versionné dans [`backend/`](backend/) et testé sans Docker grâce à PGlite.

```bash
npm ci
npm run test:db
npm run check:secrets
```

Côté application, `Panel.sync.readiness()` décrit en lecture seule ce qui serait synchronisé, par domaine (Collection, Lecture, Explorer, application). La synchronisation est désactivée (`PANEL_SYNC_ENABLED = false`). Détails : [`backend/README.md`](backend/README.md) ; runbooks : [`docs/phase3/runbooks/`](docs/phase3/runbooks/).

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
- **Pull list & sorties** : remplacées par le calendrier international du lot 2.4 (voir « Calendrier international, Pull List et Wishlist »).
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
- `✓ PASS - Explorer & guides de lecture` (base IndexedDB v4 additive, King in Black sourcé sans niveau inventé, validation, rapprochements exacts et « à confirmer », possession ≠ lecture ≠ wishlist, progression partagée, recherche par catégorie et historique, pages éditeur/personnage/créateur/série, filtres et mode simplifié, spoilers, XSS, image de remplacement, éditeur, import JSON avec aperçu et doublons, export, sauvegarde/restauration, redémarrage)
- `✓ PASS - Sources & données` (matrice des sources, connecteurs activables, blocage en édition commerciale, provenance par champ, conflits sans écrasement silencieux, résolution, doublons par priorité, import CSV/JSON/XLSX avec aperçu, correspondance, rapport, annulation sûre, sauvegarde, redémarrage)
- `✓ PASS - Calendrier international` (publications US/FR et relations explicites, connecteur simulé, import CSV/JSON, reports, annulations, dates inconnues, historique, Pull List, Wishlist, transitions sans doublon, sauvegarde/restauration, vues, redémarrage hors ligne)
- `✓ PASS - Emplacements` (4 niveaux, migration sûre et idempotente, valeurs ambiguës, affectation complète/partielle, déplacements, suppression sans perte, comptage, recherche, JSON/CSV, redémarrage hors ligne)
- `✓ PASS - Exemplaires et variantes` (normalisation état/grading/slab/signature/achat, regroupement par variante, saisie structurée, restauration JSON fidèle)
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
