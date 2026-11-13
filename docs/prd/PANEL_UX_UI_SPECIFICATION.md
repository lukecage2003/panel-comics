# PANEL — Spécification UX/UI et design system

Date : 13 novembre 2026. Statut : proposé (D-58). Le système visuel existant est décrit dans [`DESIGN.md`](../../DESIGN.md) (« Quadrichromie de kiosque », DA Primestone jaune et noir) et a été complété par le mode sombre et l'affinage inspiré d'Apple (D-53). Ce document décrit l'existant puis la cible, sans repartir de zéro.

## 1. Identité visuelle

**Existant.** Noir `#111111` et jaune `#FFD400` (DA Primestone), papier chaud `#F3F2EE`, titres en **Barlow Condensed** (600-800, auto-hébergée, licence OFL), icônes SVG au trait (`<symbol id="ic-…">`). Mode **clair / sombre / système** (`html[data-mode]`, clé locale `panel_color_mode`), accents au choix (Primestone, magenta, cyan, rouge, violet). Surfaces arrondies, ombres douces, pastilles, verre dépoli sur la barre mobile (D-53).

**Cible.** Conserver cette identité : elle est propre à PANEL, reconnaissable (bande dessinée imprimée, kiosque) et premium. Évolutions :
- Remplacer « Panel by Primestone » par **PANEL** dans les titres et le manifeste quand la marque sera arrêtée (décision du porteur).
- Ajouter une famille de texte lisible pour les publications longues (critique) : police système (`-apple-system`, `Segoe UI`, `Roboto`) déjà utilisée, pas de nouvelle police payante.
- Bulles et cases de BD comme **motif graphique discret** (états vides, badges de challenge), jamais comme décor envahissant.

## 2. Navigation principale

### 2.1 Existant (vérifié le 13 novembre 2026)

| Support | Navigation |
|---|---|
| Ordinateur | Rail latéral : section Explorer (Accueil Explorer, Sorties & calendrier, Pull List), section Collection (Ma collection, Séries, Wishlist, Stats, Lecture, Communauté, Finances), Ajouter (scan code-barres, scan couverture, import CSV, saisie) ; barre supérieure : recherche globale ⌘K, Scanner, Plus, Importer, Paramètres |
| Sous-navigation | Onglets : Collection · Séries · Wishlist · Calendrier · Explorer · Stats · Lecture · Finances · Communauté |
| Téléphone | Barre du bas à 5 boutons : **Collection · Calendrier · Scan · Communauté · Explorer** (13 novembre 2026) |

### 2.2 Cible V1

Les trois piliers deviennent les entrées principales, avec une page d'accueil personnelle.

| Entrée | Contenu | Remplace / regroupe |
|---|---|---|
| **Accueil** | Ma semaine : sorties suivies, prochain numéro à lire, activité des abonnements, clubs en cours | Accueil Explorer recentré |
| **Explorer** | Recherche, événements, univers, personnages, créateurs, tendances communautaires | Explorer actuel |
| **Collection** | Collection, Séries, Wishlist, Stats, Finances, emplacements | Section Collection actuelle |
| **Lecture** | À lire, en cours, journal, progression des événements, challenges | Lecture + progression |
| **Calendrier** | Sorties, Pull List, FOC, Upcoming #1 | Sorties & calendrier + Pull List |
| **Communauté** | Fil, groupes et clubs, découvertes | Communauté (brouillons) |
| **Profil** (avatar) | Mon profil, Compte, Abonnement, Paramètres, Données | Paramètres + sauvegardes |

Téléphone : **Accueil · Calendrier · Scan (central) · Communauté · Collection** ; Explorer par la recherche en haut de chaque écran ; Lecture accessible depuis Accueil et Collection ; Profil par l'avatar. Toute réorganisation garde les identifiants de boutons testés ou met à jour les tests dans le même lot.

## 3. Architecture de l'information et écrans

| Écran | Contenu principal | État |
|---|---|---|
| Accueil | Ma semaine, à lire ensuite, activité, clubs | [Proposé] |
| Recherche globale | Résultats groupés par type, tolérante | [Existant] |
| Fiche série | En-tête, numéros (possédés / manquants), éditions VF, discussions | [Partiel] |
| Fiche numéro | Couverture (si autorisée), dates, variantes, crédits, éditions, critiques, « Ajouter / Lu / Wishlist » | [Partiel] |
| Fiche événement | Essentiel en tête, niveaux, ordres, progression, discussions | [Existant] (discussions [Proposé]) |
| Collection | Grille / liste, filtres, bandeau de chiffres **sur cette page seulement** | [Existant] |
| Séries | Complétion, grille des numéros | [Existant] |
| Calendrier | Semaine et navigation, recherche, pull list ; filtres et outils repliés | [Existant] (épuré le 13 novembre 2026) |
| Lecture | En cours, à lire, journal | [Existant] |
| Fil | Onglets Abonnements / Communauté / Moi, composer | [Proposé] |
| Publication | Texte, images, spoiler, cible catalogue, commentaires | [Proposé] |
| Profil | Avatar, bio, vitrine, Comic DNA, publications, abonnés | [Proposé] |
| Groupe / club | Présentation, membres, calendrier de lecture, discussions par étape, challenges | [Proposé] |
| Notifications | Liste groupée, préférences | [Proposé] |
| Compte et abonnement | Identité, appareils, consentements, export, suppression, PANEL Plus | [Proposé] |
| Modération (personnel) | File, détail, décision, appels, statistiques | [Proposé] |

## 4. États d'interface

| État | Règle |
|---|---|
| **Vide** | Toujours une phrase utile et une action : « Aucune sortie cette semaine » + « Voir le mois » ; « Votre fil est vide » + « Découvrir des lecteurs » ; illustration typographique, jamais d'image sous droits |
| **Chargement** | Squelettes à la forme du contenu après 300 ms ; aucun écran blanc ; boutons désactivés avec indicateur pendant une écriture |
| **Erreur** | Message en français, cause et action (« Réessayer », « Vérifier la connexion ») ; codes d'API traduits (§ API 1) ; aucune perte de saisie (brouillon conservé) |
| **Hors ligne** | Pastille « Hors ligne » (existante) ; fonctions personnelles disponibles ; publications mises en file |
| **Incertain** | Candidats présentés comme un choix (scan, rapprochement) — principe « jamais faux en silence » |
| **Spoiler** | Contenu flouté avec bouton « Afficher le spoiler » ; préférence globale |
| **Modéré** | « Ce contenu a été masqué par la modération » + lien vers les règles ; l'auteur voit le motif et peut faire appel |
| **Offre requise** | Explication sobre de la fonction Plus, jamais sur une action sociale essentielle |

## 5. Responsive et mobile d'abord

- Conception à 375 px d'abord, puis 768 px et 1 280 px ; aucun débordement horizontal (vérifié par les tests à 375 px).
- Cibles tactiles ≥ 44 × 44 px (test 44 existant) ; barre du bas à 5 boutons égaux, libellés tronqués proprement.
- Actions principales accessibles au pouce (bas d'écran) ; feuilles modales en bas sur téléphone.
- Sur ordinateur : rail latéral et contenu centré à 1 200 px max.
- Android : même interface (Capacitor), zone de sécurité respectée (`env(safe-area-inset-bottom)`, existant).

## 6. Accessibilité WCAG 2.2 AA

| Critère | Exigence PANEL | État |
|---|---|---|
| 1.4.3 Contraste | ≥ 4,5:1 texte, 3:1 éléments graphiques, dans les deux modes | [Existant] (audit D-53) |
| 1.4.10 Reflow | 320 px sans défilement horizontal | [Partiel] (testé à 375 px) |
| 2.1.1 Clavier | Tout est utilisable au clavier ; ⌘K pour la recherche | [Partiel] |
| 2.4.7 / 2.4.11 Focus visible et non masqué | Anneau de focus visible, jamais caché par la barre du bas | [Partiel] |
| 2.5.8 Taille des cibles | ≥ 24 px minimum, 44 px visé | [Existant] |
| 3.3.7 Saisie redondante / 3.3.8 Authentification accessible | Pas de test cognitif ; lien magique et gestionnaires de mots de passe acceptés | [Proposé] |
| 4.1.2 Nom, rôle, valeur | `aria-label` sur icônes seules, `role="dialog"` et `aria-modal` sur les modales (partiel existant) | [Partiel] |
| Mouvement | `prefers-reduced-motion` respecté | [Proposé] |
| Textes alternatifs | Obligatoires (champ `alt_text`) pour les images publiées ; proposés à l'auteur | [Proposé] |

## 7. Composants réutilisables

| Composant | Usage | État |
|---|---|---|
| Bouton (principal, secondaire, fantôme, scan) | Partout | [Existant] |
| Pastille / onglet (`tab-btn`) | Sous-navigation, filtres | [Existant] |
| Carte comic (`comic-card`) | Grilles collection, sorties | [Existant] |
| Fiche (section `ex-sec`) | Explorer, événements | [Existant] |
| Modale (`modal-box`) | Formulaires, confirmations | [Existant] |
| Toast | Confirmations courtes, annulation | [Existant] |
| Menu « Plus » (`details.menu-pop`) | Actions secondaires | [Existant] |
| Repli (`details`) « Filtres et outils » | Calendrier | [Existant] |
| Carte de publication | Fil, fiches | [Proposé] |
| Bloc spoiler | Publications, commentaires | [Proposé] |
| Avatar + pseudo + badge | Fil, profils | [Proposé] |
| Composer (zone de saisie riche) | Publication, commentaire | [Proposé] |
| Barre de progression par niveau | Événements, challenges | [Existant] (événements) |
| Carte Comic DNA | Profil | [Proposé] |
| Liste de notifications | Centre de notifications | [Proposé] |

Tous les composants consomment les **jetons CSS** (`--bg`, `--bg-card`, `--ink`, `--muted`, `--line`, `--key`, `--on-key`, accents) et fonctionnent dans les deux modes.

## 8. Ton et rédaction

Français clair, tutoiement à décider (aujourd'hui vouvoiement dans l'interface) ; vocabulaire comics expliqué au survol (FOC, NCBD, TPB) ; jamais de jargon technique dans les messages d'erreur.
