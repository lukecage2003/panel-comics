# 09 — Système documentaire et iconographique (D-48 à D-50)

Date : 8 novembre 2026. Statut : **implémenté et testé localement** ; aucune source externe d'images n'est activée ni validée.

## 1. Sources d'images étudiées

| Fournisseur (`media-core.js`) | Type | État dans Panel | Raison |
|---|---|---|---|
| `panel_local` | Données de Panel | **Actif** | Visuels déjà portés par les données locales, avec leur provenance |
| `manual` | Ajout manuel | **Actif** | L'utilisateur indique l'adresse, la source et les droits ; « non vérifié » par défaut |
| `wikimedia_commons` | Tiers sous licence libre | Inactif (adaptateur prêt) | Droits établis fichier par fichier ; activer un service externe exige une décision de l'utilisateur. L'adaptateur ne garde que les licences libres et marque toute association « non vérifiée » |
| `gcd` (Grand Comics Database) | Base spécialisée | Inactif | Données sous CC BY-SA, mais les **scans de couvertures** ne sont pas couverts par cette licence |
| `metron` | Base spécialisée | Inactif | Compte requis ; droits d'affichage des images non établis |
| `comic_vine` | Base spécialisée | Inactif | Clé API et compte requis ; usage non commercial, affichage non établi |
| `marvel_official`, `dc_official` | Officiel | Inactif | Aucune autorisation d'affichage accordée à Panel |

Les couvertures de Wikipédia (anglais) sont des fichiers non libres (usage équitable propre à Wikipédia) : **jamais reprises**. Seuls des faits (titres, numéros, dates, équipes) ont été lus dans les articles, avec la source citée.

## 2. Huit statuts de visuel
`official`, `database`, `local`, `authorized`, `manual`, `unverified`, `unavailable` (absent ou adresse en échec), `rights_unknown`. Calculés par `classifyRef` à partir de la provenance ; un ajout manuel n'est **jamais** « vérifié » : au mieux « confirmé par vous ».

## 3. Modèle événementiel
Bloc `event` d'un guide : univers, série principale (numéros explicites, dates de couverture ou de sortie **citées**, équipe créative, source), liens typés (`prelude`, `tie_in`, `crossover`, `epilogue`, `aftermath`, `related_series`) avec source, position de lecture éventuelle, conséquences. Une relation inconnue est écartée ; une source inconnue n'est pas attribuée. Quatre types d'ordre distincts : publication, chronologie dans l'univers, lecture recommandée, référence. Aucun ordre n'est reconstruit à partir d'un autre.

## 4. Catalogue initial
King in Black (complété, seedVersion 2) et huit événements : Secret Wars (1984), Infinity Gauntlet, House of M, Civil War (Marvel) ; Crisis on Infinite Earths, Infinite Crisis, Blackest Night, Flashpoint (DC). Une source Wikipédia par fiche (lue le 8 novembre 2026), complétude « partielle », **aucune image**. Un contenu modifié par l'utilisateur n'est jamais remplacé lors d'une mise à jour du catalogue.

Enrichissement progressif et reproductible : ajouter un objet à `domains/explorer/events-seed.js` (source citée par lien, `seedVersion` incrémentée), lancer `node scripts/sync-domains.js`, puis `npm run test:domains` (contrôle de cohérence du catalogue).

## 5. Interface
- Fiche événement (dans la page du guide) : faits, galerie, série principale en grille, préludes, tie-ins et suites, conséquences, chronologie de publication, ordres « disponible » ou « non documenté ».
- Fiche numéro : visuel et statut, date, équipe, événements où il apparaît avec la relation.
- Galerie commune et visionneuse : agrandissement, navigation (boutons, ←, →), Échap, type de visuel, source, attribution, droits, statut.
- Recherche : catégorie « Numéros », faits des événements, éditeurs des personnages ; aucune attente d'image.
- Outil « Visuels à compléter » : entités sans visuel (filtre par type), associations à contrôler (non vérifiée, cassée, droits absents, recueil sur un numéro, même image sur deux entités), confirmer, signaler douteuse, remplacer, retirer ; chaque action annulable ; les références font partie de la sauvegarde Explorer.

## 6. Limites
- Aucun visuel réel n'est fourni : les fiches affichent des remplacements typographiques tant que l'utilisateur n'ajoute pas de visuel.
- Faits issus d'une seule source par fiche : à recouper.
- Les numéros des tie-ins ne sont listés que si la source les précise.

## 7. Enrichissement réel et recoupement (D-51, 8 novembre 2026)

### 7.1 Sources réexaminées (accès réel le 8 novembre 2026)

| Source | Accès constaté | Conditions et licence | Usage dans Panel |
|---|---|---|---|
| Comic Book Reading Orders (CBRO) | Pages publiques lisibles ; certaines pages réservées aux membres Patreon | Contenu protégé ; pas d'API | **Exploitée** : faits (séries, numéros) pour 8 événements ; ordre non reproduit ; aucune page pour Secret Wars (1984) |
| Reading Orders (readingorders.com) | Pages publiques lisibles pour Crisis, Infinite Crisis, Blackest Night, Flashpoint, King in Black ; vides pour House of M, Infinity Gauntlet, Secret Wars (1984) ; Civil War en positions de lecture seulement | Pas de conditions affichées ; liens d'affiliation ; crédits images à Marvel et DC | **Exploitée** : faits pour 5 événements ; ordre non reproduit |
| Comic Compass | Introuvable par recherche | — | Non exploitée |
| French Comics Reading Order | Introuvable par recherche ; seuls des articles VF isolés trouvés | — | Non exploitée |
| Marvel officiel, DC officiel | Pages de conditions inaccessibles à l'outil (HTTP 403) | Non vérifiées | Non exploitées |
| Popverse, AIPT, ComicsXF, ComicBook.com, MDCU | Non consultés faute de budget ; sources d'actualité, pas de listes structurées | — | À étudier |
| GCD (comics.org) | Site inaccessible à l'outil (HTTP 403) ; licence connue par la notice reproduite | Données CC BY-SA 4.0 ; couvertures « tous droits réservés aux ayants droit » | Données exploitables avec attribution, **couvertures exclues** |
| Metron | Protection anti-robots (Anubis) ; API documentée par la bibliothèque mokkari | Compte et jeton requis ; 20 requêtes/min, quota quotidien | Bloquée (compte) |
| Comic Vine | Page API lisible | Compte et clé ; **usage non commercial** ; pas de base concurrente ; lien retour ; pas de reproduction | Bloquée (compte, conditions) |
| Open Library (covers) | Documentation lisible | Affichage autorisé pour sites publics, pas de collecte massive ; 100 req./5 min par IP hors cover ID/OLID ; licence des images **non précisée** | Candidate pour les **recueils** (ISBN) seulement, à décider ; jamais pour un numéro |
| Google Books | Conditions partielles lisibles | Pas de facturation des utilisateurs ; retrait sur demande | Non exploitée |
| Fandom | Page de licence refusée (HTTP 402) | Texte généralement CC BY-SA ; images au cas par cas | Non exploitée |
| The Collector / collection.id, cataloggd | Non consultés | — | À étudier |

### 7.2 Résultat
- Neuf fiches ; huit recoupées avec un ou deux guides tiers (Secret Wars 1984 reste à source unique, signalé).
- 706 publications citées au total (séries principales + numéros liés, toutes sources confondues) ; 111 séries recoupées par au moins deux sources sans écart (106 avec numéros concordants), 20 séries divergentes, 70 citées par une seule source.
- Divergences conservées et expliquées dans chaque fiche (numéros, relation, titre) ; aucune n'est tranchée.
- Aucune couverture ajoutée : aucune source étudiée ne fournit de couverture de numéro dans des conditions établies.
