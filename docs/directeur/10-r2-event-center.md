# R2 — Event Center v2 (D-57, 8 novembre 2026)

Deuxième étape de la roadmap du [rebaseline](08-rebaseline-produit.md) (§ 13 et R2) : une fiche événement dit tout de suite ce qu'il faut lire, avec la justification de chaque choix et la progression du lecteur.

## 1. Architecture

- **Module de domaine** `domains/explorer/event-levels.js` (pur), intégré par `scripts/sync-domains.js` sous `window.PanelDomains.eventLevels`. Il prend en entrée la vue d'événement de `media-core` (`eventView`), fournie par l'appelant.
- **Interface** : section « Que lire ? » en tête de la fiche événement d'Explorer, avant la galerie et la série principale.
- **Progression** : lue par le contrat S1 (`guideProgress`), écrite par le contrat S2 (`setGuideProgress`, geste de l'utilisateur requis). Explorer n'accède jamais directement au domaine Lecture (contrôle des frontières : 0 couplage).
- **Préférences locales** : `panel_event_levels_v1` (niveau choisi et liens masqués par événement). Pas de synchronisation.

## 2. Modèle

| Notion | Valeurs | Règle |
|---|---|---|
| Niveau | Essentiel ⊂ Recommandé ⊂ Complet | Essentiel = série principale + numéros indispensables ; Recommandé = + lectures qui éclairent l'intrigue ; Complet = tout ce que les sources rattachent |
| Rôle | cœur, prélude, tie-in (dont crossover), épilogue, conséquence, lié | Dérivé de la relation documentée (D-49) |
| Sélection | par événement : version, date, journal des versions, justification de chaque niveau et de chaque lien choisi | **Sélection éditoriale Panel**, affichée comme telle, jamais comme un fait bibliographique |
| Ordre recommandé Panel | construit à partir des rôles : préludes → série principale → tie-ins choisis → épilogues → conséquences ; numéros d'une série dans l'ordre de publication | Jamais recopié d'un guide tiers (aucune position reprise) ; identifiant versionné `ord_panel_<événement>_<niveau>_v<version>` |
| Progression | par niveau : lus, ignorés, total, pourcentage, prochain numéro | Calculée sur l'ordre recommandé du niveau |

Garde-fous :
- une sélection ne désigne que des liens **déjà présents** dans la fiche (aucune série ni aucun numéro ajouté) ; un lien absent (fiche modifiée par l'utilisateur) est signalé « non applicable » et ignoré ;
- une série citée sans numéros est comptée à part (« numéros non précisés »), jamais devinée ;
- masquer un lien ne vaut que pour le niveau Complet, jamais pour l'essentiel ; réversible.

## 3. Les neuf événements (sélection version 1)

| Événement | Essentiel | Recommandé | Complet | Choix |
|---|---|---|---|---|
| Secret Wars (1984) | 12 | 12 | 12 | Récit complet, aucun lien |
| The Infinity Gauntlet | 8 | 26 | 52 | Essentiel : + The Thanos Quest #1-2 ; recommandé : préludes de Silver Surfer, Warlock and the Infinity Watch #1 |
| House of M | 8 | 11 | 75 | Recommandé : Excalibur Vol. 3 #13-14, Decimation: The Day After #1 |
| Civil War | 7 | 28 | 173 | Recommandé : Amazing Spider-Man Vol. 2, Civil War: Front Line |
| Crisis on Infinite Earths | 12 | 12 | 111 | Aucun crossover recommandé (prolongements non nécessaires) |
| Infinite Crisis | 7 | 7 (+5 séries sans numéros) | 112 | Recommandé : Countdown et les quatre mini-séries préparatoires (numéros non précisés par les sources) |
| Blackest Night | 9 | 28 | 83 | Recommandé : Green Lantern Vol. 4, Green Lantern Corps Vol. 2 |
| Flashpoint | 5 | 13 | 78 | Recommandé : The Flash Vol. 3 #8-12, Flashpoint: Batman – Knight of Vengeance |
| King in Black | 5 | 37 | 100 | Recommandé : Venom Vol. 4 |

Chaque choix porte une phrase de justification affichée sur la fiche. Ces justifications sont des choix éditoriaux de Panel, **non relus par un humain** : à réviser (nouvelle version) si un lecteur ou une source les contredit.

## 4. Tests

- `domains/explorer/event-levels.test.js` : 6 tests (emboîtement des niveaux, masquage sans toucher l'essentiel, ordre construit par rôles et sans position tierce, progression et prochain numéro, les neuf sélections applicables et justifiées sans ajout, lien disparu signalé).
- Test navigateur 53 : neuf événements justifiés, section en tête et dans le premier écran, 7 essentiels pour Civil War, niveau recommandé (28), ordre Panel versionné, progression affichée, masquage puis réaffichage, préférence enregistrée, événement sans tie-in.

## 5. Limites et suites

- Les personnages d'événement restent ceux de la fiche (cités par la source), sans niveau d'importance ni lien au catalogue de personnages (R5).
- L'ordre recommandé ne place pas les tie-ins entre deux numéros de la série principale : sans dates fiables par numéro, ils sont indiqués « en parallèle ».
- La progression enregistrée exige un clic réel (geste S2) ; sans personnalisation activée, elle n'est pas affichée.
- Pas d'ordre chronologique dans l'univers : aucune source exploitable n'est disponible.
