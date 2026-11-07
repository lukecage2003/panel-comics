# Plan directeur 2.0 · 03 — Produit, UX/UI, architecture cible, opportunités

Statut : **proposition à valider** (7 novembre 2026).

Ce document **complète** les documents qui font autorité ; il ne les remplace pas :
- frontières : [`phase4/02`](../phase4/02-frontieres-collection-explorer.md) ;
- contrats : [`phase4/05`](../phase4/05-contrats-s1-s6.md) ;
- sauvegardes : [`phase4/06`](../phase4/06-sauvegardes-par-domaine.md) ;
- images : [`phase4/07`](../phase4/07-architecture-images-r2.md) ;
- navigation : [`phase4/03`](../phase4/03-changement-navigation.md) ;
- Phase 3 : [`phase3/`](../phase3/README.md).

En cas de contradiction, ces documents priment, et la contradiction doit être signalée.

Légende :
- **[Fait]** : constaté dans le code ;
- **[Doc]** : décidé ou documenté ;
- **[Reco.]** : recommandation ;
- **[Source]** : fait externe sourcé (§ 5) ;
- **[Interp.]** : interprétation.

## 1. Plan produit : quatre domaines

| | **Collection** | **Lecture** | **Explorer** | **Community** |
|---|---|---|---|---|
| Mission | Savoir ce que je possède, où, en quel état, pour quel coût et quelle valeur estimée | Savoir ce que j'ai lu, quand, ce que j'en ai pensé, et ce que je lis ensuite | Découvrir les **comics** : sorties, séries, créateurs, événements, Key Issues, guides | Partager et échanger entre lecteurs et collectionneurs |
| Utilisateurs | Collectionneur, acheteur régulier | Lecteur, y compris celui qui ne possède pas l'œuvre | Tout visiteur, avec ou sans compte | Utilisateurs connectés uniquement |
| Données propres | Exemplaires, wishlist, emplacements, Pull List (A5), acquisitions et sorties (F1), finances | Progression **par œuvre**, journal daté, notes et critiques personnelles, objectifs | Catalogue éditorial **comics** (D-12), sorties, événements, guides, images (R2) | Profils publics, listes partagées, commentaires, modération |
| Ne contient pas | Données éditoriales maîtres, progression de lecture (à terme, A3) | Exemplaires ni prix | Données personnelles ; « Ma collection » (A7) | Données privées non publiées par l'utilisateur |
| Parcours clés | Scanner → fiche → ranger → compléter coût et état → suivre la valeur | Marquer lu → noter → journal → série suivante | Chercher → fiche → suivre la série → ajouter à la wishlist (via S2) | Publier une liste → commentaires → découverte |
| Interactions | Fournit S1 (statut de possession) à Explorer ; reçoit S2 (ajout depuis Explorer) | Fournit la progression à Explorer via S1 ; lit l'identité d'œuvre d'Explorer | Lit S1 ; émet S2 ; publie S4 et S5 | Lit uniquement ce que l'utilisateur publie (S6) |
| Limites | Pas de conseil d'investissement ; pas de cote présentée comme certaine | Pas de lecture numérique (exclue) | Pas d'encyclopédie générale ; pas de mangas (D-12) | Pas avant les comptes, la modération et la validation juridique |
| Évolution | F0 → F1 → synchronisation (3.4) | Création du domaine au lot 3.1b (fournisseur) puis lot L1 (écran) | Lots 4.1 à 4.11 | C-0 puis C-1… |

**Indépendance et cohérence [Doc]**
- Chaque domaine a son stockage, sa sauvegarde (B1) et ses écrans.
- Ils ne communiquent que par les contrats S1 à S6.
- L'**identité d'œuvre** (série et numéro normalisés, `pubId` / `catalog_id`) est la clé commune. Elle sert de référence, jamais de copie maîtresse.

**Ajout du plan directeur [Reco.]** : la Lecture a besoin d'une **identité d'œuvre** indépendante de l'exemplaire, pour qu'on puisse lire sans posséder.
- Proposition : réutiliser l'identifiant de catalogue d'Explorer, avec un repli local (série normalisée et numéro).
- Ce n'est **pas un nouveau contrat** : c'est déjà la clé de S1 (voir [`05`](../phase4/05-contrats-s1-s6.md)).
- À confirmer par la décision **U-D3**.

## 2. Audit par domaine (synthèse)
Le détail est dans [`01`](01-etat-des-lieux-et-audit.md) § 2 et dans [`02`](02-audit-financier.md) pour les finances.

| Domaine | Principaux problèmes | Priorité |
|---|---|---|
| Collection | Calculs financiers (F-01 à F-05, F-10, F-11) ; modèle sans frais, devise, lots ni sorties | P0 / P1 |
| Lecture | Lecture par exemplaire ; double progression `isRead` / `readprog` ; aucun écran | P1 |
| Explorer | Perçu comme une vue de Collection (C1, l. 1879) ; contenu dérivé de la collection ; mangas dans les Sorties | P1 (lot 3.1b) |
| Community | Inexistant (normal) ; risque d'entrée prématurée | P3 |

## 3. Plan UX/UI

### 3.1 Parcours de bout en bout
**Découvrir → ajouter → acheter → lire → progresser → statistiques → partager.**

| Étape | Domaine | Aujourd'hui [Fait] | Cible [Reco.] |
|---|---|---|---|
| Découvrir | Explorer | Calendrier et recherche mêlés à la collection | Explorer autonome, utile sans collection |
| Ajouter (wishlist ou Pull List) | Explorer → Collection (S2) | Écriture directe dans `physicalSingles` (E1) | Action S2 avec retour visible (« ajouté à votre wishlist ») et annulation |
| Acheter | Collection | Passage wishlist → collection avec la date du jour et l'état NM 9.4 par défaut | Écran « J'ai acheté » : prix, frais, devise, état (facultatif mais visible), lot ; rien n'est inventé |
| Lire | Lecture | Case `isRead` par exemplaire | « Marquer comme lu » sur l'œuvre, avec la date, depuis n'importe quel écran |
| Progresser | Lecture | Progression des guides seulement | Prochain numéro de la série, guides de lecture |
| Statistiques | Collection, Lecture | Un tableau de bord mixte | Trois vues : Collection (contenu), Finances (privé), Lecture (journal, rythme) |
| Partager | Community | — | Plus tard ; rien n'est public par défaut |

### 3.2 Navigation : options (aucune n'est validée ici)
Le principe A6 est acquis : Explorer a sa propre entrée. Les options N1 à N5 (bureau) et M-A à M-E (mobile) sont **déjà décrites** dans [`phase4/03`](../phase4/03-changement-navigation.md) et ne sont pas reprises ici.

Ce plan directeur y ajoute la **place de la Lecture** et celle des **Finances**.

| Option | Description | Avantages | Inconvénients | Conséquences |
|---|---|---|---|---|
| L-A | Lecture comme 4e entrée principale (Collection, Lecture, Explorer, Réglages) | Domaine visible, cohérent avec A3 | Une entrée de plus ; dock mobile à 5 cases | Choix mobile M-x à refaire avec 5 cases |
| L-B | Lecture comme onglet de Collection, puis entrée propre plus tard | Pas de changement de navigation immédiat | Entretient la confusion entre exemplaire et œuvre | Migration de navigation en deux temps |
| L-C | Lecture intégrée à « Ma bibliothèque » (Collection + Lecture), Explorer à part | Deux univers clairs : « à moi » / « à découvrir » | Mélange deux domaines dans un même écran | Frontières à garder strictes dans le code malgré l'écran commun |
| Fi-A | Finances : onglet de Collection | Simple, privé par construction | Peu visible | Aucune |
| Fi-B | Finances : section dans le tableau de bord | Visible | Mêle les statistiques de contenu et l'argent | Contraire à la séparation proposée en [`02`](02-audit-financier.md) § 4 |

**[Reco.]** L-C ou L-A selon le choix N/M ; Fi-A. Décisions **U-D1** et **U-D2**.

### 3.3 Écrans et composants
- **Fiche d'exemplaire.** Trois blocs : identité (œuvre), exemplaire (état, emplacement), finances (coût, valeur, source, fourchette, historique).
  - Les champs inconnus s'affichent « non renseigné » avec une action « compléter », jamais « 0 ».
- **Cartes et listes.**
  - La valeur s'affiche avec un badge de source (auto, manuel, marché) et la fourchette au survol ou à l'appui.
  - Le badge de confiance existe déjà en CSS (`.confidence-badge`, l. 782–801) : à réutiliser.
- **Filtres.** À ajouter :
  - « coût inconnu », « valeur inconnue », « état non renseigné » ;
  - « estimation à revoir » ;
  - « sorties de collection ».
- **Formulaires.** Devise de l'exemplaire, préremplie par une devise par défaut choisie une fois (proposition : EUR, **[À valider F-D2]**). Champ « frais ». Mode « lot ».
- **États vides.** Un message par contexte (collection vide, aucun prix saisi, aucune lecture), avec l'action suivante.
- **Retours.**
  - Toute action entre domaines (S2) confirme et propose « Annuler ».
  - Toute action financière affiche le recalcul (« coût d'acquisition : 28,00 € »).
- **Responsive.**
  - Mobile : un dock à 4 ou 5 cases selon U-D1 ; Explorer présent dans le dock (contraire de l'état actuel, l. 2119–2136).
  - Bureau : navigation latérale (N1 à N5).
  - Tableaux financiers en cartes sur mobile.
- **Vérification.** Ces constats viennent de la lecture du code. Une revue au navigateur (bureau 1280 px et mobile 375 px) fait partie du lot F0 **[Hyp.]** pour le rendu réel.

## 4. Architecture cible : écarts seulement
Le socle est inchangé :
- Phase 3 : Supabase, RLS, synchronisation par domaine, `SYNC_DOMAINS` avec un champ `domain` ;
- contrats S1 à S6 ;
- B1 (`panel-bundle` v1) ;
- R2.

**Aucun contrat n'est modifié.** Aucun problème démontré ne l'exige :
- les finances restent internes au domaine Collection ;
- S1 n'expose que des statuts (possédé, wishlist, lu), jamais un montant.

| Sujet | Écart proposé | Raison |
|---|---|---|
| Propriété des données | Les **acquisitions** et **sorties** appartiennent à Collection ; la **progression par œuvre** à Lecture | F1 ; A3 |
| Modèle Collection | Champs ajoutés : `coverCurrency`, `purchaseCurrency`, `acquisitionFees`, `acquisitionId`, `valuedAt`, `disposal` ; montants en centimes dans le nouveau format, lecture des anciens décimaux | [`02`](02-audit-financier.md) § 3 |
| Stockage serveur (Phase 3) | Option 1 : acquisitions et sorties dans `copies.data` (aucune table de plus au lot 3.1). Option 2 : table `app.acquisitions` ajoutée au lot 3.4. **[À valider F-D5]** ; option 1 recommandée pour ne pas modifier le périmètre du lot 3.1 (liste fermée des tables, « et aucune autre » dans [`phase3/08`](../phase3/08-lot-3.1-prompt.md), étape 4) | Respecter le périmètre validé du lot 3.1 |
| Sauvegardes (B1) | Le fournisseur Collection exporte aussi les acquisitions, les sorties et les instantanés de valeur ; le fournisseur Lecture exporte la progression par œuvre | Indépendance des domaines |
| Confidentialité | Les données financières sont **exclues** de tout agrégat S3 et de Community, sauf décision explicite ; elles ne sortent jamais dans une URL | Données sensibles (patrimoine) |
| Identité locale et comptes | Sans changement : P1 reste ouvert (P1-a recommandé) | — |
| Images (R2) | Sans changement de conception ([`07`](../phase4/07-architecture-images-r2.md)). Questions encore ouvertes : droits des couvertures par source, compte, domaine, plafond de dépense | Ne jamais supposer les droits des images |
| Recherche | Explorer indexe le catalogue ; Collection indexe ses fiches ; pas d'index croisé (A7) | Frontières |
| Erreurs | Tout calcul financier impossible affiche une raison (« coût inconnu »), jamais un nombre | Intégrité |

Aucune dépendance circulaire n'est introduite :
- Collection ne lit pas Lecture ;
- Lecture lit seulement l'identité d'œuvre ;
- Explorer lit S1.

## 5. Opportunités (sources externes, consultées le 7 novembre 2026)

| Service | Ce qu'il fait bien [Source] | Limites relevées [Source / Interp.] |
|---|---|---|
| League of Comic Geeks | Pull List par série, sorties hebdomadaires (numéros, variantes, TPB), scanner, wishlist, progression de lecture, prévision de dépenses [1][2] | Détail des fonctions payantes non trouvé [Interp.] |
| CLZ Comics | Scan de couverture et de code-barres ; champs personnels par exemplaire (boîte, état, date, prix et magasin d'achat) ; collections multiples ; synchronisation [3] | Cotes CovrPrice en option payante séparée [3] |
| CovrPrice | Valeur de marché à partir de ventes réelles validées, sur plusieurs places de marché ; repli sur l'état le plus courant ; pas de valeur sans vente récente [4][5] | Écarts constatés avec GoCollect pour un même numéro [5] |
| CLZ × CovrPrice | Valeur CovrPrice dans un champ séparé en lecture seule ; la valeur de l'utilisateur est conservée [4] | — |
| Key Collector | Base de Key Issues, alertes et tendances par abonnement [6] | Pas centré sur la gestion complète d'une collection [6] |
| GCD | Données sous licence CC BY-SA 4.0, y compris le schéma ; téléchargements CSV et JSON [7] | Le partage à l'identique impose des obligations pour une base dérivée [Interp.] : à valider juridiquement |
| Comic Vine | API **strictement non commerciale**, 200 requêtes par ressource et par heure, lien de retour demandé [8] | Incompatible avec un usage commercial (déjà relevé au lot 2.5) |
| Goodreads | Étagères (lu, en cours, à lire), défi annuel avec suivi « en avance / en retard », statistiques annuelles [9] | Pensé pour le livre, pas pour le numéro de série [Interp.] |
| Letterboxd | Journal daté (date, note, critique, relectures), présentation en grille d'affiches, bilan annuel [10] | Bilan annuel réservé au compte payant [10] |

**Différenciation possible pour Panel [Interp., Reco.]**
1. **Finances honnêtes.** Coût réel avec frais et lots, devise, couverture des données, source et fourchette de chaque valeur, plus-values latentes et réalisées séparées.
   - Aucun service étudié ne met en avant la couverture des données [Interp.].
   - C'est réalisable localement, sans source payante (F0, F1).
2. **Journal de lecture de comics** à la manière de Letterboxd et Goodreads, mais au niveau du **numéro** et de la série : prochain numéro, rythme, relectures. Domaine Lecture, lot L1.
3. **Local-first et confidentialité** : utilisable sans compte (D-02), finances jamais partagées.
4. **Emplacements physiques fins**, déjà implémentés : rares et utiles pour retrouver un exemplaire [Interp.].
5. **Valeur de marché** : seulement avec une source licenciée.
   - Ne rien intégrer (CovrPrice, GoCollect…) sans contrat ; aucun engagement n'est pris ici.
   - Avant cela, la saisie « cote marché » manuelle, avec sa date et sa source, suffit.

**À éviter** :
- les classements de valeur publics ;
- les alertes de spéculation : Panel n'est pas un conseiller financier ;
- l'extraction de données de sites tiers sans licence.

### Sources
1. League of Comic Geeks, fiche App Store : https://apps.apple.com/app/id874775221
2. League of Comic Geeks, présentation : https://www.startuphub.ai/startups/league-of-comic-geeks
3. CLZ Comics, fiche App Store : https://apps.apple.com/us/app/clz-comics/id320501548
4. CLZ, FAQ CovrPrice : https://clz.com/comics/mobile/manual/1/en/topic/covrprice-faq
5. CovrPrice : https://covrprice.com ; forum CBCS, « GoCollect vs CovrPrice » : https://forum.cbcscomics.com/topic/17854/gocollect-vs-covrprice
6. Key Collector Comics, fiche App Store : https://apps.apple.com/us/app/key-collector-comics-app/id1189623811 ; Quality Comix : https://www.qualitycomix.com/guide/iphone-apps-comic-prices/
7. Grand Comics Database (mention de licence) : https://www.comics.org/contact/
8. Comic Vine, API : https://comicvine.gamespot.com/api
9. Goodreads, discussion sur les défis : https://www.goodreads.com/topic/show/20989945-new-functionality---challenges-for-bookshelves
10. Letterboxd, FAQ : https://letterboxd.com/about/faq/

Certaines sources sont des fiches de magasin d'applications ou des forums. Les tarifs et fonctions peuvent avoir changé : à revérifier avant toute décision commerciale.
