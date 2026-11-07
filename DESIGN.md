# DESIGN.md — Panel by Primestone

Système visuel **« Quadrichromie de kiosque »**, relevé dans le code livré (`index.html`, couche « KIOSQUE ») le 7 novembre 2026, après la Phase 1. Ce fichier décrit ce qui existe. Il ne décrit pas une intention.

## Principe

Panel ressemble à un présentoir de marchand de journaux : papier clair, quatre encres d'imprimerie (cyan, magenta, jaune, noir), titres condensés en capitales et trames Ben-Day. Les trames servent à marquer des états, pas à décorer. Usage visé : de jour, au bureau ou en boutique, autant sur ordinateur que sur téléphone. La collection physique est le seul module.

## Couleurs (`:root`)

| Rôle | Jeton | Valeur |
|---|---|---|
| Fond « papier journal » | `--bg` | `#EEF0EF` |
| Cartes, modales | `--bg-card` | `#FFFFFF` |
| Encre principale (texte, bordures fortes, ombres portées) | `--ink` / `--key` | `#161616` |
| Texte secondaire | `--muted` | `#5A6260` (AA sur blanc et sur papier) |
| Placeholders | — | `#626B68`, opacité 1 |
| Accent texte / liens / état actif | `--lime` | `#00749F` (cyan foncé, AA) |
| Remplissage cyan (boutons pleins) | `--cyan-fill` | `#00A3DA` |
| Magenta (alertes, suppression, wishlist) | `--magenta-fill` | `#E5007E` |
| Jaune (scanner, mise en avant) | `--yellow-fill` | `#FFE500` |
| Teintes de fond | `--tint-cyan` / `--tint-magenta` / `--tint-yellow` | `#E3F4FB` / `#FCE6F2` / `#FFF8BF` |
| Filets | `--line` / `--line-strong` | `#D4D9D7` / `#9AA3A0` |
| Statuts | `--cyan` (succès) / `--red` / `--gold` | `#13804A` / `#C8102E` / `#8A6A00` |

Pour des raisons d'historique, `--lime` désigne l'accent cyan foncé et `--cyan` le vert de succès. On garde ces noms : des centaines de règles les utilisent.

**Accent au choix** (Paramètres) : `body.theme-cyan` bascule l'accent en magenta (`--lime: #B0005F`, `--cyan-fill: #FF52AE`).

**Règles de contraste**
- Sur un fond cyan plein, le texte est à l'encre `--key` et jamais en cyan.
- Au survol, les boutons pleins forcent `color: var(--key)`, même quand une couleur est posée en ligne.

## Typographie

- **Titres** : `--font-display` = *Barlow Condensed* 600/700/800, hébergée en local (`fonts/*.woff2`, latin et latin-ext), en capitales, interlignage serré. H1 de vue, titres de modales (`h2`, 24px, 800), titres de sections (`h2`, 22px).
- **Interface et texte courant** : `--font-ui` = Segoe UI Variable Text, puis Segoe UI, Roboto, Arial.
- **Taille minimale : 12px** pour tout texte lisible. Les chiffres (valeurs, compteurs) sont en `tabular-nums`.
- **Hiérarchie** : un `h1` par vue, titres de modales et d'état vide en `h2`, cartes de statistiques en `h3`.

## Formes et profondeur

- **Rayons** : `--radius-sm` 4px (boutons, champs), `--radius-md` 6px, `--radius-lg` 10px, `--radius-pill` (puces de filtre).
- **Bordures** : 1.5px à l'encre `--key` sur les boutons. Filet `--line` sur les cartes.
- **Ombres** : `--shadow-sm|md|lg`, grises et neutres. L'état « choisi » utilise une ombre portée décalée à l'encre (`3px 3px 0 var(--key)`), comme un cadre imprimé. Pas de halo lumineux.
- **Survol des boutons pleins** : remontée de 1px et ombre `0 2px 0 var(--key)`.

## Trames Ben-Day

Il y a un jeton par encre : `--dots-key`, `--dots-cyan`, `--dots-magenta` et `--dots-yellow`. Chacun est un `radial-gradient` à bord net, avec une cellule de `--dot-size: 5px 5px`.

Les trames servent à :
- les barres de progression et de complétion des séries ;
- le rail d'accent ;
- les états vides.

L'analyse automatique les signale parfois comme « halo radial ». C'est un faux positif : le point est opaque à bord net, il n'y a pas de dégradé.

## Icônes

Il y a un sprite SVG inline unique : `<symbol id="ic-…">`, utilisé via `<svg class=ic><use href=#ic-…></svg>`. Le trait hérite de `currentColor`. Il n'y a ni emoji ni police d'icônes.

## Composants clés

- **Boutons** : `.btn` est le bouton plein cyan. `.btn.secondary` est blanc avec une bordure d'encre. `.btn.accent-scan` est jaune et réservé au scanner. `.btn-icon` est le bouton icône seule.
- **Puces de filtre / onglets** : `.tab-btn` en pilule. La puce active est remplie d'encre `--key` avec le texte en blanc.
- **Cartes de comics** : `.comic-card` (couverture 2:3) et `.single-row` en vue liste.
- **Barre mobile** (`.mobile-dock`, ≤ 720px) : quatre entrées, Collection, Séries, **Scan** (pastille jaune centrale) et Wishlist.
- **Menus** : `details.menu-pop` (« Plus », « Outils ») plutôt que des barres d'actions longues.
- **Toasts** avec action d'annulation (`.toast-action`).
- **Calendrier** : badges `.rel-market` (marché), `.rel-status` (statut ; reporté en orange, annulé barré) et `.rel-date` (pointillés = annoncée, trait plein cyan = confirmée). La grille `.rel-cal` compte 7 colonnes et passe en points de couleur avec une liste `.rel-cal-list` sous 640 px. Les lignes sont des `.rel-row` et `.pull-row`, la fiche est `#pubModal`, la wishlist structurée est `.wish-box`.
- **Emplacements** : `.loc-cascade` (4 listes Pièce → Meuble → Boîte → Séparateur, 2 colonnes sur mobile) et fenêtre `#locationsModal`, dont l'arbre `.loc-row` est indenté par `--depth`. Le nombre de comics est en `tabular-nums` ; « vide » est affiché en gris.

## Responsive

- La grille est fluide. Le rail latéral est masqué à 720px et moins, et remplacé par la barre mobile.
- Aucun défilement horizontal de la page à 360px (vérifié). Les rangées de puces défilent dans leur propre conteneur.
- Les rangées de boutons des états vides passent à la ligne (`flex-wrap`).

## Hors périmètre (retiré en Phase 1)

Le lecteur PDF/CBZ/CBR, la bibliothèque numérique, la bannière d'accueil numérique, le volet d'étude et les annotations ont disparu de l'interface, et leur CSS a été supprimée.

Les données associées sont conservées (voir le README).
