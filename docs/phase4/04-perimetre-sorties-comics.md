# Phase 4 · 04 — Périmètre des Sorties : comics uniquement, mangas exclus

Statut : **règle obligatoire fixée par l'utilisateur le 7 novembre 2026**. Elle s'applique à toute la fonctionnalité Sorties et à toutes ses intégrations dans Explorer. **Aucun code n'a été modifié.**

## 1. Règle
- « Sorties » concerne **exclusivement les sorties de comics** : comics américains et comics internationaux relevant du marché des comics.
- **Tous les éditeurs de comics** sont couverts : Marvel, DC, Image Comics, Dark Horse, IDW, BOOM! Studios, Dynamite, Valiant, Archie, Skybound, Oni Press et les éditeurs indépendants.
- Les **mangas japonais** et leurs calendriers de publication sont **exclus**.
- Aucune sortie manga dans les **classements, calendriers, actualités ou recommandations de sorties** d'Explorer.
- Comics et mangas ne sont pas confondus au seul motif qu'il s'agit de bandes dessinées.

## 2. Application
| Endroit | Application |
|---|---|
| Calendrier des sorties (semaine, mois, à venir, nouvelles séries, recueils, variantes, reports) | Comics seulement |
| Classements commerciaux et communautaires liés aux sorties (« nouveautés populaires », « plus fortes progressions ») | Comics seulement |
| Actualités et recommandations de sorties | Comics seulement |
| Connecteurs et imports de sorties | Toute entrée classée manga est **rejetée avant publication** dans les Sorties, et comptée dans le rapport d'import (« exclue : manga ») |
| Images (S4) | Aucun import d'image pour une sortie exclue |
| Recherche Explorer, rubrique Sorties | Comics seulement |

## 3. Règle de classement d'une publication
Chaque publication du catalogue éditorial porte un champ obligatoire `medium` :

| Valeur | Sens | Sorties |
|---|---|---|
| `comic` | Comic américain ou international du marché des comics (singles, TPB, HC, omnibus, recueils, éditions traduites de comics) | **Inclus** |
| `manga` | Manga japonais, y compris en traduction | **Exclu** |
| `unknown` | Classement non établi | **Exclu par défaut**, mis en file de validation éditoriale |
| autres valeurs (à décider, § 5) | | Selon décision |

Règles de détermination, par ordre de priorité :
1. Classement fourni par une source autorisée (type de publication, catégorie de la source).
2. Éditeur ou collection (imprint) dédiés exclusivement au manga.
3. Validation éditoriale humaine.

Un éditeur **mixte** (qui publie des comics et des mangas) ne suffit **jamais** à classer une publication : le classement se fait au niveau de la publication ou de la collection, jamais de l'éditeur seul. Un doute aboutit à `unknown` (exclu), jamais à `comic` par défaut.

## 4. État actuel du code (lot 2.4) : non conforme [Fait]
- `REL_FORMATS` contient un format `manga` (« Manga »), et `relFormat()` reconnaît le mot « manga » (`index.html`, l. 7476 et 7556).
- `REL_PUBLISHERS` contient **Kana** et **Kurokawa**, éditeurs de manga, ainsi que des éditeurs mixtes (Glénat, Delcourt, Ankama, Casterman) et des éditeurs de bande dessinée franco-belge (Dargaud, Dupuis, Casterman, Les Humanoïdes Associés) (l. 7463-7474).
- Le calendrier du lot 2.4 peut donc aujourd'hui afficher des publications manga, notamment saisies ou importées.

**Rien n'est modifié aujourd'hui.** La mise en conformité relève de la future fonctionnalité Sorties d'Explorer (lots 4.6 et 4.9, voir [`03`](03-changement-navigation.md) pour la navigation). Elle :
- n'affectera **aucune donnée de Collection** : un manga possédé reste dans la collection, la Pull List et la wishlist de l'utilisateur, qui relèvent de Collection ;
- ne supprimera **aucune** publication existante : les publications manga déjà présentes seront **masquées** des Sorties (filtre `medium`), pas effacées ;
- s'accompagnera d'une sauvegarde et d'un rapport (nombre de publications masquées).

## 5. Ambiguïtés à trancher
| # | Cas | Question | Proposition |
|---|---|---|---|
| M1 | **Bande dessinée franco-belge** (Dargaud, Dupuis, Casterman, albums) | Fait-elle partie des « comics internationaux relevant du marché des comics » ? | **À valider.** Proposition : exclue des Sorties, sauf les éditions françaises de comics (Panini, Urban, Delcourt Comics, Bliss, HiComics…) |
| M2 | **Manhwa et manhua** (Corée, Chine), **webtoons** | La règle n'exclut explicitement que le manga japonais | **À valider.** Proposition : exclus, comme le manga |
| M3 | **Manga non japonais** (« global manga », OEL, manfra) | Style manga, origine non japonaise | **À valider.** Proposition : exclus |
| M4 | Comics adaptés d'une licence manga ou d'un anime, publiés par un éditeur de comics (par exemple au format single) | Comic ou manga ? | Proposition : `comic` si l'œuvre est publiée en tant que comic par un éditeur de comics ; validation éditoriale en cas de doute |
| M5 | Éditeurs mixtes (Glénat, Delcourt, Ankama) | Classement par collection | Classement au niveau de la publication ou de la collection (§ 3) |
| M6 | Mangas présents dans une collection personnelle ou dans la Pull List | Hors Sorties | Collection n'est pas concernée par la règle : rien n'est changé dans Collection ; une entrée de Pull List liée à une publication masquée reste intacte et visible dans Collection |

## Décision du 8 novembre 2026 (D-41)
Les propositions M1 à M4 ci-dessus sont appliquées sous délégation, **par masquage** (jamais de suppression) : règles `REL_SCOPE_RULES` dans `index.html` (`manga`, `manhwa`, `bd`), compteur détaillé par motif dans le calendrier, case « Afficher le hors périmètre ». Un éditeur mixte (Glénat, Delcourt, Humanoïdes Associés, Ankama) n'est jamais masqué sur son seul nom : seul le format `manga` le fait. Tests 41 et 44.
